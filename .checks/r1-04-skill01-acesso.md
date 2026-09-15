# R1-04 · Skill 01: liberar dashboard e primeiro acesso

**Profile:** `standard` — autenticação, provisionamento compensado e expiração exigem Coverage, Test policy e fault injection; a interface tem copy provisória, sem composição visual binding suficiente para `ui`.

Sources:

- `.tasks/r1-04-skill01-acesso.md` — fonte normativa dos 11 critérios, estados, contratos HTTP/CLI e decisões.
- `.design/no-sistema-operacional.md` — jornada 5–7, papéis, tenant, acesso, vencimento e rota `/acesso`.
- `fluxos_ref/plan_master.md` §5.2, §8.3–8.4, §10 Skill 01, §12, §14, §15 Aceites 01–02 e §19 — regra operacional e aceite completo.
- `.tasks/r1-01-base-tenant-auth.md` e `supabase/migrations/20260915180826_r1_01_tenant_auth_rls.sql` — contratos existentes de `roadmaps`, módulos, RLS e `project_access`.
- `app/src/App.tsx`, `app/src/auth/*`, `app/src/pages/LoginPage.tsx` — shell, sessão e padrão de estados já existentes.
- Documentação oficial Supabase `auth.admin.generateLink`, `auth.updateUser`, autenticação de Edge Functions e configuração por função — contrato atual de convite, senha e JWT, consultado em 15/09/2026.

## Out of scope

- Botão “Liberar dashboard” em Projetos — R1-07 consumirá a mesma função.
- Envio automático por e-mail ou WhatsApp — o comando só imprime o link para envio manual.
- Editor de conteúdo — a entrada desta rodada é um arquivo JSON.
- Banner da janela e tela geral de projeto expirado — R1-05; `/acesso` cobre somente convite inválido/vencido.
- Push, deploy, DNS, migração remota e publicação de Edge Function — bloqueados até todas as tasks terminarem.

## Landing

A função autenticada orquestra Supabase Auth e uma única RPC transacional para dados públicos. O comando é um consumidor fino da mesma fronteira HTTP; a tela `/acesso` reutiliza a sessão do cliente Supabase e os componentes de estado do app.

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| Provisionamento cruza Auth e Postgres | `generateLink(invite)` cria/reusa o usuário; uma RPC transacional grava membership, roadmap, módulos, acesso, lead e atividade; se a RPC falhar, a função remove o usuário somente quando acabou de criá-lo | escritas públicas sequenciais — deixariam estados parciais; transação incluindo `auth.users` — acoplaria a função ao schema interno do Auth |
| Convite é gerado, nunca enviado | `auth.admin.generateLink({ type: 'invite', email, options: { redirectTo: APP_URL + '/acesso?projectId=<uuid>' } })`; a query define apenas o destino pós-senha, enquanto membership/RLS autorizam; reexecução gera `action_link` novo para o mesmo usuário | senha padrão ou `inviteUserByEmail` — viola §14 ou envia comunicação fora do escopo; escolher o primeiro projeto acessível — falha para usuário de mais de um tenant |
| Estado efetivo do lead é derivado | `project_access.effective_lead_status = 'NAO_CONVERTIDO'` somente quando `lead_status = 'JANELA_DE_DECISAO'` e o acesso efetivo é `EXPIRADO`; caso contrário preserva `lead_status` | cron que grava `NAO_CONVERTIDO` — adiciona job e pode divergir do instante real de expiração |
| CLI autentica como operador | `npm run skill:01 -- <projectId> <arquivo.json>` lê somente `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `NO_ADMIN_ACCESS_TOKEN`; a Edge Function lê `APP_URL`; saída contém o link, nunca tokens/segredos | service role no comando — contornaria a autorização da mesma função usada pela R1-07; confiar em `APP_URL` vindo do request — permitiria redirect arbitrário |
| Redirect local é explícito | `additional_redirect_urls` inclui `http://localhost:*/acesso` e `http://127.0.0.1:*/acesso`; produção conserva `https://*.notechstack.com.br` | aceitar redirect arbitrário — abre redirecionamento fora das origens do produto |

- Nada mais nesta mudança é difícil de reverter.

## Test policy (proposed — o repo não declara níveis por código)

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Validação de conteúdo e tabela de estados aceitos | teste direto do módulo de decisão **e** harness na função local | todos os campos obrigatórios, três tiers, três estados aceitos e pelo menos dois rejeitados |
| Orquestração Auth + RPC e compensação | harness HTTP/Auth contra Supabase local **e** pgTAP da RPC | sucesso, repetição, ausência/CLIENT, 422, 409 após usuário novo e indisponibilidade Auth simulada sem escrita pública |
| Estado efetivo derivado | pgTAP no banco local | instante em 14 dias, 15 dias - 1s, 15 dias + 1s e convertido após 15 dias |
| Rota `/acesso` | Vitest DOM da rota **e** prova Auth local do token one-shot | loading, sucesso com senha, link usado, link inválido/vencido e redirecionamento final |
| CLI fino | teste de processo real | códigos 0/1/2, argumentos, corpo enviado e saída sem token/segredo |

