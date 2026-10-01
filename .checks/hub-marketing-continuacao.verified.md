# Hub marketing — verificação independente, rodada 3 final de código

**Verdict local: PASS. Integral T1/T2: needs_verification, com provas reais sob registro do coordenador.**
**Profile:** light. **Round:** 3 — scoped. **HEAD:** fcd6c6bd3e7debfdf8757e6044f3f2119ad68432. **Diff de código revisto:** b11e2587..fcd6c6bd. **Verifier:** independente, não autor.

A alteração local está aprovada tecnicamente para publicar a marketing-hub v3, dentro da autorização de produção existente e após checks operacionais do coordenador. Não encontrei bug acionável no diff. Os demais veredictos locais dos 49 critérios são **carried from b23932e0**, salvo T1-4/5 e T2-8/9, reafirmados abaixo. Provas de produção informadas nesta rodada não foram executadas por este verificador e devem constar em execution.md; não são convertidas em certificação independente aqui. T3 não está no escopo.

## Testes e regressão (verified at fcd6c6bd)

Reexecutei uma invocação Vitest dos cinco arquivos (marketingPlanner, App, marketingAdapters, marketingHub, marketingGoogleOAuth), reporter verbose e config temporária `envDir:false`: **194/194 PASS, 5 arquivos, exit 0, 33,53s**. Todos os testes adaptados aparecem individualmente aprovados. A configuração temporária foi removida. SQL e migrations não mudaram: resultados PGlite são **carried from b23932e0**, sem reexecução conforme escopo desta rodada. Nenhum código ou teste foi alterado pelo verificador; sem fault injection no perfil light.

## Adaptação dos testes Facebook

A mudança não enfraquece o critério: substitui descoberta por tentativa por uma consulta que segue a decisão T1 de remover os campos recusados. Evidência de produção recebida do coordenador: em 01/10 às 22:19:41Z, completa, sem_comentarios e sem_reacoes recusaram #10; sem_engajamento retornou posts. O diff remove permanentemente comments e reactions, preserva demais leituras e marca ausência como sem_permissao, sem inventar zero.

| Prova | Asserção localizada atual | Resultado |
|---|---|---|
| Consulta não contém campos proibidos | marketingAdapters.test.ts:357 `expect(postsChamadas(chamadas)).toEqual(['id,message,created_time,permalink_url,shares'])` | PASS; trava ambos campos e número de chamadas |
| Posts e métricas da conta preservados | marketingAdapters.test.ts:358–359 exige curtidas/comentarios/interacoes null, compartilhamentos2 e seguidores40/visualizacoes10/interacoes4 | PASS |
| Ausência explicitamente rotulada | marketingAdapters.test.ts:363–365 `calcularEstados` igual a posts.curtidas/posts.comentarios/posts.interacoes sem_permissao e bloco parcial | PASS |
| Recusa real básica não escondida | marketingAdapters.test.ts:372–375 exige uma chamada, posts vazio, mensagem contendo pages_read_user_content e `{posts:'sem_permissao',bloco:'parcial'}` | PASS |
| Falha comum preservada | marketingAdapters.test.ts:382–385 exige uma chamada, posts vazio, visualizacoes10 e `{posts:'erro',bloco:'parcial'}` | PASS |
| Não pressupõe novas permissões | marketingAdapters.test.ts:392–394 exige uma chamada e métricas de engajamento null mesmo com resposta básica aprovada | PASS |
| Contrato HTTP e isolamento | marketingHub.test.ts:459–470 exige bloco Facebook ok, comentários sem_permissao, Meta/IG/leads intactos, variante sem_engajamento e mensagem `omitidos após recusa de permissão` | PASS |

A mensagem em meta.ts:384 identifica uma limitação histórica verificada na Página em 01/10, não uma nova falha remota. `tentar()` continua registrando o erro remoto original quando a consulta básica falha; o teste separado demonstra isso. Registrar a limitação no evento já existente de subconsulta não mascara a mensagem real nem satisfaz artificialmente o critério de logs limpos: a consulta proibida de fato deixou de ocorrer. Voltar a ler reações/comentários exige nova autorização/prova de permissões, como indica o comentário de implementação.

## Gates reais

