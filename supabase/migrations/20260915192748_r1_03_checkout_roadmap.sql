-- R1-03: checkout do roadmap e provisionamento transacional por webhook.

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id),
  project_id uuid references public.projects(id),
  purpose text not null check (purpose = 'roadmap'),
  method text not null check (method in ('pix', 'cartao')),
  amount_cents integer not null check (amount_cents > 0),
  status text not null check (
    status in ('created', 'pending', 'approved', 'failed', 'canceled', 'refunded', 'chargedback')
  ),
  gateway_order_id text unique,
  gateway_charge_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index payments_one_open_per_lead_idx
  on public.payments (lead_id)
  where status in ('created', 'pending');
create index payments_lead_id_idx on public.payments(lead_id);
create index payments_project_id_idx on public.payments(project_id);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

create table public.payment_events (
  id bigint generated always as identity primary key,
  payment_id uuid references public.payments(id),
  gateway_event_id text not null unique,
  type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

create index payment_events_payment_id_idx on public.payment_events(payment_id);

alter table public.payments enable row level security;
alter table public.payment_events enable row level security;

revoke all on public.payments, public.payment_events from public, anon, authenticated;
revoke all on sequence public.payment_events_id_seq from public, anon, authenticated;
grant all on public.payments, public.payment_events to service_role;
grant usage, select on sequence public.payment_events_id_seq to service_role;

create or replace function public.apply_roadmap_payment_event(
  p_gateway_event_id text,
  p_type text,
  p_gateway_order_id text,
  p_gateway_charge_id text,
  p_event_status text,
  p_confirmed_status text,
  p_payload jsonb,
  p_paid_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_lead public.leads%rowtype;
  v_event_id bigint;
  v_client_id uuid;
  v_project_id uuid;
  v_paid_date date;
  v_old_skip text;
begin
  if nullif(trim(p_gateway_event_id), '') is null
    or nullif(trim(p_type), '') is null
    or nullif(trim(p_gateway_order_id), '') is null then
    raise exception 'missing payment event identity' using errcode = '22023';
  end if;

  select p.*
    into v_payment
    from public.payments as p
    where p.gateway_order_id = p_gateway_order_id
    for update;

  insert into public.payment_events (
    payment_id, gateway_event_id, type, payload
  ) values (
    v_payment.id, p_gateway_event_id, p_type, coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (gateway_event_id) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return jsonb_build_object('idempotent', true, 'applied', false);
  end if;

  if v_payment.id is null then
    return jsonb_build_object('idempotent', false, 'applied', false, 'reason', 'payment_not_found');
  end if;

  if p_event_status is distinct from p_confirmed_status then
    return jsonb_build_object('idempotent', false, 'applied', false, 'reason', 'status_mismatch');
  end if;

  if p_confirmed_status in ('failed', 'canceled') then
    if v_payment.status <> 'approved' then
      update public.payments
        set status = 'failed',
            gateway_charge_id = coalesce(p_gateway_charge_id, gateway_charge_id)
        where id = v_payment.id;
      return jsonb_build_object('idempotent', false, 'applied', true, 'status', 'failed');
    end if;

    return jsonb_build_object('idempotent', false, 'applied', false, 'status', 'approved', 'reason', 'no_regression');
  end if;

  if p_confirmed_status <> 'paid' then
    return jsonb_build_object('idempotent', false, 'applied', false, 'reason', 'non_terminal');
  end if;

  if v_payment.status = 'approved' then
    return jsonb_build_object('idempotent', false, 'applied', false, 'status', 'approved');
  end if;

  select l.* into strict v_lead
    from public.leads as l
    where l.id = v_payment.lead_id;

  insert into public.clients (name, slug, email)
  values (
    v_lead.nome,
    'roadmap-' || replace(v_lead.id::text, '-', ''),
    v_lead.email
  )
  returning id into v_client_id;

  v_old_skip := current_setting('app.skip_activity', true);
  perform set_config('app.skip_activity', 'on', true);

  insert into public.projects (
    client_id, lead_id, name, lead_status
  ) values (
    v_client_id,
    v_lead.id,
    'Roadmap — ' || v_lead.nome,
    'ROADMAP_PAGO'::public.lead_status
  )
  returning id into v_project_id;

  insert into public.roadmaps (project_id, answers)
  values (v_project_id, coalesce(v_payment.payload -> 'answers', '{}'::jsonb));

  v_paid_date := (coalesce(p_paid_at, now()) at time zone 'America/Sao_Paulo')::date;

  insert into public.kanban_items (
    project_id, title, phase, scheduled_date, position
  ) values
    (v_project_id, 'Dia 1 — referências', 'roadmap', v_paid_date + 1, 0),
    (v_project_id, 'Entrega — seu dashboard', 'roadmap', v_paid_date + 3, 1);

  insert into public.activity_events (
    project_id, type, payload, request_id
  ) values (
    v_project_id,
    'payment.approved',
    jsonb_build_object(
      'payment_id', v_payment.id,
      'amount_cents', v_payment.amount_cents,
      'method', v_payment.method
    ),
    'payment-approved:' || v_payment.id::text
  );

  update public.payments
    set status = 'approved',
        project_id = v_project_id,
        gateway_charge_id = coalesce(p_gateway_charge_id, gateway_charge_id)
    where id = v_payment.id;

  perform set_config('app.skip_activity', coalesce(v_old_skip, 'off'), true);

  return jsonb_build_object(
    'idempotent', false,
    'applied', true,
    'status', 'approved',
    'project_id', v_project_id
  );
end;
$$;

revoke all on function public.apply_roadmap_payment_event(
  text, text, text, text, text, text, jsonb, timestamptz
) from public, anon, authenticated;
grant execute on function public.apply_roadmap_payment_event(
  text, text, text, text, text, text, jsonb, timestamptz
) to service_role;
