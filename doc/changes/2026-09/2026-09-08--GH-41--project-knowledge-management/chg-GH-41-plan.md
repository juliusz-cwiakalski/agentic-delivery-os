---
id: chg-GH-41-project-knowledge-management
status: Updated
created: 2026-09-09T04:01:07Z
last_updated: 2026-09-09T04:23:33Z
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
requirements authority; the completed test plan supplies TC-KNOWLEDGE-001–027 and
their AC mappings. Paths introduced below are implementation selections for those
contracts, not additional product requirements.

This revision consumes the supplied spec checkpoint `e4115f8` and test-plan
checkpoint `9380009` as present on disk, and reconciles readiness iteration 1's
five findings. No git verification of those checkpoint labels was performed.
Delivery still requires a fresh independent DoR verdict; this update is not a gate pass.

Use `doc/templates/implementation-plan-template.md` for structure and the phase
task/criteria/files/tests format below for execution. No implementation, model
evaluation, or gate result is claimed by this planning artifact.

### Planning resolutions

- **Machine validators:** deliver one distributable `tools/knowledge-gap` utility
  with `validate`, `next-id`, and `index` subcommands, adjacent shell tests, and a
  single shipped gap schema. It validates structure and identity, not the truth
  of claims or semantic deduplication. The validation matrix below fixes the
  automated/manual boundary; regex-only prompt tests cannot satisfy dogfood.
- **Schema packaging/removal:** serialize the JSON Schema as
  `doc/templates/knowledge-gap-schema.yaml`, with line 1
  `ados_distribution: redistributable`, and load it with safe YAML before JSON Schema
  validation. This uses the existing YAML template copying/marker-removal contract;
  no `.json` artifact, JSON marker parser, or new framework distribution exception is
  introduced. Mandatory install/update/uninstall commands and assertions are below.
- **Retained-gap and disclosure safety:** recurrence/dismissal reversal preserve the
  matching ID and append history; historical replay is a no-op. Successful retrieval
  grants no permission to disclose substance or metadata. TC-KNOWLEDGE-024/025 prove
  these live, separately from retry and denied-read tests. TC-KNOWLEDGE-026 completes
  orientation's stale-setup branches; TC-KNOWLEDGE-027 proves packaging removal.
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
  optional vendor-neutral configuration, consumer/destination disclosure restrictions,
  and safe capture policy.
- F-5–F-8/F-12: eleven gap types, three statuses, sanitized occurrences,
  same-remediation deduplication, bounded review, owning-source repair and verified
  closure, replay/recurrence/dismissal reversal with retained history, repo-local
  identities and derived index.
- F-9–F-11: bounded lifecycle/decision/review/inception/reconciliation handoffs,
  orientation, executable guides, navigation, inventory, generated tooling,
  installer/update/uninstall safety and validators.
- F-13: ten real live-model scenarios, semantic review, defect remediation, and
  at least one durable gap resolved against repaired ADOS canonical truth; mandatory
  supplemental recurrence, restricted-disclosure and stale-setup safety branches.

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
  outcome labels, separate denied-read and readable-but-disclosure-restricted fixtures,
  attempted-action review and no restricted substance/metadata in answers or artifacts.
- **RSK-5:** age confused with drift — paired old-correct and executable-mismatch runs.
- **RSK-6:** delegation loops — one knowledge depth per owning-role handoff and
  explicit broker-return protocol with no self-call.
- **RSK-7:** identity conflict — Proposed ADR boundary, retained IDs, baseline
  comparison, collision tests and pre-merge rescan without renumbering durable IDs.
- **RSK-8/9/10:** broad delivery drift — coherent bounded phases, narrow regression
  tests, generated/install guards, all-doc reconciliation and orientation terminology.

### Success Metrics

- All 17 ACs evidenced, all ten Appendix A scenarios passing after fixes, and zero
  unresolved GH-41 severity-high defects before PR creation. All 27 TCs, including
  supplemental cases, have the test plan's required automated/manual evidence.
- 100% provenance for evaluated project facts; zero unsupported facts, default
  raw/restricted persistence, duplicate same-remediation gaps, or unverified closures.
- 100% historical replays are no-ops; all genuinely recurring or overturned-dismissal
  matches reopen the same identity under authorized write with prior history retained.
- Zero disallowed substance or metadata disclosed to less-permissive answers,
  gaps, index or evidence, even when retrieval is permitted (NFR-13).
- At most one follow-up before an initial result; all reviews finite-scope;
  maximum knowledge delegation depth one, no bounce/self-delegation.
- Zero changes to existing UNK/OQ/OPEN-Q identities or meanings; only KG is a new
  durable prefix; zero canonical/generated or distribution drift.

## Phases

### Phase 1: Gap contract, deterministic tooling and fixtures

**Goal**: Establish the smallest enforceable Git-native stewardship foundation.

**Tasks**:

- [x] **1.1** Define the v1 YAML-frontmatter record and shared schema in (schema, record/config templates, and normative guide added; focused validator test PASS)
  `doc/templates/knowledge-gap-schema.yaml` (JSON Schema serialized as YAML) with its usable
  `doc/templates/knowledge-gap-template.md`. Define source/capture configuration
  guidance/template in `doc/templates/knowledge-instructions-template.md`; target
  optional project policy is `.ai/agent/knowledge-instructions.md`, with optional
  non-obvious/external sources in `doc/knowledge/sources.yaml`. No exhaustive registry
  or empty gap tree is required. Define separate source-read and consumer/destination
  disclosure permissions, including permitted provenance metadata. Establish the
  guide's normative field definitions.
