-- R1-06: dashboard operacional da Nó.
-- A migration expõe apenas RPCs administrativas; o browser nunca recebe
-- privilégios de escrita em campos sensíveis por UPDATE direto.

create table if not exists public.commercial_terms (
  project_id uuid primary key references public.projects(id) on delete cascade,
  tier public.tier not null,
  amount_cents integer not null check (amount_cents >= 0),
  payment_method text not null check (length(trim(payment_method)) > 0),
  installments integer not null check (installments >= 1),
  deadline_days integer not null check (deadline_days >= 1),
  starts_on date,
  financial_status text,
  notes text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create or replace function public.commercial_terms_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists commercial_terms_set_updated_at on public.commercial_terms;
create trigger commercial_terms_set_updated_at before update on public.commercial_terms
for each row execute function public.commercial_terms_set_updated_at();

alter table public.commercial_terms enable row level security;
revoke all on public.commercial_terms from anon, authenticated;
grant select on public.commercial_terms to authenticated;
grant all on public.commercial_terms to service_role;
drop policy if exists commercial_terms_admin_select on public.commercial_terms;
create policy commercial_terms_admin_select on public.commercial_terms for select to authenticated
using (public.is_no_admin());

-- Os triggers compartilhados da R1-01 permanecem instalados. As RPCs abaixo
-- suspendem-nos apenas durante a mutação transacional e gravam um evento de
-- domínio explícito, idempotente por request_id.

create or replace function public.r1_06_require_admin()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce((select auth.jwt()) ->> 'role', '') <> 'service_role' and not public.is_no_admin() then
    raise insufficient_privilege using message = 'NO_ADMIN_REQUIRED';
  end if;
end;
$$;
revoke all on function public.r1_06_require_admin() from public, anon, authenticated;
grant execute on function public.r1_06_require_admin() to service_role;

create or replace function public.r1_06_event(
  p_project_id uuid, p_type text, p_payload jsonb, p_request_id text, p_actor_id uuid default null
)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  insert into public.activity_events(project_id, type, actor_id, payload, request_id)
  values (p_project_id, p_type, coalesce(p_actor_id, (select auth.uid())), coalesce(p_payload, '{}'::jsonb), nullif(p_request_id, ''))
  on conflict (request_id) do nothing
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.r1_06_event(uuid, text, jsonb, text, uuid) from public, anon, authenticated;
grant execute on function public.r1_06_event(uuid, text, jsonb, text, uuid) to service_role;

create or replace function public.r1_06_is_replay(
  p_request_id text, p_project_id uuid, p_type text
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_event public.activity_events%rowtype;
begin
  if nullif(trim(coalesce(p_request_id, '')), '') is null then
    return false;
  end if;

  select * into v_event
  from public.activity_events
  where request_id = p_request_id;

  if not found then
    return false;
  end if;

  if v_event.project_id is distinct from p_project_id or v_event.type is distinct from p_type then
    raise exception using errcode = 'P0001', message = 'REQUEST_ID_CONFLICT';
  end if;

  return true;
end;
$$;
revoke all on function public.r1_06_is_replay(text, uuid, text) from public, anon, authenticated;
grant execute on function public.r1_06_is_replay(text, uuid, text) to service_role;

create or replace function public.list_admin_projects()
returns table(
  id uuid, name text, client_name text, company_name text, niche text,
  lead_status public.lead_status, project_status public.project_status,
  access_status public.access_status, effective_access_status public.access_status,
  tier public.tier, created_at timestamptz, next_scheduled_date date,
  payment_status text, modules jsonb
)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name, c.name, l.nome, coalesce(p.niche, l.nicho), p.lead_status, p.project_status,
    p.access_status, pa.effective_access_status, coalesce(ct.tier, p.tier), p.created_at,
    (select min(k.scheduled_date) from public.kanban_items k where k.project_id = p.id and k.status <> 'concluido' and k.scheduled_date is not null) as next_scheduled_date,
    coalesce(ct.financial_status, (select pay.status from public.payments pay where pay.project_id = p.id order by pay.created_at desc limit 1)), p.modules
  from public.projects p
  join public.clients c on c.id = p.client_id
  left join public.leads l on l.id = p.lead_id
  join public.project_access pa on pa.id = p.id
  left join public.commercial_terms ct on ct.project_id = p.id
  where public.is_no_admin()
  order by 11 nulls last, p.created_at desc;
$$;
revoke all on function public.list_admin_projects() from public, anon;
grant execute on function public.list_admin_projects() to authenticated, service_role;

create or replace function public.get_admin_project(p_project_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  perform public.r1_06_require_admin();
  select jsonb_build_object(
    'id', p.id, 'name', p.name, 'clientName', c.name, 'companyName', l.nome,
    'contact', coalesce(c.email, l.email, l.whatsapp), 'origin', coalesce(l.utm_source, l.referrer),
    'niche', coalesce(p.niche, l.nicho), 'leadStatus', p.lead_status, 'projectStatus', p.project_status,
    'accessStatus', p.access_status, 'effectiveAccessStatus', pa.effective_access_status,
    'tier', coalesce(ct.tier, p.tier), 'createdAt', p.created_at, 'enteredAt', p.created_at,
    'nextScheduledDate', (select min(k.scheduled_date) from public.kanban_items k where k.project_id = p.id and k.status <> 'concluido' and k.scheduled_date is not null),
    'paymentStatus', coalesce(ct.financial_status, (select pay.status from public.payments pay where pay.project_id = p.id order by pay.created_at desc limit 1)),
    'modules', p.modules,
    'diagnosis', jsonb_build_object('answers', coalesce(r.answers, '{}'::jsonb), 'references', coalesce(r."references", '[]'::jsonb), 'materials', coalesce(r.stack, '[]'::jsonb), 'observations', coalesce(r.next_steps, '[]'::jsonb)),
    'commercialTerms', to_jsonb(ct),
    'execution', jsonb_build_object('startedAt', null, 'deadline', null, 'phase', (select k.phase from public.kanban_items k where k.project_id = p.id order by k.position, k.scheduled_date nulls last limit 1), 'version', (select k.macro_version from public.kanban_items k where k.project_id = p.id order by k.position, k.scheduled_date nulls last limit 1), 'nextDelivery', (select min(k.scheduled_date) from public.kanban_items k where k.project_id = p.id and k.status <> 'concluido'), 'clientDashboardUrl', null, 'technicalLinks', '[]'::jsonb, 'internalNotes', null),
    'deliverables', jsonb_build_object('roadmap', to_jsonb(r), 'prototypeUrl', r.prototype_url),
    'kanban', coalesce((select jsonb_agg(to_jsonb(k) order by k.position, k.scheduled_date nulls last) from public.kanban_items k where k.project_id = p.id), '[]'::jsonb)
  ) into v_result
  from public.projects p
  join public.clients c on c.id = p.client_id
  left join public.leads l on l.id = p.lead_id
  left join public.roadmaps r on r.project_id = p.id
  left join public.commercial_terms ct on ct.project_id = p.id
  join public.project_access pa on pa.id = p.id
  where p.id = p_project_id;
  return v_result;
end;
$$;
revoke all on function public.get_admin_project(uuid) from public, anon;
grant execute on function public.get_admin_project(uuid) to authenticated, service_role;

create or replace function public.list_admin_activity()
returns table(id bigint, project_id uuid, project_name text, actor_id uuid, actor_label text, type text, occurred_at timestamptz, payload jsonb)
language sql stable security definer set search_path = '' as $$
  select e.id, e.project_id, p.name, e.actor_id, coalesce(u.email, e.actor_id::text), e.type, e.occurred_at, e.payload
  from public.activity_events e
  left join public.projects p on p.id = e.project_id
  left join auth.users u on u.id = e.actor_id
  where public.is_no_admin()
  order by e.occurred_at desc;
$$;
revoke all on function public.list_admin_activity() from public, anon;
grant execute on function public.list_admin_activity() to authenticated, service_role;

create or replace function public.list_admin_kanban_items()
returns table(id uuid, project_id uuid, project_name text, title text, phase text, macro_version text, status public.kanban_status, scheduled_date date, completed_at timestamptz, "position" integer)
language sql stable security definer set search_path = '' as $$
  select k.id, k.project_id, p.name, k.title, k.phase, k.macro_version, k.status, k.scheduled_date, k.completed_at, k.position
  from public.kanban_items k join public.projects p on p.id = k.project_id
  where public.is_no_admin()
  order by k.scheduled_date nulls last, k.position;
$$;
revoke all on function public.list_admin_kanban_items() from public, anon;
grant execute on function public.list_admin_kanban_items() to authenticated, service_role;

create or replace function public.update_commercial_terms(
  p_project_id uuid, p_tier public.tier, p_amount_cents integer, p_payment_method text,
  p_installments integer, p_deadline_days integer, p_starts_on date default null,
  p_financial_status text default null, p_notes text default null, p_request_id text default null
)
returns public.commercial_terms language plpgsql security definer set search_path = '' as $$
declare v_old public.commercial_terms%rowtype; v_new public.commercial_terms%rowtype; v_field text; v_event_request text := coalesce(nullif(trim(p_request_id), ''), 'commercial:' || p_project_id::text || ':' || clock_timestamp()::text);
begin
  perform public.r1_06_require_admin();
  if public.r1_06_is_replay(p_request_id, p_project_id, 'commercial_terms.updated') then
    select * into v_new from public.commercial_terms where project_id = p_project_id;
    return v_new;
  end if;
  select * into v_old from public.commercial_terms where project_id = p_project_id for update;
  insert into public.commercial_terms(project_id, tier, amount_cents, payment_method, installments, deadline_days, starts_on, financial_status, notes, updated_by)
  values (p_project_id, p_tier, p_amount_cents, p_payment_method, p_installments, p_deadline_days, p_starts_on, p_financial_status, p_notes, (select auth.uid()))
  on conflict (project_id) do update set tier = excluded.tier, amount_cents = excluded.amount_cents, payment_method = excluded.payment_method, installments = excluded.installments, deadline_days = excluded.deadline_days, starts_on = excluded.starts_on, financial_status = excluded.financial_status, notes = excluded.notes, updated_by = excluded.updated_by
  returning * into v_new;
  v_field := case when v_old.project_id is null then 'registro' when v_old.tier is distinct from v_new.tier then 'tier' when v_old.amount_cents is distinct from v_new.amount_cents then 'amount_cents' when v_old.payment_method is distinct from v_new.payment_method then 'payment_method' when v_old.installments is distinct from v_new.installments then 'installments' when v_old.deadline_days is distinct from v_new.deadline_days then 'deadline_days' when v_old.starts_on is distinct from v_new.starts_on then 'starts_on' when v_old.financial_status is distinct from v_new.financial_status then 'financial_status' else 'notes' end;
  perform public.r1_06_event(p_project_id, 'commercial_terms.updated', jsonb_build_object('campo', v_field, 'antes', case when v_old.project_id is null then null else to_jsonb(v_old) -> v_field end, 'depois', to_jsonb(v_new) -> v_field), v_event_request);
  return v_new;
end;
$$;
revoke all on function public.update_commercial_terms(uuid, public.tier, integer, text, integer, integer, date, text, text, text) from public, anon;
grant execute on function public.update_commercial_terms(uuid, public.tier, integer, text, integer, integer, date, text, text, text) to authenticated, service_role;

create or replace function public.transition_project_lead(p_project_id uuid, p_target public.lead_status, p_request_id text default null)
returns public.projects language plpgsql security definer set search_path = '' as $$
declare v_project public.projects%rowtype; v_expected public.lead_status; v_old_skip text;
begin
  perform public.r1_06_require_admin();
  if public.r1_06_is_replay(p_request_id, p_project_id, 'project.lead_status_changed') then
    select * into v_project from public.projects where id = p_project_id;
    return v_project;
  end if;
  select * into v_project from public.projects where id = p_project_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'PROJECT_NOT_FOUND'; end if;
  v_expected := case when p_target = 'REFERENCIAS_PENDENTES' then 'ROADMAP_PAGO'::public.lead_status when p_target = 'EM_PRODUCAO' then 'REFERENCIAS_PENDENTES'::public.lead_status else null end;
  if v_expected is null or v_project.lead_status is distinct from v_expected then raise exception using errcode = 'P0001', message = 'LEAD_TRANSITION_NOT_ALLOWED'; end if;
  v_old_skip := current_setting('app.skip_activity', true);
  perform set_config('app.skip_activity', 'on', true);
  update public.projects set lead_status = p_target where id = p_project_id returning * into v_project;
  perform set_config('app.skip_activity', coalesce(v_old_skip, 'off'), true);
  perform public.r1_06_event(p_project_id, 'project.lead_status_changed', jsonb_build_object('antes', v_expected, 'depois', p_target), p_request_id);
  return v_project;
end;
$$;
revoke all on function public.transition_project_lead(uuid, public.lead_status, text) from public, anon;
grant execute on function public.transition_project_lead(uuid, public.lead_status, text) to authenticated, service_role;

create or replace function public.upsert_admin_kanban_item(
  p_project_id uuid, p_item_id uuid, p_title text, p_phase text, p_macro_version text,
  p_status public.kanban_status, p_scheduled_date date, p_position integer, p_request_id text default null
)
returns public.kanban_items language plpgsql security definer set search_path = '' as $$
declare v_item public.kanban_items%rowtype; v_old public.kanban_items%rowtype; v_event public.activity_events%rowtype; v_old_skip text;
begin
  perform public.r1_06_require_admin();
  if nullif(trim(coalesce(p_request_id, '')), '') is not null then
    select * into v_event from public.activity_events where request_id = p_request_id;
    if found then
      if v_event.project_id is distinct from p_project_id or v_event.type not in ('kanban_item.created', 'kanban_item.updated') then
        raise exception using errcode = 'P0001', message = 'REQUEST_ID_CONFLICT';
      end if;
      select * into v_item from public.kanban_items where id = (v_event.payload ->> 'item_id')::uuid;
      return v_item;
    end if;
  end if;
  v_old_skip := current_setting('app.skip_activity', true);
  perform set_config('app.skip_activity', 'on', true);
  if p_item_id is null then
    insert into public.kanban_items(project_id, title, phase, macro_version, status, scheduled_date, position) values(p_project_id, coalesce(nullif(trim(p_title), ''), 'Novo item'), p_phase, p_macro_version, coalesce(p_status, 'a_fazer'), p_scheduled_date, coalesce(p_position, 0)) returning * into v_item;
    perform public.r1_06_event(p_project_id, 'kanban_item.created', jsonb_build_object('item_id', v_item.id, 'depois', to_jsonb(v_item)), p_request_id);
  else
    select * into v_old from public.kanban_items where id = p_item_id and project_id = p_project_id for update;
    if not found then raise exception using errcode = 'P0002', message = 'KANBAN_ITEM_NOT_FOUND'; end if;
    update public.kanban_items set title = coalesce(nullif(trim(p_title), ''), title), phase = p_phase, macro_version = p_macro_version, status = coalesce(p_status, status), scheduled_date = p_scheduled_date, position = coalesce(p_position, position), completed_at = case when p_status = 'concluido' then coalesce(completed_at, now()) when p_status = 'a_fazer' then null else completed_at end where id = p_item_id returning * into v_item;
    perform public.r1_06_event(p_project_id, 'kanban_item.updated', jsonb_build_object('item_id', v_item.id, 'antes', to_jsonb(v_old), 'depois', to_jsonb(v_item)), p_request_id);
  end if;
  perform set_config('app.skip_activity', coalesce(v_old_skip, 'off'), true);
  return v_item;
end;
$$;
revoke all on function public.upsert_admin_kanban_item(uuid, uuid, text, text, text, public.kanban_status, date, integer, text) from public, anon;
grant execute on function public.upsert_admin_kanban_item(uuid, uuid, text, text, text, public.kanban_status, date, integer, text) to authenticated, service_role;

create or replace function public.activate_brand_module(p_project_id uuid, p_request_id text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_modules jsonb; v_old_skip text;
begin
  perform public.r1_06_require_admin();
  if public.r1_06_is_replay(p_request_id, p_project_id, 'project.brand_module_activated') then
    select modules into v_modules from public.projects where id = p_project_id;
    return v_modules;
  end if;
  v_old_skip := current_setting('app.skip_activity', true);
  perform set_config('app.skip_activity', 'on', true);
  update public.projects set modules = jsonb_set(coalesce(modules, '{}'::jsonb), '{marca}', '"ativo"'::jsonb) where id = p_project_id returning modules into v_modules;
  perform set_config('app.skip_activity', coalesce(v_old_skip, 'off'), true);
  if v_modules is null then raise exception using errcode = 'P0002', message = 'PROJECT_NOT_FOUND'; end if;
  perform public.r1_06_event(p_project_id, 'project.brand_module_activated', jsonb_build_object('modulo', 'marca'), p_request_id);
  return v_modules;
end;
$$;
revoke all on function public.activate_brand_module(uuid, text) from public, anon;
grant execute on function public.activate_brand_module(uuid, text) to authenticated, service_role;

create or replace function public.transition_project_status(p_project_id uuid, p_target public.project_status, p_request_id text default null)
returns public.projects language plpgsql security definer set search_path = '' as $$
declare v_project public.projects%rowtype; v_old_skip text;
begin
  perform public.r1_06_require_admin();
  if public.r1_06_is_replay(p_request_id, p_project_id, 'project.project_status_changed') then
    select * into v_project from public.projects where id = p_project_id;
    return v_project;
  end if;
  select * into v_project from public.projects where id = p_project_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'PROJECT_NOT_FOUND'; end if;
  if v_project.project_status is distinct from 'CONVERTIDO'::public.project_status or p_target <> 'AGENDADO'::public.project_status then raise exception using errcode = 'P0001', message = 'PROJECT_TRANSITION_NOT_ALLOWED'; end if;
  v_old_skip := current_setting('app.skip_activity', true);
  perform set_config('app.skip_activity', 'on', true);
  update public.projects set project_status = p_target where id = p_project_id returning * into v_project;
  perform set_config('app.skip_activity', coalesce(v_old_skip, 'off'), true);
  perform public.r1_06_event(p_project_id, 'project.project_status_changed', jsonb_build_object('antes', 'CONVERTIDO', 'depois', p_target), p_request_id);
  return v_project;
end;
$$;
revoke all on function public.transition_project_status(uuid, public.project_status, text) from public, anon;
grant execute on function public.transition_project_status(uuid, public.project_status, text) to authenticated, service_role;

create or replace function public.convert_project(
  p_project_id uuid, p_tier public.tier, p_amount_cents integer, p_payment_method text,
  p_installments integer, p_deadline_days integer, p_request_id text, p_actor_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_project public.projects%rowtype; v_effective_access public.access_status; v_old_skip text;
begin
  perform public.r1_06_require_admin();
  if nullif(trim(coalesce(p_request_id, '')), '') is null then
    raise exception using errcode = '22023', message = 'REQUEST_ID_REQUIRED';
  end if;
  select * into v_project from public.projects where id = p_project_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'PROJECT_NOT_FOUND'; end if;
  if public.r1_06_is_replay(p_request_id, p_project_id, 'project.converted') then
    return jsonb_build_object('projectId', v_project.id, 'leadStatus', v_project.lead_status, 'projectStatus', v_project.project_status, 'accessStatus', v_project.access_status);
  end if;
  if v_project.lead_status = 'CONVERTIDO' or v_project.project_status = 'CONVERTIDO' then raise exception using errcode = 'P0001', message = 'PROJECT_ALREADY_CONVERTED'; end if;
  select effective_access_status into v_effective_access from public.project_access where id = p_project_id;
  if v_project.lead_status is distinct from 'JANELA_DE_DECISAO'::public.lead_status and v_effective_access is distinct from 'EXPIRADO'::public.access_status then raise exception using errcode = 'P0001', message = 'PROJECT_STATE_NOT_ALLOWED'; end if;
  insert into public.commercial_terms(project_id, tier, amount_cents, payment_method, installments, deadline_days, updated_by) values(p_project_id, p_tier, p_amount_cents, p_payment_method, p_installments, p_deadline_days, (select auth.uid())) on conflict(project_id) do update set tier = excluded.tier, amount_cents = excluded.amount_cents, payment_method = excluded.payment_method, installments = excluded.installments, deadline_days = excluded.deadline_days, updated_by = excluded.updated_by;
  v_old_skip := current_setting('app.skip_activity', true);
  perform set_config('app.skip_activity', 'on', true);
  update public.projects set lead_status = 'CONVERTIDO', project_status = 'CONVERTIDO', access_status = 'ATIVO_ATE_FIM_DO_PROJETO', tier = p_tier, modules = jsonb_set(coalesce(modules, '{}'::jsonb), '{marca}', '"ativo"'::jsonb) where id = p_project_id;
  perform set_config('app.skip_activity', coalesce(v_old_skip, 'off'), true);
  perform public.r1_06_event(p_project_id, 'project.converted', jsonb_build_object('tier', p_tier, 'amount_cents', p_amount_cents, 'payment_method', p_payment_method, 'installments', p_installments, 'deadline_days', p_deadline_days), p_request_id, p_actor_id);
  return jsonb_build_object('projectId', p_project_id, 'leadStatus', 'CONVERTIDO', 'projectStatus', 'CONVERTIDO', 'accessStatus', 'ATIVO_ATE_FIM_DO_PROJETO');
end;
$$;
revoke all on function public.convert_project(uuid, public.tier, integer, text, integer, integer, text, uuid) from public, anon;
grant execute on function public.convert_project(uuid, public.tier, integer, text, integer, integer, text, uuid) to authenticated, service_role;
