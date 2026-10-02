/* Compatibilidade para páginas antigas: o único efeito de cursor é o compartilhado. */
(function(){
  document.querySelectorAll('#cur,#curR,.cursor,.cursor-ring').forEach(el=>el.remove());
  if(!document.querySelector('link[href*="/shared/smooth-cursor.css"]')){
    const css=document.createElement('link');css.rel='stylesheet';css.href='/shared/smooth-cursor.css?v=1';document.head.append(css);
  }
  if(!window.noSmoothCursor){const script=document.createElement('script');script.src='/shared/smooth-cursor.js?v=1';document.body.append(script);}
})();
