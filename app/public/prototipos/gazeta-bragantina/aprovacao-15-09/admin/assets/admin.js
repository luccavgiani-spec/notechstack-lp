/* ==========================================================================
   GAZETA BRAGANTINA · admin.js — núcleo do Painel da Redação (demo)
   --------------------------------------------------------------------------
   Estado local (localStorage), sem backend. A nomenclatura dos dados espelha
   o §4.1 da arquitetura — esta demo é o contrato visual do banco.
   Carrega junto: admin-vistas.js (listas) e admin-editor.js (editor+preview).
   ========================================================================== */
(function () {
  "use strict";

  var GB = (window.GB = {});
  var CHAVE = "gazeta-admin-demo-v2";

  /* ---------------------------------------------------------------- utils */
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  GB.$ = $; GB.$$ = $$;

  GB.esc = function (s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  };

  GB.uid = function (pfx) {
    return (pfx || "id") + "-" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  };

  GB.fmtData = function (iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d)) return "—";
    return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
  };
  GB.fmtDataHora = function (iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d)) return "—";
    return GB.fmtData(iso) + " " + String(d.getHours()).padStart(2, "0") + "h" + String(d.getMinutes()).padStart(2, "0");
  };
  GB.fmtNum = function (n) { return Number(n || 0).toLocaleString("pt-BR"); };

  GB.debounce = function (fn, ms) {
    var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); };
  };

  var toastTimer;
  GB.toast = function (msg, ms) {
    var el = $("#toast");
    el.textContent = msg;
    el.classList.add("esta-visivel");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("esta-visivel"); }, ms || 3200);
  };

  /* ---------------------------------------------------------------- modal */
  GB.abrirModal = function (html, larga) {
    var m = $("#modal"), cx = $("#modal-caixa");
    cx.className = "modal__caixa" + (larga ? " modal__caixa--larga" : "");
    cx.innerHTML = html;
    m.hidden = false;
    var f = cx.querySelector("input, select, textarea, button");
    if (f) f.focus();
  };
  GB.fecharModal = function () { $("#modal").hidden = true; $("#modal-caixa").innerHTML = ""; };

  GB.confirmar = function (titulo, texto, rotuloOk, aoConfirmar, perigo) {
    GB.abrirModal(
      '<h2 class="modal__titulo">' + GB.esc(titulo) + '</h2>' +
      '<p class="modal__texto">' + texto + '</p>' +
      '<div class="modal__acoes">' +
      '<button type="button" class="btn" data-modal-fecha>Cancelar</button>' +
      '<button type="button" class="btn ' + (perigo ? "btn--perigo" : "btn--primario") + '" id="modal-ok">' + GB.esc(rotuloOk) + '</button>' +
      '</div>'
    );
    $("#modal-ok").addEventListener("click", function () { GB.fecharModal(); aoConfirmar(); });
  };

  /* ------------------------------------------------------------ constantes */
  GB.EDITORIAS = [
    { id: "cidade", nome: "Cidade" }, { id: "regiao", nome: "Região" },
    { id: "politica", nome: "Política" }, { id: "economia", nome: "Economia" },
    { id: "bragantino", nome: "Bragantino" }, { id: "esportes", nome: "Esportes" },
    { id: "cultura", nome: "Cultura" }, { id: "policia", nome: "Polícia" },
    { id: "colunas", nome: "Colunas" }, { id: "opiniao", nome: "Opinião" }
  ];
  GB.editoria = function (id) {
    for (var i = 0; i < GB.EDITORIAS.length; i++) if (GB.EDITORIAS[i].id === id) return GB.EDITORIAS[i];
    return { id: id, nome: id || "—" };
  };

  GB.AUTORES = [
    { id: "marina", nome: "Marina Toledo Prado", cargo: "Repórter", foto: "assets/img/autor-01.jpg" },
    { id: "everton", nome: "Everton Machado Lisboa", cargo: "Repórter fotográfico", foto: "assets/img/autor-03.jpg" },
    { id: "beatriz", nome: "Beatriz Almeida Rocha", cargo: "Repórter", foto: "assets/img/autor-05.jpg" },
    { id: "camila", nome: "Camila Nogueira Franco", cargo: "Repórter especial", foto: "assets/img/autor-07.jpg" },
    { id: "sergiob", nome: "Sérgio Bittencourt Mattos", cargo: "Colunista · escreve às terças", foto: "assets/img/autor-09.jpg" },
    { id: "caio", nome: "Caio Sales", cargo: "Colunista de esportes", foto: "assets/img/autor-11.jpg" }
  ];
  GB.autor = function (id) {
    for (var i = 0; i < GB.AUTORES.length; i++) if (GB.AUTORES[i].id === id) return GB.AUTORES[i];
    return null;
  };

  GB.TIPOS = {
    padrao: { curto: "Padrão", nome: "Notícia padrão", desc: "Título, capa, corpo com anúncios e lateral fixa." },
    coluna: { curto: "Coluna", nome: "Coluna / Opinião", desc: "Fundo diferenciado, selo OPINIÃO, capitular, cartão do colunista." },
    foto: { curto: "Foto", nome: "Foto-reportagem", desc: "Abertura em tela cheia e mosaicos de fotos com legenda." },
    especial: { curto: "Especial", nome: "Especial / longform", desc: "Capa imersiva, leitura contínua, para grandes reportagens." }
  };

  GB.FORMATOS = {
    billboard: { l: 970, a: 250, nome: "Billboard" },
    leaderboard: { l: 728, a: 90, nome: "Leaderboard" },
    retangulo: { l: 300, a: 250, nome: "Retângulo" },
    meiapagina: { l: 300, a: 600, nome: "Meia página" },
    rodapemobile: { l: 320, a: 50, nome: "Rodapé mobile" }
  };
  GB.rotuloFormato = function (f) {
    var d = GB.FORMATOS[f]; return d ? d.nome + " " + d.l + "×" + d.a : f;
  };

  // Slots de anúncio disponíveis por modelo de matéria
  GB.SLOTS_POR_TIPO = {
    padrao: [
      { id: "corpo1", nome: "No corpo · após o 4º bloco", formato: "leaderboard" },
      { id: "corpo2", nome: "No corpo · perto do fim", formato: "leaderboard" },
      { id: "fim", nome: "Fim da matéria", formato: "billboard" },
      { id: "lateral", nome: "Coluna lateral (fixa)", formato: "meiapagina" }
    ],
    foto: [{ id: "fim", nome: "Fim da matéria", formato: "billboard" }],
    coluna: [],
    especial: []
  };

  GB.PAPEIS_BASE = {
    administrador: { rotulo: "Administrador" },
    editor: { rotulo: "Editor-chefe" },
    redator: { rotulo: "Redator" },
    comercial: { rotulo: "Comercial" },
    patrocinador: { rotulo: "Patrocinador", externa: "desempenho" },
    secom: { rotulo: "SECOM · externo", externa: "pixel-secom" }
  };

  GB.ABAS = [
    { id: "inicio", rotulo: "Início" },
    { id: "editorial", rotulo: "Editorial" },
    { id: "patrocinadores", rotulo: "Patrocinadores" },
    { id: "assinatura", rotulo: "Assinatura" },
    { id: "relatorios", rotulo: "Relatórios" },
    { id: "configuracoes", rotulo: "Configurações" }
  ];
  // Abas de acesso externo — fora da matriz de permissões da equipe
  GB.ABAS_EXTERNAS = [
    { id: "desempenho", rotulo: "Meu desempenho" },
    { id: "pixel-secom", rotulo: "Relatório da campanha" }
  ];

  /* --------------------------------------------------------------- seeds */
  function permissoesPadrao() {
    return {
      administrador: { abas: { inicio: 1, editorial: 1, patrocinadores: 1, assinatura: 1, relatorios: 1, configuracoes: 1 }, publicar: 1, excluir: 1, equipe: 1 },
      editor: { abas: { inicio: 1, editorial: 1, patrocinadores: 1, assinatura: 0, relatorios: 1, configuracoes: 0 }, publicar: 1, excluir: 1, equipe: 0 },
      redator: { abas: { inicio: 1, editorial: 1, patrocinadores: 0, assinatura: 0, relatorios: 0, configuracoes: 0 }, publicar: 0, excluir: 0, equipe: 0 },
      comercial: { abas: { inicio: 1, editorial: 0, patrocinadores: 1, assinatura: 0, relatorios: 1, configuracoes: 0 }, publicar: 0, excluir: 0, equipe: 0 }
    };
  }

  function p(html) { return { tipo: "paragrafo", html: html }; }

  function seeds() {
    return {
      equipe: [
        { id: "u-lucca", nome: "Lucca Giani", email: "lucca@notechstack.com.br", papel: "administrador" },
        { id: "u-regina", nome: "Regina Camargo Vaz", email: "redacao@gazetabragantina.com.br", papel: "editor" },
        { id: "u-marina", nome: "Marina Toledo Prado", email: "marina@gazetabragantina.com.br", papel: "redator", autorId: "marina" },
        { id: "u-caio", nome: "Caio Sales", email: "caio@gazetabragantina.com.br", papel: "redator", autorId: "caio" },
        { id: "u-selma", nome: "Selma Duarte Pires", email: "comercial@gazetabragantina.com.br", papel: "comercial" },
        { id: "u-rodrigo", nome: "Rodrigo Braga", email: "rodrigo@supermercadobraganca.com.br", papel: "patrocinador", patrocinadorId: "p-superm" },
        { id: "u-secom", nome: "Equipe SECOM (Baila)", email: "relatorios@baila.com.br", papel: "secom" }
      ],
      permissoes: permissoesPadrao(),
      patrocinadores: [
        {
          id: "p-secom", nome: "Governo de SP · SECOM", contato: "Baila / Maisis", cor: "#454b54",
          status: "ativo", dcm: true,
          obs: "Campanha Saresp e Alfabetiza — tag de terceiro (DCM). Flight 10–19/04/2026: confirmar com a Baila se vem campanha nova."
        },
        { id: "p-superm", nome: "Supermercado Bragança", contato: "Rodrigo · (11) 4033-0000", cor: "#14614a", status: "ativo" },
        { id: "p-colegio", nome: "Colégio Alvorada", contato: "Secretaria · (11) 4034-1111", cor: "#1b3d77", status: "ativo" },
        { id: "p-imob", nome: "Imobiliária Serra da Pedra", contato: "Vera · (11) 99900-2222", cor: "#8a5a00", status: "pausado" }
      ],
      criativos: [
        { id: "c-secom-bb", patrocinadorId: "p-secom", formato: "billboard", nome: "SECOM · Alfabetiza 970×250", origem: "dcm" },
        { id: "c-secom-ld", patrocinadorId: "p-secom", formato: "leaderboard", nome: "SECOM · Alfabetiza 728×90", origem: "dcm" },
        { id: "c-secom-rt", patrocinadorId: "p-secom", formato: "retangulo", nome: "SECOM · Alfabetiza 300×250", origem: "dcm" },
        { id: "c-secom-mp", patrocinadorId: "p-secom", formato: "meiapagina", nome: "SECOM · Alfabetiza 300×600", origem: "dcm" },
        { id: "c-sup-ld", patrocinadorId: "p-superm", formato: "leaderboard", nome: "Ofertas da semana", origem: "placeholder", destino: "https://exemplo.com/ofertas" },
        { id: "c-sup-bb", patrocinadorId: "p-superm", formato: "billboard", nome: "Aniversário 30 anos", origem: "placeholder", destino: "https://exemplo.com" },
        { id: "c-col-rt", patrocinadorId: "p-colegio", formato: "retangulo", nome: "Matrículas abertas", origem: "placeholder", destino: "https://exemplo.com/matriculas" },
        { id: "c-col-mp", patrocinadorId: "p-colegio", formato: "meiapagina", nome: "Matrículas 300×600", origem: "placeholder", destino: "https://exemplo.com/matriculas" },
        { id: "c-imob-ld", patrocinadorId: "p-imob", formato: "leaderboard", nome: "Lançamento Jardim das Pedras", origem: "placeholder", destino: "https://exemplo.com" }
      ],
      midia: [],
      materias: [
        {
          id: "m-hospital", tipo: "padrao", status: "publicado",
          chapeu: "Cidade · Destaque",
          titulo: "Governo do Estado confirma Hospital Regional em Bragança e obra começa em outubro",
          linhaFina: "Unidade terá 200 leitos e seis salas cirúrgicas, e vai atender as 12 cidades da microrregião. O contrato prevê 30 meses de execução e repasse mensal fiscalizado pelo consórcio intermunicipal.",
          resumo: "Unidade terá 200 leitos e seis salas cirúrgicas e vai atender as 12 cidades da microrregião. Contrato prevê 30 meses de execução.",
          editoriaId: "cidade", autorIds: ["marina"], localidade: "Centro", assuntos: ["hospital-regional", "saude"],
          urgente: false,
          capa: { src: "assets/img/ph-16x9-a.svg", alt: "Terreno cercado na Avenida dos Imigrantes onde o Hospital Regional será construído", legenda: "O terreno de 38 mil m² foi doado pela Prefeitura em 2022 e está cercado desde então.", credito: "Foto: Everton Machado Lisboa / Gazeta Bragantina" },
          blocos: [
            p("O Governo do Estado confirmou nesta terça-feira (28) a instalação do Hospital Regional de Bragança Paulista, obra prometida desde 2019 e cobrada em três eleições municipais seguidas. Pelo que foi apresentado, a ordem de serviço será assinada em outubro e a construção deve levar 30 meses."),
            p("A unidade terá 200 leitos — 40 deles de UTI adulta e 12 de UTI neonatal —, seis salas cirúrgicas e pronto-socorro com portas abertas 24 horas. O terreno de 38 mil m², na Avenida dos Imigrantes, foi doado pela Prefeitura em 2022 e permanece cercado desde então."),
            p("O hospital vai atender as 12 cidades da microrregião, num raio que hoje empurra pacientes de média complexidade para Atibaia, Jundiaí e Campinas. Pela estimativa apresentada, 340 mil pessoas passam a ter referência hospitalar a menos de 50 quilômetros de casa."),
            { tipo: "citacao", texto: "É a maior obra de saúde da história da microrregião, e ela não é do prefeito nem do governador: é da população que esperou sete anos.", autor: "Wilson Pádua Camargo, secretário de Saúde" },
            { tipo: "intertitulo", texto: "Como a obra será paga" },
            p("O investimento anunciado é de R$ 412 milhões, divididos entre R$ 330 milhões do Estado e R$ 82 milhões do consórcio intermunicipal, rateados entre as 12 cidades pela população de cada uma."),
            { tipo: "imagem", src: "assets/img/ph-3x2-e.svg", alt: "Maquete eletrônica do hospital exibida em painel durante coletiva", legenda: "Projeto prevê três blocos ligados por passarelas cobertas.", credito: "Imagem: divulgação / Consórcio Intermunicipal" },
            p("O repasse mensal será fiscalizado por um comitê gestor com representantes das prefeituras, do Estado e do Conselho Municipal de Saúde. A primeira reunião está marcada para 12 de agosto.")
          ],
          anuncios: { corpo1: "auto", corpo2: "c-sup-ld", fim: "auto", lateral: "c-col-mp" },
          publicadoEm: "2026-07-28T08:12:00", criadoEm: "2026-07-27T16:00:00", atualizadoEm: "2026-07-28T11:40:00", criadoPorId: "u-marina", publicadoPorId: "u-regina",
          visualizacoes: 12840
        },
        {
          id: "m-lavapes", tipo: "especial", status: "publicado",
          chapeu: "Reportagem especial",
          titulo: "O que sobrou do Lavapés",
          linhaFina: "Seis meses depois da enchente que atingiu 214 casas, a Gazeta refez o caminho da água — e a das promessas.",
          resumo: "Seis meses depois da enchente que atingiu 214 casas no Lavapés, a Gazeta refez o caminho da água e o das promessas públicas.",
          editoriaId: "cidade", autorIds: ["camila", "everton"], localidade: "Lavapés", assuntos: ["enchente", "lavapes"],
          capa: { src: "assets/img/ph-16x9-f.svg", alt: "Rua do Lavapés com marcas de água nas paredes das casas", legenda: "", credito: "Foto: Everton Machado Lisboa" },
          blocos: [
            p("A água chegou às 4h17 da manhã de 12 de janeiro. Dona Aparecida Ferraz, 71 anos, acordou com o barulho do portão batendo e pisou num chão que já não existia: a sala virara um braço do córrego."),
            p("Seis meses depois, as marcas continuam na parede — uma linha marrom na altura do peito, que nenhuma demão de tinta cobriu ainda. Das 214 casas atingidas, 37 seguem interditadas e 12 foram demolidas."),
            { tipo: "intertitulo", texto: "A conta que não fecha" },
            p("Desde 2019, a Câmara aprovou R$ 28 milhões em emendas para o Lavapés. A reportagem pediu à Prefeitura, via Lei de Acesso à Informação, o extrato de execução dessas emendas. A resposta: R$ 4,1 milhões executados."),
            { tipo: "citacao", texto: "Promessa não segura enchente. Projeto executivo, licitação e obra seguram.", autor: "" },
            p("A Defesa Civil classificou 61 imóveis do bairro como área de risco alto. O plano de macrodrenagem, orçado em R$ 90 milhões, segue sem projeto executivo.")
          ],
          anuncios: {},
          publicadoEm: "2026-07-28T06:00:00", criadoEm: "2026-07-20T10:00:00", criadoPorId: "u-regina", publicadoPorId: "u-lucca", visualizacoes: 9412
        },
        {
          id: "m-divino", tipo: "foto", status: "publicado",
          chapeu: "Cultura",
          titulo: "Festa do Divino leva 12 mil às ruas do Centro em três dias de procissão",
          linhaFina: "",
          resumo: "A Gazeta acompanhou os três dias da Festa do Divino: a festa das voluntárias, das crianças e da fé — em fotos.",
          editoriaId: "cultura", autorIds: ["beatriz", "everton"], localidade: "Centro", assuntos: ["festa-do-divino"],
          capa: { src: "assets/img/ph-16x9-d.svg", alt: "Procissão do Divino na Rua Coronel Osório ao entardecer", legenda: "", credito: "Fotos: Everton Machado Lisboa" },
          blocos: [
            p("Começou às 8h de sábado, com o mastro subindo na frente da matriz, e terminou às 6h de segunda-feira, quando a última bandeirinha foi recolhida da Rua Coronel Osório. Entre um momento e outro, 12 mil pessoas passaram pelo Centro."),
            { tipo: "imagem", src: "assets/img/ph-3x2-a.svg", alt: "Fiéis carregam o mastro do Divino sob chuva de pétalas", legenda: "A saída do mastro, às 8h de sábado, abriu os três dias de festa.", credito: "Foto: Everton Machado Lisboa" },
            { tipo: "imagem", src: "assets/img/ph-3x2-b.svg", alt: "Fitas coloridas amarradas na grade da matriz", legenda: "As fitas amarradas por quem faz promessa.", credito: "Foto: Everton Machado Lisboa" },
            p("O que se vê acima não é a festa oficial, a do palanque: é a festa das 60 voluntárias da cozinha da paróquia e das crianças que correram entre as bandeirinhas."),
            { tipo: "imagem", src: "assets/img/ph-3x2-c.svg", alt: "Corporação musical abre o cortejo", legenda: "A corporação abriu o cortejo pela 62ª vez consecutiva.", credito: "Foto: Everton Machado Lisboa" }
          ],
          anuncios: { fim: "auto" },
          publicadoEm: "2026-07-27T18:30:00", criadoEm: "2026-07-27T12:00:00", criadoPorId: "u-regina", publicadoPorId: "u-regina", visualizacoes: 7156
        },
        {
          id: "m-coluna", tipo: "coluna", status: "publicado",
          chapeu: "Opinião",
          titulo: "A política da semana em Bragança",
          linhaFina: "",
          resumo: "LDO aprovada com emenda de R$ 12 milhões para o Lavapés — e a pergunta que ninguém fez sobre a concessão da iluminação pública.",
          editoriaId: "opiniao", autorIds: ["sergiob"], localidade: "", assuntos: ["camara", "ldo"],
          capa: null,
          blocos: [
            p("A Câmara aprovou a LDO de 2027 na terça passada com uma emenda de R$ 12 milhões para o Lavapés e uma sensação incômoda de já ter visto esse filme. Em 2019, a mesma Casa aprovou R$ 9 milhões para o mesmo córrego. Alguém consegue me dizer para onde correu essa água toda?"),
            { tipo: "citacao", texto: "Aprovar emenda na LDO é o gesto mais barato da política: não obriga a executar, não fixa prazo, não define projeto.", autor: "" },
            p("Há um segundo assunto da semana que passou despercebido e pesa mais no bolso do bragantino: o edital de concessão da iluminação pública por vinte anos. Um contrato dessa duração merece audiência própria, e não uma linha no expediente."),
            p("Por fim, uma nota sobre o Hospital Regional. Torço para que a ordem de serviço de outubro seja assinada. Mas anoto a pergunta que não foi feita na coletiva: quem paga o custeio mensal quando a obra ficar pronta? Prédio se inaugura com tesoura e fita. Hospital se sustenta com folha de pagamento.")
          ],
          anuncios: {},
          publicadoEm: "2026-07-28T07:00:00", criadoEm: "2026-07-27T20:00:00", criadoPorId: "u-caio", publicadoPorId: "u-regina", visualizacoes: 5320
        },
        {
          id: "m-iptu", tipo: "padrao", status: "rascunho",
          chapeu: "Política",
          titulo: "Câmara vota reajuste da planta genérica do IPTU na próxima quinta",
          linhaFina: "Proposta da Prefeitura corrige a tabela em 9,4% e cria desconto para imóvel com calçada acessível.",
          resumo: "Proposta corrige a planta genérica em 9,4% e cria desconto para imóvel com calçada acessível. Votação na quinta.",
          editoriaId: "politica", autorIds: ["marina"], localidade: "Centro", assuntos: ["iptu", "camara"],
          capa: null,
          blocos: [
            p("A Câmara Municipal vota na próxima quinta-feira (3) o projeto que corrige a planta genérica de valores do IPTU em 9,4% — o primeiro reajuste acima da inflação desde 2019."),
            p("O texto cria também um desconto de 3% para imóveis com calçada acessível certificada, uma emenda negociada entre governo e oposição na CCJ.")
          ],
          anuncios: { corpo1: "auto", corpo2: "auto", fim: "auto", lateral: "auto" },
          criadoEm: "2026-08-26T14:10:00", atualizadoEm: "2026-08-27T09:35:00", criadoPorId: "u-marina", visualizacoes: 0
        },
        {
          id: "m-bragantino", tipo: "padrao", status: "revisao",
          chapeu: "Bragantino · Exclusivo",
          titulo: "Bragantino encaminha renovação do técnico até o fim da Série B",
          linhaFina: "Diretoria e comissão chegaram a acordo verbal; anúncio deve sair depois do clássico de domingo.",
          resumo: "Diretoria e comissão técnica chegaram a acordo verbal pela renovação até o fim da Série B. Anúncio após o clássico.",
          editoriaId: "bragantino", autorIds: ["caio"], localidade: "", assuntos: ["bragantino", "serie-b"],
          capa: { src: "assets/img/ph-16x9-h.svg", alt: "Técnico do Bragantino à beira do gramado durante treino", legenda: "Comissão comandou o treino desta quarta normalmente.", credito: "Foto: divulgação" },
          blocos: [
            p("A diretoria do Bragantino encaminhou nesta quarta-feira a renovação do técnico até o fim da Série B. Segundo apuração da Gazeta, o acordo verbal foi selado em reunião no CT, e o anúncio oficial deve sair depois do clássico de domingo."),
            p("A permanência era a principal cobrança da torcida organizada na última semana, depois da sequência de três vitórias que tirou o time da zona de rebaixamento.")
          ],
          anuncios: { corpo1: "auto", corpo2: "auto", fim: "auto", lateral: "auto" },
          criadoEm: "2026-08-27T08:00:00", atualizadoEm: "2026-08-27T10:20:00", criadoPorId: "u-caio", visualizacoes: 0
        },
        {
          id: "m-guia", tipo: "padrao", status: "agendado",
          chapeu: "Cultura · Guia",
          titulo: "O que fazer em Bragança e região neste fim de semana",
          linhaFina: "Feira de vinil no Lago, festival de food trucks em Atibaia e a estreia do coral municipal na matriz.",
          resumo: "Feira de vinil no Lago do Taboão, festival de food trucks em Atibaia e a estreia do coral municipal: o guia do fim de semana.",
          editoriaId: "cultura", autorIds: ["beatriz"], localidade: "", assuntos: ["agenda", "fim-de-semana"],
          capa: { src: "assets/img/ph-16x9-i.svg", alt: "Feira ao ar livre no entorno do Lago do Taboão", legenda: "", credito: "Foto: arquivo Gazeta" },
          blocos: [
            p("O fim de semana em Bragança e região tem feira de vinil no Lago do Taboão, festival de food trucks em Atibaia e a estreia do coral municipal na igreja matriz — tudo de graça ou a preço de ingresso solidário.")
          ],
          anuncios: { corpo1: "auto", corpo2: "auto", fim: "auto", lateral: "auto" },
          agendadoPara: "2026-08-29T08:00:00", criadoEm: "2026-08-25T17:00:00", criadoPorId: "u-regina", acesso: "assinante", visualizacoes: 0
        }
      ],
      config: {
        nomeSite: "Gazeta Bragantina",
        cidadeTopbar: "Bragança Paulista, SP",
        rotuloCabecalho: "Receber notícias",
        plantao: {
          ativo: true,
          texto: "Chuva forte alaga a Avenida dos Imigrantes e trânsito é desviado no Centro",
          link: ""
        },
        pixel: {
          ativo: true,
          campanha: "SECOM · Saresp e Alfabetiza (Governo de SP)",
          placement: "N1137856.5538918GAZETABRAGANTINA/B35647323.444850944",
          flight: "10/04 a 19/04/2026",
          obs: "Flight já encerrado — confirmar com a Baila/Maisis se esta tag segue valendo ou se vem campanha nova."
        },
        editorias: GB.EDITORIAS.map(function (e) { return { id: e.id, visivel: true }; })
      }
    };
  }

  /* --------------------------------------------------------------- estado */
  GB.estado = null;

  GB.carregar = function () {
    var bruto = null;
    try { bruto = localStorage.getItem(CHAVE); } catch (e) { /* segue */ }
    if (bruto) {
      try {
        var dados = JSON.parse(bruto);
        if (dados && dados.materias) { GB.estado = dados; return; }
      } catch (e) { /* semente */ }
    }
    GB.estado = seeds();
    GB.estado.usuarioAtual = null;
  };

  GB.salvar = function () {
    GB.estado.atualizadoEm = new Date().toISOString();
    try {
      localStorage.setItem(CHAVE, JSON.stringify(GB.estado));
    } catch (e) {
      GB.toast("Limite de armazenamento da demo atingido — use imagens menores ou resete os dados em Configurações.");
    }
  };

  GB.resetarDemo = function () {
    try { localStorage.removeItem(CHAVE); } catch (e) { /* ok */ }
    GB.estado = seeds();
    GB.estado.usuarioAtual = null;
    location.hash = "#/inicio";
    GB.iniciarUI();
    GB.toast("Demonstração restaurada ao estado inicial.");
  };

  /* ----------------------------------------------------------------- auth */
  GB.usuario = function () {
    var id = GB.estado.usuarioAtual;
    for (var i = 0; i < GB.estado.equipe.length; i++) if (GB.estado.equipe[i].id === id) return GB.estado.equipe[i];
    return null;
  };
  GB.papelDe = function (u) {
    return (u && GB.estado.permissoes[u.papel]) || { abas: {}, publicar: 0, excluir: 0, equipe: 0 };
  };
  GB.pode = function (acao) {
    var u = GB.usuario();
    if (!u) return false;
    var base = GB.PAPEIS_BASE[u.papel] || {};
    if (base.externa) return acao === "aba:" + base.externa; // externo: só a própria área
    if (u.papel === "administrador") return true;
    var pp = GB.papelDe(u);
    if (acao.indexOf("aba:") === 0) return !!pp.abas[acao.slice(4)];
    return !!pp[acao];
  };
  GB.rotuloPapel = function (papel) {
    return (GB.PAPEIS_BASE[papel] || {}).rotulo || papel;
  };
  GB.membroEquipe = function (id) {
    for (var i = 0; i < GB.estado.equipe.length; i++) if (GB.estado.equipe[i].id === id) return GB.estado.equipe[i];
    return null;
  };
  GB.papelExibicao = function (u) {
    if (u.papel === "patrocinador") {
      var pt = GB.patrocinador(u.patrocinadorId);
      return "Patrocinador · " + (pt ? pt.nome : "");
    }
    if (u.papel === "secom") return "SECOM · relatórios da campanha";
    return GB.rotuloPapel(u.papel);
  };
  GB.iniciais = function (nome) {
    var partes = String(nome || "?").replace(/[^\wÀ-ú ]/g, " ").trim().split(/\s+/).filter(Boolean);
    if (!partes.length) partes = ["?"];
    return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
  };

  /* --------------------------------------------------- criativos e imagens */
  GB.patrocinador = function (id) {
    for (var i = 0; i < GB.estado.patrocinadores.length; i++) if (GB.estado.patrocinadores[i].id === id) return GB.estado.patrocinadores[i];
    return null;
  };
  GB.criativo = function (id) {
    for (var i = 0; i < GB.estado.criativos.length; i++) if (GB.estado.criativos[i].id === id) return GB.estado.criativos[i];
    return null;
  };

  // Placeholder SVG de criativo, gerado com a cor da marca (sem custo de storage)
  GB.svgCriativo = function (cor, nome, formato) {
    var f = GB.FORMATOS[formato] || { l: 300, a: 250 };
    var fs = Math.max(14, Math.round(f.a * 0.14));
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + f.l + '" height="' + f.a + '" viewBox="0 0 ' + f.l + " " + f.a + '">' +
      '<rect width="100%" height="100%" fill="' + cor + '"/>' +
      '<rect x="6" y="6" width="' + (f.l - 12) + '" height="' + (f.a - 12) + '" fill="none" stroke="rgba(255,255,255,.5)" stroke-dasharray="6 6"/>' +
      '<text x="50%" y="48%" fill="#fff" font-family="Archivo, Arial, sans-serif" font-size="' + fs + '" font-weight="700" text-anchor="middle">' + GB.esc(nome) + "</text>" +
      '<text x="50%" y="48%" dy="' + (fs * 1.3) + '" fill="rgba(255,255,255,.75)" font-family="Archivo, Arial, sans-serif" font-size="' + Math.round(fs * 0.72) + '" text-anchor="middle">' + f.l + "×" + f.a + " · anúncio</text>" +
      "</svg>";
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  };
  GB.srcCriativo = function (c) {
    if (!c) return null;
    if (c.dataURL) return c.dataURL;
    var pat = GB.patrocinador(c.patrocinadorId) || { cor: "#454b54", nome: "?" };
    return GB.svgCriativo(pat.cor, pat.nome, c.formato);
  };

  // No painel (admin/) as imagens do site precisam do prefixo ../
  GB.srcAdmin = function (src) {
    if (!src) return "";
    return /^(data:|https?:)/.test(src) ? src : "../" + src;
  };

  // Redimensiona e comprime a imagem subida; devolve dataURL JPEG
  GB.processarImagem = function (file, cb) {
    if (!/^image\//.test(file.type)) { GB.toast("Escolha um arquivo de imagem."); return; }
    if (file.type === "image/svg+xml") {
      var fr = new FileReader();
      fr.onload = function () { cb({ dataURL: fr.result, largura: 0, altura: 0 }); };
      fr.readAsDataURL(file);
      return;
    }
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      var MAX = 1400, w = img.width, h = img.height;
      if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
      var c = document.createElement("canvas");
      c.width = w; c.height = h;
      var ctx = c.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      cb({ dataURL: c.toDataURL("image/jpeg", 0.82), largura: w, altura: h });
    };
    img.onerror = function () { URL.revokeObjectURL(url); GB.toast("Não consegui ler essa imagem."); };
    img.src = url;
  };

  // Guarda a imagem na "biblioteca" com o caminho no formato do Supabase Storage
  GB.adicionarMidia = function (nomeArquivo, proc) {
    var agora = new Date();
    var slug = String(nomeArquivo || "imagem").toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "imagem";
    var m = {
      id: GB.uid("mid"),
      nome: nomeArquivo,
      dataURL: proc.dataURL,
      largura: proc.largura, altura: proc.altura,
      caminho: "midia/" + agora.getFullYear() + "/" + String(agora.getMonth() + 1).padStart(2, "0") + "/" + slug + "-" + Date.now().toString(36) + ".jpg",
      criadoEm: agora.toISOString()
    };
    GB.estado.midia.unshift(m);
    GB.salvar();
    return m;
  };

  // Seletor de imagem: subir do computador ou escolher da biblioteca
  GB.escolherImagem = function (cb) {
    var placeholders = ["ph-16x9-b", "ph-16x9-e", "ph-16x9-g", "ph-16x9-j", "ph-3x2-f", "ph-3x2-g", "ph-3x2-h", "ph-3x2-i", "ph-4x3-a", "ph-4x3-b"];
    var html = '<h2 class="modal__titulo">Escolher imagem</h2>' +
      '<p class="modal__texto">Suba do computador (vai para o <code class="inline">Storage</code> na versão final — na demo, fica neste navegador) ou reaproveite da biblioteca.</p>' +
      '<p><button type="button" class="btn btn--primario" id="mid-subir">Subir imagem do computador</button></p>';
    if (GB.estado.midia.length) {
      html += '<h3 class="cartao__titulo" style="margin:16px 0 8px">Enviadas por você</h3><div class="biblioteca">' +
        GB.estado.midia.map(function (m) {
          return '<button type="button" data-mid="' + m.id + '"><img src="' + m.dataURL + '" alt=""><figcaption>' + GB.esc(m.nome) + "</figcaption></button>";
        }).join("") + "</div>";
    }
    html += '<h3 class="cartao__titulo" style="margin:16px 0 8px">Banco de imagens do protótipo</h3><div class="biblioteca">' +
      placeholders.map(function (ph) {
        return '<button type="button" data-ph="assets/img/' + ph + '.svg"><img src="../assets/img/' + ph + '.svg" alt=""><figcaption>' + ph + "</figcaption></button>";
      }).join("") + "</div>" +
      '<div class="modal__acoes"><button type="button" class="btn" data-modal-fecha>Cancelar</button></div>';
    GB.abrirModal(html, true);
    $("#mid-subir").addEventListener("click", function () {
      var input = $("#arquivo-imagem");
      input.value = "";
      input.onchange = function () {
        var f = input.files[0];
        if (!f) return;
        GB.processarImagem(f, function (proc) {
          var m = GB.adicionarMidia(f.name, proc);
          GB.fecharModal();
          GB.toast("Imagem pronta — na versão final: " + m.caminho);
          cb({ src: m.dataURL, midiaId: m.id });
        });
      };
      input.click();
    });
    $$("#modal-caixa [data-mid]").forEach(function (b) {
      b.addEventListener("click", function () {
        var m = null;
        GB.estado.midia.forEach(function (x) { if (x.id === b.getAttribute("data-mid")) m = x; });
        GB.fecharModal();
        if (m) cb({ src: m.dataURL, midiaId: m.id });
      });
    });
    $$("#modal-caixa [data-ph]").forEach(function (b) {
      b.addEventListener("click", function () {
        GB.fecharModal();
        cb({ src: b.getAttribute("data-ph") });
      });
    });
  };

  /* -------------------------------------------------------------- roteador */
  GB.vistas = {}; // registradas por admin-vistas.js e admin-editor.js

  var ICONES = {
    inicio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/></svg>',
    editorial: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    patrocinadores: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 21 5l-3 13-7-3-3 4z"/></svg>',
    relatorios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V9"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/></svg>',
    assinatura: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.9Z"/></svg>',
    desempenho: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V9"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/></svg>',
    "pixel-secom": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></svg>',
    configuracoes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.7a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.7a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.5c0-.4.1-.8.1-1.2Z"/></svg>'
  };

  GB.rota = function () {
    var h = location.hash.replace(/^#\/?/, "");
    var partes = h.split("/").filter(Boolean);
    return { aba: partes[0] || "inicio", parametro: partes[1] || null };
  };

  GB.renderNav = function () {
    var r = GB.rota();
    var rasc = GB.estado.materias.filter(function (m) { return m.status === "rascunho" || m.status === "revisao"; }).length;
    var u0 = GB.usuario();
    var externa = (GB.PAPEIS_BASE[(u0 || {}).papel] || {}).externa;
    var abasVisiveis = externa
      ? GB.ABAS_EXTERNAS.filter(function (a) { return a.id === externa; })
      : GB.ABAS.filter(function (a) { return GB.pode("aba:" + a.id); });
    $("#nav-principal").innerHTML = abasVisiveis.map(function (a) {
      return '<a class="nav-item' + (r.aba === a.id ? " esta-ativo" : "") + '" href="#/' + a.id + '">' +
        ICONES[a.id] + a.rotulo +
        (a.id === "editorial" && rasc ? '<span class="nav-item__conta">' + rasc + "</span>" : "") +
        "</a>";
    }).join("");

    var u = GB.usuario();
    $("#sidebar-usuario").innerHTML = u
      ? '<span class="avatar">' + GB.iniciais(u.nome) + '</span>' +
        '<div class="sidebar__usuario-info"><div class="sidebar__usuario-nome">' + GB.esc(u.nome) + "</div>" +
        '<div class="sidebar__usuario-papel">' + GB.esc(GB.papelExibicao(u)) + "</div>" +
        '<button type="button" class="sidebar__sair" id="btn-sair">Trocar de usuário</button></div>'
      : "";
    var sair = $("#btn-sair");
    if (sair) sair.addEventListener("click", function () {
      GB.estado.usuarioAtual = null;
      GB.salvar();
      GB.iniciarUI();
    });
  };

  GB.render = function () {
    var r = GB.rota();
    var externa = (GB.PAPEIS_BASE[(GB.usuario() || {}).papel] || {}).externa;
    if (externa && r.aba !== externa) { location.hash = "#/" + externa; return; }
    var vista = GB.vistas[r.aba] || (externa ? GB.vistas[externa] : GB.vistas.inicio);
    if (!GB.pode("aba:" + r.aba) && GB.vistas[r.aba]) {
      GB.toast("O seu papel não tem acesso a essa área.");
      location.hash = "#/inicio";
      return;
    }
    GB.renderNav();
    vista(r.parametro);
    $("#vista").scrollTop = 0;
    window.scrollTo(0, 0);
  };

  GB.topo = function (titulo, sub, acoesHtml) {
    $("#topo-vista").innerHTML =
      '<div><h1 class="topo-vista__titulo">' + titulo + "</h1>" +
      (sub ? '<p class="topo-vista__sub">' + sub + "</p>" : "") + "</div>" +
      '<div class="topo-vista__acoes">' + (acoesHtml || "") + "</div>";
  };

  /* ----------------------------------------------------------------- login */
  var loginSelecionado = null;

  function renderLogin() {
    var caixa = $("#login-usuarios");
    caixa.innerHTML = GB.estado.equipe.map(function (u) {
      return '<button type="button" class="login__usuario' + (loginSelecionado === u.id ? " esta-ativo" : "") + '" data-usuario="' + u.id + '">' +
        '<span class="avatar">' + GB.iniciais(u.nome) + "</span>" +
        '<span><span class="login__usuario-nome">' + GB.esc(u.nome) + "</span><br>" +
        '<span class="login__usuario-papel">' + GB.esc(GB.papelExibicao(u)) + " · " + GB.esc(u.email) + "</span></span>" +
        "</button>";
    }).join("");
    $$("#login-usuarios [data-usuario]").forEach(function (b) {
      b.addEventListener("click", function () {
        loginSelecionado = b.getAttribute("data-usuario");
        renderLogin();
      });
    });
  }

  function entrar() {
    if (!loginSelecionado) { GB.toast("Escolha um usuário para entrar."); return; }
    GB.estado.usuarioAtual = loginSelecionado;
    GB.salvar();
    location.hash = "#/inicio";
    GB.iniciarUI();
  }

  /* ------------------------------------------------------------------ init */
  GB.iniciarUI = function () {
    var logado = !!GB.usuario();
    $("#vista-login").hidden = logado;
    $("#app").hidden = !logado;
    if (!logado) {
      loginSelecionado = null;
      renderLogin();
      $("#login-senha").value = "";
    } else {
      GB.render();
    }
  };

  document.addEventListener("DOMContentLoaded", function () {
    GB.carregar();

    $("#login-entrar").addEventListener("click", entrar);
    $("#login-senha").addEventListener("keydown", function (e) { if (e.key === "Enter") entrar(); });

    document.addEventListener("click", function (e) {
      if (e.target.closest("[data-modal-fecha]")) GB.fecharModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        if (!$("#preview").hidden && GB.fecharPreview) GB.fecharPreview();
        else GB.fecharModal();
      }
    });

    window.addEventListener("hashchange", function () {
      if (GB.usuario()) GB.render();
    });

    GB.iniciarUI();
  });
})();
