// sync-meta-ads
//
// Busca insights diários das campanhas (last_7d) pra cada ad_account ativa
// e faz upsert em ad_metrics_daily. Chamada pelo Vercel Cron 1x/dia, ou
// ad-hoc via `{ "account_id": "uuid" }` no body.
//
// verify_jwt: true (ver config.toml) — só service_role chega aqui.

import { handlePreflight, corsHeaders } from "../_shared/cors.ts";
import { log } from "../_shared/logger.ts";
import { MetaApiError, extractMetaError, metaFetch } from "../_shared/meta.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

interface AdAccountRow {
  id: string;
  client_id: string;
  external_id: string;
  external_name: string | null;
  access_token: string;
}

interface InsightsRow {
  date_start: string;
  date_stop: string;
  campaign_id: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
  cost_per_action_type?: Array<{ action_type: string; value: string }>;
}

interface CampaignRow {
  id: string;
  status?: string;
  objective?: string;
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get("origin");
  const startedAt = Date.now();

  let requestedAccountId: string | null = null;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (body && typeof body.account_id === "string") {
        requestedAccountId = body.account_id;
      }
    } catch (_) {
      // body opcional; sem body = sync de todas
    }
  }

  const supabase = supabaseAdmin();
  let query = supabase
    .from("ad_accounts")
    .select("id, client_id, external_id, external_name, access_token")
    .eq("platform", "meta_ads")
    .eq("status", "active");
  if (requestedAccountId) query = query.eq("id", requestedAccountId);

  const { data: accounts, error: accErr } = await query;
  if (accErr) {
    log("error", "sync_ads_account_fetch_failed", { error: accErr.message });
    return json(500, { error: accErr.message }, origin);
  }

  const results: Array<{ account_id: string; status: string; records: number; error?: string }> = [];

  for (const acc of (accounts ?? []) as AdAccountRow[]) {
    const acctStartedAt = Date.now();
    let records = 0;
    try {
      // Mapa campaign_id → status/objective (opcional; falha silenciosa)
      const campaignMeta = await fetchCampaignMeta(acc);

      const insights = await fetchInsights(acc);
      for (const row of insights) {
        const parsed = parseInsightsRow(row, campaignMeta);
        const { error: upsertErr } = await supabase
          .from("ad_metrics_daily")
          .upsert(
            {
              account_id: acc.id,
              client_id: acc.client_id,
              date: parsed.date,
              campaign_id: parsed.campaign_id,
              campaign_name: parsed.campaign_name,
              campaign_status: parsed.campaign_status,
              objective: parsed.objective,
              spend: parsed.spend,
              impressions: parsed.impressions,
              clicks: parsed.clicks,
              conversions: parsed.conversions,
              revenue: parsed.revenue,
              ctr: parsed.ctr,
              cpa: parsed.cpa,
              roas: parsed.roas,
              raw_insights: row,
            },
            { onConflict: "account_id,date,campaign_id" },
          );
        if (upsertErr) throw new Error(`Upsert failed: ${upsertErr.message}`);
        records++;
      }

      await supabase
        .from("ad_accounts")
        .update({ last_synced_at: new Date().toISOString(), last_error: null })
        .eq("id", acc.id);

      await supabase.from("sync_logs").insert({
        job_name: "sync-meta-ads",
        account_id: acc.id,
        status: "success",
        records_processed: records,
        duration_ms: Date.now() - acctStartedAt,
      });

      log("info", "sync_ads_ok", { account_id: acc.id, records });
      results.push({ account_id: acc.id, status: "success", records });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const metaErr = err instanceof MetaApiError ? extractMetaError(err.body) : null;
      const combined = `${message}${metaErr ? ` | ${metaErr}` : ""}`.slice(0, 2000);

      // Token problems → marca conta pra reautorização
      const newStatus = isTokenError(err) ? "expired" : "error";
      await supabase
        .from("ad_accounts")
        .update({ status: newStatus, last_error: combined })
        .eq("id", acc.id);

      await supabase.from("sync_logs").insert({
        job_name: "sync-meta-ads",
        account_id: acc.id,
        status: "error",
        records_processed: records,
        error_message: combined,
        duration_ms: Date.now() - acctStartedAt,
      });

      log("error", "sync_ads_failed", {
        account_id: acc.id,
        error: message,
        meta_error: metaErr,
      });
      results.push({ account_id: acc.id, status: "error", records, error: combined });
    }
  }

  log("info", "sync_ads_batch_done", {
    accounts: results.length,
    duration_ms: Date.now() - startedAt,
  });
  return json(200, { results }, origin);
});

