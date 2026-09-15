# R1-06 · Dashboard da Nó — checklist de implementação

## Profile

`standard`

O perfil `standard` é o piso adotado nesta task porque ela combina tabelas de decisão,
transições persistidas, autorização e uma superfície React extensa. O projeto não declara
um perfil em `AGENTS.md`; esta escolha segue o padrão já usado na R1-03 e torna `Coverage`,
`Test policy` e fault injection obrigatórios na verificação.

## Sources

- `.tasks/r1-06-dashboard-no.md` — **binding**: fonte normativa dos critérios 1–22,
  estados, contrato `project-convert`, única porta de mão única e defaults dos oito itens
  `Unresolved` aprovados no loop atual.
- `.design/no-sistema-operacional.md` — **binding**: Journey 3 e 7, Boundary, Shape,
  Roadmap “Dashboard da Nó”, decisão append-only de Atividade e Open 2, 3, 4 e 8.
- `fluxos_ref/plan_master.md` — **binding**: §5.3, §7.2, §7.4, §13, §15 Aceites 04 e 06,
  §16 Cenário B e §19. A pasta real é `fluxos_ref`, não o caminho histórico `fluxos\_ref`.
- `C:/Users/lucca/projetos/roteador/roteador-consultadecasa/src/pages/Admin.tsx` — referência
  de família visual e interação: shell, toolbar, chips com `aria-pressed`, vazio de base
  distinto de vazio filtrado, confirmação em duas etapas e paginação de 20 itens.
- `brand/BRAND.md` e `brand/tokens/tokens.css` — identidade v2 obrigatória; Sora,
  JetBrains Mono, barra de quatro cores, cards com acento e tokens oficiais.
- `app/src/App.tsx`, `app/src/components/BrandShell.tsx`, `app/src/auth/RoleRoute.tsx`,
  `app/src/projects/project-service.ts` e `app/src/styles.css` — rotas, guard, acesso Supabase
  e shell atuais que serão estendidos sem duplicar auth.
- `supabase/migrations/20260915180826_r1_01_tenant_auth_rls.sql` — schema e RLS existentes,
  trigger compartilhado `record_activity_event()` e contrato `app.skip_activity`.
- `supabase/migrations/20260915192748_r1_03_checkout_roadmap.sql` — nascimento de projeto,
  `payments`, vínculo por `project_id` e evento explícito do pagamento.
- `supabase/functions/_shared/logger.ts` e `supabase/config.toml` — padrão de log seguro e
  registro/validação JWT das Edge Functions.
- `app/package.json`, `app/vite.config.ts`, `app/README.md`, `supabase/tests/*.sql` e
  `supabase/tests/r1_03_edge_functions.ps1` — comandos e estilos de prova existentes.

## Out of scope

- Botão “Liberar dashboard”/Skill 01 — R1-07.
- Cronograma unificado, capacidade e replanejamento automático — F3-12.
- Saldos, parcelas do gateway e projeções financeiras — F3-11; aqui os termos são manuais.
- Versões, Editor, exports e publicação — F2-09/F2-10.
- Arquivamento funcional — F4-13; esta task somente lê/filtra o estado `ARQUIVADO` já previsto.
- Filtro por versão, inexistente antes de F2-09.
- Automação de WhatsApp, comunicação externa e qualquer serviço além do Supabase.
- Push, deploy, DNS, migration remota e Edge Function em produção até todas as tasks terminarem.
- Alterar enums, `can_read_project`, a forma de `roadmaps` ou os demais contratos compartilhados
  da R1-01.

## Precision gates before Build

O checklist é executável, mas o lote de backend não deve começar enquanto estas três divergências
de governança não forem resolvidas pelo orquestrador:

1. `.tasks/no-sistema-operacional.md` diz que o trigger de Atividade da R1-01 “não muda sem
   reabrir R1-01”; a R1-06 exige que esse mesmo trigger passe a sustentar exatamente um evento
   por ação e retry por `request_id`. A implementação precisa de uma reabertura explícita da R1-01
   ou de um novo escritor transacional que preserve o trigger intacto.
2. O binding source exige E2E Playwright em 1440 px e 375 px, mas `app/package.json` não possui
   Playwright nem `test:e2e`. A adição de `@playwright/test`, do script `test:e2e` e da configuração
   local precisa entrar como porta de dependência antes de C22 ter uma prova executável.
