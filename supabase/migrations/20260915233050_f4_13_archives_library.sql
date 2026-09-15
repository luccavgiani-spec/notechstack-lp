-- F4-13: immutable project snapshots and a NO_ADMIN-only archive library.
-- One archive asset represents one entire project snapshot. It is created in the
-- same transaction as the archive mark, so no partial archive can be searched.

alter table public.projects add column archived_at timestamptz;

create table public.archive_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id),
  snapshot jsonb not null,
  tags jsonb not null default '{}'::jsonb,
  internal_reuse boolean not null default false,
  public_case boolean not null default false,
  confidential boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (project_id),
  check (jsonb_typeof(tags) = 'object')
);

create index archive_assets_library_idx on public.archive_assets (created_at desc);
create index archive_assets_tags_idx on public.archive_assets using gin (tags jsonb_path_ops);

create function public.archive_assets_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = 'ARCHIVE_ASSET_IMMUTABLE';
end;
$$;

create trigger archive_assets_immutable
before update or delete on public.archive_assets
for each row execute function public.archive_assets_immutable();

alter table public.archive_assets enable row level security;
revoke all on public.archive_assets from anon, authenticated;
grant select on public.archive_assets to authenticated;
grant all on public.archive_assets to service_role;

create policy archive_assets_select_admin
on public.archive_assets for select to authenticated
using (public.is_no_admin());

