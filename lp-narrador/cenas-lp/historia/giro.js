/* ══════════════════════════════════════════════════════════════════════
   v7 · GIRO DE GLOBO pelo dedo — usado pelas cenas 3D da história
   (cenas3d.js).
   Toque ou caneta. O gesto só vira giro se COMEÇAR pro lado (6px, mais
   horizontal que vertical): começando na vertical, a página rola como
   sempre (a superfície tem touch-action:pan-y). Depois de pegar, vale
   qualquer direção — pro lado em torno do eixo vertical do mundo, pra cima e
   pra baixo em torno do eixo "direita" da câmera — e o touchmove passa a ser
   cancelado pra rolagem não entrar no meio. Uma largura inteira de
   superfície = uma volta. Soltou: inércia; 3,5s parado, volta devagar pra
   posição de leitura. No desktop o mouse não gira (cada cena cuida do seu
   parallax).
   `travado` ignora gestos e leva a cena de volta
   pra frente em poucos quadros.
   ══════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

const EIXO_Y = new THREE.Vector3(0, 1, 0), Q_ID = new THREE.Quaternion();

export function criaGiro({ superficie, figura, camera, reduz, aoMover, avisoEm }){
  const q = new THREE.Quaternion(), qTmp = new THREE.Quaternion(), eixoLado = new THREE.Vector3();
  let velX = 0, velY = 0, arrasto = null, soltouEm = 0, travado = false;

  function gira(ax, ay){
    qTmp.setFromAxisAngle(EIXO_Y, ax); q.premultiply(qTmp);
    eixoLado.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    qTmp.setFromAxisAngle(eixoLado, ay); q.premultiply(qTmp);
  }

  superficie.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' || travado) return;
    arrasto = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, decidido: false };
    velX = velY = 0;
  });
  superficie.addEventListener('pointermove', e => {
    if (!arrasto || e.pointerId !== arrasto.id) return;
    if (travado){ arrasto = null; return; }
    if (!arrasto.decidido){
      const dx0 = e.clientX - arrasto.x0, dy0 = e.clientY - arrasto.y0;
      if (Math.abs(dx0) < 6 && Math.abs(dy0) < 6) return;
      if (Math.abs(dy0) >= Math.abs(dx0)){ arrasto = null; return; }
      arrasto.decidido = true;
      try { superficie.setPointerCapture(e.pointerId); } catch (err) {}
      if (figura) figura.classList.add('girou');
    }
    const k = Math.PI * 2 / Math.max(1, superficie.clientWidth);
    const ax = (e.clientX - arrasto.x) * k, ay = (e.clientY - arrasto.y) * k;
    arrasto.x = e.clientX; arrasto.y = e.clientY;
    gira(ax, ay);
    velX = ax; velY = ay;
    if (aoMover) aoMover();
  });
  superficie.addEventListener('touchmove', e => {
    if (arrasto && arrasto.decidido && e.cancelable) e.preventDefault();
  }, { passive: false });
  const solta = e => {
    if (!arrasto || (e && e.pointerId !== arrasto.id)) return;
    if (!arrasto.decidido || reduz){ velX = velY = 0; }
    arrasto = null;
    soltouEm = performance.now();
  };
  superficie.addEventListener('pointerup', solta);
  superficie.addEventListener('pointercancel', solta);

  /* o aviso só existe em tela de toque, e some no primeiro giro */
  if (avisoEm && matchMedia('(hover: none)').matches){
    const aviso = document.createElement('div');
    aviso.className = 'hs-girar'; aviso.setAttribute('aria-hidden', 'true');
    aviso.textContent = 'arraste pro lado e gire a cena';
    avisoEm.appendChild(aviso);
  }

  return {
    q,
    /* chamado a cada quadro pelo laço da cena */
    passo(agora){
      if (travado){
        velX = velY = 0;
        if (q.angleTo(Q_ID) > .001) q.slerp(Q_ID, .14); else q.identity();
        return;
      }
      if (arrasto) return;
      if (Math.abs(velX) + Math.abs(velY) > .0004){ gira(velX, velY); velX *= .93; velY *= .93; soltouEm = agora; }
      else if (agora - soltouEm > 3500 && q.angleTo(Q_ID) > .001) q.slerp(Q_ID, .045);
    },
    get travado(){ return travado; },
    set travado(v){ travado = !!v; if (travado) arrasto = null; },
    get parado(){ return !arrasto && Math.abs(velX) + Math.abs(velY) <= .0004 && q.angleTo(Q_ID) <= .001; }
  };
}
