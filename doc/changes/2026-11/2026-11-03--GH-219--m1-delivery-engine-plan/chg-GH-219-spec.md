---
change:
  ref: GH-219
  type: docs
  status: Proposed
  slug: m1-delivery-engine-plan
  title: "Plan milestone M1: delivery engine and autonomous dispatch"
  owners: [engineering]
  service: delivery-os-planning
  labels: [change]
  version_impact: none
  audience: internal
  security_impact: low
  risk_level: medium
  dependencies:
    internal: [roadmap, backlog, backlog-ranking, cli-command-registry, status, privacy-guard]
    external: []
---

# CHANGE SPECIFICATION

> **PURPOSE**: Record an owner-approved direction for the next milestone as a complete, sanitized, internally consistent delivery-engine plan without changing the running delivery tooling.

## 1. SUMMARY

Redefine M1 around typed autonomous delivery and its truth and attention prerequisites, with queue, lanes, and dispatch pulled forward from M2. Deliver six planning documents: revised roadmap, backlog, ranking, command registry, status, and a sanitized operator requirements input. This change plans future capabilities; it does not deliver them, create their tickets, accept decision records, or switch pilot repositories to a new engine.

## 2. CONTEXT

### 2.1 Current State Snapshot

The current autonomous delivery system uses four bash scripts for per-ticket delivery, batch delivery, coordination, and liveness. M0 stories have landed, but M0 exit is still pending pilot evidence and owner acceptance of Proposed decision records. Current planning puts truth and attention in M1 and queue, lanes, dispatch, ceremonies, and measurement in M2. The existing phase-transition specification already distinguishes full and lite variants, and the privacy guard applies to public planning artifacts. These describe current behavior, not an implemented M1 delivery engine.

### 2.2 Pain Points / Gaps

- Existing milestone boundaries separate dispatch from its prerequisite truth engines and delay scheduling, session economics, blockers, and spend visibility.
- Prose merge checks, status re-verification, manual scheduling, stranded parks, and resume loops consume coordinating attention and tokens.
- Current plans do not declare enough scope, lease, artifact, or interaction information to establish safe parallel delivery and artifact-verified completion.
- The operator's production evidence exists only as an ignored, private draft and cannot be committed verbatim.

## 3. PROBLEM STATEMENT

Because the published M1/M2 plan does not capture the owner-approved delivery-engine boundary or the operator's production constraints, the owner cannot authorize immediately actionable milestone work after this planning change merges, resulting in ambiguous sequencing, unsafe handover assumptions, and possible disclosure from unsanitized planning inputs.

## 4. GOALS

- **G-1**: Make the six planning deliverables mutually consistent and ready to seed self-contained follow-up story tickets after owner acceptance.
- **G-2**: Trace all twelve operator requirements and the four binding owner decisions into milestone scope, dependencies, handover criteria, and observable acceptance.
- **G-3**: Preserve M0 history and M3/M4 scope while explaining the specific M1/M2 moves and the concurrent M0 pilot.
- **G-4**: Publish the operator's dated incident-class evidence without private identifiers or sensitive values.

### 4.1 Success Metrics / KPIs

| Metric | Target for this planning change |
|---|---|
| Named planning deliverables | 6 of 6 present and consistent |
| Operator requirement coverage | R1 through R12 each mapped to a milestone story or explicit M2 seam |
| Replacement mapping | 4 of 4 named bash functions mapped to M1 successor stories |
| Story readiness | 100% of revised M1 stories contain Goal, Tasks, AC, and Depends on; dependency graph acyclic and aligned with ranking |
| Private content in committed planning output | 0 privacy-corpus literals; sanitized input passes the binding privacy check |
| M0 story history changes | 0 |

### 4.2 Non-Goals

