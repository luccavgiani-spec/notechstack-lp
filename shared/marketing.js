/* Tracking starts immediately, once, independently of page interaction. */
(function () {
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
  if (window.__noGtmLoaded || document.querySelector('script[src*="googletagmanager.com/gtm.js?id=GTM-NK87FH8W"]')) return;
  window.__noGtmLoaded = true;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-NK87FH8W';
  document.head.appendChild(script);
})();
