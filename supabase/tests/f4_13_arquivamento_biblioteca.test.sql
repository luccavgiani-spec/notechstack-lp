begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('91000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'f413-admin@example.test', '{"role":"NO_ADMIN"}', '{}', now(), now()),
  ('91000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'f413-client@example.test', '{"role":"CLIENT"}', '{}', now(), now());
insert into public.clients (id, name, slug, email)
values ('92000000-0000-4000-8000-000000000001', 'Cliente F413', 'cliente-f413', 'f413-client@example.test');
insert into public.leads (id, nome, email)
values ('93000000-0000-4000-8000-000000000001', 'Lead F413', 'lead-f413@example.test');
insert into public.projects (id, client_id, lead_id, name, niche, lead_status, project_status, access_status, access_released_at, modules)
values
  ('94000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001', '93000000-0000-4000-8000-000000000001', 'Expirado reutilizável', 'saude', 'JANELA_DE_DECISAO', null, 'INICIAL_15_DIAS', now() - interval '16 days', '{"como_funciona":"ativo","prototipo":"ativo","etapas":"ativo","editor":"bloqueado","versoes":"bloqueado","marca":"bloqueado"}'),
  ('94000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000001', null, 'Concluído case', 'saas', 'CONVERTIDO', 'CONCLUIDO', 'ATIVO_ATE_FIM_DO_PROJETO', now(), '{"como_funciona":"ativo","prototipo":"ativo","etapas":"ativo","editor":"ativo","versoes":"ativo","marca":"ativo"}'),
  ('94000000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-000000000001', null, 'Concluído privado', 'servicos', 'CONVERTIDO', 'CONCLUIDO', 'ATIVO_ATE_FIM_DO_PROJETO', now(), '{"como_funciona":"ativo","prototipo":"ativo","etapas":"ativo","editor":"ativo","versoes":"ativo","marca":"ativo"}'),
  ('94000000-0000-4000-8000-000000000004', '92000000-0000-4000-8000-000000000001', null, 'Concluído confidencial', 'juridico', 'CONVERTIDO', 'CONCLUIDO', 'ATIVO_ATE_FIM_DO_PROJETO', now(), '{"como_funciona":"ativo","prototipo":"ativo","etapas":"ativo","editor":"ativo","versoes":"ativo","marca":"ativo"}'),
  ('94000000-0000-4000-8000-000000000005', '92000000-0000-4000-8000-000000000001', null, 'Projeto ativo', 'saas', 'CONVERTIDO', 'V1_PUBLICADA', 'ATIVO_ATE_FIM_DO_PROJETO', now(), '{"como_funciona":"ativo","prototipo":"ativo","etapas":"ativo","editor":"ativo","versoes":"ativo","marca":"ativo"}');
insert into public.memberships(client_id, user_id, role)
values ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002', 'CLIENT');
insert into public.roadmaps(project_id, answers, prototype_url, published_at)
values ('94000000-0000-4000-8000-000000000001', '{"origem":"teste"}', 'https://example.test/prototipo', now());
insert into public.project_versions(id, project_id, label, macro, status, changelog, build_reference, is_current, request_id)
values ('95000000-0000-4000-8000-000000000001', '94000000-0000-4000-8000-000000000001', 'V1', 'V1', 'publicada', 'Entrega', 'build-f413', true, 'f413-v1');
insert into public.kanban_items(project_id, title, status, position)
values ('94000000-0000-4000-8000-000000000001', 'Item preservado', 'concluido', 0);
truncate table public.activity_events restart identity;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"NO_ADMIN"}}', true);

