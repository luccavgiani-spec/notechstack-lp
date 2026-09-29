/* Respostas privadas: nunca passam pelo dataLayer/GA4. */
(function(){
  'use strict';
  window.createLeadProgress = function(form, mode){
    const endpoint = new URL('save-lead-progress', form.action).href;
    const fields = ['nome','whatsapp','negocio','objetivo','descricao','links'];
    let completed = 0, finalized = false, interacted = false, timer, retry, version = 0, acknowledged = '', pending = '', attempts = 0;
    function snapshot(){
      const respostas = {};
      fields.forEach(name => { const input = form.elements.namedItem(name); if (input) respostas[name] = input.value.trim(); });
      return {sid:window.leadSid, modo:mode, etapa:completed, finalizado:finalized, respostas, origem:window.leadOrig || {}};
    }
    function save(beacon){
      clearTimeout(timer);
      if (!interacted) return;
      const data = snapshot();
      if (!data.sid || !Object.values(data.respostas).some(Boolean)) return;
      const signature = JSON.stringify(data);
      if (signature === acknowledged || (!beacon && signature === pending)) return;
      const requestVersion = version = Math.max(Date.now(), version + 1);
      const body = JSON.stringify({...data, versao:requestVersion});
      const small = new TextEncoder().encode(body).length < 60000;
      if (beacon && small && navigator.sendBeacon?.(endpoint, new Blob([body],{type:'text/plain'}))) return;
      pending = signature;
      fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:small})
        .then(async response => { if (!response.ok || !(await response.json()).ok) throw new Error('save_failed'); if (requestVersion === version) { acknowledged = signature; attempts = 0; } })
        .catch(() => { if (requestVersion === version && attempts++ < 3) { clearTimeout(retry); retry = setTimeout(() => save(false), 3000 * attempts); } })
        .finally(() => { if (pending === signature) pending = ''; });
    }
    form.addEventListener('input', e => {
      if (finalized || !fields.includes(e.target.name)) return;
      interacted = true;
      clearTimeout(timer); timer = setTimeout(() => save(false), 1000);
    });
    form.addEventListener('focusout', e => { if (!finalized && fields.includes(e.target.name)) { interacted = true; save(false); } });
    addEventListener('pagehide', () => save(true));
    addEventListener('online', () => { attempts = 0; save(false); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(true); });
    const notice = document.createElement('p');
    notice.className = 'home-ajuda';
    notice.textContent = 'Ao preencher, suas respostas são salvas para que a Nó possa retomar seu atendimento, mesmo se você não concluir o envio.';
    const privacy = document.createElement('a');
    privacy.href = '/privacidade/'; privacy.textContent = ' Política de privacidade.'; notice.append(privacy);
    form.prepend(notice);
    return {
      advance(number){ interacted = true; completed = Math.max(completed, number); save(false); },
      finish(){ finalized = true; save(false); }
    };
  };
})();
