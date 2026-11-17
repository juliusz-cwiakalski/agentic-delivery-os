---
id: chg-GH-335-test-plan
status: Updated
created: 2026-11-17T00:00:00Z
last_updated: 2026-11-18T12:00:00Z
owners: [engineering]
service: "delivery-os harness plane (harness port, opencode adapter, version gate, profile propagation, telemetry extraction)"
labels: [m3, harness, opencode, telemetry, version-gate, conformance, decision-record]
version_impact: minor
summary: "Traceable verification of M3-S1 opencode v2.x harness and telemetry against the observed v2.2.5 surfaces. The version gate: one production probe whose accepted output grammar and normalization are pinned (`opencode v2.2.5` -> `2.2.5`, raw line diagnostic only) and whose 5 s bound is enforced through a declared deadline seam and asserted as such, evaluated once per dispatch before any session exists, refusing out-of-window versions with `harness.version.unsupported` and indeterminate versions with the distinct `harness.version.unknown`. The mode: exactly one declared integration mode drawn from the observed surfaces (`standalone` delivered default, `background-service`, `server-client`), never a runtime fallback, any other requested mode refused with `harness.mode.unavailable`, and a decision record whose chosen mode equals the delivered constant. Propagation: one spawn binds exactly one seat (TDR-0032, DEC-13) - a harness-neutral per-spawn binding record naming the agent identity the run names, the seat the resolved profile assigns that agent, and that seat's resolved model, mapped onto the surface the harness honours; for opencode exactly one `run --agent <agent>` and one `run --model provider/model[#variant]` per invocation, because the installed harness exposes no per-seat model variable family (DEC-8, OQ-2 closed). A profile's N seats are N spawns, N sessions and N row sets; a role-less spawn binds nothing, whatever the profile's seat count, and is disclosed as `unresolved-seat`; a named agent a multi-seat profile does not assign refuses pre-session through the delivered `provider.profile.invalid`; plus record-over-ambient precedence and undeclared-name neutrality where a harness consumes variables, and `harness.profile.model-unrepresentable` for a seat model the honoured surface cannot express. Telemetry: per-seat rows inside the unchanged `delivery.harness.telemetry.v1` identity, attributed by every session identity the run holds (one per spawn/resume) together with the run's recorded binding, and sourced only from the observed store contract (DM-10: `session_v2`/`session_message` current generation, legacy `session`/`message`/`part` tolerated, no work-item or harness-version column, no per-message token columns, no `part.tool` column), stamping the session record's own normalized version and carrying the seat and resolved model from the recorded binding beside the harness-reported agent and the never-overwritten observed model, with divergence warned on both the model and the agent axis and the binding's seat attaching only to the group whose observed agent matches (every other group null seat with `unresolved-seat`), the five token classes, calls, store-reported cost (a reported zero kept as zero, no cost source null and never zero) and store-timestamp durations absent only when the timestamp pair is missing. Absence: a three-way capture taxonomy (session not held = absence, optional fields absent = degraded with warnings, unreadable store = extraction failure) disclosed inside the delivered capture envelope, the delivered `spend.telemetry-absent` read side untouched, closeout capture non-gating, and no `harness.telemetry.absent` identity (DEC-10). Disclosure: the four new refusal identities carry the declared `detail.harness` envelope member (kind, observedVersion, versionVerdict, mode omitted when unresolved - TDR-0031) and no other failure carries it; the unassigned-agent refusal states its agent, profile and seat facts in the bounded `error.summary` and adds no member (Amendment A-2). Conformance: a four-id additive extension (version-window, version-unknown, mode-unavailable, profile-propagation) executed by an additive scenario executor while the delivered six-id floor constant stays exact. One human-gated live observation on an invocation that names an agent, never a CI oracle; only AC-F5-6 and the live half of AC-F3-1 are deferrable, and only with recorded human/PM acceptance (§17.2 clause 1)."
links:
  change_spec: ./chg-GH-335-spec.md
  implementation_plan: ./chg-GH-335-plan.yaml
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M3-S1: opencode v2.x harness and telemetry

## 1. Scope and Objectives

This change makes a dispatch either run on a compatible harness with the resolved profile expressed on a surface the harness actually honours, or refuse with a typed, actionable identity — and it makes the telemetry it lands readable from the store that exists rather than from the store the delivered extractor assumed. Five properties are load-bearing and each is tested independently so weakening one cannot hide behind another.

**First, the version gate must decide before a session exists, and it must be honest about what it read.** The supported window ships as pinned data (`2.2.x` plus `2.1.x` at intake), is evaluated once per dispatch at harness resolution — the single production probe point — and carries one verdict on the instance every consumer reads (AC-F1-1). A version outside the window refuses with `harness.version.unsupported` at exit 1 and starts no session (AC-F1-2, the pinned blueprint scenario TC-M3-HARNESS-002). A version that cannot be probed or parsed refuses with the distinct `harness.version.unknown`, keeps `observedVersion === null`, and never fabricates a version or passes silently (AC-F1-3, DEC-3). The probe's accepted output grammar and normalization are pinned from the observed line — `opencode v2.2.5` becomes the bare `2.2.5`, the raw line is diagnostic only, and empty, non-zero, timed-out, multi-line or non-matching output is indeterminate — so a naive substring or partial match cannot widen acceptance and a bare-semver assumption cannot refuse every dispatch (AC-F1-5, DEC-11). NFR-2's 5 s bound is verified through the declared deadline seam the implementation must introduce (§4.4a), not through a wall-clock assertion in CI (GAP-3). No configuration key widens or narrows the window (AC-F1-4).

