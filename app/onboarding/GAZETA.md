# Gazeta Bragantina no painel da nó

Produção: https://app.notechstack.com.br/p/fa681812-5c4a-4868-bf9d-699442ec7c52/como-funciona

Cliente e projeto cadastrados em 23/09/2026, vinculados à Maisis Publicidade.
Papel CLIENT, acesso ativo até o fim do projeto. Login real validado; vê somente
Portal Gazeta Bragantina e nenhum projeto administrativo. Senha não armazenada.
Operador Maisis ainda não provisionado em produção.

O dashboard é o mesmo componente/layout usado pelo Espaço Saúde Mental. Conteúdo
específico vem de roadmaps.stack.architecture e next_steps.presentation/task_details.
Etapas: cinco fases originais, 30 tarefas, 27 concluídas (90%), notas preservadas;
sem inventar datas, preços ou versões. Estado: EM_REVISAO_CLIENTE; Editor bloqueado.
Protótipo: 126 arquivos do pacote de aprovação de 15/09, copiados sem alterar a origem.
797 referências relativas verificadas, nenhuma ausente. Navegação home → notícia
verificada em produção e iframe confirmado dentro da aba do cliente autenticado.

Fonte: C:/Users/lucca/projetos/gazeta_bragantina/painel-controle/index.html.
Snapshot: gazeta-bragantina.json. Transação de cadastro: gazeta-production.sql.
O script scripts/onboard-gazeta-local.mjs é exclusivo do banco Docker local;
não cria usuários nem deve ser usado em produção.

Migrations agency_console e client_agency_branding aplicadas via Supabase MCP.
Deploy READY: dpl_HYVJaQQdcoLw1Q4UWZuj4NRr3VEm, projeto notechstack-app.
Publicações iniciais manuais; código consolidado na branch codex/gazeta-client-dashboard.
Build e lint passaram; 53 testes anteriores + 4 novos casos do dashboard passaram;
21 verificações locais de isolamento das agências passaram com rollback.

Advisors: sem apontamentos específicos nas novas tabelas/RPCs. Avisos existentes
sobre funções privilegiadas do legado, pg_net e proteção de senhas não foram
alterados. Referência: https://supabase.com/docs/guides/database/database-linter

Escopo aprovado: opção B, Portal + comunidade, conforme proposta Maisis de junho de 2026.
Comparativo A/B/C apresentado sem valores ou margens por solicitação do Lucca;
PDF comercial não publicado. Atualização de conteúdo em gazeta-approved-scope.sql.

Publicação do comparativo sem valores: dpl_5cqn3v8YgW3GH9dKkJXh1eqd7ZGs,
23/09/2026. Build, lint e 33 testes de dashboard aprovados.

Datas combinadas informadas pelo Lucca: início 22/07/2026, entrega entre
09/09/2026 e 23/09/2026 (7–9 semanas). Resumo da aba Etapas usa essas datas,
sem atribuir datas artificiais às tarefas individuais. Navegação Meus projetos
oculta para a Gazeta, inclusive o link da marca; demais clientes preservados.
Deploy das datas e navegação: dpl_Acv9pAoKR1eLaX4Jx8PREgP8Qr2e. Build, lint e 33 testes do dashboard aprovados.

Console Maisis: projeção autorizada inclui início, janela acordada e estado da revisão
(migration 20260923203346_agency_project_schedule.sql). Não cria versão publicada fictícia.
Validação da consolidação: build, lint, 58 testes do aplicativo e 21 verificações SQL
de isolamento. Provisionamento do operador aguarda renovação da autenticação administrativa
da CLI Supabase; conexão de banco via MCP permanece disponível.
