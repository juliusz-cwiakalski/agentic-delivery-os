---
id: TDR-0016
decision_type: tdr
status: Proposed
created: 2026-11-09
decision_date: null
last_updated: 2026-11-09
summary: "Add an additive streaming spawn starter (`HarnessSpawnStarter`/`HarnessSpawnStream`/`HarnessSpawnStreamOptions`) beside the unchanged one-shot `HarnessSpawnRunner`, so the opencode adapter acquires a session handle on the first JSONL line carrying a session identifier while `collect` resolves only at process close; the session port, the Claude Code adapter, and every closed vocabulary stay unchanged."
owners:
  - "Juliusz Ćwiąkalski"
service: delivery-os harness adapters
decision_scope: repo
review_date: null
classification:
  domains: [architecture, tooling]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: easy
  stakes: medium
  urgency: high
  uncertainty: low
  blast_radius: team
  recurrence: one-off
governance:
  driver: "@decision-advisor (routed from GH-275 readiness iteration 2, blocking finding B-3)"
  decider: "Juliusz Ćwiąkalski (owner; acceptance pending at the GH-275 PR review)"
  contributors:
    - "@spec-writer (chg-GH-275-spec v1.2 DEC-1/DEC-3/DEC-5 and Appendix B)"
    - "@readiness-reviewer (readiness iteration 2, finding B-3 — record-governed additive contract extension)"
    - "@decision-advisor (repository analysis and record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Owner (human final acceptance)"
  performers:
    - "@coder (GH-275 delivery)"
  informed:
    - "GH-275 opencode harness spawn fix"
    - "M1-S11 harness ports and delivery adapters"
    - "GH-239 dispatch engine (first production consumer)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A second harness needs streaming acquisition: promote the starter into the shared session surface deliberately (ADR-0008 DC-2 scope) instead of each adapter inventing its own stream seam."
  - "A real CLI changes the JSONL framing or moves the session identifier off top-level `sessionID` (or stops stamping the requested id on a resumed session): re-pin the decode contract and re-run this record's evidence precedence."
  - "An operationally necessary session bound emerges (hard-stalled sessions that progress-based liveness plus the restart budget cannot terminate): add an injected and, only then, configured session bound; never reintroduce a fixed minute-scale process cap."
  - "The seam becomes consumer-visible — an engine, the session port, or a conformance surface needs `lines`, `completion`, or `kill`: that is an engine-neutrality question (ADR-0008 C-1/DC-2) and needs an ADR-level decision, not another additive extension."
  - "A stream fact would require a new `HarnessEvidence` field or a new failure code: reopen with TDR-0010 and the delivered classification floor rather than widening the evidence shape here."
