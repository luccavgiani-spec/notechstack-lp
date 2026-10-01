# Acompanhamento: agentes do hub de marketing

Painel do coordenador (Codex, chat atual; assumido em 01/10/2026). Ele é a memória entre turnos e sessões: o chat de 01/10 vai
ser apagado pelo Lucca. Atualize depois de cada relatório de agente.

## Tarefas (fonte da verdade dos critérios)

| Tarefa | Arquivo |
|---|---|
| T1 — Fechar o movimento (Fase A) | `.tasks/hub-marketing-fechar-movimento.md` |
| T2 — Melhorias, 1ª entrega | `.tasks/hub-marketing-melhorias-entrega-1.md` |
| T3 — Mapa de mercado | `.tasks/mercado-agencias-software.md` |

Base: branch local `claude/hub-marketing-continuacao` (`e87ada92`), checkout em
`.claude/worktrees/suspicious-hypatia-6f295c`. Os agentes trabalham em worktrees próprios criados a
partir dela e fazem só commits locais, sem push. O coordenador integra.

## Agentes

| Agente | Worktree / branch | Arquivos que são dele | Critérios |
|---|---|---|---|
| A — frontend | `.claude/worktrees/hubmkt-frontend` / `hub-mkt/frontend` | `app/src/marketing/**`, `app/src/App.tsx` (só as rotas `conexoes` e `leads`), `app/src/marketingPlanner.test.tsx`, `app/src/App.test.tsx`, `app/e2e/hub-marketing.spec.ts` | T2: telas de 1, 4–7, 9, 10–12, 14–15, 23–24; 17–21 inteiros; T1: botão de 17–20 |
| B — supabase | `.claude/worktrees/hubmkt-supabase` / `hub-mkt/supabase` | `supabase/functions/_shared/marketing/**`, `supabase/functions/marketing-hub/**`, `supabase/migrations/` (novas), `supabase/rollback/`, `supabase/tests/`, `app/src/marketingAdapters.test.ts`, `app/src/marketingHub.test.ts` | T2: backend de 1–4, 6, 8–14, 16, 22–27 (migration `lead_classificacao`); T1: 4–5 (Facebook). Não mexe em `google-auth.ts` nem em `googleCred()`/`adsCtx()` (são do C) |
| C — google | `.claude/worktrees/hubmkt-google` / `hub-mkt/google` | `docs/movimentos/2026-09-30-hub-marketing-agentes/rotacao-segredos.md`; depois do diagnóstico: `_shared/marketing/google-oauth.ts` (novo), `_shared/marketing/google-auth.ts`, bloco de rotas `google/*` e `googleCred()` em `handler.ts`, métodos de Vault em `store.ts`, migration nova de RPC do Vault | T1: diagnóstico de 1–2, Unresolved 3, 16, backend de 17–22 |
| D — dot e mercado | `.claude/worktrees/hubmkt-dot-mercado` / `hub-mkt/dot-mercado` | `docs/mercado/2026-10-agencias-software/**`, `docs/movimentos/2026-09-30-hub-marketing-agentes/roteiro-dot.md` | T3: 1–7; T1: roteiro de 6–8 |
| Coordenador | `suspicious-hypatia-6f295c` | `.tasks/**`, `execution.md`, integração, gates de produção | T1: 9–15; verificação de tudo |

**Contrato entre A e B:** decisões 1–3 de T2. B não muda o formato fora do Decided. A trabalha contra
o formato do Decided, com mocks, até B entregar.

## Regras que valem para todo agente (copiar no prompt)

- Nunca ler `.env*`. Nunca escrever, colar ou imprimir valor de token, chave, senha ou segredo em arquivo, commit, log ou relatório.
- Nunca criar conta, digitar credencial, conceder OAuth, aceitar termos, publicar, gastar, ativar campanha nem mudar configuração de conta. Navegador só para leitura.
- Nada em produção: sem `apply_migration`, deploy, `git push`, PR nem merge. O coordenador pede ao Lucca.
- Não mexer em `meta-capi`, `track-evento`, `painel-dados`, `save-lead-progress`, `send-lead-email`, checkout, `brand/`, nem no "Conversions API System User".
- `execute_sql` (MCP Supabase) só para leitura, e sem selecionar colunas pessoais de `leads` (nome, e-mail, WhatsApp).
- Só os arquivos da sua linha na tabela acima. Precisou de outro arquivo? Pare e reporte.
- Se um critério pedir decisão que está em `Unresolved`, pare e reporte. Não decida.
- Relatório: critérios por número → comando de prova → resultado real; arquivos alterados; commits locais; bloqueios.

## Loop

