// Public browser tokenization key for the existing production account.
// Secret API/webhook credentials belong only in Supabase secrets.
(function (window) {
  'use strict';
  window.NO_CHECKOUT_CONFIG = Object.assign({}, window.NO_CHECKOUT_CONFIG || {}, {
    pagarmePublicKey: 'pk_bB9mw7BtD8CO6aLr',
  });
})(window);
