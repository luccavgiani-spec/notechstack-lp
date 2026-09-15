-- F3-11: saldos, parcelas manuais e estados financeiros confirmados pelo gateway.
-- A leitura e as mutações passam pelas RPCs administrativas; nenhum segredo do
-- gateway ou dado de cartão chega ao cliente.

create table public.installments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  number integer not null check (number > 0),
  amount_cents integer not null check (amount_cents > 0),
  due_date date not null,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, number)
);

create index installments_project_due_date_idx
  on public.installments(project_id, due_date);

create or replace function public.installments_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger installments_set_updated_at
  before update on public.installments
  for each row execute function public.installments_set_updated_at();

alter table public.installments enable row level security;
revoke all on public.installments from public, anon, authenticated;
grant all on public.installments to service_role;

-- A única leitura exposta à aplicação é a visão agregada abaixo. O RPC exige
-- NO_ADMIN, então CLIENT não recebe nem parcelas nem pagamentos.
create or replace function public.list_admin_saldos()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_result jsonb;
begin
  perform public.r1_06_require_admin();

  with installment_rows as (
    select i.id::text as id, i.project_id, p.name as project_name, i.number,
      i.amount_cents, i.due_date, i.received_at, false as legacy
    from public.installments i
    join public.projects p on p.id = i.project_id
    union all
    select ('legacy:' || ct.project_id::text || ':' || gs.number)::text,
      ct.project_id, p.name, gs.number,
      (ct.amount_cents / ct.installments) + case when gs.number <= mod(ct.amount_cents, ct.installments) then 1 else 0 end,
      null::date, null::timestamptz, true
    from public.commercial_terms ct
    join public.projects p on p.id = ct.project_id
    cross join lateral generate_series(1, ct.installments) as gs(number)
    where not exists (
      select 1 from public.installments i
      where i.project_id = ct.project_id and i.number = gs.number
    )
  ),
  movements as (
    select
      'payment:' || pay.id::text as id,
      pay.project_id as project_id,
      p.name as project_name,
      coalesce(pay.updated_at, pay.created_at) as occurred_at,
      case when pay.status = 'approved' then pay.amount_cents else -pay.amount_cents end as amount_cents,
      case pay.status when 'approved' then 'aprovacao' when 'refunded' then 'reembolso' when 'chargedback' then 'estorno' else 'tentativa' end as type,
      pay.status as status,
      'payment' as source,
      null::text as installment_id
    from public.payments pay
    left join public.projects p on p.id = pay.project_id
    where pay.status in ('approved', 'refunded', 'chargedback', 'created', 'pending', 'failed', 'canceled')
    union all
    select
      'installment:' || ir.id,
      ir.project_id,
      ir.project_name,
      ir.received_at,
      ir.amount_cents,
      'recebimento', 'recebida', 'installment', ir.id
    from installment_rows ir
    where ir.received_at is not null
    union all
    select
      'installment:' || ir.id,
      ir.project_id,
      ir.project_name,
      ir.due_date::timestamptz,
      ir.amount_cents,
      case when ir.due_date < v_today then 'parcela_vencida' else 'parcela' end,
      case when ir.due_date < v_today then 'pendente' else 'prevista' end,
      'installment', ir.id
    from installment_rows ir
    where ir.received_at is null and ir.due_date is not null
    union all
    select
      'installment:' || ir.id,
      ir.project_id,
      ir.project_name,
      null::timestamptz,
      ir.amount_cents,
      'parcela_legada', 'prevista', 'installment', ir.id
    from installment_rows ir
    where ir.received_at is null and ir.due_date is null
  ),
  normalized as (
    select m.*,
      case
        when m.source = 'payment' and m.status in ('approved', 'refunded', 'chargedback') then 'realizado'
        when m.source = 'installment' and m.status = 'recebida' then 'realizado'
        when (m.source = 'payment' and m.status in ('created', 'pending', 'failed', 'canceled'))
          or (m.source = 'installment' and m.status = 'pendente') then 'pendente'
        else 'previsto'
      end as bucket
    from movements m
  ),
  projected as (
    select coalesce(sum(n.amount_cents) filter (where n.source = 'installment' and n.status = 'prevista'), 0)::integer as total,
      coalesce(sum(n.amount_cents) filter (where n.source = 'installment' and n.status = 'prevista' and n.occurred_at::date between v_today and v_today + 15), 0)::integer as d15,
      coalesce(sum(n.amount_cents) filter (where n.source = 'installment' and n.status = 'prevista' and n.occurred_at::date > v_today + 15 and n.occurred_at::date <= v_today + 30), 0)::integer as d30,
      coalesce(sum(n.amount_cents) filter (where n.source = 'installment' and n.status = 'prevista' and n.occurred_at::date > v_today + 30 and n.occurred_at::date <= v_today + 45), 0)::integer as d45
    from normalized n
  )
  select jsonb_build_object(
    'today', v_today,
    'realizedCents', coalesce(sum(n.amount_cents) filter (where n.bucket = 'realizado'), 0)::integer,
    'pendingCents', coalesce(sum(n.amount_cents) filter (where n.bucket = 'pendente'), 0)::integer,
    'projectedCents', coalesce(sum(n.amount_cents) filter (where n.bucket = 'previsto'), 0)::integer,
    'projections', jsonb_build_object('15', max(pr.d15), '30', max(pr.d30), '45', max(pr.d45)),
    'realized', coalesce(jsonb_agg(to_jsonb(n) order by n.occurred_at desc nulls last) filter (where n.bucket = 'realizado'), '[]'::jsonb),
    'pending', coalesce(jsonb_agg(to_jsonb(n) order by n.occurred_at desc nulls last) filter (where n.bucket = 'pendente'), '[]'::jsonb),
    'projected', coalesce(jsonb_agg(to_jsonb(n) order by n.occurred_at asc nulls last) filter (where n.bucket = 'previsto'), '[]'::jsonb)
  ) into v_result
  from normalized n cross join projected pr;
  return coalesce(v_result, jsonb_build_object('today', v_today, 'realizedCents', 0, 'pendingCents', 0, 'projectedCents', 0, 'projections', jsonb_build_object('15', 0, '30', 0, '45', 0), 'realized', '[]'::jsonb, 'pending', '[]'::jsonb, 'projected', '[]'::jsonb));
