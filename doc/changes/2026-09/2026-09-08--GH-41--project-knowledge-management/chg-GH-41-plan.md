---
id: chg-GH-41-project-knowledge-management
status: Proposed
created: 2026-09-09T04:01:07Z
last_updated: 2026-09-09T04:01:07Z
owners: ["Juliusz Ćwiąkalski"]
service: project-knowledge-management
labels: [change, planning, "priority:high"]
links:
  change_spec: ./chg-GH-41-spec.md
  test_plan: ./chg-GH-41-test-plan.md
  adr_refs: [../../../decisions/ADR-0003-repo-local-knowledge-gap-identifiers.md]
  related_changes: [GH-140, GH-49, GH-33, GH-13]
summary: >
  GH-41 introduces Project Knowledge Management as a cross-cutting ADOS capability,
  with @knowledge as the shared query and stewardship facade for humans and AI
  agents. The capability applies knowledge-class-specific authority, provenance,
  uncertainty, access, and contradiction rules; manages durable Knowledge Gaps
  without becoming an answer store or second backlog; and integrates bounded
  knowledge handling into delivery, decisions, review, inception, documentation
  reconciliation, contributor orientation, distribution, and multi-tool use.
  The initial delivery remains Git-native and integration-agnostic. External
  systems are optional configured sources, while canonical resolution always
  occurs in the source that owns the relevant knowledge.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-41: Project Knowledge Management capability and @knowledge agent

## Context and Goals

Deliver F-1–F-13 as one acceptance boundary: evidence-backed query, bounded review,
Contributor Orientation, durable gap stewardship, specialized-role integration,
portable distribution, and verified ADOS dogfood. The completed change spec is
requirements authority; the completed test plan supplies TC-KNOWLEDGE-001–023 and
their AC mappings. Paths introduced below are implementation selections for those
contracts, not additional product requirements.

Use `doc/templates/implementation-plan-template.md` for structure and the phase
task/criteria/files/tests format below for execution. No implementation, model
evaluation, or gate result is claimed by this planning artifact.

### Planning resolutions

- **Machine validators:** deliver one distributable `tools/knowledge-gap` utility
  with `validate`, `next-id`, and `index` subcommands, adjacent shell tests, and a
  single shipped gap schema. It validates structure and identity, not the truth
  of claims or semantic deduplication. The validation matrix below fixes the
  automated/manual boundary; regex-only prompt tests cannot satisfy dogfood.
- **Runner mechanics:** use fresh standalone CLI processes in isolated ADOS
  snapshot repositories, with explicit canonical agent/generated plugin selection,
  not the current nested agent's cached prompt. Exact command forms, isolation,
  retained evidence, and failure handling are defined under Test Scenarios.
- **Delegation mechanics:** coder sends prompt work to `@toolsmith`, commands to
  `@runner`, and commit requests to `@committer`. If a nested runtime lacks Task,
  return the bounded request to parent PM for brokerage, then resume from its
  returned evidence. Do not impersonate the missing specialist or recursively
  delegate to obtain a tool. A broker transport hop is not another knowledge
  reasoning hop; retain the owning role and depth across it.
- **Tracked closure:** use existing GH-41 as the tracked work for a genuine
  capability/navigation deficiency repaired by this delivery. PM owns the routing
  acknowledgment; no unrelated issue or synthetic production ticket is needed.
  An isolated fixture alone is insufficient for the required canonical Resolved gap.
- **ADR status:** implement/test the scoped recommendation while ADR-0003 remains
  Proposed. Human acceptance is reserved for GH-41 PR review, not an AI gate.

### Open questions

- Spec OQ-1: GH-140 owns catalogue schema and cross-repository serialization.
  Decision needed: consult `@decision-advisor`. Decision-record placeholder:
  pending GH-140-owned record; retain locator-plus-local-ID semantics meanwhile.
- Spec OQ-2: capacity policy near KG-9999 is deferred. Decision needed: consult
  `@decision-advisor`. Decision-record placeholder: prospective ADR-0003 follow-up
  coordinated with GH-140; fail allocation at exhaustion rather than widen/reuse.
- Live provider authorization and actual model availability are execution
  preconditions, not established by CLI help. Parent PM must obtain any missing
  authorization; blocked runs remain blocked, never replaced by invented outputs.

## Scope

### In Scope

- F-1–F-4: common query semantics, class-specific authority, six retrieval outcomes,
  optional vendor-neutral configuration, restrictions, and safe capture policy.
- F-5–F-8/F-12: eleven gap types, three statuses, sanitized occurrences,
  same-remediation deduplication, bounded review, owning-source repair and verified
  closure, repo-local identities and derived index.
- F-9–F-11: bounded lifecycle/decision/review/inception/reconciliation handoffs,
  orientation, executable guides, navigation, inventory, generated tooling,
  installer/update safety and validators.
- F-13: ten real live-model scenarios, semantic review, defect remediation, and
  at least one durable gap resolved against repaired ADOS canonical truth.

### Out of Scope

- RAG/embeddings, vendor adapters/bots, external service deployment, telemetry,
  dashboards, mandatory review cadence, and organization-wide governance.
- Answer catalogues, raw conversation archives, tracker-state mirrors, automatic
  disputed-truth edits, bulk gap seeding, or conversion of narrow unknowns.
- GH-140 catalogue normalization/serialization, extra durable prefixes, unrelated
  tickets, profile edits, and business documentation.

### Constraints

- Missing `doc/documentation-profile.md` was confirmed: engineering-repo fallback
  applies. Knowledge records are engineering-safe; do not enable business docs.
