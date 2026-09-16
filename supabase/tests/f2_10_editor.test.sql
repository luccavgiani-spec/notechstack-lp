begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  ('f2100000-0000-4000-8000-000000000001','authenticated','authenticated','f2-client@example.test','{"role":"CLIENT"}','{}',now(),now()),
  ('f2100000-0000-4000-8000-000000000002','authenticated','authenticated','f2-admin@example.test','{"role":"NO_ADMIN"}','{}',now(),now());
insert into public.clients(id,name,slug,email) values ('f2200000-0000-4000-8000-000000000001','F2','f2','f2-client@example.test');
insert into public.projects(id,client_id,name,lead_status,project_status,access_status,access_released_at,modules)
values ('f2300000-0000-4000-8000-000000000001','f2200000-0000-4000-8000-000000000001','F2','CONVERTIDO','V1_PUBLICADA','ATIVO_ATE_FIM_DO_PROJETO',now(),'{"editor":"ativo","versoes":"ativo"}');
insert into public.memberships(client_id,user_id,role) values ('f2200000-0000-4000-8000-000000000001','f2100000-0000-4000-8000-000000000001','CLIENT');
insert into public.project_versions(id,project_id,label,macro,status,changelog,build_reference,is_current,published_at,created_at)
values ('f2400000-0000-4000-8000-000000000001','f2300000-0000-4000-8000-000000000001','V1','V1','publicada','Primeira entrega','build-fixed',true,now() - interval '2 days',now() - interval '2 days');
insert into public.editor_version_configs(version_id,allowed_components,bridge_enabled)
values ('f2400000-0000-4000-8000-000000000001','[{"id":"hero","screen":"home","controls":["text","size","color","logo"]},{"id":"cta","screen":"home","controls":["text"]}]',true);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f2100000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"CLIENT"}}',true);
select is((public.get_client_editor_config('f2300000-0000-4000-8000-000000000001')->>'buildReference'),'build-fixed','C2/C3 config exposes the immutable build reference');
select is((jsonb_array_length(public.get_client_editor_config('f2300000-0000-4000-8000-000000000001')->'allowedComponents')),2,'C2 config exposes only the allowlist');
select lives_ok($$select public.submit_client_editor_export(
  'f2300000-0000-4000-8000-000000000001','f2400000-0000-4000-8000-000000000001',
  '[{"screen":"home","component":"hero","before":{"text":"A"},"after":{"text":"B"}},{"screen":"home","component":"cta","before":{},"after":{"text":"Comprar"}}]',
  '{"schema_version":1,"files":["editor.md","editor.cfg","editor.css","manifest.json"]}','f210-export-1')$$,'C4 valid four-file manifest is accepted');
select is((public.submit_client_editor_export(
  'f2300000-0000-4000-8000-000000000001','f2400000-0000-4000-8000-000000000001',
  '[{"screen":"home","component":"hero","before":{"text":"A"},"after":{"text":"B"}},{"screen":"home","component":"cta","before":{},"after":{"text":"Comprar"}}]',
  '{}','f210-export-1')->>'replayed')::boolean,true,'C5 request replay returns the original export');
select is((public.submit_client_editor_export(
  'f2300000-0000-4000-8000-000000000001','f2400000-0000-4000-8000-000000000001',
  '[{"screen":"home","component":"hero","before":{"text":"A"},"after":{"text":"B"}},{"screen":"home","component":"cta","before":{},"after":{"text":"Comprar"}}]',
  '{}','f210-export-content-retry')->>'contentReplay')::boolean,true,'C5 equal content with another request is idempotent');
select throws_ok($$select public.submit_client_editor_export(
  'f2300000-0000-4000-8000-000000000001','f2400000-0000-4000-8000-000000000001',
  '[{"component":"hero","after":{"text":"different"}}]','{}','f210-export-1')$$,'PT409','EDITOR_REQUEST_CONFLICT','C5 reused request with different content is rejected');
