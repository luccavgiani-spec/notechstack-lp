# R1-08 · Cobrança e app no ar — checklist de implementação

> Este checklist transforma os seis critérios da task em provas reproduzíveis. Ele não autoriza
> `git push`, criação ou alteração de projeto Vercel, alteração de DNS, publicação de migrations/
> functions, alteração do painel do Supabase ou cobrança real. Os itens externos ficam marcados como
> bloqueados até as respostas de `Unresolved` serem dadas. Nenhum segredo pode aparecer neste arquivo,
> em logs, commits ou relatórios.

## Profile

`standard` com gate de release externo. A rodada não cria superfície nova: liga em produção as
superfícies já provadas pela R1-03, R1-04 e R1-05. A prova local pode fechar somente contratos,
artefatos e smoke tests; critérios que afirmam estado hospedado continuam vermelhos até a execução
autorizada contra os serviços reais.

## Sources

- `.tasks/r1-08-pagarme-producao.md` — fonte normativa dos seis critérios, `Out of scope`, `Impact`
  e `Unresolved`; nada abaixo resolve uma pergunta em aberto.
- `.design/no-sistema-operacional.md` — decisões de onde vive o app, preço, nascimento do projeto,
  autenticidade Basic, cadastro público desativado e domínio.
- `.tasks/r1-03-checkout-roadmap.md` e `.checks/r1-03-checkout-roadmap.verified.md` — contrato
  das funções, preço server-side `14990`, idempotência, datas D+1/D+3, autenticação e regressão
  do funil; R1-03 terminou PASS 17/17.
- `.tasks/r1-04-skill01-acesso.md` e `.checks/r1-04-skill01-acesso.verified.md` — contrato de
  `skill-01-ativar-dashboard`, `enable_signup = false`, convite e acesso; R1-04 terminou PASS 11/11.
- `.tasks/r1-05-dashboard-cliente.md` e `.checks/r1-05-dashboard-cliente.verified.md` — rotas
  autenticadas do app cliente e prova de browser em 1440 px/375 px; R1-05 terminou PASS 17/17.
- `supabase/config.toml` — fonte local dos `verify_jwt` por function.
- `supabase/functions/roadmap-checkout/index.ts`, `pagarme-webhook-no/index.ts`,
  `skill-01-ativar-dashboard/index.ts`, `project-convert/index.ts`, `painel-dados/index.ts` e
  `track-evento/index.ts` — entry points e contratos que serão checados, sem ler `.env`.
- `brand/BRAND.md` e `brand/tokens/tokens.css` — binding visual apenas para o app já provado;
  esta task não redesenha telas.
- Documentação oficial do Pagar.me Core v5 referenciada em R1-03 — Basic auth, webhook e Pix.

## Out of scope

- Reembolso/estorno do pagamento de teste; permanece no painel do Pagar.me, como escrito na task.
- Cadastrar Gazeta e Hello Best em produção; isso pertence à R1-07.
- Evento `Purchase` no Meta.
- Alterar o domínio da home existente ou mover a home para o projeto do app.
- Criar produto, preço, split, parcelas novas ou fluxo de pagamento além do roadmap de `14990` centavos.
- Gravar credenciais, tokens, respostas completas de gateway, e-mails de teste ou dados pessoais em
  checklist, fixtures persistentes, commits ou logs.

## Landing

O app segue no projeto Vercel próprio, com Root Directory `app`, e a home segue no projeto
`notechstack-lp`. O Supabase continua sendo `sdeowbqmwkwseyktyemn`. A sequência de release é:

1. fechar e provar o preflight local sem tocar em hospedagem;
2. obter as autorizações externas e confirmar a conta Pagar.me de produção;
3. configurar Vercel, DNS, secrets e functions na ordem dos critérios;
4. configurar/testar webhook e signup;
5. fazer o pagamento de teste real e validar o agregado completo;
6. validar leads/telemetria e só então registrar o go-live.

