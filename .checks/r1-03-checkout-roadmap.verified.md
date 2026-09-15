# R1-03 · Checkout do roadmap — Verification

**Verdict**: PASS — 17/17 checks provados
**Profile**: standard
**Diff range**: `972d18f..ce7d54a`
**Round**: 2 — scoped
**Fix diff**: `103cbdf..ce7d54a`
**Verifier**: subagente independente (autor != verificador)

## Escopo da rodada

Reverificados frescamente C1, C3, C5, C10, C11, C16, `Coverage` e `Test policy`, que não haviam passado integralmente em `103cbdf`. Os demais checks foram carregados da rodada 1, mas todos os proofs foram executados novamente no novo HEAD, como exige `verify.md`.

O perfil `standard` não executa a comparação visual contra fontes binding reservada ao perfil `ui`.

## Checks

| Check | Claim | Proof e evidência no HEAD | Result |
|---|---|---|---|
| C1 | copy e preço R$ 149,90, sem preços antigos | `app/src/roadmapCheckout.test.ts:138-149` — oferta visível, preço destacado exato, preços proibidos ausentes e três marcos renderizados | PASS |
| C2 | três marcos e textos de apoio | `app/src/roadmapCheckout.test.ts:127-149` — seis textos literais e três itens no DOM | PASS |
| C3 | lead roadmap completo + Pix pending 14990 + QR | `app/src/roadmapCheckout.test.ts:172-178,261-263`; `supabase/tests/r1_03_edge_functions.ps1:150-156` — nome, e-mail, WhatsApp, contexto, sid, valor, estado e Pix | PASS |
| C4 | cartão tokenizado no browser; servidor recebe só token; aprovado visível | `app/src/roadmapCheckout.test.ts:180-188,235-240`; `supabase/tests/r1_03_edge_functions.ps1:240-249` | PASS |
| C5 | recusa mantém formulário e retry visível; failed sem projeto | `app/src/roadmapCheckout.test.ts:286-290`; `supabase/tests/r1_03_edge_functions.ps1:254-255` | PASS |
| C6 | preço do request não altera 14990 | `supabase/tests/r1_03_edge_functions.ps1:172` após request com `amount_cents=1` | PASS |
| C7 | lead/sid divergentes: 403 tipado e nenhum pagamento novo | `supabase/tests/r1_03_edge_functions.ps1:167-168` | PASS |
| C8 | duplo submit reutiliza pagamento e Pix | `supabase/tests/r1_03_edge_functions.ps1:159-160`; `supabase/tests/r1_03_checkout_roadmap.test.sql:11-13` | PASS |
| C9 | PAN/CVV/validade não chegam ao servidor, banco ou logs | `app/src/roadmapCheckout.test.ts:187-188,239-240`; `supabase/tests/r1_03_edge_functions.ps1:267-269`; pgTAP de RLS em `supabase/tests/r1_03_checkout_roadmap.test.sql:17-22` | PASS |
| C10 | webhook confirmado cria o agregado completo | `supabase/tests/r1_03_edge_functions.ps1:182-194`; `supabase/tests/r1_03_checkout_roadmap.test.sql:60-70` — inclui nome/e-mail do cliente, projeto, roadmap, dois itens/datas e atividade | PASS |
| C11 | evento repetido não duplica nenhum efeito | `supabase/tests/r1_03_edge_functions.ps1:196-211` — vetor inclui evento, cliente, projeto, itens e atividade; `supabase/tests/r1_03_checkout_roadmap.test.sql:75-79` inclui cliente | PASS |
| C12 | Basic ausente/incorreta: 401 e sem evento | `supabase/tests/r1_03_edge_functions.ps1:177-178` | PASS |
| C13 | reconsulta divergente registra evento sem mudar pagamento/projeto | `supabase/tests/r1_03_edge_functions.ps1:218-219`; `supabase/tests/r1_03_checkout_roadmap.test.sql:84-87` | PASS |
| C14 | falha depois de approved não regride e fica no histórico | `supabase/tests/r1_03_edge_functions.ps1:223-224`; `supabase/tests/r1_03_checkout_roadmap.test.sql:92-94` | PASS |
| C15 | failed/canceled de Pix vira failed, sem projeto | `supabase/tests/r1_03_edge_functions.ps1:233-234`; `supabase/tests/r1_03_checkout_roadmap.test.sql:99-104` | PASS |
| C16 | telemetria e quatro consumidores legados | `supabase/tests/r1_03_edge_functions.ps1:280,282-322` — três eventos e payloads distintos de lp-v5, agendar, Roteador e health, com campos característicos persistidos | PASS |
| C17 | reset/replay, pgTAP, functions e gates do app | gates completos abaixo; readiness/erro externo em `supabase/tests/r1_03_edge_functions.ps1:145,260-261` | PASS |

