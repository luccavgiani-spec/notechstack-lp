// Edge function publica (verify_jwt = false): diagnostico gratuito do auditor. Logica em core.ts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handle } from "./core.ts";
import { enviarAlertaTeto, enviarDiagnosticoEntregue } from "./envios.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const rpc = async (fn: string, args: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data;
};

Deno.serve((req: Request) =>
  handle(req, {
    rpc,
    fetch: (input, init) => fetch(input, init),
    env: (k: string) => Deno.env.get(k),
    envios: { enviarDiagnosticoEntregue, enviarAlertaTeto },
  })
);
