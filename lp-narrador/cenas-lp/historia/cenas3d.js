/* ══════════════════════════════════════════════════════════════════════
   v7 · CENAS 3D das etapas 01 (ideia) e 04 (sistema)
   three.js puro, geometria feita aqui (sem GLB): lajes arredondadas em
   tinta, osso e âmbar sobre o palco areia — a mesma matéria da hero, em
   volume. As duas cenas são DIRIGIDAS PELA ROLAGEM: o progresso vai de 0
   (palco entrando por baixo) a 1 (palco no meio da tela) e volta se a pessoa
   sobe. Fora de quadro o laço para. Movimento reduzido → estado final
   parado, renderizado uma vez.
   ══════════════════════════════════════════════════════════════════════ */
/* 'three' vem do importmap da lp-v7 (mesma instância pra todos os módulos) */
import * as THREE from 'three';
import { criaGiro } from './giro.js';

const REDUZ = matchMedia('(prefers-reduced-motion: reduce)').matches;
const COR = { osso:0xF4EEE4, tinta:0x1B1A19, ambar:0xEDA33B, areia:0xCDBBA4, verde:0x30A46C, cinza:0x8C8479 };
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const suave = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

/* ── laje arredondada: a peça-base de tudo ── */
function laje(w, d, h, r, cor, opts){
  const b = Math.min(r * .5, h * .3);
  const s = new THREE.Shape(), x = -w / 2 + b, y = -d / 2 + b, W = w - 2 * b, D = d - 2 * b, R = Math.max(r - b, .01);
  s.moveTo(x + R, y); s.lineTo(x + W - R, y); s.quadraticCurveTo(x + W, y, x + W, y + R);
  s.lineTo(x + W, y + D - R); s.quadraticCurveTo(x + W, y + D, x + W - R, y + D);
  s.lineTo(x + R, y + D); s.quadraticCurveTo(x, y + D, x, y + D - R);
  s.lineTo(x, y + R); s.quadraticCurveTo(x, y, x + R, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: h - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 10 });
  g.rotateX(-Math.PI / 2); g.translate(0, b, 0);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial(Object.assign({ color: cor, roughness: .78, metalness: 0 }, opts || {})));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/* ── etiqueta: texto desenhado em canvas e deitado sobre a laje ── */
const FONTE = "'Sora', system-ui, sans-serif", MONO = "'JetBrains Mono', ui-monospace, monospace";
function etiqueta(w, h, { k, t, corK = '#A8701F', corT = '#141414', tamT = .25, sub, pad = .16, tamK = .105, entre = 1.12 }){
  const U = 256, dpr = 2;
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * U * dpr); cv.height = Math.round(h * U * dpr);
  const c = cv.getContext('2d'); c.scale(dpr, dpr);
  let yy = pad * U;
  if (k){
    c.font = '600 ' + (tamK * U) + 'px ' + MONO; c.fillStyle = corK; c.textBaseline = 'top';
    if ('letterSpacing' in c) c.letterSpacing = '2px';
    c.fillText(k.toUpperCase(), pad * U, yy);
    if ('letterSpacing' in c) c.letterSpacing = '0px';
    yy += (tamK + .095) * U;
  }
  c.font = '700 ' + (tamT * U) + 'px ' + FONTE; c.fillStyle = corT; c.textBaseline = 'top';
  const maxW = (w - pad * 2) * U, linhas = [];
  t.split('\n').forEach(par => {
    let atual = '';
    par.split(' ').forEach(p => {
      const teste = atual ? atual + ' ' + p : p;
      if (c.measureText(teste).width > maxW && atual){ linhas.push(atual); atual = p; } else atual = teste;
    });
    if (atual) linhas.push(atual);
  });
  linhas.forEach((l, i) => c.fillText(l, pad * U, yy + i * tamT * U * entre));
  if (sub){
    c.font = '500 ' + (.1 * U) + 'px ' + MONO; c.fillStyle = corK;
    c.fillText(sub, pad * U, yy + linhas.length * tamT * U * 1.12 + .05 * U);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const g = new THREE.PlaneGeometry(w, h); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false }));
  m.renderOrder = 2;
  return m;
}

