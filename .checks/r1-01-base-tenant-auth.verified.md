# PASS — R1-01 · Base de tenant, auth e RLS — Verification

**Verdict**: PASS
**Profile**: light
**Diff range**: `300fa88fdd7526d1ca0925fae377144371e0e544..62752c81e402835c2ece14d4312d691c22c1b427`
**Fix range**: `b50ca0740e7da9cb93af99a776b61dc62b9cb165..62752c81e402835c2ece14d4312d691c22c1b427`
**HEAD verificado**: `62752c81e402835c2ece14d4312d691c22c1b427`
**Round**: 2 - scoped
**Verifier**: subagente independente (autor != verificador)
**Resultado agregado**: 15/15 checks provados; o gap de C11 da rodada 1 foi fechado.

## Escopo da rodada 2

O fix altera somente seis arquivos do app: `App.test.tsx`, `App.tsx`, `ClientProjectsPage.tsx`, `LoginPage.tsx`, `PlaceholderPage.tsx` e `project-service.ts`. Não alcança a migration, a suíte pgTAP, `app/package.json` nem `supabase/config.toml`.

- C11 foi reavaliado diretamente contra o fix e suas assertions foram atualizadas para o HEAD.
- C12 e C13 foram reavaliados diretamente porque `LoginPage.tsx`, `App.tsx` e o arquivo compartilhado de testes mudaram.
- C14 foi reavaliado diretamente executando todos os gates no novo HEAD.
- Os veredictos de assertions de C1–C10 e C15 foram carregados da rodada 1 em `b50ca0740e7da9cb93af99a776b61dc62b9cb165`, pois o fix não toca SQL, migration ou pgTAP. Seus 75 proofs foram reexecutados integralmente no novo HEAD, como exige `verify.md`.

## Binding sources

A etapa 1 de comparação normativa continua omitida porque o protocolo `verify.md` a restringe ao perfil `ui`. Para reavaliar C11, as fontes que determinam a rota/lista foram abertas novamente no HEAD; as demais leituras são carregadas da rodada 1.

| Source | Estado nesta rodada | Contradiction / uncovered |
|---|---|---|
| `.tasks/r1-01-base-tenant-auth.md` | reaberta integralmente e verificada em `62752c81` | comparação normativa omitida pelo perfil; Critério 11 + `Unresolved 2` exigem destino direto com um projeto e lista com mais de um |
| `.design/no-sistema-operacional.md` | reaberta integralmente e verificada em `62752c81` | comparação normativa omitida pelo perfil; mantém login único, CLIENT limitado aos próprios projetos e NO_ADMIN global |
| `fluxos_ref/plan_master.md` | trechos relevantes a login/autorização reabertos em `62752c81`; abertura integral carregada de `b50ca074` | comparação normativa omitida pelo perfil |
| `supabase/migrations/20260423195849_meta_integration_core.sql` | carregada de `b50ca074` | não tocada pelo fix |
| `supabase/migrations/20260814190000_rastreio_jornada.sql` | carregada de `b50ca074` | não tocada pelo fix |
| `C:/Users/lucca/projetos/roteador/roteador-consultadecasa/src/pages/AdminGate.tsx` | carregada de `b50ca074` | não tocada pelo fix |
| `C:/Users/lucca/projetos/roteador/roteador-consultadecasa/src/styles/prototype.css` | carregada de `b50ca074` | não tocada pelo fix |

## Omissões determinadas pelo perfil

| Etapa | Estado | Motivo |
|---|---|---|
| 1 — checklist contra fontes binding, inclusive composição visual | OMITIDA | roda somente em `ui` |
| Recomputar o join de `Coverage` | OMITIDA | roda somente em `standard` e `ui` |
| Veredictos de `Test policy` | OMITIDA | roda somente em `standard` e `ui`; a checklist não contém seção `## Test policy` |
| 4 — fault injection | OMITIDA | roda somente em `standard` e `ui` |

## Checks

Os 75 testes pgTAP foram executados duas vezes no HEAD: pela CLI em uma única invocação (75/75) e por replay local da mesma transação, que imprimiu individualmente `ok 1` a `ok 75` e terminou em `ROLLBACK`. O Vitest foi executado uma vez com reporter verbose e imprimiu os oito casos individualmente.