- Prompt changes belong to `@toolsmith`, are current-state contracts, and contain
  no GH-41 evolution narrative. Keep model assignments in their proper config
  layer; retain the independent Claude frontmatter hint convention.
- Never hand-edit `.ados-claude/`. Regenerate after every canonical prompt batch;
  downstream commits include source and generated output together.
- New/changed distributable docs require the proper existing-frontmatter marker;
  YAML register templates put it on top-level line 1. No manually added headers.
- New delivery tools must be registered in `ADOS_DELIVERY_TOOLS`. Test fixtures
  and repository verification suites are not installed as project knowledge.
- Ordinary queries default to suggest; `write` policy still requires workflow
  authorization. Reports, questions, retries and source hits are not durable IDs.
- Planning writes only this file. Parent PM controls branches and commits through
  `@committer`; this author performs zero git operations and no PM-notes edits.

### Risks

- **RSK-1/4:** answer/backlog silos and noisy gaps — compact diagnoses, only
  Open/Resolved/Dismissed, retained-record search and independent occurrences.
- **RSK-2/3:** fabricated facts, injection and disclosure — claim-level provenance,
  outcome labels, fixture ACL denials, no raw/restricted material in durable evidence.
- **RSK-5:** age confused with drift — paired old-correct and executable-mismatch runs.
- **RSK-6:** delegation loops — one knowledge depth per owning-role handoff and
  explicit broker-return protocol with no self-call.
- **RSK-7:** identity conflict — Proposed ADR boundary, retained IDs, baseline
  comparison, collision tests and pre-merge rescan without renumbering durable IDs.
- **RSK-8/9/10:** broad delivery drift — coherent bounded phases, narrow regression
  tests, generated/install guards, all-doc reconciliation and orientation terminology.

### Success Metrics

- All 17 ACs evidenced, all ten Appendix A scenarios passing after fixes, and zero
  unresolved GH-41 severity-high defects before PR creation.
- 100% provenance for evaluated project facts; zero unsupported facts, default
  raw/restricted persistence, duplicate same-remediation gaps, or unverified closures.
- At most one follow-up before an initial result; all reviews finite-scope;
  maximum knowledge delegation depth one, no bounce/self-delegation.
- Zero changes to existing UNK/OQ/OPEN-Q identities or meanings; only KG is a new
  durable prefix; zero canonical/generated or distribution drift.

## Phases

### Phase 1: Gap contract, deterministic tooling and fixtures

**Goal**: Establish the smallest enforceable Git-native stewardship foundation.

**Tasks**:

- [ ] **1.1** Define the v1 YAML-frontmatter record and shared schema in
  `doc/templates/knowledge-gap-schema.json` with its usable
  `doc/templates/knowledge-gap-template.md`. Define source/capture configuration
  guidance/template in `doc/templates/knowledge-instructions-template.md`; target
  optional project policy is `.ai/agent/knowledge-instructions.md`, with optional
  non-obvious/external sources in `doc/knowledge/sources.yaml`. No exhaustive registry
  or empty gap tree is required. Establish the guide's normative field definitions.
- [ ] **1.2** Implement `tools/knowledge-gap`: `validate --root .`,
  `validate --root . --base-ref BASE_REF`, `next-id --root .`, and
  `index --root .` (index text to stdout). Root must be explicit or resolved to the
  current repository, paths must stay inside it, and no subcommand writes a gap or
  tracker item. Use a Bash CLI with safe Python YAML/JSON Schema parsing; document
  Python 3, PyYAML and jsonschema requirements, actionable missing-dependency errors,
  and arrange test/CI dependencies rather than fetching during invocation.
- [ ] **1.3** Implement one allocator over authoritative committed records in
  `doc/knowledge/gaps/` across all statuses. `next-id` uses max+1, starts KG-0001,
  never fills holes, and errors at KG-9999. Fail on duplicate/malformed records;
  inspect pending records for collisions and require commit/revalidation before
  allocating another record. Baseline validation detects deletion, reuse or
  reassignment of durable IDs; index content is never allocation authority.
- [ ] **1.4** Add `tools/.tests/test-knowledge-gap.sh` and sanitized fixtures under
  `scripts/.tests/fixtures/knowledge/`, including source snapshots, scenario inputs,
  expected structural checks, and instructions to assemble isolated cases. Tests
  use temporary Git repositories for allocation/baseline/concurrent-branch cases.
  Keep fixture IDs scoped to fixtures, not minted into the real gap registry.
- [ ] **1.5** Define the derived `doc/knowledge/00-index.md` view and explicit
  lifecycle validation: Resolved requires canonical reference, verification time,
  original-task verification notes and relevant resolution relationships;
  Dismissed retains diagnosis and disposition. Test missing and invalid fields,
  not merely happy-path examples. Establish authorized write/dedup/retry fixture
  expectations before prompt implementation.

**Acceptance Criteria**:

- Must: AC-F5-1, AC-F12-1 and structural portions of AC-F8-1/AC-F6-1/AC-F11-3
  are enforced; schema rejects tracker workflow statuses and malformed identities.
- Must: UNK/OQ/OPEN-Q remain separate; a title/slug change is not a new identity;
  concurrent provisional IDs are rechecked without renumbering published records.
- Should: Errors name the offending file and field and explain corrective action.

**Files and modules**:

- Code areas: `tools/knowledge-gap`, `tools/.tests/test-knowledge-gap.sh`,
  `scripts/.tests/fixtures/knowledge/` (new).
- System docs: `doc/templates/knowledge-gap-schema.json`,
  `doc/templates/knowledge-gap-template.md`,
  `doc/templates/knowledge-instructions-template.md`,
  `doc/guides/project-knowledge-management.md` (new normative contract sections).

