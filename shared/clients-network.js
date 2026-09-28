/* Animated Beam (magicui.design): adaptação SVG à home estática, com órbita de logos. */
(function(){
 'use strict';
 const clients=[
  {
    "name": "Green Marketing",
    "src": "/shared/logos-clientes/green-marketing.png",
    "theme": "green"
  },
  {
    "name": "Nano Influenciadores",
    "src": "/shared/logos-clientes/nano-influenciadores.jpg",
    "theme": "nano"
  },
  {
    "name": "Koulu MKT",
    "src": "/shared/logos-clientes/koulu-mkt.png",
    "theme": "koulu"
  },
  {
    "name": "LiveIdea",
    "src": "/shared/logos-clientes/liveidea.svg",
    "theme": "liveidea"
  },
  {
    "name": "O Brasil de Tarsila",
    "src": "/shared/logos-clientes/brasil-de-tarsila.png",
    "theme": "tarsila"
  },
  {
    "name": "Loiê Sala Aromática",
    "src": "/lp-narrador/cenas-lp/historia/logos-clientes/loie.webp",
    "theme": ""
  },
  {
    "name": "Gazeta Bragantina",
    "src": "/lp-narrador/cenas-lp/historia/logos-clientes/gazeta-bragantina.webp",
    "theme": ""
  },
  {
    "name": "Maisis Marketing Digital",
    "src": "/lp-narrador/cenas-lp/historia/logos-clientes/maisis-marketing-digital.webp",
    "theme": ""
  },
  {
    "name": "Pesqueiro Xocó",
    "src": "/lp-narrador/cenas-lp/historia/logos-clientes/pesqueiro-xoco.webp",
    "theme": "verde"
  },
  {
    "name": "Prontia Saúde",
    "src": "/lp-narrador/cenas-lp/historia/logos-clientes/prontia-saude.webp",
    "theme": "prontia"
  },
  {
    "name": "Palladio",
    "src": "/lp-narrador/cenas-lp/historia/logos-clientes/palladio.webp",
    "theme": "preto"
  }
];
 document.querySelectorAll('[data-client-network]').forEach(section=>{
 section.innerHTML=`<div class="v8-in v8-topo-centro"><p class="v8-k">quem já trabalhou com a gente</p><h2 class="v8-h">Empresas que já têm um sistema da Nó.</h2></div>
 <div class="home-client-network" role="group" aria-label="Clientes conectados à Nó">
 <svg class="home-beams" aria-hidden="true"></svg>
 <div class="home-network-center"><img src="/brand/favicon/favicon-dark.svg" alt="Nó Tech Stack" width="100" height="100" loading="lazy"></div>
 ${clients.map(client=>`<div class="home-client-node ${client.theme}" title="${client.name}"><img src="${client.src}" alt="${client.name}" loading="lazy" decoding="async"></div>`).join('')}
 </div><button class="home-network-toggle" type="button" aria-pressed="false">Pausar animação</button>`;
 const root=section.querySelector('.home-client-network');
 const svg=root.querySelector('svg'),nodes=[...root.querySelectorAll('.home-client-node')];
 const toggle=section.querySelector('.home-network-toggle');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const ns='http://www.w3.org/2000/svg';let width=0,height=0,angle=0,last=0,frame=0,visible=false,paused=reduced.matches;
 let orbit=[],orbitLength=0,rx=0,ry=0;
 const paths=nodes.map((node,i)=>{
   const base=document.createElementNS(ns,'path'),beam=document.createElementNS(ns,'path');
   base.setAttribute('class','home-beam-track');beam.setAttribute('class','home-beam-light');
   beam.setAttribute('pathLength','100');beam.style.animationDelay=(-i*.63)+'s';
   beam.style.stroke=['#EDA33B','#3D63DB','#30A46C','#E0543C'][i%4];
   svg.append(base,beam);return [base,beam];
 });
 function draw(){
   const cx=width/2,cy=height/2;
   nodes.forEach((node,i)=>{
     const distance=((angle/(Math.PI*2)+i/nodes.length)%1)*orbitLength;
     let low=0,high=orbit.length-1;
     while(low<high){const mid=(low+high)>>1;if(orbit[mid].distance<distance)low=mid+1;else high=mid;}
     const next=orbit[low],prev=orbit[Math.max(0,low-1)];
     const t=prev.t+(next.t-prev.t)*(distance-prev.distance)/(next.distance-prev.distance||1);
     const x=cx+Math.cos(t)*rx,y=cy+Math.sin(t)*ry;
     node.style.left=x+'px';node.style.top=y+'px';
     const dx=x-cx,dy=y-cy;
     const d=`M ${x} ${y} Q ${cx+dx*.4-dy*.18} ${cy+dy*.4+dx*.18} ${cx} ${cy}`;
     paths[i].forEach(p=>p.setAttribute('d',d));
   });
 }
 function measure(){
   width=root.clientWidth;height=root.clientHeight;
   const cardWidth=nodes[0].offsetWidth,cardHeight=nodes[0].offsetHeight;
   rx=Math.min(width*.38,(width-cardWidth)/2-6);ry=height*.40;
   orbit=[{t:0,distance:0}];orbitLength=0;
   // Equal visual spacing accounts for card dimensions, including narrow phones.
   for(let i=1;i<=720;i++){
     const t=i*Math.PI*2/720,previous=(i-1)*Math.PI*2/720;
     orbitLength+=Math.hypot((Math.cos(t)-Math.cos(previous))*rx/(cardWidth+12),(Math.sin(t)-Math.sin(previous))*ry/(cardHeight+12));
     orbit.push({t,distance:orbitLength});
   }
   svg.setAttribute('viewBox',`0 0 ${width} ${height}`);draw();
 }
 function tick(t){frame=0;if(!visible||paused||document.hidden)return;angle+=(last?Math.min(t-last,50):0)*Math.PI*2/110000;last=t;draw();frame=requestAnimationFrame(tick);}
 function sync(){cancelAnimationFrame(frame);frame=0;last=0;root.classList.toggle('beam-paused',paused||!visible||document.hidden);toggle.textContent=paused?'Reproduzir animação':'Pausar animação';toggle.setAttribute('aria-pressed',String(paused));if(visible&&!paused&&!document.hidden)frame=requestAnimationFrame(tick);}
 toggle.addEventListener('click',()=>{paused=!paused;sync();});
 reduced.addEventListener('change',()=>{paused=reduced.matches;sync();});
 new ResizeObserver(measure).observe(root);
 new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();},{threshold:.05}).observe(root);
 document.addEventListener('visibilitychange',sync);measure();sync();
 });
})();
