---
movement_id: hub-marketing-agentes
intent: ./intent.md
spec: ./spec.md
spec_revision: 96c9b7f (rev. 3; correção de fato 3.1 no mesmo commit deste plano)
status: draft
updated: 2026-09-30
---

# Plan: marketing da nó num lugar só, operável por agentes

## Resultado que será entregue

- **Planner `/no/marketing`** no app da nó (`notechstack-app.vercel.app`), com:
  - Visão geral: Meta Ads, Google Ads (via GA4), GA4, Search Console, IG/FB
    orgânico e contagem de leads;
  - Campanhas: criar e editar Meta e Google Pesquisa;
  - Calendário de posts IG/FB;
  - Registro de ações;
  - Controle "desligar/religar dot".
- **Conta própria do dot** (`MARKETING_AGENT`), que opera o planner pelo navegador
  com o mesmo poder do Lucca no marketing.
- **MFA obrigatório** na conta do Lucca.
- **Edge Function `marketing-hub`** com os adaptadores, credenciais de máquina e
  publicador agendado via `pg_cron`.
- **Legado Meta de abril** fora de produção, com a fonte arquivada.

## Donos da mudança

| Mudança | Repositório/superfície | Fonte canônica |
|---|---|---|
| Contas, apps e credenciais Meta/Google | Lucca, nos painéis Meta Business e Google (checklist do Passo 0) | este plano |
| Migrations (grants, `marketing_actions`, cache, `pg_cron`, bucket) | `notechstack-lp` → `supabase/migrations/` → projeto `sdeowbqmwkwseyktyemn` | `spec.md`; `supabase/README.md` |
| Adaptadores e `marketing-hub` | `supabase/functions/_shared/marketing/`, `supabase/functions/marketing-hub/` | `spec.md`; `_shared/meta.ts` |
| Planner, papéis, MFA e redirect de login | `app/src/marketing/`, `app/src/auth/RoleRoute.tsx`, `app/src/App.tsx`, `app/src/pages/LoginPage.tsx` | `spec.md`; `brand/BRAND.md`; `app/README.md` |
| Aposentadoria do legado | `supabase/functions/{oauth-callback,refresh-tokens,sync-meta-ads,sync-meta-organic}` → `supabase/functions-archive/meta-2026-04/`; `supabase/config.toml` | `spec.md` C4 |
| Registro no Bot-vault | nota "NoTechStack LP" + `conectores/` (PC do Lucca) | `CLAUDE.md` do repo |

## Blast radius e risco principal

- O Supabase `sdeowbqmwkwseyktyemn` é **produção compartilhada**:
  - funil de leads (`track-evento`, `painel-dados`, `save-lead-progress`);
  - checkout Pagar.me;
  - dashboards de clientes `/p/*`;
  - console de agências;
  - envio de CAPI (`meta-capi`, secret `META_ACCESS_TOKEN`, que **não** deve ser
    tocado).
- **Etapa mais arriscada: o gate de MFA e a mudança do `RoleRoute`** (Passo 4).
  Um erro tranca o Lucca fora de `/no/*` ou abre `/no/*` para o dot. Mitigação:
  MFA cadastrado e provado antes de ligar o gate; testes de papel para cada
  área; rollback do app pela Vercel.
- **Risco financeiro**: toda criação nasce `PAUSED` (C3). Nos testes em conta
  real, cada campanha criada é apagada no mesmo passo.
- **Risco aceito (C1 = a)**: o dot pode ativar gasto ou publicar. O servidor
  registra, mas não impede.

## Ordem de execução

### Passo 0 — Pré-requisitos do Lucca e provas de viabilidade

**0.1 · Meta (Lucca, no Business Manager da nó — portfólio `990413650211777`, a
confirmar):**

1. Em developers.facebook.com, ver o tipo do app `1590026522084626`. Se não for
   **Business** ou não aceitar os casos de uso abaixo, criar o app "nó hub" do
   tipo Business **dentro do portfólio da nó**.