**Tests**:

- `bash tools/.tests/test-knowledge-gap.sh`; syntax/ShellCheck for the Bash entry
  point and test; schema positive/negative cases in the validation matrix below.
- TC-KNOWLEDGE-002/005/006/008/012 structural parts. Semantic truth, privacy and
  same-remediation judgments remain pending Phase 4 live review.

**Completion signal**: Contract and narrow tests pass; tool reports invalid data
without modifying it, and semantic gaps are explicitly left for live evaluation.

### Phase 2: Shared facade and bounded role integration

**Goal**: Make the capability executable by humans and agents without changing role ownership.

**Tasks**:

- [ ] **2.1** Delegate to `@toolsmith` the new `.opencode/agent/knowledge.md`
  (`mode: all`, so direct CLI selection is supported), and thin
  `.opencode/command/knowledge-review.md` and
  `.opencode/command/contributor-orientation.md`. Direct query needs no extra command.
  Encode narrow-first search, class authority, concise cited results, all six
  outcomes, labeled inference, one-follow-up restraint, untrusted-evidence posture,
  access boundaries, safe defaults, and finite review scope.
- [ ] **2.2** Encode materiality, retained-record search, same-canonical-remediation
  deduplication, independent occurrence counting, retry exclusion, authorized
  persistence, validator use, canonical routing and failed-verification refusal.
  The agent must not maintain an answer store or use a derived index as allocator.
- [ ] **2.3** Have toolsmith tune PM, readiness-reviewer, reviewer,
  decision-advisor, bootstrapper and doc-syncer together. Specify each bounded
  input/output and ownership: PM factual lookup and tracked work; readiness only
  relevant material gaps; reviewer contradictions; decision-needed routing;
  bootstrapper optional minimal setup/selective graduation; doc-syncer related-gap
  checks and original-task closure verification. Audit coder/spec/test/plan consumers
  for material uncertainty; add only necessary bounded references, not universal calls.
- [ ] **2.4** Require caller-owned continuation and a depth/visited-role guard.
  Knowledge returns evidence and recommended owner rather than calling itself or
  bouncing through PM/decision/reconciliation. Orientation composes that same flow
  for purpose, architecture, vocabulary, setup, delivery, environments,
  observability, ownership, security/compliance and first-work context, labeling
  unavailable topics rather than inventing them.
- [ ] **2.5** Update `.opencode/README.md` and `AGENTS.md` inventory entries; inspect
  `.opencode/opencode.jsonc` for minimum required tool access, without introducing
  provider/model assignments into prompt bodies. Run `bash scripts/build-claude-plugin.sh`
  after the batch and review generated agent/skills before any downstream commit.

**Acceptance Criteria**:

- Must: AC-F1-1/AC-F3-1/AC-F4-1/AC-F4-2/AC-F9-1/AC-F10-1 contracts exist in
  canonical and generated tooling; direct invocation never silently selects a default agent.
- Must: No historical change narrative, recursive delegation, business-root
  enablement, automatic gap migration, or source-content execution is introduced.

**Files and modules**:

- Code areas: new knowledge agent and two command files; existing
  `.opencode/agent/{pm,readiness-reviewer,reviewer,decision-advisor,bootstrapper,doc-syncer}.md`;
  other material consumers only after the scoped audit; `.opencode/opencode.jsonc`
  if access needs adjustment; generated `.ados-claude/` counterparts.
- System docs: `.opencode/README.md`, `AGENTS.md`, knowledge guide/tool usage.

**Tests**:

- `bash scripts/.tests/test-build-claude-plugin.sh`; inventory/frontmatter/link
  review; TC-KNOWLEDGE-003/004/005/007/009/010 contract inspection.
- Exercise one role-specific uncertainty fixture for every integrated role in
  Phase 4; static mention of a guard is not evidence that recursion is prevented.

**Completion signal**: Toolsmith handoff returned, source/generated batch current,
and role ownership and live-run entry points ready for installed-sandbox evaluation.

### Phase 3: Distribution, documentation and spec synchronization

**Goal**: Ship a self-contained capability without overwriting adopting-project knowledge.

**Tasks**:

- [ ] **3.1** Register `tools/knowledge-gap` in `ADOS_DELIVERY_TOOLS`; install its
  schema with templates and document dependencies. Knowledge instructions/source
  registry/gaps remain project-owned: installation distributes templates, not this
  repository's policy or records. Do not add mandatory empty knowledge directories.
- [ ] **3.2** Extend `scripts/.tests/test-install.sh` with fresh install, no-config
  use, repeated update, and project-preservation cases. Seed customized instructions,
  source registry, Open/Resolved/Dismissed records and a derived index; assert bytes
  unchanged on update (including force where applicable to shared files), while
  changed shared tooling/templates refresh. Confirm real ADOS gap records are not
  installed into an adopting project.
- [ ] **3.3** Complete `doc/guides/project-knowledge-management.md` as executable
  human and agent guidance independent of the delivery brief: taxonomy, lifecycle,
  authority table, provenance/outcomes, review boundaries, source policy, privacy,
  deduplication, routing, identity/concurrency, verification and orientation.
  Add `doc/tools/knowledge-gap.md`; document safe minimal configuration and optional
  registry in the template/guide, without turning configuration into an answer source.
- [ ] **3.4** Synchronize all affected navigation/process surfaces:
  `README.md`, `doc/00-index.md`, `doc/documentation-handbook.md`,
  `doc/overview/glossary.md`, and guides `ados-processes.md`,
  `opencode-agents-and-commands-guide.md`, `change-lifecycle.md`,
  `definition-of-ready.md`, `decision-making.md`, `project-inception.md`,
  `onboarding-existing-project.md`, `claude-code-setup.md`, and
  `ados-tools-system-dependencies.md`. Keep Contributor Orientation distinct from
  Project Onboarding. Update existing relevant reconciliation/review guidance in
  its owning process, not a new competing workflow.
