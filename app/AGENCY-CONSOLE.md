# Console de agências

> Estado atualizado em 23/09/2026: console e branding migrados e frontend publicado
> em produção, após autorização. Maisis vinculada à Gazeta Bragantina; projeto
> `fa681812-5c4a-4868-bf9d-699442ec7c52`. Login CLIENT da Gazeta validado, Editor
> bloqueado e protótipo dentro do dashboard padrão. O operador Maisis segue somente
> local. As seções de implementação local abaixo documentam a etapa anterior.
> Deploy: `dpl_HYVJaQQdcoLw1Q4UWZuj4NRr3VEm`. Ver `onboarding/GAZETA.md`.

Implementação local em 23/09/2026, tomando como referência o console Green Marketing
em `C:/Users/lucca/projetos/roteador/roteador-console-green` e a nota Roteador Console do vault.

## Modelo e escopo

O admin da nó (`NO_ADMIN`) continua com a operação completa em `/no/*`.
O console em `/agencia` agrega somente os projetos vinculados à agência do operador:
clientes, projetos ativos, revisão, tarefas atrasadas, próximas entregas, tarefas e versões publicadas.
O console é de acompanhamento, como a referência Green. Não replica as operações de
cobrança, publicação, arquivamento ou edição do admin global.

`/no/agencias` permite criar agências e associar/remover projetos existentes. Cada projeto
tem no máximo uma agência; uma agência pode ter vários operadores e projetos, e um operador
pode pertencer a várias agências. Vários projetos do mesmo cliente contam como um cliente.
Vincular um projeto não compartilha automaticamente outros projetos desse cliente.

## Segurança

- `agencies`, `agency_members`, `agency_projects`: RLS; só NO_ADMIN altera os vínculos.
- Papel `AGENCY_ADMIN` em `app_metadata` serve ao destino pós-login. A autorização vem do
  vínculo persistido e da agência ativa, nunca do papel sozinho, do slug ou de `user_metadata`.
- RPCs públicas invoker chamam funções restritas no schema não exposto `agency_private`.
  As funções privilegiadas verificam o usuário e o vínculo antes de agregar campos explícitos.
- Revogar vínculo/desativar agência bloqueia a próxima consulta, mesmo com token ainda válido.
- Nenhuma política existente de CLIENT ou NO_ADMIN foi ampliada. A agência não recebe acesso
  às tabelas de projetos nem aos endpoints administrativos globais.
- E-mails de clientes, respostas de diagnóstico, notas comerciais, payloads internos e
  referências técnicas de builds não são enviados ao console.
- Não expor `agency_private` nos schemas da Data API.

## Estado local

Migrations, nesta ordem:
1. `supabase/migrations/20260923184845_agency_console.sql`.
2. `supabase/migrations/20260923194346_client_agency_branding.sql`.

Aplicadas somente ao Postgres Docker local já existente.
Conta `contato@maisispublicidade.com.br` criada somente no Auth local, com papel AGENCY_ADMIN
e membership Maisis. Senha não armazenada em arquivos.

Por solicitação do Lucca, a Maisis está sem clientes/projetos vinculados. O vínculo do
projeto local de planejamento da Gazeta foi removido; a Gazeta real será cadastrada depois.
O frontend segue as duas referências fornecidas: carteira em linhas, hero escuro com
indicadores e detalhe com Kanban, histórico de versões e informações. Mantém os três
status de tarefa existentes e o acesso de acompanhamento, sem ações de edição fictícias.
O servidor de revisão usa variáveis de processo para o Supabase local e
`VITE_AGENCY_LOCAL_PREVIEW=true` para sinalizar esse estado. Nenhum `.env` foi lido ou alterado.

## Ativação real pendente

Após autorização de migração em produção:
1. Confirmar o Supabase usado pelo app e verificar o schema atual.
2. Aplicar as duas migrations na ordem acima antes de publicar o frontend: o painel do cliente
   passa a consultar a RPC de branding. Conferir RLS e manter `agency_private` não exposto.
3. Criar/reutilizar a agência Maisis com `logo_url=/agencies/maisis/logo.png`, mantendo a carteira
   vazia. A Gazeta será vinculada somente após o pedido de cadastro definitivo.
4. Criar a conta pelo Auth Admin API (verificar previamente se já existe; não sobrescrever senha
   ou elevar uma conta existente silenciosamente), com `app_metadata.role=AGENCY_ADMIN`.
5. Inserir o vínculo em `agency_members`; não atribuir NO_ADMIN.
6. Publicar o frontend após autorização de deploy e validar login/acesso com a conta real.

## Verificação

Teste de isolamento real de banco (21 verificações, transação com rollback):
`Get-Content supabase/tests/agency_console.sql -Raw | docker exec -i supabase_db_sdeowbqmwkwseyktyemn psql -U postgres -d postgres -v ON_ERROR_STOP=1`

Interface: `npm run test -- --run src/agencyConsole.test.tsx src/App.test.tsx` em `app/`.
Build: `npm run build`. Lint: `npm run lint`.

A suíte completa passou em 173 testes; dois testes antigos de `pipelineExamples.test.ts`
falham por dependências externas ao escopo: a Gazeta em outro repo tem 34 tarefas
(o teste espera 27), e `home-no-prototipo/hello-deliverable.js` está ausente.
Build e lint passaram. O build mantém o aviso de chunk principal acima de 500 kB.
Os testes de isolamento de banco passaram nas 21 verificações.

A implementação foi integrada sobre `cfe5b19` (PR #27), preservando o redesenho mais
recente do painel, seu seletor de tema e o carregamento das páginas administrativas sob demanda.

## Marca no painel do cliente

O painel CLIENT continua com seus módulos normais. Quando o projeto pertence a uma agência,
o topo mostra sua logo oficial (`agencies.logo_url`) e o rodapé do menu lateral mostra a nó.
Sem imagem válida, o topo usa o nome da agência. Projetos diretos mantêm a nó no topo.
`get_client_project_branding` verifica `can_read_project` e retorna somente nome/logo;
não dá ao cliente acesso à carteira ou às tabelas de agências.

A prévia `/__preview/cliente-agencia/etapas` existe somente em desenvolvimento com
`VITE_AGENCY_LOCAL_PREVIEW=true`, usa dados em memória e não cadastra clientes.
O módulo de prévia não integra o bundle de produção.

## Skills de cadastro

As skills `no-criar-agencia` e `no-criar-cliente` estão versionadas em `.agents/skills/`
na raiz do repo e instaladas também em `C:/Users/lucca/.codex/skills/` nesta máquina.
Ao atualizá-las, mantenha as cópias sincronizadas. Elas documentam deduplicação, permissões,
carteira inicialmente vazia e herança da marca da agência pelo projeto.
