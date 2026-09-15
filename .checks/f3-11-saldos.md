# F3-11 · Saldos e sincronização financeira — checklist de implementação

## Profile

`standard`

O perfil `standard` é o piso para esta task porque ela combina uma máquina de estados
financeira, idempotência de webhook, projeção de datas em fuso local, autorização por papel,
uma nova tabela persistida e uma tela administrativa. Não há desenho visual vinculante com
composição suficiente para elevar a task ao perfil `ui`; a densidade, a ordem e os estados
abaixo continuam critérios funcionais da tela.

## Sources

- `.tasks/f3-11-saldos.md` — fonte normativa dos critérios 1–13, estados, `Out of scope`,
  `Decided` e dos seis `Unresolved`; os defaults escritos na própria task são provisórios e
  não liquidam as perguntas abertas.
- `fluxos_ref/plan_master.md` §7.3, §9, §15 Aceite 07 e §16 Cenário D — conteúdo de Saldos,
  estados financeiros, sincronização e roteiro obrigatório de webhook.
- `fluxos_ref/NO_OPERATING_DESIGN_SYSTEM_v1.md` §11 e §15 Automação B — centro financeiro,
  blocos Realizado/Pendente/Previsto e propagação para Projeto e Atividade.
- `.tasks/r1-03-checkout-roadmap.md` e `.checks/r1-03-checkout-roadmap.verified.md` — contrato
  entregue de `payments`, `payment_events`, confirmação por reconsulta, Basic auth, estados
  existentes, `gateway_order_id` e idempotência de eventos.
- `supabase/migrations/20260915192748_r1_03_checkout_roadmap.sql`,
  `supabase/functions/pagarme-webhook-no/index.ts` e
  `supabase/functions/_shared/pagarme.ts` — schema e fronteira real que serão estendidos;
  `gatewayStatus` continua a fonte de estado confirmado pelo gateway.
- `.tasks/r1-06-dashboard-no.md` e `.checks/r1-06-dashboard-no.md` — contrato de
  `commercial_terms`, `NO_ADMIN`, Atividade append-only, ficha do projeto e RPCs
  administrativas que Saldos consome.
- `supabase/migrations/20260915180826_r1_01_tenant_auth_rls.sql` — enums, projetos, itens,
  Atividade, RLS e contrato de `app.skip_activity` preservados pelas dependências.
- `C:/Users/lucca/projetos/roteador/roteador-consultadecasa/supabase/functions/pagarme-refund/index.ts`
  e `C:/Users/lucca/projetos/roteador/roteador-consultadecasa/src/pages/Admin.tsx` — referência
  aberta para semântica de reembolso idempotente, confirmação em duas etapas e estados de
  financeiro; não substitui as decisões desta task.

## Out of scope

- Cobrar execução pelo gateway — a execução permanece fora do gateway e é registrada à mão
  conforme o texto provisório da task; a pergunta `Unresolved 1` permanece marcada para revisão.
- Split, saldo da conta Pagar.me, transferências, receitas dos outros Roteadores, nota fiscal
  e conciliação bancária — fronteiras explicitamente fora desta task.
- Alterar o checkout, criar outro gateway ou alterar a máquina de estados já provada em R1-03
  além dos estados de reembolso/estorno exigidos aqui.
- Migração remota, credenciais de produção, push, deploy, DNS ou cadastro da conta Pagar.me;
  o Cenário D usa Supabase local e mock/sandbox.
- Backfill silencioso de `commercial_terms` antigos: sem datas, eles continuam provisoriamente
  previstos sem faixa 15/30/45 até preenchimento pelo `NO_ADMIN` (`Unresolved 6`).

## Landing

A feature adiciona `/no/saldos`, uma leitura financeira administrativa que combina pagamentos,
eventos, termos e parcelas, e estende a confirmação existente do webhook. Reutiliza o shell,
`RoleRoute`, RLS e Atividade do R1-06 e o adapter/reconsulta do R1-03; não cria uma segunda
entidade de pagamento nem mistura dados de outros projetos Supabase.

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| Parcelas manuais persistidas | `public.installments (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects, number integer not null, amount_cents integer not null, due_date date not null, received_at timestamptz null, unique (project_id, number))`; RLS e grants permitem somente leitura/mutação pela superfície `NO_ADMIN` definida no contrato | `jsonb` dentro de `commercial_terms` — não permite filtrar/ordenar por vencimento nem mover uma parcela entre blocos sem reescrever o termo inteiro |
| Estado financeiro do webhook | os estados confirmados `refunded` e `chargedback` são derivados exclusivamente da reconsulta do pedido; evento não confirmado fica no histórico sem mutar o pagamento; cada mutação financeira gera a atividade correspondente com `request_id` determinístico | confiar no tipo/payload do webhook para aprovar a transição — o contrato R1-03 exige reconsulta canônica e deixa o payload como envelope histórico |

