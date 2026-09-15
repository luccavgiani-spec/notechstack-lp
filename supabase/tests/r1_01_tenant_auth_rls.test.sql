begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

create function public.r1_01_test_row_count(p_sql text)
returns integer
language plpgsql
as $$
declare
  v_rows integer;
begin
  execute p_sql;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

grant execute on function public.r1_01_test_row_count(text) to authenticated;

-- Stable fixture identifiers make cross-tenant assertions explicit.
insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'a@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'b@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'authenticated', 'authenticated', 'outsider@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'authenticated', 'authenticated', 'admin@example.test', '{"role":"NO_ADMIN"}'::jsonb, '{}'::jsonb, now(), now());

insert into public.clients (id, name, slug) values
  ('10000000-0000-4000-8000-000000000001', 'Tenant A', 'r1-01-tenant-a'),
  ('20000000-0000-4000-8000-000000000002', 'Tenant B', 'r1-01-tenant-b');

insert into public.memberships (id, user_id, client_id, role) values
  ('a1000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '10000000-0000-4000-8000-000000000001', 'CLIENT'),
  ('b2000000-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '20000000-0000-4000-8000-000000000002', 'CLIENT');

insert into public.projects (
  id, client_id, name, lead_status, access_status, access_released_at, modules
) values
  (
    '11111111-1111-4111-8111-111111111111',
    '10000000-0000-4000-8000-000000000001',
    'Projeto A',
    'DASHBOARD_LIBERADO',
    'INICIAL_15_DIAS',
    now(),
    '{"como_funciona":"ativo","prototipo":"ativo","etapas":"ativo","editor":"bloqueado","versoes":"bloqueado","marca":"bloqueado"}'::jsonb
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    '20000000-0000-4000-8000-000000000002',
    'Projeto B',
    'DASHBOARD_LIBERADO',
    'INICIAL_15_DIAS',
    now(),
    '{"como_funciona":"ativo","prototipo":"ativo","etapas":"ativo","editor":"bloqueado","versoes":"bloqueado","marca":"bloqueado"}'::jsonb
  );

insert into public.roadmaps (project_id, answers) values
  ('11111111-1111-4111-8111-111111111111', '{"tenant":"A"}'::jsonb),
  ('22222222-2222-4222-8222-222222222222', '{"tenant":"B"}'::jsonb);

insert into public.kanban_items (id, project_id, title, position) values
  ('11000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'A item 1', 1),
  ('11000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'A item 2', 2),
  ('22000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'B item 1', 1),
  ('22000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'B item 2', 2);

truncate table public.activity_events restart identity;
insert into public.activity_events (project_id, type, actor_id, payload, request_id) values
  ('11111111-1111-4111-8111-111111111111', 'fixture', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{"tenant":"A"}', 'fixture-a'),
  ('22222222-2222-4222-8222-222222222222', 'fixture', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '{"tenant":"B"}', 'fixture-b');

-- criterion 1: a client sees only its tenant in every protected table.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","app_metadata":{}}',
  true
);
select is((select count(*)::integer from public.projects), 1, 'criterion 1 - projects has one visible tenant row');
select is((select id from public.projects), '11111111-1111-4111-8111-111111111111'::uuid, 'criterion 1 - projects exposes tenant A only');
select is((select count(*)::integer from public.roadmaps), 1, 'criterion 1 - roadmaps has one visible tenant row');
select is((select project_id from public.roadmaps), '11111111-1111-4111-8111-111111111111'::uuid, 'criterion 1 - roadmaps exposes tenant A only');
select is((select count(*)::integer from public.kanban_items), 2, 'criterion 1 - kanban_items exposes both A items');
select is((select count(*)::integer from public.kanban_items where project_id = '22222222-2222-4222-8222-222222222222'), 0, 'criterion 1 - kanban_items exposes no B items');
select is((select count(*)::integer from public.activity_events), 1, 'criterion 1 - activity_events has one visible tenant row');
select is((select project_id from public.activity_events), '11111111-1111-4111-8111-111111111111'::uuid, 'criterion 1 - activity_events exposes tenant A only');
select is((select count(*)::integer from public.memberships), 1, 'criterion 1 - memberships has one visible tenant row');
select is((select client_id from public.memberships), '10000000-0000-4000-8000-000000000001'::uuid, 'criterion 1 - memberships exposes tenant A only');
reset role;

-- criterion 2: all three write operations against B are blocked in all five tables.
create temporary table r1_01_b_snapshot as
select
  (
    select to_jsonb(m)
    from public.memberships as m
    where m.client_id = '20000000-0000-4000-8000-000000000002'
  ) as membership,
  (
    select to_jsonb(p)
    from public.projects as p
    where p.id = '22222222-2222-4222-8222-222222222222'
  ) as project,
  (
    select to_jsonb(r)
    from public.roadmaps as r
    where r.project_id = '22222222-2222-4222-8222-222222222222'
  ) as roadmap,
  (
    select jsonb_agg(to_jsonb(k) order by k.id)
    from public.kanban_items as k
    where k.project_id = '22222222-2222-4222-8222-222222222222'
  ) as kanban_items,
  (
    select to_jsonb(ae)
    from public.activity_events as ae
    where ae.project_id = '22222222-2222-4222-8222-222222222222'
  ) as activity_event;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","app_metadata":{}}',
  true
);

select throws_ok(
  $$insert into public.memberships (user_id, client_id, role) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '20000000-0000-4000-8000-000000000002', 'CLIENT')$$,
  '42501'::character(5),
  null,
  'criterion 2 - memberships insert into B is rejected'
);
select is(public.r1_01_test_row_count($$update public.memberships set role = 'CLIENT' where client_id = '20000000-0000-4000-8000-000000000002'$$), 0, 'criterion 2 - memberships update in B affects zero rows');
select is(public.r1_01_test_row_count($$delete from public.memberships where client_id = '20000000-0000-4000-8000-000000000002'$$), 0, 'criterion 2 - memberships delete in B affects zero rows');

select throws_ok(
  $$insert into public.projects (id, client_id, name, lead_status) values ('29999999-9999-4999-8999-999999999999', '20000000-0000-4000-8000-000000000002', 'Intruso', 'FORMULARIO_PREENCHIDO')$$,
  '42501'::character(5),
  null,
  'criterion 2 - projects insert into B is rejected'
);
select is(public.r1_01_test_row_count($$update public.projects set name = 'Alterado por A' where id = '22222222-2222-4222-8222-222222222222'$$), 0, 'criterion 2 - projects update in B affects zero rows');
select is(public.r1_01_test_row_count($$delete from public.projects where id = '22222222-2222-4222-8222-222222222222'$$), 0, 'criterion 2 - projects delete in B affects zero rows');

select throws_ok(
  $$insert into public.roadmaps (project_id, answers) values ('22222222-2222-4222-8222-222222222222', '{"intruso":true}')$$,
  '42501'::character(5),
  null,
  'criterion 2 - roadmaps insert into B is rejected'
);
select is(public.r1_01_test_row_count($$update public.roadmaps set answers = '{"intruso":true}' where project_id = '22222222-2222-4222-8222-222222222222'$$), 0, 'criterion 2 - roadmaps update in B affects zero rows');
select is(public.r1_01_test_row_count($$delete from public.roadmaps where project_id = '22222222-2222-4222-8222-222222222222'$$), 0, 'criterion 2 - roadmaps delete in B affects zero rows');

select throws_ok(
  $$insert into public.kanban_items (project_id, title) values ('22222222-2222-4222-8222-222222222222', 'Intruso')$$,
  '42501'::character(5),
  null,
  'criterion 2 - kanban_items insert into B is rejected'
);
select is(public.r1_01_test_row_count($$update public.kanban_items set title = 'Alterado por A' where project_id = '22222222-2222-4222-8222-222222222222'$$), 0, 'criterion 2 - kanban_items update in B affects zero rows');
select is(public.r1_01_test_row_count($$delete from public.kanban_items where project_id = '22222222-2222-4222-8222-222222222222'$$), 0, 'criterion 2 - kanban_items delete in B affects zero rows');

select throws_ok(
  $$insert into public.activity_events (project_id, type, request_id) values ('22222222-2222-4222-8222-222222222222', 'intruso', 'intruso-b')$$,
  '42501'::character(5),
  null,
  'criterion 2 - activity_events insert into B is rejected'
);
select throws_ok(
  $$update public.activity_events set payload = '{"intruso":true}' where project_id = '22222222-2222-4222-8222-222222222222'$$,
  '42501'::character(5),
  null,
  'criterion 2 - activity_events update in B is rejected'
);
select throws_ok(
  $$delete from public.activity_events where project_id = '22222222-2222-4222-8222-222222222222'$$,
  '42501'::character(5),
  null,
  'criterion 2 - activity_events delete in B is rejected'
);
reset role;

select is((select to_jsonb(m) from public.memberships as m where m.client_id = '20000000-0000-4000-8000-000000000002'), (select membership from r1_01_b_snapshot), 'criterion 2 - full B membership snapshot is unchanged');
select is((select to_jsonb(p) from public.projects as p where p.id = '22222222-2222-4222-8222-222222222222'), (select project from r1_01_b_snapshot), 'criterion 2 - full B project snapshot is unchanged');
select is((select to_jsonb(r) from public.roadmaps as r where r.project_id = '22222222-2222-4222-8222-222222222222'), (select roadmap from r1_01_b_snapshot), 'criterion 2 - full B roadmap snapshot is unchanged');
select is((select jsonb_agg(to_jsonb(k) order by k.id) from public.kanban_items as k where k.project_id = '22222222-2222-4222-8222-222222222222'), (select kanban_items from r1_01_b_snapshot), 'criterion 2 - full B kanban snapshot is unchanged');
select is((select to_jsonb(ae) from public.activity_events as ae where ae.project_id = '22222222-2222-4222-8222-222222222222'), (select activity_event from r1_01_b_snapshot), 'criterion 2 - full B activity snapshot is unchanged');

-- criterion 3: the global admin claim sees both tenants.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated","app_metadata":{"role":"NO_ADMIN"}}',
  true
);
select is((select count(*)::integer from public.projects), 2, 'criterion 3 - NO_ADMIN sees A and B projects');
select is((select count(*)::integer from public.roadmaps), 2, 'criterion 3 - NO_ADMIN sees A and B roadmaps');
select is((select count(*)::integer from public.kanban_items), 4, 'criterion 3 - NO_ADMIN sees A and B kanban items');
select is((select count(*)::integer from public.activity_events), 2, 'criterion 3 - NO_ADMIN sees A and B activity events');
select is((select count(*)::integer from public.memberships), 2, 'criterion 3 - NO_ADMIN sees A and B memberships');
reset role;

-- criterion 4: anon can call the protected surfaces but receives no rows.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::integer from public.projects), 0, 'criterion 4 - anon sees zero projects');
select is((select count(*)::integer from public.roadmaps), 0, 'criterion 4 - anon sees zero roadmaps');
select is((select count(*)::integer from public.kanban_items), 0, 'criterion 4 - anon sees zero kanban_items');
select is((select count(*)::integer from public.activity_events), 0, 'criterion 4 - anon sees zero activity_events');
select is((select count(*)::integer from public.memberships), 0, 'criterion 4 - anon sees zero memberships');
select is((select count(*)::integer from public.project_access), 0, 'criterion 4 - anon sees zero project_access rows');
reset role;

-- criterion 5: an authenticated outsider has no tenant visibility.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated","app_metadata":{}}',
  true
);
select is((select count(*)::integer from public.projects), 0, 'criterion 5 - outsider sees zero projects');
select is((select count(*)::integer from public.roadmaps), 0, 'criterion 5 - outsider sees zero roadmaps');
select is((select count(*)::integer from public.kanban_items), 0, 'criterion 5 - outsider sees zero kanban_items');
select is((select count(*)::integer from public.activity_events), 0, 'criterion 5 - outsider sees zero activity_events');
select is((select count(*)::integer from public.memberships), 0, 'criterion 5 - outsider sees zero memberships');
reset role;