- **NG-1**: Implement, enable, or claim parity for the typed delivery engine in this change.
- **NG-2**: Create follow-up milestone or story tickets, accept decision records, or merge the change without owner review.
- **NG-3**: Add hosted infrastructure, dashboards, multi-host orchestration, new tracker or provider integrations, or an LLM in deterministic scheduling, digest, or brief paths.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|---|---|---|
| F-1 | Record the amended milestone boundaries and handover gates in the roadmap and status | Makes the binding owner decisions visible without rewriting M0 history. |
| F-2 | Produce a self-contained M1 backlog and acyclic, matching delivery ranking | Makes follow-up tickets immediately derivable and exposes ordering errors. |
| F-3 | Record the intended successor capabilities for all four bash delivery functions | Prevents partial replacement from being misrepresented as full handover. |
| F-4 | Capture transactional merge, truthful signals, and explicit CEO judgment as planned M1 outcomes (R1, R2) | Blocks unsafe authorization and false-green conclusions. |
| F-5 | Capture autonomous scheduling, machine-readable plans, and session lifecycle economics as planned M1 outcomes (R3, R4, R5) | Enables safe parallel planning, leased delivery, and economically bounded resume. |
| F-6 | Capture typed blocker questions, digest coverage, and a shared-source brief as planned M1 outcomes (R6, R7, R11) | Reduces lane idle time and repeated fact gathering without adding LLM assembly. |
| F-7 | Capture one-command closeout, spend visibility, ceremony-tier seam, and self-describing commands (R8, R9, R10, R12) | Separates M1 read and contract needs from the M2 ceremony engine. |
| F-8 | Align the command registry with every new or extended command family proposed in the stories | Prevents command names and story scope from drifting. |
| F-9 | Publish a sanitized, decision-first operator requirements input with dated incident classes | Preserves evidence while protecting private operations. |
| F-10 | Record the concurrent M0 pilot, pending owner acceptance, and later owner gate for this planning change | Prevents planning from being mistaken for pilot completion or authorization to merge. |

### 5.1 Capability Details

- **F-1**: M1 becomes the delivery-engine milestone. M2 retains ceremonies, board, steer, the metrics engine, memory records, and other content except explicitly moved scope. M3/M4 content remains, with bash removal still M4-S5. M0 pilot and early M1 delivery may overlap; each engine still needs its own two-clean-weeks evidence before handover. On pilot repositories at M1 exit the new stack is authoritative for the four named bash functions, with the bash stack a documented fallback and deprecation pointers, not removed.
- **F-2**: Retain and rework watchdog and lane contracts, state validation, doctor, merge and deploy verification, owner-gate SLA, same-source brief, minimal MCP, retro pipeline, harness adapters, dispatch dual-run pilot, status expansion, and capsule and closeout work. Pull M2-S1 queue, lanes, and dispatch into M1; add planned stories for the plan schema, commit and phase-done primitive, session economics, typed blocker channel shared by owner gates and CEO, scheduling, daemon, agent-prompt integration, closeout residue, and spend read side. Keep M2-M4 stories intact except necessary moves or rebadging, including dependent references.
- **F-3**: Map `deliver-ticket.sh` to per-ticket typed dispatch and lifecycle, `batch-deliver.sh` to queue and dependency-aware batch orchestration, `ceo-loop.sh` to daemon and CEO-facing coordination, and `pm-liveness.sh` to progress-based session liveness. Each mapping names an M1 successor story and its handover evidence, without claiming the story is delivered.
- **F-4**: Planned merge is an explicit CEO action: a versioned gate set declared as data checks fresh tracker and CI evidence, owner-gate classification and recorded waivers, actual head-run artifacts, and landing; refusal names a gate and inline evidence. Truthful tri-state, artifact-verified signals extend to every acted-on engine, including deploy job trace and non-vacuous CI. The plan never weakens existing gates or treats a collector finding alone as a merge verdict.
- **F-5**: Planned scheduling separates parallel preparation from delivery protected by repository leases. Per-repository single-flight is the only structural lane cap; dependency ordering, closing-before-opening, build-weight resource classes, condition-clearing park/resume, single-instance crash safety, dispatcher-not-a-lane, and CLI one-shot fallback remain required. Plans declare phase scope by files/packages/folders, done-artifacts, leases, weight classes, interactions, tier/variant, readiness, and overlap so joins validate artifacts rather than exit status. Liveness uses progress, economically valid resume or explicit refusal, and a bounded, visible restart budget. Daemon dispatch is sequenced behind merge, signal, and liveness truth.
- **F-6**: Questions distinguish `decision-needed`, `spec-ambiguity`, `credential-missing` by variable name only, and `external-wait`; owner gates and CEO blockers consume one shared question contract, ranked in the digest and answerable as data. The bounded status digest covers lanes, merge-ready actions, parked conditions, owner-gate ages, spend, partial collection, and stable finding codes. The deterministic brief uses the same collector state and anchors merge actions, questions, and gate aging.
- **F-7**: Planned closeout performs repeatable post-merge mechanics and returns unresolved judgment residue. Planned per-ticket/per-phase spend exposes resume amplification. M1 records tier and escalation configuration as a seam, while the ceremony runner remains M2; existing full and lite phase behavior is acknowledged rather than overwritten by an invented universal phase set. Help, man-page-grade guides, stable machine summaries, stable exit meanings, and doctor diagnostics are covered in M1 planning.
- **F-8**: Command registry coverage includes plan validation and lint, queue, lanes, dispatch, daemon control, commit and phase completion, blocker ask/answer, spend, and expanded status and digest behavior; the registry distinguishes proposed M1 commands from current delivered commands and respects the existing command-name decision lock.
- **F-9**: Sanitized input preserves the R1-R12 priorities, hard constraints, acceptance view, dates, and incident mechanisms without naming private repositories, fleet members, people, or credentials. No private draft is itself a deliverable.
- **F-10**: M0 remains open until its dual-run evidence and decision-owner acceptance are recorded; all 13 Proposed records stay Proposed during M1 unless separately accepted. Planning approval and any subsequent merge of this change require explicit owner review; execution follows this merge.

