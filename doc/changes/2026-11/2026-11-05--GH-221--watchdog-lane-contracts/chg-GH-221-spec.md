---
change:
  ref: GH-221
  type: feat
  status: Proposed
  slug: watchdog-lane-contracts
  title: "Watchdog and lane contracts (M1-S1)"
  owners: [engineering]
  service: delivery-os CLI watchdog command family and core contracts
  labels: [change, m1]
  version_impact: minor
  audience: internal
  security_impact: low
  risk_level: medium
  dependencies:
    internal: [state-layer, result-contract, error-table, branding-seam, cli-command-surface]
    external: []
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make the lying-liveness defect family structurally impossible at the lane boundary — a typed watchdog that refuses dirty or non-base checkouts with evidence, restores on every exit, verifies memory publications instead of discarding them, and classifies absent liveness signals as unknown rather than guessing.

## 1. SUMMARY

Deliver the `watchdog` command family — `preflight <lane>`, `teardown <lane>`, `liveness <lane>` — as checks, not a runner: preflight refuses non-base or dirty checkouts with named evidence, teardown restores on every exit and reports the restoration with evidence, and teardown additionally verifies that agent-memory publications made under the lane are either already committed or preserved and reported, never silently discarded. Liveness ships contract-first: the verdict vocabulary (`ok | refused | stalled | progressing`), the signals envelope (`heartbeatAgeMs`, `tokenDelta`, `traffic`), and the classification rule that unavailable signal sources produce `watchdog.signals-absent` — unknown, never guessed; CPU is never the only signal. The typed error table gains a `watchdog` domain kind with exactly three identities (`watchdog.checkout-dirty`, `watchdog.checkout-non-base`, `watchdog.signals-absent`), and every probe projects through the existing envelope contract and the `{0, 1, 2}` exit taxonomy.

## 2. CONTEXT

### 2.1 Current State Snapshot

The typed tooling has an established machine surface: a v1 result envelope with exclusive `data`/`error`, a closed domain-kind union in the error table, command families registered through a common definition pattern, exit codes projected only as `{0, 1, 2}`, and a delivered state layer (GH-174, M0-S5) for verified records. The milestone planning corpus defines the watchdog shipped contract: the backlog M1-S1 entry (canonical scope), the M1 contracts page (watchdog entry: preflight verdict, teardown restoration report, liveness probe with progress signals), and the watchdog man page (subcommands, verdicts, signals shape, exit status, error identities). The bash-era delivery stack carries the documented defect family the operator evidence calls lying liveness: exit-zero false success, stranded commits left behind by interrupted lanes, and foreign commits landing on the wrong base. The planning corpus names these probes as prerequisites for the later lane consumers: the scheduling engine (M1-S17), the resident daemon (M1-S18), and supervise (M2-S2).

### 2.2 Pain Points / Gaps

- No typed surface refuses lane work started from a dirty or non-base checkout, so a lane can begin on a base it does not own.
- No guaranteed restoration on exit: an interrupted or failed lane leaves stranded residue, and a checkout that drifted from its base leaves foreign commits unowned.
- Agent-memory publications made under a lane can be lost at lane exit; nothing verifies that publications are committed or preserved.
- A liveness evaluation without signal sources has no classified answer available, inviting CPU-only heuristics that read a prefilling session as stalled.
- Every later lane consumer builds on these contracts; without refusals and restores at the contract level, stranded and foreign commits stay possible.

## 3. PROBLEM STATEMENT

Because the typed tooling exposes no lane checkout-safety, restoration, or liveness probes, a lane cannot be refused before work starts on a dirty or non-base checkout, cannot rely on restoration when it exits by any path, and cannot report liveness without guessing from insufficient signals, resulting in stranded and foreign commits remaining possible and every later M1 lane consumer (scheduling, daemon, supervise) building on untrustworthy liveness evidence.

## 4. GOALS

