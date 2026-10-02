/* Marketing after the main content is ready; localhost never sends visits. */
(function(){
 let loaded=false;
 function load(){if(loaded||/^(localhost|127\.0\.0\.1)$/.test(location.hostname))return;loaded=true;window.dataLayer=window.dataLayer||[];window.dataLayer.push({'gtm.start':Date.now(),event:'gtm.js'});const script=document.createElement('script');script.src='https://www.googletagmanager.com/gtm.js?id=GTM-NK87FH8W';script.async=true;document.body.append(script);}
 ['pointerdown','keydown','scroll'].forEach(event=>addEventListener(event,load,{once:true,passive:true}));
 function idle(){setTimeout(load,5000);}if(document.readyState==='complete')idle();else addEventListener('load',idle,{once:true});
})();
