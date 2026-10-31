---
id: ADR-0009
decision_type: adr
status: Proposed
created: 2026-10-31
decision_date: null
last_updated: 2026-10-31
summary: "The v1 release model locks the ADR-0003 DEC-3 release contract: one lockstep version line for the five publishable packages as a changesets fixed group, one version/one tag/one release train, tagged signed releases as the stable install source with SHA256SUMS, SBOM, and notices, and CLI/MCP artifacts built per release; M4-S2 owns automation and channel mechanics within this contract and must not reopen the release unit."
owners:
  - "Juliusz Ćwiąkalski"
service: delivery-os release engineering
decision_scope: repo
review_date: null
classification:
  domains: [architecture, operations, tooling]
  archetype: policy
  environment: complicated
  rigor: R2
  reversibility: hard
  stakes: high
  urgency: medium
  uncertainty: low
  blast_radius: org
  recurrence: one-off
governance:
  driver: "@decision-advisor (GH-186)"
  decider: "Juliusz Ćwiąkalski (human; acceptance pending at GH-186 PR review)"
  contributors:
    - "@spec-writer (GH-186 spec §5.1 F-2)"
    - "@decision-advisor (analysis and record)"
  reviewers:
    - "@reviewer"
    - "Owner (human acceptance)"
  performers:
    - "@coder (M4-S2 release automation)"
  informed:
    - "M4-S2 public release readiness"
    - "Release and installer contributors"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: false
  human_decider: null
  reviewers: []
revisit_triggers:
  - "M4-S2 finds the one-version/one-tag release unit unworkable for a publishable package: revisit the release unit through a superseding record, never by changing one package's line silently."
  - "A publishable package joins or leaves the fixed group: revisit the group membership explicitly."
  - "The signed-release provenance, SHA256SUMS, SBOM, or notices requirement cannot be met by the chosen signing mechanism: revisit the mechanism, not the requirement."
links:
  related_changes: ["GH-186"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/spec/features/feature-monorepo-scaffold-toolchain.md"
    - "doc/planning/oss-tooling/roadmap.md"
  contracts: []
  diagrams: []
  decisions: ["ADR-0003"]
  experiments: []
  metrics: []
  roadmap_items: ["M4-S2"]
---

# ADR-0009: Release Model v1

## Context

- **FACT:** ADR-0003 DEC-3 already fixes the runtime, package manager, and toolchain, including the changesets-based versioning and release direction for the five publishable packages (`core`, `adapters`, `cli`, `mcp`, `opencode`); `testkit` is excluded from the published graph.
- **FACT:** The monorepo scaffold feature spec records a lockstep fixed group and a single lockfile, and the roadmap schedules public release readiness at M4-S2. The release unit itself, however, has no durable record that M4-S2 can build on.
- **FACT:** The public baseline installs from tagged releases, so the tag must identify one coherent version of the whole publishable set; per-package independent versions would make "which CLI matches which adapters" ambiguous for installers.
- **Why now:** M4-S2 is the next consumer. Locking the release unit now lets automation and channel mechanics be designed against a fixed contract instead of re-litigating whether packages release together. The M0 exit condition requires the foundational release direction to be recorded.

## Problem Framing (Clarified)

The decision question is the **release unit**, not the automation mechanism: do the five publishable packages version and release as one line or independently, and what must a released artifact carry so an installer can trust it?

Independent versioning optimizes for per-package cadence but fragments the install story and complicates compatibility claims. A single lockstep line makes the install unit unambiguous and lets one tag, one changelog, and one provenance bundle describe the product. The cost is coupled release cadence, which M4-S2 can manage but not unilaterally dissolve.

## Constraints (Hard Requirements)

| ID | Pass/fail requirement | Source | Verification | Negotiable |
|---|---|---|---|---|
| C-1 | The five publishable packages (`core`, `adapters`, `cli`, `mcp`, `opencode`) share one version line as a changesets fixed group; `testkit` stays out of the group and the published graph. | ADR-0003 DEC-3; monorepo scaffold feature spec | changesets config review; published-graph check | no |
| C-2 | One version, one tag, and one release train per release; a release is not assembled from independently versioned packages. | ADR-0003 DEC-3 direction; M4-S2 scope | release procedure review; tag inspection | no |
| C-3 | Tagged signed releases are the stable install source and carry `SHA256SUMS`, an SBOM, and notices. | Roadmap M4 public release exit; installer expectations | release artifact inspection | no |
| C-4 | CLI and MCP artifacts are built per release from the same tagged source. | ADR-0003 DEC-3; package layout | release workflow inspection | no |
| C-5 | M4-S2 owns release automation and channel mechanics within this contract and must not reopen the release unit. | GH-186 scope; roadmap M4-S2 | scope review; change-record boundary | no |

> **Table stakes:** all alternatives preserve the pnpm/Bun toolchain and the six-package workspace; acknowledged once rather than per alternative.

## Decision Drivers

1. **Unambiguous install unit** — one tag identifies a compatible set for installers.
2. **Compatibility clarity** — consumers reason about one version line rather than a matrix.
3. **Provenance integrity** — one signed release carries checksums, SBOM, and notices for the whole shipped set.
4. **Automation simplicity** — M4-S2 automates one train rather than a package graph.
5. **Lock, not redesign** — the record must make the already-decided ADR-0003 direction durable, not invent a new release strategy.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-186).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance pending at GH-186 PR review. The record remains `Proposed` until then.
- **Contributors:** `@spec-writer` (GH-186 §5.1 F-2), ADR-0003 DEC-3.
- **Required reviewers:** `@reviewer`; the owner for acceptance.
- **Performers:** `@coder` in M4-S2 (automation and channel mechanics).
- **Informed:** M4-S2 and installer/release contributors.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|---|---|---|---|---|
| ADR-0003 DEC-3 already fixes lockstep versioning and the release direction. | FACT | `ADR-0003-oss-monorepo-structure.md` DEC-3 | This record would be re-deciding rather than locking; it would need its own alternatives analysis of the direction. | High |
| Five packages form the publishable set and `testkit` is excluded. | FACT | ADR-0003; monorepo scaffold feature spec | Group membership and the published graph would change. | High |
| Tagged signed releases are the intended stable install source. | FACT | `roadmap.md` M4 exit criteria | The artifact/provenance requirements would target the wrong channel. | High |
| `SHA256SUMS`, SBOM, and notices can be produced per release. | ASSUMPTION | Roadmap release requirements | M4-S2 might need a different provenance mechanism; the requirement stays. | Medium |
| M4-S2 can own automation without reopening the unit. | FACT | Roadmap scope; GH-186 §7.2 | M4-S2 could expand into re-deciding the unit, which this record forbids. | High |

