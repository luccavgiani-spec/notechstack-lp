/* Diagnóstico "Senta aí": foto alinhada à vaga e briefing no vidro. Tudo local. */
(function(){
  'use strict';
  const sec = document.getElementById('diagnostico');
  if (!sec) return;
  const palco = sec.querySelector('.dg-palco');
  const vaga = sec.querySelector('.dg-vaga');
  const foto = sec.querySelector('.dg-foto img');
  const tela = sec.querySelector('.dg-tela');
  const form = sec.querySelector('.dg-corpo');
  const dica = sec.querySelector('.dg-dica');
  const media = matchMedia('(max-width:760px)');
  const reduz = matchMedia('(prefers-reduced-motion: reduce)');
  const IMG = {
    desktop: { w:1672, h:941, q:[[957,115],[1291,103],[1300,365],[968,378]] },
    mobile: { w:1024, h:1536, q:[[311,406],[711,408],[708,702],[313,699]] }
  };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  let ultimaMedida = '';
  function posiciona(){
    const pr = palco.getBoundingClientRect(), vr = vaga.getBoundingClientRect();
    const W = pr.width, H = pr.height;
    if (!W || !H || !vr.width || !vr.height) return;
    const m = media.matches, im = m ? IMG.mobile : IMG.desktop;
    const cx = (im.q[0][0]+im.q[1][0]+im.q[2][0]+im.q[3][0])/4;
    const cy = (im.q[0][1]+im.q[1][1]+im.q[2][1]+im.q[3][1])/4;
    const vidroW = Math.hypot(im.q[1][0]-im.q[0][0],im.q[1][1]-im.q[0][1]);
    const alvoBase = m ? Math.min(vr.width*.9,W-34) : Math.min(vr.width*.54,390);
    // O retrato frontal preenche a largura do celular sem cortar o monitor.
    const alvo = alvoBase;
    const s = Math.max(alvo/vidroW,W/im.w,H/im.h);
    // Na foto desktop frontal, a posição segue diretamente o centro da vaga.
    const recuo = 0;
    const ox = clamp(vr.left-pr.left+vr.width/2-cx*s-recuo,W-im.w*s,0);
    // No retrato mobile, a foto pode começar abaixo do topo do palco: o fundo
    // bege continua preenchendo a área e o monitor não invade os tópicos.
    const limiteInferior = m ? W*.16 : 0;
    const oy = clamp(vr.top-pr.top+vr.height/2-cy*s,H-im.h*s,limiteInferior);
    const p = (u,v) => {
      const [a,b,c,d] = im.q;
      return [
        ((1-u)*(1-v)*a[0]+u*(1-v)*b[0]+u*v*c[0]+(1-u)*v*d[0])*s+ox,
        ((1-u)*(1-v)*a[1]+u*(1-v)*b[1]+u*v*c[1]+(1-u)*v*d[1])*s+oy
      ];
    };
    // A imagem tem perspectiva: os quatro lados não formam um paralelogramo.
    // Recuo curto preserva os cantos convexos sem deixar borda vazia no vidro.
    const [tl,tr,br,bl] = [p(.02,.04),p(.98,.04),p(.98,.96),p(.02,.96)];
    const xv = [(tr[0]-tl[0]+br[0]-bl[0])/2,(tr[1]-tl[1]+br[1]-bl[1])/2];
    const yv = [(bl[0]-tl[0]+br[0]-tr[0])/2,(bl[1]-tl[1]+br[1]-tr[1])/2];
    const gw = Math.hypot(...xv), gh = Math.hypot(...yv);
    const k = clamp(gw/24,10,13.5)/16, tw = gw/k, th = gh/k;
    const dx1=tr[0]-br[0], dx2=bl[0]-br[0], dx3=tl[0]-tr[0]+br[0]-bl[0];
    const dy1=tr[1]-br[1], dy2=bl[1]-br[1], dy3=tl[1]-tr[1]+br[1]-bl[1];
    const den=dx1*dy2-dx2*dy1;
    const g=(dx3*dy2-dx2*dy3)/den, h=(dx1*dy3-dx3*dy1)/den;
    const a=tr[0]-tl[0]+g*tr[0], b=bl[0]-tl[0]+h*bl[0];
    const d=tr[1]-tl[1]+g*tr[1], e=bl[1]-tl[1]+h*bl[1];
    const matrix=[a/tw,d/tw,0,g/tw,b/th,e/th,0,h/th,0,0,1,0,tl[0],tl[1],0,1];
    const medida = [m,im.w*s,im.h*s,ox,oy,tw,th,...matrix]
      .map(v => typeof v === 'number' ? v.toFixed(3) : String(v)).join(',');
    if (medida === ultimaMedida) return;
    ultimaMedida = medida;
    foto.style.width = im.w*s+'px'; foto.style.height = im.h*s+'px';
    foto.style.transform = `translate(${ox}px,${oy}px)`;
    tela.style.width = tw+'px'; tela.style.height = th+'px';
    tela.style.transform = `matrix3d(${matrix.join(',')})`;
    palco.classList.add('pronto');
  }
  new ResizeObserver(posiciona).observe(palco);
  new ResizeObserver(posiciona).observe(vaga);
  // Um scrollIntoView/foco pode rolar um ancestral com overflow:hidden e cortar o título.
  palco.addEventListener('scroll',()=>{ if (palco.scrollTop||palco.scrollLeft) palco.scrollTo(0,0); },{passive:true});
  media.addEventListener('change', posiciona);
  addEventListener('load', posiciona);
  posiciona();

  const OBJETIVOS = { novo:'criar um sistema do zero', operacao:'organizar a operação', melhorar:'melhorar um sistema que já existe' };
  const PUBLICO = { equipe:'minha equipe', clientes:'meus clientes', ambos:'equipe e clientes' };
  // Estas strings são constantes locais; respostas da pessoa nunca entram em innerHTML.
  const opcoes = (nome,tipo,mapa) => Object.keys(mapa).map(v =>
    `<label class="dg-op"><input type="${tipo}" name="${nome}" value="${v}"><span>${mapa[v]}</span></label>`).join('');
  const passo = (n,q,corpo) =>
    `<section class="dg-passo" data-passo="${n}" hidden aria-labelledby="dgQ${n}">`+
    `<h4 class="dg-q" id="dgQ${n}" tabindex="-1">${q}</h4>${corpo}`+
    '<p class="dg-erro" role="alert" hidden></p></section>';
  form.innerHTML =
    '<section class="dg-passo dg-inicio" data-passo="0" aria-label="Iniciar diagnóstico">'+
      '<p class="dg-abertura">5 etapas e começamos seu projeto<span class="dg-cursor" aria-hidden="true">_</span></p>'+
      '<label class="dg-campo"><span>qual é o seu nome?</span><input name="nome" type="text" maxlength="80" autocomplete="name" placeholder="seu nome"></label>'+
      '<p class="dg-erro" role="alert" hidden></p><button type="button" class="dg-comecar" data-nav="comecar">iniciar →</button></section>'+
    passo(1,'o que você quer fazer?',
      '<div class="dg-ops col" role="radiogroup" aria-labelledby="dgQ1">'+opcoes('objetivo','radio',OBJETIVOS)+'</div>'+
      '<label class="dg-campo"><span>qual é o negócio ou a área?</span><input name="negocio" type="text" maxlength="80" autocomplete="organization" placeholder="ex.: clínica, loja, escritório contábil"></label>')+
    passo(2,'quem vai usar?',
      '<div class="dg-ops col" role="radiogroup" aria-labelledby="dgQ2">'+opcoes('publico','radio',PUBLICO)+'</div>')+
    passo(3,'quais ferramentas vocês usam?',
      '<label class="dg-campo"><span>conte quais já fazem parte da rotina</span><textarea name="ferramentas" rows="3" maxlength="320" placeholder="ex.: WhatsApp, planilha, sistema próprio — ou nenhuma"></textarea></label>')+
    passo(4,'o que a primeira versão precisa resolver?',
      '<label class="dg-campo"><span>descreva o resultado essencial</span><textarea name="resultado" rows="3" maxlength="400" placeholder="ex.: parar de perder pedidos e acompanhar cada status"></textarea></label>')+
    passo(5,'como te encontramos?',
      '<div class="dg-contato"><label class="dg-campo"><span>seu e-mail</span><input name="email" type="email" maxlength="120" autocomplete="email" inputmode="email"></label>'+
      '<label class="dg-campo"><span>seu telefone</span><input name="telefone" type="tel" maxlength="25" autocomplete="tel" inputmode="tel" placeholder="(11) 99999-9999"></label>'+
      '<label class="dg-campo"><span>@ empresa <small>opcional</small></span><input name="empresa" type="text" maxlength="80" placeholder="@suaempresa"></label></div>')+
    '<section class="dg-passo" data-passo="7" hidden aria-labelledby="dgQ7"></section>'+
    '<section class="dg-passo" data-passo="8" hidden aria-labelledby="dgQ8"></section>'+
    '<section class="dg-passo" data-passo="9" hidden aria-labelledby="dgQ9"></section>';
  const passos = Array.from(form.querySelectorAll('.dg-passo'));
  const telaPasso = n => form.querySelector(`.dg-passo[data-passo="${n}"]`);
  const campo = n => form.elements[n];
  const valor = n => { const el=campo(n); return el && el.value != null ? String(el.value).trim() : ''; };
  const marcados = n => Array.from(form.querySelectorAll(`input[name="${n}"]:checked`)).map(i=>i.value);
  let atual=0, telaFinalCriada=false, metodoPagamento='', pagamentoEmCurso=false, pagamentoConcluido=false;
  function marcaMais(){
    const mais=form.scrollHeight-form.scrollTop-form.clientHeight>6;
    form.classList.toggle('tem-mais',mais);
  }
  function mostraNoVidro(alvo,msg){
    if (!alvo) return;
    const a=alvo.closest('.dg-op, .dg-campo')||alvo;
    const r=a.getBoundingClientRect(), fr=form.getBoundingClientRect();
    const mr=msg ? msg.getBoundingClientRect() : r;
    const ya=r.top-fr.top+form.scrollTop, yb=mr.bottom-fr.top+form.scrollTop;
    form.scrollTop=yb-ya+16<=form.clientHeight ? Math.max(0,yb+8-form.clientHeight) : Math.max(0,ya-12);
    marcaMais();
  }
  function mostraErro(s,msg,foco){
    const p=s.querySelector('.dg-erro'); if (!p) return;
    p.textContent=msg; p.hidden=!msg;
    if (!msg) return;
    // Nunca transferir foco a uma etapa escondida.
    if (s.hidden) return;
    if (foco) foco.focus({preventScroll:true});
    mostraNoVidro(foco||p,p);
  }
  function valida(n,silencio){
    const s=telaPasso(n), primeiro=nome=>s.querySelector(`[name="${nome}"]`);
    const erro=(msg,foco)=>{ if (!silencio) mostraErro(s,msg,foco); return !msg; };
    if (n===0&&valor('nome').length<2) return erro('› como podemos te chamar?',campo('nome'));
    if (n===1){
      if (!marcados('objetivo').length) return erro('› escolha o que você quer fazer.',primeiro('objetivo'));
      if (valor('negocio').length<2) return erro('› conta qual é o negócio ou a área.',campo('negocio'));
    }
    if (n===2&&!marcados('publico').length) return erro('› diga quem vai usar.',primeiro('publico'));
    if (n===3&&valor('ferramentas').length<2) return erro('› conte quais ferramentas usam, ou escreva "nenhuma".',campo('ferramentas'));
    if (n===4&&valor('resultado').length<10) return erro('› descreva o que a primeira versão deve resolver.',campo('resultado'));
    if (n===5){
      const em=campo('email');
      if (!valor('email')||!em.checkValidity()||!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor('email'))) return erro('› confira o e-mail.',em);
      if (valor('telefone').replace(/\D/g,'').length<10) return erro('› confira o telefone com DDD.',campo('telefone'));
    }
    return erro('');
  }
  function ultimaEtapa(){
    for(let n=0;n<=5;n++) if (!valida(n,true)) return n;
    return 6;
  }
  function criaFinal(){
    if (telaFinalCriada) return;
    telaFinalCriada=true;
    telaPasso(7).innerHTML='<p class="dg-k">seu roadmap + protótipo</p><h4 class="dg-q" id="dgQ7" tabindex="-1">Transforme sua ideia em um plano que dá para executar.</h4>'+
      '<div class="dg-preco"><p class="dg-preco-rot">Por R$ 149,90, a Nó organiza o que você contou, monta um roadmap, prepara uma primeira direção de protótipo e mostra caminhos reais para colocar o produto no ar.</p>'+
      '<p class="dg-preco-por">R$ 149,90</p>'+
      '<p class="dg-preco-nota">Seu material fica pronto em até 3 dias após a confirmação do pagamento.</p></div>'+
      '<ol class="dg-prazo"><li><b>Dia 1 — referências</b><span>contato para referências, marca e contexto complementar.</span></li>'+
      '<li><b>Dias 2 e 3 — organização</b><span>plano, protótipo e caminhos de construção.</span></li>'+
      '<li><b>Entrega — seu dashboard</b><span>acesso próprio para navegar e decidir como continuar.</span></li></ol>'+
      '<p class="dg-erro" role="alert" hidden></p>';
    telaPasso(8).innerHTML='<p class="dg-k">pagamento</p><h4 class="dg-q" id="dgQ8" tabindex="-1">como você quer pagar?</h4>'+
      '<div class="dg-metodos" role="group" aria-label="Escolha a forma de pagamento">'+
      '<button type="button" data-pagamento="pix"><b>Pix</b><span>QR Code ou copia e cola</span></button>'+
      '<button type="button" data-pagamento="cartao"><b>cartão</b><span>preencha os dados na próxima tela</span></button></div>';
  }
  function criaMetodoPagamento(forma){
    metodoPagamento=forma;
    const s=telaPasso(9);
    if (forma==='pix'){
      s.innerHTML='<p class="dg-k">pagamento via Pix</p><h4 class="dg-q" id="dgQ9" tabindex="-1">gere seu Pix</h4>'+
        '<div class="dg-pag-metodo dg-pix"><span class="dg-pag-selo">Pix</span><div><b>pagamento na hora</b>'+
        '<p>O QR Code e o copia e cola aparecem nesta tela.</p></div></div><p class="dg-erro" role="alert" hidden></p>';
    } else {
      s.innerHTML='<p class="dg-k">pagamento</p><h4 class="dg-q" id="dgQ9" tabindex="-1">dados do cartão</h4>'+
        '<div class="dg-cartao"><label class="dg-campo"><span>nome no cartão</span><input name="cartao_nome" autocomplete="cc-name"></label>'+
        '<label class="dg-campo"><span>número do cartão</span><input name="cartao_numero" inputmode="numeric" autocomplete="cc-number" maxlength="23"></label>'+
        '<div class="dg-cartao-linha"><label class="dg-campo"><span>validade</span><input name="cartao_validade" inputmode="numeric" autocomplete="cc-exp" maxlength="5" placeholder="MM/AA"></label>'+
        '<label class="dg-campo"><span>CVV</span><input name="cartao_cvv" inputmode="numeric" autocomplete="cc-csc" maxlength="4"></label></div></div>'+
        '<p class="dg-erro" role="alert" hidden></p>';
    }
  }

  const respostas = () => ({
    objetivo: marcados('objetivo')[0] || '',
    negocio: valor('negocio'),
    publico: marcados('publico')[0] || '',
    ferramentas: valor('ferramentas'),
    resultado: valor('resultado')
  });
  const contato = () => ({
    nome: valor('nome'), email: valor('email'), whatsapp: valor('telefone'),
    sid: String(window.leadSid || '')
  });
  function cartao(){
    const validade=valor('cartao_validade').replace(/\s/g,'').split('/');
    return {
      number:valor('cartao_numero').replace(/\D/g,''),
      holder_name:valor('cartao_nome'),
      exp_month:Number(validade[0]),
      exp_year:Number(validade[1]),
      cvv:valor('cartao_cvv').replace(/\D/g,'')
    };
  }
  function validaCartao(){
    if (metodoPagamento!=='cartao') return true;
    const c=cartao();
    if (c.holder_name.length<3) return mostraErro(telaPasso(9),'› confira o nome no cartão.',campo('cartao_nome')),false;
    if (c.number.length<13||c.number.length>19) return mostraErro(telaPasso(9),'› confira o número do cartão.',campo('cartao_numero')),false;
    if (!(c.exp_month>=1&&c.exp_month<=12)||!Number.isInteger(c.exp_year)) return mostraErro(telaPasso(9),'› confira a validade em MM/AA.',campo('cartao_validade')),false;
    if (c.cvv.length<3) return mostraErro(telaPasso(9),'› confira o CVV.',campo('cartao_cvv')),false;
    mostraErro(telaPasso(9),'');
    return true;
  }
  function ocupaPagamento(ocupado){
    pagamentoEmCurso=ocupado;
    tela.querySelectorAll('[data-nav="proximo"],[data-nav="acao"],button[data-pagamento]').forEach(b=>{ b.disabled=ocupado; });
    atualizaNav();
  }
  function mostraPix(data){
    const s=telaPasso(9), pix=data.pix||{};
    s.innerHTML='<p class="dg-k">pagamento via Pix</p><h4 class="dg-q" id="dgQ9" tabindex="-1">seu Pix está pronto</h4>'+
      '<div class="dg-pix-pronto"><img class="dg-pix-qr" alt="QR Code do Pix"><div><b>escaneie ou copie o código</b><p>Assim que o pagamento for confirmado, começamos seu material.</p></div></div>'+
      '<label class="dg-campo dg-pix-codigo"><span>Pix copia e cola</span><textarea readonly rows="3"></textarea></label>'+
      '<button type="button" class="dg-copiar-pix">copiar código Pix</button><p class="dg-erro" role="alert" hidden></p>';
    const img=s.querySelector('.dg-pix-qr');
    if (pix.qrCodeUrl) img.src=String(pix.qrCodeUrl); else img.hidden=true;
    s.querySelector('.dg-pix-codigo textarea').value=String(pix.qrCode||'');
    s.querySelector('.dg-copiar-pix').addEventListener('click',async e=>{
      try{ await navigator.clipboard.writeText(String(pix.qrCode||'')); e.currentTarget.textContent='código copiado'; }
      catch(_){ e.currentTarget.textContent='selecione e copie o código acima'; }
    });
    pagamentoConcluido=true;
  }
  function mostraAprovado(){
    telaPasso(9).innerHTML='<p class="dg-k">pagamento aprovado</p><h4 class="dg-q" id="dgQ9" tabindex="-1">já começamos por aqui.</h4>'+
      '<div class="dg-aprovado"><b>Seu material fica pronto em até 3 dias após a confirmação do pagamento.</b>'+
      '<p>No Dia 1, a Nó entra em contato pelo WhatsApp para pedir referências, marca e contexto complementar.</p></div>';
    pagamentoConcluido=true;
  }
  function vai(n,focar=true){
    if (n===7&&ultimaEtapa()!==6){
      const pendente=ultimaEtapa();
      if (pendente!==atual) vai(pendente,focar);
      else valida(pendente);
      return;
    }
    if (n>=7) criaFinal();
    const anterior=atual;
    atual=n;
    passos.forEach(s=>{ s.hidden=+s.dataset.passo!==n; });
    form.scrollTop=0; atualizaNav();
    if (!reduz.matches&&n!==anterior){
      const dx=n>anterior?14:-14;
      requestAnimationFrame(()=>telaPasso(n).animate([
        {opacity:0,transform:`translateX(${dx}px) scale(.985)`,filter:'blur(1px)'},
        {opacity:1,transform:'translateX(0) scale(1)',filter:'blur(0)'}
      ],{duration:280,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'}));
    }
    requestAnimationFrame(marcaMais);
    if (focar){ const alvo=n===0?campo('nome'):telaPasso(n).querySelector('.dg-q'); alvo?.focus({preventScroll:true}); }
  }
  function proximo(){
    if (atual>=0&&atual<=5){
      if (!valida(atual)) return;
      vai(atual===5?7:atual+1);
    }
  }
  async function pagar(){
    if (atual===7){ vai(8); return; }
    if (atual!==9||pagamentoEmCurso||pagamentoConcluido) return;
    if (!validaCartao()) return;
    if (!window.NoRoadmapCheckout){ mostraErro(telaPasso(9),'› pagamento indisponível. Recarregue a página e tente novamente.'); return; }
    ocupaPagamento(true);
    mostraErro(telaPasso(9),'');
    try{
      const dados=await window.NoRoadmapCheckout.checkout({
        lead:contato(), answers:respostas(), metodo:metodoPagamento,
        card:metodoPagamento==='cartao'?cartao():undefined
      });
      if (metodoPagamento==='cartao') ['cartao_numero','cartao_validade','cartao_cvv'].forEach(n=>{ const el=campo(n); if(el) el.value=''; });
      if (dados.status==='approved') mostraAprovado();
      else if (dados.status==='failed') mostraErro(telaPasso(9),'› pagamento recusado. Confira os dados e tente de novo.',campo('cartao_numero'));
      else if (metodoPagamento==='pix'&&dados.pix) mostraPix(dados);
      else mostraErro(telaPasso(9),'› pedido criado, mas o gateway não devolveu os dados do pagamento. Tente novamente.');
    }catch(e){
      const recusa=e&&['CARD_DECLINED','PAYMENT_FAILED'].includes(e.code);
      mostraErro(telaPasso(9),recusa?'› pagamento recusado. Confira os dados e tente de novo.':'› não foi possível concluir agora. Tente novamente.');
    }finally{
      ocupaPagamento(false);
    }
  }
  function atualizaNav(){
    tela.classList.toggle('em-inicio',atual===0);
    tela.classList.toggle('em-oferta',atual===7);
    tela.classList.toggle('em-escolha-pagamento',atual===8);
    tela.querySelector('[data-nav="voltar"]').disabled=atual===0;
    tela.querySelector('.dg-fase').textContent=String(Math.min(atual,5)).padStart(2,'0')+' / 05';
    const nx=tela.querySelector('[data-nav="proximo"]'), acao=tela.querySelector('[data-nav="acao"]');
    nx.disabled=atual===0||pagamentoEmCurso;
    nx.hidden=pagamentoConcluido;
    nx.textContent=pagamentoEmCurso?'processando…':atual===5?'continuar →':atual===7?'Quero meu roadmap + protótipo — R$ 149,90':atual===9?(metodoPagamento==='pix'?'gerar Pix →':'pagar →'):'próximo →';
    acao.textContent=nx.textContent;
    acao.disabled=nx.disabled;
    acao.hidden=nx.hidden;
    dica.textContent=atual===7?'revise e avance':atual===8?'escolha uma opção':atual===9?'pagamento seguro':'↵ enter avança';
  }
  tela.addEventListener('click',e=>{
    const b=e.target.closest('button'); if (!b) return;
    if (b.dataset.pagamento){ criaMetodoPagamento(b.dataset.pagamento); vai(9); return; }
    if (b.dataset.nav==='voltar'&&atual>0) vai(atual===7?5:atual-1);
    if (b.dataset.nav==='comecar'){ proximo(); return; }
    if (b.dataset.nav==='proximo') atual>=7?pagar():proximo();
    if (b.dataset.nav==='acao') atual>=7?pagar():proximo();
  });
  form.addEventListener('submit',e=>{ e.preventDefault(); atual>=7?pagar():proximo(); });
  form.addEventListener('keydown',e=>{
    if (e.key!=='Enter'||e.target.tagName==='TEXTAREA'||e.target.tagName==='BUTTON') return;
    e.preventDefault(); atual>=7?pagar():proximo();
  });
  form.addEventListener('scroll',marcaMais,{passive:true});
  form.addEventListener('input',e=>{
    const s=e.target.closest('.dg-passo'), p=s&&s.querySelector('.dg-erro');
    if (p){ p.hidden=true; p.textContent=''; }
  });
  atualizaNav(); requestAnimationFrame(marcaMais);

  let entrada=false;
  function marcaEntrada(origem){
    if (entrada) return;
    entrada=true;
    if (typeof window.track==='function') window.track('diag_abrir',{etapa:1,origem},'1');
  }
  window.abrirDiagnostico=function(opts){
    marcaEntrada(opts&&opts.origem||'cta');
    const alvo=media.matches?vaga:palco;
    palco.scrollTo(0,0);
    const r=alvo.getBoundingClientRect();
    window.scrollTo({top:window.scrollY+r.top+r.height/2-innerHeight/2,behavior:reduz.matches?'instant':'smooth'});
    if (!media.matches) setTimeout(()=>{
      if (!media.matches) (atual===0?campo('nome'):telaPasso(atual).querySelector('.dg-q'))?.focus({preventScroll:true});
    },reduz.matches?0:650);
  };
  tela.addEventListener('pointerdown',()=>marcaEntrada('monitor'),{once:true});
  tela.addEventListener('focusin',()=>marcaEntrada('monitor'),{once:true});
  if (location.hash==='#diagnostico'||location.hash==='#pouso')
    addEventListener('load',()=>window.abrirDiagnostico({origem:'deeplink'}),{once:true});
})();
