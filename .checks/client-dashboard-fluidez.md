# Dashboard CLIENT — redesign e fluidez

Data: 2026-09-21. Base de produção: 97e3285. Escopo: somente app/, sem migrações de banco.

## Correções de performance

- Corrigido feedback loop do MutationObserver no preview: escrever o rótulo da seleção gerava nova mutação e outro requestAnimationFrame indefinidamente. O observador ignora sua própria UI, o texto só é escrito se mudou e eventos concorrentes são agrupados em um frame.
- Rotas administrativas carregadas sob demanda, sem incluir suas telas no JavaScript inicial do CLIENT.
- 172 seletores CSS de architecture/estimator/chart antigos removidos após confirmar ausência de referências TS/TSX. Script reproduzível em app/scripts/prune-legacy-dashboard-css.mjs.
- Cabeçalhos convertidos a WebP, mesmas dimensões: 1.890.665 -> 82.396 bytes (Etapas) e 1.858.697 -> 81.800 bytes (Como funciona). PNGs mantidos como fontes, não usados em runtime.
- JS inicial: ~617,98 -> ~547,8 KB; CSS: 92,96 -> 80,36 KB. Tamanhos sem gzip; medição de build local, não promessa de latência de rede.
- Teste de navegação confirma que alternar Home/Etapas não refaz loadClientDashboard nem descarta os dados.
- Cache HTTP imutável somente em /assets/ (nomes com hash). Não foi apagado cache de sessão, rascunhos do Editor ou node_modules compartilhado por junction. Não há evidência de que apagar esses caches melhoraria a navegação.
- Os cinco cards de Etapas usam a mesma superfície/borda. Status permanece nas barras, ícones e contadores.
- Rewrites de produção incluem os novos ícones e imagens, evitando respostas HTML para assets.

## Validação

- 160 testes passando em 16 arquivos (npm test -- --run --exclude src/pipelineExamples.test.ts).
- pipelineExamples.test.ts depende de projetos externos gazeta_bragantina e home-no-prototipo ausentes; suas duas falhas ENOENT já existem sem relação com estas mudanças. Não foram silenciadas na configuração.
- Build e lint aprovados; alerta de bundle inicial >500 KB permanece, sobretudo runtime React/router/Supabase.
- Teste de regressão do loop do Editor, seleção/texto preservados e coalescência de scroll.
- Inspeção visual local dos temas claro/escuro, cabeçalhos, cores uniformes e navegação.

## Entrega acumulada

Inclui os ajustes visuais aprovados da sessão: tema claro padrão, home e etapas reformuladas, calculadora, ícones, remoção da aba de marca/navbars, controles desktop/mobile, seleção/edição/redimensionamento pelo preview. Nenhuma cobrança real ou alteração de contrato foi executada.
