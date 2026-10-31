---
id: ADR-0005
decision_type: adr
status: Proposed
created: 2026-10-31
decision_date: null
last_updated: 2026-10-31
summary: "Refine ADR-0003's runtime-API confinement wording so provider client subpaths performing network I/O (github, gitlab, jira) join the adapter I/O edge as exact, reason-bearing, reviewed entries while the registry subpath stays non-I/O; recorded as a refining decision record plus an editorial pointer in ADR-0003, not an in-place semantic rewrite."
owners:
  - "Juliusz Ćwiąkalski"
service: delivery-os
decision_scope: repo
review_date: null
classification:
  domains: [architecture, security, tooling]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: medium
  urgency: medium
  uncertainty: low
  blast_radius: team
  recurrence: recurring
governance:
  driver: "@decision-advisor (via GH-188 planning)"
  decider: "Juliusz Ćwiąkalski (human acceptance pending at PR review)"
  contributors: ["@decision-advisor (analysis)", "@spec-writer (GH-188 spec OQ-4/DEC-1 framing)"]
  reviewers: ["@readiness-reviewer", "@reviewer", "Owner (human final acceptance)"]
  performers: ["@coder", "@doc-syncer"]
  informed: ["ADOS contributors", "Future provider-seed stories (azure, ci)"]
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: false
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A provider subpath wants runtime APIs beyond network I/O (e.g., filesystem or process access); that is a new reviewed extension, not covered by this record."
  - "The registry subpath ever needs I/O; re-open rather than quietly adding it."
  - "Allowlist growth shows drift beyond reason-bearing reviewed entries; tighten the check (per-entry reasons mechanically validated, mirroring the secret-read registry)."
links:
  related_changes: ["GH-188", "GH-170", "GH-181"]
  supersedes: []
  superseded_by: []
  spec: ["doc/spec/features/feature-monorepo-scaffold-toolchain.md", "doc/spec/features/feature-adapter-ports.md"]
  contracts: [".dependency-cruiser.cjs"]
  diagrams: []
  decisions: ["ADR-0003"]
  experiments: []
  metrics: []
  roadmap_items: []
---

# ADR-0005: Runtime-API Confinement for Provider Client Subpaths

## Context