Evidence:

- `skill-01-ativar-dashboard`: decide autenticação, três estados aceitos, validação, novo/reuso de usuário, compensação e mapeamento de erro.
- RPC nova: decide primeira liberação versus reexecução e preserva `access_released_at`.
- `/acesso`: decide sessão de convite, atualização de senha, erro one-shot e destino por projeto.
- O padrão mais próximo é R1-03: Edge harness + pgTAP + Vitest DOM, com fronteira e decisão provadas separadamente.
- Custo: cinco superfícies de prova em quatro arquivos de testes. Estas linhas valem para esta feature; `AGENTS.md` não será alterado sem aprovação explícita.

## Checks

### S1 — Execução da Skill 01 · função, RPC, CLI e provas · ~18 arquivos · ~45k

- [x] **C1** — Para cada estado inicial `ROADMAP_PAGO`, `REFERENCIAS_PENDENTES` e `EM_PRODUCAO`, o comando autenticado cria/reusa exatamente um usuário pelo `clients.email`, uma membership `CLIENT`, publica o roadmap, ativa 01–03, bloqueia 04–06, inicia `INICIAL_15_DIAS`, grava `JANELA_DE_DECISAO` e imprime um convite para `/acesso`.
Proof: `pwsh -NoProfile -File supabase/tests/r1_04_skill_01.ps1` — assertions `C1` para os três estados e execução real de `npm run skill:01`.
Proof: `supabase test db` — pgTAP `C1 activate_dashboard transaction publishes the exact aggregate`.

- [x] **C2** — A primeira liberação grava exatamente um `activity_events` do tipo `skill_01_dashboard_ativado`, com `actor_id`, `project_id`, `occurred_at` e `request_id` idempotente.
Proof: `supabase test db` — pgTAP `C2 first activation records one attributed activity event`.
Proof: `pwsh -NoProfile -File supabase/tests/r1_04_skill_01.ps1` — assertion `C2 activity identifies operator and project`.

- [x] **C3** — Sem sessão a fronteira retorna 401; com sessão `CLIENT` retorna 403; em ambos os casos os vetores `auth.users`, `memberships`, `roadmaps`, `projects` e `activity_events` ficam invariáveis.
Proof: `pwsh -NoProfile -File supabase/tests/r1_04_skill_01.ps1` — assertions `C3 unauthenticated 401/no delta` e `C3 CLIENT 403/no delta`.

- [x] **C4** — Conteúdo sem qualquer campo obrigatório (`answers`, `references`, `stack`, `costs`, `next_steps`, `tiers`), sem cada chave `essencial`, `basico`, `completo`, ou com tier sem o shape da R1-01 retorna 422 com `invalidFields` enumerado e delta zero em Auth e banco; `preferred_tier` e `prototype_url` são opcionais, mas tipados quando presentes.
Proof: `npm test -- --run app/src/skill01Contract.test.ts` — tabela `C4 every required roadmap field tier key and nested tier field is rejected individually`.
Proof: `pwsh -NoProfile -File supabase/tests/r1_04_skill_01.ps1` — assertion `C4 boundary returns 422 with exact invalidFields and no delta`.

- [x] **C5** — Se a RPC rejeita o projeto depois de o convite criar um usuário novo, a função remove esse usuário e não deixa membership, roadmap publicado, liberação ou atividade parcial.
Proof: `pwsh -NoProfile -File supabase/tests/r1_04_skill_01.ps1` — assertion `C5 rejected project compensates newly created auth user and public rows`.

- [x] **C6** — Reexecutar num projeto liberado produz link diferente, conserva um usuário e uma membership e preserva exatamente o primeiro `access_released_at` e a única atividade de ativação.
Proof: `pwsh -NoProfile -File supabase/tests/r1_04_skill_01.ps1` — assertion `C6 retry rotates invite without duplicating or restarting access`.
Proof: `supabase test db` — pgTAP `C6 repeated RPC preserves release instant and aggregate cardinality`.

### S2 — Primeiro acesso · rota `/acesso` e Auth local · ~8 arquivos · ~24k

- [x] **C7** — Um convite válido mostra o formulário de senha; senha válida atualiza o usuário autenticado, mantém uma sessão CLIENT e redireciona para `/p/:projectId/como-funciona`.
Proof: `npm test -- --run app/src/AccessPage.test.tsx` — test `C7 valid invite sets password and redirects to its project`.
Proof: `pwsh -NoProfile -File supabase/tests/r1_04_skill_01.ps1` — assertion `C7 local invite token is accepted once and password login reaches the member project`.

- [x] **C8** — Convite usado, inválido ou vencido mostra o estado provisório “convite vencido” e a orientação de pedir novo link à Nó; não cria outro usuário nem membership.
Proof: `npm test -- --run app/src/AccessPage.test.tsx` — table `C8 used invalid and expired invite states ask for a new link`.
Proof: `pwsh -NoProfile -File supabase/tests/r1_04_skill_01.ps1` — assertion `C8 consumed token cannot create a second session or identity`.

