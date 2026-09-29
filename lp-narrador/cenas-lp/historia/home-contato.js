/* Contato exclusivo da home. O contrato do serviço mantém os leads no funil existente. */
(function(){
  'use strict';
  const form = document.getElementById('homeLeadForm');
  if (!form) return;
  const steps = Array.from(form.querySelectorAll('.home-pergunta'));
  const back = document.getElementById('leadVoltar');
  const next = document.getElementById('leadEnviar');
  const progress = document.getElementById('leadProgresso');
  const bar = document.getElementById('leadBarra');
  const error = document.getElementById('leadErro');
  const status = document.getElementById('leadStatus');
  const nav = form.querySelector('.home-form-nav');
  const mode = form.dataset.mode || 'contato_home';
  const draft = window.createLeadProgress?.(form, mode);
  const track = (event, params, key) => window.track?.(event, {modo:mode, ...params}, key);
  const fileInput=document.getElementById('lead-arquivos');
  const fileList=document.getElementById('lead-arquivos-lista');
  const links=document.getElementById('lead-links');
  let files=[];
  function showFiles(){
    fileList.replaceChildren();
    files.forEach((file,i)=>{const li=document.createElement('li');const text=document.createElement('span');text.textContent=file.name+' · '+Math.ceil(file.size/1024)+' KB';const remove=document.createElement('button');remove.type='button';remove.textContent='Remover';remove.addEventListener('click',()=>{files.splice(i,1);showFiles();});li.append(text,remove);fileList.append(li);});
  }
  fileInput.addEventListener('change',()=>{
    const selected=[...files,...fileInput.files];fileInput.value='';
    if(selected.length>5 || selected.reduce((n,f)=>n+f.size,0)>5*1024*1024 || selected.some(f=>!f.size || !/\.(pdf|png|jpe?g|webp|txt|csv|docx|xlsx|pptx)$/i.test(f.name))){error.textContent='Selecione até 5 arquivos nos formatos indicados, somando no máximo 5 MB.';error.hidden=false;return;}
    files=selected;error.hidden=true;showFiles();
  });
  const encodeFile=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve({filename:file.name,content:String(reader.result).split(',')[1]});reader.onerror=reject;reader.readAsDataURL(file);});
  let step = 0, sending = false, sent = false;
  form.noValidate = true;
  nav.hidden = false; bar.hidden = false;
  function render(focus){
    steps.forEach((item,i) => { item.hidden = i !== step; });
    back.disabled = step === 0 || sending;
    progress.textContent = (step + 1) + ' de 5'; bar.value = step + 1;
    next.textContent = step === 4 ? 'Enviar minha ideia' : 'Continuar →';
    if (focus) steps[step].querySelector('input,select,textarea').focus({preventScroll:true});
  }
  function validate(index){
    const input = steps[index].querySelector('input,select,textarea');
    input.setCustomValidity('');
    if (input.name === 'whatsapp') {
      const digits = input.value.replace(/\D/g,'');
      const national = digits.length > 11 && digits.startsWith('55') ? digits.slice(2) : digits;
      if (!/^[1-9]{2}9\d{8}$/.test(national)) input.setCustomValidity('Informe um celular com DDD. Ex.: (11) 99999-9999.');
    } else if (input.minLength > 0 && input.value.trim().length < input.minLength) {
      input.setCustomValidity(input.name === 'descricao' ? 'Conte um pouco mais: use pelo menos 10 caracteres.' : 'Preencha este campo com pelo menos 2 caracteres.');
    }
    if (!input.checkValidity()) {
      step = index; render(true); error.textContent = input.validationMessage; error.hidden = false; input.reportValidity(); return false;
    }
    return true;
  }
  form.addEventListener('input', e => { e.target.setCustomValidity?.(''); error.hidden = true; });
  back.addEventListener('click', () => { if (sending || sent || !step) return; step--; error.hidden = true; render(true); });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (sending || sent || !validate(step)) return;
    error.hidden = true;
    track('form_pergunta_concluida', {pergunta:step+1}, String(step+1));
    track('form_etapa', {etapa:step+1,passo:step+1}, String(step+1));
    draft?.advance(step+1);
    if (step < 4) { step++; render(true); return; }
    for (let i=0;i<steps.length;i++) if (!validate(i)) return;
    const references=links.value.trim().split(/\r?\n/).filter(Boolean);
    if(references.some(link=>{try{return !['https:','http:'].includes(new URL(link).protocol);}catch{return true;}})){
      error.textContent='Use links completos, começando com https://, um por linha.';error.hidden=false;links.focus();return;
    }
    track('diag_concluir', {etapa:4}, 'home');
    const data = new FormData(form);
    const val = name => String(data.get(name)||'').trim();
    const digits = val('whatsapp').replace(/\D/g,'');
    const payload = {
      nome:val('nome'), whatsapp:digits.length <= 11 ? '55'+digits : digits,
      contexto:(mode==='contato'?'Contato site — ':'Contato home — ')+val('negocio'), objetivos:val('objetivo'), descricao:val('descricao')+(references.length?'\n\nLinks de referência:\n'+references.join('\n'):''),
      modo:mode, sid:window.leadSid, origem:window.leadOrig || {},
      event_source_url:location.href, valor:0,
      fbp:(document.cookie.match(/_fbp=([^;]+)/)||[])[1] || null,
      fbc:(document.cookie.match(/_fbc=([^;]+)/)||[])[1] || null
    };
    sending = true; next.disabled = true; back.disabled = true; next.textContent = 'Enviando…';
    form.setAttribute('aria-busy','true');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      if(files.length){
        const capability=await fetch(form.action+'?capabilities=1',{signal:controller.signal});
        const support=await capability.json();
        if(!capability.ok || support.attachments!==true)throw new Error('attachments_unavailable');
        payload.attachments=await Promise.all(files.map(encodeFile));
      }
      const response = await fetch(form.action, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});
      const result = await response.json();
      if (!response.ok || result.success !== true || !(result.saved === true || result.emailSent === true)) throw new Error('lead_not_accepted');
      draft?.finish();
      track('lead_submit', {etapa:5,valor:0}, 'home');
      if(files.length && result.attachmentsSent!==files.length){
        sent=true; steps.forEach(item=>{item.hidden=true;});nav.hidden=true;bar.hidden=true;next.hidden=true;
        status.textContent='Seu contato foi recebido, mas os arquivos não foram confirmados. Guarde-os para compartilhar quando a Nó chamar no WhatsApp.';status.hidden=false;status.focus();return;
      }
      sent = true;
      steps.forEach(item => { item.hidden = true; }); nav.hidden = true; bar.hidden = true; next.hidden = true;
      status.textContent = 'Ideia recebida! A equipe da Nó vai entrar em contato pelo WhatsApp que você informou.';
      status.hidden = false; status.focus({preventScroll:true});
    } catch (failure) {
      error.textContent = failure.message==='attachments_unavailable' ? 'O envio de arquivos ainda não está disponível. Suas respostas e arquivos continuam aqui. Você também pode remover os anexos e compartilhar links.' : 'Não foi possível confirmar o envio. Suas respostas continuam aqui. Tente novamente em instantes.';
      error.hidden = false; track('form_erro', {etapa:4});
    } finally {
      clearTimeout(timeout); sending = false; next.disabled = false; back.disabled = false; form.removeAttribute('aria-busy');
      if (!sent) render(false);
    }
  });
  window.abrirDiagnostico = function(options){
    track('diag_cta', {origem:options?.origem || 'home'});
    document.getElementById('diagnostico').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  };
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => { if(entries.some(e=>e.isIntersecting)){track('diag_abrir',{etapa:1},'home');observer.disconnect();} }, {threshold:.2});
    observer.observe(form);
  }
  render(false);
})();