2. Adicionar os casos de uso de anúncios (Marketing API), gerenciamento de Página
   e publicação no Instagram.
3. Em Configurações do negócio → Usuários do sistema: criar "nó-hub" (Admin).
4. Atribuir ativos ao "nó-hub": conta de anúncios (controle total), Página,
   Instagram e pixel `1753619075655271`.
5. Gerar token para o app, com validade **Nunca** e as permissões:
   `ads_management`, `ads_read`, `business_management`, `pages_show_list`,
   `pages_read_engagement`, `pages_manage_posts`, `read_insights`,
   `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`.
6. Colar o token **direto** em Supabase → Edge Functions → Secrets como
   `META_SYSTEM_USER_TOKEN`. Nunca em chat, arquivo ou commit.
7. Anotar os ids (não são segredo): conta de anúncios `act_…`, Page id, IG user
   id.

**0.2 · Google (Lucca):**

1. Criar o projeto Google Cloud "no-hub" e ativar: Google Analytics Data API,
   Google Search Console API e Google Ads API.
2. Tela de consentimento OAuth: tipo Externo, e **publicar em "In production"**
   (evita a expiração de 7 dias, X5).
3. Criar um cliente OAuth do tipo "Aplicativo da Web" com redirect
   `https://developers.google.com/oauthplayground`.
4. Criar uma **conta de administrador do Google Ads (MCC)** e vincular a conta de
   anúncios da nó. Em Admin → Central de API, gerar o **developer token** (nasce
   em Explorer Access).
5. No OAuth Playground (engrenagem → "Use your own OAuth credentials"), autorizar
   com a conta Google do Lucca os escopos
   `https://www.googleapis.com/auth/adwords`,
   `https://www.googleapis.com/auth/analytics.readonly` e
   `https://www.googleapis.com/auth/webmasters.readonly`, e trocar pelo refresh
   token.
6. Secrets: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
   `GOOGLE_OAUTH_REFRESH_TOKEN`, `GOOGLE_ADS_DEVELOPER_TOKEN`.
7. Ids (variáveis da função, não segredo):
   - `GOOGLE_ADS_CUSTOMER_ID` (nó);
   - `GOOGLE_ADS_LOGIN_CUSTOMER_ID` (MCC);
   - `GA4_PROPERTY_ID` (numérico, da propriedade de `G-1YEB89RVER`);
   - `GSC_SITE_URL` (`sc-domain:notechstack.com.br` ou prefixo de URL, conforme
     cadastrado).

**0.3 · Provas de viabilidade (Executor)**

Script descartável, rodado com os secrets. Nada é publicado. Tudo que for criado
em conta real nasce `PAUSED` e é apagado na mesma execução.

| # | Prova | Passa se |
|---|---|---|
| V1 | Graph `GET /me` e `GET /act_…/insights` (`last_7d`, nível campanha, `actions`) com o token de System User | 200. O action type de lead aparece e bate com a coluna "Leads" do Ads Manager. Registrar qual `action_type` é usado. |
| V2 | Criar campanha Meta `PAUSED` "[teste hub] apagar" e apagar | 200 nas duas chamadas. |
| V3 | Criar container de mídia IG **sem** publicar (expira sozinho) | Container criado, provando `instagram_content_publish`. |
| V4 | GA4 `runReport` dos últimos 7 dias com `advertiserAdCost`, `advertiserAdClicks`, `sessions`, `keyEvents` | 200. Custo > 0 se houve veiculação Google no período. |
| V5 | GSC `searchanalytics.query` dos últimos 28 dias | 200 com linhas. |
| V6 | Google Ads: GAQL de campanhas; `mutate` de orçamento + campanha Search `PAUSED` com `validateOnly=true`; depois de verdade, seguido de `remove` | 200 nos três. **Prova que o Explorer Access permite criar.** |
| V7 | Versão vigente da Graph API | Atualizar `GRAPH_API_VERSION` de `_shared/meta.ts` se `v21.0` estiver perto do fim de vida. Não mexer nas outras funções que usam `v21.0` (`meta-capi`, `pagarme-webhook-no`, `send-lead-email`). |