Os `payments.status` já contêm `refunded` e `chargedback`; não se cria enum paralelo. Nada além
destas duas fronteiras persistidas/contratuais é difícil de reverter.

## Test policy (proposed — o repositório não declara alocação por nível)

Estas linhas são a régua desta feature e não alteram `AGENTS.md` nem outra guideline sem
autorização explícita separada.

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| RPCs/migration que decidem estado, agregação, parcelas, idempotência ou autorização | pgTAP no próprio nível **e** harness PowerShell atravessando PostgREST/Edge Function quando houver fronteira HTTP | cada estado, transição, papel, retry, janela de data e membro enumerado em `Coverage` |
| `pagarme-webhook-no` e sua normalização | harness local com servidor real da Edge Function e mock Pagar.me; as transições SQL permanecem provadas no pgTAP | evento válido, repetido, Basic inválido, reembolso, chargeback, fora de ordem e estado confirmado divergente |
| serviço de Saldos que classifica, soma, ordena e projeta datas | Vitest no próprio serviço **e** Testing Library DOM no consumidor | realizado/pendente/previsto, sinais, valor em centavos, ordem recente, São Paulo, 15/30/45 e parcela sem data |
| rota e ações da tela `/no/saldos` | Testing Library para estados/confirmação e Playwright real para rota, papel, reload e console | sucesso, vazio, loading, erro/retry, não autorizado, link de projeto e confirmação em duas etapas |
| adapters pass-through | prova do consumidor | nenhuma suíte própria se não houver branch, mapping ou validação |

Evidence:

- `supabase/migrations/20260915192748_r1_03_checkout_roadmap.sql` e
  `apply_roadmap_payment_event` já decidem autenticação indireta, reconsulta, estados e
  idempotência; R1-03 os prova no pgTAP e no `r1_03_edge_functions.ps1`.
- `supabase/functions/pagarme-webhook-no/index.ts` decide método, Basic auth, tipo/status,
  envelope seguro e resposta HTTP; o harness R1-03 é o precedente de fronteira real.
- `app/src/admin-dashboard/admin-dashboard-service.ts` é o precedente de RPC pass-through;
  F3-11 adiciona decisões novas para agregação, ordenação, classificação e timezone, portanto
  precisa de teste próprio antes da DOM.
- `app/src/App.test.tsx` e `app/src/adminDashboard.test.tsx` são os precedentes de guard/DOM;
  `app/package.json` já possui Vitest e Playwright locais.

Cost: uma suíte pgTAP, um harness local do webhook, um módulo de projeção com teste Vitest,
um teste DOM de Saldos e uma história Playwright em 1440×900 e 375×812. Sem essa soma, o
webhook e a classificação financeira seriam cobertos somente por um caminho de tela.

## Checks

### S1 — Tela, leitura e autorização · 5 arquivos/contratos · ~86 kB de piso · ~22k tokens

- [ ] **C1 — `/no/saldos` mostra os três blocos e as projeções normativas.** Realizado enumera
  aprovações, recebimentos, reembolsos e estornos; Pendente enumera tentativas não concluídas,
  parcelas pendentes e falhas; Previsto enumera parcelas futuras e soma projeções de 15, 30 e
  45 dias calculadas pelo dia civil de `America/Sao_Paulo`.
  Proof: `npm test -- --run src/saldos.test.tsx -t "C1 saldos mostra realizado pendente previsto e projecoes"` em `app/`;
  `npm test -- --run src/saldos-service.test.ts -t "C1 classifica tipos e janelas financeiras"` em `app/`.
- [ ] **C2 — cada movimento tem data, valor em reais, tipo, status e projeto navegável.** A
  ordem é a mais recente primeiro, o valor vem de centavos sem arredondamento incorreto, e o
  vínculo aponta para `/no/projetos/:projectId`.
  Proof: `npm test -- --run src/saldos.test.tsx -t "C2 movimento exibe campos valor tipo status e link"`;
  `npm test -- --run src/saldos-service.test.ts -t "C2 movimentos ordenam por data decrescente"`.
