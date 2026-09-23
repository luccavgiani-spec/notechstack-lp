/* ==========================================================================
   GAZETA BRAGANTINA · prototipo.js
   --------------------------------------------------------------------------
   JavaScript do prototipo estatico. Sem framework, sem build, sem rede.
   Todo modulo checa a existencia dos seus elementos antes de rodar, para
   que o mesmo arquivo sirva as 9 paginas sem um unico erro de console.

   Modulos
     1.  utilitarios
     2.  toast
     3.  rotas fora do escopo do prototipo
     4.  plantao
     5.  drawer mobile
     6.  overlay de busca
     7.  barra mobile retratil
     8.  nav sticky compacta
     9.  formularios (newsletter)
    10.  sharebar
    11.  carregar mais + paginacao
    12.  lightbox (foto-reportagem)
    13.  reportagem especial (progresso, sumario, revelar, parallax)
    14.  embeds com facade
    15.  404 "voce procurava?"
    16.  chips de preferencia
   ========================================================================== */

(function () {
  'use strict';

  /* ======================================================================
     1. UTILITARIOS
     ====================================================================== */

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.prototype.slice.call((ctx || document).querySelectorAll(sel));

  const movimentoReduzido = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Sequenciador em requestAnimationFrame — evita trabalho por evento de scroll. */
  function noQuadro(fn) {
    let agendado = false;
    return function () {
      if (agendado) return;
      agendado = true;
      window.requestAnimationFrame(function () {
        agendado = false;
        fn();
      });
    };
  }

  const FOCAVEIS =
    'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

  /** Prende o Tab dentro de um container aberto (drawer, busca, lightbox). */
  function prenderFoco(container, evento) {
    const itens = $$(FOCAVEIS, container).filter(
      (el) => el.offsetParent !== null || el === document.activeElement
    );
    if (!itens.length) return;
    const primeiro = itens[0];
    const ultimo = itens[itens.length - 1];
    if (evento.shiftKey && document.activeElement === primeiro) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primeiro.focus();
    }
  }

  function travarScroll(travar) {
    document.body.classList.toggle('trava-scroll', travar);
  }

  /* ======================================================================
     2. TOAST
     ====================================================================== */

  const ICONE_INFO =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.6v.2"/></svg>';

  function avisar(mensagem) {
    let area = $('#areaToast');
    if (!area) {
      area = document.createElement('div');
      area.id = 'areaToast';
      area.className = 'toast-area';
      area.setAttribute('role', 'status');
      area.setAttribute('aria-live', 'polite');
      document.body.appendChild(area);
    }
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = ICONE_INFO + '<span></span>';
    $('span', el).textContent = mensagem;
    area.appendChild(el);
    window.setTimeout(function () {
      el.remove();
    }, 4200);
  }

  /* ======================================================================
     3. ROTAS FORA DO ESCOPO
     Links marcados com data-rota apontam para telas previstas na §1.1 que
     nao fazem parte do prototipo. Em vez de levar a lugar nenhum, avisam.
     ====================================================================== */

  document.addEventListener('click', function (ev) {
    const alvo = ev.target.closest('[data-rota]');
    if (!alvo) return;
    ev.preventDefault();
    avisar('Rota ' + alvo.getAttribute('data-rota') + ' — prevista na arquitetura, fora do escopo deste protótipo visual.');
  });

  /* ======================================================================
     4. PLANTAO
     ====================================================================== */

  (function plantao() {
    const barra = $('[data-plantao]');
    if (!barra) return;
    const fechar = $('[data-plantao-fechar]', barra);
    if (!fechar) return;
    fechar.addEventListener('click', function () {
      barra.hidden = true;
      avisar('Plantão dispensado. No portal real ele também expira sozinho na validade definida pelo painel.');
    });
  })();

  /* ======================================================================
     5. DRAWER MOBILE
     ====================================================================== */

  (function drawer() {
    const painel = $('#drawer');
    if (!painel) return;
    const abridores = $$('[data-abre-drawer]');
    const fechadores = $$('[data-fecha-drawer]', painel);
    let ultimoFoco = null;

    function abrir() {
      ultimoFoco = document.activeElement;
      painel.classList.add('is-aberto');
      abridores.forEach((b) => b.setAttribute('aria-expanded', 'true'));
      travarScroll(true);
      window.requestAnimationFrame(function () {
        const alvo = $(FOCAVEIS, painel);
        if (alvo) alvo.focus();
      });
    }

    function fechar() {
      painel.classList.remove('is-aberto');
      abridores.forEach((b) => b.setAttribute('aria-expanded', 'false'));
      travarScroll(false);
      if (ultimoFoco) ultimoFoco.focus();
    }

    abridores.forEach((b) => b.addEventListener('click', abrir));
    fechadores.forEach((b) => b.addEventListener('click', fechar));

    painel.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') fechar();
      if (ev.key === 'Tab') prenderFoco(painel, ev);
    });
  })();

  /* ======================================================================
     6. OVERLAY DE BUSCA
     ====================================================================== */

  (function busca() {
    const painel = $('#busca');
    if (!painel) return;
    const abridores = $$('[data-abre-busca]');
    const fechadores = $$('[data-fecha-busca]', painel);
    const campo = $('#campoBusca');
    const form = $('[data-form-busca]', painel);
    let ultimoFoco = null;

    function abrir() {
      ultimoFoco = document.activeElement;
      painel.classList.add('is-aberto');
      abridores.forEach((b) => b.setAttribute('aria-expanded', 'true'));
      travarScroll(true);
      if (campo) window.setTimeout(() => campo.focus(), 60);
    }

    function fechar() {
      painel.classList.remove('is-aberto');
      abridores.forEach((b) => b.setAttribute('aria-expanded', 'false'));
      travarScroll(false);
      if (ultimoFoco) ultimoFoco.focus();
    }

    abridores.forEach((b) => b.addEventListener('click', abrir));
    fechadores.forEach((b) => b.addEventListener('click', fechar));

    painel.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') fechar();
      if (ev.key === 'Tab') prenderFoco(painel, ev);
    });

    document.addEventListener('keydown', function (ev) {
      // "/" abre a busca, como em portal de verdade
      if (ev.key === '/' && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) {
        ev.preventDefault();
        abrir();
      }
    });

    if (form) {
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        const termo = campo && campo.value.trim();
        avisar(
          termo
            ? 'Busca por “' + termo + '” → /busca?q=' + encodeURIComponent(termo) + ' (Postgres full-text, §7.8).'
            : 'Digite um termo para buscar.'
        );
      });
    }
  })();

  /* ======================================================================
     7. BARRA MOBILE RETRATIL (§3.3)
     ====================================================================== */

  (function barraMobile() {
    const barra = $('[data-barra-mobile]');
    if (!barra) return;
    let anterior = window.scrollY;

    const aoRolar = noQuadro(function () {
      const atual = window.scrollY;
      const desceu = atual > anterior && atual > 180;
      barra.classList.toggle('is-oculta', desceu);
      anterior = atual;
    });

    window.addEventListener('scroll', aoRolar, { passive: true });
  })();

  /* ======================================================================
     8. NAV STICKY COMPACTA
     ====================================================================== */

  (function navSticky() {
    const nav = $('[data-nav-sticky]');
    if (!nav) return;
    const gatilho = nav.offsetTop || 120;

    const aoRolar = noQuadro(function () {
      nav.classList.toggle('is-compacta', window.scrollY > gatilho);
    });

    window.addEventListener('scroll', aoRolar, { passive: true });
    aoRolar();
  })();

  /* ======================================================================
     9. FORMULARIOS
     ====================================================================== */

  (function formularios() {
    $$('[data-form-newsletter]').forEach(function (form) {
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        const email = $('input[type="email"]', form);
        if (!email || !email.value) return;
        avisar('Inscrição registrada para ' + email.value + '. No portal real, POST /api/newsletter + duplo opt-in (LGPD, §7.11).');
        form.reset();
      });
    });
  })();

  /* ======================================================================
    10. SHAREBAR
     ====================================================================== */

  (function compartilhar() {
    const alvos = $$('[data-share]');
    if (!alvos.length) return;

    const titulo = document.title.replace(/ \| Gazeta Bragantina.*$/, '');
    const url = window.location.href;

    alvos.forEach(function (botao) {
      botao.addEventListener('click', function (ev) {
        ev.preventDefault();
        const rede = botao.getAttribute('data-share');

        if (rede === 'copiar') {
          if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(url).then(
              () => avisar('Link copiado.'),
              () => avisar('Link: ' + url)
            );
          } else {
            avisar('Link: ' + url);
          }
          return;
        }

        const destinos = {
          whatsapp: 'https://api.whatsapp.com/send?text=' + encodeURIComponent(titulo + ' ' + url),
          facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url),
          x: 'https://x.com/intent/post?text=' + encodeURIComponent(titulo) + '&url=' + encodeURIComponent(url),
          email: 'mailto:?subject=' + encodeURIComponent(titulo) + '&body=' + encodeURIComponent(url),
        };

        avisar('Abriria: ' + (destinos[rede] || url).slice(0, 96) + '…  (desligado no protótipo)');
      });
    });
  })();

  /* ======================================================================
    11. CARREGAR MAIS + PAGINACAO
     Progressive enhancement sobre a paginacao real (§2.7).
     ====================================================================== */

  (function carregarMais() {
    const botao = $('[data-carregar-mais]');
    const destino = $('[data-lista-materias]');
    const modelo = $('#maisMaterias');
    if (!botao || !destino || !modelo) return;

    let rodadas = 0;
    botao.addEventListener('click', function () {
      const copia = modelo.content.cloneNode(true);
      destino.appendChild(copia);
      rodadas += 1;
      const restantes = 3 - rodadas;
      if (restantes <= 0) {
        botao.textContent = 'Você chegou ao fim desta editoria';
        botao.disabled = true;
        botao.setAttribute('aria-disabled', 'true');
      } else {
        botao.textContent = 'Carregar mais matérias (' + restantes + ' páginas restantes)';
      }
      avisar('Mais 6 matérias carregadas. A URL paginada continua indexável em ?pagina=' + (rodadas + 1) + '.');
    });
  })();

  (function paginacaoAtual() {
    const paginacao = $('[data-paginacao]');
    if (!paginacao) return;
    const parametros = new URLSearchParams(window.location.search);
    const pagina = parseInt(parametros.get('pagina') || '1', 10);
    if (!pagina || pagina < 1) return;

    $$('[data-pagina]', paginacao).forEach(function (item) {
      const n = parseInt(item.getAttribute('data-pagina'), 10);
      if (n === pagina) {
        item.setAttribute('aria-current', 'page');
      } else {
        item.removeAttribute('aria-current');
      }
    });

    const rotulo = $('[data-pagina-rotulo]');
    if (rotulo) rotulo.textContent = 'Página ' + pagina + ' de 4';
  })();

  /* ======================================================================
    12. LIGHTBOX — teclado, swipe, contador e compartilhamento (§3.5)
     ====================================================================== */

  (function lightbox() {
    const caixa = $('#lightbox');
    const galeria = $('[data-galeria]');
    if (!caixa || !galeria) return;

    const fotos = $$('[data-foto]', galeria);
    if (!fotos.length) return;

    const imagem = $('[data-lightbox-img]', caixa);
    const legenda = $('[data-lightbox-legenda]', caixa);
    const credito = $('[data-lightbox-credito]', caixa);
    const contador = $('[data-lightbox-contador]', caixa);
    let indice = 0;
    let ultimoFoco = null;

    function pintar() {
      const foto = fotos[indice];
      const img = $('img', foto);
      imagem.src = img.getAttribute('src');
      imagem.alt = img.getAttribute('alt') || '';
      legenda.textContent = foto.getAttribute('data-legenda') || '';
      credito.textContent = foto.getAttribute('data-credito') || '';
      contador.textContent = indice + 1 + ' / ' + fotos.length;
    }

    function abrir(i) {
      indice = i;
      ultimoFoco = document.activeElement;
      pintar();
      caixa.classList.add('is-aberto');
      caixa.removeAttribute('aria-hidden');
      travarScroll(true);
      const fechar = $('[data-lightbox-fechar]', caixa);
      if (fechar) fechar.focus();
    }

    function fechar() {
      caixa.classList.remove('is-aberto');
      caixa.setAttribute('aria-hidden', 'true');
      travarScroll(false);
      if (ultimoFoco) ultimoFoco.focus();
    }

    function mover(passo) {
      indice = (indice + passo + fotos.length) % fotos.length;
      pintar();
    }

    fotos.forEach(function (foto, i) {
      foto.addEventListener('click', function (ev) {
        ev.preventDefault();
        abrir(i);
      });
    });

    const btFechar = $('[data-lightbox-fechar]', caixa);
    const btAnterior = $('[data-lightbox-anterior]', caixa);
    const btProxima = $('[data-lightbox-proxima]', caixa);
    const btShare = $('[data-lightbox-share]', caixa);
    const fundo = $('[data-lightbox-fundo]', caixa);

    if (btFechar) btFechar.addEventListener('click', fechar);
    if (btAnterior) btAnterior.addEventListener('click', () => mover(-1));
    if (btProxima) btProxima.addEventListener('click', () => mover(1));
    if (fundo) fundo.addEventListener('click', fechar);
    if (btShare) {
      btShare.addEventListener('click', function () {
        avisar('Compartilharia a foto ' + (indice + 1) + ' com URL própria (#foto-' + (indice + 1) + ') e ImageObject no schema.');
      });
    }

    document.addEventListener('keydown', function (ev) {
      if (!caixa.classList.contains('is-aberto')) return;
      if (ev.key === 'Escape') fechar();
      else if (ev.key === 'ArrowRight') mover(1);
      else if (ev.key === 'ArrowLeft') mover(-1);
      else if (ev.key === 'Tab') prenderFoco(caixa, ev);
    });

    // swipe
    let xInicial = null;
    const palco = $('[data-lightbox-palco]', caixa);
    if (palco) {
      palco.addEventListener(
        'touchstart',
        function (ev) {
          xInicial = ev.changedTouches[0].clientX;
        },
        { passive: true }
      );
      palco.addEventListener(
        'touchend',
        function (ev) {
          if (xInicial === null) return;
          const delta = ev.changedTouches[0].clientX - xInicial;
          if (Math.abs(delta) > 44) mover(delta < 0 ? 1 : -1);
          xInicial = null;
        },
        { passive: true }
      );
    }
  })();

  /* ======================================================================
    13. REPORTAGEM ESPECIAL
     ====================================================================== */

  (function especial() {
    const barra = $('[data-progresso]');
    const preenchimento = barra ? $('[data-progresso-preenchimento]', barra) : null;
    const capa = $('[data-capa-especial]');
    const midiaCapa = capa ? $('[data-capa-midia]', capa) : null;
    const cabecalho = $('[data-cabecalho-retratil]');
    const capitulos = $$('[data-capitulo]');
    const linksSumario = $$('[data-sumario-link]');

    if (!barra && !capa && !capitulos.length) return;

    const aoRolar = noQuadro(function () {
      const y = window.scrollY;
      const alcance = document.documentElement.scrollHeight - window.innerHeight;

      if (preenchimento) {
        const pct = alcance > 0 ? Math.min(100, (y / alcance) * 100) : 0;
        preenchimento.style.width = pct.toFixed(2) + '%';
        barra.classList.toggle('is-visivel', y > 120);
        barra.setAttribute('aria-valuenow', Math.round(pct));
      }

      if (cabecalho) {
        cabecalho.classList.toggle('is-escondido', y < window.innerHeight * 0.75);
      }

      // efeito 2: parallax de no maximo 8% (§3.6)
      if (midiaCapa && !movimentoReduzido()) {
        const limite = window.innerHeight;
        if (y < limite) {
          midiaCapa.style.transform = 'translate3d(0,' + (y * 0.08).toFixed(1) + 'px,0)';
        }
      }

      // scroll-spy do sumario
      if (capitulos.length && linksSumario.length) {
        let ativo = capitulos[0].id;
        capitulos.forEach(function (cap) {
          if (cap.getBoundingClientRect().top <= window.innerHeight * 0.35) ativo = cap.id;
        });
        linksSumario.forEach(function (link) {
          const alvo = link.getAttribute('href').replace('#', '');
          if (alvo === ativo) link.setAttribute('aria-current', 'true');
          else link.removeAttribute('aria-current');
        });
      }
    });

    window.addEventListener('scroll', aoRolar, { passive: true });
    aoRolar();

    // efeito 1: fade-in por bloco ao entrar na viewport
    const revelaveis = $$('.revelar');
    if (revelaveis.length) {
      if (movimentoReduzido() || !('IntersectionObserver' in window)) {
        revelaveis.forEach((el) => el.classList.add('is-visivel'));
      } else {
        const observador = new IntersectionObserver(
          function (entradas) {
            entradas.forEach(function (entrada) {
              if (entrada.isIntersecting) {
                entrada.target.classList.add('is-visivel');
                observador.unobserve(entrada.target);
              }
            });
          },
          { rootMargin: '0px 0px -12% 0px', threshold: 0.05 }
        );
        revelaveis.forEach((el) => observador.observe(el));
      }
    }

    // sumario colapsavel no mobile
    const botaoSumario = $('[data-sumario-botao]');
    const sumario = $('[data-sumario]');
    if (botaoSumario && sumario) {
      botaoSumario.addEventListener('click', function () {
        const aberto = sumario.hasAttribute('hidden');
        if (aberto) sumario.removeAttribute('hidden');
        else sumario.setAttribute('hidden', '');
        botaoSumario.setAttribute('aria-expanded', String(aberto));
      });
      linksSumario.forEach(function (link) {
        link.addEventListener('click', function () {
          if (window.matchMedia('(max-width: 1023px)').matches) {
            sumario.setAttribute('hidden', '');
            botaoSumario.setAttribute('aria-expanded', 'false');
          }
        });
      });
    }
  })();

  /* ======================================================================
    14. EMBEDS COM FACADE (§6.5)
     ====================================================================== */

  (function facades() {
    $$('[data-embed]').forEach(function (facade) {
      facade.addEventListener('click', function (ev) {
        ev.preventDefault();
        avisar(
          'Facade de ' +
            facade.getAttribute('data-embed') +
            ': no portal real, só aqui o script de terceiro é baixado — antes disso, zero requisição externa.'
        );
      });
    });
  })();

  /* ======================================================================
    15. 404 — "voce procurava?" (§6.4, camada 4)
     Similaridade por bigramas (coeficiente de Dice). Sem backend: e
     exatamente a heuristica que a rota real usaria contra a tabela de slugs.
     ====================================================================== */

  (function pagina404() {
    const area = $('[data-sugestoes-404]');
    if (!area) return;

    const acervo = [
      { t: 'Governo do Estado confirma Hospital Regional em Bragança e obra começa em outubro', s: 'hospital-regional-braganca-obra-outubro', e: 'Cidade', d: '28/07/2026', u: 'noticia.html' },
      { t: 'Câmara aprova LDO de 2027 com R$ 1,3 bilhão e emenda de R$ 12 mi para o Lavapés', s: 'camara-aprova-ldo-2027-lavapes', e: 'Política', d: '27/07/2026', u: 'noticia.html' },
      { t: 'Festa do Divino leva 12 mil às ruas do Centro em três dias de procissão', s: 'festa-do-divino-12-mil-centro', e: 'Cultura', d: '26/07/2026', u: 'foto-reportagem.html' },
      { t: 'O que sobrou do Lavapés: seis meses depois da enchente', s: 'o-que-sobrou-do-lavapes', e: 'Especial', d: '25/07/2026', u: 'especial.html' },
      { t: 'Bragantino vence fora de casa e cola no G-4 com gol nos acréscimos', s: 'bragantino-vence-fora-g4', e: 'Bragantino', d: '27/07/2026', u: 'noticia.html' },
      { t: 'Atibaia decreta emergência após chuva de 82 mm e 40 famílias deixam casas', s: 'atibaia-emergencia-chuva-82mm', e: 'Região', d: '28/07/2026', u: 'noticia.html' },
      { t: 'Concurso da Prefeitura tem 4,2 mil inscritos para 96 vagas; provas em setembro', s: 'concurso-prefeitura-4200-inscritos', e: 'Cidade', d: '24/07/2026', u: 'noticia.html' },
      { t: 'Bolsa Atleta abre inscrições e amplia para 120 o número de beneficiados', s: 'bolsa-atleta-inscricoes-120-atletas', e: 'Esportes', d: '23/07/2026', u: 'noticia.html' },
      { t: 'Vacinação contra a gripe é ampliada para todas as idades nas 32 unidades', s: 'vacinacao-gripe-ampliada-32-unidades', e: 'Cidade', d: '28/07/2026', u: 'noticia.html' },
      { t: 'A política da semana em Bragança', s: 'a-politica-da-semana-em-braganca', e: 'Opinião', d: '28/07/2026', u: 'coluna.html' },
    ];

    function bigramas(texto) {
      const limpo = texto
        .toLowerCase()
        .normalize('NFD')
        .replace(new RegExp('[\u0300-\u036f]','g'), '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
      const pares = [];
      for (let i = 0; i < limpo.length - 1; i++) pares.push(limpo.slice(i, i + 2));
      return pares;
    }

    function dice(a, b) {
      const pa = bigramas(a);
      const pb = bigramas(b);
      if (!pa.length || !pb.length) return 0;
      const mapa = new Map();
      pa.forEach((p) => mapa.set(p, (mapa.get(p) || 0) + 1));
      let comuns = 0;
      pb.forEach(function (p) {
        const n = mapa.get(p) || 0;
        if (n > 0) {
          comuns++;
          mapa.set(p, n - 1);
        }
      });
      return (2 * comuns) / (pa.length + pb.length);
    }

    const parametros = new URLSearchParams(window.location.search);
    const urlPedida = parametros.get('url') || '/cidade/hospital-regional-bragantino-obras-2026';

    const alvoUrl = $('[data-url-pedida]');
    if (alvoUrl) alvoUrl.textContent = urlPedida;

    const termo = urlPedida.split('/').filter(Boolean).pop() || '';
    const ranking = acervo
      .map((item) => ({ item, score: Math.max(dice(termo, item.s), dice(termo, item.t)) }))
      .sort((a, b) => b.score - a.score)
      .filter((r) => r.score > 0.12)
      .slice(0, 4);

    const vazio = $('[data-sugestoes-vazio]');

    if (!ranking.length) {
      if (vazio) vazio.hidden = false;
      return;
    }

    area.innerHTML = ranking
      .map(function (r) {
        return (
          '<li class="sugestao-item"><a href="' +
          r.item.u +
          '"><span class="sugestao-item__score">' +
          Math.round(r.score * 100) +
          '% de semelhança</span>' +
          '<span class="sugestao-item__titulo">' +
          r.item.t +
          '</span>' +
          '<span class="sugestao-item__meta">' +
          r.item.e +
          ' · ' +
          r.item.d +
          '</span></a></li>'
        );
      })
      .join('');

    const registro = $('[data-registro-404]');
    if (registro) {
      registro.textContent =
        'URL registrada em redirects_pendentes para a redação resolver — é essa tabela que vira a lista de tarefas depois do go-live.';
    }
  })();

  /* ======================================================================
    16. CHIPS DE PREFERENCIA
     ====================================================================== */

  (function chips() {
    $$('[data-chip]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        const ativo = chip.getAttribute('aria-pressed') === 'true';
        chip.setAttribute('aria-pressed', String(!ativo));
      });
    });
  })();
})();
