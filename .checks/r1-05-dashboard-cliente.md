# R1-05 · Dashboard do cliente — checklist de implementação

> **Build bloqueado antes do primeiro arquivo de código.** A task declara o desenho do dashboard como pré-requisito e o artefato aprovado ainda não existe. Em particular, a navegação em 375 px e a composição comparável dos tiers (C5 e C7) não têm forma visual vinculante. Há também divergência entre C10 e a referência `lp-v7.html#prototipo`, registrada em Landing. Este checklist não resolve nenhum item de `Unresolved`.

## Profile

`ui` — elevado sobre o default `light` do repositório porque o resultado é uma interface com composição, ordem, estados responsivos e acessibilidade como critérios explícitos. O perfil torna o desenho vinculante; a ausência dele é, portanto, um bloqueio e não uma licença para improvisar.

## Sources

- `.tasks/r1-05-dashboard-cliente.md` — fonte normativa e registro de decisão dos critérios 1–17, `Out of scope`, `Observable`, `Decided` e `Unresolved`.
- `.design/no-sistema-operacional.md` — **binding para a interface** quanto à Journey 6, aos módulos, ao protótipo e ao requisito `Needs design 1`; não contém as telas desenhadas e mantém esse requisito aberto.
- `fluxos_ref/plan_master.md` §6, §12, §15 Aceite 03, §15 Aceite 11 e §16 Cenário A — **binding para a interface** quanto a módulos, nomes de tiers, copy literal, estados e roteiro E2E.
- `lp-narrador/cenas-lp/lp-v7.html` seção `#prototipo` — referência aberta para a superfície de protótipo; diverge de C10 porque mostra um editor desktop ajustável, que pertence ao módulo 04 fora do escopo, e não um `iframe` em mockup de celular.
- `home-no-prototipo/hello-deliverable.js` — referência aberta para Como funciona, navegação por três abas, mockup de celular e próximos passos.
- `C:/Users/lucca/projetos/gazeta_bragantina/painel-controle/index.html` — referência aberta para fases, cards, progresso arredondado e o conjunto real 17/27 = 63%; a interação de arrastar do painel interno não passa para o cliente.
- `brand/BRAND.md` e `brand/tokens/tokens.css` — **binding para os valores visuais**: identidade v2, Sora/JetBrains Mono, quatro cores na ordem canônica, neutros e elevação de cards.
- `C:/Users/lucca/projetos/roteador/roteador-consultadecasa/src/pages/Admin.tsx` e `src/styles/prototype.css` — precedente estrutural do `dash-shell`, `dash-sidebar`, `dash-main`, loading e erro; a regra que esconde a sidebar em `<=900px` não pode ser copiada em C5 e os valores visuais antigos não prevalecem sobre a marca v2.
- `supabase/migrations/20260915180826_r1_01_tenant_auth_rls.sql` e `supabase/tests/r1_01_tenant_auth_rls.test.sql` — schema, RLS, módulos e janela entregues pela R1-01.
- `app/src/App.tsx`, `app/src/projects/project-service.ts`, `app/src/App.test.tsx`, `app/src/styles.css`, `app/package.json` e `app/vite.config.ts` — rotas, serviço e toolchain existentes; hoje existe somente placeholder e não há runner E2E de navegador configurado.

## Out of scope

- Editor, Versões e Marca & arquivos funcionais — F2-09/F2-10 e desbloqueio por conversão pertencem à R1-06.
- Movimentar ou concluir itens do Kanban pelo cliente — somente a Nó escreve, em R1-06.
- Negociar tier, valor ou parcelas no dashboard — fechamento manual por WhatsApp.
- Criar um protótipo diferente por tier — uma base única demonstra evolução.
- Conteúdo real de Gazeta e Hello Best — R1-07.
- Fixar como decisão final a copy provisória do expirado, dos vazios e do módulo 06, a confirmação de tier, o fallback do iframe, a ordem dos itens ou o retry do mesmo tier — `Unresolved 2–6` continuam abertos; quando a task manda “escrito”, a implementação é provisória e marcada para revisão.
- Push, deploy, DNS, vínculo Vercel, publicação remota de migrations/functions ou qualquer mutação hospedada.

