---
id: ODR-0004
decision_type: odr
status: Proposed
created: 2026-11-14
decision_date: null
last_updated: 2026-11-14
summary: "From M2-S18 (GH-309) the flat record set of managed checkouts renames from `projects list` to `repos list` under `repos.v1` (field renames `projectKey → repoKey` and `data.projects[] → data.repos[]`; flat-surface errors move to the `repos.*` prefix), `projects list` enumerates project groups under `project-groups.v1`, and `projects list --flat` is the deprecation alias returning the delivered `projects.v1` payload unchanged until the M3 boundary — a supersession of ODR-0003 scoped solely to the command name of the flat record set enumeration, lawful only as superseding record plus code change together, with every other part of the v1 naming lock unchanged."
owners:
  - "Juliusz Ćwiąkalski"
service: delivery-os command surface
decision_scope: repo
review_date: null
classification:
  domains: [tooling, ux, operations]
  archetype: policy
  environment: clear
  rigor: R2
  reversibility: hard
  stakes: medium
  urgency: medium
  uncertainty: low
  blast_radius: org
  recurrence: one-off
governance:
  driver: "@decision-advisor (GH-309)"
  decider: "Juliusz Ćwiąkalski (human; ratification pending at GH-309 PR review — merge does not auto-accept)"
  contributors:
    - "@spec-writer (GH-309 spec §5.1 F-7/F-8/F-10, §15 DEC-1/DEC-2)"
    - "@decision-advisor (analysis and record)"
  reviewers:
    - "@reviewer"
    - "Owner (human acceptance)"
  performers:
    - "@coder (GH-309 rename code, alias, and registry row move)"
    - "A later M3-boundary change (alias retirement)"
  informed:
    - "CLI, MCP, and documentation contributors"
    - "M2-S19 cross-repository changes (consumes the delivered boundary)"
    - "M3-S6 repos hygiene verbs (extends the `repos` family)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: false
  human_decider: null
  reviewers: []
revisit_triggers:
  - "The `projects list --flat` alias is still served after the M3 boundary: the retirement obligation has lapsed — schedule the retirement change or re-decide the window explicitly."
  - "A delivered surface, help text, or doc uses `projects` for the flat record set or `repos` for a group after GH-309 lands: the boundary is drifting — correct the surface per the rename rule, never by redefining a name in place."
  - "A further rename of a locked command name is proposed: ODR-0003 DC-4 applies unchanged — a superseding decision record plus a code change, never a documentation-only edit; this record's scoped-supersession pattern is the template."
  - "The group surface needs a different command name: that decision supersedes this record's group-surface clause (DC-1) by the same record-plus-code rule."
links:
  related_changes: ["GH-309"]
  supersedes: ["ODR-0003"]
  superseded_by: []
  spec:
    - "doc/planning/oss-tooling/cli-command-registry.md"
  contracts:
    - "doc/planning/oss-tooling/milestones/m2/contracts.md"
  diagrams: []
  decisions: ["ODR-0003", "TDR-0022"]
  experiments: []
  metrics: []
  roadmap_items: ["M2-S18"]
---

# ODR-0004: Flat Record Set Command Rename (`projects` → `repos`) under a Scoped ODR-0003 Supersession

## Context

