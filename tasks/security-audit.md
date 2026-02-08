# Security Audit Report - Protee (GRRROMODE v2)

**Date:** February 8, 2026
**Branch:** `grrromode-v2`
**Auditor:** Peta (Security Specialist)
**Scope:** Full codebase, database policies, live Supabase instance

---

## Executive Summary

This audit identified **3 critical**, **4 high**, **5 medium**, and **5 low** severity issues. The most urgent findings are:

1. **A live Anthropic API key is hardcoded in a database trigger function** -- visible to anyone with database read access and actively used for all new user registrations.
2. **`get_admin_api_key_for_user()` has no authorization check** -- any authenticated user (or even anon) can call it to retrieve API keys for any user.
3. **The `user_stats` view exposes all users' emails and activity data** to any authenticated user with no RLS filtering.

| Severity | Count | Exploitable Now |
|----------|-------|-----------------|
| Critical | 3     | Yes             |
| High     | 4     | Yes             |
| Medium   | 5     | Partially       |
| Low      | 5     | No              |

---

## CRITICAL FINDINGS

### C1. Hardcoded API Key in Database Trigger Function
**Severity:** CRITICAL
**Exploitable:** YES -- key is live in production
**Location:** `assign_default_api_key()` function in PostgreSQL (live database)

The `assign_default_api_key()` trigger function contains a hardcoded Anthropic API key in its source code:
```
DECLARE
  default_key text := 'sk-ant-api03-HstyA_jBm1hrn64KWgxjhh9...';
```

This key:
- Is visible in `pg_proc.prosrc` to anyone with database read access
- Is assigned to EVERY new user who signs up via the `on_user_created_assign_api_key` trigger
- Is stored in plaintext in `admin_api_keys.api_key` for every user
- Can be retrieved by ANY user via the `get_admin_api_key_for_user()` function (see C2)

The migration file `supabase/migrations/20260130_admin_api_keys_simple.sql` shows this was an intentional "simplified" version that removed Vault encryption in favor of plaintext storage. The original Vault-based migration exists at `20260129_admin_api_keys.sql` but was superseded.

**Impact:** Complete compromise of the Anthropic API key. Any user can extract it and use it outside the app, incurring unlimited costs.

**Recommended Fix:**
1. **IMMEDIATELY rotate the exposed API key** via the Anthropic dashboard
2. Revert to the Vault-based approach (`20260129_admin_api_keys.sql`)
3. Store the default key in Vault, not in function source
4. Alter the trigger to reference Vault secrets instead of a hardcoded string

---

### C2. `get_admin_api_key_for_user()` Has No Authorization Check
**Severity:** CRITICAL
**Exploitable:** YES
**Location:** PostgreSQL function `get_admin_api_key_for_user`

This `SECURITY DEFINER` function returns the actual API key for any user ID, with zero authorization checks:
```sql
SELECT api_key INTO result_key
FROM admin_api_keys
WHERE user_id = target_user_id AND is_active = true;
RETURN result_key;
```

Confirmed via live database:
- `authenticated` role: CAN execute (verified)
- `anon` role: CAN execute (verified)
- No check that caller is admin, no check that caller equals target_user_id

Any authenticated user can call:
```javascript
supabase.rpc('get_admin_api_key_for_user', { target_user_id: 'any-user-uuid' })
```
...and receive the plaintext API key.

Even the `anon` role (unauthenticated) can call this function, though `auth.uid()` would be null inside the function -- the function doesn't use `auth.uid()` at all, so it still returns the key.

**Note:** Compare with `admin_add_api_key()` and `admin_revoke_api_key()` which DO check `auth.uid() IN admin_users`. The `get_admin_api_key_for_user()` function was intentionally left without this check because the Edge Function calls it with the service role. However, it's callable by anyone.

**Impact:** Full API key theft for any user.

**Recommended Fix:**
1. Add admin authorization check to `get_admin_api_key_for_user()`:
```sql
IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()) THEN
  RAISE EXCEPTION 'Unauthorized';
END IF;
```
2. Or better: revoke EXECUTE from `authenticated` and `anon` roles, only allow `service_role`

---

### C3. `user_stats` View Exposes All Users' Data to Any Authenticated User
**Severity:** CRITICAL
**Exploitable:** YES
**Location:** `user_stats` view, `GRANT SELECT ON user_stats TO authenticated`