/* ── palco: renderer, luz, sombra, laço e progresso da rolagem ── */
function palco(fig, montar){
  const canvas = fig.querySelector('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 100);
  scene.add(new THREE.HemisphereLight(0xFFF4E6, 0x9C8469, 1.55));
  const sol = new THREE.DirectionalLight(0xFFE7C4, 2.1);
  sol.position.set(-5, 11, 6); sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024); sol.shadow.radius = 6; sol.shadow.bias = -.0006;
  Object.assign(sol.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 });
  scene.add(sol);
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: .2 }));
  chao.rotation.x = -Math.PI / 2; chao.receiveShadow = true; scene.add(chao);
  /* sem escrever profundidade: com o giro livre as peças passam por baixo do
     plano de sombra, e ele não pode tampá-las */
  chao.material.depthWrite = false; chao.renderOrder = -1;

  const raiz = new THREE.Group(); scene.add(raiz);
  const cena = montar({ scene, raiz, camera, fig });

  let aspecto = 1, ultW = 0, ultH = 0;
  function redimensiona(){
    /* mede o CANVAS, não o figure: com a cena solta (14/09) o figure também
       carrega o rótulo e a legenda, e o canvas sangra além da coluna */
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    if (w === ultW && h === ultH) return;   // trava contra laço de resize
    ultW = w; ultH = h;
    renderer.setSize(w, h, false);
    aspecto = w / h; camera.aspect = aspecto;
    cena.enquadra(aspecto);
    camera.updateProjectionMatrix();
    desenha(performance.now());
  }

  let p = REDUZ ? 1 : 0, pAlvo = p, giroAlvo = 0, giro = 0, rodando = false, visivel = false;
  const EIXO_Y = new THREE.Vector3(0, 1, 0), qParallax = new THREE.Quaternion();
  /* giro de globo pelo dedo — ver giro.js */
  const giroDedo = criaGiro({
    superficie: canvas, figura: fig, camera, reduz: REDUZ, avisoEm: canvas.parentElement,
    aoMover: () => { if (!rodando) desenha(performance.now()); }
  });
  function mede(){
    const r = fig.getBoundingClientRect(), H = innerHeight;
    pAlvo = clamp01((H - r.top) / (H * .5 + r.height * .5));
  }
  function desenha(agora){
    cena.atualiza(p, agora / 1000);
    /* parallax do mouse (desktop) + giro livre do dedo (celular) */
    qParallax.setFromAxisAngle(EIXO_Y, giro);
    raiz.quaternion.copy(giroDedo.q).multiply(qParallax);
    renderer.render(scene, camera);
  }
  function laco(agora){
    if (!rodando) return;
    mede();
    p += (pAlvo - p) * .09;
    if (Math.abs(pAlvo - p) < .0005) p = pAlvo;
    giro += (giroAlvo - giro) * .05;
    /* inércia e volta à posição de leitura. As animações da cena nunca
       param — o giro só muda de onde se olha. */
    giroDedo.passo(agora);
    desenha(agora);
    requestAnimationFrame(laco);
  }
  function liga(on){
    if (REDUZ){ if (on) desenha(performance.now()); return; }
    if (on && !rodando){ rodando = true; requestAnimationFrame(laco); }
    else if (!on) rodando = false;
  }
  new IntersectionObserver(es => { visivel = es[0].isIntersecting; liga(visivel && !document.hidden); }, { rootMargin: '120px 0px' }).observe(fig);
  addEventListener('visibilitychange', () => liga(visivel && !document.hidden));
  new ResizeObserver(redimensiona).observe(fig);
  if (!REDUZ && matchMedia('(pointer:fine)').matches){
    fig.addEventListener('pointermove', e => {
      const r = fig.getBoundingClientRect();
      giroAlvo = ((e.clientX - r.left) / r.width - .5) * .22;
    });
    fig.addEventListener('pointerleave', () => { giroAlvo = 0; });
  }

  redimensiona();
  fig.classList.add('pronto');
}

/* ── duas plantas por cena: PAISAGEM (desktop) e RETRATO (celular) ──
   O mesmo fluxograma, montado de outro jeito. Esticar a planta de desktop
   num palco em pé obrigava a câmera a recuar até as etiquetas virarem
   formiga (medido: 11px de texto num 390px). A cena guarda a planta ativa
   e, se o palco virar de proporção, desmonta e remonta a outra. */
