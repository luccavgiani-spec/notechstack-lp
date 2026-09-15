# R1-05 · Dashboard do cliente — Verification

**Verdict**: PASS
**Profile**: ui
**Functional commit**: `da418dc`
**Verifier**: independent fresh sub-agent (`r1_05_verifier_luna`)
**Checks proven**: 17/17

O dashboard do cliente foi verificado de ponta a ponta em desktop e mobile. O desenho aprovado — abas horizontais a 375 px, tiers comparáveis e protótipo em mockup de celular — foi tratado como binding.

## Resultados

| Critérios | Prova independente | Resultado |
|---|---|---|
| C1–C4 | DOM + E2E nas seis rotas; shell, aviso, acesso permanente e expirado | PASS |
| C5 | Playwright 375 px; seis módulos alcançáveis, overflow horizontal e `aria-current` | PASS |
| C6–C7 | Conteúdo publicado, três tiers, campos opcionais e composição 1440/375 | PASS |
| C8–C9 | pgTAP da RPC + escolha/reload no navegador; troca e no-op sem evento duplicado | PASS |
| C10 | `iframe` no mockup, navegação interna e link externo | PASS |
| C11–C12 | Kanban 17/27 = 63%, três colunas/campos e CLIENT sem mutações | PASS |
| C13–C16 | Copy bloqueada, ausência de controles e estados vazios sem erro | PASS |
| C17 | lint global, build, TypeScript, Vitest, pgTAP e Playwright | PASS |

## Gates executados

- `npm test -- --run src/clientDashboard.test.tsx`: 23/23.
- `npm run build`: PASS.
- `npx tsc -b --pretty false`: PASS.
- `npm run lint`: PASS após o arquivo concorrente da R1-06 voltar a um estado válido.
- `npm run test:e2e -- e2e/r1-05-dashboard-cliente.spec.ts`: 2/2, Chromium 1440 px e 375 px.
- `supabase test db supabase/tests/r1_05_dashboard_client.test.sql --local`: 17/17.
- `supabase db advisors --local`: nenhuma finding.
- Fixture E2E após cleanup: zero usuários `r105-*` restantes.

## Segurança

As funções `SECURITY DEFINER` usam `search_path = ''`, revogam `PUBLIC`/`anon` e validam membership. A suíte pgTAP rejeita preferência de outro tenant e comprova que `insert`, `update` e `delete` do Kanban pelo CLIENT não alteram dados. O estado expirado expõe apenas o shell estreito; roadmap e Kanban continuam retornando zero linhas sob RLS.

## Observação de concorrência

Durante a verificação, o lint global falhou transitoriamente em um arquivo não pertencente ao commit R1-05, escrito pelo agente paralelo da R1-06. O arquivo foi corrigido e a raiz repetiu `npm run lint` com sucesso antes desta aprovação. Nenhum achado funcional da R1-05 permaneceu aberto.
