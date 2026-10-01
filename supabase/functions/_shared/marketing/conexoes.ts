// Diagnóstico das conexões por capacidade (T2 critérios 10–13). Cada leitura é
// testada por uma chamada de leitura própria, que não cria nada na plataforma.
// Publicação e escrita só ficam `ok` com uma escrita real registrada em
// `marketing_actions` nos últimos 30 dias: leitura funcionar não prova escrita.
// Nenhum valor de token sai daqui: só estados, mensagens limpas e escopos.

import { metaFetch } from "../meta.ts";
import { mensagemDeErro, semPermissao, semSegredo } from "./estados.ts";
import { adsSearch } from "./google-ads.ts";
import { type GoogleCredenciais, googleAccessToken, googleFetch } from "./google-auth.ts";
import { type MetaCtx, tokenDaPagina } from "./meta.ts";
import { addDias, hojeSaoPaulo } from "./normalize.ts";

export type EstadoConexao = "ok" | "sem_permissao" | "nao_configurado" | "erro" | "nao_verificado";

export const CAPACIDADES = [
  { id: "meta_ads_leitura", plataforma: "meta", rotulo: "Leitura de anúncios" },
  { id: "meta_ig_insights", plataforma: "meta", rotulo: "Insights orgânicos do Instagram" },
  { id: "meta_fb_insights", plataforma: "meta", rotulo: "Insights orgânicos do Facebook" },
  { id: "meta_ig_publicacao", plataforma: "meta", rotulo: "Publicação no Instagram" },
  { id: "meta_fb_publicacao", plataforma: "meta", rotulo: "Publicação no Facebook" },
  { id: "meta_ads_escrita", plataforma: "meta", rotulo: "Escrita de anúncios" },
  { id: "google_oauth", plataforma: "google", rotulo: "OAuth" },
  { id: "google_ga4", plataforma: "google", rotulo: "GA4" },
  { id: "google_search_console", plataforma: "google", rotulo: "Search Console" },
  { id: "google_ads_leitura", plataforma: "google", rotulo: "Leitura do Google Ads" },
  { id: "google_ads_criacao", plataforma: "google", rotulo: "Criação no Google Ads" },
] as const;

export type IdCapacidade = (typeof CAPACIDADES)[number]["id"];

export type Capacidade = {
  id: IdCapacidade;
  plataforma: "meta" | "google";
  rotulo: string;
  estado: EstadoConexao;
  detalhe: string | null;
  correcao: string | null;
};

export type EscritaOk = { kind: string; payload: unknown; created_at: string };

export type EntradaConexoes = {
  meta: MetaCtx | null;
  google: {
    cred: GoogleCredenciais | null;
    developerToken: string | null;
    customerId: string | null;
    loginCustomerId: string | null;
    ga4PropertyId: string | null;
    gscSiteUrl: string | null;
    criacaoLiberada: boolean;
  };
  escritas: EscritaOk[];
  agora: Date;
};

export type Diagnostico = {
  capacidades: Capacidade[];
  google_escopos: string[] | null;
  meta_permissoes: { permissao: string; status: string }[] | null;
};

type Resultado = { estado: EstadoConexao; detalhe: string | null; correcao: string | null };

const GA4_API = "https://analyticsdata.googleapis.com/v1beta";
const GSC_API = "https://searchconsole.googleapis.com/webmasters/v3";
const TOKENINFO = "https://oauth2.googleapis.com/tokeninfo";
const JANELA_ESCRITA_MS = 30 * 86_400_000;
const NAO_PROVA = "leitura funcionar não prova publicação";

// `post.publicar` só existe para as duas redes; o tipo `fb_post` é exclusivo da Página.
export function capacidadeDaEscrita(e: EscritaOk): IdCapacidade | null {
  if (e.kind === "post.publicar") {
    return (e.payload as { tipo?: unknown } | null)?.tipo === "fb_post" ? "meta_fb_publicacao" : "meta_ig_publicacao";
  }
  if (e.kind === "google.campanha.criar") return "google_ads_criacao";
  if (e.kind.startsWith("meta.")) return "meta_ads_escrita";
  return null;
}