links:
  related_changes: ["GH-275"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-08--GH-275--opencode-harness-contract/chg-GH-275-spec.md"
    - "doc/spec/features/feature-harness-adapters.md"
  contracts:
    - "packages/core/src/contracts/harness.ts"
    - "packages/adapters/src/host/index.ts"
    - "packages/adapters/src/harness/opencode.ts"
    - "packages/core/src/app/dispatch.ts"
  diagrams: []
  decisions: ["ADR-0008", "TDR-0008", "TDR-0010"]
  experiments: []
  metrics: []
  roadmap_items: ["M1-S11"]
---

# TDR-0016: Additive Harness Streaming Spawn Seam (`HarnessSpawnStarter`)

## Context

- **FACT:** The harness contract's injected child-process seam is completion-gated. `HarnessSpawnRunner` is `(file, args, {cwd, env, timeout, stdin?}) => Promise<HarnessSpawnRunnerResult>`, and `HarnessSpawnRunnerResult` carries `stdout`, `stderr`, `status`, and `timedOut` — there is no partial-result or line surface (`packages/core/src/contracts/harness.ts` lines 315–333, read 2026-11-09).
- **FACT:** The session port already promises the opposite sequencing: `HarnessSessionPort.spawn` returns `Promise<HarnessResult<HarnessSessionHandle>>` and `collect` separately returns `Promise<HarnessResult<HarnessEvidence>>` (`packages/core/src/contracts/harness.ts` lines 367–379, read 2026-11-09). The port shape is correct; the seam under the opencode adapter cannot express it.
- **FACT:** The opencode adapter decodes stdout with a single `JSON.parse(result.stdout)` and resolves the identifier only from `session.id`, `sessionId`, or `id`; the real `opencode run --format json` stream is JSONL with a top-level `sessionID`, so the parse throws, `parsed` stays `undefined`, and every spawn returns `harness.spawn.invalid-output` or `harness.spawn.refused` (`packages/adapters/src/harness/opencode.ts` lines 143–163, `sessionIdOf` lines 95–103, read 2026-11-09).
- **FACT:** `DEFAULT_TIMEOUT_MS = 300_000` is applied to spawn, resume/deliver, and session listing, and `collect` returns the stored evidence captured at spawn time (`packages/adapters/src/harness/opencode.ts` lines 76, 127, 130–186, 246–254, read 2026-11-09). A real lifecycle session runs for hours, so a completion-gated spawn under a five-minute cap cannot ever succeed.
- **FACT:** There is exactly one host child-process site for the harness seam: `packages/adapters/src/host/index.ts` imports `node:child_process`, buffers stdout to `MAX_OUTPUT_BYTES = 16 * 1024 * 1024`, and enforces `options.timeout` with `child.kill("SIGTERM")` plus a `timedOut` flag (lines 10–13, 47–65, read 2026-11-09). Its site is a pinned entry in the exact repository allowlist (`tests/structure/harness-imports.test.ts` lines 24–37, read 2026-11-09).
- **FACT:** Dispatch collapses any spawn/resume failure into `dispatch.session.spawn-failed` with `lastMessage: "spawn failed before a session existed"` (`packages/core/src/app/dispatch.ts` lines 451–484, read 2026-11-09), and starts its progress-based liveness watch only after `spawn` resolves (`collectPromise` and the watch start after line 486). A completion-gated spawn therefore makes the watch unreachable during the session.
- **FACT:** The delivered substrate rule is that harness logic lives behind adapters, capability gaps are declared, and no engine branches on a runtime (`doc/decisions/ADR-0008-harness-adapter-contract.md` C-1, DC-2). The delivered adapter/session contract and host-runner semantics are stated in `doc/spec/features/feature-harness-adapters.md` (§2, §3, and the F-9 review-deferral note at lines 241–257, read 2026-11-09).
- **FACT:** Adapter-contract evolution in this repository is additive-within-v1 and decision-record governed; TDR-0008 states the rule and itself is the record for the prior additive round (`doc/decisions/TDR-0008-additive-adapter-contract-extensions-closeout-v1.md` line 91, `rigor: R2`). GH-275 adds types to `packages/core/src/contracts/harness.ts`, which is the class that rule covers, so a record is required.
- **FACT:** The GH-275 readiness gate raised exactly this as blocking finding B-3 and offered two remediations: author the record, or argue that the seam is not an adapter-contract change (`doc/changes/2026-11/2026-11-08--GH-275--opencode-harness-contract/readiness/readiness-iter-2.md` lines 64–71, read 2026-11-09).
- **Scope note:** The seam is written in `packages/core/src/contracts` (a contract type), but the design is engine-invisible and adapter-local in effect: the port is unchanged, no operation is added, no capability is declared, and no consumer learns about the starter. This record captures that seam; it does not re-open the change's design (GH-275 DEC-1/DEC-3/DEC-5), and it does not decide the JSONL decode rules themselves.

## Problem Framing (Clarified)

The defect is a **seam mismatch**, not a parser bug. The port models a two-phase lifecycle — handle first, evidence later — while the only injected I/O seam models a one-phase call that resolves at process exit. The adapter cannot satisfy the port's contract with the seam it is given, so it fakes the missing phase by parsing a completed stdout buffer.

Three sub-problems follow from that, and they must be answered together:

1. **Acquisition versus completion.** Something must expose the stream incrementally so the adapter can return a handle on the first identified line, while still owning a completion promise so `collect` cannot return in-flight or fabricated evidence.
2. **Blast radius.** The opencode adapter is broken; the Claude Code adapter and the read-only session listing are healthy. Whatever seam is added must not force those consumers onto a streaming model or change the runner's delivered shape.
3. **Failure and evidence honesty.** The pre-session failure vocabulary is closed, the evidence shape is fixed, and the classifier is shared. A seam that invents a result token, a failure code, or an evidence field to describe "a stream" would break the delivered classification floor for a bug fix.

The governing question is therefore not "how do we read JSONL?" but **"where does an incremental child-process seam belong so that one adapter gains streaming without moving the contract that every other consumer already relies on?"**

## Constraints (Hard Requirements)

> **Table stakes:** every alternative keeps the deny-by-default execution environment, credential-reference handling, stdin prompt delivery, the persisted state shape, the configuration surface, and the existing transport/network boundaries unchanged — acknowledged once rather than per alternative.

| ID | Pass/fail requirement | Source | Verification | Negotiable |
|---|---|---|---|---|
| C-1 | Contracts-tier neutrality: any new type is type shape only in `core ./contracts` — no behavior, clock, I/O, stream runtime, or ambient environment enters that module. | ADR-0003 DEC-2; `doc/spec/features/feature-harness-adapters.md` §2 | `tests/structure/port-neutrality.test.ts`, `tests/structure/harness-neutrality.test.ts`, code review | no |
| C-2 | Single harness child-process site: any stream implementation lives in `packages/adapters/src/host/index.ts`, and the exact `node:child_process` allowlist equality is unchanged — no second site. | `doc/spec/features/feature-harness-adapters.md` line 144 and §6; NFR-4 | `tests/structure/harness-imports.test.ts` allowlist equality | no |
| C-3 | Closed vocabularies unchanged: no new `HARNESS_FAILURE_CODES` member, no new `HARNESS_OUTCOMES` value, no new delivery-result token, no new `HarnessEvidence` field, no classifier change. | GH-275 NG-2/NFR-3; TDR-0010 projection | Contract/vocabulary probes; classifier conformance | no |
| C-4 | Delivered shapes unchanged: `HarnessSessionPort` keeps `spawn → handle` and `collect → evidence`; `HarnessSpawnRunner` and `HarnessSpawnRunnerResult` stay byte-identical so the Claude Code adapter needs no change; no engine gains a harness-specific branch. | ADR-0008 C-1/DC-2; GH-275 NG-1/NG-4/G-7 | Type tests; `dispatch-composition` and Claude suite unchanged; dependency-cruiser boundaries | no |
| C-5 | No parallel surface and no runtime-private storage read: acquisition comes from the process stream the adapter started, never from polling a harness's private session store and never from a second execution path. | ADR-0008 C-5 (no private-store scraping) extended to the spawn path; ADR-0003 DEC-6 | Code review; no store read on the spawn path | no |
| C-6 | Truthful evidence and no fabricated handle: a handle exists only for a real identified session; completion is never inferred from a detach, a synthetic id, or a bare exit 0; the delivered legacy single-document `result` envelope's facts stay authoritative and the host `exitStatus`/`timedOut` merge on top. | GH-275 F-4/DEC-5, AC-F1-7, AC-F4-1…AC-F4-4, AC-F1-3 | `tests/fixtures/harness/scenarios/classification.ts` six-case floor; `TC-HARN-010`; stream evidence cases | no |
| C-7 | The change's acceptance criteria become satisfiable: a handle is returned before completion (AC-F2-1/AC-F2-2), a real multi-hour session is not capped (AC-F5-3/NFR-2), and one real dispatch reaches classification instead of `dispatch.session.spawn-failed` (AC-F8-1). | GH-275 AC-F2, AC-F5, AC-F8 | Behaviour suite with a virtual-clock fake starter; one bounded real dispatch | no |

## Decision Drivers

1. **Handle availability before completion (the defect).** The port's two-phase contract must become expressible; this is the only driver that the current state fails outright.
2. **Blast-radius containment (reversibility).** The Claude adapter, read-only session listing, and dispatch must be untouched; a bug fix must not become a migration.
3. **Engine neutrality.** No engine may learn about streams, lines, or harness kinds (ADR-0008 C-1/DC-2).
4. **Evidence and vocabulary honesty.** Classification must remain one shared decision over a fixed evidence shape.
5. **Operational safety.** No orphaned children, no unbounded memory, and no arbitrary minute-scale cap on a real lifecycle.
6. **Minimal additive surface (paved road).** One narrow seam beside the delivered one, following the additive-within-v1 precedent (ADR-0004/ADR-0006/TDR-0008).
7. **Deterministic testability.** Acquisition and completion must be assertable offline with no wall-clock race and no real CLI invocation.
8. **Solo-maintainer cost.** One composition binding, one host implementation, no new configuration key, no new vocabulary.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-275 readiness iteration 2, finding B-3 routes the call here).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at GH-275 PR review. AI does not accept this R2 record.
- **Contributors:** `@spec-writer` (DEC-1/DEC-3/DEC-5, Appendix B type sketch); `@readiness-reviewer` (B-3 governance finding); `@decision-advisor` (repository analysis and record).
- **Required reviewers:** `@readiness-reviewer` and `@reviewer` on GH-275; the owner for final acceptance of this record.
- **Performers:** `@coder` (contract types, host starter, opencode adapter migration, composition binding, tests).
- **Informed:** GH-275, M1-S11, and GH-239 (the first production consumer of the session port).

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| `HarnessSpawnRunner` resolves only at process close and carries no line surface. | FACT | `packages/core/src/contracts/harness.ts` lines 315–333 (read 2026-11-09) | The seam would already exist; the decision is void. | High |
| `HarnessSessionPort` already separates `spawn` (handle) from `collect` (evidence). | FACT | `packages/core/src/contracts/harness.ts` lines 367–379 (read 2026-11-09) | A port change would be in scope, which is a different (ADR-level) decision. | High |
| The opencode adapter decodes stdout with one `JSON.parse` and applies a 300 s cap to spawn and resume. | FACT | `packages/adapters/src/harness/opencode.ts` lines 76, 143–163 (read 2026-11-09) | If a streaming seam already existed, DEC-1 of GH-275 would be unnecessary. | High |
| `packages/adapters/src/host/index.ts` is the harness seam's only child-process site, and the allowlist equality test pins the repository-wide set. | FACT | `packages/adapters/src/host/index.ts` lines 10–13; `tests/structure/harness-imports.test.ts` lines 24–37 (read 2026-11-09) | A second site would be admissible, weakening C-2. | High |
| The real CLI emits JSONL with a top-level `sessionID` and blocks until the session completes. | FACT | GH-275 §2.1 observed `opencode v2.2.5` probe; `scripts/opencode-session.sh` precedent; GH-275 §8.4 (read 2026-11-09) | The acquisition trigger would be wrong; the JSONL rules would need re-pinning. | High |
| The terminal `step_finish` completion encoding is `part.reason === "stop"`; failure encodings are `tool_use` with `part.state.status === "error"` and an `error` event. | FACT (v2.2.5) / TO-CONFIRM (other versions) | GH-275 §8.4 and DEC-5; installed v2.2.5 emitter | A version change would re-open the decode contract, not the seam. | Medium-High |
| The legacy single-document `result` envelope must remain authoritative to keep the delivered classification floor green. | FACT | `tests/fixtures/harness/scenarios/classification.ts` (six cases); `tests/behaviour/harness-opencode-session.test.ts` `TC-HARN-010`; `packages/adapters/src/harness/opencode.ts` lines 105–116 (read 2026-11-09) | Rewriting the floor would be a delivered-contract change (C-4/C-6 violation). | High |
| Claude Code needs no stream because it spawns headlessly and collects once-through. | FACT | `packages/adapters/src/harness/claude.ts` line 66, 158 (read 2026-11-09); `doc/spec/features/feature-harness-adapters.md` §3 | Claude would have to adopt the seam, raising cost and risk. | High |
| `opencode run --session <id>` stamps the requested id onto every event, so a resume identifier mismatch is only reachable if the CLI contract changes. | ASSUMPTION | GH-275 DEC-2 / AC-F3-3 (defence-in-depth framing) | The identity guard becomes load-bearing instead of defence-in-depth. | Medium |
| No second harness needs streaming acquisition in the current milestone. | ASSUMPTION | M1-S11 scope; both delivered adapters | A second streaming harness would trigger the first revisit trigger. | Medium |
| A bounded handle-acquisition wait (60 s default) is sufficient for a healthy local CLI, and no whole-session bound is needed by default. | ASSUMPTION | GH-275 DEC-3, NFR-1; observed first-event latency under 5 s | A slower startup would produce false pre-session refusals; the bound is injected and adjustable. | Medium-High |

