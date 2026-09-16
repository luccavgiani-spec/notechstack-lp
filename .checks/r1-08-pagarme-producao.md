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

- [x] **C1 — o app está servido no domínio próprio sem retirar a home.**
  `https://app.notechstack.com.br/login` responde HTTP 200 pelo projeto Vercel correto, cujo Root
  Directory é exatamente `app`; o documento servido contém o assembly do app e não um fallback da
  home. Em paralelo, `https://www.notechstack.com.br/` continua HTTP 200 e mantém o marcador do
  `lp-narrador/cenas-lp/lp-v7.html`. A prova deve registrar projeto/deployment/domínio e status,
  nunca cookies, tokens ou cabeçalhos sensíveis.

  Prova local: `npm run build`, `npm run lint`, `npx tsc -b --pretty false`,
  `npm run test:e2e -- --grep "R1-05"`.
  Prova externa, somente com `Unresolved 5` e `Unresolved 2` resolvidos: inspeção read-only do
  projeto Vercel + `Invoke-WebRequest`/browser nos dois domínios + verificação do Root Directory.

- [x] **C2 — as quatro functions e os três secrets de produção estão no projeto certo.**
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

- [x] **C4 — o cadastro público do Auth de produção é recusado.**
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

## Preflight local — 16/09/2026

- [x] Reset local e pgTAP completo passaram (335 provas).
- [x] Harness R1-03 passou (64 assertions); os harnesses da Onda 2 também passaram: R1-07 15, F2-09 17 e F3-11 18 assertions.
- [x] Em app/, Vitest completo (101 testes), lint, TypeScript e build passaram; Playwright da Onda 2 passou 6/6 em desktop e mobile.
- [x] Parser somente leitura de supabase/config.toml: roadmap-checkout=false, pagarme-webhook-no=false, skill-01-ativar-dashboard=true, project-convert=true.
- [x] A Vercel CLI não está instalada e não foi instalada nesta onda, conforme a restrição de não configurar integrações externas; a instalação local recomendada (`npm i -g vercel`) fica para uma retomada autorizada.
- [ ] C1–C6 seguem BLOCKED: não houve push, deploy, DNS, leitura/escrita hospedada, configuração de secrets, conta Pagar.me nem teste Pix real. PAINEL_TOKEN continua pendente de rotação ao final de todas as ondas.

## Descoberta externa sanitizada — 15/09/2026

- [x] A home existente responde pela Vercel e `www.notechstack.com.br` já aponta para a Vercel; a home não deve ser movida.
- [x] O DNS autoritativo de `notechstack.com.br` é o Registro.br, e `app.notechstack.com.br` ainda não possui registro.
- [ ] R1-08 continua pendente: não havia sessão autenticada na conta Vercel, nem acesso ao painel DNS; portanto não foram criados projeto, domínio, registro, deploy, secret ou função hospedada.
- [ ] As chaves e as credenciais de webhook Pagar.me de produção continuam necessárias apenas como secrets do Supabase. Seus valores não foram lidos, registrados ou transmitidos. `PAINEL_TOKEN` segue pendente de rotação ao final de todas as ondas.

## Release autorizado — retomada de 16/09/2026

Esta seção atualiza o estado histórico acima. Lucca autorizou explicitamente push, deploy, DNS e mudanças em produção nesta retomada; autorização não substitui evidência nem acesso aos serviços.

