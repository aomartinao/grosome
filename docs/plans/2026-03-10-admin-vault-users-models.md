# Admin Overhaul: Vault Key, User Management, Model Config

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate the shared API key to Supabase Vault, add user archive/soft-delete, and make LLM model selection configurable from the admin UI.

**Architecture:** Single SQL migration adds Vault-based key storage, user management table, and app settings table. The anthropic-proxy edge function reads the global key from Vault (with per-user override fallback). Admin UI gets a new Settings page for key rotation and model config, plus user status management on the Users/UserDetail pages.

**Tech Stack:** Supabase (Vault, RPC, RLS), React/TypeScript (admin dashboard), Deno (edge function)

---

## Task 1: SQL Migration — Vault key, user management, app settings

**Files:**
- Create: `supabase/migrations/20260310_admin_overhaul.sql`

**Step 1: Write the migration SQL**

```sql
-- ============================================================
-- Migration: Admin Overhaul
-- 1. Vault-based global API key (replaces per-user key copies)
-- 2. User management (active/archived/deleted states)
-- 3. App settings (model configuration)
-- ============================================================

-- ============================================================
-- PART 1: Vault-based Grosome API Key
-- ============================================================

-- Store the global key in Vault.
-- NOTE: After running this migration, you must manually insert the key:
--   SELECT vault.create_secret('sk-ant-your-key-here', 'grosome_api_key', 'Global Anthropic API key for Grosome');
-- The migration cannot contain the actual key.

-- Update the key retrieval function to check:
-- 1. Per-user override in admin_api_keys (for special users)
-- 2. Global key from Vault (for everyone else)
CREATE OR REPLACE FUNCTION get_admin_api_key_for_user(target_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  override_key text;
  global_key text;
BEGIN
  -- Check for per-user override first
  SELECT api_key INTO override_key
  FROM admin_api_keys
  WHERE user_id = target_user_id AND is_active = true;

  IF override_key IS NOT NULL THEN
    RETURN override_key;
  END IF;

  -- Fall back to global Vault key
  SELECT decrypted_secret INTO global_key
  FROM vault.decrypted_secrets
  WHERE name = 'grosome_api_key'
  LIMIT 1;

  RETURN global_key;
END;
$$;

-- Update has_admin_api_key to also check Vault
-- (user has access if they have an override OR the global key exists)
CREATE OR REPLACE FUNCTION has_admin_api_key(target_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check per-user override
  IF EXISTS (
    SELECT 1 FROM admin_api_keys
    WHERE user_id = target_user_id AND is_active = true
  ) THEN
    RETURN true;
  END IF;

  -- Check global Vault key exists
  RETURN EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'grosome_api_key'
  );
END;
$$;

-- Remove the auto-assign trigger (no longer needed — global key covers everyone)
DROP TRIGGER IF EXISTS on_user_created_assign_api_key ON auth.users;
DROP FUNCTION IF EXISTS assign_default_api_key();

-- Clean up: remove all rows that were copies of the shared default key.
-- Keep only rows where created_by IS NOT NULL (admin-assigned overrides).
-- If ALL rows have created_by = NULL (auto-assigned defaults), delete them all.
DELETE FROM admin_api_keys
WHERE created_by IS NULL;

-- Admin RPC to rotate the global Vault key
CREATE OR REPLACE FUNCTION admin_rotate_grosome_key(new_api_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_id uuid;
  existing_id uuid;
BEGIN
  caller_id := auth.uid();

  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can rotate the Grosome key';
  END IF;

  -- Check if key already exists in Vault
  SELECT id INTO existing_id
  FROM vault.secrets
  WHERE name = 'grosome_api_key'
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    -- Update existing secret
    UPDATE vault.secrets
    SET secret = new_api_key, updated_at = now()
    WHERE id = existing_id;
  ELSE
    -- Create new secret
    PERFORM vault.create_secret(new_api_key, 'grosome_api_key', 'Global Anthropic API key for Grosome');
  END IF;

  RETURN true;
END;
$$;

-- Admin RPC to get masked global key (last 8 chars only)
CREATE OR REPLACE FUNCTION admin_get_grosome_key_info()
RETURNS TABLE(has_key boolean, key_hint text, updated_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_id uuid;
BEGIN
  caller_id := auth.uid();

  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = caller_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    true AS has_key,
    '...' || RIGHT(ds.decrypted_secret, 8) AS key_hint,
    s.updated_at
  FROM vault.decrypted_secrets ds
  JOIN vault.secrets s ON s.id = ds.id
  WHERE ds.name = 'grosome_api_key'
  LIMIT 1;

  -- If no rows returned, return empty indicator
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, ''::text, NULL::timestamptz;
  END IF;
END;
$$;

-- ============================================================
-- PART 2: User Management (active / archived / soft-deleted)
-- ============================================================

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

ALTER TABLE user_management ENABLE ROW LEVEL SECURITY;

-- RLS: admins can see and manage all, users can see own status
DROP POLICY IF EXISTS "Admins manage user_management" ON user_management;
CREATE POLICY "Admins manage user_management" ON user_management
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM admin_users));

DROP POLICY IF EXISTS "Users see own status" ON user_management;
CREATE POLICY "Users see own status" ON user_management
  FOR SELECT USING (auth.uid() = user_id);

-- Archive a user (disable login, keep data)
CREATE OR REPLACE FUNCTION admin_archive_user(target_user_id uuid, reason text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_id uuid;
BEGIN
  caller_id := auth.uid();

  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = caller_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Don't allow archiving yourself
  IF target_user_id = caller_id THEN
    RAISE EXCEPTION 'Cannot archive yourself';
  END IF;

  -- Upsert user management record
  INSERT INTO user_management (user_id, status, status_changed_by, status_changed_at, notes)
  VALUES (target_user_id, 'archived', caller_id, now(), reason)
  ON CONFLICT (user_id)
  DO UPDATE SET
    status = 'archived',
    deleted_at = NULL,
    status_changed_by = caller_id,
    status_changed_at = now(),
    notes = COALESCE(reason, user_management.notes);

  -- Ban user in auth (prevents login)
  UPDATE auth.users SET banned_until = '2999-12-31'::timestamptz WHERE id = target_user_id;

  RETURN true;
END;
$$;

-- Restore an archived or soft-deleted user
CREATE OR REPLACE FUNCTION admin_restore_user(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_id uuid;
BEGIN
  caller_id := auth.uid();

  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = caller_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE user_management
  SET status = 'active', deleted_at = NULL, status_changed_by = caller_id, status_changed_at = now()
  WHERE user_id = target_user_id;

  -- Unban user
  UPDATE auth.users SET banned_until = NULL WHERE id = target_user_id;

  RETURN true;
END;
$$;

-- Soft-delete a user (starts 90-day retention)
CREATE OR REPLACE FUNCTION admin_soft_delete_user(target_user_id uuid, reason text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_id uuid;
BEGIN
  caller_id := auth.uid();

  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = caller_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF target_user_id = caller_id THEN
    RAISE EXCEPTION 'Cannot delete yourself';
  END IF;

  INSERT INTO user_management (user_id, status, deleted_at, status_changed_by, status_changed_at, notes)
  VALUES (target_user_id, 'deleted', now(), caller_id, now(), reason)
  ON CONFLICT (user_id)
  DO UPDATE SET
    status = 'deleted',
    deleted_at = now(),
    status_changed_by = caller_id,
    status_changed_at = now(),
    notes = COALESCE(reason, user_management.notes);

  -- Ban user in auth
  UPDATE auth.users SET banned_until = '2999-12-31'::timestamptz WHERE id = target_user_id;

  -- Revoke API key
  DELETE FROM admin_api_keys WHERE user_id = target_user_id;

  RETURN true;
END;
$$;

-- Hard delete a user (permanent, only for soft-deleted users past retention or admin override)
CREATE OR REPLACE FUNCTION admin_hard_delete_user(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_id uuid;
  user_status text;
  user_deleted_at timestamptz;
BEGIN
  caller_id := auth.uid();

  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = caller_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF target_user_id = caller_id THEN
    RAISE EXCEPTION 'Cannot delete yourself';
  END IF;

  -- Check user is soft-deleted
  SELECT status, deleted_at INTO user_status, user_deleted_at
  FROM user_management
  WHERE user_id = target_user_id;

  IF user_status IS NULL OR user_status != 'deleted' THEN
    RAISE EXCEPTION 'User must be soft-deleted before hard delete';
  END IF;

  -- Delete from auth.users — ON DELETE CASCADE handles all related tables
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN true;
END;
$$;

-- Update the user_stats view to include status
DROP VIEW IF EXISTS user_stats;
CREATE VIEW user_stats AS
SELECT
  u.id as user_id,
  u.email,
  u.created_at as signed_up_at,
  u.last_sign_in_at,
  COALESCE(fe.count, 0) as food_entries_count,
  COALESCE(cm.count, 0) as chat_messages_count,
  COALESCE(au.count, 0) as api_requests_count,
  au.last_request as last_api_request,
  EXISTS (SELECT 1 FROM admin_api_keys ak WHERE ak.user_id = u.id AND ak.is_active) as has_custom_key,
  COALESCE(um.status, 'active') as status,
  um.deleted_at,
  -- has_admin_key is true if user has override OR global vault key exists
  (
    EXISTS (SELECT 1 FROM admin_api_keys ak WHERE ak.user_id = u.id AND ak.is_active)
    OR EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'grosome_api_key')
  ) as has_grosome_key
FROM auth.users u
LEFT JOIN (SELECT user_id, COUNT(*) as count FROM food_entries GROUP BY user_id) fe ON fe.user_id = u.id
LEFT JOIN (SELECT user_id, COUNT(*) as count FROM chat_messages GROUP BY user_id) cm ON cm.user_id = u.id
LEFT JOIN (SELECT user_id, COUNT(*) as count, MAX(created_at) as last_request FROM api_usage GROUP BY user_id) au ON au.user_id = u.id
LEFT JOIN user_management um ON um.user_id = u.id;

GRANT SELECT ON user_stats TO authenticated;

-- Update admin_get_user_stats to include status
CREATE OR REPLACE FUNCTION admin_get_user_stats()
RETURNS TABLE(
  user_id uuid,
  email text,
  signed_up_at timestamptz,
  last_sign_in_at timestamptz,
  food_entries_count bigint,
  chat_messages_count bigint,
  api_requests_count bigint,
  last_api_request timestamptz,
  has_admin_key boolean,
  has_custom_key boolean,
  status text,
  deleted_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    us.user_id,
    us.email::text,
    us.signed_up_at,
    us.last_sign_in_at,
    us.food_entries_count,
    us.chat_messages_count,
    us.api_requests_count,
    us.last_api_request,
    us.has_grosome_key AS has_admin_key,
    us.has_custom_key,
    us.status,
    us.deleted_at
  FROM user_stats us;
END;
$$;

-- Update admin_get_user_by_id to include status
CREATE OR REPLACE FUNCTION admin_get_user_by_id(target_user_id uuid)
RETURNS TABLE(
  user_id uuid,
  email text,
  signed_up_at timestamptz,
  last_sign_in_at timestamptz,
  food_entries_count bigint,
  chat_messages_count bigint,
  api_requests_count bigint,
  last_api_request timestamptz,
  has_admin_key boolean,
  has_custom_key boolean,
  status text,
  deleted_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    us.user_id,
    us.email::text,
    us.signed_up_at,
    us.last_sign_in_at,
    us.food_entries_count,
    us.chat_messages_count,
    us.api_requests_count,
    us.last_api_request,
    us.has_grosome_key AS has_admin_key,
    us.has_custom_key,
    us.status,
    us.deleted_at
  FROM user_stats us
  WHERE us.user_id = target_user_id;
END;
$$;

-- ============================================================
-- PART 3: App Settings (model configuration)
-- ============================================================

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  description text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Admins can read and write
DROP POLICY IF EXISTS "Admins manage app_settings" ON app_settings;
CREATE POLICY "Admins manage app_settings" ON app_settings
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- All authenticated users can read (needed for model config on client)
DROP POLICY IF EXISTS "Authenticated users read app_settings" ON app_settings;
CREATE POLICY "Authenticated users read app_settings" ON app_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Seed default model settings
INSERT INTO app_settings (key, value, description) VALUES
  ('model_vision', 'claude-sonnet-4-20250514', 'Model for image analysis (food photos, menu photos)'),
  ('model_chat', 'claude-sonnet-4-20250514', 'Model for text chat (coaching, food logging by text)'),
  ('model_greeting', 'claude-haiku-4-5-20251001', 'Model for AI-generated greetings (not currently used)')
ON CONFLICT (key) DO NOTHING;

-- RPC to get all app settings (for client use)
CREATE OR REPLACE FUNCTION get_app_settings()
RETURNS TABLE(key text, value text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT s.key, s.value FROM app_settings s;
END;
$$;

-- RPC to update a setting (admin only)
CREATE OR REPLACE FUNCTION admin_update_setting(setting_key text, setting_value text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_id uuid;
BEGIN
  caller_id := auth.uid();

  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = caller_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE app_settings
  SET value = setting_value, updated_by = caller_id, updated_at = now()
  WHERE key = setting_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown setting: %', setting_key;
  END IF;

  RETURN true;
END;
$$;

-- RPC for the proxy to get allowed models list
CREATE OR REPLACE FUNCTION get_allowed_models()
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN ARRAY(
    SELECT DISTINCT s.value FROM app_settings s
    WHERE s.key IN ('model_vision', 'model_chat', 'model_greeting')
  );
END;
$$;
```