## Mental Models & Techniques Used

- **First principles:** What does the port need? A handle at time T₀ and evidence at T₁ > T₀. Therefore the seam must expose two time phases. A promise that resolves only at T₁ structurally cannot provide T₀.
- **Inversion:** What would make this change unsafe? Fabricating a handle (breaks classification), changing the runner everyone else uses (breaks Claude and listing), inventing a token or evidence field (breaks the shared classifier), or killing a healthy multi-hour session (reintroduces the defect at a larger number). Each is excluded by C-4, C-6, C-3, and C-7.
- **Second-order thinking:** An additive seam does not ripple: the port, the classifier, the failure vocabulary, the composition shape of the Claude adapter, and dispatch all stay put. Reshaping the runner ripples into every composition fixture and forces an unnecessary model on a harness that has no streaming need.
- **Opportunity cost:** The cheapest correct option is the one that leaves the maximum amount of delivered contract untouched. That is the additive starter, not a runner rewrite.
- **Systems thinking / single boundary:** Keeping the stream inside the one host child-process site preserves the invariant that the adapter never spawns and never reads ambient environment — the boundary is what makes the change auditable.
- **KISS / least privilege:** One narrow seam (lines, completion, acquired, kill) and nothing else. No event vocabulary, no per-event telemetry, no configured bound, no kill operation on the port.
- **Reversibility:** the seam is removable while it has one consumer; the type is additive, the host implementation sits beside the delivered one, and reverting means restoring the opencode adapter's prior call — no persisted state, no migration.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 neutrality | C-2 one site | C-3 vocabularies | C-4 shapes unchanged | C-5 no private store | C-6 truthful evidence | C-7 AC satisfiable |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 do nothing (one-shot only) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| ALT-1 reshape `HarnessSpawnRunner` into a streaming-only seam | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| ALT-2 keep the runner and poll the session store for the id | ✅ | ✅ | ✅ | ✅ | ❌ | ⚠️ | ❌ |
| ALT-3 detach the child and return a synthetic id | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| ALT-4 additive streaming starter (chosen) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Legend: ✅ passes · ❌ fails · ⚠️ passes only via an accepted-risk exception (requires `Negotiable: yes`; none of C-1…C-7 is negotiable, so ⚠️ is recorded for diagnosis only and does not rescue an alternative).

