-- =====================================================================
-- Durcissement complémentaire — d'après l'audit de PRODUCTION du 16/10/2026
-- À exécuter APRÈS 20261015120000_durcissement.sql. Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Table staff et journal d'audit : aucune écriture côté client.
--    Constat : anon/authenticated avaient INSERT/UPDATE/DELETE/TRUNCATE.
--    La RLS bloquait déjà INSERT/UPDATE/DELETE (aucune policy), mais
--    TRUNCATE ignore la RLS. Une seule couche de protection sur la table
--    qui donne les droits admin, c'est trop peu : on retire les privilèges.
--    Le trigger d'audit (SECURITY DEFINER) continue d'écrire normalement.
-- ---------------------------------------------------------------------
revoke insert, update, delete, truncate on public.staff, public.commandes_audit_log from anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. TRUNCATE ne passe jamais par la RLS : retiré sur toutes les tables.
-- ---------------------------------------------------------------------
revoke truncate on all tables in schema public from anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. commande_est_recevable() ne servait qu'à l'ancienne policy INSERT
--    client (supprimée par la migration précédente) : plus exposée.
-- ---------------------------------------------------------------------
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'commande_est_recevable'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. Policy récursive sur staff.
--    Constat : « staff_lecture_staff » interroge staff depuis une policy
--    de staff → « infinite recursion detected in policy for relation
--    staff » pour tout utilisateur connecté qui lit la table.
--    Remplacée par : chacun voit sa propre ligne, le staff voit tout
--    (is_staff() est SECURITY DEFINER, donc sans récursion).
-- ---------------------------------------------------------------------
drop policy if exists staff_lecture_staff on public.staff;
drop policy if exists staff_lecture_soi_ou_staff on public.staff;
create policy staff_lecture_soi_ou_staff on public.staff
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff());
