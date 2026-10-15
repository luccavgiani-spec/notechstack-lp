-- TASK-mv9tw7q71do: auditor de marketing (diagnostico gratuito).
-- Tudo em public, RLS ligada e sem policy: so service_role (edge function) le e escreve.
-- Reversao: supabase/rollback/20261015180000_diagnostico_auditor.down.sql

create table if not exists public.diag_config (
  id int primary key check (id = 1),
  teto_diario int not null default 200 check (teto_diario >= 0),
  limite_usuario int not null default 3 check (limite_usuario >= 0),
  -- null = sem janela: limite_usuario diagnosticos gratuitos por usuario no total (decisao do Lucca)
  janela_usuario_horas int null default null check (janela_usuario_horas is null or janela_usuario_horas > 0),
  cache_horas int not null default 24 check (cache_horas >= 0),
  alerta_email text not null default 'contato@notechstack.com.br',
  atualizado_em timestamptz default now()
);
insert into public.diag_config (id) values (1) on conflict (id) do nothing;

create table if not exists public.diag_cache (
  url_hash text primary key,
  url text not null,
  report jsonb not null,
  gerado_em timestamptz not null default now()
);

create table if not exists public.diag_eventos (
  event_id text primary key, -- unicidade = "event_id repetido conta 1x"
  criado_em timestamptz not null default now(),
  concluido_em timestamptz,
  ip_hash text not null,     -- sha256(salt + IPv4 ou IPv6/64); IP cru nunca entra aqui
  url_hash text not null,
  url text not null,
  status text not null check (status in ('reservado','entregue','falha','limite_usuario','teto_diario')),
  cache boolean not null default false,
  consent boolean not null,
  utm jsonb,
  fbclid text null,
  envio_meta text null,
  envio_ga4 text null
);
create index if not exists diag_eventos_ip_hash_idx on public.diag_eventos (ip_hash, criado_em);
create index if not exists diag_eventos_criado_em_idx on public.diag_eventos (criado_em);

create table if not exists public.diag_alertas (
  dia date not null,
  tipo text not null,
  criado_em timestamptz not null default now(),
  enviado text null,
  primary key (dia, tipo)
);

-- Diferenca base x Meta (Pam): entregues por dia em America/Sao_Paulo.
create or replace view public.diag_contagem_diaria
with (security_invoker = true) as
select (e.criado_em at time zone 'America/Sao_Paulo')::date as dia,
       count(*) filter (where e.status = 'entregue')                   as entregues,
       count(*) filter (where e.status = 'entregue' and e.cache)       as entregues_cache,
       count(*) filter (where e.status = 'entregue' and e.consent)     as consentidos,
       count(*) filter (where e.status = 'entregue' and not e.consent) as recusados
  from public.diag_eventos e
 group by 1;

alter table public.diag_config  enable row level security;
alter table public.diag_cache   enable row level security;
alter table public.diag_eventos enable row level security;
alter table public.diag_alertas enable row level security;

revoke all on table public.diag_config, public.diag_cache, public.diag_eventos,
                    public.diag_alertas, public.diag_contagem_diaria
  from anon, authenticated;
grant select, insert, update, delete on table public.diag_config, public.diag_cache,
                                             public.diag_eventos, public.diag_alertas
  to service_role;
grant select on table public.diag_contagem_diaria to service_role;