-- criterion 6: exactly one second before expiry remains readable.
update public.projects
set access_status = 'INICIAL_15_DIAS',
    access_released_at = now() - interval '15 days' + interval '1 second',
    modules = modules || '{"como_funciona":"ativo","prototipo":"ativo","etapas":"ativo"}'::jsonb
where id = '11111111-1111-4111-8111-111111111111';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","app_metadata":{}}',
  true
);
select is(
  (select jsonb_build_object(
    'projects', (select count(*) from public.projects),
    'roadmaps', (select count(*) from public.roadmaps),
    'items', (select count(*) from public.kanban_items),
    'status', (select effective_access_status::text from public.project_access)
  )),
  '{"projects":1,"roadmaps":1,"items":2,"status":"INICIAL_15_DIAS"}'::jsonb,
  'criterion 6 - the one-second-open window exposes project, roadmap, items and initial status'
);
reset role;

-- criterion 7: exactly one second after expiry is hidden from CLIENT and reported to admin.
update public.projects
set access_released_at = now() - interval '15 days' - interval '1 second'
where id = '11111111-1111-4111-8111-111111111111';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","app_metadata":{}}',
  true
);
select is((select count(*)::integer from public.projects), 0, 'criterion 7 - expired project is hidden from CLIENT');
select is((select count(*)::integer from public.roadmaps), 0, 'criterion 7 - expired roadmap is hidden from CLIENT');
select is((select count(*)::integer from public.kanban_items), 0, 'criterion 7 - expired items are hidden from CLIENT');
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated","app_metadata":{"role":"NO_ADMIN"}}',
  true
);
select is((select effective_access_status::text from public.project_access where id = '11111111-1111-4111-8111-111111111111'), 'EXPIRADO', 'criterion 7 - NO_ADMIN reads the computed expired status');
reset role;

