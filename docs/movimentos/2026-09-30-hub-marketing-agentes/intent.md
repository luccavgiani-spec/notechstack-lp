---
movement_id: hub-marketing-agentes
status: in_review
owner: Lucca
created: 2026-09-30
updated: 2026-09-30
---

# Intent: marketing da nó num lugar só, operável por agentes

## O problema em uma frase

As informações de tráfego, conversão e social media da nó estão espalhadas em
painéis separados (Meta Ads Manager, Instagram/Facebook, GA4, Search Console e
Google Ads), cada um atrás do login pessoal do Lucca. Por isso não existe um lugar
único para acompanhar e planejar, e nenhum agente consegue ler ou agir sobre
esses dados.

## Por que isso é um problema

`estado observado` → o site emite tudo (GTM, GA4, Google Ads, Pixel + CAPI), mas
nada volta consolidado; cada leitura é feita dentro de um painel diferente.
`mecanismo` → o acesso é por login interativo pessoal. Um agente só alcança isso
por automação de navegador, que é frágil e não deixa rastro.
`consequência` → o Lucca não consegue organizar tráfego, conversão e social media
num só planner. Análise e operação ficam presas ao tempo dele.
`impacto` → o planejamento de marketing da nó não tem visão única e não pode ser
delegado a agente.
`urgência` → a OpenAI lançou os dots em 29/09/2026 (agentes sempre ligados que
se conectam a apps externos), e o Lucca quer delegar a eles essa operação agora.

## Evidências

