# R1-02 · Isolar riscos do legado — Verification

**Verdict**: FAIL
**Profile**: light
**Diff range**: `c12458f..3f583ade8da5d9f652d3e03db03b38c3fa313c48`
**Fix/evidence diff**: `820547e..3f583ad` (the C8 evidence change itself is commit `3f583ad`)
**Round**: 2 — scoped
**Verifier**: independent fresh sub-agent (author != verifier)
**Checks proven**: 7/8; C8 is not integrally proven

The implementation and all local gates passed. Round 2 adds a credible operator-mediated hosted proof without disclosing `PAINEL_TOKEN`, but it proves a different request from the one C8 names. The client's gate calls `v=funil&dias=1`; only after that request returns `response.ok` and valid JSON does it reveal the app. The first render then requests the default `dias=30` asynchronously. Neither path executes the required hosted `painel-dados?v=funil&dias=7`, so the feature still fails its own exact completion bar.

## Scope and independence

- Round 1 full verification at `820547e` is carried forward for C1–C7 and the local half of C8. Round 2 inspected the full `820547e..3f583ad` range and the exact evidence commit `3f583ad^..3f583ad`; only the checklist's C8 evidence changed in that commit.
- `.tasks/r1-02-legado-seguranca.md`, the updated checklist, and `lp-narrador/cenas-lp/painel-leads.html` were reopened completely. The deployed `painel-dados` version 2 source was fetched read-only and matches the local parameter-handling contract.
- Existing unrelated dirty-worktree changes were recorded before testing and were not modified.
- No `.env` file was opened. No hosted DDL, DML, migration, function deployment, push, DNS, or other remote mutation was performed.
- Binding-source UI comparison and fault injection do not run under profile `light`; the task also declares `Observable: None - no user-facing surface`.
- The checklist has no `## Test policy` section, so there are no policy rows to judge.

## Binding sources

| Source | Opened | Contradiction | Uncovered |
|---|---|---|---|
| `.tasks/r1-02-legado-seguranca.md` | yes, complete; reopened in round 2 | none | exact hosted `dias=7` execution remains absent |
| `.checks/r1-02-legado-seguranca.md` | yes, complete; reopened in round 2 | none against the task's intended endpoint, but its new PASS overstates the evidence | operator proof settles `dias=1`, not the checklist-defined `dias=7` |
| `lp-narrador/cenas-lp/painel-leads.html` | yes, complete; reopened in round 2 | gate uses `dias=1` while C8 fixes `dias=7` | no assertion or interaction record shows the 7-day option was executed |
| `fluxos_ref/plan_master.md` | carried from `820547e`; complete, including §8.2 and Aceite 08 | none | none beyond C8 |
| `supabase/migrations/20260423195849_meta_integration_core.sql` | yes, complete | none | none |
| `supabase/migrations/20260814190000_rastreio_jornada.sql` | yes, complete | none | none |
| `supabase/migrations/20260814190500_registrar_eventos.sql` | yes, complete | none | none |
| `supabase/functions/track-evento/index.ts` | yes, complete | none | none |
| `supabase/functions/painel-dados/index.ts` | yes, complete | none | hosted authenticated execution absent |
| Hosted advisors baseline/current state for `sdeowbqmwkwseyktyemn` | yes, current read-only query rerun | none | past baseline is historical evidence, not reproducible now |
| Supabase RLS documentation and breaking-change changelog | yes, current official sources | none; `(select auth.jwt())` and `security_invoker=true` remain documented patterns | none relevant to this diff |

## Checks