Resultado intermediário: tabela V1–V7 preenchida em `execution.md`, sem nenhum
valor de segredo.

### Passo 1 — Banco (migration nova via `supabase migration new`)

1. Revogar **todos** os privilégios de `anon` e `authenticated` em `ad_accounts`,
   `ad_accounts_public`, `ad_metrics_daily`, `social_metrics_daily`,
   `scheduled_posts` e `sync_logs`. **Não tocar em `clients`** (base do R1-01) nem
   nas views `thais_*` (já tratadas no R1-02).
2. `ad_accounts.access_token` passa a nullable.
3. Criar `marketing_actions`:
   - campos: `id`, `request_id` único, `actor_user_id`, `actor_role`, `kind`,
     `target`, `payload jsonb`, `status` (`executando`/`ok`/`erro`), `result jsonb`,
     `external_ids jsonb`, `error`, `created_at`, `finished_at`;
   - RLS ligada, **sem** policies para `anon`/`authenticated` (só service role).
4. Criar `marketing_cache` (`key` pk, `payload jsonb`, `expires_at`), com RLS
   ligada e só service role.
5. `create extension if not exists pg_cron`. Criar job a cada 5 min que faz
   `net.http_post` para `marketing-hub/internal/publish-due`, com header secreto
   lido do Vault (`MARKETING_CRON_SECRET`).
6. Bucket privado `marketing-media`; a função gera URLs assinadas para a Meta
   buscar a mídia.
7. Seed: o `clients` da nó (reusar a linha se existir; senão criar "nó tech
   stack") e as três linhas `ad_accounts` (`meta_ads`, `meta_page`,
   `meta_instagram`) com os ids do 0.1 e `access_token = null`.

Provas: pgTAP novo `supabase/tests/hub_marketing.test.sql`. Anon e authenticated
recebem `42501` em todas as tabelas do item 1 e nas novas. Service role lê e
escreve. O job do cron existe. `supabase db reset --local` passa.

### Passo 2 — Leitura: adaptadores + `marketing-hub`

1. `supabase/functions/_shared/marketing/`:
   - `meta.ts` reaproveita `metaFetch`;
   - `google-auth.ts` troca o refresh token por access token, com cache em memória
     por worker;
   - `ga4.ts`, `gsc.ts`, `google-ads.ts` (GAQL + mutate);
   - `leads.ts` (**contagem** agregada por dia/canal a partir de `leads` e
     `lead_eventos`, sem dados pessoais);
   - `normalize.ts`.
2. `supabase/functions/marketing-hub/index.ts`, com o padrão de auth do
   `project-status-transition` (`admin.auth.getUser(token)` + `app_metadata.role`)
   e CORS de `_shared/cors.ts`:
   - `NO_ADMIN` exige `aal2`; `MARKETING_AGENT` é aceito; qualquer outro papel
     recebe 403;
   - rotas de leitura: `GET /overview?periodo=`, `GET /campaigns?plataforma=`,
     `GET /campaigns/:id`, `GET /organic?periodo=`, `GET /search?periodo=`,
     `GET /posts?de=&ate=`, `GET /actions`;
   - cache em `marketing_cache` com TTL de 15 min (hoje/ontem) e 60 min (períodos
     fechados).
3. `config.toml`: `[functions.marketing-hub] verify_jwt = false`, porque a função
   valida o token ela mesma e a rota do cron não usa JWT. Registrar o motivo em
   comentário, como nos demais.

Provas: testes Deno dos parsers com fixtures reais anonimizadas dos V1–V6 (lead,
custo Google, GSC). Teste de autorização por papel: `NO_ADMIN aal1` → 403,
`NO_ADMIN aal2` → 200, `MARKETING_AGENT` → 200, `CLIENT`/`AGENCY_ADMIN` → 403.

### Passo 3 — Escrita

Toda escrita segue o mesmo contrato:

1. Recebe `request_id` gerado pelo formulário (idempotência contra duplo clique
   do dot).
