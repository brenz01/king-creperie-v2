// Build de production pointant vers le faux Supabase (multiplateforme :
// pas de syntaxe VAR=valeur propre à un shell).
import { spawnSync } from 'node:child_process';

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'e2e-anon',
  SUPABASE_SERVICE_ROLE_KEY: 'e2e-service',
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3100',
  NEXT_PUBLIC_WHATSAPP_NUMBER: '221770000000',
  NEXT_TELEMETRY_DISABLED: '1',
};
const r = spawnSync('pnpm', ['build'], { stdio: 'inherit', env, shell: process.platform === 'win32' });
process.exit(r.status ?? 1);
