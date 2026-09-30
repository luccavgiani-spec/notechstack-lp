---
movement_id: hub-marketing-agentes
status: draft
owner: Lucca
created: 2026-09-30
updated: 2026-09-30
---

# Intent: marketing da nó operável por agentes

## O problema em uma frase

Ler o desempenho de marketing da nó e agir sobre ele (campanhas, posts) depende
de sessões pessoais do Lucca em quatro painéis separados — Meta Ads Manager, GA4,
Search Console e Google Ads —, e nenhum agente consegue ler ou operar esses dados
sem essas sessões.

## Por que isso é um problema

`estado observado` → os dados estão espalhados em painéis nativos; o site já emite
tudo (GTM, GA4, Google Ads, Pixel + CAPI), mas nada volta consolidado.
`mecanismo` → o acesso é por login interativo pessoal (2FA, sessão de navegador); um
agente só alcança isso por automação de navegador, que é frágil e não auditável.
`consequência` → análise e operação ficam presas ao tempo do Lucca; o que um agente
"vê" não é reproduzível nem tem rastro.
`impacto` → **hipótese**: decisões de verba atrasadas e cadência de posts irregular
(ver P2).
`urgência` → **hipótese**: a confirmar (ver P2).

## Evidências

| # | Evidência | Tipo | Fonte | Confiança |
|---|---|---|---|---|
| E1 | Já existe um backend Meta ("nó hub — Fase 1"): OAuth, sync diário de Ads, sync orgânico IG/FB, refresh de tokens e fila `scheduled_posts`. As quatro funções estão ACTIVE desde 23/04/2026. | fato | `supabase/README.md`; `list_edge_functions` em produção | alta |
| E2 | Em 30/09/2026, `ad_accounts`, `ad_metrics_daily`, `social_metrics_daily`, `scheduled_posts` e `sync_logs` têm **0 linhas**. Nenhuma conta foi conectada e nenhum sync rodou. | fato | SELECT somente leitura no projeto `sdeowbqmwkwseyktyemn` | alta |
| E3 | O R1-02 trata esse backend como "produto Meta pausado" e apenas isolou riscos (views `thais_*`). | fato | `supabase/migrations/20260915185953_r1_02_isolate_legacy_risks.sql:1`; `.checks/r1-02-legado-seguranca.md` | alta |
| E4 | `anon` tem SELECT/INSERT/UPDATE/DELETE em `ad_accounts`, a tabela que guarda `access_token`. A RLS está ligada e não há policy para `anon`, então hoje nada vaza (e a tabela está vazia). Consta como "Unresolved 4" no R1-02. | fato | `information_schema.role_table_grants` + `pg_policy` | alta |
| E5 | O site já instrumenta GTM `GTM-NK87FH8W`, Google Ads `AW-17683211415`, Pixel `1753619075655271` + CAPI server-side e tem verificação do Search Console. Há 4 IDs GA4 no repo; falta confirmar qual é o da nó. | fato | grep no repo; `supabase/functions/meta-capi/index.ts` | alta |
| E6 | Já existe um padrão de painel próprio com a chave no servidor e um token de leitura (`painel-dados`), usado para o funil de leads. | fato | `supabase/functions/painel-dados/index.ts` | alta |
| E7 | A tentativa anterior não parou por falta de código: parou antes do primeiro OAuth (Tester, App Review ou prioridade). | inferência | E1 + E2; a causa não foi registrada | média |
| E8 | O Windsor.ai cobre principalmente a leitura (conector de dados). Criar e editar campanhas ou agendar posts não é o foco dele. | hipótese | a verificar no Gate 2 | baixa |
| E9 | Hoje existe verba ativa em Meta ou Google Ads da nó, e o Lucca gasta tempo recorrente nos painéis. | hipótese | P2 | — |

## Quem é afetado e como

- **Lucca**, operador único do marketing da nó, sempre que precisa de um número
  consolidado ou de publicar e ajustar algo.
- **Agentes** (ChatGPT, Claude) que o Lucca quer usar como analistas e operadores:
  hoje não têm acesso autorizado e estável.
- **Clientes da nó**: só entram se P1 incluir ativos de terceiros (o backend de
  abril foi desenhado multi-cliente, com a Thais como piloto).

## Estado atual e workaround

- Login manual em cada painel; o cruzamento dos dados é feito na cabeça ou em
  planilha. **Hipótese**, a confirmar em P2.