end;
$$;

revoke all on function public.list_admin_saldos() from public, anon;
grant execute on function public.list_admin_saldos() to authenticated, service_role;

create or replace function public.upsert_installment(
  p_project_id uuid,
  p_number integer,
  p_amount_cents integer,
  p_due_date date,
  p_request_id text default null
)
returns public.installments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_installment public.installments%rowtype;
  v_event public.activity_events%rowtype;
begin
  perform public.r1_06_require_admin();
  if p_number is null or p_number < 1 or p_amount_cents is null or p_amount_cents < 1 or p_due_date is null then
    raise exception using errcode = '22023', message = 'INVALID_INSTALLMENT';
  end if;
  if nullif(trim(coalesce(p_request_id, '')), '') is not null then
    select * into v_event from public.activity_events where request_id = p_request_id;
    if found then
      if v_event.project_id is distinct from p_project_id or v_event.type <> 'installment.updated' then
        raise exception using errcode = 'P0001', message = 'REQUEST_ID_CONFLICT';
      end if;
      select * into v_installment from public.installments where id = (v_event.payload ->> 'installment_id')::uuid;
      return v_installment;
    end if;
  end if;
  insert into public.installments(project_id, number, amount_cents, due_date)
  values (p_project_id, p_number, p_amount_cents, p_due_date)
  on conflict (project_id, number) do update set amount_cents = excluded.amount_cents, due_date = excluded.due_date
  returning * into v_installment;
  perform public.r1_06_event(p_project_id, 'installment.updated', jsonb_build_object('installment_id', v_installment.id, 'number', v_installment.number), p_request_id);
  return v_installment;
end;
$$;

revoke all on function public.upsert_installment(uuid, integer, integer, date, text) from public, anon;
grant execute on function public.upsert_installment(uuid, integer, integer, date, text) to authenticated, service_role;

create or replace function public.mark_installment_received(
  p_installment_id uuid,
  p_received_at timestamptz default now(),
  p_request_id text default null
)
returns public.installments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_installment public.installments%rowtype;
  v_event public.activity_events%rowtype;
begin
  perform public.r1_06_require_admin();
  select * into v_installment from public.installments where id = p_installment_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'INSTALLMENT_NOT_FOUND'; end if;
  if nullif(trim(coalesce(p_request_id, '')), '') is not null then
    select * into v_event from public.activity_events where request_id = p_request_id;
    if found then
      if v_event.project_id is distinct from v_installment.project_id or v_event.type <> 'installment.received' then
        raise exception using errcode = 'P0001', message = 'REQUEST_ID_CONFLICT';
      end if;
      return v_installment;
    end if;
  end if;
  if v_installment.received_at is null then
    update public.installments set received_at = coalesce(p_received_at, now()) where id = p_installment_id returning * into v_installment;
    perform public.r1_06_event(v_installment.project_id, 'installment.received', jsonb_build_object('installment_id', v_installment.id, 'amount_cents', v_installment.amount_cents), p_request_id);
  end if;
  return v_installment;
end;
$$;

revoke all on function public.mark_installment_received(uuid, timestamptz, text) from public, anon;
grant execute on function public.mark_installment_received(uuid, timestamptz, text) to authenticated, service_role;