2. Insere `marketing_actions` em `executando` **antes** de chamar a API.
3. Chama a API.
4. Atualiza para `ok` ou `erro`, com ids externos.

Rotas:

- **Meta**:
  - `POST /meta/campaigns`: campanha `PAUSED` + conjunto (orçamento diário ou
    total, datas, localização, idade, gênero, posicionamentos automáticos) +
    criativo (imagem via `adimages` ou vídeo via `advideos`, texto principal,
    título, link, CTA) + anúncio;
  - `PATCH /meta/{campaign|adset|ad}/:id` (orçamento, datas, nome);
  - `POST …/:id/status` (`ACTIVE`/`PAUSED`).
- **Google**:
  - `POST /google/campaigns`: orçamento + campanha Search `PAUSED` + critérios de
    local e idioma + grupo de anúncios + palavras-chave + RSA (15 títulos / 4
    descrições no máximo);
  - `PATCH /google/campaigns/:id` (orçamento);
  - `POST …/:id/status` (`ENABLED`/`PAUSED`).
- **Posts**:
  - `POST /posts` (insere em `scheduled_posts` como `scheduled`);
  - `DELETE /posts/:id` (cancela se ainda não saiu);
  - `POST /internal/publish-due` (só com o header do cron): publica os vencidos.
    IG imagem/carrossel = container → `media_publish`; reel = container →
    aguardar `status_code=FINISHED` → publicar; FB = `/{page}/feed`, `/photos` ou
    `/videos`.
  - Posts não publicados em 3 tentativas viram `failed` com o erro.
- **Mídia**: `POST /media` gera URL de upload assinada para o bucket.
- **Dot**: `POST /agent/create`, `POST /agent/disable` e `POST /agent/enable`
  (só `NO_ADMIN aal2`) via `auth.admin` (convite e `ban_duration`).

Provas: testes Deno com `fetch` mockado cobrindo o payload exato de cada rota,
idempotência (o mesmo `request_id` não cria duas vezes) e registro `erro`
quando a API falha. Em conta real: repetir V2 e V6 pela rota final (criar
`PAUSED` → conferir no painel → apagar).

### Passo 4 — Planner, papéis e MFA (app)

1. `RoleRoute` passa a aceitar `roles: Role[]` e `requireAal2?: boolean`.
   Rotas:
   - `/no/marketing/*` → `[NO_ADMIN, MARKETING_AGENT]`, declarada **antes** do
     bloco `/no/*`;
   - o resto de `/no/*` continua só `NO_ADMIN`, agora com `aal2`.
2. `LoginPage`:
   - `MARKETING_AGENT` → `/no/marketing`;
   - `NO_ADMIN` sem fator → tela de cadastro TOTP; com fator → desafio TOTP antes
     de seguir.
3. Hosted e `config.toml`: garantir TOTP habilitado (`[auth.mfa.totp]
   enroll_enabled/verify_enabled = true`).
4. `app/src/marketing/`: `MarketingLayout` (menu com as quatro telas + "Dot" só
   para `NO_ADMIN`), `OverviewPage`, `CampaignsPage`, `CampaignDetailPage`,
   `NewMetaCampaignPage`, `NewGoogleCampaignPage`, `CalendarPage`, `LogPage`,
   `AgentPage` e `marketing-service.ts` (via `supabase.functions.invoke`, como em
   `admin-dashboard-service.ts`).
5. Contrato de tela para agente (R7), tratado como **contrato estável**:
   - todo número também em `<table>` com cabeçalho;
   - botões e campos com rótulo em texto;
   - período na URL (`?periodo=7d|30d|mes-passado|AAAA-MM-DD..AAAA-MM-DD`);
   - tela de revisão antes de cada escrita, com resumo em texto e botão
     "Confirmar e executar";
   - resultado com id externo e link para a plataforma;
   - nada que dependa só de arrastar ou de hover.
6. Link "Marketing" no cabeçalho de `/no/projetos`.
7. Identidade v2 (tokens, Sora/JetBrains Mono, barra de quatro cores). Funciona a
   partir de 375px de largura.

