# Handoff — hub de marketing da nó (01/10/2026)

Para o agente que continua este trabalho. Escrito pelo primeiro Executor, no fim da
sessão em que o hub foi construído e publicado. Fala sempre em português com o Lucca,
direto e com a recomendação antes das opções (`C:/Users/lucca/Bot-vault/Bot/NUCLEO.md`).

## 0. Ordem de leitura

1. Este arquivo.
2. [intent.md](./intent.md) → [spec.md](./spec.md) → [plan.md](./plan.md). No fim do plano estão as
   **14 notas técnicas** da execução, com o motivo de cada desvio.
3. [execution.md](./execution.md), que traz o estado de produção e as provas feitas.
4. [melhorias-2026-10-01.md](./melhorias-2026-10-01.md), o documento do Lucca + dot (o original
   `.docx` está ao lado).

Duas fases, nesta ordem:

- **Fase A — fechar o movimento `hub-marketing-agentes`** com a skill
  `executar-grande-movimento` (o `plan.md` está aprovado). Checklist na seção 4.
- **Fase B — melhorias.** São escopo novo: abra um movimento novo com a skill
  `guiar-grande-movimento` (intent → spec → plan com gates do Lucca) e depois execute.
  Não trate as melhorias como "pendência" do movimento atual. Roteiro na seção 6.

## 1. O que é o app e para que serve

- **Objetivo:** um lugar só para ver e operar o marketing da nó. Ele junta:
  - tráfego pago: Meta Ads e Google Ads;
  - conversão: GA4 e os leads do funil próprio;
  - social: IG/FB orgânico e Search Console.

  O planner também cria e edita campanhas e agenda posts, sem depender da sessão
  pessoal do Lucca em cada painel.
- **Quem usa:**
  - o Lucca (`NO_ADMIN`, sempre com MFA/aal2);
  - o **dot**, agente sempre ligado da OpenAI (ChatGPT, plano Pro). Ele opera **o mesmo
    planner pelo navegador**, com conta própria `MARKETING_AGENT`, e só enxerga o marketing.

  Não existe MCP nem API para agentes: isso foi rejeitado na spec.
- **Objetivo comercial** (do documento de melhorias): captar **agências parceiras** que
  revendam os sistemas da nó (white-label) com margem própria. O funil a medir é:
  anúncio/conteúdo → contato qualificado → roadmap + protótipo em 3 dias → proposta → contratação.
  A campanha ativa hoje é "TRAF - 20d - Agencias" (Meta, Tráfego, otimizada para LPV, R$20/dia desde 22/09).
- **Decisões que não se reabrem sem evidência nova:**
  - C1 = a: o dot tem o mesmo poder do Lucca no marketing, e a confirmação acontece no chat do dot;
  - C2: MFA obrigatório para o Lucca;
  - C3: toda campanha nasce `PAUSED`;
  - C4: o legado Meta de abril é aposentado;
  - a leitura é ao vivo, com cache de 15/60 min;
  - os posts usam fila própria;
  - um único token Google cobre três APIs.

## 2. Onde está cada coisa

