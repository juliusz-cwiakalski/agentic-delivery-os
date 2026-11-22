---
id: TDR-0074
decision_type: tdr
status: Proposed
created: 2026-11-21
decision_date: null
last_updated: 2026-11-21
summary: "GH-365 OQ-1: the project-groups document (`<repo>/<configDirectoryName>/projects.yaml`, `delivery.projects.groups.v1`) is an operator-local, git-ignored overlay at its unchanged path and schema, not a tracked document. It carries absolute local checkout roots, so a committed live document would publish one operator's filesystem layout and declare paths that do not exist in another clone; the binding owner requirement names it as a local operator overlay with a declared git-ignored home, and the fresh-clone requirement forbids tracking a document that any write dirties. The ceremony mirror therefore composes its target set from the invoking checkout's own local document and nothing else: an absent document is the declared empty target set, no cross-checkout population is promised, and no checkout reads another checkout's group document. No tracked template lands in this change; a template does not restore membership automatically, so it is deferred with a named trigger. Three current-truth statements (the project-groups page, the ceremony-runner page, and the ceremony guide) stop calling the document project-committed."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os configuration, project groups, and ceremony mirror"
decision_scope: repo
review_date: null
business_impact: "Group membership stays a per-checkout operator fact. A fresh clone can read, validate, and list groups, but a cross-repository ceremony mirror on a fresh clone lands nothing until an operator declares the group locally. That degradation is declared and documented instead of being claimed as a committed capability."
customer_impact: "An operator declares groups in one git-ignored file per checkout, never commits a local path, and never sees a group document dirty the tree. A new contributor's first `projects list` is the documented empty listing."
classification:
  domains: [configuration, project-groups, ceremony, cross-repository, conformance]
  archetype: policy
  environment: complicated
  rigor: R2
  reversibility: easy
  stakes: medium
  urgency: medium
  uncertainty: low
  blast_radius: team
  recurrence: one-off
governance:
  driver: "@decision-advisor (GH-365 OQ-1; decision support for an otherwise complete specification)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-365 PR review; AI does not accept this R2 record"
  contributors:
    - "@pm (GH-365 clarify-scope: the owner comments of 2026-11-19 and 2026-11-21 are binding scope)"
    - "@spec-writer (OQ-1 as raised, and the two pages it names)"
    - "@decision-advisor (repository analysis and this record)"
  reviewers:
    - "@reviewer"
    - "Human owner (GH-365 PR review — this record fixes what a delivered capability may promise)"
  performers:
    - "@spec-writer (DEC row, the declared degradation, the three reconciled pages)"
    - "@doc-syncer (phase-7 reconciliation of the project-groups, ceremony-runner, and ceremony-guide pages)"
  informed:
    - "Cross-repository ceremony operators"
    - "M4-S1/M4 ceremony owners"
