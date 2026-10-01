---
movement_id: hub-marketing-agentes
plan: ./plan.md
status: needs_verification
started: 2026-09-30T21:45:00-03:00
updated: 2026-10-01T19:25:00-03:00
executor: Codex (coordenador atual, worktree suspicious-hypatia-6f295c)
branch: claude/windsor-ai-nó-integration-y64r9w (squash na main em 5f0d1aee, PR #49); continuação em claude/hub-marketing-continuacao
handoff: ./HANDOFF.md
---

# Execution: marketing da nó num lugar só, operável por agentes

## Retomada coordenada pelo Codex — 01/10/2026

O Lucca pediu neste chat para seguir `.tasks/acompanhamento.md`, retomar os agentes e transferir a gerência. O painel é a fonte atual de estados e gates. As seções abaixo são o registro histórico dos passos anteriores, incluindo pendências que já foram superadas; não representam um novo pedido de autorização.

A/B/C retomados nos próprios worktrees, preservando commits e alterações herdados. D entra na próxima vaga. Critérios locais serão revisitados após integração e por verificador independente (`tlc-implement`, perfil light); produção e contas continuam com provas separadas.

Baseline de produção consultado somente em leitura: 27 leads, 947 sessões, 898 eventos; exatamente 10 leads no intervalo do backfill, zero ações e zero contas dot. Função marketing-hub v1; funções protegidas meta-capi, track-evento e painel-dados v17; quatro funções legadas v18, todas ACTIVE.

Diagnóstico C, navegador somente leitura: projeto Google no-hub em Testando, zero usuários de teste; Publicar app bloqueado por branding incompleto. Campos Política de Privacidade e Termos vazios. Nenhuma conta/configuração foi alterada.

## Publicação da continuação — Codex, 01/10/2026 22:16–22:25 UTC

- PR [#50](https://github.com/luccavgiani-spec/notechstack-lp/pull/50) mesclado; main `b11e2587111ec86661a04f22e539380cb179423d`. App Vercel `dpl_Hz4Jc69Sxbnj5Qw7biJybHYpXSDt` READY com alias app.notechstack.com.br.
- Ambas migrations aplicadas antes da função marketing-hub v2 e do merge, conforme autorização permanente. Contagens antes/depois idênticas: leads 27, sessões 956, eventos 898. Classificações: 10 testes. RLS ligada, sem policies, zero grants de tabela/coluna para anon/authenticated; RPCs Google recusam execução por esses papéis.
- Advisors: nenhum WARN novo (pg_net público 1, security definer anon 2/authenticated 32, proteção de senha 1). INFO RLS sem policy 12→13 esperado na tabela de acesso exclusivo da service role ([referência](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)).
- Provas locais: 194 Vitest, dois SQL PGlite, lint, tsc e build PASS; relatório independente em `.checks/hub-marketing-continuacao.verified.md`.
- Planner real 31/08..29/09: gasto R$172,64 identificado como só Meta; 0 leads válidos, 10 testes excluídos e CPL não calculável. Meta: 20.084 impressões, 16.601 alcance, 1.499 cliques, 1.500 cliques no link, 1.060 LPV, custo/LPV R$0,16; moeda BRL, fuso America/Sao_Paulo, API v25.0. Comparação independente no Ads Manager segue pendente.
- Conexões real: 11 capacidades, Meta anúncios/IG insights/FB insights OK; escrita/publicação NÃO VERIFICADO; Google invalid_grant e criação bloqueada. Lista não vazia de permissões Meta renderiza sem erro. Botão Conectar Google disponível ao admin; não foi acionado, pois G2b e consentimento são do Lucca.
- Facebook voltou a mostrar posts. Métricas da Página: 13 seguidores, 1.246 visualizações, 65 interações; comentários/interações por post ficam sem permissão.

### Evidência Graph T1:5 e correção final

Logs da v2 às 22:19:41.577Z, gerados pela leitura real do período acima, registraram recusa Graph #10 nas variantes `completa`, `sem_comentarios` e `sem_reacoes`; a variante `sem_engajamento` retornou posts. Campos comuns: `id,message,created_time,permalink_url,shares`. Somente `reactions.summary(true).limit(0)` e somente `comments.summary(true).limit(0)` também provocaram a recusa, portanto não era apenas comments.

A evidência foi obtida por consulta read-only de logs, com remoção de padrões de segredo na própria seleção. Não houve exibição de tokens. Decisão já prevista em T1-Unresolved4: remover ambos os campos da consulta, sem pedir nova permissão. Commit `86bd2c2a` faz essa remoção e mantém a limitação histórica explícita (`sem_permissao`) no contrato; não esconde falha nova da consulta básica. Prova local de regressão exige exatamente a lista comum, e testa separadamente erro de permissão real da consulta básica. Revisão independente final antes da v3.

### Prova final v3 — 01/10/2026, 22:26–22:29 UTC

Função marketing-hub v3 ACTIVE. Leitura pelo botão sem cache com período 30d (01/09..30/09) retornou Facebook com posts, 13 seguidores, 1.251 visualizações e 71 interações; métricas omitidas dos posts seguem sem permissão. Query de logs exclusiva da função/v3 nessa janela: 22 linhas, zero ocorrências de pages_read_user_content, três registros explícitos da limitação histórica. Assim, T1:4/5 têm evidência real de consulta corrigida, sem conceder novas permissões. Google continua invalid_grant, portanto T1:1/2/13 não se encerram.

Período personalizado 22/09..23/09 confirmado pelo título/URL e gasto R$49,98; navegação preservou período entre Visão geral, Campanhas e Conexões. Nenhum lead foi reclassificado manualmente e nenhuma escrita de campanha/post foi executada. Probes sem autenticação continuam registrados acima.

PR complementar [#51](https://github.com/luccavgiani-spec/notechstack-lp/pull/51) contém a correção Facebook e evidências finais. Checklist e relatórios independentes preservam os gates; status do movimento continua needs_verification. Pesquisa: cinco critérios PASS, dois parcialmente verificados; pendência factual identificada em cinco marcas no apêndice. Próxima ação humana: G2b + consentimento Google, depois G3, G4/G5, G7 e G8, na ordem do plano.

## Estado em 01/10/2026, 20:30 UTC (fim da sessão do primeiro Executor)

Status `needs_verification`: tudo está em produção, mas faltam provas obrigatórias
(V1–V6 completas, AC1–AC8 e AC10 em produção) e 3 bloqueios descobertos no uso real.
O próximo Executor começa por [HANDOFF.md](./HANDOFF.md).

| Item | Estado verificado (só leitura, 01/10 ~20:30 UTC) |
|---|---|
| App | publicado (merge do PR #49, `5f0d1aee`); MFA ligado; o TOTP do Lucca está verificado (1 fator) |
| `marketing-hub` | ACTIVE v1; o cron chama a cada 5 min e recebe **HTTP 200** |
| Leitura Meta Ads | **funciona**: a revisão do Lucca + dot leu a campanha "TRAF - 20d - Agencias" (R$172,64; 20.084 impressões; 1.499 cliques, de 31/08 a 29/09) |
| Leitura Google (GA4 e Search Console; Google Ads provável) | **falha** com `OAuth 401 unauthorized_client` → V4, V5 e V6 não passaram |
| Orgânico Facebook | **parcial**: erro de permissão (`pages_read_user_content` / Page Public Content Access) em parte da consulta |
| Conta do dot | **não existe** (0 usuários `MARKETING_AGENT`); a revisão usou a sessão admin do Lucca |
| Escritas | **nenhuma** (0 linhas em `marketing_actions`; 0 em `scheduled_posts`) → AC2, AC3, AC4, AC6 e AC8 pendentes |
| Legado de abril | as 4 funções seguem **ACTIVE** em produção → AC10 pendente |
| Funil | 10 dos registros são testes (zero leads reais), o que distorce o CPL. Isso é a melhoria P0-1 |

Documento de melhorias do Lucca + dot: [melhorias-2026-10-01.md](./melhorias-2026-10-01.md)
(o original `.docx` está ao lado). É **escopo novo**: entra como movimento próprio
depois de fechar as pendências deste.

## Produção — 01/10/2026 (Passo 7, autorizado pelo Lucca no chat)

Autorização: "Tudo, nessa ordem" (migrations → Vault → função → PR/merge do app →
MFA do Lucca → provas pelo planner). E-mail do dot: `notechstack+dot@gmail.com`.
As provas V1–V6 passaram a rodar **pelo hub depois do deploy**, porque o Lucca não
quis rodar o script local de novo (desvio de ordem registrado aqui).

| Etapa | Resultado | Evidência |
|---|---|---|
| Passo 0 (Lucca) | secrets no Supabase. Ids: `act_1415926037237997`, Página `1132533626610077`, IG `17841441508079164`, Ads `930-207-4409`, MCC com 10 dígitos, GA4 `531794428`, GSC `https://www.notechstack.com.br/` | ids lidos nas configurações do portfólio e no GA4 (só leitura); `no-hub` com acesso total aos 3 ativos Meta |
| Funil antes | leads 27, lead_sessoes 699, lead_eventos 877 | `execute_sql` às 00:12 UTC |
| Migration `hub_marketing` | aplicada | `apply_migration` ok |
| Migration `hub_marketing_seed_ativos` (repo `20261001000937`) | aplicada; 3 ativos da nó | `ad_accounts` com os 3 ids |
| Funil depois | **27 / 699 / 877 (igual)** | mesma consulta |
| Grants | 0 em tabela e 0 por coluna para anon/authenticated | `role_table_grants`, `column_privileges` |
| Cron / Vault / bucket | `marketing-publish-due */5` ativo; `MARKETING_CRON_SECRET` no Vault; bucket privado | `cron.job`, `vault.secrets`, `storage.buckets` |
| Advisors de segurança | **nenhum WARN novo**; INFO "RLS sem policy" de 10 → 12 (`marketing_actions`, `marketing_cache`, só service role, intencional) | `get_advisors` antes e depois |
| Deploy `marketing-hub` | ACTIVE v1, `verify_jwt=false` | sem sessão 401; token inválido 401; cron sem/errado 401; preflight 204 |
| `marketing_hub_url` no Vault | criado (migration só de produção `hub_marketing_url_vault`) | — |
| PR do app | [luccavgiani-spec/notechstack-lp#49](https://github.com/luccavgiani-spec/notechstack-lp/pull/49) | — |

## Resultado

**Código dos Passos 1–4 e 6 implementado e provado no ambiente local**:
- migration e pgTAP;
- `marketing-hub` com os adaptadores Meta, GA4, Search Console, Google Ads e leads;
- planner `/no/marketing`;
- `RoleRoute` por papéis;
- MFA do NO_ADMIN;
- conta do dot;
- arquivamento do legado.

Nada foi aplicado nem publicado em produção.

**Bloqueado** em duas coisas que dependem do Lucca:

1. **Passo 0 (0.1 e 0.2).** Criar o System User e o MCC, gerar tokens, colá-los nos
   secrets e conceder OAuth são ações que o Executor não faz, nem com autorização
   (plan.md, nota técnica 1). Sem esses tokens e ids, as provas V1–V6 não rodam, o seed
   de `ad_accounts` não pode ser escrito (seria inventar id) e as fixtures reais não existem.
2. **Passo 7 (produção).** Migration no Supabase, deploy da função e publicação do app
   são gates separados, que o Lucca precisa autorizar.

## Repositórios e arquivos alterados

Repositório único: `notechstack-lp` (`luccavgiani-spec/notechstack-lp`). Nada fora dele.

| Área | Arquivos | Resultado |
|---|---|---|
| Banco | `supabase/migrations/20260930215739_hub_marketing.sql`, `supabase/rollback/20260930215739_hub_marketing.down.sql` | novo |
| Testes de banco | `supabase/tests/hub_marketing.test.sql` (novo); `supabase/tests/r1_02_isolate_legacy_risks.test.sql` (C6 passa a provar o 42501) | ok |
| Função | `supabase/functions/marketing-hub/{index,handler,store}.ts` | novo |
| Adaptadores | `supabase/functions/_shared/marketing/{normalize,meta,google-auth,ga4,gsc,google-ads,leads,validacao}.ts`; `_shared/meta.ts` (só `GRAPH_API_VERSION` → v25.0) | novo / 1 linha |
| Integração local | `supabase/tests/hub_marketing_edge.mjs` (runtime Deno + Auth local); `supabase/tests/hub_marketing_viabilidade.mjs` (V1–V7, rodado pelo Lucca) | novo |
| Config | `supabase/config.toml`: `[functions.marketing-hub]`, `[auth.mfa.totp]`, saída das 4 funções de abril | ok |
| Legado | `supabase/functions-archive/meta-2026-04/` (4 funções + README) via `git mv` | ok |
| App | `app/src/marketing/*` (planner), `app/src/auth/RoleRoute.tsx`, `app/src/auth/aal.ts`, `app/src/pages/LoginPage.tsx`, `app/src/App.tsx`, link "Marketing" em `AdminDashboardPages.tsx`, `app/tsconfig.app.json` (`allowImportingTsExtensions`) | ok |
| Testes app | `app/src/marketingAdapters.test.ts`, `marketingHub.test.ts`, `marketingPlanner.test.tsx`, `App.test.tsx` (contrato MFA); `app/e2e/hub-marketing.spec.ts`, `app/e2e/mfa.ts`, fixtures/logins de `f2-09`, `f2-10`, `f3-11`, `r1-06`, `r1-07` | ok |
| Docs | `supabase/README.md`, `plan.md` (notas técnicas), este arquivo, `evidencias/*.png` | ok |

Commits na branch (sem push):
- `c2ab183d` — Passo 1;
- `91e9496b` — Passos 2 e 3;
- `8b9acd2c` — Passo 4;
- `ed72550b` — Passo 6;
- o commit de registro deste arquivo.

## Etapas executadas

| Etapa do plano | Estado | Evidência |
|---|---|---|
| 0.1 / 0.2 contas e credenciais | **não executada (Lucca)** | nota técnica 1 do plan.md |
| 0.3 provas V1–V7 | V7 ok; V1–V6 **pendentes** | tabela abaixo; script pronto |
| 1 Banco | feito (local) | pgTAP 46/46; `db reset --local` ok; rollback testado em transação |
| 1.7 Seed | parcial: `clients.no-tech-stack` na migration; `ad_accounts` **pendente dos ids** | nota técnica 9 |
| 2 Leitura | feito (local) | Vitest 35 + 27; edge 33/33 |
| 3 Escrita | feito (local, APIs mockadas) | payload exato por rota, idempotência, registro de erro |
| 4 Planner, papéis e MFA | feito (local) | Vitest 18 + 21; Playwright 8/8 nos dois viewports |
| 5 Conta do dot | código feito e provado local (E23–E30); **criação real pendente (produção)** | edge script |
| 6 Legado | arquivado no repo; **delete em produção pendente** (só depois do 7) | `ed72550b` |
| 7 Produção | **não executado** (gate) | — |
| 8 Registro | README, plan e execution feitos; **Bot-vault pendente** (fazer no PC do Lucca) | — |

## Provas de viabilidade (Passo 0.3)

| # | Prova | Resultado |
|---|---|---|
| V1 | Graph `/me` + insights `last_7d` + tipo de lead | **pendente** (sem token). O script imprime a contagem por `lead`, `offsite_conversion.fb_pixel_lead` e `onsite_conversion.lead_grouped`, para bater com a coluna "Leads" |
| V2 | campanha Meta `PAUSED` "[teste hub] apagar" + DELETE | **pendente** (`--executar-escritas`) |
| V3 | container IG sem publicar | **pendente** (precisa também de `V3_IMAGE_URL`, um JPEG público da nó) |
| V4 | GA4 `runReport` com `advertiserAdCost` | **pendente** |
| V5 | GSC `searchanalytics.query` | **pendente** |
| V6 | GAQL + `validateOnly` + criar `PAUSED` e remover | **pendente**. `GOOGLE_ADS_CREATE_ENABLED` fica fora até passar |
| V7 | versão da Graph API | **ok**: Marketing API v21.0 expirou em 09/09/2025 ([changelog de versões](https://developers.facebook.com/docs/graph-api/changelog/versions)); `_shared/meta.ts` → `v25.0`. Google Ads REST em `v25` (jul/2026, [sunset](https://developers.google.com/google-ads/api/docs/sunset-dates)) |

## Verificações

| Prova exigida | Comando ou procedimento | Resultado | Evidência |
|---|---|---|---|
| Migration aplica do zero | `supabase db reset --local` | ok | saída do CLI |
| pgTAP do movimento | `supabase test db` | `hub_marketing.test.sql` 46/46; todos os `*.test.sql` ok; 408 testes | `agency_console.sql` sai como "No plan" (usa `RAISE NOTICE`, não pgTAP), igual antes |
| Rollback | `.down.sql` dentro de `begin … rollback` | tabelas e job somem; `access_token` volta a NOT NULL | saída do psql |
| Parsers e payloads | `npx vitest run src/marketingAdapters.test.ts` | 35/35 | fixtures no formato documentado (reais pendentes) |
| Papéis, idempotência, publicador | `npx vitest run src/marketingHub.test.ts` | 27/27 | — |
| Runtime Deno real + Auth/TOTP real | `supabase functions serve marketing-hub` + `node supabase/tests/hub_marketing_edge.mjs` | **33/33** | E1–E30 abaixo |
| Telas (estados, revisão, papéis) | `npx vitest run src/marketingPlanner.test.tsx` e `src/App.test.tsx` | 21/21 e 18/18 | — |
| Suíte Vitest completa | `npm test -- --run` | 263 ok, 2 falhas preexistentes | `pipelineExamples` lê `../gazeta_bragantina` e `home-no-prototipo/`, ausentes neste worktree |
| Lint / tipos / build | `npm run lint`, `npx tsc -b`, `npm run build` | limpos; build ok | aviso de chunk > 500 kB é do `index` já existente |
| E2E do planner | `npx playwright test e2e/hub-marketing.spec.ts` (1440×900 e 375×812) | 8/8 | `evidencias/planner-visao-geral-*.png`, `planner-revisao-meta-*.png`, `mfa-cadastro-*.png`; sem rolagem lateral nos dois |
| E2E que entram em `/no/*` com TOTP | `npx playwright test` | `r1-06` e `f3-11` ok nos dois viewports | admin passa pelo TOTP gerado do segredo |
| E2E preexistentes | mesmas suítes no commit base `4c053e61` (worktree temporário) | `r1-05`, `f2-09` (parte CLIENT), `f2-10` falham **igual** na base; `r1-07` precisa de `../gazeta_bragantina` | ver "Regressões" |
| Segredos no bundle | grep por `EAA…`, `ya29.`, `GOCSPX-`, `1//0…`, `sb_secret_` em `app/dist` | nenhum segredo; o único acerto é o `supabase-js` comparando o prefixo `sb_secret_`; os SVGs da Gazeta têm base64 que parece `EAA` | — |

**Integração local (`hub_marketing_edge.mjs`), 33 verificações:**
- sem sessão → 401; NO_ADMIN `aal1` → 403 `MFA_REQUIRED`;
- TOTP cadastrado e verificado → sessão `aal2` → 200; o dot → 200; CLIENT → 403;
- o dot → 403 em `/agent` e não se desliga;
- o dot vê lista vazia em `list_admin_projects`, `list_archive_assets` e `leads`, e recebe 403 em `list_admin_saldos`;
- o dot recebe 403/42501 direto em `marketing_actions`, `scheduled_posts` e `ad_accounts`;
- post agendado, idempotente, registrado com `MARKETING_AGENT` e cancelado;
- URL de upload assinada;
- `publish-due` recusa o segredo errado e aceita o do Vault;
- **pg_cron → pg_net → função respondeu 200**;
- convite do dot com o papel certo e o link fora do registro;
- desligar → token antigo 401 e novo login recusado; desligar recusa conta que não é do dot; religar volta a operar.

### Critérios de aceitação da spec

| AC | Estado |
|---|---|
| AC1 números batem | **pendente** (precisa das credenciais e de produção; comparar ao centavo com o Ads Manager) |
| AC2 campanha Meta | **pendente** (payload provado com mock; falta conta real) |
| AC3 campanha Google | **pendente** (atrás da flag até V6) |
| AC4 posts | **pendente** (publicação real exige conteúdo e OK do Lucca a cada vez) |
| AC5 dot lê | **pendente** (conta do dot em produção) |
| AC6 dot escreve | **pendente** (idem; o fluxo do dot pela tela foi provado no E2E com a função mockada) |
| AC7 menor privilégio | **provado local**, com a nuance da nota técnica 12 (200 vazio onde a RLS filtra). Falta repetir em produção |
| AC8 registro | **provado local** (uma linha por escrita, com papel, payload e resultado). Falta repetir em produção |
| AC9 segredos e grants | **local ok** (zero grants anon/authenticated, bundle limpo). Advisors de produção pendentes |
| AC10 legado | fonte arquivada; **delete em produção pendente** |
| AC11 MFA | **provado local** (app bloqueia `aal1`; função 403). Falta repetir em produção |

## Regressões vizinhas

- **Funil**: `track-evento`, `painel-dados`, `save-lead-progress` e `meta-capi` não foram tocados (`git diff 4c053e61 --stat` não os lista). A contagem de `leads`, `lead_sessoes` e `lead_eventos` antes e depois da migration é prova de produção (Passo 7.1), ainda pendente.
- **`/p/*`, `/agencia`, `/acesso`**: `App.test.tsx` 18/18 (CLIENT e AGENCY_ADMIN inalterados); `public-routes` ok.
- **`/no/*` com `aal2`**: `r1-06` e `f3-11` ok nos dois viewports, com login por TOTP.
- **Falhas preexistentes, não causadas por este movimento** (reproduzidas no commit base):
  - `r1-05` procura um heading que o redesign do cliente virou `strong`;
  - `f2-09`, na parte CLIENT, conta 2 "Atual";
  - `f2-10` não acha "Texto hero".
- **Checkout** (`roadmap-checkout`, `pagarme-webhook-no`) intocado.

## Desvios do plano

Todos técnicos, com o motivo registrado em `plan.md` → "Notas técnicas da execução" (1–14).
Resumo:
- Passo 0 com o Lucca e ordem invertida;
- testes pelo Vitest mais integração no runtime Deno;
- fixtures reais pendentes;
- Google Ads da Visão geral via GAQL, com o GA4 como conferência;
- Graph v25.0;
- conjunto e anúncio `ACTIVE` dentro de campanha `PAUSED`;
- colunas novas em `scheduled_posts`;
- segredo do cron conferido dentro do banco;
- seed Meta adiado;
- convite por link na tela;
- `auth/aal.ts`;
- nuance do AC7;
- rollback do bucket pela Storage API;
- E2E preexistentes.

## Alterações preexistentes preservadas

- O checkout principal (`C:/Users/lucca/projetos/notechstack`, branch `codex/site-legacy-slash-redirects`) e os worktrees do Codex não foram tocados.
- O `.env.local` do app não foi lido. O Vite local recebeu URL e anon key **públicas** do Supabase local, por variável de ambiente vinda de `supabase status`.
- A stack Supabase local (compartilhada entre os checkouts) estava parada na migration `20260916015006`, sem sessão ativa. Foi resetada com todas as migrations desta branch. As contas criadas pelos testes foram apagadas.
- O worktree temporário do commit base foi removido.

## Pendências e condições de parada

1. **Passo 0 — Lucca.** Seguir 0.1 e 0.2 do plan.md: tokens direto em Supabase → Edge Functions → Secrets, com os nomes da tabela do `supabase/README.md`. Mandar no chat só os ids, que não são segredo: `act_…`, id da Página, id do IG, customer IDs, `GA4_PROPERTY_ID` e `GSC_SITE_URL`.
2. **V1–V6.** O Lucca roda `node supabase/tests/hub_marketing_viabilidade.mjs` com as variáveis só no terminal. Depois roda de novo com `--executar-escritas` (V2 e V6) e com `--fixtures <pasta>`. Vale a condição de parada do plano: se V2, V3 ou V6 falhar por permissão, ou se o tipo de lead da V1 não bater com o Ads Manager, o movimento volta ao Lucca.
3. **Com os ids:** migration de seed de `ad_accounts` e troca das fixtures pelos dados reais anonimizados.
4. **E-mail da conta do dot** (aberto na spec): o Lucca decide a caixa ou o alias.
5. **Bot-vault**: registrar System User, app Google OAuth, MCC, developer token, conta do dot e o link desta pasta, no PC do Lucca.

## Operações externas não executadas

- `git push` da branch e PR.
- Produção:
  - `apply_migration` de `20260930215739_hub_marketing` (com contagem de `leads`, `lead_sessoes` e `lead_eventos` antes e depois, mais os advisors);
  - `vault.create_secret(<url da função>, 'marketing_hub_url')`;
  - deploy da `marketing-hub`;
  - `GOOGLE_ADS_CREATE_ENABLED=true` depois da V6;
  - publicação do app na Vercel;
  - cadastro do MFA do Lucca;
  - criação da conta do dot;
  - `supabase functions delete` das 4 funções de abril (só depois do 7 verde).
- Qualquer publicação de post real, ativação de campanha ou campanha fora de "[teste hub]", que exigem OK do Lucca a cada vez.

## Próximo gate

1. O Lucca faz o Passo 0 e roda as provas V1–V6.
2. Com V1–V6 verdes e os ids no chat: seed, fixtures reais e **autorização explícita do Lucca para o Passo 7**, que exige migration, deploy e publicação em produção.
3. Depois: AC1–AC11 em produção, delete do legado e registro no Bot-vault.


## Prova da regressão de datas — T2 20

Causa no código anterior: `aplicar()` retornava sem mensagem quando input date produzia string vazia por data incompleta; links do menu descartavam `periodo`; campos De/Até liam URL apenas na montagem e ficavam desatualizados ao voltar/avançar.

O coordenador extraiu os arquivos do commit `6aded586` (testes presentes, correção ausente) em `%TEMP%/codex-hub-datas-regressao/app` e executou `vitest run src/marketingPlanner.test.tsx -t "reproduz a falha de 30/09"`: dois testes falharam, por ausência de role alert e por URL perder `?periodo=2026-09-22..2026-09-23`. No conjunto integrado, ambos passaram. A prova antes/depois não usa contas, .env ou alterações de produção.