- **FACT:** ODR-0003 locked the v0 registry as the v1 public command surface on 2026-10-31, including the `projects` family name. Its DC-4 freeze rule states that after M0 a rename of a locked name requires a **superseding decision record plus a code change**; a documentation-only edit never renames a command. Its revisit trigger 1 names the path: a command name found to violate one-meaning-per-name in a way that misroutes operators — rename via superseding record plus code change.
- **FACT:** GH-288 (M2-S11) delivered `projects list` as the flat record set of managed checkouts: the `projects.v1` envelope with `data.projects[]`, `projectKey`, and `hostIndexRevision`, on the multi-repository workstation state scope delivered under TDR-0022.
- **FACT:** The M2 domain-model amendment (2026-11-11, GH-303) fixed the three-level domain model — a repository is one checkout and the delivery unit, a project group is a configured group of repositories, a workspace is an optional discovery root — and split the contracts: `project-groups.v1` (`data.groups[]`, `groupKey`) is the group contract, the delivered `projects.v1` payload stays the flat record set, and the planned flat surface is `repos.v1` (`data.repos[]`, `repoKey`).
- **FACT:** The M2 contracts state the rename rule once: **from M2-S18, `projects list` enumerates groups and `repos list` enumerates the flat record set; the deprecation alias is `projects list --flat`, owned by M2-S18, returning the delivered `projects.v1` payload and retiring at the M3 boundary.** The boundary note adds that `repos` = the flat record set (and, later, its clone/branch/worktree hygiene subcommands) and `projects` = the group surface, and the two names never carry the same meaning.
- **FACT:** The command registry currently carries one delivered `projects` row (M2-S11, shipped in GH-288) and one prospective `repos` row marked *Not delivered: pending the superseding decision record and code change required by ODR-0003*.
- **FACT:** GH-309 (M2-S18) declares this superseding record a deliverable and a delivery-phase dependency (spec §5.1 F-10, §15 DEC-2, DoD-11): it must exist before any rename code lands, and the registry `repos` row moves to Delivery only together with the code change.
- **Why now:** the delivered `projects` name now collides with the group meaning the domain model assigns it, M2-S18's delivery is gated on this record existing first, and every later consumer (group-scoped reads, M2-S19 cross-repository changes, M3-S6 hygiene verbs) assumes the boundary is delivered code.

## Problem Framing (Clarified)

The delivered `projects list` names the flat record set of managed checkouts. The M2 domain model assigns the `projects` name to groups. One name now carries two candidate meanings — exactly the one-meaning-per-name violation ODR-0003's revisit trigger 1 anticipates. Three questions separate:

1. **The rename:** which command token enumerates the flat record set from M2-S18, and what moves with it (fields, error identities)?
2. **The transition:** what happens to consumers of the delivered `projects.v1` payload while the rename lands, and when does the transition end?
3. **The governance:** how is the rename lawful under ODR-0003 DC-4 (record plus code change, never documentation-only), and how is a **partial** supersession of ODR-0003 expressed without misstating the rest of its lock as retired?

Out of scope: the permanent repository vocabulary (which keeps `project*` names for checkouts by design), the board's scoping (unchanged), and the group contract's field design (owned by `project-groups.v1`).

## Constraints (Hard Requirements)

| ID | Pass/fail requirement | Source | Verification | Negotiable |
|---|---|---|---|---|
| C-1 | The rename ships as a superseding decision record **plus** a code change together; a documentation-only edit never renames a command. | prior decision (ODR-0003 DC-4); GH-309 DEC-2 | code review; commit-order review | no |
| C-2 | The delivered `projects.v1` payload stays reachable **unchanged** through the `projects list --flat` alias until the M3 boundary; any field or shape drift in the alias payload fails. | AC (GH-309 C-2, AC-F7-1); contracts rename rule | test (alias byte-compat check against the delivered payload) | no |
| C-3 | One meaning per name holds after the rename: `repos` denotes the flat record set of managed checkouts and `projects` denotes groups; the two names never carry the same meaning. | prior decision (ODR-0003 C-1/DC-1); contracts boundary note | audit (registry, help text, docs) | no |
| C-4 | The permanent repository vocabulary is unchanged by this decision: the identity marker `project-identity.json`, the `<host root>/projects/<key>` container, the host index `projects[]`/`projectKey` fields, and the `--project-root` flag still denote a repository checkout. | internal standard (contracts `repos.v1` "Repository vocabulary") | code review | no |
| C-5 | `board --project` stays a repository key; the board is never group-scoped. | prior decision (M2 domain-model amendment point 4); GH-309 DEC-3/NG-3 | audit (board surface review) | no |
| C-6 | This record precedes all rename code, and the registry `repos` row moves to Delivery only in the same change as the delivered code (GH-309). | AC (GH-309 F-10, AC-F10-1, DoD-11, DEC-2) | decision-register inspection; commit-order review | no |

