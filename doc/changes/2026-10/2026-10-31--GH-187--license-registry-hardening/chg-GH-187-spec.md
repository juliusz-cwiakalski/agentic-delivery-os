---
change:
  ref: GH-187
  type: feat
  status: Proposed
  slug: license-registry-hardening
  title: "M0-S18: License registry hardening"
  owners: [engineering]
  service: delivery-os repository license compliance gate
  labels: [change, planning]
  version_impact: none
  audience: internal
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - monorepo scaffold and binding CI invariants
      - existing license registry and license audit check
      - license audit test fixtures
      - current system specification for the monorepo toolchain
    external: []
---

# CHANGE SPECIFICATION

> **PURPOSE**: Turn the existing seed license registry into an explicit, machine-readable licensing policy with an authoritative denied-license list, prove that deny wins over allow, and make the binding CI license gate fail closed for denied and unknown licenses — without adding a CI job, weakening a gate, or reintroducing release-artifact obligations that belong to M4-S2.

## 1. SUMMARY

GH-187 hardens the license registry introduced by GH-170. The committed registry under `doc/legal/` gains a required, explicit `deny_list` covering SSPL, BUSL, Elastic License, Commons Clause, and the CC-BY-NC family, alongside its existing `allow_list`, entries, and approved verdicts. The existing license audit check enforces the deny list before the allow list, so a denied identifier fails even when it also appears in the allow list, and it rejects a missing, empty, malformed, duplicated, or gutted deny list. The acceptance criterion — a dependency with an unregistered or denied license fails CI — is proven by a mutation-style test matrix while the existing binding `ts-license-audit` CI job remains the only gate. Compound SPDX expressions remain parsed with fail-closed per-branch evaluation, preserving the live `MIT OR Apache-2.0` dependency.

## 2. CONTEXT

### 2.1 Current State Snapshot

- GH-170 seeded `doc/legal/dependency-licenses.yaml` with `schema_version: 2`, scope `direct-and-runtime-closure`, a proposed C-2 owner determination, registry entries with exact package versions, SPDX licenses, owner/field/version uses, and `approved` verdicts, plus an `allow_list`. The registry has no explicit denied-license list.
- The existing TypeScript license audit is fail-closed for the cases it covers. It parses SPDX AND/OR/parentheses expressions, evaluates every branch, and rejects unregistered uses, `LicenseRef-*` references, non-allow-listed branches, empty licenses, wrong or conflicting versions, duplicate entries and uses, and allow-list/approved-verdict drift.
- The audit is invoked by the binding `ts-license-audit` CI job. The job is part of the additive `ts-*` gate set, uses no `continue-on-error` or equivalent bypass, and is governed by the repository's CI topology and bindingness invariants.
- The existing test suite already covers unknown references, non-allow-listed licenses, an OR expression with a disallowed branch, an AND expression with all branches allowed, a removed entry, an empty license, allow-list/verdict drift, an unparseable allow-list entry, and transitive use accounting.
- The live registry contains a legitimate compound license, `@biomejs/biome` with `MIT OR Apache-2.0`, and the audit currently passes the live registry.
- The current system specification describes the registry as a license verdict registry plus allow-list and describes the audit as parsing SPDX expressions and failing closed on non-allow-listed branches. It does not yet describe a deny list or deny precedence.
- ADR-0003 C-2 requires an enforced dependency license policy that denies SSPL, BUSL, Elastic License, Commons Clause, and CC-BY-NC, and says the gate fails closed on unknown, `NOASSERTION`, `SEE LICENSE`, and compound expressions. TDR-0007 (Proposed; owner accepts at PR) records the per-branch clarification of the compound wording.

### 2.2 Pain Points / Gaps

- Denial is currently only an emergent side effect of not being on the allow list. A denied license could pass if a future registry edit mistakenly adds it to the allow list and an approved verdict backs it.
- The registry does not state the licensing policy in one human-readable and machine-readable place. A reader must infer the policy from the allow list.
- The audit does not classify a denied license distinctly from an unknown or merely non-allow-listed license, so CI output does not communicate that a restricted family was hit.
- The deny list itself has no integrity contract. Nothing would fail if the policy field were absent, emptied, malformed, duplicated, or silently stripped of a mandated family.
- The existing acceptance evidence does not explicitly cover `NOASSERTION`, `SEE LICENSE`, denied single identifiers, denied branches inside compound expressions, or deny-over-allow precedence.
- ADR-0003 C-2's phrase "fails closed on compound expressions" is ambiguous when read against the live `MIT OR Apache-2.0` dependency. The current per-branch behaviour is the intended interpretation, but it is not written into a change constraint, leaving room for an incompatible reinterpretation.

## 3. PROBLEM STATEMENT

Because the registry has no explicit denied-license policy and the audit derives denial solely from allow-list membership, a dependency carrying SSPL, BUSL, Elastic License, Commons Clause, or CC-BY-NC can pass the gate if a later registry edit allow-lists or approves it, and there is no fail-closed integrity check on the policy itself — resulting in merges that violate ADR-0003 C-2 and the M0-S18 acceptance criterion while giving reviewers no explicit signal that a restricted license was encountered.

## 4. GOALS

