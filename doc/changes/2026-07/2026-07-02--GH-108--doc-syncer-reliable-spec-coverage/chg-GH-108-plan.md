---
id: chg-GH-108-doc-syncer-reliable-spec-coverage
status: Updated
created: 2026-07-02T00:00:00Z
last_updated: 2026-07-02T21:57:11Z
owners: ["Juliusz Ćwiąkalski"]
service: delivery-os
labels: ["fix", "process", "doc-syncer", "spec-coverage", "autonomous-delivery", "epic-107"]
links:
  change_spec: ./chg-GH-108-spec.md
  decision: ../doc/decisions/PDR-0002-mode-aware-spec-coverage-resolution.md
  related_changes: ["GH-78", "GH-79", "GH-111"]
  epic: "GH-107"
summary: >
  Make the doc-syncer phase-7 spec-coverage *resolution* path mode-aware so a
  detected spec-coverage gap stops silently dropping in autonomous delivery. Adds
  a per-change `delivery_mode: interactive | autonomous` signal (pm-notes field,
  set by @pm at intake; the autonomous session prompt instructs @pm to set
  `autonomous`); in `autonomous` mode a gap for a modified feature area with no
  spec is resolved in-change (the missing feature-<slug>.md is authored —
  first-spec-only), an existing spec is merely reconciled, and `interactive` mode
  is byte-for-byte unchanged (advisory + human-gated). No agent creates a tracker
  ticket in any mode; "PM must NEVER create new tickets autonomously" is
  preserved verbatim. A small repo-internal visibility aid makes the drop
  observable. Implements PDR-0002 Alternative 1 (settled input, not re-litigated).
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-108: doc-syncer reliability — specs/guides must actually fire post-merge

## Context and Goals

This plan operationalizes change spec `./chg-GH-108-spec.md` (a `fix`, epic #107,
P1). It closes a reliability defect in the **phase-7 spec-coverage *resolution*
path**: across a sustained autonomous run, detected `spec_coverage_gaps` are
reported but never resolved (no human is reachable mid-flight to approve a
follow-up), so modified feature areas silently acquire no spec and the system
spec rots. The fix is **mode-awareness**, not reverting the (correct) de-noise
design and not weakening the ticket-creation governance rule.

The design is settled by **PDR-0002** (Alternative 1), incorporated here as
chosen input — it is not re-opened. The two decisions the decision record routed
open (**D1 mode representation**, **D2 governance tension**) are resolved by
spec DEC-1/DEC-5 (`delivery_mode` pm-notes field) and DEC-2 (author the spec
in-change; no ticket). The two spec Open Questions (**OQ-1 authoring ownership**,
**OQ-2 visibility-aid form**) are resolved below as **plan decisions**.

### Plan decisions (resolving spec OQ-1 and OQ-2)

- **PD-1 — OQ-1 (authoring ownership): `@doc-syncer` authors the missing feature
  spec DIRECTLY in autonomous mode (no delegation to @coder).**
  - *Evidence:* `.opencode/agent/doc-syncer.md` front matter declares
    `claude.model: opus` (the capable tier — this resolves the spec/decision
    record's "sources disagree on the current tier; capacity is an implementation
    concern" framing: the shipped tier IS opus). Authoring a `feature-<slug>.md`
    is a doc task fully inside doc-syncer's existing write-allowlist (`doc/spec/**`,
    per its `<rules>` "Safety" rule) and inside its existing "create/reconcile
    feature specs" capability (step 4 `<area name="Features">`). It is a doc
    artifact, not source code — so it does not trip doc-syncer's `<non_goals>`
    ("Do not modify source code").
  - *Rule-consistency with PDR-0002:* the *decision* (gap resolved in-change in
    autonomous mode) is rule-level and agent-agnostic; PD-1 only settles *who
    authors* (doc-syncer directly), which the decision record explicitly left to
    the plan (D2 "Ownership of authoring"). PD-1 honors PDR-0002 constraint C-2
    (gap resolves without a human mid-flight) with zero new delegation machinery.
  - *Fallback (only if delivery shows doc-syncer genuinely cannot author at
    quality):* doc-syncer detects + records the requirement and hands authoring
    to `@coder` while retaining gap-detection and the resolution requirement. Do
    NOT adopt the fallback preemptively — opus tier + existing capability make
    the direct path the default.

- **PD-2 — OQ-2 (visibility-aid form): a repo-internal
  `scripts/spec-coverage-snapshot.sh` + `scripts/.tests/test-spec-coverage-snapshot.sh`.**
  - *Form:* counts feature specs present under `doc/spec/features/` vs changes
    touching feature areas (derived from `doc/changes/**/*--<ref>--*/` + spec
    `links`/feature-area mentions). Stdlib bash only; **no network**; cheap and
    conservative; outputs a simple count/ratio. Satisfies AC-F5-1's *outcome*
    (observable, computable, non-zero signal for autonomous runs).
  - *Governance note (CEO gate):* adding a new `scripts/` tool is conventionally a
    CEO-gated decision; this autonomous session has no CEO on the loop. **Flag for
    the GH-108 PR review** (human gate that autonomous delivery already mandates).
    The visibility aid is advisory/observability only — it creates no side effect,
    touches no tracker, and is independently reviewable, so it is safe to ship
    behind the open-PR human review.

- **PD-3 — Headers on the new `scripts/` files: apply via explicit-path invocation
  of `scripts/add-header-location.sh` (NOT hand-added).**
  - *Evidence:* every existing file under `scripts/` and `scripts/.tests/`
    carries the MIT header (e.g. `opencode-session.sh`, `add-header-location.sh`,
    all `test-*.sh`), and `add-header-location.sh` advertises `scripts/` as a
    valid argument in its own usage. AGENTS.md's "configured header paths"
    wording refers to the script's auto-processed `DEFAULT_PATHS`
    (`.opencode/agent`, `.opencode/command`, `doc/guides`,
    `doc/documentation-handbook.md`, `tools`) — i.e. what runs with *no
    arguments* — not an *exclusion* of `scripts/`. The new files are headered via
    explicit-path invocation to stay consistent with the empirical repo
    convention and with "AI must never hand-add headers" (the script injects
    them). **Flag the AGENTS.md-vs-empirics ambiguity for PR review.**

### Open questions (none blocking delivery)

- None. OQ-1, OQ-2 resolved (PD-1, PD-2); OQ-3 (quality spot-check beyond
  open-PR review) is deferred to spec §7.3 (revisit after the first autonomous
  runs). All other spec decisions (DEC-1…DEC-7) are settled input.

## Scope

### In Scope

- **F-1 / DM-1 — delivery-mode signal:** `delivery_mode: interactive | autonomous`
  field in the pm-notes structure (`pm.md` step 3 + pm-notes YAML example);
  default/absent ⇒ `interactive`. (AC-F1-1)
