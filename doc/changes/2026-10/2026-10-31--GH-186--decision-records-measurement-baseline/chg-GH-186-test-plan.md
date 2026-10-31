---
id: chg-GH-186-test-plan
status: Updated
created: 2026-10-31
last_updated: 2026-10-31
owners: ["Juliusz Ćwiąkalski"]
service: delivery-os decision and measurement substrate
labels: ["documentation", "decision-records", "measurement", "M0"]
version_impact: none
summary: "Verify the documentation-only M0-S17 change without runtime code: exactly four new Proposed decision records and a binding register whose eight topic rows resolve to existing records/anchors, a prospective v1 command-name lock with byte-identical command tables and zero renames, a schema-versioned measurement baseline whose four MET metrics are recomputed exactly from named committed sources after YAML-native date/datetime normalization and a closed exclusion vocabulary (MEASURED/PARTIAL/UNAVAILABLE honoured; unparseable/placeholder-only artifacts named and counted; ratio 0–1 canonical and percent derived; p90 nearest-rank; DM-2 change mapping), the two named index repairs, link integrity, doc-distribution and guarded-literal gates, and a docs-only diff with zero changes under packages/** and tools/** whose only scripts/** edit is the data-only `registered` addition in scripts/checks/forbidden-literals.registry.json (DEC-13), including same-commit forbidden-literal registration and seed-literal compliance for both new user-facing docs (C-10, AC-C10-1)."
links:
  change_spec: ./chg-GH-186-spec.md
  implementation_plan: ./chg-GH-186-plan.md
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - M0-S17: Decision records and measurement baseline

## 1. Scope and Objectives

This plan protects a **documentation-only** change: four new decision records (shipped `Proposed`), a foundational binding register, an annotation-only `v0 → v1` command-registry promotion, a committed measurement baseline log whose numbers must be reproducible from committed evidence, and a bounded index repair plus phase-7 doc sync. There is no runtime code, so the protective surface is **artifact integrity**, not behaviour: (a) the diff must never touch `packages/**` or `tools/**`, must not modify existing decision-record bodies, and must not rename anything; the one permitted non-doc edit is a data-only addition of the two new user-facing doc paths to `registered` in `scripts/checks/forbidden-literals.registry.json` (DEC-13), each staged in the commit that creates its doc; (b) every new artifact must be inspectable and traceable — each acceptance criterion resolves to a file, a front-matter field, a YAML key, a row, or a recomputed number; (c) the baseline's numbers must be **re-derived exactly** from the named committed sources **after the spec's corpus-ingestion normalization** (YAML-native `date`/`datetime` → ISO-8601, placeholder zero-time handling, one named `unparseable_yaml` file), because a plausible-looking but unreproducible number defeats the entire purpose of the baseline; and (d) the repository's real doc and literal gates must stay green, including the forbidden-literal registration and seed-literal checks for both new docs (C-10, NFR-10).

The plan is therefore a checklist of reproducible verification procedures (file existence, front-matter/status assertions, YAML parse and schema-key assertions, grep/absence checks, diff-scope checks, link resolution, number recomputation) plus the repository's actual gate commands. It is a design and verification map, not an execution claim: this writer ran none of the delivery commands and records no PASS results below. Where the spec pins an exact string or count it is asserted verbatim; where the delivery must compute a number, the check is **recompute-and-compare**, never a hardcoded invented value.

### 1.1 In Scope

- New decision records: `doc/decisions/ADR-0008-harness-adapter-contract.md`, `ADR-0009-release-model-v1.md`, `ODR-0002-id-prefix-scheme-and-project-catalog.md`, `ODR-0003-cli-command-naming-v1-lock.md` (F-2, AC-F2-1, AC-F2-2, AC-NFR2-1, AC-PROC-1).
- New binding register `doc/decisions/00-register.md`: eight topic rows, exact existing bindings, anchors that exist, no duplicated decision text, update rule, marker (F-1, DM-1, AC-F1-1, NFR-8).
- Index integrity: four new linked rows, the two named pre-existing repairs, register links from index and README, link resolution (F-5, AC-F5-1, AC-F5-2, AC-F5-3, NFR-3, NFR-9).
- Command-name lock: title/heading `v1`, lock banner naming ODR-0003 and the lock date, replaced introduction and `provider` audit bullet, **byte-identical** command tables, zero renames (F-3, DM-3, AC-F3-1, AC-F3-2, NFR-5, C-4).
- Measurement baseline `doc/planning/oss-tooling/measurement-baseline.yaml`: schema validity, source traceability, window/exclusions, corpus ingestion (parse → normalize → classify with the closed exclusion vocabulary), exact recomputation of ceremony share, cycle time, CI failure rate and false-signal counts, canonical 0–1 ratio values with derived percent, nearest-rank p90, DM-2 `change` mapping, status semantics, comparison protocol (F-4, DM-2, DEC-14, AC-F4-1…AC-F4-5, NFR-1, NFR-4, NFR-7, C-5, C-7).
- Phase-7 current-truth sync across the nine named documents, including the new `feature-measurement-baseline.md` (F-6, AC-F6-1).
- Diff scope and gates: docs-only diff plus exactly one data-only `registered` addition in `scripts/checks/forbidden-literals.registry.json` (DEC-13), diff hygiene, doc-distribution guard (+ negative modes), commitlint, guarded-literal gates, inception doc-set consistency (C-1, C-9, C-10, AC-C1-1, AC-C10-1, AC-C2-1, AC-NFR6-1, NFR-10).

### 1.2 Out of Scope & Known Gaps

- **No unit, integration, contract, E2E or performance tests.** There is no runtime code, package, or tool change, and the only `scripts/**` change is a data-only registry registration with no check-logic change (C-1 / NG-1); the TypeScript workspace suites and `pnpm check` are not required by this change.
- **No new automated guard is created.** This is docs-only plus a data-only registry registration; every command below is an existing repository gate or an ad-hoc, read-only check on the working tree. Creating or changing a committed checker would violate C-1/DEC-13.
- **No automated Markdown link/anchor checker exists in this repository.** `doc/spec/features/feature-documentation-profiles.md` records that no `doc-checks.sh` validator exists, and a search of `scripts/checks/**` and `scripts/.tests/**` finds none. Link integrity (NFR-3) is therefore a semi-automated procedure (TC-SYNC-004) plus reviewer confirmation, per `.ai/rules/testing-strategy.md` content checks.
- **No committed per-run CI log exists for the bash era.** The CI metric is a session proxy by definition (spec §5.1 F-4); this plan verifies the proxy's declared kind, numerator/denominator and limitation, and never asserts a per-run failure rate.
- **The measurement numbers are not known at plan time.** They are computed during delivery. All numeric assertions are recompute-and-compare against the log's own `changes:` spine and the cited sources.
- **The corpus is not homogeneous.** Some pm-notes files carry YAML-native `datetime`/`date` scalars, and one historical file (`chg-GH-171-pm-notes.yaml`) fails document-level YAML parsing. The recompute procedures therefore apply the spec's DEC-14 normalization and treat the unparseable file as a named `unparseable_yaml` row; they never load it into a phase loop and never silently drop it.
- **Acceptance of the four records is not tested here.** No scenario may assert `Accepted`; the owner's PR-review decision is the gate (NG-3, C-3, AC-PROC-1).
- **Forbidden-literal registration is permitted data, not a blocker.** `scripts/checks/forbidden-literals.ts` treats every `doc/**` file except paths under `doc/changes/` and `doc/decisions/` as user-facing; a user-facing doc absent at `corpusBaseline` must be listed in `registered` in `scripts/checks/forbidden-literals.registry.json`, and registered docs are scanned for the three seed literals. DEC-13 permits exactly that data-only registration for both new docs, each staged in the commit that creates its doc; TC-GATE-005 verifies the registry diff is data-only, the same-commit staging, and that the two docs are registered and seed-literal clean.
- **Unrelated pre-existing defects are not repaired or tested** (e.g. the glossary's duplicated front-matter keys, the `PDR-0002` filename/slug drift). They are explicitly out of scope (NG-7, spec §7.3).

## 2. References

- Change specification: [chg-GH-186-spec.md](./chg-GH-186-spec.md) v1.2 — ACs in §17 (21 criteria, including AC-C10-1), hard constraints §9.1 (C-1…C-10), NFRs §9.2 (NFR-1…NFR-10), DM contracts §8.3, decision log §15 (DEC-1…DEC-14, including the normative corpus-ingestion rule DEC-14), Appendix A census §24.1, artifact inventory §24.2.
- PM notes (clarify decisions, delivery mode): [chg-GH-186-pm-notes.yaml](./chg-GH-186-pm-notes.yaml).
- Repository testing strategy: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md) — docs → static/diff + content checks; `git diff --check`; evidence recorded in change artifacts.
- Implementation plan: [chg-GH-186-plan.md](./chg-GH-186-plan.md) — the plan's PD-3/PD-4 corpus pins and Phase-6 measurement procedure are the delivery counterpart of this plan's recompute checks; this plan remains spec-derived and TC numbering is independent of the plan's phase numbering.
- Corpus-exclusion precedent: [tests/fixtures/pm-notes/corpus-exclusions.json](../../../../tests/fixtures/pm-notes/corpus-exclusions.json) — the manifest naming the single known-unparseable historical pm-notes artifact (GH-171); the baseline mirrors it with `unparseable_yaml` and does not edit it.
- Guard entry points actually present in the repository:
  - `bash scripts/.tests/test-doc-distribution.sh` and `bash scripts/.tests/test-doc-distribution-modes.sh` (CI job `doc-distribution-guard`, [.github/workflows/ci.yml](../../../../.github/workflows/ci.yml)).
  - `bash scripts/.tests/test-inception-doc-consistency.sh` (CI job `inception-doc-consistency`).
  - `bun run scripts/checks/forbidden-literals.ts` (CI job `ts-forbidden-literals`) with registry `scripts/checks/forbidden-literals.registry.json`; DEC-13 permits adding the two new user-facing doc paths to `registered` (data only).
  - `bun run scripts/checks/privacy-literals.ts` with registry `scripts/checks/privacy-literals.registry.json`.
  - `bun run scripts/checks/commitlint-authority.ts` and `pnpm exec commitlint` (CI job `ts-commitlint`); root config `commitlint.config.js`; local `.husky/commit-msg` is warn-only.
- Edit targets and grounding sources: `doc/decisions/00-index.md`, `doc/decisions/README.md`, `doc/planning/oss-tooling/cli-command-registry.md`, `doc/planning/oss-tooling/README.md`, `doc/planning/concepts/id-prefix-catalog.md`, `doc/planning/concepts/agent-primitive-surface.md`, `doc/spec/features/feature-decision-records.md`, `doc/spec/features/feature-adapter-ports.md`, `doc/overview/glossary.md`, `doc/00-index.md`, `scripts/checks/forbidden-literals.registry.json` (data-only `registered` addition, DEC-13), `doc/templates/decision-record-template.md`, `doc/templates/feature-spec-template.md`, `doc/guides/decision-records-management.md`.
- Records bound by the register and used for anchor checks: `ADR-0003` (DEC-1…DEC-7), `ADR-0005`, `ADR-0007` (DC-1…DC-5), `TDR-0003` (`## Decision`), `TDR-0004` (`## Decision`), `PDR-0002` (H1 heading), `ODR-0001`.
- Committed baseline evidence corpus: `doc/changes/**/chg-*-pm-notes.yaml`, `doc/changes/**/chg-*-evidence.md`, git history (the only measurement sources per spec §5.1/§24.3).

## 3. Coverage Overview

All 21 acceptance criteria map to at least one scenario, and every scenario maps back to at least one AC/NFR. There are no TODO/uncovered ACs and no orphan TCs.

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Description | TC ID(s) | Verification mode | Status |
|-------|-------------|----------|-------------------|--------|
| AC-F1-1 | Register has all 8 topics; each row names ≥1 existing binding record + anchor; the five existing bindings are exactly the pinned set | TC-DEC-008, TC-DEC-009 | Assertion (grep/awk) + anchor existence + manual review | Covered |
| AC-F1-2 | No existing record body modified; no new record re-decides layout/config/state/provider contract; ADR-0009 refines, not re-decides, the release direction | TC-DEC-009, TC-DEC-010 | `git diff` + content review | Covered |
| AC-F2-1 | Exactly the four named record files exist; each `Proposed`, `decision_date: null`, `links.related_changes` contains `GH-186`, owner-acceptance statement present; none `Accepted` | TC-DEC-001, TC-DEC-002 | File set + YAML front matter | Covered |
| AC-F2-2 | Each Decision section states the required elements from spec §5.1 (per record) | TC-DEC-004, TC-DEC-005, TC-DEC-006, TC-DEC-007 | Manual review + token assertions | Covered |
| AC-F3-1 | Registry title/heading say v1, lock banner names ODR-0003 + date, every command table row byte-identical | TC-DEC-014, TC-DEC-015 | Assertion + base-vs-HEAD table diff | Covered |
| AC-F3-2 | 0 command renames; ODR-0003 states freeze/new-command/superseding-record rule and confirms `provider`, `provider-quota`, `DeliveryRequest` | TC-DEC-007, TC-DEC-015 | Command-token set diff + content review | Covered |
| AC-F4-1 | Log exists at the pinned path, parses as YAML, carries the required top-level keys, `source_commit` 40-hex, all four `MET-` IDs, the DM-2 `change` mapping identifying `GH-186`, and `changes` sequence of exactly one row per committed `chg-*-pm-notes.yaml` at `source_commit` (including `included: false` rows for unparseable files) | TC-MEAS-001, TC-MEAS-002, TC-MEAS-005 | YAML parse + key/spine assertions | Covered |
| AC-F4-2 | Metric rows carry definition/formula/unit/window/sources/status/value/sample/direction; every non-null number cited; every change row cites pm-notes; incident rows cite artifact + anchor | TC-MEAS-002, TC-MEAS-003, TC-MEAS-004 | Schema assertion + source resolution | Covered |
| AC-F4-3 | Ratio metrics reproduce exactly on recomputation (0 tolerance) after normalizing YAML-native `date`/`datetime` scalars and excluding placeholder zero times; no denominator without a sample count/inclusion rule | TC-MEAS-005, TC-MEAS-006, TC-MEAS-007, TC-MEAS-008, TC-MEAS-009 | Recompute from named sources after DEC-14 normalization | Covered |
| AC-F4-4 | `UNAVAILABLE` → `value: null` + `missing_source`; CI metric is `session_proxy` with a limitation naming the absent run log; no estimate as measurement; a time metric over an unparseable/placeholder corpus is `PARTIAL`, not `MEASURED` | TC-MEAS-008, TC-MEAS-010 | Status-matrix assertion | Covered |
| AC-F4-5 | Window start/end exact; GH-186 excluded as `capture_change`; date-only pairs counted; every excluded change carries exactly one closed-vocabulary reason (`unparseable_yaml`, `date_only_or_missing_time`, `placeholder_zero_time`, `capture_change`, `outside_window`; `no_ci_observation` is a CI-sample reason only); GH-171 appears as its own `unparseable_yaml` row counted in `changes_excluded`; comparison protocol states same-definition/equal-window/supersede-on-change | TC-MEAS-005, TC-MEAS-011 | Field assertion + content review | Covered |
| AC-F5-1 | Four new index rows with correct type/title/status/date/owner, in numeric order | TC-DEC-011 | Row parse + record cross-check | Covered |
| AC-F5-2 | TDR-0005 row ID/link text repaired and ordered before TDR-0006; PDR-0002 title matches its heading; no other pre-existing row changed | TC-DEC-012 | Row-set diff against base | Covered |
| AC-F5-3 | Every new/changed index/register link resolves; index and `doc/decisions/README.md` both link the register | TC-DEC-013, TC-SYNC-004 | Link extraction + resolution + manual anchor check | Covered |
| AC-F6-1 | Phase-7 sync across the nine named docs; new feature spec carries `ados_distribution: internal`, was registered in the same doc-sync commit that created it, and states the contract without restating values | TC-SYNC-001, TC-SYNC-002, TC-SYNC-003, TC-SYNC-005, TC-MEAS-011 | Presence assertions + values-not-restated check | Covered |
| AC-C1-1 | 0 changed paths under `packages/**` and `tools/**`; no source-code, shell, test-logic, or check-logic change; the only `scripts/**` change is the data-only `registered` addition in `scripts/checks/forbidden-literals.registry.json`; every other changed path is under `doc/**` | TC-GATE-001, TC-GATE-002, TC-GATE-005 | `git diff --name-only` + registry key-diff assertion | Covered |
| AC-C10-1 | Both new user-facing docs are listed in `registered`, each entry staged in the same commit that creates its doc (YAML in the baseline commit, feature spec in the doc-sync commit; neither pre-registered); the forbidden-literal check exits 0; neither doc has a delimited seed-literal occurrence on a non-allowlisted line | TC-GATE-005 | Registry assertion + same-commit history + guard exit + delimited seed-literal scan | Covered |
| AC-C2-1 | No existing decision-record file modified; no other change folder edited | TC-DEC-010, TC-GATE-002, TC-SYNC-005 | `git diff` scoped assertions | Covered |
| AC-NFR6-1 | `bash scripts/.tests/test-doc-distribution.sh` exits 0 with no drift | TC-GATE-003, TC-GATE-006 | Automated guard | Covered |
| AC-NFR2-1 | Every new record has the template's required front-matter keys and required sections in order; valid Markdown | TC-DEC-003 | Template conformance inspection | Covered |
| AC-PROC-1 | Four records `Proposed` with `decision_date: null`; register shows pending owner acceptance; 0 `Accepted` | TC-DEC-002, TC-DEC-009 | Front-matter + register assertion | Covered |

**Review-only (or review-dominant) ACs and how the reviewer signs off:**

- **AC-F2-2** requires semantic completeness, not token presence. TC-DEC-004…TC-DEC-007 give a per-record element checklist derived from spec §5.1; the reviewer confirms each element and records a one-line verdict per record in §10.
- **AC-F1-2** has an automated part (`git diff` shows no existing record body changed) and a semantic part (no new record re-decides a bound topic). The semantic part is judged in TC-DEC-009/TC-DEC-010 against the bindings table in spec §5.1.
- **AC-F4-3, AC-F4-4, AC-F4-5** are automated in structure (field presence, status matrix, recomputation) but the *interpretation* of a proxy is confirmed by the reviewer against the definitions in spec §5.1; the recomputed numbers and their deltas are recorded in §10.
- **AC-F6-1** combines hard presence assertions (links, headings, pointers) with one semantic rule ("does not restate metric values") verified by the literal-scan heuristic in TC-SYNC-002.
- **AC-PROC-1** is fully automated (front matter) except the register's "pending owner acceptance" wording, confirmed in TC-DEC-009.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No HTTP endpoints or events are added (spec §8.1–§8.2). The documented data contracts are covered:

| ID | Interface / Contract | TC ID(s) |
|----|----------------------|----------|
| DM-1 | Foundational decision register: columns `Topic`, `Binding record(s)`, `Anchor(s)`, `Status`, `Binding note`; eight rows; no decision text; update rule; `ados_distribution: project-generated`; linked from index and README | TC-DEC-008, TC-DEC-009, TC-DEC-013 |
| DM-2 | Measurement baseline log schema: top-level keys (including the `change` mapping `{ref, tracker, excluded_from_samples}`), `change-row` keys, `metric-row` keys, `sample`/`aggregates`/incident-row keys; canonical ratio 0–1 `value`; `p90_h` by nearest-rank | TC-MEAS-001, TC-MEAS-002, TC-MEAS-005, TC-MEAS-006, TC-MEAS-007, TC-MEAS-008, TC-MEAS-011 |
| DM-3 | Command-name lock surface: command/family names + `provider` family + `provider-quota` adapters subpath + `DeliveryRequest`; global options/config keys/brand name outside the lock | TC-DEC-007, TC-DEC-014, TC-DEC-015 |
| DM-4 | New decision-record front matter contract: `id`, `decision_type`, `status: Proposed`, `created`, `decision_date: null`, `last_updated`, `summary`, `owners`, `service`, `classification`, `governance`, `links` | TC-DEC-002, TC-DEC-003, TC-DEC-010 |

### 3.3 Non-Functional Coverage (NFR-#) and Hard Constraints (C-#)