| # | Evidência | Tipo | Fonte | Confiança |
|---|---|---|---|---|
| E1 | Já existe um backend Meta ("nó hub — Fase 1"): OAuth, sync diário de Ads, sync orgânico IG/FB, refresh de tokens e fila `scheduled_posts`. As quatro funções estão ACTIVE desde 23/04/2026. | fato | `supabase/README.md`; `list_edge_functions` em produção | alta |
| E2 | Em 30/09/2026, `ad_accounts`, `ad_metrics_daily`, `social_metrics_daily`, `scheduled_posts` e `sync_logs` têm **0 linhas**. Nenhuma conta foi conectada e nenhum sync rodou. | fato | SELECT somente leitura no projeto `sdeowbqmwkwseyktyemn` | alta |
| E3 | O R1-02 trata esse backend como "produto Meta pausado" e apenas isolou riscos (views `thais_*`). | fato | `supabase/migrations/20260915185953_r1_02_isolate_legacy_risks.sql:1` | alta |
| E4 | `anon` tem SELECT/INSERT/UPDATE/DELETE em `ad_accounts`, a tabela que guarda `access_token`. A RLS está ligada e não há policy para `anon`, então hoje nada vaza (e a tabela está vazia). Consta como "Unresolved 4" no R1-02. | fato | `information_schema.role_table_grants` + `pg_policy` | alta |
| E5 | O site já instrumenta GTM `GTM-NK87FH8W`, Google Ads `AW-17683211415`, Pixel `1753619075655271` + CAPI server-side e tem verificação do Search Console. O GA4 da nó é `G-1YEB89RVER`; os outros três "IDs" do grep são falsos positivos dentro de um PDF. | fato | grep no repo; `tracking/gtm-compra-diagnostico.json`; `supabase/functions/meta-capi/index.ts` | alta |
| E6 | Já existe um padrão de painel próprio com a chave no servidor e um token de leitura (`painel-dados`), usado para o funil de leads. | fato | `supabase/functions/painel-dados/index.ts` | alta |
| E7 | O piloto Meta de abril parou por escolha do Lucca, não por bloqueio da Meta. Foi desenhado para outra cliente e pode ser reaproveitado. | fato | resposta do Lucca, 30/09 (P6) | alta |
| E8 | A dor declarada é organizar tráfego, conversão e social media num só planner. | fato | resposta do Lucca, 30/09 (P2) | alta |
| E9 | Os dots da OpenAI (29/09/2026) rodam em planos Pro e Business Premium. Eles se conectam a apps externos, e integrações próprias entram como servidor MCP remoto (HTTPS + OAuth), via Developer Mode ou plugin. | fato externo | [betanews](https://betanews.com/article/openai-dots-agents-chatgpt/); [help.openai.com — Developer mode e MCP apps](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt) | média (produto com um dia de vida) |
| E10 | O GTM **envia** conversões ao Google Ads, mas **não dá leitura** de gasto e desempenho nem cria campanhas. A leitura pode vir do vínculo Google Ads ↔ GA4 (custo, cliques e impressões na API do GA4). A escrita exige a API do Google Ads, cujo developer token já nasce em "Explorer Access" (contas reais, 2.880 operações/dia, sem revisão). | fato externo | [Google Ads API — níveis de acesso](https://developers.google.com/google-ads/api/docs/access-levels?hl=en) | alta. **Hipótese**: que o Google Ads da nó está vinculado ao GA4. |
| E11 | O Windsor.ai cobre principalmente a leitura (conector de dados). Criar e editar campanhas ou agendar posts não é o foco dele. | hipótese | a verificar no Gate 2 | baixa |

## Quem é afetado e como

- **Lucca**, operador único do marketing da nó: não tem uma visão única para
  planejar, e toda leitura ou ação passa por ele.
- **Agentes** (prioridade: dots da OpenAI; Claude e similares depois): hoje não têm
  acesso autorizado e estável aos dados nem às ações.

## Estado atual e workaround

- O Lucca faz login manual em cada painel, sem um planner que junte tudo.
- O workaround sugerido foi terceirizar a leitura ao Windsor.ai. O custo é uma
  assinatura, os dados passam por um terceiro e a escrita provavelmente não fica
  resolvida (E11).
- O backend de abril está no ar, sem uso e reaproveitável (E1, E7), mas carrega o
  risco E4.

## Causa, não apenas sintoma

- **Sintoma**: "preciso logar em vários lugares e juntar na mão".
- **Causa**: a nó não tem **credenciais de máquina** (não pessoais, não
  interativas) para Meta e Google, nem um lugar controlado que guarde esses dados
  consolidados e exponha leitura e escrita com limites e rastro.
- A causa não é falta de código Meta (E1) nem bloqueio da Meta (E7).

## Custo de não agir

A operação continua manual e sem visão única. Agentes ficam restritos a automação
de navegador ou a um terceiro pago. O código de abril continua sem uso e com o
grant de E4.

## Resultado desejado

O Lucca, e agentes autorizados por ele, têm **um lugar só** onde, sem sessão de
navegador:

1. veem juntos tráfego pago (Meta Ads, Google Ads), conversão (GA4, leads) e social
   media (IG/FB orgânico e Search Console);
2. planejam e agendam posts no IG/FB da nó, com calendário;
3. criam, editam e pausam campanhas pagas. Qualquer ativação, publicação ou gasto
   só acontece depois de **confirmação expressa do Lucca**.

## Sinais de sucesso

- O Lucca abre um único planner e vê gasto, leads/conversões e desempenho social
  do período, sem abrir os painéis nativos.
- Um dot responde, sem login do Lucca, "quanto a nó gastou e quantos leads vieram
  da Meta e do Google nos últimos 7 dias, e quais páginas mais cresceram no Search
  Console", com números que batem com os painéis nativos (tolerância a definir no
  Gate 2).
- Um post agendado por agente sai no horário marcado.
- Uma campanha criada por agente fica parada até o Lucca confirmar, e só depois
  passa a veicular.
- Toda escrita tem registro de quem, quando, o quê, quem confirmou e o resultado.
- Nenhuma credencial em HTML, frontend, arquivo, chat ou commit.

## Restrições

- **Só ativos da nó** (P1). Nada de OAuth de terceiros nem App Review como
  pré-requisito.
- **Sem teto de verba**, mas nenhuma ação que publique ou gaste roda sem
  confirmação expressa do Lucca (P3). A confirmação precisa ser garantida pelo
  servidor, não só pelo agente ou pelo modal do ChatGPT.
- Credenciais só no servidor (secrets do Supabase ou Vault), no mesmo padrão do
  `painel-dados`. O risco E4 precisa estar resolvido antes de qualquer token cair
  em `ad_accounts`.
- Reaproveitar o backend de abril sempre que ele servir (P6).
- Políticas da Meta: nada de categoria de saúde em eventos (ver comentário em
  `meta-capi`).
- Stack existente: Supabase `sdeowbqmwkwseyktyemn` + app React/Vercel. Qualquer UI
  segue a identidade v2 (`brand/BRAND.md`).
- As contas e credenciais são criadas pelo Lucca. Esta sessão na nuvem não tem
  acesso ao navegador dele.

## Fora de escopo

- Clientes da nó, multi-cliente, white-label ou venda como produto.
- TikTok, LinkedIn e YouTube.
- Geração de criativos por IA.
- Mudar o tracking do site (GTM, CAPI, pixel).

## Respostas do Lucca (30/09/2026)

| Pergunta | Resposta | Consequência |
|---|---|---|
| P1 — de quem são as contas | só da nó | Token de System User do Business Manager e app em modo desenvolvimento; sem App Review. |
| P2 — a dor | organizar tráfego, conversão e social num só planner | O problema central é a **consolidação**; a operação por agente vem em cima dela. |
| P3 — autonomia | sem teto de verba; libera tudo com confirmação expressa | Toda escrita que publica ou gasta passa por um passo de confirmação do Lucca. |
| P4 — agente | dots da OpenAI | A interface para agentes precisa ser um servidor MCP remoto com OAuth (E9). |
| P5 — Google Ads | entra; Lucca acha que "por GTM é melhor" | Correção em E10: o GTM não lê nem opera. Leitura via GA4 (se vinculado) ou API do Google Ads. |
| P6 — piloto de abril | abandonado por escolha; reaproveitar tudo | Ponto de partida do Gate 2 é o backend existente. |

## Perguntas abertas

Nenhuma bloqueia o Gate 1; todas ficam para o Gate 2:

- **Q1 — Plano do ChatGPT.** Sua conta é Pro ou Business Premium? Os dots só
  existem nesses planos (E9).
- **Q2 — Google Ads na primeira entrega.** Basta ler gasto e conversões (via GA4),
  ou o agente já precisa criar e editar campanhas Google? A escrita exige API +
  developer token.
- **Q3 — Vínculo Google Ads ↔ GA4.** O Google Ads da nó está vinculado ao GA4
  `G-1YEB89RVER`? Isso define se a leitura do Google Ads sai sem a API dele.

## Decisão do gate

Aguardando aprovação expressa do Lucca para passar ao Gate 2 (spec).
