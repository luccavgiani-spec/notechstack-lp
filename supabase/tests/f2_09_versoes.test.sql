begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('71000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'f209-admin@example.test', '{"role":"NO_ADMIN"}', '{}', now(), now()),
  ('71000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'f209-client@example.test', '{"role":"CLIENT"}', '{}', now(), now());

insert into public.clients (id, name, slug, email)
values ('72000000-0000-4000-8000-000000000001', 'Cliente F209', 'cliente-f209', 'f209-client@example.test');

insert into public.projects (
  id, client_id, name, niche, lead_status, project_status, access_status,
  access_released_at, modules, tier
) values
  ('73000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', 'Ciclo de versões', 'saas', 'CONVERTIDO', 'AGENDADO', 'ATIVO_ATE_FIM_DO_PROJETO', now(), '{"como_funciona":"ativo","prototipo":"ativo","etapas":"ativo","editor":"bloqueado","versoes":"bloqueado","marca":"ativo"}', 'basico'),
  ('73000000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000001', 'Intermediária', 'servicos', 'CONVERTIDO', 'V1_PUBLICADA', 'ATIVO_ATE_FIM_DO_PROJETO', now(), '{"como_funciona":"ativo","prototipo":"ativo","etapas":"ativo","editor":"ativo","versoes":"ativo","marca":"ativo"}', 'basico'),
  ('73000000-0000-4000-8000-000000000003', '72000000-0000-4000-8000-000000000001', 'V3 bloqueada', 'servicos', 'CONVERTIDO', 'V1_PUBLICADA', 'ATIVO_ATE_FIM_DO_PROJETO', now(), '{"como_funciona":"ativo","prototipo":"ativo","etapas":"ativo","editor":"ativo","versoes":"ativo","marca":"ativo"}', 'basico');

insert into public.memberships (client_id, user_id, role)
values ('72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000002', 'CLIENT');

insert into public.project_versions (
  id, project_id, label, macro, status, published_at, changelog, build_reference, is_current, request_id
) values (
  '74000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000002', 'V1', 'V1', 'publicada', now() - interval '2 days', 'V1 original', 'build-v1-original', true, 'f209-seed-v1'
);

truncate table public.activity_events restart identity;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"NO_ADMIN"}}', true);

-- C1: manual AGENDADO -> V1 development is atomic and emits one event.
select lives_ok($$select * from public.transition_project_status('73000000-0000-4000-8000-000000000001', 'V1_EM_DESENVOLVIMENTO', 'f209-c1-status')$$, 'C1 AGENDADO advances to V1 development');
select is((select project_status from public.projects where id = '73000000-0000-4000-8000-000000000001'), 'V1_EM_DESENVOLVIMENTO'::public.project_status, 'C1 status persisted');
select is((select count(*)::integer from public.activity_events where request_id = 'f209-c1-status'), 1, 'C1 emits one activity event');

-- C2: V1 publication atomically creates history, unlocks modules and audits once.
select lives_ok($$select public.publish_project_version('73000000-0000-4000-8000-000000000001', 'V1', 'V1', 'Primeira entrega', 'build-v1', 'f209-c2-publish')$$, 'C2 V1 publication accepted');
select is((select project_status from public.projects where id = '73000000-0000-4000-8000-000000000001'), 'V1_PUBLICADA'::public.project_status, 'C2 project becomes V1_PUBLICADA');
select is((select modules ->> 'editor' from public.projects where id = '73000000-0000-4000-8000-000000000001'), 'ativo', 'C2 editor unlocks');
select is((select modules ->> 'versoes' from public.projects where id = '73000000-0000-4000-8000-000000000001'), 'ativo', 'C2 versions unlocks');
select is((select count(*)::integer from public.project_versions where project_id = '73000000-0000-4000-8000-000000000001'), 1, 'C2 creates one version');
select is((select count(*)::integer from public.activity_events where request_id = 'f209-c2-publish'), 1, 'C2 emits one activity event');

-- C3/C7: invalid macro/state requests leave the aggregate unchanged.
select throws_ok($$select public.publish_project_version('73000000-0000-4000-8000-000000000001', 'V3', 'V3', 'Prematuro', 'build-v3', 'f209-c3-v3')$$, 'P0001', 'VERSION_STATE_NOT_ALLOWED', 'C3/C7 V3 before V2 is rejected');
select is((select count(*)::integer from public.project_versions where project_id = '73000000-0000-4000-8000-000000000001'), 1, 'C3 rejected publication creates no version');
select is((select count(*)::integer from public.activity_events where project_id = '73000000-0000-4000-8000-000000000001'), 2, 'C3 rejected publication emits no event');

-- C5/C9: intermediate publication preserves V1 historical fields and changes only current.
select lives_ok($$select public.publish_project_version('73000000-0000-4000-8000-000000000002', 'V1.1', 'V1', 'Ajustes', 'build-v1-1', 'f209-c5-intermediate')$$, 'C5 intermediate publication accepted');
select is((select is_current from public.project_versions where project_id = '73000000-0000-4000-8000-000000000002' and label = 'V1'), false, 'C5 V1 ceases to be current');
select is((select changelog from public.project_versions where project_id = '73000000-0000-4000-8000-000000000002' and label = 'V1'), 'V1 original', 'C9 V1 changelog is preserved');
select is((select build_reference from public.project_versions where project_id = '73000000-0000-4000-8000-000000000002' and label = 'V1'), 'build-v1-original', 'C9 V1 build reference is preserved');
select is((select count(*)::integer from public.project_versions where project_id = '73000000-0000-4000-8000-000000000002' and is_current), 1, 'C8 one current version remains');