**Step 2: Run the migration**

```bash
source .env && psql "postgresql://postgres.paifkqqqwhtqhyxgibvl:${DATABASE_PASSWORD}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres" -f supabase/migrations/20260310_admin_overhaul.sql
```

Expected: All CREATE/DROP statements succeed.

**Step 3: Insert the global key into Vault**

This must be done manually by the admin. After running the migration, execute in Supabase SQL Editor (or psql):

```sql
-- Replace with your actual Anthropic API key
SELECT vault.create_secret('sk-ant-YOUR-KEY-HERE', 'grosome_api_key', 'Global Anthropic API key for Grosome');
```

**Step 4: Verify**

```bash
source .env && psql "postgresql://postgres.paifkqqqwhtqhyxgibvl:${DATABASE_PASSWORD}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres" -c "SELECT * FROM get_app_settings();"
```

Expected: Three rows with model_vision, model_chat, model_greeting.

**Step 5: Commit**

```bash
git add supabase/migrations/20260310_admin_overhaul.sql
git commit -m "feat: add migration for vault key, user management, model config"
```

---

## Task 2: Update anthropic-proxy edge function

**Files:**
- Modify: `supabase/functions/anthropic-proxy/index.ts`

**Changes:**
- Remove hardcoded `ALLOWED_MODELS` set
- Fetch allowed models from DB via `get_allowed_models()` RPC at request time
- No other changes needed — `get_admin_api_key_for_user()` already handles the Vault fallback from the migration

