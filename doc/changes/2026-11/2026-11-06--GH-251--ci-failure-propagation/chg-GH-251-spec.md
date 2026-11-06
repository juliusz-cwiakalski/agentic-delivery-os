---
change:
  ref: GH-251
  type: fix
  status: Proposed
  slug: ci-failure-propagation
  title: "hardening: shell-suite CI failure propagation (OPEN-Q19) + input-limit UTF-8 boundary naming (OPEN-Q15)"
  owners: [engineering]
  service: delivery infrastructure (CI shell-suite gate + file-adapter input limits)
  labels: [change, review, hardening]
  version_impact: patch
  audience: internal
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - CI workflow shell-suite job (bash-tests) and the surrounding gate battery (binding ts-* jobs, guard jobs)
      - Repository-invariant checks for CI topology and bindingness, and commitlint
      - File-source adapters: YAML configuration parser and pm-notes document parser
      - Pure-TS UTF-8 byte-length pattern in the core domain (queue-ready) as the reference pattern
      - Committed negative-mode self-test precedent (doc-distribution-modes, delivery-mutation-sandbox, deliver-ticket-result-tuples-modes)
      - System spec truth: NFR-TOOL-005 (bounded input); monorepo scaffold toolchain feature page
      - Inception analysis: phase-4 quality baseline CI finding and FSE-05 row; open-question reconciliation (Q15/Q19)
    external:
      - GitHub Actions (workflow execution)
  links:
    related_changes: ["GH-124"]
    related_decisions: ["ADR-0003"]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make the CI shell-suite backstop sound — any failing bash suite fails the job, proven inside a green CI run by a committed synthetic negative control — and make the parsers' byte-named input limit byte-accurate under multibyte UTF-8, enforced fail-closed with boundary tests, with no behavior change beyond those two owner-authorized repairs.

## 1. SUMMARY

This change delivers two engineering repairs routed from the inception open-question reconciliation (OPEN-Q19, OPEN-Q15 engineering part), authorized by the owner 2026-11-06 as scheduling-only work — no policy vote.

Repair 1 (OPEN-Q19): the CI workflow's shell-suite job (`bash-tests`) invokes each suite through a `find -exec` invocation whose `-exec` predicate does not aggregate child exit codes, so a failing shell suite can leave the job green despite the outer `set -e` and the job comment claiming otherwise. The aggregation is replaced with explicit child-status handling — realized as a small suite-aggregation runner invoked by the workflow, per the ticket's named option set — plus a committed, self-verifying negative control that plants a deliberately failing synthetic suite and proves the runner exits non-zero. That control runs in the PR's green CI run, which becomes the demonstration evidence that a synthetic failing suite fails the job.

Because the CI-topology invariant check enforces an additions-only rule on the CI workflow file — it diffs the workflow against the base branch and fails on every removed line — any compliant repair of the `bash-tests` run block would otherwise be rejected by the very gate that guards the workflow. Repair 1 therefore includes a narrowly scoped, negative-fixture-guarded allowance in that invariant (DEC-7, F-8): the job stays, its execution block and comment are replaced, and the invariant's protection everywhere else is untouched.

Repair 2 (OPEN-Q15, engineering part): the YAML configuration parser and the pm-notes document parser compare `text.length` (UTF-16 code units) against the byte-named source-size limit constant (`MAX_SOURCE_BYTES`, 1048576), so the limit is not byte-enforced under multibyte UTF-8. Per spec truth (NFR-TOOL-005 names byte enforcement as the reconciliation direction) and the fail-closed repo culture, the limit becomes byte-accurate: UTF-8 byte length is enforced, the byte-named contract and the limit value are preserved, error identities are unchanged, and multibyte boundary tests (exactly-at-limit, one-over, one-under, char-count-equal-but-bytes-over, all-ASCII) pin the exact boundary.

Finally, the phase-4 quality baseline note (and its FSE-05 audit row) is updated to reflect the repair landing, and the incorrect job comment is corrected — documentation truth, not narration.

## 2. CONTEXT

### 2.1 Current State Snapshot

- CI runs on pushes to `main`, `main-tools`, `feat/**`, `fix/**` and on PRs targeting `main`/`main-tools`, as separate jobs: TypeScript binding gates (`ts-*`), exports, pins, invariants, license/vulnerabilities, branding/privacy, commitlint, shell tests, and shared generated-doc/plugin guards. The shell-suite job (`bash-tests`) discovers every suite matching the repository's `.tests/test-*.sh` convention and executes each with `bash` under `set -e`.
- Concrete verified gap (phase-4 quality baseline, "CI baseline and concrete failure-propagation finding"): `find ... -exec bash {} \;` makes a nonzero child turn the `-exec` predicate false, but does not make the successful traversal fail; the outer `set -e` therefore does not reliably fail the job on a failed suite, despite the job comment (originating from GH-124) claiming exactly that. A read-only control (`find package.json -exec false {} \;`) returned 0, verifying the command semantics.
- Consequence assessment from the same baseline: lanes run the full local battery, so all merged PRs were genuinely green; the defect weakens the CI backstop behind the merge gate, not the gate itself. The backstop must still be sound.
- The repository has a committed negative-control precedent: self-verifying negative-mode tests (doc-distribution-modes, delivery-mutation-sandbox, deliver-ticket-result-tuples-modes) that prove a failure path inside a green run.
- Parser state: the YAML configuration parser (one source-size check) and the pm-notes document parser (two source-size checks) cap sources at 1048576 via a byte-named constant, but compare the UTF-16 code-unit count (`text.length`). NFR-TOOL-005 records this as an open gap: "its 1048576 byte-named source constant compares text.length. UTF-8 byte enforcement needs reconciliation; do not claim it from the name alone."
- A pure-TypeScript code-point→UTF-8 byte-length computation already exists in the core domain (queue-ready), with no `TextEncoder`, no `Buffer` — the established purity-compliant pattern for byte accounting.
- ADR-0003 constraint C-8 requires that running gates never weaken during migration; a technically unsound failure-propagation path in a gate job is a repair obligation, not a policy question.
- Documentation truth currently contradicts the post-repair reality in known places: the phase-4 baseline documents the gap as open (correct today, stale after the repair); the scaffold toolchain feature page states "The existing bash jobs remain byte-unchanged and authoritative"; the job comment misstates `set -e` semantics.

