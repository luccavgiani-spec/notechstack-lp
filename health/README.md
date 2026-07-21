# nó Health

Sub-LP da **nó** dedicada a vender estruturas de **telemedicina white-label** para um público bem específico:

- **Médicos recém-formados** que ainda não têm consultório
- **Estudantes/residentes** querendo renda paralela com atendimento online
- **Plantonistas cansados** querendo migrar pra atendimento próprio

URL: `https://notechstack.com.br/health/`

## Estrutura

```
health/
├── index.html      Markup + estilo inline (mesma convenção da LP principal)
├── main.js         Interações: hero scroll narrativo, ECG, marquee, FAQ
├── particles.js    Fundo de partículas (ogl/WebGL) nos verdes da vertical
├── brand-icons.js  SVGs de marcas parceiras (Mevo, Pipefy, Slack, Teams)
├── brand/          Identidade da vertical — ver BRAND-HEALTH.md
└── README.md       (este arquivo)
```

A página reutiliza:

- **Fontes** self-hosted em `/brand/fonts/` (Sora 300/400/600/700/800 + JetBrains Mono 400/500/700)
- **Logo** da nó em `/brand/logo/svg/no-{tinta|branca}-ponto-verde.svg` (nav e rodapé)
- **Lockup da vertical** `nó.health` em `/health/brand/lockup/svg/` — só na capa/hero
- **Favicon próprio** (ponto verde) em `/health/brand/favicon/`
- **Tokens de design** — `brand/tokens/tokens.css` (base) + `health/brand/tokens-health.css`
  (semânticos `--health-*`), carregados nessa ordem. Os apelidos locais
  (`--green`, `--dark`, …) só consomem esses tokens.

Tudo é servido pelo mesmo deploy estático (Vercel) da LP principal.

## Identidade visual

Identidade **v2** (julho 2026). Fonte da verdade: `brand/BRAND.md` + a extensão da
vertical em `health/brand/BRAND-HEALTH.md`.

Acento de contexto: **verde `#30A46C`** (tint `#E5F4EC`) — CTA, links, cursor,
barra de acento de card e linha lateral dos labels, sempre via os semânticos
`--health-*`. As **4 cores do sistema seguem juntas** nos elementos estruturais
(barra de 4 cores no topo, rodapé com 4 pontos): o verde é acento da vertical,
não substitui o sistema da marca-mãe.

Botões CTA primários: preto → **hover verde** — verde reforça o eixo saúde/vida.

A palavra `nó` **nunca** é pintada de verde. Em texto corrido ela aparece em
Sora 800 na cor do texto (`.brand`); a ênfase verde vai para a palavra que de
fato carrega o ponto (`.hl` na headline, `.hl-word` no corpo). O ponto quadrado
pertence ao logo — que aparece em SVG na nav, no rodapé e, como lockup
`nó.health`, só na capa.

## Tom de voz

Direto, provocativo, identificável — como se um colega de turma estivesse contando que tem uma solução. Linguagem proibida nesta página: "soluções inovadoras", "transformação digital", "camada de inteligência", "plataforma robusta", "excelência operacional". Linguagem desejada: "largar o plantão", "atender no seu tempo", "sua agenda, seu preço", "começar a atender semana que vem".

## Seções

1. **HERO — 5 telas de scroll narrativo** — `#hero` tem `height: 500vh` com 5 `.hero-screen` em `position: sticky; height: 100vh`. Cada tela tem **só texto grande** (sem mockup de produto). Sequência: pergunta → problema → solução → concretude → CTA. Background grid verde fixo + indicador lateral de dots (desktop) + barra de progresso top.
2. **Sec1 · Confiança em escala** — copy direta pro público novo ("largar o plantão"). Como background, uma **linha de monitor cardíaco (ECG)** verde atravessa a seção horizontalmente, com ponto luminoso percorrendo o path em loop infinito (SVG com `getPointAtLength` + `stroke-dashoffset`). Stats: `+50` médicos largaram o plantão / `8 semanas` do contrato à 1ª consulta / `24/7` suporte que não dorme / `100%` LGPD+CFM.
3. **Sec2 · Stack conectada** — duas linhas de marquee infinito com logos (WhatsApp, Stripe, Pix, Google Calendar, Memed, Doctoralia, etc.) via `requestAnimationFrame`. Header e copy adaptados ao novo tom.
4. **Sec3 · Quem atende seus pacientes?** — três cards por modelo de atendimento (Videoconsulta própria *você atende* | **Roteador** *você só vende, pool médico atende — card destaque, CTA linka /roteador* | Integração com Plataforma Existente *você já atende*) + tabela comparativa + CTA final. **Sem preços** em lugar nenhum.
5. **Sec4 · FAQ** — accordion de 10 perguntas reais do público novo: residente vs. fim de residência, quanto cobrar, CNPJ vs. PF, prescrição eletrônica, LGPD, captação de pacientes, portabilidade, demo grátis.

