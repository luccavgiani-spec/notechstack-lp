import * as THREE from 'https://esm.sh/three@0.170.0';
import { GLTFLoader } from 'https://esm.sh/three@0.170.0/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'https://esm.sh/three@0.170.0/examples/jsm/environments/RoomEnvironment.js';

const PREFERS_REDUCED_MOTION=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;

const BASE_COLOR={warmth:1,saturation:1.8,contrast:1.04,brightness:.94,exposure:.75,ambient:1.5,keyLight:1.25,reflections:.6};
const BASE_SHADOW={shadowX:0,shadowY:0,shadowZ:0,lightHeight:14,shadowIntensity:1.25,shadowSoftness:3};
const CONFIG={
  escritorio:{label:'Hero · escritório',url:'./assets/hero-escritorio-animado.glb?v=0903-18',targetSize:7.5,sceneScale:1.2,camX:-2.5,camY:5.2,camZ:7.4,fov:38,lookAtY:.4,sceneX:1.1,sceneY:.2,sceneZ:.7,baseYaw:.28,...BASE_SHADOW,...BASE_COLOR},
  atendimento:{label:'01 · treinamento',url:'./assets/01-treinamento-animado.glb?v=0903-18',targetSize:7.6,sceneScale:1.6,camX:-5.2,camY:3.5,camZ:5.5,fov:45,lookAtY:1.8,sceneX:1.1,sceneY:.1,sceneZ:.6,baseYaw:0,...BASE_SHADOW,...BASE_COLOR},
  operacoes:{label:'02 · carreira',url:'./assets/02-carreira-animada.glb?v=0903-22',targetSize:9.2,sceneScale:1.45,camX:7,camY:3.2,camZ:6,fov:30,lookAtY:1.35,sceneX:-2.6,sceneY:.4,sceneZ:-.1,baseYaw:0,...BASE_SHADOW,...BASE_COLOR},
};
const states=new Map(Object.entries(CONFIG).map(([nome,config])=>[nome,{...config}]));
const runtimes=new Map();
window.__scene3d={states,runtimes,THREE};

