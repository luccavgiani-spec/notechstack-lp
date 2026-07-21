# PROMPT — Aplicar Identidade v2 da nó em todos os projetos deste repo

> Cole este prompt no Claude Code aberto em `C:\Users\lucca\projetos\notechstack`.

---

Aplique a **identidade visual v2 da nó** (julho 2026) em todos os sites deste repositório. A fonte da verdade é `brand/BRAND.md` + `brand/tokens/tokens.css` — leia os dois ANTES de tocar em qualquer arquivo.

## Contexto

O manual da marca mudou. A identidade v1 (DM Sans + Caveat + paleta Google `#4285F4/#EA4335/#FBBC05/#34A853`) foi **arquivada em `_legacy-identidade-v1/`** — os arquivos `fonts/`, `img/logo.png`, `img/logo-footer.png` e `favicon.png` NÃO existem mais nos caminhos antigos; qualquer referência a eles está quebrada e precisa ser migrada. Não referencie nada dentro de `_legacy-identidade-v1/` — ela existe só como histórico.

Todos os assets novos já estão prontos em `brand/`:

- `brand/logo/svg|png/` — logo `nó.` em tinta/branca × ponto azul/vermelho/âmbar/verde (+ mono fallback)
- `brand/lockup/` — `nó. tech stack` (usar só em primeiro contato: capa, bio, proposta)
- `brand/favicon/` — favicon.svg, favicon.ico, PNGs 16/32/180/192/512 (+ dark)
- `brand/fonts/` — Sora + JetBrains Mono woff2 com `fonts.css` pronto
- `brand/elements/` — barra de 4 pontos (rodapé claro) e barra topo 4 cores
- `brand/tokens/` — tokens.css (custom properties), tokens.json, tailwind.tokens.js

## Mudanças obrigatórias (em TODOS os sites)

1. **Tipografia:** remover TODA referência a DM Sans e Caveat (`@font-face`, `font-family`, preloads, Google Fonts links). Substituir por Sora + JetBrains Mono servidos de `brand/fonts/` (importar/adaptar `brand/fonts/fonts.css`). Mapeamento: display/logo → Sora 800 · títulos → Sora 700 · subtítulos/botões → Sora 600 · corpo → Sora 300/400 · qualquer coisa que usava Caveat (anotações manuscritas, destaques informais) → **JetBrains Mono** no padrão label (UPPERCASE, tracking +0.16em) ou remoção, conforme o caso. Nunca mono em texto corrido longo.
2. **Cores:** substituir a paleta antiga pelos novos hex. Mapa de migração direto:
   - `#4285F4` (e variações de azul Google) → `#3D63DB`
   - `#EA4335` → `#E0543C`
   - `#FBBC05`/`#F9AB00` → `#EDA33B`
   - `#34A853` → `#30A46C`
   - pretos genéricos de texto/fundo → tinta `#141414` · brancos de fundo → osso `#FAFAF7` · cinzas de apoio → `#6B6F76` · bordas → `#ECEBE6`
   - Preferir consumir via custom properties de `brand/tokens/tokens.css` em vez de hex hardcoded.
3. **Logo:** trocar `img/logo.png`/`logo-footer.png` e qualquer logo textual antigo pelos SVGs de `brand/logo/svg/`. A palavra é sempre tinta ou branca; só o ponto (quadrado) muda de cor. Se o logo estiver desenhado em HTML/CSS (texto + ponto), refazer com Sora 800 minúscula + ponto quadrado na cor do contexto.
4. **Favicon:** substituir `favicon.png` da raiz e favicons por página pelos de `brand/favicon/` (manter os do Roteador se forem marca própria do produto — ver abaixo).
5. **Regras duras do manual:** palavra do logo nunca colorida/gradiente/distorcida/3D; headlines em CAIXA ALTA com tracking -0.02 a -0.04em; máx. 1 recurso de ênfase dominante por peça (palavra colorida OU pílula OU sublinha-laço); pílula no âmbar = fundo preto texto branco; cards com barra de acento à esquerda e shadow ≤ 0.07 de opacity; barra de 4 cores no topo das peças; rodapé claro com 4 pontos + `nó · @notechstack`.

## Cor de contexto por site

- **`index.html` (notechstack.com.br — marca-mãe):** ponto e acento em **âmbar** `#EDA33B` (nó principal / IA & sistemas). As 4 cores aparecem juntas nos elementos de sistema (barra topo, pills de verticais, rodapé) — nunca só uma cor como acento global.
- **`health/` (/health):** ponto e acentos em **verde** `#30A46C` (tint `#E5F4EC`). CTAs verde.
- **`Roteador/` (/roteador):** ponto e acentos em **azul** `#3D63DB` (tint `#E9EEFB`). Atenção: o Roteador tem brand própria em `Roteador/brand/` (lockup/favicons do produto) — atualize as CORES e FONTES do site para a v2, mas se o lockup do produto for identidade própria do Roteador, preserve-o e apenas alinhe o que for da marca nó.
- **`roteador-jornada-v3.html` e `preview-mobile.html`:** mesmas regras da página a que pertencem.

## Processo

1. Leia `brand/BRAND.md` e `brand/tokens/tokens.css`.
2. Faça um grep por: `DM Sans`, `Caveat`, `dm-sans`, `caveat`, `4285F4`, `EA4335`, `FBBC05`, `F9AB00`, `34A853`, `img/logo`, `favicon.png`, `fonts/` — para montar o inventário completo do que migrar (inclui `main.js`, `health/brand-icons.js`, `health/particles.js`, `shared/pillnav.css`, inline styles nos HTML).
3. Crie um branch `feat/identidade-v2` e migre site por site (home → health → roteador), commitando por site.
4. Em `health/brand-icons.js` e `health/particles.js`: atualizar os hex das cores para a paleta nova.
5. Verificação por site: abrir no navegador (ou screenshot via Playwright) e conferir — fonte renderizando Sora (não fallback), nenhuma referência 404 a `fonts/` ou `img/` antigos, contraste ok em dark (tinta) e claro (osso), ponto do logo na cor certa do contexto.
6. Ao final: `git grep` de novo pelos termos do passo 2 — o resultado deve ser vazio (fora de `_legacy-identidade-v1/` e `posts/`).
7. **NÃO tocar em:** `posts/` (histórico de conteúdo publicado), `assets/mascote/` (mascote continua na v2), `supabase/`, `_legacy-identidade-v1/`.

## Critério de pronto

- [ ] Zero referências a DM Sans/Caveat e à paleta Google fora de `_legacy` e `posts/`
- [ ] Todos os `@font-face` apontando para `brand/fonts/`
- [ ] Logos e favicons servidos de `brand/`
- [ ] Cores consumidas de `brand/tokens/tokens.css`
- [ ] Home com acento âmbar, /health verde, /roteador azul — e as 4 cores juntas nos elementos de sistema
- [ ] Screenshots das 3 páginas conferidos contra `brand/BRAND.md`
