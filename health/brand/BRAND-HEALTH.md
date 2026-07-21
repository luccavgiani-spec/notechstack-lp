# nó health — Identidade da vertical saúde (v2 · julho 2026)

> Extensão do manual da marca-mãe (`../../brand/BRAND.md`). Tudo que não estiver definido aqui segue o manual principal.

## Lockup `nó.health`

- **"nó"** em Sora ExtraBold, minúscula — tinta `#141414` (fundo claro) ou branca (fundo dark).
- **Ponto quadrado + "health"** em **verde `#30A46C`** — o ponto pertence ao `.health`.
- **"health"** em **Sora Light, mesmo corpo** do "nó".
- Usar **apenas em primeiro contato** (capa, bio, proposta) — no miolo das peças, usar o logo `nó.` com ponto verde (`../../brand/logo/svg/no-{tinta|branca}-ponto-verde.svg`).
- Fallback monocromático (1 cor): `no-health-mono-{tinta|branca}.svg`.

Arquivos: `lockup/svg/` + `lockup/png/` (512w e 2048w, fundo transparente).

## Cor de contexto

Verde `#30A46C` (tint `#E5F4EC`) — sucesso · CTA · vertical saúde. CTAs, links, barra de acento de cards, linha lateral de labels e o ponto do logo ficam verdes na página /health. As 4 cores do sistema continuam aparecendo juntas nos elementos estruturais (barra topo, rodapé 4 pontos) — regra da marca-mãe.

## Favicon

`favicon/` — `nó.` com ponto verde: favicon.svg, favicon.ico, PNGs 16/32/180/192/512 + versão dark.

## Proibições (herdadas + específicas)

- ❌ "health" nunca em outra cor além do verde (ou mono no fallback).
- ❌ "health" nunca em peso bold — sempre Sora Light.
- ❌ Nunca `nó.health` como logo de rodapé/miolo — lockup é só primeiro contato.
- ❌ Todas as proibições do manual-mãe (sem gradiente, distorção, sombra, 3D, caixa alta).

## Estrutura

```
health/brand/
├── BRAND-HEALTH.md
├── tokens-health.css
├── lockup/{svg,png}/     ← no-health-{tinta|branca} + mono fallbacks
└── favicon/              ← ponto verde, claro + dark
```