3. C14 e C20 exigem respostas HTTP 409/403 para mudança de `project_status`, mas a tabela `Surface`
   define somente `POST /functions/v1/project-convert`; falta decidir se a mutação de estado ganha
   uma segunda Edge Function ou amplia um contrato existente. O checklist não inventa essa rota.

Três escolhas reversíveis ficam fixadas para tornar os critérios testáveis, sem criar schema novo:

- estado do card = `project_status` quando não nulo; caso contrário `lead_status`;
- “ativo” = `project_status` nulo ou diferente de `CONCLUIDO`/`ARQUIVADO`; convertido =
  `lead_status = CONVERTIDO`; concluído/arquivado usam os respectivos valores de `project_status`;
- próxima data = menor `scheduled_date` entre itens não concluídos; sem data fica no fim. Prazo usa
  `atrasado`, `hoje`, `proximos_7_dias` e `sem_data`. Situação de pagamento usa o valor manual de
  `commercial_terms.financial_status`; na ausência dele, o `payments.status` mais recente; sem
  ambos, `sem_registro`.

## Landing

Esta mudança substitui os placeholders de `/no/projetos` por três superfícies no shell
autenticado existente: lista de projetos, ficha/Kanban e Atividade. Reutiliza RLS, projetos,
roadmaps, itens, pagamentos e o trigger de auditoria já presentes; não cria uma segunda entidade
de cliente, projeto ou evento.

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| Termos comerciais por projeto | `public.commercial_terms (project_id uuid primary key references public.projects, tier public.tier not null, amount_cents int not null, payment_method text not null, installments int not null check (installments >= 1), deadline_days int not null, starts_on date null, financial_status text null, notes text null, updated_at timestamptz not null default now(), updated_by uuid references auth.users)`; RLS restringe leitura/escrita a `NO_ADMIN` | colunas avulsas em `projects` — Saldos precisa consumir os termos como uma unidade e a task rejeita esse formato |
| Dependência de E2E | `@playwright/test` versionado no `app`, `playwright.config.ts`, script `test:e2e` e Chromium local; servidor Vite e Supabase locais, nunca hospedados | chamar Vitest/jsdom de E2E — não atravessa navegador, viewport, rede nem console real e não prova C22 |
| Idempotência administrativa | o primeiro `request_id` aplica a ação e grava um evento; repetição do mesmo id devolve o resultado já aplicado sem nova mutação/evento; uma nova solicitação contra projeto já convertido continua 409 | testar só a unicidade isolada de `activity_events.request_id` — o estado poderia ser aplicado duas vezes antes do conflito no evento |

Defaults herdados dos oito itens `Unresolved`: cards por próxima data ascendente e sem data no fim;
conversão com “Converter” → “Confirmar”; Kanban por `position`, depois `scheduled_date`; vazio do
Kanban inclui criar item; dois projetos do mesmo cliente geram dois cards; última escrita vence e
cada escrita audita; falha de conversão gera log estruturado apenas com `projectId`; nicho nasce em
`projects.niche` e, para R1-03, vem da resposta `negocio`.

O detalhamento da ficha é uma projeção, sem novas colunas além de `commercial_terms`: cliente e
empresa vêm de `leads.nome`/`clients.name`, contato de `clients.email` e `leads.whatsapp`, origem de
`leads.utm_source`/`referrer`, entrada de `projects.created_at`, diagnóstico de `roadmaps.answers`,
`references` e demais JSON existentes, execução dos estados do projeto + termos + próximo item, e
links de `prototype_url`/rota autenticada. Campos sem dado mostram `—`, não inventam valor.

## Test policy (proposed — the repo does not declare allocation by code shape)

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Migration/RPC that decides filtering, transition, audit or idempotency | pgTAP at its own layer; plus boundary proof when called by HTTP | one asserted case per status, edge, actor and retry member named in Coverage |
| `project-convert` entry point | local Edge Function harness with real JWT and local PostgREST | accepted request, each missing-field shape, CLIENT 403, converted 409, expired conversion, replay and structured failure log |
| React services that decide projection/filter/order/timezone | Vitest at their own layer | every filter dimension, every ordering edge, all seven views and São Paulo day boundaries |
| React screens and interactions | Testing Library DOM integration | controls, labels, grouping, two-step confirmation, empty/loading/error/unauthorized and persisted reread |
| Full admin journey | Playwright against Vite + Supabase local | C1–C21 at 1440×900 and 375×812, network statuses and zero unexpected console errors |
| Pure pass-through adapters | no isolated test | exercised by the closest consumer boundary proof |