1. O coordenador despacha a fatia (tarefa, critérios e arquivos).
2. O agente implementa, roda a prova local mais barata, faz commit local e reporta.
3. O coordenador roda a prova de novo, integra na `claude/hub-marketing-continuacao` e atualiza este painel.
4. O coordenador manda a próxima fatia ou as correções (SendMessage ao mesmo agente).
5. Os gates de produção se acumulam na lista abaixo e vão ao Lucca de uma vez, com um OK por ação.

## Autorização permanente (Lucca, 01/10/2026, no chat)

"pode ir criando PR e merge + deploy conforme voce revisa o trabalho deles."

- **Coberto (sem perguntar de novo), desde que o coordenador tenha revisado o trabalho e rodado as provas de novo:**
  - push da branch, PR para a `main` e merge;
  - deploy da `marketing-hub` pelo MCP;
  - migrations destas tarefas por `apply_migration`, medindo antes e depois `leads`, `lead_sessoes` e `lead_eventos` e rodando os advisors.

  Ordem: migration → função → merge (o app publica na Vercel).
- **Fora disto, OK a cada vez:**
  - escritas de teste em conta real (G5);
  - posts reais (G4);
  - apagar as funções legadas (G7);
  - ativar campanha ou gastar.

## Gates do Lucca (pendentes)

| # | O quê | Por que é dele | Estado |
|---|---|---|---|
| G1 | Como conectar o Google | decisão | **respondido 01/10: botão no planner** (T1 17–22) |
| G2 | Classificação de leads | decisão (funil) | **respondido 01/10: tabela nova** (T2 22–27) |
| G2b | Adicionar o URI `https://sdeowbqmwkwseyktyemn.supabase.co/functions/v1/marketing-hub/google/callback` no client OAuth `no-hub` | config de conta | aberto (link exato vem do agente C) |
| G3 | Convidar `notechstack+dot@gmail.com` na aba Dot e abrir o link no navegador do dot | conta nova | aberto |
| G4 | Conteúdo dos posts do AC4 | publicação real | aberto |
| G5 | OK para cada escrita de teste (AC2, AC3, AC6) | gasto e produção | aberto |
| G6 | OK para migration, deploy da função e publicação do app | produção | **coberto pela autorização permanente de 01/10** |
| G7 | OK para apagar as 4 funções legadas | produção | aberto |
| G8 | Rotacionar os segredos de `rotacao-segredos.md` depois dos testes | credencial | aberto |

## Estado por critério

| Tarefa | Critérios | Dono | Estado | Evidência |
|---|---|---|---|---|
| T1 | 1–3 Google | C → Lucca | depende de 17–22 + G2b + G6 | — |
| T1 | 17–22 conectar Google | C (back) + A (botão) | diagnóstico em curso | — |
| T1 | 4–5 Facebook | B | a fazer | — |
| T1 | 6–8 dot | D → Lucca | bloqueado (G3) | — |
| T1 | 9–12 escritas | coordenador | bloqueado (G4, G5) | — |
| T1 | 13 AC1 | coordenador | depende de 1 | — |
| T1 | 14 legado | coordenador | bloqueado (G7) | — |
| T1 | 15–16 registro e rotação | coordenador / C | a fazer | — |
| T2 | 1–3, 22–27 leads | B + A | a fazer | — |
| T2 | 4–6 LPV | B + A | a fazer | — |
| T2 | 7–9 estados | B + A | a fazer | — |
| T2 | 10–13 conexões | B + A | a fazer | — |
| T2 | 14–16 definições | B + A | a fazer | — |
| T2 | 17–21 datas | A | a fazer | — |
| T3 | 1–7 mercado | D | a fazer | — |

## Diário