### S3 — Estado efetivo · view e limites de tempo · ~3 arquivos · ~10k

- [x] **C9** — Em `access_released_at + 15 days + 1 second`, projeto não convertido retorna `effective_access_status = 'EXPIRADO'` e `effective_lead_status = 'NAO_CONVERTIDO'`.
Proof: `supabase test db` — pgTAP `C9 after 15 days plus one second derives expired and NAO_CONVERTIDO`.

- [x] **C10** — Em 14 dias e em 15 dias menos 1 segundo, o status efetivo permanece `JANELA_DE_DECISAO`; um projeto `CONVERTIDO` após 15 dias preserva `CONVERTIDO` e acesso ativo.
Proof: `supabase test db` — pgTAP table `C10 decision-window boundaries and converted exception`.

- [x] **C11** — Build, lint, TypeScript, reset/replay, pgTAP, harness HTTP/Auth, testes DOM e CLI passam no mesmo HEAD.
Proof: `npm run build`, `npm run lint`, `npx tsc -b`, `npm test -- --run`, `supabase db reset`, `supabase test db` e `pwsh -NoProfile -File supabase/tests/r1_04_skill_01.ps1`.

## Swept

- validation: C4; senha mínima usa a política real do Auth local.
- failure modes: C5; Auth/generateLink indisponível retorna 502 antes de qualquer escrita pública.
- idempotency and retry: C2 e C6.
- authorization: C3; `verify_jwt = true` e checagem interna do usuário/`app_metadata.role`.
- concurrency and ordering: C6; constraint de membership + RPC serializa a ativação por projeto e preserva o primeiro instante.
- data lifecycle: C5, C6 e C8; somente usuário recém-criado é elegível para compensação.
- external-dependency failure: harness simula falha de Auth e exige 502/delta zero.
- state transitions: C1, C9 e C10.
- observability: C2; falhas registram `projectId` e código, nunca e-mail, link, token ou conteúdo.

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| estados iniciais aceitos (3) | `ROADMAP_PAGO` C1 · `REFERENCIAS_PENDENTES` C1 · `EM_PRODUCAO` C1 | - |
| estados rejeitados amostrados (2) | `CONVERTIDO` C5 · `ARQUIVADO` C5 | - |
| papéis/sessão (3) | sem sessão 401 C3 · `CLIENT` 403 C3 · `NO_ADMIN` 200 C1 | - |
| campos obrigatórios do roadmap (6) | `answers` C4 · `references` C4 · `stack` C4 · `costs` C4 · `next_steps` C4 · `tiers` C4 | - |
| chaves de tier (3) | `essencial` C4 · `basico` C4 · `completo` C4 | - |
| campos de cada tier (7) | `escopo` C4 · `profundidade` C4 · `exclusoes` C4 · `complexidade` C4 · `prazo_dias` C4 · `valor_centavos` C4 · `faixa` C4 | - |
| campos opcionais tipados (2) | `preferred_tier` ausente/null/enum C4 · `prototype_url` ausente/null/string C4 | - |
| módulos (6) | `como_funciona=ativo` C1 · `prototipo=ativo` C1 · `etapas=ativo` C1 · `editor=bloqueado` C1 · `versoes=bloqueado` C1 · `marca=bloqueado` C1 | - |
| efeitos do agregado (6) | `auth.users` C1/C5/C6 · `memberships` C1/C5/C6 · `roadmaps` C1/C5/C6 · `projects` C1/C5/C6 · `activity_events` C2/C5/C6 · convite C1/C6 | - |
| estado do convite (4) | válido C7 · usado C8 · inválido C8 · vencido C8 | - |
| limites da janela (4) | 14 dias C10 · 15 dias - 1s C10 · 15 dias + 1s C9 · convertido após 15 dias C10 | - |
| saídas CLI (3) | sucesso/0 C1 · erro da função/1 C3/C4/C5 · argumento ausente/2 C11 | - |
| assemblies de redirect (3) | produção wildcard C11 · localhost C7 · 127.0.0.1 C7 | - |

- Claims com status HTTP, rota ou response shape: C1, C3, C4, C5, C6, C7 e C8 — cada uma possui prova que cruza a fronteira real.
- Nenhum outro check afirma mais casos do que seus membros enumerados acima.

## Handoff

- Tamanho estimado total ~79k antes de iteração, abaixo do teto de 150k. A task cabe em um lote, mas a superfície muda: S1/S3 são Supabase/CLI e S2 é React/Auth.
- Se houver handoff de build, a fronteira segura é após S1 + S3 verdes em um commit; S2 começa lendo o contrato final do convite. Nenhuma slice será dividida.
- Verificação independente fresca ocorre somente depois do último commit funcional, sobre C1–C11 completos.
