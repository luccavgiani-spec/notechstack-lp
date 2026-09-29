-- Private drafts, separate from conversions. Only the server can read/write.
create table public.lead_rascunhos (
  sid text not null check (sid ~ '^[A-Za-z0-9._-]{16,64}$'),
  modo text not null check (modo in ('contato','contato_home')),
  respostas jsonb not null default '{}' check (jsonb_typeof(respostas) = 'object'),
  origem jsonb not null default '{}',
  etapa smallint not null default 0 check (etapa between 0 and 5),
  versao bigint not null check (versao > 0),
  finalizado boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (sid, modo)
);
alter table public.lead_rascunhos enable row level security;
revoke all on public.lead_rascunhos from public, anon, authenticated;
grant select, insert, update, delete on public.lead_rascunhos to service_role;

-- Security invoker: only service_role can call this and access the table.
-- Timestamp versions prevent slower requests from replacing newer answers.
create function public.salvar_lead_rascunho(p jsonb) returns void
language sql security invoker set search_path = public as $$
  insert into public.lead_rascunhos as r (sid,modo,respostas,origem,etapa,versao,finalizado)
  values (p->>'sid',p->>'modo',p->'respostas',p->'origem',(p->>'etapa')::smallint,(p->>'versao')::bigint,(p->>'finalizado')::boolean)
  on conflict (sid,modo) do update set
    respostas = excluded.respostas,
    etapa = greatest(r.etapa,excluded.etapa),
    versao = excluded.versao,
    finalizado = r.finalizado or excluded.finalizado,
    atualizado_em = now()
  where excluded.versao > r.versao;
$$;
revoke all on function public.salvar_lead_rascunho(jsonb) from public,anon,authenticated;
grant execute on function public.salvar_lead_rascunho(jsonb) to service_role;

-- "Abandoned" means 30 minutes without an update and no submitted lead.
create view public.leads_para_retomar with (security_invoker = true) as
select r.sid,r.modo,r.respostas->>'nome' as nome,r.respostas->>'whatsapp' as whatsapp,
       r.etapa,r.respostas,r.origem,r.criado_em,r.atualizado_em
from public.lead_rascunhos r
where not r.finalizado and r.atualizado_em < now() - interval '30 minutes'
  and not exists (select 1 from public.leads l where l.sid = r.sid and l.modo = r.modo);
revoke all on public.leads_para_retomar from public,anon,authenticated;
grant select on public.leads_para_retomar to service_role;
