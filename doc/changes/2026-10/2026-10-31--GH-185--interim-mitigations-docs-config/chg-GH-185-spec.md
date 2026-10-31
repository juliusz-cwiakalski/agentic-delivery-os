---
change:
  ref: GH-185
  type: docs
  status: Proposed
  slug: interim-mitigations-docs-config
  title: "M0-S16: Interim mitigations, docs and config only"
  owners: ["Juliusz Ćwiąkalski"]
  service: delivery-os autonomous delivery loop (bash era)
  labels: ["documentation", "autonomous-delivery", "M0", "interim-mitigations"]
  version_impact: none
  audience: mixed
  security_impact: none
  risk_level: low
  dependencies:
    internal: ["M0-S4 config layer (GH-173, delivered)", "doc/guides/delivery-modes.md", "doc/guides/change-lifecycle.md", "doc/guides/opencode-agents-and-commands-guide.md", "doc/spec/features/feature-autonomous-delivery.md", "scripts/deliver-ticket.sh (documentation subject — unchanged)", "scripts/ceo-loop.sh (documentation subject — unchanged)", "scripts/pm-liveness.sh (documentation subject — unchanged)"]
    external: []
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make the bash-era delivery loop's four known rough edges — headless permission-denial, stuck-minute thresholds, the in-flight JOIN warning, and the pm-notes authoring rule — handleable by any operator or agent from documentation and existing configuration alone, with zero shell behavior changes, until the typed engines replace the bash stack.

## 1. SUMMARY

This change documents four interim mitigations for the bash-era delivery loop (`deliver-ticket.sh`, `ceo-loop.sh`, `pm-liveness.sh`) so they are discoverable and actionable without tribal knowledge: (1) how to recognize and recover from a headless permission auto-reject (`noop-lane-permission`), (2) what the stuck-minute defaults mean, which knobs tune them, and how to recognize the true knob names, (3) what the in-flight `JOIN:` warning means and the single-flight rule it enforces, and (4) who authors `chg-<workItemRef>-pm-notes.yaml`, when, and why. The mitigations are **docs or existing config only**: the change edits documentation surfaces (existing guides plus one factual system-spec correction) and introduces no new configuration and no shell behavior changes of any kind — the diff contains zero changes under `scripts/**` and `tools/**`.

## 2. CONTEXT

### 2.1 Current State Snapshot

