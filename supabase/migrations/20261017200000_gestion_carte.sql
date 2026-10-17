-- =====================================================================
-- Gestion de la carte depuis KC Staff : ajouter, modifier, supprimer un
-- produit (nom, photo, prix, catégorie, description, disponibilité).
-- Idempotent : peut être rejoué sans effet de bord.
--
-- 1. Catégories : ajoute « gaufre » et « autre » à salee/sucree/boisson,
--    que la colonne soit un enum, un texte contraint par CHECK ou libre.
-- 2. produits : ajout et suppression réservés au staff (RLS), id auto.
-- 3. Historique : supprimer un produit ne supprime ni ne bloque les
--    commandes passées (commande_items garde nom et prix ; produit_id
--    passe à NULL).
-- 4. Photos : le staff peut déposer, remplacer et supprimer des fichiers
--    dans le bucket public « produits » (images, 5 Mo max).
-- =====================================================================

-- 1. Catégories -------------------------------------------------------
do $$
declare
  t oid;
  c record;
begin
  select atttypid into t
    from pg_attribute
   where attrelid = 'public.produits'::regclass and attname = 'categorie' and not attisdropped;

  if exists (select 1 from pg_type where oid = t and typtype = 'e') then
    execute format('alter type %s add value if not exists %L', t::regtype, 'gaufre');
    execute format('alter type %s add value if not exists %L', t::regtype, 'autre');
  else
    for c in
      select conname
        from pg_constraint
       where conrelid = 'public.produits'::regclass
         and contype = 'c'
         and pg_get_constraintdef(oid) ilike '%categorie%'
    loop
      execute format('alter table public.produits drop constraint %I', c.conname);
    end loop;
    alter table public.produits
      add constraint produits_categorie_valide
      check (categorie in ('salee', 'sucree', 'gaufre', 'boisson', 'autre'));
  end if;
end;
$$;

-- 2. Produits : identifiant automatique, garde-fous, droits du staff ---
do $$
begin
  if (select column_default from information_schema.columns
       where table_schema = 'public' and table_name = 'produits' and column_name = 'id') is null then
    alter table public.produits alter column id set default gen_random_uuid();
  end if;
  -- NOT VALID : vérifié pour toute nouvelle ligne ou modification, sans
  -- bloquer la migration si une ligne ancienne ne le respectait pas.
  if not exists (select 1 from pg_constraint where conrelid = 'public.produits'::regclass and conname = 'produits_prix_positif') then
    alter table public.produits add constraint produits_prix_positif check (prix > 0 and prix <= 1000000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.produits'::regclass and conname = 'produits_nom_valide') then
    alter table public.produits add constraint produits_nom_valide
      check (char_length(btrim(nom)) between 2 and 80) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.produits'::regclass and conname = 'produits_description_courte') then
    alter table public.produits add constraint produits_description_courte
      check (description is null or char_length(description) <= 300) not valid;
  end if;
end;
$$;

alter table public.produits enable row level security;

drop policy if exists produits_ajout_staff on public.produits;
create policy produits_ajout_staff on public.produits
  for insert to authenticated
  with check (public.is_staff());

drop policy if exists produits_modif_staff on public.produits;
create policy produits_modif_staff on public.produits
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists produits_suppression_staff on public.produits;
create policy produits_suppression_staff on public.produits
  for delete to authenticated
  using (public.is_staff());

grant insert, update, delete on public.produits to authenticated;

-- 3. Historique des commandes conservé -------------------------------
do $$
declare
  c record;
begin
  for c in
    select conname
      from pg_constraint
     where conrelid = 'public.commande_items'::regclass
       and contype = 'f'
       and confrelid = 'public.produits'::regclass
       and confdeltype <> 'n'  -- n = ON DELETE SET NULL
  loop
    execute format('alter table public.commande_items drop constraint %I', c.conname);
  end loop;

  alter table public.commande_items alter column produit_id drop not null;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.commande_items'::regclass and contype = 'f'
       and confrelid = 'public.produits'::regclass
  ) then
    alter table public.commande_items
      add constraint commande_items_produit_id_fkey
      foreign key (produit_id) references public.produits (id) on delete set null;
  end if;
end;
$$;

-- 4. Photos (Supabase Storage, bucket public « produits ») -------------
insert into storage.buckets (id, name, public)
values ('produits', 'produits', true)
on conflict (id) do nothing;

update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png']
 where id = 'produits';

drop policy if exists produits_photos_ajout_staff on storage.objects;
create policy produits_photos_ajout_staff on storage.objects
  for insert to authenticated
  with check (bucket_id = 'produits' and public.is_staff());

drop policy if exists produits_photos_modif_staff on storage.objects;
create policy produits_photos_modif_staff on storage.objects
  for update to authenticated
  using (bucket_id = 'produits' and public.is_staff())
  with check (bucket_id = 'produits' and public.is_staff());

drop policy if exists produits_photos_suppression_staff on storage.objects;
create policy produits_photos_suppression_staff on storage.objects
  for delete to authenticated
  using (bucket_id = 'produits' and public.is_staff());
