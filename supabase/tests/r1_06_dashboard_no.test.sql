begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

-- The fixture is deliberately self-contained and rolls back. It covers the SQL
-- boundary without depending on the browser fixture or on demo accounts.
insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('61000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'r106-admin@example.test', '{"role":"NO_ADMIN"}', '{}', now(), now()),
  ('61000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'r106-client@example.test', '{"role":"CLIENT"}', '{}', now(), now());

insert into public.clients (id, name, slug, email) values
  ('62000000-0000-4000-8000-000000000001', 'Cliente R106', 'cliente-r106', 'r106-client@example.test');

insert into public.projects (id, client_id, name, niche, lead_status, project_status, access_status, access_released_at, modules, tier) values
  ('63000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001', 'Lead em roadmap', 'servicos', 'ROADMAP_PAGO', null, 'ATIVO_ATE_FIM_DO_PROJETO', now(), '{"como_funciona":"ativo","prototipo":"ativo","etapas":"ativo","editor":"bloqueado","versoes":"bloqueado","marca":"bloqueado"}', null),
  ('63000000-0000-4000-8000-000000000002', '62000000-0000-4000-8000-000000000001', 'Lead com referencias', 'servicos', 'REFERENCIAS_PENDENTES', null, 'ATIVO_ATE_FIM_DO_PROJETO', now(), '{"como_funciona":"ativo","prototipo":"ativo","etapas":"ativo","editor":"bloqueado","versoes":"bloqueado","marca":"bloqueado"}', null),
  ('63000000-0000-4000-8000-000000000003', '62000000-0000-4000-8000-000000000001', 'Janela para converter', 'saas', 'JANELA_DE_DECISAO', null, 'INICIAL_15_DIAS', now(), '{"como_funciona":"ativo","prototipo":"ativo","etapas":"ativo","editor":"bloqueado","versoes":"bloqueado","marca":"bloqueado"}', null),
  ('63000000-0000-4000-8000-000000000004', '62000000-0000-4000-8000-000000000001', 'Projeto convertido', 'saas', 'CONVERTIDO', 'CONVERTIDO', 'ATIVO_ATE_FIM_DO_PROJETO', now(), '{"como_funciona":"ativo","prototipo":"ativo","etapas":"ativo","editor":"bloqueado","versoes":"bloqueado","marca":"ativo"}', 'basico');

insert into public.memberships (client_id, user_id, role) values
  ('62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000002', 'CLIENT');

insert into public.kanban_items (id, project_id, title, phase, macro_version, status, scheduled_date, position) values
  ('64000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000001', 'Item R106', 'descoberta', 'V1', 'a_fazer', current_date, 1);

-- Seed writes fire the R1-01 audit trigger. The assertions below measure only
-- the administrative actions under test.
truncate table public.activity_events restart identity;

insert into public.commercial_terms (project_id, tier, amount_cents, payment_method, installments, deadline_days)
values ('63000000-0000-4000-8000-000000000001', 'basico', 100000, 'pix', 1, 15);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"61000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"NO_ADMIN"}}',
  true
);

-- C4: one commercial field change persists and records before/after once.
select lives_ok(
  $$select * from public.update_commercial_terms('63000000-0000-4000-8000-000000000001', 'basico', 125000, 'pix', 1, 15, null, null, null, 'r106-commercial-1')$$,
  'C4 commercial edit is accepted'
);
select is((select amount_cents from public.commercial_terms where project_id = '63000000-0000-4000-8000-000000000001'), 125000, 'C4 commercial amount persists');
select is((select count(*)::integer from public.activity_events where project_id = '63000000-0000-4000-8000-000000000001'), 1, 'C4 commercial edit emits exactly one event');
select is((select actor_id from public.activity_events where project_id = '63000000-0000-4000-8000-000000000001'), '61000000-0000-4000-8000-000000000001'::uuid, 'C4 event identifies the NO_ADMIN actor');
select is((select payload ->> 'campo' from public.activity_events where project_id = '63000000-0000-4000-8000-000000000001'), 'amount_cents', 'C4 event identifies the changed field');
select is((select payload ->> 'antes' from public.activity_events where project_id = '63000000-0000-4000-8000-000000000001'), '100000', 'C4 event contains the old value');
select is((select payload ->> 'depois' from public.activity_events where project_id = '63000000-0000-4000-8000-000000000001'), '125000', 'C4 event contains the new value');

-- C5: only the two approved lead transitions are accepted and audited.
select lives_ok($$select * from public.transition_project_lead('63000000-0000-4000-8000-000000000001', 'REFERENCIAS_PENDENTES', 'r106-lead-1')$$, 'C5 ROADMAP_PAGO transition is accepted');
select is((select lead_status from public.projects where id = '63000000-0000-4000-8000-000000000001'), 'REFERENCIAS_PENDENTES'::public.lead_status, 'C5 first lead transition persists');
select is((select count(*)::integer from public.activity_events where request_id = 'r106-lead-1'), 1, 'C5 first lead transition emits one event');
select lives_ok($$select * from public.transition_project_lead('63000000-0000-4000-8000-000000000002', 'EM_PRODUCAO', 'r106-lead-2')$$, 'C5 REFERENCIAS_PENDENTES transition is accepted');
select is((select lead_status from public.projects where id = '63000000-0000-4000-8000-000000000002'), 'EM_PRODUCAO'::public.lead_status, 'C5 second lead transition persists');
select is((select count(*)::integer from public.activity_events where request_id in ('r106-lead-1', 'r106-lead-2')), 2, 'C5 each lead transition emits one event');

-- C6/C8: create, move, complete, reopen, date and position each produce one
-- attributed event; completion and reopen keep completed_at coherent.
select lives_ok($$select * from public.upsert_admin_kanban_item('63000000-0000-4000-8000-000000000001', null, 'Novo item', 'descoberta', 'V1', 'a_fazer', current_date, 2, 'r106-kanban-create')$$, 'C6 create kanban action is accepted');
select is((select count(*)::integer from public.activity_events where request_id = 'r106-kanban-create'), 1, 'C6 create emits one event');
select lives_ok($$select * from public.upsert_admin_kanban_item('63000000-0000-4000-8000-000000000001', '64000000-0000-4000-8000-000000000001', null, null, null, 'em_andamento', current_date, 1, 'r106-kanban-move')$$, 'C6 move kanban action is accepted');
select lives_ok($$select * from public.upsert_admin_kanban_item('63000000-0000-4000-8000-000000000001', '64000000-0000-4000-8000-000000000001', null, null, null, 'concluido', current_date, 1, 'r106-kanban-complete')$$, 'C6 complete kanban action is accepted');
select is((select completed_at is not null from public.kanban_items where id = '64000000-0000-4000-8000-000000000001'), true, 'C8 completion stores completed_at');
select lives_ok($$select * from public.upsert_admin_kanban_item('63000000-0000-4000-8000-000000000001', '64000000-0000-4000-8000-000000000001', null, null, null, 'a_fazer', current_date, 1, 'r106-kanban-reopen')$$, 'C6 reopen kanban action is accepted');
select is((select status from public.kanban_items where id = '64000000-0000-4000-8000-000000000001'), 'a_fazer'::public.kanban_status, 'C8 reopen returns item to a_fazer');
select is((select completed_at is null from public.kanban_items where id = '64000000-0000-4000-8000-000000000001'), true, 'C8 reopen clears completed_at');
select lives_ok($$select * from public.upsert_admin_kanban_item('63000000-0000-4000-8000-000000000001', '64000000-0000-4000-8000-000000000001', null, null, null, null, current_date + 2, 1, 'r106-kanban-date')$$, 'C6 scheduled date action is accepted');
select lives_ok($$select * from public.upsert_admin_kanban_item('63000000-0000-4000-8000-000000000001', '64000000-0000-4000-8000-000000000001', null, null, null, null, current_date + 2, 7, 'r106-kanban-position')$$, 'C6 position action is accepted');
select is((select count(*)::integer from public.activity_events where request_id like 'r106-kanban-%'), 6, 'C6 six kanban actions emit exactly six events');
select is((select count(*)::integer from public.activity_events where request_id like 'r106-kanban-%' and actor_id = '61000000-0000-4000-8000-000000000001' and project_id = '63000000-0000-4000-8000-000000000001' and occurred_at is not null), 6, 'C6 every kanban event is attributed');

-- C7: a CLIENT can read the moved item in the next request but cannot mutate it.
select set_config('request.jwt.claims', '{"sub":"61000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"CLIENT"}}', true);
select is((select status from public.kanban_items where id = '64000000-0000-4000-8000-000000000001'), 'a_fazer'::public.kanban_status, 'C7 CLIENT reads the administrator move');
select throws_ok($$select * from public.upsert_admin_kanban_item('63000000-0000-4000-8000-000000000001', '64000000-0000-4000-8000-000000000001', 'intruso', null, null, 'concluido', current_date, 9, 'r106-client-kanban')$$, '42501', 'NO_ADMIN_REQUIRED', 'C7 CLIENT cannot mutate Kanban');

-- C13/C14 and C19 under the authorized actor.
select set_config('request.jwt.claims', '{"sub":"61000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"NO_ADMIN"}}', true);
select lives_ok($$select public.activate_brand_module('63000000-0000-4000-8000-000000000001', 'r106-brand-1')$$, 'C13 manual brand activation is accepted');
select is((select modules ->> 'marca' from public.projects where id = '63000000-0000-4000-8000-000000000001'), 'ativo', 'C13 marca module is active');
select is((select count(*)::integer from public.activity_events where request_id = 'r106-brand-1'), 1, 'C13 activation emits one event');
select lives_ok($$select * from public.transition_project_status('63000000-0000-4000-8000-000000000004', 'AGENDADO', 'r106-status-1')$$, 'C14 CONVERTIDO to AGENDADO is accepted');
select is((select project_status from public.projects where id = '63000000-0000-4000-8000-000000000004'), 'AGENDADO'::public.project_status, 'C14 allowed project transition persists');
select throws_ok($$select * from public.transition_project_status('63000000-0000-4000-8000-000000000004', 'V1_PUBLICADA', 'r106-status-invalid')$$, 'P0001', 'PROJECT_TRANSITION_NOT_ALLOWED', 'C14 invalid project transition is rejected');

select lives_ok($$select * from public.activate_brand_module('63000000-0000-4000-8000-000000000001', 'r106-idempotent')$$, 'C19 first idempotent action is accepted');
select is((select count(*)::integer from public.activity_events where request_id = 'r106-idempotent'), 1, 'C19 first idempotent action emits one event');
select lives_ok($$select * from public.activate_brand_module('63000000-0000-4000-8000-000000000001', 'r106-idempotent')$$, 'C19 replay is accepted');
select is((select count(*)::integer from public.activity_events where request_id = 'r106-idempotent'), 1, 'C19 replay keeps one event');

-- C20: both mutation boundaries reject CLIENT before touching state.
select set_config('request.jwt.claims', '{"sub":"61000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"CLIENT"}}', true);
select throws_ok($$select * from public.transition_project_status('63000000-0000-4000-8000-000000000004', 'AGENDADO', 'r106-client-status')$$, '42501', 'NO_ADMIN_REQUIRED', 'C20 CLIENT cannot transition project status');
select throws_ok($$select * from public.convert_project('63000000-0000-4000-8000-000000000003', 'basico', 125000, 'pix', 1, 15, 'r106-client-convert', '61000000-0000-4000-8000-000000000002')$$, '42501', 'NO_ADMIN_REQUIRED', 'C20 CLIENT cannot convert project');
select is((select lead_status from public.projects where id = '63000000-0000-4000-8000-000000000003'), 'JANELA_DE_DECISAO'::public.lead_status, 'C20 unauthorized conversion leaves project unchanged');
select is((select count(*)::integer from public.activity_events where request_id in ('r106-client-status', 'r106-client-convert')), 0, 'C20 unauthorized mutations emit no activity');

reset role;
select * from finish();
rollback;
