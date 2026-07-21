# FIX — Identidade específica da nó health (adendo ao prompt de migração v2)

> Cole na MESMA sessão do Claude Code que está executando `CLAUDE-CODE-PROMPT.md`. Este fix REFINA as instruções da seção "/health" daquele prompt — onde houver conflito, este arquivo vence.

---

A nó health agora tem identidade própria, montada em `health/brand/`. Leia `health/brand/BRAND-HEALTH.md` antes de aplicar. Mudanças em relação ao que o prompt original pedia para /health:

## 1 · Lockup próprio (novo)

A vertical tem o lockup `nó.health`: "nó" em Sora ExtraBold (tinta ou branca) + ponto quadrado e "health" em **verde #30A46C**, com "health" em **Sora Light no mesmo corpo**. Arquivos em `health/brand/lockup/svg/`:

- `no-health-tinta.svg` → fundos claros (osso)
- `no-health-branca.svg` → fundos dark (tinta)
- `no-health-mono-{tinta|branca}.svg` → fallback monocromático

**Onde usar:** hero/capa da página /health, meta tags og:image se aplicável, bio/materiais de primeiro contato. **Onde NÃO usar:** navegação, rodapé e miolo da página — nesses lugares vai o logo `nó.` com ponto verde (`brand/logo/svg/no-{tinta|branca}-ponto-verde.svg`), como o prompt original já pedia.

## 2 · Favicon próprio de /health (substitui o genérico)

Use `health/brand/favicon/` (ponto VERDE) em vez do favicon âmbar da raiz para a página /health: atualizar `<link rel="icon">`, `apple-touch-icon` e manifest da página com esses arquivos.

## 3 · Tokens da vertical

Importar `health/brand/tokens-health.css` DEPOIS de `brand/tokens/tokens.css` no /health, e consumir os semânticos `--health-*` (CTA, links, barra de acento de card, linha de label, ponto do logo) em vez de hex hardcoded ou de `--no-verde` direto. Em `health/brand-icons.js` e `health/particles.js`, mapear os verdes para `#30A46C` (e tint `#E5F4EC`).

## 4 · Menções à nó health fora de /health

Em qualquer página do repo que mencione a vertical (home, roteador, pills de verticais, cards de serviço): a menção textual "nó health" pode virar o lockup pequeno OU texto com ".health" em verde — mas em contexto de listagem das 4 verticais, manter o padrão pill do manual (círculo verde + "saúde · NÓ HEALTH" em mono). Nunca pintar a palavra "nó" de verde.

## 5 · Regras que continuam valendo

- As 4 cores do sistema seguem juntas nos elementos estruturais da /health (barra topo 4 cores, rodapé 4 pontos + `nó · @notechstack`).
- "health" nunca em bold, nunca em outra cor; lockup nunca distorcido/sombreado/3D.
- Não tocar em `posts/`, `assets/mascote/`, `supabase/`, `_legacy-identidade-v1/`.

## Critério de pronto (adicional ao original)

- [ ] Hero/capa de /health com `no-health-{tinta|branca}.svg` conforme fundo
- [ ] Nav/rodapé de /health com `nó.` ponto verde (não o lockup)
- [ ] Favicon de /health verde (não o âmbar da raiz)
- [ ] `tokens-health.css` importado e semânticos `--health-*` em uso
- [ ] Menções à vertical nas outras páginas revisadas conforme item 4
- [ ] `git grep -i "nó health\|no health"` revisado página a página