The `user_stats` view joins `auth.users` (which bypasses RLS in views) with food_entries, chat_messages, and api_usage, exposing:
- **All users' email addresses**
- **Sign-up dates and last sign-in timestamps**
- **Food entry counts, chat message counts, API request counts**
- **Whether each user has an active admin API key**

This view is `GRANT SELECT` to the `authenticated` role, and confirmed via the live database that `authenticated`, `anon`, and even the base `postgres` role all have `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE` privileges on it.

Any authenticated user can run:
```javascript
supabase.from('user_stats').select('*')
```
...and get the full list of all users and their activity metrics.

**Impact:** PII leakage (email addresses), user enumeration, privacy violation (GDPR/data protection concerns).

**Recommended Fix:**
1. `REVOKE ALL ON user_stats FROM authenticated, anon;`
2. Create an RLS-protected wrapper or only grant access to a custom `admin` role
3. Alternatively, drop the view and query via an admin-only `SECURITY DEFINER` function

---

## HIGH FINDINGS

### H1. `admin_users` Table Has RLS Disabled
**Severity:** HIGH
**Location:** `admin_users` table (live database)

Despite the migration scripts calling `ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY`, the live database shows `relrowsecurity = false` for `admin_users`. The pg_policies output shows policies exist, but they are IGNORED because RLS is not actually enabled on the table.

This means:
- Any authenticated user can query `admin_users` to see who is an admin
- However, the practical impact is limited since admin user IDs aren't directly exploitable beyond revealing who is an admin

Verified live:
```
relname = admin_users | relrowsecurity = f
```

Yet pg_policies shows policies for admin_users (SELECT with `auth.uid() = user_id`), which are simply not enforced.

**Impact:** Admin user enumeration, which can be combined with C2/C3 for targeted attacks.

**Recommended Fix:**
```sql
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users FORCE ROW LEVEL SECURITY;
```

---

### H2. `api_usage` INSERT Policy Allows Any User to Insert
**Severity:** HIGH
**Location:** `api_usage` table RLS policy

```sql
CREATE POLICY "Service role can insert api_usage" ON api_usage
  FOR INSERT WITH CHECK (true);
```

This policy name suggests it was intended for the service role, but it applies to ALL roles (including `authenticated` and `anon`). Any user can insert arbitrary api_usage records:
- Pollute usage tracking with fake data
- Frame other users by inserting records with their user_id
- Overflow the table with junk data (no rate limiting)

**Impact:** Data integrity compromise, usage tracking rendered unreliable, potential DoS via table bloat.

**Recommended Fix:**
Either:
1. Change the policy role to `service_role` only:
```sql
DROP POLICY "Service role can insert api_usage" ON api_usage;
CREATE POLICY "Service role can insert api_usage" ON api_usage
  FOR INSERT TO service_role WITH CHECK (true);
```
2. Or add `WITH CHECK (auth.uid() = user_id)` if users should be able to self-report

---

### H3. CORS Wildcard on Edge Function
**Severity:** HIGH
**Location:** `supabase/functions/anthropic-proxy/index.ts:8`

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  ...
};
```

The anthropic-proxy Edge Function allows requests from any origin. Combined with a valid JWT token (which is stored in the browser), any malicious website could:
- Make cross-origin requests to the proxy
- If the user has a session cookie / stored JWT, the request would be authenticated
- The malicious site could abuse the user's API quota

**Impact:** Cross-origin API abuse, token theft via CSRF-like attacks.

**Recommended Fix:**
Restrict to the actual app domain:
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://protee.app", // or your domain
  ...
};
```

---

### H4. Browser-Side API Key Usage with `dangerouslyAllowBrowser: true`
**Severity:** HIGH (acknowledged/accepted risk from previous audit)
**Location:** `src/services/ai/client.ts:109`, `src/services/ai/unified.ts:614`

```typescript
const client = new Anthropic({
  apiKey,
  dangerouslyAllowBrowser: true,
});
```

Users who provide their own API key have it sent directly from the browser to Anthropic. While the key is not persisted to localStorage (fixed in a prior audit), it is held in-memory in the Zustand store and transmitted in plaintext (over HTTPS) from the browser.

Any XSS vulnerability would allow extraction of the API key from the Zustand store while the user is on the page.

**Impact:** API key exposure via XSS or browser extensions.

**Recommended Fix:** This is an accepted architectural decision. Mitigations in place:
- API key not persisted to localStorage (verified in `useStore.ts:249`)
- Proxy service available as alternative
- CSP headers present

---

## MEDIUM FINDINGS

