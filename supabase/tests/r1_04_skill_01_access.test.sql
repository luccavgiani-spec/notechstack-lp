begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('41000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'operator-r104@example.test', '{"role":"NO_ADMIN"}', '{}', now(), now()),
  ('41000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'client-r104@example.test', '{"role":"CLIENT"}', '{}', now(), now());

insert into public.clients (id, name, slug, email) values
  ('42000000-0000-4000-8000-000000000001', 'Cliente R104', 'cliente-r104', 'client-r104@example.test');

insert into public.projects (
  id, client_id, name, lead_status, access_status, access_released_at
) values
  ('43000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', 'Projeto Skill 01', 'ROADMAP_PAGO', null, null),
  ('43000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000001', 'Janela dia 14', 'JANELA_DE_DECISAO', 'INICIAL_15_DIAS', now() - interval '14 days'),
  ('43000000-0000-4000-8000-000000000003', '42000000-0000-4000-8000-000000000001', 'Janela limite', 'JANELA_DE_DECISAO', 'INICIAL_15_DIAS', now() - interval '15 days' + interval '1 second'),
  ('43000000-0000-4000-8000-000000000004', '42000000-0000-4000-8000-000000000001', 'Janela vencida', 'JANELA_DE_DECISAO', 'INICIAL_15_DIAS', now() - interval '15 days' - interval '1 second'),
  ('43000000-0000-4000-8000-000000000005', '42000000-0000-4000-8000-000000000001', 'Convertido ativo', 'CONVERTIDO', 'ATIVO_ATE_FIM_DO_PROJETO', now() - interval '45 days');

select is(
  (
    select project_id
    from public.activate_dashboard(
      '43000000-0000-4000-8000-000000000001',
      '41000000-0000-4000-8000-000000000002',
      '41000000-0000-4000-8000-000000000001',
      '{
        "answers":{"objetivo":"Operar melhor"},
        "references":[],
        "stack":["React"],
        "costs":[],
        "next_steps":["Validar"],
        "tiers":{
          "essencial":{"escopo":[],"profundidade":"núcleo","exclusoes":[],"complexidade":"baixa","prazo_dias":15,"valor_centavos":null,"faixa":"sob proposta"},
          "basico":{"escopo":[],"profundidade":"operação","exclusoes":[],"complexidade":"média","prazo_dias":30,"valor_centavos":null,"faixa":"sob proposta"},
          "completo":{"escopo":[],"profundidade":"completo","exclusoes":[],"complexidade":"alta","prazo_dias":45,"valor_centavos":null,"faixa":"sob proposta"}
        },
        "preferred_tier":"basico",
        "prototype_url":"https://example.test/prototipo"
      }'::jsonb,
      'skill-01:43000000-0000-4000-8000-000000000001'
    )
  ),
  '43000000-0000-4000-8000-000000000001'::uuid,
  'C1 activate_dashboard transaction publishes the exact aggregate'
);

select is((select count(*)::integer from public.memberships where user_id = '41000000-0000-4000-8000-000000000002'), 1, 'C1 creates one CLIENT membership');
select is((select role from public.memberships where user_id = '41000000-0000-4000-8000-000000000002'), 'CLIENT', 'C1 membership role is CLIENT');
select is((select lead_status from public.projects where id = '43000000-0000-4000-8000-000000000001'), 'JANELA_DE_DECISAO', 'C1 lead enters decision window');
select is((select access_status from public.projects where id = '43000000-0000-4000-8000-000000000001'), 'INICIAL_15_DIAS', 'C1 access starts for 15 days');
select is(
  (select modules from public.projects where id = '43000000-0000-4000-8000-000000000001'),
  '{"como_funciona":"ativo","prototipo":"ativo","etapas":"ativo","editor":"bloqueado","versoes":"bloqueado","marca":"bloqueado"}'::jsonb,
  'C1 activates modules 01-03 and blocks 04-06'
);
select ok((select published_at is not null from public.roadmaps where project_id = '43000000-0000-4000-8000-000000000001'), 'C1 roadmap is published');
select is((select preferred_tier from public.roadmaps where project_id = '43000000-0000-4000-8000-000000000001'), 'basico', 'C1 roadmap content is stored');
select is(
  (
    select jsonb_build_object(
      'answers', answers,
      'references', "references",
      'stack', stack,
      'costs', costs,
      'next_steps', next_steps,
      'tiers', tiers,
      'preferred_tier', preferred_tier,
      'prototype_url', prototype_url
    )
    from public.roadmaps
    where project_id = '43000000-0000-4000-8000-000000000001'
  ),
  '{
    "answers":{"objetivo":"Operar melhor"},
    "references":[],
    "stack":["React"],
    "costs":[],
    "next_steps":["Validar"],
    "tiers":{
      "essencial":{"escopo":[],"profundidade":"núcleo","exclusoes":[],"complexidade":"baixa","prazo_dias":15,"valor_centavos":null,"faixa":"sob proposta"},
      "basico":{"escopo":[],"profundidade":"operação","exclusoes":[],"complexidade":"média","prazo_dias":30,"valor_centavos":null,"faixa":"sob proposta"},
      "completo":{"escopo":[],"profundidade":"completo","exclusoes":[],"complexidade":"alta","prazo_dias":45,"valor_centavos":null,"faixa":"sob proposta"}
    },
    "preferred_tier":"basico",
    "prototype_url":"https://example.test/prototipo"
  }'::jsonb,
  'C1 stores every roadmap field exactly'
);

