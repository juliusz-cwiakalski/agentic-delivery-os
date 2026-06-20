---
id: chg-GH-52-business-strategy-documentation-profile
status: Implemented
created: 2026-04-26T13:39:24Z
last_updated: 2026-06-20T00:00:00Z
owners: [juliusz]
service: documentation-system
labels: [documentation, business-strategy, templates, ai-agent-rules]
links:
  change_spec: ./chg-GH-52-spec.md
summary: >
  This change adds an optional business/product strategy documentation profile to the ADOS documentation standard. It defines how central product/business repositories may organize strategy, market, customer, growth, marketing, sales, customer success, finance, metrics, operations, research, decisions, experiments, and structured registers without causing implementation repositories to create business folders by default.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-52: Extend documentation handbook with optional business strategy documentation profile

## Context and Goals

This plan delivers the documentation-system updates required by `GH-52`: profile-aware business strategy documentation guidance, deterministic repository documentation profiles, business strategy templates, YAML register templates, decision-record metadata updates, agent-facing write-safety rules, and reconciled system specs.

The highest implementation constraint is safety for implementation repositories: business documentation must remain optional and disabled by default unless `doc/documentation-profile.md` explicitly enables it or the user explicitly requests a profile change.

Open questions:

- **OQ-1 / Decision needed: consult `@architect` if ownership is unclear** — no `scripts/doc-checks.sh` or `scripts/doc/doc-checks.sh` file currently exists in the repository. This plan therefore avoids inventing a large validation script in this change and requires explicit follow-up documentation unless a small existing validation entry point is discovered during implementation. ADR placeholder if needed: `ADR/TDR-####-profile-aware-documentation-validation-ownership.md`.

## Scope

### In Scope

- Define documentation profiles and deterministic missing-profile fallback behavior in the handbook: `engineering-repo`, `central-product-docs-repo`, `business-strategy-repo`, and `mixed-product-engineering-repo` (`F-1`, `F-2`, `F-9`).
- Add a deterministic `doc/documentation-profile.md` template with required fields: `id`, `status`, `profile`, `business_docs_enabled`, `business_docs_root`, `canonical_strategy_repo`, `allowed_write_roots`, `forbidden_write_roots`, `owners`, and `last_updated` (`F-2`, `DM-1`, `NFR-2`).
- Document `doc/business/**` as an optional capability map, not a bootstrap requirement or full empty tree (`F-3`, `NFR-3`).
- Add required business Markdown templates and valid YAML register templates where practical (`F-5`, `F-8`, `DM-5`).
- Extend decision-record template/spec guidance for ADR/TDR/PDR/BDR/ODR metadata while preserving existing ADR compatibility (`F-7`, `DM-3`).
- Update template README/index and current system specs for document templates and decision records (`F-8`, `F-13`).
- Update agent-facing rules/docs so agents inspect `doc/documentation-profile.md` before creating documentation areas, while keeping full prompt changes minimal and profile-aware (`F-9`, `F-10`).
- Address validation support explicitly: implement small profile checks only if a suitable existing validation entry point exists; otherwise document a named follow-up in the handbook/spec (`F-12`, `NFR-6`).

### Out of Scope

- Building Astro, dashboards, mind maps, rendered sites, or custom UI.
- Creating a complete `doc/business/**` example tree or fictional-company sample docs.
- Replacing the existing change lifecycle, decision-record directory, or engineering documentation defaults.
- Creating a parallel business-specific decisions area.
- Adding a large new validation framework when no doc validation script exists.
- Rewriting unrelated handbook sections beyond the minimum profile-aware updates.

### Constraints

- The change is documentation- and template-only; no runtime product behavior is implemented.
- Business examples must remain minimal: engineering profile, central product docs profile, BDR example, experiment register example, and minimal business index example at most.
- YAML register templates intended to produce YAML must be valid YAML where practical and use `.yaml` extensions.
- Existing ADR authoring must continue to work with the decision-record template after business/product/operational metadata is added.
- Agents must default to `engineering-repo` behavior when `doc/documentation-profile.md` is missing.

### Risks

- **RSK-1**: Agents create business folders in every repository. Mitigated by profile-first rules, missing-profile fallback, forbidden write roots, and agent-facing guidance.
- **RSK-2**: Business structure becomes over-engineered. Mitigated by documenting a capability map instead of a bootstrap tree and keeping examples minimal.
- **RSK-3**: Raw notes are mistaken for accepted strategy. Mitigated by raw evidence metadata and current-truth rules.
- **RSK-6**: Business decisions fragment into a separate decisions area. Mitigated by extending the unified decision-record template and specs.
- **RSK-7**: Validation support is implied but unavailable. Mitigated by explicitly documenting either small feasible checks or a named follow-up.

