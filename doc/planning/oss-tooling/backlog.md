---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/oss-tooling/backlog.md
---
# OSS tooling backlog

Story backlog for the open-source tooling. Milestones and sequencing live in
[roadmap.md](roadmap.md); the command surface lives in
[cli-command-registry.md](cli-command-registry.md). The structure decision is
[ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md); the working
name is `ados` until the naming freeze.

## Reading guide

- Epics map to milestones M0 through M4.
- Stories are the unit of delivery (one pull request each, 11-phase
  lifecycle).
- Every story opens with a Goal line (what it achieves and why) so
  tickets and implementing agents carry the wider context, then Tasks
  and machine-checkable AC.
- Tasks are the concrete work inside a story; they become the story body
  when the tracking issue is created.
- Created stories carry their tracking ticket (`- Ticket:` line,
  milestone-scoped); story codes are stable identifiers even before
  ticket creation.
- Every story lists its dependencies (`Depends on:`); dependencies are
  strict (the story cannot deliver without them), not sequencing
  preferences. Suggested delivery order, including non-forced
  placements, lives in [backlog-ranking.md](backlog-ranking.md).
- M0 is fully specified. M1 is fully specified as of the delivery-engine
  re-planning (2026-11-03). M2 through M4 are at outline level and get
  refined at the start of each milestone.
- Every story ends with machine-checkable acceptance criteria. Success is
  artifacts, not exit codes.
- Stories are self-contained for ticket creation: no private-repository
  references; ported prototypes have their command surface inlined in the
  ticket or named from this repository.

## Cross-cutting principles (apply to every story)

- Verify by artifact: pushed commit, pull request, tracker state, head
  pipeline for the pushed commit.
- Bounded output: machine-readable result plus a short human digest.
- Self-describing commands: `--help` with examples on every command and a
  man-page-grade guide; where a bash script emitted a stable machine
  contract (the key=value delivery summary), the replacement emits the
  same shape; stable exit codes per the error table.
- Failure visibility: every skipped or degraded path is reported.
- Idempotent: safe to re-run after crash or restart.
- Rollback story: revert to the bash behavior in one step.
- Working name: `ados` for binary, `ADOS_` env prefix, `.ados` config dir,
  and the state dir; all derived from the single branding constant, never
  from scattered literals.
- Open source content only in committed files.
- Tier and residence rules from ADR-0003.
- pnpm workspaces with Bun pinned; one lockstep version line via changesets
  fixed group; all packages private until the naming freeze, with a
  release-job publish guard.
- Configuration follows DEC-4 (layered chain, fail-closed validation,
  secrets environment-only).
- License: Apache-2.0; dependency licenses via the `doc/legal/` registry,
  fail closed.
- Old bash tools stay until their engine replacement passes parity; removal
  happens at the very last stage with a deprecation notice pointing to the
  new equivalent.
- Agents and engines speak ADOS primitives only; provider and harness
  dialect lives in adapters behind typed ports, the role-to-primitive policy
  layer is enforced at the port boundary, and the raw escape hatch is
  audited and off by default (concepts/agent-primitive-surface.md).
- Delivery is harness-agnostic: dispatch spawns sessions through harness
  adapters (opencode default, Claude Code supported, pi.dev a candidate),
  and the tooling ships as a generated plugin per harness from one
  canonical source (concepts/harness-adapters.md).
- Parked concepts shape seams, not schedules: design-level concepts in
  [concepts/](../concepts/README.md) that are deliberately not scheduled
  (containerized execution, the credential sidecar, worktree-scoped
  parallel leases, typed agent messaging) each name, under "Compatibility
  with the current build", what current stories must not foreclose. A
  story that would hardcode an assumption a parked concept needs
  reopened is a design defect, even when the story itself is correct.

---

## Unplanned ideas (not yet planned to a milestone)

Stories captured but deliberately not attached to a milestone yet. When a
milestone plan is authored, stories move into `milestones/<mN>/backlog.md`
and get tickets attached to the GitHub milestone at creation.

