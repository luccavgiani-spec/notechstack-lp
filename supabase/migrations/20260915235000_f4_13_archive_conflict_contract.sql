-- F4-13 follow-up: PostgREST maps PT409 to HTTP 409. Keep the archive RPC's
-- public conflict contract precise without rewriting the already released migration.

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
    raise exception using errcode = 'PT409', message = 'PROJECT_ALREADY_ARCHIVED';
  end if;
  select effective_access_status into v_effective_access from public.project_access where id = p_project_id;
  if not (
    v_project.project_status = 'CONCLUIDO'::public.project_status
    or (v_project.lead_status = 'JANELA_DE_DECISAO'::public.lead_status and v_effective_access = 'EXPIRADO'::public.access_status)
  ) then
    raise exception using errcode = 'PT409', message = 'PROJECT_ARCHIVE_NOT_ALLOWED';
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
  update public.projects set project_status = 'ARQUIVADO'::public.project_status, archived_at = now() where id = p_project_id;
  insert into public.archive_assets(project_id, snapshot, tags, internal_reuse, public_case, confidential, created_by)
  values (p_project_id, v_snapshot, v_default_tags || coalesce(p_tags, '{}'::jsonb), p_internal_reuse, p_public_case, p_confidential, (select auth.uid()))
  returning * into v_asset;
  perform set_config('app.skip_activity', coalesce(v_old_skip, 'off'), true);
  perform public.r1_06_event(p_project_id, 'project.archived', jsonb_build_object('asset_id', v_asset.id, 'internal_reuse', p_internal_reuse, 'public_case', p_public_case, 'confidential', p_confidential), v_request_id);
  return jsonb_build_object('assetId', v_asset.id, 'replayed', false, 'projectStatus', 'ARQUIVADO');
exception when others then
  perform set_config('app.skip_activity', coalesce(v_old_skip, 'off'), true);
  raise;
end;
$$;

revoke all on function public.archive_project(uuid, jsonb, boolean, boolean, boolean, text) from public, anon;
grant execute on function public.archive_project(uuid, jsonb, boolean, boolean, boolean, text) to authenticated, service_role;