Enquanto `Unresolved 5` não autorizar push/projeto Vercel/DNS/functions, `Unresolved 1` não
confirmar a conta e as chaves Pagar.me, `Unresolved 2` não identificar o titular do Vercel/DNS e
`Unresolved 6` não desligar o signup público, C1–C6 não podem receber `[x]` por inferência ou por
prova local.

## Preflight local obrigatório

Antes de qualquer ação externa, o implementador deve executar no repositório e guardar somente
saídas sanitizadas:

- `supabase db reset --local --yes` e `supabase test db` para confirmar que o contrato R1-03/R1-04
  continua reaplicável;
- `pwsh -NoProfile -File supabase/tests/r1_03_edge_functions.ps1` para a regressão de checkout e
  webhook em mock local;
- `npm test -- --run`, `npm run lint`, `npx tsc -b --pretty false` e `npm run build` em `app/`;
- `npm run test:e2e -- --grep "R1-05"` para o app já publicado localmente nas duas larguras;
- parser/read-only de `supabase/config.toml` comprovando exatamente:
  `roadmap-checkout=false`, `pagarme-webhook-no=false`,
  `skill-01-ativar-dashboard=true` e `project-convert=true`;
- `git diff --check` no diff funcional da rodada e inspeção de que `.env`/valores de secrets não
  foram lidos, adicionados ou impressos.

Esses comandos são pré-condição, não prova de produção. Um resultado local verde não fecha nenhum
dos seis critérios por si só.

## Checks

### S1 — app, functions e configuração hospedada

- [ ] **C1 — o app está servido no domínio próprio sem retirar a home.**
  `https://app.notechstack.com.br/login` responde HTTP 200 pelo projeto Vercel correto, cujo Root
  Directory é exatamente `app`; o documento servido contém o assembly do app e não um fallback da
  home. Em paralelo, `https://www.notechstack.com.br/` continua HTTP 200 e mantém o marcador do
  `lp-narrador/cenas-lp/lp-v7.html`. A prova deve registrar projeto/deployment/domínio e status,
  nunca cookies, tokens ou cabeçalhos sensíveis.

  Prova local: `npm run build`, `npm run lint`, `npx tsc -b --pretty false`,
  `npm run test:e2e -- --grep "R1-05"`.
  Prova externa, somente com `Unresolved 5` e `Unresolved 2` resolvidos: inspeção read-only do
  projeto Vercel + `Invoke-WebRequest`/browser nos dois domínios + verificação do Root Directory.

- [ ] **C2 — as quatro functions e os três secrets de produção estão no projeto certo.**
  `roadmap-checkout`, `pagarme-webhook-no`, `skill-01-ativar-dashboard` e `project-convert` estão
  implantadas em `sdeowbqmwkwseyktyemn`, com `verify_jwt` efetivo respectivamente `false`, `false`,
  `true`, `true`, igual ao `supabase/config.toml`. `PAGARME_SECRET_KEY`, `PAGARME_WEBHOOK_USER` e
  `PAGARME_WEBHOOK_PASS` aparecem na lista de secrets hospedados e têm valores de produção; a prova
  verifica presença/ambiente, mas não imprime valor, comprimento, prefixo ou conteúdo.

  Prova local: parser de config + suíte R1-03 e gates do preflight acima.
  Prova externa, somente com `Unresolved 5` e `Unresolved 1`: `supabase functions list --project-ref`
  e `supabase secrets list --project-ref`, comparando somente nomes/status; deploy, se autorizado,
  precisa ser seguido por uma nova listagem e smoke autenticado de cada contrato.

### S2 — webhook, signup e pagamento real

