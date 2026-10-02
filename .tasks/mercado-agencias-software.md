# Mapa de mercado: 50+ agências e software houses parecidas com a nó

> Build this with **tlc-implement**. Execução coordenada pelo Claude central (ver `.tasks/acompanhamento.md`).
> Every criterion below becomes a check with a proof, referenced by its number. Nothing under
> `Unresolved` gets settled while building.

## Intent

O dot vai planejar o tráfego e o social da nó sem referência de mercado. Ele não sabe quem disputa
o mesmo público (agências que revendem software white-label), o que esses concorrentes oferecem,
como anunciam nem como levam o contato até a proposta.

A campanha ativa ("TRAF - 20d - Agencias", R$172,64 de 22/09 a 29/09) gerou zero leads reais. O
documento de melhorias registra que "a taxa atual de zero leads reais não permite concluir sozinha se
o problema está no público, no criativo ou no site". Sem uma base de comparação, cada hipótese do dot
é palpite.

O que muda: o dot recebe uma base estruturada de pelo menos 50 marcas, com fonte em cada dado, e uma
síntese que separa o que foi observado do que é hipótese. Com isso ele compara a oferta, o funil e os
canais da nó com o mercado antes de propor campanha ou pauta.

7 critérios em 2 slices · 0 one-way doors · 3 abertos, nenhum bloqueia.

## Criteria

### Base de marcas

1. O arquivo `docs/mercado/2026-10-agencias-software/marcas.csv` tem pelo menos 50 linhas de dados, com:
   - uma marca por linha;
   - nenhum domínio repetido;
   - estas colunas, nesta ordem: `nome`, `site`, `cidade_uf`, `tipo`, `oferta_principal`, `white_label_para_agencias`, `publico_declarado`, `preco_publico`, `cta_principal`, `etapas_do_fluxo`, `anuncia_meta`, `anuncia_google`, `linkedin_empresa`, `temas_de_conteudo`, `diferencial_declarado`, `fontes`, `coletado_em`.
2. Os campos fechados aceitam só estes valores:
   - `tipo`: `software_house`, `fabrica_white_label`, `agencia_digital_com_dev`, `saas_para_agencias`, `estudio_no_code`;
   - `white_label_para_agencias`: `sim`, `nao`, `nao_informado`;
   - `anuncia_meta` e `anuncia_google`: `sim`, `nao`, `nao_verificado`;
   - `cta_principal`: `formulario`, `whatsapp`, `agendar_call`, `diagnostico`, `orcamento`, `outro`.
3. Sempre, cada linha tem em `fontes` pelo menos uma URL pública que sustenta os campos preenchidos. Um campo que a fonte não mostra fica `nao_informado` ou `nao_verificado`, nunca inferido. `anuncia_meta` vem da Biblioteca de Anúncios da Meta, e `anuncia_google` vem da Central de Transparência de Anúncios do Google.
4. Sempre, a base tem só dados de empresa: aparecem 0 nomes de funcionários, 0 e-mails pessoais e 0 telefones pessoais. E-mail e telefone comerciais genéricos também ficam fora, porque não são necessários.

### Síntese para o dot

5. O arquivo `docs/mercado/2026-10-agencias-software/sintese.md` tem cinco seções: oferta, funil (CTA → etapas até a proposta), canais e formatos de anúncio, preço público e posicionamento da nó.
   - Toda afirmação traz a contagem sobre a base (por exemplo, "23 de 50 usam WhatsApp como CTA").
   - Observação e hipótese aparecem em listas separadas e rotuladas.
6. A seção "posicionamento da nó" compara a oferta declarada da nó (white-label para agências; roadmap e protótipo em 3 dias) com a base. Ela lista quantas marcas declaram cada um desses dois pontos e cita até 5 marcas que mais se aproximam, com o motivo de cada uma.
7. A síntese termina com uma seção "Perguntas para o dot testar". São no máximo 10 hipóteses de tráfego ou de conteúdo, cada uma ligada à contagem que a motivou e a uma métrica do planner que pode confirmá-la ou derrubá-la (por exemplo, custo por LPV ou leads válidos).

## Out of scope

- **Scraping logado do LinkedIn ou uso da sessão do Lucca no LinkedIn.** Fere os termos do LinkedIn e põe a conta dele em risco. Do LinkedIn entra só o que é público sem login: página da empresa ou resultado de busca.
- **Raspagem automatizada da página de resultados do Google.** A busca é feita pela ferramenta de busca web, e as páginas das marcas são lidas uma a uma.
- **Dados de pessoas** (decisores, funcionários) e **contato ativo** com as marcas.
- **Benchmark de preço por cotação** (pedir orçamento se passando por cliente).

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| coleção `marcas.csv` | critério de agrupamento | 2 (`tipo`) |
| coleção `marcas.csv` | nomenclatura | 1 (colunas fixas) |
| coleção `marcas.csv` | ordenação | Unresolved 3 |
| coleção `marcas.csv` | duplicatas | 1 (domínio único) |
| coleção `marcas.csv` | exceção que não se encaixa | 2 (`tipo` fechado; uma marca fora dos 5 tipos não entra na base, e vai para a lista "descartadas" da síntese, com o motivo) |
| documento `sintese.md` | estrutura | 5 |
| documento `sintese.md` | o que o leitor faz a seguir | 7 |
| documento `sintese.md` | tom e profundidade | 5 (contagens; observação separada de hipótese) |

## Swept

- validation: 2
- failure modes: 3 (`nao_informado` / `nao_verificado` em vez de inferir)
- idempotency and retry: n/a - coleta única e datada (`coletado_em`)
- authorization: 4; Out of scope (sem sessão logada)
- concurrency and ordering: n/a - um só coletor
- data lifecycle: 4; `coletado_em` data cada linha
- external-dependency failure: 3
- state transitions: n/a - não há ciclo de vida
- observability: 1 (`fontes` e `coletado_em` por linha)

## Impact

| Front | What changes |
|---|---|
| domain | nada; documento novo em `docs/mercado/` |
| stored data | nada para migrar |

## Decided

| Decision | Shape | Alternative rejected |
|---|---|---|
| None - documento novo, reversível; nada aqui é one-way | | |

## Sources

- Pedido do Lucca no chat (01/10/2026), citado literalmente: "pesquisar o que agencias de software ofertam no google e no linkedin, de que forma fazem isso e como fazem o fluxo. Ele deve fazer um scraper da ao menos 50 marcas similares à nó, para o Dot ter mais noção de mercado para planejar o trafego/social media da Nó."
- `docs/movimentos/2026-09-30-hub-marketing-agentes/melhorias-2026-10-01.md`: objetivo comercial (agências parceiras, white-label, roadmap e protótipo em 3 dias) e o funil que deve ser medido.

This task is the record of decision. If a linked document diverges, ask before building.

## Unresolved

| # | Kind | Question | Until answered |
|---|---|---|---|
| 1 | open | O que conta como "similar à nó"? | Padrão: empresas brasileiras que vendem desenvolvimento de software ou sistemas sob medida para PMEs ou para agências, incluindo fábricas white-label e SaaS vendido a agências. No máximo 10 das 50 podem ser de fora do Brasil, e só se forem referência explícita de white-label para agências. |
| 2 | open | Por onde o dot lê a pesquisa? | Padrão: o Lucca anexa `marcas.csv` e `sintese.md` no chat do dot. Levar a pesquisa para dentro do planner fica fora de escopo. |
| 3 | open | Ordem das linhas da base | Padrão: por `tipo` e, dentro de cada tipo, por `nome`. |
