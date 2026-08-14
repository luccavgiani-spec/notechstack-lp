# Para a sessão do rastreio — o que mudou no front (14/08/2026)

Escrito pela sessão de front, na branch `feat/lp-v5-site-oficial`, para quem está
aplicando os pixels do `PLANO-rastreio.md` dentro do CRT e no resto da página.

**Tudo abaixo já está commitado** (último: `e03663e`). Nada foi empurrado pro remote e
**não existe PR aberto** — a publicação como home espera o backend.

---

## 1. O que muda para os pontos de instrumentação do plano

### `abrirDiagnostico()` foi reescrita — leia antes de instrumentar
Ela deixou de expandir a página e passou a atravessar por um **portal** (véu preto +
contador de carregamento). Os caminhos agora são três, e só o primeiro é jornada de
visitante:

| chamada | o que faz | rastrear? |
|---|---|---|
| `abrirDiagnostico()` | portal: véu → preload → salto → revela | **sim** |
| `abrirDiagnostico({semRolar:true})` | só destranca e remede, sem encenação | **não** — é painel/debug |
| segunda chamada (já aberta) | só rola de volta | a combinar |

O contrato que o plano previa continua de pé: o "Ir para esta seção" do painel de
calibragem e o `pousoForceNode` usam `{semRolar:true}` e **não devem entrar no funil**.
Se você for passar `origem:'painel'`, o lugar certo continua sendo essa chamada.

⚠️ **O portal insere de 1,1 s a 9 s entre o clique no CTA e a sala aparecer.** Se algum
evento de "chegou no diagnóstico" for medido por tempo até o primeiro frame do pouso, esse
intervalo agora é encenação, não latência. O contador é progresso real dos ~8 MB de vídeo
da variante ativa.

### `armOption()` não existe mais
Estava em `window` desde a v4 sem um único call site — os botões-pergunta da hero que a
alimentavam saíram junto com o chat. Se o plano listava uma entrada de "atalho da hero",
**ela nunca existiu**. As entradas do diagnóstico são **duas**:

1. CTA "Começar projeto" do `#ctafinal`
2. deep-link `#pouso` (hoje também passa pelo portal)

O CTA da hero (`#heroCtaBtn`) não abre o diagnóstico — ele rola até o `#ctafinal`.

### A ordem das seções mudou
Qualquer scroll-depth ou "section_view" precisa ser remapeado:

```
hero → fluxo(quemsomos, fxFazer, fxAgentes, fxPainel, fxMarketing, ia)
     → platforms → ctafinal → [porta] pouso → footer
```

`#platforms` (agora rotulada **Ferramentas**) subiu de última seção para antes do
`#ctafinal`. Consequência: a queda do mascote ficou mais longa, porque `fallEndEl`
continua sendo o `#ctafinal` e agora há uma seção inteira a mais no caminho.

### Elemento novo: `#portal`
`position:fixed`, `z-index:200`, e enquanto está no ar liga `html.portal-on`, que trava
o scroll (`overflow:hidden` em `html` e `body`). Se algum listener seu depende de scroll
durante a transição, ele fica mudo nesse intervalo — de propósito.

---

## 2. Backend do lead — verificado contra o serviço, não só lido no código

Mandei um lead de teste pela UI e conferi nos três lugares (tela, banco, e-mail). O que
está confirmado:

- **A tabela `leads` tem exatamente estas colunas:**
  `id · nome · email · whatsapp · contexto · objetivos · investimento · prazo ·
  ai_analysis · processed · processed_at · run_id · created_at`
- **Não existe coluna para `site`, `descricao` nem `path`.** O front manda `path` no
  corpo; a function descarta em silêncio.
- A function é a **versão 7**, com `verify_jwt` desligado (por isso o `fetch` do front
  não manda Authorization).
- Ela grava **antes** de notificar, de propósito: erro de rede na Resend não pode custar
  o lead. E devolve `200` com `saved:false` quando a gravação falha.
- O destino do e-mail é roteado por `contexto`: qualquer coisa contendo "roteador" vai
  pra `roteadortelemed@gmail.com`; o resto pra `notechstack@gmail.com`.

**Isto importa pro seu evento `lead_submit`:** o plano já prevê disparar mesmo com
`gravado:false` justamente porque a function devolve 200 nesse caso. Está correto — a
diferença entre os dois números é o alarme de lead se perdendo. Confirmado na prática.

Se o seu escopo incluir dar colunas próprias a `site`/`descricao`/`path`, o front já está
pronto: ele monta os três e hoje empacota dentro de `aiAnalysis` só porque a function não
os aceita. Assim que existirem colunas, é remover o empacotamento em `cfEnviar()`.

---

## 3. Bloqueio para publicar como home (não é do seu escopo, mas te afeta)

O checkbox de consentimento agora tem **links de verdade** (antes eram `<b>`, ou seja,
pedia-se aceite de um texto que ninguém conseguia abrir). Eles apontam para:

- `/termos`
- `/privacidade`

**As duas páginas não existem — dão 404 hoje.** Enquanto isso não for resolvido, publicar
como home significa coletar dado pessoal com um aceite que não pode ser lido. Se o seu
deploy for o mesmo que vai virar a home, vale travar até essas páginas existirem.

---

## 4. Coisas que mexi e podem cruzar com o seu trabalho

- **CRT no retrato**: as opções do menu ganharam respiro menor (`padding`, `margin`,
  `line-height`) e a dica "escolha um caminho" some no celular. O alvo de toque de 44px
  foi mantido. Se você marcar cliques por seletor `.crt-opt`, nada muda.
- **Mascote arrastável no celular** (`window.brincaMascote`): segurar o dedo nele rouba o
  gesto do scroll. O hit-test é manual, então só rouba quando o dedo cai dentro dele. Se
  for medir interação, o estado está em `brincaMascote.modo`
  (`queda` | `preso` | `solto` | `voltando`).
- **`.depth` (profundímetro) escondido no mobile.**
- **`.fx-more` ("Saiba mais")** virou pílula contornada no mobile; continua chamando
  `goTo('ctafinal')`.

---

## 5. Onde está o resto

- Mapa do fluxo do CRT: `FLUXO-CRT.md` + board Miro `nó · fluxo do CRT (LP v5)`
- Painel de calibragem: `PAINEL-lp-v5.md` (tecla `D` ou `?edit=1`)
- Seu plano: `PLANO-rastreio.md` e `RASTREIO-lp-v5.html`
- Servidor local: `python -m http.server 8080 --bind 127.0.0.1` **na raiz do repo**
  (os paths são absolutos: `/brand`, `/main.js`)

⚠️ `localStorage` (`nolp_cfg_v5`) ganha do que está no código. Use "Restaurar padrão" no
painel antes de concluir que algo está errado no arquivo.
