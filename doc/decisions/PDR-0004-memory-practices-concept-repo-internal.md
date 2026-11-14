---
id: PDR-0004
decision_type: pdr
status: Proposed
created: 2026-11-14
decision_date: null
last_updated: 2026-11-14
summary: "The memory-practices concept (meta-learning reference) stays repo-internal source material for ADOS's own delivery: GH-302 aligns and finalizes it in this repository as the upstream authoring source, and it is NOT installed into bootstrapped projects — the bootstrap Phase 5 install surface does not gain doc/planning/concepts/**."
owners:
  - "Juliusz Ćwiąkalski"
service: delivery-os
decision_scope: repo
review_date: null
business_impact: "None directly — keeps the delivered install surface exactly what ticket GH-302 asks for and no larger."
customer_impact: "Adopters receive a self-contained memory convention set (tree, kernel section, rules, doctor checklist, retro conventions); the practices narrative remains available as published repo content rather than as an installed file."
classification:
  domains: [product, documentation, distribution]
  archetype: policy
  environment: complicated
  rigor: R2
  reversibility: easy
  stakes: medium
  urgency: high
  uncertainty: low
  blast_radius: customers
  recurrence: recurring
governance:
  driver: "@decision-advisor (subagent session, consulted by @pm for GH-302 OQ-2)"
  decider: "Juliusz Ćwiąkalski — PM-adopted for the GH-302 autonomous delivery run under DEC-5; owner ratifies or vetoes at the GH-302 open-PR gate (per repo convention, R2 records stay Proposed until a human explicitly decides)"
  contributors:
    - "@pm (OQ framing, ticket-pinned constraints, autonomous-delivery context)"
    - "@spec-writer (chg-GH-302-spec OQ/DEC register and F-6 wording)"
  reviewers:
    - "Juliusz Ćwiąkalski (GH-302 PR review — ratify or veto)"
    - "@decision-critic (optional independent challenge; R2)"
  performers:
    - "@coder (GH-302 delivery — F-6 in-repo alignment; template set stays self-contained; no install-surface expansion)"
  informed:
    - "GH-301 / M2-S8 (owns the typed-record schema and the full committed tree; inherits this boundary for memory-architecture.md and sibling concepts)"
    - "Future concept-doc authors (the class rule: planning concepts are source material, not install surface)"
