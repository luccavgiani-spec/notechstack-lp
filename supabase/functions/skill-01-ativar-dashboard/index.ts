import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handlePreflight } from "../_shared/cors.ts";
import { log } from "../_shared/logger.ts";
import { validateRoadmapContent } from "../_shared/roadmap-content.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(request: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request.headers.get("origin")),
      "Content-Type": "application/json",
    },
  });
}

function bearer(request: Request): string {
  const authorization = request.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

async function findUserByEmail(
  admin: ReturnType<typeof createClient>,
  email: string,
): Promise<User | null> {
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 1000) return null;
  }
  throw new Error("AUTH_USER_SCAN_LIMIT");
}

Deno.serve(async (request) => {
  const preflight = handlePreflight(request);
  if (preflight) return preflight;
  if (request.method !== "POST") return json(request, 405, { error_code: "METHOD_NOT_ALLOWED" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const appUrl = (Deno.env.get("APP_URL") || "").replace(/\/$/, "");
  if (!supabaseUrl || !serviceKey || !appUrl) {
    return json(request, 500, { error_code: "SERVER_CONFIG_MISSING" });
  }

  const accessToken = bearer(request);
  if (!accessToken) return json(request, 401, { error_code: "UNAUTHENTICATED" });

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerData, error: callerError } = await admin.auth.getUser(accessToken);
  if (callerError || !callerData.user) {
    return json(request, 401, { error_code: "UNAUTHENTICATED" });
  }
  if (callerData.user.app_metadata.role !== "NO_ADMIN") {
    return json(request, 403, { error_code: "FORBIDDEN" });
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const validation = validateRoadmapContent(body.content);
  if (!UUID.test(projectId)) {
    return json(request, 422, { error_code: "INVALID_REQUEST", invalidFields: ["projectId"] });
  }
  if (!validation.valid) {
    return json(request, 422, {
      error_code: "INVALID_ROADMAP_CONTENT",
      invalidFields: validation.invalidFields,
    });
  }

  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("id,client_id,clients!inner(email)")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) {
    log("error", "skill_01_project_lookup_failed", { projectId, code: projectError.code });
    return json(request, 500, { error_code: "PROJECT_LOOKUP_FAILED" });
  }
  if (!project) return json(request, 404, { error_code: "PROJECT_NOT_FOUND" });

  const relatedClient = Array.isArray(project.clients) ? project.clients[0] : project.clients;
  const email = relatedClient && typeof relatedClient === "object" && "email" in relatedClient
    ? String(relatedClient.email || "").trim().toLowerCase()
    : "";
  if (!email) {
    return json(request, 422, { error_code: "CLIENT_EMAIL_MISSING", invalidFields: ["clients.email"] });
  }

  let existingUser: User | null;
  try {
    existingUser = await findUserByEmail(admin, email);
  } catch (error) {
    log("error", "skill_01_auth_lookup_failed", { projectId, code: String((error as Error).message || "AUTH") });
    return json(request, 502, { error_code: "AUTH_UNAVAILABLE" });
  }

  const redirectTo = `${appUrl}/acesso?projectId=${encodeURIComponent(projectId)}`;
  const generated = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo },
  });
  if (generated.error || !generated.data.properties?.action_link || !generated.data.user) {
    log("error", "skill_01_invite_failed", { projectId, code: generated.error?.code || "NO_LINK" });
    return json(request, 502, { error_code: "AUTH_UNAVAILABLE" });
  }

  const createdUser = existingUser === null;
  const userId = generated.data.user.id;
  const currentRole = generated.data.user.app_metadata.role;
  if (currentRole && currentRole !== "CLIENT") {
    if (createdUser) await admin.auth.admin.deleteUser(userId);
    log("warn", "skill_01_auth_role_conflict", { projectId, code: "AUTH_ROLE_CONFLICT" });
    return json(request, 409, { error_code: "AUTH_ROLE_CONFLICT" });
  }

  if (currentRole !== "CLIENT") {
    const roleUpdate = await admin.auth.admin.updateUserById(userId, {
      app_metadata: { ...generated.data.user.app_metadata, role: "CLIENT" },
    });
    if (roleUpdate.error) {
      if (createdUser) await admin.auth.admin.deleteUser(userId);
      log("error", "skill_01_auth_role_failed", { projectId, code: roleUpdate.error.code || "AUTH" });
      return json(request, 502, { error_code: "AUTH_UNAVAILABLE" });
    }
  }

  const activation = await admin.rpc("activate_dashboard", {
    p_project_id: projectId,
    p_user_id: userId,
    p_actor_id: callerData.user.id,
    p_content: validation.content,
    p_request_id: `skill-01:${projectId}`,
  });

  if (activation.error || !activation.data?.[0]) {
    if (createdUser) {
      const compensation = await admin.auth.admin.deleteUser(userId);
      if (compensation.error) {
        log("error", "skill_01_compensation_failed", { projectId, code: compensation.error.code });
      }
    }
    const message = activation.error?.message || "";
    const stateRejected = message.startsWith("PROJECT_STATE_NOT_ALLOWED:");
    log("warn", "skill_01_activation_failed", {
      projectId,
      code: stateRejected ? "PROJECT_STATE_NOT_ALLOWED" : activation.error?.code || "RPC",
    });
    return json(request, stateRejected ? 409 : 500, {
      error_code: stateRejected ? "PROJECT_STATE_NOT_ALLOWED" : "ACTIVATION_FAILED",
      ...(stateRejected ? { currentState: message.split(":")[1] } : {}),
    });
  }

  log("info", "skill_01_dashboard_activated", { projectId, reusedUser: !createdUser });
  return json(request, 200, {
    inviteLink: generated.data.properties.action_link,
    projectId,
    accessReleasedAt: activation.data[0].access_released_at,
  });
});
