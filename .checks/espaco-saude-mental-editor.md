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

## V2 — pedidos da Thaís (Base V1, enviado em 13/10/2026 16:09) · TASK-mvbfaammemy

Estado em 16/10/2026 (rodada 2, 18:50): **aguardando o pacote**. O Base V1 está só
em produção e o gate nega ao agente o conector Supabase (leitura de banco remoto
incluída, mesmo com a aprovação de Lucca). Dois caminhos, ambos de Lucca, para
`.checks/espaco-saude-mental-v2/base-v1/` (fora do git: é dado de cliente):

- **Mais rápido:** admin → projeto Espaço Saúde Mental → seção "Exports do Editor" →
  card "Base V1 · Enviado em 13/10/2026 16:09". O card lista cada componente
  (tela / rótulo e id) com o "Antes" e o "Depois" em JSON
  (`AdminDashboardPages.tsx`, `EditorExportsControl`). Copiar o card inteiro para
  `base-v1/admin.txt` basta para aplicar texto, tamanho, cor e foto.
- **Completo:** Storage, bucket `editor-exports`, pasta
  `4fbc3859-a32f-4a71-b799-b005f32f65f8/<sha256>/`: `editor.md`, `editor.cfg`,
  `editor.css` e `manifest.json`. O `editor.css` traz o seletor de cada id
  `auto:…`, que o harness usa.

Fotos trocadas pela Thaís vêm como URL pública do bucket `editor-assets` (no "Depois"
ou no `editor.cfg`) e são baixadas pela URL.

### Onde a alteração entra (confirmado)

**Direto na cópia** `app/public/prototipos/espaco-saudemental/`, não no repo
`espacosaudemental`:

- O site no ar está fora do escopo (reunião de 16/10, Q2 = A). Aplicar no repo da
  cliente e regerar a cópia pelo `vite.prototipo.config.ts` mudaria a fonte do site
  no ar.
- Texto entra no bundle inline do `index.html` por troca exata de string (cada troca
  conferida por contagem de ocorrências). Tamanho e cor entram num
  `<style id="no-base-v2">` com os mesmos seletores do `editor.css` do pacote
  (`[data-editor=…]`, ou o caminho no DOM no modo automático). O `no-editor-map.js`
  continua carimbando os mesmos elementos, então o Editor da V2 segue achando os
  componentes.
- Quando a mudança for levada ao site no ar (outra TASK, depois do aceite da Thaís),
  a cópia volta a ser regerada da fonte, e esta camada deixa de ser necessária.

### Ordem (confirmada pelo runtime)

O `no-editor-preview.js` descarta mensagens cujo `baseVersionId` difere do
`data-version-id` da cópia, e `project-publish-version` cria a versão já como atual
(não há rascunho). Logo a cópia publicada precisa do id da V2, que só existe depois da
publicação, e a V2 nasce sem configuração no Editor:

Rodada 2 (16/10): ajustada ao fluxo de Lucca, "Dwight termina → Oscar revisa →
Michael faz PR, merge e deploy", com uma passada só do Oscar:

1. Dwight aplica o Base V1 na cópia (ainda com o id da V1), preenche o checklist e
   confere no harness local (`.checks/espaco-saude-mental-v2/harness/`).
2. Lucca, no admin, num bloco só, publica a V2 e informa o id:
   `V1_PUBLICADA` → `EM_REVISAO_CLIENTE` (manual) → botão "Ingerir no Kanban" no card
   do Base V1 (`ingest_editor_export` exige `EM_REVISAO_CLIENTE`, cria os itens do
   Kanban e já leva a `ALTERACOES_RECEBIDAS`, migration 20261002141941) →
   `V2_EM_DESENVOLVIMENTO` (manual) → publicar a V2 com a mesma referência de build da
   V1, `https://app.notechstack.com.br/prototipos/espaco-saudemental/` (o Editor monta
   o iframe por `config.buildReference`, e ela não muda depois de publicar).
   Publicar não manda e-mail à cliente (`project-publish-version` só registra log).
