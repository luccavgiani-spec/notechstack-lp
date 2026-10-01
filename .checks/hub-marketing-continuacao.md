# Hub marketing — checklist de retomada

Perfil `light`, handoff ligado. Os critérios integrais são preservados nas fontes abaixo; os IDs T1/T2/T3 não são renumerados. Prova local não encerra critério que exige produção.

## Sources

- `.tasks/acompanhamento.md`: escopos, donos, gates e autorização permanente.
- `.tasks/hub-marketing-fechar-movimento.md`: T1 1–22 e seus Sources/Decided/Unresolved.
- `.tasks/hub-marketing-melhorias-entrega-1.md`: T2 1–27 e seus Sources/Decided/Unresolved.
- `.tasks/mercado-agencias-software.md`: T3 1–7 e seus Sources/Unresolved.
- `docs/movimentos/2026-09-30-hub-marketing-agentes/{HANDOFF,plan,spec,melhorias-2026-10-01}.md`: contratos e histórico herdados pelas tarefas.

## Out of scope

Contas, consentimento OAuth, credenciais, posts reais, testes de escrita em contas e remoção de legado continuam nos gates do Lucca. Tracking, checkout e marca são intocados. Nada da segunda/terceira entrega de melhorias entra aqui.

## Landing

Reutiliza rotas, `acao()`, autorização NO_ADMIN aal2 e adaptadores existentes. Contratos persistidos são os Decided de T1/T2: tabela própria de classificação append-only e contratos HTTP aditivos; OAuth guarda refresh no Vault. Consumo de state via DELETE RETURNING atômico, em vez de read/delete separado; Vault e auditoria salvos na mesma transação, em vez de sucesso parcial.

## Handoff

A/B/C reaproveitam lotes dos worktrees anteriores, cada um com uma superfície e limite inferior ao orçamento de 150k da skill; C informou ~20k de leitura. D é coleta independente. O coordenador integra todos os commits de cada tarefa antes de despachar verificador fresco. A/B já foram integrados; C/D em execução. Nenhuma redução de critério autorizada.

## Checks T1 — fechar movimento

| ID | Prova que encerra o critério | Limite atual |
|---|---|---|
| 1 | Planner 7d fresco, blocos ga4/search_console/google_ads ok e logs sem unauthorized_client | depende OAuth real |
| 2 | Campanhas 30d, bloco Google ok ou vazio definido | depende OAuth real |
| 3 | Scan sem conteúdo sensível no diff/docs/tasks/commits/logs; teste `T1-3: erro de escrita remove segredos da resposta, registro e logs` | padrões literais nos próprios critérios não são tokens; registrar contagens literais separadas, não alegar zero |
| 4 | Facebook 30d fresco ok e logs pós-deploy sem erro de permissão | fallback mock não prova isso |
| 5 | Comparar Graph com/sem campo e registrar campo exato no execution | produção pendente |
| 6 | Convite pelo Lucca, uma conta dot e login sem TOTP | G3 |
| 7 | Resposta do dot e números do planner no mesmo instante/período | G3 |
| 8 | Dot 403 agent/RPC, rota bloqueada, desligado 401 e religado 200 | roteiro, conta real pendente |
| 9 | Campanha teste Meta PAUSED/ACTIVE/PAUSED e remoção verificada | G5 |
| 10 | Campanha Google PAUSED e remoção após V6 | G5 |
| 11 | Três posts published em até 5 minutos e quarto cancelled | G4 |
| 12 | Escritas dot auditadas e objetos removidos | G3/G5 |
| 13 | Tabela planner/painéis por dia fechado, mesmo fuso e diferenças justificadas | leituras reais pendentes |
| 14 | Lista de funções sem quatro legadas e protegidas mesmas versões | G7 |
| 15 | execution needs_verification até todos critérios 1–14 passarem; sync-vault e memória atualizados | coordenador |
| 16 | rotacao-segredos.md com seis campos por segredo e nenhum valor | revisão documental C |
| 17 | teste `17 pede exatamente três escopos offline e consent, state 32 bytes TTL 600 e callback fixo`; teste UI `T1 17: retorno bem-sucedido e contrato POST /google/connect`; OAuth real | local + gate real |
| 18 | testes `18 state %s não troca código nem grava Vault` e `17/18/21/22 callback concorrente troca uma vez, salva uma conexão e retorna sem segredos`; SQL state | local e runtime |
| 19 | testes callback de cancelamento/falha e preservação Vault em marketingGoogleOAuth; UI `T1 18–19: callback %s mostra erro e reconexão para admin` | local |
| 20 | teste OAuth dot/admin aal1; UI `10–12 e T1 20: dot lê diagnóstico sem botão OAuth ou menu leads` | local |
| 21 | testes Vault-first e `21 falha do Vault não usa secret de reserva nem chama Google`, scan respostas/cache/audit | Vault real ainda não exercitado |
| 22 | teste callback concorrente e SQL atomicidade conexão/auditoria | Vault simulado no SQL isolado |

## Checks T2 — primeira entrega

Provas Vitest abaixo são testes nomeados dentro de `marketingPlanner.test.tsx` (UI), `marketingHub.test.ts` (HTTP), `marketingAdapters.test.ts` (adaptadores). Executar em lote com reporter verbose, confirmando cada nome e asserção.

