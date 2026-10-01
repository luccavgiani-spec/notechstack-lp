# Mercado de software para PMEs e agências
Coleta: 2026-10-01. Base: [50 marcas](marcas.csv), 50 domínios únicos. Amostra intencional de páginas públicas, não censo nem estimativa de participação de mercado. As declarações são dos fornecedores, sem auditoria de entrega.

## Método e limites
Selecionamos oferta de software sob medida para PMEs ou soluções para agências. O tipo representa a oferta da página coletada; fábrica white-label significa serviço técnico sob marca do parceiro, enquanto SaaS representa licença de plataforma. Marca de relatório isolada não basta para classificar a plataforma como white-label. Não presumimos sede brasileira pela língua: referências internacionais explicitamente white-label, como Bioma, entram como comparação; cidade desconhecida permanece nao_informado.

Cada linha traz a página oficial efetivamente aberta e a data. As 2/50 páginas empresariais LinkedIn foram lidas publicamente, sem login. Nenhum formulário foi submetido. Etapas são as declaradas, não conversões experimentadas. Ausência de evidência permanece lacuna, não “não oferece”. Links e preços podem mudar depois da coleta. A seleção favorece páginas indexáveis e empresas que explicam sua oferta.

Candidatos sem leitura suficiente foram descartados: Aquos, E-SaaS, Hyper Sistemas, RostDesk, Organify, GestZa, Talan, Facilware, Ollie O e SocialPlus. Monde e Focus Turismo atendem agências de viagens; não entraram. Não há dados de contatos ou pessoas no CSV.

## Oferta
**Observações**
- 23/50 são software_house, 15/50 saas_para_agencias e 12/50 fabrica_white_label. As outras duas categorias permitidas tiveram 0/50 entradas.
- 24/50 declaram white-label para agências; 26/50 ficam nao_informado. Não há evidência suficiente para classificar estas 26 como negativas.
- A divisão dos 24 positivos é 12 fábricas, 10 SaaS e 2 software houses. Portanto, white-label sozinho não distingue a nó nessa amostra.

**Hipóteses**
- Diante de 24/50 ofertas white-label, explicar responsabilidade por escopo, manutenção e propriedade pode qualificar melhor o parceiro do que somente repetir o termo. Medir leads qualificados por sessão da página de parceria.

