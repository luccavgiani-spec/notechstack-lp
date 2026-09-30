---
movement_id: hub-marketing-agentes
intent: ./intent.md
intent_revision: e7826fc
status: draft
updated: 2026-09-30
---

# Spec: marketing da nó num lugar só, operável por agentes

## Contrato com o problema

A solução precisa acabar com duas coisas: a leitura fragmentada em cinco painéis
com login pessoal, e a impossibilidade de delegar a um agente. Na prática:

1. um **planner** único, onde o Lucca lê e opera;
2. uma **porta para agentes** que expõe as mesmas capacidades;
3. uma **trava de confirmação no servidor**, para que nada seja publicado nem gaste
   dinheiro sem o Lucca.

Regra do Lucca: "se o sistema consegue, o agente também consegue". O sistema é a
fonte de capacidade, e o agente é só mais uma porta de entrada.

## Estado atual relevante

- **Backend Meta de abril** (`supabase/functions/`, `supabase/README.md`):
  - `oauth-callback` (público, `verify_jwt=false`), `sync-meta-ads`,
    `refresh-tokens`; `sync-meta-organic` está **implantado, mas o código-fonte não
    está no repo**.
  - Cliente Graph reutilizável em `_shared/meta.ts` (retry/backoff, `v21.0`, app
    `1590026522084626`).
  - `sync-meta-ads` só conta **purchase** como conversão (`parseInsightsRow`). A nó
    converte em **lead**, então, do jeito que está, reportaria 0 conversões.
- **Tabelas** (migration `20260423195849`): `clients`, `ad_accounts`
  (`access_token NOT NULL`), `ad_metrics_daily`, `social_metrics_daily`,
  `scheduled_posts` (fila com `media_type`, `caption`, `media_urls`, `status`,
  `external_post_id`), `sync_logs`. Todas vazias em produção.
- **Risco E4**: `anon` e `authenticated` têm grants de escrita em `ad_accounts`,
  `ad_metrics_daily` e `scheduled_posts`; hoje só a RLS segura.
- **Colisão de claim**: as policies legadas leem `client_id` do JWT como tenant, e
  os tokens do OAuth 2.1 do Supabase trazem `client_id` = id do cliente OAuth. Não
  vaza nada (os UUIDs não batem), mas os dois conceitos não podem se misturar.
- **App** (`app/`, React + Supabase Auth): rotas `/no/*` protegidas por
  `RoleRoute role="NO_ADMIN"` (`app/src/App.tsx:43`). O planner nasce ali.
- **Padrão de segredo no servidor** já usado: `painel-dados` com secret +
  `META_APP_SECRET`.
- **Extensões**: `pg_net` e `supabase_vault` ativos; `pg_cron` **não**.
- **Funil próprio**: tabelas `leads`, `lead_sessoes` e `lead_eventos` (fonte de
  verdade de lead da nó).
- **Tags do site**: GA4 `G-1YEB89RVER` (com vínculo ao Google Ads, conforme Q3),
  Google Ads `AW-17683211415`, Pixel `1753619075655271`, portfólio Meta
  `990413650211777` (comentário em `meta-capi`).

### Fatos externos que mudam a solução

