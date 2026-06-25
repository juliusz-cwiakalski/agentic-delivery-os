---
id: ODR-0001
decision_type: odr
status: Accepted
created: 2026-06-25
decision_date: 2026-06-25
last_updated: 2026-06-25
summary: "Classify the four doc/templates/*.yaml register templates as redistributable (marker + installed + guarded)."
owners:
  - Juliusz Ćwiąkalski
service: delivery-os
decision_area: operations
decision_scope: repo
reversibility: easy
business_impact: "None — additive install of 4 small schema-only template files."
customer_impact: "Adopters that enable the business-docs profile receive the register templates they are documented to have."
classification:
  domains: [operations, documentation]
  archetype: policy
  environment: clear
  rigor: R1
  reversibility: easy
  stakes: low
  urgency: medium
  uncertainty: low
  blast_radius: local
  recurrence: recurring
governance:
  driver: decision-advisor
  decider: "decision-advisor (AI; authority delegated by repo owner for an R1 reversible choice)"
  contributors:
    - pm
    - installer-maintainer
  reviewers: []
  performers:
    - coder
  informed:
    - pm
    - doc-syncer
ai_assistance:
  used: true
  roles: [researcher, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers:
    - "Repo owner (delegated authority; post-hoc review via the GH-67 PR)"
revisit_triggers:
  - "The documentation profile model changes such that business-docs templates are no longer distributed to engineering repos (re-evaluate whether register templates should follow)."
  - "A register template gains repo-specific/internal content that makes it unsafe to redistribute."
links:
  related_changes: ["GH-67"]
  supersedes: []
  superseded_by: []
  spec: []
  contracts: []
  diagrams: []
  decisions: ["ADR-0001"]
  experiments: []
  metrics: []
  roadmap_items: []
---

# ODR-0001: Classify the `doc/templates/*.yaml` Register Templates as `redistributable`

## Context

ADOS is a template/framework repo; `scripts/install.sh` redistributes selected docs to adopting
projects. Ticket **GH-67** replaces a hand-maintained allowlist with a frontmatter marker
`ados_distribution: redistributable | internal | project-generated` as the **single source of truth**,
derives the install set from markers, and adds a CI guard that fails on drift (missing marker /
`redistributable`-not-installed / `internal`-installed). Its north-star goal is to **eliminate the
drift class**.

The ticket's curated classification names "all of `doc/templates/*.md` and
`doc/templates/blueprints/**`" as redistributable. It does **not** mention the four YAML register
templates that also live in `doc/templates/`:

- `content-calendar-template.yaml`
- `experiment-register-template.yaml`
- `metric-catalog-template.yaml`
- `product-roadmap-register-template.yaml`

These four YAML files are **documented as shared and versioned** in two places:

- `doc/templates/README.md` ("YAML Register Templates" + convention: *"Templates are **shared** and
  versioned"*).
- `doc/documentation-handbook.md` §17 (lists all four under "YAML register templates (optional)" with
  *"Keep these **shared** and versioned"*).

Yet the current `install.sh` template glob (L677: `"${source_dir}/${ADOS_TEMPLATE_DIR}"/*.md`) only
copies `*.md` — so these YAML files have been **silently undistributed**: documented as shared, never
installed. That gap is precisely the drift class GH-67 exists to kill.

This record resolves the one ambiguous classification case so GH-67 can proceed without human input.

## Problem Framing (Clarified)

The `.md` vs `.yaml` distinction is an **artifact of the install glob, not a semantic distinction**.
Both classes serve the identical purpose: structural templates for an adopting project to fill in.
The decision question is therefore not "are YAML files templates?" (they demonstrably are) but:

> Under the new marker model, should the four YAML register templates carry
> `ados_distribution: redistributable` (installed + guarded) or `internal`
> (not installed + re-documented as ADOS-only)?

Facts established from the repo:

- **FACT:** All four YAML files exist in `doc/templates/` and are schema-only with **no** repo-specific
  ticket numbers, tracker refs, or private project references (verified via grep).
- **FACT:** Both `README.md` and the handbook (§17) explicitly mark them "shared and versioned."
- **FACT:** `install.sh` has never installed them (glob is `*.md`).
- **FACT:** Profile-optional `.md` business templates (e.g. `business-north-star-template.md`,
  `persona-template.md`) are **already** distributed to all installs via the `*.md` glob, despite
  being "(optional; enabled business docs only)". This establishes the repo convention: **profile
  governs *usage*, not *distribution*.**
- **ASSUMPTION:** The GH-67 characterization (AC #7 idempotency/non-destructiveness; the curated
  `*.md + blueprints/**` scope; the "eliminate the drift class" north star; the guard's three failure
  modes) is as relayed by the requesting agent.
- **TO CONFIRM:** The raw GH-67 issue text (this record relies on the caller's summary; not fetched
  directly in this session).

## Constraints (Hard Requirements)

- **C-1** — Installation changes must be **idempotent and non-destructive** (GH-67 AC #7). Adding new
  files is additive, not destructive.
  - Source: AC
  - Verification: demonstration (re-run `install.sh --local`; confirm additive-only, idempotent on second run)
  - Negotiable: no
- **C-2** — The classification must **not perpetuate a "documented-as-shared but not-installed" drift**
  — the exact drift class GH-67 exists to eliminate (north-star + the guard's
  `redistributable`-not-installed check).
  - Source: AC
  - Verification: test (CI guard)
  - Negotiable: no
- **C-3** — Redistributable files must contain **no repo-specific ticket numbers, internal tracker
  refs, or private project references** (project redistributability constraint,
  `.ai/agent/decision-instructions.md`).
  - Source: internal standard
  - Verification: audit (grep over the redistributed set)
  - Negotiable: no
- **C-4 (table-stakes)** — The `ados_distribution` marker remains the **single source of truth** for
  classification. Every alternative below preserves this; acknowledged once rather than per row.

## Decision Drivers

Ranked; all tradeable (none is a gate — gates live above in Constraints).

1. **Drift elimination** (highest) — the ticket's explicit north star. The chosen option must close
   the documented-shared-but-not-installed gap.
2. **Consistency of the template class** — `.md` and `.yaml` templates serve the same purpose;
   uniform treatment removes an unmotivated special case and lowers cognitive load.
3. **Paved road / adopter value** — adopters that enable the business-docs profile should receive the
   register templates they are documented to have, without manual discovery/copy.
4. **Guard clarity** — a clean invariant (`documented-as-shared ⟺ redistributable ⟺ installed`)
   keeps the CI guard simple and trustworthy; no drift-shaped exceptions.
5. **Minimal install footprint** (lowest) — engineering-repo installs gain 4 small, unused YAML files.
   Mild noise, easily outweighed by drivers 1–4.

## Mental Models & Techniques Used

- **Inversion** — "How would we *keep* the drift?" → by leaving documented-as-shared files out of the
  install set. The chosen option must fail that test.
- **First Principles** — what is a template *for*? To be filled in by an adopting project. The file
  extension does not change that purpose.
- **Consistency / Reference-class** — the `.md` profile-optional business templates are already
  distributed; the `.yaml` registers belong to the same reference class and should be treated alike.
- **Reversibility** — flipping a marker and a glob is trivially reversible, so the cheap option that
  kills the drift dominates.
- **Second-Order Thinking** — if we mark YAML `internal`, the new CI guard must tolerate
  "documented-as-shared yet internal," which is itself a drift-shaped exception that erodes the guard.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

Legend: ✅ passes · ❌ fails · ⚠️ passes only via an accepted-risk exception (constraint must be `negotiable: yes`)

|         | C-1 (idempotent) | C-2 (no drift) | C-3 (no repo-refs) | C-4 (marker SoT) |
|---------|:----------------:|:--------------:|:------------------:|:----------------:|
| ALT-0   | ✅ | ❌ | ✅ | ✅ |
| ALT-1   | ✅ | ✅ | ✅ | ✅ |
| ALT-2   | ✅ | ✅ | ✅ | ✅ |

### Alternative 0 — Do Nothing / Leave YAML Implicitly Undistributed

- **Summary:** Do not add a marker (or mark `internal`); leave the four YAML files out of the install
  set, exactly as today.
- **Pros:** Zero install change.
- **Cons:** Perpetuates the documented-shared-but-not-installed drift. The new CI guard then either
  fails the build (forcing this decision anyway) or requires a drift-shaped exception that undermines
  the guard's clarity.
- **Constraint compliance:** Fails **C-2** (leaves the exact drift GH-67 exists to kill). Passes C-1,
  C-3, C-4.
- **Why rejected:** Eliminated by C-2. Also the lowest-rigor outcome is forced either way; deciding
  now is cheaper than letting the guard force it later.

### Alternative 1 — `redistributable` (marker + installed + guarded) — RECOMMENDED

- **Summary:** Add `ados_distribution: redistributable` to the four YAML files; extend the install
  glob to `*.yaml` (or to the four files explicitly) so they are installed alongside the `.md`
  templates; have the guard scan `*.yaml` too.
- **Pros:** Closes the drift (C-2). Uniform with the `.md` template class (driver 2). Adopters that
  enable business docs get the registers they're documented to have (driver 3). Clean guard invariant
  (driver 4). Additive → satisfies AC #7 (C-1). All four files verified free of repo-specific
  references (C-3). Trivially reversible.
- **Cons:** Engineering-repo installs gain 4 small, currently-unused YAML files (driver 5, low
  weight). No functional downside.
- **Constraint compliance:** Passes C-1, C-2, C-3, C-4.
- **Why chosen:** Satisfies every constraint and dominates on the top four drivers. Consistent with
  the established treatment of profile-optional `.md` business templates.

### Alternative 2 — `internal` (marker + not installed + re-document as ADOS-only)

- **Summary:** Mark the four YAML files `internal`; explicitly keep them out of the install set;
  rewrite `doc/templates/README.md` and `doc/documentation-handbook.md` §17 to stop calling them
  "shared/versioned" and instead document them as ADOS-only development assets.
- **Pros:** Technically resolves the drift by redefining the docs rather than the install set. Passes
  all constraints.
- **Cons:** Contradicts the files' actual purpose (they *are* meant for adopting projects to fill in).
  Strips adopter value for business-profile projects (driver 3). Requires doc rewrites in two places.
  Creates an unmotivated split: why would `.md` register-adjacent templates be shared but `.yaml`
  registers internal? Inconsistent with how profile-optional `.md` business templates are already
  distributed.
- **Constraint compliance:** Passes C-1, C-2, C-3, C-4.
- **Why rejected:** Passes all constraints but loses on drivers 2, 3, and 4, and requires more
  documentation churn than ALT-1. No principled basis for the `.md`/`.yaml` split.

## Decision

**Adopt Alternative 1: classify the four `doc/templates/*.yaml` register templates as
`redistributable`** — add the marker, install them via an extended glob, and include them in the
guard's scan.

Rationale, tied to drivers: the YAML registers serve the same purpose as the redistributable `.md`
templates and are documented identically ("shared and versioned"). The `.md`/`.yaml` split is a glob
artifact, not a semantic distinction (driver 2). Marking them `redistributable` eliminates the
documented-shared-but-not-installed drift the ticket exists to kill (driver 1), preserves a clean
guard invariant (driver 4), and keeps adopter value intact (driver 3) — at the cost of only 4 small
additive files that engineering-repo installs simply ignore (driver 5, low weight). The decisive
anchor is the existing convention: profile-optional `.md` business templates are already distributed
to all installs, proving the repo treats *profile* as governing **usage, not distribution**. The YAML
registers belong to the same reference class.

This is an R1 decision, **delegated to the decision-advisor** by the repo owner. All conditions for
autonomous AI action are satisfied (delegated authority; R1; machine-checkable boundaries; easily
reversible; limited blast radius; audit trail = this record; escalation path = the GH-67 PR review).
The R2/R3 "stay `Proposed` until a human decides" rule does not apply; this record is `Accepted`.

### Constraint Compliance Attestation

The chosen alternative (ALT-1) satisfies **all** constraints:

- **C-1 (idempotent/non-destructive):** Installation of the four files is additive
  (`copy_updatable_file` creates-if-absent and is idempotent on re-run). No existing file is removed
  or destructively overwritten.
- **C-2 (no drift):** The four files become documented-as-shared **and** redistributable **and**
  installed — the gap closes. The guard will pass.
- **C-3 (no repo-refs):** Verified via grep — the four YAML files contain no ticket numbers, tracker
  refs, or private project references; safe to redistribute.
- **C-4 (marker SoT):** The `ados_distribution` marker remains the single source of truth; the
  install set and guard are both derived from it.

No accepted-risk exceptions are recorded (no `negotiable: yes` constraint is violated).

**Revisit trigger:** reopen if the documentation-profile model changes so business-docs templates are
no longer distributed to engineering repos, or if a register template gains repo-specific/internal
content unsafe to redistribute (see front matter `revisit_triggers`).

## References

- Ticket: **GH-67** (frontmatter marker as single source of truth + install-set derivation + CI drift guard)
- `scripts/install.sh` (template install glob, L673-685; manifest comment L101-102)
- `doc/templates/README.md` — "YAML Register Templates" + "shared and versioned" convention
- `doc/documentation-handbook.md` §17 — template index, "Keep these shared and versioned"
- `doc/guides/decision-making.md` §6 — bounded AI-authority model (R0/R1 autonomous action)
- `.ai/agent/decision-instructions.md` — redistributability constraint; per-type numbering
- Related decision: `ADR-0001` (Decision-Making Framework)
