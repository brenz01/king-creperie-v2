// Où le serveur s'exécute-t-il ? Les aperçus Vercel (Preview) partagent
// la base Supabase de production : ils ne doivent jamais obtenir le
// client service_role (qui contourne la RLS), même si la clé y est remise
// par erreur. Production (VERCEL_ENV=production), local et CI
// (VERCEL_ENV absent) : inchangés.
export function clientAdminAutorise(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL_ENV !== 'preview';
}
