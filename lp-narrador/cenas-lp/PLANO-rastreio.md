# Plano de execução — rastreio da lp-v5

Aplica ponto a ponto o que está levantado em **`RASTREIO-lp-v5.html`** (mesma pasta;
publicado também em https://claude.ai/code/artifact/f9f223e6-0bec-4f21-93dc-02c5e8504e88).
O relatório explica *o quê* e *por quê*; este arquivo é *em que ordem*, *onde exatamente*
e *como saber que funcionou*.

Levantado em 14/08/2026 contra o `gtm.js` publicado, a `lp-v5.html` (7.597 linhas), a
`send-lead-email` e o quadro "Fluxo do CRT" no Miro.

---

## Regra de convivência (ler antes de qualquer coisa)

> ✅ **Resolvido em 14/08 19h.** A sessão de front fechou em `a116697` e deixou o
> `HANDOFF-front-para-rastreio.md`. O Bloco B está liberado. As nove âncoras foram
> reconferidas contra o commit novo e **todas continuam únicas** — só a B3.1 mudou de lugar,
> e para melhor (ver lá).

**A `lp-v5.html` estava sendo mexida em outra sessão, em ajustes visuais.** Duas
consequências que valem para todo o resto deste arquivo:

1. **Nenhum passo do Bloco B começa antes de a sessão visual fechar e commitar.** Editar o
   mesmo arquivo de 400 KB em duas frentes é como perder trabalho.
2. **Os pontos de inserção deste plano são ÂNCORAS DE TEXTO, não números de linha.** Os
   números do relatório valiam às 18h de 14/08 e andam com o primeiro ajuste de CSS — o
   arquivo já foi de 7.597 para 7.788 linhas. Cada gancho abaixo traz a string exata a
   procurar. Se uma âncora não for encontrada ou aparecer duas vezes, **pare e reconfira**:
   quer dizer que a região foi reescrita e o gancho precisa ser reposicionado à mão.

O **Bloco A é independente do arquivo** e pode rodar a qualquer momento. É de propósito: ele
é o que dá mais resultado por hora gasta.

---

## BLOCO A — Container GTM · ~1h30 · não toca na lp-v5.html

Faz o GA4 enxergar conversão pela primeira vez e leva o Meta Pixel para dentro do container.
Vale para o site que já está no ar (home + Roteador) e deixa o terreno pronto para a lp-v5.

### A1 · Criar as variáveis

Em **Variáveis → Definidas pelo usuário**.

- [ ] Doze **variáveis da camada de dados**, nome igual ao parâmetro:
      `lead_sid`, `etapa`, `modo`, `folha`, `nicho`, `caminho`, `opcao`, `passo`,
      `prazo`, `origem`, `capitulo`, `cta`, `gravado`, `valor`.
      Nomear no GTM como `dl.lead_sid`, `dl.etapa`, etc.
- [ ] Uma **JavaScript personalizado** chamada `js.sid`:

```js
function(){
  try {
    var s = sessionStorage.getItem('no_sid');
    if (!s){
      s = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2,10);
      sessionStorage.setItem('no_sid', s);
    }
    return s;
  } catch(e){ return ''; }
}
```

> **Por que ela GERA e não só lê.** No relatório essa variável só lia o `sessionStorage`.
> Fazendo-a gerar quando não existe, qualquer página do container passa a ter um `sid` —
> inclusive o Roteador, que não tem o motor de telemetria. Sem isso, o `eventID` do Lead do
> Roteador sairia vazio e não deduplicaria contra o CAPI. A chave é a mesma (`no_sid`) que
> o motor da lp-v5 usa: quem rodar primeiro cria, o outro aproveita.

### A2 · Tag D — GA4, eventos da jornada

- [ ] Tag **GA4 Event**, ID de medição `G-1YEB89RVER`.
- [ ] Nome do evento: `{{Event}}`.
- [ ] Parâmetros: `lead_sid`, `etapa`, `modo`, `folha`, `nicho`, `caminho`, `passo`,
      `origem`, `capitulo`, `opcao`, `cta`.
- [ ] Acionador: **Evento personalizado**, marcar "usar correspondência de regex",
      `^(cta_click|capitulo_visto|diag_|form_)`.

Fica inerte até o Bloco B: nenhuma página empurra esses eventos hoje. É seguro publicar.

### A3 · Tag E — GA4, `generate_lead`

- [ ] Tag **GA4 Event**, nome fixo `generate_lead`.
- [ ] Parâmetros: `value` = `{{dl.valor}}`, `currency` = `BRL`, `method` = `{{dl.modo}}`,
      mais `folha`, `nicho`, `prazo`, `caminho`, `gravado`, `lead_sid`.
- [ ] Acionador: **Evento personalizado** `lead_submit`.

> **Atenção:** esta tag **passa a disparar no Roteador imediatamente**, porque a LP do
> Roteador já empurra `lead_submit`. É bom — é a primeira vez que o GA4 vai registrar
> conversão. Mas os parâmetros `valor`, `modo`, `folha` chegam vazios de lá, porque o
> Roteador não os manda. Esperado; não é bug. Se incomodar, o Roteador pode ganhar um
> `dataLayer.push` com `modo:'roteador'` no mesmo envio.

### A4 · Tag C — ajustar a conversão do Ads que já existe

Tag existente: conversão `AW-17683211415`, rótulo `C9CNCJjBsMwcEJfJgfBB`, acionador
`lead_submit`. **Não renomear o acionador** — é o que sustenta a conversão publicada.

- [ ] Acrescentar `transaction_id` = `{{dl.lead_sid}}` (deduplica recarga e envio duplo).
- [ ] Acrescentar `value` = `{{dl.valor}}` e `currency` = `BRL`.
- [ ] Deixar as **conversões otimizadas** anotadas como pendência do Bloco C — sem e-mail
      e telefone chegando à tag, ligar agora não faz efeito.

### A5 · O pixel muda de casa — os dois passos são um só

**Esta é a parte que pode dar errado se for feita fora de ordem.** Hoje o pixel
`1753619075655271` está escrito à mão no `Roteador/index.html`. Publicar a tag do container
antes de tirar o bloco de lá faz o Roteador contar PageView e Lead **em dobro**.

Ordem obrigatória — **primeiro o site, depois o container**:

- [ ] **A5.1** — Em `Roteador/index.html`, remover o bloco do Meta Pixel:
      da linha `<!-- Meta Pixel Code -->` até `<!-- End Meta Pixel Code -->` (hoje 30–46),
      incluindo o `<noscript>` do `facebook.com/tr`.
- [ ] **A5.2** — No mesmo arquivo, remover **também** `if(window.fbq)fbq('track','Lead');`
      (hoje linha 1508, dentro do submit do `leadForm`). O `dataLayer.push({event:'lead_submit'})`
      logo abaixo **fica** — é ele que vai acionar a tag do container.
- [ ] **A5.3** — Deploy do site. A partir daqui e até A5.4 o Roteador fica alguns minutos
      **sem pixel nenhum**. É intencional: perder alguns minutos de dado é melhor que
      inflar público de retargeting e reportar custo por lead pela metade.
- [ ] **A5.4** — Tag **F**, HTML personalizado, acionador **All Pages**:

```html
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','1753619075655271');
fbq('track','PageView',{},{eventID:'pv-'+{{js.sid}}});
</script>
```

- [ ] **A5.5** — Commitar a edição do Roteador. `vercel --prod` sobe o working tree e não um
      commit: sem commitar, o próximo `git push` reverte a remoção e o pixel duplo volta.

### A6 · Tags G, H, I — o funil da Meta

Todas HTML personalizado, todas **sem `content_name` / `content_category` / `content_ids` /
`contents`** (decisão 5 do relatório: quatro das dezenove folhas são saúde).

- [ ] **G** — acionador `diag_abrir`:
      `fbq('track','ViewContent',{value:0,currency:'BRL'},{eventID:'vc-'+{{js.sid}}});`
- [ ] **H** — acionador `form_contato`:
      `fbq('track','InitiateCheckout',{value:1,currency:'BRL'},{eventID:'ic-'+{{js.sid}}});`
- [ ] **I** — acionador `lead_submit`:
      `fbq('track','Lead',{value:{{dl.valor}},currency:'BRL'},{eventID:{{js.sid}}});`
      O `eventID` aqui é o `sid` **puro**, sem prefixo — é ele que deduplica contra o CAPI
      no Bloco C.

### A7 · Publicar e provar sem abrir o browser

- [ ] QA no **modo Visualizar** antes de publicar.
- [ ] **Publicar** o container (nada acima vale sem isso — é a causa nº 1 de "o pixel não
      está captando").
- [ ] Provar:

```bash
curl -s "https://www.googletagmanager.com/gtm.js?id=GTM-NK87FH8W" -o /tmp/gtm.js
grep -c '1753619075655271' /tmp/gtm.js   # >= 1  → Meta Pixel publicado
grep -c 'G-1YEB89RVER'    /tmp/gtm.js    # >= 1  → GA4 continua lá (não derrubou nada)
grep -c 'AW-17683211415'  /tmp/gtm.js    # >= 1  → Ads continua lá
```

### A8 · GA4 — o que fazer na interface

- [ ] Marcar `generate_lead` como **evento principal** (key event).
- [ ] Importá-lo no Google Ads como **conversão secundária**, para os dois números conferirem
      sem competir pela otimização.
- [ ] Criar as **dimensões personalizadas de escopo evento**: `folha`, `caminho`, `nicho`,
      `modo`, `origem`, `capitulo`, `lead_sid`, `passo`, `gravado`.
      **Sem isso o parâmetro chega, é guardado e não aparece em relatório nenhum — e a
      dimensão não retroage.** É a pegadinha clássica do GA4; criar antes de o tráfego vir.
- [ ] Montar a exploração **Funil**: `page_view` → `diag_abrir` → `diag_escolha` →
      `diag_folha` → `form_abrir` → `form_contato` → `generate_lead`, segmentada por
      `nicho` e por `origem`.

---

## BLOCO B — lp-v5.html · ~1h · SÓ depois que a sessão visual fechar

### B0 · Antes de encostar no arquivo

- [ ] Confirmar com a outra sessão que os ajustes visuais estão **commitados**.
- [ ] `git status` limpo em `lp-narrador/cenas-lp/`.
- [ ] Cópia de segurança no padrão da pasta: `lp-v5.bak-rastreio-AAAAMMDD-HHMM.html`.

### B1 · O motor, no `<head>`

**Âncora:** a linha do `gtm.start` (hoje 13). Inserir o bloco **logo depois dela e antes**
do `<meta charset>` — o motor precisa existir antes de qualquer tag disparar, senão o
primeiro `eventID` sai sem `sid` e não deduplica.

- [ ] Colar o bloco `TELEMETRIA · um ponto de saída só` do relatório (seção 04, "O motor").

### B2 · Tirar o atraso de 2 s

**Âncora:** `setTimeout(function(){var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtm.js`
(hoje na última linha do arquivo, 7598).

- [ ] Substituir pelo snippet padrão no `<head>`, como o Roteador já faz.

> Os dois segundos eram economia de performance numa home institucional. Numa LP que vai
> receber tráfego pago é conversão jogada fora: quem sai antes não conta em lugar nenhum e
> o `gclid` da URL vai embora junto. Se o LCP voltar a incomodar, o caminho é
> `fetchpriority` nos vídeos do monitor — não atrasar a medição.

### B3 · Os ganchos

Cada item: **âncora** (string única, verificada) → **o que colar**. O código completo está na
seção 04 do relatório, "Os ganchos".

> **Reconferido contra o commit `a116697`** (o handoff da sessão de front, em
> `HANDOFF-front-para-rastreio.md`): as nove âncoras abaixo continuam existindo e continuam
> **únicas** no arquivo. A B3.1 mudou de lugar — ver a nota logo depois da tabela.

| # | Âncora (procurar por) | Evento |
|---|---|---|
| B3.1 | `if (opts && opts.semRolar){ destrancar(); return; }` — colar **depois** | `diag_abrir` + `diag_voltar` |
| B3.2 | `curMenuNode = nodeId;` — colar **depois** | `diag_pronto` |
| B3.3 | `seedPath.push(o);` + `applySeed();` — colar **depois** | `diag_escolha` |
| B3.4 | `curLeaf = node.options ? null : id;` — colar **depois** | `diag_folha` |
| B3.5 | `const prova = (node && node.prova) \|\| MAIS;` — colar **depois** | `diag_prova` |
| B3.6 | `cfAberto = !!opts.aberto;` — colar **depois** | `form_abrir` |
| B3.7 | `if (f) setTimeout(() => f.focus({ preventScroll:true }), 60);` — colar **depois do bloco `if`**, antes do `crtNavState()` | `form_passo` + `form_contato` |
| B3.8 | `const out = await resp.json().catch(() => ({}));` — colar **depois** | `lead_submit` + `lead_falha` |
| B3.9 | no `catch(e)` do mesmo `cfEnviar` | `lead_submit` com `gravado:false` |
| B3.10 | fim do bloco do formulário (depois do listener de teclas 1–3) | `form_abandono` |
| B3.11 | `id="heroCtaBtn"` e os quatro `class="fx-more ...` | `cta_click` |
| B3.12 | novo `IntersectionObserver` sobre `.fx-sec, #platforms, #ctafinal`, 60% por 2 s | `capitulo_visto` |
| B3.14 | `setTimeout(() => fechar(aoFim), 180);   // a barra cheia chega a ser vista` — colar **antes** | `diag_portal` |

#### B3.1 mudou de lugar — e ficou mais simples (commit `a116697`)

`abrirDiagnostico()` foi reescrita: virou uma travessia por **portal** (véu preto + barra com
o carregamento real dos ~8 MB de vídeo do pouso) e agora tem **três caminhos**.

O plano previa marcar as chamadas do painel com `origem:'painel'` e filtrar por isso. **Não
precisa mais**: a sessão de front já separou os caminhos com `{semRolar:true}`, que é
exatamente a fronteira que a gente queria. O gancho passa a viver **depois** do `return` do
`semRolar` — e aí tudo que chega ali é visitante de verdade, sem editar nenhum call site,
sem inventar campo novo, e sem o risco de alguém acrescentar uma chamada de debug no futuro
e esquecer de marcá-la.

```js
  /* passou do semRolar: daqui pra baixo é visitante. O painel de calibragem e
     o pousoForceNode retornam antes, por contrato do front. */
  if (window.track){
    if (!primeiraVez) track('diag_voltar', { etapa:1 });   // já tinha atravessado
    track('diag_abrir', {
      etapa:1,
      origem: location.hash === '#pouso' ? 'deeplink' : 'cta_final'
    }, '1');
  }
```

**~~B3.13~~ — cancelado.** Era o passo de editar os call sites para carregar a `origem`.
O contrato do `semRolar` resolve, e a origem se lê do `location.hash`.

#### B3.14 — o portal precisa do próprio evento

O portal insere **de 1,1 s a 9 s** entre o clique e a sala aparecer (`MIN_MS = 1100`,
`LIMITE = 9000`). Duas consequências que mudam o desenho:

1. **`diag_abrir` dispara no clique, antes da travessia** — não depois. Se disparasse
   depois, um abandono no meio de nove segundos sumiria do funil, e num aparelho ruim o
   evento poderia nem chegar a ser enviado. O que esse passo mede é a decisão de entrar.
2. **Sem `diag_portal`, quem desiste na travessia fica invisível.** Nove segundos de véu
   preto é tempo de sobra pra perder gente, e essa perda hoje não tem número. O evento leva
   `ms` (duração real) e `estourou` (bateu no teto = conexão ruim), e a diferença entre
   `diag_abrir` e `diag_portal` vira a taxa de travessia.

```js
    track('diag_portal', { ms: Math.round(t), estourou: t > LIMITE });
```

> **Não meça "tempo até o diagnóstico" pelo relógio.** Esse intervalo é encenação
> deliberada, com piso de 1,1 s — abaixo disso a travessia pisca e não se lê. Um alerta de
> performance em cima dele estaria medindo direção de arte.

#### O que a mudança de ordem das seções NÃO quebra

`#platforms` subiu para antes do `#ctafinal`. Isso **não afeta** o `capitulo_visto`: os seis
capítulos são `.fx-sec` e mantiveram a ordem relativa entre si; `#platforms` é `.sec-studio`
e nunca esteve na lista. O que fiz foi **aproveitar** a mudança — `#platforms` e `#ctafinal`
entraram no mesmo observador, porque agora a seção de expertise é um passo real antes do CTA
e vale saber se quem converte passou por ela.

### B4 · O envio do lead — **desempacotar**, não empacotar mais

> **Mudou desde que o Bloco C subiu.** A versão original deste passo mandava enfiar o `sid`
> dentro do `aiAnalysis`, porque a function descartava chave fora dos oito campos. **A v8 já
> aceita tudo em coluna própria.** O handoff do front descreve a v7 (`"não existe coluna
> para site, descricao nem path"`) — estava certo às 18h49, ficou desatualizado às 19h.
> E o próprio handoff antecipa o que fazer: *"assim que existirem colunas, é remover o
> empacotamento em `cfEnviar()`"*. É exatamente isto.

**Âncora:** o array `const bloco = [` dentro de `cfEnviar()`.

- [ ] Reduzir o `bloco` ao que é texto de leitura mesmo — `LEITURA DA NÓ`, os dois avisos de
      modo e o registro do aceite. **Tirar de lá `SITE:` e `O QUE ELE CONTOU:`**, que agora
      têm coluna.
- [ ] No corpo do `fetch`, trocar o `path` (que a function sempre ignorou) pelos campos reais:

```js
  sid:       window.leadSid,
  site:      site,
  descricao: desc,
  folha:     curLeaf || null,
  nicho:     (curLeaf && CRT_ACC[curLeaf]) || null,
  caminho:   caminho || null,
  modo:      cfDireto ? 'direto' : (cfAberto ? 'aberto' : 'ponte'),
  valor:     cfDireto ? 3 : (cfQuando === 'o quanto antes' ? 2 : 1),
  origem:    window.leadOrig,
  fbp:       (document.cookie.match(/_fbp=([^;]+)/) || [])[1] || null,
  fbc:       (document.cookie.match(/_fbc=([^;]+)/) || [])[1] || null,
  event_source_url: location.href,
```

> **`fbp` e `fbc` são o que fazem o CAPI valer.** Sem eles o evento server-side chega sem
> como casar com o clique no anúncio, e a correspondência despenca. Os dois cookies são
> criados pelo pixel — ou seja, **só existem depois do Bloco A**. Antes disso vão nulos e
> não quebram nada.

### B5 · Validar

- [ ] Modo **Visualizar** do GTM aberto na lp-v5 local.
- [ ] Percorrer a árvore inteira até enviar e ver os eventos chegando, **todos com o mesmo
      `lead_sid`**.
- [ ] Subir e descer a página no meio da conversa: `diag_abrir` **não pode repetir**.
- [ ] Abrir o painel (`D`) e usar "Ir para esta seção": **nenhum** `diag_abrir` disparado.
      Idem para o `pousoForceNode` do painel.
- [ ] Atravessar o portal e conferir `diag_portal` com `ms` plausível (≥ 1100).
- [ ] Voltar ao `#pouso` já aberto: sai `diag_voltar`, **não** um segundo `diag_abrir`.
- [ ] Mandar um lead e conferir no banco que `site`, `descricao`, `folha`, `caminho` e `modo`
      chegaram **em coluna**, com o `ai_analysis` já sem o empacotamento.

---

## BLOCO C — Server-side · ✅ APLICADO em 14/08/2026

Tudo abaixo está **no ar**. Faltam dois secrets, listados no fim do bloco D.

### C1 · `meta-capi` ✅

- [x] `supabase/functions/meta-capi/index.ts` criado **self-contained** (CORS e JSON inline;
      import de `../_shared` já quebrou deploy antes). Deployado, `verify_jwt: false`.
- [ ] **Secret `META_ACCESS_TOKEN`** — gerar no Events Manager do portfólio `990413650211777`
      e setar. Sem ele a function responde `500 meta_access_token_missing` (verificado).
- [x] Deploy pelo MCP do Supabase. *A CLI local (`supabase` 2.95.4) devolve
      `403 privileges` — o token dela não tem permissão nesta organização.*
- [x] Provado:

```bash
FN=https://sdeowbqmwkwseyktyemn.supabase.co/functions/v1
curl -s -X POST "$FN/meta-capi" -H "Content-Type: application/json" -d '{}'
# esperado: 400 event_name_required   (401 = verify_jwt ligado; 500 = secret faltando)

curl -s -X POST "$FN/meta-capi" -H "Content-Type: application/json" \
  -d '{"event_name":"PageView","event_source_url":"https://notechstack.com.br","fbp":"fb.1.1.1"}'
# esperado: {"success":true,"events_received":1,"fbtrace_id":"..."}
```

### C2 · `send-lead-email` v2 — a pendência que o vault já registra ✅

- [x] Migração `20260814190000_rastreio_jornada.sql`: `leads` ganhou 18 colunas
      (`sid`, `site`, `descricao`, `folha`, `nicho`, `caminho`, `modo`, os oito de origem,
      `fbp`, `fbc`, `capi_status`) + índices em `sid` e `created_at`.
- [x] Function **v8** aceita e grava em coluna própria. **O contrato antigo continua valendo**:
      as LPs que mandam os oito campos de sempre (Roteador, lp-v3, lp-v4) seguem funcionando,
      e `caminho` cai de volta em `objetivos` quando não vem. Testado nas duas formas de
      payload, com gravação e e-mail confirmados.
- [x] `Prefer: return=representation` em vez de `minimal` — é o `id` do lead que liga a linha
      à sessão. Volta no corpo da resposta como `leadId`.
- [ ] Ajustar a lp-v5 para mandar os campos soltos (desfaz o B4, que era o contorno) — **é
      trabalho do Bloco B**, porque toca o arquivo.
- [ ] Ajustar o Roteador para mandar `sid` também (opcional; sem isso o lead de lá entra sem
      percurso, que é o que já acontece hoje).

### C3 · O `Lead` sai de dentro da function ✅

- [x] Depois de gravar, a function dispara o `Lead` para o CAPI com `event_id = sid` (o mesmo
      da tag I → a Meta descarta a duplicata e fica com a versão mais rica) e `user_data` com
      `em` e `ph` **hasheados em SHA-256**. O telefone é normalizado com o **55 na frente** —
      sem código de país o hash não casa com nada e o dado enviado é lixo.
- [x] O resultado do envio fica gravado em `leads.capi_status` (`ok_1`, `erro_400`,
      `sem_token`…), pra auditar sem abrir log.
- [ ] Com e-mail e telefone chegando, ligar as **conversões otimizadas** do Google Ads (A4).

### C4 · Costura com o percurso ✅

- [x] Migração `20260814190500_registrar_eventos.sql`: RPC `marcar_lead(sid, lead_id)`,
      chamada quando o payload traz `sid`. Marca a sessão como `virou_lead`, sobe a
      `etapa_max` para 5 e guarda o `lead_id`. Se a sessão não existir (LP sem telemetria,
      beacon bloqueado), cria a linha mínima — melhor uma sessão sem percurso que um lead
      órfão. Verificado ponta a ponta.

---

## BLOCO D — Painel de percurso · backend ✅ APLICADO, painel pendente

- [x] **D1** — `lead_sessoes` e `lead_eventos` criadas, RLS ligada e **sem policy** — só
      `service_role` entra. `lead_sessoes.lead_id` → `leads.id`.
- [x] **D2** — Views `funil_dia` e `folha_desempenho`, ambas com `security_invoker = true`
      (sem isso a view empresta o privilégio do dono e vaza a tabela por baixo da RLS).
- [x] **D3** — Function `track-evento` deployada, `verify_jwt: false`. **Ela não decide nada**:
      toda a validação mora na RPC SQL `registrar_eventos`, numa transação só —
      formato do `sid`, lista fechada de nomes de evento, teto de 60 por lote e 200 por
      sessão, `greatest` na etapa (a etapa nunca desce) e `coalesce` invertido na origem
      (a utm da primeira visita não é apagada pelo pageview seguinte).
      Caminho de escrita público não pode ter a regra do lado que o cliente controla.
      Testado: lote de 3 gravou 3; nome fora da lista gravou 0.
- [ ] **D4** — No front, implementar `window.trackFila` (o motor já chama, se existir): acumula
      e manda a cada 3 s ou no `pagehide` via `sendBeacon`. **Um POST por clique derrubaria a
      experiência do monitor.** É trabalho do Bloco B.
- [x] **D5** — Function `painel-dados` deployada, protegida por `x-painel-token` com
      comparação de tempo constante. Quatro consultas: `funil`, `folhas`, `leads`
      (com o contato embutido pela FK) e `percurso` de um `sid`. A chave de serviço
      **nunca** entra no HTML do painel.
- [ ] **D6** — `painel-leads.html` local, sem build, no padrão do kanban de roadmap. Três
      telas: **Funil** (taxa de passagem entre etapas), **Leads** (linha do tempo individual),
      **Árvore** (as 19 folhas por conversão e por abandono).

### Os dois secrets que faltam

Sem eles o backend está de pé mas mudo. Setar em **Supabase → Project Settings → Edge
Functions → Secrets**:

| Secret | Para quê | Como obter | Sintoma hoje |
|---|---|---|---|
| `META_ACCESS_TOKEN` | `meta-capi` e o `Lead` server-side da `send-lead-email` | Events Manager → conjunto de dados `1753619075655271` (portfólio `990413650211777`) → gerar token da Conversions API | `capiStatus: "sem_token"` na resposta do lead; `500 meta_access_token_missing` no `meta-capi` |
| `PAINEL_TOKEN` | autenticar o painel | inventar um segredo longo e aleatório; só você usa | `painel-dados` responde `500 {"erro":"config"}` |

Depois de setar, provar:

```bash
FN=https://sdeowbqmwkwseyktyemn.supabase.co/functions/v1
curl -s -X POST "$FN/meta-capi" -H "Content-Type: application/json" \
  -d '{"event_name":"PageView","event_source_url":"https://notechstack.com.br","fbp":"fb.1.1.1"}'
# esperado: {"events_received":1,"messages":[],"fbtrace_id":"..."}

curl -s "$FN/painel-dados?v=funil" -H "x-painel-token: SEU_TOKEN"
# esperado: [] (ainda não há sessão — o Bloco B é quem começa a alimentar)
```

---

## Precisa de você antes de começar

| # | Decisão | Bloco |
|---|---|---|
| 1 | **Confirmar o portfólio Meta** que tem o domínio `notechstack.com.br` verificado — é onde o token do CAPI tem que ser gerado. Criar no portfólio errado é caro de desfazer. | A5, C1 |
| 2 | **Quem clica no GTM.** Os passos do Bloco A são de interface e precisam da sua conta Google logada. Eu escrevo tudo, mas alguém precisa colar e publicar. | A |
| 3 | **A escala de `valor`** está proposta como 3 (falar agora) / 2 (o quanto antes) / 1 (resto). É o que a Meta e o Ads usam para otimizar por valor. Se o critério certo for outro, é aqui que se muda. | A3, A4 |
| 4 | **O segredo do `x-painel-token`.** | D5 |
| 5 | O **Consent Mode v2** ficou fora de propósito (público BR, LGPD coberta pelo aceite do passo 3). Se houver campanha para a Europa, precisa entrar **antes** de a campanha subir. | — |
| 6 | 🔴 **`/termos` e `/privacidade` dão 404** e o checkbox do passo 3 agora aponta para elas com link de verdade (antes eram `<b>`, texto que ninguém conseguia abrir). Publicar assim é coletar dado pessoal com um aceite ilegível. **Isto é mais do escopo do rastreio do que parece:** o aceite é a base legal do tratamento, e a gente está prestes a somar Pixel, GA4, Ads e CAPI em cima dele. Bloqueia o go-live da home. | go-live |

---

## Registro de execução

| Bloco | Estado | Quando | Notas |
|---|---|---|---|
| A — container GTM | ✅ **publicado** | 14/08/2026 | versão "Rastreio da jornada"; `gtm.js` serve pixel + 5 tags GA4 |
| B — lp-v5.html | ✅ **no ar como home** | 14/08/2026 | PR #17 e #18 mergeados; `/` serve a lp-v5 |
| C — server-side | ✅ **no ar** | 14/08/2026 | secrets setados; CAPI devolveu `events_received: 1` |
| D — painel | ✅ **completo** | 14/08/2026 | `painel-leads.html`, três telas |

### A validação ponta a ponta (14/08/2026, servidor local)

Percorri a jornada inteira no browser — hero → CTA → portal → árvore → folha →
ponte → formulário → envio. O que chegou:

```
cta_click → diag_abrir → diag_portal → diag_pronto → diag_escolha → diag_escolha
→ diag_folha → form_abrir → form_passo ×3 → form_contato → lead_submit
```

Os 16 eventos com o mesmo `lead_sid`, e o `lead_submit` carregando
`gravado:true · modo:ponte · folha:f_com_produto · nicho:ecom · valor:2`.

No banco, o mesmo percurso gravado em `lead_eventos`, a sessão com `etapa_max 5`
e `virou_lead`, o lead com **coluna própria** para site, descrição, folha, nicho,
caminho e modo — e **`capi_status: ok_1`**, ou seja, o Meta recebeu o `Lead`
server-side com e-mail e telefone hasheados. Dados de teste apagados depois.

### O container, montado em 14/08/2026 — e por que NÃO foi publicado

Conta confirmada antes de tocar em qualquer coisa: **Nó Tech Stack ·
notechstack@gmail.com** (`authuser=1`), com **sete contas Google logadas** no Chrome.
Criar sob a identidade errada é caro de desfazer — vale sempre parar e conferir.

Montado por **importação de JSON** em vez de ~150 cliques: 15 variáveis, 5 acionadores e
6 tags, com `Combinar` (nunca `Substituir`, que apagaria GA4 e Ads). O diff da primeira
importação veio **0 modificadas · 26 adicionadas · 0 excluídas** — as tags que já existiam
ficaram intactas.

**Dois bugs pegos antes de ir pro ar:**

1. **Aspas em Custom HTML.** O GTM substitui `{{variável}}` pelo valor **cru, sem aspas**.
   `{eventID:'pv-'+{{js.sid}}}` viraria `'pv-'+66570817-5122-...` — erro de sintaxe que
   mataria as quatro tags Meta em silêncio. As aspas vão **dentro** da string:
   `{eventID:'pv-{{js.sid}}'}`.
2. **A categoria temática no GA4.** A `/privacidade` promete, por escrito, que categoria
   capaz de revelar dado sensível não vai para plataforma de anúncio — quatro das dezenove
   folhas são saúde. As tags Meta já nasceram limpas (só `value` e `currency`), mas as de
   GA4 levavam `folha`, `nicho` e `caminho` — e **o GA4 alimenta o Google Ads pelo mesmo
   container**. Removidos.

   Mascarar só as folhas de saúde foi descartado: a ausência vira a marca. Sessão sem
   `folha` seria, por eliminação, sessão de saúde. A análise por folha mora no painel de
   percurso (first-party, view `folha_desempenho`), que responde isso melhor do que o GA4
   responderia — então não se perde nada.

**O que ficou no GA4:** `lead_sid`, `etapa`, `modo`, `passo`, `origem`, `capitulo`, `cta`
e, no `generate_lead`, `value`, `currency`, `method`, `prazo`, `gravado`. Nada temático.

> ⛔ **Está tudo no workspace, sem publicar, e é assim que tem que ficar até o deploy.**
> Publicar a tag do pixel enquanto a produção ainda tem o bloco escrito à mão no
> `roteador/index.html` faz o Roteador contar PageView e Lead **em dobro**. A sequência é:
> **merge do PR → deploy → publicar o container**, nessa ordem e na mesma sessão.

### Depois de publicar, o que ainda falta no GA4

É a única parte que **não cabe num PR** — tag de container não é arquivo de repo.
O código já empurra tudo para o `dataLayer`; falta o container escutar. Enquanto o
Bloco A não for publicado:

- o GA4 não vê nenhum dos 17 eventos de jornada (só `page_view`);
- a Meta não vê nada pelo navegador — só o `Lead` do CAPI, que já funciona;
- `_fbp` e `_fbc` não existem, então o `Lead` do CAPI vai sem os cookies de
  correspondência (funciona, mas com match quality menor do que poderia).

> ⚠️ **A ordem do A5 é inegociável e este PR é a primeira metade dela.** O bloco
> do pixel já saiu do `Roteador/index.html` neste branch. Do momento em que este
> PR for para produção até a publicação da tag F no container, **o Roteador fica
> sem Meta**. São minutos, e é o lado seguro do erro: o inverso — publicar a tag
> com o HTML ainda no ar — faria o Roteador contar PageView e Lead em dobro.
> **Publique o container logo depois do deploy, na mesma sessão.**

### O que subiu em 14/08/2026

| Peça | Onde |
|---|---|
| Migração `rastreio_jornada` | 18 colunas em `leads`, tabelas `lead_sessoes` e `lead_eventos`, views `funil_dia` e `folha_desempenho` |
| Migração `registrar_eventos` | RPCs `registrar_eventos(jsonb)` e `marcar_lead(text,uuid)`, `security definer`, execute revogado de `anon`/`authenticated` |
| `meta-capi` v1 | nova, `verify_jwt: false` |
| `track-evento` v1 | nova, `verify_jwt: false` |
| `painel-dados` v1 | nova, `verify_jwt: false` |
| `send-lead-email` v8 | atualizada, `verify_jwt: false` (era v7) |

Arquivos no repo: `supabase/migrations/20260814190000_rastreio_jornada.sql`,
`supabase/migrations/20260814190500_registrar_eventos.sql`,
`supabase/functions/{meta-capi,track-evento,painel-dados,send-lead-email}/index.ts`.

> **Rollback da `send-lead-email`**, se preciso: a v7 continua no histórico de versões do
> Supabase. O `git` também tem a v1 — mas atenção, a v7 do servidor e a versão que estava no
> git podiam já estar defasadas entre si.
