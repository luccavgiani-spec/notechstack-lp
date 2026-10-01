# Melhorias do painel de marketing — 1ª entrega (itens 1–5 e datas do item 8)

> Build this with **tlc-implement**. Execução coordenada pelo Claude central (ver `.tasks/acompanhamento.md`).
> Every criterion below becomes a check with a proof, referenced by its number. Nothing under
> `Unresolved` gets settled while building.

## Intent

O painel mostra números que levam a decisões erradas. Dados do documento do Lucca + dot, inspeção de 30/09/2026:

- **CPL falso.** O card "Custo por lead" mostra R$17,26, que é R$172,64 ÷ 10 registros. Os 10 são testes:
  zero leads reais. `contarLeads` (`_shared/marketing/leads.ts`) conta todo registro de `leads`.
- **Resultado otimizado invisível.** O conjunto da campanha "TRAF - 20d - Agencias" otimiza
  `LANDING_PAGE_VIEWS`, mas `META_LEAD_ACTION_TYPES` (`normalize.ts`) guarda só ações de lead. O resultado
  que a Meta otimiza nunca aparece.
- **Soma enganosa.** O card "Gasto em anúncios" diz "Meta + Google", mas, quando o Google falha, soma só a
  Meta (`OverviewPage.tsx`, `gasto = … + (google_ads.ok ? … : 0)`).
- **Dados que somem sem aviso.** Falhas de insight orgânico viram `null` em silêncio (`tentar` em `meta.ts`).
- **Conexões sem diagnóstico.** O Google devolve `unauthorized_client`, e o Facebook dá erro de permissão
  numa parte da consulta, mas o painel não diz o que cada conexão consegue fazer.
- **Divergências e premissas sem explicação.** 1.499 cliques e 1.500 cliques no link aparecem sem
  explicação. Moeda e fuso são premissas do app (`OFFSET_SAO_PAULO`), não dados da conta.
- **Período instável.** O período personalizado não se aplicou em duas tentativas. O menu
  (`MarketingLayout.tsx`) leva para `/no/marketing/campanhas` sem o `?periodo`, e o período volta a 7 dias.

Quem paga é o Lucca, que decide a verba da campanha de agências com base num CPL de teste, e o dot,
que planeja tráfego sobre números que não identificam o que falta.

**O que muda quando isto entrar.** Na Visão geral:
- leads válidos aparecem separados dos testes, e o CPL é "não calculável" quando há zero reais;
- LPV e custo por LPV aparecem ao lado do objetivo;
- toda métrica ausente diz por quê;
- o total pago diz quais fontes inclui;
- o cabeçalho mostra conta, moeda, fuso e versão da API lidos da plataforma;
- cada métrica tem definição em texto.

Uma tela nova, "Conexões", mostra o que cada integração consegue fazer. O período escolhido vale em
todas as telas e na URL.

27 critérios em 7 slices · 6 one-way doors · 3 abertos, nenhum bloqueia.

## Criteria

### Leads qualificados e CPL honesto (item 1)

1. Dado que os 10 registros de 31/08 a 29/09/2026 estão classificados como `teste`, quando a Visão geral é aberta com `?periodo=2026-08-31..2026-09-29`, então:
   - o card "Leads válidos" mostra `0`;
   - o card "Custo por lead" mostra "não calculável", e não "R$ 0,00" nem "R$ 17,26";
   - a tabela de leads mostra a linha "Testes excluídos: 10".
2. Quando um lead é classificado `teste`, `invalido` ou `duplicado`, ele sai de "Leads válidos" e da tabela por canal na próxima leitura sem cache. Classificado `real`, entra nas duas.
3. Sempre, cada classificação guarda quem classificou (`user_id` e papel) e quando. Reclassificar acrescenta uma linha nova, e a contagem usa a classificação mais recente de cada lead.

### Resultado que a campanha otimiza (item 2)

4. Quando a campanha "TRAF - 20d - Agencias" é lida num período fechado:
   - a linha dela em Campanhas e o bloco Meta da Visão geral mostram "Visualizações da página de destino", vindas de `actions[action_type=landing_page_view]`;
   - mostram também "Custo por LPV", igual a gasto ÷ LPV;
   - os dois valores batem com o relatório do Ads Manager no mesmo período (o valor e o print ficam no `execution.md`).