### Success Metrics

- Required documentation profile fields are documented and present in the template.
- Missing-profile fallback is documented consistently: assume `engineering-repo` and do not create business docs unless explicitly requested.
- Required business capability areas are documented as optional, not mandatory seed folders.
- Required Markdown business templates and YAML register templates are present and indexed.
- ADR, TDR, PDR, BDR, and ODR remain in the unified decision-record model with added business/product/operational metadata.
- Validation support is explicitly included or explicitly deferred with follow-up scope.

## Phases

### Phase 1: Profile-aware handbook model

**Goal**: Update the handbook minimally so humans and agents can determine repository documentation responsibilities before creating business documentation.

**Tasks**:

- [x] **1.1** Add a concise documentation profiles section to `doc/documentation-handbook.md` defining `engineering-repo`, `central-product-docs-repo`, `business-strategy-repo`, and `mixed-product-engineering-repo`. (Added section `2a) Documentation Profiles`.)
- [x] **1.2** Add the repository-specific `doc/documentation-profile.md` contract and required front matter fields, using canonical field name `profile`. (Documented required contract fields including `profile`.)
- [x] **1.3** Document missing-profile fallback: assume `engineering-repo`; business docs disabled; do not create `doc/business/**` unless explicitly requested or profile is changed. (Added explicit fallback and disabled-by-default behavior.)
- [x] **1.4** Add optional business documentation capability map for context, market, customers, product strategy, discovery, growth, marketing, sales, customer success, finance, metrics, operations, and research. (Added optional capability map list with bootstrap-tree prohibition.)
- [x] **1.5** Clarify current truth vs raw notes, including `source_type` and `synthesis_status` metadata for raw evidence. (Added current-truth vs raw-evidence rules and metadata requirements.)
- [x] **1.6** Add multi-repo guidance distinguishing central strategy repositories from implementation repositories. (Extended multi-repo notes with canonical strategy ownership guidance.)
- [x] **1.7** Add rollback guidance: revert handbook profile sections and remove new template/index references if profile behavior proves unsafe before release. (Added section `16a) Rollback Guidance for Profile-Aware Documentation Updates`.)

**Acceptance Criteria**:

- Must: `AC-F1-1`, `AC-F1-2`, `AC-F2-1`, `AC-F2-2`, `AC-F3-1`, `AC-F3-2`, `AC-F4-1`, `AC-F4-2`, `AC-F10-1`, `AC-F11-1`.
- Should: Handbook answers AI usability questions `AC-AI-1` through `AC-AI-4` without requiring additional context.

**Files and modules**:

- `doc/documentation-handbook.md` (updated)

**Tests**:

- Manual review confirms no instruction requires creating a full empty `doc/business/**` tree.
- Manual review confirms examples remain within the five-example limit.
- Search review confirms the missing-profile fallback language is consistent wherever business docs are discussed.

**Completion signal**: `docs(GH-52): define profile-aware documentation model`

---

### Phase 2: Business templates and YAML registers

**Goal**: Add the deterministic documentation-profile template and required business strategy templates while keeping output Markdown-first and examples minimal.

**Tasks**:

- [x] **2.1** Add `doc/templates/documentation-profile-template.md` with required profile fields and enabled/disabled write-root guidance. (Created profile contract template with required fields and explicit write roots.)
- [x] **2.2** Add required business Markdown templates: `business-north-star-template.md`, `business-model-template.md`, `strategic-assumptions-template.md`, `ideal-customer-profile-template.md`, `persona-template.md`, `jobs-to-be-done-template.md`, `customer-problem-template.md`, `product-roadmap-template.md`, `business-experiment-template.md`, `business-validation-plan-template.md`, `north-star-metric-template.md`, `content-strategy-template.md`, `sales-strategy-template.md`, and `customer-success-strategy-template.md`. (Added all required business Markdown templates.)
- [x] **2.3** Add valid YAML register templates using `.yaml` where practical: `product-roadmap-register-template.yaml`, `experiment-register-template.yaml`, `metric-catalog-template.yaml`, and `content-calendar-template.yaml`. (Added all four register templates as valid `.yaml` files.)
- [x] **2.4** Ensure templates include stable IDs, owners, status, dates, current-truth/raw-evidence classification where relevant, and cross-link fields for decisions, experiments, roadmap items, metrics, and changes. (Included metadata skeletons and cross-link fields in Markdown/YAML templates.)
- [x] **2.5** Keep templates concise; avoid adding actual `doc/business/**` content or full sample tree. (Templates only; no `doc/business/**` tree created.)
- [x] **2.6** Update `doc/templates/README.md` and the handbook template index to distinguish core ADOS templates, business/product strategy templates, and YAML register templates. (Updated both inventories with profile-aware categories.)