**Step 1: Update the edge function**

Replace the hardcoded `ALLOWED_MODELS` with a dynamic lookup:

```typescript
// Remove this:
// const ALLOWED_MODELS = new Set(["claude-sonnet-4-20250514"]);

// In the main handler, after creating serviceClient, fetch allowed models:
const { data: allowedModels, error: modelsError } = await serviceClient.rpc('get_allowed_models');

if (modelsError || !allowedModels) {
  console.error("Failed to fetch allowed models:", modelsError);
  return jsonResponse(req, 500, { error: "Internal server error" });
}

const allowedModelSet = new Set(allowedModels as string[]);
```

Then update `validateRequestBody` to accept the model set as a parameter instead of using the global.

**Step 2: Test locally** (if possible) or deploy and test with a real request.

**Step 3: Commit**

```bash
git add supabase/functions/anthropic-proxy/index.ts
git commit -m "feat: dynamic model allowlist from app_settings"
```

---

## Task 3: Update client-side AI services to use configurable models

**Files:**
- Modify: `src/services/ai/client.ts`
- Modify: `src/services/ai/unified.ts`
- Modify: `src/services/ai/proxy.ts` (add settings fetch)

**Changes:**
- Add a `getModelConfig()` function that fetches model settings from `get_app_settings()` RPC
- Cache the settings in memory (refresh on page load)
- Replace all hardcoded `'claude-sonnet-4-20250514'` with the appropriate setting
- `client.ts` functions use `model_vision` for image calls and `model_chat` for text
- `unified.ts` `processUnifiedMessage` uses `model_chat`
- When using proxy, pass the model from settings; when using direct SDK, use the same model

