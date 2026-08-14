/* `registrar_eventos` — o único caminho de escrita do rastreio de jornada.

   POR QUE UMA FUNÇÃO E NÃO CHAMADAS REST SOLTAS: gravar um lote é upsert da
   sessão + `greatest` na etapa + insert dos eventos. Em três chamadas REST
   isso vira três viagens e uma corrida — duas abas da mesma pessoa fazendo
   upsert ao mesmo tempo conseguem baixar a `etapa_max` de volta. Aqui é uma
   transação só.

   As guardas moram aqui, e não na edge function, porque este é um caminho de
   escrita PÚBLICO: qualquer um que ache o endpoint pode chamá-lo. Validação em
   JavaScript que o cliente controla não é validação.

   `security definer` para atravessar a RLS (as tabelas estão fechadas de
   propósito), com `search_path` fixo. O EXECUTE é revogado de anon e
   authenticated: só o service_role chama, ou seja, só a edge function. */

create or replace function public.registrar_eventos(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sid     text   := nullif(trim(p->>'sid'), '');
  v_eventos jsonb  := coalesce(p->'eventos', '[]'::jsonb);
  v_n       int    := jsonb_array_length(coalesce(p->'eventos', '[]'::jsonb));
  v_etapa   int    := 0;
  v_total   int;
  v_grav    int;
begin
  /* sid é chave primária e vem do cliente: precisa ser barato de indexar e
     impossível de usar como vetor de injeção de lixo */
  if v_sid is null or length(v_sid) > 64 or v_sid !~ '^[A-Za-z0-9._-]+$' then
    return jsonb_build_object('ok', false, 'erro', 'sid_invalido');
  end if;

  if v_n = 0  then return jsonb_build_object('ok', true,  'gravados', 0); end if;
  if v_n > 60 then return jsonb_build_object('ok', false, 'erro', 'lote_grande'); end if;

  select coalesce(max((x->>'etapa')::int), 0) into v_etapa
    from jsonb_array_elements(v_eventos) x
   where x->>'etapa' ~ '^[0-9]+$';
  v_etapa := least(greatest(v_etapa, 0), 5);

  insert into public.lead_sessoes as s (
    sid, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    gclid, fbclid, referrer, fbp, fbc, device, user_agent,
    etapa_max, folha, nicho, caminho, modo, eventos_n
  ) values (
    v_sid,
    p->'orig'->>'utm_source',   p->'orig'->>'utm_medium',
    p->'orig'->>'utm_campaign', p->'orig'->>'utm_content',
    p->'orig'->>'utm_term',     p->'orig'->>'gclid',
    p->'orig'->>'fbclid',       p->'orig'->>'referrer',
    p->>'fbp', p->>'fbc', p->>'device', left(coalesce(p->>'user_agent',''), 400),
    v_etapa::smallint,
    p->>'folha', p->>'nicho', p->>'caminho', p->>'modo',
    v_n
  )
  on conflict (sid) do update set
    ultima_em = now(),
    /* NUNCA desce: a etapa é o ponto mais longe que a pessoa chegou, e voltar
       no formulário não desfaz o fato de ela ter chegado ao contato */
    etapa_max = greatest(s.etapa_max, excluded.etapa_max),
    /* a origem é a da PRIMEIRA visita: coalesce com o que já está gravado, e
       não o contrário — senão o segundo pageview sem utm apaga a campanha */
    utm_source   = coalesce(s.utm_source,   excluded.utm_source),
    utm_medium   = coalesce(s.utm_medium,   excluded.utm_medium),
    utm_campaign = coalesce(s.utm_campaign, excluded.utm_campaign),
    utm_content  = coalesce(s.utm_content,  excluded.utm_content),
    utm_term     = coalesce(s.utm_term,     excluded.utm_term),
    gclid        = coalesce(s.gclid,        excluded.gclid),
    fbclid       = coalesce(s.fbclid,       excluded.fbclid),
    referrer     = coalesce(s.referrer,     excluded.referrer),
    /* o caminho na árvore, ao contrário, é sempre o mais recente */
    folha   = coalesce(excluded.folha,   s.folha),
    nicho   = coalesce(excluded.nicho,   s.nicho),
    caminho = coalesce(excluded.caminho, s.caminho),
    modo    = coalesce(excluded.modo,    s.modo),
    fbp     = coalesce(excluded.fbp,     s.fbp),
    fbc     = coalesce(excluded.fbc,     s.fbc),
    device  = coalesce(s.device,  excluded.device),
    /* teto com trava: sem o least, uma sessão abusiva faz o contador crescer
       para sempre mesmo depois de a gravação já estar barrada */
    eventos_n = least(s.eventos_n + v_n, 999)
  returning s.eventos_n into v_total;

  if v_total > 200 then
    return jsonb_build_object('ok', false, 'erro', 'teto_sessao', 'eventos_n', v_total);
  end if;

  /* lista fechada de nomes: o que não está no mapa não entra no banco */
  insert into public.lead_eventos (sid, evento, params)
  select v_sid,
         x->>'evento',
         coalesce(x->'params', '{}'::jsonb)
    from jsonb_array_elements(v_eventos) x
   where x->>'evento' ~ '^(cta_click|capitulo_visto|diag_[a-z_]{2,20}|form_[a-z_]{2,20}|lead_[a-z_]{2,20})$'
     and pg_column_size(coalesce(x->'params', '{}'::jsonb)) < 2000;

  get diagnostics v_grav = row_count;
  return jsonb_build_object('ok', true, 'gravados', v_grav, 'etapa', v_etapa);
end;
$$;

revoke all     on function public.registrar_eventos(jsonb) from public, anon, authenticated;
grant  execute on function public.registrar_eventos(jsonb) to service_role;

/* `marcar_lead` — costura o lead gravado com a sessão que o produziu.
   Chamada pela `send-lead-email` quando o payload traz `sid`. Sem isto o
   painel mostra o percurso e o lead como duas coisas sem relação. */
create or replace function public.marcar_lead(p_sid text, p_lead_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_sid is null or p_sid = '' then return; end if;
  /* a sessão pode não existir: lead vindo de LP sem telemetria (Roteador hoje),
     ou de alguém com o beacon bloqueado. Cria a linha mínima pra não perder a
     ligação — melhor uma sessão sem percurso que um lead órfão. */
  insert into public.lead_sessoes (sid, etapa_max, virou_lead, lead_id)
  values (p_sid, 5, true, p_lead_id)
  on conflict (sid) do update set
    ultima_em  = now(),
    etapa_max  = greatest(lead_sessoes.etapa_max, 5),
    virou_lead = true,
    lead_id    = coalesce(lead_sessoes.lead_id, excluded.lead_id);
end;
$$;

revoke all     on function public.marcar_lead(text, uuid) from public, anon, authenticated;
grant  execute on function public.marcar_lead(text, uuid) to service_role;
