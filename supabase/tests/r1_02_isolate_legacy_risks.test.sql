begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

-- Stable X/Y fixtures prove the fixed-client views and tenant policies.
insert into public.clients (id, name, slug) values
  ('75d5ccc3-054a-452d-9dc0-cbf87ddd0758', 'Thais fixture X', 'r1-02-thais-x'),
  ('85d5ccc3-054a-452d-9dc0-cbf87ddd0758', 'Other fixture Y', 'r1-02-other-y');

insert into public.ad_accounts (
  id, client_id, platform, external_id, external_name, access_token
) values
  (
    '71000000-0000-4000-8000-000000000001',
    '75d5ccc3-054a-452d-9dc0-cbf87ddd0758',
    'meta_ads', 'r1-02-account-x', 'Account X', 'synthetic-local-x'
  ),
  (
    '81000000-0000-4000-8000-000000000001',
    '85d5ccc3-054a-452d-9dc0-cbf87ddd0758',
    'meta_ads', 'r1-02-account-y', 'Account Y', 'synthetic-local-y'
  );

insert into public.ad_metrics_daily (
  id, account_id, client_id, date, campaign_id, campaign_name
) values
  (
    '72000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000001',
    '75d5ccc3-054a-452d-9dc0-cbf87ddd0758',
    '2026-09-15', 'r1-02-campaign-x', 'Campaign X'
  ),
  (
    '82000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000001',
    '85d5ccc3-054a-452d-9dc0-cbf87ddd0758',
    '2026-09-15', 'r1-02-campaign-y', 'Campaign Y'
  );

insert into public.social_metrics_daily (
  id, account_id, client_id, date, followers_count
) values
  (
    '73000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000001',
    '75d5ccc3-054a-452d-9dc0-cbf87ddd0758',
    '2026-09-15', 10
  ),
  (
    '83000000-0000-4000-8000-000000000001',
    '81000000-0000-4000-8000-000000000001',
    '85d5ccc3-054a-452d-9dc0-cbf87ddd0758',
    '2026-09-15', 20
  );

insert into public.scheduled_posts (
  id, client_id, account_id, scheduled_at, media_type, caption
) values
  (
    '74000000-0000-4000-8000-000000000001',
    '75d5ccc3-054a-452d-9dc0-cbf87ddd0758',
    '71000000-0000-4000-8000-000000000001',
    '2026-09-16T12:00:00Z', 'feed_image', 'Post X'
  ),
  (
    '84000000-0000-4000-8000-000000000001',
    '85d5ccc3-054a-452d-9dc0-cbf87ddd0758',
    '81000000-0000-4000-8000-000000000001',
    '2026-09-16T12:00:00Z', 'feed_image', 'Post Y'
  );

-- C1: both exposed roles receive the requested permission error on every view.
set local role anon;
select throws_ok($$select * from public.thais_ad_accounts$$, '42501'::character(5), null, 'C1 anon cannot select thais_ad_accounts');
select throws_ok($$select * from public.thais_ad_metrics$$, '42501'::character(5), null, 'C1 anon cannot select thais_ad_metrics');
select throws_ok($$select * from public.thais_social_metrics$$, '42501'::character(5), null, 'C1 anon cannot select thais_social_metrics');
select throws_ok($$select * from public.thais_scheduled_posts$$, '42501'::character(5), null, 'C1 anon cannot select thais_scheduled_posts');
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","client_id":"75d5ccc3-054a-452d-9dc0-cbf87ddd0758"}',
  true
);
select throws_ok($$select * from public.thais_ad_accounts$$, '42501'::character(5), null, 'C1 authenticated cannot select thais_ad_accounts');
select throws_ok($$select * from public.thais_ad_metrics$$, '42501'::character(5), null, 'C1 authenticated cannot select thais_ad_metrics');
select throws_ok($$select * from public.thais_social_metrics$$, '42501'::character(5), null, 'C1 authenticated cannot select thais_social_metrics');
select throws_ok($$select * from public.thais_scheduled_posts$$, '42501'::character(5), null, 'C1 authenticated cannot select thais_scheduled_posts');
reset role;

-- C2: service_role sees the complete X slice and none of Y through each view.
set local role service_role;
select results_eq(
  $$select id from public.thais_ad_accounts order by id$$,
  $$values ('71000000-0000-4000-8000-000000000001'::uuid)$$,
  'C2 service_role reads only the fixed client account'
);
select results_eq(
  $$select account_id from public.thais_ad_metrics order by account_id$$,
  $$values ('71000000-0000-4000-8000-000000000001'::uuid)$$,
  'C2 service_role reads only the fixed client ad metric'
);
select results_eq(
  $$select account_id from public.thais_social_metrics order by account_id$$,
  $$values ('71000000-0000-4000-8000-000000000001'::uuid)$$,
  'C2 service_role reads only the fixed client social metric'
);
select results_eq(
  $$select id from public.thais_scheduled_posts order by id$$,
  $$values ('74000000-0000-4000-8000-000000000001'::uuid)$$,
  'C2 service_role reads only the fixed client scheduled post'
);
reset role;

