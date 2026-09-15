# F2-09 · Versões — checklist de implementação

## Profile

`standard` — esta task combina uma máquina de estados persistida, uma Edge Function
autenticada, idempotência, RLS de leitura e duas superfícies React. Não existe uma fonte de
design nova e vinculante para alterar o shell aprovado em R1-05; por isso `ui` não é imposto
como perfil adicional. `Coverage`, `Test policy`, provas de fronteira e uma verificação final
independente continuam obrigatórios.

## Sources

- `.tasks/f2-09-versoes.md` — **binding**: fonte normativa dos critérios 1–15, estados,
  shape de `project_versions`, API de publicação, defaults dos seis `Unresolved` (já
  escritos na própria task), Swept e limites de escopo.
- `.tasks/no-sistema-operacional.md` — grafo de dependências, ondas, regra de contratos
  compartilhados e proibição de push/deploy/DNS/migração hospedada antes do fechamento.
- `.design/no-sistema-operacional.md` — Journey do cliente convertido, módulos, estados,
  decisões de Atividade e o RFC do Editor que permanece paralelo e fora desta task.
- `fluxos_ref/plan_master.md` §5.3, §6 módulo 05, §7.2, §10 Skills 02 e 04, §15 Aceites 04,
  09 e 11, §16 Cenário B e §19 — macroversões, histórico, desbloqueio e linha V1→V2→V3.
- `fluxos_ref/NO_OPERATING_DESIGN_SYSTEM_v1.md` §6, §10, §14 Skills 02 e 04, §17.6,
  §19, §24 e Aceite 09 — referência operacional e copy do módulo Versões.
- `.tasks/r1-05-dashboard-cliente.md` e `.checks/r1-05-dashboard-cliente.verified.md` —
  contrato do shell CLIENT, rota `/p/:projectId/versoes`, estados bloqueado/expirado,
  `loadClientDashboard`, navegação mobile e layout que será estendido.
- `.tasks/r1-06-dashboard-no.md` e `.checks/r1-06-dashboard-no.md` — contrato do shell
  `NO_ADMIN`, ficha, Atividade, `project_status`, `request_id`, RPC/Edge de transição e
  autorização que a publicação consumirá.
- `supabase/migrations/20260915180826_r1_01_tenant_auth_rls.sql` — enums, `projects`,
  `modules`, `activity_events`, `can_read_project`, trigger compartilhado e RLS; esse
  contrato não pode ser alterado sem reabrir R1-01.
- `supabase/migrations/20260915203000_r1_04_skill_01_access.sql` — escritor transacional
  dos módulos iniciais e a forma como `modules.editor`/`modules.versoes` são liberados.
- `supabase/migrations/20260915214008_r1_06_dashboard_no.sql`,
  `supabase/functions/project-status-transition/index.ts` e
  `app/src/admin-dashboard/admin-dashboard-service.ts` — transição administrativa existente,
  autorização e padrão de RPC/Edge a estender, sem duplicar uma fronteira de estado.
- `app/src/App.tsx`, `app/src/client-dashboard/*`, `app/src/admin-dashboard/*`,
  `app/src/clientDashboard.test.tsx`, `app/src/adminDashboard.test.tsx`,
  `app/playwright.config.ts` e `app/package.json` — assembly, serviços, testes e comandos
  reais do app.
- `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/logger.ts` e
  `supabase/tests/r1_03_edge_functions.ps1` — padrão local para CORS, log seguro e harness
  HTTP com JWT; logs não podem carregar changelog, build reference ou segredo por acidente.

## Dependency gate

O build desta task só começa com provas frescas no mesmo HEAD de R1-05 e R1-06. Em particular,
R1-06 deve ter a ficha administrativa, `project-status-transition`, Atividade e sua verificação
independente aprovadas. Se o merge ainda não tiver `.checks/r1-06-dashboard-no.verified.md`,
isto é bloqueio de dependência do orquestrador, não uma autorização para reimplementar o shell.

Os enums de `project_status`, `projects.modules`, `can_read_project`, `activity_events` e os
triggers de R1-01 permanecem contratos compartilhados. A nova migration só cria a tabela de
versões e seus índices/policies, e a publicação deve suspender o trigger com `app.skip_activity`
durante a mutação e escrever o evento de domínio uma única vez. Não remover, recriar ou alterar
o trigger da R1-01.

