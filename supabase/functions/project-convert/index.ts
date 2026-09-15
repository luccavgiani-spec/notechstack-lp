import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handlePreflight } from "../_shared/cors.ts";
import { log } from "../_shared/logger.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(request: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request.headers.get("origin")), "Content-Type": "application/json" },
  });
}

function bearer(request: Request): string {
  const value = request.headers.get("authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

function missingFields(body: Record<string, unknown>): string[] {
  const missing: string[] = [];
  if (typeof body.projectId !== "string" || !UUID.test(body.projectId)) missing.push("projectId");
  if (!["essencial", "basico", "completo"].includes(String(body.tier))) missing.push("tier");
  if (typeof body.amountCents !== "number" || !Number.isInteger(body.amountCents) || body.amountCents < 0) missing.push("amountCents");
  if (typeof body.paymentMethod !== "string" || !body.paymentMethod.trim()) missing.push("paymentMethod");
  if (typeof body.installments !== "number" || !Number.isInteger(body.installments) || body.installments < 1) missing.push("installments");
  if (typeof body.deadlineDays !== "number" || !Number.isInteger(body.deadlineDays) || body.deadlineDays < 1) missing.push("deadlineDays");
  if (typeof body.requestId !== "string" || !body.requestId.trim() || body.requestId.length > 200) missing.push("requestId");
  return missing;
}

Deno.serve(async (request) => {
  const preflight = handlePreflight(request);
  if (preflight) return preflight;
  if (request.method !== "POST") return json(request, 405, { error_code: "METHOD_NOT_ALLOWED" });
  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !serviceKey) return json(request, 500, { error_code: "SERVER_CONFIG_MISSING" });
  const token = bearer(request);
  if (!token) return json(request, 401, { error_code: "UNAUTHENTICATED" });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const caller = await admin.auth.getUser(token);
  if (caller.error || !caller.data.user) return json(request, 401, { error_code: "UNAUTHENTICATED" });
  if (caller.data.user.app_metadata.role !== "NO_ADMIN") return json(request, 403, { error_code: "FORBIDDEN" });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const missing = missingFields(body);
  if (missing.length) return json(request, 422, { error_code: "INVALID_REQUEST", missingFields: missing });
  const { data, error } = await admin.rpc("convert_project", {
    p_project_id: body.projectId,
    p_tier: body.tier,
    p_amount_cents: body.amountCents,
    p_payment_method: body.paymentMethod,
    p_installments: body.installments,
    p_deadline_days: body.deadlineDays,
    p_request_id: body.requestId,
    p_actor_id: caller.data.user.id,
  });
  if (error) {
    const message = error.message || "";
    log("warn", "project_convert_failed", { projectId: body.projectId, code: error.code || "RPC" });
    if (message.includes("PROJECT_ALREADY_CONVERTED")) return json(request, 409, { error_code: "PROJECT_ALREADY_CONVERTED" });
    if (message.includes("PROJECT_STATE_NOT_ALLOWED")) return json(request, 409, { error_code: "PROJECT_STATE_NOT_ALLOWED" });
    if (message.includes("REQUEST_ID_CONFLICT")) return json(request, 409, { error_code: "REQUEST_ID_CONFLICT" });
    if (message.includes("PROJECT_NOT_FOUND")) return json(request, 404, { error_code: "PROJECT_NOT_FOUND" });
    return json(request, 500, { error_code: "CONVERSION_FAILED" });
  }
  log("info", "project_converted", { projectId: body.projectId });
  return json(request, 200, data);
});