- [ ] **C3 — um único roadmap aprovado de 14990 centavos produz realizado de R$ 149,90.** A
  soma exclui parcelas e pagamentos de outros projetos e permanece idêntica após reload.
  Proof: `supabase test db supabase/tests/f3_11_saldos.test.sql --local` — grupo
  `C3 approved roadmap totals 14990 in realized`; DOM complementar:
  `npm test -- --run src/saldos.test.tsx -t "C3 roadmap aprovado mostra R$ 149,90"`.
- [ ] **C4 — zero movimentos mostra vazio próprio.** O estado vazio não aparece como erro nem
  loading e não apresenta total fictício.
  Proof: `npm test -- --run src/saldos.test.tsx -t "C4 zero movimentos mostra estado vazio"`.
- [ ] **C5 — CLIENT não acessa Saldos.** A rota mostra não autorizado e a leitura autenticada
  como `CLIENT` retorna zero linhas, sem expor `payments`, `payment_events`, `installments` ou
  termos de outro projeto.
  Proof: `npm test -- --run src/saldos.test.tsx -t "C5 client ve nao autorizado"`;
  `pwsh -NoProfile -File supabase/tests/f3_11_saldos.ps1 -Scenario C5` — resposta de API e
  snapshots de leitura do CLIENT.

### S2 — Gateway, reconsulta e idempotência · 4 arquivos/contratos · ~72 kB de piso · ~18k tokens

- [ ] **C6 — reembolso confirmado de pagamento aprovado é aplicado uma vez e propagado.** A
  reconsulta canônica leva `payments.status` a `refunded`; a entrega acrescenta exatamente uma
  linha em `payment_events`; o realizado diminui pelo valor reembolsado; a ficha do projeto
  mostra o reembolso; e Atividade ganha exatamente um evento novo atribuído ao projeto.
  Proof: `pwsh -NoProfile -File supabase/tests/f3_11_saldos.ps1 -Scenario C6` — status,
  delta de evento, valor agregado, ficha e Atividade pela API real;
  `npm test -- --run src/saldos.test.tsx -t "C6 reembolso aparece em saldos ficha e atividade"`.
- [ ] **C7 — chargeback confirmado de pagamento aprovado tem os mesmos efeitos.** A reconsulta
  leva o estado a `chargedback`, reduz o realizado pelo valor efetivamente devolvido/estornado,
  mantém a correlação do projeto e grava somente um evento de atividade para a entrega.
  Proof: `pwsh -NoProfile -File supabase/tests/f3_11_saldos.ps1 -Scenario C7`;
  `supabase test db supabase/tests/f3_11_saldos.test.sql --local` — grupo
  `C7 chargedback approved payment propagates once`.
- [ ] **C8 — repetir reembolso ou chargeback não altera contagens nem valores.** Reenviar o
  mesmo `gateway_event_id` retorna a resposta idempotente, não insere outro `payment_events`,
  não cria outra atividade e mantém o mesmo total realizado.
  Proof: `pwsh -NoProfile -File supabase/tests/f3_11_saldos.ps1 -Scenario C8`;
  `supabase test db supabase/tests/f3_11_saldos.test.sql --local` — grupo
  `C8 repeated refund and chargeback are no-ops`.
- [ ] **C9 — reembolso fora de ordem é registrado sem mutar e depois aplica o estado final.** Um
  reembolso recebido antes de aprovação cria o histórico, mantém o pagamento pendente e não
  cria projeto/atividade financeira; quando a aprovação posterior reconsulta o gateway e o
  estado devolvido é `refunded` (ou `chargedback` no caso correspondente), o pagamento assume
  esse estado final sem duplicar os efeitos.
  Proof: `pwsh -NoProfile -File supabase/tests/f3_11_saldos.ps1 -Scenario C9`;
  `supabase test db supabase/tests/f3_11_saldos.test.sql --local` — grupo
  `C9 refund before approval preserves history and applies final gateway state`.

### S3 — Parcelas manuais e gates · 4 arquivos/contratos · ~94 kB de piso · ~24k tokens

