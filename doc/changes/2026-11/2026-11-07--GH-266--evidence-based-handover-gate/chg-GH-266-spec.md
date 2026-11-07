---
change:
  ref: GH-266
  type: docs
  status: Proposed
  slug: evidence-based-handover-gate
  title: "Amend the M1-S9 handover gate to an evidence-based clean bar"
  owners: [engineering]
  service: delivery-os-planning
  labels: [change, docs]
  version_impact: none
  audience: internal
  security_impact: none
  risk_level: low
  dependencies:
    internal: [oss-tooling-backlog, oss-tooling-status, tdr-0005-delivery-result-contract]
    external: []
---

# CHANGE SPECIFICATION

> **PURPOSE**: Replace the calendar-window proxy in the M1-S9 handover gate with an evidence-based `clean` bar, so a repository hands over to the typed dispatch engine only when result-class coverage, incident and divergence truth, a minimum exposure floor, and corroborated evidence all agree.

## 1. SUMMARY

Amend the M1-S9 story entry in `doc/planning/oss-tooling/backlog.md` and record the amendment in `doc/planning/oss-tooling/status.md` so that `clean` for per-repository handover is defined by evidence rather than by elapsed time. The new bar is a conjunction: zero false-success incidents and zero unresolved divergences on the repository's pilot paths; dispatch evidence exercising every TDR-0005 result class on real tickets; a floor of at least 20 dispatches or at least 7 consecutive days, whichever comes first; and corroboration, where an engine-claimed success never counts without artifact and tracker truth. No source code, runtime contract, dependency, or other story acceptance criterion changes.

## 2. CONTEXT

### 2.1 Current State Snapshot

- `doc/planning/oss-tooling/backlog.md` is the canonical story scope. Its M1-S9 entry (GH-239, "Dispatch engine: dual-run evidence and per-repo handover") describes two gated phases: (a) evidence accrual during dual-run, and (b) per-repository handover, which additionally requires the resident daemon and the elapsed evidence window. The entry currently defines `clean` as "a rolling two-week window with zero false-success incidents and zero unresolved divergences on the repository's pilot paths". Its acceptance criteria state that handover is refused while the repository's clean window is unmet and offered when met, that handover is per repository and reversible, and that the bash entry points remain runnable as fallback with deprecation pointers.
- `doc/planning/oss-tooling/status.md` is a dated snapshot, explicitly subordinate to the backlog. It restates the two-clean-weeks rule for M1-S9 in forward-looking text: in the paragraph following "Milestone exit: pending" (the dispatch handover sentence) and in item 3 of "Proposed next steps". It also contains a dated 2026-11-03 amendment section that restates per-engine two-clean-weeks evidence, and an M0 exit-criteria list whose first item requires "zero false-success incidents on pilot paths over two weeks".
- The authoritative delivery-result vocabulary is the eleven-token set in `packages/core/src/contracts/delivery-result.ts` (`DELIVERY_RESULT_TOKENS`), bound to TDR-0005: `merged`, `blocked`, `pr-open`, `pr-open-unverified`, `failed`, `finished`, `max-restarts`, `state-unverified`, `partial`, `noop-lane-permission`, `noop-lane-nothing-to-do`. TDR-0005 makes token-level parity, not exit parity, the dual-run comparison unit and records `state-unverified` as the single known projection divergence.
- No delivered system specification describes dispatch or the handover gate: M1-S9 is undelivered, `feature-scheduling-engine.md` explicitly excludes dispatch and handover, and the TDR-0005 vocabulary is owned by the verify/result-contract feature spec. The handover gate therefore exists only as planning truth.
- Both planning files are outside the closed doc-distribution scope: the distribution guard enumerates `doc/guides`, `doc/templates`, and a fixed standalone list, not `doc/planning`. Neither `backlog.md` nor `status.md` carries an `ados_distribution` marker today; `backlog.md` carries a copyright/`source` frontmatter block and `status.md` has no frontmatter.

### 2.2 Pain Points / Gaps

