# R1-04 · Skill 01 Verification

**Current verdict**: PASS
**Current profile**: `standard`
**Current diff range**: `3749354..db7670d`
**Current round**: 2 — scoped
**Verifier**: independent sub-agent (author != verifier)

## Round 2 — scoped at `db7670d`

As três lacunas da rodada 1 foram corrigidas e provadas no alvo recebido. A rodada 2 reexecutou as provas nominais completas de C1–C11 e fez fault injection proporcional nas superfícies corrigidas. Resultado: **11/11 checks provados; 4/4 mutações mortas**.

O escopo funcional desta rodada permanece congelado em `3749354..db7670d`. O commit documental `fe26d03` e o commit posterior de infraestrutura Playwright `40f78bc` não participam do veredito.

### Reavaliação das lacunas da rodada 1

1. **C1 — agregado integral e reuso cross-tenant: PASS.** O harness seleciona todos os campos do roadmap e compara `answers`, `references`, `stack`, `costs`, `next_steps`, `tiers`, `preferred_tier` e `prototype_url` com a entrada, nos três estados aceitos (`supabase/tests/r1_04_skill_01.ps1:207-237`). Também cria um usuário já associado a um tenant e comprova a mesma identidade em duas memberships distintas, sem duplicar Auth (`:241-253`). O pgTAP possui uma segunda comparação literal do agregado completo (`supabase/tests/r1_04_skill_01_access.test.sql:65-94`). A mutação que persistia `answers = {}` foi morta pelo pgTAP; a que impedia a membership do segundo tenant foi morta pelo harness.
2. **C4 — enumeração independente: PASS.** Os campos obrigatórios, tiers `essencial/basico/completo` e campos internos dos tiers são literais próprios do teste em `app/src/skill01Contract.test.ts:4-14`, exercitados em `:42-76`; não são mais importados das constantes produtivas. Remover `completo` da produção matou o caso nominal `rejeita a chave de tier ausente: completo`.
3. **C7 — papel CLIENT no fluxo real: PASS.** A Edge Function rejeita conflito de papel e grava `app_metadata.role = CLIENT`, compensando usuário recém-criado se a atualização falhar (`supabase/functions/skill-01-ativar-dashboard/index.ts:114-130`). O harness abre o link real e prova `CLIENT` na sessão do convite (`supabase/tests/r1_04_skill_01.ps1:293-297`) e novamente após definir a senha e fazer login, junto do acesso ao projeto (`:299-303`).

### Checks

| Check | Claim | Round 2 proof | Result |
|---|---|---|---|
| C1 | provisiona os três estados, publica o agregado exato e reutiliza identidade entre tenants | harness `:207-253`; pgTAP `:54-94`; duas mutações mortas | PASS |
| C2 | uma atividade atribuída/idempotente | harness `:255-257,291`; pgTAP `:97-99` | PASS |
| C3 | 401/403 e delta zero | harness `:259-264` | PASS |
| C4 | 422 e contrato completo independente | Vitest 17 casos; harness `:266-272`; mutação de `completo` morta | PASS |
| C5 | compensação sem órfãos e Auth indisponível | harness `:274-285` | PASS |
| C6 | retry gira convite sem duplicar/reiniciar | harness `:287-291`; pgTAP | PASS |
| C7 | convite válido define senha e entra como CLIENT real | harness Auth `:293-303`; Vitest DOM | PASS |
| C8 | usado/inválido/vencido pede novo link sem criar identidade | harness Auth; Vitest DOM | PASS |
| C9 | 15 dias + 1 segundo deriva expirado/não convertido | pgTAP | PASS |
| C10 | 14 dias/15d−1s e convertido ativo | pgTAP | PASS |
| C11 | gates no mesmo alvo | todos os comandos abaixo | PASS |

### Test policy rows

| Row | Required proof | Round 2 result |
|---|---|---|
| Validação de conteúdo e estados | tabela própria + boundary | PASS — enumerações literais independentes e boundary 422/delta zero |
| Auth + RPC + compensação | HTTP/Auth real + pgTAP | PASS — estados, compensação, conteúdo integral e reuso cross-tenant provados |
| Estado efetivo derivado | pgTAP nos limites | PASS — C9/C10 |
| Rota `/acesso` | DOM + Auth local one-shot | PASS — sessão real do convite e login carregam CLIENT; DOM cobre a interface |
| CLI fino | processo real, códigos 0/1/2 e não vazamento | PASS — harness executou o processo real |

### Coverage recomputada

