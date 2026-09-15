# R1-03 · Checkout do roadmap — checklist de implementação

## Profile

`standard`

## Sources

- `.tasks/r1-03-checkout-roadmap.md` — fonte normativa dos 17 critérios, estados e decisões.
- `.design/no-sistema-operacional.md` — Journey 1–3 e decisões de nascimento, checkout, eventos, autenticidade e cartão.
- `fluxos_ref/plan_master.md` §9, §12, §15 Aceite 07 e §16 Cenário D.
- `lp-narrador/cenas-lp/historia/diagnostico.js` — fluxo atual da v7 e ponto de integração.
- `supabase/functions/send-lead-email/index.ts` — persistência do lead, costura por `sid`, e-mail e CAPI Lead.
- Padrão interno Pagar.me v5 da Consulta de Casa: `pagarme-create-order`, `pagarme-webhook` e `src/lib/pagarme.ts`.
- Documentação oficial Pagar.me Core v5: tokenização no navegador, criação/consulta de pedidos, Basic auth e webhooks.
- Branch `codex/mobile-diagnostico-faq-final` integrada localmente em `972d18f` antes desta task.

## Out of scope

- Reembolso, estorno, parcelas e Saldos (F3-11).
- Meta CAPI/GTM `Purchase`.
- Conta/chaves Pagar.me de produção, cadastro do webhook e cobrança real (R1-08).
- Split de pagamentos.
- Alterar perguntas ou ordem do diagnóstico.
- Push, deploy, DNS, vínculo Vercel e publicação das Edge Functions até todas as tasks terminarem.

## Landing

| Door | Estado | Decisão |
|---|---|---|
| Provedor de pagamentos | decidida pela task | Pagar.me Core v5; descoberta do Vercel Marketplace em 15/09/2026 encontrou apenas Stripe em `payments`, mas a decisão explícita por Pagar.me prevalece. Nenhuma integração Stripe será instalada. |
| Credenciais | sandbox/mock local | nenhum secret será lido de `.env`; adapter aceita URL de gateway injetável nos testes. Chaves reais ficam como bloqueio exclusivo de go-live. |
| Preço | fechado | constante server-side `14990`; qualquer valor do request é ignorado. |
| Idempotência do checkout | fechado | índice parcial único por lead em `created/pending`; retry reutiliza pagamento/pedido e o mesmo Pix. |
| Idempotência do webhook | fechado | uma RPC transacional registra `gateway_event_id` único e aplica a transição/provisionamento somente no primeiro insert. |
| Autenticidade | fechado | Basic auth comparada em tempo constante e reconsulta `GET /orders/{id}`; o payload sozinho nunca aprova. |
| Payload persistido | fechado | respostas do briefing em `payments.payload.answers`; evento guarda envelope saneado, sem PAN, CVV ou validade. |
| Datas | fechado | pagamento convertido para `America/Sao_Paulo`; Kanban em D+1 e D+3 calendários. |
| Superfície estática da home | fechado | chave pública vem de configuração explícita do browser; não há secret no front. Endpoints são injetáveis para teste e mantêm defaults hospedados. |

## Checks

