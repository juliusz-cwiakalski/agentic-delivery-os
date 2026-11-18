---
id: TDR-0032
decision_type: tdr
status: Proposed
created: 2026-11-18
decision_date: null
last_updated: 2026-11-18
summary: "One harness spawn binds exactly one seat: a per-spawn binding names the agent identity the invocation already carries (the value passed to `run --agent`, recorded by the store as the session agent and reported by spend as the role), the profile seat resolved for that agent through the delivered `agentOverrides` map, and that seat's resolved model; the adapter expresses it as exactly one `--agent` and one `--model provider/model[#variant]` on the surface opencode honours, with N seats requiring N spawns and therefore N sessions and N telemetry rows, with no configuration-document carrier, no second child process, and no widened environment; a named agent with no seat assignment refuses pre-session through the existing `provider.profile.invalid` identity, a spawn that names no agent binds nothing and is disclosed as an unresolved seat, and every row keeps the recorded seat and resolved model beside the harness-reported agent and model with divergence disclosed and neither value overwritten."
owners:
  - "Juliusz Ćwiąkalski"
service: "delivery-os harness plane (per-spawn profile binding, opencode invocation mapping, seat-attributed telemetry identity)"
decision_scope: repo
review_date: null
classification:
  domains: [architecture, contracts, telemetry]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: easy
  stakes: high
  urgency: high
  uncertainty: low
  blast_radius: team
  recurrence: one-off
governance:
  driver: "@decision-advisor (GH-335 readiness iteration 2, findings C1 and C2: the change requires N seats to be expressed but never defines which seat a spawn is bound to, and TC-HARNESS-011 asserts three flag pairs on one invocation that the single-valued CLI cannot accept)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-335 PR review; AI does not accept this R2 record"
  contributors:
    - "@spec-writer (chg-GH-335-spec §4.1 propagation metric, §5.1 F-3/F-5, §6 Flow 2, §8.3 DM-4/DM-5/DM-8, §17 AC-F3-1/AC-F3-4/AC-F5-1/AC-F5-5, DEC-5/DEC-8)"
    - "@test-plan-writer (chg-GH-335-test-plan §3.1 pinned-scenario matrix, §5.2 TC-HARNESS-011)"
    - "@plan-writer (chg-GH-335-plan Phase 2/3/4/5 propagation and seat-attribution scope)"
    - "@readiness-reviewer (readiness iteration 2, findings C1, C2 and M3)"
    - "@decision-advisor (repository and harness observation, this record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-335 PR review — this record restates the change's headline acceptance criterion)"
  performers:
    - "@coder (GH-335: single-seat binding type, the agent→seat resolution rule, the one-pair argv mapping, the unassigned-agent refusal, the binding recorded per run, seat-attributed rows)"
    - "@doc-syncer (GH-335 documentation phase: the harness adapters, telemetry and spend pages)"
  informed:
    - "M3-S5 conformance and parity suite (the propagation scenario it extends)"
    - "Every future harness adapter (the binding contract is harness-neutral; only the surface mapping is adapter-local)"
    - "Operators declaring multi-seat provider profiles (a role-less dispatch no longer implies an arbitrary seat)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "The generic `dispatch` path declares an agent role (for example a `dispatch --agent` value flag, or a declared harness agent default): that input becomes the binding's agent identity, and the role-less path's `unresolved-seat` disclosure narrows to the residual case only — a declared-agent dispatch replaces the disclosure rule and TC-011's no-binding control."
  - "A delivery needs several seats inside one dispatch call: that is a change to the dispatch run contract (one attempt, one lease, one held session identity) and is decided separately, never by widening a binding to carry a seat map."
  - "The harness gains a genuinely multi-valued selection surface (a repeated `--agent`, a seat map, or a per-agent model variable family it consumes): the cardinality rule is re-decided against that surface, and only then may a single spawn carry more than one seat."
  - "A spawn's recorded binding is proposed to be rebuilt at capture time from the current profile rather than read from the run's record: that reintroduces attribution to a resolve-time input the run never declared, and is refused; the recorded binding stays the only source."
  - "`delivery.harness.telemetry.v1` is bumped or the row grain changes away from one row per (session, agent, model) group: the seat/resolved-model members move with the grain and are re-decided."
  - "The harness stops honouring `run --agent`/`run --model` inside the supported window: the surface mapping — not the cardinality rule — is what reopens, and the window is what refuses."
