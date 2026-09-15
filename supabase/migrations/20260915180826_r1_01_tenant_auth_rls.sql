-- R1-01: tenant, auth roles, database-enforced access and audit trail.
-- The legacy Meta tables and their policies are intentionally left untouched.

create type public.lead_status as enum (
  'FORMULARIO_PREENCHIDO',
  'PAGAMENTO_PENDENTE',
  'ROADMAP_PAGO',
  'REFERENCIAS_PENDENTES',
  'EM_PRODUCAO',
  'DASHBOARD_LIBERADO',
  'JANELA_DE_DECISAO',
  'CONVERTIDO',
  'NAO_CONVERTIDO'
);

create type public.project_status as enum (
  'CONVERTIDO',
  'AGENDADO',
  'V1_EM_DESENVOLVIMENTO',
  'V1_PUBLICADA',
  'EM_REVISAO_CLIENTE',
  'ALTERACOES_RECEBIDAS',
  'V2_EM_DESENVOLVIMENTO',
  'V2_PUBLICADA',
  'V3_GO_LIVE',
  'CONCLUIDO',
  'ARQUIVADO'
);

create type public.access_status as enum (
  'INICIAL_15_DIAS',
  'EXPIRADO',
  'ATIVO_ATE_FIM_DO_PROJETO'
);

create type public.tier as enum ('essencial', 'basico', 'completo');
create type public.kanban_status as enum ('a_fazer', 'em_andamento', 'concluido');

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id),
  role text not null check (role = 'CLIENT'),
  created_at timestamptz not null default now(),
  unique (user_id, client_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  lead_id uuid references public.leads(id),
  name text not null,
  niche text,
  lead_status public.lead_status not null,
  project_status public.project_status,
  access_status public.access_status,
  access_released_at timestamptz,
  modules jsonb not null default '{"como_funciona":"bloqueado","prototipo":"bloqueado","etapas":"bloqueado","editor":"bloqueado","versoes":"bloqueado","marca":"bloqueado"}'::jsonb,
  tier public.tier,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roadmaps (
  project_id uuid primary key references public.projects(id),
  answers jsonb not null default '{}'::jsonb,
  "references" jsonb not null default '[]'::jsonb,
  stack jsonb not null default '[]'::jsonb,
  costs jsonb not null default '[]'::jsonb,
  next_steps jsonb not null default '[]'::jsonb,
  tiers jsonb not null default '{}'::jsonb,
  preferred_tier public.tier,
  prototype_url text,
  published_at timestamptz
);

create table public.kanban_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id),
  title text not null,
  phase text,
  macro_version text check (macro_version in ('V1', 'V2', 'V3')),
  status public.kanban_status not null default 'a_fazer',
  scheduled_date date,
  completed_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activity_events (
  id bigint generated always as identity primary key,
  project_id uuid references public.projects(id),
  type text not null,
  actor_id uuid references auth.users(id),
  occurred_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  request_id text unique
);

create index memberships_user_id_idx on public.memberships(user_id);
create index memberships_client_id_idx on public.memberships(client_id);
create index projects_client_id_idx on public.projects(client_id);
create index projects_lead_id_idx on public.projects(lead_id);
create index kanban_items_project_id_idx on public.kanban_items(project_id);
create index activity_events_project_id_idx on public.activity_events(project_id);
create index activity_events_actor_id_idx on public.activity_events(actor_id);

alter function public.set_updated_at() set search_path = '';

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create trigger kanban_items_set_updated_at
  before update on public.kanban_items
  for each row execute function public.set_updated_at();

alter table public.memberships enable row level security;
alter table public.projects enable row level security;
alter table public.roadmaps enable row level security;
alter table public.kanban_items enable row level security;
alter table public.activity_events enable row level security;

create or replace function public.is_no_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'NO_ADMIN',
    false
  );
$$;

revoke all on function public.is_no_admin() from public;
grant execute on function public.is_no_admin() to anon, authenticated, service_role;

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
      join public.memberships as m
        on m.client_id = p.client_id
      where p.id = p_project_id
        and m.user_id = (select auth.uid())
        and (
          p.access_status = 'ATIVO_ATE_FIM_DO_PROJETO'::public.access_status
          or (
            p.access_status = 'INICIAL_15_DIAS'::public.access_status
            and p.access_released_at is not null
            and now() < p.access_released_at + interval '15 days'
          )
        )
        and (
          p_module is null
          or p.modules ->> p_module = 'ativo'
        )
    );
$$;

revoke all on function public.can_read_project(uuid, text) from public;
grant execute on function public.can_read_project(uuid, text)
  to anon, authenticated, service_role;

create policy memberships_select_authorized
on public.memberships for select
to authenticated
using (public.is_no_admin() or user_id = (select auth.uid()));

create policy memberships_insert_admin
on public.memberships for insert
to authenticated
with check (public.is_no_admin());

