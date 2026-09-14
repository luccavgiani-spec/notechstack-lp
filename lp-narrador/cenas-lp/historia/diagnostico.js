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
    mobile: { w:941, h:1672, q:[[492,820],[692,777],[717,917],[515,957]] }
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
    const alvoBase = m ? vr.width*.72 : Math.min(vr.width*.54,390);
    // No celular, o vidro inteiro precisa caber no painel mesmo com o zoom forte.
    const alvo = m ? Math.min(alvoBase*1.75,W/1.1) : alvoBase;
    const s = Math.max(alvo/vidroW,W/im.w,H/im.h);
    // Na foto desktop frontal, a posição segue diretamente o centro da vaga.
    const recuo = 0;
    const ox = clamp(vr.left-pr.left+vr.width/2-cx*s-recuo,W-im.w*s,0);
    const oy = clamp(vr.top-pr.top+vr.height/2-cy*s,H-im.h*s,0);
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
    '<section class="dg-passo" data-passo="6" hidden aria-labelledby="dgQ6"><p class="dg-k">seu briefing</p>'+
      '<h4 class="dg-q" id="dgQ6" tabindex="-1">confira antes de seguir.</h4><dl class="dg-dl" data-resumo></dl></section>'+
    '<section class="dg-passo" data-passo="7" hidden aria-labelledby="dgQ7"></section>';
  const passos = Array.from(form.querySelectorAll('.dg-passo'));
  const campo = n => form.elements[n];
  const valor = n => { const el=campo(n); return el && el.value != null ? String(el.value).trim() : ''; };
  const marcados = n => Array.from(form.querySelectorAll(`input[name="${n}"]:checked`)).map(i=>i.value);
  let atual=0, vindoDoResumo=false, telaFinalCriada=false;
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
    const s=passos[n], primeiro=nome=>s.querySelector(`[name="${nome}"]`);
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
  function resumo(){
    const linhas=[
      [0,'nome',valor('nome')],
      [1,'objetivo',(OBJETIVOS[marcados('objetivo')[0]]||'')+' · '+valor('negocio')],
      [2,'quem usa',PUBLICO[marcados('publico')[0]]||''],
      [3,'ferramentas',valor('ferramentas')],
      [4,'primeira versão',valor('resultado')],
      [5,'e-mail',valor('email')],[5,'telefone',valor('telefone')],
      ...(valor('empresa')?[[5,'@ da empresa',valor('empresa')]]:[])
    ];
    const dl=form.querySelector('[data-resumo]'); dl.replaceChildren();
    linhas.forEach(([n,rot,v])=>{
      const div=document.createElement('div'); div.className='dg-linha';
      const dt=document.createElement('dt'); dt.textContent=rot;
      const dd=document.createElement('dd'); dd.textContent=v;
      const b=document.createElement('button'); b.type='button'; b.className='dg-editar'; b.dataset.ir=n;
      b.textContent='editar'; b.setAttribute('aria-label','editar '+rot);
      div.append(dt,dd,b); dl.append(div);
    });
  }
  function criaFinal(){
    if (telaFinalCriada) return;
    telaFinalCriada=true;
    passos[7].innerHTML='<p class="dg-k">seu protótipo</p><h4 class="dg-q" id="dgQ7" tabindex="-1">pronto para dar o primeiro passo?</h4>'+
      '<div class="dg-preco"><p class="dg-preco-rot">protótipo navegável deste briefing</p>'+
      '<p class="dg-preco-de">de <s>R$ 450,00</s> por</p><p class="dg-preco-por">R$ 199,90</p>'+
      '<p class="dg-preco-unico">pagamento único do protótipo</p>'+
      '<p class="dg-preco-nota">o desenvolvimento completo é contratado depois, com escopo definido no roadmap.</p></div>'+
      '<p class="dg-s">como você pagaria?</p><div class="dg-ops" role="radiogroup" aria-label="Forma de pagamento">'+
      opcoes('pagamento','radio',{pix:'Pix',cartao:'cartão'})+'</div><p class="dg-erro" role="alert" hidden></p>'+
      '<p class="dg-demo" role="status" hidden></p>';
  }
  function vai(n,focar=true){
    if ((n===6||n===7)&&ultimaEtapa()!==6){
      const pendente=ultimaEtapa();
      if (pendente!==atual) vai(pendente,focar);
      else valida(pendente);
      return;
    }
    if (n===7) criaFinal();
    atual=n;
    passos.forEach(s=>{ s.hidden=+s.dataset.passo!==n; });
    if (n===6) resumo();
    form.scrollTop=0; atualizaNav();
    requestAnimationFrame(marcaMais);
    if (focar){ const alvo=n===0?campo('nome'):passos[n].querySelector('.dg-q'); alvo?.focus({preventScroll:true}); }
  }
  function proximo(){
    if (atual>=0&&atual<=5){
      if (!valida(atual)) return;
      if (vindoDoResumo){
        const pendente=ultimaEtapa();
        if (pendente<6){ vai(pendente); return; }
        vindoDoResumo=false; vai(6); return;
      }
      vai(atual+1);
    } else if (atual===6) vai(7);
  }
  function pagar(){
    const s=passos[7], forma=marcados('pagamento')[0], demo=s.querySelector('.dg-demo');
    if (!forma){ demo.hidden=true; mostraErro(s,'› escolha Pix ou cartão.',s.querySelector('input[name="pagamento"]')); return; }
    mostraErro(s,'');
    demo.textContent=forma==='pix'
      ? '> demonstração: o Pix ainda não está ativo nesta página. nenhum QR Code foi gerado, nada foi cobrado e seus dados não foram enviados.'
      : '> demonstração: o pagamento por cartão ainda não está ativo nesta página. nenhum dado de cartão é pedido, nada foi cobrado e seus dados não foram enviados.';
    demo.hidden=false; mostraNoVidro(demo);
  }
  function atualizaNav(){
    tela.classList.toggle('em-inicio',atual===0);
    tela.querySelector('[data-nav="voltar"]').disabled=atual===0;
    tela.querySelector('.dg-fase').textContent=String(Math.min(atual,5)).padStart(2,'0')+' / 05';
    const nx=tela.querySelector('[data-nav="proximo"]'), acao=tela.querySelector('[data-nav="acao"]');
    nx.disabled=atual===0||atual===7;
    nx.textContent=atual===5?'resumo →':atual===6?'continuar →':'próximo →';
    acao.textContent=atual===7?'pagar →':nx.textContent;
    dica.textContent=atual===7?'pagamento demonstrativo':atual===6?'revise o briefing':'↵ enter avança';
  }
  tela.addEventListener('click',e=>{
    const b=e.target.closest('button'); if (!b) return;
    if (b.dataset.ir!==undefined){ vindoDoResumo=true; vai(+b.dataset.ir); return; }
    if (b.dataset.nav==='voltar'&&atual>0) vai(atual-1);
    if (b.dataset.nav==='comecar'){ proximo(); return; }
    if (b.dataset.nav==='proximo'&&atual<7) proximo();
    if (b.dataset.nav==='acao') atual===7?pagar():proximo();
  });
  form.addEventListener('submit',e=>{ e.preventDefault(); atual===7?pagar():proximo(); });
  form.addEventListener('keydown',e=>{
    if (e.key!=='Enter'||e.target.tagName==='TEXTAREA'||e.target.tagName==='BUTTON') return;
    e.preventDefault(); atual===7?pagar():proximo();
  });
  form.addEventListener('scroll',marcaMais,{passive:true});
  form.addEventListener('input',e=>{
    const s=e.target.closest('.dg-passo'), p=s&&s.querySelector('.dg-erro');
    if (p){ p.hidden=true; p.textContent=''; }
    if (s&&+s.dataset.passo===7) s.querySelector('.dg-demo').hidden=true;
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
      if (!media.matches) (atual===0?campo('nome'):passos[atual].querySelector('.dg-q'))?.focus({preventScroll:true});
    },reduz.matches?0:650);
  };
  tela.addEventListener('pointerdown',()=>marcaEntrada('monitor'),{once:true});
  tela.addEventListener('focusin',()=>marcaEntrada('monitor'),{once:true});
  if (location.hash==='#diagnostico'||location.hash==='#pouso')
    addEventListener('load',()=>window.abrirDiagnostico({origem:'deeplink'}),{once:true});
})();