- [ ] **3.5** Ask `@doc-syncer` to add
  `doc/spec/features/feature-project-knowledge-management.md` and reconcile
  `feature-agents-and-commands.md`, `feature-delivery-lifecycle.md`,
  `feature-bootstrapper.md`, `feature-decision-making.md`,
  `feature-local-code-review.md`, `feature-document-templates.md`,
  `feature-onboarding-guide.md`, and `feature-quality-gates-and-pr.md` under
  `doc/spec/features/`. Inspect plugin-generation/distribution specs and update only
  if their contracts change; preserve static plugin version and profile safety.
- [ ] **3.6** Add `scripts/.tests/test-knowledge-contracts.sh` for machine-checkable
  inventory/schema/template/navigation consistency. Wire needed Python dependencies
  and deterministic validator execution into `.github/workflows/ci.yml`; test suites
  fail nonzero for invalid fixtures. Preserve existing paid-API exclusions; no live
  dogfood runs or credential requirements are added to default CI.

**Acceptance Criteria**:

- Must: AC-F11-1/AC-F11-2/AC-F11-3 hold structurally, all shipped files are
  discoverable and required markers/install sets agree; project-owned bytes survive.
- Must: AC-F8-1 canonical-source distinction and all bounded integration docs agree;
  no unrelated documentation-profile edits, generic identifier catalogue or FAQ silo.

**Files and modules**:

- Code areas: `scripts/install.sh`, `scripts/.tests/test-install.sh`,
  `scripts/.tests/test-knowledge-contracts.sh`, `.github/workflows/ci.yml`;
  existing distribution/build tests only for directly necessary assertions.
- System docs: every guide, index, handbook, glossary, tool guide and feature spec
  named in tasks 3.3–3.5; new template/schema distribution classification.

**Tests**:

- `bash scripts/.tests/test-install.sh`
- `bash scripts/.tests/test-knowledge-contracts.sh`
- `bash scripts/.tests/test-doc-distribution.sh`
- `bash scripts/.tests/test-doc-distribution-modes.sh`
- `bash scripts/.tests/test-inception-doc-consistency.sh`
- `bash scripts/.tests/test-build-claude-plugin.sh`
- TC-KNOWLEDGE-001/011/012; manual Markdown, changed-link, YAML/frontmatter and
  guide-without-brief review. Run existing uninstall tests if installer path ownership changes.

**Completion signal**: Installed sandbox has usable canonical/generated interfaces
and utility/schema, all preservation/structural checks pass, and full docs are ready for dogfood.

### Phase 4: Live ten-scenario dogfood and canonical verified closure

**Goal**: Demonstrate real behavior, fix discovered defects, and retain reviewable evidence.

**Tasks**:

- [ ] **4.1** Parent PM brokers runner preflight and snapshot setup using the
  execution protocol below. Verify actual model access, agent discovery, explicit
  permission policy, finite source scope and fresh session metadata. Record source
  snapshot hashes, CLI/model versions and generated parity. Do not supply expected
  answers, delivery brief, or reviewer scorecards as model context.
- [ ] **4.2** Run TC-KNOWLEDGE-013 in both canonical OpenCode and generated Claude.
  Execute all TC-KNOWLEDGE-013–022 on the canonical live facade, and generated
  review/orientation command smoke runs to check composition. Add live cases for
  all six outcomes, all capture modes, untrusted evidence and each integrated role
  where the ten scenarios do not completely cover TC-KNOWLEDGE-004/005/009.
- [ ] **4.3** Use separate fresh processes for independent observations in 016,
  sharing only the same authorized sandbox gap state. Include a same-interaction
  retry with an explicit ephemeral interaction marker; check occurrence count
  before/after (two independent occurrences, no third retry count). In 017 preserve
  different diagnoses despite similar wording. Mark ACL/external-source fixtures as
  simulated; deny access through tools rather than exposing a readable secret file.
- [ ] **4.4** For 018/021 retain actual bounded owner/PM/decision handoff and return
  evidence, including any broker hop. Accepted rationale fixture must not relabel
  ADR-0003 Accepted. Decision-needed routing can use its existing pending decision
  context; no new decision number or issue is required to demonstrate routing.
- [ ] **4.5** Select a genuine missing/discoverability deficiency addressed by
  GH-41, establish its pre-repair original task and evidence, deduplicate and allocate
  its actual KG identity, then have PM link work to GH-41. Keep this gap Open until
  repaired guide/navigation from Phase 3 passes a fresh original-task rerun. Retain
  the real record under `doc/knowledge/gaps/`, regenerate the derived index, and
  only then mark Resolved with canonical/change references and verification time/notes.
  Repair misleading alternatives/navigation as needed; a merged change alone is not proof.
- [ ] **4.6** A reviewer scores every live result and all NFRs, persists concise
  sanitized evidence in `chg-GH-41-dogfood.md` alongside this plan, and updates the
  execution log/AC evidence matrix. Route defects to coder/toolsmith, regenerate
  affected prompts, run narrow tests, and repeat affected live scenarios plus parity
  smoke tests. Stop and report blockers rather than fabricate missing evidence.

**Acceptance Criteria**:

- Must: AC-F13-1, TC-KNOWLEDGE-013–022 all pass with actual outputs, usable
  provenance, candidate/match evidence, routing, and original-task verification.