## Mental Models & Techniques Used

- **Lock, don't redesign:** the record makes an existing direction durable; it does not re-open the alternatives ADR-0003 already settled.
- **Single-writer / single-tag:** one tag is the authoritative identity of a release.
- **Trust chain:** checksums, SBOM, and notices travel with the signed artifact so an installer can verify what it installs.
- **Second-order thinking:** per-package cadence looks flexible but multiplies the compatibility surface across five packages.
- **Boundary setting:** automation (M4-S2) is separable from the release unit (this record); the boundary prevents scope creep.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

|          | C-1 fixed group | C-2 one tag/train | C-3 signed provenance | C-4 per-release artifacts | C-5 M4-S2 boundary |
|----------|:---:|:---:|:---:|:---:|:---:|
| ALT-0 no recorded model | ❌ | ❌ | ❌ | ❌ | ❌ |
| ALT-1 lockstep fixed group + one signed train (selected) | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 independent per-package versions | ❌ | ❌ | ⚠️ | ✅ | ✅ |
| ALT-3 lockstep, but automation may change the unit | ✅ | ✅ | ✅ | ✅ | ❌ |

Legend: ✅ passes · ❌ fails · ⚠️ passes only via an accepted-risk exception (none taken).

### Alternative 0 — Do Nothing

- **Eligibility:** Not eligible (fails C-1…C-5).
- **Summary:** Leave the release unit implicit.
- **Pros:** No record to maintain.
- **Cons:** M4-S2 has no fixed contract; installers face an ambiguous version story.
- **Why rejected:** The M0 exit requires the release direction to be recorded, and M4-S2 must not re-decide it.

### Alternative 1 — Lockstep Fixed Group with One Signed Release Train (selected)

- **Eligibility:** Eligible.
- **Summary:** The five publishable packages share one version line as a changesets fixed group; one version, one tag, and one release train ship signed artifacts with `SHA256SUMS`, SBOM, and notices; CLI/MCP artifacts are built per release.
- **Constraint compliance:** Passes C-1…C-5.
- **Pros:** Unambiguous install unit; simple automation; one provenance bundle.
- **Cons:** Coupled release cadence; a single package fix forces a group release.
- **Why chosen:** It locks the ADR-0003 direction and is the only alternative that satisfies every constraint.

### Alternative 2 — Independent Per-Package Versions

- **Eligibility:** Not eligible (fails C-1, C-2).
- **Summary:** Each package versions and releases on its own cadence.
- **Pros:** Per-package flexibility.
- **Cons:** Installers must resolve a compatibility matrix; one tag no longer identifies a coherent set; provenance fragments.
- **Why rejected:** Violates the lockstep direction and the single-tag release unit.