| Set | Resultado |
|---|---|
| estados aceitos | 3/3 — `ROADMAP_PAGO`, `REFERENCIAS_PENDENTES`, `EM_PRODUCAO` |
| estados rejeitados | 2/2 — `CONVERTIDO`, `ARQUIVADO` |
| papéis/sessão | 3/3 na fronteira — ausência, CLIENT e NO_ADMIN; CLIENT também provado no Auth real |
| campos obrigatórios / tier keys / tier fields | 6/6, 3/3 e 7/7 por tabela literal independente |
| módulos | 6/6 explicitamente comparados |
| efeitos do agregado | cardinalidades/status e os 8 campos persistidos comparados exatamente |
| novo vs. usuário preexistente | 2/2 — novo e identidade existente em outro tenant; retry também coberto |
| convite | 4/4 — válido, usado, inválido e vencido |
| limites temporais | 4/4 |
| saídas CLI | 3/3 |
| redirects | configuração e redirect local `127.0.0.1` exercitados |

### Faults injected — round 2

Scratch isolado criado em `db7670d` e removido ao final. Cada mutação foi executada contra sua prova de detecção; nenhuma alteração funcional foi mantida.

| Mutation | Proof that failed | Killed |
|---|---|---|
| papel gravado `CLIENT` → `BROKEN_CLIENT` na Edge Function | harness HTTP/Auth recusou o fluxo de papel/retry | sim |
| RPC ignora membership quando o usuário já pertence a qualquer tenant | `C1 usuário existente é reutilizado entre dois tenants...` | sim |
| RPC persiste `answers` como `{}` | pgTAP `C1 stores every roadmap field exactly` | sim |
| remove `completo` de `ROADMAP_TIER_KEYS` produtivo | Vitest `rejeita a chave de tier ausente: completo` | sim |

**Fault result:** 4/4 mortos.

### Gates — round 2

| Command | Result |
|---|---|
| `git diff --check 3749354..db7670d` | PASS |
| `supabase db reset --local --yes` | PASS — migrations reais reaplicadas antes das provas e novamente no encerramento |
| `supabase test db` | PASS — 4 arquivos, 172 testes |
| `pwsh -NoProfile -File supabase/tests/r1_04_skill_01.ps1` | PASS — 21 assertions, C1–C8/C11 |
| `npm test -- --run` | PASS — rerun completo, 4 arquivos e 39/39 testes |
| `npx vitest run src/skill01Contract.test.ts src/AccessPage.test.tsx --reporter=verbose` | PASS — 24/24 testes nomeados |
| `npm run lint` | PASS |
| `npx tsc -b` | PASS |
| `npm run build` | PASS — 80 modules transformed |

Na primeira execução da suíte Vitest completa, um teste legado de redirect em `src/App.test.tsx` falhou de forma transitória. O arquivo isolado passou 8/8 e a suíte completa imediatamente repetida passou 39/39; a falha não foi reproduzida e não altera o veredito da R1-04.

O reset final do Supabase local para as migrations reais foi concluído depois dos testes e da remoção do scratch. Nenhum reset adicional será executado por este verificador.

---

## Round 1 — full at `07f7aab` (history preserved)

**Verdict**: FAIL
**Profile**: `standard`
**Diff range**: `3749354..07f7aab`
**Round**: 1 — full
**Verifier**: independent sub-agent (author != verifier)

O estado nominal está verde, mas a feature não está provada nem funcional de ponta a ponta. C4 aceitou uma mutação que remove a chave obrigatória `completo`; C7 usa no DOM um papel que o fluxo real de convite não grava; e C1 não compara o conteúdo persistido do roadmap nem cobre o reuso de um usuário de outro tenant.

> O repositório avançou para commits posteriores durante esta verificação. Este relatório congela o alvo recebido, `07f7aab`; correções posteriores não estão incluídas neste veredito.

## Binding sources

| Source | Opened | Contradiction | Uncovered |
|---|---|---|---|
| `.tasks/r1-04-skill01-acesso.md` | sim | nenhuma contradição no checklist | comportamento real de C7 e persistência integral de C1 não são provados |
| `.checks/r1-04-skill01-acesso.md` | sim | nenhuma | join de Coverage de campos/tiers deriva os membros das constantes produtivas |
| `.design/no-sistema-operacional.md` | não exigido pelo perfil `standard` para comparação visual | — | — |
| `fluxos_ref/plan_master.md` | não exigido pelo perfil `standard` para comparação visual | — | — |
| `.tasks/r1-01-base-tenant-auth.md` e migration R1-01 | sim, via contratos referenciados e schema local refeito | nenhuma | — |

## Findings

