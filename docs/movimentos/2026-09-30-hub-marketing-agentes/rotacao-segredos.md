# Rotação dos segredos do hub de marketing

Para quem: o Lucca, depois que os testes da Fase A terminarem (gate G8 do acompanhamento).
Por quê: durante a montagem do hub, tokens e chaves passaram por telas, playground e chat.
Este arquivo diz o que trocar, onde, em que ordem e como provar que deu certo.

**Este arquivo não contém nenhum valor de segredo, e nunca deve conter.** Valor novo vai
direto da tela que o emite para o Supabase (secret ou Vault), sem passar por chat, arquivo,
print ou commit.

## Antes de começar: o que NÃO tocar

- **Não rotacionar nem anular tokens do "Conversions API System User"** do portfólio Meta
  `990413650211777`. Ele alimenta o Pixel e o CAPI do site. "Anular tokens" nele derruba o
  CAPI. O usuário do sistema do hub é outro: **`no-hub`**, no mesmo portfólio. Confira o nome
  na tela antes de clicar.
- **Não tocar no secret `META_ACCESS_TOKEN`.** Ele é do `meta-capi` (e do `Lead`
  server-side da `send-lead-email`), não do hub.
- Não mexer em `marketing_hub_url` no Vault: é a URL da função, não é segredo.

## Os seis segredos

Painéis:
- Secrets do Supabase: <https://supabase.com/dashboard/project/sdeowbqmwkwseyktyemn/functions/secrets>
- Vault do Supabase: <https://supabase.com/dashboard/project/sdeowbqmwkwseyktyemn/integrations/vault/secrets>
- Editor SQL do Supabase: <https://supabase.com/dashboard/project/sdeowbqmwkwseyktyemn/sql/new>
- Planner (prova): <https://app.notechstack.com.br/no/marketing/visao-geral?periodo=7d>, botão
  "Buscar números frescos (sem cache)".

