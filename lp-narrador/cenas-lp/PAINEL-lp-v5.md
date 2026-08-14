# Painel de controle — `lp-v5.html`

Abre com a tecla **D** ou com `?edit=1` na URL. Em produção, sem isso, a página
fica 100% igual: nenhum `contenteditable`, nenhum outline, nenhum gizmo.

## Como está organizado (13/08/2026)

**Uma pasta por seção da página**, na ordem em que se rola — não por tipo de
controle. Cada pasta reúne tudo que se vê naquela seção: os blocos de texto
(posição, tamanho e edição do conteúdo), a cor de fundo, o respiro vertical e
o atalho pra rolar até lá.

| Pasta | Cobre |
|---|---|
| Posições — animações | mascote da queda (posição, tamanho, poses, giro, suavização, tom) + arrastar na tela |
| Tempo | atraso do slogan, gatilho e fade da história, velocidade dos vídeos, digitação do terminal, velocidade da parede |
| Hero | marca, slogan, descrição + botão, fundo bege |
| 1ª seção — quem é a nó | rótulo, título, parágrafo, respiro |
| 2ª seção — IA + o que fazemos | rótulos, títulos, subtítulos, as 4 regras, vídeo + 4 cards, os dois fundos, respiros |
| Diagnóstico | tela do monitor, caixa de texto do terminal, **o formulário**, **a faixa de curiosidades**, parede esquerda (posição, escala, tipografia, cores), fundo do estúdio, altura da seção |
| Ferramentas | cabeçalho da seção, respiro |
| Footer | rodapé |

As duas primeiras pastas são as únicas que não são seções: o mascote atravessa
da 1ª seção até o diagnóstico, e as durações valem pra página inteira.

Fora das pastas ficam só três coisas, que são do painel e não de uma seção:
**Arrastar textos direto na página**, **Exportar CFG** e **Restaurar padrão**.

## ⚠️ Regra — toda caixa de texto nova nasce editável

Ao acrescentar texto ao HTML, faça **as duas** edições na mesma leva:

1. o seletor dela entra em `EDITABLE_SELECTOR` — aí clicar e digitar funciona
   com o painel aberto;
2. a linha dela entra em `textos:` **dentro da pasta da seção onde aparece** —
   aí ganha X / Y / tamanho e entra no export do CFG.

Sem as duas, o texto novo vira o único da página que só muda mexendo no
código. Foi exatamente o que aconteceu com o slogan da hero.

**Bloco em `position:absolute`** (o slogan pendura em `top:100%` abaixo da
marca): marque `abs:true` na linha dele. O deslocamento sai em `margin`, que
soma à posição-base — escrever em `left/top` apagaria o `top:100%` e jogaria o
bloco pro canto. O `#crtForm` (etapa 5) é outro caso desses: quem escreve o
`left/top` dele é o `placeCrt`, em %.

**Exceção — texto gerado.** `.cf-path` e `.cf-pre` (o recap do caminho e o
prefácio da nó, no formulário) ficam de fora do `EDITABLE_SELECTOR` de propósito:
são reescritos a cada abertura do formulário a partir do caminho escolhido, e o
texto deles mora na tabela `CF_PREF` no JS, não no DOM. Editar na tela seria
escrever num campo que o próximo clique sobrescreve. Vale o mesmo pra faixa de
curiosidades (`.facts-txt`), que vem do array `FATOS`, e pra tudo que a árvore
digita no terminal, que vem do `SCRIPT`.

## Onde o texto de cada coisa mora (14/08)

Nem todo texto da cena é editável na tela. Antes de procurar um bloco no painel:

| o que | onde mora |
|---|---|
| perguntas e respostas do terminal | `SCRIPT`, no JS |
| fechamento de cada folha | `close`, dentro da folha do `SCRIPT` |
| o "me conta mais" | `prova`, dentro da folha do `SCRIPT` |
| prefácio do formulário | `CF_PREF` |
| curiosidades abaixo do monitor | `FATOS` |
| rótulos e perguntas fixas do form | HTML, e esses **são** editáveis (`.cf-q`, `.cf-row > span`) |

## Onde mexer

Tudo é declarativo: o array `PASTAS`, no bloco `PAINEL DE CONTROLE` do JS.
Acrescentar um slider, uma cor, um respiro ou um bloco de texto é acrescentar
uma linha ao objeto da pasta certa — os construtores e o export se viram
sozinhos a partir daí.

## Persistência

A calibragem fica em `localStorage`, na chave `nolp_cfg_v5` (a v4 tem chave
própria; na primeira carga a v5 herda a da v4 uma vez e depois as duas seguem
independentes). **Exportar CFG** copia pro clipboard o bloco pronto pra colar
por cima do `DEFAULT_CFG` — é assim que a calibragem sai do navegador e vira
código. Enquanto o `localStorage` tiver valor salvo, ele ganha do
`DEFAULT_CFG`: pra ver o padrão baked, use **Restaurar padrão**.
