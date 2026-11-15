---
id: chg-GH-320-test-plan
status: Updated
version: 1.1
created: 2026-11-15
last_updated: 2026-11-15
owners: [engineering]
service: delivery-os
labels: [cli, entrypoint, branding, config, state, installer, compatibility, m4]
version_impact: minor
summary: "Pin the two-executable identity as comparisons a test runs: `jaiship` and `delivery-os` are two declared selectors over one shared launcher composition and one resolver, with the alias observably unchanged; the prior-identity read fallback (project configuration per repository-owned layer, host state root through the one pure policy) keeps `.delivery-os` artifacts visible under the new identity, current-wins, read-only, with no second root created; one classified `prior-identity-fallback` notice per source kind per process on stderr in every mode with no payload or exit change and no collision with the delivered store warning or the `ADOS_`/`.ados` notice; a user-level local install registers an executable launcher at the brand install path, content-idempotent, working outside the checkout, failing classified when its target is gone; and the structural truth (two bins, the declared four-site non-exported identity-literal inventory — three CLI selector sites plus the unchanged MCP default — with no residual neutral default in the entrypoint module, exact inventory with per-file executable allowance, preserved installer absence) plus the documentation and the aggregate gate."
links:
  change_spec: ./chg-GH-320-spec.md
  implementation_plan: ./chg-GH-320-plan.yaml
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M4-S1a: jaiship executable binary and local install

## 1. Scope and Objectives

This change adds a second executable identity and a read fallback across two delivered subsystems, so the risk is not a missing feature — it is a change that *looks* additive while one of its four independent truths is false. Each truth is proven as a comparison a test runs, never as a prose claim. **First, the two bins are one program.** `jaiship` and `delivery-os` are declared selectors over one shared launcher composition and one resolver; the alias keeps byte-identical `--version`/`--help` output and `.delivery-os` paths (`TC-BIN-002`, `TC-BIN-013`), the new bin answers its own identity at the process edge (`TC-BIN-001`), the help families are identical in content and order with the binary name as the only difference (`TC-BIN-003`, `TC-BIN-004`), self-description stays isolated from state, git, and configuration for three reads on both bins (`TC-BIN-005`), the install-path read answers per identity without adding a family row (`TC-BIN-006`), and the override seam behaves identically for both bins (`TC-BIN-010`..`TC-BIN-012`). **Second, the fallback can never launder an artifact.** The prior project file is read as the project-committed layer with its real path recorded as the loaded file and as the origin of every value it supplies (`TC-BIN-020`), the current file always wins (`TC-BIN-021`), layers are independent (`TC-BIN-022`), an explicit selection disables every fallback (`TC-BIN-023`), machine-global layers never fall back (`TC-BIN-024`), the prior directory is byte-identical after the run (`TC-BIN-025`), and `--strict` does not move (`TC-BIN-026`).

**Third, the host state keeps one root.** With no current override and no current default root, the prior root is the effective root and reads plus the ordinary store operations that follow it use it (`TC-BIN-030`, `TC-BIN-035`); no current root is created while the fallback holds (`TC-BIN-031`); an absolute current override wins and disables the fallback (`TC-BIN-032`); both roots present means current wins and the prior root is reported as not used (`TC-BIN-033`); the prior prefix's override is never read (`TC-BIN-034`); and the ordinary first-use path is untouched (`TC-BIN-036`). **Fourth, the notice is bounded and quiet.** One line per source kind per process on stderr in every mode including `--json` (`TC-BIN-040`), no repetition within an invocation (`TC-BIN-041`), nothing when no fallback applies (`TC-BIN-042`), a text contract that names both locations and the no-move fact and carries no value (`TC-BIN-043`), distinctness from the two delivered notices (`TC-BIN-044`), and no payload or exit change (`TC-BIN-045`).

**Fifth, the install posture is real and hermetic.** A local install with fetching disabled, a scratch home, and a scratch project root registers an executable launcher at the brand install path whose single target is the checkout's CLI entry (`TC-BIN-050`), a re-run rewrites nothing (`TC-BIN-051`), a removed target is one bounded line with a non-zero exit (`TC-BIN-052`), arguments, streams, environment, and exit codes pass through (`TC-BIN-053`), the installer arrays still name no binary (`TC-BIN-054`), and the whole run stays inside the scratch roots with zero network (`TC-BIN-055`). **Sixth, the structural description tells the new truth.** Two declared bins mapping to two distinct existing files (`TC-BIN-060`), exact inventory equality with per-file executable allowances (`TC-BIN-061`), exactly the declared non-exported identity literals (`TC-BIN-062`), one shared composition (`TC-BIN-063`), and every delivered guard still green *and still able to fail* (`TC-BIN-064`..`TC-BIN-067`). Documentation (`TC-BIN-070`..`TC-BIN-073`) and the aggregate gate (`TC-BIN-080`..`TC-BIN-084`) close the plan.

The plan is deliberately adversarial about the failure modes the spec names. **A parity test that cannot fail**: both bins render help through one table, so parity alone is tautological — `TC-BIN-003` pairs the diff with a family-set equality against the declared twenty and a comparator mutant that removes a row and must fail by name (PAR-TP-1). **A fallback that only checks "config loaded"**: such a test passes with a laundered path, so `TC-BIN-020` and `TC-BIN-021` assert the recorded origin path identity, not just the value. **A no-second-root claim proven by a read-only command**: a command that never opens state cannot create a root, so `TC-BIN-031` drives a state-opening command and snapshots the home listing, both roots, and the parent directory. **A notice asserted in a silent mode**: `TC-BIN-040` runs `--json` and asserts the notice is present on stderr while stdout stays one parseable payload with an unchanged exit code. **An installer test that passes with a no-op installer**: `TC-BIN-050` requires the file to be absent before the run, and `TC-BIN-051` requires the first run to change the digest and the second to leave it untouched, plus a repoint from a second source. **A structure guard with an empty corpus**: every guard ships a failing negative control, including the new literal scan, which must reject an injected fourth site (`TC-BIN-062`).

This document is a verification map, not an execution claim: no command was run against a new implementation at authoring time, and phase ownership is declared in `chg-GH-320-plan.yaml` (authored in phase 4, `delivery_planning`), not asserted here. All eleven acceptance criteria are covered; there are no TODO rows and no orphan cases. Five properties are observed through a named substitute assertion (§3.5) because one half of the wording is a byte baseline, an operator's real host root, a surface the spec does not pin, or a permanent-suite rule, and one further property is a declared-inventory assertion (§3.5, `LIT-TP-1`) rather than a substitution; each is recorded, not smoothed over. The former blocking wording finding against `AC-F7-10` / DM-6 is **resolved in spec v1.1** (four declared sites, and the entrypoint's neutral default plus its `neutralWorkingName` accessor are removed rather than retained); this revision reconciles the plan with that text and no blocking finding remains.

### 1.1 In Scope

