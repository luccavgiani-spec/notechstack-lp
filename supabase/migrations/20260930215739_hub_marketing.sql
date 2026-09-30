-- Hub de marketing da nó (movimento hub-marketing-agentes, spec rev. 3.1).
-- Planner /no/marketing → Edge Function marketing-hub (service role) → Meta/Google.
-- Nenhuma tabela deste movimento é lida pelo frontend: só a função, com service role.

-- 1 · Risco E4: anon/authenticated sem privilégio nenhum nas tabelas Meta de abril.
-- Revogar na tabela também revoga as grants por coluna de ad_accounts (R1-02).
-- `clients` e as views thais_* ficam como estão.
revoke all privileges on table
  public.ad_accounts,
  public.ad_accounts_public,
  public.ad_metrics_daily,
  public.social_metrics_daily,
  public.scheduled_posts,
  public.sync_logs
from anon, authenticated;

-- 2 · O token da Meta mora no secret da função; ad_accounts vira cadastro de ativos.
alter table public.ad_accounts alter column access_token drop not null;

-- 3 · Fila de posts: autoria, tentativas, container da Meta e cancelamento.
alter table public.scheduled_posts
  add column if not exists created_by uuid,
  add column if not exists created_by_role text,
  add column if not exists publish_attempts integer not null default 0,
  add column if not exists meta_container_id text;

alter table public.scheduled_posts drop constraint if exists scheduled_posts_status_check;
alter table public.scheduled_posts add constraint scheduled_posts_status_check
  check (status in ('draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled'));

-- 4 · Registro de toda escrita do planner (R6). Sem fila de aprovação (C1 = a).
create table public.marketing_actions (
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique check (length(request_id) between 8 and 200),
  actor_user_id uuid,
  actor_role text not null check (actor_role in ('NO_ADMIN', 'MARKETING_AGENT', 'SISTEMA')),
  kind text not null,
  target text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'executando' check (status in ('executando', 'ok', 'erro')),
  result jsonb,
  external_ids jsonb,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index marketing_actions_created_at_idx on public.marketing_actions (created_at desc);
alter table public.marketing_actions enable row level security;

-- 5 · Cache curto da leitura ao vivo (15–60 min), para proteger limites de taxa.
create table public.marketing_cache (
  key text primary key,
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index marketing_cache_expires_at_idx on public.marketing_cache (expires_at);
alter table public.marketing_cache enable row level security;

-- Os default privileges do Supabase dão tudo a anon/authenticated em tabela nova.
revoke all privileges on table public.marketing_actions, public.marketing_cache from anon, authenticated;
grant all privileges on table public.marketing_actions, public.marketing_cache to service_role;

-- 6 · Publicador: reserva os posts vencidos sem que duas execuções peguem o mesmo.
-- Um post preso em `publishing` há mais de 15 min não é republicado às cegas:
-- vira `failed`, porque a Meta pode ter publicado antes da falha.
create or replace function public.marketing_claim_due_posts(p_limit integer default 10)
returns setof public.scheduled_posts
language plpgsql
set search_path = ''
as $$
begin
  update public.scheduled_posts
     set status = 'failed',
         error_message = 'Publicação interrompida no meio. Confira na plataforma antes de reagendar.'
   where status = 'publishing'
     and updated_at < now() - interval '15 minutes';

  return query
  update public.scheduled_posts as sp
     set status = 'publishing'
   where sp.id in (
     select due.id
       from public.scheduled_posts as due
      where due.status = 'scheduled'
        and due.scheduled_at <= now()
      order by due.scheduled_at
      limit greatest(1, least(coalesce(p_limit, 10), 25))
      for update skip locked
   )
  returning sp.*;
end;
$$;

-- O segredo do cron nunca sai do banco: a função compara aqui dentro.
create or replace function public.marketing_cron_secret_ok(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p_secret, '') <> ''
     and exists (
       select 1 from vault.decrypted_secrets
        where name = 'MARKETING_CRON_SECRET'
          and decrypted_secret = p_secret
     );
$$;

-- URL da função fica no Vault (`marketing_hub_url`), porque muda por ambiente.
-- Sem URL ou sem segredo, o job não faz nada.
create or replace function public.marketing_invoke_publish_due()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'marketing_hub_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'MARKETING_CRON_SECRET';
  if coalesce(v_url, '') = '' or coalesce(v_secret, '') = '' then
    return null;
  end if;

  return net.http_post(
    url := rtrim(v_url, '/') || '/internal/publish-due',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    timeout_milliseconds := 150000
  );
end;
$$;

revoke all on function public.marketing_claim_due_posts(integer) from public, anon, authenticated;
revoke all on function public.marketing_cron_secret_ok(text) from public, anon, authenticated;
revoke all on function public.marketing_invoke_publish_due() from public, anon, authenticated;
grant execute on function public.marketing_claim_due_posts(integer) to service_role;
grant execute on function public.marketing_cron_secret_ok(text) to service_role;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'MARKETING_CRON_SECRET') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'MARKETING_CRON_SECRET',
      'Header x-cron-secret do job marketing-publish-due'
    );
  end if;
end;
$$;

-- 7 · pg_cron chama a rota interna a cada 5 minutos.
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'marketing-publish-due',
  '*/5 * * * *',
  $$select public.marketing_invoke_publish_due()$$
);

-- 8 · Mídia de anúncios e posts: bucket privado, acesso só por URL assinada da função.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'marketing-media',
  'marketing-media',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime']
)
on conflict (id) do nothing;

-- 9 · A nó como cliente dona dos ativos. As linhas de ad_accounts entram com os
-- ids do Passo 0.1, em migration própria.
insert into public.clients (name, slug)
values ('nó tech stack', 'no-tech-stack')
on conflict (slug) do nothing;
