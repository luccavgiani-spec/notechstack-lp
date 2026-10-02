# Roteiro de validação do dot — T1:6–8
Status: planejado, não executado. Data: 2026-10-01. Responsáveis: Lucca executa convite e controles; dot executa leitura; coordenador registra evidências sanitizadas. G3 precisa estar liberado. Este documento não declara aprovação em produção.

## Preparação
Usar o ambiente previsto no movimento, com a versão integrada confirmada pelo coordenador. Registrar commit, ambiente, horário e fuso. Preparar duas sessões separadas: Lucca administrador e dot MARKETING_AGENT. Não usar sessão do administrador para provar permissão do dot.

Não salvar senha, JWT, chave, URL de convite, cookies, cabeçalhos Authorization nem conteúdo pessoal em evidências. Capturas devem ocultar esses dados. Não disparar novos convites caso já exista convite válido: Lucca verifica primeiro a aba Dot e o estado da conta.

## Critério 6 — convite e primeira entrada
1. Lucca abre a aba Dot e convida a conta de teste aprovada no plano: notechstack+dot@gmail.com. Essa é uma ação humana pendente de G3; não foi realizada nesta coleta.
2. Dot abre o convite privadamente e define a própria senha em /no/marketing/acesso.
3. Lucca verifica por ferramenta administrativa autorizada que auth.users contém exatamente 1 conta correspondente, com app_metadata.role = MARKETING_AGENT, e que a autorização efetiva é MARKETING_AGENT. Guardar apenas contagem e papel, nunca linha completa de usuário. Se houver duplicidade, interromper e reportar ao coordenador; não apagar contas.
4. Dot entra e alcança overview sem desafio TOTP. Registrar rota, status e papel sanitizados.

Aceite: contagem 1, papel MARKETING_AGENT, overview acessível, nenhum TOTP. Resultado atual: NÃO EXECUTADO.

## Critério 7 — conciliação da leitura
Pergunta exata ao dot: “quanto a nó gastou e quantos leads vieram da Meta e do Google nos últimos 7 dias, e quais páginas mais cresceram no Search Console”.

1. Fixar periodo=7d nas duas sessões; registrar intervalo concreto início/fim, fuso e horário da captura. Evitar comparar janelas móveis coletadas em momentos diferentes.
2. Lucca captura os valores visíveis no planner; dot faz a leitura autorizada correspondente. Registrar cobertura/status de cada fonte antes de comparar números.
3. Comparar gasto Meta e Google separadamente, leads Meta e Google separadamente, moeda e arredondamento. Dado indisponível/erro não vale zero.
4. Para Search Console, usar mesma métrica de crescimento, ordenação e intervalo de comparação exibidos no planner. Registrar URLs de páginas públicas, cliques/impressões e variação conforme disponíveis; não inventar cálculo ausente.
5. Se houver cache ou atualização entre capturas, repetir ambas uma vez com mesmo conjunto de dados. Divergência persistente deve registrar valores e horário e permanecer reprovada até investigação.

Aceite: todos os valores conciliados, com mesma janela e definições. A resposta do dot deve explicitar falhas parciais. Resultado atual: NÃO EXECUTADO.

| Item | Planner | Dot | Janela/fuso | Resultado |
| --- | --- | --- | --- | --- |
| Gasto Meta | pendente | pendente | pendente | não executado |
| Leads Meta | pendente | pendente | pendente | não executado |
| Gasto Google | pendente | pendente | pendente | não executado |
| Leads Google | pendente | pendente | pendente | não executado |
| Crescimento por página Search Console | pendente | pendente | pendente | não executado |

## Critério 8 — fronteiras e desligamento
Executar apenas requisições de leitura com a sessão real do dot, por cliente interno autorizado. Não copiar tokens para terminal, logs ou documento. Caminhos abaixo são os contratos do plano; manter o prefixo de API implantado pelo projeto.

| Ação na sessão dot | Esperado |
| --- | --- |
| GET /marketing-hub/agent | HTTP 403, código FORBIDDEN |
| RPC list_admin_saldos | HTTP 403 |
| Abrir /no/projetos | Redirecionar para /nao-autorizado |
| Lucca usa Desligar dot; dot tenta chamada ao hub | HTTP 401, código UNAUTHENTICATED |
| Lucca usa Religar; dot GET overview?periodo=7d | HTTP 200 |

Após Desligar, testar pelo menos overview e agent com a sessão já aberta para evidenciar revogação, sem novo login mascarando o comportamento. “Qualquer chamada” no aceite refere-se às chamadas autenticadas do dot ao hub, não recursos públicos/estáticos. Depois de Religar, reutilizar a sessão válida quando permitido pelo contrato; se exigir nova autenticação, registrar e submeter a divergência ao coordenador.

Aceite: todos os resultados acima. Resultado atual: NÃO EXECUTADO.

## Registro de execução
Preencher somente após realizar cada ação: critério, horário, ambiente/commit, sessão/papel, método/rota, HTTP/código ou redirecionamento, esperado, observado, aprovado/reprovado e referência sanitizada. Não transformar “roteiro pronto” em “critério concluído”.

O coordenador encerra T1:6–8 apenas com evidência real e verificação independente. Convite, ativação, desligamento, religamento e conciliação continuam pendentes.
