/* ============================================================
   MASCOTE DE SPRITE — copiado do protótipo (lp-narrador/cenas-lp/no-lp-queda-v2.html)
   Mudanças: o mascote NÃO aparece na hero — ele entra já caindo na 2ª
   seção (stats) e sai do quadro por baixo no #ctafinal, logo antes do
   diagnóstico,
   sem escurecimento por túnel (só CFG.dark), riscos/profundímetro em tinta
   escura translúcida, fallScreenX configurável, suavização posEase/angEase,
   painel de calibragem com persistência em localStorage.
   ============================================================ */
const MAN = {"refHeight":300,"clips":{"queda_a":{"n":67,"cols":8,"rows":9,"fps":15,"loop":true,"sheets":{"@0.5x":{"file":"queda_a@0.5x.webp","fw":167,"fh":116,"sw":1336,"sh":1044},"@1x":{"file":"queda_a@1x.webp","fw":333,"fh":232,"sw":2664,"sh":2088}},"hips":[49.92,54.59,49.87,54.85,49.7,55.03,49.51,55.19,49.41,55.33,49.33,55.43,49.29,55.46,49.26,55.45,49.22,55.39,49.17,55.27,49.15,55.05,49.16,54.73,49.2,54.38,49.23,54.04,49.28,53.77,49.34,53.68,49.38,53.76,49.4,53.86,49.4,53.96,49.4,54.12,49.43,54.28,49.47,54.38,49.48,54.5,49.49,54.59,49.51,54.58,49.57,54.54,49.63,54.55,49.71,54.57,49.84,54.5,49.97,54.4,50.04,54.35,50.09,54.38,50.15,54.47,50.24,54.55,50.32,54.58,50.36,54.61,50.37,54.61,50.36,54.59,50.34,54.59,50.32,54.57,50.33,54.49,50.38,54.43,50.38,54.42,50.37,54.39,50.37,54.35,50.34,54.33,50.32,54.32,50.34,54.29,50.33,54.33,50.29,54.41,50.23,54.48,50.19,54.55,50.17,54.64,50.16,54.76,50.12,54.84,50.04,54.81,49.92,54.67,49.83,54.48,49.8,54.3,49.82,54.12,49.88,53.96,49.94,53.88,49.98,53.83,49.98,53.82,49.95,53.9,49.92,54.05,49.9,54.22]},"queda_b":{"n":21,"cols":8,"rows":3,"fps":30,"loop":true,"sheets":{"@0.5x":{"file":"queda_b@0.5x.webp","fw":117,"fh":135,"sw":936,"sh":405},"@1x":{"file":"queda_b@1x.webp","fw":235,"fh":271,"sw":1880,"sh":813},"@2x":{"file":"queda_b@2x.webp","fw":470,"fh":542,"sw":3760,"sh":1626}},"hips":[42.79,52.7,42.8,52.7,42.8,52.7,42.8,52.7,42.79,52.7,42.79,52.7,42.78,52.7,42.77,52.69,42.77,52.69,42.76,52.69,42.76,52.69,42.75,52.7,42.75,52.7,42.75,52.71,42.75,52.71,42.75,52.72,42.75,52.72,42.76,52.72,42.77,52.72,42.78,52.72,42.79,52.71]},"pousa":{"n":24,"cols":8,"rows":3,"fps":30,"loop":false,"sheets":{"@0.5x":{"file":"pousa@0.5x.webp","fw":143,"fh":208,"sw":1144,"sh":624},"@1x":{"file":"pousa@1x.webp","fw":286,"fh":416,"sw":2288,"sh":1248},"@2x":{"file":"pousa@2x.webp","fw":573,"fh":833,"sw":4584,"sh":2499}},"hips":[58.89,46.92,58.81,46.17,58.72,45.32,58.63,44.39,58.57,43.69,58.55,42.95,58.55,42.55,58.55,49.22,58.55,54.71,58.55,59.46,58.55,62.99,58.55,65.62,58.55,67.94,58.55,69.74,58.55,70.58,58.55,70.53,58.54,67.09,58.54,64.49,58.54,62.77,58.54,61.95,58.55,62.03,58.55,63.02,58.56,64.88,58.57,67.57]},"cadeira_idle":{"n":43,"cols":8,"rows":6,"fps":10,"loop":true,"sheets":{"@0.5x":{"file":"cadeira_idle@0.5x.webp","fw":67,"fh":150,"sw":536,"sh":900},"@1x":{"file":"cadeira_idle@1x.webp","fw":133,"fh":300,"sw":1064,"sh":1800},"@2x":{"file":"cadeira_idle@2x.webp","fw":267,"fh":600,"sw":2136,"sh":3600}},"hips":[51.74,63.91,51.73,63.9,51.72,63.9,51.71,63.9,51.7,63.89,51.7,63.89,51.7,63.89,51.7,63.89,51.7,63.89,51.71,63.89,51.71,63.89,51.72,63.89,51.72,63.89,51.73,63.89,51.73,63.89,51.73,63.89,51.73,63.89,51.72,63.9,51.7,63.9,51.69,63.9,51.68,63.9,51.69,63.9,51.69,63.9,51.7,63.91,51.71,63.91,51.71,63.91,51.72,63.92,51.73,63.92,51.74,63.93,51.76,63.94,51.77,63.94,51.77,63.94,51.78,63.94,51.78,63.94,51.78,63.94,51.78,63.94,51.78,63.94,51.77,63.93,51.77,63.93,51.76,63.92,51.76,63.92,51.75,63.91,51.74,63.91]},"solta":{"n":12,"cols":8,"rows":2,"fps":30,"loop":false,"sheets":{"@0.5x":{"file":"solta@0.5x.webp","fw":148,"fh":179,"sw":1184,"sh":358},"@1x":{"file":"solta@1x.webp","fw":297,"fh":357,"sw":2376,"sh":714},"@2x":{"file":"solta@2x.webp","fw":593,"fh":714,"sw":4744,"sh":1428}},"hips":[47.79,61.2,47.82,58.93,47.84,56.69,47.84,54.48,47.81,52.3,47.76,50.15,47.7,48.02,47.64,45.92,47.59,43.84,47.53,41.77,47.47,39.71,47.4,37.67]}}};

/* Valores padrão = calibragem aprovada pelo Lucca em 10/08 (exportada do
   painel). screenX/Y/W/H daqui são sobrescritos pela variante ativa
   (VIDEO_SETS) no boot — a calibração por variante mora lá. */
const DEFAULT_CFG = {
  sizeK:       0.55,   // altura do mascote na queda = --mh * sizeK (Lucca 14/09, painel)
  fallScreenX: 0.75,   // trava horizontal durante a queda (0-1)
  fallScreenY: 0.65,   // trava vertical durante a queda (0-1)
  fallFadeIn:  0.12,   // fração inicial da queda em que ele APARECE em fade
  fallFadeOut: 1,      // opacidade some ao longo do mergulho de saída
                        // (fração do trecho exitStart→1; 0 = corte seco)
  swapFall:    0.48,   // p em que troca queda_a -> queda_b
  exitStart:   0.86,   // p em que ele acelera pra fora do quadro (por baixo)
  fallEndY:    1,      // ONDE ELE PARA DE CAIR: altura do #ctafinal na tela
                        // no instante em que a queda termina (0 = seção
                        // encostando na base; 1 = seção no topo).
                        // 1 = ele some exatamente quando o CTA chega ao topo
  fallLen:     2.65,   // fallback: duração em viewports, só usado se o
                        // #ctafinal não existir no DOM
  turns:       2,      // voltas completas durante a queda
  swayAmp:     0.13,   // balanço lateral (fração da largura)
  swayFreq:    1,
  ease:        0.29,   // suavização do scroll (menor = mais inércia)
  posEase:     1,      // suavidade da transição de posição (1 = sem atraso:
                        // ele obedece o alvo no mesmo quadro)
  angEase:     0.03,   // suavidade da transição de ângulo
  warm:        0.4,    // correção quente do render (0 = desliga)
  dark:        0.5,    // escurecimento global do mascote (0-0.5)
  heroSloganMs: 600,   // atraso do slogan (o H1) depois que a hero pinta (ms) — era 3000
                       // atrelado ao vídeo; virou H1 e precisa aparecer já (SEO/LCP, 25/09)
  bgBege:      '#E2D8CF', // cor de fundo — seções claras (hero, cta, platforms)
  bgMarrom:    '#70533f', // cor de fundo — seções escuras (o que fazemos)
  bgPreto:     '#141414', // cor de fundo — seções escuras 2 (como usamos IA)
  /* ---- v7 · a história (14/09): fundos claros alternados + tipografia ---- */
  hsBranco:    '#FAFAF7', // fundo branco das etapas (e janela das etapas bege)
  hsBege:      '#E2D8CF', // fundo bege das etapas (e janela das etapas brancas)
  hsKAbre:     1,      // multiplicadores de tamanho de texto (1 = o do CSS)
  hsKAbreP:    1,
  hsKNum:      1,
  hsKH2:       1,
  hsKP:        1,
  hsKLbl:      1,
  hsKEntrega:  1,
  hsKPorque:   1,
  hsKPorqueP:  1,
  mascoteOn:   1,      // 0 = esconde o mascote que cai (e os riscos/profundímetro)
  /* ---- blocos de texto reposicionados no painel (13/08) ----
     a marca sobe pra abrir espaço pro slogan logo abaixo dela; o bloco de
     texto+CTA anda pra esquerda e cresce 28%; o slogan alinha 58px à direita
     da borda da marca (bloco absoluto → o painel escreve isso em margin) ---- */
  txt: {
    heroMark:   { x:   3, y: -232, k: 1    },
    heroTxt:    { x: -84, y:   28, k: 1.28 },
    heroSlogan: { x:  58, y:    0, k: 1    }
  },
  maxTex:      4096    // limite de textura; folhas maiores caem de tier
};
const CFG = Object.assign({}, DEFAULT_CFG);
/* txt é objeto aninhado — Object.assign copia a REFERÊNCIA. Sem clonar, mexer
   na calibragem de texto mutaria o próprio DEFAULT_CFG e o "restaurar padrão"
   devolveria o estado editado em vez do original. */
