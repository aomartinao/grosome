-- Security Fixes Migration
-- Addresses critical and high findings from security audit (2026-02-08)
-- See tasks/security-audit.md for full details
--
-- IMPACT ANALYSIS:
-- - No impact on existing user sessions (auth tokens remain valid)
-- - No impact on main app functionality (food logging, chat, sleep, training)
-- - Admin dashboard WILL need code update: user_stats view is replaced by
--   admin_get_user_stats() RPC function (see admin app changes in this PR)
-- - Edge Function continues to work (uses service_role which retains access)

-- ============================================================
-- C2 FIX: Restrict get_admin_api_key_for_user() to service_role only
-- Previously: PUBLIC, anon, authenticated could all call this
-- Now: only service_role (used by Edge Function) can call it
-- ============================================================
REVOKE EXECUTE ON FUNCTION get_admin_api_key_for_user(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_admin_api_key_for_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION get_admin_api_key_for_user(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION get_admin_api_key_for_user(uuid) TO service_role;

-- Also restrict has_admin_api_key() — callers should only check their own status
-- Replace with a version that enforces auth.uid() = target_user_id or admin check
CREATE OR REPLACE FUNCTION has_admin_api_key(target_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only allow checking your own key status, or admin checking anyone
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  IF auth.uid() != target_user_id
     AND NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM admin_api_keys
    WHERE user_id = target_user_id AND is_active = true
  );
END;
$$;

-- ============================================================
-- C3 FIX: Restrict user_stats view access
-- Previously: authenticated, anon, and even PUBLIC had full access
-- Now: only service_role can query the view directly
-- Admin dashboard uses admin_get_user_stats() RPC instead
-- ============================================================
REVOKE ALL ON user_stats FROM PUBLIC;
REVOKE ALL ON user_stats FROM anon;
REVOKE ALL ON user_stats FROM authenticated;
GRANT SELECT ON user_stats TO service_role;

-- Create admin-only RPC function to replace direct view access
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
  has_admin_key boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only admins can access user stats
  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can view user stats';
  END IF;

  RETURN QUERY SELECT * FROM user_stats;
END;
$$;

-- Also create a single-user version for the admin detail page
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
  has_admin_key boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only admins can access user stats
  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can view user stats';
  END IF;

  RETURN QUERY SELECT * FROM user_stats us WHERE us.user_id = target_user_id;
END;
$$;

-- ============================================================
-- H1 FIX: Enable and force RLS on admin_users table
-- Previously: RLS was disabled despite policies existing
-- ============================================================
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users FORCE ROW LEVEL SECURITY;

-- Helper function to check admin status without triggering RLS recursion
-- (admin_users policies reference admin_users, so a SECURITY DEFINER
-- function is needed to break the cycle)
CREATE OR REPLACE FUNCTION is_admin(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM admin_users WHERE user_id = check_user_id);
$$;

-- Recreate policies using is_admin() to avoid infinite recursion
DROP POLICY IF EXISTS "Users can check own admin status or admins see all" ON admin_users;
CREATE POLICY "Users can check own admin status or admins see all" ON admin_users
  FOR SELECT USING (
    auth.uid() = user_id
    OR is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can insert admin_users" ON admin_users;
CREATE POLICY "Admins can insert admin_users" ON admin_users
  FOR INSERT WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete admin_users" ON admin_users;
CREATE POLICY "Admins can delete admin_users" ON admin_users
  FOR DELETE USING (is_admin(auth.uid()));

-- ============================================================
-- H2 FIX: Restrict api_usage INSERT to service_role only
-- Previously: FOR INSERT WITH CHECK (true) — anyone could insert
-- Now: only service_role can insert (via Edge Function)
-- ============================================================
DROP POLICY IF EXISTS "Service role can insert api_usage" ON api_usage;
CREATE POLICY "Service role can insert api_usage" ON api_usage
  FOR INSERT TO service_role
  WITH CHECK (true);
