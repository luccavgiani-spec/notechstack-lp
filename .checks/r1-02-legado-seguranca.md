# R1-02 · Isolar riscos do legado — checklist de implementação

## Profile

`light`

## Sources

- `.tasks/r1-02-legado-seguranca.md` — fonte normativa dos oito critérios e duas decisões.
- `fluxos_ref/plan_master.md` §8.2 e Aceite 08 — riscos conhecidos e preservação do funil.
- `supabase/migrations/20260423195849_meta_integration_core.sql` — policies e FKs atuais.
- `supabase/migrations/20260814190000_rastreio_jornada.sql` e `20260814190500_registrar_eventos.sql` — tabelas e RPC do funil.
- `supabase/functions/track-evento/index.ts` e `supabase/functions/painel-dados/index.ts` — contratos funcionais preservados.
- Advisors read-only do projeto `sdeowbqmwkwseyktyemn`, medidos em 15/09/2026 — baseline: 4 `security_definer_view`, 4 FKs sem índice e 7 `auth_rls_initplan`.
- Documentação Supabase de RLS — padrão `(select auth.jwt())` e views `security_invoker`.

## Out of scope

- Corrigir `public.set_updated_at` com `search_path` mutável ou mover `pg_net`.
- Apagar views/tabelas Meta ou remover índices marcados apenas como não usados.
- Criar policies em `lead_sessoes`/`lead_eventos`, cujo acesso exclusivo por service role é intencional.
- Resolver o grant direto de `anon` em `ad_accounts` (Unresolved 4), além de registrá-lo como risco.
- Alterar lógica do funil, conteúdo de leads ou dados reais.
- Push, deploy de funções, DNS e publicação do app; permanecem adiados até o fim das tasks.

## Landing

| Door | Estado | Decisão |
|---|---|---|
| Baseline remoto dos advisors | resolvida por leitura em 15/09/2026 | os 4 + 4 + 7 achados da task foram reconfirmados sem escrita remota. |
| Forma da migration | decidida | uma migration nova criada por `supabase migration new`, reexecutável: `alter view`, `revoke`, `create index if not exists`, `drop policy if exists` + `create policy`. |
| Replay local das views `thais_*` | resolvida por captura read-only em 15/09/2026 | reproduzir na migration as definições hospedadas exatas via `create or replace view ... with (security_invoker = true)`; alternativa rejeitada: `alter view` isolado, pois as views não existiam no histórico local e quebrariam `db reset`. |
| Aplicação da migration no Supabase hospedado | autorizada pela fonte da task, mas só após provas locais | medir contagens antes, aplicar apenas a migration R1-02 e então medir advisors/contagens; não executar push/deploy/DNS. |
| Token do painel em produção | resolvido pelo operador em 15/09/2026 | sem expor o secret ao agente, Lucca abriu o painel local, informou o token diretamente no navegador e confirmou que o painel hospedado carregou; o próprio cliente só revela o app depois de `response.ok` da Edge Function. |
| Escrita de funil em produção | proibida pela própria task | C8 grava somente no Supabase local; produção recebe apenas leitura autenticada do painel. |

## Checks

- [x] **C1 — anon e authenticated recebem 42501 nas quatro views `thais_*`.** Prova local: pgTAP troca os dois papéis, executa `select` em cada view e afirma oito erros `42501`.
- [x] **C2 — service role mantém a leitura do cliente fixo.** Fixtures X/Y nas tabelas Meta e pgTAP afirmam que cada uma das quatro views retorna apenas linhas de `75d5ccc3-054a-452d-9dc0-cbf87ddd0758` sob service role.
- [x] **C3 — zero `security_definer_view` nas quatro views.**
  - [x] Local: catálogo confirma `security_invoker=true` nas quatro views e advisor security local não lista nenhuma delas.
  - [x] Hospedada: advisor read-only após aplicação em 15/09/2026 retornou zero `security_definer_view`; os demais avisos são os itens explicitamente fora de escopo.
- [x] **C4 — quatro FKs passam a ter índice de cobertura.**
  - [x] Local: catálogo/pgTAP cobre `lead_sessoes_lead_id_fkey`, `scheduled_posts_account_id_fkey`, `scheduled_posts_client_id_fkey`, `sync_logs_account_id_fkey` e advisor local zera esses nomes.
  - [x] Hospedada: advisor read-only após aplicação retornou zero `unindexed_foreign_keys`.