-- criterion 8: converted access does not expire.
update public.projects
set access_status = 'ATIVO_ATE_FIM_DO_PROJETO',
    access_released_at = now() - interval '45 days'
where id = '11111111-1111-4111-8111-111111111111';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","app_metadata":{}}',
  true
);
select is((select count(*)::integer from public.projects), 1, 'criterion 8 - converted project remains readable after 45 days');
select is((select count(*)::integer from public.roadmaps), 1, 'criterion 8 - converted roadmap remains readable after 45 days');
select is((select count(*)::integer from public.kanban_items), 2, 'criterion 8 - converted items remain readable after 45 days');
reset role;

-- criterion 9: the etapas module gates items but not the roadmap, and never gates NO_ADMIN.
update public.projects
set modules = modules || '{"como_funciona":"ativo","prototipo":"ativo","etapas":"bloqueado"}'::jsonb
where id = '11111111-1111-4111-8111-111111111111';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","app_metadata":{}}',
  true
);
select is((select count(*)::integer from public.kanban_items), 0, 'criterion 9 - blocked etapas hides CLIENT items');
select is((select count(*)::integer from public.roadmaps), 1, 'criterion 9 - blocked etapas keeps CLIENT roadmap visible');
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated","app_metadata":{"role":"NO_ADMIN"}}',
  true
);
select is((select count(*)::integer from public.kanban_items where project_id = '11111111-1111-4111-8111-111111111111'), 2, 'criterion 9 - blocked etapas does not restrict NO_ADMIN');
reset role;