- **F-3 — autonomous entry-point wiring:** one-line instruction in
  `scripts/opencode-session.sh` `default_prompt_for()` directing `@pm` to set
  `delivery_mode: autonomous`; signal readable from all entry points
  (session + manual `@pm`). (AC-F3-1, AC-F1-2)
- **F-2 / DM-2 — mode-aware spec-coverage resolution in `@doc-syncer`:** read
  `delivery_mode` from pm-notes; `autonomous` × (no spec) ⇒ author missing
  `feature-<slug>.md` in-change (first-spec-only; PD-1: doc-syncer authors
  directly); existing spec ⇒ reconcile; `interactive`/absent ⇒ unchanged
  report-only handoff. (AC-F2-1, AC-NFR4-1)
- **F-2 / NFR-3 — governance preserved:** no agent creates a tracker ticket in
  any mode; "PM must NEVER create new tickets autonomously" retained verbatim in
  its canonical home `.ai/agent/pm-instructions.md` (the phrase lives there;
  `pm.md` is not required to carry it), with no autonomous-mode exception carved
  in. (AC-F2-2)
- **NFR-1 — backward compatibility:** absent/`interactive` behaves identically to
  pre-change. (AC-F2-3)
- **F-4 — "advisory ≠ silently skipped" wording:** normalize in
  `.opencode/agent/doc-syncer.md` (`<rules>`/`<reporting>`) and
  `doc/guides/change-lifecycle.md` Phase 7. (AC-F4-1, AC-F4-2)
- **F-5 / NFR-5 — observability:** `scripts/spec-coverage-snapshot.sh` +
  `scripts/.tests/test-spec-coverage-snapshot.sh`. (AC-F5-1)
- **NFR-7 — plugin freshness:** `.ados-claude/` regenerated (in-commit) for the
  `.opencode/` edits; final freshness verification. (AC-NFR7-1)
- **`.ai/agent/pm-instructions.md`** surgical note referencing `delivery_mode` +
  the mode-aware coverage rule (governance rule untouched).
- **DM-2 / AC-DM2-1 — system-spec reconciliation:** `@doc-syncer` reconciles
  `doc/spec/features/feature-delivery-lifecycle.md` at lifecycle phase 7 (PM-
  coordinated; NOT a @coder task — see Phase 7).

### Out of Scope

- **NG-1** — No change to the de-noise design for interactive mode (additive
  only; advisory + human-gated follow-up preserved).
- **NG-2** — No auto-creation of tracker tickets in any mode.
- **NG-3** — No formal "delivery mode" feature beyond the pm-notes field + the
  one-line session prompt instruction (no opcodes/config/env vars).
- **NG-4 / spec NG-4** — No authoring of missing specs for a specific project
  (that is project cleanup, not a framework fix).
- **NG-5** — No implementation of sibling GH-111 (operational guides trigger);
  only the `delivery_mode` concept is designed to be reusable by it.
- **NG-6** — No change to spec-coverage *detection* (the positive coverage check
  already works; this fixes *resolution*).
- **NG-7** — No promotion of `spec_coverage` to a hard DoR facet (deferred,
  GH-78 §7.3).
- **OUT** — Wiring the visibility aid into CI (the script ships with its test;
  CI wiring is a separate decision — spec §22).
- **OUT** — Bumping the plugin manifest version (static `1.0.0` per the build
  script; not a per-change semver — see Phase 7).

### Constraints

- **`.opencode/` + regen invariant (NFR-7):** every commit that edits a file
  under `.opencode/` MUST also include the regenerated `.ados-claude/` output in
  the SAME commit (1:1 invariant; GH-78 precedent). Phases 1 and 2 each edit one
  `.opencode/` file → each regenerates and commits in-unit. Never hand-edit
  `.ados-claude/**`.
- **Shared-file surgical edits (RSK-3):** `pm-instructions.md` and
  `change-lifecycle.md` are edited **surgically** — only the coverage/mode/
  Phase-7 sections — to minimize rebase collisions with parallel sibling
  sessions. Do NOT reword the governance rule; do NOT restructure sections.
- **Governance verbatim (C-1 / NFR-3):** "PM must NEVER create new tickets
  autonomously" stays byte-identical; no autonomous-mode exception is carved into
  it. *Canonical home (single source of truth for this rule):*
  `.ai/agent/pm-instructions.md:40` — `pm.md` is NOT required to carry the phrase,
  so @coder/@reviewer verify it in `pm-instructions.md`; the Phase-1 edit to
  `pm.md` adds only the `delivery_mode` declaration + mode-aware coverage note,
  never the ticket-creation rule. The resolution path produces a **doc artifact**
  scoped to the change, reviewed at the open-PR human gate — never a tracker
  ticket.
- **First-spec-only (DEC-4 / NFR-4):** authoring fires only for the FIRST spec
  of an unspecced modified feature area; an existing spec is reconciled, never
  re-authored; routine edits are excluded.
- **Interactive path frozen (C-3 / NFR-1):** `interactive`/absent behavior is
  byte-for-byte unchanged in effect; no new blocking prompt for interactive runs.
- **Header hygiene (PD-3):** AI must NOT hand-add license headers; new `scripts/`
  files are headered via explicit-path invocation of
  `scripts/add-header-location.sh`.
- **Commit routing:** this plan performs NO commits; staging/committing across
  phases is performed by `@committer` (PM-routed). Do NOT run `git commit` from
  the plan.

### Risks

- **RSK-1 (model capacity for authoring)** — *Mitigated by PD-1:* the shipped
  `doc-syncer` tier is `opus` (capable), and authoring is an existing doc-syncer
  capability; the open-PR human review is the quality backstop; the resolution
  *requirement* stays rule-level and agent-agnostic.
- **RSK-2 (over-firing)** — *Mitigated by* the crisp "feature area" definition
  already in `doc-syncer.md` (reaffirmed in Phase 2) + first-spec-only (DEC-4).
- **RSK-3 (shared-file rebase collisions)** — *Mitigated by* surgical edits
  confined to the coverage/mode/Phase-7 sections only (this is a parallel batch
  with sibling GH-111).
- **RSK-4 (mode mis-set)** — *Mitigated by* the session-prompt one-line
  instruction (Phase 1) + the visibility aid (Phase 4) making a silent drop
  observable + the safe `interactive` default.
- **RSK-6 (governance drift)** — *Mitigated by* NFR-3/AC-F2-2 asserting the rule
  is verbatim with no exception; PDR-0002 reaffirms it.
- **RSK-VP (visibility tool — CEO gate)** — *Mitigated by* PD-2: the tool is
  advisory/observability only (no side effects), independently reviewable, and
  flagged for the GH-108 PR human review.

### Success Metrics

