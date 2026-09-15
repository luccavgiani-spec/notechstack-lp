#!/usr/bin/env node

/**
 * R1-07 S2 — seed local dos exemplos do pipeline.
 *
 * A escrita acontece em uma única transação PostgreSQL executada pela CLI local
 * do Supabase. Nenhum usuário Auth, membership, token ou e-mail real é criado.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PROJECT_ROOT = path.resolve(APP_ROOT, '..')
const GAZETA_SOURCE = path.resolve(PROJECT_ROOT, '..', 'gazeta_bragantina', 'painel-controle', 'index.html')
const HELLO_DELIVERABLE = path.resolve(PROJECT_ROOT, 'home-no-prototipo', 'hello-deliverable.js')
const HELLO_ROADMAP = path.resolve(PROJECT_ROOT, 'home-no-prototipo', 'work', 'hello-best', 'roadmap.md')

function help() {
  console.log(`Uso: npm run seed:exemplos [-- --help]

Cria ou reconcilia, somente no Supabase local, os agregados canônicos:
  • gazeta-bragantina — 1 projeto, 5 fases e 27 itens (17 concluídos)
  • hello-best — 1 projeto com roadmap rastreável e tiers "a preencher"

Saída: resumo seguro; código 0 em sucesso e 1 em erro.
Para provar rollback no meio da transação, use apenas no teste local:
  SEED_EXEMPLOS_FAIL_AFTER=gazeta npm run seed:exemplos
`)
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  help()
  process.exit(0)
}

function readSourceFases() {
  if (!fs.existsSync(GAZETA_SOURCE)) throw new Error(`Fonte Gazeta não encontrada: ${GAZETA_SOURCE}`)
  const source = fs.readFileSync(GAZETA_SOURCE, 'utf8')
  const start = source.indexOf('var FASES = [')
  const endMarker = '\n  ];'
  const end = source.indexOf(endMarker, start)
  if (start < 0 || end < 0) throw new Error('FASES não encontrada na fonte Gazeta')
  const expression = source.slice(start + 'var FASES = '.length, end + endMarker.length - 1)
  const fases = vm.runInNewContext(`(${expression})`, Object.create(null))
  if (!Array.isArray(fases) || fases.length !== 5) throw new Error('Fonte Gazeta não contém exatamente 5 fases')
  const items = fases.flatMap((phase) => phase.tarefas.map((item, position) => ({
    id: item.id,
    title: item.titulo,
    phase: phase.nome,
    sourcePhaseId: phase.id,
    week: item.semana,
    checked: Boolean(item.checked),
    position,
  })))
  if (items.length !== 27 || items.filter((item) => item.checked).length !== 17) {
    throw new Error(`Fonte Gazeta divergente: ${items.length} itens, ${items.filter((item) => item.checked).length} concluídos`)
  }
  return { fases, items }
}

function stableUuid(seed) {
  const digest = crypto.createHash('sha256').update(`r1-07:${seed}`).digest('hex')
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}

function jsonLiteral(value) {
  return `${sqlString(JSON.stringify(value))}::jsonb`
}

function buildHelloRoadmap() {
  if (!fs.existsSync(HELLO_DELIVERABLE) || !fs.existsSync(HELLO_ROADMAP)) {
    throw new Error('Fontes Hello Best não encontradas')
  }
  const deliverable = fs.readFileSync(HELLO_DELIVERABLE, 'utf8')
  const roadmap = fs.readFileSync(HELLO_ROADMAP, 'utf8')
  return {
    answers: {
      diagnostic: 'Produto social para conectar pessoas, com autenticação, perfis, curadoria e conexões reais.',
      source: ['home-no-prototipo/hello-deliverable.js', 'home-no-prototipo/work/hello-best/roadmap.md'],
      missing: ['custos e valores dos tiers não são fornecidos nas fontes; permanecem a preencher'],
    },
    stack: [
      { name: 'GitHub', purpose: 'código e histórico', source: 'hello-deliverable.js' },
      { name: 'Supabase', purpose: 'banco, login e arquivos', source: 'hello-deliverable.js' },
      { name: 'Vercel', purpose: 'site, app e publicação', source: 'hello-deliverable.js' },
    ],
    costs: [{ label: 'Custos do projeto', value: 'a preencher', source: 'não informado nas fontes' }],
    nextSteps: [
      { title: 'Chat 1:1 entre bests conectadas', status: 'Em andamento', source: 'roadmap.md' },
      { title: 'Edição do perfil em tela dedicada', status: 'Próxima etapa', source: 'roadmap.md' },
      { title: 'Posts da comunidade com dados reais', status: 'Próxima etapa', source: 'roadmap.md' },
    ],
    references: [
      { path: 'home-no-prototipo/hello-deliverable.js', kind: 'entregável navegável', bytes: deliverable.length },
      { path: 'home-no-prototipo/work/hello-best/roadmap.md', kind: 'roadmap de implementação', bytes: roadmap.length },
    ],
    tiers: {
      essencial: { status: 'a preencher', value: 'a preencher' },
      basico: { status: 'a preencher', value: 'a preencher' },
      completo: { status: 'a preencher', value: 'a preencher' },
    },
  }
}

function buildSql(gazeta, hello) {
  const phaseNames = gazeta.fases.map((phase) => phase.nome)
  const gazetaItems = gazeta.items.map((item, index) => ({
    id: stableUuid(`gazeta:${item.id}`),
    source_id: item.id,
    title: item.title,
    phase: item.phase,
    week: item.week,
    checked: item.checked,
    position: index,
  }))
  const failAfterGazeta = process.env.SEED_EXEMPLOS_FAIL_AFTER === 'gazeta'
  const phasesSql = jsonLiteral(phaseNames)
  const itemsSql = jsonLiteral(gazetaItems)
  const helloSql = jsonLiteral(hello)

  return `do $seed$
declare
  v_gazeta_client uuid;
  v_hello_client uuid;
  v_gazeta_project uuid;
  v_hello_project uuid;
  v_project_count integer;
  v_expected jsonb := ${itemsSql};
  v_item jsonb;
begin
  perform set_config('app.skip_activity', 'on', true);
  if ${phasesSql} <> '[
    "Fase 0 · Preparação", "Fase 1 · Frontend", "Fase 2 · Migração e Backup",
    "Fase 3 · Editorial e Backend", "Fase 4 · Go-live"
  ]'::jsonb then
    raise exception 'gazeta source phases changed';
  end if;

  insert into public.clients (name, slug, email)
  values ('Gazeta Bragantina', 'gazeta-bragantina', 'gazeta-bragantina@example.test')
  on conflict (slug) do update set name = excluded.name, email = excluded.email, status = 'active'
  returning id into v_gazeta_client;

  select count(*), (array_agg(id))[1] into v_project_count, v_gazeta_project
    from public.projects where client_id = v_gazeta_client and name = 'Gazeta Bragantina — Projeto convertido';
  if v_project_count > 1 then
    raise exception 'ambiguous canonical Gazeta project';
  elsif v_project_count = 0 then
    insert into public.projects (client_id, name, niche, lead_status, project_status, access_status, modules)
    values (v_gazeta_client, 'Gazeta Bragantina — Projeto convertido', 'jornalismo local', 'CONVERTIDO', 'CONVERTIDO', 'ATIVO_ATE_FIM_DO_PROJETO',
      '{"como_funciona":"ativo","prototipo":"ativo","etapas":"ativo","editor":"bloqueado","versoes":"bloqueado","marca":"bloqueado"}'::jsonb)
    returning id into v_gazeta_project;
  else
    update public.projects set niche = 'jornalismo local', lead_status = 'CONVERTIDO', project_status = 'CONVERTIDO', access_status = 'ATIVO_ATE_FIM_DO_PROJETO', modules =
      '{"como_funciona":"ativo","prototipo":"ativo","etapas":"ativo","editor":"bloqueado","versoes":"bloqueado","marca":"bloqueado"}'::jsonb
      where id = v_gazeta_project;
  end if;

  delete from public.kanban_items where project_id = v_gazeta_project
    and id not in (select (item->>'id')::uuid from jsonb_array_elements(v_expected) item);
  for v_item in select * from jsonb_array_elements(v_expected) loop
    insert into public.kanban_items (id, project_id, title, phase, status, position, completed_at)
    values ((v_item->>'id')::uuid, v_gazeta_project, v_item->>'title', v_item->>'phase',
      case when (v_item->>'checked')::boolean then 'concluido'::public.kanban_status else 'a_fazer'::public.kanban_status end,
      (v_item->>'position')::integer,
      case when (v_item->>'checked')::boolean then coalesce((select completed_at from public.kanban_items where id = (v_item->>'id')::uuid), now()) else null end)
    on conflict (id) do update set project_id = excluded.project_id, title = excluded.title, phase = excluded.phase,
      status = excluded.status, position = excluded.position, completed_at = excluded.completed_at;
  end loop;

  if ${failAfterGazeta ? 'true' : 'false'} then raise exception 'injected seed failure after gazeta'; end if;

  insert into public.clients (name, slug, email)
  values ('Hello Best', 'hello-best', 'hello-best@example.test')
  on conflict (slug) do update set name = excluded.name, email = excluded.email, status = 'active'
  returning id into v_hello_client;
  select count(*), (array_agg(id))[1] into v_project_count, v_hello_project
    from public.projects where client_id = v_hello_client and name = 'Hello Best — Projeto em produção';
  if v_project_count > 1 then
    raise exception 'ambiguous canonical Hello Best project';
  elsif v_project_count = 0 then
    insert into public.projects (client_id, name, niche, lead_status, project_status, access_status, modules)
    values (v_hello_client, 'Hello Best — Projeto em produção', 'conexões sociais', 'EM_PRODUCAO', null, null,
      '{"como_funciona":"ativo","prototipo":"ativo","etapas":"ativo","editor":"bloqueado","versoes":"bloqueado","marca":"bloqueado"}'::jsonb)
    returning id into v_hello_project;
  else
    update public.projects set niche = 'conexões sociais', lead_status = 'EM_PRODUCAO', project_status = null, access_status = null, access_released_at = null, modules =
      '{"como_funciona":"ativo","prototipo":"ativo","etapas":"ativo","editor":"bloqueado","versoes":"bloqueado","marca":"bloqueado"}'::jsonb
      where id = v_hello_project;
  end if;
  insert into public.roadmaps (project_id, answers, "references", stack, costs, next_steps, tiers, prototype_url)
  values (v_hello_project, ${helloSql}->'answers', ${helloSql}->'references', ${helloSql}->'stack', ${helloSql}->'costs', ${helloSql}->'nextSteps', ${helloSql}->'tiers', 'https://hello-best.lovable.app')
  on conflict (project_id) do update set answers = excluded.answers, "references" = excluded."references", stack = excluded.stack,
    costs = excluded.costs, next_steps = excluded.next_steps, tiers = excluded.tiers, prototype_url = excluded.prototype_url;
end;
$seed$;`
}

function run() {
  const gazeta = readSourceFases()
  const hello = buildHelloRoadmap()
  const sqlPath = path.join(os.tmpdir(), `r1-07-seed-${process.pid}-${Date.now()}.sql`)
  fs.writeFileSync(sqlPath, buildSql(gazeta, hello), 'utf8')
  try {
    execFileSync('supabase', ['db', 'query', '--local', '--file', sqlPath, '--output', 'json'], {
      cwd: PROJECT_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    })
    console.log(JSON.stringify({
      result: 'PASS',
      gazeta: { slug: 'gazeta-bragantina', phases: gazeta.fases.length, items: gazeta.items.length, completed: gazeta.items.filter((item) => item.checked).length },
      helloBest: { slug: 'hello-best', tiers: ['essencial', 'basico', 'completo'], tiersState: 'a preencher', prototypeUrl: 'https://hello-best.lovable.app' },
      idempotentKey: 'clients.slug + canonical project name',
    }))
  } catch (error) {
    const detail = error?.stderr?.toString()?.split('\\n').filter(Boolean).slice(-1)[0]
    console.error(`seed:exemplos falhou${detail ? `: ${detail}` : ''}`)
    process.exitCode = 1
  } finally {
    fs.rmSync(sqlPath, { force: true })
  }
}

run()