### Alternative 0 — Do Nothing / Keep the Completion-Gated Runner

- **Eligibility:** Not eligible (fails C-7).
- **Summary:** Ship no seam; the opencode adapter keeps the single `JSON.parse` and the 300 s cap, and dispatch keeps failing on a healthy CLI.
- **Constraint compliance:** Passes C-1…C-6 trivially by changing nothing; fails C-7 because AC-F2-1/AC-F2-2 (handle before completion), AC-F5-3 (no 300 s session cap), and AC-F8-1 (a real dispatch reaches classification) cannot be satisfied.
- **Driver fit:** Fails driver 1 outright and serves driver 2 vacuously; every other driver is moot because the change delivers nothing.
- **Pros:** Zero contract change; zero ripple; zero new surface.
- **Cons:** The typed delivery path stays unusable on the production harness; liveness over a running session stays unobservable; the ticket's acceptance is unmet.
- **Why rejected:** It fails the change's own acceptance criteria and leaves the defect in place.

### Alternative 1 — Reshape `HarnessSpawnRunner` into a Streaming-Only Seam

- **Eligibility:** Not eligible (fails C-4).
- **Summary:** Replace `HarnessSpawnRunner` with the streaming shape so one seam serves everything; migrate the opencode adapter, the session-listing path, the Claude adapter, the host implementation, and every composition fixture to the stream.
- **Constraint compliance:** Passes C-1, C-2, C-3, C-5, C-6, C-7; fails C-4 — `HarnessSpawnRunner`/`HarnessSpawnRunnerResult` would no longer be byte-identical, the Claude adapter would need a rewrite it has no need for, and session listing would be expressed as a stream it does not require.
- **Driver fit:** Weak on driver 2 (blast radius explodes), driver 6 (not additive), and driver 8 (migration cost across all fixtures); neutral on driver 1.
- **Pros:** One seam instead of two; conceptually tidy.
- **Cons:** Changes a delivered contract for a bug fix; forces an unnecessary model onto a healthy adapter and a read-only listing path; touches every composition site; hard to reverse once adapters migrate.
- **Why rejected:** A defect fix must not widen into a delivered-contract migration. The streaming need is opencode-only.

