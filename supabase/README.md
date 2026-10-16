# Supabase — King Crêperie

Le schéma de production (tables, RLS, RPC, triggers) a été créé à la main
dans le SQL Editor. Ce dossier versionne **les changements à partir
d'octobre 2026** et les requêtes d'audit.

> 📌 Recommandé : récupérer le schéma existant pour qu'il soit versionné
> lui aussi — `npx supabase login && npx supabase link --project-ref <ref> && npx supabase db pull`.

## Ordre d'exécution (SQL Editor)

| # | Fichier | Effet |
|---|---|---|
| 1 | `sql/00_audit_lecture_seule.sql` | État des lieux (lecture seule). Garder le résultat. |
| 2 | `migrations/20261015120000_durcissement.sql` | RPC sensibles réservés à `service_role`, plus d'INSERT client sur `commandes`/`commande_items`, annulation → stock restitué + verrou. |
| 3 | `migrations/20261015120100_push_notifications.sql` | Table `push_subscriptions` + trigger `pg_net` vers `/api/push/dispatch`. Sans effet tant que l'étape 4 n'est pas faite. |
| 4 | `sql/configurer_secrets_push.sql` | URL + secret dans Vault (remplacer `<SECRET>` dans l'éditeur, **ne pas commiter**). |
| 5 | `sql/00_audit_lecture_seule.sql` | Rejouer et comparer. |

Les migrations sont idempotentes et ont été testées sur PostgreSQL 16
contre une reproduction du schéma (13 scénarios : RPC/INSERT anonymes
refusés, policies staff conservées, restitution de stock, verrou
d'annulation, push déclenché, panne `pg_net` sans impact sur la commande).

## Réglages Auth à faire dans le dashboard (non scriptables)

- **Authentication → Sign In / Providers → Email** : désactiver *Allow new users to sign up*.
- **CAPTCHA (Authentication → Attack Protection) : NE PAS l'activer seul.**
  Une fois activé, Supabase refuse toute connexion sans jeton CAPTCHA :
  la page /admin/login doit d'abord intégrer le widget Turnstile et
  transmettre `captchaToken` (évolution de code à faire avant).
  En attendant, garder un mot de passe admin long et unique.
- **MFA** : activer TOTP pour le compte staff, puis exiger `aal2` dans `is_staff()` :
  ```sql
  -- dans is_staff() : ... and (auth.jwt() ->> 'aal') = 'aal2'
  ```
  ⚠ À faire seulement après avoir ajouté l'écran de saisie du code TOTP au login.

## Realtime

Vérifier (requête 5 de l'audit) que `anon` n'a **que** `SELECT` sur
`realtime.messages` pour les topics `commande-%`, jamais `INSERT`.