async function fetchInsights(acc: AdAccountRow): Promise<InsightsRow[]> {
  const all: InsightsRow[] = [];
  let nextUrl: string | null = null;
  const firstCall = async () =>
    await metaFetch<{ data: InsightsRow[]; paging?: { next?: string } }>(
      `/${acc.external_id}/insights`,
      {
        level: "campaign",
        fields:
          "campaign_id,campaign_name,spend,impressions,clicks,ctr,actions,action_values,cost_per_action_type",
        time_increment: "1",
        date_preset: "last_7d",
        access_token: acc.access_token,
      },
    );

  let page = await firstCall();
  all.push(...(page.data ?? []));
  nextUrl = page.paging?.next ?? null;
  while (nextUrl) {
    page = await metaFetch<{ data: InsightsRow[]; paging?: { next?: string } }>(nextUrl, {});
    all.push(...(page.data ?? []));
    nextUrl = page.paging?.next ?? null;
  }
  return all;
}

async function fetchCampaignMeta(acc: AdAccountRow): Promise<Map<string, CampaignRow>> {
  const map = new Map<string, CampaignRow>();
  try {
    const resp = await metaFetch<{ data: CampaignRow[]; paging?: { next?: string } }>(
      `/${acc.external_id}/campaigns`,
      {
        fields: "id,status,objective",
        limit: "500",
        access_token: acc.access_token,
      },
    );
    for (const c of resp.data ?? []) map.set(c.id, c);
  } catch (err) {
    log("warn", "sync_ads_campaign_meta_failed", {
      account_id: acc.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return map;
}

function parseInsightsRow(row: InsightsRow, campaignMeta: Map<string, CampaignRow>) {
  const spend = num(row.spend);
  const impressions = int(row.impressions);
  const clicks = int(row.clicks);
  const ctr = num(row.ctr);

  // Conversions: preferência offsite_conversion.fb_pixel_purchase → purchase → omni_purchase
  const convKeys = [
    "offsite_conversion.fb_pixel_purchase",
    "purchase",
    "omni_purchase",
  ];
  let conversions = 0;
  for (const key of convKeys) {
    const match = row.actions?.find((a) => a.action_type === key);
    if (match) {
      conversions = int(match.value);
      break;
    }
  }

  // Revenue: mesma ordem de preferência em action_values
  let revenue = 0;
  for (const key of convKeys) {
    const match = row.action_values?.find((a) => a.action_type === key);
    if (match) {
      revenue = num(match.value);
      break;
    }
  }

  const roas = spend > 0 ? revenue / spend : null;
  const cpa = conversions > 0 ? spend / conversions : null;

  const meta = campaignMeta.get(row.campaign_id);

  return {
    date: row.date_start,
    campaign_id: row.campaign_id,
    campaign_name: row.campaign_name ?? null,
    campaign_status: meta?.status ?? null,
    objective: meta?.objective ?? null,
    spend,
    impressions,
    clicks,
    conversions,
    revenue,
    ctr: Number.isFinite(ctr) ? round(ctr, 4) : null,
    cpa: cpa !== null ? round(cpa, 2) : null,
    roas: roas !== null ? round(roas, 4) : null,
  };
}

function num(v: string | undefined): number {
  if (!v) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function int(v: string | undefined): number {
  if (!v) return 0;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}
function round(n: number, digits: number): number {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

// Códigos Meta: 190 = invalid/expired token, OAuthException com subcode 463/467
function isTokenError(err: unknown): boolean {
  if (!(err instanceof MetaApiError)) return false;
  const body = err.body as { error?: { code?: number; type?: string } } | undefined;
  if (!body?.error) return false;
  if (body.error.code === 190) return true;
  if (body.error.type === "OAuthException") return true;
  return false;
}

function json(status: number, body: unknown, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...corsHeaders(origin),
    },
  });
}