create or replace function public.archive_project(
  p_project_id uuid,
  p_tags jsonb default '{}'::jsonb,
  p_internal_reuse boolean default false,
  p_public_case boolean default false,
  p_confidential boolean default true,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects%rowtype;
  v_effective_access public.access_status;
  v_snapshot jsonb;
  v_default_tags jsonb;
  v_asset public.archive_assets%rowtype;
  v_old_skip text;
  v_request_id text := nullif(trim(coalesce(p_request_id, '')), '');
begin
  perform public.r1_06_require_admin();
  if jsonb_typeof(coalesce(p_tags, '{}'::jsonb)) <> 'object' then
    raise exception using errcode = '22023', message = 'ARCHIVE_TAGS_INVALID';
  end if;
  select * into v_project from public.projects where id = p_project_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PROJECT_NOT_FOUND';
  end if;
  if v_request_id is not null and public.r1_06_is_replay(v_request_id, p_project_id, 'project.archived') then
    select * into v_asset from public.archive_assets where project_id = p_project_id;
    return jsonb_build_object('assetId', v_asset.id, 'replayed', true, 'projectStatus', 'ARQUIVADO');
  end if;
  if v_project.archived_at is not null or v_project.project_status = 'ARQUIVADO'::public.project_status then
    raise exception using errcode = 'P0001', message = 'PROJECT_ALREADY_ARCHIVED';
  end if;
  select effective_access_status into v_effective_access from public.project_access where id = p_project_id;
  if not (
    v_project.project_status = 'CONCLUIDO'::public.project_status
    or (v_project.lead_status = 'JANELA_DE_DECISAO'::public.lead_status and v_effective_access = 'EXPIRADO'::public.access_status)
  ) then
    raise exception using errcode = 'P0001', message = 'PROJECT_ARCHIVE_NOT_ALLOWED';
  end if;

  select jsonb_build_object(
    'project', to_jsonb(v_project),
    'roadmap', coalesce((select to_jsonb(r) from public.roadmaps r where r.project_id = p_project_id), '{}'::jsonb),
    'prototype', coalesce((select jsonb_build_object('url', r.prototype_url, 'published_at', r.published_at) from public.roadmaps r where r.project_id = p_project_id), '{}'::jsonb),
    'versions', coalesce((select jsonb_agg(to_jsonb(pv) order by pv.published_at desc, pv.created_at desc) from public.project_versions pv where pv.project_id = p_project_id), '[]'::jsonb),
    'files', '[]'::jsonb
  ) into v_snapshot;
  v_default_tags := jsonb_build_object(
    'nicho', case when v_project.niche is null then '[]'::jsonb else jsonb_build_array(v_project.niche) end,
    'produto', '[]'::jsonb,
    'stack', coalesce((select r.stack from public.roadmaps r where r.project_id = p_project_id), '[]'::jsonb),
    'componente', '[]'::jsonb,
    'ux', '[]'::jsonb,
    'problema', '[]'::jsonb,
    'complexidade', '[]'::jsonb,
    'data', jsonb_build_array((now() at time zone 'America/Sao_Paulo')::date),
    'origem', jsonb_build_array(v_project.id::text),
    'direitos', '[]'::jsonb
  );

  v_old_skip := current_setting('app.skip_activity', true);
  perform set_config('app.skip_activity', 'on', true);
  update public.projects
  set project_status = 'ARQUIVADO'::public.project_status, archived_at = now()
  where id = p_project_id;
  insert into public.archive_assets(project_id, snapshot, tags, internal_reuse, public_case, confidential, created_by)
  values (p_project_id, v_snapshot, v_default_tags || coalesce(p_tags, '{}'::jsonb), p_internal_reuse, p_public_case, p_confidential, (select auth.uid()))
  returning * into v_asset;
  perform set_config('app.skip_activity', coalesce(v_old_skip, 'off'), true);
  perform public.r1_06_event(
    p_project_id,
    'project.archived',
    jsonb_build_object('asset_id', v_asset.id, 'internal_reuse', p_internal_reuse, 'public_case', p_public_case, 'confidential', p_confidential),
    v_request_id
  );
  return jsonb_build_object('assetId', v_asset.id, 'replayed', false, 'projectStatus', 'ARQUIVADO');
exception when others then
  perform set_config('app.skip_activity', coalesce(v_old_skip, 'off'), true);
  raise;
end;
$$;

revoke all on function public.archive_project(uuid, jsonb, boolean, boolean, boolean, text) from public, anon;
grant execute on function public.archive_project(uuid, jsonb, boolean, boolean, boolean, text) to authenticated, service_role;

create or replace function public.list_archive_assets(
  p_tags jsonb default '{}'::jsonb,
  p_reusable_only boolean default false,
  p_case_only boolean default false
)
returns table(
  id uuid,
  project_id uuid,
  project_name text,
  source_version text,
  tags jsonb,
  internal_reuse boolean,
  public_case boolean,
  rights_label text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.id,
    a.project_id,
    p.name,
    a.snapshot #>> '{versions,0,label}',
    a.tags,
    a.internal_reuse,
    a.public_case,
    case
      when a.public_case then 'AUTORIZADO PARA CASE'
      when a.internal_reuse then 'REUTILIZÁVEL INTERNAMENTE'
      else 'PRIVADO / NÃO REUTILIZAR'
    end,
    a.created_at
  from public.archive_assets a
  join public.projects p on p.id = a.project_id
  where public.is_no_admin()
    and not a.confidential
    and a.tags @> coalesce(p_tags, '{}'::jsonb)
    and (not p_reusable_only or a.internal_reuse or a.public_case)
    and (not p_case_only or a.public_case)
  order by a.created_at desc;
$$;

revoke all on function public.list_archive_assets(jsonb, boolean, boolean) from public, anon;
grant execute on function public.list_archive_assets(jsonb, boolean, boolean) to authenticated, service_role;

create or replace function public.can_read_project(
  p_project_id uuid,
  p_module text default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_no_admin()
    or exists (
      select 1
      from public.projects as p
      join public.memberships as m on m.client_id = p.client_id
      where p.id = p_project_id
        and p.project_status is distinct from 'ARQUIVADO'::public.project_status
        and m.user_id = (select auth.uid())
        and (
          p.access_status = 'ATIVO_ATE_FIM_DO_PROJETO'::public.access_status
          or (p.access_status = 'INICIAL_15_DIAS'::public.access_status and p.access_released_at is not null and now() < p.access_released_at + interval '15 days')
        )
        and (p_module is null or p.modules ->> p_module = 'ativo')
    );
$$;

revoke all on function public.can_read_project(uuid, text) from public;
grant execute on function public.can_read_project(uuid, text) to anon, authenticated, service_role;