| Check | Claim | Proof no HEAD | Assertion / proveniência | Result |
|---|---|---|---|---|
| C1 | CLIENT lê somente o tenant A nas cinco tabelas | pgTAP `ok 1`–`ok 10` em `62752c81` | assertion verdict carregado de `b50ca074`; `supabase/tests/r1_01_tenant_auth_rls.test.sql:84-93` afirma counts e IDs de A nas cinco superfícies | PASS |
| C2 | insert/update/delete contra B são bloqueados nas cinco tabelas e B não muda | pgTAP `ok 11`–`ok 30` em `62752c81` | carregado de `b50ca074`; `:131-184` usa `throws_ok(..., '42501')` ou `is(..., 0)` e `:188-192` compara os cinco snapshots completos | PASS |
| C3 | NO_ADMIN vê A+B nas cinco tabelas | pgTAP `ok 31`–`ok 35` em `62752c81` | carregado de `b50ca074`; `:201-205` afirma counts `2, 2, 4, 2, 2` | PASS |
| C4 | anon lê zero nas cinco tabelas e na view | pgTAP `ok 36`–`ok 41` em `62752c81` | carregado de `b50ca074`; `:211-216` contém seis `is(count(*), 0)` | PASS |
| C5 | authenticated sem vínculo lê zero nas cinco tabelas | pgTAP `ok 42`–`ok 46` em `62752c81` | carregado de `b50ca074`; `:226-230` contém cinco `is(count(*), 0)` | PASS |
| C6 | 1 segundo antes do vencimento permite projeto/roadmap/itens e status inicial | pgTAP `ok 47` em `62752c81` | carregado de `b50ca074`; `:243-254` compara o objeto completo com `{"projects":1,"roadmaps":1,"items":2,"status":"INICIAL_15_DIAS"}` | PASS |
| C7 | 1 segundo depois do vencimento bloqueia CLIENT e mostra EXPIRADO ao admin | pgTAP `ok 48`–`ok 51` em `62752c81` | carregado de `b50ca074`; `:269-271` afirma três counts zero e `:280` afirma `EXPIRADO` | PASS |
| C8 | convertido continua acessando depois de 45 dias | pgTAP `ok 52`–`ok 54` em `62752c81` | carregado de `b50ca074`; `:295-297` afirma counts `1`, `1`, `2` | PASS |
| C9 | etapas bloqueado esconde itens, preserva roadmap e não limita NO_ADMIN | pgTAP `ok 55`–`ok 57` em `62752c81` | carregado de `b50ca074`; `:311-312` afirma CLIENT `0` itens/`1` roadmap e `:321` afirma NO_ADMIN `2` itens | PASS |
| C10 | activity_events é append-only e request_id é idempotente | pgTAP `ok 58`–`ok 63` em `62752c81` | carregado de `b50ca074`; `:327-357` usa `throws_ok(..., '42501')`; `:369-375` usa `throws_ok(..., '23505')` e count `1` | PASS |
| C11 | destinos pós-login: um projeto, vários projetos, NO_ADMIN | 4 casos `criterion 11` passaram em `62752c81` | verificado no HEAD: `app/src/App.test.tsx:95` afirma `/p/projeto-a/como-funciona`; `:118-126` afirma `/p/projetos` e links para Alfa/Beta; `:129-132` abre Beta; `:147-156` afirma os links e a consulta `projects`/`id, name` na rota direta; `:170-173` afirma `/no/projetos` sem consulta CLIENT | PASS |
| C12 | falha mantém login, mostra erro e limpa senha | 1 caso `criterion 12` passou em `62752c81` | atualizado no HEAD: `app/src/App.test.tsx:187-190` afirma `/login`, alerta, senha `''` e e-mail preservado | PASS |
| C13 | guard de sessão e papel | 3 casos `criterion 13` passaram em `62752c81` | atualizado no HEAD: `app/src/App.test.tsx:195-204` afirma `/login` para `/p/*` e `/no/*`; `:207-216` afirma tela e pathname `/nao-autorizado` | PASS |
| C14 | build, lint, TypeScript e banco local verdes, sem remoto | todos os gates exit 0 em `62752c81` | verificado no HEAD: scripts em `app/package.json:8-10`; build transformou 79 módulos; reset local e pgTAP 75/75; `supabase/config.toml:43` mantém `enable_signup = false` | PASS |
| C15 | updates de projeto/item geram um evento auditável; bypass suprime | pgTAP `ok 64`–`ok 72` em `62752c81` | carregado de `b50ca074`; `:391-394` e `:408-411` afirmam count `1`, ator, projeto e payload literal; `:428` afirma count `0` com bypass | PASS |