### M1. `dangerouslySetInnerHTML` in MarkdownText Component
**Severity:** MEDIUM
**Location:** `src/components/chat/MarkdownText.tsx:15`

```tsx
<span dangerouslySetInnerHTML={{ __html: rendered }} />
```

The `parseMarkdown` function escapes `<`, `>`, and `&` before processing (lines 21-24), which prevents most XSS. However, the custom regex-based markdown parser has edge cases:
- Nested patterns could produce unexpected HTML
- The regex `\*\*(.+?)\*\*` captures across characters that might include escaped HTML entities, potentially creating malformed HTML

The content comes from AI responses (Anthropic), not directly from user input, which reduces the risk. But if AI responses can be influenced via prompt injection in user messages, there is an indirect XSS vector.

**Recommended Fix:** Replace with a battle-tested library like `react-markdown` or `marked` with sanitization.

---

### M2. `user_settings` Table Stores Claude API Key in Plaintext
**Severity:** MEDIUM
**Location:** `supabase-schema.sql:42`, `src/services/sync.ts:1274`

```sql
claude_api_key text,
```

When users provide their own API key, it is synced to the cloud in the `user_settings` table as plaintext. While RLS ensures only the user can read their own settings, any database compromise or admin access would expose user API keys.

The sync code pushes it:
```typescript
claude_api_key: settings.claudeApiKey ?? null,
```

**Impact:** User API keys exposed in database backups, admin access, or SQL injection.

**Recommended Fix:**
1. Encrypt API keys client-side before syncing
2. Or store user API keys in Vault similar to admin keys

---

### M3. Console Logging of Sensitive Data in Production
**Severity:** MEDIUM
**Location:** Multiple files

- `admin/src/services/supabase.ts:48-65` -- Logs admin check results including user IDs
- `src/services/sync.ts` -- Has `syncDebug` gated behind `isDev`, but `console.error` calls are not gated
- `src/store/useStore.ts:91,103,175` -- Logs settings data in production
- `supabase/functions/anthropic-proxy/index.ts:75` -- Logs whether API key was found per user

The syncDebug function is properly DEV-gated, but `console.error` and `console.log` calls in production code can leak operational details to browser dev tools.

**Recommended Fix:** Gate all logging behind environment checks or use a logging library with level control.

---

### M4. No Rate Limiting on Authentication or API Proxy
**Severity:** MEDIUM
**Location:** Auth flow (`useAuthStore.ts`), proxy (`anthropic-proxy/index.ts`)

- No client-side rate limiting on sign-in attempts (brute force possible, depends on Supabase server-side limits)
- No rate limiting on the anthropic-proxy Edge Function (a user could make thousands of requests)
- No client-side debouncing on food analysis API calls beyond a 1-second sync debounce

Supabase provides some default rate limiting, but it may not be sufficient for the proxy endpoint.

**Recommended Fix:**
1. Add rate limiting to the Edge Function (e.g., per-user request count per hour)
2. Add client-side debouncing/throttling on API calls
3. Verify Supabase auth rate limits are configured

---

### M5. Edge Function Error Response Leaks Internal Details
**Severity:** MEDIUM
**Location:** `supabase/functions/anthropic-proxy/index.ts:138-148`

```typescript
return new Response(
  JSON.stringify({
    error: "Internal server error",
    details: error instanceof Error ? error.message : "Unknown error"
  }),
  ...
);
```

Error messages from internal exceptions are returned to the client. These could reveal stack traces, database connection errors, or internal configuration details.

**Recommended Fix:** Return generic error messages in production. Log details server-side only.

---

## LOW FINDINGS

### L1. Feature Flags Hardcode Beta User Email
**Severity:** LOW
**Location:** `src/lib/features.ts:4-6`

```typescript
const BETA_USERS = [
  'martin.holecko@gmail.com',
];
```

A hardcoded email address in client-side code. While not a direct security risk, it reveals a real email address in the JavaScript bundle.

**Recommended Fix:** Move beta user checking to the server side or use user IDs instead of emails.

---

### L2. No Subresource Integrity (SRI) on External Scripts
**Severity:** LOW
**Location:** `index.html`

The app loads `@vercel/analytics` which adds an external script. No SRI hashes are used.

**Recommended Fix:** Add SRI hashes where possible, or self-host analytics.

---

### L3. IndexedDB Data Not Encrypted
**Severity:** LOW (deferred from previous audit)
**Location:** `src/db/index.ts`

