/* Marketing tags only on production hosts; previews (*.vercel.app) and local never send visits. */
(function (root) {
  var ALLOWED = ['www.notechstack.com.br', 'notechstack.com.br'];
  function noMarketingHostAllowed(hostname) {
    return ALLOWED.indexOf(String(hostname || '').toLowerCase()) !== -1;
  }
  root.noMarketingHostAllowed = noMarketingHostAllowed;
  if (typeof module !== 'undefined' && module.exports) module.exports = noMarketingHostAllowed;
})(typeof window !== 'undefined' ? window : globalThis);