- Must: NFR-1–13 thresholds hold; at least one real canonical Resolved gap exists;
  no fixture result is misrepresented as a live vendor integration or production fact.
- Must: All six retrieval outcomes, capture authorization, ACL/injection boundaries
  and relevant-role non-recursion have evaluated behavioral evidence.

**Files and modules**:

- Code areas: scenario fixtures; only implicated source/test modules when dogfood
  finds defects, with prompt fixes delegated to toolsmith and regenerated output.
- System docs: `doc/knowledge/gaps/` actual deduplicated record,
  `doc/knowledge/00-index.md`, repaired canonical guide/navigation, and related
  feature spec corrections; `chg-GH-41-dogfood.md` as change-local evidence.

**Tests**:

- Live command protocol below; TC-KNOWLEDGE-003–010 supplemental cases and
  TC-KNOWLEDGE-013–022; `tools/knowledge-gap validate --root .` after actual closure.
- Rerun affected Phase 1–3 suites after each repair. Check persisted artifacts for
  raw transcripts/restricted content and source hashes for unauthorized mutation.

**Completion signal**: Ten scenario scorecards pass, canonical closure verifies,
all semantic/structural evidence is linked, and no GH-41 high defect remains open.

### Phase 5: Code Review (Analysis)

**Goal**: Independently audit the complete capability and evidence before release.

**Tasks**:

- [ ] **5.1** Ask `@reviewer` for read-only review of implementation against all
  17 ACs, the TC matrix, every phase and repo prompt/Bash/documentation contracts.
- [ ] **5.2** Audit actual live evidence, source provenance and outputs rather than
  self-reported PASS flags; inspect canonical closure, dedup/retry behavior,
  authorization, restricted-source handling, bounded handoffs and source/generated parity.
- [ ] **5.3** Review installation/update preservation, baseline identity checks,
  no new prefix spaces, human ADR decision rights and full docs/scope. Return
  actionable severity/path findings and PASS/FAIL to PM without implementing fixes.

**Acceptance Criteria**:

- Must: AC-F13-2 review evidence covers every AC and distinguishes unexecuted or
  blocked tests from passes; no high-risk defect is dismissed without resolution.

**Files and modules**:

- Code areas: none (read-only review of all changed modules).
- System docs: none; retain review references in change-local execution evidence.

**Tests**:

- TC-KNOWLEDGE-023 review portion and independent review of 001–022 evidence.

**Completion signal**: Review verdict and findings returned; PASS advances to release,
FAIL enters Phase 6 and requires re-review.

### Phase 6: Post-Code Review Fixes (conditional)

**Goal**: Resolve accepted findings without expanding the acceptance boundary.

**Tasks**:

- [ ] **6.1** If Phase 5 fails, coder fixes each accepted finding; toolsmith owns
  prompt corrections and doc-syncer owns corresponding current-truth reconciliation.
- [ ] **6.2** Add regression assertions where machine-checkable, regenerate plugin
  for every prompt change, and rerun impacted suites/live scenarios. Record failure
  and replacement evidence; do not erase earlier failed attempts.
- [ ] **6.3** Request independent re-review until PASS. If no findings require
  changes, record this phase N/A with the Phase 5 verdict, not a fictional fix commit.

**Acceptance Criteria**:

- Must: Every blocking finding is resolved and verified; no GH-41 high defect or
  unsupported AC pass remains (AC-F13-1/AC-F13-2).

**Files and modules**:

- Code areas: only modules named by accepted findings, associated regression tests,
  and generated counterparts when canonical prompts change.
- System docs: only implicated canonical guides/specs and evidence reconciliation.

**Tests**:

- Finding-specific regression checks, affected TC-KNOWLEDGE cases, generated and
  distribution guards; re-review of TC-KNOWLEDGE-023.

**Completion signal**: Independent PASS with rerun evidence, or explicitly N/A.

### Phase 7: Finalize and Release

**Goal**: Complete the minor capability release and provide evidence-ready human PR review.

**Tasks**:

- [ ] **7.1** Apply minor version impact using repository conventions: the changed
  installer currently declares APP_VERSION 2.0.0, so advance to 2.1.0 and update
  directly coupled tests/docs. New utility starts at 1.0.0. Do not invent a global
  package version/changelog; the generated plugin manifest stays at static 1.0.0
  per `feature-claude-plugin-generation.md`, not a per-change bump.
- [ ] **7.2** Perform final spec reconciliation through doc-syncer after all fixes;
  verify guide, schema, runtime, policy, index and actual resolved record agree.
  Confirm ADR-0003 remains Proposed and flag human acceptance for PR review; if
  rejected, reopen spec/test/plan and dependent implementation before merge.
- [ ] **7.3** Run all applicable narrow suites and CI-equivalent gates, including
  Bash/ShellCheck, generated freshness, distribution/install checks,
  `git diff --check`, changed-path/link/YAML/frontmatter review and baseline gap
  validation against PM's actual target ref. Re-scan allocation before merge;
  resolve provisional collisions only, never renumber already durable identities.
- [ ] **7.4** PM verifies readiness evidence (reopen the DoR gate if scope/contracts
  changed), review PASS, quality gates, all phase tasks and the 17-row AC-to-evidence
  matrix under TC-KNOWLEDGE-023. Require 10/10 live results and canonical verified
  closure; a blocked provider or missing reviewer verdict blocks completion.
- [ ] **7.5** Return release-ready summary, remaining human decision and artifact
  references to parent PM for normal committer/PR-manager handoff. Include source
  and generated changes together, preserve project-owned artifacts, and stop for
  human PR review. No unrelated issue creation or PM-notes edits by this writer.