Evidence: `record_activity_event()` has decisions for insert/update, project/item and bypass;
`apply_roadmap_payment_event()` plus the R1-03 harness is the nearest transactional/idempotent
analogue; `App.test.tsx` is precedent for route/role DOM assertions. The current repo has no rule
allocating tests by input space, so these rows are the bar only for R1-06 and do not modify
`AGENTS.md` without separate explicit approval.

Cost: one pgTAP file, one local function harness, one DOM/service test file and one Playwright
spec/config. Without the own-layer rows, E2E would traverse but not enumerate the transition,
filter and timezone tables.

## Checks

### S1 — Projetos e ficha · ~103 kB floor

- [x] **C1 — um projeto criado aparece na leitura seguinte como um card completo e ordenado.**
  A lista refaz a consulta após criação e mostra cliente, nicho, `project_status` ou fallback
  `lead_status`, tier e a menor `scheduled_date` não concluída; cards ordenam essa data crescente,
  com empate por `created_at` decrescente e sem data no fim.
  Proof: `npm test -- --run src/adminDashboard.test.tsx -t "C1 project cards refresh fields and order"`.
- [x] **C2 — a lista oferece nove dimensões de recorte e busca nos três nomes.** Nicho, estado,
  tier, prazo (`atrasado|hoje|proximos_7_dias|sem_data`), situação de pagamento, convertido/não
  convertido e ativo/concluído/arquivado filtram fixtures distinguíveis; a busca casa
  `clients.name`, empresa e `projects.name`. Resultado zero por filtro mostra “Nenhum projeto para
  os filtros selecionados.”, distinto de “Nenhum projeto cadastrado ainda.”
  Proof: `npm test -- --run src/adminDashboard.test.tsx -t "C2 project filters search and distinct empty state"`.
- [x] **C3 — a ficha mostra os cinco grupos e todos os campos normativos.** Identificação contém
  cliente, empresa, contato, nicho, origem e entrada; diagnóstico contém exatamente cinco respostas,
  referências, materiais e observações; comercial contém tier, valor em centavos formatado em BRL,
  forma, parcelas, datas e status financeiro; execução contém início, prazo, fase, versão, próxima
  entrega, dashboard, links técnicos e observações internas; entregáveis contém roadmap e protótipo.
  Ausência persistida rende `—` ou estado vazio explícito.
  Proof: `npm test -- --run src/adminDashboard.test.tsx -t "C3 project detail renders every normative group"`.
- [x] **C4 — salvar um único campo comercial persiste e audita antes/depois exatamente uma vez.**
  Após reload o valor é o novo; existe um evento atribuído ao admin/projeto com o nome literal do
  campo, valor anterior e valor novo, sem segundo evento de `updated_at`.
  Proof: `supabase test db supabase/tests/r1_06_dashboard_no.test.sql` — assertion group
  `C4 commercial edit persists one before-after event`; DOM complement:
  `npm test -- --run src/adminDashboard.test.tsx -t "C4 commercial edit reloads"`.
- [x] **C5 — somente as duas transições de lead desta rodada atualizam ficha e geram um evento.**
  `ROADMAP_PAGO → REFERENCIAS_PENDENTES` e `REFERENCIAS_PENDENTES → EM_PRODUCAO` são exercitadas
  separadamente, cada uma com delta de um evento atribuído.
  Proof: `supabase test db supabase/tests/r1_06_dashboard_no.test.sql` — table group
  `C5 lead transitions update and audit`.

### S2 — Kanban sincronizado · ~76 kB floor