- **G-1**: Preflight refuses a dirty or non-base checkout with evidence naming the finding, so foreign commits are refused at admission.
- **G-2**: Teardown restores on every exit — success, failure, or interruption — and reports each restoration action with evidence, so stranded commits cannot survive a lane.
- **G-3**: Teardown verifies agent-memory publications made under the lane: already committed, or preserved and reported with evidence; never silently discarded.
- **G-4**: Liveness ships as a contract: verdict vocabulary, signals envelope, and the classified signals-absent answer — unknown, never guessed, never CPU-only.
- **G-5**: Every probe projects through the existing envelope and exit taxonomy, with the three watchdog identities bound into the error table under a new domain kind.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Stranded- and foreign-commit fixtures that are refused or restored with named evidence | 100% |
| Exit-`0` outcomes for refused, stalled, or unavailable probes | 0 |
| Refusals, restorations, and verdicts emitted without evidence | 0 |
| Teardown runs that discard or clobber uncommitted memory publications | 0 |
| Verdicts produced from absent signal sources (guessed answers) | 0 — always `watchdog.signals-absent` |
| Stall verdicts derivable from a single (CPU-only) signal | 0 |
| Probe invocations exiting outside `{0, 1, 2}` or emitting an invalid envelope | 0 |
| Replay determinism: identical checkout/lane facts → identical verdict, evidence, and exit | 100% |

### 4.2 Non-Goals

- **NG-1**: Real progress-signal ingestion. Heartbeat, session-traffic, and token-delta collection belongs to M1-S15 (SC-M1-14); M1-S1 delivers the probe contract and classifies absent sources as `watchdog.signals-absent`.
- **NG-2**: Daemon consumption of the probes (M1-S18) and supervise integration (M2-S2).
- **NG-3**: The `lanes` command surface (M1-S17/S18), scheduling, dispatch, restart budgeting, session kill, or any run behavior — the watchdog checks, it does not run.
- **NG-4**: Extending the state-layer contract. The state layer may be consumed for records; its contract is unchanged.
- **NG-5**: New envelope shapes or exit codes. The v1 envelope and the `{0, 1, 2}` taxonomy are reused unchanged.
- **NG-6**: Removal of, or changes to, the bash-era delivery stack.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Preflight checkout-safety refusal | Foreign commits are refused at admission, not discovered after landing. |
| F-2 | Teardown restoration on every exit | Stranded commits become structurally impossible, not merely unlikely. |
| F-3 | Memory-publish verification inside teardown | Agent-memory work under a lane is committed or preserved with evidence, never lost. |
| F-4 | Liveness probe contract (contract-first) | Consumers get a trustworthy verdict vocabulary now; absent signals classify as unknown, never guessed. |
| F-5 | Exit, envelope, and error-table contract | Machine consumers get a total, bound classification for every probe outcome. |
| F-6 | Checks-not-runner command surface | Naming and behavior keep the watchdog out of the run path it must judge. |

### 5.1 Capability Details

- **F-1 — Preflight refusal**: `<binary> watchdog preflight <lane>` evaluates the lane's checkout against the lane's base. A dirty checkout refuses with `watchdog.checkout-dirty`; a checkout not on the lane's base refuses with `watchdog.checkout-non-base`; both exit `1` with evidence naming the finding (expected base vs. actual, or the dirty state). A clean, on-base checkout admits the lane: verdict `ok`, exit `0`, evidence in the envelope `data`.
- **F-2 — Teardown restoration**: `<binary> watchdog teardown <lane>` runs on every exit path — success, failure, or interruption — restores the repository to the lane's safe state (base checkout, lane residue removed), and emits a restoration report naming each action taken and what it observed, with evidence. Teardown on a clean exit still runs and reports; it is unconditional, not best-effort.
- **F-3 — Memory-publish verification**: as part of teardown (not a separate command), teardown verifies that agent-memory publications made under the lane (the `.ai/memory` tree) are either already committed or preserved and reported with evidence in the restoration report. Teardown never silently discards or clobbers them.
- **F-4 — Liveness probe**: `<binary> watchdog liveness <lane>` evaluates the lane against the progress-signal contract: heartbeat age, session traffic, and token delta, with CPU never the only signal, so a prefilling or resuming session can never classify as stalled. When signal sources are unavailable, the probe classifies `watchdog.signals-absent` and exits `2` — the answer is "unknown", never a guessed verdict. The verdict vocabulary and signals envelope are bound as contract data; verdicts that require signal evidence (`stalled`, `progressing`) become reachable when M1-S15 delivers signal ingestion (SC-M1-14).
- **F-5 — Exit, envelope, and error-table contract**: a `watchdog` domain kind joins the closed domain-kind union with exactly three rows — `watchdog.checkout-dirty`, `watchdog.checkout-non-base` (refusals, exit `1`), and `watchdog.signals-absent` (probe unavailable, exit `2`). Exit mapping is total: `0` for `ok`/`progressing`, `1` for `refused`/`stalled`, `2` for classified probe-unavailable. Every invocation emits exactly one envelope; under `--json` the `data` carries `verdict`, `signals`, and `evidence`. Text output renders verdict lines with the same evidence.
- **F-6 — Checks, not a runner**: the command family performs no dispatch, no session spawn, no kill, and no supervision; it evaluates and restores. The distinction is carried in naming and in tests, and it is what later consumers rely on: the daemon (M1-S18) consumes these probes for its lanes rather than reimplementing them. The binary name renders through the branding seam; the surface never hardcodes a product name.