### IDEA-S1 Validators and deploy checklist
- Goal: Validators with classified errors for decision records, frontmatter, and deploy prerequisites, folding the validator backlog into the lint family.
- Tasks: decision-record validator, frontmatter validator,
  deploy-prerequisite checklist; folds the existing validator backlog work
  in this repository; a primitive-reference check: backticked
  PascalCase tokens matching the primitive-name shape must resolve to
  catalogue names (primitive-catalogue.md), so renamed or removed
  primitives cannot leave dangling doc references.
- AC: validation errors are classified with codes and fix hints.
- Depends on: M0-S10.


### IDEA-S2 Policy engine
- Goal: Policy as code: fleet drift detection, apply with rollback snapshots, and a rules register that flags prose rules, so written policy and enforced policy stop diverging.
- Tasks: declared repository policy (branch protection, required checks,
  merge rules) with fleet check and apply, exception profiles, and
  timestamped snapshots for rollback and forensics; a rules register
  mapping every written rule to its mechanical check or flagging it
  prose-only; enforcement consulted at the point of action. Policy
  documents are typed objects with a kind field (repository settings
  are the first kind); authority and autonomy policy is a classified
  future kind, so the engine never hardcodes the repository-settings
  shape. The policy inventory and classification live in
  ../concepts/policy-as-code.md (enforced today, prose today, future
  ideas; authority policy is AutonomyContract-shaped,
  software-delivery-autonomy.md).
- AC: policy drift across repos is detected and applies take a
  pre-change snapshot; a prose rule without a check is flagged by name,
  not enforced silently.
- Depends on: M0-S19.


### IDEA-S3 Workspace utilities
- Goal: Workspace utilities with safety rails so state, config, and repository hygiene operations are idempotent and never touch live deliveries.
- Tasks: backup, restore, migration helpers for state and config; clone,
  branch, and worktree hygiene with safety rails (worktree-per-delivery
  is the dormant parallel mode's mechanism; keep the utilities
  worktree-aware, concepts/parallel-delivery.md).
- AC: utilities are idempotent and tested against torn state; never touch
  repositories with live deliveries.
- Depends on: M0-S4, M0-S5.


### IDEA-S4 v1.0 internal readiness and bash deprecation
- Goal: V1.0 internal readiness with parity evidence and deprecation notices, the gate before public-release work.
- Tasks: parity evidence per engine; deprecation notices on old tools
  pointing to the new equivalents; removal plan at the very last stage.
- AC: every replaced bash command has a working new equivalent with a
  deprecation notice.
- Depends on: M1-S18, M2-S2, M2-S3, M2-S6.


### IDEA-S5 Memory command family
- Goal: The ados memory command family over canonical records, so memory governance (audit, promotion, supersession) is tool-enforced.
- Tasks: `ados memory` commands over the canonical records: lint,
  candidates, promote, supersede, conflicts, stale, doctor; the doctor
  bundles the full audit (schema, index coverage, budgets, dangling
  references, expired review dates, contradiction candidates); the
  promotion step enforces the approval matrix and the routing table
  (concepts/memory-architecture.md, memory-lifecycle.md).
- AC: every doctor finding is classified with a code and fix hint; a
  policy-class candidate cannot promote without recorded human approval;
  supersession closes validity windows without deleting history; records
  and index lines carry visibility tags, lint fails out-of-visibility
  references, and compile emits role-filtered projections (concepts/
  memory-autonomy-and-visibility.md); behavior-changing lessons cannot
  reach authoritative without validation evidence (replay, shadow, or
  canary result) and flag expired revalidation windows (concepts/
  memory-architecture.md, retrospectives.md).
- Depends on: M2-S8.


### IDEA-S6 Memory compiler to harness surfaces
- Goal: Canonical memory compiled into each harness native formats, so every surface reads the same memory without manual sync.
- Tasks: compile canonical memory into each harness's native context
  formats (AGENTS.md, CLAUDE.md, path rules, skills) from one canonical
  source, sync-verified, never hand-edited - the memory-side counterpart
  of harness surfaces (concepts/memory-architecture.md, M3-S1).
- AC: a canonical memory change regenerates every harness projection in
  one step; projections carry no content the canonical source lacks.
- Depends on: M2-S8, M3-S1.

---