## Coverage recomputada

| Conjunto | Membros | Cobertura |
|---|---|---|
| métodos | `pix`, `cartao` | integração e DOM em C3–C5, C8 e C15 |
| estados desta rodada | `created`, `pending`, `approved`, `failed`; confirmação `canceled -> failed` | C3, C5, C10, C14, C15 e falha externa C17 |
| autenticação webhook | ausente, errada, válida | C10 e C12 |
| entrega | Dia 1, Dias 2 e 3, Entrega | três marcos no DOM; dois itens provisionados D+1/D+3 em C10 |
| efeitos | payment_events, clients, projects, roadmaps, kanban_items, activity_events | criação C10; idempotência integral C11 |
| telemetria | cta_click, capitulo_visto, diag_abrir | C16 |
| consumidores | lp-v5, agendar, Roteador, health | quatro shapes distintos e assertions características em C16 |
| superfícies | oferta, loading, erro/retry, recusa, Pix, aprovado | DOM em C1–C5 e `app/src/roadmapCheckout.test.ts:311-322` |

`refunded` e `chargedback` continuam presentes no constraint de estados como reserva de domínio, mas reembolso/estorno estão explicitamente fora do escopo desta task; não são membros comportamentais desta rodada.

## Test policy rows

| Row | Required proof | Expectation met |
|---|---|---|
| C1–C2 — automated static/DOM | copy, preço e marcos renderizados | sim — fonte e DOM real |
| C3–C9 — automated integration + DOM | browser/helper e Edge/gateway/banco unidos pelo mesmo contrato | sim — DOM monta `diagnostico.js` + helper real com fetch mock; harness monta funções reais + mock Pagar.me + banco local |
| C10–C15 — automated integration + pgTAP | fronteira HTTP e decisões/transação do banco | sim — harness HTTP + pgTAP da R1-03 dentro das 149 provas globais |
| C16 — automated regression | três eventos e quatro shapes legados | sim |
| C17 — automated gates | comandos reproduzíveis | sim |

## Faults injected

Cinco experimentos efetivos foram executados em worktree descartável no `ce7d54a`; todos os mutants foram mortos.

| Mutation | Location | Proof that failed | Killed |
|---|---|---|---|
| preço destacado `149,90 -> 149,91` | `diagnostico.js:163` | Vitest `renderiza a oferta exata` em `roadmapCheckout.test.ts:139` | sim |
| recusa marca pagamento concluído e esconde retry | `diagnostico.js:290` | Vitest `permite retry na recusa` em `roadmapCheckout.test.ts:288` | sim |
| WhatsApp omitido do payload do lead | `roadmap-checkout.js:48` | Vitest de contrato em `roadmapCheckout.test.ts:172-178` | sim |
| estado de loading não é ativado | `diagnostico.js:223` | Vitest de loading em `roadmapCheckout.test.ts:311-312` | sim |
| erro genérico marca pagamento concluído e esconde retry | `diagnostico.js:293` | Vitest de recuperação em `roadmapCheckout.test.ts:319-322` | sim |

Uma tentativa adicional sobre `send-lead-email.modo` foi abandonada sem verdict de mutant: o harness completo já havia persistido os e-mails fixos da execução baseline e uma nova execução atingiu a assertion de unicidade de cliente antes de chegar a C16. Não houve novo reset; esse ensaio não integra os cinco resultados acima.

## Gates no HEAD

- `supabase db reset --debug` — PASS; replay completo das migrations.
- `supabase test db` — PASS: 3 arquivos, **149 testes**.
- `pwsh -NoProfile -File supabase/tests/r1_03_edge_functions.ps1` — PASS: **64 assertions**, C3–C17 enumerados.
- `npm test -- --run --reporter=verbose` — PASS: 2 arquivos, **15 testes**.
- `npm run lint` — PASS.
- `npx tsc -b` — PASS.
- `npm run build` — PASS: 79 módulos.
- `git diff --check 972d18f..HEAD` — PASS.

## Estado local

O reset/replay desta rodada foi concluído e **não haverá mais reset da verificação R1-03**. Os usuários e dados de demonstração devem ser restaurados pelo orquestrador. Nenhuma operação remota, deploy, push ou DNS foi executada.
