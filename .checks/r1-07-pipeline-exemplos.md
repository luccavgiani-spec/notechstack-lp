# R1-07 · Pipeline ponta a ponta com Gazeta e Hello Best — checklist de implementação

## Profile

`standard` — esta task cruza um comando de seed, dados persistidos, a Edge Function da
Skill 01, autorização multi-tenant, expiração temporal e duas jornadas reais no navegador.
O perfil exige provas no próprio nível da decisão (pgTAP, harness HTTP, testes DOM e
Playwright), além de uma verificação final fresca. O checklist não altera nenhum contrato
da R1-01/R1-04/R1-05/R1-06.

## Sources

- `.tasks/r1-07-pipeline-exemplos.md` — fonte normativa dos critérios 1–12, do seed, dos
  Cenários A e C, das superfícies observáveis, dos itens Swept e dos cinco Unresolved.
- `.tasks/no-sistema-operacional.md` — grafo de dependências, ordem das ondas e regra de que
  migrations/contratos compartilhados não são alterados silenciosamente.
- `.design/no-sistema-operacional.md` — Journey 3 (pagamento/roadmap), Journey 6–7 (cliente e
  Nó) e decisões de identidade, acesso e isolamento.
- `fluxos_ref/plan_master.md` §5.2–§5.3, §7, §10, §12, §15 Aceites 01–04/11 e §16
  Cenários A e C — fonte dos marcos D+1/D+3, módulos, janela de decisão, isolamento e
  resultado esperado da linha inteira.
- `.checks/r1-03-checkout-roadmap.md` e `.checks/r1-04-skill01-acesso.md` — contratos
  entregues do webhook aprovado e da Skill 01; a R1-07 deve consumir as mesmas fronteiras,
  sem escrever diretamente nos agregados.
- `.checks/r1-05-dashboard-cliente.md` — rotas/client view, seis módulos, tier, 5 fases,
  progresso 17/27 = 63%, protótipo em mockup e RLS de leitura.
- `.checks/r1-06-dashboard-no.md` — lista/ficha administrativa, rota de projetos, Atividade,
  estado de projeto e autorização `NO_ADMIN`; o botão de Skill 01 é consumidor da R1-07.
- `supabase/migrations/20260915180826_r1_01_tenant_auth_rls.sql` — enums, tabelas,
  `project_access`, RLS, `can_read_project` e trigger de Atividade existentes.
- `supabase/migrations/20260915192748_r1_03_checkout_roadmap.sql` — shape do pagamento
  aprovado, criação de cliente/projeto/roadmap e itens D+1/D+3.
- `supabase/migrations/20260915203000_r1_04_skill_01_access.sql` e
  `supabase/functions/skill-01-ativar-dashboard/index.ts` — contrato HTTP da liberação,
  validação `invalidFields`, convite e transição para `JANELA_DE_DECISAO`.
- `C:/Users/lucca/projetos/gazeta_bragantina/painel-controle/index.html` — fonte de
  verdade dos cinco nomes de fase, dos 27 títulos, IDs, ordens e estados `checked`; ler,
  nunca alterar.
- `home-no-prototipo/hello-deliverable.js` e
  `home-no-prototipo/work/hello-best/roadmap.md` — fontes abertas para o conteúdo Hello Best;
  tiers não são inventados e permanecem marcados `a preencher`.
- `app/src/App.tsx`, `app/src/admin-dashboard/*`, `app/src/client-dashboard/*`,
  `app/src/auth/*`, `app/src/supabase.ts`, `app/playwright.config.ts` e os fixtures
  `app/e2e/r1-05-fixture.ts` — assembly atual do app, sessão, rotas e runner local.
- `brand/BRAND.md` e `brand/tokens/tokens.css` — identidade visual vinculante; a R1-07
  apenas alimenta dados reais no shell existente.

## Binding dependencies and build gates

O build não começa até existir no mesmo HEAD uma prova fresca de que R1-04, R1-05 e R1-06
estão concluídas. Em particular:

1. R1-06 precisa ter rota de ficha administrativa navegável e o controle “Liberar dashboard”
   chamando `POST /functions/v1/skill-01-ativar-dashboard`; se a rota ainda for placeholder,
   o primeiro check da R1-07 permanece bloqueado.
2. O trigger de Atividade, `roadmaps`, `can_read_project`, enums e RLS da R1-01 são contratos
   compartilhados. O seed pode inserir dados e usar a API local, mas não pode recriar enums,
   desligar triggers ou ampliar leitura CLIENT.
