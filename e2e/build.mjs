// Build de production pointant vers le faux Supabase (multiplateforme :
// pas de syntaxe VAR=valeur propre à un shell).
//
// Le faux Supabase tourne PENDANT le build : la page d'accueil est générée
// côté serveur (ISR) et son HTML initial doit contenir le faux catalogue.
// Sans lui, chargerProduits() échouait (« fetch failed ») et l'accueil
// partait sans carte ; les tests ne passaient que grâce au rechargement
// côté navigateur.
//
// Il est arrêté après le build, en succès comme en échec, pour rendre le
// port au webServer de Playwright. S'il tournait déjà (lancé à la main),
// il est réutilisé et laissé tel quel.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 54321;
const MOCK = `http://127.0.0.1:${PORT}`;
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DELAI_DEMARRAGE_MS = 15_000;

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: MOCK,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'e2e-anon',
  SUPABASE_SERVICE_ROLE_KEY: 'e2e-service',
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3100',
  NEXT_PUBLIC_WHATSAPP_NUMBER: '221770000000',
  // Clé publique VAPID de test (sans clé privée : aucun envoi réel) : le
  // bouton d'alertes s'affiche, comme en production.
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'BLap0El2qMAJ2oBZZWMB5HVuHTn-RvwVL2aSSG57qOcKHMUC4v-OfETXgm9AEotArc54ZV46O3bA20GcoqlIKTo',
  NEXT_TELEMETRY_DISABLED: '1',
};

const log = (m) => console.log(`[e2e/build] ${m}`);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// Réponse valide = /__log du faux Supabase (pas n'importe quel serveur).
async function repond() {
  try {
    const r = await fetch(`${MOCK}/__log`, { signal: AbortSignal.timeout(1000) });
    if (!r.ok) return false;
    const corps = await r.json();
    return Array.isArray(corps?.rpcLog) && Array.isArray(corps?.commandes);
  } catch {
    return false;
  }
}

async function demarrerMock() {
  if (await repond()) {
    log(`faux Supabase déjà actif sur :${PORT}, réutilisé (il ne sera pas arrêté).`);
    return null;
  }
  const mock = spawn(process.execPath, [path.join(RACINE, 'e2e', 'mock-supabase.mjs')], {
    cwd: RACINE,
    env: { ...process.env, MOCK_PORT: String(PORT) },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  let sortie = null;
  mock.once('exit', (code) => (sortie = code));
  mock.once('error', (e) => (sortie = e.message));

  const limite = Date.now() + DELAI_DEMARRAGE_MS;
  while (Date.now() < limite) {
    if (sortie !== null) throw new Error(`le faux Supabase s'est arrêté au démarrage (${sortie}) ; port ${PORT} occupé ?`);
    if (await repond()) return mock;
    await pause(200);
  }
  await arreter(mock);
  throw new Error(`le faux Supabase ne répond pas sur ${MOCK}/__log après ${DELAI_DEMARRAGE_MS / 1000} s`);
}

// Attend la fin réelle du processus : le port est libre quand on rend la main.
function arreter(mock) {
  if (!mock || mock.exitCode !== null || mock.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const garde = setTimeout(() => {
      mock.kill('SIGKILL');
      resolve();
    }, 5000);
    mock.once('exit', () => {
      clearTimeout(garde);
      resolve();
    });
    mock.kill();
  });
}

function construire() {
  return new Promise((resolve) => {
    // Commande en une seule chaîne : shell requis pour pnpm.cmd sous Windows,
    // sans tableau d'arguments (évite l'avertissement Node DEP0190).
    const build = spawn('pnpm build', { cwd: RACINE, env, stdio: 'inherit', shell: true });
    build.once('error', (e) => {
      console.error(e);
      resolve(1);
    });
    build.once('exit', (code) => resolve(code ?? 1));
  });
}

let mock = null;
const interrompre = () => void arreter(mock).finally(() => process.exit(130));
process.once('SIGINT', interrompre);
process.once('SIGTERM', interrompre);

let code = 1;
try {
  mock = await demarrerMock();
  log(`faux Supabase prêt (${MOCK}/__log), build en cours.`);
  code = await construire();
} catch (e) {
  console.error(`[e2e/build] ${e.message}`);
} finally {
  await arreter(mock);
  if (mock) log('faux Supabase arrêté.');
}
process.exit(code);