- O workaround sugerido foi terceirizar a leitura ao Windsor.ai. O custo é uma
  assinatura, os dados passam por um terceiro e a escrita provavelmente não fica
  resolvida (E8).
- O backend de abril está no ar, sem uso, carregando o risco E4.

## Causa, não apenas sintoma

- **Sintoma**: "preciso logar em vários lugares".
- **Causa**: a nó não tem **credenciais de máquina** (não pessoais, não
  interativas) para Meta e Google, nem um lugar controlado que as guarde e
  exponha leitura e escrita com limites e rastro.
- **Causa secundária aberta**: por que o piloto de abril parou (P6). Se foi
  bloqueio da Meta (App Review ou permissões), o mesmo bloqueio volta.

## Custo de não agir

A operação continua manual e dependente do Lucca. Agentes ficam restritos a
automação de navegador ou a um terceiro pago. O código de abril continua
envelhecendo sem uso e com o grant de E4. Não há números de tempo ou verba
perdidos; ver P2.

## Resultado desejado

O Lucca, e agentes autorizados por ele, conseguem, **sem sessão de navegador**:

1. ler o desempenho consolidado de Meta Ads, orgânico IG/FB, GA4 e Search Console
   (e Google Ads, se P5 confirmar);
2. agendar e publicar posts no IG/FB da nó;
3. criar, editar e pausar campanhas pagas, dentro de limites definidos por ele e
   com registro de cada ação.

## Sinais de sucesso

- Um agente responde, sem login do Lucca, "quanto a nó gastou e quantos leads
  vieram da Meta nos últimos 7 dias, e quais páginas mais cresceram no Search
  Console", com números que batem com os painéis nativos (tolerância a definir no
  Gate 2).
- Um post agendado por agente sai no horário marcado.
- Uma campanha criada por agente aparece no Ads Manager no estado combinado (ver
  P3).
- Toda escrita tem registro de quem, quando, o quê e o resultado.
- Nenhuma credencial em HTML, frontend, arquivo, chat ou commit.

## Restrições

- Credenciais só no servidor (secrets do Supabase ou Vault), no mesmo padrão do
  `painel-dados`. O risco E4 precisa estar resolvido antes de qualquer token cair
  em `ad_accounts`.
- Escrita em campanha mexe com dinheiro real, então o blast radius é financeiro.
- Políticas da Meta: nada de categoria de saúde em eventos (ver comentário em
  `meta-capi`). Tocar ativos de terceiros exige App Review/Advanced Access.
- Stack existente: Supabase `sdeowbqmwkwseyktyemn` + app React/Vercel. Qualquer UI
  segue a identidade v2 (`brand/BRAND.md`).
- As contas e credenciais são criadas pelo Lucca. Esta sessão na nuvem não tem
  acesso ao navegador dele.

## Fora de escopo

- Vender ou oferecer isto como produto para clientes (salvo se P1 disser o
  contrário).
- TikTok, LinkedIn e YouTube.
- Geração de criativos por IA.
- Mudar o tracking do site (GTM, CAPI, pixel).

## Perguntas abertas

Materiais, porque cada resposta muda a solução:

- **P1 — De quem são as contas?** Só os ativos da própria nó, ou também os de
  clientes? Só da nó permite token de System User no Business Manager, app em modo
  desenvolvimento e nenhum App Review. Com clientes, o fluxo vira OAuth
  multi-cliente, App Review da Meta e verificação do app Google.
- **P2 — Qual é a dor concreta?** Há verba ativa hoje em Meta ou Google Ads da nó?
  Com que frequência você abre esses painéis? O que deixou de ser decidido ou
  publicado nas últimas semanas por causa disso?
- **P3 — Quanta autonomia o agente tem na escrita?** Publica direto, ou cria como
  rascunho/PAUSADA para você aprovar? Existe teto de verba por ação?
- **P4 — Qual agente precisa conectar primeiro?** ChatGPT (qual produto
  exatamente?), Claude, ou ambos?
- **P5 — O Google Ads entra?** A tag `AW-17683211415` existe no site. A API do
  Google Ads exige developer token aprovado.
- **P6 — Por que o piloto Meta de abril parou?** Foi saída do cliente, bloqueio
  da Meta ou prioridade?

## Decisão do gate

Pendente, com o Lucca. Recomendação do Guide: aprovar depois das respostas de
P1–P3. P4–P6 podem ser respondidas no início do Gate 2.