## Out of scope

- Fazer deploy da build de cliente, publicar a build referenciada, atualizar Kanban
  automaticamente ou carregar configuração do Control Panel — a referência é apenas texto;
  o Kanban continua sendo movido pela Nó, conforme Unresolved 4.
- Editor, componentes editáveis, exports, pacote `.md`/`.CFG`/`.css`, checklist e ingestão —
  F2-10 e RFC do Editor.
- Cronograma geral/capacidade — F3-12; saldos/gateway — F3-11; arquivamento — F4-13.
- Criar usuários, memberships ou conteúdo de roadmap — R1-04/R1-07.
- Alterar enums, `roadmaps`, `can_read_project`, RLS de R1-01 ou a semântica do shell R1-05.
- Push, deploy, DNS, migration remota, publicação de Edge Function hospedada e rotação final
  do `PAINEL_TOKEN` antes do fechamento de todas as tasks.

## Landing

Esta mudança acrescenta a entidade histórica `project_versions`, um escritor transacional de
publicação consumido pelo `NO_ADMIN` e a projeção do módulo 05 no shell CLIENT já entregue. A
leitura continua direta com RLS; o app não recebe escrita direta em `projects`, `modules` ou
`project_versions`.

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| Histórico de versões | `public.project_versions (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, label text not null, macro text not null check (macro in ('V1','V2','V3')), status text not null, published_at timestamptz not null, changelog text not null, build_reference text not null, is_current boolean not null default false, request_id text unique, created_at timestamptz not null default now())`; `unique (project_id, label)` e índice único parcial `(project_id) where is_current`; RLS permite SELECT somente por `can_read_project(project_id, 'versoes')`/`NO_ADMIN`, sem UPDATE/DELETE para o cliente | número incremental sem macro — não representa `V1.1`/`V1.2`; tabela sem índice parcial — duas publicações concorrentes poderiam ficar atuais |
| Publicação é uma operação atômica | `POST /functions/v1/project-publish-version` autentica `NO_ADMIN`, valida `{projectId,label,macro,changelog,buildReference,requestId}`, chama uma RPC SECURITY DEFINER transacional e devolve `{versionId,projectStatus}`; a mesma transação desmarca a versão atual, insere a nova, muda o estado, libera `editor`/`versoes` na V1 e grava um único `activity_events` | UPDATE/INSERTs separados pelo browser — permitiriam versão sem estado/módulos/evento; uma função por macro — duplica autenticação, retry e a regra de histórico |

As transições manuais reutilizam a fronteira existente `POST /functions/v1/project-status-transition`
(`projectId,target,requestId`, respostas 200/403/409/422), estendida com as arestas desta task;
isso não é uma nova porta: é uma extensão reversível do contrato R1-06. Nada mais nesta mudança
é difícil de reverter.

O status textual de `project_versions.status` permanece dado de apresentação da publicação:
não se cria um enum novo nem se inventa um vocabulário não decidido pela task. A prova exige
status não vazio e estabilidade histórica; `is_current` é a única fonte de verdade para a marca
“versão atual”.

## Test policy (proposed — o repo não declara alocação por forma de código)

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Migration/RPC que decide criação, transição, current, imutabilidade ou idempotência | pgTAP no próprio banco; mais prova de fronteira quando chamada por HTTP | cada estado/edge/ator/retry enumerado em `Coverage`; snapshot antes/depois para 409 e replay |
| `project-publish-version` | harness HTTP local com JWT `NO_ADMIN`/`CLIENT` e PostgREST local | 200, 403, 409, validação, falha segura, payload de resposta e zero delta |
| `project-status-transition` estendido | harness HTTP local + pgTAP da tabela de estados | todas as cinco transições novas, a transição já entregue `CONVERTIDO→AGENDADO`, e todos os estados inválidos |
| projeção/ordenação em serviços React | Vitest no próprio serviço | ordem recente→antiga, empate, intermediária, uma atual, changelog/data/reference preservados e campos ausentes |
| telas CLIENT/NO_ADMIN e confirmação | Testing Library DOM | bloqueado→ativo, histórico, confirmação em duas etapas, erro 409, loading/erro/empty e labels/foco |
| jornada completa | Playwright local em 1440×900 e 375×812 | C1–C14, navegação, HTTP inesperado ≥500, `console.error`, `pageerror` e isolamento de papel |
| adapters pass-through | sem teste isolado | exercitados pela fronteira consumidora mais próxima |