3. O webhook de R1-03 deve ser exercitado no Supabase local com gateway/mock já existente;
   não se usa service role para simular uma chamada CLIENT nem se chama projeto hospedado.
4. A verificação da R1-07 somente é válida depois de `supabase db reset --local`, reaplicação
   das migrations da base e todos os testes próprios e regressivos passarem. Usuários de
   demonstração podem ser criados pelo fixture efêmero; não fazem parte do seed de produção.

## Out of scope

- Criar usuários reais da Gazeta ou Hello Best em produção; os e-mails continuam nos
  Unresolved 1 e 2 da task.
- Executar a Skill 01 real para Hello Best ou enviar convite por WhatsApp antes da confirmação
  dos e-mails e dos tiers; a prova local usa conteúdo controlado e link de convite capturado.
- Push, deploy, DNS, migration remota, publicação de Edge Functions e qualquer alteração
  hospedada até o fechamento de todas as tasks.
- Alterar `gazeta_bragantina/painel-controle/index.html`, `hello-deliverable.js` ou
  `roadmap.md`; eles são fontes de leitura.
- Cenários B e D, Editor/Versões, reembolso, Saldos e qualquer integração externa além do
  mock/local Supabase.
- Resolver tiers comerciais Hello Best, copy final de convite/expiração ou disparo externo.

## Landing

O comando `npm run seed:exemplos` será um seed local, transacional e reexecutável. Ele mantém
as chaves naturais decididas pela task — `clients.slug = gazeta-bragantina` e
`clients.slug = hello-best` — e reconcilia somente os agregados pertencentes a esses dois
slugs. A execução imprime o que criou ou atualizou e termina `0` em sucesso ou `1` em erro;
não imprime tokens, e-mails de autenticação ou credenciais. O formato exato de argumentos
permanece aberto conforme Unresolved 4, mas deve ser documentado por `--help` antes do uso.

Para tornar a repetição testável sem apagar dados de terceiros:

- cada cliente é upsertado pelo slug único;
- cada exemplo tem um nome canônico de projeto e exatamente um projeto desse cliente; um
  conflito ambíguo falha com `1`, em vez de apagar silenciosamente outro projeto;
- os 27 itens Gazeta são reconciliados apenas pelo projeto canônico, preservando os títulos,
  fases, ordem e `checked` da fonte; a execução não faz delete amplo nem toca itens de outro
  projeto;
- a operação é atômica: uma falha não deixa metade de Gazeta/Hello Best, e rodar novamente
  repara o mesmo agregado sem duplicar cliente, projeto, item, roadmap ou evento de seed;
- o seed não cria usuários Auth nem memberships reais. Usuários e convites de teste vivem no
  fixture local do E2E e são limpos ao final.

Conteúdo Hello Best:

- `roadmaps.stack`, `costs`, `next_steps` e `references` derivam do entregável/roadmap,
  com a origem documentada no fixture, sem afirmar que uma etapa marcada “Em andamento” já
  foi concluída;
- `answers` contém o diagnóstico mínimo identificado nos materiais, com ausência explícita
  onde a fonte não fornece uma resposta;
- `tiers` tem exatamente `essencial`, `basico` e `completo`, cada um com estado/valor
  marcado `a preencher`; nenhum preço é inventado;
- `prototype_url` é exatamente `https://hello-best.lovable.app`, e o projeto começa com
  `lead_status = 'EM_PRODUCAO'`.

## Checks

### S1 — Skill 01 na ficha administrativa

- [ ] **C1 — uma liberação válida pela ficha usa a porta da R1-04 e abre a janela de decisão.**
  Para projetos com `lead_status` em `ROADMAP_PAGO`, `REFERENCIAS_PENDENTES` e
  `EM_PRODUCAO`, o `NO_ADMIN` escolhe um conteúdo válido e passa pela confirmação em duas
  etapas (“Liberar dashboard” → confirmar). A resposta mostra o convite com controle de
  copiar, a ficha mostra o link sem revelar tokens e o projeto muda para
  `JANELA_DE_DECISAO` com os efeitos de acesso/módulos da Skill 01.
  Proof: `npm test -- --run src/adminDashboard.test.tsx -t "C1 ficha libera dashboard nos tres estados"`;
  `pwsh -NoProfile -File supabase/tests/r1_07_pipeline_exemplos.ps1 -Scenario C1`;
  `npm run test:e2e -- e2e/r1-07-pipeline-exemplos.spec.ts --grep "C1"`.

