# Patch da sessão de front — 14/08/2026

Escrito ao fechar a sessão de front, depois que a sessão de rastreio criou o PR.
Serve para conferir o que ficou de fora e o que pode ter envelhecido com as duas
trabalhando em paralelo.

---

## 1. A boa notícia: não houve branch divergente

As duas sessões commitaram na **mesma branch** (`feat/lp-v5-site-oficial`),
intercaladas. Não existe merge pendente nem conflito. A ordem real foi:

| # | commit | de quem | o que é |
|---|---|---|---|
| 1–12 | `2a67fbd` … `d41970a` | front | árvore do CRT, mobile, mascote, portal, páginas legais |
| 13 | `dbbe072` | rastreio | backend do percurso: migrações, CAPI, painel-dados |
| 14 | `35d3589` | rastreio | instrumenta o funil no `lp-v5.html` — 17 eventos |
| 15 | `a9ba7fd` | rastreio | pixel do Roteador sai do HTML e vira tag do container |
| 16 | `a19cb5b` | rastreio | painel de percurso, relatório e plano |
| **17** | **`b19038d`** | **front** | **janela dos documentos legais + rodapé** |

> [!warning] O commit 17 NÃO está no PR
> `git rev-list --left-right --count origin/…` dá **0 atrás, 1 à frente**. O PR
> contém tudo até `a19cb5b`. O `b19038d` está só local.
> **Ação:** `git push` na branch. Se o PR ainda estiver aberto, ele absorve o
> commit sozinho. Se já tiver sido mergeado, isto vira um PR de uma linha.

---

## 2. O que o commit que ficou de fora contém

**Janela dos documentos legais.** Clicar em "termos de uso" ou "compartilhamento
dos meus dados" **dentro do CRT** abre o documento numa janela por cima, sem
navegar — a pessoa está no meio do formulário, e sair levaria embora o que ela
digitou. Os mesmos links no **rodapé** continuam navegando normalmente.

- É `<iframe src="/termos?embed=1">` e não HTML injetado: a `shared/legal.css`
  define `body{}` e carregá-la junto com a LP arrasaria o layout.
- `stopPropagation` no clique — sem ele o evento subia até o `<label>` do
  consentimento e **marcaria a caixa** como efeito colateral de abrir o texto.
- Esc fecha, foco volta pra quem abriu, scroll de trás travado.

**Rodapé.** Lockup completo (`no-tech-stack-branca-ponto-ambar.svg`) no lugar da
logo isolada, e alinhamento corrigido: cada bloco alinha pela própria borda
externa (medido depois: goteiras 60/60, marca alinhada entre si, bloco legal
alinhado à direita, ambos no mesmo eixo vertical). Empilhado (≤900px), os dois
centram junto.

---

## 3. Checagem de colisão entre as duas sessões — o que eu verifiquei

Tudo abaixo foi conferido no browser com as duas coisas no mesmo arquivo, sem
nenhum erro de console:

- **`track()` sobreviveu aos meus commits.** 20 chamadas no arquivo atual. Usei
  só `Edit` com casamento exato de string, nunca reescrita do arquivo.
- **Meu `stopPropagation` não mata evento de vocês.** O listener de
  `cta_click` é `capture: true`, então roda antes do meu, que é bubble. Além
  disso vocês não instrumentam os links do aceite.
- **O gancho de `diag_abrir` está no lugar certo depois da minha reescrita do
  `abrirDiagnostico()`**: mora depois do `return` do `semRolar`, então painel de
  calibragem e `pousoForceNode` seguem fora do funil — e uma chamada de debug
  nova já nasce excluída, sem ninguém precisar lembrar.
- **A ordem das seções foi absorvida.** O comentário do `capitulo_visto` já diz
  que a ordem sai do DOM porque o `#platforms` subiu — a lista chumbada teria
  mentido em silêncio.
- Coexistem em runtime: `track`, `janelaLegal`, `abrirDiagnostico`,
  `brincaMascote`. `cta_click` dispara no `dataLayer`.

---

## 4. O que pode ter envelhecido — decisões para vocês

### 4.1. Os documentos legais não são rastreados
Abrir "termos de uso" ou "privacidade" de dentro do CRT não emite evento. Não é
defeito — é um evento que ninguém pediu. Mas é um sinal barato e relevante:
quem lê os termos antes de enviar tem intenção diferente de quem só marca a
caixa. Se quiserem, o gancho é o `janelaLegal.abrir()`, que já recebe qual
documento foi aberto e quem o abriu.

### 4.2. O que a política DECLARA precisa bater com o que o código DISPARA
Escrevi `/privacidade` descrevendo o rastreio em detalhe: as três categorias de
cookie com nomes reais (`_ga`, `_ga_*`, `_gcl_au`, `_fbp`, `_fbc`), os eventos de
jornada, o identificador de sessão gravado no lead, e a regra de **não mandar
categoria temática para plataforma de anúncio quando puder revelar dado
sensível** (as quatro folhas `f_saude_*`).

Essa última frase é a que mais importa conferir: ela está escrita como promessa
ao titular. Se a implementação mandar a folha para a Meta, o site está mentindo
na política. Vale um passe de olho no payload de `lead_submit`.

### 4.3. Ainda falta preencher a identidade da empresa
`/termos` e `/privacidade` têm um bloco destacado pedindo **razão social, CNPJ e
endereço**. Não inventei dado de registro. Sem isso, as páginas não estão
prontas para publicar — e o checkbox de consentimento aponta para elas.

### 4.4. Não existe banner de cookies
A política declara consentimento como base legal para medição e publicidade, com
opt-out (seção 5.3) — prática corrente no Brasil, e que não derruba nenhum
evento. Um banner bloqueante seria mais seguro juridicamente e custaria
conversão. A política foi escrita compatível com os dois caminhos: se optarem
pelo banner, só a seção 5.3 muda.

### 4.5. Nada disso é parecer jurídico
Os dois documentos são verdadeiros sobre o que o site faz, mas quem assina risco
é advogado.

---

## 5. Estado dos bloqueios de publicação

| bloqueio levantado antes | estado |
|---|---|
| `/termos` e `/privacidade` davam 404 | **resolvido** — páginas existem e os links resolvem |
| backend descartava `site`/`descricao`/`path` | **com vocês** (`dbbe072`) |
| CNPJ / razão social / endereço | **aberto** — placeholder marcado nas duas páginas |
| mobile ponta a ponta em aparelho real | **aberto** — testei em harness 390×844, não em telefone |
