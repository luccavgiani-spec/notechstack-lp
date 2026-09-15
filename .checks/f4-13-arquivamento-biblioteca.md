# F4-13 · Arquivamento e biblioteca de ativos

## Sources

- `.tasks/f4-13-arquivamento-biblioteca.md` — critérios 1–12 e fronteiras.
- `fluxos_ref/plan_master.md` §11 e §16 — snapshot, direitos e cenário A.
- `fluxos_ref/NO_OPERATING_DESIGN_SYSTEM_v1.md` §13 — processo e tags recomendadas.
- `supabase/migrations/20260915180826_r1_01_tenant_auth_rls.sql` — tenant, RLS e acesso.
- `supabase/migrations/20260915214008_r1_06_dashboard_no.sql` — RPCs administrativas e Atividade.
- `supabase/migrations/20260915223119_f2_09_versions_backend.sql` — histórico de versões.

## Out of scope

- Publicar case, apagar material confidencial, busca de texto livre ou Storage de exports do Editor.
- Qualquer mudança hospedada, deploy, DNS, push ou leitura de segredo.

## Landing

O arquivamento cria um snapshot transacional e imutável no Postgres, sem apagar os agregados
originais. A Biblioteca consome somente projeções não confidenciais por RPC `NO_ADMIN`.

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| Ativo arquivável | uma linha `archive_assets` por projeto arquivado, com `snapshot` do projeto, roadmap, protótipo, versões e referências de arquivos | uma linha por arquivo/componente — exige taxonomia e produtor ainda inexistentes |
| Direitos | `internal_reuse`, `public_case`, `confidential`, todos booleanos; confidencial começa `true` | enum único — não expressa permissões independentes |

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| RPC de arquivamento e busca | pgTAP da transação/RLS + Testing Library da ação | estados permitidos e rejeitados, replay, snapshot, direitos e CLIENT |
| Projeção da Biblioteca | Testing Library | vazio, filtros e rótulos de direitos |

## Checks

### S1 — Arquivar e preservar · migration/RPC/UI · ~30k

- [x] **C1/C2** — `NO_ADMIN` arquiva somente janela expirada ou projeto concluído, marca `ARQUIVADO`, bloqueia CLIENT e cria um evento. Proof: pgTAP `f4_13_arquivamento_biblioteca.test.sql` (24 provas locais).
- [x] **C3/C4** — projeto ativo retorna erro sem delta e nenhum agregado histórico é apagado. Proof: pgTAP `f4_13_arquivamento_biblioteca.test.sql`.
- [x] **C5** — snapshot contém projeto, roadmap, protótipo, versões e lista explícita de arquivos; trigger impede alteração/exclusão. Proof: pgTAP `f4_13_arquivamento_biblioteca.test.sql`.

### S2 — Direitos e Biblioteca · migration/RPC/UI · ~24k

- [x] **C6/C7/C8** — tags e direitos persistem; confidencial não entra na busca; os três rótulos derivam das duas permissões. Proof: pgTAP `f4_13_arquivamento_biblioteca.test.sql`.
- [x] **C9/C10/C11** — `/no/biblioteca` filtra tags/reuso/case e CLIENT não lê a projeção. Proof: pgTAP e `app/src/archiveLibrary.test.tsx` (3 cenários).
- [ ] **C12** — gates locais passaram: lint, `tsc`, build, Vitest (17 focados) e pgTAP integral (318). Pendente: E2E com sessão `NO_ADMIN` real; não há seed/credencial de navegador autorizada para este fluxo.

## Swept

- validation: `archive_project` rejeita tags não-objeto e estados não arquiváveis.
- failure modes: item ativo e rearquivo retornam erro sem mutação.
- idempotency: request id da atividade impede duplicação; rearquivo é conflito explícito.
- authorization: RLS e RPCs exigem `NO_ADMIN`; CLIENT não lê snapshot nem Biblioteca.
- concurrency: `FOR UPDATE` serializa a criação do snapshot.
- data lifecycle: nenhum `delete`; snapshot e status mudam na mesma transação.
- external-dependency failure: não há dependência externa.
- state transitions: janela expirada/concluído → arquivado; ativo permanece inalterado.
- observability: exatamente um `project.archived` por arquivamento.
- verification: 2026-09-15 — `npm run lint`, `npm run build`, Vitest focado (17) e `supabase test db --local` (318) passaram; E2E administrativo permanece pendente.

## Coverage

| Set | Member → proof | Unproven |
| --- | --- | --- |
| elegibilidade (3) | janela expirada C1 · concluído C2 · ativo C3 | - |
| direitos (4) | privado C7 · reuso C7 · case C7 · confidencial C8 | - |
| atores (2) | NO_ADMIN C1–C10 · CLIENT C11 | - |

## Handoff

- Um lote S1–S2 cabe no mesmo contexto; verificação independente obrigatória após o commit final.
- Decisão do usuário: um ativo é o snapshot inteiro de um projeto, criado automaticamente e com acesso conservador por padrão.