- [ ] **C2 — conteúdo inválido devolve os campos e não altera nada.** O mesmo fluxo omite
  individualmente `answers`, `references`, `stack`, `costs`, `next_steps`, `tiers` e cada
  chave de tier conforme o contrato R1-04. A ficha exibe `invalidFields` devolvido pela
  função, mantém link/estado/roadmap/módulos/membership/atividade invariáveis e não cria
  usuário parcial.
  Proof: `npm test -- --run src/skill01Contract.test.ts -t "C2 invalid fields are shown by dashboard"`;
  `pwsh -NoProfile -File supabase/tests/r1_07_pipeline_exemplos.ps1 -Scenario C2`;
  pgTAP `supabase/tests/r1_07_pipeline_exemplos.test.sql` — grupo `C2 invalid content has zero delta`.

### S2 — Seed e fidelidade dos exemplos

- [ ] **C3 — o seed cria o agregado Gazeta exatamente uma vez.** Depois de uma execução local,
  existe `clients.slug = 'gazeta-bragantina'`, um projeto com `lead_status = 'CONVERTIDO'`,
  `project_status = 'CONVERTIDO'`, `access_status = 'ATIVO_ATE_FIM_DO_PROJETO'` e 27
  `kanban_items`. Os itens estão nas cinco fases normativas e exatamente 17 têm
  `status = 'concluido'`/`completed_at` coerente. O seed não cria Auth/membership real.
  Proof: `npm run seed:exemplos` com saída capturada; pgTAP — grupo `C3 Gazeta aggregate and 27 items`;
  `pwsh -NoProfile -File supabase/tests/r1_07_pipeline_exemplos.ps1 -Scenario C3`.

- [ ] **C4 — os 27 itens são idênticos à fonte `FASES`.** Uma comparação table-driven lê o
  array `FASES` de `C:/Users/lucca/projetos/gazeta_bragantina/painel-controle/index.html`
  sem alterá-lo e compara, para cada item, ID/chave estável, título, fase, posição/ordem,
  semana quando persistida e estado concluído. As fases aparecem exatamente como “Fase 0 ·
  Preparação”, “Fase 1 · Frontend”, “Fase 2 · Migração e Backup”, “Fase 3 · Editorial e
  Backend” e “Fase 4 · Go-live”; nenhuma tarefa extra entra no painel do cliente.
  Proof: `npm test -- --run src/pipelineExamples.test.ts -t "C4 Gazeta matches FASES source"`;
  `pwsh -NoProfile -File supabase/tests/r1_07_pipeline_exemplos.ps1 -Scenario C4`.

- [ ] **C5 — o seed cria Hello Best com conteúdo rastreável e sem preço inventado.** Existe
  `clients.slug = 'hello-best'`, um projeto com `lead_status = 'EM_PRODUCAO'`, um roadmap
  cujo stack/próximos passos/referências/custos podem ser rastreados aos dois materiais,
  as três chaves de `tiers` estão presentes e marcadas `a preencher`, e
  `prototype_url = 'https://hello-best.lovable.app'`. A prova também confirma que o projeto
  não recebe status `CONVERTIDO` nem acesso de produção.
  Proof: `npm test -- --run src/pipelineExamples.test.ts -t "C5 Hello Best roadmap and placeholder tiers"`;
  pgTAP — grupo `C5 Hello Best aggregate and source fields`.

- [ ] **C6 — duas execuções são idempotentes e uma falha no meio é recuperável.** Após duas
  execuções, há exatamente um cliente, um projeto e 27 itens para cada slug no agregado
  correspondente; não aparecem eventos duplicados de seed nem memberships. Um erro injetado
  após a escrita intermediária termina `1`, não vaza dados de outro cliente e a terceira
  execução converge para o mesmo snapshot final. O teste não usa `TRUNCATE` amplo.
  Proof: `npm run seed:exemplos` duas vezes + snapshot SQL; `pwsh -NoProfile -File
  supabase/tests/r1_07_pipeline_exemplos.ps1 -Scenario C6`; pgTAP — grupo `C6 seed retry is
  atomic and idempotent`.

### S3 — Cenário A: lead não convertido

