<!-- Transcrição fiel de melhorias-painel-marketing-2026-10-01.docx (Lucca + dot, 01/10/2026). O .docx ao lado é a fonte. -->

# Melhorias do painel Marketing da Nó

Revisão para análise diária e por período de campanhas e conteúdo orgânico

Inspeção de 30 de setembro de 2026 à noite, horário UTC−03. Código de referência: 5f0d1aee45decf72535dda5d35ae59205bae9cd4. Documento entregue em 1 de outubro UTC.

### Conclusão

O painel já serve como centro operacional, mas precisa tornar seus dados confiáveis, comparáveis e completos antes de sustentar recomendações profundas de marketing. A prioridade é corrigir a interpretação dos números; depois ampliar o detalhamento diário e por anúncio; por último construir histórico e análises recorrentes quando solicitadas.

O objetivo comercial é captar agências parceiras que revendam sistemas aos próprios clientes, adicionando margem sobre o desenvolvimento white-label da Nó. O fluxo a medir vai do anúncio ou conteúdo até o contato qualificado da agência, roadmap e protótipo em três dias, proposta e contratação.

### Situação confirmada

Meta: campanha TRAF - 20d - Agencias, ativa desde 22/09, objetivo Tráfego e conjunto otimizado para visualizações da página de destino, a R$20/dia. O relatório de 31/08 a 29/09 mostra R$172,64, 20.084 impressões, 16.601 de alcance e 1.499 cliques. O gasto começa em 22/09. Não inclui 30/09.

Você confirmou que os 10 registros do funil são testes; nove antecedem a campanha. Há zero leads reais. O CPL de R$17,26 mistura gasto com esses testes e não deve orientar decisões. Google Analytics e Search Console retornaram unauthorized_client. Parte das métricas de Facebook retornou erro de permissão.

### Ordem de execução recomendada

P0 — Confiabilidade: testes, resultado correto da campanha, atribuição, erros, datas, definições e reconciliação com a Meta.

P1 — Profundidade: tabela diária, campanha → conjunto → anúncio, criativos, públicos, conteúdo orgânico e comparação entre períodos.

P2 — Continuidade: histórico, funil comercial, exportação, evidências de alterações e acesso específico do agente.

### Limites e escopo

A revisão foi somente leitura. Nenhuma campanha, publicação, orçamento ou permissão foi alterada. Controles de escrita foram observados, não testados em produção. As recomendações abaixo não são autorização de implementação. Mais dados não garantem exatidão total: atribuição, estimativas, privacidade e atraso das plataformas continuam relevantes.

## P0 — Corrigir a confiança nos números

### 1 — Excluir testes e separar qualidade do lead

**Hoje:** O contrato analítico conta todos os registros, sem classificação de teste ou validade.

**Melhoria:** Classificar teste, real, inválido e duplicado; manter trilha de auditoria e filtrar testes por padrão. Exibir leads da plataforma, válidos do funil e qualificados separadamente.

**Aceite:** A base com 10 testes e zero reais mostra zero leads válidos e CPL indefinido, nunca R$0 ou R$17,26 como sucesso de aquisição.

### 2 — Exibir o resultado que a campanha otimiza

**Hoje:** O conjunto otimiza LANDING_PAGE_VIEWS, mas a normalização preserva apenas ações de lead.

**Melhoria:** Preservar visualizações da página de destino, custo por LPV e relação LPV por clique de link compatível. Essa relação é diagnóstica, não um funil individual comprovado. Mostrar objetivo e resultado juntos.

**Aceite:** LPV e custo por LPV coincidem com o mesmo relatório nativo. Ausência de dado aparece com motivo, não como zero.

### 3 — Separar falta de dados de desempenho zero

**Hoje:** Falhas individuais de insights orgânicos viram campos nulos; totais podem somar só as fontes disponíveis.

**Melhoria:** Estados por métrica: disponível, zero real, indisponível, sem permissão, parcial, atrasado ou erro. Identificar subtotal e fontes incluídas.

**Aceite:** Uma falha do Google nunca produz um total aparentemente completo de Meta mais Google; uma falha de Facebook mantém os demais dados legíveis.

### 4 — Diagnosticar as conexões por capacidade

**Hoje:** Google retorna OAuth 401 unauthorized_client; Facebook tem erro pages_read_user_content ou Page Public Content Access em parte da consulta.

**Melhoria:** Mostrar conta, escopos e capacidades disponíveis, erro seguro e passo de correção. Separar leitura de anúncios, insights orgânicos e publicação.