T1-4/5 estão **PASS local**, mas a versão v3 ainda precisa de leitura fresca e logs pós-deploy para encerrar a prova real pertinente. A comparação de variantes feita na v2 pertence ao registro de produção do coordenador. OAuth/contas/escritas/reconciliação/legado e demais gates humanos seguem seus próprios estados; esta aprovação local não os encerra. Os registros históricos abaixo preservam os 49 critérios e as limitações anteriores, com esta rodada prevalecendo sobre as afirmações de T1-4/5 relativas ao algoritmo antigo de fallback.

---

## Histórico da rodada 2
# Hub marketing — verificação independente T1/T2, rodada 2

**Verdict local: PASS. Verdict integral T1/T2: needs_verification.**
**Profile:** light. **Round:** 2 — scoped. **Diff integral:** e87ada92..b23932e07c78e661c0aa0c1832f31cbfb459c1b2. **Diff revisto:** c5458484..b23932e0. **Verifier:** subagente independente, não autor.

Código local aprovado nesta revisão para a sequência **migration → marketing-hub → app**, quando autorizada pelo Lucca e completados os checks de lint/tipagem/build executados pelo coordenador. Isto é aprovação técnica do código local, não autorização de produção nem certificação dos gates humanos. T3 continua fora desta revisão.

## Provas reexecutadas no HEAD b23932e0

- Vitest em lote, mesmos cinco arquivos da rodada 1, reporter verbose, configuração temporária `envDir:false`: **194/194 passaram**, 5 arquivos, exit 0, 36,92 s. Novos testes de datas HTTP, retorno do período, permissões Meta, estados de posts/campanhas/detalhe e dicionário apareceram e passaram.
- Ambos scripts PGlite: **PASS**, exit 0; 9/10/11 leads, restrições, RLS/grants, consumo state, Vault stub/auditoria/rollback. Mesmo caminho PGlite e comandos documentados na rodada 1.
- Reexecutei pessoalmente no scratch `%TEMP%/codex-hub-datas-regressao/app` os dois testes `reproduz a falha de 30/09`: **2 falhas esperadas**, exit 1, ausência de alert e perda do query periodo. A causa consta em execution.md:255–259. Scratch preparado com arquivos de 6aded586 pelo coordenador; não reconstruído por este verificador. A mesma dupla passou no HEAD atual.
- Config temporária do checkout removida ao final. Sem alteração de implementação/testes por este verificador. Sem produção, OAuth ou leitura de conteúdo .env. Sem faults injetados (perfil light).

## Achados encerrados / provas novas (verified at b23932e0)

| Item | Evidência atual | Resultado |
|---|---|---|
| T2-10/12, permissões Meta | marketing-service.ts:213 tipa objetos; ConnectionsPage.tsx:121 mapeia permissao/status para texto; marketingPlanner.test.tsx:599–600 exige `ads_read: granted` e `pages_read_user_content: declined` visíveis | PASS local |
| T2-19, datas impossíveis | normalize.ts:30–31 testa getTime antes de toISOString; marketingHub.test.ts:221–222 exige status422 e `{error_code:'PERIODO_INVALIDO'}` nos quatro inputs inválidos; parser e testes de formulário reexecutados | PASS local |
| T2-9, estados das células | marketingPlanner.test.tsx:608 exige dois elementos sem_permissao; :609 exige zero; :615 atraso em campanhas, :616 null indisponivel; :622–624 atraso e LPV ausente no detalhe sem inventar permissão. OverviewPage agora passa estado específico dos posts; arrays GA4/GSC/por_dia e gráficos propagam estado agregado | PASS local |
| T1-17, conjunto de escopos | marketingGoogleOAuth.test.ts:58–62 compara array literal adwords, analytics.readonly e webmasters.readonly; offline/consent/state/TTL e callback rerodados | PASS local; OAuth real pendente |
| T2-15, definições | marketingPlanner.test.tsx:629 enumera literalmente 30 artigos; :633 exige seis rótulos visíveis e :634 exige conteúdo não vazio em cada um. definicoes.ts adiciona alcance/interações/comentários de post e variação GSC; Dicionario compartilha seis campos nas três telas | PASS local no perfil light |
| T2-17, resposta HTTP | marketingHub.test.ts:215 status200 e :216 `.toMatchObject({periodo:{de:'2026-09-22',ate:'2026-09-23',dias:2}})`; provas UI URL/pedido/título reexecutadas | PASS local |
| T2-20, antes/depois | Dupla de regressões vermelha no scratch anterior e verde no HEAD, execution.md:255–259 documenta causas | PASS local |