revisit_triggers:
  - "A cross-repository ceremony mirror must work on a fresh clone with no operator step. A tracked template does not satisfy that (an operator still copies it), so the trigger reopens the disposition, not just the template question."
  - "A group-scoped read is asked to resolve a group document from another checkout. This record forbids that federation; it is a new composition fact with its own source, not a widened search path."
  - "A product command begins writing `projects.yaml`. The reader performs no write today; a write path re-derives the ignore rule, the ignore-rule coverage class, and this disposition together."
  - "The document's member selectors gain a form that is not an absolute local path. The privacy argument weakens and the committed-document alternative must be re-evaluated on its remaining constraints."
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
links:
  related_changes: ["GH-365", "GH-309", "GH-310"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/spec/features/feature-project-groups.md"
    - "doc/spec/features/feature-ceremony-runner.md"
    - "doc/spec/features/feature-projects.md"
    - "doc/guides/ceremony-runner.md"
    - "doc/changes/2026-11/2026-11-21--GH-365--jaiship-namespace-migration/chg-GH-365-spec.md"
  contracts:
    - "packages/core/src/contracts/projects.ts"
    - "packages/adapters/src/file/projects-config.ts"
    - "packages/adapters/src/file/decision-register.ts"
  diagrams: []
  decisions: ["TDR-0022", "ODR-0004"]
  experiments: []
  metrics: []
  roadmap_items: ["M4-S2"]
---

# TDR-0074: The Project-Groups Document Is an Operator-Local Overlay — The Ceremony Mirror's Cross-Checkout Target Set Is Declaration-Only

## Context

- **FACT:** The document is `<gitRoot>/<configDirectoryName>/projects.yaml`, schema `delivery.projects.groups.v1`. It resolves from that one path only and is not a member of the ranked configuration stack (`doc/spec/features/feature-project-groups.md`, "Project configuration document").
- **FACT:** A member declares exactly one selector — `root` (a local checkout path) or `repoKey` — plus a `trackerKind`. The live document on the reference workstation declares an absolute local checkout root (redacted here) for its only member.
- **FACT:** The adapter locates and reads the document through injected filesystem facts and performs no write; validation and classification live in core (`packages/adapters/src/file/projects-config.ts`; `packages/core/src/contracts/projects.ts`).
- **FACT:** The document is **already untracked today**. The tracked set of this repository is exactly `.delivery-os/config.yaml`; `.jaiship/` holds an ignored `config.local.yaml` and an untracked `projects.yaml`; `.git/info/exclude` hides both `.delivery-os/` and `.jaiship/` on this workstation; `.gitignore` declares `.*/config.local.yaml` and nothing for `projects.yaml` (read on `feat/GH-365/jaiship-namespace-migration`).
- **FACT:** Consequently a fresh clone already has **no** group document, so the ceremony mirror's target set is already empty on a fresh clone. The shipped prose says the contrary: the ceremony-runner page resolves the target set "from the project-committed `projects.yaml` members", the ceremony guide says "the committed `projects.yaml` members", and the decision-register adapter's header repeats it (`doc/spec/features/feature-ceremony-runner.md` §9; `doc/guides/ceremony-runner.md`, "Composed landing"; `packages/adapters/src/file/decision-register.ts`).
- **FACT:** The delivered mirror contract already handles absence: "A target with no declared local checkout root inspects `absent`; an absent register or an empty declared target set degrades declaredly" (`feature-ceremony-runner.md` §9).
- **FACT:** The owner's binding requirement names the disposition directly: "local operator overlays (`config.local.yaml`, `projects.yaml`) have a declared, git-ignored home" (issue #365, owner comment 2026-11-21, D2).
- **FACT:** The owner's 2026-11-19 finding requires a fresh clone to stay clean through normal writes and requires a new file under the prior root — or a reintroduced symlink — to fail the scan.
- **FACT:** GH-365's criteria already assert the disposition's testable half: `AC-F2-4` requires the group document to resolve from the current path and neither overlay to be tracked; `AC-F5-3`'s tree arm fails a tracked `.jaiship/projects.yaml` by name.
- **Why now:** GH-365 changes the document's documented disposition in the same change that moves the configuration root. Leaving OQ-1 open would ship a scan that fails a tracked document, a page that calls it committed, and an ignore rule that silently makes the two incompatible — with no record of which statement is authoritative.

## Problem Framing (Clarified)

OQ-1 conflates two questions that have different owners and different evidence:

1. **Disposition — is the live document tracked or local?** A binding owner requirement already answers it: local, with a declared git-ignored home. This half is not a decision to trade off; treating it as one would reopen a settled requirement.
2. **Capability promise — what may the ceremony mirror claim?** This half is genuinely undecided. The mirror composes a target set from the document's members; if the document is local, the promise cannot be "a fresh clone participates in cross-checkout mirroring". The real question is what the declared, testable promise is, and what a fresh-clone operator must do to get one.

A third question is hidden inside option (b): whether a **tracked template** (for example a `.example` file) should land so a fresh clone can bootstrap membership. A template changes the review surface and the scan's neutral-site inventory, and it does not make cross-checkout membership survive a clone by itself — an operator still copies it. So it is a separate, lower-value option rather than half of the disposition question.

The framing that resolves all three: **the disposition is a requirement; the promise is a decision; the template is a deferral.**

## Constraints (Hard Requirements)

### C-1: The document has a declared git-ignored home at its unchanged path and schema

- **Statement:** The live document lives at `<repo>/<configDirectoryName>/projects.yaml` with schema `delivery.projects.groups.v1`, is covered by a repository ignore rule (not by a local exclude file), and is not tracked.
- **Source:** Owner comment 2026-11-21 (D2); GH-365 `AC-F2-4`, `AC-F1-3`, `DM-2`.
- **Verification:** Test — `git ls-files` returns nothing for the path; a rule-world `git check-ignore` probe reports it ignored; the tree arm reports it untracked.
- **Negotiable:** no.

### C-2: A fresh clone stays clean through the declared write set

- **Statement:** Seeding the declared write set (`.jaiship/config.local.yaml`, `.jaiship/projects.yaml`) in a scratch clone with no local exclude leaves `git status --porcelain` empty.
- **Source:** Owner comment 2026-11-19; GH-365 `AC-F1-3`.
- **Verification:** Test — the fresh-clone drill; the tree arm's ignore probes.
- **Negotiable:** no.

### C-3: No committed file carries an operator-specific absolute checkout root

- **Statement:** No tracked file contains a `root` selector that is an absolute path on one operator's machine.
- **Source:** The document's own content contract (`root` is a local checkout path); the change's privacy review; the owner's stated reason the document "cannot usefully be committed as-is" (GH-365 §14, OQ-1).
- **Verification:** Code review of the tracked set + the tree arm's tracked-path assertions.
- **Negotiable:** no.

### C-4: Group reads keep their delivered semantics

- **Statement:** An absent document and a zero-group document are both the ordinary empty listing; validation, the three classified identities, declared-order membership, and the "group is never a change's member set" boundary are unchanged.
- **Source:** `feature-project-groups.md`; GH-365 `AC-F2-4`; `NG-5`.
- **Verification:** Test — the delivered group batteries run unchanged.
- **Negotiable:** no.

### C-5: No tracked path under a prior-namespace root and no new scan exception

- **Statement:** The change adds no tracked prior-namespace path, and the disposition needs no new forbidden-literal seed, neutral site, or declared corpus.
- **Source:** GH-365 `AC-F5-3`; `AC-F4-2` (both-directions site reconciliation).
- **Verification:** Test — the tree arm and the content arm over the real tree.
- **Negotiable:** no.

> **Table stakes:** no new configuration key, no new command, no new state record, no change to the `project-groups.v1` envelope, and no change to the ceremony mirror's landing, equality, or commit semantics.

## Decision Drivers

**Product drivers (ranked):**

1. **Truthfulness of the committed surface** — a current-truth page must not promise a capability a fresh clone cannot have.
2. **Fresh-clone legibility** — a newcomer can list groups and see an empty listing without a dirty tree or a broken command.
3. **Operator privacy** — a machine's filesystem layout is not published by a commit.

**Technical drivers:**

4. **One place for membership** — one path, one schema, one validator; no shadow copy to keep in sync.
5. **Scan and review simplicity** — fewer tracked exceptions, no new neutral site, no new template surface to police.
6. **Reversibility** — a later change can add a bootstrap surface without undoing this one.

**Operational drivers:**

7. **Honest degradation** — a mirror run with no declared targets says so through the delivered verdict, never silently.

*(Overlap check: C-1…C-5 are the gates and appear above only as prohibitions. Drivers 2, 3, 4, 5, and 7 rank survivors; driver 1 is satisfied by whichever option makes the prose match the behaviour, and driver 6 ranks the deferral of the template.)*

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-365 OQ-1).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at the GH-365 PR review. The AI does not accept this R2 record.
- **Contributors:** `@pm` (scope: the two owner comments are binding); `@spec-writer` (OQ-1 as raised); `@decision-advisor` (analysis and this record).
- **Required reviewers:** `@reviewer`; human owner.
- **Performers:** `@spec-writer` (the DEC row and the declared degradation); `@doc-syncer` (the three reconciled pages).
- **Informed:** cross-repository ceremony operators; M4-S1/M4 ceremony owners.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| The live document declares an absolute local checkout root | FACT | `git`-ignored `.jaiship/projects.yaml` on the reference workstation (content redacted here) | A committed document would declare paths that do not resolve in another clone; C-3 would be violated | High |
| A fresh clone already has no group document, so the mirror's target set is already empty | FACT | `.git/info/exclude` + untracked directory; tracked set is `.delivery-os/config.yaml` only | If it were tracked, the degradation would be new rather than confirmed; the decision would need a migration step | High |
| No product command writes the document | FACT | `projects-config.ts` reads only; the writer search over `packages/` finds no write path | If a command wrote it, the ignore rule would still cover it, but the "operator-authored" framing would need revision | Medium-High |
| The mirror degrades declaredly on an absent or empty target set | FACT | `feature-ceremony-runner.md` §9; delivered ceremony battery | The declared degradation would be a silent no-op, which is disqualifying under driver 7 | High |
| The owner requires a declared git-ignored home for both local overlays | FACT | Issue #365 owner comment 2026-11-21 (D2) | Option (b) would become eligible and the trade-off would reopen | High |
| An operator workflow copies a `projects.yaml` between checkouts today | TO-CONFIRM | Not observed in the repository or docs | If it does, a template would be higher-value than this record assumes | Low |

