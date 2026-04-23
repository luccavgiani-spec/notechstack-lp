// sync-meta-organic
//
// Insights orgânicos diários de IG Business e FB Pages dos últimos 7 dias.
// Grava 1 linha por (account, dia) em social_metrics_daily.
//
// verify_jwt: true (ver config.toml).

import { corsHeaders, handlePreflight } from "../_shared/cors.ts";
import { log } from "../_shared/logger.ts";
import { MetaApiError, extractMetaError, metaFetch } from "../_shared/meta.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";

interface AdAccountRow {
  id: string;
  client_id: string;
  platform: "meta_page" | "meta_instagram";
  external_id: string;
  access_token: string;
}

interface InsightValueDay {
  value: number | Record<string, number>;
  end_time: string;
}

interface InsightMetric {
  name: string;
  period: string;
  values: InsightValueDay[];
}

interface InsightsResponse {
  data: InsightMetric[];
}

const SEVEN_DAYS_SEC = 7 * 24 * 60 * 60;

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
    } catch (_) { /* body opcional */ }
  }

  const supabase = supabaseAdmin();
  let query = supabase
    .from("ad_accounts")
    .select("id, client_id, platform, external_id, access_token")
    .in("platform", ["meta_page", "meta_instagram"])
    .eq("status", "active");
  if (requestedAccountId) query = query.eq("id", requestedAccountId);

  const { data: accounts, error: accErr } = await query;
  if (accErr) {
    log("error", "sync_organic_account_fetch_failed", { error: accErr.message });
    return json(500, { error: accErr.message }, origin);
  }

  const now = Math.floor(Date.now() / 1000);
  const since = now - SEVEN_DAYS_SEC;

  const results: Array<{ account_id: string; status: string; records: number; error?: string }> = [];

  for (const acc of (accounts ?? []) as AdAccountRow[]) {
    const acctStartedAt = Date.now();
    let records = 0;
    try {
      const byDate: Map<string, Record<string, number>> = new Map();
      if (acc.platform === "meta_instagram") {
        await fetchIgInsights(acc, since, now, byDate);
      } else {
        await fetchPageInsights(acc, since, now, byDate);
      }

      // followers_gained/lost: calcula via diff de follower_count quando
      // a métrica explícita não vem da Meta.
      await fillFollowerDeltas(supabase, acc, byDate);

      for (const [date, metrics] of byDate.entries()) {
        const row = buildSocialRow(acc, date, metrics);
        const { error: upsertErr } = await supabase
          .from("social_metrics_daily")
          .upsert(row, { onConflict: "account_id,date" });
        if (upsertErr) throw new Error(`Upsert failed: ${upsertErr.message}`);
        records++;
      }

      await supabase
        .from("ad_accounts")
        .update({ last_synced_at: new Date().toISOString(), last_error: null })
        .eq("id", acc.id);

      await supabase.from("sync_logs").insert({
        job_name: "sync-meta-organic",
        account_id: acc.id,
        status: "success",
        records_processed: records,
        duration_ms: Date.now() - acctStartedAt,
      });

      log("info", "sync_organic_ok", { account_id: acc.id, platform: acc.platform, records });
      results.push({ account_id: acc.id, status: "success", records });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const metaErr = err instanceof MetaApiError ? extractMetaError(err.body) : null;
      const combined = `${message}${metaErr ? ` | ${metaErr}` : ""}`.slice(0, 2000);
      const newStatus = isTokenError(err) ? "expired" : "error";

      await supabase
        .from("ad_accounts")
        .update({ status: newStatus, last_error: combined })
        .eq("id", acc.id);

      await supabase.from("sync_logs").insert({
        job_name: "sync-meta-organic",
        account_id: acc.id,
        status: "error",
        records_processed: records,
        error_message: combined,
        duration_ms: Date.now() - acctStartedAt,
      });

      log("error", "sync_organic_failed", {
        account_id: acc.id,
        platform: acc.platform,
        error: message,
        meta_error: metaErr,
      });
      results.push({ account_id: acc.id, status: "error", records, error: combined });
    }
  }

  log("info", "sync_organic_batch_done", {
    accounts: results.length,
    duration_ms: Date.now() - startedAt,
  });
  return json(200, { results }, origin);
});

// --- Instagram Business ---------------------------------------------------

