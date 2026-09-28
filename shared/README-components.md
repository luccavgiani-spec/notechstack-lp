# Componentes do site

Home (`lp-narrador/cenas-lp/lp-v8.html`), Agência e Contato usam `card-nav.css` e `card-nav.js`. Os links do menu expandido são definidos apenas no JavaScript compartilhado; os três links principais continuam disponíveis no HTML sem JavaScript.

Home e Agência montam o mesmo mapa em `[data-client-network]`. Edite **`clients-network.js`** para alterar os logos, o texto e a animação; edite **`clients-network.css`** para alterar o desenho. Ambas as páginas carregam esses mesmos arquivos. As âncoras externas permanecem `/#clientes` e `/agencia/#empresas`.

O formulário da home e de Contato usa `home-contato.js`. Anexos dependem da atualização da função `send-lead-email` incluída neste PR; até a publicação da função, a interface bloqueia o envio com anexos com uma mensagem explícita. Não foi feito deploy da função nesta revisão.