1. **C7 — convite real não abre o formulário de senha.** `supabase/functions/skill-01-ativar-dashboard/index.ts:104-108` gera o convite sem gravar `app_metadata.role`. Após o harness, uma leitura sanitizada do usuário realmente criado mostrou `{ role: null, provider: "email", providers: ["email"] }`. `app/src/pages/AccessPage.tsx:41-42` exige `app_metadata.role === 'CLIENT'` e, portanto, renderiza “Convite vencido”. O DOM test mascara a falha ao fabricar o papel em `app/src/AccessPage.test.tsx:28-44`; o harness pula a tela e atualiza a senha diretamente em `supabase/tests/r1_04_skill_01.ps1:265-274`.
2. **C4 — Coverage autorreferente e mutante sobrevivente.** `app/src/skill01Contract.test.ts:6-11` importa `ROADMAP_REQUIRED_FIELDS`, `ROADMAP_TIER_FIELDS` e `ROADMAP_TIER_KEYS` da produção e usa esses mesmos arrays como tabela em `:35-66`. Remover `"completo"` de `ROADMAP_TIER_KEYS` fez a prova permanecer verde, agora com 16/16 casos. A enumeração normativa precisa ser literal e independente no teste.
3. **C1 — o conteúdo publicado não é comparado ao arquivo de entrada.** O harness de `07f7aab` seleciona apenas `published_at,preferred_tier,prototype_url` em `supabase/tests/r1_04_skill_01.ps1:214` e o assert em `:216-223` só usa `published_at`. O pgTAP verifica publicação e apenas `preferred_tier` em `supabase/tests/r1_04_skill_01_access.test.sql:63-64`. Uma regressão que grave `answers`, `references`, `stack`, `costs`, `next_steps` ou `tiers` incorretamente passa. O ramo aprovado “reaproveita usuário de outro tenant” também não possui fixture/prova própria; C6 cobre somente retry do mesmo projeto.

## Checks

| Check | Claim | Proof run | Evidence | Result |
|---|---|---|---|---|
| C1 | provisiona os três estados e publica o agregado completo | harness 20 assertions; pgTAP | `r1_04_skill_01.ps1:212-223` prova estados, cardinalidade, módulos, janela e convite; `r1_04_skill_01_access.test.sql:54-64` prova membership/status/módulos/publicação | **FAIL** — conteúdo integral e usuário preexistente em outro tenant sem assertion |
| C2 | uma atividade atribuída/idempotente | harness; pgTAP | `r1_04_skill_01.ps1:227-229`; `r1_04_skill_01_access.test.sql:66-68` — contagem 1, actor e tipo/request id | PASS |
| C3 | 401/403 e delta zero | harness | `r1_04_skill_01.ps1:231-236` — status 401/403 e vetor público/Auth idêntico | PASS |
| C4 | 422 para contrato inválido e enumeração completa | Vitest 17 casos; harness | `skill01Contract.test.ts:35-89`; `r1_04_skill_01.ps1:238-244` | **FAIL** — mutante removendo `completo` sobreviveu |
| C5 | compensação sem órfãos e Auth indisponível | harness | `r1_04_skill_01.ps1:246-257` — 409 para CONVERTIDO/ARQUIVADO, Auth 0 e 502/delta zero | PASS |
| C6 | retry gira convite sem duplicar/reiniciar | harness; pgTAP | `r1_04_skill_01.ps1:259-263`; `r1_04_skill_01_access.test.sql:83-87` | PASS |
| C7 | convite válido define senha e entra no projeto | Vitest DOM; harness Auth | `AccessPage.test.tsx:68-84`; `r1_04_skill_01.ps1:265-274` | **FAIL** — assembly substitution: sessão DOM inventa papel ausente no usuário real |
| C8 | usado/inválido/vencido pede novo link sem criar identidade | Vitest DOM; harness Auth | `AccessPage.test.tsx:106-126`; `r1_04_skill_01.ps1:276-280` | PASS |
| C9 | 15 dias + 1 segundo deriva expirado/não convertido | pgTAP | `r1_04_skill_01_access.test.sql:89-90` | PASS |
| C10 | limites de 14 dias/15d−1s e convertido ativo | pgTAP | `r1_04_skill_01_access.test.sql:91-95` | PASS |
| C11 | gates no mesmo alvo | todos os comandos abaixo | saídas registradas em `Gate` | PASS |