## Funil — CTA até proposta
**Observações**
- CTA principal: 16/50 outro, 9/50 formulario, 8/50 whatsapp, 8/50 orcamento, 5/50 diagnostico e 4/50 agendar_call. A classificação considera intenção do CTA; “solicitar orçamento via WhatsApp” permanece orcamento.
- 1/50, [Japa Gestão](https://japagestao.com.br/white-label/), explicita formulário → demonstração → proposta → contrato.
- 1/50, [Cappei](https://cappei.com/), descreve entrevista/diagnóstico → mapa da operação → escopo e orçamento, com protótipo antes do código.
- 1/50, [nFactory](https://nfactory.com.br/), promete proposta com escopo, prazo e valor em 48 horas após conversa. 1/50, [Codech](https://codech.com.br/parcerias/), promete orçamento em 24 horas. Isso não comprova entrega de protótipo nesse prazo.
- As 50/50 linhas descrevem somente o trecho público observado; “proposta: nao_informado” sinaliza interrupção da evidência e não inexistência de processo comercial.

**Hipóteses**
- Os 5/50 CTAs de diagnóstico sugerem um teste de entrada consultiva versus orçamento direto (8/50). Métrica: taxa sessão → lead qualificado, mantendo origem e período comparáveis.
- A baixa presença de call como CTA primário (4/50) sugere testar formulário curto antes de agenda. Métrica: lead → reunião realizada; o planner precisa receber esse evento para medir a etapa.

## Canais e formatos de anúncio
**Observações**
- Meta: 50/50 nao_verificado. Google: 50/50 nao_verificado. Zero positivos e zero negativos verificados.
- Na coleta, a [Biblioteca de Anúncios Meta](https://www.facebook.com/ads/library/) retornou HTTP 403; o [Google Ads Transparency Center](https://adstransparency.google.com/) abriu apenas a interface inicial, sem resultados de anunciantes. Não foi concluída verificação individual das 50 marcas.
- Formatos pagos, frequência, criativos e páginas de destino de anúncios ficam desconhecidos em 50/50 casos. Integrações com Ads e pixels não foram usados como prova.
- Temas de conteúdo foram observados em 4/50: SiGA SW e Kodesto em conteúdo do site; CRATON e GVD em páginas empresariais LinkedIn públicas. As outras 46/50 permanecem nao_informado. Conteúdo orgânico não comprova anúncio.

**Hipóteses**
- Como 50/50 anúncios são desconhecidos, a amostra não sustenta escolher Meta ou Google por comportamento concorrente. A escolha deve usar gasto, leads, CPL e qualidade dos dados da própria nó no planner.

## Preço público
**Observações**
- 13/50 têm algum valor numérico em reais; 37/50 não têm valor numérico coletado. Estes 37 incluem consulta e gratuidade declarada sem preço de projeto; não significam ausência de política de preço.
- Entre os 13, 6 são SaaS, 6 software houses e 1 fábrica white-label. Os escopos misturam licença, adicional, anualidade e projeto: não calcular média nem mediana conjunta.
- 1/50, [Virtus CRM](https://crmvirtus.com/crm-white-label-para-agencias), informa R$ 100/mês apenas pelo domínio próprio; licença desconhecida. 1/50, [iGeriu](https://www.igeriu.com.br/whitelabel-para-agencias), mostra R$ 29,90/licença no simulador, com condições não verificadas.
- 1/50, [Sistelia](https://sistelia.com.br/parcerias), publica WordPress a partir de R$ 2.500; o exemplo de margem na mesma página não foi confundido com tabela de desenvolvimento.
- 1/50, [Datalitics](https://datalitics.com.br/white-label), apresenta sugestões de revenda; foram excluídas do preço do fornecedor.

**Hipóteses**
- Com 13/50 valores de escopos heterogêneos, uma faixa associada a escopo explícito pode reduzir leads incompatíveis sem transformar preço de entrada em promessa geral. Medir CPL e proporção de leads qualificados, não apenas volume.

## Posicionamento da nó
Referência interna do plano: execução white-label para agências e roadmap + protótipo em 3 dias. A referência não representa comprovação de SLA em produção.

**Observações**
- White-label está declarado em 24/50. A promessa conjunta “roadmap + protótipo em 3 dias” foi identificada em 0/50 páginas inspecionadas. Isso é ausência de identificação nesta coleta, não prova de exclusividade de mercado.
- Até cinco comparáveis, cada um 1/50: [Abstract Devs](https://abstractdevs.com.br/br/servicos/white-label) combina engenharia para agências, NDA e protótipos; [Sistelia](https://sistelia.com.br/parcerias) combina marca invisível e alinhamento de investimento; [Otto.dev](https://letsotto.dev/parceria-agencias) associa software/IA a parceria e propriedade; [Frelo](https://frelo.co/pt) combina parceria para agências e escopo/prazo fixos; [Cappei](https://cappei.com/) conecta diagnóstico e protótipo para PME, embora não declare white-label.
- Nenhuma dessas 5/50 referências foi contada como oferta conjunta de roadmap e protótipo em 3 dias. Teste grátis de 3 dias (Nexio, 1/50), orçamento em 24 horas (Codech, 1/50) e landing page em 3–5 dias (CCypher, 1/50) não equivalem à promessa.

**Hipóteses**
- Com 24/50 white-label e 0/50 promessa conjunta identificada, a nó pode testar a entrega inicial de 3 dias como argumento de redução de incerteza. É necessário definir início do prazo, insumos e o que o protótipo valida.
- Os 12/50 fornecedores classificados como fábrica white-label formam um grupo mais próximo para comparar parceria; os 15/50 SaaS ajudam a entender produto recorrente, mas não devem definir preço de engenharia sob medida.

## Perguntas para o dot testar
As métricas abaixo são propostas; evento ausente deve ser reportado como indisponível. Não criar rastreamento nem atribuir causalidade nesta entrega.

1. Com 24/50 white-label, a mensagem “sua agência vende, a nó desenvolve” traz leads de parceria? Métrica no planner: leads e CPL por campanha/UTM, com qualificação quando disponível.
2. Com 0/50 promessa conjunta de 3 dias identificada, essa mensagem gera mais leads que white-label genérico? Métrica: conversão e CPL por variante; controlar gasto e período.
3. Com 5/50 CTAs diagnóstico e 8/50 orçamento, qual entrada qualifica melhor? Métrica: leads qualificados/sessões por landing page; indisponível sem evento de qualificação.
4. Com 9/50 CTAs formulário e 4/50 agenda, o formulário reduz abandono? Métrica: envio/sessões e reunião realizada/lead; indisponível sem eventos.
5. Com 13/50 preços numéricos, publicar faixa e escopo reduz contatos incompatíveis? Métrica: CPL e qualificação por variante.
6. Com 50/50 anúncios desconhecidos por rede, qual canal da própria nó entrega mais leads por real nos últimos 7 dias? Métrica: gasto, leads e CPL separados Meta/Google, com cobertura e falhas explícitas.
7. Com temas observados em apenas 4/50, conteúdos sobre protótipo e propriedade encontram demanda orgânica? Métrica: cliques, impressões e variação por página no Search Console; evitar conclusão causal.
8. Com 12/50 fábricas e 15/50 SaaS, páginas separadas para parceria e software sob medida atraem intenções distintas? Métrica: sessões, leads e CPL por página/campanha no mesmo período.