-- C3: the complete four-view set executes with invoker privileges.
select ok(
  (select coalesce(reloptions, '{}'::text[]) @> array['security_invoker=true'] from pg_class where oid = 'public.thais_ad_accounts'::regclass),
  'C3 thais_ad_accounts is security_invoker'
);
select ok(
  (select coalesce(reloptions, '{}'::text[]) @> array['security_invoker=true'] from pg_class where oid = 'public.thais_ad_metrics'::regclass),
  'C3 thais_ad_metrics is security_invoker'
);
select ok(
  (select coalesce(reloptions, '{}'::text[]) @> array['security_invoker=true'] from pg_class where oid = 'public.thais_social_metrics'::regclass),
  'C3 thais_social_metrics is security_invoker'
);
select ok(
  (select coalesce(reloptions, '{}'::text[]) @> array['security_invoker=true'] from pg_class where oid = 'public.thais_scheduled_posts'::regclass),
  'C3 thais_scheduled_posts is security_invoker'
);

-- C4: each named FK has a valid, ready, non-partial index whose first key is the FK column.
select ok((
  select exists (
    select 1 from pg_constraint as c
    join pg_index as i on i.indrelid = c.conrelid
    where c.conname = 'lead_sessoes_lead_id_fkey' and c.contype = 'f'
      and i.indisvalid and i.indisready and i.indpred is null
      and i.indkey[0] = c.conkey[1]
  )
), 'C4 lead_sessoes_lead_id_fkey has a covering index');
select ok((
  select exists (
    select 1 from pg_constraint as c
    join pg_index as i on i.indrelid = c.conrelid
    where c.conname = 'scheduled_posts_account_id_fkey' and c.contype = 'f'
      and i.indisvalid and i.indisready and i.indpred is null
      and i.indkey[0] = c.conkey[1]
  )
), 'C4 scheduled_posts_account_id_fkey has a covering index');
select ok((
  select exists (
    select 1 from pg_constraint as c
    join pg_index as i on i.indrelid = c.conrelid
    where c.conname = 'scheduled_posts_client_id_fkey' and c.contype = 'f'
      and i.indisvalid and i.indisready and i.indpred is null
      and i.indkey[0] = c.conkey[1]
  )
), 'C4 scheduled_posts_client_id_fkey has a covering index');
select ok((
  select exists (
    select 1 from pg_constraint as c
    join pg_index as i on i.indrelid = c.conrelid
    where c.conname = 'sync_logs_account_id_fkey' and c.contype = 'f'
      and i.indisvalid and i.indisready and i.indpred is null
      and i.indkey[0] = c.conkey[1]
  )
), 'C4 sync_logs_account_id_fkey has a covering index');

-- C5: every named policy evaluates auth.jwt() through an initplan subquery.
select ok(strpos(lower(pg_get_expr(pol.polqual, pol.polrelid)), 'select auth.jwt()') > 0, 'C5 clients_read_own uses select auth.jwt()')
from pg_policy as pol where pol.polname = 'clients_read_own' and pol.polrelid = 'public.clients'::regclass;
select ok(strpos(lower(pg_get_expr(pol.polqual, pol.polrelid)), 'select auth.jwt()') > 0, 'C5 ad_metrics_read_own uses select auth.jwt()')
from pg_policy as pol where pol.polname = 'ad_metrics_read_own' and pol.polrelid = 'public.ad_metrics_daily'::regclass;
select ok(strpos(lower(pg_get_expr(pol.polqual, pol.polrelid)), 'select auth.jwt()') > 0, 'C5 social_metrics_read_own uses select auth.jwt()')
from pg_policy as pol where pol.polname = 'social_metrics_read_own' and pol.polrelid = 'public.social_metrics_daily'::regclass;
select ok(strpos(lower(pg_get_expr(pol.polqual, pol.polrelid)), 'select auth.jwt()') > 0, 'C5 scheduled_posts_read_own uses select auth.jwt()')
from pg_policy as pol where pol.polname = 'scheduled_posts_read_own' and pol.polrelid = 'public.scheduled_posts'::regclass;
select ok(strpos(lower(pg_get_expr(pol.polwithcheck, pol.polrelid)), 'select auth.jwt()') > 0, 'C5 scheduled_posts_insert_own uses select auth.jwt()')
from pg_policy as pol where pol.polname = 'scheduled_posts_insert_own' and pol.polrelid = 'public.scheduled_posts'::regclass;
select ok(
  strpos(lower(pg_get_expr(pol.polqual, pol.polrelid)), 'select auth.jwt()') > 0
  and strpos(lower(pg_get_expr(pol.polwithcheck, pol.polrelid)), 'select auth.jwt()') > 0,
  'C5 scheduled_posts_update_own uses select auth.jwt() in USING and WITH CHECK'
)
from pg_policy as pol where pol.polname = 'scheduled_posts_update_own' and pol.polrelid = 'public.scheduled_posts'::regclass;
select ok(strpos(lower(pg_get_expr(pol.polqual, pol.polrelid)), 'select auth.jwt()') > 0, 'C5 ad_accounts_read_own uses select auth.jwt()')
from pg_policy as pol where pol.polname = 'ad_accounts_read_own' and pol.polrelid = 'public.ad_accounts'::regclass;

-- C6: the rewritten policies retain the X/Y tenant boundary on both required tables.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","client_id":"75d5ccc3-054a-452d-9dc0-cbf87ddd0758"}',
  true
);
select is((select count(*)::integer from public.ad_metrics_daily), 1, 'C6 tenant X sees one ad_metrics_daily row');
select is((select campaign_id from public.ad_metrics_daily), 'r1-02-campaign-x', 'C6 tenant X sees no Y ad metric');
select is((select count(*)::integer from public.scheduled_posts), 1, 'C6 tenant X sees one scheduled_posts row');
select is((select id from public.scheduled_posts), '74000000-0000-4000-8000-000000000001'::uuid, 'C6 tenant X sees no Y scheduled post');
reset role;

select * from finish();
rollback;