### Alternative 3 — Lockstep Unit, but Automation May Change It

- **Eligibility:** Not eligible (fails C-5).
- **Summary:** Adopt lockstep now but let M4-S2 change the release unit while implementing automation.
- **Pros:** Maximum future flexibility.
- **Cons:** The "lock" is not a lock; M4-S2 would re-open a foundational decision under delivery pressure.
- **Why rejected:** The boundary is the point of the record; changing the unit requires a superseding record.

## Decision

- **Recommendation:** Alternative 1.
- **Authorized Decision:** pending — the owner accepts or adjusts at GH-186 PR review. Until then the record is `Proposed` and grants no authority.

### DC-1 — One lockstep version line

The five publishable packages — `core`, `adapters`, `cli`, `mcp`, and `opencode` — version together on one line as a changesets fixed group. `testkit` remains excluded from the group and from every published dependency graph.

### DC-2 — One version, one tag, one release train

Each release has one version, one tag, and one release train. A release is not assembled from independently versioned packages, and a tag identifies the whole compatible set.

### DC-3 — Signed releases as the stable install source

Tagged signed releases are the stable install source. Every release carries `SHA256SUMS`, an SBOM, and notices so an installer can verify the artifacts it installs.

### DC-4 — Per-release CLI and MCP artifacts

The CLI and MCP artifacts are built per release from the tagged source and published as part of the same train.

### DC-5 — M4-S2 boundary

M4-S2 owns release automation, the release job, channel mechanics, and provenance/attestation wiring **within** this contract. It must not reopen the release unit; a change to the unit, group membership, or version-line shape requires a superseding decision record.

- **Decider:** Owner (Juliusz Ćwiąkalski) — acceptance pending at GH-186 PR review.
- **Conditions for revisit:** see `revisit_triggers`; the most important is an M4-S2 finding that the one-version release unit is unworkable.

### Constraint Compliance Attestation

The chosen alternative satisfies all constraints C-1 through C-5: the five publishable packages share one fixed group (C-1); one tag/release train defines a release (C-2); signed artifacts carry checksums, SBOM, and notices (C-3); CLI/MCP artifacts are built per release (C-4); and M4-S2 owns automation without reopening the unit (C-5). No accepted-risk exceptions are taken.

## Trade-offs & Consequences

### Positive Outcomes

- One tag unambiguously identifies a compatible, signed set.
- Installers get checksums, SBOM, and notices from one provenance bundle.
- M4-S2 automates one train instead of a package graph.
- The release direction is durable and citable.

### Negative Outcomes

- A fix in one package forces a group release.
- M4-S2's automation must accommodate the fixed group rather than optimize per package.
- A future group-membership change needs a superseding record.

### Unresolved Questions

- [ ] Confirm the signing mechanism and the exact SBOM format in M4-S2 (owner: M4-S2 delivery).
- [ ] Confirm whether any additional artifact (for example installer scripts) joins the signed release set (owner: M4-S2 delivery).

## Implementation Plan

1. M4-S2 implements the release workflow for the fixed group: one version bump, one tag, one signed release with `SHA256SUMS`, SBOM, and notices.
2. CLI and MCP artifacts are built from the tagged source in the same train.
3. Channel mechanics (publish, install, update) are implemented without changing the release unit.
4. Doc-sync reconciles the release and publish-path documentation with this record.

## Verification Criteria

- Metric: publishable packages on a divergent version line — Target: 0 — Window: M4-S2 CI.
- Metric: releases without a tag, `SHA256SUMS`, SBOM, or notices — Target: 0 — Window: release inspection.
- Metric: release-unit changes made by automation without a superseding record — Target: 0 — Window: decision/index review.

## Confidence Rating

**High.** The record locks a direction already decided in ADR-0003 DEC-3 and recorded in the scaffold spec and roadmap; the remaining uncertainty is the signing/SBOM mechanism, which is scoped to M4-S2 and cannot change the release unit.

## References

- [GH-186 change specification](../changes/2026-10/2026-10-31--GH-186--decision-records-measurement-baseline/chg-GH-186-spec.md) — §5.1 F-2 (release-model lock).
- [ADR-0003](ADR-0003-oss-monorepo-structure.md) — DEC-3 runtime, package manager, toolchain, versioning, and release direction.
- [Monorepo scaffold and toolchain feature spec](../spec/features/feature-monorepo-scaffold-toolchain.md) — changesets fixed group and publish path.
- [Roadmap](../planning/oss-tooling/roadmap.md) — M4 release scope and exit criteria.