## Landing

O dashboard substitui somente o placeholder das rotas `/p/:projectId/*`, preserva o `AuthProvider`, os guards e a seleção de projeto da R1-01, e reaproveita apenas a estrutura do shell do Roteador. Dados continuam sendo lidos diretamente do Supabase sob RLS; a única escrita do cliente passa por uma RPC estreita.

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| Preferência do tier vira contrato SQL público | `public.set_preferred_tier(p_project_id uuid, p_tier public.tier)`, `security definer`, `search_path = ''`; exige membership `CLIENT` e `can_read_project(p_project_id, 'como_funciona')`; mudança grava `roadmaps.preferred_tier` e exatamente 1 `activity_events` na mesma transação; repetir o tier vigente é no-op sem evento, de forma provisória conforme `Unresolved 6` | `update` direto em `roadmaps` pelo cliente — concederia escrita às outras colunas do entregável |

- **Bloqueio visual:** falta o desenho aprovado citado por `Needs design 1`, sobretudo navegação a 375 px e composição/seleção dos três cards. Não iniciar Build de C5/C7 nem fechar o shell sem esse artefato.
- **Divergência a decidir:** C10 e `hello-deliverable.js` pedem protótipo em celular; `lp-v7.html#prototipo` mostra editor desktop ajustável do futuro módulo 04. A task manda perguntar se uma fonte ligada divergir; Build de C10 aguarda confirmação de que o mockup de celular prevalece.
- **Runner de prova ausente:** C17 exige E2E real em 375 px e 1440 px, mas `app/` só possui Vitest/jsdom. A futura implementação deverá adicionar `@playwright/test`, script `test:e2e` e Chromium local antes de C17 poder ficar verde; não aceitar jsdom como substituto de viewport/browser.
- Nada além da RPC acima é tratado como porta de domínio nesta task; páginas, componentes e composição permanecem reversíveis depois que o desenho existir.

## Screens (ui)

Nenhum artefato com o desenho das telas foi fornecido ou localizado. As linhas abaixo registram somente o que a task e o plan_master transcrevem; `Unproven` não pode ser convertido em decisão pelo builder.

| Screen | Copy and elements (selector) | Arrangement (selector) | Visual unproven |
| --- | --- | --- | --- |
| Shell · acesso inicial | título e apoio exatos de C1; aviso com duas frases de C2; links 01–06 nessa ordem | sidebar e região principal no desktop; desenho definitivo não fornecido | espaçamento, cor, peso tipográfico; composição final |
| Shell · 375 px | seis links alcançáveis, módulo corrente identificável | **Unresolved 1 / bloqueado:** menu, tabs, drawer ou outra navegação não foram escolhidos | toda a composição mobile, além de espaçamento, cor e peso |
| Shell · expirado | estado de expirado; ausência de conteúdo de todos os módulos | substitui o conteúdo em qualquer rota do projeto; copy provisória (`Unresolved 2`) | composição, espaçamento, cor e peso |
| 01 · Como funciona | stack, custos, próximos passos, referências, heading/apoio dos três caminhos; cards Essencial/Básico/Completo e seleção | conteúdo antes dos três cards; três cards comparáveis no desktop; **Unresolved 1 / bloqueado** quanto à composição aprovada e seleção; empilhados em 375 px | comparação visual, espaçamento, cor, peso e elevação final |
| 01 · vazio | estado vazio sem `role=alert` quando `published_at` é nulo | ocupa a região do módulo, copy provisória (`Unresolved 2`) | composição, espaçamento, cor e peso |
| 02 · Protótipo | `iframe`, link externo sempre visível de forma provisória (`Unresolved 4`) e estado vazio | mockup de celular contendo o iframe; links do protótipo navegam dentro dele; fonte `#prototipo` diverge e C10 está bloqueado | composição final do mockup, espaçamento, cor e peso |
| 03 · Etapas do plano | colunas A fazer/Em andamento/Concluído; cards com título, fase, macroversão e data; progresso inteiro; vazio | três colunas nessa ordem; itens por `position`, depois `scheduled_date` provisoriamente (`Unresolved 5`); nenhum controle de escrita | responsividade das colunas, espaçamento, cor e peso |
| 04 · Editor bloqueado | duas frases exatas de C13 e indicação de bloqueio | estado dentro do mesmo shell, sem editor interativo | composição, espaçamento, cor e peso |
| 05 · Versões bloqueadas | duas frases exatas de C14 e indicação de bloqueio | estado dentro do mesmo shell, sem histórico | composição, espaçamento, cor e peso |
| 06 · Marca & arquivos bloqueado | indicação de bloqueio, copy provisória (`Unresolved 2`) | estado dentro do mesmo shell, sem arquivos | composição, espaçamento, cor e peso |
| Shell · loading/erro | `Carregando dados…`; erro de rede e controle `Tentar de novo` do precedente Roteador | estado ocupa a região principal sem desmontar a navegação | composição, espaçamento, cor e peso |