- [x] **C6 — as seis ações do Kanban mudam a tela e gravam exatamente um evento cada.** Criar,
  mover coluna, concluir, reabrir, mudar `scheduled_date` e mudar `position` são executadas com seis
  `request_id` distintos; cada delta é um e cada evento contém `actor_id`, `project_id`, tipo e
  `occurred_at` não nulos.
  Proof: `supabase test db supabase/tests/r1_06_dashboard_no.test.sql` — table group
  `C6 six kanban actions emit one attributed event each`; DOM complement:
  `npm test -- --run src/adminDashboard.test.tsx -t "C6 kanban actions repaint"`.
- [x] **C7 — uma movimentação administrativa é visível ao cliente na leitura seguinte.** Depois de
  mudar a coluna como `NO_ADMIN`, uma leitura nova de `kanban_items` com JWT CLIENT do tenant retorna
  o mesmo item no status novo, sem escrita pelo cliente.
  Proof: `supabase test db supabase/tests/r1_06_dashboard_no.test.sql` — assertion group
  `C7 client sees admin kanban move on next read`.
- [x] **C8 — concluir e reabrir mantêm a dupla status/data consistente.** Concluir define
  `status=concluido` e `completed_at` não nulo; reabrir define `status=a_fazer` e `completed_at=null`.
  Proof: `supabase test db supabase/tests/r1_06_dashboard_no.test.sql` — assertion group
  `C8 completion and reopen synchronize completed_at`.

### S3 — Conversão e transições administrativas · ~91 kB floor

- [x] **C9 — converter uma janela válida aplica o agregado completo uma única vez.** Request com
  `projectId`, tier, `amountCents`, forma, parcelas, prazo e `requestId` retorna 200 com
  `{projectId, leadStatus:"CONVERTIDO", projectStatus:"CONVERTIDO", accessStatus:"ATIVO_ATE_FIM_DO_PROJETO"}`;
  persiste `commercial_terms`, `projects.tier`, ativa `modules.marca` e grava um evento.
  Proof: `pwsh -NoProfile -File supabase/tests/r1_06_dashboard_no.ps1 -Scenario C9`.
- [x] **C10 — projeto efetivamente expirado também converte e recupera acesso.** Com
  `project_access.effective_access_status=EXPIRADO`, a mesma chamada retorna 200 e produz exatamente
  o estado agregado de C9; CLIENT volta a ler o projeto.
  Proof: `pwsh -NoProfile -File supabase/tests/r1_06_dashboard_no.ps1 -Scenario C10`.
- [x] **C11 — cada campo obrigatório ausente retorna 422 e snapshot idêntico.** A tabela de casos
  omite, um por vez, `tier`, `amountCents`, `paymentMethod`, `installments` e `deadlineDays`; a resposta
  enumera o campo faltante e nenhum caso muda projeto, módulos, termos ou atividade.
  Proof: `pwsh -NoProfile -File supabase/tests/r1_06_dashboard_no.ps1 -Scenario C11`.
- [x] **C12 — nova conversão de projeto já convertido retorna 409 sem efeito.** Um `requestId` novo
  contra projeto `CONVERTIDO` retorna 409; snapshots de projeto, termos e atividade permanecem iguais.
  Proof: `pwsh -NoProfile -File supabase/tests/r1_06_dashboard_no.ps1 -Scenario C12`.
- [x] **C13 — ativação manual de Marca em não convertido é persistida e auditada uma vez.**
  `modules.marca` muda de `bloqueado` para `ativo`, demais cinco chaves ficam idênticas e um evento
  atribuído é criado.
  Proof: `supabase test db supabase/tests/r1_06_dashboard_no.test.sql` — assertion group
  `C13 manual brand activation changes one module and audits`.
- [x] **C14 — a única transição de projeto desta rodada é `CONVERTIDO → AGENDADO`.** Ela atualiza a
  ficha e gera um evento; cada outra origem/destino entre os 11 valores de `project_status` retorna
  409 e não muda estado nem atividade.
  Proof: `pwsh -NoProfile -File supabase/tests/r1_06_dashboard_no.ps1 -Scenario C14` plus pgTAP
  table group `C14 project transition table permits one edge`.

### S4 — Atividade, autorização e jornada · ~118 kB floor

- [x] **C15 — Atividade expõe exatamente sete visões.** Os controles aparecem nesta ordem: Hoje,
  Ontem, Pendências, Atrasados, Últimos 7 dias, Por projeto e Por evento; uma troca de visão atualiza
  a lista sem rota paralela.
  Proof: `npm test -- --run src/adminDashboard.test.tsx -t "C15 activity has seven ordered views"`.