const ok = (detalhe: string | null): Resultado => ({ estado: "ok", detalhe, correcao: null });
const naoConfigurado = (correcao: string): Resultado => ({ estado: "nao_configurado", detalhe: "Integração ainda não configurada.", correcao });
const limpa = (e: unknown) => semSegredo(mensagemDeErro(e)).slice(0, 300);

async function testar(ler: () => Promise<string | null>, correcao: { sem_permissao: string; erro: string }): Promise<Resultado> {
  try {
    return ok(await ler());
  } catch (e) {
    const perm = semPermissao(e);
    return { estado: perm ? "sem_permissao" : "erro", detalhe: limpa(e), correcao: perm ? correcao.sem_permissao : correcao.erro };
  }
}

function unix(data: string, fimDoDia = false): string {
  return String(Math.floor(Date.parse(`${data}T${fimDoDia ? "23:59:59" : "00:00:00"}-03:00`) / 1000));
}

function escrita(id: IdCapacidade, entrada: EntradaConexoes, configurado: boolean, correcao: string): Resultado {
  const desde = entrada.agora.getTime() - JANELA_ESCRITA_MS;
  const provas = entrada.escritas
    .filter((e) => capacidadeDaEscrita(e) === id && Date.parse(e.created_at) >= desde)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (provas[0]) return ok(`Última escrita bem-sucedida em ${provas[0].created_at}.`);
  const semConfig = configurado ? "" : " A integração também não está configurada.";
  return {
    estado: "nao_verificado",
    detalhe: `Nenhuma escrita bem-sucedida nos últimos 30 dias: ${NAO_PROVA}.${semConfig}`,
    correcao,
  };
}

const ERRO_META = "Conferir no Business Manager se o token do usuário do sistema \"nó-hub\" continua válido e refazer a leitura com \"fresco\".";

async function metaPermissoes(meta: MetaCtx): Promise<Diagnostico["meta_permissoes"]> {
  try {
    const resp = await metaFetch<{ data?: { permission?: string; status?: string }[] }>("/me/permissions", { access_token: meta.token });
    if (!Array.isArray(resp.data)) return null;
    return resp.data
      .filter((d) => typeof d.permission === "string")
      .map((d) => ({ permissao: String(d.permission), status: String(d.status ?? "") }));
  } catch (_) {
    return null;
  }
}

export async function googleEscopos(token: string): Promise<string[] | null> {
  try {
    const resp = await fetch(`${TOKENINFO}?access_token=${encodeURIComponent(token)}`);
    if (!resp.ok) return null;
    const corpo = await resp.json() as { scope?: unknown };
    return typeof corpo.scope === "string" ? corpo.scope.split(" ").filter(Boolean) : null;
  } catch (_) {
    return null;
  }
}

function correcaoOauth(mensagem: string): string {
  if (mensagem.includes("unauthorized_client")) {
    return "O refresh token foi emitido para outro client OAuth. Autorizar de novo com o client \"no-hub\" (o mesmo de GOOGLE_OAUTH_CLIENT_ID) pelo botão Conectar Google no planner; a nova conexão fica no Vault.";
  }
  if (mensagem.includes("invalid_grant")) {
    return "O refresh token expirou ou foi revogado (com o app em \"Teste\", vence em 7 dias). Autorizar de novo pelo botão Conectar Google no planner; a nova conexão fica no Vault.";
  }
  if (mensagem.includes("invalid_client")) {
    return "O client OAuth não confere: revisar GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_CLIENT_SECRET do projeto \"no-hub\".";
  }
  return "Usar Conectar Google no planner e refazer a leitura com \"fresco\".";
}