| ID | Requirement | TC ID(s) | Notes |
|----|-------------|----------|-------|
| NFR-1 | 100% of non-null baseline numbers cited; 0 uncited | TC-MEAS-003, TC-MEAS-004 | Metric-level `sources` + row-level artifact/anchor resolution |
| NFR-2 | New records conform to the template (100%, 0 missing) | TC-DEC-003, TC-SYNC-002 | Decision template + feature template respectively |
| NFR-3 | 100% of new/changed links resolve; 0 broken | TC-DEC-013, TC-SYNC-004 | Semi-automated (no repo link checker exists) |
| NFR-4 | Log parses; 0 missing top-level/metric-row keys; `changes` spine covers 100% of committed pm-notes at `source_commit`, including excluded/unparseable rows | TC-MEAS-001, TC-MEAS-002, TC-MEAS-005 | YAML parse + DM-2 key set + corpus/spine diff |
| NFR-5 | Command tables and names byte-identical; 0 row diffs; 0 renames | TC-DEC-015 | Base-vs-HEAD extraction diff |
| NFR-6 | `bash scripts/.tests/test-doc-distribution.sh` exit 0, 0 drift | TC-GATE-003, TC-GATE-006 | Plus negative-mode self-tests |
| NFR-7 | Recomputing each metric from its named sources after corpus normalization reproduces the recorded value, spine, exclusion reasons and sample counts exactly | TC-MEAS-005, TC-MEAS-006, TC-MEAS-007, TC-MEAS-008, TC-MEAS-009 | Representation rule R-1 in §6 + normalization N-1 |
| NFR-8 | All 8 M0-S17 topics resolve to ≥1 binding record + anchor (8/8) | TC-DEC-008, TC-DEC-009 | Row count + anchor existence |
| NFR-9 | Two named index defects repaired, no other pre-existing row changed | TC-DEC-012 | Row-set diff against base |
| NFR-10 | Forbidden-literal gate passes; both new docs registered in the commit that creates each; 0 delimited seed-literal occurrences on non-allowlisted lines | TC-GATE-005 | Guard exit + registry assertion + same-commit history + delimited scan |
| C-1 | Docs-only plus one data-only registry registration: 0 paths under `packages/**` and `tools/**`; no source/shell/test/check-logic change; only `scripts/**` edit is the `registered` addition; all other paths under `doc/**` | TC-GATE-001, TC-GATE-002, TC-GATE-005 | Hard negative constraint |
| C-2 | Existing decision bodies immutable; only index/README/register/new records change in `doc/decisions/` | TC-DEC-010, TC-DEC-012 | Scoped `git diff` |
| C-3 | New records `Proposed`, `decision_date: null`, never `Accepted` | TC-DEC-002 | Front matter |
| C-4 | No command/option/package/subpath rename; registry table rows unchanged | TC-DEC-015 | Table diff + command-token set diff |
| C-5 | Committed evidence only; no estimates/interpolations/invented denominators; missing inputs `UNAVAILABLE`; unparseable/placeholder-only/otherwise unusable artifacts excluded with a named closed-vocabulary reason and counted, never dropped or zero-filled | TC-MEAS-005, TC-MEAS-010 | Status matrix + closed exclusion vocabulary |
| C-6 | No duplication of decided content; binding by ID/anchor | TC-DEC-009, TC-DEC-010 | Register text review + body diff |
| C-7 | Log is repository-local and committed under `doc/planning/oss-tooling/`, never `.ai/local/**` | TC-MEAS-001, TC-MEAS-004 | Path + `git ls-files` + `git check-ignore` |
| C-8 | Durable prefixes registered (`MET-` via ODR-0002); change-local prefixes stay local; decision IDs next-free, never reused | TC-DEC-001, TC-DEC-006 | ID sequence + prefix inventory |
| C-9 | Scope bounded to the named docs and this change folder | TC-GATE-002, TC-SYNC-005 | Changed-path allowlist |
| C-10 | Each new user-facing doc is registered and contains no delimited occurrence of `ados`, `ADOS_`, `~/.ados` on non-allowlisted lines | TC-GATE-005 | Registry data diff + delimited seed-literal scan |

## 4. Test Types and Layers

Per `.ai/rules/testing-strategy.md`, a `doc/**`-only change plus a data-only registry registration maps to **static/diff + content checks** (the registry file is data, not a script or check-logic module). No unit/integration/E2E/performance layer applies.

| Layer | Applies? | Method / location |
|-------|----------|-------------------|
| Static / diff | Yes | `git diff --name-only`, `git diff --name-status`, `git diff --check` against the merge base |
| Content — traceability | Yes | Reviewer checklists in §5.2 against spec §5.1/§5.2/§8.3/§17 |
| Content — Markdown structure | Yes | Heading/table/fence inspection of every new or changed Markdown file |
| Content — link/path resolution | Yes | Semi-automated link extraction + `test -e` + heading-anchor resolution (no committed checker exists) |
| YAML syntax and schema | Yes | `python3` + PyYAML (or `yq`) parse of the log; DM-2 key assertions; YAML-native `date`/`datetime` normalization (N-1) before recomputation |
| Contract (data-artifact) | Yes | DM-1/DM-2/DM-3/DM-4 field-level assertions; reproducibility recomputation |
| Grep / absence assertions | Yes | `rg` for pinned strings, forbidden strings, renamed tokens, class vocabulary |
| Automated guards | Yes | `test-doc-distribution.sh` (+ `-modes.sh`), `test-inception-doc-consistency.sh`, `scripts/checks/forbidden-literals.ts`, `scripts/checks/privacy-literals.ts`, `scripts/checks/commitlint-authority.ts` + `commitlint` |
| Unit / Integration / E2E / Performance | No | No runtime code changes |
| TypeScript workspace checks (`pnpm check`) | No (not required) | No `packages/**`, `tests/**`, or root TS config change; the docs-only fallback in the testing strategy applies |

### 4.1 Repository gate inventory (verified names and paths)

| Gate | Exact command | What it proves | Relevance |
|------|---------------|----------------|-----------|
| Diff hygiene | `git diff --check "$BASE"...HEAD` | No trailing whitespace, space-before-tab, conflict markers | Always (testing-strategy static/diff layer) |
| Doc-distribution drift guard | `bash scripts/.tests/test-doc-distribution.sh` | Every in-scope doc has a valid `ados_distribution` marker; marker-derived install set equals the sandbox install set | **AC-NFR6-1** |
| Doc-distribution negative modes | `bash scripts/.tests/test-doc-distribution-modes.sh` | The guard's five failure modes still fire | Ancillary regression (TC-GATE-003/006) |
| Inception doc-set consistency | `bash scripts/.tests/test-inception-doc-consistency.sh` | Cross-surface terminology/matrix/index/structure parity for the inception doc set | Ancillary regression (TC-GATE-006) |
| Forbidden-literal scan | `bun run scripts/checks/forbidden-literals.ts` | Seed literals absent from user-facing docs; **every `doc/**` file outside `doc/changes/` and `doc/decisions/` must be present at `corpusBaseline` or listed in `scripts/checks/forbidden-literals.registry.json`** | **Critical here** — both new docs are registered via the DEC-13 data edit (TC-GATE-005) |
| Privacy-literal scan | `bun run scripts/checks/privacy-literals.ts` | Working-tree scan finds no planted private literals/cloud terms | Spec §20 "guard battery remains green" (TC-GATE-005) |
| Commitlint authority | `bun run scripts/checks/commitlint-authority.ts` | Exactly one root commitlint config; no override | Commit conformance (TC-GATE-004) |
| Commitlint range | `pnpm exec commitlint --from "$BASE" --to HEAD` | Every branch commit follows Conventional Commits | Commit conformance (TC-GATE-004) |
| Markdown link/anchor checker | **Does not exist** | — | NFR-3 is verified semi-automatically (TC-SYNC-004) |

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-DEC-001 | Exactly four new decision records with next-free IDs | Happy Path | File set | High | AC-F2-1, C-8 |
| TC-DEC-002 | New-record front matter, `Proposed` status, no acceptance, lineage | Happy Path | Front matter | High | AC-F2-1, AC-PROC-1, C-3, DM-4 |
| TC-DEC-003 | New records conform to the decision-record template | Regression | Content | High | AC-NFR2-1, NFR-2, DM-4 |
| TC-DEC-004 | ADR-0008 harness contract Decision content complete | Happy Path | Content | High | AC-F2-2 |
| TC-DEC-005 | ADR-0009 release-model lock Decision content complete | Happy Path | Content | High | AC-F2-2 |
| TC-DEC-006 | ODR-0002 ID-scheme/catalog Decision content complete | Happy Path | Content | High | AC-F2-2, C-8 |
| TC-DEC-007 | ODR-0003 naming lock content: rules, confirmations, freeze | Happy Path | Content | High | AC-F2-2, AC-F3-2, DM-3 |
| TC-DEC-008 | Register exists with the DM-1 schema and eight topic rows | Happy Path | Contract | High | AC-F1-1, DM-1, NFR-8 |
| TC-DEC-009 | Register bindings exact, anchors exist, no duplicated decisions | Negative | Content + grep | High | AC-F1-1, AC-F1-2, AC-PROC-1, NFR-8, C-6 |
| TC-DEC-010 | Existing decision-record bodies are unmodified | Negative | Diff | High | AC-F1-2, AC-C2-1, C-2, C-6 |
| TC-DEC-011 | Index gains four correct, ordered, linked rows | Happy Path | Content | High | AC-F5-1 |
| TC-DEC-012 | Index repairs: TDR-0005 and PDR-0002, nothing else | Regression | Content diff | High | AC-F5-2, NFR-9, C-2 |
| TC-DEC-013 | Index and README link the register; index marker intact | Happy Path | Links | High | AC-F5-3, NFR-3, DM-1 |
| TC-DEC-014 | Registry promoted `v0 → v1` by annotation only | Happy Path | Content diff | High | AC-F3-1, DM-3 |
| TC-DEC-015 | Command tables byte-identical and zero renames | Negative | Diff | High | AC-F3-1, AC-F3-2, NFR-5, C-4 |
| TC-MEAS-001 | Log exists, parses, carries top-level keys, 40-hex commit, four MET IDs | Happy Path | YAML | High | AC-F4-1, NFR-4, DM-2, C-7 |
| TC-MEAS-002 | DM-2 row schema complete for metrics, changes and incidents | Happy Path | Contract | High | AC-F4-1, AC-F4-2, NFR-4, DM-2 |
| TC-MEAS-003 | Every number is cited; rows and incident anchors resolve | Negative | Traceability | High | AC-F4-2, NFR-1 |
| TC-MEAS-004 | Cited sources exist at `source_commit`; source hygiene | Negative | Traceability | High | AC-F4-2, NFR-1, C-5, C-7 |
| TC-MEAS-005 | Window, capture-change exclusion, corpus normalization, date-only/placeholder counting, closed vocabulary | Happy Path | Contract | High | AC-F4-1, AC-F4-3, AC-F4-5, C-5, NFR-4, NFR-7 |
| TC-MEAS-006 | Ceremony share recomputes exactly | Happy Path | Recompute | High | AC-F4-3, NFR-7 |
| TC-MEAS-007 | Cycle time recomputes exactly, incl. censoring and aggregates | Happy Path | Recompute | High | AC-F4-3, NFR-7 |
| TC-MEAS-008 | CI failure rate recomputes exactly (session proxy) | Edge Case | Recompute | High | AC-F4-3, AC-F4-4, NFR-7 |
| TC-MEAS-009 | False-signal incident count recomputes exactly per class | Edge Case | Recompute | High | AC-F4-3, AC-F4-4, NFR-7 |
| TC-MEAS-010 | MEASURED / PARTIAL / UNAVAILABLE semantics honoured | Negative | Contract | High | AC-F4-4, C-5 |
| TC-MEAS-011 | Comparison protocol and baseline immutability stated | Happy Path | Content | Medium | AC-F4-5, NFR-7 |
| TC-SYNC-001 | `feature-decision-records.md` gains register + ID-scheme pointers | Happy Path | Content | High | AC-F6-1 |
| TC-SYNC-002 | `feature-measurement-baseline.md` states the contract, not values | Happy Path | Content | High | AC-F6-1, NFR-2 |
| TC-SYNC-003 | Glossary, `doc/00-index`, planning README, catalog, primitive and adapter-ports pointers | Happy Path | Content | High | AC-F6-1 |
| TC-SYNC-004 | All new/changed links resolve to files and anchors | Regression | Links | High | AC-F5-3, NFR-3 |
| TC-SYNC-005 | Sync is bounded; no other current-truth or historical artifact rewritten | Negative | Diff | High | AC-F6-1, AC-C2-1, C-9 |
| TC-GATE-001 | Diff scope: zero `packages/**`/`tools/**`, exactly one permitted `scripts/**` data edit | Negative | Static/diff | High | AC-C1-1, C-1, DEC-13 |
| TC-GATE-002 | Diff hygiene and changed-path allowlist | Regression | Static/diff | Medium | AC-C1-1, AC-C2-1, C-1, C-9 |
| TC-GATE-003 | Doc-distribution guard (and negative modes) passes | Regression | Guard | High | AC-NFR6-1, NFR-6 |
| TC-GATE-004 | Branch commits satisfy commitlint | Regression | Guard | Medium | AC-C1-1, NFR-6 |
| TC-GATE-005 | Forbidden-literal registration, same-commit staging, DEC-13 registry scope, and seed-literal compliance | Negative | Guard + history + diff | High | AC-C1-1, AC-C10-1, AC-F6-1, NFR-10, C-10 |
| TC-GATE-006 | Ancillary doc-set guard stays green | Regression | Guard | Low | AC-NFR6-1, NFR-6 |

### 5.2 Scenario Details

#### TC-DEC-001 - Exactly four new decision records with next-free IDs

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, AC-F2-1, C-8, RSK-8
**Test Type(s)**: Content / assertion
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/decisions/`
**Tags**: @docs, @decisions, @file-set

**Preconditions**:

- Branch `feat/GH-186/decision-records-measurement-baseline` checked out; `origin/main-tools` fetched.
- `BASE="$(git merge-base origin/main-tools HEAD)"` recorded.

**Steps**:

1. Enumerate added decision files:
   ```bash
   git diff --name-status "$BASE"...HEAD -- doc/decisions/ | rg '^A\s'
   ```
2. Assert the added set is exactly this four-file set (count exactly 4):
   `doc/decisions/ADR-0008-harness-adapter-contract.md`,
   `doc/decisions/ADR-0009-release-model-v1.md`,
   `doc/decisions/ODR-0002-id-prefix-scheme-and-project-catalog.md`,
   `doc/decisions/ODR-0003-cli-command-naming-v1-lock.md`.
3. Assert no decision file was renamed or copied:
   ```bash
   git diff --name-status "$BASE"...HEAD -- doc/decisions/ | rg '^(R|C)\s' ; echo "rename-exit=$?"   # expect 1
   ```
4. Assert the IDs are next-free at the base and never reused:
   ```bash
   git ls-tree -r --name-only "$BASE" -- doc/decisions/ | rg -o 'ADR-[0-9]{4}' | sort -u | tail -2   # ADR-0006 ADR-0007
   git ls-tree -r --name-only "$BASE" -- doc/decisions/ | rg -o 'ODR-[0-9]{4}' | sort -u | tail -1   # ODR-0001
   ```
5. Assert each file's `id:` equals its filename prefix and `decision_type:` is `adr`/`odr` accordingly:
   ```bash
   rg -n '^(id|decision_type):' doc/decisions/ADR-0008-*.md doc/decisions/ADR-0009-*.md \
     doc/decisions/ODR-0002-*.md doc/decisions/ODR-0003-*.md
   ```

**Expected Outcome**:

- Exactly four added files with the exact filenames above; zero renames/copies in `doc/decisions/`.
- ADR-0008/ADR-0009 are the immediate successors of ADR-0007; ODR-0002 is the immediate successor of ODR-0001; no number reused.

**Notes / Clarifications**:

- The next-free check is a recompute of RSK-8: if a concurrent change consumed an ID, stop and escalate rather than reusing or renumbering (spec §12).

#### TC-DEC-002 - New-record front matter, `Proposed` status, no acceptance, lineage

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-2, C-3, DM-4, AC-F2-1, AC-PROC-1
**Test Type(s)**: Contract / assertion
**Automation Level**: Automated
**Target Layer / Location**: The four new records' YAML front matter
**Tags**: @docs, @decisions, @front-matter, @no-self-accept

**Preconditions**:

- The four records from TC-DEC-001 exist.
- A YAML parser is available (`python3` + PyYAML, `yq`, or `bun`'s `yaml`).

**Steps**:

1. Parse each record's front matter (first `---` block) and assert presence of: `id`, `decision_type`, `status`, `created`, `decision_date`, `last_updated`, `summary`, `owners`, `service`, `classification`, `governance`, `links`.
2. Assert `status == "Proposed"` and `decision_date is None` for all four.
3. Assert `links.related_changes` contains `"GH-186"` and the parent record pinned in spec §5.1 F-2 appears in the record's links block (ADR-0008 → `ADR-0003`; ADR-0009 → `ADR-0003`; ODR-0002 → `ODR-0001`; ODR-0003 → `ADR-0007`).
4. Assert the owner-acceptance-pending statement is present and no acceptance/date was set:
   ```bash
   rg -n 'acceptance pending at GH-186 PR review' doc/decisions/ADR-0008-*.md \
     doc/decisions/ADR-0009-*.md doc/decisions/ODR-0002-*.md doc/decisions/ODR-0003-*.md
   rg -n '^status:[[:space:]]*Accepted|^decision_date:[[:space:]]*[0-9]{4}-' doc/decisions/ADR-0008-*.md \
     doc/decisions/ADR-0009-*.md doc/decisions/ODR-0002-*.md doc/decisions/ODR-0003-*.md ; echo "accepted-or-dated-exit=$?"   # expect 1
   ```
5. Assert no file in `doc/decisions/` gained `status: Accepted` anywhere in the diff:
   ```bash
   git diff "$BASE"...HEAD -- doc/decisions/ | rg '^\+status:[[:space:]]*Accepted$' ; echo "new-accepted-exit=$?"   # expect 1
   ```
6. Assert `governance.decider` names the human owner (the AI is not the decider) and that the record states acceptance is pending.

**Expected Outcome**:

- All four records are `Proposed`, `decision_date: null`, linked to GH-186 and their parent records, and state that acceptance is pending at GH-186 PR review.
- Zero records in the diff become `Accepted`; zero decision dates set; the AI did not self-accept (C-3 / AC-PROC-1).

#### TC-DEC-003 - New records conform to the decision-record template

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, DM-4, NFR-2, AC-NFR2-1
**Test Type(s)**: Manual / content
**Automation Level**: Manual (heading enumeration assisted by `rg`)
**Target Layer / Location**: The four new records vs `doc/templates/decision-record-template.md` and `doc/guides/decision-records-management.md` §6
**Tags**: @docs, @decisions, @template-conformance

**Preconditions**:

- The four records exist and each declares `classification.rigor`.

**Steps**:

1. Enumerate headings per record:
   ```bash
   for f in doc/decisions/ADR-0008-*.md doc/decisions/ADR-0009-*.md \
            doc/decisions/ODR-0002-*.md doc/decisions/ODR-0003-*.md; do
     printf '\n== %s\n' "$f"; rg -n '^#+ ' "$f";
   done
   ```
2. Assert the H1 matches the record-ID heading form `# ADR-0008:` + title (one H1 per file, ID equal to the filename prefix).
3. Apply the required-section order from `doc/guides/decision-records-management.md` §6 (items 2–19), scaled by the declared rigor per the template's tiered model: **R2 omits Rollback/Reversal, Communication Plan and Structured Retrospective**; **R3 additionally requires a review date and a human final decision**; **R1 renders only the documented strict subset**. Assert the present sections appear in canonical relative order and that no rigor-inapplicable section is invented.
4. Assert the required front-matter keys from DM-4 are present and non-empty where required: `id`, `decision_type`, `status`, `created`, `last_updated`, `summary`, `owners` (≥1), `service`, `classification`, `governance`.
5. Assert no template residue and valid Markdown: single front-matter block, one H1, balanced fences, consistent table columns:
   ```bash
   rg -n 'TEMPLATE INSTRUCTIONS|<!--|rigor: R[123]' doc/decisions/ADR-0008-*.md doc/decisions/ADR-0009-*.md \
     doc/decisions/ODR-0002-*.md doc/decisions/ODR-0003-*.md ; echo "residue-exit=$?"   # expect 1
   ```
6. Record the per-record section verdict in §10.

**Expected Outcome**:

- 0 missing required front-matter fields and 0 missing required sections for the declared rigor; canonical order holds in all four records.
- No template guidance/comment residue; Markdown renders cleanly.

**Notes / Clarifications**:

- "Required" is defined by the template plus the management guide, not by this plan. If a record declares R1, the strict-subset rule applies and the reviewer confirms the subset rather than the full list.

#### TC-DEC-004 - ADR-0008 harness contract Decision content complete

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-F2-2
**Test Type(s)**: Manual / content
**Automation Level**: Manual (grep-assisted)
**Target Layer / Location**: `doc/decisions/ADR-0008-harness-adapter-contract.md` §Decision
**Tags**: @docs, @decisions, @harness

**Preconditions**:

- The record exists (TC-DEC-001).

**Steps**:

1. Extract the Decision section:
   ```bash
   awk '/^## Decision$/{f=1} f && /^## / && !/^## Decision$/{f=0} f' \
     doc/decisions/ADR-0008-harness-adapter-contract.md
   ```