**Step 1: Add model config service**

Create a small helper in `src/services/ai/proxy.ts` (or a new `src/services/ai/config.ts`):

```typescript
interface ModelConfig {
  vision: string;
  chat: string;
  greeting: string;
}

let cachedConfig: ModelConfig | null = null;

export async function getModelConfig(): Promise<ModelConfig> {
  if (cachedConfig) return cachedConfig;

  const supabase = getSupabase();
  if (!supabase) {
    // Fallback defaults
    return { vision: 'claude-sonnet-4-20250514', chat: 'claude-sonnet-4-20250514', greeting: 'claude-haiku-4-5-20251001' };
  }

  const { data, error } = await supabase.rpc('get_app_settings');
  if (error || !data) {
    return { vision: 'claude-sonnet-4-20250514', chat: 'claude-sonnet-4-20250514', greeting: 'claude-haiku-4-5-20251001' };
  }

  const settings = Object.fromEntries(data.map((r: { key: string; value: string }) => [r.key, r.value]));
  cachedConfig = {
    vision: settings.model_vision || 'claude-sonnet-4-20250514',
    chat: settings.model_chat || 'claude-sonnet-4-20250514',
    greeting: settings.model_greeting || 'claude-haiku-4-5-20251001',
  };
  return cachedConfig;
}

export function clearModelConfigCache() {
  cachedConfig = null;
}
```