| Ordem | Nome | Onde mora | Painel que emite | Quem depende | Como provar |
|---|---|---|---|---|---|
| 1 | `MARKETING_CRON_SECRET` | Vault | gerado no próprio banco (migration `20260930215739_hub_marketing.sql`); troca pelo [Editor SQL](https://supabase.com/dashboard/project/sdeowbqmwkwseyktyemn/sql/new) | job `marketing-publish-due` do pg_cron (envia no header `x-cron-secret`) e rota `POST /marketing-hub/internal/publish-due` (confere pela RPC `marketing_cron_secret_ok`) | próxima rodada do cron (até 5 min) com HTTP 200 em `net._http_response` |
| 2 | `META_SYSTEM_USER_TOKEN` | Supabase secret | [Configurações do negócio → Usuários do sistema](https://business.facebook.com/latest/settings/system_users?business_id=990413650211777), usuário **`no-hub`** | `marketing-hub` (leitura e escrita Meta: blocos `meta_ads`, `instagram`, `facebook`, campanhas e posts agendados) | planner "Buscar números frescos": `meta_ads`, `instagram` e `facebook` com `ok: true` |
| 3 | `GOOGLE_OAUTH_CLIENT_SECRET` | Supabase secret | [Google Auth Platform → Clientes](https://console.cloud.google.com/auth/clients?project=no-hub) do projeto `no-hub` → "Cliente Web 1" (ID terminando em `jctel0`) → "Chaves secretas do cliente" | `marketing-hub` (renovação do token Google; troca do código no botão "Conectar Google") | planner: `ga4`, `search_console` e `google_ads` com `ok: true`; logs da `marketing-hub` sem `invalid_client` |
| 4 | `GOOGLE_OAUTH_REFRESH_TOKEN` (hoje) → `marketing_google_refresh_token` (depois do botão) | Supabase secret hoje; Vault depois dos critérios 17–22 da T1 | botão "Conectar Google" em `/no/marketing/conexoes` (planner); revogação em [Apps vinculados da conta Google que autorizou](https://myaccount.google.com/connections) | `marketing-hub` (GA4, Search Console, Google Ads) | planner: `ga4`, `search_console`, `google_ads` com `ok: true`; logs sem `unauthorized_client` nem `invalid_grant`; linha `google.conectar` em `marketing_actions` |
| — | `GOOGLE_OAUTH_CLIENT_ID` | Supabase secret | mesmo cliente do item 3 | `marketing-hub` | não é segredo e **não rotaciona**; só muda se o cliente for recriado (aí refazer 3 e 4 juntos) |
| — | `GOOGLE_ADS_DEVELOPER_TOKEN` | Supabase secret | [Central de API da MCC "nó MCC" 680-090-9119](https://ads.google.com/aw/apicenter) | `marketing-hub` envia no header `developer-token` das chamadas ao Google Ads | **não rotacionar**: o Google desativou os developer tokens em 09/09/2026 (ver abaixo) |

## Ordem e passo a passo

A ordem acima vai do que não depende de terceiros para o que depende. Os itens 3 e 4 andam
juntos e nessa ordem: a troca do código no item 4 usa a chave do item 3, então a prova final
do item 4 cobre os dois.

### 1. `MARKETING_CRON_SECRET` (Vault)

Como funciona: a migration cria o valor no banco com
`encode(extensions.gen_random_bytes(32), 'hex')` e guarda no Vault com o nome
`MARKETING_CRON_SECRET`. O job `marketing-publish-due` lê o Vault e manda o valor no header
`x-cron-secret`. A função `marketing-hub` não guarda cópia: ela pergunta ao banco pela RPC
`marketing_cron_secret_ok`, que compara lá dentro. O valor nunca sai do Vault.

Por isso a troca é atômica, não precisa de deploy e não tem janela de erro:

1. No Editor SQL, com OK do Lucca (escrita em produção):
   ```sql
   select vault.update_secret(
     (select id from vault.secrets where name = 'MARKETING_CRON_SECRET'),
     encode(extensions.gen_random_bytes(32), 'hex')
   );
   ```
   Não use `select` em `vault.decrypted_secrets` para "conferir": isso imprime o valor.
2. Prova, depois de 5 minutos (só leitura):
   ```sql
   select status_code, created
     from net._http_response
    order by created desc
    limit 3;
   ```
   Esperado: `200` numa linha posterior à troca. `401` quer dizer que a função e o job leram
   valores diferentes, o que não deveria acontecer, porque os dois leem o mesmo Vault.

### 2. `META_SYSTEM_USER_TOKEN` (Supabase secret)

1. Abra [Usuários do sistema](https://business.facebook.com/latest/settings/system_users?business_id=990413650211777)
   e selecione **`no-hub`**. Confira o nome antes de qualquer clique (o outro usuário da
   lista é o do CAPI e fica intocado).
2. "Anular tokens" do `no-hub` para o app do hub. Faça isso **antes** de gerar o novo: a
   anulação vale para os tokens daquele usuário no app, e um token gerado antes dela também
   cairia. Confira o texto da tela no momento.
3. "Gerar novo token" para o mesmo app, validade **Nunca**, com as permissões do Passo 0.1 do
   `plan.md`: `ads_management`, `ads_read`, `business_management`, `pages_show_list`,
   `pages_read_engagement`, `pages_manage_posts`, `read_insights`, `instagram_basic`,
   `instagram_content_publish`, `instagram_manage_insights`.
4. Cole direto em [Secrets](https://supabase.com/dashboard/project/sdeowbqmwkwseyktyemn/functions/secrets)
   como `META_SYSTEM_USER_TOKEN` (substitui o atual).
5. Prova: no planner, "Buscar números frescos (sem cache)" → `meta_ads`, `instagram` e
   `facebook` com `ok: true`. Entre os passos 2 e 4, só os blocos Meta do planner ficam fora;
   o CAPI do site não é afetado.

### 3. `GOOGLE_OAUTH_CLIENT_SECRET` (Supabase secret)

Estado em 01/10/2026 (lido no console, sem valores): o "Cliente Web 1" tem **2 chaves
ativas**, uma criada em 30/09 às 20:44 (BRT) e outra em 01/10 às 17:44 (BRT). O console avisa
que ter mais de uma chave aumenta o risco. O secret do Supabase foi gravado em 30/09 às
23:44 UTC (20:44 BRT), antes de a segunda chave existir.

1. Abra [Clientes](https://console.cloud.google.com/auth/clients?project=no-hub) (confira que
   o seletor do topo mostra **`no-hub`**, não o projeto de cliente "discordia") → "Cliente
   Web 1" → "Chaves secretas do cliente".
2. "Add secret" para gerar uma chave nova. Ela aparece uma única vez: copie direto para
   [Secrets](https://supabase.com/dashboard/project/sdeowbqmwkwseyktyemn/functions/secrets)
   como `GOOGLE_OAUTH_CLIENT_SECRET`.
3. Siga para o item 4 (a reconexão usa esta chave).
4. Depois da prova do item 4: na mesma tela, "Desativar" e depois excluir **as duas chaves
   antigas**, deixando só a nova. A data de criação de cada chave na tela diz qual é qual.

### 4. Refresh token do Google

Hoje o refresh token está no secret `GOOGLE_OAUTH_REFRESH_TOKEN`, e é ele que falha com
`unauthorized_client`: é compatível com a hipótese de emissão para outro client OAuth; a origem exata não foi provada nesta retomada. Com os
critérios 17–22 da T1, ele passa a nascer pelo botão "Conectar Google" e a morar no Vault
como `marketing_google_refresh_token`. A função lê o Vault primeiro e só cai no secret se o
Vault estiver vazio.

Pré-requisitos no projeto `no-hub`:
- o URI de redirecionamento
  `https://sdeowbqmwkwseyktyemn.supabase.co/functions/v1/marketing-hub/google/callback`
  cadastrado no "Cliente Web 1";
- enquanto o app estiver em "Teste", a conta Google que vai autorizar precisa estar em
  [Público-alvo → Usuários de teste](https://console.cloud.google.com/auth/audience?project=no-hub),
  e o token vale 7 dias.

Rotação:
1. Em [Apps vinculados](https://myaccount.google.com/connections) da conta Google que
   autorizou, remova o acesso do app "No Tech Stack Marketing". Isso revoga o token antigo.
   Faça antes de reconectar: remover depois revogaria também o novo.
2. No planner, `/no/marketing/conexoes` → "Conectar Google" → autorizar os 3 escopos.
3. Prova:
   - o navegador volta para `/no/marketing/conexoes?google=ok`;
   - 1 linha nova em `marketing_actions` com `kind = google.conectar`;
   - "Buscar números frescos (sem cache)" → `ga4`, `search_console` e `google_ads` com
     `ok: true`;
   - logs da `marketing-hub` depois do clique sem `unauthorized_client`, `invalid_client` ou
     `invalid_grant`.
4. Depois de provar, apague o secret `GOOGLE_OAUTH_REFRESH_TOKEN` do Supabase, para não
   sobrar uma reserva com token velho.

### `GOOGLE_OAUTH_CLIENT_ID`

Não é segredo e não rotaciona. Se um dia o "Cliente Web 1" for recriado, atualize o secret e
refaça os itens 3 e 4 na sequência, porque o refresh token fica preso ao client que o emitiu.

### `GOOGLE_ADS_DEVELOPER_TOKEN`

A Central de API da MCC mostra hoje: "O acesso à API Google Ads mudou. Os tokens de
desenvolvedor não são mais necessários". A política do Google
(<https://developers.google.com/google-ads/api/docs/api-policy/developer-token?hl=pt-BR>)
diz que os developer tokens foram desativados em 09/09/2026: o header continua aceito, mas é
ignorado, e o nível de acesso passou a ser do **projeto Google Cloud** dono do client OAuth.
A mesma página responde que um token vazado não precisa ser redefinido.

Então: **não rotacionar**. O nível de acesso que importa está em
<https://console.cloud.google.com/google/ads-apis/overview?project=no-hub> (em 01/10/2026:
"Teste"). Tirar o secret e o header do código fica para uma mudança futura, fora da Fase A.

## Depois da rotação

- Marque o gate G8 em `.tasks/acompanhamento.md` com a data e o resultado de cada prova (só
  status e horários, nunca valores).
- Se algum bloco não voltar `ok: true`, não repita a troca às cegas: leia o evento
  `marketing_bloco_falhou` nos logs da `marketing-hub`, que traz o motivo sem o token.


## Diagnóstico de retomada — 01/10/2026, somente leitura

No Chrome autenticado, o projeto selecionado era `no-hub`:

- [Público-alvo](https://console.cloud.google.com/auth/audience?project=no-hub): app externo,
  status **Testando**, botão **Publicar app** desabilitado. A própria tela pede concluir
  a configuração na página de branding. A tabela de usuários de teste está vazia (0).
- [Branding](https://console.cloud.google.com/auth/branding?project=no-hub): nome
  `No Tech Stack Marketing`, homepage e domínio autorizado preenchidos; campos de
  Política de Privacidade e Termos de Serviço vazios. Contato e suporte identificam Lucca.
  Esses campos vazios são evidência de configuração incompleta; a tela não individualiza
  qual deles bloqueia a publicação. Não foi feita tentativa de salvar/publicar.
- O proprietário IAM não foi confirmado: a tentativa de abrir IAM expirou. O contato de
  suporte não é prova do papel de proprietário. Nenhuma configuração foi alterada.
- Gate G2b: o Lucca precisa cadastrar o callback listado acima no
  [cliente Web 1](https://console.cloud.google.com/auth/clients/514667239502-huuig85caf5g46mql6og7gh0fejctel0.apps.googleusercontent.com?project=no-hub).
  Esta retomada não abriu a área de chaves do cliente nem confirmou o URI cadastrado.
- Para testes antes de publicar, falta adicionar a conta que autorizará aos usuários de
  teste. Autorização OAuth, edição de conta e publicação continuam ações do Lucca.

Backend preparado localmente: state aleatório de 32 bytes, TTL de 600 segundos e consumo
atômico; leitura Vault antes do secret legado; salvamento do token e uma linha de auditoria
na mesma transação. As RPCs só são executáveis por service role. Erros de callback nunca
incluem respostas remotas nem erros de banco. O callback é fixo, conforme T1, e não usa o Host
da requisição. Conexão concluída invalida caches Google e diagnóstico.

Provas locais: `marketingGoogleOAuth.test.ts` (19 testes), regressão dos adapters e handler
(62 testes); `marketing_google_oauth_migration.mjs` valida SQL, grants, consumo único,
expiração, rollback e auditoria num Postgres WASM isolado. O Vault desse teste é um stub
explícito: criptografia/extensão real e isolamento entre conexões Postgres reais ainda
precisam de prova no ambiente integrado. Critérios T1 1–2 e consentimento real de 17
permanecem sem verificação, dependentes de G2b, usuários de teste e publicação da função.