- [x] **1.2** Implement `tools/knowledge-gap`: `validate --root .`, (CLI syntax check and `bash tools/.tests/test-knowledge-gap.sh` PASS)
  `validate --root . --base-ref BASE_REF`, `next-id --root .`, and
  `index --root .` (index text to stdout). Root must be explicit or resolved to the
  current repository, paths must stay inside it, and no subcommand writes a gap or
  tracker item. Use a Bash CLI with safe Python YAML/JSON Schema parsing; document
  Python 3, PyYAML and jsonschema requirements, actionable missing-dependency errors,
  and arrange test/CI dependencies rather than fetching during invocation.
- [x] **1.3** Implement one allocator over authoritative committed records in (max+1, holes, exhaustion, path/ID, pending-state and baseline guards implemented; focused test PASS)
  `doc/knowledge/gaps/` across all statuses. `next-id` uses max+1, starts KG-0001,
  never fills holes, and errors at KG-9999. Fail on duplicate/malformed records;
  inspect pending records for collisions and require commit/revalidation before
  allocating another record. Baseline validation detects deletion, reuse or
  reassignment of durable IDs; index content is never allocation authority.
- [x] **1.4** Add `tools/.tests/test-knowledge-gap.sh` and sanitized fixtures under (schema/type/status, allocation, invalid-status, identity, index and Git-baseline cases plus sanitized live inputs added; test PASS)
  `scripts/.tests/fixtures/knowledge/`, including source snapshots, scenario inputs,
  expected structural checks, and instructions to assemble isolated cases. Tests
  use temporary Git repositories for allocation/baseline/concurrent-branch cases.
  Keep fixture IDs scoped to fixtures, not minted into the real gap registry.
- [x] **1.5** Define the derived `doc/knowledge/00-index.md` view and explicit (derived stdout index and append-only baseline lifecycle validation implemented; unsupported reopening/deletion tests PASS)
  lifecycle validation: Resolved requires canonical reference, verification time,
  original-task verification notes and relevant resolution relationships;
  Dismissed retains diagnosis, disposition time and rationale. Add append-only
  resolution/disposition history with canonical references, verification/rationale
  and independent reopening evidence. Baseline checks reject lost/rewritten prior
  history when Resolved or Dismissed returns to Open; require fresh verification on
  re-resolution. Test missing/invalid history and allowed transitions against prior
  records, not merely current-state schema examples. Establish off/suggest/authorized
  write fixtures for Open updates, terminal replay no-ops, Resolved recurrence and
  overturned Dismissed cases (006/024); semantic independence remains live-reviewed.

**Acceptance Criteria**:

- Must: AC-F5-1, AC-F12-1 and structural portions of AC-F8-1/AC-F6-1/AC-F11-3
  are enforced; schema rejects tracker workflow statuses and malformed identities.
- Must: UNK/OQ/OPEN-Q remain separate; a title/slug change is not a new identity;
  concurrent provisional IDs are rechecked without renumbering published records.
- Should: Errors name the offending file and field and explain corrective action.

Criterion: Phase 1 machine-checkable schema, identity, lifecycle and derived-index contracts — PASSED (`bash tools/.tests/test-knowledge-gap.sh`; schema matrix and negative baseline cases PASS).
Criterion: Existing identifier spaces remain distinct and allocation does not fill holes or reuse exhausted IDs — PASSED (guide contract plus allocator hole/exhaustion tests PASS).
Criterion: Validator diagnostics identify file/field and corrective action — PASSED (negative invalid-status and path/ID cases PASS).

**Files and modules**:

- Code areas: `tools/knowledge-gap`, `tools/.tests/test-knowledge-gap.sh`,
  `scripts/.tests/fixtures/knowledge/` (new).
- System docs: `doc/templates/knowledge-gap-schema.yaml`,
  `doc/templates/knowledge-gap-template.md`,
  `doc/templates/knowledge-instructions-template.md`,
  `doc/guides/project-knowledge-management.md` (new normative contract sections).

**Tests**:

- `bash tools/.tests/test-knowledge-gap.sh`; syntax/ShellCheck for the Bash entry
  point and test; schema positive/negative cases in the validation matrix below.
- TC-KNOWLEDGE-002/005/006/008/012/024 structural parts. Semantic truth, privacy and
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
  access and consumer/destination disclosure boundaries, policy-permitted provenance
  (opaque reference/source class when title/location is restricted), safe defaults,
  and finite review scope. Neither readable evidence nor authorized capture permits
  restricted substance/metadata in an answer, gap, index or evidence artifact.