## Estado dos 49 critérios

As evidências localizadas da tabela histórica abaixo são **carried from c5458484**, com provas integralmente reexecutadas em b23932e0; as sete linhas acima substituem explicitamente os antigos FAIL/gaps. Asserções nos arquivos tocados preservam o conteúdo, salvo novos casos descritos acima. Para localizar linhas no HEAD: marketingHub após o antigo :211 desloca +12; marketingGoogleOAuth após antigo :58 desloca +4; marketingPlanner linhas anteriores a :594 permanecem estáveis. Sem inferência de aprovação de produção.

| Critérios | Veredicto atual | Limite |
|---|---|---|
| T1-1,2 | needs_verification | Google/OAuth real e logs frescos |
| T1-3 | needs_verification | Sanitização local passa; scan/logs integrais não certificado por este verificador. Prefixos literais dos requisitos não são valores de segredo |
| T1-4,5 | needs_verification | Graph real com/sem campo e logs pós-deploy |
| T1-6,7,8 | needs_verification | Conta própria dot, RPC/login e desligar/religar reais |
| T1-9,10,11,12 | needs_verification | Escritas/publicações reais, autorização e remoção dos objetos |
| T1-13,14 | needs_verification | Reconciliação painéis e remoção autorizada do legado/versões |
| T1-15 | needs_verification | Fechamento/vault/memória do coordenador; status continua pendente |
| T1-16 | PASS documental | Leitura carregada da rodada 1 |
| T1-17 | PASS local / needs_verification integral | Prova OAuth real ainda ausente |
| T1-18,19,20 | PASS local | Sem certificação de runtime real |
| T1-21,22 | PASS local / needs_verification integral | Vault real ainda não exercitado |
| T2-1,2,3 | PASS local | Dados/backfill e PostgREST reais pendentes |
| T2-4 | PASS local / needs_verification integral | LPV/Ads Manager real ainda pendente |
| T2-5,6,7,8,9,10,11,12,13,14,15 | PASS local | Plataformas simuladas; perfil light não prova cada estado em cada célula |
| T2-16 | needs_verification | Reconciliação real R$172,64 |
| T2-17,18,19,20,21 | PASS local | Provas novas e regressões reexecutadas |
| T2-22 | PASS SQL isolado / needs_verification integral | Pré-condição de dez leads será verificada pela migration real |
| T2-23,24,25,26 | PASS local | Store mock + SQL isolado |
| T2-27 | PASS SQL isolado / needs_verification integral | Grants/RLS reais após migration |

Nenhum bug local acionável permanece dos achados da rodada 1. Swept existing permanece carregado de c5458484, com a exceção PERIODO_INVALIDO agora corrigida e reprovada positivamente. As limitações de amostragem do perfil light, stub Vault e runtime externo permanecem explícitas; não tornam os gates reais concluídos.

---

## Histórico da rodada 1 — substituído pelo veredicto acima
# Hub marketing — verificação independente T1/T2

**Verdict: FAIL local / needs_verification integral.**
**Profile:** light. **Round:** 1, T1/T2 completos; T3 fora desta rodada, coleta independente ainda em andamento e exige verificador próprio.
**Diff:** e87ada92..c5458484400f041c8416c20c8b981727f044dd1d. **Verifier:** subagente fresco, não autor. Provas executadas no HEAD c5458484 antes das correções seguintes. Referências abaixo pertencem a esse snapshot; não representam aprovação de commits posteriores.

184/184 testes passaram em uma invocação Vitest (5 arquivos), com cada nome impresso pelo reporter verbose. Os dois scripts SQL passaram. Isso não encerra gates reais. Código local bloqueado pelos achados abaixo; contas, OAuth, publicação e produção não foram acessados.

## Achados acionáveis