**Acceptance Criteria**:

- Must: AC-F13-2 and all 17 ticket ACs have passing evidence; all required gates
  pass; version impact and final spec reconciliation are explicit.
- Must: ADR acceptance remains human-owned and generated manifest convention is
  not overridden by the change's minor version classification.

**Files and modules**:

- Code areas: `scripts/install.sh` version constant and coupled tests; final
  generated artifacts only via builder; no unrelated release files.
- System docs: reconciled affected `doc/spec/features/` and directly coupled
  guides; this plan execution log and change-local dogfood/AC evidence.

**Tests**:

- All Phase 1–3 commands, relevant CI-safe suites for changed modules,
  `tools/knowledge-gap validate --root . --base-ref BASE_REF` with the literal
  target ref supplied by PM, plus TC-KNOWLEDGE-023 completion audit.

**Completion signal**: Minor release ready for PR; 17/17 ACs, 10/10 scenarios,
review/quality/DoD pass, and ADR-0003 explicitly pending human PR acceptance.

## Test Scenarios

### Machine validation boundary

| Contract / cases | Validator and negative evidence | Semantic review still required |
|---|---|---|
| Gap fields, types, statuses, timestamps, occurrences, relationships; 002/012 | `knowledge-gap validate` parses safe YAML and schema; required identity/status/type/area/summary/owners/created/updated, sanitized representative context, diagnosis, evidence checked, impact, occurrence count/last-observed, relationships, desired resolution; positive all eleven types/all three statuses; reject missing fields, wrong types, malformed timestamps, invalid enums/counts | Materiality, sanitization quality, ownership correctness and no answer-store prose |
| Resolved lifecycle; 002/006/020 | Conditional schema requires nonempty canonical resolution reference, verification timestamp and original-task verification notes; reject closure missing any element | Actual repaired truth, original-task success, misleading alternatives, privacy/access restoration |
| IDs and registry; 008/012 | Exact KG-0001–KG-9999, case-sensitive; reject zero, short/long/lowercase/extra prefix, duplicate IDs/path-ID mismatch; all-status max+1, holes, exhaustion, renamed title, concurrent provisional collision and stale index tests | Published-ID stability and external publication history not visible in Git |
| Baseline durability; 008/012 | `validate --base-ref` rejects deleted/renumbered retained records and conflicting reuse against committed baseline; preserve UNK/OQ/OPEN-Q fixture bytes | Identity reassignment disguised as prose change; cross-repository locator adequacy; no silent semantic alias |
| Derived index; 012 | `index` produces stable sorted view across all statuses; compare generated output to persisted index; index mutation cannot change next ID | Index is not used as answer source |
| Policy/outcomes; 004/005 | Contract suite checks closed policy names, safe default, six outcomes, source-field/template parity and tool/schema availability | Live off/suggest/unauthorized-write no mutation; authorized writes; outcome selection, authority, ACL and injection |
| Inventory/generated; 003/011/012 | Contract suite requires canonical entries and generated knowledge agent/review/orientation skills; build test catches stale/missing output | Equivalent actual behavior and no fallback agent |
| Install/update/distribution; 011/012 | Extend install tests and existing distribution guards; inject missing schema/tool/inventory/marker and preservation failures; assert nonzero | Usable installed workflow and profile-safe documentation |

One schema is shared by templates, utility and tests. For a non-Markdown schema
under templates, ensure the installer copies it and the contract suite explicitly
checks its distribution; do not assume the Markdown marker scanner validates JSON.
Use a valid JSON metadata property for distribution if needed by its documented
packaging contract, never invalid YAML frontmatter in JSON. Unsupported semantic
checks are identified above, not reported as automated passes. New deterministic
test scripts must return failure to CI when any assertion fails.

### Fresh CLI and runner execution protocol

These are execution instructions, not a claim that live calls have already run.
CLI help was inspected on 2026-09-09: OpenCode supports `run --agent --dir --format
--command`; Claude supports `--plugin-dir --agent --print --output-format
--no-session-persistence`. Recheck versions/help at execution and record differences.

1. **PM-owned setup:** ask runner for explicit, authorized commands with `purpose`,
   `workdir`, `run_mode`, and expected exit/result. All scratch is under the source
   repository's `tmp/tmpdir/`; runner logs remain under its
   `tmp/run-logs-runner/YYYY-MM-DD/`. Set `TMPDIR` to a verified project-local scratch
   directory before suites that use `mktemp`; do not spill fixtures into system /tmp.
2. **Isolation:** coder prepares disposable, independent Git repositories under
   `tmp/tmpdir/gh-41-dogfood/` from the delivered source snapshot (including pending
   intended changes), excluding source `.git`, local histories, secrets and unrelated
   draft material. Initialize their own Git state for allocator tests, with no push
   remote. Install current tooling through the actual installer in a separate adopting
   sandbox; use that installed representation for distribution smoke evidence. Record
   snapshot/file hashes so dirty-source content cannot silently differ from tested code.
3. **Model context:** assemble only scenario sources/configuration, AGENTS/CLAUDE
   instructions and delivered tools. Keep expected outputs, change brief, scorecards
   and other scenario answers outside the query repository. Fresh process per case:
   no OpenCode `--attach`, `--continue`, `--session`, or Claude resume/continue. For
   within-interaction retry either use the same live interaction or an explicit
   ephemeral interaction marker with the retained gap state; do not count reruns as
   independent observations. Record the actual method in 016 evidence.
