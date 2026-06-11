/* ═══════════════════════════════════════════════════════
   nó Health — interactions
═══════════════════════════════════════════════════════ */

/* ─── Custom cursor (desktop only) ─── */
(function () {
  if (window.matchMedia && window.matchMedia('(hover:none)').matches) return;
  var c = document.getElementById('cur');
  var r = document.getElementById('curR');
  if (!c || !r) return;
  var rx = 0, ry = 0, tx = 0, ty = 0;
  document.addEventListener('mousemove', function (e) {
    tx = e.clientX;
    ty = e.clientY;
    c.style.left = tx + 'px';
    c.style.top = ty + 'px';
  });
  function loop() {
    rx += (tx - rx) * 0.18;
    ry += (ty - ry) * 0.18;
    r.style.left = rx + 'px';
    r.style.top = ry + 'px';
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  ['a', 'button', '.faq-q', '.dot', '.option-card'].forEach(function (sel) {
    document.querySelectorAll(sel).forEach(function (el) {
      el.addEventListener('mouseenter', function () {
        c.style.transform = 'scale(1.6)';
        r.style.transform = 'scale(1.4)';
      });
      el.addEventListener('mouseleave', function () {
        c.style.transform = '';
        r.style.transform = '';
      });
    });
  });
})();

/* ─── Reveal on scroll ─── */
(function () {
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal, .reveal-blur').forEach(function (el) { io.observe(el); });
})();

/* ─── Top scroll progress bar (full page) ─── */
(function () {
  var bar = document.getElementById('scrollProgress');
  if (!bar) return;
  var ticking = false;
  function update() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? (window.scrollY / max) * 100 : 0;
    bar.style.width = p + '%';
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
  update();
})();

/* ─── HERO: 5-screen scroll narrative ───
   - #hero is height:500vh.
   - Inside, .hero-pin (position:sticky; height:100vh) stays pinned for the
     entire hero scroll.
   - 5 .hero-screen children are absolutely positioned inside .hero-pin and
     fade in/out based on scroll progress.
*/
(function () {
  var hero = document.getElementById('hero');
  if (!hero) return;
  var screens = Array.prototype.slice.call(hero.querySelectorAll('.hero-screen'));
  if (!screens.length) return;
  var dotsBar = document.getElementById('heroDots');
  var dots = dotsBar ? Array.prototype.slice.call(dotsBar.querySelectorAll('.dot')) : [];
  var COUNT = screens.length;

  // Dots click → scroll to that screen offset
  dots.forEach(function (d, i) {
    d.addEventListener('click', function () {
      var heroTop = hero.offsetTop;
      var perScreen = window.innerHeight;
      window.scrollTo({ top: heroTop + perScreen * i + 8, behavior: 'smooth' });
    });
  });

  var current = -1;

  function update() {
    var rect = hero.getBoundingClientRect();
    var heroTop = rect.top;
    var heroHeight = hero.offsetHeight;
    var vh = window.innerHeight;

    // Show side dots only while hero is in pinned range
    var pinnedRange = heroTop <= 0 && heroTop > -(heroHeight - vh);
    if (dotsBar) dotsBar.classList.toggle('show', pinnedRange);

    // Determine active screen index based on scroll progress within hero
    var scrolledIntoHero = -heroTop;
    var idx;
    if (scrolledIntoHero < 0) idx = 0;
    // Switch screens at the mid-point of each 100vh slot (smoother than abrupt edges)
    else idx = Math.min(COUNT - 1, Math.floor(scrolledIntoHero / vh + 0.5));

    if (idx !== current) {
      current = idx;
      screens.forEach(function (s, i) {
        s.classList.toggle('in', i === idx);
      });
      dots.forEach(function (d, i) {
        d.classList.toggle('active', i === idx);
      });
    }
  }

  var ticking = false;
  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(function () { update(); ticking = false; });
      ticking = true;
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', update);
  // First paint: show screen 0 immediately
  screens[0].classList.add('in');
  if (dots[0]) dots[0].classList.add('active');
  update();
})();

/* ─── ECG line (Section 1) ───
   Builds a horizontal ECG path (P-Q-R-S-T repeated) sized to the actual wrap
   width (no SVG stretching) and animates a luminous dot that "draws" the path:
   path behind the dot is bright, path ahead is faded.
*/
(function () {
  var svg = document.getElementById('ecgSvg');
  if (!svg) return;
  var wrap = svg.parentNode;
  var pathBack = document.getElementById('ecgPathBack');
  var pathFront = document.getElementById('ecgPathFront');
  var dot = document.getElementById('ecgDot');
  if (!pathBack || !pathFront || !dot) return;

  function buildPath(W, H, cycles) {
    var MID = H / 2;
    // Wave amplitudes scale with available height (peaks reach ~70% above baseline)
    var rUp = MID * 0.70, sDown = MID * 0.26, pBump = MID * 0.14, tBump = MID * 0.28;
    var cycleW = W / cycles;
    var d = 'M 0 ' + MID;
    for (var i = 0; i < cycles; i++) {
      var x0 = i * cycleW;
      d += ' L ' + (x0 + cycleW * 0.10) + ' ' + MID;
      d += ' Q ' + (x0 + cycleW * 0.14) + ' ' + (MID - pBump) + ', ' + (x0 + cycleW * 0.18) + ' ' + MID;
      d += ' L ' + (x0 + cycleW * 0.30) + ' ' + MID;
      d += ' L ' + (x0 + cycleW * 0.32) + ' ' + (MID + 8);
      d += ' L ' + (x0 + cycleW * 0.36) + ' ' + (MID - rUp);
      d += ' L ' + (x0 + cycleW * 0.40) + ' ' + (MID + sDown);
      d += ' L ' + (x0 + cycleW * 0.46) + ' ' + MID;
      d += ' L ' + (x0 + cycleW * 0.58) + ' ' + MID;
      d += ' Q ' + (x0 + cycleW * 0.66) + ' ' + (MID - tBump) + ', ' + (x0 + cycleW * 0.74) + ' ' + MID;
      d += ' L ' + (x0 + cycleW) + ' ' + MID;
    }
    return d;
  }

  var totalLen = 0;

  function rebuild() {
    var W = Math.max(320, wrap.offsetWidth);
    var H = Math.max(80, wrap.offsetHeight);
    var cycles = W < 700 ? 3 : (W < 1200 ? 4 : 5);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var d = buildPath(W, H, cycles);
    pathFront.setAttribute('d', d);
    pathBack.setAttribute('d', d);
    totalLen = pathBack.getTotalLength();
    pathBack.style.strokeDasharray = totalLen + ' ' + totalLen;
    pathBack.style.strokeDashoffset = totalLen;
  }

  var DURATION = 6500;
  var start = null;
  var running = false;
  var raf = null;

  function step(ts) {
    if (start === null) start = ts;
    var elapsed = (ts - start) % DURATION;
    var t = elapsed / DURATION;
    var len = totalLen * t;
    pathBack.style.strokeDashoffset = totalLen - len;
    var pt = pathBack.getPointAtLength(len);
    dot.setAttribute('cx', pt.x);
    dot.setAttribute('cy', pt.y);
    if (running) raf = requestAnimationFrame(step);
  }

  function play() {
    if (running) return;
    running = true;
    start = null;
    raf = requestAnimationFrame(step);
  }
  function pause() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
  }

  rebuild();
  var resizeT;
  window.addEventListener('resize', function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(rebuild, 120);
  });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { e.isIntersecting ? play() : pause(); });
  }, { threshold: 0.05 });
  io.observe(wrap);
})();