- [x] Gates locais finais: pgTAP 364/364 após reset limpo, Vitest 105/105, Playwright das Ondas 2/3 8/8 (desktop/mobile), lint, TypeScript e build aprovados. Não somar reexecuções como casos distintos.
- [x] Push de `main` até `b50e591`, preservando as alterações publicadas da home e as alterações não relacionadas do worktree.
- [x] Quinze migrations necessárias aplicadas ao Supabase correto; migrations legadas já existentes preservadas. Histórico remoto usa timestamps de aplicação diferentes dos locais: reconciliar explicitamente antes de qualquer futuro `db push`; não executá-lo cegamente.
- [x] Seis functions ativas: quatro da task com flags JWT false/false/true/true, além de project-status-transition e project-publish-version autenticadas. Demais functions legadas preservadas.
- [x] Projeto Vercel `notechstack-app` separado da home, Root Directory `app`, variáveis públicas Supabase configuradas e deploy de produção `dpl_6Qw1bxK8UpgJWyNmmMU7Qq6xLptZ` READY. Browser confirmou assembly/login em `https://notechstack-app.vercel.app/login`. Uma primeira tentativa falhou por import compartilhado fora da raiz; configuração monorepo corrigida e build remoto aprovado antes da promoção.
- [ ] C1 parcial: `app.notechstack.com.br` associado ao projeto correto, mas DNS ainda pendente. Nameservers confirmados `e.sec.dns.br` e `f.sec.dns.br`; recuperação do acesso Registro.br necessária. Não alterar apex, www, MX ou nameservers. Home existente respondeu HTTP 200; critério exige ainda a prova final dos dois domínios.
- [ ] C2 parcial: functions verificadas; os três secrets Pagar.me não estavam presentes na última inspeção somente por nome. Configuração segura pelo titular pendente, sem transmissão de valores ao chat.
- [ ] C3 pendente: webhook exclusivo da nó e teste/replay reais ainda necessários. Conta Pagar.me existente do mesmo CNPJ será preservada, sem modificar o roteador.
- [x] C4 aprovado: signup público desligado no painel e chamada controlada recusada com HTTP 422 / signup_disabled; contagem de usuários permaneceu inalterada durante a prova.
- [x] Duas contas criadas pelo titular e confirmadas; papéis NO_ADMIN e CLIENT configurados. Nenhuma senha registrada neste checklist. A conta cliente ainda precisa da associação a um projeto real; nenhum exemplo foi semeado em produção.
- [ ] C5 e C6 pendentes: Pix real de R$ 149,90, agregado único/replay e prova final do funil/telemetria legados. Pagamentos do roteador não são evidência desta task.
- [ ] PAINEL_TOKEN permanece pendente de rotação ao final de todas as ondas, após mapear consumidores.
- [ ] sync-vault bloqueada: a skill permite somente `05-Codex/context`, mas o vault atual usa `05-Núcleo/context`. Nenhuma escrita fora da restrição nem mapa duplicado foi criado.

Veredito R1-08: **PENDENTE DE PROVAS EXTERNAS** (C4 aprovado; demais critérios não recebem PASS por inferência). Próxima retomada segura: login das contas na URL Vercel, secrets/webhook Pagar.me, recuperação Registro.br e apontamento exclusivo do subdomínio app; depois prova Pix única e regressão do legado.

## Validação do alias Vercel — 16/09/2026

- [x] Identificado e corrigido CORS: a origem exata `https://notechstack-app.vercel.app` agora é aceita, sem liberar `*.vercel.app`. Publicadas somente as cinco functions da aplicação que usam esse helper; integrações legadas não foram republicadas.
- [x] Contrato novo: 12/12 testes de origens confiáveis, externas e preflight. Suíte completa atual 117/117, lint e build aprovados; banco continua 364/364 e cenário E2E anterior 8/8 (não reexecutados nesta mudança de cabeçalhos).
- [x] Prova remota OPTIONS: alias Vercel, app e www próprios receberam suas origens exatas; origem de outro projeto Vercel não foi autorizada. Quatro respostas HTTP 204, sem escrita de negócio.
- [x] Seis probes remotos sem autenticação: checkout GET recusado com 405; webhook e quatro functions autenticadas recusados com 401. Não foi criado pedido, pagamento ou projeto.
- [x] Browser autenticado como cliente: seleção de projetos carregou e tentativa de abrir `/no/projetos` redirecionou para `/nao-autorizado`; aba restaurada ao dashboard cliente. Nenhum projeto disponível é esperado enquanto não houver associação real.
- [x] Leitura pública de sete tabelas sensíveis não retornou linhas: projects, kanban_items, activity_events e memberships vazias sob RLS; project_versions, editor_exports e payments recusadas com 401/42501. Banco de produção está sem projetos; esta prova não substitui os testes de isolamento com dados locais.
- [x] Home HTTP 200 com marcador v7 `heroSlogan`, assets roadmap-checkout.js e diagnostico.js presentes e servidos HTTP 200 como JavaScript, não fallback HTML. Não equivale à prova C6 pós-pagamento.
- [ ] Cartão em produção requer ainda a chave pública Pagar.me na configuração pública da home e domínio de tokenização autorizado. Os três secrets abaixo habilitam a base backend/Pix; não provam cartão funcionando.
- [ ] A documentação atual informa migração de `charge.chargedback` para `chargeback.received` até 30/09/2026. O evento legado está coberto localmente; validar o novo payload/contrato e sua adaptação antes da descontinuação, sem assumir equivalência de shapes.