## Hero — detalhes técnicos

- Vanilla JS (sem React, sem framer-motion)
- Cada tela é `position: sticky; top: 0; height: 100dvh` dentro de container `height: 500vh`
- Um único listener de scroll (com `requestAnimationFrame` throttling) calcula:
  - Qual tela está ativa (toggle `.in` para disparar o fade-up sequencial das palavras/frases)
  - Atualiza dot lateral ativo
  - Mostra/esconde grid de fundo + barra lateral de dots conforme entra/sai do hero
- Cada `.hero-line .frag` ou `.hero-line .word` tem `transition-delay` escalonado via classes `d0..d7` para criar entrada cadenciada
- Em mobile: grid de fundo com opacity reduzida, sem dots laterais, CTAs full-width 56px

## Mobile-first

- Cada tela do hero ocupa **100dvh** (dynamic viewport height — resolve bug de barra de URL no iOS)
- Indicador lateral de dots some em mobile; **CTA fixo no rodapé** (`Falar com a nó →`) com `backdrop-filter`
- Navbar vira hambúrguer → overlay full-screen
- Cards de opções empilham; tabela comparativa ganha scroll horizontal com sombra indicando rolagem
- Touch targets sempre ≥44px
- Linha ECG continua atravessando a Sec1 com altura reduzida (~140px)

## Como rodar localmente

A LP principal já é servida como site estático (Vercel). Não tem `npm run dev` configurado no repo.

A forma mais rápida:

```bash
npx serve .
# ou
npx live-server --port=3000
```

A partir da raiz `notechstack-lp/`. Depois acessar:

- LP principal: `http://localhost:3000/`
- nó Health: `http://localhost:3000/health/`

## Integração com a LP principal

Adicionado o link **Saúde** na `<ul class="nav-links">` do `/index.html` raiz, entre "Soluções" e "Módulos", com classe `nav-link-saude` para que o hover fique verde (em vez do preto padrão). O link aponta para `/health/`.

A logo da navbar da página `health/` aponta para `/` (volta para a home da nó). Os outros links da nav health (`#how`, `#usecases`, etc.) usam paths absolutos (`/#how`) para funcionar a partir da subpasta.

## CTAs de conversão

- **CTA principal do hero (tela 5):** `Quero estruturar meu atendimento →` → âncora `#sec3` (planos)
- **CTAs dos cards de plano:** `/#cta` (formulário multi-step da LP principal)
- **CTA final da Sec3:** `Falar com a nó →` → `/#cta`
- **CTA fixo do rodapé mobile:** `Falar com a nó →` → `#sec3` (fica próximo, não sai da página)
- **Navbar CTA:** `Falar com a nó →` → `#sec3`

Não há formulário próprio nesta página; reaproveitamos o canal único de conversão da nó (ou levamos o usuário até a seção de planos).

## Tecnologias

- HTML/CSS/JS vanilla (sem build, sem framework)
- Animações via `IntersectionObserver` + `requestAnimationFrame`
- Hero: scroll-driven sticky pinning (sem snap CSS — controle via JS pra ter precisão de animação por tela)
- ECG: SVG `<path>` com `getPointAtLength` + animação manual de `stroke-dashoffset` + posição do ponto
- Marquee de logos: `requestAnimationFrame` (não keyframes CSS)
- Logos das integrações via `cdn.simpleicons.org` com fallback de placeholder em texto para sistemas fora do índice (Memed, Mevo, RD Station, Asaas, PagSeguro, Soluti BirdID, Conexa Saúde)

Mantida a convenção do projeto: **vanilla, single-page, sem React/Next**.