| Metric | Target | Source |
|--------|--------|--------|
| `delivery_mode` declared in `pm.md` step 3 + pm-notes structure | present (interactive default) | AC-F1-1 |
| Entry points reading the same `delivery_mode` signal | 100% (session + manual `@pm`); no env-var-only signal | AC-F1-2, NFR-2 |
| doc-syncer handoff is mode-aware (author in autonomous; reconcile/report otherwise) | present | AC-F2-1 |
| Tracker tickets auto-created by any agent in any mode | 0 | AC-F2-2 |
| Governance rule exceptions carved for autonomous mode | 0 (rule verbatim) | AC-F2-2 |
| Interactive/absent behavior change vs pre-change | 0 (byte-for-byte) | AC-F2-3 |
| Session `default_prompt_for()` instructs `delivery_mode: autonomous` | present (one line) | AC-F3-1 |
| Existing spec reconciled (not re-authored); routine edits excluded | rule stated | AC-NFR4-1 |
| Lifecycle Phase 7 disambiguates "advisory" | present | AC-F4-1 |
| doc-syncer wording no longer ⇒ silently-skipped in autonomous | present | AC-F4-2 |
| Visibility aid produces a computable, non-zero count | present + test passes | AC-F5-1, NFR-5 |
| `.ados-claude/` regenerated iff `.opencode/` edited | exact 1:1 regen set | AC-NFR7-1, NFR-7 |

## Phases

### Phase 0: Pre-flight (read-only — no edits)

**Goal**: Confirm the branch, ingest the authoritative sources, and prove the
plugin baseline is fresh before any `.opencode/` edit (converts the post-edit
"exact regen set" expectation from an assumption into a proven precondition).

**Tasks**:

- [x] **0.1** Confirm the working branch is
  `fix/GH-108/doc-syncer-reliable-spec-coverage` (`git branch --show-current`).
  STOP if not.
- [x] **0.2** READ the spec (`./chg-GH-108-spec.md` — §5 capabilities F-1…F-5,
  §7.1 scope, §17 ACs, DM-1/DM-2, NFRs) and the settled decision
  (`doc/decisions/PDR-0002-mode-aware-spec-coverage-resolution.md` — Decision
  D1/D2, constraints C-1…C-4). These are chosen input; do not re-litigate.
- [x] **0.3** READ the authoritative current files (verify the spec's "current
  state" claims against shipped sources):
  - `.opencode/agent/doc-syncer.md` — `<rules>` "Spec-coverage handoff (report,
    never ticket)" + `<reporting>` `spec_coverage_gaps` + step-2 positive
    coverage check + `<rules>` "Safety" write-allowlist + front matter
    `claude.model: opus` (the PD-1 evidence).
  - `.opencode/agent/pm.md` — step 3 (clarify_scope), the pm-notes YAML
    structure (step 3 / the structure block), the "Feature spec coverage
    awareness" bullet (currently advisory-only).
  - `.ai/agent/pm-instructions.md` — "PM must NEVER create new tickets
    autonomously" (preserve verbatim).
  - `doc/guides/change-lifecycle.md` — Phase 7 (`system_spec_update`) coverage
    wording ("advisory at this phase; does not block …").
  - `scripts/opencode-session.sh` — `default_prompt_for()` (autonomous entry
    point; sets no mode signal today).
  - `doc/spec/features/feature-delivery-lifecycle.md` — the spec for THIS
    change's feature area (`status: Current` ⇒ will be **reconciled**, not
    authored).
- [x] **0.4** PRECONDITION — plugin-baseline freshness: run
  `scripts/build-claude-plugin.sh` then `git diff --stat -- .ados-claude/` and
  require **EMPTY** output. This proves the committed `.ados-claude/` baseline is
  current (the build is deterministic). If the pre-diff is non-empty, STOP — the
  committed plugin is already stale and must be reconciled before proceeding.
  *(Pre-verified during planning: pre-diff EMPTY; `delivery_mode` currently
  appears in 0 of the 3 target files — confirms the spec's "not detectable today"
  claim.)*
- [x] **0.5** Confirm AC-NFR6-1 is satisfied by the spec artifact itself (the
  spec's Problem/Context documents the mode-blindness root cause, distinguishing
  it from "missing check" and "de-noise design flaw"). No edit needed — read-only
  verification.

**Acceptance Criteria**:

- Must: AC-NFR6-1 (root cause documented in the spec) — read-only confirmation.
- Should: plugin baseline proven fresh (Phase 1's exact-regen-set expectation is
  a proven precondition, not an assumption).

**Affected code areas**:

- none (read-only)

**System docs to update**:

- none

**Tests**:

- `git diff --stat -- .ados-claude/` is empty before any `.opencode/` edit.

**Completion signal**: *(pre-flight — no commit; proceed to Phase 1)*

---

### Phase 1: Mode signal — `delivery_mode` at intake + autonomous entry-point wiring (F-1, F-3)

**Goal**: Introduce the per-change `delivery_mode` signal (pm-notes field, set by
`@pm` at intake; default/absent ⇒ `interactive`) and wire the autonomous session
entry point to instruct `@pm` to set `autonomous`. This phase edits ONE
`.opencode/` file (`pm.md`) → regenerate `.ados-claude/` in-commit.

**Tasks**:

- [x] **1.1** EDIT `.opencode/agent/pm.md` step 3 (clarify_scope) and the pm-notes
  YAML structure block:
  - Add `delivery_mode` to the pm-notes structure as a top-level per-change field
    with the enum `interactive | autonomous`, default `interactive`, and the rule
    that an **absent** field is treated as `interactive` (identical to today —
    backward-compatible, no migration). Place it next to `change_id`/`title` in
    the YAML example.
  - In step 3a/3b (clarify_scope), declare that `@pm` sets `delivery_mode` at
    intake: manual `@pm` sets it explicitly (or leaves absent ⇒ `interactive`);
    the autonomous session entry point instructs `@pm` to set `autonomous`.
  - Keep the existing "Feature spec coverage awareness" bullet **advisory only —
    not a delivery blocker** in interactive mode; add a one-line pointer that
    coverage *resolution* at phase 7 is mode-aware (the detail lives in
    `doc-syncer.md`, authored in Phase 2 — cross-reference, do not duplicate).
- [x] **1.2** EDIT `.ai/agent/pm-instructions.md` (SURGICAL — coverage/mode area
  only): add a short note near the relevant section stating that `@pm` records
  `delivery_mode` in pm-notes at intake, and that the phase-7 spec-coverage
  resolution is mode-aware (autonomous ⇒ resolved in-change as a doc artifact;
  interactive ⇒ advisory + human-gated follow-up). **Do NOT touch the wording of
  "PM must NEVER create new tickets autonomously"** — the rule is preserved
  verbatim (C-1/NFR-3); the note must make clear the resolution produces a *doc
  artifact*, never a tracker ticket.
- [x] **1.3** EDIT `scripts/opencode-session.sh` `default_prompt_for()`: add a
  **one-line** instruction directing `@pm` to set `delivery_mode: autonomous` in
  pm-notes. No new tooling surface, flags, or env vars (the signal is the
  committed pm-notes field; a manual `@pm` invocation reads it identically —
  C-4/NFR-2).
