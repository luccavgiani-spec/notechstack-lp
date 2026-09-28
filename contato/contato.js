(function(){
 const query=new URLSearchParams(location.search);
 try{window.leadSid=sessionStorage.getItem('no-contact-sid')||crypto.randomUUID();sessionStorage.setItem('no-contact-sid',window.leadSid);}catch{window.leadSid=crypto.randomUUID();}
 window.leadOrig={referrer:document.referrer};
 ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','fbclid'].forEach(key=>{const value=query.get(key);if(value)window.leadOrig[key]=value;});
 if(query.get('perfil')==='agencia')document.getElementById('lead-objetivo').value='Parceria para agência';
 document.getElementById('homeLeadForm').dataset.mode='contato';
})();