-- criterion 10: activity is append-only to exposed roles and request_id is idempotent.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$update public.activity_events set payload = '{}'::jsonb$$,
  '42501'::character(5),
  null,
  'criterion 10 - anon cannot update activity_events'
);
select throws_ok(
  $$delete from public.activity_events$$,
  '42501'::character(5),
  null,
  'criterion 10 - anon cannot delete activity_events'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","app_metadata":{}}',
  true
);
select throws_ok(
  $$update public.activity_events set payload = '{}'::jsonb$$,
  '42501'::character(5),
  null,
  'criterion 10 - authenticated cannot update activity_events'
);
select throws_ok(
  $$delete from public.activity_events$$,
  '42501'::character(5),
  null,
  'criterion 10 - authenticated cannot delete activity_events'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated","app_metadata":{"role":"NO_ADMIN"}}',
  true
);
insert into public.activity_events (project_id, type, actor_id, request_id)
values ('11111111-1111-4111-8111-111111111111', 'idempotency', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'criterion-10-request');
select throws_ok(
  $$insert into public.activity_events (project_id, type, actor_id, request_id) values ('11111111-1111-4111-8111-111111111111', 'idempotency', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'criterion-10-request')$$,
  '23505'::character(5),
  null,
  'criterion 10 - duplicate request_id is rejected'
);
select is((select count(*)::integer from public.activity_events where request_id = 'criterion-10-request'), 1, 'criterion 10 - duplicate request_id leaves exactly one event');
reset role;