- [x] **1.4** REGEN: run `scripts/build-claude-plugin.sh`. (Do NOT hand-edit
  `.ados-claude/**`.)
- [x] **1.5** VERIFY the regen diff is exact: `git diff --stat -- .ados-claude/`
  shows ONLY `.ados-claude/agents/pm.md` (this phase edited only `pm.md`; no
  command was edited → no `skills/**` diff; the manifest
  `.ados-claude/.claude-plugin/plugin.json` is static `1.0.0` → no diff). If
  anything else changed, STOP and reconcile.
- [x] **1.6** Hand off to `@committer`: stage `.opencode/agent/pm.md`,
  `.ai/agent/pm-instructions.md`, `scripts/opencode-session.sh`, and
  `.ados-claude/agents/pm.md` and commit as ONE unit (the source+generated
  invariant for the `.opencode/` edit; the other two files ride along as related
  mode-signal changes in the same logical step).

**Acceptance Criteria**:

- Must: AC-F1-1 (`pm.md` step 3 + pm-notes structure declare/set `delivery_mode`
  with the interactive default); AC-F3-1 (`default_prompt_for()` instructs
  `delivery_mode: autonomous`, one-line, no new tooling surface); AC-F1-2 (the
  signal is the pm-notes field, readable identically from session + manual `@pm`;
  no env-var-only mechanism); AC-F2-2 (the governance rule is untouched — verify
  `.ai/agent/pm-instructions.md` still contains "PM must NEVER create new tickets
  autonomously" verbatim with no autonomous-mode exception; the phrase's canonical
  home is `pm-instructions.md`, and `pm.md` is not required to carry it);
  AC-NFR7-1
  (`.ados-claude/` regenerated, exact 1-file diff).
- Should: the pm-instructions.md note is grep-distinguishable and surgical
  (governance-rule wording unchanged).

**Affected code areas**:

- `.opencode/agent/pm.md` (updated — `delivery_mode` field + intake action +
  advisory-interactive pointer)
- `.ai/agent/pm-instructions.md` (updated — surgical `delivery_mode` +
  mode-aware coverage note)
- `scripts/opencode-session.sh` (updated — one-line `default_prompt_for()`
  instruction)

**System docs to update**:

- `.ados-claude/agents/pm.md` (regenerated — tracks source)

**Tests**:

- Grep: `delivery_mode` now appears in `pm.md`, `opencode-session.sh`, and
  `pm-instructions.md`; absent/`interactive` default stated.
- Grep: "PM must NEVER create new tickets autonomously" still present and verbatim
  in its canonical home `.ai/agent/pm-instructions.md` (the phrase lives there;
  `pm.md` is not required to carry it); no "autonomous" exception clause carved
  in anywhere.
- Grep: `default_prompt_for()` carries the one-line `delivery_mode: autonomous`
  instruction; no new flags/env vars introduced in the script.
- Manual: confirm the regen diff is exactly `.ados-claude/agents/pm.md`.

**Completion signal**: `feat(GH-108): add delivery_mode signal at intake + autonomous session wiring (regen plugin)`

---

### Phase 2: Mode-aware spec-coverage resolution in `@doc-syncer` (F-2, F-4, NFR-1, NFR-3, NFR-4)

**Goal**: Make the phase-7 spec-coverage handoff mode-aware in
`.opencode/agent/doc-syncer.md`: read `delivery_mode` from pm-notes; in
`autonomous` mode resolve a gap for a modified feature area with no spec
in-change (author the missing `feature-<slug>.md`, first-spec-only — PD-1:
doc-syncer authors directly); an existing spec ⇒ reconcile; `interactive`/absent
⇒ unchanged report-only handoff. Normalize "advisory" so it cannot read as
"silently skipped" in autonomous mode. This phase edits ONE `.opencode/` file
(`doc-syncer.md`) → regenerate `.ados-claude/` in-commit.

**Tasks**:

