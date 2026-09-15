import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handlePreflight } from "../_shared/cors.ts";
import { log } from "../_shared/logger.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROJECT_STATUSES = new Set([
  "CONVERTIDO", "AGENDADO", "V1_EM_DESENVOLVIMENTO", "V1_PUBLICADA",
  "EM_REVISAO_CLIENTE", "ALTERACOES_RECEBIDAS", "V2_EM_DESENVOLVIMENTO",
  "V2_PUBLICADA", "V3_GO_LIVE", "CONCLUIDO", "ARQUIVADO",
]);

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
  const invalidFields: string[] = [];
  if (typeof body.projectId !== "string" || !UUID.test(body.projectId)) invalidFields.push("projectId");
  if (typeof body.target !== "string" || !PROJECT_STATUSES.has(body.target)) invalidFields.push("target");
  if (typeof body.requestId !== "string" || !body.requestId.trim() || body.requestId.length > 200) invalidFields.push("requestId");
  if (invalidFields.length) return json(request, 422, { error_code: "INVALID_REQUEST", invalidFields });

  const { data, error } = await admin.rpc("transition_project_status", {
    p_project_id: body.projectId,
    p_target: body.target,
    p_request_id: body.requestId,
  });

  if (error) {
    const message = error.message || "";
    log("warn", "project_status_transition_failed", { projectId: body.projectId, code: error.code || "RPC" });
    if (message.includes("PROJECT_TRANSITION_NOT_ALLOWED") || message.includes("REQUEST_ID_CONFLICT")) {
      return json(request, 409, { error_code: message.includes("REQUEST_ID_CONFLICT") ? "REQUEST_ID_CONFLICT" : "PROJECT_TRANSITION_NOT_ALLOWED" });
    }
    if (message.includes("PROJECT_NOT_FOUND")) return json(request, 404, { error_code: "PROJECT_NOT_FOUND" });
    return json(request, 500, { error_code: "TRANSITION_FAILED" });
  }

  log("info", "project_status_transitioned", { projectId: body.projectId, target: body.target });
  const row = Array.isArray(data) ? data[0] : data;
  return json(request, 200, {
    projectId: row?.id,
    leadStatus: row?.lead_status,
    projectStatus: row?.project_status,
    accessStatus: row?.access_status,
  });
});
