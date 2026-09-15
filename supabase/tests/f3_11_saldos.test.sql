begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('81000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'f311-admin@example.test', '{"role":"NO_ADMIN"}', '{}', now(), now()),
  ('81000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'f311-client@example.test', '{"role":"CLIENT"}', '{}', now(), now());

insert into public.clients (id, name, slug, email)
values ('82000000-0000-4000-8000-000000000001', 'Cliente F311', 'cliente-f311', 'f311-client@example.test');
insert into public.leads (id, nome, email)
values ('83000000-0000-4000-8000-000000000001', 'Lead F311', 'lead-f311@example.test');
insert into public.projects (id, client_id, lead_id, name, niche, lead_status, project_status, access_status, access_released_at, modules)
values ('84000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000001', 'Financeiro F311', 'servicos', 'CONVERTIDO', 'CONVERTIDO', 'ATIVO_ATE_FIM_DO_PROJETO', now(), '{"como_funciona":"ativo","prototipo":"ativo","etapas":"ativo","editor":"ativo","versoes":"ativo","marca":"ativo"}');
insert into public.memberships (client_id, user_id, role)
values ('82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002', 'CLIENT');
insert into public.payments (id, lead_id, project_id, purpose, method, amount_cents, status, gateway_order_id)
values ('85000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001', 'roadmap', 'pix', 14990, 'approved', 'f311-order');

truncate table public.activity_events restart identity;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"NO_ADMIN"}}', true);

select is((select (public.list_admin_saldos() ->> 'realizedCents')::integer), 14990, 'C3 approved roadmap totals 14990 in realized');
select lives_ok($$select public.upsert_installment('84000000-0000-4000-8000-000000000001', 1, 100000, ((now() at time zone 'America/Sao_Paulo')::date + 15), 'f311-i1')$$, 'C10 installment in 15-day band persists');
select lives_ok($$select public.upsert_installment('84000000-0000-4000-8000-000000000001', 2, 100000, ((now() at time zone 'America/Sao_Paulo')::date + 30), 'f311-i2')$$, 'C10 installment in 30-day band persists');
select lives_ok($$select public.upsert_installment('84000000-0000-4000-8000-000000000001', 3, 100000, ((now() at time zone 'America/Sao_Paulo')::date + 45), 'f311-i3')$$, 'C10 installment in 45-day band persists');
select is((select (public.list_admin_saldos() -> 'projections' ->> '15')::integer), 100000, 'C10 projection 15 is exact');
select is((select (public.list_admin_saldos() -> 'projections' ->> '30')::integer), 100000, 'C10 projection 30 is exact');
select is((select (public.list_admin_saldos() -> 'projections' ->> '45')::integer), 100000, 'C10 projection 45 is exact');
select lives_ok($$select public.mark_installment_received((public.upsert_installment('84000000-0000-4000-8000-000000000001', 1, 100000, ((now() at time zone 'America/Sao_Paulo')::date + 15), 'f311-i1')).id, now(), 'f311-received')$$, 'C11 received installment is accepted');
select is((select count(*)::integer from public.activity_events where request_id = 'f311-received'), 1, 'C11 receipt audits once');
select ok(jsonb_path_exists(public.list_admin_saldos() -> 'realized', '$[*] ? (@.source == "installment" && @.status == "recebida")'), 'C11 receipt preserves the installment row in realized');
reset role;
select lives_ok($$select public.apply_roadmap_payment_event('f311-refund-event', 'charge.refunded', 'f311-order', 'f311-charge', 'refunded', 'refunded', '{}'::jsonb)$$, 'C6 confirmed refund is applied');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"NO_ADMIN"}}', true);
select is((select (public.list_admin_saldos() ->> 'realizedCents')::integer), 85010, 'C6 refund reduces the approved roadmap total');
select is((select count(*)::integer from public.activity_events where type = 'payment.refunded'), 1, 'C6 refund emits one activity event');
reset role;
select lives_ok($$select public.apply_roadmap_payment_event('f311-refund-event', 'charge.refunded', 'f311-order', 'f311-charge', 'refunded', 'refunded', '{}'::jsonb)$$, 'C8 replay is accepted');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"NO_ADMIN"}}', true);
select is((select count(*)::integer from public.activity_events where type = 'payment.refunded'), 1, 'C8 replay keeps one payment activity');
select lives_ok($$select public.upsert_installment('84000000-0000-4000-8000-000000000001', 4, 100000, ((now() at time zone 'America/Sao_Paulo')::date - 1), 'f311-overdue')$$, 'C12 overdue installment persists');
select is((select jsonb_array_length(public.list_admin_saldos() -> 'pending')), 1, 'C12 overdue installment is pending');

select set_config('request.jwt.claims', '{"sub":"81000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"CLIENT"}}', true);
select throws_ok($$select public.list_admin_saldos()$$, '42501', 'NO_ADMIN_REQUIRED', 'C5 client cannot read saldos RPC');

reset role;
select * from finish();
rollback;
