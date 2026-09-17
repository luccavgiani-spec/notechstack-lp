# Redesign da área de clientes — 17/09/2026

As cinco referências fornecidas orientam o shell escuro, sidebar numerada, tipografia Sora/JetBrains Mono, acentos da marca, visão geral, moldura do protótipo, Kanban, Editor e histórico. As informações exibidas vêm dos contratos existentes, não dos textos e números das imagens.

## Escopo

- Apenas frontend e seus testes; nenhum serviço, RPC, tabela, migração, regra de acesso ou Edge Function foi alterado.
- Como funciona: projeto, progresso/fases a partir do Kanban, resumo das entregas, janela de acesso e preferência de execução.
- Protótipo: URL publicada no roadmap, moldura de celular, tela cheia e link externo.
- Etapas: colunas somente leitura, contagens e barra de progresso calculadas.
- Editor: seleção de tela/componente pela allowlist, controles autorizados, desktop/celular, draft local por projeto e versão; submissão, upload e finalização preservados. Descartar recarrega o iframe para restaurar a base original.
- Versões: versão atual, changelog, linha do tempo e ajustes incorporados com detalhes expansíveis.
- Identidade isolada em `src/client-dashboard/client-dashboard.css`, sem mudar o admin.

## Contratos preservados

`get_client_project_shell`, leitura de `roadmaps`, `kanban_items`, `project_versions`, `list_client_version_checklists`, `set_preferred_tier`, `get_client_editor_config`, `submit_client_editor_export`, storage `editor-exports` e `finalize_client_editor_export`.

## Verificação

- Build de produção e ESLint aprovados.
- Suíte completa final: 154 testes aprovados.
- Regressão final direcionada: 29 testes aprovados, incluindo os dois novos.
- Navegação manual nas cinco abas usando a sessão do usuário em localhost, conectada ao Supabase publicado. Protótipo Discordia carregado no iframe e abertura/fechamento de tela cheia verificados.
- Responsividade conferida no navegador em 390 px; largura do documento igual à largura disponível, sem overflow horizontal global.
- Preferência e envio privado verificados por testes com mocks; não foram gravados dados de teste no backend publicado.
- E2E existentes tiveram os seletores adaptados; a suíte E2E que cria fixtures no Supabase local não foi executada nesta sessão.

## Limites da configuração atual

O projeto autenticado tem configuração de componentes do Editor, mas sua referência de build não é uma URL integrada de preview. Nesse caso, a interface mostra uma prévia local do componente e explica a ausência da integração. Ativar preview integrado depende da configuração já prevista pelo backend, sem necessidade de mudar sua estrutura.

A revisão inicial foi realizada antes do deploy. O servidor local autenticado foi disponibilizado em http://127.0.0.1:5174. As variáveis públicas foram obtidas do bundle publicado e aplicadas somente ao processo; nenhum arquivo .env foi lido ou escrito.

A configuração de rotas da Vercel libera explicitamente o logo branco e o mascote do redesign.

`design-preview.html`, `design-preview.tsx` e `design-editor.html` são auxiliares locais de revisão, não importados pelo entrypoint de produção. A página de demonstração intercepta as chamadas com fixtures e bloqueia envio remoto; não substitui os serviços reais do app. Ela fica fora do build padrão do Vite.