## 6. USER & SYSTEM FLOWS

```
Flow 1 — Admission (preflight)
  Caller: <binary> watchdog preflight <lane>
  ├─ checkout dirty ─────▶ refused · watchdog.checkout-dirty · exit 1 · evidence names the dirt
  ├─ checkout off base ──▶ refused · watchdog.checkout-non-base · exit 1 · evidence: base vs actual
  └─ clean on base ──────▶ ok · exit 0 · evidence in data

Flow 2 — Exit (teardown, every exit path)
  Lane exits (success | failure | interruption)
  → teardown runs → restores base state, clears lane residue
  → verifies memory publications (committed | preserved)
  → restoration report with evidence · exit 0 (or classified failure, exit 1/2)

Flow 3 — Liveness probe
  Caller: <binary> watchdog liveness <lane>
  ├─ signal sources available ──▶ verdict from progress signals (never CPU-only)
  └─ sources unavailable ───────▶ watchdog.signals-absent · exit 2 · "unknown, never guessed"

Flow 4 — Later consumers (outside this change)
  Scheduling engine (M1-S17), daemon (M1-S18), supervise (M2-S2) call the same probes per lane.
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The `watchdog` command family: `preflight <lane>`, `teardown <lane>`, `liveness <lane>`, with `--json` envelope output and text verdict lines.
- Preflight refusal of dirty and non-base checkouts, each with named evidence.
- Teardown restoration on every exit path, with a restoration report carrying evidence.
- Memory-publish verification as part of teardown (committed-or-preserved, reported with evidence).
- Liveness probe contract: verdict vocabulary, signals envelope shape, evidence field, and the `watchdog.signals-absent` classification.
- A `watchdog` domain kind in the error table with exactly the three identities above; total exit mapping `{0, 1, 2}`.
- Brand-neutral naming: the binary name resolves through the branding seam.

### 7.2 Out of Scope

- [OUT] Real progress-signal ingestion (M1-S15, SC-M1-14): heartbeat, traffic, and token-delta collection.
- [OUT] Daemon consumption of the probes (M1-S18) and supervise integration (M2-S2).
- [OUT] The `lanes` command surface (M1-S17/S18) and scheduler integration.
- [OUT] Dispatch, run, restart-budget, or kill behavior anywhere in the watchdog surface.
- [OUT] State-layer contract changes (consumed only), envelope changes, or exit codes beyond `{0, 1, 2}`.
- [OUT] Bash-era stack removal or parity claims.

### 7.3 Deferred / Maybe-Later

- Signal ingestion and the `stalled`/`progressing` classification over real signals — M1-S15 (SC-M1-14).
- Daemon-side lane supervision consuming these probes — M1-S18.
- Supervisor-level integration — M2-S2.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

None. The interface is the CLI subcommand surface, on the existing v1 envelope contract:

| Invocation | Verdict | Exit | Errors |
|---|---|---|---|
| `<binary> watchdog preflight <lane>` | `ok` / `refused` | `0` / `1` | `watchdog.checkout-dirty`, `watchdog.checkout-non-base` |
| `<binary> watchdog teardown <lane>` | `ok` (restoration reported) | `0` | classified teardown failure |
| `<binary> watchdog liveness <lane>` | `ok` / `stalled` / `progressing` / (absent → classified) | `0` / `1` / `2` | `watchdog.signals-absent` |

`--json` emits exactly one envelope; `data` carries `verdict`, `signals`, `evidence`. Exit `2` is reserved for classified probe-unavailable. Every row is total: no probe outcome exists without a verdict or a classified error.

### 8.2 Events / Messages

None. Probe results are rendered output and envelope `data`; no event or message surface is added. Where teardown records outcomes, it consumes the existing state layer.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Verdict vocabulary | `ok \| refused \| stalled \| progressing` — bound as contract data, one home. |
| DM-2 | Signals shape | `heartbeatAgeMs`, `tokenDelta`, `traffic` — the progress-signal fields the probe contract declares. |
| DM-3 | Evidence field | Refusal, restoration, and verdict evidence: the finding, expected vs. actual, actions taken. |
| DM-4 | Restoration report | Teardown `data`: per-action restoration evidence plus memory-publication status (`committed` / `preserved`) per publication. |
| DM-5 | Error-table rows | New `watchdog` domain kind; rows `watchdog.checkout-dirty`, `watchdog.checkout-non-base`, `watchdog.signals-absent` with category, retryability, consequence, remediation hint, and projection class per the existing row schema. |

### 8.4 External Integrations

None. All probes operate on the local repository and local state; no tracker, provider, network, or vendor API is contacted.

### 8.5 Backward Compatibility

Additive only: a new command family, a new domain kind appended to the closed union, and three new table rows. Existing domain kinds, rows, envelope shape, exit digits, and command families are untouched. The `{0, 1, 2}` projection classes are reused (`success` / `user-validation` / `platform-provider`), so exit `2` keeps its platform-unavailable meaning. No state-layer or stored-record migration is required.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | False-liveness guarantee: exit-`0` outcomes for refused, stalled, or probe-unavailable fixtures; guessed verdicts where signal sources are absent | 0 / 0 — the lying-liveness class is empty over the fixture matrix |
| NFR-2 | Envelope validity: `--json` runs emitting anything but exactly one valid envelope; exits outside `{0, 1, 2}`; envelopes carrying both or neither of `data`/`error` | 0 / 0 / 0 |
| NFR-3 | Evidence totality: refusals, restorations, and verdicts without evidence | 0 |
| NFR-4 | Determinism: replay drift across identical checkout/lane facts (verdict, evidence, exit) | 0 drift |
| NFR-5 | Memory preservation: teardown runs discarding or clobbering uncommitted lane publications | 0 |
| NFR-6 | Tier and brand conformance: product/binary literals in the new surface; contracts carrying behavior or I/O; domain importing beyond contracts | 0 / 0 / 0 — boundary and ambient gates green |
| NFR-7 | Error-table binding: watchdog rows round-tripping with their documented rows; existing rows modified | 3/3 / 0 |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

The probes' own output is the observability surface: every run produces a verdict line (text) or an envelope (`--json`) whose `evidence` explains the outcome, and teardown always produces a restoration report. Classified failures reuse the envelope error object (code, category, remediation hint). No new metrics, tracing, or alerting infrastructure is introduced.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Contract-first liveness is mistaken for a working stall detector; a consumer acts on absent signals as if they were evidence | H | L | `watchdog.signals-absent` exits `2` and never yields a verdict; contract tests assert no verdict from absent sources; M1-S15 named as the ingestion story | L |
| RSK-2 | Teardown restoration damages work it cannot attribute (restore-on-every-exit is inherently destructive-adjacent) | H | M | Restoration is evidence-first: anything unattributable to the lane is preserved and reported, never silently removed; memory publications are protected by F-3 | M |
| RSK-3 | New domain kind and rows drift from their documented table | M | M | Same-phase two-way sync check, as established by the existing table binding (NFR-7) | L |
| RSK-4 | Base determination ambiguity produces wrong refusals (refusing a legitimate checkout) | M | M | The lane's declared base is the only comparison target; refusal evidence names expected vs. actual so a wrong refusal is diagnosable and correctable | L |

## 12. ASSUMPTIONS

- The state layer (GH-174, M0-S5, delivered) is available for records; the watchdog consumes it and does not extend it.
- Each probe receives a lane identifier (`<lane>`), and the lane's base reference is resolvable from existing lane context.
- The v1 envelope, the closed error table, the `{0, 1, 2}` projection, and the branding seam remain the machine surface this change builds on.
- Agent-memory publications are the writes made under the lane to the `.ai/memory` tree, per the repository's memory conventions.
- The verdict vocabulary includes `refused` and `stalled`/`progressing` as declared contract values; their signal-evidence-backed reachability grows with M1-S15.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | M0-S5 state layer (GH-174) | Delivered 2026-10-30; consumed, not extended. |
| Depends on | Envelope, result, and error-table contracts | The machine surface and the closed domain-kind union. |
| Depends on | Branding seam | Binary-name resolution; no product literals. |
| Blocks | M1-S15 (GH-232 area: progress-signal ingestion, SC-M1-14) | Extends the liveness probe with real signals. |
| Blocks | M1-S17 / M1-S18 (scheduling, daemon) | First consumers of the probes for their lanes. |
| Blocks | M2-S2 (supervise) | Builds on the same lane contracts. |

## 14. OPEN QUESTIONS

None at specification time. The one scope ambiguity identified during clarification — where memory-publish verification lives — is resolved by recorded decision DEC-1, to be confirmed at the PR review gate.

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Memory-publish verification is part of teardown ("restore on every exit"), not a new command surface | The shipped-contract pack defines only preflight/teardown/liveness outputs; the AC's "refused or restored with evidence" clause supports the teardown framing. Recorded in the ticket (comment 6668111771) and pm-notes; confirmed at PR review | 2026-11-05 |
| DEC-2 | Liveness ships contract-first in M1-S1; real progress-signal ingestion is M1-S15 (SC-M1-14) | Ticket pinned decision; absent signal sources classify `watchdog.signals-absent` ("unknown, never guessed") | 2026-11-05 |
| DEC-3 | CPU is never the only liveness signal | Ticket pinned decision; a prefilling session must never read as stalled | 2026-11-05 |
| DEC-4 | The watchdog checks; it does not run | Ticket pinned decision; the runner distinction governs naming and tests (F-6) | 2026-11-05 |
| DEC-5 | A `watchdog` domain kind joins the closed union with exactly the three man-page identities | Checkout-safety and signal-availability verdicts are owned by neither lint (conformance), state (storage), nor input (invocation); reusing those kinds would erase the distinction | 2026-11-05 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Core contracts tier | New — watchdog probe contract data (verdicts, signals shape, evidence) and the error-table extension (domain kind + three rows). |
| Core domain tier | New — pure probe evaluation and verdict/refusal classification services. |
| CLI command surface | New — the `watchdog` command family registered beside existing families; text and `--json` rendering. |
| Branding seam | Consumed, unchanged — binary-name resolution. |
| State layer | Consumed, unchanged — records only where applicable; contract not extended. |
| System documentation | New feature spec at the documentation-sync phase (first spec covering watchdog/lane contracts). |

## 17. ACCEPTANCE CRITERIA

- **AC-F1-1 — A dirty checkout is refused with evidence.**
  **Given** a lane whose working tree has uncommitted changes at preflight, **when** `<binary> watchdog preflight <lane>` runs, **then** it exits `1` with exactly one failure envelope carrying `watchdog.checkout-dirty`, the evidence names the dirty state, no lane work is admitted, and no restoration or mutation occurs.
  *DoD predicate*: the fixture exits `1`, the code matches, evidence is present and non-empty; a clean control does not produce this code. *Traceability*: F-1, NFR-1, NFR-3.

- **AC-F1-2 — A non-base checkout is refused with evidence.**
  **Given** a lane whose checkout is not on the lane's declared base, **when** preflight runs, **then** it exits `1` with `watchdog.checkout-non-base`, and the evidence names the expected base and the actual checkout, so a foreign commit is refused at admission.
  *DoD predicate*: base-drift fixture → exact code and exit; evidence contains both base and actual; an on-base control passes. *Traceability*: F-1, NFR-1, NFR-3.

- **AC-F1-3 — A clean, on-base checkout admits the lane.**
  **Given** a lane with a clean checkout on its declared base, **when** preflight runs, **then** it exits `0` with a success envelope whose `data` carries `verdict: "ok"` and evidence.
  *DoD predicate*: envelope is valid and exclusive (`data`, no `error`); exit `0` occurs only for this admission case. *Traceability*: F-1, F-5, NFR-2.

- **AC-F2-1 — Teardown restores on a successful exit.**
  **Given** a lane that exited successfully with lane residue present, **when** `<binary> watchdog teardown <lane>` runs, **then** the repository is restored to the lane's safe state (base checkout, residue removed) and the restoration report names each action with evidence.
  *DoD predicate*: post-teardown state equals the safe state; report is present with non-empty evidence; exit `0`. *Traceability*: F-2, NFR-3.

- **AC-F2-2 — Teardown restores on failure and interruption exits.**
  **Given** a lane that exited by failure and a lane interrupted mid-work (stranded-commit fixtures), **when** teardown runs on each, **then** each restoration leaves the repository at the safe state with the stranded work either restored or preserved-and-reported, each with evidence — restoration holds on every exit path, not only success.
  *DoD predicate*: every exit-path fixture ends at the safe state with an evidence-bearing report; no fixture leaves residue behind unreported. *Traceability*: F-2, NFR-1, NFR-3.

- **AC-F2-3 — The ticket refusal-or-restoration family holds.**
  **Given** the full fixture matrix of stranded-commit and foreign-commit scenarios, **when** the relevant probe runs for each, **then** every scenario ends refused (preflight, exit `1`, named code and evidence) or restored (teardown, evidence-bearing report) — none survives unreported.
  *DoD predicate*: matrix coverage is exhaustive over the two families; 100% refused-or-restored-with-evidence; zero silent outcomes. *Traceability*: F-1, F-2, NFR-1, NFR-3 (ticket AC).

- **AC-F3-1 — Memory publications are committed or preserved, never discarded.**
  **Given** a lane with an agent-memory publication already committed and a lane with an uncommitted publication, **when** teardown runs on each, **then** the committed publication is reported as committed, the uncommitted one is preserved intact and reported with evidence in the restoration report, and no publication is discarded or clobbered.
  *DoD predicate*: byte-identical preservation for the uncommitted fixture; report names each publication and its status; zero-loss assertion across the memory fixtures. *Traceability*: F-3, NFR-5, DEC-1.

- **AC-F4-1 — Absent signal sources classify as unknown, never guessed.**
  **Given** a lane for which no signal sources are available, **when** `<binary> watchdog liveness <lane>` runs, **then** it exits `2` with `watchdog.signals-absent`, emits no verdict value (`ok`/`stalled`/`progressing`), and the evidence states that the answer is unknown.
  *DoD predicate*: the fixture yields the exact code and exit `2`; no verdict key is produced; a sourced control (from M1-S15 onward) never produces this code. *Traceability*: F-4, NFR-1, DEC-2.

- **AC-F4-2 — The verdict and signals contract is bound, and CPU-only stalls are impossible.**
  **Given** the delivered contract data, **then** the verdict vocabulary is exactly `ok | refused | stalled | progressing`; the signals shape declares `heartbeatAgeMs`, `tokenDelta`, and `traffic`; under `--json` the `data` carries `verdict`, `signals`, `evidence`; and the stall classification requires progress-signal corroboration, so a CPU-only reading can never classify `stalled` — a prefilling session can never read as stalled.
  *DoD predicate*: a structure assertion extracts the vocabulary and shape (exact set, one home, no duplicates); the corroboration rule is asserted at the classification level. *Traceability*: F-4, NFR-1, DEC-3.

- **AC-F5-1 — Exit mapping and error-table binding are total.**
  **Given** the delivered error table and probe outcomes, **then** a `watchdog` domain kind exists with exactly three rows (`watchdog.checkout-dirty`, `watchdog.checkout-non-base`, `watchdog.signals-absent`); exits are `0` for `ok`/`progressing`, `1` for `refused`/`stalled` refusals and failures, `2` for classified probe-unavailable; and no probe invocation exits outside `{0, 1, 2}`.
  *DoD predicate*: row/count assertions (3/3, 0 modified existing rows) per the sync binding; exit-matrix assertion over every fixture class. *Traceability*: F-5, NFR-2, NFR-7, DEC-5.

- **AC-F5-2 — Every invocation emits exactly one valid envelope.**
  **Given** any probe invocation — success, refusal, classified failure, or probe-unavailable — **when** it runs with `--json`, **then** exactly one valid envelope is emitted with exclusive `data`/`error`, the four mandatory envelope fields present, and failures carrying code, category, remediation hint, and evidence-bearing summary.
  *DoD predicate*: envelope-contract assertions over the full fixture matrix; zero double-or-empty payloads; text mode carries the same evidence in verdict lines. *Traceability*: F-5, NFR-2, NFR-3.

- **AC-F5-3 — Grammar and unknown-lane failures reuse existing identities.**
  **Given** `watchdog` with no subcommand, an unknown subcommand, or a lane identifier that resolves to nothing, **when** the probe runs, **then** each failure is classified through the existing invocation identities (parser-level and handler-grammar), exits non-zero, and never resolves to the internal fallback identity for a documented class.
  *DoD predicate*: each grammar fixture maps to its existing identity; zero `fallback.internal` occurrences across documented classes. *Traceability*: F-5, NFR-2.

- **AC-F6-1 — The watchdog checks; it does not run.**
  **Given** any probe invocation, **then** the surface dispatches no lane, spawns no session, kills no process, and holds no restart or scheduling behavior; it only evaluates and restores — and the command names reflect checks (`preflight`, `teardown`, `liveness`), not runner verbs.
  *DoD predicate*: a behavior assertion records zero dispatch/spawn/kill calls across all fixtures; the grammar exposes no run-oriented verbs. *Traceability*: F-6, DEC-4.

- **AC-F6-2 — The surface is brand-neutral.**
  **Given** the delivered watchdog surface and its output, **then** the binary name renders through the branding seam and zero product or binary literals appear in the new contracts, domain, or command modules.
  *DoD predicate*: a structure scan over the new modules finds 0 literals; output renders the injected brand value. *Traceability*: F-6, NFR-6.

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

Single feature delivery on the change branch; additive and self-contained, so no migration, flag, or consumer coordination is required. Delivery order follows the established tier sequence — contract data, then pure domain classification, then the command surface, then documentation sync — with each error-table row and its documented row landing in the same phase. DEC-1 (memory-publish verification inside teardown) is confirmed at the PR review gate. Later stories (M1-S15, M1-S17, M1-S18, M2-S2) adopt the probes; nothing adopts them in this change.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

None. The state layer is consumed, not extended; no stored-record schema, format, or registry changes; no seeding beyond test fixtures.

## 20. PRIVACY / COMPLIANCE REVIEW

No privacy or compliance implications. All probes operate locally; no network egress, no tracker or provider calls. Evidence lines may name local repository paths and refs only; no credentials or secret material enters evidence or envelopes.

## 21. SECURITY REVIEW HIGHLIGHTS

- Preflight refusal is a protective gate: it is fail-closed — an unevaluable checkout refuses rather than admits.
- Lane identifiers and base references are validated inputs; evidence rendering never executes input content.
- Teardown restores only what it can attribute to the lane; unattributable content is preserved and reported (mitigating destructive-adjacent behavior, RSK-2).
- No new privileges, no network, no process execution beyond the tooling's own local operations.

## 22. MAINTENANCE & OPERATIONS IMPACT

Operators gain a stable refusal/restore evidence trail for lane incidents, replacing manual forensic inspection of stranded state. Maintenance cost: the new domain kind and rows join the existing two-way table-sync obligation; the probe contract data becomes the reference point M1-S15 extends and the daemon consumes, so contract changes after this story are coordinating changes. The watchdog man page in the milestone planning corpus describes the milestone-end contract and is the design baseline, not a reconciled system doc.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Lane | One unit of delivery work with an identity and a declared base, later owned end-to-end by the scheduling engine and daemon. |
| Watchdog | The check family (`preflight`, `teardown`, `liveness`) that judges and restores lanes; it checks, it does not run. |
| Stranded commit | Work left behind by a lane that exited without restoration. |
| Foreign commit | A commit on a checkout that is not the lane's declared base. |
| Prefill | The early phase of a (re)started session that consumes input before producing output; must never read as stalled. |
| Signals-absent | The classified "unknown" answer when no signal sources are available — never guessed. |
| Restoration report | Teardown's evidence-bearing record of restoration actions and memory-publication status. |
| Memory publication | An agent-memory write made under the lane (the `.ai/memory` tree); committed or preserved at teardown. |
| Lying liveness | The bash-era defect family: exit-zero false success, stranded commits, foreign commits. |

## 24. APPENDICES

**A. Source map**

| Source | Role |
|--------|------|
| Ticket GH-221 (incl. comment 6668111771) | Goal, tasks, AC, pinned decisions, DEC-1 |
| Backlog M1-S1 entry | Canonical scope and AC wording |
| M1 contracts page, watchdog entry | Shipped-contract outputs and scenarios |
| Watchdog man page | Subcommands, verdicts, signals shape, exit status, error identities |
| M1 test-scenarios, SC-M1-14 | The M1-S15 boundary this contract reserves |
| pm-notes (clarify_scope) | Dependency verification, integration surfaces, doc impact |

**B. Verdict / exit matrix**

| Outcome | Verdict | Exit | Identity |
|---|---|---|---|
| Clean, on-base checkout admitted | `ok` | `0` | — |
| Teardown restored, publications verified | `ok` | `0` | — |
| Dirty checkout | `refused` | `1` | `watchdog.checkout-dirty` |
| Off-base checkout | `refused` | `1` | `watchdog.checkout-non-base` |
| Stall (signal-corroborated; reachable from M1-S15) | `stalled` | `1` | — |
| Progressing (signal-corroborated; reachable from M1-S15) | `progressing` | `0` | — |
| No signal sources | — (none emitted) | `2` | `watchdog.signals-absent` |

> Refusal rows show the conceptual verdict `refused`; on the wire the machine
> representation is the refusal identity carried on a failure envelope (no
> `data.verdict`), per the exclusive `data`/`error` contract (GAP-T5, PIN-1).

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-05 | spec-writer | Initial specification from ticket GH-221, backlog M1-S1, milestone contract pack, and clarify_scope decisions |

---

## AUTHORING GUIDELINES

Authored from the ticket (goal, tasks, AC, pinned decisions, scope comment 6668111771), the backlog M1-S1 entry (canonical scope), the M1 contracts page and watchdog man page (shipped-contract shape: subcommands, verdicts, signals, exit status, error identities), the M1 test-scenarios style (SC-M1-14 as the M1-S15 boundary), and the clarify_scope pm-notes (dependency verification, integration surfaces, memory-publish decision). Contract-shape vocabulary (envelope exclusivity, domain-kind union, projection classes, two-way table sync) follows the repository's existing result/error conventions. No behavior beyond the pinned sources is asserted; the signal-ingestion boundary is stated as scope, not as evolution.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-221)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, DM-, NFR-, RSK-, DEC-, AC-; no OQ required)
- [x] Acceptance criteria reference at least one F-/NFR-/DEC- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths, no step-by-step tasks)
- [x] No content duplicated from linked docs
- [x] Front matter validates per front_matter_rules
