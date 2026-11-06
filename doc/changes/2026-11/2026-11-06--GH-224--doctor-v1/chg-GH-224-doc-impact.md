# GH-224 doc-impact handoff for @doc-syncer (Phase 7 input)

This file is the @coder → @doc-syncer handoff for delivery-lifecycle phase 7
(`system_spec_update`). It is **not** current truth and must be reconciled by
`@doc-syncer`; @coder does not author `doc/spec/features/feature-doctor.md` or
rewrite the current-truth feature docs it names.

Delivered HEAD at handoff: the delivery branch `feat/GH-224/doctor-v1` after the
`main-tools` merge (GH-229 owner-gate SLA board included).

## Delivered surfaces and sources of truth

| Delivered behavior | Source of truth |
|---|---|
| Read-only `doctor` command, composed at the CLI edge beside `status`, `brief`, `board`, and `queue` | `packages/cli/src/commands/doctor.ts`, `packages/cli/src/edge.ts` |
| `delivery.doctor.v1` payload: schema id, generation time, shared repository binding, five checks in fixed order, bounded evidence (`sources`, `reasons`, optional `failureClass`/`httpStatus`), `fixHint` iff non-ok, summary counts | `packages/core/src/contracts/doctor.ts` |
| Pure aggregation, per-check isolation, verdict derivation, bounded detail/hints, failure-summary rendering, human report | `packages/core/src/domain/doctor.ts` |
| One additive error identity (`doctor.check.failed`, `user`, non-retryable, `not_landed`, `user-validation`) and the `doctor` domain kind | `packages/core/src/contracts/error-table.ts` |
| Optional structured `httpStatus` on the adapter-local payload/not-found read failures, supplied by the GitHub read slice; one GitHub trap entry | `packages/adapters/src/io/provider-transport.ts`, `packages/adapters/src/github/client.ts`, `tests/fixtures/providers/traps/github.traps.json` |
| Behavioural proof: verdict matrix, eight AC-F2-3 controls + four supplementary controls, 15 isolation injections, summary/human goldens, limits, determinism, network posture, performance | `tests/behaviour/doctor-*.test.ts`, `tests/golden/doctor-output.test.ts`, `tests/fixtures/doctor/**` |

## Binding values to mirror (do not re-derive)

- Schema version `delivery.doctor.v1`; exactly five areas in order `repo`,
  `tracker`, `provider`, `state`, `ci`; closed verdicts `ok | fail |
  unreachable`.
- Read limits `DOCTOR_TRACKER_READ_LIMIT = 50`, `DOCTOR_CI_READ_LIMIT = 20`;
  one single page each, no pagination, no retries.
- Bounds: 65 536 machine bytes, 24 human lines, 4096 human bytes, 200-char
  detail/hint, 4 evidence sources, 4 evidence reasons.
- Hint catalog: one closed template per condition (D6), unconditional on every
  non-ok verdict; no `--fix-hints` toggle.
- Summary grammar: `doctor check failures (<n>/5) — <area> (<verdict>): <hint>`
  with `; ` between checks and area order preserved; the two Appendix B examples
  are byte-binding goldens.
- Error identity: exactly one row, `doctor.check.failed`; check-level causes
  (`doctor.check.<area>.unreachable`) are evidence, never table identities.

## Decisions to mirror

- **DEC-1** surface is exactly `<binary> doctor [--json]`; no positionals, no
  command-specific flags; `--fix-hints` is rejected as `fallback.invocation`.
- **DEC-2** five fixed areas; closed `ok | fail | unreachable`; both non-ok
  verdicts fail and carry detail + hint.
- **DEC-3** verify-change outcome model: all-ok success `data` + exit `0`; any
  non-ok single `doctor.check.failed` error + exit `1`; no data-bearing failure
  envelope; doctor-unable-to-run projects exit `2` through the existing chain.
- **DEC-4** per-check isolation: each check's throw/rejection/malformed result
  becomes that check's `unreachable`; `fallback.internal` never classifies a
  check-internal failure.
- **DEC-5** at most two bounded single-page network reads; repo/provider/state
  are local; shared sources are read once.
- **DEC-6** provider check: credential wiring defects fail; capacity/environment
  and loop-cap parks (`peak-window`, `quota-exhausted`, `provider-outage`,
  `chain-exhausted`, `reevaluation-cap`) are wiring-neutral; no quota fetch, no
  engine call.
- **DEC-8** repo check reports observed branch/HEAD facts only; no base-branch
  conformance claim in v1.
- **DEC-11** 401/403 credential rejection comes from the structured
  `httpStatus`; every other non-2xx/transport/absent status is
  `unreachable`/`read-failed`; remote prose is never parsed.
- **DEC-12** the two tolerant provider-configuration failures
  (`config-invalid` with a classified `config.*` code and
  `provider-chain-unresolved` with `config.value.invalid`) are provider-check
  `fail` evidence; they never abort the run.

## Required documentation changes