> **Table stakes:** all alternatives keep the M1 contract continuity (envelope shape, exit-code meaning, state-layer validation), the registry structure, and the `ados` working-name branding seam; acknowledged once rather than per alternative.

## Decision Drivers

1. **One meaning per name** — the delivered `projects` flat set now collides with the group meaning; a guessed command must be the right command (highest).
2. **ODR-0003's own revisit trigger** — the governance path for exactly this defect is already paved; following it keeps the freeze rule enforceable and credible.
3. **Consumer stability** — consumers of the delivered `projects.v1` payload keep working through the alias for a bounded window.
4. **Operator mental model** — `repos` = checkouts, `projects` = groups; the vocabulary becomes guessable and self-explaining.
5. **Bounded transition cost** — the alias plus the M3 retirement date the breakage explicitly instead of leaving it open-ended.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-309).
- **Decider / Approver:** Juliusz Ćwiąkalski — ratification pending at GH-309 PR review; per repo convention, merge does not auto-accept. The record remains `Proposed` and grants no authority until then.
- **Contributors:** `@spec-writer` (GH-309 spec §5.1 F-7/F-8/F-10, §15 DEC-1/DEC-2), the M2 milestone contracts and domain-model amendment.
- **Required reviewers:** `@reviewer`; the owner for acceptance.
- **Performers:** `@coder` for the GH-309 rename code, alias, and registry row move; a later M3-boundary change for the alias retirement.
- **Informed:** CLI/MCP/documentation contributors, M2-S19, M3-S6.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|---|---|---|---|---|
| GH-288 (M2-S11) delivered `projects list` as the flat record set: `projects.v1` with `data.projects[]`, `projectKey`, `hostIndexRevision`. | FACT | registry `ados projects` row; status.md M2 delivery snapshot 2026-11-11; TDR-0022 | No delivered flat surface exists to rename; the collision and this record would be moot. | High |
| ODR-0003 DC-4 requires a superseding record plus a code change for any post-M0 rename, and revisit trigger 1 names the one-meaning-per-name violation path. | FACT | ODR-0003 | The rename would need a different lawful path, or none. | High |
| The M2 contracts and the 2026-11-11 domain-model amendment record the boundary, the rename rule, the alias, the field renames, and the M3 retirement once, as planning truth. | FACT | contracts.md; status.md §M2 domain-model amendment | The decision would be inventing a boundary rather than delivering a documented one. | High |
| The registry `repos` row is prospective and marked Not delivered pending this record plus the code change. | FACT | cli-command-registry.md (`ados repos` row) | The sequencing constraint (C-6) would target a non-existent row. | High |
| GH-309 declares this record a pre-delivery dependency: it must exist before any rename code lands (F-10, DEC-2, DoD-11). | FACT | chg-GH-309-spec | The gate ordering would need re-derivation; the record could land after the code. | High |
| No consumer outside this repository depends on the `projects list` token or the delivered flat payload beyond the alias window. | ASSUMPTION | pre-public-release state (public readiness is M4); registry consumers are internal | The alias window may need adjusting, or external consumers need migration support before retirement. | Medium |
| The M3 boundary date and the owning story for the alias retirement are not yet fixed. | TO-CONFIRM | contracts say only "the M3 boundary"; no story owns the retirement | The retirement obligation could lapse; revisit trigger 1 covers the lapse case. | — |

## Mental Models & Techniques Used

- **One meaning per name:** a name is an identity, not a label — the collision is the defect, not an inconvenience.
- **Freeze + scoped supersede:** stability is the default; change is explicit, priced, and scoped to exactly the clause that moved.
- **Inversion:** design from an operator guessing a command — after the rename, `repos list` is the only guess that returns checkouts and `projects list` the only one that returns groups.
- **Second-order thinking:** retiring the alias at M3 breaks any lingering flat-payload consumer; dating the retirement now and tracking it as an obligation is the second-order consequence handled up front.
- **Opportunity cost:** keeping the flat set under `projects` avoids today's rename cost but compounds the collision into every group-scoped surface that follows.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

