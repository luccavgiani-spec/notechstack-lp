-- F3-12: global operational capacity. The only initial policy decision is
-- five Kanban items per day; NO_ADMIN can adjust it without a migration.

create table public.operation_settings (
  setting_key text primary key check (setting_key = 'global'),
  daily_item_capacity integer not null check (daily_item_capacity between 1 and 100),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into public.operation_settings(setting_key, daily_item_capacity)
values ('global', 5);

alter table public.operation_settings enable row level security;
revoke all on public.operation_settings from anon, authenticated;
grant all on public.operation_settings to service_role;

create or replace function public.get_admin_schedule_settings()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('dailyItemCapacity', s.daily_item_capacity, 'updatedAt', s.updated_at)
  from public.operation_settings s
  where s.setting_key = 'global' and public.is_no_admin();
$$;
revoke all on function public.get_admin_schedule_settings() from public, anon;
grant execute on function public.get_admin_schedule_settings() to authenticated, service_role;

create or replace function public.set_admin_daily_item_capacity(p_daily_item_capacity integer)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_capacity integer;
begin
  perform public.r1_06_require_admin();
  if p_daily_item_capacity is null or p_daily_item_capacity < 1 or p_daily_item_capacity > 100 then
    raise exception using errcode = '22023', message = 'DAILY_CAPACITY_INVALID';
  end if;
  update public.operation_settings
  set daily_item_capacity = p_daily_item_capacity, updated_at = now(), updated_by = (select auth.uid())
  where setting_key = 'global'
  returning daily_item_capacity into v_capacity;
  return jsonb_build_object('dailyItemCapacity', v_capacity);
end;
$$;
revoke all on function public.set_admin_daily_item_capacity(integer) from public, anon;
grant execute on function public.set_admin_daily_item_capacity(integer) to authenticated, service_role;

create or replace function public.list_admin_schedule_items(
  p_project_id uuid default null,
  p_macro_version text default null,
  p_from date default null,
  p_to date default null
)
returns table(id uuid, project_id uuid, project_name text, title text, phase text, macro_version text, status public.kanban_status, scheduled_date date, completed_at timestamptz, "position" integer)
language sql stable security definer set search_path = ''
as $$
  select k.id, k.project_id, p.name, k.title, k.phase, k.macro_version, k.status, k.scheduled_date, k.completed_at, k.position
  from public.kanban_items k
  join public.projects p on p.id = k.project_id
  where public.is_no_admin()
    and p.project_status is distinct from 'ARQUIVADO'::public.project_status
    and p.archived_at is null
    and (p_project_id is null or k.project_id = p_project_id)
    and (p_macro_version is null or k.macro_version = p_macro_version)
    and (p_from is null or k.scheduled_date >= p_from)
    and (p_to is null or k.scheduled_date <= p_to)
  order by k.status, k.position, k.scheduled_date nulls last;
$$;
revoke all on function public.list_admin_schedule_items(uuid, text, date, date) from public, anon;
grant execute on function public.list_admin_schedule_items(uuid, text, date, date) to authenticated, service_role;