- [ ] **C3 — o webhook Pagar.me está autenticado e persiste um teste uma única vez.**
  O painel do Pagar.me aponta para exatamente
  `https://sdeowbqmwkwseyktyemn.supabase.co/functions/v1/pagarme-webhook-no`, com Basic auth
  configurada pelos secrets hospedados. Um envio de teste do painel recebe resposta de sucesso e
  grava exatamente uma nova linha em `payment_events`; repetir o mesmo evento não aumenta a
  cardinalidade nem cria projeto/pagamento duplicado. A prova deve usar somente o identificador
  sanitizado do evento e contagens/deltas, sem persistir o payload bruto em artefato.

  Prova local: `pwsh -NoProfile -File supabase/tests/r1_03_edge_functions.ps1` cobre Basic ausente,
  errada, válida, reconsulta e idempotência; isso é regressão, não substitui o teste do painel.
  Prova externa, somente com `Unresolved 5` e `Unresolved 1`: inspeção do cadastro no painel,
  envio de teste, consulta read-only de `payment_events` e replay do mesmo `gateway_event_id`.

- [ ] **C4 — o cadastro público do Auth de produção é recusado.**
  Uma chamada pública válida a `/auth/v1/signup` é recusada com status de política de signup
  desabilitado e não cria usuário nem qualquer dado derivado. A validação compara snapshots de
  contagem antes/depois e não usa e-mail pessoal ou credencial real; o endereço efêmero de teste,
  se necessário para uma chamada de formato válido, deve ser não-entregável e não permanecer em
  dados de produção.

  Prova local: `supabase/config.toml` e pgTAP/R1-01 que comprovam a intenção de `enable_signup=false`.
  Prova externa, somente depois de `Unresolved 6`: leitura da configuração Auth no projeto e uma
  chamada controlada a `/auth/v1/signup`, com snapshot de usuários antes/depois e resposta
  sanitizada. Se a chamada for aceita, o critério falha e a execução para; não apagar usuário para
  mascarar o resultado.

- [ ] **C5 — o primeiro Pix real de R$ 149,90 cria o agregado de produção uma única vez.**
  Após C1–C4, um pagamento Pix real iniciado na home retorna/é confirmado como `approved` em
  `payments.amount_cents = 14990`; o mesmo pagamento cria exatamente um projeto com
  `lead_status = 'ROADMAP_PAGO'`, `lead_id` ligado, um item D+1, um item D+3 calculados em
  `America/Sao_Paulo` e exatamente um `activity_events` de aprovação. O projeto aparece para o
  `NO_ADMIN` em `/no/projetos`; replay do webhook conserva todas as cardinalidades. O proof também
  confirma que o lead e o pedido correspondem ao teste, sem expor PII ou chaves.

  Prova local: `supabase/tests/r1_03_checkout_roadmap.test.sql`,
  `supabase/tests/r1_03_edge_functions.ps1` e o E2E/DOM da R1-03 (Pix pending, webhook confirmado,
  datas, idempotência e preço server-side).
  Prova externa, somente com `Unresolved 1`, `Unresolved 2` e `Unresolved 5`: iniciar o Pix pela
  home, confirmar o pagamento no Pagar.me, aguardar o webhook e consultar as tabelas por cliente
  de teste; abrir `/no/projetos` com sessão `NO_ADMIN` e repetir o evento para provar ausência de
  duplicação. O destino financeiro do teste permanece a pergunta aberta `Unresolved 4`; não marcar
  esse item como resolvido por decidir reembolso ou retenção.

### S3 — regressão do legado depois do pagamento

- [ ] **C6 — o lead aparece no painel legado e a telemetria v7 continua gravando.**
  Depois de C5, `painel-dados?v=leads` lista o lead do pagamento com `contexto = 'roadmap'`, sem
  vazar dados de outro tenant; a v7 envia eventos `cta_click`, `capitulo_visto` e `diag_abrir` a
  `track-evento`, e cada evento é persistido uma vez com o shape legado. Uma repetição idempotente
  não cria duplicata.

  Prova local: C16 do R1-03 e `pwsh -NoProfile -File supabase/tests/r1_03_edge_functions.ps1`
  (três eventos v7 e consumidores lp-v5/agendar/Roteador/health).
  Prova externa, somente após C5 e com autorização para leitura hospedada: chamada autenticada do
  endpoint `painel-dados?v=leads` com resposta sanitizada, consulta de contagem/shape do lead e
  smoke de `track-evento` pelo navegador da v7. O `PAINEL_TOKEN` não deve aparecer em comando,
  URL, relatório ou captura de tela.

