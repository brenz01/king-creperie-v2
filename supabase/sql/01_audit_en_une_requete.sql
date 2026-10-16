-- King Crêperie — audit de sécurité Supabase (LECTURE SEULE, ne modifie rien)
-- Copier tout, coller dans le SQL Editor, cliquer sur Run.
with fonctions as (
  select '1. Fonction'::text as controle,
         p.proname || ' → ' || r.rolname as objet,
         case when has_function_privilege(r.rolname, p.oid, 'EXECUTE') then 'EXECUTE : OUI' else 'EXECUTE : non' end
           || case when p.prosecdef then ' · security definer' else '' end as detail
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join (values ('anon'), ('authenticated')) r(rolname)
  where n.nspname = 'public'
    and p.proname in ('creer_commande_complete', 'decrementer_stock_si_gere', 'commande_est_recevable',
                      'suivi_commande', 'is_staff')
),
droits as (
  select '2. Droits table',
         table_name || ' → ' || grantee,
         string_agg(privilege_type, ', ' order by privilege_type)
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee in ('anon', 'authenticated')
    and table_name in ('commandes', 'commande_items', 'commandes_audit_log', 'staff')
  group by table_name, grantee
),
policies as (
  select '3. Policy ' || schemaname,
         tablename || ' · ' || policyname,
         cmd || ' · rôles=' || array_to_string(roles, ',')
           || ' · using=' || coalesce(qual, '-')
           || ' · check=' || coalesce(with_check, '-')
  from pg_policies
  where schemaname in ('public', 'realtime')
)
select * from fonctions
union all select * from droits
union all select * from policies
order by 1, 2;
