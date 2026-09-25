/* ══════════════════════════════════════════════════════════════════════
   Base da home v8 — o que a página usa do antigo /main.js.
   O main.js (2,3 MB: um vídeo e ícones em base64, chat, hub, FAQ e
   formulário da home de 2025) continua servindo as páginas antigas, mas a
   home carregava ele inteiro para usar só estes três trechos. Os ícones que
   eram base64 viraram arquivos em /assets/ferramentas/.
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  /* ferramentas da galeria "Seu sistema conversa com o que você já usa"
     (v8.js lê window.PLATS e divide em duas linhas) */
  window.PLATS = [
    { n:'Lovable', url:'/assets/ferramentas/lovable.png' },
    { n:'Supabase', url:'https://cdn.simpleicons.org/supabase/3ECF8E' },
    { n:'n8n', url:'https://cdn.simpleicons.org/n8n/EA4B35' },
    { n:'Make', url:'https://cdn.simpleicons.org/make/6D00CC' },
    { n:'GitHub', url:'https://cdn.simpleicons.org/github/24292F' },
    { n:'Vercel', url:'https://cdn.simpleicons.org/vercel/000000' },
    { n:'Canva', url:'/assets/ferramentas/canva.png' },
    { n:'Stripe', url:'https://cdn.simpleicons.org/stripe/635BFF' },
    { n:'Mercado Pago', url:'https://cdn.simpleicons.org/mercadopago/00B1EA' },
    { n:'WhatsApp', url:'https://cdn.simpleicons.org/whatsapp/25D366' },
    { n:'Meta', url:'https://cdn.simpleicons.org/meta/0866FF' },
    { n:'Google Ads', url:'https://cdn.simpleicons.org/googleads/4285F4' },
    { n:'OpenAI', url:'/assets/ferramentas/openai.png' },
    { n:'Claude AI', url:'https://cdn.simpleicons.org/anthropic/CC785C' },
    { n:'Midjourney', url:'/assets/ferramentas/midjourney.png' },
    { n:'Google Drive', url:'https://cdn.simpleicons.org/googledrive/4285F4' },
    { n:'Google Agenda', url:'https://cdn.simpleicons.org/googlecalendar/4285F4' },
    { n:'Trello', url:'https://cdn.simpleicons.org/trello/0079BF' },
    { n:'Monday', url:'/assets/ferramentas/monday.png' },
    { n:'Manychat', url:'/assets/ferramentas/manychat.png' },
    { n:'Kommo', url:'/assets/ferramentas/kommo.png' },
    { n:'RD Station', url:'https://www.rdstation.com/favicon.ico' },
    { n:'Hotmart', url:'/assets/ferramentas/hotmart.png' },
    { n:'HubSpot', url:'https://cdn.simpleicons.org/hubspot/FF7A59' },
    { n:'Typeform', url:'https://cdn.simpleicons.org/typeform/262627' },
    { n:'Zapier', url:'https://cdn.simpleicons.org/zapier/FF4A00' },
    { n:'WordPress', url:'https://cdn.simpleicons.org/wordpress/21759B' },
    { n:'Shopify', url:'https://cdn.simpleicons.org/shopify/96BF48' },
    { n:'ActiveCampaign', url:'/assets/ferramentas/activecampaign.png' },
    { n:'Notion', url:'https://cdn.simpleicons.org/notion/000000' },
    { n:'Slack', url:'/assets/ferramentas/slack.png' },
    { n:'Figma', url:'https://cdn.simpleicons.org/figma/F24E1E' }
  ];

  /* reveal: .reveal ganha .visible ao entrar na tela */
  if ('IntersectionObserver' in window){
    var obs = new IntersectionObserver(function(es){
      es.forEach(function(e){ if (e.isIntersecting){ e.target.classList.add('visible'); obs.unobserve(e.target); } });
    }, { threshold:.08 });
    document.querySelectorAll('.reveal').forEach(function(el){ obs.observe(el); });
  } else {
    document.querySelectorAll('.reveal').forEach(function(el){ el.classList.add('visible'); });
  }

  /* rolagem suave nas âncoras da própria página */
  window.goTo = function(id){
    var el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior:'smooth' });
  };
  document.addEventListener('click', function(e){
    /* defaultPrevented: o CTA do diagnóstico já rolou (onclick → abrirDiagnostico
       centraliza o formulário); rolar de novo aqui desfaria isso */
    if (e.defaultPrevented) return;
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href').length < 2) return;
    var alvo = document.querySelector(a.getAttribute('href'));
    if (!alvo) return;
    e.preventDefault();
    alvo.scrollIntoView({ behavior:'smooth' });
  });
})();