ai_assistance:
  used: true
  roles: [researcher, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "Adopter demand emerges for a locally bundled practices guide — satisfy it with a purpose-written redistributable guide under doc/guides/ (distribution-marked, curated, kernel-lockstep), never by installing planning concepts wholesale."
  - "GH-301 (M2-S8) lands a final memory architecture that republishes the practices as a first-class distributable artifact — this record's boundary is re-evaluated there."
  - "The owner reconciles the AGENTS.md header-placement phrasing ('files that are installed when users onboard ADOS') with the marker-derived install set — if concepts are deliberately brought into the install scope, supersede this record."
links:
  related_changes: ["GH-302"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-14--GH-302--memory-conventions-bootstrap-templates/chg-GH-302-spec.md"
    - "doc/spec/features/feature-bootstrapper.md"
  contracts: []
  diagrams: []
  decisions: ["ODR-0001"]
  experiments: []
  metrics: []
  roadmap_items: []
---

# PDR-0004: Meta-Learning Reference Stays Repo-Internal — Not Part of the Bootstrap Install Surface

## Context

GH-302 (M2-S9: memory conventions in bootstrap templates) wires the agent-memory learning loop into bootstrap Phase 5. Its F-6 capability requires the existing draft concept `doc/planning/concepts/memory-practices.md` (Status: Draft, 2026-10-26) to be "aligned and finalized as the canonical meta-learning reference," and the spec sentence "the installed convention material points to it as the practices source" presupposes an answer to OQ-2: **does that file stay repo-internal source material, or is it installed into newly bootstrapped projects as part of the Phase 5 install surface?**

Situational facts prompting the decision (verified in-repo on 2026-11-14):

- The Phase 5 install surface today is: `AGENTS.md`, the four `.ai/agent/*-instructions.md`, `doc/documentation-profile.md`, `doc/documentation-handbook.md`, `doc/templates/`, `doc/decisions/` (README + index), `doc/guides/`, and `doc/00-index.md` (SPEC-BOOTSTRAPPER, phase table row 5 and the "Phase 5 outputs" table). `doc/planning/**` is not in it.
- The bootstrapper write allowlist includes a target project's *own* `doc/planning/{backlog.md, epics/**, archive/**}` but not `doc/planning/concepts/**` — concepts are not even a bootstrapper-writable path in a target project.
- `scripts/install.sh` contains no reference to `doc/planning/concepts`; the install mechanism never copies concepts into user projects.
- Since ODR-0001, install membership is declared per document via the `ados_distribution` marker and enforced by the CI drift guard. `memory-practices.md` carries **no** `ados_distribution` marker (its front matter holds only the copyright/source header) — it is outside the distributable class by construction.
- The one conflicting signal: `scripts/add-header-location.sh` includes `doc/planning/concepts` in its header-placement scope, and AGENTS.md describes that scope as "files that are installed when users onboard ADOS."
- 26 concept documents live in `doc/planning/concepts/`, and the OSS-tooling backlog cites them as planning-truth inputs to milestone stories (e.g., M2-S8 names `concepts/memory-architecture.md`). They are upstream source material for ADOS's own delivery — and they will keep iterating with the milestones.
- Ticket #302's acceptance criterion names the memory layout, the kernel section, and the capture/promotion rules wired into ceremonies; the task list names the concepts file for alignment, without installation language.
- The decision is needed mid-delivery: GH-302 runs in autonomous mode (spec DEC-5); the template set and F-6 wording cannot be finalized while OQ-2 is open.

## Problem Framing (Clarified)

The decision question: **which distribution class does the meta-learning reference belong to — repo-internal planning-truth input that GH-302 aligns *in this repository*, or an installed artifact copied into every bootstrapped project — such that the ticket's learning-loop AC is fully satisfied with the smallest reversible install-surface footprint and no second, drift-prone authority surface in target projects?**

Root cause: two repository conventions use overlapping vocabularies for different scopes. The *header-placement* list governs license attribution for content ADOS publishes in its own public Apache-2.0 repository (with public `source:` links), and it partially overlaps — but is not identical to — the *install* surface. The authoritative install-membership mechanisms are the SPEC-BOOTSTRAPPER Phase 5 outputs, the install script, and (since ODR-0001) the distribution-marker system. Concepts appear in the first list and in none of the other three. The conflict is therefore resolvable by identifying which convention actually governs installation, rather than by inventing new policy.

A secondary question rides along: does the bootstrapped project need the *narrative* (rules for every agent / the coordinator / the human, anti-patterns, metrics candidates), or the *practices*? The ticket AC demands the practices — wired into the tree, kernel section, instructions, and conventions. The narrative is authoring input for those carriers.

## Constraints (Hard Requirements)

Table stakes acknowledged once (every alternative below satisfies them by construction): GH-302 ships no tooling or executable code (NG-1/NG-3); the scaffold mirrors the current-truth kernel exactly (DEC-1/NFR-1); ceremonies belong to M2-S3/M2-S10 and the typed-record schema to M2-S8/GH-301.

### C-1: No memory tooling, lint, or code ships in GH-302

- **Statement:** The chosen option requires no script, gate, package, or CLI change; any installation is plain document copying within the existing install mechanism.
- **Source:** internal standard (change NG-1/NG-3, DEC-3).
- **Verification:** code review of the GH-302 diff (documentation and prompt files only).
- **Negotiable:** no

### C-2: Anything added to the install surface is distribution-classified

- **Statement:** Any document installed into bootstrapped projects carries an `ados_distribution` marker and passes the doc-distribution drift guard; unmarked content never enters the install set.
- **Source:** prior decision (ODR-0001) + internal standard (change constraint register C-3 / NFR-4).
- **Verification:** test (`scripts/.tests/test-doc-distribution.sh` in CI).
- **Negotiable:** no

### C-3: Phase-5 surface changes move identically across every contract surface

- **Statement:** Any change to what Phase 5 installs is stated identically in SPEC-BOOTSTRAPPER (outputs table + allowlist), the bootstrapper agent prompt, the inception guide, and the install mechanism — no single-surface drift.
- **Source:** internal standard (change F-7 pattern, RSK-3 mitigation).
- **Verification:** code review cross-checking the surfaces.
- **Negotiable:** no

### C-4: The reference is aligned and finalized before anything treats it as canonical

- **Statement:** The meta-learning reference advances from Draft with its adoption checklist corrected to the scaffolded tree shape (zero contradictions with the scaffold and kernel section) before any artifact — installed or repo-internal — cites it as the practices source.
- **Source:** AC (ticket F-6 / AC-F6-1, DEC-2).
- **Verification:** review comparison against the scaffolded truth (AC-F6-1).
- **Negotiable:** no

### C-5: Nothing that pre-empts GH-301's tree/schema decision enters the installed surface

- **Statement:** No content carrying draft-future memory structure (e.g., the draft checklist's `preferences` and retro-archive areas the current-truth kernel does not name, or typed-record fields) is installed into bootstrapped projects ahead of GH-301.
- **Source:** prior decision (change DEC-1 binding constraint: mirror exactly, anticipate nothing).
- **Verification:** code review of installed template content against the kernel section.
- **Negotiable:** no

## Decision Drivers

1. **Single source of truth / drift minimization** (project priority 5). Every installed surface in a target project that restates memory rules is a surface that can drift from the kernel section. The installed set already carries the practices via tree, kernel, instructions, and conventions; an installed narrative adds a second authority surface that must be maintained in lockstep forever (the change's own NFR-1/R1 lockstep concern, multiplied per project).
2. **Minimal reversible scope; no class precedent without need** (priority 2; reversibility principle). Repo-internal is the minimal, easily reversible option. Installing one concept sets the boundary question for all 26 concept docs — every future concept author would face "is this installed?" — and couples target projects to ADOS planning-truth that iterates with milestones, leaking planning churn into user projects via content-sync.
3. **Paved-road conformance** (priority: prefer the paved road). The declared install surface (Phase 5 outputs + install mechanism + marker system) excludes concepts. Expanding it is novelty that must justify itself; this decision finds no ticket requirement that does.
4. **AC sufficiency.** The ticket AC is fully satisfied by the installed convention set alone; nothing in the AC or task list requires the meta-learning file to ship into target projects.
5. **Adopter value of the practices narrative** (the one driver favoring installation). The concept doc is genuinely useful human-facing material — adoption checklist for existing projects, anti-patterns, metrics candidates. Counterweight: it is published, Apache-2.0, and reachable at the repository's public source link; the audience can read it there.
6. **Install-payload discipline** (change NFR-3 spirit). Phase 5's human gate approves every framework file; keeping the approval surface at what the ticket demands keeps bootstrap light.

## Decision Rights (DACI)

- **Driver:** @decision-advisor (subagent session, consulted by @pm for GH-302 OQ-2).
- **Decider / Approver:** Juliusz Ćwiąkalski (owner). Per repo convention, this R2 record stays `Proposed` until the owner explicitly decides; for the GH-302 autonomous run it is **PM-adopted pending owner review at the open-PR gate** (ratify or veto there).
- **Contributors:** @pm (OQ framing, ticket-pinned constraints); @spec-writer (spec OQ/DEC register, F-6 wording).
- **Required reviewers:** owner at the GH-302 PR review; @decision-critic optional (R2).
- **Performers:** @coder — GH-302 delivery applies the boundary: F-6 alignment happens in-repo; the template set stays self-contained; no install-surface expansion.
- **Informed:** GH-301 / M2-S8 (inherits the boundary for sibling concepts); future concept-doc authors.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| SPEC-BOOTSTRAPPER Phase 5 outputs and write allowlist contain no `doc/planning/**` install entry and no `doc/planning/concepts/**` allowlist entry | FACT | `doc/spec/features/feature-bootstrapper.md` (phase table row 5; Phase 5 outputs table; write allowlist) | ALT-2 would become the paved road; decision flips | High |
| `scripts/install.sh` never copies `doc/planning/concepts` (no reference) | FACT | grep of `scripts/install.sh` | Same as above | High |
| Install membership is marker-derived (ODR-0001) and `memory-practices.md` carries no `ados_distribution` marker | FACT | ODR-0001; file front matter | Installing without markers would be the norm, weakening C-2 | High |
| Header-placement scope includes `doc/planning/concepts` while AGENTS.md phrases that scope as "files that are installed when users onboard ADOS" | FACT | `scripts/add-header-location.sh` DEFAULT_PATHS; AGENTS.md license-headers section | The conflicting signal disappears; interpretation below unnecessary | High |
| 26 concept docs exist; the backlog cites them as planning-truth inputs to milestone stories (M2-S8 names `memory-architecture.md`) | FACT | `doc/planning/concepts/` listing; `doc/planning/oss-tooling/backlog.md` (M2-S8 entry) | Precedent weight of the decision drops from class-wide to single-file | High |
| Ticket #302 AC names layout + kernel section + capture/promotion rules; task list names the concepts file without installation language | FACT | chg-GH-302-spec §2.1/Appendix B (ticket verbatim captured and validated at clarify_scope) | An installation requirement would exist; ALT-1 would fail the ticket | High |
| The header list is an attribution scope for published repo content, not an install manifest — the phrase in AGENTS.md is imprecise, and the marker system is the governing install-membership mechanism | ASSUMPTION | reasoned from: three independent mechanisms (spec surface, install script, marker system) exclude concepts; headers carry public `source:` links serving readers of this repo; the marker system post-dates and explicitly replaces hand-maintained install allowlists | If headers were the intended install manifest, install.sh is under-delivering — owner reconciles (revisit trigger); the decision outcome would be contested at PR review | Medium-High |
| The repo remains publicly readable so the published concepts URL keeps serving adopters as further reading | ASSUMPTION | repo is public Apache-2.0; AGENTS.md branch-model note (source links currently point at `main-tools` until public release) | Further-reading links degrade; adopter narrative access needs another carrier (guide) | Medium-High |

No TO-CONFIRM items remain: all decisive evidence is local and was read directly.

## Mental Models & Techniques Used

- **Paved road:** the declared install surface (Phase 5 outputs + marker system) is the road; staying on it beats extending it without a requirement that demands extension.
- **Reversible vs one-way doors:** repo-internal is a two-way door (a later change can always install a curated guide). Installing distributes copies into user projects that content-sync keeps overwriting — retraction leaves stale copies behind; closer to a one-way door.
- **Single source of truth / DRY across authority surfaces:** the kernel section is the in-project memory authority; every additional installed restatement multiplies drift surface (second-order effect: NFR-1 lockstep cost grows per installed artifact, per project).
- **Inversion ("what would make each option wrong?"):** installing is wrong if it creates dual authority, class precedent, and planning-churn leakage; not installing is wrong only if adopters cannot reach the narrative — mitigated by the published URL and self-contained installed conventions.
- **Opportunity cost:** the only thing ALT-2 buys beyond ALT-1 is a local copy of a narrative already publicly readable — purchased at the price of a class-wide boundary precedent.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

|          | C-1 (no tooling) | C-2 (marker-classified) | C-3 (surfaces move together) | C-4 (aligned before canonical) | C-5 (no GH-301 pre-emption) |
|----------|----|----|----|----|----|
| ALT-0 — do nothing | ✅ | ✅ | ✅ | ❌ | ✅ |
| ALT-1 — repo-internal aligned reference | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 — install the aligned reference | ✅ | ⚠️ (compliant only after adding marker + gate + four-surface updates — additional work, not an exception) | ✅ (same work condition) | ✅ | ✅ |
| ALT-3 — install as-is (Draft) now | ✅ | ❌ | ✅ | ❌ | ❌ |

Legend: ✅ = passes · ❌ = fails · ⚠️ = passes only via additional compliance work (the constraint's work items become delivery scope).

### Alternative 0 — Do Nothing / Keep Current Approach

- **Eligibility:** Not eligible (fails C-4).
- **Summary:** Leave the concept Draft and unaligned; implement no pointer; F-6 unfulfilled.
- **Constraint compliance:** Fails C-4 — GAP-4 (reference disconnected from the conventions, checklist contradicting the scaffold) persists; nothing may cite it as canonical.
- **Driver fit:** Satisfies D2/D6 by accident; fails D1 (misaligned narrative still exists and misleads) and the change's own AC set.
- **Pros:** Zero work.
- **Cons:** GH-302 F-6/AC-F6-1 unmet; the contradiction between the draft checklist and the scaffold ships unresolved.
- **Why rejected:** Fails the change's acceptance criteria; not a real option.

### Alternative 1 — Repo-Internal Aligned Reference (CHOSEN)

- **Eligibility:** Eligible (passes every constraint).
- **Summary:** GH-302 aligns and finalizes `memory-practices.md` **in this repository** (status advanced, checklist corrected per DEC-2, kernel template consistent with F-2). It serves as the upstream authoring source for the installed conventions. The Phase 5 install surface does not change because of it. Installed memory conventions are self-contained; they may cite the ADOS repository's published reference as optional further reading, never as a dependency.
- **Constraint compliance:** All pass. No tooling; no new distributable doc; no Phase-5 surface change; alignment precedes canonical status; nothing draft-future installs anywhere.
- **Driver fit:** Best on D1 (single in-project authority), D2 (minimal, reversible, no class precedent), D3 (paved road), D4 (AC fully satisfied), D6. Weaker only on D5 — narrative not bundled locally, mitigated by the public URL.
- **Pros:** Smallest diff; zero drift surface added; the 26-doc class stays planning-internal by default; trivially reversible.
- **Cons:** Adopters must read the narrative from the ADOS repo; the spec's F-6 sentence ("installed convention material points to it as the practices source") must be adjusted to the self-contained wording.
- **Why chosen:** Wins the top three drivers; its only cost is covered by publication.

### Alternative 2 — Install the Aligned Reference into the Phase 5 Install Surface

- **Eligibility:** Eligible (all constraints pass after compliance work: add `ados_distribution` marker, extend the distribution-test scope, add the file to Phase 5 outputs + allowlist + bootstrapper prompt + inception guide + install mechanism).
- **Summary:** After F-6 alignment, treat the concepts doc like an installed guide: marker, install membership, sync-tracked copy in every bootstrapped project.
- **Constraint compliance:** Passes with the C-2/C-3 work items folded into delivery scope.
- **Driver fit:** Wins D5 only. Loses D1 (second authority surface in every project, forever lockstep), D2 (class precedent for all 26 concept docs; planning churn syncs into user projects; retraction awkward), D3 (surface expansion), D6 (heavier Phase 5 approval set).
- **Pros:** Local narrative copy; offline availability.
- **Cons:** Precedent + dual authority + sync churn, bought for content already publicly readable.
- **Why rejected:** The only driver it wins is served cheaper by the public URL. If demand ever materializes, the paved path is a purpose-written redistributable **guide** under `doc/guides/` — curated, kernel-lockstep, marker-classified — not planning concepts wholesale (revisit trigger).

### Alternative 3 — Install As-Is (Draft, Unaligned) Now

- **Eligibility:** Not eligible (fails C-2, C-4, C-5).
- **Summary:** Copy the current Draft into the install surface and align later.
- **Constraint compliance:** Unmarked content in the install set (C-2); Draft treated as canonical (C-4); leaks the draft's extra tree areas and pre-empts GH-301 (C-5).
- **Driver fit:** Moot — eliminated at the gate.
- **Why rejected:** Disqualifying constraint violations; recorded to make the eliminating constraints observable.

## Decision

- **Decision:** **Alternative 1.** The meta-learning reference (`doc/planning/concepts/memory-practices.md`) stays **repo-internal source material**. GH-302 delivers F-6 as in-repo alignment and finalization; it does **not** extend the bootstrap Phase 5 install surface, and `doc/planning/concepts/**` does not join it — for this file and, as the standing default, for the concept-doc class. Installed memory conventions are self-contained and may cite the ADOS repository's published reference as optional further reading only.
- **Rationale (tied to drivers):** The ticket AC (D4) is fully satisfied by the installed convention set; the install surface's three governing mechanisms all exclude concepts (D3 paved road); installing would add a permanent second authority surface (D1) and set a 26-doc class precedent coupled to planning-truth iteration (D2), in exchange for a narrative already publicly readable (D5). The header-placement signal is attribution scope, not install scope (see Evidence, ASSUMPTION row 2).
- **Decider:** Juliusz Ćwiąkalski (owner). PM-adopted for the GH-302 autonomous delivery run under DEC-5; the owner ratifies or vetoes at the GH-302 open-PR gate. This record remains `Proposed` (with `decision_date: null`) until that human decision, per repo convention.
- **Conditions for revisit:** See `revisit_triggers` in the front matter (adopter demand for a bundled guide → purpose-written `doc/guides/` guide, not concepts wholesale; GH-301 republishing the practices as a distributable artifact; owner reconciliation of the header-scope phrasing).

### Constraint Compliance Attestation

The chosen alternative (ALT-1) satisfies all constraints C-1 … C-5: it ships no tooling (C-1); it adds nothing to the install surface, so no marker/distribution-gate obligation arises (C-2); no Phase-5 contract surface changes, so the four-surface identity requirement is vacuously met (C-3); the reference is aligned and advanced from Draft before being cited as canonical (C-4, via F-6/AC-F6-1); and no draft-future content is installed anywhere (C-5). No accepted-risk exceptions are recorded.

## Trade-offs & Consequences

### Positive Outcomes

- The GH-302 install-surface diff is exactly what the ticket demands (memory artifacts) and nothing larger; the F-7 containment work stays limited to the memory tree root.
- One in-project memory authority (the kernel section plus the installed conventions); NFR-1 drift risk is not multiplied.
- Planning-truth iteration of the concepts doc (which will continue with M2-S8/M2-S10) never leaks churn into bootstrapped projects.
- Future concept-doc authors have a recorded default: concepts are upstream source material, not install payload.
- Cheaply reversible: a later change can always ship a curated, marker-classified guide.

### Negative Outcomes

- Bootstrapped projects do not receive a local copy of the human-facing narrative (adoption checklist, anti-patterns, metrics candidates); adopters reach it via the ADOS repository.
- The spec's F-6 sentence ("the installed convention material points to it as the practices source") must be adjusted to the self-contained wording (spec edit rides the same change; see Implementation Plan).
- The AGENTS.md header-placement phrasing remains imprecise about `doc/planning/concepts` — either the phrase or the install set is the anomaly; left for the owner to reconcile (below), not fixed by GH-302.

### Unresolved Questions

- [ ] Should AGENTS.md's header-placement rationale be reworded to distinguish "published repo content" (attribution scope) from "installed content" (marker-derived install set)? (owner: Juliusz Ćwiąkalski; optional; separate change — do not fold into GH-302)
- [ ] If adopters ask for a local practices guide, author it as a purpose-built redistributable guide under `doc/guides/` rather than installing concepts wholesale. (owner: future change; revisit trigger recorded)

## Implementation Plan

1. **Spec text (GH-302, rides the same change):** resolve OQ-2 with the PDR-0004 wording (provided to @pm); adjust F-6's final clause so the installed convention material is self-contained, citing the ADOS repository's published reference as optional further reading rather than as an installed dependency; add the decision to the spec's Decision Log; add `links.decisions: ["PDR-0004"]` to the change-spec front matter.
2. **Delivery boundary (GH-302, @coder):** F-6 alignment work happens in-repo on `doc/planning/concepts/memory-practices.md` (status advance, DEC-2 checklist correction, kernel-template consistency); the change touches no install-mechanism file for concepts (no `install.sh`, no Phase 5 outputs row, no allowlist entry, no bootstrapper-prompt install statement).
3. **Self-containment check (GH-302, review phase):** verify no installed/bootstrapped artifact *requires* the concepts file — the kernel section, coordinator instructions, scaffold entry-point READMEs, doctor checklist, and retro conventions carry the needed rules directly; at most they link the public repo URL.
4. **Rollout guardrails:** the distribution gate stays green precisely because no new distributable doc is claimed; `pnpm check` (incl. doc-distribution test) is the authoring-time evidence.

## Verification Criteria

- The GH-302 diff adds no concept-install surface: no `doc/planning/concepts` reference in `scripts/install.sh`, SPEC-BOOTSTRAPPER Phase 5 outputs, the write allowlist, the bootstrapper prompt, or the inception guide. — Target: zero; Window: GH-302 PR review.
- The concepts doc is aligned in-repo and advances from Draft (covered by AC-F6-1). — Target: zero contradiction findings; Window: GH-302 review phase.
- Self-containment: every installed memory artifact stands alone; any reference to the meta-learning reference is optional further reading (public URL), not a dependency. — Target: 100% of installed memory artifacts; Window: GH-302 review phase.
- Distribution gate green with no new distributable-doc claims. — Target: pass; Window: CI on the GH-302 PR.
- Post-merge signal: no adopter confusion reports about a missing local practices file (negative check). — Target: zero; Window: until first retro / review_date once Accepted.

## Confidence Rating

**High.** Every decisive fact is local and was read directly (spec surface, allowlist, install script, marker system, header script, backlog references, the concept file itself). The single interpretive step — header scope is attribution, not installation — is corroborated by three independent mechanisms that all exclude concepts, and carries a recorded revisit trigger if the owner reads the header list as an intended install manifest.

## References

- Change spec: [chg-GH-302-spec.md](../changes/2026-11/2026-11-14--GH-302--memory-conventions-bootstrap-templates/chg-GH-302-spec.md) (OQ-2; DEC-1/DEC-2/DEC-5; F-6; constraint register)
- System spec: [feature-bootstrapper.md](../spec/features/feature-bootstrapper.md) (Phase 5 outputs; write allowlist)
- [ODR-0001 — distribution classification](ODR-0001-classify-yaml-register-templates-redistributable.md) (marker-derived install set)
- The reference in question: [memory-practices.md](../planning/concepts/memory-practices.md) (Draft, 2026-10-26)
- Mechanism evidence: `scripts/install.sh` (no concepts entry), `scripts/add-header-location.sh` (concepts in header scope)
- Project conventions: [.ai/agent/decision-instructions.md](../../.ai/agent/decision-instructions.md), [decision-records-management.md](../guides/decision-records-management.md)