- [ ] **C7 — pagamento aprovado percorre projeto, pendências, Skill 01 e dashboard CLIENT.**
  O harness simula um pagamento aprovado pela fronteira do webhook R1-03, sem service role
  no lugar do contrato, e o E2E confirma no `NO_ADMIN`: projeto criado, itens D+1/D+3 em
  Projetos e em Atividade › Pendências. Pela ficha, a Skill 01 é executada; o convite local
  entra em uma sessão CLIENT que navega em 01 Como funciona, 02 Protótipo e 03 Etapas do
  plano, marca um tier, vê 04–06 bloqueados e, com `access_released_at` recuado 14 dias,
  continua lendo o projeto.
  Proof: `pwsh -NoProfile -File supabase/tests/r1_07_pipeline_exemplos.ps1 -Scenario C7`;
  `npm run test:e2e -- e2e/r1-07-pipeline-exemplos.spec.ts --grep "C7 Cenário A"` em
  1440×900 e 375×812.

- [ ] **C8 — a borda de expiração corta o CLIENT, mas não o NO_ADMIN.** Com o mesmo projeto
  não convertido em `access_released_at + 15 days + 1 second`, a UI CLIENT mostra o estado
  expirado e uma leitura direta autenticada de `projects`/`project_access` retorna zero
  linhas do projeto. A sessão `NO_ADMIN` continua vendo ficha, estado e atividade; a prova
  cobre também 15 dias menos 1 segundo como ainda acessível para não confundir a borda.
  Proof: pgTAP — grupo `C8 access window boundary and admin exception`;
  `pwsh -NoProfile -File supabase/tests/r1_07_pipeline_exemplos.ps1 -Scenario C8`;
  `npm run test:e2e -- e2e/r1-07-pipeline-exemplos.spec.ts --grep "C8 expiracao"`.

### S4 — Cenário C: isolamento e visualização dos dois exemplos

- [ ] **C9 — Gazeta e Hello Best são isolados por URL e API.** Com sessões CLIENT separadas,
  Gazeta pede a rota/API do projeto Hello Best e Hello Best pede a rota/API de Gazeta; cada
  tentativa recebe não autorizado ou zero linhas, sem vazamento de nome, roadmap, protótipo,
  Kanban ou atividade. A sessão `NO_ADMIN` abre os dois projetos e a Atividade correspondente.
  O teste verifica que alterar a URL manualmente não contorna `can_read_project`.
  Proof: `pwsh -NoProfile -File supabase/tests/r1_07_pipeline_exemplos.ps1 -Scenario C9`;
  pgTAP — grupo `C9 cross-tenant reads are empty or unauthorized`;
  `npm run test:e2e -- e2e/r1-07-pipeline-exemplos.spec.ts --grep "C9 isolamento"`.

- [ ] **C10 — Gazeta aparece em Etapas do plano com as cinco fases e 63%.** A sessão CLIENT
  da Gazeta vê, na ordem, as cinco fases com os itens somente leitura, títulos e estados
  correspondentes ao seed; o progresso exibido é `63%` (17 de 27, arredondado), sem controles
  de escrita do cliente.
  Proof: `npm test -- --run src/clientDashboard.test.tsx -t "C10 Gazeta cinco fases e 63 por cento"`;
  `npm run test:e2e -- e2e/r1-07-pipeline-exemplos.spec.ts --grep "C10 Gazeta"` em ambas
  as larguras; pgTAP — grupo `C10 Gazeta client projection`.

- [ ] **C11 — Hello Best mostra o protótipo correto depois da Skill 01.** Depois de liberar
  o dashboard localmente pela ficha com o conteúdo do seed, o CLIENT Hello Best navega ao
  módulo 02 e encontra `https://hello-best.lovable.app` no mockup de celular; o link de
  abertura externa fica visível conforme o contrato R1-05. Falha/indisponibilidade do host
  externo não deve virar erro de tenant nem alterar o banco.
  Proof: `npm run test:e2e -- e2e/r1-07-pipeline-exemplos.spec.ts --grep "C11 Hello Best prototipo"`;
  `npm test -- --run src/clientDashboard.test.tsx -t "C11 prototype URL from Hello Best"`.