- 01/10/2026: Lucca respondeu G1 (botão Google no planner) e G2 (tabela `lead_classificacao`). Agentes A–D despachados.
- 01/10/2026: plano criado com tlc-plan. Estado de produção conferido às 20:37 UTC (só leitura): 0 dots, 0 `marketing_actions`, 4 funções legadas ACTIVE, Google em `unauthorized_client`, Facebook de 30 dias com erro (#10) `pages_read_user_content`.

## Coordenação atual — retomada Codex em 01/10/2026

- Gerenciador: Codex `/root`, por pedido direto do Lucca para seguir este painel e disparar os agentes.
- Checkout de integração preservado: `suspicious-hypatia-6f295c`, branch `claude/hub-marketing-continuacao`.
- A retomado como `/root/frontend`, no worktree existente `hubmkt-frontend`; revisão do trabalho herdado e conclusão de T2 frontend/T1 botão Google.
- B retomado como `/root/backend`, no worktree existente `hubmkt-supabase`; revisão do trabalho herdado e conclusão de T2 backend/T1 Facebook.
- C retomado como `/root/google`, no worktree existente `hubmkt-google`; revisão do trabalho herdado, OAuth e diagnóstico/rotação.
- D (dot e mercado) na fila: será despachado assim que uma das três vagas de subagente liberar. Limite desta sessão: coordenador + três agentes.
- Cada agente deve preservar mudanças herdadas, entregar commits locais e provas por critério. Integração e reexecução das provas ficam com o coordenador.
- Os estados antigos da tabela acima são históricos até a revisão das entregas herdadas; nenhum critério é considerado concluído apenas por existir código.
- Gates e autorização permanente deste documento continuam vigentes, com os mesmos limites.

### Contratos de retomada C (antes da implementação)

- Escopo C ampliado pelo coordenador para `app/src/marketingGoogleOAuth.test.ts`, isolando provas de OAuth dos testes B.
- T1:17: consentimento com escopos exatos e redirect de sucesso; T1:18: state ausente, expirado, repetido e concorrente sem troca ou gravação; T1:19: cancelamento/falha preservam token; T1:20: dot 403 e admin aal1 403; T1:21: Vault primeiro, falha do Vault não provoca fallback; T1:22: token e auditoria em transação única.
- Landing: consumo de state por `DELETE RETURNING` em RPC atômica (read/delete separado permitiria replay concorrente); gravação Vault e auditoria na mesma transação (evita sucesso parcial).
- Skill localizada: `C:/Users/lucca/.claude/skills/tlc-implement/SKILL.md`; perfil light. Verificador independente será despachado pelo coordenador depois da última integração. Um lote por agente nos limites de contexto, C estima ~20k tokens de leitura.
- Baseline de produção só leitura nesta retomada: leads 27; lead_sessoes 947; lead_eventos 898; backfill 10; marketing_actions 0; dots 0. Funções protegidas meta-capi/track-evento/painel-dados ACTIVE v17; marketing-hub ACTIVE v1; quatro legadas ACTIVE v18.
- Advisors anteriores à mudança: INFO RLS sem policy 12; WARN extensão pg_net pública 1, security definer anon 2, authenticated 32, proteção de senha vazada desativada 1. Revalidar imediatamente antes e depois de qualquer aplicação.

### Entregas A/B integradas nesta retomada

- A: commits de origem `6aded586`, `be301402`, `eb58aa32` integrados como `d1f9a05b`, `261a738a`, `bba9a9e0`; origem reporta 66 testes de UI/app, TypeScript e lint aprovados. Provas ainda serão repetidas no conjunto integrado. Limites: UI com mocks, sem OAuth ou Ads Manager real; estados/dicionário têm cobertura amostral.
- B: commits de origem `eb43ae71`, `226cc4a7` integrados como `adb31bc5`, `67d022e4`; origem reporta 99 testes adapters/handler e SQL PGlite aprovados. Migration `20261001214638` ainda não aplicada em produção. T1 4–5 e T2 4/16 reais seguem pendentes.
- Prova SQL local alternativa usa PGlite temporário fora do produto, pois Docker Desktop não disponibilizou daemon. Cobre 9/10/11 leads, atomicidade do aborto, RLS/grants/constraints e append-only; não equivale a Auth/PostgREST/Vault real.
- D despachado como `/root/mercado` no worktree `hubmkt-dot-mercado` após A concluir. Escopo T3 1–7 e roteiro T1 6–8. A linha anterior que o colocava na fila é histórica.

### Integração C e revisão independente — rodada 1

- C integrado: `1003a14a` → `b711fd20`; `3e7d919c` → `4d4b3d57`. Integração preserva autorização do dot nas operações Google existentes; somente `google/connect` fica exclusivo de admin. Chamadas Google aguardam leitura Vault; reconexão invalida cache `conexoes`.
- Checklist de provas: `.checks/hub-marketing-continuacao.md`. Verificador fresco `/root/verificador_codigo` assumiu T1/T2 após integração de todos os respectivos lotes. T3 terá rodada própria depois de D.
- Coordenador repetiu ambos scripts SQL PGlite: passaram. Reproduziu duas falhas de datas no commit pré-correção `6aded586`; as mesmas provas passam na implementação integrada.
- Verificador executou 184/184 Vitest e os dois scripts SQL, mas encontrou bugs não cobertos: formato de permissões Meta no frontend, propagação de estados de métricas e HTTP 500 para data impossível na API. Não liberar produção enquanto esses bugs não forem corrigidos e revisitados.
- API de datas corrigida em `ff7894e3` com quatro casos HTTP 422. Frontend reativado para correções no checkout de integração, com propriedade exclusiva de seus arquivos. Nenhuma ação de produção nesta retomada até aqui.