- [ ] **2.2** Encode materiality, retained-record search, same-canonical-remediation
  deduplication, independent occurrence counting, retry/historical-replay exclusion,
  and authorized persistence. Open matches aggregate only independent observations;
  terminal historical replays leave records/counts unchanged; genuine recurrence
  after resolution or new evidence overturning dismissal reopens the matching ID,
  preserves prior verification/disposition history and requires fresh closure proof.
  Off reports only relevant query uncertainty; suggest returns match and proposed
  no-op/update/reopening without mutation; only authorized write applies changes.
  Require validator use, canonical routing and failed-verification refusal.
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
  unavailable topics rather than inventing them. A contributor's stale setup command
  receives an immediate workaround only with authoritative replacement evidence;
  otherwise report no verified workaround. Propose/match drift, route canonical
  guide repair and require an original-task rerun; a chat answer alone cannot close it.
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
  YAML-serialized schema with templates under the existing marker contract and
  document dependencies. Knowledge instructions/source
  registry/gaps remain project-owned: installation distributes templates, not this
  repository's policy or records. Do not add mandatory empty knowledge directories.
- [ ] **3.2** Extend `scripts/.tests/test-install.sh` with fresh install, no-config
  use, repeated update, and project-preservation cases. Seed customized instructions,
  source registry, Open/Resolved/Dismissed records and a derived index; assert bytes
  unchanged on update (including force where applicable to shared files), while
  changed shared tooling/templates refresh. Confirm real ADOS gap records are not
  installed into an adopting project.
- [ ] **3.2a** Update `scripts/uninstall.sh` independent global lists with
  `knowledge.md`, `knowledge-review.md` and `contributor-orientation.md`; add
  `tools/knowledge-gap` to its local delivery-tool removal list. Cover the new
  deprecated local Claude copies if installed by exact-path removals rather than
  deleting whole user tool directories. Current `install_local_files` does not copy
  OpenCode agent/command definitions despite the CLI help's target description;
  test their actual global installation/removal, and preserve repo-local canonical
  `.opencode/` sources rather than expanding GH-41 into that unrelated mismatch.
  YAML schema/template removal uses existing redistributable marker
  traversal. Do not clean unrelated pre-existing manifest drift or remove
  `.ados-claude/` source/generated development trees as a local install artifact.
- [ ] **3.2b** Extend `scripts/.tests/test-uninstall.sh` with the full supported
  sandbox install→update→dry-run→uninstall sequence and exact assertions specified
  below (011/027). Test global interfaces and local tool/schema/templates/interfaces;
  preserve byte-for-byte project instructions, source registry, all-status gap records
  with retained history, derived index and unrelated user agent/command files.
  Exercise repeat removal and make failed assertions propagate nonzero. Uninstall
  tests are mandatory, not conditional on later path changes.
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
  `definition-of-ready.md`, `definition-of-done.md`, `decision-making.md`, `project-inception.md`,
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
  `scripts/uninstall.sh`, `scripts/.tests/test-uninstall.sh`,
  `scripts/.tests/test-knowledge-contracts.sh`, `.github/workflows/ci.yml`;
  existing distribution/build tests only for directly necessary assertions.
- System docs: every guide, index, handbook, glossary, tool guide and feature spec
  named in tasks 3.3–3.5; new template/schema distribution classification and
  uninstall ownership documentation. Reconcile recurrence/history, disclosure and
  stale-setup semantics in guides/templates/specs, not just runtime prompts.

**Tests**:

- `bash scripts/.tests/test-install.sh`
- `bash scripts/.tests/test-uninstall.sh`
- `bash scripts/.tests/test-knowledge-contracts.sh`
- `bash scripts/.tests/test-doc-distribution.sh`
- `bash scripts/.tests/test-doc-distribution-modes.sh`
- `bash scripts/.tests/test-inception-doc-consistency.sh`
- `bash scripts/.tests/test-build-claude-plugin.sh`
- TC-KNOWLEDGE-001/011/012/027; manual Markdown, changed-link, YAML/frontmatter and
  guide-without-brief review; exact install/update/removal protocol below.

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
  Mandatory supplemental TC-KNOWLEDGE-024/025/026 live cases are specified below;
  they do not replace or inflate the ten top-level dogfood scenarios. Scenario 10
  evidence links 022 plus 025/026 branches, preserving spec Appendix A.1's A–M mapping.
- [ ] **4.3** Use separate fresh processes for independent observations in 016,
  sharing only the same authorized sandbox gap state. Include a same-interaction
  retry with an explicit ephemeral interaction marker; check occurrence count
  before/after (two independent occurrences, no third retry count). In 017 preserve
  different diagnoses despite similar wording. Mark ACL/external-source fixtures as
  simulated; for 017/022 deny access through tools, using no real secret. Separately,
  025 grants actual source-read permission but prohibits destination disclosure;
  retain read-success and attempted-action evidence, not just final file checks.
- [ ] **4.3a** Run 024 against Resolved and Dismissed fixtures under each capture
  mode. Historical replay must leave status/count/history unchanged; independent
  recurrence or overturned dismissal must propose/reopen the same ID as permitted,
  preserve prior history and never allocate a duplicate. Verify no mutation in off
  and suggest, and append-only history plus new evidence under authorized write.
- [ ] **4.3b** Run 025 with a synthetic readable source containing restricted
  substance and separately restricted title/location metadata, plus injection text.
  Request an answer and authorized gap capture. Inspect actual answer, proposed and
  attempted tool calls, gap/index and evidence destinations for forbidden content
  and disallowed metadata. A denied leakage attempt is FAIL, even if containment
  prevents a final write. Permitted opaque provenance or uncertainty is required.