- [ ] **C12 — todos os gates e a história A+C passam nos dois viewports com evidência.** No
  mesmo HEAD, `npm run build`, `npm run lint`, `npx tsc -b --pretty false`, a suíte Vitest,
  pgTAP após reset local, o harness de seed/Edge Function e a suíte Playwright completa
  passam em 1440×900 e 375×812. O Playwright cobre sucesso, loading, erro/retry, vazio,
  bloqueado, expirado, foco/labels acessíveis, status HTTP inesperado ≥500, `console.error`
  e `pageerror`. Screenshots das etapas C7–C11 ficam em `app/test-results/r1-07/` com nomes
  estáveis (`c7-desktop`, `c7-mobile`, …), junto do relatório de execução; nenhum screenshot
  contém token ou senha.
  Proof: `npm run build`; `npm run lint`; `npx tsc -b --pretty false`; `npm test -- --run`;
  `supabase db reset --local`; `supabase test db`; `pwsh -NoProfile -File
  supabase/tests/r1_07_pipeline_exemplos.ps1`; `npm run test:e2e --
  e2e/r1-07-pipeline-exemplos.spec.ts`.

## Test policy

| Surface | Required proof | Coverage expectation |
|---|---|---|
| Seed/parser/reconciliation | Vitest unit + processo real `npm run seed:exemplos` + pgTAP snapshot | dois slugs, cinco fases, 27 itens, 17 concluídos, conteúdo de origem, repetição e erro transacional |
| Webhook R1-03 consumido pelo pipeline | harness HTTP local + pgTAP | aprovado, D+1/D+3, sem duplicação e nenhum atalho service-role no contrato |
| Skill 01 pela ficha | Testing Library/DOM + harness Edge/Auth local + Playwright | três estados aceitos, confirmação em duas etapas, sucesso, cada campo inválido, zero delta e link de convite |
| RLS/access window | pgTAP + chamadas PostgREST com JWT CLIENT/NO_ADMIN | 14 dias, 15 dias−1s, 15 dias+1s, convertido/ativo, cross-tenant e leitura administrativa |
| Dashboard cliente | DOM + Playwright | seis módulos, tier, 5 fases, 63%, protótipo, bloqueios, vazio/erro/expirado e duas larguras |
| Regressão | build/lint/tsc, Vitest completo, migrations reset/replay, Playwright público existente | não quebrar R1-03/R1-04/R1-05/R1-06 nem introduzir console/page errors |

Test fixtures must use unique local IDs and clean only their own rows. They may create
temporary Auth users, but must revoke/remove those users at teardown and never publish their
credentials. A failure in teardown is a failed proof, not a reason to ignore leaked fixtures.

## Swept

- **validation:** C2 enumerates every required top-level field and tier key; C4 compares the
  complete 27-item source; C5 validates exact slugs, status and URL.
- **failure modes:** C2 invalid content, C6 mid-seed failure, C8 expiry, C9 unauthorized
  cross-tenant read, C12 network/console/HTTP failures.
- **idempotency and retry:** C6 runs seed twice and after an injected failure; C1/C2 use the
  Skill 01 request contract; C7 avoids duplicate webhook effects; C12 repeats the full suite.
- **authorization:** C1/C2 check NO_ADMIN versus invalid/CLIENT callers; C8/C9 cover expiry,
  URL tampering, PostgREST and project access; no production user is created.
- **concurrency and ordering:** seed runs alone locally as declared by the task; item order is
  source order/position, phases are canonical order, and E2E waits for persisted rereads before
  asserting each surface.
- **data lifecycle:** no broad delete; seed reconciles only canonical example aggregates,
  reopens no real lead, and fixture teardown removes only its own Auth/public rows. Activity is
  append-only and no task adds a seed event on a no-op run.
- **external-dependency failure:** `hello-best.lovable.app` is opened only as the R1-05
  prototype link; a failed frame is recorded as the existing R1-05 fallback and cannot change
  tenant data. Production auth, Pagar.me, push and DNS remain out of scope.
- **state transitions:** C1 covers the three Skill 01 inputs to `JANELA_DE_DECISAO`; C3/C5
  cover the two example states; C7/C8 cover payment → window → expiry; C9 covers isolation.
- **observability:** seed prints create/update summary and exit code; C1/C2/C6/C7 require
  safe activity/error evidence with project IDs/codes only; screenshots and logs contain no
  secret, password, invite token or full auth link.

## Coverage