| Check | Claim | Proof run | Evidence and assertion | Result |
|---|---|---|---|---|
| C1 | `anon` and `authenticated` get `42501` on all four `thais_*` views | pgTAP assertions 1–8 passed; hosted ACL queried read-only | `supabase/tests/r1_02_isolate_legacy_risks.test.sql:76-79,88-91` — eight `throws_ok(..., '42501', ...)`; migration revoke at `supabase/migrations/20260915185953_r1_02_isolate_legacy_risks.sql:68-73`; hosted `has_table_privilege` is false for both roles on all four views | PASS |
| C2 | `service_role` keeps the fixed-client slice on all four views | pgTAP assertions 9–12 passed; hosted definitions and ACL queried read-only | `supabase/tests/r1_02_isolate_legacy_risks.test.sql:96-114` — four `results_eq` assertions expect only fixture X; hosted view definitions all retain `client_id = '75d5ccc3-054a-452d-9dc0-cbf87ddd0758'` and `service_role` has SELECT | PASS |
| C3 | zero `security_definer_view` for the four views | pgTAP assertions 13–16 passed; local and hosted security advisors rerun | `supabase/tests/r1_02_isolate_legacy_risks.test.sql:119-133` — each `reloptions` must contain `security_invoker=true`; hosted catalog confirms true for all four and current hosted security advisor has no `security_definer_view` finding | PASS |
| C4 | all four named FKs have a covering index and advisor findings are zero | pgTAP assertions 17–20 passed; local and hosted performance advisors rerun | `supabase/tests/r1_02_isolate_legacy_risks.test.sql:137-172` — each assertion requires a valid, ready, non-partial index with the FK column first; hosted catalog returns the four expected indexes and current advisor has no `unindexed_foreign_keys` | PASS |
| C5 | all seven named policies use initplan form | pgTAP assertions 21–27 passed; local and hosted performance advisors rerun | `supabase/tests/r1_02_isolate_legacy_risks.test.sql:175-192` — every relevant `polqual`/`polwithcheck` must contain `select auth.jwt()`; hosted deparsed expressions confirm all seven and current advisor has no `auth_rls_initplan` | PASS |
| C6 | JWT tenant X reads only X in both required tables | pgTAP assertions 28–31 passed | `supabase/tests/r1_02_isolate_legacy_risks.test.sql:201-204` — counts are exactly 1 and returned campaign/post IDs are the X fixtures, excluding Y | PASS |
| C7 | hosted migration did not reduce `leads`, `lead_sessoes`, or `lead_eventos` | historical pre/post snapshot assessed; hosted migration list and present counts queried read-only | `.checks/r1-02-legado-seguranca.md:51` records `17/64/568` at 19:11:41 UTC and the same values at 19:11:55 UTC; hosted migration `20260915191148 r1_02_isolate_legacy_risks` falls between those timestamps; current hosted counts remain `17/64/568`; commit `820547e` recorded the snapshot at 19:12:57 UTC | PASS (qualified historical evidence) |
| C8 | hosted `painel-dados?v=funil&dias=7` returns 200 and local tracking writes exactly N events | full local suite rerun at `3f583ad`; new operator evidence and client gate inspected | Local: `supabase/tests/r1_02_edge_functions.ps1:60,73-75` executes the exact `dias=7` request and requires 200; `:126-133` requires track 200, reported `gravados=N`, and row delta `N`; round-2 run returned panel 200, track 200, 3/3. Hosted: `lp-narrador/cenas-lp/painel-leads.html:202-206` accepts only `r.ok` plus JSON, but `:218` gates on `dias=1`; `:154-155,250` shows 7 is merely an unselected option while the initial render uses 30. Operator “feito” therefore proves a hosted authenticated 2xx at `dias=1`, not the required `dias=7` | **FAIL** |

### C7 evidence strength

C7 describes a past, one-time event and cannot be recreated without another hosted migration. The evidence is stronger than an uncorroborated narrative: its exact pre/post timestamps bracket the independently observed hosted migration version (`19:11:48`), the snapshot was committed about one minute later, the migration contains no data-changing statements, and current counts still equal the recorded values. This is sufficient to accept C7, but weaker than retaining the raw pre/post query output as a durable artifact. No new “before” value was invented from the current database.

## Coverage recomputation

Although the profile is `light`, the user requested an explicit C1–C8 source/assertion audit. The sets named by the task and checklist were recomputed from their authoritative artifacts:

| Set | Members found | Proof coverage |
|---|---:|---|
| `thais_*` views | 4 | C1 has 8 role/view assertions; C2 and C3 have 4 each; hosted catalog covers all 4 |
| roles | 3 (`anon`, `authenticated`, `service_role`) | C1/C2 plus hosted ACL query |
| target FKs | 4 | C4 has one catalog assertion per FK plus hosted catalog/advisor |
| target policies | 7 | C5 has one assertion per policy, including both UPDATE expressions, plus hosted catalog/advisor |
| preserved tables | 3 | C7 snapshot and current hosted counts cover all 3 |
| funnel ports | 3 (`painel-dados`, `track-evento`, `registrar_eventos`) | local harness covers all 3 through the HTTP-to-RPC-to-row-delta path; hosted `painel-dados` is proven at `dias=1`, but its required `dias=7` instance remains uncovered |

No additional member named by the task, migration, or functional contracts was hidden by the checklist's Coverage table.

## Hosted read-only confirmation

