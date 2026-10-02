/* ══════════════════════════════════════════════════════════════════════
   LP v8 · galerias curvas, fluxograma, demonstração do app e cronograma.
   Regra das demos (igual ao historia.js): só rodam em quadro e com a aba
   visível; qualquer toque do visitante tira a encenação da frente.
   Movimento reduzido → estado final estático.
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  const REDUZ = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const espera = ms => new Promise(r => setTimeout(r, ms));


  function near(selector, init){
    const el=$(selector); if(!el) return;
    if(!('IntersectionObserver' in window)){init();return;}
    const io=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){io.disconnect();init();}},{rootMargin:'400px 0px'});
    io.observe(el);
  }

  function emQuadro(el, fn, limiar){
    let sinal = null, visivel = false;
    const liga = on => {
      if (on && !sinal){ sinal = { vivo:true }; fn(sinal); }
      else if (!on && sinal){ sinal.vivo = false; sinal = null; }
    };
    new IntersectionObserver(es => { visivel = es[0].isIntersecting; liga(visivel && !document.hidden); },
      { threshold: limiar == null ? 0.35 : limiar }).observe(el);
    addEventListener('visibilitychange', () => liga(visivel && !document.hidden));
  }
  function Cursor(caixa){
    const c = $('.hs-cursor', caixa);
    return {
      async ir(alvo){
        if (!c || !alvo) return;
        const a = alvo.getBoundingClientRect(), b = caixa.getBoundingClientRect();
        c.classList.add('on');
        c.style.transform = 'translate(' + (a.left - b.left + a.width * .5) + 'px,' + (a.top - b.top + a.height * .55) + 'px)';
        await espera(800);
      },
      async clica(){ if (!c) return; c.classList.remove('clique'); void c.offsetWidth; c.classList.add('clique'); await espera(260); },
      some(){ if (c) c.classList.remove('on', 'clique'); }
    };
  }

  /* fontes da Loiê: só os mockups do app e do editor usam. Entram quando uma
     das duas seções chega a ~1 tela de distância (ver nota no v8.css). */
  (function fontesLoie(){
    const alvos = ['#app', '#editor'].map(s => $(s)).filter(Boolean);
    if (!alvos.length || !('FontFace' in window) || !('IntersectionObserver' in window)) return;
    const FONTES = [
      ['LoieWagon', '/lp-narrador/cenas-lp/historia/img/loie/Wagon-ExtraLight.woff2', '200'],
      ['LoieSackers', '/lp-narrador/cenas-lp/historia/img/loie/sackersgothicstd-medium.woff2', '500']
    ];
    const io = new IntersectionObserver(es => {
      if (!es.some(e => e.isIntersecting)) return;
      io.disconnect();
      FONTES.forEach(([familia, url, peso]) => {
        const f = new FontFace(familia, "url('" + url + "') format('woff2')", { weight:peso, display:'swap' });
        document.fonts.add(f); f.load().catch(() => {});
      });
    }, { rootMargin:'1000px 0px' });
    alvos.forEach(a => io.observe(a));
  })();

  /* ─────────────── galeria circular ───────────────
     Os itens correm numa esteira sem fim e, no caminho, descrevem um arco:
     quanto mais longe do centro, mais sobem (ou descem) e mais inclinam. */
  /* Fundo é controlado por marca: branco como padrão, com as duas exceções
     aprovadas (Xocó verde e Palladio preto). */
  const CLIENTES = [
    { n:'Plantão Digital',          url:'/lp-narrador/cenas-lp/historia/logos-clientes/plantao-digital.webp' },
    { n:'Consulta de Casa',         url:'/lp-narrador/cenas-lp/historia/logos-clientes/consulta-de-casa.webp' },
    { n:'SOS Telemedicina',         url:'/lp-narrador/cenas-lp/historia/logos-clientes/sos-telemedicina.webp' },
    { n:'Loiê Sala Aromática',      url:'/lp-narrador/cenas-lp/historia/logos-clientes/loie.webp' },
    { n:'Gazeta Bragantina',        url:'/lp-narrador/cenas-lp/historia/logos-clientes/gazeta-bragantina.webp', largo:true },
    { n:'Maisis Marketing Digital', url:'/lp-narrador/cenas-lp/historia/logos-clientes/maisis-marketing-digital.webp', largo:true },
    { n:'Pesqueiro Xocó',           url:'/lp-narrador/cenas-lp/historia/logos-clientes/pesqueiro-xoco.webp', fundo:'verde', zoom:'xl' },
    { n:'Prontia Saúde',            url:'/lp-narrador/cenas-lp/historia/logos-clientes/prontia-saude.webp', fundo:'prontia', zoom:'lg' },
    { n:'Palladio',                 url:'/lp-narrador/cenas-lp/historia/logos-clientes/palladio.webp', fundo:'preto' }
  ];

  function galeria(el){
    const tipo = el.dataset.galeria;
    let dados;
    if (tipo === 'ferramentas'){
      const todas = typeof PLATS !== 'undefined' ? PLATS : [];
      const meio = Math.ceil(todas.length / 2);
      dados = el.dataset.linha === '1' ? todas.slice(meio) : todas.slice(0, meio);
    } else {
      dados = CLIENTES.length ? CLIENTES : Array.from({ length:8 }, () => ({ vago:true }));
    }
    if (!dados.length) return;
    el.querySelector('.home-clientes-static')?.remove();
    /* repete até cobrir telas largas com folga */
    let itens = dados.slice();
    while (itens.length < 14) itens = itens.concat(dados);
    const nos = itens.map(d => {
      const n = document.createElement('div');
      n.className = 'v8-gi' + (d.vago ? ' vago' : '');
      if (d.vago){ n.textContent = 'logo do cliente'; }
      else {
        if (d.fundo) n.classList.add('fundo-' + d.fundo);
        if (d.largo) n.classList.add('logo-largo');
        if (d.zoom) n.classList.add('logo-zoom-' + d.zoom);
        /* logo de cliente: o nome é o alt (é o único texto do item). Nas
           ferramentas o nome já aparece escrito ao lado, então o ícone é
           decorativo (alt vazio) */
        const rotulo = tipo === 'ferramentas' || !d.url;
        if (d.url){ const im = new Image(); im.src = d.url; im.alt = rotulo ? '' : 'Logo ' + d.n; im.loading = 'lazy'; im.decoding = 'async'; im.draggable = false; n.append(im); }
        if (rotulo){ const s = document.createElement('span'); s.textContent = d.n; n.append(s); }
      }
      el.append(n); return n;
    });
    const curva = Number(el.dataset.curva || 1), sentido = Number(el.dataset.sentido || 1);
    const GAP = 14;
    let larguras = [], total = 0, W = 0, H = 0, R = 1, flecha = 40;
    function mede(){
      W = el.clientWidth; H = el.clientHeight;
      larguras = nos.map(n => n.offsetWidth);
      total = larguras.reduce((s, w) => s + w + GAP, 0);
      flecha = Math.min(H * .28, W < 700 ? 20 : 42);
      R = (W / 2) * (W / 2) / (2 * flecha) + flecha / 2;
    }
    let desloc = 0, vel = 0, arrastando = false, ultimoX = 0, ultimoT = 0, vivo = false;
    const base = REDUZ ? 0 : 38 * sentido;   // px por segundo
    function desenha(){
      let acc = 0;
      for (let i = 0; i < nos.length; i++){
        const w = larguras[i];
        let x = ((acc + desloc) % total + total) % total;   // 0..total
        x = x - total / 2 + w / 2;                            // centraliza a esteira
        acc += w + GAP;
        if (Math.abs(x) > W / 2 + w){ nos[i].style.visibility = 'hidden'; continue; }
        const xs = Math.max(-R + 1, Math.min(R - 1, x));
        const dy = (R - Math.sqrt(R * R - xs * xs)) * curva;
        const ang = Math.asin(xs / R) * 180 / Math.PI * curva;
        nos[i].style.visibility = '';
        nos[i].style.transform = 'translate(' + (x - w / 2) + 'px,' + (dy - nos[i].offsetHeight / 2) + 'px) rotate(' + ang.toFixed(2) + 'deg)';
      }
    }
    let t0 = 0;
    function passo(t){
      if (!vivo){ t0 = 0; return; }
      const dt = t0 ? Math.min(.05, (t - t0) / 1000) : 0; t0 = t;
      if (!arrastando){
        vel += (base - vel) * Math.min(1, dt * 2.2);   // inércia volta à velocidade da esteira
        desloc += vel * dt;
      }
      desenha();
      requestAnimationFrame(passo);
    }
    el.addEventListener('pointerdown', e => {
      arrastando = true; ultimoX = e.clientX; ultimoT = performance.now(); vel = 0;
      el.setPointerCapture(e.pointerId); el.classList.add('arrastando');
    });
    el.addEventListener('pointermove', e => {
      if (!arrastando) return;
      const agora = performance.now(), dx = e.clientX - ultimoX;
      desloc += dx; vel = dx / Math.max(1, agora - ultimoT) * 1000;
      ultimoX = e.clientX; ultimoT = agora;
      if (!vivo) desenha();
    });
    const solta = () => { arrastando = false; el.classList.remove('arrastando'); };
    el.addEventListener('pointerup', solta); el.addEventListener('pointercancel', solta);
    new ResizeObserver(() => { mede(); desenha(); }).observe(el);
    $$('img', el).forEach(im => im.addEventListener('load', () => { mede(); desenha(); }, { once:true }));
    mede(); desenha();
    new IntersectionObserver(es => {
      const on = es[0].isIntersecting;
      if (on && !vivo){ vivo = true; requestAnimationFrame(passo); }
      else if (!on) vivo = false;
    }).observe(el);
  }
  $$('.v8-galeria').forEach(galeria);

  /* ─────────────── fluxograma ───────────────
     O fio liga os círculos numerados. A rolagem preenche o fio; o ponto
     âmbar corre na frente e cada passo acende quando o ponto chega nele. */
  (function fluxo(){
    const box = $('#v8Fluxo'); if (!box) return;
    const svg = $('.v8-fluxo-fio', box), base = $('.v8-fio-base', box), cheio = $('.v8-fio-cheio', box);
    const ponto = $('.v8-fluxo-ponto', box);
    const passos = $$('.v8-passo', box), ns = passos.map(p => $('.v8-n', p));
    let pts = [], comp = 1;
    function mede(){
      const b = box.getBoundingClientRect();
      svg.setAttribute('viewBox', '0 0 ' + b.width + ' ' + b.height);
      pts = ns.map(n => { const r = n.getBoundingClientRect(); return [r.left - b.left + r.width / 2, r.top - b.top + r.height / 2]; });
      if (!pts.length) return;
      const d = 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L');
      base.setAttribute('d', d); cheio.setAttribute('d', d);
      comp = cheio.getTotalLength() || 1;
      cheio.style.strokeDasharray = comp;
      atualiza();
    }
    let tic = false;
    function atualiza(){
      tic = false;
      if (!pts.length) return;
      const b = box.getBoundingClientRect();
      const linha = innerHeight * .62 - b.top;          // até onde a leitura chegou, no referencial da caixa
      const y0 = pts[0][1], y1 = pts[pts.length - 1][1];
      const p = REDUZ ? 1 : Math.max(0, Math.min(1, (linha - y0) / (y1 - y0)));
      cheio.style.strokeDashoffset = comp * (1 - p);
      const pt = cheio.getPointAtLength(comp * p);
      ponto.style.transform = 'translate(' + pt.x + 'px,' + pt.y + 'px)';
      box.classList.toggle('vivo', p > 0 && p < 1);
      passos.forEach((s, i) => s.classList.toggle('on', pts[i][1] <= pt.y + 2));
    }
    addEventListener('scroll', () => { if (!tic){ tic = true; requestAnimationFrame(atualiza); } }, { passive:true });
    new ResizeObserver(mede).observe(box);
    addEventListener('load', mede);
    mede();
  })();


  /* Cartões estáticos; o movimento do ponteiro pertence ao cursor compartilhado. */
  function bento(card, opts){
    if (!card || card.__bento) return; card.__bento = true;
    card.classList.add('v8-bento');
    card.style.setProperty('--g', card.dataset.g || (opts && opts.g) || '237,163,59');
  }
  const COR_G = { azul:'61,99,219', vermelho:'224,84,60', ambar:'237,163,59', verde:'48,164,108' };
  $$('#v8Fluxo .v8-passo').forEach(p => bento($('.v8-card', p), { g: COR_G[p.dataset.cor] }));
  const ctaCinza = $('.v8-cta-cinza');
  if (ctaCinza) bento(ctaCinza, { tilt:false, particulas:8 });


  /* logos das ferramentas por plano (mesma fonte da esteira da v5) */
  const ICONES = {
    vercel:['Vercel','vercel/ffffff'], google:['Google Meu Negócio','google/4285F4'], meta:['Meta Business','meta/0866FF'],
    threedotjs:['Three.js · 3D','threedotjs/ffffff'], whatsapp:['WhatsApp','whatsapp/25D366'], anthropic:['Claude · IA','anthropic/CC785C'],
    supabase:['Supabase · dados','supabase/3ECF8E'], googleads:['Google Ads','googleads/4285F4']
  };

  /* ─────────────── demonstração do app (caso: loja online) ─────────────── */
  near('#v8App', function app(){
    const box = $('#v8App'); if (!box) return;
    const lista = $('#v8AppLista');
    const pans = $$('.v8-app-pan', box), menu = $$('.v8-app-menu li[data-aba]', box);
    const botoes = lista ? $$('button[data-aba]', lista) : [];
    const cur = Cursor(box);
    let demo = true, kanbanRodando = null;
    function aba(n){
      pans.forEach(p => { p.hidden = +p.dataset.pan !== n; });
      menu.forEach(m => m.classList.toggle('on', +m.dataset.aba === n));
      botoes.forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.aba === n)));
      if (n === 2) kanban(demo && !REDUZ);
      else if (kanbanRodando) kanbanRodando.vivo = false;
    }
    function assume(){ if (!demo) return; demo = false; cur.some(); }
    botoes.forEach(b => b.addEventListener('click', () => { assume(); aba(+b.dataset.aba); }));
    menu.forEach(m => {
      m.tabIndex=0; m.setAttribute('role','button');
      m.addEventListener('click', () => { assume(); aba(+m.dataset.aba); });
      m.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' '){e.preventDefault();assume();aba(+m.dataset.aba);} });
    });
    $('.v8-app-lado',box).removeAttribute('aria-hidden');
    box.addEventListener('keydown', assume, true);
    box.addEventListener('pointerdown', e => { if (e.isTrusted) assume(); }, true);

    /* 01 · as três opções — ferramentas de cada uma viram logos */
    $$('.v8-tier-stack', box).forEach(el => {
      el.dataset.stack.split(',').forEach(k => {
        const [nome, slug] = ICONES[k] || [k, ''];
        /* o nome vai no alt da imagem: aria-label num <span> sem papel é
           proibido pelo ARIA e o leitor de tela o ignora */
        const i = document.createElement('span'); i.title = nome;
        if (slug){ const im = new Image(); im.src = 'https://cdn.simpleicons.org/' + slug; im.alt = nome; im.width = im.height = 13; im.loading = 'lazy'; i.append(im); }
        el.append(i);
      });
    });
    const tiers = $$('.v8-tier', box), okTier = $('.v8-app-ok', box);
    tiers.forEach(t => bento(t, { tilt:false, ima:false, particulas:6 }));
    function escolhe(t, abreZap){
      tiers.forEach(x => {
        const sim = x === t, zap = $('.v8-tier-zap', x), bt = $(':scope > button', x);
        x.classList.toggle('escolhido', sim);
        const abre = sim && !!abreZap;
        if (zap) zap.hidden = !abre;
        if (bt) bt.setAttribute('aria-expanded', String(abre));
      });
      okTier.hidden = !t; if (t) $('b', okTier).textContent = $('b', t).textContent;
    }
    tiers.forEach(t => {
      t.addEventListener('click', e => {
        if (e.target.closest('a')) return;
        const bt = e.target.closest('button');
        escolhe(t, (bt && bt.parentElement === t) || !$('.v8-tier-zap', t).hidden);
      });
    });

    /* 02 · protótipo: a loja da Loiê, no celular ou no computador */
    const loie = $('#v8Loie'), telaLoie = $('.v8-loie-tela', loie), pags = $$('.v8-lo-pag', loie);
    const urlLoie = $('.v8-loie-barra em', loie), sacola = $('.v8-lo-sacola', loie), toast = $('.v8-lo-toast', loie);
    const disps = $$('.v8-disp button', box);
    const deviceStage = loie.closest('.no-device-stage');
    function fitDevice(){
      if (!deviceStage || !deviceStage.clientWidth) return;
      const phone = loie.classList.contains('modo-cel');
      const width = phone ? 428 : 740, height = phone ? 868 : 434;
      const maxWidth = phone ? 296 : 1080;
      const scale = Math.min(maxWidth, Math.max(0, deviceStage.clientWidth - 12)) / width;
      loie.style.setProperty('--device-scale', scale);
      deviceStage.style.height = Math.ceil(height * scale) + 'px';
    }
    function pagina(n){
      pags.forEach(p => { p.hidden = p.dataset.pag !== n; });
      telaLoie.scrollTop = 0;
      urlLoie.textContent = n === 'produto' ? '/product/caramelo' : '/';
    }
    function dispositivo(m){
      loie.classList.toggle('modo-cel', m === 'cel'); loie.classList.toggle('modo-pc', m === 'pc');
      loie.classList.toggle('no-device-iphone-14-pro', m === 'cel');
      loie.classList.toggle('no-device-black', m === 'cel');
      loie.classList.toggle('no-device-macbook-pro', m === 'pc');
      disps.forEach(b => {const active=b.dataset.disp === m;b.setAttribute('aria-checked', String(active));b.tabIndex=active?0:-1;});
      fitDevice();
    }
    if(deviceStage){new ResizeObserver(fitDevice).observe(deviceStage);fitDevice();}
    let toastT = null;
    function adiciona(){
      sacola.textContent = String(+sacola.textContent + 1);
      toast.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { toast.hidden = true; }, 2200);
    }
    $$('[data-ir]', loie).forEach(b => b.addEventListener('click', () => pagina(b.dataset.ir)));
    $('.v8-lo-add', loie).addEventListener('click', adiciona);
    disps.forEach(b => b.addEventListener('click', () => dispositivo(b.dataset.disp)));
    disps.forEach((b,index) => b.addEventListener('keydown', event => {
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();
      const next=event.key==='Home'?0:event.key==='End'?disps.length-1:(index+1)%disps.length;
      dispositivo(disps[next].dataset.disp);disps[next].focus();
    }));
    dispositivo('cel');
    function rola(ate, ms){
      return new Promise(res => {
        const de = telaLoie.scrollTop, t0 = performance.now();
        const passo = t => {
          const k = Math.min(1, (t - t0) / ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          telaLoie.scrollTop = de + (ate - de) * e;
          if (k < 1) requestAnimationFrame(passo); else res();
        };
        requestAnimationFrame(passo);
      });
    }
    const topoDe = el => el.getBoundingClientRect().top - telaLoie.getBoundingClientRect().top + telaLoie.scrollTop;

    /* 03 · etapas: cada tarefa é de negócio, frontend ou backend */
    const TIPOS = { negocio:'negócio', frontend:'frontend', backend:'backend' };
    const TAREFAS = [
      ['catálogo e preços definidos', 'negocio', 1, 2], ['página inicial da loja', 'frontend', 1, 2],
      ['conta no Meta Business', 'negocio', 2, 1], ['pagamento por Pix e cartão', 'backend', 2, 1],
      ['página de produto', 'frontend', 2, 0], ['estoque sincronizado', 'backend', 3, 0],
      ['vitrine em 3D', 'frontend', 3, 0], ['agente de chat no WhatsApp', 'backend', 4, 0]
    ];
    const cols = $$('.v8-kcol', box), barra = $('.v8-prog i', box), barraTxt = $('.v8-prog span', box);
    function kanban(animar){
      if (kanbanRodando) kanbanRodando.vivo = false;
      cols.forEach(c => $$('.v8-kcard', c).forEach(k => k.remove()));
      const estado = TAREFAS.map(t => t[3]);   // 0 a fazer · 1 em andamento · 2 concluído
      const cards = TAREFAS.map(([t, tipo, sem]) => {
        const k = document.createElement('div'); k.className = 'v8-kcard'; k.dataset.t = tipo;
        const tag = document.createElement('i'); tag.textContent = TIPOS[tipo];
        const nome = document.createElement('span'); nome.textContent = t;
        const pe = document.createElement('em'); pe.textContent = 'semana ' + sem;
        k.append(tag, nome, pe); return k;
      });
      cards.forEach((k, i) => cols[estado[i]].append(k));
      const prog = () => { const p = Math.round(estado.reduce((s, e) => s + e, 0) / (estado.length * 2) * 100); barra.style.width = p + '%'; barraTxt.textContent = p + '% concluído'; };
      prog();
      function move(i,col){assume();if(kanbanRodando)kanbanRodando.vivo=false;estado[i]=col;cards[i].style.transform='';cols[col].append(cards[i]);prog();}
      cards.forEach((card,i)=>{
        card.draggable=true;card.tabIndex=0;card.setAttribute('role','button');
        card.setAttribute('aria-label',TAREFAS[i][0]+': clique para avançar de coluna');
        card.addEventListener('click',()=>move(i,(estado[i]+1)%3));
        card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();move(i,(estado[i]+1)%3);}});
        card.addEventListener('dragstart',e=>{assume();e.dataTransfer.setData('text/plain',String(i));});
      });
      cols.forEach((col,n)=>{
        col.ondragover=e=>e.preventDefault();
        col.ondrop=e=>{e.preventDefault();const i=Number(e.dataTransfer.getData('text/plain'));if(Number.isInteger(i)&&cards[i])move(i,n);};
      });
      if (!animar) return;
      const sinal = kanbanRodando = { vivo:true };
      (async () => {
        for (const i of [2, 3, 4, 4, 5, 6]){
          await espera(2200); if (!sinal.vivo) return;
          if(!demo || !sinal.vivo)return;
          await cur.ir(cards[i]); if(!demo || !sinal.vivo)return;
          const dest=cols[estado[i]+1], before=cards[i].getBoundingClientRect(), after=dest.getBoundingClientRect();
          cards[i].style.transition='transform 900ms ease';
          cards[i].style.transform='translate('+(after.left-before.left)+'px,'+(after.top+35-before.top)+'px) rotate(-3deg)';
          await cur.ir(dest); await espera(200);
          cards[i].style.transform='';cards[i].style.transition='';
          if(!demo || !sinal.vivo)return;
          estado[i]++; dest.append(cards[i]); prog(); cur.some();
        }
      })();
    }

    aba(0);
    if(!REDUZ) emQuadro(box, async sinal => {
      const ok=()=>sinal.vivo&&demo;
      const tela=$('.v8-app-tela',box);
      while(ok()){
        aba(0); escolhe(null); tela.scrollTop=0;
        for(const tier of tiers){
          if(!ok())break;
          tela.scrollTo({top:tier.getBoundingClientRect().top-tela.getBoundingClientRect().top+tela.scrollTop-40,behavior:'smooth'});
          await cur.ir(tier); await espera(1800);
        }
        if(!ok())break;
        await cur.ir(menu[1]); if(!ok())break;
        aba(1); tela.scrollTop=0; pagina('home'); dispositivo('pc');
        await espera(3200); if(!ok())break;
        await cur.ir(disps[0]); if(!ok())break;
        await cur.clica(); dispositivo('cel');
        await espera(3200); if(!ok())break;
        await cur.ir(menu[2]); if(!ok())break;
        aba(2); tela.scrollTop=0;
        await espera(14000);
      }
      cur.some();
    },.25);

  });

  /* move com FLIP: mede antes, move no DOM, anima a diferença */
  function flip(el, destino, noTopo){
    const antes = el.getBoundingClientRect();
    if (noTopo) destino.prepend(el); else destino.append(el);
    if (REDUZ) return;
    const depois = el.getBoundingClientRect();
    el.style.transition = 'none';
    el.style.transform = 'translate(' + (antes.left - depois.left) + 'px,' + (antes.top - depois.top) + 'px)';
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transition = ''; el.style.transform = ''; }));
  }

  /* ─────────────── editor no Safari ─────────────── */
  near('#v8Editor', function editor(){
    const box = $('#v8Editor'); if (!box) return;
    const els = {}; $$('.v8-el', box).forEach(e => { els[e.dataset.el] = e; });
    const alvos = $$('.v8-ed-alvos button', box), cores = $$('.v8-ed-cores button', box);
    const tam = $('#v8EdTam'), tamOut = $('#v8EdTamOut'), log = $('#v8EdLog'), conta = $('#v8EdConta');
    const enviar = $('#v8EdEnviar'), carimbo = $('#v8EdCarimbo');
    const NOMES = { logo:'logo', texto:'texto', botao:'botão' };
    const COR_NOME = { '#141414':'preto', '#3D63DB':'azul', '#E0543C':'vermelho', '#EDA33B':'âmbar', '#30A46C':'verde', '#B0567E':'rosa' };
    const BASE = { logo:{ tam:100, cor:'#141414' }, texto:{ tam:100, cor:'#141414' }, botao:{ tam:100, cor:'#141414' } };
    let estado, atual = 'logo', ajustes = 0, demo = true;
    const cur = Cursor(box);
    function aplica(k){
      const e = els[k], st = estado[k];
      e.style.setProperty('--k', st.tam / 100);
      if (k === 'botao'){ e.style.background = st.cor; e.style.color = st.cor === '#EDA33B' ? '#141414' : '#fff'; }
      else e.style.color = st.cor;
    }
    function seleciona(k){
      atual = k;
      Object.keys(els).forEach(n => els[n].classList.toggle('sel', n === k));
      alvos.forEach(b => b.setAttribute('aria-checked', String(b.dataset.alvo === k)));
      tam.value = estado[k].tam; tamOut.textContent = estado[k].tam + '%';
      cores.forEach(b => b.setAttribute('aria-checked', String(b.dataset.cor === estado[k].cor)));
    }
    function registra(txt){
      ajustes++; conta.textContent = ajustes;
      const li = document.createElement('li'); li.textContent = txt; log.prepend(li);
      while (log.children.length > 3) log.lastChild.remove();
      enviar.disabled = false; carimbo.hidden = true;
    }
    function mudaTam(v, silencio){
      estado[atual].tam = +v; tam.value = v; tamOut.textContent = v + '%'; aplica(atual);
      if (!silencio) registra(NOMES[atual] + ': tamanho ' + v + '%');
    }
    function mudaCor(c){
      estado[atual].cor = c; aplica(atual);
      cores.forEach(b => b.setAttribute('aria-checked', String(b.dataset.cor === c)));
      registra(NOMES[atual] + ': cor ' + COR_NOME[c]);
    }
    function zera(){
      estado = JSON.parse(JSON.stringify(BASE)); ajustes = 0; conta.textContent = '0'; log.innerHTML = '';
      Object.keys(els).forEach(aplica); seleciona('logo'); enviar.disabled = true; carimbo.hidden = true;
      enviar.textContent = 'enviar ajustes';
    }
    function envia(){
      if (!ajustes) return;
      carimbo.hidden = false; enviar.textContent = '✓ enviado'; enviar.disabled = true;
    }
    function assume(){ if (!demo) return; demo = false; cur.some(); }
    box.addEventListener('pointerdown', e => { if (e.isTrusted) assume(); }, true);
    Object.keys(els).forEach(k => {
      els[k].addEventListener('click', () => seleciona(k));
      els[k].addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); seleciona(k); } });
    });
    alvos.forEach(b => b.addEventListener('click', () => seleciona(b.dataset.alvo)));
    let tamTimer = null;
    tam.addEventListener('input', () => {
      mudaTam(tam.value, true);
      clearTimeout(tamTimer); tamTimer = setTimeout(() => registra(NOMES[atual] + ': tamanho ' + tam.value + '%'), 350);
    });
    cores.forEach(b => b.addEventListener('click', () => mudaCor(b.dataset.cor)));
    enviar.addEventListener('click', envia);
    zera();
    if (REDUZ){ seleciona('botao'); mudaCor('#30A46C'); return; }

    async function arrasta(ate, sinal){
      const de = +tam.value, passos = 10;
      await cur.ir(tam); if (!sinal()) return;
      for (let i = 1; i <= passos && sinal(); i++){ mudaTam(Math.round((de + (ate - de) * i / passos) / 5) * 5, true); await espera(55); }
      registra(NOMES[atual] + ': tamanho ' + ate + '%');
    }
    emQuadro(box, async sinal => {
      const ok = () => sinal.vivo && demo;
      while (ok()){
        zera();
        await espera(900); if (!ok()) break;
        await cur.ir(els.logo); if (!ok()) break;
        await cur.clica(); seleciona('logo');
        await cur.ir(cores[3]); if (!ok()) break;
        await cur.clica(); mudaCor('#EDA33B');
        await arrasta(130, ok); if (!ok()) break;
        await espera(500);
        await cur.ir(els.texto); if (!ok()) break;
        await cur.clica(); seleciona('texto');
        await arrasta(120, ok); if (!ok()) break;
        await cur.ir(cores[5]); if (!ok()) break;
        await cur.clica(); mudaCor('#B0567E');
        await espera(500);
        await cur.ir(els.botao); if (!ok()) break;
        await cur.clica(); seleciona('botao');
        await cur.ir(cores[4]); if (!ok()) break;
        await cur.clica(); mudaCor('#30A46C');
        await arrasta(125, ok); if (!ok()) break;
        await espera(600);
        await cur.ir(enviar); if (!ok()) break;
        await cur.clica(); envia(); cur.some();
        await espera(3800);
      }
      cur.some();
    }, .35);
  });

  /* ─────────────── cronograma: réplica do quadro de etapas do app ─────────────── */
  near('#v8Crono', function crono(){
    const box = $('#v8Crono'); if (!box) return;
    /* [título, fase, versão, dia planejado] — projeto fictício */
    const ITENS = [
      ['Cadastro e login', 'fundação', 'V1', 3], ['Perfil da usuária', 'fundação', 'V1', 5], ['Visual da marca aplicado', 'fundação', 'V1', 7],
      ['Feed de encontros', 'produto', 'V1', 10], ['Chat entre membros', 'produto', 'V1', 12], ['Assinatura mensal', 'produto', 'V1', 15],
      ['Ajustes do editor', 'validação', 'V2', 18], ['Convite por link', 'produto', 'V2', 20], ['Notificações', 'produto', 'V2', 22],
      ['Painel de eventos', 'produto', 'V3', 25], ['Testes com usuárias', 'validação', 'V3', 27], ['Publicação nas lojas', 'entrega', 'V3', 29]
    ];
    const COLS = {}; $$('.v8-kb-col', box).forEach(c => { COLS[c.dataset.col] = c; });
    const lista = k => $('.v8-kb-lista', COLS[k]);
    const pct = $('#v8KbPct'), rotDia = $('#v8KbDia'), semana = $('#v8KbSemana'), feitos = $('#v8KbFeitos');
    const barF = $('#v8KbBarraF'), barA = $('#v8KbBarraA');
    $('#v8KbTotal').textContent = ITENS.length;
    const cards = ITENS.map(([t, fase, v, dia]) => {
      const a = document.createElement('article'); a.className = 'v8-kb-card';
      const h = document.createElement('h5'); h.textContent = t;
      const pe = document.createElement('p'); pe.textContent = fase + ' · ' + v + ' · dia ' + dia;
      a.append(h, pe);
      bento(a, { g:'237,163,59', tilt:false, particulas:5 });
      return { a, dia, col:null };
    });
    Object.values(COLS).forEach(c => bento(c, { g:'61,99,219', tilt:false, ima:false, particulas:0 }));

    function colDe(dia, n){ return dia <= n ? 'concluido' : dia - n <= 3 ? 'em_andamento' : 'a_fazer'; }
    function mostra(n, animar){
      let movidos = 0;
      rotDia.textContent = 'dia ' + n;
      semana.textContent = 'semana ' + Math.min(4, Math.ceil(n / 7.5));
      cards.forEach(c => {
        const alvo = colDe(c.dia, n);
        if (alvo === c.col) return;
        if (c.col && animar){
          movidos++;
          c.a.classList.remove('movendo'); void c.a.offsetWidth; c.a.classList.add('movendo');
          setTimeout(() => c.a.classList.remove('movendo'), 2600);
        }
        c.col = alvo;
        c.a.classList.toggle('feito', alvo === 'concluido'); c.a.classList.toggle('andando', alvo === 'em_andamento');
        if (animar) flip(c.a, lista(alvo), alvo === 'concluido'); else (alvo === 'concluido' ? lista(alvo).prepend(c.a) : lista(alvo).append(c.a));
      });
      /* a fazer mostra só os próximos 3, pra caber */
      $$('.v8-kb-card', lista('a_fazer')).forEach((a, i) => { a.hidden = i > 2; });
      $$('.v8-kb-card', lista('concluido')).forEach((a, i) => { a.hidden = i > 3; });
      const nF = cards.filter(c => c.col === 'concluido').length, nA = cards.filter(c => c.col === 'em_andamento').length;
      Object.keys(COLS).forEach(k => { $('header span', COLS[k]).textContent = cards.filter(c => c.col === k).length; });
      feitos.textContent = nF; pct.textContent = Math.round(nF / cards.length * 100);
      barF.style.width = (nF / cards.length * 100) + '%'; barA.style.width = (nA / cards.length * 100) + '%';
      return movidos;
    }
    if (REDUZ){ mostra(18, false); return; }
    mostra(1, false);
    emQuadro(box, async sinal => {
      while (sinal.vivo){
        /* devagar de propósito: quem nunca viu um kanban precisa ver o cartão sair
           de uma coluna e chegar na outra. Dia sem mudança passa rápido; dia com
           mudança espera o movimento (1,4 s) e mais um pouco para ler. */
        for (let n = 1; n <= 30 && sinal.vivo; n++){
          const m = mostra(n, true);
          await espera(m ? 3400 : (n === 15 || n === 22 || n === 29 ? 1800 : 650));
        }
        await espera(4000);
        if (sinal.vivo){ cards.forEach(c => { c.col = null; }); mostra(1, false); }
      }
    }, .3);
  });
})();