## Mental Models & Techniques Used

- **First principles** — separate "where does the file live" (a requirement) from "what may the mirror promise" (a capability claim).
- **Inversion** — ask what a fresh clone must be able to do; the answer is "read an empty listing", not "inherit another machine's group".
- **Second-order thinking** — a committed document does not just leak a path; it makes every clone's membership a merge surface and its absolute paths a conflict.
- **Opportunity cost** — a tracked template buys discoverability but not membership, and costs a scanned artifact plus a doc surface.
- **Chesterton's fence** — the delivered "absent ⇒ empty listing / declare the degradation" rule already covers the case; the change only has to stop contradicting it.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 declared ignored home | C-2 clean clone | C-3 no local path committed | C-4 read semantics | C-5 no new scan exception |
|---|:---:|:---:|:---:|:---:|:---:|
| ALT-0 keep the undeclared local-excluded file and the "committed" claim | ❌ | ❌ | ✅ | ✅ | ✅ |
| ALT-1 operator-local ignored overlay, no template, declaration-only mirror (chosen) | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 tracked live document (option b, first half) | ❌ | ❌ | ❌ | ✅ | ✅ |
| ALT-3 local overlay + separately tracked template (option b, second half) | ✅ | ✅ | ✅ | ✅ | ⚠️ (a new tracked artifact needs a declared neutral-site decision) |

