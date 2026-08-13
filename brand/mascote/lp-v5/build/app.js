/* nó — viewer do mascote v5: 7 cenas fotográficas 2.5D + máquina de estados de animação */
(function () {
  'use strict';
  var BRAND = { amber: '#EDA33B', blue: '#3D63DB', green: '#30A46C', red: '#E0543C' };

  // ---------- three.js core ----------
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.05, 80);
  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.setClearColor(0x000000, 0);
  document.getElementById('layer-canvas').appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xfff2e0, 0xcaa77f, 0.95));
  var key = new THREE.DirectionalLight(0xfff0dd, 1.0);
  key.position.set(2.2, 4.2, 3.2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -2; key.shadow.camera.right = 2;
  key.shadow.camera.top = 2.5; key.shadow.camera.bottom = -0.5;
  scene.add(key);
  var rim = new THREE.DirectionalLight(0xbfd0ff, 0.22);
  rim.position.set(-3, 3, -2.5);
  scene.add(rim);

  function decode(id) {
    var b64 = document.getElementById(id).textContent.trim();
    var bin = atob(b64);
    var buf = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return buf.buffer;
  }
  function fail(msg) {
    var el = document.getElementById('loading');
    el.style.display = 'flex';
    el.textContent = 'erro: ' + msg;
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function findClip(clips, name) {
    for (var i = 0; i < clips.length; i++) if (clips[i].name === name) return clips[i];
    return null;
  }

  // ---------- config das 7 cenas (constantes calibráveis) ----------
  // valores iniciais estimados a partir das fotos (1672x941, mobília ~centralizada);
  // refinar via screenshot Playwright.
  var SCENES = {
    1: { // mesa de papéis/luminária — sentado
      id: 1, hasPhoto: true, bg: 'bg-cena1', occ: 'occ-cena1',
      cam: { pos: [0, 0.94, 4.05], lookAt: [0, 0.94, 0], fov: 35 },
      charX: 0, charZ: 0, charRotY: 0, charScale: 1,
      sequence: [
        { clip: 'cena1-idle', repetitions: 2 },
        { clip: 'cena1-angry', repetitions: 1 },
        { clip: 'cena1-typing', repetitions: 3 }
      ]
    },
    2: { // bancada de laboratório — em pé
      id: 2, hasPhoto: true, bg: 'bg-cena2', occ: 'occ-cena2',
      cam: { pos: [0, 0.82, 4.12], lookAt: [0, 0.82, 0], fov: 35 },
      charX: 0, charZ: 0, charRotY: 0, charScale: 1,
      sequence: [
        { clip: 'cena2-idle', repetitions: 2 },
        { clip: 'cena2-nod', repetitions: 1 }
      ]
    },
    3: { // banco — entra andando, senta, jornal, celular
      id: 3, hasPhoto: true, bg: 'bg-cena3', occ: 'occ-cena3',
      cam: { pos: [0, 0.94, 4.05], lookAt: [0, 0.94, 0], fov: 35 },
      charX: 0, charZ: 0, charRotY: 0, charScale: 1,
      entrance: true, entranceStartX: -1.7, entranceDuration: 1.6,
      sequence: [
        { clip: 'cena3-idle-newspaper', repetitions: 2, onStart: function () { showProp('newspaper'); } },
        { clip: 'cena3-discard', repetitions: 1, onFinish: function () { hideProps(); } },
        { clip: 'cena3-idle-newspaper', repetitions: 2, onStart: function () { showProp('phone'); } }
      ]
    },
    4: { // balcão de loja — em pé, digitando
      id: 4, hasPhoto: true, bg: 'bg-cena4', occ: 'occ-cena4',
      cam: { pos: [0, 0.82, 4.12], lookAt: [0, 0.82, 0], fov: 35 },
      charX: 0, charZ: 0, charRotY: 0, charScale: 1,
      sequence: [
        { clip: 'cena4-typing', repetitions: 3 },
        { clip: 'cena2-idle', repetitions: 2 }
      ]
    },
    5: { // home office — sentado, conversando, olhos verdes
      id: 5, hasPhoto: true, bg: 'bg-cena5', occ: 'occ-cena5',
      cam: { pos: [0, 0.94, 4.05], lookAt: [0, 0.94, 0], fov: 35 },
      charX: 0, charZ: 0, charRotY: 0, charScale: 1,
      forceEyeColor: 'green',
      sequence: [
        { clip: 'stand-to-sit', repetitions: 1 },
        { clip: 'cena5-talking-loop', repetitions: Infinity }
      ]
    },
    6: { // mesa de estudos — sentado, tronco inclinado
      id: 6, hasPhoto: true, bg: 'bg-cena6', occ: 'occ-cena6',
      cam: { pos: [0, 0.94, 4.05], lookAt: [0, 0.94, 0], fov: 35 },
      charX: 0, charZ: 0, charRotY: 0, charScale: 1,
      sequence: [
        { clip: 'cena6-idle', repetitions: Infinity }
      ]
    },
    7: { // despedida — gradiente âmbar de fallback
      id: 7, hasPhoto: false,
      cam: { pos: [0, 0.82, 4.12], lookAt: [0, 0.82, 0], fov: 35 },
      charX: 0, charZ: 0, charRotY: 0, charScale: 1,
      sequence: [
        { clip: 'model-idle', repetitions: 2 },
        { clip: 'cena7-wave', repetitions: 1 }
      ]
    }
  };

  // ---------- estado runtime ----------
  var mixer, clock = new THREE.Clock(), playing = true, speed = 1;
  var root = null, hips = null, mesh = null, H = 1.9, groundY = 0;
  var leftHand = null, rightHand = null, handScaleFactor = 100;
  var actions = {};
  var currentSceneId = 1, currentAction = null;
  var pendingFinishAction = null, pendingFinishCallback = null;
  var newspaperProp = null, phoneProp = null;
  var scene3Runtime = { entering: false, elapsed: 0 };
  var runtimeCharX = 0;
  var bgURIs = {}, occURIs = {};
  var loader = new THREE.GLTFLoader();

  // correção empírica: clipes retargetados EM PÉ (perna esticada) de algumas sessões
  // de download do Mixamo têm proporções de esqueleto levemente diferentes das do
  // modelo-base, e o erro de retarget se amplifica na perna esticada (~0.29m visível);
  // em poses sentadas o mesmo erro é imperceptível. Corrigido empiricamente aqui.
  var STAND_RETARGET_FIX = {
    'cena2-idle': -0.29, 'cena2-nod': -0.29,
    'walk-inplace': -0.29, 'stand-to-sit': -0.29,
    'cena4-typing': -0.29, 'cena7-wave': -0.29
  };

  var bgEl = document.getElementById('layer-bg');
  var fgEl = document.getElementById('layer-fg');
  var gradEl = document.getElementById('layer-gradient');

  loader.parse(decode('glb-model'), '', function (gModel) {
    loader.parse(decode('glb-clips'), '', function (gClips) {
      try { setup(gModel, gClips); } catch (e) { fail(e.message || e); }
    }, function (e) { fail('clipes: ' + (e.message || e)); });
  }, function (e) { fail('modelo: ' + (e.message || e)); });

  function setup(gModel, gClips) {
    root = gModel.scene;
    scene.add(root);
    root.traverse(function (n) {
      if (n.isMesh) { mesh = n; n.castShadow = true; n.frustumCulled = false; }
      var nm = (n.name || '').toLowerCase();
      if (nm.indexOf('hips') >= 0 && !hips) hips = n;
      if (nm.slice(-8) === 'lefthand') leftHand = n;
      if (nm.slice(-9) === 'righthand') rightHand = n;
    });
    root.updateMatrixWorld(true);

    var box = new THREE.Box3(), v = new THREE.Vector3();
    root.traverse(function (n) { n.getWorldPosition(v); box.expandByPoint(v); });
    H = Math.max(box.max.y - box.min.y, 1.2);

    if (rightHand) handScaleFactor = rightHand.getWorldScale(new THREE.Vector3()).x || 100;

    mixer = new THREE.AnimationMixer(root);
    actions['model-idle'] = mixer.clipAction(gModel.animations[0]);
    gClips.animations.forEach(function (clip) {
      actions[clip.name] = mixer.clipAction(clip);
    });
    var talkFull = findClip(gClips.animations, 'cena5-talking');
    if (talkFull) {
      var talkLoop = THREE.AnimationUtils.subclip(talkFull, 'cena5-talking-loop', 300, 900, 30);
      actions['cena5-talking-loop'] = mixer.clipAction(talkLoop);
    }
    mixer.addEventListener('finished', function (e) {
      if (e.action !== pendingFinishAction) return;
      var cb = pendingFinishCallback;
      pendingFinishAction = null; pendingFinishCallback = null;
      if (cb) cb();
    });

    // chão: menor Y dos pés em TODAS as animações (24 amostras por clipe)
    var feet = [];
    root.traverse(function (n) {
      var nm = (n.name || '').toLowerCase();
      if (nm.indexOf('foot') >= 0 || nm.indexOf('toe') >= 0) feet.push(n);
    });
    groundY = Infinity;
    var fw = new THREE.Vector3();
    Object.keys(actions).forEach(function (k) {
      Object.keys(actions).forEach(function (j) { actions[j].stop(); });
      actions[k].play();
      var dur = actions[k].getClip().duration;
      for (var s = 0; s <= 24; s++) {
        mixer.setTime(dur * s / 24);
        root.updateMatrixWorld(true);
        feet.forEach(function (f) { f.getWorldPosition(fw); if (fw.y < groundY) groundY = fw.y; });
      }
    });
    groundY -= 0.01 * H;
    Object.keys(actions).forEach(function (j) { actions[j].stop(); });
    mixer.setTime(0);

    buildProps();
    buildShadow();
    setupEyeRecolor();
    prepareBackgrounds();

    document.getElementById('loading').style.display = 'none';
    doSwap(1);
  }

  function buildShadow() {
    var sh = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0.22 }));
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = groundY;
    sh.receiveShadow = true;
    scene.add(sh);
  }

  // ---------- props (÷ escala 100 do rig Mixamo) ----------
  function buildProps() {
    if (!rightHand) return;
    var f = handScaleFactor;
    var paperMat = new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.95 });
    var phoneMat = new THREE.MeshStandardMaterial({ color: 0x202124, roughness: 0.35, metalness: 0.2 });

    newspaperProp = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.004, 0.28), paperMat);
    newspaperProp.scale.setScalar(1 / f);
    newspaperProp.position.set(0.05 / f, 0.02 / f, 0.02 / f);
    newspaperProp.rotation.set(-0.3, 0.15, 0);
    newspaperProp.visible = false;
    newspaperProp.castShadow = true;
    rightHand.add(newspaperProp);

    phoneProp = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.008, 0.145), phoneMat);
    phoneProp.scale.setScalar(1 / f);
    phoneProp.position.set(0.04 / f, 0.02 / f, 0.02 / f);
    phoneProp.rotation.set(-0.5, 0, 0);
    phoneProp.visible = false;
    phoneProp.castShadow = true;
    rightHand.add(phoneProp);
  }
  function showProp(which) {
    hideProps();
    if (which === 'newspaper' && newspaperProp) newspaperProp.visible = true;
    if (which === 'phone' && phoneProp) phoneProp.visible = true;
  }
  function hideProps() {
    if (newspaperProp) newspaperProp.visible = false;
    if (phoneProp) phoneProp.visible = false;
  }

  // ---------- fundos (base64 -> data URI) ----------
  function prepareBackgrounds() {
    for (var i = 1; i <= 6; i++) {
      var bgId = 'bg-cena' + i, occId = 'occ-cena' + i;
      var bgNode = document.getElementById(bgId);
      var occNode = document.getElementById(occId);
      if (bgNode) bgURIs[bgId] = 'data:image/webp;base64,' + bgNode.textContent.trim();
      if (occNode) occURIs[occId] = 'data:image/webp;base64,' + occNode.textContent.trim();
    }
  }

  // ===== recoloração dos olhos (HSL, preserva luminância) — reaproveitado do v4 =====
  var eyeCtx = null, eyeOrig = null, eyeIdx = null, eyeTex = null, TS = 1024;
  function setupEyeRecolor() {
    if (!mesh || !mesh.material || !mesh.material.map || !mesh.material.map.image) return;
    var srcMap = mesh.material.map;
    var cnv = document.createElement('canvas');
    cnv.width = TS; cnv.height = TS;
    eyeCtx = cnv.getContext('2d', { willReadFrequently: true });
    eyeCtx.drawImage(srcMap.image, 0, 0, TS, TS);
    eyeOrig = eyeCtx.getImageData(0, 0, TS, TS);

    eyeTex = new THREE.CanvasTexture(cnv);
    eyeTex.flipY = srcMap.flipY;
    eyeTex.encoding = srcMap.encoding;
    eyeTex.wrapS = srcMap.wrapS; eyeTex.wrapT = srcMap.wrapT;
    mesh.material.map = eyeTex;
    mesh.material.needsUpdate = true;

    var mimg = new Image();
    mimg.onload = function () {
      var mc = document.createElement('canvas');
      mc.width = TS; mc.height = TS;
      var mctx = mc.getContext('2d');
      mctx.drawImage(mimg, 0, 0, TS, TS);
      var md = mctx.getImageData(0, 0, TS, TS).data;
      eyeIdx = [];
      for (var i = 0; i < md.length; i += 4) if (md[i] > 127) eyeIdx.push(i);
    };
    mimg.src = 'data:image/png;base64,' + document.getElementById('eye-mask').textContent.trim();
  }
  function hue2rgb(p, q, t) {
    t = ((t % 1) + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }
  var eyeColorSource = 'auto';
  function setEyes(name) {
    document.querySelectorAll('.dot').forEach(function (x) { x.classList.toggle('on', x.dataset.c === name); });
    if (!eyeCtx || !eyeOrig) return;
    if (name === 'amber' || !eyeIdx) {
      eyeCtx.putImageData(eyeOrig, 0, 0);
      if (eyeTex) eyeTex.needsUpdate = true;
      return;
    }
    var hex = BRAND[name];
    var tr = parseInt(hex.slice(1, 3), 16) / 255, tg = parseInt(hex.slice(3, 5), 16) / 255, tb = parseInt(hex.slice(5, 7), 16) / 255;
    var mx = Math.max(tr, tg, tb), mn = Math.min(tr, tg, tb), d = mx - mn, th = 0;
    if (d > 0) {
      if (mx === tr) th = ((tg - tb) / d) % 6;
      else if (mx === tg) th = (tb - tr) / d + 2;
      else th = (tr - tg) / d + 4;
      th /= 6; if (th < 0) th += 1;
    }
    var ts = 0.8;
    var out = new ImageData(new Uint8ClampedArray(eyeOrig.data), TS, TS);
    var dd = out.data, o = eyeOrig.data;
    for (var k = 0; k < eyeIdx.length; k++) {
      var i = eyeIdx[k];
      var r = o[i] / 255, g = o[i + 1] / 255, b = o[i + 2] / 255;
      var Lm = (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
      var q = Lm < 0.5 ? Lm * (1 + ts) : Lm + ts - Lm * ts;
      var p = 2 * Lm - q;
      dd[i] = Math.round(hue2rgb(p, q, th + 1 / 3) * 255);
      dd[i + 1] = Math.round(hue2rgb(p, q, th) * 255);
      dd[i + 2] = Math.round(hue2rgb(p, q, th - 1 / 3) * 255);
    }
    eyeCtx.putImageData(out, 0, 0);
    eyeTex.needsUpdate = true;
  }

  // ===== sequenciador de animação por cena =====
  function playStep(scn, idx) {
    var step = scn.sequence[idx];
    if (!step) return;
    var next = actions[step.clip];
    if (!next) { console.warn('clipe ausente:', step.clip); return; }
    var reps = step.repetitions === undefined ? 1 : step.repetitions;
    next.reset();
    next.setLoop(THREE.LoopRepeat, reps);
    next.clampWhenFinished = true;
    next.enabled = true;
    next.play();
    if (currentAction && currentAction !== next) currentAction.crossFadeTo(next, 0.3, false);
    currentAction = next;
    if (step.onStart) step.onStart();
    if (isFinite(reps)) {
      pendingFinishAction = next;
      pendingFinishCallback = function () {
        if (step.onFinish) step.onFinish();
        playStep(scn, (idx + 1) % scn.sequence.length);
      };
    } else {
      pendingFinishAction = null;
      pendingFinishCallback = null;
    }
  }

  function startScene3Entrance() {
    scene3Runtime.entering = true;
    scene3Runtime.elapsed = 0;
    var walk = actions['walk-inplace'];
    walk.reset();
    walk.setLoop(THREE.LoopRepeat, Infinity);
    walk.play();
    if (currentAction && currentAction !== walk) currentAction.crossFadeTo(walk, 0.25, false);
    currentAction = walk;
    pendingFinishAction = null; pendingFinishCallback = null;
  }

  // ===== transição de cena com fade dirigido por dt =====
  var trans = null, FADE = 0.35;
  var fadeEl = document.getElementById('fade');

  function requestScene(id) {
    if (!mixer || trans) return;
    if (id === currentSceneId) return;
    trans = { to: id, phase: 0, t: 0 };
  }

  function doSwap(id) {
    var scn = SCENES[id];
    currentSceneId = id;
    hideProps();
    pendingFinishAction = null; pendingFinishCallback = null;
    scene3Runtime.entering = false;

    if (scn.hasPhoto) {
      bgEl.style.backgroundImage = "url('" + bgURIs[scn.bg] + "')";
      bgEl.style.display = 'block';
      fgEl.style.backgroundImage = "url('" + occURIs[scn.occ] + "')";
      fgEl.style.display = 'block';
      gradEl.style.display = 'none';
    } else {
      bgEl.style.display = 'none';
      fgEl.style.display = 'none';
      gradEl.style.display = 'block';
    }

    camera.position.set(scn.cam.pos[0], scn.cam.pos[1], scn.cam.pos[2]);
    camera.lookAt(scn.cam.lookAt[0], scn.cam.lookAt[1], scn.cam.lookAt[2]);
    camera.fov = scn.cam.fov;
    camera.updateProjectionMatrix();

    if (scn.forceEyeColor) { setEyes(scn.forceEyeColor); eyeColorSource = 'auto'; }
    else if (eyeColorSource === 'auto') { setEyes('amber'); }

    if (scn.entrance) {
      startScene3Entrance();
    } else {
      playStep(scn, 0);
    }

    document.querySelectorAll('.scene-btn').forEach(function (b) {
      b.classList.toggle('on', parseInt(b.dataset.s, 10) === id);
    });
    document.getElementById('hud-sub').textContent = 'cena ' + id + '/7';
  }

  // ---------- UI ----------
  document.querySelectorAll('.scene-btn').forEach(function (b) {
    b.addEventListener('click', function () { requestScene(parseInt(b.dataset.s, 10)); });
  });
  document.getElementById('prev').addEventListener('click', function () {
    var id = currentSceneId - 1; if (id < 1) id = 7;
    requestScene(id);
  });
  document.getElementById('next').addEventListener('click', function () {
    var id = currentSceneId + 1; if (id > 7) id = 1;
    requestScene(id);
  });
  document.querySelectorAll('.dot').forEach(function (dEl) {
    dEl.addEventListener('click', function () { eyeColorSource = 'manual'; setEyes(dEl.dataset.c); });
  });
  document.getElementById('play').addEventListener('click', function () {
    playing = !playing;
    this.textContent = playing ? 'pausar' : 'play';
  });
  document.getElementById('spd').addEventListener('input', function () {
    speed = parseFloat(this.value);
    document.getElementById('spdv').textContent = speed.toFixed(1) + 'x';
  });
  addEventListener('resize', function () {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  var mouseNX = 0, mouseNY = 0, parX = 0, parY = 0;
  addEventListener('mousemove', function (e) {
    mouseNX = e.clientX / innerWidth - 0.5;
    mouseNY = e.clientY / innerHeight - 0.5;
  });

  // ---------- loop principal ----------
  var w = new THREE.Vector3();
  (function loop() {
    requestAnimationFrame(loop);
    var dt = clock.getDelta();
    if (dt > 0.1) dt = 0.1;
    if (mixer && playing) mixer.update(dt * speed);

    // fade da transição (máquina de estados dirigida por dt, não setTimeout)
    if (trans) {
      trans.t += dt;
      var e = Math.min(trans.t / FADE, 1);
      if (trans.phase === 0) {
        fadeEl.style.opacity = e;
        if (e >= 1) { doSwap(trans.to); trans.phase = 1; trans.t = 0; }
      } else {
        fadeEl.style.opacity = 1 - e;
        if (e >= 1) { fadeEl.style.opacity = 0; trans = null; }
      }
    }

    // entrada andando da cena 3 (root motion via código, não pela clip in-place)
    if (currentSceneId === 3 && scene3Runtime.entering && playing) {
      scene3Runtime.elapsed += dt * speed;
      var t3 = Math.min(scene3Runtime.elapsed / SCENES[3].entranceDuration, 1);
      runtimeCharX = lerp(SCENES[3].entranceStartX, SCENES[3].charX, t3);
      if (t3 >= 1) {
        scene3Runtime.entering = false;
        var sit = actions['stand-to-sit'];
        sit.reset(); sit.setLoop(THREE.LoopRepeat, 1); sit.clampWhenFinished = true; sit.play();
        if (currentAction) currentAction.crossFadeTo(sit, 0.3, false);
        currentAction = sit;
        pendingFinishAction = sit;
        pendingFinishCallback = function () { playStep(SCENES[3], 0); };
      }
    } else if (currentSceneId === 3 && scene3Runtime.entering) {
      // pausado: mantém X atual sem avançar o tempo
    } else {
      runtimeCharX = SCENES[currentSceneId].charX;
    }

    // recentragem pelo quadril (cancela drift/root-motion residual das clips)
    if (root && hips) {
      var scn = SCENES[currentSceneId];
      var yFix = (currentAction && STAND_RETARGET_FIX[currentAction.getClip().name]) || 0;
      root.rotation.y = scn.charRotY || 0;
      root.scale.setScalar(scn.charScale || 1);
      root.position.set(0, 0, 0);
      root.updateMatrixWorld(true);
      hips.getWorldPosition(w);
      root.position.x += (runtimeCharX - w.x);
      root.position.y += yFix;
      root.position.z += (scn.charZ - w.z);
    }

    // parallax sutil no mousemove (canvas fica parado)
    parX += (mouseNX - parX) * 0.06;
    parY += (mouseNY - parY) * 0.06;
    var bgT = 'translate3d(' + (-parX * 14).toFixed(2) + 'px,' + (-parY * 10).toFixed(2) + 'px,0) scale(1.04)';
    bgEl.style.transform = bgT;
    gradEl.style.transform = bgT;
    fgEl.style.transform = 'translate3d(' + (-parX * 30).toFixed(2) + 'px,' + (-parY * 20).toFixed(2) + 'px,0) scale(1.05)';

    renderer.render(scene, camera);
  })();

  // hook de depuração/calibração (usado pelo script de validação Playwright)
  window.__debug = {
    getH: function () { return H; },
    getGroundY: function () { return groundY; },
    getSceneId: function () { return currentSceneId; },
    gotoScene: function (id) { doSwap(id); },
    setCam: function (id, pos, lookAt, fov) {
      SCENES[id].cam.pos = pos; SCENES[id].cam.lookAt = lookAt;
      if (fov) SCENES[id].cam.fov = fov;
      if (id === currentSceneId) {
        camera.position.set(pos[0], pos[1], pos[2]);
        camera.lookAt(lookAt[0], lookAt[1], lookAt[2]);
        if (fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
      }
    },
    setChar: function (id, charX, charZ, charRotY, charScale) {
      var s = SCENES[id];
      if (charX !== undefined) s.charX = charX;
      if (charZ !== undefined) s.charZ = charZ;
      if (charRotY !== undefined) s.charRotY = charRotY;
      if (charScale !== undefined) s.charScale = charScale;
    },
    projectWorld: function (x, y, z) {
      var v = new THREE.Vector3(x, y, z);
      v.project(camera);
      return { x: v.x, y: v.y };
    },
    getHipsWorld: function () {
      if (!hips) return null;
      var v = new THREE.Vector3();
      hips.getWorldPosition(v);
      return { x: v.x, y: v.y, z: v.z };
    },
    getHeadTopWorld: function () {
      var node = null;
      root.traverse(function (n) {
        var nm = (n.name || '').toLowerCase();
        if (nm.indexOf('headtop') >= 0) node = n;
        else if (!node && nm.slice(-4) === 'head') node = n;
      });
      if (!node) return null;
      var v = new THREE.Vector3();
      node.getWorldPosition(v);
      return { x: v.x, y: v.y, z: v.z };
    },
    getBoneWorldY: function (substr) {
      var out = [];
      root.traverse(function (n) {
        var nm = (n.name || '').toLowerCase();
        if (nm.indexOf(substr.toLowerCase()) >= 0) {
          var v = new THREE.Vector3();
          n.getWorldPosition(v);
          out.push({ name: n.name, y: v.y });
        }
      });
      return out;
    },
    getScenes: function () { return SCENES; },
    getActions: function () { return actions; },
    getHandScaleFactor: function () { return handScaleFactor; }
  };
})();
