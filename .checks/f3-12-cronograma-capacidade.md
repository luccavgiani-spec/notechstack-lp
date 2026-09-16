# F3-12 · Cronograma geral e capacidade

## Decisões confirmadas

- Capacidade: **5 itens por dia**, persistida em `operation_settings` e ajustável somente por `NO_ADMIN`.
- Ciclo proposto: uma janela inclusiva de 30 dias a partir do marco inicial; D+1, D+3, V1 no dia 15, retorno da revisão no dia 16, V2 no dia 22, retorno no dia 23 e V3 no dia 29. Dias já cheios são deslocados para a primeira vaga; se passarem da janela de 45 dias, a proposta sinaliza isso.
- A proposta nunca grava sozinha: a Nó a confirma ou descarta. Escritas concorrentes continuam com última escrita válida, conforme a task.

## Checks

- [x] **C1/C2** — `/no/cronograma` lê os itens de todos os projetos ativos, separa as três colunas e exclui arquivados; novos itens confirmados de um convertido entram na leitura seguinte. Proof: `f3_12_cronograma_capacidade.test.sql`, `schedulePage.test.tsx`.
- [x] **C3** — criar/atualizar pelo Cronograma reutiliza `upsert_admin_kanban_item`, que grava exatamente um evento por ação. Proof: pgTAP `C3 create emits exactly one event`; cobertura de transições do RPC preservada em R1-06.
- [x] **C4** — filtros por projeto, macroversão e intervalo de datas funcionam no quadro; o RPC aceita os mesmos limites. Proof: pgTAP e Testing Library.
- [x] **C5/C6** — carga dos próximos 45 dias conta apenas não concluídos; capacidade inicia em 5, é ajustável por `NO_ADMIN` e conflito pede confirmação antes de escrever. Proof: pgTAP e `schedulePage.test.tsx`.
- [x] **C7** — proposta de 30 dias respeita a capacidade, desloca dia cheio, inclui D+1/D+3/revisões/V1/V2/V3 e só grava após confirmação. Proof: `schedule-service.test.ts`, `schedulePage.test.tsx`.
- [x] **C8** — `CLIENT` recebe zero itens/configuração na API e a rota é barrada por `RoleRoute`. Proof: pgTAP e `App.test.tsx`.
- [x] **C9** — `npm run lint`, `npm run build`/`tsc -b`, Vitest integral (100) e pgTAP integral (329) passaram em 2026-09-15; `supabase db lint --local` e `supabase db advisors --local` não apontaram problemas.

## Guardrails

- Sem integração com agenda externa, deploy, mudança de DNS ou leitura de segredo.
- A configuração diária aceita de 1 a 100 itens; valores fora disso são rejeitados.
- O quadro vazio aponta para Projetos.
