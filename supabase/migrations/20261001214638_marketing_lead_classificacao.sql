begin;

-- Guardar a pré-condição e o backfill na mesma transação. Nenhum DDL em leads.
lock table public.leads in share mode;
do $$
begin
  if (select count(*) from public.leads where created_at >= timestamptz '2026-08-31T03:00:00Z' and created_at < timestamptz '2026-09-30T03:00:00Z') <> 10 then
    raise exception 'Backfill de lead_classificacao exige exatamente 10 leads no período confirmado';
  end if;
end;
$$;

create table public.lead_classificacao (
  id bigint generated always as identity primary key,
  lead_id uuid not null references public.leads(id) on delete cascade,
  classe text not null check (classe in ('real', 'teste', 'invalido', 'duplicado')),
  motivo text check (char_length(motivo) <= 500),
  classificado_por uuid,
  papel text not null,
  criado_em timestamptz not null default now()
);
create index lead_classificacao_vigente_idx on public.lead_classificacao (lead_id, criado_em desc, id desc);
alter table public.lead_classificacao enable row level security;
revoke all on public.lead_classificacao from public, anon, authenticated, service_role;
revoke all on sequence public.lead_classificacao_id_seq from public, anon, authenticated, service_role;
grant select, insert on public.lead_classificacao to service_role;
grant usage, select on sequence public.lead_classificacao_id_seq to service_role;

insert into public.lead_classificacao (lead_id, classe, motivo, papel)
select id, 'teste', 'confirmado pelo Lucca em 01/10/2026', 'NO_ADMIN'
from public.leads
where created_at >= timestamptz '2026-08-31T03:00:00Z'
  and created_at < timestamptz '2026-09-30T03:00:00Z';

commit;