CFG.txt = JSON.parse(JSON.stringify(DEFAULT_CFG.txt || {}));

/* v5 tem chave PRÓPRIA: dividir a chave com a v4 fazia as duas versões
   sobrescreverem a calibragem uma da outra, e a v4 é a rede de segurança.
   Na primeira carga, herda uma vez o que estiver salvo na v4 — assim a
   calibragem que você já aprovou não se perde — e a partir daí as duas
   seguem independentes. */
const CFG_KEY = 'nolp_cfg_v5';
const CFG_KEY_HERDA = 'nolp_cfg_v4r';
(function loadCFG(){
  try{
    if (localStorage.getItem(CFG_KEY) == null){
      var v4 = localStorage.getItem(CFG_KEY_HERDA);
      if (v4 != null) localStorage.setItem(CFG_KEY, v4);
    }
  }catch(e){}
  try{
    var saved = JSON.parse(localStorage.getItem(CFG_KEY) || 'null');
    if (saved && typeof saved === 'object'){
      /* migração: saves anteriores ao videoRate carregam typeMs=4, que era só
         o default antigo (não escolha) — deixa o novo default (mais lento) valer */
      if (!('videoRate' in saved) && saved.typeMs === 4) delete saved.typeMs;
      Object.assign(CFG, saved);
    }
  }catch(e){}
})();
function saveCFG(){
  try{ localStorage.setItem(CFG_KEY, JSON.stringify(CFG)); }catch(e){}
}
function applyBgColors(){
  const root = document.documentElement.style;
  root.setProperty('--lp-bege', CFG.bgBege);
  root.setProperty('--lp-marrom', CFG.bgMarrom);
  root.setProperty('--lp-preto', CFG.bgPreto);
  /* v7 · história: no :root porque a rampa do #platforms (fora do #fluxo)
     também lê --hs-branco */
  root.setProperty('--hs-branco', CFG.hsBranco);
  root.setProperty('--hs-bege', CFG.hsBege);
  [['--hs-k-abre','hsKAbre'],['--hs-k-abrep','hsKAbreP'],['--hs-k-num','hsKNum'],
   ['--hs-k-h2','hsKH2'],['--hs-k-p','hsKP'],['--hs-k-lbl','hsKLbl'],
   ['--hs-k-entrega','hsKEntrega'],['--hs-k-porque','hsKPorque'],['--hs-k-porquep','hsKPorqueP']]
    .forEach(function(par){ root.setProperty(par[0], CFG[par[1]] != null ? CFG[par[1]] : 1); });
  document.documentElement.classList.toggle('sem-mascote', !CFG.mascoteOn);
}
applyBgColors();

const SHEETS = '/lp-narrador/cenas-lp/sheets/';

const R = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = s => document.querySelector(s);
const clamp = (v,a=0,b=1) => v<a?a:v>b?b:v;
const ss = (e0,e1,x) => { const t = clamp((x-e0)/(e1-e0)); return t*t*(3-2*t); };
const lerp = (a,b,t) => a+(b-a)*t;

const mascot = $('#mascot'), sprite = $('#sprite');
/* A queda deixou de ser "N viewports a partir de uma seção" e passou a ser
   ancorada nas DUAS pontas (reestruturação 13/08): ele entra caindo quando o
   #fluxo (os seis capítulos) entra no quadro e mergulha pra fora exatamente
   no #ctafinal ("e se o próximo projeto fosse o seu?"). Assim a queda cobre
   o bloco preto inteiro + as ferramentas, sem depender de um número mágico
   que quebra toda vez que um capítulo muda de altura. */
const fallEl    = $('#fluxo');     // início da queda
const fallEndEl = $('#ctafinal');  // ONDE ELE PARA de cair
const depthEl = $('#depth'), depthN = $('#depthN'), cv = $('#lines'), ctx = cv ? cv.getContext('2d') : null;
if ($('#ticks')) $('#ticks').innerHTML = '<div></div>'.repeat(10);

let target = window.scrollY, smooth = target, vel = 0, mh = 0, sitH = 260, W = 0, H = 0;
let fallS0 = 0, fallS1 = 1000; // expostas p/ o painel de calibragem ("ir para: queda")

/* ---------- folhas ---------- */
const clips = {};

function pickTier(name){
  const s = MAN.clips[name].sheets;
  const want = (sitH / MAN.refHeight) * Math.min(devicePixelRatio || 1, 2);
  let best = null;
  for (const k in s){
    const sc = parseFloat(k.slice(1)), d = s[k];
    if (d.sw > CFG.maxTex || d.sh > CFG.maxTex) continue;   // estoura textura: pula
    if (!best){ best = {k, sc, d}; continue; }
    const melhor = (sc >= want && (best.sc < want || sc < best.sc)) ||
                   (sc <  want && best.sc < want && sc > best.sc);
    if (melhor) best = {k, sc, d};
  }
  return best;
}

function load(name){
  if (clips[name]) return clips[name];
  const c = MAN.clips[name], t = pickTier(name);
  const img = new Image();
  const o = {name, n:c.n, cols:c.cols, rows:c.rows, fps:c.fps, loop:c.loop,
             hips:c.hips, file:t.d.file, fw:t.d.fw, fh:t.d.fh, sc:t.sc, ready:false};
  img.onload = () => { o.ready = true; };
  img.src = SHEETS + t.d.file;
  o.img = img;
  clips[name] = o;
  return o;
}

/* ---------- player ---------- */
const P = {clip:null, f:0, acc:0, mode:'loop', onEnd:null, lastFile:''};

function play(name, mode, onEnd){
  const c = load(name);
  if (P.clip === c && P.mode === mode) return;
  P.clip = c; P.f = 0; P.acc = 0; P.mode = mode || 'loop'; P.onEnd = onEnd || null;
}

function advance(dt){
  const c = P.clip; if (!c) return;
  const step = 1 / c.fps;
  P.acc += Math.min(dt, 0.25);            // trava após aba em background
  while (P.acc >= step){
    P.acc -= step;
    P.f++;
    if (P.f >= c.n){
      if (P.mode === 'loop'){ P.f = 0; }
      else {
        P.f = c.n - 1;
        const cb = P.onEnd; P.onEnd = null;
        if (cb) cb();
        return;
      }
    }
  }
}

function frameSize(){
  const k = sitH / MAN.refHeight, c = P.clip;
  return [ (c.fw / c.sc) * k, (c.fh / c.sc) * k ];
}

/* ---------- máquina de estados ---------- */
let curX = null, curY = 0, curAng = 0;

function fallClipFor(p){ return p < CFG.swapFall ? 'queda_a' : 'queda_b'; }

/* ---------- streaks — cor adaptável ao fundo por baixo do mascote:
   bege = marrom translúcido, marrom/preto = branco translúcido. Ativas na
   página inteira (não só durante a queda), quase subliminar. ---------- */
const STREAKS = Array.from({length:64}, () => ({
  x: Math.random(), y: Math.random(), l: 40 + Math.random()*170, s: .5 + Math.random()
}));
let lastBgCheck = 0, bgDark = false;
/* sobe a árvore de ancestrais até achar um background-color opaco — a seção
   pode ser transparente e só parecer bege por herdar o fundo do body (caso
   de #hero, que não define background próprio), então checar só o elemento
   sob o cursor (ou só a <section>) lia "transparente" como preto. */
function bgColorAt(el){
  let node = el;
  while (node && node !== document.documentElement){
    const bg = getComputedStyle(node).backgroundColor;
    const m = bg.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
    if (m){
      const a = m[4] === undefined ? 1 : parseFloat(m[4]);
      if (a > 0.05) return [+m[1], +m[2], +m[3]];
    }
    node = node.parentElement;
  }
  const bodyBg = getComputedStyle(document.body).backgroundColor;
  const m2 = bodyBg.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
  return m2 ? [+m2[1], +m2[2], +m2[3]] : [226,216,207];
}
function detectBgDark(x, y){
  const now = performance.now();
  if (now - lastBgCheck < 220) return bgDark;
  lastBgCheck = now;
  const el = document.elementFromPoint(x, y);
  if (el){
    const [r,g,b] = bgColorAt(el);
    const lum = 0.2126*r + 0.7152*g + 0.0722*b;
    bgDark = lum < 130;
  }
  return bgDark;
}
function lineColorRGB(dark){ return dark ? '255,255,255' : '74,59,46'; }
let linhasVazias = false;
function drawLines(intensity, speed, rgb){
  if (!ctx) return;
  /* fora da queda o canvas (tela cheia) já está limpo: limpar de novo a cada
     quadro obrigava o navegador a recompor a tela 60x/s à toa */
  if (intensity <= .01){
    if (!linhasVazias){ ctx.clearRect(0,0,W,H); linhasVazias = true; }
    return;
  }
  linhasVazias = false;
  ctx.clearRect(0,0,W,H);
  ctx.lineWidth = 2.4;
  for (const st of STREAKS){
    st.y -= (0.0022 + speed*0.00055) * st.s;
    if (st.y < -0.3){ st.y = 1.3; st.x = Math.random(); }
    const x = st.x*W, y = st.y*H, len = st.l * (0.4 + speed*0.05);
    const g = ctx.createLinearGradient(x, y, x, y+len);
    g.addColorStop(0,`rgba(${rgb},0)`);
    g.addColorStop(.5,`rgba(${rgb},${0.26*intensity*st.s})`);
    g.addColorStop(1,`rgba(${rgb},0)`);
    ctx.strokeStyle = g;
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y+len); ctx.stroke();
  }
}