**Step 2: Update `client.ts`** — replace 4 hardcoded model strings with `await getModelConfig()`.

**Step 3: Update `unified.ts`** — replace 2 hardcoded model strings.

**Step 4: Verify build**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/services/ai/client.ts src/services/ai/unified.ts src/services/ai/proxy.ts
git commit -m "feat: use configurable models from app_settings"
```

---

## Task 4: Admin UI — Settings page (key rotation + model config)

**Files:**
- Create: `admin/src/pages/Settings.tsx`
- Modify: `admin/src/components/Layout.tsx` (add Settings nav item)
- Modify: `admin/src/App.tsx` (add Settings route)
- Modify: `admin/src/services/supabase.ts` (add RPC wrappers)

**Step 1: Add service functions to `admin/src/services/supabase.ts`**

```typescript
// Grosome key management
export async function getGrosomeKeyInfo(): Promise<{ has_key: boolean; key_hint: string; updated_at: string | null }> {
  const { data, error } = await supabase.rpc('admin_get_grosome_key_info');
  if (error) throw error;
  return data?.[0] || { has_key: false, key_hint: '', updated_at: null };
}

export async function rotateGrosomeKey(newKey: string): Promise<boolean> {
  const { error } = await supabase.rpc('admin_rotate_grosome_key', { new_api_key: newKey });
  if (error) throw error;
  return true;
}

// App settings (models)
export interface AppSetting {
  key: string;
  value: string;
}

export async function getAppSettings(): Promise<AppSetting[]> {
  const { data, error } = await supabase.rpc('get_app_settings');
  if (error) throw error;
  return data || [];
}

