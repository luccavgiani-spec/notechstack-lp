begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

select has_table('public', 'payments', 'C3 payments table exists');
select has_table('public', 'payment_events', 'C10 payment_events table exists');
select has_column('public', 'payments', 'payload', 'C3 pending payment keeps roadmap answers');
select col_is_pk('public', 'payments', 'id', 'C3 payments id is primary key');
select col_is_unique('public', 'payments', 'gateway_order_id', 'C8 gateway order is unique');
select col_is_unique('public', 'payment_events', 'gateway_event_id', 'C11 gateway event is unique');
select has_index('public', 'payments', 'payments_one_open_per_lead_idx', 'C8 one open payment index exists');
select has_index('public', 'payments', 'payments_lead_id_idx', 'C17 payments lead FK is indexed');
select has_index('public', 'payments', 'payments_project_id_idx', 'C17 payments project FK is indexed');
select has_index('public', 'payment_events', 'payment_events_payment_id_idx', 'C17 payment event FK is indexed');
select ok((select relrowsecurity from pg_class where oid = 'public.payments'::regclass), 'C9 payments has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.payment_events'::regclass), 'C9 payment_events has RLS');
select ok(not has_table_privilege('anon', 'public.payments', 'SELECT'), 'C9 anon cannot read payments');
select ok(not has_table_privilege('authenticated', 'public.payments', 'SELECT'), 'C9 authenticated cannot read payments');
select ok(not has_table_privilege('anon', 'public.payment_events', 'SELECT'), 'C12 anon cannot read events');
select ok(not has_table_privilege('authenticated', 'public.payment_events', 'UPDATE'), 'C9 events cannot be updated by authenticated');

insert into public.leads (id, nome, email, whatsapp, contexto, sid) values
  ('31000000-0000-4000-8000-000000000001', 'Lead Pago', 'pago@example.test', '(11) 99999-0001', 'roadmap', 'sid-paid'),
  ('31000000-0000-4000-8000-000000000002', 'Lead Divergente', 'divergente@example.test', '(11) 99999-0002', 'roadmap', 'sid-mismatch'),
  ('31000000-0000-4000-8000-000000000003', 'Lead Falhou', 'falhou@example.test', '(11) 99999-0003', 'roadmap', 'sid-failed'),
  ('31000000-0000-4000-8000-000000000004', 'Lead Cancelou', 'cancelou@example.test', '(11) 99999-0004', 'roadmap', 'sid-canceled');

insert into public.payments (
  id, lead_id, purpose, method, amount_cents, status, gateway_order_id, payload
) values
  (
    '32000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001',
    'roadmap', 'pix', 14990, 'pending', 'or_paid',
    '{"answers":{"objetivo":"Vender","negocio":"SaaS","publico":"PMEs","ferramentas":"Planilha","resultado":"MVP"}}'
  ),
  (
    '32000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000002',
    'roadmap', 'pix', 14990, 'pending', 'or_mismatch', '{"answers":{}}'
  ),
  (
    '32000000-0000-4000-8000-000000000003', '31000000-0000-4000-8000-000000000003',
    'roadmap', 'pix', 14990, 'pending', 'or_failed', '{"answers":{}}'
  ),
  (
    '32000000-0000-4000-8000-000000000004', '31000000-0000-4000-8000-000000000004',
    'roadmap', 'pix', 14990, 'pending', 'or_canceled', '{"answers":{}}'
  );

select is(
  public.apply_roadmap_payment_event(
    'evt_paid', 'order.paid', 'or_paid', 'ch_paid', 'paid', 'paid',
    '{"id":"evt_paid","type":"order.paid"}', '2026-09-15 02:30:00+00'
  ) ->> 'status',
  'approved',
  'C10 paid event applies approved state'
);

