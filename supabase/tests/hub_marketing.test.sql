begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

insert into public.ad_accounts (id, client_id, platform, external_id, external_name)
select 'a1000000-0000-4000-8000-000000000001', id, 'meta_page', 'hub-page', 'Página fixture'
from public.clients where slug = 'no-tech-stack';

insert into public.scheduled_posts (id, client_id, account_id, scheduled_at, media_type, caption, status)
select 'a2000000-0000-4000-8000-000000000001', client_id, id, now() - interval '1 minute', 'fb_post', 'Vencido', 'scheduled'
from public.ad_accounts where id = 'a1000000-0000-4000-8000-000000000001';

insert into public.scheduled_posts (id, client_id, account_id, scheduled_at, media_type, caption, status)
select 'a2000000-0000-4000-8000-000000000002', client_id, id, now() + interval '1 day', 'fb_post', 'Futuro', 'scheduled'
from public.ad_accounts where id = 'a1000000-0000-4000-8000-000000000001';

-- H1: anon e authenticated recebem 42501 em todas as tabelas do movimento.
set local role anon;
select throws_ok($$select 1 from public.ad_accounts$$, '42501'::character(5), null, 'H1 anon select ad_accounts');
select throws_ok($$select 1 from public.ad_accounts_public$$, '42501'::character(5), null, 'H1 anon select ad_accounts_public');
select throws_ok($$select 1 from public.ad_metrics_daily$$, '42501'::character(5), null, 'H1 anon select ad_metrics_daily');
select throws_ok($$select 1 from public.social_metrics_daily$$, '42501'::character(5), null, 'H1 anon select social_metrics_daily');
select throws_ok($$select 1 from public.scheduled_posts$$, '42501'::character(5), null, 'H1 anon select scheduled_posts');
select throws_ok($$select 1 from public.sync_logs$$, '42501'::character(5), null, 'H1 anon select sync_logs');
select throws_ok($$select 1 from public.marketing_actions$$, '42501'::character(5), null, 'H1 anon select marketing_actions');
select throws_ok($$select 1 from public.marketing_cache$$, '42501'::character(5), null, 'H1 anon select marketing_cache');
select throws_ok($$delete from public.ad_accounts$$, '42501'::character(5), null, 'H1 anon delete ad_accounts');
select throws_ok($$insert into public.marketing_actions (request_id, actor_role, kind) values ('anon-request-1', 'NO_ADMIN', 'x')$$, '42501'::character(5), null, 'H1 anon insert marketing_actions');
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated","app_metadata":{"role":"NO_ADMIN"}}',
  true
);
select throws_ok($$select 1 from public.ad_accounts$$, '42501'::character(5), null, 'H1 authenticated select ad_accounts');
select throws_ok($$select id from public.ad_accounts$$, '42501'::character(5), null, 'H1 authenticated select ad_accounts safe columns');
select throws_ok($$select 1 from public.ad_accounts_public$$, '42501'::character(5), null, 'H1 authenticated select ad_accounts_public');
select throws_ok($$select 1 from public.ad_metrics_daily$$, '42501'::character(5), null, 'H1 authenticated select ad_metrics_daily');
select throws_ok($$select 1 from public.social_metrics_daily$$, '42501'::character(5), null, 'H1 authenticated select social_metrics_daily');
select throws_ok($$select 1 from public.scheduled_posts$$, '42501'::character(5), null, 'H1 authenticated select scheduled_posts');
select throws_ok($$select 1 from public.sync_logs$$, '42501'::character(5), null, 'H1 authenticated select sync_logs');
select throws_ok($$select 1 from public.marketing_actions$$, '42501'::character(5), null, 'H1 authenticated select marketing_actions');
select throws_ok($$select 1 from public.marketing_cache$$, '42501'::character(5), null, 'H1 authenticated select marketing_cache');
select throws_ok($$update public.scheduled_posts set caption = 'x'$$, '42501'::character(5), null, 'H1 authenticated update scheduled_posts');
select throws_ok($$select public.marketing_claim_due_posts(10)$$, '42501'::character(5), null, 'H1 authenticated cannot claim posts');
select throws_ok($$select public.marketing_cron_secret_ok('x')$$, '42501'::character(5), null, 'H1 authenticated cannot probe cron secret');
select throws_ok($$select public.marketing_invoke_publish_due()$$, '42501'::character(5), null, 'H1 authenticated cannot fire the publisher');
reset role;

-- H2: nenhuma grant (tabela ou coluna) sobra para anon/authenticated.
select is(
  (select count(*)::integer from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee in ('anon', 'authenticated')
      and table_name in ('ad_accounts', 'ad_accounts_public', 'ad_metrics_daily', 'social_metrics_daily',
                         'scheduled_posts', 'sync_logs', 'marketing_actions', 'marketing_cache')),
  0,
  'H2 zero table grants for anon/authenticated'
);
select is(
  (select count(*)::integer from information_schema.column_privileges
    where table_schema = 'public'
      and grantee in ('anon', 'authenticated')
      and table_name in ('ad_accounts', 'marketing_actions', 'marketing_cache')),
  0,
  'H2 zero column grants for anon/authenticated'
);