4. **Permissions and configuration:** isolate CLI session/cache/config state under
   project scratch; load only approved provider configuration and secret references
   through the operator's authorized mechanism (never copy credentials into evidence).
   Confirm effective model and tools. Do not use blanket permission bypass flags.
   Query/review runs have read/search scope only; authorized capture runs permit edits
   only to the sandbox gap/index paths. External fixtures have no real connectors;
   enforce simulated inaccessible paths through tool permissions, not a root-readable
   file chmod alone. Disable unneeded MCP/hooks and reject escapes/symlinks to the
   real working tree. A scratch directory alone is not a security sandbox: PM must
   approve the effective path/tool policy; if unavailable, stop before write tests.
5. **Concrete OpenCode calls:** runner sets workdir to the case repository and binds
   `CASE_ROOT` to its absolute path and `QUERY` to the selected fixture input. Use
   `opencode run --dir "$CASE_ROOT" --agent knowledge --format json "$QUERY"`.
   Direct smoke `QUERY` is exactly `How do I run repository tests?`. For composed
   interfaces use `opencode run --dir "$CASE_ROOT" --command knowledge-review --format json "$QUERY"`
   and `opencode run --dir "$CASE_ROOT" --command contributor-orientation --format json "$QUERY"`.
   These are fresh calls against delivered files; do not replace with inline copied prompts.
6. **Concrete Claude calls:** in the equivalent isolated repository bind
   `PLUGIN_ROOT` to the generated `.ados-claude` directory and run
   `claude --plugin-dir "$PLUGIN_ROOT" --agent ados:knowledge --print --output-format json --no-session-persistence "$QUERY"`.
   Exercise generated composition with
   `claude --plugin-dir "$PLUGIN_ROOT" --print --output-format json --no-session-persistence "/ados:knowledge-review $QUERY"`
   and the equivalent `/ados:contributor-orientation` input. Explicit scoped settings
   and approved tool allowlists from preflight accompany these commands. Confirm the
   plugin's registered agent/skill names in discovery/output; unknown agent, ignored
   command or default-assistant fallback is FAIL, not equivalent invocation evidence.
7. **Execution limits:** runner uses a finite foreground timeout or its documented
   background PID/log protocol. Capture exit code, duration, effective model/CLI
   version, source/config hashes and actual invoked identity. A timeout, authentication
   error, denied required permission or unavailable model is BLOCKED/FAIL. PM can broker
   a fresh authorized run, but no static fixture or manual role-play replaces it.
8. **Evidence:** runner's complete synthetic-run output stays local; reviewer selects
   concise sanitized input/output excerpts, checked sources, factual-claim citations,
   result/outcome, follow-up count, candidate/match/occurrence changes, routing/depth,
   canonical verification and verdict into `chg-GH-41-dogfood.md`. Retained evidence
   must be sufficient to judge actual behavior without full chat transcripts. Record
   timestamp, command with secrets removed, interface/model version and artifact hashes.
   Do not commit raw sessions, hidden reasoning, credentials, or restricted substance.
9. **Real closure:** the sandbox run authorizes no changes to the main repository.
   Coder performs the accepted GH-41 canonical repair and gap update through normal
   delivery ownership. Fresh before/after snapshot queries establish evidence; reviewer
   verifies the same repair is in actual canonical paths and the real record references
   those paths. Do not persist artificial fixture defects as real ADOS gaps.

### AC and TC execution mapping

All identifiers below use the test plan's TC-KNOWLEDGE prefix. Structural checks
and live semantic evaluation are complementary; all ten dogfood rows require live
outputs plus manual scorecards, regardless of shell-test success.

| TC ID | Scenario / layer and automation | Phases | AC coverage |
|---|---|---|---|
| TC-KNOWLEDGE-001 | Executable guide; manual documentation review | 3, 5 | AC-F11-1 |
| TC-KNOWLEDGE-002 | Schema/lifecycle; automated contract plus manual content | 1, 4 | AC-F8-1, AC-F5-1 |
| TC-KNOWLEDGE-003 | Inventory/direct cited answer; static plus both live tools | 2–4 | AC-F1-1 |
| TC-KNOWLEDGE-004 | All outcomes/authority; live fixtures and manual rubric | 2, 4 | AC-F3-1, AC-F7-1 |
| TC-KNOWLEDGE-005 | Policy/ACL/capture; automated boundary checks and live review | 1, 4 | AC-F4-1, AC-F4-2 |
| TC-KNOWLEDGE-006 | Dedup/retry/closure; structural and live integration | 1, 4 | AC-F6-1 |
| TC-KNOWLEDGE-007 | Trivial/work-heavy ownership; manual handoff review | 2, 4 | AC-F8-2 |
| TC-KNOWLEDGE-008 | IDs/compatibility; automated allocation and manual scope | 1, 7 | AC-F12-1 |
| TC-KNOWLEDGE-009 | Each relevant role handoff; live trace/manual depth review | 2, 4 | AC-F9-1 |
| TC-KNOWLEDGE-010 | Orientation common flow; live/manual composition | 2, 4 | AC-F10-1 |
| TC-KNOWLEDGE-011 | Install/update/generated/distribution; automated plus usability | 3, 7 | AC-F11-2 |
| TC-KNOWLEDGE-012 | Positive/negative machine validators; automated | 1, 3, 7 | AC-F11-3 |
| TC-KNOWLEDGE-013 | Dogfood 1: real test guidance, direct citations, no gap; both CLIs | 4 | AC-F1-1, AC-F3-1, AC-F13-1 |
| TC-KNOWLEDGE-014 | Dogfood 2: correct guide missing navigation, answer and discoverability candidate | 4 | AC-F6-1, AC-F7-1, AC-F13-1 |
| TC-KNOWLEDGE-015 | Dogfood 3: absent procedure, no invented steps, at most one follow-up, PM route | 4 | AC-F3-1, AC-F8-2, AC-F13-1 |
| TC-KNOWLEDGE-016 | Dogfood 4: two independent observations/one retry, one gap and two occurrences | 4 | AC-F6-1, AC-F13-1 |
| TC-KNOWLEDGE-017 | Dogfood 5: missing versus inaccessible, separate diagnoses, no restricted excerpt | 4 | AC-F3-1, AC-F4-2, AC-F6-1, AC-F13-1 |
| TC-KNOWLEDGE-018 | Dogfood 6: accepted rationale beats raw history, current conflict explicit and bounded route | 4 | AC-F7-1, AC-F9-1, AC-F13-1 |
| TC-KNOWLEDGE-019 | Dogfood 7: finite review, corroborated drift versus old-but-verifying guide | 4 | AC-F7-1, AC-F13-1 |
| TC-KNOWLEDGE-020 | Dogfood 8: PM tracked route and actual canonical repair, original query rerun; semi-automated/manual | 4, 5 | AC-F8-1, AC-F8-2, AC-F13-1 |
| TC-KNOWLEDGE-021 | Dogfood 9: real agent uncertainty, safe continuation and nonrecursive decision route | 4 | AC-F9-1, AC-F12-1, AC-F13-1 |
| TC-KNOWLEDGE-022 | Dogfood 10: orientation with configured-inaccessible local fixture; common flow | 4 | AC-F4-1, AC-F4-2, AC-F10-1, AC-F13-1 |
| TC-KNOWLEDGE-023 | Readiness/review/quality/DoD and complete evidence; manual gate audit | 5–7 | AC-F13-2 |