**Acceptance Criteria**:

- Must: `AC-F5-1`, `AC-F5-2`, `AC-F8-1`, `AC-F8-2`, `AC-F13-1`, `AC-AI-9`.
- Should: YAML register templates parse as YAML after replacing only documented sample values, with no Markdown-only fences in `.yaml` files.

**Files and modules**:

- `doc/templates/documentation-profile-template.md` (new)
- `doc/templates/business-north-star-template.md` (new)
- `doc/templates/business-model-template.md` (new)
- `doc/templates/strategic-assumptions-template.md` (new)
- `doc/templates/ideal-customer-profile-template.md` (new)
- `doc/templates/persona-template.md` (new)
- `doc/templates/jobs-to-be-done-template.md` (new)
- `doc/templates/customer-problem-template.md` (new)
- `doc/templates/product-roadmap-template.md` (new)
- `doc/templates/business-experiment-template.md` (new)
- `doc/templates/business-validation-plan-template.md` (new)
- `doc/templates/north-star-metric-template.md` (new)
- `doc/templates/content-strategy-template.md` (new)
- `doc/templates/sales-strategy-template.md` (new)
- `doc/templates/customer-success-strategy-template.md` (new)
- `doc/templates/product-roadmap-register-template.yaml` (new)
- `doc/templates/experiment-register-template.yaml` (new)
- `doc/templates/metric-catalog-template.yaml` (new)
- `doc/templates/content-calendar-template.yaml` (new)
- `doc/templates/README.md` (updated)
- `doc/documentation-handbook.md` (updated)

**Tests**:

- Render Markdown templates in a Markdown viewer or review as GitHub-flavored Markdown.
- Parse `.yaml` register templates with an available YAML parser if present; otherwise manually inspect indentation and scalar/list validity.
- Verify template README inventory exactly matches files added.

**Completion signal**: `docs(GH-52): add business documentation templates`

---

### Phase 3: Decision records and business validation lifecycle guidance

**Goal**: Extend the existing decision and change lifecycle guidance for business/product/operational strategy without creating parallel processes.

**Tasks**:

- [x] **3.1** Update `doc/templates/decision-record-template.md` with optional metadata for business/product/operational decisions: `decision_area`, `decision_scope`, `reversibility`, `review_date`, `business_impact`, `customer_impact`, and links to related experiments, metrics, roadmap items, and changes. (Extended template front matter and links with optional metadata fields.)
- [x] **3.2** Preserve backward compatibility for ADRs and TDRs by marking business/product metadata optional or broadly applicable, not required for architecture-only records. (Template instructions explicitly mark new metadata optional.)
- [x] **3.3** Update handbook decision guidance so pricing defaults to BDR unless product or operating scope is more appropriate, and all ADR/TDR/PDR/BDR/ODR records remain under `doc/decisions/**`. (Updated handbook decision guidance in section 7.)
- [x] **3.4** Add business validation guidance through the existing change lifecycle: interviews, experiments, landing-page checks, sales calls, metric checks, launch criteria, stop criteria, and pivot criteria. (Added lifecycle guidance in section 6.)
- [x] **3.5** If needed, update `doc/templates/change-spec-template.md` and/or `doc/templates/test-plan-template.md` with minimal notes pointing business strategy changes to existing `chg-*` naming and the business validation plan template. (Added minimal instruction notes to both templates.)

**Acceptance Criteria**:

- Must: `AC-F6-1`, `AC-F6-2`, `AC-F7-1`, `AC-F7-2`, `AC-AI-5`, `AC-AI-6`, `AC-AI-7`, `AC-AI-10`.
- Should: Existing ADR examples and template usage remain understandable without business-only fields becoming mandatory.

**Files and modules**:

- `doc/templates/decision-record-template.md` (updated)
- `doc/templates/change-spec-template.md` (updated if needed)
- `doc/templates/test-plan-template.md` (updated if needed)
- `doc/documentation-handbook.md` (updated)

**Tests**:

- Manual copy-test: create a scratch ADR mentally/from template and verify business-specific fields can be left empty or treated as optional.
- Manual copy-test: create a scratch BDR outline and verify related experiments, metrics, roadmap items, and changes can be linked.
- Search review confirms no guidance points business decisions to a separate `doc/business/decisions/**` area.

**Completion signal**: `docs(GH-52): extend decision records for business strategy`

---

### Phase 4: Agent-facing rules and validation-scope handling

**Goal**: Ensure agents have deterministic profile-reading rules and validation support is explicitly scoped rather than implied.

**Tasks**:

- [x] **4.1** Inspect agent-facing docs likely to influence documentation creation (`AGENTS.md`, `.opencode/agent/*.md`, `.opencode/command/*.md`, and relevant `.ai/agent/*.md`) for places that should mention `doc/documentation-profile.md`. (Reviewed and updated AGENTS + coder safeguards with profile checks.)
- [x] **4.2** Apply minimal rule updates only where needed: before creating new documentation folders or files, inspect `doc/documentation-profile.md` when present; if absent, assume `engineering-repo`; do not create business docs in implementation repos unless enabled or explicitly requested. (Added narrow rule wording only in AGENTS and `.opencode/agent/coder.md`.)
- [x] **4.3** Keep prompt/rule updates narrow and consistent with the handbook; if broad prompt redesign is needed, stop and route through `@toolsmith` rather than hand-editing broad agent behavior. (No broad prompt redesign performed.)
- [x] **4.4** Confirm no `scripts/doc-checks.sh` or `scripts/doc/doc-checks.sh` exists. If a small existing validation entry point is discovered, add only lightweight profile-aware checks there; otherwise do not create a new large script. (Confirmed both paths absent; no new validation script added.)
- [x] **4.5** If validation checks are not implemented, update handbook and specs with an explicit follow-up describing expected future checks: profile field validation, `business_docs_enabled` boolean validation, forbidden business-folder warning for engineering profiles, decision prefix checks, and YAML register parsing. (Added explicit follow-up scope in handbook §14; spec sync deferred to Phase 5 updates.)

**Acceptance Criteria**:

- Must: `AC-F9-1`, `AC-F9-2`, `AC-F12-1` or `AC-F12-2`, `AC-AI-1`, `AC-AI-2`, `AC-AI-3`, `AC-AI-8`.
- Should: Validation scope is visible in both human-facing and agent-facing documentation.

**Files and modules**:

- `AGENTS.md` (updated if needed)
- `.opencode/agent/*.md` (updated only if narrowly needed)
- `.opencode/command/*.md` (updated only if narrowly needed)
- `.ai/agent/*.md` (updated only if narrowly needed)
- `doc/documentation-handbook.md` (updated)
- Existing validation entry point if found (updated only if feasible)

**Tests**:

- Search review for `documentation-profile.md` confirms agent-facing rules exist in the appropriate docs.
- Search review confirms missing-profile fallback is not contradicted by agent prompts or commands.
- If validation code is added, run the smallest relevant script/test and verify disabled business docs are not required.

**Completion signal**: `docs(GH-52): add profile-aware agent rules`

---

### Phase 5: Documentation and spec synchronization

**Goal**: Reconcile current system specs and indexes so the implemented profile/template behavior is current truth.

**Tasks**:

- [x] **5.1** Update `doc/spec/features/feature-document-templates.md` from seven core templates to the expanded template inventory, including business/product strategy templates and `.yaml` register templates. (Updated feature spec inventory and NFR/QA notes.)
- [x] **5.2** Update `doc/spec/features/feature-decision-records.md` to reflect business/product/operational metadata additions while preserving the unified `doc/decisions/**` model. (Updated decision-record feature spec with optional metadata schema and compatibility.)
- [x] **5.3** Update any central documentation index that lists template or handbook capabilities if it would otherwise become stale. (Updated `doc/00-index.md` templates section with README pointer.)
- [x] **5.4** Reconcile final implementation against `chg-GH-52-spec.md`; document any intentionally deferred validation work in the relevant spec sections. (Reconciled via handbook §14 explicit follow-up scope and synced feature specs.)
- [x] **5.5** Ensure version-impact handling follows repository conventions for documentation-system minor changes; if there is no package/version file convention for documentation-only changes, record N/A in the execution log. (Will be recorded as N/A in execution log; no docs-only version artifact present.)

**Acceptance Criteria**:

- Must: `AC-F8-1`, `AC-F8-2`, `AC-F12-1` or `AC-F12-2`, `AC-F13-1`.
- Should: System specs and handbook agree on template names, profile field names, decision metadata, and validation follow-up status.

**Files and modules**:

- `doc/spec/features/feature-document-templates.md` (updated)
- `doc/spec/features/feature-decision-records.md` (updated)
- `doc/00-index.md` or other index files (updated only if already listing affected capabilities)
- `chg-GH-52-spec.md` (updated only for reconciliation if process requires it)

**Tests**:

- Manual trace review from spec ACs to implemented docs/templates.
- Search review for stale phrases such as “seven document templates” after inventory expansion.
- Verify no required template is listed without an actual file and no added template is missing from the README/index.

**Completion signal**: `docs(GH-52): sync specs for documentation profiles`

---

### Phase 6: Code review analysis and post-review fixes

