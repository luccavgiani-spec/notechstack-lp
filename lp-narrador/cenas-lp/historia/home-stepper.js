(function(){
  'use strict';
  const root=document.querySelector('.home-stepper');
  if(!root)return;
  const tabs=Array.from(root.querySelectorAll('[role="tab"]'));
  function select(tab){
    root.style.setProperty("--step-progress",(tabs.indexOf(tab)*50)+"%");
    tabs.forEach(item=>{
      const active=item===tab;
      item.setAttribute('aria-selected',String(active));
      item.tabIndex=active?0:-1;
      document.getElementById(item.getAttribute('aria-controls')).hidden=!active;
    });
  }
  tabs.forEach((tab,index)=>{
    tab.addEventListener('click',()=>select(tab));
    tab.addEventListener('keydown',event=>{
      let next;
      if(event.key==='ArrowRight')next=(index+1)%tabs.length;
      if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;
      if(event.key==='Home')next=0;
      if(event.key==='End')next=tabs.length-1;
      if(next===undefined)return;
      event.preventDefault();select(tabs[next]);tabs[next].focus();
    });
  });
})();
