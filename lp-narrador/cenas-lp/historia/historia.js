/* ══════════════════════════════════════════════════════════════════════
   v7 · A HISTÓRIA — mockups vivos das etapas 02, 03 e 05 + a trilha
   Regra comum aos três: a demonstração só roda com o mockup em quadro e
   com a aba visível; qualquer toque do visitante tira a encenação da frente
   (o cursor falso some e a pessoa assume). Movimento reduzido → estado
   final estático, tudo clicável.
   As cenas 3D das etapas 01 e 04 moram em cenas3d.js.
   ══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  const REDUZ = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const espera = ms => new Promise(r => setTimeout(r, ms));

  /* Roda `fn` enquanto `el` estiver em quadro. `fn(sinal)` recebe um objeto
     com .vivo — os roteiros checam isso entre um passo e outro, então sair
     de quadro interrompe no próximo passo, sem timer órfão. */
  function emQuadro(el, fn, limiar){
    let sinal = null;
    const liga = on => {
      if (on && !sinal){ sinal = { vivo:true }; fn(sinal); }
      else if (!on && sinal){ sinal.vivo = false; sinal = null; }
    };
    let visivel = false;
    new IntersectionObserver(es => {
      visivel = es[0].isIntersecting;
      liga(visivel && !document.hidden);
    }, { threshold: limiar == null ? 0.35 : limiar }).observe(el);
    addEventListener('visibilitychange', () => liga(visivel && !document.hidden));
  }

  /* cursor encenado: anda até o centro de um alvo e "clica" */
  function Cursor(caixa){
    const c = $('.hs-cursor', caixa);
    return {
      async ir(alvo, dx, dy){
        if (!c || !alvo) return;
        const a = alvo.getBoundingClientRect(), b = caixa.getBoundingClientRect();
        const x = a.left - b.left + a.width * (dx == null ? .5 : dx);
        const y = a.top - b.top + a.height * (dy == null ? .55 : dy);
        c.classList.add('on');
        c.style.transform = 'translate(' + x + 'px,' + y + 'px)';
        await espera(800);
      },
      async clica(){
        if (!c) return;
        c.classList.remove('clique'); void c.offsetWidth; c.classList.add('clique');
        await espera(260);
      },
      some(){ if (c) c.classList.remove('on', 'clique'); }
    };
  }

  /* ─────────────────────────── trilha ─────────────────────────── */
  (function trilha(){
    const nav = $('#hsTrilha'), fluxo = $('#fluxo');
    if (!nav || !fluxo) return;
    const links = $$('a', nav);
    const caps = $$('.hs-cap[data-etapa]');
    nav.addEventListener('click', e => {
      const a = e.target.closest('a'); if (!a) return;
      e.preventDefault();
      document.getElementById(a.dataset.etapa)?.scrollIntoView({ behavior: REDUZ ? 'auto' : 'smooth' });
    });
    let tic = false;
    function medir(){
      tic = false;
      const H = innerHeight, f = fluxo.getBoundingClientRect();
      nav.classList.toggle('on', f.top < H * .45 && f.bottom > H * .55);
      let atual = -1;
      caps.forEach((s, i) => { if (s.getBoundingClientRect().top < H * .5) atual = i; });
      links.forEach((a, i) => {
        a.classList.toggle('on', i === atual);
        a.classList.toggle('feito', i < atual);
        if (i === atual) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
      });
    }
    addEventListener('scroll', () => { if (!tic){ tic = true; requestAnimationFrame(medir); } }, { passive:true });
    addEventListener('resize', medir);
    medir();
  })();

  /* ─────────────────────── 02 · entregável ─────────────────────── */
  (function entregavel(){
    const box = $('#hsEntregavel');
    if (!box) return;
    const abas = $$('[role="tab"]', box);
    const pans = $$('[role="tabpanel"]', box);
    const ind = $('.hs-ent-ind', box);
    const telasBtn = $$('.hs-ent-telas button', box);
    const telas = $$('.hs-cel-tela', box);
    /* tudo que leva a uma tela dentro do celular: a manchete e o menu de
       editorias do jornal */
    const irTela = $$('[data-ir-tela]', box);
    const menuJr = irTela.filter(el => el.closest('.hs-jr-menu'));
    const manchete = $('.hs-jr-manchete', box);
    const aprov = $$('.hs-aprov li', box);
    const cursor = Cursor(box);
    let dono = false;           // true = o visitante assumiu
    let retoma = null;

    function marcaInd(){
      const a = abas.find(x => x.getAttribute('aria-selected') === 'true');
      if (!a || !ind) return;
      ind.style.width = a.offsetWidth + 'px';
      ind.style.transform = 'translateX(' + a.offsetLeft + 'px)';
    }
    function aba(i, foco){
      abas.forEach((a, k) => {
        const on = k === i;
        a.setAttribute('aria-selected', on);
        a.tabIndex = on ? 0 : -1;
        pans[k].hidden = !on;
        pans[k].classList.remove('ativo');
      });
      /* a classe .ativo liga as entradas escalonadas DEPOIS do display */
      requestAnimationFrame(() => requestAnimationFrame(() => pans[i].classList.add('ativo')));
      if (foco) abas[i].focus();
      marcaInd();
      if (i === 2) aprovacao();
    }
    function tela(i){
      telasBtn.forEach((b, k) => b.setAttribute('aria-pressed', k === i));
      telas.forEach((t, k) => t.hidden = k !== i);
      menuJr.forEach(b => b.classList.toggle('on', +b.dataset.irTela === i));
      const telasWrap = $('.hs-cel-telas', box); if (telasWrap) telasWrap.scrollTop = 0;
    }
    let aprovT = [];
    function aprovacao(){
      aprovT.forEach(clearTimeout); aprovT = [];
      aprov.forEach(li => li.classList.remove('ok'));
      if (REDUZ){ aprov.forEach(li => li.classList.add('ok')); return; }
      aprov.forEach((li, k) => aprovT.push(setTimeout(() => li.classList.add('ok'), 700 + k * 650)));
    }

    abas.forEach((a, i) => a.addEventListener('click', () => aba(i)));
    /* setas do teclado, como manda o padrão de abas */
    box.querySelector('[role="tablist"]').addEventListener('keydown', e => {
      const i = abas.indexOf(document.activeElement);
      if (i < 0) return;
      let n = null;
      if (e.key === 'ArrowRight') n = (i + 1) % abas.length;
      else if (e.key === 'ArrowLeft') n = (i - 1 + abas.length) % abas.length;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = abas.length - 1;
      if (n != null){ e.preventDefault(); aba(n, true); }
    });
    telasBtn.forEach((b, i) => b.addEventListener('click', () => tela(i)));
    irTela.forEach(el => el.addEventListener('click', () => tela(+el.dataset.irTela)));

    /* o visitante tocou: a demonstração sai de cena por 14s de inatividade */
    function assume(){
      dono = true; cursor.some();
      clearTimeout(retoma);
      retoma = setTimeout(() => { dono = false; }, 14000);
    }
    box.addEventListener('pointerdown', e => { if (e.isTrusted) assume(); });
    box.addEventListener('keydown', assume);
    addEventListener('resize', marcaInd);

    aba(0); tela(0);
    if (REDUZ) return;

    emQuadro(box, async sinal => {
      const ok = () => sinal.vivo && !dono;
      while (sinal.vivo){
        if (dono){ await espera(600); continue; }
        await espera(900); if (!ok()) continue;
        aba(0); await espera(3400); if (!ok()) continue;
        await cursor.ir(abas[1]); if (!ok()) continue;
        await cursor.clica(); aba(1); tela(0); await espera(1400); if (!ok()) continue;
        /* como leitor: toca na manchete, lê a matéria, vai pra política */
        await cursor.ir(manchete, .5, .7); await cursor.clica(); if (!ok()) continue;
        tela(1); await espera(2200); if (!ok()) continue;
        await cursor.ir(menuJr[1]); await cursor.clica(); if (!ok()) continue;
        tela(2); await espera(2200); if (!ok()) continue;
        await cursor.ir(menuJr[0]); await cursor.clica(); if (!ok()) continue;
        tela(0); await espera(900); if (!ok()) continue;
        await cursor.ir(abas[2]); if (!ok()) continue;
        await cursor.clica(); aba(2); await espera(4200); if (!ok()) continue;
        await cursor.ir(abas[0]); if (!ok()) continue;
        await cursor.clica(); cursor.some(); aba(0); await espera(1200);
      }
      cursor.some();
    });
  })();

  /* ───────────────────────── 03 · editor ───────────────────────── */
  (function editor(){
    const box = $('#hsEditor');
    if (!box) return;
    const alvo = $('#edAlvo'), titulo = $('#edTitulo'), tam = $('#edTam'), tamOut = $('#edTamOut');
    const cta = $('#edCta'), pino = $('#edPino'), aprovar = $('#edAprovar'), carimbo = $('#edCarimbo');
    const modo = $('#edModo'), cores = $$('.hs-ed-cores button', box), check = $$('#edCheck li');
    const cursor = Cursor(box);
    const ORIGINAL = { titulo: titulo.textContent, tam: tam.value, cor: '#141414' };
    let dono = false;

    const marca = k => { const li = check.find(x => x.dataset.k === k); if (li) li.classList.add('ok'); };
    function aplicaTam(v){ tam.value = v; tamOut.textContent = v; titulo.style.fontSize = v + 'px'; }
    function aplicaCor(hex){
      cores.forEach(b => b.setAttribute('aria-checked', b.dataset.cor === hex));
      cta.style.background = hex;
      cta.style.color = hex === '#141414' ? '#fff' : '#141414';
    }
    function reinicia(){
      titulo.textContent = ORIGINAL.titulo; aplicaTam(ORIGINAL.tam); aplicaCor(ORIGINAL.cor);
      alvo.classList.remove('sel'); pino.hidden = true; carimbo.hidden = true;
      check.forEach(li => li.classList.remove('ok'));
      aprovar.classList.remove('feito'); aprovar.textContent = aprovar.dataset.rotulo || 'aprovar protótipo';
    }
    function aprova(){
      ['fluxo','texto','direcao','arq'].forEach(marca);
      aprovar.classList.add('feito'); aprovar.textContent = aprovar.dataset.feito || '✓ aprovado';
      alvo.classList.remove('sel');
      carimbo.hidden = false;
    }
    /* digitação encenada, letra a letra */
    async function digita(txt, sinal){
      titulo.textContent = '';
      for (const ch of txt){
        if (!sinal.vivo || dono) return false;
        titulo.textContent += ch;
        await espera(38 + Math.random() * 40);
      }
      return true;
    }

    /* ---- o visitante assume: tudo vira de verdade ---- */
    function assume(){
      if (dono) return;
      dono = true; cursor.some();
      modo.textContent = 'você está editando'; modo.classList.add('voce');
      if (!carimbo.hidden){ reinicia(); }
      titulo.contentEditable = 'true';
    }
    box.addEventListener('pointerdown', e => { if (e.isTrusted) assume(); }, true);
    alvo.addEventListener('click', () => {
      assume(); alvo.classList.add('sel');
      titulo.contentEditable = 'true'; titulo.focus();
    });
    titulo.addEventListener('input', () => marca('texto'));
    titulo.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); titulo.blur(); } });
    titulo.addEventListener('blur', () => { if (!titulo.textContent.trim()) titulo.textContent = ORIGINAL.titulo; });
    tam.addEventListener('input', () => { assume(); aplicaTam(tam.value); marca('direcao'); });
    cores.forEach(b => b.addEventListener('click', () => { assume(); aplicaCor(b.dataset.cor); marca('direcao'); }));
    aprovar.addEventListener('click', () => {
      assume();
      if (aprovar.classList.contains('feito')){ reinicia(); return; }
      aprova();
    });
    carimbo.addEventListener('click', () => { carimbo.hidden = true; });

    titulo.contentEditable = 'true';
    if (REDUZ) return;
    titulo.contentEditable = 'false';

    emQuadro(box, async sinal => {
      const ok = () => sinal.vivo && !dono;
      while (sinal.vivo && !dono){
        reinicia(); await espera(1100); if (!ok()) break;
        marca('fluxo');
        await cursor.ir(titulo, .3, .5); if (!ok()) break;
        await cursor.clica(); alvo.classList.add('sel'); await espera(500); if (!ok()) break;
        if (!await digita('Peça em 1 minuto. Sua equipe resolve.', sinal)) break;
        marca('texto'); await espera(700); if (!ok()) break;
        await cursor.ir(tam, (ORIGINAL.tam - 16) / 14, .5); if (!ok()) break;
        for (let v = +ORIGINAL.tam; v <= 26; v++){
          if (!ok()) break;
          aplicaTam(v);
          const c = $('.hs-cursor', box);
          const a = tam.getBoundingClientRect(), b = box.getBoundingClientRect();
          c.style.transition = 'transform .12s linear, opacity .3s';
          c.style.transform = 'translate(' + (a.left - b.left + a.width * ((v - 16) / 14)) + 'px,' + (a.top - b.top + a.height * .5) + 'px)';
          await espera(130);
        }
        $('.hs-cursor', box).style.transition = '';
        if (!ok()) break;
        await cursor.ir(cores[1]); await cursor.clica(); if (!ok()) break;
        aplicaCor(cores[1].dataset.cor); marca('direcao'); await espera(700); if (!ok()) break;
        pino.hidden = false; await espera(1600); if (!ok()) break;
        marca('arq'); await espera(500); if (!ok()) break;
        await cursor.ir(aprovar); await cursor.clica(); if (!ok()) break;
        aprova(); cursor.some(); await espera(4200);
      }
      cursor.some();
      if (!dono) alvo.classList.remove('sel');
    }, 0.45);
  })();

  /* ─────────────── entrega: resumo recolhível no celular ─────────────── */
  (function entregaRecolhivel(){
    const btn = $('#entgAbrir'), det = $('#entgDetalhes');
    if (!btn || !det) return;
    const txt = $('.hs-entg-abrir-txt', btn);
    btn.addEventListener('click', () => {
      const abrir = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', abrir);
      det.classList.toggle('aberto', abrir);
      txt.textContent = abrir ? 'recolher as etapas' : 'ver as etapas';
      if (abrir && !REDUZ){
        /* recolhido, o observer de revelação já pode ter "visto" o resumo com
           altura zero e gastado a animação do trilho e dos ✓ — reinicia */
        $$('.reveal', det).forEach(el => {
          el.classList.remove('visible');
          requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('visible')));
        });
      }
    });
  })();

  /* ───────────────────── 05 · painel da operação ───────────────────── */
  (function painel(){
    const box = $('#hsPainel');
    if (!box) return;
    const cols = $$('.hs-op-col', box);
    const listas = cols.map(c => $('.hs-op-lista', c));
    const log = $('#opLog');
    /* equipe fictícia: iniciais e cor — nenhum nome de cliente real */
    const EQUIPE = { AL:'#EDA33B', JP:'#7FA7E8', RM:'#8FD1AE', TS:'#E8A08F' };
    const ORIGENS = ['WhatsApp', 'e-mail', 'formulário', 'planilha'];
    const PEDIDOS = [
      'troca do banner da loja', 'orçamento de 200 camisetas', 'segunda via do boleto',
      'ajuste no cadastro do cliente', 'relatório de entregas da semana', 'agendar visita técnica',
      'nova arte pro cardápio', 'conferir estoque da filial', 'reenvio da nota fiscal',
      'cadastrar produto novo', 'mudar endereço de entrega', 'revisar contrato do fornecedor'
    ];
    let seq = 0;

    function card(txt, orig, dono){
      const el = document.createElement('div');
      el.className = 'hs-op-card';
      const b = document.createElement('b'); b.textContent = txt;
      const pe = document.createElement('div'); pe.className = 'hs-op-card-pe';
      const o = document.createElement('span'); o.className = 'hs-op-orig'; o.textContent = 'via ' + orig;
      const d = document.createElement('span'); d.className = 'hs-op-dono';
      pe.append(o, d); el.append(b, pe);
      setDono(el, dono);
      return el;
    }
    function setDono(el, dono){
      const d = $('.hs-op-dono', el);
      d.textContent = dono || '?';
      d.classList.toggle('vazio', !dono);
      d.style.setProperty('--c', dono ? EQUIPE[dono] : 'transparent');
      el.dataset.dono = dono || '';
    }
    function contar(){
      cols.forEach((c, i) => { $('small em', c).textContent = listas[i].children.length; });
    }
    function registra(html){
      const li = document.createElement('li');
      li.innerHTML = html;
      log.prepend(li);
      while (log.children.length > 4) log.lastChild.remove();
    }
    /* move com FLIP: mede antes, move no DOM, anima a diferença */
    function move(el, destino, noTopo){
      const antes = el.getBoundingClientRect();
      if (noTopo) destino.prepend(el); else destino.append(el);
      const depois = el.getBoundingClientRect();
      if (REDUZ) return;
      el.style.transition = 'none';
      el.style.transform = 'translate(' + (antes.left - depois.left) + 'px,' + (antes.top - depois.top) + 'px)';
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.transition = ''; el.style.transform = '';
      }));
    }
    const pega = arr => arr[Math.floor(Math.random() * arr.length)];
    const hora = () => { const d = new Date(); return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); };

    /* estado inicial: um quadro já em uso, não uma tela vazia */
    [[0,null],[0,null],[1,'JP'],[1,'AL'],[2,'RM'],[3,'TS'],[3,'AL']].forEach(([c, d]) => {
      listas[c].append(card(PEDIDOS[seq++ % PEDIDOS.length], pega(ORIGENS), d));
    });
    contar();
    registra('<b>' + hora() + '</b> planilha sincronizada');
    if (REDUZ) return;

    /* um "tique" da operação: entra pedido, alguém assume, avança, entrega */
    function tique(){
      const r = Math.random();
      const semDono = $$('.hs-op-card', listas[0]).filter(c => !c.dataset.dono);
      if (listas[0].children.length < 3 && r < .34){
        const orig = pega(ORIGENS), txt = PEDIDOS[seq++ % PEDIDOS.length];
        const el = card(txt, orig, null);
        el.classList.add('novo');
        listas[0].prepend(el);
        registra('<b>' + hora() + '</b> pedido novo via ' + orig);
      } else if (semDono.length && r < .55){
        const el = semDono[semDono.length - 1], quem = pega(Object.keys(EQUIPE));
        setDono(el, quem);
        registra('<b>' + quem + '</b> assumiu “' + $('b', el).textContent + '”');
      } else {
        /* avança o card da coluna cuja vizinha está mais vazia: sem isso o
           fluxo escoava direto pra "entregues" e "revisão" vivia zerada */
        const k = [2, 1, 0]
          .filter(i => { const c = listas[i].lastElementChild; return c && c.dataset.dono; })
          .sort((a, b) => (a === 2 ? 1.5 : listas[a + 1].children.length) - (b === 2 ? 1.5 : listas[b + 1].children.length))[0];
        if (k == null) return;
        const el = listas[k].lastElementChild;
        move(el, listas[k + 1], true);
        const nome = ['em andamento', 'revisão', 'entregue'][k];
        registra('<b>' + el.dataset.dono + '</b> moveu pra ' + nome);
        if (k + 1 === 3){
          while (listas[3].children.length > 3) listas[3].lastElementChild.remove();
        }
      }
      contar();
    }
    emQuadro(box, async sinal => {
      while (sinal.vivo){ await espera(1900); if (sinal.vivo) tique(); }
    }, 0.3);
  })();
})();
