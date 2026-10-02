# Verificação SEO — 28/09/2026

Auditoria: `python .checks/seo/audit.py`; atribuição: `node .checks/seo/test-attribution.mjs`; anexos: `node .checks/home-assets/test-lead-attachments.mjs`.

25 URLs verificadas: títulos únicos, um H1, metadados, canonical, JSON-LD, imagens com alt e links/assets locais. Quatro páginas de serviços, três cases e seis artigos mantidos e adaptados ao contato. Diagnóstico pago redirecionado permanentemente para Contato; ofertas de R$ 149,90 e previews sociais antigos retirados desse fluxo.

Lighthouse 13.5.0, mobile simulado, Chrome 153, servidor local com gzip:

| Página | Performance | Acessibilidade | Boas práticas | SEO | LCP |
|---|---:|---:|---:|---:|---:|
| Home | 98 | 100 | 100 | 100 | 2,3 s |
| Agência | 97 | 100 | 100 | 100 | 2,3 s |
| Contato | 100 | 100 | 100 | 100 | 1,7 s |

Resultados de laboratório, não garantem posição ou Core Web Vitals reais. Imagens LCP prioritárias; vídeos, demonstrações, 3D e marketing sob demanda; CSS da home e agência dedicado. Testes visuais desktop/mobile, mapa compartilhado, navegação, vídeo e Kanban realizados. Testes de anexos usam mocks e validação negativa em produção, sem envio de lead real.

## Indicadores

Agrupar eventos por sid e preservar a primeira origem. Taxas da home: sessões com diag_cta / site_visit; diag_concluir / diag_abrir; lead_submit / diag_concluir; lead_submit / site_visit. As cinco respostas registram form_pergunta_concluida. Agência: acompanhar agencia_cta e agencia_lead_enviado separadamente. Origem de busca sem UTM é inferida do referrer; campanhas explícitas prevalecem. Pagamentos deixam de ser KPI desse fluxo de contato.

Search Console: comparar semanalmente páginas válidas/indexadas, impressões sem marca, posição de sistema sob medida e variações, CTR orgânico e Core Web Vitals. Cruzar leads de origem organic com visitas. Propriedade nova precisa acumular dados; sitemap enviado não significa indexação imediata.