**Aceite:** Cada recurso é testado isoladamente. Não afirmar que publicar funciona porque a leitura de anúncios funciona; não prescrever nova permissão sem confirmar a necessidade.

### 5 — Definir métricas e reconciliar com a Meta

**Hoje:** 1.499 cliques e 1.500 cliques no link não têm explicação na interface. Moeda e fuso são assumidos pelo app.

**Melhoria:** Dicionário com campo de origem, unidade, escopo, fórmula, janela e limitações. Registrar conta, moeda, fuso, versão API e configuração efetiva de atribuição.

**Aceite:** Relatório fechado reproduzido no Ads Manager; gasto conciliado sob mesmas configurações e diferenças de cliques/conversões explicadas ou sinalizadas.

## P1 — Ler a evolução diária corretamente

### 6 — Completar a tabela diária

**Hoje:** O backend já devolve impressões, alcance, cliques e cliques no link diários da conta; a tela só apresenta gasto e leads.

**Melhoria:** Expor data, gasto, impressões, alcance, cliques por tipo, LPV, leads válidos e custos/taxas relevantes. Incluir totais e exportação.

**Aceite:** Uma linha por dia e colunas com definição. Distinguir dia incompleto de fechado. Parte desta melhoria é interface; LPV exige ampliar a normalização.

### 7 — Descer até conjunto e anúncio

**Hoje:** Campanhas têm métricas acumuladas; conjuntos e anúncios têm principalmente configurações e controles.

**Melhoria:** Consultar insights por nível account, campaign, adset e ad, com granularidade diária e filtros combinados.

**Aceite:** Selecionar um conjunto ou anúncio altera gráfico e totais. Métricas aditivas conciliam entre níveis; alcance único é consultado no nível correto.

### 8 — Comparar períodos de forma consistente

**Hoje:** Há presets de 7 e 30 dias. Navegar para Campanhas perde o período e volta a 7 dias. O período personalizado não aplicou em duas tentativas.

**Melhoria:** Preservar filtros entre páginas; sincronizar URL e campos; testar Aplicar, voltar/avançar e recarregar. Adicionar comparação com período anterior de mesma duração.

**Aceite:** 22/09 a 23/09 deve aparecer igual no formulário, URL, pedido, resposta e título. Datas inválidas dão erro visível. A causa da falha observada ainda precisa de diagnóstico.

### 9 — Calcular taxas e alcance sem distorção

**Hoje:** Várias métricas são mostradas sem denominador explícito; janelas longas orgânicas somam alcance por blocos.

**Melhoria:** CPC de link = gasto/cliques no link; CTR de link = cliques no link/impressões; custo/LPV = gasto/LPV. Recalcular razões com somas, sem média simples das taxas.

**Aceite:** Não somar alcance único entre dias/anúncios nem apresentar soma de blocos como pessoas únicas. Zero denominador produz não aplicável. Toda taxa identifica numerador e denominador.

### Perguntas que esta etapa deve permitir responder

Em qual dia o custo por visita subiu? Foi queda de CTR, aumento do custo de impressão ou perda entre clique e carregamento? Qual anúncio concentrou o gasto? A mudança ocorreu depois de trocar criativo, público ou página? Essas perguntas exigem evidência, não acesso às decisões internas do algoritmo.

## P1 — Entender anúncio público e contexto

### 10 — Mostrar o criativo completo

**Hoje:** O backend recebe targeting e ID de criativo, mas os descarta; a miniatura não é mostrada na tabela.

**Melhoria:** Prévia, legenda/copy, título, CTA, formato, IDs estáveis, publicação vinculada, URL final e parâmetros UTM. Links diretos para os objetos da Meta.

**Aceite:** Conseguir identificar o que o público viu e para onde foi enviado sem deduzir pelo nome do anúncio.

### 11 — Mostrar configuração e entrega

**Hoje:** Há status e orçamento, mas falta contexto suficiente para interpretar resultados.

**Melhoria:** Público legível, localização, faixa etária quando disponível, posicionamentos, estratégia de lance, tipo de orçamento, programação e status efetivo/motivo de restrição.

**Aceite:** Distinguir anúncio ativo de entrega efetiva e problema de elegibilidade. Não expor dados individuais de pessoas.

### 12 — Adicionar recortes compatíveis

**Hoje:** Não há detalhamento analítico por posicionamento, plataforma ou dispositivo.