## 6. USER & SYSTEM FLOWS

1. Owner reviews a six-document planning set, verifies the requirement-to-story and story-to-command mappings, then explicitly accepts or requests changes before merge.
2. After merge, follow-up ticket creation can use the ranked self-contained stories. M0 dual-run and early M1 work may proceed concurrently; neither completion nor decision acceptance is inferred from this plan.
3. Future target operator loop, not current functionality: read one digest, answer typed questions, explicitly request transactional merge, review closeout residue, then select the next work. Waiting, polling, scheduling, and healthy-path re-verification are not CEO session work.
4. Future handover: each truth engine accumulates two clean weeks of evidence per repository; only then does its successor become authoritative there, retaining the bash fallback through the M1 transition.

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- Exactly six ticket deliverables: roadmap, backlog, backlog ranking, CLI command registry, sanitized operator requirements input, and milestone status.
- Owner-approved milestone moves, sequencing constraints, four bash-function mappings, and R1-R12 traceability.
- Status clarification of pending M0 gate and owner acceptance.

### 7.2 Out of Scope

- [OUT] Tooling code, agent prompt changes, runtime command behavior, daemon launch, and live handover.
- [OUT] New tickets or milestone execution before this planning change merges.
- [OUT] M0 historical story edits, decision record status changes, or M3/M4 scope removal.
- [OUT] Hosted dependencies, dashboards, multi-host scheduling, new tracker/provider integrations, and LLM-based deterministic paths.
- [OUT] Bash removal before M4-S5.

### 7.3 Deferred / Maybe-Later

- M2: ceremony runner, board, steer, metrics engine, memory records and follow-through except explicitly moved spend read side.
- M4-S5: removal of the deprecated bash delivery stack.
- Operator P2 ideas: idempotent convergence, stale-work sweep, and trust-boundary helpers, without implying M1 commitment.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

None introduced by this documentation change. Future tracker freshness and gate checks are described as outcomes, not new HTTP endpoints.

### 8.2 Events / Messages

No runtime event introduced. Planned typed questions carry category, actionable context, status, and answer without exposing credential values; planned phase-done and closeout records identify observable completion and residual judgment. Exact runtime schemas belong to follow-up stories.

### 8.3 Data Model Impact