1. **New current-truth feature spec** `doc/spec/features/feature-doctor.md`
   (`ados_distribution: internal`, D13). Mirror
   `feature-status-digest.md` structure: overview, business context,
   capabilities, outcome flows, check table with the Appendix A verdict matrix,
   closed verdict/reason/condition vocabulary, evidence model, bounds and read
   limits, outcome/exit model, hint catalog table, isolation contract, quota
   safety, architecture/codebase map, interface contracts, NFRs, QA strategy,
   dependencies, glossary. Register it in `doc/00-index.md`.
2. **Result contract** `doc/spec/features/feature-result-contract.md`: keep the
   `doctor` kind narrative and its documented row; the table now declares 54
   identities because the GH-229 `status` kind and
   `status.collector.tracker.unavailable` family row coexist. Add the doctor
   consumer note in "Dependencies & Risks" if the doc-syncer's structure keeps
   per-command consumer bullets.
3. **Provider client seeds** `doc/spec/features/feature-provider-client-seeds.md`:
   document the additive optional `httpStatus` on the adapter-local payload
   failure types, the `GH-PAYLOAD-HTTP-STATUS` trap entry (non-2xx response
   carries a structured numeric status; payload/parse identity unchanged), and
   the maintenance note that `provider.payload.invalid` remains the only
   adapter-local identity.
4. **Status digest** `doc/spec/features/feature-status-digest.md`: the optional
   human-text renderer hook now has ten command consumers (board, brief,
   closeout, db, doctor, plan, queue, status, verify, watchdog); doctor is an
   additional read-only consumer joining the delivered set. Any statement that
   pins the count to the pre-board set must be corrected.
5. **Provider engine** and **state layer** consumer notes: doctor reads provider
   configuration, the verified park/announcement fold, and verified stores
   read-only, shares the store read with the fold, fetches no quota, calls no
   engine, and executes no salvage or repair.
6. **Command registry** `doc/planning/oss-tooling/cli-command-registry.md`:
   re-verify the `doctor` rows still describe the delivered `<binary> doctor
   [--json]` surface with no `--fix-hints`.
7. **Glossary** `doc/overview/glossary.md`: wiring, verdict, fix hint,
   per-check isolation, wiring-neutral park, failure summary.
8. **Index** `doc/00-index.md`: add the doctor feature spec to the Start Here
   table beside Status Digest, Brief, Queue Ready, and Owner-Gate SLA.
9. **Man page** `doc/planning/oss-tooling/milestones/m1/man-page.md` was
   corrected in Phase 6 (`<binary> doctor [--json]`); no further change is
   required beyond verification.

## Required scans for the doc-syncer

- `bash scripts/.tests/test-doc-distribution.sh` — the new spec is `internal`
  and under `doc/spec/**`, outside the guard's redistributable scan; the guard
  must still exit `0`.
- `bun run scripts/checks/error-table-sync.ts` after any result-contract edit
  (documented rows and table must stay 1:1 at 54).
- Link check over every touched doc, YAML front-matter parse, and
  `git diff --check`.
- `pnpm check` after the documentation commit (docs-only, re-confirmed).

## Execution evidence (commands and results actually observed)

| Phase | Commit | Evidence |
|---|---|---|
| 1. contracts, error row, `httpStatus` | `20a64ebd` | `pnpm check` exit 0; `bun test` 2970 pass / 4 skip / 0 fail; `bun run scripts/checks/error-table-sync.ts` entries=53 documented=53; `git diff --check` clean |
| 2. domain aggregation | `ccccce60` | `pnpm build`; core typecheck; targeted `bun test` 48 pass / 0 fail; `pnpm check:boundaries`; exports parity; `git diff --check` clean |
| 3. GitHub read-slice `httpStatus` | folded into `20a64ebd` (subject documents the fold) | provider/trap suites green in that commit's gate |
| 4. command and edge composition | `58225905` | `pnpm build`; CLI typecheck; targeted behaviour/structure 52 pass / 0 fail; boundaries; exports parity |
| 5. verification battery | `0a9acf5b` | doctor suites 142 pass / 0 fail across 16 files; invariant + provider suites 159 pass / 0 fail across 6 files; `pnpm check` lint/format/typecheck green, 3136 pass / 4 skip / 1 fail, the only failure being `tests/checks/privacy-release.test.ts` base drift against the not-yet-merged `origin/main-tools` |
| merge `main-tools` | `8acc2ca1` | `pnpm check` exit 0 — 3306 pass / 4 skip / 0 fail across 311 files; doctor suite 154 pass / 0 fail across 17 files; merge-seam suites 193 pass / 0 fail; `error-table-sync` entries=54 documented=54 |
| 6. reconciliation and final battery | this phase | recorded in `chg-GH-224-test-plan.md` §10 after the battery run |

TC-DOCTOR-028 is complete on the coder side once the documentation commit is
reviewed: man-page grammar matches the delivered surface, the changeset exists,
and this handoff names every doc surface.