-- H3: service role lê e escreve o registro, o cache e a fila.
set local role service_role;
insert into public.marketing_actions (request_id, actor_user_id, actor_role, kind, target, payload)
values ('req-hub-000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'MARKETING_AGENT', 'meta.campanha.criar', 'meta', '{"nome":"[teste hub]"}');
select is((select status from public.marketing_actions where request_id = 'req-hub-000001'), 'executando', 'H3 action starts as executando');
select throws_ok(
  $$insert into public.marketing_actions (request_id, actor_role, kind) values ('req-hub-000001', 'NO_ADMIN', 'x')$$,
  '23505'::character(5), null, 'H3 request_id is idempotent'
);
select throws_ok(
  $$insert into public.marketing_actions (request_id, actor_role, kind) values ('req-hub-000002', 'CLIENT', 'x')$$,
  '23514'::character(5), null, 'H3 unknown actor role is rejected'
);
update public.marketing_actions set status = 'ok', finished_at = now(), external_ids = '{"campaign_id":"1"}' where request_id = 'req-hub-000001';
select is((select external_ids ->> 'campaign_id' from public.marketing_actions where request_id = 'req-hub-000001'), '1', 'H3 service role finishes the action');
insert into public.marketing_cache (key, payload, expires_at) values ('overview:7d', '{"ok":true}', now() + interval '15 minutes');
select is((select payload ->> 'ok' from public.marketing_cache where key = 'overview:7d'), 'true', 'H3 service role writes the cache');
select results_eq(
  $$select id from public.marketing_claim_due_posts(10)$$,
  $$values ('a2000000-0000-4000-8000-000000000001'::uuid)$$,
  'H3 claim returns only the due post'
);
select is((select status from public.scheduled_posts where id = 'a2000000-0000-4000-8000-000000000001'), 'publishing', 'H3 claimed post is publishing');
select is((select count(*)::integer from public.marketing_claim_due_posts(10)), 0, 'H3 a claimed post is not claimed twice');
update public.scheduled_posts set status = 'cancelled' where id = 'a2000000-0000-4000-8000-000000000002';
select is((select status from public.scheduled_posts where id = 'a2000000-0000-4000-8000-000000000002'), 'cancelled', 'H3 cancelled is a valid status');
select is(public.marketing_cron_secret_ok('certamente-errado'), false, 'H3 wrong cron secret is refused');
select is(public.marketing_cron_secret_ok(null), false, 'H3 empty cron secret is refused');
reset role;

-- H4: publicação presa vira failed, sem republicar às cegas.
update public.scheduled_posts
   set status = 'publishing', updated_at = now() - interval '20 minutes'
 where id = 'a2000000-0000-4000-8000-000000000001';
alter table public.scheduled_posts disable trigger scheduled_posts_set_updated_at;
update public.scheduled_posts set updated_at = now() - interval '20 minutes' where id = 'a2000000-0000-4000-8000-000000000001';
alter table public.scheduled_posts enable trigger scheduled_posts_set_updated_at;
set local role service_role;
select is((select count(*)::integer from public.marketing_claim_due_posts(10)), 0, 'H4 stale publishing post is not reclaimed');
reset role;
select is((select status from public.scheduled_posts where id = 'a2000000-0000-4000-8000-000000000001'), 'failed', 'H4 stale publishing post becomes failed');

-- H5: infraestrutura do movimento.
select ok(
  (select is_nullable = 'YES' from information_schema.columns
    where table_schema = 'public' and table_name = 'ad_accounts' and column_name = 'access_token'),
  'H5 ad_accounts.access_token is nullable'
);
select ok(
  exists (select 1 from cron.job where jobname = 'marketing-publish-due' and schedule = '*/5 * * * *'),
  'H5 cron job runs every 5 minutes'
);
select ok(exists (select 1 from vault.secrets where name = 'MARKETING_CRON_SECRET'), 'H5 cron secret exists in Vault');
select ok(
  exists (select 1 from storage.buckets where id = 'marketing-media' and public = false),
  'H5 marketing-media bucket is private'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'storage' and qual ilike '%marketing-media%'),
  0,
  'H5 no storage policy opens marketing-media'
);
select ok(exists (select 1 from public.clients where slug = 'no-tech-stack'), 'H5 nó client exists');
select results_eq(
  $$select a.platform, a.external_id from public.ad_accounts a join public.clients c on c.id = a.client_id
    where c.slug = 'no-tech-stack' and a.access_token is null and a.external_id <> 'hub-page' order by a.platform$$,
  $$values ('meta_ads', 'act_1415926037237997'), ('meta_instagram', '17841441508079164'), ('meta_page', '1132533626610077')$$,
  'H5 seed has the three nó Meta assets without token'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.marketing_actions'::regclass)
  and (select relrowsecurity from pg_class where oid = 'public.marketing_cache'::regclass),
  'H5 RLS is on for the new tables'
);
select is(public.marketing_invoke_publish_due(), null::bigint, 'H5 publisher is a no-op without marketing_hub_url');

select * from finish();
rollback;
