/* Checkout transparente do roadmap. A chave pública da Pagar.me pode ficar no
   navegador; a chave secreta nunca entra aqui. Endpoints/config são injetáveis
   para que o mesmo contrato rode contra o gateway mock local. */
(function (window) {
  'use strict';

  const FUNCTIONS = 'https://sdeowbqmwkwseyktyemn.supabase.co/functions/v1';
  const leadBySid = new Map();

  class RoadmapCheckoutError extends Error {
    constructor(code, message, status) {
      super(message || code);
      this.name = 'RoadmapCheckoutError';
      this.code = code;
      this.status = status || 0;
    }
  }

  function config() {
    const custom = window.NO_CHECKOUT_CONFIG || {};
    return {
      sendLeadUrl: custom.sendLeadUrl || `${FUNCTIONS}/send-lead-email`,
      checkoutUrl: custom.checkoutUrl || `${FUNCTIONS}/roadmap-checkout`,
      pagarmePublicKey: custom.pagarmePublicKey || window.VITE_PAGARME_PUBLIC_KEY || '',
      tokenUrl: custom.tokenUrl || 'https://api.pagar.me/core/v5/tokens',
    };
  }

  async function jsonRequest(url, options) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new RoadmapCheckoutError(
        data.error_code || `HTTP_${response.status}`,
        data.message || data.error || 'Não foi possível concluir agora.',
        response.status,
      );
    }
    return data;
  }

  function leadPayload(lead, answers) {
    return {
      nome: lead.nome,
      email: lead.email,
      whatsapp: lead.whatsapp,
      contexto: 'roadmap',
      sid: lead.sid,
      objetivos: answers.objetivo,
      descricao: [
        `Negócio: ${answers.negocio}`,
        `Público: ${answers.publico}`,
        `Ferramentas: ${answers.ferramentas}`,
        `Resultado: ${answers.resultado}`,
      ].join('\n'),
      valor: 149.9,
      event_source_url: location.href,
    };
  }

  function ensureLead(lead, answers) {
    const key = String(lead.sid || '');
    if (leadBySid.has(key)) return leadBySid.get(key);
    const promise = jsonRequest(config().sendLeadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(leadPayload(lead, answers)),
    }).then((data) => {
      if (!data.saved || !data.leadId) {
        throw new RoadmapCheckoutError('LEAD_NOT_SAVED', 'Não conseguimos guardar seu contato. Tente novamente.');
      }
      return data.leadId;
    }).catch((error) => {
      leadBySid.delete(key);
      throw error;
    });
    leadBySid.set(key, promise);
    return promise;
  }

  async function tokenizeCard(card) {
    const cfg = config();
    if (!cfg.pagarmePublicKey) {
      throw new RoadmapCheckoutError('PAGARME_PUBLIC_KEY_MISSING', 'Pagamento por cartão ainda não está disponível.');
    }
    const url = `${cfg.tokenUrl}?appId=${encodeURIComponent(cfg.pagarmePublicKey)}`;
    const data = await jsonRequest(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'card', card }),
    });
    if (!data.id) {
      throw new RoadmapCheckoutError('CARD_TOKEN_MISSING', 'Confira os dados do cartão e tente novamente.');
    }
    return data.id;
  }

  function normalizePayerCpf(value) {
    if (typeof value !== 'string' || !/^[\d.\s-]+$/.test(value)) return null;
    const digits = value.replace(/\D/g, '');
    if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return null;
    for (let length = 9; length <= 10; length++) {
      let sum = 0;
      for (let i = 0; i < length; i++) sum += Number(digits[i]) * (length + 1 - i);
      const remainder = (sum * 10) % 11;
      if ((remainder === 10 ? 0 : remainder) !== Number(digits[length])) return null;
    }
    return digits;
  }

  async function checkout({ lead, answers, metodo, card, document }) {
    const payerDocument = normalizePayerCpf(document);
    if (!payerDocument) throw new RoadmapCheckoutError('INVALID_PAYER_DOCUMENT', 'Confira o CPF do pagador.');
    const leadId = await ensureLead(lead, answers);
    const body = { leadId, sid: lead.sid, metodo, answers, document: payerDocument };
    if (metodo === 'cartao') body.cardToken = await tokenizeCard(card);

    return jsonRequest(config().checkoutUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  window.NoRoadmapCheckout = {
    checkout,
    tokenizeCard,
    normalizePayerCpf,
    RoadmapCheckoutError,
    _resetForTests: () => leadBySid.clear(),
  };
})(window);