-- A extensão mantém a assinatura e o contrato de R1-03: o webhook segue
-- reconsultando o gateway; o payload continua apenas envelope histórico.
create or replace function public.apply_roadmap_payment_event(
  p_gateway_event_id text, p_type text, p_gateway_order_id text, p_gateway_charge_id text,
  p_event_status text, p_confirmed_status text, p_payload jsonb, p_paid_at timestamptz default now()
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_payment public.payments%rowtype;
  v_lead public.leads%rowtype;
  v_event_id bigint;
  v_client_id uuid;
  v_project_id uuid;
  v_paid_date date;
  v_old_skip text;
  v_activity_type text;
begin
  if nullif(trim(p_gateway_event_id), '') is null or nullif(trim(p_type), '') is null or nullif(trim(p_gateway_order_id), '') is null then
    raise exception 'missing payment event identity' using errcode = '22023';
  end if;
  select p.* into v_payment from public.payments p where p.gateway_order_id = p_gateway_order_id for update;
  insert into public.payment_events(payment_id, gateway_event_id, type, payload)
  values (v_payment.id, p_gateway_event_id, p_type, coalesce(p_payload, '{}'::jsonb))
  on conflict (gateway_event_id) do nothing returning id into v_event_id;
  if v_event_id is null then return jsonb_build_object('idempotent', true, 'applied', false); end if;
  if v_payment.id is null then return jsonb_build_object('idempotent', false, 'applied', false, 'reason', 'payment_not_found'); end if;

  if p_confirmed_status in ('refunded', 'chargedback') then
    if v_payment.status in ('refunded', 'chargedback') then
      return jsonb_build_object('idempotent', false, 'applied', false, 'status', v_payment.status);
    end if;
    if v_payment.status <> 'approved' then
      return jsonb_build_object('idempotent', false, 'applied', false, 'reason', 'awaiting_approval', 'status', v_payment.status);
    end if;
    update public.payments set status = p_confirmed_status, gateway_charge_id = coalesce(p_gateway_charge_id, gateway_charge_id) where id = v_payment.id;
    v_activity_type := case when p_confirmed_status = 'refunded' then 'payment.refunded' else 'payment.chargedback' end;
    perform public.r1_06_event(v_payment.project_id, v_activity_type, jsonb_build_object('payment_id', v_payment.id, 'amount_cents', v_payment.amount_cents, 'gateway_event_id', p_gateway_event_id), 'payment-state:' || p_confirmed_status || ':' || v_payment.id::text);
    return jsonb_build_object('idempotent', false, 'applied', true, 'status', p_confirmed_status, 'project_id', v_payment.project_id);
  end if;
  if p_event_status is distinct from p_confirmed_status then return jsonb_build_object('idempotent', false, 'applied', false, 'reason', 'status_mismatch'); end if;
  if p_confirmed_status in ('failed', 'canceled') then
    if v_payment.status <> 'approved' then update public.payments set status = 'failed', gateway_charge_id = coalesce(p_gateway_charge_id, gateway_charge_id) where id = v_payment.id; return jsonb_build_object('idempotent', false, 'applied', true, 'status', 'failed'); end if;
    return jsonb_build_object('idempotent', false, 'applied', false, 'status', 'approved', 'reason', 'no_regression');
  end if;
  if p_confirmed_status <> 'paid' then return jsonb_build_object('idempotent', false, 'applied', false, 'reason', 'non_terminal'); end if;
  if v_payment.status in ('approved', 'refunded', 'chargedback') then return jsonb_build_object('idempotent', false, 'applied', false, 'status', v_payment.status); end if;
  select l.* into strict v_lead from public.leads l where l.id = v_payment.lead_id;
  insert into public.clients(name, slug, email) values(v_lead.nome, 'roadmap-' || replace(v_lead.id::text, '-', ''), v_lead.email) returning id into v_client_id;
  v_old_skip := current_setting('app.skip_activity', true); perform set_config('app.skip_activity', 'on', true);
  insert into public.projects(client_id, lead_id, name, lead_status) values(v_client_id, v_lead.id, 'Roadmap — ' || v_lead.nome, 'ROADMAP_PAGO'::public.lead_status) returning id into v_project_id;
  insert into public.roadmaps(project_id, answers) values(v_project_id, coalesce(v_payment.payload -> 'answers', '{}'::jsonb));
  v_paid_date := (coalesce(p_paid_at, now()) at time zone 'America/Sao_Paulo')::date;
  insert into public.kanban_items(project_id, title, phase, scheduled_date, position) values(v_project_id, 'Dia 1 — referências', 'roadmap', v_paid_date + 1, 0), (v_project_id, 'Entrega — seu dashboard', 'roadmap', v_paid_date + 3, 1);
  insert into public.activity_events(project_id, type, payload, request_id) values(v_project_id, 'payment.approved', jsonb_build_object('payment_id', v_payment.id, 'amount_cents', v_payment.amount_cents, 'method', v_payment.method), 'payment-approved:' || v_payment.id::text);
  update public.payments set status = 'approved', project_id = v_project_id, gateway_charge_id = coalesce(p_gateway_charge_id, gateway_charge_id) where id = v_payment.id;
  perform set_config('app.skip_activity', coalesce(v_old_skip, 'off'), true);
  return jsonb_build_object('idempotent', false, 'applied', true, 'status', 'approved', 'project_id', v_project_id);
end;
$$;

revoke all on function public.apply_roadmap_payment_event(text, text, text, text, text, text, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_roadmap_payment_event(text, text, text, text, text, text, jsonb, timestamptz) to service_role;
