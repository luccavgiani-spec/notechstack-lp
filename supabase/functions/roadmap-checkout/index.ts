import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handlePreflight } from "../_shared/cors.ts";
import { log } from "../_shared/logger.ts";
import { normalizePayerCpf } from "../_shared/payer-document.ts";
import { gatewayCharge, gatewayStatus, pagarmeRequest } from "../_shared/pagarme.ts";

const AMOUNT_CENTS = 14990;
const ANSWER_KEYS = ["objetivo", "negocio", "publico", "ferramentas", "resultado"] as const;

const json = (request: Request, status: number, body: unknown) => new Response(
  JSON.stringify(body),
  { status, headers: { ...corsHeaders(request.headers.get("origin")), "Content-Type": "application/json" } },
);

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function splitPhone(value: unknown): { country_code: string; area_code: string; number: string } | undefined {
  const digits = text(value).replace(/\D/g, "").replace(/^55/, "");
  if (digits.length < 10 || digits.length > 11) return undefined;
  return { country_code: "55", area_code: digits.slice(0, 2), number: digits.slice(2) };
}

function validateAnswers(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const answers: Record<string, string> = {};
  for (const key of ANSWER_KEYS) {
    const answer = text(source[key]);
    if (!answer || answer.length > 4000) return null;
    answers[key] = answer;
  }
  return answers;
}

function normalizedStatus(status: string): "pending" | "approved" | "failed" {
  if (status === "paid") return "approved";
  if (status === "failed" || status === "canceled") return "failed";
  return "pending";
}

function responseForPayment(request: Request, payment: Record<string, unknown>): Response {
  const payload = (payment.payload || {}) as Record<string, unknown>;
  const gateway = (payload.gateway || {}) as Record<string, unknown>;
  const pix = gateway.pix as Record<string, unknown> | undefined;
  return json(request, 200, {
    paymentId: payment.id,
    status: gateway.checkoutStatus || payment.status,
    ...(pix ? { pix } : {}),
  });
}

Deno.serve(async (request) => {
  const preflight = handlePreflight(request);
  if (preflight) return preflight;
  if (request.method !== "POST") return json(request, 405, { error_code: "METHOD_NOT_ALLOWED" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const secretKey = Deno.env.get("PAGARME_SECRET_KEY") || "";
  if (!supabaseUrl || !serviceKey || !secretKey) {
    return json(request, 500, { error_code: "SERVER_CONFIG_MISSING" });
  }

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const leadId = text(body.leadId);
    const sid = text(body.sid);
    const method = body.metodo === "cartao" ? "cartao" : body.metodo === "pix" ? "pix" : "";
    const cardToken = text(body.cardToken);
    const answers = validateAnswers(body.answers);

    if (!leadId || !sid || !method || !answers || (method === "cartao" && !cardToken)) {
      return json(request, 400, { error_code: "INVALID_REQUEST" });
    }
    const document = normalizePayerCpf(body.document);
    if (!document) return json(request, 400, { error_code: "INVALID_PAYER_DOCUMENT" });

    const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: lead, error: leadError } = await sb.from("leads")
      .select("id,nome,email,whatsapp,sid")
      .eq("id", leadId)
      .maybeSingle();
    if (leadError) return json(request, 500, { error_code: "LEAD_LOOKUP_FAILED" });
    if (!lead || lead.sid !== sid) return json(request, 403, { error_code: "LEAD_SESSION_MISMATCH" });

    let { data: payment } = await sb.from("payments")
      .select("id,status,gateway_order_id,payload")
      .eq("lead_id", leadId)
      .in("status", ["created", "pending"])
      .maybeSingle();

    if (payment?.gateway_order_id) return responseForPayment(request, payment);

    if (!payment) {
      const inserted = await sb.from("payments").insert({
        lead_id: leadId,
        purpose: "roadmap",
        method,
        amount_cents: AMOUNT_CENTS,
        status: "created",
        payload: { answers },
      }).select("id,status,gateway_order_id,payload").single();

      if (inserted.error?.code === "23505") {
        const existing = await sb.from("payments")
          .select("id,status,gateway_order_id,payload")
          .eq("lead_id", leadId)
          .in("status", ["created", "pending"])
          .single();
        if (existing.error) return json(request, 409, { error_code: "PAYMENT_CONFLICT" });
        payment = existing.data;
        if (payment.gateway_order_id) return responseForPayment(request, payment);
      } else if (inserted.error || !inserted.data) {
        return json(request, 500, { error_code: "PAYMENT_CREATE_FAILED" });
      } else {
        payment = inserted.data;
      }
    }

    const phone = splitPhone(lead.whatsapp);
    const customer = {
      name: lead.nome,
      email: lead.email,
      type: "individual",
      document,
      ...(phone ? { phones: { mobile_phone: phone } } : {}),
    };
    const orderCode = `no-roadmap-${payment.id}`;
    const gatewayBody: Record<string, unknown> = {
      code: orderCode,
      customer,
      items: [{ amount: AMOUNT_CENTS, description: "Roadmap + protótipo", quantity: 1, code: "ROADMAP" }],
      payments: method === "pix"
        ? [{ payment_method: "pix", pix: { expires_in: 3600 } }]
        : [{
          payment_method: "credit_card",
          credit_card: {
            card_token: cardToken,
            installments: 1,
            statement_descriptor: "NO TECH STACK",
          },
        }],
      metadata: { payment_id: payment.id, lead_id: leadId, purpose: "roadmap" },
      closed: true,
    };

    const orderResult = await pagarmeRequest("POST", "/orders", gatewayBody);
    if (!orderResult.ok || !orderResult.data.id) {
      log("error", "roadmap_checkout_gateway_failed", { paymentId: payment.id, status: orderResult.status });
      return json(request, 502, { error_code: "PAGARME_ORDER_FAILED", paymentId: payment.id });
    }

    const charge = gatewayCharge(orderResult.data);
    const transaction = (charge.last_transaction || {}) as Record<string, unknown>;
    const pix = method === "pix" ? {
      qrCode: transaction.qr_code || null,
      qrCodeUrl: transaction.qr_code_url || null,
      expiresAt: transaction.expires_at || transaction.expiration_date || null,
    } : undefined;
    const checkoutStatus = normalizedStatus(gatewayStatus(orderResult.data));
    // A resposta síncrona pode informar cartão aprovado, mas o estado canônico
    // só avança para approved depois que o webhook reconsulta o pedido.
    const persistedStatus = checkoutStatus === "approved" ? "pending" : checkoutStatus;
    const gatewayPayload = {
      answers,
      gateway: { checkoutStatus, ...(pix ? { pix } : {}) },
    };
    const updated = await sb.from("payments").update({
      gateway_order_id: String(orderResult.data.id),
      gateway_charge_id: charge.id ? String(charge.id) : null,
      status: persistedStatus,
      payload: gatewayPayload,
    }).eq("id", payment.id).select("id,status,gateway_order_id,payload").single();
    if (updated.error || !updated.data) {
      log("error", "roadmap_checkout_persist_failed", {
        paymentId: payment.id,
        code: updated.error?.code || "missing_data",
      });
      return json(request, 500, { error_code: "PAYMENT_UPDATE_FAILED" });
    }

    log("info", "roadmap_checkout_created", {
      paymentId: payment.id,
      status: persistedStatus,
      checkoutStatus,
      method,
    });
    return responseForPayment(request, updated.data);
  } catch (error) {
    log("error", "roadmap_checkout_internal", { error: error instanceof Error ? error.name : "unknown" });
    return json(request, 500, { error_code: "INTERNAL" });
  }
});