/* ---------- ajuste de celular ----------
   No desktop a queda acontece num corredor livre à direita das duas colunas.
   No celular a grade vira uma coluna só e esse corredor deixa de existir: com
   os mesmos números o mascote cai EM CIMA do texto (medido: 233px de largura
   num viewport de 386px, cobrindo 45% da tela). Não mexe no CFG: a calibragem
   do painel continua sendo a do desktop, isto é um fator na hora de desenhar.

   REVISÃO 14/08 — a primeira resposta a esse problema foi encolher pra 0.62 e
   empurrar pra 0.96, deixando o mascote sangrar pela borda ("leitura de
   profundidade em vez de obstáculo"). Na tela isso não se sustentou: em 390px
   ele ficava com 93x123px e ia de x=348 a x=441, ou seja, 51px — mais da
   metade da figura — cortados fora do quadro. Lia-se como bug de layout, não
   como profundidade, e o mascote é o personagem da página.
   Agora ele volta a ter presença (mesma altura do desktop) e fica INTEIRO
   dentro da margem: o x é calculado a partir da largura real desenhada, não
   de uma fração fixa da tela, que era o que deixava o corte à mercê do
   tamanho do aparelho. */
const ehMobile   = () => W < 700;
/* 1 = mesma altura do desktop. Era 0.62 até 14/08. */
const kTamMobile = () => 1;
/* goteira que o mascote respeita à direita, a mesma 24px das seções */
const MARGEM_DIR = 24;
const xMobile    = () => {
  if (!ehMobile()) return CFG.fallScreenX;
  /* fallX é o CENTRO da figura, e em cima dele ainda soma o balanço lateral
     (swayAmp * 0.45 da largura da tela, ±23px em 390). Se a trava não
     descontar os dois, o pico do balanço joga o ombro pra fora — que é o que
     acontecia antes. Então: centro = tela - goteira - meia figura - balanço. */
  const balanco = W * CFG.swayAmp * 0.45;
  const folga   = MARGEM_DIR + sitH * 0.5 + balanco;
  return Math.max(0.5, Math.min(0.92, (W - folga) / W));
};

function measure(){
  W = innerWidth; H = innerHeight;
  if (cv){ cv.width = W; cv.height = H; }
  const sz = document.getElementById('sizer').getBoundingClientRect().height;
  mh = (sz && isFinite(sz) && sz > 20) ? sz : Math.min(320, Math.max(150, H * 0.28));
  sitH = Math.max(90, Math.min(640, mh * CFG.sizeK * kTamMobile()));
}

/* ══════════════════════════════════════════════════════════════════════
   BRINCAR COM O MASCOTE (14/08) — só no celular
   Segurar o dedo nele tira o controle do scroll e devolve pro dedo; soltar
   arremessa com a velocidade do gesto, e ele quica nas paredes até perder a
   energia e voltar pra queda.

   POR QUE ASSIM:
   · O hit-test é MANUAL (uma caixa guardada no desenho), e não
     pointer-events no #mascot. Ligar pointer-events num elemento
     position:fixed de 150x200px no meio da tela significa um buraco onde a
     rolagem morre mesmo quando ninguém quer brincar. Testando na mão, só
     roubamos o gesto quando o dedo cai DENTRO dele.
   · O bloqueio da rolagem é um touchmove com {passive:false}: preventDefault
     em pointerdown não segura scroll no Chrome de Android.
   · Ao soltar, ele não teleporta de volta pra posição da queda — perde
     energia, encosta no chão e só então volta interpolando. Snap depois de
     um arremesso lê como bug.
   ══════════════════════════════════════════════════════════════════════ */
const brinca = (() => {
  /* GRAVIDADE ZERO (14/08, a pedido). A primeira versão tinha gravidade,
     quique no chão e atrito: ele era ARREMESSADO, batia, caía e parava. O que
     se queria é outra coisa — ele FLUTUA. Então não há "baixo": as quatro
     bordas são iguais, o arrasto é o de quem desliza no vácuo (quase nenhum) e
     o giro acompanha, lento. Ele fica à deriva por vários segundos depois do
     empurrão, que é o ponto da brincadeira. */
  const AR     = 0.5;    // arrasto (decaimento exponencial por segundo)
  /* Quique BAIXO de propósito (ajuste 14/08). Com 0.82 ele devolvia quase toda
     a velocidade e o resultado era pinball: batia de parede em parede e a
     brincadeira virava barulho. Com 0.28 a borda absorve a maior parte — ele
     encosta, perde o embalo e sai de lá devagar. Parede de veludo, não de
     borracha. */
  const QUICA  = 0.28;
  const PARADO = 16;     // velocidade abaixo da qual consideramos à deriva parado
  const ESPERA = 1.4;    // segundos parado antes de devolver pra queda
  const MARGEM = 10;

  let modo = 'queda';           // queda | preso | solto | voltando
  let x = 0, y = 0, ang = 0;    // posição do QUADRIL (mesmo espaço de curX/curY)
  let vx = 0, vy = 0, va = 0;
  let quieto = 0, volta = 0;
  let caixa = null;             // {left, top, w, h} do último quadro desenhado
  let pid = null, ox = 0, oy = 0;
  let amostras = [];            // [t, x, y] pra estimar a velocidade do gesto

  /* 18/09: também no desktop, com o mouse. Lá o mascote cai POR TRÁS do
     conteúdo (z 60 contra 61), então o clique só vira brincadeira quando não
     cai num botão, link, campo ou mockup — esses continuam sendo da página. */
  const podeBrincar = () => !R && caixa;
  const INTERATIVO = 'a,button,input,textarea,select,label,summary,[role="button"],[role="radio"],[role="tab"],[contenteditable],.hs-palco,.v8-galeria,.dg-tela,#calibPanel';
  const livre = e => !(e.target && e.target.closest && e.target.closest(INTERATIVO));

  function registraCaixa(left, top, w, h){ caixa = {left, top, w, h}; }
  function some(){ if (modo !== 'queda'){ modo = 'queda'; pid = null; } caixa = null; }

  function dentro(px, py){
    if (!caixa) return false;
    /* folga de 12px: o sprite tem transparência nas bordas e mirar num boneco
       girando com o dedo já é difícil o bastante */
    return px >= caixa.left - 12 && px <= caixa.left + caixa.w + 12 &&
           py >= caixa.top  - 12 && py <= caixa.top  + caixa.h + 12;
  }

  function pega(px, py, id){
    modo = 'preso'; pid = id;
    ox = px - x; oy = py - y;
    vx = vy = va = 0; quieto = 0;
    amostras = [[performance.now(), px, py]];
    document.documentElement.classList.add('brincando');
  }

  function move(px, py){
    if (modo !== 'preso') return;
    x = px - ox; y = py - oy;
    const t = performance.now();
    amostras.push([t, px, py]);
    /* só os últimos 90ms interessam: velocidade de arremesso é o FIM do
       gesto, não a média dele — quem arrasta devagar e dá um peteleco no
       final espera que valha o peteleco */
    while (amostras.length > 2 && t - amostras[0][0] > 90) amostras.shift();
  }

  function solta(){
    if (modo !== 'preso') return;
    const a = amostras[0], b = amostras[amostras.length - 1];
    const dt = Math.max(0.016, (b[0] - a[0]) / 1000);
    vx = (b[1] - a[1]) / dt;
    vy = (b[2] - a[2]) / dt;
    /* teto de velocidade: sem gravidade e com pouco arrasto, um flick violento
       vira um projétil ricocheteando — que não é flutuar. O teto mantém o
       gesto no terreno do "empurrão no espaço". */
    const v = Math.hypot(vx, vy), TETO = 900;
    if (v > TETO){ vx *= TETO / v; vy *= TETO / v; }
    va = vx * 0.09;                 // gira devagar pro lado em que foi empurrado
    modo = 'solto'; pid = null; quieto = 0;
    document.documentElement.classList.remove('brincando');
  }

  /* chamado todo quadro; tx/ty/tang é onde a QUEDA queria que ele estivesse */
  function passo(dt, tx, ty, tang){
    /* na mão ele MANTÉM o ângulo em que estava. Endireitar seria assumir que
       existe "em pé" — e em gravidade zero não existe. */
    if (modo === 'preso') return;

    if (modo === 'solto'){
      /* sem gravidade: nada puxa pra baixo. Só o arrasto tira energia, e
         devagar — é o que faz ele continuar à deriva depois do empurrão. */
      const k = Math.exp(-AR * dt);
      vx *= k; vy *= k;
      x += vx * dt; y += vy * dt;
      ang += va * dt; va *= Math.exp(-0.5 * dt);

      /* as QUATRO bordas são iguais: em gravidade zero não existe chão, existe
         parede. Bater devolve quase toda a velocidade e dá um tranco no giro,
         que é o que faz o quique parecer físico e não um espelhamento. */
      const meiaL = caixa ? caixa.w * 0.5 : 60;
      const meiaA = caixa ? caixa.h * 0.5 : 80;
      const minX = MARGEM + meiaL, maxX = W - MARGEM - meiaL;
      const minY = MARGEM + meiaA, maxY = H - MARGEM - meiaA;

      if (x < minX){ x = minX; vx = Math.abs(vx) * QUICA; va += vy * 0.03; }
      if (x > maxX){ x = maxX; vx = -Math.abs(vx) * QUICA; va -= vy * 0.03; }
      if (y < minY){ y = minY; vy = Math.abs(vy) * QUICA; va -= vx * 0.03; }
      if (y > maxY){ y = maxY; vy = -Math.abs(vy) * QUICA; va += vx * 0.03; }

      /* só devolve pra queda quando ele realmente perdeu a deriva, e depois de
         ESPERA segundos assim — em gravidade zero "parar" é raro, então o
         normal é ele flutuar até a pessoa rolar a página (o some() cuida) */
      quieto = Math.hypot(vx, vy) < PARADO ? quieto + dt : 0;
      if (quieto > ESPERA){ modo = 'voltando'; volta = 0; }
      return;
    }

    if (modo === 'voltando'){
      /* volta LENTA e sem quina: depois de flutuar, um puxão de meio segundo
         pra posição da queda leria como teletransporte */
      volta = Math.min(1, volta + dt / 2.2);
      const e = volta < .5 ? 2*volta*volta : 1 - Math.pow(-2*volta + 2, 2)/2;
      x += (tx - x) * e * 0.12;
      y += (ty - y) * e * 0.12;
      ang += (tang - ang) * e * 0.12;
      if (volta >= 1){ modo = 'queda'; }
    }
  }

  /* ---- gestos ---- */
  addEventListener('pointerdown', e => {
    if (!podeBrincar() || modo === 'preso') return;
    if (!dentro(e.clientX, e.clientY)) return;
    if (e.pointerType === 'mouse'){
      if (e.button !== 0 || !livre(e)) return;
      e.preventDefault();          // sem seleção de texto nem arrasto nativo de imagem
    }
    pega(e.clientX, e.clientY, e.pointerId);
  });

  /* mouse: a mãozinha aparece quando o ponteiro está em cima dele */
  let mira = false;
  addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse' && modo !== 'preso'){
      const m = podeBrincar() && dentro(e.clientX, e.clientY) && livre(e);
      if (m !== mira){ mira = m; document.documentElement.classList.toggle('mascote-mira', m); }
    }
    if (modo !== 'preso' || e.pointerId !== pid) return;
    move(e.clientX, e.clientY);
  }, {passive:true});

  ['pointerup','pointercancel'].forEach(ev =>
    addEventListener(ev, e => { if (e.pointerId === pid) solta(); }, {passive:true}));

  /* o que realmente impede a página de rolar embaixo do dedo */
  addEventListener('touchmove', e => {
    if (modo === 'preso') e.preventDefault();
  }, {passive:false});

  return {
    get modo(){ return modo; },
    get ativo(){ return modo !== 'queda'; },
    get x(){ return x; }, get y(){ return y; }, get ang(){ return ang; },
    /* a queda dita a posição enquanto ninguém está brincando: assim o
       primeiro toque começa exatamente de onde ele está na tela */
    sincroniza(px, py, pang){ if (modo === 'queda'){ x = px; y = py; ang = pang; } },
    registraCaixa, dentro, some, passo
  };
})();
/* exposto pra depuração e pro painel (tecla D): dá pra ler o modo e a caixa
   de toque sem instrumentar o laço */