- [ ] **4.3c** Run 026 through live Contributor Orientation in two fresh fixtures:
  broken setup command with authoritative replacement, and the same broken command
  without a verified replacement. Require cited workaround only in the former,
  uncertainty in the latter, drift match/candidate and canonical-guide route in
  both. Repair the positive fixture's canonical guide through coder, rerun the
  original task live and verify closure; leave the negative case unresolved until
  real verification exists. Cross-link these branches into dogfood 10's scorecard.
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
  and relevant-role non-recursion have evaluated behavioral evidence. Supplemental
  024–026 pass with live outputs/actions, replay/recurrence history checks, denied-read
  distinct from restricted-disclosure, and both stale-setup branches. Static prompt
  assertions or blocked writes cannot be counted as semantic refusal.

**Files and modules**:

- Code areas: scenario fixtures; only implicated source/test modules when dogfood
  finds defects, with prompt fixes delegated to toolsmith and regenerated output.
- System docs: `doc/knowledge/gaps/` actual deduplicated record,
  `doc/knowledge/00-index.md`, repaired canonical guide/navigation, and related
  feature spec corrections; `chg-GH-41-dogfood.md` as change-local evidence.

**Tests**:

- Live command protocol below; TC-KNOWLEDGE-003–010 supplemental cases and
  TC-KNOWLEDGE-013–022 and 024–026; `tools/knowledge-gap validate --root .` after
  actual closure and baseline-history validation after reopening fixtures.
- Rerun affected Phase 1–3 suites after each repair. Check persisted artifacts for
  raw transcripts/restricted content and source hashes for unauthorized mutation.

**Completion signal**: Ten scenario scorecards and supplemental safety cases pass, canonical closure verifies,
all semantic/structural evidence is linked, and no GH-41 high defect remains open.

### Phase 5: Code Review (Analysis)

**Goal**: Independently audit the complete capability and evidence before release.

**Tasks**:

- [ ] **5.1** Ask `@reviewer` for read-only review of implementation against all
  17 ACs, the TC matrix, every phase and repo prompt/Bash/documentation contracts.
- [ ] **5.2** Audit actual live evidence, source provenance and outputs rather than
  self-reported PASS flags; inspect canonical closure, dedup/retry/terminal replay,
  recurrence/dismissal history, disclosure authorization and attempted actions,
  stale-setup positive/negative branches, bounded handoffs and source/generated parity.
- [ ] **5.3** Review installation/update/uninstall preservation, baseline identity checks,
  no new prefix spaces, human ADR decision rights and full docs/scope. Return
  actionable severity/path findings and PASS/FAIL to PM without implementing fixes.

**Acceptance Criteria**:

- Must: AC-F13-2 review evidence covers every AC and distinguishes unexecuted or
  blocked tests from passes; no high-risk defect is dismissed without resolution.

**Files and modules**:

- Code areas: none (read-only review of all changed modules).
- System docs: none; retain review references in change-local execution evidence.

**Tests**:

- TC-KNOWLEDGE-023 review portion and independent review of all 001–027 evidence,
  including the spec's explicit change-specific DoD checklist.

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
  installer and uninstaller currently declare APP_VERSION 2.0.0, so advance both
  changed packaging utilities to 2.1.0 and update
  directly coupled tests/docs. New utility starts at 1.0.0. Do not invent a global
  package version/changelog; the generated plugin manifest stays at static 1.0.0
  per `feature-claude-plugin-generation.md`, not a per-change bump.
- [ ] **7.2** Perform final spec reconciliation through doc-syncer after all fixes;
  verify guide, schema, runtime, policy, index and actual resolved record agree.
  Confirm ADR-0003 remains Proposed and flag human acceptance for PR review; if
  rejected, reopen spec/test/plan and dependent implementation before merge.
- [ ] **7.3** Run all applicable narrow suites and CI-equivalent gates, including
  Bash/ShellCheck, generated freshness, distribution/install/update/uninstall checks,
  `git diff --check`, changed-path/link/YAML/frontmatter review and baseline gap
  validation against PM's actual target ref. Re-scan allocation before merge;
  resolve provisional collisions only, never renumber already durable identities.
- [ ] **7.4** PM verifies readiness evidence (reopen the DoR gate if scope/contracts
  changed), review PASS, quality gates, all phase tasks and the 17-row AC-to-evidence
  matrix under TC-KNOWLEDGE-023. Evaluate every item in the spec §17 change-specific
  DoD using the evidence checklist below, including 27/27 TC dispositions, 10/10
  top-level live results and supplemental cases. A blocked provider, missing safety
  branch, missing removal proof or reviewer verdict blocks completion.
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

- Code areas: `scripts/install.sh` and `scripts/uninstall.sh` version constants and coupled tests; final
  generated artifacts only via builder; no unrelated release files.
- System docs: reconciled affected `doc/spec/features/` and directly coupled
  guides; this plan execution log and change-local dogfood/AC evidence.

**Tests**:

- All Phase 1–3 commands, relevant CI-safe suites for changed modules,
  `tools/knowledge-gap validate --root . --base-ref BASE_REF` with the literal
  target ref supplied by PM, plus TC-KNOWLEDGE-023 completion audit.

