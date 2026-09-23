---
name: no-criar-cliente
description: Cadastra ou reutiliza cliente e projeto no portal da nó (app.notechstack.com.br), associa à agência correta e configura acesso do cliente quando solicitado. Use para novo cliente, primeiro projeto ou vínculo de cliente de agência, verificando duplicidades. Não cria sites ou roteadores de telemedicina por si só.
---

# Criar cliente e projeto no portal da nó

Separe três operações: cadastro do cliente, cadastro/vínculo do projeto e liberação do acesso.
Criar um cliente não significa publicar roadmap, cobrar pagamento, dar login ao cliente ou
criar infraestrutura. Execute apenas as operações pedidas e já autorizadas.

## Fontes e ambiente

- Leia `C:/Users/lucca/Bot-vault/Bot/NUCLEO.md` e as instruções locais.
- Repo: `C:/Users/lucca/projetos/notechstack`, frontend em `app/`.
- Leia `app/AGENCY-CONSOLE.md` e `app/src/agency/agency-service.ts` para o vínculo de agência.
- Confira schema atual de `clients`, `projects`, `agency_projects` e `memberships`, usando
  migrations e consultas de metadados no banco alvo. A base de projetos está em
  `supabase/migrations/20260915180826_r1_01_tenant_auth_rls.sql`.
- Identifique local/produção e o projeto Supabase real; localhost do frontend não garante banco
  local. Não leia `.env`. Use a skill Supabase disponível e conexões autorizadas, sem expor chaves.
- Verifique que a camada de agência já existe no alvo. Não execute migration/deploy nem provisione
  organização, banco ou domínio como efeito colateral do cadastro. Respeite autorizações da sessão;
  se faltar alguma exigida pelo NÚCLEO, prepare a operação concreta e peça só o que falta.

## Entrada mínima

Nome do cliente, ambiente, agência (ou cliente direto da nó) e, quando solicitado, nome e
estado real do projeto. E-mail é necessário para acesso do cliente, mas não para um cadastro
sem login. Aproveite briefing, repo e documentos fornecidos; não invente datas, domínio,
percentuais, versões, faturamento, contato nem tarefas só para preencher a interface.

## Cadastro idempotente

1. **Resolver cliente.** Procure `clients` por slug e confira nome/e-mail quando disponível.
   Reutilize o UUID da mesma empresa. Nome parecido ou contato compartilhado não prova identidade.
   Em ambiguidade, apresente os candidatos antes de criar, mesclar ou alterar um registro.
2. **Criar somente o ausente.** `clients` usa `name`, `slug` e e-mail opcional. Gere UUID no banco.
   Não substitua contato ou dados existentes sem necessidade autorizada. Um pedido de cliente
   sem projeto pode terminar aqui: informe que o console agrega projetos e ainda não o mostrará.
3. **Resolver projeto.** Procure por `client_id` e identidade/nome do projeto. Reutilize quando
   for o mesmo escopo; um novo projeto de cliente existente não exige duplicar `clients`.
   `projects` exige `client_id`, `name`, `lead_status`; confirme valores e enums no schema.
   Use a etapa real informada. Nunca marque ROADMAP_PAGO/CONVERTIDO sem evidência nem simule
   pagamento para atravessar validações. Se a etapa for desconhecida e obrigatória, pergunte.
   Preserve módulos bloqueados e acesso não liberado no cadastro inicial, salvo pedido específico.
4. **Associar agência.** Resolva `agencies` por identidade e use seu UUID. Insira o vínculo
   ausente em `agency_projects`. O vínculo é por projeto, não por todos os projetos do cliente.
   `project_id` pertence a no máximo uma agência: se já estiver em outra, não transfira
   silenciosamente. Cliente direto da nó fica sem vínculo de agência. Use `$no-criar-agencia`
   se a agência também precisar ser criada, sem cadastrar automaticamente outras empresas.
