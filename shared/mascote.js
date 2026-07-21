/* ============================================================
   nó · mascote vivo — 4 modos (âmbar → vermelho → azul → verde)

   A cabeça segue o cursor só para a esquerda. Clique no mascote,
   ou em área vazia, troca o modo com fade.

   POR QUE CANVAS, E NÃO <img src> TROCANDO A CADA QUADRO:
   atribuir `img.src` NÃO deixa a imagem pronta na hora, nem quando
   ela já está em cache — o browser reentra no pipeline assíncrono de
   load/decode e o quadro chega atrasado. Era isso que fazia a
   animação engasgar. Com canvas, desenhamos de HTMLImageElement já
   decodificado: `drawImage` é síncrono e cabe no mesmo quadro.

   Como bônus, canvas permite MISTURAR dois frames vizinhos por um
   índice fracionário — 41 quadros passam a render movimento contínuo
   em vez de 41 degraus, sem baixar um byte a mais.

   Frames: assets/mascote/<modo>/00..40.jpg
   Só o modo em tela é pré-carregado; os outros entram quando o
   browser fica ocioso, para não competir com a primeira pintura.

   API: NoMascot.setExpression('amber'|'red'|'blue'|'green')
        NoMascot.next() · NoMascot.getExpression()
        NoMascot.lookAt(x)   // 0..1 (0 = frente, 1 = máx esquerda); null volta ao mouse
        NoMascot.clickAnywhere   // default true
        NoMascot.el
   ============================================================ */
