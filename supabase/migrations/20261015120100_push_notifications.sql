-- =====================================================================
-- Notifications push (PWA)
-- Base → pg_net → POST /api/push/dispatch (Vercel) → web-push → téléphone
--
-- Prérequis : exécuter ensuite supabase/sql/configurer_secrets_push.sql
-- (URL + secret partagé dans Vault). Tant que les secrets n'existent
-- pas, le trigger ne fait rien : la migration est sans risque.
-- =====================================================================

create extension if not exists pg_net with schema extensions;

create table if not exists public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  endpoint      text not null,
  p256dh        text not null,
  auth          text not null,
  commande_id   uuid references public.commandes(id) on delete cascade,
  staff_user_id uuid references auth.users(id) on delete cascade,
  user_agent    text,
  created_at    timestamptz not null default now(),
  -- Exactement une cible : une commande OU un membre du staff.
  constraint push_subscriptions_une_cible check ((commande_id is null) <> (staff_user_id is null))
);

create unique index if not exists push_subscriptions_endpoint_commande_uq
  on public.push_subscriptions (endpoint, commande_id) where commande_id is not null;
create unique index if not exists push_subscriptions_endpoint_staff_uq
  on public.push_subscriptions (endpoint, staff_user_id) where staff_user_id is not null;
create index if not exists push_subscriptions_commande_idx on public.push_subscriptions (commande_id);

-- RLS activée SANS aucune policy : seule la service_role (API Next)
-- peut lire/écrire. Les endpoints push sont des secrets.
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant all on public.push_subscriptions to service_role;

create or replace function public.notifier_push_commande()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url    text;
  v_secret text;
begin
  if tg_op = 'UPDATE' and new.statut is not distinct from old.statut then
    return null;
  end if;

  select decrypted_secret into v_url    from vault.decrypted_secrets where name = 'push_dispatch_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_dispatch_secret';
  if v_url is null or v_secret is null then
    return null; -- push pas encore configuré
  end if;

  -- Asynchrone : pg_net met la requête en file et l'envoie APRÈS le
  -- commit (rien n'est envoyé si la transaction de commande échoue).
  perform net.http_post(
    url                  := v_url,
    body                 := jsonb_build_object(
                              'type', tg_op,
                              'commande_id', new.id,
                              'statut', new.statut,
                              'total', new.total),
    headers              := jsonb_build_object(
                              'Content-Type', 'application/json',
                              'Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 5000
  );
  return null;
exception when others then
  -- Une notification ne doit JAMAIS faire échouer une commande.
  raise warning 'notifier_push_commande : %', sqlerrm;
  return null;
end;
$$;

revoke execute on function public.notifier_push_commande() from public, anon, authenticated;

drop trigger if exists trg_notifier_push_insert on public.commandes;
create trigger trg_notifier_push_insert
  after insert on public.commandes
  for each row execute function public.notifier_push_commande();

drop trigger if exists trg_notifier_push_update on public.commandes;
create trigger trg_notifier_push_update
  after update of statut on public.commandes
  for each row execute function public.notifier_push_commande();
