/* ══════════════════════════════════════════════════════════════════════
   Glow Cursor — rastro de luz que segue o mouse, em todas as páginas do site.
   Porte sem React/OGL do GlowCursor do React Bits (David Haz, MIT + Commons
   Clause · reactbits.dev/animations/glow-cursor): mesmo shader, mesma física
   de corrente (cabeça persegue o ponteiro, cada ponto persegue o anterior).
   Diferenças: canvas fixo na tela inteira (pointer-events:none), mistura
   "normal" em vez de "screen" (o site é quase todo claro e o screen some no
   branco) e o laço dorme quando o rastro apaga.
   Azul da marca na cabeça, azul claro na cauda. Só com mouse (hover + fine);
   com movimento reduzido não liga. Substitui o cursor antigo (#cur/#curR).
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  if (window.__glowCursor) return; window.__glowCursor = true;
  if (!matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const CFG = {
    color:'#3D63DB', secondaryColor:'#A9C1F5', trailLength:40, trailWidth:7, trailTaper:.8,
    followSpeed:.2, glowIntensity:1.6, glowSpread:1.1, hotspot:.55, brightness:1.2, opacity:.9,
    pulseSpeed:1.1, noiseStrength:.03, idleTimeout:700, fadeDuration:900
  };
  const MAX = 64;

  const estilo = document.createElement('style');
  estilo.textContent = '#cur,#curR,.cursor,.cursor-ring{display:none!important}' +
    '.glow-cursor-cv{position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483000;display:block}';
  document.head.appendChild(estilo);

  const cv = document.createElement('canvas');
  cv.className = 'glow-cursor-cv'; cv.setAttribute('aria-hidden', 'true');
  const gl = cv.getContext('webgl', { alpha:true, premultipliedAlpha:false, antialias:false });
  if (!gl) return;

  const VS = 'attribute vec2 position;varying vec2 vUv;void main(){vUv=position*.5+.5;gl_Position=vec4(position,0.,1.);}';
  const FS = `precision highp float;
#define MAX_POINTS 64
uniform vec2 uResolution;uniform vec2 uPoints[MAX_POINTS];uniform float uPointCount;
uniform vec3 uColor;uniform vec3 uSecondaryColor;uniform float uTrailWidth;uniform float uTaper;
uniform float uGlowIntensity;uniform float uGlowSpread;uniform float uHotspot;uniform float uBrightness;
uniform float uOpacity;uniform float uPulseSpeed;uniform float uNoiseStrength;uniform float uTime;uniform float uFade;
varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float filmGrain(vec2 p,float time){float frame=time*18.;float fi=mod(floor(frame),256.);float nf=mod(fi+1.,256.);
 float b=fract(frame);b=b*b*(3.-2.*b);vec2 px=floor(p);float c=hash(px+vec2(fi*17.,fi*31.));float n=hash(px+vec2(nf*17.,nf*31.));
 return mix(c,n,b)*2.-1.;}
void main(){
 vec2 pixel=vUv*uResolution;float den=max(uPointCount-1.,1.);
 float strongest=0.;float strongestCore=0.;float cw=0.;vec3 cs=vec3(0.);
 for(int i=0;i<MAX_POINTS-1;i++){
  float index=float(i);float active=1.-step(uPointCount-1.,index);
  vec2 start=uPoints[i];vec2 end=uPoints[i+1];vec2 tp=pixel-start;vec2 seg=end-start;
  float along=clamp(dot(tp,seg)/max(dot(seg,seg),.0001),0.,1.);
  float progress=clamp((index+along)/den,0.,1.);
  float life=pow(max(1.-progress,0.),mix(.55,1.25,uTaper));
  float width=uTrailWidth*mix(1.,.25,pow(progress,mix(.55,1.6,uTaper)));
  float d=length(tp-seg*along);
  float falloff=max(width*(.8+uGlowSpread*1.4),.5);
  float beam=min(1.,(falloff*falloff)/(d*d+falloff*falloff));
  float core=exp(-pow(d/max(width,.5),2.)*2.5);
  float pa=min(abs(uPulseSpeed),1.);
  float pulse=1.+sin(uTime*uPulseSpeed*3.-progress*11.)*.16*pa;
  float intensity=(core+beam*uGlowIntensity*.55)*life*pulse*active;
  vec3 sc=mix(uColor,uSecondaryColor,progress);
  strongest=max(strongest,intensity);strongestCore=max(strongestCore,core*life*active);
  cs+=sc*intensity;cw+=intensity;
 }
 float grain=filmGrain(pixel,uTime);float na=(1.-exp(-uNoiseStrength*2.2))*.4;
 vec3 color=cs/max(cw,.0001);
 float a=clamp(strongest*uBrightness*uOpacity*uFade,0.,1.);
 a*=1.+grain*na;
 if(a<.004)discard;
 vec3 nc=mix(color,vec3(1.),smoothstep(.45,1.,strongestCore)*uHotspot*.35);
 gl_FragColor=vec4(nc,a);
}`;
  function sh(t, src){ const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; }
  const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) return;
  const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
  gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'position'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  const U = n => gl.getUniformLocation(pr, n);
  const hex = h => { const v = parseInt(h.slice(1), 16); return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255]; };
  gl.uniform3fv(U('uColor'), hex(CFG.color)); gl.uniform3fv(U('uSecondaryColor'), hex(CFG.secondaryColor));
  gl.uniform1f(U('uPointCount'), CFG.trailLength); gl.uniform1f(U('uTrailWidth'), CFG.trailWidth);
  gl.uniform1f(U('uTaper'), CFG.trailTaper); gl.uniform1f(U('uGlowIntensity'), CFG.glowIntensity);
  gl.uniform1f(U('uGlowSpread'), CFG.glowSpread); gl.uniform1f(U('uHotspot'), CFG.hotspot);
  gl.uniform1f(U('uBrightness'), CFG.brightness); gl.uniform1f(U('uOpacity'), CFG.opacity);
  gl.uniform1f(U('uPulseSpeed'), CFG.pulseSpeed); gl.uniform1f(U('uNoiseStrength'), CFG.noiseStrength);
  const uRes = U('uResolution'), uPts = U('uPoints'), uTime = U('uTime'), uFade = U('uFade');

  const DPR = Math.min(devicePixelRatio || 1, 1.25);
  let W = 1, H = 1;
  function redim(){
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    gl.viewport(0, 0, cv.width, cv.height); gl.uniform2f(uRes, W, H);
  }
  const pts = Array.from({ length:MAX }, () => ({ x:0, y:0 })), dados = new Float32Array(MAX * 2);
  const alvo = { x:0, y:0 }, cab = { x:0, y:0 };
  let iniciado = false, dentro = false, ultimo = 0, ultimoQuadro = performance.now(), fade = 0, rodando = false;
  function acorda(){ if (!rodando){ rodando = true; ultimoQuadro = performance.now(); requestAnimationFrame(quadro); } }
  addEventListener('pointermove', e => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    const x = e.clientX, y = H - e.clientY;
    if (!iniciado){ cab.x = alvo.x = x; cab.y = alvo.y = y; pts.forEach(p => { p.x = x; p.y = y; }); iniciado = true; }
    alvo.x = x; alvo.y = y; dentro = true; ultimo = performance.now(); acorda();
  }, { passive:true });
  document.documentElement.addEventListener('pointerleave', () => { dentro = false; ultimo = performance.now(); });
  addEventListener('blur', () => { dentro = false; });
  function quadro(agora){
    const d = Math.min((agora - ultimoQuadro) / 16.667, 3); ultimoQuadro = agora;
    const he = 1 - Math.pow(1 - CFG.followSpeed, d), ce = 1 - Math.pow(1 - (.28 + CFG.followSpeed * .35), d);
    cab.x += (alvo.x - cab.x) * he; cab.y += (alvo.y - cab.y) * he;
    pts[0].x = cab.x; pts[0].y = cab.y;
    for (let i = 1; i < MAX; i++){ pts[i].x += (pts[i-1].x - pts[i].x) * ce; pts[i].y += (pts[i-1].y - pts[i].y) * ce; }
    for (let i = 0; i < MAX; i++){ dados[i*2] = pts[i].x; dados[i*2+1] = pts[i].y; }
    const apaga = !dentro || agora - ultimo > CFG.idleTimeout;
    fade += ((iniciado && !apaga ? 1 : 0) - fade) * Math.min(1, 16.667 * d / CFG.fadeDuration * 7);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2fv(uPts, dados); gl.uniform1f(uTime, agora * .001); gl.uniform1f(uFade, fade);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    /* dorme quando o rastro apagou e o ponteiro parou */
    if (apaga && fade < .003){ gl.clear(gl.COLOR_BUFFER_BIT); rodando = false; return; }
    requestAnimationFrame(quadro);
  }
  function monta(){ document.body.appendChild(cv); redim(); }
  addEventListener('resize', redim);
  if (document.body) monta(); else addEventListener('DOMContentLoaded', monta, { once:true });
})();