Provas:

- Vitest DOM: cada tela nos estados carregando, vazio, erro e dados; tela de
  revisão; papéis.
- Playwright em 1440×900 e 375×812, com respostas da função mockadas:
  - `MARKETING_AGENT` chega em `/no/marketing`;
  - `MARKETING_AGENT` em `/no/projetos` → `/nao-autorizado`;
  - `NO_ADMIN aal1` → cadastro ou desafio de MFA.
- **As suítes E2E que entram em `/no/*` (`f2-09`, `f2-10`, `f3-11`, `r1-06`,
  `r1-07`) precisam cadastrar TOTP** para o admin de teste (gerando o código a
  partir do segredo) e seguir passando.
- `npm test -- --run`, `npm run lint`, `npx tsc -b`, `npm run build`,
  `npm run test:e2e`.

### Passo 5 — Conta do dot

1. Na página "Dot" (só `NO_ADMIN aal2`), o Lucca informa o e-mail do dot.
   `POST /agent/create` na `marketing-hub` cria o usuário no Auth com
   `app_metadata.role = MARKETING_AGENT` e envia o convite. A senha é definida
   pelo link do convite; nunca passa por arquivo, argumento de linha de comando
   ou chat. Se o fluxo `/acesso` (hoje de `CLIENT`) não servir sem mudar o
   contrato do `CLIENT`, fazer uma tela mínima de definir senha, ou parar e
   perguntar se isso exigir mexer no `/acesso`.
2. Provas (AC7):
   - a conta do dot recebe 403 ou `42501` ao ler dados de `/no/projetos`,
     `/no/saldos` e `/no/biblioteca` (tabelas via RLS e funções `NO_ADMIN`), e ao
     chamar `/agent/disable`;
   - banida, qualquer chamada falha.

### Passo 6 — Aposentar o legado de abril

1. `git mv` de `oauth-callback`, `refresh-tokens`, `sync-meta-ads` e
   `sync-meta-organic` para `supabase/functions-archive/meta-2026-04/`, com um
   README de uma linha (por que saiu, data, spec).
2. Remover as quatro entradas de `supabase/config.toml`.
3. Em produção, `supabase functions delete` das quatro, **só depois** do Passo 7
   estar verde.
4. Não remover tabelas, views `thais_*` nem `_shared/meta.ts`.

Provas: `list_edge_functions` sem as quatro; `meta-capi`, `track-evento` e
`painel-dados` seguem ACTIVE.

### Passo 7 — Produção

1. Aplicar a migration: medir antes e depois as contagens de `leads`,
   `lead_sessoes` e `lead_eventos` (iguais) e rodar os advisors de segurança.
2. Deploy de `marketing-hub`.
3. Publicar o app pelo fluxo atual (projeto Vercel `notechstack-app`).
4. O Lucca cadastra o MFA.
5. O Lucca cria a senha do dot e faz o login dele no navegador do dot.
6. Rodar os critérios de aceitação 1–11 da spec em produção, com as evidências
   abaixo.

### Passo 8 — Registro

1. `execution.md` com as evidências.
2. Atualizar `supabase/README.md`: a seção "Fase 1" vira histórico, e entra uma
   seção nova do hub de marketing (secrets por nome, nunca por valor).
3. No PC do Lucca, registrar no Bot-vault (nota "NoTechStack LP" e `conectores/`):
   - System User Meta, app Google OAuth, MCC e developer token;
   - conta do dot;
   - link para esta pasta de movimento.

## Provas obrigatórias

