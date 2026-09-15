-- F2-09: version history and atomic publishing.
-- This migration adds the version aggregate and extends the existing
-- administrative status boundary. R1-01 activity triggers remain installed;
-- writers suspend them transaction-locally and emit one domain event.

create table public.project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  label text not null check (length(trim(label)) > 0),
  macro text not null check (macro in ('V1', 'V2', 'V3')),
  status text not null check (length(trim(status)) > 0),
  published_at timestamptz not null default now(),
  changelog text not null check (length(trim(changelog)) > 0),
  build_reference text not null check (length(trim(build_reference)) > 0),
  is_current boolean not null default false,
  request_id text unique,
  created_at timestamptz not null default now(),
  unique (project_id, label)
);

create unique index project_versions_one_current_idx
  on public.project_versions (project_id)
  where is_current;

create index project_versions_project_published_idx
  on public.project_versions (project_id, published_at desc, created_at desc);

alter table public.project_versions enable row level security;
revoke all on public.project_versions from anon, authenticated;
grant select on public.project_versions to authenticated;
grant all on public.project_versions to service_role;

create policy project_versions_select_authorized
on public.project_versions for select to authenticated
using (
  public.is_no_admin()
  or public.can_read_project(project_id, 'versoes')
);

create or replace function public.project_versions_protect_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.changelog is distinct from old.changelog
     or new.published_at is distinct from old.published_at
     or new.build_reference is distinct from old.build_reference then
    raise exception using errcode = 'P0001', message = 'VERSION_HISTORY_IMMUTABLE';
  end if;
  return new;
end;
$$;

revoke all on function public.project_versions_protect_history() from public, anon, authenticated;
grant execute on function public.project_versions_protect_history() to service_role;

create trigger project_versions_protect_history
before update on public.project_versions
for each row execute function public.project_versions_protect_history();

