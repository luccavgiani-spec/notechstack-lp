const DEFAULT_API_URL = "https://api.pagar.me/core/v5";

export interface PagarmeResult {
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
}

export function pagarmeApiUrl(): string {
  return (Deno.env.get("PAGARME_API_URL") || DEFAULT_API_URL).replace(/\/$/, "");
}

export function pagarmeAuthHeader(): string {
  const secret = Deno.env.get("PAGARME_SECRET_KEY") || "";
  return `Basic ${btoa(`${secret}:`)}`;
}

export async function pagarmeRequest(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<PagarmeResult> {
  const response = await fetch(`${pagarmeApiUrl()}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": pagarmeAuthHeader(),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  return { ok: response.ok, status: response.status, data };
}

export function gatewayStatus(order: Record<string, unknown>): string {
  const charges = Array.isArray(order.charges) ? order.charges : [];
  const charge = (charges[0] || {}) as Record<string, unknown>;
  return String(charge.status || order.status || "pending").toLowerCase();
}

export function gatewayCharge(order: Record<string, unknown>): Record<string, unknown> {
  const charges = Array.isArray(order.charges) ? order.charges : [];
  return (charges[0] || {}) as Record<string, unknown>;
}