5. Quando o detalhe da campanha é aberto, o objetivo (`OUTCOME_TRAFFIC`), a otimização do conjunto (`LANDING_PAGE_VIEWS`) e o resultado (LPV) aparecem na mesma linha. A razão "LPV por clique no link" vem rotulada "diagnóstico, não funil individual".
6. Se a Meta não devolver `landing_page_view` no período, então LPV e custo por LPV mostram "—" com o rótulo do estado (critério 9), nunca `0`.

### Falta de dado separada de zero (item 3)

7. Se o bloco Google Ads falha, o card de gasto pago mostra o valor da Meta com o detalhe "só Meta — Google Ads indisponível", nunca "Meta + Google". Com os dois blocos em `ok`, mostra "Meta + Google".
8. Se o bloco Facebook falha, Instagram, Meta Ads, GA4, Search Console e Leads continuam mostrando os próprios números. O Facebook mostra o motivo, e uma recusa de permissão da Graph (códigos 10 e 200) aparece como `sem_permissao`.
9. Sempre, uma métrica sem valor numérico vem acompanhada de um estado, com rótulo em texto na tela. Os estados são: `indisponivel`, `sem_permissao`, `parcial`, `atrasado`, `erro`. Um valor `0` só aparece quando a plataforma devolveu zero, e aí o estado é `zero`.
   - `parcial`: parte das sub-consultas do bloco falhou.
   - `atrasado`: o período inclui hoje, ou, no Search Console, os últimos 3 dias.

### Conexões por capacidade (item 4)

10. Quando o Lucca ou o dot abre `/no/marketing/conexoes`, a tela lista uma linha por capacidade:
    - Meta: leitura de anúncios, insights orgânicos IG, insights orgânicos FB, publicação IG, publicação FB, escrita de anúncios;
    - Google: OAuth, GA4, Search Console, leitura do Google Ads, criação no Google Ads.

    Cada linha mostra o estado (`ok`, `sem_permissao`, `nao_configurado`, `erro`, `nao_verificado`), a mensagem de erro sem token e o passo de correção em texto.
11. Cada capacidade de leitura é testada por uma chamada de leitura própria, que não cria nada nas plataformas.
    - As capacidades de publicação e de escrita só aparecem como `ok` se houver uma escrita bem-sucedida dessa capacidade em `marketing_actions` nos últimos 30 dias. Sem isso, aparecem como `nao_verificado`, com o texto "leitura funcionar não prova publicação".
12. A tela lista os escopos Google concedidos ao token (via `tokeninfo`) e as permissões Meta do token, ou mostra "não informado pela plataforma" quando a API não as devolve.
13. A tela é acessível para `NO_ADMIN` com `aal2` e para `MARKETING_AGENT`. Nenhuma resposta de `GET /connections` contém um valor de token ou de segredo: os prefixos `ya29.`, `1//0`, `GOCSPX-` e `EAA` aparecem 0 vezes.

### Definições e reconciliação com a Meta (item 5)

14. Quando a Visão geral carrega, o cabeçalho do bloco Meta mostra a conta `act_1415926037237997` e outros três valores lidos da Graph a cada leitura, nenhum deles constante do app:
    - moeda (`currency`);
    - fuso (`timezone_name`);
    - versão da API (`v25.0`).
15. Cada métrica exibida tem definição acessível por texto visível, sem depender de hover. A definição traz o campo de origem na API, a unidade, o escopo, a fórmula, a janela e as limitações. "Cliques" (`clicks`, todos os cliques) e "Cliques no link" (`inline_link_clicks`) têm definições distintas que explicam a diferença entre 1.499 e 1.500.
16. Quando o período fechado 2026-08-31..2026-09-29 é lido no planner e no Ads Manager com as mesmas configurações, o gasto bate ao centavo (R$ 172,64). Cliques, cliques no link e conversões são iguais, ou a diferença está explicada no dicionário.

### Datas que se mantêm (item 8, só correção e validação)