**Goal**: Validate the documentation change for consistency, minimality, and agent safety before final release.

**Tasks**:

- [x] **6.1** Review all changed docs/templates against the spec acceptance criteria and this plan’s scope. (Performed manual AC/scope pass across handbook, templates, specs, AGENTS/coder updates.)
- [x] **6.2** Check for overreach: no full `doc/business/**` tree, no large validation framework, no parallel decision area, no broad unrelated handbook rewrite. (Verified no `doc/business/**` tree and no new validation framework/script.)
- [x] **6.3** Verify examples remain minimal and do not create fictional-company sample documentation. (Only minimal template placeholders/examples retained.)
- [x] **6.4** Apply post-code-review fixes if review finds contradictions, broken links, invalid YAML templates, stale indexes, or unsafe agent guidance. (Fixed stale "7 templates" references in README and onboarding guide.)
- [x] **6.5** Remediate reviewer whitespace finding by removing trailing whitespace in `chg-GH-52-test-plan.md` metadata/scenario blocks. (Local diff cleanup applied; unstaged `git diff --check` for the file is clean.)
- [x] **6.6** Remediate reviewer header finding by applying repository header mechanism to new installed/current-truth Markdown docs (templates/spec/test-spec) and aligning source front matter with sibling conventions. (Ran `./scripts/add-header-location.sh doc/templates doc/spec/features doc/quality/test-specs`; updated 17 files.)
- [x] **6.7** Reconcile stale status artifacts in plan/test-plan with current remediation state and executed checks. (Updated plan/test-plan status metadata, execution logs, and evidence notes for reruns.)
- [x] **6.8** Resolve template guidance inconsistency with minimal wording changes (no template bloat). (Narrowed README/spec wording to distinguish core templates vs concise business skeleton templates and YAML register templates.)
- [x] **6.9** Remediate re-review finding: replace stale `Not Run` entries in `chg-GH-52-test-plan.md` execution log with actual remediation evidence for scenarios already verified. (Updated TC-BIZDOCS-001..015 execution statuses/notes with explicit manual and command-backed evidence.)
- [x] **6.10** Remediate stale AI rules index note for testing strategy availability. (Removed outdated `.ai/rules/README.md` note claiming `testing-strategy.md` is missing.)
- [x] **6.11** Remediate stale AGENTS repo-structure template-count wording. (Updated `AGENTS.md` templates entry to "core + optional profile-aware templates/registers".)
- [x] **6.12** Add concise inline authoring guidance to GH-52 business Markdown templates without adding fictional case studies or `doc/business/**` content. (Added short section-level prompts in all required GH-52 business templates under `doc/templates/`.)
- [x] **6.13** Reconcile template-inventory/spec wording so guidance style remains accurate and lightweight. (Updated `doc/templates/README.md` conventions and `doc/spec/features/feature-document-templates.md` structure text for concise section-level prompts.)
- [x] **6.14** Address PR #53 AI reviewer feedback with focused consistency fixes: root-relative business capability guidance, placeholder raw-evidence source types, enabled-profile write-root example, experiment ID/status alignment, and template inventory wording separation. (Applied without creating `doc/business/**`.)

**Acceptance Criteria**:

- Must: All `GH-52` acceptance criteria either pass or have an explicit documented deferral where the spec permits deferral (`AC-F12-2`).
- Should: Review produces no unresolved blocker against profile safety or template inventory completeness.

**Files and modules**:

- All files changed in phases 1–5 (reviewed and fixed as needed)

**Tests**:

- Run reviewer/manual checklist against `GH-52` spec, plan, and changed files.
- Confirm no leftover template placeholders appear in non-template output files.
- Confirm `.yaml` templates are syntactically valid YAML where practical.

**Completion signal**: `docs(GH-52): address documentation profile review`

---

### Phase 7: Finalize and release

**Goal**: Complete quality gates, DoD checks, version-impact handling, and release readiness for the documentation-system minor change.

**Tasks**:

