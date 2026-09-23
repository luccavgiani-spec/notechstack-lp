// Reconcile the explicitly requested Gazeta project on the existing LOCAL database.
// No Auth account, invitation, payment, migration or external deployment is created.
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

if (!process.argv.includes('--local')) throw new Error('Use --local; this script never targets production.')
const data = JSON.parse(fs.readFileSync(new URL('../onboarding/gazeta-bragantina.json', import.meta.url), 'utf8'))
const literal = value => `'${String(value).replaceAll("'", "''")}'`
const json = value => `${literal(JSON.stringify(value))}::jsonb`
const sql = `begin;
select pg_advisory_xact_lock(hashtext('onboard:gazeta-bragantina'));
do $onboard$
declare cid uuid; pid uuid; aid uuid; existing_count integer;
begin
  select id into strict aid from public.agencies where slug='maisis' and active;
  select count(*) into existing_count from public.clients where slug in ('gazeta-bragantina','gazeta-agency-local');
  if existing_count > 1 then raise exception 'Ambiguous Gazeta clients'; end if;
  select id into cid from public.clients where slug in ('gazeta-bragantina','gazeta-agency-local');
  if cid is null then
    insert into public.clients(name,slug) values ('Gazeta Bragantina','gazeta-bragantina') returning id into cid;
  else
    if not exists(select 1 from public.clients where id=cid and name='Gazeta Bragantina') then raise exception 'Client identity mismatch'; end if;
    update public.clients set slug='gazeta-bragantina' where id=cid and slug='gazeta-agency-local';
  end if;
  select count(*) into existing_count from public.projects where client_id=cid and name='Portal Gazeta Bragantina';
  if existing_count > 1 then raise exception 'Ambiguous Gazeta projects'; end if;
  select id into pid from public.projects where client_id=cid and name='Portal Gazeta Bragantina';
  if pid is null then
    insert into public.projects(client_id,name,lead_status) values(cid,'Portal Gazeta Bragantina','EM_PRODUCAO') returning id into pid;
  end if;
  if exists(select 1 from public.agency_projects where project_id=pid and agency_id<>aid) then raise exception 'Project belongs to another agency'; end if;
  update public.projects set project_status='EM_REVISAO_CLIENTE', modules=modules || '{"como_funciona":"ativo","etapas":"ativo","prototipo":"ativo","editor":"bloqueado"}'::jsonb where id=pid;
  insert into public.agency_projects(agency_id,project_id) values(aid,pid) on conflict(project_id) do nothing;
  insert into public.roadmaps(project_id,stack,costs,next_steps,"references",tiers,prototype_url,published_at)
  values(pid,${json(data.roadmap.stack)},${json(data.roadmap.costs)},${json(data.roadmap.next_steps)},${json(data.roadmap.references)},'{}',${literal(data.roadmap.prototype_url)},now())
  on conflict(project_id) do update set stack=excluded.stack,costs=excluded.costs,next_steps=excluded.next_steps,"references"=excluded."references",prototype_url=excluded.prototype_url,published_at=coalesce(roadmaps.published_at,excluded.published_at);
  ${data.tasks.map(task => `
  if exists(select 1 from public.kanban_items where id=${literal(task.id)} and project_id<>pid) then raise exception 'Task belongs to another project'; end if;
  insert into public.kanban_items(id,project_id,title,phase,status,position)
  values(${literal(task.id)},pid,${literal(task.title)},${literal(task.phase)},${literal(task.status)},${task.position})
  on conflict(id) do update set title=excluded.title,phase=excluded.phase,status=excluded.status,position=excluded.position;`).join('\n')}
end $onboard$;
commit;
select c.slug,p.id project_id,p.project_status,p.modules,a.name agency,count(k.id) tasks,count(k.id) filter(where k.status='concluido') completed
from public.clients c join public.projects p on p.client_id=c.id join public.agency_projects ap on ap.project_id=p.id join public.agencies a on a.id=ap.agency_id left join public.kanban_items k on k.project_id=p.id
where c.slug='gazeta-bragantina' group by c.slug,p.id,a.name;`
const output = execFileSync('docker', ['exec','-i','supabase_db_sdeowbqmwkwseyktyemn','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'], {input:sql,encoding:'utf8'})
console.log(output)