17. Quando o usuário preenche De `22/09/2026` e Até `23/09/2026` e clica em "Aplicar período", o mesmo intervalo aparece em quatro lugares:
    - na URL: `?periodo=2026-09-22..2026-09-23`;
    - na requisição à `marketing-hub`: `periodo=2026-09-22..2026-09-23`;
    - na resposta: `periodo.de = 2026-09-22` e `periodo.ate = 2026-09-23`;
    - no título: "22/09/2026 a 23/09/2026".
18. Quando o usuário navega pelo menu entre Visão geral, Campanhas e Registro, o `?periodo` atual vai junto. Voltar, avançar e recarregar mantêm o período e os campos De e Até preenchidos.
19. Se De ou Até estiver vazio ou incompleto, se De for maior que Até, se Até for depois de hoje ou se o intervalo passar de 366 dias, então:
    - o formulário mostra um erro em texto e não faz requisição;
    - a função continua devolvendo 422 `PERIODO_INVALIDO` para o mesmo valor (existing).
20. A falha observada na revisão de 30/09 ("o período personalizado não aplicou em duas tentativas") é reproduzida por um teste automatizado que falha antes da correção e passa depois. A causa fica registrada no `execution.md`.
21. Sempre, a navegação do menu e os links de detalhe usam o mesmo parâmetro `periodo`, com os valores `7d`, `30d`, `mes-passado` e `AAAA-MM-DD..AAAA-MM-DD` (o contrato R7 da spec não muda).

### Classificar leads (decisão do Lucca em 01/10: "Tabela nova")

22. Quando a migration de classificação é aplicada, ela confere que existem exatamente 10 leads com `created_at` entre `2026-08-31T03:00:00Z` (inclusive) e `2026-09-30T03:00:00Z` (exclusive). Se o número for outro, ela aborta com `raise exception` e não grava nada. Se for 10, grava 10 linhas `classe = teste`, com motivo "confirmado pelo Lucca em 01/10/2026" e `papel = NO_ADMIN`.
23. Quando o Lucca abre `/no/marketing/leads?periodo=30d`, vê uma linha por lead do período, com data, canal, nome, e-mail, a classe atual (ou "a classificar") e os botões "Real", "Teste", "Inválido" e "Duplicado". Ao clicar, a linha mostra a nova classe sem recarregar a página. Sem leads no período, a tela mostra "Nenhum lead no período.".
24. Quando o dot (`MARKETING_AGENT`) chama `GET /marketing-hub/leads` ou `POST /marketing-hub/leads/:id/classificacao`, recebe 403 `FORBIDDEN`. O item "Leads" não aparece no menu dele.
25. Cada classificação gera 1 linha em `marketing_actions` com `kind = lead.classificar`, `target = <lead_id>` e `payload = { lead_id, classe, motivo }`, sem nome, e-mail ou WhatsApp. Reenviar o mesmo `request_id` não cria uma segunda classificação.
26. Se `classe` não for `real`, `teste`, `invalido` ou `duplicado`, se `motivo` passar de 500 caracteres ou se o `lead_id` não existir, a função devolve 422 `INVALID_REQUEST` com `campos`, e nada é gravado.
27. Sempre, `anon` e `authenticated` têm 0 grants em `lead_classificacao`. A RLS fica ligada e sem policies, e só o `service_role` lê e escreve.

## Out of scope