1. **P2 — Conexões quebra ao receber permissões Meta.** `_shared/marketing/conexoes.ts:65` declara `meta_permissoes: { permissao: string; status: string }[]`; HTTP prova objetos em `app/src/marketingHub.test.ts:594`. O consumidor declara `string[]` em `app/src/marketing/marketing-service.ts:211`; `ConnectionsPage.tsx` passa cada objeto a `semToken(i)` em ListaConcedida, que chama `texto.replace`. Uma resposta não vazia resulta em TypeError e derruba a tela. T2-12/10 falham no contrato integrado. A prova UI cobre somente null.
2. **P2 — Datas impossíveis viram 500.** `supabase/functions/_shared/marketing/normalize.ts:37`: `new Date(...).toISOString()` lança antes do retorno null. Reprodução com o módulo extraído por `git show c5458484:...`, stripTypeScriptTypes e `parsePeriodo('2026-99-01..2026-09-23', new Date('2026-10-01T12:00:00Z'))` produziu `RangeError: Invalid time value`. O catch geral do handler transforma em 500, não 422 PERIODO_INVALIDO. T2-19; UI já tem defesa mas API não.
3. **P2 — Motivo correto se perde na tabela orgânica.** `app/src/marketing/OverviewPage.tsx:324–326` passa apenas valor ao ValorMetrica. HTTP produz `posts.comentarios: sem_permissao` (marketingHub.test.ts:450), porém a célula recebe null sem estado e renderiza indisponível. T2-9 pede motivo correto visível; passar estados correspondentes do bloco/da rede e provar uma resposta de fallback real no consumidor. As tabelas de campanhas/detalhe também não propagam o estado atrasado do bloco; a prova atual só amostra LPV ausente.

## Provas executadas e limites

- `node node_modules/vitest/vitest.mjs run src/marketingPlanner.test.tsx src/App.test.tsx src/marketingAdapters.test.ts src/marketingHub.test.ts src/marketingGoogleOAuth.test.ts --reporter=verbose --config .verify-no-env.config.ts`: exit 0, 184 testes. Config temporária importa configuração original com `envDir:false`; nenhuma .env foi lida.
- `node supabase/tests/lead_classificacao_migration.mjs <PGlite>`: exit 0, cenários 9/10/11, RLS, grants, append-only, constraints e classe vigente.
- `node supabase/tests/marketing_google_oauth_migration.mjs <PGlite>`: exit 0, consumo único/expiração, grants RPC, Vault/auditoria e rollback. Vault é stub, sem prova de criptografia real ou concorrência multi-conexão Postgres.
- `<PGlite>` = `C:/Users/lucca/AppData/Local/Temp/codex-hub-marketing-pglite/node_modules/@electric-sql/pglite/dist/index.js`.
- Sem fault injection (perfil light). Sem Coverage join/Test policy (não existem seções na checklist). Tipagem/lint/build a cargo do coordenador, não certificados neste relatório.

## Critérios T1

Evidências são locais e as expressões abaixo não substituem produção. M = `app/src/marketingHub.test.ts`; O = `app/src/marketingGoogleOAuth.test.ts`; U = `app/src/marketingPlanner.test.tsx`; S = `supabase/tests/marketing_google_oauth_migration.mjs`.

