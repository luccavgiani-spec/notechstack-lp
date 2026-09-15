import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { log } from "../_shared/logger.ts";
import { gatewayCharge, gatewayStatus, pagarmeRequest } from "../_shared/pagarme.ts";

const json = (status: number, body: unknown) => new Response(
  JSON.stringify(body),
  { status, headers: { "Content-Type": "application/json" } },
);

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function constantTimeEqual(left: string, right: string): Promise<boolean> {
  const [a, b] = await Promise.all([digest(left), digest(right)]);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

async function authorized(request: Request): Promise<boolean> {
  const user = Deno.env.get("PAGARME_WEBHOOK_USER") || "";
  const pass = Deno.env.get("PAGARME_WEBHOOK_PASS") || "";
  const supplied = request.headers.get("Authorization") || "";
  const expected = `Basic ${btoa(`${user}:${pass}`)}`;
  const matches = await constantTimeEqual(supplied, expected);
  return Boolean(user && pass && matches);
}

function eventStatus(type: string, data: Record<string, unknown>): string {
  if (type.endsWith(".paid")) return "paid";
  if (type.includes("failed")) return "failed";
  if (type.includes("canceled") || type.includes("expired")) return "canceled";
  return String(data.status || "pending").toLowerCase();
}

function safeEnvelope(
  eventId: string,
  type: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const charges = Array.isArray(data.charges) ? data.charges : [];
  const charge = (charges[0] || {}) as Record<string, unknown>;
  const isChargeEvent = type.startsWith("charge.");
  return {
    id: eventId,
    type,
    data: {
      id: data.id || null,
      code: data.code || null,
      status: data.status || null,
      charge_id: isChargeEvent ? data.id || null : charge.id || null,
      charge_status: isChargeEvent ? data.status || null : charge.status || null,
    },
  };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json(405, { error_code: "METHOD_NOT_ALLOWED" });
  if (!(await authorized(request))) return json(401, { error_code: "UNAUTHORIZED" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const secretKey = Deno.env.get("PAGARME_SECRET_KEY") || "";
  if (!supabaseUrl || !serviceKey || !secretKey) return json(500, { error_code: "SERVER_CONFIG_MISSING" });

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const eventId = String(body.id || "").trim();
    const type = String(body.type || "").trim();
    const data = body.data && typeof body.data === "object" ? body.data as Record<string, unknown> : {};
    const nestedOrder = data.order && typeof data.order === "object"
      ? data.order as Record<string, unknown>
      : {};
    const orderId = String(
      nestedOrder.id || data.order_id || (type.startsWith("order.") ? data.id : "") || "",
    ).trim();
    if (!eventId || !type || !orderId) return json(400, { error_code: "INVALID_EVENT" });

    const orderResult = await pagarmeRequest("GET", `/orders/${encodeURIComponent(orderId)}`);
    if (!orderResult.ok) {
      log("error", "pagarme_webhook_confirm_failed", { gateway_event_id: eventId, status: orderResult.status });
      return json(502, { error_code: "PAGARME_CONFIRM_FAILED" });
    }

    const confirmedStatus = gatewayStatus(orderResult.data);
    const claimedStatus = eventStatus(type, data);
    const charge = gatewayCharge(orderResult.data);
    const paidAtRaw = orderResult.data.closed_at || orderResult.data.updated_at || orderResult.data.created_at;
    const paidAt = typeof paidAtRaw === "string" ? paidAtRaw : new Date().toISOString();
    const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: result, error } = await sb.rpc("apply_roadmap_payment_event", {
      p_gateway_event_id: eventId,
      p_type: type,
      p_gateway_order_id: orderId,
      p_gateway_charge_id: charge.id ? String(charge.id) : null,
      p_event_status: claimedStatus,
      p_confirmed_status: confirmedStatus,
      p_payload: safeEnvelope(eventId, type, data),
      p_paid_at: paidAt,
    });
    if (error) {
      log("error", "pagarme_webhook_rpc_failed", { gateway_event_id: eventId, type });
      return json(500, { error_code: "PAYMENT_EVENT_FAILED" });
    }

    log("info", "pagarme_webhook_processed", {
      gateway_event_id: eventId,
      type,
      status: confirmedStatus,
      applied: Boolean(result?.applied),
    });
    return json(200, { ok: true, ...result });
  } catch (error) {
    log("error", "pagarme_webhook_internal", { error: error instanceof Error ? error.name : "unknown" });
    return json(500, { error_code: "INTERNAL" });
  }
});