## Configuração segura pelo titular — Pagar.me

1. No dashboard Pagar.me da conta existente, selecione **Produção/live**, depois **Configurações de Conta → Chaves → Criar Chave**. Nome sugerido: `nó-roadmap-produção`. Crie uma chave separada para esta integração, com leitura/escrita de pedidos e consultas necessárias, usando escopo personalizado quando disponível. Não excluir, redefinir ou trocar a chave do roteador. A chave é exibida uma vez: guardar no gerenciador de senhas e colar diretamente no Supabase, nunca no chat.
2. No Supabase, abrir `https://supabase.com/dashboard/project/sdeowbqmwkwseyktyemn/functions/secrets` e salvar:
   - `PAGARME_SECRET_KEY`: chave secreta **de produção** recém-criada na Pagar.me (não chave pública, não chave Pix e não chave do app Stone).
   - `PAGARME_WEBHOOK_USER`: identificador escolhido pelo titular, exclusivo do webhook da nó, sem dois-pontos. Não é o login do dashboard.
   - `PAGARME_WEBHOOK_PASS`: senha nova forte e exclusiva, gerada no gerenciador de senhas. Não reutilizar senha de login nem a chave secreta da API.
3. No Pagar.me, **Configurações → Webhooks → Criar webhook**, sem editar o webhook do roteador. Endpoint: `https://sdeowbqmwkwseyktyemn.supabase.co/functions/v1/pagarme-webhook-no`. Habilitar autenticação **Basic** e repetir exatamente o usuário/senha dos dois secrets de webhook; a autenticação é obrigatória para o nosso endpoint, mesmo que opcional no painel.
4. Eventos atuais tratados: `order.paid`, `order.payment_failed`, `order.canceled`, `charge.refunded` e `charge.chargedback` (ver pendência de migração acima). Após salvar, executar teste/replay supervisionados antes de uma única cobrança Pix real de R$ 149,90. Testes do roteador não comprovam a nó.
5. Separadamente, guardar a chave **pública** da mesma conta/ambiente para configurar tokenização de cartão na home, sem jamais publicar a chave secreta. Não alterar o modelo de negócio/meios de pagamento compartilhados do roteador para habilitar um simulador.

Fontes oficiais verificadas nesta retomada:

