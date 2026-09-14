/* Três microcenas 3D do diagnóstico. Three.js já é carregado pelo import map da v7 (MIT).
   Os SVGs do HTML permanecem como fallback se WebGL não estiver disponível. */
import * as THREE from 'three';

const secao = document.querySelector('#diagnostico');
if (secao) {
  const reduzir = matchMedia('(prefers-reduced-motion: reduce)');
  const tinta = new THREE.MeshStandardMaterial({ color:0x25221e, roughness:.44, metalness:.27 });
  const ambar = new THREE.MeshStandardMaterial({ color:0xe9a33f, roughness:.32, metalness:.38, emissive:0x432500, emissiveIntensity:.17 });
  const cenas = [];

  function raio(raiz) {
    const forma = new THREE.Shape();
    [[.08,1.48],[-.92,.02],[-.24,.02],[-.48,-1.48],[.97,.35],[.25,.35],[.76,1.48]]
      .forEach(([x,y],i) => i ? forma.lineTo(x,y) : forma.moveTo(x,y));
    forma.closePath();
    const geo = new THREE.ExtrudeGeometry(forma,{depth:.34,bevelEnabled:true,bevelThickness:.055,bevelSize:.045,bevelSegments:2});
    geo.translate(0,0,-.17);
    raiz.add(new THREE.Mesh(geo,ambar));
    return t => { raiz.rotation.y=Math.sin(t*.0017)*.42; raiz.rotation.z=Math.sin(t*.0023)*.075; raiz.position.y=Math.sin(t*.002)*.075; };
  }

  function personalizado(raiz) {
    const botoes=[];
    [-.7,0,.7].forEach((y,i) => {
      const trilho = new THREE.Mesh(new THREE.BoxGeometry(2.25,.14,.19),tinta);
      trilho.position.y=y; raiz.add(trilho);
      const botao = new THREE.Mesh(new THREE.SphereGeometry(.22,16,12),ambar);
      botao.position.set([-.47,.46,-.18][i],y,.18); raiz.add(botao); botoes.push(botao);
    });
    return t => { botoes.forEach((b,i)=>b.position.x=[-.47,.46,-.18][i]+Math.sin(t*.0015+i*2.1)*.22); raiz.rotation.y=Math.sin(t*.001)*.24; };
  }

  function livre(raiz) {
    const anel1=new THREE.Mesh(new THREE.TorusGeometry(.59,.14,9,32),tinta);
    const anel2=new THREE.Mesh(new THREE.TorusGeometry(.59,.14,9,32),ambar);
    raiz.add(anel1,anel2);
    return t => {
      const abrir=.13+.18*(.5+.5*Math.sin(t*.0018));
      anel1.position.set(-.58-abrir,.17,.15); anel2.position.set(.58+abrir,-.17,-.15);
      anel1.rotation.set(.28,-.34,-.48+abrir*.25); anel2.rotation.set(-.28,.34,.48-abrir*.25);
      raiz.rotation.y=Math.sin(t*.001)*.16;
    };
  }

  const fabrica={raio,personalizado,livre};
  secao.querySelectorAll('.dg-ico[data-icone]').forEach(el => {
    try {
      const canvas=document.createElement('canvas');
      canvas.setAttribute('aria-hidden','true');
      const renderizador=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});
      renderizador.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
      renderizador.setSize(56,56,false);
      renderizador.outputColorSpace=THREE.SRGBColorSpace;
      const cena=new THREE.Scene();
      cena.add(new THREE.HemisphereLight(0xffffff,0x94714a,2.1));
      const luz=new THREE.DirectionalLight(0xffffff,2.2); luz.position.set(-2,3,5); cena.add(luz);
      const camera=new THREE.OrthographicCamera(-1.9,1.9,1.9,-1.9,.1,20); camera.position.z=6;
      const raiz=new THREE.Group(); cena.add(raiz);
      const atualizar=fabrica[el.dataset.icone](raiz);
      const fallback=el.querySelector('svg'); fallback?.remove(); el.append(canvas);
      cenas.push({renderizador,cena,camera,atualizar});
    } catch (_) { /* SVG permanece quando não há WebGL. */ }
  });

  function desenha(t){ cenas.forEach(c=>{ c.atualizar(t); c.renderizador.render(c.cena,c.camera); }); }
  let visivel=false, quadro=0;
  function para(){ if(quadro) cancelAnimationFrame(quadro); quadro=0; }
  function roda(t){
    if(!visivel||document.hidden||reduzir.matches){ para(); return; }
    desenha(t); quadro=requestAnimationFrame(roda);
  }
  function sincroniza(){
    para(); desenha(0);
    if(visivel&&!document.hidden&&!reduzir.matches) quadro=requestAnimationFrame(roda);
  }
  new IntersectionObserver(e=>{visivel=e[0].isIntersecting; sincroniza();},{threshold:.05}).observe(secao);
  reduzir.addEventListener('change',sincroniza);
  document.addEventListener('visibilitychange',sincroniza);
}