**Second, the mode is declared, not inferred, and the profile is propagated on the surface the harness honours.** Exactly one integration mode is the delivered default, drawn from the surfaces the installed harness exposes; a dispatch never falls back between modes (AC-F2-1); any other requested mode refuses with `harness.mode.unavailable` naming both values before any spawn (AC-F2-3); the mode lives on the harness configuration branch with a `defaults` origin when omitted and a refusal — never a silent default — for an unknown value (AC-F2-4); and a decision record states the chosen mode, with the read-only direct-store rationale, and is linked from the change and the harness feature spec (AC-F2-2). The installed harness exposes no per-seat model variable family (OQ-2 closed, zero `OC_*` tokens in the binary), so the propagation contract is a harness-neutral binding record mapped per adapter (DEC-8, TDR-0032): for opencode the observed per-invocation `run --agent` / `run --model provider/model[#variant]` selection, and for a variable-consuming harness the declared variable name. **One spawn binds exactly one seat** — the seat the resolved profile assigns to the agent the run names (`agentOverrides`, else the seat bearing that name, else the profile's single declared seat) — and a profile's N seats are N spawns, each its own session and its own row set; a spawn that names no agent binds nothing, whatever the profile's seat count, sends no `--agent`/`--model`, and is disclosed as `unresolved-seat`. The binding is carried as data per spawn, a record value beats a conflicting ambient parent value, undeclared record names change nothing, a seat model that cannot be expressed on the honoured surface refuses with `harness.profile.model-unrepresentable` before any session exists, and a named agent a multi-seat profile assigns no seat refuses likewise with the delivered `provider.profile.invalid` and no attempt record (AC-F3-1..AC-F3-4, DEC-13, DEC-14). The identical contract drives deliver, resume and attach, which continue one session identity with the tree root preserved (AC-F4-1).

**Third, telemetry must be sourced from the observed store and attribute without fabricating or double counting.** Every landed row keeps the schema identity `delivery.harness.telemetry.v1`, is attributed by every session identity the run holds (one per spawn/resume) together with the run's recorded binding, stamps the session record's own normalized version, and carries the seat and resolved model from the recorded binding beside the harness-reported agent and observed model, the five token classes, calls, store-reported cost and store-timestamp durations (AC-F5-1, AC-F5-5). Fixtures derive from the recorded contract (DM-10, Appendix C): the current `session_v2`/`session_message` generation and the legacy `session`/`message`/`part` generation, with no work-item column, no separate harness-version column, no per-message token columns, and no `tool` column on the legacy `part` table. Pre-change rows stay readable and unchanged with additions only (AC-F5-2, DEC-4). A resolved-versus-observed model divergence, a binding-agent-versus-observed-agent divergence — the signal that the harness did not run the named agent — and the probed-versus-stored version divergence each keep both values and disclose themselves with a closed-vocabulary warning, never reconciling by overwrite; the binding's seat attaches only to the group whose observed agent equals the binding's agent, every other group carrying a null seat with `unresolved-seat` (AC-F5-3, DEC-5, DM-5, DM-9). Durations come from the store's timestamp pairs and are explicitly absent with a warning only when the pair is missing; they are never derived from the capture timestamp (AC-F5-4, DM-6). A reported zero cost is recorded as the reported zero — the store contains free models with non-zero tokens — while a store with no cost source yields null: zero is never a substitute for absence and absence is never a substitute for a reported zero (NFR-6). Seat attribution is an added dimension, not a second reading basis, so session totals stay single-counted (RSK-7).

**Fourth, absence must stay classified inside the delivered envelopes, not invented as a new surface.** The capture envelope distinguishes three outcomes: a session the readable store does not hold is an absence, a held session whose optional fields are absent is degraded with warnings, and a held session with no observable usage fact is a failed-session entry — while an unreadable store keeps the delivered `harness.telemetry.extraction-failed` and is never re-projected as absence (AC-F6-2, DEC-9). The work-item read side keeps the delivered `spend.telemetry-absent` meaning untouched, closeout capture stays non-gating, no command, verb or exit projection is added, and **no `harness.telemetry.absent` identity exists** (AC-F6-1, DEC-10). A zero-row capture for a session the dispatch ran and the store can read is a failure, never a clean pass (AC-F5-1).

**Fifth, conformance, disclosure and offline hygiene must make regression visible.** The registry keeps exactly the two shipped harnesses and their six-scenario classification floor (AC-F7-1), gains a four-id extension — version-window, version-unknown, mode-unavailable, profile-propagation — as data on the same registry, executed by an additive scenario executor, and fails a harness or an identity that is missing one while naming both (AC-F7-2). It runs with zero live harness invocations (AC-F7-3). Every refusal carries a closed identity with a stable code, a projection-derived exit and a non-empty remediation hint, discloses the harness facts through the declared `detail.harness` envelope member and on no other failure (TDR-0031), and leaves no session-bearing side effect; the single bounded probe is the declared exception, at most one per dispatch, completed and reaped before the verdict (AC-N1-1). Every new test runs offline against simulated harness I/O and fixture stores with no network, no credentials and no live harness store; the one permitted live observation is human-gated, outside `bun test`, and never an oracle (AC-F5-6, NFR-10).

This is a design and verification map, not an execution claim: no suites were run while authoring it.

### 1.1 In Scope

- Supported-version window as pinned data: no configuration key widens or narrows it, the three value verdicts (inside, outside, indeterminate) carried on the instance, and the one-evaluation-per-dispatch rule (F-1, DM-1, DM-2, AC-F1-1, AC-F1-4).
- Out-of-window refusal `harness.version.unsupported` at exit 1 with remediation naming the supported lines and zero spawned sessions (F-1, AC-F1-2, NFR-1, pinned TC-M3-HARNESS-002).
- Indeterminate refusal `harness.version.unknown` as a distinct identity, explicit-unknown observation, preserved `version-probe-failed` warning, and zero fabrication (F-1, AC-F1-3, NFR-6, DEC-3).
- Probe output grammar and normalization: product token, optional `v`, three-part semantic version, newline-terminated; `opencode v2.2.5` → `2.2.5`; raw line diagnostic only; empty, non-zero, timed-out, multi-line and non-matching output indeterminate; never a substring or partial match (F-1, AC-F1-5, DM-2, DEC-11).
- Probe bound: one bounded shell-free invocation per dispatch, the deadline carried on the declared probe seam and mapped to the runner's timeout, a `timed-out` outcome yielding an indeterminate verdict, no retry loop (NFR-2, RSK-8, §4.4a).
- Integration-mode declaration drawn from the observed surfaces (`standalone` delivered default with the per-invocation private server, `background-service` via `service start|restart|status|stop`, `server-client` via `--server`/`api`): exactly one delivered default, no runtime fallback, `defaults` origin when omitted, refusal for an unknown configured value (F-2, DM-3, AC-F2-1, AC-F2-4, DEC-2).
- `harness.mode.unavailable` refusal naming the requested and available mode before any spawn (F-2, AC-F2-3, NFR-1).
- Integration-mode and adapters-contract decision records authored in-change, with the chosen mode equal to the delivered default constant and the read-only direct-store rationale recorded (F-2, G-8, AC-F2-2, DEC-7).
- Per-spawn propagation of the resolved binding record as data — exactly one seat per spawn, resolved from the agent the run names — mapped onto the surface the harness honours: exactly one opencode per-invocation `--agent` / `--model provider/model[#variant]` pair, and the declared variable name for a variable-consuming harness; a profile's N seats are N spawns, N sessions and N row sets (F-3, DM-4, AC-F3-1, DEC-8, DEC-13, TDR-0032).
- Record precedence over a conflicting ambient parent value, undeclared-record neutrality, no `OC_*` per-seat variable injected into the opencode spawn, and preservation of the deny-by-default posture (F-3, NFR-9, AC-F3-2, AC-F3-3, RSK-6).
- `harness.profile.model-unrepresentable` refusal naming the seat before any session exists, for a resolved model the honoured surface cannot express; and the delivered `provider.profile.invalid` refusal for a named agent a multi-seat profile assigns no seat, disclosed through the bounded `error.summary` with no `detail.harness` member and no attempt record; an agent or model the harness does not recognise is the harness's own classified spawn failure, not a pre-session refusal (F-3, AC-F3-4, DEC-6, DEC-14, TDR-0032 Amendment A-2).
- Per-spawn (not process-global) propagation semantics across consecutive spawns naming different agents, plus the role-less control: a spawn naming no agent binds nothing against any profile, single-seat included, and a resume never adds a seat (F-3, AC-F3-1, AC-F3-2, TDR-0032 Amendments A-1).
- Identical propagation contract for spawn, deliver and resume; resume/attach identity continuation with the tree root preserved and delivered `harness.session.unknown` semantics retained (F-4, AC-F4-1).
- Per-seat telemetry rows sourced only from the observed store contract: schema identity unchanged, the session record's own normalized version, the seat and resolved model from the run's recorded binding beside the never-overwritten harness-reported agent and observed model, divergence on the model and agent axes, five token classes, calls, store-reported cost with the reported-zero rule, store-timestamp durations or explicit absence (F-5, DM-4, DM-5, DM-6, DM-9, DM-10, AC-F5-1, AC-F5-3, AC-F5-4).
- Session-identity attribution: every session identity the run holds (one per spawn/resume) plus the run's recorded binding for the seat claim is the key, the tree comes from parent links, no work-item or harness-version column is assumed, no store-wide scan, and a run with no recorded session identity yields a classified absence (F-5, DM-8, AC-F5-5).
- Additive-only schema growth with pre-change rows readable unchanged and no new major version (F-5, AC-F5-2, DEC-4).
- Store-generation tolerance across the observed current (`session_v2`/`session_message`/`session_part`) and legacy (`session`/`message`/`part`) generations, including the legacy `part` table's absent `tool` column and the delivered extractor's absent work-item and harness-version columns (NFR-11, DM-10, AC-F5-1, AC-F5-5, RSK-4, RSK-9).
- Single totals basis: seat attribution adds a dimension without double counting per-step rows against the session baseline, and a reported zero cost with non-zero tokens is not collapsed to absence (RSK-7, NFR-6).
- Three-way capture taxonomy inside the delivered capture envelope — absence (session not held), degradation (optional fields absent, warnings), extraction failure (store unreadable) — with the delivered `spend.telemetry-absent` read side untouched and closeout capture non-gating (F-6, AC-F6-1, AC-F6-2, DEC-9, DEC-10).
- Telemetry read discipline: read-only open, query-only pragma before the first read, bounded indexed queries, bounded per-message metadata reads scoped by session and message type, no content projection, caps 64 sessions / 16 agents / 16 models / 24 tools per agent where a populated tool source exists (NFR-3, NFR-5).
- The declared `detail.harness` failure-envelope member (kind, observedVersion, versionVerdict, mode omitted when unresolved) on exactly the four new pre-session refusals and on no other failure, with the closed-member type pin, runtime validator, key-set fixture and documented member set moved two-sidedly; the unassigned-agent refusal states its agent/profile/seat facts in the bounded `error.summary` plus its remediation hint and adds no member (TDR-0031, TDR-0032 Amendment A-2, §8.2 disclosure row, §10).
- Conformance registry extension: the four-id additive extension executed by an additive scenario executor, the delivered six-id floor constant unchanged, and violations naming the harness and the scenario or identity (F-7, DM-7, AC-F7-1, AC-F7-2, AC-F7-3).
- Refusal hygiene: the four new identities declared once with stable codes, projection-derived exits, non-empty remediation hints, additive `HARNESS_FAILURE_CODES` growth, no telemetry-absence identity, and zero session-bearing side effects (AC-N1-1, RSK-5, DEC-10).
- One human-gated live observation, on an invocation that names an agent, of rows captured from the installed in-window harness, recorded in the change folder, outside `bun test`, never an oracle; only AC-F5-6 and the live half of AC-F3-1 are deferrable and only with recorded human/PM acceptance — a role-less run is an `unresolved-seat` observation and is never propagation proof (AC-F5-6, AC-F3-1, spec §17.2 clauses 1 and 4, NFR-10, RSK-1).
- Bounds, privacy, determinism, non-interference and offline hermeticity across every new path (NFR-4, NFR-5, NFR-7, NFR-8, NFR-10).
- Documentation reconciliation: harness feature spec, non-functional harness rows, state/telemetry/spend/result/dispatch pages, decision index and planning status markers reflecting the delivered window, mode, propagation and seat telemetry (G-8, AC-F2-2).
- Test evidence for the pinned blueprint scenarios and every acceptance criterion that is provable offline: TC-M3-HARNESS-001 exercised one seat per spawn — an N-seat profile is N spawns, N sessions and N row sets (DEC-13) — and TC-M3-HARNESS-002 refusing before any session (spec §17.1 traceability note, NFR-10).

### 1.2 Out of Scope & Known Gaps

- [OUT] Extending the Claude Code adapter: it stays a registered generated-artifact surface and is exercised only through the unchanged classification floor and the unchanged registration assertions (NG-1, OQ-M3-01).
- [OUT] Concurrent multi-mode operation, runtime mode fallback, or mode auto-detection from ambient state. Tested only as the *absence* of a second transport attempt (NG-2, AC-F2-1).
- [OUT] A telemetry schema version bump, structural re-shape, or field removal; currency conversion, re-pricing, or cross-model cost normalization (NG-3, NG-6, AC-F5-2).
- [OUT] Backfilling historical sessions with seat or duration facts. Legacy rows are asserted unchanged and *not* enriched (NG-4, AC-F5-2).
- [OUT] Harness store writes of any kind, including harness-side configuration mutation to force model selection. Asserted as a zero-write posture, never exercised as a write path (NG-5, NFR-3).
- [OUT] Provider profile resolution, model selection, pacing, nomination, or cost normalization: consumed as input and seeded as fixtures (NG-6).
- [OUT] Tracker adapters, the parity/trap-catalog suite, and multi-tracker composition (NG-7); background-service supervision, daemonization, or harness health management (NG-8); a new CLI command surface (NG-9).
- [OUT] A `harness.telemetry.absent` identity, a per-session telemetry request surface, or any new telemetry exit projection: the spec pins four new identities, not five, and classifies absence inside the delivered envelopes (DEC-10, NG-9). Asserted as an explicit absence-of-identity check, never implemented.
- [OUT] Real harness stores, live sessions, provider calls, network I/O, and real user state directories on any test path (NFR-10). See §6 for the one human-gated live observation and why it is not a test.
- [GAP-1 — plan mapping must be re-cut — PENDING] `chg-GH-335-plan.yaml` exists and maps `TC-HARNESS-001..041` onto eight phases. This plan now holds forty-six TCs: revision 1.1 added 042–045, revision 1.3 adds 046 (the single production probe construction-site check), and the seat rule is restated to TDR-0032/DEC-13 with ten surviving TCs reshaped (§11.3), so the plan must re-cut the TC→phase map and the affected scope files without reshaping any TC's behaviour, oracle, identity, exit, bound or AC/NFR mapping beyond what §11.3 records. See §11 and §7; owners `@plan-writer`.
- [GAP-2 — human-gated, non-blocking: the live half of propagation and of telemetry is AC-F5-6 plus a Definition-of-Done clause, never a CI oracle] Offline tests prove the resolved binding reaches the honoured surface (exactly one recorded `--agent`/`--model` pair per invocation) and that a simulated harness double reports back the model it was given. They cannot prove that a real harness runs it. **Only AC-F5-6 and the live half of AC-F3-1 are deferrable**, and only when the deferral is accepted and recorded by the human owner or `@pm` in the change's evidence and every offline criterion proving the same contract stays green (spec §17.2 clause 1); no other criterion may be deferred. The observation runs on an invocation that names an agent, is recorded in the change folder, runs outside `bun test`, and is never consulted by any TC (RSK-1, NFR-10). AC-F3-1 is covered offline **and** bounded by that named human gate; it is never claimed as proven by a fixture.
- [GAP-3 — non-blocking: NFR-2's 5 s wall-clock bound is not a CI threshold, but its enforcement seam is now pinned and tested] §4.4a pins the probe seam the implementation must introduce (a deadline argument plus an explicit `timed-out` outcome). CI asserts: exactly one invocation, `deadlineMs === HARNESS_VERSION_PROBE_TIMEOUT_MS`, the production probe hands that bound to the child-process runner, a `timed-out` outcome yields `indeterminate` → `harness.version.unknown`, and no retry loop. Wall-clock duration remains a reference measurement recorded in §10, never reported as a passing CI threshold.
- [GAP-4 — human-gated, non-blocking: AC-F2-2's acceptance half] A test can assert that the records exist, follow the per-type identifier convention, carry the R2 body, state a chosen mode equal to the delivered constant and drawn from the declared vocabulary, carry the read-only direct-store rationale, and are indexed. It cannot assert that the decision is *correct* or accepted; the records stay `Proposed` until a human decides (DEC-7, TDR-0031, spec §12).
- [GAP-5 — non-blocking: exact field, reason and vocabulary constant names] The spec pins the *obligations* (seat identity, resolved model, observed model, harness-reported agent/agent role, durations, a model-divergence warning, an agent-divergence warning, a version-divergence warning, an explicit duration absence, an absence reason, and the `unresolved-seat` reason) but not the exact JSON field names, the exact new closed-vocabulary reason strings, the mode identifiers or the verdict identifiers. Every assertion goes through declared contract constants pinned once in the contract suite (TC-HARNESS-019, TC-HARNESS-035, TC-HARNESS-046); no test asserts an inline string literal beyond the identities the spec pins verbatim. TDR-0032 Amendment A-3 makes this division binding: the record names the facts, the delivery contract owns the constant names, and a second authored copy of the vocabulary in a test or document is a defect.
- [GAP-6 — non-blocking: the in-window 2.1.x store generation is unobserved] The window includes the `2.1.x` line; its store layout was not observed, and the store evidence shows the legacy `session` generation's newest row predating the v2.2.5 cohort. Generation tolerance is therefore asserted for the two *observed* generations (current and legacy) with named omissions, not against a claimed 2.1.x shape (RSK-4, RSK-9, NFR-11).
- [GAP-7 — non-blocking: the probe grammar is observed on one harness line] The accepted grammar and normalization are pinned from `opencode v2.2.5` only. A 2.1.x line whose output deviates surfaces as an indeterminate version and therefore as an explicit `harness.version.unknown` refusal — a visible, actionable outcome rather than a silent pass. Re-observation is required on each harness minor release (spec §22, RSK-2).

## 2. References

- **Change specification**: [chg-GH-335-spec.md](./chg-GH-335-spec.md) — v1.2; 26 ACs (AC-F1-1..5, AC-F2-1..4, AC-F3-1..4, AC-F4-1, AC-F5-1..6, AC-F6-1..2, AC-F7-1..3, AC-N1-1), F-1..F-7, DM-1..DM-10, NFR-1..NFR-11, DEC-1..DEC-14, RSK-1..RSK-10, OQ-1..OQ-5 (OQ-2 and OQ-3 closed; OQ-4 and OQ-5 are inherited obligations, §8.3), §17.1 traceability, §17.2 Definition of Done (13 clauses), Appendix B (pinned scenarios verbatim), Appendix C (observation evidence: the v2.2.5 store generations, the `opencode v2.2.5` output, the zero `OC_*` tokens, and the available mode surfaces). The seat rule is DEC-13; the narrowed AC-F3-4 is DEC-14.
- **Seat-rule decision record**: [TDR-0032](../../../decisions/TDR-0032-harness-seat-spawn-cardinality-and-seat-resolution.md) — one spawn binds exactly one seat; the seat is resolved from the agent identity the run names (`agentOverrides`, else the seat bearing that name, else the profile's single declared seat); exactly one `--agent <agent>` and one `--model <provider>/<model>[#<variant>]` per invocation; the seat has no argv carrier and is recorded on the run; N seats are N spawns/N sessions/N row sets; a named agent with no seat refuses pre-session through the delivered `provider.profile.invalid`; a role-less spawn binds nothing in every profile shape (Amendment A-1), discloses through the bounded `error.summary` with no `detail.harness` member (Amendment A-2), and leaves field literals to the delivery contract (Amendment A-3).
- **Decision record**: [TDR-0031](../../../decisions/TDR-0031-harness-dispatch-outcome-envelope-detail.md) — the additively declared `detail.harness` failure-envelope member: four members (`kind`, `observedVersion`, `versionVerdict`, `mode` omitted when unresolved), present only on the four new pre-session harness refusals, with the one-commit file set, the identity→member mapping, and the three distinct absence rules.
- **Ticket**: GH-335 — M3-S1: opencode v2.x harness and telemetry (https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/335). Ticket AC decomposes per spec §17.1: dispatch runs with the resolved profile (AC-F2-1, AC-F3-1..AC-F3-4, AC-F4-1), telemetry rows land with the session's schema identity and per-seat models (AC-F5-1, AC-F5-3, AC-F5-4, AC-F5-5), unsupported versions refuse with a typed error (AC-F1-2, AC-F1-3, AC-F1-5, AC-N1-1), integration-mode decision recorded (AC-F2-2); EC-1 additionally owes AC-F5-6 (live rows).
- **PM record**: [chg-GH-335-pm-notes.yaml](./chg-GH-335-pm-notes.yaml) — scope source, the delivered-seam cross-check, gaps G1–G7, the GH-342 Q-06 default, observed harness `v2.2.5`, and the gate-command convention (`TMPDIR=$PWD/tmp/tmpdir`).
- **Readiness records**: [readiness-review/readiness-iter-1.md](./readiness-review/readiness-iter-1.md) — the first NOT_READY verdict (findings 1, 2, 7, 8, 11, 13, 15, 16 and the test-plan follow-ups); [readiness-review/readiness-iter-2.md](./readiness-review/readiness-iter-2.md) — the second NOT_READY verdict, whose finding C2 (TC-HARNESS-011 asserted three flag pairs on one invocation) this revision 1.3 answers with TDR-0032.
- **Milestone pack (planning truth)**: [m3/test-scenarios.md](../../../planning/oss-tooling/milestones/m3/test-scenarios.md) — TC-M3-HARNESS-001 and TC-M3-HARNESS-002 verbatim; [m3/README.md](../../../planning/oss-tooling/milestones/m3/README.md) EC-1; [m3/contracts.md](../../../planning/oss-tooling/milestones/m3/contracts.md) (extended harness port and the three declared typed refusals); [m3/architecture.md](../../../planning/oss-tooling/milestones/m3/architecture.md) (boundary invariants); [m3/open-questions.md](../../../planning/oss-tooling/milestones/m3/open-questions.md) (OQ-M3-01, OQ-M3-02, OQ-M3-07).
- **Implementation plan**: [./chg-GH-335-plan.yaml](./chg-GH-335-plan.yaml) — eight phases; its TC→phase map must be re-cut for the five added TCs (042–046) and the ten reshaped in §11.3 (GAP-1, §11).
- **Testing strategy**: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — layers, module→test mapping, `bun:test`, invariant-test authoring rules (assert the meaning, not a growing count), aggregate `pnpm check`, fixture conventions.
- **TypeScript rules**: [.ai/rules/typescript.md](../../../../.ai/rules/typescript.md) — strict typing, purity, ports and adapters, the error contract, `bun:test` authoring.
- **Current system truth — harness seam**: [feature-harness-adapters.md](../../../spec/features/feature-harness-adapters.md) — `HarnessInstance` (`observedVersion: string | null`, `versionWarning`), `HarnessSessionPort` (spawn, deliver, resume, collect, classify, liveness, read-only session listing; steering rides `deliver`/`resume`, it is not a port member), opencode streaming JSONL adapter, deny-by-default spawn environment with the optional profile record map, read-only bounded extraction into `delivery.harness.telemetry.v1`, closeout capture, the conformance registry with two registrations and the six-scenario floor.
- **Current system truth — NFRs**: [nonfunctional.md](../../../spec/nonfunctional.md) harness rows — read budget and query-only pragma, machine payload ≤ 65 536 UTF-8 bytes, human disclosure ≤ 4 096 bytes / 24 lines, byte-identical determinism, conformance-registration invariants, deny-by-default spawn environment.
- **Current system truth — telemetry v2, spend, state**: [feature-telemetry-v2.md](../../../spec/features/feature-telemetry-v2.md), [feature-spend.md](../../../spec/features/feature-spend.md) (`spend.telemetry-absent` meaning, untouched here), [feature-state-layer.md](../../../spec/features/feature-state-layer.md) (the `harness.telemetry` payload allowlist and idempotency key — the seat/duration fields must survive `payloadFor`).
- **Current system truth — result contract, dispatch, config**: [feature-result-contract.md](../../../spec/features/feature-result-contract.md) (`delivery.result.v1`, the closed `detail` slot, the six-field `error`, the scripted `{error, runId}` projection, redaction chokepoint), [feature-dispatch-engine.md](../../../spec/features/feature-dispatch-engine.md) (pre-session refusal vs attempt-stage shape), [feature-config-layer.md](../../../spec/features/feature-config-layer.md) (typed `harness` branch and `defaults` origins).
- **Contracts and seams consumed**: `packages/core/src/contracts/harness.ts` (`HARNESS_KINDS`, `HARNESS_FAILURE_CODES` — nine delivered codes, `HARNESS_VERSION_WARNINGS` = `["version-probe-failed"]`, `HarnessInstance`, `HarnessVersionProbe`, `HarnessExecutionEnvironmentDescriptor`, `HarnessSpawnInput`/`HarnessResumeInput`), `packages/core/src/contracts/harness-telemetry.ts` (`HARNESS_TELEMETRY_SCHEMA_ID`, `HARNESS_TOKEN_CLASSES`, `HARNESS_WARNING_REASONS`, `HarnessTelemetryRecord`, `HarnessTelemetryCapture`, `HarnessFailedSession`, `HarnessTruncation`), `packages/core/src/contracts/result.ts` (`RESULT_SCHEMA_VERSION`, `CommandResultDetail` — closed at `holder | suiteBreadth`, the slot TDR-0031 extends), `packages/core/src/contracts/error-table.ts` (rows with `code`, `domainKind`, `category`, `retryable`, `consequence`, `remediationHint`, `projectionClass`, `summary`), `packages/cli/src/projection.ts` (`success → 0`, `user-validation → 1`, `platform-provider → 2`, `attention → 1`), `packages/cli/src/index.ts` (`explicitDetail` — projects only the keys it names), `packages/core/src/domain/harness-registry.ts` (`resolveHarnessInstance`, the injected version probe), `packages/core/src/domain/harness-spawn-env.ts` (deny-by-default builder), `packages/core/src/provider/profile-env-record.ts` (`envRecordNameForSeat`, `buildProfileEnvRecord`), `packages/core/src/state/harness-telemetry.ts` (`payloadFor`, `appendHarnessTelemetry`), `packages/adapters/src/harness/{opencode,telemetry-opencode,telemetry-session-totals,sqlite-loader}.ts`, `packages/adapters/src/host/index.ts`.
- **Conformance testkit**: [packages/testkit/src/conformance/harness.ts](../../../../packages/testkit/src/conformance/harness.ts) — `HARNESS_CONFORMANCE_SCENARIOS` (the six floor ids, pinned by value in TC-HARNESS-031; this change may rename it `HARNESS_CONFORMANCE_FLOOR_SCENARIOS` without changing its value), `HarnessConformanceScenarioId` (the closed union this change must split without widening the floor), `HarnessConformanceRegistration` (`kind`, `capabilities`, `scenarios`, `build`), `HARNESS_CONFORMANCE_REGISTRY` (exactly `opencode` and `claude-code`), `harnessConformanceViolations`. There is no scenario executor today: §4.6 (C-06, C-09, C-10) declares the additive one this change must ship, alongside the floor/extension constant split that keeps the delivered six-id value exact.
- **Existing evidence to extend (not replace)**: `tests/structure/{harness-contract,harness-stream-contract,harness-neutrality,harness-environment-marker,harness-review-deferrals,error-table,conformance-coverage,content-inventory,result-contract,dispatch-envelope-detail}.test.ts`; `tests/types/{verify-gates-suite-map,dispatch-envelope-detail}.type-test.ts`; `tests/behaviour/{harness-spawn-env,harness-spawn-credential,harness-default-path,harness-config,harness-opencode-session,harness-opencode-stream,harness-opencode-resume-stream,harness-host-stream,harness-stream-hygiene,harness-telemetry-opencode,harness-telemetry-shape,harness-telemetry-drift,harness-telemetry-claude,harness-telemetry-claude-budget,harness-telemetry-opencode-orphan-scope,harness-closeout-capture,harness-closeout-idempotency,harness-closeout-nongating,harness-output-bounds,dispatch-harness-acquisition,dispatch-harness-default-spawn}.test.ts`; `tests/conformance/{harness-classification,harness-liveness}.test.ts`; `tests/checks/{harness-mutants,harness-determinism,harness-ci-parity,error-table-sync,exit-code-literals,decision-record,fixture-privacy}.test.ts`; `tests/fixtures/harness/{spawn-env,harness-io,opencode-store/build,scenarios/classification,scenarios/stream,stream/README}.ts`; `tests/fixtures/result/envelope-key-set.json`; `tests/fixtures/harness/stream/opencode-v2.2.5{,-tool-error,-stream-error,-tokens}.jsonl`.
- **Closest delivered precedent**: [chg-GH-291-test-plan.md](../2026-11-12--GH-291--telemetry-v2/chg-GH-291-test-plan.md) — the fixture contract, non-vacuity contract, oracle matrices and mutant discipline mirrored here; and [chg-GH-233-test-plan.md](../2026-11-06--GH-233--harness-adapters/chg-GH-233-test-plan.md) for the harness-port conventions (`TC-HARN` numbering, the `harness-mutants` pattern).

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (abbreviated) | TC ID(s) | Status |
|-------|--------------------------|----------|--------|
| AC-F1-1 | An in-window version with a resolved profile proceeds, and the observed version plus window verdict ride the resolved instance | TC-HARNESS-001, TC-HARNESS-004, TC-HARNESS-006, TC-HARNESS-042, TC-HARNESS-040, TC-HARNESS-046 | Covered |
| AC-F1-2 | **Pinned TC-M3-HARNESS-002** — an out-of-window version refuses with `harness.version.unsupported` (exit 1, remediation naming the window) and no session is spawned | TC-HARNESS-002, TC-HARNESS-004, TC-HARNESS-006, TC-HARNESS-036 | Covered |
| AC-F1-3 | A harness version that cannot be determined or parsed refuses with `harness.version.unknown`, the observation stays the explicit unknown, and nothing is fabricated or silently permitted | TC-HARNESS-003, TC-HARNESS-006, TC-HARNESS-042 | Covered |
| AC-F1-4 | The window is pinned with no configuration key that widens or narrows it; only an inside-window version proceeds | TC-HARNESS-005 | Covered |
| AC-F1-5 | `opencode v2.2.5` normalizes to `2.2.5` with the raw line diagnostic only, and empty, non-zero, timed-out, multi-line or off-grammar output is indeterminate → `harness.version.unknown`, never a substring or partial match | TC-HARNESS-042, TC-HARNESS-003, TC-HARNESS-006, TC-HARNESS-046 | Covered |
| AC-F2-1 | The delivered default mode is used for a spawn, with no other mode attempted as a runtime fallback | TC-HARNESS-007, TC-HARNESS-040 | Covered |
| AC-F2-2 | A decision record states the chosen mode among the harness's exposed surfaces with the read-only direct-store rationale, and is linked from the change and the harness feature spec | TC-HARNESS-010 (record content; Phase 1–2), TC-HARNESS-041 (feature-spec link and index; Phase 8) | Covered (structural; acceptance human-gated — GAP-4) |
| AC-F2-3 | A requested mode the delivery does not support refuses with `harness.mode.unavailable` before any spawn, naming requested and available | TC-HARNESS-008, TC-HARNESS-036 | Covered |
| AC-F2-4 | An omitted mode applies the default with a `defaults` origin; an unknown value is refused rather than silently defaulted | TC-HARNESS-009 | Covered |
| AC-F3-1 | **Pinned TC-M3-HARNESS-001** — a spawn carries exactly one resolved binding (the seat the profile assigns to the agent the run names) as exactly one `--agent <agent>` and one `--model <provider>/<model>[#<variant>]`; a profile's N seats are N spawns, N sessions and N row sets; a spawn naming no agent sends neither and is recorded and disclosed as `unresolved-seat`; a capture keeps the seat and resolved model from the recorded binding beside the harness-reported agent and model | TC-HARNESS-011, TC-HARNESS-015, TC-HARNESS-016; live half TC-HARNESS-045 (human-gated) | Covered offline; only the live half is deferrable, with recorded human/PM acceptance (GAP-2) |
| AC-F3-2 | A resolved record value wins over a conflicting ambient parent value for a declared name | TC-HARNESS-012, TC-HARNESS-015 | Covered |
| AC-F3-3 | Undeclared record names change nothing and no undeclared parent variable is forwarded | TC-HARNESS-013 | Covered |
| AC-F3-4 | A required seat model the honoured surface cannot express refuses with `harness.profile.model-unrepresentable` naming the seat, with no session spawned; a spawn naming an agent a multi-seat profile assigns no seat refuses with the delivered `provider.profile.invalid` naming the agent, profile and declared seats, with no session, no attempt record and no `detail.harness` member; an agent or model the harness does not recognise is the harness's own classified spawn failure, not a pre-session refusal | TC-HARNESS-014, TC-HARNESS-036 | Covered |
| AC-F4-1 | Resume or attach continues the session identity with the tree root and propagation contract preserved; unknown or different sessions keep delivered `harness.session.unknown` semantics | TC-HARNESS-016, TC-HARNESS-017, TC-HARNESS-018 | Covered |
| AC-F5-1 | At least one row lands for a held session of the observed store, stamping the schema identity and the session record's normalized version and carrying the seat and resolved model from the run's recorded binding, the harness-reported agent and observed model, five token classes, calls, cost, and durations-or-explicit-absence; a group whose observed agent differs from the binding's agent carries no seat and warns; zero rows for that session is a failure | TC-HARNESS-011, TC-HARNESS-019, TC-HARNESS-026, TC-HARNESS-028 | Covered |
| AC-F5-2 | Pre-change `delivery.harness.telemetry.v1` rows remain readable and unchanged; fields are additions with no removal, rename, or new major version | TC-HARNESS-020 | Covered |
| AC-F5-3 | A resolved-versus-observed model divergence, or a binding-agent-versus-observed-agent divergence, keeps both values on that axis and discloses itself with a closed-vocabulary warning, never by overwrite; the binding's seat attaches only to the group whose observed agent matches, every other group carrying a null seat with `unresolved-seat` | TC-HARNESS-021 | Covered |
| AC-F5-4 | Durations come from the store's own timestamp pairs; a pair the row cannot read is explicitly absent with a closed-vocabulary warning and is never derived or estimated | TC-HARNESS-022, TC-HARNESS-028 | Covered |
| AC-F5-5 | Attribution comes from every session identity the run holds (one per spawn/resume) together with the run's recorded binding for the seat claim, and the store tree below each held identity — no work-item or harness-version column, no store-wide scan; no recorded identity yields a classified absence with no rows; a held session with no observable usage fact becomes a failed-session entry | TC-HARNESS-043, TC-HARNESS-044, TC-HARNESS-023, TC-HARNESS-025 | Covered |
| AC-F5-6 | A human-gated live observation captures ≥ 1 row for a session the dispatch ran through the installed in-window harness, carrying its stored version, seat and tokens, recorded in the change folder and never a CI oracle; zero rows fails | TC-HARNESS-045 | Covered manually (human-gated — GAP-2); deferrable only with recorded human/PM acceptance |
| AC-F6-1 | An absent work-item telemetry reading carries the delivered `spend.telemetry-absent` classification with no zero figures, and an absent or failed closeout capture writes no zero-valued record and changes no other closeout effect | TC-HARNESS-023 | Covered |
| AC-F6-2 | Absence (session not held), degraded capture (optional fields absent) and extraction failure (store unreadable) are three distinct classifications inside the delivered capture envelope with counts, reasons and warnings; no command, verb or exit projection is added and the delivery's exit code is unchanged | TC-HARNESS-023, TC-HARNESS-024, TC-HARNESS-028, TC-HARNESS-044 | Covered |
| AC-F7-1 | Both registered harnesses still cover and pass the unchanged six-scenario classification floor | TC-HARNESS-031 | Covered |
| AC-F7-2 | A registered harness missing a version-window, unknown-version, mode-unavailable, or profile-propagation scenario fails the suite, naming the harness and the scenario; a new refusal identity with no scenario fails too | TC-HARNESS-032, TC-HARNESS-033 | Covered |
| AC-F7-3 | The conformance suite runs offline against simulated harness I/O with zero live harness invocations | TC-HARNESS-033, TC-HARNESS-034 | Covered |
| AC-N1-1 | Any version, mode, or profile refusal leaves no session-bearing child process, no orphan, no telemetry row, and no other spawn side effect; the single bounded probe is the declared exception, completed and reaped before the verdict | TC-HARNESS-035, TC-HARNESS-036, TC-HARNESS-038 | Covered |

**Traceability to the ticket AC (verbatim, binding).**

| Ticket AC | Covered by | How the plan proves it |
|---|---|---|
| "dispatch through the installed harness port runs with the resolved profile" | TC-HARNESS-011, TC-HARNESS-012, TC-HARNESS-013, TC-HARNESS-014, TC-HARNESS-015, TC-HARNESS-016, TC-HARNESS-017, TC-HARNESS-007; live TC-HARNESS-045 | The recorded invocation arguments and built environments of a simulated harness, one spawn per named agent: each invocation carries exactly one `--agent`/`--model` pair equal to that seat's resolved binding (a collapsed seat fails; two pairs on one invocation fails), N seats are N spawns/sessions/row sets, a role-less spawn binds nothing and is disclosed as `unresolved-seat`, a conflicting parent value loses where a harness consumes variables, an undeclared name vanishes, an unrepresentable seat model and an unassigned named agent refuse before spawn, and no `OC_*` family is invented |
| "telemetry rows land with schema version and per-seat models" | TC-HARNESS-019, TC-HARNESS-021, TC-HARNESS-022, TC-HARNESS-026, TC-HARNESS-028, TC-HARNESS-043 | Field matrix T-01..T-16 over fixture stores of the observed contract: schema constant equality, the session's own version, the seat and resolved model from the recorded binding beside the harness-reported agent and observed model, divergence on the model and the agent axis, tokens/cost/durations or explicit absence, one totals basis, and attribution by every held session identity plus the recorded binding |
| "unsupported versions refuse with a typed error" | TC-HARNESS-002, TC-HARNESS-003, TC-HARNESS-036, TC-HARNESS-042 | Version verdict and grammar matrix V-01..V-19 plus the refusal/oracle matrix M-01..M-11: exact identity, projection class, exit, the `detail.harness` member, session-seam call count 0 |
| "integration-mode decision recorded" | TC-HARNESS-010, TC-HARNESS-041 | Both records exist with required content, the chosen mode equals the delivered default constant and is one of the three declared observed surfaces, and the harness feature spec links the record (Phase 8) |

**Capability coverage** (no capability unlinked): F-1 → TC-HARNESS-001..006, 042, 046; F-2 → TC-HARNESS-007..010, 040; F-3 → TC-HARNESS-011..016; F-4 → TC-HARNESS-016..018; F-5 → TC-HARNESS-019..030, 043, 044; F-6 → TC-HARNESS-023, 024, 028, 044; F-7 → TC-HARNESS-031..034. Cross-cutting hygiene, mutation, hermeticity, the single-probe construction-site check and docs: TC-HARNESS-035..041, 046; the human-gated live observation: TC-HARNESS-045.

All 26 acceptance criteria map to at least one case; none is left unmapped. Three criteria carry an explicit named boundary instead of a silent claim: AC-F3-1's live half and AC-F5-6 (GAP-2), and AC-F2-2's acceptance half (GAP-4). Only AC-F3-1's live half and AC-F5-6 may be deferred, and only with recorded human/PM acceptance and every offline criterion still green (spec §17.2 clause 1); every other criterion is non-deferrable.

**Pinned blueprint scenarios (verbatim, binding).**

```
TC-M3-HARNESS-001 opencode v2.x dispatch with profile propagation
Given a resolved model profile and an installed opencode v2.x,
When the harness port spawns an agent session in standalone mode,
Then the session reports the resolved per-seat models and emits versioned
telemetry rows with tokens and cost.

TC-M3-HARNESS-002 unsupported harness version
Given an opencode version outside the supported window,
When a dispatch is attempted,
Then it refuses with `harness.version.unsupported` and no session is spawned.
```

| Pinned scenario | Delivered as | Assertions that make it non-vacuous |
|---|---|---|
| TC-M3-HARNESS-001 | TC-HARNESS-011 (with TC-HARNESS-019, TC-HARNESS-043 supplying the row and attribution half, and TC-HARNESS-045 the human-gated live half) | A profile of N ≥ 2 seats is exercised by N spawns: N sessions, N held session identities and N row sets, with distinct resolved models and distinct `seat` values, so a single collapsed seat fails and a short spawn count (`calls === N`) fails. Each *recorded invocation argv* the harness seam received is inspected (not a descriptor object), and each invocation must carry exactly one `--agent` and exactly one `--model` equal to that seat's resolved binding, so a binding built and discarded fails and an invocation carrying two pairs fails as an argv the installed single-valued CLI cannot accept (TDR-0032). The child environment is asserted to gain no per-seat `OC_*` variable, so a nominal variable family cannot pass for the honoured surface. Every row set must be non-empty with non-null tokens and cost, so a rows-present claim with zero rows fails; the live observation is recorded separately and is never the oracle |
| TC-M3-HARNESS-002 | TC-HARNESS-002 (with TC-HARNESS-036 supplying the side-effect half and TC-HARNESS-042 the grammar/normalization half) | A paired in-window control must proceed on the same fixture, so a blanket refusal fails; the probe output is mutated from `opencode v2.3.0` to `opencode v2.2.5` and the verdict must flip, so a hardcoded refusal fails; the session-spawn seam call count is asserted to be 0, so "refused after spawning" fails |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The specification declares no HTTP endpoint (§8.1: N/A) and adds no message/event bus element; §8.2 elements are the inbound harness stream, the spawn-descriptor environment records, storage rows, and derived disclosures, all covered below.

| Interface / data model | Description | TC ID(s) | Status |
|------------------------|-------------|----------|--------|
| Outbound — version probe invocation (§8.2) | One bounded, shell-free invocation through the delivered child-process seam at the single production probe point; accepted grammar pinned; no session, no prompt, no allowlist bypass | TC-HARNESS-006, TC-HARNESS-036, TC-HARNESS-042 | Covered |
| Outbound — probe deadline seam (§8.2, NFR-2) | The probe receives its bound as data (`deadlineMs`) and returns an explicit `timed-out` outcome; the production probe maps the bound onto the runner's timeout; a timed-out probe is an indeterminate verdict, never a retry | TC-HARNESS-006, TC-HARNESS-042 | Covered (§4.4a) |
| Internal — per-spawn profile binding (§8.2) | Exactly one seat per spawn, resolved from the agent identity the run names (`agentOverrides`, else the seat bearing that name, else the profile's single declared seat): the binding carries that agent identity, that seat and that seat's resolved model — never a seat map — mapped onto the surface the harness honours: exactly one opencode `--agent`/`--model` pair per invocation, a variable-consuming harness's declared variable name; record values win for declared names; undeclared names change nothing; the seat is recorded on the run and has no argv carrier | TC-HARNESS-011, TC-HARNESS-012, TC-HARNESS-013, TC-HARNESS-015, TC-HARNESS-016 | Covered |
| Inbound — harness JSONL stream (§8.2) | Unchanged read-only consumption over the delivered streaming seam; no new frame-parsing contract | TC-HARNESS-037 | Covered (regression half) |
| Storage — session-store read (§8.2) | Read-only, query-only, bounded indexed reads of every session identity the run holds and its tree across the observed generations; only non-content fields projected | TC-HARNESS-025, TC-HARNESS-043, TC-HARNESS-028 | Covered |
| Storage — `harness.telemetry` rows (§8.2) | Additive fields under the unchanged `delivery.harness.telemetry.v1` identity; the schema identity and the session record's own normalized version stamped per row; the payload allowlist must carry them | TC-HARNESS-019, TC-HARNESS-020, TC-HARNESS-021, TC-HARNESS-022 | Covered |
| Derived — refusal disclosure (§8.2, TDR-0031) | The four new pre-session refusals (version, mode, expressibility) carry their identity, the observed/requested value, the supported/available alternative, a remediation hint, and the declared `detail.harness` member — and no other failure carries that member; the unassigned-agent refusal (a profile refusal) states its agent/profile/seat facts in the bounded `error.summary` and adds no member (Amendment A-2) | TC-HARNESS-035, TC-HARNESS-036, TC-HARNESS-040 | Covered |
| Derived — capture disclosure (§8.2, DEC-9/DEC-10) | Absence, degradation and extraction failure classified inside the delivered capture envelope with counts, reasons and warnings; no new command, verb or exit projection | TC-HARNESS-023, TC-HARNESS-024, TC-HARNESS-028, TC-HARNESS-044 | Covered |
| DM-1 — Supported-version window | The declared minor lines a harness may run on, carried as data with the verdict; one pinned default; no configuration key | TC-HARNESS-004, TC-HARNESS-005, TC-HARNESS-006 | Covered |
| DM-2 — Version evaluation result | The verdict (inside, outside, indeterminate) with the normalized observed version or explicit unknown and the warning that rides an unknown | TC-HARNESS-001, TC-HARNESS-002, TC-HARNESS-003, TC-HARNESS-006, TC-HARNESS-040, TC-HARNESS-042 | Covered |
| DM-3 — Integration-mode declaration | The declared mode, its origin (default or configured), and the closed vocabulary of requestable modes drawn from the observed surfaces | TC-HARNESS-007, TC-HARNESS-008, TC-HARNESS-009, TC-HARNESS-040 | Covered |
| DM-4 — Profile propagation record | Per spawn, exactly one seat: the agent identity the binding was resolved for, the seat the resolved profile assigns that agent, and that seat's resolved model (pacing-applied where pacing applied), plus the declared model variable name where a harness consumes variables; carried as per-spawn data, mapped to the honoured surface, and recorded on the run so capture cites the seat the run declared rather than re-deriving it | TC-HARNESS-011..TC-HARNESS-017 | Covered |
| DM-5 — Seat telemetry attribution | Additive row fields: the seat and resolved model from the run's recorded binding (DM-4) beside the harness-reported agent and observed model, with divergence disclosed on both axes — model (resolved ≠ observed) and agent (binding agent ≠ observed agent) — and neither value overwritten; the binding facts attach only to the group whose observed agent equals the binding's agent, every other group carrying a null seat with `unresolved-seat`; never sourced from a work-item column | TC-HARNESS-019, TC-HARNESS-021 | Covered |
| DM-6 — Duration fields | Additive per-row durations (start, end, elapsed) from the store's timestamp pairs, or an explicit absence with a closed warning; never derived from capture time | TC-HARNESS-019, TC-HARNESS-022, TC-HARNESS-028 | Covered |
| DM-7 — Conformance scenario set | The delivered six-id floor plus the four-id additive extension (version-window, version-unknown, mode-unavailable, profile-propagation) | TC-HARNESS-031, TC-HARNESS-032, TC-HARNESS-033 | Covered |
| DM-8 — Store-to-delivery binding | The attribution key is every session identity the run holds — one per spawn/resume, exactly one for a delivered attempt — plus the run's recorded binding (DM-4) for the seat claim; the store supplies the tree below each held identity through parent links; no store column names the work item | TC-HARNESS-043, TC-HARNESS-025 | Covered |
| DM-9 — Harness-version stamp source | The normalized version the session record states; the dispatch-probed installed version disclosed separately; divergence warned, never reconciled | TC-HARNESS-019, TC-HARNESS-021 | Covered |
| DM-10 — Observed store contract | The table/column/field inventory every extraction fixture derives from, across the current and legacy generations | TC-HARNESS-019, TC-HARNESS-028, TC-HARNESS-043, TC-HARNESS-044 | Covered (§4.1a) |
| `CommandResultDetail.harness` (TDR-0031) | Closed, identifier-only member: `kind`, `observedVersion` (`null` iff indeterminate), `versionVerdict`, `mode` omitted when unresolved; present only on the four pre-session refusals; the exact-key pin, runtime validator, key-set fixture and documented member sentence move together | TC-HARNESS-035, TC-HARNESS-040 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement (threshold) | TC ID(s) | Status |
|-----|--------------------------|----------|--------|
| NFR-1 | A version, mode, or profile refusal occurs before any session-bearing child exists: zero spawned sessions, zero orphans, zero telemetry rows, zero store writes; the single bounded probe is the exception and is reaped | TC-HARNESS-006, TC-HARNESS-008, TC-HARNESS-014, TC-HARNESS-036 | Covered |
| NFR-2 | The probe resolves within 5 s in the reference environment, at most once per dispatch; a probe that cannot answer is an explicit indeterminate version, never a retried loop, never a fabricated version; the probe is reaped before the verdict | TC-HARNESS-006, TC-HARNESS-042 | Covered as bounded work plus the pinned deadline seam (§4.4a) and a non-CI reference measurement (GAP-3) |
| NFR-3 | Read-only open, query-only pragma before the first read, bounded indexed queries only, no full-table message/part scans, no content projection; caps 64 / 16 / 16 / 24 with explicit truncation marks; per-message reads scoped by session and message type | TC-HARNESS-025, TC-HARNESS-043 | Covered |
| NFR-4 | Machine payload ≤ 65 536 UTF-8 bytes; human disclosure ≤ 4 096 bytes and ≤ 24 lines; truncation deterministic, tail-ordered, marked; refusal identities and hints never truncated | TC-HARNESS-030 | Covered |
| NFR-5 | Rows, warnings and refusals carry identity references, counts, costs and durations only — never prompt text, message bodies, transcripts, diffs, tool output, credential material, or harness configuration values | TC-HARNESS-027, TC-HARNESS-043 | Covered |
| NFR-6 | No figure is invented: a cost source the store does not expose is null, a reported zero is kept as zero, a missing token class is null with a warning, a duration the timestamp pair cannot express is explicitly absent, a missing or unparseable version is the explicit unknown; zero is never a substitute for absence and absence is never a substitute for a reported zero | TC-HARNESS-003, TC-HARNESS-019, TC-HARNESS-022, TC-HARNESS-023, TC-HARNESS-028, TC-HARNESS-042 | Covered |
| NFR-7 | Byte-identical output for identical injected harness facts, probe result, resolved profile and clock; zero model calls and zero network on any evaluation, refusal, or render path | TC-HARNESS-029 | Covered |
| NFR-8 | Version evaluation, mode resolution and profile propagation add no blocking work to the delivered stream drain, handle acquisition, or output-bound behavior | TC-HARNESS-037 | Covered |
| NFR-9 | No ambient environment read outside the injected seams; the per-spawn binding is passed as data and adapters read no ambient environment | TC-HARNESS-013, TC-HARNESS-015, TC-HARNESS-027 | Covered |
| NFR-10 | 100% of new tests offline against simulated harness I/O and fixture stores; zero live harness invocations, credentials, or network; one human-gated live observation permitted outside CI and never an oracle | TC-HARNESS-034, TC-HARNESS-039 | Covered (live half in TC-HARNESS-045, GAP-2) |
| NFR-11 | Extraction recognises the observed store generations and the field set each provides; an unrecognised generation or an absent mandatory field is a classified outcome (absence, degraded capture, or extraction failure), never a silent zero-row pass and never a fabricated row | TC-HARNESS-028, TC-HARNESS-044, TC-HARNESS-024 | Covered |

### 3.4 Gap Check (coverage-matrix integrity)

- **Uncovered ACs**: none. All 26 are mapped. AC-F3-1 is covered offline with GAP-2 naming its human-gated live half; AC-F5-6 is covered by TC-HARNESS-045 (manual, human-gated); AC-F2-2 is covered structurally with GAP-4 naming its acceptance half. Only AC-F3-1's live half and AC-F5-6 may be deferred, and only with recorded human/PM acceptance; none is left unmapped and none other is deferrable (spec §17.2 clause 1).
- **Orphan TCs**: none. Every TC names at least one AC, NFR or DM in §5.1 and §5.2.
- **Uncovered NFRs**: none. NFR-2's wall-clock half is reference-only (GAP-3); its enforcement half is asserted through the pinned deadline seam (§4.4a).
- **Uncovered DMs**: none (DM-1..DM-10 all mapped, plus the TDR-0031 envelope member).
- **Removed identity**: `harness.telemetry.absent` is not covered because it does not exist in this change; TC-HARNESS-023 asserts its absence from the closed vocabulary and the error table, so the removal cannot be silently reversed.
- **Gap status**: GAP-1 (plan mapping re-cut) is pending on `@plan-writer`; GAP-2 (human-gated live half), GAP-3 (probe wall-clock), GAP-4 (record acceptance), GAP-5 (constant names), GAP-6 (unobserved 2.1.x generation) and GAP-7 (grammar observed on one line) are non-blocking, each with a named oracle and owner.
- **Intentional duplicate coverage**: AC-F1-1 and AC-F1-5 span several TCs because verdict carriage, grammar/normalization, the pre-spawn evaluation point and outcome disclosure fail independently. AC-F3-1 spans four because binding content, per-spawn (not process-global) semantics, the spawn/deliver/resume identity of the contract, and the live confirmation are separately falsifiable. AC-F5-1 spans four because row shape, totals basis, and the two store generations degrade differently. AC-F5-5 spans four because attribution, the absence taxonomy, the mandatory-usage boundary and the read discipline are independently falsifiable. AC-F5-4 spans two because the field contract and the legacy generation are separate fixtures. AC-F7-2 spans two because "missing scenario fails" and "scenario actually proves the property" are distinct regressions. AC-N1-1 spans three because identity/exit hygiene, side-effect freedom, and mutant coverage fail independently. AC-F6-2 spans four because the three classifications and the read-side identity are separate oracles.
- **Spec-named behavior bound to an existing AC/NFR** (no dedicated AC by design):

| Behavior | Spec source | Bound AC/NFR | Where |
|---|---|---|---|
| The window is a maintained constant with a declared revisit trigger | §22, RSK-2 | AC-F1-4 | TC-HARNESS-005 |
| "Refuse" wording resolved over "degrade with a typed refusal" | pm-notes, §1 | AC-F1-2, AC-F2-3, AC-F3-4 | TC-HARNESS-002, 008, 014 |
| Every dispatch discloses the version verdict and the selected mode | §10 | AC-F1-1, AC-F2-1 | TC-HARNESS-040 |
| The four pre-session refusals disclose kind/version/verdict/mode as declared envelope members; no other failure does, and the unassigned-agent refusal adds none (its facts ride the bounded `error.summary`) | §8.2, §10, TDR-0031, TDR-0032 A-2 | AC-F1-2, AC-F1-3, AC-F2-3, AC-F3-4 | TC-HARNESS-035, 040 |
| Telemetry capture stays non-gating and never changes a delivery outcome | §10, DEC-10 | AC-F5-1, AC-F6-1, AC-F6-2 | TC-HARNESS-023, 024, 037 |
| Per-seat attribution discloses unresolved seats, model divergence, agent divergence, version divergence and the group-scoping rule with counts and reasons | §10, DM-5, TDR-0032 | AC-F5-3, AC-F5-5 | TC-HARNESS-019, 021, 043 |
| Seat–spawn cardinality: one seat per spawn, resolved from the agent the run names; N seats are N spawns; a role-less spawn binds nothing | §5.1 F-3, §6 Flow 2, DM-4, DEC-13, TDR-0032 | AC-F3-1, AC-F3-4 | TC-HARNESS-011, 014, 015, 016 |
| The version probe has exactly one production construction site — the dispatch path's harness resolution | §5.1 F-1, §17.2 clause 6, DEC-11 | AC-F1-1, AC-F1-5 | TC-HARNESS-046 |
| Every invocation lands its command-audit record; an audit-write failure is diagnostic | §10 | AC-N1-1 | TC-HARNESS-037 |
| Failure identities are declared once; delivered meanings are untouched; no telemetry-absence identity is added | §8.5, RSK-5, DEC-10 | AC-N1-1, AC-F6-2 | TC-HARNESS-035 |
| Store access is read-only with the query-only pragma before the first read, and no generation is guessed | §8.4, §21, NFR-11 | NFR-3, NFR-11 | TC-HARNESS-025, 028 |
| Brand neutrality: no hardcoded product or binary name in tooling contracts | §21 | NFR-7 (determinism/naming discipline), AC-F2-2 | TC-HARNESS-029, TC-HARNESS-035 |
| Planning status markers and decision index reconciled | §18 | AC-F2-2 | TC-HARNESS-041 |
| The v2.2.5 store contract is re-observed on each harness minor release | §22, RSK-9 | NFR-11 | TC-HARNESS-028, TC-HARNESS-043 |

## 4. Test Types and Layers

| Layer | Runner / invocation | Location | Covers |
|-------|--------------------|----------|--------|
| Contract and vocabulary | `bun test tests/structure` | `tests/structure/harness-contract.test.ts` (update), `tests/structure/harness-version-window-contract.test.ts` (new), `tests/structure/harness-probe-grammar-contract.test.ts` (new), `tests/structure/harness-neutrality.test.ts` (update if literals extend) | TC-HARNESS-004 (constant half), 005, 042 (grammar constant half), 019 (shape half), 020, 035 |
| Single-probe construction site | `bun test tests/structure` | `tests/structure/harness-probe-construction-site.test.ts` (new) | TC-HARNESS-046 |
| Error identity, envelope member and sync | `bun test tests/structure tests/checks tests/types`; `bun run scripts/checks/error-table-sync.ts` | `tests/structure/error-table.test.ts` (update), `tests/structure/result-contract.test.ts` (update), `tests/structure/dispatch-envelope-detail.test.ts` (update), `tests/types/verify-gates-suite-map.type-test.ts` (exact-key pin moves), `tests/types/dispatch-envelope-detail.type-test.ts` (member cell added), `tests/fixtures/result/envelope-key-set.json` (update), `tests/checks/error-table-sync.test.ts` (update), `tests/checks/exit-code-literals.test.ts` (must stay green) | TC-HARNESS-035, 040 (pin half) |
| Behaviour — version gate | `bun test tests/behaviour` | `tests/behaviour/harness-version-gate.test.ts`, `harness-version-window.test.ts`, `harness-version-probe-seam.test.ts` (new; replaces the previously planned `harness-version-probe-bound.test.ts`) | TC-HARNESS-001..006, 042 |
| Behaviour — integration mode | `bun test tests/behaviour` | `tests/behaviour/harness-mode-selection.test.ts`, `harness-mode-refusal.test.ts`, `harness-mode-config.test.ts` (new) | TC-HARNESS-007..009 |
| Behaviour — profile propagation | `bun test tests/behaviour` | `tests/behaviour/harness-profile-propagation.test.ts`, `harness-profile-per-spawn.test.ts` (new); `harness-profile-precedence.test.ts`, `harness-profile-neutrality.test.ts`, `harness-profile-unrepresentable.test.ts` (new, variable-consuming and honoured-surface variants) | TC-HARNESS-011..016 |
| Behaviour — resume and attach | `bun test tests/behaviour` | `tests/behaviour/harness-resume-propagation.test.ts`, `harness-attach.test.ts` (new); `harness-opencode-resume-stream.test.ts` (assertions unchanged) | TC-HARNESS-017, 018 |
| Behaviour — telemetry rows | `bun test tests/behaviour` | `tests/behaviour/harness-telemetry-seat-attribution.test.ts`, `harness-telemetry-durations.test.ts`, `harness-telemetry-divergence.test.ts`, `harness-telemetry-version-compat.test.ts`, `harness-telemetry-classification.test.ts`, `harness-telemetry-extraction-failure.test.ts`, `harness-telemetry-seat-totals.test.ts`, `harness-telemetry-generation.test.ts`, `harness-telemetry-attribution.test.ts`, `harness-telemetry-mandatory-usage.test.ts` (new); `harness-telemetry-shape.test.ts`, `harness-telemetry-opencode.test.ts`, `harness-telemetry-opencode-orphan-scope.test.ts`, `harness-telemetry-drift.test.ts` (owned updates — store-shape fixtures and oracles rebuilt on DM-10, §4.1a; see §7) | TC-HARNESS-019..028, 043, 044 |
| Behaviour — dispatch disclosure | `bun test tests/behaviour` | `tests/behaviour/dispatch-harness-verdict-mode.test.ts` (new); `dispatch-harness-acquisition.test.ts`, `dispatch-harness-default-spawn.test.ts` (assertions unchanged) | TC-HARNESS-040, 037 |
| Conformance — registry extension and executor | `bun test tests/conformance tests/structure` | `packages/testkit/src/conformance/harness.ts` (extend: floor/extension constants, union split, additive executor), `tests/conformance/harness-extension-scenarios.test.ts` (new), `tests/structure/conformance-coverage.test.ts` (update); `tests/conformance/harness-classification.test.ts` (assertions unchanged) | TC-HARNESS-031..034 |
| Mutation meta-suite | `bun test tests/checks` | `tests/checks/harness-mutants.test.ts` (extend the delivered pattern) | TC-HARNESS-038 |
| Determinism | `bun test tests/checks` | `tests/checks/harness-determinism.test.ts` (update), `tests/checks/harness-ci-parity.test.ts` (assertions unchanged) | TC-HARNESS-029 |
| Hermeticity | `bun test tests/checks` | `tests/checks/harness-hermetic.test.ts` (new; the `telemetry-hermetic` / `provider-hermetic` pattern) | TC-HARNESS-039, 034 |
| Privacy and bounds | `bun test tests/behaviour tests/checks` | `tests/behaviour/harness-telemetry-privacy.test.ts` (new), `harness-output-bounds.test.ts` (update), `tests/checks/fixture-privacy.test.ts` (fixture scan), `tests/checks/fixture-store-shape.test.ts` (new DDL scan: no forbidden column), `tests/checks/privacy-literals.test.ts` (update if literals extend) | TC-HARNESS-027, 030, 043 |
| Decision records | `bun test tests/checks` | `tests/checks/decision-record.test.ts` (extend the inventory) | TC-HARNESS-010 |
| Documentation surface | Manual content check + `bun test tests/checks` | `doc/spec/features/{feature-harness-adapters,feature-telemetry-v2,feature-state-layer,feature-spend,feature-result-contract,feature-dispatch-engine,feature-config-layer,feature-adapter-ports}.md`, `doc/spec/nonfunctional.md`, `doc/decisions/00-index.md`, `doc/planning/oss-tooling/` status markers; `tests/checks/doc-conformance.test.ts`, `tests/structure/content-inventory.test.ts` | TC-HARNESS-041 |
| Human-gated live observation | Not a test runner: a recorded manual observation | `doc/changes/2026-11/2026-11-17--GH-335--opencode-harness-telemetry/chg-GH-335-live-observation.md` (new record) | TC-HARNESS-045 (never an oracle) |
| Aggregate and non-regression | `TMPDIR=$PWD/tmp/tmpdir pnpm check` | repo root; unchanged gates (`lint → format:check → typecheck → test → check:boundaries` plus the repository invariant checks) | All TCs (regression half) |

### 4.1 Fixture and Harness Contract (binding for every TC)

1. **No live harness, network, credential, or user state directory.** Every suite imports production modules and injects fakes plus a per-test temp root. No suite starts the opencode binary, opens a real harness store, reads `$HOME`, resolves a credential through a real source, or opens a socket (NFR-10).
2. **The harness double is injected, not mocked globally.** Version probing, streaming spawn, one-shot spawn, session listing and telemetry-store reading are injected seams. No test installs a process-global `node:child_process` mock (the delivered `harness-stream-hygiene.test.ts` read-only guard forbids it). A double records every call *and its arguments* so "was a session started" and "what binding reached the invocation" are asserted from recorded arguments, never inferred.
3. **The version table is data.** One fixture module declares the version verdict and grammar table (V-01..V-19 in §4.4): raw probe stdout, expected normalized version, expected verdict, expected identity, expected exit. Suites iterate the table; adding a row is a data edit, not a new test body.
4. **Propagation fixtures are declared binding records, not ad-hoc object literals.** One fixture module declares resolved profiles with N seats, their seat identities, resolved models (`provider/model[#variant]`), the agent→seat mapping (`agentOverrides` and seat-named agents) that resolves each spawn's single-seat binding, one named agent per spawn (N seats are N spawns), a role-less spawn fixture exercised against both a multi-seat and a single-seat profile, the conflicting ambient parent values and undeclared record names used only by the variable-consuming double, and one unrepresentable seat model per variant. Canaries are unique strings asserted absent elsewhere.
5. **Every store fixture is derived from DM-10 / Appendix C (§4.1a) — never from the delivered extractor's assumptions.** Two committed builders: `tests/fixtures/harness/opencode-store/current-generation.ts` (the `session_v2`/`session_message`/`session_part` families the installed v2.2.5 writes) and `tests/fixtures/harness/opencode-store/legacy-generation.ts` (the `session`/`message`/`part` families with the observed column inventory, including the legacy `part` table having **no** `tool` column). `tests/fixtures/harness/opencode-store/build.ts` becomes the shared seeding layer over both. A fixture may declare variants by named removal (a missing optional column, a null timestamp pair, a zero cost, a missing `version`), never by inventing a column. Every variant is built in a temp directory; no binary store is committed; every variant carries a privacy canary in place of message bodies.
6. **Forbidden shapes are asserted absent, not merely avoided.** `tests/checks/fixture-store-shape.test.ts` scans every fixture DDL and builder for `work_item_ref`, `harness_version`, per-message `agent`/`model`/`input_tokens`/`output_tokens`/`reasoning_tokens`/`cache_read_tokens`/`cache_write_tokens`/`cost` columns, and `part(tool …)`; a reappearance fails the suite. This is the executable form of the spec's "zero assertions depend on a work-item column, a separate harness-version column, or per-message token columns" metric.
7. **Injected time, ids and brand.** A fixed `NOW_MS`; `capturedAt`, store timestamps and duration fixtures are literal constants, never `Date.now()`. Session ids and run ids are fixed sequences. The brand is a synthetic brand constant so a hardcoded product name fails. The probe's `now` is the injected clock, passed by identity.
8. **Read-only fixture discipline.** Truncation, clamp, and mutation probes run against temp copies (the delivered `tests/checks/harness-mutants.test.ts` temp-copy pattern); the live tree and committed fixtures are never written, and no assertion reads a diff against a moving base branch.
9. **The one permitted live observation is not a test.** It is a human-gated manual run recorded in `chg-GH-335-live-observation.md` (TC-HARNESS-045): no `.test.ts` file, not discovered by `bun test`, never invoked by `pnpm check` or CI, and never read as an oracle by any TC.
10. **Fixture privacy.** Every new fixture passes `tests/checks/fixture-privacy.test.ts`: synthetic, redacted content only — no real session ids, credentials, model-provider secrets, or personal data.

### 4.1a Observed store contract (DM-10) — the only shape fixtures may model

Recorded from Appendix C and the readiness observation. Column lists name only the fields the extractor may read; `data` documents are JSON and only non-content keys may be projected.

| Generation | Tables and readable fields | Telemetry use | Never assumed |
|---|---|---|---|
| Current (written by v2.2.5) | `session_v2(id, parent_id, version, agent, model, cost, tokens_input, tokens_output, tokens_reasoning, tokens_cache_read, tokens_cache_write, time_created, time_updated)`; `session_message(id, session_id, type, seq, time_created, time_updated, data)` where `data` (assistant) = `{agent, model:{id,providerID,variant}, cost, tokens:{input,output,reasoning,cache}, time}` and switch events are `agent-switched`/`model-switched`; `session_part` (unpopulated) | Session identity and tree from `id`/`parent_id`; version stamp from `version` (bare semver: `2.2.5`, `1.19.0`, `1.19.3` coexist); agent role (`agentRole`) baseline `session_v2.agent` with per-message `agent` and `agent-switched`; **seat and resolved model are not store facts** — they come from the run's recorded binding (DM-4) and attach only to the group whose observed agent matches the binding's agent (DM-5); observed model from the `model` object normalized to one canonical identifier; tokens from `session_v2.tokens_*` with per-message `tokens` for group detail; cost from `session_v2.cost` (`NOT NULL DEFAULT 0`); calls = count of usage-bearing message rows; durations from `time_created`/`time_updated` plus the per-message pair; tool counts absent with a warning | A work-item column; a separate harness-version column; per-message token/agent/model/cost columns; a populated tool source; conversation content; a seat read from `agent` |
| Legacy (coexists in the same store) | `session(id, parent_id, version, agent, model, cost, tokens_*, time_created, time_updated, …)`; `message(id, session_id, time_created, time_updated, data)`; `part(id, message_id, session_id, time_created, time_updated, data)` | Same field sources as the current generation, read through the legacy table names; tool counts absent with a warning because `part` has no `tool` column | A `tool` column on `part`; new sessions landing in `session` |
| Neither | — | — | `work_item_ref` anywhere; a store-wide scan; content, prompt, diff or tool-output projection |

**Store path note.** The observed store is the SQLite file in the harness data directory, not the state directory the delivered default names. The configured path reconciliation is asserted structurally (TC-HARNESS-025) and is not a live read in any suite.

### 4.2 Non-Vacuity Contract (binding for every refusal, absence, bound, divergence, generation and propagation case)

1. **A planted positive is asserted before the absence or refusal.** Before asserting a session is classified absent, a paired store that holds it lands ≥ 1 row. Before asserting an unrepresentable seat refuses, a paired representable seat spawns. Before asserting a duration is absent, a paired complete row carries literal start/end/elapsed. Before asserting a payload is bounded, an under-cap render is asserted untruncated.
2. **A paired control runs in the same test.** Every out-of-window fixture beside an in-window fixture; every unavailable-mode request beside the default-mode request; every off-grammar probe output beside the observed `opencode v2.2.5` line; every conflicting parent value beside a record-absent case; every divergent model pair beside an agreeing pair; every damaged store beside a healthy store.
3. **The gate is exercised, not hardcoded.** Mutating the pinned window value in a temp copy of the window module must flip the verdict of the same fixture (V-18): an out-of-window fixture that still refuses under a widened window proves the test asserts a literal, not the gate. Making the window unbounded must make V-19 accept, so "never widen silently" (AC-F1-4) is falsifiable in both directions.
4. **The probe is exercised, not skipped.** A passing probe control beside each failing probe; a recorded invocation count of exactly 1 proves the evaluation happened once rather than not at all; the deadline argument and the `timed-out` outcome prove the bound is applied by the gate rather than by the double.
5. **Propagation is proven at the invocation, not at the derivation.** For opencode the oracle is the recorded invocation arguments the harness seam received, cross-checked against the store's observed model; a binding object that is built and discarded fails. Each invocation must carry exactly one `--agent` and exactly one `--model` — a recording double that accepts two pairs on one invocation fails the suite, because the installed CLI is single-valued and such an argv is invalid production output (TDR-0032). For a variable-consuming harness the oracle is the built child environment, cross-checked against the same record.
6. **Generation non-vacuity is two-sided.** A test that passes against the legacy-generation fixture must fail against the current-generation fixture and vice versa where the property is generation-specific: a legacy-only extractor must land zero rows (and therefore a capture failure) on the current fixture, and a current-only extractor must land zero rows on the legacy fixture. TC-HARNESS-028 asserts both directions with mutants.
7. **A disabling mutant must fail the suite (TC-HARNESS-038).** Each mutant is a temporary copy of one production module with one honesty rule disabled. The mutant must produce the prohibited observable on an unchanged fixture; if the real module also produces nothing, the suite fails.
8. **Bounds are measured, never assumed.** Byte bounds are measured on serialized UTF-8 bytes with a positive measured length asserted first; line bounds by counting rendered lines; truncation by comparing the under-cap and over-cap renders.
9. **Permutation invariance is asserted, not assumed.** Store rows appended in shuffled order — across both generations — must yield byte-identical rows, verdicts and renders; a fixture whose expected result depends on append order fails.

### 4.3 Refusal / Oracle Matrix (binding for AC-F1-2, AC-F1-3, AC-F2-3, AC-F3-4, AC-F5-5, AC-F6-1, AC-F6-2, AC-N1-1)

Envelope shape for every refusal row: `RESULT_SCHEMA_VERSION` = `delivery.result.v1`, `error.code` equal to the identity verbatim, `error` keys exactly the six delivered fields, and `error.remediationHint` non-empty. Exit is a pure function of `projectionClass` via `packages/cli/src/projection.ts` (`user-validation → 1`, `platform-provider → 2`, `attention → 1`, `success → 0`) and is never read from a table entry. The `detail.harness` column is the TDR-0031 mapping and is asserted per identity.

| ID | Trigger | Identity (closed) | Projection class | Exit | `detail.harness` | Session-bearing side effects |
|---|---|---|---|---|---|---|
| M-01 | Observed version outside the supported window (`opencode v2.3.0`) | `harness.version.unsupported` | user-validation | 1 | Present: `kind`, `observedVersion` = `2.3.0`, `versionVerdict` = `outside`, **no** `mode` key | Session-spawn seam calls 0; telemetry rows 0; store writes 0; probe calls ≤ 1 and reaped |
| M-02 | Version indeterminate: empty stdout, non-zero exit, timeout, multi-line, or off-grammar output | `harness.version.unknown` | user-validation | 1 | Present: `kind`, `observedVersion` = `null`, `versionVerdict` = `indeterminate`, **no** `mode` key | Session-spawn seam calls 0; probe calls ≤ 1 and reaped; no version-shaped string in the slot |
| M-03 | Requested mode is not the delivered default | `harness.mode.unavailable` | user-validation | 1 | Present: `kind`, `observedVersion` non-null, `versionVerdict` = `inside`, `mode` = the **requested** mode | Session-spawn seam calls 0; no alternate transport attempt |
| M-04 | Mode branch carries an unknown value | The delivered configuration refusal identity for an invalid value (`config.value.invalid`; OQ-5 default) | user-validation | 1 | **Absent** (not a harness refusal) | No silent default applied; session-spawn seam calls 0 |
| M-05 | A required seat model the honoured surface cannot express (empty provider/model segment, missing separator, whitespace/control characters, or over the adapter's bound) | `harness.profile.model-unrepresentable` | user-validation (OQ-5 default) | 1 | Present: `kind`, `observedVersion` non-null, `versionVerdict` = `inside`, `mode` = the **resolved** mode | Session-spawn seam calls 0; no partial binding handed to any seam; rows 0 |
| M-06 | A readable store does not hold the session the dispatch ran | No new identity: classified **absence** inside the capture envelope (zero records for that session, a closed absence reason, count) ; the work-item read side reports the delivered `spend.telemetry-absent` | — (no projection change) | Unchanged (equals the paired control) | **Absent** | No zero-valued row appended; no report with zero figures; no store-wide scan |
| M-07 | Harness store cannot be opened or read | `harness.telemetry.extraction-failed` (delivered, unchanged) | platform-provider where surfaced as a command failure | Unchanged for a closeout capture (non-gating); its delivered row projection otherwise | **Absent** | No row; never re-projected as M-06; the capture envelope carries the failure reason and count |
| M-08 | Resume or attach names a different or absent session | `harness.session.unknown` (delivered, unchanged) | user-validation | 1 | **Absent** (attempt-stage shape keeps `data.error.detail`) | Idempotent kill; no orphan; no new root |
| M-09 | A declared spawn variable is absent | `harness.spawn.variable-missing` (delivered, unchanged) | user-validation | 1 | **Absent** | Session-spawn seam calls 0 |
| M-10 | In-window version, available mode, complete representable profile | — (success) | success | 0 | **Absent** | Rows land; one session |
| M-11 | A spawn names an agent a multi-seat resolved profile assigns no seat | `provider.profile.invalid` (delivered, reused — adds no code) | user-validation | 1 | **Absent** (Amendment A-2: the agent/profile/seat facts ride the bounded `error.summary`) | Session-spawn seam calls 0; attempt records 0; telemetry rows 0; `HARNESS_FAILURE_CODES` set unchanged |

**Refusal precedence (Flow 1 / Flow 2 order, binding).**

| ID | Condition | Expected outcome |
|---|---|---|
| P-01 | Out-of-window version *and* an unavailable requested mode | M-01 wins; M-03 is not evaluated; exactly one identity on the envelope |
| P-02 | In-window version *and* unavailable requested mode | M-03; no spawn |
| P-03 | In-window version, available mode, unrepresentable required seat | M-05; no spawn, no rows, no partial binding |
| P-04 | Version indeterminate *and* an unavailable requested mode | M-02 wins; `mode` is **omitted** from the slot because mode resolution has not run — never the delivered default, never `null` |

**Invariants.** Each of the four new identities is declared exactly once; the nine delivered codes keep their meaning; the unassigned-agent refusal adds none (M-11 reuses `provider.profile.invalid`); `harness.telemetry.absent` exists nowhere in the closed vocabulary or the error table; no exit literal exists outside the projection module; absence is never reused for damage and damage is never reused for absence; a refusal is a classified outcome, never a bare exit status; the `detail.harness` slot is present only on M-01, M-02, M-03 and M-05, and M-11 carries none.

### 4.4 Version Verdict and Probe Grammar Matrix (binding for AC-F1-1..AC-F1-5)

`W` = the pinned window `{2.2.x, 2.1.x}` (DEC-1). The accepted grammar is the declared contract constant (GAP-5): a product token, an optional `v`, a three-part semantic version, newline-terminated. The table is generated from that constant so parse acceptance and rejection cannot drift apart. `raw` is the probe stdout; `normalized` is `observedVersion`.

| ID | Raw probe output | Expected normalized version | Expected verdict | Expected identity | Exit | Notes |
|---|---|---|---|---|---|---|
| V-01 | `opencode v2.2.5` | `2.2.5` | inside | — | 0 | **The observed output** (16 bytes, exit 0, empty stderr): the primary row |
| V-02 | `opencode v2.1.7` | `2.1.7` | inside | — | 0 | The previous minor line |
| V-03 | `opencode v2.2.0` | `2.2.0` | inside | — | 0 | Lower bound of the current line |
| V-04 | `opencode v2.3.0` | `2.3.0` | outside | `harness.version.unsupported` | 1 | The next minor is out |
| V-05 | `opencode v2.0.9` | `2.0.9` | outside | `harness.version.unsupported` | 1 | Two minors back |
| V-06 | `opencode v3.0.0` | `3.0.0` | outside | `harness.version.unsupported` | 1 | A major beyond the window |
| V-07 | `opencode v2.2.5\n` (newline-terminated) | `2.2.5` | inside | — | 0 | The observed framing is accepted |
| V-08 | `opencode 2.2.5` (no `v`) | `2.2.5` | inside | — | 0 | The `v` is optional in the declared grammar |
| V-09 | `2.2.5` (bare semver, no product token) | — | indeterminate | `harness.version.unknown` | 1 | Off-grammar: demonstrates that a bare-semver assumption refuses and that no substring fallback exists |
| V-10 | `""` (empty stdout, exit 0) | — | indeterminate | `harness.version.unknown` | 1 | Delivered `version-probe-failed` warning preserved at instance level |
| V-11 | `opencode v2.2.5\nopencode v2.3.0` (multi-line) | — | indeterminate | `harness.version.unknown` | 1 | Multiple lines are never "pick one" |
| V-12 | `opencode v2.2.5 extra` (trailing junk) | — | indeterminate | `harness.version.unknown` | 1 | The line must match the grammar end to end |
| V-13 | `opencode v2.2` (two-part), `opencode v2.2.5.1` (four-part) | — | indeterminate | `harness.version.unknown` | 1 | A partial or extended version is never a match |
| V-14 | `v2.2.5`, `latest`, `2.two.5`, `2.2.x` | — | indeterminate | `harness.version.unknown` | 1 | Unparseable is unknown, never a match and never a partial version |
| V-15 | `opencode v2.20.0`, `opencode v12.2.5` | `2.20.0`, `12.2.5` | outside | `harness.version.unsupported` | 1 | Prefix-shaped near-misses parse but are out of window — never inside by prefix |
| V-16 | probe exits non-zero (any output) | — | indeterminate | `harness.version.unknown` | 1 | Non-zero is indeterminate regardless of stdout |
| V-17 | probe returns the `timed-out` outcome | — | indeterminate | `harness.version.unknown` | 1 | One invocation; no retry loop (NFR-2) |
| V-18 | `opencode v2.3.0` with the window constant widened to include `2.3` (temp copy) | `2.3.0` | inside | — | 0 | Non-vacuity: the gate is exercised |
| V-19 | `opencode v9.9.9` with the window constant made unbounded (temp copy) | `9.9.9` | inside | — | 0 | Proves V-04 is not hardcoded in the other direction; the production constant still refuses |

**No-configuration invariant (AC-F1-4).** The typed harness configuration branch declares no window member: a configuration document carrying an invented window key cannot widen or narrow acceptance (`opencode v2.3.0` still refuses, `opencode v2.2.5` still proceeds), whether the key is refused by the typed layer or ignored. TC-HARNESS-005 asserts the schema's key set and the unchanged verdicts.

### 4.4a Pinned probe seam (the enforcement point NFR-2 and AC-F1-5 require)

The delivered seam is `HarnessVersionProbe = () => Promise<string>`: a bare promise function with no deadline, no result status and no clock, so a test can only prove that the double rejected. This plan therefore pins the seam the implementation must introduce, and every NFR-2/AC-F1-5 bound assertion targets it:

```
HARNESS_VERSION_PROBE_TIMEOUT_MS = 5000            // declared constant, the only home of the bound
HarnessVersionProbeOutcome =
  | { status: "answered"; stdout: string }
  | { status: "timed-out" }
HarnessVersionProbe = (input: { deadlineMs: number; now: () => number })
  => Promise<HarnessVersionProbeOutcome>
```

Binding assertions: (a) the resolver passes `deadlineMs === HARNESS_VERSION_PROBE_TIMEOUT_MS` exactly once per dispatch, together with the injected clock (asserted by reference, so an ambient clock fails); (b) the production probe hands that bound to the child-process runner (`timeoutMs` option asserted on a recording runner double); (c) `timed-out` and a rejected `answered` promise both yield `indeterminate` → `harness.version.unknown`, with exactly one invocation and no retry; (d) the verdict is published only after the probe outcome is settled (ordering asserted by the double's call log); (e) the seam has exactly one production **construction site** — the dispatch path's harness resolution — with every other occurrence an injected test double; TC-HARNESS-046 pins this offline and fails when a second call site appears (spec §17.2 clause 6). Wall-clock duration remains a reference measurement (GAP-3), never a CI threshold. This seam is recorded as OQ-10 for `@plan-writer`; until the plan declares it, TC-HARNESS-006's bound half is unimplementable and must not be reported as passing.

### 4.5 Telemetry Field Matrix (binding for AC-F5-1..AC-F5-5, NFR-3, NFR-6, NFR-11)

Field names below are role names; the exact JSON keys and warning reason strings are declared once in the contract module and asserted through those constants (GAP-5); TDR-0032 Amendment A-3 makes the contract the single authored home of those names. `schemaId` is exact: `delivery.harness.telemetry.v1`. Every row's fixture is a DM-10 store (§4.1a); the seat and resolved model on a row come from the run's recorded binding (DM-4), never from the store.

| ID | Store / spawn shape | Expected row | Never |
|---|---|---|---|
| T-01 | Current generation, complete: `session_v2` row (version `2.2.5`, agent, model object, cost, five token columns, `time_created`/`time_updated`) plus usage-bearing `session_message` rows | Every field present; `schemaId === "delivery.harness.telemetry.v1"`; `harnessKind === "opencode"`; version `2.2.5` (from `session_v2.version`, normalized); seat identity; resolved model; observed model; five token classes; calls = usage-bearing message count; cost; `{start, end, elapsed}` from the store pair; tool counts absent with the declared warning | A missing mandatory field; a fabricated tool count; a version read from a column that does not exist |
| T-02 | Durations: store pair present (control) vs `time_updated` null or the per-message pair absent | Present pair → literals from the pair difference, including `elapsed === 0` when start equals end; absent pair → durations explicitly absent with the declared absence reason; `capturedAt` still present | A duration computed from `capturedAt`, an estimate, or a negative number |
| T-03 | Cost: (a) reported `0` with non-zero tokens (free model), (b) no cost source in the generation, (c) non-numeric cost | (a) `cost === 0` recorded as reported, **no** `cost-missing` warning; (b) `cost === null` + `cost-missing`; (c) `cost === null` + `non-numeric-value` | `null` for a reported zero; `0` for an absent source; a warning on the reported zero |
| T-04 | One token class absent from the generation | That class `null` with a warning; the other four counted exactly; excluded from sums | `0` in the sum for the omitted class |
| T-05 | Resolved model ≠ observed model (normalized from the per-message `model` object), and/or binding agent ≠ observed agent | Both values kept on each axis; a model-divergence warning and an agent-divergence warning from the closed vocabulary; the binding's seat attaches only to the group whose observed agent equals the binding's agent; one row per agent/model group | Overwriting either value; collapsing to one model or one agent; attaching the binding's seat to a group whose agent differs |
| T-06 | Resolved model == observed model and binding agent == observed agent (agreement control, including a variant-only difference normalized to the same canonical identifier) | No divergence warning on either axis | A warning on agreement; two identifiers for one canonical model |
| T-07 | Seat unresolved: the run bound no seat (a role-less spawn, against any profile shape including single-seat) or a session group's observed agent differs from the binding's agent | Null seat with the declared `unresolved-seat` reason and a count; the observed agent/model are still reported; never guessed from `session_v2.agent` and never rebuilt from the current profile | A fabricated seat name; a seat inferred from the store agent; a seat re-derived at capture time; a silently dropped row |
| T-08 | Pre-change row (no seat, no durations, no resolved model) | Read unchanged; new fields absent; no backfill; no crash | Enriching the stored row; a schema bump |
| T-09 | Additive-only assertion | `HARNESS_TELEMETRY_SCHEMA_ID` unchanged; no field removed or renamed; a consumer ignoring new fields behaves as before; the state-layer payload allowlist persists the new fields | A new major identity; a structural re-shape; a field dropped by the payload projection |
| T-10 | Caps exceeded (65 sessions / 17 agents / 17 models / 25 tools) | `HarnessTruncation` marks `{truncated: true, omitted, cap}` at the exact caps 64 / 16 / 16 / 24; the tool cap applies only where a populated tool source exists | A silent drop; an uncounted omission; a tool cap asserted on a store with no tool source |
| T-11 | Any read | `PRAGMA query_only = 1` recorded before the first `SELECT`; every statement bounded and scoped (a session-id predicate; per-message reads additionally scoped by message type); no full-table `message`/`part`/`session_message` scan; no `content`/`data`-content projection; no write | A write; a schema mutation; a full scan; a content column in a projection list |
| T-12 | Store seeded with prompt, transcript, diff, tool-output, credential and config canaries inside `session_message.data.content` and legacy `message.data` | No canary appears in any row, warning, or refusal envelope; no statement selects the content key | Content leakage |
| T-13 | Per-step rows plus a session baseline, including a zero-cost session with non-zero tokens | One totals basis: session totals equal the baseline once; seat breakdown sums equal the totals per class; the zero-cost session reports `0` and is not classified absent | Summing steps *and* the baseline into one total; converting a reported zero into absence |
| T-14 | Generation discrimination: current-generation fixture and legacy-generation fixture, each complete | Both land rows with the same field set read from their own tables; the legacy generation reports tool counts absent with a warning (`part` has no `tool` column); each generation's fixture fails the other generation's extractor (legacy-only and current-only mutants) | Reading `part.tool`; assuming new sessions land in `session`; a silent zero-row pass on an unrecognised generation |
| T-15 | Session-identity attribution: the held session plus many unrelated sessions (same directory, other work items, other roots) | Exactly the held session's tree is read (parent links below the held identity); zero records for unrelated sessions; zero statements match a work-item-shaped column | A work-item query; a store-wide scan; attributing by title or directory |
| T-16 | Version stamp and divergence: `session_v2.version` present (control) vs null/absent; probed installed version equal vs different | Present → normalized stamp on every row; absent → `null` + warning; divergence from the probed version → `version-drift` warning with both values kept | A fabricated version; overwriting either value; a `v`-prefixed stamp |

### 4.6 Conformance Scenario Matrix (binding for AC-F7-1..AC-F7-3)

| ID | Registry condition | Expected outcome | Never |
|---|---|---|---|
| C-01 | Delivered floor unchanged | `HARNESS_CONFORMANCE_FLOOR_SCENARIOS` is exactly the six delivered ids in order; both `opencode` and `claude-code` register every one; `harnessConformanceViolations` is `[]` | A renamed, reordered or removed floor scenario; the floor constant widened by the extension |
| C-02 | Extension declared | `HARNESS_CONFORMANCE_EXTENSION_SCENARIOS` is exactly the four ids — `version-window`, `version-unknown`, `mode-unavailable`, `profile-propagation` — and each registration declares all four | A fifth id invented at registration time; an extension id mixed into the floor constant |
| C-03 | One registration missing one extension scenario | Violations contain a message naming the harness *and* the missing scenario; the suite fails | A silent pass; a message naming only one of the two |
| C-04 | A new refusal identity with no registered scenario | Violations name the identity; the identity→scenario map covers `harness.version.unsupported` → `version-window`, `harness.version.unknown` → `version-unknown`, `harness.mode.unavailable` → `mode-unavailable`, `harness.profile.model-unrepresentable` → `profile-propagation` | An identity that ships unexercised; a new telemetry-absence identity (there is none) |
| C-05 | Each extension scenario executed through the additive executor | The scenario's declared expectation is produced: `version-window` asserts inside-proceeds **and** outside-refuses; `version-unknown` asserts the unknown identity with `null`; `mode-unavailable` asserts the identity and the requested mode; `profile-propagation` asserts the binding reaches the honoured invocation surface **and** an unrepresentable seat refuses; refusal directions record zero session starts | A declaration-only id; a live process; a store read |
| C-06 | Executor surface | One additive executor beside the registry (`runHarnessConformanceScenario`-shaped, GAP-5) consumes `{ registration, scenarioId, io, deps }` and returns the scenario's declared outcome; the registry keeps `build` for the floor | A second registry, a forked module, or a test-local re-implementation of the scenarios |
| C-07 | CI execution | Zero sockets, zero live harness invocations, zero credentials; the suite runs inside `bun test tests/conformance` | Any network or process dependency |
| C-08 | One extension scenario's guard disabled (mutant) | That scenario's oracle fails while its fixture is unchanged | A scenario that cannot fail |
| C-09 | Scenario-id union discipline | `HarnessConformanceScenarioId` is a union of the floor type and the extension type; a test pinning the floor's exact six values still passes after an extension id is added, and a test pinning the extension's exact four values fails when it changes | A single flat union that makes a new id silently widen the floor; an `as`-cast that bypasses the union |
| C-10 | Executor location | The executor and both id constants live in `packages/testkit/src/conformance/harness.ts` (beside the registry), and the suite that drives them lives in `tests/conformance/harness-extension-scenarios.test.ts` | The executor inlined in a test file, duplicated per adapter, or placed in a package the adapters cannot import |

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Suite class | Scenario type | Level | Priority | AC coverage |
|-------|-------|-------------|---------------|-------|----------|-------------|
| TC-HARNESS-001 | In-window dispatch proceeds and carries one version verdict | behaviour | Happy Path | Integration | Critical | AC-F1-1 |
| TC-HARNESS-002 | **TC-M3-HARNESS-002** — out-of-window version refuses, no session spawned | behaviour | Negative | Integration | Critical | AC-F1-2, NFR-1 |
| TC-HARNESS-003 | Indeterminate or unparseable version refuses with the distinct unknown identity | behaviour | Negative | Unit/Behaviour | Critical | AC-F1-3, AC-F1-5, NFR-6 |
| TC-HARNESS-004 | Version verdict matrix: boundary and parse table | unit | Corner Case | Unit | High | AC-F1-1, AC-F1-2 |
| TC-HARNESS-005 | Window is pinned data: no configuration key widens or narrows it | unit | Edge Case | Unit/Behaviour | Critical | AC-F1-4 |
| TC-HARNESS-006 | One bounded probe per dispatch through the pinned deadline seam, before any session | behaviour | Regression | Integration | Critical | AC-F1-1, AC-F1-2, AC-F1-3, AC-F1-5, NFR-1, NFR-2 |
| TC-HARNESS-007 | Delivered default mode used on its observed surface with no runtime fallback | behaviour | Happy Path | Behaviour | Critical | AC-F2-1 |
| TC-HARNESS-008 | Unavailable requested mode refuses naming requested and available | behaviour | Negative | Behaviour | Critical | AC-F2-3, NFR-1 |
| TC-HARNESS-009 | Mode origin: omitted → `defaults`; unknown value → refusal, never default | behaviour | Edge Case | Behaviour | High | AC-F2-4 |
| TC-HARNESS-010 | Mode and adapter-contract decision records: content, chosen-mode equality, index row | structure | Regression | Structure | Critical | AC-F2-2 |
| TC-HARNESS-011 | **TC-M3-HARNESS-001** — one seat per spawn across N spawns reaches the honoured surface, plus seat-attributed rows | behaviour | Happy Path | Integration | Critical | AC-F3-1, AC-F5-1 |
| TC-HARNESS-012 | Record value beats a conflicting ambient parent value | unit | Happy Path | Unit/Behaviour | Critical | AC-F3-2 |
| TC-HARNESS-013 | Undeclared record names change nothing; no ambient forwarding; allowlist not widened | unit | Negative | Unit/Behaviour | Critical | AC-F3-3, NFR-9 |
| TC-HARNESS-014 | Unrepresentable seat model and unassigned named agent refuse before any session | behaviour | Negative | Behaviour | Critical | AC-F3-4, NFR-1 |
| TC-HARNESS-015 | Propagation is per spawn, not process-global; a named agent resolves the single-seat profile's sole seat while a role-less spawn binds nothing | behaviour | Corner Case | Behaviour | Important | AC-F3-1, AC-F3-2 |
| TC-HARNESS-016 | Spawn, deliver and resume share one propagation contract | behaviour | Regression | Integration | High | AC-F3-1, AC-F4-1 |
| TC-HARNESS-017 | Resume continues identity and preserves the tree root | behaviour | Happy Path | Behaviour | High | AC-F4-1 |
| TC-HARNESS-018 | Attach resolves from a bounded listing, spawns nothing, and keeps unknown-session semantics | behaviour | Edge Case | Behaviour | High | AC-F4-1 |
| TC-HARNESS-019 | Row shape from the current generation: identity, session version, seat, both models, tokens, calls, cost, durations | behaviour | Happy Path | Contract/Behaviour | Critical | AC-F5-1, DM-9, DM-10 |
| TC-HARNESS-020 | Pre-change rows stay readable and unchanged; additive only | behaviour | Regression | Contract/Behaviour | Critical | AC-F5-2 |
| TC-HARNESS-021 | Model and version divergence disclosed with both values kept, never overwritten | behaviour | Edge Case | Behaviour | Critical | AC-F5-3, DM-9 |
| TC-HARNESS-022 | Durations come from store timestamps; a missing pair is explicitly absent | behaviour | Negative | Behaviour | Critical | AC-F5-4, NFR-6 |
| TC-HARNESS-023 | Absence is classified inside the capture envelope; no identity, no zero row, read side untouched | behaviour | Negative | Behaviour | Critical | AC-F6-1, AC-F6-2, AC-F5-5, NFR-6 |
| TC-HARNESS-024 | Unreadable store is extraction failure, never absence, and stays non-gating | behaviour | Negative | Behaviour | Critical | AC-F6-2, NFR-11 |
| TC-HARNESS-025 | Bounded read discipline: query-only pragma, scoped and indexed statements, exact caps | behaviour | Regression | Behaviour | High | NFR-3, AC-F5-5 |
| TC-HARNESS-026 | One totals basis: seat attribution does not double count | behaviour | Corner Case | Behaviour | High | AC-F5-1, NFR-6 |
| TC-HARNESS-027 | Privacy: identity, counts, cost and durations only | behaviour | Regression | Behaviour/Checks | High | NFR-5, NFR-9 |
| TC-HARNESS-028 | Store-generation tolerance: current and legacy fixtures degrade honestly, both directions | behaviour | Edge Case | Behaviour | High | AC-F5-1, AC-F5-4, NFR-11 |
| TC-HARNESS-029 | Byte-identical determinism and zero network or model calls | behaviour | Regression | Checks | High | NFR-7 |
| TC-HARNESS-030 | Bounded output with marked truncation; refusal identity and hint never truncated | behaviour | Corner Case | Behaviour | High | NFR-4 |
| TC-HARNESS-031 | Delivered six-id classification floor unchanged and passing | conformance | Regression | Conformance | Critical | AC-F7-1 |
| TC-HARNESS-032 | Missing extension scenario or unexercised identity fails and names both | conformance | Negative | Conformance | Critical | AC-F7-2 |
| TC-HARNESS-033 | Extension scenarios execute through the additive executor and prove their property | conformance | Happy Path | Conformance | Critical | AC-F7-2, AC-F7-3 |
| TC-HARNESS-034 | Conformance runs offline with zero live harness invocations | conformance | Regression | Checks | Critical | AC-F7-3, NFR-10 |
| TC-HARNESS-035 | Refusal identity contract: four rows, no telemetry-absence identity, envelope member pins | structure | Regression | Structure/Checks | Critical | AC-N1-1 |
| TC-HARNESS-036 | Refusals leave no session-bearing side effect; the single probe is completed and reaped | negative | Negative | Integration | Critical | AC-N1-1, NFR-1 |
| TC-HARNESS-037 | Gate composition does not disturb the delivered stream, handle or bounds behaviour | behaviour | Regression | Integration | High | NFR-8 |
| TC-HARNESS-038 | Mutant meta-suite over every new honesty rule | fixture | Regression | Checks (mutation) | Critical | AC-F1-2, AC-F1-3, AC-F1-4, AC-F1-5, AC-F2-1, AC-F3-2, AC-F3-3, AC-F3-4, AC-F5-1, AC-F5-3, AC-F5-4, AC-F6-1, AC-F6-2, AC-F7-2 |
| TC-HARNESS-039 | Whole-change offline hermetic posture | fixture | Regression | Checks | Critical | NFR-10 |
| TC-HARNESS-040 | Dispatch outcome and refusal disclose the version verdict, the selected mode, and the `detail.harness` member | behaviour | Happy Path | Behaviour | Important | AC-F1-1, AC-F2-1, AC-F1-3, AC-F2-3, AC-F3-4 |
| TC-HARNESS-041 | Documentation reconciliation for window, mode, propagation, seat telemetry and decision links | structure | Regression | Manual + Structure | Important | AC-F2-2 |
| TC-HARNESS-042 | Probe grammar and normalization: the observed line, the accepted forms, and every failing shape | behaviour | Corner Case | Contract/Behaviour | Critical | AC-F1-5, AC-F1-1, AC-F1-3, NFR-2, NFR-6 |
| TC-HARNESS-043 | Attribution by every held session identity plus the recorded binding; no work-item column, no store-wide scan | behaviour | Regression | Behaviour/Checks | Critical | AC-F5-5, DM-8, DM-10, NFR-3, NFR-5 |
| TC-HARNESS-044 | Mandatory-usage boundary: a held session with no observable usage fact is a failed-session entry | behaviour | Negative | Behaviour | Critical | AC-F5-5, AC-F6-2, NFR-11 |
| TC-HARNESS-045 | Human-gated live observation: rows for a session the dispatch ran through the installed harness on an agent-naming invocation | manual | Happy Path | Manual | Critical | AC-F5-6, AC-F3-1, NFR-10 |
| TC-HARNESS-046 | Single production probe construction site | structure | Regression | Structure/Checks | Critical | AC-F1-1, AC-F1-5 |

### 5.2 Scenario Details

#### TC-HARNESS-001 - In-window dispatch proceeds and carries one version verdict

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-1, DM-1, DM-2
**Test Type(s)**: Integration, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: harness resolution seam (`packages/core/src/domain/harness-registry.ts` plus the new window evaluation module); `tests/behaviour/harness-version-gate.test.ts`
**Tags**: @offline, @harness, @version-gate

**Preconditions**:

- Injected version probe returning `{status: "answered", stdout: "opencode v2.2.5\n"}` through the pinned deadline seam (§4.4a); a resolved profile with two seats; a recording streaming-spawn double.
- Injected clock and ids; the pinned window default (V-01 in §4.4).

**Steps**:

1. Resolve the harness with the in-window probe result and a resolved profile.
2. Assert the resolved instance carries `observedVersion === "2.2.5"` — the **normalized** bare semver, not the raw line — and a verdict equal to the declared *inside* constant (DM-2).
3. Assert no `versionWarning` is set, and that resolution did not refuse.
4. Spawn one session through the port and assert the session-spawn seam was called exactly once.

**Expected Outcome**:

- The dispatch proceeds; the instance carries the observation and one verdict; downstream consumers read the verdict from the instance rather than re-deriving it.

**Binding oracle**:

- `instance.observedVersion === "2.2.5"`; `instance.versionVerdict === INSIDE` (declared constant); `instance.versionWarning === undefined`; the raw probe line `opencode v2.2.5` is not the stamped value; session-spawn seam `calls === 1`; exit `0`; zero refusal envelope.

**Postconditions**:

- Temp root discarded; no writes outside it.

**Notes / Clarifications**:

- The verdict field name and the three verdict values are declared once in the contract module (GAP-5); this plan asserts through those constants.

#### TC-HARNESS-002 - Pinned TC-M3-HARNESS-002: out-of-window version refuses with no session

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-2, NFR-1, DM-1, DM-2, RSK-2
**Test Type(s)**: Integration, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: harness resolution + refusal projection; `tests/behaviour/harness-version-gate.test.ts` (matrix M-01, V-04)
**Tags**: @offline, @harness, @version-gate, @refusal

**Preconditions**:

- Injected probe returning `{status: "answered", stdout: "opencode v2.3.0\n"}` (outside `2.2.x` + `2.1.x`); a paired in-window fixture (`opencode v2.2.5\n`) in the same test.
- A recording streaming-spawn double and a recording telemetry-append seam.

**Steps**:

1. Attempt a dispatch with the out-of-window probe result.
2. Assert the refusal identity, projection class and exit from matrix M-01, including the `detail.harness` member set (`outside`, normalized version present, no `mode` key).
3. Assert the envelope carries the observed version and a remediation hint naming both supported lines.
4. Assert the session-spawn seam call count is `0`, the telemetry append count is `0`, and the store write count is `0`.
5. Mutate the probe output to `opencode v2.2.5\n` on the same fixture and assert the dispatch proceeds (non-vacuity per §4.2 rule 2).

**Expected Outcome**:

- The pinned scenario holds verbatim: an out-of-window version refuses with `harness.version.unsupported` and no session is spawned; the fix is an upgrade named in the hint.

**Binding oracle**:

- `error.code === "harness.version.unsupported"`; `projectionClass === "user-validation"`; exit `1`; envelope `schemaVersion === "delivery.result.v1"`; `detail.harness.versionVerdict === "outside"` and `detail.harness.observedVersion === "2.3.0"` with no `mode` key; `remediationHint` non-empty and contains the supported lines; session-spawn seam `calls === 0`; telemetry appends `0`; store writes `0`.

#### TC-HARNESS-003 - Indeterminate version refuses with the distinct unknown identity

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-3, AC-F1-5, NFR-6, DM-2, DEC-3, DEC-11
**Test Type(s)**: Unit, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: probe outcome classification and version parsing; `tests/behaviour/harness-version-gate.test.ts` (matrix M-02, V-09..V-17)
**Tags**: @offline, @harness, @version-gate, @refusal

**Preconditions**:

- Probe variants: a rejected `answered` promise; empty stdout with exit 0; `opencode v2.2`; `opencode v2.2.5 extra`; `latest`; `2.2.5` with no product token; the `timed-out` outcome. A paired passing probe control (`opencode v2.2.5\n`).

**Steps**:

1. Resolve the harness for each variant.
2. Assert the refusal identity is `harness.version.unknown` and that it is **not** `harness.version.unsupported` (explicit distinctness assertion).
3. Assert the instance-level observation remains `null`, no `v`-prefixed or partial version is stamped anywhere, and the delivered warning is exactly `version-probe-failed` for the probe-failure variants.
4. Assert the refusal envelope carries no version-shaped string beyond the identity text, and that `detail.harness.observedVersion === null` with `versionVerdict === "indeterminate"` and no `mode` key.
5. Assert the paired passing probe resolves inside and spawns.

**Expected Outcome**:

- An undeterminable version is its own classified condition with its own identity; the observation stays the explicit unknown; nothing is guessed and nothing proceeds silently (DEC-3, DEC-11, NFR-6).

**Binding oracle**:

- `error.code === "harness.version.unknown"`; `error.code !== "harness.version.unsupported"`; `observedVersion === null`; `versionWarning === "version-probe-failed"` where the probe failed or was `timed-out`; exit `1`; session-spawn seam `calls === 0`; no string matching a semantic-version pattern in the serialized envelope beyond the identity text.

#### TC-HARNESS-004 - Version verdict matrix: boundary and parse table

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-1, AC-F1-1, AC-F1-2, AC-F1-5, DM-1, DM-2
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: window evaluation, version parsing and normalization; `tests/behaviour/harness-version-window.test.ts` + `tests/structure/harness-version-window-contract.test.ts`
**Tags**: @offline, @harness, @version-gate

**Preconditions**:

- The declared version/grammar table fixture (V-01..V-19) and the accepted-grammar constant.

**Steps**:

1. Iterate every table row and assert the normalized version, verdict, identity and exit match exactly.
2. Assert the parse-acceptance constant and the table agree: every accepted form appears in the table, every rejected form is `indeterminate`, and the grammar requires a product token and a three-part semver (the `v` is optional).
3. Assert both minor lines of the window are represented (`opencode v2.2.0`, `opencode v2.2.5`, `opencode v2.1.7`) and both immediate outsides (`opencode v2.0.9`, `opencode v2.3.0`).
4. Assert prefix-shaped near-misses (`opencode v2.20.0`, `opencode v12.2.5`) parse but are **outside** — never inside by prefix — and that a bare `2.2.5` with no product token is indeterminate, not inside.
5. Assert the stamped `observedVersion` is never the raw line and never carries a `v` prefix.

**Expected Outcome**:

- Boundary and grammar behavior is pinned as data, not as incidental parsing behavior; prefix-shaped near-misses never pass and off-grammar output never becomes a permissive pass.

**Binding oracle**:

- Per row: normalized version, verdict, identity and exit as tabulated; `opencode v2.20.0` and `opencode v12.2.5` are not *inside*; `2.2.5` is `indeterminate`; no stamped value starts with `v`.

#### TC-HARNESS-005 - Window is pinned data: no configuration key widens or narrows it

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-4, DM-1, DEC-1, RSK-2
**Test Type(s)**: Unit, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: window policy constants and the typed harness configuration branch; `tests/behaviour/harness-version-window.test.ts` + `tests/structure/harness-version-window-contract.test.ts` (V-18, V-19)
**Tags**: @offline, @harness, @version-gate, @config

**Preconditions**:

- The declared pinned window constant. Configuration variants: the harness branch absent; the branch with only the declared members; a document carrying an invented window-shaped key (e.g. a value that would select `>=2` or a line older than `2.1`) as an unknown key.

**Steps**:

1. Assert the pinned constant is exactly the current minor line plus one previous minor (`2.2` + `2.1` at intake) and is the only place acceptance widens.
2. Assert structurally that the typed harness configuration branch declares no window member (its key set is pinned), so no shipped configuration path can widen or narrow acceptance.
3. With the branch absent, assert the pinned default applies (`opencode v2.2.5` inside, `opencode v2.3.0` outside).
4. With a document carrying an invented window-shaped key, assert acceptance is unchanged in both directions — `opencode v2.2.5` still proceeds and `opencode v2.3.0` still refuses — whether the key is refused by the typed layer or inert.
5. Assert a temp-copy widening of the constant flips V-04 to inside and a temp-copy unbounded constant accepts `opencode v9.9.9`, so the assertion tracks the gate and not a literal.

**Expected Outcome**:

- A pinned, testable default governs acceptance and no configuration path can accidentally widen it (DEC-1, RSK-2, AC-F1-4).

**Binding oracle**:

- `WINDOW === {lines: ["2.2", "2.1"]}`; the configuration branch's key set contains no window member; for every variant: `opencode v2.3.0 → harness.version.unsupported`, exit `1`, and `opencode v2.2.5 → inside`; `9.9.9` refuses under the production constant.

#### TC-HARNESS-006 - One bounded probe per dispatch through the pinned deadline seam, before any session

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-1, AC-F1-2, AC-F1-3, AC-F1-5, NFR-1, NFR-2, RSK-8
**Test Type(s)**: Integration, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: harness resolution, the pinned probe seam (§4.4a) and the production probe's child-process call; `tests/behaviour/harness-version-probe-seam.test.ts`
**Tags**: @offline, @harness, @version-gate, @bound

**Preconditions**:

- A recording probe double that captures its input (`deadlineMs`, `now`) and returns a declared `HarnessVersionProbeOutcome`; a separate recording session-spawn double; a recording child-process runner double standing behind the production probe.
- An injected clock returning a fixed number; `HARNESS_VERSION_PROBE_TIMEOUT_MS` imported from the contract.

**Steps**:

1. Run one dispatch and assert the probe is invoked exactly once, before any session-spawn call (ordering asserted from the double's call log), and that its input carries `deadlineMs === HARNESS_VERSION_PROBE_TIMEOUT_MS` and the injected `now` **by reference**.
2. Assert the production probe passes that bound to the child-process runner (`timeoutMs === HARNESS_VERSION_PROBE_TIMEOUT_MS`) and that the invocation is shell-free (no shell flag, no prompt, no session args).
3. Assert ordering for both cases from the recorded log: in-window → "probe, then session"; refusal → "probe, then nothing".
4. Return the `timed-out` outcome and assert the verdict is `indeterminate` with identity `harness.version.unknown`, invocation count still `1`, and no retry loop; assert the verdict is not published before the outcome settles.
5. Assert a failed probe preserves the delivered `version-probe-failed` instance warning while the dispatch-level consequence is the refusal.
6. Record a local reference measurement of the real probe duration in §10 (non-CI, GAP-3).

**Expected Outcome**:

- The gate is evaluated once, bounded through a pinned and asserted enforcement point, before any session; a probe that cannot answer is classified, never retried, never fabricated (NFR-2, RSK-8 mitigation proven at the seam).

**Binding oracle**:

- Probe seam `calls === 1`; input `deadlineMs === 5000` (the constant) and `now` identical by reference to the injected clock; runner `timeoutMs === 5000`; probe args contain no shell and no prompt; session-spawn seam `calls === 0` on refusal; on `timed-out`: `error.code === "harness.version.unknown"`, exit `1`, probe `calls === 1`; on failure: `versionWarning === "version-probe-failed"`.

**Notes / Clarifications**:

- The delivered `HarnessVersionProbe = () => Promise<string>` has no deadline, status or clock, so a 5 001 ms fake-clock advance cannot prove anything about the gate — it only proves the double rejected. The bound is therefore asserted at the seam §4.4a pins (deadline argument + explicit `timed-out` outcome + runner timeout), and the wall-clock half is demoted to the §10 reference measurement (GAP-3). If the plan does not declare this seam, this TC's bound half is unimplementable and must be reported as a GAP, never as passing (OQ-10).

#### TC-HARNESS-007 - Delivered default mode used with no runtime fallback

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, AC-F2-1, DM-3, DEC-2, NG-2
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: mode resolution and the opencode dispatch path; `tests/behaviour/harness-mode-selection.test.ts`
**Tags**: @offline, @harness, @mode

**Preconditions**:

- No mode configured; recording doubles for every observed transport surface: the per-invocation private-server invocation (`--standalone` on the spawn argv), the managed background service (`service start|restart|status|stop`), and the client to a running server (`--server`/`api`).

**Steps**:

1. Resolve settings and spawn one session.
2. Assert the resolved mode equals the declared default-mode constant and that the default maps to the `standalone` surface in the declared surface table.
3. Assert exactly one transport family recorded a call and it is the default's family; assert the spawn argv carries `--standalone` exactly once; assert zero `service` subcommand invocations and zero `api` client constructions.
4. Make the default transport fail; assert the failure is the default mode's classified outcome and that no alternate transport was attempted afterwards.
5. Assert the recorded `mode` on the outcome equals the resolved mode, so a silent switch is observable.

**Expected Outcome**:

- The declared default is the only mode a dispatch uses on the surface the installed harness exposes, and a transport failure is reported rather than papered over by a fallback (DEC-2, NG-2, AC-F2-1).

**Binding oracle**:

- `resolvedMode === DEFAULT_HARNESS_MODE` (declared constant, OQ-1 answer); default transport `calls === 1` with `--standalone` in the argv; every other transport `calls === 0`; on failure exit and identity are the default mode's classified outcome; recorded `mode === resolvedMode` in both cases.

#### TC-HARNESS-008 - Unavailable requested mode refuses naming requested and available

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, AC-F2-3, DM-3, NFR-1, DEC-2
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: mode resolution refusal; `tests/behaviour/harness-mode-refusal.test.ts` (matrix M-03)
**Tags**: @offline, @harness, @mode, @refusal

**Preconditions**:

- A configured mode equal to each of the two non-default declared modes in turn; a recording spawn seam; a paired default-mode control.

**Steps**:

1. Resolve settings with a non-default mode requested and attempt a dispatch.
2. Assert the refusal identity, projection class and exit per M-03.
3. Assert the envelope names both the requested mode and the available mode through the declared closed vocabulary, and that `detail.harness.mode` equals the **requested** mode with `versionVerdict === "inside"`.
4. Assert the session-spawn seam call count is `0` and no transport double recorded a call.
5. Run the paired default-mode control and assert it spawns.

**Expected Outcome**:

- An unavailable mode is a classified, actionable refusal before any spawn, and the operator learns both the request and the available alternative (AC-F2-3).

**Binding oracle**:

- `error.code === "harness.mode.unavailable"`; `projectionClass === "user-validation"`; exit `1`; the structured error carries each non-default vocabulary member in turn and the available `DEFAULT_HARNESS_MODE`; `detail.harness.mode === requestedMode` and `versionVerdict === "inside"`; all transport calls `0`.

#### TC-HARNESS-009 - Mode origin and unknown-value refusal

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-F2-4, DM-3
**Test Type(s)**: Behaviour, Integration
**Automation Level**: Automated
**Target Layer / Location**: typed `harness` configuration branch + mode resolution; `tests/behaviour/harness-mode-config.test.ts` (matrix M-04)
**Tags**: @offline, @harness, @mode, @config

**Preconditions**:

- Config fixtures: branch absent; branch with the default mode explicitly set; branch with an unknown value (`"daemon"`), a wrong-typed value, and an empty string.

**Steps**:

1. With the branch absent, resolve settings and assert the mode equals the default and its origin equals `defaults`.
2. With the default set explicitly, assert origin equals `configured` and the same mode value.
3. For each unknown or malformed value, assert a refusal (never a silent default), that no spawn occurred, and that the refusal's `detail.harness` member is **absent** (this is a configuration refusal, not one of the four harness refusals).
4. Assert the declared mode vocabulary is exactly the three observed surfaces, each mapped to its observed surface in the declared table, and that no vocabulary member exists without a surface.
5. Assert the resolved mode is never inferred from ambient state: an ambient variable shaped like a mode is injected and must change nothing (NFR-9).

**Expected Outcome**:

- The mode is a declared value with an observable origin drawn from the surfaces the harness actually exposes; an unknown value is refused rather than defaulted; ambient state cannot select a mode (AC-F2-4, DM-3).

**Binding oracle**:

- Absent → `mode === DEFAULT_HARNESS_MODE` and `origin === "defaults"`; explicit → `origin === "configured"`; unknown value → `error.code === "config.value.invalid"` (OQ-5 default), exit `1`, spawn calls `0`, no `detail.harness`; vocabulary length `3` with each member in the surface table; ambient canary changes nothing.

#### TC-HARNESS-010 - Mode and adapter-contract decision records: content, chosen-mode equality, index row

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-2, AC-F2-2, G-8, DEC-7, DM-3
**Test Type(s)**: Contract, Structure
**Automation Level**: Automated structural assertions + manual content review
**Target Layer / Location**: `doc/decisions/`; `tests/checks/decision-record.test.ts` (extend the inventory)
**Tags**: @offline, @docs, @decision

**Preconditions**:

- The delivered per-type identifier convention (`TYPE-NNNN-slug.md` under `doc/decisions/`) and the decision-record contract test.
- The two records this change authors (the integration-mode record and the adapters-contract record; TDR-0031 is the third and is authored for the envelope member).

**Steps**:

1. Assert a mode decision record and an adapters-contract decision record exist and follow the identifier convention, with `Proposed` or `Accepted` status.
2. Assert the mode record states a chosen mode that equals the delivered default-mode constant (the same constant TC-HARNESS-007 asserts), that the chosen mode is one of exactly the three declared vocabulary members, and that each declared member names its observed surface.
3. Assert the mode record states the read-only direct-store rationale.
4. Assert both records carry a reviewable body (problem framing, alternatives considered, consequences, verification criteria) rather than a decorative summary — the R2 body the decision instructions require.
5. Assert `doc/decisions/00-index.md` lists both records.

**Expected Outcome**:

- The decision precedes the behavior it governs and cannot drift from the code: the record's chosen mode and the default constant are asserted equal (DEC-7; acceptance is human-gated — GAP-4). The feature-spec and change-artifact *links* are owned by TC-HARNESS-041 in the documentation phase, so this TC can be green at its own phase boundary.

**Binding oracle**:

- Both record files exist under the convention; mode record `chosenMode === DEFAULT_HARNESS_MODE`; chosen mode ∈ the declared three-member vocabulary; read-only direct-store rationale present; alternatives and verification sections non-empty; index rows present; `tests/checks/decision-record.test.ts` green.

**Notes / Clarifications**:

- Retargeted from readiness finding 11: the previous oracle required `feature-harness-adapters.md` to contain the mode-record link, which Phase 8 owns. That assertion now lives only in TC-HARNESS-041.

#### TC-HARNESS-011 - Pinned TC-M3-HARNESS-001: one seat per spawn across N spawns plus seat-attributed rows

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, F-5, AC-F3-1, AC-F5-1, DM-4, DM-5, DM-6, DM-8, DM-10
**Test Type(s)**: Integration, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: per-spawn binding construction, the opencode adapter's invocation assembly (`packages/adapters/src/harness/opencode.ts`) and telemetry extraction; `tests/behaviour/harness-profile-propagation.test.ts` + `harness-telemetry-seat-attribution.test.ts`
**Tags**: @offline, @harness, @profile, @telemetry

**Preconditions**:

- A resolved profile with three seats, three distinct resolved models in `provider/model[#variant]` form, and an agent→seat mapping that assigns each of three named agents its own seat (`agentOverrides` or seat-named agents); one seat whose declared name differs from its agent identity.
- A recording streaming-spawn double that records each call's **invocation argv** and child environment; a current-generation fixture store (§4.1a) holding one session per spawn, each exposing its agent/model, tokens and cost.

**Steps**:

1. Spawn three sessions through the port, one per named agent, so the three-seat profile is exercised as three spawns (N seats ⇒ N spawns; TDR-0032, DEC-13).
2. Assert each spawn input carries a single-seat binding as data: exactly one entry holding the agent identity, the seat resolved for it, and that seat's resolved model — never a seat map.
3. Assert each recorded invocation argv carries exactly one `--agent <agent>` equal to that spawn's agent identity (never the seat name where they differ) and exactly one `--model <provider>/<model>[#<variant>]` equal to that seat's resolved model; assert no invocation carries two of either, and no value is borrowed from another seat or read from ambient state.
4. Assert the session-spawn seam recorded `calls === 3`, three distinct session identities, and that each invocation maps to its own session.
5. Assert each child environment gains **no** per-seat `OC_*` model variable: every environment key set equals the declared allowlist set, so the propagation is an argument, not an invented variable family (DEC-8, NG-10).
6. Collect evidence and assert each session's store-reported model equals its own resolved model (agreement 3/3; divergence is TC-HARNESS-021).
7. Land telemetry and assert three row sets, one per session, with distinct `seat` values equal to the three resolved seats, non-null tokens and cost, the schema identity on every row, and zero unattributed seats (TC-HARNESS-019 supplies the field assertions; TC-HARNESS-043 supplies attribution).

**Expected Outcome**:

- The pinned scenario holds offline at the row-and-session grain: a three-seat profile is three spawns and three sessions, each invocation carries exactly its own seat's binding, the sessions' reported models agree, and versioned rows carry those seats with tokens and cost; zero seats are unattributed.

**Binding oracle**:

- Session-spawn seam `calls === 3` and three distinct session identities; per invocation the recorded `argv` contains exactly one `--agent` and exactly one `--model`, the `--agent` value equal to that spawn's agent identity and the `--model` value equal to that seat's resolved model; no invocation carries two of either; each spawn's binding holds exactly one seat and the three bindings' seats are distinct (3/3); each child environment key set equals the declared allowlist set (no added seat variable); each session's observed model equals its resolved model (3/3); three row sets with distinct `seat` values equal to the resolved seats; every row `schemaId === "delivery.harness.telemetry.v1"`; `tokens` non-null; `cost` non-null; unattributed seats `0`.

**Notes / Clarifications**:

- Retargeted per DEC-8/OQ-2 and again per readiness iteration 2 finding C2 and TDR-0032: the previous oracle inspected a spawn *descriptor* carrying `OC_*_AGENT_*_MODEL` values, a surface the installed harness does not consume, and the 1.2 oracle asserted three `--agent`/`--model` pairs on one invocation with `calls === 1` — a shape only a recording double could satisfy while production sent a single-valued argv the CLI cannot accept. The oracle is now exactly one pair per invocation and N invocations for N seats, so a collapsed seat, a short spawn count, or a two-pair invocation each fails. GAP-2: this proves propagation *to* the harness; the real harness honouring it is AC-F5-6's human-gated observation (TC-HARNESS-045), never this test's oracle.
- The role-less control lives in TC-HARNESS-015: a spawn naming no agent binds nothing whatever the profile's seat count, single-seat included (TDR-0032 Amendment A-1), and is disclosed as `unresolved-seat`.
- The three spawns model the delivery model TDR-0032 describes: N seats are N dispatches (or N spawns across a resume chain), each holding one session and one binding. The test never puts a seat map on one spawn.
- The variable-consuming path (declared name or seat `envName`) is still exercised — against a harness double that consumes variables — in TC-HARNESS-012 and TC-HARNESS-013.

#### TC-HARNESS-012 - Record value beats a conflicting ambient parent value

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-2, DM-4, NFR-9
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: deny-by-default environment builder (`packages/core/src/domain/harness-spawn-env.ts`) with a per-spawn binding record map, exercised through a variable-consuming harness double; `tests/behaviour/harness-profile-precedence.test.ts` (matrix P-02)
**Tags**: @offline, @harness, @profile, @spawn-env

**Preconditions**:

- A descriptor declaring the seat variable; an injected parent environment carrying a conflicting value (`canary-ambient-model`); a resolved record value (`synthetic/model-resolved`).
- A harness double that consumes declared variables (the delivered `envName`/derived-name path). The opencode adapter does not use this path — its binding is an argument (TC-HARNESS-011) — so this case is asserted on the surface that does consume variables.

**Steps**:

1. Build the child environment with both values present.
2. Assert the built entry equals the resolved record value.
3. Assert the ambient conflicting value appears nowhere in the built environment or in serialized evidence.
4. Run the paired control: the record omits that name and the declared parent value is used unchanged.

**Expected Outcome**:

- The resolved profile is authoritative for a declared name, and a stale ambient value cannot override it (AC-F3-2).

**Binding oracle**:

- `childEnv[SEAT_VAR] === "synthetic/model-resolved"`; `"canary-ambient-model"` absent from the built environment and from serialized evidence; control: `childEnv[SEAT_VAR] === parentValue`.

#### TC-HARNESS-013 - Undeclared record names change nothing; no ambient forwarding

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-3, NFR-9, RSK-6
**Test Type(s)**: Unit, Contract
**Automation Level**: Automated
**Target Layer / Location**: deny-by-default environment builder; `tests/behaviour/harness-profile-neutrality.test.ts` (with the delivered `harness-spawn-env.test.ts` assertions unchanged)
**Tags**: @offline, @harness, @profile, @spawn-env

**Preconditions**:

- A record map containing a name outside the allowlist (a seat-shaped model variable) with a unique value; the parent environment carrying unique undeclared canaries, including one shaped like a model variable.
- Both surfaces are asserted: the environment builder (variable-consuming double) and the opencode invocation path, where the binding must reach the argv and add no environment key at all.

**Steps**:

1. Build the child environment on the variable-consuming path and record the opencode invocation argv and environment on the honoured path.
2. Assert `Object.keys(childEnv)` equals exactly the declared allowlist set — the undeclared record name added nothing and nothing was removed.
3. Assert every undeclared canary (including the model-shaped decoy) is absent.
4. Assert the allowlist itself is unchanged (same length and same names) after the build, and that the opencode environment carries no seat-shaped key while its argv carries the binding.
5. Assert the delivered deny-by-default assertions still hold unchanged.

**Expected Outcome**:

- The record map supplies values only for already-declared names; adding profile data never widens the environment, and on the invocation surface it adds no environment entry at all (AC-F3-3, RSK-6 mitigation proven).

**Binding oracle**:

- `sorted(Object.keys(childEnv)) === sorted(declaredNames)`; undeclared record name absent; all canaries absent; allowlist length unchanged; opencode environment key set unchanged and its argv carries the binding; delivered `harness-spawn-env.test.ts` green.

#### TC-HARNESS-014 - Unrepresentable seat model and unassigned named agent refuse before any session

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-3, AC-F3-4, DM-4, NFR-1, DEC-6, DEC-13, DEC-14, RSK-1, TDR-0032
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: spawn preparation, seat resolution and refusal projection; `tests/behaviour/harness-profile-unrepresentable.test.ts` (matrix M-05, M-11)
**Tags**: @offline, @harness, @profile, @refusal

**Preconditions**:

- Two expressibility variants on the honoured surface: a required seat whose resolved model has an empty provider or model segment, and a resolved model that is not expressible as `provider/model[#variant]` (missing separator, malformed variant, whitespace/control characters, or over the adapter's declared bound).
- The `unassigned` variant: a multi-seat resolved profile that assigns no seat to a named agent, plus recording attempt-record and session-spawn seams.
- A paired representable-seat control whose resolved model is expressible, and a paired control where `agentOverrides` assigns the named agent a seat.

**Steps**:

1. Prepare each expressibility spawn and assert the refusal identity, projection class and exit per M-05, including `detail.harness` (`versionVerdict === "inside"`, `mode` = the resolved mode).
2. Assert the structured error names the offending seat (declared naming field, GAP-5 constant).
3. Assert the session-spawn seam call count is `0`, that no invocation argv was assembled, that no partial binding was handed to any seam, and that no telemetry row was written.
4. Prepare the `unassigned` spawn and assert the reused `provider.profile.invalid` per M-11: the agent, the profile and the declared seats appear in the bounded `error.summary`; the remediation hint is non-empty and names declaring `agentOverrides` for the agent or running a single-seat profile; `detail.harness` is **absent** (Amendment A-2); `HARNESS_FAILURE_CODES` is set-identical to the declared set; session starts `0`; attempt records `0`; telemetry rows `0`.
5. Assert the unrecognised case is not a pre-session refusal: an agent or model the harness does not know produces the harness's own classified spawn failure (DEC-14), so neither a `harness.profile.model-unrepresentable` nor any new refusal identity is reachable for it.
6. Run both paired controls and assert each spawns with its full single-seat binding.

**Expected Outcome**:

- A partial profile is refused rather than delivered under the wrong seat; an unassigned named agent refuses pre-session through the delivered configuration identity with no session, no attempt record and no envelope member; the identity names the seat or agent so the fix is actionable (DEC-6, DEC-13, DEC-14, AC-F3-4).

**Binding oracle**:

- Expressibility: `error.code === "harness.profile.model-unrepresentable"`; projection class `user-validation` (OQ-5 default); exit `1`; seat identifier present in the structured error; spawn calls `0`; telemetry rows `0`; `detail.harness.mode === resolvedMode`. Unassigned: `error.code === "provider.profile.invalid"`; exit `1`; `error.summary` names the agent, the profile and the declared seats within the NFR-4 bound; remediation hint non-empty; no `detail.harness` key; spawn calls `0`; attempt records `0`; rows `0`; `HARNESS_FAILURE_CODES` set unchanged. Controls spawn with the full binding; no refusal identity is raised for an agent or model the harness does not know.

**Notes / Clarifications**:

- Retargeted per readiness iteration 2 finding C2 and TDR-0032: the "or the harness does not recognise it" half is dropped (DEC-14 — no in-process catalogue source exists and `opencode debug agents` would be a forbidden second pre-session child), and the `unassigned` refusal is added. That refusal reuses the delivered `provider.profile.invalid`, adds no error-table row and no `detail.harness` member (Amendment A-2), so the closed harness vocabulary does not grow.

#### TC-HARNESS-015 - Propagation is per spawn, not process-global, and a role-less spawn binds nothing

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: Important
**Related IDs**: F-3, AC-F3-1, AC-F3-2, DM-4, DEC-13, TDR-0032
**Test Type(s)**: Behaviour, Integration
**Automation Level**: Automated
**Target Layer / Location**: spawn binding construction and composition lifetime; `tests/behaviour/harness-profile-per-spawn.test.ts`
**Tags**: @offline, @harness, @profile, @role-less

**Preconditions**:

- One resolved profile with at least two seats bound to two distinct named agents (`agentOverrides` or seat-named agents) and distinct resolved models; one shared composition instance reused for every spawn.
- A single-seat profile whose sole declared seat is assigned to one named agent, with the seat's declared name distinct from that agent identity so the two cannot be confused in argv. The same single-seat fixture is used twice — once by a spawn that names that agent, once by the role-less control — so naming is the only variable between the two runs (TDR-0032 resolution step 3).
- A recording spawn double capturing each invocation's argv, environment and recorded binding (or its absence); a current-generation fixture store holding one session per spawn so the unbound observation can be read.

**Steps**:

1. Spawn naming agent A, then spawn naming agent B on the same composition; assert each invocation carries exactly one `--agent` equal to the agent it named and exactly one `--model` equal to that agent's seat's resolved model, and that each spawn records its own single-seat binding.
2. Assert neither spawn carries the other's agent or model, then repeat in reverse order (B then A) and assert the values follow the named agent, not the order.
3. Spawn concurrently with A and B and assert neither invocation is contaminated by the other.
4. Run the named single-seat control: on the same composition, spawn naming the one agent the single-seat profile assigns; assert the invocation carries exactly one `--agent` equal to that agent identity (never the seat name, which differs) and exactly one `--model` equal to that seat's resolved model, that no second `--agent`/`--model` appears, and that the spawn records its binding (one seat, that agent, that model).
5. Run the role-less control: a spawn naming no agent against the multi-seat profile **and** against the same single-seat profile fixture; assert neither sends `--agent` or `--model`, neither records a binding, and each run's rows carry a null seat with the `unresolved-seat` reason while still reporting the observed agent and model (Amendment A-1). Steps 4 and 5 differ only in whether an agent is named, so the seat count cannot be what resolves.

**Expected Outcome**:

- Propagation is a per-spawn data contract keyed to the named agent; a previous or concurrent spawn cannot leak its binding into the next, and a role-less spawn binds nothing in every profile shape rather than borrowing a seat (F-3, DEC-13, TDR-0032 Amendment A-1). A single-seat profile is resolved by the named agent — the sole seat is claimed and sent when an agent is named — and still yields nothing when none is named, so the named/unnamed distinction, not the seat count, is what resolves.

**Binding oracle**:

- Spawn 1 argv carries exactly one pair === agent A / seat A's model; spawn 2 === agent B / seat B's model; reversed order swaps accordingly; concurrent spawns each correct; each binding holds exactly one seat; both role-less spawns carry zero `--agent`, zero `--model`, no recorded binding, and their rows `seat === null` with the declared `unresolved-seat` reason and non-null `agentRole`/`observedModel`; the named single-seat spawn carries exactly one `--agent` equal to the named agent identity and exactly one `--model` equal to the sole seat's resolved model with one recorded single-seat binding, while the role-less single-seat run carries zero `--agent`, zero `--model`, no recorded binding and `seat === null` with `unresolved-seat`.

**Notes / Clarifications**:

- Retargeted per TDR-0032 Amendment A-1: the role-less control is profile-shape-independent. A single-seat profile creates no exception — the sole seat is resolvable but not claimable, because a seat claim requires a named agent and no permitted argv value carries a seat name.
- Revision 1.4 adds the other half of TDR-0032's third resolution step, which had no dedicated oracle: the same single-seat fixture is run once with the agent named (sole seat resolved, sent as `--agent <agent identity>` / `--model`, binding recorded) and once role-less (nothing bound, `unresolved-seat`). Because only the naming differs, a resolution that keys off the seat count — always binding the sole seat, or never binding it — fails in one direction or the other.

#### TC-HARNESS-016 - Spawn, deliver and resume share one propagation contract

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-3, F-4, AC-F3-1, AC-F4-1, DM-4
**Test Type(s)**: Integration, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: opencode adapter paths (`packages/adapters/src/harness/opencode.ts`); `tests/behaviour/harness-resume-propagation.test.ts`
**Tags**: @offline, @harness, @profile, @resume

**Preconditions**:

- One resolved profile and one named agent resolving to one seat; a recording spawn double for spawn, deliver and resume; the delivered resume acquisition fixtures; a recorded-binding seam so binding cardinality is observable.

**Steps**:

1. Spawn naming the agent, then deliver and resume the resulting session with the same descriptor.
2. Assert spawn, deliver and resume each construct exactly one binding (one seat with its resolved model) and each invocation carries exactly one `--agent`/`--model` pair; assert the three bindings and the three derived invocation argument sets are canonically byte-identical (`canonicalHarnessJson`).
3. Assert the resume that supplies the original descriptor reuses the spawn's binding and seat rather than re-deriving a different one.
4. Assert a resume whose descriptor is absent rebuilds a binding equal to the original single binding, and that no resume adds a seat: the chain's binding count and seat set are unchanged.

**Expected Outcome**:

- A resumed or delivered session runs the single seat its spawn declared; the contract is one contract, not three, and a resume never introduces a second seat (F-4, TDR-0032).

**Binding oracle**:

- `canonical(bindingSpawn) === canonical(bindingDeliver) === canonical(bindingResume)`; `canonical(argvSpawn) === canonical(argvDeliver) === canonical(argvResume)`; each binding holds exactly one seat and each argv exactly one `--agent`/`--model` pair equal to the spawn's; the seat set across the chain has cardinality `1`; zero divergence.

#### TC-HARNESS-017 - Resume continues identity and preserves the tree root

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4, AC-F4-1, DM-4
**Test Type(s)**: Behaviour, Integration
**Automation Level**: Automated
**Target Layer / Location**: opencode resume path; `tests/behaviour/harness-resume-propagation.test.ts`
**Tags**: @offline, @harness, @resume

**Preconditions**:

- A spawned handle with `sessionId` S and `treeRoot` equal to the work-item ref; the committed resume stream fixture.

**Steps**:

1. Resume the handle and assert the acquired identity equals S and the tree root is unchanged.
2. Assert the profile propagation is identical to the spawn (TC-HARNESS-016).
3. Assert no second root is created: the handle reported after resume has the same `treeRoot` and the same work-item ref.
4. Assert the stream still drains to completion and collection returns completion-scoped evidence.

**Expected Outcome**:

- A resume continues the caller's session with its profile and root intact (F-4).

**Binding oracle**:

- `resumedHandle.sessionId === S`; `resumedHandle.treeRoot === workItemRef`; propagation equal to spawn; completion evidence present; exit `0`.

#### TC-HARNESS-018 - Attach resolves from a bounded listing, spawns nothing, keeps unknown-session semantics

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-4, AC-F4-1
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: session listing + resume; `tests/behaviour/harness-attach.test.ts` (matrix M-08)
**Tags**: @offline, @harness, @attach

**Preconditions**:

- A listed handle for the work item; a listing with more entries than the cap; a listing that does not contain the requested identity; a recording spawn seam and a recording kill double.

**Steps**:

1. Attach to an existing session and assert the listing was called exactly once with the declared cap, the resolved handle equals the listed identity, and the session-spawn seam call count is `0`.
2. Assert the truncated listing carries its explicit truncation mark when over cap and still resolves a contained identity.
3. Attach to an absent or different identity and assert `harness.session.unknown`, exit 1, and that kill was invoked exactly once and is idempotent on a second call.
4. Assert no orphan survives (the recorded double reports no live child) and no new root was created.

**Expected Outcome**:

- Attach is a read-only lookup plus resume, never a spawn; an unknown session keeps its delivered semantics with an idempotent kill (AC-F4-1).

**Binding oracle**:

- Listing `calls === 1` with cap constant; spawn `calls === 0`; resolved handle identity equal; over-cap listing has `{truncated: true, omitted, cap}`; unknown/different → `error.code === "harness.session.unknown"`, exit `1`, kill `calls === 1`, second kill no-op, live children `0`.

#### TC-HARNESS-019 - Row shape from the current generation: identity, session version, seat, both models, tokens, calls, cost, durations

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-1, DM-4, DM-5, DM-6, DM-9, DM-10, NFR-6
**Test Type(s)**: Contract, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: telemetry row contract and the opencode extractor; `tests/behaviour/harness-telemetry-seat-attribution.test.ts` + `harness-telemetry-shape.test.ts` (update); `tests/structure/harness-contract.test.ts`
**Tags**: @offline, @telemetry, @contract

**Preconditions**:

- The T-01 current-generation fixture (§4.1a): a `session_v2` row with `version = "2.2.5"`, an `agent` (`reviewer`), a `model` object, `cost`, the five `tokens_*` columns and `time_created`/`time_updated`, plus three usage-bearing `session_message` rows carrying per-message `agent`, `model`, `cost`, `tokens` and `time` inside `data`. Literal token, call, cost and duration values; an injected `capturedAt`.
- The run's recorded binding for that spawn: agent identity `reviewer`, seat `reviewer`, resolved model `synthetic/model-a`.
- A group-scoping variant: the same session carries a second agent/model group (`agent: coder`, `model: synthetic/model-c`, `agent-switched`) whose observed agent differs from the binding's agent.

**Steps**:

1. Extract with every session identity the run holds and assert every mandatory field against the hand-written fixture constants.
2. Assert `schemaId` equals the delivered constant exactly, `harnessKind` is `opencode`, and the row's `harnessVersion` equals the **normalized** `session_v2.version` (`2.2.5`), not a `v`-prefixed or probed value.
3. Assert the **seat and resolved model come from the run's recorded binding** (DM-4) — not from `session_v2.agent`, the per-message `agent`, or a re-derivation of the current profile — and that `agentRole` (the delivered harness-reported agent field) comes from the per-message `agent` with `session_v2.agent` as baseline and equals the fixture's observed agent; assert `observedModel` is normalized from the `model` object.
4. Assert the five token classes equal the `session_v2.tokens_*` columns, `calls` equals the count of usage-bearing message rows, `cost` equals the stored cost, and the three duration fields equal the `time_created`/`time_updated` difference.
5. Assert `records.length >= 1` for the held session and that a zero-row outcome for this fixture would fail the test (the capture-failure rule).
6. Assert tool counts are absent with the declared warning, because the current generation exposes no populated tool source.
7. Assert the contract module exposes exactly the declared field names, the token-class set is still exactly five, and the `unresolved-seat` reason is a declared constant in the closed vocabulary.
8. Land the group-scoping variant and assert the group whose observed agent equals the binding's agent keeps the binding's seat and resolved model, while the differing group's row carries `seat === null` with the `unresolved-seat` reason and the agent-divergence warning; assert `agentRole` on each row is that row's observed agent.

**Expected Outcome**:

- The ticket's "schema version and per-seat models" is a row field set sourced from the store that exists plus the run's recorded binding, not a claim: every mandatory field is present with the exact seeded value, the seat is never read from the store's agent, a differing group is disclosed rather than misattributed, and a zero-row capture is a failure (AC-F5-1, DM-4, DM-5, DM-9, DM-10).

**Binding oracle**:

- `schemaId === "delivery.harness.telemetry.v1"`; `harnessVersion === "2.2.5"`; `seat === "reviewer"` from the recorded binding (fixture literal); `resolvedModel === "synthetic/model-a"` from the binding; `agentRole === "reviewer"` from the observed agent; `observedModel === "synthetic/model-a"`; `tokens === {input: 11, output: 22, reasoning: 3, cacheRead: 4, cacheWrite: 5}`; `calls === 3`; `cost === 1.25`; `durations === {start: T0, end: T0+3000, elapsed: 3000}`; `toolCounts === []` with the declared absence warning; `records.length >= 1`; group-scoping variant: differing group `seat === null`, reason ∈ declared `unresolved-seat` constant, agent-divergence warning present, `agentRole === "coder"`.

**Notes / Clarifications**:

- Retargeted per readiness finding 1 and again per readiness iteration 2 / TDR-0032: the previous fixture asserted `session.work_item_ref`, `session.harness_version` and per-message token columns, none of which exist in any observed store, and an earlier revision sourced the seat from the store's `agent`. The seat and resolved model are not store facts — only the run's recorded binding states them (DM-4); the store states the harness-reported agent (`agentRole`) and observed model, and group scoping decides which row may claim the binding's seat.

#### TC-HARNESS-020 - Pre-change rows stay readable and unchanged; additive only

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-2, DEC-4, NG-3, NG-4
**Test Type(s)**: Contract, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: telemetry read path and golden rows; `tests/behaviour/harness-telemetry-version-compat.test.ts` (T-08, T-09)
**Tags**: @offline, @telemetry, @compat

**Preconditions**:

- A committed pre-change row fixture captured under the delivered GH-291/GH-233 shape (no seat, no durations, no resolved model), plus a paired post-change row.

**Steps**:

1. Read the legacy row through the post-change reader and assert it is returned unchanged: same schema identity, same field set, new fields absent.
2. Assert re-serialization is canonically byte-identical to the committed fixture.
3. Assert `HARNESS_TELEMETRY_SCHEMA_ID` is unchanged and no new major identity exists in the contract.
4. Assert no backfill occurred: the legacy row still has no seat and no duration, and the read did not mutate it.
5. Assert a post-change row is readable by a reader that ignores the new fields (the compatibility direction that matters for old consumers).

**Expected Outcome**:

- Zero removals or renames; pre-change rows are readable and unchanged; the new fields are additions a legacy reader can ignore (AC-F5-2, DEC-4).

**Binding oracle**:

- Legacy row canonical JSON equal to the committed golden; `schemaId === "delivery.harness.telemetry.v1"`; seat/durations/resolvedModel absent in the legacy row; no mutation (store byte count unchanged); post-change row read by the ignoring projection yields the legacy field set.

#### TC-HARNESS-021 - Model and version divergence disclosed with both values kept

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-3, DM-4, DM-5, DM-9, DEC-5, DEC-13
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: extractor model normalization, group scoping and row landing; `tests/behaviour/harness-telemetry-divergence.test.ts` (T-05, T-06, T-16)
**Tags**: @offline, @telemetry, @divergence

**Preconditions**:

- A current-generation store reporting `synthetic/model-b` in the per-message `model` object while the spawn profile resolved `synthetic/model-a`; a paired agreeing fixture; a variant-only difference pair (same `id`/`providerID`, different `variant`) normalized to one canonical identifier.
- An agent-divergence fixture: a recorded binding whose agent identity differs from the session's observed agent (`binding agent: coder`, observed `agent: reviewer`), plus its agreeing pair.
- A store whose `session_v2.version` differs from the dispatch-probed installed version.

**Steps**:

1. Land the row and assert `resolvedModel === "synthetic/model-a"` and `observedModel === "synthetic/model-b"` — both present and distinct.
2. Assert the model-divergence warning is present and its reason is a member of `HARNESS_WARNING_REASONS` (the declared constant set).
3. Assert neither model value was overwritten in either direction, and the stored row keeps both.
4. Run the paired agreeing fixture and assert no model-divergence warning appears; run the variant-only pair and assert both sides normalize to the same canonical identifier and no warning appears.
5. Land the agent-divergence fixture and assert the binding's agent and the observed `agentRole` are both kept and distinct, the agent-divergence warning is present from the closed vocabulary, neither value is overwritten, and the row's seat is `null` with `unresolved-seat` because the binding's seat may attach only to a group whose observed agent matches (DM-5); assert the agreeing pair carries no agent-divergence warning and keeps the binding's seat.
6. Land a row where the stored version differs from the probed installed version and assert the row stamps the **stored** version, the probed version is disclosed separately, and the `version-drift` warning carries both — neither overwritten.

**Expected Outcome**:

- Divergence is evidence, not noise: both the intent and the observation survive for models, for agents and for versions, and silence about it is impossible when they differ (DEC-5, DM-5, DM-9, TDR-0032).

**Binding oracle**:

- `resolvedModel !== observedModel` and both equal their seeded values; model-divergence reason ∈ `HARNESS_WARNING_REASONS`; agreement and variant-only controls carry no model-divergence reason; agent case: `bindingAgent !== observedAgent` with both kept, agent-divergence reason ∈ `HARNESS_WARNING_REASONS`, `seat === null` with the `unresolved-seat` reason, and the agreeing pair keeps the binding's seat with no agent-divergence reason; version case: row `harnessVersion === storedVersion` and the probed value appears only in the disclosure with a `version-drift` warning.

#### TC-HARNESS-022 - Durations come from store timestamps; a missing pair is explicitly absent

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-4, DM-6, NFR-6, RSK-4
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: extractor duration projection; `tests/behaviour/harness-telemetry-durations.test.ts` (T-02)
**Tags**: @offline, @telemetry, @durations

**Preconditions**:

- The current-generation fixture with the session `time_created`/`time_updated` pair present (control), a variant with `time_updated` null, a variant with the per-message timestamp pair absent, a variant whose `time_updated` precedes `time_created`, and a variant where start equals end; `capturedAt` present in every variant.

**Steps**:

1. Land the row from the complete fixture and assert `{start, end, elapsed}` equal the store pair's literals (the difference the pair expresses), not the capture time.
2. Land the row from the missing-pair variants and assert the duration fields are absent — not `0` and not a number — with the declared absence reason from the closed vocabulary.
3. Land the row where start equals end and assert `elapsed === 0` is reported as a genuine observation with no absence warning (a reported zero is never converted to absence).
4. Land the row where the pair is inverted and assert the duration is explicitly absent with a warning, never a negative number.
5. Mutate `capturedAt` by +10 minutes and assert no duration value changes (it stays absent or stays the pair's value) — proving nothing is derived from capture time.

**Expected Outcome**:

- Durations are store facts: they come from the timestamps the store holds, they are explicitly absent when the pair cannot express them, and they are never manufactured or estimated (AC-F5-4, NFR-6).

**Binding oracle**:

- Complete pair → exact literals from the pair difference; missing/inverted pair → duration fields absent (`undefined`), no numeric duration anywhere in the row, warning reason ∈ `HARNESS_WARNING_REASONS`; equal pair → `elapsed === 0` with no absence warning; `capturedAt` mutation leaves every duration unchanged.

**Notes / Clarifications**:

- Inverted from the previous revision, which asserted "the store exposes no duration" as the primary case. Store timestamps are the source of truth (DM-6); absence is the exception and only when the pair is missing or unusable.

#### TC-HARNESS-023 - Absence is classified inside the capture envelope; no identity, no zero row, read side untouched

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-1, AC-F6-2, AC-F5-5, NFR-6, DEC-9, DEC-10
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: capture envelope classification and the work-item read side; `tests/behaviour/harness-telemetry-classification.test.ts` (matrix M-06)
**Tags**: @offline, @telemetry, @absence

**Preconditions**:

- A healthy, readable store that does **not** hold the session identity the dispatch recorded (the store holds other sessions); a paired control where it does hold it; a recording state-append seam; a captured telemetry set for the work item in one variant and none in another.

**Steps**:

1. Capture telemetry for the run whose session the store does not hold, and assert the capture envelope classifies it as **absence**: zero records for that session, an absence entry/count with a closed-vocabulary reason, and **no** `failedSessions` entry (absence is not damage).
2. Assert the append seam recorded zero appends — no zero-valued row was produced — and that no rendered report shows zero token or cost figures.
3. Assert the work-item read side reports the delivered `spend.telemetry-absent` classification for a work item with no captured telemetry, with no figures, and assert that `spend.telemetry-absent` is unchanged and not reused as a harness capture identity.
4. Assert the delivery's outcome, phase, summary and exit code equal the paired control's — closeout capture is non-gating and an absent capture writes no zero-valued record.
5. Assert no identity named `harness.telemetry.absent` exists anywhere in `HARNESS_FAILURE_CODES`, the error table, or the capture vocabulary (an explicit absence-of-identity assertion).
6. Run the paired held-session control and assert ≥ 1 row lands and the run succeeds.

**Expected Outcome**:

- Absence is a classification inside the delivered envelope, never a fabricated identity, never a zero-valued row, and never a change to the delivery — and the removal of the invented identity cannot be silently reversed (AC-F6-1, DEC-10).

**Binding oracle**:

- Capture envelope: `records` for the session `0`; absence count `1` with a closed reason; `failedSessions` `0`; appends `0`; no `0` token or cost figure rendered; read side `{state: "absent", code: "spend.telemetry-absent"}`; delivery exit equals the control's; `HARNESS_FAILURE_CODES` contains no `harness.telemetry.absent`; control appends `>= 1`.

**Notes / Clarifications**:

- Retargeted per readiness finding 2 and DEC-10: the previous oracle asserted `harness.telemetry.absent` at exit 1 through a per-session telemetry request that does not exist and is not added (NG-9). The reachable surface is the capture envelope plus the delivered `spend.telemetry-absent` read side.

#### TC-HARNESS-024 - Unreadable store is extraction failure, never absence, and stays non-gating

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-6, AC-F6-2, NFR-11, DEC-9, DEC-10
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: store open/read failure classification; `tests/behaviour/harness-telemetry-extraction-failure.test.ts` (matrix M-07)
**Tags**: @offline, @telemetry, @failure-taxonomy

**Preconditions**:

- Five damaged variants: nonexistent path; permission-denied; not-a-database content; torn/invalid schema; an unrecognised generation (a store whose session tables are neither observed family). A paired healthy store and a paired absence case.

**Steps**:

1. Capture telemetry for each damaged store and assert the delivered identity `harness.telemetry.extraction-failed` is raised, never a silent zero-row success.
2. Assert no variant is classified as the absence case (the taxonomy boundary is explicit, asserted per variant) and that the capture envelope carries the failure reason and count.
3. Assert no row was written and no partial report rendered, and that the delivery's outcome and exit code equal the paired control's (closeout capture is non-gating).
4. Assert the unrecognised-generation variant is classified as extraction failure, not as absence and not as a degraded capture with zero rows (NFR-11).
5. Assert the delivered damaged-store assertions of `harness-telemetry-opencode` and `harness-telemetry-shape` still hold, and that the identity is still a member of the delivered nine codes (both suites are owned updates in their store-shape fixtures only — §7 — so this asserts the delivered damaged-store behaviour, not that those suites stay unchanged).
6. Run the healthy control and assert success with ≥ 1 row.

**Expected Outcome**:

- Damage stays damage; an unrecognised generation is a classified outcome; absence is never used as a catch-all, so an operator fixes the right thing (AC-F6-2, NFR-11).

**Binding oracle**:

- `error.code === "harness.telemetry.extraction-failed"` for all five variants; `projectionClass === "platform-provider"` where surfaced as a command failure; capture envelope carries the failure reason and count; never the absence classification; appends `0`; delivery exit equals the control's; healthy control exits `0` with ≥ 1 row; identity present in the delivered nine.

#### TC-HARNESS-025 - Bounded read discipline: query-only pragma, indexed queries, exact caps, truncation marks

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-3, NFR-5, AC-F5-5, RSK-4, RSK-10, NG-5
**Test Type(s)**: Behaviour, Contract
**Automation Level**: Automated
**Target Layer / Location**: opencode store loader (`packages/adapters/src/harness/sqlite-loader.ts`, `telemetry-opencode.ts`); `tests/behaviour/harness-telemetry-bounds.test.ts` (T-10, T-11)
**Tags**: @offline, @telemetry, @bounds, @readonly

**Preconditions**:

- A recording store double capturing every statement in order; current-generation fixtures exceeding each cap (65 sessions, 17 agents, 17 models, 25 tool rows), an at-cap fixture, and a store with no populated tool source.

**Steps**:

1. Read a store and assert the first recorded statement enables the query-only pragma before any `SELECT`, that the connection is opened read-only, and that no write statement was recorded.
2. Assert every `SELECT` is bounded and scoped: a session-identity predicate is present, per-message reads are additionally scoped by message type, no statement selects `content` or any content-bearing JSON key, and no statement performs an unbounded `message`/`part`/`session_message` scan.
3. Assert the per-message metadata read is permitted only in that scoped form — a bounded read of `session_message` filtered by session id and a type allowlist is accepted, while an unfiltered read of the same table fails the assertion.
4. For each cap, assert the truncation mark is `{truncated: true, omitted: n, cap: N}` with N equal to 64 / 16 / 16 / 24 and `n` the hand count; assert no tool-cap mark is produced on the store with no populated tool source.
5. Assert an at-cap store produces no truncation mark (paired control), and that the configured store path is reconciled with the harness-declared data directory rather than defaulted to the state directory (structural assertion over the resolved path, no live read).

**Expected Outcome**:

- The read budget holds while permitting the observed contract's per-message metadata reads: bounded, scoped, read-only, content-free, with explicit truncation marks (NFR-3, NFR-5, NG-5).

**Binding oracle**:

- `statements[0]` is the query-only pragma; every `SELECT` carries a session predicate, per-message statements also carry a type predicate; zero unbounded scans; zero content selections; truncation objects exactly `{truncated: true, omitted: 1, cap: 64|16|16|24}` for the over-cap fixtures; at-cap fixtures have no mark; write statements `0`; resolved store path is the data-directory path (or the documented override), never the state directory.

**Notes / Clarifications**:

- Retargeted per the observed contract: the previous oracle said "no `message`/`part` scan" in a way that forbade the per-message metadata reads the current generation requires. What is forbidden is the *unbounded* read, not the scoped one.

#### TC-HARNESS-026 - One totals basis: seat attribution does not double count, and a reported zero is not absence

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-1, RSK-7, NFR-6, DM-6
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: totals fold over step rows and the session baseline; `tests/behaviour/harness-telemetry-seat-totals.test.ts` (T-13)
**Tags**: @offline, @telemetry, @totals

**Preconditions**:

- A current-generation fixture with per-step rows for two seats and one session baseline, all hand-summed, where the baseline equals the seat sums; a second fixture with a session whose stored `cost` is `0` and whose token columns are non-zero (a free model, observed 2 918 times in the reference store).

**Steps**:

1. Fold totals and assert each token class total equals the baseline value exactly — not the baseline plus the step sum.
2. Assert the seat breakdown sums equal the total per class.
3. Assert adding a seat dimension does not change the delivered totals reading basis (the delivered fold's basis is asserted unchanged).
4. Assert the zero-cost-with-tokens session reports `cost === 0` with non-zero tokens, is **not** classified absent, and produces no `cost-missing` warning.
5. Assert a fixture where the baseline is deliberately wrong still reports one basis (the baseline), with divergence disclosed rather than two conflicting totals.

**Expected Outcome**:

- Seat attribution is a dimension, not a second count: totals remain single-based and breakdowns reconcile to them, and a reported zero cost is data rather than absence (RSK-7, NFR-6).

**Binding oracle**:

- `total.input === baseline.input`; `sum(perSeat.input) === total.input`; no doubled figure; one basis named; zero-cost row `cost === 0`, `tokens.input > 0`, no `cost-missing` warning, not classified absent; delivered totals assertions unchanged.

#### TC-HARNESS-027 - Privacy: identity, counts, cost and durations only

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-5, NFR-9, §20
**Test Type(s)**: Behaviour, Checks
**Automation Level**: Automated
**Target Layer / Location**: rows, warnings and refusal envelopes; `tests/behaviour/harness-telemetry-privacy.test.ts` + `tests/checks/fixture-privacy.test.ts` + `tests/checks/privacy-literals.test.ts` (update if literals extend)
**Tags**: @offline, @privacy

**Preconditions**:

- A store seeded with unique canaries in message bodies, part text, diffs, tool output, credential-looking values, and a profile carrying a canary config value.

**Steps**:

1. Land rows and assert no canary appears in any row, warning, or serialized output.
2. Produce each refusal variant and assert no canary appears in any envelope.
3. Assert the delivered redaction chokepoint composes unchanged on the new disclosure paths.
4. Assert every new fixture passes the fixture-privacy scan.

**Expected Outcome**:

- Telemetry and refusals carry identity references, counts, cost and durations only (NFR-5, §20).

**Binding oracle**:

- Zero canary occurrences across rows, warnings and envelopes; redaction suite green; fixture-privacy scan green.

#### TC-HARNESS-028 - Store-generation tolerance: current and legacy fixtures degrade honestly, both directions

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, AC-F5-1, AC-F5-4, AC-F5-5, NFR-11, RSK-4, RSK-9, OQ-3, GAP-6
**Test Type(s)**: Behaviour, Contract (mutation pair)
**Automation Level**: Automated
**Target Layer / Location**: extractor generation detection and field-set tolerance; `tests/behaviour/harness-telemetry-generation.test.ts` (T-14)
**Tags**: @offline, @telemetry, @degradation, @generation

**Preconditions**:

- The two committed generation builders (§4.1a): a complete `session_v2`/`session_message` fixture and a complete legacy `session`/`message`/`part` fixture whose `part` table has no `tool` column.
- A legacy variant with an optional column removed (a missing token class, a null timestamp pair); a current variant with `version` null; a paired complete control per generation; temp-copy mutant extractors (legacy-only and current-only).

**Steps**:

1. Land rows from the current-generation fixture and assert every mandatory field is populated as in TC-HARNESS-019; assert tool counts are absent with a warning.
2. Land rows from the legacy-generation fixture and assert rows exist with the same field set read from the legacy tables; assert tool counts are absent with a warning because the legacy `part` table exposes no `tool` column — and assert no statement references `part.tool`.
3. Land the degrading variants and assert the absent optional field is `null` with a warning, that the duration is explicitly absent with a warning when the pair is missing, and that the session is **not** classified as failed while its mandatory set (identity + at least one usage fact) is present.
4. Assert no zero-filled value appears anywhere in either generation.
5. Run the two-sided mutation pair: a legacy-only extractor must land zero rows on the current fixture (and therefore classify a capture failure), and a current-only extractor must land zero rows on the legacy fixture; if either mutant passes its opposite fixture unchanged, the meta-check fails.
6. Assert an unrecognised generation is classified as extraction failure (TC-HARNESS-024) and never as a silent zero-row pass.

**Expected Outcome**:

- Both observed generations survive with honest degradation, only a session without the mandatory set is failed, and a generation-blind extractor cannot pass — the assertion is two-sided by construction (OQ-3 pinned set, NFR-11, RSK-9).

**Binding oracle**:

- Current fixture: `records.length >= expectedSessions`, all mandatory fields, `toolCounts === []` + warning; legacy fixture: same, with no `part.tool` reference and no `tool` column in any statement; degrading variants: absent field `null` + warning ∈ `HARNESS_WARNING_REASONS`, durations absent + warning, `failedSessions === []`; legacy-only mutant on current fixture: `records.length === 0` and a capture failure; current-only mutant on legacy fixture: `records.length === 0` and a capture failure.

**Notes / Clarifications**:

- Replaces the previous "2.1.x-shape" variant (GAP-6, T-14): the 2.1.x generation is unobserved, while both observed generations are recorded in DM-10. The window's 2.1.x line remains covered by the version gate (TC-HARNESS-004), not by an invented store shape.

#### TC-HARNESS-029 - Byte-identical determinism and zero network or model calls

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-7, NFR-9, §21
**Test Type(s)**: Behaviour, Checks
**Automation Level**: Automated
**Target Layer / Location**: window evaluation, mode resolution, propagation construction, extraction and refusal render; `tests/checks/harness-determinism.test.ts` (update)
**Tags**: @offline, @determinism

**Preconditions**:

- One fixture set: probe result, store, resolved profile, injected clock and ids; a recording network/model-call seam.

**Steps**:

1. Run each evaluation, refusal and extraction path twice with identical injected inputs and assert canonical output is byte-identical.
2. Shuffle store row order and assert identical canonical output.
3. Assert zero recorded network opens and zero model calls on every path.
4. Assert no ambient clock, environment or randomness read: a changed ambient environment changes nothing.
5. Assert brand-neutral naming: no hardcoded product or binary name in new contracts or surfaces.

**Expected Outcome**:

- Identical injected facts produce identical bytes with no network, no model calls and no ambient reads (NFR-7).

**Binding oracle**:

- `canonical(run1) === canonical(run2)` per path; shuffled order identical; sockets `0`; model calls `0`; ambient mutation yields identical output; literals scan green.

#### TC-HARNESS-030 - Bounded output with marked truncation; refusal identity and hint never truncated

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-4
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: human and machine render of refusals and telemetry disclosures; `tests/behaviour/harness-output-bounds.test.ts` (update)
**Tags**: @offline, @bounds

**Preconditions**:

- Generated over-cap fixtures (many seats/models), at-cap and under-cap controls; refusal variants with long observed values.

**Steps**:

1. Measure serialized UTF-8 bytes and rendered lines; assert machine ≤ 65 536 and human ≤ 4 096 bytes and ≤ 24 lines.
2. Assert truncation is deterministic, tail-ordered, and marked with a recorded truncation warning.
3. Assert the refusal identity, the observed/requested value, the supported/available alternative and the remediation hint are present and intact on every over-cap refusal render.
4. Assert the under-cap control renders untruncated and its measured length is asserted first (non-vacuity).

**Expected Outcome**:

- Output stays bounded while the actionable part of a refusal survives every truncation (NFR-4).

**Binding oracle**:

- Machine ≤ `65536` bytes; human ≤ `4096` bytes and ≤ `24` lines; `error.code` and `error.remediationHint` present on every over-cap render; under-cap fixture has no truncation mark; measured length `> 0` asserted before the bound.

#### TC-HARNESS-031 - Delivered six-id classification floor unchanged and passing

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-7, AC-F7-1, DM-7
**Test Type(s)**: Conformance, Contract
**Automation Level**: Automated
**Target Layer / Location**: conformance registry; `tests/conformance/harness-classification.test.ts` (assertions unchanged) + `tests/structure/conformance-coverage.test.ts` (update)
**Tags**: @offline, @conformance

**Preconditions**:

- The delivered registry and the committed classification scenario fixtures.

**Steps**:

1. Assert `HARNESS_CONFORMANCE_FLOOR_SCENARIOS` is exactly the six delivered ids in the delivered order.
2. Assert exactly the two kinds are registered, each exactly once, each declaring all six floor scenarios.
3. Assert the floor constant's value is not widened by the extension: the extension ids appear in `HARNESS_CONFORMANCE_EXTENSION_SCENARIOS` and never in the floor constant, and a length/exact-value pin on the floor still passes (matrix C-09).
4. Run the delivered classification suite and assert identical classification on both adapters with the assertions unchanged.
5. Assert `harnessConformanceViolations(HARNESS_CONFORMANCE_REGISTRY)` is `[]`.

**Expected Outcome**:

- The floor is untouched: same ids, same order, same two registrations, same passing classification, and the extension cannot widen it (AC-F7-1).

**Binding oracle**:

- Floor ids exactly `["completed","tool-failure","premature-end","harness-failure","spawn-refusal","timeout"]`; violations `[]`; classification suite green unchanged; floor value identical to the delivered constant before and after the extension is added.

#### TC-HARNESS-032 - Missing extension scenario or unexercised identity fails and names both

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-7, AC-F7-2, DM-7, RSK-5
**Test Type(s)**: Conformance, Contract
**Automation Level**: Automated
**Target Layer / Location**: registry violation function; `tests/structure/conformance-coverage.test.ts` (update) + `tests/conformance/harness-extension-scenarios.test.ts` (matrix C-03, C-04)
**Tags**: @offline, @conformance, @negative

**Preconditions**:

- The delivered registry; a fixture builder producing a mutated registry with one extension scenario removed from one registration; a fixture with a new refusal identity outside the declared identity→scenario map.

**Steps**:

1. Assert the unmutated registry yields no violation (planted positive first).
2. Remove `version-window` from the opencode registration and assert a violation string naming both `opencode` and `version-window`.
3. Add a fifth refusal identity beyond the declared map and assert a violation naming that identity.
4. Assert the suite fails on each mutation (the violation array is non-empty and the failing assertion names the pair).

**Expected Outcome**:

- A missing extension scenario or an unregistered identity cannot ship: the failure message is the diagnosis, naming both sides (AC-F7-2).

**Binding oracle**:

- Baseline `violations.length === 0`; mutated → `violations` contains a string matching `opencode` and `version-window`; identity case → a string containing the identity; both cases fail the suite.

#### TC-HARNESS-033 - Extension scenarios execute through the additive executor and prove their property

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-7, AC-F7-2, AC-F7-3, DM-7, DEC-8
**Test Type(s)**: Conformance
**Automation Level**: Automated
**Target Layer / Location**: the additive executor in `packages/testkit/src/conformance/harness.ts`; `tests/conformance/harness-extension-scenarios.test.ts` (matrix C-05, C-06, C-09, C-10)
**Tags**: @offline, @conformance

**Preconditions**:

- The four extension ids registered per harness; simulated harness I/O fixtures (probe output strings, recorded invocation arguments, store rows) with no process and no store; the delivered `build(io, deps)` registry entry point.

**Steps**:

1. For each extension id, execute it through the additive executor (`{ registration, scenarioId, io, deps }` → declared outcome) and assert its declared expectation: `version-window` asserts both directions (`opencode v2.2.5` proceeds, `opencode v2.3.0` refuses with `harness.version.unsupported`); `version-unknown` asserts `harness.version.unknown` with a `null` observation; `mode-unavailable` asserts the identity with the requested mode; `profile-propagation` asserts the per-seat binding reaches the honoured invocation surface **and** that an unrepresentable seat refuses with `harness.profile.model-unrepresentable`, zero session starts.
2. Assert each refusal direction records zero session starts.
3. Assert the scenarios resolve through the same registry module and builder as the floor (no forked path): the executor is imported from the testkit, the registration is a member of `HARNESS_CONFORMANCE_REGISTRY`, and no test-local scenario implementation exists (matrix C-10).
4. Assert the union discipline: the scenario id type is the union of the floor type and the extension type; adding an extension id leaves a floor exact-value pin green and fails an extension exact-value pin (matrix C-09).
5. Assert each extension scenario can fail: flip its fixture's expected outcome and assert the executor reports a mismatch (matrix C-08 half).

**Expected Outcome**:

- The extension scenarios are real, executable checks of the new properties rather than declaration-only ids, they run on the same registry surface as the floor, and the six-id floor is never widened by them (AC-F7-2, AC-F7-3).

**Binding oracle**:

- Four extension ids present per registration; each produces its declared verdict/identity/binding; refusal directions session starts `0`; fixture flip produces a mismatch; executor imported from the testkit and the registration present in `HARNESS_CONFORMANCE_REGISTRY`; floor pin green while the extension pin tracks the extension constant.

**Notes / Clarifications**:

- Retargeted per readiness finding 13 and DEC-8: the previous wording ("executed through the registry") had no executable surface, and the propagation half asserted a variable family the harness does not consume. The executor, its location and the union split are now declared in §4.6 (C-06, C-09, C-10); the propagation scenario asserts the invocation binding.
- Scenario count: DM-7 and AC-F7-2 name four properties, while F-7 enumerates "inside and outside the window" separately. This plan applies the four-id default with `version-window` asserting both directions, and records the reading as OQ-12.

#### TC-HARNESS-034 - Conformance runs offline with zero live harness invocations

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F7-3, NFR-10
**Test Type(s)**: Conformance, Checks
**Automation Level**: Automated
**Target Layer / Location**: conformance suite execution; `tests/checks/harness-hermetic.test.ts` (new) + `tests/checks/harness-ci-parity.test.ts` (assertions unchanged)
**Tags**: @offline, @hermetic, @conformance

**Preconditions**:

- A network and child-process probe harness (the delivered hermeticity pattern); the conformance suite invoked under it.

**Steps**:

1. Run `bun test tests/conformance` under the probe and assert zero sockets opened.
2. Assert no live harness binary was executed: the command seam was the injected double, and no real spawn of the configured harness command was recorded.
3. Assert no harness store was opened and no credential resolved.
4. Assert the CI wiring that runs the conformance suite is unchanged.

**Expected Outcome**:

- Conformance is CI-safe and offline: simulated I/O only, zero live invocations (AC-F7-3, NFR-10).

**Binding oracle**:

- Sockets `0`; live harness spawns `0`; store opens `0`; credentials resolved `0`; `harness-ci-parity` green unchanged.

#### TC-HARNESS-035 - Refusal identity contract: one row per identity, stable code, derived exit, hint present

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-N1-1, RSK-5, §8.5, §21
**Test Type(s)**: Contract, Structure
**Automation Level**: Automated
**Target Layer / Location**: error table, harness failure vocabulary, projection; `tests/structure/error-table.test.ts` + `tests/structure/harness-contract.test.ts` (update) + `tests/checks/error-table-sync.test.ts` (update)
**Tags**: @offline, @contract, @refusal

**Preconditions**:

- The four new identities; the nine delivered `HARNESS_FAILURE_CODES`; the closed `CommandResultDetail` member set and its pins (type pin, runtime validator, key-set fixture).

**Steps**:

1. Assert each of the four new identities appears exactly once in the error table with `domainKind: "harness"`, a category, `retryable`, `consequence`, a non-empty `remediationHint`, and a `projectionClass`.
2. Assert `HARNESS_FAILURE_CODES` grew by exactly those four codes and still contains all nine delivered codes unchanged.
3. Assert the projection class → exit mapping resolves each new identity through `projectExitCode` (no exit literals outside the projection module).
4. Assert documented and machine tables agree bidirectionally and no delivered row changed meaning.
5. Assert **no** telemetry-absence identity exists: `harness.telemetry.absent` is absent from `HARNESS_FAILURE_CODES`, from the error table and from every vocabulary constant, while `harness.telemetry.extraction-failed` keeps its delivered meaning.
6. Assert the closed-member pins moved two-sidedly: `keyof CommandResultDetail` is exactly `holder | suiteBreadth | harness`; the runtime conformance validator admits the declared members; the key-set fixture and the documented member sentence agree; the six-field `CommandResultError` assertions and every existing `@ts-expect-error` cell are retained (TDR-0031 C-6).

**Expected Outcome**:

- Every refusal is a classified outcome with a stable contract; vocabulary growth is additive, cannot silently fork a delivered meaning, and the invented telemetry-absence identity stays removed (RSK-5, DEC-10, TDR-0031).

**Binding oracle**:

- Per identity: exactly one row; hint length `> 0`; `projectExitCode(row.projectionClass)` equals the matrix exit; `HARNESS_FAILURE_CODES` set-diff equals exactly the four new codes; delivered nine present and unchanged; `harness.telemetry.absent` absent everywhere; `keyof CommandResultDetail` exactly three members; validator and fixture agree in both directions; sync test green.

#### TC-HARNESS-036 - Refusals leave no session-bearing side effect

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-N1-1, NFR-1, NFR-2, §5.1, §17, DEC-13, TDR-0032
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: refusal paths at harness resolution, seat resolution and spawn preparation; `tests/behaviour/harness-refusal-side-effects.test.ts` (new; matrix M-01..M-05, M-11, P-01..P-04)
**Tags**: @offline, @harness, @refusal, @side-effects

**Preconditions**:

- One fixture per refusal identity, including the M-11 `unassigned` refusal (a named agent a multi-seat profile assigns no seat); recording seams for the probe child process, the streaming session start, the one-shot runner, the telemetry append, the attempt record and the store writer; a fake process table.

**Steps**:

1. For each refusal identity (M-01..M-05 and M-11), assert **no session-bearing child** exists: the session-spawn seam and one-shot-runner session calls are `0`.
2. Assert the probe child-process seam was invoked at most once (`calls <= 1`), and that if invoked it completed and was reaped before the verdict was published (fake process table empty — no orphan).
3. Assert telemetry appends `0` and store writes `0`.
4. Assert the M-11 `unassigned` refusal additionally appends no attempt record (`0`) and carries no `detail.harness` member — its agent/profile/seat facts ride the bounded `error.summary` (Amendment A-2).
5. Assert precedence P-01..P-04: exactly one identity, evaluated in order version → mode → profile; for P-04 assert `mode` is omitted from `detail.harness`.
6. Assert a paired in-window, available-mode, representable control spawns exactly one session (non-vacuity).

**Expected Outcome**:

- A refusal is inert in the session sense: it starts no session-bearing child, leaks no process, writes nothing, appends no attempt record where the identity is the pre-session configuration refusal, and reports exactly one identity — while the single bounded probe the spec mandates is allowed, completed and reaped (AC-N1-1, NFR-1, NFR-2).

**Binding oracle**:

- Per refusal: session starts `0`; runner session calls `0`; probe calls `<= 1`; live children `0` (probe reaped); appends `0`; store writes `0`; exactly one `error.code`; P-04 has no `mode` key; M-11 has attempt records `0` and no `detail.harness` key; control session starts `1`.

**Notes / Clarifications**:

- The spec (v1.2) states "no session-bearing child process; the single bounded probe is the declared exception — at most one per dispatch, completed and reaped before the verdict", so this TC asserts the spec's own wording instead of a local reading. The assertion is "no session-bearing child", never "zero children".

#### TC-HARNESS-037 - Gate composition does not disturb the delivered stream, handle or bounds behaviour

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: NFR-8, AC-F1-1, §10
**Test Type(s)**: Integration, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: streaming spawn composition with version, mode and propagation composed; `tests/behaviour/harness-stream-hygiene.test.ts`, `harness-opencode-stream.test.ts`, `harness-output-bounds.test.ts` (assertions unchanged) + `tests/behaviour/dispatch-harness-verdict-mode.test.ts`
**Tags**: @offline, @harness, @stream, @noninterference

**Preconditions**:

- The committed stream fixtures (clean stop, tool error, stream error, tokens); a synthetic long stream; the delivered stream assertions.

**Steps**:

1. Replay each committed capture through the composed path and assert handle acquisition on the first identified line, full drain, and identical completion evidence versus the delivered behavior.
2. Assert the output byte bound and truncation marker behavior are unchanged.
3. Assert no added per-frame blocking work: the synthetic long stream completes with the same recorded frame order and no new await boundary changes ordering.
4. Assert every invocation lands its delivered command-audit record, and an injected audit-write failure changes no outcome (§10).

**Expected Outcome**:

- The new gate work is resolution-time only; the stream, handle and bounds contracts are untouched (NFR-8).

**Binding oracle**:

- Evidence canonical JSON equal to the delivered golden per capture; acquired-on-first-line flag true; truncation marker semantics equal; frame order equal; audit records `1` per invocation; audit failure leaves exit and outcome unchanged.

#### TC-HARNESS-038 - Mutant meta-suite over every new honesty rule

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F1-2, AC-F1-3, AC-F1-4, AC-F1-5, AC-F2-1, AC-F3-2, AC-F3-3, AC-F3-4, AC-F5-1, AC-F5-3, AC-F5-4, AC-F6-1, AC-F6-2, AC-F7-2, NFR-6, NFR-11
**Test Type(s)**: Contract (mutation)
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/harness-mutants.test.ts` (extend the delivered temp-copy pattern)
**Tags**: @offline, @mutation

**Preconditions**:

- The fixtures of TC-HARNESS-002/003/005/006/007/011/012/013/014/019/021/022/023/024/028/042; temp mutant copies of the production modules.

**Steps**:

1. For each mutant below, run the paired fixture suite against the mutant copy and assert it produces the prohibited observable while the fixture is unchanged:
   - **accept-outside-window**: treat an out-of-window version as inside → M-01 becomes a success (violates AC-F1-2).
   - **probe-substring-match**: accept a bare `2.2.5` or any string containing a supported version → V-09/V-14 become inside (violates AC-F1-5, DEC-11).
   - **stamp-raw-probe-line**: store the raw stdout (with product token and `v`) as the observed version → TC-HARNESS-019/042 fail on the `v`-prefixed stamp (violates AC-F5-1, DM-9).
   - **ignore-probe-deadline**: call the probe without `deadlineMs` or treat `timed-out` as `answered` → TC-HARNESS-006 fails on the argument and the verdict (violates NFR-2).
   - **fabricate-version-on-failure**: substitute a default version string when the probe fails → `observedVersion` non-null (violates AC-F1-3, NFR-6).
   - **collapse-unknown-into-unsupported**: report the unknown case as unsupported → wrong code (violates DEC-3, AC-F1-3).
   - **config-window-widens**: honour an invented window key and let it change acceptance → `opencode v2.3.0` accepted (violates AC-F1-4).
   - **fallback-to-default-mode**: spawn under the default mode when another mode was requested → M-03 becomes a success (violates AC-F2-1, AC-F2-3).
   - **ambient-wins-over-record**: let the parent value beat the record value → wrong built value (violates AC-F3-2).
   - **forward-undeclared-record**: add an undeclared record name to the environment → extra key (violates AC-F3-3).
   - **per-seat-env-family**: emit `OC_*` variables instead of the invocation arguments on opencode → the environment key set widens and the argv carries no binding (violates AC-F3-1, NFR-9, NG-10).
   - **partial-profile**: drop the unrepresentable seat and spawn → M-05 becomes a success (violates AC-F3-4).
   - **overwrite-observed-with-resolved**: replace the observed model with the resolved one → divergence erased (violates AC-F5-3).
   - **zero-cost-as-absence**: map a reported `0` cost to `null` (or add `cost-missing`) → T-03/T-13 fail (violates NFR-6).
   - **missing-cost-as-zero**: substitute `0` for a store with no cost source → T-03 fails the other direction (violates NFR-6).
   - **derive-duration-from-capture**: compute elapsed from `capturedAt` → a number appears where absence was required (violates AC-F5-4).
   - **work-item-column-query**: query a `work_item_ref`/`harness_version` column → extraction failure on both observed fixtures (violates AC-F5-5, DM-8).
   - **part-tool-query**: query `part.tool` or `session_part` for tool counts → extraction failure on the observed stores (violates DM-10, NFR-11).
   - **legacy-only-extractor**: read only the legacy `session`/`message` tables → zero rows on the current-generation fixture, i.e. a capture failure that the suite must catch (violates AC-F5-1, NFR-11).
   - **current-only-extractor**: read only `session_v2`/`session_message` → zero rows on the legacy fixture (violates NFR-11).
   - **zero-row-as-pass**: return success with zero records for a held session → prohibited output (violates AC-F5-1).
   - **absence-as-capture-failure**: classify a session the store does not hold as a failed session → wrong classification (violates AC-F6-2, DEC-9).
   - **capture-failure-as-absence**: classify an unreadable store as absence → wrong classification (violates AC-F6-2, DEC-9).
   - **ignore-missing-scenario**: let a registration miss an extension scenario without a violation → registry passes (violates AC-F7-2).
2. Assert each real module produces none of the prohibited observables on the same fixtures; if a mutant changes nothing, the meta-check fails.

**Expected Outcome**:

- Every new honesty rule has a disabling mutant that fails the suite — including the grammar, the deadline seam, the reported-zero rule, the observed store contract and both store generations — so the rules are load-bearing, not decorative.

**Binding oracle**:

- Per mutant: prohibited observable present under the mutant and absent under the real module; a mutant that fails to change behavior fails TC-HARNESS-038 by name.

**Notes / Clarifications**:

- Retargeted: the previous pair (`absence-as-empty-success`, `absence-for-damage`) asserted the removed `harness.telemetry.absent` identity. They are replaced by the two-way classification mutants above. New mutants cover the probe grammar, the deadline seam, the reported-zero rule, the forbidden columns and both generations.

#### TC-HARNESS-039 - Whole-change offline hermetic posture

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: NFR-10, §6
**Test Type(s)**: Behaviour, Checks
**Automation Level**: Automated
**Target Layer / Location**: the full new suite set; `tests/checks/harness-hermetic.test.ts` (new)
**Tags**: @offline, @hermetic

**Preconditions**:

- The new suites; a network/credential/environment probe harness; the fixture-privacy scan.

**Steps**:

1. Run every new suite under the probe and assert zero sockets, zero real harness invocations, zero real store opens, zero `$HOME` reads and zero credential resolutions.
2. Assert every store is a per-test temp root and every stream fixture is committed.
3. Assert no test installs a process-global child-process mock (the delivered read-only guard).
4. Assert every new fixture passes the fixture-privacy scan.

**Expected Outcome**:

- 100% of new tests are offline and hermetic; nothing reaches a real harness, credential or network (NFR-10).

**Binding oracle**:

- Sockets `0`; live harness `0`; real stores `0`; `$HOME` reads `0`; global process mocks `0`; fixture-privacy green.

#### TC-HARNESS-040 - Dispatch outcome and refusal disclose the version verdict, the selected mode, and the `detail.harness` member

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Important
**Related IDs**: AC-F1-1, AC-F1-3, AC-F2-1, AC-F2-3, AC-F3-4, DM-2, DM-3, §10, TDR-0031
**Test Type(s)**: Behaviour, Integration
**Automation Level**: Automated
**Target Layer / Location**: dispatch outcome composition and the CLI edge's `explicitDetail` projection; `tests/behaviour/dispatch-harness-verdict-mode.test.ts` (new)
**Tags**: @offline, @dispatch, @observability

**Preconditions**:

- Five dispatches: one in-window with the default mode; one out-of-window refusal; one indeterminate-version refusal; one unavailable-mode refusal; one unrepresentable-seat refusal. Plus one control failure that is none of the four (`queue.single-flight`).
- A recording attempt-record seam so the presence or absence of the attempt record is asserted per path.

**Steps**:

1. On the successful dispatch, assert the recorded outcome and the appended **attempt record** both carry the normalized observed version, the inside verdict and the selected mode with its origin, and that exactly one attempt record was appended.
2. Assert each of the four pre-session refusals appended **zero** attempt records: no recorded outcome exists on that path, so the disclosure rides the failure envelope only.
3. Assert each of the four refusals carries `detail.harness` with exactly the mapped member set per matrix M-01/M-02/M-03/M-05: `kind`; `observedVersion` non-null except on the unknown-version refusal where it is `null`; `versionVerdict` `outside`/`indeterminate`/`inside`/`inside`; and `mode` present only on the mode and profile refusals (`mode` = requested / resolved respectively) and **absent** (not `null`) on the two version refusals.
4. Assert the control failure and `harness.session.unknown` carry no `harness` member, while the delivered `holder` member still projects where it did.
5. Assert a scripted-mode refusal line is exactly `{error, runId}` and contains no `harness` token; assert an interactive/`--verbose` envelope carries the member.
6. Assert the two recorded facts differ in version and verdict (non-vacuity: the fields are not constants), and that an absent-mode run records the default mode with its `defaults` origin.

**Expected Outcome**:

- A later reader can tell which harness line, verdict and mode produced — or refused — a delivery: on the success path the disclosure rides the attempt record and the dispatch envelope, and on the pre-session refusal path, where no attempt record exists, the same facts ride the failure envelope's declared `detail.harness` member (§10, TDR-0031).

**Binding oracle**:

- Success: attempt records `1`; `recorded.observedVersion === "2.2.5"`, `recorded.versionVerdict === INSIDE`, `recorded.mode === DEFAULT_HARNESS_MODE`, `origin === "defaults"` on both the record and the envelope; each pre-session refusal: attempt records `0`; M-01 `detail.harness === {kind, observedVersion: "2.3.0", versionVerdict: "outside"}` with no `mode` key; M-02 `{kind, observedVersion: null, versionVerdict: "indeterminate"}`; M-03 `mode === requestedMode`; M-05 `mode === resolvedMode`; control and `harness.session.unknown` carry no member; scripted line exactly `{error, runId}`; `error` keys exactly the six.

**Notes / Clarifications**:

- Extended per TDR-0031 and readiness finding 6: the previous oracle asserted only the recorded facts, while the plan put the refusal disclosure on a closed `detail` slot with no declared member. The identity→member mapping is now asserted per identity, including the identities that must **not** carry it.

#### TC-HARNESS-041 - Documentation reconciliation for window, mode, propagation, seat telemetry and decision links

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Important
**Related IDs**: AC-F2-2, G-8, §8.5, §18, §22, DEC-8, DEC-9, DEC-10, TDR-0031
**Test Type(s)**: Manual, Contract
**Automation Level**: Semi-automated (structural checks + manual content review)
**Target Layer / Location**: `doc/spec/features/{feature-harness-adapters,feature-telemetry-v2,feature-state-layer,feature-spend,feature-result-contract,feature-dispatch-engine,feature-config-layer,feature-adapter-ports}.md`, `doc/spec/nonfunctional.md`, `doc/decisions/00-index.md`, `doc/planning/oss-tooling/` markers; `tests/checks/doc-conformance.test.ts`, `tests/structure/content-inventory.test.ts`
**Tags**: @docs, @conformance

**Preconditions**:

- The delivered change and its decision records; the documentation handbook conventions.

**Steps**:

1. Assert the harness feature spec states the pinned window and its two refusals with the probe grammar and normalization, the mode declaration with its observed surface mapping, the surface-mapped propagation contract (DEC-8), and the seat/duration telemetry fields as current truth.
2. Assert the telemetry, state-layer, spend, result-contract, dispatch-engine, config-layer and adapter-ports pages state the observed store contract, the three-way classification, the non-gating closeout, the four new identities, the `detail.harness` member with its absence rules, and the unchanged `spend.telemetry-absent` meaning.
3. Assert the decision index lists all three records (mode, adapters contract, TDR-0031), and that the harness feature spec **links** the mode record and the change spec/plan reference it — the link half of AC-F2-2 that TC-HARNESS-010 deliberately does not own.
4. Assert the non-functional harness rows state the restated bounds and determinism invariants, including the unchanged read budget and store-generation tolerance.
5. Assert the planning status markers for M3-S1 are updated.
6. Run the documentation conformance checks and record the manual traceability review in §10.

**Expected Outcome**:

- Documentation matches the delivered behavior — including the propagation surface, the store contract and the disclosure member — so the next change reads current truth rather than a stale seam (G-8, AC-F2-2).

**Binding oracle**:

- Every named statement present in the named pages; all three records in the index; the harness feature spec contains the mode-record link and the change artifacts reference it; `doc-conformance` and `content-inventory` green; manual review recorded in §10.

**Notes / Clarifications**:

- Absorbs the link assertion moved out of TC-HARNESS-010 (readiness finding 11), so the record-content TC can be green in its own phase while the link is verified where the documentation phase owns it.

---

#### TC-HARNESS-042 - Probe grammar and normalization: the observed line, the accepted forms, and every failing shape

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-5, AC-F1-1, AC-F1-3, DM-2, NFR-2, NFR-6, DEC-11
**Test Type(s)**: Contract, Behaviour
**Automation Level**: Automated
**Target Layer / Location**: probe output parsing and normalization; `tests/structure/harness-probe-grammar-contract.test.ts` (grammar constant) + `tests/behaviour/harness-version-probe-seam.test.ts`
**Tags**: @offline, @harness, @version-gate, @grammar

**Preconditions**:

- The declared grammar constant (product token, optional `v`, three-part semver, newline-terminated) and the version/grammar table V-01..V-19.
- A probe double returning raw stdout strings, plus the `timed-out` outcome.

**Steps**:

1. Feed the observed line `opencode v2.2.5` with its trailing newline and assert the observed version is exactly `2.2.5`: no product token, no `v`, no trailing whitespace, and the bare semver is what the instance and the row carry.
2. Assert the raw line is retained only as a diagnostic and never appears in `observedVersion`, in the telemetry row's version stamp, or in `detail.harness`.
3. Assert every accepted form in the table normalizes (including `opencode 2.2.5` without the `v`) and every rejected form is indeterminate with `harness.version.unknown` — with particular attention to `2.2.5` (bare, no product token), which must **not** be accepted.
4. Assert the grammar is anchored end to end: `opencode v2.2.5 extra`, `opencode v2.2.5\nopencode v2.3.0`, `opencode v2.2`, `opencode v2.2.5.1` are all indeterminate.
5. Assert a non-zero exit or the `timed-out` outcome is indeterminate regardless of stdout, and that the raw line of a failing probe does not become a version.
6. Assert the grammar constant is the only home of the pattern: no second regex or substring check exists in the classification path (a structural assertion over the module's exported constants).

**Expected Outcome**:

- The gate reads the harness's real output, normalizes it once, and cannot be widened by a substring, a partial version or a helpful guess (AC-F1-5, DEC-11, NFR-6).

**Binding oracle**:

- `observedVersion === "2.2.5"` for V-01/V-07/V-08; raw line absent from the stamped version and from `detail.harness`; `observedVersion === null` with `harness.version.unknown` for V-09..V-14, V-16, V-17; exactly one grammar constant exported; no version-shaped substring accepted.

**Notes / Clarifications**:

- Added for AC-F1-5 (DEC-12). The previous plan asserted a bare-semver observation with no grammar, so the real `opencode v2.2.5` output would have failed a literal implementation and a naive strip would have passed silently. V-09 is the row that keeps both failures visible.
- GAP-7: the grammar is observed on one harness line; a deviating 2.1.x output surfaces as an explicit refusal rather than a silent pass.

#### TC-HARNESS-043 - Attribution by every held session identity plus the recorded binding; no work-item column, no store-wide scan

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, AC-F5-5, DM-4, DM-8, DM-10, NFR-3, NFR-5, DEC-13, NG-11
**Test Type(s)**: Behaviour, Checks
**Automation Level**: Automated
**Target Layer / Location**: extractor entry point and the store statement log; `tests/behaviour/harness-telemetry-attribution.test.ts` + `tests/checks/fixture-store-shape.test.ts` (new)
**Tags**: @offline, @telemetry, @attribution, @fixture-shape

**Preconditions**:

- A current-generation fixture holding the run's held sessions — one per spawn (for example S1 and S2), each with a child — plus a resumed session that continues an existing identity; and many unrelated sessions: other roots, other work items' directories, other generations' rows, and unrelated `session_v2` rows with the same `directory` value.
- The run's recorded bindings, one per spawn (each naming that spawn's agent, seat and resolved model), including one held identity whose run recorded no binding (role-less).
- A recording statement log; a fixture-DDL scanner over every fixture builder.

**Steps**:

1. Capture with all held session identities and assert exactly each held session and its child are projected — zero records for every unrelated session, even ones sharing the work directory.
2. Assert each row set's seat and resolved model equal the run's recorded binding for that held identity's spawn; assert the seat is never re-derived from the current profile and never sourced from the store's `agent`.
3. Assert every recorded statement binds on `session_v2.id`/`parent_id` (or the legacy equivalents) with a predicate drawn from the held identities, and never references a work-item-, ticket-, or harness-version-shaped column; assert no statement lacks a held-identity predicate (no store-wide scan).
4. Assert a run with **no recorded session identity** yields a classified absence with zero records and zero statements issued against the store — never a scan to find "the right" session.
5. Assert the fixture-DDL scan passes: no fixture declares `work_item_ref`, `harness_version`, per-message token/agent/model/cost columns, or a `tool` column on `part` (§4.1 rule 6).
6. Assert the tree comes from parent links, not a title/directory heuristic: a session whose title equals the work item's name but whose identity differs is not attributed; and the held identity with no recorded binding carries `seat === null` with the `unresolved-seat` reason.

**Expected Outcome**:

- Attribution is every session identity the run holds plus the run's recorded binding for the seat claim; a store-wide scan or a work-item column cannot reappear, a seat cannot be re-derived at capture time, and the fixtures that would hide such a query cannot be authored (AC-F5-5, DM-4, DM-8, TDR-0032).

**Binding oracle**:

- `records` contain exactly the held identities and their children; unrelated sessions `0`; each row set's `seat`/`resolvedModel` equal its binding's; zero work-item-shaped column references; every statement carries a held-identity predicate; no-identity run → absence classification, records `0`, statements `0`; DDL scan finds no forbidden column; same-title session not attributed; unbound held identity `seat === null` with the `unresolved-seat` reason.

**Notes / Clarifications**:

- Added for AC-F5-5 (DEC-12) and restated per readiness iteration 2 / TDR-0032: the attribution key is every held session identity (one per spawn/resume) plus the run's recorded binding for the seat claim — not a single session identity, and never a seat rebuilt by inverting the current profile. It also carries the executable form of the spec's observed-shape metric ("zero assertions depend on a work-item column, a separate harness-version column, or per-message token columns"), so a future fixture cannot quietly reintroduce the shape the delivered extractor assumed.

#### TC-HARNESS-044 - Mandatory-usage boundary: a held session with no observable usage fact is a failed-session entry

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-5, F-6, AC-F5-5, AC-F6-2, NFR-11, DEC-9, OQ-3
**Test Type(s)**: Behaviour
**Automation Level**: Automated
**Target Layer / Location**: extraction classification boundary; `tests/behaviour/harness-telemetry-mandatory-usage.test.ts`
**Tags**: @offline, @telemetry, @classification

**Preconditions**:

- A readable current-generation fixture that **holds** the session identity but exposes no usage fact for it: every token column `0`/absent with no cost source and no usage-bearing message row.
- Paired controls: the same fixture with one non-zero token class, and the same fixture with a non-zero cost and zero tokens; plus the absence case (session not held) and a degraded case (optional fields absent).

**Steps**:

1. Capture for the held session with no usage fact and assert it becomes exactly one `failedSessions` entry with a closed-vocabulary reason and no fabricated row.
2. Assert the run is not reported as a silent success: the capture envelope's counts show one failed session and zero records for it.
3. Assert each paired control lands rows: a single non-zero token class is sufficient (mandatory set present), and a non-zero cost with zero tokens is sufficient.
4. Assert the boundary is not confused with the neighbours: the not-held case is absence (not a failed session) and the optional-fields-absent case is degraded with warnings (not a failed session).
5. Assert no zero-filled row is emitted for the failed session in any variant.

**Expected Outcome**:

- The classification taxonomy holds at the only boundary that is easy to get wrong: a held session that yields nothing observable is a failure to capture, while a session the store does not hold is absence and a session with missing optionals is merely degraded (DEC-9, OQ-3, NFR-11).

**Binding oracle**:

- No-usage held session → `records` for it `0`, `failedSessions` length `1` with a reason ∈ `HARNESS_WARNING_REASONS`; control with one token class → `records >= 1`, `failedSessions === []`; control with cost only → same; not-held → absence classification, `failedSessions === []`; optional-fields-absent → `records >= 1` with warnings; no zero-valued row anywhere.

**Notes / Clarifications**:

- Added for the second half of AC-F5-5. The mandatory set is the pinned OQ-3 answer: the session identity plus at least one observable usage fact; the first half (attribution) is TC-HARNESS-043, and the store-generation half is TC-HARNESS-028.

#### TC-HARNESS-045 - Human-gated live observation: rows for a session the dispatch ran through the installed harness on an agent-naming invocation

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F5-6, AC-F3-1, NFR-10, RSK-1, DM-4, DM-10, DEC-13, §17.2 Definition of Done
**Test Type(s)**: Manual
**Automation Level**: Manual (human-gated; never executed by `bun test`, `pnpm check` or CI)
**Target Layer / Location**: the change folder record `chg-GH-335-live-observation.md`; the observation runs on the delivery host against the installed in-window harness
**Tags**: @manual, @live, @definition-of-done

**Preconditions**:

- The installed harness reports a version inside the pinned window (`opencode v2.2.5` at intake).
- A human operator runs the observation; a resolved profile with at least one seat assigned to the agent the invocation names is available; the observation is read-only with respect to the harness store (no write, no configuration mutation, no credential material, no session content read).
- The observation invocation **names an agent**, so the run carries a resolved binding. A role-less run may be recorded only as an `unresolved-seat` observation and is never accepted as propagation proof (spec §17.2 clause 4).

**Steps**:

1. Run one dispatch through the installed harness port on an invocation that names an agent, so the dispatch spawns a session it holds the identity of and the run records a resolved binding. Record a role-less run, if any, separately as an unresolved-seat observation.
2. Let telemetry capture run for that session and observe that **at least one row** lands carrying the session's stored version, the seat and resolved model from the recorded binding, and its token counts.
3. Observe that the session reports the resolved seat model on the honoured surface (the per-invocation agent/model selection), and record the observed model beside the resolved one, warning on divergence.
4. Record the observation in `chg-GH-335-live-observation.md`: date, harness version output, the dispatch command, the agent named, the session identity (redacted as required), the row's stamped version/seat/tokens, the resolved-vs-observed model comparison, and the store path family.
5. If the observation is deferred, record the deferral, its reason, its exact boundary, and the accepting human/PM decision in the change's evidence; narrow the claim to "the propagation contract is verified offline; live confirmation is deferred" and never claim "profile propagation proven". Only AC-F5-6 and the live half of AC-F3-1 may be deferred; no other criterion may be (spec §17.2 clause 1).
6. Assert the record is not referenced by any automated oracle: no `*.test.ts` imports it, no gate reads it, and CI never invokes it.

**Expected Outcome**:

- The one live half of AC-F3-1 and AC-F5-6 is evidenced honestly and separately on an agent-naming invocation, and a zero-row, wrong-model or role-less outcome blocks the claim rather than being absorbed by a fixture (AC-F5-6, RSK-1, NFR-10).

**Binding oracle**:

- The record exists in the change folder and states: an in-window harness version; the agent the invocation named; ≥ 1 captured row for the session the dispatch ran; the row's stored version, seat and tokens; the resolved-vs-observed model comparison; the store path family. A zero-row outcome, an unresolved-seat (role-less) run presented as propagation proof, or a deferral without recorded human/PM acceptance fails the criterion. No automated test file or CI job references the record.

**Notes / Clarifications**:
- Added for AC-F5-6 (DEC-12) and re-scoped GAP-2: this is the *only* permitted live observation, it is human-gated, and it is never an oracle. TC-HARNESS-011 and TC-HARNESS-019 remain the offline proof; this record is the DoD evidence for what fixtures cannot claim.

#### TC-HARNESS-046 - Single production probe construction site

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: F-1, AC-F1-1, AC-F1-5, NFR-1, NFR-2, DEC-11, §17.2 clause 6
**Test Type(s)**: Contract, Structure
**Automation Level**: Automated
**Target Layer / Location**: the production harness composition (`packages/cli/src/production.ts`, the configured-kind registry wiring in `packages/core/src/domain/harness-registry.ts`) scanned by a structure check; `tests/structure/harness-probe-construction-site.test.ts` (new)
**Tags**: @offline, @structure, @version-gate

**Preconditions**:

- The pinned probe seam (§4.4a); the production composition modules; a source/AST scan over `packages/**` for constructions and call sites of the probe seam; a temp-copy mutant of the production composition that adds a second construction.

**Steps**:

1. Scan every production module under `packages/**` and assert exactly one construction site of the probe seam exists, and that it is the dispatch path's harness resolution.
2. Assert the version probe is injected at that single site and that no second production call site resolves or constructs the probe (doubles live only under `tests/**` and are not production construction sites).
3. Assert the check fails when a second call site appears: run it against a temp-copy mutant that adds one, and assert it fails naming the offending file (non-vacuity — the §4.2 rule-3 pattern applied to structure).
4. Assert the check runs inside the quality-gate battery (`bun test tests/structure`, and therefore `pnpm check`) and record its verdict in the change's evidence (spec §17.2 clause 6).

**Expected Outcome**:

- The DoD's "exactly one production probe construction site" is a machine check, not a prose claim: a second probe path added later fails the suite before it can defeat the single-probe rule (AC-F1-1, AC-F1-5, DEC-11).

**Binding oracle**:

- Construction sites of the probe seam in `packages/**` `=== 1`, located in the dispatch-resolution composition; no second call site; the temp-copy mutant yields a failing check that names the added file; the check is discovered by `bun test tests/structure` and recorded as quality-gate evidence; zero live probe invocations and zero sockets during the check.

**Notes / Clarifications**:

- Added for spec §17.2 clause 6 (restated as a single construction site at readiness iteration 2, finding 7). It asserts a tree invariant over the production composition, never a diff against a moving base branch (testing-strategy invariant-test rule), and it adds no runtime probe.

## 6. Environments and Test Data

- **Environment**: local developer machine or CI runner; Bun pinned via `.bun-version`; pnpm workspace. Offline and hermetic — no network, no live harness, no credentials, no real user state directories (NFR-10). Narrow suites while iterating; the aggregate gate before completion: `TMPDIR=$PWD/tmp/tmpdir pnpm check`.
- **Version and grammar fixtures**: a fixture module under `tests/fixtures/harness/` declaring V-01..V-19 (raw probe stdout, expected normalized version, verdict, identity, exit) and the accepted-grammar constant. Probe doubles record their input (`deadlineMs`, `now`) and return a `HarnessVersionProbeOutcome`; no test spawns a real binary.
- **Mode fixtures**: config fixtures for absent / explicit-default / unknown / wrong-typed / empty mode values, plus recording doubles for the three observed transport surfaces (`--standalone`, `service …`, `--server`/`api`) so "no fallback" is a recorded-call assertion.
- **Propagation fixtures**: declared binding records with N ≥ 2 seats and `provider/model[#variant]` models, the agent→seat mapping (`agentOverrides` / seat-named agents) that resolves each spawn's single-seat binding, one named agent per spawn (N seats are N spawns), and the role-less spawn case exercised against both a multi-seat and a single-seat profile; conflicting ambient parent values and undeclared record names used by the variable-consuming double; one unrepresentable seat model per variant; `tests/fixtures/harness/spawn-env.ts` extended rather than replaced.
- **Store test data**: `tests/fixtures/harness/opencode-store/current-generation.ts` and `legacy-generation.ts` (the two observed families, §4.1a) behind the shared `opencode-store/build.ts`; declared variants: complete multi-seat, multiple held identities with their recorded bindings, missing duration pair, inverted pair, equal pair, reported zero cost, no cost source, missing token class, model divergence, agent divergence, group scoping (observed agent ≠ binding agent), variant-only difference, version missing, version divergent, seat unresolved (role-less), no-usage held session, orphan/unrelated sessions, over-cap populations, unrecognised generation, permission-denied, not-a-database, torn schema, absent session. Every variant is built in a temp directory; no binary store is committed; every variant carries a privacy canary.
- **Stream test data**: the committed real-shape captures at `tests/fixtures/harness/stream/` (`opencode-v2.2.5.jsonl`, `-tool-error`, `-stream-error`, `-tokens`) with their provenance README; synthetic frames only through `tests/fixtures/harness/scenarios/stream.ts`.
- **Resume/attach fixtures**: the committed resume fixture plus a bounded listing fixture with an over-cap variant and an absent-identity variant.
- **Injected nondeterminism sources**: fixed `NOW_MS`, fixed session/run id sequences, synthetic brand constant; store timestamps, durations and version strings are literals.
- **Isolation**: one temp root per case; mutation probes and clamp probes operate on temp copies; the live tree and real state directories are never written.
- **The single permitted live observation**: TC-HARNESS-045, human-gated, recorded in `chg-GH-335-live-observation.md`. It is not `*.test.ts`, is not discovered by `bun test`, is never invoked by `pnpm check` or CI, and is never an oracle for any TC in this plan (GAP-2).
- **Cleanup**: temp roots discarded per test; no persistent state outside committed fixtures.

## 7. Automation Plan and Implementation Mapping

The first column lists `TC-HARNESS-<nnn>` suffixes; every id appears in §5.1 and §5.2 under its full name. TC-HARNESS-046 is the only case added at revision 1.3; its row sits after TC-HARNESS-045.

| TC ID(s) | Test file(s) to create/update | Execution command | Mocking / seeding requirements | Status |
|----------|------------------------------|-------------------|-------------------------------|--------|
| 001, 002, 003, 006, 042 | `tests/behaviour/harness-version-gate.test.ts`, `harness-version-probe-seam.test.ts` (new), `tests/structure/harness-probe-grammar-contract.test.ts` (new) | `bun test tests/behaviour/harness-version-gate.test.ts tests/behaviour/harness-version-probe-seam.test.ts tests/structure/harness-probe-grammar-contract.test.ts` | Version/grammar table fixture; probe double with deadline input; recording runner; paired in-window control | To Implement |
| 004, 005 | `tests/behaviour/harness-version-window.test.ts`, `tests/structure/harness-version-window-contract.test.ts` (new) | `bun test tests/behaviour/harness-version-window.test.ts tests/structure/harness-version-window-contract.test.ts` | Version table + window constant + config-branch key set; temp-copy window mutants for V-18/V-19 | To Implement |
| 007, 008, 009 | `tests/behaviour/harness-mode-selection.test.ts`, `harness-mode-refusal.test.ts`, `harness-mode-config.test.ts` (new) | `bun test tests/behaviour/harness-mode-*.test.ts` | Mode config fixtures; recording doubles for the three observed surfaces; ambient canary | To Implement |
| 010 | `tests/checks/decision-record.test.ts` (extend inventory) | `bun test tests/checks/decision-record.test.ts` | The authored records; chosen-mode constant equality | To Implement (+ docs) |
| 011, 015 | `tests/behaviour/harness-profile-propagation.test.ts`, `harness-profile-per-spawn.test.ts` (new); `harness-telemetry-seat-attribution.test.ts` (new) | `bun test tests/behaviour/harness-profile-propagation.test.ts tests/behaviour/harness-profile-per-spawn.test.ts tests/behaviour/harness-telemetry-seat-attribution.test.ts` | One named agent per spawn (N seats are N spawns); N-seat binding records with distinct seats; argv-and-environment recording spawn double; current-generation store holding one session per spawn; role-less control against a multi-seat and a single-seat profile; one single-seat fixture run twice — named (sole seat resolved and sent) and role-less (nothing bound) | To Implement |
| 012, 013, 014 | `tests/behaviour/harness-profile-precedence.test.ts`, `harness-profile-neutrality.test.ts`, `harness-profile-unrepresentable.test.ts` (new) | `bun test tests/behaviour/harness-profile-{precedence,neutrality,unrepresentable}.test.ts` | Variable-consuming double; conflicting parent values; undeclared canaries; expressibility variants (no catalogue); unassigned-agent fixture with attempt-record and spawn seams; delivered spawn-env assertions unchanged | To Implement |
| 016, 017 | `tests/behaviour/harness-resume-propagation.test.ts` (new); `harness-opencode-resume-stream.test.ts` (assertions unchanged) | `bun test tests/behaviour/harness-resume-propagation.test.ts tests/behaviour/harness-opencode-resume-stream.test.ts` | Committed resume fixture; canonical binding and argv comparison | To Implement |
| 018 | `tests/behaviour/harness-attach.test.ts` (new) | `bun test tests/behaviour/harness-attach.test.ts` | Bounded listing fixtures (in-cap, over-cap, absent); kill double | To Implement |
| 019, 021, 022 | `tests/behaviour/harness-telemetry-seat-attribution.test.ts`, `harness-telemetry-divergence.test.ts`, `harness-telemetry-durations.test.ts` (new); `harness-telemetry-shape.test.ts` (update) | `bun test tests/behaviour/harness-telemetry-{seat-attribution,divergence,durations,shape}.test.ts` | Current-generation variants: complete, model divergence, agent divergence, group scoping, variant-only, missing/inverted/equal timestamp pair, reported zero cost, missing cost, version drift; a recorded binding (seat + resolved model) per fixture; literal constants | To Implement (+ update) |
| 020, 028 | `tests/behaviour/harness-telemetry-version-compat.test.ts`, `harness-telemetry-generation.test.ts` (new) | `bun test tests/behaviour/harness-telemetry-version-compat.test.ts tests/behaviour/harness-telemetry-generation.test.ts` | Committed legacy row golden; current and legacy generation builders; legacy-only and current-only mutant extractors | To Implement |
| 023, 024, 044 | `tests/behaviour/harness-telemetry-classification.test.ts`, `harness-telemetry-extraction-failure.test.ts`, `harness-telemetry-mandatory-usage.test.ts` (new) | `bun test tests/behaviour/harness-telemetry-{classification,extraction-failure,mandatory-usage}.test.ts` | Not-held session; five damaged stores; no-usage held session; recorded state-append seam; paired controls | To Implement |
| 025, 026, 043 | `tests/behaviour/harness-telemetry-bounds.test.ts`, `harness-telemetry-seat-totals.test.ts`, `harness-telemetry-attribution.test.ts` (new); `tests/checks/fixture-store-shape.test.ts` (new) | `bun test tests/behaviour/harness-telemetry-{bounds,seat-totals,attribution}.test.ts tests/checks/fixture-store-shape.test.ts` | Recording statement log; over-cap/at-cap stores; baseline + step fixtures; multiple held identities with their recorded bindings; unrelated-session population; fixture DDL scan | To Implement |
| 027, 029, 030 | `tests/behaviour/harness-telemetry-privacy.test.ts` (new); `harness-output-bounds.test.ts` (update); `tests/checks/harness-determinism.test.ts` (update); `tests/checks/fixture-privacy.test.ts`, `privacy-literals.test.ts` (update as needed) | `bun test tests/behaviour/harness-telemetry-privacy.test.ts tests/behaviour/harness-output-bounds.test.ts tests/checks/harness-determinism.test.ts tests/checks/fixture-privacy.test.ts` | Content canaries in `session_message.data` and legacy `message.data`; over-cap render sets; injected clock and ids | To Implement (+ updates) |
| 031, 032, 033 | `packages/testkit/src/conformance/harness.ts` (extend), `tests/conformance/harness-extension-scenarios.test.ts` (new); `tests/structure/conformance-coverage.test.ts` (update); `tests/conformance/harness-classification.test.ts` (assertions unchanged) | `bun test tests/conformance tests/structure/conformance-coverage.test.ts` | Floor/extension constants; additive executor; mutated-registry fixtures; simulated harness I/O | To Implement (+ update) |
| 034, 039 | `tests/checks/harness-hermetic.test.ts` (new) | `bun test tests/checks/harness-hermetic.test.ts` | Network/credential/process probe harness; the full new suite set | To Implement |
| 035, 040 | `tests/structure/error-table.test.ts`, `tests/structure/harness-contract.test.ts`, `tests/structure/result-contract.test.ts`, `tests/structure/dispatch-envelope-detail.test.ts` (update); `tests/types/verify-gates-suite-map.type-test.ts`, `tests/types/dispatch-envelope-detail.type-test.ts` (update); `tests/fixtures/result/envelope-key-set.json` (update); `tests/checks/error-table-sync.test.ts` (update); `tests/checks/exit-code-literals.test.ts` (must stay green); `tests/behaviour/dispatch-harness-verdict-mode.test.ts` (new) | `bun test tests/structure tests/checks/error-table-sync.test.ts tests/checks/exit-code-literals.test.ts tests/behaviour/dispatch-harness-verdict-mode.test.ts && bun run scripts/checks/error-table-sync.ts` | Four new identities; delivered nine codes; the `detail.harness` member and its pins; per-identity refusal fixtures; attempt-record presence on success and absence on every pre-session refusal | To Implement (+ updates) |
| 036 | `tests/behaviour/harness-refusal-side-effects.test.ts` (new) | `bun test tests/behaviour/harness-refusal-side-effects.test.ts` | Recording probe/session/one-shot/append/attempt/store seams; fake process table; precedence fixtures P-01..P-04; M-11 unassigned-agent fixture | To Implement |
| 037 | `harness-stream-hygiene.test.ts`, `harness-opencode-stream.test.ts`, `dispatch-harness-*.test.ts` (assertions unchanged) | `bun test tests/behaviour/harness-stream-hygiene.test.ts tests/behaviour/harness-opencode-stream.test.ts tests/behaviour/dispatch-harness-acquisition.test.ts` | Committed stream fixtures; synthetic long stream; audit seam | Existing – assertions retained |
| 038 | `tests/checks/harness-mutants.test.ts` (extend) | `bun test tests/checks/harness-mutants.test.ts` | Twenty-four named mutants; paired fixtures | To Implement (+ extension) |
| 041 | The named `doc/spec/**` pages, `doc/decisions/00-index.md`, `doc/planning/oss-tooling/` markers | manual content check + `bun test tests/checks/doc-conformance.test.ts tests/structure/content-inventory.test.ts` | none | Manual + static checks |
| 045 | `chg-GH-335-live-observation.md` (change folder) | none — human-gated observation, not a runner | Installed in-window harness; resolved profile bound to the agent the invocation names; agent-naming invocation; read-only store access; recorded human/PM acceptance for any deferral | Manual (never CI) |
| 046 | `tests/structure/harness-probe-construction-site.test.ts` (new) | `bun test tests/structure/harness-probe-construction-site.test.ts` | Source/AST scan of the production composition; temp-copy mutant that adds a second construction site | To Implement |
| Owned updates (no TC change) | `tests/behaviour/harness-telemetry-shape.test.ts`, `harness-telemetry-opencode.test.ts`, `harness-telemetry-opencode-orphan-scope.test.ts`, `harness-telemetry-drift.test.ts` (delivered store-shape fixtures and oracles rebuilt on DM-10; declared as owned updates, not unchanged controls) | `bun test tests/behaviour/harness-telemetry-shape.test.ts tests/behaviour/harness-telemetry-opencode.test.ts tests/behaviour/harness-telemetry-opencode-orphan-scope.test.ts tests/behaviour/harness-telemetry-drift.test.ts` | `opencode-store/{current-generation,legacy-generation,build}.ts` (§4.1a); named-removal variants; no synthetic `work_item_ref`/`harness_version`/per-message token/`part.tool` column | To Update (owned store-shape rebuild) |
| Fixture set | `tests/fixtures/harness/version.ts`, `mode.ts`, `profile.ts` (new); `opencode-store/{build,current-generation,legacy-generation}.ts`; `spawn-env.ts` (extend); `scenarios/` (extend) | `bun test tests/checks/fixture-privacy.test.ts tests/checks/fixture-store-shape.test.ts` | Synthetic, privacy-scanned fixtures derived from DM-10 only; one named agent per seat, one recorded binding per spawn, the role-less case against a multi-seat and a single-seat profile | To Implement |
| Regression envelope | all suites above | `TMPDIR=$PWD/tmp/tmpdir pnpm check` | none (aggregate gate unchanged) | Existing – No Change |

**Owned updates of the telemetry phase (declared, not "unchanged").** Four delivered opencode-store suites encode the synthetic store shape — `INSERT INTO session (... work_item_ref, harness_version ...)`, a `work_item_ref IS NULL` orphan-scope predicate, and a zero-warning positive control that the observed store's absent tool source breaks. DM-10, DEC-9 and §17.2 clause 2 force them onto the observed generations, so the telemetry phase owns them and each is named with what changes in it:

- `tests/behaviour/harness-telemetry-shape.test.ts` — fixtures re-derived from the `session_v2`/`session_message` and legacy `session`/`message`/`part` builders via `opencode-store/build.ts`; the shape assertions restated on the observed field inventory.
- `tests/behaviour/harness-telemetry-opencode.test.ts` — the fabricated columns removed; the version read from `session_v2.version`; tool counts asserted absent with the declared warning where the store exposes no tool source.
- `tests/behaviour/harness-telemetry-opencode-orphan-scope.test.ts` — attribution by the held session identity and the store's parent links; with no work-item column, the orphan-scope predicate is re-expressed on session/tree identity rather than a null work-item reference.
- `tests/behaviour/harness-telemetry-drift.test.ts` — its zero-warning positive control becomes one that carries the declared tool-source absence instead of assuming a populated tool source.

This ownership changes only the store contract these four suites are seeded from: no TC's oracle, identity, exit, bound or AC/NFR mapping moves, and no other delivered suite is edited for it.

Existing suites asserted unchanged (regression half only): `tests/conformance/harness-classification.test.ts`, `harness-liveness.test.ts`, `tests/behaviour/harness-spawn-env.test.ts`, `harness-spawn-credential.test.ts`, `harness-default-path.test.ts`, `harness-opencode-stream.test.ts`, `harness-opencode-resume-stream.test.ts`, `harness-host-stream.test.ts`, `harness-stream-hygiene.test.ts`, `harness-telemetry-claude.test.ts`, `harness-telemetry-claude-budget.test.ts`, `harness-closeout-{capture,idempotency,nongating}.test.ts`, `dispatch-harness-{acquisition,default-spawn,lease}.test.ts`, `tests/checks/harness-ci-parity.test.ts`, and the delivered spend read-side suites (untouched: `spend.telemetry-absent` keeps its meaning).

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| Risk | Mitigation in this plan |
|------|------------------------|
| Propagation is nominally correct but inert because the harness ignores the surface (RSK-1) | DEC-8/TDR-0032 are tested as delivered: TC-HARNESS-011 asserts exactly one `--agent`/`--model` pair per invocation across N spawns for an N-seat profile, and asserts no `OC_*` variable is invented; a role-less spawn binds nothing (TC-HARNESS-015). The live confirmation is AC-F5-6's human-gated observation (TC-HARNESS-045, GAP-2), never a test oracle |
| A recording double accepts an invocation shape production cannot send, so the suite is green while the argv is invalid (readiness iteration 2 C2) | §4.2 rule 5 and TC-HARNESS-011 assert exactly one pair per invocation; two pairs on one invocation, a collapsed seat, or a short spawn count each fails. TC-HARNESS-014 proves the pre-session refusals and the unassigned case; TC-HARNESS-040 proves disclosure per path |
| Seat attribution is fabricated: a seat read from the store's `agent`, re-derived from the current profile, or attached to a group the run never selected | TC-HARNESS-019 asserts the seat and resolved model come from the recorded binding and `agentRole` from the store; TC-HARNESS-021 asserts both divergence axes with group scoping; TC-HARNESS-043 asserts the binding-to-held-identity mapping and forbids re-derivation (TDR-0032) |
| The pinned window ages out and blocks delivery (RSK-2) | TC-HARNESS-005 asserts the window is pinned with no configuration key and that a temp-copy widening flips the verdict; a stale window surfaces as a classified refusal (TC-HARNESS-002), not a silent acceptance |
| Extraction reads a store shape that does not exist, so a real capture lands zero rows while tests stay green (RSK-9, GAP-7-of-spec) | Every fixture derives from DM-10 (§4.1a); TC-HARNESS-043 scans the fixture DDL for the forbidden columns and TC-HARNESS-038's `work-item-column-query`/`part-tool-query` mutants must fail; TC-HARNESS-019 asserts ≥ 1 row and treats zero rows as failure |
| New refusal identities fragment the error table or duplicate delivered meanings (RSK-5) | TC-HARNESS-035 asserts exactly four additive codes, unchanged delivered meanings, and the absence of any telemetry-absence identity; TC-HARNESS-038's collapse mutant guards identity distinctness |
| The declared `detail.harness` member is declared but never projected, so the disclosure is silently dropped (TDR-0031) | TC-HARNESS-040 asserts the member per identity through the rendered envelope (not the returned record), including the identities that must not carry it; TC-HARNESS-035 pins the closed member set, the validator and the fixture two-sidedly |
| Deny-by-default environment is weakened while adding propagation (RSK-6) | TC-HARNESS-013 asserts exact key-set equality, allowlist immutability and canary absence on both surfaces; TC-HARNESS-011 asserts the environment gains no seat variable; the `forward-undeclared-record` and `per-seat-env-family` mutants must fail |
| Seat attribution double counts against session totals, or a reported zero is read as absence (RSK-7, NFR-6) | TC-HARNESS-026 asserts one totals basis with breakdown sums equal to totals, and that a zero-cost-with-tokens session is data rather than absence |
| A store generation is unrecognised, so a line inside the window silently yields nothing (RSK-4, GAP-6) | TC-HARNESS-028 asserts both observed generations and fails a generation-blind extractor in both directions; TC-HARNESS-024 classifies an unrecognised generation as extraction failure |
| The probe grammar is pinned from one observed line (GAP-7) | TC-HARNESS-042 pins the grammar, the normalization and every failing shape, and a deviating output refuses explicitly as `harness.version.unknown` — a visible outcome, never a silent pass |
| The 5 s probe bound is unprovable, so the oracle would test the double rather than the gate (readiness finding 8) | §4.4a pins the deadline seam the implementation must introduce; TC-HARNESS-006 asserts the deadline argument, the runner timeout and the `timed-out` → unknown mapping; the wall-clock half is demoted to a §10 reference measurement (GAP-3) |
| `AC-F2-2` could pass on a decorative record | TC-HARNESS-010 asserts the record's chosen mode equals the code's default constant, its vocabulary membership and an R2 body; correctness remains human-gated (GAP-4) |
| A test plan oracle requires an artifact another phase owns, so the phase gate can never be green (readiness finding 11) | TC-HARNESS-010 owns record content only; the feature-spec link and index assertions live in TC-HARNESS-041 (documentation phase) |
| Conformance extension silently widens the six-id floor, or a scenario id has no executable surface (readiness finding 13) | §4.6 C-02/C-06/C-09/C-10 pin the floor/extension split, the additive executor and its location; TC-HARNESS-031 asserts the floor value is unchanged; TC-HARNESS-033 asserts execution, not declaration |
| Adding gate work could disturb the delivered stream (NFR-8) | TC-HARNESS-037 replays the committed captures and asserts evidence, acquisition and bound parity, plus audit composition |
| Tests could assert implementation strings and become brittle (GAP-5) | Every field, reason, mode and verdict name goes through declared contract constants pinned in the contract suite; no TC asserts an inline literal beyond the identities the spec pins verbatim |

### 8.2 Assumptions

- The harness exposes its version through one bounded shell-free invocation whose accepted grammar is pinned, and the probe seam is extended to carry a deadline and an explicit `timed-out` outcome (§4.4a, OQ-10); that seam has exactly one production construction site (TC-HARNESS-046).
- The resolved binding for the agent a run names is available at spawn time as validated data from the delivered profile resolution (spec §12); profile resolution itself is not re-tested here.
- The profile plane already declares the agent→seat relation (`agentOverrides` and the seat-named lookup), so seat resolution needs no new mapping, and a spawn naming no agent binds nothing in every profile shape (TDR-0032, Amendment A-1).
- On the opencode surface the binding is expressed as exactly one `--agent` and one `--model` invocation argument; a declared variable name binds only on a harness that consumes variables, and an undeclared record name is inert (DEC-8, AC-F3-3).
- The representability check is expressibility-only: a resolved model is tested against the `provider/model[#variant]` form and the adapter's declared bound. No recognised-agent or recognised-model catalogue exists or is read (DEC-14, TDR-0032); an agent or model the harness does not know is its own classified spawn failure, or an agent-divergence warning.
- The delivered telemetry row grouping (per session/agent/model) remains the coarse grain and seat identity is an added dimension (spec §12).
- The state layer's `harness.telemetry` payload allowlist persists the additive fields; TC-HARNESS-019 (T-09) asserts the round trip rather than assuming it.
- The delivered `error-table` rows derive exit purely from `projectionClass`; no new exit literal is introduced (spec §21, `packages/cli/src/projection.ts`).
- The delivered six-id floor and both registrations survive unchanged; the extension is additive on the same registry (spec §8.5, DM-7).
- Both observed store generations (current and legacy) are what the fixture pair models; the in-window `2.1.x` line's own generation remains unobserved (GAP-6).

### 8.3 Open Questions

| ID | Question | Blocking status | Default applied here | Owner |
|----|----------|-----------------|----------------------|-------|
| OQ-4 | Which name must be declared on the harness configuration branch for a binding to bind, and who declares it — configuration, profile resolution, or composition? | Non-blocking for the opencode path (the binding is an argument); blocking for TC-HARNESS-012/013's variable-consuming fixture wiring | The allowlist must declare each propagated name on a variable-consuming harness; the delivery supplies the declaration; an undeclared record name changes nothing; on opencode no declaration is needed and none is invented (AC-F3-3, DEC-8, NG-10) | @plan-writer → @coder |
| OQ-5 | Which refusal identity and projection class does AC-F2-4's "unknown mode value" use, and which projection class do `harness.mode.unavailable` and `harness.profile.model-unrepresentable` take? | Non-blocking; asserted through declared constants either way | Unknown mode value → the delivered `config.value.invalid` (user-validation, exit 1; no `detail.harness`); mode-unavailable and model-unrepresentable → user-validation, exit 1, with the TDR-0031 member | @plan-writer |
| OQ-6 | — **Closed** by the spec v1.1 amendment: AC-N1-1 now reads "no session-bearing child process" with the single bounded probe as the declared exception. | Closed | The reading is the spec's own wording; TC-HARNESS-036 asserts it (probe `calls <= 1`, completed and reaped) | — |
| OQ-7 | Is `attach` a distinct port operation, or the bounded `listSessions` lookup followed by `resume`? | Non-blocking; the oracle asserts listing-once + spawn-zero either way | Attach = bounded listing plus resume; no new port member (F-4 wording) | @plan-writer → @coder |
| OQ-8 | For a degraded generation, which fields are the "mandatory identity and usage fact" set that separates "degrade with warnings" from "classify the session as failed"? | Non-blocking; pins the boundary in TC-HARNESS-044/028 | Mandatory = the session identity the dispatch holds plus at least one observable usage fact (a token class or cost); absent → failed session with a closed reason; present → degrade for the missing optional fields (the spec's pinned OQ-3 answer) | @plan-writer → @coder (fixtures) |
| OQ-9 | What is the exact registry surface that supplies version and mode facts to a conformance scenario, given the registry builds a session port while version and mode are resolution-time concerns? | Blocking for TC-HARNESS-033's implementation | Scenario facts are injected as data through the additive executor's `io`/`deps` surface; the production resolution path is untouched; the extension is data on the same registry (F-7) | @plan-writer → @coder |
| OQ-10 | Is the deadline-carrying probe outcome (input `{deadlineMs, now}`, result `answered` or `timed-out`) an additive replacement for the delivered `HarnessVersionProbe = () => Promise<string>`, or a second seam beside it? | Blocking for TC-HARNESS-006's bound half; non-blocking for the verdict cases | Replace the delivered signature (a single production probe seam, §4.4a); the resolver passes the deadline and the injected clock; a `timed-out` outcome is indeterminate. Until the plan declares this seam, the bound half is reported as a GAP, never as passing | @plan-writer |
| OQ-11 | What is the injectable source of a "recognised model" catalogue? | **Closed** by DEC-14: AC-F3-4's second half is narrowed out, because no in-process source exists and `opencode debug agents` would be a second pre-session child (AC-N1-1, NFR-1) | No catalogue is read and none is invented; the pre-session refusal is expressibility-only, and an unknown agent/model is the harness's own classified spawn failure or an agent-divergence warning | — |
| OQ-12 | Does the conformance extension carry four scenario ids (version-window, version-unknown, mode-unavailable, profile-propagation) or five (splitting version-inside / version-outside, as F-7's enumeration reads)? | Non-blocking; asserted through the declared constants either way | Four ids, with `version-window` asserting both directions and failing if either is wrong; the identity→scenario map is total over the four new identities | @plan-writer |

**Inherited spec obligations (not test-plan questions).** Two open questions now live in the change spec and are inherited here as obligations, not re-decided:

- **spec OQ-4** — whether the generic `dispatch` path declares an agent role (a value flag or a declared harness-agent default). Until it does, its spawns bind nothing and are disclosed as `unresolved-seat`, so they are never counted as propagation proof. TC-HARNESS-015 pins the role-less behaviour against any profile shape (Amendment A-1); TC-HARNESS-045 records any role-less live run as an unresolved-seat observation (spec §17.2 clause 4); TDR-0032 revisit trigger 1 names the change that would replace it.
- **spec OQ-5** — whether operators' multi-seat profiles declare `agentOverrides` for every launched role. An undeclared named agent refuses through the delivered `provider.profile.invalid` (TC-HARNESS-014, matrix M-11), and the answer is observed at the human-gated live observation and recorded in the change folder.

Neither is a test-plan default: the behaviour is pinned in both directions by TC-HARNESS-015 and TC-HARNESS-014, so the change is testable whichever way the operators answer.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-17 | @test-plan-writer | Initial test plan for GH-335 (M3-S1 opencode v2.x harness and telemetry): 41 scenarios (TC-HARNESS-001..041) covering all 23 ACs, DM-1..DM-7 and NFR-1..NFR-10 with every AC mapped; both pinned blueprint scenarios (TC-M3-HARNESS-001/002) delivered as dedicated cases with their verbatim Given/When/Then; refusal/oracle matrix M-01..M-10 with precedence P-01..P-03, version verdict matrix V-01..V-12, telemetry field matrix T-01..T-14, conformance scenario matrix C-01..C-08; binding fixture, non-vacuity and mutant contracts mirroring the GH-291 precedent; gaps GAP-1..GAP-6 and open questions OQ-4..OQ-9 declared with defaults and owners |
| 1.1 | 2026-11-17 | @test-plan-writer | Readiness iteration 1 remediation (verdict NOT_READY): coverage re-cut to the revised spec's **26** ACs — four TCs added (TC-HARNESS-042 probe grammar and normalization, 043 attribution by the held session identity, 044 mandatory-usage boundary, 045 human-gated live observation) taking the count to 45; every store fixture rebuilt from DM-10/Appendix C (current `session_v2`/`session_message` generation plus legacy `session`/`message`/`part` with no `tool` column) and the forbidden synthetic shape deleted and asserted absent; T-02 inverted so store timestamps are the duration source, T-03 extended with the reported-zero-versus-no-cost-source rule and T-11 relaxed to permit bounded per-message metadata reads; T-14 replaced by two-generation tolerance with a two-sided mutant pair; the invented `harness.telemetry.absent` identity deleted from the matrix, the TCs, the code and the claims, replaced by the three-way in-envelope taxonomy plus the delivered `spend.telemetry-absent` read side and non-gating closeout; TC-HARNESS-006's unprovable 5 s wall-clock oracle replaced by a pinned deadline seam (§4.4a, OQ-10); TC-HARNESS-010's link assertion moved to TC-HARNESS-041 so the owning phase can be green; the conformance executor and the floor/extension scenario-id union split declared explicitly (§4.6 C-06/C-09/C-10); TC-HARNESS-036 re-scoped to "no session-bearing child, probe ≤ 1 completed and reaped"; the mode vocabulary and the propagation scenario retargeted to the observed surfaces (DEC-8: per-invocation `--agent`/`--model`); the refusal/disclosure matrix extended with the TDR-0031 `detail.harness` member and its identity mapping; GAP-2 re-scoped to AC-F5-6 plus the DoD, GAP-6 replaced by the unobserved 2.1.x generation, GAP-7 added for the single-line grammar observation; OQ-6 closed by the spec amendment, OQ-10..OQ-12 added. Full per-TC change list in §11 |
| 1.2 | 2026-11-18 | @test-plan-writer | **Erratum, no TC change.** The four delivered opencode-store suites were removed from §7's "asserted unchanged" list and declared owned updates of the telemetry phase: `harness-telemetry-shape`, `harness-telemetry-opencode`, `harness-telemetry-opencode-orphan-scope` and `harness-telemetry-drift` (which encoded `work_item_ref`, `harness_version`, a null-work-item orphan predicate and a zero-warning positive control the absent tool source breaks). §4's telemetry row and §7's automation table now name all four as updates with what changes in each. No TC oracle, identity, exit, bound or AC/NFR mapping moved; the six-id floor and every other delivered control are unchanged. Detail in §11.6 |
| 1.3 | 2026-11-18 | @test-plan-writer | Readiness iteration 2 remediation (verdict NOT_READY, finding C2): the seat rule is restated to TDR-0032/DEC-13 — **one spawn binds exactly one seat**, a profile's N seats are N spawns, N sessions and N row sets, each invocation carries exactly one `--agent` and one `--model`, and the seat has no argv carrier and is recorded on the run. TC-HARNESS-011 is re-cut from three flag pairs on one spawn (`calls === 1`) to three spawns with per-invocation single-pair equality (`calls === 3`); TC-HARNESS-046 is added for the DoD clause-6 single production probe construction site (count 45 → 46); TCs 014, 015, 016, 019, 021, 036, 040, 043 and 045 are reshaped to the recorded-binding source, group scoping, the agent-divergence axis, the `unassigned` refusal, the role-less control and per-path disclosure; the pinned-scenario row, §3.1/§3.2/§3.3, matrices M-05/M-11 and T-05/T-07, §4.1a, §8.1/§8.2/§8.3, GAP-2, GAP-5 and OQ-11 are restated for consistency. No other TC's oracle, identity, exit, bound or AC/NFR mapping moved; full delta list in §11.3 |

## 10. Test Execution Log

No suites were run while authoring this plan. This log is populated during delivery (phase 6) and quality gates (phase 9). The NFR-2 reference measurement (TC-HARNESS-006, GAP-3) and the manual documentation traceability review (TC-HARNESS-041) are recorded here; the human-gated live observation (TC-HARNESS-045, GAP-2) is recorded in `chg-GH-335-live-observation.md`, not here.

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | — | Awaiting delivery |

## 11. Change Log — Revisions 1.1–1.4 (what moved, and why)

**No test case was removed.** All forty-one revision-1.0 ids (TC-HARNESS-001..041) survive with their ids unchanged; revision 1.1 added 042–045 and revision 1.3 adds 046, so the plan now holds forty-six. One TC absorbed another's assertion (TC-HARNESS-041 takes TC-HARNESS-010's link assertions), one TC's subject was replaced rather than dropped (TC-HARNESS-028), and revision 1.3 re-cuts the seat rule and ten TCs to TDR-0032. This section states every reshaped oracle, identity, exit, bound and AC/NFR mapping so the readiness gate can check the change rather than infer it. Sections 11.1, 11.2 and 11.5–11.6 record revisions 1.1/1.2; section 11.7 records the revision-1.3 deltas that changed a TC and the revision-1.4 extension of TC-HARNESS-015.

### 11.1 Test cases added at revision 1.1 (4)

| TC | Why | AC |
|---|---|---|
| TC-HARNESS-042 | AC-F1-5 is new: the probe grammar and normalization were unpinned, so the real `opencode v2.2.5` output had no oracle and a naive strip was invisible | AC-F1-5, AC-F1-1, AC-F1-3, NFR-2, NFR-6 |
| TC-HARNESS-043 | AC-F5-5 is new: attribution by the held session identity, the no-work-item-column rule and the no-store-wide-scan rule had no dedicated oracle; it also carries the fixture-DDL scan that keeps the forbidden shape out | AC-F5-5, DM-8, DM-10, NFR-3, NFR-5 |
| TC-HARNESS-044 | AC-F5-5's second half and the pinned OQ-3 taxonomy: a held session with no observable usage fact is a failed-session entry, distinct from absence and from degradation | AC-F5-5, AC-F6-2, NFR-11 |
| TC-HARNESS-045 | AC-F5-6 is new: the human-gated live observation, recorded in the change folder, never a CI oracle | AC-F5-6, AC-F3-1, NFR-10 |

### 11.2 Retargeted or reshaped surviving test cases (explicit)

| TC | What changed | Why |
|---|---|---|
| 001 | Fixture probe returns `opencode v2.2.5\n`; `observedVersion` asserted **normalized** (`2.2.5`), raw line asserted not stamped | AC-F1-5, DEC-11 |
| 002 | Fixture `opencode v2.3.0`; oracle gains the `detail.harness` member set (`outside`, version present, no `mode`) | TDR-0031, AC-F1-2 |
| 003 | Variant set widened to empty / two-part / trailing junk / bare semver / `timed-out`; oracle gains `observedVersion === null` + `indeterminate`, `mode` absent | AC-F1-5, DEC-11 |
| 004 | Table now V-01..V-19; step 2 asserts the grammar shape; step 4 adds `2.20.0`/`12.2.5` outside and bare `2.2.5` indeterminate | AC-F1-5 |
| 005 | **Inverted**: no configurable window exists, so the oracle asserts the config branch has no window key and acceptance is unchanged under an invented key, plus two-direction temp-copy probes | AC-F1-4 rewritten (DEC-1) |
| 006 | **Oracle replaced**: the 5 001 ms fake-clock advance is gone. New oracle: `deadlineMs === 5000`, injected clock by reference, runner `timeoutMs === 5000`, `timed-out` → unknown, `calls === 1`, ordering. Wall-clock demoted to §10 | readiness finding 8, NFR-2, §4.4a |
| 007 | Transport doubles retargeted to the three observed surfaces; oracle gains `--standalone` in argv exactly once | DEC-2, observed mode surfaces |
| 008 | Oracle names the requested/available values through the vocabulary constant and asserts `detail.harness.mode` = requested, `inside` | AC-F2-3, TDR-0031 |
| 009 | Unknown-value case asserts `detail.harness` **absent**; adds the vocabulary↔surface table assertion | TDR-0031, DM-3 |
| 010 | **Split**: feature-spec link, index link and change-artifact link assertions removed; R2-body assertion added | readiness finding 11 (Phase 8 owns the link) |
| 011 | **Retargeted surface**: descriptor/child-environment oracle replaced by recorded invocation argv (`--agent`/`--model` per seat) plus "no `OC_*` added"; observed-model agreement read from the store | DEC-8, OQ-2 closed, NG-10 |
| 012 | Scoped to a variable-consuming harness double; the opencode path is explicitly excluded (its binding is an argument) | DEC-8 |
| 013 | Adds the opencode-side assertion that the environment gains no seat key while the argv carries the binding | DEC-8, AC-F3-3 |
| 014 | Variant 2 becomes surface-expressibility (`provider/model#variant`), variant 3 becomes "not in the injected recognised-model catalogue"; oracle gains `detail.harness.mode` = resolved | AC-F3-4, DEC-8, OQ-11. **Superseded at 1.3**: variant 3 is dropped and the `unassigned` case added (§11.7) |
| 015 | Oracle reads invocation argv/variable per surface instead of `childEnv[SEAT_VAR]` | DEC-8 |
| 016 | Canonical comparison now covers the binding **and** the derived invocation arguments | DEC-8, AC-F4-1 |
| 019 | Fixture rebuilt on `session_v2`/`session_message`; version from `session_v2.version`; `calls` from usage-bearing message count; tool counts now absent-with-warning on the observed store; `records.length >= 1` and zero-row-fails added | DM-10, AC-F5-1 (rewritten) |
| 021 | Adds version divergence (stored vs probed) beside model divergence, and a variant-only normalization control | DM-9, §10 |
| 022 | **Inverted**: durations come from the store pair; absence only when the pair is missing/inverted; adds the legitimate `elapsed === 0` case | AC-F5-4, DM-6 |
| 023 | **Identity deleted**: no `harness.telemetry.absent`, no exit 1, no per-session request. New oracle: absence classified in the capture envelope, `spend.telemetry-absent` read side, delivery exit unchanged, identity absent from every vocabulary | readiness finding 2, AC-F6-1/2 rewritten, DEC-10 |
| 024 | Exit assertion replaced by "unchanged, equal to the paired control" (non-gating); adds the unrecognised-generation variant; `platform-provider` kept only where surfaced as a command failure | AC-F6-2, NFR-11 |
| 025 | **Relaxed deliberately**: bounded per-message metadata reads are permitted when scoped by session id and message type; what remains forbidden is the unbounded scan and any content projection; adds the store-path reconciliation assertion | NFR-3 wording, DM-10 |
| 026 | Adds the reported-zero-cost-with-tokens case (not absence, no warning) | NFR-6, T-03/T-13 |
| 028 | **Replaced subject**: "2.1.x shape" → two observed generations with a two-sided mutant pair; tool counts absent because `part` has no `tool` column | DM-10, NFR-11, GAP-6 |
| 031 | Floor constant renamed `HARNESS_CONFORMANCE_FLOOR_SCENARIOS`; adds the "extension cannot widen the floor" pin | readiness finding 13, AC-F7-1 |
| 032 | Mutated scenario id becomes `version-window`; identity case now asserts the identity→scenario map | DM-7, AC-F7-2 |
| 033 | **Executor made real**: additive `runHarnessConformanceScenario`-shaped executor in the testkit, union split, location assertion, propagation scenario on the invocation surface (both directions) | readiness finding 13, DEC-8 |
| 035 | "five new identities" → **four**; adds the absence-of-`harness.telemetry.absent` assertion and the `detail.harness` pin-move assertions | TDR-0031, DEC-10 |
| 036 | Oracle restated as "no session-bearing child; probe `calls <= 1`, completed and reaped"; adds P-04 (`mode` omitted) | AC-N1-1 amended, TDR-0031 |
| 038 | Mutant list rebuilt: adds `probe-substring-match`, `stamp-raw-probe-line`, `ignore-probe-deadline`, `config-window-widens`, `per-seat-env-family`, `zero-cost-as-absence`, `missing-cost-as-zero`, `work-item-column-query`, `part-tool-query`, `legacy-only-extractor`, `current-only-extractor`, `zero-row-as-pass`; replaces the two absence mutants with **`absence-as-capture-failure`** and **`capture-failure-as-absence`**; removes `widen-window-on-bad-config` | AC-F1-5, DM-10, NFR-11, DEC-9/DEC-10 |
| 040 | Oracle extended to the `detail.harness` member per identity, including the identities that must not carry it, the scripted line, and the six-field error | TDR-0031, §10 |
| 041 | Absorbs the feature-spec link/index/change-reference assertions moved out of 010; page list widened to the telemetry, state, spend, result, dispatch, config and adapter-ports pages | readiness finding 11, TDR-0031 |

### 11.3 Deleted claims and identities (so they cannot be re-added silently)

| Deleted | Where it lived | Replaced by |
|---|---|---|
| Identity `harness.telemetry.absent` (exit 1, no zero row) | Matrix M-06, TC-023, TC-035, TC-038, §1, §3.1–3.3 | Three-way in-envelope taxonomy (TC-023, 024, 044), the delivered `spend.telemetry-absent` read side, non-gating closeout, and an explicit absence-of-identity assertion (TC-035, 023) |
| Synthetic fixture shape (`session.work_item_ref`, `session.harness_version`, per-message token columns, `part.tool`) | §4.1 rule 5, §6 store data, T-01..T-14, TC-019/028 | DM-10 two-generation fixtures (§4.1a), the fixture-DDL scan (TC-043), and the `work-item-column-query` / `part-tool-query` mutants (TC-038) |
| 5 s wall-clock assertion via a fake-clock advance | §4.2 rule 4, TC-006 | Pinned deadline seam (§4.4a) asserted at the seam; wall clock as a §10 reference measurement (GAP-3) |
| `OC_<PREFIX>_AGENT_<SEAT>_MODEL` as the opencode propagation oracle | TC-011, TC-015, §3.1, §4.1 rule 4 | Per-invocation `--agent`/`--model` binding (TC-011, 015, 016) with "no `OC_*` added" asserted |
| "2.1.x-shape" store variant | T-14, TC-028, GAP-6 | Current-generation + legacy-generation fixtures with a two-sided mutant pair; the 2.1.x generation recorded as unobserved (GAP-6) |
| Feature-spec link assertion inside the record-content TC | TC-010 step 4, oracle | TC-041 (documentation phase) |
| `widen-window-on-bad-config` mutant | TC-038 | `config-window-widens` (an invented key cannot change acceptance) |

### 11.4 Coverage arithmetic

- ACs: 26 (AC-F1-1..5, AC-F2-1..4, AC-F3-1..4, AC-F4-1, AC-F5-1..6, AC-F6-1..2, AC-F7-1..3, AC-N1-1) — all mapped in §3.1; none TODO-mapped, three carry a named boundary (GAP-2, GAP-4).
- TCs: 46 (TC-HARNESS-001..046), each appearing in §5.1, §5.2 and §7.
- Matrices: M-01..M-11 (with the `detail.harness` column, P-01..P-04 and the reused-identity M-11 row), V-01..V-19, T-01..T-16, C-01..C-10.
- Gaps: GAP-1..GAP-7; open questions OQ-4..OQ-12 (OQ-6 and OQ-11 closed); inherited spec obligations OQ-4/OQ-5 recorded in §8.3.

### 11.5 What `@plan-writer` must change as a consequence

1. **Re-cut the TC→phase map for 46 TCs** (the plan currently maps 41). Suggested ownership: Phase 1/2 keep TC-010 (now content-only); Phase 3 owns 042's grammar constant half and 005; Phase 4 owns 006 (deadline seam), 001–003, 007–009, 011, 014–018; Phase 5 owns 019–028, 043, 044; Phase 6 owns 029–034, 036, 038, 039 and TC-046 (the structure check rides the gate battery); Phase 7 owns 037, 040; Phase 8 owns 041; TC-045 is a delivery-bound manual obligation recorded in Phase 8 or a dedicated DoD step, never a test-phase gate.
2. **Declare the probe deadline seam** (`contracts/harness.ts` + `harness-registry.ts` + the production probe's runner wiring) in the phase that owns resolution, and change Phase 2's "five refusal identities" wording to four (the fifth is the removed telemetry-absence identity).
3. **Declare the conformance executor and the constant split** in the testkit module (`HARNESS_CONFORMANCE_FLOOR_SCENARIOS`, `HARNESS_CONFORMANCE_EXTENSION_SCENARIOS`, the union type, `runHarnessConformanceScenario`) so Phase 6 can build the scenarios the registry declares.
4. **Declare the fixture modules** in the phase whose tests need them: `tests/fixtures/harness/opencode-store/{current-generation,legacy-generation}.ts`, `tests/checks/fixture-store-shape.test.ts`, and the version/mode/profile fixture modules.
5. **Declare the result-contract file set** TDR-0031 lists (`contracts/result.ts`, `contracts/index.ts`, `cli/src/index.ts`, `cli/src/commands/dispatch.ts`, `testkit/src/result-conformance.ts`, `tests/fixtures/result/envelope-key-set.json`, both type tests, both structure tests, the feature pages) in the phase that moves them.
6. **Declare `packages/core/src/state/harness-telemetry.ts`** in the telemetry phase (the payload allowlist must persist the new fields — readiness finding 3), and add its round trip to that phase's gate.
7. **Declare `tests/structure/inventory.json`** where the new exported constants are added (readiness finding 12).
8. **Declare the store-path reconciliation** (`packages/core/src/config/*` + the adapter's store resolution) in the phase that owns telemetry reads, since TC-025 asserts the resolved path structurally.
9. **Add the three new decision-record obligations**: TDR-0031 is authored and staged in a phase that owns it, and the documentation phase reconciles `feature-result-contract.md` and `feature-dispatch-engine.md` (the latter's "no other dispatch refusal populates it" claim is now false).
10. **Declare the seat-rule consequences (TDR-0032)**: the single-seat binding type and the agent→seat resolution rule (Phase 4), the per-run recorded binding member carried additively on the delivered attempt record (Phase 2/4), the `unassigned` refusal reusing the delivered `provider.profile.invalid` with no error-table row and no `detail.harness` member (Phase 4/7), the role-less `unresolved-seat` disclosure, and `tests/structure/harness-probe-construction-site.test.ts` in the phase whose gate runs `bun test tests/structure` (TC-HARNESS-046, DoD clause 6).

### 11.6 Revision 1.2 — erratum: the four store-shape telemetry suites are owned updates

Revision 1.1 listed `harness-telemetry-opencode`, `harness-telemetry-drift` and `harness-telemetry-opencode-orphan-scope` among the suites "asserted unchanged" in §7 while §4 named `harness-telemetry-opencode` as `(update)`, and it did not say that all four opencode-store suites — including `harness-telemetry-shape` — encode the synthetic store shape (`INSERT INTO session (... work_item_ref, harness_version ...)`, a `work_item_ref IS NULL` orphan-scope predicate, and a zero-warning positive control that the observed store's absent tool source breaks). DM-10, DEC-9 and §17.2 clause 2 require the opposite: fixtures model the observed current generation (`session_v2`/`session_message`) with a legacy-generation variant, attribution has no `work_item_ref` column, and the version comes from `session_v2.version`. This entry removes the contradiction and changes no test case.

| Delivered suite | Status after 1.2 | What changes in it |
|---|---|---|
| `tests/behaviour/harness-telemetry-shape.test.ts` | **Owned update** (telemetry phase) | Fixtures re-derived from the DM-10 builders; shape assertions restated on the observed field inventory |
| `tests/behaviour/harness-telemetry-opencode.test.ts` | **Owned update** (telemetry phase) | Fabricated columns removed; version read from `session_v2.version`; tool counts absent with the declared warning where the store has no tool source |
| `tests/behaviour/harness-telemetry-opencode-orphan-scope.test.ts` | **Owned update** (telemetry phase) | Attribution by the held session identity and the store's parent links; the orphan-scope predicate re-expressed without a work-item column |
| `tests/behaviour/harness-telemetry-drift.test.ts` | **Owned update** (telemetry phase) | Its zero-warning positive control carries the declared tool-source absence instead of assuming a populated tool source |
| Every other delivered control named in §7 | **Unchanged** (regression half only) | Nothing: `harness-classification`, `harness-liveness`, `harness-spawn-env`, `harness-spawn-credential`, `harness-default-path`, `harness-opencode-stream`, `harness-opencode-resume-stream`, `harness-host-stream`, `harness-stream-hygiene`, `harness-telemetry-claude`, `harness-telemetry-claude-budget`, `harness-closeout-*`, `dispatch-harness-*`, `harness-ci-parity`, the delivered spend read-side suites, and the six-id conformance floor (TC-HARNESS-031) |

No TC's oracle, identity, exit, bound or AC/NFR mapping moved at revision 1.2, and no TC was added or removed: at that revision the count stayed at forty-five and the delivered six-scenario conformance floor stayed exact.

### 11.7 Revision 1.3 — readiness iteration 2 finding C2: one seat per spawn

The spec's remediation pinned the seat rule to TDR-0032/DEC-13. This revision makes every test oracle agree with it. **No TC id changed and no TC was removed**; one is added (046), so the count is forty-six. The table records every delta that touched a TC's oracle, identity, exit, bound or AC/NFR mapping; the restatements in §3/§4/§8 are listed after it and change no TC mapping.

| TC | What changed in 1.3 | Why |
|---|---|---|
| 011 | **Oracle re-cut**: three spawns (`calls === 3`), three sessions and three row sets; per invocation exactly one `--agent` (the agent identity, never the seat name) and one `--model` equal to that seat's resolved model; no invocation carries two of either; the binding is single-seat; observed model `===` resolved per session (3/3); distinct `seat` values; the "no invented `OC_*` family" half kept | readiness iteration 2 C2; TDR-0032 cardinality/resolution/carrier |
| 014 | Dropped the unrecognised-model variant (DEC-14); added the `unassigned` case: reused `provider.profile.invalid`, agent/profile/seats in the bounded `error.summary` plus remediation hint, **no** `detail.harness` member, `HARNESS_FAILURE_CODES` unchanged, zero sessions/attempts/rows | TDR-0032 decision 2 + Amendment A-2; DEC-14 |
| 015 | Two successive spawns naming different agents bind their own seats (per-spawn, not process-global); added the role-less control against a multi-seat **and** a single-seat profile: no `--agent`/`--model`, no recorded binding, null seat with `unresolved-seat`, observed agent/model still reported | TDR-0032 Amendment A-1 |
| 016 | Resume reuses the spawn's single binding and seat; spawn/deliver/resume each carry exactly one pair; a resume never adds a seat (binding count and seat-set cardinality unchanged) | TDR-0032 decision 1/2 |
| 019 | Seat and resolved model sourced from the run's recorded binding (never the store's `agent` or a profile re-derivation); `agentRole` asserted from the observed agent; added group scoping (observed agent ≠ binding agent ⇒ null seat + `unresolved-seat` + agent-divergence warning) | DM-4/DM-5, AC-F5-1/AC-F5-3, TDR-0032 decision 4 |
| 021 | Added agent divergence beside model and version divergence: both values kept, closed-vocabulary warning, seat null with `unresolved-seat` for the differing group; the agreeing pair keeps the binding's seat | AC-F5-3, TDR-0032 decision 4 |
| 036 | Added the `unassigned` (M-11) refusal to the side-effect matrix: zero sessions, zero attempt records, zero rows, no `detail.harness` member | AC-N1-1, TDR-0032 Amendment A-2 |
| 040 | Split the §10 disclosure assertions: success path = attempt record **and** envelope; pre-session refusal = `detail.harness` only, with zero attempt records asserted per refusal | spec §10, TDR-0031 |
| 043 | Attribution from **all** held session identities (one per spawn/resume) plus the recorded binding; the binding-to-session mapping asserted; no seat re-derivation; the no-work-item-column and no-scan assertions kept | spec §5.1 F-5, DM-8, AC-F5-5 |
| 045 | Precondition: the observation invocation names an agent; a role-less run is recorded as an unresolved-seat observation and never accepted as propagation proof; a deferral requires recorded human/PM acceptance, and only AC-F5-6 and the live half of AC-F3-1 are deferrable | spec §17.2 clauses 1 and 4 |
| 046 | **New**: offline structure check pinning exactly one production probe construction site, with a second-site mutant that must fail | spec §17.2 clause 6 |

**Non-TC restatements (no oracle or mapping moved).** The pinned-scenario row for TC-M3-HARNESS-001 now states N spawns/N sessions/N row sets and per-invocation single-pair equality; §3.1/§3.2 restate AC-F3-1, AC-F3-4, AC-F5-1, AC-F5-3, AC-F5-5 and DM-4/DM-5/DM-8 to the recorded-binding source, group scoping and the agent axis; §3.1's AC-F1-1 and AC-F1-5 rows gain TC-HARNESS-046, the DoD clause-6 traceability the spec names (coverage added, not a mapping moved); §3.3/§3.4, §4.1 rule 4, §4.1a, §4.2 rule 5, §4.3 (M-05 narrowed, M-11 added), §4.4a(e), §4.5 (T-05/T-07), §6, §7, §8.1/§8.2/§8.3, GAP-1/GAP-2/GAP-5, OQ-11 and the front-matter summary follow the same rule.

**Unchanged by 1.3.** Every other TC keeps its oracle, identity, exit, bound and AC/NFR mapping; the pinned TC-M3-HARNESS-002 row, the four-id conformance extension, the six-id floor, the three-way absence taxonomy and the nine delivered identities are untouched; the live observation remains human-gated and outside `bun test`.

**Revision 1.4 — the named-agent half of TDR-0032's third resolution step.** One row; no TC id, oracle elsewhere, count, or AC mapping moved. The plan stays at forty-six TCs and 26/26 AC coverage.

| TC | What changed in 1.4 | Why |
|---|---|---|
| 015 | **Extended in place** (id and its existing per-spawn and role-less cases unchanged): a spawn naming the one agent a **single-seat** profile assigns must resolve that agent to the sole seat — exactly one `--agent <agent identity>` (never the seat name where the two differ), exactly one `--model` equal to that seat's resolved model, and the binding recorded — while the role-less control against the **same** single-seat fixture still binds nothing (zero `--agent`/`--model`, no recorded binding, null seat with the `unresolved-seat` reason). Naming is the only variable between the two runs, so a resolver keyed off the seat count fails either way | TDR-0032 resolution step 3 (single-declared-seat fallback) had no dedicated oracle: TC-015 covered only the role-less single-seat control, so "a named agent resolves to the sole seat, and the seat name never reaches argv" was unproven |