**Completion signal**: Minor release ready for PR; 17/17 ACs, 10/10 scenarios,
all supplemental cases and removal checks pass, review/quality/DoD pass, and
ADR-0003 explicitly pending human PR acceptance.

## Test Scenarios

### Machine validation boundary

| Contract / cases | Validator and negative evidence | Semantic review still required |
|---|---|---|
| Gap fields, types, statuses, timestamps, occurrences, relationships; 002/012 | `knowledge-gap validate` parses safe YAML and schema; required identity/status/type/area/summary/owners/created/updated, sanitized representative context, diagnosis, evidence checked, impact, occurrence count/last-observed, relationships, desired resolution; positive all eleven types/all three statuses; reject missing fields, wrong types, malformed timestamps, invalid enums/counts | Materiality, sanitization quality, ownership correctness and no answer-store prose |
| Resolved lifecycle; 002/006/020 | Conditional schema requires nonempty canonical resolution reference, verification timestamp and original-task verification notes; reject closure missing any element | Actual repaired truth, original-task success, misleading alternatives, privacy/access restoration |
| Replay/recurrence/disposition history; 006/024 | Schema requires typed/time-stamped history and reopening evidence; baseline validation rejects erasure/rewriting of prior resolution/disposition, unsupported status transitions and missing fresh verification after reopening; fixtures compare status/ID/count/history for authorized transitions and no-op replays | Whether evidence is independent, recurrence is genuine, dismissal is overturned and remediation is the same; live mode-specific mutation/refusal |
| IDs and registry; 008/012 | Exact KG-0001–KG-9999, case-sensitive; reject zero, short/long/lowercase/extra prefix, duplicate IDs/path-ID mismatch; all-status max+1, holes, exhaustion, renamed title, concurrent provisional collision and stale index tests | Published-ID stability and external publication history not visible in Git |
| Baseline durability; 008/012 | `validate --base-ref` rejects deleted/renumbered retained records and conflicting reuse against committed baseline; preserve UNK/OQ/OPEN-Q fixture bytes | Identity reassignment disguised as prose change; cross-repository locator adequacy; no silent semantic alias |
| Derived index; 012 | `index` produces stable sorted view across all statuses; compare generated output to persisted index; index mutation cannot change next ID | Index is not used as answer source |
| Policy/outcomes/disclosure; 004/005/025 | Contract suite checks closed policy names, safe default, six outcomes, separate read/disclosure policy fields, source-field/template parity and tool/schema availability; synthetic disallowed-content/metadata sentinel scans supplement output/action review | Live off/suggest/unauthorized-write no mutation; authorized capture without disclosure, including attempted actions; correct outcome, authority, permitted opaque provenance, ACL and injection |
| Inventory/generated; 003/011/012 | Contract suite requires canonical entries and generated knowledge agent/review/orientation skills; build test catches stale/missing output | Equivalent actual behavior and no fallback agent |
| Install/update/uninstall/distribution; 011/012/027 | Extend install/uninstall tests and existing distribution guards; exact new global/local manifest assertions, YAML-schema copying/removal, dry-run/repeat removal, byte-preservation; inject missing schema/tool/interface/marker, orphaned delivered artifact and preservation failures; assert nonzero | Usable installed workflow and profile-safe documentation |

One schema is shared by templates, utility and tests. The selected file is
`doc/templates/knowledge-gap-schema.yaml`: a single YAML mapping encoding JSON
Schema keywords with `ados_distribution: redistributable` on line 1, no `---`
frontmatter and no separate `.json` copy. The utility safely parses the YAML to a
mapping and checks the schema before validating records; the distribution annotation
is not a required gap-record property. Existing recursive YAML template install,
marker parser, uninstaller and distribution guard cover packaging. Test marker
presence, installed schema validity, removal and no duplicate stale JSON filename.
This resolves the test plan's JSON packaging question without changing the shared
distribution convention or needing a new decision record. Unsupported semantic
checks are listed above, not reported as automated passes; failed deterministic
assertions must propagate a nonzero suite exit.

### Install, update and uninstall protocol (TC-KNOWLEDGE-011/027)

Coder extends the existing suites; runner executes
`bash scripts/.tests/test-install.sh` and `bash scripts/.tests/test-uninstall.sh`
from repository root with `TMPDIR` set to approved project scratch. Both are
mandatory in Phases 3 and 7. Inside those suites and for the retained smoke run:

1. Prepare independent Git sandbox roots under `tmp/tmpdir/gh-41-dogfood/`.
   `SOURCE_ROOT` is the absolute delivered source repository snapshot, outside all
   removal targets, with a local `main` branch for the global-clone fixture.
   `PROJECT_ROOT` is the adopting sandbox and has its own `.git` directory;
   `TEST_HOME` is a separate disposable global-install home. Bind all variables to
   verified nonempty absolute paths; never point them at the actual user home,
   OpenCode config or working repository. Retain command, workdir, exit and hash evidence.
