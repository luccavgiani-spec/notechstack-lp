-- R1-02: isolate the paused Meta product without changing its data contract.

create or replace view public.thais_ad_accounts
with (security_invoker = true) as
select
  id,
  platform,
  external_id,
  external_name,
  status,
  last_synced_at,
  last_error,
  scopes
from public.ad_accounts
where client_id = '75d5ccc3-054a-452d-9dc0-cbf87ddd0758'::uuid;

create or replace view public.thais_ad_metrics
with (security_invoker = true) as
select
  account_id,
  date,
  campaign_id,
  campaign_name,
  campaign_status,
  objective,
  spend,
  impressions,
  clicks,
  conversions,
  revenue,
  ctr,
  cpa,
  roas
from public.ad_metrics_daily
where client_id = '75d5ccc3-054a-452d-9dc0-cbf87ddd0758'::uuid;

create or replace view public.thais_social_metrics
with (security_invoker = true) as
select
  account_id,
  date,
  followers_count,
  followers_gained,
  followers_lost,
  reach,
  impressions,
  profile_views,
  engagement_rate,
  posts_published
from public.social_metrics_daily
where client_id = '75d5ccc3-054a-452d-9dc0-cbf87ddd0758'::uuid;

create or replace view public.thais_scheduled_posts
with (security_invoker = true) as
select
  id,
  account_id,
  scheduled_at,
  published_at,
  media_type,
  caption,
  media_urls,
  status,
  external_post_id
from public.scheduled_posts
where client_id = '75d5ccc3-054a-452d-9dc0-cbf87ddd0758'::uuid;

revoke select on
  public.thais_ad_accounts,
  public.thais_ad_metrics,
  public.thais_social_metrics,
  public.thais_scheduled_posts
from anon, authenticated;

grant select on
  public.thais_ad_accounts,
  public.thais_ad_metrics,
  public.thais_social_metrics,
  public.thais_scheduled_posts
to service_role;

create index if not exists lead_sessoes_lead_id_idx
  on public.lead_sessoes (lead_id);

create index if not exists scheduled_posts_account_id_idx
  on public.scheduled_posts (account_id);

create index if not exists scheduled_posts_client_id_idx
  on public.scheduled_posts (client_id);

create index if not exists sync_logs_account_id_idx
  on public.sync_logs (account_id);

drop policy if exists "clients_read_own" on public.clients;
create policy "clients_read_own" on public.clients
  for select to authenticated
  using (id = ((select auth.jwt()) ->> 'client_id')::uuid);

drop policy if exists "ad_metrics_read_own" on public.ad_metrics_daily;
create policy "ad_metrics_read_own" on public.ad_metrics_daily
  for select to authenticated
  using (client_id = ((select auth.jwt()) ->> 'client_id')::uuid);

drop policy if exists "social_metrics_read_own" on public.social_metrics_daily;
create policy "social_metrics_read_own" on public.social_metrics_daily
  for select to authenticated
  using (client_id = ((select auth.jwt()) ->> 'client_id')::uuid);

drop policy if exists "scheduled_posts_read_own" on public.scheduled_posts;
create policy "scheduled_posts_read_own" on public.scheduled_posts
  for select to authenticated
  using (client_id = ((select auth.jwt()) ->> 'client_id')::uuid);

drop policy if exists "scheduled_posts_insert_own" on public.scheduled_posts;
create policy "scheduled_posts_insert_own" on public.scheduled_posts
  for insert to authenticated
  with check (client_id = ((select auth.jwt()) ->> 'client_id')::uuid);

drop policy if exists "scheduled_posts_update_own" on public.scheduled_posts;
create policy "scheduled_posts_update_own" on public.scheduled_posts
  for update to authenticated
  using (client_id = ((select auth.jwt()) ->> 'client_id')::uuid)
  with check (client_id = ((select auth.jwt()) ->> 'client_id')::uuid);

drop policy if exists "ad_accounts_read_own" on public.ad_accounts;
create policy "ad_accounts_read_own" on public.ad_accounts
  for select to authenticated
  using (client_id = ((select auth.jwt()) ->> 'client_id')::uuid);