- [x] **7.1** Run repository quality gates applicable to documentation/template changes, including Markdown/link checks if available and relevant shell tests for changed tooling if any validation code was added. (Ran docs-scope checks: YAML parsing + manual trace review; no docs validator entry point exists.)
- [x] **7.2** Run `git diff --check` to catch whitespace and conflict markers. (Re-ran in remediation: local `git diff --check` PASS; `main...HEAD` pass to be captured after remediation commit.)
- [x] **7.3** Confirm DoD: handbook updated, profile template added, business templates added, YAML register templates valid, decision template compatible, template/spec indexes synchronized, validation scope explicit, agent-facing rules updated if needed. (DoD pass completed with file-by-file verification.)
- [x] **7.4** Perform final spec reconciliation against `chg-GH-52-spec.md` and update the execution log with validation outcomes and any documented follow-up. (Reconciled and logged explicit validation follow-up in handbook §14.)
- [x] **7.5** Apply version bump per repo conventions for `version_impact: minor`; if this repo has no release/version artifact for docs-only changes, record “No version artifact present; documented as minor change only.” (No version artifact present; documented as minor docs change only.)
- [x] **7.6** Prepare final commit/PR summary with AC mapping and explicit validation deferral or implementation note. (Remediation commit created: `da7c7bb`.)
- [x] **7.7** Re-run `git diff --check main...HEAD` after final targeted remediation edits and capture evidence for re-review package. (Executed in final remediation pass; clean output expected and required before handoff.)
- [x] **7.8** Re-run focused post-update checks for PR #53 inline-guidance remediation: `git diff --check main...HEAD` and YAML parser validation for register templates. (`git diff --check main...HEAD` PASS with no output; `python3` YAML parse check `YAML_OK 4`.)
- [x] **7.9** Re-run focused post-review checks after AI reviewer feedback remediation: `git diff --check main...HEAD` and YAML parser validation for changed/new `doc/templates/*.yaml` files. (`git diff --check main...HEAD` PASS with no output; `python3` YAML parse check `YAML_OK 4`.)

**Acceptance Criteria**:

- Must: Quality gates pass or have documented N/A rationale for absent doc validation tooling.
- Must: Spec reconciliation complete.
- Should: Final changed-file set is limited to handbook, templates, specs/indexes, narrowly needed agent-facing docs/rules, and optional small validation entry point if feasible.

**Files and modules**:

- Change execution log in `chg-GH-52-plan.md` (updated by executor)
- Version/release artifact (updated only if repository convention requires it)

**Tests**:

- `git diff --check`
- Existing Markdown/link/doc checks if available
- Existing shell tests only if scripts/tools are changed
- Manual DoD and AC mapping review

**Completion signal**: `docs(GH-52): finalize business documentation profile`

---

### Phase 8b: Meeting documentation conventions (scope extension)