select throws_ok($$select public.submit_client_editor_export(
  'f2300000-0000-4000-8000-000000000001','f2400000-0000-4000-8000-000000000001',
  '[{"component":"footer","after":{"text":"intruso"}}]','{}','f210-disallowed')$$,'22023','EDITOR_COMPONENT_NOT_ALLOWED','C2 non-allowlisted component is rejected');
select throws_ok($$select public.submit_client_editor_export(
  'f2300000-0000-4000-8000-000000000001','f2400000-0000-4000-8000-000000000001',null,'{}','null-changes')$$,
  '22023','EDITOR_EXPORT_INVALID','security: null changes are rejected');
select throws_ok($$select public.finalize_client_editor_export((select (public.submit_client_editor_export(
  'f2300000-0000-4000-8000-000000000001','f2400000-0000-4000-8000-000000000001',
  '[{"screen":"home","component":"hero","before":{"text":"A"},"after":{"text":"B"}},{"screen":"home","component":"cta","before":{},"after":{"text":"Comprar"}}]',
  '{}','f210-export-1')->>'exportId')::uuid))$$,'PT409','EDITOR_FILES_INCOMPLETE','security: incomplete Storage package cannot be finalized');
reset role;

insert into storage.objects(bucket_id,name)
select 'editor-exports', export.project_id::text || '/' || export.content_sha256 || '/' || filename
from public.editor_exports export cross join unnest(array['editor.md','editor.cfg','editor.css','manifest.json']) filename;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f2100000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"CLIENT"}}',true);
select lives_ok($$select public.finalize_client_editor_export((public.submit_client_editor_export(
  'f2300000-0000-4000-8000-000000000001','f2400000-0000-4000-8000-000000000001',
  '[{"screen":"home","component":"hero","before":{"text":"A"},"after":{"text":"B"}},{"screen":"home","component":"cta","before":{},"after":{"text":"Comprar"}}]',
  '{}','f210-export-1')->>'exportId')::uuid)$$,'Storage: four files finalize the package');
select is(public.can_access_editor_export_file('invalid/path/file'),false,'Storage: malformed path is denied without a cast error');
select is(public.can_access_editor_export_file('f2300000-0000-4000-8000-000000000002/unknown/editor.cfg'),false,'Storage: another tenant path is denied');
select throws_ok($$select public.submit_client_editor_export(
  'f2300000-0000-4000-8000-000000000001','f2400000-0000-4000-8000-000000000001',
  '[{"component":"cta","after":{"color":"#ffffff"}}]','{}','disallowed-control')$$,
  '22023','EDITOR_VALUES_INVALID','security: disallowed control cannot bypass the UI');
select throws_ok($$select public.submit_client_editor_export(
  'f2300000-0000-4000-8000-000000000001','f2400000-0000-4000-8000-000000000001',
  '[{"component":"hero","after":{"logo":"javascript:alert(1)"}}]','{}','unsafe-logo')$$,
  '22023','EDITOR_VALUES_INVALID','security: unsafe logo URL is rejected');
reset role;
-- Explicit order avoids depending on now() ties within this transaction.
update public.editor_exports set created_at = now() - interval '1 minute';

select is((select count(*)::integer from public.editor_exports),1,'C5 one export exists for equal content');
select is((select count(*)::integer from public.editor_export_checklists),1,'C5 one checklist exists for equal content');
select is((select jsonb_array_length(items) from public.editor_export_checklists),2,'C7 checklist is grouped by screen and component');
select is((select build_reference from public.project_versions where id='f2400000-0000-4000-8000-000000000001'),'build-fixed','C3 exports never mutate the build reference');