- [x] **2.1** EDIT `.opencode/agent/doc-syncer.md` step 2 ("Feature spec coverage
  (positive coverage check)"): make the check's *resolution* mode-aware. After
  the existing detection (collect missing feature areas into
  `spec_coverage_gaps`), branch on `delivery_mode` read from
  `chg-<workItemRef>-pm-notes.yaml`:
  - **`autonomous`:** for each detected gap, resolve it **in-change** — if the
    modified feature area has **no** spec, **author** the missing
    `doc/spec/features/feature-<slug>.md` (front matter `status: Current`,
    `links.related_changes: ["<workItemRef>"]`; follow
    `doc/templates/feature-spec-template.md` as the structural guide; authored
    from authoritative sources — prompts/AGENTS.md/scripts). **First-spec-only**
    (DEC-4/NFR-4): if a spec already exists, it is merely **reconciled**, never
    re-authored. **PD-1:** `@doc-syncer` authors directly (opus tier + existing
    `doc/spec/**` capability). *(Fallback only if delivery shows it cannot: detect
    + record the requirement, hand authoring to `@coder`.)*
  - **`interactive` (or absent):** **byte-for-byte unchanged** — report
    `spec_coverage_gaps` only; `@pm` proposes a de-noised follow-up; only the
    human approves ticket creation. No new blocking prompt (C-3/NFR-1).
  - **No tracker ticket in any mode** (C-1/NFR-3): the resolution produces a
    **doc artifact** scoped to the change and reviewed at the open-PR human gate —
    never a tracker ticket.
- [x] **2.2** EDIT `.opencode/agent/doc-syncer.md` `<rules>` — reword the
  "Spec-coverage handoff (report, never ticket)" rule to be **mode-aware** while
  preserving its core invariants:
  - Keep verbatim: doc-syncer never creates a tracker ticket; the ticket-creation
    gate is human-only; no agent creates a ticket in any mode.
  - Add: in `autonomous` mode a detected gap for a modified feature area with no
    spec is **resolved in-change** (the missing `feature-<slug>.md` is authored,
    first-spec-only); an existing spec is reconciled. This promotes advisory →
    required **only for the first spec of an area that has none**.
  - Make explicit that "**advisory**" means "non-blocking at phase 7 / human
    decides ticket creation" in interactive mode, and must **not** be read as "can
    be silently skipped" in autonomous mode (F-4 / AC-F4-2).
- [x] **2.3** EDIT `.opencode/agent/doc-syncer.md` `<reporting>` — update the
  `spec_coverage_gaps` field description so it is mode-aware: in `autonomous`
  mode a resolved gap is reflected (the authored spec listed among `Updates`;
  residual gaps still listed); the field no longer implies "carries no automated
  side effect" unconditionally — in autonomous mode the side effect is the
  in-change authoring. Keep "never creates a spec or a ticket" accurate by
  scoping it to interactive mode.
- [x] **2.4** REAFFIRM the operational "feature area" definition (already present
  in step 2) — no rewording needed unless required for the mode-aware branch; the
  definition governs *when* authoring fires (over-fire guard, NFR-4). Ensure the
  mode-aware branch explicitly references it so autonomous authoring does not
  over-fire on routine edits.
- [x] **2.5** REGEN: run `scripts/build-claude-plugin.sh`. (Do NOT hand-edit
  `.ados-claude/**`.)
- [x] **2.6** VERIFY the regen diff is exact: `git diff --stat -- .ados-claude/`
  shows ONLY `.ados-claude/agents/doc-syncer.md` (this phase edited only
  `doc-syncer.md`; the Phase 1 regen for `pm.md` is already committed). If
  anything else changed, STOP and reconcile.
- [x] **2.7** Hand off to `@committer`: stage `.opencode/agent/doc-syncer.md` and
  `.ados-claude/agents/doc-syncer.md` and commit as ONE unit (the invariant).

**Acceptance Criteria**:

- Must: AC-F2-1 (doc-syncer handoff is mode-aware: reads `delivery_mode`;
  autonomous × no-spec ⇒ authored in-change; existing spec ⇒ reconciled);
  AC-NFR4-1 (existing spec reconciled not re-authored; routine edits excluded);
  AC-F2-2 (no tracker ticket in any mode; governance rule untouched —
  `.ai/agent/pm-instructions.md` still verbatim, no exception; the phrase's
  canonical home is `pm-instructions.md`, and `pm.md` is not required to carry
  it); AC-F2-3 (absent/interactive
  ⇒ identical to pre-change; no new blocking prompt); AC-F4-2 (doc-syncer
  `<rules>`/`<reporting>` wording no longer ⇒ silently-skipped in autonomous
  mode); AC-NFR7-1 (`.ados-claude/` regenerated, exact 1-file diff).
- Should: the mode-aware branch explicitly references the "feature area"
  definition (over-fire guard).

**Affected code areas**:

- `.opencode/agent/doc-syncer.md` (updated — mode-aware step-2 resolution branch,
  mode-aware `<rules>` handoff, mode-aware `<reporting>` field)

**System docs to update**:

- `.ados-claude/agents/doc-syncer.md` (regenerated — tracks source)

**Tests**:

- Grep: `delivery_mode` and `autonomous` now appear in `doc-syncer.md`;
  "advisory" is qualified (not standalone ⇒ silently-skipped).
- Grep: "never creates a tracker ticket" / "never creates a … ticket" still
  present; no path to ticket creation.
- Manual: source `doc-syncer.md` and generated `.ados-claude/agents/doc-syncer.md`
  carry identical mode-aware text.
- Grep: the regen diff is exactly `.ados-claude/agents/doc-syncer.md`.

**Completion signal**: `fix(GH-108): make doc-syncer spec-coverage resolution mode-aware (regen plugin)`

---

### Phase 3: Lifecycle wording — "advisory ≠ silently skipped" in Phase 7 (F-4)

**Goal**: Surgically update `doc/guides/change-lifecycle.md` Phase 7
(`system_spec_update`) so the mode-aware resolution is described and "advisory"
can no longer read as "silently skipped" in autonomous mode. **Shared file —
surgical, Phase-7-only edit** (RSK-3 parallel-batch minimization). No `.opencode/`
edit here → no regen.

**Tasks**:

- [x] **3.1** READ `doc/guides/change-lifecycle.md` Phase 7 (the
  "Feature spec coverage check" + "De-noised, human-gated handoff" bullets and the
  "Deferred alternative" note).
- [x] **3.2** EDIT Phase 7 surgically (the coverage/Phase-7 area only — do NOT
  restructure the section, the mermaid diagram, the phase numbering, or any other
  phase):
  - Disambiguate "advisory": it continues to mean "non-blocking at phase 7 /
    human decides ticket creation" in interactive mode, but it must **not** mean
    "can be silently skipped" in autonomous mode.
  - Describe the **mode-aware resolution**: `@doc-syncer` reads `delivery_mode`
    from pm-notes; in `autonomous` mode a detected gap for a modified feature
    area with no spec is **resolved in-change** (the missing `feature-<slug>.md`
    is authored, first-spec-only); an existing spec is reconciled;
    `interactive`/absent ⇒ unchanged report-only + human-gated follow-up. No
    tracker ticket in any mode.
  - Reference the operational "feature area" definition authoritatively in
    `.opencode/agent/doc-syncer.md` (do not restate it).
  - Keep the existing "Deferred alternative" (Proposal C) note intact.
- [x] **3.3** VERIFY no phase-count drift: the lifecycle still reads **11 phases**;
  `system_spec_update` stays **phase 7**; the mermaid diagram is unchanged.

**Acceptance Criteria**:

- Must: AC-F4-1 (Phase 7 disambiguates "advisory" and describes the mode-aware
  resolution); no phase-numbering drift (11 phases; doc-syncer = phase 7).
- Should: the edit is confined to the Phase-7 coverage/handoff bullets (surgical).

**Affected code areas**:

- none (documentation only)

**System docs to update**:

- `doc/guides/change-lifecycle.md` (updated — surgical Phase-7 mode-aware wording)

**Tests**:

- Grep: Phase 7 mentions `delivery_mode` / "autonomous" and the in-change
  resolution; "advisory" is qualified.
- Grep: no "10-phase" introduced; "11" / "phase 7" unchanged.

**Completion signal**: `docs(GH-108): disambiguate 'advisory' in lifecycle Phase 7 (mode-aware resolution)`

---

### Phase 4: Visibility aid — spec-coverage snapshot tool + test (F-5, AC-4, NFR-5)

**Goal**: Create the repo-internal visibility aid that makes a silent
spec-coverage drop observable: a count of feature specs present under
`doc/spec/features/` vs changes touching feature areas (derived from
`doc/changes/**`). Cheap, conservative, stdlib bash, no network. **CEO-gated per
repo convention; this autonomous session has no CEO — flag for the GH-108 PR
review (PD-2).**

**Tasks**:

- [x] **4.1** CREATE `scripts/spec-coverage-snapshot.sh` (stdlib bash only; no
  network; `set -Eeuo pipefail`):
  - Count feature specs present: list `doc/spec/features/feature-*.md`
    (`find … -name 'feature-*.md'`), emit the count.
  - Count changes touching feature areas: derive from `doc/changes/**/*--*--*/`
    change folders (each folder = one change) — emit the count of change folders.
    Optionally note feature-area mentions from spec `links`/summary where cheap,
    but keep it conservative (a simple, defensible count; do not over-engineer
    feature-area detection — that is prompt-described behavior in doc-syncer).
  - Emit a simple, parseable output: feature-specs-present count,
    change-folders count, and a ratio (present / touching) where meaningful.
    Exit 0 on success. Keep the output honest about its derivation.
- [x] **4.2** CREATE `scripts/.tests/test-spec-coverage-snapshot.sh` (per the
  `scripts/` convention — `.sh` extension, `test-*.sh` in `.tests/`; follow the
  embedded test-framework style used by the other `scripts/.tests/test-*.sh`
  files):
  - Assert the script runs and exits 0 on the real repo.
  - Assert the output contains a non-zero feature-specs-present count (there are
    16 existing feature specs under `doc/spec/features/`) and a non-zero
    change-folders count (there are existing change folders).
  - Assert no network dependency (stdlib only).
  - Optional: a temp-fixture case asserting the count is computable from a
    minimal synthetic tree (keeps the test self-contained and non-flaky).
- [x] **4.3** RUN `bash scripts/spec-coverage-snapshot.sh` and
  `bash scripts/.tests/test-spec-coverage-snapshot.sh` — both must pass and
  produce a non-zero, computable signal.

**Acceptance Criteria**:

- Must: AC-F5-1 (the aid produces a count of feature specs present vs changes
  touching feature areas — a computable, non-zero signal for autonomous runs,
  making a silent drop detectable); NFR-5 (computable & non-zero).
- Should: stdlib bash only (no network); test self-contained and non-flaky.

**Affected code areas**:

- `scripts/spec-coverage-snapshot.sh` (new)
- `scripts/.tests/test-spec-coverage-snapshot.sh` (new)

**System docs to update**:

- none (the visibility aid is a repo-internal tool; no `ados_distribution` marker
  applies — `scripts/` is outside the marker scope per `pm-instructions.md` /
  AGENTS.md; decision records are excluded)

**Tests**:

- `bash scripts/spec-coverage-snapshot.sh` — exits 0, emits non-zero counts.
- `bash scripts/.tests/test-spec-coverage-snapshot.sh` — passes.

**Completion signal**: `feat(GH-108): add spec-coverage snapshot visibility aid + test`

---

### Phase 5: Plugin freshness verification (NFR-7)

**Goal**: Final cross-cutting verification that `.ados-claude/` is current with
the Phase 1 + Phase 2 `.opencode/` edits and that the regen set is exactly the
two edited agent files (the 1:1 invariant). No `.opencode/` edit in this phase →
this phase produces no regen of its own; it asserts freshness.

**Tasks**:

- [x] **5.1** RUN `bash scripts/.tests/test-build-claude-plugin.sh` — the
  freshness oracle must pass (generated tree matches a fresh build).
- [x] **5.2** VERIFY the regen set is exact: across the change (vs the merge
  base), `git diff --stat -- .ados-claude/` touches ONLY:
  - `.ados-claude/agents/pm.md` (from Phase 1)
  - `.ados-claude/agents/doc-syncer.md` (from Phase 2)
  No `skills/**` diff (no command was edited); no manifest diff (static `1.0.0`).
  If anything else changed, STOP and reconcile (a non-source diff means a
  stale/undeterministic prior generation).
- [x] **5.3** VERIFY source == generated body: `.opencode/agent/pm.md` body ==
  `.ados-claude/agents/pm.md` body (minus the generated header/regen comment),
  and likewise for `doc-syncer.md`.

**Acceptance Criteria**:

- Must: AC-NFR7-1 (`.ados-claude/` regenerated via `build-claude-plugin.sh` and
  current); NFR-7 (regen set == `.opencode/` edit set exactly: pm.md +
  doc-syncer.md).
- Should: `test-build-claude-plugin.sh` fully green.

**Affected code areas**:

- none (verification only)

**System docs to update**:

- none

**Tests**:

- `bash scripts/.tests/test-build-claude-plugin.sh` — passes.
- `git diff --stat -- .ados-claude/` — exactly the two agent files.

**Completion signal**: `test(GH-108): verify plugin freshness (exact regen set)`

---

### Phase 6: Headers on new `scripts/` files (PD-3)

**Goal**: Apply license headers to the two new `scripts/` files via the header
script (AI never hand-adds headers), consistent with every existing file under
`scripts/` and `scripts/.tests/`. Confirm no `ados_distribution` marker is needed.

**Tasks**:

- [x] **6.1** RUN (explicit path — `scripts/` is not in the script's
  `DEFAULT_PATHS`, but the script accepts it as an argument and advertises it in
  its usage; every existing `scripts/` file carries this header):
  ```
  scripts/add-header-location.sh scripts/spec-coverage-snapshot.sh
  scripts/add-header-location.sh scripts/.tests/test-spec-coverage-snapshot.sh
  ```
- [x] **6.2** VERIFY each new file now has the 3-line bash comment header
  (copyright / MIT / "Latest version:") after the shebang, exactly once.
- [x] **6.3** VERIFY idempotency: re-running the script on either file produces
  NO diff (no duplicate header).
- [x] **6.4** CONFIRM no `ados_distribution` marker is required: `scripts/` is
  outside the marker scope (per `pm-instructions.md` "Doc Distribution Marker"
  and AGENTS.md — markers are for `doc/guides`, `doc/templates/**`, and the
  standalone docs; decision records excluded). Do NOT add a marker to the new
  files.
- [x] **6.5** CONFIRM no header action is needed for the files edited in Phases
  1–3 (`pm.md`, `doc-syncer.md`, `pm-instructions.md`, `change-lifecycle.md`,
  `opencode-session.sh`) — they already carry headers and were edited surgically
  (the script is idempotent; running it on configured paths is a no-op for them).

**Acceptance Criteria**:

- Must: both new `scripts/` files carry the canonical header exactly once,
  applied via the script (not hand-added); idempotent.
- Should: no `ados_distribution` marker added; no collateral header changes to
  existing files.

**Affected code areas**:

- `scripts/spec-coverage-snapshot.sh` (header injected)
- `scripts/.tests/test-spec-coverage-snapshot.sh` (header injected)

**System docs to update**:

- none

**Tests**:

- Grep per file: exactly one `^# Copyright.*2025-2026`, exactly one
  `^# MIT License.*see LICENSE`, exactly one `^# Latest version:`.
- Re-run script → `git diff` empty (idempotency).

**Completion signal**: `chore(GH-108): apply license headers to new scripts/ visibility aid`

---

### Phase 7: System-spec reconciliation — PM-coordinated, NOT a @coder task (DM-2, AC-DM2-1)

**Goal**: Record (NOT perform) the lifecycle phase-7 system-spec reconciliation.
This change's own feature area (the delivery lifecycle / phase-7 spec-coverage
capability) already has a spec (`doc/spec/features/feature-delivery-lifecycle.md`,
`status: Current`) ⇒ per the mode-aware rule it is **reconciled**, not authored
from scratch. **@coder STOPS before this phase** — it is run by `@doc-syncer` at
lifecycle phase 7 (`system_spec_update`), coordinated by `@pm`.