- **G-1**: Make the license policy explicit, authoritative, and readable in one committed registry artifact: allow list, deny list, and the precedence between them.
- **G-2**: Enforce the deny list before the allow list for every registry entry and every branch of a compound SPDX expression, so deny wins over allow.
- **G-3**: Make the deny policy tamper-evident by failing closed when the deny list is absent, empty, malformed, duplicated, overlaps the allow list, or omits a mandated denied family.
- **G-4**: Preserve and prove fail-closed behaviour for unregistered licenses, unknown references, `NOASSERTION`, `SEE LICENSE`, empty licenses, and non-allow-listed branches.
- **G-5**: Keep the existing `ts-license-audit` CI job as the sole binding gate, with no new job, no advisory downgrade, and unchanged CI invariants.
- **G-6**: Preserve the current per-branch handling of compound SPDX expressions, including the live `MIT OR Apache-2.0` entry, and record the interpretation of ADR-0003 C-2 in TDR-0007 (Proposed; owner accepts at PR) as a clarification that does not amend or supersede ADR-0003.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Mandated denied families represented in the registry deny list | 5/5 (SSPL, BUSL, Elastic, Commons Clause, CC-BY-NC) |
| Mandatory baseline denied identifiers present in the deny list | 20/20 per Appendix A |
| Denied single-license cases that fail the audit | 100% |
| Denied branches inside OR, AND, and nested compound expressions that fail the audit | 100% |
| Denied identifiers that pass when also present in the allow list | 0 |
| Missing, empty, non-array, malformed, duplicated, or allow-overlapping deny-list cases that fail closed | 100% |
| Mandatory denied family removed from the deny list and still accepted | 0 |
| Unregistered, `NOASSERTION`, `SEE LICENSE`, `LicenseRef-*`, empty, and non-allow-listed cases that fail closed | 100% |
| Existing allowed compound case (`MIT OR Apache-2.0`) that still passes | 1/1 |
| Live registry validation result | Pass with zero failures |
| New CI jobs added by this change | 0 |
| Gates weakened with `continue-on-error` or equivalent | 0 |
| New package dependencies or lockfile changes | 0 |
| Schema-v3 registry with a scope other than `direct-and-runtime-closure` accepted | 0 |

### 4.2 Non-Goals

- **NG-1**: No SBOM generation, checksum manifest, signature, `THIRD-PARTY-NOTICES` file, or `licenses/` bundle. Release-time SBOM, checksums, and provenance belong to M4-S2 (Publication and release automation); M4-S3 covers registry completeness and public materials.
- **NG-2**: No per-entry review-date governance, approver tracking, or re-review campaign. The registry keeps its current entry and verdict model.
- **NG-3**: No re-review of the existing license verdicts and no change to the existing allow list beyond what deny precedence requires.
- **NG-4**: No rejection of all compound SPDX expressions. Compound expressions stay parsed with per-branch fail-closed evaluation.
- **NG-5**: No new CI job and no change to the binding status of `ts-license-audit`; no advisory mode, no `continue-on-error`, no `|| true`, and no shell exit-code suppression.
- **NG-6**: No new package dependency, external license-scanning service, network call, or license database integration.
- **NG-7**: No expansion of the audited dependency graph beyond the existing direct-and-runtime-closure scope.
- **NG-8**: No automated legal compatibility analysis. The registry records human verdicts; the gate enforces the recorded policy.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Explicit registry policy with an authoritative deny list | Makes the license policy machine-readable and human-readable in one committed artifact instead of inferring it from the allow list. |
| F-2 | Deny-before-allow enforcement with explicit denial | A denied license fails even if a future edit also allow-lists it, and CI output says a restricted license was hit. |
| F-3 | Deny-list integrity and tamper evidence | A missing, emptied, malformed, duplicated, overlapping, or family-stripped deny list must not silently weaken the gate. |
| F-4 | Fail-closed handling of unregistered and unknown licenses | Preserves and proves the acceptance criterion for dependencies absent from the registry and for non-asserted or unparseable license values. |
| F-5 | Binding CI evidence and regression protection | The existing gate stays mandatory and the new policy is proven by a mutation matrix rather than by the live-registry happy path alone. |
| F-6 | Preserved per-branch compound evaluation | Keeps the live allowed compound dependency working while ensuring no branch of a compound expression can escape the deny or allow check. |

### 5.1 Capability Details

- **F-1**: The policy lives in the existing committed YAML registry under `doc/legal/`. The registry gains a required `deny_list` of denied license identifiers and keeps the existing required `allow_list`, entries, approved verdicts, scope, and C-2 determination. The registry remains parseable by the audit without side files. Human-readable header comments state the policy: unregistered and unknown licenses fail closed; `NOASSERTION` and `SEE LICENSE` are never accepted; every branch of a compound expression is evaluated; the deny list overrides the allow list; and the allow list contains only identifiers backed by approved verdicts. The registry schema version advances from 2 to 3 because the deny list and its integrity rules are required. The registry's `scope` remains `direct-and-runtime-closure`; a schema-v3 registry with any other scope fails closed and reports the observed scope. Each deny-list entry is exactly one license identifier, not an SPDX expression; a compound value in the deny list is malformed policy.

- **F-2**: For every registry entry, the audit evaluates the entry's parsed license identifiers against the deny list before evaluating them against the allow list. A denied identifier produces an explicit denial failure naming the package, the license, and the denied identifier, regardless of whether that identifier also appears in the allow list. The audit also treats an allow-list/deny-list overlap as a registry policy failure, so the two declarations cannot contradict each other silently. Denial is measured per branch: `MIT OR SSPL-1.0`, `MIT AND Elastic-2.0`, and a nested expression containing a denied identifier all fail even though another branch is allowed. The phrase "deny wins over allow" therefore has two enforced meanings: the entry-level check denies first, and the registry-level policy rejects contradictory lists.