window.brincaMascote = brinca;
addEventListener('resize', measure);
addEventListener('scroll', () => { target = window.scrollY; }, {passive:true});

/* ---------- loop ---------- */
let last = performance.now();
let foraDaQueda = false;
let alvoVisto = null, layoutSujo = true;
addEventListener('resize', () => { layoutSujo = true; });
addEventListener('load', () => { layoutSujo = true; });
function frame(now){
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.25); last = now;

  if (!fallEl || !mascot || !sprite) return;

  /* parado fora da queda (na hero, ou já depois do #ctafinal) e sem rolagem
     nova: não há nada a recalcular. Sem esta saída, os getBoundingClientRect
     abaixo forçavam recálculo de estilo a cada quadro — ~2 ms por quadro num
     celular médio, 60 vezes por segundo, com a página parada. */
  if (foraDaQueda && !brinca.ativo && !layoutSujo && target === alvoVisto && Math.abs(target - smooth) < 0.5) return;
  alvoVisto = target; layoutSujo = false;

  const prev = smooth;
  smooth += (target - smooth) * (R ? 1 : CFG.ease);
  vel = Math.abs(smooth - prev);

  /* ---- movimento reduzido: sem queda nenhuma ---- */
  if (R){
    mascot.style.opacity = '0';
    if (depthEl) depthEl.style.opacity = '0';
    brinca.some();
    return;
  }

  /* Ele entra no quadro JÁ CAINDO quando o #fluxo entra no viewport (p=0 com
     o topo dele na base da tela) e mergulha pra fora por baixo ao chegar no
     #ctafinal. Nada de hero; depois dele vem o diagnóstico. */
  const stR = fallEl.getBoundingClientRect();
  const S0 = (stR.top + smooth) - H;
  /* fim = topo do #ctafinal já subido `fallEndY` de viewport (0 = o mergulho
     acaba com a seção encostando na base da tela; 1 = com ela no topo).
     Sem a seção no DOM, cai no comportamento antigo (fallLen viewports). */
  const S1 = fallEndEl
    ? Math.max(S0 + H * 0.5, (fallEndEl.getBoundingClientRect().top + smooth) - H * (1 - CFG.fallEndY))
    : S0 + Math.max(200, H * CFG.fallLen);
  fallS0 = S0; fallS1 = S1;
  const p  = clamp((smooth - S0) / (S1 - S0));

  if (p <= 0 || p >= 1){
    /* só escreve quando muda: fora da queda o laço segue vivo (ele precisa
       ver a rolagem), mas não pode sujar estilo a cada quadro */
    if (!foraDaQueda){
      mascot.style.opacity = '0';
      if (depthEl) depthEl.style.opacity = '0';
      foraDaQueda = true;
    }
    drawLines(0, 0, '255,255,255');
    /* saiu de quadro com o dedo em cima (rolou junto, ou chegou no fim da
       queda): a brincadeira acaba aqui, senão ela fica presa e o próximo
       toque na tela pega um mascote invisível */
    brinca.some();
    return;
  }

  foraDaQueda = false;
  const want = fallClipFor(p);
  if (!P.clip || P.clip.name !== want) play(want, 'loop');
  advance(dt);

  const c = P.clip;
  const [fw, fh] = frameSize();
  const hi = Math.min(P.f, (c.hips.length >> 1) - 1);
  const hx = c.hips[hi*2], hy = c.hips[hi*2+1];

  /* entra caindo por CIMA (desce do topo até a trava fallScreenY no primeiro
     trecho), gira o tempo todo, e no fim mergulha pra fora por baixo.
     A opacidade tem rampa dos dois lados (fallFadeIn / fallFadeOut) — é a
     suavização da emenda sprite→vídeo, calibrável no painel */
  const fallX  = W*xMobile() + Math.sin(p*CFG.swayFreq + 0.6) * W * CFG.swayAmp * (ehMobile() ? 0.45 : 1);
  const baseY  = H*CFG.fallScreenY + Math.sin(p*9.1) * H * 0.012;
  const enter  = ss(0, 0.18, p);                       // desce do topo até a trava
  const ex     = clamp((p - CFG.exitStart) / (1 - CFG.exitStart));
  const tx = fallX;
  const ty = lerp(-fh, baseY, enter) + (H * 1.35) * ex * ex;
  const f = p - Math.sin(2*Math.PI*p)/(2*Math.PI);
  const ang = 40 + 360 * CFG.turns * f;
  const scale = 1 + 0.16 * Math.sin(Math.PI * p);
  let alpha = 1;
  if (CFG.fallFadeIn > 0)  alpha *= ss(0, CFG.fallFadeIn, p);
  if (CFG.fallFadeOut > 0) alpha *= 1 - ss(1 - CFG.fallFadeOut, 1, ex);

  if (curX === null){ curX = tx; curY = ty; curAng = ang; }
  else {
    curX += (tx - curX) * CFG.posEase;
    curY += (ty - curY) * CFG.posEase;
    curAng += (ang - curAng) * CFG.angEase;
  }

  /* ---- dedo no mascote (celular): o gesto ganha do scroll ----
     Fora de brincadeira, sincroniza() mantém a física alinhada com a queda,
     pra o primeiro toque começar exatamente de onde ele está na tela. */
  brinca.sincroniza(curX, curY, curAng);
  brinca.passo(dt, tx, ty, ang);
  if (brinca.ativo){ curX = brinca.x; curY = brinca.y; curAng = brinca.ang; }

  /* ---- desenha ---- */
  if (c.ready){
    if (P.lastFile !== c.file){
      sprite.style.backgroundImage = `url("${SHEETS + c.file}")`;
      P.lastFile = c.file;
    }
    mascot.style.width  = fw.toFixed(1) + 'px';
    mascot.style.height = fh.toFixed(1) + 'px';
    sprite.style.backgroundSize = `${(fw*c.cols).toFixed(1)}px ${(fh*c.rows).toFixed(1)}px`;
    const col = P.f % c.cols, row = (P.f / c.cols) | 0;
    sprite.style.backgroundPosition = `${(-col*fw).toFixed(1)}px ${(-row*fh).toFixed(1)}px`;
    mascot.style.opacity = alpha.toFixed(3);
  } else {
    mascot.style.opacity = '0';
  }

  const left = curX - hx/100*fw, top = curY - hy/100*fh;
  /* a caixa do quadro atual é o alvo do dedo — guardada aqui porque é o único
     lugar que sabe o tamanho real do frame depois do sprite escolhido */
  brinca.registraCaixa(left, top, fw, fh);
  mascot.style.transformOrigin = `${hx}% ${hy}%`;
  mascot.style.transform =
    `translate3d(${left.toFixed(2)}px,${top.toFixed(2)}px,0) rotate(${curAng.toFixed(2)}deg) scale(${scale.toFixed(3)})`;

  /* ---- blur de movimento + escurecimento global (CFG.dark, não mais por profundidade) ---- */
  const blur = (0.25 + 1.2*Math.sin(Math.PI*clamp(p))) * clamp(vel/22, 0.2, 1.3);
  mascot.style.filter =
    `sepia(${CFG.warm}) saturate(${(1+CFG.warm*0.9).toFixed(2)}) ` +
    `brightness(${(1-0.32*CFG.dark).toFixed(3)}) contrast(${(1+0.06*CFG.dark).toFixed(3)}) blur(${blur.toFixed(2)}px) ` +
    `drop-shadow(0 18px 18px rgba(20,20,20,.16))`;

  /* ---- profundímetro (localizado na queda) + riscos (página inteira) ---- */
  const dark = detectBgDark(curX, curY);
  const rgb = lineColorRGB(dark);
  const showFall = ss(0.06, 0.16, p) * (1 - ss(0.82, 0.94, p));
  if (depthEl){
    depthEl.style.opacity = showFall.toFixed(2);
    depthEl.style.color = `rgba(${rgb},.55)`;
    depthEl.querySelectorAll('.ticks div').forEach(t => t.style.borderTopColor = `rgba(${rgb},.22)`);
  }
  if (depthN) depthN.textContent = Math.round(p * 240);
  if (cv) cv.style.opacity = '1';
  /* visíveis enquanto o mascote está em cena (a saída p>=1 já retornou
     antes, zerando os riscos — dali em diante a história é do vídeo) */
  const moveIntensity = clamp(0.55 + vel / 24, 0, 1);
  drawLines(moveIntensity, Math.min(vel, 60), rgb);
}