- [x] **C16 — Hoje e Ontem usam dias civis de `America/Sao_Paulo`.** Casos em ambos os lados de
  meia-noite UTC/São Paulo entram no dia correto, e cada lista ordena `occurred_at` decrescente.
  Proof: `npm test -- --run src/adminDashboard.test.tsx -t "C16 Sao Paulo day windows and descending order"`.
- [x] **C17 — Pendências e Atrasados particionam itens abertos pela data local.** Pendências contém
  somente não concluídos com `scheduled_date` igual a hoje ou nula; Atrasados contém somente não
  concluídos com data anterior a hoje; futuro e concluído ficam fora de ambas.
  Proof: `npm test -- --run src/adminDashboard.test.tsx -t "C17 pending and overdue partitions"`.
- [x] **C18 — cada linha de evento identifica ator, projeto navegável, tipo e instante.** O ator é
  exibido por identificação segura/fallback de UUID, o projeto aponta a `/no/projetos/:projectId`,
  o tipo é legível e data/hora usa locale `pt-BR` em `America/Sao_Paulo`; listas paginam 20 por vez.
  Proof: `npm test -- --run src/adminDashboard.test.tsx -t "C18 activity row fields link and pagination"`.
- [x] **C19 — retry com o mesmo `request_id` conserva um único evento e um único efeito.** A segunda
  chamada repete o resultado da primeira; contagem de eventos e snapshot do agregado não mudam.
  Proof: `supabase test db supabase/tests/r1_06_dashboard_no.test.sql` — assertion group
  `C19 same request id is idempotent`; HTTP complement:
  `pwsh -NoProfile -File supabase/tests/r1_06_dashboard_no.ps1 -Scenario C19`.
- [x] **C20 — CLIENT não acessa nenhuma superfície administrativa.** As três rotas mostram a tela
  de não autorizado; chamadas de conversão e transição de estado retornam 403; snapshots de projeto,
  termos, Kanban e atividade não mudam.
  Proof: `npm test -- --run src/adminDashboard.test.tsx -t "C20 client is unauthorized on admin routes"`
  and `pwsh -NoProfile -File supabase/tests/r1_06_dashboard_no.ps1 -Scenario C20`.
- [x] **C21 — vazios de base são próprios de cada superfície.** Com zero projetos, Projetos mostra
  “Nenhum projeto cadastrado ainda.”; com zero eventos no dia, Hoje mostra “Nenhuma atividade hoje.”;
  ambos são distintos dos estados de loading, erro com “Tentar de novo” e filtro sem resultado.
  Proof: `npm test -- --run src/adminDashboard.test.tsx -t "C21 base empty states are distinct"`.
- [x] **C22 — gates e E2E completos passam em desktop e mobile.** Build, lint e `tsc -b` têm exit 0;
  Playwright percorre C1–C21 em 1440×900 e 375×812 contra Supabase local, inclui loading/vazio/erro/
  sucesso/não autorizado, confirma labels/foco por teclado e falha em qualquer `console.error`,
  `pageerror` ou resposta inesperada ≥500.
  Proof: `npm run build`, `npm run lint`, `npx tsc -b --pretty false`,
  `npm test -- --run`, `supabase db reset --local`, `supabase test db`,
  `pwsh -NoProfile -File supabase/tests/r1_06_dashboard_no.ps1` and
  `npm run test:e2e -- --grep "R1-06 C1-C21"`.

## Swept

- validation: C11 valida os cinco campos obrigatórios e os tipos decididos; C14 valida transição.
- failure modes: C11, C12, C14, C20, C21 e C22; falha de leitura mantém dados antigos fora da tela
  e oferece “Tentar de novo”.
- idempotency and retry: C19; C12 diferencia retry do mesmo `request_id` de uma nova conversão.
- authorization: C20 no browser e nas duas fronteiras de mutação; RLS existente continua como defesa.
- concurrency and ordering: última escrita vence para campos/itens; cada request distinto audita;
  mesma request não duplica (C6, C14, C19). Cards, Kanban e Atividade têm ordens totais declaradas.