## Swept

- validation: C1 valida assembly/domínio/Root Directory; C2 valida nomes e flags; C4 valida signup
  recusado; C5 valida preço fixo, status e datas; C6 valida contexto e shapes legados.
- failure modes: C1 preservação da home; C3 Basic inválido/replay; C4 signup aceito; C5 webhook
  atrasado, repetido ou pagamento não aprovado; C6 endpoint legado indisponível.
- idempotency and retry: C3/C5 para `gateway_event_id`; C5 para provisionamento; C6 para eventos
  legados; não repetir cobrança para fabricar a prova.
- authorization: C2 secrets/flags; C3 Basic auth; C4 signup público; C5 sessão NO_ADMIN e RLS;
  C6 token do painel sem exposição.
- concurrency and ordering: confirmação do gateway antes do projeto, D+1/D+3 em timezone local,
  replay do webhook e payment event único.
- data lifecycle: nenhum dado é removido nesta task; o pagamento de teste segue `Unresolved 4`,
  com reembolso somente pelo painel se o Lucca decidir.
- external-dependency failure: gateway/Pagar.me, Supabase Auth, functions hospedadas, Vercel, DNS
  e home recebem provas separadas; falha em uma etapa não é convertida em sucesso por mock.
- state transitions: `pending -> approved`, projeto `ROADMAP_PAGO`, provisionamento D+1/D+3 e
  signup público recusado.
- observability: C3/C5 usam logs e contagens sanitizados; C6 confirma o painel legado; nenhum
  proof inclui payload de gateway, Basic auth, JWT, PAINEL_TOKEN ou Pagar.me secret.

## Coverage

| Conjunto enumerado | Cobertura | Prova |
|---|---|---|
| superfícies de domínio | `app.../login`, `www.../`, `/no/projetos` | C1, C5 |
| functions da task | 4/4 (`roadmap-checkout`, `pagarme-webhook-no`, `skill-01-ativar-dashboard`, `project-convert`) | C2 |
| flags JWT | 2 públicas e 2 autenticadas | C2 |
| secrets Pagar.me | 3/3 por nome/presença, valores nunca exibidos | C2/C3 |
| autenticação webhook | ausente/errada/válida e replay | C3 + regressão R1-03 |
| signup | chamada pública recusada, delta zero | C4 |
| pagamento | Pix `14990`, `pending -> approved`, projeto único | C5 |
| efeitos do aprovado | `payments`, `projects`, 2 `kanban_items`, `activity_events` | C5 |
| calendário | D+1/D+3 em `America/Sao_Paulo` | C5 + R1-03 C10 |
| legado | `contexto=roadmap`, `cta_click`, `capitulo_visto`, `diag_abrir` | C6 + R1-03 C16 |
| ambientes | local/mocks e produção hospedada, provas não intercambiáveis | preflight + C1–C6 |

Claims hospedados não podem ser cobertos apenas por código, mocks ou uma resposta 200 local. C1–C6
precisam apontar para a evidência remota correspondente e registrar o bloqueio quando uma porta
externa ainda estiver aberta.

## Test policy

| Check | Method | Bar |
|---|---|---|
| C1 | Vercel read-only + HTTP/browser smoke nos dois domínios | Root Directory, 200 e preservação da home; build local é pré-condição |
| C2 | parser local + listagem Vercel/Supabase sanitizada | 4 functions, 4 flags e 3 secrets no projeto certo; nunca expor valores |
| C3 | painel Pagar.me + POST real + consulta read-only + replay | Basic auth, `payment_events` delta 1 e idempotência |
| C4 | configuração Auth + chamada pública controlada + delta de usuários | signup recusado, nenhum usuário novo |
| C5 | pagamento Pix real + webhook + consultas sanitizadas + browser NO_ADMIN | `14990`, approved, projeto único, D+1/D+3, atividade e replay |
| C6 | GET do painel legado + smoke da v7 + consulta de evento | contexto roadmap e três eventos legados sem regressão |
| Gates | comandos locais e E2E já provados pelas dependências | exit 0, reset local e nenhum segredo na saída |

