/* ==========================================================================
   GAZETA BRAGANTINA · admin-editor.js — editor de matéria e pré-visualização.
   O preview reaproveita o CSS real do site (tokens/base/layout/componentes/
   artigo) dentro de um iframe: o que a redação vê é a página final.
   ========================================================================== */
(function () {
  "use strict";
  var GB = window.GB, $ = GB.$, $$ = GB.$$, esc = GB.esc;

  var atual = null; // matéria aberta no editor

  function materiaNova() {
    return {
      id: GB.uid("m"), tipo: "padrao", status: "rascunho",
      chapeu: "", titulo: "", linhaFina: "", resumo: "",
      editoriaId: "cidade", autorIds: [], localidade: "", assuntos: [],
      urgente: false, capa: null,
      blocos: [{ tipo: "paragrafo", html: "" }],
      anuncios: { corpo1: "auto", corpo2: "auto", fim: "auto", lateral: "auto" },
      criadoEm: new Date().toISOString(), visualizacoes: 0
    };
  }

  function persistir(silencioso) {
    atual.atualizadoEm = new Date().toISOString();
    if (!GB.materia(atual.id)) GB.estado.materias.unshift(atual);
    GB.salvar();
    var el = $("#editor-salvo");
    if (el) {
      var d = new Date();
      el.textContent = "salvo às " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    }
    if (!silencioso) GB.toast("Matéria salva.");
  }
  var persistirDebounce = GB.debounce(function () { persistir(true); }, 700);

  function palavras() {
    var n = 0;
    (atual.blocos || []).forEach(function (b) {
      var t = b.html || b.texto || (b.itens || []).join(" ") || "";
      n += String(t).replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    });
    return n;
  }
  function tempoLeitura() { return Math.max(1, Math.round(palavras() / 200)); }

  /* ================================================================ EDITOR */
  GB.vistaEditor = function (parametro) {
    if (parametro === "nova") atual = materiaNova();
    else {
      atual = GB.materia(parametro);
      if (!atual) { location.hash = "#/editorial"; return; }
    }

    var podePublicar = GB.pode("publicar");
    GB.topo(
      '<a href="#/editorial" style="color:var(--cor-tinta-3);text-decoration:none">Editorial</a> <span style="color:var(--cor-fio-forte)">/</span> ' +
      (parametro === "nova" ? "Nova matéria" : "Editar"),
      null,
      '<span class="topo-vista__salvo" id="editor-salvo"></span>' +
      '<button type="button" class="btn" id="ed-previa">Pré-visualizar</button>' +
      (atual.status === "publicado"
        ? '<button type="button" class="btn btn--primario" id="ed-atualizar">Salvar atualização</button>'
        : (podePublicar
          ? '<button type="button" class="btn" id="ed-agendar">Agendar</button><button type="button" class="btn btn--primario" id="ed-publicar">Publicar</button>'
          : '<button type="button" class="btn btn--primario" id="ed-revisao">Enviar para revisão</button>'))
    );

    var t = GB.TIPOS;
    $("#vista").innerHTML =
      '<div class="editor"><div class="editor__principal">' +

      // ---- modelo
      '<div class="cartao"><div class="cartao__cabeca"><h2 class="cartao__titulo">Modelo da página</h2><span class="chip">' + GB.chipStatusTexto(atual) + "</span></div>" +
      '<div class="cartao__corpo"><div class="escolha-modelo">' +
      Object.keys(t).map(function (k) {
        return '<button type="button" class="modelo' + (atual.tipo === k ? " esta-ativo" : "") + '" data-modelo="' + k + '">' +
          '<span class="modelo__miniatura">' + miniatura(k) + "</span>" +
          '<span class="modelo__nome">' + t[k].nome + "</span>" +
          '<span class="modelo__desc">' + t[k].desc + "</span></button>";
      }).join("") + "</div></div></div>" +

      // ---- texto
      '<div class="cartao"><div class="cartao__corpo">' +
      '<label class="campo"><span class="campo__rotulo">Chapéu <span class="campo__contador">ex.: CIDADE · DESTAQUE</span></span>' +
      '<input class="campo__controle" id="ed-chapeu" value="' + esc(atual.chapeu) + '"></label>' +
      '<div class="campo"><span class="campo__rotulo">Título <span class="campo__contador" id="cont-titulo"></span></span>' +
      '<textarea class="titulo-editor" id="ed-titulo" rows="2" placeholder="Título da matéria">' + esc(atual.titulo) + "</textarea></div>" +
      '<label class="campo"><span class="campo__rotulo">Linha fina</span>' +
      '<textarea class="campo__controle" id="ed-linhafina" rows="2" placeholder="O subtítulo que complementa o título.">' + esc(atual.linhaFina) + "</textarea></label>" +
      '<label class="campo"><span class="campo__rotulo">Resumo · obrigatório <span class="campo__contador" id="cont-resumo"></span></span>' +
      '<textarea class="campo__controle" id="ed-resumo" rows="2" placeholder="Vira a descrição no Google e o texto do card no WhatsApp.">' + esc(atual.resumo) + "</textarea></label>" +
      "</div></div>" +

      // ---- corpo
      '<div class="cartao"><div class="cartao__cabeca"><h2 class="cartao__titulo">Corpo da matéria</h2>' +
      '<div style="display:flex;gap:8px;align-items:center"><span class="campo__ajuda" id="ed-leitura" style="margin:0"></span>' +
      '<button type="button" class="btn btn--mini" id="ed-importar">Importar de arquivo</button></div></div>' +
      '<div class="cartao__corpo"><div class="blocos" id="blocos"></div>' +
      '<div class="add-bloco"><span class="add-bloco__rotulo">Adicionar:</span>' +
      '<button type="button" class="btn btn--mini" data-add="paragrafo">Parágrafo</button>' +
      '<button type="button" class="btn btn--mini" data-add="intertitulo">Intertítulo</button>' +
      '<button type="button" class="btn btn--mini" data-add="citacao">Citação</button>' +
      '<button type="button" class="btn btn--mini" data-add="imagem">Imagem</button>' +
      '<button type="button" class="btn btn--mini" data-add="lista">Lista</button>' +
      "</div>" +
      '<p class="campo__ajuda" style="margin-top:12px">Colar do Word ou do Google Docs funciona: a formatação suja é limpa e cada parágrafo vira um bloco.</p>' +
      "</div></div></div>" +

      // ---- rail
      '<div class="editor__rail">' +
      '<div class="cartao"><div class="cartao__cabeca"><h2 class="cartao__titulo">Imagem de capa</h2></div><div class="cartao__corpo" id="rail-capa"></div></div>' +
      '<div class="cartao"><div class="cartao__cabeca"><h2 class="cartao__titulo">Organização</h2></div><div class="cartao__corpo">' +
      '<label class="campo"><span class="campo__rotulo">Editoria</span><select class="campo__controle" id="ed-editoria">' +
      GB.EDITORIAS.map(function (e) { return '<option value="' + e.id + '"' + (atual.editoriaId === e.id ? " selected" : "") + ">" + e.nome + "</option>"; }).join("") +
      "</select></label>" +
      '<div class="campo"><span class="campo__rotulo">Autores</span><div class="lista-checa">' +
      GB.AUTORES.map(function (a) {
        return '<label><input type="checkbox" data-autor="' + a.id + '"' + (atual.autorIds.indexOf(a.id) > -1 ? " checked" : "") + "> " + esc(a.nome) + ' <span style="color:var(--cor-tinta-3)">· ' + esc(a.cargo.split(" · ")[0]) + "</span></label>";
      }).join("") + "</div></div>" +
      '<label class="campo"><span class="campo__rotulo">Localidade (dateline)</span><input class="campo__controle" id="ed-localidade" value="' + esc(atual.localidade || "") + '" placeholder="Centro, Lavapés, Atibaia…"></label>' +
      '<div class="campo"><span class="campo__rotulo">Assuntos</span><div class="tag-input" id="ed-assuntos"></div></div>' +
      '<label class="campo"><span class="campo__rotulo">Acesso</span><select class="campo__controle" id="ed-acesso">' +
      [["livre", "Aberto para todos"], ["cadastro", "Só com cadastro"], ["assinante", "Só assinantes"]].map(function (par) {
        return '<option value="' + par[0] + '"' + ((atual.acesso || "livre") === par[0] ? " selected" : "") + ">" + par[1] + "</option>";
      }).join("") + "</select>" +
      '<p class="campo__ajuda">Assinatura é do segundo momento — marcar aqui só demonstra o paywall na pré-visualização.</p></label>' +
      '<div class="linha-config" style="border:0;padding-bottom:0"><div class="linha-config__info"><div class="linha-config__nome">Urgente (Plantão)</div></div>' +
      '<span class="interruptor"><input type="checkbox" id="ed-urgente"' + (atual.urgente ? " checked" : "") + '><span class="interruptor__trilha"></span></span></div>' +
      "</div></div>" +
      '<div class="cartao"><div class="cartao__cabeca"><h2 class="cartao__titulo">Anúncios da página</h2></div><div class="cartao__corpo" id="rail-anuncios"></div></div>' +
      "</div></div>";

    ligarCampos(podePublicar);
    renderBlocos();
    renderCapa();
    renderAssuntos();
    renderAnuncios();
    atualizarContadores();
  };

  GB.chipStatusTexto = function (m) {
    return { rascunho: "Rascunho", revisao: "Em revisão", agendado: "Agendada", publicado: "No ar" }[m.status] || m.status;
  };

  function miniatura(tipo) {
    var base = '<svg viewBox="0 0 120 76" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="76" fill="#fff"/>';
    var fim = "</svg>";
    var cinza = "#e2e2e6", escuro = "#4a4a52";
    if (tipo === "padrao") return base + '<rect x="10" y="8" width="70" height="6" fill="' + escuro + '"/><rect x="10" y="18" width="55" height="4" fill="' + cinza + '"/><rect x="10" y="26" width="70" height="24" fill="' + cinza + '"/><rect x="10" y="54" width="70" height="3" fill="' + cinza + '"/><rect x="10" y="60" width="70" height="3" fill="' + cinza + '"/><rect x="88" y="26" width="22" height="42" fill="' + cinza + '"/>' + fim;
    if (tipo === "coluna") return base + '<rect width="120" height="76" fill="#faf8f4"/><rect x="14" y="10" width="28" height="6" fill="#0f5b6e"/><circle cx="21" cy="30" r="7" fill="' + cinza + '"/><rect x="32" y="26" width="46" height="4" fill="' + escuro + '"/><rect x="32" y="33" width="30" height="3" fill="' + cinza + '"/><rect x="14" y="46" width="14" height="14" fill="' + escuro + '"/><rect x="32" y="46" width="74" height="3" fill="' + cinza + '"/><rect x="32" y="52" width="74" height="3" fill="' + cinza + '"/><rect x="32" y="58" width="60" height="3" fill="' + cinza + '"/>' + fim;
    if (tipo === "foto") return base + '<rect x="0" y="0" width="120" height="34" fill="' + escuro + '"/><rect x="10" y="22" width="66" height="6" fill="#fff"/><rect x="8" y="40" width="50" height="26" fill="' + cinza + '"/><rect x="62" y="40" width="50" height="26" fill="' + cinza + '"/>' + fim;
    return base + '<rect x="0" y="0" width="120" height="44" fill="' + escuro + '"/><rect x="14" y="26" width="80" height="8" fill="#fff"/><rect x="30" y="50" width="60" height="3" fill="' + cinza + '"/><rect x="30" y="56" width="60" height="3" fill="' + cinza + '"/><rect x="30" y="62" width="46" height="3" fill="' + cinza + '"/>' + fim;
  }

  function ligarCampos(podePublicar) {
    $$("#vista [data-modelo]").forEach(function (b) {
      b.addEventListener("click", function () {
        atual.tipo = b.getAttribute("data-modelo");
        var slots = GB.SLOTS_POR_TIPO[atual.tipo];
        var novos = {};
        slots.forEach(function (s) { novos[s.id] = (atual.anuncios || {})[s.id] || "auto"; });
        atual.anuncios = novos;
        persistir(true);
        GB.vistaEditor(atual.id);
      });
    });

    [["ed-chapeu", "chapeu"], ["ed-titulo", "titulo"], ["ed-linhafina", "linhaFina"], ["ed-resumo", "resumo"], ["ed-localidade", "localidade"]].forEach(function (par) {
      var el = $("#" + par[0]);
      el.addEventListener("input", function () {
        atual[par[1]] = el.value;
        atualizarContadores();
        persistirDebounce();
      });
    });

    $("#ed-editoria").addEventListener("change", function (e) { atual.editoriaId = e.target.value; persistirDebounce(); });
    $$("#vista [data-autor]").forEach(function (cb) {
      cb.addEventListener("change", function () {
        var id = cb.getAttribute("data-autor");
        if (cb.checked) { if (atual.autorIds.indexOf(id) < 0) atual.autorIds.push(id); }
        else atual.autorIds = atual.autorIds.filter(function (x) { return x !== id; });
        persistirDebounce();
      });
    });
    $("#ed-urgente").addEventListener("change", function (e) { atual.urgente = e.target.checked; persistirDebounce(); });
    $("#ed-acesso").addEventListener("change", function (e) { atual.acesso = e.target.value; persistirDebounce(); });

    $("#ed-previa").addEventListener("click", function () { GB.abrirPreview(atual); });
    $("#ed-importar").addEventListener("click", importarArquivo);

    var pub = $("#ed-publicar");
    if (pub) pub.addEventListener("click", function () { publicar(false); });
    var ag = $("#ed-agendar");
    if (ag) ag.addEventListener("click", agendar);
    var rv = $("#ed-revisao");
    if (rv) rv.addEventListener("click", function () {
      if (!validar()) return;
      atual.status = "revisao";
      persistir();
      GB.toast("Enviada para revisão — um editor decide a publicação.");
      location.hash = "#/editorial";
    });
    var up = $("#ed-atualizar");
    if (up) up.addEventListener("click", function () {
      persistir();
      GB.toast("Atualização salva. Na versão final, o site troca o conteúdo em segundos.");
    });
  }

  function atualizarContadores() {
    var t = $("#cont-titulo");
    if (t) {
      var n = (atual.titulo || "").length;
      t.textContent = n + "/110";
      t.classList.toggle("esta-estourado", n > 110);
    }
    var r = $("#cont-resumo");
    if (r) {
      var m = (atual.resumo || "").length;
      r.textContent = m + "/160";
      r.classList.toggle("esta-estourado", m > 160);
    }
    var l = $("#ed-leitura");
    if (l) l.textContent = palavras() + " palavras · " + tempoLeitura() + " min de leitura";
  }

  function validar() {
    if (!(atual.titulo || "").trim()) { GB.toast("A matéria precisa de um título."); return false; }
    if (!(atual.resumo || "").trim()) { GB.toast("O resumo é obrigatório — vira a descrição no Google e no WhatsApp."); return false; }
    if ((atual.titulo || "").length > 110) { GB.toast("Título acima de 110 caracteres — encurte para o Google não cortar."); return false; }
    if (!atual.capa && (atual.tipo === "padrao" || atual.tipo === "foto" || atual.tipo === "especial")) {
      GB.toast("Este modelo precisa de imagem de capa."); return false;
    }
    return true;
  }

  function publicar(vindoDoPreview) {
    if (!validar()) return;
    atual.status = "publicado";
    atual.publicadoEm = new Date().toISOString();
    atual.publicadoPorId = GB.estado.usuarioAtual;
    persistir(true);
    if (vindoDoPreview && GB.fecharPreview) GB.fecharPreview();
    GB.toast("Publicada! Na versão final, o site atualiza em segundos — sem PR, sem deploy.");
    location.hash = "#/editorial";
  }
  GB.publicarAtual = function () { publicar(true); };

  function agendar() {
    if (!validar()) return;
    var valor = atual.agendadoPara ? atual.agendadoPara.slice(0, 16) : "";
    GB.abrirModal(
      '<h2 class="modal__titulo">Agendar publicação</h2>' +
      '<p class="modal__texto">A matéria entra no ar sozinha na data marcada.</p>' +
      '<label class="campo"><span class="campo__rotulo">Data e hora</span><input type="datetime-local" class="campo__controle" id="ag-quando" value="' + valor + '"></label>' +
      '<div class="modal__acoes"><button type="button" class="btn" data-modal-fecha>Cancelar</button>' +
      '<button type="button" class="btn btn--primario" id="ag-ok">Agendar</button></div>'
    );
    $("#ag-ok").addEventListener("click", function () {
      var v = $("#ag-quando").value;
      if (!v) { GB.toast("Escolha a data e a hora."); return; }
      atual.status = "agendado";
      atual.agendadoPara = v;
      persistir();
      GB.fecharModal();
      GB.toast("Agendada para " + GB.fmtDataHora(v) + ".");
      location.hash = "#/editorial";
    });
  }

  /* ------------------------------------------------------------- assuntos */
  function renderAssuntos() {
    var caixa = $("#ed-assuntos");
    if (!caixa) return;
    caixa.innerHTML = (atual.assuntos || []).map(function (a, i) {
      return '<span class="chip">' + esc(a) + '<button type="button" data-rm-assunto="' + i + '" aria-label="Remover">×</button></span>';
    }).join("") + '<input type="text" id="assunto-novo" placeholder="digite e Enter">';
    $$("#ed-assuntos [data-rm-assunto]").forEach(function (b) {
      b.addEventListener("click", function () {
        atual.assuntos.splice(+b.getAttribute("data-rm-assunto"), 1);
        persistirDebounce(); renderAssuntos();
      });
    });
    $("#assunto-novo").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && e.target.value.trim()) {
        e.preventDefault();
        atual.assuntos.push(e.target.value.trim().toLowerCase().replace(/\s+/g, "-"));
        persistirDebounce(); renderAssuntos();
        $("#assunto-novo").focus();
      }
    });
  }

  /* ----------------------------------------------------------------- capa */
  function renderCapa() {
    var caixa = $("#rail-capa");
    if (!caixa) return;
    if (atual.tipo === "coluna") {
      caixa.innerHTML = '<p class="campo__ajuda" style="margin:0">O modelo Coluna não usa imagem de capa — quem assina a página é o cartão do colunista.</p>';
      return;
    }
    if (!atual.capa) {
      caixa.innerHTML = '<div class="capa-rail__vazia"><span>Obrigatória neste modelo.</span>' +
        '<button type="button" class="btn btn--mini btn--primario" id="capa-escolher">Escolher imagem</button></div>';
      $("#capa-escolher").addEventListener("click", function () {
        GB.escolherImagem(function (r) {
          atual.capa = { src: r.src, alt: "", legenda: "", credito: "" };
          persistirDebounce(); renderCapa();
        });
      });
      return;
    }
    caixa.innerHTML =
      '<div class="capa-rail__thumb"><img src="' + GB.srcAdmin(atual.capa.src) + '" alt=""></div>' +
      '<label class="campo"><span class="campo__rotulo">Texto alternativo · obrigatório</span><input class="campo__controle" id="capa-alt" value="' + esc(atual.capa.alt || "") + '" placeholder="Descreva a imagem para quem não a vê"></label>' +
      '<label class="campo"><span class="campo__rotulo">Legenda</span><input class="campo__controle" id="capa-legenda" value="' + esc(atual.capa.legenda || "") + '"></label>' +
      '<label class="campo"><span class="campo__rotulo">Crédito</span><input class="campo__controle" id="capa-credito" value="' + esc(atual.capa.credito || "") + '" placeholder="Foto: Nome / Gazeta Bragantina"></label>' +
      '<div class="modal__acoes" style="justify-content:flex-start;margin-top:12px">' +
      '<button type="button" class="btn btn--mini" id="capa-trocar">Trocar</button>' +
      '<button type="button" class="btn btn--mini btn--fantasma" id="capa-remover">Remover</button></div>';
    [["capa-alt", "alt"], ["capa-legenda", "legenda"], ["capa-credito", "credito"]].forEach(function (par) {
      $("#" + par[0]).addEventListener("input", function (e) { atual.capa[par[1]] = e.target.value; persistirDebounce(); });
    });
    $("#capa-trocar").addEventListener("click", function () {
      GB.escolherImagem(function (r) { atual.capa.src = r.src; persistirDebounce(); renderCapa(); });
    });
    $("#capa-remover").addEventListener("click", function () { atual.capa = null; persistirDebounce(); renderCapa(); });
  }

  /* --------------------------------------------------------------- blocos */
  function renderBlocos() {
    var caixa = $("#blocos");
    if (!caixa) return;
    caixa.innerHTML = atual.blocos.map(function (b, i) {
      var alca =
        '<span class="bloco__alca">' +
        '<button type="button" data-b-sobe="' + i + '" title="Mover para cima"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 14 6-6 6 6"/></svg></button>' +
        '<button type="button" data-b-desce="' + i + '" title="Mover para baixo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 10 6 6 6-6"/></svg></button>' +
        '<button type="button" data-b-remove="' + i + '" title="Remover bloco"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg></button>' +
        "</span>";
      var area = "";
      if (b.tipo === "paragrafo") {
        area = '<div class="bloco-edit" contenteditable="true" data-b-html="' + i + '" data-ph="Escreva o parágrafo…">' + (b.html || "") + "</div>";
      } else if (b.tipo === "intertitulo") {
        area = '<span class="bloco__tipo">Intertítulo</span><div class="bloco-edit bloco-edit--intertitulo" contenteditable="true" data-b-texto="' + i + '" data-ph="Intertítulo da seção">' + esc(b.texto || "") + "</div>";
      } else if (b.tipo === "citacao") {
        area = '<span class="bloco__tipo">Citação</span><div class="bloco-edit bloco-edit--citacao" contenteditable="true" data-b-texto="' + i + '" data-ph="A frase citada">' + esc(b.texto || "") + "</div>" +
          '<input class="campo__controle" data-b-autor="' + i + '" value="' + esc(b.autor || "") + '" placeholder="Quem disse (opcional)">';
      } else if (b.tipo === "lista") {
        area = '<span class="bloco__tipo">Lista · um item por linha</span><textarea class="campo__controle" rows="3" data-b-lista="' + i + '">' + esc((b.itens || []).join("\n")) + "</textarea>";
      } else if (b.tipo === "imagem") {
        area = '<span class="bloco__tipo">Imagem</span>' +
          (b.src
            ? '<div class="bloco__figura"><img src="' + GB.srcAdmin(b.src) + '" alt=""></div>' +
            '<div class="bloco__img-campos">' +
            '<label class="campo"><span class="campo__rotulo">Legenda</span><input class="campo__controle" data-b-legenda="' + i + '" value="' + esc(b.legenda || "") + '"></label>' +
            '<label class="campo"><span class="campo__rotulo">Crédito</span><input class="campo__controle" data-b-credito="' + i + '" value="' + esc(b.credito || "") + '"></label>' +
            '<label class="campo" style="grid-column:1/-1"><span class="campo__rotulo">Texto alternativo</span><input class="campo__controle" data-b-alt="' + i + '" value="' + esc(b.alt || "") + '"></label>' +
            "</div>" +
            '<div><button type="button" class="btn btn--mini" data-b-trocar="' + i + '">Trocar imagem</button></div>'
            : '<div class="bloco__img-vazio"><button type="button" class="btn btn--mini btn--primario" data-b-trocar="' + i + '">Escolher imagem</button></div>');
      }
      return '<div class="bloco bloco--' + b.tipo + '">' + alca + '<div class="bloco__area">' + area + "</div></div>";
    }).join("");

    // edição de texto
    $$("#blocos [data-b-html]").forEach(function (el) {
      var i = +el.getAttribute("data-b-html");
      el.addEventListener("input", function () { atual.blocos[i].html = el.innerHTML; atualizarContadores(); persistirDebounce(); });
      el.addEventListener("paste", function (e) { colar(e, i); });
    });
    $$("#blocos [data-b-texto]").forEach(function (el) {
      var i = +el.getAttribute("data-b-texto");
      el.addEventListener("input", function () { atual.blocos[i].texto = el.textContent; atualizarContadores(); persistirDebounce(); });
      el.addEventListener("paste", function (e) {
        e.preventDefault();
        document.execCommand("insertText", false, (e.clipboardData || window.clipboardData).getData("text/plain").replace(/\s+/g, " "));
      });
    });
    $$("#blocos [data-b-autor]").forEach(function (el) {
      var i = +el.getAttribute("data-b-autor");
      el.addEventListener("input", function () { atual.blocos[i].autor = el.value; persistirDebounce(); });
    });
    $$("#blocos [data-b-lista]").forEach(function (el) {
      var i = +el.getAttribute("data-b-lista");
      el.addEventListener("input", function () {
        atual.blocos[i].itens = el.value.split("\n").filter(function (x) { return x.trim(); });
        persistirDebounce();
      });
    });
    $$("#blocos [data-b-legenda]").forEach(function (el) {
      var i = +el.getAttribute("data-b-legenda");
      el.addEventListener("input", function () { atual.blocos[i].legenda = el.value; persistirDebounce(); });
    });
    $$("#blocos [data-b-credito]").forEach(function (el) {
      var i = +el.getAttribute("data-b-credito");
      el.addEventListener("input", function () { atual.blocos[i].credito = el.value; persistirDebounce(); });
    });
    $$("#blocos [data-b-alt]").forEach(function (el) {
      var i = +el.getAttribute("data-b-alt");
      el.addEventListener("input", function () { atual.blocos[i].alt = el.value; persistirDebounce(); });
    });
    $$("#blocos [data-b-trocar]").forEach(function (b) {
      b.addEventListener("click", function () {
        var i = +b.getAttribute("data-b-trocar");
        GB.escolherImagem(function (r) {
          atual.blocos[i].src = r.src;
          persistirDebounce(); renderBlocos();
        });
      });
    });

    // mover / remover
    $$("#blocos [data-b-sobe]").forEach(function (b) {
      b.addEventListener("click", function () {
        var i = +b.getAttribute("data-b-sobe");
        if (i === 0) return;
        atual.blocos.splice(i - 1, 0, atual.blocos.splice(i, 1)[0]);
        persistirDebounce(); renderBlocos();
      });
    });
    $$("#blocos [data-b-desce]").forEach(function (b) {
      b.addEventListener("click", function () {
        var i = +b.getAttribute("data-b-desce");
        if (i === atual.blocos.length - 1) return;
        atual.blocos.splice(i + 1, 0, atual.blocos.splice(i, 1)[0]);
        persistirDebounce(); renderBlocos();
      });
    });
    $$("#blocos [data-b-remove]").forEach(function (b) {
      b.addEventListener("click", function () {
        atual.blocos.splice(+b.getAttribute("data-b-remove"), 1);
        if (!atual.blocos.length) atual.blocos.push({ tipo: "paragrafo", html: "" });
        persistirDebounce(); renderBlocos(); atualizarContadores();
      });
    });

    $$("#vista [data-add]").forEach(function (b) {
      // evita ligar duas vezes ao re-renderizar
      b.onclick = function () {
        var tipo = b.getAttribute("data-add");
        var novo = { tipo: tipo };
        if (tipo === "paragrafo") novo.html = "";
        if (tipo === "intertitulo" || tipo === "citacao") novo.texto = "";
        if (tipo === "lista") novo.itens = [];
        atual.blocos.push(novo);
        persistirDebounce(); renderBlocos();
        var ultimos = $$("#blocos .bloco-edit");
        if (ultimos.length) ultimos[ultimos.length - 1].focus();
      };
    });
  }

  // Colagem sanitizada (§7.3): só o texto entra; parágrafos viram blocos
  function colar(e, indice) {
    e.preventDefault();
    var texto = (e.clipboardData || window.clipboardData).getData("text/plain");
    if (!texto) return;
    var partes = texto.replace(/\r/g, "").split(/\n{2,}|\n(?=\S)/).map(function (p) { return p.trim(); }).filter(Boolean);
    if (partes.length <= 1) {
      document.execCommand("insertText", false, texto.replace(/\n+/g, " "));
      return;
    }
    atual.blocos[indice].html = (atual.blocos[indice].html ? atual.blocos[indice].html + " " : "") + esc(partes[0]);
    var novos = partes.slice(1).map(function (p) { return { tipo: "paragrafo", html: esc(p) }; });
    Array.prototype.splice.apply(atual.blocos, [indice + 1, 0].concat(novos));
    persistirDebounce(); renderBlocos(); atualizarContadores();
    GB.toast(partes.length + " parágrafos colados — formatação limpa automaticamente.");
  }

  function importarArquivo() {
    var input = $("#arquivo-texto");
    input.value = "";
    input.onchange = function () {
      var f = input.files[0];
      if (!f) return;
      var ext = (f.name.split(".").pop() || "").toLowerCase();
      if (ext === "txt" || ext === "md") {
        var fr = new FileReader();
        fr.onload = function () {
          var partes = String(fr.result).replace(/\r/g, "").split(/\n{2,}/).map(function (p) { return p.trim(); }).filter(Boolean);
          partes.forEach(function (p) {
            if (/^#+\s/.test(p)) atual.blocos.push({ tipo: "intertitulo", texto: p.replace(/^#+\s*/, "") });
            else atual.blocos.push({ tipo: "paragrafo", html: esc(p.replace(/\n/g, " ")) });
          });
          persistir(true); renderBlocos(); atualizarContadores();
          GB.toast(partes.length + " blocos importados de " + f.name + ".");
        };
        fr.readAsText(f);
      } else {
        GB.abrirModal(
          '<h2 class="modal__titulo">Arquivo recebido: ' + esc(f.name) + "</h2>" +
          '<p class="modal__texto">A extração automática de <strong>Word e PDF</strong> entra na fase do backend (uma função no servidor converte o arquivo em blocos). ' +
          "Nesta demonstração, abra o arquivo, copie o texto e <strong>cole aqui no corpo</strong> — a colagem já limpa a formatação e separa os parágrafos.</p>" +
          '<div class="modal__acoes"><button type="button" class="btn btn--primario" data-modal-fecha>Entendi</button></div>'
        );
      }
    };
    input.click();
  }

  /* ------------------------------------------------------------- anúncios */
  function renderAnuncios() {
    var caixa = $("#rail-anuncios");
    if (!caixa) return;
    var slots = GB.SLOTS_POR_TIPO[atual.tipo] || [];
    if (!slots.length) {
      caixa.innerHTML = '<p class="campo__ajuda" style="margin:0">Este modelo não recebe anúncio no corpo — decisão editorial do layout (coluna e especial são leitura limpa).</p>';
      return;
    }
    caixa.innerHTML = slots.map(function (s) {
      var atualSel = (atual.anuncios || {})[s.id] || "auto";
      var opcoes = '<option value="auto"' + (atualSel === "auto" ? " selected" : "") + ">Rotação automática</option>" +
        '<option value="nenhum"' + (atualSel === "nenhum" ? " selected" : "") + ">Sem anúncio</option>";
      GB.estado.patrocinadores.forEach(function (pt) {
        var cs = GB.estado.criativos.filter(function (c) { return c.patrocinadorId === pt.id && c.formato === s.formato; });
        if (!cs.length) return;
        opcoes += '<optgroup label="' + esc(pt.nome) + '">' + cs.map(function (c) {
          return '<option value="' + c.id + '"' + (atualSel === c.id ? " selected" : "") + ">" + esc(c.nome) + "</option>";
        }).join("") + "</optgroup>";
      });
      return '<div class="slot-anuncio"><span class="slot-anuncio__nome">' + s.nome + " <span>" + GB.rotuloFormato(s.formato) + "</span></span>" +
        '<select class="campo__controle" data-slot="' + s.id + '">' + opcoes + "</select></div>";
    }).join("") +
      '<p class="campo__ajuda" style="margin-top:8px">Os banners vêm da vitrine de Patrocinadores. "Rotação automática" deixa o sistema escolher entre os ativos.</p>';
    $$("#rail-anuncios [data-slot]").forEach(function (sel) {
      sel.addEventListener("change", function () {
        atual.anuncios = atual.anuncios || {};
        atual.anuncios[sel.getAttribute("data-slot")] = sel.value;
        persistirDebounce();
      });
    });
  }

  /* ========================================================== PREVIEW ==== */
  function adHtml(slotId, formato) {
    var escolha = (atual.anuncios || {})[slotId] || "auto";
    if (escolha === "nenhum") return "";
    var classe = { billboard: "ad--billboard", leaderboard: "ad--leaderboard", meiapagina: "ad--meia-pagina", retangulo: "ad--retangulo" }[formato] || "";
    var f = GB.FORMATOS[formato];
    var interno;
    if (escolha === "auto") {
      interno = '<div style="width:100%;max-width:' + f.l + "px;height:" + f.a + 'px;display:flex;align-items:center;justify-content:center;background:#f5f5f7;border:1px dashed #c4c4cb;color:#6b6b74;font-family:Archivo,sans-serif;font-size:12px;letter-spacing:.06em;text-transform:uppercase;margin-inline:auto">Rotação automática · ' + f.l + "×" + f.a + "</div>";
    } else {
      var c = GB.criativo(escolha);
      if (!c) return "";
      if (c.origem === "dcm") {
        interno = '<div style="width:100%;max-width:' + f.l + "px;height:" + f.a + 'px;display:flex;flex-direction:column;gap:4px;align-items:center;justify-content:center;background:#eef1f4;border:1px dashed #8a94a3;color:#454b54;font-family:Archivo,sans-serif;font-size:12px;text-align:center;padding:8px;margin-inline:auto"><strong>Tag DCM · SECOM</strong><span>o banner real é servido pelo governo no site publicado</span></div>';
      } else {
        interno = '<img src="' + GB.srcCriativo(c) + '" alt="' + esc(c.nome) + '" style="width:100%;max-width:' + f.l + 'px;height:auto;display:block;margin-inline:auto">';
      }
    }
    return '<div class="ad-bloco ' + classe + '"><p class="ad-bloco__rotulo">Publicidade</p><div class="ad-slot">' + interno + "</div></div>";
  }

  function paywallHtml() {
    return '<div style="position:relative;margin-top:-90px;padding-top:120px;background:linear-gradient(180deg,rgba(255,255,255,0) 0%,#fff 62%)">' +
      '<div style="border:1px solid #e2e2e6;border-top:3px solid #16161a;padding:28px 24px;text-align:center;font-family:Archivo,sans-serif;background:#fff">' +
      '<p style="margin:0 0 6px;font-size:11px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#8a5a00">Conteúdo exclusivo</p>' +
      '<p style="margin:0 0 6px;font-family:Newsreader,Georgia,serif;font-size:24px;font-weight:600;color:#16161a">Continue lendo com a assinatura da Gazeta</p>' +
      '<p style="margin:0 0 16px;font-size:14px;color:#4a4a52">Jornalismo local independente, feito em Bragança — a partir de R$ ' + ((GB.estado.config.assinatura || {}).mensal || "12,90") + '/mês.</p>' +
      '<span style="display:inline-block;background:#16161a;color:#fff;font-weight:700;font-size:14px;padding:11px 22px;border-radius:2px">Assinar a Gazeta</span>' +
      '<p style="margin:14px 0 0;font-size:13px;color:#6b6b74">Já é assinante? <span style="color:#134a9a;text-decoration:underline">Entrar</span></p>' +
      "</div></div>";
  }

  function blocosHtml(comAnuncios, limite) {
    var blocosVisiveis = limite ? atual.blocos.slice(0, limite) : atual.blocos;
    var meio = Math.min(4, atual.blocos.length);
    var fim = Math.max(atual.blocos.length - 1, meio);
    var html = "";
    blocosVisiveis.forEach(function (b, i) {
      if (b.tipo === "paragrafo" && (b.html || "").trim()) html += "<p>" + b.html + "</p>";
      if (b.tipo === "intertitulo" && (b.texto || "").trim()) html += "<h2>" + esc(b.texto) + "</h2>";
      if (b.tipo === "citacao" && (b.texto || "").trim()) {
        html += '<blockquote class="citacao">' + esc(b.texto) + (b.autor ? " <cite>— " + esc(b.autor) + "</cite>" : "") + "</blockquote>";
      }
      if (b.tipo === "lista" && (b.itens || []).length) {
        html += "<ul>" + b.itens.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
      }
      if (b.tipo === "imagem" && b.src) {
        if (atual.tipo === "foto") {
          html += '<div class="mosaico mosaico--1"><span class="foto-item ar-3x2"><img src="' + b.src + '" alt="' + esc(b.alt || "") + '"></span></div>' +
            (b.legenda || b.credito ? '<p class="mosaico__legenda">' + esc(b.legenda || "") + (b.credito ? " <em>" + esc(b.credito) + "</em>" : "") + "</p>" : "");
        } else {
          html += '<figure class="figura"><div class="figura__midia ar-3x2"><img src="' + b.src + '" alt="' + esc(b.alt || "") + '"></div>' +
            (b.legenda || b.credito ? '<figcaption class="figura__legenda">' + esc(b.legenda || "") + (b.credito ? ' <span class="figura__credito">' + esc(b.credito) + "</span>" : "") + "</figcaption>" : "") + "</figure>";
        }
      }
      if (comAnuncios && i === meio - 1) html += adHtml("corpo1", "leaderboard");
      if (comAnuncios && i === fim - 1 && fim > meio) html += adHtml("corpo2", "leaderboard");
    });
    return html;
  }

  function bylineHtml() {
    var autores = (atual.autorIds || []).map(GB.autor).filter(Boolean);
    var a0 = autores[0];
    var nomes = autores.map(function (a) { return a.nome; }).join(" e ") || "Da redação";
    var agora = new Date();
    var data = GB.fmtData(atual.publicadoEm || agora.toISOString()) + " " + String(agora.getHours()).padStart(2, "0") + "h" + String(agora.getMinutes()).padStart(2, "0");
    return '<div class="byline">' +
      (a0 ? '<img class="byline__foto" src="' + a0.foto + '" alt="" width="400" height="400">' : "") +
      '<p class="byline__texto">Por <span class="byline__autor">' + esc(nomes) + "</span>" +
      (atual.localidade ? ' · <span class="dateline">' + esc(atual.localidade) + "</span>" : "") +
      '<span class="byline__datas">' + data + " · " + tempoLeitura() + " min de leitura</span></p></div>";
  }

  function capaSrc() { return atual.capa ? atual.capa.src : "assets/img/ph-16x9-b.svg"; }

  // Corpo da matéria no preview — com paywall quando o acesso é restrito
  function corpoPreview(comAnuncios) {
    if ((atual.acesso || "livre") !== "livre") {
      return blocosHtml(false, 2) + paywallHtml();
    }
    return blocosHtml(comAnuncios);
  }

  function paginaPreview() {
    var ed = GB.editoria(atual.editoriaId);
    var conteudo = "";

    if (atual.tipo === "padrao") {
      conteudo =
        '<main data-editoria="' + ed.id + '"><div class="container" style="padding-top:24px">' +
        '<div class="corpo-com-lateral"><div class="corpo-principal"><article class="materia">' +
        '<header class="materia__cabeca">' +
        (atual.chapeu ? '<p class="chapeu chapeu--grande">' + esc(atual.chapeu) + "</p>" : "") +
        '<h1 class="materia__titulo">' + esc(atual.titulo || "Título da matéria") + "</h1>" +
        (atual.linhaFina ? '<p class="materia__linha-fina">' + esc(atual.linhaFina) + "</p>" : "") +
        bylineHtml() +
        "</header>" +
        (atual.capa ? '<figure class="figura figura--capa"><div class="figura__midia ar-16x9"><img src="' + capaSrc() + '" alt="' + esc(atual.capa.alt || "") + '"></div>' +
          (atual.capa.legenda || atual.capa.credito ? '<figcaption class="figura__legenda">' + esc(atual.capa.legenda || "") + ' <span class="figura__credito">' + esc(atual.capa.credito || "") + "</span></figcaption>" : "") + "</figure>" : "") +
        '<div class="corpo">' + corpoPreview(true) + "</div>" +
        ((atual.acesso || "livre") === "livre" ? adHtml("fim", "billboard") : "") +
        "</article></div>" +
        '<aside class="corpo-lateral"><div class="lateral-pilha">' + adHtml("lateral", "meiapagina") + "</div></aside>" +
        "</div></div></main>";
    } else if (atual.tipo === "coluna") {
      var col = GB.autor((atual.autorIds || [])[0]) || { nome: "Colunista", cargo: "", foto: "assets/img/autor-09.jpg" };
      conteudo =
        '<main data-editoria="opiniao"><div class="container" style="padding-top:24px"><article class="coluna">' +
        '<header class="coluna__cabeca"><p class="selo-opiniao">Opinião</p>' +
        '<div class="colunista-cartao"><img src="' + col.foto + '" alt="" width="400" height="400"><div>' +
        '<p class="colunista-cartao__nome">' + esc(col.nome) + "</p>" +
        '<p class="colunista-cartao__sobre">' + esc(col.cargo || "") + "</p></div></div>" +
        '<h1 class="coluna__titulo">' + esc(atual.titulo || "Título da coluna") + "</h1>" +
        '<p class="byline__texto">' + GB.fmtData(new Date().toISOString()) + " · " + tempoLeitura() + " min</p>" +
        "</header>" +
        '<div class="fio-duplo" role="presentation"></div>' +
        '<div class="corpo corpo--coluna tem-capitular">' + corpoPreview(false) + "</div>" +
        "</article></div></main>";
    } else if (atual.tipo === "foto") {
      conteudo =
        '<main data-editoria="' + ed.id + '">' +
        '<section class="abertura-foto"><div class="abertura-foto__midia"><img src="' + capaSrc() + '" alt="' + esc((atual.capa || {}).alt || "") + '"></div>' +
        '<div class="abertura-foto__texto"><div class="container">' +
        (atual.chapeu ? '<p class="chapeu chapeu--grande chapeu--sobreposto">' + esc(atual.chapeu) + "</p>" : "") +
        '<h1 class="abertura-foto__titulo">' + esc(atual.titulo || "Título da foto-reportagem") + "</h1>" +
        '<p class="abertura-foto__credito">' + esc((atual.capa || {}).credito || "Fotos: Gazeta Bragantina") + "</p>" +
        "</div></div></section>" +
        '<div class="container"><article class="foto-reportagem">' + corpoPreview(false) + ((atual.acesso || "livre") === "livre" ? adHtml("fim", "billboard") : "") + "</article></div></main>";
    } else {
      var creditos = "Texto: " + (GB.nomesAutores(atual) || "Gazeta") + " · " + GB.fmtData(new Date().toISOString());
      conteudo =
        '<main data-editoria="' + ed.id + '">' +
        '<section class="capa-especial"><div class="capa-especial__midia"><img src="' + capaSrc() + '" alt="' + esc((atual.capa || {}).alt || "") + '"></div>' +
        '<div class="capa-especial__texto"><div class="container">' +
        (atual.chapeu ? '<p class="chapeu chapeu--grande chapeu--sobreposto">' + esc(atual.chapeu) + "</p>" : "") +
        '<h1 class="capa-especial__titulo">' + esc(atual.titulo || "Título do especial") + "</h1>" +
        (atual.linhaFina ? '<p class="capa-especial__linha-fina">' + esc(atual.linhaFina) + "</p>" : "") +
        '<p class="capa-especial__creditos">' + esc(creditos) + "</p>" +
        "</div></div></section>" +
        '<div class="container" style="max-width:calc(var(--medida-especial) + 48px);margin-top:48px">' +
        '<div class="corpo">' + corpoPreview(false) + "</div></div></main>";
    }

    return "<!doctype html><html lang='pt-BR'><head><meta charset='utf-8'>" +
      "<meta name='viewport' content='width=device-width, initial-scale=1'>" +
      "<base href='../'>" +
      "<link rel='preconnect' href='https://fonts.googleapis.com'>" +
      "<link rel='stylesheet' href='https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,400..800;1,400..600&family=Newsreader:ital,opsz,wght@0,6..72,300..800;1,6..72,300..700&display=swap'>" +
      "<link rel='stylesheet' href='assets/css/tokens.css'><link rel='stylesheet' href='assets/css/base.css'>" +
      "<link rel='stylesheet' href='assets/css/layout.css'><link rel='stylesheet' href='assets/css/componentes.css'>" +
      "<link rel='stylesheet' href='assets/css/artigo.css'>" +
      "<style>html,body{overflow-x:hidden}img{max-width:100%;height:auto}</style>" +
      "</head><body>" +
      "<div style='background:#fdf6e3;color:#8a5a00;font-family:Archivo,sans-serif;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;text-align:center;padding:7px'>Pré-visualização · assim a página vai ao ar</div>" +
      "<div style='border-bottom:1px solid #e2e2e6;padding:14px 0;text-align:center'><img src='assets/img/logo-gazeta-compacto.svg' alt='Gazeta Bragantina' style='height:26px;display:inline-block'></div>" +
      conteudo +
      "<footer style='margin-top:64px;background:#16161a;color:#fff;font-family:Archivo,sans-serif;font-size:12px;text-align:center;padding:20px'>© Gazeta Bragantina — pré-visualização</footer>" +
      "</body></html>";
  }

  GB.abrirPreview = function (m) {
    atual = m || atual;
    var pv = $("#preview");
    pv.hidden = false;
    document.body.style.overflow = "hidden";
    $(".preview__nota").textContent = atual.status === "publicado"
      ? "é assim que a página está no ar"
      : "nada foi publicado ainda";
    $("#preview-iframe").srcdoc = paginaPreview();
    var podePublicar = GB.pode("publicar") && atual.status !== "publicado";
    var btn = $("#preview-publicar");
    btn.textContent = podePublicar ? "Publicar" : (atual.status === "publicado" ? "Já está no ar" : "Enviar para revisão");
    btn.disabled = atual.status === "publicado";
  };
  GB.fecharPreview = function () {
    $("#preview").hidden = true;
    document.body.style.overflow = "";
  };

  document.addEventListener("DOMContentLoaded", function () {
    $("#preview-fechar").addEventListener("click", GB.fecharPreview);
    $("#preview-publicar").addEventListener("click", function () {
      if (GB.pode("publicar")) { GB.publicarAtual(); }
      else {
        atual.status = "revisao";
        persistir(true);
        GB.fecharPreview();
        GB.toast("Enviada para revisão.");
        location.hash = "#/editorial";
      }
    });
    $$("#preview-viewports .preview__vp").forEach(function (b) {
      b.addEventListener("click", function () {
        $$("#preview-viewports .preview__vp").forEach(function (x) { x.classList.remove("esta-ativo"); });
        b.classList.add("esta-ativo");
        $("#preview-janela").style.width = b.getAttribute("data-vp") + "px";
      });
    });
  });
})();