|          | C-1 record+code | C-2 alias payload | C-3 boundary | C-4 permanent vocab | C-5 board repo key | C-6 row-with-code |
|----------|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 keep flat set under `projects`, name groups differently | ✅ (no rename proposed) | ✅ | ❌ | ✅ | ✅ | ✅ |
| ALT-1 rename with deprecation alias until M3 (selected) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 rename with no alias | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |

Legend: ✅ passes · ❌ fails · ⚠️ passes only via an accepted-risk exception (none taken).

### Alternative 0 — Keep the Flat Set under `projects`, Name Groups Differently

- **Eligibility:** Not eligible (fails C-3).
- **Summary:** No rename: `projects list` keeps enumerating the flat record set and a new, different family name is minted for groups.
- **Constraint compliance:** Passes C-1 vacuously (no rename occurs), C-2, C-4, C-5, C-6; fails C-3 — it contradicts the documented boundary (`repos` = flat set, `projects` = groups) and the M2 domain-model amendment, and it plants a near-synonym collision: a differently-named group family sitting beside repository vocabulary that permanently keeps `project*` names for checkouts (the host index `projects[]`, `projectKey`, `--project-root`).
- **Driver fit:** Weak on the top driver — the one-name-two-meanings defect is exactly what ODR-0003's revisit trigger 1 exists to fix, and ALT-0 preserves it.
- **Pros:** Zero rename cost; no alias window.
- **Cons:** The collision the domain model already rejected; every group-scoped surface (queue/status scopes, M2-S19) inherits the ambiguity; the boundary stays planned-only.
- **Why rejected:** Fails C-3 (`negotiable: no`); no driver score rescues an ineligible option.

### Alternative 1 — Rename with Deprecation Alias until M3 (selected)

- **Eligibility:** Eligible.
- **Summary:** From M2-S18, `repos list` enumerates the flat record set under `repos.v1` (fields renamed `projectKey → repoKey`, `data.projects[] → data.repos[]`; flat errors to the `repos.*` prefix); `projects list` enumerates groups under `project-groups.v1`; `projects list --flat` returns the delivered `projects.v1` payload unchanged and retires at the M3 boundary.
- **Constraint compliance:** Passes C-1…C-6.
- **Driver fit:** Strongest — resolves the collision (driver 1) via the paved governance path (driver 2), keeps delivered-payload consumers working (driver 3), and yields the guessable vocabulary (driver 4) with a dated transition (driver 5).
- **Pros:** Boundary delivered as code; consumer stability; the freeze rule exercised exactly as designed.
- **Cons:** Two tokens for one operation during the alias window; the retirement is a tracked future obligation; the rename carries record-plus-code ceremony.
- **Why chosen:** The only alternative that satisfies every constraint while resolving the naming defect.

### Alternative 2 — Rename with No Alias

- **Eligibility:** Not eligible (fails C-2).
- **Summary:** Rename immediately and completely: `repos list` enumerates the flat set; `projects list` enumerates groups; the delivered `projects.v1` payload has no successor surface.
- **Constraint compliance:** Fails C-2 (`negotiable: no`): the delivered payload becomes unreachable and every consumer of it breaks at the rename commit.
- **Driver fit:** Satisfies drivers 1, 2, and 4 but violates consumer stability (driver 3) outright.
- **Pros:** Cleanest end state; no alias window to retire.
- **Cons:** Immediate, unbounded breakage of delivered-payload consumers — precisely what the alias exists to prevent.
- **Why rejected:** Fails C-2; consumer stability is a hard gate, not a tradeable preference.

## Decision

- **Recommendation:** Alternative 1.
- **Authorized Decision:** pending — the owner ratifies or adjusts at GH-309 PR review. Until then this record is `Proposed` and grants no authority; per repo convention, merge does not auto-accept. This record must exist (as this file) before any rename code lands, per C-6.

### DC-1 — The rename (command surface)