- [ ] **C1 — oferta usa somente a copy e o preço R$ 149,90.** Prova: teste estático/DOM afirma os quatro textos exatos e ausência de `R$ 199,90`/`R$ 450,00` na etapa 7.
- [ ] **C2 — três marcos de entrega aparecem com os textos do §12.** Prova: teste estático/DOM enumera Dia 1, Dias 2 e 3 e Entrega, com respectivos apoios.
- [ ] **C3 — Pix cria lead roadmap e um pagamento pendente de 14990, exibindo QR e copia-e-cola.** Prova: harness chama `send-lead-email` e `roadmap-checkout` contra Supabase/gateway mock locais, compara delta 1 e resposta/render.
- [ ] **C4 — cartão é tokenizado no browser e checkout recebe somente token; aprovado aparece na tela.** Prova: teste de browser/JS intercepta `/tokens`, inspeciona o corpo enviado à Edge Function e gateway mock devolve `paid`.
- [ ] **C5 — cartão recusado mantém a tela com retry, grava `failed` e não cria projeto.** Prova: gateway mock de recusa + assertions de DOM e contagens.
- [ ] **C6 — preço do corpo não altera os 14990 centavos.** Prova: request malicioso + inspeção do pedido no mock e da linha `payments`.
- [ ] **C7 — `leadId`/`sid` divergentes retornam 403 e não criam pagamento.** Prova: request local e delta zero.
- [ ] **C8 — duplo submit para o mesmo lead reutiliza pagamento e Pix.** Prova: duas requests; mesmo `paymentId`, `gateway_order_id`, QR e contagem 1.
- [ ] **C9 — nenhum PAN, CVV ou validade chega a banco/log.** Prova: busca no schema/linhas/eventos/log capturado e teste do contrato da chamada server-side.
- [ ] **C10 — evento pago autenticado e confirmado cria todo o agregado.** Prova: webhook local + RPC; `payments=approved`, 1 evento, 1 cliente, 1 projeto `ROADMAP_PAGO`, 1 roadmap com answers, 2 itens D+1/D+3 e 1 atividade.
- [ ] **C11 — repetir o mesmo evento não duplica efeitos.** Prova: segunda chamada 200 e vetor de contagens invariável.
- [ ] **C12 — Basic ausente/incorreta retorna 401 sem escrita.** Prova: duas chamadas e vetor de contagens invariável.
- [ ] **C13 — reconsulta divergente só registra evento.** Prova: payload `paid`, mock `pending`; evento +1, pagamento/projeto invariáveis.
- [ ] **C14 — falha posterior a `approved` não regride status.** Prova: evento novo confirmado `failed`; histórico +1 e pagamento ainda aprovado.
- [ ] **C15 — Pix pendente confirmado `failed/canceled` vira `failed` sem projeto.** Prova: duas variantes do mock e contagens.
- [ ] **C16 — telemetria v7 e consumidores legados de `send-lead-email` continuam válidos.** Prova: pgTAP/RPC aceita `cta_click`, `capitulo_visto`, `diag_abrir`; harness envia shapes de lp-v5, agendar, Roteador e health e mede quatro leads.
- [ ] **C17 — gates e testes locais passam.** Prova: `app` build/lint/`tsc -b`; reset; pgTAP; harness de functions cobrindo válido, repetido, auth inválida, divergente e fora de ordem.

## Test policy

| Check | Method | Why |
|---|---|---|
| C1–C2 | automated static/DOM | copy exata e ausência de preço antigo são determinísticas. |
| C3–C9 | automated integration + DOM | cruza browser, Edge Function, gateway mock e banco; evita prova por inspeção isolada. |
| C10–C15 | automated integration + pgTAP | concorrência, histórico e transações precisam de banco real local. |
| C16 | automated regression | preserva lista fechada da telemetria e quatro shapes legados. |
| C17 | automated gates | comandos reproduzíveis. |

## Swept

- validation: C6, C7 e validação do contrato de `answers`.
- failure modes: C5, C13 e C15; gateway indisponível deixa `created` e permite retry sem novo pagamento.
- idempotency and retry: C8 e C11.
- authorization: C7 e C12.
- concurrency and ordering: índice parcial do checkout, evento único e C14.
- data lifecycle: C9; eventos imutáveis.
- external-dependency failure: mock de 502/timeout no checkout, sem retry automático.
- state transitions: C3, C5, C10, C14 e C15.
- observability: logs estruturados somente com `paymentId`, `gateway_event_id`, tipo e status.

## Coverage

| Conjunto enumerado | Cobertura |
|---|---|
| métodos `pix`, `cartao` | C3–C5, C8, C15 |
| estados `created`, `pending`, `approved`, `failed` | C3, C5, C10, C14, C15 |
| autenticação webhook ausente, errada, válida | C10, C12 |
| entrega `Dia 1`, `Dias 2 e 3`, `Entrega` | C2, C10 |
| efeitos `payment_events`, `clients`, `projects`, `roadmaps`, `kanban_items`, `activity_events` | C10–C14 |
| eventos `cta_click`, `capitulo_visto`, `diag_abrir` | C16 |
| consumidores lp-v5, agendar, Roteador, health | C16 |
| superfícies oferta, carregando, erro/retry, recusa, Pix, aprovado | C1–C5, C13 |

## Handoff

- Tamanho estimado total acima de 150 kB entre fontes, schema, funções, UI e provas; execução dividida em dois lotes com arquivos não sobrepostos.
- **Lote A — domínio/backend:** migration, RPC transacional, `roadmap-checkout`, `pagarme-webhook-no`, config, pgTAP e harness C3–C17.
- **Lote B — superfície:** diagnóstico/copy, tokenização e estados visuais C1–C9/C16; começa depois de o contrato HTTP do lote A estar fixado.
- Cada lote termina com commit convencional e provas próprias. A verificação independente fresca roda depois do último commit funcional.
- Nenhuma execução hospedada faz parte desta task; sandbox/mock local é a evidência aceita pela fonte quando não há credenciais.