## Test policy (proposed — o repositório não declara alocação por nível)

Estas linhas são a régua desta feature, mas não alteram `AGENTS.md` ou outra guideline sem autorização explícita separada.

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| RPC ou regra de domínio que decide e é alcançada pelo app | pgTAP no próprio nível **e** Playwright cruzando login, PostgREST e reload | auth permitida/negada; `null -> tier`, `tier A -> tier B`, `tier A -> tier A`; transação e contagem de eventos |
| Serviço cliente que decide estado, ordenação, formatação ou progresso | Vitest no próprio módulo **e** DOM no consumidor | um caso por acesso, vazio, erro, status Kanban, nulidade de preço e borda de arredondamento |
| Componente/rota que escolhe uma superfície | Testing Library em jsdom **e** Playwright para a história visível | presença, ausência, copy, ordem, contenção, navegação por teclado e todos os estados que a rota decide |
| Regra responsiva, `iframe` e navegação real do protótipo | Playwright/Chromium | 375 px e 1440 px; elemento alcançável, composição aprovada, URL do frame e ausência de erro inesperado no console |
| Adapter estritamente pass-through | prova do consumidor | nenhuma prova própria se não contiver branch, mapping ou validação |

Evidence:

- `supabase/migrations/20260915180826_r1_01_tenant_auth_rls.sql`: `roadmaps_update_admin` hoje proíbe CLIENT; a nova RPC terá decisões de papel, membership, módulo, tier igual/diferente e escrita transacional.
- `app/src/projects/project-service.ts`: o serviço existente encaminha uma única consulta e não decide estados; o dashboard exigirá decisões novas para progresso, vazios e apresentação dos campos.
- `app/src/App.tsx`: todas as rotas do projeto apontam hoje para um placeholder; a troca cria decisões de módulo e acesso na fronteira de navegação.
- Analogia mais próxima: `app/src/App.test.tsx` já prova guards/rotas com Testing Library, e `supabase/tests/r1_01_tenant_auth_rls.test.sql` enumera acesso no próprio nível.
- `app/package.json` não declara Playwright nem script E2E; esse vazio não reduz C17 e precisa ser fechado na implementação.

Cost: aproximadamente 17 testes nomeados de UI/domínio, uma suíte pgTAP para a RPC e uma história Playwright parametrizada nas duas larguras. Sem essa soma, a RPC e as regras responsivas seriam provadas só por caminhos que as atravessam.

## Checks

### S1 — Shell e estados de acesso · 5 arquivos existentes · 10.294 bytes · ~3k tokens

