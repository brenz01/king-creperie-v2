-- =====================================================================
-- King Crêperie — Audit de sécurité Supabase (LECTURE SEULE)
-- À exécuter dans le SQL Editor AVANT les migrations, puis APRÈS pour
-- comparer. Aucune de ces requêtes ne modifie quoi que ce soit.
-- =====================================================================

-- 1. Qui peut exécuter les fonctions sensibles ?
--    Attendu après migration : exec = false pour anon/authenticated sur
--    creer_commande_complete et decrementer_stock_si_gere.
select p.proname as fonction,
       r.rolname as role,
       has_function_privilege(r.rolname, p.oid, 'EXECUTE') as exec,
       p.prosecdef as security_definer,
       p.proconfig as config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join (values ('anon'), ('authenticated')) r(rolname)
where n.nspname = 'public'
  and p.proname in ('creer_commande_complete', 'decrementer_stock_si_gere', 'commande_est_recevable',
                    'suivi_commande', 'is_staff', 'notifier_push_commande', 'restaurer_stock_annulation')
order by 1, 2;

-- 2. Privilèges de table pour anon / authenticated.
--    Attendu : aucun INSERT/UPDATE/DELETE anon sur commandes, commande_items.
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
  and table_name in ('commandes', 'commande_items', 'produits', 'extras', 'staff',
                     'commandes_audit_log', 'push_subscriptions')
group by 1, 2
order by 1, 2;

-- 3. Toutes les policies RLS (public + realtime).
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname in ('public', 'realtime')
order by schemaname, tablename, cmd;

-- 4. RLS activée partout ?
select relname as table_name, relrowsecurity as rls_active, relforcerowsecurity as rls_forcee
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;

-- 5. Realtime : sur realtime.messages, anon ne doit avoir que SELECT
--    sur les topics 'commande-%' — jamais INSERT (sinon n'importe qui
--    connaissant un UUID pourrait diffuser un faux statut).
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'realtime' and tablename = 'messages';

-- 6. Triggers sur commandes (audit, broadcast, push, stock).
select tgname, pg_get_triggerdef(t.oid) as definition
from pg_trigger t
where tgrelid = 'public.commandes'::regclass and not tgisinternal
order by 1;
