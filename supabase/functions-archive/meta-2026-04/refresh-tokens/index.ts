// refresh-tokens
//
// Cron diário. Tenta estender long-lived user tokens que expiram em <7d via
// grant_type=fb_exchange_token (Meta permite renovar um long-lived ativo por
// mais 60 dias). Se falhar, marca a conta como 'expired' pra reautorização.
//
// Page tokens (platform in ('meta_page', 'meta_instagram')) herdam do user
// token e não expiram, então são ignorados aqui — sua renovação vem do
// próximo OAuth completo quando o user token morre.
//
// verify_jwt: true.

import { corsHeaders, handlePreflight } from "../_shared/cors.ts";
import { log } from "../_shared/logger.ts";
import {
  MetaApiError,
  exchangeForLongLivedToken,
  expiresAtFromExpiresIn,
  extractMetaError,
} from "../_shared/meta.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

interface AdAccountRow {
  id: string;
  client_id: string;
  platform: "meta_ads" | "meta_page" | "meta_instagram";
  external_id: string;
  access_token: string;
  token_expires_at: string | null;
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get("origin");
  const appSecret = Deno.env.get("META_APP_SECRET");
  if (!appSecret) {
    log("error", "refresh_missing_app_secret");
    return json(500, { error: "META_APP_SECRET not configured" }, origin);
  }

  const startedAt = Date.now();
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const supabase = supabaseAdmin();
  const { data: accounts, error: fetchErr } = await supabase
    .from("ad_accounts")
    .select("id, client_id, platform, external_id, access_token, token_expires_at")
    .eq("status", "active")
    .eq("platform", "meta_ads")
    .not("token_expires_at", "is", null)
    .lt("token_expires_at", sevenDaysFromNow);

  if (fetchErr) {
    log("error", "refresh_fetch_failed", { error: fetchErr.message });
    return json(500, { error: fetchErr.message }, origin);
  }

  const results: Array<{ account_id: string; status: string; error?: string }> = [];

  for (const acc of (accounts ?? []) as AdAccountRow[]) {
    try {
      const refreshed = await exchangeForLongLivedToken({
        shortLivedToken: acc.access_token,
        appSecret,
      });

      const newExpires = expiresAtFromExpiresIn(refreshed.expires_in);
      await supabase
        .from("ad_accounts")
        .update({
          access_token: refreshed.access_token,
          token_expires_at: newExpires,
          last_error: null,
        })
        .eq("id", acc.id);

      await supabase.from("sync_logs").insert({
        job_name: "refresh-tokens",
        account_id: acc.id,
        status: "success",
        records_processed: 1,
      });

      log("info", "refresh_ok", { account_id: acc.id, expires_at: newExpires });
      results.push({ account_id: acc.id, status: "refreshed" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const metaErr = err instanceof MetaApiError ? extractMetaError(err.body) : null;
      const combined = `${message}${metaErr ? ` | ${metaErr}` : ""}`.slice(0, 2000);

      await supabase
        .from("ad_accounts")
        .update({ status: "expired", last_error: combined })
        .eq("id", acc.id);

      await supabase.from("sync_logs").insert({
        job_name: "refresh-tokens",
        account_id: acc.id,
        status: "error",
        error_message: combined,
      });

      log("error", "refresh_failed", {
        account_id: acc.id,
        error: message,
        meta_error: metaErr,
      });
      results.push({ account_id: acc.id, status: "expired", error: combined });

      // TODO(fase-2): notificar cliente por email pra reautorizar o app.
    }
  }

  log("info", "refresh_done", {
    checked: results.length,
    duration_ms: Date.now() - startedAt,
  });
  return json(200, { results }, origin);
});

function json(status: number, body: unknown, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...corsHeaders(origin),
    },
  });
}
