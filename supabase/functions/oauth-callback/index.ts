// oauth-callback
//
// Meta redireciona o browser pra cá após o usuário autorizar o app da nó.
// Trocamos o `code` por um long-lived user token, descobrimos Ad Accounts +
// Pages + IG Business accounts, salvamos tudo em `ad_accounts` e
// redirecionamos de volta pro hub do cliente.
//
// verify_jwt: false (ver config.toml) — chamada vem do browser, sem JWT.

import { handlePreflight } from "../_shared/cors.ts";
import { log } from "../_shared/logger.ts";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  expiresAtFromExpiresIn,
  extractMetaError,
  metaFetch,
} from "../_shared/meta.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

const REDIRECT_URI =
  "https://sdeowbqmwkwseyktyemn.supabase.co/functions/v1/oauth-callback";
const HUB_DOMAIN = "notechstack.com.br";
const REQUIRED_SCOPES = [
  "ads_read",
  "ads_management",
  "business_management",
  "pages_show_list",
  "pages_read_engagement",
  "instagram_basic",
  "instagram_manage_insights",
  "instagram_content_publish",
  "instagram_manage_comments",
  "public_profile",
  "email",
];

interface AdAccountNode {
  id: string;
  name?: string;
  account_status?: number;
  currency?: string;
}

interface PageNode {
  id: string;
  name?: string;
  access_token: string;
  instagram_business_account?: {
    id: string;
    username?: string;
    name?: string;
  };
}

interface ListResponse<T> {
  data: T[];
  paging?: { next?: string };
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");
  const errorReason = url.searchParams.get("error_reason");
  const errorDescription = url.searchParams.get("error_description");

  // Usuário cancelou ou Meta devolveu erro
  if (errorParam) {
    log("warn", "oauth_user_denied", { errorParam, errorReason, errorDescription });
    return redirectToHub(null, {
      oauth: "error",
      msg: errorDescription ?? errorReason ?? errorParam,
    });
  }

  if (!code || !state) {
    log("error", "oauth_missing_params", { hasCode: !!code, hasState: !!state });
    return plain(400, "Missing `code` or `state` query param");
  }

  const appSecret = Deno.env.get("META_APP_SECRET");
  if (!appSecret) {
    log("error", "oauth_missing_app_secret");
    return plain(500, "Server misconfigured: META_APP_SECRET not set");
  }

  const supabase = supabaseAdmin();

  // 1. Valida client_id (vem no state como UUID puro)
  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("id, slug, name")
    .eq("id", state)
    .maybeSingle();

  if (clientErr) {
    log("error", "oauth_client_lookup_failed", { error: clientErr.message, state });
    return plain(500, "Client lookup failed");
  }
  if (!client) {
    log("warn", "oauth_unknown_client", { state });
    return plain(400, "Unknown client in state param");
  }

  const startedAt = Date.now();
  let accountsUpserted = 0;

  try {
    // 2. code → short-lived token
    const short = await exchangeCodeForToken({
      code,
      redirectUri: REDIRECT_URI,
      appSecret,
    });

    // 3. short-lived → long-lived (60d)
    const long = await exchangeForLongLivedToken({
      shortLivedToken: short.access_token,
      appSecret,
    });

    const longToken = long.access_token;
    const longExpiresAt = expiresAtFromExpiresIn(long.expires_in);

    // 4. Descobre Ad Accounts do usuário
    const adAccounts = await metaFetch<ListResponse<AdAccountNode>>(
      "/me/adaccounts",
      {
        fields: "id,name,account_status,currency",
        access_token: longToken,
      },
    );

    for (const acc of adAccounts.data ?? []) {
      await upsertAccount(client.id, {
        platform: "meta_ads",
        external_id: acc.id,
        external_name: acc.name ?? null,
        access_token: longToken,
        token_expires_at: longExpiresAt,
      });
      accountsUpserted++;
    }

    // 5. Descobre Pages + IG Business accounts
    const pages = await metaFetch<ListResponse<PageNode>>("/me/accounts", {
      fields: "id,name,access_token,instagram_business_account{id,username,name}",
      access_token: longToken,
    });

    for (const page of pages.data ?? []) {
      // Page access token derivado de long-lived user token não expira
      // (Meta docs: "Page access tokens inherit the expiration of the
      // user access token they were generated from"; com long-lived user,
      // o Page token fica sem expiração).
      await upsertAccount(client.id, {
        platform: "meta_page",
        external_id: page.id,
        external_name: page.name ?? null,
        access_token: page.access_token,
        token_expires_at: null,
      });
      accountsUpserted++;

      if (page.instagram_business_account?.id) {
        const ig = page.instagram_business_account;
        const igName = ig.username ? `@${ig.username}` : (ig.name ?? null);
        await upsertAccount(client.id, {
          platform: "meta_instagram",
          external_id: ig.id,
          external_name: igName,
          // IG Business é acessado via Page token
          access_token: page.access_token,
          token_expires_at: null,
        });
        accountsUpserted++;
      }
    }

    await supabase.from("sync_logs").insert({
      job_name: "oauth-callback",
      status: "success",
      records_processed: accountsUpserted,
      duration_ms: Date.now() - startedAt,
    });

    log("info", "oauth_success", {
      client_id: client.id,
      slug: client.slug,
      accounts: accountsUpserted,
    });

    return redirectToHub(client.slug, { oauth: "success" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const extra = err && typeof err === "object" && "body" in err
      ? extractMetaError((err as { body: unknown }).body)
      : null;
    log("error", "oauth_failure", {
      client_id: client.id,
      error: message,
      meta_error: extra,
    });

    await supabase.from("sync_logs").insert({
      job_name: "oauth-callback",
      status: "error",
      records_processed: accountsUpserted,
      error_message: `${message}${extra ? ` | ${extra}` : ""}`.slice(0, 2000),
      duration_ms: Date.now() - startedAt,
    });

    return redirectToHub(client.slug, {
      oauth: "error",
      msg: (extra ?? message).slice(0, 200),
    });
  }
});

// Upsert por (client_id, platform, external_id). Mantém a linha 'active'
// e limpa last_error em conexões novas/renovadas.
async function upsertAccount(clientId: string, account: {
  platform: "meta_ads" | "meta_page" | "meta_instagram";
  external_id: string;
  external_name: string | null;
  access_token: string;
  token_expires_at: string | null;
}): Promise<void> {
  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("ad_accounts")
    .upsert(
      {
        client_id: clientId,
        platform: account.platform,
        external_id: account.external_id,
        external_name: account.external_name,
        access_token: account.access_token,
        token_expires_at: account.token_expires_at,
        scopes: REQUIRED_SCOPES,
        status: "active",
        last_error: null,
      },
      { onConflict: "client_id,platform,external_id" },
    );
  if (error) {
    throw new Error(`Upsert ad_accounts failed: ${error.message}`);
  }
}

function redirectToHub(
  slug: string | null,
  params: Record<string, string>,
): Response {
  const host = slug ? `${slug}.${HUB_DOMAIN}` : HUB_DOMAIN;
  const target = new URL(`https://${host}/`);
  for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v);
  return new Response(null, {
    status: 302,
    headers: { location: target.toString() },
  });
}

function plain(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