const RETRATO = a => a < 1.05;
function descarta(obj){
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    ms.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
  });
}
function plantas(raiz, montar){
  let modo = null, atual = null;
  return {
    garante(novo){
      if (novo === modo) return;
      if (atual){ raiz.remove(atual.grupo); descarta(atual.grupo); }
      modo = novo; atual = montar(novo); raiz.add(atual.grupo);
    },
    atualiza(p, t){ if (atual) atual.atualiza(p, t); }
  };
}

/* ════════════════════ 01 · IDEIA — o briefing se monta ════════════════════
   2ª versão (14/09): prancheta grande, fichas pequenas e caminhos livres —
   as quatro fichas de contexto convergem num nó âmbar e do nó sai um caminho
   só até as prioridades. Informação solta → nó → prioridades.
   No RETRATO a leitura vira de cima pra baixo: fichas 2×2 no alto, nó no
   meio, prioridades embaixo, tudo maior. */
const IDEIA_TXT = {
  cab: { k: 'briefing do projeto', t: 'organizar os pedidos da equipe' },
  fichas: [
    { k: 'o problema',       t: 'pedidos se perdem entre canais',  cor: COR.tinta, corT: '#FFFFFF', corK: '#EDA33B' },
    { k: 'quem usa',         t: 'atendimento, equipe e gestor',    cor: 0xFFFFFF },
    { k: 'onde trava',       t: 'ninguém sabe o status do pedido', cor: COR.tinta, corT: '#FFFFFF', corK: '#EDA33B' },
    { k: 'ferramentas hoje', t: 'WhatsApp, planilha e e-mail',     cor: 0xFFFFFF }
  ],
  prior: { k: 'prioridades da v1', t: '1 · entrada única de pedidos\n2 · responsável e status\n3 · painel do gestor' }
};