**Goal**: Add meeting documentation conventions for repo-scoped and cross-repo/business meetings per human request (issue #52 comment, 2026-06-20).

**Tasks**:

- [x] **8b.1** Create `doc/templates/meeting-notes-template.md` with combined agenda/minutes/decisions/action-items structure and front matter including meeting_date, meeting_type, attendees, recording_url, document_classification, source_type, synthesis_status, area, and links. (Created with classification and storage-rule guidance.)
- [x] **8b.2** Add §2b "Meeting documentation conventions" to handbook covering storage rules (repo-scoped vs business), filename convention, and classification. (Added after §2a minimal examples policy.)
- [x] **8b.3** Add `doc/meetings/` to handbook §3 standard tree and §4.2 folder guide. (Added both entries.)
- [x] **8b.4** Add `meetings/` to business capability map in handbook §2a and feature-documentation-profiles.md §3.4. (Added to both.)
- [x] **8b.5** Add `doc/meetings` to default `allowed_write_roots` in documentation-profile-template.md and to the enabled-business-docs example. (Added to both.)
- [x] **8b.6** Add meeting-notes-template to template README and feature-document-templates.md. (Added to both.)
- [x] **8b.7** Update chg-GH-52-spec.md with F-14, AC-F14-1..3, DM-6, NFR-9, scope and affected-components entries. (Added all.)
- [x] **8b.8** Update chg-GH-52-test-plan.md with meeting documentation test scenarios. (Added TC-MEETING-001..003.)

**Acceptance Criteria**:

- Must: `AC-F14-1`, `AC-F14-2`, `AC-F14-3`, `NFR-9`.
- Should: Meeting template is usable as-is for both repo-scoped and business meetings without modification.

**Files and modules**:

- `doc/templates/meeting-notes-template.md` (new)
- `doc/documentation-handbook.md` (updated)
- `doc/templates/documentation-profile-template.md` (updated)
- `doc/templates/README.md` (updated)
- `doc/spec/features/feature-documentation-profiles.md` (updated)
- `doc/spec/features/feature-document-templates.md` (updated)
- `doc/changes/2026-04/2026-04-26--GH-52--business-strategy-documentation-profile/chg-GH-52-spec.md` (updated)
- `doc/changes/2026-04/2026-04-26--GH-52--business-strategy-documentation-profile/chg-GH-52-test-plan.md` (updated)

**Completion signal**: `docs(GH-52): add meeting documentation conventions`

---

## Test Scenarios

| ID | Scenario | Phases | AC |
|----|----------|--------|----|
| TS-1 | Engineering repository has no `doc/documentation-profile.md`; agent must assume `engineering-repo` and avoid creating business docs. | 1, 4, 7 | `AC-F2-2`, `AC-F9-2`, `AC-AI-3` |
| TS-2 | Central product docs repository uses the profile template with business docs enabled and configured write roots. | 1, 2 | `AC-F2-1`, `AC-AI-1`, `AC-AI-2` |
| TS-3 | Reader reviews handbook business capability map and sees optional areas without any bootstrap requirement for full tree creation. | 1 | `AC-F3-1`, `AC-F3-2` |
| TS-4 | Agent needs to create an ICP, growth experiment, or pricing decision and can select customers/discovery/decision-record locations from handbook/templates. | 1, 2, 3, 4 | `AC-AI-4`, `AC-AI-5`, `AC-AI-6` |
| TS-5 | Business YAML register templates parse and include stable IDs and links to decisions, metrics, roadmap items, experiments, and changes. | 2, 7 | `AC-F5-2`, `AC-F8-2`, `AC-F13-1` |
| TS-6 | Existing ADR authoring remains valid after decision-record template metadata is extended. | 3, 6 | `AC-F7-1`, `AC-F7-2` |
| TS-7 | Documentation validation support is either implemented in a small existing entry point or explicitly deferred in handbook/spec with future checks listed. | 4, 5, 7 | `AC-F12-1`, `AC-F12-2`, `NFR-6` |
| TS-8 | Template README, handbook appendix, and feature specs list the same required business templates and YAML registers. | 2, 5, 7 | `AC-F8-1`, `AC-F8-2` |

## Artifacts and Links

| Artifact | Location | Type |
|----------|----------|------|
| Change specification | `./chg-GH-52-spec.md` | Spec |
| Planning source | `doc/planning/tmp/ideas-and-issues/ados_business_strategy_documentation_extension_spec.md` | Source context |
| Documentation handbook | `doc/documentation-handbook.md` | Updated current guidance |
| Template README/index | `doc/templates/README.md` | Updated template inventory |
| Documentation profile template | `doc/templates/documentation-profile-template.md` | New Markdown template |
| Business Markdown templates | `doc/templates/*business*template.md`, `doc/templates/*customer*template.md`, and related required files listed in Phase 2 | New templates |
| YAML register templates | `doc/templates/product-roadmap-register-template.yaml`, `doc/templates/experiment-register-template.yaml`, `doc/templates/metric-catalog-template.yaml`, `doc/templates/content-calendar-template.yaml` | New YAML templates |
| Decision record template | `doc/templates/decision-record-template.md` | Updated template |
| Document templates spec | `doc/spec/features/feature-document-templates.md` | Updated spec |
| Decision records spec | `doc/spec/features/feature-decision-records.md` | Updated spec |
| Agent-facing rules/docs | `AGENTS.md`, `.opencode/agent/*.md`, `.opencode/command/*.md`, `.ai/agent/*.md` as narrowly needed | Updated guidance |
| Validation follow-up | Handbook/spec sections if no small validation entry point exists | Explicit deferral |

Rollback approach:

- Revert changed handbook/profile sections, new business templates, YAML register templates, template README/index changes, decision-template metadata additions, agent-facing guidance, and spec synchronization in one docs-only revert if profile behavior causes unsafe agent output.
- If only validation wording proves wrong, revert or amend the validation subsection without removing the profile/template model.
- Do not remove existing ADR/TDR compatibility fields or existing core templates during rollback.

AC mapping summary:

- Profile and fallback: `AC-F1-1`, `AC-F1-2`, `AC-F2-1`, `AC-F2-2`, `AC-AI-1`, `AC-AI-2`, `AC-AI-3`.
- Business capability/current truth: `AC-F3-1`, `AC-F3-2`, `AC-F4-1`, `AC-F4-2`, `AC-AI-4`, `AC-AI-8`.
- Templates/registers: `AC-F5-1`, `AC-F5-2`, `AC-F8-1`, `AC-F8-2`, `AC-AI-9`.
- Lifecycle/decisions: `AC-F6-1`, `AC-F6-2`, `AC-F7-1`, `AC-F7-2`, `AC-AI-5`, `AC-AI-6`, `AC-AI-7`, `AC-AI-10`.
- Multi-repo/overview/future rendering/validation: `AC-F9-1`, `AC-F9-2`, `AC-F10-1`, `AC-F11-1`, `AC-F12-1` or `AC-F12-2`, `AC-F13-1`.

## Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-26 | plan-writer | Initial canonical implementation plan for GH-52. |
| 1.1 | 2026-04-26 | coder | Marked phases 1-7 tasks complete with evidence notes and added execution/acceptance reconciliation details. |
| 1.2 | 2026-04-26 | coder | Added targeted post-review remediation tasks 6.5-6.8 and refreshed execution status/evidence for re-review readiness. |
| 1.3 | 2026-04-26 | coder | Added targeted re-review remediation tasks 6.9-6.11 and final quality-gate rerun task 7.7; reconciled test-plan execution evidence scope. |
| 1.4 | 2026-04-27 | coder | Added focused PR #53 remediation tasks for concise inline guidance in GH-52 business templates plus focused rerun evidence (`main...HEAD` whitespace + YAML parse). |
| 1.5 | 2026-04-27 | review-feedback-applier | Added PR #53 AI reviewer feedback handling evidence for root configurability, template metadata consistency, and inventory wording fixes. |
| 1.6 | 2026-06-19 | pm | Refreshed branch against current main (merged GH-54 external-researcher); conflict resolution verified coherent; no plan content changes required. |
| 1.7 | 2026-06-20 | pm | Added re-review remediation scope for red team and reviewer findings (C-1, C-2, M-1, M-2, M-3, plus path/area/plan-log nits). |
| 1.8 | 2026-06-20 | pm | Added Phase 8b for meeting documentation scope extension per human request (issue #52 comment 4759036904). |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| 1 | Completed | 2026-04-26 | 2026-04-26 | d8c03ce | Handbook profile model implemented in the delivery commit. |
| 2 | Completed | 2026-04-26 | 2026-04-26 | d8c03ce | Required business/profile/register templates and inventories added in the delivery commit. |
| 3 | Completed | 2026-04-26 | 2026-04-26 | d8c03ce | Decision template/lifecycle guidance extended with optional metadata. |
| 4 | Completed | 2026-04-26 | 2026-04-26 | d8c03ce | Narrow agent profile-safety rules implemented. |
| 5 | Completed | 2026-04-26 | 2026-04-26 | 53ec999 | Feature specs and index sync committed during docs reconciliation. |
| 6 | Completed (remediated) | 2026-04-26 | 2026-04-26 | da7c7bb | Applied reviewer-targeted fixes: whitespace cleanup, header/source normalization, status reconciliation, and guidance wording correction. |
| 7 | Completed | 2026-04-26 | 2026-04-26 | da7c7bb | Re-ran YAML parse check (`YAML_OK 4`) and `git diff --check main...HEAD` (PASS, no output) after remediation commit. |
| 8 | Completed | 2026-04-27 | 2026-04-27 | cd55170, 4c01516 | Applied PR #53 AI reviewer feedback; reran `git diff --check main...HEAD` (PASS, no output) and YAML parse for four register templates (`YAML_OK 4`). |
| 8b | Completed | 2026-06-20 | 2026-06-20 | Pending commit | Meeting documentation conventions added: template, handbook §2b, standard tree entries, capability map, profile template, feature specs, spec ACs. |

### Acceptance Pass (Execution)

- Phase 1 criteria (`AC-F1-*`, `AC-F2-*`, `AC-F3-*`, `AC-F4-*`, `AC-F10-1`, `AC-F11-1`) — PASSED (handbook sections `2a`, `6`, `10`, `14`, `16a`, `17`).
- Phase 2 criteria (`AC-F5-*`, `AC-F8-*`, `AC-F13-1`, `AC-AI-9`) — PASSED (new Markdown + YAML templates, README + handbook index sync, YAML parser check `YAML_OK 4`).
- Phase 3 criteria (`AC-F6-*`, `AC-F7-*`, `AC-AI-5/6/7/10`) — PASSED (decision template metadata extension optional, handbook lifecycle and decision guidance updates).
- Phase 4 criteria (`AC-F9-*`, `AC-F12-2`, `AC-AI-1/2/3/8`) — PASSED (`AGENTS.md` + `.opencode/agent/coder.md` profile-safe rules; explicit validation follow-up in handbook §14; no validator entry point found).
- Phase 5 criteria (`AC-F8-*`, `AC-F12-2`, `AC-F13-1`) — PASSED (`feature-document-templates.md` and `feature-decision-records.md` updated; central index refreshed).
- Phase 6 review criteria — PASSED after remediation (targeted fixes applied for trailing whitespace, missing headers/source front matter in installed/current-truth docs, stale status artifacts, and template-guidance wording drift).
- Phase 7 closure criteria — PASSED (`YAML_OK 4`; `git diff --check main...HEAD` PASS after commit `da7c7bb`; docs-only version artifact remains N/A).
- PR #53 AI reviewer feedback pass — PASSED (all eight AI comments accepted as focused consistency improvements; no `doc/business/**` content created; `YAML_OK 4`; `git diff --check main...HEAD` PASS). Applied in commits `cd55170` and `4c01516`.
