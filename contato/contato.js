(function(){
 const query=new URLSearchParams(location.search);
 if(query.get('perfil')==='agencia')document.getElementById('lead-objetivo').value='Parceria para agência';
 document.getElementById('homeLeadForm').dataset.mode='contato';
})();