From the M2-S18 delivery (GH-309), `projects list` enumerates project groups under `project-groups.v1` (`data.groups[]` with `groupKey`), and `repos list` enumerates the flat record set of managed checkouts under `repos.v1` (`data.repos[]` with `repoKey`, `root`, `stateLocation`, `daemonReachable`, `handoverState`, plus `hostIndexRevision`). On the flat surface, the fields rename `projectKey → repoKey` and `data.projects[] → data.repos[]`, and the flat surface's error identities move to the `repos.*` prefix (`repos.identity-unreadable` exit 1; `repos.registry-corrupt` and `repos.state-unavailable` exit 2), replacing the delivered `projects.*` identities on that surface.

### DC-2 — The deprecation alias

`projects list --flat` is the deprecation alias: it returns the delivered `projects.v1` payload unchanged (`data.projects[]`, `projectKey`, `hostIndexRevision`). The alias is owned by M2-S18 (GH-309) and retires at the M3 boundary. The retirement is a **tracked obligation for a later change** — not part of GH-309 — and is protected by revisit trigger 1.

### DC-3 — Permanent vocabulary and board scope

The repository vocabulary is unchanged and permanent: the identity marker `project-identity.json`, the `<host root>/projects/<key>` container, the host index `projects[]`/`projectKey` fields, and the `--project-root` flag still denote a repository checkout, absent a future code change renaming them. `board --project` stays a repository key and the board is never group-scoped (the board's planned `repositories[]` field binds M2-S4's future delivery, not this change); the group-scoped reads are `queue list --project <groupKey>` and `status --project <groupKey>`.

### DC-4 — Lawful only as record plus code change together

This record authorizes nothing by itself. The rename is lawful only as this superseding decision record **plus** the GH-309 code change delivered together, per ODR-0003 DC-4. The command registry's `repos` row moves to Delivery only in the same change as the delivered code; until then it stays prospective and the shipped `projects list` flat surface remains pre-rename current truth. If the GH-309 rename code does not land, this record's rename stays undelivered planning truth and the delivered surface keeps its delivered name.

### DC-5 — Supersession scope (scoped, not full)

