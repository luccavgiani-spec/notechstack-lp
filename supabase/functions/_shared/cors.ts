// Domínios da nó e o alias de produção exato do app enquanto o DNS próprio é preparado.
// Nunca liberar *.vercel.app: previews e projetos de terceiros não são origens confiáveis.

const ALLOWED_ORIGIN_REGEX = /^https:\/\/([a-z0-9-]+\.)?notechstack\.com\.br$/i;
const APP_PRODUCTION_ORIGIN = "https://notechstack-app.vercel.app";

export function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && (ALLOWED_ORIGIN_REGEX.test(origin) || origin === APP_PRODUCTION_ORIGIN)
    ? origin
    : "https://notechstack.com.br";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export function handlePreflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(req.headers.get("origin")),
    });
  }
  return null;
}
