-- Historical deliveries explicitly supplied by Lucca on 2026-09-23.
-- Noon Sao Paulo encodes the supplied date; no delivery time was supplied.
-- Direct historical import: publish_project_version would change project status,
-- unlock modules and replace historical dates with now(). None is intended here.
-- build_reference is a provenance marker, not an invented deploy/build URL.
begin;
select id from public.projects where id='fa681812-5c4a-4868-bf9d-699442ec7c52' for update;
create temp table gazeta_expected_deliveries on commit drop as
select * from jsonb_to_recordset($deliveries$
[
  {
    "label": "V1",
    "macro": "V1",
    "status": "entregue",
    "published_at": "2026-07-13T12:00:00-03:00",
    "changelog": "Protótipo navegável — Entrega do protótipo navegável do portal para validação visual das páginas e da navegação.",
    "build_reference": "historico-informado-por-lucca:2026-07-13",
    "is_current": false,
    "request_id": "gazeta-entrega-historica-v1-2026-07-13"
  },
  {
    "label": "V2",
    "macro": "V2",
    "status": "entregue",
    "published_at": "2026-08-18T12:00:00-03:00",
    "changelog": "Painel editorial — Entrega do Painel da Redação para apresentação do fluxo editorial e da gestão de notícias.",
    "build_reference": "historico-informado-por-lucca:2026-08-18",
    "is_current": false,
    "request_id": "gazeta-entrega-historica-v2-2026-08-18"
  },
  {
    "label": "V3",
    "macro": "V3",
    "status": "entregue",
    "published_at": "2026-09-02T12:00:00-03:00",
    "changelog": "Final — Entrega da versão final do portal para análise. A virada de DNS e a entrada em produção seguem no cronograma do projeto.",
    "build_reference": "historico-informado-por-lucca:2026-09-02",
    "is_current": true,
    "request_id": "gazeta-entrega-historica-v3-2026-09-02"
  }
]
$deliveries$::jsonb) as x(label text,macro text,status text,published_at timestamptz,changelog text,build_reference text,is_current boolean,request_id text);

do $verify$
begin
  if not exists (
    select 1 from public.projects p
    join public.clients c on c.id=p.client_id
    join public.agency_projects ap on ap.project_id=p.id
    join public.agencies a on a.id=ap.agency_id
    where p.id='fa681812-5c4a-4868-bf9d-699442ec7c52'
      and p.name='Portal Gazeta Bragantina' and c.name='Gazeta Bragantina' and a.slug='maisis'
  ) then raise exception 'GAZETA_PROJECT_IDENTITY_MISMATCH'; end if;
  if exists (
    select 1 from public.project_versions v
    join gazeta_expected_deliveries e on e.label=v.label
    where v.project_id='fa681812-5c4a-4868-bf9d-699442ec7c52'
      and (v.macro,v.status,v.published_at,v.changelog,v.build_reference,v.is_current,v.request_id)
        is distinct from (e.macro,e.status,e.published_at,e.changelog,e.build_reference,e.is_current,e.request_id)
  ) then raise exception 'GAZETA_DELIVERY_HISTORY_CONFLICT'; end if;
  if exists (select 1 from public.project_versions where project_id='fa681812-5c4a-4868-bf9d-699442ec7c52' and is_current and label <> 'V3')
  then raise exception 'GAZETA_CURRENT_VERSION_CONFLICT'; end if;
end $verify$;

insert into public.project_versions(project_id,label,macro,status,published_at,changelog,build_reference,is_current,request_id)
select 'fa681812-5c4a-4868-bf9d-699442ec7c52',label,macro,status,published_at,changelog,build_reference,is_current,request_id
from gazeta_expected_deliveries
on conflict (project_id,label) do nothing;

select label, (published_at at time zone 'America/Sao_Paulo')::date as delivery_date, changelog, is_current
from public.project_versions where project_id='fa681812-5c4a-4868-bf9d-699442ec7c52' order by published_at;
commit;