All local data (food entries, chat messages, images, settings) is stored unencrypted in IndexedDB. Physical access to the device or malicious browser extensions could read this data.

**Recommended Fix:** Implement client-side encryption using a library like `libsodium-wrappers`.

---

### L4. `clear-db.ts` Attempts Delete Without Authentication
**Severity:** LOW
**Location:** `clear-db.ts:24-35`

When not authenticated, the script attempts to delete all food_entries with a dummy `neq('id', '...')` filter. RLS should prevent any actual deletion, but the code pattern is concerning.

**Recommended Fix:** Require authentication before any delete operations.

---

### L5. CSP Allows `unsafe-inline` and `unsafe-eval`
**Severity:** LOW
**Location:** `vercel.json:15`, `index.html:15`

```
script-src 'self' 'unsafe-inline' 'unsafe-eval'
```

Both `unsafe-inline` and `unsafe-eval` weaken the CSP significantly. `unsafe-eval` in particular allows `eval()` and `new Function()`, which are common XSS exploitation primitives. These are likely required by Vite/React in development but should be tightened for production.

**Recommended Fix:**
1. Use nonce-based CSP for inline scripts
2. Remove `unsafe-eval` if possible (may require build configuration changes)

---

## Positive Security Practices Observed

- RLS is correctly enabled and enforced on all user data tables (food_entries, user_settings, chat_messages, daily_goals, sleep_entries, training_entries)
- All user data RLS policies correctly use `auth.uid() = user_id`
- API key excluded from localStorage persistence (verified in `useStore.ts:249`)
- Debug functions properly DEV-gated in `main.tsx`
- HTML escaping before markdown rendering in `MarkdownText.tsx`
- Session auto-refresh and proper auth state management
- Soft-delete pattern maintains audit trail
- HSTS, X-Frame-Options, X-Content-Type-Options headers configured in `vercel.json`
- Admin functions `admin_add_api_key` and `admin_revoke_api_key` properly check caller is admin

---

## Recommended Action Plan

### Immediate (Today -- Critical)
1. **Rotate the exposed Anthropic API key** via console.anthropic.com
2. **Fix `get_admin_api_key_for_user()`** -- add admin check or revoke execute from non-service roles
3. **Restrict `user_stats` view access** -- revoke from authenticated/anon roles
4. **Enable RLS on `admin_users`** table

### This Week (High)
5. Fix `api_usage` INSERT policy to restrict to service_role
6. Fix CORS wildcard on Edge Function
7. Revert to Vault-based API key storage (remove plaintext keys from `admin_api_keys`)
8. Replace hardcoded key in trigger with Vault reference

### Next Sprint (Medium)
9. Replace custom markdown parser with `react-markdown`
10. Encrypt user API keys in `user_settings` before cloud sync
11. Add rate limiting to Edge Function
12. Remove production console.log/error leaks
13. Sanitize Edge Function error responses

### Backlog (Low)
14. Remove hardcoded beta user email
15. Implement IndexedDB encryption
16. Tighten CSP (remove unsafe-eval)
17. Add SRI to external scripts
18. Fix clear-db.ts authentication flow

---

## Files Reviewed

| File | Issues Found |
|------|-------------|
| `supabase/migrations/20260130_admin_api_keys_simple.sql` | C1 (hardcoded key pattern), C2 (no auth check) |
| `supabase-schema.sql` | C3 (user_stats view), H2 (api_usage policy) |
| `supabase/functions/anthropic-proxy/index.ts` | H3 (CORS wildcard), M5 (error leaks) |
| `src/services/ai/client.ts` | H4 (dangerouslyAllowBrowser) |
| `src/services/ai/unified.ts` | H4 (dangerouslyAllowBrowser) |
| `src/components/chat/MarkdownText.tsx` | M1 (dangerouslySetInnerHTML) |
| `src/services/sync.ts` | M2 (plaintext API key sync), M3 (logging) |
| `src/store/useStore.ts` | M3 (production logging) |
| `src/lib/features.ts` | L1 (hardcoded email) |
| `src/db/index.ts` | L3 (no encryption) |
| `clear-db.ts` | L4 (unauthenticated delete) |
| `vercel.json` | L5 (weak CSP) |
| `index.html` | L5 (weak CSP) |
| `admin/src/services/supabase.ts` | M3 (logging admin checks) |
| Live DB: `pg_policies` | Verified all RLS policies |
| Live DB: `pg_proc` | C1 (key in source), C2 (no auth check) |
| Live DB: `pg_class` | H1 (admin_users RLS disabled) |
| Live DB: `information_schema.role_table_grants` | C3 (user_stats access) |

