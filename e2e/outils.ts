import type { Page } from '@playwright/test';

// Pilotage du faux Supabase (e2e/mock-supabase.mjs).
export const MOCK = 'http://127.0.0.1:54321';

const poster = async (chemin: string, corps?: unknown) => {
  const r = await fetch(MOCK + chemin, { method: 'POST', body: corps === undefined ? undefined : JSON.stringify(corps) });
  if (!r.ok) throw new Error(`${chemin} → ${r.status}`);
  return r.json();
};

export const reinitialiser = () => poster('/__reset');
export const changerStatut = (id: string, statut: string) => poster(`/__statut/${id}/${statut}`);
export const reglerBoutique = (b: Record<string, unknown>) => poster('/__boutique', b);
export const journal = async (): Promise<{
  rpcLog: Array<{ p_total: number; p_adresse_livraison: string }>;
  commandes: Array<{ id: string }>;
}> => (await fetch(MOCK + '/__log')).json();

export const tousLesJours = (plages: Array<{ ouvre: string; ferme: string }>) =>
  Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((j) => [String(j), plages]));

/** Horaires où la boutique est fermée maintenant et ouvre dans 2 h (heure de Dakar = UTC). */
export function horairesFermesMaintenant() {
  const h = new Date().getUTCHours();
  const hh = (x: number) => `${String(x % 24).padStart(2, '0')}:00`;
  return tousLesJours([{ ouvre: hh(h + 2), ferme: hh(h + 5) }]);
}

// Session staff factice : supabase-js la lit dans localStorage sans
// appel réseau tant qu'elle n'a pas expiré.
export async function connecterStaff(page: Page) {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u1', role: 'authenticated', exp, email: 'staff@exemple.sn' })}.sig`;
  const session = {
    access_token: jwt,
    refresh_token: 'r',
    expires_at: exp,
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: 'u1',
      email: 'staff@exemple.sn',
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-01-01T00:00:00Z',
    },
  };
  await page.goto('/admin/login');
  await page.evaluate((s) => localStorage.setItem('sb-127-auth-token', s), JSON.stringify(session));
}
