# mascote-no-3d-v5.html — pendências

Viewer de validação das 7 cenas do mascote, mesma arquitetura do v4 (fade por dt,
recolor de olhos, recentragem por quadril, groundY), com fundos fotográficos 2.5D
no lugar dos cenários geométricos. Screenshots das 7 cenas + 1 transição + 1 com
olhos verdes em `screenshots/`.

## Pendências conhecidas

- **Cena 6 (mesa de estudos)**: alinhamento vertical do personagem com o tampo da
  mesa ainda não é perfeito — as pernas ficam parcialmente visíveis "flutuando"
  acima do tampo em vez de tucked atrás dele. occlusionY foi ajustado de 84.5%
  (original) para 79%, melhorou bastante mas não fechou 100%. Precisa de mais uma
  rodada de calibração fina (occlusionY e/ou charY da cena 6).
- **Cena 3 (celular)**: em vez do blend upper-body do `06-looking-phone.fbx`
  sobre a pose sentada (que o manifesto já sinalizava como arriscado —
  "frankenstein"), optei pelo fallback simples: pose de `cena3-idle-newspaper`
  reaproveitada, só trocando o prop (celular no lugar do jornal). Compatível com
  a instrução do manifesto ("simplicidade > acrobacia técnica").
- **Cena 7**: ciclo idle→aceno→idle repete indefinidamente (não é um one-shot
  terminal). Pequeno desvio interpretativo do texto original, pra manter o
  personagem "vivo" no viewer em vez de congelar após o primeiro aceno.
- **Correção de retarget em pé**: clipes retargeted com a perna esticada
  (cena2-idle, cena2-nod, walk-inplace, stand-to-sit, cena4-typing, cena7-wave)
  tinham um offset visual de ~0.29m entre o osso do pé e a malha renderizada —
  aparentemente um mismatch de proporção de esqueleto entre sessões de download
  do Mixamo (poses sentadas não sofrem o mesmo problema, o erro não se amplifica
  na perna dobrada). Corrigido com um offset empírico fixo por clipe em
  `STAND_RETARGET_FIX` no app.js. Não é a causa raiz resolvida, é uma correção
  de sintoma — se novos clipes "em pé" forem adicionados no futuro, podem
  precisar do mesmo tratamento.
- **Máscara dos olhos**: reaproveitada diretamente do `mascote-no-3d-v4.html`
  (mesmo personagem/textura), não foi regerada do zero.
- Não foi gerado relatório longo por pedido explícito — esta é a única nota de
  entrega.

## Arquivos de trabalho (não fazem parte do artefato final)
`build/` contém os scripts do pipeline (conversão FBX→GLB, merge de clipes,
otimização do modelo, assemble do HTML, scripts de validação/calibração via
Playwright). Podem ser apagados ou mantidos para reprodutibilidade.