- Itens 6–7 e 9–27 do documento (2ª e 3ª entregas): tabela diária completa, níveis conjunto e anúncio, comparação de períodos, criativos, orgânico lifetime, paginação, atribuição paga × orgânica, funil comercial, histórico, exportação e acesso específico do dot.
- Comparação com o período anterior (parte do item 8 que fica na 2ª entrega).
- Mudar `track-evento`, `save-lead-progress`, `painel-dados`, `send-lead-email` ou o tracking do site.
- Expor nome, e-mail ou WhatsApp de lead ao `MARKETING_AGENT` (R9 continua valendo).

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| tela Visão geral | carregando | existing - `Carregando` (`ui.tsx`) |
| tela Visão geral | erro | existing - `Erro` com "Tentar de novo" |
| tela Visão geral | vazio | existing - "Nenhuma integração respondeu ainda." |
| tela Visão geral | sem autorização | existing - `RoleRoute` → `/nao-autorizado`; `aal1` → MFA |
| tela Visão geral | CPL com zero válidos | 1 |
| tela Visão geral | métrica sem dado | 9 |
| tela Visão geral | total pago com fonte faltando | 7 |
| tela Campanhas | LPV e custo por LPV | 4 |
| tela Campanhas | período ao entrar pelo menu | 18 |
| tela Conexões | carregando e erro | existing - padrão `Carregando`/`Erro` de `ui.tsx` |
| tela Conexões | vazio | n/a - a lista de capacidades é fixa (10) |
| tela Conexões | sem autorização | 13 |
| tela Conexões | ação destrutiva | n/a - tela só de leitura |
| tela Leads | carregando e erro | existing - padrão `Carregando`/`Erro` de `ui.tsx` |
| tela Leads | vazio | 23 |
| tela Leads | sem autorização | 24 |
| tela Leads | ação destrutiva | n/a - classificar acrescenta uma linha e é reversível reclassificando (3) |
| API `POST /leads/:id/classificacao` | formato do erro | 26 |
| formulário de período | entrada inválida | 19 |
| API `GET /overview` | formato da resposta | Decided 1 |
| API `GET /overview` | formato do erro | existing - `{ error_code, mensagem }`; 422 `PERIODO_INVALIDO` |
| API `GET /connections` | quem pode chamar | 13 |
| API `GET /connections` | limite de taxa | existing - padrão `bloco()` com cache de 15 min e `fresco=1` |

## Swept

- validation: 19, 26
- failure modes: 7, 8
- idempotency and retry: 25 (`request_id` único via `acao()`)
- authorization: 13, 24, 27; existing - `autorizar()` em `handler.ts`
- concurrency and ordering: 3 (trilha só de inserção, e a contagem usa a classificação mais recente)
- data lifecycle: 3, 22
- external-dependency failure: 8, 10
- state transitions: n/a - nenhum ciclo de vida muda; a classificação é um rótulo só de inserção
- observability: 10, 25; existing - log `marketing_bloco_falhou` com a mensagem segura

## Impact

| Front | What changes |
|---|---|
| domain | termo novo: `lead válido` - lead cuja classificação mais recente é `real`; vive em `_shared/marketing/leads.ts` |
| domain | termo novo: `estado da métrica` - por que um número está ou não está na tela; contrato entre a `marketing-hub` e o app |
| domain | termo existente: `leads.total` (bloco `leads`) contava todo registro e continua contando. O CPL deixa de usar `total` e passa a usar `validos`; quem ramifica hoje: `OverviewPage.tsx` (CPL) e a leitura do dot |
| domain | termo existente: `conversoes` (Meta) continua sendo ações de lead; LPV é campo novo, não substitui `conversoes` |
| stored data | tabela nova `lead_classificacao`; backfill dos 10 testes na própria migration, com pré-condição de contagem = 10 (22); `leads` não sofre DDL; o cache vence em 15 a 60 min |
| produção | ordem obrigatória: migration → deploy da `marketing-hub` → publicação do app |

## Decided