links:
  related_changes: ["GH-335"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-17--GH-335--opencode-harness-telemetry/chg-GH-335-spec.md"
    - "doc/changes/2026-11/2026-11-17--GH-335--opencode-harness-telemetry/chg-GH-335-test-plan.md"
    - "doc/spec/features/feature-harness-adapters.md"
    - "doc/spec/features/feature-provider-profiles.md"
    - "doc/spec/features/feature-telemetry-v2.md"
    - "doc/spec/features/feature-spend.md"
    - "doc/spec/features/feature-dispatch-engine.md"
  contracts:
    - "packages/core/src/contracts/harness.ts"
    - "packages/core/src/contracts/telemetry.ts"
    - "packages/core/src/contracts/dispatch.ts"
    - "packages/core/src/provider/profile.ts"
    - "packages/core/src/provider/profile-env-record.ts"
    - "packages/adapters/src/harness/opencode.ts"
    - "packages/cli/src/production.ts"
    - "packages/cli/src/commands/dispatch.ts"
  diagrams: []
  decisions: ["ADR-0008", "TDR-0016", "TDR-0021", "TDR-0033"]
  experiments: []
  metrics: []
  roadmap_items: ["M3-S1"]
---

# TDR-0032: Harness Seat–Spawn Cardinality, Seat Resolution, and Per-Seat Telemetry Identity

## Context

GH-335 (milestone story M3-S1) must make an opencode v2.x dispatch "run with the resolved profile" and land telemetry rows "with schema version and per-seat models". The delivered propagation contract is surface-mapped (spec DEC-8): for opencode the honoured surface is the per-invocation agent/model selection. Readiness iteration 2 established that the artifacts never say **which** seat a spawn is bound to, and that the test which carries the pinned blueprint scenario asserts a spawn shape the harness cannot accept.

- **FACT:** The installed harness accepts exactly one agent and one model per invocation — `opencode run --help` (observed 2026-11-18) lists `--agent string` ("Agent to use") and `--model, -m string` ("Model to use in the format `provider/model#variant`"); both are single-valued, and no repeated-flag or seat-map form exists.
- **FACT:** The store holds exactly one agent and one model per session row: `session_v2` carries `agent` and a structured `model {id, providerID, variant}`, and its distinct `agent` values are the delivery's own role names — `committer` 3 365 rows, `runner` 2 730, `coder` 1 206, `spec-writer` 609, `test-plan-writer` 499, `reviewer` 493, `plan-writer` 453, `ceo` 450, `readiness-reviewer` 445, `pr-manager` 357, `pm` 350 (read-only query over `~/.local/share/opencode/opencode.db` with `PRAGMA query_only=ON`, 2026-11-18).
- **FACT:** A session can nevertheless span more than one agent/model pair mid-session: `session_message` carries `agent-switched` (871 at Appendix C, 873 at readiness iteration 2) and `model-switched` (37) events, and the delivered telemetry grouping already emits one record per `(session, agent, model)` group so a session's groups are not collapsed (`doc/spec/features/feature-harness-adapters.md` §5).
- **FACT:** The delivered spawn input has no place for an agent or a binding: `HarnessSpawnInput` is exactly `{ workItemRef, prompt, descriptor }` (`packages/core/src/contracts/harness.ts:268-272`), and the production composition passes `spawnArgs: ["run", "--format", "json"]` — no `--agent`, no `--model` (`packages/cli/src/production.ts:1540`, read 2026-11-18).
- **FACT:** The delivery's real entry points already launch exactly one named agent per invitation: `opencode run --agent pm --session …` (`scripts/deliver-ticket.sh:1740,1743`), `opencode run --agent ceo …` (`scripts/ceo-loop.sh:559,561`), and `opencode run --format json --agent "${TICKET_AGENT}" …` (`scripts/opencode-session.sh:337`, read 2026-11-18).
- **FACT:** The provider-profile plane already declares the agent→seat relation and its selection rule: `agentOverrides: Record<agent, seat>`, and `targetSeatName(profile, agent)` returns the override, else the seat bearing that name, else the alphabetically first declared seat (`packages/core/src/provider/profile.ts:122-130`). Selection yields `seatModels` (pacing-applied) and `seats`; `resolveProfileForSpawn` builds the per-seat environment record for **all** seats (`packages/core/src/provider/profile.ts:476-499`).
- **FACT:** A seat's `model` is validated only as a non-empty string — no grammar check (`packages/core/src/provider/validate.ts:501-502`), so a resolved model that cannot be expressed as `provider/model[#variant]` is reachable from valid configuration.
- **FACT:** The delivered telemetry step record already carries `agentRole` and `model` beside `sessionId` and `harnessVersion` (`packages/core/src/contracts/telemetry.ts:211-230`), and `spend` reports a `role` breakdown dimension drawn from the harness-reported agent (`doc/spec/features/feature-spend.md` §5).
- **FACT:** A dispatch attempt appends exactly one attempt record and spawns exactly one session; the nomination port returns only the profile name (`packages/core/src/app/dispatch.ts:531,707-712`; `DispatchNomination { profile }`).
- **FACT:** `provider.profile.invalid` is an existing closed identity meaning "The provider profile configuration is invalid", remediation "Correct the named profile, tier, seat, chain entry, or pacing value and retry" (`packages/core/src/contracts/error-table.ts:218-226`).
- **FACT:** The spec's own observability section already requires disclosing unresolved seats ("Per-seat attribution discloses unresolved seats, model divergence, and version divergence with counts and reasons"), yet no artifact defines when a seat can be unresolved — the same missing rule from the other side.
- **FACT:** The change's definition of side-effect freedom permits exactly one pre-session child — the bounded version probe (AC-N1-1, NFR-1, §17.2 clause 6); a catalogue read through `opencode debug agents` would be a second child and is therefore unavailable to a representability check (readiness iteration 2, finding 6).
- **Why now:** the readiness gate blocks delivery on this gap (findings C1, C2). The headline acceptance criterion, the pinned blueprint scenario TC-M3-HARNESS-001, the test-plan oracle, and the plan's Phase-4 argv mapping all depend on the answer, and Phase 4 cannot start without it.

## Problem Framing (Clarified)

The harness's selection surface is single-valued, the store's session row is single-valued, and the delivery's operations are already single-valued per invocation (each scripted launch names one role). The spec asks for "per-seat models" plural, and its metrics, data model and acceptance criteria were written as if one spawn could carry a whole profile. Those two statements cannot both be true, and the artifacts never chose one — so the requirement is undecidable and the test that claims to prove it fabricates the invocation shape.

The question is therefore not "how do we send N models at once", but **"what is the unit of a seat, and what may one invocation truthfully claim?"**

Root cause versus symptom: the symptom is a test asserting three `--agent`/`--model` pairs on one spawn; the cause is that seat identity was never separated from the invocation. Four distinct questions are tangled together and this record separates them:

1. **Cardinality** — how many seats may one spawn carry.
2. **Resolution** — which seat a given spawn is for, and what names it.
3. **Carrier** — which argv field carries which resolved fact.
4. **Telemetry identity** — what a row must state so that "the session ran the resolved model for seat S" is provable, and which side is authoritative when the profile and the store disagree.

A fifth consequence follows: a delivery that needs several seats needs several spawns, which changes the attribution key from "the session identity" to "the session identities the run holds".

Deliberately out of scope, so the boundary is reviewable: no harness configuration document is authored or read for model selection (NG-5, NG-10); no second pre-session child process (AC-N1-1); no new CLI command or value flag; no provider-profile schema change (NG-6); no telemetry schema bump (DEC-4); no dispatch run-contract change that would let one attempt hold several sessions.

## Constraints (Hard Requirements)

### C-1: Every expressed binding must be one the invocation can truthfully claim

- **Statement:** A spawn expresses a seat only when (a) the spawn names an agent identity and (b) the resolved profile assigns that agent a seat; the values sent are that agent's identity and that seat's resolved model. No seat is inferred for an unnamed agent — **whatever the profile's seat count** — and no first-declared seat is presented as the run's seat.
- **Source:** AC (`chg-GH-335-spec.md` §4.1 propagation metric, AC-F3-1, DEC-6, DEC-8) + product intent (the ticket's "runs with the resolved profile")
- **Verification:** test (argv equality per seat; a role-less spawn emits no `--agent`/`--model` and records an unresolved seat) + code review
- **Negotiable:** no

### C-2: The binding rides only the surface the harness honours, and nothing else

- **Statement:** The binding reaches the child as invocation arguments (one `--agent`, one `--model`) and, for a harness that consumes declared variables, as record values for already-declared names. No harness configuration document is authored, no harness store or configuration is written, no second child process is started for a catalogue or a configuration read, and the declared environment allowlist is neither widened nor mutated.
- **Source:** AC (`§7.2 [OUT]` harness-side configuration mutation; NG-5, NG-10, AC-F3-2, AC-F3-3) + AC-N1-1/NFR-1 (single bounded probe exception) + observed surface (`opencode run --help`)
- **Verification:** test (child environment key-set equality; zero additional spawn invocations on the pre-session path; no configuration-document argument or env input carrying model values) + code review
- **Negotiable:** no

### C-3: Telemetry states what was requested and what ran, without fabrication or overwrite

- **Statement:** A row carries the run's recorded seat and resolved model beside the harness-reported agent and model; divergence on either axis is disclosed with a closed warning and both values are kept. A fact the store does not hold is null with a warning; a seat the run never declared is null with `unresolved-seat`; no seat, model, or divergence is fabricated, and no value is reconciled by overwriting the other.
- **Source:** AC (NFR-6, DEC-5, AC-F5-1, AC-F5-3, §10) + prior decision (TDR-0033's no-fabrication discipline)
- **Verification:** test (per-row field equality; a divergent row keeps both values and warns; an unbound run yields null seat plus the warning and never a guessed seat) + code review
- **Negotiable:** no

### C-4: `delivery.harness.telemetry.v1` stays the identity and the additions are additive

- **Statement:** Seat, resolved model, and the existing observed agent/model are added as fields; nothing is removed or renamed; pre-change rows read unchanged; the row grain stays one record per `(session, agent, model)` group.
- **Source:** AC (DEC-4, AC-F5-2, NG-3)
- **Verification:** test (pre-change row round-trip; schema identifier constant; key-set additions only) + code review
- **Negotiable:** no

### C-5: Delivered port, dispatch, and command surfaces stay valid

- **Statement:** `HarnessSpawnInput`, `HarnessResumeInput`, `HarnessSessionPort`, `DispatchPorts` and the `dispatch` command's flag set keep their members and meaning; the agent-identity member, the binding member, and the recorded binding are additive optional data; no new command, verb, exit projection, or required user input appears; one dispatch attempt still holds one lease and one attempt record.
- **Source:** AC (§8.5 backward compatibility, NG-9, §17.2 clause 12)
- **Verification:** test (existing port and dispatch suites green unchanged; the delivered flag grammar rejects nothing new) + code review
- **Negotiable:** no

### C-6: Refusals stay pre-session and the closed identity set is not widened by this decision

- **Statement:** An unassigned agent refuses before any session-bearing child exists and appends no attempt record, reusing an existing closed identity whose disclosure rides the delivered bounded error summary plus that identity's remediation hint; this record adds no error-table row, no `detail.harness` member mapping, and no change to the failure-envelope shape.
- **Source:** AC (AC-N1-1, NFR-1, DEC-12) + prior decision (TDR-0033 decision 2 and its identity mapping)
- **Verification:** test (zero sessions, zero attempts, zero telemetry rows on the refusal; `HARNESS_FAILURE_CODES` length unchanged) + code review
- **Negotiable:** no

**Table stakes.** No new package, dependency, workspace subpath, state schema version, or configuration key; determinism and the redaction chokepoint are unchanged; no conversation content is read. Every alternative below satisfies these, so they eliminate nothing.

## Decision Drivers

1. **Provability of the headline claim.** The ticket's "runs with the resolved profile" is only meaningful if the value the profile resolved is the value the invocation carried and the session reported. The binding must be expressible on the surface that runs, and the row must show the resolved/observed pair.
2. **Honest attribution.** Cost, tokens, and time belong to the seat that produced them, or to an explicit absence. A seat chosen by a fallback the run never declared is a wrong attribution dressed as a measurement, and the learning plane consumes these figures as facts.
3. **The paved road and the least surface.** One `--agent` and one `--model` on the surface opencode honours, additive members on delivered shapes, no new command, no authored harness configuration, no second child process.
4. **Fit with the delivery model that actually runs.** The delivery already launches one named role per invocation (`pm`, `ceo`, `coder`, `committer`, …) and the store already records one agent per session. A cardinality rule that matches that model needs no new orchestration.
5. **A truthful, offline-testable oracle.** The test must assert what production sends to a real argv, so a recording double cannot make an invalid invocation green.
6. **Reversibility and low ceremony.** The rule is a contract statement plus additive fields; abandoning it restores the prior shapes with no migration.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` — GH-335's readiness iteration 2 findings C1/C2 route the seat rule to a record before Phase 4 starts.
- **Decider / Approver:** Juliusz Ćwiąkalski at the GH-335 PR review. AI does not accept this R2 record; it stays `Proposed` until a human decides.
- **Contributors:** `@spec-writer` (propagation metric, F-3, DM-4/DM-5/DM-8, AC-F3-1/AC-F5-1/AC-F5-5), `@test-plan-writer` (TC-HARNESS-011 oracle), `@plan-writer` (Phase 2–5 scope), `@readiness-reviewer` (the findings), `@decision-advisor` (harness and repository observation, this record).
- **Required reviewers:** `@readiness-reviewer`, `@reviewer`, and the human owner (the record restates the change's headline acceptance criterion).
- **Performers:** `@coder` (single-seat binding, agent→seat resolution, one-pair argv mapping, unassigned-agent refusal, per-run recorded binding, seat-attributed rows); `@doc-syncer` (harness adapters, telemetry, spend, dispatch-engine pages).
- **Informed:** M3-S5 conformance and parity suite; every future harness adapter; operators declaring multi-seat profiles.

**Type note.** This is a TDR, following TDR-0016/TDR-0021 for harness-contract governance and TDR-0033 for the same change's adjacent contract detail. The ADR/TDR tie-breaker prefers ADR at `blast_radius >= team`; here the architecture-level question ("is propagation surface-mapped, and is the binding a harness-neutral record?") was decided by ADR-0008 and spec DEC-8, and is not reopened — this record fixes the cardinality, the resolution input, and the row identity *inside* that decided shape, so the narrower type is the paved road. Rigor is R2, not R1: the rule governs the change's headline acceptance criterion, the adapter contract, the telemetry row identity, and a new per-run record member, and it sets the precedent for every later adapter; it is not R3 because every load-bearing fact is repo-local or directly observed read-only, the change is reversible by deleting additive fields, and nothing irreversible, legal, financial, or safety-critical is involved.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|---|---|---|---|---|
| `run` accepts exactly one `--agent` and one `--model`, the latter in `provider/model#variant` form, and no repeated or map-valued form. | FACT | `opencode run --help`, observed 2026-11-18; spec Appendix C.1 | A multi-seat invocation surface would exist and the cardinality rule would be re-decided. | High |
| A `session_v2` row holds exactly one agent and one model, and its agent values are the delivery's role names. | FACT | Read-only `sqlite3` query with `PRAGMA query_only=ON`, 2026-11-18 | If a session could hold N seats as columns, a single spawn could be attributed per seat without N sessions. | High |
| A session can still span several agent/model groups mid-session through switch events, and the delivered grouping keeps every group. | FACT | Appendix C.1 (`agent-switched` 871, `model-switched` 37); `feature-harness-adapters.md` §5 | Rows for a switched group would need no distinct attribution rule. | High |
| The delivered spawn input carries no agent or binding, and the production composition passes no `--agent`/`--model`. | FACT | `packages/core/src/contracts/harness.ts:268-272`; `packages/cli/src/production.ts:1540` (read 2026-11-18) | The binding would already have a home and C-5's additive framing would be wrong. | High |
| The delivery entry points already launch one named agent per invocation. | FACT | `scripts/deliver-ticket.sh:1740,1743`; `scripts/ceo-loop.sh:559,561`; `scripts/opencode-session.sh:337` (read 2026-11-18) | The "one role per run" model would be an aspiration rather than observed practice, weakening driver 4. | High |
| The profile plane declares `agentOverrides: agent → seat` and resolves a target seat through that map. | FACT | `packages/core/src/provider/profile.ts:122-130`; `packages/core/src/contracts/provider-profile.ts:133` | Seat resolution would need a new mapping authored somewhere. | High |
| A seat's `model` is validated only as a non-empty string, so an inexpressible model is reachable from valid configuration. | FACT | `packages/core/src/provider/validate.ts:501-502` | The representability refusal would be unreachable and AC-F3-4's first half would be vacuous. | High |
| The telemetry step record already carries `agentRole` and `model`, and `spend` reports the harness agent as `role`. | FACT | `packages/core/src/contracts/telemetry.ts:211-230`; `feature-spend.md` §5 | The row would need a new field for the harness-reported agent as well. | High |
| An unassigned-agent refusal can reuse a closed identity without a new error-table row. | FACT | `packages/core/src/contracts/error-table.ts:218-226` (`provider.profile.invalid`, remediation names the seat) | A fifth harness identity would be needed and DEC-12's count would change. | High |
| An in-window harness refuses an `--agent` name it does not know rather than silently running a different agent. | ASSUMPTION | No direct probe was run (it would create a session); the store's agent column always matches a role the scripts pass | If false, an unknown agent runs the harness default and the row's observed agent diverges from the binding agent — which this decision's agent-divergence warning discloses, so the failure stays visible rather than silent. | Medium |
| Operators' profile models are already `provider/model`-shaped in practice. | ASSUMPTION | Profiles ship empty (`config/defaults.ts:37`); no operator profile data in-repo; observed store models are `providerID` + `id` pairs | A non-conforming model string would refuse with `harness.profile.model-unrepresentable`, which is the intended, actionable outcome. | Medium |
| The store's session `agent` equals the `--agent` value the invocation carried. | ASSUMPTION | Role-named sessions and the scripts' `--agent` usage; not proven by a controlled experiment | A divergence would surface as an agent-divergence warning on every affected row; the binding stays authoritative for the seat. | Medium |
| Whether the generic TS `dispatch` will declare an agent role, so that its spawns can carry a binding at all. | TO-CONFIRM | Delivered `dispatch` passes no agent and its prompt is role-neutral (`production.ts:2164`) | Until it does, its spawns bind nothing and are disclosed as unresolved seats — the honest state, but the headline AC is proven on agent-naming invocations only. (owner: `@pm` / `@spec-writer`) | Medium |
| Whether the operator's models declare a variant in `#variant` form. | TO-CONFIRM | Observed `session_v2.model` objects carry `id`/`providerID` and no variant in the sampled rows | Only the `#variant` half of the carrier mapping is affected; a variant-less model is expressed without `#`. | Medium |

## Mental Models & Techniques Used

- **First principles:** What must be true for "this session ran the resolved model for seat S"? (i) one invocation carried one selection, (ii) the profile assigned that selection to S, (iii) the store can report what actually ran, (iv) the row keeps both claims. The harness surface forces (i) to be singular; nothing can make (i) plural, so the requirement must be restated at the row/session grain rather than the spawn grain.
- **Inversion:** What makes this dangerous? A test that asserts three flag pairs against a recording double, which ships green while production sends an invalid argv (the readiness gate's finding). A row that reports the profile's model as if the harness had confirmed it, destroying the only evidence propagation failed. A seat picked by fallback so cost lands on a seat nobody chose. A refusal that starts a session anyway. Each failure mode is closed by an explicit constraint above.
- **Second-order thinking:** Making the binding single-seat turns "per-seat telemetry" into an emergent property of the delivery model (one role per invocation) rather than a new orchestration feature. The same choice makes the later "one dispatch, several seats" question a dispatch-contract decision instead of an adapter retrofit.
- **Systems thinking:** The chain is profile resolution → binding → argv → harness session → store row → telemetry row → spend. Each link can silently substitute a different value; the decision pins the two joins that matter (binding↔argv, and binding↔row group) and makes every other mismatch a warning instead of a substitution.
- **Opportunity cost:** The configuration-document carrier buys multi-seat-in-one-session at the price of authoring harness configuration per spawn, a second model source of truth, an extra child process for the catalogue, and privacy exposure of configuration values — for a capability the delivery model does not need.
- **KISS / paved road:** Reuse the identity the invocation already carries, the mapping the profile already declares, the argv fields the harness already documents, and the row fields the record already holds; add two additive input members — the caller's agent identity and the resolver's single-seat binding — and one recorded binding.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

Legend: ✅ passes · ❌ fails. Every constraint is `negotiable: no`, so no accepted-risk exception exists and no driver score rescues a failing option.

| | C-1 truthful binding | C-2 honoured surface only | C-3 no fabrication/overwrite | C-4 additive v1 | C-5 delivered surfaces | C-6 pre-session, closed identities |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 leave the rule undefined | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| ALT-1 N seats via the harness configuration document | ❌ | ❌ | ⚠️ (overwrite-prone) | ✅ | ✅ | ✅ |
| ALT-2 one seat per spawn, seat chosen by the delivered first-declared fallback | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| ALT-3 one seat per spawn, seat resolved from the spawn's agent identity (selected) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-4 one dispatch call spawns one session per seat | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |

### Alternative 0 — Do Nothing: Leave the Cardinality Undefined and Keep the Current Oracles

- **Eligibility:** Not eligible (fails C-1, C-3).
- **Summary:** Ship the spec as written; let "per-seat models" mean whatever the implementer infers; keep TC-HARNESS-011 asserting three flag pairs on one spawn with `calls === 1`.
- **Constraint compliance:** Passes C-2, C-4, C-5, C-6 (nothing moves). Fails C-1: no invocation can express N seats, so the criterion cannot be satisfied by any implementation and no binding can be "the seat's" without a rule. Fails C-3: without a seat source, a row must either omit the seat (unattributed, contradicting AC-F5-1) or take it from the session agent (a different identity than the profile seat) and present it as the seat.
- **Driver fit:** Best on driver 6; fails driver 1 (the acceptance criterion stays unprovable), driver 2 (attribution stays undefined), and driver 5 (the oracle asserts a shape production cannot send).
- **Pros:** No artifact or code change.
- **Cons:** The critical readiness findings persist; the suite would go green while the delivered argv is invalid — the exact vacuity class this change exists to remove.
- **Why rejected:** It is the absence of the decision the gate blocks on.

### Alternative 1 — Carry N Seats in One Spawn Through the Harness Configuration Document

- **Eligibility:** Not eligible (fails C-2; C-3 via accepted-risk reasoning that is unavailable because C-3 is `negotiable: no`).
- **Summary:** Keep one spawn per run and supply a per-spawn configuration document (`OPENCODE_CONFIG_CONTENT` or a generated `OPENCODE_CONFIG_DIR` file) that assigns each agent its seat model, so the single session can run any of the profile's seats and `opencode debug agents` can be used to confirm the mapping.
- **Constraint compliance:** Fails C-2: it authors harness configuration per spawn (NG-5's prohibition, extended by NG-10 to the model-selection surface), and confirming the mapping requires `opencode debug agents` — a second pre-session child that AC-N1-1's single-probe exception forbids (readiness iteration 2, finding M3). Fails C-1: the configuration document is not the invocation surface the criterion names, and the invocation still selects one agent, so "the spawn carries the seat's resolved binding" is still not a statement about what ran. C-3 is at risk because a row's seat would be assumed from the document rather than observed, inviting a resolved-as-observed substitution. Passes C-4, C-5, C-6.
- **Driver fit:** Fails drivers 1, 2, 3 and 5; it is attractive only on a hypothetical driver ("one session should see the whole profile").
- **Pros:** A single session could switch between seats; no cardinality restatement needed.
- **Cons:** A second source of model truth (the document) beside the profile; per-spawn document authoring is harness-configuration mutation by another name; privacy exposure of configuration values that NFR-5 excludes from telemetry; catalogue confirmation costs a forbidden child process; and the store would still record one agent/model per row, so per-seat rows would still need the switch-event path.
- **Why rejected:** It buys a capability the delivery model does not need by violating the two hard constraints this change is built on.

### Alternative 2 — One Seat per Spawn, Seat Chosen by the Delivered First-Declared Fallback

- **Eligibility:** Not eligible (fails C-1, C-3).
- **Summary:** Keep one seat per spawn; derive it with the delivered `targetSeatName(profile, undefined)`, which returns the alphabetically first declared seat whenever the spawn names no agent. Express that seat's model with `--model` (and optionally `--agent <seat>`).
- **Constraint compliance:** Fails C-1: no agent identity is named, so nothing ties the run to that seat; the first-declared seat is a resolution convenience, not a claim about which responsibility group produced the work (`targetSeatName`'s own docstring calls it "the first seat", and `provider profile resolve` uses it to answer "what would this agent's seat be", not "which seat was this run"). Fails C-3: a row would attribute cost and tokens to that arbitrary seat, which is a fabricated attribution; conversely `--agent <seat name>` would send a seat name that may not be a harness agent name at all, producing a spawn failure that looks like a harness defect. Passes C-2, C-4, C-5, C-6.
- **Driver fit:** Serves driver 3 and driver 6; fails driver 1 (the claim is unverifiable), driver 2 (wrong attribution), driver 4 (contradicts the one-named-role practice) and driver 5 (a green test proves nothing about the run's seat).
- **Pros:** No new input anywhere; immediate and deterministic.
- **Cons:** Silent misattribution is exactly the defect class the ticket names ("a profile can be silently ignored"); a seat name is not a harness agent name, so the mapping would also be wrong on the carrier.
- **Why rejected:** Determinism is not honesty; this option makes the row's seat a guess with a confident face.

### Alternative 3 — Selected: One Seat per Spawn, Resolved From the Spawn's Agent Identity

- **Eligibility:** Eligible.
- **Summary:** A spawn may carry exactly one seat. The binding names the agent identity the invocation carries, the profile seat resolved for that agent, and that seat's resolved model. The adapter emits exactly one `--agent <agent>` and one `--model <provider>/<model>[#<variant>]`. N seats are N spawns.
- **Constraint compliance:** Passes C-1 … C-6 (matrix above). Table stakes are satisfied trivially.
- **Driver fit:** Best on drivers 1, 2, 4 and 5; driver 3 is satisfied by using only the documented argv fields; driver 6 holds because deletion of the additive members restores the delivered surface.
- **Pros:** The claim becomes checkable end to end (profile → binding → argv → store → row); the seat vocabulary is reused rather than invented; a multi-seat profile works without new orchestration (one launch per role, which is what the delivery already does); every mismatch becomes a warning instead of a substitution; the test can assert the argv production sends.
- **Cons:** The "per-seat models" phrasing must be restated (N spawns, N sessions, N rows); a role-less dispatch binds nothing and must be disclosed; two additive input members — the caller's agent identity and the binding the resolver returns, both in the same contract phase — plus one recorded binding are needed; and the unassigned-agent case needs a refusal identity (reused, not added).
- **Why chosen:** It is the only alternative that satisfies every `negotiable: no` constraint, and it is the only one whose test oracle can be the real invocation.

### Alternative 4 — One Dispatch Call Spawns One Session per Seat

- **Eligibility:** Not eligible (fails C-5).
- **Summary:** Keep one seat per invocation, but let a single `dispatch` run spawn N sessions, one per profile seat, and attribute them all to the run.
- **Constraint compliance:** Fails C-5: a dispatch attempt holds one lease, appends one attempt record, and its result contract carries one outcome and one held session identity; making a run hold N sessions changes the dispatch run contract and the attempt/identity model, which is a product decision beyond this story and would add a user-visible behaviour (N sessions per delivery). Passes C-1 … C-4, C-6.
- **Driver fit:** Strong on driver 4 in a hypothetical multi-role delivery; fails driver 3 (new surface) and driver 6 (largest possible change for a story that needs none).
- **Pros:** A single delivery could exercise the whole profile in one command.
- **Cons:** Multiplies cost per dispatch (every seat runs the same prompt), changes restart/liveness/lease semantics, and redefines what "the run's session identity" means for every consumer of the attempt record.
- **Why rejected:** It changes the dispatch contract to solve a harness-plane question; the same outcome is reachable today by dispatching once per role.

## Decision

- **Decision:** Adopt **ALT-3**. One harness spawn binds exactly one seat; the seat is resolved from the agent identity the spawn names, through the resolved profile; the adapter expresses it as exactly one `--agent` and one `--model`; N seats are N spawns, N sessions, and N telemetry rows. This record is `Proposed`; the human decider accepts it at the GH-335 PR review.

  **Decision statement.** A per-spawn binding carries exactly three facts — the **agent identity** (the harness agent name, the value `run --agent` accepts and the store records), the **seat** the resolved profile assigns to that agent (`agentOverrides` first, then the seat bearing that name, then a profile that declares exactly one seat — all three steps presuppose a **named** agent, per Amendment A-1), and the **resolved model** (the seat's `seatModels` value when pacing applied, else the seat's declared `model`). The binding is the resolver's **output**, never caller input: the caller supplies only the agent identity, on its own additive optional member, and the composition supplies the resolver's result on the sibling binding member (Amendment A-4). The opencode adapter emits exactly one `--agent <agent>` and exactly one `--model <provider>/<model>[#<variant>]` per invocation, adds no environment entry, and writes no harness configuration. A named agent that the profile does not assign a seat refuses before any session through the existing `provider.profile.invalid` identity. A spawn that names no agent binds nothing and is disclosed as an unresolved seat. Every telemetry row keeps the run's recorded seat and resolved model beside the harness-reported agent and model, with divergence warned on both axes and neither value overwritten.

  1. **Cardinality (question 1).** One spawn ⇔ one seat. The binding type carries exactly one seat, not a seat map; therefore a caller cannot express a multi-seat binding even by mistake. One dispatch attempt holds one session identity, so a run's held identities form a bounded set whose delivered cardinality is one per spawn/resume; N seats in a delivery are N dispatches (or N spawns across a resume chain), never one spawn. Consequence for the criteria: "per-seat models" is a **row-and-session** statement, provable across rows, not a per-spawn statement — AC-F5-1's "carries the seat identity, the resolved model, the harness-reported model" is per row as written and stays valid; AC-F3-1 must say "the spawn carries **its** seat's resolved binding", and §4.1's metric must say "every spawn that binds a seat carries that seat's resolved binding; a profile's N seats are exercised by N spawns".

  2. **Seat resolution (question 2).** The resolution input is the **agent identity on the spawn** — the same name the delivery already passes to `run --agent` and the store records in `session_v2.agent`. It is supplied by the caller on the spawn/resume input's **own additive optional agent-identity member** — a member distinct from the sibling additive optional binding member, never through process-global state, never read from the ambient environment, never inferred, and never an empty string (its **absence** is the `no-agent` state). The composition passes that value to the pure resolver, and the binding the resolver returns is supplied on the binding member; both members land in the same contract phase and no later phase adds a contract member (Amendment A-4; spec DEC-16, §5.1 F-3, §8.3 DM-4), and the shipped `dispatch` sets neither (DEC-15). Resolution is a pure lookup over the resolved profile: `agentOverrides[agent]` → the seat whose name equals `agent` → the profile's single declared seat. Two outcomes are refused or classified, and only these:
     - **Agent named, no seat assigned** in a profile that declares more than one seat → refuse **before any session** with the existing `provider.profile.invalid` (no new identity, no attempt record, no `detail.harness` member — see Amendment A-2 for the disclosure channel), naming the agent, the profile, and the declared seats, with the remediation "declare `agentOverrides` for this agent, or run a single-seat profile". Rationale: the defect is profile configuration, not the harness.
     - **No agent named** → the spawn **binds nothing, whatever the profile's seat count** (Amendment A-1). "No agent named" is an **unasked question**, not a failed resolution, and a single-seat profile is not an exception: the sole seat is *resolvable* but not *claimable*, because a seat claim requires a named agent (C-1) and the carrier table has no permitted value to send — `--agent` would have to carry a seat name, which §3 forbids. No `--agent`/`--model` is sent, no binding is recorded, the delivered harness default runs, and the run's rows carry `seat: null` with the `unresolved-seat` warning. This is the state §10 already requires the change to disclose.
     - A profile that cannot resolve at all (absent, invalid, unavailable) keeps its delivered nomination refusals unchanged (NG-6: profile resolution is consumed as input).

  3. **Carrier mapping (question 3).** Against `opencode run --help` (2026-11-18):

     | Resolved fact | Carrier | Rule |
     |---|---|---|
     | Agent identity | `--agent <agent>` | Exactly once per invocation; the value is the harness agent name, **not** the seat name when the two differ (the seat is reached through `agentOverrides`). |
     | Resolved model | `--model <provider>/<model>[#<variant>]` | Exactly once per invocation; the provider and model id are read from the seat's resolved model; `#<variant>` is appended only when the model declares one. |
     | Seat identity | **no carrier** | It is not an argv value; it is recorded on the run and stamped on the row (see 4). Sending a seat name as `--agent` would send a value the harness may not know. |
     | Declared variable name (variable-consuming harnesses only) | the declared environment entry | Unchanged delivered behaviour: record value wins for a declared name, an undeclared name changes nothing, the allowlist is not mutated, and no `OC_*` family is invented for opencode (NG-10, AC-F3-2, AC-F3-3). |

     Refusals at this boundary: a resolved model that cannot be expressed as `provider/model[#variant]` — an empty provider or model segment, a missing separator, whitespace/control characters or newlines that would corrupt the argv element, or a value over the adapter's declared bound — refuses `harness.profile.model-unrepresentable`, naming the seat, before any session. The "or that the harness does not recognise it" half of AC-F3-4 is **narrowed out**: there is no in-process source for a recognised-agent or recognised-model catalogue, and the only observed read (`opencode debug agents`) is a second pre-session child that AC-N1-1 forbids. An agent or model the harness does not know is therefore the harness's own answer — a spawn failure classified by the delivered classifier and disclosed — not a pre-session refusal, and never a silent substitution.

  4. **Telemetry identity (question 4).** DEC-5 is **confirmed and extended**, not amended:
     - A row carries `seat` (the run's recorded binding seat), `agentRole` (the harness-reported agent, the delivered field), `resolvedModel` (the run's recorded binding model), and `observedModel` (the store's session/message model, the delivered `model` field). The row grain stays one record per `(session, agent, model)` group.
     - **Authority:** the store is authoritative for **what ran** (observed agent and model, and therefore for spend's harness-reported units); the run's recorded binding is authoritative for **what was requested** (seat and resolved model). Neither overwrites the other; a divergence raises a closed warning on each axis — model divergence (resolved ≠ observed) and **agent divergence** (binding agent ≠ observed agent, which is the signal that the harness ignored `--agent`).
     - **Group scoping:** the binding's seat and resolved model attach only to the group whose observed agent equals the binding's agent. Any other group in the same session (a mid-session `agent-switched`/`model-switched` group) carries `seat: null` with `unresolved-seat` — it was never selected by the dispatch, so claiming the spawn's seat for it would fabricate an attribution the run never made.
     - **Unbound runs:** a run with no recorded binding yields `seat: null` with `unresolved-seat` and still carries `agentRole`/`observedModel` from the store. The seat is **never** rebuilt at capture time by inverting the current profile's `agentOverrides`, because the profile may have changed since the run and the run declared nothing.
     - **Source correction:** the spec's §8.3 row "Seat identity ← per-message `agent`, with `session_v2.agent` as baseline" is wrong — that is the harness agent, not the profile seat. The store cannot state the seat; only the run's recorded binding can.
     - **Naming (Amendment A-3):** `seat`, `resolvedModel`, `observedModel`, `agentRole` and the unresolved-seat reason are named here as **obligations** — the facts a row must be able to state and the closed reason it must be able to cite. Their exact field names, spellings and constant identifiers are pinned by the delivery contract and its payload-allowlist and inventory pins under GAP-5's one-authored-home rule; a plan or test that defers to those names is compliant with this record, and this record's prose is never itself a constant name.

  5. **Multi-seat consequence (question 5).** A delivery that needs several seats is several spawns and therefore several sessions, several held session identities, and several row sets — one per spawn. Nothing in the change adds a multi-seat dispatch loop (ALT-4). What the change **enforces structurally** is that a binding cannot express more than one seat (single-seat type), that exactly one `--agent`/`--model` pair appears per invocation (adapter + conformance assertion), and that a seat claim requires a named agent (the resolution rule). What it **documents** is the rest: N seats ⇒ N spawns; a role-less dispatch binds nothing; a selected group never carries another group's seat.

### Constraint Compliance Attestation

ALT-3 satisfies C-1 through C-6. C-1: a seat is expressed only for a named agent the profile assigns, and the sent values are that agent's identity and that seat's model. C-2: the binding rides `run --agent`/`run --model` (and declared variable entries for a variable-consuming harness), with no configuration document, no store or configuration write, no additional child process, and an unchanged allowlist. C-3: the row keeps requested and observed values on both axes, warns on divergence, and represents unknown/unasked facts as null with a warning. C-4: the additions are fields on `delivery.harness.telemetry.v1` and the row grain is unchanged. C-5: every delivered port, dispatch, and command shape keeps its members and meaning; the additions are optional data. C-6: the unassigned-agent refusal is pre-session, appends no attempt record, and reuses `provider.profile.invalid` with its disclosure carried by the bounded error summary and the identity's remediation hint, so no error-table row, no `detail.harness` mapping, and no envelope-shape change is added. No accepted-risk exception is claimed.

## Amendments

Kept in place and dated rather than silently rewritten; `status` remains `Proposed`.

### A-1 (2026-11-18) — A role-less spawn binds nothing, in every profile shape

Decision 2's third bullet previously read: *"the spawn binds nothing only if the profile declares more than one seat; a single-seat profile binds that seat (unambiguous, no guess)"*. That sentence contradicted the record's own carrier table and C-1. With no agent identity there is no value the carrier may send as `--agent` (§3 forbids sending a seat name), and C-1 permits a seat claim only for a named agent. A single-seat profile therefore creates no exception: the sole seat is resolvable but not claimable. The bullet is corrected in place — a role-less spawn binds nothing regardless of seat count, sends no `--agent`/`--model`, records no binding, and its rows carry a null seat with the unresolved-seat reason. The resolution chain's last step ("then a profile that declares exactly one seat") is unchanged and still valid: it applies only to a **named** agent, which a single-seat profile resolves without ambiguity. This matches the remediation already applied to the spec (§5.1 F-3, §6 Flow 2, AC-F3-1).

### A-2 (2026-11-18) — The unassigned-agent refusal is disclosed through the bounded error summary

Decision 2's first bullet required the refusal to name the agent, the profile and the declared seats without stating where. Corrected: those facts ride the delivered failure envelope's bounded `error.summary` (NFR-4-bounded) together with the identity's remediation hint. The refusal adds **no** `detail.harness` member — TDR-0033 reserves that slot for the four new harness identities and states that every other identity, including a reused one, carries none — and adds no error-table row, no exit projection, and no envelope-shape change. A coder must neither widen `CommandResultDetail` nor author a new identity for this refusal; a reviewer must treat either as a violation of C-6.

### A-3 (2026-11-18) — Field literals are obligations; the constant names belong to the contract

`seat`, `resolvedModel`, `observedModel`, `agentRole` and the unresolved-seat reason are stated in this record as the facts a row must be able to express and the closed reason it must cite — not as identifiers to be copied. Their exact field names and constant names are pinned by the delivery contract and its payload-allowlist, key-set and inventory pins, under GAP-5's rule that a vocabulary has exactly one authored home. A plan or test that defers the literal names to that home is compliant with this record; a second authored copy of the vocabulary, in a test or in documentation, is not.

### A-4 (2026-11-18) — The carrier is two members: the caller supplies the agent identity, the resolver supplies the binding

Decision 2's resolution sentence previously read *"It is supplied per spawn as data on the binding (never through process-global state, never read from the ambient environment)"*, and Implementation step 1 read *"It rides the spawn/resume input as optional data"*. That was one carrier: the caller handed the harness port a binding that already named the agent and, by the decision statement's own words, already carried the resolved seat and model. The settled design (spec DEC-16, §5.1 F-3 "Carrier", §8.3 DM-4) is two members, and it is stated here as the authority DEC-13 points to:

- **Two members, two directions.** The caller's agent identity travels on its **own additive optional member** on `HarnessSpawnInput` and `HarnessResumeInput`; the binding travels on a **separate, sibling additive optional member** and is the pure resolver's **return value**. The composition passes the supplied agent identity, with the resolved profile and the selection, to the resolver and supplies the result on the binding member. Neither member is an argv convention, an environment variable, a process-global value, or ambient state, and neither is inferred.
- **The absence rule stays with the agent member.** Its absence is the `no-agent` state — never an empty string, never a defaulted or inferred value (A-1 governs what that state binds: nothing, whatever the profile's seat count). A present value is the agent identity the resolution is called with, and it reaches the invocation as `--agent` only as the resolved binding's carrier.
- **One phase, no later additions.** Both members are added in the same contract phase that declares them, so the resolution rule has a declared production call site rather than a fixture the test itself built; no later phase adds a contract member to the port inputs. C-5 is satisfied without amendment: both members are additive optional data, no delivered member's meaning moves, and the recorded binding on the attempt record stays additive.
- **The shipped `dispatch` sets neither member** (DEC-15): its spawns reach the port in the `no-agent` state, bind nothing, and are disclosed `unresolved-seat`.
- **Why the single-member form was wrong.** With the binding as the caller's input, the record's own resolution rule had nothing to resolve: an agent-carrying binding is the resolver's *output*, so a test proving resolution from such an input proves only a fixture the test itself constructed — the vacuity class this change exists to remove. Splitting the carrier makes the rule falsifiable at the seam where the claim is stated: a composition that fails to read the agent member, or a binding assembled without the resolver, fails a test that production code must pass.

A-4 requires **no** spec, test-plan, or plan rewrite: DEC-16, F-3 and DM-4 already state the split, and the plan's Phase 2.1/3.3/4.3 already implement it. Its only artifact-side consequence is that Phase 2.1 cites A-4 beside DEC-16 (readiness iteration 5, finding 1).

All four amendments ratify what the spec remediation already applied, so they imply **no further** spec edit. The artifact-side consequences are: the test plan's role-less control must not be conditioned on the profile's seat count (A-1), §10's routing of the unassigned-agent refusal to the bounded error summary is already applied (A-2), the field and constant names stay with the contract (A-3), and Phase 2.1 cites A-4 beside DEC-16 so the plan's carrier statement names its authority (A-4).

## Trade-offs & Consequences

### Positive Outcomes

- The headline acceptance criterion becomes provable: the test can assert the exact argv production sends (one pair per invocation), and the row can show the resolved/observed pair per axis.
- Per-seat telemetry becomes an emergent property of how the delivery already runs (one named role per invocation) rather than a new orchestration feature.
- The seat vocabulary stops being conflated with the harness agent: a divergence between them is now visible as evidence instead of being invisible.
- Mid-session agent switches are attributed honestly (unresolved seat) instead of silently inheriting the spawn's seat.
- The refusal path adds no identity, no error-table row, and no envelope member, so DEC-12 and TDR-0033 stay true.

### Negative Outcomes

- "Per-seat models" must be restated as N spawns ⇒ N sessions ⇒ N rows; a reader who expected one session to carry the whole profile must update. Mitigated by stating the rule in F-3, the §4.1 metric and the glossary.
- A role-less dispatch (today's generic `dispatch`) propagates nothing and is disclosed as unattributed. This is honest but weaker than the ticket's phrasing; mitigated by the revisit trigger that names the dispatch agent input as the closing move, and by the fact that the delivery's real launches already name an agent.
- The row gains a fourth identity axis (seat) that can be null. Mitigated by the `unresolved-seat` warning and by never defaulting it.
- A per-run recorded binding is a new persistent fact; without it closeout capture cannot state the seat. Mitigated by making it additive on the delivered attempt record and by refusing to rebuild it at capture time.
- The "harness does not recognise it" half of AC-F3-4 is reduced. Mitigated by the harness's own classified spawn failure and by the divergence warning, so an unknown agent is visible rather than silent.

### Unresolved Questions

- [ ] Will the generic `dispatch` path declare an agent role (value flag or declared default), so its spawns bind a seat? Not required by this record; until then its spawns are disclosed as unattributed. (owner: `@pm` / `@spec-writer`)
- [ ] Does the operator's profile declare `agentOverrides` for every role the delivery runs? If not, those dispatches refuse with `provider.profile.invalid` — deliberately, so the fix is configuration rather than silent attribution. (owner: `@spec-writer` at the change's DoD observation)
- [ ] Should `spend` expose the seat dimension separately from `role`? The delivered five breakdown dimensions are unchanged by this record; a seat dimension would be an additive spend decision. (owner: `@pm` on the first consumer that needs it)

### Consequences for the change artifacts (the exact edits this decision implies)

The spec, test plan and plan are **not** edited by this record; the owning writers apply these, and the change's decision log records that TDR-0032 governs them.

- **§4.1 metric "Profile propagation (TC-M3-HARNESS-001)"** — replace "On a resolved profile with N seats, every spawn carries its seat's resolved binding … zero seats unattributed" with: every spawn that binds a seat carries **exactly one** `--agent` and one `--model` for the seat the profile assigns to the agent the run names; a profile's N seats are exercised by N spawns, each its own session and its own rows; zero bound spawns unattributed, and every unbound run disclosed as `unresolved-seat`.
- **§5.1 F-3** — state the cardinality rule, the agent→seat resolution input and its two outcomes (with the unassigned-agent refusal's facts carried by the bounded error summary and remediation hint, A-2, and a role-less spawn binding nothing whatever the seat count, A-1), the carrier table (agent identity → `--agent`, resolved model → `--model`, seat identity → no carrier, recorded per run), and the refusal for an inexpressible model; add that a seat name is never sent as `--agent`.
- **§6 Flow 2** — "profile resolution yields seat → model and the per-seat binding record" becomes "profile resolution yields the seat assigned to the run's agent → that seat's model; the binding carries exactly one seat; a further seat is a further spawn".
- **§8.3 DM-4** — the carrier is **two** distinct additive optional members on the spawn and resume input, not one (A-4): the caller-supplied agent identity, and the binding the pure resolver returns on its sibling member. The binding is **one** seat plus the agent identity it was resolved for (add `agent`), and it is recorded per spawn on the run so capture can cite the seat. The shipped `dispatch` sets neither member (DEC-15).
- **§8.3 DM-5 / the §8.3 field table row "Seat identity"** — the seat comes from the run's recorded binding, **not** from `session_v2.agent`/per-message `agent`; the store supplies `agentRole` and `observedModel`. Add the agent-divergence axis beside the model divergence.
- **§8.3 DM-8** — the attribution key is every session identity the run holds (one per spawn/resume; a delivered attempt holds exactly one) **plus** the run's recorded binding for the seat claim.
- **AC-F3-1** — "the spawn carries the resolved binding for that seat" becomes "the spawn carries exactly one resolved binding — the seat assigned to the agent the run names — expressed as one `--agent` and one `--model`"; keep the resolved-beside-observed clause.
- **AC-F3-4** — drop "or that the harness does not recognise"; keep the expressibility half. Record the reduction, with the harness's classified spawn failure as the unknown-agent outcome.
- **AC-F5-1** — unchanged in substance; add "seat and resolved model from the run's recorded binding" and "a group whose observed agent differs from the binding's agent carries no seat and warns".
- **AC-F5-5** — "the run's recorded session identity" becomes "every session identity the run holds (one per spawn/resume)" plus "the run's recorded binding"; the no-identity absence and the failed-session rule stay.
- **§23 Glossary** — "Seat" gains "one per spawn; resolved from the agent the run names"; add "Agent identity" (the harness agent name, the value `run --agent` accepts and the store records) and "Binding" (agent identity + seat + resolved model, recorded per spawn).
- **§17.1 / §17.2** — the live observation must run an invocation **that names an agent** (the delivery scripts already do), and a role-less run is recorded as an unresolved-seat observation, never as propagation proof.

## Implementation Plan

1. **Contract (additive, one commit with its pins).** Two distinct additive optional members land on `HarnessSpawnInput` and `HarnessResumeInput` in this phase: the **agent-identity member** — the caller's input, the harness agent name, bounded, whose absence is the `no-agent` state, never an empty string, never inferred, never an argv or environment convention — and the **binding member**, which carries the pure resolver's return value. The binding carries exactly one seat: `agent` (harness agent identity, bounded), `seat` (profile seat name, bounded), and `model` (canonical resolved model); it is not a seat map, and the caller never supplies it. Both members are added in this contract phase and no later phase adds a contract member (Amendment A-4); the shipped `dispatch` sets neither (DEC-15). Add the representability predicate's shape (expressible ⇔ a non-empty provider and model id, no `#` ambiguity beyond one variant separator, no whitespace/control characters, within the declared bound) beside the binding type.
2. **Resolution (pure).** `resolveBinding(profile, selection, agent)` returns exactly one seat binding or a classified outcome: `no-agent` (unasked → no binding for **any** seat count, per Amendment A-1), `unassigned` (agent named, multi-seat profile without an assignment → `provider.profile.invalid`, disclosed through the bounded error summary and remediation hint per Amendment A-2), or a binding. Reuse `agentOverrides` and the seat set; do not reuse the first-declared fallback for the binding rule.
3. **Adapter.** Map the binding to `run` argv: one `--agent <agent>`, one `--model <provider>/<model>[#<variant>]`; add no environment entry; keep the delivered variable-consuming path for a harness that declares names; refuse `harness.profile.model-unrepresentable` before any spawn when the resolved model is inexpressible.
4. **Run record.** Record the binding (agent, seat, model) on the run's attempt record additively, so closeout capture can state the seat without re-deriving the profile; the capture input carries the held session identities and that binding.
5. **Telemetry.** Add `seat` and `resolvedModel` beside the delivered `agentRole`/`model`; scope the binding facts to the group whose observed agent matches; emit `unresolved-seat` for unbound runs and for non-matching groups; warn on agent and model divergence without overwriting either value.
6. **Conformance.** The profile-propagation scenario asserts one `--agent`/`--model` pair per invocation and one seat per spawn; an invocation carrying two of either fails.
7. **Documentation.** Harness adapters (binding, mapping, refusal), telemetry v2 (seat/resolved-model fields, group scoping, divergence axes), spend (role stays the harness agent; seat is row-level), dispatch engine (recorded binding, unassigned-agent refusal, role-less disclosure).
8. **Staging.** This record's index row lands in the phase that stages the record, in that phase's one commit.

## Verification Criteria

- A spawn whose agent has an assigned seat: recorded argv contains exactly one `--agent <agent>` and exactly one `--model` equal to that seat's resolved model; the child environment key set equals the declared allowlist set (no seat variable added); the store's reported agent equals the binding agent and its model equals the resolved model → zero divergence warnings.
- A three-seat profile exercised as three spawns: three sessions, three recorded bindings, three row sets with distinct `seat` values and the matching `resolvedModel` per row; no invocation carries more than one `--agent` or `--model`; zero bound spawns unattributed.
- A named agent with no seat assignment in a multi-seat profile: refusal with `provider.profile.invalid` naming the agent, the profile and the declared seats **in the bounded `error.summary` and the remediation hint**, exit `1`, zero sessions, zero attempt records, zero telemetry rows, no `detail.harness` member, and `HARNESS_FAILURE_CODES` unchanged.
- A spawn that names no agent against **any** profile, single-seat included: no `--agent`/`--model` in argv, no binding recorded, rows carry a null seat with the unresolved-seat reason, and the observed agent/model are still reported (Amendment A-1).
- A resolved model that is not `provider/model[#variant]`-shaped (empty segment, whitespace, control character, over-bound): `harness.profile.model-unrepresentable` naming the seat, before any session, with the delivered `detail.harness` member set unchanged from TDR-0033.
- A session whose group agent differs from the binding agent (mid-session switch): that group's rows carry `seat: null` with `unresolved-seat`; the matching group carries the seat; spend's `role` breakdown still reports the harness agent for both.
- A row whose observed model differs from the resolved model: both values present, model divergence warned, neither overwritten; the same for a differing agent.
- `delivery.harness.telemetry.v1` unchanged as the identifier; pre-change rows read unmodified; `HARNESS_FAILURE_CODES` length unchanged; the delivered port, dispatch and command grammar suites stay green unchanged.

## Confidence Rating

**High.** Every load-bearing fact is either repo-local and read directly (the spawn input, the production spawn arguments, the profile's `agentOverrides` and target-seat rule free-form model validation, the telemetry row fields, the dispatch's one-attempt/one-session shape, the closed error-table row) or directly observed read-only on the installed harness (`run --help`'s single-valued flags; `session_v2`'s one-agent-one-model rows whose agent values are the delivery's role names; the switch-event counts). The residual uncertainty is external to the repository — whether the harness rejects an unknown agent rather than silently substituting one — and it is bounded by the decision's agent-divergence warning, which makes that failure visible rather than silent.

## References

- Change: `doc/changes/2026-11/2026-11-17--GH-335--opencode-harness-telemetry/chg-GH-335-spec.md` (§4.1, §5.1 F-3/F-5, §6 Flow 2, §8.3, §10, §17, Appendix C), `chg-GH-335-test-plan.md` (§3.1, §5.2 TC-HARNESS-011), `chg-GH-335-plan.yaml` (Phases 2–5), `readiness-review/readiness-iter-2.md` (findings C1, C2, M3).
- Prior decisions: ADR-0008 (harness adapter contract); TDR-0016 (streaming spawn seam); TDR-0021 (optional environment marker); TDR-0027 (failure-envelope detail slot); TDR-0033 (harness dispatch-outcome disclosure on that slot); TDR-0028 (no-nomination refusal reusing provider-profile identities).
- Specs: `doc/spec/features/feature-harness-adapters.md` (§4 environment, §5 telemetry extraction, §6 closeout capture); `feature-provider-profiles.md` (seats, `agentOverrides`, resolve-before-spawn); `feature-telemetry-v2.md`; `feature-spend.md`; `feature-dispatch-engine.md`.
- Contracts and code: `packages/core/src/contracts/harness.ts`; `packages/core/src/contracts/telemetry.ts`; `packages/core/src/provider/profile.ts`; `packages/core/src/provider/validate.ts`; `packages/adapters/src/harness/opencode.ts`; `packages/cli/src/production.ts`; `packages/core/src/app/dispatch.ts`; `packages/core/src/contracts/error-table.ts`.
- Harness observation (read-only, 2026-11-18): `opencode run --help`; `sqlite3 "file:~/.local/share/opencode/opencode.db?mode=ro"` with `PRAGMA query_only=ON` — `session_v2` agent/model distribution and `session_message` type counts.
- Delivery entry points: `scripts/deliver-ticket.sh`, `scripts/ceo-loop.sh`, `scripts/opencode-session.sh`.