### Alternative 2 — Keep the One-Shot Runner and Poll the Session Store for the Identifier

- **Eligibility:** Not eligible (fails C-5, C-7).
- **Summary:** Leave the runner and the contract untouched; after starting the child, read the harness's private session store in a bounded loop until a new session id appears, then synthesise the handle.
- **Constraint compliance:** Passes C-1, C-2, C-3, C-4; fails C-5 (a runtime-private storage read and a parallel out-of-band acquisition path); fails C-7 — acquisition would race the store's first write, so AC-F2-1's determinism and AC-F3-1's identity preservation are not met. The ⚠️ on C-6 is diagnostic only: association of a store row to *this* child is heuristic, which weakens the no-fabricated-handle guarantee even if it does not always violate it.
- **Driver fit:** Fails driver 1 (acquisition becomes a race), driver 5 (an extra filesystem path with its own failure modes), and driver 7 (a store read is not hermetically assertable without a real store).
- **Pros:** No contract change at all; no new host implementation.
- **Cons:** Reads runtime-private storage the adapter does not own; races the first write; ties the adapter to a store layout the CLI can change; duplicates the truth already present in the stream; adds an out-of-band path the port does not describe.
- **Why rejected:** It buys contract stability with a private-storage dependency and a race, which is both a boundary violation and a correctness regression.

### Alternative 3 — Detach the Child and Return a Synthetic Identifier

