// Cliente mínimo pro Graph API v21.0 com retry exponencial em 429/5xx.
// Meta limita ~200 calls/h por user token; qualquer 429 aqui dispara backoff.

import { log } from "./logger.ts";

export const GRAPH_API_VERSION = "v21.0";
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
export const META_APP_ID = "1590026522084626";

export class MetaApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

interface MetaFetchOptions {
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
  maxRetries?: number;
}

export async function metaFetch<T>(
  path: string,
  params: Record<string, string | undefined>,
  opts: MetaFetchOptions = {},
): Promise<T> {
  const { method = "GET", body, maxRetries = 4 } = opts;
  const url = new URL(path.startsWith("http") ? path : `${GRAPH_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, v);
  }

  let attempt = 0;
  // Backoff: 0.5s, 1s, 2s, 4s
  while (true) {
    const resp = await fetch(url.toString(), {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (resp.ok) {
      return (await resp.json()) as T;
    }

    const text = await resp.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch (_) {
      // payload não-JSON; mantém como string
    }

    const retryable = resp.status === 429 || resp.status >= 500;
    if (!retryable || attempt >= maxRetries) {
      const errMsg = extractMetaError(parsed) ?? `Meta API ${resp.status}`;
      throw new MetaApiError(resp.status, parsed, errMsg);
    }

    const delayMs = 500 * 2 ** attempt;
    log("warn", "meta_retry", {
      url: url.pathname,
      status: resp.status,
      attempt,
      delayMs,
    });
    await sleep(delayMs);
    attempt++;
  }
}

export function extractMetaError(body: unknown): string | null {
  if (body && typeof body === "object" && "error" in body) {
    const err = (body as { error?: { message?: string; type?: string; code?: number } }).error;
    if (err) {
      return `${err.type ?? "MetaError"} ${err.code ?? ""}: ${err.message ?? ""}`.trim();
    }
  }
  return null;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// --- Token helpers -------------------------------------------------------

export interface TokenExchangeResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

export async function exchangeCodeForToken(params: {
  code: string;
  redirectUri: string;
  appSecret: string;
}): Promise<TokenExchangeResponse> {
  return await metaFetch<TokenExchangeResponse>("/oauth/access_token", {
    client_id: META_APP_ID,
    client_secret: params.appSecret,
    redirect_uri: params.redirectUri,
    code: params.code,
  });
}

export async function exchangeForLongLivedToken(params: {
  shortLivedToken: string;
  appSecret: string;
}): Promise<TokenExchangeResponse> {
  return await metaFetch<TokenExchangeResponse>("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: META_APP_ID,
    client_secret: params.appSecret,
    fb_exchange_token: params.shortLivedToken,
  });
}

// expires_in geralmente vem em segundos (~5184000 pra 60d).
// Quando ausente, assumimos 60d como padrão Meta pra long-lived.
export function expiresAtFromExpiresIn(expiresIn?: number): string {
  const seconds = expiresIn && expiresIn > 0 ? expiresIn : 60 * 24 * 60 * 60;
  return new Date(Date.now() + seconds * 1000).toISOString();
}
