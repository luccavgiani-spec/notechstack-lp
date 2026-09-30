---
movement_id: hub-marketing-agentes
intent: ./intent.md
intent_revision: e7826fc
status: draft
updated: 2026-09-30
revision: 2 — canal do agente deixa de ser MCP e passa a ser o próprio planner, pelo navegador do dot (pedido do Lucca em 30/09)
---

# Spec: marketing da nó num lugar só, operável por agentes

## Contrato com o problema

A solução precisa acabar com duas coisas: a leitura fragmentada em cinco painéis
com login pessoal, e a impossibilidade de delegar a um agente. A resposta é **um
planner único onde tudo se vê e tudo se faz**.

- O Lucca opera por lá.
- O dot opera **o mesmo planner**, pelo computador e navegador próprios, com login
  próprio, como uma pessoa.
- Não há canal separado para agentes. O planner é a única porta, e as regras de
  permissão ficam no servidor, por conta de usuário.

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
- **App** (`app/`, React + Supabase Auth):
  - rotas `/no/*` protegidas por `RoleRoute role="NO_ADMIN"`
    (`app/src/App.tsx:43`, `app/src/auth/RoleRoute.tsx`), com papel em
    `app_metadata.role`;
  - signup desligado (`supabase/config.toml`: `enable_signup = false`), então
    contas só nascem por admin;
  - as áreas `/no/projetos`, `/no/saldos` e `/no/biblioteca` têm dados de clientes
    e financeiros.
- **Padrão de segredo no servidor** já usado: `painel-dados` com secret +
  `META_APP_SECRET`.
- **Extensões**: `pg_net` e `supabase_vault` ativos; `pg_cron` **não**.
- **Funil próprio**: tabelas `leads`, `lead_sessoes` e `lead_eventos` (fonte de
  verdade de lead da nó; têm dados pessoais).
- **Tags do site**: GA4 `G-1YEB89RVER` (com vínculo ao Google Ads, conforme Q3),
  Google Ads `AW-17683211415`, Pixel `1753619075655271`, portfólio Meta
  `990413650211777` (comentário em `meta-capi`).

### Fatos externos que mudam a solução