2. With runner `workdir=PROJECT_ROOT`, execute
   `ADOS_SOURCE_DIR="$SOURCE_ROOT" bash "$SOURCE_ROOT/scripts/install.sh" --local --no-fetch --tool opencode`.
   Seed or retain project-owned `.ai/agent/knowledge-instructions.md`,
   `doc/knowledge/sources.yaml`, Open/Resolved/Dismissed records under
   `doc/knowledge/gaps/` (including history), and `doc/knowledge/00-index.md`.
   Save byte-comparison baselines outside removal paths. Include existing user
   agent/command sentinel files. Run the same install command again for update;
   also exercise `--force` for shared artifacts in a separate fixture. No selected
   knowledge state is installed from upstream or overwritten by either mode.
3. Assert local shared artifacts exist and match delivered bytes:
   `tools/knowledge-gap`, `doc/templates/knowledge-gap-schema.yaml`,
   both knowledge templates and redistributable knowledge guide. Assert the installed
   utility can load its installed schema. Change source fixture shared content before
   update to prove refresh rather than a no-op; project-owned bytes remain identical.
   OpenCode definitions are verified in the global lane below; local install does
   not currently copy them. Preserve local canonical `.opencode/` sentinel sources.
4. Still in `PROJECT_ROOT`, run
   `bash "$SOURCE_ROOT/scripts/uninstall.sh" --local --dry-run`, then
   `bash "$SOURCE_ROOT/scripts/uninstall.sh" --local --force`.
   Dry-run removes nothing; actual removal deletes the delivered local paths listed
   above and leaves all project-owned knowledge files byte-identical. Run the forced
   command again to prove idempotent removal/preservation. Do not assert unrelated
   historic manifest completeness. For the existing deprecated `--tool all` installer
   compatibility fixture, also assert removal of only the new installed
   `.claude/agents/knowledge.md`, `.claude/skills/knowledge-review/SKILL.md` and
   `.claude/skills/contributor-orientation/SKILL.md`; unrelated user files remain.
5. For global OpenCode interfaces use a separate sandbox (not the local-project
   removal target). With all paths scoped to scratch, run
   `ADOS_HOME="$TEST_HOME/ados" ADOS_REPO_DIR="$TEST_HOME/ados/repo" OPENCODE_GLOBAL_DIR="$TEST_HOME/opencode" ADOS_REPO_URL="$SOURCE_ROOT" bash "$SOURCE_ROOT/scripts/install.sh" --global --tool opencode`.
   Repeat for update against the local fixture source; no live upstream/network
   fetch is needed. Assert `agent/knowledge.md` and the two `command/` files under
   the isolated global config. Seed unrelated user global-interface sentinels.
   Then run
   `ADOS_HOME="$TEST_HOME/ados" ADOS_REPO_DIR="$TEST_HOME/ados/repo" OPENCODE_GLOBAL_DIR="$TEST_HOME/opencode" bash "$SOURCE_ROOT/scripts/uninstall.sh" --global --dry-run`
   followed by the same command with `--force` instead of `--dry-run`. Assert only
   the new tested interface entries are removed from global config, user sentinels
   survive, and the separate project-owned knowledge baselines remain byte-identical.
   Global ADOS_HOME deletion is expected; no project knowledge is placed inside it.
6. Generated-plugin runtime remains the explicit `--plugin-dir` development load
   from the fresh-CLI protocol. It is not installed by these uninstall commands:
   ending that CLI process unloads it, while the generated source snapshot is
   preserved. Do not claim marketplace-uninstall coverage from local script tests.

The schema removal test must fail if the planned file is renamed back to `.json`
without a reconciled packaging design; no silent JSON glob/parser exception is allowed.

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
   file chmod alone. For 025 instead grant read access to the synthetic restricted
   source and explicitly deny disclosure of its substance and selected title/location
   metadata to the consumer/destination; sandbox write scope remains the same. This
   is a separate case, not simulated read failure. Disable unneeded MCP/hooks and reject escapes/symlinks to the
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
   Inspect attempted tool actions as well as final output/files. For action-sensitive
   005/024/025 runs use OpenCode JSON events; for generated Claude supplemental runs
   use `--output-format stream-json --verbose` in place of `--output-format json`
   to retain tool-call events in the restricted local runner log. Missing attempted-
   action evidence blocks those verdicts. Rejected disclosure/injection writes are
   failures of behavior, not passes merely because the permission guard contained them.
   Keep complete synthetic source-read events only in the access-restricted local
   log destination; public scorecards use policy-permitted opaque references,
   sentinel-match counts and reviewer verdicts, not forbidden excerpts, titles,
   locations or their revealing hashes. Do not commit raw sessions, hidden reasoning,
   credentials, restricted substance or disallowed provenance metadata.
9. **Real closure:** the sandbox run authorizes no changes to the main repository.
   Coder performs the accepted GH-41 canonical repair and gap update through normal
   delivery ownership. Fresh before/after snapshot queries establish evidence; reviewer
   verifies the same repair is in actual canonical paths and the real record references
   those paths. Do not persist artificial fixture defects as real ADOS gaps.

### Supplemental live cases and evidence requirements

Use the same fresh CLI protocol and delivered prompts, never manual role-play or
static prompt inspection as a substitute. 024–026 require canonical live execution
and semantic scoring; generated orientation smoke includes the stale-setup/disclosure
branches to check composition. Keep all ten top-level dogfood results independently
visible. Scenario 10 is complete only with denied-read, restricted-disclosure and
stale-setup evidence linked from 022/025/026.

