/* Rastreio da jornada — bloco C2 + D1 + D2 do PLANO-rastreio.md
   (lp-narrador/cenas-lp/PLANO-rastreio.md)

   Três coisas, nesta ordem:

   1. `leads` ganha COLUNA PRÓPRIA para o que hoje viaja empacotado dentro de
      `ai_analysis`. A edge function `send-lead-email` desestrutura oito campos
      fixos e descarta o resto em silêncio — foi assim que o `path` da lp-v4
      nunca chegou ao banco. O front contornava concatenando tudo num bloco de
      texto; a partir daqui não precisa mais.

   2. `lead_sessoes` + `lead_eventos` guardam o PERCURSO, não só o destino.
      A chave é o `sid`, gerado no primeiro hit da sessão e carregado em todo
      evento, no lead gravado e no `event_id` de dedup do Meta CAPI.

   3. Duas views que respondem as duas perguntas que o GA4 não responde bem:
      onde as pessoas caem no funil, e quais das 19 folhas da árvore convertem.

   Tudo aditivo: nenhuma coluna existente muda de tipo, nada é removido, e as
   LPs antigas (Roteador, lp-v3, lp-v4) continuam gravando como sempre. */

/* ── 1 · leads: colunas próprias ─────────────────────────────────────────── */

alter table public.leads
  /* costura com lead_sessoes e com o event_id do CAPI */
  add column if not exists sid           text,
  /* saíam empacotados dentro de ai_analysis */
  add column if not exists site          text,
  add column if not exists descricao     text,
  /* o caminho na árvore do CRT — `objetivos` era o slot emprestado */
  add column if not exists folha         text,
  add column if not exists nicho         text,
  add column if not exists caminho       text,
  add column if not exists modo          text,
  /* origem: sem isto, lead vindo de anúncio que navegou antes de preencher
     chega sem utm nenhum e a campanha fica sem crédito */
  add column if not exists utm_source    text,
  add column if not exists utm_medium    text,
  add column if not exists utm_campaign  text,
  add column if not exists utm_content   text,
  add column if not exists utm_term      text,
  add column if not exists gclid         text,
  add column if not exists fbclid        text,
  add column if not exists referrer      text,
  /* cookies do Meta — o CAPI precisa deles pra casar o evento com o clique */
  add column if not exists fbp           text,
  add column if not exists fbc           text,
  /* resultado do envio server-side pro Meta CAPI, pra auditar sem abrir log */
  add column if not exists capi_status   text;

create index if not exists leads_sid_idx        on public.leads (sid);
create index if not exists leads_created_at_idx on public.leads (created_at desc);

/* ── 2 · o percurso ──────────────────────────────────────────────────────── */

create table if not exists public.lead_sessoes (
  sid          text primary key,
  criada_em    timestamptz not null default now(),
  ultima_em    timestamptz not null default now(),

  utm_source text, utm_medium text, utm_campaign text,
  utm_content text, utm_term text,
  gclid text, fbclid text, referrer text,
  fbp text, fbc text,
  device text, user_agent text,

  /* 0 chegou · 1 destravou o monitor · 2 conversou com a árvore
     3 entrou no formulário · 4 chegou no contato · 5 virou lead.
     Materializado aqui de propósito: o funil sai de um count sobre esta
     coluna, sem varrer a tabela de eventos. */
  etapa_max    smallint not null default 0,

  folha text, nicho text, caminho text, modo text,

  /* teto de gravação por sessão, conferido pela function antes de inserir */
  eventos_n    integer not null default 0,

  virou_lead   boolean not null default false,
  lead_id      uuid references public.leads(id) on delete set null
);

create table if not exists public.lead_eventos (
  id      bigserial primary key,
  sid     text not null references public.lead_sessoes(sid) on delete cascade,
  evento  text not null,
  params  jsonb not null default '{}'::jsonb,
  ts      timestamptz not null default now()
);

create index if not exists lead_eventos_sid_ts_idx  on public.lead_eventos (sid, ts);
create index if not exists lead_eventos_evento_idx  on public.lead_eventos (evento);
create index if not exists lead_sessoes_criada_idx  on public.lead_sessoes (criada_em desc);
create index if not exists lead_sessoes_etapa_idx   on public.lead_sessoes (etapa_max);

/* RLS LIGADA E SEM POLICY: ninguém entra a não ser o service_role, que a
   ignora por definição. O painel nunca fala com o banco direto — fala com a
   function `painel-dados`, que carrega a chave e exige um token no header.
   Chave de serviço em HTML de painel é como deixar a porta destrancada. */
alter table public.lead_sessoes enable row level security;
alter table public.lead_eventos enable row level security;

/* ── 3 · as duas perguntas ───────────────────────────────────────────────── */

/* security_invoker: a view não empresta o privilégio do dono. Sem isso, quem
   alcançasse a view leria a tabela inteira por baixo da RLS. */
create or replace view public.funil_dia
with (security_invoker = true) as
select
  date_trunc('day', criada_em)::date                as dia,
  count(*)                                          as sessoes,
  count(*) filter (where etapa_max >= 1)            as abriu_o_monitor,
  count(*) filter (where etapa_max >= 2)            as conversou,
  count(*) filter (where etapa_max >= 3)            as entrou_no_form,
  count(*) filter (where etapa_max >= 4)            as chegou_no_contato,
  count(*) filter (where virou_lead)                as leads
from public.lead_sessoes
group by 1
order by 1 desc;

/* qual ramo da árvore merece existir: chegada, intenção e conversão por folha */
create or replace view public.folha_desempenho
with (security_invoker = true) as
select
  folha,
  nicho,
  count(*)                                          as chegaram,
  count(*) filter (where etapa_max >= 3)            as abriram_form,
  count(*) filter (where virou_lead)                as leads,
  round(100.0 * count(*) filter (where virou_lead)
        / nullif(count(*), 0), 1)                   as taxa_pct
from public.lead_sessoes
where folha is not null
group by 1, 2
order by leads desc, chegaram desc;
