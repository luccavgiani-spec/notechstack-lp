import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handlePreflight } from "../_shared/cors.ts";
import { log } from "../_shared/logger.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MACROS = new Set(["V1", "V2", "V3"]);
const LABEL = /^V[123](?:\.[1-9][0-9]*)?$/;

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
  if (caller.data.user.app_metadata?.role !== "NO_ADMIN") return json(request, 403, { error_code: "FORBIDDEN" });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const macro = typeof body.macro === "string" ? body.macro.trim() : "";
  const changelog = typeof body.changelog === "string" ? body.changelog.trim() : "";
  const buildReference = typeof body.buildReference === "string" ? body.buildReference.trim() : "";
  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  const invalidFields: string[] = [];
  if (!UUID.test(projectId)) invalidFields.push("projectId");
  if (!label || label.length > 100 || !LABEL.test(label)) invalidFields.push("label");
  if (!MACROS.has(macro)) invalidFields.push("macro");
  if (!changelog || changelog.length > 10000) invalidFields.push("changelog");
  if (!buildReference || buildReference.length > 2000) invalidFields.push("buildReference");
  if (!requestId || requestId.length > 200) invalidFields.push("requestId");
  if (invalidFields.length) return json(request, 422, { error_code: "INVALID_REQUEST", invalidFields });

  const { data, error } = await admin.rpc("publish_project_version", {
    p_project_id: projectId,
    p_label: label,
    p_macro: macro,
    p_changelog: changelog,
    p_build_reference: buildReference,
    p_request_id: requestId,
  });

  if (error) {
    const message = error.message || "";
    const code = message.includes("REQUEST_ID_CONFLICT")
      ? "REQUEST_ID_CONFLICT"
      : message.includes("PROJECT_NOT_FOUND")
        ? "PROJECT_NOT_FOUND"
        : message.includes("VERSION_STATE_NOT_ALLOWED")
          ? "VERSION_STATE_NOT_ALLOWED"
          : message.includes("VERSION_LABEL_NOT_ALLOWED")
            ? "VERSION_LABEL_NOT_ALLOWED"
            : message.includes("23505") || error.code === "23505"
              ? "VERSION_ALREADY_EXISTS"
              : message.includes("INVALID_VERSION_REQUEST")
                ? "INVALID_VERSION_REQUEST"
                : "VERSION_PUBLICATION_FAILED";
    log("warn", "project_version_publish_failed", { projectId, label, code });
    if (code === "PROJECT_NOT_FOUND") return json(request, 404, { error_code: code });
    if (code === "INVALID_VERSION_REQUEST") return json(request, 422, { error_code: code });
    if (["REQUEST_ID_CONFLICT", "VERSION_STATE_NOT_ALLOWED", "VERSION_LABEL_NOT_ALLOWED", "VERSION_ALREADY_EXISTS"].includes(code)) {
      return json(request, 409, { error_code: code });
    }
    return json(request, 500, { error_code: code });
  }

  const result = Array.isArray(data) ? data[0] : data;
  log("info", "project_version_published", { projectId, label, macro, replayed: Boolean(result?.replayed) });
  return json(request, 200, {
    versionId: result?.versionId,
    projectStatus: result?.projectStatus,
    replayed: Boolean(result?.replayed),
  });
});