- [ ] **C1 — acesso efetivo `INICIAL_15_DIAS` mostra o título e o apoio literais e a navegação 01–06 na ordem normativa.** Prova: `npm test -- --run src/clientDashboard.test.tsx -t "C1 shell inicial e ordem dos seis módulos"` em `app/`.
- [ ] **C2 — durante `INICIAL_15_DIAS`, as duas frases literais do aviso de 15 dias aparecem.** Prova: `npm test -- --run src/clientDashboard.test.tsx -t "C2 aviso de quinze dias"` em `app/`.
- [ ] **C3 — em `ATIVO_ATE_FIM_DO_PROJETO`, nenhuma das duas frases do aviso de 15 dias aparece.** Prova: `npm test -- --run src/clientDashboard.test.tsx -t "C3 acesso ativo omite aviso"` em `app/`.
- [ ] **C4 — em `EXPIRADO`, cada uma das seis rotas `/p/:projectId/*` renderiza o estado expirado, não renderiza conteúdo do projeto e a RLS retorna zero roadmap/itens ao CLIENT.** Provas: `npm test -- --run src/clientDashboard.test.tsx -t "C4 expirado cobre as seis rotas"` em `app/`; `supabase test db supabase/tests/r1_05_dashboard_client.test.sql --local` com o teste pgTAP `C4 expired client reads zero dashboard data`.
- [ ] **C5 — a 375 px, os seis módulos continuam alcançáveis por teclado/toque e o módulo corrente é identificável.** Prova planejada: `npm run test:e2e -- e2e/r1-05-dashboard-cliente.spec.ts --project=chromium -g "C5 navegação mobile alcança seis módulos"` em `app/`. **Bloqueado por Unresolved 1 e pela ausência atual do runner.**

### S2 — Como funciona e tiers · 4 arquivos existentes/análogos · 42.322 bytes · ~11k tokens

- [ ] **C6 — módulo 01 mostra `stack`, `costs`, `next_steps` e `references` publicados, seguido pelos dois textos literais dos três caminhos.** Prova: `npm test -- --run src/clientDashboard.test.tsx -t "C6 conteúdo publicado e três caminhos"` em `app/`.
- [ ] **C7 — Essencial, Básico e Completo aparecem nessa ordem, com escopo, profundidade, exclusões, complexidade e prazo em dias; `valor_centavos` e `faixa` aparecem somente quando não nulos; os cards ficam numa fileira a 1440 px e empilhados a 375 px.** Provas: `npm test -- --run src/clientDashboard.test.tsx -t "C7 três tiers campos e nulidade de preço"`; `npm run test:e2e -- e2e/r1-05-dashboard-cliente.spec.ts --project=chromium -g "C7 tiers desktop e mobile"` em `app/`. **Bloqueado por Unresolved 1 e pela ausência atual do runner.**
- [ ] **C8 — a primeira escolha de tier persiste `roadmaps.preferred_tier`, cria exatamente um evento com o tier e permanece marcada após reload; tier inválido ou projeto sem acesso é rejeitado sem escrita.** Provas: `supabase test db supabase/tests/r1_05_dashboard_client.test.sql --local` com os testes `C8 first tier preference is atomic` e `C8 invalid or unauthorized preference is rejected`; `npm run test:e2e -- e2e/r1-05-dashboard-cliente.spec.ts --project=chromium -g "C8 preferência persiste após reload"` em `app/`.
- [ ] **C9 — escolher outro tier desmarca o anterior, marca somente o novo e acrescenta exatamente um evento; repetir o tier atual não acrescenta evento, provisoriamente conforme `Unresolved 6`.** Provas: `supabase test db supabase/tests/r1_05_dashboard_client.test.sql --local` com os testes `C9 changed tier adds one event` e `C9 same tier is a no-op`; `npm test -- --run src/clientDashboard.test.tsx -t "C9 seleção exclusiva troca de tier"` em `app/`.

### S3 — Protótipo e Etapas do plano · 5 arquivos/referências · 72.878 bytes · ~18k tokens