### 2.2 Pain Points / Gaps

- False-green risk in the backstop: a failing shell suite may not fail the `bash-tests` job, so the merge gate's CI backstop is unsound exactly where it is supposed to catch what local lanes miss.
- Unverifiable claim: the job comment asserts a property (`set -e` fails on first failing suite) that the invocation cannot deliver — documentation that lies about a control.
- Name-vs-behavior gap in a security control: a byte-named input limit (NFR-TOOL-005, bounded input) is char-count-enforced, so multibyte-heavy sources up to ~4x the byte budget in code units pass a guard whose name promises byte enforcement; spec truth explicitly forbids claiming the control from the name alone.
- No negative proof: nothing today demonstrates that a failing suite would fail the job; the repository's negative-control discipline (prove the failure path inside a green run) is not applied to this gate.
- Stale analysis: once repaired, the phase-4 baseline's "concrete new gap" and FSE-05 row would contradict reality unless updated in the same change.

## 3. PROBLEM STATEMENT

Because the CI shell-suite job aggregates child suite outcomes through a `find -exec` invocation that cannot propagate a nonzero child exit, and because the parsers' byte-named source-size limit is enforced as a UTF-16 code-unit count rather than UTF-8 bytes, a failing shell suite can leave the CI backstop green and multibyte-heavy sources can slip past a bounded-input control whose name promises byte enforcement — leaving the repository with a gate that can lie green and a security control that does not mean what it says.

## 4. GOALS

- **G-1**: Sound failure propagation — the shell-suite CI job fails whenever any discovered child suite fails (or cannot be executed), and succeeds only when all discovered suites pass.
- **G-2**: Demonstrated propagation — a committed, self-verifying synthetic negative control proves end to end that a deliberately failing bash suite fails the job, exercised in the PR's green CI run.
- **G-3**: Byte-accurate input limit — the byte-named source-size limit is enforced as true UTF-8 byte length, fail-closed, at every parser check site, preserving the limit value, the byte-named contract, and all existing error identities.
- **G-4**: Boundary-proof coverage — multibyte and exactly-at-limit boundary tests pin the exact acceptance boundary for both parsers and every check site.
- **G-5**: Documentation truth — the phase-4 baseline note and its FSE-05 row reflect the repair landing; the incorrect job comment is corrected; known reconciliation points are registered for the system-spec update phase.
- **G-6**: Minimal blast radius — no behavior change beyond the two repairs (ticket acceptance criterion 4); binding jobs, guard jobs, and all other controls untouched.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Negative-control scenarios proving job-fails-on-suite-failure pass in every CI run | 100%; 0 false greens |
| Existing suites passing under the new aggregation | 100%; 0 suites newly failing for aggregation reasons |
| Byte-length divergence vs reference byte counts across boundary fixtures | 0 |
| Over-limit rejections carrying a changed or new error identity | 0 |
| Workflow invariant violations (topology, bindingness, commitlint) per PR | 0 |
| Behavior changes outside the two repairs | 0 |
| Added CI wall time from the negative control | ≤ 60 seconds per run |

### 4.2 Non-Goals

- **NG-1**: The OPEN-Q15 human part — privacy hashed-class population and configured private-literal coverage (owner-gated, unchanged).
- **NG-2**: Support-environment scope (OPEN-Q14 / OPEN-Q16).
- **NG-3**: The adjacent same-class chars-vs-bytes instance on the verify-gates summary limit constant (`VERIFY_GATES_MAX_SUMMARY_BYTES`) — explicitly out per ticket scope and acceptance criterion 4; flagged for a future owner-routed ticket (DEC-5).
- **NG-4**: Any change to error identities, the limit value (1048576), parser grammar/feature behavior beyond the limit check, or renaming the limit to a character count (rejected direction, DEC-1).
- **NG-5**: Changes to the binding `ts-*` jobs, the doc-distribution/guard jobs, commitlint, or any workflow job other than the shell-suite job.
- **NG-6**: Rewriting existing test suites or changing suite semantics; the repair is aggregation + control only.
- **NG-7**: Broader CI hardening from the delivery-infra pool (e.g., mutable legacy action references noted in the phase-4 baseline) — separate tickets.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Explicit child-suite aggregation in the CI shell-suite job | Any failing suite must fail the job; today's invocation cannot deliver that, and C-8 requires gates that do not lie. |
| F-2 | Reusable suite-aggregation runner contract | The ticket's named option set includes "a small runner"; extracting the aggregation makes the propagation property testable independently of the workflow and gives the job and the negative control a single aggregation truth. |
| F-3 | Synthetic failing-suite negative control | The repository's negative-control discipline: prove the failure path inside a green run; this is ticket acceptance criterion 1's demonstration vehicle. |
| F-4 | Byte-accurate source-size limit in the YAML configuration parser | Resolves the NFR-TOOL-005 gap in the named direction: enforce UTF-8 bytes, fail-closed, byte-named contract preserved. |
| F-5 | Byte-accurate source-size limit in the pm-notes document parser (both check sites) | Same-class repair in the second adapter; the ticket scopes exactly these two parsers. |
| F-6 | Multibyte + boundary test coverage | Ticket acceptance criterion 3: name-accurate behavior must be pinned at the exact boundary, including the multibyte cases where chars and bytes diverge. |
| F-7 | Documentation truth reconciliation | Ticket task 4: the baseline note must reflect the repair; the job comment must stop claiming a property the old invocation never had. |
| F-8 | Scoped ci-topology invariant allowance (DEC-7) | The additions-only invariant rule would make any compliant `bash-tests` repair unshippable and force the false GH-124 comment to stay; the change-scoped allowance makes the owner-authorized repair landable without generalizing. |