| # | Fato | Fonte | Confiança |
|---|---|---|---|
| X1 | No **ChatGPT Pro**, apps MCP próprios são **só leitura/fetch**. Isso faz de um conector MCP um caminho pior que o navegador para o dot operar. | resumos de busca de 30/09 que citam a central de ajuda da OpenAI; as páginas não abriram (proxy de rede). Entre os resultados: [flaviocopes — dots](https://flaviocopes.com/openai-dots/), [coworker.ai — ChatGPT MCP](https://coworker.ai/blog/chatgpt-mcp) | média-alta |
| X2 | Cada dot trabalha num **computador na nuvem com navegador próprio**, e o usuário pode abrir essa máquina para inspecionar. Os dots fazem "auto-review" de ações que afetam contas. Primeiro dot incluso no Pro. | [OpenAI — Introducing dots](https://openai.com/index/introducing-dots/); [9to5google](https://9to5google.com/2026/09/29/openai-dots-agent/) | média (produto com um dia de vida) |
| X3 | O developer token do Google Ads sai de uma **conta de administrador (MCC)** e nasce em **Explorer Access**: contas reais, 2.880 operações/dia, sem revisão. | [Google Ads API — Access levels](https://developers.google.com/google-ads/api/docs/access-levels?hl=en) | alta; confirmar que o Explorer permite criar campanha |
| X4 | O GA4 expõe custo, cliques e impressões do Google Ads vinculado (`advertiserAdCost` etc.) na Data API. | conhecimento prévio da documentação GA4 Data API (não reaberta hoje) | média-alta; provar no passo 0 |
| X5 | Um app Google com OAuth em status **"Testing"** tem refresh tokens que expiram em 7 dias. Em "In production" isso não acontece. | conhecimento prévio da documentação Google OAuth (não reaberta hoje) | média-alta |

## Requisitos

| # | Requisito | Origem |
|---|---|---|
| R1 | Ler, num período escolhido: Meta Ads (gasto, alcance, cliques, leads), Google Ads (gasto, cliques, conversões), GA4 (sessões e eventos-chave por canal), Search Console (cliques, impressões, consultas e páginas), IG/FB orgânico (seguidores, alcance, engajamento por post) e contagem de leads do funil próprio. | resultado 1 |
| R2 | Criar, editar (orçamento, status, datas) e pausar/ativar campanhas **Meta** (campanha + conjunto + anúncios com imagem ou vídeo). | resultado 3 |
| R3 | Criar, editar (orçamento, status) e pausar/ativar campanhas **Google Ads de Pesquisa** (orçamento, lances, locais, grupo, palavras-chave, anúncio responsivo). | resultado 3 + Q2 |
| R4 | Agendar, publicar e cancelar posts no IG (feed, carrossel, reels) e no FB, com calendário. | resultado 2 |
| R5 | Nada é publicado nem gasta dinheiro sem **confirmação expressa do Lucca**, na forma decidida em C1. | P3 |
| R6 | Registro de toda escrita: quem fez (Lucca ou dot), quem confirmou, payload, resultado e ids externos. | sinais de sucesso |
| R7 | **Tudo que o Lucca faz no planner, o dot consegue fazer pela mesma tela**, operando por navegador. A interface precisa ser legível e operável por agente. | P4 revisado + "se o sistema consegue, o agente também" |
| R8 | Credenciais das plataformas só no servidor; `anon`/`authenticated` sem acesso a tabelas com dados sensíveis. | restrições |
| R9 | A conta do dot enxerga **só o planner de marketing**: nada de projetos de clientes, saldos, biblioteca ou dados pessoais de leads. | menor privilégio |

## Restrições e invariantes

- Só ativos da nó. Nenhum OAuth de terceiro e nenhum App Review como
  pré-requisito.
- O dot tem **conta própria**. Nunca usa o login do Lucca, para que o servidor
  distinga quem fez o quê.
- As permissões são decididas no servidor pelo papel da conta, nunca só pela
  interface.
- Tracking do site (GTM, CAPI, pixel) intocado. Funil de leads (`painel-dados`,
  `track-evento`) intocado.
- Identidade v2 (`brand/BRAND.md`, `brand/tokens/tokens.css`) no planner, que
  também precisa funcionar no celular (a aprovação pode ser feita no telefone).
- Nada de categoria de saúde em payload de anúncio ou evento (política Meta; ver
  `meta-capi`).

## Não objetivos

- Servidor MCP ou API dedicada a agentes (rejeitado pelo Lucca; ver opção E).
- Data warehouse ou histórico próprio de métricas (lê ao vivo; ver opção D).
- Performance Max, Display, YouTube e Shopping no Google. Advantage+ catálogo na
  Meta.
- Geração de criativo por IA. Aprovação por WhatsApp ou e-mail.
- Multi-cliente.

## Opções consideradas

| Opção | Resolve o quê | Complexidade | Riscos | Motivo da decisão |
|---|---|---|---|---|
| **A. Manter como está** | nada | zero | a dor continua | Rejeitada: não atende R1–R7. |
| **B. Montar com terceiros**: Windsor.ai + agendador de posts + ferramenta de Ads de terceiro | R1 parcial, R4; R2 talvez; R3 não | baixa para começar | 2–3 assinaturas; dados em terceiros; sem planner único; R5 fica na mão de cada fornecedor | Rejeitada: não entrega o planner único, que é a dor central (P2). |
| **C. Planner próprio operado por pessoa e por dot** (recomendada): adaptadores Meta/Google no servidor, leitura ao vivo, `/no/marketing` completo, conta própria do dot com papel restrito, trava de confirmação por papel no servidor. Reaproveita `_shared/meta.ts`, `clients`, `ad_accounts` como cadastro e `scheduled_posts`. | R1–R9 | média | agente de navegador é mais lento e sensível a mudanças de tela; sessão do dot fica na nuvem da OpenAI | **Escolhida**: uma porta só, sem o limite do Pro (X1), e o dot fica com o mesmo poder que a interface dá a ele. |
| **D. C + warehouse** (desenho de abril: sync diário de tudo em tabelas) | C + histórico próprio | alta | vários crons, divergência entre cópia e origem | Adiada: as plataformas já guardam o histórico de que a nó precisa. Os adaptadores de C servem a um sync futuro. |
| **E. C + porta MCP para agentes** (spec rev. 1) | C + respostas rápidas por ferramenta | média-alta | OAuth 2.1 em beta; no Pro, só leitura (X1) | Rejeitada pelo Lucca em 30/09: o dot já opera o planner pelo navegador. Um MCP só de leitura pode voltar depois, se o dot se mostrar lento para responder perguntas. |

## Solução escolhida

**Opção C.** O planner em `/no/marketing` é a única porta, para o Lucca e para o
dot. Ele conversa com uma Edge Function `marketing-hub` (autenticada pela sessão
Supabase), que concentra os adaptadores e aplica as permissões por papel.

**Contas e papéis:**

| Conta | Papel | Enxerga | Escreve |
|---|---|---|---|
| Lucca | `NO_ADMIN` (já existe) | tudo, incluindo o planner | tudo. O clique numa tela de revisão ("vai criar X, orçamento Y, status Z") é a confirmação expressa. |
| Dot | `MARKETING_AGENT` (novo) | só `/no/marketing/*`; leads só em contagem | conforme **C1**: tudo; ou tudo menos o que publica ou gasta, que fica "aguardando o Lucca" |

**Leitura ao vivo com cache curto** (TTL de 15–60 min por consulta) para proteger
os limites de taxa.

**Publicação agendada** por `pg_cron` a cada 5 minutos, chamando a rota interna
de posts vencidos.

**Planner feito para agente de navegador** (R7), porque o que é bom para o dot
também é bom para acessibilidade:

- botões e campos com rótulo em texto;
- todo número também em tabela de texto, não só em gráfico;
- URLs diretas por tela e período (`/no/marketing/visao-geral?periodo=7d`);
- calendário com alternativa por formulário (nada que dependa só de arrastar);
- telas de revisão explícitas antes de qualquer escrita;
- mensagens de resultado com o id criado.

**Limites.** Uma conta de anúncio Meta, uma Page, um IG, uma conta Google Ads, uma
propriedade GA4 e um site no Search Console. Tudo configurado; nada descoberto
dinamicamente.

## Componentes e justificativas

| Componente | Justificativa |
|---|---|
| Credenciais de máquina em secrets da Edge Function: token de **System User** da Meta (sem expiração) + **um** refresh token OAuth Google (escopos Ads, Analytics leitura, Search Console leitura) + developer token + ids de conta | R8; causa raiz do intent. Um só token Google porque a API do Google Ads já exige OAuth de usuário. |
| Adaptadores em `supabase/functions/_shared/marketing/` (`meta.ts` reaproveitado + `google-ads.ts`, `ga4.ts`, `gsc.ts`) | R1–R4. |
| Edge Function `marketing-hub` (sessão Supabase; checa o papel em cada rota) | R5, R7, R9: a trava fica no servidor. |
| Papel `MARKETING_AGENT` + conta do dot criada por admin + `RoleRoute` aceitando lista de papéis só em `/no/marketing` | R7 e R9. Hoje o `RoleRoute` só aceita `NO_ADMIN`. |
| Tabela `marketing_actions` (quem fez, papel, status: executada / aguardando Lucca / aprovada / rejeitada / erro; `payload`, `result`, `external_ids`, `confirmed_by`) | R5 e R6. A fila "aguardando o Lucca" só é usada se C1 = (b). |
| Reuso de `scheduled_posts` + job `pg_cron` a cada 5 min | R4. A tabela já tem a forma certa; falta o publicador. |
| Reuso de `ad_accounts` como cadastro de ativos, com `access_token` passando a nullable (o token fica no secret) | R8; reaproveitamento (P6); FK de `scheduled_posts`. |
| Migration de segurança: revogar grants de `anon`/`authenticated` nas tabelas Meta legadas e novas | R8; risco E4. |
| Planner em `app/src/marketing/`: Visão geral, Campanhas (Meta e Google), Calendário, Aprovações, Registro | R1–R7. |
| Supabase Storage (bucket de mídia com URL assinada) | R2 e R4. A Meta busca a mídia por URL; o dot sobe arquivos pelo mesmo formulário. |
| Aposentar `oauth-callback`, `refresh-tokens`, `sync-meta-ads` e `sync-meta-organic`, arquivando antes a fonte do `sync-meta-organic` no repo | R8. São endpoints sem uso; `oauth-callback` é público e grava com service role. |

## Fluxo e contratos afetados

- **Leitura**: planner → `marketing-hub` → cache → adaptador → API externa.
- **Escrita pelo Lucca**: formulário → tela de revisão → clique → execução →
  linha em `marketing_actions` com o resultado.
- **Escrita pelo dot**: o mesmo formulário e a mesma revisão → clique → o servidor
  olha o papel:
  - C1 = (a): executa;
  - C1 = (b): se publica ou gasta, grava "aguardando o Lucca" e mostra isso ao
    dot; o resto executa.
- **Post agendado**: entra como `scheduled` (direto, ou depois da aprovação se
  C1 = b) → `pg_cron` → publica → `published` com `external_post_id`, ou `failed`
  com o erro.
- Contratos intocados: `painel-dados`, `track-evento`, `meta-capi`, o funil e as
  demais rotas do app.

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| O dot erra na interface (clica no lugar errado, lê número errado) | Telas de revisão explícitas; tabela em texto; padrão `PAUSED` (C3); registro de tudo; o Lucca pode abrir o computador do dot e ver o que ele fez (X2). |
| A sessão da conta do dot fica na nuvem da OpenAI | Papel mínimo (R9). Desativar a conta corta o acesso na hora. Se C1 = (b), nada que gaste passa sem o Lucca. |
| O Lucca entra com a conta dele no navegador do dot | Regra de uso + segundo fator na conta do Lucca (C2). |
| Prompt injection via conteúdo exibido no planner (comentários, nomes de campanha) levando o dot a agir | Com C1 = (b), gasto e publicação sempre passam pelo Lucca. Textos de terceiros aparecem como dado, sem campos "de instrução". |
| Uma mudança de layout quebra o hábito do dot | Rótulos e URLs estáveis são contrato do planner, e mudança deles vira item de revisão. |
| Explorer Access não permite criar campanha | Provar no passo 0. Se não permitir, pedir Basic Access. A criação Google fica atrás de flag até lá. |
| Refresh token Google expira em 7 dias (X5) | App OAuth em "In production" antes de gerar o token. |
| App Meta `1590026522084626` é do tipo Consumer/"Facebook Login" e não aceita System User e Marketing API | Verificar no passo 0. Se não servir, criar app Business no portfólio da nó. |
| Limites de taxa da Meta em modo dev | Cache + consultas agregadas no nível campanha. |

## Critérios de aceitação

1. `/no/marketing` mostra R1 para "últimos 7 dias" e "mês passado", em gráfico e em
   tabela de texto. O gasto Meta de dia fechado bate ao centavo com o Ads Manager.
   GA4, GSC e Google Ads batem com os painéis nativos no mesmo período e fuso.
2. Pelo planner, o Lucca cria uma campanha Meta (1 conjunto, 1 anúncio com imagem).
   Ela aparece no Ads Manager com a mesma configuração, em `PAUSED`. Ativar pelo
   planner muda para `ACTIVE`.
3. Pelo planner, o Lucca cria uma campanha de Pesquisa Google. Ela aparece no Google
   Ads com orçamento, palavras-chave e anúncio corretos, em `PAUSED`.
4. Um post IG (imagem), um reel e um post FB agendados saem em até 5 minutos do
   horário, com `external_post_id` registrado. Um cancelado antes não sai.
5. **O dot, logado com a conta própria**, responde à pergunta-exemplo do intent
   lendo o planner, sem login do Lucca em nenhuma plataforma.
6. **O dot cria pelo planner** uma campanha Meta, uma campanha Google e um post
   agendado. O comportamento segue C1: com (a), executa; com (b), o que publica ou
   gasta fica "aguardando o Lucca" e nada muda na Meta/Google até a aprovação.
7. A conta do dot recebe 403 no servidor ao tentar `/no/projetos`, `/no/saldos`, os
   dados pessoais de leads e (se C1 = b) a rota de aprovação.
8. Toda escrita dos critérios 2–4 e 6 tem linha em `marketing_actions` com autor,
   papel, confirmador, payload e resultado.
9. `anon` e `authenticated` sem grants nas tabelas de marketing. Nenhum token no
   bundle do app, no repo ou nos logs. O advisor de segurança não aponta nada novo.
10. Os endpoints legados estão desativados, com a fonte arquivada no repo.

## Preocupações e perguntas abertas

- **C1 — Poder do dot.**
  - (a) Mesmo poder que você: o dot cria, ativa e publica. A "confirmação
    expressa" é você dizer ao dot no chat, e o servidor não tem como verificar
    isso.
  - (b) O dot faz tudo, mas o que **publica ou gasta** fica "aguardando o Lucca"
    no planner, e você aprova com um clique (também no celular). É como um
    funcionário que monta tudo e pede o ok do gestor.
  - **Recomendação**: (b). É a única forma de o servidor garantir a regra P3.
- **C2 — Segundo fator na sua conta.** Exigir código de app autenticador (MFA do
  Supabase) no seu login e nas aprovações? Isso protege se sua sessão for aberta no
  navegador de um dot. **Recomendação**: sim.
- **C3 — Padrão de criação.** Campanha nova sempre nasce `PAUSED`, e ativar é um
  segundo passo? **Recomendação**: sim.
- **C4 — Aposentar o legado de abril.** Pode desativar `oauth-callback`,
  `refresh-tokens` e os dois `sync-*` em produção? **Recomendação**: sim, depois de
  arquivar a fonte.

## Decisão do gate

Pendente, com o Lucca: aprovar, revisar ou rejeitar. As respostas de C1–C4 entram
aqui.