select is((select status from public.payments where id = '32000000-0000-4000-8000-000000000001'), 'approved', 'C10 payment is approved');
select is((select count(*)::integer from public.payment_events where payment_id = '32000000-0000-4000-8000-000000000001'), 1, 'C10 one event is stored');
select is((select count(*)::integer from public.clients where email = 'pago@example.test'), 1, 'C10 one client is created');
select is((select count(*)::integer from public.projects where lead_id = '31000000-0000-4000-8000-000000000001' and lead_status = 'ROADMAP_PAGO'), 1, 'C10 one ROADMAP_PAGO project is created');
select is((select count(*)::integer from public.roadmaps r join public.projects p on p.id = r.project_id where p.lead_id = '31000000-0000-4000-8000-000000000001'), 1, 'C10 one roadmap is created');
select is((select answers ->> 'resultado' from public.roadmaps r join public.projects p on p.id = r.project_id where p.lead_id = '31000000-0000-4000-8000-000000000001'), 'MVP', 'C10 answers move to roadmap');
select is((select count(*)::integer from public.kanban_items k join public.projects p on p.id = k.project_id where p.lead_id = '31000000-0000-4000-8000-000000000001'), 2, 'C10 two kanban items are created');
select is((select scheduled_date from public.kanban_items k join public.projects p on p.id = k.project_id where p.lead_id = '31000000-0000-4000-8000-000000000001' and k.title = 'Dia 1 — referências'), '2026-09-15'::date, 'C10 D+1 uses America/Sao_Paulo payment date');
select is((select scheduled_date from public.kanban_items k join public.projects p on p.id = k.project_id where p.lead_id = '31000000-0000-4000-8000-000000000001' and k.title = 'Entrega — seu dashboard'), '2026-09-17'::date, 'C10 D+3 uses America/Sao_Paulo payment date');
select is((select count(*)::integer from public.activity_events a join public.projects p on p.id = a.project_id where p.lead_id = '31000000-0000-4000-8000-000000000001'), 1, 'C10 exactly one activity event is created');

select ok((public.apply_roadmap_payment_event(
  'evt_paid', 'order.paid', 'or_paid', 'ch_paid', 'paid', 'paid',
  '{"id":"evt_paid"}', '2026-09-15 02:30:00+00'
) ->> 'idempotent')::boolean, 'C11 duplicate gateway event is idempotent');
select is((select count(*)::integer from public.payment_events where gateway_event_id = 'evt_paid'), 1, 'C11 duplicate does not add event');
select is((select count(*)::integer from public.projects where lead_id = '31000000-0000-4000-8000-000000000001'), 1, 'C11 duplicate does not add project');
select is((select count(*)::integer from public.kanban_items k join public.projects p on p.id = k.project_id where p.lead_id = '31000000-0000-4000-8000-000000000001'), 2, 'C11 duplicate does not add items');

select is(public.apply_roadmap_payment_event(
  'evt_mismatch', 'order.paid', 'or_mismatch', null, 'paid', 'pending',
  '{"id":"evt_mismatch"}', now()
) ->> 'reason', 'status_mismatch', 'C13 divergent confirmation is not applied');
select is((select status from public.payments where gateway_order_id = 'or_mismatch'), 'pending', 'C13 divergent confirmation keeps payment pending');
select is((select count(*)::integer from public.payment_events where gateway_event_id = 'evt_mismatch'), 1, 'C13 divergent confirmation is recorded');
select is((select count(*)::integer from public.projects where lead_id = '31000000-0000-4000-8000-000000000002'), 0, 'C13 divergent confirmation creates no project');

select is(public.apply_roadmap_payment_event(
  'evt_late_failed', 'charge.payment_failed', 'or_paid', 'ch_paid', 'failed', 'failed',
  '{"id":"evt_late_failed"}', now()
) ->> 'reason', 'no_regression', 'C14 failure after approval is not applied');
select is((select status from public.payments where gateway_order_id = 'or_paid'), 'approved', 'C14 approved status does not regress');
select is((select count(*)::integer from public.payment_events where payment_id = '32000000-0000-4000-8000-000000000001'), 2, 'C14 late failure remains in history');

select is(public.apply_roadmap_payment_event(
  'evt_failed', 'charge.payment_failed', 'or_failed', 'ch_failed', 'failed', 'failed',
  '{"id":"evt_failed"}', now()
) ->> 'status', 'failed', 'C15 failed confirmation applies failed state');
select is(public.apply_roadmap_payment_event(
  'evt_canceled', 'order.canceled', 'or_canceled', 'ch_canceled', 'canceled', 'canceled',
  '{"id":"evt_canceled"}', now()
) ->> 'status', 'failed', 'C15 canceled confirmation maps to failed state');
select is((select count(*)::integer from public.projects where lead_id in ('31000000-0000-4000-8000-000000000003', '31000000-0000-4000-8000-000000000004')), 0, 'C15 failed Pix creates no project');

select * from finish();
rollback;
