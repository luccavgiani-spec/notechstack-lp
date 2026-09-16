begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('a1200000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'f312-admin@example.test', '{"role":"NO_ADMIN"}', '{}', now(), now()),
  ('a1200000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'f312-client@example.test', '{"role":"CLIENT"}', '{}', now(), now());
insert into public.clients (id, name, slug, email) values ('a2200000-0000-4000-8000-000000000001', 'Cliente F312', 'cliente-f312', 'f312-client@example.test');
insert into public.projects (id, client_id, name, lead_status, project_status, access_status, access_released_at, modules) values
  ('a3200000-0000-4000-8000-000000000001', 'a2200000-0000-4000-8000-000000000001', 'Projeto ativo', 'CONVERTIDO', 'V1_EM_DESENVOLVIMENTO', 'ATIVO_ATE_FIM_DO_PROJETO', now(), '{}'),
  ('a3200000-0000-4000-8000-000000000002', 'a2200000-0000-4000-8000-000000000001', 'Projeto arquivado', 'CONVERTIDO', 'ARQUIVADO', 'ATIVO_ATE_FIM_DO_PROJETO', now(), '{}');
insert into public.kanban_items(project_id, title, macro_version, status, scheduled_date, position) values
  ('a3200000-0000-4000-8000-000000000001', 'A fazer 1', 'V1', 'a_fazer', current_date, 1),
  ('a3200000-0000-4000-8000-000000000001', 'A fazer 2', 'V1', 'a_fazer', current_date, 2),
  ('a3200000-0000-4000-8000-000000000001', 'Concluído', 'V1', 'concluido', current_date, 3),
  ('a3200000-0000-4000-8000-000000000002', 'Não aparece', 'V1', 'a_fazer', current_date, 1);
truncate table public.activity_events restart identity;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1200000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"NO_ADMIN"}}', true);
select is((public.get_admin_schedule_settings()->>'dailyItemCapacity')::integer, 5, 'C5 capacity starts at five items per day');
select is((select count(*)::integer from public.list_admin_schedule_items(null, null, current_date, current_date)), 3, 'C1 active project items appear and archived project is excluded');
select is((select count(*)::integer from public.list_admin_schedule_items('a3200000-0000-4000-8000-000000000001', 'V1', current_date, current_date)), 3, 'C4 project and macro filters combine');
select is((public.set_admin_daily_item_capacity(3)->>'dailyItemCapacity')::integer, 3, 'C6 admin can adjust daily capacity');
select throws_ok($$select public.set_admin_daily_item_capacity(0)$$, '22023', 'DAILY_CAPACITY_INVALID', 'C6 invalid capacity is rejected');
select is((select count(*)::integer from public.activity_events), 0, 'C3 setup has no activity events');
select lives_ok($$select public.upsert_admin_kanban_item('a3200000-0000-4000-8000-000000000001', null, 'Criado no cronograma', null, 'V1', 'a_fazer', current_date, 4, 'f312-create')$$, 'C3 creates through the audited Kanban RPC');
select is((select count(*)::integer from public.activity_events where request_id = 'f312-create' and type = 'kanban_item.created'), 1, 'C3 create emits exactly one event');

select set_config('request.jwt.claims', '{"sub":"a1200000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"CLIENT"}}', true);
select is((select count(*)::integer from public.list_admin_schedule_items(null, null, null, null)), 0, 'C8 CLIENT gets zero schedule items');
select is(public.get_admin_schedule_settings(), null, 'C8 CLIENT gets no capacity settings');
select throws_ok($$select public.set_admin_daily_item_capacity(4)$$, '42501', 'NO_ADMIN_REQUIRED', 'C8 CLIENT cannot change capacity');
reset role;
select * from finish();
rollback;
