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
└── README.md       (este arquivo)
```

A página reutiliza:

- **Fontes** self-hosted em `/fonts/` (DM Sans 300/400/500/600/700 + Caveat 700)
- **Logos** da nó em `/img/logo.png` e `/img/logo-footer.png`
- **Favicon** em `/favicon.png`
- **Tokens de design** (`--blue`, `--green`, `--dark`, etc) — duplicados localmente para que a página seja standalone

Tudo é servido pelo mesmo deploy estático (Vercel) da LP principal.

## Identidade visual

Mantém os tokens da nó mas com **paleta restrita**: verde (#34A853, principal) + azul (#4285F4, secundária) + preto/branco. Vermelho/amarelo só em micro-acentos.

Botões CTA primários: preto → **hover verde** (e não azul como na LP principal) — verde reforça o eixo saúde/vida.

A palavra `nó` inline aparece em Caveat **verde** por padrão (`.brand`) ou azul (`.brand-blue`). Versões maiores: `.brand-lg`, `.brand-xl`.

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
