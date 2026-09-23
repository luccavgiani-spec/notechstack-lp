/* ==========================================================================
   GAZETA BRAGANTINA · admin-vistas.js — Início, Editorial (lista),
   Patrocinadores, Relatórios e Configurações. Requer admin.js antes.
   ========================================================================== */
(function () {
  "use strict";
  var GB = window.GB, $ = GB.$, $$ = GB.$$, esc = GB.esc;

  var STATUS = {
    rascunho: "Rascunho",
    revisao: "Em revisão",
    agendado: "Agendado",
    publicado: "Publicado"
  };
  GB.chipStatus = function (m) {
    var extra = "";
    if (m.status === "agendado" && m.agendadoPara) extra = " · " + GB.fmtDataHora(m.agendadoPara);
    if (m.status === "publicado" && m.publicadoEm) extra = " · " + GB.fmtDataHora(m.publicadoEm);
    return '<span class="chip chip--' + m.status + '"><span class="chip__ponto"></span>' + STATUS[m.status] + extra + "</span>";
  };
  GB.nomeCurto = function (nome) {
    var p = String(nome || "").trim().split(/\s+/);
    return p.length > 1 ? p[0] + " " + p[p.length - 1][0] + "." : p[0] || "—";
  };
  GB.responsavel = function (m) {
    var u = GB.membroEquipe(m.publicadoPorId) || GB.membroEquipe(m.criadoPorId);
    return u ? GB.nomeCurto(u.nome) : "—";
  };
  // Séries e totais ilustrativos, compartilhados por Relatórios,
  // Meu desempenho (patrocinador) e Relatório da campanha (SECOM)
  GB.FICT = {
    serie14: [38, 42, 35, 51, 47, 58, 63, 55, 61, 72, 68, 77, 74, 82],
    impressoes: { "p-secom": 61400, "p-superm": 23800, "p-colegio": 18100, "p-imob": 6400 },
    cliques: { "p-secom": 512, "p-superm": 391, "p-colegio": 240, "p-imob": 44 },
    pixelFormatos: [
      ["970×250 · Billboard", 18400, 176],
      ["728×90 · Leaderboard", 24100, 189],
      ["300×250 · Retângulo", 11300, 92],
      ["300×600 · Meia página", 7600, 55]
    ],
    pixelPaginas: [
      ["Capa", 21700], ["Hospital Regional confirmado", 14200],
      ["O que sobrou do Lavapés", 9100], ["Editoria · Cidade", 8800], ["Demais páginas", 7600]
    ]
  };
  GB.sparkSvg = function (serie, cor) {
    var mx = Math.max.apply(null, serie);
    var pts = serie.map(function (v, i) {
      return (i * (300 / (serie.length - 1))).toFixed(1) + "," + (38 - v / mx * 34).toFixed(1);
    }).join(" ");
    return '<svg class="sparkline" viewBox="0 0 300 40" preserveAspectRatio="none"' + (cor ? ' style="--cor-acao:' + cor + '"' : "") + '><polygon class="area" points="0,40 ' + pts + ' 300,40"/><polyline points="' + pts + '"/></svg>';
  };
  GB.ONDE_RODA = {
    billboard: "Capa (topo e meio) · fim da matéria",
    leaderboard: "Corpo da matéria · topo dos sub-portais",
    retangulo: "Lateral da capa, editoria e 404",
    meiapagina: "Lateral fixa da matéria",
    rodapemobile: "Rodapé fixo no celular"
  };
  GB.chipEditoria = function (id) {
    var e = GB.editoria(id);
    return '<span class="chip chip--editoria" style="color:var(--ed-' + e.id + ', var(--cor-tinta-2))"><span class="chip__ponto"></span>' + esc(e.nome) + "</span>";
  };
  GB.materia = function (id) {
    for (var i = 0; i < GB.estado.materias.length; i++) if (GB.estado.materias[i].id === id) return GB.estado.materias[i];
    return null;
  };
  GB.nomesAutores = function (m) {
    return (m.autorIds || []).map(function (id) { var a = GB.autor(id); return a ? a.nome : id; }).join(", ") || "—";
  };

  /* ================================================================ INÍCIO */
  GB.vistas.inicio = function () {
    var u = GB.usuario();
    var ms = GB.estado.materias;
    var conta = function (st) { return ms.filter(function (m) { return m.status === st; }).length; };
    var publicadas = ms.filter(function (m) { return m.status === "publicado"; })
      .sort(function (a, b) { return (b.publicadoEm || "").localeCompare(a.publicadoEm || ""); });
    var rascunhos = ms.filter(function (m) { return m.status !== "publicado"; })
      .sort(function (a, b) { return (b.atualizadoEm || b.criadoEm || "").localeCompare(a.atualizadoEm || a.criadoEm || ""); });

    GB.topo("Bom dia, " + esc(u.nome.split(" ")[0]),
      "O que está acontecendo na redação agora.",
      GB.pode("aba:editorial") ? '<a class="btn btn--primario" href="#/editorial/nova">Nova matéria</a>' : "");

    var html =
      '<div class="grade-resumo">' +
      '<div class="cartao stat"><p class="stat__rotulo">No ar</p><p class="stat__valor">' + conta("publicado") + '</p><p class="stat__extra">matérias publicadas</p></div>' +
      '<div class="cartao stat"><p class="stat__rotulo">Rascunhos</p><p class="stat__valor">' + conta("rascunho") + '</p><p class="stat__extra">em produção</p></div>' +
      '<div class="cartao stat"><p class="stat__rotulo">Em revisão</p><p class="stat__valor">' + conta("revisao") + '</p><p class="stat__extra">aguardando um editor</p></div>' +
      '<div class="cartao stat"><p class="stat__rotulo">Agendadas</p><p class="stat__valor">' + conta("agendado") + '</p><p class="stat__extra">publicação automática</p></div>' +
      "</div>" +
      '<div class="grade-2">' +
      '<div class="cartao"><div class="cartao__cabeca"><h2 class="cartao__titulo">Últimas publicadas</h2>' +
      (GB.pode("aba:editorial") ? '<a class="btn btn--mini" href="#/editorial">Ver tudo</a>' : "") + "</div>" +
      '<div class="cartao__corpo" style="padding-top:8px">' +
      (publicadas.slice(0, 4).map(function (m) {
        return '<div class="linha-config"><div class="linha-config__info">' +
          '<p class="linha-materia__titulo">' + (GB.pode("aba:editorial") ? '<a href="#/editorial/' + m.id + '">' + esc(m.titulo) + "</a>" : esc(m.titulo)) + "</p>" +
          '<p class="linha-materia__meta">' + GB.chipEditoria(m.editoriaId) + " · " + esc(GB.nomesAutores(m)) + " · " + GB.fmtDataHora(m.publicadoEm) + "</p>" +
          '</div><span class="num" style="font-variant-numeric:tabular-nums;color:var(--cor-tinta-3);font-size:var(--fs-200)">' + GB.fmtNum(m.visualizacoes) + " visualizações</span></div>";
      }).join("") || '<p class="tabela__vazia">Nada publicado ainda.</p>') +
      "</div></div>" +
      '<div class="pilha">' +
      '<div class="cartao"><div class="cartao__cabeca"><h2 class="cartao__titulo">Continuar de onde parou</h2></div><div class="cartao__corpo" style="padding-top:8px">' +
      (rascunhos.slice(0, 3).map(function (m) {
        return '<div class="linha-config"><div class="linha-config__info">' +
          '<p class="linha-materia__titulo"><a href="#/editorial/' + m.id + '">' + esc(m.titulo || "(sem título)") + "</a></p>" +
          '<p class="linha-materia__meta">' + GB.chipStatus(m) + "</p></div></div>";
      }).join("") || '<p class="tabela__vazia">Nenhum rascunho aberto.</p>') +
      "</div></div>" +
      '<div class="aviso aviso--info"><div><strong>Demonstração navegável.</strong> Tudo o que você fizer aqui fica salvo só neste navegador. Na versão final, publicar atualiza o site em segundos, sem mexer em código.</div></div>' +
      "</div></div>";

    $("#vista").innerHTML = html;
  };

  /* ============================================================= EDITORIAL */
  var filtros = { busca: "", status: "", editoria: "", tipo: "" };

  GB.vistas.editorial = function (parametro) {
    if (parametro) { GB.vistaEditor(parametro); return; } // admin-editor.js

    GB.topo("Editorial", "Crie, revise e publique as matérias do portal.",
      '<a class="btn btn--primario" href="#/editorial/nova">Nova matéria</a>');

    $("#vista").innerHTML =
      '<div class="barra-filtros">' +
      '<input type="search" class="campo__controle" id="f-busca" placeholder="Buscar por título…" value="' + esc(filtros.busca) + '">' +
      '<select class="campo__controle" id="f-status"><option value="">Todos os status</option>' +
      Object.keys(STATUS).map(function (s) { return '<option value="' + s + '"' + (filtros.status === s ? " selected" : "") + ">" + STATUS[s] + "</option>"; }).join("") + "</select>" +
      '<select class="campo__controle" id="f-editoria"><option value="">Todas as editorias</option>' +
      GB.EDITORIAS.map(function (e) { return '<option value="' + e.id + '"' + (filtros.editoria === e.id ? " selected" : "") + ">" + e.nome + "</option>"; }).join("") + "</select>" +
      '<select class="campo__controle" id="f-tipo"><option value="">Todos os modelos</option>' +
      Object.keys(GB.TIPOS).map(function (t) { return '<option value="' + t + '"' + (filtros.tipo === t ? " selected" : "") + ">" + GB.TIPOS[t].letra + " · " + GB.TIPOS[t].nome + "</option>"; }).join("") + "</select>" +
      "</div>" +
      '<div class="cartao tabela-scroll" id="lista-materias"></div>';

    function aplicar() {
      var ms = GB.estado.materias.slice().sort(function (a, b) {
        return (b.atualizadoEm || b.publicadoEm || b.criadoEm || "").localeCompare(a.atualizadoEm || a.publicadoEm || a.criadoEm || "");
      }).filter(function (m) {
        if (filtros.status && m.status !== filtros.status) return false;
        if (filtros.editoria && m.editoriaId !== filtros.editoria) return false;
        if (filtros.tipo && m.tipo !== filtros.tipo) return false;
        if (filtros.busca && (m.titulo || "").toLowerCase().indexOf(filtros.busca.toLowerCase()) < 0) return false;
        return true;
      });

      $("#lista-materias").innerHTML = ms.length
        ? '<table class="tabela"><thead><tr><th>Matéria</th><th>Modelo</th><th>Editoria</th><th>Responsável</th><th>Status</th><th class="num">Visualizações</th><th></th></tr></thead><tbody>' +
        ms.map(function (m) {
          var t = GB.TIPOS[m.tipo];
          return "<tr>" +
            '<td><p class="linha-materia__titulo"><a href="#/editorial/' + m.id + '">' + esc(m.titulo || "(sem título)") + "</a></p>" +
            '<p class="linha-materia__meta">' + esc(GB.nomesAutores(m)) + " · atualizada " + GB.fmtDataHora(m.atualizadoEm || m.criadoEm) + "</p></td>" +
            '<td><span class="chip" title="' + t.nome + '">' + t.curto + "</span></td>" +
            "<td>" + GB.chipEditoria(m.editoriaId) + "</td>" +
            "<td>" + esc(GB.responsavel(m)) + "</td>" +
            "<td>" + GB.chipStatus(m) + "</td>" +
            '<td class="num">' + (m.status === "publicado" ? GB.fmtNum(m.visualizacoes) : "—") + "</td>" +
            '<td><div class="acoes-linha">' +
            '<a class="botao-icone" href="#/editorial/' + m.id + '" title="Editar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></a>' +
            (GB.pode("excluir")
              ? '<button type="button" class="botao-icone botao-icone--perigo" data-excluir="' + m.id + '" title="Excluir"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/></svg></button>'
              : "") +
            "</div></td></tr>";
        }).join("") + "</tbody></table>"
        : '<p class="tabela__vazia">Nenhuma matéria com esses filtros.</p>';

      $$("#lista-materias [data-excluir]").forEach(function (b) {
        b.addEventListener("click", function () {
          var m = GB.materia(b.getAttribute("data-excluir"));
          GB.confirmar("Excluir matéria", "<strong>" + esc(m.titulo) + "</strong> será excluída. Na versão final, matéria publicada excluída gera redirect para a editoria (nunca um 404 solto).", "Excluir", function () {
            GB.estado.materias = GB.estado.materias.filter(function (x) { return x.id !== m.id; });
            GB.salvar(); aplicar();
            GB.toast("Matéria excluída.");
          }, true);
        });
      });
    }

    $("#f-busca").addEventListener("input", GB.debounce(function (e) { filtros.busca = e.target.value; aplicar(); }, 200));
    ["status", "editoria", "tipo"].forEach(function (k) {
      $("#f-" + k).addEventListener("change", function (e) { filtros[k] = e.target.value; aplicar(); });
    });
    aplicar();
  };

  /* ======================================================== PATROCINADORES */
  GB.vistas.patrocinadores = function () {
    GB.topo("Patrocinadores", "A vitrine comercial: marcas, materiais gráficos e onde cada um aparece.",
      '<button type="button" class="btn btn--primario" id="novo-patro">Novo patrocinador</button>');

    var criativosDe = function (pid) {
      return GB.estado.criativos.filter(function (c) { return c.patrocinadorId === pid; });
    };

    $("#vista").innerHTML =
      '<div class="aviso" style="margin-bottom:20px"><div>Os materiais cadastrados aqui aparecem para o editorial na hora de montar a matéria — "banner X da marca Y no espaço N da página". <strong>Na Fase 3</strong>, cada patrocinador ganha login próprio com relatório das exibições.</div></div>' +
      '<div class="grade-patrocinadores">' +
      GB.estado.patrocinadores.map(function (pt) {
        var cs = criativosDe(pt.id);
        return '<div class="cartao">' +
          '<div class="patro__topo">' +
          '<span class="patro__logo" style="background:' + pt.cor + '">' + (pt.logoDataURL ? '<img src="' + pt.logoDataURL + '" alt="">' : GB.iniciais(pt.nome)) + "</span>" +
          '<div><p class="patro__nome">' + esc(pt.nome) + "</p>" +
          '<p class="patro__contato">' + esc(pt.contato || "") + "</p></div>" +
          '<span style="margin-left:auto" class="chip chip--' + (pt.status === "ativo" ? "publicado" : "pausado") + '">' + (pt.status === "ativo" ? "Ativo" : "Pausado") + "</span>" +
          "</div>" +
          '<div class="patro__corpo">' +
          (pt.dcm ? '<span class="chip chip--agendado">Tag de terceiro · DCM</span>' : "") +
          (cs.length ? cs.map(function (c) { return '<span class="chip">' + GB.rotuloFormato(c.formato) + "</span>"; }).join("") : '<span class="chip">sem materiais</span>') +
          "</div>" +
          (pt.obs ? '<div class="patro__corpo" style="padding-top:0"><p class="campo__ajuda">' + esc(pt.obs) + "</p></div>" : "") +
          '<div class="patro__acoes">' +
          '<button type="button" class="btn btn--mini" data-materiais="' + pt.id + '">Materiais (' + cs.length + ")</button>" +
          '<button type="button" class="btn btn--mini" data-editar="' + pt.id + '">Editar</button>' +
          (pt.dcm ? '<a class="btn btn--mini btn--fantasma" href="#/configuracoes/pixel">Ver a tag →</a>'
            : '<button type="button" class="btn btn--mini btn--fantasma botao-icone--perigo" data-remover="' + pt.id + '">Remover</button>') +
          "</div></div>";
      }).join("") + "</div>";

    function formPatrocinador(pt) {
      var novo = !pt;
      pt = pt || { id: GB.uid("p"), nome: "", contato: "", cor: "#1b3d77", status: "ativo" };
      GB.abrirModal(
        '<h2 class="modal__titulo">' + (novo ? "Novo patrocinador" : "Editar patrocinador") + "</h2>" +
        '<label class="campo"><span class="campo__rotulo">Nome da marca</span><input class="campo__controle" id="pt-nome" value="' + esc(pt.nome) + '"></label>' +
        '<label class="campo"><span class="campo__rotulo">Contato comercial</span><input class="campo__controle" id="pt-contato" value="' + esc(pt.contato || "") + '" placeholder="nome · telefone ou e-mail"></label>' +
        '<div class="campo"><span class="campo__rotulo">Cor da marca</span><input type="color" id="pt-cor" value="' + pt.cor + '" style="width:56px;height:34px;border:1px solid var(--cor-fio-forte);border-radius:2px;background:#fff;padding:2px">' +
        '<p class="campo__ajuda">Usada nos placeholders de anúncio enquanto a marca não envia a arte final.</p></div>' +
        '<label class="campo"><span class="campo__rotulo">Status</span><select class="campo__controle" id="pt-status">' +
        '<option value="ativo"' + (pt.status === "ativo" ? " selected" : "") + '>Ativo</option>' +
        '<option value="pausado"' + (pt.status === "pausado" ? " selected" : "") + '>Pausado</option></select></label>' +
        '<div class="modal__acoes"><button type="button" class="btn" data-modal-fecha>Cancelar</button>' +
        '<button type="button" class="btn btn--primario" id="pt-salvar">Salvar</button></div>'
      );
      $("#pt-salvar").addEventListener("click", function () {
        pt.nome = $("#pt-nome").value.trim();
        if (!pt.nome) { GB.toast("Dê um nome ao patrocinador."); return; }
        pt.contato = $("#pt-contato").value.trim();
        pt.cor = $("#pt-cor").value;
        pt.status = $("#pt-status").value;
        if (novo) GB.estado.patrocinadores.push(pt);
        GB.salvar(); GB.fecharModal(); GB.vistas.patrocinadores();
        GB.toast(novo ? "Patrocinador cadastrado." : "Patrocinador atualizado.");
      });
    }

    function modalMateriais(pt) {
      var cs = criativosDe(pt.id);
      var porFormato = {};
      cs.forEach(function (c) { (porFormato[c.formato] = porFormato[c.formato] || []).push(c); });

      GB.abrirModal(
        '<h2 class="modal__titulo">Materiais · ' + esc(pt.nome) + "</h2>" +
        '<p class="modal__texto">Um bloco para cada espaço de anúncio do site. Anexe a arte no formato certo — é o que o editorial escolhe ao montar a matéria.</p>' +
        Object.keys(GB.FORMATOS).map(function (f) {
          var lista = porFormato[f] || [];
          var dim = GB.FORMATOS[f];
          return '<div class="formato-secao">' +
            '<div class="formato-secao__cabeca"><div><strong>' + GB.rotuloFormato(f) + "</strong>" +
            '<p class="campo__ajuda" style="margin:2px 0 0">' + (GB.ONDE_RODA[f] || "") + "</p></div>" +
            (pt.dcm ? "" : '<div style="display:flex;gap:6px">' +
              '<button type="button" class="btn btn--mini btn--primario" data-anexar="' + f + '">Anexar arquivo</button>' +
              '<button type="button" class="btn btn--mini" data-placeholder="' + f + '" title="Gera uma arte temporária com a cor da marca">Placeholder</button></div>') +
            "</div>" +
            (lista.length ? lista.map(function (c) {
              return '<div class="criativo-linha">' +
                (c.origem === "pdf"
                  ? '<div class="criativo-linha__thumb criativo-linha__thumb--pdf">PDF</div>'
                  : '<div class="criativo-linha__thumb"><img src="' + GB.srcCriativo(c) + '" alt=""></div>') +
                '<div class="criativo-linha__info"><p class="criativo-linha__nome">' + esc(c.nome) + "</p>" +
                '<p class="criativo-linha__meta">' + dim.l + "×" + dim.a +
                (c.origem === "dcm" ? " · tag DCM — o banner real vem do servidor do governo" : "") +
                (c.origem === "pdf" ? " · arquivo anexado (na versão final, convertido no upload)" : "") +
                (c.destino ? " · abre " + esc(c.destino) : "") + "</p></div>" +
                (c.origem !== "dcm" ? '<button type="button" class="botao-icone botao-icone--perigo" data-rm-criativo="' + c.id + '" title="Remover"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/></svg></button>' : "") +
                "</div>";
            }).join("") : '<p class="formato-secao__vazio">Nenhum exemplo anexado neste formato.</p>') +
            "</div>";
        }).join("") +
        '<div class="modal__acoes"><button type="button" class="btn" data-modal-fecha>Fechar</button></div>',
        true
      );

      function religar() { GB.vistas.patrocinadores(); modalMateriais(pt); }

      $$("#modal-caixa [data-rm-criativo]").forEach(function (b) {
        b.addEventListener("click", function () {
          GB.estado.criativos = GB.estado.criativos.filter(function (c) { return c.id !== b.getAttribute("data-rm-criativo"); });
          GB.salvar(); religar();
        });
      });
      $$("#modal-caixa [data-anexar]").forEach(function (b) {
        b.addEventListener("click", function () {
          var formato = b.getAttribute("data-anexar");
          var input = $("#arquivo-imagem");
          input.value = "";
          input.onchange = function () {
            var f = input.files[0];
            if (!f) return;
            if (f.type === "application/pdf") {
              GB.estado.criativos.push({ id: GB.uid("c"), patrocinadorId: pt.id, formato: formato, nome: f.name, origem: "pdf" });
              GB.salvar(); religar();
              GB.toast("PDF anexado como referência do formato.");
              return;
            }
            GB.processarImagem(f, function (proc) {
              GB.estado.criativos.push({ id: GB.uid("c"), patrocinadorId: pt.id, formato: formato, nome: f.name.replace(/\.[a-z0-9]+$/i, ""), origem: "upload", dataURL: proc.dataURL });
              GB.salvar(); religar();
              GB.toast("Arte anexada — já aparece para o editorial.");
            });
          };
          input.click();
        });
      });
      $$("#modal-caixa [data-placeholder]").forEach(function (b) {
        b.addEventListener("click", function () {
          var formato = b.getAttribute("data-placeholder");
          GB.estado.criativos.push({ id: GB.uid("c"), patrocinadorId: pt.id, formato: formato, nome: pt.nome + " · " + GB.rotuloFormato(formato), origem: "placeholder" });
          GB.salvar(); religar();
        });
      });
    }

    $("#novo-patro").addEventListener("click", function () { formPatrocinador(null); });
    $$("#vista [data-editar]").forEach(function (b) {
      b.addEventListener("click", function () { formPatrocinador(GB.patrocinador(b.getAttribute("data-editar"))); });
    });
    $$("#vista [data-materiais]").forEach(function (b) {
      b.addEventListener("click", function () { modalMateriais(GB.patrocinador(b.getAttribute("data-materiais"))); });
    });
    $$("#vista [data-remover]").forEach(function (b) {
      b.addEventListener("click", function () {
        var pt = GB.patrocinador(b.getAttribute("data-remover"));
        GB.confirmar("Remover patrocinador", "<strong>" + esc(pt.nome) + "</strong> e os materiais dele saem da vitrine. Matérias que usavam esses banners voltam para a rotação automática.", "Remover", function () {
          GB.estado.patrocinadores = GB.estado.patrocinadores.filter(function (x) { return x.id !== pt.id; });
          GB.estado.criativos = GB.estado.criativos.filter(function (c) { return c.patrocinadorId !== pt.id; });
          GB.salvar(); GB.vistas.patrocinadores();
        }, true);
      });
    });
  };

  /* ============================================================ RELATÓRIOS */
  GB.vistas.relatorios = function () {
    GB.topo("Relatórios", "Leitura e anúncios — visão de demonstração.");

    var pub = GB.estado.materias.filter(function (m) { return m.status === "publicado"; });
    var maisLidas = pub.slice().sort(function (a, b) { return (b.visualizacoes || 0) - (a.visualizacoes || 0); }).slice(0, 5);
    var maxV = maisLidas.length ? maisLidas[0].visualizacoes || 1 : 1;

    var porEd = {};
    pub.forEach(function (m) { porEd[m.editoriaId] = (porEd[m.editoriaId] || 0) + 1; });
    var edLista = Object.keys(porEd).map(function (id) { return { id: id, n: porEd[id] }; })
      .sort(function (a, b) { return b.n - a.n; });
    var maxEd = edLista.length ? edLista[0].n : 1;

    var serie = GB.FICT.serie14;
    var maxS = Math.max.apply(null, serie);
    var pontos = serie.map(function (v, i) {
      return (i * (300 / (serie.length - 1))).toFixed(1) + "," + (38 - v / maxS * 34).toFixed(1);
    }).join(" ");

    var fict = { visualizacoes30d: 48230, leitores: 19480, impressoes: GB.FICT.impressoes, cliques: GB.FICT.cliques };

    $("#vista").innerHTML =
      '<div class="aviso" style="margin-bottom:20px"><div><strong>Dados ilustrativos.</strong> Na versão final, esta tela é alimentada pelo banco (visualizações reais por matéria e métricas agregadas de anúncio — impressão e clique, sem rastreio individual, conforme LGPD).</div></div>' +
      '<div class="grade-resumo">' +
      '<div class="cartao stat"><p class="stat__rotulo">Visualizações · 30 dias</p><p class="stat__valor">' + GB.fmtNum(fict.visualizacoes30d) + "</p>" +
      '<svg class="sparkline" viewBox="0 0 300 40" preserveAspectRatio="none"><polygon class="area" points="0,40 ' + pontos + ' 300,40"/><polyline points="' + pontos + '"/></svg></div>' +
      '<div class="cartao stat"><p class="stat__rotulo">Leitores únicos</p><p class="stat__valor">' + GB.fmtNum(fict.leitores) + '</p><p class="stat__extra">estimativa 30 dias</p></div>' +
      '<div class="cartao stat"><p class="stat__rotulo">Publicadas no mês</p><p class="stat__valor">' +
      pub.filter(function (m) { return (m.publicadoEm || "").slice(0, 7) === "2026-08"; }).length +
      '</p><p class="stat__extra">agosto de 2026</p></div>' +
      '<div class="cartao stat"><p class="stat__rotulo">CTR médio · anúncios</p><p class="stat__valor">0,9%</p><p class="stat__extra">cliques / impressões</p></div>' +
      "</div>" +
      '<div class="grade-2">' +
      '<div class="pilha">' +
      '<div class="cartao"><div class="cartao__cabeca"><h2 class="cartao__titulo">Mais lidas</h2></div><div class="cartao__corpo"><div class="barras">' +
      maisLidas.map(function (m) {
        return '<div class="barra-h" style="--cor-editoria:var(--ed-' + m.editoriaId + ')">' +
          '<span class="barra-h__nome" title="' + esc(m.titulo) + '">' + esc(m.titulo) + "</span>" +
          '<span class="barra-h__trilha"><span class="barra-h__fill" style="width:' + Math.round((m.visualizacoes || 0) / maxV * 100) + '%"></span></span>' +
          '<span class="barra-h__valor">' + GB.fmtNum(m.visualizacoes) + "</span></div>";
      }).join("") + "</div></div></div>" +
      '<div class="cartao"><div class="cartao__cabeca"><h2 class="cartao__titulo">Anúncios por patrocinador</h2></div><div class="cartao__corpo tabela-scroll" style="padding:0">' +
      '<table class="tabela"><thead><tr><th>Patrocinador</th><th class="num">Impressões</th><th class="num">Cliques</th><th class="num">CTR</th></tr></thead><tbody>' +
      GB.estado.patrocinadores.map(function (pt) {
        var imp = fict.impressoes[pt.id] || 0, cli = fict.cliques[pt.id] || 0;
        return "<tr><td><strong>" + esc(pt.nome) + "</strong>" + (pt.dcm ? ' <span class="chip chip--agendado">DCM</span>' : "") + "</td>" +
          '<td class="num">' + GB.fmtNum(imp) + '</td><td class="num">' + GB.fmtNum(cli) + '</td><td class="num">' +
          (imp ? (cli / imp * 100).toFixed(1).replace(".", ",") + "%" : "—") + "</td></tr>";
      }).join("") + "</tbody></table></div></div>" +
      "</div>" +
      '<div class="cartao"><div class="cartao__cabeca"><h2 class="cartao__titulo">Publicações por editoria</h2></div><div class="cartao__corpo"><div class="barras">' +
      edLista.map(function (e) {
        return '<div class="barra-h" style="--cor-editoria:var(--ed-' + e.id + ')">' +
          '<span class="barra-h__nome">' + esc(GB.editoria(e.id).nome) + "</span>" +
          '<span class="barra-h__trilha"><span class="barra-h__fill" style="width:' + Math.round(e.n / maxEd * 100) + '%"></span></span>' +
          '<span class="barra-h__valor">' + e.n + "</span></div>";
      }).join("") + "</div></div></div>" +
      "</div>";
  };

  /* ============================================== RELATÓRIO DO PIXEL (PDF) */
  GB.modalRelatorioPixel = function () {
    var cfg = GB.estado.config, px = cfg.pixel;
    var totalImp = GB.FICT.impressoes["p-secom"], totalCli = GB.FICT.cliques["p-secom"];
    GB.abrirModal(
      '<div id="relatorio-pixel">' +
      '<p class="cartao__titulo" style="margin:0 0 4px">Gazeta Bragantina · relatório de campanha</p>' +
      '<h2 class="modal__titulo">' + esc(px.campanha) + "</h2>" +
      '<p class="modal__texto" style="margin-bottom:16px">Placement <code class="inline">' + esc(px.placement) + "</code><br>Período de referência: últimos 30 dias · emitido em " + GB.fmtData(new Date().toISOString()) + "</p>" +
      '<table class="tabela" style="margin-bottom:16px"><tbody>' +
      "<tr><td><strong>Impressões</strong></td><td class=\"num\">" + GB.fmtNum(totalImp) + "</td></tr>" +
      "<tr><td><strong>Cliques</strong></td><td class=\"num\">" + GB.fmtNum(totalCli) + "</td></tr>" +
      "<tr><td><strong>CTR</strong></td><td class=\"num\">" + (totalCli / totalImp * 100).toFixed(2).replace(".", ",") + "%</td></tr>" +
      "<tr><td><strong>Visibilidade (IAB)</strong></td><td class=\"num\">68%</td></tr></tbody></table>" +
      '<table class="tabela"><thead><tr><th>Formato</th><th class="num">Impressões</th><th class="num">Cliques</th></tr></thead><tbody>' +
      GB.FICT.pixelFormatos.map(function (r) {
        return "<tr><td>" + r[0] + '</td><td class="num">' + GB.fmtNum(r[1]) + '</td><td class="num">' + GB.fmtNum(r[2]) + "</td></tr>";
      }).join("") + "</tbody></table>" +
      '<p class="campo__ajuda" style="margin-top:12px">Dados ilustrativos da demonstração — na versão final, gerados do log real de veiculação.</p>' +
      "</div>" +
      '<div class="modal__acoes"><button type="button" class="btn" data-modal-fecha>Fechar</button>' +
      '<button type="button" class="btn btn--primario" id="rel-imprimir">Imprimir / salvar PDF</button></div>',
      true
    );
    $("#rel-imprimir").addEventListener("click", function () { window.print(); });
  };

  /* ============================================ MEU DESEMPENHO (externo) */
  GB.vistas.desempenho = function () {
    var u = GB.usuario();
    var pt = GB.patrocinador(u.patrocinadorId);
    if (!pt) { $("#vista").innerHTML = '<p class="tabela__vazia">Patrocinador não encontrado.</p>'; return; }
    GB.topo("Olá, " + esc(GB.nomeCurto(u.nome)), "Desempenho dos anúncios de " + esc(pt.nome) + " no portal.");
    var imp = GB.FICT.impressoes[pt.id] || 0, cli = GB.FICT.cliques[pt.id] || 0;
    var meus = GB.estado.criativos.filter(function (c) { return c.patrocinadorId === pt.id; });
    var aparicoes = [];
    GB.estado.materias.forEach(function (m) {
      Object.keys(m.anuncios || {}).forEach(function (slot) {
        var c = GB.criativo(m.anuncios[slot]);
        if (c && c.patrocinadorId === pt.id) aparicoes.push({ m: m, slot: slot, c: c });
      });
    });
    var serie = GB.FICT.serie14.map(function (v, i) { return Math.round(v * (0.4 + (i % 3) * 0.1)); });
    $("#vista").innerHTML =
      '<div class="aviso aviso--info" style="margin-bottom:20px"><div><strong>Acesso de patrocinador.</strong> Você enxerga apenas os números dos seus próprios anúncios — nada do conteúdo editorial ou de outros anunciantes. Dados ilustrativos da demonstração.</div></div>' +
      '<div class="grade-resumo">' +
      '<div class="cartao stat"><p class="stat__rotulo">Impressões · 30 dias</p><p class="stat__valor">' + GB.fmtNum(imp) + "</p>" + GB.sparkSvg(serie) + "</div>" +
      '<div class="cartao stat"><p class="stat__rotulo">Cliques</p><p class="stat__valor">' + GB.fmtNum(cli) + "</p></div>" +
      '<div class="cartao stat"><p class="stat__rotulo">CTR</p><p class="stat__valor">' + (imp ? (cli / imp * 100).toFixed(2).replace(".", ",") : "0") + "%</p></div>" +
      '<div class="cartao stat"><p class="stat__rotulo">Materiais ativos</p><p class="stat__valor">' + meus.length + "</p></div>" +
      "</div>" +
      '<div class="grade-2"><div class="pilha">' +
      '<div class="cartao"><div class="cartao__cabeca"><h2 class="cartao__titulo">Onde seus anúncios estão agora</h2></div><div class="cartao__corpo" style="padding-top:8px">' +
      (aparicoes.length ? aparicoes.map(function (a) {
        return '<div class="linha-config"><div class="linha-config__info"><p class="linha-materia__titulo">' + esc(a.m.titulo) + "</p>" +
          '<p class="linha-materia__meta">' + esc(a.c.nome) + " · " + GB.rotuloFormato(a.c.formato) + "</p></div>" + GB.chipStatus(a.m) + "</div>";
      }).join("") : '<p class="tabela__vazia">Nenhuma veiculação fixa agora — seus materiais entram na rotação automática.</p>') +
      "</div></div></div>" +
      '<div class="cartao"><div class="cartao__cabeca"><h2 class="cartao__titulo">Seus materiais</h2></div><div class="cartao__corpo" style="padding-top:8px">' +
      (meus.length ? meus.map(function (c) {
        return '<div class="criativo-linha">' +
          (c.origem === "pdf" ? '<div class="criativo-linha__thumb criativo-linha__thumb--pdf">PDF</div>' : '<div class="criativo-linha__thumb"><img src="' + GB.srcCriativo(c) + '" alt=""></div>') +
          '<div class="criativo-linha__info"><p class="criativo-linha__nome">' + esc(c.nome) + "</p>" +
          '<p class="criativo-linha__meta">' + GB.rotuloFormato(c.formato) + "</p></div></div>";
      }).join("") : '<p class="tabela__vazia">Nenhum material cadastrado.</p>') +
      "</div></div></div>";
  };

  /* ======================================== RELATÓRIO DA CAMPANHA (SECOM) */
  GB.vistas["pixel-secom"] = function () {
    var px = GB.estado.config.pixel;
    var totalImp = GB.FICT.impressoes["p-secom"], totalCli = GB.FICT.cliques["p-secom"];
    GB.topo("Relatório da campanha", esc(px.campanha),
      '<button type="button" class="btn btn--primario" id="secom-relatorio">Emitir relatório (PDF)</button>');
    $("#vista").innerHTML =
      '<div class="aviso aviso--info" style="margin-bottom:20px"><div><strong>Acesso externo · SECOM.</strong> Esta conta enxerga apenas a veiculação da campanha do governo no portal — sem acesso ao editorial. Placement <code class="inline">' + esc(px.placement) + "</code>. Dados ilustrativos.</div></div>" +
      '<div class="grade-resumo">' +
      '<div class="cartao stat"><p class="stat__rotulo">Impressões · 30 dias</p><p class="stat__valor">' + GB.fmtNum(totalImp) + "</p>" + GB.sparkSvg(GB.FICT.serie14) + "</div>" +
      '<div class="cartao stat"><p class="stat__rotulo">Cliques</p><p class="stat__valor">' + GB.fmtNum(totalCli) + "</p></div>" +
      '<div class="cartao stat"><p class="stat__rotulo">CTR</p><p class="stat__valor">' + (totalCli / totalImp * 100).toFixed(2).replace(".", ",") + "%</p></div>" +
      '<div class="cartao stat"><p class="stat__rotulo">Visibilidade</p><p class="stat__valor">68%</p><p class="stat__extra">padrão IAB</p></div>' +
      "</div>" +
      '<div class="grade-2">' +
      '<div class="cartao"><div class="cartao__cabeca"><h2 class="cartao__titulo">Por formato</h2></div><div class="cartao__corpo tabela-scroll" style="padding:0">' +
      '<table class="tabela"><thead><tr><th>Formato</th><th class="num">Impressões</th><th class="num">Cliques</th><th class="num">CTR</th></tr></thead><tbody>' +
      GB.FICT.pixelFormatos.map(function (r) {
        return "<tr><td><strong>" + r[0] + '</strong></td><td class="num">' + GB.fmtNum(r[1]) + '</td><td class="num">' + GB.fmtNum(r[2]) + '</td><td class="num">' + (r[2] / r[1] * 100).toFixed(2).replace(".", ",") + "%</td></tr>";
      }).join("") + "</tbody></table></div></div>" +
      '<div class="cartao"><div class="cartao__cabeca"><h2 class="cartao__titulo">Páginas com mais impressões</h2></div><div class="cartao__corpo"><div class="barras">' +
      GB.FICT.pixelPaginas.map(function (r) {
        return '<div class="barra-h"><span class="barra-h__nome">' + r[0] + '</span><span class="barra-h__trilha"><span class="barra-h__fill" style="width:' + Math.round(r[1] / GB.FICT.pixelPaginas[0][1] * 100) + '%;background:var(--cor-acao)"></span></span><span class="barra-h__valor">' + GB.fmtNum(r[1]) + "</span></div>";
      }).join("") + "</div></div></div></div>";
    $("#secom-relatorio").addEventListener("click", function () { GB.modalRelatorioPixel(); });
  };

  /* ============================================================ ASSINATURA */
  GB.vistas.assinatura = function () {
    var cfg = GB.estado.config;
    var ass = cfg.assinatura = cfg.assinatura || { mensal: "12,90", anual: "129,00" };
    GB.topo("Assinatura", "Conceito para o segundo momento — leitores pagantes com acesso a exclusividades.");
    var exclusivas = GB.estado.materias.filter(function (m) { return (m.acesso || "livre") !== "livre"; });
    $("#vista").innerHTML =
      '<div class="aviso" style="margin-bottom:20px"><div><strong>Fase futura — demonstração de conceito.</strong> Nada aqui é cobrado nem vai ao ar: é o desenho de como a Gazeta pode vender assinatura quando a base de leitores existir (cadastro → newsletter → assinatura).</div></div>' +
      '<div class="grade-resumo">' +
      '<div class="cartao stat"><p class="stat__rotulo">Assinantes</p><p class="stat__valor">0</p><p class="stat__extra">pré-lançamento</p></div>' +
      '<div class="cartao stat"><p class="stat__rotulo">Receita mensal</p><p class="stat__valor">R$ 0</p><p class="stat__extra">projeção com 300 assinantes: R$ ' + (300 * parseFloat(ass.mensal.replace(",", ".")) ).toFixed(0) + "</p></div>" +
      '<div class="cartao stat"><p class="stat__rotulo">Matérias exclusivas</p><p class="stat__valor">' + exclusivas.length + '</p><p class="stat__extra">marcadas no editor</p></div>' +
      '<div class="cartao stat"><p class="stat__rotulo">Meta · 1º ano</p><p class="stat__valor">300</p><p class="stat__extra">≈ 1,5% dos leitores únicos</p></div>' +
      "</div>" +
      '<div class="grade-2"><div class="pilha">' +
      '<div class="cartao"><div class="cartao__cabeca"><h2 class="cartao__titulo">O que o assinante recebe</h2></div><div class="cartao__corpo" style="padding-top:8px">' +
      [
        ["Matérias exclusivas", "Reportagens especiais e colunas marcadas como \"assinante\" no editor — o campo já existe no modelo de dados."],
        ["Newsletter do assinante", "Edição comentada da semana, escrita pela redação, só para quem paga."],
        ["Clube de vantagens local", "Descontos nos patrocinadores da vitrine — conecta o comercial ao produto de assinatura."],
        ["Leitura sem anúncios", "O AdSlot já sabe esconder anúncio por leitor — é uma regra, não uma reforma."],
        ["Acervo histórico", "Busca completa nas 7.577 matérias migradas do site antigo."]
      ].map(function (par) {
        return '<div class="linha-config"><div class="linha-config__info"><div class="linha-config__nome">' + par[0] + '</div><div class="linha-config__desc">' + par[1] + "</div></div></div>";
      }).join("") + "</div></div>" +
      '<div class="cartao"><div class="cartao__cabeca"><h2 class="cartao__titulo">Matérias exclusivas</h2></div><div class="cartao__corpo" style="padding-top:8px">' +
      (exclusivas.length ? exclusivas.map(function (m) {
        return '<div class="linha-config"><div class="linha-config__info"><p class="linha-materia__titulo"><a href="#/editorial/' + m.id + '">' + esc(m.titulo) + "</a></p>" +
          '<p class="linha-materia__meta">' + GB.chipEditoria(m.editoriaId) + "</p></div><span class=\"chip chip--agendado\">" + (m.acesso === "assinante" ? "Assinantes" : "Cadastro") + "</span></div>";
      }).join("") : '<p class="tabela__vazia">Nenhuma ainda — marque no editor, em Organização → Acesso.</p>') +
      '<p class="campo__ajuda" style="margin-top:8px">Na pré-visualização, matéria exclusiva mostra o paywall como o leitor não assinante veria.</p>' +
      "</div></div></div>" +
      '<div class="pilha">' +
      '<div class="cartao"><div class="cartao__cabeca"><h2 class="cartao__titulo">Planos</h2></div><div class="cartao__corpo">' +
      '<label class="campo"><span class="campo__rotulo">Mensal (R$)</span><input class="campo__controle" id="ass-mensal" value="' + esc(ass.mensal) + '"></label>' +
      '<label class="campo"><span class="campo__rotulo">Anual (R$)</span><input class="campo__controle" id="ass-anual" value="' + esc(ass.anual) + '"></label>' +
      '<p class="campo__ajuda">Preços de referência para a conversa com a Gazeta — nada é cobrado na demo.</p>' +
      "</div></div>" +
      '<div class="cartao"><div class="cartao__cabeca"><h2 class="cartao__titulo">Como entra no ar (fase 3)</h2></div><div class="cartao__corpo" style="padding-top:8px">' +
      [
        "Cadastro de leitores (Supabase Auth) — já previsto no roadmap",
        "Cobrança recorrente (Mercado Pago / Pagar.me)",
        "Regra de acesso no banco: matéria \"assinante\" só sai para quem tem plano ativo",
        "Área do leitor com gestão da assinatura"
      ].map(function (t, i) {
        return '<div class="linha-config"><div class="linha-config__info"><div class="linha-config__nome">' + (i + 1) + ". " + t + "</div></div></div>";
      }).join("") + "</div></div></div></div>";
    ["mensal", "anual"].forEach(function (k) {
      $("#ass-" + k).addEventListener("input", GB.debounce(function (e) { ass[k] = e.target.value; GB.salvar(); }, 400));
    });
  };

  /* ========================================================= CONFIGURAÇÕES */
  GB.vistas.configuracoes = function (sub) {
    sub = sub || "geral";
    GB.topo("Configurações", "Tudo o que é configurável do portal — sem mexer em código.");
    var cfg = GB.estado.config;

    var abas = [
      ["geral", "Geral"], ["equipe", "Equipe e permissões"], ["editorias", "Editorias"],
      ["pixel", "Pixel e anúncios"], ["demo", "Dados da demo"]
    ];
    var html = '<div class="sub-abas">' + abas.map(function (a) {
      return '<a class="sub-aba' + (sub === a[0] ? " esta-ativo" : "") + '" href="#/configuracoes/' + a[0] + '">' + a[1] + "</a>";
    }).join("") + "</div>";

    if (sub === "geral") {
      html += '<div class="grade-2"><div class="pilha">' +
        '<div class="cartao"><div class="cartao__cabeca"><h2 class="cartao__titulo">Identidade</h2></div><div class="cartao__corpo">' +
        '<label class="campo"><span class="campo__rotulo">Nome do site</span><input class="campo__controle" data-cfg="nomeSite" value="' + esc(cfg.nomeSite) + '"></label>' +
        '<label class="campo"><span class="campo__rotulo">Cidade na barra do topo</span><input class="campo__controle" data-cfg="cidadeTopbar" value="' + esc(cfg.cidadeTopbar) + '"></label>' +
        '<label class="campo"><span class="campo__rotulo">Rótulo do botão do cabeçalho</span><input class="campo__controle" data-cfg="rotuloCabecalho" value="' + esc(cfg.rotuloCabecalho) + '">' +
        '<p class="campo__ajuda">Decisão §7.9 da arquitetura: "Receber notícias" até a assinatura existir.</p></label>' +
        "</div></div></div>" +
        '<div class="cartao"><div class="cartao__cabeca"><h2 class="cartao__titulo">Plantão (urgente)</h2></div><div class="cartao__corpo">' +
        '<div class="linha-config"><div class="linha-config__info"><div class="linha-config__nome">Barra de plantão ligada</div>' +
        '<div class="linha-config__desc">A faixa vermelha no topo do site, para notícia urgente.</div></div>' +
        '<span class="interruptor"><input type="checkbox" id="plantao-ativo"' + (cfg.plantao.ativo ? " checked" : "") + '><span class="interruptor__trilha"></span></span></div>' +
        '<label class="campo"><span class="campo__rotulo">Texto do plantão</span><textarea class="campo__controle" id="plantao-texto" rows="2">' + esc(cfg.plantao.texto) + "</textarea></label>" +
        "</div></div></div>";
    }

    if (sub === "equipe") {
      var pm = GB.estado.permissoes;
      html += '<div class="pilha">' +
        '<div class="cartao"><div class="cartao__cabeca"><h2 class="cartao__titulo">Funcionários</h2>' +
        (GB.pode("equipe") ? '<button type="button" class="btn btn--mini btn--primario" id="novo-usuario">Cadastrar funcionário</button>' : "") +
        '</div><div class="cartao__corpo tabela-scroll" style="padding:0"><table class="tabela"><thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th></th></tr></thead><tbody>' +
        GB.estado.equipe.map(function (u) {
          return "<tr><td><strong>" + esc(u.nome) + "</strong>" + (u.id === GB.estado.usuarioAtual ? ' <span class="chip">você</span>' : "") + "</td>" +
            "<td>" + esc(u.email) + "</td>" +
            "<td>" + (GB.pode("equipe") && u.papel !== "administrador"
              ? '<select class="campo__controle" data-papel-de="' + u.id + '">' + Object.keys(GB.PAPEIS_BASE).map(function (pp) {
                return '<option value="' + pp + '"' + (u.papel === pp ? " selected" : "") + ">" + GB.rotuloPapel(pp) + "</option>";
              }).join("") + "</select>"
              : GB.rotuloPapel(u.papel)) + "</td>" +
            "<td>" + (GB.pode("equipe") && u.papel !== "administrador" && u.id !== GB.estado.usuarioAtual
              ? '<button type="button" class="botao-icone botao-icone--perigo" data-rm-usuario="' + u.id + '" title="Remover"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/></svg></button>' : "") + "</td></tr>";
        }).join("") + "</tbody></table></div></div>" +
        '<div class="cartao"><div class="cartao__cabeca"><h2 class="cartao__titulo">O que cada papel pode fazer</h2></div><div class="cartao__corpo tabela-scroll">' +
        '<table class="matriz"><thead><tr><th>Papel</th>' +
        GB.ABAS.map(function (a) { return "<th>" + a.rotulo + "</th>"; }).join("") +
        "<th>Publicar</th><th>Excluir matéria</th><th>Gerenciar equipe</th></tr></thead><tbody>" +
        Object.keys(pm).map(function (papel) {
          var travado = papel === "administrador" || !GB.pode("equipe");
          var linha = pm[papel];
          function cb(caminho, marcado) {
            return '<input type="checkbox" data-perm="' + papel + ":" + caminho + '"' + (marcado ? " checked" : "") + (travado ? " disabled" : "") + ">";
          }
          return "<tr><td><strong>" + GB.rotuloPapel(papel) + "</strong></td>" +
            GB.ABAS.map(function (a) { return "<td>" + cb("abas." + a.id, linha.abas[a.id]) + "</td>"; }).join("") +
            "<td>" + cb("publicar", linha.publicar) + "</td>" +
            "<td>" + cb("excluir", linha.excluir) + "</td>" +
            "<td>" + cb("equipe", linha.equipe) + "</td></tr>";
        }).join("") + "</tbody></table>" +
        '<p class="campo__ajuda" style="margin-top:12px">Na versão final, esta matriz vira as regras de acesso do banco (Supabase Auth + RLS) — o funcionário só enxerga o que o papel dele permite, inclusive na API.</p>' +
        "</div></div></div>";
    }

    if (sub === "editorias") {
      html += '<div class="cartao"><div class="cartao__cabeca"><h2 class="cartao__titulo">Ordem e visibilidade no menu</h2></div><div class="cartao__corpo">' +
        cfg.editorias.map(function (e, i) {
          var ed = GB.editoria(e.id);
          return '<div class="linha-config"><div class="linha-config__info"><div class="linha-config__nome">' +
            '<span class="cor-ponto" style="background:var(--ed-' + e.id + ')"></span>' + esc(ed.nome) + "</div></div>" +
            '<div style="display:flex;gap:8px;align-items:center">' +
            '<button type="button" class="botao-icone" data-ed-sobe="' + i + '"' + (i === 0 ? " disabled style='opacity:.3'" : "") + ' title="Subir"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 14 6-6 6 6"/></svg></button>' +
            '<button type="button" class="botao-icone" data-ed-desce="' + i + '"' + (i === cfg.editorias.length - 1 ? " disabled style='opacity:.3'" : "") + ' title="Descer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 10 6 6 6-6"/></svg></button>' +
            '<span class="interruptor" title="Visível no menu"><input type="checkbox" data-ed-visivel="' + i + '"' + (e.visivel ? " checked" : "") + '><span class="interruptor__trilha"></span></span>' +
            "</div></div>";
        }).join("") +
        '<p class="campo__ajuda" style="margin-top:12px">A ordem final é decisão da redação (§8 da arquitetura) — esta tela é onde ela vira configuração, não código.</p>' +
        "</div></div>";
    }

    if (sub === "pixel") {
      var px = cfg.pixel;
      var totalImp = GB.FICT.impressoes["p-secom"], totalCli = GB.FICT.cliques["p-secom"];
      var insightsHtml =
        '<div class="grade-resumo" style="margin-top:20px">' +
        '<div class="cartao stat"><p class="stat__rotulo">Impressões · 30 dias</p><p class="stat__valor">' + GB.fmtNum(totalImp) + "</p>" + GB.sparkSvg(GB.FICT.serie14) + "</div>" +
        '<div class="cartao stat"><p class="stat__rotulo">Cliques</p><p class="stat__valor">' + GB.fmtNum(totalCli) + '</p><p class="stat__extra">CTR ' + (totalCli / totalImp * 100).toFixed(2).replace(".", ",") + "%</p></div>" +
        '<div class="cartao stat"><p class="stat__rotulo">Visibilidade</p><p class="stat__valor">68%</p><p class="stat__extra">impressões visíveis (padrão IAB)</p></div>' +
        '<div class="cartao stat"><p class="stat__rotulo">Saúde da tag</p><p class="stat__valor" style="color:var(--cor-sucesso)">no ar</p><p class="stat__extra">última resposta há poucos minutos</p></div>' +
        "</div>" +
        '<div class="grade-2" style="margin-top:20px">' +
        '<div class="cartao"><div class="cartao__cabeca"><h2 class="cartao__titulo">Por formato</h2></div><div class="cartao__corpo tabela-scroll" style="padding:0">' +
        '<table class="tabela"><thead><tr><th>Formato</th><th class="num">Impressões</th><th class="num">Cliques</th><th class="num">CTR</th></tr></thead><tbody>' +
        GB.FICT.pixelFormatos.map(function (r) {
          return "<tr><td><strong>" + r[0] + '</strong></td><td class="num">' + GB.fmtNum(r[1]) + '</td><td class="num">' + GB.fmtNum(r[2]) + '</td><td class="num">' + (r[2] / r[1] * 100).toFixed(2).replace(".", ",") + "%</td></tr>";
        }).join("") + "</tbody></table></div></div>" +
        '<div class="cartao"><div class="cartao__cabeca"><h2 class="cartao__titulo">Páginas com mais impressões</h2></div><div class="cartao__corpo"><div class="barras">' +
        GB.FICT.pixelPaginas.map(function (r) {
          return '<div class="barra-h"><span class="barra-h__nome">' + r[0] + '</span><span class="barra-h__trilha"><span class="barra-h__fill" style="width:' + Math.round(r[1] / GB.FICT.pixelPaginas[0][1] * 100) + '%;background:var(--cor-acao)"></span></span><span class="barra-h__valor">' + GB.fmtNum(r[1]) + "</span></div>";
        }).join("") + "</div></div></div></div>" +
        '<p class="campo__ajuda" style="margin-top:8px">Dados ilustrativos — na versão final vêm do log agregado do AdSlot (impressão e clique por dia, sem rastreio individual).</p>';

      var acessoSecomHtml =
        '<div class="cartao" style="margin-top:20px"><div class="cartao__cabeca"><h2 class="cartao__titulo">Acesso externo · equipe SECOM</h2>' +
        '<button type="button" class="btn btn--mini btn--primario" id="px-relatorio">Emitir relatório (PDF)</button></div>' +
        '<div class="cartao__corpo">' +
        '<div class="linha-config"><div class="linha-config__info"><div class="linha-config__nome">Equipe SECOM (Baila) <span class="chip chip--agendado">externo</span></div>' +
        '<div class="linha-config__desc">relatorios@baila.com.br — entra pelo mesmo painel e enxerga só esta página de campanha, com o botão de emitir relatório. Nada do editorial fica visível.</div></div>' +
        '<button type="button" class="btn btn--mini" id="px-ver-como">Ver como SECOM</button></div>' +
        "</div></div>";

      var tagExemplo = "<ins class='dcmads' style='display:inline-block;width:728px;height:90px'\n     data-dcm-placement='" + px.placement + "'\n     data-dcm-rendering-mode='iframe'\n     data-dcm-https-only …>\n  <script src='https://www.googletagservices.com/dcm/dcmads.js'><\/script>\n</ins>";
      html += '<div class="grade-2"><div class="pilha">' +
        '<div class="cartao"><div class="cartao__cabeca"><h2 class="cartao__titulo">Pixel do governo · tag DCM (SECOM)</h2>' +
        '<span class="chip ' + (px.ativo ? "chip--publicado" : "chip--pausado") + '">' + (px.ativo ? "Instalado" : "Desligado") + "</span></div>" +
        '<div class="cartao__corpo">' +
        '<div class="linha-config"><div class="linha-config__info"><div class="linha-config__nome">Carregar a tag no site</div>' +
        '<div class="linha-config__desc">' + esc(px.campanha) + "</div></div>" +
        '<span class="interruptor"><input type="checkbox" id="pixel-ativo"' + (px.ativo ? " checked" : "") + '><span class="interruptor__trilha"></span></span></div>' +
        '<label class="campo"><span class="campo__rotulo">Placement</span><input class="campo__controle" id="pixel-placement" style="font-family:ui-monospace,Consolas,monospace;font-size:12px" value="' + esc(px.placement) + '"></label>' +
        '<div class="aviso" style="margin-top:16px"><div><strong>Flight ' + esc(px.flight) + ".</strong> " + esc(px.obs) + "</div></div>" +
        '<details style="margin-top:16px"><summary style="cursor:pointer;font-weight:700;font-size:13px">Ver a tag completa</summary><pre class="codigo" style="margin-top:8px">' + esc(tagExemplo) + "</pre></details>" +
        "</div></div></div>" +
        '<div class="cartao"><div class="cartao__cabeca"><h2 class="cartao__titulo">Onde a tag roda hoje</h2></div><div class="cartao__corpo" style="padding-top:8px">' +
        [["970×250", "Capa (topo e meio) · fim da matéria"], ["728×90", "Corpo da matéria · topo dos sub-portais"], ["300×250", "Lateral da capa, editoria e 404"], ["300×600", "Lateral fixa da matéria"], ["320×50", "Rodapé mobile — sem tag (não veio no pacote da Baila)"]].map(function (par) {
          return '<div class="linha-config"><div class="linha-config__info"><div class="linha-config__nome">' + par[0] + '</div><div class="linha-config__desc">' + par[1] + "</div></div></div>";
        }).join("") +
        '<p class="campo__ajuda" style="margin-top:8px">Referência completa em <code class="inline">ANUNCIOS-DCM.md</code>.</p>' +
        "</div></div></div>" + insightsHtml + acessoSecomHtml;
    }

    if (sub === "demo") {
      var tam = 0;
      try { tam = (localStorage.getItem("gazeta-admin-demo-v2") || "").length; } catch (e) { /* ok */ }
      html += '<div class="cartao"><div class="cartao__cabeca"><h2 class="cartao__titulo">Dados desta demonstração</h2></div><div class="cartao__corpo">' +
        '<p class="modal__texto">Tudo vive neste navegador (' + (tam / 1024).toFixed(0) + ' KB de ~5 MB). Exporte um backup antes de trocar de aparelho.</p>' +
        '<div class="modal__acoes" style="justify-content:flex-start;margin-top:0">' +
        '<button type="button" class="btn" id="demo-exportar">Exportar backup (JSON)</button>' +
        '<button type="button" class="btn" id="demo-importar">Importar backup</button>' +
        '<button type="button" class="btn btn--perigo" id="demo-resetar">Restaurar estado inicial</button>' +
        "</div></div></div>";
    }

    $("#vista").innerHTML = html;

    /* ligações da vista */
    $$("#vista [data-cfg]").forEach(function (inp) {
      inp.addEventListener("input", GB.debounce(function () {
        cfg[inp.getAttribute("data-cfg")] = inp.value;
        GB.salvar();
      }, 400));
    });
    var pa = $("#plantao-ativo");
    if (pa) pa.addEventListener("change", function () { cfg.plantao.ativo = pa.checked; GB.salvar(); GB.toast(pa.checked ? "Plantão ligado." : "Plantão desligado."); });
    var pt = $("#plantao-texto");
    if (pt) pt.addEventListener("input", GB.debounce(function () { cfg.plantao.texto = pt.value; GB.salvar(); }, 400));

    var nu = $("#novo-usuario");
    if (nu) nu.addEventListener("click", function () {
      GB.abrirModal(
        '<h2 class="modal__titulo">Cadastrar funcionário</h2>' +
        '<p class="modal__texto">Na versão final, isto dispara um convite por e-mail (Supabase Auth). Na demo, a pessoa já aparece na tela de entrada.</p>' +
        '<label class="campo"><span class="campo__rotulo">Nome</span><input class="campo__controle" id="nu-nome"></label>' +
        '<label class="campo"><span class="campo__rotulo">E-mail</span><input class="campo__controle" id="nu-email" type="email"></label>' +
        '<label class="campo"><span class="campo__rotulo">Papel</span><select class="campo__controle" id="nu-papel">' +
        Object.keys(GB.PAPEIS_BASE).filter(function (p) { return p !== "administrador"; }).map(function (p) {
          return '<option value="' + p + '">' + GB.rotuloPapel(p) + "</option>";
        }).join("") + "</select></label>" +
        '<div class="modal__acoes"><button type="button" class="btn" data-modal-fecha>Cancelar</button>' +
        '<button type="button" class="btn btn--primario" id="nu-salvar">Cadastrar</button></div>'
      );
      $("#nu-salvar").addEventListener("click", function () {
        var nome = $("#nu-nome").value.trim();
        if (!nome) { GB.toast("Informe o nome."); return; }
        GB.estado.equipe.push({ id: GB.uid("u"), nome: nome, email: $("#nu-email").value.trim(), papel: $("#nu-papel").value });
        GB.salvar(); GB.fecharModal(); GB.vistas.configuracoes("equipe");
        GB.toast("Funcionário cadastrado — já pode entrar pela tela inicial.");
      });
    });

    $$("#vista [data-papel-de]").forEach(function (sel) {
      sel.addEventListener("change", function () {
        GB.estado.equipe.forEach(function (u) { if (u.id === sel.getAttribute("data-papel-de")) u.papel = sel.value; });
        GB.salvar(); GB.toast("Papel atualizado.");
      });
    });
    $$("#vista [data-rm-usuario]").forEach(function (b) {
      b.addEventListener("click", function () {
        GB.estado.equipe = GB.estado.equipe.filter(function (u) { return u.id !== b.getAttribute("data-rm-usuario"); });
        GB.salvar(); GB.vistas.configuracoes("equipe");
      });
    });
    $$("#vista [data-perm]").forEach(function (cb) {
      cb.addEventListener("change", function () {
        var partes = cb.getAttribute("data-perm").split(":");
        var papel = partes[0], caminho = partes[1].split(".");
        var alvo = GB.estado.permissoes[papel];
        if (caminho.length === 2) alvo[caminho[0]][caminho[1]] = cb.checked ? 1 : 0;
        else alvo[caminho[0]] = cb.checked ? 1 : 0;
        GB.salvar(); GB.renderNav();
        GB.toast("Permissões de " + GB.rotuloPapel(papel) + " atualizadas.");
      });
    });

    $$("#vista [data-ed-sobe]").forEach(function (b) {
      b.addEventListener("click", function () {
        var i = +b.getAttribute("data-ed-sobe");
        var arr = cfg.editorias;
        arr.splice(i - 1, 0, arr.splice(i, 1)[0]);
        GB.salvar(); GB.vistas.configuracoes("editorias");
      });
    });
    $$("#vista [data-ed-desce]").forEach(function (b) {
      b.addEventListener("click", function () {
        var i = +b.getAttribute("data-ed-desce");
        var arr = cfg.editorias;
        arr.splice(i + 1, 0, arr.splice(i, 1)[0]);
        GB.salvar(); GB.vistas.configuracoes("editorias");
      });
    });
    $$("#vista [data-ed-visivel]").forEach(function (cb) {
      cb.addEventListener("change", function () {
        cfg.editorias[+cb.getAttribute("data-ed-visivel")].visivel = cb.checked;
        GB.salvar();
      });
    });

    var pxR = $("#px-relatorio");
    if (pxR) pxR.addEventListener("click", function () { GB.modalRelatorioPixel(); });
    var pxV = $("#px-ver-como");
    if (pxV) pxV.addEventListener("click", function () {
      GB.estado.usuarioAtual = "u-secom";
      GB.salvar(); location.hash = "#/pixel-secom"; GB.iniciarUI();
      GB.toast("Agora você vê o painel como a equipe SECOM.");
    });
    var pxA = $("#pixel-ativo");
    if (pxA) pxA.addEventListener("change", function () { cfg.pixel.ativo = pxA.checked; GB.salvar(); GB.vistas.configuracoes("pixel"); });
    var pxP = $("#pixel-placement");
    if (pxP) pxP.addEventListener("input", GB.debounce(function () { cfg.pixel.placement = pxP.value.trim(); GB.salvar(); }, 400));

    var ex = $("#demo-exportar");
    if (ex) ex.addEventListener("click", function () {
      var blob = new Blob([JSON.stringify(GB.estado, null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "painel-redacao-gazeta-backup.json";
      a.click();
      URL.revokeObjectURL(a.href);
    });
    var im = $("#demo-importar");
    if (im) im.addEventListener("click", function () {
      var input = $("#arquivo-backup");
      input.value = "";
      input.onchange = function () {
        var f = input.files[0];
        if (!f) return;
        var fr = new FileReader();
        fr.onload = function () {
          try {
            var dados = JSON.parse(fr.result);
            if (!dados || !dados.materias) throw new Error("formato");
            GB.estado = dados;
            GB.salvar(); GB.iniciarUI();
            GB.toast("Backup importado.");
          } catch (e) { GB.toast("Esse arquivo não parece um backup do painel."); }
        };
        fr.readAsText(f);
      };
      input.click();
    });
    var rs = $("#demo-resetar");
    if (rs) rs.addEventListener("click", function () {
      GB.confirmar("Restaurar estado inicial", "Apaga matérias criadas, imagens subidas, patrocinadores e ajustes desta demonstração.", "Restaurar", GB.resetarDemo, true);
    });
  };
})();
