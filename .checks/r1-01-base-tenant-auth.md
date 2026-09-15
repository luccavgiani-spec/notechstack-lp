# R1-01 · Base de tenant, auth e RLS — checklist de implementação

## Profile

`light`

## Sources

- `.tasks/r1-01-base-tenant-auth.md` — fonte normativa dos critérios 1–15 e das decisões.
- `.design/no-sistema-operacional.md` — decisões de arquitetura, autenticação, tenant e testes.
- `fluxos_ref/plan_master.md` — autorização alvo, estados e aceites 01, 02 e 08.
- `supabase/migrations/20260423195849_meta_integration_core.sql` — tabela `clients` e policies legadas preservadas.
- `supabase/migrations/20260814190000_rastreio_jornada.sql` — migration histórica que pressupunha `public.leads` sem criá-la.
- `C:/Users/lucca/projetos/roteador/roteador-consultadecasa/src/pages/AdminGate.tsx` — referência de formulário e estados de login.
- `C:/Users/lucca/projetos/roteador/roteador-consultadecasa/src/styles/prototype.css` — referência visual de estados.

## Out of scope

- Telas dos módulos do cliente (R1-05).
- Skill 01, convite e criação de usuários (R1-04).
- Telas administrativas de projetos/atividade e conversão (R1-06).
- Pagamentos (R1-03), versões, exports e arquivamento (fases 2 e 4).
- Alterar tabelas ou policies do produto Meta (R1-02).
- Aplicar migrations no Supabase remoto, alterar DNS, deployar ou publicar.
- Resolver os itens `Unresolved 2`, `3`, `4` ou `5`; a copy será provisória e marcada para revisão.

## Landing

| Door | Estado | Decisão usada nesta implementação |
|---|---|---|
| Docker/WSL2 local | resolvida | Docker Engine respondeu e as imagens do Supabase foram baixadas; a reprodução parou apenas por drift histórico de schema. |
| Histórico local sem `public.leads` | resolvida com autorização de Lucca em 15/09/2026 | reparar `20260814190000_rastreio_jornada.sql` com `create table if not exists public.leads` usando a forma exata confirmada por inspeção read-only do projeto remoto; nenhuma escrita remota. |
| Cadastro público no Auth de produção | aberta, bloqueia go-live | alterar apenas `supabase/config.toml` local para `enable_signup = false`; ajuste remoto continua manual (Unresolved 5). |
| CLIENT com mais de um projeto | aberta | implementar lista simples de projetos; com um projeto, redirecionar direto como exige o critério 11. |
| Copy de login/erro/não autorizado | aberta | texto provisório explícito, sem liquidar Unresolved 3. |
| Aplicação em produção | aberta | não aplicar; concluir somente provas locais. |

## Checks

### S1 — isolamento por tenant e papel

- [x] **C1 — CLIENT lê somente o próprio tenant nas cinco tabelas.** Criar fixtures A/B com projeto, roadmap, dois itens, evento e membership; consultar como A e afirmar somente IDs de A em `projects`, `roadmaps`, `kanban_items`, `activity_events` e `memberships`. Prova: `supabase test db supabase/tests/r1_01_tenant_auth_rls.test.sql` contém e passa o grupo `criterion 1`.
- [x] **C2 — CLIENT não escreve no tenant alheio.** Testar `insert`, `update` e `delete` contra B nas cinco tabelas como A, aceitando erro ou zero linhas, e comparar snapshots de B antes/depois. Prova: mesma suíte, grupo `criterion 2`.
- [x] **C3 — NO_ADMIN enxerga ambos os tenants.** JWT local com `app_metadata.role = NO_ADMIN` retorna A+B nas mesmas consultas. Prova: mesma suíte, grupo `criterion 3`.
- [x] **C4 — anon sem sessão não lê superfícies protegidas.** Consultar as cinco tabelas e `project_access` com role `anon`; todas retornam zero. Prova: mesma suíte, grupo `criterion 4`.
- [x] **C5 — authenticated sem vínculo não lê dados.** JWT sem membership e sem papel global retorna zero nas cinco tabelas. Prova: mesma suíte, grupo `criterion 5`.

### S2 — janela, módulos e atividade append-only

- [x] **C6 — janela inicial ainda aberta.** Com liberação em `now() - 15 days + 1 second`, CLIENT lê projeto/roadmap/itens e vê status efetivo `INICIAL_15_DIAS`. Prova: suíte pgTAP, grupo `criterion 6`.
- [x] **C7 — janela inicial vencida.** Com liberação em `now() - 15 days - 1 second`, CLIENT lê zero projeto/roadmap/itens e NO_ADMIN vê `EXPIRADO` na view. Prova: suíte pgTAP, grupo `criterion 7`.
- [x] **C8 — acesso convertido não expira.** Com `ATIVO_ATE_FIM_DO_PROJETO` e 45 dias, CLIENT lê projeto/roadmap/itens. Prova: suíte pgTAP, grupo `criterion 8`.
- [x] **C9 — bloqueio de módulo é aplicado no banco.** `modules.etapas = bloqueado` esconde itens do CLIENT sem esconder roadmap e não restringe NO_ADMIN. Prova: suíte pgTAP, grupo `criterion 9`.
- [x] **C10 — atividade é append-only e idempotente.** `anon`/`authenticated` não atualizam nem removem eventos; `request_id` repetido não cria segunda linha. Prova: suíte pgTAP, grupo `criterion 10`.
- [x] **C15 — triggers geram exatamente um evento auditável e respeitam bypass.** Update de projeto/item por NO_ADMIN produz um evento com ator, projeto e `{campo,antes,depois}`; `app.skip_activity=on` suprime o trigger. Prova: suíte pgTAP, grupo `criterion 15`.