**Melhoria:** Disponibilizar recortes suportados e úteis: Facebook/Instagram, posicionamento, dispositivo, geografia e demografia agregada quando permitida. Consultas separadas para combinações incompatíveis.

**Aceite:** A interface informa quando um recorte não suporta determinada métrica. Não inventa cruzamentos nem distribui conversões ausentes proporcionalmente.

### 13 — Comparar criativos sem confundir exposição

**Hoje:** Um anúncio de maior idade ou com mais verba tende a acumular mais resultados.

**Melhoria:** Comparar anúncios por janela equivalente, gasto, impressões, cliques no link, LPV e resultado relevante. Identificar criativo repetido e anúncio impulsionando post existente.

**Aceite:** Relatório separa volume, eficiência e incerteza; não declara vencedor com poucos dados nem atribui causalidade a simples correlação.

### Histórico de mudanças e aprendizado

O objetivo de otimização é visível; as decisões internas do algoritmo e seu histórico completo não são. Registrar mudanças conhecidas de orçamento, público, criativo e landing page. Estados de aprendizado ou recomendações da Meta só devem aparecer quando realmente fornecidos pela API. Nunca apresentar uma explicação imaginada do algoritmo como fato.

## P1 — Medir conteúdo orgânico e publicações

### 14 — Separar atividade do período de vida do post

**Hoje:** Métricas da conta usam o período e podem incluir anúncios. Posts são filtrados por publicação; seus insights e contadores podem ser lifetime ou atuais.

**Melhoria:** Três visões: atividade da conta no período; posts publicados no período com total até a coleta; crescimento de cada post entre observações quando disponível.

**Aceite:** Todo número identifica período, lifetime/retrato atual e escopo orgânico/pago/combinado. Não chamar toda métrica da conta de orgânica; não omitir atividade recente de posts antigos.

### 15 — Detalhar formatos e métricas úteis

**Hoje:** Há lista de posts, mas legenda é truncada e nem todos os campos coletados são expostos.

**Melhoria:** Permalink, mídia/prévia, legenda integral, data, formato e objetivo editorial. Views, alcance, curtidas, comentários, compartilhamentos e salvamentos conforme suporte; taxas com denominador explícito.

**Aceite:** Ranking pode ser filtrado por formato e idade. Campos não suportados são identificados, sem zeros fabricados.

### 16 — Tratar Reels e Stories conforme disponibilidade

**Hoje:** A presença de um formato no agendamento não prova disponibilidade de todas as métricas.

**Melhoria:** Reels: reproduções e tempo de exibição médio/total quando suportados. Stories: coleta dentro da janela disponível. Separar métricas orgânicas de totais com impulsionamento/crosspost quando o provedor oferecer a distinção.

**Aceite:** Não prometer curva de retenção segundo a segundo, histórico diário de qualquer post ou dados retroativos de Stories sem comprovar o contrato da API.

### 17 — Eliminar cortes silenciosos

**Hoje:** O código mantém no máximo 25 posts por rede; há limites de páginas e caracteres.

**Melhoria:** Paginação visível, total/intervalo coberto, continuar carregando e flag de resultado parcial. Legenda completa disponível no detalhe.

**Aceite:** Uma conta com mais de 25 posts não parece ter só 25. Relatórios não chamam amostra truncada de desempenho total.

### 18 — Unificar calendário e biblioteca publicada

**Hoje:** Calendário vazio enquanto a visão geral lista posts históricos; parece restrito ao planner sem explicar cobertura.

**Melhoria:** Distinguir agendado aqui, publicado via app e importado da rede. Relacionar item planejado ao ID/permalink publicado e ao desempenho.

**Aceite:** Post externo aparece na biblioteca, ou a ausência é explicitamente explicada. Publicação tem estados claros e falha rastreável; confirmação de agendamento não equivale a publicação efetiva.

## P2 — Ligar marketing a oportunidades reais

### 19 — Separar tráfego pago orgânico e desconhecido

**Hoje:** A classificação atual pode chamar qualquer origem Meta ou fbclid de Meta, incluindo orgânico.

**Melhoria:** Categorias distintas paid social, organic social e social sem evidência suficiente. Usar UTMs e IDs explícitos de campanha/anúncio, preservando desconhecido.

**Aceite:** Um contato orgânico de Instagram não vira conversão paga apenas por ter fbclid ou utm_source=instagram.

### 20 — Mostrar as etapas do funil

**Hoje:** O hub usa data e poucos parâmetros de origem; a base de jornada tem mais informações não utilizadas.

