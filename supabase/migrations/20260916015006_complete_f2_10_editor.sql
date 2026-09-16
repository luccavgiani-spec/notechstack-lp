-- F2-10 completion: content idempotency, persisted grouped checklists,
-- administrative read/ingest/association, and CLIENT version linkage.

alter table public.editor_exports
  add column content_sha256 text,
  add column files_ready_at timestamptz;

alter table public.editor_export_checklists
  add column items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  add column ingested_at timestamptz,
  add column associated_at timestamptz;

create or replace function public.editor_export_content_hash(
  p_base_version_id uuid,
  p_changes jsonb
)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(p_base_version_id::text || ':' || coalesce(p_changes, '[]'::jsonb)::text, 'sha256'), 'hex');
$$;

create or replace function public.editor_group_changes(p_changes jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'screen', grouped.screen,
      'component', grouped.component,
      'changes', grouped.changes
    ) order by grouped.first_position
  ), '[]'::jsonb)
  from (
    select
      coalesce(nullif(trim(change.value ->> 'screen'), ''), 'geral') as screen,
      change.value ->> 'component' as component,
      min(change.position) as first_position,
      jsonb_agg(jsonb_build_object(
        'before', coalesce(change.value -> 'before', '{}'::jsonb),
        'after', coalesce(change.value -> 'after', '{}'::jsonb)
      ) order by change.position) as changes
    from jsonb_array_elements(coalesce(p_changes, '[]'::jsonb)) with ordinality as change(value, position)
    group by coalesce(nullif(trim(change.value ->> 'screen'), ''), 'geral'), change.value ->> 'component'
  ) grouped;
$$;

update public.editor_exports
set content_sha256 = public.editor_export_content_hash(base_version_id, changes),
    manifest = manifest || jsonb_build_object(
      'content_sha256', public.editor_export_content_hash(base_version_id, changes)
    );

alter table public.editor_exports
  alter column content_sha256 set not null;

create unique index editor_exports_project_content_idx
  on public.editor_exports(project_id, content_sha256);

update public.editor_export_checklists checklist
set items = public.editor_group_changes(export.changes)
from public.editor_exports export
where export.id = checklist.export_id;