2. Verify each required element from spec §5.1 F-2 (semantic check; the grep is an occurrence aid, not the assertion):
   - Harnesses are a provider domain behind the **same primitive port surface** as trackers/VCS/CI.
   - `HarnessInstance` with capability flags.
   - `HarnessSession`: spawn, deliver, resume/steer, collect, classify, harness-agnostic liveness.
   - `HarnessPluginSurface`: generated one-way from the canonical source, sync-verified.
   - Closeout telemetry extraction.
   - Dispatch selects a harness **by configuration**, and capability gaps are **declared**.
   - **No harness-specific logic lives in engines.**
   ```bash
   rg -n 'HarnessInstance|HarnessSession|HarnessPluginSurface|telemetry|configuration|capability' \
     doc/decisions/ADR-0008-harness-adapter-contract.md
   ```
3. Confirm the record links ADR-0003 DEC-6 as required by §5.1.
4. Confirm it adds only what is undecided (cross-checked in TC-DEC-009 step 4).

**Expected Outcome**:

- All seven required elements are present and correct; the ADR type justification matches spec DEC-3.
- The record adds the harness contract only; it does not re-decide a bound topic.

#### TC-DEC-005 - ADR-0009 release-model lock Decision content complete

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, AC-F2-2
**Test Type(s)**: Manual / content
**Automation Level**: Manual (grep-assisted)
**Target Layer / Location**: `doc/decisions/ADR-0009-release-model-v1.md` §Decision
**Tags**: @docs, @decisions, @release

**Preconditions**:

- The record exists.

**Steps**:

1. Extract the Decision section as in TC-DEC-004.
2. Verify each required element from spec §5.1 F-2:
   - One **lockstep** version line for the five publishable packages as a changesets **fixed group**.
   - One version / one tag / one release train.
   - **Tagged signed releases** as the stable install source with `SHA256SUMS`, SBOM and notices.
   - CLI/MCP artifacts built per release.
   - **M4-S2 owns automation and channel mechanics** and **must not reopen the release unit**.
   ```bash
   rg -n 'lockstep|fixed group|SHA256SUMS|SBOM|M4-S2|release unit' doc/decisions/ADR-0009-release-model-v1.md
   ```
3. Confirm it links ADR-0003 DEC-3 and frames itself as a **lock** of the already-decided direction.
4. Cross-check the five-package identity against the repository's changesets fixed group (do not assume):
   ```bash
   rg -n 'fixed|core|adapters|cli|mcp|opencode' .changeset/config.json
   ```

**Expected Outcome**:

- All required elements are present; the fixed-group membership named in the record matches `.changeset/config.json`.
- The M4-S2 boundary is explicit ("must not reopen the release unit").

#### TC-DEC-006 - ODR-0002 ID-scheme/catalog Decision content complete

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-2, C-8, AC-F2-2
**Test Type(s)**: Manual / content
**Automation Level**: Manual (grep-assisted)
**Target Layer / Location**: `doc/decisions/ODR-0002-id-prefix-scheme-and-project-catalog.md` §Decision
**Tags**: @docs, @decisions, @ids

**Preconditions**:

- The record and `doc/planning/concepts/id-prefix-catalog.md` exist.

**Steps**:

1. Extract the Decision section as in TC-DEC-004.
2. Verify each required element from spec §5.1 F-2:
   - Adopt the base registry, grammar and rules **R1–R11 by reference** (no copy).
   - Declare the project catalog with **per-type decision ranges** (ADR/PDR/TDR/BDR/ODR each own a sequence and index — explicitly not one shared sequence).
   - Change-local prefixes unchanged.
   - Tracker/story/`RTC-` allocations as catalogued.
   - `MET-` adopted, with the measurement baseline log as allocator.
   - **No other project space pre-registered** (no empty spaces).
   ```bash
   rg -n 'R1|R11|per-type|sequence|MET-|allocator|RTC-|adopt' \
     doc/decisions/ODR-0002-id-prefix-scheme-and-project-catalog.md
   ```
3. Cross-check that rules R1–R11 and the base registry exist in the referenced catalog — the record must adopt by reference, not restate:
   ```bash
   rg -n '^## ADOS base registry|R1|R11' doc/planning/concepts/id-prefix-catalog.md
   ```
4. Confirm the record links ODR-0001 (precedent) and the catalog concept.

**Expected Outcome**:

- All required elements are present; adoption is by reference; the customization choice is unambiguous (per-type ranges).
- No prefix outside the base registry plus `MET-` is adopted.

#### TC-DEC-007 - ODR-0003 naming lock content: rules, confirmations, freeze

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, DM-3, AC-F2-2, AC-F3-2
**Test Type(s)**: Manual / content
**Automation Level**: Manual (grep-assisted)
**Target Layer / Location**: `doc/decisions/ODR-0003-cli-command-naming-v1-lock.md` §Decision
**Tags**: @docs, @decisions, @naming-lock

**Preconditions**:

- The record exists; `doc/planning/oss-tooling/cli-command-registry.md` is the current registry.

**Steps**:

1. Extract the Decision section as in TC-DEC-004.
2. Verify the naming rules from spec §5.1 F-2: one meaning per name; near-synonym pairs rejected; family grouping; domain nouns not used for narrower commands; one-glance distinguishability and guessability.
3. Verify the three confirmations exist: the `provider` family, the `provider-quota` adapters subpath, and the `DeliveryRequest` primitive term.
4. Verify the lock policy: **no renames occur** in this change; **after M0 a rename requires a superseding record plus a code change**; new commands **join existing families**.
   ```bash
   rg -n 'provider-quota|DeliveryRequest|provider|superseding|rename|famil|no renames' \
     doc/decisions/ODR-0003-cli-command-naming-v1-lock.md
   ```
5. Ground the three confirmed names in the repository (the record freezes, it does not create):
   ```bash
   rg -n 'provider-quota' --glob '!doc/changes/**' . | head
   rg -n 'DeliveryRequest' packages/core/src/contracts/*.ts doc/spec/features/feature-adapter-ports.md | head
   rg -n '`provider`|provider family' doc/planning/oss-tooling/cli-command-registry.md | head
   ```
6. Confirm the record links ADR-0007 (its revisit trigger) and the command registry.

**Expected Outcome**:

- All naming rules, three confirmations and the freeze/supersession policy are stated.
- Every confirmed name exists in the repository today; the record performs no rename.

#### TC-DEC-008 - Register exists with the DM-1 schema and eight topic rows

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, DM-1, NFR-8, AC-F1-1
**Test Type(s)**: Contract / content
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/decisions/00-register.md`
**Tags**: @docs, @register, @schema

**Preconditions**:

- The register is added in the diff (`git diff --name-status "$BASE"...HEAD -- doc/decisions/00-register.md` shows `A`).

**Steps**:

1. Assert the front matter carries `ados_distribution: project-generated` (DM-1, consistent with `doc/decisions/00-index.md`):
   ```bash
   awk 'NR==1 && /^---$/{f=1;next} f && /^---$/{exit} f' doc/decisions/00-register.md \
     | rg '^ados_distribution: project-generated$'
   ```
2. Assert the table header contains the five DM-1 columns in order:
   ```bash
   rg -n '^\| *Topic *\| *Binding record\(s\) *\| *Anchor\(s\) *\| *Status *\| *Binding note *\|' \
     doc/decisions/00-register.md
   ```
3. Count data rows (excluding header and separator) and assert exactly **8**:
   ```bash
   awk -F'|' '/^\|/ && $0 !~ /^\|[- :|]+\|$/ {n++} END {print n-1}' doc/decisions/00-register.md
   ```
4. Assert all eight topic labels are present (case-insensitive substring): layout/monorepo structure, config precedence, provider adapter contract, harness adapter contract, state schema, release model, ID prefix scheme, command naming convention.
5. Assert the register states its update rule (superseded → successor; never renumbers or restates) and contains no decision section:
   ```bash
   rg -n -i 'supersed|successor|never (re-?number|restate)' doc/decisions/00-register.md
   rg -n '^## Decision$' doc/decisions/00-register.md ; echo "decision-heading-exit=$?"   # expect 1
   ```
6. Spot-check the `Status` column against each bound record's front matter for the five existing bindings (Accepted vs Proposed must mirror the record).

**Expected Outcome**:

- Register exists with the exact DM-1 columns, exactly eight topic rows, the documented update rule and the `project-generated` marker.
- No decision text or `## Decision` section: it is a projection, not a record.

**Notes / Clarifications**:

- The doc-distribution guard does not scan `doc/decisions/00-register.md` (its `STANDALONE_DOCS` list is fixed), so the marker is asserted here directly rather than by TC-GATE-003.

#### TC-DEC-009 - Register bindings exact, anchors exist, no duplicated decisions

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, AC-F1-1, AC-F1-2, AC-PROC-1, NFR-8, C-6, RSK-1
**Test Type(s)**: Content / grep
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/decisions/00-register.md` vs the bound records
**Tags**: @docs, @register, @bindings, @no-duplication

**Preconditions**:

- TC-DEC-008 passed (8 rows present).

**Steps**:

1. For each existing topic, assert the binding cell contains exactly the pinned record IDs:
   | Topic | Required IDs in `Binding record(s)` | Required anchor tokens in `Anchor(s)` |
   |---|---|---|
   | Layout / monorepo structure | `ADR-0003` | `DEC-1`, `DEC-2`, `DEC-7` |
   | Config precedence | `ADR-0003`, `TDR-0003` | `DEC-4` |
   | Provider adapter contract | `ADR-0003`, `ADR-0005`, `ADR-0007` | `DEC-6` |
   | State schema | `ADR-0003`, `TDR-0004` | `DEC-5` |
   | Release model | `ADR-0003`, `ADR-0009` | `DEC-3` |
2. Assert the three new-only topics bind to their new records: harness → `ADR-0008`; ID prefix scheme → `ODR-0002` + `id-prefix-catalog.md`; command naming → `ODR-0003` + `cli-command-registry.md`.
3. Assert every anchor token resolves in its target file:
   ```bash
   rg -n '^### DEC-(1|2|3|4|5|6|7)\b' doc/decisions/ADR-0003-oss-monorepo-structure.md
   rg -n '^### DC-[1-5]\b' doc/decisions/ADR-0007-provider-engine-v1-placement-fail-loud-parks-cost-policy.md
   rg -n '^## Decision$' doc/decisions/TDR-0003-config-parser-schema-and-acquisition.md \
     doc/decisions/TDR-0004-state-storage-engine.md
   rg -n '^## ADOS base registry|^## Customization model' doc/planning/concepts/id-prefix-catalog.md
   rg -n '^## Naming audit' doc/planning/oss-tooling/cli-command-registry.md
   ```
4. Assert AC-F1-2's semantic part: no new record re-decides layout, config precedence, state schema or provider adapter contract; ADR-0009 only locks/refines the already-decided release direction. Record a per-record verdict.
5. Assert no decision prose is copied into the register (a row may carry only a short binding note):
   ```bash
   rg -n -i 'because|therefore|we chose|rationale' doc/decisions/00-register.md ; echo "rationale-exit=$?"   # expect 1, or justified one-line notes
   ```
6. Assert pending owner acceptance is visible in the register:
   ```bash
   rg -n -i 'acceptance pending|pending owner' doc/decisions/00-register.md
   ```

**Expected Outcome**:

- 8/8 topics resolve to at least one binding record and anchor; the five existing bindings match the pinned set exactly.
- Every anchor token exists in its target file; no new record re-decides a bound topic; no decision prose duplicated; pending acceptance visible.

**Notes / Clarifications**:

- Register anchors are semantic identifiers (`DEC-1`, `DC-1`, section names), not URL fragments; "exists" means the token/heading is present in the target file. Markdown links are checked separately in TC-SYNC-004.

#### TC-DEC-010 - Existing decision-record bodies are unmodified

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-1, C-2, C-6, AC-F1-2, AC-C2-1, DM-4
**Test Type(s)**: Static / diff
**Automation Level**: Automated
**Target Layer / Location**: `doc/decisions/` pre-existing records
**Tags**: @diff, @decisions, @immutability

**Preconditions**:

- `BASE` recorded.

**Steps**:

1. Enumerate every pre-existing record at the base:
   ```bash
   git ls-tree -r --name-only "$BASE" -- doc/decisions/ | rg '\.md$' | rg -v '00-index\.md|README\.md'
   ```
2. Diff exactly that set against HEAD and assert no changes:
   ```bash
   git diff --name-only "$BASE"...HEAD -- \
     $(git ls-tree -r --name-only "$BASE" -- doc/decisions/ | rg '\.md$' | rg -v '00-index\.md|README\.md')
   ```
   Expected output: empty.
3. Assert the only changed/added paths under `doc/decisions/` are `00-index.md`, `README.md`, `00-register.md`, and the four new records:
   ```bash
   git diff --name-only "$BASE"...HEAD -- doc/decisions/
   ```
4. Assert no decision artifact was deleted:
   ```bash
   git diff --name-status "$BASE"...HEAD -- doc/decisions/ | rg '^D\s' ; echo "deleted-exit=$?"   # expect 1
   ```

**Expected Outcome**:

- Zero modifications to pre-existing record bodies (`ADR-0001`…`ADR-0007`, `ODR-0001`, `PDR-0001`, `PDR-0002`, `TDR-0001`…`TDR-0006`).
- Only the index, README, register and four new records appear in the `doc/decisions/` diff.

#### TC-DEC-011 - Index gains four correct, ordered, linked rows

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, AC-F5-1, DM-1
**Test Type(s)**: Content / assertion
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/decisions/00-index.md`
**Tags**: @docs, @decisions, @index

**Preconditions**:

- The four records and the index update are present.

**Steps**:

1. Assert each new ID appears exactly once as a linked row:
   ```bash
   for id in ADR-0008 ADR-0009 ODR-0002 ODR-0003; do
     printf '%s: ' "$id"; rg -c "^\| \[$id\]" doc/decisions/00-index.md
   done
   ```
2. Assert each row's link target is the exact record filename:
   ```bash
   rg -n '^\| \[ADR-0008\]\(ADR-0008-harness-adapter-contract\.md\)|^\| \[ADR-0009\]\(ADR-0009-release-model-v1\.md\)|^\| \[ODR-0002\]\(ODR-0002-id-prefix-scheme-and-project-catalog\.md\)|^\| \[ODR-0003\]\(ODR-0003-cli-command-naming-v1-lock\.md\)' \
     doc/decisions/00-index.md
   ```
   Expect four matches; then `test -f` each target.
3. Assert each row's `Type` cell equals the record `decision_type` uppercased, `Status` is `Proposed`, `Owners` matches the record's first owner, and `Date` equals the record's `created`:
   ```bash
   rg -n '^\| \[?(ADR-0008|ADR-0009|ODR-0002|ODR-0003)\]?' doc/decisions/00-index.md
   rg -n '^# (ADR-0008|ADR-0009|ODR-0002|ODR-0003): ' \
     doc/decisions/ADR-0008-*.md doc/decisions/ADR-0009-*.md \
     doc/decisions/ODR-0002-*.md doc/decisions/ODR-0003-*.md
   ```
4. Assert each row's `Title` cell equals the record's H1 title text (the text after the leading `# ` record-ID and colon).
5. Assert numeric order and block order (ADR rows before ODR rows; each pair ascending):
   ```bash
   rg -n '^\| \[?(ADR-0008|ADR-0009|ODR-0002|ODR-0003)' doc/decisions/00-index.md
   ```
   Required: line(ADR-0008) < line(ADR-0009) < line(ODR-0002) < line(ODR-0003).

**Expected Outcome**:

- Four new linked rows with type/title/`Proposed` status/date/owner matching the record; numeric ordering holds.
- No duplicate row for any new ID.

#### TC-DEC-012 - Index repairs: TDR-0005 and PDR-0002, nothing else

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, C-2, NFR-9, AC-F5-2, RSK-5
**Test Type(s)**: Content / diff
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/decisions/00-index.md`
**Tags**: @docs, @decisions, @index-repair

**Preconditions**:

- `BASE` recorded; the index diff is present.

**Steps**:

1. **TDR-0005 repaired** — assert the row's ID cell and link text are `TDR-0005`, pointing at the TDR-0005 file, and the mislabelled form is gone:
   ```bash
   rg -n '^\| \[TDR-0005\]\(TDR-0005-delivery-result-enum-and-cli-exit-taxonomy\.md\) \| TDR \|' \
     doc/decisions/00-index.md
   rg -n '\[TDR-0006\]\(TDR-0005-' doc/decisions/00-index.md ; echo "mislabelled-exit=$?"   # expect 1
   ```
2. **Order repaired** — assert the TDR-0005 row precedes the TDR-0006 row:
   ```bash
   rg -n '^\| \[?TDR-000[56]\]' doc/decisions/00-index.md
   ```
3. **PDR-0002 title repaired** — assert the index title cell equals the record H1 heading exactly, the link target is unchanged, and the stale title is absent from the index:
   ```bash
   rg -n '^# PDR-0002: ' doc/decisions/PDR-0002-mode-aware-spec-coverage-resolution.md
   rg -n '^\| \[?PDR-0002\]' doc/decisions/00-index.md
   rg -n 'Phase-7 Documentation Gap Closure \(Always Resolve In-Change\)' doc/decisions/00-index.md
   rg -n 'Mode-Aware Spec-Coverage Resolution for Autonomous Delivery' doc/decisions/00-index.md ; echo "stale-title-exit=$?"   # expect 1
   ```
4. **No other pre-existing row changed** — compare the table row sets base vs HEAD and classify every difference:
   ```bash
   git show "$BASE:doc/decisions/00-index.md" | rg '^\|' > /tmp/idx.base
   rg '^\|' doc/decisions/00-index.md > /tmp/idx.head
   diff -u /tmp/idx.base /tmp/idx.head
   ```
   Every `-`/`+` pair must be one of: the TDR-0005 row, the PDR-0002 row, or a `+` row for ADR-0008/ADR-0009/ODR-0002/ODR-0003 (plus the register link outside the table).
5. Assert the `PDR-0002` file was not renamed:
   ```bash
   git diff --name-status "$BASE"...HEAD -- 'doc/decisions/PDR-0002*' ; echo "pdr-diff-exit=$?"   # expect 1 (no changes)
   ```

**Expected Outcome**:

- 2/2 named defects repaired: TDR-0005 row labelled/linked/ordered correctly; PDR-0002 title matches its heading.
- Zero unintended pre-existing row changes; the PDR-0002 filename is unchanged.

**Notes / Clarifications**:

- The pre-existing TDR-0005 defect is confirmed at the base: the row is labelled `TDR-0006` while linking `TDR-0005-…md` and sits after the TDR-0006 row. Step 4's diff is the authoritative "no other row changed" check.

#### TC-DEC-013 - Index and README link the register; index marker intact

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-5, DM-1, NFR-3, AC-F5-3
**Test Type(s)**: Content / links
**Automation Level**: Automated
**Target Layer / Location**: `doc/decisions/00-index.md`, `doc/decisions/README.md`
**Tags**: @docs, @links, @register

**Preconditions**:

- Register and index/README edits present.

**Steps**:

1. Assert the index links the register:
   ```bash
   rg -n '\[[^]]*\]\(00-register\.md\)' doc/decisions/00-index.md
   ```
2. Assert `doc/decisions/README.md` references the register:
   ```bash
   rg -n '00-register\.md|Foundational decision register' doc/decisions/README.md
   ```
3. Assert the linked file resolves:
   ```bash
   test -f doc/decisions/00-register.md && echo register-exists
   ```
4. Assert both markers are intact (index is in the doc-distribution scan set; README is a standalone redistributable doc):
   ```bash
   awk 'NR==1 && /^---$/{f=1;next} f && /^---$/{exit} f' doc/decisions/00-index.md \
     | rg '^ados_distribution: project-generated$'
   awk 'NR==1 && /^---$/{f=1;next} f && /^---$/{exit} f' doc/decisions/README.md \
     | rg '^ados_distribution: redistributable$'
   ```
5. Assert the README diff is limited to the register reference:
   ```bash
   git diff "$BASE"...HEAD -- doc/decisions/README.md
   ```
   Every hunk must be the register reference; flag any unrelated rewrite.

**Expected Outcome**:

- Both the index and the README link `00-register.md`; the link resolves.
- Both markers intact; the README diff limited to the register reference.

#### TC-DEC-014 - Registry promoted `v0 → v1` by annotation only

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, DM-3, AC-F3-1
**Test Type(s)**: Content / diff
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/planning/oss-tooling/cli-command-registry.md`
**Tags**: @docs, @naming-lock, @registry

**Preconditions**:

- The registry annotation edit is present.

**Steps**:

1. Assert the document title is exactly `# ados(1) command registry and man page v1`:
   ```bash
   rg -n '^# ados\(1\) command registry and man page v1$' \
     doc/planning/oss-tooling/cli-command-registry.md
   ```
2. Assert the man-page heading is exactly `## ados(1): man page v1 (locked)`:
   ```bash
   rg -n '^## ados\(1\): man page v1 \(locked\)$' \
     doc/planning/oss-tooling/cli-command-registry.md
   ```
3. Assert a lock banner names `ODR-0003`, states that the names are frozen for v1, and carries an ISO lock date:
   ```bash
   rg -n 'ODR-0003' doc/planning/oss-tooling/cli-command-registry.md
   rg -n '20[0-9]{2}-[0-9]{2}-[0-9]{2}' doc/planning/oss-tooling/cli-command-registry.md | head
   rg -n -i 'frozen|locked' doc/planning/oss-tooling/cli-command-registry.md | head
   ```
   Record the banner date and confirm it matches the lock date stated in ODR-0003.
