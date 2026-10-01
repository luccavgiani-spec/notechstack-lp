// Edge Function do hub de marketing. verify_jwt = false no config.toml porque a
// função valida a sessão ela mesma (papel + aal) e a rota do cron não usa JWT.
// Secrets por nome (nunca por valor): ver supabase/README.md.

import { log } from "../_shared/logger.ts";
import { criarHandler } from "./handler.ts";
import { autenticador, clienteAdmin, criarStore } from "./store.ts";

const env = (nome: string): string | null => Deno.env.get(nome)?.trim() || null;

const admin = clienteAdmin();

const handler = criarHandler({
  store: criarStore(admin),
  autenticar: autenticador(admin),
  config: {
    metaToken: env("META_SYSTEM_USER_TOKEN"),
    google: {
      clientId: env("GOOGLE_OAUTH_CLIENT_ID"),
      clientSecret: env("GOOGLE_OAUTH_CLIENT_SECRET"),
      refreshToken: env("GOOGLE_OAUTH_REFRESH_TOKEN"),
      developerToken: env("GOOGLE_ADS_DEVELOPER_TOKEN"),
      customerId: env("GOOGLE_ADS_CUSTOMER_ID"),
      loginCustomerId: env("GOOGLE_ADS_LOGIN_CUSTOMER_ID"),
      ga4PropertyId: env("GA4_PROPERTY_ID"),
      gscSiteUrl: env("GSC_SITE_URL"),
    },
    googleCriacaoLiberada: env("GOOGLE_ADS_CREATE_ENABLED") === "true",
    appUrl: (env("APP_URL") ?? "https://app.notechstack.com.br").replace(/\/$/, ""),
  },
  agora: () => new Date(),
  esperar: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  uuid: () => crypto.randomUUID(),
  log,
});

Deno.serve(handler);
