-- =========================================================================
-- Fase 1 — Backend core de integração Meta (Ads + Orgânico)
-- Schema multi-tenant: clients → ad_accounts → metrics / posts / logs
-- RLS garante que cada cliente só vê o próprio dado (claim `client_id` no JWT).
-- =========================================================================

-- Requisito: gen_random_uuid()
create extension if not exists "pgcrypto";

-- -------------------------------------------------------------------------
-- Trigger util: mantém updated_at em dia
-- -------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -------------------------------------------------------------------------
-- clients — cada cliente da nó tem 1 hub
-- -------------------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  email text,
  status text not null default 'active' check (status in ('active', 'paused', 'churned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- ad_accounts — contas Meta conectadas via OAuth (1 cliente tem N contas)
-- -------------------------------------------------------------------------
create table if not exists public.ad_accounts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  platform text not null check (platform in ('meta_ads', 'meta_page', 'meta_instagram')),
  external_id text not null,
  external_name text,
  access_token text not null,
  token_expires_at timestamptz,
  scopes text[],
  status text not null default 'active' check (status in ('active', 'expired', 'revoked', 'error')),
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(client_id, platform, external_id)
);

create trigger ad_accounts_set_updated_at
  before update on public.ad_accounts
  for each row execute function public.set_updated_at();

create index if not exists idx_ad_accounts_client on public.ad_accounts(client_id);

-- -------------------------------------------------------------------------
-- ad_metrics_daily — snapshot diário por campanha
-- -------------------------------------------------------------------------
create table if not exists public.ad_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.ad_accounts(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  date date not null,
  campaign_id text not null,
  campaign_name text,
  campaign_status text,
  objective text,
  spend numeric(12,2) default 0,
  impressions bigint default 0,
  clicks bigint default 0,
  conversions int default 0,
  revenue numeric(12,2) default 0,
  ctr numeric(6,4),
  cpa numeric(12,2),
  roas numeric(8,4),
  raw_insights jsonb,
  created_at timestamptz not null default now(),
  unique(account_id, date, campaign_id)
);

create index if not exists idx_ad_metrics_client_date
  on public.ad_metrics_daily(client_id, date desc);

-- -------------------------------------------------------------------------
-- social_metrics_daily — snapshot diário por perfil orgânico (IG/FB Page)
-- -------------------------------------------------------------------------
create table if not exists public.social_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.ad_accounts(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  date date not null,
  followers_count int,
  followers_gained int,
  followers_lost int,
  reach int,
  impressions int,
  profile_views int,
  engagement_rate numeric(6,4),
  posts_published int default 0,
  raw_insights jsonb,
  created_at timestamptz not null default now(),
  unique(account_id, date)
);

create index if not exists idx_social_metrics_client_date
  on public.social_metrics_daily(client_id, date desc);

-- -------------------------------------------------------------------------
-- scheduled_posts — fila de publicação via hub
-- -------------------------------------------------------------------------
create table if not exists public.scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  account_id uuid not null references public.ad_accounts(id) on delete cascade,
  scheduled_at timestamptz not null,
  published_at timestamptz,
  media_type text not null check (media_type in ('feed_image', 'feed_video', 'reel', 'carousel', 'fb_post')),
  caption text,
  media_urls text[],
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'publishing', 'published', 'failed')),
  external_post_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger scheduled_posts_set_updated_at
  before update on public.scheduled_posts
  for each row execute function public.set_updated_at();

create index if not exists idx_scheduled_posts_due
  on public.scheduled_posts(scheduled_at)
  where status = 'scheduled';

-- -------------------------------------------------------------------------
-- sync_logs — auditoria dos jobs cron
-- -------------------------------------------------------------------------
create table if not exists public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  account_id uuid references public.ad_accounts(id) on delete cascade,
  status text not null check (status in ('success', 'error', 'partial')),
  records_processed int default 0,
  error_message text,
  duration_ms int,
  created_at timestamptz not null default now()
);

create index if not exists idx_sync_logs_job_created
  on public.sync_logs(job_name, created_at desc);