| # | Fato | Fonte | Confiança |
|---|---|---|---|
| X1 | No **ChatGPT Pro**, apps MCP próprios (Developer Mode) são **só leitura/fetch**. Ferramentas de escrita em MCP próprio exigem Business ou Enterprise. Os dots herdam isso. | resumos de busca de 30/09 que citam a central de ajuda da OpenAI; as páginas não abriram (proxy de rede). Entre os resultados: [flaviocopes — dots](https://flaviocopes.com/openai-dots/), [hourtick — dots](https://hourtick.com/agents/openai-dots), [coworker.ai — ChatGPT MCP](https://coworker.ai/blog/chatgpt-mcp) | média-alta; provar no passo 0 |
| X2 | O Supabase Auth tem um **servidor OAuth 2.1** (beta, gratuito) feito para autenticar clientes MCP: PKCE, descoberta, registro dinâmico e tela de consentimento própria. Os tokens carregam `client_id`. | [Supabase — MCP Authentication](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication) | alta |
| X3 | Servidores MCP rodam em Edge Functions (transporte Streamable HTTP). | [Supabase — Deploy MCP servers](https://supabase.com/docs/guides/ai-tools/byo-mcp) | alta |
| X4 | O developer token do Google Ads sai de uma **conta de administrador (MCC)** e nasce em **Explorer Access**: contas reais, 2.880 operações/dia, sem revisão. | [Google Ads API — Access levels](https://developers.google.com/google-ads/api/docs/access-levels?hl=en) | alta; confirmar que o Explorer permite criar campanha |
| X5 | O GA4 expõe custo, cliques e impressões do Google Ads vinculado (`advertiserAdCost` etc.) na Data API. | conhecimento prévio da documentação GA4 Data API (não reaberta hoje) | média-alta; provar no passo 0 |
| X6 | Um app Google com OAuth em status **"Testing"** tem refresh tokens que expiram em 7 dias. Em "In production" isso não acontece. | conhecimento prévio da documentação Google OAuth (não reaberta hoje) | média-alta |

## Requisitos

| # | Requisito | Origem |
|---|---|---|
| R1 | Ler, num período escolhido: Meta Ads (gasto, alcance, cliques, leads), Google Ads (gasto, cliques, conversões), GA4 (sessões e eventos-chave por canal), Search Console (cliques, impressões, consultas e páginas), IG/FB orgânico (seguidores, alcance, engajamento por post) e leads do funil próprio. | resultado 1 |
| R2 | Criar, editar (orçamento, status, datas) e pausar/ativar campanhas **Meta** (campanha + conjunto + anúncios com imagem ou vídeo). | resultado 3 |
| R3 | Criar, editar (orçamento, status) e pausar/ativar campanhas **Google Ads de Pesquisa** (orçamento, lances, locais, grupo, palavras-chave, anúncio responsivo). | resultado 3 + Q2 |
| R4 | Agendar, publicar e cancelar posts no IG (feed, carrossel, reels) e no FB, com calendário. | resultado 2 |
| R5 | Toda escrita externa só roda com **confirmação expressa do Lucca**, garantida pelo servidor. | P3 |
| R6 | Registro de toda escrita: quem pediu, quem confirmou, payload, resultado e ids externos. | sinais de sucesso |
| R7 | A mesma capacidade de R1–R4 fica exposta a agentes por MCP remoto com OAuth; R5 vale também para eles. | P4 + regra do Lucca |
| R8 | Credenciais só no servidor; `anon`/`authenticated` sem acesso a tabelas com dados sensíveis. | restrições |

## Restrições e invariantes

- Só ativos da nó. Nenhum OAuth de terceiro e nenhum App Review como
  pré-requisito.
- Nenhuma escrita em Meta ou Google parte de token de agente. Agente só cria
  **proposta**.
- A confirmação só é aceita de uma sessão humana NO_ADMIN do planner (JWT **sem**
  `client_id` de OAuth).
- Tracking do site (GTM, CAPI, pixel) intocado. Funil de leads (`painel-dados`,
  `track-evento`) intocado.
- Identidade v2 (`brand/BRAND.md`, `brand/tokens/tokens.css`) no planner.
- Nada de categoria de saúde em payload de anúncio ou evento (política Meta; ver
  `meta-capi`).

## Não objetivos

- Data warehouse ou histórico próprio de métricas (lê ao vivo; ver opção D).
- Performance Max, Display, YouTube e Shopping no Google. Advantage+ catálogo na
  Meta.
- Geração de criativo por IA. Aprovação por WhatsApp ou e-mail.
- Multi-cliente. Publicar o app no catálogo do ChatGPT.

## Opções consideradas

| Opção | Resolve o quê | Complexidade | Riscos | Motivo da decisão |
|---|---|---|---|---|
| **A. Manter como está** | nada | zero | a dor continua | Rejeitada: não atende R1–R7. |
| **B. Montar com terceiros**: Windsor.ai (leitura + MCP) + agendador com plugin de dots (ex.: Postiz) + ferramenta de Ads de terceiro | R1 parcial, R4; R2 talvez; R3 não | baixa para começar | 2–3 assinaturas; dados em terceiros; sem planner único; R5 fica na mão de cada fornecedor; criação no Google não coberta | Rejeitada como base. **Vantagem real**: plugins publicados podem escrever no plano Pro (X1). Fica como plano B para agendar posts via dots, se isso for decisivo. |
| **C. Hub próprio lendo ao vivo** (recomendada): adaptadores Meta/Google no servidor + fila de ações com confirmação + planner em `/no/marketing` + MCP com OAuth do Supabase. Reaproveita `_shared/meta.ts`, `clients`, `ad_accounts` como cadastro de ativos e `scheduled_posts`. | R1–R8 | média | beta do OAuth 2.1 do Supabase; limites de taxa da Meta em modo dev; dots no Pro só leem (X1) | **Escolhida**: é a única que entrega R2, R3 e R5 com controle da nó, e reaproveita o que já existe. |
| **D. Hub próprio com warehouse** (desenho de abril: sync diário de tudo em tabelas) | R1–R8 + histórico próprio | alta | vários crons, esquemas por fonte, divergência entre cópia e origem | Adiada: as APIs já guardam o histórico de que a nó precisa (Meta ~37 meses, GSC 16 meses, GA4 com relatórios agregados). Os adaptadores de C servem a um sync futuro sem mudar interfaces. |

## Solução escolhida

**Opção C.** Uma única Edge Function `marketing-hub` concentra o núcleo e tem duas
portas:

- **`/api/*`**, para o planner. Autentica com a sessão Supabase do Lucca (NO_ADMIN).
  Ação do Lucca no planner executa direto, porque o clique numa tela de revisão é a
  confirmação expressa.
- **`/mcp`**, para agentes. Autentica com token OAuth 2.1 do Supabase (com
  `client_id`). Ferramentas de leitura respondem na hora. Ferramentas de escrita só
  criam **propostas** em `marketing_actions`, e nada toca Meta ou Google até o
  Lucca confirmar em `/no/marketing/aprovacoes`.

Leitura ao vivo com cache curto (TTL de 15–60 min por consulta) para proteger os
limites de taxa. A publicação agendada roda por `pg_cron` a cada 5 minutos e
chama a rota interna de posts vencidos.

**Canal dos dots (X1).** No plano Pro atual, os dots conectados ao MCP da nó
**leem tudo** (R1), mas **não criam propostas**. A escrita por agente funciona com
Claude (conector próprio com escrita) ou com ChatGPT Business. O MCP já nasce com
as ferramentas de escrita; liberar para os dots vira questão de plano, não de
código. **Decisão do Lucca pendente (C1).**

**Limites.** Uma conta de anúncio Meta, uma Page, um IG, uma conta Google Ads, uma
propriedade GA4 e um site no Search Console. Tudo configurado; nada descoberto
dinamicamente.

## Componentes e justificativas

| Componente | Justificativa |
|---|---|
| Credenciais de máquina em secrets da Edge Function: token de **System User** da Meta (sem expiração) + **um** refresh token OAuth Google (escopos Ads, Analytics leitura, Search Console leitura) + developer token + ids de conta | R8; causa raiz do intent (falta de credencial de máquina). Um só token Google porque a API do Google Ads já exige OAuth de usuário. |
| Adaptadores em `supabase/functions/_shared/marketing/` (`meta.ts` reaproveitado + `google-ads.ts`, `ga4.ts`, `gsc.ts`) | R1–R4. Núcleo único para as duas portas, que é a regra do Lucca. |
| Edge Function `marketing-hub` com `/api` e `/mcp` | R7. Um deploy só; as duas portas não divergem. |
| Tabela `marketing_actions` (proposta → confirmada/rejeitada → executando → ok/erro; `requested_by`, `requested_via` planner/mcp, `oauth_client_id`, `confirmed_by`, `payload`, `result`, `external_ids`) | R5 e R6. |
| Reuso de `scheduled_posts` + job `pg_cron` a cada 5 min | R4. A tabela já tem a forma certa; falta o publicador. Com fila própria, o calendário e a confirmação ficam iguais para IG e FB. |
| Reuso de `ad_accounts` como cadastro de ativos, com `access_token` passando a nullable (o token fica no secret) | R8; reaproveitamento (P6); FK de `scheduled_posts`. |
| Migration de segurança: revogar grants de `anon`/`authenticated` nas tabelas Meta legadas e novas | R8; risco E4. |
| Servidor OAuth 2.1 do Supabase + página `/oauth/consent` no app | R7; X2. Evita um sistema de auth paralelo. |
| Planner em `app/src/marketing/` nas rotas `/no/marketing/*`: Visão geral, Campanhas, Calendário, Aprovações, Registro | R1–R6. |
| Supabase Storage (bucket de mídia com URL pública assinada) | R2 e R4. A Meta busca a mídia por URL. |
| Aposentar `oauth-callback`, `refresh-tokens`, `sync-meta-ads` e `sync-meta-organic`, arquivando antes a fonte do `sync-meta-organic` no repo | R8. São endpoints sem uso; `oauth-callback` é público e grava com service role. |

## Fluxo e contratos afetados

- **Leitura**: planner ou agente → `marketing-hub` → cache → adaptador → API
  externa. Resposta normalizada `{fonte, período, métricas, linhas}`.
- **Escrita pelo planner**: formulário → tela de revisão ("vai criar X com
  orçamento Y, status Z") → clique → linha em `marketing_actions` com
  `requested_via=planner` e `confirmed_by=Lucca` → execução → resultado.
- **Escrita pelo agente**: ferramenta MCP → `marketing_actions` com
  `status=proposta` → o planner mostra a pendência → Lucca confirma ou rejeita →
  execução, ou nada.
- **Post agendado**: `scheduled_posts` só entra como `scheduled` depois de
  confirmado → `pg_cron` → publica → `published` com `external_post_id`, ou
  `failed` com o erro.
- Contratos intocados: `painel-dados`, `track-evento`, `meta-capi`, o funil e as
  rotas atuais do app.

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| X1 se confirmar: os dots não escrevem no Pro | O sistema e o Claude cobrem a escrita; decisão C1. |
| Beta do OAuth 2.1 do Supabase muda ou falha com o ChatGPT | Provar no passo 0 com um MCP mínimo. Plano B: header com token estático (só em clientes que aceitam). |
| Explorer Access não permite criar campanha | Provar no passo 0. Se não permitir, pedir Basic Access. A criação Google fica atrás de flag até lá. |
| Refresh token Google expira em 7 dias (X6) | App OAuth em "In production" antes de gerar o token. |
| App Meta `1590026522084626` é do tipo Consumer/"Facebook Login" e não aceita System User e Marketing API | Verificar no passo 0. Se não servir, criar app Business no portfólio da nó. |
| Limites de taxa da Meta em modo dev | Cache + consultas agregadas no nível campanha. |
| Campanha criada errada gasta dinheiro | Tela de revisão obrigatória; padrão de criação `PAUSED`, e ativar é uma ação separada e confirmada. |
| Prompt injection via conteúdo (comentários, nomes de campanha) levando o agente a propor ações | Propostas nunca executam sozinhas; a tela de aprovação mostra o payload completo. |
| Colisão do claim `client_id` | `marketing-hub` usa service role internamente e decide pela presença de `client_id` OAuth; nenhuma policy nova usa esse claim como tenant. |

## Critérios de aceitação

1. `/no/marketing` mostra R1 para "últimos 7 dias" e "mês passado". O gasto Meta de
   dia fechado bate ao centavo com o Ads Manager. GA4, GSC e Google Ads batem com
   os painéis nativos no mesmo período e fuso.
2. Criar pelo planner uma campanha Meta (1 conjunto, 1 anúncio com imagem) resulta
   na campanha no Ads Manager com a mesma configuração, em `PAUSED`. Ativar pelo
   planner muda para `ACTIVE`.
3. Criar pelo planner uma campanha de Pesquisa Google resulta na campanha no Google
   Ads com orçamento, palavras-chave e anúncio corretos, em `PAUSED`.
4. Um post IG (imagem), um reel e um post FB agendados saem em até 5 minutos do
   horário, com `external_post_id` registrado. Um cancelado antes não sai.
5. Conectado ao ChatGPT (dots) e ao Claude, o agente responde à pergunta-exemplo do
   intent sem login do Lucca nas plataformas.
6. Pelo Claude, uma ferramenta de escrita cria uma proposta e **nada** muda na
   Meta/Google até a confirmação. Confirmar executa; rejeitar não executa.
7. Uma chamada ao endpoint de confirmação com token de agente (OAuth) volta 403.
   Com a sessão do Lucca, volta 200.
8. Toda escrita dos critérios 2–4 e 6 tem linha em `marketing_actions` com
   solicitante, confirmador, payload e resultado.
9. `anon` e `authenticated` sem grants nas tabelas de marketing. Nenhum token no
   bundle do app, no repo ou nos logs. O advisor de segurança não aponta nada novo.
10. Os endpoints legados estão desativados, com a fonte arquivada no repo.

## Preocupações e perguntas abertas

- **C1 — Escrita pelos dots.** No Pro, os dots só leem (X1). Aceita assim (escrita
  pelo planner e pelo Claude), ou pretende migrar para ChatGPT Business para que os
  dots também proponham? **Recomendação**: começar assim; o código já suporta os
  dois.
- **C2 — Segundo fator na confirmação.** Exigir TOTP (MFA do Supabase) para
  confirmar propostas e ativar gasto? Isso protege se a sessão do Lucca for aberta
  no navegador de um dot. **Recomendação**: sim; custa uma tela de cadastro de MFA.
- **C3 — Padrão de criação.** Campanha nova sempre nasce `PAUSED` e ativar é um
  segundo passo, mesmo pelo planner? **Recomendação**: sim.
- **C4 — Aposentar o legado de abril.** Pode desativar `oauth-callback`,
  `refresh-tokens` e os dois `sync-*` em produção? **Recomendação**: sim, depois de
  arquivar a fonte.

## Decisão do gate

Pendente, com o Lucca: aprovar, revisar ou rejeitar. As respostas de C1–C4 entram
aqui.