| ID | Planned element | Contract to document, not deliver now |
|---|---|---|
| DM-1 | Delivery plan | Phase scope, done-artifact, repository lease, weight class, declared interactions, variant/tier, and readiness. |
| DM-2 | Gate policy | Versioned gate set, freshness including tracker state, owner-gate classification, and recorded waiver. |
| DM-3 | Blocker question | Typed category, safe credential variable name when applicable, answer and unblock status; shared by two consumers. |
| DM-4 | Spend observation | Per-ticket/per-phase costs and resume amplification alongside token and session evidence. |
| DM-5 | Planning dependency | Story identity, milestone, precedence, and move/rebadge cross-references consistent across backlog and ranking. |

### 8.4 External Integrations

None added in this change. The planned engine uses existing tracker, version-control, CI, and harness boundaries; no new provider is promised.

### 8.5 Backward Compatibility

Current bash delivery remains authoritative during M0 and per-engine dual-run. At M1 exit, authority shifts only on qualified pilot repositories and bash remains fallback with deprecation pointers. The CLI naming lock and current full/lite phase semantics remain in force; planning must not silently rename locked commands or claim an implemented replacement.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold for this planning change |
|---|---|---|
| NFR-1 | Deliverable completeness | 6 of 6 named documents cover their assigned contracts. |
| NFR-2 | Privacy | 0 privacy-corpus literals and 0 credential values in committed deliverables; sanitized input passes the binding scanner. |
| NFR-3 | Planning consistency | 100% of M1 stories have Goal, Tasks, AC, Depends on; 0 dependency cycles or dangling moved references across backlog and ranking. |
| NFR-4 | Requirement traceability | 12 of 12 operator requirements and 4 of 4 bash-function successors mapped in planning documents. |
| NFR-5 | Boundary integrity | 0 M0 historical story edits, 0 implemented-engine claims, 0 removal of M3/M4 scope except explicit rebadging or moved dependencies. |
| NFR-6 | Publication discipline | 0 em dashes in new content; 0 private draft identifiers in committed planning output. |
| NFR-7 | Planned handover safety | Roadmap requires 2 clean weeks of per-engine evidence per repository before authority transfer; no waiver implied by concurrent M0/M1 work. |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

This change adds no runtime telemetry. Planning records future coverage of truthful digest findings, lane and park state, owner-gate age, failed-gate evidence, per-ticket/per-phase spend, restart classification, and resume amplification. Milestone status distinguishes planned, pilot evidence pending, and accepted states; no unobserved result is reported as green.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|---|---|---|---|---|---|
| RSK-1 | Private operator details leak through the sanitized input | H | M | Generalize identifiers, preserve mechanisms and dates, run privacy guard and human review | M: scanner coverage is not a substitute for contextual review |
| RSK-2 | Moving dispatch into M1 is read as permission to bypass truth gates | H | M | Explicit truth-before-daemon order, per-engine evidence, bash fallback, CEO-controlled merge | M: later execution must prove parity |
| RSK-3 | Ranking diverges from story dependencies after moves | M | M | Require an acyclic graph and exact dependency agreement with the revised backlog | L: future story changes may drift |
| RSK-4 | M0 status or proposed decisions are prematurely marked complete | H | M | Preserve history, state the concurrent pilot gate and pending owner acceptance distinctly | L: owner still needs to record formal acceptance |
| RSK-5 | Command expansion conflicts with locked v1 naming | M | M | Distinguish proposed extensions from frozen family names and surface naming conflicts for owner review | M: follow-up decision may be necessary |

## 12. ASSUMPTIONS

- The four owner decisions stated in the ticket are binding for this planning artifact.
- The existing roadmap and story backlog are the baseline for moves; current system specs remain authoritative about what is already delivered.
- No acceptance of Proposed records is implied by planning approval or pilot launch.
- Current milestone horizons are directional, not delivery deadlines.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|---|---|---|
| Depends on | M0 delivered truth surfaces and current autonomous-delivery behavior | Baseline for accurate migration and replacement mapping. |
| Depends on | Existing privacy guard and command naming decision | Constrain publication and command planning. |
| Depends on | Four owner decisions and operator requirement evidence | Bind milestone shape, safety gates, and sanitized input. |
| Blocks | Owner-approved M1 story tickets and implementation | Follow-up only after this planning change merges. |
| Blocks | Per-repository authoritative handover | Requires independent two-clean-weeks evidence for each engine. |

