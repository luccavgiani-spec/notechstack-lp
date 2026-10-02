/* Demos e marketing fora do caminho crítico da primeira tela. */
(function(){
  'use strict';
  function script(src){return new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=src;el.onload=resolve;el.onerror=reject;document.body.append(el);});}
  let demos;
  function loadDemos(){
    if (!demos) demos=script('/lp-narrador/cenas-lp/historia/v8-home.js?v=1').catch(()=>{demos=null;});
    return demos;
  }
  const targets=document.querySelectorAll('#ferramentas,#como-funciona,#cronograma,#clientes');
  function watchDemos(){ if ('IntersectionObserver' in window){
    const io=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){io.disconnect();loadDemos();}},{rootMargin:'300px 0px'});
    targets.forEach(el=>io.observe(el));
  } else loadDemos(); }
  let watching=false;
  function activateDemos(){if(watching)return;watching=true;watchDemos();}
  ['scroll','pointerdown','keydown'].forEach(event=>addEventListener(event,activateDemos,{once:true,passive:true}));
  if(location.hash || scrollY>0)activateDemos();
  let mascot=false;
  function loadMascot(){if(mascot)return;mascot=true;script('/lp-narrador/cenas-lp/historia/mascote-home.js?v=1').catch(()=>{mascot=false;});}
  ['scroll','pointerdown','keydown'].forEach(event=>addEventListener(event,loadMascot,{once:true,passive:true}));
  let marketing=false;
  function loadMarketing(){
    if(marketing || /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
    marketing=true;
    window.dataLayer=window.dataLayer||[];
    window.dataLayer.push({'gtm.start':Date.now(),event:'gtm.js'});
    script('https://www.googletagmanager.com/gtm.js?id=GTM-NK87FH8W').catch(()=>{});
  }
  ['pointerdown','keydown','scroll'].forEach(event=>addEventListener(event,loadMarketing,{once:true,passive:true}));
  // Quem lê sem interagir também conta, depois de a primeira tela estar pronta.
  function idle(){setTimeout(loadMarketing,5000);}
  if(document.readyState==='complete') idle(); else addEventListener('load',idle,{once:true});
})();
