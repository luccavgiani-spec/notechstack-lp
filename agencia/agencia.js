(function(){
  'use strict';
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initSmoothCursor(){
    if(reduce||!window.matchMedia('(hover:hover) and (pointer:fine)').matches)return;
    var cursor=document.createElement('div');
    cursor.className='magic-smooth-cursor';
    cursor.setAttribute('aria-hidden','true');
    cursor.innerHTML='<svg viewBox="0 0 32 32" focusable="false"><path d="M3.5 2.5 5.4 25l5.5-5.7 5.1 9 4.2-2.4-5.1-8.9 8.2-1.1z"/><circle cx="5" cy="4" r="2.2"/></svg>';
    document.body.appendChild(cursor);
    document.documentElement.classList.add('has-smooth-cursor');

    var x=0,y=0,targetX=0,targetY=0,vx=0,vy=0,angle=0,targetAngle=0,last=performance.now(),started=false,frame=0;
    function animate(now){
      var dt=Math.min((now-last)/1000,.032);last=now;
      var stiffness=400,damping=45;
      vx+=((targetX-x)*stiffness-vx*damping)*dt;
      vy+=((targetY-y)*stiffness-vy*damping)*dt;
      x+=vx*dt;y+=vy*dt;
      angle+=(targetAngle-angle)*Math.min(1,dt*13);
      targetAngle*=.9;
      cursor.style.transform='translate3d('+(x-4).toFixed(2)+'px,'+(y-4).toFixed(2)+'px,0) rotate('+angle.toFixed(2)+'deg)';
      frame=requestAnimationFrame(animate);
    }
    function onMove(event){
      var dx=event.clientX-targetX,dy=event.clientY-targetY;
      targetX=event.clientX;targetY=event.clientY;
      if(!started){x=targetX;y=targetY;started=true;last=performance.now();frame=requestAnimationFrame(animate);}
      if(Math.abs(dx)+Math.abs(dy)>1)targetAngle=Math.max(-14,Math.min(14,dx*.65));
      cursor.classList.add('is-visible');
    }
    function onOver(event){
      var textField=event.target.closest&&event.target.closest('input,textarea,select,[contenteditable="true"]');
      cursor.classList.toggle('is-visible',!textField);
    }
    document.addEventListener('pointermove',onMove,{passive:true});
    document.addEventListener('pointerover',onOver,{passive:true});
    document.addEventListener('pointerleave',function(){cursor.classList.remove('is-visible');},{passive:true});
    window.addEventListener('pagehide',function(){if(frame)cancelAnimationFrame(frame);},{once:true});
  }
  initSmoothCursor();

  var video=document.querySelector('.agency-hero-video');
  if(video)window.addEventListener('load',function(){video.play().catch(function(){});},{once:true});

  var agencyDemoVideo=document.querySelector('.agency-video-player');
  if(agencyDemoVideo){
    function keepAgencyDemoPlaying(){agencyDemoVideo.muted=true;if(agencyDemoVideo.paused)agencyDemoVideo.play().catch(function(){});}
    if(agencyDemoVideo.readyState>=2)keepAgencyDemoPlaying();
    else agencyDemoVideo.addEventListener('loadeddata',keepAgencyDemoPlaying,{once:true});
    window.addEventListener('load',keepAgencyDemoPlaying,{once:true});
    document.addEventListener('visibilitychange',function(){if(!document.hidden)keepAgencyDemoPlaying();});
  }

  var agencyKanban=document.querySelector('#v8Crono');
  if(agencyKanban){
    var kanbanItems=[
      ['Cadastro e login','fundação','V1',3],['Perfil da usuária','fundação','V1',5],['Visual da marca aplicado','fundação','V1',7],
      ['Feed de encontros','produto','V1',10],['Chat entre membros','produto','V1',12],['Assinatura mensal','produto','V1',15],
      ['Ajustes do editor','validação','V2',18],['Convite por link','produto','V2',20],['Notificações','produto','V2',22],
      ['Painel de eventos','produto','V3',25],['Testes com usuárias','validação','V3',27],['Publicação nas lojas','entrega','V3',29]
    ];
    var kanbanColumns={};
    agencyKanban.querySelectorAll('.v8-kb-col').forEach(function(column){kanbanColumns[column.dataset.col]=column;});
    var kanbanCards=kanbanItems.map(function(item){
      var card=document.createElement('article');card.className='v8-kb-card';
      var title=document.createElement('h5');title.textContent=item[0];
      var meta=document.createElement('p');meta.textContent=item[1]+' · '+item[2]+' · dia '+item[3];
      card.append(title,meta);return{node:card,day:item[3],column:''};
    });
    var totalNode=agencyKanban.querySelector('#v8KbTotal');if(totalNode)totalNode.textContent=String(kanbanCards.length);
    function kanbanTarget(day,planned){return planned<=day?'concluido':planned-day<=3?'em_andamento':'a_fazer';}
    function renderAgencyKanban(day,animate){
      kanbanCards.forEach(function(card){
        var target=kanbanTarget(day,card.day),list=kanbanColumns[target].querySelector('.v8-kb-lista');
        if(card.column!==target){if(animate&&card.column){card.node.classList.remove('movendo');void card.node.offsetWidth;card.node.classList.add('movendo');setTimeout(function(){card.node.classList.remove('movendo');},1100);}card.column=target;card.node.classList.toggle('feito',target==='concluido');card.node.classList.toggle('andando',target==='em_andamento');if(target==='concluido')list.prepend(card.node);else list.append(card.node);}
      });
      Object.keys(kanbanColumns).forEach(function(key){var cards=Array.from(kanbanColumns[key].querySelectorAll('.v8-kb-card'));cards.forEach(function(card,index){card.hidden=(key==='a_fazer'&&index>2)||(key==='concluido'&&index>3);});kanbanColumns[key].querySelector('header span').textContent=String(kanbanCards.filter(function(card){return card.column===key;}).length);});
      var finished=kanbanCards.filter(function(card){return card.column==='concluido';}).length,active=kanbanCards.filter(function(card){return card.column==='em_andamento';}).length;
      agencyKanban.querySelector('#v8KbDia').textContent='dia '+day;agencyKanban.querySelector('#v8KbSemana').textContent='semana '+Math.min(4,Math.ceil(day/7.5));agencyKanban.querySelector('#v8KbFeitos').textContent=String(finished);agencyKanban.querySelector('#v8KbPct').textContent=String(Math.round(finished/kanbanCards.length*100));agencyKanban.querySelector('#v8KbBarraF').style.width=(finished/kanbanCards.length*100)+'%';agencyKanban.querySelector('#v8KbBarraA').style.width=(active/kanbanCards.length*100)+'%';
    }
    var kanbanDay=reduce?18:1,kanbanTimer=0;renderAgencyKanban(kanbanDay,false);
    if(!reduce&&'IntersectionObserver' in window){
      var kanbanObserver=new IntersectionObserver(function(entries){if(entries[0].isIntersecting&&!kanbanTimer){kanbanTimer=window.setInterval(function(){kanbanDay=kanbanDay>=30?1:kanbanDay+1;if(kanbanDay===1)kanbanCards.forEach(function(card){card.column='';});renderAgencyKanban(kanbanDay,true);},1050);}else if(!entries[0].isIntersecting&&kanbanTimer){clearInterval(kanbanTimer);kanbanTimer=0;}},{threshold:.28});
      kanbanObserver.observe(agencyKanban);
    }
  }

  var reveals=document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window&&!reduce){
    var revealObserver=new IntersectionObserver(function(entries,observer){entries.forEach(function(entry){if(!entry.isIntersecting)return;entry.target.classList.add('visible');observer.unobserve(entry.target);});},{rootMargin:'0px 0px -8% 0px',threshold:.08});
    reveals.forEach(function(node){revealObserver.observe(node);});
  }else reveals.forEach(function(node){node.classList.add('visible');});

  var processFlow=document.querySelector('.agency-process-steps');
  if(processFlow){
    var processSteps=Array.from(processFlow.children);
    var processSection=processFlow.closest('.agency-process');
    var processScheduled=false;
    function renderProcessStep(current,complete){
      processSteps.forEach(function(step,index){
        step.classList.toggle('is-active',index<=current);
        step.classList.toggle('is-past',index<current);
        step.classList.toggle('is-current',index===current);
      });
      processFlow.classList.toggle('is-complete',complete);
    }
    function updateProcessProgress(){
      processScheduled=false;
      var desktop=window.matchMedia('(min-width:769px)').matches;
      var progress=0,current=-1,complete=false;
      if(reduce){progress=1;current=processSteps.length-1;complete=true;}
      else if(desktop){
        var sectionRect=processSection.getBoundingClientRect();
        var scrollRange=Math.max(1,processSection.offsetHeight-window.innerHeight);
        if(sectionRect.top<=0){
          progress=Math.min(1,Math.max(0,-sectionRect.top/scrollRange));
          current=Math.min(processSteps.length-1,Math.floor(progress*processSteps.length));
          complete=progress>=.995;
        }
      }else{
        var sectionTop=processSection.getBoundingClientRect().top+window.scrollY;
        var startY=sectionTop-window.innerHeight*.42;
        var stepTravel=Math.max(320,window.innerHeight*.58);
        var raw=(window.scrollY-startY)/stepTravel;
        if(raw>=0){
          current=Math.min(processSteps.length-1,Math.floor(raw));
          progress=Math.min(1,Math.max(0,raw/processSteps.length));
          complete=raw>=processSteps.length-.05;
        }
      }
      processFlow.style.setProperty('--flow-progress',progress.toFixed(3));
      renderProcessStep(current,complete);
    }
    function scheduleProcessProgress(){if(!processScheduled){processScheduled=true;requestAnimationFrame(updateProcessProgress);}}
    updateProcessProgress();
    window.addEventListener('scroll',scheduleProcessProgress,{passive:true});
    window.addEventListener('resize',scheduleProcessProgress,{passive:true});
  }

  function countNumbers(root){
    root.querySelectorAll('[data-count]').forEach(function(node){
      var target=Number(node.getAttribute('data-count'))||0;
      if(reduce){node.textContent=target;return;}
      var start=performance.now(),duration=1200;
      function tick(now){var p=Math.min((now-start)/duration,1),e=1-Math.pow(1-p,3);node.textContent=Math.round(target*e);if(p<1)requestAnimationFrame(tick);}
      requestAnimationFrame(tick);
    });
  }
  var ticket=document.querySelector('[data-ticket-card]');
  if(ticket&&'IntersectionObserver' in window){
    var ticketObserver=new IntersectionObserver(function(entries,observer){if(!entries[0].isIntersecting)return;ticket.classList.add('is-visible');countNumbers(ticket);observer.disconnect();},{threshold:.35});
    ticketObserver.observe(ticket);
  }else if(ticket){ticket.classList.add('is-visible');countNumbers(ticket);}

  document.querySelectorAll('[data-service-flip]').forEach(function(card){
    function toggleCard(){
      var flipped=!card.classList.contains('is-flipped');
      card.classList.toggle('is-flipped',flipped);
      card.setAttribute('aria-expanded',String(flipped));
    }
    card.addEventListener('click',toggleCard);
    card.addEventListener('keydown',function(event){
      if(event.key!=='Enter'&&event.key!==' ')return;
      event.preventDefault();toggleCard();
    });
  });

  if(ticket){
    var chartModes={
      project:{values:[3500,7800,14900],max:20000,axis:[20000,15000,10000,5000,0]},
      accumulated:{values:[3500,11300,26200],max:30000,axis:[30000,22500,15000,7500,0]},
      annual:{values:[42000,93600,178800],max:200000,axis:[200000,150000,100000,50000,0]}
    };
    var categoryNames=['Landing page','Sites e plataformas','Sites e agentes de IA'];
    var chartBars=Array.from(ticket.querySelectorAll('.agency-bar'));
    var chartTabs=Array.from(ticket.querySelectorAll('[data-chart-mode]'));
    var axisLabels=Array.from(ticket.querySelectorAll('.agency-chart-y span'));
    var deltaValue=ticket.querySelector('[data-ticket-delta]');
    var deltaLabel=ticket.querySelector('[data-ticket-delta-label]');
    var activeIndex=2;
    var activeMode='project';

    function money(value){return 'R$ '+Math.round(value).toLocaleString('pt-BR');}
    function selectCategory(index){
      activeIndex=index;
      chartBars.forEach(function(bar,i){var selected=i===index;bar.classList.toggle('is-active',selected);bar.setAttribute('aria-pressed',String(selected));});
      var values=chartModes[activeMode].values;
      var increase=index===0?0:Math.round((values[index]/values[0]-1)*100);
      deltaValue.textContent=index===0?money(values[0]):'+'+increase+'%';
      deltaLabel.textContent=index===0?'ticket inicial':'vs. landing page';
    }
    function setMode(mode){
      activeMode=mode;
      var data=chartModes[mode];
      chartTabs.forEach(function(tab){tab.setAttribute('aria-selected',String(tab.getAttribute('data-chart-mode')===mode));});
      axisLabels.forEach(function(label,index){label.textContent=money(data.axis[index]);});
      chartBars.forEach(function(bar,index){
        var height=Math.max(5,data.values[index]/data.max*100);
        bar.style.setProperty('--bar-value',height.toFixed(2)+'%');
        bar.querySelector('.agency-bar-value').textContent=money(data.values[index]);
        bar.setAttribute('aria-label',categoryNames[index]+', '+money(data.values[index]));
      });
      selectCategory(activeIndex);
    }
    chartBars.forEach(function(bar){
      var index=Number(bar.getAttribute('data-chart-index'));
      bar.addEventListener('click',function(){selectCategory(index);});
      bar.addEventListener('mouseenter',function(){selectCategory(index);});
    });
    chartTabs.forEach(function(tab){tab.addEventListener('click',function(){setMode(tab.getAttribute('data-chart-mode'));});});
    setMode('project');
  }

  document.querySelectorAll('.agency-nav-pills a').forEach(function(link){
    link.addEventListener('mouseenter',function(){
      if(reduce)return;
      for(var i=0;i<10;i+=1){var dot=document.createElement('i'),angle=Math.PI*2*i/10,distance=22+Math.random()*22;dot.className='gooey-dot';dot.style.setProperty('--x',Math.cos(angle)*distance+'px');dot.style.setProperty('--y',Math.sin(angle)*distance+'px');link.appendChild(dot);setTimeout(function(node){node.remove();},620,dot);}
    });
  });

  if(!reduce&&window.matchMedia('(pointer:fine)').matches){
    document.querySelectorAll('.magnetic').forEach(function(node){
      node.addEventListener('mousemove',function(event){var r=node.getBoundingClientRect();node.style.transform='translate3d('+((event.clientX-r.left-r.width/2)/9)+'px,'+((event.clientY-r.top-r.height/2)/9)+'px,0)';});
      node.addEventListener('mouseleave',function(){node.style.transform='';});
    });
  }

  document.querySelectorAll('[data-track]').forEach(function(node){node.addEventListener('click',function(){if(window.track)window.track('agencia_cta',{origem:node.getAttribute('data-track'),etapa:1});});});
  var phone=document.getElementById('ag-phone');
  if(phone)phone.addEventListener('input',function(){var v=phone.value.replace(/\D/g,'').slice(0,11);if(v.length>6)v='('+v.slice(0,2)+') '+v.slice(2,7)+'-'+v.slice(7);else if(v.length>2)v='('+v.slice(0,2)+') '+v.slice(2);else if(v.length)v='('+v;phone.value=v;});

  var form=document.getElementById('agencyLeadForm');
  if(form)form.addEventListener('submit',async function(event){
    event.preventDefault();if(!form.checkValidity()){form.reportValidity();return;}
    var submit=document.getElementById('ag-submit');
    var interests=Array.from(form.querySelectorAll('input[name="interesses"]:checked')).map(function(input){return input.nextElementSibling.textContent.trim();});
    submit.disabled=true;submit.firstElementChild.textContent='Enviando...';
    try{
      var response=await fetch('https://sdeowbqmwkwseyktyemn.supabase.co/functions/v1/send-lead-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nome:document.getElementById('ag-name').value.trim(),email:document.getElementById('ag-email').value.trim(),whatsapp:document.getElementById('ag-phone').value.trim(),contexto:'nó.agência — landing page | agência: '+document.getElementById('ag-company').value.trim()+' | cargo: '+document.getElementById('ag-role').value.trim()+' | instagram: '+document.getElementById('ag-instagram').value.trim(),objetivos:interests.join(', ')||'Parceria com agência',investimento:'',prazo:'',aiAnalysis:document.getElementById('ag-message').value.trim()})});
      var result=await response.json();
      if(!response.ok||!result.success||!(result.saved||result.emailSent))throw new Error('Falha ao enviar contato');
      if(window.track)window.track('agencia_lead_enviado',{etapa:5,interesses:interests.join('|')},'agencia_form');
      form.hidden=true;document.getElementById('formSuccess').hidden=false;
    }catch(error){submit.disabled=false;submit.firstElementChild.textContent='Tentar enviar novamente';window.alert('Não conseguimos enviar agora. Tente novamente ou fale com a nó pelo WhatsApp no rodapé.');}
  });
})();