## 14. OPEN QUESTIONS

No unresolved scope decisions: the four owner decisions are binding. Exact thresholds for runtime digest latency, economic resume policy, and per-engine evidence criteria beyond the two-clean-weeks gate belong to follow-up story specifications; this planning change does not invent them.

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|---|---|---|---|
| DEC-1 | Redefine M1 as the delivery engine, move M2-S1 into it, and move ceremonies, board, steer, metrics engine, and memory records to M2; preserve M3/M4 | Owner decision 1 | 2026-11-03 |
| DEC-2 | Run the M0 two-week dual-run pilot concurrently with M1 planning and early work, without waiving per-engine handover evidence; keep 13 Proposed records Proposed pending owner acceptance | Owner decision 2 | 2026-11-03 |
| DEC-3 | At M1 exit the new stack is authoritative on qualified pilot repositories, with bash fallback and deprecation pointers; removal remains M4-S5 | Owner decision 3 | 2026-11-03 |
| DEC-4 | Commit a sanitized operator requirements input | Owner decision 4 | 2026-11-03 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|---|---|
| Milestone roadmap | Revised M1/M2 boundary, gate and sequencing direction |
| Story backlog | Revised M1 story set and moved/rebadged downstream dependencies |
| Backlog ranking | Revised order and dependency alignment |
| CLI command registry | Planned command family and extension coverage |
| Operator requirements input | New sanitized evidence document |
| Milestone status | Amended M0 gate and planning-change reference |
| Running delivery tooling | No change |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|---|---|---|
| AC-F1-1 | **Given** the existing milestone roadmap, **when** the planning set is reviewed, **then** M1 is named the delivery-engine milestone with truth before daemon, explicit CEO merge, local-first one-shot degradation, authoritative pilot handover with bash fallback, zero resume-loop class as an exit target, and two clean weeks per engine and repository. | F-1, NFR-7 |
| AC-F1-2 | **Given** M0's delivered story history, **when** the new status is reviewed, **then** the concurrent pilot is recorded, M0 remains open pending pilot evidence and acceptance of 13 Proposed records, and no M0 historical story is changed. | F-1, F-10, NFR-5 |
| AC-F2-1 | **Given** the revised story set, **when** backlog and ranking are compared, **then** every M1 story has Goal, Tasks, AC, Depends on, the dependencies are acyclic and consistent, M2-S1 dependencies are moved into M1, and M2-M4 content is retained except explicit moves and rebadging. | F-2, DM-5, NFR-3 |
| AC-F3-1 | **Given** the four named bash delivery functions, **when** the M1 backlog is inspected, **then** each maps explicitly to a successor story and qualified handover, with removal reserved for M4-S5. | F-3, NFR-4 |
| AC-F4-1 | **Given** R1 and R2, **when** merge and truth stories are read, **then** they cover versioned gate-set data, fresh tracker and CI evidence, named refusal, non-vacuous artifact truth, owner policy and waiver, and explicit CEO merge with no weaker gate. | F-4, DM-2 |
| AC-F5-1 | **Given** R3, **when** scheduling and daemon stories are read, **then** they cover parallel planning, leased repository delivery, sole structural per-repo single-flight cap, dependencies, closing priority, build-weight class, condition-clearing parks, singleton crash safety, dispatcher-not-a-lane, and one-shot fallback after truth engines. | F-5 |
| AC-F5-2 | **Given** R4, **when** plan-schema and readiness stories are read, **then** they cover machine-readable per-phase scope, done-artifacts, leases, weight classes, interactions, tier/variant, overlap, and artifact-verified joins. | F-5, DM-1 |
| AC-F5-3 | **Given** R5, **when** session stories and M1 exit are read, **then** they require progress-based liveness, no repeated prefill or explicit uneconomic refusal, bounded visible restart failure, and zero resume-amplification incident class as an exit target. | F-5, DM-4 |
| AC-F6-1 | **Given** R6, R7, and R11, **when** attention and brief stories are read, **then** they specify the four safe question types, shared owner/CEO consumers, data answers, ranked bounded digest with stable finding codes and partial-collection state, and deterministic brief from the same collector state. | F-6, DM-3 |
| AC-F7-1 | **Given** R8, R9, and R10, **when** closeout, spend, and ceremony stories are read, **then** M1 contains closeout judgment residue and per-ticket/per-phase spend with resume amplification, while tier and escalation remain a data seam and the ceremony engine stays M2. | F-7, DM-4 |
| AC-F7-2 | **Given** R12, **when** command and diagnostic stories are read, **then** they require command help, man-page-grade guidance, stable machine summaries and exit meanings, and doctor diagnostics. | F-7 |
| AC-F8-1 | **Given** all proposed M1 command stories, **when** the registry is compared, **then** plan validate/lint, queue, lanes, dispatch, daemon control, commit, blockers ask/answer, spend, and status digest extensions appear with accurate planned versus delivered attribution and no silent locked-name changes. | F-8 |
| AC-F9-1 | **Given** the ignored operator input, **when** the sanitized document is reviewed and privacy checked, **then** R1-R12, dates and incident-class mechanisms remain, with zero private identifiers, credential values, and corpus literals. | F-9, NFR-2 |
| AC-F10-1 | **Given** the planning change is ready for review, **when** its lifecycle reaches the PR, **then** owner acceptance is required before merge and execution tickets follow only after merge. | F-10 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