- [Pagar.me — chave secreta/pública e chaves por integração](https://pagarme.helpjuice.com/pt_BR/p2-manual-da-dashboard/4-configura%C3%A7%C3%B5es-como-consultar-a-chave-secreta-e-a-chave-p%C3%BAblica)
- [Pagar.me — configuração de webhooks](https://pagarme.helpjuice.com/pt_BR/p2-funcionalidades/configura%C3%A7%C3%B5es-como-configurar-webhooks)
- [Pagar.me — eventos de webhook](https://docs.pagar.me/reference/eventos-de-webhook-1)
- [Supabase — secrets de produção](https://supabase.com/docs/guides/functions/secrets)

## DNS e secrets cadastrados — 16/09/2026

- [x] Titular confirmou recuperação do domínio na conta Registro.br e criação dos três secrets. Listagem sanitizada confirmou somente nomes/presença de PAGARME_SECRET_KEY, PAGARME_WEBHOOK_USER e PAGARME_WEBHOOK_PASS, sem ler valores/digests. Isso não prova ainda a validade/ambiente da chave na API Pagar.me.
- [x] Probe de checkout POST com objeto vazio retornou HTTP 400 / INVALID_REQUEST em vez de SERVER_CONFIG_MISSING. Payload recusado antes de escrita ou chamada ao gateway; não houve cobrança.
- [x] Zona Registro.br inspecionada antes de alteração: sete registros existentes. Adicionado exclusivamente CNAME `app.notechstack.com.br → 94650c4a99bb5500.vercel-dns-016.com.` conforme recomendação atual da API Vercel. Após salvar e reabrir, oito registros e todos os sete anteriores intactos; apex, www, MX, TXT e nameservers preservados.
- [x] Consulta ao nameserver autoritativo confirmou o novo CNAME; Vercel informou configuredBy=CNAME e misconfigured=false.
- [ ] C1 ainda aguarda HTTP 200/assembly em HTTPS no domínio próprio; consulta posterior ao apontamento ainda não conseguiu abrir HTTPS. Não bypassar certificado nem substituir esta prova pela URL Vercel.
- [x] Formulário de **criação** de webhook preparado na conta Pagar.me existente, sem editar endpoints legados: URL exata do endpoint da nó, ativo, autenticação habilitada e somente order.paid/order.payment_failed/order.canceled/charge.refunded/charge.chargedback selecionados. Os numerosos eventos extras inicialmente selecionados foram removidos apenas deste rascunho novo.
- [ ] Titular deve conferir/preencher usuário e senha Basic iguais aos secrets e concluir o salvamento/validação transacional diretamente no painel. Nenhum valor desses campos foi lido ou modificado pelo agente; formulário preservado como handoff.
- [ ] C2 continua parcial até confirmar a chave de produção em uso; C3 aguarda webhook salvo, teste/replay e contagens; C5/C6 aguardam a prova Pix real e regressão do legado.

## HTTPS, webhook salvo e correção do documento — 16/09/2026

Esta seção substitui os estados parciais anteriores, sem apagar o histórico das provas.

- [x] C1 aprovado: `https://app.notechstack.com.br/login` HTTP 200 com título/assembly do app; `https://www.notechstack.com.br/` HTTP 200 com marcador v7 e asset checkout. Certificado validado normalmente, sem bypass. Root Directory `app` já verificado no projeto separado.
- [x] C2 aprovado: quatro functions ACTIVE com flags efetivas false/false/true/true; três secrets presentes por nome. A chave criou pedidos reais na conta live existente, confirmando ambiente/validade sem acesso ao valor. Titular confirmou rotação das credenciais Basic; autenticação por entrega/replay permanece C3, ainda não aprovada.
- [x] Webhook exclusivo da nó salvo e ativo, autenticação habilitada, endpoint correto e somente os cinco eventos tratados selecionados. Credenciais não foram inspecionadas nem registradas.
- [x] Três tentativas iniciadas pelo titular resultaram em pagamentos failed de 14990 centavos, sem eventos, projetos ou Kanban. Inspeção restrita da cobrança da nó revelou erro `The customer Document is required.`; nenhuma cobrança do roteador foi alterada, nem tentativa adicional criada pelo agente.
- [x] Checkout corrigido para o contrato existente de cliente individual: CPF validado no navegador e backend antes de criar pagamento/chamar gateway; encaminhado somente à Pagar.me, sem persistência no lead, payload do pagamento ou telemetria. Cache dos dois scripts da home atualizado.
- [x] Provas novas: 24/24 testes direcionados do checkout, suíte app 134/134, harness checkout/webhook 71/71 e saldos 18/18; lint, TypeScript/build e diff funcional aprovados. Mock agora exige documento. Banco 364/364 e E2E 8/8 são provas anteriores, não reexecutadas nesta mudança sem schema/React.
- [ ] C3 pendente: entrega autenticada real e replay com delta/cardinalidade de payment_events; configuração salva não prova entrega.
- [ ] C5 pendente: um Pix real confirmado, agregado e visualização NO_ADMIN/replay. Não repetir as tentativas falhadas para simular aprovação.
- [ ] C6 pendente: painel legado e eventos v7 após confirmação.
- [ ] Cartão live, migração do evento chargeback, PAINEL_TOKEN, reconciliação do histórico remoto e sync-vault continuam conforme pendências anteriores.

Fonte do requisito: [Pagar.me — Pix e dados obrigatórios do cliente](https://docs.pagar.me/reference/pix-2).

- [x] Correção publicada no commit `f2dfa6b`, push em main e deploy isolado de roadmap-checkout. Home `dpl_2w1XxptXX5KuVjpVXEanVFEBV4zM` e app `dpl_3vE7C7tfGYe3iwfZtVLR6DBsCBEa` READY no mesmo commit. HTTP confirmou scripts v2/v63 e campo CPF da home publicada. Probe remoto com body estruturalmente válido e sem documento retornou 400 / INVALID_PAYER_DOCUMENT, antes de qualquer consulta de lead ou escrita/chamada gateway.

Veredito atualizado: **C1/C2/C4 aprovados; C3/C5/C6 pendentes de prova real**. Não registrar go-live integral antes dessas provas.

## Primeiro Pix gerado após correção — 16/09/2026

- [x] Titular confirmou QR exibido. Consulta somente leitura do pagamento `b48aa307-d42f-4193-8c05-ed77607bf8d9` confirmou method=pix, amount_cents=14990, status=pending, pedido no gateway presente, código e imagem QR presentes. CPF/código Pix/credenciais não foram retornados pela consulta.
- [ ] Ainda nenhum payment_event, projeto associado, Kanban ou atividade de aprovação. Geração do Pix prova o checkout real, não aprovação, entrega autenticada ou idempotência do webhook.
- [ ] Próximo passo depende do titular: pagar somente esse Pix uma vez; depois consultar aprovação/agregado, verificar entrega/replay e regressão dos painéis. Nenhum pagamento foi executado pelo agente.

## Preparação do E2E real com cartão — 16/09/2026

- [x] Titular passou a solicitar cartão com um cliente de teste identificado. Consulta restrita confirmou lead roadmap, mas nenhum pagamento para ele. Nenhum dado de cartão foi solicitado/inspecionado e nenhum pagamento foi criado pelo agente.
- [x] Chave pública ausente na home: o fluxo anterior salvava lead e depois interrompia antes da tokenização. Agora cartão sem chave pública interrompe antes de salvar lead/tokenizar e mostra indisponibilidade de configuração, sem imputar erro aos dados do cliente.
- [x] Contrato atualizado conforme documentação oficial: endereço de cobrança validado antes de escrita/chamada gateway; token recebido do browser convertido em cartão via /customers e /customers/:id/cards; pedido usa customer_id/card_id e billing_address, compatíveis com PSP, sem PAN/CVV no servidor. Documento/endereço/token não persistem em payload de pagamento ou lead.
- [x] Provas: Vitest 147/147 (37 direcionados checkout), lint/TypeScript/build; harness R1-03 76/76, incluindo cartão aprovado/recusado, webhook/replay, endereço inválido sem criação de pagamento e contrato PSP. Primeiro rerun encontrou clientes antigos com e-mails fixos; fixtures isoladas por runId e nova execução verde, sem reset ou remoção de dados existentes.
- [x] APP_URL estava ausente na lista por nomes; configurada para a URL pública https://app.notechstack.com.br, necessária ao convite. Sem leitura de valores de secrets. Cadastro público permanece desabilitado; ativação real só após pagamento confirmado, usando Skill 01/NO_ADMIN.
- [ ] Chave pública live e domínio autorizado de tokenização dependem do titular; aguardando. Contrato local verde não comprova cartão real aprovado.
- [ ] Aprovação real, projeto no painel admin e convite/membership do cliente ainda não ocorreram. Senha padrão não será criada/transmitida; cliente a define no fluxo /acesso conforme decisão R1-04/plan_master.
- [ ] A prova de cartão não substitui automaticamente C5, que exige Pix real. O Pix gerado anteriormente segue pendente até pagamento/expiração; não criar cobrança extra para fabricar evidência.

Fontes: [Tokenização e endereço não tokenizado](https://docs.pagar.me/reference/criar-token-cart%C3%A3o-1), [cartão a partir de token](https://docs.pagar.me/reference/criar-cart%C3%A3o), [pedido PSP usando card_id](https://docs.pagar.me/reference/criar-pedido-2).

## Protótipo para demonstração antecipada — 16/09/2026

- [x] Preparado `app/public/prototipos/equipe-demo/index.html`, organização de equipe com dados fictícios: criar tarefa, iniciar, concluir e filtrar. Não publica o texto de teste do briefing, PII ou referências a terceiros. Aviso explícito de demonstração antecipada; estado temporário apenas em memória, sem chamadas ao banco.
- [x] Dez assertions de browser local em 1440px/375px: aviso, criação, início, conclusão, contadores e ausência de overflow horizontal. Build incluiu artefato estático; rewrite Vercel preserva protótipos, fontes e assets oficiais em vez do fallback SPA.
- [ ] Ainda não associado/liberado para cliente: depende de aprovação real e ativação pelo fluxo Skill 01. Datas D+1/D+3 e status financeiro não foram adulterados para simular passagem de três dias.

## Publicação da preparação cartão/protótipo — 16/09/2026

- [x] Commits `d58e9f0` (cartão PSP/validação) e `add6e07` (protótipo), push em main; somente roadmap-checkout republicada no Supabase. App deployment `dpl_2XpDHm1x1yd7A564DHQ3NZJok8s5` e home `dpl_5HakvLX4u9naXRAqWqdSnWotXETG` READY no commit add6e07.
- [x] Domínio próprio do app serviu /prototipos/equipe-demo/index.html HTTP 200 com conteúdo/aviso de demonstração, não fallback SPA. Home HTTP 200 com scripts v3/v64. Probe negativo remoto cartão sem endereço retornou 400/INVALID_BILLING_ADDRESS antes de escrita/gateway; contagem de pagamentos/pedidos do cliente de teste continua zero.
- [ ] Fluxo real aguarda somente preparações que ainda exigem evidência: chave pública/domínio de tokenização, pagamento aprovado e entrega webhook, depois ativação/convite e browser autenticado dos dois papéis. Não houve criação de senha, conta liberada ou associação do protótipo sem aprovação.

## Chave pública de cartão recebida — 16/09/2026

- [x] Titular forneceu a chave pública da conta. Configurada em pagarme-public-config.js e carregada com defer antes do checkout/diagnóstico. Apenas chave pública permitida no navegador; não foi lido arquivo .env, chave secreta ou credencial Basic.
- [x] Testes: checkout 39/39, suíte completa Vitest 149/149, lint/TypeScript/build aprovados. Novas provas verificam prefixo público/ausência de chave secreta, preservação de endpoints e ordem de scripts. Banco/harness/E2E anteriores não foram repetidos nesta mudança de configuração pública.
- [x] OPTIONS somente leitura ao endpoint oficial tokens com origem www recebeu HTTP 200, CORS *, header content-type permitido. Não tokenizou cartão, não recebeu PAN/CVV e não criou pedido/cobrança; preflight genérico não comprova a allowlist da conta nem validade/ambiente da chave.
- [ ] Cadastro do domínio na conta ainda exige confirmação do titular ou resposta real de tokenização bem-sucedida. Aprovação real, entrega/replay webhook, agregado e acesso do cliente continuam pendentes; não repetir cobrança para fabricar prova.
