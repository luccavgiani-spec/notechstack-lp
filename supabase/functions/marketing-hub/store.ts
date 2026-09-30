// Implementação Supabase do MarketingStore: tabelas do movimento, Storage
// `marketing-media` e Auth admin para a conta do dot. Só service role.

import { createClient, type SupabaseClient, type User } from "jsr:@supabase/supabase-js@2";
import { COLUNAS_ORIGEM_LEAD, type LeadOrigem } from "../_shared/marketing/leads.ts";
import {
  type AcaoRow,
  type AgenteRow,
  type Ativos,
  type Chamador,
  ConflitoError,
  type MarketingStore,
  type PostRow,
} from "./handler.ts";

const SLUG_NO = "no-tech-stack";
const BUCKET = "marketing-media";
const PAPEL_DOT = "MARKETING_AGENT";

export function clienteAdmin(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const chave = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !chave) throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes");
  return createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
}

function falhar(contexto: string, error: { message?: string; code?: string } | null): never {
  throw new Error(`${contexto}: ${error?.code ?? ""} ${error?.message ?? "falha"}`.trim());
}

// O token já foi validado pelo Auth em getUser; aqui só se lê o claim `aal`.
function payloadJwt(token: string): Record<string, unknown> | null {
  try {
    const parte = token.split(".")[1] ?? "";
    const b64 = parte.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(parte.length / 4) * 4, "=");
    return JSON.parse(atob(b64));
  } catch (_) {
    return null;
  }
}

export function autenticador(admin: SupabaseClient) {
  return async (token: string): Promise<Chamador | null> => {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return null;
    const banidoAte = (data.user as User & { banned_until?: string | null }).banned_until;
    return {
      userId: data.user.id,
      role: typeof data.user.app_metadata?.role === "string" ? data.user.app_metadata.role : null,
      aal: typeof payloadJwt(token)?.aal === "string" ? String(payloadJwt(token)?.aal) : null,
      banido: Boolean(banidoAte && Date.parse(banidoAte) > Date.now()),
    };
  };
}

async function listarUsuarios(admin: SupabaseClient): Promise<User[]> {
  const todos: User[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) falhar("auth.listUsers", error);
    todos.push(...data.users);
    if (data.users.length < 200) break;
  }
  return todos;
}