4. Assert the pre-lock introduction sentence is replaced by the ODR-0003 statement:
   ```bash
   rg -n 'via a decision record or the man-page v1 acceptance' \
     doc/planning/oss-tooling/cli-command-registry.md ; echo "old-intro-exit=$?"   # expect 1
   rg -n 'ODR-0003' doc/planning/oss-tooling/cli-command-registry.md
   ```
5. Assert the `provider` naming-audit bullet is updated:
   ```bash
   rg -n 'confirms the name or renames it now' \
     doc/planning/oss-tooling/cli-command-registry.md ; echo "old-bullet-exit=$?"   # expect 1
   rg -n 'confirmed as v1 by ODR-0003' doc/planning/oss-tooling/cli-command-registry.md
   ```
6. Review the full registry diff and confirm every hunk is one of: title, man-page heading, lock banner, introduction sentence, `provider` audit bullet. Flag any other hunk:
   ```bash
   git diff "$BASE"...HEAD -- doc/planning/oss-tooling/cli-command-registry.md
   ```

**Expected Outcome**:

- Title and man-page heading say v1 exactly; a lock banner names ODR-0003 and a lock date consistent with the record; the introduction and `provider` bullet are replaced as specified.
- No other content changed (command tables verified separately in TC-DEC-015).

#### TC-DEC-015 - Command tables byte-identical and zero renames

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3, DM-3, C-4, NFR-5, AC-F3-1, AC-F3-2
**Test Type(s)**: Static / diff
**Automation Level**: Automated
**Target Layer / Location**: `doc/planning/oss-tooling/cli-command-registry.md`; repository-wide rename check
**Tags**: @diff, @naming-lock, @no-renames

**Preconditions**:

- `BASE` recorded; the registry edit is present.

**Steps**:

1. Extract every table line from base and HEAD and assert the sets are byte-identical:
   ```bash
   git show "$BASE:doc/planning/oss-tooling/cli-command-registry.md" | rg '^\|' > /tmp/reg.base
   rg '^\|' doc/planning/oss-tooling/cli-command-registry.md > /tmp/reg.head
   diff -u /tmp/reg.base /tmp/reg.head ; echo "table-diff-exit=$?"   # expect 0
   wc -l /tmp/reg.base /tmp/reg.head                                  # counts must match
   ```
2. Assert no changed line in the file is a table row (belt-and-braces):
   ```bash
   git diff -U0 "$BASE"...HEAD -- doc/planning/oss-tooling/cli-command-registry.md | rg '^[+-]\|' ; echo "changed-row-exit=$?"   # expect 1
   ```
3. Extract command tokens from base and HEAD and assert identical sets:
   ```bash
   git show "$BASE:doc/planning/oss-tooling/cli-command-registry.md" | rg -o 'ados [a-z][a-z-]*' | sort -u > /tmp/cmd.base
   rg -o 'ados [a-z][a-z-]*' doc/planning/oss-tooling/cli-command-registry.md | sort -u > /tmp/cmd.head
   diff -u /tmp/cmd.base /tmp/cmd.head ; echo "cmd-diff-exit=$?"   # expect 0
   ```
4. Assert the four previously applied renames stand (no revert): `phase` (not `change`), `lint` (not `validate`), `repos` (not `workspace`), `harness` (not `opencode`) as command names in the tables.
5. Assert zero renames anywhere in the diff:
   ```bash
   git diff --name-status "$BASE"...HEAD | rg '^R' ; echo "rename-exit=$?"   # expect 1
   ```
6. Assert the `provider-quota` adapters subpath and its package manifest are untouched:
   ```bash
   git diff --exit-code "$BASE"...HEAD -- packages/adapters/package.json
   rg -n 'provider-quota' doc/planning/oss-tooling/cli-command-registry.md
   ```

**Expected Outcome**:

- 0 command-table row changes and 0 command-token changes; the four prior renames stand; 0 renames anywhere in the diff.
- The `provider-quota` subpath and its package manifest are untouched.

#### TC-MEAS-001 - Log exists, parses, carries top-level keys, 40-hex commit, four MET IDs

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, DM-2, C-7, AC-F4-1, NFR-4
**Test Type(s)**: Contract / YAML
**Automation Level**: Automated
**Target Layer / Location**: `doc/planning/oss-tooling/measurement-baseline.yaml`
**Tags**: @measurement, @yaml, @schema

**Preconditions**:

- The log is added in the diff.
- A YAML parser is available (`python3` + PyYAML, `yq`, or `bun` + `yaml`).

**Steps**:

1. Assert the file is repository-local, committed under the pinned path, and not git-ignored:
   ```bash
   test -f doc/planning/oss-tooling/measurement-baseline.yaml && echo path-ok
   git ls-files --error-unmatch doc/planning/oss-tooling/measurement-baseline.yaml
   git check-ignore -q doc/planning/oss-tooling/measurement-baseline.yaml ; echo "ignored-exit=$?"   # expect 1
   ```
2. Assert the file has no front-matter `---` block (a YAML doc must be a single document) and parses to a mapping:
   ```bash
   head -1 doc/planning/oss-tooling/measurement-baseline.yaml | rg -v '^---$'
   python3 -c 'import yaml,sys; d=yaml.safe_load(open(sys.argv[1])); assert isinstance(d,dict); print(len(d))' \
     doc/planning/oss-tooling/measurement-baseline.yaml
   ```
3. Assert the required top-level keys are present (AC-F4-1 ∪ DM-2): `schema_version`, `artifact`, `change`, `status`, `captured_at`, `source_commit`, `window`, `sources`, `changes`, `metrics`, `comparison_protocol`.
   ```bash
   python3 - <<'PY'
   import yaml
   d=yaml.safe_load(open("doc/planning/oss-tooling/measurement-baseline.yaml"))
   need={"schema_version","artifact","change","status","captured_at","source_commit",
         "window","sources","changes","metrics","comparison_protocol"}
   print("missing:", sorted(need-set(d))); assert not need-set(d)
   PY
   ```
4. Assert types and the source commit:
   ```bash
   SRC=$(python3 -c 'import yaml;print(yaml.safe_load(open("doc/planning/oss-tooling/measurement-baseline.yaml"))["source_commit"])')
   printf '%s' "$SRC" | rg -x '[0-9a-f]{40}'
   git cat-file -e "${SRC}^{commit}" && echo commit-reachable
   python3 -c 'import yaml;d=yaml.safe_load(open("doc/planning/oss-tooling/measurement-baseline.yaml"));assert isinstance(d["schema_version"],int);assert "T" in d["captured_at"]'
   ```
5. Assert the metric ID set is exactly the four required, each once:
   ```bash
   python3 -c 'import yaml;d=yaml.safe_load(open("doc/planning/oss-tooling/measurement-baseline.yaml"));ids=[m["id"] for m in d["metrics"]];print(ids);assert sorted(ids)==["MET-CEREMONY-SHARE","MET-CI-FAILURE-RATE","MET-CYCLE-TIME","MET-FALSE-SIGNAL-INCIDENTS"];assert len(ids)==4'
   ```
6. Assert the top-level `change` is the DM-2 mapping (never a bare string), identifies `GH-186`, marks the capture change excluded from samples, and that `status` is a non-empty string:
   ```bash
   python3 - <<'PY'
   import yaml
   d=yaml.safe_load(open("doc/planning/oss-tooling/measurement-baseline.yaml"))
   c=d["change"]
   assert isinstance(c, dict), type(c)
   assert {"ref","tracker","excluded_from_samples"} <= set(c), c
   assert c["ref"]=="GH-186" and isinstance(c["tracker"], str) and c["tracker"]
   assert c["excluded_from_samples"] is True
   assert isinstance(d["status"], str) and d["status"]
   print("change mapping ok")
   PY
   ```

**Expected Outcome**:

- The log exists at exactly `doc/planning/oss-tooling/measurement-baseline.yaml`, is tracked (not ignored), parses as a single YAML mapping, and carries all required top-level keys.
- `source_commit` is a reachable full 40-hex SHA; exactly the four `MET-` IDs are present; the `change` field is the DM-2 mapping with `ref: GH-186`, a non-empty `tracker` string, and `excluded_from_samples: true`.

#### TC-MEAS-002 - DM-2 row schema complete for metrics, changes and incidents

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, DM-2, AC-F4-1, AC-F4-2, NFR-4
**Test Type(s)**: Contract / YAML
**Automation Level**: Automated
**Target Layer / Location**: `doc/planning/oss-tooling/measurement-baseline.yaml`
**Tags**: @measurement, @schema, @rows

**Preconditions**:

- TC-MEAS-001 passed.

**Steps**:

1. Assert every `metric-row` carries the DM-2 key set (`id`, `name`, `status`, `measurement_kind`, `definition`, `formula`, `unit`, `window`, `sources`, `sample`, `numerator`, `denominator`, `value`, `aggregates`, `limitation`, `direction`, `comparison_note`):
   ```bash
   python3 - <<'PY'
   import yaml
   d=yaml.safe_load(open("doc/planning/oss-tooling/measurement-baseline.yaml"))
   need={"id","name","status","measurement_kind","definition","formula","unit","window","sources",
         "sample","numerator","denominator","value","aggregates","limitation","direction","comparison_note"}
   sample_need={"changes_parsed","changes_included","changes_excluded","phase_pairs_included",
                "phase_pairs_excluded","date_only_pairs_excluded","excluded_unobserved"}
   for m in d["metrics"]:
       assert not need-set(m), (m["id"], sorted(need-set(m)))
       assert not sample_need-set(m["sample"] or {}), (m["id"], sorted(sample_need-set(m["sample"] or {})))
   print("metric rows ok")
   PY
   ```
   `missing_source` is required only when `status == "UNAVAILABLE"` (asserted in TC-MEAS-010).
2. Assert every `change-row` carries: `ref`, `pm_notes`, `included`, `excluded_reason`, `phase_pairs_included`, `phase_pairs_excluded`, `date_only_pairs_excluded`, `ceremony_duration_h`, `total_phase_duration_h`, `cycle_time_h`, `cycle_time_censored`, `ci_observed`, `ci_outcome`, `ci_observations`, `false_signal_incidents`.
3. Assert each `ci_observations[]` entry carries `artifact`, `anchor`, `outcome`, `checks_affected`, and each `false_signal_incidents[]` entry carries `class`, `artifact`, `anchor`, `signal`, `reality`, `checks_affected`.
4. Assert `aggregates` carries `median_h`, `min_h`, `max_h`, and that each metric `window` carries `start`/`end` consistent with the top-level window.
5. Assert the ratio metrics use the canonical representation: `MET-CEREMONY-SHARE` and `MET-CI-FAILURE-RATE` have `unit: ratio`, a numeric `value` in `[0, 1]`, and no stored percent field (percent is derived, not stored — OQ-T3 pinned):
   ```bash
   python3 - <<'PY'
   import yaml
   d=yaml.safe_load(open("doc/planning/oss-tooling/measurement-baseline.yaml"))
   for m in d["metrics"]:
       if m["id"] in {"MET-CEREMONY-SHARE","MET-CI-FAILURE-RATE"}:
           assert m["unit"]=="ratio", (m["id"], m["unit"])
           assert isinstance(m["value"], (int,float)) and 0 <= m["value"] <= 1, (m["id"], m["value"])
           for forbidden in ("percent","percent_value","value_percent"):
               assert forbidden not in m, (m["id"], forbidden)
   print("ratio representation ok")
   PY
   ```
6. Assert optional-by-status keys are present as explicit `null` where unused rather than omitted (no missing-key ambiguity):
   ```bash
   python3 - <<'PY'
   import yaml
   d=yaml.safe_load(open("doc/planning/oss-tooling/measurement-baseline.yaml"))
   key="cycle_time_h"
   assert all(key in r for r in d["changes"])
   cycle=[m for m in d["metrics"] if m["id"]=="MET-CYCLE-TIME"][0]
   assert "p90_h" in (cycle["aggregates"] or {})
   print("nulls explicit")
   PY
   ```

**Expected Outcome**:

- 0 missing top-level, metric-row, change-row, observation-row or incident-row keys; schema-complete rows.
- Ratio metrics carry a canonical 0–1 `value` with `unit: ratio`; no percent value is stored as a second measurement.

#### TC-MEAS-003 - Every number is cited; rows and incident anchors resolve

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, NFR-1, AC-F4-2, RSK-2
**Test Type(s)**: Content / assertion
**Automation Level**: Semi-automated
**Target Layer / Location**: The log's `sources`, `changes[].pm_notes`, `ci_observations[]`, `false_signal_incidents[]`
**Tags**: @measurement, @traceability

**Preconditions**:

- TC-MEAS-002 passed.

**Steps**:

1. Assert every metric row has a non-empty `sources` list and each source has `id`, `kind`, `locator`:
   ```bash
   python3 - <<'PY'
   import yaml
   d=yaml.safe_load(open("doc/planning/oss-tooling/measurement-baseline.yaml"))
   for m in d["metrics"]:
       assert m["sources"], m["id"]
       for s in m["sources"]:
           assert {"id","kind","locator"} <= set(s), (m["id"], s)
   print("sources ok")
   PY
   ```
2. Assert every change row has a non-null `pm_notes` path that exists:
   ```bash
   python3 - <<'PY'
   import yaml, os
   d=yaml.safe_load(open("doc/planning/oss-tooling/measurement-baseline.yaml"))
   for r in d["changes"]:
       p=r["pm_notes"]; assert p, r["ref"]; assert os.path.isfile(p), (r["ref"], p)
   print("change rows cited")
   PY
   ```
3. For every `ci_observations[]` and `false_signal_incidents[]` entry, assert `artifact` exists and `anchor` resolves inside it. Resolution rule:
   - anchor matches `^[a-z_]+(\.[a-z_0-9]+)+$` → assert the YAML field path exists in that file;
   - anchor starts with `#` or matches a heading-like title → assert the heading/derived slug exists;
   - otherwise → assert a fixed-string match (`rg -F -- "$anchor" "$artifact"`).
   Record any anchor using a third form so the reviewer can confirm the anchor's meaning.
4. Recompute and record the citation inventory: metric rows, total `sources` entries, change rows, observation rows, incident rows, unresolved anchors (must be 0).
5. Reviewer semantic check: each metric's `sources` names the concrete locator(s) that produce its numbers (pm-notes phase fields, evidence files, exact git commands), not a generic prose reference. Flag any number whose producing source is unnamed.

**Expected Outcome**:

- 100% of metric rows carry concrete sources; every cited path exists; every observation/incident anchor resolves.
- 0 uncited numbers, 0 unresolved anchors; the inventory counts recorded in §10.

#### TC-MEAS-004 - Cited sources exist at `source_commit`; source hygiene

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, C-5, C-7, NFR-1, AC-F4-2, NG-6
**Test Type(s)**: Content / assertion
**Automation Level**: Semi-automated
**Target Layer / Location**: `source_commit` vs every cited path
**Tags**: @measurement, @traceability, @source-hygiene

**Preconditions**:

- `SRC` extracted in TC-MEAS-001.

**Steps**:

1. Build the cited-path list and assert every path exists at `source_commit`:
   ```bash
   python3 - <<'PY' > /tmp/cited_paths.txt
   import yaml
   d=yaml.safe_load(open("doc/planning/oss-tooling/measurement-baseline.yaml"))
   paths={r["pm_notes"] for r in d["changes"] if r["pm_notes"]}
   for r in d["changes"]:
       for o in r.get("ci_observations") or []: paths.add(o["artifact"])
       for i in r.get("false_signal_incidents") or []: paths.add(i["artifact"])
   print("\n".join(sorted(paths)))
   PY
   SRC=$(python3 -c 'import yaml;print(yaml.safe_load(open("doc/planning/oss-tooling/measurement-baseline.yaml"))["source_commit"])')
   while IFS= read -r p; do git cat-file -e "${SRC}:${p}" 2>/dev/null || echo "MISSING-AT-SOURCE: $p"; done < /tmp/cited_paths.txt
   ```
   Expected: no `MISSING-AT-SOURCE` lines.