function cenaIdeia({ raiz, camera, fig }){
  const chips = Array.from(fig.querySelectorAll('.hs-palco-leg span'));
  const rotulo = fig.querySelector('.hs-palco-rot');
  const TOPO = .16;

  function montar(modo){
    const R = modo === 'retrato';
    const L = R ? {
      BW: 5.0, BD: 7.6, CW: 2.0, CD: 1.3, CH: .1, tamT: .19, tamK: .105, padC: .14,
      cab: { w: 4.6, h: .75, x: 0, z: -3.33, tamT: .25, tamK: .12 },
      cartas: [[-1.32, -2.4], [1.32, -2.4], [-1.32, -.95], [1.32, -.95]],
      hub: [0, .5], PW: 4.45, PD: 1.72, prior: [0, 2.5], tamP: .21, entreP: 1.42,
      solto: i => new THREE.Vector3((i % 2 ? 1.6 : -1.6) + (i - 1.5) * .2, 1.2 + (i % 2) * .5, -3.2 + i * 1.2)
    } : {
      BW: 8.4, BD: 5.5, CW: 2.3, CD: .92, CH: .09, tamT: .15, tamK: .085, padC: .13,
      cab: { w: 5.6, h: .7, x: -8.4 / 2 + 2.95, z: -5.5 / 2 + .5, tamT: .2, tamK: .1 },
      cartas: [[-2.8, -1.28], [-2.8, -.16], [-2.8, .96], [-2.8, 2.08]],
      hub: [-.15, .38], PW: 3.25, PD: 1.95, prior: [2.5, .38], tamP: .17, entreP: 1.55,
      solto: i => { const a = -2.4 + i * 1.05; return new THREE.Vector3(Math.cos(a) * 2.6 - 1.2, 1.1 + (i % 2) * .5, Math.sin(a) * 1.6 + .2); }
    };
    const grupo = new THREE.Group();

    const prancheta = new THREE.Group(); grupo.add(prancheta);
    /* areia, não osso: sem a janela bege atrás, a prancheta osso sumia no
       fundo branco da etapa */
    const base = laje(L.BW, L.BD, TOPO, .34, 0xE6D9C8, { transparent: true });
    prancheta.add(base);
    const cab = etiqueta(L.cab.w, L.cab.h, { k: IDEIA_TXT.cab.k, t: IDEIA_TXT.cab.t, tamT: L.cab.tamT, tamK: L.cab.tamK, corK: '#9A6418' });
    cab.position.set(L.cab.x, TOPO + .003, L.cab.z); cab.material.opacity = 0; prancheta.add(cab);

    const fichas = IDEIA_TXT.fichas.map((d, i) => {
      const g = new THREE.Group();
      g.add(laje(L.CW, L.CD, L.CH, .12, d.cor));
      const e = etiqueta(L.CW - .04, L.CD - .04, { k: d.k, t: d.t, corT: d.corT || '#141414', corK: d.corK || '#9A6418', tamT: L.tamT, tamK: L.tamK, pad: L.padC });
      e.position.y = L.CH + .003; g.add(e);
      grupo.add(g);
      return {
        g, fase: i * 1.3,
        solto: { pos: L.solto(i), rot: new THREE.Quaternion().setFromEuler(new THREE.Euler(.45 - (i % 2) * .8, (i - 1.5) * .35, (i % 2 ? -.25 : .22))) },
        alvo: { pos: new THREE.Vector3(L.cartas[i][0], TOPO + .004, L.cartas[i][1]), rot: new THREE.Quaternion() }
      };
    });

    const prior = new THREE.Group();
    prior.add(laje(L.PW, L.PD, .12, .18, COR.ambar));
    const pe = etiqueta(L.PW - .06, L.PD - .06, { k: IDEIA_TXT.prior.k, t: IDEIA_TXT.prior.t, corK: '#5A3A0C', tamT: L.tamP, tamK: L.tamK + .01, pad: .2, entre: L.entreP });
    pe.position.y = .123; prior.add(pe);
    grupo.add(prior);
    const priorSolto = { pos: R ? new THREE.Vector3(0, 2.2, 4.4) : new THREE.Vector3(4.2, 1.6, -1.6), rot: new THREE.Quaternion().setFromEuler(new THREE.Euler(.5, -.5, .2)) };
    const priorAlvo  = { pos: new THREE.Vector3(L.prior[0], TOPO + .004, L.prior[1]), rot: new THREE.Quaternion() };

    const HUB = new THREE.Vector3(L.hub[0], TOPO + .04, L.hub[1]);
    const no = new THREE.Group();
    const disco = new THREE.Mesh(new THREE.CylinderGeometry(.36, .36, .12, 40), new THREE.MeshStandardMaterial({ color: COR.tinta, roughness: .6 }));
    disco.position.y = .06; disco.castShadow = true; no.add(disco);
    const aro = new THREE.Mesh(new THREE.TorusGeometry(.36, .038, 10, 48), new THREE.MeshBasicMaterial({ color: COR.ambar, toneMapped: false }));
    aro.rotation.x = Math.PI / 2; aro.position.y = .12; no.add(aro);
    const noEt = etiqueta(.62, .38, { t: 'nó.', corT: '#EDA33B', tamT: .21, pad: .1 });
    noEt.position.set(0, .125, .02); no.add(noEt);
    no.position.set(HUB.x, TOPO, HUB.z); no.scale.setScalar(0); grupo.add(no);

    /* caminhos: fichas → nó (em cascata) e nó → prioridades */
    const Y = TOPO + .04;
    const matCaminho = new THREE.MeshStandardMaterial({ color: COR.tinta, roughness: .5 });
    const caminhos = L.cartas.map(([x, z], i) => {
      let ini, c1, c2, fim;
      if (R){
        const lado = x < 0 ? -1 : 1;
        if (i < 2){
          /* as de cima saem pela lateral de dentro e descem pelo corredor
             entre as colunas, sem cruzar as fichas de baixo */
          ini = new THREE.Vector3(lado * (Math.abs(x) - L.CW / 2 - .02), Y, z);
          c1  = new THREE.Vector3(lado * .12, Y, z);
          c2  = new THREE.Vector3(lado * .12, Y, HUB.z - 1.0);
          fim = new THREE.Vector3(lado * .1, Y, HUB.z - .37);
        } else {
          ini = new THREE.Vector3(x, Y, z + L.CD / 2 + .02);
          c1  = new THREE.Vector3(x, Y, ini.z + .45);
          c2  = new THREE.Vector3(lado * .75, Y, HUB.z);
          fim = new THREE.Vector3(lado * .38, Y, HUB.z);
        }
      } else {
        ini = new THREE.Vector3(x + L.CW / 2 + .02, Y, z);
        fim = new THREE.Vector3(HUB.x - .38, Y, HUB.z + (i - 1.5) * .12);
        c1 = new THREE.Vector3(ini.x + .75, Y, z);
        c2 = new THREE.Vector3(fim.x - .75, Y, fim.z);
      }
      const curva = new THREE.CubicBezierCurve3(ini, c1, c2, fim);
      const geo = new THREE.TubeGeometry(curva, 64, R ? .045 : .035, 8, false);
      const m = new THREE.Mesh(geo, matCaminho); m.castShadow = true; grupo.add(m);
      const pino = new THREE.Mesh(new THREE.SphereGeometry(R ? .09 : .07, 16, 12), new THREE.MeshBasicMaterial({ color: COR.ambar, toneMapped: false }));
      pino.position.copy(ini); pino.scale.setScalar(0); grupo.add(pino);
      const pulso = new THREE.Mesh(new THREE.SphereGeometry(R ? .085 : .065, 14, 10), new THREE.MeshBasicMaterial({ color: COR.ambar, toneMapped: false }));
      pulso.visible = false; grupo.add(pulso);
      return { curva, geo, total: geo.index.count, pino, pulso };
    });
    const saidaCurva = R
      ? new THREE.LineCurve3(new THREE.Vector3(HUB.x, Y, HUB.z + .38), new THREE.Vector3(L.prior[0], Y, L.prior[1] - L.PD / 2 - .02))
      : new THREE.LineCurve3(new THREE.Vector3(HUB.x + .38, Y, HUB.z), new THREE.Vector3(L.prior[0] - L.PW / 2 - .02, Y, L.prior[1]));
    const saidaGeo = new THREE.TubeGeometry(saidaCurva, 24, R ? .075 : .06, 10, false);
    grupo.add(new THREE.Mesh(saidaGeo, new THREE.MeshBasicMaterial({ color: COR.ambar, toneMapped: false })));
    const saidaTotal = saidaGeo.index.count;
    const saidaPulso = new THREE.Mesh(new THREE.SphereGeometry(R ? .12 : .1, 16, 12), new THREE.MeshBasicMaterial({ color: COR.tinta, toneMapped: false }));
    saidaPulso.visible = false; grupo.add(saidaPulso);

    const q = new THREE.Quaternion(), v = new THREE.Vector3(), eixoY = new THREE.Vector3(0, 1, 0), giroQ = new THREE.Quaternion();
    function assenta(obj, solto, alvo, qi, fase, t){
      const bob = (1 - qi) * (REDUZ ? 0 : Math.sin(t * 1.1 + fase) * .14);
      v.lerpVectors(solto.pos, alvo.pos, qi);
      v.y += Math.sin(qi * Math.PI) * .55 + bob;
      obj.position.copy(v);
      q.slerpQuaternions(solto.rot, alvo.rot, qi);
      if (!REDUZ && qi < 1) q.multiply(giroQ.setFromAxisAngle(eixoY, Math.sin(t * .7 + fase) * .06 * (1 - qi)));
      obj.quaternion.copy(q);
    }

    return {
      grupo,
      atualiza(p, t){
        const pb = suave(clamp01((p - .12) / .35));
        base.material.opacity = .25 + .75 * pb;
        prancheta.position.y = lerp(-.3, 0, pb);
        cab.material.opacity = suave(clamp01((p - .4) / .2));
        let prontas = 0;
        fichas.forEach((f, i) => {
          const qi = suave(clamp01((p - .18 - i * .07) / .38));
          assenta(f.g, f.solto, f.alvo, qi, f.fase, t);
          const ok = qi > .97;
          if (ok) prontas++;
          if (chips[i]) chips[i].classList.toggle('on', ok);
        });
        assenta(prior, priorSolto, priorAlvo, suave(clamp01((p - .42) / .36)), 7, t);
        no.scale.setScalar(suave(clamp01((p - .6) / .1)));
        caminhos.forEach((c, i) => {
          const qc = suave(clamp01((p - .64 - i * .045) / .16));
          c.geo.setDrawRange(0, Math.floor(c.total * qc / 3) * 3);
          c.pino.scale.setScalar(qc > 0 ? 1 : 0);
          c.pulso.visible = qc >= 1 && !REDUZ;
          if (c.pulso.visible) c.curva.getPoint((t * .45 + i * .23) % 1, c.pulso.position);
        });
        const qs = suave(clamp01((p - .86) / .1));
        saidaGeo.setDrawRange(0, Math.floor(saidaTotal * qs / 3) * 3);
        saidaPulso.visible = qs >= 1 && !REDUZ;
        if (saidaPulso.visible) saidaCurva.getPoint((t * .6) % 1, saidaPulso.position);
        if (!REDUZ && qs >= 1) aro.scale.setScalar(1 + Math.sin(t * 3) * .06);
        const pronto = prontas === fichas.length && qs >= 1;
        if (chips[4]) chips[4].classList.toggle('on', pronto);
        if (rotulo) rotulo.lastChild.textContent = pronto ? 'briefing organizado' : 'briefing em montagem';
      }
    };
  }

  const pl = plantas(raiz, montar);
  return {
    enquadra(a){
      if (RETRATO(a)){
        pl.garante('retrato');
        /* quase de cima: a prancheta em pé cabe inteira sem recuar a câmera */
        const k = Math.max(1, .74 / a);
        camera.position.set(0, 12.4 * k, 4.3 * k);
        /* mira um tico abaixo do centro: a cena sobe e libera o rodapé das
           pílulas da legenda */
        camera.lookAt(0, 0, .42);
      } else {
        pl.garante('paisagem');
        camera.position.set(0, 10.3, 7.1);
        camera.lookAt(.15, 0, .4);
      }
    },
    atualiza: pl.atualiza
  };
}

