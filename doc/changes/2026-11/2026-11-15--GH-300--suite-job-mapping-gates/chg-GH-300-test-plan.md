---
id: chg-GH-300-test-plan
status: Updated
created: 2026-11-15T12:00:00Z
last_updated: 2026-11-15T19:10:00Z
owners: [Juliusz Ćwiąkalski]
service: delivery-os
labels: [milestone-m2, verify-gates, config, policy-as-code, gates]
version_impact: minor
summary: "Verification strategy for M2-S7 suite-to-job mapping: the additive `verify.suite-map` declaration and its closed resolution, the `suiteBreadth`/`mirrorsJob` report fields on both report types, the `verify.narrowed-scope` refusal with `detail.suiteBreadth` and the byte-pinned header `; scope=narrowed mirror=<job> breadth=<mirror ids>[ omitted=<n>]` that names the mirror breadth and never the local set, the one bounded `cause:` error-stream line for the two map-side config refusals, the four-outcome totality rule, delivered-surface and undeclared-map byte parity, the fail-closed configuration-document posture (absent, unreadable, unparseable, no-node, defective-node, and an outside-node defect that never refuses), the project-committed-slot-only declaration home, the member-path narrowing that refuses before any member read, the shipped MCP composition's live map read, parity scoping, the equality fixture whose `local` order differs from the mirror's proving `data.suiteBreadth` follows the mirror's declared order, the zero-additional-read budget, error-table two-way sync, determinism, hermetic fixtures, the pinned `<repo>/.delivery-os/config.yaml` reference declaration, and the gate battery."
links:
  change_spec: ./chg-GH-300-spec.md
  implementation_plan: ./chg-GH-300-plan.yaml
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - M2-S7: Suite-to-job mapping in gates (M2)

## 1. Scope and Objectives

