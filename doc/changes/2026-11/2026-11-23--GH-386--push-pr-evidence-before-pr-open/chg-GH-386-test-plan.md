---
id: chg-GH-386-test-plan
status: Proposed
version: 1.0
created: 2026-11-23
last_updated: 2026-11-23
owners: ["Juliusz Ćwiąkalski"]
service: "the typed dispatch engine's result derivation and classification (CLI composition over the core dispatch family and the adapters-layer git seams)"
labels: [change, defect, m4, dispatch, cli]
version_impact: minor
summary: "Verification map for the engine-side ensure-push: derivation arm 8 gains the parity precondition (clean-parity no-act, local-ahead one-push-then-re-read, rejected/failed/timed-out/still-unmet typed failure, parity-read-unreadable to state-unverified, remote-ahead typed failure, pr-open-unverified exclusion, resume re-evaluation, single-attempt idempotent act contract), terminal parity evidence (push:<verdict> references reserved ahead of the slice within the 16-reference budget; additive optional machine-envelope push block, together-or-absent-together, 256-character bound; four-key text byte-stability), the one new failure-token-mapping row (failed/failed/exit 1/exactly one attempt/comparison push-parity-unmet, PR URL retained, no new token or identity), the AC-F1-2 defect pin (a divergent pr-open is impossible by construction), the declared shell-fallback divergence (documentation check), and the AC-F4-1 post-merge live-verification contract carried as traceable-but-executed-post-merge — all over injected git facts and fixture-injected push outcomes, never a real remote; the new coverage joins the dispatch-engine test-spec map through the parity battery registry."
links:
  change_spec: ./chg-GH-386-spec.md
  implementation_plan: ./chg-GH-386-plan.yaml   # phase-4 artifact; not present when this plan was written
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M4-S23: The PR-creation evidence commit must be pushed before the lane closes (M4)

## 1. Scope and Objectives

The defect is structural: the dispatch engine derives `pr-open` from pull-request truth alone, with no parity precondition, no push act of its own, and push left to session-side convention — so a native delivery can classify `pr-open` at exit 0 while the branch's final evidence commit exists only locally (observed on two consecutive native deliveries, not on a third; the current path permits both outcomes, which is why the fix is enforcement at the derivation, not a behavioral nudge). The change adds the engine-side ensure-push at derivation arm 8, terminal parity evidence in the delivered evidence-reference and envelope styles, and one new row in the pinned failure-token mapping; it adds no token, no error identity, no domain kind, no derivation arm, and no attempt-record field.

This plan proves the declared behavior where it lives — at the derivation and the injected push seam — and pins the invariants that make the defect impossible rather than merely unlikely: parity before any `pr-open` classification, exactly one bounded act per classification, a typed non-`pr-open` failure that retains the PR URL when parity cannot be established, and the defect pin that a divergent `pr-open` cannot be constructed from any injected fact combination. Every case runs offline over injected facts ("production spawns the git binary; tests inject facts"): no real network, no real remote, no real child process. The highest-risk failure modes each get an adversarial arm: a precondition that pushes but trusts the stale re-read into a false `pr-open` (TC-PUSH-007 pins the honest typed failure), an unreadable parity read misrouted into the new failure row instead of the delivered undecidable-truth semantics (TC-PUSH-009), the precondition silently skipped on a resumed lane (TC-PUSH-011), a second push attempt or a force-capable variant creeping into the act (TC-PUSH-012), parity evidence truncated away by a full evidence slice (TC-PUSH-014), the envelope block leaking into text mode or growing unbounded (TC-PUSH-016/017), the new failure row growing a token, an error identity, or an error-table row (TC-FAIL-003), and the no-shell invariant not covering the new remote-write seam (TC-BND-002).

This is a verification map, not an execution claim: nothing here was run against a new implementation at authoring time, and phase ownership belongs to `chg-GH-386-plan.yaml`, authored in phase 4 after this plan. **AC-F4-1 is traceable-but-executed-post-merge**: the ticket's two-consecutive-dispatch proof is declared (spec F-4, DEC-2) as a post-merge live verification recorded by the CEO/owner lane in the pm-notes `notes:` trail; the in-merge gates for the ticket's acceptance are the AC-1/AC-2 fixtures and the defect pin (TC-PUSH-001/002, TC-FAIL-001, TC-PUSH-013). This plan invents no in-change live-dispatch step for AC-F4-1. All six acceptance criteria (AC-F1-1, AC-F1-2, AC-F2-1, AC-F3-1, AC-F4-1, AC-F5-1) are covered by at least one named case; every case traces to at least one spec AC; there are no TODO rows and no orphan cases.

### 1.1 In Scope

- **F-1, the parity precondition and ensure-push at derivation arm 8**: clean-parity performs no push act; local-ahead performs exactly one bounded fast-forward push and one parity re-read before `pr-open`; rejected, failed, timed-out, and parity-still-unmet pushes type-fail; an unreadable parity read resolves `state-unverified` at exit 2 and never the failure row; remote-ahead is a typed failure; `pr-open-unverified` stays outside the precondition (DEC-5); a resumed recorded `pr-open` lane re-evaluates the precondition with an idempotent act; the act contract is one attempt, no retry, fixed argv, literal non-shell spawn, injectable 60 000 ms timeout, change-branch upstream only, fast-forward only.
- **F-2, terminal parity evidence**: `push:<verdict>` evidence references (verdicts `clean`, `pushed`, `failed`) reserved ahead of the evidence slice within the delivered 16-reference budget; the additive optional machine-envelope `push` block (`verdict`, `localHead`, `remoteHead`, `parity`), present together-or-absent-together exactly when the precondition evaluated, bounded at the delivered 256-character dispatch bound; text mode stays the delivered four-key contract with `pr_url` retained.
- **F-3, the typed push failure**: the one new failure-token-mapping row — `failed` / `failed` / exit 1 / exactly one attempt record / comparison not-applicable with reason `push-parity-unmet` — with the PR URL retained in both output modes, exposure-counting semantics, no divergence, and no new token, error identity, domain kind, or error-table row.
- **AC-F1-2, the defect pin**: a fixture-level proof that no injected fact combination classifies `pr-open` with the local head ahead of the pull request's head.
- **F-5, the declared shell-fallback divergence**: documentation-content verification that the fallback rows and the operations guide declare the typed-lane-only parity enforcement (spec §7.1 doc-impact list, including the test-spec coverage-map reconciliation).
- **NFR-1..NFR-5**: single-attempt boundedness, added-cost bound, no-shell surface coverage of the new seam, output-surface stability, evidence-budget integrity.
- **Backward compatibility**: pre-change attempts without `push:` references read unchanged; reads never fabricate parity facts; the envelope block is absent on every precondition-unevaluated outcome.
- **Battery integration**: new registry rows join the single row registry (`tests/fixtures/dispatch/parity/cases.ts`) and the proof boundary (`tests/fixtures/dispatch/parity/evidence.ts`); the dispatch-engine test-spec coverage map gains the new classes.

### 1.2 Out of Scope & Known Gaps

- **Real git, real remotes, real credentials.** Never exercised: every case injects the parity facts (local head, pull-request head) and the push outcome (success, rejection class, timeout) through the delivered child-runner seam pattern. The push act's real transport is guarded by the same offline posture as the rest of the battery — zero live network calls, zero real child processes.
- **Merge capability.** Dispatch keeps no merge port and no merge code path (NG-1); the delivered no-merge suites stay authoritative. This plan asserts the push act is not a merge only via TC-PUSH-012's argv scope, not by re-pinning the merge-absence structure suites (cited: `tests/structure/dispatch-merge-boundary.test.ts`, Existing – No Change).
- **Session-side push conventions, the commit primitive, and the PR-creation workflow's retained git writes.** Unchanged (NG-3); their delivered suites stay authoritative and are not re-pinned here.
- **The bash fallback's behavior.** Unchanged (NG-4, NG-6): the fallback matrix (`scripts/.tests/test-dispatch-bash-fallback.sh`) stays authoritative. TC-FALLBACK-001 verifies only the documentation declaration of the divergence, never fallback code.
- **`pr-open-unverified` parity enforcement.** Declared out (DEC-5, NG-out); TC-PUSH-010 pins the exclusion (no push act, unchanged semantics, absent envelope block) rather than testing an unimplemented extension.
- **The corroboration requirement map and attempt-record schema.** Unchanged (NG-7); the delivered contract pins stay authoritative and are extended additively only (TC-FAIL-003 asserts exactly that).
- **AC-F4-1 execution.** Post-merge by declared contract (F-4, DEC-2): TC-LIVE-001 carries the contract, its record home, and its pass/fail reading; it is executed after the merge by the CEO/owner lane, never in-change.
- **Richer push-rejection cause disclosure.** Deferred by the spec (§7.3): all rejection classes share the single `push:failed` verdict; the plan pins the shared verdict, not a per-cause taxonomy.
- **The parked git-operations-centralization work.** Not a dependency (NG-6); nothing here tests against it.
- **Changeset mechanics, branch targeting, phase lifecycle.** Delivery-phase concerns (spec §18); owned by the implementation plan; not test scenarios.

## 2. References