- [ ] **C10 — módulo 02 coloca `prototype_url` em um `iframe` dentro do mockup de celular; um link do protótipo altera a URL/documento dentro do frame; o link “abrir em nova aba” fica sempre visível provisoriamente.** Prova planejada: `npm run test:e2e -- e2e/r1-05-dashboard-cliente.spec.ts --project=chromium -g "C10 protótipo navega dentro do mockup"` em `app/`. **Bloqueado pela divergência entre as fontes e pela ausência atual do runner.**
- [ ] **C11 — módulo 03 mostra A fazer, Em andamento e Concluído nessa ordem, cada item com título, fase, macroversão e data planejada, ordenado provisoriamente por `position` e `scheduled_date`, e arredonda `concluido / total` ao inteiro mais próximo, incluindo 17/27 = 63%.** Provas: `npm test -- --run src/clientDashboard.test.tsx -t "C11 Kanban leitura ordem campos e progresso"`; `npm run test:e2e -- e2e/r1-05-dashboard-cliente.spec.ts --project=chromium -g "C11 Kanban 17 de 27 mostra 63 por cento"` em `app/`.
- [ ] **C12 — módulo 03 não oferece controle para mover/concluir item e uma tentativa CLIENT de `insert`, `update` ou `delete` em `kanban_items` não altera linha alguma.** Provas: `npm test -- --run src/clientDashboard.test.tsx -t "C12 Kanban do cliente é somente leitura"` em `app/`; `supabase test db supabase/tests/r1_05_dashboard_client.test.sql --local` com o teste `C12 client cannot mutate kanban items`.

### S4 — Bloqueios, vazios, acessibilidade e gates · 6 arquivos/toolchain · 179.595 bytes · ~44k tokens

- [ ] **C13 — módulo 04 bloqueado mostra exatamente as duas frases normativas do Editor e nenhum editor interativo.** Prova: `npm test -- --run src/clientDashboard.test.tsx -t "C13 Editor bloqueado usa copy exata"` em `app/`.
- [ ] **C14 — módulo 05 bloqueado mostra exatamente as duas frases normativas de Versões e nenhum histórico de versões.** Prova: `npm test -- --run src/clientDashboard.test.tsx -t "C14 Versões bloqueadas usa copy exata"` em `app/`.
- [ ] **C15 — módulo 06 mostra estado bloqueado e nenhum controle ou arquivo, mantendo a copy provisória marcada para revisão.** Prova: `npm test -- --run src/clientDashboard.test.tsx -t "C15 Marca e arquivos permanece bloqueado"` em `app/`.
- [ ] **C16 — `published_at = null` produz vazio, não erro, nos módulos 01 e 02; zero `kanban_items` produz vazio, não erro, no módulo 03.** Prova: `npm test -- --run src/clientDashboard.test.tsx -t "C16 vazios de roadmap protótipo e Kanban"` em `app/`.
- [ ] **C17 — build, lint e `tsc -b` passam; uma história E2E real percorre C1–C16 em 375 px e 1440 px, cobre loading, erro/retry, vazio, bloqueado, expirado e sucesso, falha em console error inesperado, usa teclado com foco visível e encontra label/nome acessível em todo controle.** Provas: `npm run build`; `npm run lint`; `npx tsc -b --pretty false`; `npm test -- --run src/clientDashboard.test.tsx`; `supabase test db supabase/tests/r1_05_dashboard_client.test.sql --local`; `npm run test:e2e -- e2e/r1-05-dashboard-cliente.spec.ts --project=chromium -g "C17 história completa nas duas larguras"`, todos em seus diretórios declarados. **A última prova não existe até o runner Playwright ser adicionado.**

## Swept