Legend: ✅ passes · ❌ fails · ⚠️ passes only via a declared exception that the record must then name.

### Alternative 0 — Keep Today's Undeclared Local File and the "Project-Committed" Claim

- **Eligibility:** Not eligible (fails C-1 and C-2).
- **Summary:** Leave the document untracked and hidden by `.git/info/exclude`, keep the ignore rule absent, and keep the prose calling it committed.
- **Constraint compliance:** C-1 fails — the only thing hiding the file is a workstation-local exclude, which a fresh clone does not have; C-2 fails — a clone without that exclude shows the directory as untracked the moment a group is declared.
- **Driver fit:** Fails 1 (prose contradicts behaviour), 2 (dirty tree), 5 (a local exclude is an undeclared exception).
- **Pros:** No change at all.
- **Cons:** This is the defect GH-365 exists to remove: an undeclared local workaround that makes the documented capability unverifiable, plus a dirty tree on any machine that did not add the exclude.
- **Why rejected:** It preserves the contradiction instead of resolving it.

### Alternative 1 — Operator-Local Ignored Overlay, No Template, Declaration-Only Mirror (chosen)

- **Eligibility:** Eligible (passes C-1 … C-5).
- **Summary:** The document stays at its current path and schema, is covered by the brand-free `.*/projects.yaml` rule, and is never tracked. The mirror composes its target set from the invoking checkout's own document; an absent document is the declared empty target set. The three pages that call it committed are reconciled.
- **Constraint compliance:** C-1 by the ignore rule plus the tree arm; C-2 by the drill; C-3 because nothing is committed; C-4 because no reader, validator, or envelope changes; C-5 because no new seed, site, or corpus is needed.
- **Driver fit:** Best on 1, 3, 4, 5, 7; neutral on 6; weakest on 2 only in the sense that a fresh clone's mirror has no targets — which is the declared and already-delivered behaviour.
- **Pros:** Behaviour and prose agree; no operator path enters history; one path, one schema; the delivery machinery already handles absence; the ignore rule also protects the next runtime write.
- **Cons:** Cross-checkout mirroring is a per-checkout operator step; a new contributor must read the docs to know the file's shape.