- A rolling two-week calendar window measures elapsed time, not classifier exposure. Two weeks of light traffic passes the gate with almost no evidence, while heavy traffic across varied outcomes is held back for no safety benefit.
- The gate does not require the classifier to have produced the outcomes it is supposed to distinguish, so a handover can occur after exercising only a narrow slice of the TDR-0005 vocabulary. Rare but important classes (`state-unverified`, `noop-lane-permission`, `max-restarts`) may never be observed before the engine becomes authoritative.
- The current definition accepts "zero false-success incidents" as an absolute claim without saying how a success claim is established. An engine result token can be self-consistent and still contradict the pushed head, CI state, tracker state, or the recorded phase artifacts.
- The owner has directed an evidence-based bar with early use and on-the-go tuning (CEO-D-073), and the planning truth must reflect that direction before M1-S9 is delivered and evaluated.

## 3. PROBLEM STATEMENT

Because the M1-S9 handover gate is defined as an elapsed calendar window, the delivery process cannot distinguish a repository that has accumulated real classifier exposure from one that has merely waited, resulting in either premature authority transfer on thin evidence or avoidable delay on dense and varied evidence, and in an unstated reliance on engine-claimed success.

## 4. GOALS

- **G-1**: `backlog.md` M1-S9 defines `clean` as the composite evidence bar (incident and divergence truth, result-class coverage, exposure floor, corroboration), replacing the calendar window as the definition.
- **G-2**: `status.md` records the CEO-D-073 amendment with the same bar and corroboration rule, points forward-looking restatements of the superseded rule at the amendment, and leaves history intact.
- **G-3**: The result-class requirement is stated as every TDR-0005 class, enumerating all eleven tokens including `pr-open-unverified`, and is checkable against the typed contract.
- **G-4**: No other story acceptance criterion, dependency, milestone gate, or historical record changes; the diff is docs-only and guard-clean.

### 4.1 Success Metrics / KPIs

| Metric | Target for this change |
|---|---|
| Planning files changed | Exactly 2 (`backlog.md`, `status.md`) |
| Other files changed | 0 |
| TDR-0005 classes enumerated in the amended M1-S9 `clean` definition | 11 of 11, 0 missing, 0 extra |
| Documents stating the corroboration rule | 2 of 2 (backlog and status) |
| Other-story acceptance criteria or dependencies modified | 0 |
| Rewritten historical records (dated 2026-11-03 amendment, M0 exit criteria) | 0 |
| Doc guard failures | 0 |

### 4.2 Non-Goals

- **NG-1**: Deliver, scaffold, or prototype the dispatch engine, the resident daemon, or the handover mechanism. This change is planning truth only.
- **NG-2**: Change the TDR-0005 vocabulary, the result contract, or any runtime behavior.
- **NG-3**: Rewrite the dated operator-input or 2026-11-03 amendment history, or retroactively alter evidence that was recorded under the superseded rule.
- **NG-4**: Alter the M0 exit criterion "zero false-success incidents on pilot paths over two weeks"; it is a different milestone gate.
- **NG-5**: Propagate the amended bar to the secondary planning documents named in Section 7.2, or edit the GH-239 ticket body.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|---|---|---|
| F-1 | Canonical evidence-based `clean` predicate in the M1-S9 backlog entry | The backlog is the canonical story scope; the gate must be defined where the story is defined. |
| F-2 | Dated CEO-D-073 amendment record in the status snapshot, with supersession pointers | The status file currently restates the superseded rule in forward-looking text; readers must land on the new bar. |
| F-3 | Corroboration safety rule stated in both files | An engine-claimed success must never be sufficient evidence for handover. |
| F-4 | Result-class coverage bound to the eleven-token contract | Class coverage is only meaningful if it is total over the vocabulary the classifier can emit. |
| F-5 | Preservation of unrelated content and disclosure of the declared residual | No other story AC, dependency, milestone gate, or historical record may drift, and stale secondary docs must be visible rather than silently contradictory. |

### 5.1 Capability Details