update public.project_versions set is_current=false where id='f2400000-0000-4000-8000-000000000001';
insert into public.project_versions(id,project_id,label,macro,status,changelog,build_reference,is_current,published_at,created_at)
values ('f2400000-0000-4000-8000-000000000002','f2300000-0000-4000-8000-000000000001','V1.1','V1','intermediaria','Ajustes','build-v1-1',true,now(),now());

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f2100000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"CLIENT"}}',true);
select is((public.submit_client_editor_export(
  'f2300000-0000-4000-8000-000000000001','f2400000-0000-4000-8000-000000000001',
  '[{"screen":"home","component":"hero","before":{"text":"B"},"after":{"text":"C"}}]','{}','f210-stale')->>'conflict')::boolean,true,'C6 stale base is accepted and marked as conflict');
reset role;

update public.projects set project_status='EM_REVISAO_CLIENTE' where id='f2300000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f2100000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"NO_ADMIN"}}',true);
select is(jsonb_array_length(public.list_admin_editor_exports('f2300000-0000-4000-8000-000000000001')),2,'C7 admin lists both exports and checklists');
select throws_ok($$select public.ingest_editor_export((public.list_admin_editor_exports('f2300000-0000-4000-8000-000000000001')->0->>'id')::uuid,'incomplete-ingest')$$,
  'PT409','EDITOR_FILES_INCOMPLETE','security: admin cannot ingest an incomplete package');
select is((public.ingest_editor_export((public.list_admin_editor_exports('f2300000-0000-4000-8000-000000000001')->1->>'id')::uuid,'f210-ingest')->>'items')::integer,2,'C7 ingest creates one item per group');
select is((select count(*)::integer from public.kanban_items where project_id='f2300000-0000-4000-8000-000000000001' and phase='Editor'),2,'C7 two grouped Kanban items were created');
select is((select project_status from public.projects where id='f2300000-0000-4000-8000-000000000001'),'ALTERACOES_RECEBIDAS'::public.project_status,'C8 ingest advances the project');
select is((select count(*)::integer from public.activity_events where request_id='f210-ingest'),1,'C8 ingest emits one activity event');
select is((public.ingest_editor_export((public.list_admin_editor_exports('f2300000-0000-4000-8000-000000000001')->1->>'id')::uuid,'f210-ingest')->>'replayed')::boolean,true,'C8 ingest request replay is safe');
select throws_ok($$select public.ingest_editor_export((public.list_admin_editor_exports('f2300000-0000-4000-8000-000000000001')->0->>'id')::uuid,'f210-ingest')$$,
  'PT409','EDITOR_REQUEST_CONFLICT','security: ingestion replay cannot target another export');
select lives_ok($$select public.associate_editor_checklist_version(
  (public.list_admin_editor_exports('f2300000-0000-4000-8000-000000000001')->1->'checklist'->>'id')::uuid,
  'f2400000-0000-4000-8000-000000000002','f210-associate')$$,'C9 ingested checklist associates to the next version');
select is((select count(*)::integer from public.activity_events where request_id='f210-associate'),1,'C9 association emits one activity event');
select throws_ok($$select public.associate_editor_checklist_version(
  (public.list_admin_editor_exports('f2300000-0000-4000-8000-000000000001')->1->'checklist'->>'id')::uuid,
  'f2400000-0000-4000-8000-000000000001','f210-associate')$$,
  'PT409','EDITOR_REQUEST_CONFLICT','security: association replay cannot target another version');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"f2100000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"CLIENT"}}',true);
select is((public.list_client_version_checklists('f2300000-0000-4000-8000-000000000001')->0->>'versionId'),'f2400000-0000-4000-8000-000000000002','C9 client version history receives the linked checklist');
select throws_ok($$select count(*) from public.editor_exports$$,'42501',null,'security: client cannot read raw exports');
select throws_ok($$select public.list_admin_editor_exports('f2300000-0000-4000-8000-000000000001')$$,
  '42501','NO_ADMIN_REQUIRED','security: client cannot use administrative exports RPC');
reset role;

select is((select public from storage.buckets where id='editor-exports'),false,'security: export bucket stays private');
select is((select count(*)::integer from pg_policies where schemaname='storage' and tablename='objects' and policyname='editor_exports_client_upload'),1,'security: authenticated upload policy exists');
select * from finish();
rollback;