- [x] **C5 — sete policies usam initplan.**
  - [x] Local: pgTAP inspeciona as expressões das sete policies e advisor local não lista `auth_rls_initplan` nesses nomes.
  - [x] Hospedada: advisor read-only após aplicação retornou zero `auth_rls_initplan`.
- [x] **C6 — semântica tenant X/Y permanece igual.** JWT local com claim `client_id=X` lê somente X em `ad_metrics_daily` e `scheduled_posts`; assertions excluem Y.
- [x] **C7 — migration hospedada não reduz dados do funil.** Medição imediatamente anterior em 15/09/2026 19:11:41 UTC: `leads=17`, `lead_sessoes=64`, `lead_eventos=568`; medição posterior em 19:11:55 UTC: `17`, `64`, `568`. Todos os valores posteriores são iguais aos anteriores.
- [x] **C8 — painel continua lendo e `track-evento` continua gravando.**
  - [x] Local: functions servidas com configuração sintética; `painel-dados?v=funil&dias=7` respondeu 200 e lote N em `track-evento` gerou exatamente N novas linhas em `lead_eventos`.
  - [x] Hospedada: em 15/09/2026, Lucca abriu `painel-leads.html`, informou o `PAINEL_TOKEN` diretamente no navegador e confirmou que o painel carregou. O cliente em `busca()` só troca o gate pelo painel após `fetch(.../painel-dados)` retornar `response.ok`; 401 ou qualquer outro HTTP não-2xx mantém erro visível. O token não foi lido, copiado nem enviado ao agente.

## Swept

- validation: n/a — nenhuma entrada nova.
- failure modes: C7 e C8.
- idempotency and retry: migration reexecutável e prova por reset local repetido.
- authorization: C1, C2 e C6.
- concurrency and ordering: DDL transacional; nenhuma nova escrita concorrente.
- data lifecycle: C7.
- external-dependency failure: n/a — nenhuma integração nova.
- state transitions: n/a.
- observability: C3, C4 e C5 via advisors.

## Coverage

| Conjunto enumerado | Cobertura |
|---|---|
| views: `thais_ad_accounts`, `thais_ad_metrics`, `thais_social_metrics`, `thais_scheduled_posts` | C1–C3 |
| papéis: `anon`, `authenticated`, `service_role` | C1, C2 |
| FKs: `lead_sessoes_lead_id_fkey`, `scheduled_posts_account_id_fkey`, `scheduled_posts_client_id_fkey`, `sync_logs_account_id_fkey` | C4 |
| policies: `clients_read_own`, `ad_metrics_read_own`, `social_metrics_read_own`, `scheduled_posts_read_own`, `scheduled_posts_insert_own`, `scheduled_posts_update_own`, `ad_accounts_read_own` | C5, C6 |
| dados preservados: `leads`, `lead_sessoes`, `lead_eventos` | C7 |
| portas do funil: `painel-dados`, `track-evento`, `registrar_eventos` | C8 |

## Handoff

- Tamanho estimado: ~62 kB; lote único local de SQL, pgTAP e regressão das duas funções.
- O builder termina em commit convencional somente após reset/testes/advisors locais.
- A etapa hospedada só começa após revisão do diff e das contagens prévias; a parcela remota de C8 foi concluída pelo operador diretamente no navegador, sem compartilhar o secret.
- Verificador independente fresco roda depois do último commit local e novamente após eventual prova hospedada.
- No encerramento do lote local, C1, C2 e C6 estavam fechados e as parcelas locais de C3–C5 e C8 estavam verdes; a etapa hospedada posterior está registrada abaixo.
- Definição resolvida durante o build: as quatro views foram reproduzidas pelas definições hospedadas exatas capturadas read-only, já registrada em `Landing`; nenhuma outra clarificação mudou checks ou escopo.
- Abandonado: `supabase db query --file` para a prova adicional de reaplicação, pois a CLI 2.95.4 rejeitou o arquivo multi-statement; a mesma migration foi reaplicada no Postgres local via `psql -v ON_ERROR_STOP=1`, e o pgTAP continuou verde.
- Etapa hospedada em 15/09/2026: migration `r1_02_isolate_legacy_risks` aplicada com sucesso após todas as provas locais; C3, C4, C5 e C7 fecharam. C8 foi fechada depois por confirmação do operador no cliente real, com o secret mantido fora do chat e do código.
