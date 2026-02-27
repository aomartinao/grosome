---
name: setup-env
description: Set up or repair the .env file with Supabase credentials. Use when the user asks to create, fix, or verify the .env file, or when .env is missing or broken.
disable-model-invocation: true
---

# Setup .env for Grosome

Set up the `.env` file with Supabase credentials for local development and database access.

## Required Variables

| Variable | Source | Purpose |
|----------|--------|---------|
| `VITE_SUPABASE_URL` | Supabase Dashboard → Data API | App frontend (Vite) |
| `VITE_SUPABASE_ANON_KEY` | Supabase Dashboard → API Keys → Legacy | App frontend (Vite) |
| `SUPABASE_SECRET_KEY` | Supabase Dashboard → API Keys → Legacy → service_role (Reveal) | Server-side / admin |
| `DATABASE_PASSWORD` | User must provide (or reset in Supabase Dashboard → Database Settings) | Direct psql access |

## Steps

### 1. Check current state

```bash
# Check if .env exists and is a real file (not a broken symlink)
test -f .env && echo "EXISTS" || echo "MISSING"
ls -la .env 2>/dev/null
```

If it's a circular symlink or broken, delete it first: `rm .env`

### 2. Check if variables are already set

```bash
grep -o '^[A-Z_]*=' .env
```

### 3. Get missing values from Supabase Dashboard

- **Project ID**: `paifkqqqwhtqhyxgibvl`
- **VITE_SUPABASE_URL**: `https://paifkqqqwhtqhyxgibvl.supabase.co`
- **VITE_SUPABASE_ANON_KEY**: Navigate to Supabase Dashboard → Settings → API Keys → Legacy tab → copy the `anon` `public` key
- **SUPABASE_SECRET_KEY**: Same page → click "Reveal" on `service_role` `secret` key → copy
- **DATABASE_PASSWORD**: Cannot be retrieved from dashboard — only reset. Ask the user.

Use Chrome DevTools MCP to navigate to:
- API Keys: `https://supabase.com/dashboard/project/paifkqqqwhtqhyxgibvl/settings/api-keys/legacy`
- DB Settings: `https://supabase.com/dashboard/project/paifkqqqwhtqhyxgibvl/database/settings`

### 4. Write the .env file

Write all 4 variables. Use `cat > .env << 'EOF'` to avoid shell expansion issues.

### 5. Verify

```bash
# Check all vars present
grep -c '=' .env  # Should be 4

# Test database connection
source .env && psql "postgresql://postgres.paifkqqqwhtqhyxgibvl:${DATABASE_PASSWORD}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres" -c "SELECT 1"
```

### 6. Verify .gitignore

Ensure `.env` is in `.gitignore` to prevent accidental commits:

```bash
grep -q '^\.env$' .gitignore && echo "OK" || echo "WARNING: .env not in .gitignore!"
```

## Security Rules

- **NEVER** read or display `.env` contents after writing
- **NEVER** echo/print credential values
- Use `grep -o '^[A-Z_]*='` to verify variable names without showing values
- Use `source .env && psql "...${DATABASE_PASSWORD}..."` pattern for DB access