/* ─── Integration carousel (rAF) ─── */
(function () {
  var LOGOS_1 = [
    { n: 'WhatsApp',        slug: 'whatsapp',         c: '25D366' },
    // BR health brands not on Simple Icons CDN — Lucide category icons
    { n: 'Memed',       color: '#34A853', svg: '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>' },
    { n: 'Mevo', raw: 'mevo' },
    { n: 'Help Global', color: '#EA4335', svg: '<path d="M5 11a7 7 0 0 1 14 0"/><path d="M3 12h3a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M18 12h3v5a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1z"/><path d="M19 18a4 4 0 0 1-4 3h-3"/>' },
    { n: 'Google Calendar', slug: 'googlecalendar',   c: '4285F4' },
    { n: 'Stripe',          slug: 'stripe',           c: '635BFF' },
    { n: 'Mercado Pago',    slug: 'mercadopago',      c: '00B1EA' },
    { n: 'Pix', slug: 'pix', c: '00BDAE', fb: '<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/>', fbColor: '#00BDAE' },
    { n: 'Google Meet',     slug: 'googlemeet',       c: '00897B' },
    { n: 'Zoom',            slug: 'zoom',             c: '0B5CFF' },
    { n: 'Calendly',        slug: 'calendly',         c: '006BFF' },
    { n: 'Notion',          slug: 'notion',           c: '111111' },
    { n: 'Slack', raw: 'slack' },
    { n: 'Telegram',        slug: 'telegram',         c: '26A5E4' },
    { n: 'Discord',         slug: 'discord',          c: '5865F2' }
  ];
  var LOGOS_2 = [
    { n: 'Microsoft Teams', raw: 'teams' },
    { n: 'Google Drive',    slug: 'googledrive',      c: '4285F4' },
    { n: 'Google Sheets',   slug: 'googlesheets',     c: '34A853' },
    { n: 'HubSpot',         slug: 'hubspot',          c: 'FF7A59' },
    // ActiveCampaign removed: official clean SVG not available yet (round 7)
    { n: 'RD Station', color: '#19C9D1', svg: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>' },
    { n: 'Pipefy', raw: 'pipefy' },
    { n: 'Asaas', color: '#0072FF', svg: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><path d="M3 5v14a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>' },
    { n: 'PagSeguro', slug: 'pagseguro', c: '0F0F0F', fb: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><path d="M3 5v14a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>', fbColor: '#0F0F0F' },
    { n: 'OpenAI',          slug: 'openai',           c: '412991' },
    { n: 'Anthropic',       slug: 'anthropic',        c: 'D97757' },
    { n: 'Make',            slug: 'make',             c: '6D00CC' }
  ];

  function logoCard(l) {
    var card = document.createElement('div');
    card.className = 'logo-card';
    card.title = l.n;
    var BRAND = (typeof window !== 'undefined' && window.BRAND_SVGS) || {};
    if (l.raw && BRAND[l.raw]) {
      card.classList.add('logo-card-brand');
      card.innerHTML = BRAND[l.raw];
    } else if (l.svg) {
      card.innerHTML = '<svg class="logo-svg" viewBox="0 0 24 24" fill="none" stroke="' +
        (l.color || '#34A853') + '" stroke-width="1.7" stroke-linecap="round" ' +
        'stroke-linejoin="round" aria-label="' + l.n + '">' + l.svg + '</svg>';
    } else if (l.slug && l.c) {
      var img = document.createElement('img');
      img.src = 'https://cdn.simpleicons.org/' + l.slug + '/' + l.c;
      img.alt = l.n;
      img.loading = 'lazy';
      img.width = 42;
      img.height = 42;
      img.onerror = function () {
        card.removeChild(img);
        if (l.fb) {
          // Simple Icons 404 → Lucide category icon, never an empty card
          card.innerHTML = '<svg class="logo-svg" viewBox="0 0 24 24" fill="none" stroke="' +
            (l.fbColor || '#34A853') + '" stroke-width="1.7" stroke-linecap="round" ' +
            'stroke-linejoin="round" aria-label="' + l.n + '">' + l.fb + '</svg>';
        } else {
          var ph = document.createElement('div');
          ph.className = 'ph';
          ph.textContent = l.n;
          card.appendChild(ph);
        }
      };
      card.appendChild(img);
    } else {
      var ph = document.createElement('div');
      ph.className = 'ph';
      ph.textContent = l.ph || l.n;
      card.appendChild(ph);
    }
    return card;
  }

  function fillStrip(strip, list) {
    [0, 1, 2].forEach(function () {
      list.forEach(function (l) { strip.appendChild(logoCard(l)); });
    });
  }

  var s1 = document.getElementById('lr1');
  var s2 = document.getElementById('lr2');
  if (!s1 || !s2) return;
  fillStrip(s1, LOGOS_1);
  fillStrip(s2, LOGOS_2);

  var x1 = 0, x2 = 0;
  var w1 = 0, w2 = 0;
  function measure() {
    w1 = s1.scrollWidth / 3;
    w2 = s2.scrollWidth / 3;
  }
  requestAnimationFrame(function () { setTimeout(measure, 60); });
  window.addEventListener('resize', function () { setTimeout(measure, 50); });

  var paused = false;
  var marquee = document.querySelector('.logo-marquee');
  if (marquee) {
    marquee.addEventListener('mouseenter', function () { paused = true; });
    marquee.addEventListener('mouseleave', function () { paused = false; });
  }

  function step() {
    if (!paused && w1 && w2) {
      x1 -= 0.5;
      x2 -= 0.65;
      if (Math.abs(x1) >= w1) x1 += w1;
      if (Math.abs(x2) >= w2) x2 += w2;
      s1.style.transform = 'translate3d(' + x1 + 'px,0,0)';
      s2.style.transform = 'translate3d(' + x2 + 'px,0,0)';
    }
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
})();

/* ─── FAQ accordion ─── */
(function () {
  var FAQS = [
    {
      q: 'Acabei de terminar a faculdade, faz sentido investir nisso agora?',
      a: 'Com certeza! Boa parte dos nossos médicos começaram a atender online enquanto estava estudando para a residência. Em poucos plantões, você já paga o investimento total e passa a ter total controle dos seus horários. Você atende e estuda. A {nó} configura e deixa tudo rodando por você.'
    },
    {
      q: 'Quanto eu cobro por consulta? Vocês sugerem?',
      a: 'Você decide. A maioria dos médicos da {nó} cobra entre <strong>R$40 e R$80</strong> por consulta de pronto atendimento e <strong>R$100 a R$130</strong> por consulta agendada ou com especialistas. A gente te ajuda a calibrar o preço com base no teu mercado, mas a decisão é sua.'
    },
    {
      q: 'Preciso de CNPJ? Posso atender como pessoa física?',
      a: 'Pode atender como PF (CRM ativo basta), mas recomendamos abrir <strong>MEI ou PJ</strong> — sai mais barato em impostos quando você começa a faturar mais. Indicamos contador parceiro se precisar.'
    },
    {
      q: 'Sou psicólogo / fisioterapeuta / nutricionista. Funciona pra mim?',
      a: 'Funciona. A {nó} atende qualquer profissional de saúde com registro ativo no respectivo conselho (<strong>CRP, CREFITO, CRN</strong>, etc.). O fluxo de atendimento é o mesmo, só muda o tipo de documento emitido.'
    },
    {
      q: 'Como funciona a prescrição eletrônica? É válida mesmo?',
      a: 'Sim, 100% válida. Usamos <strong>Memed e Mevo</strong> (parceiros homologados pelo CFM), com assinatura digital ICP-Brasil via <strong>Soluti BirdID</strong>. O paciente recebe a receita no celular e leva à farmácia normalmente.'
    },
    {
      q: 'E LGPD? Tô responsável se vazar dado de paciente?',
      a: 'A infraestrutura é toda LGPD-compliant (<strong>Supabase em São Paulo</strong>, criptografia end-to-end, logs auditáveis). Você assina o termo de DPO conosco e a {nó} responde tecnicamente pelo tratamento dos dados.'
    },
    {
      q: 'Quanto tempo até eu começar a atender de verdade?',
      a: '<strong>Integração:</strong> 2–4 semanas. <strong>Roteador (pool médico atende pela sua marca):</strong> 4–6 semanas. <strong>Plataforma própria:</strong> 8–12 semanas. Em todos, você sai com a operação rodando + treinamento + primeiros pacientes captados via tráfego.'
    },
    {
      q: 'E os pacientes? Vocês captam ou eu tenho que ir atrás?',
      a: 'Captação não está incluída no setup, mas indicamos parceiros de tráfego pago (incluindo nossa agência irmã, a própria {nó}) que cuidam disso. Em média, <strong>R$1k–3k/mês</strong> de mídia já enche tua agenda.'
    },
    {
      q: 'E se eu quiser sair? Levo meus pacientes comigo?',
      a: 'Sim. Toda a base de pacientes, prontuários e histórico é seu, sempre. <strong>Portabilidade gratuita</strong> em qualquer momento — a gente exporta tudo em formato padrão.'
    },
    {
      q: 'Posso testar antes de fechar?',
      a: 'Pode. A primeira conversa é gratuita e a gente monta uma <strong>demo personalizada com a tua marca</strong> antes de você assinar qualquer coisa. Sem compromisso.'
    }
  ];

  var list = document.getElementById('faqList');
  if (!list) return;

  function brandify(html) {
    return html.replace(/\{nó\}/g, '<span class="brand">nó</span>');
  }

  FAQS.forEach(function (f, idx) {
    var item = document.createElement('div');
    item.className = 'faq-item' + (idx === 0 ? ' open' : '');
    item.innerHTML =
      '<button class="faq-q" type="button" aria-expanded="' + (idx === 0 ? 'true' : 'false') + '">' +
        '<span>' + brandify(f.q) + '</span>' +
        '<span class="faq-plus" aria-hidden="true">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">' +
            '<line x1="12" y1="5" x2="12" y2="19"/>' +
            '<line x1="5" y1="12" x2="19" y2="12"/>' +
          '</svg>' +
        '</span>' +
      '</button>' +
      '<div class="faq-a">' +
        '<div class="faq-a-inner">' + brandify(f.a) + '</div>' +
      '</div>';
    var btn = item.querySelector('.faq-q');
    btn.addEventListener('click', function () {
      var isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(function (x) {
        x.classList.remove('open');
        var b = x.querySelector('.faq-q');
        if (b) b.setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
    list.appendChild(item);
  });
})();