This change makes a green local gate report state the suite breadth it claims and the one CI job that breadth mirrors, and refuses full green when the declared local breadth is strictly narrower than the mirrored CI job. The behaviours this plan protects, in descending risk order: **no false green** (a narrowed, uncorroborated, or unreadable-declaration run never produces a report or a durable record — RSK-1/RSK-4/RSK-10, NFR-5/NFR-6/NFR-10, DEC-5/DEC-7/DEC-18); **delivered-surface parity** (a repository without a map produces the delivered report, human text, failure summary, record, and exits byte-for-byte, while an unusable declaration document is a refusal rather than a silent parity path — RSK-9, NFR-8/NFR-10, DEC-12/DEC-18); **closed declaration resolution** (the map is a closed, versioned, bounded, duplicate-refusing configuration node resolved before any source read — RSK-2, DEC-2); **one declaration home** (the project-committed layer slot supplies the map and no overlay can supply, complete, or replace it — RSK-10/RSK-11, NFR-10, DEC-19); **paired, bounded citation** (`suiteBreadth` and `mirrorsJob` are one fact on both report types, `suiteBreadth` follows the mirror's declared order, and the narrowed evidence is never truncated — DEC-4/DEC-8, NFR-1/NFR-2); **both report paths refuse alike** (a member-declaring narrowing refuses before any member read and appends nothing — DEC-6, AC-F3-6); and **zero added reads and zero added writes** (the map is read once from one document, corroboration reuses the single workflow read, and a refusal appends neither the record nor the capsule event — NFR-4/NFR-5, DEC-7/DEC-10/DEC-19).

The motivating regressions are concrete: a local run over one suite reports the same `overall: "pass"` and appends the same full-green record as a run over the mirrored CI job's whole breadth; a member-declaring run does the same because the refusal was never decided on that path; a present but unreadable or malformed committed configuration silently becomes "undeclared" and deletes the only enforcement; an untracked overlay supplies or replaces the policy data; a resolved mirror job that no longer exists in the workflow is silently cited; a map schema drift quietly accepts an undeclared field or an over-cap list; a narrow run appends a fresh record that phase 10 or `merge` then consumes; `suiteBreadth` is copied from `local` because every fixture declares the two lists in the same order; and adding the policy shifts one delivered byte, one exit, or one read for a repository that never declared a map.

### 1.1 In Scope

- The additive `verify.suite-map` configuration branch (`schemaVersion`, `jobs[]` with `job`/`suites`, and `local`), the suite-id grammar, the caps, the duplicate and undeclared-field refusals, and the pure resolver (AC-F1-1, AC-F1-2; DM-1, DM-3; DEC-2, DEC-11).
- The configuration-document posture: one bounded read of the project-committed layer slot, the total classification of absent / unreadable / unparseable / no-node / defective-node / defect-elsewhere, the fail-closed outcome of every unusable state, and the bounded tolerance for a defect outside the map node (AC-F1-4, AC-NFR8-1; DM-9; NFR-10; DEC-18; C-15; Appendix A row 22).
- The declaration-home layer posture: the map is honoured only from the project-committed slot, and a system, user-global, project-local, environment, or CLI overlay neither supplies, completes, nor replaces it and is not a refusal either (AC-F1-5; DM-9; NFR-10; DEC-19; RSK-10, RSK-11; C-16; Appendix A row 23).
- Exact-string mirror corroboration against the read workflow job-name set, including case, surrounding-space, and punctuation variants (AC-F1-3; DM-4).
- The two additive report-root fields `suiteBreadth` and `mirrorsJob`, their pairing and bounds, their presence on both the delivered `VerifyGatesReport` and the additive `CrossRepositoryVerifyGatesReport`, and the order witness proving `suiteBreadth` follows the mirror's declared order rather than `local` (AC-F2-1..AC-F2-3; DM-2; DEC-4; C-4).
- The `verify.narrowed-scope` refusal: identity, projection, `detail.suiteBreadth`, the byte-pinned summary header that names the mirror (CI) breadth and never the local set, precedence over gate failure and classified unknown, no member read and a one-line member-mode summary on the member-declaring path, and no record or capsule append on either path (AC-F3-1..AC-F3-6; DM-4..DM-7; DEC-6..DEC-8, DEC-15; C-17; Appendix A rows 9 and 19; SC-M2-S7-02).
- The total breadth rule: equality, narrowing, unmirrored, uncorroborated, and the delivered failure path when the workflow read is invalid; the one bounded identifier-only `cause:` error-stream line that names a map-side refusal's cause while the envelope keeps the table's own prose; the four-outcome matrix and the no-false-pass invariant (AC-F4-1..AC-F4-4; DM-4; DEC-5, DEC-10, DEC-14, DEC-16; Appendix A row 20).
- Delivered-surface preservation and parity scoping: undeclared-map byte parity across the delivered corpus, the explicit exclusion of unusable document states from that parity claim, the delivered record shape and capsule payload, the untouched CI gate, the unchanged read budget, and the unchanged grammar (AC-F5-1..AC-F5-5, AC-NFR8-1; DM-2, DM-7; NFR-8, NFR-10; DEC-9, DEC-10, DEC-12, DEC-18).
- The shipped MCP `gate-report` composition: the same single-document map read, a narrowed declaration failing the tool call with the same identity and bounded summary, no append and no report, and an undeclared or equality map leaving the delivered tool outcome and contract unchanged (AC-F5-6; DEC-20; RSK-4; Appendix A row 24).
- Envelope continuity, the closed `detail` key set, determinism, hermetic fixtures, the write-surface matrix, and the two-way error-table sync (AC-NFR1-1, AC-NFR2-1, AC-NFR3-1, AC-NFR5-1, AC-NFR7-1; NFR-1..NFR-10).
- This repository's committed reference declaration at `<repo>/.delivery-os/config.yaml` — schema `delivery.verify.suite-map.v1`, job `TS aggregate check` over `tests, lint, format, typecheck, boundaries, prompt-conformance, help-guide-coverage, exports-parity`, with an equal `local` — resolving to equality end-to-end so its own gate runs cite breadth instead of refusing (DoD-8; DM-8, DEC-17; Appendix A row 21; spec §6 Flow 1, §12).

### 1.2 Out of Scope & Known Gaps

- **No execution, no suite runner, and no child process** (NG-2, C-1): breadth is declared, never observed; no test runs a suite, a workflow step, or a provider command.
- **No matrix expansion, reusable-workflow mapping, job-level `if` awareness, or step-level proof** (NG-1, OQ-2): the declaration is the record of CI breadth; a workflow body or step is never parsed.
- **No per-invocation breadth selector and no grammar change** (NG-3): the invocation stays `verify gates` followed by exactly one change ref; a third positional or unknown flag remains `fallback.invocation`.
- **No merge execution, review approval, branch-protection work, or narrowed-scope waiver** (NG-4): the no-append rule is the enforcement point; `merge` freshness semantics are only observed, never changed.
- **No change to the durable `merge.gate-verification` record shape or the capsule `gate.outcome` payload** (NG-5, DM-7): breadth is report data only; the one behavioural delta is the skipped append on a narrowed refusal.
- **No per-member suite breadth on a cross-repository report** (NG-6): the two fields describe the invoking repository's declaration and are member-independent, and the member-mode refusal emits no member-bearing record at all.
- **No current-truth documentation amendment in this plan's TCs** (C-10): phase 7 reconciliation is documentation evidence (DoD-9), not an automated scenario; the error-table documented row is the one exception because the delivered sync gate binds it.
- **No live network, credentials, or provider socket in default suites** (NFR-3, C-9): every case is driven by configuration and workflow fixtures, injected reads, and injected document-read outcomes.
- **No test of the delivered configuration layer's own taxonomy as a gate outcome** (DEC-18): the finer `config.*` codes (`config.file.malformed`, `config.key.unknown`, …) are normalised to `config.value.invalid` at the gates surface, and the config surface's own suites remain the authority for them.
- **No assertion about a non-shipped MCP composition that supplies live provider reads**: AC-F5-6 and its TC assert the shipped posture only, where every provider read is injected as `credential-unavailable` (Section 8.3, OQ-T6).
- **No residual literal gap remains in the narrowed header, the map-side cause line, the reference declaration, the document posture, the layer posture, the member-mode summary, the MCP posture, or parity scoping** (Section 8.3): spec v1.2 pins the header grammar byte-for-byte (DEC-15, Appendix A rows 9 and 19), the one-line `cause:` diagnostic with its derived bounds (DEC-16, Appendix A row 20), the reference declaration document, schema, job, eight identifiers, and order (DEC-17, DM-8, Appendix A row 21), the document classification and its tolerance (DEC-18, DM-9, Appendix A row 22), the committed-layer-only home (DEC-19, Appendix A row 23), the shipped MCP posture (DEC-20, Appendix A row 24), and the one-line member-mode summary (F-3, AC-F3-6). The TCs assert those literals directly instead of asserting only their shape.
- **The one remaining plan-owned decision is the suite-map injection shape** (Section 8.3, OQ-T4): `readSuiteMap` as its own seam or one combined resolved-config call. It changes no asserted literal, only the plan's file-level task list.

## 2. References

- Change specification: `./chg-GH-300-spec.md` (**v1.2**, §25 document history) — 30 acceptance criteria in six families: AC-F1-1..AC-F1-5 (5), AC-F2-1..AC-F2-3 (3), AC-F3-1..AC-F3-6 (6), AC-F4-1..AC-F4-4 (4), AC-F5-1..AC-F5-6 (6), and AC-NFR1-1, AC-NFR2-1, AC-NFR3-1, AC-NFR5-1, AC-NFR7-1, AC-NFR8-1 (6); the five v1.2 additions are AC-F1-4, AC-F1-5, AC-F3-6, AC-F5-6, and AC-NFR8-1 (§17). Definition of Done DoD-1..DoD-12 (§17.1); capabilities F-1..F-5 (§5); data-model rows DM-1..DM-9 (§8.3); NFR-1..NFR-10 (§9); risks RSK-1..RSK-11 (§11); decisions DEC-1..DEC-20 (§15); open questions OQ-1..OQ-3 (§14); pinned literals (Appendix A, items 1–24 — row 19 the narrowed header grammar, row 20 the map-side cause line, row 21 the reference declaration, row 22 the configuration-document posture, row 23 the layer posture, row 24 the MCP composition posture); ticket mapping and scenario seeds (Appendix B — including the recorded SC-M2-S7-02 reinterpretation); constraint register C-1..C-17 (Appendix C — C-12 breadth ownership, C-13 the cause-line-only diagnostic, C-14 the pinned reference declaration, C-15 the enforced-exactly-when-declared rule, C-16 the committed-slot-only home, C-17 both report paths); documentation deltas D-1..D-16 (Appendix D).
- Readiness record that drives this revision: `./readiness-review/readiness-iter-1.md` — finding F6 (the `suiteBreadth`-copied-from-`local` witness gap) and the spec-side findings F2/F3/F5/F11 that produced AC-F1-4, AC-F3-6, AC-F1-5, and AC-F5-6 in spec v1.2; finding F10 produced AC-NFR8-1's parity scoping.
- PM notes: `./chg-GH-300-pm-notes.yaml` — scope decision, the mechanism delegated to the spec as a DEC entry, documentation impacts, the measured gate environment, and delivery conventions.
- Implementation plan: `./chg-GH-300-plan.yaml` — the delivery plan authored after this phase; the suite homes in Section 7 are proposed, the plan pins exact filenames, and every assertion contract binds regardless of final file placement.
- Repository testing strategy: `.ai/rules/testing-strategy.md` (bun:test under `tests/**/*.test.ts`; fixtures never named `*.test.ts`; invariant suites assert the current tree, never a moving-base diff; goldens regenerated only by an explicit command with review-visible diffs; aggregate `pnpm check`).
- TypeScript test authoring rules: `.ai/rules/typescript.md` §9 (injected fakes over `mock.module`, deterministic tests, committed normalized goldens, assert the current tree).
- Delivered verify-gates current truth: `doc/spec/features/feature-verify-gates.md` — battery, citations, exits, the single bounded `readCiWorkflowJobNames` read, the config-declared gate set, the per-source read budget, the append sentence, the cross-repository report, the §Quality evidence suite conventions, and the §Limitations deferral this change narrows.
- Delivered result contract: `doc/spec/features/feature-result-contract.md` and `packages/core/src/contracts/result.ts` — the `delivery.result.v1` envelope, the closed `detail` member (TDR-0027), the `verify` kind and its rows, and the `{0,1,2}` projection.
- Delivered configuration layer: `doc/spec/features/feature-config-layer.md` and `packages/core/src/config/catalog.ts` — typed branches, `merge.gates` posture, per-key default and refusal semantics, and the schema/catalog test seams.
- Delivered merge record and gate-set posture: `packages/core/src/contracts/merge.ts`, `packages/core/src/state/merge.ts`, `packages/core/src/domain/merge-gate-set.ts` — the closed `merge.gate-verification` record, the real append/read state module, and the `config.value.invalid` declaration posture.
- Delivered MCP surface: `doc/spec/features/feature-mcp-surface.md` and `packages/mcp/src/commands/gate-report.ts` — the `gate-report` tool, its closed input schema, and its shared-engine parity.
- Milestone scenario seeds: `doc/planning/oss-tooling/milestones/m2/test-scenarios.md` §"M2-S7 Suite-to-job mapping in gates" — SC-M2-S7-01 and SC-M2-S7-02, inherited **by name**; the seed wording notes live in Section 3.5 and the owning TCs.
- Policy register: `doc/planning/concepts/policy-as-code.md` — the prose rule "Local gate breadth must equal CI breadth" that this change turns into a check (D-10).
- Delivered fixtures and suites to extend: `tests/fixtures/verify-gates/cases/{facts,harness}.ts`, `tests/fixtures/verify-gates/corpus/cases.json`, `tests/fixtures/verify-gates/golden/*`, `tests/fixtures/verify-gates/workflows/*`, `tests/fixtures/cross-repository/{facts,constants}.ts`, `tests/fixtures/cross-repository/goldens/*`, `tests/fixtures/mcp/parity/cases.ts`, `tests/fixtures/result/envelope-key-set.json`, `tests/fixtures/result/code-corpora/true-positives.json`; `tests/behaviour/verify-gates-*.test.ts`, `tests/golden/{verify-gates,cross-repository-members}.test.ts`, `tests/structure/{verify-gates,config,error-table,result,delivery-result,envelope,mcp}-*.test.ts`, `tests/checks/{verify-gates-no-live-calls,error-table-sync,fixture-sanitization,config-default-positions}.test.ts`.
- New homes for this revision: `tests/behaviour/verify-gates-config-document-posture.test.ts`, `tests/behaviour/verify-gates-config-layer-posture.test.ts`, `tests/behaviour/verify-gates-suite-map-member-posture.test.ts`, and the shipped-composition structure assertion `tests/structure/mcp-gate-map-composition.test.ts`; new document fixtures under `tests/fixtures/verify-gates/suite-map/config/`, new overlay fixtures under `tests/fixtures/verify-gates/suite-map/layers/`, and the parity-scope manifest `tests/fixtures/verify-gates/suite-map/parity-scope.json`.
- Delivery baseline: `main-tools` tip `8a1f77ad` recorded in pm-notes at intake — the source of the pre-change parity baseline and the existing goldens read unchanged (Section 6.4).

## 3. Coverage Overview

Every one of the 30 §17 acceptance criteria is covered by at least one automated test case; no AC is TODO and no TC is orphaned. The reconciliation is explicit in Section 3.4: 30 ACs declared, 30 covered, 37 TCs declared, all 37 automated (0 verification-only TCs; the gate battery is recorded as lifecycle evidence in Section 10, not as a TC).

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description (abbreviated) | TC ID(s) | Status |
|-------|---------------------------|----------|--------|
| AC-F1-1 | A valid `verify.suite-map` resolves with no refusal, carries the declared job and both suite sets in declared order, and performs no read to resolve | TC-SMAP-001, TC-SMAP-004 | Covered |
| AC-F1-2 | Every closed-shape, cap, grammar, and duplicate defect is `config.value.invalid` at exit `1`, with no `data` and no ledger/repository/workflow/provider read | TC-SMAP-002, TC-SMAP-003 | Covered |
| AC-F1-3 | Corroboration is exact: a `job` differing by case, surrounding space, or punctuation is absent from the set and takes the uncorroborated path | TC-SMAP-005 | Covered |
| AC-F1-4 | The configuration document is classified fail-closed: absent or node-absent → the delivered parity path with no breadth fact and no refusal; unreadable, unparseable, or a defective map node → `config.value.invalid` at exit `1` with no `data`, before any source read, with no report, breadth, record, or capsule event; a defect elsewhere is not interpreted; no state yields an unearned pass | TC-SMAP-006, TC-SPAR-006 | Covered |
| AC-F1-5 | A map declared only in a user-global, project-local, system, environment, or CLI overlay has no effect (undeclared → parity); the project-committed slot document is the sole source and its declaration is honoured as AC-F1-1 | TC-SMAP-007 | Covered |
| AC-F2-1 | Equality plus a passing battery: exit `0`, `overall: pass`, `suiteBreadth` equals the mirror's declared `suites` in declared order, `mirrorsJob` is non-empty, gate records and summary are unchanged, and human output is the delivered six lines (SC-M2-S7-01) | TC-SCITE-001, TC-SCITE-006, TC-SMAP-004 | Covered |
| AC-F2-2 | A cross-repository equality report carries the same two member-independent fields; `definitionOfDone`, `blockingMembers[]`, `reviewFlow`, and every `member`-bearing record are unchanged | TC-SCITE-002 | Covered |
| AC-F2-3 | On any emitted report the two fields are both present or both absent; `suiteBreadth` is non-empty, unique, ≤32 identifiers of ≤64 characters; `mirrorsJob` is 1..120 characters, never a union, and never the local list when it differs from the mirror's set in order | TC-SCITE-003, TC-SCITE-004, TC-SCITE-006 | Covered |
| AC-F3-1 | A strict-subset `local` exits `1` with no `data`, `error.kind: verify`, `error.code: verify.narrowed-scope`, category `user`, non-retryable, `not_landed`, `detail.suiteBreadth` complete, `error.remediationHint` equal to the DM-5 row's hint, and `error.summary` the rendered six-line block whose header is byte-equal to the delivered header plus `; scope=narrowed mirror=<job> breadth=<mirror ids>[ omitted=<n>]`, naming the mirror's CI breadth and never the local set — never the DM-5 row's one-sentence summary, which stays the row default (SC-M2-S7-02) | TC-SNARR-001, TC-SCTR-002 | Covered |
| AC-F3-2 | A narrowed refusal appends no record, the prior record remains newest, the read is not `torn`, and no capsule `gate.outcome` event is appended | TC-SNARR-002, TC-SWRITE-001 | Covered |
| AC-F3-3 | A narrowed declaration with one failing gate still refuses `verify.narrowed-scope`, and `error.summary` (the rendered block) keeps the delivered header plus exactly one line per gate with the verdict and reason visible | TC-SNARR-003 | Covered |
| AC-F3-4 | A narrowed declaration with a would-be `unknown` gate still refuses `verify.narrowed-scope` rather than the classified-unknown reuse or `verify.gates.unavailable`, with every gate's evidence retained | TC-SNARR-004 | Covered |
| AC-F3-5 | With more than eight identifiers, `detail.suiteBreadth` is complete and untruncated while the summary header prints at most the mirror breadth's first eight in declared order followed by ` omitted=<n>` counting only unprinted identifiers — never the local set — and stays within six lines and 4096 bytes | TC-SNARR-005, TC-SCTR-002, TC-SDET-002 | Covered |
| AC-F3-6 | A narrowed declaration on a member-declaring change refuses before any member read with the same identity, exit, and `detail`, a one-line member-mode summary (`result=unknown; gates=0/0 passed, 0 failed, 0 unknown`), no `definitionOfDone`/`blockingMembers[]`/`reviewFlow`/`member`-bearing record, no record, no capsule event, and no data-bearing `overall: "fail"` report or member status | TC-SNARR-006 | Covered |
| AC-F4-1 | An absent, unreadable, empty, duplicate, or over-cap workflow is the delivered `ci-expected-jobs-invalid` CI failure and the delivered `verify.gates.failed` envelope at exit `1`, with no `data`, no breadth anywhere, and no pass on any path | TC-SRES-001, TC-SRES-005 | Covered |
| AC-F4-2 | A valid job-name set that omits the resolved mirror is `config.value.invalid` at exit `1` with no `data`; the envelope carries the table's own summary and hint and no `detail`; the mirror is named on the single bounded error-stream line `cause: mirror=<job>` (≤134 characters) and nowhere in the envelope; no report is emitted | TC-SRES-002, TC-SRES-005 | Covered |
| AC-F4-3 | A `local` set covered by no single job — wider than every job or disjoint from all — is `config.value.invalid` at exit `1` with no `data`; the local breadth is named on the single bounded error-stream line `cause: breadth=<id[,id]*>[ omitted=<n>]` (≤545 characters) and nowhere in the envelope; no report is emitted | TC-SRES-003, TC-SRES-005 | Covered |
| AC-F4-4 | Two declared jobs whose sets both equal `local`: the first in declared order is the mirror on both runs and the two reports are byte-identical | TC-SRES-004 | Covered |
| AC-F5-1 | A configuration with no `verify.suite-map` produces report, human text, failure summary, and exits byte-identical to pre-change over the delivered corpus, and neither field appears anywhere | TC-SPAR-001 | Covered |
| AC-F5-2 | A declared map and passing battery append exactly one delivered-shape `merge.gate-verification` record with no breadth key, and reading the history back is not `torn` | TC-SPAR-002, TC-SWRITE-001 | Covered |
| AC-F5-3 | A map job that is not a workflow job contributes no expected job and no citation entry; the CI gate's expected set, counts, names, reasons, and verdict are exactly the delivered ones | TC-SPAR-003 | Covered |
| AC-F5-4 | With every read instrumented, the counted reads are exactly the delivered ones with zero retries and zero pagination, and are identical with and without the declaration | TC-SPAR-004 | Covered |
| AC-F5-5 | A third positional or unknown flag is `fallback.invocation` before any read; no map is resolved, so the grammar is unchanged | TC-SPAR-005 | Covered |
| AC-F5-6 | The shipped MCP `gate-report` composition supplies the map read: a narrowed declaration fails the call with `verify.narrowed-scope` and the same bounded summary, appends nothing, and returns no report; an undeclared or equality map leaves the delivered tool outcome unchanged with no breadth field or evidence member; the input schema, tool set, and tool-result shape are unchanged | TC-SCITE-005 | Covered |
| AC-NFR1-1 | No top-level envelope key outside the declared set; `data` and `error` remain exclusive; `detail` carries no key outside `{holder, suiteBreadth}`; no exit outside `{0,1,2}` | TC-SCTR-001, TC-SCTR-002 | Covered |
| AC-NFR2-1 | Two runs over every declared-map case produce byte-identical stdout, byte-identical stderr, and identical exits; the narrowed header's identifier list and `omitted` count are identical | TC-SDET-001, TC-SDET-002, TC-SRES-004 | Covered |
| AC-NFR3-1 | The default suite uses no network call, credential, or provider socket; every case is configuration- and workflow-fixture driven | TC-SHERM-001 | Covered |
| AC-NFR5-1 | At most one record and one non-gating capsule event on a non-refused full evaluation; zero appends on a narrowed or invalid run; no file or configuration writes | TC-SWRITE-001, TC-SNARR-002, TC-SPAR-002 | Covered |
| AC-NFR7-1 | `verify.narrowed-scope` is present in both directions with identical fields; the `verify` kind carries seven identities; no delivered row is reworded and no domain kind is added | TC-SCTR-003 | Covered |
| AC-NFR8-1 | Parity is scoped to an absent document or one without a map node (report, human text, failure summary, record, and exits byte-identical); unreadable, unparseable, and defective-node documents are the AC-F1-4 refusal with no parity claim, so no state is both; the outside-node tolerance is bounded to exactly that node | TC-SPAR-006, TC-SMAP-006 | Covered |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No HTTP endpoint is added or changed (spec §8.1: N/A) and no new event kind or topic exists (spec §8.2). The mirrored MCP `gate-report` tool keeps its input schema and inherits the additive report fields and the new error identity through the shared engine, and its shipped composition now supplies the single-document map read (TC-SCITE-004, TC-SCITE-005). Data-model coverage:

| ID | Element | TC ID(s) | Status |
|----|---------|----------|--------|
| DM-1 | `verify.suite-map` declaration: exactly `schemaVersion`, `jobs[]` (`job`, `suites`), `local`; closed field set; identifier grammar; caps; duplicate refusals; absent means undeclared and no default map | TC-SMAP-001, TC-SMAP-002, TC-SMAP-003, TC-SMAP-004, TC-SMAP-005, TC-SMAP-006, TC-SMAP-007 | Covered |
| DM-2 | Report breadth fields `suiteBreadth?` and `mirrorsJob?` on both report types, present together or absent together, mirror breadth in the mirror's declared order, member-independent on the cross-repository report | TC-SCITE-001, TC-SCITE-002, TC-SCITE-003, TC-SCITE-004, TC-SCITE-005, TC-SCITE-006, TC-SPAR-001 | Covered |
| DM-3 | Constants and bounds (`VERIFY_SUITE_MAP_SCHEMA_VERSION`, `VERIFY_SUITE_MAP_CONFIG_KEY`, the four caps, the suite-id pattern), reuse of the delivered job-name/citation/summary bounds for the header's `breadth=` token and the gate lines, and the two derived cause-line bounds (134 mirror characters, 545 breadth characters) | TC-SMAP-003, TC-SNARR-005, TC-SCITE-003, TC-SDET-001, TC-SDET-002, TC-SRES-002, TC-SRES-003 | Covered |
| DM-4 | Closed breadth outcome: `equal`, `narrower`, `unmirrored`, `uncorroborated`; workflow-invalid produces no breadth outcome and keeps the delivered `verify.gates.failed` path; no fifth outcome; one resolution rule serves both report paths | TC-SMAP-005, TC-SNARR-006, TC-SRES-001, TC-SRES-002, TC-SRES-003, TC-SRES-004, TC-SRES-005 | Covered |
| DM-5 | `verify.narrowed-scope` row: kind `verify`, category `user`, non-retryable, `not_landed`, `user-validation`, exit `1`, plus the row's own summary sentence and remediation hint as row defaults; the `verify` kind 6→7 and `verify gates` 2→3. On a narrowed envelope `error.summary` is the rendered failure block (six gate lines on the member-less path, one header line on the member-declaring path) and `error.remediationHint` is the row's hint; the row's one-sentence summary is asserted only on the table and its documented mirror (TC-SCTR-003), never on the envelope | TC-SNARR-001, TC-SNARR-003, TC-SNARR-004, TC-SNARR-006, TC-SCTR-003 | Covered |
| DM-6 | `CommandResultDetail.suiteBreadth?`: identifiers only, never truncated, complete `local` in declared order, ≤32 entries of ≤64 characters, beside the unchanged `holder`, on both refusal paths | TC-SNARR-001, TC-SNARR-005, TC-SNARR-006, TC-SCTR-001, TC-SCTR-002 | Covered |
| DM-7 | Durable `merge.gate-verification` record and capsule `gate.outcome` payload unchanged; exactly one append per non-refused full evaluation; zero on a narrowed refusal on either report path | TC-SNARR-002, TC-SNARR-006, TC-SCITE-005, TC-SPAR-002, TC-SWRITE-001 | Covered |
| DM-8 | Reference `verify.suite-map` declaration in `<repo>/.delivery-os/config.yaml`: pinned schema, job `TS aggregate check`, the eight declared suites in order, and an equal `local`; must resolve to equality end-to-end against the real workflow | TC-SMAP-004 | Covered |
| DM-9 | Configuration-document read posture: one document in the project-committed layer slot, one bounded read, total classification (absent / unreadable / unparseable / no-node / defective-node / defect-elsewhere), tolerance bounded to exactly the map node, and no other layer read | TC-SMAP-004, TC-SMAP-006, TC-SMAP-007, TC-SPAR-006 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement | TC ID(s) | Status |
|--------|-------------|----------|--------|
| NFR-1 | Envelope continuity; keys under `data` or the declared `detail`; closed `detail` members; `{0,1,2}` exits | TC-SCTR-001, TC-SCTR-002 | Covered |
| NFR-2 | Determinism, declared order, caps, and the byte-pinned narrowed header (grammar, `result=` value, 8/`omitted` rendering) plus bounded detail | TC-SDET-001, TC-SDET-002, TC-SRES-004, TC-SNARR-005, TC-SNARR-001, TC-SCITE-003, TC-SCITE-006 | Covered |
| NFR-3 | Offline and hermetic default suites | TC-SHERM-001 | Covered |
| NFR-4 | Read budget unchanged; the map adds exactly one bounded read of the project-committed configuration document and no read of any other layer; identical source counts with and without a declaration (covered through AC-F1-1, AC-F1-2, AC-F1-4, AC-F1-5, AC-F5-4) | TC-SPAR-004, TC-SMAP-001, TC-SMAP-002, TC-SMAP-006, TC-SMAP-007 | Covered |
| NFR-5 | Read-only posture: zero appends on refusal/invalid (either report path); exactly one record and one capsule event per non-refused evaluation; no file writes | TC-SWRITE-001, TC-SNARR-002, TC-SNARR-006, TC-SCITE-005, TC-SPAR-002 | Covered |
| NFR-6 | No false pass: every narrowing is a refusal; every uncorroborated breadth is a non-report outcome; no report cites a narrower breadth | TC-SNARR-001, TC-SNARR-003, TC-SNARR-004, TC-SNARR-005, TC-SNARR-006, TC-SRES-001, TC-SRES-002, TC-SRES-003, TC-SRES-005 | Covered |
| NFR-7 | Exactly one new error-table row, no new domain kind, no reworded row (AC-NFR7-1) | TC-SCTR-003 | Covered |
| NFR-8 | Undeclared-map parity: report, human text, failure summary, record, and exits unchanged, scoped to an absent document or one without a map node | TC-SPAR-001, TC-SPAR-006, TC-SCITE-001, TC-SCITE-002, TC-SCITE-005 | Covered |
| NFR-9 | Quality gates and commit hygiene for the delivering change | No TC; gate evidence in Section 6.6 and Section 10, recorded in pm-notes (verification-only) | Covered by gate evidence |
| NFR-10 | Fail-closed configuration posture: no unusable document state can produce a report, a breadth fact, a record, or a pass; 1 bounded configuration-document read per invocation; 0 refusals attributable to a defect outside the `verify.suite-map` node | TC-SMAP-006, TC-SMAP-007, TC-SPAR-006 | Covered |

### 3.4 Traceability Reconciliation

| Count | Value | Derivation |
|-------|-------|------------|
| ACs declared in §17 | 30 | AC-F1-1..5 (5) + AC-F2-1..3 (3) + AC-F3-1..6 (6) + AC-F4-1..4 (4) + AC-F5-1..6 (6) + AC-NFR1-1, AC-NFR2-1, AC-NFR3-1, AC-NFR5-1, AC-NFR7-1, AC-NFR8-1 (6) |
| ACs covered | 30 / 30 | Every AC row above names at least one TC; 0 TODO |
| TCs declared | 37 | See Section 5.1 and Section 7 |
| TCs automated | 37 | Every TC is automated; no manual-only TC |
| TCs verification-only | 0 | Gate evidence is recorded in Section 10, not as a TC |
| Orphan TCs (no AC citation) | 0 | Each TC's Related IDs include at least one AC |
| TC IDs per family | SMAP 7 · SCITE 6 · SNARR 6 · SRES 5 · SPAR 6 · SCTR 3 · SDET 2 · SHERM 1 · SWRITE 1 | Sum 37 |
| DM rows covered | 9 / 9 | DM-1..DM-9 each name at least one TC (DM-8 → TC-SMAP-004; DM-9 → TC-SMAP-006/007, TC-SPAR-006) |
| Scenario seeds mapped | 2 / 2 | SC-M2-S7-01 → TC-SCITE-001 and TC-SMAP-004; SC-M2-S7-02 → TC-SNARR-001 (member-declaring variant → TC-SNARR-006) |

No AC is covered only by a "nearest criterion" exception: each row names the criterion whose Given/When/Then the TC asserts. Supplement citations exist only where a TC additionally protects an interface or a done condition (TC-SMAP-004 for DoD-8; TC-SCITE-004/TC-SCITE-005 for the MCP mirror; TC-SCTR-002 for the `detail` projection; TC-SNARR-006 for DoD-12; TC-SMAP-006/TC-SMAP-007 for DoD-11), and those TCs still cite a §17 AC as primary.

### 3.5 Milestone Scenario Seeds (inherited by name)

| Seed | Assertion inherited | Owning TC(s) | Precision note |
|------|---------------------|--------------|----------------|
| SC-M2-S7-01 — Local gate cites the same suite breadth as CI | `verify gates.data.suiteBreadth` equals the CI job breadth; `data.mirrorsJob` is a non-empty job id | TC-SCITE-001, TC-SMAP-004 | The seed's "job id" is the expected-check-run name the CI gate itself expects: the workflow job's display `name`, else the job id (DM-2, spec §12). The field is asserted non-empty and exactly equal to the mirror's declared `job`; no other normalization is applied. |
| SC-M2-S7-02 — Narrow local suite cannot masquerade as full green | `verify gates` exits `1` with `error.code == "verify.narrowed-scope"` and the narrowed breadth named | TC-SNARR-001, TC-SNARR-006 | The narrowed breadth is named twice per F-3/DEC-15: `detail.suiteBreadth` (the complete `local`, declared order) and the summary header's `breadth=` token, which is the **mirror's CI breadth** in declared order — at most the first eight plus ` omitted=<n>` — and never the local set (C-12). The header grammar is pinned (Appendix A row 19) and asserted byte-exactly. The seed's "invocation limited to one package" is read, per spec v1.2 Appendix B, as a declaration-scoped narrow breadth (NG-3, OQ-1), and the member-declaring variant of the same seed is TC-SNARR-006 (one-line member-mode summary, no member read, no append). |

## 4. Test Types and Layers

Per `.ai/rules/testing-strategy.md`, this is a TypeScript workspace behaviour change in `packages/**` and `tests/**`. Six automated layers plus gate-level evidence apply, matching the delivered verify-gates §Quality evidence conventions:

- **Unit / pure domain (bun:test):** the suite-map resolver (closed shape, grammar, caps, duplicates), the breadth resolver (the four outcomes), the document-state classifier, and the pure report/detail projection helpers, exercised through the domain exports with no I/O, clock, randomness, or environment. Files: `tests/behaviour/verify-gates-suite-map.test.ts` (pure half), `tests/behaviour/verify-gates-suite-map-corpus.test.ts` (pure matrix half), and `tests/structure/verify-gates-suite-map-contract.test.ts`.
- **Behaviour / CLI integration (bun:test):** the observable `verify gates` surface (one change ref) through the delivered `runVerify`/`createVerifyGatesHandler` composition with an injected suite map, an injected document-read outcome and layer set, a fixed clock and runId, and injected provider facts. Files: `tests/behaviour/verify-gates-{suite-map,suite-map-corpus,breadth-report,narrowed-scope,suite-map-member-posture,config-document-posture,config-layer-posture,suite-map-write-posture,suite-map-determinism,parity-suite-map}.test.ts`.
- **Golden / parity (bun:test):** committed normalized payloads for the new equality report (including the reordered-`local` witness), human six lines, narrowed envelope, member-mode refusal, and cross-repository report; the delivered goldens and the pre-change parity baseline are read **unchanged** for the undeclared-map path, and the parity-scope manifest records which fixtures carry a parity claim. Files: `tests/golden/verify-gates-suite-map.test.ts` and the extended `tests/golden/cross-repository-members.test.ts`.
- **Structure / contract (bun:test):** closed constants and outcome vocabulary, report-field pairing and static types, the `detail` key set, the error-table row and the live two-way sync, the `verify` configuration branch, the production-composition seam, the committed reference declaration, and the shipped MCP composition's map read. Files: `tests/structure/verify-gates-suite-map-contract.test.ts`, `tests/structure/verify-gates-suite-map-reference.test.ts`, `tests/structure/mcp-gate-map-composition.test.ts`, plus extensions to `tests/structure/{verify-gates-contract,verify-gates-imports,verify-gates-exports,config-contract,error-table,result-contract,delivery-result-contract,envelope-contract,mcp-contract}.test.ts` and `tests/behaviour/config-schema.test.ts`.
- **Type tests (`pnpm typecheck`):** the optional report-root fields on both report types, the `CommandResultDetail.suiteBreadth` member, and the unchanged report-union discrimination. File: `tests/types/verify-gates-suite-map.type-test.ts`, compiled by `pnpm exec tsc -p tests/types/tsconfig.json`.
- **Checks / invariants (bun:test):** hermeticity (network/no-spawn guards and a source scan), fixture sanitization/privacy, error-table sync, config default positions and exports parity. Files: extensions to `tests/checks/{verify-gates-no-live-calls,fixture-sanitization,error-table-sync,config-default-positions}.test.ts`.
- **Gate-level (verification-only):** `PATH=$PWD/node_modules/.bin:$PATH TMPDIR=$PWD/tmp/tmpdir GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=commit.gpgsign GIT_CONFIG_VALUE_0=false pnpm check`, followed by `./scripts/lint-commit-range.sh --base main-tools`, recorded in pm-notes; no new test code.

Golden normalization convention: envelope `runId` and `timing` are the only keys normalized out; a normalizer must be asserted to replace only those keys. The cross-repository `reviewFlow.runId` is a deterministic digest and is **pinned** in its golden, never normalized. The new `detail.suiteBreadth`, `suiteBreadth`, and `mirrorsJob` values are pinned in the new goldens. Human output is compared as raw bytes. Exits are compared exactly. The narrowed header line is additionally asserted byte-for-byte against the pinned DEC-15 grammar — segment and token delimiters, token order, the verbatim `<job>`, the `result=` value, and the `omitted` rendering — so a golden can never substitute for a missing literal assertion. The two map-side `cause:` lines are recorded as first-capture goldens and compared as raw stderr bytes. For the undeclared-map parity path, the pre-change baseline and the delivered goldens are compared byte-for-byte with no regeneration. Document-state classification is asserted as an identity plus a read/write order, never inferred from a golden.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-SMAP-001 | A valid declared map resolves by the closed pure rule with no refusal and no read | Happy Path | Behaviour + Unit | Critical | AC-F1-1 |
| TC-SMAP-002 | Closed-shape map defects are refused `config.value.invalid` before any source read | Negative | Behaviour + Contract | Critical | AC-F1-2 |
| TC-SMAP-003 | Caps, identifier grammar, duplicates, and at-bound acceptance | Negative | Behaviour + Unit | Critical | AC-F1-2 |
| TC-SMAP-004 | The repository's pinned reference declaration resolves to equality against the real workflow job-name set and cites breadth end-to-end | Happy Path | Structure (current tree) | Critical | AC-F1-1, AC-F2-1 |
| TC-SMAP-005 | Corroboration is exact string match; case, space, and punctuation variants are absent | Edge Case | Behaviour + Unit | Critical | AC-F1-3 |
| TC-SMAP-006 | Every configuration-document state is classified fail-closed: parity, refusal, or resolved equality — never an unearned pass | Negative | Behaviour + Contract | Critical | AC-F1-4, AC-NFR8-1 |
| TC-SMAP-007 | The project-committed layer slot is the map's only source; a user-global or project-local overlay declaration has no effect | Negative | Behaviour + Contract | Critical | AC-F1-5 |
| TC-SCITE-001 | The equality report cites `suiteBreadth` and `mirrorsJob`; gate records, summary, and human six lines are unchanged (SC-M2-S7-01) | Happy Path | Behaviour + Golden | Critical | AC-F2-1 |
| TC-SCITE-002 | The cross-repository report carries the same member-independent fields; existing fields are unchanged | Happy Path | Behaviour + Golden | Critical | AC-F2-2 |
| TC-SCITE-003 | The report fields pair, are bounded and unique, and never cite a differing local set or a union | Contract | Structure + Types | Critical | AC-F2-3 |
| TC-SCITE-004 | MCP `gate-report` inherits the two fields and the new identity; its input schema and tool set are unchanged | Contract | Behaviour (MCP parity) | High | AC-F2-1, AC-F2-3 |
| TC-SCITE-005 | The shipped MCP `gate-report` composition supplies the map read and refuses a narrowed declaration identically, appending nothing | Contract | Structure + Behaviour (MCP) | Critical | AC-F5-6 |
| TC-SCITE-006 | Breadth-order witness: `data.suiteBreadth` reproduces the mirror job's declared order, never the local order | Edge Case | Behaviour + Golden | Critical | AC-F2-1, AC-F2-3, AC-F4-4 |
| TC-SNARR-001 | The narrowed refusal carries the exact identity, `detail.suiteBreadth`, and the byte-pinned header naming the mirror's breadth (SC-M2-S7-02) | Negative | Behaviour + Golden | Critical | AC-F3-1 |
| TC-SNARR-002 | A narrowed refusal appends neither the record nor the capsule event; the prior record remains newest and not torn | Negative | Behaviour (real state) | Critical | AC-F3-2 |
| TC-SNARR-003 | The narrowed refusal precedes `verify.gates.failed` and preserves every gate line | Negative | Behaviour | Critical | AC-F3-3 |
| TC-SNARR-004 | The narrowed refusal precedes the classified-unknown reuse and `verify.gates.unavailable` | Negative | Behaviour | Critical | AC-F3-4 |
| TC-SNARR-005 | Narrowed naming stays bounded: full local detail, the mirror's first eight plus ` omitted=<n>`, six lines, 4096 bytes | Edge Case | Behaviour + Golden | Critical | AC-F3-5 |
| TC-SNARR-006 | A narrowed declaration on a member-declaring change refuses before any member read with the same identity and a one-line summary | Negative | Behaviour (cross-repository) + Contract | Critical | AC-F3-6 |
| TC-SRES-001 | An invalid workflow read yields the delivered CI failure and no breadth anywhere | Negative | Behaviour + Golden | Critical | AC-F4-1 |
| TC-SRES-002 | An uncorroborated mirror is `config.value.invalid` with the table's own envelope prose and exactly one bounded `cause: mirror=<job>` error-stream line | Negative | Behaviour + Contract | Critical | AC-F4-2 |
| TC-SRES-003 | An unmirrored local breadth — wider than every job or disjoint — is `config.value.invalid` with exactly one bounded `cause: breadth=<id[,id]*>[ omitted=<n>]` error-stream line | Negative | Behaviour + Contract | Critical | AC-F4-3 |
| TC-SRES-004 | Two equal jobs: the first in declared order wins and two runs are byte-identical | Edge Case | Behaviour + Determinism | Critical | AC-F4-4 |
| TC-SRES-005 | Four-outcome totality matrix: every declaration state resolves to exactly one outcome and never an unearned pass | Contract | Behaviour + Unit | Critical | AC-F4-1, AC-F4-2, AC-F4-3, AC-F4-4 |
| TC-SPAR-001 | No declared map is byte-identical to the pre-change corpus and goldens; no breadth key appears | Regression | Behaviour + Golden | Critical | AC-F5-1 |
| TC-SPAR-002 | A declared-map passing evaluation appends exactly one delivered-shape record with no breadth key and reads back not torn | Happy Path | Behaviour (real state) | Critical | AC-F5-2 |
| TC-SPAR-003 | The CI gate's expected set, counts, names, reasons, and verdict are unchanged by the map | Regression | Behaviour | Critical | AC-F5-3 |
| TC-SPAR-004 | Read counts are identical with and without a map, with zero retries and zero pagination | Contract | Behaviour (read budget) | Critical | AC-F5-4 |
| TC-SPAR-005 | The grammar is unchanged: a third positional or unknown flag is `fallback.invocation` before any read and no map is resolved | Regression | Behaviour (surface) | Critical | AC-F5-5 |
| TC-SPAR-006 | Parity is scoped: undeclared states are byte-identical, unusable document states are the AC-F1-4 refusal, and the two sets are disjoint | Regression | Behaviour + Contract | Critical | AC-NFR8-1, AC-F1-4 |
| TC-SCTR-001 | Envelope continuity across every new outcome; closed `detail` members; exits stay `{0,1,2}` | Contract | Structure | Critical | AC-NFR1-1 |
| TC-SCTR-002 | The `detail.suiteBreadth` projection is explicit, validated, never truncated, and absent outside a narrowing | Contract | Structure + Behaviour | Critical | AC-NFR1-1, AC-F3-1, AC-F3-5 |
| TC-SCTR-003 | The error table and its documented mirror are two-way synced; the `verify` kind carries seven identities; no row is reworded and no kind is added | Contract | Structure + Checks | Critical | AC-NFR7-1 |
| TC-SDET-001 | Two runs over every declared-map case are byte-identical on stdout, stderr, and exit | Regression | Behaviour + Determinism | Critical | AC-NFR2-1 |
| TC-SDET-002 | The narrowed header's mirror-breadth list and ` omitted=<n>` count are identical across runs and bounded at maximum breadth | Edge Case | Behaviour + Determinism | Critical | AC-NFR2-1, AC-F3-5 |
| TC-SHERM-001 | Default suites remain offline, credential-free, and fixture-driven | Contract | Checks | Critical | AC-NFR3-1 |
| TC-SWRITE-001 | Write-surface matrix: at most one record and one capsule event on a non-refused evaluation; zero on a narrowed or invalid run; no file writes | Contract | Behaviour (real state) | Critical | AC-NFR5-1 |

### 5.2 Scenario Details

#### TC-SMAP-001 - A valid declared map resolves by the closed pure rule with no refusal and no read

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, DM-1, DM-3, DM-9, NFR-4, DoD-1, DEC-2, DEC-11, DEC-19
**Test Type(s)**: Unit (pure resolver) + Integration (CLI)
**Automation Level**: Automated
**Target Layer / Location**: `packages/core/src/domain/**` (planned pure suite-map resolver, exported through the core domain index and registered in the source inventory); `packages/cli/src/commands/verify-gates.ts` (runtime seam); test home `tests/behaviour/verify-gates-suite-map.test.ts`, fixture builder `tests/fixtures/verify-gates/suite-map/cases.ts`
**Tags**: @bun, @behaviour, @config, @verify-gates, @suite-map

**Preconditions**:

- A committed-document fixture declares `verify.suite-map` with `schemaVersion: "delivery.verify.suite-map.v1"`, one `jobs[]` entry `{ job: "job-01", suites: [tests, lint, format, typecheck, boundaries, prompt-conformance, help-guide-coverage, exports-parity] }`, and `local` equal to the same eight identifiers in the same declared order. The standard green facts use workflow names `job-01`..`job-23`, so `job-01` corroborates; the repository reference declaration (`TS aggregate check`) is covered by TC-SMAP-004.
- The gates runtime is composed with green facts for all five gates, the shipped gate set, a fixed clock (`2026-11-06T12:00:00Z`), and a fixed runId.

**Steps**:

1. Resolve the pure map from the raw declaration; assert `ok: true`, the declared schema version, exactly one job with the exact `job` string, `suites` in declared order, and `local` in declared order.
2. Resolve a second valid declaration with two `jobs[]` entries; assert both entries and both `suites` lists are preserved in declared order and no entry is merged, sorted, or dropped.
3. Resolve an absent declaration; assert the result is explicitly undeclared (`ok: true` with no invented job, no invented suite, and no default map).
4. Run `verify gates GH-300 --json` with the committed-document fixture supplying the declaration through the one-document read.
5. Assert exit `0`, no `error`, `data.overall: "pass"`, and both new report fields present.
6. Instrument the document read, the gate-set seam, and every source read; assert the document read happens at most once before any ledger, repository, workflow, open-PR, detail, check-run, or work-item read, that the map resolution adds exactly that one bounded document read and no other configuration-layer or provider read, and that the gate-set seam supplies the unchanged shipped five.
7. Wrap the pure resolver in guarded filesystem, environment, and network globals; assert it performs no I/O and reads no ambient value.
8. Assert the production catalog declares the `verify` branch exactly once with `suite-map` as its only key and default absent; assert the existing config schema/catalog suites still pass with the branch present.
9. Assert the new pure module is in `tests/structure/inventory.json` and the content-inventory expected exports, and that `tests/structure/verify-gates-imports.test.ts` reports no new import edge.

**Expected Outcome**:

- The declaration is resolved mechanically with no refusal, its declared data (including every job) is preserved in order, and the resolution is pure: the only read it costs is the one bounded read of the project-committed document.
- An absent declaration is explicitly undeclared and no default map is invented.
- The configuration branch exists with no invented default map.

**Postconditions**:

- No state or capsule write is performed by the pure resolution; the one evaluation append is handled by TC-SPAR-002.

**Notes / Clarifications**:

- The exact seam shape (`readSuiteMap` separate from `readGateSet`, or one combined resolved-config call) is a plan decision; the assertion binds to "no I/O and no source read", not to the number of injected calls (Section 8.3, OQ-T4).
- The eight identifier literals above are the fixture instance of the pinned reference declaration (Appendix A row 21, DM-8); the fixture uses `job-01` because the standard green facts carry workflow names `job-01`..`job-23`, while TC-SMAP-004 asserts the real committed document and its `TS aggregate check` job.

#### TC-SMAP-002 - Closed-shape map defects are refused `config.value.invalid` before any source read

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, DM-1, DM-3, NFR-4, DoD-4, DEC-2
**Test Type(s)**: Integration (CLI) + Contract (error identity and read order)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-suite-map.test.ts`; defect table in `tests/fixtures/verify-gates/suite-map/cases.ts`; end-to-end YAML documents under `tests/fixtures/verify-gates/suite-map/config/`
**Tags**: @bun, @behaviour, @config, @suite-map, @negative

**Preconditions**:

- A valid equality map baseline (TC-SMAP-001) and a throwing/recording runtime whose source reads would fail the test if called.

**Steps**:

1. For each structural variant, one declaration: missing `schemaVersion`; unsupported `schemaVersion`; an undeclared top-level key; missing `jobs`; `jobs` not a list; empty `jobs`; missing `local`; `local` not a list; empty `local`; a `jobs[]` entry missing `job`; an entry missing `suites`; an entry carrying an undeclared key.
2. Run `verify gates GH-300 --json` for each variant.
3. Assert exit `1`, no `data`, `error.kind: "config"`, `error.code: "config.value.invalid"`, and the envelope `summary` and `remediationHint` are the table's own (a command-supplied config summary stays suppressed as delivered).
4. Assert the read recorder contains zero ledger, repository, workflow, open-PR, detail, check-run, or work-item calls: the refusal precedes every source read.
5. Run each variant twice; assert identical stdout, stderr, and exit.
6. Assert the human diagnostic is the delivered config rendering — `<binary>: config.value.invalid` with the table's own summary — and writes **no** `cause:` line (a structural defect is diagnosed by the table, per spec Flow 4c/DEC-16); assert no payload, configuration body, or file path appears.

**Expected Outcome**:

- Every closed-shape defect is classified `config.value.invalid` at exit `1`, before any source read, with no partial data and no report.

**Notes / Clarifications**:

- The generated catalog schema may refuse some shapes before the pure resolver; the assertion is on the classified identity and the zero-source-read order, not on which internal layer refuses.

#### TC-SMAP-003 - Caps, identifier grammar, duplicates, and at-bound acceptance

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, DM-1, DM-3, NFR-2, DoD-1, DEC-2
**Test Type(s)**: Integration (CLI) + Unit (bounds predicate)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-suite-map.test.ts`; bounds table in `tests/fixtures/verify-gates/suite-map/cases.ts`
**Tags**: @bun, @behaviour, @suite-map, @bounds, @negative

**Preconditions**:

- The valid equality baseline and the declared constants (`VERIFY_SUITE_MAP_MAX_JOBS` 64, `VERIFY_SUITE_MAP_MAX_SUITES_PER_JOB` 32, `VERIFY_SUITE_MAX_BREADTH` 32, `VERIFY_SUITE_MAX_ID_CHARS` 64, job name ≤ `VERIFY_GATES_MAX_EXPECTED_JOB_NAME_CHARS` 120, suite-id pattern `^[a-z][a-z0-9-]*$`).

**Steps**:

1. Reject one over each cap: 65 jobs; 33 `suites` in one job; 33 `local` identifiers.
2. Reject each malformed identifier: uppercase, leading digit, leading hyphen, underscore, embedded space, empty string, and a 65-character identifier.
3. Reject an empty `job`, a 121-character `job`, a duplicate `job`, an empty `suites` list, a duplicate identifier inside one `suites` list, and a duplicate identifier inside `local`.
4. For each rejection assert exit `1`, no `data`, `error.code: "config.value.invalid"`, and zero source reads.
5. Accept the at-bound pair: exactly 64 jobs, exactly 32 suites in one job, exactly 32 `local` identifiers, a 64-character identifier, a 120-character `job`, and all identifiers unique; assert `ok: true` and the declaration echoes unchanged.
6. Assert the constants are declared exactly once with the DM-3 values and that the job-name bound reuses `VERIFY_GATES_MAX_EXPECTED_JOB_NAME_CHARS` rather than a second literal.

**Expected Outcome**:

- Every bound is inclusive at its declared limit and refused above it; the grammar and uniqueness rules are exact; the constants are a single source.

#### TC-SMAP-004 - The repository's pinned reference declaration resolves to equality against the real workflow job-name set and cites breadth end-to-end

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-2, AC-F1-1, AC-F1-4, AC-F2-1, DM-1, DM-2, DM-8, DM-9, NFR-10, DoD-5, DoD-8, DoD-11, DEC-11, DEC-17, DEC-18, DEC-19
**Test Type(s)**: Structure (current-tree invariant) + Integration (real configuration and workflow read, production composition end-to-end)
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/verify-gates-suite-map-reference.test.ts`; reads the committed project configuration document `<repo>/.delivery-os/config.yaml` (the delivered project-committed layer `<repo>/<configDirectoryName>/config.yaml`, directory derived from the working name `delivery-os`) and `.github/workflows/ci.yml` through the delivered adapters; drives the production `createVerifyGatesCommandRuntime` composition with injected provider facts
**Tags**: @bun, @structure, @config, @verify-gates, @reference

**Preconditions**:

- This change authors and commits `<repo>/.delivery-os/config.yaml`; the file is absent before the change, so the test fails if delivery does not create it.
- The real workflow declares the aggregate CI job whose display name is exactly `TS aggregate check`.

**Steps**:

1. Resolve the document path through the delivered branding seam and assert the file is read from `<repo>/.delivery-os/config.yaml`; assert the path is derived from `configDirectoryName`, never a hardcoded product name.
2. Resolve the committed configuration layer through the delivered configuration adapter; assert it declares `verify.suite-map` with `schemaVersion: "delivery.verify.suite-map.v1"` and that the declaration is the closed shape (exactly `schemaVersion`, `jobs[]`, `local`).
3. Assert the declaration's literal content is exactly the pinned DM-8/DEC-17 data: one `jobs[]` entry whose `job` is `TS aggregate check`, whose `suites` is exactly `[tests, lint, format, typecheck, boundaries, prompt-conformance, help-guide-coverage, exports-parity]` in that order, and a `local` list of exactly the same eight identifiers in the same order.
4. Read the real workflow job-name set through the delivered `readCiWorkflowJobNames`; assert the outcome is `read` and the set is valid (non-empty, unique, within caps).
5. Resolve breadth over the declaration and the read set; assert the outcome is `equal` (never `narrower`, `unmirrored`, or `uncorroborated`); assert `mirrorsJob` is exactly `TS aggregate check` and appears in the read set by exact string match; assert `suiteBreadth` equals the job's declared `suites` in declared order and is set-equal to `local`.
6. Drive the production composition end-to-end over the committed document and the real workflow file with injected provider facts (hermetic): assert exit `0`, `data.overall: "pass"`, `data.mirrorsJob: "TS aggregate check"`, `data.suiteBreadth` equal to the eight identifiers in declared order, and no `verify.narrowed-scope` refusal — the policy is live, not inert. The phase 9/10 lifecycle gate run is the same proof over live facts and is recorded as gate evidence in Section 10 and pm-notes.
7. Assert the resolution adds no source read: the one workflow read feeds both the CI gate and the mirror corroboration, the map costs exactly one bounded read of the committed document, no read of any other configuration layer occurs, and no provider, credential, or network call occurs.
8. Assert the production composition supplies the suite-map read over the one committed document on its own injection point, independently of the gate-set seam, and does not fall back to an undeclared map when the document declares one. A composition that leaves the policy inert fails this assertion; a composition that activates a declared `merge.gates` is outside this change (NG-7, DEC-11).

**Expected Outcome**:

- This repository's own gate runs cite breadth and do not refuse: DoD-8 is proven end-to-end against the real committed document and the real workflow, not by fixture reasoning.
- The policy is not inert: the production composition supplies the one-document map read, while the gate-set seam stays untouched and keeps supplying the shipped five (F-1, DEC-11, NG-7).
- A drift in any pinned literal of the document (path, schema, job name, an identifier, the order) or a renamed CI job fails this current-tree test rather than silently changing the claim.

**Notes / Clarifications**:

- The document path, schema, job name, the eight identifiers, and their order are pinned literals (DM-8, DEC-17, Appendix A row 21); this test asserts them *and* equality end-to-end, so both a document edit and a workflow rename are caught.
- This is a local-file invariant: no network, no provider socket, and no credentials. Step 6 injects provider facts so the composition proof stays hermetic; the live lifecycle run is gate evidence, not a test.

#### TC-SMAP-005 - Corroboration is exact string match; case, space, and punctuation variants are absent

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-4, AC-F1-3, DM-1, DM-4, NFR-6, DEC-5
**Test Type(s)**: Unit (match predicate) + Integration (CLI)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-suite-map-corpus.test.ts`; workflow fixtures `tests/fixtures/verify-gates/workflows/suite-map-case-variants.yml`
**Tags**: @bun, @behaviour, @suite-map, @corroboration, @negative

**Preconditions**:

- A valid workflow job-name set that contains exactly `TS aggregate check`.
- A map whose single job's suites equal `local` (so equality resolves before corroboration).

**Steps**:

1. With the declared `job` exactly `TS aggregate check`, assert the outcome is `equal` and the report cites the fields.
2. For each variant — `ts aggregate check`, ` TS aggregate check`, `TS aggregate check `, `TS-aggregate-check`, `TS  aggregate  check`, `TS aggregate check.` — run the same evaluation.
3. Assert each non-exact variant is `uncorroborated`: exit `1`, no `data`, `error.code: "config.value.invalid"`, the envelope `summary`/`hint` are the table's own, and no `detail` member exists.
4. Assert stderr is exactly two lines: `<binary>: config.value.invalid` then `cause: mirror=<the variant string verbatim>`; assert no case folding, trimming, punctuation normalization, or fuzzy match occurred, and that the printed job string is byte-equal to the declared variant (so the identifier rendering never rewrites it).
5. Assert `mirrorsJob` on a report is only ever a string the CI gate itself would accept as an expected job name (the workflow display `name`, else the job id).
6. Run each variant twice; assert identical outputs.

**Expected Outcome**:

- Only exact string equality corroborates a mirror; every near-match is absent and refused, never silently cited.

#### TC-SMAP-006 - Every configuration-document state is classified fail-closed: parity, refusal, or a resolved equality — never an unearned pass

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-4, AC-NFR8-1, DM-1, DM-9, NFR-8, NFR-10, DoD-11, DEC-18, C-15, Appendix A row 22
**Test Type(s)**: Integration (CLI, configuration seam) + Contract (classification and read order)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-config-document-posture.test.ts`; document fixtures under `tests/fixtures/verify-gates/suite-map/config/`; injected read outcomes in `tests/fixtures/verify-gates/suite-map/cases.ts`
**Tags**: @bun, @behaviour, @config, @verify-gates, @fail-closed, @negative

**Preconditions**:

- The committed-document slot resolved through the delivered branding seam (`<repo>/<configDirectoryName>/config.yaml`), and a seam harness that injects each document state: absent, unreadable, unparseable, parsed-without-node, defective node, defect-elsewhere, and a valid equality document.
- A recording runtime that fails the test on any ledger, repository, workflow, open-PR, detail, check-run, or work-item read for the states that must refuse.
- The pristine gate facts and the `job-01` equality declaration of TC-SMAP-001, so the only variable is the document state.

**Steps**:

1. Absent document — (a) no repository root and (b) a repository root with no such file: assert the run takes the delivered parity path, with the delivered gate-fact exit, no `error`, no breadth field, and bytes equal to the pre-change baseline (TC-SPAR-001, TC-SPAR-006); assert zero refusals and no invented map.
2. Present but unreadable (injected read failure — `EACCES`/`EISDIR`/IO error — through the configuration seam): assert exit `1`, no `data`, `error.kind: "config"`, `error.code: "config.value.invalid"`, the delivered `config` projection; assert the read recorder shows zero ledger, repository, workflow, open-PR, detail, check-run, and work-item calls; assert no report, no `suiteBreadth`/`mirrorsJob`, no `detail`, no record, and no capsule event.
3. Unparseable as a whole (malformed document body): assert the same identity, exit, no-`data`, and zero-source-read order as step 2; assert the document's finer delivered codes (`config.file.malformed` and any other `config.*` code) are normalised to `config.value.invalid` at this surface (DEC-18) and that no `cause:` line is written.
4. Parsed without a `verify.suite-map` node: assert the delivered parity path — bytes equal to the pre-change baseline, no refusal, no breadth fact — and assert explicitly that this state is undeclared and not a refusal.
5. Defective map node, one case per class: missing/unsupported `schemaVersion`; an undeclared or missing key of the map object; a non-list or empty `jobs`/`local`; an over-cap list; an undeclared or missing entry key; a non-string, empty, or over-120-character `job`; a duplicate `job`; an empty `suites`; a malformed, over-long, or duplicate identifier. Assert `config.value.invalid` at exit `1`, no `data`, zero source reads, one identity whichever layer (catalog schema or map resolver) catches it, no `detail`, no `cause:` line, no report, no breadth field, no record, and no capsule event.
6. Defect elsewhere in the document: a valid equality map plus (a) an unrelated invalid branch, (b) an unknown key outside the map node, and (c) a forbidden value elsewhere. Assert the gate run proceeds at exit `0` with `data.suiteBreadth`/`data.mirrorsJob` present, that no `config.value.invalid` is attributable to the outside defect, and that the otherwise valid declaration was not removed.
7. Overlay-only declaration with the committed document absent or without the node: assert the parity path (no refusal, no breadth); the full layer matrix is TC-SMAP-007.
8. Totality and non-pass assertions: assert every state lands on exactly one of {undeclared parity, `config.value.invalid` refusal, resolved equality}; assert no unusable state (unreadable, unparseable, defective node) yields a report, a breadth fact, a record, a capsule event, or a pass; assert a present-but-unusable document is never reclassified as undeclared (the refused run does not proceed to a report).
9. Read budget and isolation: assert exactly one bounded read of the committed document per invocation in every state, zero reads of any other configuration layer, zero retries, and no merged-tree read.
10. Run every state twice; assert identical stdout, stderr, and exit.

**Expected Outcome**:

- The configuration document is classified totally and fail-closed: the two undeclared states are the delivered parity path, every unusable state is a `config.value.invalid` refusal before any read, a defect outside the map node neither refuses nor removes the declaration, and no state yields an unearned pass.
- A present but unusable declaration never silently becomes "undeclared", closing the failure the story exists to prevent.

**Notes / Clarifications**:

- The unreadable state is injected through the configuration seam instead of relying on filesystem mode bits, which are unreliable under root and in CI; the asserted facts are the classification identity and the read/write ordering.
- AC-F1-4 and AC-NFR8-1 are the owning criteria; the parity scoping (which states carry a parity claim) is TC-SPAR-006.

#### TC-SMAP-007 - The project-committed layer slot is the map's only source; an overlay declaration has no effect

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-5, AC-F1-1, DM-1, DM-9, NFR-4, NFR-10, DoD-11, DEC-19, RSK-10, RSK-11, C-16, Appendix A row 23
**Test Type(s)**: Integration (CLI, layered configuration acquisition) + Contract (read isolation)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-config-layer-posture.test.ts`; overlay fixtures under `tests/fixtures/verify-gates/suite-map/layers/`; the delivered acquisition harness in `tests/fixtures/verify-gates/cases/harness.ts`
**Tags**: @bun, @behaviour, @config, @verify-gates, @layer-posture, @negative

**Preconditions**:

- The delivered configuration acquisition over its layers (defaults, system, user-global, project-committed, project-local, environment, CLI) and the seam that reads the committed document.
- Overlay fixtures declaring `verify.suite-map`: a user-global file, a project-local file (`<repo>/<configDirectoryName>/config.local.yaml`), a system file, an environment override, and a CLI override.
- Set A: the committed document is absent. Set B: the committed document carries the equality map.

**Steps**:

1. Set A with a user-global overlay declaring a narrowed map: assert the map is undeclared, the run takes the delivered parity path (no refusal, no breadth fact), and the overlay file was not read for the map.
2. Set A with the project-local overlay enabled by the acquisition and declaring a narrowed map: assert no effect — parity path, no refusal, no breadth.
3. Set A with the system layer, an environment override, and a CLI override each carrying the node: assert no effect in every case, and assert zero reads of those sources for the map.
4. Set B with a user-global overlay declaring a narrowed map: assert the committed declaration is honoured — exit `0`, equality report citing the committed breadth, no narrowing, no refusal; assert the overlay neither replaced nor completed it.
5. Set B with a project-local overlay adding an extra `jobs[]` entry and an extra `local` identifier: assert the map is resolved from the committed document alone, the extra entry appears in no citation and no resolution step, and the outcome is the committed-only outcome (equality here).
6. Read isolation: assert exactly one bounded read of the committed document per invocation, zero reads of the merged layer tree, zero reads of any other layer for the map, and that isolation comes from reading one source rather than from filtering a merged tree or from origin evidence.
7. Same-repository parity across ambient postures: run the same committed declaration once with every ambient overlay present and once with them absent (CI-like); assert the identical outcome, identical `data.suiteBreadth`/`data.mirrorsJob`, identical bytes after the permitted normalisation, and identical exits.
8. Assert an overlay declaration is not a refusal: no `config.value.invalid` arises from any overlay in any step.
9. Run each step twice; assert identical output.

**Expected Outcome**:

- The project-committed slot is the sole source of the map: an overlay declaration has no effect and is not a refusal, so the same repository resolves the same map locally as in CI and no unreviewed file supplies, completes, or replaces policy data.

**Notes / Clarifications**:

- RSK-11 (an explicitly selected file occupies the slot) is the declared residual: the selected file is the one read. Selection itself is delivered behaviour and is not re-specified here.
- AC-F1-5 is the owning criterion; the document's own state classification is TC-SMAP-006.

#### TC-SCITE-001 - The equality report cites `suiteBreadth` and `mirrorsJob`; gate records, summary, and human six lines are unchanged

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-5, AC-F2-1, DM-2, NFR-8, DoD-2, DEC-4, SC-M2-S7-01
**Test Type(s)**: Integration (CLI) + Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-breadth-report.test.ts`; `tests/golden/verify-gates-suite-map.test.ts`; fixture builder `tests/fixtures/verify-gates/suite-map/cases.ts`; goldens under `tests/fixtures/verify-gates/golden/`
**Tags**: @bun, @behaviour, @golden, @verify-gates, @breadth

**Preconditions**:

- The delivered golden's exact facts: change ref `GH-178`, branch `feat/GH-178/verify-gates-v1`, the 23 expected jobs `job-01`..`job-23`, all five gates passing, fixed clock and runId.
- An equality map whose mirror `job` is `job-01` (an expected job in that workflow set) and whose `suites` equal `local` in declared order. This fixture-only mirror is chosen because the delivered golden's workflow names are `job-01`..`job-23`; the repository reference declaration uses `TS aggregate check` and is covered by TC-SMAP-004. The reordered-`local` witness is TC-SCITE-006, which keeps this TC's fixture at the same order so the delivered gate-record and human-byte parity assertions stay minimal.
- The delivered `tests/fixtures/verify-gates/golden/success-data.json` and `human-success.txt` as the pre-change reference for gate records, summary, and human bytes.

**Steps**:

1. Run `verify gates GH-178 --json`.
2. Assert exit `0`, no `error`, `data.schemaVersion: "delivery.verify-gates.v1"`, `data.target: "gates"`, `data.overall: "pass"`.
3. Assert `data.suiteBreadth` deep-equals the mirror job's declared `suites` in declared order and `data.mirrorsJob` equals the non-empty declared `job` string (`job-01`); this satisfies the SC-M2-S7-01 assertion shape for the fixture.
4. Assert `JSON.stringify(data.gates)` equals `JSON.stringify(golden.gates)` **byte-for-byte**: the five records (id, verdict, reason, citation) and their stable key order are byte-identical to pre-change for the same facts.
5. Assert `data.summary` equals the delivered golden's `summary` (`{ gates: 5, passed: 5, failed: 0, unknown: 0 }`).
6. Assert the only new root keys on the report are `suiteBreadth` and `mirrorsJob`; no gate record and no citation gained a key.
7. Run human mode; assert stdout equals the delivered six-line human golden byte-for-byte, has exactly six lines, and contains no breadth line.
8. Assert the same fields and values through the MCP `gate-report` tool (the shared-engine parity is asserted in TC-SCITE-004).

**Expected Outcome**:

- SC-M2-S7-01 is satisfied: the report cites the CI job breadth and names the mirror, while every delivered field and human byte is preserved.

**Notes / Clarifications**:

- The seed says "job id"; per DM-2 the value is the expected-check-run name (display `name`, else the job id). The fixture uses `job-01` because the delivered golden's workflow names are `job-01`..`job-23`; the assertion is exact equality to the declared `job`. The repository's own reference declaration (`TS aggregate check`) is covered by TC-SMAP-004.

#### TC-SCITE-002 - The cross-repository report carries the same member-independent fields; existing fields are unchanged

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-2, DM-2, NFR-8, DoD-2, DEC-4, NG-6
**Test Type(s)**: Integration (CLI) + Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-breadth-report.test.ts`; `tests/golden/cross-repository-members.test.ts` (extend); fixtures `tests/fixtures/cross-repository/suite-map.ts` and `tests/fixtures/cross-repository/goldens/suite-map-report.json`
**Tags**: @bun, @behaviour, @golden, @cross-repository, @breadth

**Preconditions**:

- A two-member plan resolved through the delivered cross-repository path, with green member reads, injected landings and reviews, and the same equality declaration as TC-SCITE-001.
- The committed GH-310 member-form gate golden `tests/fixtures/cross-repository/goldens/gates-members-green.json`.

**Steps**:

1. Run the member-declaring change through the shared engine; assert exit `0`, `data.overall: "pass"`, and `data.definitionOfDone.status: "green"`.
2. Assert `data.suiteBreadth` and `data.mirrorsJob` are present with exactly the same values as the member-less report for the same declaration.
3. Assert `data.definitionOfDone`, `data.blockingMembers`, `data.reviewFlow`, and every `member`-bearing `gates[]` record deep-equal the GH-310 golden: no member field, count, blocker, or review verdict moved.
4. Change the declared member count and identities while keeping the same map; assert the two breadth fields are unchanged (member-independent).
5. Assert the fields appear once at the report root and never inside a member record or a citation.
6. Assert the cross-repository human output is unchanged (no added line) against the existing golden.

**Expected Outcome**:

- The cross-repository report carries the same two fields with the same values; all existing cross-repository fields and human bytes are unchanged.

**Notes / Clarifications**:

- Per-member breadth is out of scope (NG-6); the assertion is explicitly that the fields do not vary by member.

#### TC-SCITE-003 - The report fields pair, are bounded and unique, and never cite a differing local set or a union

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-3, DM-2, DM-3, NFR-1, NFR-2, DEC-4
**Test Type(s)**: Contract (runtime shape) + Types (static)
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/verify-gates-suite-map-contract.test.ts`; `tests/types/verify-gates-suite-map.type-test.ts`; report fixtures from `tests/fixtures/verify-gates/suite-map/cases.ts`
**Tags**: @bun, @structure, @types, @verify-gates, @breadth

**Preconditions**:

- Emitted reports for: equality (both fields), no map (neither field), narrowing (no report), unmirrored (no report), uncorroborated (no report), invalid workflow (no report), and cross-repository equality (both fields).

**Steps**:

1. For every emitted report, assert `(suiteBreadth === undefined) === (mirrorsJob === undefined)`: both present or both absent.
2. On reports with fields, assert `suiteBreadth` has length 1..32, every identifier is a non-empty unique string matching `^[a-z][a-z0-9-]*$` at 1..64 characters, and `mirrorsJob` is a non-empty string of 1..120 characters.
3. Assert `suiteBreadth` deep-equals the mirror job's declared `suites` in declared order; it is never a union of several jobs, and it is never the local declaration — including when the two sets are equal but ordered differently, where the emitted list must follow the mirror's order (the order witness is TC-SCITE-006).
4. Assert no report exists when `local` differs from every job's set or is a strict subset of the mirror (the narrowing/unmirrored outcomes are refusals).
5. Static type probe: `VerifyGatesReport` and `CrossRepositoryVerifyGatesReport` both declare optional `suiteBreadth?: readonly string[]` and `mirrorsJob?: string`; the report union remains discriminated by `definitionOfDone`; no gate record or citation type gained a field.
6. Assert the DM-3 constants are exported once with their exact values and the suite-id pattern is a single literal.

**Expected Outcome**:

- Field pairing and shape are total over every outcome, and the static contract matches the runtime shape.

#### TC-SCITE-004 - MCP `gate-report` inherits the two fields and the new identity; its input schema and tool set are unchanged

**Scenario Type**: Contract
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-F2-1, AC-F2-3, DM-2, §8.1, DoD-2
**Test Type(s)**: Integration (CLI/MCP parity) + Contract (tool schema)
**Automation Level**: Automated
**Target Layer / Location**: extend `tests/behaviour/mcp-gate-report-parity.test.ts` and `tests/fixtures/mcp/parity/cases.ts`; extend `tests/structure/mcp-contract.test.ts` for the input schema and tool set
**Tags**: @bun, @behaviour, @mcp, @parity, @breadth

**Preconditions**:

- The shared parity harness with a suite-map override, the equality case, and the narrowed case.
- The delivered `gate-report` tool catalog and input schema.

**Steps**:

1. Run the equality case through both the in-process CLI (oracle) and the MCP `gate-report` tool; assert the success data deep-equals, including `suiteBreadth` and `mirrorsJob`.
2. Assert the MCP input schema still accepts exactly `{ ref }` with no additional properties; assert the tool catalog still declares exactly `status`, `verify-artifact`, and `gate-report`.
3. Run the narrowed case through both; assert the same error kind and `verify.narrowed-scope` code, and that neither surface invents a pass or a data payload.
4. Assert the MCP tool adds no new input and no new tool; the fields and identity arrive through the shared engine.

**Expected Outcome**:

- The MCP mirror inherits the additive fields and the new refusal without a surface change.

**Notes / Clarifications**:

- Supplement to AC-F2-1/AC-F2-3: AC-F5-6 now owns the shipped MCP composition posture (TC-SCITE-005); this TC asserts the shared-engine field and identity inheritance and the unchanged input schema and tool set.

#### TC-SCITE-005 - The shipped MCP `gate-report` composition supplies the map read and refuses a narrowed declaration identically

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-3, AC-F5-6, DM-2, DM-7, NFR-5, NFR-8, DoD-11, DEC-20, RSK-4, Appendix A row 24
**Test Type(s)**: Structure (shipped composition) + Integration (MCP tool call) + Contract (tool schema and result shape)
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/mcp-gate-map-composition.test.ts` (new); extend `tests/behaviour/mcp-gate-report-parity.test.ts`, `tests/fixtures/mcp/parity/cases.ts`, and `tests/structure/mcp-contract.test.ts`
**Tags**: @bun, @structure, @behaviour, @mcp, @parity, @narrowed

**Preconditions**:

- The shipped MCP composition (the served `gate-report` runtime as built by the production composition), not a test-only override.
- Three checkout fixtures: the committed document declares the narrowed map; the committed document declares the equality map; the committed document is absent.
- The real state module and a capsule recorder; the shipped provider facts, where every provider read is injected as `credential-unavailable`.

**Steps**:

1. Structure: assert the shipped composition supplies the single-document map read over the same committed-document slot as the CLI, and that it performs at most one bounded read of that document and no read of any other layer. Assert the assertion is non-vacuous: a runtime built without the read fails it (this is the only check that can catch an inert mirror, RSK-4).
2. Narrowed declaration: call `gate-report` with exactly `{ ref }`; assert the call fails at exit `1` with `error.kind: "verify"`, `error.code: "verify.narrowed-scope"`, and returns no report; assert the bounded summary header line is byte-equal to the CLI refusal's header for the same declaration and change facts.
3. Assert the call appended no `merge.gate-verification` record and no capsule `gate.outcome` event (real state module plus recorder), and that the history read is not `torn`.
4. Assert `detail.suiteBreadth` is not projected into the tool result (DEC-20), while the CLI envelope for the same facts carries it (TC-SNARR-001); assert the refusal is observable through identity and summary only.
5. Undeclared map: assert the delivered tool outcome is unchanged — the provider reads remain `credential-unavailable`, so the delivered `verify.gates.unavailable` classification stands — and that no breadth field and no evidence member appears anywhere in the tool result.
6. Equality map: assert the tool outcome is the delivered one for the shipped provider facts (the delivered `verify.gates.unavailable` classification), byte-identical to the pre-change tool result for the same facts, with no breadth field and no evidence member where the delivered shape has none.
7. Contract: assert the input schema is exactly one `ref` with no additional properties, the tool set is unchanged, and the tool-result shape is unchanged (no new field, no new content block).
8. One engine: assert the CLI and the tool resolve the same declaration to the same outcome for the same facts (kind, code, summary), so the two surfaces cannot disagree.
9. Run each case twice; assert identical tool results.

**Expected Outcome**:

- The shipped mirror honours the policy: a narrowed declaration fails the call with the same identity and bounded summary, appends nothing, and returns no report; an undeclared or equality map leaves the delivered tool outcome unchanged.
- The tool contract is untouched, and the evidence member stays a CLI-envelope member.

**Notes / Clarifications**:

- This is the first AC that owns the shipped MCP posture (AC-F5-6, DEC-20, Appendix A row 24); TC-SCITE-004 keeps the shared-engine field/identity inheritance. The non-shipped-composition question is recorded as OQ-T6 in Section 8.3.

#### TC-SCITE-006 - Breadth-order witness: `data.suiteBreadth` reproduces the mirror job's declared order, never the local order

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, F-4, AC-F2-1, AC-F2-3, AC-F4-4, DM-2, NFR-2, DoD-2, DEC-3, DEC-4, C-4
**Test Type(s)**: Integration (CLI) + Golden
**Automation Level**: Automated
**Target Layer / Location**: extend `tests/behaviour/verify-gates-breadth-report.test.ts` and `tests/golden/verify-gates-suite-map.test.ts`; fixture builder in `tests/fixtures/verify-gates/suite-map/cases.ts`; golden `tests/fixtures/verify-gates/golden/suite-map-success-data-reordered.json`
**Tags**: @bun, @behaviour, @golden, @verify-gates, @breadth, @order-witness

**Preconditions**:

- An equality map whose mirror job declares `suites: [tests, lint, format, typecheck, boundaries, prompt-conformance, help-guide-coverage, exports-parity]` and whose `local` is **set-equal but ordered differently** — the reverse, `[exports-parity, help-guide-coverage, prompt-conformance, boundaries, typecheck, format, lint, tests]`.
- All five gates pass; the workflow job-name set contains the mirror; fixed clock and runId.

**Steps**:

1. Resolve breadth; assert the outcome is `equal` (set comparison is order-insensitive, DEC-3/DEC-5), so the fixture is a genuine equality and not a narrowing.
2. Assert `data.suiteBreadth` deep-equals the job's declared `suites` **in the job's declared order** (the forward list).
3. Assert `data.suiteBreadth` is **not** deep-equal to `local` as a list, and that the serialized `suiteBreadth` array differs from the serialized `local` array at every position.
4. Assert the explicit witness: step 2 fails if `suiteBreadth` is copied from `local` — a copy renders the reversed list, which differs from the mirror's order at every index. The reverse permutation is chosen so no accidental prefix, suffix, or set-order coincidence can pass.
5. Repeat with a third deterministic permutation that moves the first and last identifiers into the middle; assert `suiteBreadth` still equals the job's declared order and never the local order.
6. Assert the gate records and `data.summary` are byte-identical to the delivered golden, and the human six-line output is unchanged.
7. Run each variant twice; assert byte-identical stdout, stderr, and exit.

**Expected Outcome**:

- `suiteBreadth` is the mirrored CI breadth in the mirror's declared order; the local order is never cited, even when the two sets are equal.
- The witness fails if breadth were copied from `local`, so AC-F2-3's "never the local declaration" clause is observable on an emitted report.

**Notes / Clarifications**:

- Written for DoR iteration-1 finding F6: every earlier equality fixture declared `suites` and `local` in the same order, so set equality made the two lists identical and a `local`-copy implementation passed every stated TC. This fixture removes that coincidence and is the discriminator TR-10 relies on.

#### TC-SNARR-001 - The narrowed refusal carries the exact identity, `detail.suiteBreadth`, and the byte-pinned header naming the mirror's breadth

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DM-3, DM-5, DM-6, NFR-6, DoD-3, DEC-6, DEC-8, DEC-15, C-12, Appendix A rows 9 and 19, SC-M2-S7-02
**Test Type(s)**: Integration (CLI) + Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-narrowed-scope.test.ts`; `tests/golden/verify-gates-suite-map.test.ts`; narrowed fixtures in `tests/fixtures/verify-gates/suite-map/cases.ts`; golden `tests/fixtures/verify-gates/golden/suite-map-narrowed-envelope.json`
**Tags**: @bun, @behaviour, @golden, @verify-gates, @narrowed, @negative

**Preconditions**:

- The Flow 2 declaration: `local: [tests]`, and one job `job: "TS aggregate check"` whose `suites` are the eight reference identifiers `tests, lint, format, typecheck, boundaries, prompt-conformance, help-guide-coverage, exports-parity` in that order (a strict superset of `local`).
- A valid workflow whose job-name set contains `TS aggregate check`; all five gates pass; fixed clock (`2026-11-06T12:00:00Z`) and fixed runId.

**Steps**:

1. Run `verify gates GH-300 --json`; assert exit `1` and `data` absent.
2. Assert `error.kind: "verify"`, `error.code: "verify.narrowed-scope"`, `error.category: "user"`, `error.retryable: false`, `error.consequence: "not_landed"`. Assert `error.remediationHint` equals the DM-5 row's remediation hint verbatim. Assert `error.summary` is **not** the DM-5 row's one-sentence summary but the rendered failure summary block the command supplies and the `user-validation` projection honours: the header line pinned in step 3 plus exactly one line per evaluated gate (step 6). The row's one-sentence summary remains the row default and is asserted in TC-SCTR-003, never on this envelope.
3. Assert `error.summary`'s first line — the block's single header line — is **byte-equal** to the pinned DEC-15 header for these facts:
   `result=unknown; gates=5/5 passed, 0 failed, 0 unknown; scope=narrowed mirror=TS aggregate check breadth=tests,lint,format,typecheck,boundaries,prompt-conformance,help-guide-coverage,exports-parity`
   — the delivered header kept byte-identical, one `; ` between segments, one ASCII space between tokens, `<job>` verbatim and terminated by the final ` breadth=`, the `breadth=` identifiers `,`-delimited with no spaces in the mirror's declared order, no ` omitted` token at ≤8, and `result=unknown` because every gate passes under a narrowing.
4. Assert the `breadth=` list is the **mirror's** breadth and not the local set: it deep-equals the job's declared `suites`, it differs from `detail.suiteBreadth` (`["tests"]`), and the header carries no second or duplicated list (C-12).
5. Assert `detail.suiteBreadth` deep-equals the complete `local` declaration in declared order (`["tests"]`), with no truncation and no reordering; assert `detail` carries no other key.
6. Assert `error.summary` has exactly six lines: one header plus exactly one line per evaluated gate; every gate line retains its verdict, reason, source, counts, and names segments, and no gate line was shrunk or dropped for the header's sake.
7. Assert the delivered success header (`<binary> verify gates <ref>  pass  <p>/<t>`) never appears on the refusal, and no breadth appears on the human success channel.
8. Assert the human-visible failure rendering is `<binary>: verify.narrowed-scope` followed by the same `summary:` block: the header line byte-equal to step 3, then one line per gate (the `user-validation` projection honours the command-supplied block, so the DM-5 row's one-sentence summary appears on neither channel). The mirror and the breadth are named in that rendering and in the envelope's `error.summary` block, and nowhere else in the envelope. Assert no `cause:` line is written for a narrowing (DEC-16).
9. Assert the MCP `gate-report` surface returns the same code and no data (cross-checked in TC-SCITE-004; the shipped-composition variant is TC-SCITE-005).
10. Run the invocation twice; assert byte-identical stdout, stderr, and exit; assert the golden `suite-map-narrowed-envelope.json` matches byte-for-byte.

**Expected Outcome**:

- SC-M2-S7-02 is satisfied: exit `1`, `error.code == "verify.narrowed-scope"`, and the narrowed breadth named twice — the complete local set in `detail.suiteBreadth` and the mirror's CI breadth in the byte-pinned header.
- The header names the mirrored CI breadth in the mirror's declared order, never the local set, so `breadth=` means the same thing here as `data.suiteBreadth` does on a report.
- `error.summary` is the rendered six-line block (header plus one line per gate) supplied by the command and honoured by the `user-validation` projection, while `error.remediationHint` is the DM-5 row's hint; the row's own summary sentence reaches no narrowed envelope.

**Notes / Clarifications**:

- `error.summary` is the narrowed run's rendered failure summary block, not the DM-5 row's one-sentence summary: the command supplies the block and the `user-validation` projection honours it (F-3, Flow 2, DEC-6). The row's sentence stays the row default and is asserted in TC-SCTR-003 only; `error.remediationHint` is asserted here separately, against the DM-5 row's hint.
- The header's `breadth=` token names the mirror (CI) breadth in the mirror's declared order — never the narrowed local set, which is carried by `detail.suiteBreadth` alone (F-3, AC-F3-1, DEC-15, C-12; the earlier prose ambiguity was closed in spec v1.1 and is unchanged in v1.2).
- The token grammar, delimiters, order, `result=` formula, and `omitted` rendering are pinned (Appendix A rows 9 and 19); this TC asserts them byte-exactly and the first-capture golden records the same bytes, so the golden cannot mask a grammar drift.
- No `cause:` line belongs to a narrowing; the cause line exists only for the two map-side `config.value.invalid` refusals (DEC-16; TC-SRES-002/003).

#### TC-SNARR-002 - A narrowed refusal appends neither the record nor the capsule event; the prior record remains newest and not torn

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-2, AC-NFR5-1, DM-7, NFR-5, DoD-3, DoD-6, DEC-7, DEC-9
**Test Type(s)**: Integration (CLI, real state module) + Contract (write surfaces)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-suite-map-write-posture.test.ts`; uses the real `appendMergeGateVerification`/`readMergeGateVerifications` from `packages/core/src/state/merge.ts` and the delivered capsule producer port
**Tags**: @bun, @behaviour, @state, @capsule, @narrowed, @negative

**Preconditions**:

- A prior full-green record for the change ref appended through the real state module (fixed clock, fixed head SHA).
- The narrowed declaration; a capsule recorder that counts and records every `append` call; a state store that records mutating calls.

**Steps**:

1. Read the history through `readMergeGateVerifications`; assert one prior record and that the read is not `torn`.
2. Run `verify gates GH-300 --json`; assert exit `1` and `error.code: "verify.narrowed-scope"`.
3. Read the history again; assert exactly the same one record with the same `verifiedAt`, `headSha`, `gateSet`, and `gates`; assert the read is not `torn`.
4. Assert the newest record is the prior record and no record carries the narrowed run's head or timestamp.
5. Assert the capsule recorder observed zero `gate.outcome` appends and zero events for this run.
6. Assert the state store's mutation log contains no append, fence, or repair call for this run.
7. Run the narrowed invocation a second time; assert the same one prior record and zero capsule appends (idempotent refusal).
8. A second variant starts with an empty history; run the narrowed invocation; assert the history remains empty, the read is not `torn`, and zero capsule events were appended.

**Expected Outcome**:

- A narrowed run leaves no fresh full-green evidence: no record, no capsule event, and the prior record remains newest and readable.

#### TC-SNARR-003 - The narrowed refusal precedes `verify.gates.failed` and preserves every gate line

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-3, DM-3, DM-5, DoD-3, DEC-6, DEC-15
**Test Type(s)**: Integration (CLI)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-narrowed-scope.test.ts`
**Tags**: @bun, @behaviour, @verify-gates, @narrowed, @precedence

**Preconditions**:

- The narrowed declaration; a battery in which `ci-green` fails with its closed `ci-failed` reason and the other gates pass.

**Steps**:

1. Run `verify gates GH-300 --json`; assert exit `1` and no `data`.
2. Assert `error.code: "verify.narrowed-scope"`, not `verify.gates.failed`.
3. Assert `error.summary` (the rendered block, not the DM-5 row's one-sentence summary) has exactly six lines; the `ci-green` line carries `fail` and `reason=ci-failed` (or the fixture's pinned failing reason), and every other gate line is present with its verdict and reason.
4. Assert `error.summary`'s header line is byte-equal to the pinned grammar with `result=fail` (the battery overall is `fail` because `ci-green` failed) and the same `mirror=`/`breadth=` segment as TC-SNARR-001; assert no ` omitted` token at ≤8 identifiers, and that the `breadth=` list is the mirror's, never the local set.
5. Assert `detail.suiteBreadth` is present and complete.
6. Run a no-map control with the same failing facts; assert the delivered `verify.gates.failed` path still applies there, proving the precedence is specific to the narrowing.

**Expected Outcome**:

- The narrowed refusal wins over the gate failure without hiding any gate evidence; the delivered failure identity is unchanged for a non-narrowed run.

**Notes / Clarifications**:

- The asserted failure summary is `error.summary`, the rendered six-line block the `user-validation` projection honours. The DM-5 row's one-sentence summary is the row default and is asserted in TC-SCTR-003, not on this envelope; `result=` follows the delivered formula, so a failing gate renders `result=fail`.

#### TC-SNARR-004 - The narrowed refusal precedes the classified-unknown reuse and `verify.gates.unavailable`

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-4, DM-5, DoD-3, DEC-6
**Test Type(s)**: Integration (CLI)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-narrowed-scope.test.ts`
**Tags**: @bun, @behaviour, @verify-gates, @narrowed, @precedence

**Preconditions**:

- The narrowed declaration.
- Two fact bundles: one where a provider read yields a classified unknown (for example a `config.credential.missing` identity that would project through the delivered classified-unknown reuse), and one where no identity resolves (the delivered `verify.gates.unavailable` path).

**Steps**:

1. Run the classified-unknown bundle; assert exit `1`, `error.code: "verify.narrowed-scope"`, and not the classified identity.
2. Run the unclassified-unknown bundle; assert exit `1`, `error.code: "verify.narrowed-scope"`, and not `verify.gates.unavailable` (never exit `2`).
3. In both, assert `error.summary` (the rendered block, not the DM-5 row's one-sentence summary) carries every gate's verdict, reason, source, counts, and names, including the unknown gate.
4. Assert no `data` and a complete `detail.suiteBreadth`.
5. Run the same facts without a map; assert the delivered classified-unknown/`unavailable` identity is unchanged, proving the precedence is specific to the narrowing.

**Expected Outcome**:

- The narrowed refusal is the primary identity over both unknown paths; no gate evidence is lost and the delivered unknown taxonomy is untouched for non-narrowed runs.

**Notes / Clarifications**:

- The summary asserted here is `error.summary`, the rendered six-line block; the DM-5 row's one-sentence summary is the row default and is asserted only in TC-SCTR-003. `result=` renders `unknown` for an all-pass-under-narrowing battery and `fail` when a gate failed, per the delivered formula.

#### TC-SNARR-005 - Narrowed naming stays bounded: full local detail, the mirror's first eight plus ` omitted=<n>`, six lines, 4096 bytes

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-5, DM-3, DM-6, NFR-2, DoD-3, DEC-6, DEC-8, DEC-15, C-12, Appendix A rows 9 and 19
**Test Type(s)**: Integration (CLI) + Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-narrowed-scope.test.ts`; `tests/golden/verify-gates-suite-map.test.ts`; max-breadth fixtures in `tests/fixtures/verify-gates/suite-map/cases.ts`
**Tags**: @bun, @behaviour, @golden, @narrowed, @bounds

**Preconditions**:

- A narrowed declaration with nine local identifiers and a mirror job with a strict superset (at least ten identifiers, in a known declared order).
- A second maximal narrowing case: 31 local identifiers, a mirror job declaring the cap of 32 suites, and a 120-character mirror job name.

**Steps**:

1. Run the nine-identifier case; assert `detail.suiteBreadth` contains all nine in declared order, never truncated.
2. Assert `error.summary`'s header (its first line) prints exactly the mirror breadth's first eight identifiers in the mirror's declared order, `,`-delimited with no spaces, followed by ` omitted=<n>` where n is exactly the number of mirror breadth identifiers not printed (identifiers only — never bytes, gates, or tokens).
3. Assert the local set is never rendered in the header: no local identifier that is absent from the mirror's first eight appears anywhere on the header line, and the header carries exactly one `breadth=` list (C-12).
4. Assert `error.summary` has six lines and is at most 4096 bytes.
5. Run the maximum narrowing case (31 local identifiers, a 32-suite mirror, 120-character job name); assert the detail contains all 31 local identifiers, the header prints the mirror's first eight followed by ` omitted=24`, and `error.summary` remains within six lines and 4096 bytes. Assert the header is byte-equal to the pinned rendering and is never truncated (the delivered name-budget shrink applies to the gate lines only).
6. Assert the 0-identifier rendering is unreachable: a strict superset of a non-empty `local` has at least two identifiers, and no empty `breadth=`, trailing `,`, or ` omitted=0` form exists — asserted directly on the pure header helper so no branch can regress into it.
7. Assert every gate line is unchanged in shape and no gate line is dropped to satisfy the bound.
8. Run each case twice; assert the identifier list, `omitted` count, full header bytes, and summary bytes are identical.

**Expected Outcome**:

- The machine-readable detail is complete and untruncated while the bounded human header remains within every delivered cap, printing the mirror's breadth and only the mirror's breadth.

**Notes / Clarifications**:

- `omitted=<n>` counts mirror breadth identifiers not printed and nothing else: it is absent for 1..8 (TC-SNARR-001) and present for 9..32 with n = total − 8 (DEC-15, Appendix A row 19). The 0 case is unreachable by construction.
- Every `error.summary` assertion here is on the rendered six-line block (header plus one line per gate) that the `user-validation` projection honours, so the six-line and 4096-byte bounds apply to the block, not to the DM-5 row's one-sentence summary (asserted in TC-SCTR-003).

#### TC-SNARR-006 - A narrowed declaration on a member-declaring change refuses before any member read with the same identity and a one-line summary

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-5, AC-F3-6, AC-F3-1, DM-4, DM-5, DM-6, DM-7, NFR-5, NFR-6, DoD-12, DEC-6, DEC-7, DEC-15, C-17
**Test Type(s)**: Integration (CLI, cross-repository path) + Contract (no member read, no append)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-suite-map-member-posture.test.ts`; fixtures `tests/fixtures/cross-repository/suite-map.ts`; real state module; capsule recorder
**Tags**: @bun, @behaviour, @cross-repository, @narrowed, @negative

**Preconditions**:

- A member-declaring change with at least two declared members, resolved through the delivered cross-repository path.
- The narrowed declaration (`local: [tests]` against the eight-suite mirror job) and a valid workflow set containing the mirror.
- Member facts constructed so the cross-repository evaluation **would** produce the data-bearing `overall: "fail"` report at exit `1` with `blockingMembers[]`, member verdicts, and a `definitionOfDone.status` — so the precedence is witnessed, not assumed.
- A throwing member-read recorder: any member read fails the test.
- A prior full-green record for the change and a capsule recorder.

**Steps**:

1. Run `verify gates GH-300 --json`; assert exit `1` and `data` absent.
2. Assert `error.kind: "verify"`, `error.code: "verify.narrowed-scope"`, `error.category: "user"`, `error.retryable: false`, `error.consequence: "not_landed"` — identical to the member-less refusal (TC-SNARR-001).
3. Assert `detail.suiteBreadth` deep-equals the complete `local` declaration in declared order, untruncated and member-independent; assert `detail` carries no other key.
4. Assert `error.summary` is exactly one line, byte-equal to `result=unknown; gates=0/0 passed, 0 failed, 0 unknown; scope=narrowed mirror=<job> breadth=<id[,id]*>[ omitted=<n>]` — the delivered header formula over zero evaluated gates plus the pinned segment (delivered header tokens, one `; ` between segments, one space between tokens, the mirror's breadth in declared order, `<job>` verbatim, `omitted` only above eight).
5. Assert no member read occurred: the throwing recorder was never called, and no cross-repository evaluation ran.
6. Assert the data-bearing report is unreachable: no `overall`, no `definitionOfDone` (and no `definitionOfDone.status`), no `blockingMembers[]`, no `reviewFlow`, and no `member`-bearing gate record appears anywhere in stdout, stderr, or the envelope.
7. Assert no `merge.gate-verification` record was appended (the newest record is the pre-existing one; the history read is not `torn`) and zero capsule `gate.outcome` events were appended.
8. Assert no `cause:` line is written and the delivered success header never appears; assert no breadth appears on the human success channel.
9. Controls: run the same member world with an equality declaration and assert the delivered cross-repository report is emitted unchanged apart from the two additive fields (TC-SCITE-002); run the same narrowed declaration on a member-less change and assert the six-line block (TC-SNARR-001) — proving the one-line shape is the member-mode path only.
10. Run the narrowed member invocation twice; assert byte-identical stdout, stderr, and exit.

**Expected Outcome**:

- The member path refuses identically — same identity, exit `1`, and complete `detail.suiteBreadth` — before any member read, with the one-line member-mode summary, and appends neither the record nor the capsule event.
- The data-bearing `overall: "fail"` report, every member verdict, and every `definitionOfDone.status` are unreachable for a narrowed declaration.

**Notes / Clarifications**:

- The member-mode summary is one line because no gate is evaluated on that path; the delivered formula over zero evaluated gates yields `result=unknown; gates=0/0 passed, 0 failed, 0 unknown` (F-3, AC-F3-6, DEC-15). The member-less path keeps the delivered six-line block because its battery has already been evaluated.
- AC-F3-6 and DEC-6 own the precedence; AC-F3-2 and TC-SNARR-002 own the member-less no-append rule, and this TC is its member-path counterpart.

#### TC-SRES-001 - An invalid workflow read yields the delivered CI failure and no breadth anywhere

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DM-4, NFR-6, DoD-4, DEC-5, DEC-10
**Test Type(s)**: Integration (CLI) + Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-suite-map-corpus.test.ts`; workflow fixtures under `tests/fixtures/verify-gates/workflows/` (`empty-jobs.yml`, `duplicate-names.yml`, `malformed.txt`, `over-bytes.yml`, `over-cap.yml`, `over-long.yml`) and an absent-file case
**Tags**: @bun, @behaviour, @workflow, @verify-gates, @negative

**Preconditions**:

- A valid equality map with a declared job name.
- The delivered workflow fixtures plus an absent workflow (no `ci.yml`).

**Steps**:

1. For each invalid workflow state, run `verify gates GH-300 --json`.
2. Assert exit `1`, no `data`, and `error.code: "verify.gates.failed"` (the delivered envelope).
3. Assert the `ci-green` gate record is `fail` with the closed reason `ci-expected-jobs-invalid`, and every other gate evaluates per its facts.
4. Assert the delivered failure summary is present and is the delivered header-plus-five shape.
5. Assert `suiteBreadth` and `mirrorsJob` appear nowhere in stdout or stderr, and no report is emitted.
6. Assert no pass is produced on any path and no breadth is derived from observed check-run names.
7. Run each state twice; assert identical outputs and exits.

**Expected Outcome**:

- An invalid workflow never corroborates breadth; the delivered CI failure and exit taxonomy stand, and no breadth fact is invented.

#### TC-SRES-002 - An uncorroborated mirror is `config.value.invalid` with the table's own envelope prose and exactly one bounded `cause: mirror=<job>` error-stream line

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-2, DM-3, DM-4, NFR-2, NFR-6, DoD-4, DEC-5, DEC-14, DEC-16, Appendix A row 20
**Test Type(s)**: Integration (CLI) + Contract (projection) + Golden (stderr bytes)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-suite-map-corpus.test.ts`; workflow fixture `tests/fixtures/verify-gates/workflows/suite-map-mirror-absent.yml`; golden `tests/fixtures/verify-gates/golden/suite-map-cause-mirror.txt`
**Tags**: @bun, @behaviour, @workflow, @verify-gates, @corroboration, @negative

**Preconditions**:

- A valid map whose mirrored `job` is `TS aggregate check` and whose `local` equals that job's suites.
- A validly read workflow job-name set that does not contain that exact string.

**Steps**:

1. Run `verify gates GH-300 --json`; assert exit `1` and no `data`.
2. Assert `error.kind: "config"` and `error.code: "config.value.invalid"`.
3. Assert `error.summary` equals the table's `config.value.invalid` summary and `error.remediationHint` equals the table's hint verbatim: the command-supplied config summary and hint are suppressed as delivered.
4. Assert stderr is exactly two lines and byte-equal to the golden: `<binary>: config.value.invalid` followed by `cause: mirror=TS aggregate check` — one physical line, no third line, no wrapping, no payload, path, or secret; assert the `cause:` line is ≤134 characters (`14 + VERIFY_GATES_MAX_EXPECTED_JOB_NAME_CHARS`).
5. Assert the envelope carries no `detail` member, no `cause` key, and that the mirror string appears nowhere in the envelope (`error.summary`, `error.remediationHint`, any `detail`).
6. Assert no report and no breadth field (`suiteBreadth`/`mirrorsJob`) anywhere in stdout or stderr.
7. Run human mode; assert the same two-line diagnostic and exit `1`.
8. Negative controls: assert a structurally invalid map (TC-SMAP-002) writes no `cause:` line, and that no other failure code writes one.

**Expected Outcome**:

- The uncorroborated declaration is a configuration refusal, not a report; the envelope carries the table's own prose and `detail` stays absent, while exactly one bounded identifier-only line names the drifted mirror on the error stream.

**Notes / Clarifications**:

- The carrier and its grammar are pinned (DEC-16, Appendix A row 20): `cause: mirror=<job>` after `<binary>: config.value.invalid`, ≤134 characters, mirror form. The command name prefix is the delivered `<binary>` rendering, not a literal the test invents.
- The job name is the declared string verbatim (spaces preserved, never quoted, escaped, case-folded, trimmed, or truncated).

#### TC-SRES-003 - An unmirrored local breadth is `config.value.invalid` with exactly one bounded `cause: breadth=<id[,id]*>[ omitted=<n>]` error-stream line

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-3, DM-3, DM-4, NFR-2, NFR-6, DoD-4, DEC-5, DEC-14, DEC-16, Appendix A row 20
**Test Type(s)**: Integration (CLI) + Contract (projection) + Golden (stderr bytes)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-suite-map-corpus.test.ts`; fixtures in `tests/fixtures/verify-gates/suite-map/cases.ts`; goldens `tests/fixtures/verify-gates/golden/suite-map-cause-breadth.txt` and a nine-plus case variant
**Tags**: @bun, @behaviour, @suite-map, @unmirrored, @negative

**Preconditions**:

- Two declarations: (a) `local` is a strict superset of every declared job's `suites`; (b) `local` is disjoint from every job's `suites`.
- A nine-plus-identifier declaration so the ` omitted=<n>` rendering is exercised as well as the ≤8 rendering.
- A valid workflow job-name set.

**Steps**:

1. For each declaration, run `verify gates GH-300 --json`; assert exit `1` and no `data`.
2. Assert `error.code: "config.value.invalid"`, with the table's own summary and hint verbatim (no command config prose).
3. Assert stderr is exactly two lines and byte-equal to the golden: `<binary>: config.value.invalid` followed by `cause: breadth=<local identifiers in declared order, comma-delimited with no spaces, at most the first eight printed>[ omitted=<n>]`, where `omitted` appears only above eight identifiers and counts exactly the unprinted local identifiers; assert one physical line, no wrapping, no payload, path, or secret.
4. Assert the `cause:` line is ≤545 characters (`15 + 8 × VERIFY_SUITE_MAX_ID_CHARS + 7 + 9 + 2`) and that no printed identifier is truncated.
5. Assert the envelope carries no `detail`, no `cause` key, and that the local list appears in no envelope field.
6. Assert no report is emitted and neither `suiteBreadth` nor `mirrorsJob` appears anywhere.
7. Assert a wider-than-CI breadth is never reported as a pass, even when every gate passes.
8. Run each case twice; assert identical stdout, stderr, and exit.
9. Negative control: assert a structurally invalid map writes no `cause:` line.

**Expected Outcome**:

- No single job covers the local set: the declaration is refused, the local breadth is named only on the bounded `cause: breadth=…` line, and wider-than-CI breadth is never rendered as a report.

**Notes / Clarifications**:

- The carrier, its identifier rendering, and its bounds are pinned (DEC-16, Appendix A row 20; reuse of the narrowed header's rendering per DEC-15): declared order, `,`-delimited, at most eight printed, `omitted` counting identifiers not printed.

#### TC-SRES-004 - Two equal jobs: the first in declared order wins and two runs are byte-identical

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-4, AC-NFR2-1, DM-3, DM-4, NFR-2, DoD-1, DEC-3
**Test Type(s)**: Integration (CLI) + Determinism
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-suite-map-determinism.test.ts`; fixtures in `tests/fixtures/verify-gates/suite-map/cases.ts`
**Tags**: @bun, @behaviour, @determinism, @suite-map

**Preconditions**:

- A map with two jobs whose `suites` sets both equal `local`, in declared order `[first, second]`; a valid workflow containing both names; all gates pass.

**Steps**:

1. Run `verify gates GH-300 --json` twice over unchanged facts.
2. Assert `data.mirrorsJob` is `first` on both runs and `data.suiteBreadth` is `first`'s declared order.
3. Assert stdout, stderr, and exit are byte-identical across the two runs.
4. Swap the declared order to `[second, first]`; run twice; assert `second` wins both times and the reports are byte-identical within that declaration.
5. Assert set comparison is order-insensitive (the equality is found even when the two lists are ordered differently), while the citation order follows the selected job's declaration.
6. Assert no sorting, digest, or invented tie-break influences the result.

**Expected Outcome**:

- The first equality in declared order is the deterministic mirror; repeated runs over one declaration are byte-identical.

#### TC-SRES-005 - Four-outcome totality matrix: every declaration state resolves to exactly one outcome and never an unearned pass

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, AC-F4-2, AC-F4-3, AC-F4-4, DM-4, NFR-6, DoD-1, DoD-4, C-3, DEC-5
**Test Type(s)**: Unit (resolver matrix) + Integration (CLI)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-suite-map-corpus.test.ts`; matrix data in `tests/fixtures/verify-gates/suite-map/cases.ts`
**Tags**: @bun, @behaviour, @suite-map, @totality, @matrix

**Preconditions**:

- A matrix of declarations: equality, two-equal, narrowing, wider-than-every-job, disjoint, mirror-absent, and structurally invalid.
- A matrix of workflow facts: a valid set containing the mirror, a valid set omitting it, and the invalid variants from TC-SRES-001.

**Steps**:

1. Enumerate the valid declaration × valid workflow matrix; for each cell, classify the outcome as exactly one of `equal` (report), `narrower` (refusal), `unmirrored` (`config.value.invalid`), or `uncorroborated` (`config.value.invalid`).
2. For each invalid workflow cell, assert no breadth outcome is produced and the delivered `verify.gates.failed` path applies with no breadth anywhere.
3. Assert the diagnostic carrier per outcome: `uncorroborated` writes exactly one `cause: mirror=<job>` line, `unmirrored` exactly one `cause: breadth=<id[,id]*>[ omitted=<n>]` line, and `equal`, `narrower`, invalid-map, and invalid-workflow write no `cause:` line at all (DEC-16).
4. Assert there is no fifth outcome: no partial match, no union, no first-subset fallback, no check-run-derived attribution.
5. Assert equality never reports a superset; vary the check-run names while holding the declaration and workflow fixed, and assert the report bytes do not change.
6. Assert every narrowing is a refusal and every uncorroborated breadth is a non-report outcome across the whole matrix.
7. Assert the outcome union is a closed type/vocabulary: the resolver returns one of the four declared outcomes plus the workflow-invalid precondition, never an open string.

**Expected Outcome**:

- Breadth resolution is total: every declaration state lands on exactly one declared outcome, and only equality can produce a report.

#### TC-SPAR-001 - No declared map is byte-identical to the pre-change corpus and goldens; no breadth key appears

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, DM-2, NFR-8, DoD-5, DEC-12
**Test Type(s)**: Integration (CLI) + Golden/parity
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-parity-suite-map.test.ts`; `tests/golden/verify-gates.test.ts` (unchanged); pre-change baseline `tests/fixtures/verify-gates/suite-map/parity-baseline.json`; delivered corpus `tests/fixtures/verify-gates/corpus/cases.json`
**Tags**: @bun, @behaviour, @golden, @parity, @regression

**Preconditions**:

- A configuration with no `verify.suite-map`.
- The pre-change parity baseline captured once at `main-tools` tip `8a1f77ad` before any suite-map code lands, over all delivered corpus cases in JSON and human modes (`caseId`, `stdout`, `stderr`, `exitCode`).
- The committed delivered goldens `success-data.json`, `human-success.txt`, and `failure-summary.txt`.

**Steps**:

1. For every corpus case, run `verify gates GH-178 --json` and human mode with no map.
2. Assert `stdout`, `stderr`, and `exitCode` byte-equal the pre-change baseline for each case.
3. Assert the success data and human output byte-equal the delivered goldens; for the case the delivered failure-summary golden represents, assert the failure summary byte-equals that golden.
4. Assert `suiteBreadth` and `mirrorsJob` appear nowhere in any output, envelope, or appended record.
5. Assert the appended record bytes (where a case appends) equal the pre-change record bytes.
6. Run each case twice; assert identical bytes.

**Expected Outcome**:

- The undeclared-map path is a hard parity guarantee: every delivered byte, exit, and record is unchanged.

**Notes / Clarifications**:

- The baseline is captured before code lands. Regenerating it after the change is allowed only with a review-visible diff and a recorded reason; otherwise the parity proof becomes a tautology.

#### TC-SPAR-002 - A declared-map passing evaluation appends exactly one delivered-shape record with no breadth key and reads back not torn

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-2, AC-NFR5-1, DM-7, NFR-5, DoD-6, DEC-7, DEC-9
**Test Type(s)**: Integration (CLI, real state module) + Contract (record shape)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-suite-map-write-posture.test.ts`; real `appendMergeGateVerification`/`readMergeGateVerifications`
**Tags**: @bun, @behaviour, @state, @verify-gates, @append

**Preconditions**:

- The equality map, all five gates passing, fixed clock and head SHA.
- An empty state history and a capsule recorder.

**Steps**:

1. Run `verify gates GH-300 --json`; assert exit `0`.
2. Read the history; assert exactly one record appended by this evaluation, and the read is not `torn`.
3. Assert the record has exactly `schema: "delivery.merge.gate-verification.v1"`, `changeRef` equal to the invocation ref, `headSha`, `verifiedAt`, `gateSet` (`schemaVersion` and `ids` only), `gates[]` where each record has exactly `id`, `verdict`, `reason`, `citation` and no other key, and `trackerPosture`.
4. Assert no breadth key or breadth fact appears anywhere in the record or the raw payload.
5. Assert the record's `gates[]` order and count equal the report's five gate records.
6. Assert exactly one capsule `gate.outcome` event with the unchanged payload field set (`gateSet`, `headSha`, `gates[]`).
7. Assert the post-append equality check passes and no state error is reported.

**Expected Outcome**:

- The ledger shape and one-append counting are unchanged; breadth stays out of the durable record.

#### TC-SPAR-003 - The CI gate's expected set, counts, names, reasons, and verdict are unchanged by the map

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-3, DM-1, DM-4, DoD-5, DEC-10
**Test Type(s)**: Integration (CLI) + Contract (citation)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-parity-suite-map.test.ts`; extends `tests/behaviour/verify-gates-ci.test.ts` patterns
**Tags**: @bun, @behaviour, @verify-gates, @ci, @regression

**Preconditions**:

- A declared map with one job that is not in the workflow job-name set (for example `not-a-workflow-job`), plus the equality job.
- A green workflow and check-run page; a second case with one missing expected job and a red run.

**Steps**:

1. Evaluate the CI gate with no map and with the map; assert the `ci-green` record deep-equals (verdict, reason, citation sources, counts, names, identity) in the green case.
2. Repeat with a missing expected job and with a red run; assert the delivered `ci-missing-jobs`/`ci-failed` records are unchanged.
3. Assert the map job `not-a-workflow-job` appears in no expected-job count, no missing/failed/pending name list, and no citation source.
4. Assert the map alone cannot pass or fail the CI gate: vary the map's job and suites; the CI record is unchanged.
5. Assert the CI gate's expected set is still exactly the read workflow job-name set and the map contributes no member.
6. Assert the seven-source/citation vocabulary is unchanged.

**Expected Outcome**:

- The CI gate remains job-presence only; the map neither adds an expected job nor changes a CI reason or verdict.

#### TC-SPAR-004 - Read counts are identical with and without a map, with zero retries and zero pagination

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-4, NFR-4, DM-7, DoD-5, DEC-10
**Test Type(s)**: Integration (CLI, read budget) + Contract (counting transport)
**Automation Level**: Automated
**Target Layer / Location**: extend `tests/behaviour/verify-gates-read-budget.test.ts`; counting recorder in `tests/fixtures/verify-gates/cases/harness.ts`
**Tags**: @bun, @behaviour, @verify-gates, @read-budget, @regression

**Preconditions**:

- A recording runtime that wraps `readLifecycle` (document and registry), `readRepository`, `readWorkflow`, `readOpenPullRequests`, `readDeliveryRequestDetail`, `readCheckRuns`, `readWorkItem`, and the configuration seams.
- The same green facts run (a) with no map and (b) with the equality map.

**Steps**:

1. Run with no map; record every call name, argument, and count.
2. Run with the equality map; record every call name, argument, and count.
3. Assert the per-source counts and arguments are identical: one `readLifecycle` call (the pm-notes document plus the ledger registry), one `readRepository` HEAD/branch read, one `readWorkflow` CI read, at most one open-PR page (100), one resolved detail read, one check-run page (100), and one work-item read.
4. Assert zero retries and zero pagination in both runs.
5. Assert `readWorkflow` is called exactly once and its result feeds both the CI gate and the mirror corroboration.
6. Assert the map resolution performs no transport call and no filesystem read beyond the configuration seam; assert no additional source read appears in the recorder.
7. Run the narrowed and invalid-map cases; assert the invalid-map case performs zero source reads and the narrowed case performs exactly the same source reads as a non-narrowed evaluation.

**Expected Outcome**:

- The read budget is unchanged: the map adds no read, corroboration reuses the one workflow read, and retries/pagination remain zero.

**Notes / Clarifications**:

- The configuration seam itself is counted as a configuration call, not a source read (Section 8.3, OQ-T4). The assertion is on the external source counts and the absence of a transport call.

#### TC-SPAR-005 - The grammar is unchanged: a third positional or unknown flag is `fallback.invocation` before any read and no map is resolved

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-5, DoD-5, DEC-1
**Test Type(s)**: Integration (CLI, surface)
**Automation Level**: Automated
**Target Layer / Location**: extend `tests/behaviour/verify-gates-surface.test.ts`; `tests/behaviour/verify-gates-suite-map.test.ts`
**Tags**: @bun, @behaviour, @verify-gates, @grammar, @regression

**Preconditions**:

- A throwing runtime that fails the test on any read or map resolution, plus a valid map injection.

**Steps**:

1. Run `verify gates GH-300 extra`; assert exit `1`, `error.code: "fallback.invocation"`, and no `data`.
2. Run `verify gates GH-300 --gate ci-green`; assert exit `1` and `fallback.invocation`.
3. Assert no source read and no map resolution occurred (the throwing runtime is never called).
4. Assert the command definition still declares `positionals.max: 2`, no command-specific flags, and exactly the three subcommands `change`, `gates`, and `deploy`.
5. Assert `verify gates GH-300` with the map still runs normally, proving the rejection is grammar-specific.

**Expected Outcome**:

- The invocation grammar is unchanged; a third positional or unknown flag is rejected before any configuration or source read.

#### TC-SPAR-006 - Parity is scoped: undeclared states are byte-identical, unusable document states are the AC-F1-4 refusal, and the two sets are disjoint

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-1, AC-NFR8-1, AC-F1-4, AC-F5-1, DM-9, NFR-8, NFR-10, DoD-5, DoD-11, DEC-12, DEC-18
**Test Type(s)**: Integration (CLI) + Golden/parity + Contract (scope manifest)
**Automation Level**: Automated
**Target Layer / Location**: extend `tests/behaviour/verify-gates-parity-suite-map.test.ts`; baseline `tests/fixtures/verify-gates/suite-map/parity-baseline.json`; scope manifest `tests/fixtures/verify-gates/suite-map/parity-scope.json`; document fixtures from TC-SMAP-006
**Tags**: @bun, @behaviour, @golden, @parity, @scoping, @regression

**Preconditions**:

- The pre-change parity baseline captured at `main-tools` tip `8a1f77ad` (TC-SPAR-001) and the delivered goldens.
- A scope manifest listing every fixture state with exactly one classification: `parity` (absent document, document without a map node), `refusal` (unreadable, unparseable, defective map node), or `resolved-equality`.
- The document-state fixtures from TC-SMAP-006 and the same pristine gate facts.

**Steps**:

1. For each parity state — absent document and document without the map node — run the delivered corpus in JSON and human modes; assert stdout, stderr, exit, and the appended record bytes equal the pre-change baseline byte-for-byte, and assert neither breadth field appears.
2. For each unusable state — present but unreadable, unparseable as a whole, defective map node — assert the outcome is exactly the AC-F1-4 `config.value.invalid` refusal (matrix detail in TC-SMAP-006) and assert **no** parity claim is made: no baseline equality is asserted for these states.
3. Assert the scoped divergence explicitly: the baseline entry for the same gate facts is the delivered report, while the post-change outcome for an unusable document is a refusal — so the change's only delivered-behaviour delta is stated, not silent.
4. Assert disjointness: every fixture state appears in the manifest exactly once with exactly one classification; assert no state is both a parity path and a refusal, and no state yields both a delivered report and a refusal.
5. Assert the tolerance boundary: with a valid map plus a defect outside the map node, the run is neither refused nor parity-only — it reports the delivered bytes plus the two additive breadth fields; pair every outside-defect case with an inside-node defect case that refuses, proving the tolerance is bounded to exactly the node.
6. Assert the scope manifest is complete against TC-SMAP-006's matrix (every document state classified) and that the baseline file carries no entry for an unusable state.
7. Run every parity state twice; assert byte-identical output.

**Expected Outcome**:

- Undeclared states are byte-identical to pre-change; unusable states are refusals and never silent parity; the two sets are disjoint and the outside-node tolerance is bounded to exactly the map node.

**Notes / Clarifications**:

- NFR-8's guarantee is scoped by NFR-10/AC-F1-4: a present document that cannot be read, parsed, or resolved is the one state whose delivered outcome deliberately changes, and this TC is the structural witness that no fixture is claimed as both parity and refusal.

#### TC-SCTR-001 - Envelope continuity across every new outcome; closed `detail` members; exits stay `{0,1,2}`

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, NFR-1, AC-NFR1-1, DM-6, DoD-7
**Test Type(s)**: Contract (envelope) + Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/verify-gates-suite-map-contract.test.ts`; extend `tests/structure/envelope-contract.test.ts`, `tests/structure/result-contract.test.ts`, and `tests/fixtures/result/envelope-key-set.json`
**Tags**: @bun, @structure, @result-contract, @verify-gates

**Preconditions**:

- Captured envelopes from: an equality success, a narrowed refusal, a config-shaped refusal (unmirrored/uncorroborated), a delivered `verify.gates.failed`, a classified-unknown reuse, and an invalid map.
- The updated `tests/fixtures/result/envelope-key-set.json` whose `failureDetailMembers` is `["holder", "suiteBreadth"]`.

**Steps**:

1. For each envelope, assert the top-level keys are a subset of `{schemaVersion, runId, exitCode, timing, data, error, detail}` and exactly one of `data`/`error` is present.
2. Assert `schemaVersion: "delivery.result.v1"`, all five mandatory fields present, and no `ok`/`command`/other top-level key.
3. Assert `detail`, when present, is an object whose keys are a subset of `{holder, suiteBreadth}`; no open key-value map.
4. Assert every `exitCode` is in `{0,1,2}` and matches the projection class of the resolved row.
5. Assert the narrowed envelope has `detail.suiteBreadth` and no `holder`; a holder-only failure still projects `holder` unchanged and no `suiteBreadth`.
6. Assert no envelope carries a breadth key under `error` or at a non-declared root level.

**Expected Outcome**:

- The `delivery.result.v1` envelope is continuous: one declared `detail` addition, no new top-level key, and the `{0,1,2}` projection preserved.

#### TC-SCTR-002 - The `detail.suiteBreadth` projection is explicit, validated, never truncated, and absent outside a narrowing

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, F-5, NFR-1, AC-NFR1-1, AC-F3-1, AC-F3-5, DM-6, DoD-7, DEC-8
**Test Type(s)**: Contract (projection) + Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/verify-gates-suite-map-contract.test.ts`; `packages/cli/src/index.ts` detail projection; `tests/fixtures/result/envelope-key-set.json`
**Tags**: @bun, @structure, @result-contract, @detail, @verify-gates

**Preconditions**:

- The projection helper and handler envelopes; a direct projection case with the declared 32-entry maximum, plus a handler narrowing at 31 local identifiers against a 32-suite mirror.

**Steps**:

1. Positive: assert the narrowed envelope `detail.suiteBreadth` deep-equals the complete local list in declared order, with all 31 identifiers intact and no truncation; assert the direct projection accepts the declared 32-entry bound unchanged.
2. Negative: feed a non-array, a non-string element, an empty element, a 65-character element, 33 entries, a newline/control character, and a non-record `detail`; assert the value is never projected and never silently clipped.
3. Assert `detail` is absent on a success, a config-shaped refusal, a delivered gate failure, and a `holder`-only failure.
4. Assert `holder` still projects unchanged when present, and `suiteBreadth` coexists only with the declared set.
5. Assert the projection reads only the declared members: an undeclared key inside `detail` is never copied to the envelope.
6. Assert no other command projects `suiteBreadth` (source scan of the projection call sites).
7. Assert the summary projection follows the same projection-class rule on the same captured envelopes: on the narrowed envelope (`user-validation`) `error.summary` is the command-supplied six-line block (header plus one line per gate) and `error.remediationHint` is the DM-5 row's hint; on a `config`-shaped refusal (unmirrored, uncorroborated, structurally invalid) the command-supplied prose is suppressed and `error.summary`/`error.remediationHint` are the table's own. The DM-5 row's one-sentence summary appears on no envelope; it is asserted on the table in TC-SCTR-003.

**Expected Outcome**:

- The detail member is explicit and bounded: complete or absent, never truncated and never an open map.
- The summary projection is class-consistent: the narrowed rendered block is honoured, and config-shaped prose stays suppressed and table-own.
- `error.summary` never carries the DM-5 row's one-sentence summary on a narrowed envelope; `error.remediationHint` is asserted separately from `error.summary`.

**Notes / Clarifications**:

- `error.summary` (the rendered block) and the DM-5 row's `summary` field are two different values with two different owners: the block is the command-supplied value the `user-validation` projection honours (TC-SNARR-001), and the row sentence is the row default asserted on the table and its documented mirror (TC-SCTR-003).

#### TC-SCTR-003 - The error table and its documented mirror are two-way synced; the `verify` kind carries seven identities

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, NFR-7, AC-NFR7-1, DM-5, DoD-7, DEC-6
**Test Type(s)**: Structure + Checks (sync gate) + Contract
**Automation Level**: Automated
**Target Layer / Location**: extend `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/structure/delivery-result-contract.test.ts`; extend `tests/fixtures/result/code-corpora/true-positives.json`
**Tags**: @bun, @structure, @checks, @error-table, @sync

**Preconditions**:

- The added `verify.narrowed-scope` row in `ERROR_TABLE` and the documented row in `doc/spec/features/feature-result-contract.md` (phase 7 reconciliation, before phase 9 gates).
- The delivered pre-change row snapshots for `verify.ledger.incomplete`, `verify.gates.failed`, `verify.gates.unavailable`, and the three deploy rows.

**Steps**:

1. Assert exactly one row has code `verify.narrowed-scope`, with `domainKind: "verify"`, `category: "user"`, `retryable: false`, `consequence: "not_landed"`, `projectionClass: "user-validation"`, and the row's exact `summary` sentence and `remediationHint` from DM-5 (row fields, not the rendered envelope block of TC-SNARR-001).
2. Assert the documented table has exactly one matching row with identical fields; run `runSyncCheck` on the live tree and assert zero failures in both directions.
3. Assert the `verify` kind has exactly seven identities and `verify gates` has exactly three; assert no new domain kind and no delivered row reworded (deep-equal the pre-change rows).
4. Add one true-positive corpus entry for `verify.narrowed-scope`; assert it is recognized and resolves to the row.
5. Assert the live entry count moved from 135 to 136 and the documented count is identical.
6. Assert a mutation that removes either side fails the sync check (the existing negative controls remain non-vacuous).

**Expected Outcome**:

- Exactly one row is added and two-way synced; the kind and row counts move as pinned; no delivered row or kind changes.

**Notes / Clarifications**:

- The doc row must land no later than phase 7 and before phase 9 `pnpm check`; otherwise the delivered sync gate fails. This is a delivery-sequencing dependency, not an AC gap.
- The row's `summary` sentence and `remediationHint` asserted here are the row's own defaults and must match the documented mirror exactly. This is the only place the one-sentence summary is asserted: on a narrowed envelope `error.summary` is the rendered six-line block (TC-SNARR-001) while `error.remediationHint` is this row's hint.

#### TC-SDET-001 - Two runs over every declared-map case are byte-identical on stdout, stderr, and exit

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, NFR-2, AC-NFR2-1, DM-3, DM-4, DoD-1, DoD-5
**Test Type(s)**: Integration (CLI) + Determinism
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-suite-map-determinism.test.ts`; fixtures in `tests/fixtures/verify-gates/suite-map/cases.ts`
**Tags**: @bun, @behaviour, @determinism, @verify-gates

**Preconditions**:

- The declared-map corpus: equality, two-equal, narrowing, wider, disjoint, mirror-absent, structurally invalid, and invalid workflow; fixed clock and runId.

**Steps**:

1. Run each case twice in JSON mode and twice in human mode.
2. Assert `stdout`, `stderr`, and `exitCode` are byte-identical across the two runs for every case.
3. Assert mirror selection is the first declared match on every repeat; no sort or digest changes it.
4. Assert the narrowed header's identifier list and `omitted` count are identical across runs.
5. Assert no ambient clock, random value, locale, or environment value changes the bytes; only the fixed envelope `runId`/`timing` are deterministic constants.

**Expected Outcome**:

- Every declared-map outcome is deterministic over unchanged facts.

#### TC-SDET-002 - The narrowed header's mirror-breadth list and ` omitted=<n>` count are identical across runs and bounded at maximum breadth

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, NFR-2, AC-NFR2-1, AC-F3-5, DM-3, DM-6, DoD-3, DEC-15, C-12
**Test Type(s)**: Integration (CLI) + Determinism
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-suite-map-determinism.test.ts`; max-breadth fixtures in `tests/fixtures/verify-gates/suite-map/cases.ts`
**Tags**: @bun, @behaviour, @determinism, @narrowed, @bounds

**Preconditions**:

- A narrowed declaration with 31 local identifiers and a 32-suite mirror whose declared order is known; a second fixture with the local declaration order reversed.

**Steps**:

1. Run the max-breadth case twice; assert the header line is byte-identical across runs and byte-equal to the pinned grammar, including the first eight mirror identifiers and the ` omitted=24` count.
2. Assert the eight identifiers are the first eight of the mirror's declared order, not sorted and not taken from the local order when it differs; assert no ninth mirror identifier and no local-only identifier appears on the header line.
3. Assert `detail.suiteBreadth` is the complete 31-identifier local list in local declared order.
4. Reverse the local declaration order; assert the detail order follows the local declaration and the header list follows the mirror's declaration, each deterministically, and that ` omitted=24` is unchanged because it counts mirror identifiers only.
5. Assert the summary stays within six lines and 4096 bytes in every run.

**Expected Outcome**:

- The narrowed naming is deterministic and bounded at the maximum breadth, with the detail order and the mirror's header order each following their own declaration and the `omitted` count depending only on the mirror's breadth size.

#### TC-SHERM-001 - Default suites remain offline, credential-free, and fixture-driven

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, NFR-3, AC-NFR3-1, DM-1, C-9, DoD-5
**Test Type(s)**: Checks (hermeticity) + Contract
**Automation Level**: Automated
**Target Layer / Location**: extend `tests/checks/verify-gates-no-live-calls.test.ts` and `tests/checks/fixture-sanitization.test.ts`; guards in `tests/fixtures/verify-gates/cases/network-guard.ts` and `tests/fixtures/result/no-spawn-guard.ts`
**Tags**: @bun, @checks, @hermetic, @verify-gates

**Preconditions**:

- The new behaviour, golden, structure, and check suites; the network/no-spawn guard; the source scan of the new fixture and harness modules.

**Steps**:

1. Run the new suites under `createNoNetworkGuard` and `createNoSpawnGuard`; assert zero recorded network calls and zero child-process launches.
2. Assert no credential port is resolved, no provider socket is opened, and no environment credential variable is read by the suite or the fixtures.
3. Assert every map and workflow fact comes from a local fixture; no test reads the live API or the live provider.
4. Extend the source scan with the new fixture and harness modules (`tests/fixtures/verify-gates/suite-map/cases.ts`, the extended `cases/harness.ts`, `tests/fixtures/cross-repository/suite-map.ts`, `tests/fixtures/mcp/parity/cases.ts`) and assert no live-call construct.
5. Run fixture sanitization/privacy checks; assert no absolute home path, secret, or machine-specific path appears in the new fixtures or goldens.

**Expected Outcome**:

- Default suites are hermetic and fixture-driven: zero network, zero credentials, zero provider sockets.

#### TC-SWRITE-001 - Write-surface matrix: at most one record and one capsule event on a non-refused evaluation; zero on a narrowed or invalid run; no file writes

**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, NFR-5, AC-NFR5-1, AC-F3-2, AC-F5-2, DM-7, DoD-6, DEC-7, DEC-9
**Test Type(s)**: Integration (CLI, real state module) + Contract (write surfaces)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/verify-gates-suite-map-write-posture.test.ts`; real state module; capsule recorder; fixture tree snapshot
**Tags**: @bun, @behaviour, @state, @capsule, @write-posture

**Preconditions**:

- An empty history and a per-case host root for each outcome; a capsule recorder; a state store mutation log; a before/after snapshot of the fixture tree and the configuration document.
- The outcome corpus: equality pass, equality with one gate failing, narrowing, unmirrored, uncorroborated, invalid map, and invalid workflow.

**Steps**:

1. For each non-refused full evaluation (equality pass, equality with a failing gate, and invalid workflow), assert exactly one `merge.gate-verification` append and at most one capsule `gate.outcome` append per invocation; assert the record shape is the delivered one and the capsule payload field set is unchanged.
2. For the narrowed run, assert zero record appends and zero capsule events.
3. For unmirrored, uncorroborated, and structurally invalid runs, assert zero record appends and zero capsule events.
4. For every outcome, assert no file and no configuration document is written; the tree snapshot is unchanged.
5. Assert the capsule append is non-gating: a failed or thrown capsule append becomes a bounded disclosure and does not change the verdicts, the record, or the exit (where the fixture injects a failing capsule port).
6. Assert the state store's mutation log contains no fence, repair, truncation, or write other than the single record append on a non-refused evaluation.

**Expected Outcome**:

- The write-surface matrix is exact: one record and one capsule event on a non-refused full evaluation, zero on a narrowed or invalid run, and no file or configuration write anywhere.

**Notes / Clarifications**:

- A delivered gate failure (including an invalid workflow) is a **non-refused full evaluation**: the delivered behaviour appends exactly one record and one capsule event, and this change preserves that. Only a narrowed refusal or a configuration refusal appends nothing. This is the precise reading of "only on a non-refused full evaluation" in AC-NFR5-1.

## 6. Environments and Test Data

### 6.1 Gate and fixture environment (measured, binding)

The measured environment in `chg-GH-300-pm-notes.yaml` is binding for every phase boundary and every new fixture:

- **Gate command:** `PATH=$PWD/node_modules/.bin:$PATH TMPDIR=$PWD/tmp/tmpdir GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=commit.gpgsign GIT_CONFIG_VALUE_0=false pnpm check`.
- **`TMPDIR=$PWD/tmp/tmpdir`** — the repo-local temporary directory recorded in the pm-notes for this change. Every temporary fixture root created by the new suites must resolve under this directory (the git-ignored `tmp/` tree) and must not place fixture data under a tracked path.
- **`GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=commit.gpgsign GIT_CONFIG_VALUE_0=false`** — the host sets `commit.gpgsign=true` globally; gate-spawned commits would block on pinentry without this override.
- **`PATH` prefix** — `$PWD/node_modules/.bin` so the commitlint probe resolves during lifecycle commands; this is execution guidance, not a test assertion.
- **Commit hygiene:** `./scripts/lint-commit-range.sh --base main-tools` is the supplementary pre-PR range gate; conventional subjects are scoped `GH-300` and every body/footer line is ≤100 characters.
- **No live environment:** no suite reads a credential environment variable, a provider socket, or a network endpoint. The reference-declaration test reads only local files (the committed configuration and `.github/workflows/ci.yml`).

### 6.2 Configuration fixtures for the map

All configuration fixtures are data files or builders under `tests/fixtures/verify-gates/suite-map/`; none is named `*.test.ts`.

- `tests/fixtures/verify-gates/suite-map/cases.ts` — the typed builders and the defect table. It exports the valid equality map, the equality map with a reordered `local` (the TC-SCITE-006 witness), the two-equal-jobs map, the narrowed map, the wider-than-every-job map, the disjoint map, the mirror-absent map, the maximal narrowing map (31 local against a 32-suite mirror), a 32-entry projection fixture, and one builder per structural/cap/grammar/duplicate defect. Builders return raw configuration values (the `verify.suite-map` node) and never perform I/O.
- `tests/fixtures/verify-gates/suite-map/config/valid-equality.yaml` — a project-committed configuration document whose `verify.suite-map` node is byte-equal to the pinned reference declaration (schema `delivery.verify.suite-map.v1`, job `TS aggregate check`, the eight identifiers in declared order, an equal `local`); used by the end-to-end config-layer test and as the fixture counterpart of the repository document.
- `tests/fixtures/verify-gates/suite-map/config/invalid-shape.yaml` — a minimal document carrying one undeclared key, used to prove the catalog/schema path also classifies the defect as `config.value.invalid`.
- `tests/fixtures/verify-gates/suite-map/config/{unparseable.yaml,no-node.yaml,defective-node-<class>.yaml,defect-outside-node.yaml}` — the document-state matrix for TC-SMAP-006: a malformed body, a valid document with no map node, one document per defective-node class, and a valid map beside unrelated defects in other branches. The unreadable state is injected through the seam, not stored as a mode-bit fixture.
- `tests/fixtures/verify-gates/suite-map/layers/{user-global,project-local,system,env,cli}.yaml` — overlay declarations for TC-SMAP-007; each carries a map the command must not read.
- `tests/fixtures/verify-gates/suite-map/parity-baseline.json` — the pre-change parity baseline described in Section 6.4.
- `tests/fixtures/verify-gates/suite-map/parity-scope.json` — the scope manifest for TC-SPAR-006: every fixture state with exactly one classification (`parity`, `refusal`, or `resolved-equality`), so a state cannot be claimed as both.
- `tests/fixtures/mcp/parity/cases.ts` (extend) — the narrowed, equality, and undeclared cases for the shipped MCP composition (TC-SCITE-005).

The repository's own document is the real file `<repo>/.delivery-os/config.yaml`, authored by this change (DM-8, DEC-17); it is not a fixture. TC-SMAP-004 reads that file, never `valid-equality.yaml`, so a broken committed document cannot be masked by a green fixture.

The map is served by one injected read over exactly one document — the one occupying the project-committed layer slot — independently of the gate-set seam, which keeps supplying the shipped five in production (F-1, DM-9, DEC-11, DEC-19). The shared harness `tests/fixtures/verify-gates/cases/harness.ts` gains a `suiteMap` override and a `configDocument` outcome override (present/absent/unreadable/unparseable); its default remains undeclared, so every existing suite keeps the delivered path.

### 6.3 Workflow fixtures for the job-name set

Existing workflow fixtures under `tests/fixtures/verify-gates/workflows/` are reused unchanged for the invalid cases (`empty-jobs.yml`, `duplicate-names.yml`, `malformed.txt`, `over-bytes.yml`, `over-cap.yml`, `over-long.yml`). New fixtures:

- `tests/fixtures/verify-gates/workflows/suite-map-mirror-present.yml` — a valid job map whose display names include the fixture mirror job (for example `TS aggregate check`).
- `tests/fixtures/verify-gates/workflows/suite-map-mirror-absent.yml` — a valid job map without the mirror's exact string, used for the uncorroborated path.
- `tests/fixtures/verify-gates/workflows/suite-map-case-variants.yml` — a valid job map whose names contain the case/space/punctuation near-matches from TC-SMAP-005, used to prove exact matching.

The workflow facts are also supplied as pure `VerifyGatesWorkflowFacts` objects in most unit/behaviour cases; the YAML fixtures are used by the end-to-end and reference tests. No test parses a workflow body or a step.

### 6.4 Pre-change reference for parity

The reference for AC-F5-1 is the **pre-change baseline**, not a post-change regeneration.

- **Already committed delivered goldens (read unchanged):** `tests/fixtures/verify-gates/golden/success-data.json`, `human-success.txt`, `failure-summary.txt` with `tests/golden/verify-gates.test.ts`; the GH-310 cross-repository goldens `tests/fixtures/cross-repository/goldens/gates-members-green.json`, `gates-review-flow.json`, and the closeout/plan member goldens with `tests/golden/cross-repository-members.test.ts`.
- **New parity baseline:** `tests/fixtures/verify-gates/suite-map/parity-baseline.json` is captured once at the branch base `main-tools` tip `8a1f77ad` **before any suite-map code lands**, by running all 48 delivered corpus cases in JSON and human modes with no map and recording `{ caseId, stdout, stderr, exitCode }` plus the appended record bytes where applicable. It is committed in the owning phase with the capture command recorded in pm-notes. Regeneration after the change is allowed only with a review-visible diff and a recorded reason.
- **New goldens for new outputs (first capture):** `tests/fixtures/verify-gates/golden/suite-map-success-data.json`, `suite-map-success-data-reordered.json` (the TC-SCITE-006 order witness), `suite-map-human-success.txt`, `suite-map-narrowed-envelope.json`, `suite-map-narrowed-member-envelope.json` (the one-line member-mode refusal), the two map-side `cause:` line goldens `suite-map-cause-mirror.txt` and `suite-map-cause-breadth.txt`, and `tests/fixtures/cross-repository/goldens/suite-map-report.json`. They have no pre-change reference; they are generated by the implementation, reviewed as a diff, and then asserted byte-for-byte. The pinned DEC-15 header grammar and the pinned DEC-16 `cause:` grammar are asserted byte-exactly in TC-SNARR-001/003/005/006, TC-SDET-002, and TC-SRES-002/003 as independent structural assertions, so no golden can substitute for a missing literal assertion or silently absorb a grammar drift.
- **Parity scope:** only the two undeclared states (absent document, document without a map node) carry a parity claim; the unreadable, unparseable, and defective-node states are the AC-F1-4 refusals and are deliberately excluded from the baseline (TC-SPAR-006, `parity-scope.json`). No baseline entry exists for an unusable state, so a later regeneration cannot quietly reclassify one as parity.
- **Comparison method:** machine payloads compare `data` deep-equal and serialized bytes in stable key order; human surfaces compare raw `stdout` bytes; failure diagnostics compare raw `stderr` bytes. Envelope `runId` and `timing` are the only permitted normalized keys, and a normalizer must be asserted to replace only those keys. The cross-repository `reviewFlow.runId` is a deterministic digest and is pinned, never normalized. Exits are compared exactly. The absence of `suiteBreadth`/`mirrorsJob` on the undeclared path is asserted explicitly.

### 6.5 Isolation and cleanup

- **Per-case state:** every write-posture case creates its own host root and state store through the delivered `tests/behaviour/verify-support.ts` helpers (`createVerifyState`, `guardStateFixtureRoot`, `createVerifyRecorder`); no state is shared across cases.
- **No ambient `$HOME`:** host fixtures set a per-case home and brand-derived state root; `realStateFingerprint` must be unchanged.
- **No ambient configuration layer:** every CLI case supplies its configuration layers explicitly (the committed document plus an injected overlay set and document-read outcome); no case reads the developer's real user-global file or an untracked project-local file, and TC-SMAP-007 asserts positively that the overlay was never read for the map.
- **No composition from this checkout:** every CLI case receives an explicit fixture cwd/project root; the reference-declaration case is the one deliberate current-tree test and reads only the committed configuration and the real workflow file.
- **No cross-case ordering:** no shared mutable fixture, no ambient clock, no random identifier; the fixed clock is `2026-11-06T12:00:00Z` and runIds are injected constants.
- **Injected fakes over `mock.module`:** no process-global mocking in the new suites; module mocking remains reserved for third-party edges and is restored, per `.ai/rules/typescript.md` §9.
- **Cleanup:** each case disposes its temporary tree; the fixture modules expose `dispose()` where a real temporary repository is created.

### 6.6 Gate evidence and delivery sequencing

- **Aggregate gate:** `PATH=$PWD/node_modules/.bin:$PATH TMPDIR=$PWD/tmp/tmpdir GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=commit.gpgsign GIT_CONFIG_VALUE_0=false pnpm check`, recorded at the phase boundary and before the PR opens (NFR-9, DoD-10).
- **Range gate:** `./scripts/lint-commit-range.sh --base main-tools` after the branch's commits exist; a `FAIL` is remediated in the mode the gate names and re-run, and an unresolved `ERROR` is never recorded as a pass.
- **Error-table sequencing:** the new `ERROR_TABLE` row, the documented row in `doc/spec/features/feature-result-contract.md`, and the live sync-count assertion must land together or by phase 7, before phase 9 runs `pnpm check`; otherwise the delivered sync test fails. This is a delivery-sequencing dependency, not a test-plan gap.
- **PR posture:** the PR targets `main-tools` and stays open (phase 11 record in pm-notes); this is lifecycle evidence, not a test.

## 7. Automation Plan and Implementation Mapping

Proposed homes; the implementation plan pins exact names (the assertion contracts bind regardless of placement). Iteration: `bun test` on the named file; type tests: `pnpm exec tsc -p tests/types/tsconfig.json`; final verification: the gate command in Section 6.6.

| TC ID | Test file | Execution command | Mocking requirements | Status |
|-------|-----------|-------------------|----------------------|--------|
| TC-SMAP-001 | `tests/behaviour/verify-gates-suite-map.test.ts` + `tests/behaviour/config-schema.test.ts`, `tests/structure/config-contract.test.ts`, `tests/behaviour/config-cli.test.ts`, `tests/checks/config-default-positions.test.ts`, `tests/structure/verify-gates-imports.test.ts` (extend), `tests/structure/content-inventory.test.ts` + `tests/structure/inventory.json` (extend) | `bun test tests/behaviour/verify-gates-suite-map.test.ts tests/behaviour/config-schema.test.ts tests/structure/config-contract.test.ts tests/behaviour/config-cli.test.ts tests/checks/config-default-positions.test.ts tests/structure/verify-gates-imports.test.ts tests/structure/content-inventory.test.ts` | Valid map builder; read recorder; guarded FS/env/network globals; catalog branch assertion; inventory/export registration | To Implement + Existing – Update |
| TC-SMAP-002 | `tests/behaviour/verify-gates-suite-map.test.ts` | `bun test tests/behaviour/verify-gates-suite-map.test.ts` | Structural defect table in `tests/fixtures/verify-gates/suite-map/cases.ts`; throwing/recording runtime; YAML shape fixture | To Implement |
| TC-SMAP-003 | `tests/behaviour/verify-gates-suite-map.test.ts` | `bun test tests/behaviour/verify-gates-suite-map.test.ts` | Bounds/grammar/duplicate table; at-bound acceptance pair; constant assertions | To Implement |
| TC-SMAP-004 | `tests/structure/verify-gates-suite-map-reference.test.ts` | `bun test tests/structure/verify-gates-suite-map-reference.test.ts` | Pinned `<repo>/.delivery-os/config.yaml` read through the branding seam; real `.github/workflows/ci.yml`; production composition end-to-end with injected provider facts; no network | To Implement |
| TC-SMAP-005 | `tests/behaviour/verify-gates-suite-map-corpus.test.ts` | `bun test tests/behaviour/verify-gates-suite-map-corpus.test.ts` | Case/space/punctuation variants; workflow fixture `suite-map-case-variants.yml`; exact-match predicate | To Implement |
| TC-SMAP-006 | `tests/behaviour/verify-gates-config-document-posture.test.ts` | `bun test tests/behaviour/verify-gates-config-document-posture.test.ts` | Injected document-read outcomes (absent/unreadable/unparseable/no-node/defective/outside-defect); recording runtime; pre-change baseline for the two parity states | To Implement |
| TC-SMAP-007 | `tests/behaviour/verify-gates-config-layer-posture.test.ts` | `bun test tests/behaviour/verify-gates-config-layer-posture.test.ts` | Layered acquisition harness; user-global, project-local, system, environment, and CLI overlay fixtures; read-isolation recorder | To Implement |
| TC-SCITE-001 | `tests/behaviour/verify-gates-breadth-report.test.ts` + `tests/golden/verify-gates-suite-map.test.ts` | `bun test tests/behaviour/verify-gates-breadth-report.test.ts tests/golden/verify-gates-suite-map.test.ts` | `GH-178` golden facts with a `job-01` equality mirror; fixed clock/runId; delivered `success-data.json`/`human-success.txt`; new report/human goldens | To Implement |
| TC-SCITE-002 | `tests/behaviour/verify-gates-breadth-report.test.ts` + `tests/golden/cross-repository-members.test.ts` (extend) | `bun test tests/behaviour/verify-gates-breadth-report.test.ts tests/golden/cross-repository-members.test.ts` | Two-member green world; injected landings/reviews; GH-310 goldens; new `suite-map-report.json` | To Implement + Existing – Update |
| TC-SCITE-003 | `tests/structure/verify-gates-suite-map-contract.test.ts` + `tests/types/verify-gates-suite-map.type-test.ts` | `bun test tests/structure/verify-gates-suite-map-contract.test.ts` + `pnpm exec tsc -p tests/types/tsconfig.json` | Report fixtures across every outcome; static optional-field probe; constant assertions | To Implement |
| TC-SCITE-004 | `tests/behaviour/mcp-gate-report-parity.test.ts` (extend) + `tests/fixtures/mcp/parity/cases.ts` (extend) + `tests/structure/mcp-contract.test.ts` (extend) | `bun test tests/behaviour/mcp-gate-report-parity.test.ts tests/structure/mcp-contract.test.ts` | Shared parity harness with suite-map override; equality and narrowed cases; tool-schema assertion | Existing – Update |
| TC-SCITE-005 | `tests/structure/mcp-gate-map-composition.test.ts` + `tests/behaviour/mcp-gate-report-parity.test.ts` (extend) + `tests/structure/mcp-contract.test.ts` (extend) + `tests/fixtures/mcp/parity/cases.ts` (extend) | `bun test tests/structure/mcp-gate-map-composition.test.ts tests/behaviour/mcp-gate-report-parity.test.ts tests/structure/mcp-contract.test.ts` | Shipped composition (no test-only override); narrowed/equality/undeclared checkout fixtures; real state module; capsule recorder; credential-unavailable provider facts | To Implement + Existing – Update |
| TC-SCITE-006 | `tests/behaviour/verify-gates-breadth-report.test.ts` (extend) + `tests/golden/verify-gates-suite-map.test.ts` (extend) | `bun test tests/behaviour/verify-gates-breadth-report.test.ts tests/golden/verify-gates-suite-map.test.ts` | Equality map with a reversed `local` and a third permutation; mirror-order assertion; new reordered-report golden | To Implement + Existing – Update |
| TC-SNARR-001 | `tests/behaviour/verify-gates-narrowed-scope.test.ts` + `tests/golden/verify-gates-suite-map.test.ts` | `bun test tests/behaviour/verify-gates-narrowed-scope.test.ts tests/golden/verify-gates-suite-map.test.ts` | Flow 2 declaration (`local: [tests]`, mirror `TS aggregate check`); fixed clock/runId; byte-exact pinned header assertion; narrowed envelope golden; stderr capture | To Implement |
| TC-SNARR-002 | `tests/behaviour/verify-gates-suite-map-write-posture.test.ts` | `bun test tests/behaviour/verify-gates-suite-map-write-posture.test.ts` | Real `appendMergeGateVerification`/`readMergeGateVerifications`; prior record; capsule recorder; state mutation log | To Implement |
| TC-SNARR-003 | `tests/behaviour/verify-gates-narrowed-scope.test.ts` | `bun test tests/behaviour/verify-gates-narrowed-scope.test.ts` | Narrowed map + one failing gate; no-map control; six-line summary assertion | To Implement |
| TC-SNARR-004 | `tests/behaviour/verify-gates-narrowed-scope.test.ts` | `bun test tests/behaviour/verify-gates-narrowed-scope.test.ts` | Narrowed map + classified-unknown and unclassified-unknown bundles; no-map controls | To Implement |
| TC-SNARR-005 | `tests/behaviour/verify-gates-narrowed-scope.test.ts` + `tests/golden/verify-gates-suite-map.test.ts` | `bun test tests/behaviour/verify-gates-narrowed-scope.test.ts tests/golden/verify-gates-suite-map.test.ts` | Nine-identifier and 31-local/32-mirror narrowed fixtures; 120-character job name; byte-exact mirror-breadth header with ` omitted=<n>`; unreachable-0 assertion on the pure header helper; summary byte/line bounds | To Implement |
| TC-SNARR-006 | `tests/behaviour/verify-gates-suite-map-member-posture.test.ts` | `bun test tests/behaviour/verify-gates-suite-map-member-posture.test.ts` | Two-member narrowed world with a would-be `overall: "fail"` outcome; throwing member-read recorder; real state module; capsule recorder; one-line summary golden | To Implement |
| TC-SRES-001 | `tests/behaviour/verify-gates-suite-map-corpus.test.ts` + `tests/golden/verify-gates.test.ts` (unchanged) | `bun test tests/behaviour/verify-gates-suite-map-corpus.test.ts tests/golden/verify-gates.test.ts` | Invalid workflow fixtures (absent/empty/duplicate/malformed/over-bytes/over-cap/over-long); delivered failure-summary golden | To Implement + Existing – No Change |
| TC-SRES-002 | `tests/behaviour/verify-gates-suite-map-corpus.test.ts` | `bun test tests/behaviour/verify-gates-suite-map-corpus.test.ts` | `suite-map-mirror-absent.yml`; table-prose assertion; byte-exact `cause: mirror=…` stderr golden; `detail`-absent and no-cause-line controls | To Implement |
| TC-SRES-003 | `tests/behaviour/verify-gates-suite-map-corpus.test.ts` | `bun test tests/behaviour/verify-gates-suite-map-corpus.test.ts` | Wider-than-every-job and disjoint maps; ≤8 and nine-plus local cases; byte-exact `cause: breadth=…[ omitted=<n>]` stderr golden; bound assertions | To Implement |
| TC-SRES-004 | `tests/behaviour/verify-gates-suite-map-determinism.test.ts` | `bun test tests/behaviour/verify-gates-suite-map-determinism.test.ts` | Two equal jobs in both declared orders; fixed clock/runId; replay | To Implement |
| TC-SRES-005 | `tests/behaviour/verify-gates-suite-map-corpus.test.ts` | `bun test tests/behaviour/verify-gates-suite-map-corpus.test.ts` | Full declaration × workflow matrix; check-run-name variation; closed outcome assertion | To Implement |
| TC-SPAR-001 | `tests/behaviour/verify-gates-parity-suite-map.test.ts` + `tests/golden/verify-gates.test.ts` (unchanged) | `bun test tests/behaviour/verify-gates-parity-suite-map.test.ts tests/golden/verify-gates.test.ts` | Pre-change `parity-baseline.json` from `8a1f77ad`; delivered goldens read unchanged; fixed clock/runId | To Implement + Existing – No Change |
| TC-SPAR-002 | `tests/behaviour/verify-gates-suite-map-write-posture.test.ts` | `bun test tests/behaviour/verify-gates-suite-map-write-posture.test.ts` | Equality map; passing battery; real state module; capsule recorder; record key-set assertion | To Implement |
| TC-SPAR-003 | `tests/behaviour/verify-gates-parity-suite-map.test.ts` + `tests/behaviour/verify-gates-ci.test.ts` (extend patterns) | `bun test tests/behaviour/verify-gates-parity-suite-map.test.ts tests/behaviour/verify-gates-ci.test.ts` | Map job outside the workflow; green/missing/red CI facts; citation deep-equal | To Implement + Existing – Update |
| TC-SPAR-004 | `tests/behaviour/verify-gates-read-budget.test.ts` (extend) | `bun test tests/behaviour/verify-gates-read-budget.test.ts` | Recording runtime; counts with/without map; zero retries/pagination; one workflow read | Existing – Update |
| TC-SPAR-005 | `tests/behaviour/verify-gates-surface.test.ts` (extend) + `tests/behaviour/verify-gates-suite-map.test.ts` | `bun test tests/behaviour/verify-gates-surface.test.ts tests/behaviour/verify-gates-suite-map.test.ts` | Throwing runtime; grammar cases; positionals.max/flag assertion | Existing – Update |
| TC-SPAR-006 | `tests/behaviour/verify-gates-parity-suite-map.test.ts` (extend) + `tests/fixtures/verify-gates/suite-map/parity-scope.json` | `bun test tests/behaviour/verify-gates-parity-suite-map.test.ts` | Scope manifest; document-state fixtures; pre-change baseline; outside-node vs inside-node defect pairs; disjointness assertion | To Implement + Existing – Update |
| TC-SCTR-001 | `tests/structure/verify-gates-suite-map-contract.test.ts` + `tests/structure/envelope-contract.test.ts`, `tests/structure/result-contract.test.ts` (extend) + `tests/fixtures/result/envelope-key-set.json` (extend) | `bun test tests/structure/verify-gates-suite-map-contract.test.ts tests/structure/envelope-contract.test.ts tests/structure/result-contract.test.ts` | Captured envelopes for all new outcomes; `failureDetailMembers` includes `suiteBreadth`; exit set assertion | To Implement + Existing – Update |
| TC-SCTR-002 | `tests/structure/verify-gates-suite-map-contract.test.ts` + `tests/structure/delivery-result-contract.test.ts` (extend) | `bun test tests/structure/verify-gates-suite-map-contract.test.ts tests/structure/delivery-result-contract.test.ts` | Detail projection positive/negative controls; max breadth; undeclared-key rejection | To Implement + Existing – Update |
| TC-SCTR-003 | `tests/structure/error-table.test.ts` (extend) + `tests/checks/error-table-sync.test.ts` (extend) + `tests/structure/delivery-result-contract.test.ts` (extend) + `tests/fixtures/result/code-corpora/true-positives.json` (extend) | `bun test tests/structure/error-table.test.ts tests/checks/error-table-sync.test.ts tests/structure/delivery-result-contract.test.ts` | Exact row fields; live two-way sync; 7 identities/3 rows; 136/136 count; pre-change row snapshots | Existing – Update |
| TC-SDET-001 | `tests/behaviour/verify-gates-suite-map-determinism.test.ts` | `bun test tests/behaviour/verify-gates-suite-map-determinism.test.ts` | Fixed clock/runId; full declared-map corpus; replay in JSON and human modes | To Implement |
| TC-SDET-002 | `tests/behaviour/verify-gates-suite-map-determinism.test.ts` | `bun test tests/behaviour/verify-gates-suite-map-determinism.test.ts` | Max-breadth narrowed case; reversed local order; byte-exact mirror-breadth header and ` omitted=<n>` stability | To Implement |
| TC-SHERM-001 | `tests/checks/verify-gates-no-live-calls.test.ts` (extend) + `tests/checks/fixture-sanitization.test.ts` (extend) | `bun test tests/checks/verify-gates-no-live-calls.test.ts tests/checks/fixture-sanitization.test.ts` | Network/no-spawn guards; source scan of new fixture/harness modules; privacy/sanitization | Existing – Update |
| TC-SWRITE-001 | `tests/behaviour/verify-gates-suite-map-write-posture.test.ts` | `bun test tests/behaviour/verify-gates-suite-map-write-posture.test.ts` | Real state module; capsule recorder; tree/config snapshots; pass/fail/narrow/config-invalid matrix | To Implement |

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Testing risk | Mitigation |
|----|--------------|------------|
| TR-1 | The parity baseline is regenerated from post-change code, turning the undeclared-map proof into a tautology | TC-SPAR-001 reads `parity-baseline.json` captured at `8a1f77ad` before code lands and the delivered goldens unchanged; regeneration requires a review-visible diff and a recorded reason (Section 6.4) |
| TR-2 | The no-append rule is asserted only through a stubbed append port, so a state-contract break ships green | TC-SNARR-002, TC-SNARR-006, TC-SPAR-002, and TC-SWRITE-001 use the **real** `appendMergeGateVerification`/`readMergeGateVerifications`: one record, prior record newest, read not `torn`, zero capsule event on refusal (member-less and member-declaring paths) |
| TR-3 | Config-shaped refusals are tested only in JSON mode, so the pinned `cause:` line is unproven | TC-SRES-002/003 assert the exact two-line stderr (`<binary>: config.value.invalid` plus the one `cause:` line) in JSON mode and the same in human mode, assert both derived character bounds, and assert no `cause:` line appears for a structural map defect or for any other failure (DEC-16) |
| TR-4 | Fuzzy corroboration (case folding, trimming, punctuation normalization) or check-run-derived attribution sneaks in | TC-SMAP-005 enumerates the near-match variants; TC-SRES-005 varies check-run names and asserts the report bytes do not change |
| TR-5 | The summary-bounds test passes vacuously because the local set is small | TC-SNARR-005 and TC-SDET-002 use nine- and 31-local/32-mirror cases with a 120-character job name; assert detail completeness, the mirror's first eight plus the ` omitted=<n>` count, six lines, and 4096 bytes |
| TR-6 | The map adds a read that the budget test misses because it instruments only provider reads | TC-SPAR-004 instruments the lifecycle, repository, workflow, and provider seams plus the configuration seams; asserts identical per-source counts with and without the map (the map's one bounded document read is the only difference), one workflow read, zero retries, zero pagination, and zero reads of any other configuration layer |
| TR-7 | The production composition never supplies the map, leaving the policy inert on the CLI or on the shipped MCP mirror | TC-SMAP-004 reads the committed reference declaration and the real workflow; structure assertions cover both composition seams; TC-SMAP-001/TC-SMAP-006/TC-SMAP-007 exercise the handler end-to-end; TC-SCITE-005 asserts the shipped MCP composition (the surface where an inert mirror is otherwise indistinguishable from an undeclared map, RSK-4) and proves its structure assertion non-vacuous |
| TR-8 | `detail.suiteBreadth` is silently clipped to fit a byte bound | TC-SCTR-002 asserts the complete list at the 32-entry projection bound and rejects over-bound/malformed values; TC-SNARR-005 asserts the handler detail is never truncated |
| TR-9 | The existing error-table live count (135) becomes stale or a delivered row is reworded | TC-SCTR-003 updates the live count to 136/136, deep-equals the pre-change rows, and runs the two-way sync gate |
| TR-10 | `suiteBreadth` is copied from `local` rather than the mirror's declared list, or a union is invented | TC-SCITE-006 is the decisive witness: its equality fixture's `local` is set-equal to the mirror's `suites` but ordered differently (reversed, plus a third permutation), so a `local`-copy renders a different list at every position and fails; TC-SCITE-001 compares to the job's declared order on the same-order fixture; TC-SCITE-003 asserts uniqueness and no union; no report exists on a narrowing |
| TR-11 | The additive fields leak into the member-less report, a gate record, or a citation | TC-SPAR-001 asserts no key anywhere on the undeclared path; TC-SCITE-003 asserts the static/runtime placement; TC-SCITE-002 asserts member records are unchanged |
| TR-12 | The new `verify` configuration branch breaks the existing catalog key-order and default-artifact tests | TC-SMAP-001 updates `config-schema.test.ts`, `config-contract.test.ts`, `config-cli.test.ts`, and `config-default-positions.test.ts` in the owning phase |
| TR-13 | The new `detail` member becomes an open key-value map or is accepted on unrelated failures | TC-SCTR-002's negative controls and TC-SCTR-001's closed key-set assertion, with the updated `envelope-key-set.json` |
| TR-14 | A multi-job covering set cites the wrong mirror or flips between runs | TC-SRES-004 pins first-declared order in both declared orders; TC-SDET-001 repeats every case |
| TR-15 | The reference declaration drifts from the real workflow or from the pinned literal while the test asserts something weaker | TC-SMAP-004 asserts the committed document at `<repo>/.delivery-os/config.yaml` against every pinned literal (schema, job, the eight identifiers, order, equal `local`) and then asserts equality end-to-end against the real workflow, so a document edit or a workflow rename fails |
| TR-16 | A present but unusable declaration silently becomes "undeclared" (fail-open), deleting the only enforcement — the exact posture the DoR iteration-1 finding rejected | TC-SMAP-006 asserts every unusable state is a `config.value.invalid` refusal before any read and that it never proceeds to a report; TC-SPAR-006 asserts no unusable state carries a parity claim; the read recorder proves no source read preceded the refusal |
| TR-17 | An unreviewed user-global or project-local overlay supplies, completes, or replaces the map, so the same repository resolves a different map locally than in CI | TC-SMAP-007 declares the map only in each overlay with the committed document absent (no effect, parity path) and with the committed document valid (committed declaration honoured), and asserts zero reads of those layers and one read of the committed document |
| TR-18 | Parity is overclaimed: a state that now refuses is compared against the delivered baseline and shipped as "unchanged", hiding the deliberate behaviour change | TC-SPAR-006's scope manifest classifies every state exactly once (`parity` / `refusal` / `resolved-equality`), asserts disjointness, and records the documented divergence for the unusable states; the baseline carries no entry for them |
| TR-19 | The narrowed refusal is decided too late on the member-declaring path, so a fresh full-green record or capsule event is still appended, or a member read runs before the refusal | TC-SNARR-006 uses a throwing member-read recorder and the real state module: the refusal precedes every member read and both appends, and the would-be data-bearing `overall: "fail"` report is unreachable |

### 8.2 Assumptions

- The map is served by one injected read over exactly one document — the one occupying the project-committed layer slot (or the explicitly selected file that occupies it) — independently of the gate-set seam; the delivered production composition still supplies no declared gate set, so `verify gates` keeps evaluating the shipped five (F-1, DM-9, DEC-11, DEC-19, NG-7). Absent means undeclared and no default map is invented.
- The document read reports a total classification: absent and parsed-without-node are undeclared; unreadable, unparseable, and a defective map node are `config.value.invalid` before any gates source read; a defect outside the map node is not interpreted (DM-9, DEC-18).
- A `verify.suite-map` node in a system, user-global, project-local, environment, or CLI source is never read for the map, and an overlay declaration is not a refusal (DEC-19).
- The shipped MCP `gate-report` composition supplies the same single-document map read as the CLI, so the two surfaces resolve one declaration to one outcome; the suiteBreadth evidence member is not projected into the tool result (DEC-20).
- The handler can resolve the map before any source read and can evaluate the narrowed refusal before the battery verdict projection as well as before the cross-repository evaluation's member reads and append, so both report paths refuse alike (F-3, DEC-6, AC-F3-6).
- The command writes exactly one bounded identifier-only `cause:` line on the error stream for the two map-side refusals (`cause: mirror=<job>` or `cause: breadth=<id[,id]*>[ omitted=<n>]`), leaving the envelope's table-own summary and hint and the absent `detail` untouched (DEC-16).
- On a narrowed refusal the command supplies `error.summary` as the rendered failure summary block — the delivered header plus one line per gate on the member-less path, and exactly one header line on the member-declaring path (no gate is evaluated there) — which the `user-validation` projection honours, while `error.remediationHint` is the `verify.narrowed-scope` row's hint; the row's own one-sentence summary stays the row default and reaches no narrowed envelope (F-3, AC-F3-6, DM-5, DEC-6).
- The existing `tests/fixtures/verify-gates/corpus/cases.json` (48 cases) and the committed goldens are the pre-change reference for parity; the new baseline is captured at `8a1f77ad` before any suite-map code.
- The reference declaration is authored content at `<repo>/.delivery-os/config.yaml` with the pinned schema, job `TS aggregate check`, the eight identifiers, and the equal `local` order (DM-8, DEC-17); the test asserts those literals and the end-to-end equality against the real workflow.
- The narrowed header is produced by one pure rendering helper over the mirror's declared `suites` and the delivered constants, so the pinned grammar, the 1..8/9..32 renderings, and the unreachable 0 case are unit-assertable without a CLI run.
- `mirrorsJob` is the expected-check-run name (workflow display `name`, else the job id), not necessarily the workflow job key; the SC-M2-S7-01 "job id" wording is read through this pin (DM-2).
- The suite-map resolver and breadth resolver are pure domain code with no I/O; the handler and the configuration adapter are the only integration points.
- The error-table row and its documented mirror land no later than phase 7, before phase 9 `pnpm check`; the delivered sync gate is the authority.
- No new source read and no new transport call is introduced; the map adds exactly one bounded read of the project-committed configuration document, and the configuration seam itself is not an external source read (NFR-4, DEC-10, DEC-19).
- Parity is claimed only for the two undeclared states (absent document, document without a map node); an unreadable, unparseable, or defective-node document is the AC-F1-4 refusal and deliberately changes the delivered outcome (NFR-8, NFR-10, DEC-18).
- The one-append counting on a non-refused full evaluation is preserved for both pass and gate-failure outcomes, on both report paths; only a narrowed (member-less or member-declaring) or configuration refusal appends nothing (AC-NFR5-1, AC-F3-6, DEC-7).
- Default suites remain hermetic: local fixture and workflow file reads only; no credential, provider socket, or network access.

### 8.3 Open Questions / Residual Gaps

Two residual observations remain — one plan-owned seam decision and one explicitly bounded non-shipped-composition question. Every literal the earlier revisions left open is pinned by spec v1.2 and asserted byte-for-byte:

| ID | Residual gap | Blocking? | Owner | Test-plan handling |
|----|--------------|-----------|-------|---------------------|
| OQ-T4 | The suite-map injection shape (`readSuiteMap` as its own seam separate from `readGateSet`, or one combined resolved-config call) is not pinned | No — NFR-4 pins zero additional *source* reads, not the seam call count | plan-writer | TC-SMAP-001, TC-SMAP-006, TC-SMAP-007, and TC-SPAR-004 assert no I/O, the one-document read, and unchanged external source counts; the plan pins the seam shape |
| OQ-T6 | Whether a *non-shipped* MCP composition that supplies live provider reads would ever expose `suiteBreadth`/`mirrorsJob` in its tool result is not pinned | No — AC-F5-6 asserts the shipped posture and the tool-result shape unchanged; the shipped surface injects every provider read as `credential-unavailable`, so no report can be produced there | plan-writer / reviewer | TC-SCITE-005 asserts the shipped composition's outcomes (narrowed refusal; delivered `verify.gates.unavailable` for undeclared and equality) and the unchanged tool-result shape; any future live-composition change owns its own AC |

**Closed in this revision (spec v1.2; no TC renumbered, no AC renumbered):**

- **OQ-T1 — closed (header grammar).** The narrowed header is pinned byte-for-byte (DEC-15, Appendix A rows 9 and 19): the delivered header `result=<fail or unknown>; gates=<p>/<t> passed, <f> failed, <u> unknown` kept byte-identical, then `; scope=narrowed mirror=<job> breadth=<id[,id]*>[ omitted=<n>]`; one `; ` between segments, one ASCII space between tokens; `<job>` verbatim and terminated by the final ` breadth=`; 0 identifiers unreachable; 1..8 printed with no marker; 9..32 = first eight + ` omitted=<n>` counting only unprinted identifiers; `result=` = `fail` when the battery overall is `fail`, otherwise `unknown` (so an all-pass narrow battery renders `result=unknown`, and the member-mode zero-gate case renders `result=unknown; gates=0/0 passed, 0 failed, 0 unknown`); the success header never appears on a refusal. Asserted in TC-SNARR-001/003/005/006, TC-SDET-002, and the golden capture.
- **OQ-T2 — closed (map-side diagnostic).** Each map-side refusal writes exactly one bounded identifier-only line after `<binary>: config.value.invalid` — `cause: mirror=<job>` (≤134 characters) or `cause: breadth=<id[,id]*>[ omitted=<n>]` (≤545 characters) — while `error.summary`, `error.remediationHint`, and the absent `detail` keep the table's own values, and no other failure writes a `cause:` line (DEC-16, Appendix A row 20). Asserted in TC-SRES-002/003/005 and negatively in TC-SMAP-006/TC-SNARR-006.
- **OQ-T3 — closed (reference declaration).** The pinned document is `<repo>/.delivery-os/config.yaml`, declaring schema `delivery.verify.suite-map.v1`, job `TS aggregate check`, `suites` and `local` both exactly `tests, lint, format, typecheck, boundaries, prompt-conformance, help-guide-coverage, exports-parity` in that order, resolving to equality end-to-end (DM-8, DEC-17, Appendix A row 21). Asserted in TC-SMAP-004.
- **OQ-T5 — closed (breadth ownership).** The header's `breadth=` names the mirror (CI) breadth in the mirror's declared order and never the local set, which is carried by `detail.suiteBreadth` alone (F-3, AC-F3-1, AC-F3-5, DM-3, DEC-15, C-12). Asserted in TC-SNARR-001/005/006 and TC-SDET-002.
- **OQ-T7 — closed (document posture).** The configuration document is classified totally and fail-closed: absent and parsed-without-node are the delivered parity path; unreadable, unparseable, and a defective map node are `config.value.invalid` at exit `1` with no `data` before any read; a defect outside the map node is not interpreted (DM-9, DEC-18, NFR-10, AC-F1-4, Appendix A row 22). Asserted in TC-SMAP-006 and TC-SPAR-006. This closes DoR iteration-1 findings F1/F2's posture question on the test side.
- **OQ-T8 — closed (layer posture).** The map is honoured only from the project-committed layer slot; an overlay declaration has no effect and is not a refusal (DEC-19, AC-F1-5, Appendix A row 23). Asserted in TC-SMAP-007.
- **OQ-T9 — closed (member-path parity).** A narrowed declaration on a member-declaring change refuses with the same identity, exit, and `detail`, before any member read and before either append, with the one-line member-mode summary (AC-F3-6, DEC-6, C-17). Asserted in TC-SNARR-006. This closes DoR iteration-1 finding F3 on the test side.
- **OQ-T10 — closed (shipped MCP posture).** The shipped `gate-report` composition supplies the same single-document map read; a narrowed declaration fails the call with the same identity and summary and appends nothing; an undeclared or equality map leaves the delivered tool outcome unchanged; the tool contract is unchanged (DEC-20, AC-F5-6, Appendix A row 24). Asserted in TC-SCITE-005. This closes DoR iteration-1 finding F11 on the test side.
- **OQ-T11 — closed (parity scoping).** Parity covers only an absent document or one without a map node; unusable document states are the AC-F1-4 refusal with no parity claim, and the tolerance for a defect outside the map node is bounded to exactly that node (AC-NFR8-1, NFR-8, NFR-10, DEC-18). Asserted in TC-SPAR-006 and TC-SMAP-006.
- **OQ-T12 — closed (breadth-order witness, DoR iteration-1 F6).** An equality fixture whose `local` is set-equal to the mirror's `suites` but ordered differently proves `data.suiteBreadth` follows the mirror's declared order and would fail if copied from `local` (DEC-3, DEC-4, C-4, AC-F2-1/AC-F2-3). Asserted in TC-SCITE-006.

**Cross-artifact handoff (non-blocking, not a test-plan gap).** The implementation plan predates spec v1.2 and therefore does not yet own AC-F1-4, AC-F1-5, AC-F3-6, AC-F5-6, AC-NFR8-1, or these six TCs. Delivery planning must adopt them — and the v1.2 gate obligations (the one-document read classification, the overlay isolation, the member-path refusal order, the shipped MCP composition, and the parity scoping) — in its own revision before the DoR gate. This file does not change the plan, so the handoff is recorded here rather than left silent.

**Reconciliation rule (binding).** If the implementation plan, a later decision, or a review pin differs from any value this plan asserts — the map field names, caps, identifier grammar, outcome vocabulary, report-field placement, refusal identity, `detail` member, narrowed-header grammar, member-mode summary shape, map-side `cause:` grammar, reference-declaration literals, configuration-document classification and its tolerance, declaration-home layer posture, shipped MCP composition posture, parity scope, append rule, read counts, fixture base, or golden provenance — this test plan is revised **in the same change before the DoR gate** and never drifts silently. Every revision is recorded in Section 9 with the reason. A test that would need to change its expectation because the pin changed is a plan revision, not a test tweak.

### 8.4 Manual and Verification-Only Items (not counted as TCs)

| Item | AC / condition | Why it is not automated | Evidence |
|------|----------------|-------------------------|----------|
| Aggregate gate battery | NFR-9, DoD-10 | It is command execution at the delivered HEAD, not test code | Section 6.6 command + result recorded in `chg-GH-300-pm-notes.yaml` |
| Commit range and hygiene | NFR-9, DoD-10 | Branch-range review by nature (`.ai/rules/testing-strategy.md` forbids permanent branch-diff suites) | `./scripts/lint-commit-range.sh --base main-tools` verdict + commit inspection in pm-notes |
| PR posture (targets `main-tools`, stays open) | DoD-10, DEC-13 | Lifecycle record, not a test | Phase-11 PR record in pm-notes |
| Current-truth documentation reconciliation | DoD-9, C-10 | Phase-7 documentation work, except the error-table documented row which the sync gate binds | Doc diff review recorded in pm-notes; TC-SCTR-003 covers the row |

These items are excluded from the 37 automated TCs and from the 30-AC automated count; NFR-9 remains covered by gate evidence, and AC-NFR7-1 remains covered by TC-SCTR-003.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-15 | test-plan-writer (deepseek-flash) | Initial test plan from `chg-GH-300-spec.md` (25 ACs, DoD-1..DoD-10, DEC-1..DEC-14, DM-1..DM-7, Appendix A/C), `chg-GH-300-pm-notes.yaml` (gate environment and delivery conventions), the M2 scenario seeds SC-M2-S7-01/SC-M2-S7-02 (inherited by name), the delivered verify-gates §Quality evidence suite conventions, and the delivered configuration/result/merge/MCP contracts. 31 TCs in nine families; 25/25 ACs covered; 0 TODO; 0 orphan TCs; five non-blocking residual gaps recorded (OQ-T1..OQ-T5). |
| 1.1 | 2026-11-15 | test-plan-writer (deepseek-flash) | Re-synced in place to `chg-GH-300-spec.md` v1.1 (§25). No TC, AC, or family renumbered; 31 TCs and 25/25 AC coverage unchanged. **(1)** Pinned the narrowed header byte-for-byte in TC-SNARR-001/003/005 and TC-SDET-002 (delivered header + `; scope=narrowed mirror=<job> breadth=<mirror ids>[ omitted=<n>]`, delimiters, token order, verbatim `<job>`, unreachable 0, 1..8 with no marker, 9..32 = first eight + ` omitted=<n>`, `result=fail` or `unknown`), and made the golden capture assert it independently; OQ-T1 closed. **(2)** Fixed breadth ownership: the header names the mirror (CI) breadth and never the local set, which stays in `detail.suiteBreadth`; AC-F3-1/AC-F3-5 rows, the SC-M2-S7-02 note, TC-SNARR-001/005, and TC-SDET-002 amended; OQ-T5 closed. **(3)** Pinned the map-side diagnostic to exactly one bounded `cause: mirror=<job>` (≤134) or `cause: breadth=<id[,id]*>[ omitted=<n>]` (≤545) error-stream line with table-own envelope prose and absent `detail`; TC-SRES-002/003/005, AC-F4-2/AC-F4-3, DM-3, and two new stderr goldens amended; OQ-T2 closed. **(4)** Pinned the reference declaration (`<repo>/.delivery-os/config.yaml`, schema `delivery.verify.suite-map.v1`, job `TS aggregate check`, the eight identifiers in order, equal `local`) and made TC-SMAP-004 assert the concrete document plus equality end-to-end through the production composition; added a DM-8 coverage row (8/8 DM rows); OQ-T3 closed. **(5)** §1.2, §2, §8.1 (TR-3, TR-5, TR-15), and §8.2 now cite spec v1.1 (`DM-1..DM-8`, `DEC-1..DEC-17`, Appendix A rows 1–21, C-1..C-14); §8.3 retains only OQ-T4 (seam shape, a plan concern) and records OQ-T1/T2/T3/T5 as closed. |
| 1.2 | 2026-11-15 | test-plan-writer (deepseek-flash) | Contradiction fix raised by the plan author; no TC, AC, or family renumbered — 31 TCs and 25/25 AC coverage unchanged. **(1)** Resolved the false claim that the narrowed `error.summary` equals the DM-5 row's one-sentence text, which contradicted the step that asserts its first line is the pinned six-line-block header. Restated to the spec reading (`chg-GH-300-spec.md` Flow 2, F-3, AC-F3-1, DM-5): `error.summary` is the rendered failure summary block — delivered header plus exactly one line per gate, with `scope=narrowed mirror=<job> breadth=<mirror ids>[ omitted=<n>]` — supplied by the command and honoured by the `user-validation` projection; the DM-5 row's own summary sentence remains the row default and is asserted only in TC-SCTR-003; `error.remediationHint` is the row's hint and is asserted separately from `error.summary`. **(2)** Amended TC-SNARR-001 steps 2/3/6/8, its Expected Outcome, and its Notes; made TC-SNARR-003/004/005 and TC-SCTR-002 name `error.summary` explicitly (added TC-SCTR-002 step 7 for the class-consistent summary projection and its Notes), and added a TC-SCTR-003 note that the one-sentence summary is asserted on the table only. **(3)** Corrected the repeating statements in §3.1 (AC-F3-1, AC-F3-3) and §3.2 (DM-5) and added the §8.2 assumption that separates the narrowed block from the row default; the map-side `config.value.invalid` table-own summary/hint posture (DEC-16) is unchanged. |
| 1.3 | 2026-11-15 | test-plan-writer (deepseek-flash) | DoR iteration-1 remediation: re-synced to `chg-GH-300-spec.md` v1.2 (§25) and `readiness-review/readiness-iter-1.md`. No existing TC or AC renumbered; six new TCs added (TC-SMAP-006, TC-SMAP-007, TC-SCITE-005, TC-SCITE-006, TC-SNARR-006, TC-SPAR-006), so 37 TCs cover 30/30 ACs (up from 31 TCs / 25 ACs). **(F6) Breadth-order witness** — TC-SCITE-006 adds an equality fixture whose `local` is set-equal to the mirror job's `suites` but ordered differently (reversed plus a third permutation), asserts `data.suiteBreadth` reproduces the mirror's declared order, and states that the witness fails if breadth were copied from `local`; TC-SCITE-001, TC-SCITE-003 step 3, AC-F2-1/AC-F2-3 rows, TR-10, and §6.4 now point at it. **(AC-F1-4 / AC-NFR8-1)** TC-SMAP-006 classifies every configuration-document state (absent, unreadable, unparseable, no-node, defective node, defect elsewhere) with its identity, read order, and no-write consequence, and TC-SPAR-006 scopes parity so an unusable document is never claimed as unchanged while the outside-node tolerance stays bounded. **(AC-F1-5)** TC-SMAP-007 proves the project-committed slot is the sole source and that a system, user-global, project-local, environment, or CLI overlay has no effect and is not a refusal. **(AC-F3-6)** TC-SNARR-006 proves a narrowed declaration on a member-declaring change refuses before any member read, with the same identity/exit/`detail`, a one-line member-mode summary, no record, no capsule event, and precedence over the data-bearing `overall: "fail"` report. **(AC-F5-6)** TC-SCITE-005 proves the shipped MCP `gate-report` composition supplies the map read, refuses a narrowing identically, and leaves the delivered tool outcome and contract unchanged. **(References)** §1, §1.1–§1.2, §2, §3.1–§3.5, §4, §6.2, §6.4–§6.5, §7, §8.1–§8.3 now cite spec v1.2 (`DM-1..DM-9`, `DEC-1..DEC-20`, `NFR-1..NFR-10`, `RSK-1..RSK-11`, DoD-1..DoD-12, Appendix A rows 1–24, C-1..C-17, D-1..D-16); DM coverage moves to 9/9; TR-16..TR-19 added; OQ-T7..OQ-T12 record the newly pinned postures as closed and OQ-T6 records the non-shipped MCP composition as a non-blocking, explicitly bounded residual. The §1.2 statement that the map is resolved from the values that supply the declared gate set is corrected: the map is served by one injected read over one document, independently of the untouched shipped-five gate set. |

## 10. Test Execution Log

Populated during delivery (one row per execution batch; full evidence in `chg-GH-300-pm-notes.yaml`).

| TC ID(s) | Run Date | Command | Result | Notes |
|----------|----------|---------|--------|-------|
| — | — | — | Not run yet | Phase 6 (delivery) populates this log |
