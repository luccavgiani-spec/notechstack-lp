# R1-06 · Dashboard da Nó — Verification

**Verdict**: PASS

**Profile**: standard

**Functional commits**: `6251472`, `cfb23e8`, `2df2b9b`

**Verifiers**: fresh independent sub-agents (`r1_06_verifier_luna`, `r1_06_reverifier_luna`, `r1_06_final_verifier_luna`)

**Checks proven**: 22/22

O workspace operacional da Nó foi verificado do banco ao navegador em desktop e mobile. Os triggers compartilhados da R1-01 permanecem instalados; as mutações administrativas usam `app.skip_activity` somente dentro da transação e gravam um evento de domínio idempotente.

## Resultados

| Critérios | Prova independente | Resultado |
|---|---|---|
| C1–C3 | projeções, nove dimensões de filtro, busca, campos da ficha e moeda BRL | PASS |
| C4–C8 | pgTAP e DOM para comercial, transições de lead, seis ações Kanban e `completed_at` | PASS |
| C9–C14 | harness HTTP + pgTAP para conversão, expirado, validação, conflito, Marca e status | PASS |
| C15–C18 | sete visões, fuso de São Paulo, pendências/atrasados, identificação e paginação | PASS |
| C19–C20 | retry idempotente, ACL/RLS e rejeição de CLIENT nas duas fronteiras HTTP | PASS |
| C21–C22 | vazios distintos, gates completos e E2E em 1440×900 e 375×812 | PASS |

## Gates executados

- `supabase db reset --local`: PASS.
- `supabase test db --local`: 230/230 no conjunto completo; R1-06 isolada 41/41.
- `pwsh -NoProfile -File supabase/tests/r1_06_dashboard_no.ps1`: 17/17.
- `supabase db lint --local --level warning`: nenhum erro.
- `supabase db advisors --local`: nenhum achado.
- `npm test -- --run`: 77/77.
- `npm run lint`, `npm run build` e `npx tsc -b --pretty false`: PASS.
- `npm run test:e2e`: 8/8 no conjunto completo.
- `npm run test:e2e -- --grep "R1-06" --trace=off`: 2/2 após o último ajuste, Chromium desktop e mobile.

## Segurança e consistência

`r1_06_event`, `r1_06_is_replay` e os helpers internos não são executáveis por `authenticated`; RPCs públicas exigem `NO_ADMIN`, usam `SECURITY DEFINER` com `search_path = ''` e devolvem replay sem reaplicar a mutação. `project-convert` e `project-status-transition` retornam 403 para CLIENT, 409 nas transições inválidas e mantêm delta zero nos erros. Os triggers `projects_record_activity` e `kanban_items_record_activity` da R1-01 foram confirmados instalados.

## Observação de infraestrutura

Uma execução paralela do Playwright encontrou `ENOENT` ao fechar artefatos de trace. As repetições oficiais com execução serial/proporcional e `--trace=off` passaram; o comportamento do produto, fixtures e cleanup permaneceram verdes.
