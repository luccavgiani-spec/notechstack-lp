(function(){
 document.querySelectorAll('.no-card-nav').forEach(nav=>{
  const button=nav.querySelector('.no-card-toggle'),panel=nav.querySelector('.no-card-panel');
  function set(open){nav.classList.toggle('is-open',open);button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'Fechar menu':'Abrir menu');panel.inert=!open;panel.setAttribute('aria-hidden',String(!open));}
  button.addEventListener('click',()=>set(button.getAttribute('aria-expanded')!=='true'));
  nav.addEventListener('keydown',e=>{if(e.key==='Escape'){set(false);button.focus();}});
  nav.addEventListener('focusout',e=>{if(!nav.contains(e.relatedTarget))set(false);});
  nav.addEventListener('click',e=>{if(e.target.closest('a'))set(false);});
  document.addEventListener('click',e=>{if(!nav.contains(e.target))set(false);});
  set(false);
 });
})();