-- =========================================================================
-- Row Level Security
-- Padrão:
--   - service_role: acesso total (Edge Functions)
--   - authenticated com claim `client_id`: SELECT na própria linha
--   - anon: sem acesso
-- ad_accounts é exposto ao frontend só via view `ad_accounts_public`
-- (que esconde o access_token). A tabela base não libera SELECT ao authenticated.
-- =========================================================================

alter table public.clients enable row level security;
alter table public.ad_accounts enable row level security;
alter table public.ad_metrics_daily enable row level security;
alter table public.social_metrics_daily enable row level security;
alter table public.scheduled_posts enable row level security;
alter table public.sync_logs enable row level security;

-- clients
create policy "clients_service_role_all" on public.clients
  for all to service_role using (true) with check (true);

create policy "clients_read_own" on public.clients
  for select to authenticated
  using (id = (auth.jwt() ->> 'client_id')::uuid);

-- ad_accounts (sem SELECT público — usar view abaixo)
create policy "ad_accounts_service_role_all" on public.ad_accounts
  for all to service_role using (true) with check (true);

-- ad_metrics_daily
create policy "ad_metrics_service_role_all" on public.ad_metrics_daily
  for all to service_role using (true) with check (true);

create policy "ad_metrics_read_own" on public.ad_metrics_daily
  for select to authenticated
  using (client_id = (auth.jwt() ->> 'client_id')::uuid);

-- social_metrics_daily
create policy "social_metrics_service_role_all" on public.social_metrics_daily
  for all to service_role using (true) with check (true);

create policy "social_metrics_read_own" on public.social_metrics_daily
  for select to authenticated
  using (client_id = (auth.jwt() ->> 'client_id')::uuid);

-- scheduled_posts (autenticado pode ler e inserir rascunhos próprios)
create policy "scheduled_posts_service_role_all" on public.scheduled_posts
  for all to service_role using (true) with check (true);

create policy "scheduled_posts_read_own" on public.scheduled_posts
  for select to authenticated
  using (client_id = (auth.jwt() ->> 'client_id')::uuid);

create policy "scheduled_posts_insert_own" on public.scheduled_posts
  for insert to authenticated
  with check (client_id = (auth.jwt() ->> 'client_id')::uuid);

create policy "scheduled_posts_update_own" on public.scheduled_posts
  for update to authenticated
  using (client_id = (auth.jwt() ->> 'client_id')::uuid)
  with check (client_id = (auth.jwt() ->> 'client_id')::uuid);

-- sync_logs (só service_role; frontend não precisa)
create policy "sync_logs_service_role_all" on public.sync_logs
  for all to service_role using (true) with check (true);

-- =========================================================================
-- View pública de ad_accounts (sem access_token)
-- security_invoker faz a view respeitar o RLS do usuário que consulta;
-- adicionamos aqui uma policy explícita SELECT na tabela base p/ authenticated
-- limitada aos campos seguros é impossível em PG — então fazemos o inverso:
-- deixamos authenticated com SELECT na tabela base (colunas filtradas pela view)
-- e só expomos a view. Risco zero de vazar token porque a view não lista o campo
-- e o frontend nunca usa o client service role.
-- =========================================================================

create policy "ad_accounts_read_own" on public.ad_accounts
  for select to authenticated
  using (client_id = (auth.jwt() ->> 'client_id')::uuid);

create or replace view public.ad_accounts_public
with (security_invoker = true) as
select
  id,
  client_id,
  platform,
  external_id,
  external_name,
  scopes,
  status,
  last_synced_at,
  last_error,
  created_at,
  updated_at
from public.ad_accounts;

grant select on public.ad_accounts_public to authenticated;

-- Revoga qualquer acesso direto ao access_token pro role authenticated.
-- (RLS ainda permite SELECT *, mas deixamos explícito via grant coluna-a-coluna.)
revoke select on public.ad_accounts from authenticated;
grant select (
  id, client_id, platform, external_id, external_name, scopes,
  status, last_synced_at, last_error, created_at, updated_at
) on public.ad_accounts to authenticated;