- data lifecycle: C8 limpa `completed_at` ao reabrir; Atividade permanece append-only; esta task não
  arquiva nem remove projetos/eventos.
- external-dependency failure: não há serviço além do Supabase; erro de rede local está em C21/C22.
- state transitions: C5, C8, C9, C10, C12, C13 e C14.
- observability: C4–C6, C9, C13, C14, C18 e C19; falha de `project-convert` loga evento estruturado
  com `projectId` e código, nunca valores comerciais ou credenciais.

## Coverage

| Set (size) | Member → proof | Unproven |
| --- | --- | --- |
| campos do card (5) | cliente C1 · nicho C1 · estado com precedência C1 · tier C1 · próxima data C1 | - |
| dimensões de filtro (9) | nicho C2 · estado C2 · tier C2 · prazo C2 · pagamento C2 · conversão C2 · ativo C2 · concluído C2 · arquivado C2 | - |
| busca (3 campos) | cliente C2 · empresa C2 · projeto C2 | - |
| grupos da ficha (5) | identificação C3 · diagnóstico C3 · comercial C3/C4 · execução C3 · entregáveis C3 | - |
| ações Kanban (6) | criar C6 · mover C6/C7 · concluir C6/C8 · reabrir C6/C8 · data C6 · posição C6 | - |
| transições de lead (2) | `ROADMAP_PAGO→REFERENCIAS_PENDENTES` C5 · `REFERENCIAS_PENDENTES→EM_PRODUCAO` C5 | - |
| efeitos da conversão (6) | lead C9/C10 · project C9/C10 · acesso C9/C10 · marca C9/C10 · termos C9/C10 · atividade C9/C10 | - |
| campos obrigatórios (5) | tier C11 · valor C11 · forma C11 · parcelas C11 · prazo C11 | - |
| `project_status` (11 origens/destinos) | edge permitida C14 · todas as demais combinações table-driven em C14 | - |
| visões de Atividade (7) | Hoje C15/C16/C21 · Ontem C15/C16 · Pendências C15/C17 · Atrasados C15/C17 · Últimos 7 dias C15 · Por projeto C15 · Por evento C15 | - |
| campos do evento (4) | ator C6/C18 · projeto C6/C18 · tipo C6/C18 · data C6/C18 | - |
| papéis (2) | `NO_ADMIN` C1–C19 · `CLIENT` C7/C20 | - |
| estados de lista (5) | loading C22 · base vazia C21 · filtro vazio C2 · erro/retry C21/C22 · dados C1/C18 | - |
| viewports (2) | 1440×900 C22 · 375×812 C22 | - |
| startup assemblies (3) | Vite app C22 · Vitest DOM C1–C21 · Playwright webServer C22 | dependency gate above |

- Claims naming a status code, route or response shape: C9, C10, C11, C12, C14, C20 — each
  carries a real boundary proof in the local PowerShell harness and/or Playwright.
- No other check claims more members than its table-driven proof enumerates.

## Handoff

- Floor total lido nesta extração: ~254 kB em task/design/plan, referência Admin, app, migrations,
  functions e harness. Com iteração e arquivos novos, a feature não cabe no limite de 150 k tokens.
- **Batch A — S1 + S2 (~139 kB de contexto estimado):** migration aditiva, projeções de projeto,
  lista/ficha e Kanban, C1–C8. A fronteira é o fim da superfície compartilhada ficha/Kanban.
- **Batch B — S3 (~91 kB):** `commercial_terms`, transações e `project-convert`, C9–C14. Só começa
  depois de o orquestrador resolver a reabertura do trigger/contrato compartilhado.
- **Batch C — S4 (~118 kB):** Atividade, autorização cruzada, regressão e Playwright, C15–C22. Só
  começa depois de a dependência Playwright aterrissar e os contratos dos batches A/B estarem fixos.
- Cada batch encerra apenas com seus proofs verdes e commit convencional. O próximo builder lê este
  checklist e o diff já commitado; não recebe uma reconstrução narrativa.
- O orquestrador, nunca um builder, despacha um verificador fresco sobre `<feature-base>..HEAD` após
  o último commit funcional, com todos C1–C22, as fontes binding e fault injection em até cinco
  superfícies distintas.
- Nenhum batch autoriza reset enquanto outra task estiver verificando, nem qualquer ação remota.