| Item | Current result |
|---|---|
| Migration | `20260915191148 r1_02_isolate_legacy_risks` present |
| Four views | exact fixed-client definitions; `security_invoker=true` |
| ACLs | `anon=false`, `authenticated=false`, `service_role=true` for SELECT on all four |
| Four FKs | each has the expected valid covering index |
| Seven policies | every `USING`/`WITH CHECK` required by C5 deparses with `SELECT auth.jwt()` |
| Security advisor | no `security_definer_view`; remaining findings are the explicitly out-of-scope `set_updated_at`, `pg_net`, and policyless service-role funnel tables |
| Performance advisor | no `unindexed_foreign_keys` and no `auth_rls_initplan`; remaining notices are unused indexes and Auth connection strategy |
| Funnel counts | `leads=17`, `lead_sessoes=64`, `lead_eventos=568` |
| `painel-dados` deployment | ACTIVE version 2; fetched source accepts every positive `dias <= 365` through the same `funil` branch, but source equivalence does not prove that the required hosted HTTP request occurred |

## Round 2 C8 assessment

The operator proof is valid evidence of a secret-bearing hosted request without exposing the secret. Its exact strength is bounded by the client control flow:

1. `entrar()` reads the token directly from the password field and calls `await busca('v=funil&dias=1')` (`painel-leads.html:213-218`).
2. `busca()` targets the hosted project and throws on 401 or any non-2xx; it also awaits JSON parsing (`:180,202-206`).
3. Only after that awaited call succeeds does the code hide the gate and reveal the app (`:219-221`). Thus a report that the gate opened supports an authenticated hosted 2xx with a parseable response for `dias=1`.
4. The 7-day value exists only as a selectable option (`:154`). The default is 30 (`:155`), and `render()` is invoked without `await` after the app is already revealed (`:221-222`), so “painel abriu/carregou” does not itself prove either the default render finished or that the operator selected 7.

The deployed function's read-only source confirms `dias=1`, `7`, and `30` follow the same code branch. That makes the missing 7-day success highly likely, but `verify.md` requires the checklist-defined value at the assertion boundary; inference from another parameter is not a recorded execution of `?dias=7`. This is an evidence-precision gap, not evidence that production is broken.

## Replay and gates

| Gate | Result |
|---|---|
| `supabase db reset --local --no-seed` | PASS twice completely; an earlier transient container recreate attempt failed before schema application, then the debug retry and the second clean reset completed |
| Direct local reapplication through container `psql -v ON_ERROR_STOP=1` | PASS; all views/policies recreated and all four indexes reported existing/created without error |
| `supabase test db supabase/tests/r1_01_tenant_auth_rls.test.sql supabase/tests/r1_02_isolate_legacy_risks.test.sql` | PASS after reset and again after reapplication: 2 files, 106 tests, 0 failures |
| Direct pgTAP output for R1-02 | PASS: assertions 1–31 individually emitted and named |
| `supabase/tests/r1_02_edge_functions.ps1` | PASS before and after reapplication: panel 200, track 200, 3 sent, 3 persisted |
| `supabase db lint --local --level warning --fail-on error` | PASS: no schema errors |
| local security/performance advisors | target findings absent; only informational policyless funnel tables and unused indexes when run at INFO |
| hosted security/performance advisors | target findings absent; only out-of-scope/current informational findings |
| Round 2 pgTAP at `3f583ad` | PASS: R1-01 + R1-02, 2 files, 106 tests, 0 failures |
| Round 2 Edge Functions harness at `3f583ad` | PASS: panel 200, track 200, 3 sent, 3 persisted; one overlapping/transient local runtime attempt returned an upstream error, and the clean isolated rerun passed |

The CLI's `supabase db query --file` path was also attempted and reproduced the documented CLI 2.95.4 limitation (`cannot insert multiple commands into a prepared statement`); the successful direct local `psql` replay is the relevant idempotency proof.

## Faults injected

Not run. `verify.md` requires fault injection only for `standard` and `ui`; this feature declares profile `light`.

## Prioritized gaps

1. **P0 — C8's exact hosted read remains unproven.** In the existing panel, select **7 dias** and confirm the funnel data/error state after that render completes, or execute the exact `GET /functions/v1/painel-dados?v=funil&dias=7` through an approved secret-aware path and retain only sanitized HTTP 200 evidence. Do not expose or copy `PAINEL_TOKEN` into chat, source, or this report.
2. **P2 — Preserve raw C7 event evidence on future one-way operations.** The timestamped committed snapshot is sufficiently corroborated here, but storing sanitized raw pre/post query output would remove dependence on a prose record for an otherwise non-repeatable event.

The direct `anon` grant on `ad_accounts` remains the task's explicit Unresolved 4/out-of-scope risk; this verification does not treat it as repaired.