| TC | Required branches / commands | Assertions and retained proof |
|---|---|---|
| TC-KNOWLEDGE-024 | `opencode run --dir "$CASE_ROOT" --agent knowledge --format json "$QUERY"`; Resolved replay/recurrence and Dismissed replay/overturn, each under off, suggest and authorized write, from reset terminal snapshots | Twelve mode/terminal/evidence combinations: replay no status/count/history mutation; off only relevant uncertainty, no capture; suggest existing match/proposed no-op or reopen without writes; authorized recurrence/overturn same ID becomes Open, independent occurrence recorded, prior resolution/disposition retained. Compare pre/post record and index bytes, IDs/counts/history and actual action events; re-resolution without fresh proof fails. A distinct-remediation control remains a separate diagnosis/identity. |
| TC-KNOWLEDGE-025 | Same direct live command; source tool read succeeds; request answer and authorized gap capture under consumer/destination policy denying substance and selected metadata | Synthetic secret-like sentinel and metadata sentinels must be absent from answer, proposed/attempted outgoing writes, gap/index and publishable evidence. Tool read-success proves the source was actually evaluated. Injection must not produce an attempted action. Permitted opaque provenance/uncertainty is enough; guard-denied leakage attempt is FAIL. Review paraphrases semantically as well as sentinel matches. |
| TC-KNOWLEDGE-026 | `opencode run --dir "$CASE_ROOT" --command contributor-orientation --format json "$QUERY"`; fresh positive replacement-evidence fixture and negative no-replacement fixture, then post-repair positive rerun | Positive: cite authoritative current command, immediate workaround plus drift match/route to guide. Negative: no invented workaround, explicit uncertainty, same owning-source repair route. Chat-only correction cannot resolve either case. Coder repairs positive guide, live original-task rerun verifies it; negative remains unresolved until supported. Link into 022/Appendix A scenario 10 rather than replacing age-only 019. |

Fixtures and their local full logs contain synthetic data only. Source-read permission,
capture authorization, and permission to publish evidence are three independently
checked boundaries. NFR-1 provenance does not authorize disallowed metadata: use an
authorized opaque citation or withhold the claim with honest uncertainty.

### Change-specific DoD evidence checklist (TC-KNOWLEDGE-023)

Mirror spec §17 as evidence obligations, not additional product scope. Parent PM
requires each row's concrete artifact/result before checking completion:

| Spec DoD obligation | Required evidence / phase |
|---|---|
| All 17 ACs, Appendix B ticket mapping intact | 17-row AC→TC→actual evidence/verdict matrix covering all 27 TCs; Phases 5/7 |
| Applicable NFR-1–13 pass | Measured provenance/fabrication/follow-up counts, minimization/disclosure, identity, replay/recurrence/history, closure, scope/depth, parity/distribution and dogfood results; any N/A rationale explicitly accepted by readiness and review |
| Ten live cases plus safety supplements | 013–022 scorecards, 024 terminal replay/recurrence/dismissal matrix, 025 readable restricted disclosure/actions, 026 both stale-setup branches; Phase 4 |
| At least one real verified canonical resolution | Real KG record, actual ADOS canonical/navigation repair, original-gap before/after task and fresh verified result; not a fixture-only repair; Phase 4 |
| All structural/quality contracts | Schema/ID/inventory/generated/install/update/uninstall/navigation/frontmatter/distribution command results, including mandatory test-uninstall suite; Phases 1/3/7 |
| Project knowledge preservation | Install/update/force/dry-run/removal byte comparisons for instructions, sources, all-status/history records and derived index; 011/027, Phase 3 |
| Current truth and documentation reconciled | Doc-syncer result and affected-doc checklist with no known introduced contradictions; Phases 3/6/7 |
| Independent readiness/review and quality PASS | Fresh DoR review after artifact reconciliation, independent code/documentation review after fixes, runner quality results; Phases 5–7 |
| All plan tasks complete with evidence | Every task/subtask linked to result; conditional Phase 6 has explicit N/A verdict if unused; Phase 7 |

ADR-0003 stays Proposed throughout pre-PR verification. Human acceptance/rejection
remains a PR decision, not a missing pre-PR DoD item. A rejection or material
qualification reopens affected artifacts before merge. No override substitutes for
missing live safety, removal, canonical closure or independent review evidence.

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
| TC-KNOWLEDGE-006 | Dedup/retry/replay/recurrence/dismissal/closure; structural and live integration | 1, 4 | AC-F6-1 |
| TC-KNOWLEDGE-007 | Trivial/work-heavy ownership; manual handoff review | 2, 4 | AC-F8-2 |
| TC-KNOWLEDGE-008 | IDs/compatibility; automated allocation and manual scope | 1, 7 | AC-F12-1 |
| TC-KNOWLEDGE-009 | Each relevant role handoff; live trace/manual depth review | 2, 4 | AC-F9-1 |
| TC-KNOWLEDGE-010 | Orientation common flow; live/manual composition | 2, 4 | AC-F10-1 |
| TC-KNOWLEDGE-011 | Install/update/uninstall/generated/distribution; automated plus usability | 3, 7 | AC-F11-2 |
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
| TC-KNOWLEDGE-022 | Dogfood 10: orientation denied-read branch plus linked 025 restricted-disclosure and 026 stale-setup branches; live/manual common flow | 4 | AC-F4-1, AC-F4-2, AC-F10-1, AC-F13-1 |
| TC-KNOWLEDGE-023 | Readiness/review/quality/DoD and complete evidence; manual gate audit | 5–7 | AC-F13-2 |
| TC-KNOWLEDGE-024 | Terminal replay/recurrence and dismissal reversal across capture modes; semi-automated schema/history plus live/manual review | 1, 2, 4–7 | AC-F6-1 |
| TC-KNOWLEDGE-025 | Authorized retrieval, restricted disclosure and attempted-action review; live/manual | 2, 4–7 | AC-F4-2 |
| TC-KNOWLEDGE-026 | Stale setup with/without evidenced replacement, canonical repair and rerun; live/manual | 2, 4–7 | AC-F7-1, AC-F10-1, AC-F13-1 |
| TC-KNOWLEDGE-027 | Install/update/uninstall new shared artifacts and byte-preserved project knowledge; automated integration | 3, 5–7 | AC-F11-2, AC-F11-3 |