Evidence: `record_activity_event()` e `app.skip_activity` são a decisão compartilhada de
auditoria; R1-03/R1-04 fornecem o padrão de RPC transacional, retry e harness de Edge; R1-05
fornece o shell e DOM do CLIENT; R1-06 fornece a fronteira de transição e o shell administrativo.
Não existe regra de alocação por input space no `AGENTS.md`; estas linhas são o piso desta task e
não alteram as guidelines sem aprovação separada.

Cost: uma migration/RPC + um harness HTTP de publicação/transições + um arquivo pgTAP + testes
DOM de cliente/admin + um spec Playwright. Sem as provas próprias de decisão, um E2E poderia
atravessar só V1 e deixar V2/V3, retry ou estados inválidos sem cobertura.

## Checks

### S1 — Skill 02: estado e publicação da V1 · ~72 kB de leitura · ~18k tokens de piso

- [ ] **C1 — AGENDADO avança para V1_EM_DESENVOLVIMENTO uma única vez e audita a mudança.** A
  ficha do `NO_ADMIN` mostra o estado novo e Atividade recebe exatamente um evento atribuído ao
  ator/projeto; um retry com novo `requestId` não pode gerar uma segunda mudança para o mesmo
  estado.
  Proof: `supabase test db supabase/tests/f2_09_versoes.test.sql` — grupo `C1 AGENDADO to V1 development`; `npm test -- --run src/versionDashboard.test.tsx -t "C1 V1 development status"`.

- [ ] **C2 — publicar V1 cria o agregado liberador completo.** Com o projeto em
  `V1_EM_DESENVOLVIMENTO`, a fronteira retorna 200 com `versionId` e `projectStatus`, cria uma
  versão `label = 'V1'`, `macro = 'V1'`, data/changelog/reference não vazios e `is_current = true`,
  muda `project_status` para `V1_PUBLICADA`, ativa `modules.editor` e `modules.versoes` e grava
  exatamente um evento de Atividade.
  Proof: `pwsh -NoProfile -File supabase/tests/f2_09_versoes.ps1 -Scenario C2`; `supabase test db supabase/tests/f2_09_versoes.test.sql` — grupo `C2 V1 publication aggregate`.

- [ ] **C3 — publicação fora de V1_EM_DESENVOLVIMENTO é 409 e tem delta zero.** A função rejeita
  cada estado não permitido para V1, incluindo `AGENDADO`, `V1_PUBLICADA`, `V2_EM_DESENVOLVIMENTO`,
  `V2_PUBLICADA`, `V3_GO_LIVE` e `CONCLUIDO`; projeto, módulos, versões e Atividade permanecem
  idênticos ao snapshot anterior.
  Proof: `pwsh -NoProfile -File supabase/tests/f2_09_versoes.ps1 -Scenario C3`; `supabase test db supabase/tests/f2_09_versoes.test.sql` — grupo table-driven `C3 invalid V1 origins are 409/no delta`.

- [ ] **C4 — V1 publicada desbloqueia a leitura CLIENT do módulo 05 e remove o bloqueio do 04.**
  Com membership CLIENT do próprio tenant, `/p/:projectId/versoes` mostra V1 com label, data,
  status, changelog e marca atual; a navegação deixa de renderizar o copy bloqueado do Editor.
  Antes da publicação, RLS/módulos ainda expõem o estado bloqueado e não a versão.
  Proof: `supabase test db supabase/tests/f2_09_versoes.test.sql` — grupo `C4 client RLS unlocks versions after V1`; `npm test -- --run src/clientDashboard.test.tsx -t "C4 Versões desbloqueia após V1"`; `npm run test:e2e -- e2e/f2-09-versoes.spec.ts --grep "C4"`.

### S2 — Skill 04: intermediárias, V2, V3 e conclusão · ~84 kB de leitura · ~21k tokens de piso