select lives_ok($$select public.archive_project('94000000-0000-4000-8000-000000000001', '{"nicho":["saude"],"produto":["site"]}', true, false, false, 'f413-expired')$$, 'C1 expired decision-window project archives');
select is((select project_status from public.projects where id = '94000000-0000-4000-8000-000000000001'), 'ARQUIVADO'::public.project_status, 'C1 expired project receives archived status');
select ok((select archived_at is not null from public.projects where id = '94000000-0000-4000-8000-000000000001'), 'C1 archive timestamp persists');
select is((select count(*)::integer from public.activity_events where request_id = 'f413-expired' and type = 'project.archived'), 1, 'C1 archives with one activity event');
select is((select (public.archive_project('94000000-0000-4000-8000-000000000001', '{}'::jsonb, false, false, true, 'f413-expired')->>'replayed')::boolean), true, 'C1 replay returns the existing archive');
select ok((select snapshot ? 'project' and snapshot ? 'roadmap' and snapshot ? 'prototype' and snapshot ? 'versions' and snapshot ? 'files' from public.archive_assets where project_id = '94000000-0000-4000-8000-000000000001'), 'C5 snapshot contains every project aggregate');
select is((select snapshot #>> '{versions,0,label}' from public.archive_assets where project_id = '94000000-0000-4000-8000-000000000001'), 'V1', 'C5 snapshot preserves source version');
select is((select count(*)::integer from public.kanban_items where project_id = '94000000-0000-4000-8000-000000000001'), 1, 'C4 archive does not delete kanban history');
select is((select count(*)::integer from public.project_versions where project_id = '94000000-0000-4000-8000-000000000001'), 1, 'C4 archive does not delete version history');
reset role;
select throws_ok($$update public.archive_assets set tags = '{}'::jsonb where project_id = '94000000-0000-4000-8000-000000000001'$$, 'P0001', 'ARCHIVE_ASSET_IMMUTABLE', 'C5 archive snapshot cannot be changed');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"NO_ADMIN"}}', true);
select throws_ok($$select public.archive_project('94000000-0000-4000-8000-000000000005', '{}'::jsonb, false, false, true, 'f413-active')$$, 'PT409', 'PROJECT_ARCHIVE_NOT_ALLOWED', 'C3 active project returns the PostgREST 409 conflict code');
select is((select count(*)::integer from public.archive_assets where project_id = '94000000-0000-4000-8000-000000000005'), 0, 'C3 rejected archive creates no snapshot');
select lives_ok($$select public.archive_project('94000000-0000-4000-8000-000000000002', '{"nicho":["saas"]}', false, true, false, 'f413-case')$$, 'C2 completed project archives');
select lives_ok($$select public.archive_project('94000000-0000-4000-8000-000000000003', '{"nicho":["servicos"]}', false, false, false, 'f413-private')$$, 'C7 private project archives');
select lives_ok($$select public.archive_project('94000000-0000-4000-8000-000000000004', '{"nicho":["juridico"]}', true, true, true, 'f413-confidential')$$, 'C8 confidential project archives');
select is((select rights_label from public.list_archive_assets('{}'::jsonb, false, false) where project_id = '94000000-0000-4000-8000-000000000001'), 'REUTILIZÁVEL INTERNAMENTE', 'C7 internal reuse label is derived');
select is((select rights_label from public.list_archive_assets('{}'::jsonb, false, false) where project_id = '94000000-0000-4000-8000-000000000002'), 'AUTORIZADO PARA CASE', 'C7 case label is derived');
select is((select rights_label from public.list_archive_assets('{}'::jsonb, false, false) where project_id = '94000000-0000-4000-8000-000000000003'), 'PRIVADO / NÃO REUTILIZAR', 'C7 private label is derived');
select is((select count(*)::integer from public.list_archive_assets('{"nicho":["juridico"]}'::jsonb, false, false)), 0, 'C8 confidential asset is absent from library');
select is((select count(*)::integer from public.list_archive_assets('{}'::jsonb, true, false)), 2, 'C10 reusable filter excludes private assets');
select is((select count(*)::integer from public.list_archive_assets('{}'::jsonb, false, true)), 1, 'C10 case filter keeps only case-authorized assets');

select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"CLIENT"}}', true);
select is((select count(*)::integer from public.projects where id = '94000000-0000-4000-8000-000000000001'), 0, 'C1 archived project is no longer readable by CLIENT');
select is((select count(*)::integer from public.archive_assets), 0, 'C11 CLIENT cannot read archive assets');
select is((select count(*)::integer from public.list_archive_assets('{}'::jsonb, false, false)), 0, 'C11 CLIENT library RPC returns no assets');

reset role;
select * from finish();
rollback;