async function fetchIgInsights(
  acc: AdAccountRow,
  since: number,
  until: number,
  byDate: Map<string, Record<string, number>>,
): Promise<void> {
  // Métricas diárias básicas
  const daily = await metaFetch<InsightsResponse>(`/${acc.external_id}/insights`, {
    metric: "reach,impressions,profile_views,follower_count",
    period: "day",
    since: String(since),
    until: String(until),
    access_token: acc.access_token,
  });
  mergeMetrics(byDate, daily.data);

  // Métrica de ganhos/perdas explícitos (se disponível; falha silenciosa)
  try {
    const delta = await metaFetch<InsightsResponse>(`/${acc.external_id}/insights`, {
      metric: "follows_and_unfollows",
      period: "day",
      metric_type: "total_value",
      since: String(since),
      until: String(until),
      access_token: acc.access_token,
    });
    mergeMetrics(byDate, delta.data);
  } catch (err) {
    log("warn", "sync_organic_follows_unfollows_unavailable", {
      account_id: acc.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Engagement rate: posts dos últimos 7d → somatório de
  // (likes + comments + shares + saved) / reach
  try {
    const mediaResp = await metaFetch<{ data: Array<{ id: string; timestamp?: string }> }>(
      `/${acc.external_id}/media`,
      {
        fields: "id,timestamp",
        since: String(since),
        until: String(until),
        limit: "50",
        access_token: acc.access_token,
      },
    );
    const media = mediaResp.data ?? [];
    const postsPublishedByDate = new Map<string, number>();
    let totalEngagement = 0;
    let totalReach = 0;
    for (const m of media) {
      if (m.timestamp) {
        const d = m.timestamp.slice(0, 10);
        postsPublishedByDate.set(d, (postsPublishedByDate.get(d) ?? 0) + 1);
      }
      try {
        const mi = await metaFetch<InsightsResponse>(`/${m.id}/insights`, {
          metric: "reach,likes,comments,shares,saved",
          access_token: acc.access_token,
        });
        const v = flattenLifetimeMetrics(mi.data);
        totalEngagement += (v.likes ?? 0) + (v.comments ?? 0) + (v.shares ?? 0) + (v.saved ?? 0);
        totalReach += v.reach ?? 0;
      } catch (_) { /* ignora post específico */ }
    }

    // Distribui engagement_rate igual pra cada dia da janela
    if (totalReach > 0) {
      const rate = totalEngagement / totalReach;
      for (const metrics of byDate.values()) metrics.engagement_rate = rate;
    }
    for (const [d, count] of postsPublishedByDate) {
      const m = byDate.get(d) ?? {};
      m.posts_published = count;
      byDate.set(d, m);
    }
  } catch (err) {
    log("warn", "sync_organic_engagement_unavailable", {
      account_id: acc.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// --- FB Page --------------------------------------------------------------

async function fetchPageInsights(
  acc: AdAccountRow,
  since: number,
  until: number,
  byDate: Map<string, Record<string, number>>,
): Promise<void> {
  const resp = await metaFetch<InsightsResponse>(`/${acc.external_id}/insights`, {
    metric: "page_fans,page_fan_adds,page_fan_removes,page_impressions,page_engaged_users",
    period: "day",
    since: String(since),
    until: String(until),
    access_token: acc.access_token,
  });
  // Remapeia nomes FB → nomes unificados que salvamos no banco
  for (const m of resp.data ?? []) {
    const unified = mapPageMetricName(m.name);
    if (!unified) continue;
    for (const v of m.values ?? []) {
      const date = v.end_time.slice(0, 10);
      const slot = byDate.get(date) ?? {};
      slot[unified] = typeof v.value === "number" ? v.value : Number(v.value) || 0;
      byDate.set(date, slot);
    }
  }

  // Engagement rate via page_engaged_users / page_impressions quando ambos existirem
  for (const [date, m] of byDate) {
    if (m.impressions && m.impressions > 0 && m.engaged_users != null) {
      m.engagement_rate = m.engaged_users / m.impressions;
    }
    byDate.set(date, m);
  }
}

function mapPageMetricName(name: string): string | null {
  switch (name) {
    case "page_fans": return "followers_count";
    case "page_fan_adds": return "followers_gained";
    case "page_fan_removes": return "followers_lost";
    case "page_impressions": return "impressions";
    case "page_engaged_users": return "engaged_users";
    default: return null;
  }
}

// --- Helpers --------------------------------------------------------------

function mergeMetrics(
  byDate: Map<string, Record<string, number>>,
  data: InsightMetric[] | undefined,
): void {
  for (const m of data ?? []) {
    for (const v of m.values ?? []) {
      const date = v.end_time.slice(0, 10);
      const slot = byDate.get(date) ?? {};
      if (typeof v.value === "number") {
        slot[m.name] = v.value;
      } else if (v.value && typeof v.value === "object") {
        // follows_and_unfollows: { follows: N, unfollows: M }
        if ("follows" in v.value) slot.followers_gained = v.value.follows as number;
        if ("unfollows" in v.value) slot.followers_lost = v.value.unfollows as number;
      }
      byDate.set(date, slot);
    }
  }
}

function flattenLifetimeMetrics(data: InsightMetric[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of data ?? []) {
    const v = m.values?.[0]?.value;
    if (typeof v === "number") out[m.name] = v;
  }
  return out;
}

async function fillFollowerDeltas(
  supabase: ReturnType<typeof supabaseAdmin>,
  acc: AdAccountRow,
  byDate: Map<string, Record<string, number>>,
): Promise<void> {
  const dates = [...byDate.keys()].sort();
  if (dates.length === 0) return;

  const earliest = dates[0];
  // Carrega a linha imediatamente anterior à janela (p/ calcular delta do 1º dia)
  const { data: prior } = await supabase
    .from("social_metrics_daily")
    .select("date, followers_count")
    .eq("account_id", acc.id)
    .lt("date", earliest)
    .order("date", { ascending: false })
    .limit(1);
  let prevCount: number | null = prior?.[0]?.followers_count ?? null;

  for (const d of dates) {
    const m = byDate.get(d)!;
    if (m.followers_count != null && prevCount != null) {
      const diff = m.followers_count - prevCount;
      if (m.followers_gained == null && diff > 0) m.followers_gained = diff;
      if (m.followers_lost == null && diff < 0) m.followers_lost = -diff;
    }
    if (m.followers_count != null) prevCount = m.followers_count;
    byDate.set(d, m);
  }
}

function buildSocialRow(
  acc: AdAccountRow,
  date: string,
  m: Record<string, number>,
): Record<string, unknown> {
  return {
    account_id: acc.id,
    client_id: acc.client_id,
    date,
    followers_count: m.followers_count ?? null,
    followers_gained: m.followers_gained ?? null,
    followers_lost: m.followers_lost ?? null,
    reach: m.reach ?? null,
    impressions: m.impressions ?? null,
    profile_views: m.profile_views ?? null,
    engagement_rate: m.engagement_rate != null ? round(m.engagement_rate, 4) : null,
    posts_published: m.posts_published ?? 0,
    raw_insights: m,
  };
}

function round(n: number, digits: number): number {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

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