create or replace function public.editor_export_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(jsonb_typeof(new.changes), '') <> 'array' or jsonb_array_length(new.changes) = 0 then
    raise exception using errcode = '22023', message = 'EDITOR_EXPORT_INVALID';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(new.changes) change
    where nullif(trim(change ->> 'component'), '') is null
      or not exists (
        select 1
        from public.editor_version_configs config,
          jsonb_array_elements(config.allowed_components) allowed
        where config.version_id = new.base_version_id
          and allowed ->> 'id' = change ->> 'component'
      )
  ) then
    raise exception using errcode = '22023', message = 'EDITOR_COMPONENT_NOT_ALLOWED';
  end if;
  if exists (
    select 1 from jsonb_array_elements(new.changes) change
    where coalesce(jsonb_typeof(change -> 'after'), '') <> 'object'
  ) then raise exception using errcode = '22023', message = 'EDITOR_VALUES_INVALID'; end if;
  if exists (
    select 1 from jsonb_array_elements(new.changes) change
    cross join lateral jsonb_each(change -> 'after') field
    where jsonb_typeof(field.value) <> 'string'
      or field.key not in ('text','size','color','logo')
      or not exists (
        select 1 from public.editor_version_configs config
        cross join lateral jsonb_array_elements(config.allowed_components) allowed
        where config.version_id = new.base_version_id and allowed ->> 'id' = change ->> 'component'
        and coalesce(allowed -> 'controls','["text","size","color","logo"]'::jsonb) ? field.key
      )
      or (field.key = 'color' and field.value #>> '{}' !~ '^#[0-9a-fA-F]{6}$')
      or (field.key = 'size' and field.value #>> '{}' !~ '^([8-9]|[1-9][0-9]|1[0-5][0-9]|160)(\.[0-9]+)?$')
      or (field.key = 'logo' and field.value #>> '{}' <> '' and field.value #>> '{}' !~ '^https://[^[:space:]]+$')
  ) then raise exception using errcode = '22023', message = 'EDITOR_VALUES_INVALID'; end if;
  new.content_sha256 := public.editor_export_content_hash(new.base_version_id, new.changes);
  new.manifest := new.manifest || jsonb_build_object('content_sha256', new.content_sha256);
  return new;
end;
$$;

create or replace function public.submit_client_editor_export(
  p_project_id uuid,
  p_base_version_id uuid,
  p_changes jsonb,
  p_manifest jsonb,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_export public.editor_exports%rowtype;
  v_version public.project_versions%rowtype;
  v_conflict boolean;
  v_hash text;
begin
  if not public.can_read_project(p_project_id, 'editor') then
    raise exception using errcode = '42501', message = 'EDITOR_ACCESS_DENIED';
  end if;
  if coalesce(jsonb_typeof(p_changes), '') <> 'array'
    or jsonb_array_length(p_changes) = 0
    or nullif(trim(coalesce(p_request_id, '')), '') is null
    or jsonb_typeof(coalesce(p_manifest, '{}'::jsonb)) <> 'object' then
    raise exception using errcode = '22023', message = 'EDITOR_EXPORT_INVALID';
  end if;

  -- Serialize submissions and publication for this project, including retries.
  perform 1 from public.projects where id = p_project_id for update;

  select * into v_version
  from public.project_versions
  where id = p_base_version_id and project_id = p_project_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'EDITOR_VERSION_NOT_FOUND';
  end if;
  v_hash := public.editor_export_content_hash(p_base_version_id, p_changes);

  select * into v_export from public.editor_exports where request_id = p_request_id;
  if found then
    if v_export.project_id <> p_project_id
      or v_export.base_version_id <> p_base_version_id
      or v_export.content_sha256 <> v_hash then
      raise exception using errcode = 'PT409', message = 'EDITOR_REQUEST_CONFLICT';
    end if;
    return jsonb_build_object(
      'exportId', v_export.id,
      'replayed', true,
      'contentReplay', false,
      'conflict', coalesce((v_export.manifest ->> 'conflict')::boolean, false),
      'contentSha256', v_export.content_sha256
    );
  end if;

  select * into v_export
  from public.editor_exports
  where project_id = p_project_id and content_sha256 = v_hash;
  if found then
    return jsonb_build_object(
      'exportId', v_export.id,
      'replayed', true,
      'contentReplay', true,
      'conflict', coalesce((v_export.manifest ->> 'conflict')::boolean, false),
      'contentSha256', v_export.content_sha256
    );
  end if;

  select exists (
    select 1 from public.project_versions
    where project_id = p_project_id and is_current and id <> p_base_version_id
  ) into v_conflict;

  insert into public.editor_exports(
    project_id, base_version_id, changes, manifest, request_id, created_by, content_sha256
  ) values (
    p_project_id,
    p_base_version_id,
    p_changes,
    coalesce(p_manifest, '{}'::jsonb) || jsonb_build_object(
      'project_id', p_project_id,
      'base_version_label', v_version.label,
      'changes', p_changes,
      'conflict', v_conflict,
      'content_sha256', v_hash
    ),
    p_request_id,
    auth.uid(),
    v_hash
  )
  on conflict (project_id, content_sha256) do nothing
  returning * into v_export;

  if v_export.id is null then
    select * into v_export
    from public.editor_exports
    where project_id = p_project_id and content_sha256 = v_hash;
    return jsonb_build_object(
      'exportId', v_export.id,
      'replayed', true,
      'contentReplay', true,
      'conflict', coalesce((v_export.manifest ->> 'conflict')::boolean, false),
      'contentSha256', v_export.content_sha256
    );
  end if;

  insert into public.editor_export_checklists(export_id, items)
  values(v_export.id, public.editor_group_changes(p_changes));
  return jsonb_build_object(
    'exportId', v_export.id,
    'replayed', false,
    'contentReplay', false,
    'conflict', v_conflict,
    'contentSha256', v_export.content_sha256
  );
end;
$$;

create or replace function public.list_admin_editor_exports(p_project_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform public.r1_06_require_admin();
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', export.id,
    'projectId', export.project_id,
    'baseVersionId', export.base_version_id,
    'baseVersionLabel', base.label,
    'contentSha256', export.content_sha256,
    'filesReadyAt', export.files_ready_at,
    'changes', export.changes,
    'manifest', export.manifest,
    'conflict', coalesce((export.manifest ->> 'conflict')::boolean, false),
    'createdAt', export.created_at,
    'checklist', jsonb_build_object(
      'id', checklist.id,
      'status', checklist.status,
      'items', checklist.items,
      'versionId', checklist.version_id,
      'versionLabel', linked.label,
      'ingestedAt', checklist.ingested_at,
      'associatedAt', checklist.associated_at
    )
  ) order by export.created_at desc), '[]'::jsonb)
  into v_result
  from public.editor_exports export
  join public.project_versions base on base.id = export.base_version_id
  join public.editor_export_checklists checklist on checklist.export_id = export.id
  left join public.project_versions linked on linked.id = checklist.version_id
  where export.project_id = p_project_id;
  return v_result;
end;
$$;

create or replace function public.list_client_version_checklists(p_project_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.can_read_project(p_project_id, 'versoes') then
    return '[]'::jsonb;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', checklist.id,
    'versionId', checklist.version_id,
    'status', checklist.status,
    'items', checklist.items,
    'baseVersionLabel', base.label
  ) order by checklist.associated_at, checklist.created_at), '[]'::jsonb)
  into v_result
  from public.editor_export_checklists checklist
  join public.editor_exports export on export.id = checklist.export_id
  join public.project_versions base on base.id = export.base_version_id
  where export.project_id = p_project_id and checklist.version_id is not null;
  return v_result;