/* nav ativa e reveals ficam por conta do main.js/pillnav oficiais — não há
   observador próprio aqui, evitando dois sistemas de reveal concorrentes */

/* ---- start ---- */
measure();
/* As folhas do mascote (queda_a ~550 KB) só descem quando a pessoa começa a
   rolar: ele entra caindo a partir da 2ª seção, nunca na hero, então baixar
   isso na carga só disputava banda com o que aparece primeiro. O frame()
   chama play() sozinho quando a queda começa. */
const idle = window.requestIdleCallback || (fn => setTimeout(fn, 400));
let folhasPedidas = false;
function pedeFolhas(){
  if (folhasPedidas) return; folhasPedidas = true;
  load('queda_a');
  idle(() => { load('queda_b'); });
}
addEventListener('scroll', pedeFolhas, { once:true, passive:true });
addEventListener('pointerdown', pedeFolhas, { once:true, passive:true });
addEventListener('keydown', pedeFolhas, { once:true });
document.fonts && document.fonts.ready.then(measure);
addEventListener('load', measure);
requestAnimationFrame(frame);

/* ============================================================
   PAINEL DE CONTROLE
   Uma pasta por seção da página, na ordem em que se rola:
   hero · 1ª seção · 2ª seção · diagnóstico · formulário ·
   ferramentas · footer. Cada pasta reúne TUDO que se vê naquela
   seção — os blocos de texto (posição, tamanho e edição do
   conteúdo por clique), a cor de fundo, o respiro vertical e o
   atalho pra rolar até lá — pra você abrir uma pasta só e ter na
   mão todos os controles daquele pedaço da página.

   Duas pastas fogem da regra e ficam no topo: o mascote que cai
   atravessa da 1ª seção até o diagnóstico, e as durações valem
   pra página inteira; nenhum dos dois mora numa seção só.

   ── REGRA (13/08) ─────────────────────────────────────────────
   Toda caixa de texto NOVA já nasce editável. Duas linhas, sempre
   as duas juntas:
     1) o seletor dela entra em EDITABLE_SELECTOR (aí clicar e
        digitar funciona com o painel aberto);
     2) ela vira uma linha em `textos:` DENTRO da pasta da seção
        onde aparece (aí ganha X / Y / tamanho e entra no export).
   Sem as duas, o texto novo vira o único da página que só muda
   mexendo no código.
   ────────────────────────────────────────────────────────────── */