### 5.1 Capability Details

- **F-1 — Sound aggregation.** The shell-suite job executes every discovered suite and aggregates each child's exit status explicitly. The job outcome is: fail if at least one suite fails or cannot be executed (fail-closed — a suite that errors before producing a verdict is a failure, never a skip); succeed only if all discovered suites pass. Suite discovery scope remains exactly today's: every shell suite matching the repository's `.tests/test-*.sh` convention.
- **F-2 — Runner contract.** The aggregation is extracted into a small runner that the workflow invokes, owning three responsibilities: discover suites (unchanged scope), execute each suite, aggregate outcomes and exit non-zero if and only if at least one suite failed or could not run. Because the runner is an ordinary repository script, the propagation property is testable without running the workflow. If the runner shape proves unviable during delivery, the ticket's remaining options (an explicit loop, or `-exec ... +` with proper exit handling) stay available — but the AC-1 evidence shape must then be re-pinned (DEC-3, DEC-6).
- **F-3 — Negative control.** A committed, self-verifying negative-mode test following the repository precedent: it constructs a synthetic tree containing a deliberately failing suite, invokes the same runner the workflow invokes, and passes only when the runner exits non-zero — and fails if the runner could ever be made green by a failing suite. The control is wired into CI and executes in the PR's green run; that run is acceptance criterion 1's demonstration evidence, optionally supplemented by a red demonstration run on the branch during delivery (DEC-6).
- **F-4 — YAML parser byte accuracy.** The YAML configuration parser's source-size check measures UTF-8 byte length of the source, not the UTF-16 code-unit count. At or under the limit, parsing proceeds exactly as today; over the limit, the source is rejected fail-closed with today's error identity. The computation is pure — no runtime-specific APIs, no ambient globals — following the existing core code-point→UTF-8 byte-length pattern; whether that pattern is reused via import or replicated locally is decided by the workspace purity rules at delivery (OQ latitude, no human gate).
- **F-5 — pm-notes parser byte accuracy.** Both source-size check sites in the pm-notes document parser behave identically to F-4: byte-accurate, fail-closed, existing error identities unchanged.
- **F-6 — Boundary coverage.** Both parsers' suites carry, for every check site, the five boundary fixture classes: exactly-at-limit in bytes (accepted), one byte over (rejected), one byte under (accepted), char-count-equal-but-bytes-over multibyte content (rejected — the proof that bytes, not code units, decide), and all-ASCII content at the limit (accepted — ASCII behavior is unchanged versus today).
- **F-7 — Documentation truth.** The phase-4 quality baseline note and its FSE-05 audit row are updated to record the repair as landed (the finding becomes a resolved gap with the repair described). The job comment is corrected to state the actual aggregation contract. The remaining known doc reconciliation points are registered for the system-spec update phase (Appendix C) rather than expanded in this change.
- **F-8 — Scoped ci-topology allowance.** The CI-topology invariant check (run in the binding `ts-invariants` job and the aggregate check) enforces an additions-only rule on the CI workflow file: every removed line fails the check. Its stated intent (per its governing test header, TC-SCAFFOLD-023) is "binding TS jobs beside a byte-unchanged bash stack" — but this repair must remove the `bash-tests` job's broken execution block and its incorrect comment, so the invariant gains a narrowly scoped, change-scoped allowance: removed workflow lines are ignored **only** when they belong to the `bash-tests` job's execution block (its `run:` step content) or that job's comment lines. Removals anywhere else in the workflow remain fatal, and job-presence enforcement (the bash/ts job-id loops) stays fatal — deleting or renaming any job still fails. The allowance is non-vacuous by construction: committed negative fixtures prove it does not generalize (a removed line outside the `bash-tests` execution block still fails; removing the whole `bash-tests` job still fails).

## 6. USER & SYSTEM FLOWS