- [ ] **C5 — publicar intermediária preserva V1 e troca somente a atual.** Depois da V1, uma
  publicação `V1.1`/`V1.2` grava uma linha nova com `macro = 'V1'`, marca-a atual, deixa V1
  listada com sua data/changelog/reference originais e gera exatamente um evento.
  Proof: `pwsh -NoProfile -File supabase/tests/f2_09_versoes.ps1 -Scenario C5`; `supabase test db supabase/tests/f2_09_versoes.test.sql` — grupo `C5 intermediate publication preserves V1`.

- [ ] **C6 — publicar V2 muda o marco para V2_PUBLICADA sem apagar histórico.** Em
  `V2_EM_DESENVOLVIMENTO`, a resposta 200 e a leitura seguinte mostram V2 atual,
  `project_status = 'V2_PUBLICADA'`, V1 e cada intermediária listadas sem alteração.
  Proof: `pwsh -NoProfile -File supabase/tests/f2_09_versoes.ps1 -Scenario C6`; `supabase test db supabase/tests/f2_09_versoes.test.sql` — grupo `C6 V2 publication preserves history`.

- [ ] **C7 — publicar V3 exige V2_PUBLICADA e cria o go-live atual.** Em `V2_PUBLICADA`, a
  publicação V3 retorna 200, grava `macro = 'V3'`, `is_current = true` e muda
  `project_status = 'V3_GO_LIVE'`; pedir V3 antes de V2 retorna 409 e não cria linha.
  Proof: `pwsh -NoProfile -File supabase/tests/f2_09_versoes.ps1 -Scenario C7`; `supabase test db supabase/tests/f2_09_versoes.test.sql` — grupo table-driven `C7 V3 gate and go-live`.

- [ ] **C8 — a concorrência nunca deixa duas versões atuais.** Publicações distintas e simultâneas
  para o mesmo projeto terminam com no máximo uma linha `is_current = true`; cada linha gravada
  conserva seus dados completos e a serialização não corrompe o histórico.
  Proof: `supabase test db supabase/tests/f2_09_versoes.test.sql` — grupo `C8 partial unique current index under concurrent publish`; `pwsh -NoProfile -File supabase/tests/f2_09_versoes.ps1 -Scenario C8`.

- [ ] **C9 — publicação é append-only para campos históricos.** Nenhuma publicação, troca de
  atual ou repetição altera `changelog`, `published_at` ou `build_reference` de V1, intermediária
  ou V2 já gravada; tentativa de UPDATE direto pelo CLIENT e pelo `NO_ADMIN` fora da RPC não
  altera os campos protegidos.
  Proof: `supabase test db supabase/tests/f2_09_versoes.test.sql` — grupo `C9 historical fields are immutable`; `npm test -- --run src/versionDashboard.test.tsx -t "C9 histórico preserva changelog data e build"`.

- [ ] **C10 — somente V3_GO_LIVE pode concluir.** O `NO_ADMIN` confirma a ação em duas etapas;
  em `V3_GO_LIVE` a conclusão retorna 200, muda `project_status = 'CONCLUIDO'` e cria um evento.
  A mesma ação em cada outro estado de projeto retorna 409 sem mudar estado nem Atividade.
  Proof: `pwsh -NoProfile -File supabase/tests/f2_09_versoes.ps1 -Scenario C10`; `supabase test db supabase/tests/f2_09_versoes.test.sql` — grupo table-driven `C10 conclusion gate`; `npm test -- --run src/adminDashboard.test.tsx -t "C10 concluir exige confirmação"`.

### S3 — Transições manuais, módulo CLIENT, retry e gates · ~96 kB de leitura · ~24k tokens de piso

- [ ] **C11 — as três transições manuais permitidas avançam e toda transição fora do diagrama é
  409.** `V1_PUBLICADA → EM_REVISAO_CLIENTE`, `EM_REVISAO_CLIENTE → ALTERACOES_RECEBIDAS` e
  `ALTERACOES_RECEBIDAS → V2_EM_DESENVOLVIMENTO` atualizam a ficha e geram exatamente um evento
  cada; estados de origem/destino inválidos não mudam o projeto nem a Atividade.
  Proof: `pwsh -NoProfile -File supabase/tests/f2_09_versoes.ps1 -Scenario C11`; `supabase test db supabase/tests/f2_09_versoes.test.sql` — grupos `C11 accepted manual transitions` e `C11 rejected transition matrix`.