### Alternative 2 — A Tracked Live Document (option b, first half)

- **Eligibility:** Not eligible (fails C-1, C-2, C-3).
- **Summary:** Commit `projects.yaml` so a fresh clone inherits group membership.
- **Constraint compliance:** C-1 fails against the binding owner requirement; C-2 fails because any write to the document dirties the clone; C-3 fails because the only useful content today is an absolute local checkout root.
- **Driver fit:** Strong on 1's *appearance* (a committed document looks authoritative) and on nothing else; actively bad on 3 and 5.
- **Pros:** The mirror works on a fresh clone without an operator step.
- **Cons:** Publishes a machine's layout; every clone's file must be edited before it is useful; the document becomes a merge-conflict surface for a per-machine fact; it reopens a binding requirement.
- **Why rejected:** It trades a real privacy and hygiene cost for a capability that does not actually work in a second clone.

### Alternative 3 — Local Overlay Plus a Separately Tracked Template (option b, second half)

- **Eligibility:** Eligible-with-declared-exception (C-5 needs a neutral-site decision for the new tracked artifact).
- **Summary:** Add a tracked `.example` document so a clone can copy it.
- **Constraint compliance:** C-1…C-4 pass; C-5 requires declaring the template as a known tracked artifact and preventing it from becoming a second live document.
- **Driver fit:** Better than ALT-1 on discoverability (a secondary value); worse on 5; identical on the capability (an operator still copies the file).
- **Pros:** The schema and an example shape are discoverable in the tree.
- **Cons:** Two group-shaped files that must not drift; a new tracked artifact to police; it does not satisfy the only capability argument for committing anything.
- **Why deferred rather than rejected:** The need is plausible but speculative, and the schema is already documented on a current-truth page. Trigger: cross-checkout mirroring must work from a fresh clone without an operator step, or operators ask for a bootstrap.

## Decision

- **Decision:** Adopt **ALT-1**, with the four clauses below.

### D1 — Disposition

`<repo>/<configDirectoryName>/projects.yaml` is an operator-local, git-ignored overlay at its unchanged path and schema. It is covered by the brand-free `.*/projects.yaml` rule, is never tracked, and is never a member of the ranked configuration stack. This confirms the binding owner requirement and the change's own `AC-F2-4` / `AC-F5-3`; it is not a new grant.

### D2 — No tracked template in this change

No `.example` file, no `projects init` verb, and no generation path lands here. The deferral carries the trigger named in ALT-3, and the group document's schema stays documented on its current-truth page.

### D3 — The mirror's promise

The ceremony mirror composes its target set from the **invoking checkout's own** local document and nothing else:

- an absent document, a zero-group document, or a target with no declared local checkout root is the delivered declared degradation (`absent` / empty target set), never a silent success and never an error;
- no checkout reads another checkout's group document — that would be federation, a new composition fact, and it is explicitly out of scope;
- a fresh clone therefore cannot participate in cross-checkout mirroring until an operator declares the group locally. That sentence belongs in the ceremony pages, not only in a risk row.

### D4 — Documentation

Three statements are reconciled in the documentation phase: `feature-project-groups.md` (local overlay, absolute roots stay local, absent ⇒ empty listing), `feature-ceremony-runner.md` (§9's "project-committed" wording becomes the invoking checkout's local document with the declared degradation), and `doc/guides/ceremony-runner.md` ("the committed `projects.yaml` members" likewise). `feature-projects.md` keeps its delivered text; the change adds no new statement there. The stale-statement check gains one clause: no page may present the group document as committed.

### Constraint Compliance Attestation

