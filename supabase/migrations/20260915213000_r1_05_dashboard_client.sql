-- R1-05: client dashboard shell and narrow tier-preference mutation.

create or replace function public.get_client_project_shell(p_project_id uuid)
returns table(
  project_id uuid,
  project_name text,
  effective_access_status public.access_status,
  access_released_at timestamptz,
  modules jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return;
  end if;

  if not public.is_no_admin() and not exists (
    select 1
    from public.projects as p
    join public.memberships as m on m.client_id = p.client_id
    where p.id = p_project_id
      and m.user_id = (select auth.uid())
      and m.role = 'CLIENT'
  ) then
    return;
  end if;

  return query
  select
    p.id,
    p.name,
    case
      when p.access_status = 'INICIAL_15_DIAS'::public.access_status
        and (
          p.access_released_at is null
          or now() >= p.access_released_at + interval '15 days'
        )
        then 'EXPIRADO'::public.access_status
      else p.access_status
    end,
    p.access_released_at,
    p.modules
  from public.projects as p
  where p.id = p_project_id;
end;
$$;

revoke all on function public.get_client_project_shell(uuid) from public, anon;
grant execute on function public.get_client_project_shell(uuid) to authenticated, service_role;

create or replace function public.set_preferred_tier(
  p_project_id uuid,
  p_tier public.tier
)
returns table(preferred_tier public.tier, changed boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_previous public.tier;
begin
  if v_user_id is null or not exists (
    select 1
    from public.projects as p
    join public.memberships as m on m.client_id = p.client_id
    where p.id = p_project_id
      and m.user_id = v_user_id
      and m.role = 'CLIENT'
      and public.can_read_project(p.id, 'como_funciona')
  ) then
    raise insufficient_privilege using message = 'CLIENT_PROJECT_ACCESS_REQUIRED';
  end if;

  select r.preferred_tier
    into v_previous
  from public.roadmaps as r
  where r.project_id = p_project_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'ROADMAP_NOT_FOUND';
  end if;

  if v_previous is not distinct from p_tier then
    return query select v_previous, false;
    return;
  end if;

  update public.roadmaps as r
  set preferred_tier = p_tier
  where r.project_id = p_project_id;

  insert into public.activity_events (project_id, type, actor_id, payload)
  values (
    p_project_id,
    'client.preferred_tier_changed',
    v_user_id,
    jsonb_build_object('antes', v_previous, 'depois', p_tier, 'tier', p_tier)
  );

  return query select p_tier, true;
end;
$$;

revoke all on function public.set_preferred_tier(uuid, public.tier) from public, anon;
grant execute on function public.set_preferred_tier(uuid, public.tier) to authenticated, service_role;