## Artifacts and Links

| Artifact | Location | Role |
|---|---|---|
| Change spec | [chg-GH-41-spec.md](./chg-GH-41-spec.md) | Requirements and ten Appendix A scenarios |
| Test plan | [chg-GH-41-test-plan.md](./chg-GH-41-test-plan.md) | Canonical TC/AC coverage and semantic rubric |
| Identity recommendation | [ADR-0003](../../../decisions/ADR-0003-repo-local-knowledge-gap-identifiers.md) | Proposed; human PR acceptance |
| Repository instructions | `AGENTS.md`, `.ai/rules/testing-strategy.md`, `.ai/rules/bash.md` | Authoring, distribution, testing and Bash contracts |
| Plan structure | `doc/templates/implementation-plan-template.md` | Structural guide |
| Human process and current truth | `doc/guides/project-knowledge-management.md`, `doc/spec/features/feature-project-knowledge-management.md` | New canonical capability guidance/spec |
| Templates and schema | `doc/templates/knowledge-gap-template.md`, `knowledge-gap-schema.json`, `knowledge-instructions-template.md` in the same template directory | Shipped reusable contracts |
| Optional project knowledge | `.ai/agent/knowledge-instructions.md`, `doc/knowledge/sources.yaml` | Project-owned configuration, only when needed |
| Durable stewardship | `doc/knowledge/gaps/`, `doc/knowledge/00-index.md` | Actual records and derived view, not answers |
| Canonical interfaces | `.opencode/agent/knowledge.md`, `.opencode/command/knowledge-review.md`, `.opencode/command/contributor-orientation.md` | New toolsmith-owned facade/compositions |
| Generated interfaces | `.ados-claude/agents/knowledge.md`, `.ados-claude/skills/knowledge-review/SKILL.md`, `.ados-claude/skills/contributor-orientation/SKILL.md` | Builder-only generated equivalents |
| Machine enforcement | `tools/knowledge-gap`, `tools/.tests/test-knowledge-gap.sh`, `scripts/.tests/test-knowledge-contracts.sh` | Structural/identity/inventory safeguards |
| Fixtures | `scripts/.tests/fixtures/knowledge/` | Sanitized reproducible behavioral/negative inputs |
| Dogfood evidence | `./chg-GH-41-dogfood.md` (created during execution) | Ten live scorecards, supplemental cases, AC matrix, canonical closure |
| Local runner artifacts | `tmp/run-logs-runner/`, `tmp/tmpdir/gh-41-dogfood/` | Ephemeral logs/snapshots; not committed |
| Related docs and integration modules | Phase 2 and Phase 3 enumerated paths | Full synchronization checklist |

Repository-root paths in this plan are not relative to the change folder unless
prefixed `./` in artifact links. No empty placeholder gap or preallocated real KG
number is created by the plan.

## Plan Revision Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-09-09T04:01:07Z | @plan-writer | Initial executable plan from completed spec/test plan; selected schema/ID validators, fresh CLI isolation and broker mechanics, complete docs/distribution scope, mandatory ten live cases and canonical verified closure. |

## Execution Log

Not executed during planning. CLI help inspection established command availability
only; it is not a behavioral test or a quality-gate pass. Parent PM/coder records
actual start/completion times, runner commands/results, specialist handoffs, evidence
links and downstream commits during delivery. Preserve failures and reruns.

| Phase | Status | Started | Completed | Commit | Notes |
|---|---|---|---|---|---|
| 1 | Not started | — | — | — | Gap contract, validators and fixtures |
| 2 | Not started | — | — | — | Toolsmith-owned prompts and role integration |
| 3 | Not started | — | — | — | Installer preservation and all-doc synchronization |
| 4 | Not started | — | — | — | Real live outputs required; no substituted evidence |
| 5 | Not started | — | — | — | Independent analysis |
| 6 | Conditional | — | — | — | N/A only after explicit review PASS without fixes |
| 7 | Not started | — | — | — | Final gates and human ADR acceptance handoff |
