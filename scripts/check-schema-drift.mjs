import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const schemaPath = path.join(repoRoot, 'supabase-schema.sql');
const securityMigrationPath = path.join(
  repoRoot,
  'supabase',
  'migrations',
  '20260208_security_fixes.sql'
);

const normalize = (sql) => sql.replace(/\s+/g, ' ').trim().toLowerCase();

const schemaRaw = fs.readFileSync(schemaPath, 'utf8');
const migrationRaw = fs.readFileSync(securityMigrationPath, 'utf8');
const schema = normalize(schemaRaw);
const migration = normalize(migrationRaw);

const failures = [];

const requiredFragments = [
  {
    name: 'get_admin_api_key_for_user revoke/grant',
    fragments: [
      'revoke execute on function get_admin_api_key_for_user(uuid) from public;',
      'revoke execute on function get_admin_api_key_for_user(uuid) from anon;',
      'revoke execute on function get_admin_api_key_for_user(uuid) from authenticated;',
      'grant execute on function get_admin_api_key_for_user(uuid) to service_role;',
    ],
  },
  {
    name: 'user_stats restricted to service_role',
    fragments: [
      'revoke all on user_stats from public;',
      'revoke all on user_stats from anon;',
      'revoke all on user_stats from authenticated;',
      'grant select on user_stats to service_role;',
    ],
  },
  {
    name: 'api_usage insert policy restricted to service_role',
    fragments: [
      'create policy "service role can insert api_usage" on api_usage for insert to service_role with check (true);',
    ],
  },
];

for (const check of requiredFragments) {
  for (const fragment of check.fragments) {
    const normalizedFragment = normalize(fragment);
    if (!migration.includes(normalizedFragment)) {
      failures.push(
        `${check.name}: expected fragment missing in migration: ${fragment}`
      );
    }
    if (!schema.includes(normalizedFragment)) {
      failures.push(
        `${check.name}: expected fragment missing in schema snapshot: ${fragment}`
      );
    }
  }
}

if (!/create\s+or\s+replace\s+function\s+has_admin_api_key\s*\(/i.test(schemaRaw)) {
  failures.push('has_admin_api_key function missing in schema snapshot');
} else {
  if (!/if\s+auth\.uid\(\)\s+is\s+null\s+then/i.test(schemaRaw)) {
    failures.push('has_admin_api_key auth guard missing: unauthenticated guard');
  }
  if (!/auth\.uid\(\)\s*!=\s*target_user_id/i.test(schemaRaw)) {
    failures.push('has_admin_api_key auth guard missing: self/admin access check');
  }
}

if (/grant\s+select\s+on\s+user_stats\s+to\s+authenticated\s*;/i.test(schemaRaw)) {
  failures.push('Insecure grant detected: user_stats granted to authenticated');
}

if (/create\s+policy\s+"Service role can insert api_usage"\s+on\s+api_usage\s+for\s+insert\s+with\s+check\s*\(true\)/i.test(schemaRaw)) {
  failures.push('Insecure api_usage insert policy detected: missing TO service_role');
}

if (failures.length > 0) {
  console.error('Schema drift check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Schema drift check passed.');