async function diagnosticoMeta(entrada: EntradaConexoes, ontem: string, hoje: string) {
  const meta = entrada.meta;
  const semToken = naoConfigurado("Cadastrar o secret META_SYSTEM_USER_TOKEN na marketing-hub.");
  const ativo = (nome: string, plataforma: string) =>
    naoConfigurado(`Cadastrar ${nome} em ad_accounts do cliente no-tech-stack (platform = ${plataforma}).`);

  const ads = !meta ? semToken : !meta.adAccountId ? ativo("a conta de anúncios (act_…)", "meta_ads") : testar(async () => {
    await metaFetch(`/${meta.adAccountId}/insights`, { access_token: meta.token, level: "account", fields: "spend", date_preset: "yesterday" });
    return `A conta ${meta.adAccountId} respondeu à leitura de insights.`;
  }, {
    sem_permissao: "No Business Manager, dar ao usuário do sistema \"nó-hub\" acesso à conta de anúncios e gerar o token com ads_read.",
    erro: ERRO_META,
  });

  const ig = !meta ? semToken : !meta.igUserId ? ativo("a conta do Instagram", "meta_instagram") : testar(async () => {
    await metaFetch(`/${meta.igUserId}/insights`, {
      access_token: meta.token, metric: "reach", metric_type: "total_value", period: "day", since: unix(ontem), until: unix(ontem, true),
    });
    return "Insights da conta do Instagram responderam.";
  }, {
    sem_permissao: "Gerar o token do usuário do sistema com instagram_basic e instagram_manage_insights e dar a ele acesso à conta do Instagram.",
    erro: ERRO_META,
  });

  const fb = !meta ? semToken : !meta.pageId ? ativo("a Página do Facebook", "meta_page") : testar(async () => {
    const tokenPagina = await tokenDaPagina(meta);
    await metaFetch(`/${meta.pageId}/insights`, { access_token: tokenPagina, metric: "page_media_view", period: "day", since: ontem, until: hoje });
    return "Insights da Página responderam.";
  }, {
    sem_permissao: "Gerar o token do usuário do sistema com pages_read_engagement e dar a ele acesso à Página.",
    erro: ERRO_META,
  });

  const [rAds, rIg, rFb, permissoes] = await Promise.all([ads, ig, fb, meta ? metaPermissoes(meta) : null]);
  return { ads: rAds, ig: rIg, fb: rFb, permissoes };
}

async function diagnosticoGoogle(entrada: EntradaConexoes) {
  const g = entrada.google;
  const semCred = "Cadastrar GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET e GOOGLE_OAUTH_REFRESH_TOKEN na marketing-hub.";
  let token: string | null = null;
  let oauth: Resultado;
  if (!g.cred) {
    oauth = naoConfigurado(semCred);
  } else {
    try {
      token = await googleAccessToken(g.cred, entrada.agora.getTime());
      oauth = ok("O refresh token gerou um access token.");
    } catch (e) {
      const detalhe = limpa(e);
      oauth = { estado: semPermissao(e) ? "sem_permissao" : "erro", detalhe, correcao: correcaoOauth(detalhe) };
    }
  }

  // Sem access token as leituras não chegam a ser testadas.
  const dependente = (configurado: boolean, correcaoConfig: string, teste: (t: string) => Promise<Resultado>): Promise<Resultado> => {
    if (!g.cred) return Promise.resolve(naoConfigurado(semCred));
    if (!configurado) return Promise.resolve(naoConfigurado(correcaoConfig));
    if (!token) return Promise.resolve({ estado: "erro", detalhe: "Não testado: o OAuth do Google falhou.", correcao: "Corrigir primeiro a linha OAuth." });
    return teste(token);
  };

  const [ga4, gsc, ads, escopos] = await Promise.all([
    dependente(Boolean(g.ga4PropertyId), "Cadastrar GA4_PROPERTY_ID (id numérico da propriedade) na marketing-hub.", (t) => testar(async () => {
      await googleFetch(`${GA4_API}/properties/${encodeURIComponent(String(g.ga4PropertyId))}:runReport`, t, {
        body: { dateRanges: [{ startDate: "yesterday", endDate: "yesterday" }], metrics: [{ name: "sessions" }], limit: 1 },
      });
      return `A propriedade ${g.ga4PropertyId} respondeu.`;
    }, {
      sem_permissao: "Dar à conta Google que autorizou o token acesso de Leitor na propriedade GA4, com o escopo analytics.readonly.",
      erro: "Conferir GA4_PROPERTY_ID (id numérico, não o G-…) e refazer a leitura com \"fresco\".",
    })),
    dependente(Boolean(g.gscSiteUrl), "Cadastrar GSC_SITE_URL (ex.: sc-domain:notechstack.com.br) na marketing-hub.", (t) => testar(async () => {
      const site = await googleFetch<{ permissionLevel?: string }>(`${GSC_API}/sites/${encodeURIComponent(String(g.gscSiteUrl))}`, t);
      return `Propriedade ${g.gscSiteUrl}: ${site.permissionLevel ?? "nível não informado"}.`;
    }, {
      sem_permissao: "Adicionar a conta Google que autorizou o token como usuário da propriedade no Search Console, com o escopo webmasters.readonly.",
      erro: "Conferir GSC_SITE_URL (igual à propriedade no Search Console) e refazer a leitura com \"fresco\".",
    })),
    dependente(Boolean(g.developerToken && g.customerId), "Cadastrar GOOGLE_ADS_DEVELOPER_TOKEN e GOOGLE_ADS_CUSTOMER_ID (e GOOGLE_ADS_LOGIN_CUSTOMER_ID se a conta estiver sob a MCC).", (t) => testar(async () => {
      await adsSearch({ token: t, developerToken: String(g.developerToken), customerId: String(g.customerId), loginCustomerId: g.loginCustomerId }, "SELECT customer.id FROM customer LIMIT 1", 1);
      return "A conta de anúncios respondeu à leitura (GAQL).";
    }, {
      sem_permissao: "Conferir o developer token, o GOOGLE_ADS_LOGIN_CUSTOMER_ID da MCC e se a conta Google que autorizou tem acesso à conta de anúncios.",
      erro: "Conferir GOOGLE_ADS_CUSTOMER_ID e o nível de acesso do developer token e refazer a leitura com \"fresco\".",
    })),
    token ? googleEscopos(token) : Promise.resolve(null),
  ]);

  return { oauth, ga4, gsc, ads, escopos };
}