This record supersedes ODR-0003 **solely for the command name of the flat record set enumeration** — the assignment of the flat-record-set meaning to the `projects` name (the `ados projects` family insofar as ODR-0003's v1 lock applied it to the flat set). **Every other part of ODR-0003's v1 naming lock remains in force:** the one-meaning-per-name rule and near-synonym rejection (DC-1), family grouping, the confirmed `provider` family, `provider-quota` adapters subpath, and `DeliveryRequest` primitive term (DC-2), the freeze rule itself (DC-4), and the M4-S1 branding boundary. ODR-0003's status is unchanged — it is not fully superseded, so `superseded_by` is not set on it: the management guide's field denotes full replacement, and this partial supersession is recorded here, in `links.supersedes`, and in the register row instead. A future record that replaces ODR-0003 wholesale would set that field and flip its status then.

- **Decider:** Owner (Juliusz Ćwiąkalski) — ratification pending at GH-309 PR review.
- **Conditions for revisit:** see `revisit_triggers`; the most important are an alias still served past the M3 boundary and any boundary drift after delivery.

### Constraint Compliance Attestation

The chosen alternative satisfies all constraints C-1 through C-6: the rename ships as this record plus the GH-309 code change together (C-1); the alias returns the delivered `projects.v1` payload unchanged until the M3 boundary (C-2); after the rename `repos` means the flat record set and `projects` means groups, never the same meaning (C-3); the permanent repository vocabulary is untouched (C-4); `board --project` stays a repository key and the board is never group-scoped (C-5); this record precedes all rename code and the registry `repos` row moves to Delivery only with the code change (C-6). No accepted-risk exceptions are taken.

## Trade-offs & Consequences

### Positive Outcomes

- The documented naming boundary becomes delivered code instead of planned truth.
- Consumers of the delivered `projects.v1` payload keep a byte-compatible surface for a bounded window.
- The freeze rule is exercised exactly as designed — the first scoped supersession proves the ODR-0003 governance path works end to end.
- The vocabulary becomes guessable: `repos` returns checkouts, `projects` returns groups.

### Negative Outcomes

- Two tokens enumerate one operation during the alias window (`repos list` and `projects list --flat`); the ambiguity is bounded by the M3 retirement.
- The alias retirement is a new tracked obligation; if it lapses, revisit trigger 1 forces it back onto the agenda.
- The repository vocabulary deliberately keeps `project*` names for checkouts while the command `projects` denotes groups — a permanent tension the boundary note exists to explain, now resting on this record.
- Any consumer that missed the transition breaks at the M3 boundary, not gracefully.

### Unresolved Questions

- [ ] The M3 boundary has no fixed date and the alias retirement has no named owning story yet (owner: owner/planning; revisit trigger 1 covers the lapse).
- [ ] Owner ratification at the GH-309 PR review remains the acceptance gate for this record (owner: Juliusz Ćwiąkalski).

## Implementation Plan

1. GH-309 delivers the rename code: `repos list` under `repos.v1` with the field renames and `repos.*` error identities, the group surface on `projects list`, the `projects list --flat` alias, and the help-text, reference-page, and migration-guide updates.
2. The command registry's `repos` row moves to Delivery only in the same change; current-truth feature specs flip in phase 7 (system_spec_update) of the GH-309 lifecycle — not by this record and not before the code lands.
3. The alias retirement is scheduled at the M3 boundary as a separate tracked change with its own delivery.
4. Any further command-name movement repeats the ODR-0003 DC-4 cost: a superseding record plus a code change, never a documentation-only edit.

## Verification Criteria

- Metric: rename code landed before this record existed — Target: 0 — Window: GH-309 commit-order review (DoD-11).
- Metric: registry `repos` row moved to Delivery without the code change — Target: 0 — Window: registry diff review at GH-309.
- Metric: alias payload drift versus the delivered `projects.v1` shape — Target: 0 — Window: GH-309 alias byte-compat check (AC-F7-1).
- Metric: delivered surfaces, help text, or docs using `projects` for the flat set or `repos` for a group after GH-309 — Target: 0 — Window: review at GH-309, then registry/doc audits.
- Metric: `projects list --flat` still served after the M3 boundary — Target: 0 — Window: M3-boundary retrospective (revisit trigger 1).

## Confidence Rating

**High.** The boundary, the rename rule, the alias, the field renames, the registry row state, and the gating spec all agree across four independent planning artifacts (contracts, amendment, registry, backlog) and the GH-309 change spec. The open risks are the alias-window consumer assumption (ASSUMPTION, Medium) and the unfixed M3 boundary date (TO-CONFIRM), both bounded by revisit triggers rather than by this record's correctness.

## References

- [ODR-0003](ODR-0003-cli-command-naming-v1-lock.md) — the v1 naming lock being partially superseded: DC-4 (freeze rule) and revisit trigger 1 (the path this record takes).
- [TDR-0022](TDR-0022-multi-repository-workstation-state-scope.md) — the multi-repository workstation state scope that delivered the flat record set surface renamed here.
- [GH-309 change specification](../changes/2026-11/2026-11-14--GH-309--project-groups/chg-GH-309-spec.md) — §5.1 F-7/F-8/F-10 (rename, boundary, this record as gated deliverable), §15 DEC-1/DEC-2.
- [Command registry and man page](../planning/oss-tooling/cli-command-registry.md) — the prospective `repos` row, the delivered `projects` row, and the boundary note.
- [M2 milestone contracts](../planning/oss-tooling/milestones/m2/contracts.md) — `repos.v1`, `projects.v1`, `project-groups.v1`, and "Naming boundary and the rename rule".
- [OSS tooling backlog](../planning/oss-tooling/backlog.md) — M2-S18 entry, derived tasks (a)–(f).
- [OSS tooling status](../planning/oss-tooling/status.md) — M2 domain-model amendment (2026-11-11), points 2–5.
