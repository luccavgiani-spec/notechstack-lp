// Dicionário de métricas (T2 critério 15): toda métrica exibida tem definição em
// texto visível, com campo de origem, unidade, escopo, fórmula, janela e limitações.
// Fonte dos nomes de campo: as consultas em supabase/functions/_shared/marketing.

export type Definicao = {
  nome: string
  origem: string
  unidade: string
  escopo: string
  formula: string
  janela: string
  limitacoes: string
}

const JANELA_META = 'dias do período no fuso da conta de anúncios (time_range da Insights API); o fuso aparece no cabeçalho do bloco Meta'
const JANELA_GOOGLE = 'datas do período no fuso da conta Google Ads (segments.date)'
const ATRIBUICAO_META = 'configuração de atribuição da conta: padrão da conta (não informado pela API)'

export const DEFINICOES = {
  gasto: {
    nome: 'Gasto',
    origem: 'Meta: spend (Insights, level=account ou campaign). Google: metrics.cost_micros.',
    unidade: 'moeda da conta, guardada em centavos inteiros e exibida em R$',
    escopo: 'conta inteira (Visão geral) ou a campanha (Campanhas)',
    formula: 'Meta: valor do período devolvido numa chamada só. Google: soma dos dias de cost_micros ÷ 1.000.000.',
    janela: `Meta: ${JANELA_META}. Google: ${JANELA_GOOGLE}.`,
    limitacoes: 'É o valor estimado pela plataforma; o dia de hoje ainda muda (estado "atrasado").',
  },
  gasto_pago: {
    nome: 'Gasto em anúncios (total pago)',
    origem: 'soma do Gasto Meta Ads e do Gasto Google Ads',
    unidade: 'R$',
    escopo: 'só as plataformas que responderam; o detalhe do card diz quais entraram',
    formula: 'Meta + Google quando os dois blocos estão ok; senão, só a fonte disponível ("só Meta — Google Ads indisponível").',
    janela: 'a de cada plataforma (ver Gasto)',
    limitacoes: 'Nunca soma uma fonte que falhou como se fosse zero.',
  },
  impressoes: {
    nome: 'Impressões',
    origem: 'Meta: impressions. Google: metrics.impressions.',
    unidade: 'contagem de exibições',
    escopo: 'conta inteira ou campanha',
    formula: 'valor do período devolvido pela plataforma',
    janela: `Meta: ${JANELA_META}. Google: ${JANELA_GOOGLE}.`,
    limitacoes: 'A mesma pessoa pode gerar várias impressões.',
  },
  alcance: {
    nome: 'Alcance',
    origem: 'Meta: reach. O Google Ads não devolve alcance nesta consulta.',
    unidade: 'pessoas (estimativa)',
    escopo: 'conta inteira ou campanha',
    formula: 'valor do período devolvido numa chamada sem quebra diária',
    janela: JANELA_META,
    limitacoes: 'Pessoas únicas estimadas pela Meta: não se soma entre dias, campanhas ou anúncios.',
  },
  cliques: {
    nome: 'Cliques',
    origem: 'Meta: clicks (todos os cliques, "Cliques (todos)" no Gerenciador). Google: metrics.clicks.',
    unidade: 'contagem de cliques',
    escopo: 'conta inteira ou campanha',
    formula: 'valor do período devolvido pela plataforma',
    janela: `Meta: ${JANELA_META}. Google: ${JANELA_GOOGLE}.`,
    limitacoes: 'Na Meta inclui cliques que não levam ao site (perfil, reações, expandir a mídia); não é o mesmo que Cliques no link.',
  },
  cliques_link: {
    nome: 'Cliques no link',
    origem: 'Meta: inline_link_clicks. Não há equivalente separado no Google Ads.',
    unidade: 'contagem de cliques',
    escopo: 'conta inteira ou campanha',
    formula: 'valor do período devolvido pela plataforma',
    janela: `${JANELA_META}; a Meta conta inline_link_clicks com janela fixa de 1 dia após o clique.`,
    limitacoes: 'A Meta conta Cliques (clicks) e Cliques no link (inline_link_clicks) em campos separados, então um não é recorte exato do outro no total: em 31/08–29/09/2026 vieram 1.499 cliques e 1.500 cliques no link. O painel mostra os dois como a Meta devolve, sem ajustar.',
  },
  lpv: {
    nome: 'Visualizações da página de destino',
    origem: 'Meta: actions[action_type=landing_page_view]. Não se aplica ao Google Ads.',
    unidade: 'contagem de carregamentos da página de destino',
    escopo: 'conta inteira, campanha ou dia',
    formula: 'valor do período devolvido pela plataforma',
    janela: `${JANELA_META}; ${ATRIBUICAO_META}`,
    limitacoes: 'Conta quando a pessoa clica no link do anúncio e a página carrega com o pixel; quem sai antes do carregamento não conta. Sem a ação no período, aparece "—" com o estado, nunca 0.',
  },
  custo_lpv: {
    nome: 'Custo por LPV',
    origem: 'calculado no painel a partir de spend e landing_page_view',
    unidade: 'R$ por visualização',
    escopo: 'o mesmo do gasto e da LPV da linha',
    formula: 'gasto ÷ visualizações da página de destino',
    janela: 'a das duas métricas',
    limitacoes: '"não calculável" quando a LPV é zero; "—" com o estado quando a LPV não veio.',
  },
  lpv_por_clique: {
    nome: 'LPV por clique no link',
    origem: 'calculado no painel a partir de landing_page_view e inline_link_clicks',
    unidade: 'proporção (%)',
    escopo: 'a campanha',
    formula: 'visualizações da página de destino ÷ cliques no link',
    janela: 'a das duas métricas',
    limitacoes: 'Diagnóstico, não funil individual: as duas contagens vêm de eventos e janelas diferentes e não provam que cada clique virou uma visualização.',
  },
  conversoes: {
    nome: 'Leads / conversões (plataforma)',
    origem: 'Meta: actions do tipo lead (recuo: offsite_conversion.fb_pixel_lead, onsite_conversion.lead_grouped). Google: metrics.conversions.',
    unidade: 'contagem (no Google pode ser fracionada)',
    escopo: 'conta inteira ou campanha',
    formula: 'valor do período devolvido pela plataforma',
    janela: `Meta: ${ATRIBUICAO_META}. Google: modelo de atribuição das conversões da conta.`,
    limitacoes: 'É o que a plataforma atribui a si mesma; não é o lead do funil próprio nem passa pela classificação.',
  },
  custo_conversao: {
    nome: 'Custo por lead / conversão (plataforma)',
    origem: 'calculado no painel',
    unidade: 'R$ por lead/conversão',
    escopo: 'por plataforma ou campanha',
    formula: 'gasto ÷ leads/conversões da própria plataforma',
    janela: 'a das duas métricas',
    limitacoes: '"não calculável" quando a plataforma devolve zero conversões. Não é o CPL do funil.',
  },
  leads_validos: {
    nome: 'Leads válidos',
    origem: 'tabela leads do funil próprio + classificação mais recente em lead_classificacao',
    unidade: 'contagem de leads',
    escopo: 'todos os canais',
    formula: 'leads criados no período cuja classificação mais recente é "real"',
    janela: 'created_at de 00:00 de De até 24:00 de Até, horário de São Paulo',
    limitacoes: 'Lead novo fica "a classificar" e não entra até o Lucca classificar.',
  },
  classes_lead: {
    nome: 'Testes, inválidos, duplicados e a classificar',
    origem: 'classificação mais recente de cada lead (lead_classificacao)',
    unidade: 'contagem de registros',
    escopo: 'registros do funil próprio no período',
    formula: 'registros por classe; "Registros no funil (todos)" soma todas as classes',
    janela: 'a mesma de Leads válidos',
    limitacoes: 'Ficam fora de Leads válidos e do custo por lead.',
  },
  cpl: {
    nome: 'Custo por lead (válido)',
    origem: 'calculado no painel',
    unidade: 'R$ por lead válido',
    escopo: 'gasto pago das fontes indicadas ÷ leads válidos de todos os canais',
    formula: 'gasto em anúncios (total pago) ÷ leads válidos',
    janela: 'a do gasto e a dos leads',
    limitacoes: '"não calculável" com zero leads válidos. Considera só leads confirmados ("real"); os "a classificar" ficam fora. Não atribui lead a canal: divide todo o gasto por todos os leads válidos.',
  },
  canal_lead: {
    nome: 'Canal do lead',
    origem: 'utm_source, utm_medium, gclid e fbclid do lead',
    unidade: 'categoria',
    escopo: 'cada lead',
    formula: 'fbclid ou fonte Meta → Meta; gclid ou google + mídia paga → Google Ads; buscador ou organic → busca orgânica; sem UTM → direto; o resto → outros',
    janela: 'a de Leads válidos',
    limitacoes: 'Depende das UTMs chegarem ao formulário; não é atribuição da plataforma.',
  },
  sessoes: {
    nome: 'Sessões (GA4)',
    origem: 'GA4 Data API: sessions, por sessionDefaultChannelGroup',
    unidade: 'contagem de sessões',
    escopo: 'propriedade GA4 do site',
    formula: 'valor do período devolvido pela API',
    janela: 'datas no fuso da propriedade GA4',
    limitacoes: 'Depende do consentimento e do carregamento da tag no site.',
  },
  usuarios: {
    nome: 'Usuários (GA4)',
    origem: 'GA4 Data API: totalUsers',
    unidade: 'usuários',
    escopo: 'por canal',
    formula: 'valor por canal devolvido pela API',
    janela: 'datas no fuso da propriedade GA4',
    limitacoes: 'Não somável entre canais: o mesmo usuário pode vir por mais de um.',
  },
  eventos_chave: {
    nome: 'Eventos-chave (GA4)',
    origem: 'GA4 Data API: keyEvents (por canal, por dia e por eventName)',
    unidade: 'contagem de eventos',
    escopo: 'propriedade GA4 do site',
    formula: 'valor do período devolvido pela API',
    janela: 'datas no fuso da propriedade GA4',
    limitacoes: 'Conta eventos marcados como chave no GA4, não leads classificados.',
  },
  ga4_google_ads: {
    nome: 'Conferência pelo GA4',
    origem: 'GA4 Data API: advertiserAdCost, advertiserAdClicks, advertiserAdImpressions',
    unidade: 'R$, cliques, impressões',
    escopo: 'Google Ads vinculado à propriedade GA4',
    formula: 'valor do período devolvido pela API',
    janela: 'datas no fuso da propriedade GA4',
    limitacoes: 'Serve só para conferir o Google Ads; pode diferir por fuso e atraso de importação.',
  },
  gsc_cliques: {
    nome: 'Cliques orgânicos (Search Console)',
    origem: 'Search Console searchanalytics: clicks',
    unidade: 'contagem de cliques',
    escopo: 'propriedade do site no Search Console',
    formula: 'valor do período devolvido pela API',
    janela: 'datas no fuso do Pacífico (padrão do Search Console)',
    limitacoes: 'Os últimos 2–3 dias ainda consolidam (estado "atrasado").',
  },
  gsc_impressoes: {
    nome: 'Impressões orgânicas (Search Console)',
    origem: 'Search Console searchanalytics: impressions',
    unidade: 'contagem de exibições nos resultados',
    escopo: 'propriedade do site no Search Console',
    formula: 'valor do período devolvido pela API',
    janela: 'datas no fuso do Pacífico',
    limitacoes: 'Os últimos 2–3 dias ainda consolidam.',
  },
  gsc_ctr: {
    nome: 'CTR orgânico',
    origem: 'calculado no painel a partir de clicks e impressions do Search Console',
    unidade: '%',
    escopo: 'propriedade do site',
    formula: 'cliques ÷ impressões',
    janela: 'a das duas métricas',
    limitacoes: 'Zero quando não há impressões.',
  },
  seguidores: {
    nome: 'Seguidores',
    origem: 'Instagram: followers_count. Facebook: followers_count da página.',
    unidade: 'contas',
    escopo: 'perfil ou página',
    formula: 'valor de hoje',
    janela: 'momento da leitura, não o período',
    limitacoes: 'Não mostra a variação no período.',
  },
  alcance_ig: {
    nome: 'Alcance (Instagram)',
    origem: 'Instagram insights: reach (metric_type=total_value, period=day)',
    unidade: 'contas (estimativa)',
    escopo: 'perfil do Instagram',
    formula: 'valor do período; acima de 30 dias, somado em janelas',
    janela: 'dias do período',
    limitacoes: 'Somado em janelas fica aproximado (aviso abaixo da tabela). Não existe no Facebook nesta consulta.',
  },
  visualizacoes: {
    nome: 'Visualizações',
    origem: 'Instagram: views. Facebook: page_media_view (substituto de page_impressions, que saiu em 15/11/2025).',
    unidade: 'contagem de visualizações',
    escopo: 'perfil ou página',
    formula: 'Instagram: valor do período. Facebook: soma dos dias.',
    janela: 'dias do período',
    limitacoes: 'As duas redes medem coisas diferentes; não some uma com a outra.',
  },
  interacoes: {
    nome: 'Interações',
    origem: 'Instagram: total_interactions. Facebook: page_post_engagements.',
    unidade: 'contagem de interações',
    escopo: 'perfil ou página',
    formula: 'Instagram: valor do período. Facebook: soma dos dias.',
    janela: 'dias do período',
    limitacoes: 'Definições diferentes em cada rede.',
  },
  contas_engajadas: {
    nome: 'Contas engajadas (Instagram)',
    origem: 'Instagram insights: accounts_engaged',
    unidade: 'contas',
    escopo: 'perfil do Instagram',
    formula: 'valor do período',
    janela: 'dias do período',
    limitacoes: 'Não existe no Facebook nesta consulta.',
  },
} satisfies Record<string, Definicao>

export type IdMetrica = keyof typeof DEFINICOES

export const METRICAS_VISAO_GERAL: IdMetrica[] = [
  'gasto_pago', 'gasto', 'impressoes', 'alcance', 'cliques', 'cliques_link', 'lpv', 'custo_lpv', 'conversoes', 'custo_conversao',
  'leads_validos', 'classes_lead', 'cpl', 'canal_lead',
  'sessoes', 'usuarios', 'eventos_chave', 'ga4_google_ads',
  'seguidores', 'alcance_ig', 'visualizacoes', 'interacoes', 'contas_engajadas',
  'gsc_cliques', 'gsc_impressoes', 'gsc_ctr',
]

export const METRICAS_CAMPANHAS: IdMetrica[] = ['gasto', 'cliques', 'lpv', 'custo_lpv', 'conversoes', 'custo_conversao']

export const METRICAS_DETALHE: IdMetrica[] = ['gasto', 'impressoes', 'alcance', 'cliques', 'cliques_link', 'lpv', 'custo_lpv', 'lpv_por_clique', 'conversoes', 'custo_conversao']