| Decision | Shape | Alternative rejected |
|---|---|---|
| 1. A resposta de `/overview` muda só por acréscimo | `meta_ads.dados.total` e `por_dia[]` ganham `lpv: number \| null`; `meta_ads.dados.conta: { id, moeda, fuso, versao_api }`; `leads.dados` ganha `validos: number`, `por_classe: { real, teste, invalido, duplicado, a_classificar }`, `por_canal_validos`; todo bloco `ok` ganha `estados: Record<string, EstadoMetrica>` (só para métricas não `disponivel`); `motivo` de bloco com falha ganha `"sem_permissao"`. Nenhum campo existente é removido nem renomeado. | trocar o significado de `total`/`por_canal`: o app antigo continuaria no ar até o deploy dele e mostraria CPL errado sem aviso |
| 2. Enum de estado da métrica, rótulo estável para o dot (R7) | `EstadoMetrica = "disponivel" \| "zero" \| "indisponivel" \| "sem_permissao" \| "parcial" \| "atrasado" \| "erro"` | um booleano `ok` por métrica: não separa "sem permissão" de "falhou" e de "atrasado" |
| 3. Rota e tela novas | `GET /marketing-hub/connections`; tela `/no/marketing/conexoes`, item "Conexões" no menu | estender `/config`: hoje ela só devolve booleanos de configuração e é lida no carregamento do planner, e testar capacidades ali deixaria todo carregamento lento |
| 4. Ordem de deploy | migration → `marketing-hub` → app, cada um com OK | publicar o app primeiro: ele leria campos que a função ainda não devolve |
| 5. Classificação de leads em tabela própria (Lucca, 01/10: "Tabela nova") | `public.lead_classificacao (id bigint generated always as identity primary key, lead_id uuid not null references public.leads(id) on delete cascade, classe text not null check (classe in ('real','teste','invalido','duplicado')), motivo text check (char_length(motivo) <= 500), classificado_por uuid, papel text not null, criado_em timestamptz not null default now())`; índice `(lead_id, criado_em desc)`; RLS ligada sem policies; grants de `anon`/`authenticated` revogados. Classe vigente = linha mais recente por `lead_id`. | coluna `classe` em `leads`: altera a tabela do funil usada por `save-lead-progress` e `send-lead-email` e não guarda trilha |
| 6. Rotas de leads só para `NO_ADMIN` `aal2` (mostram dado pessoal) | `GET /marketing-hub/leads?periodo=` → `{ leads: [{ id, criado_em, canal, nome, email, classe \| null }] }`; `POST /marketing-hub/leads/:id/classificacao` com `{ request_id, classe, motivo? }` → contrato de `acao()` | expor ao dot: fere o R9 (o dot vê leads só em contagem) |

## Surface

| Route | In | Out | Status | Criteria |
|---|---|---|---|---|
| `GET /marketing-hub/overview` | `periodo`, `fresco` | campos novos do Decided 1 | `200`, `401`, `403`, `422` | 1, 4, 7, 9, 14 |
| `GET /marketing-hub/leads` | `periodo` | `leads[]: { id, criado_em, canal, nome, email, classe }` | `200`, `401`, `403`, `422` | 23, 24 |
| `POST /marketing-hub/leads/:id/classificacao` | `request_id`, `classe`, `motivo` | contrato de `acao()` | `200`, `401`, `403`, `409`, `422` | 25, 26 |
| `GET /marketing-hub/connections` | `fresco` | `capacidades[]: { id, plataforma, rotulo, estado, detalhe, correcao }`, `google_escopos`, `meta_permissoes` | `200`, `401`, `403` | 10–13 |

## Sources

- `docs/movimentos/2026-09-30-hub-marketing-agentes/melhorias-2026-10-01.md`: itens 1–5 e 8, e "Primeira entrega". Citação literal: "Itens 1 a 5 e correção/validação de datas do item 8. O painel deve mostrar zero leads reais, CPL não calculável, LPV quando disponível, conexões com diagnóstico e totais conciliados com a Meta."
- `docs/movimentos/2026-09-30-hub-marketing-agentes/HANDOFF.md`, seção 6 (onde mexer em cada item)
- Código no commit `5f0d1aee`: `normalize.ts`, `meta.ts`, `leads.ts`, `handler.ts`, `OverviewPage.tsx`, `MarketingLayout.tsx`, `CampaignsPage.tsx`
- Resposta do Lucca, 01/10/2026: "Tabela nova (Recomendado)". Fecha o antigo Unresolved 1 e vira os critérios 22–27 e os Decided 5–6.
- Pedido do Lucca no chat, 01/10/2026: um agente para o frontend e um para as alterações do Supabase, coordenados pelo Claude central

This task is the record of decision. If a linked document diverges, ask before building.

## Unresolved

| # | Kind | Question | Until answered |
|---|---|---|---|
| 2 | open | Com leads "a classificar" no período, o CPL usa quais leads? | Padrão: só os `real`. Os "a classificar" aparecem em linha própria, com o aviso "CPL considera só leads confirmados". |
| 3 | open | A Graph devolve `/me/permissions` para o token de System User? | Padrão: se não devolver, o critério 12 mostra "não informado pela plataforma". |
| 4 | open | Janela de atribuição efetiva da conta: a Insights API devolve `attribution_setting` nesta versão (não confirmado na documentação lida)? | Padrão: mostrar quando a API devolver; senão, "padrão da conta (não informado pela API)". |