### S3 — login, guards e toolchain

- [ ] **C11 — destino pós-login depende do papel.** Testes da aplicação cobrem CLIENT com um projeto → `/p/:projectId/como-funciona`, CLIENT com mais de um → lista, NO_ADMIN → `/no/projetos`. Prova: `npm test -- --run` em `app/`, testes `criterion 11`.
- [ ] **C12 — falha de login preserva página e limpa senha.** Mock de `signInWithPassword` falha; rota permanece `/login`, mensagem aparece e input password fica vazio. Prova: `npm test -- --run`, teste `criterion 12`.
- [ ] **C13 — guards de sessão e papel.** Sem sessão, `/p/*` e `/no/*` redirecionam a `/login`; CLIENT em `/no/*` recebe tela provisória de não autorizado. Prova: `npm test -- --run`, testes `criterion 13`.
- [ ] **C14 — build, lint, TypeScript e banco local verdes.** Provas: `npm run build`, `npm run lint`, `npx tsc -b --pretty false` em `app/`; `supabase db reset --local`; `supabase test db supabase/tests/r1_01_tenant_auth_rls.test.sql`; nenhum comando `--linked` ou remoto.

## Swept

- validation: C10; enums e checks também terão testes de rejeição no pgTAP.
- failure modes: C12 e falhas/zero linhas de C2.
- idempotency and retry: C10 e reparo histórico com `if not exists`.
- authorization: C1, C2, C3, C4, C5 e C13.
- concurrency and ordering: não nasce escritor concorrente; unicidade de `request_id` é a fronteira de retry.
- data lifecycle: nenhuma exclusão funcional nova; F4-13 continua responsável por arquivamento.
- external-dependency failure: C12 cobre falha do Supabase Auth; não há outro serviço externo.
- state transitions: C6, C7 e C8.
- observability: C15; sem função de servidor nesta task.

## Coverage

| Conjunto enumerado | Cobertura |
|---|---|
| tabelas tenantizadas: `projects`, `roadmaps`, `kanban_items`, `activity_events`, `memberships` | C1–C5 |
| papéis/sessões: `anon`, `authenticated sem vínculo`, `CLIENT`, `NO_ADMIN` | C1–C5, C10, C13 |
| operações: select/insert/update/delete | C1, C2, C10, C15 |
| estados de acesso: `INICIAL_15_DIAS`, `EXPIRADO`, `ATIVO_ATE_FIM_DO_PROJETO` | C6–C8 |
| módulos usados agora: `como_funciona`, `prototipo`, `etapas` | C6–C9 |
| destinos de rota: `/login`, `/p/:projectId/como-funciona`, `/p/projetos`, `/no/projetos`, não autorizado | C11–C13 |

## Handoff

- Estimativa de contexto total: ~126 kB = fontes normativas/referências (~48 kB) + SQL/migrations/testes (~46 kB) + aplicação/config/toolchain (~32 kB).
- Lote A (~78 kB): reparo de replay + S1 + S2; conclui C1–C10 e C15 e termina em commit convencional após provas locais.
- Lote B (~48 kB): S3; começa do commit do lote A, conclui C11–C14 e termina no último commit de feature.
- Verificação independente: agente fresco somente depois do último commit de feature, com a checklist, diff e comandos de prova; nenhum builder pode verificar o próprio lote.
- Fronteira do Lote A: C1–C10 e C15 fechados; migration criada por `supabase migration new r1_01_tenant_auth_rls`; commit convencional reportado ao orquestrador ao encerrar o lote.
- Clarificações no Lote A: nenhuma; os itens `Unresolved` permanecem abertos e nenhum comando remoto/linked foi executado.
- Tentativas abandonadas: nenhuma decisão de implementação foi revertida; dois erros iniciais da própria harness pgTAP (sobrecarga de `throws_ok` e DML aninhado em CTE) foram corrigidos sem alterar os critérios nem reduzir assertions.

## Provas do Lote A

- `supabase db reset --local` — PASS; quatro migrations reaplicadas, incluindo `20260915180826_r1_01_tenant_auth_rls.sql`.
- `supabase test db supabase/tests/r1_01_tenant_auth_rls.test.sql --local` — PASS; 75 testes, grupos `criterion 1`–`criterion 10` e `criterion 15` presentes e executados.
- `supabase db lint --local --schema public --level warning --fail-on error` — PASS; `No schema errors found`.
- `supabase db advisors --local --type security --level warn --fail-on error` — PASS; `No issues found`.
- `supabase db advisors --local --type performance --level warn --fail-on error` — exit 0; sete warnings `auth_rls_initplan`, todos nas policies Meta legadas que esta task proíbe alterar (`clients`, `ad_metrics_daily`, `social_metrics_daily`, `scheduled_posts`, `ad_accounts`). Nenhum warning aponta para objeto criado por R1-01.
