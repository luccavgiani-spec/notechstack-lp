/* =====================================================================
   logo-opcoes.js — comparador de identidade visual (fase de aprovação)
   ---------------------------------------------------------------------
   Troca, ao vivo e sem recarregar a página, a marca da Gazeta entre
   a versão atual, as variações da marca atual e as quatro propostas.

   Quem aciona:
     1. querystring  ?logo=1..7        (link direto para uma opção)
     2. sessionStorage                 (mantém a opção ao navegar no site)
     3. postMessage {tipo:'gb-logo'}   (a página aprovacao.html, no iframe)

   Sem nenhum desses, o arquivo não faz nada e o site fica como está.
   É uma camada de demonstração: nada aqui entra no site definitivo.
   ===================================================================== */
(function () {
  'use strict';

  var TOTAL = 7;
  var CHAVE = 'gb-logo-opcao';
  var originais = null;

  /* Só as marcas da própria Gazeta. Os selos de GB Norte e do Sindicato
     são marcas de terceiros e não entram na troca. */
  function marcas() {
    return Array.prototype.slice.call(
      document.querySelectorAll('img[src*="logo-gazeta"], img[data-logo-original]')
    );
  }

  function guardaOriginais() {
    if (originais) return;
    originais = marcas().map(function (img) {
      img.setAttribute('data-logo-original', img.getAttribute('src'));
      return img;
    });
  }

  function injetaCss() {
    if (document.getElementById('gb-logo-css')) return;
    var s = document.createElement('style');
    s.id = 'gb-logo-css';
    s.textContent = [
      'img.gb-logo{width:auto!important;max-width:100%;object-fit:contain}',
      '.masthead__logo.gb-logo{height:clamp(56px,7.5vw,92px)}',
      '.masthead--interna .masthead__logo.gb-logo{height:44px}',
      '.nav-editorias__logo img.gb-logo{height:34px}',
      '.barra-mobile__logo img.gb-logo{height:34px}',
      /* painel da redação — herda a opção pelo sessionStorage */
      '.sidebar__logo img.gb-logo{height:34px}',
      '.login__logo.gb-logo{height:46px;display:block;margin-inline:auto}',
      /* no rodapé escuro a marca é azul-marinho: vai sobre um selo branco */
      'img.gb-logo--escuro{height:64px;background:#fff;padding:10px 16px;',
      'border-radius:10px;box-sizing:content-box}',
      /* opção 7 é o letreiro "Gazeta Bragantina": horizontal e preto.
         Baixa a altura para não estourar a largura e, no rodapé escuro,
         vira branco em vez de ganhar selo */
      'html[data-logo-opcao="7"] .masthead__logo.gb-logo{height:clamp(34px,4.6vw,62px)}',
      'html[data-logo-opcao="7"] .masthead--interna .masthead__logo.gb-logo{height:30px}',
      'html[data-logo-opcao="7"] .nav-editorias__logo img.gb-logo,',
      'html[data-logo-opcao="7"] .barra-mobile__logo img.gb-logo,',
      'html[data-logo-opcao="7"] .sidebar__logo img.gb-logo{height:22px}',
      'html[data-logo-opcao="7"] .login__logo.gb-logo{height:34px}',
      'html[data-logo-opcao="7"] img.gb-logo--escuro{height:44px;background:none;padding:0;filter:invert(1)}'
    ].join('');
    document.head.appendChild(s);
  }

  function aplica(n) {
    guardaOriginais();
    injetaCss();

    originais.forEach(function (img) {
      var original = img.getAttribute('data-logo-original') || '';
      var base = original.slice(0, original.lastIndexOf('assets/'));

      if (!n) {                          // 0 = volta para a marca atual
        img.setAttribute('src', original);
        img.setAttribute('alt', 'Gazeta Bragantina');
        img.classList.remove('gb-logo', 'gb-logo--escuro');
        img.removeAttribute('style');
        return;
      }

      img.setAttribute('src', base + 'assets/img/logo-opcao-' + n + '.png');
      img.setAttribute('alt', 'GB News — opção ' + n);
      img.removeAttribute('width');
      img.removeAttribute('height');
      img.classList.add('gb-logo');
      // a versão "branco" é a que fica sobre fundo escuro (rodapé)
      img.classList.toggle('gb-logo--escuro', /branco/.test(original));
    });

    try { sessionStorage.setItem(CHAVE, String(n)); } catch (e) {}
    document.documentElement.setAttribute('data-logo-opcao', String(n));
  }

  function normaliza(v) {
    var n = parseInt(v, 10);
    return (n >= 1 && n <= TOTAL) ? n : 0;
  }

  function inicia() {
    var daUrl = new URLSearchParams(location.search).get('logo');
    var guardado = null;
    try { guardado = sessionStorage.getItem(CHAVE); } catch (e) {}
    var n = normaliza(daUrl !== null ? daUrl : guardado);
    if (n) aplica(n);
  }

  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || d.tipo !== 'gb-logo') return;
    aplica(normaliza(d.opcao));
  });

  // exposto para depuração manual no console
  window.gbLogo = aplica;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicia);
  } else {
    inicia();
  }
})();
