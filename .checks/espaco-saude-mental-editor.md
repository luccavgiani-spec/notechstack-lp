# Espaço Saúde Mental — dashboard CLIENT e Editor com preview ao vivo

## O que é

Segundo projeto real no dashboard, criado para validar o **Editor** com a ponte de
preview ligada — o que a demonstração do Discordia (ver `f2-10-editor.md`) deixou
explicitamente em aberto: *"preview visual controlado deste case exige build de
preview opt-in própria"*.

- Projeto: `4fbc3859-a32f-4a71-b799-b005f32f65f8` — "Espaço Saúde Mental — site e agendamento"
- Versão atual: `eb2ab04c-059e-4d70-8707-f9e7dc15384b` — V1 publicada
- Build de preview: `https://app.notechstack.com.br/prototipos/espaco-saudemental/`

## Build de preview

`app/public/prototipos/espaco-saudemental/` é uma **cópia** gerada de
`espaco-saudemental/espaco-site` por `vite build -c vite.prototipo.config.ts`
(entry `prototipo.tsx`: LandingV2 em MemoryRouter, `base: './'`, JS e CSS inline).
Nada foi alterado no repositório da cliente. Só as mídias que a v2 usa foram
mantidas (`videos/hero-desktop.mp4`, `videos/hero-poster.jpg`, `quem/thais-*.jpg`).

Duas inclusões existem apenas nesta cópia:

- `no-editor-map.js` — a LP é React e não traz `data-editor`. O mapa carimba os
  atributos nos elementos certos depois que o React monta e recarimba via
  `MutationObserver` quando um trecho é remontado.
- `/no-editor-preview.js` — o runtime oficial, com `data-parent-origin`,
  `data-project-id`, `data-version-id` e `data-components` desta versão.

Para regerar a build depois de mudanças na LP, repita o `vite build` acima
apontando `--outDir` para esta pasta e reinjete os dois scripts: o `index.html`
é gerado e sobrescrito.

## Allowlist da V1 (`editor_version_configs`, `bridge_enabled = true`)

| id | tela | controles |
|---|---|---|
| `marca_topo` | Topo | texto, cor |
| `hero_titulo` | Abertura | texto, tamanho, cor |
| `hero_texto` | Abertura | texto, tamanho, cor |
| `hero_cta` | Abertura | texto, cor |
| `valores_titulo` | Honorários | texto, tamanho, cor |

Sem controle de `logo`: a LP não tem `<img>` de marca, e a única imagem da página
é o carrossel de fotos, que o React troca a cada 4,2 s e sobrescreveria o ajuste.

## Verificado

- [x] Os cinco componentes são carimbados e recebem os ajustes — conferido com um
      harness local que envia o `postMessage` no formato do Editor.
- [x] Controle fora da allowlist não passa: `hero_cta` e `marca_topo` ficaram sem
      `font-size` mesmo com `size` no payload.
- [x] Estado no banco: CONVERTIDO / V1_PUBLICADA / completo, acesso
      ATIVO_ATE_FIM_DO_PROJETO, seis módulos ativos, uma versão atual, 9 itens de
      cronograma, `exports = 0`.

## Pendente

- [ ] Login da conta CLIENT e passagem pelo Editor na sessão real — depende do
      titular; nenhuma senha foi digitada por agente.
- [ ] Envio de pacote (Storage + checklist + ingestão) nesta conta.
- [ ] Trocar `data-editor` carimbado por marcação na própria LP, se o Editor virar
      rotina para esta cliente.

## Ressalvas

- Valores e prazos em `commercial_terms` e no roadmap são **simulação**
  (`financial_status = 'SIMULACAO — sem cobrança'`). Nenhuma cobrança, proposta ou
  contrato existe. A mensalidade citada é a de referência do plano.
- Trocar o texto de `hero_titulo` substitui o conteúdo do `<h1>` inteiro, então o
  traço animado da palavra "contorno" some no preview. É o comportamento do
  runtime, não um defeito desta build.
- A conta CLIENT foi criada já confirmada, direto no banco, justamente para **não**
  disparar e-mail de convite para a cliente real.