- **FACT:** ADR-0003 (Accepted, R3, decision-critic-challenged) confines runtime APIs to "the `core ./state` driver code, the adapter I/O subpaths, the CLI build, and the OpenCode host integration" (DEC-2 additional rules).
- **FACT:** ADR-0003 DEC-6's delivery table enumerates the non-provider I/O modules (`repo`, `file`, `host`, `session`, `legacy`) as "the only I/O home besides `core ./state`" — written when the provider subpaths were type-only placeholders.
- **FACT:** The mechanical concretization of that wording excludes provider subpaths: `.dependency-cruiser.cjs` rule `runtime-apis-confinement` allows only the state driver edge, `packages/adapters/src/(repo|file|host|session|legacy|credentials)/`, `packages/cli/`, and `packages/opencode/` — and it bites only on Node core-module imports (`to: { dependencyTypes: ["core"] }`); global API usage such as `fetch` creates no dependency edge and is invisible to this rule. Its comment states "provider/registry subpaths are not I/O." The scaffold spec mirrors this: "provider, registry, and remaining adapter subpaths are not exempt" (feature-monorepo-scaffold-toolchain.md, Runtime-API confinement bullet).
- **FACT:** The allowlist already evolves by reviewed extension: GH-181 added `credentials` to the enumerated adapter I/O subpaths, and the current spec truth names it alongside the five (feature-adapter-ports.md, Security and Boundaries).
- **FACT:** GH-188's spec (DEC-1) decides that the three provider client seeds live in their per-provider subpaths and are "admitted to the runtime-API confinement allowance as reason-bearing entries; the provider registry subpath stays non-I/O," and tracks the ADR-0003 wording tension as OQ-4, delegating the resolution here.
- **FACT:** Real provider clients perform network I/O (`fetch`). What current enforcement catches: the `runtime-apis-confinement` rule matches Node core-module imports only (`to: { dependencyTypes: ["core"] }`), and the `fetch` global is banned solely in core neutral tiers (`scripts/checks/ambient-globals.ts` `BANNED_GLOBALS`, scoped to the core `.` entry and the `contracts`/`domain`/`app`/`config`/`branding` tiers) — so a pure global-fetch provider client in the adapters package cruises clean under the rule today, while a Node core-module import in a provider subpath still fails. The admission entries therefore buy declared-structure agreement with ADR-0003 as refined here (provider client subpaths as the exact, reason-bearing I/O home for provider network I/O; `registry` stays non-I/O) and the hook for future tightening — not clearance the current rule would deny a fetch-only client. Routing provider I/O through the non-provider I/O subpaths remains the already-rejected alternative (it inverts the declared structure). *(Evidence corrected 2026-10-31, DoR iteration 1 advisory — the prior wording overstated the rule's current bite.)*
- **FACT:** This decision concerns the runtime-API confinement allowance only. The secret-read boundary allowlist (ambient environment access, `credential-material` class) is a separate invariant that stays at exactly four entries with zero growth in GH-188 (its DEC-6); nothing here touches it.

## Problem Framing (Clarified)

ADR-0003's operative confinement sentence is generic ("the adapter I/O subpaths"), but its DEC-6 enumeration and every downstream concretization (dependency-cruiser, scaffold spec) define "adapter I/O subpaths" as the five non-provider modules plus credentials, excluding provider subpaths. That exclusion was an accurate description of placeholder-only subpaths; it becomes false the moment real provider clients land. The problem is not whether the extension is right (GH-188 DEC-1 already decided that, with the alternative rejected) but how the record layer absorbs the change: rewrite an Accepted R3 record in place inside a feature change, record a refining decision while leaving the original untouched, or leave the wording stale and let the mechanical truth drift from the prose. The chosen path must keep exactly one authoritative reading across ADR prose, spec, and the enforced rule, without falsifying decision history or reopening an R3 for a clause refinement.

## Constraints (Hard Requirements)

| ID | Pass/fail requirement | Source | Verification | Negotiable |
|---|---|---|---|---|
| C-1 | The secret-read boundary allowlist remains exactly four entries; this decision introduces no credential-material or ambient-read path. | GH-188 DEC-6; feature-adapter-ports.md | Secret-read invariant green, count = 4, planted violations still fire | no |
| C-2 | The confinement extension is exact-path and reason-bearing: `github`, `gitlab`, `jira` subpaths only; the `registry` subpath and all remaining adapter subpaths stay non-I/O. | GH-188 DEC-1, RSK-4 | dependency-cruiser rule entries with per-entry reasons; negative fixtures (a runtime import in `registry` still fails) | no |
| C-3 | ADR-0003's history is not falsified: its Accepted status, dates, and decision-critic record remain intact; any edit to it is editorial (pointer), not semantic. | ADR-0001 record discipline; project convention (numbers never reused, records durable) | Review of the ADR-0003 diff (pointer note + `last_updated` + links only) | no |
| C-4 | Mechanical enforcement stays authoritative and fail-closed: the rule change ships with updated negative fixtures proving non-exempt paths still fail. | ADR-0003 DEC-2 ("a rule without a failing fixture is treated as unenforced") | Boundary tests incl. planted runtime imports in non-exempt subpaths | no |
| C-5 | Exactly one authoritative reading exists after the change: ADR-0003 (as pointed), this record, the scaffold spec, and the dependency-cruiser rule agree. | GH-188 OQ-4 | Doc-sync review; consistency check across the four surfaces | no |

## Decision Drivers

1. **Single authoritative reading** — no drift between ADR prose, system spec, and the enforced rule (the drift is the problem).
2. **Auditable allowlist discipline** — mirror the secret-read boundary's virtues: exact paths, reasons, reviewed growth.
3. **Minimal ceremony, proportional governance** — refine the clause without reopening or re-challenging the whole R3 record (lean-process priority).
4. **Durable decision history** — a future reader can reconstruct what was decided, when, and why, without archaeology.
5. **One home for provider I/O** — provider network I/O lives in provider subpaths, never routed through non-provider I/O modules.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (during GH-188 planning; the spec's OQ-4 delegates here).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at GH-188 PR review. AI does not accept this record.
- **Contributors:** `@decision-advisor` (analysis), `@spec-writer` (GH-188 DEC-1/OQ-4 framing).
- **Required reviewers:** `@readiness-reviewer` and `@reviewer` on the GH-188 change; the owner for final acceptance of this record and the ADR-0003 editorial note.
- **Performers:** `@coder` (dependency-cruiser entries + negative fixtures), `@doc-syncer` (scaffold spec and feature-adapter-ports updates, ADR-0003 pointer).
- **Informed:** ADOS contributors; the future azure/ci provider-seed stories that will follow the same path.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| ADR-0003's DEC-2 confinement sentence does not itself enumerate provider subpaths as excluded; the exclusion lives in DEC-6's table and downstream concretizations. | FACT | ADR-0003 text (read 2026-10-31) | The tension would be inside the ADR's own wording, strengthening the in-place-amend case. | High |
| `.dependency-cruiser.cjs` `runtime-apis-confinement` allows only state-driver, the five non-provider subpaths + credentials, cli, opencode — and matches Node core-module imports only (`to: { dependencyTypes: ["core"] }`); global `fetch` use in adapters is invisible to it. | FACT | `.dependency-cruiser.cjs` lines 201–222 (read 2026-10-31; matching semantics restated 2026-10-31, DoR iteration 1 advisory) | The mechanical gap description would be wrong. | High |
| The scaffold spec states provider/registry/remaining subpaths are not exempt. | FACT | feature-monorepo-scaffold-toolchain.md, Runtime-API confinement bullet | Spec sync scope would differ. | High |
| `credentials` was added to the enumerated I/O subpaths by GH-181 after ADR-0003, with spec truth updated — precedent for reviewed allowance growth without an ADR-0003 rewrite. | FACT | feature-adapter-ports.md Security and Boundaries; rule regex | Precedent would be weaker; the refine-not-rewrite choice would lean more on first principles. | High |
| ADR-0003 was accepted via PR #163 with a decision-critic challenge record. | FACT | ADR-0003 front matter (governance) | Governance weight of in-place edits would differ. | High |
| The current rule does not fail a pure global-fetch provider client in the adapters package: dependency-types matching sees Node core-module imports only, and the `fetch` global is banned solely in core neutral tiers. The admission entries buy declared-structure agreement (ADR-0003 refinement), the hook for future tightening, and `registry` staying non-I/O. | FACT | `.dependency-cruiser.cjs` `to` clause; `scripts/checks/ambient-globals.ts` `BANNED_GLOBALS` + scope (row corrected 2026-10-31, DoR iteration 1 advisory; superseded an overstated prior row) | If false, the rule would today deny fetch-only provider clients and the extension would be mechanically forced rather than a declared-structure refinement. | High |
| Future provider seeds (azure, ci) will want the same admission via the same reviewed path. | ASSUMPTION | Backlog M0-S19 scope note ("later stories; placeholders untouched") | Each future seed would need its own justification — the recorded precedent makes that cheap either way. | Medium |

## Mental Models & Techniques Used

- **Single source of truth:** four surfaces state one rule (ADR, refining record, spec, enforced rule); any decision that leaves them diverging has not solved the problem.
- **Append-only history / durable records:** decision records are evidence of what was known and decided at a time; semantic rewrites destroy that property. Refinement is additive; rewriting is destructive.
- **Least privilege:** extend the allowance by exact paths with reasons, never by widening the pattern (no `providers/**`, no `adapters/src/*`).
- **Second-order thinking:** an in-place rewrite inside a feature change makes every future Accepted record editable-by-feature-change — a precedent more expensive than one extra record.
- **Paved road:** GH-181's `credentials` addition already established the reviewed-extension path; this generalizes it from a mechanical edit to a recorded one because prose in an Accepted R3 record is involved.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

|          | C-1 secret boundary | C-2 exact/reason-bearing | C-3 ADR history intact | C-4 fail-closed fixtures | C-5 one reading |
|----------|:---:|:---:|:---:|:---:|:---:|
| ALT-0 no extension | pass | n/a | pass | pass | **fail** (allowlist has no home for the seeds — prose–truth drift) |
| ALT-1 refine via new record + editorial pointer | pass | pass | pass | pass | pass |
| ALT-2 in-place semantic amendment of ADR-0003 | pass | pass | **fail** | pass | pass |
| ALT-3 mechanical/spec change only, no record | pass | pass | pass | pass | **fail** |

### Alternative 0 — Do Nothing / Avoid the Extension

- **Eligibility:** Not eligible (fails C-5 — and the story itself).
- **Summary:** Keep the allowance as is; provider clients avoid runtime APIs or route I/O through the non-provider subpaths.
- **Constraint compliance:** The confinement allowlist has no declared home for provider client subpaths, leaving enforced rule and ADR-0003 prose diverging from the shipped structure; routing provider I/O through `repo`/`file`/`host` inverts the declared structure (already rejected in GH-188 DEC-1). (Reworded 2026-10-31, DoR iteration 1 advisory — declared-structure framing.)
- **Driver fit:** Fails driver 5 outright.
- **Pros:** None beyond inaction.
- **Cons:** Blocks M0-S19 and every dependent story (M0-S6, M0-S8/S9, M0-S14, M0-S20).
- **Why rejected:** The extension's necessity is settled; only the record mechanism was open.

### Alternative 1 — Refining Decision Record + Editorial Pointer in ADR-0003 (chosen)

- **Eligibility:** Eligible.
- **Summary:** This record refines the confinement clause: provider client subpaths performing network I/O are part of the adapter I/O edge, admitted per subpath (`github`, `gitlab`, `jira`) as exact, reason-bearing, reviewed entries; `registry` stays non-I/O. ADR-0003 receives only an editorial pointer note at the affected DEC-2 bullet and DEC-6 table (plus `last_updated` and a links entry), not a semantic rewrite. The dependency-cruiser rule gains the three subpaths with per-entry reasons; doc-sync updates the scaffold spec and feature-adapter-ports to the same reading.
- **Constraint compliance:** Passes all five (matrix above).
- **Driver fit:** Best on all five drivers — one reading, auditable growth, proportional ceremony, durable history, one I/O home.
- **Pros:** Traceable precedent for azure/ci; ADR-0003 stays honest; the refine relationship is explicit (`links.decisions`).
- **Cons:** One more record to maintain; a reader must follow the pointer for the current truth.
- **Why chosen:** Solves the drift without paying the governance cost of rewriting an R3 or the honesty cost of leaving prose stale.

### Alternative 2 — In-Place Semantic Amendment of ADR-0003 Inside GH-188

- **Eligibility:** Not eligible (fails C-3).
- **Summary:** Edit ADR-0003's DEC-2 confinement bullet and DEC-6 table directly in the GH-188 change, with a history note.
- **Constraint compliance:** Fails C-3 — rewrites the normative content of an Accepted, decision-critic-challenged R3 record inside an unrelated feature change, bypassing the governance under which it was accepted.
- **Driver fit:** Good on C-5-style single-reading grounds; poor on durable history and proportional governance.
- **Pros:** No pointer-following; one document.
- **Cons:** Sets the precedent that Accepted records are silently re-authorable by later features; blurs what was decided in 2026-10 versus 2026-10-31.
- **Why rejected:** The pointer achieves the same single reading without the history cost.

### Alternative 3 — Mechanical and Spec Change Only, No New Record

- **Eligibility:** Not eligible (fails C-5).
- **Summary:** Extend the dependency-cruiser allowlist and update the scaffold spec, leaving ADR-0003's DEC-6 "only I/O home" wording untouched and unrecorded.
- **Constraint compliance:** Fails C-5 — ADR prose and enforced truth diverge; OQ-4 exists because reviewers already trip over exactly this.
- **Driver fit:** Fails drivers 1 and 4.
- **Pros:** Least writing.
- **Cons:** The next reader of ADR-0003 is misled; the drift this decision exists to close is re-created.
- **Why rejected:** Silent divergence is the failure mode, not a solution.

## Decision

- **Decision:** Extend the runtime-API confinement allowance to the three provider client subpaths — `packages/adapters/src/github/`, `packages/adapters/src/gitlab/`, `packages/adapters/src/jira/` — as exact, reason-bearing entries for network I/O, via this refining record plus an editorial pointer note in ADR-0003 (no semantic rewrite). The provider registry subpath and all remaining adapter subpaths stay non-I/O; future provider seeds (azure, ci) join by the same reviewed-change path, not by pattern widening. The secret-read boundary allowlist is untouched (exactly four entries, zero growth).
- **Rationale (tied to drivers):** It is the only option that yields one authoritative reading (driver 1) with auditable, least-privilege growth (driver 2) at proportional ceremony (driver 3) while keeping decision history durable (driver 4) and provider I/O in its declared home (driver 5).
- **Decider:** Owner (Juliusz Ćwiąkalski) — acceptance pending at GH-188 PR review; this record stays Proposed until then.
- **Conditions for revisit:** See `revisit_triggers` in the front matter; notably any request for runtime APIs beyond network I/O in a provider subpath, or any allowlist growth that is not reason-bearing and reviewed.

### Constraint Compliance Attestation

The chosen alternative (ALT-1) satisfies all constraints C-1 through C-5. No accepted-risk exceptions are taken.

## Trade-offs & Consequences

### Positive Outcomes

- The enforced boundary, the scaffold spec, feature-adapter-ports, and the ADR layer agree after doc-sync; OQ-4 closes with a traceable record.
- The allowance's growth discipline is made explicit and reusable (azure/ci follow the recorded path; the registry exclusion is restated).
- ADR-0003 remains a truthful account of what was decided in October 2026, with refinement layered visibly on top.

### Negative Outcomes

- One more decision record; readers of ADR-0003 alone must follow one pointer for the current confinement truth.
- The dependency-cruiser allowlist grows from six adapter entries to nine — a larger surface to audit, mitigated by per-entry reasons and negative fixtures.
- The pointer note touches an Accepted R3 record's file (`last_updated` changes), which some readers may mistake for a content change; the diff must stay visibly editorial.

### Unresolved Questions

- [ ] Should the runtime-API confinement check eventually validate per-entry reasons mechanically, mirroring the secret-read registry? (owner: future boundary-hardening change; revisit trigger recorded.)
- [ ] Do the CI adapter's future reads need subpath `ci` admitted with its own reason at M0-S20+? (owner: that story; same path.)

## Implementation Plan

1. GH-188 delivery: extend the `runtime-apis-confinement` rule in `.dependency-cruiser.cjs` with `github|gitlab|jira` in the adapters group, each with a per-entry reason comment citing GH-188 and this record; update/extend negative fixtures proving non-exempt paths (e.g., `registry`, `azure`, `ci`) still fail on runtime imports.
2. Doc-sync phase (GH-188): update feature-monorepo-scaffold-toolchain.md's Runtime-API confinement bullet and feature-adapter-ports.md's Security and Boundaries paragraph to enumerate the three provider client subpaths with this record as reference.
3. Doc-sync phase: add the editorial pointer note in ADR-0003 at the DEC-2 confinement bullet and the DEC-6 I/O-home table ("refined by ADR-0005: provider client subpaths performing network I/O are admitted per subpath as reason-bearing entries"), bump `last_updated`, and add `ADR-0005` to its `links.decisions`.
4. Rollout guardrail: the change ships rule, fixtures, and pointer together so no intermediate state diverges.

## Verification Criteria

- Metric: boundary matrix / `pnpm check` green with the three seeds' network I/O present — Target: green — Window: GH-188 CI.
- Metric: negative fixtures — planted runtime imports in `packages/adapters/src/registry/` (and a non-exempt adapter subpath) fail the rule — Target: 100% fire — Window: GH-188 CI.
- Metric: secret-read allowlist entry count and planted-violation firing — Target: exactly 4, still fires — Window: GH-188 CI.
- Metric: consistency of the four surfaces (ADR pointer, this record, scaffold spec, dep-cruiser) — Target: no contradictions in doc-sync review — Window: GH-188 review.

## Confidence Rating

High — the tension, its textual locations, and the precedent (`credentials`) are all verified in the repository; the choice runs with the grain of the project's record discipline and the already-decided GH-188 DEC-1.

## References

- GH-188 spec (DEC-1, DEC-6, OQ-4, RSK-4, §7.1): `doc/changes/2026-10/2026-10-31--GH-188--client-seeds-trap-catalogs/chg-GH-188-spec.md`
- [ADR-0003](ADR-0003-oss-monorepo-structure.md) — DEC-2 confinement rule, DEC-6 adapter subpaths and I/O-home table.
- `.dependency-cruiser.cjs` — `runtime-apis-confinement` rule (lines 201–222).
- [Scaffold spec](../spec/features/feature-monorepo-scaffold-toolchain.md) — Runtime-API confinement bullet.
- [Adapter ports spec](../spec/features/feature-adapter-ports.md) — Security and Boundaries (confinement and secret-read boundary as distinct invariants).
- [ADR-0004](ADR-0004-workitem-activity-timestamp-additive-v1.md) — the sibling GH-188 contract-extension decision.