export function criarStore(admin: SupabaseClient): MarketingStore {
  let clienteNo: string | null = null;

  async function idDaNo(): Promise<string | null> {
    if (clienteNo) return clienteNo;
    const { data, error } = await admin.from("clients").select("id").eq("slug", SLUG_NO).maybeSingle();
    if (error) falhar("clients", error);
    clienteNo = data?.id ?? null;
    return clienteNo;
  }

  return {
    async cacheLer(chave) {
      const { data, error } = await admin.from("marketing_cache").select("payload, expires_at").eq("key", chave).maybeSingle();
      if (error || !data) return null;
      return Date.parse(data.expires_at) > Date.now() ? data.payload : null;
    },

    async cacheGravar(chave, valor, ttl) {
      const agora = Date.now();
      await admin.from("marketing_cache").delete().lt("expires_at", new Date(agora).toISOString());
      const { error } = await admin.from("marketing_cache").upsert({
        key: chave, payload: valor, expires_at: new Date(agora + ttl * 1000).toISOString(),
      });
      if (error) falhar("marketing_cache", error);
    },

    async cacheLimpar(prefixo) {
      await admin.from("marketing_cache").delete().like("key", `${prefixo}%`);
    },

    async acaoIniciar(linha) {
      const { data, error } = await admin.from("marketing_actions").insert({ ...linha, status: "executando" }).select("id").single();
      if (!error) return { id: data.id };
      if (error.code !== "23505") falhar("marketing_actions", error);
      const existente = await admin.from("marketing_actions").select("*").eq("request_id", linha.request_id).single();
      if (existente.error) falhar("marketing_actions", existente.error);
      return { existente: existente.data as AcaoRow };
    },

    async acaoFinalizar(id, fim) {
      const { error } = await admin.from("marketing_actions").update({
        status: fim.status,
        result: fim.result ?? null,
        external_ids: fim.external_ids ?? null,
        error: fim.error ?? null,
        finished_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) falhar("marketing_actions", error);
    },

    async acoesListar(limite) {
      const { data, error } = await admin.from("marketing_actions").select("*").order("created_at", { ascending: false }).limit(limite);
      if (error) falhar("marketing_actions", error);
      return (data ?? []) as AcaoRow[];
    },

    async ativos(): Promise<Ativos> {
      const clientId = await idDaNo();
      const vazio: Ativos = { clientId, metaAds: null, metaPage: null, metaInstagram: null };
      if (!clientId) return vazio;
      const { data, error } = await admin.from("ad_accounts")
        .select("id, platform, external_id").eq("client_id", clientId).eq("status", "active");
      if (error) falhar("ad_accounts", error);
      for (const linha of data ?? []) {
        const ativo = { id: linha.id as string, externalId: linha.external_id as string };
        if (linha.platform === "meta_ads") vazio.metaAds = ativo;
        if (linha.platform === "meta_page") vazio.metaPage = ativo;
        if (linha.platform === "meta_instagram") vazio.metaInstagram = ativo;
      }
      return vazio;
    },

    async postsListar(de, ate) {
      const clientId = await idDaNo();
      if (!clientId) return [];
      const { data, error } = await admin.from("scheduled_posts").select("*")
        .eq("client_id", clientId).gte("scheduled_at", de).lt("scheduled_at", ate).order("scheduled_at");
      if (error) falhar("scheduled_posts", error);
      return (data ?? []) as PostRow[];
    },

    async postInserir(linha) {
      const { data, error } = await admin.from("scheduled_posts").insert(linha).select("*").single();
      if (error) falhar("scheduled_posts", error);
      return data as PostRow;
    },

    async postBuscar(id) {
      const { data, error } = await admin.from("scheduled_posts").select("*").eq("id", id).maybeSingle();
      if (error) falhar("scheduled_posts", error);
      return (data ?? null) as PostRow | null;
    },

    async postAtualizar(id, patch) {
      const { error } = await admin.from("scheduled_posts").update(patch).eq("id", id);
      if (error) falhar("scheduled_posts", error);
    },

    async postsReservarVencidos(limite) {
      const { data, error } = await admin.rpc("marketing_claim_due_posts", { p_limit: limite });
      if (error) falhar("marketing_claim_due_posts", error);
      return (data ?? []) as PostRow[];
    },

    async leadsOrigem(inicio, fim) {
      const { data, error } = await admin.from("leads").select(COLUNAS_ORIGEM_LEAD)
        .gte("created_at", inicio).lt("created_at", fim).limit(10_000);
      if (error) falhar("leads", error);
      return (data ?? []) as unknown as LeadOrigem[];
    },

    async cronSecretOk(segredo) {
      const { data, error } = await admin.rpc("marketing_cron_secret_ok", { p_secret: segredo });
      return !error && data === true;
    },

    async urlUpload(caminho) {
      const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(caminho);
      if (error || !data) falhar("storage.upload", error);
      return { signedUrl: data.signedUrl, token: data.token, path: data.path };
    },

    async urlLeitura(caminho, segundos) {
      const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(caminho, segundos);
      if (error || !data) falhar("storage.signedUrl", error);
      return data.signedUrl;
    },

    async baixarMidia(caminho) {
      const { data, error } = await admin.storage.from(BUCKET).download(caminho);
      if (error || !data) falhar("storage.download", error);
      return new Uint8Array(await data.arrayBuffer());
    },

    async agentesListar(): Promise<AgenteRow[]> {
      return (await listarUsuarios(admin))
        .filter((u) => u.app_metadata?.role === PAPEL_DOT)
        .map((u) => {
          const banidoAte = (u as User & { banned_until?: string | null }).banned_until;
          return {
            id: u.id,
            email: u.email ?? null,
            banido: Boolean(banidoAte && Date.parse(banidoAte) > Date.now()),
            criado_em: u.created_at ?? null,
            ultimo_login: u.last_sign_in_at ?? null,
          };
        });
    },

    async agentePapel(userId) {
      const { data, error } = await admin.auth.admin.getUserById(userId);
      if (error || !data.user) return null;
      return typeof data.user.app_metadata?.role === "string" ? data.user.app_metadata.role : null;
    },

    // Mesmo padrão do skill-01: link de convite devolvido só ao NO_ADMIN, e a
    // senha é criada pelo próprio dono do link. Conta com outro papel nunca é reaproveitada.
    async agenteConvidar(email, redirectTo) {
      const existente = (await listarUsuarios(admin)).find((u) => u.email?.toLowerCase() === email);
      if (existente && existente.app_metadata?.role !== PAPEL_DOT) {
        throw new ConflitoError("Este e-mail já pertence a outra conta do sistema.");
      }
      if (existente?.email_confirmed_at) {
        throw new ConflitoError("A conta do dot já existe e já definiu senha. Use desligar/religar.");
      }
      const gerado = await admin.auth.admin.generateLink({ type: "invite", email, options: { redirectTo } });
      if (gerado.error || !gerado.data.user || !gerado.data.properties?.action_link) falhar("auth.generateLink", gerado.error);
      const user = gerado.data.user;
      if (user.app_metadata?.role !== PAPEL_DOT) {
        const papel = await admin.auth.admin.updateUserById(user.id, { app_metadata: { ...user.app_metadata, role: PAPEL_DOT } });
        if (papel.error) {
          if (!existente) await admin.auth.admin.deleteUser(user.id);
          falhar("auth.updateUser", papel.error);
        }
      }
      return { userId: user.id, link: gerado.data.properties.action_link };
    },

    async agenteBanir(userId, banir) {
      const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: banir ? "876000h" : "none" });
      if (error) falhar("auth.ban", error);
    },
  };
}