- [ ] **C10 — três parcelas de R$ 1.000,00 ocupam as faixas de 15, 30 e 45 dias.** Termos
  comerciais registrados pelo `NO_ADMIN` geram três linhas em `installments`, com valor, número
  e data persistidos; para `days_until_due` em `1..15`, `16..30` e `31..45`, respectivamente,
  as datas relativas a hoje em `America/Sao_Paulo` aparecem na faixa correta.
  Termos antigos sem data ficam em Previsto sem faixa, conforme `Unresolved 6`, até preenchimento.
  Proof: `supabase test db supabase/tests/f3_11_saldos.test.sql --local` — grupo
  `C10 three installments persist and map to 15 30 45 day buckets`;
  `npm test -- --run src/saldos-service.test.ts -t "C10 parcelas projetam faixas e legado sem data"`;
  `npm test -- --run src/saldos.test.tsx -t "C10 parcelas aparecem no previsto"`.
- [ ] **C11 — marcar uma parcela recebida é confirmado em duas etapas e não apaga a linha.** A
  primeira ação apenas abre confirmação; confirmar define `received_at`, remove a parcela de
  Previsto, soma-a em Realizado com a data de recebimento e acrescenta exatamente um evento de
  Atividade. Cancelar não altera parcela, total nem evento.
  Proof: `supabase test db supabase/tests/f3_11_saldos.test.sql --local` — grupo
  `C11 received installment moves blocks and audits once`;
  `npm test -- --run src/saldos.test.tsx -t "C11 recebimento pede confirmacao e recarrega"`.
- [ ] **C12 — parcela vencida não recebida fica Pendente.** Uma parcela com `due_date` anterior
  ao dia civil atual de São Paulo aparece em Pendente, continua não recebida e não entra em
  Realizado nem em qualquer projeção futura.
  Proof: `supabase test db supabase/tests/f3_11_saldos.test.sql --local` — grupo
  `C12 overdue installment is pending`;
  `npm test -- --run src/saldos-service.test.ts -t "C12 parcela vencida vai para pendente"`.
- [ ] **C13 — gates e Cenário D passam localmente.** `npm run build`, `npm run lint` e
  `npx tsc -b --pretty false` passam; reset e pgTAP locais passam; o harness exercita evento
  válido, repetido, Basic inválido, reembolso refletido em Saldos/Projeto/Atividade e nenhum
  segredo ou dado sensível de cartão; a história E2E cobre Saldos em 1440×900 e 375×812 sem
  `console.error`, `pageerror` ou resposta inesperada ≥500.
  Proof: `npm run build` em `app/`; `npm run lint` em `app/`; `npx tsc -b --pretty false` em
  `app/`; `supabase db reset --local`; `supabase test db --local`;
  `pwsh -NoProfile -File supabase/tests/f3_11_saldos.ps1 -Scenario D`;
  `npm test -- --run src/saldos-service.test.ts src/saldos.test.tsx` em `app/`;
  `npm run test:e2e -- e2e/f3-11-saldos.spec.ts --project=chromium -g "F3-11 C1-C12"` em `app/`.

## Swept

- validation: C10 valida `number`, `amount_cents` positivo e `due_date` obrigatório; o schema
  deve rejeitar parcela sem projeto, sem valor, sem data e número duplicado.
- failure modes: C4/C5 cobrem vazio e autorização; C9 cobre ordenação fora de ordem; C13 cobre
  reconsulta indisponível pela regressão do R1-03 e erro/retry da tela.
- idempotency and retry: C8 para evento de gateway; C11 para ação manual; C13 repete o Cenário D.
- authorization: C5 cobre tela e leitura API de `CLIENT`; mutações manuais exigem `NO_ADMIN` no
  RPC e no contrato da tela.
- concurrency and ordering: C9 cobre evento anterior à aprovação; C2 ordena movimentos por data
  mais recente; unicidades de gateway e `(project_id, number)` são fronteiras transacionais.
- data lifecycle: C6/C7 mantêm histórico e C11 move parcela sem apagar; nenhum arquivamento ou
  exclusão funcional novo entra nesta task.
- external-dependency failure: a reconsulta existente do R1-03 continua responsável por erro
  externo; o harness usa mock local e prova que payload alegado não substitui estado confirmado.
- state transitions: C6 `approved → refunded`, C7 `approved → chargedback`, C9 pendente + evento
  antecipado, C11 prevista/pendente → recebida e C12 prevista → pendente por data.