| Comportamento | Verificação | Evidência esperada |
|---|---|---|
| AC1 números batem | Planner × Ads Manager × Google Ads × GA4 × GSC no mesmo período e fuso | tabela lado a lado em `execution.md`; gasto Meta de dia fechado ao centavo |
| AC2 campanha Meta | Criar pelo planner → conferir no Ads Manager → ativar → pausar → apagar | ids + prints do Ads Manager |
| AC3 campanha Google | Criar Search pelo planner → conferir no Google Ads → apagar | ids + print |
| AC4 posts | Agendar IG imagem, reel e FB; cancelar um quarto | `external_post_id` + horário real vs agendado. **Conteúdo e OK do Lucca antes**, porque é publicação real. |
| AC5 dot lê | Dot, com conta própria, responde à pergunta-exemplo do intent | transcrição do dot + números do planner |
| AC6 dot escreve | Dot cria campanha Meta e Google e um post pelo planner; ativa a Meta depois de o Lucca autorizar no chat | linhas `marketing_actions` com `actor_role=MARKETING_AGENT` |
| AC7 menor privilégio | Chamadas da conta do dot às áreas proibidas; dot banido | 403/42501; 401/403 |
| AC8 registro | `select` em `marketing_actions` | uma linha por escrita, com payload e resultado |
| AC9 segredos e grants | grep no bundle e no repo pelos prefixos dos tokens; `role_table_grants`; advisors | zero ocorrências; zero grants; nenhum aviso novo |
| AC10 legado | `list_edge_functions` | as quatro ausentes; fonte em `functions-archive/` |
| AC11 MFA | Login do Lucca sem fator; sessão `aal1` na função | bloqueio no app; 403 |

## Regressões vizinhas a verificar

- Funil: `track-evento` grava, `painel-dados?v=funil&dias=7` responde 200 e as
  contagens de leads não mudam com a migration.
- `/p/*` (cliente), `/agencia` e `/acesso` seguem funcionando: `RoleRoute`
  mudou.
- `/no/projetos`, `/no/saldos`, `/no/cronograma`, `/no/biblioteca` e
  `/no/agencias` funcionam para o Lucca com `aal2`. Suítes E2E existentes verdes.
- `meta-capi` e o secret `META_ACCESS_TOKEN` intocados; eventos continuam
  chegando no Gerenciador de Eventos.
- Checkout (`roadmap-checkout`, `pagarme-webhook-no`) intocado.

## Rollback

| Parte | Como desfazer |
|---|---|
| App (planner, `RoleRoute`, MFA) | Rollback instantâneo para o deployment anterior na Vercel. Reverter o commit. |
| `marketing-hub` | `supabase functions delete marketing-hub` (nada depende dela). |
| Migration | SQL reverso em `supabase/rollback/<timestamp>_hub_marketing.down.sql`: remove o job do cron, `marketing_cache` e `marketing_actions` (exportar antes) e o bucket. Os grants revogados **não** voltam (eram o risco E4). `access_token NOT NULL` só volta se a tabela estiver sem tokens nulos. |
| Legado | Redeploy a partir de `functions-archive/` (a fonte está preservada). |
| Credenciais | Meta: revogar o token do System User em Configurações do negócio. Google: remover o acesso do app em myaccount.google.com → Segurança, e apagar o developer token. Apagar os secrets. |
| Dot | Botão "desligar dot", ou ban no Auth. |
| Teste em conta real | Toda campanha de teste é apagada no mesmo passo. Conferir no painel que não sobrou nenhuma "[teste hub]". |

## Condições de parada

O Executor para e volta ao Lucca se:

- V2, V3 ou V6 falhar por permissão ou nível de acesso (app Meta errado, Explorer
  sem mutate). Não pedir Basic Access nem trocar de app sem ok.
- O action type de lead (V1) não bater com o Ads Manager.
- O MFA não puder ser ligado no projeto hospedado, ou ligar o gate quebrar alguma
  suíte E2E sem conserto dentro do escopo.
- A migration exigir mexer em `clients`, nas policies do R1 ou em tabelas do
  funil.
- For preciso publicar post real, ativar campanha com verba ou criar campanha
  fora do prefixo "[teste hub]". Exige OK do Lucca a cada vez.
- Algum passo exigir colocar valor de segredo em arquivo, commit, log ou chat.
- A Meta ou o Google recusarem algo por política (categoria especial, conteúdo
  de saúde).

## Alternativas rejeitadas