end;
$$;

create or replace function public.ingest_editor_export(p_export_id uuid, p_request_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_export public.editor_exports%rowtype;
  v_checklist public.editor_export_checklists%rowtype;
  v_item jsonb;
  v_count integer := 0;
  v_position integer;
  v_macro text;
  v_old_skip text;
begin
  perform public.r1_06_require_admin();
  if nullif(trim(coalesce(p_request_id, '')), '') is null then
    raise exception using errcode = '22023', message = 'EDITOR_REQUEST_ID_REQUIRED';
  end if;
  select * into v_export from public.editor_exports where id = p_export_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'EDITOR_EXPORT_NOT_FOUND';
  end if;
  if public.r1_06_is_replay(p_request_id, v_export.project_id, 'editor.export_ingested') then
    if not exists (select 1 from public.activity_events where request_id = p_request_id
      and payload ->> 'export_id' = p_export_id::text) then
      raise exception using errcode = 'PT409', message = 'EDITOR_REQUEST_CONFLICT';
    end if;
    return jsonb_build_object('replayed', true);
  end if;
  select * into v_checklist
  from public.editor_export_checklists
  where export_id = v_export.id
  for update;
  if v_checklist.status = 'ingerido' then
    return jsonb_build_object('replayed', true, 'checklistId', v_checklist.id);
  end if;
  perform 1 from public.projects where id = v_export.project_id for update;
  if v_export.files_ready_at is null then
    raise exception using errcode = 'PT409', message = 'EDITOR_FILES_INCOMPLETE';
  end if;
  if (select project_status from public.projects where id = v_export.project_id)
    <> 'EM_REVISAO_CLIENTE'::public.project_status then
    raise exception using errcode = 'PT409', message = 'EDITOR_INGEST_NOT_ALLOWED';
  end if;

  select coalesce(max(position), -1) + 1 into v_position
  from public.kanban_items where project_id = v_export.project_id;
  select case macro when 'V1' then 'V2' else 'V3' end into v_macro
  from public.project_versions where id = v_export.base_version_id;
  v_old_skip := current_setting('app.skip_activity', true);
  perform set_config('app.skip_activity', 'on', true);
  for v_item in select value from jsonb_array_elements(v_checklist.items) loop
    insert into public.kanban_items(project_id, title, phase, macro_version, status, position)
    values(
      v_export.project_id,
      'Editor — ' || (v_item ->> 'screen') || ' / ' || (v_item ->> 'component'),
      'Editor',
      v_macro,
      'a_fazer',
      v_position + v_count
    );
    v_count := v_count + 1;
  end loop;

  update public.editor_export_checklists
  set status = 'ingerido', ingested_at = now()
  where id = v_checklist.id;
  update public.projects
  set project_status = 'ALTERACOES_RECEBIDAS'::public.project_status
  where id = v_export.project_id;
  perform set_config('app.skip_activity', coalesce(v_old_skip, 'off'), true);
  perform public.r1_06_event(
    v_export.project_id,
    'editor.export_ingested',
    jsonb_build_object('export_id', v_export.id, 'checklist_id', v_checklist.id, 'items', v_count),
    p_request_id
  );
  return jsonb_build_object('replayed', false, 'items', v_count, 'checklistId', v_checklist.id);
end;
$$;

create or replace function public.associate_editor_checklist_version(
  p_checklist_id uuid,
  p_version_id uuid,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_checklist public.editor_export_checklists%rowtype;
  v_export public.editor_exports%rowtype;
  v_version public.project_versions%rowtype;
begin
  perform public.r1_06_require_admin();
  if nullif(trim(coalesce(p_request_id, '')), '') is null then
    raise exception using errcode = '22023', message = 'EDITOR_REQUEST_ID_REQUIRED';
  end if;
  select * into v_checklist
  from public.editor_export_checklists where id = p_checklist_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'EDITOR_CHECKLIST_NOT_FOUND';
  end if;
  select * into strict v_export from public.editor_exports where id = v_checklist.export_id;
  if public.r1_06_is_replay(p_request_id, v_export.project_id, 'editor.checklist_associated') then
    if not exists (select 1 from public.activity_events where request_id = p_request_id
      and payload ->> 'checklist_id' = p_checklist_id::text
      and payload ->> 'version_id' = p_version_id::text) then
      raise exception using errcode = 'PT409', message = 'EDITOR_REQUEST_CONFLICT';
    end if;
    return jsonb_build_object('replayed', true, 'versionId', v_checklist.version_id);
  end if;
  select * into v_version
  from public.project_versions where id = p_version_id and project_id = v_export.project_id;
  if not found
    or p_version_id = v_export.base_version_id
    or v_version.created_at <= (
      select base.created_at from public.project_versions base where base.id = v_export.base_version_id
    ) then
    raise exception using errcode = '22023', message = 'EDITOR_TARGET_VERSION_INVALID';
  end if;
  if v_checklist.status <> 'ingerido' then
    raise exception using errcode = 'PT409', message = 'EDITOR_CHECKLIST_NOT_INGESTED';
  end if;
  if v_checklist.version_id is not null and v_checklist.version_id <> p_version_id then
    raise exception using errcode = 'PT409', message = 'EDITOR_CHECKLIST_ALREADY_ASSOCIATED';
  end if;
  if v_checklist.version_id = p_version_id then
    return jsonb_build_object('replayed', true, 'versionId', p_version_id);
  end if;
  update public.editor_export_checklists
  set version_id = p_version_id, associated_at = now()
  where id = p_checklist_id;
  perform public.r1_06_event(
    v_export.project_id,
    'editor.checklist_associated',
    jsonb_build_object('checklist_id', p_checklist_id, 'version_id', p_version_id),
    p_request_id
  );
  return jsonb_build_object('replayed', false, 'versionId', p_version_id);
end;
$$;

revoke all on function public.editor_export_content_hash(uuid, jsonb),
  public.editor_group_changes(jsonb),
  public.submit_client_editor_export(uuid, uuid, jsonb, jsonb, text),
  public.ingest_editor_export(uuid, text),
  public.list_admin_editor_exports(uuid),
  public.list_client_version_checklists(uuid),
  public.associate_editor_checklist_version(uuid, uuid, text)
from public, anon, authenticated;

grant execute on function public.list_admin_editor_exports(uuid),
  public.ingest_editor_export(uuid, text),
  public.associate_editor_checklist_version(uuid, uuid, text)
to authenticated, service_role;

grant execute on function public.list_client_version_checklists(uuid),
  public.submit_client_editor_export(uuid, uuid, jsonb, jsonb, text)
to authenticated, service_role;

grant execute on function public.editor_export_content_hash(uuid, jsonb),
  public.editor_group_changes(jsonb)
to service_role;

-- A package is ingestible only after every private artifact exists.
create function public.finalize_client_editor_export(p_export_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_export public.editor_exports%rowtype;
begin
  select * into v_export from public.editor_exports where id = p_export_id for update;
  if not found or not public.can_read_project(v_export.project_id, 'editor') then
    raise exception using errcode = '42501', message = 'EDITOR_ACCESS_DENIED';
  end if;
  if (select count(*) from storage.objects where bucket_id = 'editor-exports'
    and name in (
      v_export.project_id::text || '/' || v_export.content_sha256 || '/editor.md',
      v_export.project_id::text || '/' || v_export.content_sha256 || '/editor.cfg',
      v_export.project_id::text || '/' || v_export.content_sha256 || '/editor.css',
      v_export.project_id::text || '/' || v_export.content_sha256 || '/manifest.json'
    )) <> 4 then
    raise exception using errcode = 'PT409', message = 'EDITOR_FILES_INCOMPLETE';
  end if;
  update public.editor_exports set files_ready_at = coalesce(files_ready_at, now()) where id = p_export_id;
  return jsonb_build_object('ready', true);
end;
$$;
revoke all on function public.finalize_client_editor_export(uuid) from public, anon, authenticated;
grant execute on function public.finalize_client_editor_export(uuid) to authenticated, service_role;

create function public.can_access_editor_export_file(p_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_project uuid; v_hash text;
begin
  if array_length(string_to_array(p_name, '/'), 1) <> 3
    or split_part(p_name, '/', 3) not in ('editor.md','editor.cfg','editor.css','manifest.json') then return false; end if;
  begin v_project := split_part(p_name, '/', 1)::uuid;
  exception when invalid_text_representation then return false; end;
  v_hash := split_part(p_name, '/', 2);
  return public.can_read_project(v_project, 'editor') and exists (
    select 1 from public.editor_exports where project_id = v_project and content_sha256 = v_hash
  );
end;
$$;
revoke all on function public.can_access_editor_export_file(text) from public, anon, authenticated;
grant execute on function public.can_access_editor_export_file(text) to authenticated, service_role;
drop policy editor_exports_client_upload on storage.objects;
drop policy editor_exports_client_read on storage.objects;
create policy editor_exports_client_upload on storage.objects for insert to authenticated
with check (bucket_id = 'editor-exports' and public.can_access_editor_export_file(name));
create policy editor_exports_client_read on storage.objects for select to authenticated
using (bucket_id = 'editor-exports' and public.can_access_editor_export_file(name));
