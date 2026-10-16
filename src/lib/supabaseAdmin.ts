import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Client service_role — bypass RLS. Importable uniquement côté serveur
// (le paquet `server-only` fait échouer le build s'il fuit côté client).
// Instancié paresseusement : l'absence de la clé ne casse plus le build,
// seulement les routes qui en ont réellement besoin.
let instance: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (instance) return instance;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquantes');
  }
  instance = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return instance;
}