5. **Integridade.** Faça escritas relacionadas no Postgres em transação quando possível.
   Em falha/timeout reconsulte slug, `client_id`/projeto e vínculo antes de repetir. Não rode
   `seed-exemplos.mjs` para onboarding: ele inclui exemplos e altera status de projetos.

## Acesso do cliente — somente quando pedido

Para liberar um roadmap pronto, leia primeiro:
- `supabase/functions/skill-01-ativar-dashboard/index.ts`;
- `supabase/functions/_shared/roadmap-content.ts`;
- `supabase/migrations/20260915203000_r1_04_skill_01_access.sql`;
- `app/scripts/skill-01.mjs`.

Esse fluxo existente chama `skill-01-ativar-dashboard` com `projectId` e conteúdo validado,
exige operador NO_ADMIN, gera acesso Auth e chama `activate_dashboard`. Não é um criador
de clientes. Exige conteúdo real completo (`answers`, `references`, `stack`, `costs`,
`next_steps`, `tiers`) e etapa de projeto permitida. Não preencha campos com lixo nem mude
status para forçar liberação. Não renove a janela de acesso sem autorização.

Se for pedido outro tipo de acesso, confira o contrato atual antes de implementar uma rota
alternativa. Use Auth Admin API, não INSERT em `auth.users`. Reutilize usuário compatível e
preserve senha. Conflito com AGENCY_ADMIN/NO_ADMIN deve ser resolvido sem downgrade silencioso.
O login do cliente usa papel CLIENT e `memberships(user_id, client_id, role=CLIENT)`.
Esse vínculo abrange os projetos acessíveis daquele cliente conforme módulos/janela de acesso;
não prometa restrição a um único projeto se a política está no nível do cliente.

Não confunda `memberships` (cliente final) com `agency_members` (operador da agência).
Nunca dê NO_ADMIN ao cliente. Gerar link de convite não autoriza enviá-lo a terceiros.
O script existente imprime link de autenticação: capture com cuidado, não grave em logs,
repo ou vault e não execute só para testar, pois ele ativa acesso.

## Marca no painel do cliente

O cliente de agência usa o painel normal da nó, com a logo da agência no topo e a logo
da nó na parte inferior do menu lateral. Cliente direto mantém a nó no topo.
A identidade vem de `agencies.name`/`logo_url` pelo vínculo do projeto em `agency_projects`,
consultado por `get_client_project_branding`. Não duplique a logo em `clients`, não
hardcode a marca no frontend e não conceda acesso de operador ao cliente final.

Confira `supabase/migrations/20260923194346_client_agency_branding.sql` e
`app/src/client-dashboard/client-dashboard-service.ts`: a migration de branding e a
de console precisam existir antes da publicação do frontend. Para cadastrar/corrigir
o asset oficial, siga a seção de marca de `$no-criar-agencia`.
Sem logo ou com falha de imagem, o topo deve mostrar o nome da agência. Valide o painel
com sessão autorizada, inclusive o rodapé nó; a RPC não pode revelar a marca de projetos
inacessíveis. Vínculos distintos de projetos do mesmo cliente podem produzir marcas distintas.

## Conferência final

Reconsulte cliente/projeto e vínculos. Com sessão da agência, confirme que o projeto aparece
em `get_agency_overview` e abre no console. Se liberou login final, valide também a sessão
CLIENT e módulos autorizados. Consultar tudo com service_role não comprova isolamento.
Sem credencial/sessão para teste de login, informe essa limitação, não finja validação.

Entregue cliente, projeto, agência, ambiente, links e estado do acesso. Informe o que foi
reutilizado e o que foi criado. Em cadastro sem login, diga explicitamente que o acesso final
não foi liberado. Registre mudança estrutural no mapa técnico conforme `sync-vault`; não crie
notas de conteúdo ou grave senhas. Se o usuário deixou uma carteira vazia aguardando cadastro
definitivo, mantenha-a assim até receber o pedido de criação/vínculo; uma referência de
planejamento não é autorização para cadastrar o cliente antecipadamente.