- **F-3**: Deny-list integrity is fail-closed. The audit fails when `deny_list` is absent, is not an array, is empty, contains a non-string or empty entry, contains a duplicate identifier, contains an entry that is not a single valid identifier (for example a compound expression, a parenthesized expression, or `WITH`), or shares an identifier with `allow_list`. The audit also enforces a mandatory denied-family floor: the identifiers listed in Appendix A must be present in the deny list, and removing any of them is a failure. Additional identifiers may be added without a code change. This floor ensures that stripping a mandated family from the registry cannot turn the gate green, even if the allow list is edited at the same time.

- **F-4**: The acceptance criterion is preserved for every way a dependency can lack a valid approved license. An unregistered package use, an unregistered owner/field/version use, an empty license, a `LicenseRef-*` reference, `NOASSERTION`, `SEE LICENSE`, an unparseable expression, and a valid but non-allow-listed identifier all fail closed. Failures identify the package, the use, the license text, and the reason. The audit never treats a missing or non-asserted license as an implicit pass, and it never falls back to prefix or substring matching.

- **F-5**: The existing `ts-license-audit` CI job remains the only license gate. The change does not add a job, does not change the job's binding status, and does not introduce a bypass construct. The test suite is extended with a mutation matrix covering the denied families, deny-before-allow precedence, deny-list integrity, unknown and non-asserted licenses, denied compound branches, and the preserved allowed compound case. The live registry must validate with zero failures, and the repository's CI topology and bindingness invariants must remain green. The gate's observable contract is unchanged: non-zero exit on any failure and zero exit only when the live registry and dependency closure are fully registered and allowed.

- **F-6**: Compound SPDX expressions continue to be tokenized and parsed with AND/OR/parentheses. Every identifier branch must be known, not denied, not non-asserted, and allow-listed. The live `@biomejs/biome` entry with `MIT OR Apache-2.0` continues to pass. The change records that ADR-0003 C-2's "fails closed on compound expressions" is interpreted as "no branch of a compound expression may be unknown, denied, non-asserted, or non-allow-listed", not as "all compound expressions are rejected"; TDR-0007 (Proposed; owner accepts at PR) records this clarification without amending or superseding ADR-0003. A future change to reject all compounds would require a new decision and would remove a legitimate live dependency, so it is explicitly out of scope.

## 6. USER & SYSTEM FLOWS

```
Flow 1: Pull request with a new or changed dependency
  Contributor updates a manifest and lockfile
    -> CI runs the existing ts-license-audit job
    -> Audit loads the committed registry
    -> Audit resolves direct uses and the locked runtime closure
    -> For each use, the package entry and exact version must be registered
    -> Audit parses the entry license into identifier branches
    -> Any denied branch fails with an explicit denial
    -> Any unknown, non-asserted, or non-allow-listed branch fails
    -> Exit 0 only when every use is registered and every branch is allowed
```

```
Flow 2: Maintainer updates the license policy
  Maintainer edits the deny list or allow list in the registry
    -> Header comments and list contents remain the human-readable policy
    -> Deny-list integrity is checked: required, non-empty, valid, unique, disjoint from allow
    -> Mandatory denied-family floor is checked
    -> Allow list must remain exactly backed by approved verdicts
    -> A missing or weakened policy fails the same gate before merge
```

```
Flow 3: Denied license accidentally allow-listed
  A registry edit adds SSPL-1.0 to both the deny list and the allow list
    -> Registry-level overlap failure is reported
    -> Entry-level deny check still reports the denied identifier
    -> CI fails; deny wins over allow
```