- **Eligibility:** Not eligible (fails C-4, C-6, C-7).
- **Summary:** Start the process detached with inherited stdio, immediately return a handle built from a generated id (or the work-item ref), and let `collect` classify from whatever the process leaves behind.
- **Constraint compliance:** Passes C-1, C-2, C-3, C-5; fails C-4 (the port's `collect` would have no owned process to await and would have to read external state); fails C-6 (a synthetic id is a fabricated handle, and completion would be inferred rather than observed); fails C-7 (AC-F1-1 requires the real `sessionID` as `sessionId` and `treeRoot`, and AC-F8-1 requires a real classification).
- **Driver fit:** Fails driver 4 decisively, and driver 5 (detached children are the orphan risk the change is trying to avoid).
- **Pros:** Trivial to write; no seam at all.
- **Cons:** Fabricated identity, unattributable evidence, orphaned processes, and a broken classification chain.
- **Why rejected:** It converts an honest failure into a false success — the exact failure class the closed vocabulary and shared classifier exist to prevent.

### Alternative 4 — Additive Streaming Starter Beside the Unchanged One-Shot Runner (chosen)

- **Eligibility:** Eligible.
- **Summary:** Add three types to the contracts tier — `HarnessSpawnStreamOptions` (`cwd`, `env`, `stdin?`, `handleTimeoutMs`, `sessionTimeoutMs?`), `HarnessSpawnStream` (`lines`, `completion`, `acquired`, idempotent `kill`), and `HarnessSpawnStarter` — implemented once as `createHostSpawnStarter` beside the unchanged `createHostSpawnRunner` in `packages/adapters/src/host/index.ts`. The opencode adapter uses the starter for spawn/resume/deliver and keeps the one-shot runner for read-only session listing; Claude Code receives only the one-shot runner; the session port is unchanged, so dispatch is unchanged.
- **Constraint compliance:** Passes C-1…C-7 (matrix above). The types are type-only (C-1); the implementation stays in the single host site (C-2); no vocabulary grows (C-3); the runner, port, and Claude path are byte-identical (C-4); acquisition comes from the adapter's own process stream (C-5); the legacy envelope keeps precedence and the host facts merge on top (C-6); and the ACs of F-2, F-5, and F-8 become satisfiable (C-7).
- **Driver fit:** Best on every driver: it is the only eligible option, and among eligible-shaped options it leaves the largest delivered surface untouched.
- **Pros:** Handle-before-completion becomes expressible without touching the port; the Claude adapter and session listing are untouched; the single child-process site and the 16 MiB bound are preserved; the deliverable is testable offline with a virtual-clock fake starter; acquisition is bounded while the session is not; `kill` is idempotent and owned by the seam.
- **Cons:** Two injected seams now exist for the harness adapters, so composition must pass the right one to the right consumer; the opencode adapter holds a per-session completion promise, which adds one in-memory record per live session; the starter is one more thing to keep in sync if a future harness needs streaming.
- **Why chosen:** It is the only alternative that satisfies every hard requirement and all seven reachable acceptance criteria while keeping a bug fix's blast radius inside one adapter, one host module, and one composition binding.

## Decision

- **Decision:** Adopt **ALT-4**, the additive streaming spawn seam. Add `HarnessSpawnStreamOptions`, `HarnessSpawnStream`, and `HarnessSpawnStarter` to `packages/core/src/contracts/harness.ts` as type-only additions, and implement `createHostSpawnStarter` in `packages/adapters/src/host/index.ts` beside the unchanged `createHostSpawnRunner`. The opencode adapter drives spawn, resume, and deliver through the starter and keeps the unchanged `HarnessSpawnRunner` for read-only session listing. The Claude Code adapter keeps the one-shot runner. `HarnessSessionPort`, `HarnessSpawnRunner`, `HarnessSpawnRunnerResult`, `HarnessEvidence`, `HARNESS_FAILURE_CODES`, and `HARNESS_OUTCOMES` stay unchanged.
- **Lifecycle semantics (part of the decision):**
  - Handle acquisition is separated from session completion. The stream exposes `acquired()`, which the adapter calls on the first decoded line carrying a session identifier; the handle is returned at that point. `collect` awaits the stored `completion` promise and resolves only at process close or error.
  - `handleTimeoutMs` bounds acquisition only (default `60_000` ms). `sessionTimeoutMs` is optional and absent or `0` means unbounded; no whole-session cap exists by default. Progress-based liveness and the restart budget remain the operational termination controls.
  - `kill` is idempotent and is called on every failed or abandoned acquisition; the host sends `SIGTERM` and escalates to `SIGKILL` after a short grace period.
- **Evidence precedence (part of the decision, unchanged from GH-275 DEC-5):** a legacy single-document `result` envelope's facts remain authoritative; otherwise the JSONL rules apply — completion only from exit 0 plus a terminal `step_finish` with `part.reason === "stop"`, `toolFailure` from a `tool_use` part with `part.state.status === "error"`, and `failureReported` from an `error` event (plus the legacy `result.failure`/`result.status` facts). Host `exitStatus` and `timedOut` merge on top in both cases.
- **Rationale (tied to drivers):** A two-phase port needs a two-phase seam (driver 1). Placing the new seam *beside* the delivered one, rather than in place of it, is what keeps the Claude adapter, session listing, dispatch, the vocabulary, and the evidence shape untouched (drivers 2, 3, 4, 6). Implementation stays in the single host module, so the runtime boundary and memory bound are preserved (drivers 3, 5). The seam is injected, so acquisition and completion are assertable deterministically without a real CLI (driver 7), and there is one composition binding and no new configuration key (driver 8).
- **Decider:** Juliusz Ćwiąkalski (owner).
- **Authorization:** Status `Proposed`. Human acceptance is recorded at GH-275 PR review; AI does not accept this R2 record and grants no authority until then.
- **Conditions for revisit:** See `revisit_triggers`; the first GH-275 post-implementation retrospective confirms the acquisition bound and the retained legacy precedence.

### Constraint Compliance Attestation

The chosen alternative (ALT-4) satisfies every constraint C-1 through C-7. No accepted-risk exceptions are taken and no constraint is violated.

| Constraint | Attestation |
|---|---|
| C-1 | The three additions are `type` declarations in `packages/core/src/contracts/harness.ts`; the implementation is in the adapters tier, so the contracts module stays type-only. |
| C-2 | `createHostSpawnStarter` is added to `packages/adapters/src/host/index.ts`; the `node:child_process` allowlist equality keeps the same site count. |
| C-3 | No member is added to `HARNESS_FAILURE_CODES`, `HARNESS_OUTCOMES`, the classification tokens, or `HarnessEvidence`; pre-session failures reuse `harness.spawn.refused` / `harness.spawn.invalid-output` / `harness.session.unknown`. |
| C-4 | `HarnessSessionPort`, `HarnessSpawnRunner`, and `HarnessSpawnRunnerResult` are unchanged; the Claude adapter and the session-listing path keep using the one-shot runner; dispatch is not edited. |
| C-5 | Acquisition reads only the stdout stream of the child the adapter started; no harness store is read on the spawn path. |
| C-6 | A handle exists only after a real identified line; `collect` cannot resolve before close; the legacy `result` envelope keeps evidence precedence and host `exitStatus`/`timedOut` merge on top, preserving the six-case classification floor. |
| C-7 | AC-F2-1/AC-F2-2 (handle before completion), AC-F5-1…AC-F5-3 (bounded acquisition, no default session cap, idempotent kill), and AC-F8-1 (a real dispatch reaches classification) are all reachable under this seam. |

## Trade-offs & Consequences

### Positive Outcomes

- The session port's two-phase contract becomes truthful: a handle exists while the session runs, and evidence exists only when it ends.
- Dispatch's progress-based liveness watch becomes observable during a real session instead of only after it has ended.
- The blast radius is contained to one adapters-tier module, one contract module, one adapter, and one composition binding; the Claude Code adapter, the read-only listing path, the classifier, the failure vocabulary, and the engine are untouched.
- The child-process boundary and the 16 MiB stdout bound are preserved, so the change is auditable against the same invariant as before.
- The seam is injected, so acquisition-before-completion, bound expiry, and idempotent kill are assertable offline with a virtual clock and no real CLI.
- A real multi-hour lifecycle is no longer subject to an arbitrary minute-scale process cap, while acquisition still cannot hang indefinitely.

### Negative Outcomes

- The harness adapters now have two injected seams. Composition must pass the starter for spawn/resume/deliver and the runner for session listing, which is one more thing a new composition site can get wrong; the streaming contract test and the composition tests pin the pairing.
- The opencode adapter keeps an in-memory record per live session (handle plus a completion promise), so a long-lived process retains one small record per session until it completes; the record is not persisted.
- The seam is additive but not free: a future harness that wants streaming must either adopt the starter or duplicate a stream, and a future harness that does not want it must ignore a seam that exists.
- `kill` escalation (`SIGTERM` → `SIGKILL` after a grace period) is new host behaviour on the harness path. It is confined to the child the starter created, but it is a lifecycle responsibility the one-shot runner did not have.
- Session termination is now delegated to liveness plus the restart budget. A hard-stalled session with no configured `sessionTimeoutMs` is not killed by a process cap, which is the intended trade but is an operational behaviour change.

### Unresolved Questions

- [ ] Whether any future CLI version changes the terminal `step_finish` reason set or moves the identifier off top-level `sessionID`; re-pin the decode contract then (owner: adapter maintainer, on a CLI upgrade).
- [ ] Whether operationally necessary session bounds emerge that progress-based liveness and the restart budget cannot cover; if so, an injected/configured bound — never a fixed minute cap (owner: `@pm`/owner, on real-session evidence).
- [ ] Whether a second harness ever needs streaming acquisition, which would turn the starter into a shared session-surface question (owner: M1-S11 follow-on; ADR-level).
- [ ] Whether an operator-facing session-bound configuration key is justified by real operations (explicitly out of scope for GH-275; owner: future change).

## Implementation Plan

1. **Contracts:** add the three type-only declarations to `packages/core/src/contracts/harness.ts` and re-export them from `packages/core/src/contracts/index.ts`. Do not touch `HarnessSpawnRunner`, `HarnessSpawnRunnerResult`, `HarnessSessionPort`, `HarnessEvidence`, or any closed vocabulary.
2. **Host:** implement `createHostSpawnStarter` in `packages/adapters/src/host/index.ts` beside `createHostSpawnRunner`: stream stdout as lines, expose `acquired()`, resolve `completion` at close or error without rejecting, honour `handleTimeoutMs` (kill on expiry with `timedOut: true`), accept an optional `sessionTimeoutMs` where absent or `0` is unbounded, expose an idempotent `kill` (`SIGTERM`, then `SIGKILL` after a grace period), and keep the 16 MiB bound and truncation marker. Remain the single child-process site.
3. **opencode adapter:** split decode into line parsing with `sessionID` precedence and retained fallback shapes; acquire on the first identified line; store a per-session completion promise; resolve `collect` only through that promise; keep the legacy evidence precedence and the host-fact merge; bound acquisition, not the session. Keep the one-shot runner for `listSessions`.
4. **Composition:** bind `harnessSpawnStarter ?? createHostSpawnStarter()` in the CLI composition and pass it only to the opencode adapter; pass the unchanged runner to Claude Code and to the listing path. Inject a recording starter wherever a fixture can reach spawn, since an optional fact alone is not hermeticity.
5. **Tests:** pin the real stream shape (contract, behaviour, and type tests), including handle-before-completion, completion-scoped `collect`, malformed/blank/no-id/truncated/resume cases, a simulated session beyond the old 300 s assumption, bound expiry with idempotent kill, and the unchanged session-port and Claude-runtime type assertions.
6. **Docs:** the `system_spec_update` phase records the two-seam composition and the host-stream semantics in `doc/spec/features/feature-harness-adapters.md`.

## Verification Criteria

- Metric: handle acquired before completion — a simulated session whose completion resolves after more than 300 s of virtual time returns its handle first. Target: 100% of runs. Window: GH-275 CI.
- Metric: `collect` never resolves before process close, and returns no in-flight or fabricated evidence. Target: 0 early resolutions across the stream case table. Window: GH-275 CI.
- Metric: pre-session failures reuse the delivered identities (`harness.spawn.refused`, `harness.spawn.invalid-output`, `harness.session.unknown`); no new failure code, outcome, token, or evidence field. Target: exact set equality. Window: GH-275 CI.
- Metric: the six-case classification conformance floor and the delivered opencode behaviour assertions stay green under the retained legacy precedence. Target: 100%. Window: GH-275 CI.
- Metric: repository-wide `node:child_process` allowlist equality — one harness host site, no new site; contracts tier still type-only. Target: exact equality. Window: GH-275 CI.
- Metric: `HarnessSessionPort`, `HarnessSpawnRunner`, and `HarnessSpawnRunnerResult` unchanged, and the Claude adapter still compiles and passes against the one-shot runner. Target: type probe plus unchanged suite. Window: GH-275 CI.
- Metric: no orphaned child after any failed or abandoned acquisition; `kill` invoked on every failure path. Target: 0 orphans. Window: GH-275 CI.
- Metric: one bounded real `dispatch <ref>` on the installed healthy CLI reaches classification and its `lastMessage` is not `spawn failed before a session existed`. Target: 1 of 1. Window: GH-275 acceptance.

## Confidence Rating

**High** for the seam shape and its constraint compliance: every grounding fact is verified in delivered source (the completion-gated runner, the two-phase port, the single `JSON.parse`, the 300 s cap, the single host site, the dispatch collapse), the evolution rule is stated in the current spec and exercised by TDR-0008, and the additive-beside-the-existing pattern has two prior precedents.

**Medium** for the JSONL decode details across CLI versions: the `sessionID` field, the `step_finish` `part.reason === "stop"` completion encoding, and the two failure encodings are facts for `opencode v2.2.5` and are `TO-CONFIRM` for any other version. That risk is bounded to the decode rules, not to this seam: a version change re-pins the decode contract without reopening the decision to add a streaming starter.

## References

- GH-275 change spec (DEC-1, DEC-3, DEC-5, §8.4, §8.5, Appendix B type sketch, Appendix C failure mapping, AC-F1…AC-F8): `doc/changes/2026-11/2026-11-08--GH-275--opencode-harness-contract/chg-GH-275-spec.md`
- GH-275 readiness iteration 2, blocking finding B-3: `doc/changes/2026-11/2026-11-08--GH-275--opencode-harness-contract/readiness/readiness-iter-2.md`
- Current system spec (adapter/session contract, implementation layout, host-runner semantics): `doc/spec/features/feature-harness-adapters.md`
- Delivered contracts and seams: `packages/core/src/contracts/harness.ts`, `packages/adapters/src/host/index.ts`, `packages/adapters/src/harness/opencode.ts`, `packages/adapters/src/harness/claude.ts`, `packages/core/src/app/dispatch.ts`
- Boundary invariant: `tests/structure/harness-imports.test.ts`, `tests/structure/harness-neutrality.test.ts`
- [ADR-0008](ADR-0008-harness-adapter-contract.md) — harness adapter contract; C-1 engine neutrality, DC-2 session lifecycle
- [TDR-0008](TDR-0008-additive-adapter-contract-extensions-closeout-v1.md) — additive-within-v1, record-governed adapter-contract evolution
- [TDR-0010](TDR-0010-dispatch-session-classification-token-projection.md) — shared classifier projection and the closed delivery-result tokens