| ID | Evidência localizada / expressão decisiva | Resultado integral |
|---|---|---|
| 1 | Sem leitura real fresca 7d nem logs posteriores; O:149 `expect(...blocos.ga4.ok).toBe(false)` cobre só falha Vault | NEEDS_VERIFICATION G2 |
| 2 | Sem Google real 30d; não há evidência que encerre critério | NEEDS_VERIFICATION G2 |
| 3 | M:740 `expect(canais).not.toContain(prefixo)` cobre resposta/registro/log mock. Scan integral de diff/docs/tasks/commits e logs reais não realizado pelo verificador; prefixos literais estão nos próprios requisitos | NEEDS_VERIFICATION |
| 4 | M:448 `expect(facebook).toMatchObject({ok:true,dados:{seguidores:40,visualizacoes:10}})` só Graph simulado | NEEDS_VERIFICATION real |
| 5 | M:455 `expect(recusas.map(...variante)).toEqual(['completa','sem_comentarios'])` não é Graph real com/sem campo | NEEDS_VERIFICATION real |
| 6 | U:505 link convite visível, sem conta real única/login efetivo | NEEDS_VERIFICATION G3 |
| 7 | Não há resposta real do dot comparada ao planner no mesmo instante | NEEDS_VERIFICATION G3 |
| 8 | M:173 GET agent 403; U papéis e App guards passam; falta RPC real + desligar/religar com sessão própria | NEEDS_VERIFICATION G3 |
| 9 | M:269 resultado PAUSED e M:295 payload ACTIVE em mock; nenhuma remoção/Ads Manager real | NEEDS_VERIFICATION G5 |
| 10 | M:302 `expect(r.status).toBe(503)` prova flag; campanha/removal real não provados | NEEDS_VERIFICATION G5 |
| 11 | M:348 published/external_post_id, M:384 processados 0 em cancelado; cron/rede reais em cinco minutos ausentes | NEEDS_VERIFICATION G4 |
| 12 | M:271 actor_role MARKETING_AGENT/status ok no mock Meta, não todas escritas reais e remoções | NEEDS_VERIFICATION G3/G5 |
| 13 | Sem reconciliação real por dia/fuso e painéis | NEEDS_VERIFICATION |
| 14 | Nenhuma listagem real pós-remoção/versões; operação não autorizada nesta rodada | NEEDS_VERIFICATION G7 |
| 15 | execution.md:4 `status: needs_verification`; atualização vault/memória final não verificada | NEEDS_VERIFICATION coordenador |
| 16 | rotacao-segredos.md tabela Os seis segredos contém nome/local/painel/dependente/ordem/prova; revisão documental realizada, nenhuma credencial visível | PASS documental |
| 17 | O:58 scopes `.toEqual([...GOOGLE_ESCOPOS])`, O:59 offline, O:60 consent, O:62 64 hex, O:63 TTL 600; U:574 POST connect. Scopes esperados importam constante do próprio produtor (prova fraca para conjunto exato); consentimento real ausente | NEEDS_VERIFICATION real + lacuna prova |
| 18 | O:75 Location state_invalido, O:76 fetch não chamado, O:77 save não chamado; O:84 fetch uma vez; S:41–44 único/expirado | PASS local; runtime real pendente |
| 19 | O:115–119 preservação Vault e redirect em casos access_denied/http/network/no-refresh/partial-scopes; O:158 troca_falhou; U:566 alert | PASS local |
| 20 | O testes dot/aal1/banido/anônimo; U:560 `queryByRole(button, Conectar Google).toBeNull()` | PASS local |
| 21 | O:137–140 Vault primeiro/fallback; O:150 fetch não chamado na falha Vault; O:94 audit/states/log sem fixture; S:31 RPC negada clientes | NEEDS_VERIFICATION Vault real |
| 22 | O:91 audit length 1; O:92 kind google.conectar/NO_ADMIN; S:54–58 duas conexões/objetos vazios; rollback S:49 | PASS local; Vault real pendente |

## Critérios T2

A = `app/src/marketingAdapters.test.ts`; L = `supabase/tests/lead_classificacao_migration.mjs`. Demais aliases como acima.

