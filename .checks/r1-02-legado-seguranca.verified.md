# R1-02 · Isolar riscos do legado — Verification

**Verdict**: FAIL
**Profile**: light
**Diff range**: `c12458f..820547e92bed46454269836f0766ba749a8e79f2`
**Round**: 1 — full
**Verifier**: independent fresh sub-agent (author != verifier)
**Checks proven**: 7/8; C8 is not integrally proven

The implementation and all local gates passed. Hosted read-only inspection confirms the migration, ACLs, view definitions, `security_invoker`, policy expressions, covering indexes, target advisor results, and current funnel counts. The feature still fails its own completion bar because C8 requires an authenticated hosted `painel-dados?v=funil&dias=7` response of 200 and no such request was executed without access to `PAINEL_TOKEN`.

## Scope and independence

- Full four-file diff reviewed: checklist, migration, pgTAP test, and Edge Functions harness (581 added lines).
- Existing unrelated dirty-worktree changes were recorded before testing and were not modified.
- No `.env` file was opened. No hosted DDL, DML, migration, function deployment, push, DNS, or other remote mutation was performed.
- Binding-source UI comparison and fault injection do not run under profile `light`; the task also declares `Observable: None - no user-facing surface`.
- The checklist has no `## Test policy` section, so there are no policy rows to judge.

## Binding sources

| Source | Opened | Contradiction | Uncovered |
|---|---|---|---|
| `.tasks/r1-02-legado-seguranca.md` | yes, complete | none | hosted panel proof required by C8 remains absent |
| `fluxos_ref/plan_master.md` | yes, complete; §8.2 and Aceite 08 checked directly | none | none beyond C8 |
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
| C8 | hosted panel returns 200 and local tracking writes exactly N events | local harness rerun twice; hosted panel request not run | `supabase/tests/r1_02_edge_functions.ps1:73-75` requires panel status 200; `:126-133` requires track status 200, response `gravados=N`, and database delta `N`; both runs returned panel 200, track 200, 3/3. `.checks/r1-02-legado-seguranca.md:54` explicitly records that hosted GET was not executed | **FAIL** |

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
| funnel ports | 3 (`painel-dados`, `track-evento`, `registrar_eventos`) | local harness covers all 3 through the HTTP-to-RPC-to-row-delta path; hosted `painel-dados` remains uncovered |

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

The CLI's `supabase db query --file` path was also attempted and reproduced the documented CLI 2.95.4 limitation (`cannot insert multiple commands into a prepared statement`); the successful direct local `psql` replay is the relevant idempotency proof.

## Faults injected

Not run. `verify.md` requires fault injection only for `standard` and `ui`; this feature declares profile `light`.

## Prioritized gaps

1. **P0 — C8 hosted read remains unproven.** Execute `GET /functions/v1/painel-dados?v=funil&dias=7` with the already-configured `x-painel-token` through an approved secret-aware path and retain the HTTP 200 evidence. Do not expose or copy `PAINEL_TOKEN` into chat, source, or this report.
2. **P2 — Preserve raw C7 event evidence on future one-way operations.** The timestamped committed snapshot is sufficiently corroborated here, but storing sanitized raw pre/post query output would remove dependence on a prose record for an otherwise non-repeatable event.

The direct `anon` grant on `ad_accounts` remains the task's explicit Unresolved 4/out-of-scope risk; this verification does not treat it as repaired.
