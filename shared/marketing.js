/* Tracking starts immediately, once, independently of page interaction. */
(function () {
  if (!(window.noMarketingHostAllowed && window.noMarketingHostAllowed(location.hostname))) return;
  if (window.__noGtmLoaded || document.querySelector('script[src*="googletagmanager.com/gtm.js?id=GTM-NK87FH8W"]')) return;
  window.__noGtmLoaded = true;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-NK87FH8W';
  document.head.appendChild(script);
})();