**Tasks**:

- [ ] **7.1** (@pm, lifecycle phase 7) Delegate to `@doc-syncer` with `GH-108`.
  `@doc-syncer` reconciles `doc/spec/features/feature-delivery-lifecycle.md` to
  describe the **mode-aware spec-coverage resolution** introduced by this change
  (delivery_mode signal; autonomous ⇒ in-change authoring; interactive ⇒
  advisory/human-gated; first-spec-only; no tracker ticket). This demonstrates
  the DM-2 contract (existing spec ⇒ reconciled, not authored — this change
  modifies an already-specced area, so authoring does NOT fire here).
- [ ] **7.2** (@doc-syncer) Because `delivery_mode` for THIS change is whatever
  `@pm` set at intake: if `autonomous`, and IF a modified feature area lacked a
  spec, the mode-aware rule would author it — but this change's feature area
  already has a spec, so the outcome is **reconcile** (first-spec-only guard;
  AC-DM2-1). Record the reconciliation in the `spec_coverage_gaps`/`Updates`
  report fields.
- [ ] **7.3** (@coder) STOP. Do NOT perform the reconciliation yourself; it is
  `@doc-syncer`'s phase-7 responsibility. This phase exists in the plan only to
  make the DM-2/AC-DM2-1 handoff explicit and traceable.

