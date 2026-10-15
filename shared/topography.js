/* NoTopography — fundo de curvas de nível (porte em JS puro / WebGL2 do Topography do React Bits).
 * Versão própria simplificada: malha em grade com altura por ruído gradiente (fbm + domain warp leve),
 * câmera inclinada deslizando para frente, curvas de nível desenhadas no fragment shader
 * (fract da altura, antialias por fwidth, linha maior a cada 5), névoa pela profundidade e morph lento.
 * Sem bloom, depth of field, glitch, sculpt ou markers.
 *
 * Uso:  var topo = window.NoTopography.mount(elemento, { color:'#3D63DB', ... });  topo.destroy();
 * Respeita prefers-reduced-motion (um quadro parado), pausa com document.hidden e fora da tela,
 * e não faz nada (sem erro) se WebGL2 não existir. O mouse é lido no window: o canvas não bloqueia cliques.
 */
(function () {
  'use strict';

  var DEFAULTS = {
    color: '#3D63DB',
    lineCount: 22,
    lineWidth: 1.2,
    majorLines: true,
    elevation: 1,
    scale: 1,
    tilt: 32,
    speed: 0.25,
    morph: 0.2,
    fog: 0.35,
    opacity: 1,
    lightMode: true,
    mouseInteraction: true,
    dpr: undefined
  };

  var MOBILE_MAX_WIDTH = 700;

  /* ---------- GLSL ---------- */

  // Ruído e relevo compartilhados pelo vertex e pelo fragment shader (a altura é recalculada por
  // pixel para as curvas ficarem lisas, e não facetadas pela interpolação da malha).
  var COMMON = [
    'uniform float uTime;',
    'uniform float uMorph;',
    'uniform vec3 uMouse;', // x,z no mundo + força
    'vec2 hash22(vec2 p){',
    '  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));',
    '  p3 += dot(p3, p3.yzx + 33.33);',
    '  return fract((p3.xx + p3.yz) * p3.zy) * 2.0 - 1.0;',
    '}',
    'float gnoise(vec2 p){',
    '  vec2 i = floor(p);',
    '  vec2 f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  float a = dot(hash22(i), f);',
    '  float b = dot(hash22(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));',
    '  float c = dot(hash22(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));',
    '  float d = dot(hash22(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));',
    '  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);',
    '}',
    'float fbm(vec2 p){',
    '  float s = 0.0;',
    '  float a = 0.55;',
    '  for (int i = 0; i < OCTAVES; i++) {',
    '    s += a * gnoise(p);',
    '    p = p * 2.03 + vec2(1.7, 9.2);',
    '    a *= 0.5;',
    '  }',
    '  return s;',
    '}',
    // t = coordenada do terreno (já com scroll e escala); w = coordenada do mundo (para o mouse)
    'float surface(vec2 t, vec2 w){',
    '  float tm = uTime * uMorph;',
    '  vec2 p = t;',
    '  vec2 warp = vec2(gnoise(p * 0.5 + vec2(tm * 0.35, 0.0)), gnoise(p * 0.5 + vec2(3.7, -tm * 0.35)));',
    '  p += warp * 0.55;',
    '  float h = fbm(p) * 0.5 + 0.5;',
    '  vec2 d = w - uMouse.xy;',
    '  h += uMouse.z * 0.3 * exp(-dot(d, d) / 12.0);',
    '  return h;',
    '}'
  ].join('\n');

  var VERT = [
    '#version 300 es',
    'precision highp float;',
    'in vec2 aPos;',
    'uniform mat4 uViewProj;',
    'uniform float uScroll;',
    'uniform float uFreq;',
    'uniform float uElev;',
    'out vec2 vTerrain;',
    'out vec2 vWorld;',
    'out float vDepth;',
    COMMON,
    'void main(){',
    '  float zt = pow(aPos.y, 1.6);', // malha mais densa perto da câmera
    '  vec2 world = vec2((aPos.x - 0.5) * 56.0, 2.5 - zt * 44.0);',
    '  vec2 terrain = (world - vec2(0.0, uScroll)) * uFreq;',
    '  float h = surface(terrain, world);',
    '  vec4 clip = uViewProj * vec4(world.x, (h - 0.5) * 2.4 * uElev, world.y, 1.0);',
    '  gl_Position = clip;',
    '  vDepth = clip.w;',
    '  vTerrain = terrain;',
    '  vWorld = world;',
    '}'
  ].join('\n');

  var FRAG = [
    '#version 300 es',
    'precision highp float;',
    'in vec2 vTerrain;',
    'in vec2 vWorld;',
    'in float vDepth;',
    'uniform float uLines;',
    'uniform float uLineWidth;',
    'uniform float uMajor;',
    'uniform float uOpacity;',
    'uniform float uLightMode;',
    'uniform float uFog;',
    'uniform vec3 uColor;',
    'out vec4 outColor;',
    COMMON,
    'void main(){',
    '  float h = surface(vTerrain, vWorld);',
    '  float lc = h * uLines + 0.5;',
    '  float g = max(fwidth(lc), 1e-5);', // variação da altura por pixel
    '  float dist = abs(fract(lc + 0.5) - 0.5) / g;', // distância em pixels até a curva mais próxima
    '  float major = uMajor * (1.0 - step(0.5, mod(floor(lc + 0.5), 5.0)));',
    '  float persp = clamp(sqrt(8.0 / max(vDepth, 0.01)), 0.6, 1.6);',
    '  float width = uLineWidth * persp * (1.0 + 0.6 * major);',
    '  float cover = 1.0 - smoothstep(width * 0.5 - 0.6, width * 0.5 + 0.6, dist);',
    '  float crowd = smoothstep(0.3, 0.75, g * width);', // linhas amontoadas ao longe viram cinza médio
    '  cover = mix(cover, min(width * g, 1.0) * 0.6, crowd);',
    '  float level = mix(0.5, 1.0, smoothstep(0.1, 0.9, h)) * (1.0 + 0.6 * major);',
    '  float fade = exp(-pow(max(vDepth - 4.0, 0.0) * uFog, 1.5)) * (1.0 - smoothstep(34.0, 40.0, -vWorld.y));',
    '  float light = cover * level * fade;',
    '  if (uLightMode > 0.5) {',
    '    float ink = (1.0 - exp(-light * 1.8)) * 0.92 * uOpacity;', // tinta sólida, alfa premultiplicado
    '    outColor = vec4(uColor * ink, ink);',
    '    return;',
    '  }',
    '  vec3 c = 1.0 - exp(-uColor * light * 1.8);',
    '  outColor = vec4(c, max(max(c.r, c.g), c.b)) * uOpacity;',
    '}'
  ].join('\n');

  /* ---------- utilitários ---------- */

  function hexToRgb(hex) {
    var s = String(hex || '').trim().replace('#', '');
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    var n = parseInt(s, 16);
    if (isNaN(n) || s.length !== 6) return [0.239, 0.388, 0.859]; // #3D63DB
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function perspective(fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2);
    var nf = 1 / (near - far);
    var m = new Float32Array(16);
    m[0] = f / aspect; m[5] = f; m[10] = (far + near) * nf; m[11] = -1; m[14] = 2 * far * near * nf;
    return m;
  }

  // Matriz de vista para câmera em `eye` olhando ao longo de `fwd` com `up` (column-major).
  function view(eye, fwd, up) {
    var fx = fwd[0], fy = fwd[1], fz = fwd[2];
    var rx = fy * up[2] - fz * up[1], ry = fz * up[0] - fx * up[2], rz = fx * up[1] - fy * up[0];
    var rl = Math.hypot(rx, ry, rz) || 1; rx /= rl; ry /= rl; rz /= rl;
    var ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
    var m = new Float32Array(16);
    m[0] = rx; m[4] = ry; m[8] = rz;
    m[1] = ux; m[5] = uy; m[9] = uz;
    m[2] = -fx; m[6] = -fy; m[10] = -fz;
    m[12] = -(rx * eye[0] + ry * eye[1] + rz * eye[2]);
    m[13] = -(ux * eye[0] + uy * eye[1] + uz * eye[2]);
    m[14] = fx * eye[0] + fy * eye[1] + fz * eye[2];
    m[15] = 1;
    return m;
  }

  function mul(a, b) {
    var o = new Float32Array(16);
    for (var c = 0; c < 4; c++) {
      for (var r = 0; r < 4; r++) {
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
    }
    return o;
  }

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      if (window.console) console.warn('[NoTopography] shader:', gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function buildGrid(n) {
    var verts = new Float32Array(n * n * 2);
    var k = 0;
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        verts[k++] = x / (n - 1);
        verts[k++] = y / (n - 1);
      }
    }
    var idx = new Uint16Array((n - 1) * (n - 1) * 6);
    k = 0;
    for (var j = 0; j < n - 1; j++) {
      for (var i = 0; i < n - 1; i++) {
        var a = j * n + i, b = a + 1, c = a + n, d = c + 1;
        idx[k++] = a; idx[k++] = c; idx[k++] = b;
        idx[k++] = b; idx[k++] = c; idx[k++] = d;
      }
    }
    return { verts: verts, idx: idx, count: idx.length };
  }

  function isMobile() {
    return window.innerWidth < MOBILE_MAX_WIDTH;
  }

  /* ---------- mount ---------- */

  function mount(el, opts) {
    var noop = { destroy: function () {} };
    if (!el || typeof window === 'undefined' || typeof document === 'undefined') return noop;

    var o = {};
    for (var key in DEFAULTS) o[key] = DEFAULTS[key];
    if (opts) for (var k2 in opts) if (opts[k2] !== undefined) o[k2] = opts[k2];

    var canvas = document.createElement('canvas');
    canvas.className = 'no-topo-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none;';

    var gl = null;
    try {
      gl = canvas.getContext('webgl2', { alpha: true, antialias: false, depth: true, premultipliedAlpha: true, preserveDrawingBuffer: false });
    } catch (e) { gl = null; }
    if (!gl) return noop; // sem WebGL2: não anexa nada, não lança erro

    var mobile = isMobile();
    var octaves = mobile ? 2 : 3;
    var vs = compile(gl, gl.VERTEX_SHADER, VERT.replace('OCTAVES', String(octaves)));
    var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG.replace('OCTAVES', String(octaves)));
    if (!vs || !fs) return noop;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      if (window.console) console.warn('[NoTopography] link:', gl.getProgramInfoLog(prog));
      return noop;
    }
    gl.useProgram(prog);

    var U = {};
    ['uViewProj', 'uScroll', 'uFreq', 'uElev', 'uTime', 'uMorph', 'uMouse', 'uLines', 'uLineWidth', 'uMajor', 'uOpacity', 'uLightMode', 'uFog', 'uColor']
      .forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

    // malha
    var gridN = mobile ? 90 : 160;
    var grid = buildGrid(gridN);
    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    var vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, grid.verts, gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    var ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, grid.idx, gl.STATIC_DRAW);

    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);

    // uniforms fixos
    var rgb = hexToRgb(o.color);
    gl.uniform3f(U.uColor, rgb[0], rgb[1], rgb[2]);
    gl.uniform1f(U.uLines, Math.max(1, Number(o.lineCount) || 22));
    gl.uniform1f(U.uMajor, o.majorLines ? 1 : 0);
    gl.uniform1f(U.uLightMode, o.lightMode ? 1 : 0);
    gl.uniform1f(U.uFog, Math.max(0, Math.min(1, Number(o.fog) || 0)) * 0.09);
    gl.uniform1f(U.uFreq, 0.22 / Math.max(0.1, Number(o.scale) || 1));
    gl.uniform1f(U.uElev, Number(o.elevation) || 0);
    gl.uniform1f(U.uMorph, Number(o.morph) || 0);

    el.appendChild(canvas);

    // estado
    var dpr = 1, width = 0, height = 0, aspect = 1;
    var tiltRad = Math.max(15, Math.min(75, Number(o.tilt) || 32)) * Math.PI / 180;
    var fov = 50 * Math.PI / 180;
    var eye = [0, 3.4, 2.0];
    var fwd = [0, -Math.sin(tiltRad), -Math.cos(tiltRad)];
    var upv = [0, Math.cos(tiltRad), -Math.sin(tiltRad)];
    var viewM = view(eye, fwd, upv);
    var viewProj = null;
    var time = 0, scroll = 0, last = 0, reveal = 0;
    var raf = 0, running = false, destroyed = false;
    var visible = true, hidden = !!document.hidden;
    var reduced = false;
    var mouse = { x: 0, z: 0, s: 0, tx: 0, tz: 0, ts: 0 };
    var opacity = Math.max(0, Math.min(1, Number(o.opacity)));
    if (isNaN(opacity)) opacity = 1;

    function resize() {
      if (destroyed) return;
      var w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      var maxDpr = isMobile() ? 1.5 : 2;
      dpr = Math.min(o.dpr ? Number(o.dpr) : (window.devicePixelRatio || 1), maxDpr);
      width = Math.max(1, Math.round(w * dpr));
      height = Math.max(1, Math.round(h * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      aspect = width / height;
      gl.viewport(0, 0, width, height);
      viewProj = mul(perspective(fov, aspect, 0.1, 80), viewM);
      gl.uniformMatrix4fv(U.uViewProj, false, viewProj);
      gl.uniform1f(U.uLineWidth, (Number(o.lineWidth) || 1.2) * dpr);
      if (!running) render(); // quadro parado (reduced motion) acompanha o tamanho
    }

    function render() {
      if (destroyed || !viewProj) return;
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniform1f(U.uTime, time);
      gl.uniform1f(U.uScroll, scroll);
      gl.uniform3f(U.uMouse, mouse.x, mouse.z, mouse.s);
      gl.uniform1f(U.uOpacity, opacity * reveal);
      gl.drawElements(gl.TRIANGLES, grid.count, gl.UNSIGNED_SHORT, 0);
    }

    function frame(now) {
      raf = 0;
      if (!running) return;
      var dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      time += dt;
      scroll += dt * (Number(o.speed) || 0) * 2.0;
      reveal = Math.min(1, reveal + dt / 1.2);
      // mouse com suavização
      var e = 1 - Math.exp(-dt * 6);
      mouse.x += (mouse.tx - mouse.x) * e;
      mouse.z += (mouse.tz - mouse.z) * e;
      mouse.s += (mouse.ts - mouse.s) * e;
      render();
      raf = window.requestAnimationFrame(frame);
    }

    function update() {
      var should = !destroyed && !reduced && visible && !hidden;
      if (should && !running) {
        running = true;
        last = 0;
        if (!raf) raf = window.requestAnimationFrame(frame);
      } else if (!should && running) {
        running = false;
        if (raf) { window.cancelAnimationFrame(raf); raf = 0; }
      }
      if (reduced && !destroyed) { reveal = 1; render(); }
    }

    // mouse no window (o canvas tem pointer-events:none)
    function onMove(ev) {
      if (!o.mouseInteraction || reduced) return;
      var r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var nx = ((ev.clientX - r.left) / r.width) * 2 - 1;
      var ny = 1 - ((ev.clientY - r.top) / r.height) * 2;
      if (nx < -1 || nx > 1 || ny < -1 || ny > 1) { mouse.ts = 0; return; }
      // raio da câmera pelo pixel, interseção com o plano y=0
      var th = Math.tan(fov / 2);
      var cx = nx * th * aspect, cy = ny * th;
      var dx = cx, dy = upv[1] * cy + fwd[1], dz = upv[2] * cy + fwd[2];
      if (dy >= -1e-4) { mouse.ts = 0; return; }
      var t = -eye[1] / dy;
      mouse.tx = eye[0] + dx * t;
      mouse.tz = eye[2] + dz * t;
      mouse.ts = 1;
    }
    function onLeave(ev) { if (!ev || !ev.relatedTarget) mouse.ts = 0; }
    function onVisibility() { hidden = !!document.hidden; update(); }
    function onLost(ev) { ev.preventDefault(); running = false; if (raf) { window.cancelAnimationFrame(raf); raf = 0; } }

    var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    function onMotion() { reduced = !!(mq && mq.matches); update(); }

    var ro = null, io = null;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(function () { resize(); });
      ro.observe(el);
    } else {
      window.addEventListener('resize', resize);
    }
    if (window.IntersectionObserver) {
      io = new IntersectionObserver(function (entries) {
        visible = entries.some(function (en) { return en.isIntersecting; });
        update();
      }, { threshold: 0 });
      io.observe(el);
    }
    document.addEventListener('visibilitychange', onVisibility);
    if (mq) { if (mq.addEventListener) mq.addEventListener('change', onMotion); else if (mq.addListener) mq.addListener(onMotion); }
    if (o.mouseInteraction) {
      window.addEventListener('pointermove', onMove, { passive: true });
      document.addEventListener('mouseout', onLeave);
    }
    canvas.addEventListener('webglcontextlost', onLost);

    reduced = !!(mq && mq.matches);
    resize();
    update();

    return {
      destroy: function () {
        if (destroyed) return;
        destroyed = true;
        running = false;
        if (raf) { window.cancelAnimationFrame(raf); raf = 0; }
        if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
        if (io) io.disconnect();
        document.removeEventListener('visibilitychange', onVisibility);
        if (mq) { if (mq.removeEventListener) mq.removeEventListener('change', onMotion); else if (mq.removeListener) mq.removeListener(onMotion); }
        window.removeEventListener('pointermove', onMove);
        document.removeEventListener('mouseout', onLeave);
        canvas.removeEventListener('webglcontextlost', onLost);
        try {
          gl.deleteBuffer(vbo); gl.deleteBuffer(ibo); gl.deleteVertexArray(vao);
          gl.deleteProgram(prog); gl.deleteShader(vs); gl.deleteShader(fs);
          var lose = gl.getExtension('WEBGL_lose_context');
          if (lose) lose.loseContext();
        } catch (e) { /* ignora */ }
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    };
  }

  window.NoTopography = { mount: mount, defaults: DEFAULTS };
})();