Publish the six documents together for owner review. The PR remains open until the owner accepts the milestone plan; merge and downstream ticket creation follow that gate. The documents describe the intended M1 rollout: truth engines first, daemon later, engine-by-engine pilot qualification, bash fallback through the deprecation window, and no removal until M4-S5. This change itself rolls out no runtime behavior.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

No runtime data migration. The operator's private draft is an input only; the sanitized, dated planning document is the sole publishable version. M0 history is not rewritten.

## 20. PRIVACY / COMPLIANCE REVIEW

Review all six deliverables against the current privacy guard, with additional human review for contextual private names and sensitive operational detail the scanner might not recognize. Preserve evidence dates and incident classes without copying private identifiers. Do not publish credential values or fleet/repository names from ignored drafts.

## 21. SECURITY REVIEW HIGHLIGHTS

The planning contracts retain fail-closed merge evidence, versioned gates, recorded waivers, and explicit CEO judgment. Credential questions expose only variable names. No runtime security surface is changed by this documentation-only artifact.

## 22. MAINTENANCE & OPERATIONS IMPACT

After acceptance, backlog and ranking remain the canonical story scope and order; the command registry tracks planned versus delivered surfaces, and status tracks milestone evidence without inferring acceptance. Future stories must independently prove handover and update current-state system specifications only after delivery.

## 23. GLOSSARY

| Term | Definition |
|---|---|
| Dual-run | Pilot comparison of a successor engine beside the still-authoritative bash path. |
| Handover | Per-engine and per-repository authority transfer after two clean weeks of qualifying evidence. |
| Judgment residue | Unresolved human decisions returned after mechanical closeout. |
| Resume amplification | Paid session work relative to unique progress after resume/restart. |
| Truth engine | Verification and liveness capability whose evidence must precede automated dispatch. |

## 24. APPENDICES

Sources: GH-219 issue and four owner decisions; owner milestone draft; private operator requirements draft used only as sanitization input; existing milestone roadmap, backlog, ranking, command registry, and status; current autonomous-delivery, privacy-guard, and phase-transition specifications. The planned delivery-engine outcomes here do not supersede current-state specifications.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-03 | Change spec writer | Initial planning-only specification |

---

## AUTHORING GUIDELINES

Requirements are phrased as outcomes for six planning documents, not instructions to implement the future engine. Future behavior is explicitly identified as planned; private drafts are not quoted or published. Owner decisions are binding, and undecided follow-up runtime details are not guessed.

## VALIDATION CHECKLIST

- [x] Reference, owner, status, metadata, section order, and ID formats conform.
- [x] All AC use Given/When/Then and link a capability, data element, or quantified requirement.
- [x] All R1-R12 and four bash successors are traceable to planned stories and acceptance.
- [x] Risks include impact, probability, mitigation, and residual risk.
- [x] Only this specification is authored here; no runtime implementation or private identifiers are included.