**Melhoria:** Agregados de sessão na landing page, início do formulário, avanço, contato válido, agência qualificada, diagnóstico, proposta e contratação conforme instrumentação.

**Aceite:** Documentar sessão, pessoa e evento; deduplicar sem expor dados pessoais ao agente. Separar conversão da Meta de conversão observada no site.

### 21 — Medir a qualidade comercial da agência

**Hoje:** Hoje o painel não comprova geração de oportunidades reais.

**Melhoria:** Classificação explícita de agência parceira, contato válido, qualificado e etapa comercial. Medir propostas e projetos, preservando aprovação e privacidade.

**Aceite:** Conseguir distinguir muitos cliques de parceiros potenciais. Receita/ROAS só aparece quando há receita registrada e regra de atribuição verificável.

### 22 — Tratar atribuição como modelo com limites

**Hoje:** Há totais sem contrato completo de atribuição e sem qualidade de UTMs.

**Melhoria:** Exibir modelo efetivo, cobertura de tags, origens desconhecidas, atraso de conversão e divergências Meta versus site/GA4. Reconsultar dias recentes para resultados tardios.

**Aceite:** Nenhuma soma dupla de leads da Meta mais leads próprios. Uma mudança tardia no histórico fica registrada, não parece uma alteração inexplicável do relatório.

### Métricas comerciais recomendadas

Para esta operação, a sequência útil é: custo por LPV → visita para formulário → contato real → agência qualificada → proposta → projeto contratado. Cada etapa depende de instrumentação e volume suficientes. A taxa atual de zero leads reais não permite concluir sozinha se o problema está no público, no criativo ou no site.

## P2 — Histórico acesso e rotina de análise

### 23 — Guardar histórico analítico mínimo

**Hoje:** O cache expira e é removido. Não é histórico de métricas ou de configurações.

**Melhoria:** Snapshots versionados por conta, objeto, dia e configuração de relatório; observações de posts; revisões de atribuição. Retenção e backfill limitados e explícitos.

**Aceite:** Conseguir comparar o estado observado ontem com hoje sem tratar todo valor histórico como imutável. É expansão de escopo, não função prometida pelo PR49.

### 24 — Mostrar atualização e cobertura reais

**Hoje:** gerado_em informa montagem do relatório, inclusive quando usa cache.

**Melhoria:** Por fonte: coletado_em, dados_ate, expiração de cache, atraso esperado, versão da API, cobertura e erro parcial.

**Aceite:** Ler cache preserva a hora original da coleta. Atualizar uma fonte não torna todas as outras aparentemente atualizadas.

### 25 — Ampliar o registro de alterações

**Hoje:** Registro cobre escritas do planner, tem limite e não representa toda a atividade na Meta.

**Melhoria:** Filtros, paginação, ator, antes/depois, entidade, autorização e resultado. Importar alterações externas quando suportado; marcar mudanças inferidas por snapshots.

**Aceite:** Relatório diferencia ação do app, ação externa observada e mera hipótese. Não confunde log vazio com nenhuma mudança na campanha.

### 26 — Separar meu acesso do administrador

**Hoje:** Sessão usada foi Lucca admin; não há conta dot cadastrada.

**Melhoria:** Criar conta específica apenas com autorização, com menor acesso necessário e leitura separada das ações de escrita. Validar isolamento por conta de anúncios e objeto.

**Aceite:** IDs recebidos por rotas de detalhe/edição pertencem à conta Nó configurada. Não inferir falha explorada: risco depende do token real. Não reutilizar o perfil admin como padrão permanente.

### 27 — Exportar análises reproduzíveis

**Hoje:** Não há um pacote analítico completo com filtros, definições e cobertura.

**Melhoria:** Tabela exportável e relatório com conta, período, fuso, fonte, coleta, métricas e limitações; campos estáveis e estados legíveis para navegação pelo agente.

**Aceite:** A mesma pergunta retorna uma análise rastreável. Separar observações, hipóteses e ações propostas. Monitoramento e mudanças de orçamento continuam sujeitos ao pedido e autorização do usuário.

## Plano de entrega e critérios finais

### Primeira entrega

Itens 1 a 5 e correção/validação de datas do item 8. O painel deve mostrar zero leads reais, CPL não calculável, LPV quando disponível, conexões com diagnóstico e totais conciliados com a Meta. Este é o bloqueio principal para decisões confiáveis.

### Segunda entrega

Itens 6 a 18: dados diários já coletados na interface, novas consultas por campanha/conjunto/anúncio, contexto de criativo, comparações e semântica orgânica correta. Não é necessário esperar por um grande repositório histórico para entregar esse valor.