create or replace function public.publish_project_version(
  p_project_id uuid,
  p_label text,
  p_macro text,
  p_changelog text,
  p_build_reference text,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects%rowtype;
  v_version public.project_versions%rowtype;
  v_event public.activity_events%rowtype;
  v_old_skip text;
  v_label text := trim(coalesce(p_label, ''));
  v_changelog text := trim(coalesce(p_changelog, ''));
  v_build_reference text := trim(coalesce(p_build_reference, ''));
  v_request_id text := nullif(trim(coalesce(p_request_id, '')), '');
  v_status text;
begin
  perform public.r1_06_require_admin();

  if p_project_id is null or v_label = '' or p_macro is null or p_macro not in ('V1', 'V2', 'V3')
     or v_changelog = '' or v_build_reference = '' or v_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_VERSION_REQUEST';
  end if;

  select * into v_event
  from public.activity_events
  where request_id = v_request_id;

  if found then
    if v_event.project_id is distinct from p_project_id
       or v_event.type is distinct from 'project.version_published'
       or v_event.payload ->> 'label' is distinct from v_label
       or v_event.payload ->> 'macro' is distinct from p_macro then
      raise exception using errcode = 'P0001', message = 'REQUEST_ID_CONFLICT';
    end if;

    select * into v_version
    from public.project_versions
    where id = (v_event.payload ->> 'version_id')::uuid;
    if not found then
      raise exception using errcode = 'P0001', message = 'VERSION_REPLAY_MISSING';
    end if;
    return jsonb_build_object(
      'versionId', v_version.id,
      'projectStatus', (v_event.payload ->> 'project_status')::public.project_status,
      'replayed', true
    );
  end if;

  select * into v_project
  from public.projects
  where id = p_project_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PROJECT_NOT_FOUND';
  end if;

  if p_macro = 'V1' then
    if v_project.project_status = 'V1_EM_DESENVOLVIMENTO'::public.project_status then
      if v_label <> 'V1' then
        raise exception using errcode = 'P0001', message = 'VERSION_LABEL_NOT_ALLOWED';
      end if;
      v_status := 'publicada';
    elsif v_project.project_status in (
      'V1_PUBLICADA'::public.project_status,
      'EM_REVISAO_CLIENTE'::public.project_status,
      'ALTERACOES_RECEBIDAS'::public.project_status
    ) then
      if v_label !~ '^V1\.[1-9][0-9]*$' then
        raise exception using errcode = 'P0001', message = 'VERSION_LABEL_NOT_ALLOWED';
      end if;
      v_status := 'intermediaria';
    else
      raise exception using errcode = 'P0001', message = 'VERSION_STATE_NOT_ALLOWED';
    end if;
  elsif p_macro = 'V2' then
    if v_project.project_status <> 'V2_EM_DESENVOLVIMENTO'::public.project_status then
      raise exception using errcode = 'P0001', message = 'VERSION_STATE_NOT_ALLOWED';
    end if;
    if v_label <> 'V2' and v_label !~ '^V2\.[1-9][0-9]*$' then
      raise exception using errcode = 'P0001', message = 'VERSION_LABEL_NOT_ALLOWED';
    end if;
    v_status := case when v_label = 'V2' then 'publicada' else 'intermediaria' end;
  else
    if v_project.project_status <> 'V2_PUBLICADA'::public.project_status or v_label <> 'V3' then
      raise exception using errcode = 'P0001', message = 'VERSION_STATE_NOT_ALLOWED';
    end if;
    v_status := 'go_live';
  end if;

  v_old_skip := current_setting('app.skip_activity', true);
  perform set_config('app.skip_activity', 'on', true);

  update public.project_versions
  set is_current = false
  where project_id = p_project_id and is_current;

  insert into public.project_versions(
    project_id, label, macro, status, published_at, changelog,
    build_reference, is_current, request_id
  ) values (
    p_project_id, v_label, p_macro, v_status, clock_timestamp(), v_changelog,
    v_build_reference, true, v_request_id
  ) returning * into v_version;

  if p_macro = 'V1' and v_label = 'V1' then
    update public.projects
    set project_status = 'V1_PUBLICADA'::public.project_status,
        modules = jsonb_set(
          jsonb_set(coalesce(modules, '{}'::jsonb), '{editor}', '"ativo"'::jsonb),
          '{versoes}', '"ativo"'::jsonb
        )
    where id = p_project_id
    returning * into v_project;
  elsif p_macro = 'V2' and v_label = 'V2' then
    update public.projects
    set project_status = 'V2_PUBLICADA'::public.project_status
    where id = p_project_id
    returning * into v_project;
  elsif p_macro = 'V3' then
    update public.projects
    set project_status = 'V3_GO_LIVE'::public.project_status
    where id = p_project_id
    returning * into v_project;
  end if;

  perform set_config('app.skip_activity', coalesce(v_old_skip, 'off'), true);

  perform public.r1_06_event(
    p_project_id,
    'project.version_published',
    jsonb_build_object(
      'version_id', v_version.id,
      'label', v_version.label,
      'macro', v_version.macro,
      'status', v_version.status,
      'project_status', v_project.project_status
    ),
    v_request_id
  );

  return jsonb_build_object(
    'versionId', v_version.id,
    'projectStatus', v_project.project_status,
    'replayed', false
  );
exception
  when others then
    perform set_config('app.skip_activity', coalesce(v_old_skip, 'off'), true);
    raise;
end;
$$;

revoke all on function public.publish_project_version(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.publish_project_version(uuid, text, text, text, text, text) to authenticated, service_role;

create or replace function public.transition_project_status(
  p_project_id uuid,
  p_target public.project_status,
  p_request_id text default null
)
returns public.projects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects%rowtype;
  v_event public.activity_events%rowtype;
  v_old_status public.project_status;
  v_old_skip text;
  v_request_id text := nullif(trim(coalesce(p_request_id, '')), '');
begin
  perform public.r1_06_require_admin();
  if v_request_id is null then
    raise exception using errcode = '22023', message = 'REQUEST_ID_REQUIRED';
  end if;

  select * into v_event from public.activity_events where request_id = v_request_id;
  if found then
    if v_event.project_id is distinct from p_project_id
       or v_event.type is distinct from 'project.project_status_changed'
       or v_event.payload ->> 'depois' is distinct from p_target::text then
      raise exception using errcode = 'P0001', message = 'REQUEST_ID_CONFLICT';
    end if;
    select * into v_project from public.projects where id = p_project_id;
    return v_project;
  end if;

  select * into v_project from public.projects where id = p_project_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PROJECT_NOT_FOUND';
  end if;

  v_old_status := v_project.project_status;
  if not (
    (v_old_status = 'CONVERTIDO'::public.project_status and p_target = 'AGENDADO'::public.project_status)
    or (v_old_status = 'AGENDADO'::public.project_status and p_target = 'V1_EM_DESENVOLVIMENTO'::public.project_status)
    or (v_old_status = 'V1_PUBLICADA'::public.project_status and p_target = 'EM_REVISAO_CLIENTE'::public.project_status)
    or (v_old_status = 'EM_REVISAO_CLIENTE'::public.project_status and p_target = 'ALTERACOES_RECEBIDAS'::public.project_status)
    or (v_old_status = 'ALTERACOES_RECEBIDAS'::public.project_status and p_target = 'V2_EM_DESENVOLVIMENTO'::public.project_status)
    or (v_old_status = 'V3_GO_LIVE'::public.project_status and p_target = 'CONCLUIDO'::public.project_status)
  ) then
    raise exception using errcode = 'P0001', message = 'PROJECT_TRANSITION_NOT_ALLOWED';
  end if;

  v_old_skip := current_setting('app.skip_activity', true);
  perform set_config('app.skip_activity', 'on', true);
  update public.projects set project_status = p_target where id = p_project_id returning * into v_project;
  perform set_config('app.skip_activity', coalesce(v_old_skip, 'off'), true);

  perform public.r1_06_event(
    p_project_id,
    'project.project_status_changed',
    jsonb_build_object('antes', v_old_status, 'depois', p_target),
    v_request_id
  );
  return v_project;
exception
  when others then
    perform set_config('app.skip_activity', coalesce(v_old_skip, 'off'), true);
    raise;
end;
$$;

revoke all on function public.transition_project_status(uuid, public.project_status, text) from public, anon;
grant execute on function public.transition_project_status(uuid, public.project_status, text) to authenticated, service_role;
