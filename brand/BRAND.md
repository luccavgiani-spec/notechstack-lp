# nó · manual da marca — Identidade v2 (julho 2026)

> Fonte da verdade da identidade visual da **nó tech stack**. Substitui integralmente a identidade v1 (DM Sans + Caveat + paleta Google), arquivada em `_legacy-identidade-v1/`.

## 1 · A marca

**nó é onde as pontas se conectam.** Sistemas, pagamentos e operação se amarram num ponto só. O logo traduz isso pela ausência de ornamento: a palavra em **Sora ExtraBold, minúscula, e um ponto final (quadrado)** — a afirmação de quem resolve.

- A palavra é **sempre tinta (`#141414`) ou branca** — nunca colorida.
- O **ponto é o único elemento de cor** e assume a cor do contexto da peça.
- Cor padrão da marca-mãe (favicon, avatar, capa): **âmbar** — o "nó principal".

Arquivos: `brand/logo/svg/no-{tinta|branca}-ponto-{azul|vermelho|ambar|verde}.svg` (+ PNGs em `brand/logo/png/`). Fallback monocromático (contexto de 1 cor): `no-tinta-mono.svg` / `no-branca-mono.svg`.

## 2 · Lockup estendido

`nó. tech stack` — "tech stack" em **Sora Light, mesmo corpo**. Usar **apenas em primeiro contato** (capa, bio, proposta). Arquivos em `brand/lockup/`.

## 3 · Usos incorretos

- ❌ Gradiente ou mais de uma cor na palavra.
- ❌ Palavra colorida (sempre tinta ou branca).
- ❌ Distorcer, condensar ou expandir.
- ❌ Outra fonte — **nem a Caveat, que saiu do sistema**.
- ❌ Sombra, contorno, extrusão ou efeito 3D — o único 3D da marca é o **mascote** (`assets/mascote/`).
- ❌ Caixa alta — sempre minúsculo; "nó" em caixa alta só dentro de headline corrida.

## 4 · Cores — "Quatro cores, tom próprio"

Ordem canônica: **azul → vermelho → âmbar → verde**. As quatro funcionam **JUNTAS** — nunca o azul sozinho como acento da marca.

| Cor | Hex | Tint | Uso | Vertical |
|---|---|---|---|---|
| Azul | `#3D63DB` | `#E9EEFB` | info · conteúdo | ecommerce / roteador |
| Vermelho | `#E0543C` | `#FBEAE5` | destaque · alerta | hotelaria |
| Âmbar | `#EDA33B` | `#FCF3E0` | atenção | IA & sistemas — **nó principal** |
| Verde | `#30A46C` | `#E5F4EC` | sucesso · CTA | saúde — nó health |

Neutros: **Tinta** `#141414` (fundos dark, texto) · **Osso** `#FAFAF7` (fundo claro) · **Cinza** `#6B6F76` (texto secundário) · **Borda** `#ECEBE6` (separadores).

## 5 · Tipografia

**Sora** — geométrica como o conceito da marca; do display ao corpo.
- ExtraBold 800 → display, logo · Bold 700 → títulos · SemiBold 600 → subtítulos, botões · Light 300 → corpo.
- Corpo em Light/Regular (300–400), entrelinha generosa, colunas de no máximo 70 caracteres.

**JetBrains Mono** — o acento técnico que substitui a Caveat: labels, métricas, anotações e tokens — a voz de engenharia da marca.
- Labels de seção: UPPERCASE, tracking `+0.16em`, linha lateral colorida.
- Headlines: CAIXA ALTA por padrão, tracking apertado (`-0.02` a `-0.04em`).
- **Nunca** usar mono em texto corrido longo.

Arquivos: `brand/fonts/` (woff2 estáticos + variáveis, `fonts.css` pronto).

## 6 · Ênfase em headlines — "Três recursos, com parcimônia"

A headline punctua: contraste, paradoxo, dado forte ou pergunta retórica. A ênfase marca a palavra que carrega o ponto — **no máximo 1 recurso dominante por peça**:

1. **Palavra colorida** — cor do contexto, sem fundo.
2. **Pílula sólida** — máx. 1–2 por headline; no âmbar, pílula preta com texto branco.
3. **Sublinha com laço**.

## 7 · Layouts e elementos

- **Estrutura sanduíche (decks):** capa dark → conteúdo claro → encerramento dark com logo grande.
- **Barra de 4 cores no topo de todas as peças** (`brand/elements/barra-topo-4-cores.svg`).
- **Cards:** barra de acento à esquerda; shadow suave (`opacity ≤ 0.07`) — nunca pesada.
- **Posts (Instagram):**
  - `t-news`: split claro, headline à esquerda, mockup à direita.
  - `t-cover`: declarativa, bolhas nas cores, dark ou claro.
  - CTA padrão: **"Te Explico na Legenda"**.
- **Rodapé de peças claras:** 4 pontos (azul·vermelho·âmbar·verde) à esquerda + `nó · @notechstack` à direita (`brand/elements/barra-4-pontos.svg`).
- **Pills de vertical:** círculo na cor + nome (ecommerce/azul · saúde/verde · hotelaria/vermelho · IA & sistemas/âmbar).

## 8 · Estrutura de arquivos

```
brand/
├── BRAND.md              ← este arquivo
├── logo/{svg,png}/       ← 10 variações (tinta/branca × 4 pontos + 2 mono)
├── lockup/{svg,png}/     ← nó. tech stack (8 variações)
├── elements/             ← barra 4 pontos, barra topo 4 cores
├── favicon/              ← favicon.svg/.ico + PNGs 16–512 + versão dark
├── fonts/                ← sora/, jetbrains-mono/, fonts.css
└── tokens/               ← tokens.css, tokens.json, tailwind.tokens.js
```