- **F-1**: The M1-S9 entry's definition of `clean` becomes a conjunction of four conditions. (a) **Truth on pilot paths**: zero false-success incidents and zero unresolved divergences on the repository's pilot paths. (b) **Class coverage**: dispatch evidence exercising every TDR-0005 result class on real tickets. (c) **Exposure floor**: at least 20 dispatches or at least 7 consecutive days, whichever comes first. (d) **Corroboration**: engine-claimed success is never sufficient; a dispatch counts clean only when artifact and tracker truth agree. The text must state that "whichever comes first" binds only the floor in (c), so the floor alternates between dispatch count and elapsed days but never substitutes for class coverage, incident truth, or corroboration. The phrases "rolling two-week window" and "two clean weeks" must no longer define the M1-S9 gate. The story's existing acceptance criteria, its dependency line, its phase structure, and its heading remain as written.
- **F-2**: `status.md` gains one new dated amendment section that attributes the change to CEO-D-073, states the composite bar and the corroboration rule, points to the M1-S9 backlog entry as canonical, and notes that secondary planning documents still carry the superseded calendar phrasing pending a follow-up. The forward-looking statements that restated the two-clean-weeks rule for M1-S9 gain short supersession pointers to the new section, without being rewritten as if they had never said it. The dated 2026-11-03 amendment bullets, the M0 exit-criteria list, and the M0 pilot evidence statements are untouched.
- **F-3**: Both files state that a dispatch's result token is by itself insufficient. Corroboration is exactly the evidence set named by the owner directive: completed pm-notes phases, tracker state, and CI on the pushed head. The rule must be legible per outcome family: a success claim such as `merged` needs the pushed head, CI on that head, tracker state, and completed phases; a tracker-derived claim such as `pr-open`, `blocked`, or `pr-open-unverified` needs the tracker fact. The spec does not require a per-token table in the docs; it requires the insufficiency rule and the three evidence sources.
- **F-4**: The enumerated classes are set-equal to `DELIVERY_RESULT_TOKENS`, which is the TDR-0005 vocabulary: `merged`, `blocked`, `pr-open`, `pr-open-unverified`, `failed`, `finished`, `max-restarts`, `state-unverified`, `partial`, `noop-lane-permission`, `noop-lane-nothing-to-do`. The ticket's parenthetical list carries ten tokens and omits `pr-open-unverified`; the normative clause "every TDR-0005 result class" governs, so the amendment enumerates all eleven and the omission is resolved deliberately and disclosed to the owner (DEC-3). The enumeration must be checkable by set comparison against the contract, not by prose inspection alone.
- **F-5**: Changes are line-scoped to the M1-S9 entry in `backlog.md` and to the new amendment section plus supersession pointers in `status.md`. The M1-S9 heading text is unchanged, so existing headings and any reader expectations around anchors are stable. The `backlog.md` frontmatter block is preserved byte for byte; `status.md` remains without frontmatter; no `ados_distribution` marker is added to either file. The status amendment names, without editing, the documents that still restate the superseded M1-S9 phrasing, so the residual is declared rather than hidden.

## 6. USER & SYSTEM FLOWS

No runtime flow changes; this change alters planning truth. The reader and evaluator flows that matter are:

