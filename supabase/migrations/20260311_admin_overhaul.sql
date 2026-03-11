-- Admin Overhaul Migration
-- 2026-03-11
--
-- PART 1: Vault-based Grosome API Key (replace per-user default copies with single Vault key)
-- PART 2: User Management (archive, soft-delete, hard-delete)
-- PART 3: App Settings (model config, admin-managed key-value store)
--
-- IMPORTANT: This migration does NOT drop admin_api_keys — it remains for per-user overrides.
-- It removes the auto-assign trigger and cleans up default rows (created_by IS NULL).

BEGIN;

-- ============================================================
-- PART 1: Vault-based Grosome API Key
-- ============================================================

-- 1a. Remove the auto-assign trigger and function
DROP TRIGGER IF EXISTS on_user_created_assign_api_key ON auth.users;
DROP FUNCTION IF EXISTS assign_default_api_key();

-- 1b. Clean up auto-assigned default rows (created_by IS NULL = auto-assigned)
DELETE FROM admin_api_keys WHERE created_by IS NULL;

-- 1c. Update get_admin_api_key_for_user() — per-user override first, then global Vault key
CREATE OR REPLACE FUNCTION get_admin_api_key_for_user(target_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  result_key text;
BEGIN
  -- 1. Check per-user override in admin_api_keys
  SELECT ak.api_key INTO result_key
  FROM admin_api_keys ak
  WHERE ak.user_id = target_user_id AND ak.is_active = true;

  IF result_key IS NOT NULL THEN
    RETURN result_key;
  END IF;

  -- 2. Fall back to global Vault key
  SELECT ds.decrypted_secret INTO result_key
  FROM vault.decrypted_secrets ds
  WHERE ds.name = 'grosome_api_key';

  RETURN result_key;
END;
$$;

-- Maintain service_role-only access (from security fixes migration)
REVOKE EXECUTE ON FUNCTION get_admin_api_key_for_user(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_admin_api_key_for_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION get_admin_api_key_for_user(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION get_admin_api_key_for_user(uuid) TO service_role;

-- 1d. Update has_admin_api_key() — also check global Vault key
CREATE OR REPLACE FUNCTION has_admin_api_key(target_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
  -- Auth check
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  -- Only allow checking your own key status, or admin checking anyone
  IF auth.uid() != target_user_id
     AND NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()) THEN
    RETURN false;
  END IF;

  -- Check per-user override
  IF EXISTS (
    SELECT 1 FROM admin_api_keys
    WHERE user_id = target_user_id AND is_active = true
  ) THEN
    RETURN true;
  END IF;

  -- Check global Vault key
  RETURN EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'grosome_api_key'
  );
END;
$$;

-- 1e. Admin RPC to rotate the global Grosome API key
CREATE OR REPLACE FUNCTION admin_rotate_grosome_key(new_api_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  caller_id uuid;
  existing_id uuid;
BEGIN
  caller_id := auth.uid();

  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can rotate the Grosome API key';
  END IF;

  -- Check if a grosome_api_key secret already exists
  SELECT id INTO existing_id
  FROM vault.secrets
  WHERE name = 'grosome_api_key';

  IF existing_id IS NOT NULL THEN
    -- Update using vault.update_secret (handles encryption)
    PERFORM vault.update_secret(existing_id, new_api_key, 'grosome_api_key', 'Global Grosome API key for all users');
  ELSE
    -- Create using vault.create_secret (handles encryption)
    PERFORM vault.create_secret(new_api_key, 'grosome_api_key', 'Global Grosome API key for all users');
  END IF;
END;
$$;

-- 1f. Admin RPC to get info about the global Grosome API key (without exposing it)
CREATE OR REPLACE FUNCTION admin_get_grosome_key_info()
RETURNS TABLE (
  has_key boolean,
  key_hint text,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can view key info';
  END IF;

  RETURN QUERY
  SELECT
    true AS has_key,
    '...' || RIGHT(ds.decrypted_secret, 8) AS key_hint,
    s.updated_at
  FROM vault.decrypted_secrets ds
  JOIN vault.secrets s ON s.id = ds.id
  WHERE ds.name = 'grosome_api_key';

  -- If no rows returned, return a "no key" row
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::text, NULL::timestamptz;
  END IF;
END;
$$;

-- ============================================================
-- PART 2: User Management
-- ============================================================

-- 2a. Create user_management table
CREATE TABLE IF NOT EXISTS user_management (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  deleted_at timestamptz,
  status_changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status_changed_at timestamptz DEFAULT now(),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_management_user_id ON user_management(user_id);
CREATE INDEX IF NOT EXISTS idx_user_management_status ON user_management(status);

-- 2b. Enable RLS
ALTER TABLE user_management ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_management FORCE ROW LEVEL SECURITY;

-- 2c. RLS policies
DROP POLICY IF EXISTS "Admins can manage user_management" ON user_management;
CREATE POLICY "Admins can manage user_management" ON user_management
  FOR ALL USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can see own status" ON user_management;
CREATE POLICY "Users can see own status" ON user_management
  FOR SELECT USING (auth.uid() = user_id);

-- 2d. Archive user — bans them until 2999-12-31
CREATE OR REPLACE FUNCTION admin_archive_user(target_user_id uuid, reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_id uuid;
BEGIN
  caller_id := auth.uid();

  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can archive users';
  END IF;

  IF caller_id = target_user_id THEN
    RAISE EXCEPTION 'Cannot archive yourself';
  END IF;

  -- Upsert user_management record
  INSERT INTO user_management (user_id, status, status_changed_by, status_changed_at, notes)
  VALUES (target_user_id, 'archived', caller_id, now(), reason)
  ON CONFLICT (user_id) DO UPDATE SET
    status = 'archived',
    status_changed_by = caller_id,
    status_changed_at = now(),
    notes = COALESCE(reason, user_management.notes);

  -- Ban user
  UPDATE auth.users SET banned_until = '2999-12-31'::timestamptz
  WHERE id = target_user_id;
END;
$$;

-- 2e. Restore user — unbans them
CREATE OR REPLACE FUNCTION admin_restore_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_id uuid;
BEGIN
  caller_id := auth.uid();

  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can restore users';
  END IF;

  IF caller_id = target_user_id THEN
    RAISE EXCEPTION 'Cannot restore yourself';
  END IF;

  -- Update user_management record
  INSERT INTO user_management (user_id, status, status_changed_by, status_changed_at)
  VALUES (target_user_id, 'active', caller_id, now())
  ON CONFLICT (user_id) DO UPDATE SET
    status = 'active',
    deleted_at = NULL,
    status_changed_by = caller_id,
    status_changed_at = now();

  -- Unban user
  UPDATE auth.users SET banned_until = NULL
  WHERE id = target_user_id;
END;
$$;

-- 2f. Soft-delete user — bans + marks as deleted + revokes API key
CREATE OR REPLACE FUNCTION admin_soft_delete_user(target_user_id uuid, reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_id uuid;
BEGIN
  caller_id := auth.uid();

  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can delete users';
  END IF;

  IF caller_id = target_user_id THEN
    RAISE EXCEPTION 'Cannot delete yourself';
  END IF;

  -- Upsert user_management record
  INSERT INTO user_management (user_id, status, deleted_at, status_changed_by, status_changed_at, notes)
  VALUES (target_user_id, 'deleted', now(), caller_id, now(), reason)
  ON CONFLICT (user_id) DO UPDATE SET
    status = 'deleted',
    deleted_at = now(),
    status_changed_by = caller_id,
    status_changed_at = now(),
    notes = COALESCE(reason, user_management.notes);

  -- Ban user
  UPDATE auth.users SET banned_until = '2999-12-31'::timestamptz
  WHERE id = target_user_id;

  -- Revoke per-user API key if exists
  DELETE FROM admin_api_keys WHERE user_id = target_user_id;
END;
$$;

-- 2g. Hard-delete user — permanently removes from auth.users (cascades to all tables)
CREATE OR REPLACE FUNCTION admin_hard_delete_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_id uuid;
  current_status text;
BEGIN
  caller_id := auth.uid();

  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can hard-delete users';
  END IF;

  IF caller_id = target_user_id THEN
    RAISE EXCEPTION 'Cannot delete yourself';
  END IF;

  -- Require soft-delete first
  SELECT status INTO current_status
  FROM user_management
  WHERE user_id = target_user_id;

  IF current_status IS NULL OR current_status != 'deleted' THEN
    RAISE EXCEPTION 'User must be soft-deleted before hard-delete. Current status: %',
      COALESCE(current_status, 'no status record');
  END IF;

  -- Delete from auth.users — cascades to all FK tables
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

-- ============================================================
-- PART 3: App Settings
-- ============================================================

-- 3a. Create app_settings table
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  description text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now()
);

-- 3b. Enable RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings FORCE ROW LEVEL SECURITY;

-- 3c. RLS policies
DROP POLICY IF EXISTS "Admins can manage app_settings" ON app_settings;
CREATE POLICY "Admins can manage app_settings" ON app_settings
  FOR ALL USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can read app_settings" ON app_settings;
CREATE POLICY "Authenticated can read app_settings" ON app_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 3d. Seed default settings
INSERT INTO app_settings (key, value, description) VALUES
  ('model_vision', 'claude-sonnet-4-6', 'Model used for food photo analysis'),
  ('model_chat', 'claude-sonnet-4-6', 'Model used for chat conversations'),
  ('model_greeting', 'claude-sonnet-4-6', 'Model used for greeting generation')
ON CONFLICT (key) DO NOTHING;

-- 3e. Get all app settings
CREATE OR REPLACE FUNCTION get_app_settings()
RETURNS TABLE (
  key text,
  value text,
  description text,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Any authenticated user can read settings
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Must be authenticated';
  END IF;

  RETURN QUERY
  SELECT s.key, s.value, s.description, s.updated_at
  FROM app_settings s
  ORDER BY s.key;
END;
$$;

-- 3f. Admin update a setting
CREATE OR REPLACE FUNCTION admin_update_setting(setting_key text, setting_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can update settings';
  END IF;

  UPDATE app_settings
  SET value = setting_value,
      updated_by = auth.uid(),
      updated_at = now()
  WHERE key = setting_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Setting not found: %', setting_key;
  END IF;
END;
$$;

-- 3g. Get allowed models (distinct model values from settings)
-- No auth check — called by service role from edge function
CREATE OR REPLACE FUNCTION get_allowed_models()
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  models text[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT s.value)
  INTO models
  FROM app_settings s
  WHERE s.key LIKE 'model_%';

  RETURN COALESCE(models, ARRAY[]::text[]);
END;
$$;

-- ============================================================
-- UPDATE EXISTING VIEWS / FUNCTIONS
-- ============================================================

-- Drop existing functions that depend on user_stats (return type changed)
DROP FUNCTION IF EXISTS admin_get_user_stats();
DROP FUNCTION IF EXISTS admin_get_user_by_id(uuid);

-- Drop and recreate user_stats view with new fields
DROP VIEW IF EXISTS user_stats CASCADE;

CREATE VIEW user_stats AS
SELECT
  u.id AS user_id,
  u.email,
  u.created_at AS signed_up_at,
  u.last_sign_in_at,
  COALESCE(fe.count, 0) AS food_entries_count,
  COALESCE(cm.count, 0) AS chat_messages_count,
  COALESCE(au.count, 0) AS api_requests_count,
  au.last_request AS last_api_request,
  EXISTS (
    SELECT 1 FROM admin_api_keys ak
    WHERE ak.user_id = u.id AND ak.is_active = true
  ) AS has_custom_key,
  COALESCE(um.status, 'active') AS status,
  um.deleted_at,
  EXISTS (
    SELECT 1 FROM vault.decrypted_secrets ds
    WHERE ds.name = 'grosome_api_key'
  ) AS has_grosome_key
FROM auth.users u
LEFT JOIN (SELECT user_id, COUNT(*) AS count FROM food_entries GROUP BY user_id) fe ON fe.user_id = u.id
LEFT JOIN (SELECT user_id, COUNT(*) AS count FROM chat_messages GROUP BY user_id) cm ON cm.user_id = u.id
LEFT JOIN (SELECT user_id, COUNT(*) AS count, MAX(created_at) AS last_request FROM api_usage GROUP BY user_id) au ON au.user_id = u.id
LEFT JOIN user_management um ON um.user_id = u.id;

-- Restrict view access to service_role only (matching security fixes migration)
REVOKE ALL ON user_stats FROM PUBLIC;
REVOKE ALL ON user_stats FROM anon;
REVOKE ALL ON user_stats FROM authenticated;
GRANT SELECT ON user_stats TO service_role;

-- Recreate admin_get_user_stats() with new fields
-- Note: must use table aliases to avoid ambiguous user_id (return column vs table column)
CREATE OR REPLACE FUNCTION admin_get_user_stats()
RETURNS TABLE (
  user_id uuid,
  email text,
  signed_up_at timestamptz,
  last_sign_in_at timestamptz,
  food_entries_count bigint,
  chat_messages_count bigint,
  api_requests_count bigint,
  last_api_request timestamptz,
  has_custom_key boolean,
  status text,
  deleted_at timestamptz,
  has_grosome_key boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can view user stats';
  END IF;

  RETURN QUERY SELECT us.user_id, us.email::text, us.signed_up_at, us.last_sign_in_at,
    us.food_entries_count, us.chat_messages_count, us.api_requests_count, us.last_api_request,
    us.has_custom_key, us.status, us.deleted_at, us.has_grosome_key
  FROM user_stats us;
END;
$$;

-- Recreate admin_get_user_by_id() with new fields
CREATE OR REPLACE FUNCTION admin_get_user_by_id(target_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  email text,
  signed_up_at timestamptz,
  last_sign_in_at timestamptz,
  food_entries_count bigint,
  chat_messages_count bigint,
  api_requests_count bigint,
  last_api_request timestamptz,
  has_custom_key boolean,
  status text,
  deleted_at timestamptz,
  has_grosome_key boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can view user stats';
  END IF;

  RETURN QUERY SELECT us.user_id, us.email::text, us.signed_up_at, us.last_sign_in_at,
    us.food_entries_count, us.chat_messages_count, us.api_requests_count, us.last_api_request,
    us.has_custom_key, us.status, us.deleted_at, us.has_grosome_key
  FROM user_stats us WHERE us.user_id = admin_get_user_by_id.target_user_id;
END;
$$;

COMMIT;