---

## Penetration Test Results

All critical and high findings were confirmed exploitable via the live Supabase REST API using only the public anon key (extracted from the client-side JavaScript bundle).

### Test 1: API Key Extraction (C2) -- EXPLOITED
**Attack:** Call `get_admin_api_key_for_user` RPC via REST API with anon key
```bash
curl -s "https://[project].supabase.co/rest/v1/rpc/get_admin_api_key_for_user" \
  -H "apikey: [ANON_KEY]" -H "Authorization: Bearer [ANON_KEY]" \
  -H "Content-Type: application/json" \
  -d '{"target_user_id": "[ANY_USER_UUID]"}'
```
**Result:** Full Anthropic API key returned in plaintext. NO authentication required -- only the public anon key needed.

### Test 2: User Enumeration (C3) -- EXPLOITED
**Attack:** Query `user_stats` view via REST API with anon key
```bash
curl -s "https://[project].supabase.co/rest/v1/user_stats?select=email,food_entries_count" \
  -H "apikey: [ANON_KEY]" -H "Authorization: Bearer [ANON_KEY]"
```
**Result:** All 4 users' email addresses, sign-up dates, activity counts, and admin key status returned. NO authentication required.

### Test 3: Admin User Enumeration (H1) -- EXPLOITED
**Attack:** Query `admin_users` table directly (RLS disabled)
```bash
curl -s "https://[project].supabase.co/rest/v1/admin_users?select=user_id" \
  -H "apikey: [ANON_KEY]" -H "Authorization: Bearer [ANON_KEY]"
```
**Result:** Admin user ID returned. NO authentication required.

### Test 4: API Usage Pollution (H2) -- EXPLOITED
**Attack:** INSERT fake api_usage records via REST API with anon key
```bash
curl -s -X POST "https://[project].supabase.co/rest/v1/api_usage" \
  -H "apikey: [ANON_KEY]" -H "Authorization: Bearer [ANON_KEY]" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "[VICTIM_UUID]", "request_type": "FAKE", "tokens_in": 99999}'
```
**Result:** HTTP 201 -- fake record inserted successfully for arbitrary user. Cleaned up after test.

### Test 5: User Data Tables (food_entries, user_settings, etc.) -- BLOCKED
**Attack:** Query food_entries, user_settings, chat_messages via anon key
**Result:** Empty array `[]` returned. RLS correctly blocks access when `auth.uid()` is null (anon). User data tables are properly protected.

### Test 6: has_admin_api_key Probe -- EXPLOITED
**Attack:** Call `has_admin_api_key` RPC for arbitrary users
**Result:** Returns `true`/`false` for any user UUID. Can be used to identify which users have API keys before extracting them.

### Attack Chain Summary
A complete attack can be performed by anyone with zero credentials:
1. View the app's JavaScript source to extract `VITE_SUPABASE_ANON_KEY` (public)
2. Query `user_stats` to get all user emails and UUIDs
3. Query `admin_users` to identify admin user IDs
4. Call `get_admin_api_key_for_user` with any user UUID to get the Anthropic API key
5. Use the extracted API key for unlimited Anthropic API access

**Total time to execute this attack chain: under 60 seconds.**

---

## Comparison with Previous Audit (Feb 5, 2026)

The previous audit (`SECURITY-AUDIT-2026-02-05.md`) identified and fixed several issues. This audit found:

| Previous Finding | Current Status |
|-----------------|----------------|
| API key in localStorage | Still fixed |
| Debug functions DEV-only | Still fixed |
| Hardcoded Supabase URL | Still fixed |
| CSP/security headers | Still in place |
| Hardcoded admin email | Still fixed |
| IndexedDB encryption | Still deferred (L3) |

**New findings not in previous audit:**
- C1: Hardcoded API key in database trigger (not visible in codebase review alone)
- C2: `get_admin_api_key_for_user` has no auth check (requires live DB inspection)
- C3: `user_stats` view access (requires live privilege inspection)
- H1: `admin_users` RLS disabled (requires live DB inspection)
- H2: `api_usage` INSERT policy too permissive
- H3: CORS wildcard on Edge Function
- M4: No rate limiting
- M5: Error detail leakage in Edge Function

These were missed in the previous audit likely because it focused on client-side code and migration files, not the actual live database state.