-- criterion 15: one auditable event per update, actor/project/payload included, bypass honored.
truncate table public.activity_events restart identity;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated","app_metadata":{"role":"NO_ADMIN"}}',
  true
);
select set_config('app.skip_activity', 'off', true);
update public.projects
set name = 'Projeto A auditado'
where id = '11111111-1111-4111-8111-111111111111';
select is((select count(*)::integer from public.activity_events), 1, 'criterion 15 - project update emits exactly one event');
select is((select actor_id from public.activity_events), 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid, 'criterion 15 - project event records actor_id');
select is((select project_id from public.activity_events), '11111111-1111-4111-8111-111111111111'::uuid, 'criterion 15 - project event records project_id');
select is((select payload from public.activity_events), '{"campo":"name","antes":"Projeto A","depois":"Projeto A auditado"}'::jsonb, 'criterion 15 - project event records field, before and after');
reset role;

truncate table public.activity_events restart identity;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated","app_metadata":{"role":"NO_ADMIN"}}',
  true
);
select set_config('app.skip_activity', 'off', true);
update public.kanban_items
set title = 'A item 1 auditado'
where id = '11000000-0000-4000-8000-000000000001';
select is((select count(*)::integer from public.activity_events), 1, 'criterion 15 - kanban update emits exactly one event');
select is((select actor_id from public.activity_events), 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid, 'criterion 15 - kanban event records actor_id');
select is((select project_id from public.activity_events), '11111111-1111-4111-8111-111111111111'::uuid, 'criterion 15 - kanban event records project_id');
select is((select payload from public.activity_events), '{"campo":"title","antes":"A item 1","depois":"A item 1 auditado"}'::jsonb, 'criterion 15 - kanban event records field, before and after');

reset role;
truncate table public.activity_events restart identity;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated","app_metadata":{"role":"NO_ADMIN"}}',
  true
);
select set_config('app.skip_activity', 'on', true);
update public.projects
set name = 'Projeto A sem evento'
where id = '11111111-1111-4111-8111-111111111111';
update public.kanban_items
set title = 'A item 2 sem evento'
where id = '11000000-0000-4000-8000-000000000002';
select is((select count(*)::integer from public.activity_events), 0, 'criterion 15 - app.skip_activity suppresses project and kanban triggers');
select set_config('app.skip_activity', 'off', true);
reset role;

-- Swept validation: enum and fixed-value checks reject invalid domain values.
select throws_ok(
  $$insert into public.projects (client_id, name, lead_status) values ('10000000-0000-4000-8000-000000000001', 'Inválido', 'FORA_DA_LISTA')$$,
  '22P02'::character(5),
  null,
  'validation - lead_status rejects values outside its enum'
);
select throws_ok(
  $$insert into public.kanban_items (project_id, title, macro_version) values ('11111111-1111-4111-8111-111111111111', 'Inválido', 'V4')$$,
  '23514'::character(5),
  null,
  'validation - macro_version rejects values outside V1, V2 and V3'
);
select throws_ok(
  $$insert into public.memberships (user_id, client_id, role) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '10000000-0000-4000-8000-000000000001', 'ADMIN')$$,
  '23514'::character(5),
  null,
  'validation - membership role accepts CLIENT only'
);

select * from finish();
rollback;