- observability: C6–C9 e C11 exigem Atividade; falhas de sincronização usam log estruturado com
  `projectId` e código, sem valores comerciais, credenciais ou dados de cartão, conforme
  `Unresolved 5`.

## Coverage

| Set (size) | Member → proof | Unproven |
| --- | --- | --- |
| blocos financeiros (3) | realizado C1/C3/C6/C7/C11 · pendente C1/C12 · previsto C1/C10/C11/C12 | - |
| tipos realizados (4) | aprovação C1/C3 · recebimento C1/C11 · reembolso C1/C6 · estorno C1/C7 | - |
| tipos pendentes (3) | tentativa não concluída C1/C13 · parcela C1/C12 · falha C1/C13 | - |
| projeções (3) | 15 dias C1/C10 · 30 dias C1/C10 · 45 dias C1/C10 | - |
| estados de pagamento tocados (4) | `approved` C3/C6/C7 · `refunded` C6/C9 · `chargedback` C7/C9 · `pending` C8/C9 | - |
| transições de parcela (3) | prevista → recebida C11 · prevista → pendente C12 · pendente → recebida C11 | - |
| eventos de webhook (4 comportamentos) | válido/reconsulta C6/C7 · repetido C8 · auth inválida C13 · fora de ordem C9/C13 | - |
| campos de movimento (5) | data/valor/tipo/status/projeto C2 | - |
| roles (2) | `NO_ADMIN` C1–C4/C6–C13 · `CLIENT` C5 | - |
| estados da tela (5) | loading/erro/retry C13 · vazio C4 · não autorizado C5 · dados C1–C3/C6–C12 | - |
| viewports (2) | 1440×900 C13 · 375×812 C13 | - |
| assemblies (3) | app em `app/src/main.tsx` C13 · Vitest em `saldos.test.tsx`/`saldos-service.test.ts` C1–C12 · Playwright em `e2e/f3-11-saldos.spec.ts` C13 | - |

- Claims que nomeiam rota, status HTTP, resposta ou formato de dados: C1 (`/no/saldos`), C5
  (não autorizado/zero linhas), C6/C7 (`refunded`/`chargedback`), C8 (idempotência), C9
  (ordenação), C10 (`installments`) e C13 (gates/Cenário D); cada um tem prova de fronteira
  local além de assertions no próprio nível quando a regra decide.
- Nenhum membro de `Unresolved` foi convertido em decisão final; os comportamentos escritos na
  task estão marcados como provisórios nas checks que os exercitam.

## Handoff

- Piso de leitura por fatia, estimado a partir dos contratos R1-03/R1-06 e dos arquivos novos
  equivalentes: S1 ~86 kB (~22k tokens), S2 ~72 kB (~18k), S3 ~94 kB (~24k). Total de build
  ~63k tokens, abaixo do limite padrão de 150k; a leitura completa das fontes binding fica
  separada desse piso.
- **Um lote S1–S3** é suficiente; não há corte horizontal nem handoff obrigatório. Se os
  fixtures/harness crescerem além do piso, a fronteira natural é após S2, antes de C10, sem
  dividir uma fatia.
- Cada lote termina somente com seus proofs verdes e commit convencional. O próximo agente
  lê este checklist e o diff commitado, não uma reconstrução narrativa.
- O orquestrador, nunca um builder, despacha um verificador fresco sobre `<feature-base>..HEAD`
  depois do último commit funcional, com todos C1–C13, fontes binding e até cinco faults
  distintos.
- Nenhum reset enquanto outra task estiver em verificação; nenhuma operação remota, deploy,
  push ou DNS pertence a esta implementação.

## Evidência local — 15/09/2026

- [x] C3, C5, C6, C8 e C10–C12: pgTAP F3-11 → PASS, 18 asserts; cobre autorização CLIENT, roadmap aprovado, reembolso idempotente, três faixas, recebimento e vencimento.
- [x] Serviço de classificação: Vitest saldos-service → PASS, 4 testes.
- [x] Regressão de webhook: harness R1-03 → PASS, 64 assertions.
- [x] Gates locais: após reset limpo, pgTAP completo → PASS, 288 testes; lint, TypeScript e build também passaram.
- [ ] C1–C2/C4/C6–C9/C13 de DOM, harness F3 dedicado e Playwright ainda não possuem prova específica; não foram marcados por equivalência.
