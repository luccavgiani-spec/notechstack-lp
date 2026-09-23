-- Agency console: an additional, read-only project portfolio. NO_ADMIN is unchanged.
create schema if not exists agency_private;
revoke all on schema agency_private from public;
grant usage on schema agency_private to authenticated;

create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.agency_members (
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'AGENCY_ADMIN' check (role = 'AGENCY_ADMIN'),
  created_at timestamptz not null default now(),
  primary key (agency_id, user_id)
);
create index agency_members_user_idx on public.agency_members(user_id);
create table public.agency_projects (
  agency_id uuid not null references public.agencies(id) on delete cascade,
  project_id uuid not null unique references public.projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (agency_id, project_id)
);
alter table public.agencies enable row level security;
alter table public.agency_members enable row level security;
alter table public.agency_projects enable row level security;
revoke all on public.agencies, public.agency_members, public.agency_projects from anon, authenticated;
grant select, insert, update, delete on public.agencies, public.agency_members, public.agency_projects to authenticated;
grant all on public.agencies, public.agency_members, public.agency_projects to service_role;

-- Membership comes from the database, never from editable user metadata or a URL slug.
create function agency_private.can_access(p_agency_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    public.is_no_admin() or exists (
      select 1 from public.agencies a
      join public.agency_members m on m.agency_id = a.id
      where a.id = p_agency_id and a.active and m.user_id = auth.uid()
    )
  );
$$;
revoke all on function agency_private.can_access(uuid) from public, anon;
grant execute on function agency_private.can_access(uuid) to authenticated;

create policy agencies_read on public.agencies for select to authenticated
  using (agency_private.can_access(id));
create policy agencies_manage on public.agencies for all to authenticated
  using (public.is_no_admin()) with check (public.is_no_admin());
create policy agency_members_read on public.agency_members for select to authenticated
  using (user_id = auth.uid() or public.is_no_admin());
create policy agency_members_manage on public.agency_members for all to authenticated
  using (public.is_no_admin()) with check (public.is_no_admin());
create policy agency_projects_read on public.agency_projects for select to authenticated
  using (agency_private.can_access(agency_id));
create policy agency_projects_manage on public.agency_projects for all to authenticated
  using (public.is_no_admin()) with check (public.is_no_admin());

-- Explicit projection: no client email, answers, commercial notes, financial data,
-- internal event payloads or build references are exposed to an agency.
create function agency_private.overview(p_agency_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not agency_private.can_access(p_agency_id) then
    raise insufficient_privilege using message = 'AGENCY_ACCESS_DENIED';
  end if;
  select jsonb_build_object(
    'agency', jsonb_build_object('id', a.id, 'name', a.name, 'slug', a.slug, 'active', a.active),
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'clientId', p.client_id, 'clientName', c.name,
        'status', coalesce(p.project_status::text, p.lead_status::text),
        'updatedAt', p.updated_at,
        'totalTasks', (select count(*) from public.kanban_items k where k.project_id = p.id),
        'doneTasks', (select count(*) from public.kanban_items k where k.project_id = p.id and k.status = 'concluido'),
        'overdueTasks', (select count(*) from public.kanban_items k where k.project_id = p.id and k.status <> 'concluido' and k.scheduled_date < current_date),
        'nextDate', (select min(k.scheduled_date) from public.kanban_items k where k.project_id = p.id and k.status <> 'concluido')
      ) order by p.updated_at desc)
      from public.agency_projects ap
      join public.projects p on p.id = ap.project_id
      join public.clients c on c.id = p.client_id
      where ap.agency_id = a.id
    ), '[]'::jsonb)
  ) into result from public.agencies a where a.id = p_agency_id;
  return result;
end;
$$;
create function agency_private.project_detail(p_agency_id uuid, p_project_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not agency_private.can_access(p_agency_id) or not exists (
    select 1 from public.agency_projects where agency_id = p_agency_id and project_id = p_project_id
  ) then
    raise insufficient_privilege using message = 'AGENCY_ACCESS_DENIED';
  end if;
  return jsonb_build_object(
    'tasks', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'title', k.title,
      'phase', k.phase, 'status', k.status, 'date', k.scheduled_date) order by k.position)
      from public.kanban_items k where k.project_id = p_project_id), '[]'::jsonb),
    'versions', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'label', v.label,
      'changelog', v.changelog, 'publishedAt', v.published_at, 'current', v.is_current) order by v.published_at desc)
      from public.project_versions v where v.project_id = p_project_id), '[]'::jsonb)
  );
end;
$$;
revoke all on function agency_private.overview(uuid), agency_private.project_detail(uuid, uuid) from public, anon;
grant execute on function agency_private.overview(uuid), agency_private.project_detail(uuid, uuid) to authenticated;

create function public.get_agency_overview(p_agency_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select agency_private.overview(p_agency_id);
$$;
create function public.get_agency_project(p_agency_id uuid, p_project_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select agency_private.project_detail(p_agency_id, p_project_id);
$$;
revoke all on function public.get_agency_overview(uuid), public.get_agency_project(uuid, uuid) from public, anon;
grant execute on function public.get_agency_overview(uuid), public.get_agency_project(uuid, uuid) to authenticated;