## Reavaliação direta do fix de C11

- `app/src/App.tsx:14` substitui o placeholder pela `ClientProjectsPage` na rota protegida `/p/projetos`.
- `app/src/projects/project-service.ts:8-15` consulta as colunas `id, name` de `projects`; a RLS já provada limita o conjunto ao CLIENT autenticado.
- `app/src/pages/LoginPage.tsx:36-50` usa a mesma consulta, redireciona uma linha diretamente e transporta várias linhas para a lista.
- `app/src/pages/ClientProjectsPage.tsx:34-60` aceita o conjunto já consultado ou refaz a consulta ao abrir a URL diretamente; `:75-99` materializa loading, erro, vazio e um link por projeto.
- `app/src/App.test.tsx:100-157` prova dois projetos nomeados, destinos distintos, clique em Beta e recarga direta com nova consulta. O placeholder que causou o FAIL da rodada 1 não existe mais nessa rota.

## Swept

| Row | Proveniência nesta rodada | Result |
|---|---|---|
| validation | carregada de `b50ca074`; reexecutada em `62752c81` nos pgTAP `ok 73`–`ok 75` | PASS |
| failure modes | C12 atualizado e executado em `62752c81`; negações de C2 carregadas e reexecutadas | PASS |
| idempotency and retry | constraint/assertion carregada de `b50ca074`; C10 reexecutado em `62752c81` | PASS |
| authorization | C1–C5 carregados e reexecutados; C13 atualizado e executado em `62752c81` | PASS |
| concurrency and ordering | carregado de `b50ca074`; não em escopo e fronteira de retry continua na unicidade de `request_id` | n/a conforme checklist |
| data lifecycle | carregado de `b50ca074`; não em escopo | n/a conforme checklist |
| external-dependency failure | C12 atualizado e executado em `62752c81`; nenhum outro serviço nesta feature | PASS |
| state transitions | C6–C8 carregados e reexecutados em `62752c81` | PASS |
| observability | C15 carregado e reexecutado em `62752c81` | PASS |

## Gates executados no HEAD

| Command | Result |
|---|---|
| `supabase db reset --local` | PASS no retry limpo — quatro migrations aplicadas |
| `supabase test db supabase/tests/r1_01_tenant_auth_rls.test.sql --local` | PASS — Files=1, Tests=75 |
| replay TAP local detalhado via `psql`, mesma suíte/transação | PASS — `ok 1` a `ok 75`, `1..75`, `ROLLBACK` |
| `npm test -- --run --reporter=verbose` em `app/` | PASS — 1 arquivo, 8 testes, todos os nomes impressos |
| `npm run lint` em `app/` | PASS — exit 0 |
| `npx tsc -b --pretty false` em `app/` | PASS — exit 0 |
| `npm run build` em `app/` | PASS — 79 módulos, exit 0 |
| `supabase db lint --local --schema public --level warning --fail-on error` | PASS — `No schema errors found` |
| `supabase db advisors --local --type security --level warn --fail-on error` | PASS — `No issues found` |
| `supabase db advisors --local --type performance --level warn --fail-on error` | PASS com 7 WARN — todos `auth_rls_initplan` nas policies Meta legadas; nenhum objeto R1-01 |
| `git diff --check 300fa88f..62752c81` | PASS — sem saída |
| `npm ls --depth=0` em `app/` | PASS — árvore declarada resolvida |

### Incidente transitório do reset

A primeira tentativa de `supabase db reset --local` falhou durante `Initialising schema`. O log do container local mostrou uma corrida do Realtime ao reinserir `external_id = realtime-dev` (`duplicate key` em `tenants_external_id_index`). Sem alterar arquivos ou estado remoto, a repetição após os containers estabilizarem aplicou as quatro migrations e terminou com exit 0; a suíte pgTAP, os lints e os advisors passaram em seguida.

## Gap

Nenhum gap aberto. C11 agora entrega e prova a lista simples para CLIENT com múltiplos projetos; os outros 14 veredictos permanecem válidos no novo HEAD e todos os proofs foram reexecutados em full.

## Preservação

- Nenhum arquivo de código foi alterado.
- Nenhum `.env` foi aberto; nenhum segredo foi lido ou registrado.
- Nenhum comando linked/remoto, push, deploy, produção, stash ou mutação de migration hospedada foi executado.
- O worktree já estava amplamente sujo fora da feature; essas mudanças alheias foram preservadas.
- Única escrita desta verificação: este relatório.