The chosen alternative satisfies C-1 … C-5 (see the matrix above). No accepted-risk exception is claimed: the only capability loss — cross-checkout mirroring on a fresh clone — is not a constraint, because no requirement in the ticket, the owner comments, or the delivered contracts promises it, and the delivered mirror already declares the degradation.

## Trade-offs & Consequences

### Positive Outcomes

- The committed surface stops promising a capability a clone cannot have; the prose and the behaviour agree.
- No operator's filesystem layout is published, and no per-machine fact becomes a merge surface.
- The ignore rule covers the declared overlay, so the fresh-clone requirement holds for the group document as well as for `config.local.yaml`.
- One path, one schema, one validator — the group read and the mirror read cannot diverge.

### Negative Outcomes

- A fresh clone's mirror run has an empty target set until an operator declares the group. This is the honest cost of not committing local paths.
- A contributor must read the group page to learn the document's shape; there is no in-tree example.
- A future "make it work on a clone" request reopens this record rather than a one-line change, because a template does not close the gap.

### Unresolved Questions

- [ ] Whether a bootstrap surface (`projects init` or a template) is ever warranted (owner: future named need; trigger in the front matter).
- [ ] Whether the mirror should ever read a target checkout's own document to discover its group (federation). This record forbids it; a proposal is a new composition fact (owner: ceremony owner).
- [ ] Whether a command will ever write the document; if one does, re-derive the ignore rule and the coverage class together (owner: `@doc-syncer` at the change that adds the write).

## Implementation Plan

1. **Spec (GH-365).** Record the ruling as a decision-log row with this record linked; resolve OQ-1 to ALT-1; state the declared degradation in the interfaces or deliberate-changes section; keep the acceptance-criteria count unchanged (the disposition is already asserted by `AC-F2-4`/`AC-F5-3`; a "no tracked template" clause is added inside `AC-F2-4`).
2. **Documentation phase.** Reconcile the three pages named in D4; add the ceremony-runner page to the change's affected-component and phase-7 lists (it is currently missing from both).
3. **Guardrails.** The tree arm keeps failing a tracked group document; no new seed, site, or corpus is added by this ruling.
4. **Risk mitigation.** The degradation is declared in the change's deliberate-changes table and in the doc battery, so a reviewer sees it as a decision rather than as an omission.

## Verification Criteria

- **Committed set:** `git ls-files` returns no `<configDirectoryName>/projects.yaml` and no template variant — 0 paths, window: at the change head.
- **Clean clone:** the drill with the two overlays seeded reports 0 status lines — window: the aggregate gate on every run.
- **Tree arm:** a planted tracked group document fails by name; the real tree is green — window: every run.
- **Read semantics:** the delivered group batteries pass unchanged; an absent document returns `data.groups: []` at exit 0 — window: every run.
- **Docs:** 0 pages describe the document as committed; 3 pages state the disposition and the declared degradation — window: the documentation phase and every doc battery run.

## Confidence Rating

**Medium-High.** The disposition half rests on a binding owner requirement and on facts read directly from the tree, not inferred. The capability half rests on the delivered mirror contract, which already declares absence as a degradation; the residual uncertainty is future cross-repository demand, which the revisit triggers name rather than guess. No AI-generated confidence is offered as evidence.

## References

- [Change specification GH-365](../../changes/2026-11/2026-11-21--GH-365--jaiship-namespace-migration/chg-GH-365-spec.md) — OQ-1, §8.5 row 10, §16 composition map, `AC-F2-4`, `AC-F5-3`.
- [Project Groups](../spec/features/feature-project-groups.md) — the document, its schema, validation, and empty-listing rule.
- [Ceremony Runner](../spec/features/feature-ceremony-runner.md) §9 — the composed mirror landing and the declared degradation.
- [Ceremony Runner guide](../guides/ceremony-runner.md) — "Composed landing".
- [TDR-0022](TDR-0022-multi-repository-workstation-state-scope.md) — the two-layer state scope and the host/project root layout the mirror reads under.
- [ODR-0004](ODR-0004-flat-record-set-rename-projects-to-repos.md) — the `repos` / `projects` naming boundary this decision keeps intact.
- Issue #365 owner comments (2026-11-19 committed-truth finding; 2026-11-21 D2 local-overlay requirement).