```
Flow 1: Reader evaluates the M1-S9 gate
  Reader opens backlog.md M1-S9 -> reads composite clean definition
  -> sees four conditions and the floor-only "whichever comes first"
  -> sees the corroboration rule -> cannot hand over on elapsed time alone

Flow 2: Reader reaches status.md first
  status.md forward-looking M1-S9 sentences -> supersession pointer
  -> dated CEO-D-073 amendment section -> composite bar and corroboration rule
  -> canonical definition located in backlog.md M1-S9

Flow 3: Future handover evaluation for a repository
  Collect dispatches on real pilot tickets -> classify with TDR-0005 tokens
  -> check incident and divergence truth -> check all eleven classes exercised
  -> check floor (>=20 dispatches OR >=7 consecutive days)
  -> corroborate each counted dispatch against pm-notes phases, tracker state,
     and CI on the pushed head -> handover offered only if all four hold
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The M1-S9 definition of `clean` in `doc/planning/oss-tooling/backlog.md`, including the corroboration rule and the eleven-class enumeration.
- One new dated amendment section in `doc/planning/oss-tooling/status.md` recording CEO-D-073 with the same bar and rule.
- Short supersession pointers in `status.md` on the forward-looking statements that restated the two-clean-weeks rule for M1-S9.
- A one-line declared-residual note in the status amendment naming the secondary documents that still carry the superseded phrasing.

### 7.2 Out of Scope

- [OUT] `backlog-ranking.md` rank 39 note, `roadmap.md` M1 sequencing constraint 6 and the M1 exit-evidence table row for M1-S9, `cli-command-registry.md` dispatch and `deliver-ticket.sh` rows, `milestones/m1/commands/dispatch.md`, `milestones/m1/journeys.md`, `user-journeys.md`, and `milestones/m1/test-scenarios.md` (SC-M1-29 and SC-M1-30): they restate the superseded calendar phrasing for M1-S9 but are outside the ticket's declared file scope. They are recorded as a declared residual and named in the status amendment.
- [OUT] `operator-requirements-2026-11.md`: a dated historical operator-input record, never rewritten.
- [OUT] The GH-239 ticket body, which quotes the current definition verbatim and becomes stale. It is reported to the owner, not edited.
- [OUT] The M0 exit criterion "zero false-success incidents on pilot paths over two weeks" in `roadmap.md` and in the `status.md` M0 exit-criteria list: a different milestone gate, unchanged.
- [OUT] Any source code, contract, schema, changeset, runtime command, or system-spec (`doc/spec/**`) change.
- [OUT] Any change to another story's acceptance criteria, dependencies, scope, or ranking, and any new decision record.

### 7.3 Deferred / Maybe-Later

- A follow-up documentation change to propagate the evidence-based bar into the secondary planning documents listed in 7.2, and to refresh the GH-239 ticket body. Deferred because the ticket fixes the file scope and because the owner has not yet ruled on those files.
- Any machine-readable encoding of the `clean` predicate (for example a gate policy consumed by tooling). Deferred until M1-S9 is designed; encoding a policy now would create a runtime contract this change must not touch.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

None. This change introduces or modifies no HTTP surface.

### 8.2 Events / Messages

None. No event, message, or machine-readable artifact is introduced. The `clean` predicate remains prose planning truth until a future story decides otherwise.

### 8.3 Data Model Impact

| ID | Element | Description |
|---|---|---|
| DM-1 | `clean` predicate | Documentation-level definition: conjunction of pilot-path truth, eleven-class coverage, exposure floor, and corroboration. The floor is the only condition with an "either/or" alternative. |
| DM-2 | Result-class enumeration | The set of tokens the coverage condition requires; set-equal to `DELIVERY_RESULT_TOKENS` (eleven tokens, TDR-0005), explicitly including `pr-open-unverified`. |
| DM-3 | Corroboration evidence set | Completed pm-notes phases, tracker state, and CI on the pushed head. A result token alone never satisfies it. |

No runtime data model, storage schema, or migration is affected.

### 8.4 External Integrations

None. No tracker, CI, provider, or harness integration behavior changes. The corroboration rule refers to existing evidence sources; it does not add a connector or an API call.

### 8.5 Backward Compatibility

- Readers and tooling that resolve the string "clean window" keep working: the M1-S9 acceptance criterion keeps that phrase, and the amended definition is what the phrase now means.
- The TDR-0005 vocabulary is unchanged, so the enumeration is an allowed use of the contract, not a divergence from it.
- Evidence previously recorded under the calendar rule is not invalidated or reinterpreted; the new bar applies to handover decisions made after the amendment.
- The M1-S9 heading text is unchanged; any consumer that resolves it by heading text sees no change.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|---|---|---|
| NFR-1 | Docs-only containment | Changed files exactly 2, both under `doc/planning/oss-tooling/`; 0 changes under `packages/`, `scripts/`, `tests/`, `doc/spec/`, `.opencode/`, or schema/build files. |
| NFR-2 | Historical integrity | 0 characters changed in the dated 2026-11-03 amendment bullets, the M0 exit-criteria list, and the M0 pilot evidence statements; `backlog.md` frontmatter byte-identical. |
| NFR-3 | Semantic consistency between the two files | 0 contradictions on the four conditions, the floor-only scope of "whichever comes first", and the three corroboration sources. |
| NFR-4 | Contract fidelity of the enumeration | 11 of 11 TDR-0005 tokens present, 0 missing, 0 extras, verified by set comparison against the typed contract. |
| NFR-5 | Guard cleanliness | `bash scripts/.tests/test-doc-distribution.sh` exits 0; the forbidden-literals check reports 0 new violations attributable to the two changed files; no broken intra-repository link is introduced. |
| NFR-6 | Reversibility | The whole change reverts with one docs revert; no migration, no data repair, no downstream state to unwind. |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

None. The amendment describes evidence that future dispatch evaluation will consume, but this change emits no metric, log, trace, or alert, and adds no collector. Any future machine-readable gating is deferred (Section 7.3).

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|---|---|---|---|---|---|
| RSK-1 | Two amended files contradict secondary planning documents that still state the calendar rule | M | H | Declare the residual in the spec and name it in the status amendment; point readers to the canonical M1-S9 entry | M: a reader who opens only `roadmap.md` or the command pages still sees the superseded phrasing until the follow-up lands |
| RSK-2 | The floor is misread as an alternative to class coverage or corroboration, weakening the bar | H | M | State explicitly in both files that "whichever comes first" binds only the exposure floor; AC checks that sentence exists | L: prose can still be skimmed, but the defect is visible on review |
| RSK-3 | The enumeration silently inherits the ticket's ten-token list and omits `pr-open-unverified` | H | M | Normative clause governs; enumerate all eleven; AC requires set equality against `DELIVERY_RESULT_TOKENS`; disclose the resolution in a ticket comment | L: a future token addition would require a new amendment, which is correct behavior |
| RSK-4 | Corroboration is stated so vaguely that any token plus one artifact passes | H | L | Name exactly the three evidence sources and state the insufficiency rule; AC checks both are present | L: per-outcome sufficiency still needs judgment at evaluation time |
| RSK-5 | Editing the M1-S9 heading breaks or shifts anchors used elsewhere | M | L | Keep the heading text unchanged; record the pre-existing stale `#m1-s9-dispatch-dual-run-pilot` references in `doc/inception` as untouched | L: the stale anchor remains stale, which predates this change |
| RSK-6 | A doc guard fails or a forbidden literal is introduced | L | L | Run the doc-distribution guard and the forbidden-literals check; introduce no new brand or path literals | L: guard coverage is limited to the scoped doc set |
| RSK-7 | The GH-239 ticket body now quotes a superseded definition | L | H | Report the discrepancy to the owner with the PR; do not edit another ticket's body | L: the ticket stays stale until the owner or PM updates it |
| RSK-8 | The edit over-reaches and touches another story's acceptance criteria or dependency | M | L | line-scoped edits; AC requires the diff to show no change outside the M1-S9 entry and the status amendment | L: review by diff is reliable for a two-file change |

## 12. ASSUMPTIONS

- CEO-D-073 is an owner directive with standing authority; recording it in the backlog and status is sufficient, and no new decision record is required.
- TDR-0005 and `packages/core/src/contracts/delivery-result.ts` remain the normative, unchanged vocabulary for result classes.
- "Real tickets" means dispatches on the repository's actual pilot work items, not fixtures, synthetic runs, or harness smoke tests.
- The M0 exit criterion that mentions two weeks is a distinct gate about the M0 dual-run pilot, not the M1-S9 handover gate, and must remain as written.
- No delivered system specification describes dispatch or the handover gate, so no `doc/spec/**` reconciliation is owed by this change.
- The ticket's explicit two-file scope is authoritative; secondary documents are intentionally out of scope despite the known contradiction.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|---|---|---|
| Depends on | TDR-0005 and the typed delivery-result contract | The enumeration must be set-equal to the eleven-token vocabulary. |
| Depends on | CEO-D-073 owner directive | The bar and the corroboration rule derive from it. |
| Depends on | Existing M1-S9 entry (GH-239) | It is the text being amended; GH-239 is undelivered, so no delivered behavior depends on the old wording. |
| Blocks | M1-S9 delivery and any handover decision | Handover will be evaluated against the amended bar. |
| Blocks | Future owner decision on the secondary documents and the ticket body | Deferred until the owner rules; see 7.3. |

## 14. OPEN QUESTIONS

No blocking questions. The ticket's ten-token parenthetical is resolved by the normative clause (DEC-3), not left open. Exact prose, section placement, and the amendment date inside `status.md` are authoring choices for the plan, not scope decisions.

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|---|---|---|---|
| DEC-1 | `clean` is the conjunction of pilot-path truth (zero false-success incidents, zero unresolved divergences), eleven-class coverage on real tickets, the exposure floor, and corroboration | Owner directive CEO-D-073; a calendar window measures waiting, not exposure | 2026-11-07 |
| DEC-2 | "Whichever comes first" binds only the exposure floor (at least 20 dispatches or at least 7 consecutive days); it is not an alternative to class coverage, incident truth, or corroboration | Prevents the floor from becoming a loophole that lowers the bar | 2026-11-07 |
| DEC-3 | The amendment enumerates all eleven TDR-0005 classes, explicitly including `pr-open-unverified`, because the normative clause "every TDR-0005 result class" governs over the ticket's incomplete ten-token parenthetical; the resolution is disclosed to the owner | Contract fidelity; a class-coverage gate must be total over the vocabulary the classifier can emit | 2026-11-07 |
| DEC-4 | The corroboration evidence set is exactly completed pm-notes phases, tracker state, and CI on the pushed head; a dispatch token alone never makes a dispatch clean | Owner directive; closes the engine-claimed-success gap | 2026-11-07 |
| DEC-5 | File scope is exactly `backlog.md` (M1-S9 entry) and `status.md` (new amendment section plus supersession pointers); secondary documents are a declared residual | Ticket's explicit scope; keeps the diff reviewable | 2026-11-07 |
| DEC-6 | The dated 2026-11-03 amendment is historical record and is not rewritten; a new dated section records CEO-D-073, and forward-looking statements gain supersession pointers | Status is a snapshot with dated history; rewriting it would falsify the record | 2026-11-07 |
| DEC-7 | The M0 exit criterion mentioning two weeks is left unchanged | It is the M0 pilot gate, not the M1-S9 handover gate | 2026-11-07 |
| DEC-8 | The M1-S9 heading text is unchanged, so anchors do not shift; the pre-existing stale `#m1-s9-dispatch-dual-run-pilot` references in `doc/inception` are neither fixed nor worsened here | Heading edits are a gratuitous compatibility risk in a docs amendment | 2026-11-07 |
| DEC-9 | No `ados_distribution` marker is added to either file | `doc/planning` is outside the closed doc-distribution scope, and neither file carries the marker today; adding one would invent a distribution class | 2026-11-07 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|---|---|
| `doc/planning/oss-tooling/backlog.md` | Updated: M1-S9 `clean` definition, class enumeration, corroboration rule |
| `doc/planning/oss-tooling/status.md` | Updated: new dated amendment section, supersession pointers, residual note |
| Secondary planning documents (ranking, roadmap, command registry, journey, scenario, operator-input files) | Unchanged; declared residual, named in the status amendment |
| GH-239 ticket body | Unchanged; becomes stale; reported to the owner |
| Delivery-result contract and runtime tooling | Unchanged |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|---|---|---|
| AC-F1-1 | **Given** the M1-S9 entry in `backlog.md`, **when** a reviewer reads the `clean` definition, **then** it states all four conditions: zero false-success incidents and zero unresolved divergences on the repository's pilot paths; every TDR-0005 result class exercised on real tickets; at least 20 dispatches or at least 7 consecutive days, whichever comes first; and the corroboration rule. | F-1, F-3, DM-1 |
| AC-F1-2 | **Given** the M1-S9 entry, **when** searched for gate definitions, **then** "rolling two-week window" and "two clean weeks" no longer define the gate, and the entry states that "whichever comes first" applies only to the floor. | F-1, DEC-2 |
| AC-F1-3 | **Given** the M1-S9 entry, **when** its acceptance criteria and dependency line are compared with the pre-change text, **then** they are unchanged, including the "clean window" phrase, the refusal-and-offer criterion, per-repository reversibility, and the bash fallback criterion. | F-1, F-5, NFR-2 |
| AC-F2-1 | **Given** `status.md`, **when** a reviewer reads it, **then** one new dated section attributes the change to CEO-D-073, states the composite bar and the corroboration rule, points to the M1-S9 entry as canonical, and names the declared residual without editing those documents. | F-2, F-5 |
| AC-F2-2 | **Given** the forward-looking `status.md` statements that restated the two-clean-weeks rule for M1-S9 (the paragraph after "Milestone exit: pending" and item 3 of "Proposed next steps"), **when** read, **then** each carries a supersession pointer to the new amendment section. | F-2 |
| AC-F2-3 | **Given** the dated 2026-11-03 amendment bullets, the M0 exit-criteria list, and the M0 pilot evidence statements in `status.md`, **when** the diff is inspected, **then** those regions are byte-identical to the pre-change file. | F-5, NFR-2 |
| AC-F3-1 | **Given** the amended files, **when** a reviewer checks the corroboration rule, **then** both files state that an engine-claimed success is never sufficient and name exactly the three evidence sources: completed pm-notes phases, tracker state, and CI on the pushed head. | F-3, DM-3 |
| AC-F4-1 | **Given** the amended M1-S9 enumeration, **when** compared as a set with `DELIVERY_RESULT_TOKENS`, **then** all eleven tokens are present, including `pr-open-unverified`, with zero missing and zero extras; and the change record discloses that the ticket's ten-token list was resolved in favor of the normative clause. | F-4, DM-2, NFR-4, DEC-3 |
| AC-F5-1 | **Given** the M1-S9 heading in `backlog.md`, **when** the diff is inspected, **then** the heading text is unchanged. | F-5, DEC-8 |
| AC-F5-2 | **Given** both changed files, **when** the diff is inspected, **then** the `backlog.md` frontmatter block is byte-identical, `status.md` has no frontmatter added, and neither file gains an `ados_distribution` marker. | F-5, NFR-2, DEC-9 |
| AC-NFR1-1 | **Given** the full change diff, **when** the changed-path list is inspected, **then** exactly two files changed, both under `doc/planning/oss-tooling/`, and no file under `packages/`, `scripts/`, `tests/`, `doc/spec/`, `.opencode/`, or build configuration changed. | NFR-1 |
| AC-NFR5-1 | **Given** the repository's doc guards, **when** they are run on the amended tree, **then** `bash scripts/.tests/test-doc-distribution.sh` exits 0, the forbidden-literals check reports no new violation attributable to the two changed files, and no intra-repository link introduced by the change is broken. | NFR-5 |
| AC-NFR3-1 | **Given** the amended files, **when** the four conditions, the floor-only scope of "whichever comes first", and the three corroboration sources are compared across the two files, **then** no contradiction exists. | NFR-3, F-1, F-2, F-3 |

### 17.1 Definition of Done

- [ ] Every acceptance criterion above is verified against the diff, not against intent.
- [ ] The eleven-token comparison is performed mechanically (set comparison against `DELIVERY_RESULT_TOKENS`), and the result is recorded in the PR description or review.
- [ ] The doc guards named in AC-NFR5-1 have been run and their results recorded.
- [ ] The diff touches exactly the two declared files; no incidental reformatting, whitespace churn, or heading change appears.
- [ ] The stale GH-239 ticket body and the declared-residual documents are reported to the owner in a ticket comment, without editing them.
- [ ] The owner is told, in that comment, that `pr-open-unverified` was added on the authority of the normative clause (DEC-3).

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

One docs-only pull request against the tooling integration branch, reviewed by the owner as the directive holder. No runtime rollout, feature flag, migration, or communication campaign is involved. After merge, the amended M1-S9 entry is the canonical gate; every later handover decision reads the backlog definition first and the status amendment second. The residual documents and the GH-239 ticket body are reported at PR time so the owner can schedule a follow-up; until then, readers who encounter the calendar phrasing in secondary documents are directed to the amended M1-S9 entry.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

None. No stored data, index, ledger, or seed set changes. Previously recorded pilot evidence is neither migrated nor re-scored.

## 20. PRIVACY / COMPLIANCE REVIEW

No personal, private, or credential data is added. Both files are internal planning documents already published in the repository. The change introduces no new identifier, path, or vendor name, and the forbidden-literals and privacy scans remain green. No compliance obligation changes.

## 21. SECURITY REVIEW HIGHLIGHTS

No runtime security surface changes. The amendment is security-relevant governance: the corroboration rule reduces the chance that a self-claimed success grants authority to an unverified engine. The change adds no credential handling, no new trust boundary, and no executable surface.

## 22. MAINTENANCE & OPERATIONS IMPACT

- `backlog.md` remains canonical; `status.md` remains a dated snapshot.
- The declared residual creates a known, temporary inconsistency across planning documents until a follow-up change lands; the status amendment names it so operators do not have to rediscover it.
- The GH-239 ticket body will quote a superseded definition until the owner refreshes it.
- Future result-class additions to TDR-0005 require a corresponding amendment here; the coverage gate is intentionally total, so a new class makes the old enumeration incomplete by design.

## 23. GLOSSARY

| Term | Definition |
|---|---|
| Clean (handover bar) | The composite evidence predicate a repository must satisfy before the typed dispatch engine becomes authoritative there. |
| Corroboration | Agreement between an engine-claimed result and independent truth: completed pm-notes phases, tracker state, and CI on the pushed head. |
| Dispatch | One typed per-ticket delivery run through the engine (spawn, watch, classify, summarize). |
| Exposure floor | The minimum evidence volume, at least 20 dispatches or at least 7 consecutive days, whichever comes first. |
| False-success incident | A dispatch whose claimed successful outcome is contradicted by artifact, tracker, or CI truth. |
| Per-repository handover | Authority transfer for one repository, recorded, reversible, and independent of other repositories. |
| Pilot paths | The repository's real delivery work items used during dual-run, as opposed to fixtures or smoke tests. |
| Result class | One of the eleven TDR-0005 delivery-result tokens the classifier can emit. |
| TDR-0005 | The decision record adopting the eleven-token delivery-result vocabulary and token-level dual-run parity. |
| Unresolved divergence | A dual-run disagreement between the engine's classification and the bash stack's summary that has been neither explained nor closed. |

## 24. APPENDICES

Superseded definition (verbatim from the current M1-S9 entry): "Clean is defined: a rolling two-week window with zero false-success incidents and zero unresolved divergences on the repository's pilot paths."

Canonical eleven-token set, from `DELIVERY_RESULT_TOKENS` / TDR-0005: `merged`, `blocked`, `pr-open`, `pr-open-unverified`, `failed`, `finished`, `max-restarts`, `state-unverified`, `partial`, `noop-lane-permission`, `noop-lane-nothing-to-do`.

Ticket parenthetical (ten tokens, missing `pr-open-unverified`): `merged`, `pr-open`, `blocked`, `partial`, `failed`, `max-restarts`, `finished`, `state-unverified`, `noop-lane-permission`, `noop-lane-nothing-to-do`.

Declared residual documents (unchanged, still carrying the superseded M1-S9 phrasing): `backlog-ranking.md` (rank 39 note), `roadmap.md` (M1 sequencing constraint 6 and the M1 exit-evidence table row for M1-S9), `cli-command-registry.md` (dispatch row and `deliver-ticket.sh` row), `milestones/m1/commands/dispatch.md`, `milestones/m1/journeys.md`, `user-journeys.md`, `milestones/m1/test-scenarios.md` (SC-M1-29 and SC-M1-30), and `operator-requirements-2026-11.md` (dated historical record).

Sources: GH-266 ticket with owner directive CEO-D-073; PM planning summary and binding decisions; current `backlog.md` M1-S9 entry; current `status.md`; `packages/core/src/contracts/delivery-result.ts`; TDR-0005.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-07 | @spec-writer | Initial specification |

---

## AUTHORING GUIDELINES

- Authored from the GH-266 ticket, the PM clarify-scope summary and binding decisions, and direct reads of the two planning files, the typed result contract, and TDR-0005.
- The template at `doc/templates/change-spec-template.md` governed structure; every section is present in order, and the Definition of Done lives under Section 17 so the mandated ordering is preserved.
- Scope was deliberately kept to a single-purpose docs amendment: four functional capabilities, one acceptance group per capability, and no invented runtime contract.
- Line-level targets are named only enough to make acceptance checkable; exact prose, section wording, and edit mechanics belong to the plan and the coder.
- Findings that belong to a different gate (the M0 exit criterion, the stale GH-239 body, the secondary documents) are recorded as constraints, residual, or out-of-scope, not silently absorbed.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-266)
- [x] `owners` has at least one entry (`engineering`)
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no code file paths, no step-by-step tasks)
- [x] No content duplicated from linked docs beyond the minimal quoted superseded sentence and the normative token list
- [x] Front matter validates per front_matter_rules