| O quê | Onde |
|---|---|
| Repositório | `C:\Users\lucca\projetos\notechstack` (GitHub `luccavgiani-spec/notechstack-lp`). Há vários worktrees (Codex/Claude): **não mexa** no checkout principal nem nos worktrees de outras sessões |
| Branch com este handoff | `claude/hub-marketing-continuacao` (local, sai da `main` `5f0d1aee` com os docs de 01/10; sem push). O código do hub já está na `main` (PR #49) |
| Pasta do movimento | `docs/movimentos/2026-09-30-hub-marketing-agentes/` |
| Banco | `supabase/migrations/20260930215739_hub_marketing.sql`, `20261001000937_hub_marketing_seed_ativos.sql`; rollback em `supabase/rollback/` |
| Testes de banco | `supabase/tests/hub_marketing.test.sql` (pgTAP 47); `r1_02_...` C6 ajustado |
| Função | `supabase/functions/marketing-hub/{index,handler,store}.ts` (o handler tem toda a regra de papel, cache, registro e publicador) |
| Adaptadores | `supabase/functions/_shared/marketing/{normalize,meta,google-auth,ga4,gsc,google-ads,leads,validacao}.ts`; cliente Graph em `_shared/meta.ts` (v25.0) |
| App | `app/src/marketing/*` (planner); `app/src/auth/{RoleRoute.tsx,aal.ts}`; `app/src/pages/LoginPage.tsx` (MFA); rotas em `app/src/App.tsx` |
| Testes do app | `app/src/marketingAdapters.test.ts` (35), `marketingHub.test.ts` (27), `marketingPlanner.test.tsx` (21), `App.test.tsx` (18); E2E `app/e2e/hub-marketing.spec.ts` + helper `app/e2e/mfa.ts` |
| Integração local | `supabase/tests/hub_marketing_edge.mjs` (34 verificações no runtime Deno com Auth/TOTP reais) |
| Provas de viabilidade | `supabase/tests/hub_marketing_viabilidade.{mjs,ps1}` (o Lucca **não quer** rodar de novo; prefira provar pelo planner) |
| Legado arquivado | `supabase/functions-archive/meta-2026-04/` |
| Documentação dos secrets | `supabase/README.md` (seção "Hub de marketing") |
| Memória do Claude | `C:\Users\lucca\.claude\projects\C--Users-lucca-projetos-notechstack\memory\hub-marketing-agentes-estado.md` |

### Produção

- Supabase `sdeowbqmwkwseyktyemn`. Função: `https://sdeowbqmwkwseyktyemn.supabase.co/functions/v1/marketing-hub`.
- App: `https://app.notechstack.com.br/no/marketing/visao-geral?periodo=7d`. O merge na `main`
  publica na Vercel (projeto `notechstack-app`).
- Ativos Meta (em `ad_accounts`, cliente `no-tech-stack`):
  - conta de anúncios `act_1415926037237997` ("No Tech Stach - ADS");
  - Página `1132533626610077`;
  - Instagram `17841441508079164` (@notechstack).

  O usuário do sistema **`no-hub`** (Admin) tem acesso total aos três.
- ⚠️ **Não toque no "Conversions API System User"** do portfólio `990413650211777`. Ele alimenta
  o Pixel/CAPI do site, e "Anular tokens" derruba o CAPI.
- Google:
  - projeto Cloud `no-hub` (app OAuth "No Tech Stack Marketing");
  - Google Ads da nó `930-207-4409`, sob uma MCC criada pelo Lucca (id no secret `GOOGLE_ADS_LOGIN_CUSTOMER_ID`);
  - GA4 `531794428`;
  - Search Console `https://www.notechstack.com.br/`.
- Secrets da função (só nomes):
  - Meta: `META_SYSTEM_USER_TOKEN`;
  - Google OAuth: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN`;
  - Google Ads: `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID`, `GOOGLE_ADS_LOGIN_CUSTOMER_ID`;
  - GA4 e Search Console: `GA4_PROPERTY_ID`, `GSC_SITE_URL`;
  - `APP_URL`.

  `GOOGLE_ADS_CREATE_ENABLED` **ainda não existe** e só entra depois da prova V6.
- Vault: `MARKETING_CRON_SECRET` (gerado no banco) e `marketing_hub_url`.

## 3. Estado verificado (01/10, ~20:30 UTC, só leitura)

O detalhe está em `execution.md` → "Estado em 01/10/2026". Resumo:
- **Funciona:** login com MFA; planner; leitura do Meta Ads; cron (HTTP 200 a cada 5 min);
  grants zerados; funil intacto.
- **Não funciona ainda:**
  - Google (GA4, Search Console e, provavelmente, Google Ads): `OAuth 401 unauthorized_client`;
  - parte do orgânico do Facebook: erro de permissão;
  - conta do dot: não existe.
- **Não provado:** nenhuma escrita (0 `marketing_actions`); legado de abril ainda ACTIVE.

## 4. Fase A — checklist para fechar o movimento (nesta ordem)

Cada item com evidência registrada no `execution.md`. **Produção, conta, permissão,
gasto ou publicação real exigem OK explícito do Lucca no chat, a cada vez.**

1. **Google `unauthorized_client`.** Essa resposta do endpoint de token quase sempre significa
   que o refresh token foi emitido para **outro client ID** do que está no secret. Exemplos:
   o Playground sem "Use your own OAuth credentials" marcado, ou um client secret de outro
   cliente. Peça ao Lucca para:
   - gerar de novo o refresh token no OAuth Playground, **com as credenciais do cliente
     `no-hub` marcadas**, e com os 3 escopos (`adwords`, `analytics.readonly`, `webmasters.readonly`);
   - atualizar `GOOGLE_OAUTH_REFRESH_TOKEN` (e conferir que `CLIENT_ID` e `CLIENT_SECRET`
     são do mesmo cliente).

   Prove abrindo a Visão geral com "Buscar números frescos" (`fresco=1`): os blocos GA4,
   Search Console e Google Ads precisam vir `ok`. Isso fecha V4, V5 e a leitura da V6.
   Você **não** gera tokens nem cola segredos: isso é do Lucca.
2. **Facebook com permissão parcial.** Descubra qual campo pede `pages_read_user_content`.
   O suspeito é `reactions.summary` ou `comments.summary` no `/posts`, em
   `_shared/marketing/meta.ts` → `facebookOrganico`. Ajuste a consulta para usar só o
   que o token cobre, ou peça a permissão ao Lucca, **depois de confirmar que ela é
   necessária** (item 4 do documento de melhorias).
3. **Conta do dot.** O Lucca, na aba Dot do planner, convida `notechstack+dot@gmail.com`.
   O link de convite aparece só na tela e é aberto no navegador do dot. Depois prove o AC5
   (o dot responde à pergunta-exemplo do intent lendo o planner) e o AC7 em produção
   (403 nas áreas proibidas; desligado → 401).
4. **Provas de escrita**, com OK do Lucca a cada uma:
   - AC2 Meta: campanha "[teste hub] …" `PAUSED` → conferir no Ads Manager → ativar e pausar → apagar.
   - AC3 Google, depois do item 1: o Lucca cria `GOOGLE_ADS_CREATE_ENABLED=true` → campanha
     de Pesquisa "[teste hub]" `PAUSED` → conferir → remover. Se o Explorer Access recusar,
     isso é condição de parada: não peça Basic Access sem o OK dele.
   - AC4 posts: publicação **real** exige conteúdo e OK do Lucca. Inclui cancelar um post.
   - AC6 e AC8: o mesmo, feito pelo dot e registrado com `actor_role=MARKETING_AGENT`.
5. **AC1:** conciliar os números do planner com os painéis nativos, no mesmo período e fuso.
   A Meta já tem referência no documento de melhorias.
6. **AC10:** com OK do Lucca, apagar em produção `oauth-callback`, `refresh-tokens`,
   `sync-meta-ads` e `sync-meta-organic`. A fonte está arquivada. Depois confira se
   `meta-capi`, `track-evento` e `painel-dados` continuam ACTIVE.
7. **Fechar o `execution.md`** (`implemented` só se todas as provas passarem; senão
   `needs_verification`, dizendo o que falta). Abra um PR de docs com o OK do Lucca.
8. **Registro:**
   - rodar a skill `sync-vault` (nota "NoTechStack LP" + `context/conectores/`:
     Meta Marketing API/usuário do sistema `no-hub`, Google Ads API/MCC/developer token,
     GA4 Data API, Search Console API, app OAuth `no-hub`, conta do dot, link para esta pasta);
   - atualizar a memória `hub-marketing-agentes-estado.md`;
   - lembrar o Lucca de **rotacionar os tokens** depois da validação (combinado no Passo 0).

## 5. Como trabalhar aqui (o que já se aprendeu)

- **Nunca:**
  - ler `.env`;
  - pôr token em chat, arquivo, commit ou log;
  - mexer em `meta-capi`, `track-evento`, `painel-dados`, `save-lead-progress`, checkout ou `brand/`;
  - criar conta ou gerar ou digitar token (o Lucca faz; você passa o passo a passo com o link certo de cada etapa);
  - `git push`, PR, merge, deploy ou migration em produção sem o OK dele.
- **Banco em produção:** `execute_sql` (MCP) é só leitura. Escrita vai por `apply_migration`.
  Antes e depois de qualquer migration, meça `leads`, `lead_sessoes` e `lead_eventos`
  e rode os advisors.
- **Deploy da função:** o Supabase CLI desta máquina **não está logado**. Use o MCP
  `deploy_edge_function` com `entrypoint_path` `supabase/functions/marketing-hub/index.ts`,
  `verify_jwt=false`, e envie os 14 arquivos com caminhos completos:
  - `marketing-hub/*`;
  - `_shared/cors.ts`, `_shared/logger.ts`, `_shared/meta.ts`;
  - os 8 de `_shared/marketing/`.
- **App:** o merge na `main` publica na Vercel. Confira o bundle em
  `https://app.notechstack.com.br/assets/index-*.js`.
- **Local:**
  - Docker Desktop + `supabase start` (stack compartilhada entre worktrees);
  - `supabase db reset --local`, `supabase test db`;
  - `supabase functions serve marketing-hub` + `node supabase/tests/hub_marketing_edge.mjs`;
  - no app: `npm ci`, `npx vitest run`, `npm run lint`, `npx tsc -b`, `npm run build`;
  - E2E com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` vindos de `supabase status -o env`.
- **Falhas preexistentes** (não são regressão do hub; também falham no commit base `4c053e61`):
  - Vitest `pipelineExamples` (lê pastas fora do repo);
  - E2E `r1-05`, `f2-09` (parte CLIENT), `f2-10` e `r1-07`;
  - pgTAP `agency_console.sql` ("No plan").
- **Navegador:** para ler painéis da Meta e do Google com a sessão do Lucca, use o Claude in
  Chrome, **só leitura**. As abas do Google Cloud abrem por padrão no projeto de cliente
  `discordia`, então confira o seletor de projeto. A Central de API do Ads pode abrir na
  conta "Plantão Digital".

## 6. Fase B — melhorias (depois da Fase A)

Fonte: [melhorias-2026-10-01.md](./melhorias-2026-10-01.md). São 27 itens em três prioridades.
A ordem recomendada pelo próprio documento:

**1ª entrega (bloqueio principal): itens 1 a 5, mais a correção e validação de datas do item 8.**

| Item | Onde mexer (ponto de partida) |
|---|---|
| 1. Excluir testes e qualificar leads (teste, real, inválido, duplicado; zero reais → CPL "não calculável") | `_shared/marketing/leads.ts` + migration nova de classificação em `leads` (o funil é escopo proibido do movimento atual: **precisa de decisão no novo intent**) + `OverviewPage.tsx` (CPL) |
| 2. Resultado que a campanha otimiza (LPV, custo/LPV) | `normalize.ts` (`META_LEAD_ACTION_TYPES` guarda só lead; incluir `landing_page_view`) + `meta.ts` + telas |
| 3. Separar "sem dado" de "zero" (disponível, zero, indisponível, sem permissão, parcial, atrasado, erro) | `handler.ts` (`bloco`), `meta.ts` (`tentar` vira null), `somarMetricas`, total "Meta + Google" na `OverviewPage` |
| 4. Diagnóstico de conexões por capacidade (leitura de anúncios, orgânico e publicação separados) | rota nova em `handler.ts` (estender `/config`) + tela |
| 5. Dicionário de métricas e reconciliação com a Meta (cliques × cliques no link, moeda, fuso, atribuição, versão da API) | `normalize.ts`, `meta.ts` (ler `currency` e `timezone_name` da conta), tela |
| 8. Datas: o período personalizado não aplicou; navegar entre telas perde o período | `MarketingLayout.tsx` (`SeletorPeriodo`, links do menu sem `?periodo`), `CampaignsPage.tsx` |

**2ª entrega: itens 6 a 18.** Tabela diária completa, conjunto/anúncio com insights por
nível, comparação de períodos, taxas sem distorção, criativo completo, configuração e
entrega, recortes, comparação de criativos, semântica orgânica (período × lifetime),
Reels/Stories, paginação sem cortes silenciosos (hoje o corte é de 25 posts) e calendário
unificado com a biblioteca publicada.

**3ª entrega: itens 19 a 27.** Pago × orgânico × desconhecido na atribuição, funil comercial
de agências, histórico mínimo (snapshots), cobertura e atualização por fonte (`coletado_em`),
registro ampliado, acesso específico do dot, exportação reproduzível.

Testes de aceite do documento, que viram critérios no novo `spec.md`:
- *"Compare ontem com os sete dias anteriores da campanha de agências e explique onde mudou a eficiência"*;
- *"Quais conteúdos publicados neste mês geraram mais interação e quais posts antigos cresceram nesta semana?"*;
- a bateria de consistência (account, campaign, adset e ad; mais de 25 posts; dia incompleto; conversão tardia).

**Como conduzir:** use `guiar-grande-movimento`, com o documento como evidência principal.
Proponha ao Lucca que o primeiro movimento cubra só a **1ª entrega**, porque é o que destrava
decisões confiáveis. Os itens 1 e 19–21 tocam no funil (`leads`, `lead_sessoes`, `lead_eventos`),
que o movimento atual declarou intocável: isso precisa ser decidido explicitamente no intent.
O documento é avaliação e não autorização: implementar só depois do gate do plano.