- [ ] **C12 — o módulo 05 lista a história da mais recente para a mais antiga.** O cliente vê
  cada versão com rótulo, data, estado, changelog e referência visual da atual; V1 e
  intermediárias permanecem abaixo de V2/V3 na ordem de `published_at`/criação, sem ação de
  escrita disponível.
  Proof: `npm test -- --run src/clientDashboard.test.tsx -t "C12 Versões ordena histórico e marca atual"`; `npm run test:e2e -- e2e/f2-09-versoes.spec.ts --grep "C12"`.

- [ ] **C13 — o mesmo `requestId` é idempotente para publicação.** Reenviar a mesma requisição
  devolve o resultado da primeira publicação, não cria segunda linha, não troca a atual, não
  altera o projeto e não grava segundo evento; um `requestId` igual com project/label/tipo
  incompatíveis retorna 409 sem delta.
  Proof: `pwsh -NoProfile -File supabase/tests/f2_09_versoes.ps1 -Scenario C13`; `supabase test db supabase/tests/f2_09_versoes.test.sql` — grupo `C13 publish retry is idempotent`.

- [ ] **C14 — CLIENT não pode publicar, concluir ou mudar estado.** As rotas administrativas
  mostram a tela de não autorizado; `project-publish-version` e `project-status-transition`
  retornam 403 para JWT CLIENT, sem inserir versão, evento ou alterar `project_status`/módulos.
  RLS também impede leitura de `project_versions` de outro tenant ou antes de `versoes` ativo.
  Proof: `pwsh -NoProfile -File supabase/tests/f2_09_versoes.ps1 -Scenario C14`; `supabase test db supabase/tests/f2_09_versoes.test.sql` — grupo `C14 client authorization and RLS`; `npm test -- --run src/App.test.tsx -t "CLIENT não acessa administração"`.

- [ ] **C15 — qualidade e regressão passam no mesmo HEAD.** Build, lint e TypeScript têm exit 0;
  provas de C1–C14 passam após reset local; E2E percorre o ciclo convertido nos viewports
  1440×900 e 375×812, com confirmação, foco/labels acessíveis, loading/erro, zero
  `console.error`/`pageerror` e nenhuma resposta inesperada ≥500.
  Proof: `npm run build`; `npm run lint`; `npx tsc -b --pretty false`; `npm test -- --run`; `supabase db reset --local`; `supabase test db`; `pwsh -NoProfile -File supabase/tests/f2_09_versoes.ps1`; `npm run test:e2e -- e2e/f2-09-versoes.spec.ts`.

## Swept

- **validation:** a função valida UUID, `label`, `macro ∈ {V1,V2,V3}`, changelog,
  buildReference e requestId; requests inválidos não alcançam a RPC nem alteram dados. A prova
  de boundary fica no cenário de validação do harness, sem inventar um novo contrato de erro fora
  do padrão Edge local.
- **failure modes:** C3 (V1 fora do estado), C7 (V3 fora do marco), C10 (conclusão fora de V3),
  C11 (transição inválida), C14 (papel/RLS) e C15 (rede, console e HTTP ≥500).
- **idempotency and retry:** C8 cobre concorrência; C13 cobre retry por `requestId`; conflito de
  request id é distinto de uma nova tentativa legítima com id diferente.
- **authorization:** somente `NO_ADMIN` chama os writers; `CLIENT` recebe 403 nas duas
  fronteiras e lê apenas `versoes` de projeto próprio quando o módulo está ativo.
- **concurrency and ordering:** índice parcial garante uma atual; lock transacional ordena a
  troca; cliente ordena por data de publicação decrescente, com criação como desempate.
- **data lifecycle:** linhas de `project_versions` são append-only nos três campos históricos;
  conclusão preserva todo o histórico; nenhum delete/UPDATE destrutivo faz parte desta task.
- **external-dependency failure:** não há serviço externo; referência de build é texto e não é
  publicada pela função. Falha de leitura do módulo mantém o estado `dash-state` do shell e a
  ação de retry não duplica publicação.
- **state transitions:** C1/C2, C5–C7, C10 e C11 cobrem as arestas permitidas; matrizes dos
  cenários C3/C7/C10/C11 cobrem rejeições sem delta.
