-- Admin API Keys Migration
-- Run this in Supabase Dashboard > SQL Editor

-- 1. Enable vault extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- 2. Create admin tables
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  vault_secret_id uuid NOT NULL,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  request_type text NOT NULL,
  tokens_in integer DEFAULT 0,
  tokens_out integer DEFAULT 0,
  model text,
  created_at timestamptz DEFAULT now()
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_admin_api_keys_user_id ON admin_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at);

-- 4. Enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for admin_users
DROP POLICY IF EXISTS "Users can check own admin status or admins see all" ON admin_users;
CREATE POLICY "Users can check own admin status or admins see all" ON admin_users
  FOR SELECT USING (
    auth.uid() = user_id
    OR auth.uid() IN (SELECT user_id FROM admin_users)
  );

DROP POLICY IF EXISTS "Admins can insert admin_users" ON admin_users;
CREATE POLICY "Admins can insert admin_users" ON admin_users
  FOR INSERT WITH CHECK (auth.uid() IN (SELECT user_id FROM admin_users));

DROP POLICY IF EXISTS "Admins can delete admin_users" ON admin_users;
CREATE POLICY "Admins can delete admin_users" ON admin_users
  FOR DELETE USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- 6. RLS Policies for admin_api_keys
DROP POLICY IF EXISTS "Admins can view admin_api_keys" ON admin_api_keys;
CREATE POLICY "Admins can view admin_api_keys" ON admin_api_keys
  FOR SELECT USING (auth.uid() IN (SELECT user_id FROM admin_users));

DROP POLICY IF EXISTS "Admins can insert admin_api_keys" ON admin_api_keys;
CREATE POLICY "Admins can insert admin_api_keys" ON admin_api_keys
  FOR INSERT WITH CHECK (auth.uid() IN (SELECT user_id FROM admin_users));

DROP POLICY IF EXISTS "Admins can update admin_api_keys" ON admin_api_keys;
CREATE POLICY "Admins can update admin_api_keys" ON admin_api_keys
  FOR UPDATE USING (auth.uid() IN (SELECT user_id FROM admin_users));

DROP POLICY IF EXISTS "Admins can delete admin_api_keys" ON admin_api_keys;
CREATE POLICY "Admins can delete admin_api_keys" ON admin_api_keys
  FOR DELETE USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- 7. RLS Policies for api_usage
DROP POLICY IF EXISTS "Users can view own api_usage" ON api_usage;
CREATE POLICY "Users can view own api_usage" ON api_usage
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all api_usage" ON api_usage;
CREATE POLICY "Admins can view all api_usage" ON api_usage
  FOR SELECT USING (auth.uid() IN (SELECT user_id FROM admin_users));

DROP POLICY IF EXISTS "Service role can insert api_usage" ON api_usage;
CREATE POLICY "Service role can insert api_usage" ON api_usage
  FOR INSERT WITH CHECK (true);

-- 8. Functions
CREATE OR REPLACE FUNCTION has_admin_api_key(target_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_api_keys
    WHERE user_id = target_user_id AND is_active = true
  );
END;
$$;

