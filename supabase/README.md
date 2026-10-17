# Supabase — King Crêperie

Le schéma de production (tables, RLS, RPC, triggers) a été créé à la main
dans le SQL Editor. Ce dossier versionne **les changements à partir
d'octobre 2026** et les requêtes d'audit.

> 📌 Recommandé : récupérer le schéma existant pour qu'il soit versionné
> lui aussi — `npx supabase login && npx supabase link --project-ref <ref> && npx supabase db pull`.

## Ordre d'exécution (SQL Editor)

| # | Fichier | Effet |
|---|---|---|
| 1 | `sql/01_audit_en_une_requete.sql` | État des lieux (lecture seule), un seul tableau. |
| 2 | `migrations/20261015120000_durcissement.sql` | RPC sensibles réservés à `service_role`, plus d'INSERT client sur `commandes`/`commande_items`, annulation → stock restitué + verrou. |
| 3 | `migrations/20261016070000_durcissement_complementaire.sql` | Plus d'écriture client sur `staff` / `commandes_audit_log`, TRUNCATE retiré, policy récursive de `staff` corrigée. |
| 4 | `migrations/20261015120100_push_notifications.sql` | Table `push_subscriptions` + trigger `pg_net` vers `/api/push/dispatch`. Sans effet tant que l'étape 5 n'est pas faite. |
| 5 | `sql/configurer_secrets_push.sql` | URL + secret dans Vault (remplacer `<SECRET>` dans l'éditeur, **ne pas commiter**). |
| 6 | `sql/01_audit_en_une_requete.sql` | Rejouer et comparer. |
| 7 | `migrations/20261016150000_boutique_horaires.sql` | Horaires et pause des commandes (KC Staff → Boutique). Déjà en place si l’écran Boutique fonctionne ; la rejouer est sans effet. |
| 8 | `migrations/20261017200000_gestion_carte.sql` | **Gestion de la carte depuis KC Staff** : catégories `gaufre` et `autre`, ajout/suppression de produits réservés au staff, historique des commandes conservé à la suppression (`produit_id` → NULL), dépôt des photos dans le bucket `produits` (staff seulement, images ≤ 5 Mo). **À exécuter avant de déployer le code** qui l'utilise. |

### Constats de l'audit de production (16/10/2026)

- `creer_commande_complete` / `decrementer_stock_si_gere` : déjà réservées à `service_role` ✅
- **Policy `commandes_creation_v2` (INSERT, rôle public)** : n'importe quel visiteur pouvait créer une
  commande directement via l'API REST avec la clé publique, au total de son choix, sans passer par
  `/api/commandes` (ni prix serveur, ni rate limit). → corrigé par la migration 2.
- `staff` / `commandes_audit_log` : INSERT/UPDATE/DELETE/TRUNCATE accordés à anon et authenticated,
  bloqués seulement par la RLS (sauf TRUNCATE, qui l'ignore). → migration 3.
- Policy `staff_lecture_staff` récursive (« infinite recursion detected »). → migration 3.
- Realtime : `anon` n'a que SELECT sur `commande-%`, aucune policy d'écriture ✅

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