```
Flow 1: Backstop soundness (the case that was silently broken)
  push / PR event → CI shell-suite job (bash-tests) starts
    → runner discovers suites (unchanged scope) and executes each
    → suite K exits non-zero
    → runner aggregates the failure and exits non-zero
    → job fails → the backstop signals red → the gate is truthful

Flow 2: Negative control (a green run proves the red path)
  CI run → negative control builds a synthetic tree with a deliberately failing suite
    → control invokes the same runner the workflow invokes
    → runner exits non-zero → control asserts the non-zero exit → control passes
    → job stays green AND propagation is demonstrated (AC-1 evidence)
    → counterfactual enforced: had the runner exited 0, the control itself would fail

Flow 3: Parser bounded input, multibyte near the limit
  source arrives (multibyte-heavy, size near the limit)
    → parser computes UTF-8 byte length from code points (pure computation)
    → byte length > 1048576 → rejected fail-closed, existing error identity
    → byte length ≤ 1048576 → parse proceeds exactly as today
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The aggregation repair in the CI workflow's shell-suite job, including correction of the job's incorrect comment.
- The suite-aggregation runner and its contract (discovery scope unchanged; explicit child-status aggregation; non-zero exit on any failure).
- The committed synthetic failing-suite negative control, self-verifying, wired into CI.
- A narrowly scoped, change-scoped allowance in the CI-topology invariant check (DEC-7, F-8) — removed `bash-tests` execution-block and comment lines only — plus committed negative fixtures proving the allowance does not generalize.
- Byte-accurate UTF-8 source-size enforcement in the two file-source adapters — the YAML configuration parser (one check site) and the pm-notes document parser (two check sites) — with the limit value, byte-named constant, and error identities unchanged.
- Multibyte and boundary test coverage for both parsers and every check site (five fixture classes per F-6).
- Update of the phase-4 quality baseline note and its FSE-05 audit row to reflect the repair landing.
- Keeping the full gate battery green: all existing suites under the new aggregation, workflow topology/bindingness invariants, commitlint, and the boundary checks.

### 7.2 Out of Scope

- [OUT] OPEN-Q15 human part: privacy hashed-class population and configured private-literal coverage (owner-gated).
- [OUT] Support-environment scope (OPEN-Q14 / OPEN-Q16).
- [OUT] The same-class chars-vs-bytes instance on the verify-gates summary limit constant — flagged for a future ticket; explicitly excluded by acceptance criterion 4.
- [OUT] Any change to error identities, the limit value, parser grammar/features, or renaming the limit to characters.
- [OUT] Changes to the binding `ts-*` jobs, doc-distribution/guard jobs, or any other workflow job.
- [OUT] Changes to any repository invariant check beyond the DEC-7 scoped ci-topology allowance (CI bindingness, commitlint, boundary and purity checks stay untouched).
- [OUT] Rewriting existing suites or changing their semantics beyond what the control and boundary fixtures require.
- [OUT] Broadening the suite discovery scope or touching suite execution semantics (timeouts, parallelism) beyond aggregation.

### 7.3 Deferred / Maybe-Later

- The future owner-routed ticket for the verify-gates summary-limit byte enforcement (registered as DEC-5; not scheduled here).
- A shared, tested byte-length utility should additional consumers of byte accounting emerge (today, reuse-or-replicate of the core pattern per purity rules suffices).
- Broader CI hardening items from the delivery-infra hardening pool (status.md item 7), such as mutable legacy action references.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — no network surface is added or changed.

### 8.2 Events / Messages

N/A — no event or message contracts are introduced. The two binding contracts of this change are the runner result contract (DM-2) and the parser source-size limit contract (DM-1), specified below.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Source-size limit contract | `MAX_SOURCE_BYTES` (1048576) becomes byte-accurate: enforced as UTF-8 byte length, fail-closed, at all three check sites. No constant rename, no value change, no error-identity change. |
| DM-2 | Suite-aggregation result contract | The runner aggregates per-suite outcomes and exits non-zero if and only if at least one discovered suite failed or could not run; the workflow job and the negative control consume the same contract. |

### 8.4 External Integrations

- **GitHub Actions**: the workflow continues to run as today; the shell-suite job's suite execution is delegated to the repository-owned runner. No new external actions, providers, or services are introduced.
- **Provider/tracker integrations**: unchanged — the parsers' consumers (configuration acquisition, pm-notes acquisition) keep their acquisition paths and error identities.

### 8.5 Backward Compatibility

Deliberately tightening in two bounded places. (1) Parsers: multibyte-heavy sources whose UTF-8 byte length exceeds 1048576 but whose code-unit count does not were previously accepted and will now be rejected — intended, fail-closed, and pinned by boundary tests; sources at or under the limit in bytes, and all ASCII sources, behave exactly as today; error identities are unchanged. (2) CI: a job outcome that could previously be falsely green becomes correctly red — no previously-green legitimate state is lost, because a genuinely failing suite was never an acceptable green. No schemas, public APIs, or published artifacts are affected (all packages remain private).

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Propagation soundness: job outcome = fail iff at least one discovered suite fails or cannot run, across every combination of suite outcomes | 100% of negative-control and aggregation scenarios; 0 unsound combinations |
| NFR-2 | Negative-control self-verification: the control passes only when the runner correctly fails a deliberately failing synthetic suite; a runner that could pass a failing suite makes the control fail | 100% of CI runs; 0 false-green control outcomes |
| NFR-3 | Byte accuracy: limit decisions are made on UTF-8 byte length, matching reference byte counts on all boundary fixtures | 0 divergences across the five fixture classes of F-6 |
| NFR-4 | Fail-closed rejection with stable identity: over-limit sources are rejected with today's error identities; no new or changed error codes | 0 identity changes across all limit fixtures |
| NFR-5 | Existing-suite integrity: all existing suites pass under the new aggregation, and the discovery scope is unchanged | 100% pass; 0 suites missed or double-executed |
| NFR-6 | Workflow invariant integrity: CI topology (under its DEC-7 scoped allowance), CI bindingness invariants, and commitlint remain green against the modified workflow | 0 violations per PR; 0 allowance generalizations — all non-vacuity negative fixtures green |
| NFR-7 | Purity: the byte-length computation is runtime-neutral and pure — no runtime-specific imports, no ambient-global reads | 0 violations per boundary/purity checks |
| NFR-8 | Scope confinement: behavior changes limited to the two repairs (aggregation + control, including the DEC-7 scoped ci-topology allowance; the two parsers' limit checks) | 0 out-of-scope behavior changes per review |
| NFR-9 | Runtime budget: the negative control and runner add bounded overhead to the job | control ≤ 60 s; runner aggregation overhead ≤ 5% of job wall time |
| NFR-10 | Diagnosability: on failure, the job log names every failing suite | 100% of failure scenarios name the failing suite(s) |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- No metrics or traces are introduced. Observability is carried by CI artifacts: the runner logs per-suite outcomes, and on failure the log identifies each failing suite by name (NFR-10) so a red job is diagnosable without re-running suites locally.
- The negative control's output is self-describing: it reports the synthetic suite it planted, the runner exit it observed, and the verdict, so a control failure reads as an explanation, not a mystery.
- No product telemetry, audit-ledger, or state mutations are involved; the parsers' rejection diagnostics remain today's, unchanged.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Byte enforcement tightens the limit for multibyte-heavy files near the boundary — sources previously accepted will now be rejected | M | H | Intended, fail-closed (DEC-1); boundary tests pin exactly-at-limit-in-bytes vs chars, one-over, one-under, and char-count-equal-bytes-over (F-6, AC-F4-1); doc reconciliation records the semantics | L — behavior is explicit, tested, and documented |
| RSK-2 | Workflow edits disturb the binding `ts-*` jobs or the doc-distribution/guard jobs | H | L | Edits confined to the shell-suite job; CI topology and bindingness invariants plus commitlint run against the workflow and gate the PR (NFR-6) | L — violations surface as red CI before merge |
| RSK-3 | The negative control itself is false-green (fails to catch an unsound runner) or flaky | M | L | Self-verifying design: the control fails if the runner passes a failing suite; committed precedent-based pattern; the control runs in every CI run so flakiness is immediately visible | L |
| RSK-4 | Extracting the runner changes suite discovery or ordering semantics versus today's invocation (missed or duplicated suites) | M | M | Discovery scope pinned as unchanged (F-1, NFR-5); acceptance requires all existing suites pass under the new aggregation; the control exercises discovery of a failing suite | L |
| RSK-5 | Documentation drift: the baseline note, the feature page's "byte-unchanged and authoritative" sentence, and parser-limit wording contradict the landed reality | L | H | Known reconciliation points pre-registered for the system-spec update phase (Appendix C); the baseline note and job comment are updated in this change (F-7) | L — residual items are doc-syncer-owned, listed, and bounded |
| RSK-6 | Scope creep into the adjacent verify-gates same-class instance or the OPEN-Q15 human part | L | L | Hard scope bounds with [OUT] pins, AC-G6-1 confinement criterion, and DEC-5 routing the adjacent instance to a future ticket | L |
| RSK-7 | The ci-topology allowance sets precedent for weakening repository invariants (a bounded relaxation of a standing control) | M | L | Minimal scope by construction: one job's execution block and its comment lines only; job-presence enforcement and all other workflow removals stay fatal; negative fixtures prove non-generalization (AC-F8-1); recorded as change-scoped DEC-7 and explicitly flagged for reviewer attention at the open-PR human gate | L–M — the precedent concern is on the record and reviewer-gated |

## 12. ASSUMPTIONS

- The CI shell-suite job is a backstop behind the merge gate (lanes run the full local battery), so repairing it requires no historical re-verification of merged PRs.
- Suite discovery scope — every `.tests/test-*.sh` suite under the repository's conventions — is the intended scope, and the runner preserves it exactly.
- The pure-TS code-point→UTF-8 byte-length pattern in the core domain is a valid reference for the parser repair under the workspace purity rules; reuse via import or local replication is a delivery-planning choice, not a spec question.
- Over-limit rejection error identities (`config.file.malformed` and the pm-notes analogues) are stable and remain unchanged by this repair.
- The negative control follows the committed self-verifying negative-mode precedent (doc-distribution-modes, delivery-mutation-sandbox, deliver-ticket-result-tuples-modes style) and the ticket's allowance of "behind a flag or a separate workflow step".
- The workflow invariant checks (CI topology, bindingness) and commitlint continue to run against the modified workflow — ci-topology under its DEC-7 scoped allowance — so structural regressions are still caught in-CI.
- The verify-gates summary limit constant is genuinely the same defect class; this is recorded but not verified or repaired here (DEC-5).

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | CI workflow (shell-suite job `bash-tests`) and gate battery | The repaired job must coexist with binding `ts-*` jobs and guard jobs; topology/bindingness invariants and commitlint gate the workflow shape (ci-topology under its DEC-7 scoped allowance). |
| Depends on | File-source adapters (YAML configuration parser; pm-notes document parser) | The three limit check sites are the repair surface; consumers and error identities stay stable. |
| Depends on | Core UTF-8 byte-length pattern (queue-ready) | Reference pattern for pure, runtime-neutral byte accounting. |
| Depends on | Negative-control precedent scripts | Design template for the self-verifying synthetic control. |
| Depends on | System spec truth: NFR-TOOL-005; scaffold toolchain feature page | NFR-TOOL-005 fixes the byte-enforcement direction; the feature page hosts the phase-7 reconciliation point. |
| Depends on | Inception analysis: phase-4 quality baseline (CI finding, FSE-05 row); open-question reconciliation Q15/Q19 | Source of the findings and target of the task-4 documentation update. |
| Depends on | ADR-0003 constraint C-8 | Running gates never weaken — the normative driver for repairing a gate that can lie green. |
| Blocks | Future verify-gates byte-limit ticket (indirectly) | This change establishes the enforcement pattern and boundary-fixture discipline it can reuse. |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|

None at specification time — the planning session closed with no open questions (pm-notes: `open_questions: []`). Two deliberate delivery-planning freedoms remain within pinned constraints and require no human gate: (a) reuse-via-import vs local replication of the core byte-length pattern, decided by the workspace purity rules (F-4); (b) runner internal mechanics (loop / `-exec ... +` / script internals), pinned only at the contract level (F-2, DEC-3). If the runner shape proves unviable in delivery, the AC-1 evidence shape must be re-pinned before proceeding (DEC-6).

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Enforce UTF-8 bytes; preserve the byte-named contract and the 1048576 value; do not rename to a character limit | Spec truth (NFR-TOOL-005) names byte enforcement as the reconciliation direction and forbids claiming the control from the name alone; fail-closed repo culture; PM-verified decision | 2026-11-06 |
| DEC-2 | The synthetic control is a committed, self-verifying negative-mode test against the same runner the workflow invokes, following the repo's negative-control precedent | Ticket explicitly allows "behind a flag or a separate workflow step"; a committed control keeps proving propagation on every future run instead of once; precedent scripts establish the pattern | 2026-11-06 |
| DEC-3 | Aggregation is extracted into a small runner invoked by the workflow (the ticket's named option set), replacing the non-aggregating `find -exec` invocation; the job comment is corrected in the same change | PM shape guidance prefers the runner; it makes propagation testable without the workflow and gives job and control a single aggregation truth; ticket alternatives remain delivery latitude only if the runner shape proves unviable, which requires re-pinning AC-1 evidence | 2026-11-06 |
| DEC-4 | Error identities are unchanged by the limit repair | The repair changes measurement accuracy, not failure taxonomy; new codes would be scope creep beyond acceptance criterion 4 | 2026-11-06 |
| DEC-5 | The verify-gates summary-limit same-class instance is out of scope and routed to a future owner-routed ticket | Ticket scopes exactly the two adapter parsers and forbids extra behavior change; the instance is recorded (assumption + [OUT] pin) so it is not lost | 2026-11-06 |
| DEC-6 | AC-1 verification shape pinned: the committed negative control executing in the PR's green CI run is the demonstration evidence (CI run link recorded at delivery); an optional red demonstration run on the branch during delivery may supplement it | PM interpretation note; the green-run control proves propagation on every future run and satisfies "demonstrably fails the CI job" without requiring a permanently red workflow | 2026-11-06 |
| DEC-7 | Change-scoped allowance in the CI-topology invariant check: removed CI-workflow lines are ignored **only** when they belong to the `bash-tests` job's execution block (its `run:` step content) or that job's comment lines; removals anywhere else in the workflow remain fatal, and job-presence enforcement (the bash/ts job-id loops) stays fatal — deleting or renaming any job still fails; non-vacuity is proven by committed negative fixtures (removal outside the execution block still fails; whole-job removal still fails) | The invariant's intent (per its governing test header, TC-SCAFFOLD-023: "binding TS jobs beside a byte-unchanged bash stack") is preserved — but this repair *strengthens* a bash job, and a literal additions-only reading makes the owner-authorized repair unshippable and would force the false GH-124 comment to stay. The exception is minimal, scoped to one job's execution block, negative-fixture-guarded, and reviewed at the open-PR human gate. Precedent concern: this is a bounded relaxation of a repository invariant, explicitly flagged for reviewer attention (RSK-7) | 2026-11-06 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| CI workflow — shell-suite job (`bash-tests`) | Updated — aggregation repaired via the runner; job comment corrected; negative-control step wired in. |
| Suite-aggregation runner (repository automation) | New — owns discovery, execution, aggregation, exit contract (DM-2). |
| Synthetic failing-suite negative control (repository automation) | New — committed self-verifying proof of propagation (F-3). |
| File-source adapters — YAML configuration parser | Updated — one check site becomes byte-accurate (DM-1). |
| File-source adapters — pm-notes document parser | Updated — two check sites become byte-accurate (DM-1). |
| Adapter parser test suites | Updated — multibyte and boundary fixtures added (F-6). |
| Core domain (UTF-8 byte-length pattern) | Unchanged — consumed as the reference pattern; import vs replicate decided at delivery by purity rules. |
| Binding `ts-*` jobs, doc-distribution/guard jobs, other workflow jobs | Unchanged — must remain green (NFR-6). |
| CI-topology invariant check | Updated — gains the DEC-7 scoped allowance (`bash-tests` execution-block and comment removals only); still runs against the modified workflow as a standing gate. |
| CI-topology invariant negative fixtures | New — committed fixtures proving the allowance does not generalize (F-8, AC-F8-1). |
| CI-bindingness invariant and commitlint | Unchanged — run against the modified workflow as standing gates. |
| Phase-4 quality baseline analysis (CI finding section; FSE-05 audit row) | Updated — in this change, per ticket task 4 (F-7). |
| System spec: NFR-TOOL-005 gap line; scaffold toolchain feature page sentence; config-layer parser-limit wording | Reconciliation points registered for the system-spec update phase (Appendix C). |
| Verify-gates summary limit | Unchanged — explicitly out of scope (DEC-5); flagged for a future ticket. |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** the new aggregation and any combination of discovered suite outcomes, **when** the shell-suite CI job runs, **then** the job fails if and only if at least one discovered suite fails or cannot be executed — a failing suite can no longer leave the job green, and an all-passing run keeps the job green. | F-1, F-2, NFR-1, NFR-5 |
| AC-F2-1 | **Given** any suite set under the repository's `.tests/test-*.sh` convention, **when** the runner completes, **then** every discovered suite was executed exactly once under today's discovery scope, per-suite outcomes are aggregated and attributed by name in the log, and the runner exits non-zero exactly when at least one suite failed or could not run. | F-2, NFR-1, NFR-5, NFR-10 |
| AC-F3-1 | **Given** the committed negative control, **when** it executes in the PR's green CI run, **then** it plants a deliberately failing synthetic bash suite, invokes the same runner the workflow invokes, observes a non-zero exit, and passes — demonstrating end to end that a synthetic failing bash suite fails the CI job (evidence: the CI run link recorded at delivery, optionally supplemented by a red demonstration run on the branch); and **given** a runner that could be made to exit zero on that failing suite, **when** the control runs, **then** the control itself fails. | F-3, NFR-2, DEC-2, DEC-6 |
| AC-F4-1 | **Given** the multibyte boundary fixture set for the YAML configuration parser — exactly-at-limit in bytes, one byte over, one byte under, char-count-equal-but-bytes-over multibyte content, and all-ASCII content at the limit — **when** the source-size check runs, **then** byte length (never code-unit count) decides every case: at-or-under is accepted and parses exactly as today, one-over and bytes-over are rejected fail-closed with today's error identity, and ASCII behavior at the limit is unchanged. | F-4, NFR-3, NFR-4 |
| AC-F5-1 | **Given** the same boundary fixture set applied at both source-size check sites of the pm-notes document parser, **when** the checks run, **then** identical byte-accurate, fail-closed behavior holds with today's error identities at both sites. | F-5, NFR-3, NFR-4 |
| AC-F6-1 | **Given** the parser suites, **when** they are inspected and executed, **then** boundary coverage exists for both parsers, every check site, and all five fixture classes of F-6, and every boundary case asserts the decision (accept/reject) and the error identity explicitly. | F-6, NFR-3 |
| AC-F7-1 | **Given** the landed change, **when** the phase-4 quality baseline note, its FSE-05 audit row, and the job comment are read, **then** the note and row record the finding as repaired (repair described, gap closed), and the comment states the actual aggregation contract with no false claim about `set -e` failing the job on a failing suite. | F-7 |
| AC-F8-1 | **Given** the negative fixture set for the ci-topology allowance, **when** the invariant check runs against the modified workflow, **then** removed lines are ignored only when they belong to the `bash-tests` job's execution block (its `run:` step content) or that job's comment lines; a removed line anywhere else in the workflow still fails the check; removing or renaming the whole `bash-tests` job — or any bash/ts job id — still fails; and the fixtures prove the allowance does not generalize. | F-8, NFR-6, DEC-7 |
| AC-G6-1 | **Given** the full change diff and the green gate battery (existing suites, boundary and purity checks, workflow invariants under the DEC-7 allowance, commitlint), **when** the change is reviewed, **then** behavior changes are confined to the two repairs — aggregation plus control, explicitly including the narrow DEC-7 ci-topology allowance and its non-vacuity negative fixtures as part of repair 1's landing, and the two parsers' limit checks — with zero changes to error identities, the limit value, other parsers or engines, other workflow jobs, any other invariant check, and the verify-gates summary limit untouched. | NFR-6, NFR-8, DEC-5, DEC-7 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Delivered through the standard 11-phase lifecycle on the prepared fix branch targeting `main-tools`; a single, self-contained repair change, reversible by one revert.
- C-8 alignment: this change strictly strengthens a running gate (a gate that could lie green becomes truthful); no gate is weakened, relaxed, or skipped anywhere in the delivery. The DEC-7 ci-topology allowance — a bounded relaxation of a repository invariant — is explicitly placed on the open-PR human review agenda (RSK-7).
- The negative control becomes a standing CI obligation from the first green run onward: every future CI run re-proves failure propagation, so regressions in the runner or its workflow wiring surface immediately.
- Communication: the corrected job comment and the updated phase-4 baseline note are the in-repo record; no external announcement is needed (internal audience, unpublished packages).
- At system-spec update (phase 7), the doc-syncer reconciles the registered points in Appendix C — including the scaffold toolchain feature page sentence asserting the bash jobs are "byte-unchanged and authoritative", which this change makes stale by design.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A — no persisted data, schema, or seed data is involved. The negative control constructs its synthetic tree at runtime from committed fixtures and leaves no state behind; the parsers' limit change affects acceptance decisions at read time only.

## 20. PRIVACY / COMPLIANCE REVIEW

- No new data egress, network listeners, or external destinations. The synthetic suite and boundary fixtures are synthetic content committed to the repository; no personal data, credentials, or private material is introduced.
- The parser repair strengthens the bounded-input control documented under NFR-TOOL-005 (security/confidentiality); it adds no new processing of user data and changes no redaction behavior.
- The privacy guard, hashed-class registries, and their coverage remain untouched — the OPEN-Q15 human part stays owner-gated and out of scope (NG-1).

## 21. SECURITY REVIEW HIGHLIGHTS

- **Bounded-input honesty (NFR-TOOL-005)**: the byte-named limit now enforces what its name promises. Previously, multibyte-heavy sources up to ~4× the byte budget in code units could pass a guard named for bytes; enforcement is now byte-accurate and fail-closed, closing the documented gap with boundary tests as standing evidence.
- **Backstop integrity (C-8)**: a green `bash-tests` job becomes a truthful claim — suite failures can no longer hide behind non-aggregating `-exec` semantics, restoring the merge gate's CI backstop to soundness.
- **Negative control as control evidence**: following the repository's committed negative-control discipline, the propagation property is continuously proven rather than asserted; the job comment now documents the real contract instead of an incorrect one.
- **No new attack surface**: no new input channels, no new parsers, no changed trust boundaries; untrusted sources remain bounded by the same limit value, now measured accurately.
- **Scope confinement as a security property**: the adjacent verify-gates same-class gap is deliberately not touched here (AC-G6-1), avoiding unreviewed behavior change while keeping the defect on the record (DEC-5).
- **Invariant relaxation governance**: the ci-topology allowance (DEC-7) is a bounded relaxation of a standing repository control — minimal by construction (one job's execution block and its comment lines), non-vacuous via negative fixtures (AC-F8-1), and explicitly flagged for reviewer attention at the open-PR human gate.

## 22. MAINTENANCE & OPERATIONS IMPACT

- New standing obligation: the negative control must keep passing. Runner and workflow changes co-evolve with the control; any change to the runner's contract (DM-2) without updating the control is a review-blocking gap.
- Parser boundary fixtures are coupled to the limit value: if 1048576 ever changes, the five fixture classes must be regenerated — the suites make this an explicit, mechanical update.
- The runner is ordinary repository automation with its own self-test; it follows the existing script/test conventions and adds no new operational burden beyond keeping the control green in CI.
- The DEC-7 allowance is coupled to the `bash-tests` job identity: a future rename, split, or restructure of that job (or of its execution block) must revisit the allowance scope and its negative fixtures, or the invariant's protection silently drifts.
- Operations: none new — CI continues to run the same job set; the repaired job's failure output is more diagnosable (failing suites named, NFR-10).
- Future work registered, not owed here: the verify-gates byte-limit ticket (DEC-5) and the broader delivery-infra hardening pool items (NG-7).

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Failure propagation | The property that a child process's non-zero exit is aggregated into its parent's outcome, ultimately failing the CI job. |
| Suite aggregation | Collecting every discovered suite's exit status and deciding the job outcome from all of them, rather than relying on a traversal predicate. |
| `find -exec ... ;` semantics | Each child invocation only makes the `find` predicate true/false; it cannot make a successful traversal exit non-zero — the root cause of the silent-green defect. |
| Negative control | A committed, self-verifying test that proves a failure path works by exercising it inside an otherwise green run. |
| Self-verifying test | A test whose assertion covers its own precondition — here, a control that fails if the runner could pass a failing suite. |
| UTF-8 byte length | The number of bytes a string occupies when encoded as UTF-8; computed from code points in pure TypeScript (the core queue-ready pattern), without `TextEncoder` or `Buffer`. |
| UTF-16 code units | What JavaScript's `string.length` counts; diverges from UTF-8 bytes for multibyte content — the source of the chars-vs-bytes defect. |
| Multibyte content | Text containing code points that encode to more than one UTF-8 byte (e.g., non-Latin scripts, emoji), where byte length exceeds code-unit count. |
| Fail-closed | Rejecting when the safe determination cannot be made; here, over-limit sources are rejected, and a suite that cannot run counts as failed. |
| Binding gate | A CI job whose failure blocks merge; per ADR-0003 C-8, running gates never weaken during migration. |
| Backstop | The CI-side safety net behind the local gate battery — it must be sound even though lanes run the full battery locally. |
| Boundary fixture | A test input constructed exactly at, one unit over, or one unit under a limit — here in both bytes and code units — to pin the acceptance boundary. |

## 24. APPENDICES

### Appendix A — Ticket acceptance criteria traceability

| Ticket AC (verbatim) | Spec coverage |
|---|---|
| A synthetic failing bash suite demonstrably fails the CI job (evidence: CI run link) | AC-F3-1 (control in the green run; DEC-6 pins the evidence shape), AC-F1-1, F-1/F-2/F-3 |
| All existing suites pass with the new aggregation | AC-F2-1, NFR-5, F-1/F-2 |
| Parser limit behavior is name-accurate with multibyte boundary tests | AC-F4-1, AC-F5-1, AC-F6-1, F-4/F-5/F-6 |
| No behavior change beyond the two repairs | AC-G6-1, NFR-8, DEC-4/DEC-5 |

### Appendix B — Parser check-site inventory (component level)

| Adapter | Check sites | Repair |
|---|---|---|
| YAML configuration parser | one source-size check | byte-accurate UTF-8 enforcement (DM-1) |
| pm-notes document parser | two source-size checks | byte-accurate UTF-8 enforcement at both sites (DM-1) |

Both keep: the byte-named constant and its 1048576 value, the existing error identities, and all non-limit parser behavior.

### Appendix C — Documentation impact register (phase-7 reconciliation points)

| # | Document / location | Impact | Owner phase |
|---|---|---|---|
| 1 | CI workflow shell-suite job comment | Corrected in this change (no false `set -e` claim; states the aggregation contract) | delivery (F-7) |
| 2 | Phase-4 quality baseline analysis — CI finding section and FSE-05 row | Updated in this change: finding recorded as repaired (ticket task 4) | delivery (F-7) |
| 3 | System spec nonfunctional page — NFR-TOOL-005 gap line ("byte enforcement needs reconciliation") | Reconcile: gap resolved by byte enforcement | system-spec update |
| 4 | Scaffold toolchain feature page — "The existing bash jobs remain byte-unchanged and authoritative" sentence | Made stale by this change by design; reconcile wording with the runner-based aggregation | system-spec update |
| 5 | Config-layer feature page — parser-limit wording | Reconcile if the wording describes code-unit semantics | system-spec update |
| 6 | Open-question reconciliation (Q15/Q19 rows) | Analysis snapshot; reconcile pointers only if the doc-syncer deems it required | system-spec update |

### Appendix D — Normative anchors honored

| Anchor | How this change honors it |
|---|---|
| ADR-0003 C-8 (running gates never weaken) | The repair strictly strengthens the shell-suite backstop; no gate is relaxed; the negative control makes the strengthened property continuously verified. |
| NFR-TOOL-005 (bounded input) | The documented gap is closed in the named direction: byte enforcement, fail-closed, byte-named contract preserved; boundary tests become the evidence the gap line demanded. |
| Repo negative-control discipline | The synthetic failing-suite control follows the committed negative-mode precedent and is exercised in every CI run. |
| Invariant intent (TC-SCAFFOLD-023 header: "binding TS jobs beside a byte-unchanged bash stack") | Preserved: the job set and the binding `ts-*` jobs are untouched; the bash stack is strengthened, not weakened; the DEC-7 exception is minimal, negative-fixture-guarded, and reviewer-gated at the open PR. |

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-06 | @spec-writer | Initial specification for GH-251 (shell-suite CI failure propagation + input-limit UTF-8 boundary naming). |
| 1.1 | 2026-11-06 | @spec-writer | Iteration-2 amendment (spec reopened by PM after test-plan gap): DEC-7 scoped ci-topology allowance with non-vacuity negative fixtures — F-8, AC-F8-1, RSK-7 added; NFR-6, NFR-8, AC-G6-1, summary, scope, dependencies, components, rollout, security, maintenance, and Appendix D aligned. |

---

## AUTHORING GUIDELINES

- Sources: GitHub issue #251 (verbatim context/tasks/AC/out-of-scope/references); the GH-251 pm-notes (decisions, scope bounds, doc impacts, state detection); the PM planning summary (phase-1, verified); system spec truth — NFR-TOOL-005 gap wording in the nonfunctional page and the scaffold toolchain feature page sentence; the phase-4 quality baseline CI finding and FSE-05 row; ADR-0003 constraint C-8; the committed negative-control precedent scripts; the pure-TS byte-length pattern in the core domain (queue-ready); structure follows the change-spec template with the GH-231 sibling spec as the depth reference.
- PM decisions were incorporated as DEC-1 (byte enforcement direction), DEC-2 (committed negative-control shape), and DEC-6 (AC-1 verification shape pinned per the pm interpretation note); the ticket's verbatim acceptance criteria are preserved and expanded in Section 17 (Appendix A maps them one-to-one).
- Scope discipline: exactly the two owner-authorized repairs plus the ticket's task-4 documentation update; the verify-gates same-class instance and the OPEN-Q15 human part are pinned [OUT] with routing recorded (DEC-5, NG-1/NG-3).
- pm-notes recorded zero open questions; Section 14 states this and scopes the two delivery-planning freedoms (pattern reuse, runner mechanics) as non-gated latitude.
- Component-level naming is used throughout (adapters, runner, workflow job); no code file paths, line numbers, or implementation steps are included, per spec-writer constraints.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-251)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-)
- [x] Acceptance criteria reference at least one F-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths, no step-by-step tasks)
- [x] No content duplicated from linked docs (findings and gap wording referenced, not restated wholesale)
- [x] Front matter validates per front_matter_rules