-- Reserva atomica (lock global): duplicado -> cache -> teto do dia -> limite do usuario -> reservado.
create or replace function public.diag_reservar(
  p_event_id text,
  p_ip_hash text,
  p_url_hash text,
  p_url text,
  p_consent boolean,
  p_utm jsonb default null,
  p_fbclid text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cfg public.diag_config%rowtype;
  ev public.diag_eventos%rowtype;
  v_report jsonb;
  v_dia date;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_total int;
  v_novos int;
begin
  if p_event_id is null or p_ip_hash is null or p_url_hash is null or p_url is null or p_consent is null then
    raise exception 'diag_reservar: parametro obrigatorio ausente';
  end if;

  perform pg_advisory_xact_lock(hashtext('public.diag_reservar'));

  select * into cfg from public.diag_config where id = 1;
  if not found then
    raise exception 'diag_reservar: diag_config sem a linha 1';
  end if;

  -- 1) event_id repetido: nao conta nada
  select * into ev from public.diag_eventos where event_id = p_event_id;
  if found then
    return jsonb_build_object(
      'resultado', 'duplicado',
      'status', ev.status,
      'cache', ev.cache,
      'report', case when ev.status = 'entregue'
                     then (select c.report from public.diag_cache c where c.url_hash = ev.url_hash)
                end);
  end if;

  -- 2) cache valido: entregue sem gastar limite do usuario nem teto
  select c.report into v_report
    from public.diag_cache c
   where c.url_hash = p_url_hash
     and c.gerado_em > now() - make_interval(hours => cfg.cache_horas);
  if found then
    insert into public.diag_eventos (event_id, ip_hash, url_hash, url, status, cache, consent, utm, fbclid, concluido_em)
    values (p_event_id, p_ip_hash, p_url_hash, p_url, 'entregue', true, p_consent, p_utm, p_fbclid, now());
    return jsonb_build_object('resultado', 'cache', 'report', v_report);
  end if;

  -- 3) teto do dia (America/Sao_Paulo), so nao-cache entregues + reservados recentes
  v_dia := (now() at time zone 'America/Sao_Paulo')::date;
  v_inicio := v_dia::timestamp at time zone 'America/Sao_Paulo';
  v_fim := (v_dia + 1)::timestamp at time zone 'America/Sao_Paulo';
  select count(*) into v_total
    from public.diag_eventos e
   where e.criado_em >= v_inicio and e.criado_em < v_fim
     and not e.cache
     and (e.status = 'entregue' or (e.status = 'reservado' and e.criado_em > now() - interval '10 minutes'));
  if v_total >= cfg.teto_diario then
    insert into public.diag_eventos (event_id, ip_hash, url_hash, url, status, cache, consent, utm, fbclid, concluido_em)
    values (p_event_id, p_ip_hash, p_url_hash, p_url, 'teto_diario', false, p_consent, p_utm, p_fbclid, now());
    insert into public.diag_alertas (dia, tipo) values (v_dia, 'teto_diario') on conflict do nothing;
    get diagnostics v_novos = row_count;
    return jsonb_build_object(
      'resultado', 'teto_diario',
      'alertar', v_novos > 0,
      'alerta_email', cfg.alerta_email,
      'teto', cfg.teto_diario,
      'dia', v_dia);
  end if;

  -- 4) limite por usuario (ip_hash), na janela ou no total quando janela_usuario_horas e null
  select count(*) into v_total
    from public.diag_eventos e
   where e.ip_hash = p_ip_hash
     and not e.cache
     and (e.status = 'entregue' or (e.status = 'reservado' and e.criado_em > now() - interval '10 minutes'))
     and (cfg.janela_usuario_horas is null
          or e.criado_em > now() - make_interval(hours => cfg.janela_usuario_horas));
  if v_total >= cfg.limite_usuario then
    insert into public.diag_eventos (event_id, ip_hash, url_hash, url, status, cache, consent, utm, fbclid, concluido_em)
    values (p_event_id, p_ip_hash, p_url_hash, p_url, 'limite_usuario', false, p_consent, p_utm, p_fbclid, now());
    return jsonb_build_object('resultado', 'limite_usuario', 'limite', cfg.limite_usuario);
  end if;

  -- 5) reserva
  insert into public.diag_eventos (event_id, ip_hash, url_hash, url, status, cache, consent, utm, fbclid)
  values (p_event_id, p_ip_hash, p_url_hash, p_url, 'reservado', false, p_consent, p_utm, p_fbclid);
  return jsonb_build_object('resultado', 'reservado');
end;
$$;

-- Conclui a reserva. ok -> entregue + cache da URL; senao falha (falha nao conta em limite nem teto).
create or replace function public.diag_concluir(
  p_event_id text,
  p_ok boolean,
  p_report jsonb default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  ev public.diag_eventos%rowtype;
begin
  select * into ev from public.diag_eventos where event_id = p_event_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'evento_inexistente');
  end if;
  if ev.status <> 'reservado' then
    return jsonb_build_object('ok', false, 'erro', 'status_' || ev.status);
  end if;
  if coalesce(p_ok, false) then
    if p_report is null then
      raise exception 'diag_concluir: report obrigatorio quando ok';
    end if;
    update public.diag_eventos set status = 'entregue', concluido_em = now() where event_id = p_event_id;
    insert into public.diag_cache (url_hash, url, report, gerado_em)
    values (ev.url_hash, ev.url, p_report, now())
    on conflict (url_hash) do update
      set url = excluded.url, report = excluded.report, gerado_em = excluded.gerado_em;
    return jsonb_build_object('ok', true, 'status', 'entregue');
  end if;
  update public.diag_eventos set status = 'falha', concluido_em = now() where event_id = p_event_id;
  return jsonb_build_object('ok', true, 'status', 'falha');
end;
$$;

create or replace function public.diag_registrar_envio(
  p_event_id text,
  p_meta text,
  p_ga4 text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.diag_eventos
     set envio_meta = left(p_meta, 300), envio_ga4 = left(p_ga4, 300)
   where event_id = p_event_id;
  return jsonb_build_object('ok', found);
end;
$$;

create or replace function public.diag_registrar_alerta(
  p_dia date,
  p_tipo text,
  p_enviado text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.diag_alertas set enviado = left(p_enviado, 300) where dia = p_dia and tipo = p_tipo;
  return jsonb_build_object('ok', found);
end;
$$;

revoke all on function public.diag_reservar(text, text, text, text, boolean, jsonb, text) from public, anon, authenticated;
revoke all on function public.diag_concluir(text, boolean, jsonb) from public, anon, authenticated;
revoke all on function public.diag_registrar_envio(text, text, text) from public, anon, authenticated;
revoke all on function public.diag_registrar_alerta(date, text, text) from public, anon, authenticated;
grant execute on function public.diag_reservar(text, text, text, text, boolean, jsonb, text) to service_role;
grant execute on function public.diag_concluir(text, boolean, jsonb) to service_role;
grant execute on function public.diag_registrar_envio(text, text, text) to service_role;
grant execute on function public.diag_registrar_alerta(date, text, text) to service_role;