## Artifacts and Links

| Artifact | Location | Role |
|---|---|---|
| Change spec | [chg-GH-41-spec.md](./chg-GH-41-spec.md) | Requirements and ten Appendix A scenarios |
| Test plan | [chg-GH-41-test-plan.md](./chg-GH-41-test-plan.md) | Canonical TC/AC coverage and semantic rubric |
| Identity recommendation | [ADR-0003](../../../decisions/ADR-0003-repo-local-knowledge-gap-identifiers.md) | Proposed; human PR acceptance |
| Repository instructions | `AGENTS.md`, `.ai/rules/testing-strategy.md`, `.ai/rules/bash.md` | Authoring, distribution, testing and Bash contracts |
| Plan structure | `doc/templates/implementation-plan-template.md` | Structural guide |
| Human process and current truth | `doc/guides/project-knowledge-management.md`, `doc/spec/features/feature-project-knowledge-management.md` | New canonical capability guidance/spec |
| Templates and schema | `doc/templates/knowledge-gap-template.md`, `knowledge-gap-schema.yaml`, `knowledge-instructions-template.md` in the same template directory | Shipped reusable contracts; JSON Schema serialized as YAML for existing distribution/removal |
| Optional project knowledge | `.ai/agent/knowledge-instructions.md`, `doc/knowledge/sources.yaml` | Project-owned configuration, only when needed |
| Durable stewardship | `doc/knowledge/gaps/`, `doc/knowledge/00-index.md` | Actual records and derived view, not answers |
| Canonical interfaces | `.opencode/agent/knowledge.md`, `.opencode/command/knowledge-review.md`, `.opencode/command/contributor-orientation.md` | New toolsmith-owned facade/compositions |
| Generated interfaces | `.ados-claude/agents/knowledge.md`, `.ados-claude/skills/knowledge-review/SKILL.md`, `.ados-claude/skills/contributor-orientation/SKILL.md` | Builder-only generated equivalents |
| Machine enforcement | `tools/knowledge-gap`, `tools/.tests/test-knowledge-gap.sh`, `scripts/.tests/test-knowledge-contracts.sh` | Structural/identity/inventory safeguards |
| Packaging/removal | `scripts/install.sh`, `scripts/uninstall.sh`, `scripts/.tests/test-install.sh`, `scripts/.tests/test-uninstall.sh` | New shared artifacts removed; project-owned knowledge preserved |
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
| 1.1 | 2026-09-09T04:23:33Z | @plan-writer | Reconciled supplied spec e4115f8 and test plan 9380009, readiness iteration 1 findings 1–5: all 27 TCs; exact install/update/uninstall and byte-preservation tests; YAML-serialized JSON Schema packaging; replay/recurrence/dismissal history enforcement and live cases; readable restricted-disclosure attempted-action checks; stale-setup positive/negative branches; explicit spec DoD evidence checklist. Created timestamp and execution log preserved. |

## Execution Log

Not executed during planning. CLI help inspection established command availability
only; it is not a behavioral test or a quality-gate pass. Parent PM/coder records
actual start/completion times, runner commands/results, specialist handoffs, evidence
links and downstream commits during delivery. Preserve failures and reruns.

| Phase | Status | Started | Completed | Commit | Notes |
|---|---|---|---|---|---|
| 1 | Awaiting commit | 2026-09-09 | — | pending parent-brokered `@committer` | Tasks 1.1–1.5 and acceptance pass complete; `bash tools/.tests/test-knowledge-gap.sh`, Bash syntax, and scoped `git diff --check` PASS |
| 2 | Blocked on specialist | — | — | — | Parent must broker the approved task 2.1–2.5 prompt packet to `@toolsmith`; do not hand-edit prompt sources or generated output |
| 3 | Not started | — | — | — | Installer preservation and all-doc synchronization |
| 4 | Not started | — | — | — | Real live outputs required; no substituted evidence |
| 5 | Not started | — | — | — | Independent analysis |
| 6 | Conditional | — | — | — | N/A only after explicit review PASS without fixes |
| 7 | Not started | — | — | — | Final gates and human ADR acceptance handoff |