| ID | Evidência localizada / expressão decisiva | Resultado |
|---|---|---|
| 1 | U:516 Leads válidos 0; U:517 não calculável; U:518 Testes excluídos 10 | PASS local; backfill real pendente |
| 2 | M:700 validos e M:701 por_canal_validos `toBe(classe === 'real' ? 1 : 0)` em quatro classes | PASS local |
| 3 | M:706 length 4; M:707 classificado_por ADMIN/papel NO_ADMIN; L:31 criado_em is not null, L:51 classe vigente real | PASS local; store PostgREST não exercitado |
| 4 | A:279 metaLpv landing_page_view 7; A:297 campanha lpv 612; U:590 50 e U:591 R$2,00 no detalhe. Comparação Ads Manager ausente | NEEDS_VERIFICATION real; UI Campanhas amostrada |
| 5 | U:588 LANDING_PAGE_VIEWS na linha de objetivo; U:592 diagnóstico, não funil individual | PASS local |
| 6 | M:490 lpv null; M:491 estado indisponivel; U:527–528 — indisponível | PASS local |
| 7 | U:519 só Meta — Google Ads indisponível; OverviewPage cálculo inspecionado | PASS local; caso ambas ok pouco coberto |
| 8 | M:468 facebook sem_permissao, M:469 ga4 sem_permissao, M:470 meta_ads.ok true; A:405–407 Graph 10/200/299 true | PASS local; plataformas simuladas |
| 9 | A:415 `{b:'zero',c:'indisponivel'}`; M:508 erros orgânicos; U:527 só LPV. Achado 3 rompe motivo em posts | FAIL local |
| 10 | M:549 lista IDs capacidades; M:550 chaves exatas; U:557 uma linha. Achado 1 derruba a tela quando permissões existem | FAIL local integrado |
| 11 | M:580–585 publicação IG/Google ok, demais nao_verificado e texto leitura não prova; M:556 ausência de POST Graph | PASS local |
| 12 | M:593 scopes, M:594 permissões objetos; U:559 apenas null. Contrato incompatível achado 1 | FAIL local |
| 13 | M:613 status por papel; M:627 nenhum prefixo token; rotas guardadas; UI quebrada não constitui vazamento | PASS local segurança; runtime pendente |
| 14 | A:311 conta id/moeda/fuso/versao v25 e A:312 fields; U:520 os quatro valores | PASS local |
| 15 | U:521 inline_link_clicks, U:522 todos os cliques. Dicionario.tsx:6–12 enumera seis campos visíveis; definicoes.ts listas por tela. Não existe assertion para cada métrica exibida (comentários e posições/ganhos GSC também exigem revisão individual) | NEEDS_VERIFICATION cobertura amostral |
| 16 | Sem Ads Manager/planner real 2026-08-31..2026-09-29 | NEEDS_VERIFICATION real |
| 17 | U teste URL/pedido/título custom; U:347 contrato invoke; A período livre. Não localizado assertion HTTP resposta com exatamente 22..23 neste lote | NEEDS_VERIFICATION prova resposta exata |
| 18 | U:376/381/384 período em menu; U:392/403 datas; U:407–409 avançar | PASS local |
| 19 | U:426 erro e U:428 sem request; U:440 366 dias; M:211 422 só invertido. Achado 2 | FAIL local |
| 20 | U:361–366 reproduz data incompleta e U:376 menu após correção. Falha na base reportada pelo coordenador, não reexecutada aqui; registro causa não localizado no execution atual | NEEDS_VERIFICATION evidência antes/depois/documento |
| 21 | U:447 href detalhe e U:450 hrefs menu para quatro períodos | PASS local |
| 22 | L:24 rejects 9/11, L:26 tabela null; L:31 count testes=10 com motivo/papel; limites externos sem backfill | PASS SQL isolado; produção pendente |
| 23 | U:540 Real sem reload, U:541 retry mesmo request; U:546 vazio; UI fields/botões inspecionados | PASS local |
| 24 | M:685–686 GET/POST 403 dot/aal1; U:552 leads não chamado; U:561 menu ausente | PASS local |
| 25 | M:698 idempotente; M:706/708 quatro classificações/ações; M:709 kind/target, M:710 payload sem PII | PASS local |
| 26 | M:724 status422, M:725 INVALID_REQUEST, M:726 campos; M:728–729 zero gravações; L constraints | PASS local |
| 27 | L:32 policies=0, L:33 RLS=true, L:34 grants=0; L:38 clientes permission denied | PASS SQL isolado; produção pendente |

## Swept existing e escopo da independência

Relidos: `_shared/marketing/validacao.ts` é exercitado pela suite adapters (campanha/payload/post); `20260930215739_hub_marketing.sql:34` mantém request_id unique; linha 91 contém for update skip locked; `handler.ts:281` bloco captura falha independente; `handler.ts` autorizar é exercitado pelos papéis; connections cache 15 min/fresco coberto M:667–676; formatos de erro seguem handler. O existing de PERIODO_INVALIDO não se sustenta para Invalid Date (achado 2).

Fontes integralmente abertas: checklist .checks, tarefas T1/T2 e SKILL.md/verify.md. Perfil light não faz comparação de design binding nem fault injection. Documentos upstream herdados não foram novamente auditados; tarefas dizem ser o registro de decisão. Não houve publicação, push, PR, acesso OAuth, leitura de .env ou alteração de implementação pelo verificador.

Nenhum PASS local acima fecha gates de produção. A rodada seguinte deve rodar o lote inteiro no novo HEAD e rever achados + todos resultados não PASS; carregar explicitamente as demais evidências deste SHA.