- Change specification: `./chg-GH-386-spec.md` — §5 capabilities (F-1..F-5), §5.1 declared behaviors (the seven F-1 paths, the act contract), §6 flows 1–5, §7 scope boundaries, §8.3 data-model impacts (DM-1..DM-3), §9 NFRs (NFR-1..NFR-5), §11 risks (RSK-1..RSK-6), §14 open questions (none carried), §15 decisions (DEC-1..DEC-6), §17 acceptance criteria and ticket traceability, Appendix A code-truth basis, Appendix B the pinned failure row (verbatim), Appendix C ticket-AC traceability, Appendix D the declared envelope parity block.
- PM notes: `./chg-GH-386-pm-notes.yaml` — the intake briefing and the delivery conventions (gate evidence `TMPDIR=$PWD/tmp/tmpdir`, commits via the commit primitive, PR targets `main-tools`).
- Ticket: juliusz-cwiakalski/agentic-delivery-os issue #386 (M4-S23, milestone "M4: Jaiship-native delivery") — the twice-observed divergence table, required behaviours 1–4, the three ACs, owner comment 1 (evidence-driven acceptance: the parity guard plus the local-ahead-can-never-be-`pr-open` fixture is the acceptable outcome; a "reproduced and fixed" claim additionally requires a failing case before the change), owner comment 2 (DEC-2: AC-3 is post-merge).
- Testing strategy: `.ai/rules/testing-strategy.md` — bun:test under `tests/**/*.test.ts`, hermetic fixture conventions (fixtures never named `*.test.ts`; no fixture fabricates a command outcome), permanent-suite invariant rules (never assert a branch diff; goldens updated deliberately by explicit command; assert meaning, not growing counts), aggregate gate `pnpm check`.
- Enduring coverage map: `doc/quality/test-specs/test-spec-dispatch-engine.md` — the principal dispatch suites this plan joins; it gains the push-parity coverage rows in the change's documentation reconciliation (phase 7).
- Current-truth feature specifications: `doc/spec/features/feature-dispatch-engine.md` (derivation ladder, failure-token mapping, evidence references, envelope), `doc/spec/features/feature-verify-gates.md` (the shared `push-parity` definition this change reuses), `doc/spec/features/feature-quality-gates.md` (the `pr_creation` push convention), `doc/spec/features/feature-autonomous-delivery.md` (the fallback rows TC-FALLBACK-001 verifies).
- Parity battery prior art this plan builds on:
  - `tests/fixtures/dispatch/parity/cases.ts` — the one whole-battery registry (29 rows, seven declared groups, closed `PARITY_GROUPS`/`PARITY_SEAMS` constants; rows authored incrementally at first need by the phase that owns the case).
  - `tests/fixtures/dispatch/parity/evidence.ts` — the 11-class table, the permanent `PARITY_PROOF_BOUNDARY` constant, `canonicalize` for two-run determinism, and the `classObservation` harness that drives the real command path (`runCli` over injected seams) for every class row.
  - `tests/conformance/dispatch/dispatch-parity-battery.test.ts` (per-row token/exit proof, import-identity manifest, two-run determinism, seam membership), `dispatch-parity-no-shell.test.ts` (fixed argv, no shell, zero real child processes), `dispatch-parity-lane-resume.test.ts` (the `resume-pr-open-lane` row and the pre-change-attempts-read-unchanged convention), `dispatch-parity-stall-loop.test.ts` (the loop rows that resolve `pr-open`).
  - Delivered doubles under `tests/fixtures/dispatch/parity/` (`process-runner.ts` refuses a requested shell by name; `seams.ts`, `lane.ts`, `harness.ts`, `truth.ts`).
