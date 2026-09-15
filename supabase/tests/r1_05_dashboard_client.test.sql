begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

create function public.r1_05_test_row_count(p_sql text)
returns integer
language plpgsql
as $$
declare
  v_rows integer;
begin
  execute p_sql;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

grant execute on function public.r1_05_test_row_count(text) to authenticated;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('51000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'client-r105@example.test', '{"role":"CLIENT"}', '{}', now(), now()),
  ('51000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'other-r105@example.test', '{"role":"CLIENT"}', '{}', now(), now());

insert into public.clients (id, name, slug, email) values
  ('52000000-0000-4000-8000-000000000001', 'Cliente R105', 'cliente-r105', 'client-r105@example.test'),
  ('52000000-0000-4000-8000-000000000002', 'Outro R105', 'outro-r105', 'other-r105@example.test');

insert into public.projects (
  id, client_id, name, lead_status, access_status, access_released_at, modules
) values
  (
    '53000000-0000-4000-8000-000000000001',
    '52000000-0000-4000-8000-000000000001',
    'Projeto ativo R105',
    'JANELA_DE_DECISAO',
    'INICIAL_15_DIAS',
    now() - interval '2 days',
    '{"como_funciona":"ativo","prototipo":"ativo","etapas":"ativo","editor":"bloqueado","versoes":"bloqueado","marca":"bloqueado"}'
  ),
  (
    '53000000-0000-4000-8000-000000000002',
    '52000000-0000-4000-8000-000000000001',
    'Projeto expirado R105',
    'JANELA_DE_DECISAO',
    'INICIAL_15_DIAS',
    now() - interval '16 days',
    '{"como_funciona":"ativo","prototipo":"ativo","etapas":"ativo","editor":"bloqueado","versoes":"bloqueado","marca":"bloqueado"}'
  ),
  (
    '53000000-0000-4000-8000-000000000003',
    '52000000-0000-4000-8000-000000000002',
    'Projeto de outro tenant',
    'JANELA_DE_DECISAO',
    'ATIVO_ATE_FIM_DO_PROJETO',
    now(),
    '{"como_funciona":"ativo","prototipo":"ativo","etapas":"ativo","editor":"bloqueado","versoes":"bloqueado","marca":"bloqueado"}'
  );

insert into public.memberships (client_id, user_id, role) values
  ('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', 'CLIENT'),
  ('52000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000002', 'CLIENT');

insert into public.roadmaps (
  project_id, answers, "references", stack, costs, next_steps, tiers, prototype_url, published_at
) values
  (
    '53000000-0000-4000-8000-000000000001',
    '{"objetivo":"Operar melhor"}', '[]', '["React"]', '[]', '["Validar"]',
    '{"essencial":{"escopo":[],"profundidade":"núcleo","exclusoes":[],"complexidade":"baixa","prazo_dias":15,"valor_centavos":null,"faixa":"sob proposta"},"basico":{"escopo":[],"profundidade":"operação","exclusoes":[],"complexidade":"média","prazo_dias":30,"valor_centavos":null,"faixa":"sob proposta"},"completo":{"escopo":[],"profundidade":"completo","exclusoes":[],"complexidade":"alta","prazo_dias":45,"valor_centavos":null,"faixa":"sob proposta"}}',
    'https://example.test/prototipo', now()
  ),
  ('53000000-0000-4000-8000-000000000002', '{}', '[]', '[]', '[]', '[]', '{}', null, now()),
  ('53000000-0000-4000-8000-000000000003', '{}', '[]', '[]', '[]', '[]', '{}', null, now());

insert into public.kanban_items (id, project_id, title, status, position) values
  ('54000000-0000-4000-8000-000000000001', '53000000-0000-4000-8000-000000000001', 'Item ativo', 'a_fazer', 1),
  ('54000000-0000-4000-8000-000000000002', '53000000-0000-4000-8000-000000000002', 'Item expirado', 'a_fazer', 1);

truncate table public.activity_events restart identity;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"51000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"CLIENT"}}',
  true
);

select is(
  (select effective_access_status from public.get_client_project_shell('53000000-0000-4000-8000-000000000001')),
  'INICIAL_15_DIAS'::public.access_status,
  'C1 active client reads its dashboard shell'
);
select is(
  (select effective_access_status from public.get_client_project_shell('53000000-0000-4000-8000-000000000002')),
  'EXPIRADO'::public.access_status,
  'C4 expired client still reads the narrow shell state'
);
select is((select count(*)::integer from public.roadmaps where project_id = '53000000-0000-4000-8000-000000000002'), 0, 'C4 expired client reads zero roadmap data');
select is((select count(*)::integer from public.kanban_items where project_id = '53000000-0000-4000-8000-000000000002'), 0, 'C4 expired client reads zero kanban data');
select is((select count(*)::integer from public.get_client_project_shell('53000000-0000-4000-8000-000000000003')), 0, 'C4 client reads no shell from another tenant');

select results_eq(
  $$select preferred_tier::text, changed from public.set_preferred_tier('53000000-0000-4000-8000-000000000001', 'essencial')$$,
  $$values ('essencial'::text, true)$$,
  'C8 first tier preference is applied'
);
select is((select preferred_tier from public.roadmaps where project_id = '53000000-0000-4000-8000-000000000001'), 'essencial', 'C8 preferred tier persists');
select is((select count(*)::integer from public.activity_events where project_id = '53000000-0000-4000-8000-000000000001'), 1, 'C8 first preference emits one event');
select is((select payload ->> 'tier' from public.activity_events where project_id = '53000000-0000-4000-8000-000000000001'), 'essencial', 'C8 event contains the tier');

select results_eq(
  $$select preferred_tier::text, changed from public.set_preferred_tier('53000000-0000-4000-8000-000000000001', 'basico')$$,
  $$values ('basico'::text, true)$$,
  'C9 changing the tier applies a second preference'
);
select is((select count(*)::integer from public.activity_events where project_id = '53000000-0000-4000-8000-000000000001'), 2, 'C9 changed tier adds one event');
select results_eq(
  $$select preferred_tier::text, changed from public.set_preferred_tier('53000000-0000-4000-8000-000000000001', 'basico')$$,
  $$values ('basico'::text, false)$$,
  'C9 same tier is a no-op'
);
select is((select count(*)::integer from public.activity_events where project_id = '53000000-0000-4000-8000-000000000001'), 2, 'C9 same tier emits no event');

select throws_ok(
  $$select * from public.set_preferred_tier('53000000-0000-4000-8000-000000000003', 'completo')$$,
  '42501'::character(5),
  'CLIENT_PROJECT_ACCESS_REQUIRED',
  'C8 unauthorized preference is rejected'
);

select throws_ok(
  $$insert into public.kanban_items (project_id, title) values ('53000000-0000-4000-8000-000000000001', 'Intruso')$$,
  '42501'::character(5), null, 'C12 client cannot insert kanban items'
);
select is(public.r1_05_test_row_count($$update public.kanban_items set status = 'concluido' where project_id = '53000000-0000-4000-8000-000000000001'$$), 0, 'C12 client cannot update kanban items');
select is(public.r1_05_test_row_count($$delete from public.kanban_items where project_id = '53000000-0000-4000-8000-000000000001'$$), 0, 'C12 client cannot delete kanban items');

reset role;
select * from finish();
rollback;