export async function updateAppSetting(key: string, value: string): Promise<boolean> {
  const { error } = await supabase.rpc('admin_update_setting', { setting_key: key, setting_value: value });
  if (error) throw error;
  return true;
}
```

**Step 2: Create `admin/src/pages/Settings.tsx`**

Page with two cards:
1. **Grosome API Key** — shows masked key hint, "Rotate Key" button, input for new key with confirmation dialog
2. **Model Configuration** — three dropdowns (Vision, Chat, Greeting) with save buttons

Available Anthropic models for dropdown:
```typescript
const ANTHROPIC_MODELS = [
  { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { id: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
];
```

**Step 3: Add Settings nav and route**

In `Layout.tsx`, add to navItems:
```typescript
{ path: '/settings', label: 'Settings', icon: Settings },
```

In `App.tsx`, add the `/settings` route.

**Step 4: Verify build**

```bash
cd admin && npx tsc --noEmit && cd ..
```

**Step 5: Commit**

```bash
git add admin/src/pages/Settings.tsx admin/src/components/Layout.tsx admin/src/App.tsx admin/src/services/supabase.ts
git commit -m "feat: admin settings page with key rotation and model config"
```

---

## Task 5: Admin UI — User management (archive/delete/restore)

**Files:**
- Modify: `admin/src/services/supabase.ts` (add user management RPCs)
- Modify: `admin/src/pages/Users.tsx` (add status column, status filter)
- Modify: `admin/src/pages/UserDetail.tsx` (add status actions, rename "Admin API Key" → "Custom API Key Override")

**Step 1: Add service functions**

```typescript
// User management types
export interface UserStats {
  // ... existing fields ...
  has_custom_key: boolean;
  status: 'active' | 'archived' | 'deleted';
  deleted_at: string | null;
}

// User management actions
export async function archiveUser(userId: string, reason?: string): Promise<boolean> {
  const { error } = await supabase.rpc('admin_archive_user', { target_user_id: userId, reason: reason || null });
  if (error) throw error;
  return true;
}

export async function restoreUser(userId: string): Promise<boolean> {
  const { error } = await supabase.rpc('admin_restore_user', { target_user_id: userId });
  if (error) throw error;
  return true;
}

export async function softDeleteUser(userId: string, reason?: string): Promise<boolean> {
  const { error } = await supabase.rpc('admin_soft_delete_user', { target_user_id: userId, reason: reason || null });
  if (error) throw error;
  return true;
}

export async function hardDeleteUser(userId: string): Promise<boolean> {
  const { error } = await supabase.rpc('admin_hard_delete_user', { target_user_id: userId });
  if (error) throw error;
  return true;
}
```

**Step 2: Update Users.tsx**

- Add status badge column (Active = green, Archived = yellow, Deleted = red with days remaining)
- Add status filter tabs or dropdown at top (All / Active / Archived / Deleted)
- "Key" column: rename from "Admin Key" to show "Grosome" (global) vs "Custom" badge

**Step 3: Update UserDetail.tsx**

- Add status section at top of page with action buttons:
  - Active → Archive button, Delete button
  - Archived → Restore button, Delete button
  - Deleted → Restore button, Hard Delete button (with double confirmation, shows days since deletion and 90-day note)
- Rename "Admin API Key" card → "Custom API Key Override"
- Update description text: "Override the global Grosome key with a custom key for this user"

**Step 4: Verify build**

```bash
cd admin && npx tsc --noEmit && cd ..
```

**Step 5: Commit**

```bash
git add admin/src/services/supabase.ts admin/src/pages/Users.tsx admin/src/pages/UserDetail.tsx
git commit -m "feat: user management with archive/delete/restore in admin UI"
```

---

## Task 6: Update supabase-schema.sql and final verification

**Files:**
- Modify: `supabase-schema.sql` (update to reflect new tables/functions)

**Step 1: Update schema file** to include `user_management`, `app_settings` tables and new functions.

**Step 2: Run schema drift check**

```bash
npm run check-schema 2>&1 || true
```

**Step 3: Build everything**

```bash
npm run build
cd admin && npm run build && cd ..
```

**Step 4: Bump version in `package.json` and update `src/changelog.json`**

**Step 5: Final commit and push**

```bash
git add -A  # Review first with git status!
git commit -m "feat: admin overhaul — vault key, user management, model config"
git push origin main
```

**Step 6: Check CI**

```bash
gh run list --limit 3
```

---

## Post-deployment: Manual Steps

1. **Insert the Anthropic key into Vault** (Supabase SQL Editor):
   ```sql
   SELECT vault.create_secret('sk-ant-YOUR-KEY', 'grosome_api_key', 'Global Anthropic API key for Grosome');
   ```

2. **Deploy the updated edge function** (Supabase CLI or Dashboard)

3. **Verify** by logging in as a user and sending a chat message — should use the Vault key via proxy