- The two-bin process edge: the second native bin and the thin alias, both over one shared launcher composition, the per-bin declared default identity and the optional declared prior identity, and the unchanged `DELIVERY_OS_WORKING_NAME` override with the corrected lenient fallback to the invoking bin's default (F-1, F-2; AC-F1-1, AC-F1-2, AC-F2-3, AC-F2-7; DM-1; DEC-4, DEC-5, DEC-11).
- Help and version rendering per identity: the twenty prompt-required families identical in content and order, the binary name the only difference, per-command help parity, and the state-free install-path self-description member with no added family (F-1, F-6; AC-F1-2, AC-F6-8; NFR-2, NFR-9; §8.1).
- Prior-identity project configuration read: per-layer ordering over the two repository-owned layers, current-wins precedence, honest origins, unchanged `missing` skip, read-only semantics, no new warning kind, no `--strict` change, and no fallback for machine-global layers or an explicitly selected file (F-3; AC-F3-4; DM-2; DEC-7, DEC-8; NFR-4).
- Prior-identity host state root selection inside the one pure policy over injected existence facts: absolute current override precedence, current default root, prior default root, first-use creation, no current root created while the fallback holds, no prior-prefix environment read, and one root for the whole invocation including the ordinary store operations that follow (F-4; AC-F4-5; DM-3; DEC-9; NFR-4).
- The prior-identity fallback notice: one concept, one classification token, the four closed reasons, once per source kind per process, stderr in every mode including `--json`, the text contract, distinctness from the pre-GH-288 store warning and the `ADOS_`/`.ados` notice, and no payload or exit change (F-5; AC-F5-6; DM-4; DEC-10; NFR-3; Appendix B).
- The user-level local install and launcher: scratch-home local install with fetching disabled, the launcher at the brand install path with one absolute target, execution from outside the checkout, content-idempotent re-runs, repointing, the classified missing-target failure, passthrough of arguments/streams/environment/exit codes, and the unchanged delivery script/tool arrays (F-6; AC-F6-8; DM-5; DEC-12, DEC-13; NFR-5).
- Structural truth: the two-bin manifest with two distinct existing entry files, exact inventory equality plus per-file executable allowance (including the entrypoint module's allowance losing exactly `neutralWorkingName`), the declared four-site identity-literal inventory with no residual neutral default in the entrypoint module, one shared composition, the preserved installer absence with the declared launcher step, the unchanged family list and error table, and a failing negative control per guard (F-7; AC-F7-10; DM-6; DEC-5; NFR-6).
- Documentation truth: the four affected specification pages, the new local-install guide with its distribution marker and forbidden-literal registration, the declared divergences, and the unchanged public surfaces (F-8; AC-F8-11; NG-1..NG-4, NG-9; NFR-8).
- The aggregate gate, the branch-range commit-message gate, the delivered regression suites, the unchanged detached-child environment contract, and suite hermeticity (AC-F7-9; NFR-7; §8.5; NFR-2, NFR-5).

### 1.2 Out of Scope & Known Gaps

- [OUT] Package scope, the scope org, `repositoryUrl`, `docsBaseUrl`, the README, the documentation profile, and the release asset prefix: `TC-BIN-072` asserts they are **unchanged**, not that they changed (NG-1, NG-2).
- [OUT] The MCP surface's identity default and override read: `TC-BIN-072` asserts its delivered default is byte-identical; no case drives an MCP identity change (NG-4, §8.5).
- [OUT] The `ADOS_`/`.ados` legacy adapter's mapping, text, and once-per-process discipline beyond the distinctness assertion in `TC-BIN-044` (NG-5).
- [OUT] The pre-GH-288 store warning's trigger, layout, and wording beyond the distinctness assertion in `TC-BIN-044` (NG-6).
- [OUT] The delivery script/tool arrays, hook examples, template set, and plugin projection beyond the absence assertions in `TC-BIN-054` and `TC-BIN-066` (NG-7).
- [OUT] A migration, seeding, or backfill command: `TC-BIN-025` and `TC-BIN-031` assert the *absence* of writes and creations; no case migrates anything (§19, NG-3).
- [OUT] Removing or uninstalling a registered launcher, and registering a launcher for the alias: no case drives either (§7.2).
- [OUT] Extending the fallback to machine-global layers or mapping prior-prefix environment names: `TC-BIN-024` and `TC-BIN-034` assert those absences (DEC-7, DEC-9).
- [OUT] Growing the forbidden-literal seed set with the decided public name, or re-baselining the scan corpus: `TC-BIN-073` asserts the seed set is unchanged (NG-9).
- [OUT] Merging this change before GH-310 lands: the delivery stops at an open pull request; no case exercises `main-tools` beyond `TC-BIN-081`'s commit-range base.
- [GAP-T1 — the bin files are not typechecked] `packages/cli/tsconfig.json` includes `src/**` only, so both bin files are outside the typecheck. They are therefore tested by **execution** (process edge, `TC-BIN-001`, `TC-BIN-005`, `TC-BIN-006`) and by **structure** (shebang, single delegation, declared literals; `TC-BIN-060`, `TC-BIN-062`, `TC-BIN-063`). No case claims type-level coverage of a bin.
- [GAP-T2 — "byte-identical alias output" has no pre-change artifact] See BYTE-TP-1 (§3.5). Cases: 002.
- [GAP-T3 — the state half's "matches the delivered state of that root"] A permanent suite must not read or write the operator's real `~/.delivery-os-state`. See LIVE-TP-1 and SURF-TP-1 (§3.5). Cases: 030, 031, 033, 035.
- [GAP-T4 — which surface reports the effective root is delivery-bound] See SURF-TP-1 (§3.5). Cases: 030, 033, 035.
- [GAP-T5 — documentation content checks] The "affected pages state the new reality" half is enforced through the delivered `doc-conformance` phrase table plus a new guide guard (`TC-BIN-070`, `TC-BIN-071`); prose review is attested at phase 8. See DOC-TP-1.
- [GAP-T6 — delivery-bound names] Module paths, suite names, the shared launcher's signature, the exact `BrandingInputError` projection on a configuration-bearing command, and the launcher's literal text are delivery-bound. Behaviours, identities, exits, closed vocabularies, precedence, and AC traceability are not. A case that cannot resolve its seam fails naming the missing contract; it never skips.

## 2. References

| Reference | Role in this plan |
|---|---|
| [`chg-GH-320-spec.md`](./chg-GH-320-spec.md) **v1.1** | Binding source: F-1..F-8, **11 ACs** (`AC-F1-1`, `AC-F1-2`, `AC-F2-3`, `AC-F3-4`, `AC-F4-5`, `AC-F5-6`, `AC-F2-7`, `AC-F6-8`, `AC-F7-9`, `AC-F7-10`, `AC-F8-11`), NFR-1..NFR-9, DM-1..DM-6 (DM-6 = the declared **four-site** identity-literal inventory: three CLI selector sites plus the unchanged MCP default, with the entrypoint neutral default and its `neutralWorkingName` accessor removed), DEC-1..DEC-13, OQ-1..OQ-2, §5.1 capability details, §6 flows 1–5, §7 scope boundaries, §8 interfaces, §17 traceability, Appendix A (identity derivation), Appendix B (notice inventory), Appendix C (source anchors). v1.1 is the re-authored specification after the reopened specification phase: it resolves the former three-site literal conflict (`B-1`). |
| [`chg-GH-320-pm-notes.yaml`](./chg-GH-320-pm-notes.yaml) | Context only: clarify-scope findings, the four binding PM decisions D1–D4, the documentation impact map, and the GH-310 sequencing constraint. The specification is the source of truth. |
| `./chg-GH-320-plan.yaml` | **Authored in phase 4** (`delivery_planning`) and absent at authoring time. Phase ownership, per-phase test obligations, and task ordering are declared there; this plan declares what must be proven, not who proves it. |
| [`.ai/rules/testing-strategy.md`](../../../../.ai/rules/testing-strategy.md) | `bun:test` under `tests/**/*.test.ts`; fixtures never named `*.test.ts`; suites under `tests/{structure,behaviour,golden,checks,boundaries}`; permanent suites assert the current tree, never a moving base branch; goldens regenerate only by an explicit command; `pnpm check` is the aggregate gate; a boundary-rule change without a failing fixture is a gap. |
| [`.ai/rules/typescript.md`](../../../../.ai/rules/typescript.md) | Strict typing, injected environment/clock/randomness, data-only contracts, pure domain, adapters own I/O, injected fakes over `mock.module`. |
| [`.ai/rules/bash.md`](../../../../.ai/rules/bash.md) | Applies to the installer test `scripts/.tests/test-install-jaiship-launcher.sh`: `test-*.sh` naming in the adjacent `.tests/` folder, `set -Eeuo pipefail`, no unquoted expansions, hermetic temp handling. |
| [`doc/templates/test-plan-template.md`](../../../templates/test-plan-template.md) | Structural template for this document (sections, front matter, scenario fields). |
| [`chg-GH-294-test-plan.md`](../2026-11-13--GH-294--provider-peak-pausing/chg-GH-294-test-plan.md) | Format precedent: verification-map framing, exact-set-equality discipline, substitute-assertion registration (§3.5), coverage-matrix integrity table, and the automation table that lists every case. |
| **Current-truth specification pages** | [`feature-cli-entrypoint.md`](../../../spec/features/feature-cli-entrypoint.md) (one non-installed bin, the three-step identity chain, install exclusion, help/version isolation), [`feature-branding-seam.md`](../../../spec/features/feature-branding-seam.md) (twelve values, no exported literals, the `installPath` value with no consumer today), [`feature-config-layer.md`](../../../spec/features/feature-config-layer.md) (seven layers, single directory name, first-match skips), [`feature-projects.md`](../../../spec/features/feature-projects.md) (host root, project root, one policy, the pre-GH-288 store warning). |
| **Delivered structural guards consumed under test** | `tests/structure/entrypoint-bin.test.ts`, `entrypoint-installer-absence.test.ts`, `content-inventory.test.ts` + `inventory.json` (exact file-set equality and per-file executable allowances, `cli/bin/delivery-os.ts` → `["completion"]`), `branding-seam.test.ts` (no exported module-level string constant, no `BrandIdentity` field literal or twelve-field literal outside `branding`/`contracts`, with three failing negative controls), `projects-state-scope-policy.test.ts` (one home-plus-brand composition, one `_STATE_DIR` read, injected negative controls), `tests/checks/doc-conformance.test.ts` (the §16.1.1 stale/required phrase table). |
| **Delivered behaviour suites consumed as controls or extended** | `tests/behaviour/entrypoint-version.test.ts`, `entrypoint-help.test.ts`, `entrypoint-help-coverage.test.ts`, `entrypoint-help-isolation.test.ts`, `entrypoint-composition.test.ts`; `config-sources.test.ts`, `projects-config.test.ts`, `state-scope` suites; `daemon-start-detached.test.ts` (the child-environment allowlist pin at line 618); `legacy-adapter.test.ts`; `scripts/.tests/test-install.sh`; `tests/checks/prompt-conformance.ts`, `help-guide-coverage.ts`, `forbidden-literals.ts` + `forbidden-literals.registry.json`. |
| **Ticket** | GitHub issue `juliusz-cwiakalski/agentic-delivery-os#320` (milestone "M4: Public release readiness", story M4-S1a; six verbatim ACs, five tasks). |
| **Gate-environment findings** | `.ai/memory/lessons/lesson-2026-001-ci-baseline-parity-tmpdir.md` and `chg-GH-313-pm-notes.yaml` (2026-11-14 entries): the repo-local `TMPDIR` breaks `queue-production-binding` and `projects-config` (fixtures need a temp dir outside every worktree) and a foreign-filesystem `TMPDIR` breaks `ci-baseline-parity`; a same-device temp dir outside every worktree satisfies all three. `TC-BIN-080` records both invocations. |
| **Notices inventory** | Spec Appendix B: the new prior-identity notice beside the `ADOS_`/`.ados` legacy notice, the pre-GH-288 store warning, the configuration warning kinds, and the new launcher missing-target failure. |

## 3. Coverage Overview

All 11 acceptance criteria map to at least one named case, and no case is an orphan. The plan carries **54 cases** in nine blocks. The mapping is intentionally uneven in one direction: a criterion whose wording spans several independent observables is covered by more than one case (`AC-F3-4` by seven, `AC-F4-5` by seven, `AC-F6-8` by seven, `AC-F7-10` by nine across manifest, inventory, literals, composition, and the delivered guards), while every case names at least one AC. Five properties carry a declared substitute assertion (§3.5) and one carries a declared-inventory assertion (`LIT-TP-1`); all are counted as covered, with the basis stated. The former blocking wording finding (`B-1`) is **resolved in spec v1.1**: DM-6 and `AC-F7-10` now declare four sites — three CLI selector sites plus the unchanged MCP default — and require the entrypoint module to hold no residual neutral identity literal, so `TC-BIN-062` asserts that declared inventory directly instead of arguing a conflicting count.

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (condensed) | TC ID(s) | Status |
|---|---|---|---|
| AC-F1-1 | `pnpm exec jaiship --version` prints `jaiship <version> (build <build>)` on one line with exit `0`, identically under a poisoned environment or an unreadable configuration file, with no state, git, or configuration read | TC-BIN-001, TC-BIN-005 | Covered |
| AC-F1-2 | `jaiship --help` and `delivery-os --help` carry the same twenty families in content and order with the binary name as the only difference, and the comparison fails when a family is removed rather than passing vacuously | TC-BIN-003, TC-BIN-004, TC-BIN-067 | Covered (PAR-TP-1) |
| AC-F2-3 | `delivery-os --version` and `--help` are byte-identical to the delivered behaviour for the same injected version and build; `delivery-os` resolves `.delivery-os` configuration and `~/.delivery-os-state` with no prior-identity fallback | TC-BIN-002, TC-BIN-013 | Covered (BYTE-TP-1) |
| AC-F3-4 | With no `.jaiship` configuration and a `.delivery-os/config.yaml`, the prior file is read as the project-committed layer with its real path reported as the loaded file and as the origin of its values, and no write, move, copy, or deletion touches the prior directory; when both files exist the current wins and the prior is reported not used; an explicitly selected file disables every layer's fallback | TC-BIN-020, TC-BIN-021, TC-BIN-022, TC-BIN-023, TC-BIN-024, TC-BIN-025, TC-BIN-026 | Covered |
| AC-F4-5 | With no override, no `~/.jaiship-state`, and a populated `~/.delivery-os-state`, the prior host root is effective and the reported state matches that root while no `~/.jaiship-state` is created; an absolute `JAISHIP_STATE_DIR` wins with no fallback; when both default roots exist the current wins and the prior is reported not used | TC-BIN-030, TC-BIN-031, TC-BIN-032, TC-BIN-033, TC-BIN-034, TC-BIN-035, TC-BIN-036 | Covered (LIVE-TP-1, SURF-TP-1) |
| AC-F5-6 | A fallback read emits exactly one notice per source kind on stderr in any mode including `--json`, beginning with the classification token and reason, naming both locations and stating nothing was moved, copied, or deleted; repeated resolutions add none; no fallback means no notice; the delivered store warning and `ADOS_`/`.ados` notice still appear as their own distinct lines; payload and exit code unchanged | TC-BIN-040, TC-BIN-041, TC-BIN-042, TC-BIN-043, TC-BIN-044, TC-BIN-045 | Covered |
| AC-F2-7 | `DELIVERY_OS_WORKING_NAME` supplies the identity for both bins; an invalid override leaves `--version`/`--help` answering the invoking bin's default without failing while a configuration-bearing command fails closed with the resolver's classified input error and no fallback | TC-BIN-010, TC-BIN-011, TC-BIN-012, TC-BIN-014 | Covered |
| AC-F6-8 | A hermetic local install produces an executable `~/.jaiship/bin/jaiship` whose single target is the checkout's CLI entry, `jaiship --version` works from outside the checkout, an unchanged re-run does not rewrite the launcher, and a removed target exits non-zero with one bounded line naming the target and the remedy | TC-BIN-006, TC-BIN-050, TC-BIN-051, TC-BIN-052, TC-BIN-053, TC-BIN-054, TC-BIN-055 | Covered |
| AC-F7-9 | `pnpm check` is green including the branch-range commit-message gate and the delivered entrypoint, configuration, state-scope, daemon-mount, events-mount, installer, and content-inventory suites | TC-BIN-080, TC-BIN-081, TC-BIN-082, TC-BIN-083 | Covered |
| AC-F7-10 | The manifest declares exactly two identities mapping to two distinct existing entry files; the inventory equals the actual file set with a per-file executable allowance; the committed identity literals are exactly the four declared sites (the three CLI selector sites plus the unchanged MCP default) with no residual neutral default in the entrypoint module; neither installer array names a binary, entrypoint, or composer while the launcher step is declared; an injected fixture makes each guard fail by name | TC-BIN-054, TC-BIN-060, TC-BIN-061, TC-BIN-062, TC-BIN-063, TC-BIN-064, TC-BIN-065, TC-BIN-066, TC-BIN-067 | Covered |
| AC-F8-11 | The affected specification pages state the two-executable reality, the fallback and its notice, the install posture, and the host-root selection; the guide states the install path, the transitional behaviour, and every declared divergence; the public surfaces (package scope, scope org, `repositoryUrl`, `docsBaseUrl`, README, docs profile, MCP default, shell fallback) are unchanged | TC-BIN-070, TC-BIN-071, TC-BIN-072, TC-BIN-073 | Covered (DOC-TP-1) |

**Capability coverage** (every F-# has at least one TC): F-1 → 001, 003, 004, 005, 006, 063, 067; F-2 → 001, 002, 010, 011, 012, 013, 014; F-3 → 020, 021, 022, 023, 024, 025, 026; F-4 → 030, 031, 032, 033, 034, 035, 036, 065; F-5 → 040, 041, 042, 043, 044, 045; F-6 → 006, 050, 051, 052, 053, 054, 055; F-7 → 054, 060, 061, 062, 063, 064, 065, 066, 067, 073; F-8 → 070, 071, 072, 073.

**Decision coverage**: DEC-1 (fallback, not migration) → 020, 030, 035; DEC-2 (scope stays pre-freeze) → 072; DEC-3 (install posture) → 050, 052, 054; DEC-4 → 010, 013; DEC-5 → 062, 063; DEC-6 → 020, 021, 034; DEC-7 → 023, 024; DEC-8 → 020, 021, 025, 026; DEC-9 → 030, 031, 032, 033, 034, 035, 036; DEC-10 → 040, 043, 044; DEC-11 → 005, 012; DEC-12 → 050, 054; DEC-13 → 051, 052, 053.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The specification declares no REST/HTTP endpoint (§8.1: N/A) and no event, topic, or payload change (§8.2: N/A). The interface surface is the executable entry itself (§8.1 table), the six data-model elements, and the four notice reasons.

| Element | TC ID(s) | Observable assertion |
|---|---|---|
| DM-1 Executable identity selector (per bin) | 001, 002, 010, 013, 060, 062 | Two bins, each declaring one default working name; the new bin additionally declaring one prior working name; all derived values come from the resolver; no `BrandIdentity` field or resolver change. |
| DM-2 Prior-identity configuration acquisition input | 020, 021, 022, 023, 024 | An optional prior directory name plus a per-layer prior outcome (`read` or `not used`) with the layer and the prior path; skips, error codes, and warning kinds unchanged. |
| DM-3 Prior-identity host-root input | 030, 032, 033, 034, 035, 036 | Two injected existence facts (current and prior default root); the policy stays pure and filesystem-free; one home-plus-directory helper and one `<PREFIX>_STATE_DIR` read (`TC-BIN-065`). |
| DM-4 Prior-identity fallback notice | 040, 041, 042, 043, 044, 045 | One classification token `prior-identity-fallback`, four closed reasons, ≤ 1 line per source kind per process, stderr in every mode, never in a payload, never an exit change, distinct from both delivered notices. |
| DM-5 Launcher registration | 006, 050, 051, 052, 053 | One executable file at the brand install path whose content is the runtime exec of one absolute target plus the arguments; content compared on re-run; no record written anywhere else. |
| DM-6 Bounded identity-literal sites | 062, 063 | Exactly the declared selector sites, each non-exported; no working-name literal elsewhere in the CLI executable surface; the installer's one declared layout reference to the CLI entry file (`TC-BIN-066`). |
| §8.1 `<binary> --version` | 001, 002, 010, 011, 012 | `<the invoking bin's binary name> <version> (build <build>)`, one line, exit `0`, no state/git/configuration read. |
| §8.1 `<binary> --help` / `<command> --help` | 003, 004, 005 | Same families, same order, binary name the only difference; per-command help follows the invoking identity; no composition. |
| §8.1 `<binary> --print-install-path` | 006, 010 | Brand install path for the invoking identity, one line, no other output, exit `0`, no composition, no added family row. |
| §8.1 `<binary> <command> [options] [args]` | 045, 053 | The command's own `{0, 1, 2}` exit projection through the one composed program, unchanged by any notice. |
| §8.1 `<binary> <uncomposed command>` | 067 | Delivered `fallback.internal` containment naming the missing composition, exit `2`; the family set and error table gain no row. |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement (threshold) | TC ID(s) | Status |
|---|---|---|---|
| NFR-1 | Same declared selector, override, and injected environment produce the same twelve values across repeated runs; 0 name-derived values outside the resolver; 0 exported module-level identity literals | TC-BIN-010, TC-BIN-014, TC-BIN-062 | Covered |
| NFR-2 | `--version`, `--help`, and the install-path read perform 0 state reads, 0 git reads, 0 configuration reads, 0 writes, 0 network calls, and 0 composer invocations for both bins, including with a poisoned environment or an unreadable configuration file | TC-BIN-005, TC-BIN-084 | Covered |
| NFR-3 | ≤ 1 notice per source kind per process; exactly 0 when no fallback applies; 0 further notices from repeated resolutions; 0 notices carrying a value, file content, or secret; ≤ 1 line and ≤ 400 characters per notice | TC-BIN-040, TC-BIN-041, TC-BIN-042, TC-BIN-043 | Covered |
| NFR-4 | 0 writes, moves, copies, or deletions in the prior configuration directory; 0 current default root creations while the fallback holds; 0 prior-prefix override reads; 0 `--strict` changes | TC-BIN-025, TC-BIN-026, TC-BIN-031, TC-BIN-034, TC-BIN-035, TC-BIN-065 | Covered |
| NFR-5 | Re-running an unchanged local install writes 0 files in the launcher step; the gate run performs 0 network accesses with fetching disabled and writes only under the scratch home and scratch project root | TC-BIN-050, TC-BIN-051, TC-BIN-055 | Covered |
| NFR-6 | 2 declared executables, 2 distinct entry files, the declared bounded identity-literal sites, exact inventory equality, a per-file executable allowance for every executable file, and a failing negative control per guard | TC-BIN-060, TC-BIN-061, TC-BIN-062, TC-BIN-063, TC-BIN-064, TC-BIN-065, TC-BIN-066 | Covered |
| NFR-7 | `pnpm check` green including the branch-range commit-message gate; 0 regressions in the delivered alias, entrypoint, configuration, state-scope, daemon-mount, events-mount, and installer suites | TC-BIN-080, TC-BIN-081, TC-BIN-082, TC-BIN-083 | Covered |
| NFR-8 | Every remaining pre-freeze identity consumer (MCP, the delivery-script shell fallback, repository URLs, docs domain) is stated in the specification, the guide, and the change record; 0 undocumented identity paths | TC-BIN-070, TC-BIN-071, TC-BIN-072 | Covered |
| NFR-9 | `jaiship --help` and `delivery-os --help` differ only in the binary name; family rows identical in content and order | TC-BIN-003, TC-BIN-004 | Covered (PAR-TP-1) |

### 3.4 Coverage-Matrix Integrity

| Check | Value | Verdict |
|---|---|---|
| Acceptance criteria in the specification | 11 (`AC-F1-1`, `AC-F1-2`, `AC-F2-3`, `AC-F3-4`, `AC-F4-5`, `AC-F5-6`, `AC-F2-7`, `AC-F6-8`, `AC-F7-9`, `AC-F7-10`, `AC-F8-11`) | — |
| Acceptance criteria with at least one case | 11 | Pass |
| Acceptance criteria uncovered / TODO | 0 | Pass |
| Cases in this plan | 54 (`TC-BIN-001`..`TC-BIN-084`, block-structured) | — |
| Cases naming at least one AC (no orphans) | 54 | Pass |
| Cases that are manual-only | 0 | Pass |
| Cases with a substitute assertion recorded (§3.5) | 5 properties across 9 case references (8 distinct cases) | Declared |
| Cases with a declared-inventory assertion (not a substitution, §3.5) | 1 property (`LIT-TP-1`) across 1 case | Pass |
| Capabilities covered | F-1..F-8 (8/8) | Pass |
| NFRs covered | NFR-1..NFR-9 (9/9) | Pass |
| Interfaces covered | DM-1..DM-6 (6/6), §8.1 invocations (6/6) | Pass |
| Decisions covered | DEC-1..DEC-13 (13/13) | Pass |
| AC → TC direction present | §3.1 | Pass |
| TC → AC direction present | §5.1 index and every §5.2 header | Pass |
| Cases appearing in the Automation Plan (§7) | 54 of 54 | Pass |
| Blocking findings | 0 (`B-1` resolved in spec v1.1) | Pass |

### 3.5 Declared gaps, boundaries, and assertion bases

| ID | What is asserted, and how | Cases | AC / NFR |
|---|---|---|---|
| **BYTE-TP-1 — "byte-identical alias output"** | No pre-change artifact exists in the tree. **Substitute:** a committed baseline fixture `tests/fixtures/entrypoint/alias-baseline.json` is captured from the **pre-change** code path with an explicit documented command (the same injected version/build the case uses) before the bin refactor lands, and the post-change alias run must match it byte-for-byte for `--version` and `--help`. The fixture carries a `capturedFrom` field naming the commit. It is regenerated only deliberately, never by blanket rewrite (testing-strategy golden rule). | 002 | AC-F2-3 |
| **LIVE-TP-1 — "the reported state matches the delivered state of that root"** | A permanent suite must not read or write the operator's real `~/.delivery-os-state` (NFR-5, NFR-2 hermeticity) and must not depend on a workstation fact. **Substitute:** the case populates a **scratch** home with a prior root whose artifact names and store facts are a byte copy of the delivered shape, seeds one recognizable delivery record, and asserts the effective root selects it and `status --json` reports the seeded facts. Equivalence to a real moved-in workstation is demonstrated by the same code path over the copied root; a one-off **read-only** verification against the real root is recorded in §10 at delivery, never in a permanent suite. | 030, 031 | AC-F4-5 |
| **SURF-TP-1 — the effective-host-root reporting surface is delivery-bound** | The spec does not pin a payload field naming the effective root. **Substitute:** the effective root is asserted at the composition seam (the resolved value handed to the store/scope composition) **and** by where follow-on store operations land (`TC-BIN-035`), with `status --json` used for the seeded delivery facts. A case that cannot resolve either seam fails naming the missing contract. | 030, 033, 035 | AC-F4-5, NFR-3 |
| **LIT-TP-1 — the declared four-site identity-literal inventory (spec v1.1 DM-6)** | DM-6 now declares exactly four committed identity-literal sites under `packages/**` and the absence of a neutral identity literal in the entrypoint module. **Asserted directly, not substituted:** the case compares the scan result against a **declared inventory** in two scopes — the CLI scope (exactly three selector sites: `bin/jaiship.ts` default `jaiship`, `bin/jaiship.ts` prior `delivery-os`, `bin/delivery-os.ts` default `delivery-os`, all non-exported) and the unchanged-MCP scope (exactly one site: `packages/mcp/src/serve.ts` default `delivery-os`, byte-identical to the delivered value) — and additionally asserts that `packages/cli/src/entrypoint.ts` holds no identity literal and declares no `neutralWorkingName`, and that a call with no declared default produces the declared composition error / classified resolver error rather than a substituted name. Any site outside the declared inventory fails by name. Recorded here because §3.4 counts substitutions separately; this row is a direct assertion. | 062 | AC-F7-10, NFR-1, NFR-6 |
| **PAR-TP-1 — help parity non-vacuity** | Both bins render help through one table, so a pure A/B diff passes even when a family is missing from both. **Substitute:** the case pairs the diff (binary name normalised) with a **family-set equality** against the declared `PROMPT_REQUIRED_COMMANDS` twenty in both directions, plus a comparator mutant that removes one row and one that adds an extra row; each mutant must fail by name. | 003, 067 | AC-F1-2, NFR-9 |
| **DOC-TP-1 — "README, URLs, scope unchanged"** | A permanent suite must not diff against a moving base branch. **Substitute:** property assertions on the current tree — `packageScope`/scope org unchanged in the resolver and package manifests, `repositoryUrl`/`docsBaseUrl` still the pre-freeze values for both identities, README contains no installed-`jaiship` claim, the docs profile is absent, the MCP default and the shell fallback host root are byte-identical — plus the review-attested byte diff at phase 8. | 072 | AC-F8-11, NFR-8 |

## 4. Test Types and Layers

- **Behaviour (integration over the delivered seams), `bun:test` under `tests/behaviour/`** — the majority of the plan. The two-bin process edge runs both an in-process `runEntrypoint` cell with an injected declaring default and a real subprocess cell per bin (`bun packages/cli/bin/jaiship.ts`, and `pnpm exec jaiship` for the workspace-linked cell). Configuration fallback runs over the real file acquisition with injected filesystem facts **and** over a real fixture checkout on disk, so both the pure ordering rules and the end-to-end origin report are exercised. State fallback runs over the pure policy with injected existence facts **and** over a scratch home on disk. Notices are observed on injected stderr sinks and, for one cell per source kind, on the real subprocess stderr.
- **Structure (tree invariants), `bun:test` under `tests/structure/`** — manifest shape, entry-file existence, inventory equality and per-file executable allowances (including the entrypoint allowance's one-name retirement), the declared four-site identity-literal inventory, one shared composition, installer absence and the declared launcher step, plus the delivered branding-seam and state-scope scans extended in place. Every guard has a failing injected fixture; the established pattern is `validateSeam(root)`/`executableViolations(root, ...)`-style exported scanners driven over a temp root, so a mutant is proven against the production scanner rather than a re-implementation.
- **Checks (guards and doc conformance), `bun:test` under `tests/checks/`** — the hermeticity counter guard for the new suites, the documentation truth guard (phrase-table rows, guide marker, registry registration), and the forbidden-literal scan controls.
- **Bash installer test, `scripts/.tests/test-install-jaiship-launcher.sh`** — embedded assertion framework as delivered in `scripts/.tests/test-install.sh`: `mktemp -d` scratch home and scratch project root, `--no-fetch`, an isolated `HOME`, and a `PATH` shim that records any network-capable invocation (`curl`, `wget`, `git fetch|pull|clone`) so "zero network" is proven by a counter, not by the absence of an error.
- **Measured / counted bounds** — notice counts per source kind, line length (≤ 400 characters), composer-invocation counts, write counters, and launcher digest comparisons. Absences (no write, no created root, no notice, no prior-prefix read, no second composition body) are each proven three ways per the house discipline: a recording fake or armed guard, a zero counter, and an unchanged durable record or byte-level snapshot.
- **Not used:** `mock.module` substitution of the modules under test; real network; the operator's real `$HOME` as state; the real `~/.delivery-os-state` as a mutable fixture; real sleeps; `git fetch`/`git pull` in any installer test.
- **The bin files are outside the typecheck.** `packages/cli/tsconfig.json` includes `src/**` only. Both bins are therefore covered by execution and structure assertions (GAP-T1), never by a claim of type-level checking.
- **Boundaries:** no new cross-package edge is expected; `check:boundaries` runs inside the aggregate gate. If delivery introduces a declared `workspaceImports` edge, the fixture-coverage meta-check requires the negative fixture in the same change (testing-strategy fallback rule).

## 5. Test Scenarios

TC IDs use the `BIN` feature prefix and follow the capability blocks of the specification: `001`–`006` the two-bin process edge and self-description; `010`–`014` identity selection and the override seam; `020`–`026` prior-identity project configuration; `030`–`036` prior-identity host state; `040`–`045` notice discipline; `050`–`055` local install and launcher; `060`–`067` structural truth; `070`–`073` documentation truth; `080`–`084` gate and cross-cutting invariants. A new sequence appends at the end of its block; an ID is never reused for a different scenario. Every ID in this plan appears exactly once in §5.1, exactly once in §5.2, and exactly once in the §7 automation table — 54 in each.

### 5.1 Scenario Index

| TC ID | Title | Type | Impact | Priority | AC / NFR |
|---|---|---|---|---|---|
| TC-BIN-001 | The second bin answers the jaiship identity at the process edge | Happy Path | Critical | Critical | AC-F1-1; F-1, F-2; DM-1; NFR-1 |
| TC-BIN-002 | The alias keeps byte-identical version and help output | Regression | Critical | Critical | AC-F2-3; F-2; NFR-7; BYTE-TP-1 |
| TC-BIN-003 | Help family parity across the two bins is exact and non-vacuous | Happy Path | Critical | Critical | AC-F1-2; F-1; NFR-9, NFR-6; PAR-TP-1 |
| TC-BIN-004 | Per-command help follows the invoking identity and differs only in the binary name | Happy Path | Important | High | AC-F1-2; F-1; NFR-9 |
| TC-BIN-005 | Self-description isolation holds for three reads on both bins under a poisoned environment | Negative | Critical | Critical | AC-F1-1; F-1, F-2; NFR-2 |
| TC-BIN-006 | The install-path read answers per identity without adding a family | Happy Path | Important | High | AC-F6-8, AC-F1-2; F-6; DM-5 |
| TC-BIN-010 | `DELIVERY_OS_WORKING_NAME` governs both bins end to end | Happy Path | Critical | Critical | AC-F2-7; F-2; NFR-1; DEC-4 |
| TC-BIN-011 | An empty override is ignored for both bins | Edge Case | Important | High | AC-F2-7; F-2; NFR-1 |
| TC-BIN-012 | An invalid override keeps self-description usable and fails configuration closed | Negative | Critical | Critical | AC-F2-7; F-2; NFR-1; DEC-11 |
| TC-BIN-013 | The alias declares no prior identity and never reads forward | Regression | Critical | Critical | AC-F2-3; F-2; NFR-7; DEC-4 |
| TC-BIN-014 | Identity resolution is deterministic across repeated runs and both entry paths | Corner Case | Important | High | AC-F2-7; F-2; NFR-1 |
| TC-BIN-020 | The prior configuration file is read as project-committed with honest origins | Happy Path | Critical | Critical | AC-F3-4; F-3; DM-2; NFR-4; DEC-8 |
| TC-BIN-021 | The current configuration file wins and the prior file is reported not used | Happy Path | Critical | Critical | AC-F3-4; F-3; DM-2; DEC-8 |
| TC-BIN-022 | Repository-owned layers fall back independently | Corner Case | Important | High | AC-F3-4; F-3; DM-2; DEC-8 |
| TC-BIN-023 | An explicitly selected file disables fallback of every layer | Negative | Critical | High | AC-F3-4; F-3; DM-2; DEC-7 |
| TC-BIN-024 | Machine-global layers never fall back and the missing skip is unchanged | Negative | Critical | High | AC-F3-4; F-3; NFR-4; DEC-7 |
| TC-BIN-025 | The prior configuration directory is untouched and no path is laundered | Negative | Critical | Critical | AC-F3-4; F-3; NFR-4; DEC-8; RSK-2 |
| TC-BIN-026 | `--strict` semantics are unchanged by a fallback read | Regression | Critical | High | AC-F3-4; F-3; NFR-4; DEC-8 |
| TC-BIN-030 | The prior host root is effective when the current root is absent | Happy Path | Critical | Critical | AC-F4-5; F-4; DM-3; DEC-9; LIVE-TP-1, SURF-TP-1 |
| TC-BIN-031 | No current-identity root is created while the fallback holds | Negative | Critical | Critical | AC-F4-5; F-4; DM-3; NFR-4; DEC-9; RSK-1; LIVE-TP-1 |
| TC-BIN-032 | An absolute current override wins and disables the fallback | Negative | Critical | High | AC-F4-5; F-4; DM-3; DEC-9 |
| TC-BIN-033 | Both default roots present: current wins, prior reported not used | Happy Path | Critical | High | AC-F4-5; F-4; DM-3; DEC-9; SURF-TP-1 |
| TC-BIN-034 | Prior-prefix state overrides are never read | Negative | Critical | High | AC-F4-5; F-4; NFR-4; DEC-9 |
| TC-BIN-035 | One effective root serves reads and the store operations that follow | Corner Case | Critical | Critical | AC-F4-5; F-4; NFR-4; DEC-9; SURF-TP-1 |
| TC-BIN-036 | First use with neither root creates the current root and emits no notice | Regression | Important | High | AC-F4-5; F-4; DM-3; DEC-9 |
| TC-BIN-040 | Exactly one notice per source kind per process, in every mode including `--json` | Happy Path | Critical | Critical | AC-F5-6; F-5; DM-4; NFR-3 |
| TC-BIN-041 | Repeated configuration resolutions in one process add no notice | Corner Case | Critical | Critical | AC-F5-6; F-5; DM-4; NFR-3 |
| TC-BIN-042 | No notice appears when no fallback applies, including for the alias | Negative | Critical | High | AC-F5-6; F-5; DM-4; NFR-3 |
| TC-BIN-043 | The notice text is bounded, classified, and redaction-safe | Contract | Critical | Critical | AC-F5-6; F-5; DM-4; NFR-3 |
| TC-BIN-044 | The new notice is distinct from the store warning and the legacy notice | Regression | Critical | Critical | AC-F5-6; F-5; DM-4; NG-5, NG-6 |
| TC-BIN-045 | The notice changes no payload and no exit projection | Regression | Critical | Critical | AC-F5-6; F-5; DM-4; NFR-3 |
| TC-BIN-050 | A hermetic local install registers one executable launcher at the install path | Happy Path | Critical | Critical | AC-F6-8; F-6; DM-5; NFR-5; RSK-5 |
| TC-BIN-051 | An unchanged re-run rewrites nothing; another source repoints the launcher | Corner Case | Critical | Critical | AC-F6-8; F-6; DM-5; NFR-5; DEC-13 |
| TC-BIN-052 | A removed target fails classified with one bounded line and a non-zero exit | Negative | Critical | Critical | AC-F6-8; F-6; DM-5; RSK-4; DEC-13 |
| TC-BIN-053 | The launcher passes arguments, streams, environment, and exit codes through | Contract | Critical | High | AC-F6-8; F-6; DM-5; DEC-13 |
| TC-BIN-054 | Installer arrays still name no binary; the launcher step is declared | Regression | Critical | High | AC-F6-8, AC-F7-10; F-6, F-7; NG-7 |
| TC-BIN-055 | The install run is hermetic: scratch roots only, zero network, real home untouched | Negative | Critical | Critical | AC-F6-8; F-6; NFR-5; RSK-5 |
| TC-BIN-060 | Two declared bins map to two distinct existing entry files | Happy Path | Critical | Critical | AC-F7-10; F-7; DM-1, DM-6; NFR-6 |
| TC-BIN-061 | The content inventory equals the file set with per-file executable allowances, and retires exactly one entrypoint export | Regression | Critical | Critical | AC-F7-10; F-7; NFR-6 |
| TC-BIN-062 | Identity literals are exactly the declared four sites, none exported, with no residual neutral default | Contract | Critical | Critical | AC-F7-10; F-7; DM-6; NFR-1, NFR-6; DEC-5; LIT-TP-1 |
| TC-BIN-063 | One shared launcher composition; neither bin duplicates the body | Contract | Critical | Critical | AC-F7-10; F-1, F-7; NFR-6; DEC-5 |
| TC-BIN-064 | The branding seam still passes and still rejects injected violations | Regression | Critical | Critical | AC-F7-10; F-7; NFR-6 |
| TC-BIN-065 | The state-scope policy still proves one composition and one override read | Regression | Critical | Critical | AC-F7-10; F-4, F-7; NFR-4, NFR-6 |
| TC-BIN-066 | Installer absence is preserved and the launcher step is its own declaration | Regression | Important | High | AC-F7-10; F-7; NG-7 |
| TC-BIN-067 | No new family row and no new error row; parity stays non-vacuous | Regression | Critical | High | AC-F1-2, AC-F7-10; F-1, F-7; NG-8; PAR-TP-1 |
| TC-BIN-070 | The four affected specification pages state the new reality | Contract | Critical | Critical | AC-F8-11; F-8; NFR-8; DOC-TP-1 |
| TC-BIN-071 | The local-install guide ships with its marker, registration, and content | Happy Path | Critical | Critical | AC-F8-11; F-8; NFR-8 |
| TC-BIN-072 | The declared divergences are stated and the public surfaces are unchanged | Regression | Critical | Critical | AC-F8-11; F-8; NFR-8; NG-1..NG-4; DOC-TP-1 |
| TC-BIN-073 | The forbidden-literal scan stays green with an unchanged seed set | Regression | Important | High | AC-F8-11; F-7, F-8; NG-9 |
| TC-BIN-080 | The aggregate gate is green with the recorded temp-dir invocation | Happy Path | Critical | Critical | AC-F7-9; NFR-7 |
| TC-BIN-081 | The branch-range commit-message gate reports PASS | Happy Path | Important | High | AC-F7-9; NFR-7 |
| TC-BIN-082 | The delivered regression suites are green under the changed surface | Regression | Critical | Critical | AC-F7-9; NFR-7 |
| TC-BIN-083 | The detached-child environment allowlist is unchanged and still admits both identities | Corner Case | Critical | High | AC-F7-9; NFR-7; §8.5 |
| TC-BIN-084 | The new suites are hermetic: zero network, zero real-home state, zero sleeps | Negative | Critical | Critical | AC-F1-1..AC-F8-11 (guard); NFR-2, NFR-5 |

### 5.2 Scenario Details

#### TC-BIN-001 - The second bin answers the jaiship identity at the process edge

**Objective**: Prove the new executable is a real process edge declaring its own default identity: `jaiship <version> (build <build>)`, one line, exit `0`, no state, git, or configuration read — not an argument, not an environment default, not an inference from the invoked path.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F1-1, F-1, F-2, DM-1, NFR-1
**Test Type(s)**: Integration, E2E
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/entrypoint-two-bins.test.ts` (new); subprocess cells against `packages/cli/bin/jaiship.ts`
**Harness entry**: `bun test tests/behaviour/entrypoint-two-bins.test.ts --filter process-edge`
**Tags**: @backend, @behaviour, @process-edge

**Preconditions**:
- The workspace is installed (`node_modules/.bin/delivery-os` present today; `node_modules/.bin/jaiship` appears after `pnpm install` following the manifest change). The subprocess semantic cell targets `bun packages/cli/bin/jaiship.ts` so it never depends on the link state; the linked cell is an additional assertion.
- No `DELIVERY_OS_WORKING_NAME` in the spawned environment.

**Steps**:
1. Spawn `bun packages/cli/bin/jaiship.ts --version` with a scrubbed environment (no working-name override, no `JAISHIP_STATE_DIR`) and capture stdout, stderr, exit code.
2. Assert stdout is exactly one line matching `^jaiship \d+\.\d+\.\d+ \(build .+\)$`, stderr is empty, exit is `0`.
3. Spawn `pnpm exec jaiship --version` from the repository root; assert the same stdout and exit. If the workspace link is absent, fail with the named setup instruction (`pnpm install`) — never skip.
4. Assert the manifest maps `jaiship` to an existing file whose first line is `#!/usr/bin/env bun`, so the process edge is real and not a shim that re-spawns `delivery-os`.
5. Repeat step 1 in a temp working directory outside the checkout; assert identical output.

**Expected Outcome**:
- Exactly `jaiship <version> (build <build>)` on one line, exit `0`, empty stderr, from inside and outside the checkout, through both the direct entry file and the workspace link.
- No manifest-based inference, no wrapper re-spawn, no argument-driven identity.

#### TC-BIN-002 - The alias keeps byte-identical version and help output

**Objective**: Prove `delivery-os` observable self-description is unchanged byte for byte for the same injected version and build, so the second bin cannot silently rewrite the alias's rendered surface.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F2-3, F-2, NFR-7; BYTE-TP-1
**Test Type(s)**: Regression, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/entrypoint-two-bins.test.ts` (new); baseline fixture `tests/fixtures/entrypoint/alias-baseline.json` (new, captured pre-change)
**Harness entry**: `bun test tests/behaviour/entrypoint-two-bins.test.ts --filter alias-baseline`
**Tags**: @backend, @behaviour, @regression, @golden

**Preconditions**:
- The baseline fixture is captured from the **pre-change** tree with an explicit documented command and carries `capturedFrom: <commit>`, the injected `version`/`build`, and the exact stdout for `--version` and `--help`.
- The same injected `version`/`build` is used in the post-change run.

**Steps**:
1. Run the alias entry (`runEntrypoint` with the alias's declared default identity, and the subprocess `bun packages/cli/bin/delivery-os.ts`) for `--version` and for `--help` with the fixture's version/build.
2. Compare each stdout byte-for-byte with the fixture value; compare stderr (empty) and exit (`0`).
3. Assert the fixture's `capturedFrom` commit is an ancestor of HEAD and that no version-bearing baseline file changed in this branch without an explicit regeneration marker in the change record.
4. Assert the alias declares no prior identity (its identity outcome carries no prior), so `TC-BIN-013`'s forward-read cannot apply to it.

**Expected Outcome**:
- `delivery-os --version` and `--help` are byte-identical to the pre-change baseline; no stderr; exit `0`.
- The baseline was regenerated (if at all) deliberately and only as a declared delta.

#### TC-BIN-003 - Help family parity across the two bins is exact and non-vacuous

**Objective**: Prove NFR-9 and the first half of AC-F1-2: the same twenty prompt-required families in the same order with the binary name as the only difference, and prove the comparison can fail.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F1-2, F-1, NFR-9, NFR-6; PAR-TP-1
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/entrypoint-two-bins.test.ts` (new); extends the delivered `entrypoint-help.test.ts` family list
**Harness entry**: `bun test tests/behaviour/entrypoint-two-bins.test.ts --filter family-parity`
**Tags**: @backend, @behaviour, @contract

**Preconditions**:
- `PROMPT_REQUIRED_COMMANDS` is imported directly (dependency-free module) as the declared family list.
- Root help is rendered for both identities with the same injected version/build.

**Steps**:
1. Render root help for both identities; parse the family rows (the command column of the command table) into ordered lists.
2. Assert both lists equal `PROMPT_REQUIRED_COMMANDS` exactly — same length (20), same order, no extras, no omissions.
3. Normalise the binary name in both outputs (replace each identity's `binaryName` with `<bin>`) and assert the two normalised texts are byte-identical; assert the un-normalised texts differ only at binary-name occurrences (count and positions reported).
4. Comparator negative control: remove one family from a copy of the parsed list and assert the comparator fails naming that family; add one undeclared family and assert it fails naming the extra. Print both mutants' verdicts.
5. Assert the compared corpus is non-empty (20 rows) so an empty or unparseable render cannot pass vacuously.

**Expected Outcome**:
- Family row set and order are exactly the declared twenty for both bins; the normalised help texts are identical; the only raw difference is the binary name.
- Both mutants fail by name; the comparison cannot pass on an empty corpus.

#### TC-BIN-004 - Per-command help follows the invoking identity and differs only in the binary name

**Objective**: Prove the per-command help surface carries the invoking identity (spec §8.1 `jaiship <command> --help`), so a user of the new bin never sees the alias's name in examples.
**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F1-2, F-1, NFR-9
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/entrypoint-two-bins.test.ts` (new); uses the delivered `allHelpEntries()` inventory
**Harness entry**: `bun test tests/behaviour/entrypoint-two-bins.test.ts --filter per-command-help`
**Tags**: @backend, @behaviour, @contract

**Preconditions**:
- The delivered help inventory is enumerable without composing any command runtime.

**Steps**:
1. For every help entry with a non-empty path, render it for both identities.
2. Assert the two renders are identical after binary-name normalisation, and that the raw difference is confined to the binary name.
3. Assert every render contains the invoking identity's binary name at least once in the usage/synopsis line (so the identity is genuinely applied, not absent from both).
4. Assert the entry count equals the delivered inventory count and is > 0.

**Expected Outcome**:
- Every per-command help page follows its identity and differs only by the binary name; the identity is present, not vacuously absent.

#### TC-BIN-005 - Self-description isolation holds for three reads on both bins under a poisoned environment

**Objective**: Prove NFR-2 for `--version`, `--help`, and `--print-install-path` on both bins: zero state reads, zero git reads, zero configuration reads, zero writes, zero network calls, zero composer invocations — even with a poisoned environment and an unreadable configuration file present.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F1-1, F-1, F-2, NFR-2
**Test Type(s)**: Negative, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/entrypoint-two-bins.test.ts` (new); delivered isolation harness in `entrypoint-help-isolation.test.ts` (extended)
**Harness entry**: `bun test tests/behaviour/entrypoint-two-bins.test.ts --filter isolation`
**Tags**: @backend, @behaviour, @isolation, @negative

**Preconditions**:
- A temp working directory containing `.delivery-os/config.yaml` with invalid YAML and `.jaiship/config.yaml` with invalid YAML.
- A poisoned environment: `DELIVERY_OS_WORKING_NAME=poisoned-product`, `JAISHIP_STATE_DIR=<temp>`, `DELIVERY_OS_STATE_DIR=<temp>`, `HOME=<temp>`, `CI=true`, a canary secret in `GITHUB_TOKEN`.
- A composer that throws if called, counting invocations; filesystem/state ports wrapped to count reads and writes.

**Steps**:
1. For each bin × each of the three reads, run with the poisoned environment and assert: exit `0`, the identity-appropriate output, empty stderr, composer invocations `0`, state/git/configuration read counters `0`, write counter `0`, network counter `0`.
2. Assert the temp working directory listing is unchanged (no file created, no directory created) and the injected home listing is unchanged.
3. Assert the direct-versus-clean output equality: the same read under a clean environment yields the same bytes (the poison changes nothing).
4. Assert the canary secret never appears in either stream.

**Expected Outcome**:
- All six read cells isolated with all counters zero, identical output under poison, no filesystem change, no secret leak.

#### TC-BIN-006 - The install-path read answers per identity without adding a family

**Objective**: Prove the installer's path authority: `--print-install-path` answers the brand install path for the invoking identity, one line, no other output, exit `0`, no composition — and that it adds no prompt-required family row and is not a global flag.
**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F6-8, AC-F1-2, F-6, DM-5
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/entrypoint-two-bins.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/entrypoint-two-bins.test.ts --filter install-path`
**Tags**: @backend, @behaviour, @contract

**Preconditions**:
- No working-name override; a composer that throws if called.

**Steps**:
1. Run `--print-install-path` through the `jaiship` selector; assert stdout is exactly `~/.jaiship/bin/jaiship\n`, exit `0`, stderr empty, composer invocations `0`.
2. Repeat through the `delivery-os` selector; assert exactly `~/.delivery-os/bin/delivery-os\n`.
3. With `DELIVERY_OS_WORKING_NAME=acme`, assert both selectors answer `~/.acme/bin/acme` (the override wins for the path too).
4. Assert the token does not appear in `PROMPT_REQUIRED_COMMANDS`, is not listed as a global flag in root help, and root help's family rows are unchanged by its presence (family count still 20).
5. Assert the value is the resolver's `installPath` (prefix `~/` unexpanded) and not a shell-composed path: the same value is read from the identity resolver for the same input.

**Expected Outcome**:
- One line per identity, exact resolver value, zero composition, no family row, no global-flag advertisement.

#### TC-BIN-010 - `DELIVERY_OS_WORKING_NAME` governs both bins end to end

**Objective**: Prove the single override seam: a non-empty override supplies the identity for both bins, and every derived value follows it — binary name, environment prefix, configuration directory, state directory, install path.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F2-7, F-2, NFR-1, DEC-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/identity-override.test.ts` (new); extends `entrypoint-version.test.ts`
**Harness entry**: `bun test tests/behaviour/identity-override.test.ts`
**Tags**: @backend, @behaviour, @identity

**Preconditions**:
- A fixture checkout holding only `.acme/config.yaml` with one distinguishable key.
- A scratch home with `~/.acme-state` populated.

**Steps**:
1. With `DELIVERY_OS_WORKING_NAME=acme`, run `--version` through each bin; assert both print `acme <version> (build <build>)`.
2. Run `--print-install-path` through each bin; assert both print `~/.acme/bin/acme`.
3. Run a configuration-bearing command in the fixture checkout through each bin; assert the `.acme/config.yaml` value is in effect (no fallback to `.delivery-os` or `.jaiship`).
4. Assert the state root selected is `~/.acme-state` (via the composition seam, `SURF-TP-1`) and that an absolute `ACME_STATE_DIR` is honoured.
5. Assert no `.jaiship`/`.delivery-os` directory is created in the fixture checkout and no `~/.jaiship-state` exists after the runs.

**Expected Outcome**:
- Both bins derive `acme` everywhere; no identity mixing; no fallback when the override supplies an identity with its own artifacts present.

#### TC-BIN-011 - An empty override is ignored for both bins

**Objective**: Prove the delivered empty-value handling survives the two-bin change: an empty `DELIVERY_OS_WORKING_NAME` is not an identity, so each bin answers its own declared default without error.
**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F2-7, F-2, NFR-1
**Test Type(s)**: Edge Case
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/identity-override.test.ts` (new); extends `entrypoint-version.test.ts` (which already pins the empty-override case)
**Harness entry**: `bun test tests/behaviour/identity-override.test.ts --filter empty-override`
**Tags**: @backend, @behaviour, @edge

**Preconditions**:
- `DELIVERY_OS_WORKING_NAME=""` and `DELIVERY_OS_WORKING_NAME="   "` variants.

**Steps**:
1. With the empty override, run `--version` through each bin; assert `jaiship ...` and `delivery-os ...` respectively, exit `0`, stderr empty.
2. Repeat with the whitespace-only override; assert the same outcome (a whitespace override is not a usable name; the delivered behaviour falls back rather than failing for self-description).
3. Run a configuration-bearing command with the empty override; assert it behaves exactly as with no override (same configured directory, no classified error).
4. Assert no notice is emitted for either outcome.

**Expected Outcome**:
- Empty and whitespace-only overrides are ignored; each bin answers its declared default; configuration path unaffected; no notice.

#### TC-BIN-012 - An invalid override keeps self-description usable and fails configuration closed

**Objective**: Prove DEC-11 and AC-F2-7: an invalid override leaves `--version`/`--help` answering the **invoking bin's** declared default identity without failing, while a configuration-bearing command fails closed with the resolver's classified input error and no fallback.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F2-7, F-2, NFR-1, DEC-11
**Test Type(s)**: Negative, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/identity-override.test.ts` (new); extends `entrypoint-help-isolation.test.ts`
**Harness entry**: `bun test tests/behaviour/identity-override.test.ts --filter invalid-override`
**Tags**: @backend, @behaviour, @negative

**Preconditions**:
- Invalid override set: `bad/name` (path separator), `   ` (whitespace-only), a 65-character name (too long) — at least the path-separator case is mandatory.
- A fixture checkout with `.delivery-os/config.yaml` present, so a fallback *would* be possible if the failure were mishandled.

**Steps**:
1. For each bin and each invalid override, run `--version` and `--help`; assert exit `0`, the invoking bin's declared default identity in the output (`jaiship ...` / `delivery-os ...`), empty stderr, and composer invocations `0`.
2. Run a configuration-bearing command (`status --json`) with the invalid override through each bin; assert a non-zero exit and a **classified** resolver-input failure naming the `override` field with a code from the closed `BrandingInputErrorCode` set (`path-separator`, `whitespace-only`, `too-long`, …).
3. Assert the failure is not `fallback.internal` containment and not a silent fallback to the invoking bin's declared default: the error identity names `override`.
4. Assert no prior-identity read occurred (zero filesystem reads of `.delivery-os`/`.jaiship` through the injected facts), no notice was emitted, and no state root was opened.
5. Assert the self-description output with the invalid override equals the self-description output with no override for the same bin.

**Expected Outcome**:
- Self-description always answers the invoking bin's default; the configuration path fails closed with the classified `override` error; no fallback, no notice, no state.

#### TC-BIN-013 - The alias declares no prior identity and never reads forward

**Objective**: Prove the second half of AC-F2-3: the alias resolves `.delivery-os` configuration and `~/.delivery-os-state` exactly as delivered and performs **no** prior-identity fallback, even when `.jaiship` artifacts exist beside them.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F2-3, F-2, NFR-7, DEC-4
**Test Type(s)**: Regression
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/prior-identity-config-fallback.test.ts` (new) and `prior-identity-state-fallback.test.ts` (new); alias half
**Harness entry**: `bun test tests/behaviour/prior-identity-config-fallback.test.ts --filter alias`
**Tags**: @backend, @behaviour, @regression

**Preconditions**:
- Fixture checkout with `.jaiship/config.yaml` absent and `.delivery-os/config.yaml` present.
- Scratch home with both `~/.jaiship-state` and `~/.delivery-os-state` absent, only the latter created later in step 4.

**Steps**:
1. Run `delivery-os status --json` in the fixture checkout; assert the `.delivery-os` configuration is read as the project-committed layer with its own path as origin.
2. Assert stderr carries no `prior-identity-fallback` notice (the alias declares no prior identity).
3. Delete `.delivery-os/config.yaml` and create only `.jaiship/config.yaml`; run the alias again; assert the `.jaiship` file is **not** read (project-committed is `missing`) and no notice appears — the alias never reads forward.
4. With only `~/.jaiship-state` present, run the alias; assert the effective host root is `~/.delivery-os-state` (created as ordinary first use) and not `~/.jaiship-state`.
5. Assert the alias's exit projections and payloads equal the delivered behaviour for the same fixtures.

**Expected Outcome**:
- The alias is exactly as delivered: `.delivery-os` only, no forward read, no notice, no identity mixing.

#### TC-BIN-014 - Identity resolution is deterministic across repeated runs and both entry paths

**Objective**: Prove NFR-1's determinism half: the same declared selector, override, and injected environment produce the same twelve values across repeated runs and across the process edge and the in-process entrypoint.
**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F2-7, F-2, NFR-1
**Test Type(s)**: Corner Case, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/identity-override.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/identity-override.test.ts --filter determinism`
**Tags**: @backend, @behaviour, @determinism

**Preconditions**:
- A matrix of inputs: `{declared default}` × `{no override, valid override, empty override, invalid override}` × `{clean home, poisoned home}`.

**Steps**:
1. For each matrix cell, resolve the identity twice in-process and once through the process edge (`--print-install-path` plus `--version`); compare the twelve values and the rendered strings.
2. Assert repeated runs are identical for every cell (no dependence on clock, cwd, or environment ordering).
3. Assert the derived values contain no ambient path: the same inputs with a different `cwd` and a different `HOME` produce the same identity values (the install path is `~/…`, not home-expanded).
4. Assert the identity is computed only through the resolver: a scanner asserts no name-derived value is composed outside `core/src/branding` (structure half in `TC-BIN-062`).

**Expected Outcome**:
- Identical values per cell across repetitions and paths; no cwd/home dependence; resolver is the single derivation point.

#### TC-BIN-020 - The prior configuration file is read as project-committed with honest origins

**Objective**: Prove the visible half of AC-F3-4: with no `.jaiship` configuration and a `.delivery-os/config.yaml`, the prior file is read **as the project-committed layer**, its real path is the loaded file, and every value it supplies reports that path as origin.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F3-4, F-3, DM-2, NFR-4, DEC-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/prior-identity-config-fallback.test.ts` (new); fixture checkout `tests/fixtures/entrypoint/prior-identity/config-only/.delivery-os/config.yaml`
**Harness entry**: `bun test tests/behaviour/prior-identity-config-fallback.test.ts --filter prior-read`
**Tags**: @backend, @behaviour, @config, @fallback

**Preconditions**:
- A fixture checkout with a real git root, no `.jaiship/` directory, and `.delivery-os/config.yaml` declaring at least two keys (one typed, one unrelated) with distinguishable values.
- File acquisition runs with production filesystem facts over the fixture root (real disk), and the pure acquisition also runs with injected facts for the ordering half.

**Steps**:
1. Resolve configuration for the `jaiship` identity in the fixture checkout.
2. Assert exactly one source fact carries layer `project-committed`, and its `file` is the absolute `.delivery-os/config.yaml` path (not a synthesized `.jaiship` path).
3. Assert each value supplied by that file reports the same absolute prior path through the delivered origin label; assert no origin reads `.jaiship/config.yaml`.
4. Assert the fallback outcome records `read` for the project-committed layer with the prior path, and that the skip list contains no new reason (project-committed is not also `missing`).
5. Run `jaiship status --json`; assert exit `0`, a single parseable payload, and stderr carrying exactly one `prior-identity-fallback: config-read` line.

**Expected Outcome**:
- Prior file read as project-committed, real path as loaded file and as origin of every value, one `config-read` notice, unchanged payload shape and exit.

#### TC-BIN-021 - The current configuration file wins and the prior file is reported not used

**Objective**: Prove current-wins precedence: when both `.jaiship/config.yaml` and `.delivery-os/config.yaml` exist at the same layer, the current file is read, the prior file contributes nothing, and its presence is reported as `config-skipped`.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F3-4, F-3, DM-2, DEC-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/prior-identity-config-fallback.test.ts` (new); fixture `tests/fixtures/entrypoint/prior-identity/both-layers/`
**Harness entry**: `bun test tests/behaviour/prior-identity-config-fallback.test.ts --filter current-wins`
**Tags**: @backend, @behaviour, @config, @precedence

**Preconditions**:
- Both files declare the **same key** with different values, so precedence is observable, plus one key unique to each.

**Steps**:
1. Resolve configuration for `jaiship`; assert the shared key takes the current file's value and its origin is the current path.
2. Assert the key unique to the prior file is **absent** (the prior file is not merged), proving the file was not read at all rather than read-and-overridden.
3. Assert the per-layer prior outcome is `not used` with the prior path recorded.
4. Run a composed command; assert exactly one `prior-identity-fallback: config-skipped` line on stderr naming both locations, and no `config-read` line.
5. Repeat for `project-local` in `TC-BIN-022`.

**Expected Outcome**:
- Current file authoritative; prior file not read; prior presence reported once as `config-skipped`; no silent merge.

#### TC-BIN-022 - Repository-owned layers fall back independently

**Objective**: Prove per-layer granularity: a layer whose current file exists does not fall back, while the other repository-owned layer still does — and a fallback at one layer never changes the other layer's skip semantics.
**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F3-4, F-3, DM-2, DEC-8
**Test Type(s)**: Edge Case, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/prior-identity-config-fallback.test.ts` (new); fixtures `tests/fixtures/entrypoint/prior-identity/mixed-layers/`, `.../local-only/`
**Harness entry**: `bun test tests/behaviour/prior-identity-config-fallback.test.ts --filter per-layer`
**Tags**: @backend, @behaviour, @config

**Preconditions**:
- Case matrix: (a) `.jaiship/config.yaml` present + only `.delivery-os/config.local.yaml` present; (b) only `.delivery-os/config.local.yaml` present; (c) `.jaiship/config.local.yaml` present + only `.delivery-os/config.yaml` present.

**Steps**:
1. For (a): assert project-committed reads the current file (no prior notice for that layer) and project-local reads the prior local file as `project-local` with its real path as origin; exactly one notice (`config-read`) — the per-source-kind count is one, not per layer.
2. For (b): assert project-committed is the delivered `missing` skip and project-local reads the prior file; one `config-read` notice.
3. For (c): assert project-committed reads the prior committed file and project-local reads the current local file; one `config-read` notice.
4. Assert in all three that layer labels stay exactly the seven delivered labels and that a prior file never appears under a different layer than its own kind.

**Expected Outcome**:
- Each repository-owned layer selects independently; the layer label is truthful; the notice is per source kind, not per layer.

#### TC-BIN-023 - An explicitly selected file disables fallback of every layer

**Objective**: Prove DEC-7's selection half: when a file is selected explicitly, it occupies the project-committed slot and **no** layer falls back, including project-local.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-4, F-3, DM-2, DEC-7
**Test Type(s)**: Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/prior-identity-config-fallback.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/prior-identity-config-fallback.test.ts --filter selected-config`
**Tags**: @backend, @behaviour, @config, @negative

**Preconditions**:
- A selected file outside the checkout, plus a fixture checkout holding both `.delivery-os/config.yaml` and `.delivery-os/config.local.yaml`, plus a `.jaiship/` absent.

**Steps**:
1. Resolve configuration with the selected file; assert exactly one project-committed source whose path is the selected file.
2. Assert project-local's skip is the delivered `selected-config` reason — not `missing`, not a fallback read.
3. Assert the prior committed file was not read (its unique key absent) and no `prior-identity-fallback` notice appears for configuration.
4. Assert the selected-file failure path is unchanged: a non-existent selected file yields the delivered unreadable `project-committed` failure naming the selected path (never a prior candidate).

**Expected Outcome**:
- Explicit selection wins outright, disables every layer's fallback, preserves delivered skips, and emits no configuration notice.

#### TC-BIN-024 - Machine-global layers never fall back and the missing skip is unchanged

**Objective**: Prove the trust-boundary half of DEC-7 and NFR-4: the system and user-global layers never read a prior-identity file, and when neither current nor prior project file exists the delivered `missing` skip is recorded with no new skip reason and no notice.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-4, F-3, NFR-4, DEC-7
**Test Type(s)**: Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/prior-identity-config-fallback.test.ts` (new); scratch home + injected platform facts
**Harness entry**: `bun test tests/behaviour/prior-identity-config-fallback.test.ts --filter global-layers`
**Tags**: @backend, @behaviour, @config, @negative

**Preconditions**:
- Scratch home containing `~/.config/.delivery-os/config.yaml` and `~/.config/.jaiship/config.yaml`; platform fixture `linux`; a system candidate directory holding `.delivery-os/config.yaml` and no `.jaiship` equivalent.
- A fixture checkout with neither project file.

**Steps**:
1. Resolve configuration for `jaiship`; assert the user-global layer reads only `.jaiship/config.yaml` (current identity) and the system layer reads only its current-identity candidate.
2. With the current-identity user-global file removed and only the prior one present, assert the layer records `missing` (delivered skip) — no prior read, no new skip reason, no notice.
3. Assert the project layers both record `missing` and that the total skip list equals the delivered shape for the same fixture (no added or renamed reasons).
4. Assert zero reads of any `.delivery-os` path outside the two repository-owned layers (counted through the injected filesystem facts).

**Expected Outcome**:
- Machine-global layers never fall back; the `missing` skip and the skip vocabulary are unchanged; no notice.

#### TC-BIN-025 - The prior configuration directory is untouched and no path is laundered

**Objective**: Prove the read-only guarantee and origin honesty in one snapshot: the prior directory is byte-identical after a fallback read, no `.jaiship/` directory is created, and no value reports a current-identity path it did not come from.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F3-4, F-3, NFR-4, DEC-8, RSK-2
**Test Type(s)**: Negative, Measured
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/prior-identity-config-fallback.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/prior-identity-config-fallback.test.ts --filter read-only`
**Tags**: @backend, @behaviour, @negative, @filesystem

**Preconditions**:
- A fixture checkout whose `.delivery-os/` holds `config.yaml` and `config.local.yaml` with known bytes, modes, and mtimes (mtimes set explicitly, not "now").
- A recursive snapshot function (relative path, size, mode, digest, mtime) recorded before the run.

**Steps**:
1. Take the pre-run snapshot of the whole checkout (including `.delivery-os/` and a sentinel file at the root).
2. Run a fallback invocation that resolves configuration and a state-opening command.
3. Take the post-run snapshot; assert equality for every entry under `.delivery-os/` and for the sentinel.
4. Assert `.jaiship/` does not exist after the run, and no new file or directory appeared anywhere in the checkout.
5. Assert every origin reported for a prior-supplied value is the prior absolute path; count values whose origin starts with the current directory name (must be zero).

**Expected Outcome**:
- Zero writes, moves, copies, or deletions in the prior directory; no current-identity directory created; zero laundered origins.

#### TC-BIN-026 - `--strict` semantics are unchanged by a fallback read

**Objective**: Prove DEC-8's strictness half: a prior-identity read is not a configuration warning, so `--strict` neither fails nor gains a warning kind, and the delivered warning kinds' semantics are untouched.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-4, F-3, NFR-4, DEC-8
**Test Type(s)**: Regression
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/prior-identity-config-fallback.test.ts` (new); delivered strict fixtures extended
**Harness entry**: `bun test tests/behaviour/prior-identity-config-fallback.test.ts --filter strict`
**Tags**: @backend, @behaviour, @regression

**Preconditions**:
- Three fixtures: prior-read only (no warnings expected), current read with a delivered `deprecated` key (warning expected), and a fixture with no file (`missing`).
- The delivered strict control: a genuine `config.warning.strict` fixture from the config-layer suites.

**Steps**:
1. Run the prior-read fixture under `--strict`; assert exit `0`, no `config.warning.strict`, and one `config-read` notice on stderr.
2. Run the delivered `deprecated` fixture under `--strict`; assert the delivered failure projection is unchanged (so strictness still works) and no prior notice appears.
3. Assert the warning-kind vocabulary is unchanged (no new kind) and that the notice never travels the warning channel: assert the payload's warning list is empty in step 1 while stderr has the notice.
4. Assert a prior read cannot turn into `config.warning.strict` even when the prior file contains a deprecated key — the prior file is read as the same layer, so a *delivered* warning may legitimately appear, but no new kind does; record which delivered warning appears, if any.

**Expected Outcome**:
- Strictness unchanged; no new warning kind; the notice is categorically separate from the warning channel.

#### TC-BIN-030 - The prior host root is effective when the current root is absent

**Objective**: Prove the first clause of AC-F4-5 on a scratch home that mirrors a moved-in workstation: no `JAISHIP_STATE_DIR`, no `~/.jaiship-state`, a populated `~/.delivery-os-state` → the prior root is the effective root and the reported delivery state matches that root's delivered state.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F4-5, F-4, DM-3, DEC-9; LIVE-TP-1, SURF-TP-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/prior-identity-state-fallback.test.ts` (new); scratch home populated from `tests/fixtures/entrypoint/prior-identity/host-root/`
**Harness entry**: `bun test tests/behaviour/prior-identity-state-fallback.test.ts --filter prior-root`
**Tags**: @backend, @behaviour, @state, @fallback

**Preconditions**:
- Scratch `HOME` containing `~/.delivery-os-state/` with the delivered artifact shape (`host-index.json`, `projects/<key>/` with a ledger, header, index, fence) and one recognizable delivery record seeded in the project store.
- A fixture checkout whose identity marker derives the same project key as the seeded project.
- No `~/.jaiship-state`, no `JAISHIP_STATE_DIR`.

**Steps**:
1. Resolve the state scope for `jaiship`; assert the host root equals `<scratch home>/.delivery-os-state` (injected existence facts: current absent, prior present).
2. Run `jaiship status --json` in the fixture checkout; assert the seeded delivery record is reported (the delivered state of that root is visible), exit `0`, one parseable payload.
3. Assert stderr carries exactly one `prior-identity-fallback: state-read` line naming both roots.
4. Assert the reported project root is `<prior host root>/projects/<key>` and the project key equals the checkout's marker key.

**Expected Outcome**:
- Prior root effective; its delivered state visible through `status --json`; one `state-read` notice naming both roots; no current root.

#### TC-BIN-031 - No current-identity root is created while the fallback holds

**Objective**: Prove the anti-orphaning guarantee (RSK-1): while the prior root is in effect, no `~/.jaiship-state` root is created — even by a state-opening command, not just by a read-only one.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F4-5, F-4, DM-3, NFR-4, DEC-9, RSK-1; LIVE-TP-1
**Test Type(s)**: Negative, Measured
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/prior-identity-state-fallback.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/prior-identity-state-fallback.test.ts --filter no-second-root`
**Tags**: @backend, @behaviour, @state, @negative

**Preconditions**:
- The populated scratch home of `TC-BIN-030`.
- A pre-run listing of the scratch home root, plus the absence of `.jaiship-state`.

**Steps**:
1. Snapshot the scratch home listing (names, digests for directories' direct children).
2. Run three invocations through `jaiship`: a read-only command (`status --json`), a store-opening command that performs maintenance, and a mutating command (`queue`-family write) in the fixture checkout.
3. After each, assert `~/.jaiship-state` does not exist and the home listing is unchanged except for entries inside `~/.delivery-os-state` produced by the mutating command.
4. Assert the mutating command's writes landed under the prior root's project store (path assertion), never under a current-identity path.
5. Assert a deliberately armed guard (a recording filesystem port that fails on any create under the current default root path) was exercised by all three invocations and recorded zero violations.

**Expected Outcome**:
- Zero current-root creations across read, store-opening, and mutating invocations; writes land in the prior root; the guard is proven live.

#### TC-BIN-032 - An absolute current override wins and disables the fallback

**Objective**: Prove override precedence (DEC-9): an absolute `JAISHIP_STATE_DIR` is an intentional choice, wins outright, and disables the prior-root fallback even when the prior root is populated.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-5, F-4, DM-3, DEC-9
**Test Type(s)**: Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/prior-identity-state-fallback.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/prior-identity-state-fallback.test.ts --filter override-wins`
**Tags**: @backend, @behaviour, @state, @precedence

**Preconditions**:
- Populated prior root in the scratch home; an absolute `JAISHIP_STATE_DIR` under a different scratch directory.

**Steps**:
1. Resolve the scope with the override set; assert the host root equals the override path (trailing separators trimmed) and the prior existence fact was not consulted for selection.
2. Run `status --json`; assert no `state-read`/`state-skipped` notice appears and the store is the override's store (a distinct seeded record proves which store was read).
3. Assert a relative override still fails with the delivered `config.value.invalid` naming `JAISHIP_STATE_DIR`, with no fallback and no notice.
4. Assert the scratch home's prior root is byte-identical after the run (the override run never touched it).

**Expected Outcome**:
- Absolute override wins and disables the fallback; relative override refused as delivered; prior root untouched; no notice.

#### TC-BIN-033 - Both default roots present: current wins, prior reported not used

**Objective**: Prove the shadowing half of AC-F4-5: when both `~/.jaiship-state` and `~/.delivery-os-state` exist, the current root is used and the prior root's presence is reported as `state-skipped`.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-5, F-4, DM-3, DEC-9; SURF-TP-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/prior-identity-state-fallback.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/prior-identity-state-fallback.test.ts --filter both-roots`
**Tags**: @backend, @behaviour, @state, @precedence

**Preconditions**:
- Scratch home with both roots populated, each with a distinct seeded record so the read root is identifiable.

**Steps**:
1. Resolve the scope; assert the host root is `~/.jaiship-state`.
2. Run `status --json`; assert the current root's seeded record is reported and the prior root's record is absent.
3. Assert exactly one `prior-identity-fallback: state-skipped` line naming both roots; no `state-read`.
4. Assert the prior root is byte-identical after the run.

**Expected Outcome**:
- Current root wins; prior reported once as not used; no read from and no write to the prior root.

#### TC-BIN-034 - Prior-prefix state overrides are never read

**Objective**: Prove the security-relevant half of DEC-9: `DELIVERY_OS_STATE_DIR` is not mapped onto the new identity, so an override never silently crosses identities.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-5, F-4, NFR-4, DEC-9
**Test Type(s)**: Negative, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/prior-identity-state-fallback.test.ts` (new); pure-policy case in `tests/structure/state-scope.test.ts` (extended)
**Harness entry**: `bun test tests/behaviour/prior-identity-state-fallback.test.ts --filter prior-prefix`
**Tags**: @backend, @behaviour, @state, @negative, @security

**Preconditions**:
- `DELIVERY_OS_STATE_DIR=<absolute temp path>` set, `JAISHIP_STATE_DIR` unset.
- The prior default root populated; the current default root absent.

**Steps**:
1. Run `jaiship --print-state-root`-equivalent observation through the composition seam; assert the effective root is the prior default root, **not** the `DELIVERY_OS_STATE_DIR` path.
2. Assert the pure policy reads exactly one override name (`JAISHIP_STATE_DIR` for the jaiship identity): a counting environment record asserts zero reads of `DELIVERY_OS_STATE_DIR`.
3. Assert the same for the alias: it reads `DELIVERY_OS_STATE_DIR` (its own prefix) and never `JAISHIP_STATE_DIR`.
4. Assert no notice is emitted for the prior-prefix override (it is not a fallback, it is simply not read).

**Expected Outcome**:
- Prior-prefix override ignored for the new identity; one override read per identity; no cross-identity mapping.

#### TC-BIN-035 - One effective root serves reads and the store operations that follow

**Objective**: Prove single-rootedness (DEC-9): a fallback invocation uses the prior host root for reads **and** for the ordinary store operations that follow, so one store is never split across two roots.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F4-5, F-4, NFR-4, DEC-9; SURF-TP-1
**Test Type(s)**: Integration, Corner Case
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/prior-identity-state-fallback.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/prior-identity-state-fallback.test.ts --filter single-root`
**Tags**: @backend, @behaviour, @state, @corner

**Preconditions**:
- Populated prior root with an existing project store and a seeded record; no current root.

**Steps**:
1. Run a mutating command (a queue-family write) through `jaiship` and record the appended record's location.
2. Run a subsequent read (`status --json`) and assert the newly appended record is visible under the same prior root.
3. Assert no `~/.jaiship-state` exists and the mutation path is under `<prior root>/projects/<key>/`.
4. Assert only one host-root resolution occurred for the invocation (counting the policy call), so a second root cannot be selected mid-invocation.
5. Assert nothing was moved, copied, or rewritten in the prior root beyond the declared append (pre/post digest of untouched files).

**Expected Outcome**:
- Reads and writes share the prior root; one resolution per invocation; no second root; no migration-shaped writes.

#### TC-BIN-036 - First use with neither root creates the current root and emits no notice

**Objective**: Prove the delivered first-use path is untouched: with no override and no root present, the current-identity default root is created and no prior-identity notice appears.
**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F4-5, F-4, DM-3, DEC-9
**Test Type(s)**: Regression
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/prior-identity-state-fallback.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/prior-identity-state-fallback.test.ts --filter first-use`
**Tags**: @backend, @behaviour, @state, @regression

**Preconditions**:
- Empty scratch home; fixture checkout with an identity marker.

**Steps**:
1. Run a state-opening command through `jaiship`; assert `~/.jaiship-state/projects/<key>/` is created and the delivered store layout is written.
2. Assert no `prior-identity-fallback` notice appears (no prior artifact existed).
3. Repeat through the alias in a fresh scratch home; assert `~/.delivery-os-state` is created identically (delivered behaviour).
4. Assert the created path is reported by the composition seam as the current default root, not the prior one.

**Expected Outcome**:
- Ordinary first use for both identities; current root created; no notice; no prior path involvement.

#### TC-BIN-040 - Exactly one notice per source kind per process, in every mode including `--json`

**Objective**: Prove AC-F5-6's cardinality and channel: one line per source kind per process, on stderr, in every mode including `--json`, with the payload untouched.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F5-6, F-5, DM-4, NFR-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/prior-identity-notice.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/prior-identity-notice.test.ts --filter once-per-source`
**Tags**: @backend, @behaviour, @notice

**Preconditions**:
- A fixture where both halves fall back (prior config file + prior host root), in one scratch checkout/home.
- A control fixture where neither falls back.

**Steps**:
1. Run `jaiship status --json`; capture stdout and stderr separately.
2. Assert stderr has exactly two lines: one `prior-identity-fallback: config-read …`, one `prior-identity-fallback: state-read …`; assert no third line and no duplicate token+reason.
3. Assert stdout is exactly one parseable JSON payload containing no occurrence of `prior-identity-fallback`.
4. Run the same fixture through the human `status` mode; assert the same two stderr lines and that the human text contains no notice text.
5. Run the control fixture; assert zero notice lines in both modes.
6. Repeat one cell through the real subprocess (not the injected sink) to prove stderr is the real channel.

**Expected Outcome**:
- Exactly one line per source kind, on stderr, in scripted and interactive modes; never in the payload; zero when no fallback applies.

#### TC-BIN-041 - Repeated configuration resolutions in one process add no notice

**Objective**: Prove the once-per-process half of NFR-3: additional resolutions inside the same invocation add no further notice, and a new process emits it again.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F5-6, F-5, DM-4, NFR-3
**Test Type(s)**: Corner Case, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/prior-identity-notice.test.ts` (new); uses the composition's once-per-source notice state owner
**Harness entry**: `bun test tests/behaviour/prior-identity-notice.test.ts --filter repeat-resolution`
**Tags**: @backend, @behaviour, @notice

**Preconditions**:
- A composed program where two different handlers resolve configuration in the same process (or a handler that resolves twice), with the notice owner created once.
- A stderr sink that records every write with a sequence number.

**Steps**:
1. In one process, invoke the composed program twice for a configuration-bearing command on the fallback fixture; assert exactly one `config-read` line and exactly one `state-read` line across both invocations.
2. Assert the second invocation's payload is identical to the first (nothing suppressed beyond the notice).
3. In a second process (same fixture), assert the notice is emitted again (once per process, not once per machine).
4. Assert the notice owner rejects a second emission for the same source kind (an armed guard that counts attempted emissions versus accepted ones).

**Expected Outcome**:
- One emission per source kind per process; no further lines on repeat resolutions; re-emission in a new process; the guard proves the suppression is real.

#### TC-BIN-042 - No notice appears when no fallback applies, including for the alias

**Objective**: Prove the "exactly 0 when no fallback applies" half of NFR-3 and the alias's silence: an invocation with only current-identity artifacts, or with none, emits nothing.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-6, F-5, DM-4, NFR-3
**Test Type(s)**: Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/prior-identity-notice.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/prior-identity-notice.test.ts --filter no-fallback`
**Tags**: @backend, @behaviour, @notice, @negative

**Preconditions**:
- Four fixtures: current config + current root only; no config + no root; prior config only with current config also present (shadowed — this *does* notice, so excluded from the silence set); alias with prior-identity artifacts absent.

**Steps**:
1. For each silence fixture, run `status --json` through the relevant bin; assert stderr contains no `prior-identity-fallback` token.
2. Assert the alias run against a checkout with only `.delivery-os` artifacts emits no notice (it declares no prior identity).
3. Assert an invocation with neither artifact emits no notice and no warning (first use, delivered behaviour).
4. Assert the positive control in the same suite still emits (so the assertion is not vacuous).

**Expected Outcome**:
- Zero notices where no fallback applies; the positive control proves the assertion can detect a notice.

#### TC-BIN-043 - The notice text is bounded, classified, and redaction-safe

**Objective**: Prove the text contract of DM-4: the line begins with the classification token and the reason, names both locations, states that nothing was moved, copied, or deleted, stays within one line and 400 characters, and carries no value, file content, or secret.
**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F5-6, F-5, DM-4, NFR-3
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/prior-identity-notice.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/prior-identity-notice.test.ts --filter text-contract`
**Tags**: @backend, @behaviour, @contract, @security

**Preconditions**:
- The prior config file contains a canary value (`canary-secret-value-<random>`) under a normal key and a canary under a secret-shaped key; the scratch home path contains a canary segment.
- All four reasons reachable: prior read, prior shadowed (config), prior root used, prior root shadowed (state).

**Steps**:
1. For each reason, capture the notice line; assert it matches `^prior-identity-fallback: (config-read|config-skipped|state-read|state-skipped) ` and that the reason matches the observable fact.
2. Assert the line contains both the prior location and the current location (the specific paths involved), so support can reconstruct which artifact was in use.
3. Assert the line states that nothing was moved, copied, or deleted (the delivered wording family; assert presence of the no-move statement, not an exact sentence the spec does not pin).
4. Assert the line is a single line (no `\n` inside), length ≤ 400 characters, and contains neither canary value nor any file content.
5. Assert the four reasons are a closed set: no other reason token is produced for any fixture in the suite.

**Expected Outcome**:
- Four reasons, each with the token prefix, both locations, the no-move statement, ≤ 400 characters, no secret leak, closed vocabulary.

#### TC-BIN-044 - The new notice is distinct from the store warning and the legacy notice

**Objective**: Prove the non-collision requirement: with a pre-GH-288 store layout **and** an `ADOS_`/`.ados` source present **and** a fallback in effect, three recognisably distinct lines appear, each with its own trigger and wording, none reusing another's kind.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F5-6, F-5, DM-4, NG-5, NG-6; Appendix B
**Test Type(s)**: Regression
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/prior-identity-notice.test.ts` (new); delivered `legacy-adapter.test.ts` as control
**Harness entry**: `bun test tests/behaviour/prior-identity-notice.test.ts --filter distinctness`
**Tags**: @backend, @behaviour, @notice, @regression

**Preconditions**:
- Scratch home where the prior root holds a delivered store artifact directly at the root while the project root does not exist (the pre-GH-288 trigger).
- A `.ados` directory in the scratch home and an `ADOS_`-prefixed environment fact (the legacy trigger).
- A prior config file so the new notice also fires.

**Steps**:
1. Run a state-opening command through `jaiship`; capture stderr lines.
2. Assert the prior-identity line(s) carry the `prior-identity-fallback:` prefix and one of the four reasons.
3. Assert the pre-GH-288 store warning appears as its own line, with its delivered wording family (store artifacts, no project root, migration note) and no `prior-identity-fallback` prefix.
4. Assert the `ADOS_`/`.ados` legacy notice appears as its own line, exactly once, with its delivered wording family, and no `prior-identity-fallback` prefix.
5. Assert no line equals another, and that the configuration-warning kinds (`deprecated`, `shadowed`, `legacy`) are not used as the new notice's kind (the notice is not in the payload warning list).
6. Assert the delivered single-notice disciplines hold: the legacy notice appears once per process; the store warning once per state-opening invocation.

**Expected Outcome**:
- Three distinct lines, three distinct triggers, no shared vocabulary, no suppression of a delivered notice.

#### TC-BIN-045 - The notice changes no payload and no exit projection

**Objective**: Prove the invariance half of AC-F5-6: adding the notice changes no machine payload and no exit code, including on failing commands.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F5-6, F-5, DM-4, NFR-3
**Test Type(s)**: Regression
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/prior-identity-notice.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/prior-identity-notice.test.ts --filter invariance`
**Tags**: @backend, @behaviour, @regression

**Preconditions**:
- Two paired fixtures that resolve to the **same logical facts**: (a) current-identity artifacts with identical content (no fallback), (b) prior-identity artifacts (fallback), with paths normalised in the comparison.
- A failing command fixture producing a delivered exit `1` and one producing exit `2`.

**Steps**:
1. Run `status --json` on (b); normalise the two involved paths; assert the payload deep-equals (a)'s payload and the exit codes match.
2. Assert the payload's key set is identical (no added `notice`/`warnings` field), and the warning list is empty in both.
3. Run the failing fixtures on (b); assert exit codes equal the delivered projections (`1`, `2`) and the error envelope is unchanged apart from nothing.
4. Assert no `prior-identity-fallback` token appears in any stdout or in the envelope, in any of the cells.
5. Assert the notice does not change the human-mode text either, beyond stderr.

**Expected Outcome**:
- Byte-equivalent payloads after path normalisation, identical exit projections, zero notice footprint on stdout or in envelopes.

#### TC-BIN-050 - A hermetic local install registers one executable launcher at the install path

**Objective**: Prove the first clause of AC-F6-8: a local install with fetching disabled, a scratch home, and a scratch project root creates an executable launcher at the brand install path whose single target is that checkout's CLI entry.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F6-8, F-6, DM-5, NFR-5, RSK-5
**Test Type(s)**: Integration, E2E
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-install-jaiship-launcher.sh` (new); structural half in `tests/structure/install-launcher.test.ts` (new)
**Harness entry**: `bash scripts/.tests/test-install-jaiship-launcher.sh`
**Tags**: @bash, @installer, @e2e

**Preconditions**:
- `mktemp -d` scratch HOME and scratch project root (a git repository with one commit); the real `$HOME` never exported or read.
- A `PATH` shim directory first on `PATH` recording `curl`, `wget`, `git fetch`, `git pull`, `git clone` invocations.
- Precondition assertion: `$SCRATCH_HOME/.jaiship/bin/jaiship` does **not** exist.

**Steps**:
1. Run `ADOS_SOURCE_DIR=<checkout> HOME=<scratch> ./scripts/install.sh --local --no-fetch` from the scratch project root.
2. Assert the exit code is `0`, `$SCRATCH_HOME/.jaiship/bin/jaiship` exists, is a regular file, and has an executable mode for the owner.
3. Assert the launcher's content names exactly one absolute target and that the target equals `<checkout>/packages/cli/bin/jaiship.ts`; assert the target string occurs exactly once and no second path is executed.
4. Assert the launcher performs no `PATH` search for the product (`command -v jaiship`, `which jaiship` absent) and no version probe.
5. From a directory outside the checkout (e.g. the scratch `HOME`), run the launcher `--version`; assert `jaiship 0.0.0 (build dev)` and exit `0`.
6. Assert the network shim recorded zero invocations.

**Expected Outcome**:
- Executable launcher at the brand install path, one absolute target equal to the checkout's CLI entry, working from outside the checkout, zero network.

#### TC-BIN-051 - An unchanged re-run rewrites nothing; another source repoints the launcher

**Objective**: Prove content idempotence and repointing (DEC-13): re-running the same install leaves the launcher byte- and mode-identical, while installing from a second source repoints it.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F6-8, F-6, DM-5, NFR-5, DEC-13
**Test Type(s)**: Corner Case, Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-install-jaiship-launcher.sh` (new)
**Harness entry**: `bash scripts/.tests/test-install-jaiship-launcher.sh`
**Tags**: @bash, @installer, @idempotence

**Preconditions**:
- The installed state of `TC-BIN-050`.
- A second copy of the checkout (or a second worktree) at a different absolute path.

**Steps**:
1. Record the launcher's digest, mode, size, and mtime after the first install.
2. Re-run the same install command; assert exit `0` and that digest, mode, size, and mtime are unchanged; assert the installer's own report shows the launcher step wrote nothing.
3. Run the install against the second source path; assert exit `0`, the launcher digest changed, and the recorded target now equals the second source's CLI entry.
4. Assert the number of target occurrences is still exactly one (repointing replaces, never appends).
5. Assert no backup, `.bak`, or second launcher file was created beside it.

**Expected Outcome**:
- Zero rewrites on an unchanged re-run; repointing on a different source; one target; no residue files.

#### TC-BIN-052 - A removed target fails classified with one bounded line and a non-zero exit

**Objective**: Prove the classified failure mode: when the recorded target is gone, the launcher answers one bounded stderr line naming the expected target and the remedy, with a non-zero exit — never a silent success and never a `PATH` guess.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F6-8, F-6, DM-5, RSK-4, DEC-13
**Test Type(s)**: Negative, E2E
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-install-jaiship-launcher.sh` (new)
**Harness entry**: `bash scripts/.tests/test-install-jaiship-launcher.sh`
**Tags**: @bash, @installer, @negative

**Preconditions**:
- The installed launcher of `TC-BIN-050`, pointed at a **copied** source tree (so removing it does not touch the real checkout).

**Steps**:
1. Remove the copied source tree's CLI entry file (or the whole copied tree).
2. Run the launcher `--version`; assert the exit code is non-zero.
3. Assert stderr is exactly one line, that it names the expected absolute target, and that it names the remedy (re-run the local install); assert the line length is bounded (≤ 400 characters) and stdout is empty.
4. Assert the launcher does not fall back to `PATH` (install a fake `jaiship` earlier on `PATH` and assert it is not executed), and does not exit `0`.
5. Restore the target and assert the launcher works again (the failure is a state, not a broken install).

**Expected Outcome**:
- Non-zero exit, one bounded diagnostic naming target and remedy, no PATH fallback, no silent success, self-healing after restore.

#### TC-BIN-053 - The launcher passes arguments, streams, environment, and exit codes through

**Objective**: Prove the launcher is a pure hand-off: arguments reach the entry, standard streams are inherited, the environment is unmodified (so the override, the state-directory override, and every delivered flag behave as in the repository), and exit codes propagate.
**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-8, F-6, DM-5, DEC-13
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-install-jaiship-launcher.sh` (new)
**Harness entry**: `bash scripts/.tests/test-install-jaiship-launcher.sh`
**Tags**: @bash, @installer, @contract

**Preconditions**:
- The installed launcher of `TC-BIN-050`.

**Steps**:
1. Run `launcher --version` and `launcher status --json` from outside the checkout; assert stdout content equals the direct entry's output for the same arguments.
2. With `DELIVERY_OS_WORKING_NAME=acme`, assert `launcher --version` prints `acme …` (the override reaches the entry unmodified).
3. With `JAISHIP_STATE_DIR=<scratch absolute>` in a fixture checkout, assert the state read comes from that root (the state override reaches the entry).
4. Pipe stdin through the launcher and assert it arrives (a command that reads stdin, or a byte-for-byte pipe check); redirect stdout and stderr to files and assert each stream carries exactly its own content.
5. Run an invocation that exits `1` and one that exits `2`; assert the launcher's exit codes are `1` and `2`.
6. Assert no version probe (`--version` is not injected in step 1's observed arguments) and no network call.

**Expected Outcome**:
- Arguments, streams, environment, and exit codes pass through unchanged; no augmentation, no probe, no network.

#### TC-BIN-054 - Installer arrays still name no binary; the launcher step is declared

**Objective**: Prove the installer-absence truth survives (NG-7) and that the launcher registration is a declared step with one declared layout reference rather than a silent array entry.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-8, AC-F7-10, F-6, F-7, NG-7
**Test Type(s)**: Structure, Regression
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/entrypoint-installer-absence.test.ts` (extended); `tests/structure/install-launcher.test.ts` (new)
**Harness entry**: `bun test tests/structure/entrypoint-installer-absence.test.ts tests/structure/install-launcher.test.ts`
**Tags**: @structure, @installer, @regression

**Preconditions**:
- The installer source as delivered, extended by the launcher step.

**Steps**:
1. Parse `ADOS_DELIVERY_SCRIPTS` and `ADOS_DELIVERY_TOOLS`; assert neither body contains `packages/cli`, `bin/jaiship`, `bin/delivery-os`, `src/entrypoint`, `bin-launcher`, `createProductionComposer`, or `jaiship.ts`.
2. Assert both arrays still exist and still name their delivered members (`scripts/deliver-ticket.sh`, `tools/clean-merged-branches`), so the assertion is not vacuous on an empty array.
3. Assert the launcher registration is a named, separate step (a function or clearly delimited block) distinct from the guide/script/tool copy loops, and that it reads the install path from the executable's self-description rather than composing a dot-directory or binary name in bash.
4. Assert the installer source contains no `jaiship`/`.jaiship`-derived path composition (no `$HOME/.jaiship` literal outside the self-description consumption point) — the declared layout reference to the CLI entry is the only binary-shaped name.
5. Negative control: inject a fake array member naming `packages/cli/bin/jaiship.ts` into a temp copy and assert the guard fails by name.

**Expected Outcome**:
- Arrays unchanged and still populated; launcher step declared and path-authority-correct; injected violation fails by name.

#### TC-BIN-055 - The install run is hermetic: scratch roots only, zero network, real home untouched

**Objective**: Prove NFR-5 and RSK-5: the install gate writes only under the scratch home and scratch project root, performs zero network access with fetching disabled, and leaves the operator's real home untouched.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F6-8, F-6, NFR-5, RSK-5
**Test Type(s)**: Negative, Measured
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-install-jaiship-launcher.sh` (new)
**Harness entry**: `bash scripts/.tests/test-install-jaiship-launcher.sh`
**Tags**: @bash, @installer, @hermeticity

**Preconditions**:
- A snapshot of the real home's relevant entries (`~/.jaiship`, `~/.jaiship-state`, `~/.delivery-os-state` — existence and mtimes only, no content reads).
- Network shim as in `TC-BIN-050`; `git` wrapper that records `fetch|pull|clone` and fails the test if invoked.

**Steps**:
1. Before the install, snapshot the real home entries and the scratch trees.
2. Run the install with `--no-fetch` and the scratch `HOME`.
3. Assert the real home entries are unchanged (existence and mtimes identical; `~/.jaiship` still absent on the deliverer's workstation).
4. Assert every created file is under the scratch home or the scratch project root: list the new files from the before/after diff and assert every path prefix.
5. Assert the network shim recorded zero network-capable invocations and the `git` wrapper recorded zero fetch/pull/clone.
6. Assert the real `~/.delivery-os-state` was never opened for write by comparing its mtime and a shallow listing.

**Expected Outcome**:
- All writes confined to the scratch roots; zero network; real home and real prior state untouched.

#### TC-BIN-060 - Two declared bins map to two distinct existing entry files

**Objective**: Prove the manifest shape and its non-vacuity: exactly two executable identities mapping to two distinct files that exist and carry a Bun shebang.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F7-10, F-7, DM-1, DM-6, NFR-6
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/entrypoint-bin.test.ts` (rewritten from the one-bin assertion)
**Harness entry**: `bun test tests/structure/entrypoint-bin.test.ts`
**Tags**: @structure, @contract

**Preconditions**:
- `packages/cli/package.json` and the bin files on disk.

**Steps**:
1. Parse the manifest `bin`; assert exactly two entries whose keys are exactly `delivery-os` and `jaiship` (order-insensitive) and whose values are the two declared relative paths.
2. Assert the `delivery-os` mapping still points at `./bin/delivery-os.ts` (unchanged delivered mapping).
3. Assert both paths exist, are files, start with `#!/usr/bin/env bun`, and are distinct strings resolving to distinct real paths.
4. Assert `main` still maps to `./dist/entrypoint.js` and the `files` field is unchanged (`["dist"]`), so the packaging surface did not grow.
5. Negative controls in a temp root: (a) a manifest with one bin fails naming the missing identity; (b) a manifest with two bins pointing at the same path fails naming the duplicate; (c) a manifest mapping to a non-existent file fails naming the path.

**Expected Outcome**:
- Exactly two distinct existing entry files, both executable by shebang; the alias mapping unchanged; all three mutants fail by name.

#### TC-BIN-061 - The content inventory equals the file set with per-file executable allowances, and retires exactly one entrypoint export

**Objective**: Prove exact-set equality and per-file executable discipline for the new files and for the retired neutral accessor, so the inventory describes the tree instead of tolerating it.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F7-10, F-7, NFR-6
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/content-inventory.test.ts` + `tests/structure/inventory.json` (extended)
**Harness entry**: `bun test tests/structure/content-inventory.test.ts`
**Tags**: @structure, @regression

**Preconditions**:
- The delivered equality test and `EXECUTABLE_ALLOWANCES` map.
- The spec v1.1 consequence: `packages/cli/src/entrypoint.ts` no longer declares `neutralWorkingName`; `workingNameEnvironmentVariable` remains.

**Steps**:
1. Assert the committed inventory equals the actual `.ts` file set for every package, including the new `cli/bin/jaiship.ts` and `cli/src/bin-launcher.ts`. Assert `cli/src/entrypoint.ts` is **still** in the file set (the module is unchanged in *existence*; only its allowance shrinks), so file-set equality is unaffected by the retirement.
2. Assert `cli/bin/jaiship.ts` has a per-file executable allowance entry, and that `cli/bin/delivery-os.ts`'s allowance is reconciled with its rewritten body (no stale allowance, no extra export).
3. Assert `cli/src/entrypoint.ts`'s allowance loses exactly `neutralWorkingName` and keeps `workingNameEnvironmentVariable`: compare the allowance entry against the module's declared exports in both directions, so a retained `neutralWorkingName` or a dropped `workingNameEnvironmentVariable` fails naming the symbol.
4. Assert no file anywhere declares or exports `neutralWorkingName` (a symbol search across `packages/**`), and that `workingNameEnvironmentVariable` is still consumed by `packages/cli/src/production.ts` (so its allowance is not merely tolerated).
5. Assert every executable file in the tree has an allowance (per-file only, no global switch), and that the allowance lists exactly the executable exports the file declares.
6. Negative controls already delivered plus two new: an undeclared file in a temp root fails by name; an undeclared executable export in the new bin fails by name; a temp-root `entrypoint.ts` that re-adds `neutralWorkingName` fails naming the symbol; a temp-root allowance that drops `workingNameEnvironmentVariable` fails naming the symbol.

**Expected Outcome**:
- Exact equality for both directions; every executable file individually allowed; the new bin cannot appear without an allowance; the retired accessor cannot reappear and the retained accessor cannot lose its allowance.

#### TC-BIN-062 - Identity literals are exactly the declared four sites, none exported, with no residual neutral default

**Objective**: Prove DM-6's declared four-site inventory — three CLI selector sites plus the unchanged MCP default — with none exported, prove the entrypoint module holds no identity literal and no `neutralWorkingName`, and prove the entrypoint can **no longer be called with a neutral fallback**: a missing or unusable declared default is the declared composition error on the self-description path and the classified resolver-input error on the configuration path, never a substituted name.
**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F7-10, F-7, DM-6, NFR-1, NFR-6, DEC-5; LIT-TP-1
**Test Type(s)**: Structure, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/entrypoint-bin.test.ts` (extended with a working-name literal scan and one in-process entrypoint call); precedent: the AST scans in `branding-seam.test.ts` and `content-inventory.test.ts`
**Harness entry**: `bun test tests/structure/entrypoint-bin.test.ts --filter literals`
**Tags**: @structure, @contract, @security

**Preconditions**:
- An AST scan over `packages/**` (excluding `dist`, `node_modules`) collecting string literals equal to a working name (case-insensitive on the declared names) together with their file, enclosing declaration, export status, and role.
- The declared inventory, held in the test as two scopes:

  | Scope | File | Role | Value | Export |
  |---|---|---|---|---|
  | CLI (selector) | `packages/cli/bin/delivery-os.ts` | default working name | `delivery-os` | non-exported local |
  | CLI (selector) | `packages/cli/bin/jaiship.ts` | default working name | `jaiship` | non-exported local |
  | CLI (selector) | `packages/cli/bin/jaiship.ts` | prior identity | `delivery-os` | non-exported local |
  | MCP (unchanged) | `packages/mcp/src/serve.ts` | default working name | `delivery-os` | unchanged delivered site |

- The retired-symbol list: `neutralWorkingName` must not exist anywhere; `workingNameEnvironmentVariable` must still exist and stay in the entrypoint module's executable allowance (`TC-BIN-061`).

**Steps**:
1. Collect all working-name literals; assert the **CLI scope** equals exactly the three declared selector sites with the declared values and roles, and the **MCP scope** equals exactly one site whose bytes are identical to the delivered value.
2. Assert the total is exactly 4 and that zero sites exist outside the declared inventory: any fifth site fails by name with its file and constant.
3. Assert every CLI site is a non-exported local value (no `export const`/`export let`, no exported object property) and that no working-name value is exported anywhere; assert no `BrandIdentity` field is assigned a literal outside `branding`/`contracts` (the delivered seam rule, re-asserted for the new files).
4. Assert `packages/cli/src/entrypoint.ts` holds **no** identity literal, no `NEUTRAL_WORKING_NAME` declaration, and no `neutralWorkingName` declaration, export, or import; assert the module's identity input is the invoking bin's declared default, carried as a required input (never an optional-with-internal-fallback parameter).
5. Behaviour half, in-process in the same file: call the entrypoint with **no** declared default. Assert `--version`/`--help` return the delivered containment identity with a non-zero exit, and that a configuration-bearing command returns the classified resolver-input error; assert neither path substitutes a working name (no `delivery-os` and no `jaiship` identity is invented), so the removed fallback cannot be reintroduced as a shim.
6. Assert `workingNameEnvironmentVariable` still exists and is still consumed by `packages/cli/src/production.ts`, so the removal is confined to the identity *value* and does not disturb the protocol variable *name*.
7. Negative controls: (a) a temp-root fifth site (an exported `const PRODUCT = "<name>"`) fails naming the file and the constant; (b) a temp-root `entrypoint.ts` re-declaring `neutralWorkingName` fails naming the symbol; (c) a `binaryName: "<name>"` assignment in `production.ts` fails naming the field.

**Expected Outcome**:
- Exactly four declared sites in two scopes, none exported, and zero undeclared sites; the entrypoint module is free of identity literals and of the retired accessor; a missing declared default yields the declared containment/classified failure rather than a neutral substitute; all three injected violations fail by name.

#### TC-BIN-063 - One shared launcher composition; neither bin duplicates the body

**Objective**: Prove there is one executable composition body, not two: both bins delegate to one shared launcher function that reads environment, cwd, and home once and returns an exit code; neither bin calls the command runtime directly or re-implements the body.
**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F7-10, F-1, F-7, NFR-6, DEC-5
**Test Type(s)**: Structure, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/entrypoint-bin.test.ts` (extended)
**Harness entry**: `bun test tests/structure/entrypoint-bin.test.ts --filter shared-composition`
**Tags**: @structure, @contract

**Preconditions**:
- A shared launcher module exposing behaviour through a function (never an exported literal — the branding-seam rule).

**Steps**:
1. Parse each bin; assert it imports exactly one launcher function, passes its two declared facts (default working name, optional prior), and contains no `createProductionComposer`, no `runEntrypoint` call body beyond the single delegation, and no `process.env`/`process.cwd()` read of its own.
2. Assert the launcher module is the only file declaring the composition body: search for the body's distinctive operations (`createProductionComposer(`, the environment/home/cwd read, the `runEntrypoint` call) and assert exactly one occurrence site (the launcher).
3. Assert the launcher exports a function and no module-level string literal (branding-seam compatibility); assert the bins export no module-level string constant either.
4. Assert the entrypoint module exposes no identity value and no retired accessor: it declares and imports neither `NEUTRAL_WORKING_NAME` nor `neutralWorkingName`, and the protocol accessor `workingNameEnvironmentVariable` is the only module-level *name* it still exposes (it carries a variable name, not an identity value) and is passed through to the production composition unchanged.
5. Assert the two bins' only differences are the declared selector facts: a structural diff of the two files shows only the literals and the optional prior argument.
6. Negative control: a temp-root bin that inlines the composition body fails by name (duplicated body detected); a temp-root launcher that hardcodes a default identity instead of accepting it from the bin fails naming the literal.

**Expected Outcome**:
- One composition body, two thin selectors, one shared export, and an entrypoint module that carries no identity value and no retired accessor; a duplicated body or a launcher-side default is rejected by name.

#### TC-BIN-064 - The branding seam still passes and still rejects injected violations

**Objective**: Prove the delivered seam guard is green **and** still able to fail: no exported module-level string constant under `packages/**`, no `BrandIdentity`-shaped literal outside `branding`/`contracts`, and the three delivered negative controls still reject.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F7-10, F-7, NFR-6
**Test Type(s)**: Structure, Regression
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/branding-seam.test.ts` (unchanged file, executed as the control); the entrypoint-corpus probe reuses its exported `validateSeam` from `tests/structure/entrypoint-bin.test.ts`, so the delivered seam suite file stays byte-identical
**Harness entry**: `bun test tests/structure/branding-seam.test.ts tests/structure/entrypoint-bin.test.ts`
**Tags**: @structure, @regression

**Preconditions**:
- The delivered `validateSeam` exported scanner.

**Steps**:
1. Run the suite unchanged; assert `validateSeam(ROOT)` returns `[]` for the post-change tree (the new launcher and bins respect the rule).
2. Assert the three delivered negative controls still fail by name: exported product constant, twelve-field literal outside branding, single field literal outside branding.
3. Assert the new files appear in the scan corpus (a scan that silently skipped `bin/**` would pass vacuously): inject a violation into a temp-root `packages/cli/bin/jaiship.ts` and assert it is caught.
4. Assert the entrypoint module is in the scan corpus and carries no identity value after the retirement: inject `export const NEUTRAL_WORKING_NAME = "<name>"` into a temp-root `packages/cli/src/entrypoint.ts` and assert the seam scan fails naming the file and the constant; inject a re-declaration of `neutralWorkingName` and assert it fails naming the symbol. Assert the live module passes and that `workingNameEnvironmentVariable` (a function returning a variable name) is untouched by the scan.
5. Assert the resolver's shape assertions (one input parameter, no default, `workingName` required and string) are unchanged.

**Expected Outcome**:
- Seam green on the new tree; all injected violations rejected by name; the corpus includes `bin/**` and `src/entrypoint.ts`, and the retired neutral accessor cannot be reintroduced without failing the guard.

#### TC-BIN-065 - The state-scope policy still proves one composition and one override read

**Objective**: Prove the host-root policy remains the single site after prior-root selection is added: one home-plus-brand composition, one `<PREFIX>_STATE_DIR` read, one policy, and the delivered negative controls still fail.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F7-10, F-4, F-7, NFR-4, NFR-6
**Test Type(s)**: Structure, Regression
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/projects-state-scope-policy.test.ts` (extended around the one helper)
**Harness entry**: `bun test tests/structure/projects-state-scope-policy.test.ts`
**Tags**: @structure, @regression

**Preconditions**:
- The delivered AST scan (`homeBrandSites`) and the consumer list.

**Steps**:
1. Assert exactly one home-plus-brand composition site and exactly one `<PREFIX>_STATE_DIR` read site remain (the policy), with the prior-root selection expressed over injected existence facts only.
2. Assert the policy module still imports no I/O and reads no filesystem: a static assertion over its imports and call sites, plus a runtime probe that the policy returns a value when the existence facts are injected as data.
3. Assert the prior selection introduces no second composition: the prior default root is derived through the same helper as the current one (assert the helper's call count is 2 for a fallback resolution, 1 otherwise, and that no other file composes home plus brand).
4. Assert the delivered negative controls still fail by name (an injected re-derived path in a consumer).
5. Assert the declared consumer list is updated when a new consumer is added (a new consumer outside the list fails by name).

**Expected Outcome**:
- One policy, one composition helper, one override read; prior selection stays pure; controls still fail.

#### TC-BIN-066 - Installer absence is preserved and the launcher step is its own declaration

**Objective**: Prove the structural half of the installer change: the two delivery arrays keep naming no binary, entrypoint, or composer, and the launcher registration is declared as its own step with a single declared layout reference to the CLI entry file.
**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F7-10, F-7, NG-7
**Test Type(s)**: Structure
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/entrypoint-installer-absence.test.ts` (extended)
**Harness entry**: `bun test tests/structure/entrypoint-installer-absence.test.ts`
**Tags**: @structure, @regression

**Preconditions**:
- The installer source with the launcher step.

**Steps**:
1. Assert the delivered absence assertions still hold for both arrays (with the delivered forbidden-token list extended by `bin/jaiship`, `bin-launcher`, `jaiship.ts`).
2. Assert the launcher step exists exactly once as a named step, is invoked from the local-install path only (not the global path), and does not reuse an array loop.
3. Assert the step consumes the executable's install-path self-description and expands only the leading home marker: assert no bash-side composition of a dot-directory or binary name from a working name.
4. Assert the arrays' member counts are unchanged from the delivered baseline (recorded as a name list, not a count that grows), so an added member is visible.
5. Negative control: inserting `packages/cli/bin/jaiship.ts` into `ADOS_DELIVERY_SCRIPTS` in a temp copy fails by name.

**Expected Outcome**:
- Absence preserved, launcher step declared and path-authority-correct, injected array entry rejected.

#### TC-BIN-067 - No new family row and no new error row; parity stays non-vacuous

**Objective**: Prove NG-8: the fallback is a notice, not a failure identity and not a command family — the family list stays at twenty, the error table gains no row, and the uncomposed invocation keeps its delivered containment.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-2, AC-F7-10, F-1, F-7, NG-8; PAR-TP-1
**Test Type(s)**: Structure, Regression
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/entrypoint-bin.test.ts` (extended); delivered error-table sync check as control
**Harness entry**: `bun test tests/structure/entrypoint-bin.test.ts --filter family-and-error-table`
**Tags**: @structure, @regression

**Preconditions**:
- `PROMPT_REQUIRED_COMMANDS` and the error-table source of truth.

**Steps**:
1. Assert `PROMPT_REQUIRED_COMMANDS` is unchanged (same twenty, same order) and that no new family is advertised by either bin's root help.
2. Assert `--print-install-path` is not a family and not a global flag (no new row in the global-flags section).
3. Assert the error table gains no row for the fallback or the notice: the delivered table sync check passes unchanged and no code contains `prior-identity-fallback` as an error code.
4. Assert the delivered `fallback.internal` containment still applies to an uncomposed command, exit `2`, with the delivered summary wording.
5. Negative control: add a family row to a copy of the family list and assert the parity/coverage comparison fails naming the extra family.

**Expected Outcome**:
- Twenty families unchanged, no new error identity, containment intact, mutation detected.

#### TC-BIN-070 - The four affected specification pages state the new reality

**Objective**: Prove the specification is reconciled, not merely edited: the four pages state the two-executable reality, the fallback and its notice, the install posture, and the host-root selection, and no stale sentence survives.
**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F8-11, F-8, NFR-8; DOC-TP-1
**Test Type(s)**: Structure, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/doc-conformance.test.ts` (extended §16.1.1 phrase-table rows for the four pages)
**Harness entry**: `bun test tests/checks/doc-conformance.test.ts`
**Tags**: @checks, @docs

**Preconditions**:
- `doc/documentation-handbook.md` §16.1.1 stale/required phrase table gains rows for `feature-cli-entrypoint.md`, `feature-branding-seam.md`, `feature-config-layer.md`, `feature-projects.md`.

**Steps**:
1. Assert every new row exists and carries at least one stale phrase and one required phrase (a row with an empty list would pass vacuously — fail it).
2. Run the phrase check: every stale phrase is absent (notably the delivered "the bin is not part of the install surface" sentence) and every required phrase is present (two executables, per-bin identity selector and prior identity, the prior-identity read fallback and its notice, the install-path read, the install posture, the host-root prior selection, the no-second-root guarantee).
3. Assert each of the four pages is named by at least one row (no affected page left unreconciled).
4. Negative control: a synthetic page text containing a stale phrase fails naming the page and the phrase; a required phrase removed fails naming the page and the phrase.
5. Assert the notice vocabulary and the four reasons appear on the configuration and projects pages, so the pages and the code share one vocabulary.

**Expected Outcome**:
- Four pages reconciled; stale sentence gone; required statements present; the guard proves both directions.

#### TC-BIN-071 - The local-install guide ships with its marker, registration, and content

**Objective**: Prove the new distributable guide is a real, installable document: it declares its distribution marker, is registered in the forbidden-literal scan, passes the documentation drift guard, and carries the promised content.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F8-11, F-8, NFR-8
**Test Type(s)**: Structure, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/identity-docs.test.ts` (new); `bash scripts/.tests/test-doc-distribution.sh`; `scripts/checks/forbidden-literals.registry.json`
**Harness entry**: `bun test tests/checks/identity-docs.test.ts && bash scripts/.tests/test-doc-distribution.sh`
**Tags**: @checks, @docs, @installer

**Preconditions**:
- `doc/guides/local-install.md` created in this change; `doc/documentation-profile.md` absent (so `engineering-repo` behaviour applies).

**Steps**:
1. Assert the guide exists and its front matter declares `ados_distribution: redistributable` (value inside the closed enum).
2. Assert the guide path is registered in `scripts/checks/forbidden-literals.registry.json`'s registered user-facing docs — the delivered lesson: a new guide left unregistered fails the scan closed and breaks `ci-baseline-parity` at HEAD.
3. Run `bash scripts/.tests/test-doc-distribution.sh`; assert exit `0` (marker-driven install set includes the guide; no drift).
4. Assert the guide's content covers: the install command shape with fetching disabled, where the launcher lands, what it executes, what the notice means, what the fallback covers, what it deliberately does not cover (machine-global layers, prior-prefix environment names), and the explicit "what is not renamed in this slice" list.
5. Assert the guide is referenced from the documentation landing page or the affected spec pages (a discoverable link exists).
6. Negative control: removing the marker from a temp copy fails the drift guard naming the file; removing the registry entry fails the literal scan naming the path.

**Expected Outcome**:
- Marker present, registry entry present, drift guard green, promised content present and discoverable; both negations fail by name.

#### TC-BIN-072 - The declared divergences are stated and the public surfaces are unchanged

**Objective**: Prove NFR-8 and the unchanged half of AC-F8-11: every remaining pre-freeze identity consumer is stated, and the package scope, scope org, URLs, README, docs profile, MCP default, and shell fallback host root are unchanged.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F8-11, F-8, NFR-8, NG-1..NG-4; DOC-TP-1
**Test Type(s)**: Structure, Regression
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/identity-docs.test.ts` (new) plus the delivered `branding-contract.test.ts` and manifest privacy checks as controls
**Harness entry**: `bun test tests/checks/identity-docs.test.ts --filter divergences`
**Tags**: @checks, @docs, @regression

**Preconditions**:
- The spec §8.5 divergence list, the guide's divergence section, and the delivered value sources.

**Steps**:
1. Assert `packageScope`/`PACKAGE_SCOPE` is still `@delivery-os` and the scope org is `delivery-os` in the resolver; assert every package manifest name is unchanged (`manifest-privacy`/publish-guard controls pass).
2. Assert the resolver's `repositoryUrl` and `docsBaseUrl` for both identities are the pre-freeze scope-derived values (`https://github.com/delivery-os/<binary>`, `https://delivery-os.github.io/<binary>/`), including for `jaiship`.
3. Assert `README.md` contains no claim of an installed `jaiship` executable at a new public location and still carries the pre-freeze URLs; assert `doc/documentation-profile.md` is absent.
4. Assert `packages/mcp/src/serve.ts`'s default working name and override read are byte-identical to the delivered values, and `scripts/lib/dispatch-authority.sh`'s host root is unchanged.
5. Assert each of those four consumers is named in the spec §8.5 list **and** in the guide's divergence section (zero undocumented identity paths: a consumer found in code but absent from both lists fails by name).

**Expected Outcome**:
- Public surfaces unchanged; the four declared divergences stated in both documents; zero undocumented consumers.

#### TC-BIN-073 - The forbidden-literal scan stays green with an unchanged seed set

**Objective**: Prove the rename drill's premise is intact: the seed set is unchanged (the decided public name is not seeded), the scan is green with the new guide registered, and an unregistered guide still fails closed.
**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F8-11, F-7, F-8, NG-9
**Test Type(s)**: Structure, Regression
**Automation Level**: Automated
**Target Layer / Location**: delivered `scripts/checks/forbidden-literals.ts` + `tests/checks/forbidden-literals.test.ts` (registered-doc controls extended)
**Harness entry**: `bun run scripts/checks/forbidden-literals.ts && bun test tests/checks/forbidden-literals.test.ts`
**Tags**: @checks, @branding, @regression

**Preconditions**:
- The delivered registry and scan.

**Steps**:
1. Run the scan; assert exit `0`, all five scope classes scanned, zero violations.
2. Assert `seedLiterals` are exactly the delivered three and `corpusBaseline` is unchanged (the public name was not added and the corpus was not re-baselined).
3. Assert the new guide is in the registered docs list and that the scan's covered-class count is unchanged from the delivered value (printed).
4. Negative control: an unregistered new doc under `doc/guides/` fails closed naming the path; a seeded literal introduced into a temp corpus fails naming the file and token.

**Expected Outcome**:
- Scan green with unchanged seed set and baseline; the new guide registered; both negations fail by name.

#### TC-BIN-080 - The aggregate gate is green with the recorded temp-dir invocation

**Objective**: Prove AC-F7-9's aggregate half while recording the documented temp-dir constraint honestly: the gate is green, and any environment-class failure is named by mechanism rather than waived.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F7-9, NFR-7
**Test Type(s)**: Manual (gate execution), Automation-adjacent
**Automation Level**: Semi-automated
**Target Layer / Location**: repository root; evidence recorded in §10 and the change record
**Harness entry**: `mkdir -p tmp/tmpdir && TMPDIR=$PWD/tmp/tmpdir pnpm check`
**Tags**: @gate

**Preconditions**:
- `pnpm install --frozen-lockfile` completed; `tmp/tmpdir` exists.

**Steps**:
1. Run the declared gate: `TMPDIR=$PWD/tmp/tmpdir pnpm check`; record the full log path and the exit code.
2. If `tests/behaviour/queue-production-binding.test.ts` or `tests/behaviour/projects-config.test.ts` fail (their fixtures require a temp directory **outside** every git worktree), re-run the identical gate with `TMPDIR` set to a **same-device** directory outside every worktree; record both invocations, the failing suite names, and the reason.
3. If `tests/checks/ci-baseline-parity.test.ts` fails (a foreign-filesystem temp dir breaks `git clone --local`), the same re-run with a same-device temp dir must pass; record it.
4. Assert no other failure is reclassified: any non-temp-dir failure is a genuine red gate and blocks the quality gate.
5. Record the final verdict, the command actually used, and the failing-then-green evidence for each affected suite.

**Expected Outcome**:
- A green gate with the exact command(s) and the mechanism for any temp-dir-class re-run recorded; no failure waived without a named mechanism.

#### TC-BIN-081 - The branch-range commit-message gate reports PASS

**Objective**: Prove the supplementary pre-PR gate the spec's AC names: the change branch's own commits satisfy the repository's commitlint configuration.
**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F7-9, NFR-7
**Test Type(s)**: Manual (gate execution)
**Automation Level**: Semi-automated
**Target Layer / Location**: repository root
**Harness entry**: `./scripts/lint-commit-range.sh --base main-tools`
**Tags**: @gate

**Preconditions**:
- The change branch with at least one commit; `main-tools` resolvable.

**Steps**:
1. Run the gate; record the verdict line and the commit range it evaluated.
2. Assert the verdict is `PASS`; for `FAIL`, record each offending commit and the rule, remediate in the mode the gate names, and re-run.
3. For `SKIP` (no commitlint configuration) or `ERROR` (cannot verify), record the reason; an unresolved `ERROR` is never recorded as a pass.
4. Assert the evaluator resolves commitlint from the repository-local `node_modules/.bin`, not a global install.

**Expected Outcome**:
- `PASS` with the evaluated range recorded; non-`PASS` verdicts never recorded as green.

#### TC-BIN-082 - The delivered regression suites are green under the changed surface

**Objective**: Prove NFR-7's "0 regressions" claim over the specific delivered suites the spec names, so the change is additive for every existing surface.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F7-9, NFR-7
**Test Type(s)**: Regression
**Automation Level**: Automated
**Target Layer / Location**: the delivered suites, run individually for a named verdict
**Harness entry**: `bun test tests/behaviour/entrypoint-*.test.ts tests/behaviour/config-*.test.ts tests/behaviour/projects-config.test.ts tests/behaviour/daemon-*.test.ts tests/behaviour/events-*.test.ts tests/structure/entrypoint-*.test.ts tests/structure/content-inventory.test.ts && bash scripts/.tests/test-install.sh`
**Tags**: @regression

**Preconditions**:
- The build artefacts present (`pnpm build` as the `pretest` step provides).

**Steps**:
1. Run the entrypoint suites (`entrypoint-version`, `entrypoint-help`, `entrypoint-help-coverage`, `entrypoint-help-isolation`, `entrypoint-composition`) and record pass/fail per file.
2. Run the configuration and state-scope suites (`config-*`, `config-sources`, `projects-config`, `projects-state-scope-policy`, `state-scope`) and record per file.
3. Run the daemon-mount and events-mount suites and record per file.
4. Run `bash scripts/.tests/test-install.sh` and record the pass/fail counts, asserting the delivered installer tests still pass unchanged.
5. Assert no delivered assertion was edited to accommodate the change without a declared reason in the change record (search the diff for edits inside the delivered suites and require a justification per edit).

**Expected Outcome**:
- Every named suite green; the delivered installer test green; any delivered assertion edited is declared.

#### TC-BIN-083 - The detached-child environment allowlist is unchanged and still admits both identities

**Objective**: Prove the constraint that makes the installed unit and detached re-entry work without an allowlist change: the delivered child-environment regex already admits the working-name override and a brand-derived state-directory name, so the new identity re-enters unchanged.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F7-9, F-2, NFR-7; §8.5
**Test Type(s)**: Regression, Corner Case
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/daemon-start-detached.test.ts` (delivered pin at line 618, extended with an identity matrix)
**Harness entry**: `bun test tests/behaviour/daemon-start-detached.test.ts --filter child-environment`
**Tags**: @backend, @regression, @daemon

**Preconditions**:
- The delivered regex pin `^(PATH|HOME|USERPROFILE|DELIVERY_OS_WORKING_NAME|[A-Z0-9_]*_STATE_DIR)$` present and unmodified.

**Steps**:
1. Assert the regex literal in the delivered suite is byte-identical to the delivered value (no allowlist edit).
2. With the `jaiship` identity, spawn a detached child with `DELIVERY_OS_WORKING_NAME` and `JAISHIP_STATE_DIR` set; assert both keys survive into the child environment exactly once.
3. Assert a non-allowlisted key is still dropped (the allowlist is not widened), and that both identities' state-directory names match the pattern.
4. Assert the installed-unit environment contract (the same allowlist) admits the new identity's keys without a change to the unit renderer.

**Expected Outcome**:
- Allowlist byte-identical; both identities' override and state-directory keys re-enter; no widening.

#### TC-BIN-084 - The new suites are hermetic: zero network, zero real-home state, zero sleeps

**Objective**: Prove the delivering suite itself is safe: the new cases perform no network access, read no real provider credentials, sleep no real time, and never use the operator's home or the real `~/.delivery-os-state` as mutable state.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F1-1..AC-F8-11 (guard half), NFR-2, NFR-5
**Test Type(s)**: Negative, Guard
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/prior-identity-hermetic.test.ts` (new); mirrors the delivered `daemon-hermetic` pattern
**Harness entry**: `bun test tests/checks/prior-identity-hermetic.test.ts`
**Tags**: @checks, @hermeticity

**Preconditions**:
- Armed counters for network connects/DNS, environment reads of secret-shaped keys, sleeps, and filesystem writes outside an allowlist.
- A static assertion that no new suite references the real `os.homedir()` / `$HOME` as a fixture root (except where explicitly snapshotted read-only, as in `TC-BIN-055`).

**Steps**:
1. Run the plan's new behaviour and structure suites under the armed counters; assert zero network connects, zero credential reads, zero real sleeps, and zero writes outside the temp roots.
2. Assert no suite opens the real `~/.delivery-os-state` for write (path-based guard, not a content read).
3. Assert the counters are live: a canary that performs a recorded fake network call and one that writes outside the allowlist both trip their counter (the guard is not vacuously green).
4. Print the counters with the suite list as the hermeticity evidence record.

**Expected Outcome**:
- Zero live effects across the plan's suites; counters proven live; evidence recorded for the quality gate.

## 6. Environments and Test Data

- **Environments.** One hermetic local environment: `bun:test` over temp directories under the workspace's `tmp/` (which is git-ignored) or `mkdtemp`, plus one bash installer test. No staging, no external system, no tracker, no provider.
- **The aggregate gate's temp-dir constraint — recorded, not waived.** The declared gate is `TMPDIR=$PWD/tmp/tmpdir pnpm check`. Two delivered suites (`tests/behaviour/queue-production-binding.test.ts`, `tests/behaviour/projects-config.test.ts`) require a temp directory **outside every git worktree**, and `tests/checks/ci-baseline-parity.test.ts` requires a **same-device** temp directory (a foreign filesystem breaks its `git clone --local` hardlink assertion). A repo-local `TMPDIR` therefore greens the parity suite and reds the two fixtures; the working invocation uses a same-device temp directory **outside** every worktree. `TC-BIN-080` records both invocations and the mechanism; the new suites must not depend on either property, and no failure is reclassified without naming the mechanism.
- **This checkout's facts.** `~/.delivery-os-state` exists and is populated (`host-index.json`, `projects/`, ledger artifacts); there is no `~/.jaiship-state`; the checkout has no `.delivery-os/config.yaml`; no `DELIVERY_OS_*`/`JAISHIP_*` variable is set. Therefore the **configuration** half of the fallback is proven only over fixture checkouts, and the **state** half is proven over scratch homes populated with the delivered artifact shape. **No test mutates the real `~/.delivery-os-state`**; the only contact with the real home is the read-only existence/mtime snapshot in `TC-BIN-055`.
- **Fixture checkouts.** Committed under `tests/fixtures/entrypoint/prior-identity/` (never named `*.test.ts`), each with a real `.git` directory and an identity marker so project-key derivation is exercised: `config-only/`, `both-layers/`, `mixed-layers/`, `local-only/`, `selected-config/`, `global-layers/`, `no-config/`. Values are distinguishable per file (a shared key with different values, plus a unique key per file) so "read" versus "merged" is observable.
- **Scratch homes.** `host-root/` fixture supplies the delivered host-root artifact shape and a seeded delivery record; the suite copies it into a scratch home per test and derives a matching project key from a matching fixture checkout marker. A second seeded record exists in a separate `current-root/` fixture so "which root was read" is unambiguous.
- **Injected facts.** File acquisition runs twice where useful: over the real disk (end-to-end) and over deterministic injected filesystem facts (ordering, skip vocabulary, read counters). The host-root policy always receives injected existence facts; a counting environment record proves the single override read and the absence of prior-prefix reads.
- **Subprocess cells.** One per bin for the process edge (`bun packages/cli/bin/<bin>.ts`), one for the `pnpm exec` link, and one for the installed launcher — all with scrubbed environments and an explicit `HOME` under temp. No subscriber uses the real `$HOME`.
- **Network proof.** The installer test puts a shim directory first on `PATH` that records and fails `curl`/`wget`/`git fetch|pull|clone`; assertion is on the recorded counter, not on an absent error message.
- **Goldens and baselines.** The alias baseline fixture is captured **before** the bin refactor with an explicit documented command and a `capturedFrom` commit; it is regenerated only deliberately. No other golden is added.
- **Isolation and determinism.** Every suite constructs its own temp roots and removes them in `finally`; no cross-suite shared state; no real sleeps; identity determinism is asserted by paired runs (`TC-BIN-014`).
- **Commands used while iterating** (narrow first, per the testing strategy): `bun test tests/behaviour/entrypoint-two-bins.test.ts`, `identity-override.test.ts`, `prior-identity-*.test.ts`; `bun test tests/structure/entrypoint-bin.test.ts content-inventory.test.ts projects-state-scope-policy.test.ts install-launcher.test.ts`; `bash scripts/.tests/test-install-jaiship-launcher.sh`; `bun test tests/checks/identity-docs.test.ts prior-identity-hermetic.test.ts doc-conformance.test.ts`.

## 7. Automation Plan and Implementation Mapping

Every case is automated: `bun test` for the TypeScript cases and the embedded assertion framework in `scripts/.tests/test-install-jaiship-launcher.sh` for the installer case; `TC-BIN-080` and `TC-BIN-081` are gate executions whose evidence is recorded in §10. Rows marked **Existing – Update** extend delivered suites in place; **New** files are created in this change. Delivery owns exact module paths (GAP-T6): the files below are the planned locations following repo conventions, and a case that cannot resolve its seam fails naming the missing contract rather than skipping. Aggregate verification: `TMPDIR=$PWD/tmp/tmpdir pnpm check` with the §6 re-run rule.

| TC ID | Suite / file | Command | Injection / fixture requirements | Status |
|---|---|---|---|---|
| TC-BIN-001 | `tests/behaviour/entrypoint-two-bins.test.ts` | `bun test … --filter process-edge` | Subprocess with scrubbed env; temp cwd outside checkout; manifest read | New |
| TC-BIN-002 | `tests/behaviour/entrypoint-two-bins.test.ts` | `bun test … --filter alias-baseline` | `tests/fixtures/entrypoint/alias-baseline.json` captured pre-change | New (baseline new) |
| TC-BIN-003 | `tests/behaviour/entrypoint-two-bins.test.ts` | `bun test … --filter family-parity` | `PROMPT_REQUIRED_COMMANDS` import; comparator mutants | New |
| TC-BIN-004 | `tests/behaviour/entrypoint-two-bins.test.ts` | `bun test … --filter per-command-help` | `allHelpEntries()` inventory; two identities | New |
| TC-BIN-005 | `tests/behaviour/entrypoint-two-bins.test.ts`; extends `entrypoint-help-isolation.test.ts` | `bun test … --filter isolation` | Poisoned env, invalid YAML in both config dirs, throwing composer, counting ports | New + Existing – Update |
| TC-BIN-006 | `tests/behaviour/entrypoint-two-bins.test.ts` | `bun test … --filter install-path` | Throwing composer; override matrix | New |
| TC-BIN-010 | `tests/behaviour/identity-override.test.ts`; extends `entrypoint-version.test.ts` | `bun test tests/behaviour/identity-override.test.ts` | `.acme` fixture checkout; scratch `~/.acme-state` | New + Existing – Update |
| TC-BIN-011 | `tests/behaviour/identity-override.test.ts` | `bun test … --filter empty-override` | Empty and whitespace-only override variants | New |
| TC-BIN-012 | `tests/behaviour/identity-override.test.ts`; extends `entrypoint-help-isolation.test.ts` | `bun test … --filter invalid-override` | Invalid override matrix; fixture checkout with a prior file present | New + Existing – Update |
| TC-BIN-013 | `tests/behaviour/prior-identity-config-fallback.test.ts`, `prior-identity-state-fallback.test.ts` | `bun test … --filter alias` | Alias fixtures with current/prior artifacts in both directions | New |
| TC-BIN-014 | `tests/behaviour/identity-override.test.ts` | `bun test … --filter determinism` | Input matrix; two cwd/home variants | New |
| TC-BIN-020 | `tests/behaviour/prior-identity-config-fallback.test.ts` | `bun test … --filter prior-read` | `config-only/` fixture; injected + real-disk acquisition | New |
| TC-BIN-021 | `tests/behaviour/prior-identity-config-fallback.test.ts` | `bun test … --filter current-wins` | `both-layers/` fixture with shared + unique keys | New |
| TC-BIN-022 | `tests/behaviour/prior-identity-config-fallback.test.ts` | `bun test … --filter per-layer` | `mixed-layers/`, `local-only/` fixtures | New |
| TC-BIN-023 | `tests/behaviour/prior-identity-config-fallback.test.ts` | `bun test … --filter selected-config` | `selected-config/` fixture; external selected file; delivered skips | New |
| TC-BIN-024 | `tests/behaviour/prior-identity-config-fallback.test.ts` | `bun test … --filter global-layers` | `global-layers/` + scratch `~/.config`; platform facts | New |
| TC-BIN-025 | `tests/behaviour/prior-identity-config-fallback.test.ts` | `bun test … --filter read-only` | Recursive snapshot (path/size/mode/digest/mtime); sentinel file | New |
| TC-BIN-026 | `tests/behaviour/prior-identity-config-fallback.test.ts` | `bun test … --filter strict` | Prior-read, `deprecated`, and `missing` fixtures; delivered strict control | New |
| TC-BIN-030 | `tests/behaviour/prior-identity-state-fallback.test.ts` | `bun test … --filter prior-root` | `host-root/` fixture copied to scratch home; matching marker checkout | New |
| TC-BIN-031 | `tests/behaviour/prior-identity-state-fallback.test.ts` | `bun test … --filter no-second-root` | Home listing snapshots; armed create guard; three invocation kinds | New |
| TC-BIN-032 | `tests/behaviour/prior-identity-state-fallback.test.ts` | `bun test … --filter override-wins` | Absolute and relative override cases; two distinct seeded stores | New |
| TC-BIN-033 | `tests/behaviour/prior-identity-state-fallback.test.ts` | `bun test … --filter both-roots` | Both roots populated with distinct records | New |
| TC-BIN-034 | `tests/behaviour/prior-identity-state-fallback.test.ts`; extends `tests/structure/state-scope.test.ts` | `bun test … --filter prior-prefix` | Counting environment record; both identities | New + Existing – Update |
| TC-BIN-035 | `tests/behaviour/prior-identity-state-fallback.test.ts` | `bun test … --filter single-root` | Mutating command fixture; append path assertion; one-resolution counter | New |
| TC-BIN-036 | `tests/behaviour/prior-identity-state-fallback.test.ts` | `bun test … --filter first-use` | Empty scratch home; marker checkout; alias twin | New |
| TC-BIN-040 | `tests/behaviour/prior-identity-notice.test.ts` | `bun test … --filter once-per-source` | Both-halves fallback fixture; separate stdout/stderr capture; one real subprocess cell | New |
| TC-BIN-041 | `tests/behaviour/prior-identity-notice.test.ts` | `bun test … --filter repeat-resolution` | Composition with two resolving handlers; sequence-numbered sink; emission guard | New |
| TC-BIN-042 | `tests/behaviour/prior-identity-notice.test.ts` | `bun test … --filter no-fallback` | Silence fixtures plus a positive control in the same suite | New |
| TC-BIN-043 | `tests/behaviour/prior-identity-notice.test.ts` | `bun test … --filter text-contract` | Canary values and canary path segment; all four reasons | New |
| TC-BIN-044 | `tests/behaviour/prior-identity-notice.test.ts`; `legacy-adapter.test.ts` as control | `bun test … --filter distinctness` | Pre-GH-288 layout fixture; `.ados` + `ADOS_` fixture; delivered controls | New + Existing – No Change |
| TC-BIN-045 | `tests/behaviour/prior-identity-notice.test.ts` | `bun test … --filter invariance` | Paired equivalent fixtures; path normalisation; exit-1 and exit-2 fixtures | New |
| TC-BIN-050 | `scripts/.tests/test-install-jaiship-launcher.sh`; `tests/structure/install-launcher.test.ts` | `bash scripts/.tests/test-install-jaiship-launcher.sh` | `mktemp` scratch HOME + project root; network/git shim; absence precondition | New |
| TC-BIN-051 | `scripts/.tests/test-install-jaiship-launcher.sh` | `bash …` | Second source copy; digest/mode/mtime comparison | New |
| TC-BIN-052 | `scripts/.tests/test-install-jaiship-launcher.sh` | `bash …` | Copied source tree removed; fake `jaiship` earlier on `PATH` | New |
| TC-BIN-053 | `scripts/.tests/test-install-jaiship-launcher.sh` | `bash …` | Override + state override; stream redirection; exit 1/2 fixtures | New |
| TC-BIN-054 | `tests/structure/entrypoint-installer-absence.test.ts`; `tests/structure/install-launcher.test.ts` | `bun test tests/structure/entrypoint-installer-absence.test.ts tests/structure/install-launcher.test.ts` | Installer source parse; temp-copy negative control | Existing – Update + New |
| TC-BIN-055 | `scripts/.tests/test-install-jaiship-launcher.sh` | `bash …` | Real-home existence/mtime snapshot; write-prefix allowlist; network/git shim | New |
| TC-BIN-060 | `tests/structure/entrypoint-bin.test.ts` | `bun test tests/structure/entrypoint-bin.test.ts` | Manifest parse; temp-root manifest mutants | Existing – Update |
| TC-BIN-061 | `tests/structure/content-inventory.test.ts` + `inventory.json` | `bun test tests/structure/content-inventory.test.ts` | Inventory entries for new files; allowance entries; entrypoint allowance loses `neutralWorkingName` and keeps `workingNameEnvironmentVariable`; temp-root mutants | Existing – Update |
| TC-BIN-062 | `tests/structure/entrypoint-bin.test.ts` | `bun test … --filter literals` | Working-name AST scan; declared CLI + unchanged-MCP inventory; entrypoint no-literal/no-accessor assertions; one in-process call with no declared default; temp-root injected sites | Existing – Update |
| TC-BIN-063 | `tests/structure/entrypoint-bin.test.ts` | `bun test … --filter shared-composition` | AST diff of the two bins; body-site search; entrypoint exports only the protocol accessor; temp-root duplicate body and launcher-side default | Existing – Update |
| TC-BIN-064 | `tests/structure/branding-seam.test.ts` (unchanged) + probe in `tests/structure/entrypoint-bin.test.ts` | `bun test tests/structure/branding-seam.test.ts tests/structure/entrypoint-bin.test.ts` | Delivered scanner + three delivered negative controls; `bin/**` and `src/entrypoint.ts` corpus probes through the exported `validateSeam` | Existing – No Change (seam file) / probe New |
| TC-BIN-065 | `tests/structure/projects-state-scope-policy.test.ts`; `tests/structure/state-scope.test.ts` | `bun test tests/structure/projects-state-scope-policy.test.ts tests/structure/state-scope.test.ts` | Delivered AST scan; helper call-count assertion; injected re-derived path | Existing – Update |
| TC-BIN-066 | `tests/structure/entrypoint-installer-absence.test.ts` | `bun test …` | Array parse; step declaration search; temp-copy array mutation | Existing – Update |
| TC-BIN-067 | `tests/structure/entrypoint-bin.test.ts`; delivered error-table sync check | `bun test … --filter family-and-error-table` | Family declaration; error-table source; extra-family mutant | Existing – Update |
| TC-BIN-070 | `tests/checks/doc-conformance.test.ts` (+ handbook §16.1.1 rows) | `bun test tests/checks/doc-conformance.test.ts` | Four new phrase-table rows; synthetic stale/required texts for the negative controls | Existing – Update |
| TC-BIN-071 | `tests/checks/identity-docs.test.ts`; `scripts/.tests/test-doc-distribution.sh` | `bun test tests/checks/identity-docs.test.ts && bash scripts/.tests/test-doc-distribution.sh` | New guide; registry JSON; temp-copy marker/registry mutations | New |
| TC-BIN-072 | `tests/checks/identity-docs.test.ts`; delivered branding-contract and manifest-privacy checks | `bun test tests/checks/identity-docs.test.ts --filter divergences` | Spec §8.5 list; guide divergence section; delivered value sources | New |
| TC-BIN-073 | `scripts/checks/forbidden-literals.ts`; `tests/checks/forbidden-literals.test.ts` | `bun run scripts/checks/forbidden-literals.ts && bun test tests/checks/forbidden-literals.test.ts` | Registry seed set/baseline; unregistered-doc and seeded-literal mutants | Existing – No Change (controls extended by the new guide) |
| TC-BIN-080 | repository root | `mkdir -p tmp/tmpdir && TMPDIR=$PWD/tmp/tmpdir pnpm check` (+ §6 re-run) | Installed workspace; `tmp/tmpdir`; recorded logs | Gate |
| TC-BIN-081 | repository root | `./scripts/lint-commit-range.sh --base main-tools` | Change branch with commits; local commitlint | Gate |
| TC-BIN-082 | delivered suites (named in the case) | `bun test …` per file + `bash scripts/.tests/test-install.sh` | Built artefacts; per-file verdicts | Existing – No Change |
| TC-BIN-083 | `tests/behaviour/daemon-start-detached.test.ts` | `bun test … --filter child-environment` | Delivered allowlist pin; identity matrix; installed-unit renderer | Existing – Update |
| TC-BIN-084 | `tests/checks/prior-identity-hermetic.test.ts` | `bun test tests/checks/prior-identity-hermetic.test.ts` | Network/credential/sleep/write counters; two canaries | New |

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| Risk | Mitigation in this plan |
|---|---|
| **R-TP-1 — A parity test passes vacuously** because both bins render through one help table, so a missing family is missing from both. | `TC-BIN-003` pairs the diff with a family-set equality against the declared twenty in both directions and two comparator mutants (PAR-TP-1); `TC-BIN-067` repeats the check for the added-token surface. |
| **R-TP-2 — A fallback test proves a read but not honest origins**, letting a laundered path pass. | `TC-BIN-020` asserts the recorded loaded-file path and the origin of every prior-supplied value; `TC-BIN-025` counts origins under the current directory name and requires zero. |
| **R-TP-3 — The "no second root" claim passes vacuously** because a read-only command never opens state. | `TC-BIN-031` drives read-only, store-opening, and mutating invocations, snapshots the home listing, and arms a create guard that must record zero violations (and is proven live). |
| **R-TP-4 — The notice is asserted only in an injected sink** and never on the real channel. | `TC-BIN-040` includes one real-subprocess cell; the payload assertion proves the notice never leaks into stdout. |
| **R-TP-5 — The installer test passes with a no-op installer or an in-place re-run.** | `TC-BIN-050` requires the file to be absent before the run; `TC-BIN-051` requires the first run to change the digest and the second to leave it untouched, plus a repoint from a second source; `TC-BIN-055` proves write confinement. |
| **R-TP-6 — The gate's temp-dir constraint is mistaken for a red gate** (or a genuine red is waived as environmental). | `TC-BIN-080` names the two fixture suites and the parity suite, records both invocations, and forbids reclassifying any other failure; §6 records the mechanism. |
| **R-TP-7 — The new files escape a structure scan silently** (for example a scan whose corpus excludes `bin/**`). | Every structure case includes a temp-root injection into the *new* file path (`TC-BIN-064` step 3, `TC-BIN-061` negative control, `TC-BIN-062` fourth-site control) so the corpus is proven to include them. |
| **R-TP-8 — The state half accidentally touches the operator's real state.** | §6 forbids mutable use of `~/.delivery-os-state`; `TC-BIN-084` fails on any write outside the temp roots; `TC-BIN-055` is the only reader of the real home (existence/mtime only). |
| **R-TP-9 — A delivered assertion is relaxed to make the change pass.** | `TC-BIN-082` step 5 requires a declared justification for every edit inside a delivered suite; `TC-BIN-064`/`TC-BIN-065` re-run the delivered negative controls unchanged. |
| **R-TP-10 — The literal-count guard drifts into matching the tree rather than the declared rule.** | `TC-BIN-062` compares against a **declared four-site inventory held in the test** (three CLI selector sites in the CLI scope plus the unchanged MCP default in its own scope) and fails by name on any undeclared site *and* on a declared site that disappears, so the inventory is the assertion's input rather than its output; the entrypoint no-literal/no-accessor assertions and the no-declared-default call add the direction that a count-only guard would miss. |
| **R-TP-11 — The `pnpm exec jaiship` cell is environment-dependent** (the workspace link exists only after install). | `TC-BIN-001` makes the semantic assertion against the entry file and treats the linked cell as an additional assertion that fails with a named setup instruction, never skips (finding `B-2`). |
| **R-TP-12 — Documentation truth is asserted by prose reading**, which no gate enforces. | `TC-BIN-070` rides the delivered phrase table (both directions), `TC-BIN-071`/`TC-BIN-073` ride machine guards (marker, registry, scan), and `TC-BIN-072` asserts the unchanged values mechanically; prose quality remains review-attested (DOC-TP-1, GAP-T5). |

### 8.2 Assumptions

- The delivered branding resolver's twelve-value derivation, the entrypoint's lenient/strict split, the seven-layer configuration acquisition with injected filesystem facts, the pure host-root policy with injected existence facts, and the installer's local/global modes are reusable as-is; this change adds inputs and one step rather than redesigning any of them.
- The delivered structure suites (`branding-seam`, `projects-state-scope-policy`, `content-inventory`) expose scanners that accept an injected root, which is how every negative control is built over the production scanner instead of a re-implementation. Where a scanner does not, the case extends it in the same change rather than duplicating the logic in the test.
- The delivered notice channel is stderr through the composition's warning/write path; the prior-identity notice uses that channel as a notice, not as a configuration warning, so the payload warning list stays empty (`TC-BIN-026`, `TC-BIN-045`).
- A project store is single-rooted (spec §12), so a fallback invocation writes into the prior root; the cases assert single-rootedness and the absence of migration-shaped writes, not read-only store access (`TC-BIN-035`).
- The alias's invalid-override failure projection may change from the currently observed `fallback.internal` containment to a classified resolver-input failure, because `AC-F2-7` requires the classified error for **both** bins while `AC-F2-3`'s byte-identity is scoped to `--version`/`--help` and `.delivery-os` paths. `TC-BIN-002` therefore pins version/help bytes only, and `TC-BIN-012` asserts the classified projection (OQ-TP-2).
- Suite file names and module seams are delivery-bound (GAP-T6); behaviours, identities, exits, closed vocabularies, precedence, and AC traceability are not.
- The operator-workstation facts in §6 describe the delivery environment; no case depends on them, so the suite is green on a clean CI runner.
- Privacy posture (spec §20/§21: paths only, no values, no new data flow) carries no NFR row; it is covered by `TC-BIN-043`'s no-value/no-secret assertion and by review attestation. No dedicated privacy case is invented beyond the declared requirements.

### 8.3 Open Questions and Findings

| ID | Question / finding | Status / Owner | Blocking |
|---|---|---|---|
| **B-1** (resolved in spec v1.1) | Historical, kept short: DM-6's "exactly three declared committed literal sites under `packages/**`" conflicted with the delivered `packages/mcp/src/serve.ts` default, which §16 declares UNCHANGED. **Resolution in spec v1.1:** DM-6, `AC-F7-10`, and NFR-6 now declare **four** sites — the three CLI selector sites plus the unchanged MCP default — and require the entrypoint module's neutral default constant *and* its `neutralWorkingName` accessor to be removed (reducing that module's executable allowance by exactly that one name, with `workingNameEnvironmentVariable` retained and still consumed by production). No blocking finding remains; `TC-BIN-062` and `TC-BIN-061` assert the reconciled text. | Resolved — spec v1.1 | No |
| **B-2** | **Non-blocking environment finding.** `AC-F1-1` names `pnpm exec jaiship --version`, which requires the workspace bin link created by `pnpm install`. The link is absent on a clean checkout until install, so a cell that only spawns `pnpm exec` is environment-dependent. | Resolved in-plan: `TC-BIN-001` asserts the semantics through the entry file and treats the linked cell as an additional assertion that fails with a named setup instruction (`pnpm install`), never skips. | No |
| **OQ-TP-1** | Which surface reports the effective host root? The spec does not pin a payload field, and `status --json`'s shape is delivered. | Open — `@coder` selects; `TC-BIN-030`/`033`/`035` assert the root at the composition seam and by write location, and fail naming the missing surface (SURF-TP-1). | No |
| **OQ-TP-2** | Exact projection of the resolver's `BrandingInputError` on a configuration-bearing command. Today the composed program throws and the entrypoint converts it to `fallback.internal` containment (exit `2`), which is not a classified input error. `AC-F2-7` requires the classified error. | Open — `@coder` surfaces the classified identity; `TC-BIN-012` asserts `field: "override"` plus a closed code and rejects `fallback.internal`; `@plan-writer` should declare which phase owns it. | No (an explicit delivery obligation) |
| **OQ-TP-3** | Exact wording of the "nothing was moved, copied, or deleted" clause and the location-naming form. The spec pins the requirement, not the sentence. | Open — `@coder`; `TC-BIN-043` asserts the semantic components (token, reason, both locations, no-move statement, ≤ 400 characters), not one exact sentence. | No |
| **OQ-TP-4** | Whether the launcher's missing-target failure is a shell `exec` guard or a Bun-side check, and therefore its exact exit code beyond "non-zero". | Open — `@coder`; `TC-BIN-052` asserts non-zero, one bounded line, the named target and remedy, and no `PATH` fallback — not a specific code. | No |
| **OQ-TP-5** | Whether the install-path self-description is exposed only to the installer or also documented as a user command. §8.1 pins the invocation, so the test treats it as public. | Open — `@doc-syncer`; `TC-BIN-006` and `TC-BIN-071` assert the invocation and the guide's mention respectively. | No |
| **OQ-TP-6** | Whether a prior-identity fallback read may legitimately surface a *delivered* configuration warning (for example `deprecated`) from the prior file. The spec forbids a *new* warning kind and forbids the fallback itself becoming a warning. | Open — `TC-BIN-026` records which delivered warning appears and asserts only that no new kind appears and that the notice never travels the warning channel. | No |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-15 | @test-plan-writer | Initial test plan against spec v1.0: all 11 ACs (`AC-F1-1`, `AC-F1-2`, `AC-F2-3`, `AC-F3-4`, `AC-F4-5`, `AC-F5-6`, `AC-F2-7`, `AC-F6-8`, `AC-F7-9`, `AC-F7-10`, `AC-F8-11`) bound to 54 cases in nine blocks (process edge 001–006, identity/override 010–014, configuration fallback 020–026, host-state fallback 030–036, notice discipline 040–045, local install 050–055, structural truth 060–067, documentation 070–073, gate 080–084); F-1..F-8, NFR-1..NFR-9, DM-1..DM-6, and DEC-4..DEC-13 mapped; six substitute assertions registered (§3.5); one blocking wording finding (`B-1`, the MCP literal versus DM-6) and one resolved environment finding (`B-2`) reported; six open questions logged; no TODO rows, no orphans. |
| 1.1 | 2026-11-15 | @test-plan-writer | Reconciled with spec **v1.1** (`B-1` resolved): `TC-BIN-062` now asserts the declared **four-site** inventory in two scopes — CLI (three selector sites) and unchanged MCP (one delivered default) — with no residual neutral default and a no-declared-default call proving the removal is not a shim; `TC-BIN-061` asserts the entrypoint module's executable allowance loses exactly `neutralWorkingName`, keeps `workingNameEnvironmentVariable`, and leaves file-set equality unchanged; `TC-BIN-063`/`TC-BIN-064` assert the entrypoint exposes no identity value, no retired accessor, and cannot be passed a neutral fallback, with the seam file still byte-identical; `LIT-TP-1` reclassified from substitute to direct assertion (five substitutions remain); `B-1` moved to resolved, blocking findings now 0; AC traceability, coverage intent, the gate invocation, and the execution-order recommendation unchanged. |

## 10. Test Execution Log

No case has been executed against an implementation at authoring time; this plan is a verification map. Results are recorded here as delivery proceeds, including the gate invocations of `TC-BIN-080`/`TC-BIN-081` and the one-off read-only equivalence observation against the operator's real prior host root (LIVE-TP-1, never part of a permanent suite).

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | — | No executions yet. |
