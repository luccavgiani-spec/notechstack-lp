# Relatório do lote D
Data: 2026-10-01. Perfil TLC light. Construção documental; revisão independente a cargo do coordenador.

| Critério | Prova executada | Resultado |
| --- | --- | --- |
| T3:1 | python docs/mercado/2026-10-agencias-software/validar.py | PASS: 50 linhas, 50 domínios únicos, cabeçalho exato de 17 colunas, ordem tipo/nome |
| T3:2 | mesmo comando | PASS: todos os enums válidos |
| T3:3 | leitura pública das URLs em fontes, web search/open; validador verifica apenas estrutura de URLs | 50 marcas com páginas oficiais abertas; revisão factual independente pendente |
| T3:4 | revisão integral do CSV + regex de e-mail/telefone do validador | 0 contatos identificados; dados empresariais; regex não prova ausência de nomes de pessoas |
| T3:5 | validador + leitura da síntese | 5 seções temáticas, Observações/Hipóteses separadas, contagens reproduzidas |
| T3:6 | contagem CSV e revisão das páginas comparáveis | 24/50 white-label; 0/50 promessa conjunta de roadmap/protótipo em 3 dias identificada; 5 comparáveis |
| T3:7 | validador + revisão | 8 perguntas finais com contagem e métrica; métricas não instrumentadas identificadas como indisponíveis |
| T1:6–8 | leitura de roteiro-dot.md contra plano | Roteiro pronto; execução real NÃO REALIZADA, depende de G3/Lucca |
| Higiene | git diff --cached --check | PASS, nenhuma saída |
| Escopo | git diff --cached --stat | somente diretórios autorizados |

Contagens finais: fábrica white-label 12; SaaS 15; software house 23. CTA formulário 9, outro 16, orçamento 8, WhatsApp 8, diagnóstico 5, agendar call 4. Valores numéricos em reais 13/50; temas observados 4/50; LinkedIn público 2/50.

## Limites reais
- Meta e Google: 50/50 nao_verificado em cada rede. Meta Ads Library retornou 403; Google Ads Transparency abriu somente shell, sem resultados por marca. Não foi feita verificação individual de anunciantes; nenhum formato pago foi inferido.
- Valores são autodeclarações públicas de escopos diferentes; nenhum orçamento solicitado, teste contratado ou fluxo comercial completado.
- Amostra intencional e indexável; não há afirmação de representatividade. Sede desconhecida fica nao_informado; revisão independente deve confirmar adequação geográfica de plataformas internacionais antes de promover a base a benchmark nacional.
- “0/50 promessa identificada” é resultado das páginas inspecionadas, não prova de inexistência em todo o site ou mercado.
- Sem escrita no app/banco, sem contas, OAuth, segredos, mensagens, push, PR ou deploy. Não houve mudanças de arquitetura/conectores que exijam sync-vault neste lote.
- O Lucca pode anexar marcas.csv e sintese.md ao chat do dot, conforme o default do plano. Importação ao planner permanece fora do escopo.