create policy memberships_update_admin
on public.memberships for update
to authenticated
using (public.is_no_admin())
with check (public.is_no_admin());

create policy memberships_delete_admin
on public.memberships for delete
to authenticated
using (public.is_no_admin());

create policy projects_select_authorized
on public.projects for select
to authenticated
using (public.can_read_project(id));

create policy projects_insert_admin
on public.projects for insert
to authenticated
with check (public.is_no_admin());

create policy projects_update_admin
on public.projects for update
to authenticated
using (public.is_no_admin())
with check (public.is_no_admin());

create policy projects_delete_admin
on public.projects for delete
to authenticated
using (public.is_no_admin());

create policy roadmaps_select_authorized
on public.roadmaps for select
to authenticated
using (
  public.can_read_project(project_id, 'como_funciona')
  or public.can_read_project(project_id, 'prototipo')
);

create policy roadmaps_insert_admin
on public.roadmaps for insert
to authenticated
with check (public.is_no_admin());

create policy roadmaps_update_admin
on public.roadmaps for update
to authenticated
using (public.is_no_admin())
with check (public.is_no_admin());

create policy roadmaps_delete_admin
on public.roadmaps for delete
to authenticated
using (public.is_no_admin());

create policy kanban_items_select_authorized
on public.kanban_items for select
to authenticated
using (public.can_read_project(project_id, 'etapas'));

create policy kanban_items_insert_admin
on public.kanban_items for insert
to authenticated
with check (public.is_no_admin());

create policy kanban_items_update_admin
on public.kanban_items for update
to authenticated
using (public.is_no_admin())
with check (public.is_no_admin());

create policy kanban_items_delete_admin
on public.kanban_items for delete
to authenticated
using (public.is_no_admin());

create policy activity_events_select_authorized
on public.activity_events for select
to authenticated
using (
  public.is_no_admin()
  or (project_id is not null and public.can_read_project(project_id))
);

create policy activity_events_insert_authorized
on public.activity_events for insert
to authenticated
with check (
  public.is_no_admin()
  or (project_id is not null and public.can_read_project(project_id))
);

revoke all on public.memberships, public.projects, public.roadmaps,
  public.kanban_items, public.activity_events from anon, authenticated;

grant select on public.memberships, public.projects, public.roadmaps,
  public.kanban_items, public.activity_events to anon;

grant select, insert, update, delete on public.memberships, public.projects,
  public.roadmaps, public.kanban_items to authenticated;

grant select, insert on public.activity_events to authenticated;

revoke update, delete on public.activity_events from anon, authenticated;

grant all on public.memberships, public.projects, public.roadmaps,
  public.kanban_items, public.activity_events to service_role;

grant usage, select on sequence public.activity_events_id_seq
  to authenticated, service_role;

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
  end as effective_access_status
from public.projects as p;

revoke all on public.project_access from public, anon, authenticated;
grant select on public.project_access to anon, authenticated, service_role;

create or replace function public.record_activity_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_after jsonb := to_jsonb(new);
  v_field text;
  v_old_skip text;
  v_project_id uuid;
  v_event_type text;
begin
  if current_setting('app.skip_activity', true) = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_before := null;
    v_field := 'registro';
  else
    v_before := to_jsonb(old);
    select changed.key
      into v_field
      from jsonb_each(v_after) as changed(key, value)
      where changed.key <> 'updated_at'
        and v_before -> changed.key is distinct from changed.value
      order by changed.key
      limit 1;

    if v_field is null then
      v_field := 'updated_at';
    end if;
  end if;

  if tg_table_name = 'projects' then
    v_project_id := new.id;
    v_event_type := case tg_op
      when 'INSERT' then 'project.created'
      else 'project.updated'
    end;
  else
    v_project_id := new.project_id;
    v_event_type := case tg_op
      when 'INSERT' then 'kanban_item.created'
      else 'kanban_item.updated'
    end;
  end if;

  v_old_skip := current_setting('app.skip_activity', true);
  perform set_config('app.skip_activity', 'on', true);

  insert into public.activity_events (project_id, type, actor_id, payload)
  values (
    v_project_id,
    v_event_type,
    (select auth.uid()),
    jsonb_build_object(
      'campo', v_field,
      'antes', case when v_before is null then null else v_before -> v_field end,
      'depois', v_after -> v_field
    )
  );

  perform set_config('app.skip_activity', coalesce(v_old_skip, 'off'), true);
  return new;
end;
$$;

revoke all on function public.record_activity_event() from public, anon, authenticated;
grant execute on function public.record_activity_event() to service_role;

create trigger projects_record_activity
  after insert or update on public.projects
  for each row execute function public.record_activity_event();

create trigger kanban_items_record_activity
  after insert or update on public.kanban_items
  for each row execute function public.record_activity_event();
