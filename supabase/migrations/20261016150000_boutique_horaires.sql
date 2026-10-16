-- =====================================================================
-- Horaires d'ouverture et pause des commandes, réglables depuis KC Staff.
-- Idempotent. Une seule ligne (id = 1).
--
-- horaires : { "0": [{"ouvre":"17:00","ferme":"23:30"}], ..., "6": [] }
--   clé = jour (0 = dimanche … 6 = samedi, heure de Dakar = UTC)
--   tableau vide = fermé ce jour-là ; ferme < ouvre = après minuit.
-- Par défaut : ouvert tous les jours, toute la journée (aucun changement
-- de comportement tant que le gérant n'a pas saisi ses horaires).
-- =====================================================================

create table if not exists public.boutique (
  id smallint primary key default 1 check (id = 1),
  horaires jsonb not null,
  fermeture_exceptionnelle boolean not null default false,
  message_fermeture text check (message_fermeture is null or char_length(message_fermeture) <= 160),
  updated_at timestamptz not null default now(),
  constraint boutique_horaires_objet check (jsonb_typeof(horaires) = 'object')
);

insert into public.boutique (id, horaires)
values (
  1,
  '{"0":[{"ouvre":"00:00","ferme":"24:00"}],"1":[{"ouvre":"00:00","ferme":"24:00"}],"2":[{"ouvre":"00:00","ferme":"24:00"}],"3":[{"ouvre":"00:00","ferme":"24:00"}],"4":[{"ouvre":"00:00","ferme":"24:00"}],"5":[{"ouvre":"00:00","ferme":"24:00"}],"6":[{"ouvre":"00:00","ferme":"24:00"}]}'::jsonb
)
on conflict (id) do nothing;

create or replace function public.boutique_maj_horodatage()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_boutique_maj on public.boutique;
create trigger trg_boutique_maj
  before update on public.boutique
  for each row execute function public.boutique_maj_horodatage();

-- RLS : lecture publique (la carte affiche « fermé »), modification
-- réservée au staff. Aucune création ni suppression côté client.
alter table public.boutique enable row level security;

drop policy if exists boutique_lecture on public.boutique;
create policy boutique_lecture on public.boutique
  for select to anon, authenticated
  using (true);

drop policy if exists boutique_modif_staff on public.boutique;
create policy boutique_modif_staff on public.boutique
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

revoke all on public.boutique from anon, authenticated;
grant select on public.boutique to anon, authenticated;
grant update (horaires, fermeture_exceptionnelle, message_fermeture) on public.boutique to authenticated;
grant all on public.boutique to service_role;
