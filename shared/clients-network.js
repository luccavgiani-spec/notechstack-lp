/* Animated Beam (magicui.design): adaptação SVG à home estática, com órbita de logos. */
(function(){
 'use strict';
 document.querySelectorAll('[data-client-network]').forEach(section=>{
 section.innerHTML="\n<div class=\"v8-in v8-topo-centro\"><p class=\"v8-k\">quem já trabalhou com a gente</p><h2 class=\"v8-h\">Empresas que já têm um sistema da Nó.</h2></div>\n<div class=\"home-client-network\" role=\"group\" aria-label=\"Clientes conectados à Nó\">\n<svg class=\"home-beams\" aria-hidden=\"true\"></svg>\n<div class=\"home-network-center\"><img src=\"/brand/favicon/favicon-dark.svg\" alt=\"Nó Tech Stack\" width=\"100\" height=\"100\" loading=\"lazy\"></div>\n<div class=\"home-client-node \" style=\"left:88.00%;top:50.00%\" title=\"Plantão Digital\"><img src=\"/lp-narrador/cenas-lp/historia/logos-clientes/plantao-digital.webp\" alt=\"Plantão Digital\" loading=\"lazy\" decoding=\"async\"></div>\n<div class=\"home-client-node \" style=\"left:79.11%;top:73.78%\" title=\"Consulta de Casa\"><img src=\"/lp-narrador/cenas-lp/historia/logos-clientes/consulta-de-casa.webp\" alt=\"Consulta de Casa\" loading=\"lazy\" decoding=\"async\"></div>\n<div class=\"home-client-node \" style=\"left:56.60%;top:86.44%\" title=\"SOS Telemedicina\"><img src=\"/lp-narrador/cenas-lp/historia/logos-clientes/sos-telemedicina.webp\" alt=\"SOS Telemedicina\" loading=\"lazy\" decoding=\"async\"></div>\n<div class=\"home-client-node \" style=\"left:31.00%;top:82.04%\" title=\"Loiê Sala Aromática\"><img src=\"/lp-narrador/cenas-lp/historia/logos-clientes/loie.webp\" alt=\"Loiê Sala Aromática\" loading=\"lazy\" decoding=\"async\"></div>\n<div class=\"home-client-node \" style=\"left:14.29%;top:62.65%\" title=\"Gazeta Bragantina\"><img src=\"/lp-narrador/cenas-lp/historia/logos-clientes/gazeta-bragantina.webp\" alt=\"Gazeta Bragantina\" loading=\"lazy\" decoding=\"async\"></div>\n<div class=\"home-client-node \" style=\"left:14.29%;top:37.35%\" title=\"Maisis Marketing Digital\"><img src=\"/lp-narrador/cenas-lp/historia/logos-clientes/maisis-marketing-digital.webp\" alt=\"Maisis Marketing Digital\" loading=\"lazy\" decoding=\"async\"></div>\n<div class=\"home-client-node verde\" style=\"left:31.00%;top:17.96%\" title=\"Pesqueiro Xocó\"><img src=\"/lp-narrador/cenas-lp/historia/logos-clientes/pesqueiro-xoco.webp\" alt=\"Pesqueiro Xocó\" loading=\"lazy\" decoding=\"async\"></div>\n<div class=\"home-client-node prontia\" style=\"left:56.60%;top:13.56%\" title=\"Prontia Saúde\"><img src=\"/lp-narrador/cenas-lp/historia/logos-clientes/prontia-saude.webp\" alt=\"Prontia Saúde\" loading=\"lazy\" decoding=\"async\"></div>\n<div class=\"home-client-node preto\" style=\"left:79.11%;top:26.22%\" title=\"Palladio\"><img src=\"/lp-narrador/cenas-lp/historia/logos-clientes/palladio.webp\" alt=\"Palladio\" loading=\"lazy\" decoding=\"async\"></div>\n</div><button class=\"home-network-toggle\" type=\"button\" aria-pressed=\"false\">Pausar animação</button>";
 const root=section.querySelector('.home-client-network');
 const svg=root.querySelector('svg'),nodes=[...root.querySelectorAll('.home-client-node')];
 const toggle=section.querySelector('.home-network-toggle');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const ns='http://www.w3.org/2000/svg';let width=0,height=0,angle=0,last=0,frame=0,visible=false,paused=reduced.matches;
 const paths=nodes.map((node,i)=>{
   const base=document.createElementNS(ns,'path'),beam=document.createElementNS(ns,'path');
   base.setAttribute('class','home-beam-track');beam.setAttribute('class','home-beam-light');
   beam.setAttribute('pathLength','100');beam.style.animationDelay=(-i*.63)+'s';
   beam.style.stroke=['#EDA33B','#3D63DB','#30A46C','#E0543C'][i%4];
   svg.append(base,beam);return [base,beam];
 });
 function draw(){
   const cx=width/2,cy=height/2,rx=width*.38,ry=height*.37;
   nodes.forEach((node,i)=>{
     const t=angle+i*Math.PI*2/nodes.length,x=cx+Math.cos(t)*rx,y=cy+Math.sin(t)*ry;
     node.style.left=x+'px';node.style.top=y+'px';
     const dx=x-cx,dy=y-cy;
     const d=`M ${x} ${y} Q ${cx+dx*.4-dy*.18} ${cy+dy*.4+dx*.18} ${cx} ${cy}`;
     paths[i].forEach(p=>p.setAttribute('d',d));
   });
 }
 function measure(){width=root.clientWidth;height=root.clientHeight;svg.setAttribute('viewBox',`0 0 ${width} ${height}`);draw();}
 function tick(t){frame=0;if(!visible||paused||document.hidden)return;angle+=(last?Math.min(t-last,50):0)*Math.PI*2/110000;last=t;draw();frame=requestAnimationFrame(tick);}
 function sync(){cancelAnimationFrame(frame);frame=0;last=0;root.classList.toggle('beam-paused',paused||!visible||document.hidden);toggle.textContent=paused?'Reproduzir animação':'Pausar animação';toggle.setAttribute('aria-pressed',String(paused));if(visible&&!paused&&!document.hidden)frame=requestAnimationFrame(tick);}
 toggle.addEventListener('click',()=>{paused=!paused;sync();});
 reduced.addEventListener('change',()=>{paused=reduced.matches;sync();});
 new ResizeObserver(measure).observe(root);
 new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();},{threshold:.05}).observe(root);
 document.addEventListener('visibilitychange',sync);measure();sync();
 });
})();