3. Dwight troca o `data-version-id` da cópia e o placeholder do SQL pelo id da V2.
4. Oscar confere tudo de uma vez: itens do checklist e a troca do id.
5. Michael: PR, merge e deploy.
6. Lucca roda `.checks/espaco-saude-mental-v2/editor_version_configs-v2.sql`
   inteiro (`bridge_enabled = true`). Opcional: "Associar checklist" do Base V1 à V2
   no mesmo card, o que libera o checklist no histórico da cliente.
7. Conferência (C4): a V2 aparece no dashboard e o Editor abre com os componentes.

Entre 2 e 6 o Editor da Thaís fica vazio (`get_client_editor_config` só devolve a
versão atual que tem linha em `editor_version_configs`) e o link do protótipo da V2
ainda mostra a página antiga: fazer 2 → 6 no mesmo período, de preferência fora do
horário da clínica. O SQL fica para depois do deploy de propósito: antes dele o
Editor abriria com componentes, mas o preview não responderia (a cópia no ar, com o
id da V1, descarta as mensagens da V2) e a Thaís poderia mandar um pacote sem ver o
efeito. Vazio é mais seguro que mudo.

### Allowlist e C3

A V1 tem também o modo automático desde 02/10 (`"*": text, size, color, logo` no
`data-components` da cópia, PR #52 e #54), então a Thaís pode ter mexido em qualquer
texto ou foto (ids `auto:…`; foto como `auto:src/<arquivo>`). O C3 da TASK lista só
`marca_topo`, `hero_titulo`, `hero_texto`, `hero_cta` e `valores_titulo`. Até Lucca
decidir, alteração `auto:…` ou estrutural faz a TASK parar e voltar a ele para rever
o porte (pedido aberto em 16/10 com a recomendação de aceitar o modo automático, que
a V1 já liberava).

### Harness de conferência (C1)

`.checks/espaco-saude-mental-v2/harness/` (Andy fez, Dwight revisou):

- `serve.mjs` serve `app/public` em `/` e o harness em `/__harness/`, só em
  127.0.0.1 (no `localhost` o runtime aceita o próprio origin). Node puro.
- `index.html` abre a cópia num iframe, lê projeto, versão e allowlist do próprio
  script da cópia (segue a V1 hoje e a V2 depois da troca do id) e, para cada item,
  confere (a) **estático**: a cópia já mostra o valor, sem mensagem; (b) **editor**:
  o `postMessage` do Editor ainda acha e edita o componente e, com `changes: {}`,
  volta ao original. Item `"negativo": true` prova que controle fora da allowlist
  não passa. Texto que só difere no espaçamento (quebra de linha que vira `<br>`)
  passa com aviso. Resultado no `document.title`: `HARNESS OK x/x` ou
  `HARNESS FALHA x/x: n=…`.
- Item: `{"n", "id", "selector"?, "field": "text|size|color|logo", "expected",
  "negativo"?}`. Para id `auto:…`, o `selector` vem do `editor.css` do pacote.

```
node .checks/espaco-saude-mental-v2/harness/serve.mjs 5317
msedge --headless=new --disable-gpu --user-data-dir=<pasta temporária> --dump-dom --virtual-time-budget=20000 "http://127.0.0.1:5317/__harness/index.html?checklist=checklist.exemplo.json"
```

Na V1 atual (16/10, 18:55): `checklist.exemplo.json` (13 itens dos cinco ids + 1
negativo) → `HARNESS OK 14/14`; controle com um valor errado de propósito →
`HARNESS FALHA 13/14: n=9`.

### Checklist (preenchido quando o pacote chegar)

| # | componente | campo | antes → depois | aplicado | Oscar |
|---|---|---|---|---|---|
| — | aguardando `base-v1/editor.md` | | | | |
