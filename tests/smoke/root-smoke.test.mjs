import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(repoRoot, file), 'utf8');
}

test('sync pull query includes image_data and maps it to imageData', () => {
  const syncSource = read('src/services/sync.ts');
  assert.match(syncSource, /\.select\('id,\s*user_id,\s*sync_id,\s*date,\s*source,\s*food_name,\s*protein,\s*calories,\s*confidence,\s*image_data,\s*created_at,\s*updated_at,\s*deleted_at'\)/);
  assert.match(syncSource, /imageData:\s*dbEntry\.image_data\s*\?\?\s*undefined/);
});

test('settings sync keeps claudeApiKey local-only', () => {
  const syncSource = read('src/services/sync.ts');
  assert.match(syncSource, /claudeApiKey:\s*localSettings\?\.claudeApiKey/);
  assert.doesNotMatch(syncSource, /claude_api_key\s*:/);
  assert.match(syncSource, /claudeApiKey:\s*undefined/);
});

test('proxy exposes explicit validation/rate-limit error codes', () => {
  const proxySource = read('supabase/functions/anthropic-proxy/index.ts');
  assert.match(proxySource, /INVALID_REQUEST/);
  assert.match(proxySource, /MODEL_NOT_ALLOWED/);
  assert.match(proxySource, /PAYLOAD_TOO_LARGE/);
  assert.match(proxySource, /RATE_LIMITED/);
});