2. Assert cited historical artifacts were not rewritten by this branch (only GH-186's own artifacts may change):
   ```bash
   while IFS= read -r p; do
     git diff --quiet "$SRC" HEAD -- "$p" || echo "CHANGED-SINCE-SOURCE: $p"
   done < /tmp/cited_paths.txt
   ```
   Any `CHANGED-SINCE-SOURCE` line must name a GH-186 artifact; a changed baseline-evidence path is a defect (NG-6).
3. Assert no source locator points at a forbidden source:
   ```bash
   rg -n 'tmp/|\.ai/local/|https?://' doc/planning/oss-tooling/measurement-baseline.yaml ; echo "forbidden-source-exit=$?"   # expect 1
   ```
   Public PR/issue numbers as incident identifiers are allowed; external URLs as measurement sources are not.
4. Assert every git-command locator is an exact runnable command (starts with `git `) and references the pinned window/commit as applicable.
5. Record counts: cited paths, missing at source (must be 0), changed since source (must be 0 or GH-186-only).

**Expected Outcome**:

- Every cited path exists at `source_commit`; no baseline evidence rewritten; zero `tmp/**`, `.ai/local/**` or URL measurement sources.
- The log is committed under `doc/planning/oss-tooling/` and tracked (C-7).

#### TC-MEAS-005 - Window, capture-change exclusion, corpus normalization, date-only/placeholder counting, closed vocabulary

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, DM-2, C-5, NFR-4, NFR-7, AC-F4-1, AC-F4-3, AC-F4-5, DEC-11, DEC-14
**Test Type(s)**: Contract / assertion
**Automation Level**: Automated
**Target Layer / Location**: `window`, `changes[]`, `sample` counts, per-change phase-pair counters
**Tags**: @measurement, @window, @exclusions, @normalization

**Preconditions**:

- Log present; `BASE` and `SRC` recorded (TC-MEAS-001).
- A YAML parser is available (PyYAML, `yq`, or `bun` + `yaml`).

**Steps**:

1. Assert the window is exact:
   ```bash
   python3 -c 'import yaml;w=yaml.safe_load(open("doc/planning/oss-tooling/measurement-baseline.yaml"))["window"];print(w);assert w["start"]=="2026-02-01T00:00:00Z";assert w["end"]=="2026-10-31T23:59:59Z";assert w.get("basis")'
   ```
2. Assert GH-186 is present once as an excluded row with the capture-change reason:
   ```bash
   python3 - <<'PY'
   import yaml
   d=yaml.safe_load(open("doc/planning/oss-tooling/measurement-baseline.yaml"))
   rows=[r for r in d["changes"] if r["ref"]=="GH-186"]
   assert len(rows)==1, rows
   assert rows[0]["included"] is False and rows[0]["excluded_reason"]=="capture_change", rows[0]
   print("GH-186 excluded as capture_change")
   PY
   ```
3. Assert every excluded change carries exactly one reason from the closed change-row vocabulary — `unparseable_yaml`, `date_only_or_missing_time`, `placeholder_zero_time`, `capture_change`, `outside_window` — that an included row has `excluded_reason: null`, and that `no_ci_observation` never appears as a change-row reason (it is a CI-sample reason only):
   ```bash
   python3 - <<'PY'
   import yaml
   VOCAB={"unparseable_yaml","date_only_or_missing_time","placeholder_zero_time","capture_change","outside_window"}
   d=yaml.safe_load(open("doc/planning/oss-tooling/measurement-baseline.yaml"))
   for r in d["changes"]:
       if r["included"]:
           assert r["excluded_reason"] is None, (r["ref"], r["excluded_reason"])
       else:
           assert r["excluded_reason"] in VOCAB, (r["ref"], r["excluded_reason"])
   assert all(r["excluded_reason"]!="no_ci_observation" for r in d["changes"])
   print("closed change-row vocabulary ok")
   PY
   ```
4. Assert the `changes` spine is exactly one row per committed `chg-*-pm-notes.yaml` file at `source_commit` (including the unparseable file), then assert the sample arithmetic per metric:
   ```bash
   SRC=$(python3 -c 'import yaml;print(yaml.safe_load(open("doc/planning/oss-tooling/measurement-baseline.yaml"))["source_commit"])')
   git ls-tree -r --name-only "$SRC" -- doc/changes | rg 'chg-.*-pm-notes\.yaml$' | sort > /tmp/corpus.pm
   python3 - <<'PY' > /tmp/spine.pm
   import yaml
   d=yaml.safe_load(open("doc/planning/oss-tooling/measurement-baseline.yaml"))
   print("\n".join(sorted(r["pm_notes"] for r in d["changes"])))
   PY
   diff -u /tmp/corpus.pm /tmp/spine.pm
   ```
   ```bash
   python3 - <<'PY'
   import yaml
   d=yaml.safe_load(open("doc/planning/oss-tooling/measurement-baseline.yaml"))
   assert len(d["changes"])==len({r["pm_notes"] for r in d["changes"]})
   included=[r for r in d["changes"] if r["included"]]
   for m in d["metrics"]:
       s=m["sample"]
       assert s["changes_parsed"]==len(d["changes"]), m["id"]
       assert s["changes_excluded"]==sum(1 for r in d["changes"] if not r["included"]), m["id"]
       assert s["changes_parsed"]==s["changes_included"]+s["changes_excluded"], m["id"]
       if m["id"]=="MET-CI-FAILURE-RATE":
           observed=[r for r in included if r["ci_observed"] is True]
           assert s["changes_included"]==len(observed), m["id"]
           assert s["excluded_unobserved"]==len(included)-len(observed), m["id"]
       else:
           assert s["changes_included"]==len(included), m["id"]
   gh171=[r for r in d["changes"] if r["pm_notes"].endswith("chg-GH-171-pm-notes.yaml")]
   assert len(gh171)==1, gh171
   assert gh171[0]["included"] is False and gh171[0]["excluded_reason"]=="unparseable_yaml", gh171[0]
   print("spine and sample arithmetic ok")
   PY
   ```
   The CI metric's sample is the observed subset (`changes_included` = denominator, `excluded_unobserved` = included-but-unobserved); the other metrics use all included rows. The log must state the metric-specific sample rule in its `definition`/`limitation` (TC-MEAS-008 cross-checks the CI row).
5. Assert per-change phase-pair counters recompute from the cited pm-notes **after the DEC-14 normalization** (YAML-native `datetime` → ISO-8601 time, YAML-native `date` → date-only, `00:00:00` → placeholder). Classification order: a pair with any date-only endpoint counts in `date_only_pairs_excluded`; else a pair with any null/missing endpoint **or placeholder zero-time endpoint** counts in `phase_pairs_excluded`; else it is included:
   ```bash
   python3 - <<'PY'
   import yaml,re,datetime as dt
   CER=["clarify_scope","specification","test_planning","delivery_planning","dor_check","dod_check","pr_creation"]
   WRK=["delivery","system_spec_update","review_fix","quality_gates"]; ALL=CER+WRK
   def kind(v):
       if isinstance(v,dt.datetime):
           return "time" if (v.hour,v.minute,v.second)!=(0,0,0) else "zero"
       if isinstance(v,dt.date):
           return "date"
       if isinstance(v,str):
           s=v.strip()
           if not s: return "null"
           if re.fullmatch(r"\d{4}-\d{2}-\d{2}", s): return "date"
           if re.search(r"T\d{2}:\d{2}", s): return "zero" if re.search(r"T00:00:00", s) else "time"
       return "null"
   d=yaml.safe_load(open("doc/planning/oss-tooling/measurement-baseline.yaml"))
   for r in d["changes"]:
       if not r["included"]: continue
       ph=(yaml.safe_load(open(r["pm_notes"])).get("phases") or {})
       inc=exc=donly=0
       for p in ALL:
           s=kind((ph.get(p) or {}).get("started")); c=kind((ph.get(p) or {}).get("completed"))
           if s=="date" or c=="date": donly+=1
           elif s=="time" and c=="time": inc+=1
           else: exc+=1   # null/missing or placeholder zero-time endpoint
       assert (inc,exc,donly)==(r["phase_pairs_included"],r["phase_pairs_excluded"],r["date_only_pairs_excluded"]), (r["ref"],inc,exc,donly)
       assert inc+exc+donly==len(ALL), (r["ref"], inc, exc, donly)
   print("phase-pair counts ok after normalization")
   PY
   ```
6. Assert each metric `sample`'s phase-pair totals equal the sums over its included change rows.
7. **Census cross-check (spec-time observation, re-derived at `source_commit`).** Re-run the Appendix A command from the spec at `source_commit` and reconcile it with the delivered spine. For orientation only, the spec-time observation at HEAD `5a511f4bec4ce2a2fff6e3248b88ecafed34a2ca` is: **41 files, 40 parseable, 30 time-bearing, 24 real-time, 10 date-only, 1 unparseable, 6 placeholder-only (GH-57, GH-67, GH-69, GH-71, GH-72, GH-174)**; after excluding the capture change GH-186, **23 changes enter the time-metric corpus**. These are spec-time observations, not baseline values: assert the log's spine and `sample` counts reconcile with the re-derived census at `SRC`, do not copy the spec-time numbers into the log, and do not treat a different delivery-time count as a defect without recording the delta and its cause.

**Expected Outcome**:

- Window strings exactly as pinned; GH-186 excluded as `capture_change`; every excluded change carries exactly one reason from the closed vocabulary; `no_ci_observation` is never a change-row reason.
- The `changes` spine covers 100% of the committed pm-notes corpus at `source_commit`, including GH-171 as its own `unparseable_yaml` row counted in `changes_excluded`, never silently dropped or zero-filled.
- All sample counters recompute from the cited sources after normalization; date-only and placeholder zero-time pairs are counted, not silently dropped.

**Notes / Clarifications**:

- DEC-14 is the normative rule: parse each file as one YAML document, normalize YAML-native scalars to ISO-8601 before classification, and treat a `00:00:00` time as a placeholder. Pair precedence is date-only first, then null/missing/placeholder; change-row precedence is `unparseable_yaml` → `capture_change` → `outside_window` → `placeholder_zero_time` → `date_only_or_missing_time`.
- The six placeholder-only pm-notes (GH-57, GH-67, GH-69, GH-71, GH-72, GH-174) carry only date-plus-midnight values. Under the change-row precedence they are `placeholder_zero_time` (time-bearing endpoints exist but all are placeholders) and are counted; a fake zero-hour duration is a defect.
- The unparseable-file precedent is `tests/fixtures/pm-notes/corpus-exclusions.json`; the baseline mirrors it with `unparseable_yaml` and does not edit the manifest.
- If a delivery-time census differs from the spec-time observation, the log must record the re-derived count and the reason; the counters must still conserve (`included + excluded + date_only == 11` per included row, `changes_parsed == changes_included + changes_excluded` per metric). A non-conserving total is a defect.

#### TC-MEAS-006 - Ceremony share recomputes exactly

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, NFR-7, AC-F4-3, DEC-14
**Test Type(s)**: Contract / recompute
**Automation Level**: Automated (reference procedure)
**Target Layer / Location**: `metrics[MET-CEREMONY-SHARE]`, `changes[*].ceremony_duration_h`, `changes[*].total_phase_duration_h`
**Tags**: @measurement, @recompute, @ceremony

**Preconditions**:

- TC-MEAS-002/TC-MEAS-005 passed; parser and cited pm-notes available.

**Steps**:

1. Apply representation rule **R-1** (canonical ratio 0–1; percent derived, not stored) and rounding rule **Q-1** from §6 (Decimal arithmetic, `ROUND_HALF_UP`, no float equality), as pinned by OQ-T3.
2. Recompute each included change row's durations from its cited pm-notes (ceremony set and all-eleven-phase total). The `ts()` helper implements **N-1**: it accepts YAML-native `datetime` values (usable only when the time component is nonzero), treats YAML-native `date` values as date-only, accepts ISO-8601 strings with a nonzero time, and returns `None` for missing/placeholder endpoints:
   ```bash
   python3 - <<'PY'
   import yaml
   from datetime import datetime
   from decimal import Decimal, ROUND_HALF_UP
   CER=["clarify_scope","specification","test_planning","delivery_planning","dor_check","dod_check","pr_creation"]
   ALL=CER+["delivery","system_spec_update","review_fix","quality_gates"]
   def q(x,dp=1): return Decimal(str(x)).quantize(Decimal(1).scaleb(-dp), rounding=ROUND_HALF_UP)
   def ts(v):
       import re, datetime as _d
       if isinstance(v,_d.datetime):
           return v if (v.hour,v.minute,v.second)!=(0,0,0) else None
       if isinstance(v,_d.date):
           return None
       if isinstance(v,str):
           s=v.strip()
           if not re.search(r"T\d{2}:\d{2}",s) or re.search(r"T00:00:00",s): return None
           return datetime.fromisoformat(s.replace("Z","+00:00"))
       return None
   def h(a,b): return (b-a).total_seconds()/3600.0
   d=yaml.safe_load(open("doc/planning/oss-tooling/measurement-baseline.yaml"))
   num=den=0.0
   for r in d["changes"]:
       if not r["included"]: continue
       ph=yaml.safe_load(open(r["pm_notes"])).get("phases") or {}
       def dur(p):
           a=ts((ph.get(p) or {}).get("started")); b=ts((ph.get(p) or {}).get("completed"))
           return h(a,b) if a and b else 0.0
       cer=sum(dur(p) for p in CER); tot=sum(dur(p) for p in ALL)
       assert q(cer)==Decimal(str(r["ceremony_duration_h"])), (r["ref"],"cer",cer,r["ceremony_duration_h"])
       assert q(tot)==Decimal(str(r["total_phase_duration_h"])), (r["ref"],"tot",tot,r["total_phase_duration_h"])
       num+=cer; den+=tot
   m=[x for x in d["metrics"] if x["id"]=="MET-CEREMONY-SHARE"][0]
   val=Decimal(str(m["value"])); dp=max(0,-val.as_tuple().exponent)
   ratio=Decimal(str(num))/Decimal(str(den))
   print("recomputed ratio", ratio, "recorded", val, "numerator", m["numerator"], "denominator", m["denominator"])
   assert m["unit"]=="ratio"
   assert 0 <= val <= 1
   assert q(ratio,dp)==val, (ratio, val)
   derived=q(val*100)   # percent derived from the canonical value, 1 decimal, never stored
   assert 0 <= derived <= 100
   assert not any(k in m for k in ("percent","percent_value","value_percent"))
   PY
   ```
3. Assert the recorded `numerator`/`denominator` reproduce the same ratio under R-1 (`q(numerator/denominator, dp) == value`) when they are durations; if the row represents them differently, the row's `formula` must say so and the value check still holds.
4. Assert the inclusion rule is stated: the ceremony/work phase lists (or an equivalent explicit enumeration) appear in `definition`/`formula`, and `sample` reports the change and phase-pair counts used.
5. Assert the duration-share caveat is stated: the `limitation` must say overlapping phases count in both numerator and denominator (not a wall-clock union).
6. Record per-row recomputed vs recorded values for all included changes (or a checksum plus the exact-match count) in §10.

**Expected Outcome**:

- Every per-change duration and the aggregate ratio reproduce exactly at the recorded precision (0 tolerance); the canonical `value` is a 0–1 ratio, and the percent is derived from it (1 decimal) rather than stored.
- The phase sets, formula and duration-share limitation are stated; `sample` supports the denominator.

#### TC-MEAS-007 - Cycle time recomputes exactly, incl. censoring and aggregates

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, NFR-7, AC-F4-3, AC-F4-5, DEC-14
**Test Type(s)**: Contract / recompute
**Automation Level**: Automated (reference procedure)
**Target Layer / Location**: `metrics[MET-CYCLE-TIME]`, `changes[*].cycle_time_h`
**Tags**: @measurement, @recompute, @cycle-time

**Preconditions**:

- TC-MEAS-002 passed.

**Steps**:

1. Recompute each row's cycle time per the spec formula: `pr_creation.completed − clarify_scope.started` in hours, 1 decimal. If `pr_creation.completed` is absent, use the latest completed phase and require `cycle_time_censored: true`:
   ```bash
   python3 - <<'PY'
   import yaml, statistics
   from datetime import datetime
   from decimal import Decimal, ROUND_HALF_UP
   def q(x,dp=1): return Decimal(str(x)).quantize(Decimal(1).scaleb(-dp), rounding=ROUND_HALF_UP)
   def ts(v):
       import re, datetime as _d
       if isinstance(v,_d.datetime):
           return v if (v.hour,v.minute,v.second)!=(0,0,0) else None
       if isinstance(v,_d.date):
           return None
       if isinstance(v,str):
           s=v.strip()
           if not re.search(r"T\d{2}:\d{2}",s) or re.search(r"T00:00:00",s): return None
           return datetime.fromisoformat(s.replace("Z","+00:00"))
       return None
   d=yaml.safe_load(open("doc/planning/oss-tooling/measurement-baseline.yaml"))
   vals=[]
   for r in d["changes"]:
       if not r["included"]: continue   # exclude GH-186 (capture_change) and every other excluded/out-of-window row
       ph=yaml.safe_load(open(r["pm_notes"])).get("phases") or {}
       start=ts((ph.get("clarify_scope") or {}).get("started"))
       if start is None: continue
       end=ts((ph.get("pr_creation") or {}).get("completed"))
       censored = end is None
       if censored:
           ends=[ts((ph.get(p) or {}).get("completed")) for p in ph]
           ends=[e for e in ends if e]
           if not ends: continue
           end=max(ends)
       assert bool(r["cycle_time_censored"])==censored, r["ref"]
       h=(end-start).total_seconds()/3600.0
       assert q(h)==Decimal(str(r["cycle_time_h"])), (r["ref"],h,r["cycle_time_h"])
       vals.append(h)
   m=[x for x in d["metrics"] if x["id"]=="MET-CYCLE-TIME"][0]
   assert all(r["ref"]!="GH-186" for r in d["changes"] if r["included"])
   print("n", len(vals), "logged-included", m["sample"]["changes_included"])
   assert q(statistics.median(vals))==Decimal(str(m["aggregates"]["median_h"]))
   assert q(min(vals))==Decimal(str(m["aggregates"]["min_h"]))
   assert q(max(vals))==Decimal(str(m["aggregates"]["max_h"]))
   PY
   ```
   Note: `changes_included` for the cycle metric must equal the count of **included** rows whose `clarify_scope.started` is present (the metric's stated data condition); GH-186 and every other `included: false` row are excluded before the sample is built. If the row records a different n, the discrepancy must be explained by a stated exclusion reason.
2. Assert the **pinned p90 rule** (OQ-T2): when `len(vals) < 10`, `aggregates.p90_h` must be absent/`null` and no p90 claimed; when `len(vals) >= 10`, `p90_h` must be present and equal to the **nearest-rank** value — sort ascending and take the `ceil(0.9 × n)`-th smallest (1-indexed), with no interpolation:
   ```bash
   python3 - <<'PY'
   import math, re, yaml
   from datetime import datetime
   from decimal import Decimal, ROUND_HALF_UP
   def q(x,dp=1): return Decimal(str(x)).quantize(Decimal(1).scaleb(-dp), rounding=ROUND_HALF_UP)
   def ts(v):
       import datetime as _d
       if isinstance(v,_d.datetime):
           return v if (v.hour,v.minute,v.second)!=(0,0,0) else None
       if isinstance(v,_d.date):
           return None
       if isinstance(v,str):
           s=v.strip()
           if not re.search(r"T\d{2}:\d{2}",s) or re.search(r"T00:00:00",s): return None
           return datetime.fromisoformat(s.replace("Z","+00:00"))
       return None
   d=yaml.safe_load(open("doc/planning/oss-tooling/measurement-baseline.yaml"))
   m=[x for x in d["metrics"] if x["id"]=="MET-CYCLE-TIME"][0]
   vals=[]
   for r in d["changes"]:
       if not r["included"]: continue
       ph=yaml.safe_load(open(r["pm_notes"])).get("phases") or {}
       start=ts((ph.get("clarify_scope") or {}).get("started"))
       if start is None: continue
       end=ts((ph.get("pr_creation") or {}).get("completed"))
       if end is None:
           ends=[ts((ph.get(p) or {}).get("completed")) for p in ph]
           ends=[e for e in ends if e]
           if not ends: continue
           end=max(ends)
       vals.append((end-start).total_seconds()/3600.0)
   if len(vals) < 10:
       assert m["aggregates"].get("p90_h") in (None, ""), m["aggregates"]
       print("p90 suppressed for n", len(vals))
   else:
       ordered=sorted(vals); rank=math.ceil(0.9*len(ordered)); expected=ordered[rank-1]
       recorded=m["aggregates"]["p90_h"]
       dp=max(0,-Decimal(str(recorded)).as_tuple().exponent)
       assert q(expected,dp)==Decimal(str(recorded)), (expected, recorded)
       print("p90 nearest-rank ok", rank, expected)
   PY
   ```
   The log must also state the nearest-rank method (or an equivalent formula) in `comparison_note`/`limitation`/`definition`.
3. Assert right-censored samples are counted, not silently excluded: censored rows appear in the sample, and `limitation`/`comparison_note` mentions right-censoring.
4. Assert the metric states the self-reported-timestamp/clock-skew limitation and that it measures elapsed time, not effort.
5. Record `n`, the recomputed aggregates, and the censored count in §10.

**Expected Outcome**:

- Every row's cycle time and all aggregates reproduce exactly; censoring flags match the sources; p90 obeys the n≥10 rule and the pinned nearest-rank method (`ceil(0.9 × n)`-th smallest, no interpolation).
- The sample is built from `included: true` rows only, so GH-186 (`capture_change`) and every other excluded/out-of-window row are absent from `vals` and from the aggregates.
- Limitations (self-reported timestamps, clock skew, elapsed-not-effort) are stated.

**Notes / Clarifications**:

- `vals` is recomputed from the cited pm-notes, not from the log's own `cycle_time_h`, so a correlated error cannot pass; the log's row values are then compared as a second assertion.
- The `included` filter in step 1 is the B3 fix: without it, GH-186's timestamped `clarify_scope.started` and any out-of-window row would be over-counted while the log correctly excludes them. Step 2 already applies the same filter.

#### TC-MEAS-008 - CI failure rate recomputes exactly (session proxy)

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, NFR-7, AC-F4-3, AC-F4-4, RSK-3
**Test Type(s)**: Contract / recompute
**Automation Level**: Automated (reference procedure)
**Target Layer / Location**: `metrics[MET-CI-FAILURE-RATE]`, `changes[*].ci_observed/ci_outcome/ci_observations`
**Tags**: @measurement, @recompute, @ci-proxy

**Preconditions**:

- TC-MEAS-002/TC-MEAS-003 passed; observation artifacts and anchors resolve.

**Steps**:

1. Recompute numerator/denominator from the change rows only, and assert the canonical ratio representation (OQ-T3):
   ```bash
   python3 - <<'PY'
   import yaml
   from decimal import Decimal, ROUND_HALF_UP
   def q(x,dp=1): return Decimal(str(x)).quantize(Decimal(1).scaleb(-dp), rounding=ROUND_HALF_UP)
   d=yaml.safe_load(open("doc/planning/oss-tooling/measurement-baseline.yaml"))
   m=[x for x in d["metrics"] if x["id"]=="MET-CI-FAILURE-RATE"][0]
   inc=[r for r in d["changes"] if r["included"]]
   observed=[r for r in inc if r["ci_observed"] is True]
   unobserved=[r for r in inc if r["ci_observed"] is not True]
   num=len([r for r in observed if r["ci_outcome"] in {"red","mixed"}]); den=len(observed)
   assert (m["numerator"],m["denominator"])==(num,den), (m["numerator"],m["denominator"],num,den)
   assert num<=den and den>0
   val=Decimal(str(m["value"])); dp=max(0,-val.as_tuple().exponent)
   ratio=Decimal(num)/Decimal(den)
   assert m["unit"]=="ratio"
   assert 0 <= val <= 1
   assert q(ratio,dp)==val, (val, ratio)
   derived=q(val*100)   # percent derived from the canonical value, 1 decimal, never stored
   assert 0 <= derived <= 100
   assert not any(k in m for k in ("percent","percent_value","value_percent"))
   assert m["sample"]["excluded_unobserved"]==len(unobserved)
   assert m["sample"]["changes_included"]==den
   print("ci proxy ok", num, den, val)
   PY
   ```
2. Assert the proxy contract: `measurement_kind == "session_proxy"`; `limitation` names the absent committed run log and states the metric is not a per-run/per-check rate and that unobserved changes are excluded, never assumed green:
   ```bash
   rg -n 'session_proxy|run log|per-run|per-check|not assumed green|unobserved' \
     doc/planning/oss-tooling/measurement-baseline.yaml
   ```
3. Verify a non-empty sample of observation rows against their cited artifacts: for each observation row, the artifact contains the `outcome`/`anchor` evidence (fixed-string or field-path resolution per TC-MEAS-003 step 3). Flag any row whose cited artifact does not contain the claimed outcome.
4. Assert no row claims a green outcome without an observation artifact, and no unobserved row is counted in the denominator.
5. Assert no denominator is asserted without a `sample` block and an inclusion rule (the rule may be prose in `formula`/`limitation` but must be present).

**Expected Outcome**:

- numerator/denominator and the canonical 0–1 ratio reproduce exactly from the change rows; `denominator > 0` and fully supported by observations.
- The percent is derived from the canonical value (1 decimal) and not stored; the metric is labelled `session_proxy` with the missing-run-log limitation; no per-run claim and no green-by-default.

#### TC-MEAS-009 - False-signal incident count recomputes exactly per class

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, NFR-7, AC-F4-3, AC-F4-4
**Test Type(s)**: Contract / recompute
**Automation Level**: Automated (reference procedure)
**Target Layer / Location**: `metrics[MET-FALSE-SIGNAL-INCIDENTS]`, `changes[*].false_signal_incidents[]`
**Tags**: @measurement, @recompute, @false-signal

**Preconditions**:

- TC-MEAS-003 passed (incident anchors resolve).

**Steps**:

1. Assert the five pinned classes are used and no others: `local-green-ci-red`, `false-success-exit-zero`, `skipped-read-as-green`, `green-gate-later-failed`, `lying-liveness`.
2. Recompute the total and per-class counts from the incident rows:
   ```bash
   python3 - <<'PY'
   import yaml, collections
   CLASSES=["local-green-ci-red","false-success-exit-zero","skipped-read-as-green","green-gate-later-failed","lying-liveness"]
   d=yaml.safe_load(open("doc/planning/oss-tooling/measurement-baseline.yaml"))
   m=[x for x in d["metrics"] if x["id"]=="MET-FALSE-SIGNAL-INCIDENTS"][0]
   rows=[i for r in d["changes"] if r["included"] for i in (r["false_signal_incidents"] or [])]
   per=collections.Counter(i["class"] for i in rows)
   assert set(per) <= set(CLASSES), set(per)-set(CLASSES)
   assert m["value"]==len(rows), (m["value"], len(rows))
   recorded={k:v for k,v in (m.get("aggregates") or {}).items() if k in CLASSES}
   print("total", m["value"], "per-class", dict(per), "recorded-classes", recorded)
   PY
   ```
   The per-class counts must be recorded in the metric row in one of the schema-legal places (e.g. an explicit per-class breakdown object); if the row stores them under another key, the reviewer verifies the same numbers appear there. Zero-valued classes must be present as `0`, not omitted.
3. Assert `sum(per-class counts) == total` and that every incident row is distinct under the collapse rule (one row per distinct incident or root cause; one root cause affecting multiple checks is one row with `checks_affected`). Duplicate `(artifact, anchor, class)` triples are a defect.
4. Assert each row states `signal` vs `reality` in one short fact and names the affected checks; assert no row reproduces private literals or full log bodies (spec §20).
5. Assert the GH-179 corpus-vs-rule defect is explicitly excluded as "not a delivery-signal lie" (in `limitation`/notes) and that no incident row attributes a delivery-signal contradiction to it.
6. Assert the count is described as a curated floor, not a census (limitation present).

**Expected Outcome**:

- total and all five per-class counts reproduce exactly; zero-valued classes present as `0`; no duplicate incident rows.
- Each incident cites artifact + anchor with a one-fact signal/reality pair; the GH-179 exclusion and floor caveat are stated.

#### TC-MEAS-010 - MEASURED / PARTIAL / UNAVAILABLE semantics honoured

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-4, C-5, AC-F4-4, RSK-2
**Test Type(s)**: Contract / assertion
**Automation Level**: Automated + review
**Target Layer / Location**: Every `metric-row.status`
**Tags**: @measurement, @status-semantics

**Preconditions**:

- TC-MEAS-002 passed.

**Steps**:

1. Assert the status vocabulary is exactly `MEASURED`/`PARTIAL`/`UNAVAILABLE` for every metric row; no other value:
   ```bash
   python3 -c 'import yaml;d=yaml.safe_load(open("doc/planning/oss-tooling/measurement-baseline.yaml"));s={m["status"] for m in d["metrics"]};print(s);assert s<= {"MEASURED","PARTIAL","UNAVAILABLE"}'
   ```
2. Apply the status matrix:
   - `UNAVAILABLE` ⇒ `value is None` **and** `missing_source` is a non-empty string naming the absent source **and** `limitation` explains why.
   - `PARTIAL` ⇒ `value` is non-null, sample counts reported, and the excluded/limited part stated in `limitation` (not presented as complete).
   - `MEASURED` ⇒ `value` is non-null, coverage complete for the definition, `missing_source` absent/`null`.
   - A **time metric** (`MET-CEREMONY-SHARE`, `MET-CYCLE-TIME`) whose corpus contains an `unparseable_yaml` or `placeholder_zero_time` change cannot be `MEASURED`; it must be `PARTIAL` and report the excluded count. Assert zero time metrics are `MEASURED` over such a corpus (spec KPI).
3. Assert no zero/absent denominator is reported as a measured `0`: `denominator == 0` (or null) must force `UNAVAILABLE` (or a non-numeric status), never `value: 0`.
4. Assert no estimate-shaped numeric fields exist:
   ```bash
   rg -n 'estimate|interpolat|assum(ed|ption_value)|proxy_value' doc/planning/oss-tooling/measurement-baseline.yaml ; echo "estimate-exit=$?"   # hits must be explanatory text only
   ```
5. Assert the CI metric's `measurement_kind` is `session_proxy` and its `limitation` explicitly names the absent committed CI run log.
6. Assert the top-level `status` does not overstate coverage: if any metric row is `PARTIAL`/`UNAVAILABLE`, the top-level status/limitation must not claim a complete baseline (review confirmation recorded in §10).

**Expected Outcome**:

- Every metric satisfies the matrix for its status; `UNAVAILABLE` always carries `missing_source` with `value: null`; `PARTIAL` always carries counts and a limitation.
- Zero estimates, zero invented denominators, zero complete-coverage claims for incomplete samples.

#### TC-MEAS-011 - Comparison protocol and baseline immutability stated

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-4, AC-F4-5, NFR-7, RSK-7, NG-9
**Test Type(s)**: Content
**Automation Level**: Manual (grep-assisted)
**Target Layer / Location**: `comparison_protocol`, metric `comparison_note`, `doc/spec/features/feature-measurement-baseline.md`
**Tags**: @measurement, @comparison-protocol

**Preconditions**:

- The log and the new feature spec exist.

**Steps**:

1. Assert the log's `comparison_protocol` states all four rules: (a) same metric ID **and definition**; (b) an **equal-length window**; (c) a definition change allocates a **new `MET-` ID** with a supersession note rather than mutating the baseline; (d) committed values are **immutable** — a new baseline is appended, not edited:
   ```bash
   python3 -c 'import yaml;print(yaml.safe_load(open("doc/planning/oss-tooling/measurement-baseline.yaml"))["comparison_protocol"])'
   rg -n -i 'same definition|equal|supersed|immutable|append' doc/planning/oss-tooling/measurement-baseline.yaml
   ```
2. Assert the protocol (or the metric rows) pins the three conventions a later comparison must reuse (OQ-T2/T3/T4): ratio metrics store a 0–1 `value` and derive percent; `p90_h` uses the nearest-rank `ceil(0.9 × n)`-th smallest method; the top-level `change` has the DM-2 mapping shape:
   ```bash
   rg -n -i 'nearest.rank|ceil\(0\.9|no interpolation|ratio|derived|percent' \
     doc/planning/oss-tooling/measurement-baseline.yaml
   python3 - <<'PY'
   import yaml
   d=yaml.safe_load(open("doc/planning/oss-tooling/measurement-baseline.yaml"))
   assert isinstance(d["change"], dict)
   assert {"ref","tracker","excluded_from_samples"} <= set(d["change"])
   print("change mapping present")
   PY
   ```
3. Assert comparisons carry the proxy caveat: the metric ID and definition version travel with the number so a proxy is never compared to a native measurement without the caveat.
4. Assert each metric row's `comparison_note` key exists (value may be short) and `schema_version` is present and integer (TC-MEAS-001 step 4).
5. Assert the new feature spec points to the log as **canonical data** and describes the same protocol without restating values (TC-SYNC-002 step 4 cross-checks values):
   ```bash
   rg -n -i 'canonical|comparison|supersed|equal|immutable|nearest|ratio' doc/spec/features/feature-measurement-baseline.md
   ```
6. Assert the log is **added**, not modified in place:
   ```bash
   git diff --name-status "$BASE"...HEAD -- doc/planning/oss-tooling/measurement-baseline.yaml   # expect A
   ```

**Expected Outcome**:

- The four protocol rules, the proxy caveat, and the three pinned conventions (ratio 0–1 with derived percent, nearest-rank p90, DM-2 `change` mapping) are stated in the log and the feature spec.
- The log is added (not modified in place); no pre-existing baseline value exists to mutate.

#### TC-SYNC-001 - `feature-decision-records.md` gains register + ID-scheme pointers

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, DM-1, AC-F6-1
**Test Type(s)**: Content
**Automation Level**: Manual (grep-assisted)
**Target Layer / Location**: `doc/spec/features/feature-decision-records.md`
**Tags**: @docs, @current-truth, @decisions

**Preconditions**:

- Phase-7 edits present.

**Steps**:

1. Assert the register appears in the component map with a resolvable link:
   ```bash
   rg -n '00-register\.md|foundational (decision )?register' doc/spec/features/feature-decision-records.md
   ```
2. Assert the ID-scheme pointer names ODR-0002 and the catalog concept:
   ```bash
   rg -n 'ODR-0002|id-prefix-catalog' doc/spec/features/feature-decision-records.md
   ```
3. Assert `links` is updated: `related_changes` contains `GH-186`, and `related_decisions`/equivalent includes the new decisions as applicable:
   ```bash
   awk 'NR==1&&/^---$/{f=1;next} f&&/^---$/{exit} f' doc/spec/features/feature-decision-records.md \
     | rg -n 'GH-186|ADR-0008|ADR-0009|ODR-0002|ODR-0003'
   ```
4. Confirm the edit is additive/bounded (component-map row + links); existing sections are not rewritten. Review the diff.

**Expected Outcome**:

- The register and the ODR-0002 ID scheme are discoverable from the decision-records current truth; links are updated.
- No unrelated rewrite of the spec.

#### TC-SYNC-002 - `feature-measurement-baseline.md` states the contract, not values

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, DM-2, NFR-2, AC-F6-1, RSK-9
**Test Type(s)**: Content
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/spec/features/feature-measurement-baseline.md`
**Tags**: @docs, @current-truth, @measurement

**Preconditions**:

- The file exists (`test -f doc/spec/features/feature-measurement-baseline.md`).

**Steps**:

1. Assert the front matter carries a spec `id` (`SPEC-*`), `status: Current`, `created`, `last_updated`, `owners`, `summary`, `ados_distribution: internal`, and `links` (including `related_changes` with `GH-186`), consistent with sibling feature specs:
   ```bash
   awk 'NR==1 && /^---$/{f=1;next} f && /^---$/{exit} f' doc/spec/features/feature-measurement-baseline.md \
     | rg '^(id|status|created|last_updated|owners|summary|ados_distribution):'
   awk 'NR==1 && /^---$/{f=1;next} f && /^---$/{exit} f' doc/spec/features/feature-measurement-baseline.md \
     | rg '^ados_distribution: internal$'
   ```
2. Assert the document follows `doc/templates/feature-spec-template.md` section order (1 Overview … 8 Dependencies & Risks) and leaves no placeholders:
   ```bash
   rg -n '^## [0-9]\.' doc/spec/features/feature-measurement-baseline.md
   rg -n '<[A-Za-z-]+>|TEMPLATE INSTRUCTIONS' doc/spec/features/feature-measurement-baseline.md ; echo "placeholder-exit=$?"   # expect 1
   ```
3. Assert the contract elements are stated: the log path, the schema reference (DM-2 keys / schema version, not a copy of the YAML), the four `MET-` IDs, the status semantics, the source-traceability rule, the window, the comparison protocol, the corpus-ingestion/normalization and closed exclusion vocabulary, and the pinned representation conventions (canonical ratio 0–1 / derived percent, nearest-rank p90, `change` mapping):
   ```bash
   rg -n 'measurement-baseline\.yaml|schema_version|MET-CEREMONY-SHARE|MET-CYCLE-TIME|MET-CI-FAILURE-RATE|MET-FALSE-SIGNAL-INCIDENTS|MEASURED|PARTIAL|UNAVAILABLE|2026-02-01|2026-10-31|unparseable_yaml|date_only_or_missing_time|placeholder_zero_time|capture_change|outside_window|nearest.rank|ratio|derived|change' \
     doc/spec/features/feature-measurement-baseline.md
   ```
4. **Values must not be restated.** Extract every recorded numeric result from the log (metric `value`, `numerator`, `denominator`, `aggregates.*`, sample totals) and grep the feature spec for those literals:
   ```bash
   python3 - <<'PY' > /tmp/log_numbers.txt
   import yaml
   d=yaml.safe_load(open("doc/planning/oss-tooling/measurement-baseline.yaml"))
   out=set()
   for m in d["metrics"]:
       for k in ("value","numerator","denominator"):
           if isinstance(m.get(k),(int,float)): out.add(str(m[k]))
       for v in (m.get("aggregates") or {}).values():
           if isinstance(v,(int,float)): out.add(str(v))
   print("\n".join(sorted(out,key=len,reverse=True)))
   PY
   while IFS= read -r n; do [ -n "$n" ] && rg -nF -- "$n" doc/spec/features/feature-measurement-baseline.md; done < /tmp/log_numbers.txt
   ```
   Any hit must be reviewed: a number used as a **counter-example, a rule threshold, or a schema example** is acceptable; a number presented as the baseline result is a defect (RSK-9). Record the hits and the verdict.
5. Assert the file is new (added, not modified) and does not duplicate the log's `changes:` rows:
   ```bash
   git diff --name-status "$BASE"...HEAD -- doc/spec/features/feature-measurement-baseline.md   # expect A
   rg -c '^\s*-?\s*ref: GH-' doc/spec/features/feature-measurement-baseline.md ; echo "per-change-rows-exit=$?"   # expect 1 or 0
   ```
6. Assert the doc's `registered` entry was added in the same commit that created the doc (AC-F6-1/AC-C10-1); TC-GATE-005 step 3 holds the authoritative history check. Record the add commit here.

**Expected Outcome**:

- The new feature spec is template-conformant, carries `ados_distribution: internal`, states all contract elements (including the corpus-ingestion rule and closed vocabulary), and points to the log as canonical data.
- Its `registered` entry is in the same doc-sync commit that created it, and the spec was not pre-registered.
- Zero baseline result values restated; no per-change data duplicated.

#### TC-SYNC-003 - Glossary, `doc/00-index`, planning README, catalog, primitive and adapter-ports pointers

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: F-6, DM-1, DM-2, DM-3, AC-F6-1
**Test Type(s)**: Content
**Automation Level**: Semi-automated
**Target Layer / Location**: The six remaining phase-7 documents
**Tags**: @docs, @current-truth, @cross-links

**Preconditions**:

- Phase-7 edits present.

**Steps**:

1. **Glossary** (`doc/overview/glossary.md`) — assert the new terms are present in the Terms table (exact term strings from spec §23): `Foundational decision register`, `Measurement baseline log`, `Ceremony share`, `Cycle time`, `False-signal incident`, `Command-name lock`, `MET-`, `UNAVAILABLE`:
   ```bash
   rg -n 'Foundational decision register|Measurement baseline log|Ceremony share|Cycle time|False-signal incident|Command-name lock|\bMET-\b|UNAVAILABLE' \
     doc/overview/glossary.md
   ```
   Do **not** repair the pre-existing duplicated front-matter keys (NG-7); assert only that the new rows were added.
2. **`doc/00-index.md`** — assert a current-truth row links the new measurement feature spec, and the marker is retained:
   ```bash
   rg -n 'feature-measurement-baseline\.md' doc/00-index.md
   awk 'NR==1 && /^---$/{f=1;next} f && /^---$/{exit} f' doc/00-index.md | rg '^ados_distribution: redistributable$'
   ```
3. **`doc/planning/oss-tooling/README.md`** — assert the Documents table gains the measurement log row:
   ```bash
   rg -n 'measurement-baseline\.yaml' doc/planning/oss-tooling/README.md
   ```
4. **`doc/planning/concepts/id-prefix-catalog.md`** — assert the status is annotated as adopted by ODR-0002 and links the project catalog:
   ```bash
   rg -n 'ODR-0002|adopted' doc/planning/concepts/id-prefix-catalog.md
   ```
   Confirm the record contains the project catalog declaration (no new catalog file was added — Appendix B lists none):
   ```bash
   git diff --name-status "$BASE"...HEAD -- doc/planning/concepts/
   ```
5. **`doc/planning/concepts/agent-primitive-surface.md`** — assert the PR/MR term is recorded as `DeliveryRequest`, resolved by ODR-0003:
   ```bash
   rg -n 'DeliveryRequest|ODR-0003' doc/planning/concepts/agent-primitive-surface.md
   ```
6. **`doc/spec/features/feature-adapter-ports.md`** — assert the harness-contract pointer names ADR-0008 and M1-S11:
   ```bash
   rg -n 'ADR-0008|M1-S11' doc/spec/features/feature-adapter-ports.md
   ```

**Expected Outcome**:

- All six documents carry the required pointer/annotation; the index row resolves; markers retained.
- No new catalog file appears outside the spec's artifact inventory.

#### TC-SYNC-004 - All new/changed links resolve to files and anchors

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, F-6, NFR-3, AC-F5-3
**Test Type(s)**: Content / links
**Automation Level**: Semi-automated (no committed link checker)
**Target Layer / Location**: Every new or changed Markdown file in the diff
**Tags**: @docs, @links, @anchors

**Preconditions**:

- Phase-7 edits and artifacts present.

**Steps**:

1. Enumerate changed/added Markdown files:
   ```bash
   git diff --name-only "$BASE"...HEAD | rg '\.md$' | rg -v '^doc/changes/'
   ```
2. For each, extract relative Markdown links and assert the target file exists (resolve relative to the file's directory):
   ```bash
   python3 - <<'PY'
   import re,sys,os,subprocess
   files=subprocess.run(["git","diff","--name-only",os.environ["BASE"]+"...HEAD"],capture_output=True,text=True).stdout.split()
   bad=[]
   for f in files:
       if not f.endswith(".md") or f.startswith("doc/changes/"): continue
       for m in re.finditer(r'\]\(([^)#\s]+)(#[^)]*)?\)', open(f).read()):
           t=m.group(1)
           if re.match(r'^(https?:|mailto:)',t): continue
           p=os.path.normpath(os.path.join(os.path.dirname(f),t))
           if not os.path.exists(p): bad.append((f,t))
   print("broken:",bad); sys.exit(1 if bad else 0)
   PY
   ```
   Run with `BASE` exported. Expected: `broken: []`.
3. For each link with a fragment (`#...`), resolve the heading slug in the target file; GitHub slug rule: lowercase, strip inline formatting, remove characters other than letters/digits/spaces/hyphens, replace spaces with hyphens. Assert a matching heading exists.
4. Assert the decision-index and register links use record filenames (not IDs) and resolve, and that every register binding `Anchor(s)` token also exists (cross-check TC-DEC-009 step 3).
5. Record the number of links checked and the number broken (must be 0) in §10.

**Expected Outcome**:

- 100% of new/changed links resolve to an existing file; every fragment resolves to a heading.
- 0 broken links; the checked/broken counts recorded.

#### TC-SYNC-005 - Sync is bounded; no other current-truth or historical artifact rewritten

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-6, C-9, AC-F6-1, AC-C2-1, NG-6
**Test Type(s)**: Static / diff
**Automation Level**: Automated
**Target Layer / Location**: The whole change diff
**Tags**: @diff, @scope, @bounded-sync

**Preconditions**:

- `BASE` recorded.

**Steps**:

1. Assert the changed-path set is a subset of the spec §7.1/Appendix B allowlist:
   - `doc/decisions/{00-index.md, README.md, 00-register.md, ADR-0008-*.md, ADR-0009-*.md, ODR-0002-*.md, ODR-0003-*.md}`
   - `doc/planning/oss-tooling/{README.md, cli-command-registry.md, measurement-baseline.yaml}`
   - `doc/planning/concepts/{id-prefix-catalog.md, agent-primitive-surface.md}`
   - `doc/spec/features/{feature-decision-records.md, feature-measurement-baseline.md, feature-adapter-ports.md}`
   - `doc/overview/glossary.md`, `doc/00-index.md`
   - `scripts/checks/forbidden-literals.registry.json` (data-only `registered` addition, DEC-13)
   - `doc/changes/2026-10/2026-10-31--GH-186--decision-records-measurement-baseline/**`
   ```bash
   git diff --name-only "$BASE"...HEAD | rg -v \
     '^(doc/decisions/(00-index|README|00-register|ADR-0008|ADR-0009|ODR-0002|ODR-0003)|doc/planning/oss-tooling/(README|cli-command-registry|measurement-baseline)|doc/planning/concepts/(id-prefix-catalog|agent-primitive-surface)|doc/spec/features/(feature-decision-records|feature-measurement-baseline|feature-adapter-ports)|doc/overview/glossary\.md|doc/00-index\.md|scripts/checks/forbidden-literals\.registry\.json|doc/changes/2026-10/2026-10-31--GH-186--)' \
     ; echo "off-allowlist-exit=$?"   # expect 1 (no lines)
   ```
2. Assert no other change folder is touched:
   ```bash
   git diff --name-only "$BASE"...HEAD | rg '^doc/changes/' | rg -v 'GH-186' ; echo "other-change-exit=$?"   # expect 1
   ```
3. Assert no historical evidence/pm-notes were rewritten: the only `doc/changes/` changes are GH-186's own artifacts (step 2) and no `doc/changes/**` path outside GH-186 is deleted or modified.
4. Assert no other current-truth document (`doc/spec/**`, `doc/overview/**`, `doc/00-index.md`) is rewritten beyond the named set (step 1 already bounds it; this step names the intent).
5. Assert no changes under `.ai/**`, `.opencode/**`, `packages/**`, `tests/**` (overlaps TC-GATE-001 for the code paths; this step covers the agent/doc config).
   ```bash
   git diff --name-only "$BASE"...HEAD | rg '^(\.ai/|\.opencode/|\.ados-claude/)' ; echo "agent-config-exit=$?"   # expect 1
   ```

**Expected Outcome**:

- Changed paths are a subset of the allowlist; no other change folder or historical artifact touched; no agent/config paths changed.
- The phase-7 sync is bounded and additive.

#### TC-GATE-001 - Diff scope: zero `packages/**`/`tools/**`, exactly one permitted `scripts/**` data edit

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-1, NG-1, AC-C1-1, DEC-13
**Test Type(s)**: Static / diff
**Automation Level**: Automated
**Target Layer / Location**: Repository diff vs `origin/main-tools`
**Tags**: @diff, @docs-only, @registry-data

**Preconditions**:

- Branch `feat/GH-186/decision-records-measurement-baseline` checked out.
- `origin/main-tools` fetched (or a local `main-tools` ref exists).
- No unintended uncommitted files.

**Steps**:

1. `git fetch origin main-tools` (skip if current).
2. `BASE="$(git merge-base origin/main-tools HEAD)"`; record `$BASE`.
3. Enumerate committed changes: `git diff --name-only "$BASE"...HEAD`.
4. Enumerate uncommitted changes: `git diff --name-only "$BASE"` and `git status --porcelain` (anything outside `doc/**` and the one registry path must be excluded from the commit).
5. Assert zero forbidden code/tool paths:
   ```bash
   changed="$(git diff --name-only "$BASE"...HEAD)"
   printf '%s\n' "$changed" | rg -n '^(packages|tools)/' ; echo "forbidden-exit=$?"   # expect 1
   ```
6. Assert the `scripts/**` changed set is exactly the one permitted data file:
   ```bash
   printf '%s\n' "$changed" | rg '^scripts/' > /tmp/scripts.changed
   test "$(wc -l < /tmp/scripts.changed)" -eq 1
   test "$(cat /tmp/scripts.changed)" = "scripts/checks/forbidden-literals.registry.json"
   echo "scripts-scope-ok"
   ```
7. Assert every changed path is either under `doc/` or exactly that registry path:
   ```bash
   printf '%s\n' "$changed" | rg -v '^(doc/|scripts/checks/forbidden-literals\.registry\.json$)' ; echo "non-doc-exit=$?"   # expect 1
   ```
8. Assert no `.ai/local/**` or other ephemeral path is committed:
   ```bash
   printf '%s\n' "$changed" | rg -n '^\.ai/local/' ; echo "local-state-exit=$?"   # expect 1
   ```

**Expected Outcome**:

- Zero changed paths under `packages/**` and `tools/**`; zero source/shell/test-logic/check-logic changes.
- Exactly one `scripts/**` path changed: `scripts/checks/forbidden-literals.registry.json`; every other changed path is under `doc/**`.
- The docs-only hard constraint with the DEC-13 data exception holds over committed and uncommitted state.

#### TC-GATE-002 - Diff hygiene and changed-path allowlist

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: C-1, C-9, AC-C1-1, AC-C2-1; testing strategy static/diff layer
**Test Type(s)**: Static / diff
**Automation Level**: Automated
**Target Layer / Location**: Repository diff
**Tags**: @diff, @hygiene

**Preconditions**:

- Same branch/base as TC-GATE-001.

**Steps**:

1. `BASE="$(git merge-base origin/main-tools HEAD)"`.
2. Run `git diff --check "$BASE"...HEAD`; also `git diff --check` for pre-commit working-tree edits.
3. Assert no renames or deletions anywhere:
   ```bash
   git diff --name-status "$BASE"...HEAD | rg '^(R|D)' ; echo "rename-or-delete-exit=$?"   # expect 1
   ```
4. Assert the added-file set contains only the new artifacts pinned by the spec (four records, register, log, measurement feature spec) and that the registry registration is a modification, not an addition:
   ```bash
   git diff --name-status "$BASE"...HEAD | rg '^A\s'
   git diff --name-status "$BASE"...HEAD -- scripts/checks/forbidden-literals.registry.json   # expect M
   ```
5. Assert every changed file is `.md`, `.yaml`/`.yml`, or the one permitted `.json` registry data file:
   ```bash
   git diff --name-only "$BASE"...HEAD | rg -v '\.(md|yaml|yml)$' | rg -v '^scripts/checks/forbidden-literals\.registry\.json$'
   ```
   Any remaining non-`.md`/`.yaml` hit must be an evidence file inside the GH-186 change folder and is accepted with a note.

**Expected Outcome**:

- `git diff --check` exits 0 (no whitespace/conflict diagnostics); zero renames/deletions.
- Added files match the spec's artifact inventory; the only non-doc changed file is the data-only registry registration; no unexpected binary or path type.

#### TC-GATE-003 - Doc-distribution guard (and negative modes) passes

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-6, AC-NFR6-1, C-1
**Test Type(s)**: Automated guard
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-doc-distribution.sh`, `scripts/.tests/test-doc-distribution-modes.sh`
**Tags**: @guard, @distribution

**Preconditions**:

- The change is committed or present in the working tree.
- `bash` ≥ 4 with `globstar` (the guard aborts on macOS bash 3.2).
- `git` available; no network required.

**Steps**:

1. Confirm the in-scope markers are valid before running the guard:
   ```bash
   rg -n '^ados_distribution:' doc/00-index.md doc/decisions/README.md doc/decisions/00-index.md
   ```
   Expect `redistributable`, `redistributable`, `project-generated`.
2. Run the guard:
   ```bash
   bash scripts/.tests/test-doc-distribution.sh ; echo "exit=$?"
   ```
3. Run the negative-mode self-tests (proves the guard's five modes still fire):
   ```bash
   bash scripts/.tests/test-doc-distribution-modes.sh ; echo "exit=$?"
   ```
4. Record the exit codes and any `::error::` annotations.

**Expected Outcome**:

- Both guards exit 0; zero marker/install-set drift.
- No new decision record or planning doc requires a marker (out of the guard's scan scope), and no in-scope marker regressed.

**Notes / Clarifications**:

- The guard's `SCAN` set is `doc/guides/*.md`, `doc/templates/**`, and the fixed `STANDALONE_DOCS` list (`documentation-handbook.md`, `doc/00-index.md`, `doc/decisions/README.md`, `doc/decisions/00-index.md`, `.ai/rules/README.md`). The new register and records are outside it; their markers are asserted in TC-DEC-008/TC-DEC-013.

#### TC-GATE-004 - Branch commits satisfy commitlint

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-6, AC-C1-1 (delivery gate; no dedicated AC — see note)
**Test Type(s)**: Automated guard
**Automation Level**: Automated
**Target Layer / Location**: `commitlint.config.js`, `scripts/checks/commitlint-authority.ts`, `pnpm exec commitlint`
**Tags**: @guard, @commitlint

**Preconditions**:

- `node_modules` installed (`pnpm install --frozen-lockfile`) or CI available.
- `BASE="$(git merge-base origin/main-tools HEAD)"`.

**Steps**:

1. Assert exactly one root commitlint config:
   ```bash
   bun run scripts/checks/commitlint-authority.ts ; echo "exit=$?"
   ```
2. Lint every branch commit:
   ```bash
   pnpm exec commitlint --from "$BASE" --to HEAD ; echo "exit=$?"
   ```
   Equivalent CI authority: `pnpm exec commitlint --from "origin/main-tools" --to HEAD`.
3. If the local husky hook was used, note that `.husky/commit-msg` is **warn-only** (`exit 0`) and CI is the authority; a locally green commit is not evidence.

**Expected Outcome**:

- `commitlint-authority` exits 0 (single root config).
- Every branch commit passes `@commitlint/config-conventional`; zero violations.

**Notes / Clarifications**:

- The change spec has no AC that names commitlint; it is a repository-wide delivery gate (`.ai/rules/testing-strategy.md` + the CI `ts-commitlint` job). It is recorded here as a delivery-contract check under C-1/AC-C1-1 rather than silently omitted. If the local environment lacks Node dependencies, record the skip and rely on CI.

#### TC-GATE-005 - Forbidden-literal registration, DEC-13 registry scope, and seed-literal compliance

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: C-1, C-10, NFR-10, AC-C1-1, AC-C10-1, AC-F6-1, DEC-13, spec §20
**Test Type(s)**: Automated guard + static diff + content scan
**Automation Level**: Automated
**Target Layer / Location**: `scripts/checks/forbidden-literals.ts`, `scripts/checks/privacy-literals.ts`, `scripts/checks/forbidden-literals.registry.json`, and the two new user-facing docs
**Tags**: @guard, @literals, @registry-data, @seed-scan

**Preconditions**:

- `bun` 1.4.4 available; the change includes the two new docs (`doc/planning/oss-tooling/measurement-baseline.yaml`, `doc/spec/features/feature-measurement-baseline.md`).
- `BASE` recorded; `git show "$BASE:scripts/checks/forbidden-literals.registry.json"` refers to the pre-change registry.

**Steps**:

1. Run the privacy/no-cloud working-tree scan:
   ```bash
   bun run scripts/checks/privacy-literals.ts ; echo "exit=$?"
   ```
   Expected: exit 0, no violations (the baseline cites committed paths and short non-identifying facts only).
2. Assert the two new docs are present as entries in `registered` and that no unrelated registration was added or removed (data-only, DEC-13):
   ```bash
   git show "$BASE:scripts/checks/forbidden-literals.registry.json" > /tmp/forbidden.registry.base.json
   python3 - <<'PY'
   import json
   base=json.load(open('/tmp/forbidden.registry.base.json'))
   head=json.load(open('scripts/checks/forbidden-literals.registry.json'))
   expected={
       "doc/planning/oss-tooling/measurement-baseline.yaml",
       "doc/spec/features/feature-measurement-baseline.md",
   }
   added=set(head["registered"])-set(base["registered"])
   removed=set(base["registered"])-set(head["registered"])
   assert added==expected, sorted(added)
   assert not removed, sorted(removed)
   for key in base:
       if key=="registered": continue
       assert base[key]==head[key], f"non-data registry change: {key}"
   assert set(base)==set(head), (set(base)^set(head))
   assert base["corpusBaseline"]==head["corpusBaseline"]
   print("registry data-only; both new docs registered")
   PY
   ```
   This is the DEC-13 boundary: only `registered` entries change; `corpusBaseline`, `scopeClasses`, `seedLiterals`, and `allowlist` are byte-equivalent.
3. Assert each new doc's `registered` entry was added in the **same commit that created the doc**, and that neither path was pre-registered (AC-C10-1 same-commit staging):
   ```bash
   for pair in "doc/planning/oss-tooling/measurement-baseline.yaml" \
               "doc/spec/features/feature-measurement-baseline.md"; do
     c=$(git log --diff-filter=A --format=%H -- "$pair" | tail -1)
     test -n "$c"
     python3 - "$c" "$pair" <<'PY'
   import json, subprocess, sys
   c, path = sys.argv[1], sys.argv[2]
   def reg(rev):
       out = subprocess.run(["git","show",f"{rev}:scripts/checks/forbidden-literals.registry.json"],
                            capture_output=True, text=True, check=True).stdout
       return set(json.loads(out)["registered"])
   assert path in reg(c), (c, path, "not registered in its add commit")
   parent = subprocess.run(["git","rev-parse",f"{c}^"], capture_output=True, text=True, check=True).stdout.strip()
   assert path not in reg(parent), (c, path, "pre-registered before the doc existed")
   print(c, path, "same-commit registration ok")
   PY
   done
   ```
   The YAML must be registered in the baseline commit and the feature spec in the doc-sync commit; if the delivery genuinely squashes them into one commit, record that as a stated deviation and still prove each path was absent from `registered` before its add commit.
4. Assert exactly one `scripts/**` path changed and it is the registry, and that no check code, test, or other script is touched:
   ```bash
   git diff --name-only "$BASE"...HEAD -- scripts/ > /tmp/scripts.changed
   test "$(wc -l < /tmp/scripts.changed)" -eq 1
   test "$(cat /tmp/scripts.changed)" = "scripts/checks/forbidden-literals.registry.json"
   test -z "$(git diff --name-only "$BASE"...HEAD -- scripts/checks/forbidden-literals.ts scripts/checks/privacy-literals.ts scripts/.tests/)"
   echo "check-logic-unchanged"
   ```
5. Run the forbidden-literal scan and assert exit 0:
   ```bash
   bun run scripts/checks/forbidden-literals.ts ; echo "exit=$?"
   ```
   Expected: exit 0; the output reports the two registered docs and `0 violations`.
6. Assert neither new doc contains a **delimited** occurrence of `ados`, `ADOS_`, or `~/.ados` on a non-allowlisted line. The scan mirrors `matchSeedLiteral` (case-insensitive, delimited from lowercase ASCII letters) and the header allowlist (`Copyright`, `source:`, `Apache-2.0`, `ados_distribution:`):
   ```bash
   python3 - <<'PY'
   SEEDS=["ados","ADOS_","~/.ados"]
   ALLOW=["Copyright","source:","Apache-2.0","ados_distribution:"]
   def lower_ascii(c): return c is not None and 'a' <= c <= 'z'
   def delimited(line, needle):
       low=line.lower(); n=needle.lower(); start=0
       while True:
           i=low.find(n, start)
           if i < 0: return False
           before=line[i-1] if i > 0 else None
           after=line[i+len(needle)] if i+len(needle) < len(line) else None
           if not lower_ascii(before) and not lower_ascii(after): return True
           start=i+1
   bad=[]
   for path in ["doc/planning/oss-tooling/measurement-baseline.yaml",
                "doc/spec/features/feature-measurement-baseline.md"]:
       for n, line in enumerate(open(path, encoding="utf-8"), 1):
           if any(a in line for a in ALLOW): continue
           for seed in sorted(SEEDS, key=len, reverse=True):
               if delimited(line, seed):
                   bad.append((path, n, seed)); break
   print("violations:", bad); assert not bad
   PY
   ```
7. Record the registry diff, the same-commit add SHAs, the guard exit code, the registered-doc list, and the delimited-scan result in §10.

**Expected Outcome**:

- Privacy scan exits 0; the forbidden-literal check exits 0.
- Both new docs are listed in `registered`, each entry added in the same commit that created its doc and neither pre-registered; the `scripts/**` diff is exactly the one data-only registry file and changes only the `registered` array (no check code, seed set, allowlist, scope class, or `corpusBaseline` change) — DEC-13 holds.
- Zero delimited seed-literal occurrences on non-allowlisted lines of either new doc (C-10 / NFR-10 / AC-C10-1).

**Notes / Clarifications**:

- The check is declarative: a registered doc must be absent at `corpusBaseline` and present in the tree, and registered docs are scanned for the seed set. The registry data edit in step 2 is the only permitted non-doc change (C-1/DEC-13), not a waiver or a check-logic change.
- Same-commit staging is normative in spec §18: registering a path before its doc exists fails with `registered doc is missing from the tree`. Step 3 proves the add commit and the absence from `registered` in its parent.
- The delimited scan mirrors the production matcher so a false positive cannot be dismissed by a looser `rg` boundary; a hit is a defect unless it is on an allowlisted header line.

#### TC-GATE-006 - Ancillary doc-set guard stays green

**Scenario Type**: Regression
**Impact Level**: Minor
**Priority**: Low
**Related IDs**: NFR-6, AC-NFR6-1
**Test Type(s)**: Automated guard
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-inception-doc-consistency.sh`
**Tags**: @guard, @regression

**Preconditions**:

- `bash` ≥ 4 with `globstar`.

**Steps**:

1. Run the inception doc-set consistency guard:
   ```bash
   bash scripts/.tests/test-inception-doc-consistency.sh ; echo "exit=$?"
   ```
2. If it fails, inspect whether the failure names an edited file (`doc/overview/glossary.md`, `doc/00-index.md`) or a file this change did not touch; a pre-existing failure must be reproduced at `$BASE` before being excluded:
   ```bash
   git stash list; git worktree list
   ```
   Prefer reproducing on a clean checkout of `$BASE` rather than modifying the branch.
3. Record the exit code and output summary in §10.

**Expected Outcome**:

- The guard exits 0 (no cross-surface terminology/matrix/index/structure regression), or a failure is proven pre-existing at `$BASE` and recorded as such.

**Notes / Clarifications**:

- This guard is Should/Low: it is not targeted at this change's files, but the repository runs it on every PR, so a regression would block merge. It is not an AC blocker by itself.

## 6. Environments and Test Data

- **Environment**: local developer checkout or the CI runner. Required: `git`, `bash` ≥ 4 with `globstar` (doc-distribution guard), `rg` (ripgrep), `python3` with PyYAML (or `yq`, or `bun`'s `yaml`), `bun` 1.4.4 (for `scripts/checks/*.ts`), and `node` + `pnpm` 10.18.3 with `node_modules` installed for commitlint. No network is required except `git fetch origin main-tools` (TC-GATE-001) and `pnpm install` if dependencies are absent.
- **Base reference**: `origin/main-tools`; record the resolved merge base (`BASE`) once and use it for every `...` diff. If the remote ref is unavailable, use the local `main-tools` ref and record it.
- **Test data**: the **committed** bash-era corpus — `doc/changes/**/chg-*-pm-notes.yaml`, `doc/changes/**/chg-*-evidence.md`, and git history. No synthetic numbers, no fixtures, no databases, no credentials. The measurement checks read the real corpus at the log's `source_commit`; the log's own `changes:` rows are the traceability spine. The corpus contains YAML-native `date`/`datetime` values and one known-unparseable file (`chg-GH-171-pm-notes.yaml`), so every recompute applies **N-1** and the unparseable file is read only from its `unparseable_yaml` change row.
- **Isolation**: all checks are read-only against the repository. The doc-distribution guard uses its own temp sandbox; the negative-mode guard uses temp trees. If any guard mutates tracked files, that is a defect to report. Do **not** set `ADOS_GUARD_ROOT` for the production runs (it is the negative-mode seam).
- **Evidence capture**: for each TC record the command, exit code, and a one-line result in §10; store raw outputs (e.g. the diff, the recomputation stdout with the recomputed-vs-recorded numbers) under `doc/changes/2026-10/2026-10-31--GH-186--decision-records-measurement-baseline/evidence/` as committed artifacts where useful.
- **Rounding and representation rules** (apply to TC-MEAS-006…TC-MEAS-009):

  **Q-1 — Quantisation**: use `Decimal(str(x)).quantize(Decimal(1).scaleb(-dp), rounding=ROUND_HALF_UP)`; never compare floats with `==`. Compare at the precision the file records (`dp` = number of decimal places written in the YAML for that field). Derived percent is always rounded to 1 decimal.

  **R-1 — Representation**: ratio metrics (`MET-CEREMONY-SHARE`, `MET-CI-FAILURE-RATE`) store the canonical `value` as a **0–1 ratio** (`unit: ratio`); any percent form is **derived** from that value as `Q-1(value × 100, 1)` and is **not stored as a second measurement** (no `percent`/`percent_value` field). Recompute `numerator / denominator` and compare the ratio at the recorded precision; the derived percent is then a presentation of the same value, not a second assertion source. `MET-CYCLE-TIME` is hours and its aggregates (including `p90_h`) are compared at the recorded precision. A mismatched declared representation is a defect, not a rounding tolerance.

  **P-1 — Percentile**: `p90_h` is **nearest-rank**: sort ascending and take the `ceil(0.9 × n)`-th smallest (1-indexed); no interpolation. It is reported only when `n ≥ 10`; otherwise it is absent/`null` and no p90 is claimed (OQ-T2 pinned).

  **N-1 — Corpus normalization (apply to TC-MEAS-005…TC-MEAS-009)**: before classification, convert YAML-native scalars to ISO-8601 equivalents. A `datetime.datetime` is an ISO-8601 timestamp and is usable only when its time component is nonzero (a `00:00:00` value is a **placeholder**, not a measured time). A `datetime.date` is date-only (`YYYY-MM-DD`) and follows the date-only exclusion. A string is used as written: `YYYY-MM-DD` is date-only, an ISO-8601 string with `T` and a nonzero time is usable, and a `T00:00:00` string is a placeholder. `None`/missing is a null endpoint. No endpoint is discarded merely because the YAML parser produced a `date`/`datetime` object instead of a string. A file that fails document-level YAML parsing is **never** passed to a phase loop; it is represented by its `included: false` / `unparseable_yaml` change row and counted in `changes_excluded`.

  **Timestamp parsing**: a timestamp is usable only after N-1 produces a non-placeholder time-bearing value (native `datetime` or an ISO-8601 string with a nonzero time); date-only, null/missing, and placeholder zero-time endpoints are excluded per the spec's inclusion rules (TC-MEAS-005).

## 7. Automation Plan and Implementation Mapping

No new test file or code is created by this change (docs-only plus the DEC-13 data registration; creating or changing a checker would violate C-1). Every required check is an existing repository gate or an ad-hoc, read-only verification command recorded in this plan.

| TC ID | Artifact / test file | Execution command | Implementation status |
|-------|----------------------|-------------------|-----------------------|
| TC-DEC-001 | None (inline git + rg) | `git diff --name-status "$BASE"...HEAD -- doc/decisions/` + `git ls-tree` ID checks | Existing – No Change (ad-hoc) |
| TC-DEC-002 | None (front-matter parse) | `python3` YAML parse + `rg -n 'acceptance pending at GH-186 PR review'` + absence greps | Manual Only (semi-automated) |
| TC-DEC-003 | None (heading enumeration) | `rg -n '^#+ '` per record + template/guide comparison | Manual Only |
| TC-DEC-004 | Reviewer checklist §5.2 | `awk` Decision extraction + `rg` element tokens | Manual Only |
| TC-DEC-005 | Reviewer checklist §5.2 | `awk` Decision extraction + `rg -n 'lockstep\|fixed group\|SHA256SUMS\|SBOM\|M4-S2'` + `.changeset/config.json` cross-check | Manual Only |
| TC-DEC-006 | Reviewer checklist §5.2 | `awk` Decision extraction + `rg -n 'R1\|R11\|per-type\|MET-'` + catalog cross-check | Manual Only |
| TC-DEC-007 | Reviewer checklist §5.2 + repository grounding | `awk` Decision extraction + `rg -n 'provider-quota\|DeliveryRequest\|superseding'` + repo grep | Manual Only |
| TC-DEC-008 | None (register assertions) | marker awk + header rg + row count awk | Existing – No Change (ad-hoc) |
| TC-DEC-009 | Reviewer checklist + §10 evidence | Binding table + anchor greps + rationale absence grep | Manual Only (grep-assisted) |
| TC-DEC-010 | None (inline git) | `git diff --name-only "$BASE"...HEAD --` + the `git ls-tree` record list (see §5.2) | Existing – No Change (ad-hoc) |
| TC-DEC-011 | None (index row parse) | `rg -c` per new ID + H1 title cross-check + line-order check | Existing – No Change (ad-hoc) |
| TC-DEC-012 | None (index row-set diff) | row-set `diff -u` base-vs-HEAD + repair greps | Existing – No Change (ad-hoc) |
| TC-DEC-013 | None (link + marker assertions) | `rg -n '00-register\.md'` + marker awk | Existing – No Change (ad-hoc) |
| TC-DEC-014 | None (registry content assertions) | exact-title/heading greps + banner/date greps + full diff review | Existing – No Change (ad-hoc) |
| TC-DEC-015 | None (table extraction diff) | `git show`/`rg` table extraction + `diff -u` + command-token set diff | Existing – No Change (ad-hoc) |
| TC-MEAS-001 | None (YAML parse) | `python3 -c 'yaml.safe_load(...)'` + key/type assertions + `git check-ignore` | Existing – No Change (ad-hoc) |
| TC-MEAS-002 | None (DM-2 key set) | `python3` key-set assertions over metrics/changes/observations/incidents | Existing – No Change (ad-hoc) |
| TC-MEAS-003 | Reviewer checklist + §10 inventory | `python3` sources/pm-notes assertions + anchor resolution loop | Manual Only (semi-automated) |
| TC-MEAS-004 | None (source-commit assertions) | `/tmp/cited_paths.txt` + `git cat-file -e "$SRC:$path"` + `git diff --quiet` loop | Existing – No Change (ad-hoc) |
| TC-MEAS-005 | None (window/exclusion/normalization assertions) | `python3` window/capture-change/closed-vocabulary/spine/sample-arithmetic + normalized phase-pair recompute + census cross-check | Existing – No Change (ad-hoc) |
| TC-MEAS-006 | None (recompute procedure) | `python3` ceremony recompute block (§5.2) with N-1-normalized `ts()`, canonical ratio + derived percent | Existing – No Change (ad-hoc) |
| TC-MEAS-007 | None (recompute procedure) | `python3` cycle-time recompute block (§5.2) with `included` filter + N-1-normalized `ts()`, plus nearest-rank p90 block | Existing – No Change (ad-hoc) |
| TC-MEAS-008 | None (recompute procedure) | `python3` CI numerator/denominator recompute block (§5.2) with canonical ratio + observation spot-checks | Existing – No Change (ad-hoc) |
| TC-MEAS-009 | None (recompute procedure) | `python3` per-class incident count block (§5.2) + duplicate-triple check | Existing – No Change (ad-hoc) |
| TC-MEAS-010 | None (status matrix) | `python3` status set + per-status matrix + time-metric PARTIAL rule + estimate grep | Existing – No Change (ad-hoc) |
| TC-MEAS-011 | None (content review) | `python3` comparison_protocol print + `rg` keyword checks + `git diff --name-status` | Manual Only (grep-assisted) |
| TC-SYNC-001 | None (content assertions) | `rg -n '00-register\|ODR-0002'` + front-matter `links` check | Manual Only (grep-assisted) |
| TC-SYNC-002 | None (content + literal scan) | template heading rg + `ados_distribution: internal` marker + placeholder absence + `/tmp/log_numbers.txt` literal scan | Manual Only (semi-automated) |
| TC-SYNC-003 | None (content assertions) | six per-document `rg` blocks + marker/row checks | Manual Only (grep-assisted) |
| TC-SYNC-004 | None (semi-automated link resolver) | inline `python3` link resolver (no committed checker exists) | Manual Only (semi-automated) |
| TC-SYNC-005 | None (allowlist diff) | `rg -v` allowlist assertion + other-change-folder assertion | Existing – No Change (ad-hoc) |
| TC-GATE-001 | None (inline git) | `git diff --name-only "$BASE"...HEAD` + zero `packages|tools` + exactly-one-`scripts` assertions | Existing – No Change (ad-hoc) |
| TC-GATE-002 | None (inline git) | `git diff --check "$BASE"...HEAD` + `git diff --name-status` + allowlist/type assertions | Existing – No Change (ad-hoc) |
| TC-GATE-003 | `scripts/.tests/test-doc-distribution.sh`, `scripts/.tests/test-doc-distribution-modes.sh` | `bash scripts/.tests/test-doc-distribution.sh`; `bash scripts/.tests/test-doc-distribution-modes.sh` | Existing – No Change |
| TC-GATE-004 | `scripts/checks/commitlint-authority.ts`, `commitlint.config.js` | `bun run scripts/checks/commitlint-authority.ts`; `pnpm exec commitlint --from "$BASE" --to HEAD` | Existing – No Change |
| TC-GATE-005 | `scripts/checks/forbidden-literals.ts`, `scripts/checks/privacy-literals.ts`, `scripts/checks/forbidden-literals.registry.json` | `bun run scripts/checks/privacy-literals.ts`; `bun run scripts/checks/forbidden-literals.ts`; registry base-vs-HEAD key-diff + same-commit add-history check + delimited seed scan | Existing – No Change (one data-only registry registration per DEC-13) |
| TC-GATE-006 | `scripts/.tests/test-inception-doc-consistency.sh` | `bash scripts/.tests/test-inception-doc-consistency.sh` | Existing – No Change |

**Recommended execution order**: TC-GATE-001/002 (scope and hygiene) → TC-GATE-003/005 (gates early, so a gate failure is known before the content review) → TC-DEC-001…015 → TC-MEAS-001…011 → TC-SYNC-001…005 → TC-GATE-004/006 (commit/ancillary gates last).

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk | Impact | Mitigation |
|----|------|--------|------------|
| RSK-T1 | **Registry scope creep** (spec RSK-10): the DEC-13 data edit expands into a check-logic, seed-set, allowlist, scope-class, or `corpusBaseline` change, eroding the docs-only boundary. | M | TC-GATE-001 asserts exactly one `scripts/**` path; TC-GATE-005 diffs the registry and requires every non-`registered` key to be byte-equivalent; any check-code/test change is a defect. |
| RSK-T11 | A new user-facing doc contains a delimited seed literal on a non-allowlisted line, so the forbidden-literal gate fails or a brand literal leaks. | H | TC-GATE-005 step 6 mirrors the production matcher and the header allowlist; a hit blocks delivery. |
| RSK-T12 | A YAML-native `date`/`datetime` endpoint is treated as null (because it is not a string), or the unparseable GH-171 file crashes a recompute loop, so real samples are understated and the counters cannot reproduce. | H | TC-MEAS-005…TC-MEAS-009 apply N-1 (native `datetime`/`date` accepted, placeholder zero-time rejected) and never parse an `unparseable_yaml` row; TC-MEAS-005 step 7 reconciles the re-derived census with the spine. |
| RSK-T2 | Recompute scripts drift from the spec's exact phase sets or rounding, producing false mismatches (or false matches). | M | Phase sets and rounding are pinned in TC-MEAS-006/§6 (Q-1, R-1); compare at the file's recorded precision; record the recomputed-vs-recorded numbers. |
| RSK-T3 | pm-notes timestamps are self-reported and clock-skewed (GH-179 retro), so ceremony/cycle values are hour-level approximations. | M | The log must state the limitation; the test compares the **same** source, never an external clock; a mismatch against the source is still a defect. |
| RSK-T4 | A `PARTIAL` sample is presented as `MEASURED` (overstated coverage). | H | TC-MEAS-010's status matrix plus the top-level-status consistency check; the reviewer signs off. |
| RSK-T5 | Index repair accidentally rewrites another pre-existing row (scope creep). | M | TC-DEC-012's full row-set diff, with an explicit allowed-difference list. |
| RSK-T6 | Register "anchors" are semantic tokens, not URL fragments, so a naive link checker would report false positives/negatives. | M | TC-DEC-009 checks token/heading existence; TC-SYNC-004 checks links separately; no anchor is assumed to be a URL fragment. |
| RSK-T7 | No committed Markdown link checker exists, so NFR-3 can be silently skipped. | M | TC-SYNC-004 is a required semi-automated procedure with recorded counts; the skip must be recorded, not implied. |
| RSK-T8 | The YAML log passes a key-presence check but carries semantically wrong types (e.g. a count as a string). | M | TC-MEAS-001/002 assert `schema_version` integer, 40-hex commit, ISO `captured_at`, and numeric types on the fields the recomputation consumes. |
| RSK-T9 | The feature spec restates baseline values, creating a second source of truth (RSK-9 in the spec). | M | TC-SYNC-002 step 4 greps the log's numeric results in the feature spec and requires a recorded verdict per hit. |
| RSK-T10 | Local commitlint is warn-only, so a malformed commit message looks green locally. | L | TC-GATE-004 uses the CI-equivalent commitlint range; CI `ts-commitlint` is the authority. |

### 8.2 Assumptions

- **A-1**: The base branch is `main-tools`; `origin/main-tools` is fetchable, and the merge base is the correct diff anchor.
- **A-2**: DEC-14 pins the corpus-ingestion precedence. **Pair level**: a date-only endpoint first (`date_only_pairs_excluded`); else a null/missing or placeholder zero-time endpoint (`phase_pairs_excluded`); else included. **Change level**: `unparseable_yaml` → `capture_change` → `outside_window` → `placeholder_zero_time` → `date_only_or_missing_time`. The counters must conserve (`included + excluded + date_only == 11` per included row) and the log must state the precedence; a non-conserving total is a defect.
- **A-3**: For `MET-CI-FAILURE-RATE`, `sample.changes_included` equals the denominator (the observed set), and `sample.excluded_unobserved` counts the unobserved included changes; `no_ci_observation` is a CI-sample reason only and never a change-row `excluded_reason`. If the delivery defines `changes_included` as all included changes, the row must state that and the denominator/`excluded_unobserved` must still reconcile.
- **A-4**: Representation rule R-1 follows spec §5.1/DM-2: ratio metrics store a 0–1 `value` and derive any percent form (1 decimal); a stored percent field or a percent-only representation is a spec deviation to flag, not an alternative convention to accept.
- **A-5**: There is no automated link/anchor checker in the repository; NFR-3's verification is the semi-automated procedure in TC-SYNC-004 plus reviewer confirmation, consistent with `.ai/rules/testing-strategy.md`.
- **A-6**: A YAML parser and `rg` are available in the verification environment; if PyYAML is absent, `yq` or `bun -e` with the `yaml` package provides the same assertions (record which was used).
- **A-7**: The implementation plan exists (`./chg-GH-186-plan.md`); its PD-3/PD-4 corpus pins and Phase-6 measurement procedure are the delivery counterpart of this plan's checks. This plan remains spec-derived and its TC numbering is independent of the plan's phase numbering.
- **A-8**: The percentile method is pinned by spec v1.2 (OQ-T2): nearest-rank, `ceil(0.9 × n)`-th smallest, no interpolation, reported only when `n ≥ 10`. A different method or an interpolated value is a defect, not an ambiguity.
- **A-9**: The `doc/decisions/` artifacts are excluded from the forbidden-literal scan (`excludedPrefixes: ["doc/changes/", "doc/decisions/"]`), so new records and the register cannot trip that gate; only the two new docs under `doc/planning/` and `doc/spec/` are registered and scanned.
- **A-10**: DEC-13 is the authorization for the one non-doc edit: the two new doc paths are added to `registered` in `scripts/checks/forbidden-literals.registry.json`. Any other `scripts/**` change, or any non-`registered` key change, violates C-1. Each entry is staged in the commit that creates its doc (spec §18); pre-registration fails the check.
- **A-11**: DEC-14 is the normative corpus-ingestion rule. YAML-native `datetime`/`date` scalars are normalized before classification (N-1); a `00:00:00` time is a placeholder, not a measurement; GH-171's unparseable pm-notes is excluded as `unparseable_yaml`, keeps its own row, and is counted in `changes_excluded`. The precedent manifest `tests/fixtures/pm-notes/corpus-exclusions.json` is read-only.

### 8.3 Open Questions

No open questions remain; every prior question is resolved by spec v1.2 or is explicitly out of scope.

| ID | Question | Status | Resolution |
|----|----------|--------|------------|
| OQ-T1 | How does the delivery satisfy the forbidden-literal corpus rule for the two new docs without violating C-1? | **Closed — resolved by DEC-13** | C-1/AC-C1-1 now permit exactly one data-only addition of the two doc paths to `registered` in `scripts/checks/forbidden-literals.registry.json`; no check logic, seed set, allowlist, scope class, or `corpusBaseline` change, and each entry is staged in the commit that creates its doc (spec §18). TC-GATE-001/TC-GATE-005 verify the scope and same-commit staging. |
| OQ-T2 | Which percentile method does the log use for `p90_h`? | **Closed — pinned** | Nearest-rank: sort ascending, take the `ceil(0.9 × n)`-th smallest (1-indexed), no interpolation; reported only when `n ≥ 10`. TC-MEAS-007 verifies it. |
| OQ-T3 | Is the ratio-metric `value` stored as percent or as a 0–1 ratio? | **Closed — pinned** | The canonical `value` is a 0–1 ratio; any percent is derived as `value × 100` rounded to 1 decimal and is not stored. TC-MEAS-002/006/008 verify it. |
| OQ-T4 | What exact shape does the top-level `change` field take? | **Closed — pinned** | The DM-2 mapping `{ref, tracker, excluded_from_samples}` (never a bare string); TC-MEAS-001/011 verify it. |
| OQ-T5 | Should the semi-automated checks in this plan be committed as a script? | **Closed — out of scope** | No: that would be a `scripts/**` check-logic change outside DEC-13. A future shell-allowed change may consider it. |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-31 | @test-plan-writer | Initial test plan derived from `chg-GH-186-spec.md`: 37 scenarios (15 decision-artifact, 11 measurement, 5 sync, 6 gate) covering all 20 ACs, DM-1…DM-4, NFR-1…NFR-9 and C-1…C-9; verified repository gate names; recompute-and-compare procedures for NFR-7; documented the forbidden-literal registry blocker (OQ-T1). |
| 1.1 | 2026-10-31 | @test-plan-writer | Re-based on `chg-GH-186-spec.md` v1.1: AC set is now 21 (adds AC-C10-1), C-1 narrowed to permit the DEC-13 data-only `registered` addition in `scripts/checks/forbidden-literals.registry.json`, and C-10/NFR-10 added. TC-GATE-001 now asserts exactly one permitted `scripts/**` path; TC-GATE-005 replaces the OQ-T1 blocker guidance with concrete registry-scope, registration, guard-exit, and delimited-seed-literal checks; TC-GATE-002 and TC-SYNC-005 allowlists include the registry; OQ-T1…OQ-T4 are closed (DEC-13 and pinned p90/ratio/`change` conventions); TC-MEAS-001/002/006/007/008/011 and TC-SYNC-002 encode those conventions; coverage, automation, risk, and execution-log sections updated. TC count remains 37; all 21 ACs covered. |
| 1.2 | 2026-10-31 | @test-plan-writer | DoR iteration 1 remediation (B1, B3, stale links, AC alignment) against `chg-GH-186-spec.md` v1.2/DEC-14. TC-MEAS-005 now asserts the parse → normalize → classify rule: YAML-native `datetime`/`date` normalization, placeholder zero-time handling (GH-57/67/69/71/72/174), the closed vocabulary (`unparseable_yaml`, `date_only_or_missing_time`, `placeholder_zero_time`, `capture_change`, `outside_window`; `no_ci_observation` as a CI-sample reason only), GH-171's own `unparseable_yaml` row, the 100% corpus spine, and the corrected spec-time census (41/40/30/24/10/1/6; 23 time-metric changes after excluding GH-186). TC-MEAS-006/007 helpers accept normalized native values; TC-MEAS-007 step 1 now filters `included: true`, excluding GH-186 and every other excluded row. TC-MEAS-010 adds the time-metric PARTIAL rule; TC-SYNC-002 asserts `ados_distribution: internal`; TC-GATE-005 adds same-commit registration and no-pre-registration history checks. Frontmatter/§2/§8 now link `./chg-GH-186-plan.md`; coverage descriptions and assumptions align with amended AC-F4-1/F4-3/F4-5/F6-1/C10-1. TC count remains 37; all 21 ACs covered. |

## 10. Test Execution Log

Populated during delivery, at the phase-9 quality gates, and at review. Record the command, exit code, the recomputed-vs-recorded numbers for the measurement scenarios, and a one-line result.

| TC ID | Run Date | Result | Notes / Evidence |
|-------|----------|--------|------------------|
| TC-DEC-001 | — | Not run | Awaiting delivery. |
| TC-DEC-002 | — | Not run | |
| TC-DEC-003 | — | Not run | |
| TC-DEC-004 | — | Not run | |
| TC-DEC-005 | — | Not run | |
| TC-DEC-006 | — | Not run | |
| TC-DEC-007 | — | Not run | |
| TC-DEC-008 | — | Not run | |
| TC-DEC-009 | — | Not run | |
| TC-DEC-010 | — | Not run | |
| TC-DEC-011 | — | Not run | |
| TC-DEC-012 | — | Not run | |
| TC-DEC-013 | — | Not run | |
| TC-DEC-014 | — | Not run | |
| TC-DEC-015 | — | Not run | |
| TC-MEAS-001 | — | Not run | |
| TC-MEAS-002 | — | Not run | |
| TC-MEAS-003 | — | Not run | |
| TC-MEAS-004 | — | Not run | |
| TC-MEAS-005 | — | Not run | Record the re-derived census at `source_commit`, the spine-vs-corpus diff result, the closed-vocabulary set observed, and the GH-171 `unparseable_yaml` row count. |
| TC-MEAS-006 | — | Not run | Record recomputed ratio vs recorded `value`, derived-percent presentation, and row-duration exact-match count. |
| TC-MEAS-007 | — | Not run | Record n (included rows only), median/min/max, censored count, and nearest-rank p90 (or its suppression when n<10). |
| TC-MEAS-008 | — | Not run | Record numerator, denominator, canonical ratio, derived-percent presentation, unobserved count. |
| TC-MEAS-009 | — | Not run | Record total and per-class counts; duplicate check result. |
| TC-MEAS-010 | — | Not run | Record the status set and matrix verdict. |
| TC-MEAS-011 | — | Not run | |
| TC-SYNC-001 | — | Not run | |
| TC-SYNC-002 | — | Not run | Record literal-scan hits and per-hit verdict. |
| TC-SYNC-003 | — | Not run | |
| TC-SYNC-004 | — | Not run | Record links checked / broken. |
| TC-SYNC-005 | — | Not run | |
| TC-GATE-001 | — | Not run | |
| TC-GATE-002 | — | Not run | |
| TC-GATE-003 | — | Not run | |
| TC-GATE-004 | — | Not run | |
| TC-GATE-005 | — | Not run | Record the registry base-vs-HEAD diff (data-only), each doc's add-commit SHA and same-commit registration proof, forbidden-literal guard exit 0, registered-doc list, and delimited seed-scan result. |
| TC-GATE-006 | — | Not run | |