## Unresolved (não resolver durante a implementação)

| # | Impacto no checklist | Status |
|---|---|---|
| 5 | bloqueia C1–C3 e qualquer mutação remota: push, projeto Vercel, DNS e deploy de functions | aberto; autorização explícita ainda necessária |
| 1 | bloqueia C2, C3 e C5: conta Pagar.me e chaves de produção | aberto; conta ainda não confirmada |
| 2 | bloqueia C1: titular do Vercel e do DNS | aberto; deve ser identificado antes de criar/associar domínio |
| 6 | bloqueia C4: desligamento do signup público no painel Supabase | aberto; não assumir que config local alterou produção |
| 3 | aberto, não bloqueia: falhas de webhook serão vistas nos logs das Edge Functions no painel Supabase | resposta já escrita pela task; não alterar durante o build |
| 4 | aberto, não bloqueia a integração: pagamento de teste fica ou é reembolsado pelo painel; projeto será arquivado quando F4-13 existir | não decidir nesta checklist |

## Handoff

- **Lote A — preflight local:** não cria código novo por si só; reexecuta os gates R1-03/R1-04/R1-05,
  valida config, registra runbook sanitizado e confirma que nenhuma operação remota será disparada.
- **Lote B — release controlado:** somente depois de #5/#1/#2/#6 resolvidos; o orquestrador executa
  Vercel/DNS/functions/secrets na ordem C1–C4 e pausa se qualquer status divergir.
- **Lote C — prova de negócio:** C5 e C6, com um único pagamento de teste, replay controlado,
  consultas sanitizadas e decisão posterior de `Unresolved 4` fora desta task.
- Cada lote deve produzir um commit documental/funcional convencional separado quando houver mudança;
  este checklist não inclui código e não deve ser usado como autorização de push/deploy/DNS.
- A verificação final precisa ser fresca sobre o último commit funcional, reexecutar gates locais e
  obter evidência remota de C1–C6. Se qualquer porta externa continuar aberta, o veredito deve ser
  `BLOCKED`, não `PASS` parcial.

## Preflight local — 15/09/2026

- [x] Reset local e pgTAP completo passaram (288 testes).
- [x] Harness R1-03 passou (64 assertions).
- [x] Em app/, Vitest, lint, TypeScript e build passaram; E2E R1-05 passou em desktop e mobile.
- [x] Parser somente leitura de supabase/config.toml: roadmap-checkout=false, pagarme-webhook-no=false, skill-01-ativar-dashboard=true, project-convert=true.
- [ ] C1–C6 seguem BLOCKED: não houve push, deploy, DNS, leitura/escrita hospedada, configuração de secrets, conta Pagar.me nem teste Pix real. PAINEL_TOKEN continua pendente de rotação ao final de todas as ondas.

## Descoberta externa sanitizada — 15/09/2026

- [x] A home existente responde pela Vercel e `www.notechstack.com.br` já aponta para a Vercel; a home não deve ser movida.
- [x] O DNS autoritativo de `notechstack.com.br` é o Registro.br, e `app.notechstack.com.br` ainda não possui registro.
- [ ] R1-08 continua pendente: não havia sessão autenticada na conta Vercel, nem acesso ao painel DNS; portanto não foram criados projeto, domínio, registro, deploy, secret ou função hospedada.
- [ ] As chaves e as credenciais de webhook Pagar.me de produção continuam necessárias apenas como secrets do Supabase. Seus valores não foram lidos, registrados ou transmitidos. `PAINEL_TOKEN` segue pendente de rotação ao final de todas as ondas.
