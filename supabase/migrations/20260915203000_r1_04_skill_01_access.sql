-- R1-04: atomic public-data activation for Skill 01 and effective lead expiry.

create or replace view public.project_access
with (security_invoker = true) as
select
  p.*,
  case
    when p.access_status = 'INICIAL_15_DIAS'::public.access_status
      and (
        p.access_released_at is null
        or now() >= p.access_released_at + interval '15 days'
      )
      then 'EXPIRADO'::public.access_status
    else p.access_status
  end as effective_access_status,
  case
    when p.lead_status = 'JANELA_DE_DECISAO'::public.lead_status
      and p.access_status = 'INICIAL_15_DIAS'::public.access_status
      and (
        p.access_released_at is null
        or now() >= p.access_released_at + interval '15 days'
      )
      then 'NAO_CONVERTIDO'::public.lead_status
    else p.lead_status
  end as effective_lead_status
from public.projects as p;

revoke all on public.project_access from public, anon, authenticated;
grant select on public.project_access to anon, authenticated, service_role;

create or replace function public.activate_dashboard(
  p_project_id uuid,
  p_user_id uuid,
  p_actor_id uuid,
  p_content jsonb,
  p_request_id text default null
)
returns table(project_id uuid, access_released_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects%rowtype;
  v_release timestamptz;
  v_request_id text := coalesce(nullif(p_request_id, ''), 'skill-01:' || p_project_id::text);
begin
  select * into v_project
  from public.projects
  where id = p_project_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'PROJECT_NOT_FOUND';
  end if;

  if v_project.project_status = 'ARQUIVADO'::public.project_status then
    raise exception using
      errcode = 'P0001',
      message = 'PROJECT_STATE_NOT_ALLOWED:ARQUIVADO';
  end if;

  if not (
    v_project.lead_status in (
      'ROADMAP_PAGO'::public.lead_status,
      'REFERENCIAS_PENDENTES'::public.lead_status,
      'EM_PRODUCAO'::public.lead_status
    )
    or (
      v_project.lead_status = 'JANELA_DE_DECISAO'::public.lead_status
      and v_project.access_released_at is not null
    )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'PROJECT_STATE_NOT_ALLOWED:' || v_project.lead_status::text;
  end if;

  if p_content is null
    or not (p_content ?& array['answers','references','stack','costs','next_steps','tiers'])
    or not ((p_content -> 'tiers') ?& array['essencial','basico','completo']) then
    raise exception using errcode = '22023', message = 'INVALID_ROADMAP_CONTENT';
  end if;

  perform set_config('app.skip_activity', 'on', true);

  insert into public.memberships (user_id, client_id, role)
  values (p_user_id, v_project.client_id, 'CLIENT')
  on conflict (user_id, client_id) do update set role = excluded.role;

  insert into public.roadmaps (
    project_id, answers, "references", stack, costs, next_steps, tiers,
    preferred_tier, prototype_url, published_at
  ) values (
    p_project_id,
    p_content -> 'answers',
    p_content -> 'references',
    p_content -> 'stack',
    p_content -> 'costs',
    p_content -> 'next_steps',
    p_content -> 'tiers',
    nullif(p_content ->> 'preferred_tier', '')::public.tier,
    nullif(p_content ->> 'prototype_url', ''),
    now()
  )
  on conflict on constraint roadmaps_pkey do update set
    answers = excluded.answers,
    "references" = excluded."references",
    stack = excluded.stack,
    costs = excluded.costs,
    next_steps = excluded.next_steps,
    tiers = excluded.tiers,
    preferred_tier = excluded.preferred_tier,
    prototype_url = excluded.prototype_url,
    published_at = excluded.published_at;

  update public.projects as target
  set
    modules = '{"como_funciona":"ativo","prototipo":"ativo","etapas":"ativo","editor":"bloqueado","versoes":"bloqueado","marca":"bloqueado"}'::jsonb,
    access_status = 'INICIAL_15_DIAS'::public.access_status,
    access_released_at = coalesce(target.access_released_at, now()),
    lead_status = 'JANELA_DE_DECISAO'::public.lead_status
  where id = p_project_id
  returning target.access_released_at into v_release;

  insert into public.activity_events (
    project_id, type, actor_id, occurred_at, payload, request_id
  ) values (
    p_project_id,
    'skill_01_dashboard_ativado',
    p_actor_id,
    now(),
    jsonb_build_object('source', 'skill-01'),
    v_request_id
  )
  on conflict (request_id) do nothing;

  return query select p_project_id, v_release;
end;
$$;

revoke all on function public.activate_dashboard(uuid, uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.activate_dashboard(uuid, uuid, uuid, jsonb, text) to service_role;