### Terceira entrega

Itens 19 a 27: funil qualificado, histórico mínimo, revisões, registro e acesso específico. Priorizar instrumentação útil à decisão; evitar colecionar dados sem pergunta definida.

### Teste de aceite da análise diária

Pedir: “Compare ontem com os sete dias anteriores da campanha de agências e explique onde mudou a eficiência”. A resposta deve usar dias fechados, LPV e taxas corretas, separar criativos, indicar atraso/amostra e vincular mudanças conhecidas. Se faltar dado, a resposta deve dizer qual e como isso limita a conclusão.

### Teste de aceite da análise orgânica

Pedir: “Quais conteúdos publicados neste mês geraram mais interação e quais posts antigos cresceram nesta semana?”. O sistema deve tratar essas perguntas como populações diferentes e não comparar lifetime de um post antigo com sete dias de outro sem avisar.

### Teste de aceite de consistência

Conferir conta, fuso, moeda, datas, atribuição efetiva e versão da API contra o mesmo relatório nativo. Repetir em account, campaign, adset e ad; não exigir que alcance único se some. Cobrir mais de 25 posts, registros de teste, nenhuma conversão, falha parcial, dia incompleto e retorno tardio de conversão.

### Limites que permanecem mesmo após as melhorias

Alcance e algumas métricas são estimados; privacidade pode suprimir recortes; atribuição não prova causalidade; APIs mudam; posts podem ter apenas métricas lifetime e atraso de atualização. O painel deve expor essas condições. Ele não pode tornar visível toda decisão interna do algoritmo da Meta.

### Não realizado nesta revisão

Não houve implementação, alteração de autorização, publicação, agendamento, sincronização manual com escrita ou teste financeiro. Os controles de ação exigem teste autorizado próprio. Não foram consultados dados pessoais de leads.

## Fontes e rastreabilidade

Interface autenticada, inspeção de telas e código atual foram combinados para distinguir ausência visual, ausência no contrato e possível falha de interação. Documentação oficial complementa a viabilidade; cada métrica precisa ser validada na versão e conta realmente usadas.

Painel inspecionado https://app.notechstack.com.br/no/marketing/visao-geral?periodo=30d

Visão geral e cálculos https://github.com/luccavgiani-spec/notechstack-lp/blob/5f0d1aee45decf72535dda5d35ae59205bae9cd4/app/src/marketing/OverviewPage.tsx

Datas e navegação https://github.com/luccavgiani-spec/notechstack-lp/blob/5f0d1aee45decf72535dda5d35ae59205bae9cd4/app/src/marketing/MarketingLayout.tsx

Coleta Meta e orgânico https://github.com/luccavgiani-spec/notechstack-lp/blob/5f0d1aee45decf72535dda5d35ae59205bae9cd4/supabase/functions/_shared/marketing/meta.ts

Normalização das métricas https://github.com/luccavgiani-spec/notechstack-lp/blob/5f0d1aee45decf72535dda5d35ae59205bae9cd4/supabase/functions/_shared/marketing/normalize.ts

Leads e atribuição https://github.com/luccavgiani-spec/notechstack-lp/blob/5f0d1aee45decf72535dda5d35ae59205bae9cd4/supabase/functions/_shared/marketing/leads.ts

Resposta e atualização https://github.com/luccavgiani-spec/notechstack-lp/blob/5f0d1aee45decf72535dda5d35ae59205bae9cd4/supabase/functions/marketing-hub/handler.ts

Cache https://github.com/luccavgiani-spec/notechstack-lp/blob/5f0d1aee45decf72535dda5d35ae59205bae9cd4/supabase/functions/marketing-hub/store.ts

Escopo original https://github.com/luccavgiani-spec/notechstack-lp/blob/5f0d1aee45decf72535dda5d35ae59205bae9cd4/docs/movimentos/2026-09-30-hub-marketing-agentes/spec.md

Meta Insights https://developers.facebook.com/documentation/ads-commerce/marketing-api/insights

Meta Insights boas práticas https://developers.facebook.com/documentation/ads-commerce/marketing-api/insights/best-practices

Instagram media insights https://developers.facebook.com/documentation/instagram-platform/reference/instagram-media/insights

A documentação oficial contém orientações de atribuição que mudaram ao longo do tempo. Não implementar seletores apenas porque parâmetros antigos ainda aparecem na referência; confirmar comportamento efetivo da versão usada e reconciliar com Ads Manager.