(function(){
  const panel       = document.getElementById('calibPanel');
  const foldersWrap = document.getElementById('cpFolders');
  if (!panel || !foldersWrap) return;

  /* ══════════════════════════════════════════════════════════
     1. O QUE EXISTE EM CADA PASTA
     ══════════════════════════════════════════════════════════ */
  const PASTAS = [
    /* ---------- globais (atravessam a página) ---------- */
    /* v7 (14/09): o mascote virou duas pastas — o básico que se mexe no dia
       a dia fica aberto no topo; o fino da física fica recolhido embaixo */
    {
      id:'anim', label:'Mascote caindo — básico', open:true,
      nota:'O mascote cai da história (etapa 01) até o CTA final — por isso mora aqui, e não dentro de uma seção.',
      irLabel:'Ir: meio da queda', irQueda:true,
      sliders:[
        {k:'sizeK',        min:0.3,  max:1.6,  step:0.01,  label:'Tamanho'},
        {k:'fallScreenX',  min:0,    max:1,    step:0.01,  label:'Posição nos lados (0 esquerda · 1 direita)'},
        {k:'fallScreenY',  min:0,    max:1,    step:0.01,  label:'Altura na tela'},
        {k:'turns',        min:0,    max:5,    step:0.1,   label:'Voltas na queda'},
        {k:'swayAmp',      min:0,    max:0.2,  step:0.005, label:'Balanço lateral'},
        {k:'fallFadeIn',   min:0,    max:0.5,  step:0.01,  label:'Fade ao entrar'},
        {k:'fallFadeOut',  min:0,    max:1,    step:0.01,  label:'Fade ao sair'},
        {k:'dark',         min:0,    max:0.5,  step:0.01,  label:'Escurecimento'}
      ],
      mascoteToggle:true,
      dragMascote:true
    },
    {
      id:'animAv', label:'Mascote caindo — avançado',
      sliders:[
        {k:'fallEndY',     min:0,    max:1,    step:0.01,  label:'ONDE PARA de cair (altura do CTA final na tela)'},
        {k:'swapFall',     min:0.2,  max:0.8,  step:0.01,  label:'Troca de pose no meio da queda'},
        {k:'exitStart',    min:0.4,  max:0.95, step:0.005, label:'Mergulho pra fora do quadro'},
        {k:'swayFreq',     min:1,    max:10,   step:0.1,   label:'Velocidade do balanço'},
        {k:'ease',         min:0.04, max:1,    step:0.01,  label:'Inércia do scroll'},
        {k:'posEase',      min:0.03, max:1,    step:0.01,  label:'Suavidade de posição'},
        {k:'angEase',      min:0.03, max:1,    step:0.01,  label:'Suavidade de giro'},
        {k:'warm',         min:0,    max:0.4,  step:0.01,  label:'Tom quente'}
      ]
    },
    {
      id:'hsTipo', label:'História — tamanhos de texto', open:true,
      nota:'Multiplicadores sobre o tamanho do CSS (1 = original). Valem nas cinco etapas e no fechamento, em qualquer largura de tela. O CONTEÚDO se edita clicando no texto na página — fica salvo neste navegador e sai no "Exportar CFG".',
      sliders:[
        {k:'hsKAbre',     min:0.5, max:1.8, step:0.01, label:'Abertura — título grande'},
        {k:'hsKAbreP',    min:0.6, max:1.6, step:0.01, label:'Abertura — parágrafo'},
        {k:'hsKNum',      min:0.4, max:2,   step:0.01, label:'Número da etapa (01…05)'},
        {k:'hsKH2',       min:0.5, max:1.6, step:0.01, label:'Títulos das etapas'},
        {k:'hsKP',        min:0.6, max:1.6, step:0.01, label:'Parágrafos e listas'},
        {k:'hsKLbl',      min:0.6, max:1.8, step:0.01, label:'Rótulos pequenos (// …, etapas, dicas)'},
        {k:'hsKEntrega',  min:0.6, max:1.6, step:0.01, label:'Caixa "entrega" das etapas'},
        {k:'hsKPorque',   min:0.5, max:1.6, step:0.01, label:'Entrega — título'},
        {k:'hsKPorqueP',  min:0.6, max:1.6, step:0.01, label:'Entrega — textos do resumo'}
      ],
      cores:[
        {k:'hsBranco', label:'Fundo branco (etapas 01·03·05 + janelas de 02·04)'},
        {k:'hsBege',   label:'Fundo bege (etapas 02·04 + janelas de 01·03·05)'}
      ]
    },
    {
      id:'tempo', label:'Tempo',
      sliders:[
        {k:'heroSloganMs', min:0,   max:8000, step:100,  label:'Hero — atraso do slogan (ms)'}
      ]
    },

    /* ---------- uma pasta por seção, na ordem da rolagem ---------- */
    {
      id:'hero', label:'Hero', ir:'#hero',
      textos:[
        {k:'heroMark',   sel:'.hero-left',  lbl:'bloco da marca (marca + slogan)'},
        {k:'heroSlogan', sel:'#heroSlogan', lbl:'slogan — as 2 linhas', abs:true},
        {k:'heroTxt',    sel:'.hero-right', lbl:'descrição + botão'}
      ],
      cores:[{k:'bgBege', label:'Fundo bege (hero, formulário, ferramentas)'}]
    },
    /* ---- 2ª seção: a história (v7) — uma pasta por etapa ---- */
    {
      id:'hs1', label:'História 1/5 — ideia (3D)', ir:'#ideia',
      nota:'As cores de fundo das etapas ficam na pasta "História — tamanhos de texto".',
      respiro:[{id:'ideia', label:'Respiro da etapa'}],
      textos:[
        {k:'hsAbre',  sel:'#ideia .hs-abre',          lbl:'abertura da história'},
        {k:'hs1Col',  sel:'#ideia .hs-col',           lbl:'texto da etapa'},
        {k:'hs1Cena', sel:'#cenaIdeia',               lbl:'cena 3D (bloco inteiro)'}
      ]
    },
    {
      id:'hs2', label:'História 2/5 — plano (entregável)', ir:'#plano',
      respiro:[{id:'plano', label:'Respiro da etapa'}],
      textos:[
        {k:'hs2Col',  sel:'#plano .hs-col',           lbl:'texto da etapa'},
        {k:'hs2Ui',   sel:'#plano .hs-palco',         lbl:'entregável (bloco inteiro)'}
      ]
    },
    {
      id:'hs3', label:'História 3/5 — protótipo (editor)', ir:'#prototipo',
      respiro:[{id:'prototipo', label:'Respiro da etapa'}],
      textos:[
        {k:'hs3Col',  sel:'#prototipo .hs-col',       lbl:'texto da etapa'},
        {k:'hs3Ui',   sel:'#prototipo .hs-palco',     lbl:'editor (bloco inteiro)'}
      ]
    },
    {
      id:'hs4', label:'História 4/5 — sistema (3D)', ir:'#sistema',
      respiro:[{id:'sistema', label:'Respiro da etapa'}],
      textos:[
        {k:'hs4Col',  sel:'#sistema .hs-col',         lbl:'texto da etapa'},
        {k:'hs4Cena', sel:'#cenaSistema',             lbl:'cena 3D (bloco inteiro)'}
      ]
    },
    {
      id:'hs5', label:'História 5/5 — resultado (painel)', ir:'#resultado',
      respiro:[{id:'resultado', label:'Respiro da etapa'}],
      textos:[
        {k:'hs5Col',   sel:'#resultado .hs-col',      lbl:'texto da etapa'},
        {k:'hs5Ui',    sel:'#resultado .hs-palco',    lbl:'painel (bloco inteiro)'}
      ]
    },
    {
      id:'hs6', label:'Entrega — seção de conversão', ir:'#entrega',
      respiro:[{id:'entrega', label:'Respiro da seção'}],
      textos:[
        {k:'hs6Topo',   sel:'#entrega .hs-entg-topo',   lbl:'título + texto + botão'},
        {k:'hs6Janela', sel:'#entrega .hs-entg-janela', lbl:'resumo das 5 etapas'},
        {k:'hs6Comp',   sel:'#entrega .hs-entg-comp',   lbl:'três compromissos'},
        {k:'hs6Final',  sel:'#entrega .hs-entg-final',  lbl:'faixa final com botão'}
      ]
    },
    {
      id:'ferr', label:'4ª seção — ferramentas', ir:'#platforms',
      respiro:[{id:'platforms', label:'Respiro da seção'}],
      textos:[{k:'platHdr', sel:'.plat-hdr', lbl:'rótulo + título + subtítulo'}]
    },
    {
      id:'footer', label:'Footer', ir:'footer',
      textos:[{k:'ftBlock', sel:'footer', lbl:'rodapé (bloco inteiro)'}]
    }
  ];

  /* ══════════════════════════════════════════════════════════
     2. ESTADO COMPARTILHADO
     ══════════════════════════════════════════════════════════ */
  if (typeof CFG.txt    !== 'object' || !CFG.txt)    CFG.txt = {};
  if (typeof CFG.secPad !== 'object' || !CFG.secPad) CFG.secPad = {};

  const sliderInputs = {};   // chave do CFG -> <input range>
  const colorInputs  = {};   // chave do CFG -> <input color>
  const padInputs    = {};   // id da seção -> { inp, lbl }
  const txtEl        = {};   // chave do bloco -> elemento no DOM
  const txtAbs       = {};   // chave do bloco -> mora em position:absolute?
  const txtCtl       = {};   // chave do bloco -> { sel, sync, det } da pasta dele
  let   blocoAtivo   = null; // bloco de texto selecionado no momento

  function fmt(v){ return (Math.round(v*1000)/1000).toString(); }

  /* ══════════════════════════════════════════════════════════
     3. BLOCOS DE TEXTO — posição e tamanho
     Três decisões que não são óbvias:
     1) o deslocamento sai em left/top (position:relative) e NÃO em
        transform: quase todo bloco daqui é .reveal, que já anima
        transform — escrever transform aqui mataria a entrada dele.
     2) em bloco ABSOLUTO (o slogan da hero pendura em top:100%
        abaixo da marca) left/top são a posição-base; sobrescrever
        jogaria o bloco pro canto. Nesses o deslocamento sai em
        margin, que SOMA à base em vez de substituí-la.
     3) o tamanho é MULTIPLICADOR em `zoom`, não pixel fixo — a base
        é o clamp() do CSS, então o responsivo continua valendo, e
        zoom (ao contrário de transform:scale) deixa o texto refluir.
     ══════════════════════════════════════════════════════════ */
  function applyTxt(k){
    const n = txtEl[k]; if (!n) return;
    const c = CFG.txt[k] || (CFG.txt[k] = {x:0,y:0,k:1});
    /* a calibragem é em pixels e foi feita no desktop. Aplicá-la numa tela
       estreita jogaria os blocos pra fora do palco (a marca com y:-232 num
       palco de 700px sairia pelo topo). Abaixo de 1000px vale o layout
       responsivo puro — o painel só mexe no desktop. */
    const vale = innerWidth >= 1000;
    n.style.zoom = (vale && c.k && c.k !== 1) ? c.k : '';
    if (txtAbs[k]){
      n.style.marginLeft = vale ? (c.x || 0) + 'px' : '';
      n.style.marginTop  = vale ? (c.y || 0) + 'px' : '';
    } else if (vale && (c.x || c.y)){
      if (getComputedStyle(n).position === 'static') n.style.position = 'relative';
      n.style.left = (c.x || 0) + 'px';
      n.style.top  = (c.y || 0) + 'px';
    } else {
      n.style.left = ''; n.style.top = '';
    }
  }
  function applyAllTxt(){ Object.keys(txtEl).forEach(applyTxt); }
  window.__txtApplyAll = applyAllTxt;

  function realcaBlocos(){
    Object.keys(txtEl).forEach(function(k){
      txtEl[k].classList.toggle('is-sel', k === blocoAtivo);
    });
  }
  /* clicar num bloco na página abre a pasta da seção dele e seleciona a linha */
  function selecionaBloco(k){
    const c = txtCtl[k]; if (!c) return;
    blocoAtivo = k;
    if (c.det) c.det.open = true;
    c.sel.value = k;
    c.sync();
  }

  /* ══════════════════════════════════════════════════════════
     4. RESPIRO (padding vertical da seção)
     ══════════════════════════════════════════════════════════ */
  function applySecPad(id){
    const el = document.getElementById(id); if (!el) return;
    const m = CFG.secPad[id] != null ? CFG.secPad[id] : 1;
    if (el.dataset.pt0 == null){
      const cs = getComputedStyle(el);
      el.dataset.pt0 = parseFloat(cs.paddingTop) || 0;
      el.dataset.pb0 = parseFloat(cs.paddingBottom) || 0;
    }
    el.style.paddingTop    = (el.dataset.pt0 * m) + 'px';
    el.style.paddingBottom = (el.dataset.pb0 * m) + 'px';
  }

  /* ══════════════════════════════════════════════════════════
     5. CONSTRUTORES DE LINHA
     ══════════════════════════════════════════════════════════ */
  function addSlider(host, s){
    const row = document.createElement('div'); row.className = 'cp-row';
    const lbl = document.createElement('div'); lbl.className = 'cp-lbl';
    lbl.innerHTML = '<span>'+s.label+'</span><b id="cpv-'+s.k+'">'+fmt(CFG[s.k])+'</b>';
    const inp = document.createElement('input');
    inp.type = 'range'; inp.min = s.min; inp.max = s.max; inp.step = s.step; inp.value = CFG[s.k];
    inp.addEventListener('input', function(){
      CFG[s.k] = parseFloat(inp.value);
      const v = document.getElementById('cpv-'+s.k); if (v) v.textContent = fmt(CFG[s.k]);
      if (s.k === 'sizeK') measure();
      if (s.k.indexOf('hsK') === 0) applyBgColors();
      saveCFG();
    });
    row.appendChild(lbl); row.appendChild(inp); host.appendChild(row);
    sliderInputs[s.k] = inp;
  }

  function addColor(host, c){
    const row = document.createElement('div'); row.className = 'cp-color-row';
    const lbl = document.createElement('span'); lbl.textContent = c.label;
    const inp = document.createElement('input');
    inp.type = 'color'; inp.value = CFG[c.k];
    inp.addEventListener('input', function(){
      CFG[c.k] = inp.value;
      applyBgColors();
      saveCFG();
    });
    row.appendChild(lbl); row.appendChild(inp); host.appendChild(row);
    colorInputs[c.k] = inp;
  }

  function addRespiro(host, r){
    const row = document.createElement('div'); row.className = 'cp-row';
    const lbl = document.createElement('div'); lbl.className = 'cp-lbl';
    const cur = CFG.secPad[r.id] != null ? CFG.secPad[r.id] : 1;
    lbl.innerHTML = '<span>'+r.label+'</span><b>'+cur+'×</b>';
    const inp = document.createElement('input');
    inp.type = 'range'; inp.min = 0.3; inp.max = 2; inp.step = 0.05; inp.value = cur;
    inp.addEventListener('input', function(){
      CFG.secPad[r.id] = parseFloat(inp.value);
      applySecPad(r.id); saveCFG();
      lbl.querySelector('b').textContent = CFG.secPad[r.id]+'×';
    });
    row.appendChild(lbl); row.appendChild(inp); host.appendChild(row);
    padInputs[r.id] = { inp:inp, lbl:lbl };
  }

  /* editor dos blocos de texto DAQUELA pasta: escolhe o bloco na lista e
     move/redimensiona. O conteúdo em si se edita clicando no texto na
     página (contentEditable liga junto com o painel). */
  function addTextos(host, blocos, det){
    const meus = blocos.filter(function(b){
      const n = document.querySelector(b.sel);
      if (!n) return false;
      txtEl[b.k]  = n;
      txtAbs[b.k] = !!b.abs;
      n.dataset.txtk = b.k;
      if (!CFG.txt[b.k]) CFG.txt[b.k] = { x:0, y:0, k:1 };
      return true;
    });
    if (!meus.length) return;

    const sel = document.createElement('select');
    meus.forEach(function(b){
      const o = document.createElement('option');
      o.value = b.k; o.textContent = b.lbl; sel.appendChild(o);
    });
    host.appendChild(sel);

    function row(txt, min, max, step){
      const r = document.createElement('div'); r.className = 'cp-row';
      const l = document.createElement('div'); l.className = 'cp-lbl';
      const s = document.createElement('span'); s.textContent = txt;
      const num = document.createElement('input');
      num.type = 'number'; num.min = min; num.max = max; num.step = step;
      l.appendChild(s); l.appendChild(num);
      const rng = document.createElement('input');
      rng.type = 'range'; rng.min = min; rng.max = max; rng.step = step;
      r.appendChild(l); r.appendChild(rng); host.appendChild(r);
      return { rng:rng, num:num };
    }
    const cX = row('X (px)',     -600, 600, 1);
    const cY = row('Y (px)',     -600, 600, 1);
    const cK = row('tamanho ×',   0.4, 2.5, 0.01);

    function sync(){
      const c = CFG.txt[sel.value] || { x:0, y:0, k:1 };
      cX.rng.value = cX.num.value = c.x || 0;
      cY.rng.value = cY.num.value = c.y || 0;
      cK.rng.value = cK.num.value = c.k || 1;
      realcaBlocos();
    }
    function set(prop, v){
      const c = CFG.txt[sel.value]; if (!c) return;
      c[prop] = v; applyTxt(sel.value); sync(); saveCFG();
    }
    [['x',cX],['y',cY],['k',cK]].forEach(function(p){
      p[1].rng.addEventListener('input', function(){ set(p[0], parseFloat(this.value)); });
      p[1].num.addEventListener('input', function(){
        const v = parseFloat(this.value); if (isFinite(v)) set(p[0], v);
      });
    });
    sel.addEventListener('change', function(){ blocoAtivo = sel.value; sync(); });

    meus.forEach(function(b){ txtCtl[b.k] = { sel:sel, sync:sync, det:det }; });

    const acts = document.createElement('div'); acts.className = 'cp-actions';
    const bz = document.createElement('button');
    bz.type = 'button'; bz.textContent = 'Zerar este';
    bz.onclick = function(){
      CFG.txt[sel.value] = {x:0,y:0,k:1}; applyTxt(sel.value); sync(); saveCFG();
    };
    const bza = document.createElement('button');
    bza.type = 'button'; bza.textContent = 'Zerar os desta seção';
    bza.onclick = function(){
      meus.forEach(function(b){ CFG.txt[b.k] = {x:0,y:0,k:1}; applyTxt(b.k); });
      sync(); saveCFG();
    };
    acts.appendChild(bz); acts.appendChild(bza); host.appendChild(acts);

    sync();   // os campos X/Y/× já abrem preenchidos com o 1º bloco da lista
  }

  /* ══════════════════════════════════════════════════════════
     6. MONTAGEM DAS PASTAS
     ══════════════════════════════════════════════════════════ */
  const TODOS_SLIDERS = [];
  let mascoteChk = null;
  const TODAS_CORES   = [];
  const TODOS_RESPIRO = [];

  PASTAS.forEach(function(p){
    const det = document.createElement('details');
    det.className = 'cp-group'; det.dataset.pasta = p.id;
    if (p.open) det.open = true;
    const sum = document.createElement('summary');
    sum.textContent = p.label;
    det.appendChild(sum);

    if (p.nota){
      const n = document.createElement('p'); n.className = 'cp-nota';
      n.textContent = p.nota; det.appendChild(n);
    }

    /* atalho de rolagem: cada seção leva você até ela */
    if (p.ir || p.irQueda){
      const acts = document.createElement('div'); acts.className = 'cp-actions';
      if (p.ir){
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = 'Ir para esta seção';
        b.onclick = function(){
          const el = document.querySelector(p.ir);
          if (el) el.scrollIntoView({ behavior:'smooth' });
        };
        acts.appendChild(b);
      }
      if (p.irQueda){
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = p.irLabel || 'Ir: queda';
        b.onclick = function(){ window.scrollTo({ top:(fallS0+fallS1)/2, behavior:'smooth' }); };
        acts.appendChild(b);
      }
      det.appendChild(acts);
    }

    if (p.sliders){
      p.sliders.forEach(function(s){ addSlider(det, s); TODOS_SLIDERS.push(s); });
    }

    if (p.mascoteToggle){
      const lab = document.createElement('label'); lab.className = 'cp-check';
      const chk = document.createElement('input'); chk.type = 'checkbox'; chk.checked = !!CFG.mascoteOn;
      lab.appendChild(chk);
      lab.appendChild(document.createTextNode(' Mostrar o mascote caindo'));
      det.appendChild(lab);
      chk.addEventListener('change', function(){
        CFG.mascoteOn = chk.checked ? 1 : 0;
        applyBgColors(); saveCFG();
      });
      mascoteChk = chk;
    }
    if (p.dragMascote){
      const lab = document.createElement('label'); lab.className = 'cp-check';
      const chk = document.createElement('input'); chk.type = 'checkbox'; chk.id = 'cpDrag';
      lab.appendChild(chk);
      lab.appendChild(document.createTextNode(' Arrastar o mascote na tela'));
      det.appendChild(lab);
      chk.addEventListener('change', function(){
        mascot.style.pointerEvents = chk.checked ? 'auto' : 'none';
        mascot.style.cursor        = chk.checked ? 'grab' : '';
      });
      ligaDragMascote(chk);
    }

    if (p.textos){
      const h = document.createElement('div'); h.className = 'cp-sub';
      h.textContent = 'Textos — posição e tamanho';
      det.appendChild(h);
      addTextos(det, p.textos, det);
    }

    if (p.cores){
      const h = document.createElement('div'); h.className = 'cp-sub';
      h.textContent = p.cores.length > 1 ? 'Cores' : 'Cor de fundo';
      det.appendChild(h);
      p.cores.forEach(function(c){ addColor(det, c); TODAS_CORES.push(c); });
    }

    if (p.respiro){
      p.respiro.forEach(function(r){ addRespiro(det, r); TODOS_RESPIRO.push(r); });
    }

    foldersWrap.appendChild(det);
  });

  /* respiro salvo de sessões anteriores */
  TODOS_RESPIRO.forEach(function(r){ if (CFG.secPad[r.id] != null) applySecPad(r.id); });

  function syncTudo(){
    TODOS_SLIDERS.forEach(function(s){
      if (sliderInputs[s.k]) sliderInputs[s.k].value = CFG[s.k];
      const v = document.getElementById('cpv-'+s.k);
      if (v) v.textContent = fmt(CFG[s.k]);
    });
    TODAS_CORES.forEach(function(c){ if (colorInputs[c.k]) colorInputs[c.k].value = CFG[c.k]; });
    TODOS_RESPIRO.forEach(function(r){
      const p = padInputs[r.id]; if (!p) return;
      const cur = CFG.secPad[r.id] != null ? CFG.secPad[r.id] : 1;
      p.inp.value = cur;
      const b = p.lbl.querySelector('b'); if (b) b.textContent = cur+'×';
    });
    if (blocoAtivo && txtCtl[blocoAtivo]) txtCtl[blocoAtivo].sync();
    if (mascoteChk) mascoteChk.checked = !!CFG.mascoteOn;
  }

  /* ══════════════════════════════════════════════════════════
     7. ARRASTAR NA TELA
     ══════════════════════════════════════════════════════════ */
  /* ---- mascote ---- */
  function ligaDragMascote(chk){
    let dragging = false, lastX = 0, lastY = 0;
    mascot.addEventListener('mousedown', function(e){
      if (!chk.checked) return;
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      mascot.style.cursor = 'grabbing';
      e.preventDefault();
    });
    window.addEventListener('mousemove', function(e){
      if (!dragging) return;
      const ddx = e.clientX - lastX, ddy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      CFG.fallScreenX = clamp(CFG.fallScreenX + ddx / W);
      CFG.fallScreenY = clamp(CFG.fallScreenY + ddy / H);
      syncTudo(); saveCFG();
    });
    window.addEventListener('mouseup', function(){
      dragging = false;
      if (chk.checked) mascot.style.cursor = 'grab';
    });
  }

  /* ---- blocos de texto ---- */
  const txtDragChk = document.getElementById('cpTxtDrag');
  if (txtDragChk) txtDragChk.addEventListener('change', function(){
    document.documentElement.classList.toggle('txt-edit', txtDragChk.checked);
  });
  let dg = null;
  document.addEventListener('mousedown', function(e){
    if (!txtDragChk || !txtDragChk.checked) return;
    const n = e.target.closest('[data-txtk]');
    if (!n) return;
    selecionaBloco(n.dataset.txtk);
    const c = CFG.txt[blocoAtivo]; if (!c) return;
    dg = { px:e.clientX, py:e.clientY, x0:c.x || 0, y0:c.y || 0 };
    e.preventDefault();
  }, true);
  window.addEventListener('mousemove', function(e){
    if (!dg) return;
    const c = CFG.txt[blocoAtivo]; if (!c) return;
    /* left/top de um elemento com zoom valem na escala DELE — sem dividir,
       um bloco ampliado andaria mais que o cursor */
    const z = (c.k && c.k !== 1) ? c.k : 1;
    c.x = Math.round(dg.x0 + (e.clientX - dg.px) / z);
    c.y = Math.round(dg.y0 + (e.clientY - dg.py) / z);
    applyTxt(blocoAtivo);
    if (txtCtl[blocoAtivo]) txtCtl[blocoAtivo].sync();
  });
  window.addEventListener('mouseup', function(){ if (dg){ dg = null; saveCFG(); } });

  /* o multiplicador é relativo: ao mudar a largura da tela a base do CSS
     muda, então reaplica pra manter a proporção escolhida */
  addEventListener('resize', applyAllTxt);
  applyAllTxt();
  if (PASTAS.length) syncTudo();

  /* ══════════════════════════════════════════════════════════
     8. EXPORTAR / RESTAURAR
     ══════════════════════════════════════════════════════════ */
  window.calibExport = function(){
    const lines      = TODOS_SLIDERS.map(function(s){ return '  '+s.k+': '+CFG[s.k]+','; });
    const colorLines = TODAS_CORES.map(function(c){ return '  '+c.k+': '+JSON.stringify(CFG[c.k])+','; });
    /* só exporta o que saiu do padrão — despejar todos os blocos zerados
       só polui o que você vai colar de volta no código */
    const tocados = {};
    Object.keys(CFG.txt || {}).forEach(function(k){
      const c = CFG.txt[k];
      if (c && (c.x || c.y || (c.k && c.k !== 1))) tocados[k] = c;
    });
    const txtLine = Object.keys(tocados).length
      ? '\n  txt: ' + JSON.stringify(tocados) + ',' : '';
    const pads = {};
    Object.keys(CFG.secPad || {}).forEach(function(id){
      if (CFG.secPad[id] != null && CFG.secPad[id] !== 1) pads[id] = CFG.secPad[id];
    });
    const padLine = Object.keys(pads).length
      ? '\n  secPad: ' + JSON.stringify(pads) + ',' : '';
    lines.push('  mascoteOn: '+(CFG.mascoteOn ? 1 : 0)+',');
    const textosLine = window.__hsTextosExport ? window.__hsTextosExport() : '';
    const txt = 'const CFG = {\n' + lines.join('\n') + '\n' + colorLines.join('\n') +
                txtLine + padLine + '\n  maxTex: '+CFG.maxTex+'\n};' + textosLine;
    const ta = document.getElementById('cpExport');
    ta.value = txt; ta.style.display = 'block'; ta.select();
    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(txt).catch(function(){});
    }
  };

  window.calibReset = function(){
    try{ localStorage.removeItem(CFG_KEY); }catch(e){}
    Object.assign(CFG, DEFAULT_CFG);
    CFG.secPad = {};
    CFG.txt = JSON.parse(JSON.stringify(DEFAULT_CFG.txt || {}));
    Object.keys(txtEl).forEach(function(k){
      if (!CFG.txt[k]) CFG.txt[k] = {x:0,y:0,k:1};
    });
    TODOS_RESPIRO.forEach(function(r){
      const el = document.getElementById(r.id);
      if (el){ el.style.paddingTop = ''; el.style.paddingBottom = ''; delete el.dataset.pt0; delete el.dataset.pb0; }
    });
    if (window.__hsTextosReset) window.__hsTextosReset();
    applyAllTxt(); syncTudo(); applyBgColors(); measure();
  };

  /* ══════════════════════════════════════════════════════════
     9. EDIÇÃO DE CONTEÚDO — clique no texto e digite
     Só liga com o painel aberto; em produção o site fica 100%
     igual, sem contenteditable nenhum.
     Ao acrescentar uma caixa de texto nova à página, o seletor
     dela entra AQUI e a linha dela entra em `textos:` da pasta
     da seção correspondente (ver REGRA no topo).
     ══════════════════════════════════════════════════════════ */
  const EDITABLE_SELECTOR = [
    '.hero-desc', '.hero-slogan > span',
    '.section-label', '.section-title', '.section-sub', '.tagline',
    '.qs-head', '.qs-body',
    /* capítulos do #fluxo */
    '.fx-lbl', '.fx-h2', '.fx-p', '.fx-meta', '.fx-more',
    '.fx-two-hd', '.fx-list li', '.fx-tag', '.fx-note',
    '.fx-term-path', '.fx-term-body > div',
    '.fx-msg-in', '.fx-msg-out', '.fx-chat-done span',
    '.fx-kpi-lbl', '.fx-kpi-num', '.fx-kpi-delta',
    '.fx-step b', '.fx-step span', '.fx-capi span',
    '.fx-log-t', '.fx-log-m', '.fx-log-foot',
    '.fx-tool', '.fx-recon-k', '.fx-recon-c b', '.fx-recon-ok',
    '.fx-trail span', '.fx-led-k', '.fx-led-a', '.fx-led-b',
    /* v7 · a história (ver HS_TEXTOS logo abaixo) */
    '.hs-abre-h', '.hs-abre-p', '.hs-passos li', '.hs-num span', '.hs-lista li',
    '.hs-dica', '.hs-prazo', '.hs-entrega span', '.hs-entrega p', '.hs-legenda',
    '.hs-palco-leg span', '.hs-qa li', '.hs-ent-k', '.hs-ent-h', '.hs-ent-nota',
    '.hs-arq-no b', '.hs-arq-no span', '.hs-arq-centro b', '.hs-arq-centro span',
    '.hs-road-col small', '.hs-road-col span', '.hs-aprov small', '.hs-aprov b',
    '.hs-op-prox small', '.hs-op-prox b',
    '.hs-entg-h', '.hs-entg-p', '.hs-entg-etapa b', '.hs-entg-etapa small', '.hs-entg-etapa ul li',
    '.hs-entg-comp b', '.hs-entg-comp span', '.hs-entg-final h3', '.hs-entg-final p',
    /* diagnóstico "Senta aí" (fora do monitor) */
    '.dg-rot', '.dg-h', '.dg-sub', '.dg-lista b', '.dg-lista span', '.dg-lema',
    '.ft-txt'
  ].join(',');

  /* ── v7 · CONTEÚDO DA HISTÓRIA QUE SOBREVIVE AO RELOAD ──
     O resto da página edita só na tela (some ao recarregar). Nas cinco etapas
     o texto editado fica salvo neste navegador e sai no "Exportar CFG", pra
     ser gravado no código. Chave = etapa + ordem do texto dentro dela; junto
     vai o começo do texto ORIGINAL, e o salvo só é aplicado se ele ainda bate
     — mudou o HTML, a edição antiga é ignorada em vez de cair no lugar errado. */
  (function(){
    const TXT_KEY = 'nolp_textos_v7';
    const HS_TEXTOS = [
      '.fx-lbl', '.fx-h2', '.fx-p', '.fx-more',
      '.hs-abre-h', '.hs-abre-p', '.hs-passos li', '.hs-num span', '.hs-lista li',
      '.hs-dica', '.hs-prazo', '.hs-entrega span', '.hs-entrega p', '.hs-legenda',
      '.hs-palco-leg span', '.hs-qa li', '.hs-ent-k', '.hs-ent-h', '.hs-ent-nota',
      '.hs-arq-no b', '.hs-arq-no span', '.hs-arq-centro b', '.hs-arq-centro span',
      '.hs-road-col small', '.hs-road-col span', '.hs-aprov small', '.hs-aprov b',
      '.hs-op-prox small', '.hs-op-prox b',
      '.hs-entg-h', '.hs-entg-p', '.hs-entg-etapa b', '.hs-entg-etapa small', '.hs-entg-etapa ul li',
      '.hs-entg-comp b', '.hs-entg-comp span', '.hs-entg-final h3', '.hs-entg-final p'
    ].join(',');
    const assina = el => el.textContent.replace(/\s+/g, ' ').trim().slice(0, 48);
    let salvos = {};
    try{ salvos = JSON.parse(localStorage.getItem(TXT_KEY) || '{}') || {}; }catch(e){}
    const els = {}, originais = {};
    document.querySelectorAll('#fluxo .hs-cap').forEach(function(sec){
      sec.querySelectorAll(HS_TEXTOS).forEach(function(el, i){
        const k = sec.id + '/' + i;
        el.dataset.hstxt = k;
        els[k] = el;
        originais[k] = { html: el.innerHTML, ass: assina(el) };
        const sv = salvos[k];
        if (sv && sv.ass === originais[k].ass) el.innerHTML = sv.html;
        else if (sv) delete salvos[k];
      });
    });
    function grava(){ try{ localStorage.setItem(TXT_KEY, JSON.stringify(salvos)); }catch(e){} }
    document.addEventListener('input', function(e){
      if (!panel.classList.contains('open')) return;
      const el = e.target.closest && e.target.closest('[data-hstxt]');
      if (!el) return;
      const k = el.dataset.hstxt;
      if (el.innerHTML === originais[k].html) delete salvos[k];
      else salvos[k] = { ass: originais[k].ass, html: el.innerHTML };
      grava();
    });
    window.__hsTextosReset = function(){
      Object.keys(salvos).forEach(function(k){ if (els[k]) els[k].innerHTML = originais[k].html; });
      salvos = {}; grava();
    };
    window.__hsTextosExport = function(){
      const ks = Object.keys(salvos);
      if (!ks.length) return '';
      return '\n\n/* textos editados na história (' + ks.length + ') — antes → depois */\n' +
        ks.map(function(k){
          const tmp = document.createElement('div'); tmp.innerHTML = salvos[k].html;
          return '// ' + k + '\n//   antes:  ' + originais[k].ass + (originais[k].ass.length >= 48 ? '…' : '') +
                 '\n//   depois: ' + tmp.textContent.replace(/\s+/g, ' ').trim() +
                 '\n' + JSON.stringify({ chave:k, html:salvos[k].html });
        }).join('\n');
    };
  })();

  function setTextEditing(on){
    /* o título e o parágrafo do "quem é a nó" vivem picados em <span> pra
       animar — viram texto inteiro enquanto a edição estiver ligada */
    if (window.__qsPlain) window.__qsPlain(on);
    /* o slogan da hero só entra alguns segundos depois do vídeo carregar;
       com o painel aberto ele aparece na hora, senão você editaria um
       texto invisível */
    if (on){
      const sl = document.getElementById('heroSlogan');
      if (sl) sl.classList.add('in');
    }
    document.querySelectorAll(EDITABLE_SELECTOR).forEach(function(el){
      el.contentEditable = on ? 'true' : 'false';
      el.classList.toggle('lp-editable', on);
    });
  }
  function syncPanelState(){
    const on = panel.classList.contains('open');
    setTextEditing(on);
    if (!on){
      document.documentElement.classList.remove('txt-edit');
      if (txtDragChk) txtDragChk.checked = false;
    }
  }

  window.calibClose = function(){ panel.classList.remove('open'); syncPanelState(); };
  function togglePanel(){ panel.classList.toggle('open'); syncPanelState(); }

  /* Só abre na máquina de desenvolvimento. Em produção a calibragem continua
     sendo aplicada (este módulo roda), mas o painel não abre: nem tecla D,
     nem ?edit=1. */
  const DEV = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const params = new URLSearchParams(location.search);
  if (DEV && params.get('edit') === '1') panel.classList.add('open');
  syncPanelState();

  window.addEventListener('keydown', function(e){
    if (!DEV) return;
    if (e.key !== 'd' && e.key !== 'D') return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (document.activeElement && document.activeElement.isContentEditable) return;
    togglePanel();
  });
})();