export async function diagnosticarConexoes(entrada: EntradaConexoes): Promise<Diagnostico> {
  const hoje = hojeSaoPaulo(entrada.agora);
  const ontem = addDias(hoje, -1);
  const [meta, google] = await Promise.all([diagnosticoMeta(entrada, ontem, hoje), diagnosticoGoogle(entrada)]);
  const metaPronta = Boolean(entrada.meta);
  const g = entrada.google;

  const resultados: Record<IdCapacidade, Resultado> = {
    meta_ads_leitura: meta.ads,
    meta_ig_insights: meta.ig,
    meta_fb_insights: meta.fb,
    meta_ig_publicacao: escrita("meta_ig_publicacao", entrada, metaPronta && Boolean(entrada.meta?.igUserId),
      "Agendar pelo planner um post de teste no Instagram e conferir que ele saiu (prova AC4)."),
    meta_fb_publicacao: escrita("meta_fb_publicacao", entrada, metaPronta && Boolean(entrada.meta?.pageId),
      "Agendar pelo planner um post de teste na Página e conferir que ele saiu (prova AC4)."),
    meta_ads_escrita: escrita("meta_ads_escrita", entrada, metaPronta && Boolean(entrada.meta?.adAccountId),
      "Criar pelo planner a campanha \"[teste hub]\" (nasce PAUSED) e apagá-la em seguida (prova AC2)."),
    google_oauth: google.oauth,
    google_ga4: google.ga4,
    google_search_console: google.gsc,
    google_ads_leitura: google.ads,
    google_ads_criacao: escrita("google_ads_criacao", entrada, Boolean(g.cred && g.developerToken && g.customerId && g.criacaoLiberada),
      g.criacaoLiberada
        ? "Criar pelo planner a campanha de Pesquisa \"[teste hub]\" (nasce PAUSED) e removê-la em seguida (prova AC3)."
        : "Criação bloqueada: GOOGLE_ADS_CREATE_ENABLED só vira true depois da prova V6 (Explorer Access)."),
  };

  return {
    capacidades: CAPACIDADES.map((c) => ({ ...c, ...resultados[c.id] })),
    google_escopos: google.escopos,
    meta_permissoes: meta.permissoes,
  };
}
