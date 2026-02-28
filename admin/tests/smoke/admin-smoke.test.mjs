import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const adminRoot = path.resolve(__dirname, '..', '..');

const supabaseServicePath = path.join(adminRoot, 'src', 'services', 'supabase.ts');

test('admin service reads user stats via RPC functions', () => {
  const source = fs.readFileSync(supabaseServicePath, 'utf8');
  assert.match(source, /rpc\('admin_get_user_stats'\)/);
  assert.match(source, /rpc\('admin_get_user_by_id'/);
});

test('admin service can query api_usage for dashboards', () => {
  const source = fs.readFileSync(supabaseServicePath, 'utf8');
  assert.match(source, /\.from\('api_usage'\)/);
});
