-- =====================================================================
-- Configuration des secrets push dans Supabase Vault.
-- ⚠ NE PAS COMMITER avec les vraies valeurs : remplacer les deux
--   <...> directement dans le SQL Editor, exécuter, puis fermer.
--
-- <SECRET> = la même valeur que PUSH_WEBHOOK_SECRET sur Vercel
--            (≥ 32 caractères, ex. : openssl rand -hex 32).
-- =====================================================================

select vault.create_secret(
  'https://king-creperie-v2.vercel.app/api/push/dispatch',
  'push_dispatch_url',
  'Endpoint Vercel appelé par notifier_push_commande()'
);

select vault.create_secret(
  '<SECRET>',
  'push_dispatch_secret',
  'Secret partagé avec PUSH_WEBHOOK_SECRET (Vercel)'
);

-- Pour changer une valeur plus tard :
--   select vault.update_secret(id, 'nouvelle_valeur')
--   from vault.secrets where name = 'push_dispatch_secret';

-- Diagnostic des derniers appels (statut HTTP, erreurs) :
--   select id, status_code, error_msg, created
--   from net._http_response order by created desc limit 20;