- **observability:** toda publicação, transição e conclusão gera `activity_events` com ator,
  projeto, tipo, instante e request id; falhas registram somente `projectId`, `label`/código,
  sem changelog, build reference, token ou segredo.

## Coverage

| Enumerated set | Member → proof | Unproven |
|---|---|---|
| estados de projeto existentes (11) | `CONVERTIDO`, `AGENDADO`, `V1_EM_DESENVOLVIMENTO`, `V1_PUBLICADA`, `EM_REVISAO_CLIENTE`, `ALTERACOES_RECEBIDAS`, `V2_EM_DESENVOLVIMENTO`, `V2_PUBLICADA`, `V3_GO_LIVE`, `CONCLUIDO`, `ARQUIVADO` → C3, C7, C10, C11 table-driven | - |
| arestas novas permitidas (8) | AGENDADO→V1_DEV C1 · V1_DEV→V1_PUBLICADA C2 · V1_PUBLICADA→REVISÃO C11 · REVISÃO→ALTERAÇÕES C11 · ALTERAÇÕES→V2_DEV C11 · V2_DEV→V2_PUBLICADA C6 · V2_PUBLICADA→V3_GO_LIVE C7 · V3_GO_LIVE→CONCLUIDO C10 | - |
| aresta já entregue (1) | CONVERTIDO→AGENDADO C15 regressão/R1-06 e C14 do checklist R1-06 | - |
| macros publicáveis (3) | V1 C2 · V2 C6 · V3 C7 | - |
| labels de intermediárias (2 exemplos normativos) | V1.1 C5 · V1.2 C5; a tabela aceita qualquer próximo índice da macro vigente sem criar macro nova | - |
| campos históricos imutáveis (3) | `changelog`, `published_at`, `build_reference` C9 | - |
| superfícies de escrita (2) | `project-publish-version` C2/C3/C5–C8/C13/C14 · `project-status-transition` C1/C10/C11/C14 | - |
| atores (2) | `NO_ADMIN` sucesso C1–C13 · `CLIENT` 403/RLS C4/C14 | - |
| papéis de versão (2) | atual `is_current=true` C2/C5–C8/C12 · histórico `is_current=false` C5/C6/C7/C9/C12 | - |
| viewports (2) | 1440×900 C4/C10/C12/C15 · 375×812 C4/C10/C12/C15 | - |
| status HTTP exigidos (3) | 200 C2/C5–C7/C10 · 403 C14 · 409 C3/C7/C10/C11/C13 | - |

Claims that name an HTTP status, route, response shape or RLS visibility — C2, C3, C5, C6, C7,
C10, C11, C13 and C14 — each have at least one proof that crosses the boundary. No check relies
only on a DOM test for a persisted decision.

## Handoff

- Esta task cabe em um batch funcional: S1 ≈18k + S2 ≈21k + S3 ≈24k tokens de piso, cerca de
  63k antes da iteração; a fronteira natural é a superfície, mas não há necessidade de handoff
  entre slices enquanto o contexto permanecer dentro de 150k.
- Ordem segura: (A) migration/RPC + pgTAP e harness de publicação/transições; (B) serviços e
  módulo CLIENT/NO_ADMIN; (C) confirmação, E2E de ciclo convertido e regressão completa.
- Não resolver RFC do Editor, formato de exports, atualização automática do Kanban ou
  arquivamento aqui. O builder deve preservar os seis defaults escritos na task e não transformar
  referência de build em deploy.
- O Verifier fresco recebe esta checklist e o diff completo depois do último commit, reexecuta
  reset/replay local e presta contas do denominador C1–C15; não usa o ambiente hospedado.

## Evidência local — 15/09/2026

- [x] C1–C3, C5–C7, C10–C11, C13–C14 de fronteira: harness F2-09 → PASS, 17 assertions.
- [x] Banco/RLS/histórico: após reset local, suíte pgTAP completa → PASS, 288 testes (inclui f2_09_versoes.test.sql).
- [x] Assembly local: lint, TypeScript, Vitest e build passaram.
- [ ] C4/C12/C15 de browser do novo ciclo de versões: a projeção CLIENT e os controles da ficha foram adicionados, mas ainda falta spec Playwright próprio e uma verificação fresca independente do ciclo completo.