| ID | Prova nomeada | Limite |
|---|---|---|
| 1 | UI `1, 7, 14, 15: zero reais, CPL não calculável, testes excluídos e conta da resposta`; HTTP `T2-1–3,23,25: reclassificação é aditiva, idempotente, auditada e só real conta como válido` | confirmar após backfill real |
| 2 | HTTP `T2-1–3,23,25: reclassificação é aditiva, idempotente, auditada e só real conta como válido` | store mock |
| 3 | mesmo HTTP + `lead_classificacao_migration.mjs` trilha e classe vigente | PostgREST não exercitado |
| 4 | UI `4–5: campanha expõe LPV, custo e objetivo com otimização na mesma linha`; adapter `LPV por campanha; Google sempre null; soma ignora dia sem LPV` | comparação Ads Manager pendente |
| 5 | UI `4–5: campanha expõe LPV, custo e objetivo com otimização na mesma linha` | local |
| 6 | UI `6, 9: LPV ausente é indisponível, não zero`; HTTP `LPV ausente no período: total null e estado indisponivel, nunca 0` | local |
| 7 | UI `1, 7, 14, 15: zero reais, CPL não calculável, testes excluídos e conta da resposta` | local |
| 8 | HTTP `Facebook 30d com #10: bloco ok, comentários sem_permissao, variante no log sem token, outros blocos inteiros` e `motivo sem_permissao: Graph 200 no token da Página e Google 403 no GA4` | plataformas simuladas |
| 9 | adapters `só entra o que não está disponível; 0 é zero; nulo sem falha é indisponível`; HTTP `Instagram parcial: janela de insights que falha vira erro com motivo, não null silencioso`, `atrasado: período com hoje marca as métricas; Search Console até hoje − 3, e a Meta não`; UI LPV | UI amostrada, inspecionar demais células |
| 10 | HTTP `connections lista as 11 capacidades, testando cada leitura só com chamadas de leitura`; UI `10–12 e T1 20: dot lê diagnóstico sem botão OAuth ou menu leads` | UI amostra uma linha |
| 11 | HTTP `escrita só é ok com prova em marketing_actions nos últimos 30 dias` e lista 11 capacidades | local |
| 12 | HTTP `escopos e permissões: tokeninfo e /me/permissions; null quando a plataforma não informa`; UI conexões | local |
| 13 | HTTP `connections não vaza token, nem quando a plataforma ecoa um na mensagem de erro`; autorização do handler + UI papéis | local |
| 14 | adapter `conta lida da Graph: id, moeda, fuso e versão do cabeçalho da resposta`; UI conta | local |
| 15 | UI `1, 7, 14, 15: zero reais, CPL não calculável, testes excluídos e conta da resposta`; inspeção Dicionario/definicoes contra todas métricas | cobertura amostral declarada |
| 16 | Planner e Ads Manager 2026-08-31..2026-09-29: R$172,64 e diferenças justificadas | real pendente |
| 17 | UI `17: De 22/09/2026 e Até 23/09/2026 → URL, pedido e título com o mesmo intervalo`, `17: o pedido à marketing-hub leva periodo=2026-09-22..2026-09-23 sem codificar`; parser período | local |
| 18 | UI `18: recarregar e voltar/avançar mantêm o período e os campos De e Até`, regressão menu 20/18 | local |
| 19 | UI casos parametrizados de datas, `19: exatamente 366 dias é aceito e o erro some`, `19: datas impossíveis na URL produzem erro em vez de RangeError`; HTTP `período inválido é 422` | local |
| 20 | `reproduz a falha de 30/09` falha em 6aded586 e passa corrigido; causa registrada no execution | coordenador reproduziu duas falhas esperadas na base |
| 21 | UI navegação/links com 7d/30d/mes-passado/custom; inspeção comPeriodo | local |
| 22 | `node supabase/tests/lead_classificacao_migration.mjs <PGlite>`: cenários 9,10,11 e limites UTC | Postgres WASM isolado |
| 23 | UI `23: admin classifica sem recarregar e repetição após erro usa mesmo request_id`, `23: lista vazia e 24: menu de leads exclusivo do admin` | local |
| 24 | HTTP `T2-24: dot e admin aal1 não leem nem classificam leads`; UI `24: dot não acessa leads nem dispara leitura pessoal` | local |
| 25 | HTTP reclassificação/idempotência/auditoria T2-1–3,23,25 | local |
| 26 | HTTP `T2-26: valores inválidos e lead inexistente não gravam classificação nem ação`; SQL constraints | local |
| 27 | SQL `lead_classificacao_migration.mjs`: RLS, zero grants/policies e recusas dos papéis | confirmar em produção |

## Checks T3 — mercado

1. CSV >=50 marcas, domínios únicos, 17 colunas exatas: validador do agente D.
2. Enums e ordenação: mesmo validador.
3. Fontes abertas sustentam cada campo, ausências explícitas: revisão das fontes e amostra independente.
4. Sem dados pessoais nem contatos: scan e revisão CSV.
5. Cinco seções, contagens da base e observação/hipótese separadas: validador + revisão síntese.
6. White-label e protótipo/roadmap em três dias comparados por contagem e até cinco marcas próximas: revisão síntese/fontes.
7. Até dez hipóteses, cada uma com contagem e métrica planner: revisão síntese.

## Swept

Validação T2-19/26; falhas T1-19 e T2-8/9; idempotência T1-18/T2-25; autorização T1-8/20 e T2-13/24/27; concorrência T1-18/22 e trilha T2-3; ciclo dos dados T1-9/10/14 e backfill T2-22; dependências externas T1-1/4; transições T1-9/11; observabilidade T1-3/12/22 e T2-10/25. As linhas `existing` das tarefas exigem releitura pelo verificador; nenhuma é automaticamente aprovada.
