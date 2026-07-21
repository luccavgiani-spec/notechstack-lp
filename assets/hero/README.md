# Vídeo de fundo da hero

A home espera um arquivo em **`assets/hero/hero.mp4`**. Enquanto ele não existir,
a hero cai de volta no gradiente + orbs da paleta da marca — sem erro visível,
sem espaço em branco. É só soltar o arquivo aqui que ele assume.

## Como o vídeo se comporta

Ele **não toca sozinho**. Quem controla a linha do tempo é o mouse: o movimento
horizontal do cursor avança e retrocede o vídeo (`delta / innerWidth × 0.8 ×
duração`), e o `seeked` só reenfileira o próximo seek se o alvo mudou — sem isso
o browser afoga em seeks e trava. A lógica está em `index.html`, no IIFE da hero.

Consequências práticas pro arquivo:

- **Sem áudio.** O elemento é `muted` e nunca dá play — trilha sonora é peso morto.
- **Keyframes densos.** Scrub é seek puro; com GOP longo cada seek precisa
  decodificar desde o keyframe anterior e a resposta fica borrachuda. Gere com
  keyframe a cada ~0.2s (`-g 6` a 30fps) mesmo que o arquivo engorde.
- **Curto e em loop.** 4–8s bastam. O usuário varre pra frente e pra trás, não
  assiste do início ao fim.

## Specs

| Item | Valor |
|---|---|
| Caminho | `assets/hero/hero.mp4` |
| Proporção | 16:9 ou mais largo (é `object-fit: cover`) |
| Resolução | 1920×1080 chega; 2560 de largura se o assunto for detalhado |
| Duração | 4–8s |
| Codec | H.264 (`yuv420p`) — maior compatibilidade |
| Áudio | nenhum |
| Peso | mirar ≤ 4 MB; é bloqueante na primeira dobra |

## Enquadramento

O vídeo é posicionado em `object-position: 70% center` — o assunto deve ficar
**à direita**, porque o texto ocupa os ~620px da esquerda. É o mesmo arranjo da
referência: coluna de texto à esquerda, personagem à direita.

Deixe a faixa esquerda clara e sem detalhe competindo — o texto ali é tinta
`#141414` sem caixa de contraste atrás. Se o vídeo escurecer esse lado, o texto
some.

## Recomprimir com keyframes densos

```bash
ffmpeg -i entrada.mp4 -an -c:v libx264 -pix_fmt yuv420p \
  -g 6 -keyint_min 6 -sc_threshold 0 \
  -crf 23 -movflags +faststart \
  assets/hero/hero.mp4
```

`-an` tira o áudio, `-g 6 -sc_threshold 0` força keyframe a cada 6 quadros, e
`+faststart` põe o índice no começo do arquivo pra ele começar a responder antes
de baixar inteiro.

## Trocar o caminho

Se preferir outro nome ou uma CDN, o `src` está no `<video id="heroVideo">` em
`index.html`. Só evite hotlink de arquivo que não seja seu — se cair, cai a hero.