**Acceptance Criteria**:

- Must: AC-DM2-1 (`feature-delivery-lifecycle.md` is reconciled at lifecycle
  phase 7 by `@doc-syncer` to describe the mode-aware resolution; existing spec ⇒
  reconciled, not authored — demonstrating DM-2). *Verified at lifecycle phase 7,
  not by @coder.*
- Should: the reconciliation is captured in `@doc-syncer`'s structured report.

**Affected code areas**:

- none (@coder performs none; @doc-syncer reconciles at phase 7)

**System docs to update**:

- `doc/spec/features/feature-delivery-lifecycle.md` (reconciled by @doc-syncer at
  lifecycle phase 7 — describes the mode-aware resolution)

**Tests**:

- (@doc-syncer, phase 7) Grep: `feature-delivery-lifecycle.md` references the
  mode-aware resolution / `delivery_mode` after reconciliation.

**Completion signal**: *(lifecycle phase 7 — @doc-syncer; @coder stops here)* —
`docs(GH-108): reconcile feature-delivery-lifecycle spec (mode-aware resolution)`

---

## Test Scenarios

| ID | Scenario | Phases | AC |
|----|----------|--------|----|
| TS-1 | `pm.md` step 3 + pm-notes structure declare `delivery_mode` (interactive default; absent ⇒ interactive) | 1 | AC-F1-1 |
| TS-2 | `default_prompt_for()` instructs `delivery_mode: autonomous` (one line; no new flags/env vars) | 1 | AC-F3-1 |
| TS-3 | The signal is the pm-notes field — readable identically from session + manual `@pm` (no env-var-only mechanism) | 1 | AC-F1-2, NFR-2 |
| TS-4 | "PM must NEVER create new tickets autonomously" retained verbatim in its canonical home `.ai/agent/pm-instructions.md` (pm.md not required to carry it); no autonomous exception carved in | 1, 2 | AC-F2-2, NFR-3 |
| TS-5 | doc-syncer handoff is mode-aware: reads `delivery_mode`; autonomous × no-spec ⇒ authored in-change; existing spec ⇒ reconciled | 2 | AC-F2-1, DM-2 |
| TS-6 | Existing spec reconciled, not re-authored; routine edits excluded (over-fire guard) | 2 | AC-NFR4-1 |
| TS-7 | Absent/`interactive` ⇒ byte-for-byte unchanged (report-only; no new blocking prompt) | 1, 2 | AC-F2-3, NFR-1 |
| TS-8 | doc-syncer `<rules>`/`<reporting>` wording no longer ⇒ silently-skipped in autonomous mode | 2 | AC-F4-2 |
| TS-9 | Lifecycle Phase 7 disambiguates "advisory" and describes the mode-aware resolution; no phase-count drift | 3 | AC-F4-1 |
| TS-10 | `scripts/spec-coverage-snapshot.sh` produces a non-zero, computable count; its `scripts/.tests/` test passes | 4 | AC-F5-1, NFR-5 |
| TS-11 | `.ados-claude/` regen set == exactly `.opencode/` edits (pm.md + doc-syncer.md); freshness test green | 1, 2, 5 | AC-NFR7-1, NFR-7 |
| TS-12 | New `scripts/` files carry the canonical header exactly once (via script; idempotent); no `ados_distribution` marker | 6 | PD-3 |
| TS-13 | Root cause documented in the spec (mode-blindness; not missing-check; not de-noise flaw) | 0 | AC-NFR6-1 |
| TS-14 | `feature-delivery-lifecycle.md` reconciled by @doc-syncer at lifecycle phase 7 (existing spec ⇒ reconcile, not author) | 7 | AC-DM2-1 |

## Artifacts and Links

| Artifact | Location | Type |
|----------|----------|------|
| Change specification | `./chg-GH-108-spec.md` | Spec |
| Implementation plan (this file) | `./chg-GH-108-plan.md` | Plan |
| PM notes | `./chg-GH-108-pm-notes.yaml` | Tracking |
| Decision record (settled input) | `doc/decisions/PDR-0002-mode-aware-spec-coverage-resolution.md` | Decision (PDR) |
| pm prompt (edited) | `.opencode/agent/pm.md` | Agent prompt (source) |
| doc-syncer prompt (edited) | `.opencode/agent/doc-syncer.md` | Agent prompt (source) |
| PM instructions (edited, surgical) | `.ai/agent/pm-instructions.md` | Config |
| Session script (edited) | `scripts/opencode-session.sh` | Script |
| Lifecycle guide (edited, surgical) | `doc/guides/change-lifecycle.md` | Guide |
| Visibility aid (new) | `scripts/spec-coverage-snapshot.sh` | Script |
| Visibility aid test (new) | `scripts/.tests/test-spec-coverage-snapshot.sh` | Test |
| Generated plugin (regen) | `.ados-claude/agents/{pm,doc-syncer}.md` | Generated |
| Feature spec (reconciled at phase 7) | `doc/spec/features/feature-delivery-lifecycle.md` | Feature spec (existing) |
| Predecessor change (spec-coverage gate) | `doc/changes/2026-06/2026-06-28--GH-78--feature-spec-coverage-gate-and-debt/` | Reference |
| Sibling change (mirrors this pattern) | GH-111 (operational guides trigger) | Related (out of scope) |
| Implementation-plan template (structural guide) | `doc/templates/implementation-plan-template.md` | Template |

## Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-02 | plan-writer | Initial plan: 8 phases (0 pre-flight incl. plugin-baseline freshness; 1 mode signal + autonomous wiring [F-1/F-3]; 2 mode-aware doc-syncer resolution [F-2/F-4]; 3 lifecycle Phase-7 wording [F-4]; 4 visibility aid [F-5/AC-4]; 5 plugin freshness verify [NFR-7]; 6 headers on new scripts [PD-3]; 7 system-spec reconciliation as PM-coordinated @doc-syncer step, @coder stops before it [DM-2/AC-DM2-1]). Resolves spec OQ-1 (PD-1: doc-syncer authors directly — opus tier) and OQ-2 (PD-2: `scripts/spec-coverage-snapshot.sh` + test, CEO-gated ⇒ PR-review flag). Regen is in-commit per `.opencode/`-editing phase (1, 2) per the 1:1 invariant; Phase 5 is the final freshness verification. No commit performed (PM routes through @committer). |
| 1.1 | 2026-07-02 | plan-writer | DoR remediation (readiness-iter-1). Fixed ONE blocking cross-artifact drift: the plan asserted "PM must NEVER create new tickets autonomously" must be retained verbatim in BOTH `pm.md` AND `pm-instructions.md`, but the phrase exists ONLY in `.ai/agent/pm-instructions.md:40` (absent from `pm.md`, no task adds it there) — making the grep checks unachievable and contradicting TC-GOV-001. Corrected all affected locations (Scope F-2/NFR-3; Constraints governance-verbatim; Phase 1 AC + Tests; Phase 2 AC; TS-4) to verify the phrase in its canonical home `pm-instructions.md` only (pm.md not required to carry it) with no autonomous-mode exception carved in. Added the canonical-home note (single source of truth = `pm-instructions.md:40`) and confirmed the Phase-1 `pm.md` edit adds only `delivery_mode` + mode-aware coverage note — never the ticket-creation rule (surgical-edit constraint intact). Plan now agrees with TC-GOV-001. No source file, spec, or test-plan touched; no commit (PM routes through @committer). |

## Execution Log

<!-- Populated during execution:
| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
-->

| Phase | Status | Completed | Commit | Notes |
|-------|--------|-----------|--------|-------|
| 0 pre-flight | COMPLETED | 2026-07-03 | (read-only) | Branch confirmed; plugin baseline FRESH (empty pre-diff); AC-NFR6-1 satisfied by spec §3/§2.2/App. A. |
| 1 mode signal + autonomous wiring | COMPLETED | 2026-07-03 | `f32e0f0` | pm.md delivery_mode + intake + mode-aware coverage pointer; pm-instructions.md surgical note (governance rule verbatim, no exception); opencode-session.sh one-line prompt instruction; .ados-claude/agents/pm.md regen (exact 1-file). |
| 2 mode-aware doc-syncer | COMPLETED | 2026-07-03 | `a4b55a6` | doc-syncer.md step-2 mode-aware resolution branch + <rules> mode-aware handoff (invariants preserved) + <reporting> mode-aware field; feature-area definition reaffirmed as over-fire guard; .ados-claude/agents/doc-syncer.md regen (exact 1-file; source body == generated body). |
| 3 lifecycle Phase-7 wording | COMPLETED | 2026-07-03 | `55baff7` | change-lifecycle.md Phase-7 handoff bullet rewritten (mode-aware, never-ticket; "advisory" disambiguated). Exactly 1 line changed; mermaid/numbering/other phases untouched. |
| 4 visibility aid | COMPLETED | 2026-07-03 | `14b6ce0` | scripts/spec-coverage-snapshot.sh + test (9/9). Fixed locale bug (LC_ALL=C ratio) + test-framework masking bug (failure-flag run_test; negative-control verified). |
| 5 plugin freshness verify | COMPLETED | 2026-07-03 | (verification-only; folded into Phase 6 commit) | Oracle 16/16 (incl. committed==fresh-build); regen set across change = exactly pm.md + doc-syncer.md; no skills/manifest diff; source body == generated body for both. |
| 6 headers on new scripts | COMPLETED | 2026-07-03 | (this commit) | add-header-location.sh on the two new files (explicit path); exactly-once headers; idempotent; no ados_distribution marker; no collateral Phase 1–3 header churn. |
| 7 system-spec reconciliation | NOT STARTED (@coder stops before) | — | — | @doc-syncer reconciles feature-delivery-lifecycle.md at lifecycle phase 7 (PM-coordinated). NOT a @coder task. |

### Acceptance-criteria evidence (Phases 0–6)

- **AC-F1-1** — PASSED: `delivery_mode: interactive | autonomous` (absent ⇒ interactive) declared in `.opencode/agent/pm.md` step 3 + pm-notes YAML structure (grep: 2 hits). [Phase 1, f32e0f0]
- **AC-F1-2** — PASSED: the signal is the committed pm-notes field; the session prompt (`default_prompt_for()`) and manual `@pm` both read it — no env-var-only mechanism. [Phase 1, f32e0f0]
- **AC-F2-1** — PASSED: doc-syncer handoff is mode-aware — reads `delivery_mode`; autonomous × no-spec ⇒ authored in-change; existing spec ⇒ reconciled (first-spec-only). [Phase 2, a4b55a6]
- **AC-F2-2** — PASSED: no tracker ticket in any mode; "PM must NEVER create new tickets autonomously" retained verbatim at `.ai/agent/pm-instructions.md:40` with no autonomous exception (grep verified across Phases 1–2). [Phases 1–2]
- **AC-F2-3** — PASSED: absent/interactive ⇒ byte-for-byte unchanged report-only handoff (no new blocking prompt). [Phase 2, a4b55a6]
- **AC-F3-1** — PASSED: `default_prompt_for()` carries the one-line `delivery_mode: autonomous` instruction; no new flags/env vars introduced. [Phase 1, f32e0f0]
- **AC-F4-1** — PASSED: lifecycle Phase 7 disambiguates "advisory" and describes the mode-aware resolution; no phase-count drift (11 phases; phase 7). [Phase 3, 55baff7]
- **AC-F4-2** — PASSED: doc-syncer `<rules>`/`<reporting>` wording no longer ⇒ silently-skipped in autonomous mode. [Phase 2, a4b55a6]
- **AC-F5-1 / NFR-5** — PASSED: `scripts/spec-coverage-snapshot.sh` produces a non-zero, computable count (16 feature specs / 19 change-folders, ratio 0.84); `test-spec-coverage-snapshot.sh` 9/9 green. [Phase 4, 14b6ce0]
- **AC-NFR4-1** — PASSED: first-spec-only + reconcile-existing + feature-area over-fire guard stated in doc-syncer step 2 / `<rules>`. [Phase 2, a4b55a6]
- **AC-NFR6-1** — PASSED: root cause (resolution-path mode-blindness) documented in spec §3/§2.2/App. A. [Phase 0, read-only]
- **AC-NFR7-1** — PASSED: `.ados-claude/` regenerated via `build-claude-plugin.sh` and current (oracle 16/16; regen set == pm.md + doc-syncer.md exactly). [Phases 1, 2, 5]
- **AC-DM2-1** — NOT VERIFIED by @coder: `feature-delivery-lifecycle.md` reconciliation is a lifecycle-phase-7 @doc-syncer task (Phase 7, NOT STARTED — @coder stopped before it).