| Alternativa | Por quê |
|---|---|
| Servidor MCP / OAuth 2.1 para agentes | Rejeitado pelo Lucca; o dot opera o planner pelo navegador. No Pro, MCP próprio seria só leitura. |
| Fila de aprovação para o dot (C1 = b) | O Lucca escolheu o mesmo poder (C1 = a). |
| Warehouse com sync diário (desenho de abril) | Leitura ao vivo basta. `sync-meta-ads` ainda contava só purchase. |
| Windsor.ai + ferramentas de terceiros | Sem planner único, sem criação no Google, dados em terceiros. |
| Agendamento nativo do IG/FB | Fila própria dá calendário e cancelamento iguais para IG e FB, e é a mesma para o dot. |
| Service account Google | O Google Ads exige OAuth de usuário de qualquer forma; um token só cobre as três APIs. |
| Aplicar `aal2` em todas as policies RLS de `NO_ADMIN` | Muda dezenas de policies do R1 em produção, fora do escopo. Aqui o gate fica no app e na `marketing-hub`. Ver risco residual. |

**Risco residual registrado**: as policies RLS de tabelas `NO_ADMIN` aceitam
sessão `aal1`. Quem tivesse a senha do Lucca e contornasse o app chamando a API
direto leria dados de `/no/*`. O MFA no login reduz, mas não fecha isso no banco.
Candidato a movimento próprio.

## Handoff para o Executor

- **Leia primeiro**: `intent.md`, depois `spec.md`, depois este `plan.md`.
- **Objetivo autorizado**: construir e pôr em produção o planner `/no/marketing`,
  a `marketing-hub`, a conta do dot e o MFA do Lucca, e aposentar o legado Meta de
  abril, conforme a spec rev. 3.1.
- **Escopo autorizado**:
  - `supabase/migrations/` (migration nova), `supabase/tests/`,
    `supabase/rollback/`;
  - `supabase/functions/_shared/marketing/`, `supabase/functions/marketing-hub/`;
  - `supabase/functions-archive/`, `supabase/config.toml` (entradas das funções
    tocadas e MFA), `supabase/README.md`;
  - `app/src/marketing/`, `app/src/auth/RoleRoute.tsx`, `app/src/App.tsx`,
    `app/src/pages/LoginPage.tsx`, o link no cabeçalho de `/no/projetos`;
  - `app/e2e/` (novos testes + ajuste de MFA nas fixtures), testes Vitest;
  - `_shared/meta.ts` (só `GRAPH_API_VERSION`, se V7 pedir).
- **Escopo proibido**:
  - `meta-capi`, `track-evento`, `painel-dados`, `save-lead-progress`,
    `roadmap-checkout`, `pagarme-webhook-no`, `send-lead-email` e os secrets deles;
  - tracking do site (GTM, pixel, páginas públicas);
  - tabela `clients` e policies do R1–F4;
  - dados de produção fora das tabelas deste movimento;
  - `brand/`.
- **Decisões já tomadas (não reabrir sem nova evidência)**:
  - planner único, sem MCP;
  - dot com conta própria e o mesmo poder do Lucca no marketing (C1 = a);
  - MFA na conta do Lucca (C2);
  - criação sempre `PAUSED` (C3);
  - aposentar o legado (C4);
  - leitura ao vivo com cache;
  - fila própria de posts;
  - um token Google para três APIs.
- **Deve parar e perguntar se**: qualquer item de "Condições de parada".
- **Deve entregar**:
  - `execution.md` com a tabela V1–V7, os comandos de prova e seus resultados;
  - as evidências AC1–AC11, com prints das plataformas nos AC2–AC4;
  - diff por passo, em commits separados;
  - confirmação de que nenhum segredo entrou no repo.
- **Skills obrigatórias**:
  - `executar-grande-movimento`;
  - `dataviz`, se disponível, para os gráficos da Visão geral.
  
  **Não usar** `no-hub-generator` nem `no-brand-pitch`: carregam a identidade v1,
  arquivada.

## Decisão do gate

Pendente: aprovação expressa do Lucca.