- The delivery loop already handles its known rough edges **correctly at runtime**; what is missing is discoverability:
  - **Permission denial (close-out path):** `deliver-ticket.sh` classifies "no branch commits + a headless permission auto-reject signature in the per-ticket lane log" as result `noop-lane-permission` (exit 1) and instructs "re-dispatch with a corrected prompt". The result token appears in the usage text, in the artifact-first classification table in `doc/guides/delivery-modes.md`, and in the INV-DM-1 result enumeration in `doc/spec/features/feature-autonomous-delivery.md`.
  - **Stuck-minute thresholds:** `deliver-ticket.sh` reads `DELIVER_STUCK_MINUTES` (default 10, `--stuck-minutes` CLI flag override) and `ceo-loop.sh` reads `CEO_LOOP_STUCK_MINUTES` (default 10). Liveness is multi-signal: recursive session-message traffic is the primary signal, git/worktree activity the secondary. `pm-liveness.sh` exposes its own probe threshold (`CEO_LOOP_STALL_MINUTES`, default 10), which both wrappers align to their own threshold when invoking the probe. Seconds-level overrides (`DELIVER_STUCK_SECONDS`; ceo-loop's internal seconds seam) exist for test speed, not as operator knobs.
  - **In-flight warning (single-flight + JOIN):** repo-local state lives under `.ai/local/delivery/` (per-ticket PID file + flock lock). A second `deliver-ticket.sh` invocation for a ticket with a live owner **joins** it and logs `JOIN: live delivery for <REF> (pid=…); waiting`, then returns the same classified result. A `--is-delivering [REF]` probe exists, with stale-PID self-healing. INV-DM-2 (single-flight + join per repo working tree) and INV-DM-1 (foreground, never detached) are documented invariants.
  - **pm-notes ledger:** `chg-<workItemRef>-pm-notes.yaml` is the mandatory per-change delivery ledger. The artifact-first classification treats complete pm-notes as `finished` (exit 0) and absent/incomplete pm-notes as `partial` (exit 1, "resume the SAME branch"). The PM updates pm-notes at phase boundaries before triggering `@committer`; the future verify-change engine (M0-S8) will read it as its ledger input; `ados lint` / `ados phase` (M0-S10) have not landed, so ledger discipline is process-enforced today.
- Documentation coverage is **partial and partly wrong**: the classification table documents the `noop-lane-permission` row but not its cause, recognition, or recovery path; the stuck-minute tables are correct for `DELIVER_STUCK_MINUTES` but name `CEO_LOOP_STALL_MINUTES` as the ceo-loop threshold in three places — while `ceo-loop.sh` actually reads `CEO_LOOP_STUCK_MINUTES` (`CEO_LOOP_STALL_MINUTES` governs only the pm-liveness probe, which the wrappers override internally); the JOIN behavior is documented as a mechanism (recovery-semantics rows, flow diagram, file inventory) but not as an operator-facing warning with a prescribed action; the pm-notes rule is scattered ("PM Notes are Mandatory" one-liner, phase-boundary update guidance, structure example) with no consolidated statement of who authors it, who must not, and why.
- M0-S4 (config layer, GH-173) is delivered: it provides the typed configuration foundation for the engines. It is **not wired into the bash scripts**, so the bash-era configuration surface remains environment variables and CLI flags.

### 2.2 Pain Points / Gaps

- **Permission-denial recovery is tribal knowledge.** An operator or CEO agent seeing `noop-lane-permission` finds a one-row table entry ("re-dispatch with a corrected prompt") but no explanation of what triggered it (a headless permission prompt that was auto-rejected), how to confirm it from the lane log, what a "corrected prompt" means in practice, or how it differs from the mid-run permission-prompt stall (which takes the stuck → kill-and-restart path instead).
- **The documented ceo-loop stuck knob does not exist.** Three doc locations tell operators to tune `CEO_LOOP_STALL_MINUTES` for ceo-loop; the script reads `CEO_LOOP_STUCK_MINUTES`. An operator following the docs tunes a variable that has no effect on the loop (it would only affect the pm-liveness probe if not re-exported — and the wrappers always re-export it). Additionally, `ceo-loop.sh`'s own usage text misnames its knob — a bash-era inaccuracy that cannot be fixed in this change and must be documented around.
- **The JOIN warning has no operator contract.** The docs describe the JOIN *mechanism* but not what an operator or agent should conclude and do when they see `JOIN: live delivery for <REF> (pid=…); waiting`: wait, do not kill the owner, do not start a parallel delivery for the same ticket in the same working tree, and expect the same classified result.
- **The pm-notes authoring rule is nowhere stated as a rule.** Who authors it (the PM), when (at phase transitions, before each commit), who must not (delivery agents such as `@coder`), and why (ledger integrity: artifact-first classification keys `finished` vs `partial` on pm-notes completeness, and verify-change will consume it) must be assembled from three files by the reader — or, more commonly, violated unnoticed until a delivery is misclassified as `partial`.

## 3. PROBLEM STATEMENT

Because the bash-era delivery loop's known rough edges are handled at runtime but documented only partially and in one case with a wrong knob name, an operator or delivery agent cannot reliably recognize, recover from, or correctly configure these rough edges from documentation alone, resulting in rediscovered-by-trial-and-error failures (mis-tuned thresholds that have no effect, permission denials re-dispatched with unchanged prompts, parallel deliveries raced against live owners, and pm-notes authored or hand-edited by the wrong role, corrupting the delivery ledger).

## 4. GOALS

- **G-1**: An operator or agent can recognize a headless permission auto-reject (`noop-lane-permission`) from the delivery output/lane log and recover using the documented path (re-dispatch with a corrected prompt), and can distinguish it from the mid-run permission-prompt stall (stuck → kill-and-restart).
- **G-2**: An operator can identify the correct stuck-minute knobs for both wrappers by their true names (`DELIVER_STUCK_MINUTES`, `CEO_LOOP_STUCK_MINUTES`, `--stuck-minutes`), know the 10-minute defaults and the multi-signal liveness semantics, and make an informed tuning decision (e.g., raising the threshold for legitimately long reasoning steps).
- **G-3**: An operator or agent seeing the in-flight `JOIN:` warning understands what it means (single-flight owner joined), what to do (wait; do not kill the owner; never run a parallel delivery of the same ticket in the same repo working tree), and what to expect (the same classified result).
- **G-4**: The pm-notes authoring rule is stated in one canonical place: the PM authors it at phase transitions (before each commit), delivery agents do not author or hand-edit it, and the ledger-integrity rationale (artifact-first `finished`/`partial` classification; future verify-change input) is explicit.
- **G-5**: The delivery is docs/config only: zero changes under `scripts/**` and `tools/**`; no new configuration knobs; documentation describes current behavior accurately (every claim grounded in the current scripts).

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Changes under `scripts/**` and `tools/**` in this change's diff | 0 files (hard constraint) |
| Doc locations in this change's edited docs naming `CEO_LOOP_STALL_MINUTES` as the ceo-loop threshold | 0 (all corrected to `CEO_LOOP_STUCK_MINUTES`, with the pm-liveness probe variable explained where relevant; historical `doc/changes/**` artifacts are out of scope) |
| Mitigation claims not verifiable against current script behavior | 0 (100% of documented claims grounded and re-verified at review) |
| Canonical homes per mitigation | Exactly 1 per mitigation, cross-linked from related sections (no duplicated rule statements) |
| Existing doc-derived CI guards after the edits (result-tuple doc guard, liveness-wording grep guard, doc-distribution guard) | All green |
| New configuration knobs introduced | 0 |

### 4.2 Non-Goals

- **NG-1**: Any shell behavior change — no edits to `scripts/**` or `tools/**`, including the two known script-side naming inaccuracies this change documents around (`ceo-loop.sh` usage text naming its knob `CEO_LOOP_STALL_MINUTES`; the ceo-loop comment naming its seconds seam `CEO_LOOP_STUCK_SECONDS` while the code reads the internal `STUCK_SECONDS`). Fixing those belongs to a future shell-allowed change (§7.3).
- **NG-2**: New configuration knobs or a new config file for the bash era. The GH-173 config layer is not wired into the bash scripts; wiring it would be shell feature work (out of scope). The "config" leg of this change is documenting the existing environment-variable/flag surface accurately.
- **NG-3**: Engine work (`ados` CLI, typed engines) or any change to the runtime semantics the docs describe (classification ladder, liveness detection, JOIN/single-flight, pm-notes schema).
- **NG-4**: Rewriting or reorganizing the existing guides beyond the mitigation sections and the specific corrections; wholesale restructures are out of scope.
- **NG-5**: Documenting future engine behavior (`ados lint`, `ados phase`, verify-change internals) as current behavior; those are referenced only as forward context, clearly framed as not yet landed.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Permission-denial handling documentation (recognition + recovery) | Turns the `noop-lane-permission` one-row table entry into an actionable recognition-and-recovery contract |
| F-2 | Stuck-minute defaults documentation (true knob names, defaults, semantics, tuning) | Operators must tune variables that actually exist; the current docs name a variable the loop does not read |
| F-3 | In-flight warning documentation (JOIN meaning + single-flight operator rule) | The `JOIN:` log line and the single-flight rule need an operator-facing contract, not just a mechanism description |
| F-4 | pm-notes authoring rule documentation (who / when / who-not / why) | Ledger integrity is enforced only by process until `ados lint` / `ados phase` land; the rule must be explicit and canonical |
| F-5 | Consolidation & accuracy pass (no duplication, drift correction) | Mitigations land in existing guides with exactly one canonical home each; the wrong knob name is corrected everywhere it appears |

### 5.1 Capability Details

**F-1 — Permission-denial handling documentation.** The mitigation documentation explains, grounded in current behavior: (a) the trigger — a headless permission request that was auto-rejected (the lane log carries the permission auto-reject signature) combined with zero branch commits; (b) the outcome — result `noop-lane-permission`, exit 1, with the script's own guidance "re-dispatch with a corrected prompt"; (c) recognition — where to look (delivery summary result token; the per-ticket lane log) and what the signature means; (d) recovery — what "a corrected prompt" means in practice: adjust the dispatch prompt/context so the work requires no interactive permission acceptance (e.g., re-scope the task, or grant the needed permission out-of-band per operator policy), then re-dispatch; (e) the distinction from the mid-run permission-prompt stall, where a live session goes silent and takes the stuck → kill-and-restart path instead of the close-out classification path. Placed in the canonical modes guide next to the existing classification and recovery content.

**F-2 — Stuck-minute defaults documentation.** The mitigation documentation states the true operator knobs and semantics: `DELIVER_STUCK_MINUTES` (default 10; `--stuck-minutes` flag override) for `deliver-ticket.sh`; `CEO_LOOP_STUCK_MINUTES` (default 10) for `ceo-loop.sh`; multi-signal liveness (session-message traffic primary, git/worktree activity secondary; a session is stalled only when both signals are quiet for the threshold); the pm-liveness probe variable (`CEO_LOOP_STALL_MINUTES`, default 10) and the fact that both wrappers align it to their own threshold when invoking the probe; tuning guidance (raise the threshold for legitimately long reasoning steps; too-low values cause healthy sessions to be killed and restarted); and that seconds-level overrides exist as test-only accelerators, not operator knobs. All existing doc locations that name the wrong variable for the loop are corrected.

**F-3 — In-flight warning documentation.** The mitigation documentation gives the `JOIN:` warning its operator contract: what it means (a live single-flight owner for the same ticket in this repo working tree; the second invocation joins it and waits), the prescribed action (wait for the owner; do not kill it; do not start a parallel delivery for the same ticket in the same working tree — INV-DM-2), what to expect (the same classified result as the owner), and the supporting probes (`--is-delivering [REF]`; stale-PID state self-heals rather than blocking a legitimate new owner). The repo-local runtime state is referenced at the level already documented (repo-local single-flight state; callers never inspect the state files directly).

**F-4 — pm-notes authoring rule documentation.** The mitigation documentation consolidates the rule in one canonical place: **who** — the PM (`@pm`) is the sole author; **when** — at phase transitions, validated and updated before each commit (the phase-transition-before-commit checkpoint), including retro notes on every phase reopening; **who must not** — delivery agents (e.g., `@coder`) and other delegates do not author or hand-edit pm-notes; they report outcomes to the PM, who records them; **why** — the file is the delivery ledger: artifact-first classification keys `finished` (exit 0) vs `partial` (exit 1) on its completeness, the CEO's merge-not-yield verification reads PM finalization from it, and the future verify-change engine (M0-S8) consumes it as its ledger input — until `ados lint` / `ados phase` (M0-S10) land, ledger integrity is enforced by this documented discipline alone. Cross-linked from the classification context in the modes guide and from the existing "PM Notes are Mandatory" guidance.

**F-5 — Consolidation & accuracy pass.** Each mitigation has exactly one canonical documentation home (DEC-1, DEC-2); related sections cross-link rather than restate. The drift correction is applied everywhere the wrong loop-knob name appears in the affected docs (guide tables, liveness prose, troubleshooting row, system-spec configuration table). All edits keep the existing doc-derived CI guards green (result-tuple enumeration guard, liveness-wording guard, doc-distribution guard).

## 6. USER & SYSTEM FLOWS

```
Flow 1 — Permission denial recognized and recovered (F-1):
  dispatch → PM hits a headless permission request → auto-rejected in the lane log
  → PM exits clean; 0 branch commits → classification: noop-lane-permission (exit 1)
  → operator/agent reads the mitigation doc section
  → confirms trigger from the delivery summary + lane log
  → re-dispatches with a corrected prompt (no interactive permission needed)
  → delivery proceeds normally
  (Contrast: same permission issue mid-run with a live session → silence →
   stuck detection → kill-and-restart — documented as a different path.)

Flow 2 — Stuck threshold tuned correctly (F-2):
  operator observes healthy long-reasoning steps being killed
  → reads the configuration/mitigation section
  → sets CEO_LOOP_STUCK_MINUTES (ceo-loop) / DELIVER_STUCK_MINUTES or
    --stuck-minutes (deliver-ticket) — the names the scripts actually read
  → restarts the loop with the raised threshold; healthy sessions survive

Flow 3 — In-flight warning honored (F-3):
  second dispatch for a ticket with a live owner
  → JOIN: live delivery for <REF> (pid=…); waiting
  → operator/agent waits (does not kill the owner, does not force a parallel delivery)
  → owner finishes → joiner returns the same classified result

Flow 4 — pm-notes ledger maintained (F-4):
  @pm completes a phase → validates the outcome → updates pm-notes
  (phase timestamps, decisions, open questions; retro note on reopen)
  → then triggers @committer
  → close-out classification reads pm-notes completeness (finished vs partial)
  → later, verify-change (M0-S8) consumes the same ledger
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- **`doc/guides/delivery-modes.md`** — primary consolidation target (mitigations F-1, F-2, F-3):
  - A consolidated interim-mitigations subsection covering permission-denial recognition/recovery and the in-flight `JOIN:` warning contract, placed beside the existing classification/recovery content.
  - Knob-name corrections: `CEO_LOOP_STALL_MINUTES` → `CEO_LOOP_STUCK_MINUTES` in the ceo-loop configuration table, the liveness prose, and the troubleshooting row; document the pm-liveness probe variable and wrapper alignment in the configuration table.
  - Stuck-minute tuning guidance (defaults 10, multi-signal semantics, raise-for-long-reasoning guidance, test-only seconds seams) folded into the existing configuration content rather than duplicated.
  - A cross-link from the classification table context (`finished`/`partial` rows) to the pm-notes authoring rule.
- **`doc/spec/features/feature-autonomous-delivery.md`** — factual system-spec sync: correct the ceo-loop stuck-knob row in the configuration table (DEC-5); keep the liveness-wording guard green.
- **`doc/guides/change-lifecycle.md`** — the canonical pm-notes authoring rule (who / when / who must not / why) added to the existing PM Notes Structure section (F-4).
- **`doc/guides/opencode-agents-and-commands-guide.md`** — one-line extension of the existing "PM Notes are Mandatory" best-practice bullet pointing to the canonical rule (discoverability only; no restatement).
- All edited docs retain their existing `ados_distribution` markers; the change passes the doc-distribution guard.

### 7.2 Out of Scope

- [OUT] Any change under `scripts/**` or `tools/**`, including fixes for the two known script-side naming inaccuracies (ceo-loop usage-text knob name; ceo-loop seconds-seam comment name).
- [OUT] New configuration knobs, a new config file, or wiring the GH-173 config layer into the bash scripts.
- [OUT] Changes to runtime behavior: classification ladder, liveness detection, JOIN/single-flight mechanics, pm-notes schema.
- [OUT] Engine work (`ados` CLI, typed engines) and documentation of not-yet-landed engine behavior as current.
- [OUT] New standalone mitigation guide files (consolidation into existing guides instead — DEC-1).
- [OUT] Re-documenting already-accurate tables elsewhere (e.g., the Mode B operations guide's `DELIVER_STUCK_MINUTES` row is correct as-is and is left untouched).
- [OUT] Any change under `.ai/local/**` (ephemeral, git-ignored runtime state).

### 7.3 Deferred / Maybe-Later

- Fix `ceo-loop.sh`'s usage text (it misnames its own stuck knob) and the seconds-seam comment naming — requires a shell-allowed change; tracked as bash-era debt to fold into the engines' replacement work or a future maintenance change.
- Wiring the bash wrappers to the GH-173 config layer (typed config consumption by the scripts) — belongs to the engine-replacement milestones.
- Replacing the documented interim mitigations entirely: when the typed engines land, each mitigation section is retired or rewritten against engine behavior (doc-syncer reconciliation).

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — no endpoints are added or changed.

### 8.2 Events / Messages

N/A — no events or messages are added or changed. The log line `JOIN: live delivery for <REF> (pid=…); waiting` and the delivery-summary result tokens are existing script outputs; this change only documents them.

### 8.3 Data Model Impact

No persistent data model changes. The documentation pins the following **existing** contracts as documented truth (all verified against current script behavior):

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Stuck-minute configuration contract | `DELIVER_STUCK_MINUTES` (default 10; `--stuck-minutes` flag) for `deliver-ticket.sh`; `CEO_LOOP_STUCK_MINUTES` (default 10) for `ceo-loop.sh`; `CEO_LOOP_STALL_MINUTES` (default 10) is the pm-liveness probe threshold, aligned by both wrappers to their own threshold at probe invocation; seconds-level overrides (`DELIVER_STUCK_SECONDS`; ceo-loop's internal seconds seam) are test-only accelerators, not operator knobs. Liveness is multi-signal: session-message traffic primary, git/worktree activity secondary. |
| DM-2 | Permission-denial classification contract | Result token `noop-lane-permission`: emitted when a clean PM close-out finds zero branch commits **and** the per-ticket lane log carries the headless permission auto-reject signature; exit 1; guidance "re-dispatch with a corrected prompt". Distinct from the mid-run stall path (silent live session → stuck → kill-and-restart). |
| DM-3 | Single-flight / JOIN contract | Repo-local single-flight state per ticket (repo working tree scope); a second invocation for a ticket with a live owner JOINs it, logs `JOIN: live delivery for <REF> (pid=…); waiting`, waits, and returns the same classified result; `--is-delivering [REF]` probes for a live delivery; stale state self-heals rather than blocking a legitimate new owner. Invariants: INV-DM-1 (foreground), INV-DM-2 (single-flight + join, per repo working tree). |
| DM-4 | pm-notes ledger contract | `chg-<workItemRef>-pm-notes.yaml`: mandatory, PM-authored, updated at phase transitions before each commit; completeness drives `finished` (exit 0) vs `partial` (exit 1) classification; consumed by merge-not-yield verification and, from M0-S8, by verify-change. |

### 8.4 External Integrations

N/A — no external services are added or changed.

### 8.5 Backward Compatibility

- Fully backward compatible: documentation-only change; no runtime, interface, configuration, or schema changes. Readers of the existing guides see corrected and expanded content at the same locations (plus one consolidated subsection); no links break (no files are added, removed, or renamed).

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Docs/config-only diff | 0 changed paths under `scripts/**` and `tools/**` in this change's diff; all changed files under `doc/**` |
| NFR-2 | Grounded documentation | 100% of the four mitigation sections' behavioral claims verifiable against current script behavior at review time; 0 claims describing behavior that does not exist today |
| NFR-3 | Distribution guard | `bash scripts/.tests/test-doc-distribution.sh` passes on the change branch (edited guides keep their `ados_distribution` markers) |
| NFR-4 | No duplication | Exactly 1 canonical home per mitigation; related sections cross-link; 0 restated rule bodies |
| NFR-5 | Current-truth only | 0 statements of future engine behavior written as current behavior; forward references explicitly framed as not yet landed |
| NFR-6 | Existing doc-derived guards stay green | Result-tuple doc guard, liveness-wording grep guard, and the affected guides' structure checks all pass after the edits |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

N/A — no new telemetry. The change documents how to read existing observability surfaces (delivery summary result tokens, lane log signatures, the `JOIN:` log line); it adds no logging, metrics, or alerts.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Documented mitigations drift from actual script behavior (docs assert what the scripts no longer do) | H | M | Ground every claim in the current scripts before writing (done at spec time; re-verified at review per NFR-2); mitigation content lives beside the existing guarded tables the doc-derived CI checks already pin (NFR-6) | Low |
| RSK-2 | Consolidation turns into duplication (the same rule restated in several guides, re-creating drift) | M | M | One canonical home per mitigation (DEC-1, DEC-2; NFR-4); other locations get cross-links only | Low |
| RSK-3 | Docs now name the correct knob, but `ceo-loop.sh`'s own usage text still misnames it — an operator reading `--help` gets the wrong name from the script | M | H (already true today) | The troubleshooting/mitigation content explicitly names this as a known bash-era rough edge and gives the correct knob; the script-side fix is deferred (§7.3) and disappears with the engines | Medium (bounded bash-era debt, removed at engine replacement) |
| RSK-4 | Editing the system spec (`feature-autonomous-delivery.md`) outside the doc-syncer phase creates reconciliation churn | L | L | The edit is a minimal factual correction of one configuration row (DEC-5); phase 7 (`system_spec_update`) re-reconciles the spec with implementation as usual | Low |
| RSK-5 | The JOIN documentation encourages operators to hand-inspect or delete the repo-local runtime state files | M | L | The documentation prescribes operator actions only at the CLI/log level (wait, probe, re-dispatch) and repeats the existing "do not manage the runtime state manually" guidance (F-3) | Low |
| RSK-6 | Quoted log signatures or examples in docs trip the privacy/no-cloud guards | M | L | Quote only generic, non-identifying strings (result tokens, generic REF placeholders, the JOIN line shape); no private literals (NFR-3 guard battery catches regressions) | Low |

## 12. ASSUMPTIONS

- The bash-era loop (`deliver-ticket.sh`, `ceo-loop.sh`, `pm-liveness.sh`) remains the delivery engine until the typed engines replace it; the mitigations are explicitly interim and will be retired with the bash stack.
- The verified facts in §2.1 and §8.3 reflect the current scripts at spec time; if the scripts move before delivery, the mitigation docs follow the moved behavior (grounding is re-checked at review).
- Operators and agents read `doc/guides/delivery-modes.md` and `doc/guides/change-lifecycle.md` as the canonical surfaces for delivery-mechanics and lifecycle-discipline questions, respectively.
- The M0-S8 verify-change engine and M0-S10 `ados lint` / `ados phase` are not yet available, so the pm-notes rule is enforced by documented discipline only.
- "Config only" in the ticket means the existing configuration surface (environment variables, CLI flags) documented accurately — not new configuration (NG-2), since any new knob or wiring would be shell feature work.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | M0-S4 config layer (GH-173) | Delivered on `main-tools`; establishes the typed configuration foundation the bash era does not yet consume (context for NG-2) |
| Depends on | Current bash-era delivery scripts | Documentation subjects only — `deliver-ticket.sh`, `ceo-loop.sh`, `pm-liveness.sh` (unchanged by this change) |
| Depends on | Existing guides + system spec | Edit targets: `delivery-modes.md`, `change-lifecycle.md`, `opencode-agents-and-commands-guide.md`, `feature-autonomous-delivery.md` |
| Depends on | Doc-derived CI guards | Result-tuple doc guard, liveness-wording guard, doc-distribution guard must stay green (NFR-3, NFR-6) |
| Blocks | Nothing directly | The documented mitigations unblock safer autonomous operation until the engines land; verify-change (M0-S8) benefits from the documented pm-notes ledger rule |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | None open at spec time | Doc targets, knob-name corrections, and the no-new-config position are decided here (DEC-1…DEC-6); the script-side naming fixes are consciously deferred (§7.3), not undecided | Closed — no decision needed |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Consolidate mitigations F-1–F-3 into the existing canonical modes guide; no new standalone mitigation guide | The guide already owns classification, recovery semantics, configuration, and troubleshooting; a new file would duplicate its scope and add a distribution-marker burden | 2026-10-31 |
| DEC-2 | The pm-notes authoring rule canonically lives in the change-lifecycle guide's PM Notes section; other surfaces get one-line cross-links only | The lifecycle guide already owns phase discipline, the phase-transition-before-commit checkpoint, and the pm-notes structure; splitting the rule would invite drift (NFR-4) | 2026-10-31 |
| DEC-3 | No new configuration knobs; the "config" leg = documenting the existing env-var/flag surface accurately | Any new knob or config-layer wiring requires shell changes — prohibited by the ticket; the existing surface already provides the needed tuning (DM-1) | 2026-10-31 |
| DEC-4 | Correct `CEO_LOOP_STALL_MINUTES` → `CEO_LOOP_STUCK_MINUTES` everywhere it is presented as the ceo-loop knob; explain the pm-liveness probe variable separately; document the script-side usage-text inaccuracy as a known bash-era rough edge | The scripts read `CEO_LOOP_STUCK_MINUTES`; docs naming `CEO_LOOP_STALL_MINUTES` as the loop knob instruct operators to tune a variable the loop never reads | 2026-10-31 |
| DEC-5 | Fix the system-spec configuration row in this change (not deferred to doc-syncer) | The wrong knob name is operator-facing factual error in the current-truth spec; a one-row correction is cheaper and safer than shipping a change that knowingly leaves the system spec wrong | 2026-10-31 |
| DEC-6 | Documentation states current behavior only; engine-future references (`verify-change` M0-S8, `ados lint`/`ados phase` M0-S10) are explicitly framed as not yet landed | The ticket requires docs describing current behavior; future-tense-as-present is exactly the drift class this change eliminates (NFR-5) | 2026-10-31 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `doc/guides/delivery-modes.md` | Updated — consolidated interim-mitigations subsection (permission denial, JOIN warning contract), stuck-knob name corrections, tuning guidance, cross-link to pm-notes rule |
| `doc/spec/features/feature-autonomous-delivery.md` | Updated — one factual configuration-row correction (ceo-loop stuck knob name) and probe-variable clarification |
| `doc/guides/change-lifecycle.md` | Updated — canonical pm-notes authoring rule added to the PM Notes section |
| `doc/guides/opencode-agents-and-commands-guide.md` | Updated — one-line pointer from the "PM Notes are Mandatory" bullet to the canonical rule |
| `scripts/**` | Unchanged — documentation subjects only (hard constraint, NFR-1) |
| `tools/**` | Unchanged — hard constraint (NFR-1) |
| `.ai/local/**` | Unchanged — ephemeral runtime state, out of scope |

## 17. ACCEPTANCE CRITERIA

> Each criterion references at least one F-/DM-/NFR- ID and uses Given/When/Then. All ACs are verifiable against the change's diff (docs/config) or against guard/grep runs.

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** the delivered docs, **when** an operator looks up the `noop-lane-permission` result, **then** the documentation states its trigger (zero branch commits + headless permission auto-reject signature in the per-ticket lane log), its outcome (exit 1), and the recovery path (re-dispatch with a corrected prompt, explained in practice), matching current script behavior (DM-2). | F-1, DM-2, NFR-2 |
| AC-F1-2 | **Given** the delivered docs, **when** a reader compares the two permission-related failure modes, **then** the documentation distinguishes the close-out path (clean exit, 0 commits, signature → `noop-lane-permission`) from the mid-run stall path (live session goes silent → stuck → kill-and-restart) as different mechanisms with different remedies. | F-1, DM-2 |
| AC-F2-1 | **Given** the delivered docs, **when** any location presents the ceo-loop stuck threshold as an operator knob, **then** it is named `CEO_LOOP_STUCK_MINUTES` (default 10) — and a repo-wide search of the edited docs finds 0 locations presenting `CEO_LOOP_STALL_MINUTES` as the ceo-loop knob; the pm-liveness probe variable and wrapper alignment are explained where the probe is described (DM-1, DEC-4). | F-2, F-5, DM-1 |
| AC-F2-2 | **Given** the delivered docs, **when** an operator reads the stuck-minute configuration, **then** it documents `DELIVER_STUCK_MINUTES` (default 10, `--stuck-minutes` override), the multi-signal liveness semantics (session-message traffic primary, git/worktree activity secondary), tuning guidance for legitimately long reasoning steps, and that seconds-level overrides are test-only seams, not operator knobs (DM-1). | F-2, DM-1, NFR-2 |
| AC-F3-1 | **Given** the delivered docs, **when** an operator or agent encounters the `JOIN: live delivery for <REF> (pid=…); waiting` log line, **then** the documentation explains its meaning (a live single-flight owner was joined), the prescribed action (wait; do not kill the owner; never run a parallel delivery of the same ticket in the same repo working tree), the expected outcome (the same classified result), and mentions the `--is-delivering` probe and stale-state self-healing (DM-3). | F-3, DM-3 |
| AC-F4-1 | **Given** the delivered docs, **when** a reader wants the pm-notes authoring rule, **then** exactly one canonical section states it: the PM is the sole author; updates happen at phase transitions before each commit (including retro notes on reopens); delivery agents do not author or hand-edit pm-notes; and the rationale is explicit (completeness drives `finished` vs `partial`, merge verification reads it, verify-change will consume it) — with the "PM Notes are Mandatory" bullet and the modes-guide classification context cross-linking to it without restating the rule body (DM-4, DEC-2). | F-4, DM-4, NFR-4 |
| AC-NFR1-1 | **Given** this change's diff, **when** the changed paths are enumerated, **then** 0 changed paths match `scripts/**` or `tools/**` and 100% of changed files are under `doc/**` (hard negative constraint — docs/config only). | NFR-1 |
| AC-NFR2-1 | **Given** the delivered mitigation sections, **when** each behavioral claim is checked against the current scripts (result tokens, knob names, defaults, log-line shape), **then** every claim matches current behavior and 0 claims present future engine behavior as current (NFR-2, NFR-5). | F-1, F-2, F-3, F-4, NFR-2, NFR-5 |
| AC-NFR3-1 | **Given** the change branch, **when** `bash scripts/.tests/test-doc-distribution.sh` runs, **then** it passes (edited guides retain their distribution markers). | NFR-3 |
| AC-NFR6-1 | **Given** the edited docs, **when** the existing doc-derived guards run (result-tuple doc guard; liveness-wording grep guard), **then** all pass unchanged in their semantics. | F-5, NFR-6 |
| AC-F5-1 | **Given** the four mitigations, **when** the edited docs are searched, **then** each mitigation has exactly one canonical rule body and all other mentions are cross-links (0 duplicated rule bodies). | F-5, NFR-4 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Single PR on the change branch delivering only documentation edits; no feature flags, no migration, no coordinated rollout.
- Adoption is immediate on merge: operators and agents reading the guides get the corrected knob names and the mitigation contracts; no deprecation or transition communication is needed.
- On merge, the mitigations are in force as documented discipline; the ticket closes against its AC (docs/config only, no shell behavior changes).

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A — no data is created, migrated, or seeded. Documentation only.

## 20. PRIVACY / COMPLIANCE REVIEW

- No personal data, credentials, or cloud references are introduced. Documentation examples quote only generic, non-identifying strings (result tokens, placeholder ticket refs, the generic `JOIN:` line shape) — keeping the privacy/no-cloud guard battery green (RSK-6).

## 21. SECURITY REVIEW HIGHLIGHTS

- The change grants no permissions and alters no permission behavior; it documents existing permission-denial handling so operators can recover without weakening the permission posture (recovery = corrected prompt or out-of-band permission grant by operator policy — the docs prescribe no bypass of the permission mechanism).
- Documentation of the single-flight rule reinforces a security-relevant invariant (no racing deliveries on one working tree).

## 22. MAINTENANCE & OPERATIONS IMPACT

- The mitigation sections are explicitly interim: when the typed engines replace the bash stack, doc-syncer retires or rewrites them against engine behavior (§7.3).
- Until then, any script change touching the documented contracts (result tokens, knob names/defaults, JOIN log line, pm-notes classification) must update the mitigation sections in the same change — the docs now pin these contracts as canonical truth, and the existing doc-derived guards continue to enforce the pinned enumerations.
- Known bash-era debt recorded (not fixed here): the `ceo-loop.sh` usage-text knob misname and the seconds-seam comment naming — deferred to a shell-allowed change (§7.3, RSK-3).

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Bash-era loop | The current shell delivery stack (`deliver-ticket.sh`, `ceo-loop.sh`, `pm-liveness.sh`, `batch-deliver.sh`) pending replacement by the typed engines |
| Interim mitigation | A documented (or existing-config) workaround for a known bash-era rough edge, in force until the engines replace the behavior |
| `noop-lane-permission` | Close-out result: zero branch commits + headless permission auto-reject signature in the lane log; exit 1; re-dispatch with a corrected prompt |
| Headless permission auto-reject | A permission request raised by the agent in an unattended session that the harness auto-rejects, recorded in the per-ticket lane log |
| Stuck threshold | Minutes of quiet (both liveness signals) before a session is declared stalled and killed/restarted |
| Multi-signal liveness | Liveness = recursive session-message traffic (primary) OR git/worktree activity (secondary); both quiet for the threshold ⇒ stalled |
| `CEO_LOOP_STUCK_MINUTES` | The ceo-loop stuck threshold env var (default 10) — the knob the script actually reads |
| `CEO_LOOP_STALL_MINUTES` | The pm-liveness probe threshold env var (default 10); both wrappers align it to their own threshold at probe invocation — not the ceo-loop knob |
| Single-flight / JOIN | One live delivery per ticket per repo working tree; a second invocation joins the owner, logs the in-flight warning, waits, and returns the same classified result (INV-DM-2) |
| pm-notes | `chg-<workItemRef>-pm-notes.yaml` — the mandatory, PM-authored per-change delivery ledger; completeness drives `finished` vs `partial` classification |
| Phase-transition-before-commit | The checkpoint discipline: the PM validates an outcome and updates pm-notes before triggering a commit |

## 24. APPENDICES

- **Appendix A — Verified grounding evidence (spec-time):** result token `noop-lane-permission` classification and exit path in the close-out logic of `deliver-ticket.sh` (artifact ladder arm O-5 + decision arm; operator guidance line "…re-dispatch with a corrected prompt"); `DELIVER_STUCK_MINUTES` default 10 and `--stuck-minutes` flag in `deliver-ticket.sh`; `CEO_LOOP_STUCK_MINUTES` default 10 and its positive-uint validation in `ceo-loop.sh`; `CEO_LOOP_STALL_MINUTES` as the pm-liveness probe threshold aligned by both wrappers at invocation; `JOIN: live delivery for <REF> (pid=…); waiting` emitted by the join path; `--is-delivering` probe with stale-PID self-healing; repo-local single-flight state under `.ai/local/delivery/`; `finished`/`partial` keyed on pm-notes completeness with the "resume the SAME branch" guidance. Doc-side: the classification table, recovery-semantics rows, and configuration tables in `delivery-modes.md`; the INV-DM-1/2 rows and configuration table in `feature-autonomous-delivery.md`; the "PM Notes are Mandatory" bullet and phase-boundary update guidance in the lifecycle docs.
- **Appendix B — Known drift items corrected by this change:** `delivery-modes.md` presents `CEO_LOOP_STALL_MINUTES` as the ceo-loop knob in the liveness prose, the ceo-loop configuration table, and the troubleshooting row; `feature-autonomous-delivery.md` does so in its configuration table. All four locations are corrected (DEC-4, DEC-5).

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-31 | @spec-writer | Initial specification from GH-185 ticket + M0-S16 backlog story + pm planning summary; all behavioral claims verified against the current scripts and docs at spec time |

---

## AUTHORING GUIDELINES

- **Sources:** GitHub issue GH-185 (M0-S16, milestone M0: Trust substrate); `doc/planning/oss-tooling/backlog.md` §M0-S16; `chg-GH-185-pm-notes.yaml` (PM planning summary and scope analysis); direct verification against the current scripts (`deliver-ticket.sh`, `ceo-loop.sh`, `pm-liveness.sh`) and current docs (`delivery-modes.md`, `feature-autonomous-delivery.md`, `change-lifecycle.md`, `opencode-agents-and-commands-guide.md`, `autonomous-batch-delivery.md`); GH-173 spec for the config-layer dependency context.
- **Verification-first:** every behavioral claim in §2.1, §5.1, and §8.3 was checked against the current scripts at spec time (classification arms and exit codes, default values, flag names, the join log line, the pm-liveness threshold alignment, pm-notes-driven `finished`/`partial` classification). The `CEO_LOOP_STALL_MINUTES`/`CEO_LOOP_STUCK_MINUTES` drift was discovered during this verification and is promoted to a first-class correction (DEC-4).
- **Docs/config only as a design constraint:** the change's own deliverable is documentation; the "config" leg is realized as accurate documentation of the existing configuration surface (DEC-3), because new configuration would require prohibited shell work.
- **Consolidation over proliferation:** the spec names concrete doc targets and deliberately creates no new files (DEC-1, DEC-2), keeping the distribution-marker situation unchanged and the canonical-home rule (NFR-4) checkable.
- **No implementation detail:** scripts are named only as unchanged documentation subjects (repo house style for component-level naming); no line numbers, edits, or tasks are prescribed for them.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-185)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, DM-, NFR-, RSK-, DEC-, OQ-, AC-)
- [x] Acceptance criteria reference at least one F-/DM-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values (0-path diff, 100% grounded claims, 0 duplicated rule bodies, guard-pass thresholds)
- [x] Risks include Impact & Probability (H/M/L)
- [x] No implementation details (no code-level instructions; scripts named as unchanged subjects only)
- [x] Out-of-scope items prefixed `[OUT]`
- [x] Negative constraint AC present (AC-NFR1-1: zero `scripts/**`/`tools/**` changes)
- [x] Front matter validates per front_matter_rules