/* ═════════════ 04 · SISTEMA — construir, conectar, verificar ═════════════
   PAISAGEM: bancada larga, seis módulos em volta do núcleo.
   RETRATO: bancada em pé, núcleo quadrado no centro e os módulos em duas
   colunas de três — cabos curtos, etiquetas grandes, a varredura desce em
   vez de atravessar. */
const SIS_MODS = [
  { t: 'banco', s: 'dados' }, { t: 'login', s: 'acesso' }, { t: 'WhatsApp', s: 'entrada' },
  { t: 'planilha', s: 'sincronia' }, { t: 'painel', s: 'gestor' }, { t: 'e-mail', s: 'avisos' }
];

function cenaSistema({ raiz, camera, fig }){
  const qa = Array.from(fig.querySelectorAll('.hs-qa li'));
  const rotulo = fig.querySelector('.hs-palco-rot');
  const TOPO = .26;
  const marcaQa = (i, estado) => {
    if (!qa[i]) return;
    qa[i].classList.toggle('ok', estado === 'ok');
    qa[i].classList.toggle('rodando', estado === 'rodando');
  };

  function montar(modo){
    const R = modo === 'retrato';
    const L = R ? {
      BW: 5.9, BD: 7.6, nucleo: [1.62, 1.62], mod: [1.72, 1.06], tamM: .27,
      pos: [[-1.95, -2.55], [1.95, -2.55], [-1.95, 0], [1.95, 0], [-1.95, 2.55], [1.95, 2.55]],
      eixo: 'z', scanDe: -3.7, scanAte: 3.7, onda: .95
    } : {
      BW: 7.8, BD: 5.9, nucleo: [2.0, 1.55], mod: [1.62, 1.0], tamM: .24,
      pos: [[-2.75, -1.7], [0, -2.15], [2.75, -1.7], [-2.75, 1.7], [0, 2.15], [2.75, 1.7]],
      eixo: 'x', scanDe: -3.6, scanAte: 3.6, onda: 1.2
    };
    const grupo = new THREE.Group();
    grupo.add(laje(L.BW, L.BD, TOPO, .34, COR.tinta));
    const matG = new THREE.LineBasicMaterial({ color: 0x3A3835, transparent: true, opacity: .55 });
    const gx = L.BW / 2 - .3, gz = L.BD / 2 - .3;
    for (let x = -Math.floor(gx * 2) / 2; x <= gx + .01; x += .5) grupo.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, TOPO + .002, -gz), new THREE.Vector3(x, TOPO + .002, gz)]), matG));
    for (let z = -Math.floor(gz * 2) / 2; z <= gz + .01; z += .5) grupo.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-gx, TOPO + .002, z), new THREE.Vector3(gx, TOPO + .002, z)]), matG));

    const nucleo = new THREE.Group(); grupo.add(nucleo);
    const [NW, ND] = L.nucleo;
    nucleo.add(laje(NW, ND, .5, .22, COR.ambar));
    const nEt = R
      ? etiqueta(NW - .08, ND - .08, { k: 'v1', t: 'sua operação', corK: '#5A3A0C', tamT: .22, sub: 'no seu nome', pad: .15 })
      : etiqueta(NW - .1, ND - .1, { k: 'primeira versão', t: 'sua operação', corK: '#5A3A0C', tamT: .27, sub: 'v1 · no seu nome' });
    nEt.position.y = .503; nucleo.add(nEt);
    nucleo.position.y = TOPO;
    const onda = new THREE.Mesh(new THREE.RingGeometry(L.onda, L.onda + .08, 64), new THREE.MeshBasicMaterial({ color: COR.ambar, transparent: true, opacity: 0, side: THREE.DoubleSide, toneMapped: false }));
    onda.rotation.x = -Math.PI / 2; onda.position.y = TOPO + .01; grupo.add(onda);

    const matLuzOff = new THREE.MeshBasicMaterial({ color: 0x5C5650, toneMapped: false });
    const matLuzOk = new THREE.MeshBasicMaterial({ color: COR.verde, toneMapped: false });
    const matCabo = new THREE.MeshStandardMaterial({ color: COR.areia, roughness: .6 });
    const [MW, MD] = L.mod;
    const mods = SIS_MODS.map((m, i) => {
      const [x, z] = L.pos[i];
      const g = new THREE.Group();
      g.add(laje(MW, MD, .34, .14, COR.osso));
      const e = etiqueta(MW - .06, MD - .06, { k: m.s, t: m.t, tamT: L.tamM, tamK: R ? .12 : .105, corK: '#8A5A14' });
      e.position.y = .343; g.add(e);
      const luz = new THREE.Mesh(new THREE.SphereGeometry(R ? .08 : .06, 14, 10), matLuzOff);
      luz.position.set(MW / 2 - .17, .37, -MD / 2 + .17); g.add(luz);
      g.position.set(x, TOPO, z); grupo.add(g);
      let ini, fim;
      if (R){
        ini = new THREE.Vector3(x + (x < 0 ? MW / 2 : -MW / 2), TOPO + .12, z * .96);
        /* o núcleo quadrado mede ±0,81: as pontas das fileiras de cima e de
           baixo chegam perto dos cantos dele, não além */
        fim = new THREE.Vector3(x < 0 ? -NW / 2 : NW / 2, TOPO + .3, z * .24);
      } else {
        ini = new THREE.Vector3(x * .78, TOPO + .12, z * .72);
        fim = new THREE.Vector3(x * .28, TOPO + .3, z * .3);
      }
      const meio = ini.clone().lerp(fim, .5); meio.y += R ? .6 : .75;
      const curva = new THREE.QuadraticBezierCurve3(ini, meio, fim);
      const geo = new THREE.TubeGeometry(curva, 48, R ? .045 : .03, 6, false);
      const cabo = new THREE.Mesh(geo, matCabo); cabo.castShadow = true; grupo.add(cabo);
      const pulso = new THREE.Mesh(new THREE.SphereGeometry(R ? .09 : .07, 12, 10), new THREE.MeshBasicMaterial({ color: COR.ambar, toneMapped: false }));
      pulso.visible = false; grupo.add(pulso);
      return { g, luz, curva, geo, total: geo.index.count, pulso, eixo: L.eixo === 'x' ? x : z };
    });

    const scan = new THREE.Mesh(
      L.eixo === 'x' ? new THREE.BoxGeometry(.04, .9, 6.0) : new THREE.BoxGeometry(L.BW - .4, .9, .05),
      new THREE.MeshBasicMaterial({ color: COR.ambar, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }));
    scan.position.y = TOPO + .45; grupo.add(scan);

    let inicioQa = null;
    return {
      grupo,
      atualiza(p, t){
        mods.forEach((m, i) => {
          const qi = clamp01((p - .12 - i * .07) / .32);
          const cai = 1 - Math.pow(1 - qi, 3);
          const quique = qi < 1 ? Math.sin(qi * Math.PI) * .15 : 0;
          m.g.position.y = TOPO + (1 - cai) * 3.2 + quique;
          m.g.visible = qi > 0;
          m.g.scale.setScalar(lerp(.85, 1, cai));
          const qc = suave(clamp01((p - .5 - i * .045) / .22));
          m.geo.setDrawRange(0, Math.floor(m.total * qc / 3) * 3);
          m.pulso.visible = qc >= 1 && !REDUZ;
          if (m.pulso.visible) m.curva.getPoint((t * .55 + i * .19) % 1, m.pulso.position);
        });
        nucleo.scale.set(1, lerp(.05, 1, suave(clamp01((p - .05) / .25))), 1);

        marcaQa(0, p > .3 ? 'ok' : p > .1 ? 'rodando' : '');
        marcaQa(1, p > .9 ? 'ok' : p > .5 ? 'rodando' : '');
        if (p < .96) inicioQa = null;
        else if (inicioQa === null) inicioQa = t;
        const dt = REDUZ ? 99 : (inicioQa === null ? -1 : t - inicioQa);

        const qs = clamp01(dt / 2.4);
        scan.material.opacity = dt >= 0 && qs < 1 ? .75 : 0;
        const pos = lerp(L.scanDe, L.scanAte, qs);
        if (L.eixo === 'x') scan.position.x = pos; else scan.position.z = pos;
        mods.forEach(m => { m.luz.material = dt >= 0 && pos > m.eixo - .1 && (qs > 0 || REDUZ) ? matLuzOk : matLuzOff; });
        marcaQa(2, dt >= 2.4 ? 'ok' : dt >= 0 ? 'rodando' : '');
        marcaQa(3, dt >= 3.6 ? 'ok' : dt >= 2.4 ? 'rodando' : '');
        marcaQa(4, dt >= 5.6 ? 'ok' : dt >= 3.6 ? 'rodando' : '');
        const qo = dt >= 5.6 && !REDUZ ? ((t - inicioQa - 5.6) % 2.6) / 2.6 : 0;
        onda.material.opacity = dt >= 5.6 && !REDUZ ? (1 - qo) * .8 : 0;
        onda.scale.setScalar(1 + qo * 1.6);
        if (rotulo) rotulo.lastChild.textContent = dt >= 5.6 ? 'primeira versão aprovada' : dt >= 0 ? 'verificando' : 'primeira versão em construção';
      }
    };
  }

  const pl = plantas(raiz, montar);
  return {
    enquadra(a){
      if (RETRATO(a)){
        pl.garante('retrato');
        const k = Math.max(1, .74 / a);
        /* de frente (e só um tico de lado): a bancada fica EM PÉ no palco; na
           diagonal ela deitava e cortava os módulos das laterais */
        camera.position.set(.55 * k, 14.6 * k, 7.3 * k);
        camera.lookAt(-.3, -.3, -.45);
      } else {
        pl.garante('paisagem');
        camera.position.set(6.3, 8.55, 9.3);
        /* centrada: a lista de verificações saiu de cima da cena (14/09) */
        camera.lookAt(.1, -.5, .15);
      }
    },
    atualiza: pl.atualiza
  };
}

async function inicia(){
  const alvos = [['cenaIdeia', cenaIdeia], ['cenaSistema', cenaSistema]]
    .map(([id, fn]) => [document.getElementById(id), fn]).filter(([el]) => el);
  if (!alvos.length) return;
  /* as etiquetas são desenhadas UMA vez em canvas: sem esperar as fontes da
     marca, elas nascem em system-ui e ficam assim */
  try {
    await Promise.race([
      Promise.all([document.fonts.load("700 40px 'Sora'"), document.fonts.load("600 20px 'JetBrains Mono'")]),
      new Promise(r => setTimeout(r, 2500))
    ]);
  } catch (e) {}
  alvos.forEach(([el, fn]) => {
    try { palco(el, fn); }
    catch (e) { el.classList.add('sem-3d'); console.warn('[historia] cena 3D indisponível', e); }
  });
}
inicia();
