(function(){
 document.querySelectorAll('.no-card-nav').forEach(nav=>{
  nav.querySelector('.no-card-grid').innerHTML="<div class=\"no-card\"><b>Home</b><div><a href=\"/\">Conheça a Nó</a><a href=\"/#como-funciona\">Como funciona</a><a href=\"/#clientes\">Nossos clientes</a></div></div><div class=\"no-card\"><b>Agência</b><div><a href=\"/agencia/#solucoes\">Soluções</a><a href=\"/agencia/#como-funciona\">Como funciona</a><a href=\"/agencia/#organizacao\">Organização</a><a href=\"/agencia/#acompanhamento\">Acompanhamento</a><a href=\"/agencia/#empresas\">Empresas</a></div></div><div class=\"no-card\"><b>Contato</b><div><a href=\"/contato/\">Conte sua ideia</a><a href=\"/agencia/#contato\">Parceria com agências</a></div></div>";
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