(function () {
  var BASE = '/assets/mascote/';
  var ORDER = ['amber', 'red', 'blue', 'green'];
  var N = 41;
  var FADE_MS = 600;

  /* Ritmo do movimento. SEGUIR é o quanto do trajeto restante a cabeça vence
     por quadro (maior = responde mais rápido ao cursor); OSCILA é o período do
     vaivém ocioso em ms (menor = mais ágil). No mobile não há cursor, então
     OSCILA responde sozinho pela sensação de fluidez. */
  var SEGUIR = 0.24;
  var OSCILA = 950;

  /* ORÇAMENTO DE MEMÓRIA — o que fazia engasgar no celular.
     Cada quadro decodificado ocupa 480×544×4 = 1 MB de bitmap, então um modo
     inteiro são 41 MB e os quatro, 163 MB. No desktop passa; no celular o
     browser despeja bitmaps sob pressão e cada drawImage num quadro despejado
     dispara REDECODIFICAÇÃO SÍNCRONA — o engasgo, reaparecendo em ciclo.

     Duas medidas: em telas de toque usamos metade dos quadros (a interpolação
     cobre a diferença, o movimento continua contínuo), e só o modo em tela
     mais o próximo ficam residentes, em vez dos quatro. */
  var TOQUE = matchMedia('(pointer:coarse)').matches;
  var PASSO = TOQUE ? 2 : 1;

  var IDX = [];
  for (var i = 0; i < 41; i += PASSO) IDX.push(i);
  if (IDX[IDX.length - 1] !== 40) IDX.push(40);
  N = IDX.length;                       // 41 no desktop · 21 no toque

  var SETS = {};
  ORDER.forEach(function (modo) {
    SETS[modo] = IDX.map(function (i) {
      return BASE + modo + '/' + (i < 10 ? '0' + i : i) + '.jpg';
    });
  });

  var box = document.getElementById('no-mascot');
  if (!box) return;
  var cv = box.querySelector('canvas');
  if (!cv) return;
  var ctx = cv.getContext('2d');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* O mascote ancora na direita da HERO no desktop e fica no fluxo (entre
     subtítulo e perguntas) no mobile. Como `position:absolute` resolve contra
     o ancestral posicionado mais próximo, deixá-lo dentro da coluna de texto
     faria ele ancorar nela — e cobrir o texto. Por isso o nó troca de pai.
     Mover preserva o elemento: o loop e o cache seguem válidos. */
  (function posiciona() {
    var wrap = document.getElementById('heroMascot');
    var slot = document.getElementById('mascotSlot');
    var hero = document.getElementById('hero');
    if (!wrap || !slot || !hero) return;
    var mq = matchMedia('(min-width:1200px)');
    function aplica() {
      var alvo = mq.matches ? hero : slot;
      if (wrap.parentElement !== alvo) alvo.appendChild(wrap);
    }
    aplica();
    mq.addEventListener ? mq.addEventListener('change', aplica) : mq.addListener(aplica);
  })();

  var cache = {};
  function preload(modo) {
    if (cache[modo]) return cache[modo];
    cache[modo] = SETS[modo].map(function (u) {
      var im = new Image();
      im.src = u;
      /* decode() tira a decodificação do caminho do primeiro drawImage */
      if (im.decode) im.decode().catch(function () {});
      return im;
    });
    return cache[modo];
  }
  preload('amber');
  /* Só o PRÓXIMO modo entra de véspera — assim o primeiro toque é instantâneo
     sem manter os quatro conjuntos residentes. Os demais entram no próprio
     setExpression; enquanto não chegam, o desenho apenas não compõe a camada
     de entrada (ver `pronta`), sem travar nada. */
  var ocioso = window.requestIdleCallback || function (fn) { setTimeout(fn, 2000); };
  ocioso(function () { preload(ORDER[1]); });

  var expr = 'amber', incoming = null, fadeT0 = 0;
  var targetS = 0, curS = 0, lastMove = 0, hasPointer = false;
  var extLook = null;

  if (!reduce) {
    window.addEventListener('pointermove', function (e) {
      var half = e.clientX / innerWidth;
      targetS = half < 0.5 ? (0.5 - half) * 2 : 0;
      lastMove = performance.now(); hasPointer = true;
    }, { passive: true });
  }

  var larguraCSS = 0, alturaCSS = 0;
  function ajustaCanvas() {
    var r = box.getBoundingClientRect();
    if (!r.width) return false;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (w !== cv.width || h !== cv.height) { cv.width = w; cv.height = h; }
    larguraCSS = r.width; alturaCSS = r.height;
    return true;
  }

  function pronta(im) { return im && im.complete && im.naturalWidth > 0; }

  /* Desenha o modo `modo` no índice fracionário `f`, misturando os dois
     quadros vizinhos. É isso que transforma 41 quadros em movimento contínuo. */
  function desenhaModo(modo, f, alpha) {
    var quadros = cache[modo];
    if (!quadros) return;
    var i0 = Math.floor(f), i1 = Math.min(i0 + 1, N - 1), mix = f - i0;
    var a = quadros[i0], b = quadros[i1];
    if (!pronta(a)) { a = b; mix = 0; }
    if (!pronta(a)) return;
    ctx.globalAlpha = alpha;
    ctx.drawImage(a, 0, 0, cv.width, cv.height);
    if (mix > 0.01 && pronta(b)) {
      ctx.globalAlpha = alpha * mix;
      ctx.drawImage(b, 0, 0, cv.width, cv.height);
    }
    ctx.globalAlpha = 1;
  }

  function loop(now) {
    if (ajustaCanvas()) {
      if (extLook !== null) targetS = extLook;
      else if (reduce) targetS = 0;
      else if (!hasPointer || now - lastMove > 2400) {
        targetS = 0.425 * (1 - Math.cos(now / OSCILA));
      }
      curS += (targetS - curS) * SEGUIR;
      var f = Math.max(0, Math.min(1, curS)) * (N - 1);

      /* respiro: escala sutil aplicada no próprio desenho */
      var breathe = reduce ? 1 : 1 + 0.004 * Math.sin(now / 1600);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      var cx = cv.width / 2, cy = cv.height * 0.44;
      ctx.setTransform(breathe, 0, 0, breathe, cx * (1 - breathe), cy * (1 - breathe));

      desenhaModo(expr, f, 1);
      if (incoming) {
        var t = Math.min(1, (now - fadeT0) / FADE_MS);
        desenhaModo(incoming, f, reduce ? 1 : t * t * (3 - 2 * t));
        if (t >= 1) { expr = incoming; incoming = null; }
      }
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  function setExpression(k) {
    if (!SETS[k] || k === expr || incoming) return;
    preload(k);
    incoming = k; fadeT0 = performance.now();
  }
  function next() {
    var i = (ORDER.indexOf(incoming || expr) + 1) % ORDER.length;
    setExpression(ORDER[i]);
    /* aquece o seguinte, mantendo a janela residente em ~2 modos */
    ocioso(function () { preload(ORDER[(i + 1) % ORDER.length]); });
  }
  box.addEventListener('click', function (e) { e.stopPropagation(); next(); });

  var api = {
    el: box,
    setExpression: setExpression,
    next: next,
    getExpression: function () { return incoming || expr; },
    lookAt: function (x) { extLook = (x === null || x === undefined) ? null : Math.max(0, Math.min(1, x)); },
    clickAnywhere: true
  };
  document.addEventListener('click', function (e) {
    if (!api.clickAnywhere) return;
    if (e.target.closest('a,button,input,select,textarea,label,[role="button"],[data-no-mascot-ignore]')) return;
    if (e.target.closest('#no-mascot')) return;
    next();
  });
  window.NoMascot = api;
})();