CREATE OR REPLACE FUNCTION admin_add_api_key(target_user_id uuid, api_key text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  secret_id uuid;
  key_id uuid;
  caller_id uuid;
BEGIN
  caller_id := auth.uid();

  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can add API keys';
  END IF;

  DELETE FROM admin_api_keys WHERE user_id = target_user_id;

  INSERT INTO vault.secrets (secret, name, description)
  VALUES (
    api_key,
    'anthropic_key_' || target_user_id::text,
    'Anthropic API key for user ' || target_user_id::text
  )
  RETURNING id INTO secret_id;

  INSERT INTO admin_api_keys (user_id, vault_secret_id, created_by)
  VALUES (target_user_id, secret_id, caller_id)
  RETURNING id INTO key_id;

  RETURN key_id;
END;
$$;

CREATE OR REPLACE FUNCTION admin_revoke_api_key(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  caller_id uuid;
  secret_id uuid;
BEGIN
  caller_id := auth.uid();

  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can revoke API keys';
  END IF;

  SELECT vault_secret_id INTO secret_id
  FROM admin_api_keys WHERE user_id = target_user_id;

  IF secret_id IS NOT NULL THEN
    DELETE FROM admin_api_keys WHERE user_id = target_user_id;
    DELETE FROM vault.secrets WHERE id = secret_id;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION get_admin_api_key_for_user(target_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  api_key text;
  secret_key_id bigint;
BEGIN
  SELECT s.secret, s.key_id INTO api_key, secret_key_id
  FROM admin_api_keys aak
  JOIN vault.secrets s ON s.id = aak.vault_secret_id
  WHERE aak.user_id = target_user_id AND aak.is_active = true;

  IF secret_key_id IS NOT NULL THEN
    SELECT ds.decrypted_secret INTO api_key
    FROM admin_api_keys aak
    JOIN vault.decrypted_secrets ds ON ds.id = aak.vault_secret_id
    WHERE aak.user_id = target_user_id AND aak.is_active = true;
  END IF;

  RETURN api_key;
END;
$$;

-- 9. Auto-assign default API key to new users
CREATE OR REPLACE FUNCTION assign_default_api_key()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  default_secret_id uuid;
BEGIN
  SELECT id INTO default_secret_id
  FROM vault.secrets
  WHERE name = 'default_anthropic_key'
  LIMIT 1;

  IF default_secret_id IS NOT NULL THEN
    INSERT INTO admin_api_keys (user_id, vault_secret_id, created_by, is_active)
    VALUES (NEW.id, default_secret_id, NULL, true)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_created_assign_api_key ON auth.users;
CREATE TRIGGER on_user_created_assign_api_key
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION assign_default_api_key();

-- 10. User stats view for admin dashboard
CREATE OR REPLACE VIEW user_stats AS
SELECT
  u.id as user_id,
  u.email,
  u.created_at as signed_up_at,
  u.last_sign_in_at,
  COALESCE(fe.count, 0) as food_entries_count,
  COALESCE(cm.count, 0) as chat_messages_count,
  COALESCE(au.count, 0) as api_requests_count,
  au.last_request as last_api_request,
  EXISTS (SELECT 1 FROM admin_api_keys ak WHERE ak.user_id = u.id AND ak.is_active) as has_admin_key
FROM auth.users u
LEFT JOIN (SELECT user_id, COUNT(*) as count FROM food_entries GROUP BY user_id) fe ON fe.user_id = u.id
LEFT JOIN (SELECT user_id, COUNT(*) as count FROM chat_messages GROUP BY user_id) cm ON cm.user_id = u.id
LEFT JOIN (SELECT user_id, COUNT(*) as count, MAX(created_at) as last_request FROM api_usage GROUP BY user_id) au ON au.user_id = u.id;

-- 11. Grant access to authenticated users
GRANT SELECT ON user_stats TO authenticated;

-- 12. Add yourself as admin (CHANGE THIS EMAIL!)
INSERT INTO admin_users (user_id)
SELECT id FROM auth.users WHERE email = 'martin.holecko@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

-- 13. Store default API key (CHANGE THIS KEY!)
INSERT INTO vault.secrets (secret, name, description)
VALUES (
  'YOUR_ANTHROPIC_API_KEY_HERE',
  'default_anthropic_key',
  'Default API key assigned to all new users'
)
ON CONFLICT DO NOTHING;

-- 14. Assign default key to all existing users
INSERT INTO admin_api_keys (user_id, vault_secret_id, created_by, is_active)
SELECT
  u.id,
  (SELECT id FROM vault.secrets WHERE name = 'default_anthropic_key'),
  NULL,
  true
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM admin_api_keys ak WHERE ak.user_id = u.id);
