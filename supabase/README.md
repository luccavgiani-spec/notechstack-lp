# nó hub — backend core de integração Meta (Fase 1)

Backend centralizado que alimenta todos os hubs da nó com dados de **Meta Ads**
e **Instagram/FB orgânico**. Multi-tenant via Row Level Security — cada cliente
só enxerga a própria linha pelo claim `client_id` no JWT.

Projeto Supabase: `sdeowbqmwkwseyktyemn` (sa-east-1).
Meta App ID: `1590026522084626` (Facebook Login).

## Estrutura

```
supabase/
├── config.toml                        # config do projeto (verify_jwt por função)
├── migrations/
│   └── 20260423195849_meta_integration_core.sql
└── functions/
    ├── _shared/                       # helpers (meta client, cors, logger, supabase)
    ├── oauth-callback/                # recebe redirect da Meta, salva tokens
    ├── sync-meta-ads/                 # cron diário — insights de campanhas
    ├── sync-meta-organic/             # cron diário — insights IG + FB Page
    └── refresh-tokens/                # cron diário — estende long-lived tokens
```

## Tabelas

| Tabela | Pra quê |
| --- | --- |
| `clients` | 1 linha por cliente da nó (gera o slug do hub) |
| `ad_accounts` | Contas Meta conectadas via OAuth (Ads, Page, IG Business) |
| `ad_metrics_daily` | Snapshot diário por campanha |
| `social_metrics_daily` | Snapshot diário por perfil orgânico |
| `scheduled_posts` | Fila de publicação programada |
| `sync_logs` | Auditoria de execução dos jobs |
| `ad_accounts_public` (view) | ad_accounts SEM o access_token, pro frontend |

## Deploy inicial

Pré-requisito: Supabase CLI instalado e você logado (`supabase login`).

```bash
cd supabase-backend-repo-root/   # onde está a pasta supabase/
supabase link --project-ref sdeowbqmwkwseyktyemn
```

### 1. Subir o schema

```bash
supabase db push
```

### 2. Adicionar o App Secret no Vault

**Faça isso ANTES de deployar qualquer função** — elas falham sem o secret.

```bash
supabase secrets set META_APP_SECRET=<valor-do-app-secret-da-Meta>
```

Confere com:

```bash
supabase secrets list
```

### 3. Deploy das Edge Functions

```bash
supabase functions deploy oauth-callback    --no-verify-jwt
supabase functions deploy sync-meta-ads
supabase functions deploy sync-meta-organic
supabase functions deploy refresh-tokens
```

> A flag `--no-verify-jwt` no `oauth-callback` é redundante com o `config.toml`,
> mas deixamos explícito pra quem lê o comando.

## Seed de teste (Thais Santinhas)

```sql
insert into public.clients (name, slug, email)
values ('Thais Santinhas', 'thais', 'thais@example.com')
returning id;
```

Guarda o `id` devolvido — vamos usar no `state` da URL OAuth.

## Testar o fluxo OAuth manualmente

1. Garanta que a Thais está **adicionada como Tester** no app Meta
   (`developers.facebook.com` → App da nó → Roles → Test Users).
2. Monte a URL OAuth (substitua `{CLIENT_ID_UUID}` pelo id da Thais):

   ```
   https://www.facebook.com/v21.0/dialog/oauth?client_id=1590026522084626&redirect_uri=https%3A%2F%2Fsdeowbqmwkwseyktyemn.supabase.co%2Ffunctions%2Fv1%2Foauth-callback&state={CLIENT_ID_UUID}&scope=ads_read%2Cads_management%2Cbusiness_management%2Cpages_show_list%2Cpages_read_engagement%2Cinstagram_basic%2Cinstagram_manage_insights%2Cinstagram_content_publish%2Cinstagram_manage_comments%2Cpublic_profile%2Cemail&response_type=code
   ```

   Versão legível dos parâmetros:

   | Parâmetro | Valor |
   | --- | --- |
   | `client_id` | `1590026522084626` |
   | `redirect_uri` | `https://sdeowbqmwkwseyktyemn.supabase.co/functions/v1/oauth-callback` |
   | `state` | `{CLIENT_ID_UUID}` |
   | `scope` | `ads_read,ads_management,business_management,pages_show_list,pages_read_engagement,instagram_basic,instagram_manage_insights,instagram_content_publish,instagram_manage_comments,public_profile,email` |
   | `response_type` | `code` |

3. Abra no browser logado com a conta Meta da Thais, aceite as permissões.
4. Confere o resultado:

   ```sql
   select id, platform, external_id, external_name, status, token_expires_at
   from public.ad_accounts
   where client_id = '{CLIENT_ID_UUID}';

   select * from public.sync_logs
   where job_name = 'oauth-callback'
   order by created_at desc
   limit 5;
   ```

   Esperado: 1 linha `meta_ads` (conta Ads), 1 linha `meta_page` e 1 linha
   `meta_instagram` (se a Page estiver vinculada a um IG Business).

## Testar sync manual (via curl)

Use a **service role key** do projeto (pega em Project Settings → API).
Nunca expõe essa key no frontend.

```bash
export SERVICE_ROLE_KEY="eyJ..."
export FN_URL="https://sdeowbqmwkwseyktyemn.supabase.co/functions/v1"

# Sync de Ads — todas as contas ativas
curl -X POST "$FN_URL/sync-meta-ads" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "content-type: application/json" \
  -d '{}'

# Sync de Ads — só uma conta
curl -X POST "$FN_URL/sync-meta-ads" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "content-type: application/json" \
  -d '{"account_id":"<uuid-da-ad_accounts>"}'

# Sync orgânico
curl -X POST "$FN_URL/sync-meta-organic" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "content-type: application/json" -d '{}'

# Refresh de tokens
curl -X POST "$FN_URL/refresh-tokens" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY"
```

Cada chamada devolve um JSON tipo:

```json
{
  "results": [
    { "account_id": "...", "status": "success", "records": 21 }
  ]
}
```

Validação:

```sql
-- Amostra dos dados sincronizados
select date, campaign_name, spend, conversions, roas
from public.ad_metrics_daily
where client_id = '{CLIENT_ID_UUID}'
order by date desc, spend desc
limit 20;

select date, followers_count, followers_gained, engagement_rate
from public.social_metrics_daily
where client_id = '{CLIENT_ID_UUID}'
order by date desc;

select * from public.sync_logs
order by created_at desc
limit 20;
```

## Logs

Os logs das functions são JSON estruturado (`console.log(JSON.stringify(...))`)
e aparecem em **Project → Edge Functions → [nome da função] → Logs**. Dá pra
filtrar por `event` (ex: `event=sync_ads_failed`) ou `account_id`.

## Próximos passos (fora desta fase)

- Fase 2: módulo de dashboard no hub da Thais consumindo `ad_metrics_daily` +
  `social_metrics_daily` via view `ad_accounts_public`.
- Vercel Cron pra disparar `sync-meta-ads`, `sync-meta-organic` diariamente e
  `refresh-tokens` semanalmente (prompt separado).
- App Review da Meta (Lucca faz depois de validar MVP com 1-2 clientes reais).
- Encryption-at-rest adicional pro `access_token` via `pgsodium` ou Supabase
  Vault (hoje já fica criptografado em disco pelo Supabase, mas podemos
  endurecer).