- validation: C7 cobre nulidade dos campos opcionais; C8 cobre enum inválido, projeto inexistente/sem acesso e membership `CLIENT`.
- failure modes: C16; C17 cobre loading e erro de rede com retry; falha de frame permanece provisoriamente no link externo de `Unresolved 4`.
- idempotency and retry: C9 cobre o no-op provisório para o mesmo tier; C17 cobre retry da leitura sem duplicar escrita.
- authorization: C4, C8 e C12 somam UI, RPC e RLS; os guards existentes da R1-01 continuam na regressão.
- concurrency and ordering: última escrita diferente vence e cada mudança gera um evento (C8/C9); a RPC transacional impede preferência sem seu evento; nenhuma garantia além disso foi pedida.
- data lifecycle: nada é apagado; eventos continuam append-only; arquivamento fica em F4-13.
- external-dependency failure: C10 mantém link externo provisório; comportamento final do `iframe` quebrado segue aberto em `Unresolved 4`.
- state transitions: C1–C4 cobrem `INICIAL_15_DIAS`, `ATIVO_ATE_FIM_DO_PROJETO` e `EXPIRADO`; C8/C9 cobrem preferência inicial, troca e repetição.
- observability: C8/C9 exigem um `activity_events` por mudança e zero em no-op; nenhuma função de servidor nova exige logs.

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| estados de acesso efetivo (3) | `INICIAL_15_DIAS` C1–C2 · `ATIVO_ATE_FIM_DO_PROJETO` C3 · `EXPIRADO` C4 | - |
| módulos da sidebar (6) | `como_funciona` C1/C6 · `prototipo` C1/C10 · `etapas` C1/C11 · `editor` C1/C13 · `versoes` C1/C14 · `marca` C1/C15 | - |
| tiers (3) | `essencial` C7–C9 · `basico` C7–C9 · `completo` C7–C9 | - |
| transições de preferência (3) | `null -> tier` C8 · `tier A -> tier B` C9 · `tier A -> tier A` C9 | - |
| campos obrigatórios por tier (5) | `escopo` C7 · `profundidade` C7 · `exclusões` C7 · `complexidade` C7 · `prazo_dias` C7 | - |
| campos opcionais por tier (2) | `valor_centavos` nulo/não nulo C7 · `faixa` nula/não nula C7 | - |
| dados de Como funciona (4) | `stack` C6 · `costs` C6 · `next_steps` C6 · `references` C6 | - |
| status Kanban (3) | `a_fazer` C11 · `em_andamento` C11 · `concluido` C11 | - |
| campos de item (4) | `title` C11 · `phase` C11 · `macro_version` C11 · `scheduled_date` C11 | - |
| operações CLIENT em Kanban (3) | `insert` C12 · `update` C12 · `delete` C12 | - |
| larguras exigidas (2) | `375px` C5/C7/C17 · `1440px` C7/C17 | composição aprovada de 375 px e dos tiers — `Unresolved 1` |
| estados de tela (7) | loading C17 · erro/retry C17 · sucesso C1/C6/C10/C11 · vazio C16 · bloqueado C13–C15 · expirado C4 · não autorizado regressão R1-01/C17 | copy final do expirado/vazios/06 — `Unresolved 2`; erro final do iframe — `Unresolved 4` |
| designed screens (10) | shell inicial C1–C3 · expirado C4 · Como funciona C6–C9 · Protótipo C10 · Etapas C11–C12 · Editor C13 · Versões C14 · Marca C15 · vazios C16 · loading/erro C17 | todos carecem do artefato `Needs design 1`; C5/C7 estão explicitamente bloqueados |
| assemblies do app (2) | produção em `app/src/main.tsx` C17 · harness jsdom em `app/src/clientDashboard.test.tsx` C1–C16 | configuração Playwright ainda inexistente |

- Claims que nomeiam rota, RPC ou shape de resposta: C4, C5, C8, C9, C10 e C12; cada um exige ao menos uma prova que cruza a fronteira real (Playwright ou pgTAP/RLS), não somente helper isolado.
- C17 não pode ser fechado por inspeção manual ou jsdom: o denominador exigido é 2 viewports, 7 estados de tela e todos os controles presentes na história.

## Handoff

- Piso de leitura por fatia, medido nos arquivos existentes/análogos tocados: S1 ~3k tokens; S2 ~11k; S3 ~18k; S4 ~44k (inclui o lockfile que mudará com o runner). Total conservador ~76k tokens, abaixo do orçamento padrão de 150k.
- Build cabe em um único lote S1–S4; não há corte horizontal nem handoff entre builders. `handoff: on` continua aplicável se o desenho aprovado ampliar a superfície acima desse piso.
- A ordem obrigatória é: resolver `Unresolved 1` e a divergência de C10; adicionar a prova E2E; então implementar o lote inteiro. Nenhum código começa sob o checklist bloqueado.
- A verificação final é de um agente fresco, recebe este checklist, todas as fontes binding, o diff completo da feature e `verify.md`, e roda somente depois do último commit funcional.
- Nenhum reset, teste mutante, commit, remoto ou alteração de guideline pertence à fase de planejamento concluída por este arquivo.