```
Flow 4: Compound expression contains a denied branch
  Dependency license is "MIT OR BUSL-1.1"
    -> Parser extracts both identifier branches
    -> MIT is allowed; BUSL-1.1 is denied
    -> The denied branch fails the audit; the allowed branch does not rescue it
    -> CI fails
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- Add a required, explicit `deny_list` to the committed license registry and document its policy semantics for humans.
- Advance the registry schema to reflect the new required policy field and integrity rules.
- Enumerate the mandated denied families: SSPL, BUSL, Elastic License, Commons Clause, and CC-BY-NC.
- Enforce deny-before-allow for single identifiers and every branch of compound SPDX expressions.
- Enforce deny-list integrity: presence, non-emptiness, valid single identifiers, uniqueness, disjointness from the allow list, and the mandatory denied-family floor.
- Preserve and prove fail-closed handling for unregistered, unknown, `NOASSERTION`, `SEE LICENSE`, empty, and non-allow-listed licenses.
- Preserve the existing runtime-closure and use-accounting behaviour.
- Extend the license audit test suite and fixtures with the new positive and negative matrix.
- Keep the existing `ts-license-audit` CI job binding and unchanged in status.
- Reconcile the current system specification with the new deny-list policy during documentation sync.

### 7.2 Out of Scope

- [OUT] SBOM generation, checksum manifests, signatures, `THIRD-PARTY-NOTICES`, or a `licenses/` bundle; release-time SBOM, checksums, and provenance belong to M4-S2, while M4-S3 covers registry completeness and public materials.
- [OUT] Per-entry review dates, approver identity governance, or periodic re-review of existing verdicts.
- [OUT] Re-reviewing or changing existing license verdicts and the existing allow list beyond deny precedence.
- [OUT] Rejecting every compound SPDX expression; the current per-branch model is retained.
- [OUT] A new CI job, a new workflow, an advisory license report, or a separate license-policy service.
- [OUT] New package dependencies, network calls, or integration with an external license database.
- [OUT] Expanding the audited graph to the full development transitive closure.
- [OUT] Automated legal compatibility analysis or automated approval of new licenses.
- [OUT] Release notes, public documentation, or user-facing license disclosure.

### 7.3 Deferred / Maybe-Later

- A companion human-readable policy document under `doc/legal/` if the YAML header comments become insufficient for legal review; the YAML remains the machine-readable source of truth.
- Automated validation of deny-list identifiers against the official SPDX license list.
- Per-entry review-date and approver metadata if a later governance requirement introduces it.
- Release-time artifact generation (SBOM, checksums, notices) in M4-S2; registry completeness and public materials in M4-S3.
- The GH-187 ticket scope supersedes GH-170 DEC-10's assignment of SBOM/notices and per-entry review-date governance to M0-S18; release-time artifacts move to M4-S2, registry completeness to M4-S3, and review-date governance remains outside this change rather than being silently reassigned.
- Broader development-transitive license coverage if the dependency graph or risk posture changes.

### 7.4 Constraints

| ID | Constraint |
|----|------------|
| CON-1 | The policy lives in the existing committed YAML registry; no companion policy file is introduced by this change. |
| CON-2 | The deny list is authoritative and wins over the allow list; an allow/deny overlap is a policy failure. |
| CON-3 | Compound SPDX expressions remain parsed with per-branch fail-closed evaluation; ADR-0003 C-2, as clarified by TDR-0007 (Proposed; owner accepts at PR), is interpreted as "no branch may be unknown, denied, non-asserted, or non-allow-listed", and blanket compound rejection is not the policy. |
| CON-4 | The existing `ts-license-audit` job remains the only license gate; no new job is added, no advisory mode is introduced, and any CI workflow edit is additions-only and leaves existing gate definitions intact. |
| CON-5 | No new package dependency and no lockfile change. |
| CON-6 | Existing registry entries, uses, approved verdicts, allow list, scope, and C-2 determination are preserved; only the policy and integrity layers are added. |
| CON-7 | SBOM, checksums, and notices are release-time artifacts owned by M4-S2; per-entry review-date governance remains out of scope. The GH-187 ticket scope supersedes GH-170 DEC-10's assignment of SBOM/notices and review-date governance to M0-S18; M4-S3 covers registry completeness and public materials. |
| CON-8 | The audit stays offline and deterministic: no network call, external license service, clock-dependent decision, or random ordering. |
| CON-9 | The registry remains a committed, machine-readable YAML artifact that the audit reads directly; failure output identifies the package, use, license, and reason. |
| CON-10 | The existing fail-closed scope check is preserved: `registry.scope` must remain `direct-and-runtime-closure` for schema v3, and a schema-v3 registry with any other scope fails closed and reports the observed scope. The test plan adds a wrong-scope negative case for this contract. |

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A. This change introduces no HTTP or REST surface.

### 8.2 Events / Messages

N/A. This change introduces no events, messages, or asynchronous contracts.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Registry schema version | Advances from 2 to 3 because the deny list and its integrity rules are required. Older registry versions are rejected by the audit rather than accepted with an implicit empty policy. The registry's `scope` must remain `direct-and-runtime-closure`; a schema-v3 registry with any other scope fails closed and reports the observed scope. |
| DM-2 | `deny_list` | Required, non-empty array of single denied license identifiers. Each entry must match the registry's identifier token syntax `^[A-Za-z0-9.+-]+$` and contain no whitespace, `AND`/`OR`/`WITH` operators, parentheses, or compound expression. Duplicate entries, malformed entries, and overlap with the allow list are invalid. |
| DM-3 | `allow_list` | Existing required array of allowed license identifiers. Its contents remain backed by approved verdicts; deny-list identifiers must not appear in it. |
| DM-4 | Registry entries and verdicts | Existing package/version/license/uses/verdict model is unchanged. Every audited use must still map to an approved entry. |
| DM-5 | Policy semantics | Deny precedence, per-branch compound evaluation, unknown and non-asserted failure, and allow-list/verdict consistency are encoded in the registry comments and enforced by the audit. The deny list is the authoritative denied-license declaration and may be extended; the mandated family floor in Appendix A may not be removed. |

### 8.4 External Integrations

N/A. The gate reads committed repository data only. It performs no network call and integrates with no external license service.

### 8.5 Backward Compatibility

- The registry schema version changes because `deny_list` becomes required. The audit and registry ship in the same change and are the only consumer, so there is no supported consumer that reads the old schema.
- A registry that still declares the old schema version, or that omits the deny list, fails closed. This is intentional: accepting an old registry would mean accepting a registry without an explicit denial policy.
- The existing fail-closed scope check is preserved for schema v3: a registry whose scope is not `direct-and-runtime-closure` fails closed and reports the observed scope.
- The entry, use, verdict, allow-list, scope, and C-2 determination shapes remain compatible in meaning. Existing dependencies and the live allowed compound license remain valid.
- No published package API, CLI command, or user-facing configuration changes.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Fail-closed completeness for the policy matrix | 100% of the enumerated denied, unregistered, unknown, non-asserted, malformed, overlapping, and family-stripped cases produce a non-zero audit result; 0 false passes. |
| NFR-2 | Determinism and offline operation | Identical registry, lockfile, and dependency inputs produce identical failure sets; 0 network calls, 0 clock-dependent checks, 0 random ordering in assertions. |
| NFR-3 | Dependency and surface stability | 0 new runtime or development dependencies; 0 lockfile changes; 0 new CI jobs. |
| NFR-4 | Gate bindingness | The existing `ts-license-audit` job remains binding; 0 `continue-on-error`, `|| true`, `set +e`, or equivalent bypass constructs; CI topology and bindingness invariants pass. |
| NFR-5 | Audit performance | The live audit completes within 30 seconds on a standard CI runner for the current direct-and-runtime closure, with no additional job timeout. |
| NFR-6 | Diagnosability | 100% of audit failures name the affected package, use (where applicable), license text or identifier, and failure reason; expected validation failures produce no uncaught stack trace. |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- The gate reports failures on standard error with a stable `FAIL license-audit:` prefix and reports success on standard output only when the registry and dependency closure pass.
- The gate exits non-zero on any failure and zero only on a fully valid registry and dependency closure. No partial success is reported as a pass.
- Failure messages distinguish at least these classes: denied license, unknown license reference, non-asserted or unparseable license, non-allow-listed branch, unregistered dependency or use, malformed registry policy, schema/scope policy, and allow-list/verdict drift.
- Failure output is visible in the existing CI job log. No new metrics backend, trace, alert, or telemetry sink is introduced.
- Failure messages include only repository data needed for diagnosis; they do not print credentials, environment dumps, or unrelated file contents.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | A future registry edit removes a mandated denied family or adds it to the allow list, silently weakening the policy. | H | M | Enforce the Appendix A floor in the audit, reject allow/deny overlap, and add family-removal and overlap tests. | L |
| RSK-2 | A legitimate dependency is blocked because its license identifier is denied or not allow-listed. | M | L | Keep all existing entries and the allow list unchanged; validate the live registry; require a reviewed registry edit for new licenses. | L |
| RSK-3 | Per-branch compound handling diverges from ADR-0003 C-2's wording and creates a review dispute. | M | M | Record the interpretation as a constraint and decision, keep the live `MIT OR Apache-2.0` case green, and prove denied branches fail. | L |
| RSK-4 | The schema-version bump breaks an older reader or an in-flight branch. | L | L | The registry and audit ship together; the only consumer rejects old versions with an explicit failure; no external consumer exists. | L |
| RSK-5 | Tests assert only the live-registry happy path and do not prove the policy. | M | M | Require a mutation matrix with denied families, denied compound branches, deny-over-allow, and deny-list integrity cases. | L |
| RSK-6 | The recorded verdicts or the C-2 determination are legally inaccurate even though the gate is mechanically correct. | M | L | The registry keeps the proposed C-2 determination for owner confirmation at PR review; the gate enforces recorded policy rather than making legal judgments. | M |

## 12. ASSUMPTIONS

- The existing license audit and its tests are the only consumers of the registry schema.
- The registry under `doc/legal/` remains a committed YAML artifact and the single source of truth for the policy.
- Denied identifiers are exact registry labels. SPDX identifiers are used where one exists; policy labels such as `Commons-Clause` and `BUSL-1.0` are accepted by the registry's identifier syntax.
- Variants of a denied family that are not explicitly listed still fail closed because they are not allow-listed.
- The owner confirms the C-2 license determination at PR review; this change does not perform legal analysis.
- TDR-0007 is Proposed; its acceptance is pending at PR review, and this specification does not claim it is accepted.
- The existing CI job remains available and binding; no workflow redesign is needed.
- The current dependency closure can be validated with the existing YAML parser and repository tooling.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | M0-S1 monorepo scaffold and toolchain | Provides the workspace, the binding CI jobs, the registry seed, and the audit check. |
| Depends on | GH-170 license registry seed | Supplies the existing entries, allow list, verdict model, audit logic, and test fixtures that this change hardens. |
| Blocks | M4-S3 docs, license registry, and public materials | M4-S3 completes registry completeness and public materials; release-time artifacts are M4-S2. This change establishes the enforced policy M4-S3 builds on. |
| Internal | License audit check | Must gain deny-list parsing, validation, and deny-before-allow enforcement. |
| Internal | License audit test suite and fixtures | Must gain the denied, integrity, and preserved-compound matrix. |
| Internal | Current system specification | Must be reconciled with the deny-list policy during documentation sync. |
| External | None | No external vendor, API, or service is involved. |

## 14. OPEN QUESTIONS

None. The PM decisions recorded in Section 15 resolve the policy location, deny precedence, compound interpretation, CI scope, and release-artifact boundary. A future proposal to reject all compound expressions or to change the denied-family floor is a new decision, not an open question for this change.

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Keep the policy in the existing committed YAML registry via a required `deny_list`; do not add a companion policy document. | One committed artifact is both machine-readable for the gate and human-readable for reviewers, and avoids policy drift between two files. | 2026-10-31 |
| DEC-2 | Deny wins over allow: the entry-level deny check runs first, and an allow-list/deny-list overlap is a registry failure. | A denied license must not become acceptable through an accidental allow-list edit. | 2026-10-31 |
| DEC-3 | Compound SPDX expressions remain parsed with per-branch fail-closed evaluation. TDR-0007 (Proposed; owner accepts at PR) clarifies — without amending or superseding — ADR-0003 C-2: no branch may be unknown, denied, non-asserted, or non-allow-listed, and blanket compound rejection is not the policy. | This matches the current system specification and preserves the live `MIT OR Apache-2.0` dependency; the TDR records the interpretation durably and its acceptance remains pending at PR review. | 2026-10-31 |
| DEC-4 | Keep the existing binding `ts-license-audit` job as the only gate; do not add a CI job and do not weaken any gate. | The gate already runs the audit; the change is policy hardening, not workflow expansion. | 2026-10-31 |
| DEC-5 | Advance the registry schema from 2 to 3 and reject older versions. | The deny list is required policy; accepting an old schema would silently accept a registry without denial semantics. | 2026-10-31 |
| DEC-6 | Enforce a mandatory denied-family floor in the audit, while allowing additional identifiers to be added through the registry. | Removing a mandated family from the registry must fail closed even if the allow list is edited in the same change. | 2026-10-31 |
| DEC-7 | Defer release-time SBOM, checksums, and notices to M4-S2 (Publication and release automation); keep per-entry review-date governance out of GH-187; M4-S3 covers registry completeness and public materials. The GH-187 ticket scope supersedes GH-170 DEC-10's assignment of SBOM/notices and per-entry review-date governance to M0-S18. | These are release-artifact and governance obligations, not the registry-policy hardening the GH-187 ticket scopes; citing the superseded assignment avoids a silent reassignment. | 2026-10-31 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| License registry data under `doc/legal/` | Updated: new schema version, required deny list, policy comments; existing entries and allow list preserved. |
| License audit check | Updated: deny-list validation, mandatory family floor, deny-before-allow enforcement, explicit denial failures. |
| License audit tests and fixtures | Updated: denied-family matrix, integrity matrix, deny-over-allow cases, denied compound branches, preserved allowed compound case. |
| CI workflow | Unchanged in gate status; the existing `ts-license-audit` job remains binding and unmodified in behaviour. |
| CI topology and bindingness invariants | Must remain green; no new job or bypass. |
| Current system specification for the monorepo toolchain | Updated during documentation sync to describe the deny list and policy semantics. |
| Decision record TDR-0007 | New: clarifies ADR-0003 C-2 per-branch compound evaluation; status Proposed, owner accepts at PR review. |
| Change artifacts | This specification, plus the downstream test plan and delivery plan. |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** the committed license registry, **when** it is parsed, **then** it declares schema version 3, the scope, the C-2 owner determination as preserved (proposed at delivery, confirmed by the owner at PR review), the allow list, and a required non-empty deny list, all in one committed YAML artifact. | F-1, DM-1, DM-2, DM-5 |
| AC-F1-2 | **Given** the deny list, **when** its contents are inspected, **then** all five mandated families and every identifier in the Appendix A baseline are present. | F-1, F-3, DM-2 |
| AC-F1-3 | **Given** a registry that declares the old schema version, omits the schema version, or declares schema version 3 with a scope other than `direct-and-runtime-closure`, **when** the audit runs, **then** it fails closed with a schema/scope-policy failure that reports the observed value rather than accepting a registry without the deny-list contract. | F-1, DM-1 |
| AC-F1-4 | **Given** the registry file, **when** it is reviewed by a maintainer, **then** its human-readable policy notes state that unregistered and unknown licenses fail closed, `NOASSERTION` and `SEE LICENSE` are never accepted, compound branches are evaluated individually, and deny wins over allow. | F-1, DM-5 |
| AC-F2-1 | **Given** a dependency entry whose license is a denied identifier, **when** the audit runs, **then** it fails with an explicit denial that names the package and the denied identifier. | F-2, NFR-1 |
| AC-F2-2 | **Given** a denied identifier that also appears in the allow list, **when** the audit runs, **then** the registry overlap is reported and the denied entry still fails; the case never passes. | F-2, F-3, NFR-1 |
| AC-F2-3 | **Given** a compound license with one allowed branch and one denied branch, including OR, AND, and nested forms, **when** the audit runs, **then** the denied branch fails the audit and the allowed branch does not rescue it. | F-2, F-6 |
| AC-F3-1 | **Given** a registry with the deny list absent, not an array, or an empty array, **when** the audit runs, **then** it fails closed with a policy-integrity failure. | F-3, DM-2 |
| AC-F3-2 | **Given** a deny list containing a non-string, empty, duplicate, compound, or otherwise malformed identifier, **when** the audit runs, **then** it fails closed with a policy-integrity failure. | F-3, DM-2 |
| AC-F3-3 | **Given** a deny list with any Appendix A baseline identifier removed, **when** the audit runs, **then** it fails closed even if the remaining policy and allow list are otherwise valid. | F-3, DM-2 |
| AC-F4-1 | **Given** a dependency use with no registry entry, **when** the audit runs, **then** it fails with an unregistered-use failure naming the package and use. | F-4 |
| AC-F4-2 | **Given** an entry license that is empty, `LicenseRef-*`, `NOASSERTION`, `SEE LICENSE`, unparseable, or a valid but non-allow-listed identifier, **when** the audit runs, **then** it fails closed and identifies the package and the offending license text. | F-4 |
| AC-F5-1 | **Given** the CI workflow, **when** the change is delivered, **then** the existing `ts-license-audit` job is still present and binding, no license bypass construct is introduced, and the CI topology and bindingness invariants pass. | F-5, NFR-4 |
| AC-F5-2 | **Given** the extended test suite, **when** it runs, **then** it covers the denied families, deny-over-allow, deny-list integrity, unknown and non-asserted licenses, denied compound branches, and the preserved allowed compound case, and the live registry validates with zero failures. | F-5, NFR-1, NFR-6 |
| AC-F6-1 | **Given** the live `@biomejs/biome` entry with `MIT OR Apache-2.0`, **when** the audit runs, **then** it passes, proving that per-branch compound evaluation is preserved and blanket compound rejection was not introduced. | F-6, NFR-1 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Deliver as one reviewed change through the existing ticket and pull-request flow targeting the tooling integration branch.
- Ship the registry policy edit, the audit enforcement, and the test matrix together so no intermediate state exposes a registry without the deny list to the binding gate.
- Run the full repository gate battery before merge; the live registry audit must pass and the CI topology and bindingness invariants must remain green.
- No feature flag, staged rollout, or dual-run period is required. The change is repository-internal and does not affect published packages or user-facing behaviour.
- Reconcile the system specification after delivery so the documented current truth includes the deny list and its semantics.
- No release artifact, changeset, or public communication is part of this change.

### 18.1 Definition of Done predicates

The change is done only when all of the following are true, with evidence traceable to the test plan:

- **All 15 ACs have passing evidence.** Every acceptance criterion in §17 maps to passing TCs in the test plan's AC traceability matrix; the automated suites (`bun test tests/checks`, the spawned-exit suite, and the repository invariant commands) pass, and the manual TC-LICREG-030 items are confirmed on the PR.
- **Live registry is valid at schema v3.** `validate(ROOT)` returns zero failures; the delivered registry declares `schema_version: 3` and `scope: direct-and-runtime-closure`; the wrong-scope schema-v3 negative case added by the test plan (TC-LICREG-031) fails closed and reports the observed scope.
- **Deny policy is complete and disjoint.** The deny list contains 20/20 Appendix A baseline identifiers, the allow list and deny list are disjoint, and removing any baseline identifier fails closed (TC-LICREG-002, TC-LICREG-007, TC-LICREG-008, TC-LICREG-013).
- **Required matrices pass.** The 18 malformed deny-entry variants (TC-LICREG-012), the 10 spawned cases — 1 live green plus 9 failure (TC-LICREG-022) — and the preserved-compound cases (TC-LICREG-018, TC-LICREG-019) all pass.
- **Full gate battery is green.** The actual battery passes: `pnpm check`; `bun run scripts/checks/license-audit.ts`; the CI-topology, bindingness, and supply-chain invariant checks; `bash scripts/.tests/test-*.sh`; and `bash tools/.tests/test-*.sh`. The existing `ts-license-audit` job remains required and green.
- **Surface is unchanged.** No lockfile, manifest, dependency, workflow-job, or aggregate-chain change is present; TC-LICREG-020, TC-LICREG-021, TC-LICREG-028, and TC-LICREG-029 pass.
- **No release artifacts were introduced.** No SBOM, notices, checksum, or review-date artifact exists in the change (TC-LICREG-028, TC-LICREG-030).
- **C-2 remains proposed.** The C-2 owner determination is preserved verbatim from the seed and recorded for owner confirmation at PR review; no approval is fabricated (TC-LICREG-003, TC-LICREG-030).
- **Decision capture is honest.** TDR-0007 is referenced by DEC-3 and Appendix C and remains Proposed; the owner accepts or rejects it at PR review, and no acceptance is claimed prematurely.
- **PR is open.** A pull request is open against `main-tools` with `ts-license-audit` required and green, and the test execution evidence is recorded in the test plan §10 log.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

- The existing registry is edited in place: the schema version advances from 2 to 3, the deny list is added, and the existing entries, uses, verdicts, allow list, scope, and C-2 determination are preserved.
- The migration is atomic with the audit change. A partially migrated registry is not a supported state and fails closed.
- No external data store, dependency lockfile, or generated artifact is migrated.
- No release seeding or public data publication is involved.

## 20. PRIVACY / COMPLIANCE REVIEW

- The change processes license metadata only; it introduces no personal data, user identifiers, telemetry, or tracking.
- The repository and CI logs are public. Failure messages contain package names and license identifiers already committed in the registry; they must not echo credentials or unrelated file contents.
- The change strengthens compliance with ADR-0003 C-2 by making the denied families explicit and enforced. It does not replace legal review: the recorded verdicts and the C-2 determination remain subject to owner confirmation.
- No privacy-impacting data flow is added.

## 21. SECURITY REVIEW HIGHLIGHTS

- The license gate is a supply-chain control. The primary security property is fail-closed behaviour: an absent, empty, malformed, or weakened policy must not produce a passing gate.
- Deny precedence is enforced at both the entry and registry levels so a single data edit cannot make a restricted license acceptable.
- The audit remains offline and deterministic; no new network path, secret, credential, or third-party service is introduced.
- The change adds no executable dependency and no lockfile change, minimizing supply-chain surface.
- The mandatory denied-family floor prevents a policy downgrade through registry data alone; removing a mandated family requires a reviewed code change.
- The gate retains its existing non-zero-exit contract and introduces no bypass or advisory path.

## 22. MAINTENANCE & OPERATIONS IMPACT

- Adding a new dependency still requires a reviewed registry entry; the audit fails until the entry is present and approved.
- Adding a newly restricted license can be done by extending the deny list in the registry without a code change, provided the identifier syntax is respected.
- Removing or renaming a mandated denied family requires an explicit code and policy change, by design.
- Reviewers should treat changes to the deny list, the allow list, and approved verdicts as policy changes requiring the same scrutiny as code.
- No new runtime process, scheduled job, alert, or operational runbook is introduced.
- The gate continues to run in the existing CI job; operational ownership stays with the repository maintainers.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Allow list | The set of license identifiers the gate accepts when they are also backed by an approved registry verdict. |
| Deny list | The authoritative set of license identifiers that must never be accepted, regardless of allow-list membership. |
| Deny wins over allow | The rule that a denied identifier fails even if the allow list also contains it, and that the two lists must not overlap. |
| Compound SPDX expression | A license expression combining identifiers with `AND`, `OR`, and parentheses. |
| Per-branch evaluation | Parsing a compound expression into identifier branches and applying the deny, unknown, and allow checks to every branch. |
| Fail closed | Producing a failure when policy data is missing, malformed, ambiguous, or not provably acceptable, rather than assuming a pass. |
| Unregistered use | A dependency use (package, owner, dependency field, resolved version) that has no matching registry entry. |
| Approved verdict | A registry entry verdict of `approved`, which is the only verdict the audit accepts. |
| Runtime closure | The direct runtime dependencies plus every dependency reachable through runtime dependency edges in the lock graph. |
| C-2 determination | The owner-facing license determination recorded in the registry and confirmed at PR review. |
| Mandatory denied-family floor | The Appendix A set of denied identifiers that the registry must contain, enforced by the audit so the policy cannot be silently stripped. |
| `NOASSERTION` / `SEE LICENSE` | Non-license values that must never be treated as approved or allow-listed; they fail closed. |

## 24. APPENDICES

### Appendix A — Mandatory denied-license baseline

The registry deny list must contain at least the following identifiers. Additional identifiers may be added. Each entry is a single identifier, not an expression.

| Family | Mandatory identifiers |
|--------|-----------------------|
| SSPL | `SSPL-1.0` |
| BUSL | `BUSL-1.0`, `BUSL-1.1` |
| Elastic License | `Elastic-2.0` |
| Commons Clause | `Commons-Clause` |
| CC-BY-NC | `CC-BY-NC-1.0`, `CC-BY-NC-2.0`, `CC-BY-NC-2.5`, `CC-BY-NC-3.0`, `CC-BY-NC-4.0`, `CC-BY-NC-SA-1.0`, `CC-BY-NC-SA-2.0`, `CC-BY-NC-SA-2.5`, `CC-BY-NC-SA-3.0`, `CC-BY-NC-SA-4.0`, `CC-BY-NC-ND-1.0`, `CC-BY-NC-ND-2.0`, `CC-BY-NC-ND-2.5`, `CC-BY-NC-ND-3.0`, `CC-BY-NC-ND-4.0` |

Notes:

- `Commons-Clause` and `BUSL-1.0` are policy labels used by the registry where a single official SPDX identifier may not exist. The registry's identifier syntax accepts them.
- Each deny-list entry must be a single identifier matching `^[A-Za-z0-9.+-]+$`; whitespace, `AND`/`OR`/`WITH`, parentheses, and compound expressions are invalid.
- Any other identifier in a denied family that is not in this baseline still fails closed because it is not allow-listed. The floor exists to prevent silent removal of the mandated families, not to enumerate every possible variant.

### Appendix B — Ticket acceptance-criterion trace

| Ticket criterion | Specification coverage |
|------------------|-----------------------|
| A dependency with an unregistered license fails CI | F-4; AC-F4-1, AC-F4-2 |
| A dependency with a denied license fails CI | F-1, F-2, F-3; AC-F1-2, AC-F2-1, AC-F2-2, AC-F2-3, AC-F3-3 |
| Deny list enforced for SSPL, BUSL, Elastic, Commons Clause, CC-BY-NC | F-1, F-3; AC-F1-2, AC-F3-3; Appendix A |
| CI gate reads the registry and fails closed on unknown licenses | F-4, F-5; AC-F4-1, AC-F4-2, AC-F5-1 |
| Registry remains machine-parseable and human-readable | F-1; AC-F1-1, AC-F1-4 |
| No gate weakening and no new CI job | F-5; AC-F5-1; NFR-4 |

### Appendix C — Compound-expression interpretation record

ADR-0003 C-2 says the gate "fails closed on unknown, `NOASSERTION`, `SEE LICENSE`, and compound expressions." The live registry contains `MIT OR Apache-2.0` for `@biomejs/biome`, and the current system specification documents AND/OR/parentheses parsing. This change therefore applies C-2 as clarified by TDR-0007 (`doc/decisions/TDR-0007-license-gate-compound-spdx-expression-evaluation.md`, Proposed; owner accepts at PR), which clarifies — without amending or superseding — ADR-0003 C-2:

- A compound expression is not accepted as a whole.
- Each identifier branch is evaluated independently.
- No branch may be unknown, denied, non-asserted, or non-allow-listed.
- The expression passes only when every branch passes.
- Blanket rejection of all compound expressions is not the policy.

TDR-0007 remains Proposed; this specification does not claim it is accepted. The interpretation preserves the live dependency and still fails closed on every denied or unknown branch.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-31 | @spec-writer | Initial specification for GH-187 license registry hardening. |
| 1.1 | 2026-10-31 | @spec-writer | Corrected AC-F1-1 C-2 wording and added the deny-identifier grammar to DM-2 and Appendix A (OQ-T2). |
| 1.2 | 2026-10-31 | @spec-writer | DoR iteration 1 remediation: added §18.1 Definition of Done predicates; cited TDR-0007 in DEC-3/Appendix C; corrected M4-S2/M4-S3 deferrals and GH-170 DEC-10 supersession; preserved and AC-linked the schema-v3 scope check (CON-10, AC-F1-3). |
| 1.3 | 2026-10-31 | @spec-writer | DoR iteration 2 remediation: corrected the DoD gate-battery commands and replaced the wrong-scope TC citation with TC-LICREG-031. |

---

## AUTHORING GUIDELINES

- **Primary source:** the GH-187 tracker ticket and the PM-confirmed scope recorded in the change PM notes.
- **Current-state sources:** the committed license registry seed, the existing license audit check, its test suite and fixtures, the current monorepo toolchain system specification, ADR-0003 C-2, and the M0-S18 backlog entry.
- **Approach:** describe behavioural contracts and data invariants, not code-level steps. The specification deliberately keeps the existing CI job and dependency scope and narrows the change to explicit deny policy, deny precedence, deny-list integrity, and acceptance evidence.
- **Key tension resolved:** ADR-0003 C-2's compound wording is interpreted per branch to preserve the live allowed compound dependency; this is recorded as a constraint and decision rather than left implicit.
- **Scope discipline:** release-time SBOM/checksums/notices are deferred to M4-S2, registry completeness and public materials to M4-S3, and per-entry review-date governance remains out of scope; GH-187 supersedes GH-170 DEC-10's assignment of those obligations to M0-S18.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-187)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] Change-specific Definition of Done predicates are defined in §18.1
- [x] No implementation details (no code-level tasks, no step-by-step plan)
- [x] No content duplicated from linked docs beyond the minimum current-state summary
- [x] Front matter validates per front_matter_rules