select is((select count(*)::integer from public.activity_events where request_id = 'skill-01:43000000-0000-4000-8000-000000000001'), 1, 'C2 first activation records one attributed activity event');
select is((select actor_id from public.activity_events where request_id = 'skill-01:43000000-0000-4000-8000-000000000001'), '41000000-0000-4000-8000-000000000001'::uuid, 'C2 activity identifies NO_ADMIN');
select is((select type from public.activity_events where request_id = 'skill-01:43000000-0000-4000-8000-000000000001'), 'skill_01_dashboard_ativado', 'C2 activity uses the Skill 01 type');

create temporary table r104_release as
select access_released_at as value
from public.projects
where id = '43000000-0000-4000-8000-000000000001';

select lives_ok(
  $$select * from public.activate_dashboard(
    '43000000-0000-4000-8000-000000000001',
    '41000000-0000-4000-8000-000000000002',
    '41000000-0000-4000-8000-000000000001',
    '{"answers":{},"references":[],"stack":[],"costs":[],"next_steps":[],"tiers":{"essencial":{},"basico":{},"completo":{}}}'::jsonb,
    'skill-01:43000000-0000-4000-8000-000000000001'
  )$$,
  'C6 repeated RPC is accepted'
);
select is((select access_released_at from public.projects where id = '43000000-0000-4000-8000-000000000001'), (select value from r104_release), 'C6 repeated RPC preserves release instant and aggregate cardinality');
select is((select count(*)::integer from public.memberships where user_id = '41000000-0000-4000-8000-000000000002'), 1, 'C6 retry keeps one membership');
select is((select count(*)::integer from public.activity_events where request_id = 'skill-01:43000000-0000-4000-8000-000000000001'), 1, 'C6 retry keeps one activation event');

select is((select effective_access_status from public.project_access where id = '43000000-0000-4000-8000-000000000004'), 'EXPIRADO', 'C9 after 15 days plus one second derives expired');
select is((select effective_lead_status from public.project_access where id = '43000000-0000-4000-8000-000000000004'), 'NAO_CONVERTIDO', 'C9 after 15 days plus one second derives NAO_CONVERTIDO');
select is((select effective_lead_status from public.project_access where id = '43000000-0000-4000-8000-000000000002'), 'JANELA_DE_DECISAO', 'C10 day 14 remains in decision window');
select is((select effective_lead_status from public.project_access where id = '43000000-0000-4000-8000-000000000003'), 'JANELA_DE_DECISAO', 'C10 one second before expiry remains in decision window');
select is((select effective_access_status from public.project_access where id = '43000000-0000-4000-8000-000000000003'), 'INICIAL_15_DIAS', 'C10 one second before expiry keeps initial access');
select is((select effective_lead_status from public.project_access where id = '43000000-0000-4000-8000-000000000005'), 'CONVERTIDO', 'C10 converted project remains converted after 15 days');
select is((select effective_access_status from public.project_access where id = '43000000-0000-4000-8000-000000000005'), 'ATIVO_ATE_FIM_DO_PROJETO', 'C10 converted project keeps active access');

select * from finish();
rollback;