-- C11: the three manual edges are accepted and audited once.
select lives_ok($$select * from public.transition_project_status('73000000-0000-4000-8000-000000000001', 'EM_REVISAO_CLIENTE', 'f209-c11-review')$$, 'C11 V1 published enters client review');
select lives_ok($$select * from public.transition_project_status('73000000-0000-4000-8000-000000000001', 'ALTERACOES_RECEBIDAS', 'f209-c11-feedback')$$, 'C11 client review receives feedback');
select lives_ok($$select * from public.transition_project_status('73000000-0000-4000-8000-000000000001', 'V2_EM_DESENVOLVIMENTO', 'f209-c11-v2-dev')$$, 'C11 feedback enters V2 development');
select is((select count(*)::integer from public.activity_events where request_id like 'f209-c11-%'), 3, 'C11 each manual edge emits one event');
select throws_ok($$select * from public.transition_project_status('73000000-0000-4000-8000-000000000001', 'V3_GO_LIVE', 'f209-c11-invalid')$$, 'P0001', 'PROJECT_TRANSITION_NOT_ALLOWED', 'C11 invalid edge is rejected');

-- C6: V2 keeps every earlier version and advances the macro state.
select lives_ok($$select public.publish_project_version('73000000-0000-4000-8000-000000000001', 'V2', 'V2', 'Segunda macro', 'build-v2', 'f209-c6-v2')$$, 'C6 V2 publication accepted');
select is((select project_status from public.projects where id = '73000000-0000-4000-8000-000000000001'), 'V2_PUBLICADA'::public.project_status, 'C6 project becomes V2_PUBLICADA');
select is((select count(*)::integer from public.project_versions where project_id = '73000000-0000-4000-8000-000000000001'), 2, 'C6 history keeps V1');

-- C7: V3 is the only go-live macro and C10 is the only completion edge.
select lives_ok($$select public.publish_project_version('73000000-0000-4000-8000-000000000001', 'V3', 'V3', 'Go-live', 'build-v3', 'f209-c7-v3')$$, 'C7 V3 publication accepted');
select is((select project_status from public.projects where id = '73000000-0000-4000-8000-000000000001'), 'V3_GO_LIVE'::public.project_status, 'C7 project becomes V3_GO_LIVE');
select lives_ok($$select * from public.transition_project_status('73000000-0000-4000-8000-000000000001', 'CONCLUIDO', 'f209-c10-complete')$$, 'C10 V3 can be completed');
select is((select project_status from public.projects where id = '73000000-0000-4000-8000-000000000001'), 'CONCLUIDO'::public.project_status, 'C10 project is completed');
select throws_ok($$select * from public.transition_project_status('73000000-0000-4000-8000-000000000002', 'CONCLUIDO', 'f209-c10-invalid')$$, 'P0001', 'PROJECT_TRANSITION_NOT_ALLOWED', 'C10 non-go-live completion is rejected');

-- C13: replay returns the original result and does not create another row/event.
select lives_ok($$select public.publish_project_version('73000000-0000-4000-8000-000000000002', 'V1.2', 'V1', 'Outro ajuste', 'build-v1-2', 'f209-c13-retry')$$, 'C13 first publication accepted');
select lives_ok($$select public.publish_project_version('73000000-0000-4000-8000-000000000002', 'V1.2', 'V1', 'Outro ajuste', 'build-v1-2', 'f209-c13-retry')$$, 'C13 replay accepted');
select is((select count(*)::integer from public.project_versions where project_id = '73000000-0000-4000-8000-000000000002' and label = 'V1.2'), 1, 'C13 replay keeps one version');
select is((select count(*)::integer from public.activity_events where request_id = 'f209-c13-retry'), 1, 'C13 replay keeps one event');
select throws_ok($$select public.publish_project_version('73000000-0000-4000-8000-000000000002', 'V1.3', 'V1', 'Conflito', 'build-conflict', 'f209-c13-retry')$$, 'P0001', 'REQUEST_ID_CONFLICT', 'C13 conflicting replay is rejected');

-- C4/C12/C14: client reads only after the module is active and cannot write.
select set_config('request.jwt.claims', '{"sub":"71000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"CLIENT"}}', true);
select is((select count(*)::integer from public.project_versions where project_id = '73000000-0000-4000-8000-000000000001'), 3, 'C4/C12 CLIENT sees unlocked version history');
select is((select label from public.project_versions where project_id = '73000000-0000-4000-8000-000000000001' order by published_at desc, created_at desc limit 1), 'V3', 'C12 history is readable newest-first');
select throws_ok($$select public.publish_project_version('73000000-0000-4000-8000-000000000001', 'V4', 'V3', 'Intruso', 'build', 'f209-c14-publish')$$, '42501', 'NO_ADMIN_REQUIRED', 'C14 CLIENT cannot publish');
select throws_ok($$select * from public.transition_project_status('73000000-0000-4000-8000-000000000001', 'ARQUIVADO', 'f209-c14-status')$$, '42501', 'NO_ADMIN_REQUIRED', 'C14 CLIENT cannot change state');
select throws_ok($$update public.project_versions set changelog = 'intruso' where project_id = '73000000-0000-4000-8000-000000000001'$$, '42501', null, 'C9 CLIENT cannot update version history');

reset role;
select * from finish();
rollback;
