-- =====================================================================
-- Durcissement post-audit (octobre 2026)
-- Idempotent : peut être rejoué sans effet de bord.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Fonctions SECURITY DEFINER sensibles : service_role uniquement.
--    Par défaut, PostgreSQL accorde EXECUTE à PUBLIC : sans ce revoke,
--    n'importe qui peut appeler /rest/v1/rpc/creer_commande_complete
--    avec la clé publique et fixer lui-même p_total.
-- ---------------------------------------------------------------------
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('creer_commande_complete', 'decrementer_stock_si_gere')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
    raise notice 'EXECUTE restreint à service_role : %', f;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2. Plus aucune écriture directe sur les commandes depuis le client.
--    Toute création passe par /api/commandes (service_role) → RPC.
--    Le staff ne fait que des UPDATE de statut (rôle authenticated),
--    donc seul l'INSERT/DELETE est retiré à authenticated.
--    Le contrôle de privilège a lieu AVANT la RLS : même une ancienne
--    policy INSERT permissive devient inopérante.
-- ---------------------------------------------------------------------
revoke insert, update, delete on public.commandes, public.commande_items from anon;
revoke insert, delete on public.commandes, public.commande_items from authenticated;

-- Nettoyage des policies INSERT anonymes devenues mortes (lisibilité).
-- Ne touche pas aux policies FOR ALL ni à celles réservées au staff.
do $$
declare r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('commandes', 'commande_items')
      and cmd = 'INSERT'
      and roles && array['anon', 'public']::name[]
      and coalesce(with_check, '') not ilike '%is_staff%'
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
    raise notice 'Policy INSERT anonyme supprimée : %.%', r.tablename, r.policyname;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3. Cycle de vie d'une annulation.
--    a) Une commande annulée ne peut plus être réactivée (sinon le stock
--       restitué ci-dessous serait compté deux fois).
--    b) Annulation avant le départ en livraison → stock restitué.
--       (Après le départ, les crêpes sont faites : pas de restitution.)
-- ---------------------------------------------------------------------
create or replace function public.verrouiller_commande_annulee()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.statut = 'annulee' and new.statut is distinct from 'annulee' then
    raise exception 'Une commande annulée ne peut pas être réactivée : créez une nouvelle commande.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_verrouiller_commande_annulee on public.commandes;
create trigger trg_verrouiller_commande_annulee
  before update of statut on public.commandes
  for each row execute function public.verrouiller_commande_annulee();

create or replace function public.restaurer_stock_annulation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.statut = 'annulee'
     and old.statut in ('recue', 'en_preparation') then
    update public.produits p
       set stock_quantite = p.stock_quantite + agg.qte,
           -- Réactive un produit que l'épuisement avait désactivé.
           disponible = case when p.stock_quantite = 0 then true else p.disponible end
      from (
        select produit_id, sum(quantite)::int as qte
        from public.commande_items
        where commande_id = new.id
        group by produit_id
      ) agg
     where p.id = agg.produit_id
       and p.stock_gere
       and p.stock_quantite is not null;
  end if;
  return null;
end;
$$;

revoke execute on function public.restaurer_stock_annulation() from public, anon, authenticated;
revoke execute on function public.verrouiller_commande_annulee() from public, anon, authenticated;

drop trigger if exists trg_restaurer_stock_annulation on public.commandes;
create trigger trg_restaurer_stock_annulation
  after update of statut on public.commandes
  for each row execute function public.restaurer_stock_annulation();