**Resultado:** 8/11 checks provados; C1, C4 e C7 falham.

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
|---|---|---|---|
| Validação de conteúdo e estados | `_shared/roadmap-content.ts`, Edge | tabela própria + boundary | **não** — a tabela própria deriva sua enumeração das constantes produtivas; mutante sobrevive |
| Auth + RPC + compensação | Edge, RPC, harness | HTTP/Auth real + pgTAP | **parcial** — auth/estados/compensação passam; conteúdo integral e reuso cross-tenant não são assertados |
| Estado efetivo derivado | migration/view | pgTAP nos limites | sim — C9/C10 e mutante de limite morto |
| Rota `/acesso` | `AccessPage`, `AuthProvider` | DOM + Auth local one-shot | **não** — as duas provas montam sessões incompatíveis; o usuário real não satisfaz o guard da tela |
| CLI fino | `skill-01.mjs` | processo real, 0/1/2 e não vazamento | sim — harness passou e mutante de exit code foi morto |

## Coverage recomputada

| Set | Resultado |
|---|---|
| estados aceitos (3) | 3/3 no harness: `ROADMAP_PAGO`, `REFERENCIAS_PENDENTES`, `EM_PRODUCAO` |
| estados rejeitados (2) | 2/2: `CONVERTIDO`, `ARQUIVADO` |
| papéis/sessão (3) | 3/3 na fronteira: ausência, CLIENT e NO_ADMIN; composição Auth→DOM de CLIENT falha |
| campos obrigatórios (6), tier keys (3), tier fields (7) | casos nominais aparecem, mas os três conjuntos são derivados do código sob teste; coverage não é independente |
| módulos (6) | 6/6 explicitamente comparados no harness/pgTAP |
| efeitos do agregado | cardinalidades/status passam; conteúdo dos 6 blocos + tiers do roadmap permanece sem prova de igualdade |
| novo vs. usuário preexistente | 1/2: novo e retry do mesmo projeto; usuário de outro tenant não coberto |
| convite (4) | usado/inválido/vencido provados; válido falha na composição com o papel real |
| limites temporais (4) | 4/4 provados |
| saídas CLI (3) | 3/3 provadas |
| redirects (3 assemblies) | configuração presente; local 127.0.0.1 exercitado |

Claims de fronteira C1, C3, C4, C5, C6, C7 e C8 possuem provas HTTP/Auth, mas C7 sofre assembly substitution e C1/C4 possuem gaps internos descritos acima.

## Faults injected

Worktree isolado criado em commit `07f7aab`; scratch removido ao final. O banco local foi restaurado pelo replay das migrations reais.

| Mutation | Location | Proof | Killed |
|---|---|---|---|
| remove `completo` de `ROADMAP_TIER_KEYS` | `_shared/roadmap-content.ts:1` | `skill01Contract.test.ts` | **não** — 16/16 passaram |
| redirect final `como-funciona` → `prototipo` | `AccessPage.tsx:65` | C7 DOM | sim — pathname esperado falhou |
| inverte autorização NO_ADMIN | Edge `index.ts:59` | harness C1/C3 | sim — CLI recebeu 403 |
| expiração 15 → 16 dias | migration `:11,:21` | pgTAP C9 | sim — 2/22 falharam |
| exit code de argumento ausente 2 → 0 | `skill-01.mjs:12` | harness C11 | sim — assertion final falhou |

**Fault result:** 4/5 mortos; 1 sobrevivente. Pelo protocolo TLC, qualquer sobrevivente determina FAIL.

## Gate

| Command | Result |
|---|---|
| `git diff --check 3749354..07f7aab` | PASS |
| `supabase db reset --local --yes` | PASS — migrations R1-01…R1-04 reaplicadas; uma primeira tentativa encontrou corrida transitória do Realtime e a repetição diagnosticada passou |
| `supabase test db` | PASS — 4 arquivos, 171 testes |
| `pwsh -NoProfile -File supabase/tests/r1_04_skill_01.ps1` | PASS — 20 assertions, C1–C8/C11 |
| `npm test -- --run` | PASS — 4 arquivos, 39 testes |
| `npx vitest run src/skill01Contract.test.ts src/AccessPage.test.tsx --reporter=verbose` | PASS — 24 testes nomeados |
| `npm run lint` | PASS |
| `npx tsc -b` | PASS |
| `npm run build` | PASS — 80 modules transformed |

## Required fixes before round 2

1. Fazer o usuário criado/reutilizado chegar à tela com autorização CLIENT real e provar no mesmo fluxo Auth→DOM, sem fixture divergente.
2. Tornar as enumerações esperadas do contrato literais/independentes no teste e matar a remoção de qualquer membro.
3. Comparar os campos persistidos do roadmap ao arquivo de entrada e adicionar o caso de usuário preexistente em outro tenant.