- Contract and structure prior art:
  - `tests/checks/dispatch-contract-invariance.test.ts` and `tests/structure/dispatch-token-home.test.ts` — the closed vocabulary, pinned failure-token pairs, attempt schema, and exits (extended additively only).
  - `tests/types/dispatch-contract.type-test.ts` — the attempt and envelope type surface.
  - `tests/golden/dispatch-text.test.ts` and `tests/golden/dispatch-errors.test.ts` — the four-key text order and classified-failure goldens.
  - `tests/behaviour/dispatch-truth-derivation.test.ts` (the total derivation order and arm 8), `dispatch-attempts-contract.test.ts` (the sixteen-field projection and the not-applicable comparison projection), `dispatch-comparison.test.ts` / `dispatch-evidence-record.test.ts` (comparison shape and record completeness), `tests/structure/dispatch-merge-boundary.test.ts` (no merge path).
  - `scripts/checks/no-shell-dispatch.ts` + `tests/checks/no-shell-dispatch.test.ts` — the static no-shell invariant over the declared dispatch-flow surface list (NFR-3's home).

## 3. Coverage Overview

Every AC maps to at least one named case, and every case traces to at least one AC; no AC is TODO. TC-ID prefixes are new in this plan and verified unused in the delivered tree immediately before authoring (grep across `tests/`): **TC-PUSH-*, TC-FAIL-*, TC-LIVE-*, TC-FALLBACK-*, TC-BND-*, TC-BAT-*** have no delivered assignments. Three candidate prefixes were rejected as delivered series this plan must not collide with: `TC-EVID-001..007` (GH-239 dispatch-engine slices), `TC-DOCS-001/003` (tracker credential guide), `TC-COMPAT-001` (GH-237 queue).

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (compressed) | TC ID(s) | Status |
|-------|------------------------|----------|--------|
| AC-F1-1 | Terminal classification with an open, URL-resolved pull request: local head equals the PR head before `pr-open` derives; local-ahead reconciled by one bounded fast-forward push + parity re-read; already-equal performs no push act | TC-PUSH-001, TC-PUSH-002, TC-PUSH-011, TC-PUSH-012 | Covered |
| AC-F1-2 | A dispatch that classifies `pr-open` while the local head is ahead is impossible by construction — the defect pin: push reconciles first or the result is the typed failure, never a divergent `pr-open` | TC-PUSH-013 | Covered |
| AC-F2-1 | Every precondition-evaluating attempt carries the `push:<verdict>` reference reserved ahead of the evidence slice and the additive optional envelope `push` block (`verdict`/`localHead`/`remoteHead`/`parity`); text mode stays the four-key contract | TC-PUSH-014, TC-PUSH-015, TC-PUSH-016, TC-PUSH-017 | Covered |
| AC-F3-1 | Rejected/failed/timed-out/still-unmet push: result `failed`, outcome `failed`, exit 1, never `pr-open`; exactly one attempt record; comparison not-applicable, token null, reason `push-parity-unmet`; PR URL retained in both modes; no new token, error identity, or domain kind | TC-PUSH-003, TC-PUSH-004, TC-PUSH-005, TC-PUSH-006, TC-PUSH-007, TC-PUSH-008, TC-PUSH-009, TC-FAIL-001, TC-FAIL-002, TC-FAIL-003 | Covered |
| AC-F4-1 | Post-merge live verification contract: the first two consecutive natural dispatches after merge end local == remote at `pr-open` with parity evidence, recorded by the CEO/owner lane — the declared AC-3 satisfaction form the DoD gate evaluates; NOT executed in-change | TC-LIVE-001 | Covered (traceable-but-executed-post-merge) |
| AC-F5-1 | The fallback rows and the operations guide declare that parity enforcement is typed-lane behavior and the fallback keeps its delivered behavior — no silent drift | TC-FALLBACK-001 | Covered |

Functional capability roll-up:

| F-# | Capability | TC ID(s) |
|-----|------------|----------|
| F-1 | Derivation-time parity precondition with the engine-side ensure-push act (seven declared paths + act contract + resume binding) | TC-PUSH-001..012 |
| F-2 | Terminal parity evidence: `push:<verdict>` references, additive optional envelope block, text-mode stability | TC-PUSH-014..017 |
| F-3 | Typed push-failure classification: one new failure-token-mapping row + the `push-parity-unmet` reason literal | TC-FAIL-001..003 (+ TC-PUSH-003..008 as the outcome sources) |
| F-4 | Post-merge live verification contract (declared satisfaction form for ticket AC-3) | TC-LIVE-001 |
| F-5 | Declared shell-fallback divergence (documentation) | TC-FALLBACK-001 |

Ticket acceptance-criteria traceability (spec Appendix C):

| Ticket AC / requirement | Spec criterion | TC ID(s) |
|-------------------------|----------------|----------|
| AC-1 fixture: PR-creation flow records phase, commits URL, asserts remote head == local head before `pr-open` | AC-F1-1 + AC-F2-1 | TC-PUSH-001, TC-PUSH-002, TC-PUSH-014..017 |
| AC-2 fixture: rejected push → typed non-`pr-open` result carrying the PR URL | AC-F3-1 | TC-PUSH-003..005, TC-FAIL-001, TC-FAIL-002 |
| Requirement 4: `pr-open` with local head ahead is a defect by definition, pinned by fixture | AC-F1-2 | TC-PUSH-013 |
| AC-3: two consecutive real dispatches end local == remote at `pr-open` | AC-F4-1 (DEC-2 post-merge contract) | TC-LIVE-001 |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No HTTP endpoints and no event/message surfaces exist or change (spec §8.1/§8.2) — nothing to cover there, by absence. The data-model elements:

| ID | Element | TC ID(s) / note |
|----|---------|-----------------|
| DM-1 | `push:<verdict>` attempt evidence references (`clean`/`pushed`/`failed`), reserved ahead of the slice, within the 16-reference budget, identifiers only | TC-PUSH-014 (reservation + budget + no-truncation), TC-PUSH-001/002 (clean/pushed values), TC-PUSH-013 (the pin reads the evidence), TC-FAIL-001 (`failed` value) |
| DM-2 | Additive optional machine-envelope `push` block (`verdict`, `localHead`, `remoteHead`, `parity`; together-or-absent-together; ≤ 256 chars; absent when the precondition did not evaluate) | TC-PUSH-015 (presence matrix), TC-PUSH-016 (bounds and content), TC-PUSH-010 (absent on `pr-open-unverified`) |
| DM-3 | Failure-token-mapping row + the `push-parity-unmet` comparison-reason literal (no identity, token, or kind added) | TC-FAIL-001 (row semantics end-to-end), TC-FAIL-003 (closure pins), TC-PUSH-009 (the boundary: an unreadable parity read never lands in this row) |

External integrations (spec §8.4) are covered at the seam: the git remote write is asserted through the injected push runner's recorded argv and invocation count (TC-PUSH-012), and the provider delivery-request read is asserted unchanged in count and kind (TC-BND-001). Neither is exercised live, by construction.

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement | TC ID(s) / note |
|-----|-------------|-----------------|
| NFR-1 | Push act boundedness: at most one push per classification, no retry; fixed argv, literal non-shell spawn; injectable 60 000 ms timeout, no new configuration key; fast-forward-only; change-branch upstream only | TC-PUSH-012 (the act contract), TC-PUSH-003..008 (single-invocation recording on every failure path), TC-PUSH-008 (no force-capable variant, no other ref), TC-BND-002 (non-shell spawn) |
| NFR-2 | Added classification cost: at most one extra bounded parity read after a performed push; no new provider read class | TC-BND-001 |
| NFR-3 | No-shell invariant preservation: the declared dispatch-flow surface list covers the new seam so the static scan rules apply to it | TC-BND-002 (+ TC-PUSH-012's argv assertions at the seam) |
| NFR-4 | Output-surface stability: text mode byte-unchanged (four keys); machine additions bounded single-line, whole `push` block ≤ 256 characters; no new configuration key on any path | TC-PUSH-017 (text goldens), TC-PUSH-016 (block bounds), TC-BND-001 (no new configuration key asserted alongside the read-count proof) |
| NFR-5 | Evidence-budget integrity: `push:` references count within the 16-reference budget and are reserved ahead of the slice, never truncated away by a disclosure | TC-PUSH-014 |

## 4. Test Types and Layers

| Layer | Framework / location | Role in this plan |
|-------|----------------------|-------------------|
| Pure-domain behaviour | `bun:test`, `tests/behaviour/*.test.ts` | The parity precondition in the derivation (arm 8), the push-failure classification, the unreadable-parity boundary, the `pr-open-unverified` exclusion, resume re-evaluation, and backward-compatible reads — driven through the real command path (`runCli`) with injected harness/tracker/artifact/truth seams and the injected parity-fact and push-outcome sources |
| Structure and contract pins | `bun:test`, `tests/structure/*.test.ts`, `tests/types/*.type-test.ts`, `tests/checks/*.test.ts` | Vocabulary closure (eleven tokens unchanged, exactly one new failure-mapping row, the one new reason literal), the envelope shape pin (together-or-absent-together, key order appended only), and the additive-only extension of the delivered contract invariance suites |
| Conformance battery | `bun:test`, `tests/conformance/dispatch/*.test.ts` + `tests/fixtures/dispatch/parity/**` | The offline parity battery: new registry rows proven through the real command path exactly once each, two-run determinism via `canonicalize`, seam membership against `PARITY_PROVEN_SURFACES`, and the permanent proof boundary |
| Static invariant | `scripts/checks/no-shell-dispatch.ts` via `pnpm check:no-shell` (+ `tests/checks/no-shell-dispatch.test.ts`) | The declared dispatch-flow surface list covers the new push seam; planted shell references fail by name |
| Golden | `bun:test`, `tests/golden/*.test.ts` | Text-mode byte stability (four-key contract; existing goldens unchanged) and one new classified-failure golden for the push failure, pinned once and updated deliberately thereafter |
| Manual / content checks | Documentation review per testing strategy layer 2 | AC-F5-1 (the declared divergence in feature pages and the operations guide) and AC-F4-1 (the post-merge live verification, recorded in pm-notes) |
| Aggregate gate | `pnpm check` (lint → format → typecheck → test → boundaries) | Final verification; gate evidence recorded with `TMPDIR=$PWD/tmp/tmpdir` |

Fixture strategy (applies to every automated layer): the parity facts (local head SHA, pull-request head SHA — full-hex fixture literals) and the push outcome (`pushed`, rejection per class, timeout, unchanged-parity) are injected through the delivered child-runner seam pattern; the injected runner records every invocation (argv, count, order) and refuses a requested shell or script path by name, exactly as the delivered `process-runner.ts` double does. No case starts a real child process, opens a network connection, or reads a real remote; no fixture fabricates a command outcome — every observation comes from a real `runCli` invocation over injected facts.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-PUSH-001 | Clean parity: no push act, `pr-open` with `push:clean` | Happy Path | conformance + behaviour | High | AC-F1-1, AC-F2-1 |
| TC-PUSH-002 | Local ahead: one push, one re-read, `pr-open` with `push:pushed` | Happy Path | conformance + behaviour | High | AC-F1-1, AC-F2-1 |
| TC-PUSH-003 | Non-fast-forward rejection type-fails | Negative | behaviour | High | AC-F3-1 |
| TC-PUSH-004 | Protected-branch rejection type-fails | Negative | behaviour | High | AC-F3-1 |
| TC-PUSH-005 | Credential rejection type-fails | Negative | behaviour | High | AC-F3-1 |
| TC-PUSH-006 | Push timeout type-fails | Negative | behaviour | Medium | AC-F3-1 |
| TC-PUSH-007 | Parity still unmet after a landed push type-fails (no false `pr-open` from a stale re-read) | Corner Case | behaviour | High | AC-F3-1, AC-F1-2 |
| TC-PUSH-008 | Remote ahead of local type-fails; never a force push, never another ref | Negative | behaviour | High | AC-F3-1, AC-F1-2 |
| TC-PUSH-009 | Parity read unreadable: `state-unverified` exit 2, never the push-failure row | Edge Case | behaviour | High | AC-F3-1 (boundary), AC-F1-1 |
| TC-PUSH-010 | `pr-open-unverified`: precondition inapplicable, semantics unchanged | Edge Case | behaviour | Medium | AC-F1-1 (exclusion), AC-F2-1 (absent block) |
| TC-PUSH-011 | Resume of a recorded `pr-open` lane re-evaluates the precondition idempotently | Regression | conformance | High | AC-F1-1 |
| TC-PUSH-012 | Act contract: one attempt, no retry, fixed argv, non-shell, injectable timeout, upstream-only fast-forward | Corner Case | behaviour + structure | High | AC-F1-1, NFR-1, NFR-3 |
| TC-PUSH-013 | Defect pin: a divergent `pr-open` is impossible by construction | Regression | conformance + behaviour | High | AC-F1-2 |
| TC-PUSH-014 | `push:<verdict>` references reserved ahead of the slice, never truncated away | Corner Case | behaviour | High | AC-F2-1, NFR-5, DM-1 |
| TC-PUSH-015 | Envelope `push` block presence matrix: present iff the precondition evaluated, together-or-absent-together | Edge Case | structure + behaviour | High | AC-F2-1, DM-2 |
| TC-PUSH-016 | Envelope `push` block bounds: closed members, full-hex heads, ≤ 256 characters, no payload or credential | Corner Case | structure + behaviour | High | AC-F2-1, NFR-4, DM-2 |
| TC-PUSH-017 | Text mode four-key byte stability; `pr_url` retained; parity facts never enter text | Regression | golden | High | AC-F2-1, NFR-4 |
| TC-PUSH-018 | Pre-change attempts without `push:` references read unchanged; no fabricated parity facts | Regression | behaviour | Medium | AC-F2-1 (compat), §8.5 |
| TC-FAIL-001 | The new failure-token-mapping row end-to-end: row semantics, exposure counting, no divergence | Negative | conformance + behaviour | High | AC-F3-1, DM-3 |
| TC-FAIL-002 | PR URL retained in both output modes; data-bearing envelope shape, no top-level error | Negative | behaviour + golden | High | AC-F3-1 |
| TC-FAIL-003 | Vocabulary closure: exactly one mapping row and one reason literal added; no token, identity, kind, or error-table row | Regression | structure + checks | High | AC-F3-1, NG-2 |
| TC-LIVE-001 | AC-F4-1 post-merge live verification contract (traceable-but-executed-post-merge) | Manual | post-merge live | High | AC-F4-1 |
| TC-FALLBACK-001 | Shell-fallback divergence declared in the fallback rows and the operations guide | Manual | docs content check | Medium | AC-F5-1 |
| TC-BND-001 | Added cost bound: one extra parity read after a push; provider read classes unchanged; no new configuration key | Corner Case | behaviour | Medium | NFR-2, NFR-4 |
| TC-BND-002 | No-shell invariant covers the new push seam (static scan + battery inventory) | Corner Case | static + conformance | High | NFR-3 |
| TC-BAT-001 | Registry integration: new rows join the parity battery, determinism holds, proof boundary unchanged | Regression | conformance | High | AC-F1-1, AC-F3-1 (battery join) |

### 5.2 Scenario Details

#### TC-PUSH-001 - Clean parity: no push act, `pr-open` with `push:clean`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, AC-F2-1, DM-1, DM-2, NFR-1
**Test Type(s)**: Integration (real command path over injected seams), Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-push.test.ts` (registry row) mirroring a `tests/behaviour/dispatch-push-parity.test.ts` case; derivation at `packages/core/src/domain/dispatch-result.ts` (arm 8); composition in `packages/cli/src/commands/dispatch.ts`
**Tags**: @backend, @api

**Preconditions**:

- Injected truth: session completed with the `pr_creation` phase recorded, an open pull request with a resolved URL, branch commits present.
- Injected parity facts: local branch head SHA equals the pull request's head SHA (equal full-hex fixture literals).
- Injected push runner: records every invocation; expected invocation count is zero.

**Steps**:

1. Run `dispatch <ref> --json` through the real command path with the injected facts above.
2. Assert the envelope: `data.result` is `pr-open`, outcome success, exit `0`.
3. Assert the push runner recorded zero invocations — no push act on an already-parity branch.
4. Assert the attempt record carries exactly one `push:clean` evidence reference.
5. Assert the machine envelope carries the additive `push` block with `verdict: "clean"`, both heads, `parity: true`.
6. Assert text mode output remains the delivered four-key contract (with TC-PUSH-017's golden).

**Expected Outcome**:

- `pr-open` at exit 0 with zero push invocations, `push:clean` evidence, and a parity-true envelope block.

**Postconditions**:

- The attempt ledger gained exactly one attempt record; no divergence opened.

#### TC-PUSH-002 - Local ahead: one push, one re-read, `pr-open` with `push:pushed`

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, AC-F2-1, DM-1, DM-2, NFR-1, NFR-2
**Test Type(s)**: Integration (real command path over injected seams)
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-push.test.ts` (registry row) + `tests/behaviour/dispatch-push-parity.test.ts`; the defect case of the ticket, now reconciled
**Tags**: @backend, @api

**Preconditions**:

- Injected truth as TC-PUSH-001 (open pull request, URL resolved, evidence commit present).
- Injected parity facts: the first read reports the local head ahead of the pull-request head (fixture uses a two-commit-ahead gap, so the case does not lean on a one-commit coincidence); the post-push re-read reports equality.
- Injected push runner: the push succeeds (fast-forward accepted) and records argv, count, and call order.

**Steps**:

1. Run `dispatch <ref> --json`.
2. Assert the recorded call order is exactly: parity read → one push → one parity re-read → classification.
3. Assert `data.result` is `pr-open`, exit `0`.
4. Assert the attempt carries `push:pushed` evidence and the envelope block names both heads with `parity: true`.
5. Assert exactly one push invocation and exactly one re-read (NFR-2's per-case half).

**Expected Outcome**:

- The evidence commit is reconciled onto the PR head before classification; `pr-open` at exit 0 with `push:pushed` evidence.

#### TC-PUSH-003 - Non-fast-forward rejection type-fails

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-3, AC-F3-1, DM-3, NFR-1
**Test Type(s)**: Integration (real command path over injected seams)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-push-parity.test.ts`
**Tags**: @backend, @api

**Preconditions**:

- Injected parity facts: local head ahead; the pull request's head moved (an interleaved push landed remotely, per RSK-6).
- Injected push runner: rejects the push with a non-fast-forward outcome (fixture-injected; no real remote).

**Steps**:

1. Run `dispatch <ref> --json`.
2. Assert `data.result` is `failed`, outcome `failed`, exit `1` — never `pr-open`.
3. Assert exactly one attempt record with `push:failed` evidence.
4. Assert the comparison record is not-applicable with a null token and reason `push-parity-unmet`.
5. Assert the PR URL is retained in `data.prUrl` (machine) and `pr_url` (text, via TC-FAIL-002's golden).
6. Assert exactly one push invocation — no retry (NFR-1).

**Expected Outcome**:

- The typed failure row of spec Appendix B, verbatim, for the non-fast-forward class.

#### TC-PUSH-004 - Protected-branch rejection type-fails

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DM-3, RSK-2
**Test Type(s)**: Integration (real command path over injected seams)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-push-parity.test.ts`
**Tags**: @backend, @api

**Preconditions**:

- Injected parity facts: local head ahead.
- Injected push runner: rejects with a protected-branch outcome (fixture-injected).

**Steps**:

1. Run `dispatch <ref> --json`.
2. Assert the full TC-PUSH-003 assertion set (token, outcome, exit, one attempt, comparison reason, retained PR URL, single invocation).

**Expected Outcome**:

- The same typed failure row — the rejection classes share the single `push:failed` verdict per the spec's closed verdict set (richer per-cause disclosure is deferred, §7.3).

#### TC-PUSH-005 - Credential rejection type-fails

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DM-3, RSK-2
**Test Type(s)**: Integration (real command path over injected seams)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-push-parity.test.ts`
**Tags**: @backend, @api

**Preconditions**:

- Injected parity facts: local head ahead.
- Injected push runner: rejects with a credential/authentication rejection outcome (fixture-injected; the engine resolves no credential itself).

**Steps**:

1. Run `dispatch <ref> --json`.
2. Assert the full TC-PUSH-003 assertion set.
3. Assert no credential material, provider payload, or rejection text beyond the class enters the record or envelope (privacy bound per spec §21).

**Expected Outcome**:

- The same typed failure row; the evidence reference and envelope stay identifiers and SHAs only.

#### TC-PUSH-006 - Push timeout type-fails

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-3, AC-F3-1, NFR-1
**Test Type(s)**: Integration (real command path over injected seams)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-push-parity.test.ts`
**Tags**: @backend, @api

**Preconditions**:

- Injected parity facts: local head ahead.
- Injected push runner: the push never completes within the injected timeout (the runner reports the timed-out outcome; no wall-clock waiting — the injected recorder is the only time source, per battery convention).

**Steps**:

1. Run `dispatch <ref> --json` with the timeout injected at a small test value (injectable per NFR-1; no new configuration key).
2. Assert the full TC-PUSH-003 assertion set.

**Expected Outcome**:

- The typed failure row; the timeout is a failure-class input, not a hang and not a retry.

#### TC-PUSH-007 - Parity still unmet after a landed push type-fails (no false `pr-open` from a stale re-read)

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-3, AC-F3-1, AC-F1-2, RSK-4
**Test Type(s)**: Integration (real command path over injected seams)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-push-parity.test.ts`
**Tags**: @backend, @api

**Preconditions**:

- Injected parity facts: local ahead before the push; the push succeeds; the re-read still reports inequality (a stale or moved provider head — the RSK-4 direction).

**Steps**:

1. Run `dispatch <ref> --json`.
2. Assert the full TC-PUSH-003 assertion set — in particular that the classification is the typed failure, never a `pr-open` that trusts the pre-push inequality away or the stale re-read.

**Expected Outcome**:

- `pr-open` derives only from a readable equality: the adversarial direction (a good push betrayed by staleness) is an honest typed failure resolved by the next dispatch, per RSK-4 — never a false success.

#### TC-PUSH-008 - Remote ahead of local type-fails; never a force push, never another ref

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, F-3, AC-F3-1, NG-5, NFR-1
**Test Type(s)**: Integration (real command path over injected seams)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-push-parity.test.ts`
**Tags**: @backend, @api

**Preconditions**:

- Injected parity facts: the pull-request head is ahead of the local head before any push (a state a fast-forward push cannot resolve).

**Steps**:

1. Run `dispatch <ref> --json`.
2. Assert the full TC-PUSH-003 assertion set.
3. Assert the recorded push argv (if the act is attempted and rejected) contains no force-capable flag, names only the change branch and its configured upstream, and never names the base branch or any other ref — the NG-5 scope, pinned at the argv level.

**Expected Outcome**:

- The typed failure row; the engine has no force-capable variant and never widens the act's scope, even when only a force could reconcile.

#### TC-PUSH-009 - Parity read unreadable: `state-unverified` exit 2, never the push-failure row

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, AC-F3-1 (boundary), DM-3
**Test Type(s)**: Integration (real command path over injected seams)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-push-parity.test.ts`
**Tags**: @backend, @api

**Preconditions**:

- Injected truth: open pull request, URL resolved.
- Injected parity facts: the parity read is unreadable (the local-head read fails, or the delivery-request head fact is missing/unreadable) — the undecidable-truth direction, not a readable inequality.

**Steps**:

1. Run `dispatch <ref> --json`.
2. Assert `data.result` is `state-unverified`, exit `2` — the delivered undecidable-truth semantics.
3. Assert the attempt does NOT carry `push:failed` and the comparison reason is NOT `push-parity-unmet` — only a readable inequality or a rejected act is the typed failure.
4. Assert the attempt carries the delivered unreadable-truth evidence class (the same family the derivation uses for other unreadable reads) and no fabricated parity facts.
5. Assert zero push invocations — an unreadable read never triggers the act.

**Expected Outcome**:

- The boundary holds: `state-unverified` at exit 2 with undecidable-truth evidence; the new failure row is reserved for readable inequality or rejected acts.

#### TC-PUSH-010 - `pr-open-unverified`: precondition inapplicable, semantics unchanged

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-1, AC-F1-1 (exclusion), AC-F2-1 (absent block), DEC-5, RSK-3
**Test Type(s)**: Integration (real command path over injected seams)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-push-parity.test.ts`
**Tags**: @backend, @api

**Preconditions**:

- Injected truth: open pull request, URL unresolved (the delivered `pr-open-unverified` fixture shape: `pr: prOpen(null)`).
- Injected push runner: records invocations; expected count zero.

**Steps**:

1. Run `dispatch <ref> --json`.
2. Assert `data.result` is `pr-open-unverified`, exit `0`, `urlResolved: false` — the delivered semantics byte-for-byte.
3. Assert zero push invocations and zero parity reads attributed to the precondition — there is no pull-request head fact to compare (DEC-5).
4. Assert the machine envelope carries NO `push` block (the precondition never evaluated) — the absence direction of TC-PUSH-015's matrix.
5. Assert the attempt carries no `push:` evidence reference.

**Expected Outcome**:

- `pr-open-unverified` is untouched by the change; its residual risk stays the declared RSK-3, not a new failure mode.

#### TC-PUSH-011 - Resume of a recorded `pr-open` lane re-evaluates the precondition idempotently

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-1
**Test Type(s)**: Integration (real command path over injected seams), Conformance
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-push.test.ts` (extends the delivered `resume-pr-open-lane` scenario family from `tests/fixtures/dispatch/parity/lane.ts`)
**Tags**: @backend, @api

**Preconditions**:

- A seeded recorded `pr-open` lane in the real state store (the delivered resume fixture).
- Injected parity facts: heads equal (the branch was pushed since the recording) — the idempotent direction; a second variant injects local-ahead plus a successful push.

**Steps**:

1. Resume the lane through the real command path.
2. Assert the terminal classification re-evaluates the precondition: the parity read happens on the resumed classification too (the precondition binds every arm-8 classification, fresh or resumed).
3. Assert the equal-heads variant performs zero push invocations and zero spawns, keeping the delivered resume economics (no restart ordinal charged).
4. Assert the local-ahead variant performs exactly one push, then classifies `pr-open` with `push:pushed` evidence.
5. Assert the attempt evidence and envelope block follow TC-PUSH-001/002's shape.

**Expected Outcome**:

- A resumed lane can never close on a stale divergent head; the act is idempotent on an already-parity branch and the delivered resume contract is otherwise unchanged.

#### TC-PUSH-012 - Act contract: one attempt, no retry, fixed argv, non-shell, injectable timeout, upstream-only fast-forward

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, NFR-1, NFR-3
**Test Type(s)**: Integration (real command path over injected seams), Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-push-parity.test.ts` (+ the no-shell battery inventory via TC-BND-002)
**Tags**: @backend, @api

**Preconditions**:

- Injected parity facts: local ahead; the push runner records argv, count, and order, and refuses a requested shell or script path by name.

**Steps**:

1. Run one classification that performs the act.
2. Assert exactly one push invocation per classification across success and every rejection class (re-run TC-PUSH-003..008's recordings under this assertion): no retry ladder — a failed act is resolved by the next dispatch or an operator resume, never a second attempt in the same classification.
3. Assert the argv is fixed and literal: fast-forward-only (no force-capable flag), the change branch only, its configured upstream only, no base branch, no other ref, no extra refs R.
4. Assert the spawn is a literal non-shell child process (the injected runner's by-name refusal proves nothing asked it for a shell).
5. Assert the child timeout is injectable through the delivered seam (small test value), with 60 000 ms as the production default, and that no new configuration key appears on any path.

**Expected Outcome**:

- The act is bounded exactly as declared: one attempt, fixed argv, non-shell, injectable bounded timeout, change-branch-scoped, fast-forward-only — the RSK-1 mitigation pinned at the seam.

#### TC-PUSH-013 - Defect pin: a divergent `pr-open` is impossible by construction

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-2, DM-1 (the ticket's requirement 4)
**Test Type(s)**: Integration (real command path over injected seams), Conformance
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-push.test.ts` + `tests/behaviour/dispatch-push-parity.test.ts`
**Tags**: @backend, @api

**Preconditions**:

- The full injected outcome matrix: heads equal; local ahead + push succeeds + re-read equal; local ahead + each rejection class; local ahead + timeout; push landed + re-read unequal; remote ahead; parity read unreadable; URL unresolved.

**Steps**:

1. Drive every matrix cell through the real command path.
2. Assert the classification function is total over the matrix: every cell yields exactly one of {`pr-open` with parity-true evidence, the typed push failure, `state-unverified`, `pr-open-unverified`}.
3. Assert the defining property: NO cell yields token `pr-open` unless the last recorded parity observation was a readable equality — a `pr-open` classification with the local head ahead of the pull-request head is a defect by definition and this fixture fails on it.
4. Assert the call-order property on every `pr-open` outcome: parity read → (at most one push) → parity re-read → classification, so the precondition structurally precedes the token.

**Expected Outcome**:

- The owner-demanded pin ("a fixture proves a local-ahead state can never be classified `pr-open`") holds by construction: the divergent `pr-open` the ticket observed twice is unrepresentable in the injected fact space.

#### TC-PUSH-014 - `push:<verdict>` references reserved ahead of the slice, never truncated away

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-F2-1, NFR-5, DM-1
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-push-evidence.test.ts` (+ `tests/behaviour/dispatch-attempts-contract.test.ts` conventions)
**Tags**: @backend, @api

**Preconditions**:

- Injected scenarios for all three verdicts (`clean`, `pushed`, `failed`).
- A disclosure-stress fixture: an attempt whose evidence slice is filled toward the 16-reference budget (the delivered disclosure truncation shape).

**Steps**:

1. For each verdict, run the classification and read the attempt record.
2. Assert exactly one `push:<verdict>` reference per evaluating attempt, identifier-only (no provider payload, credential, or diff).
3. Assert the reference survives a disclosure that would otherwise truncate: with the slice full, the `push:` reference is still present in the rendered disclosure — the reservation ahead of the slice holds (NFR-5).
4. Assert the total reference count stays within the delivered 16-reference budget in every case.
5. Assert non-evaluating attempts (every token outside `pr-open` and the push failure) carry no `push:` reference.

**Expected Outcome**:

- Parity evidence is durable by construction: an operator reading the attempts digest sees the parity outcome per attempt even under a full evidence slice.

#### TC-PUSH-015 - Envelope `push` block presence matrix: present iff the precondition evaluated, together-or-absent-together

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-F2-1, DM-2, §8.5
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/dispatch-push-envelope.test.ts` + `tests/behaviour/dispatch-push-evidence.test.ts`
**Tags**: @backend, @api

**Preconditions**:

- One run per envelope outcome family: `pr-open` (clean and pushed), the typed push failure, and every non-evaluating token (`merged`, `blocked`, `finished`, `partial`, `failed` from a session outcome, `max-restarts`, `state-unverified`, `pr-open-unverified`, `noop-lane-*`).

**Steps**:

1. Render each outcome's machine envelope through the real command path.
2. Assert the `push` block is present exactly on the two evaluating outcomes (`pr-open` and the push failure) and absent on every other — absent on every outcome where the precondition did not evaluate.
3. Assert present-means-complete: when present, all four members (`verdict`, `localHead`, `remoteHead`, `parity`) are there — together-or-absent-together, no partial block, no extra members.
4. Assert key-order stability: the block is appended additively to the delivered envelope shape (the additive-only rule the delivered structure pins enforce).

**Expected Outcome**:

- Existing consumers are unaffected (spec §8.5): the block is a precise, closed, additive-optional signal of precondition evaluation.

#### TC-PUSH-016 - Envelope `push` block bounds: closed members, full-hex heads, ≤ 256 characters, no payload or credential

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-F2-1, NFR-4, DM-2, §21
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/dispatch-push-envelope.test.ts` + `tests/behaviour/dispatch-push-evidence.test.ts`
**Tags**: @backend, @api

**Preconditions**:

- The TC-PUSH-015 presence matrix; boundary-value head fixtures (the longest full-hex SHA form) and the three closed verdict values.

**Steps**:

1. Assert each member is single-line and value-bounded: `verdict` in {`clean`, `pushed`, `failed`}; `localHead` and `remoteHead` full-hex SHA literals; `parity` boolean.
2. Assert the serialized whole block stays within the delivered 256-character dispatch bound in every matrix cell.
3. Assert the block never carries provider payload, diff content, credential material, or prompt/transcript text (the delivered redaction and bounding at the serialization chokepoint unchanged).
4. Assert a fixture attempt to grow a member beyond the bound or add an undeclared member fails the structural pin.

**Expected Outcome**:

- The block is bounded, closed, and secret-free — the delivered additive-envelope precedent (Appendix D), mechanically enforced.

#### TC-PUSH-017 - Text mode four-key byte stability; `pr_url` retained; parity facts never enter text

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, NFR-4
**Test Type(s)**: Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/dispatch-text.test.ts` (+ `tests/golden/dispatch-errors.test.ts` via TC-FAIL-002)
**Tags**: @backend

**Preconditions**:

- The delivered committed goldens captured at the branch point for the `pr-open` and classified-failure cells; the parity-fact and push-outcome injections for the new cells.

**Steps**:

1. Re-render the delivered `pr-open` text cell over equal-heads and pushed-heads injections.
2. Assert byte-identity with the committed golden: the four-key contract is unchanged, and the parity facts do not enter text mode (no head SHA, no verdict word beyond the delivered keys).
3. Assert `pr_url` remains populated on the `pr-open` text output — including on the push-failure text output (TC-FAIL-002's golden cell).
4. Update goldens only by the explicit regeneration command if a deliberate declared change requires it; never by blanket rewrite (testing-strategy rule).

**Expected Outcome**:

- Text mode is byte-compatible (spec §8.5): a consumer parsing the four keys cannot tell the change landed except through the retained `pr_url` on a differently-typed failure.

#### TC-PUSH-018 - Pre-change attempts without `push:` references read unchanged; no fabricated parity facts

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-2, AC-F2-1 (compat), §8.5, §19
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-push-parity.test.ts` (joins the delivered pre-change-records-read-unchanged convention in `tests/conformance/dispatch/dispatch-parity-lane-resume.test.ts`)
**Tags**: @backend, @api

**Preconditions**:

- Seeded pre-change attempt records in the real state store shaped exactly as delivered today (no `push:` references, no `push` block).

**Steps**:

1. Read the seeded records through the delivered read surfaces (`dispatch attempts`, the attempts digest).
2. Assert the sixteen-field projection, order, and bounds are unchanged; no `push:` reference appears and no `push` block is synthesized.
3. Assert the digest and envelopes never fabricate parity facts for records that predate the change (absence stays absence).
4. Assert a mixed ledger (pre-change and post-change records) renders each record according to its own era.

**Expected Outcome**:

- Backward compatibility holds: history reads identically, and the reader invents nothing (spec §19).

#### TC-FAIL-001 - The new failure-token-mapping row end-to-end: row semantics, exposure counting, no divergence

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, DM-3
**Test Type(s)**: Integration (real command path over injected seams), Conformance
**Automation Level**: Automated
**Target Layer / Location**: `tests/conformance/dispatch/dispatch-parity-push.test.ts` (registry row) + `tests/behaviour/dispatch-push-parity.test.ts`
**Tags**: @backend, @api

**Preconditions**:

- Injected parity facts: local ahead; the push runner rejects (any class from TC-PUSH-003..007 — the row is one class, the fixtures are its inputs).

**Steps**:

1. Run the classification and assert the pinned row verbatim (spec Appendix B): result token `failed`, outcome `failed`, exit `1`, exactly one attempt record.
2. Assert the comparison record: not-applicable, comparison token null, reason exactly `push-parity-unmet` — the dispatch-derived failure takes a not-applicable comparison per the table's shape.
3. Assert the failure-row semantics inherited from the delivered table: it counts for class coverage as exposure (the gate's coverage evaluation includes it), makes no success claim, creates no divergence, and blocks nothing.
4. Assert no open divergence record is appended for the failure and no incident is recorded (it is honest, not unverifiable).
5. Assert the delivered failure-row dual-run/evidence posture is unchanged in shape (the counting change is the one declared class, §22).

**Expected Outcome**:

- One new failure class behaves exactly like the delivered failure rows in every dimension except its declared comparison reason.

#### TC-FAIL-002 - PR URL retained in both output modes; data-bearing envelope shape, no top-level error

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1
**Test Type(s)**: Integration, Golden
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-push-parity.test.ts` + `tests/golden/dispatch-errors.test.ts`
**Tags**: @backend, @api

**Preconditions**:

- The TC-FAIL-001 fixture.

**Steps**:

1. Assert the machine envelope is the delivered data-bearing shape for a recorded failure with no error identity: `data.result` and `data.outcome` present, no top-level `error`.
2. Assert `data.prUrl` is populated with the pull request's URL — the operator can reach the PR from the failure without re-deriving it.
3. Assert the text mode carries `pr_url` populated (golden cell pinned once in `tests/golden/dispatch-errors.test.ts`).
4. Assert the verbose human detail's scope is unchanged (the parity facts do not enter text mode; only the delivered detail-line scope applies).

**Expected Outcome**:

- The ticket's AC-2 wording holds exactly: a rejected push produces a typed non-`pr-open` result carrying the PR URL, in both output modes.

#### TC-FAIL-003 - Vocabulary closure: exactly one mapping row and one reason literal added; no token, identity, kind, or error-table row

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, AC-F3-1, NG-2, DM-3
**Test Type(s)**: Contract, Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/dispatch-contract-invariance.test.ts`, `tests/structure/dispatch-token-home.test.ts`, `tests/types/dispatch-contract.type-test.ts`
**Tags**: @backend

**Preconditions**:

- The delivered contract pins at the branch point (eleven tokens, projections, derivation classes, exits, attempt schema, error table, comparison vocabularies).

**Steps**:

1. Assert the failure-token mapping gained exactly one row — the lifecycle push failure of Appendix B — and every other row is byte-identical.
2. Assert the eleven-token vocabulary, projections, derivation classes, exits, and the corroboration requirement map are unchanged (NG-2/NG-7).
3. Assert no new error identity, no new domain kind, and no new error-table row exist; the sync checks (`scripts/checks/error-table-sync.ts`, `exit-code-literals.ts`) pass unchanged.
4. Assert the comparison record's optional reason vocabulary gained exactly the one declared literal `push-parity-unmet` and nothing else.
5. Assert the attempt schema gained no field (the evidence references and envelope block ride the existing shapes).

**Expected Outcome**:

- The closed vocabulary stays closed: the change is expressible as one mapping row plus one literal, and the delivered pins fail on anything more.

#### TC-LIVE-001 - AC-F4-1 post-merge live verification contract (traceable-but-executed-post-merge)

**Scenario Type**: Manual
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DEC-2
**Test Type(s)**: Manual (post-merge live verification)
**Automation Level**: Manual
**Target Layer / Location**: The change's pm-notes `notes:` trail (`doc/changes/2026-11/2026-11-23--GH-386--push-pr-evidence-before-pr-open/chg-GH-386-pm-notes.yaml`), recorded by the CEO/owner lane; evaluated by the DoD gate (phase 10)
**Tags**: @manual, @post-merge

**Preconditions**:

- The change is merged and the typed lane is the regular delivery path (spec F-4).
- No in-change execution: this case is NOT run during phases 6–9; the in-merge gates for the ticket's acceptance are TC-PUSH-001/002 (ticket AC-1), TC-FAIL-001/002 (ticket AC-2), and TC-PUSH-013 (requirement 4).

**Steps** (the contract, executed post-merge — not steps anyone executes in-change):

1. Observe the first two consecutive natural dispatches after the merge.
2. For each: assert the terminal classification is `pr-open` with the local head equal to the pull request's head and parity evidence present on the attempt (`push:` reference; envelope block parity-true).
3. Record both observations as the live verification in the pm-notes `notes:` trail.
4. DoD gate reading: the contract is satisfied when both observations are recorded with parity evidence; a `pr-open` classification that still diverges cannot pass silently — it surfaces as the typed failure of F-3 (TC-FAIL-001), which is itself the guard.

**Expected Outcome**:

- The ticket's AC-3 ("two consecutive real dispatches end with local == remote at `pr-open`") is satisfied under the DEC-2 contract: post-merge, evidence-recorded, owner override point at the open-PR review. The plan carries the contract traceably; the observation is the execution.

**Notes / Clarifications**:

- This is the declared satisfaction form (spec F-4, DEC-2, owner comment 2 on the ticket). Inventing in-change live-dispatch steps would commit the owner to two unsolicited deliveries — exactly what DEC-2 declines.

#### TC-FALLBACK-001 - Shell-fallback divergence declared in the fallback rows and the operations guide

**Scenario Type**: Manual
**Impact Level**: Minor
**Priority**: Medium
**Related IDs**: F-5, AC-F5-1, DEC-6, RSK-5
**Test Type(s)**: Manual content check (testing-strategy docs layer: traceability review, markdown/link check)
**Automation Level**: Manual
**Target Layer / Location**: `doc/spec/features/feature-autonomous-delivery.md` (fallback rows), the engine-first operations guide, and the declared doc-impact set of spec §7.1 (dispatch-engine page, quality-gates `pr_creation` cross-reference, verify-gates shared-parity note, `doc/quality/test-specs/test-spec-dispatch-engine.md` coverage map)
**Tags**: @manual, @docs

**Preconditions**:

- The documentation reconciliation of the change has landed (spec §7.1).

**Steps**:

1. Read the autonomous-delivery feature page's fallback rows and the engine-first operations guide.
2. Assert both declare that the parity precondition and ensure-push are typed-lane behavior and that the bash fallback keeps its delivered behavior (five-key summary tail, exits, current push conventions) with no engine-side parity enforcement — the divergence is declared, never silent (DEC-6).
3. Assert the dispatch-engine feature page documents the arm-8 precondition, the new failure-mapping row, the `push:` references, and the envelope block; the verify-gates page documents the shared parity definition (two consumers, one seam); the quality-gates page carries the `pr_creation` tail cross-reference.
4. Assert the dispatch-engine test-spec coverage map (`doc/quality/test-specs/test-spec-dispatch-engine.md`) names the new push-parity coverage rows and suites, joining this plan's output to the enduring map.
5. Run the content checks of the testing-strategy docs layer: markdown rendering, link/path integrity, `git diff --check`.

**Expected Outcome**:

- A reader of the fallback documentation is told, before relying on it, that it lacks the parity guarantee the typed lane now enforces — no silent drift (AC-F5-1).

#### TC-BND-001 - Added cost bound: one extra parity read after a push; provider read classes unchanged; no new configuration key

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-2, NFR-4, F-1
**Test Type(s)**: Integration (real command path over injected seams)
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-push-parity.test.ts` (joins the delivered read-budget recording-seam technique, e.g. `tests/behaviour/dispatch-attempts-bounds.test.ts` / merge read-budget proof conventions)
**Tags**: @backend, @api

**Preconditions**:

- A recording seam over the provider transport and the git child runner, counting reads by class.

**Steps**:

1. Run the equal-heads classification: assert the parity read adds at most its one bounded read and no new provider read class appears.
2. Run the local-ahead classification: assert exactly one extra bounded parity read after the performed push (one push, one re-read — nothing else added).
3. Assert the added wall-clock is bounded by construction: the push child timeout is the injected test value, and the re-read is one bounded read (no wall-clock assertions, per battery convention).
4. Assert no new configuration key exists on any path (the delivered configuration inventory unchanged).

**Expected Outcome**:

- The change's cost is exactly the declared bound: one push budget plus one bounded read, with the provider read surface unchanged in count and kind.

#### TC-BND-002 - No-shell invariant covers the new push seam (static scan + battery inventory)

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-3, NFR-1
**Test Type(s)**: Static invariant, Conformance
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/no-shell-dispatch.ts` + `tests/checks/no-shell-dispatch.test.ts` + `tests/conformance/dispatch/dispatch-parity-no-shell.test.ts`
**Tags**: @backend

**Preconditions**:

- The push act composed into the dispatch flow as an injected capability (spec §16: "like the delivered spawn identity, delay, and terminate bindings").

**Steps**:

1. Assert the static scan's declared dispatch-flow surface list covers the new push seam (the module/composition file is in the scanned set).
2. Plant a shell reference (a `shell: true` spawn, a script-path literal, a shell-capable import) in the new seam on a scratch branch of the check's fixture mechanism: the static invariant fails naming the planted reference (the delivered planted-reference-by-name convention).
3. Run the battery's no-shell suite over the registry including the new push rows: fixed argv, no shell, no script path, zero real child processes started by the battery's seams — the injected runner refuses a requested shell by name.

**Expected Outcome**:

- The precedent-setting write seam is under the same static no-shell regime as every declared dispatch-flow surface (NFR-3): the invariant's coverage is proven, not assumed.

#### TC-BAT-001 - Registry integration: new rows join the parity battery, determinism holds, proof boundary unchanged

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, F-3, AC-F1-1, AC-F3-1, §22
**Test Type(s)**: Conformance
**Automation Level**: Automated
**Target Layer / Location**: `tests/fixtures/dispatch/parity/cases.ts` + `tests/fixtures/dispatch/parity/evidence.ts` + `tests/conformance/dispatch/dispatch-parity-battery.test.ts` + the new owning suite `tests/conformance/dispatch/dispatch-parity-push.test.ts`
**Tags**: @backend, @api

**Preconditions**:

- The registry's designed evolution: `PARITY_GROUPS`/`PARITY_SEAMS` are closed constants extended by declaration (rows are "authored incrementally at first need, by the phase that owns the case") — this change declares its rows and, if needed, a `push-parity` group and a `push` seam.
- Updated delivered rows: `class-pr-open`, `resume-pr-open-lane`, and the loop rows that resolve `pr-open` gain injected parity facts (equal heads) so their delivered expectations hold under the new precondition.

**Steps**:

1. Assert every new push-parity row is a registry row in `cases.ts` (no suite re-expresses a scenario; no scenario is written twice) and each yields its declared token and exit exactly once through the real command path.
2. Assert the 11/11 class coverage is unchanged — the new failure class maps to the existing `failed` token, so the class table still names one row per taxonomy token; the new rows are non-class rows.
3. Assert the registry runs twice with identical envelopes and counts (`canonicalize` comparison) including the new rows.
4. Assert `PARITY_PROOF_BOUNDARY`'s proven/not-proven membership: a `push` seam joins the PROVEN surfaces (fixture-injected outcomes), and the NOT-PROVEN list is unchanged — the live transport stays outside the battery's claims, which is exactly why AC-F4-1 is a live contract.
5. Assert the import-identity manifest and seam-membership assertions hold for the new seam, and the suite reads no change artifact.

**Expected Outcome**:

- The offline battery remains the contract's proof surface (spec §22): the parity-precondition and push-failure classes are registry-proven rows, determinism holds, and the permanent boundary honestly separates fixture-proven from live behavior.

## 6. Environments and Test Data

- **Environment**: local dev only; `bun test` (or `pnpm test`) per the testing strategy. Gate evidence commands run with `TMPDIR=$PWD/tmp/tmpdir`. The aggregate `pnpm check` is the final verification; the narrow suites are for iteration.
- **Offline posture**: zero live network calls, zero real remotes, zero real child processes, zero wall-clock assertions in every case; the injected runner is the only push transport, the injected fact sources are the only truth, and the injected recorder is the only time source — the delivered parity-battery posture, extended to the push seam.
- **Injected facts**: full-hex fixture SHAs for local and pull-request heads; push outcomes as fixture values (`fast-forward-accepted`, `non-fast-forward-rejected`, `protected-branch-rejected`, `credential-rejected`, `timed-out`, `re-read-unequal`); the parity-read-unreadable condition injected at the read seam. Fixture SHAs and rejection payloads are deterministic literals committed with the fixtures.
- **Fixture locations**: push-outcome doubles and scenario builders under `tests/fixtures/dispatch/parity/` (extending the delivered `process-runner.ts` by-name shell refusal pattern with a push-outcome double, and the truth builders in `truth.ts` with head facts); registry rows in `cases.ts`; class-table and boundary constants in `evidence.ts`. Fixtures are never named `*.test.ts`; no fixture fabricates a command outcome — every observation is a real `runCli` invocation over injected seams.
- **Isolation**: each case uses the delivered temporary state-store root; two-run determinism compares canonicalized envelopes; suites stay isolated from the operator's real state directory and from any real checkout remote configuration. The static no-shell check runs against the declared surface list, with planted references exercised only through its fixture mechanism, never against the working tree.
- **Goldens**: committed goldens captured at the branch point govern TC-PUSH-017/TC-FAIL-002; updates happen only by the explicit regeneration command for a declared change, never a blanket rewrite.
- **Cleanup**: temporary stores and scenario roots disposed per case (the delivered `scenario.dispose()` convention); no case leaves ledger records in a real store.

## 7. Automation Plan and Implementation Mapping

| TC ID | Test file to create or update | Execution command | Mocking / injection requirements | Status |
|-------|-------------------------------|-------------------|----------------------------------|--------|
| TC-PUSH-001, TC-PUSH-002 | `tests/conformance/dispatch/dispatch-parity-push.test.ts` (new, registry rows) + `tests/behaviour/dispatch-push-parity.test.ts` (new) | `bun test tests/conformance/dispatch/dispatch-parity-push.test.ts && bun test tests/behaviour/dispatch-push-parity.test.ts` | Injected parity facts (equal / local-ahead) + recording push runner; real `runCli` and real state store | To Implement |
| TC-PUSH-003..TC-PUSH-008 | `tests/behaviour/dispatch-push-parity.test.ts` (new; six rejection/outcome cells) | `bun test tests/behaviour/dispatch-push-parity.test.ts` | Fixture-injected push outcomes per class; argv recording; no real remote | To Implement |
| TC-PUSH-009, TC-PUSH-010 | `tests/behaviour/dispatch-push-parity.test.ts` (new) | `bun test tests/behaviour/dispatch-push-parity.test.ts` | Unreadable parity read injected at the fact seam; `prOpen(null)` truth shape; zero-invocation recorder | To Implement |
| TC-PUSH-011 | `tests/conformance/dispatch/dispatch-parity-push.test.ts` (new rows extending the delivered resume scenario family in `tests/fixtures/dispatch/parity/lane.ts`) | `bun test tests/conformance/dispatch/dispatch-parity-push.test.ts` | Seeded recorded `pr-open` lane in the real store; equal-heads and local-ahead variants | To Implement |
| TC-PUSH-012 | `tests/behaviour/dispatch-push-parity.test.ts` (new) | `bun test tests/behaviour/dispatch-push-parity.test.ts` | Recording push runner with by-name shell refusal; injectable timeout value | To Implement |
| TC-PUSH-013 | `tests/conformance/dispatch/dispatch-parity-push.test.ts` + `tests/behaviour/dispatch-push-parity.test.ts` (new; the matrix sweep) | `bun test tests/conformance/dispatch && bun test tests/behaviour/dispatch-push-parity.test.ts` | Full injected outcome matrix; call-order recorder | To Implement |
| TC-PUSH-014 | `tests/behaviour/dispatch-push-evidence.test.ts` (new) | `bun test tests/behaviour/dispatch-push-evidence.test.ts` | Disclosure-stress evidence slice fixture; three verdict injections | To Implement |
| TC-PUSH-015, TC-PUSH-016 | `tests/structure/dispatch-push-envelope.test.ts` (new) + `tests/behaviour/dispatch-push-evidence.test.ts` (new) | `bun test tests/structure/dispatch-push-envelope.test.ts && bun test tests/behaviour/dispatch-push-evidence.test.ts` | One run per envelope outcome family; boundary-value head fixtures; structural pin on member growth | To Implement |
| TC-PUSH-017 | `tests/golden/dispatch-text.test.ts` (Existing – Update: new golden cells for the push outcomes; existing four-key goldens unchanged) | `bun test tests/golden/dispatch-text.test.ts` | Committed goldens; parity-fact injections; explicit regeneration only if a declared change requires | Existing – Update |
| TC-PUSH-018 | `tests/behaviour/dispatch-push-parity.test.ts` (new; joins the delivered pre-change-records convention) | `bun test tests/behaviour/dispatch-push-parity.test.ts` | Seeded pre-change attempt records (no `push:` references); read surfaces only | To Implement |
| TC-FAIL-001 | `tests/conformance/dispatch/dispatch-parity-push.test.ts` (registry row) + `tests/behaviour/dispatch-push-parity.test.ts` | `bun test tests/conformance/dispatch && bun test tests/behaviour/dispatch-push-parity.test.ts` | Rejection-class injections; coverage/exposure counting via the delivered gate evaluation path | To Implement |
| TC-FAIL-002 | `tests/behaviour/dispatch-push-parity.test.ts` + `tests/golden/dispatch-errors.test.ts` (Existing – Update: one new classified-failure golden cell) | `bun test tests/golden/dispatch-errors.test.ts` | The push-failure classification; committed golden pinned once | Existing – Update |
| TC-FAIL-003 | `tests/checks/dispatch-contract-invariance.test.ts`, `tests/structure/dispatch-token-home.test.ts`, `tests/types/dispatch-contract.type-test.ts` (all Existing – Update: extended additively with the one row + one literal) | `bun test tests/checks/dispatch-contract-invariance.test.ts && bun test tests/structure && bun test tests/types` | None beyond the delivered pins; the sync checks run unchanged | Existing – Update |
| TC-LIVE-001 | The change's pm-notes `notes:` trail (post-merge record) | n/a (post-merge observation by the CEO/owner lane) | None — live natural dispatches only | Manual Only |
| TC-FALLBACK-001 | The declared doc-impact set (spec §7.1) reviewed; `doc/quality/test-specs/test-spec-dispatch-engine.md` gains the coverage rows | Manual review + `git diff --check`; link/markdown check per the testing-strategy docs layer | None | Manual Only |
| TC-BND-001 | `tests/behaviour/dispatch-push-parity.test.ts` (new) | `bun test tests/behaviour/dispatch-push-parity.test.ts` | Recording transport seam counting provider reads by class; recording git child runner | To Implement |
| TC-BND-002 | `scripts/checks/no-shell-dispatch.ts` + `tests/checks/no-shell-dispatch.test.ts` + `tests/conformance/dispatch/dispatch-parity-no-shell.test.ts` (all Existing – Update: the surface list and battery inventory cover the new seam) | `pnpm check:no-shell && bun test tests/conformance/dispatch/dispatch-parity-no-shell.test.ts && bun test tests/checks/no-shell-dispatch.test.ts` | Planted shell reference via the check's fixture mechanism; the push-outcome double's by-name refusal | Existing – Update |
| TC-BAT-001 | `tests/fixtures/dispatch/parity/cases.ts` + `tests/fixtures/dispatch/parity/evidence.ts` (Existing – Update: new rows; declared group/seam extension; `class-pr-open`, `resume-pr-open-lane`, and the `pr-open`-resolving loop rows gain parity facts) + `tests/conformance/dispatch/dispatch-parity-battery.test.ts` assertions hold unchanged | `bun test tests/conformance/dispatch` | The registry's designed declaration mechanism; `canonicalize` two-run comparison | Existing – Update |

Broad Existing – Update note (touches several delivered suites at once): every delivered suite whose scenario resolves `pr-open` through the real command path — `tests/behaviour/dispatch-truth-derivation.test.ts`, the parity battery's `pr-open`-resolving rows, and any behaviour case that ends arm 8 — gains the injected parity facts (equal heads) so the delivered expectations hold under the precondition. This is a mechanical fixture-fact addition, not a re-pin; the delivered assertions are otherwise untouched.

Suite placement (where the new coverage joins the enduring map): precondition/act/failure/compat cases → `tests/behaviour/dispatch-push-parity.test.ts`; evidence/envelope/bounds cases → `tests/behaviour/dispatch-push-evidence.test.ts` and `tests/structure/dispatch-push-envelope.test.ts`; registry-proven rows → `tests/conformance/dispatch/dispatch-parity-push.test.ts`; contract closure → the delivered invariance/token-home/type suites; byte stability → the delivered golden suites; static invariant → the delivered no-shell check. The dispatch-engine test-spec coverage map (`doc/quality/test-specs/test-spec-dispatch-engine.md`) names each of these in its reconciliation (TC-FALLBACK-001 step 4).

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| The precondition's fixture-fact addition ripples into many delivered suites (every `pr-open`-resolving scenario needs injected parity facts), inflating the change's diff | M | The broad update is mechanical (equal-heads facts only); TC-BAT-001's two-run determinism and the unchanged delivered expectations prove nothing else moved; listed explicitly in §7 so phase 6 scopes it |
| A stale re-read could be misread as "the fix is flaky" when it type-fails a good delivery (RSK-4 direction) | M | TC-PUSH-007 pins the honest typed failure as the declared behavior; the failure retains the PR URL and resolves by re-dispatch, so the failure mode is operator-visible and recoverable by construction |
| The registry's closed `PARITY_GROUPS`/`PARITY_SEAMS` constants read as "unextendable" and the coder avoids adding rows | M | The registry header declares rows are "authored incrementally at first need, by the phase that owns the case"; TC-BAT-001 asserts the declaration mechanism and boundary membership, so extension is the designed path |
| The write seam escapes the no-shell regime because the static surface list is hand-declared | M | TC-BND-002 proves coverage with a planted-reference failure-by-name, and the battery inventory double-checks the seam at runtime |
| Golden drift: someone regenerates text goldens to accommodate parity facts leaking into text mode | H | TC-PUSH-017 asserts byte-identity against committed goldens and the testing-strategy rule forbids blanket rewrites; a parity fact in text mode is a spec violation (§8.5), caught here |
| The defect pin's matrix grows unmaintainably as outcomes multiply | L | The matrix is closed by the spec's declared path set (seven F-1 paths); TC-PUSH-013 sweeps exactly that closure, not an open-ended product |

### 8.2 Assumptions

- **Spec DEC-1 resolves the ticket's conditional.** Owner comment 1 allowed a "land the fixture only" branch if the composition already pushed; the spec's code-truth basis (Appendix A: no remote-write operation exists anywhere in the typed stack) declares the engine-side act as the mechanism, so this plan tests the declared act and carries TC-PUSH-013 as the owner-demanded pin. A separate "reproduced before the fix" case is not required: the ticket explicitly accepts the parity-guard outcome as honest.
- **The parity definition is shared, not re-derived.** The dispatch classification reuses the verify-gates `push-parity` computation (local head vs delivery-request head, full-hex equality); its delivered verify-gates suites stay authoritative for the definition itself, and TC-BND-001's read-class assertions cover the dispatch side only.
- **Timeout injectability reaches tests through the delivered child-runner seam** (the delivered pattern already declares injectable timeouts, 60 000 ms production default), so NFR-1's "injectable, no new configuration key" is testable without new configuration surface.
- **A `pr-open`-resolving scenario implies a configured upstream** (spec §12): the no-upstream path is undeclared behavior and is deliberately not tested; see OQ-2.
- **The failure row's "fails" enumeration reads broadly** — any non-successful act outcome (rejection, error exit, timeout, spawn-level failure) that is not an unreadable parity read lands in the row; see OQ-1.
- **Battery conventions transfer unchanged**: `TMPDIR=$PWD/tmp/tmpdir` evidence, deterministic UTC handling, `canonicalize` determinism, and the not-named-`*.test.ts` fixture rule apply to every new file.

### 8.3 Open Questions

| # | Question | Blocking? | Proposed resolution / owner |
|---|----------|-----------|------------------------------|
| OQ-1 | The spec's failure class enumerates "rejected, fails, times out, or parity remains unmet" but does not name a spawn-level act failure (for example the git binary missing or failing to start). Does that land in the push-failure row or elsewhere? | No — non-blocking; resolvable at implementation | Treat any non-successful act outcome as "fails" under the row (the row's semantics already cover an act that produces no parity); assert it once alongside TC-PUSH-012. If the delivered row semantics cannot express it, reopen the spec then — do not invent a second failure shape. Owner: `@pm` at the DoR gate; `@coder` asserts during phase 6. |
| OQ-2 | The spec assumes an open PR implies a configured upstream (§12); the no-upstream path is undeclared. Should a violation surface as the push failure row, or is it unreachable by construction? | No — the plan tests only declared behavior | Do not test the undeclared path in-change. If the coder finds a reachable unhandled path, record it as a deferred finding (spec §7.3 style) rather than a new failure class, and note it for the DoD gate. Owner: `@coder` observation, `@pm` disposition. |

Neither open question blocks the Definition of Ready: both have proposed resolutions that keep the closed vocabulary closed, and both convert into implementation-time assertions or recorded observations rather than new spec requirements.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-23 | @test-plan-writer (GLM-5.3-Flash) | Initial test plan: 26 cases (TC-PUSH-001..018, TC-FAIL-001..003, TC-LIVE-001, TC-FALLBACK-001, TC-BND-001..002, TC-BAT-001) covering AC-F1-1, AC-F1-2, AC-F2-1, AC-F3-1, AC-F4-1 (traceable-but-executed-post-merge per DEC-2), AC-F5-1; registry/battery integration declared via TC-BAT-001; two non-blocking open questions recorded (OQ-1, OQ-2). |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | — | Populated during phase 6/9 execution and quality gates; gate evidence recorded with `TMPDIR=$PWD/tmp/tmpdir`. TC-LIVE-001 is populated post-merge by the CEO/owner lane per DEC-2. |
