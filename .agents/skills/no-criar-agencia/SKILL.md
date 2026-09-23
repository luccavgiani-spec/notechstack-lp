---
name: no-criar-agencia
description: Cria ou reutiliza uma agência e o acesso dos seus operadores no console de agências da nó (app.notechstack.com.br), sem duplicar cadastros nem conceder NO_ADMIN. Use para cadastrar uma nova agência parceira ou configurar seu acesso ao portal. Não se aplica ao control-painel de telemedicina da Green.
---

# Criar agência no portal da nó

Entregue uma agência identificada, seus operadores autorizados e acesso verificado ao
console. Comece com carteira vazia; vincule projetos somente se o pedido os identificar.
Não crie clientes de exemplo, nem replique a Gazeta ou a Maisis como seed.

## Fontes e ambiente

- Leia `C:/Users/lucca/Bot-vault/Bot/NUCLEO.md` e as instruções do projeto.
- Repo: `C:/Users/lucca/projetos/notechstack` (frontend em `app/`).
- Leia `app/AGENCY-CONSOLE.md`, `app/src/agency/agency-service.ts`,
  `app/src/pages/LoginPage.tsx` e a migration `supabase/migrations/20260923184845_agency_console.sql`.
  Verifique migrations posteriores antes de usar o contrato abaixo.
- Consulte a skill Supabase disponível ao operar Auth/banco e confirme APIs na documentação atual.
- Identifique o Supabase alvo por configuração autorizada, CLI/conector ou contexto já confirmado.
  Um frontend em localhost pode apontar para produção. Não deduza o banco pela URL do frontend.
  Não leia `.env`; use conexões existentes ou variáveis de processo, sem imprimir credenciais.
- Em setembro/2026 a camada foi implementada primeiro localmente. Verifique se as tabelas/RPCs
  existem no alvo; não afirme que produção já foi migrada. Migration/deploy são etapas distintas
  do cadastro, sujeitas ao escopo e à autorização da sessão. Se faltar autorização exigida pelo
  NÚCLEO, prepare a operação e peça apenas a confirmação específica que falta, sem repetir aprovações.

## Dados necessários

Use o que já foi fornecido: nome da agência, slug, ambiente e e-mail de cada operador.
Derive um slug simples do nome e verifique colisões. Para acesso por senha, use a senha
fornecida na sessão sem gravá-la em arquivos. Se faltarem dados para a conta, pode criar
a agência isoladamente quando isso estiver autorizado e informar o acesso pendente.
Não adivinhe e-mail, titularidade, senha nem projetos a compartilhar.

## Procedimento

1. **Deduplicar.** Busque `agencies` por slug exato e confira o nome. Se existir, reutilize seu
   UUID. Nome parecido com slug diferente ou slug de outra empresa exige resolver a identidade
   antes de escrever. Não reative uma agência desativada silenciosamente.
2. **Criar agência.** Insira somente o registro ausente em `agencies(name, slug)`; use UUID
   retornado pelo banco. A tela `/no/agencias` já permite isso com sessão NO_ADMIN. Não é preciso
   criar um novo projeto Supabase, organização, repo ou deployment por agência.
3. **Preparar operador.** Consulte o Auth pelo e-mail normalizado, incluindo paginação se
   necessária. Use Auth Admin API para criar conta ausente; não faça INSERT manual em `auth.users`.
   Para conta nova do console, `app_metadata.role = AGENCY_ADMIN`. `user_metadata` não autoriza acesso.
   Reutilize conta compatível sem trocar senha. Se já for CLIENT ou NO_ADMIN, não sobrescreva
   o papel: explique o conflito de destino/permissão e resolva com o usuário. NO_ADMIN existente
   continua global; adicionar membership não o transforma em operador restrito.
4. **Vincular operador.** Insira o par ausente em `agency_members(agency_id, user_id, role)` com
   `role=AGENCY_ADMIN`. O par é único; repetir a operação deve preservar conta, senha e vínculos.
   Preserve outras chaves de `app_metadata` em qualquer atualização explicitamente autorizada.
5. **Projetos opcionais.** Se autorizados e identificados, confira projeto e cliente reais;
   insira em `agency_projects(agency_id, project_id)`. `project_id` é único: não use upsert para
   transferir um projeto de outra agência. Uma transferência precisa de escopo explícito.
   Use `$no-criar-cliente` quando também for necessário criar cliente/projeto.
6. **Verificar.** Reconsulte agência, conta e membership. Com sessão do operador (não service_role),
   verifique `/agencia`, `get_agency_overview` e somente os projetos autorizados. Carteira vazia
   deve mostrar zero nos indicadores. Confirme que `/no/*` e RPCs globais continuam inacessíveis.
   Não provoque escritas negativas em produção; use testes locais para testar tentativas de mutação.

O acesso depende de membership persistido e `agencies.active`, não só do papel ou slug.
Não amplie `is_no_admin`, RLS existente ou schemas expostos para fazer um cadastro funcionar.
`agency_private` permanece fora da Data API. Credenciais privilegiadas ficam no servidor/processo.

Se houver timeout após uma escrita, consulte o estado por slug/e-mail/par antes de repetir.
Se Auth criar e membership falhar, informe acesso incompleto e retome pelo mesmo UUID;
não apague contas existentes nem gere outra identidade para contornar o erro.

## Marca da agência no painel do cliente

Leia também `supabase/migrations/20260923194346_client_agency_branding.sql` e
`app/src/client-dashboard/ClientDashboardPage.tsx`. As duas migrations de agência precisam
estar aplicadas antes de publicar o frontend que consulta `get_client_project_branding`.

Localize a logo oficial nos materiais fornecidos ou peça o asset quando necessário.
Cadastre sua URL em `agencies.logo_url`: HTTPS ou caminho iniciado por `/` (nunca `//`),
servido de forma estável pelo app/storage autorizado. Não grave caminhos do computador.
Preserve uma logo existente, salvo substituição solicitada. Sem asset válido, mantenha
`logo_url` nulo: o painel usa o nome da agência; não invente sua identidade visual.

O painel normal do cliente herda a marca pelo vínculo do projeto em `agency_projects`:
logo da agência no topo e logo da nó na parte inferior do menu lateral. Cliente direto
mantém a nó no topo. A RPC verifica acesso ao projeto e retorna somente nome/logo.
Não amplie RLS nem exponha `agency_private` para disponibilizar a marca.
Verifique a imagem e o fallback em sessão autorizada; não crie um cliente fictício
apenas para testar a logo. A prévia local é exclusiva de desenvolvimento.

## Resultado

Informe nome/slug, ambiente, e-mail, URL real do console, projetos vinculados (ou nenhum) e o
que foi efetivamente validado. Não diga que uma conta local funciona em produção. Não envie
convites por e-mail/WhatsApp sem pedido explícito. Links de autenticação são segredos: entregue-os
somente ao usuário quando solicitado; não registre em logs, repo ou vault. Atualize o mapa técnico
se houver mudança estrutural, sem gravar senhas. Cadastro de agência não inclui deploy automático.