| Enumerated set | Member → proof | Unproven |
|---|---|---|
| Skill 01 accepted input states (3) | `ROADMAP_PAGO` C1 · `REFERENCIAS_PENDENTES` C1 · `EM_PRODUCAO` C1 | - |
| Skill 01 required top-level fields (6) | `answers`, `references`, `stack`, `costs`, `next_steps`, `tiers` C2 | - |
| Tier keys (3) | `essencial`, `basico`, `completo` C2/C5 | - |
| Seed clients (2) | Gazeta C3/C4 · Hello Best C5 | - |
| Gazeta phases (5) | Fase 0 C3/C4 · Fase 1 C3/C4 · Fase 2 C3/C4 · Fase 3 C3/C4 · Fase 4 C3/C4 | - |
| Gazeta item cardinality/status (27/17) | 27 total + 17 concluídos C3/C4/C10 | - |
| Hello Best source groups (4) | stack, costs, next steps, references C5/C11 | source fields not supplied remain explicit empty/placeholder |
| pipeline transitions | webhook approved C7 · Skill 01/window C1/C7 · expiry boundary C8 | production release intentionally out of scope |
| access-time boundaries (3) | 14 days C7 · 15 days−1s C8 · 15 days+1s C8 | - |
| actors/sessions (3) | NO_ADMIN C1/C7–C11 · Gazeta CLIENT C9/C10 · Hello Best CLIENT C9/C11 | real production e-mails unresolved |
| client modules (6) | 01–03 readable and tier C7 · 04–06 blocked C7 · prototype C11 | - |
| isolation surfaces (2) | URL C9 · PostgREST/API C9 | - |
| viewport widths (2) | 1440×900 C7–C12 · 375×812 C7–C12 | - |
| screen states (7) | loading/error C12 · empty C12 · success C1/C7/C10/C11 · blocked C7 · expired C8 · unauthorized C2/C9 | frame error keeps R1-05 provisional copy |
| CLI outcomes (2) | success `0` C3/C5/C6 · failure `1` C2/C6/C12 | exact argument shape remains Unresolved 4 |

Claims with HTTP status, route, response shape or RLS visibility (C1, C2, C7, C8 and C9)
must have at least one boundary proof (Edge harness/PostgREST/Playwright), not only a unit
test. The FASES comparison in C4 is a source-level proof, not a substitute for the persisted
snapshot in C3.

## Handoff

- The task fits one functional batch only after R1-06 is verified. Safe implementation order:
  (A) seed/parser + pgTAP/idempotency, (B) ficha consumer of existing Skill 01, (C) A/C
  Playwright fixture and screenshot evidence, (D) full regression.
- Keep files non-overlapping with parallel Wave 2 tasks. A new migration is not expected for
  the seed; if a migration is proposed, stop and reopen the shared-contract review before
  writing it.
- The builder must not resolve Unresolved 1/2 (production e-mails), must keep Unresolved 5
  tiers as `a preencher`, and must implement the written defaults for Unresolved 3 (two-step
  confirmation) and Unresolved 4 (summary output, exit `0`/`1`) without inventing external
  side effects.
- A fresh verifier receives this checklist, the complete diff, the exact source FASES, the two
  Hello Best materials, and the final reports. It runs reset/replay, checks the full C1–C12
  denominator, verifies screenshots and checks that no secret or production mutation occurred.
- No push, deploy, DNS, hosted migration, hosted function publish or final PAINEL_TOKEN
  rotation is authorized by this checklist; those remain after all tasks.

## Evidência local — 15/09/2026

- [x] S2/C3–C6: harness local R1-07 → PASS, 15 assertions. O comando foi executado sobre banco local recém-recriado; ele é intencionalmente idempotente e a falha injetada preservou o snapshot anterior.
- [x] C4/C5 de fonte: Vitest de pipeline examples → PASS (2 testes), comparando 5 fases/27 itens/17 concluídos e os materiais Hello Best.
- [x] C1/C2 na ficha: Testing Library → PASS (2 testes novos em `adminDashboard.test.tsx`), cobrindo confirmação em duas etapas, chamada exclusiva da porta Skill 01, convite copiável em memória e apresentação de `invalidFields`.
- [x] Regressão local fresca: reset/replay e pgTAP completo → PASS (294 testes); Vitest completo → PASS (89 testes); lint, TypeScript, build e E2E R1-05 desktop/mobile → PASS.
- [ ] C7–C12: a jornada integrada A/C em Playwright, com fixture Auth local e screenshots estáveis, não foi criada nesta onda. Não é inferida pelos testes de seed, Skill 01 ou pela regressão R1-05.
