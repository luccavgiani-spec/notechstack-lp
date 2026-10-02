-- Editor: automatic components, full change payload and submission activity.
--
-- 1. An allowlist entry with id "*" lets the preview bridge address any visible
--    text, button or image by its DOM path ("auto:#secao/div.1/h2.1"). Mapped
--    components keep working and keep precedence; "*" is opt-in per version.
-- 2. Exports now carry what the client actually did: move/resize (x, y, width,
--    height), a readable label and the original values ("before").
-- 3. Every new export records editor.export_submitted in the activity feed, so
--    the Nó dashboard shows the submission without any file changing hands.

create or replace function public.editor_allowed_controls(p_version_id uuid, p_component text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (
      select coalesce(allowed -> 'controls', '["text","size","color","logo"]'::jsonb)
      from public.editor_version_configs config
      cross join lateral jsonb_array_elements(config.allowed_components) allowed
      where config.version_id = p_version_id
        and p_component <> '*'
        and allowed ->> 'id' = p_component
      limit 1
    ),
    (
      select coalesce(allowed -> 'controls', '["text","size","color","logo"]'::jsonb)
      from public.editor_version_configs config
      cross join lateral jsonb_array_elements(config.allowed_components) allowed
      where config.version_id = p_version_id
        and allowed ->> 'id' = '*'
        -- Postgres caps regex repetition at 255, so the length is checked apart.
        and p_component ~ '^auto:[A-Za-z0-9#/._-]+$'
        and length(p_component) <= length('auto:') + 300
      limit 1
    )
  );
$$;
revoke all on function public.editor_allowed_controls(uuid, text) from public, anon, authenticated;
grant execute on function public.editor_allowed_controls(uuid, text) to service_role;

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
      or public.editor_allowed_controls(new.base_version_id, change ->> 'component') is null
  ) then
    raise exception using errcode = '22023', message = 'EDITOR_COMPONENT_NOT_ALLOWED';
  end if;
  if exists (
    select 1 from jsonb_array_elements(new.changes) change
    where coalesce(jsonb_typeof(change -> 'after'), '') <> 'object'
      or (change ? 'before' and jsonb_typeof(change -> 'before') <> 'object')
      or (change ? 'label' and (jsonb_typeof(change -> 'label') <> 'string' or length(change ->> 'label') > 200))
  ) then raise exception using errcode = '22023', message = 'EDITOR_VALUES_INVALID'; end if;
  if exists (
    select 1 from jsonb_array_elements(new.changes) change
    cross join lateral jsonb_each(change -> 'after') field
    where jsonb_typeof(field.value) <> 'string'
      or field.key not in ('text','size','color','logo','x','y','width','height')
      -- Content controls follow the allowlist; layout is always offered by the editor.
      or (field.key in ('text','size','color','logo')
        and not public.editor_allowed_controls(new.base_version_id, change ->> 'component') ? field.key)
      or (field.key = 'color' and field.value #>> '{}' !~ '^#[0-9a-fA-F]{6}$')
      or (field.key = 'size' and field.value #>> '{}' !~ '^([8-9]|[1-9][0-9]|1[0-5][0-9]|160)(\.[0-9]+)?$')
      or (field.key = 'logo' and field.value #>> '{}' <> '' and field.value #>> '{}' !~ '^https://[^[:space:]]+$')
      or (field.key in ('x','y') and case
        when field.value #>> '{}' ~ '^-?[0-9]{1,4}(\.[0-9]+)?$' then (field.value #>> '{}')::numeric not between -2000 and 2000
        else true end)
      or (field.key in ('width','height') and field.value #>> '{}' <> '' and case
        when field.value #>> '{}' ~ '^[0-9]{1,4}(\.[0-9]+)?$' then (field.value #>> '{}')::numeric not between 20 and 4000
        else true end)
  ) then raise exception using errcode = '22023', message = 'EDITOR_VALUES_INVALID'; end if;
  new.content_sha256 := public.editor_export_content_hash(new.base_version_id, new.changes);
  new.manifest := new.manifest || jsonb_build_object('content_sha256', new.content_sha256);
  return new;
end;
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
      'label', grouped.label,
      'changes', grouped.changes
    ) order by grouped.first_position
  ), '[]'::jsonb)
  from (
    select
      coalesce(nullif(trim(change.value ->> 'screen'), ''), 'geral') as screen,
      change.value ->> 'component' as component,
      (array_agg(nullif(trim(change.value ->> 'label'), '') order by change.position)
        filter (where nullif(trim(change.value ->> 'label'), '') is not null))[1] as label,
      min(change.position) as first_position,
      jsonb_agg(jsonb_build_object(
        'before', coalesce(change.value -> 'before', '{}'::jsonb),
        'after', coalesce(change.value -> 'after', '{}'::jsonb)
      ) order by change.position) as changes
    from jsonb_array_elements(coalesce(p_changes, '[]'::jsonb)) with ordinality as change(value, position)
    group by coalesce(nullif(trim(change.value ->> 'screen'), ''), 'geral'), change.value ->> 'component'
  ) grouped;
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
      'Editor — ' || (v_item ->> 'screen') || ' / '
        || coalesce(nullif(v_item ->> 'label', ''), v_item ->> 'component'),
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

create or replace function public.editor_export_record_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.r1_06_event(
    new.project_id,
    'editor.export_submitted',
    jsonb_build_object(
      'export_id', new.id,
      'items', jsonb_array_length(public.editor_group_changes(new.changes)),
      'conflict', coalesce((new.manifest ->> 'conflict')::boolean, false)
    ),
    'editor.export_submitted:' || new.id::text,
    new.created_by
  );
  return new;
end;
$$;
revoke all on function public.editor_export_record_activity() from public, anon, authenticated;

create trigger editor_export_record_activity
after insert on public.editor_exports
for each row execute function public.editor_export_record_activity();

-- Turn on automatic mode only where the bridge is live today (the Espaço Saúde
-- Mental preview). New versions stay on hand-made maps unless "*" is added.
update public.editor_version_configs
set allowed_components = allowed_components
  || '[{"id":"*","label":"Qualquer elemento da página","controls":["text","size","color","logo"]}]'::jsonb
where bridge_enabled
  and not exists (
    select 1 from jsonb_array_elements(allowed_components) item where item ->> 'id' = '*'
  );