function aplicarTratamento(runtime){
  const s=runtime.settings;
  runtime.renderer.toneMappingExposure=s.exposure;
  runtime.canvas.style.filter=`saturate(${s.saturation}) contrast(${s.contrast}) brightness(${s.brightness})`;
  runtime.ambient.intensity=.52*s.ambient;runtime.hemi.intensity=.32*s.ambient;runtime.sun.intensity=1.65*s.keyLight;runtime.scene.environmentIntensity=s.reflections;
  runtime.sun.color.copy(new THREE.Color(0xfffbf2)).lerp(new THREE.Color(0xffb56b),THREE.MathUtils.clamp(s.warmth*.55,0,1));
}
function aplicarEnquadramento(runtime){
  const s=runtime.settings,escala=s.sceneScale??1;runtime.camera.position.set(s.camX,s.camY,s.camZ);runtime.camera.fov=s.fov;runtime.camera.lookAt(0,s.lookAtY??.4,0);runtime.camera.updateProjectionMatrix();runtime.root.position.set(s.sceneX,s.sceneY,s.sceneZ);runtime.content?.scale.setScalar(1);runtime.canvas.style.width=`${escala*100}%`;runtime.canvas.style.height=`${escala*100}%`;runtime.canvas.style.left='50%';runtime.canvas.style.right='auto';runtime.canvas.style.top='50%';runtime.canvas.style.bottom='auto';runtime.canvas.style.transform='translate(-50%,-50%)';
}
function aplicarSombras(runtime){
  const s=runtime.settings;runtime.receiver.position.set(s.shadowX,s.shadowZ+.006,s.shadowY);runtime.shadowMaterial.opacity=runtime.baseShadowOpacity*s.shadowIntensity;runtime.sun.shadow.radius=s.shadowSoftness;runtime.sun.position.set(s.shadowX,s.shadowZ+s.lightHeight,s.shadowY);runtime.sun.target.position.set(s.shadowX,s.shadowZ,s.shadowY);runtime.sun.target.updateMatrixWorld();
}
function criarSombras(root,sun,scene,size=10){
  const baseShadowOpacity=.36;const shadowMaterial=new THREE.ShadowMaterial({color:0x111316,opacity:baseShadowOpacity,transparent:true,depthWrite:false});const receiver=new THREE.Mesh(new THREE.PlaneGeometry(size,size*.78),shadowMaterial);receiver.name='Receptor de sombras web';receiver.rotation.x=-Math.PI/2;receiver.receiveShadow=true;receiver.renderOrder=-1;root.add(receiver);scene.add(sun.target);return {receiver,shadowMaterial,baseShadowOpacity};
}
function corrigirMateriaisHero(model){
  model.traverse(o=>{if(!o.isMesh)return;const materials=Array.isArray(o.material)?o.material:[o.material];materials.filter(Boolean).forEach(material=>{if(material.name==='Calça mascote uniforme'){material.map=null;material.color.set(0x090c12);material.metalness=0;material.roughness=.68;material.needsUpdate=true}})});
  const piso=model.getObjectByName('Piso');if(piso)piso.visible=false;const tapete=model.getObjectByName('Tapete estação');if(tapete)tapete.visible=false;
}
function normalizarModelo(model,targetSize){
  model.updateMatrixWorld(true);const bounds=new THREE.Box3(),invalidos=[],pisos=[];model.traverse(o=>{if(!o.isMesh||!o.visible)return;o.geometry.computeBoundingBox();const box=o.geometry.boundingBox?.clone().applyMatrix4(o.matrixWorld),valores=box?[...box.min,...box.max]:[];if(valores.length===6&&valores.every(Number.isFinite)){bounds.union(box);pisos.push(box.min.y)}else{invalidos.push(o.name);o.visible=false}});pisos.sort((a,b)=>a-b);const floorY=pisos[Math.min(pisos.length-1,Math.floor(pisos.length*.1))]??bounds.min.y;const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),scale=targetSize/Math.max(size.x,size.z);model.position.set(-center.x*scale,-floorY*scale,-center.z*scale);model.scale.setScalar(scale);return {size:size.toArray(),center:center.toArray(),scale,floorY,invalidos};
}
function prepararCaminhantes(runtime){
  if(runtime.nome!=='operacoes')return;
  runtime.caminhantes=[1,2,3].map(indice=>{const grupo=runtime.model.getObjectByName(`Mascote_percurso_${String(indice).padStart(2,'0')}`),materiais=[];const clones=new Map();grupo?.traverse(objeto=>{if(!objeto.isMesh)return;const lista=Array.isArray(objeto.material)?objeto.material:[objeto.material];const novos=lista.map(material=>{if(!material)return material;if(!clones.has(material)){const clone=material.clone();clone.transparent=true;clone.userData.opacidadeBase=material.opacity;clones.set(material,clone);materiais.push(clone)}return clones.get(material)});objeto.material=Array.isArray(objeto.material)?novos:novos[0]});return {grupo,materiais}});
}
function atualizarCaminhantes(runtime){
  if(!runtime.caminhantes||!runtime.mixers.length)return;
  const tempo=((runtime.mixers[0].time%10)+10)%10;
  const janelas=[[0,0,2.78,3.08],[3.38,3.62,6.12,6.42],[6.72,6.98,9.45,9.75]];
  runtime.caminhantes.forEach(({grupo,materiais},indice)=>{if(!grupo)return;const [inicio,fimEntrada,inicioSaida,fim]=janelas[indice];let opacidade=0;if(tempo>=inicio&&tempo<fim){if(fimEntrada>inicio&&tempo<fimEntrada)opacidade=THREE.MathUtils.smoothstep(tempo,inicio,fimEntrada);else if(tempo>inicioSaida)opacidade=1-THREE.MathUtils.smoothstep(tempo,inicioSaida,fim);else opacidade=1}grupo.visible=opacidade>.01;materiais.forEach(material=>{material.opacity=material.userData.opacidadeBase*opacidade;material.depthWrite=opacidade>.98})});
}
function prepararInteracao(runtime){
  const {canvas,root}=runtime;let dragging=false,lastX=0,lastY=0,dragYaw=0,dragPitch=0,autoYaw=0;canvas.style.touchAction='none';canvas.style.cursor='grab';canvas.addEventListener('pointerdown',e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing'});canvas.addEventListener('pointermove',e=>{if(!dragging)return;dragYaw+=(e.clientX-lastX)*.006;dragPitch=THREE.MathUtils.clamp(dragPitch+(e.clientY-lastY)*.003,-.22,.18);lastX=e.clientX;lastY=e.clientY});const soltar=e=>{if(!dragging)return;dragging=false;canvas.style.cursor='grab';if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId)};canvas.addEventListener('pointerup',soltar);canvas.addEventListener('pointercancel',soltar);runtime.aplicarRotacao=t=>{if(runtime.rotate&&!PREFERS_REDUCED_MOTION){const alvo=Math.sin(t*Math.PI/12)*(Math.PI/12);autoYaw+=(alvo-autoYaw)*.018}root.rotation.y=runtime.settings.baseYaw+autoYaw+dragYaw;root.rotation.x=dragPitch};
}
function init(canvas){
  const nome=canvas.dataset.scene,settings=states.get(nome);if(!settings){canvas.dataset.error='1';console.error(`Cena desconhecida: ${nome}`);return}const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene(),pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;pmrem.dispose();const camera=new THREE.PerspectiveCamera(settings.fov,1,.1,80);const ambient=new THREE.AmbientLight(0xffffff,.52);scene.add(ambient);const hemi=new THREE.HemisphereLight(0xffffff,0xEDEBE4,.32);scene.add(hemi);const sun=new THREE.DirectionalLight(0xfffbf2,1.65);sun.position.set(4,10,3);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.radius=3;sun.shadow.bias=-.00025;Object.assign(sun.shadow.camera,{left:-9,right:9,top:9,bottom:-9,near:.1,far:40});scene.add(sun);const root=new THREE.Group(),content=new THREE.Group();root.add(content);scene.add(root);const runtime={nome,canvas,renderer,scene,camera,ambient,hemi,sun,root,content,settings,mixers:[],loaded:false,visible:true,rotate:canvas.dataset.rotate!=='0'};runtimes.set(nome,runtime);
  Object.assign(runtime,criarSombras(root,sun,scene,settings.targetSize*1.35));aplicarEnquadramento(runtime);aplicarSombras(runtime);aplicarTratamento(runtime);prepararInteracao(runtime);new GLTFLoader().load(new URL(settings.url,import.meta.url).href,gltf=>{const model=gltf.scene;if(nome==='escritorio')corrigirMateriaisHero(model);model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});runtime.normalizacao=normalizarModelo(model,settings.targetSize);runtime.model=model;content.add(model);if(gltf.animations.length){const mixer=new THREE.AnimationMixer(model);gltf.animations.forEach(clip=>mixer.clipAction(clip).setLoop(THREE.LoopRepeat,Infinity).play());runtime.mixers.push(mixer)}prepararCaminhantes(runtime);atualizarCaminhantes(runtime);runtime.loaded=true;canvas.dataset.loaded='1';canvas.dispatchEvent(new CustomEvent('scene-ready',{bubbles:true,detail:{nome,animations:gltf.animations.length}}))},undefined,error=>{canvas.dataset.error='1';console.error(`GLB ${nome}`,error)});
  const host=canvas.parentElement,fit=()=>{const w=canvas.clientWidth||host.clientWidth||300,h=canvas.clientHeight||host.clientHeight||300;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()};runtime.fit=fit;new ResizeObserver(fit).observe(canvas);fit();new IntersectionObserver(([entry])=>{runtime.visible=entry.isIntersecting},{rootMargin:'160px'}).observe(canvas);let previous=performance.now();renderer.setAnimationLoop(now=>{const delta=Math.min((now-previous)/1000,.1);previous=now;if(!runtime.visible)return;const t=now/1000;if(!PREFERS_REDUCED_MOTION)runtime.mixers.forEach(mixer=>mixer.update(delta));atualizarCaminhantes(runtime);runtime.aplicarRotacao(t);renderer.render(scene,camera)});
}

const built=new WeakSet(),observed=new WeakSet();const lazyScenes=new IntersectionObserver(entries=>entries.forEach(entry=>{const canvas=entry.target;if(entry.isIntersecting&&!built.has(canvas)&&canvas.clientWidth>0){built.add(canvas);lazyScenes.unobserve(canvas);try{init(canvas)}catch(error){canvas.dataset.error='1';console.error('scene',error)}}}),{rootMargin:'220px 0px'});setInterval(()=>{document.querySelectorAll('canvas[data-scene]').forEach(canvas=>{if(!observed.has(canvas)){observed.add(canvas);lazyScenes.observe(canvas)}})},300);
