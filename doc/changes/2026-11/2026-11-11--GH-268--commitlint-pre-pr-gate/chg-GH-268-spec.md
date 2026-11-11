---
change:
  ref: GH-268
  type: chore
  status: Proposed
  slug: commitlint-pre-pr-gate
  title: "Enforce commit-message lint before PR creation (recurring merge blocker)"
  owners: ["engineering"]
  service: delivery tooling (commit-message lint gate + committer/PM contract)
  labels: ["hardening", "commitlint", "quality-gates", "delivery-automation"]
  version_impact: minor
  audience: internal
  security_impact: none
  risk_level: medium
  dependencies:
    internal:
      - "Root commitlint configuration and its single-authority invariant check"
      - "CI commitlint job (the authority this gate mirrors; unchanged by this change)"
      - "PM lifecycle prompt (quality_gates phase) and committer agent prompt"
      - "Autonomous delivery prompt builder and its suite (resume-sync merge instruction and assertion)"
      - "Installer delivery-script registry and its suites"
      - "Current-truth docs: quality-gates/PR feature page, autonomous-delivery feature page, monorepo scaffold toolchain page, change-lifecycle guide, AGENTS.md"
    external:
      - "git executable (read-only history queries)"
      - "@commitlint/cli and @commitlint/config-conventional (root dev dependencies)"
      - "GitHub Actions (parity reference only; no workflow change)"
links:
  related_changes: ["GH-251", "GH-230", "GH-237", "GH-240"]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make a lane learn about commit-message lint violations before it creates the PR — with per-commit diagnostics that say exactly which SHA broke which rule — and state the message contract (conventional subject, body/footer lines ≤100 characters, no plain merge subjects) where the committer and the PM actually read it, so a purely mechanical history defect stops costing a lane round-trip and a force-push.

## 1. SUMMARY

This change adds one repository-owned quality gate that lints the change branch's commit-message range against the repository's existing commitlint configuration, and wires it into the PM's `quality_gates` phase before PR creation. The gate reports one diagnostic block per offending commit — short SHA, full SHA, violated rule id(s), and the offending line — and aggregates the result into an explicit remediation mode: surgical reword for one or two offenders, condense-to-one when many commits are affected.

Alongside the gate, the change states the message contract in the committer and PM instructions (conventional subject; body and footer lines ≤100 characters; no plain `Merge remote-tracking branch ...` commit left behind) and fixes the one instruction that still generates plain merge commits — the resume-sync merge step in the autonomous delivery prompt. CI commitlint remains the authority; the `commit-msg` hook stays warn-only; no CI, history-rewrite automation, or auto-fix tooling is introduced.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **Commitlint configuration.** One root `commitlint.config.js` extends `@commitlint/config-conventional`. A repository invariant check pins that single-config authority and mutation-tests it, so a second config file or a duplicate rule source fails the check.
- **CI is the only authority.** The CI workflow's `ts-commitlint` job ("TS commitlint (CI authority)") runs commitlint three ways: against the pull request base SHA, against `origin/main-tools`, and — on push — against the merge-base range `$(git merge-base origin/main-tools HEAD)`.
- **The local hook never blocks.** `.husky/commit-msg` is explicitly warn-only: it documents itself as local convenience under its own recorded risk posture (RSK-3, NFR-9 in the specification that introduced the hook), performs no network access, mutates nothing, always exits 0, and states that CI commitlint is the authority.
- **`pnpm check` does not lint commit messages.** The aggregate local gate runs lint, format check, typecheck, test, boundaries, prompt conformance, help-guide coverage, and exports parity — all working-tree checks with no branch-history awareness, so a green local battery says nothing about the commit-message range.
- **The commit primitive validates the message it generates.** The `commit` primitive consults commitlint over the message it is about to land (bounded probe, degrades to absent when the repository has no commitlint configuration), retries once with the reported errors, and falls back to a deterministic template. That coverage is scoped to messages the primitive itself produces; it says nothing about the branch range or about commits produced by another path.
- **No repository quality-gates script exists.** `/check` resolves its command from `AGENTS.md` and otherwise defaults to `./scripts/quality-gates.sh`, which this repository does not provide; `AGENTS.md` names no quality-gates command, so `/check` has no repository-specific resolution here.
- **The autonomous delivery prompt still generates plain merges.** The per-ticket prompt's "Resume Sync" section emits a bare `git merge origin/<base>`, whose default merge subject is `Merge remote-tracking branch ...`; the prompt's own suite asserts the presence of that instruction.
- **The message rules are nowhere written down.** No current-truth doc, prompt, or guide states the body/footer 100-character limit or any merge-subject rule, so an agent can only learn the contract from CI output after the fact.
- **The failure is recurrent and purely mechanical.** GH-230 / PR #264 (one body line over 100 characters), GH-237 / PR #265 (two commits: body and footer lines over 100 characters), GH-240 / PR #267 (fourteen offending commits, resolved by condensing to one commit). Each incident cost a full lane round-trip plus a force-push; none involved a code defect.
- **Baseline lint behaviour at specification time.** The repository's configuration rejects a commit whose body line exceeds 100 characters (`body-max-line-length`) and accepts a commit whose subject is `Merge remote-tracking branch ...` (default ignore behaviour of the conventional configuration); a conventional-subject merge message lints clean.

### 2.2 Pain Points / Gaps

- **Discovery happens too late.** The violation is detected only after the PR exists, when the only available remedy is rewriting history and force-pushing — the most expensive moment to learn a formatting fact.
- **Green local gates lie by omission.** A full local battery and a green `pnpm check` create false confidence; commit-message lint is simply not part of it.
- **No commit attribution.** The authority's range output is a flat problem list with no per-commit grouping, so an agent must reconstruct which SHA is at fault before it can decide between rewording and condensing.
- **The rule is unwritten.** Agents cannot comply with a 100-character body/footer rule they have never been told about; the contract must live where the committer and PM read it.
- **The instruction generator contradicts the rule.** The resume-sync step produces exactly the plain merge subject the committer contract is supposed to forbid, so the automation keeps manufacturing history the team does not want.
- **Warn-only hooks cannot prevent recurrence.** The hook is deliberately non-blocking and stays that way, so commit-time enforcement is not available as a remedy.

## 3. PROBLEM STATEMENT

Because commit-message lint runs only in CI and the local gate battery has no branch-range awareness, and because the message contract (≤100-character body/footer lines, no plain merge subjects) is stated nowhere the committer or PM reads, a lane discovers a purely mechanical formatting violation only after PR creation — when the only fix is a history rewrite and force-push — and the delivery prompt itself still manufactures the forbidden merge subject, so the same avoidable round-trip recurred three times in recent deliveries.

## 4. GOALS

- **G-1**: Local discovery — a change branch whose commits would fail the repository's commitlint configuration is identified before PR creation, inside the `quality_gates` phase.
- **G-2**: Surgical diagnostics — every failure names each offending commit by short SHA (with its full SHA available), the violated rule id(s), and the offending line, so remediation is mechanical rather than investigative.
- **G-3**: Explicit remediation mode — the gate's summary distinguishes reword-when-few from condense-to-one-when-many, so the agent does not choose a remediation strategy by guesswork.
- **G-4**: Stated contract — the committer and PM instructions state the subject, body/footer, and merge-subject rules, and describe both remediation modes.
- **G-5**: No manufactured violations — the resume-sync instruction produces a conventional-subject sync merge instead of a plain merge subject.
- **G-6**: Truthful preconditions — the gate never silently passes: a missing base, a missing tool, or a missing merge-base is a loud inability to verify, not a clean result.
- **G-7**: Parity and confinement — the gate's verdict equals the authority's verdict for the same range (no stricter, no looser), CI stays the authority, the hook stays warn-only, and no delivery-semantics, CI, or product-surface behaviour changes.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Malformed commits discovered locally before PR creation | 100% of gate runs over the affected range |
| Failures that name every offending commit by SHA and at least one rule id | 100% |
| False positives on valid conventional history (including conventional-subject merge commits) | 0 |
| Commit-message CI failures on delivered changes (the PR #264/#265/#267 class) | 0 per change |
| Gate wall time on a ≤20-commit range on a developer machine | ≤ 10 seconds |
| Silent passes (violations present, exit 0) | 0 |
| Behaviour changes to delivery semantics | 0 |

### 4.2 Non-Goals

- **NG-1**: Changing CI. The `ts-commitlint` job stays the authority and its workflow is untouched.
- **NG-2**: Enforcing commit-time blocking. The `commit-msg` hook stays warn-only.
- **NG-3**: Automating history rewrite. No reword, rebase, squash, or force-push automation is introduced; the gate advises, the agent acts.
- **NG-4**: Auto-fix or message-generation tooling for offending commits.
- **NG-5**: Changing `pnpm check`, `/check`, or `/check-fix` semantics, or adding a `delivery-os` CLI subcommand.
- **NG-6**: Changing the commitlint configuration, its rule set, or its default-ignore behaviour.
- **NG-7**: Linting anything other than commit messages (diffs, branch names, PR titles).

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Pre-PR branch-range commit-message gate | G-1: the violation class must be discoverable locally, before history becomes expensive to change. |
| F-2 | Per-commit diagnostics with remediation-mode aggregation | G-2, G-3: an unattributed problem list forces investigation; a stated mode makes remediation mechanical. |
| F-3 | Deterministic preconditions and exit-code contract | G-6, G-7: a gate that can pass without verifying is worse than no gate, and a distinct "cannot verify" outcome keeps environment faults from being mistaken for violations. |
| F-4 | Committer/PM message contract statement | G-4: agents comply with stated constraints; the contract currently exists only in CI output. |
| F-5 | Conventional-subject resume-sync merge instruction | G-5: the automation must stop manufacturing the subject the contract forbids. |
| F-6 | Quality-gates-phase wiring | G-1: the gate must be a required step of the phase that precedes PR creation, with evidence recorded. |
| F-7 | Distribution and installer registration | The gate is referenced by lifecycle prompts, so adopters must receive it with the other delivery scripts (and be safe when their repository has no commitlint configuration). |
| F-8 | Documentation truth | The feature pages, the lifecycle guide, and `AGENTS.md` must describe the gate and the contract that actually exist. |

### 5.1 Capability Details

- **F-1 — Additive, parity-bound gate.** A repository-owned gate lints every commit in the change branch's range against the repository's existing commitlint configuration. Its verdict is the configuration's verdict for the same range: no additional rule, no relaxed rule, no re-implementation of a rule. The range is the merge-base of the delivery base branch and `HEAD` up to `HEAD`, so only the change's own commits are judged and merged-upstream history is never re-litigated. The gate is read-only: it performs no staging, no ref update, no checkout, and no network access, and it never rewrites, reorders, or amends history.
  - **Identity and invocation.** The gate ships as the repository script `scripts/lint-commit-range.sh` and is invoked from the repository root as `./scripts/lint-commit-range.sh [--base <ref>]`, with help and version output available. This invocation is the contract that the lifecycle prompts, `AGENTS.md`, and the change-lifecycle guide reference; nothing about it depends on which directory the change lives in, and it requires no `PATH` modification because the gate resolves the repository's own commitlint binary itself (F-3).
  - **Range semantics.** The verdict is the verdict of the authority's range form — the commits between the resolved merge-base and `HEAD` (`--from <merge-base> --to HEAD` semantics) — with per-commit attribution derived from that same configuration, which is what the ticket's proposed command plus per-commit loop describes at contract level.
- **F-2 — Diagnostics.** For every offending commit the gate emits one attributed block, oldest to newest, carrying: the short SHA (human-facing), the full SHA (available in the same block for surgical operations), a bounded subject excerpt, and for each violated rule the rule id, the line number, and a bounded excerpt of the offending line. Rule ids are the configuration's ids verbatim, so remediation maps directly onto the authority's messages. The summary counts commits in range, offending commits, and the distinct rules hit. Offenders are counted per commit, not per violation: a commit with three bad lines is one offender.
- **F-3 — Preconditions and exit contract.** The gate resolves its base in a fixed precedence: an explicit base override, then the project's configured delivery base branch (with the established environment override), then the documented default; the resolved ref is preferred as the remote-tracking ref when it exists, otherwise the local branch. The range start is the merge-base of that base commit and `HEAD`. Every terminal condition has exactly one outcome and one exit code (table below). The gate never fetches, never guesses a base, and never degrades a verification it could not perform into success: an unresolvable base, an unresolvable merge-base, or a missing commitlint binary in a repository that configures commitlint is an error with a remediation hint. A repository with no commitlint configuration is reported as an explicit skip, because there is no authority to mirror.
  - **Binary resolution.** The lint tool resolves in a fixed precedence: the repository-local binary at `node_modules/.bin/commitlint` when it exists and is executable, then a `commitlint` on `PATH` when the local one is absent or not executable. This is why the published invocation needs no `PATH` modification: the workspace CLI lives in the repository's own dependency tree — the same reason the commit-time hook invokes the local binary by explicit path and CI uses the package-manager-executed form.
  - **Binary disclosure (parity).** The verdict header names which binary was used and where it resolved from (repository-local or `PATH`), so a verdict is auditable against the tool that produced it. A binary resolved from outside the repository — a global install, or a sibling checkout earlier on `PATH` — is a parity risk: the gate still renders that tool's verdict, but the header discloses the foreign origin so the mismatch is visible rather than silent. This disclosure changes no terminal condition: DM-1.g keeps its meaning unchanged (configuration present and no usable binary at all → `ERROR`, exit `2`).
- **F-4 — Message contract.** The committer and PM instructions state, as constraints on the artifact rather than as command recipes: the subject is a conventional header in the repository's convention and carries the work item reference; body and footer lines stay within 100 characters; a sync from the delivery branch must not leave a plain `Merge remote-tracking branch ...` subject behind, so merges carry a conventional subject (or the branch is integrated without a merge commit); and a failing range is remediated in one of two modes — reword the named commits when one or two are affected, condense the branch range into one conventional commit when many are. **Ownership is explicit.** The committer owns the message it produces: subject, body, and footer compliance hold at authoring time, and the committer reports the contract without rewriting history itself. The PM owns the range verdict: it runs the gate, reads the offending-commit count, and selects one of the two remediation modes. The acting agent (the coder lane the PM delegates to, or the PM where the lifecycle permits) performs the reword or the condensation as an explicit history action outside the gate. The gate itself only reports and advises: it holds no history-mutating capability and triggers no rewrite. The contract states rules only; it does not teach raw git write commands, so the prompt conformance scan stays green.
- **F-5 — Resume-sync instruction.** The autonomous delivery prompt's resume-sync step is changed so the instruction it emits produces a merge whose subject is conventional (referencing the work item) instead of a plain merge subject, and the prompt's assertion test asserts the new instruction shape. The prompt change is instruction text only; delivery orchestration, single-flight, liveness, and result classification are untouched.
- **F-6 — Gate wiring.** The PM's `quality_gates` phase gains the range lint as a required step before the phase may be declared complete: a clean result lets the phase complete; a violation result is remediated in the mode the gate named and the gate is re-run; an "unable to verify" result is resolved at its cause (install dependencies, fetch the base, pass the correct base) and is never recorded as a pass. The verdict line is recorded as gate evidence in the change's PM notes. Ownership crosses F-4: the PM reads the verdict and selects the mode, the acting agent performs the history action, and the gate only reports — it never rewrites, reorders, or triggers a rewrite. The gate is presented in `AGENTS.md` as a supplementary lifecycle pre-PR gate, not as the repository's general quality-gates command, so `/check`'s resolution contract and behaviour are unchanged in this repository and for adopters.
- **F-7 — Distribution.** The gate is part of the delivery-script set installed into adopting projects, alongside the other lifecycle scripts, and is covered by the installer/uninstaller suites. Because probes reference it by name, adopting projects must receive it; because adopting projects may not configure commitlint at all, the explicit-skip outcome (F-3) is what makes distribution safe.
- **F-8 — Documentation truth.** The quality-gates/PR feature page gains the gate and the stated committer contract; the autonomous-delivery feature page is reconciled in the resume-sync instruction shape and in all three places that enumerate the delivered scripts — its overview sentence listing the delivered scripts, its delivered-file ("Core Components") table, and its explicit **Install inventory** blockquote that registers delivery scripts in `ADOS_DELIVERY_SCRIPTS` — so the new gate appears in each and each enumeration agrees with the installer's declared set: either completed to every `ADOS_DELIVERY_SCRIPTS` entry (which also closes the pre-existing omission of `scripts/lib/dispatch-authority.sh`) or explicitly marked illustrative with `scripts/install.sh` named as the authoritative set, with the route taken recorded in the page; the change-lifecycle guide's `quality_gates` phase names the range lint in its actions and exit criteria; `AGENTS.md` states the gate and its lifecycle placement. The monorepo scaffold toolchain page's "CI commitlint is the authority" statement stays true and is clarified to name the local pre-PR gate as a mirror, not a replacement. No new distributable documentation area is created, so no new distribution marker is introduced; every touched doc keeps its existing marker and the doc-distribution guard stays green.

**Terminal-condition contract (authoritative):**

| ID | Condition | Outcome | Exit |
|----|-----------|---------|------|
| DM-1.a | All commits in range satisfy the configuration | PASS — commits in range counted | 0 |
| DM-1.b | Range is empty (`HEAD` equals the merge-base) | PASS — explicitly reported as zero commits in range | 0 |
| DM-1.c | At least one offending commit | FAIL — attributed diagnostics plus remediation mode | 1 |
| DM-1.d | Repository configures no commitlint | SKIP — explicitly reported; nothing to mirror | 0 |
| DM-1.e | Base override or configured base does not resolve | ERROR — cause plus remediation hint | 2 |
| DM-1.f | Merge-base cannot be determined (unrelated or shallow history) | ERROR — cause plus remediation hint | 2 |
| DM-1.g | Configuration present but commitlint binary unavailable | ERROR — cause plus remediation hint (install dependencies) | 2 |
| DM-1.h | commitlint fails to render a verdict (invalid configuration, execution failure) | ERROR — cause plus remediation hint | 2 |
| DM-1.i | Usage error (unknown argument, invalid base syntax) | ERROR — usage | 2 |

**Evaluation order (terminal precedence).** Because several conditions can hold at once, the rows are evaluated in this fixed order and the **first row that matches decides the run** — the remaining rows are not consulted, and every row keeps its stated outcome and exit code:

1. `DM-1.i` — usage validation. Argument parsing precedes all repository inspection, so an invalid invocation is reported even in a repository with no commitlint configuration.
2. `DM-1.d` — configuration presence. A repository that configures no commitlint reports `SKIP` (exit `0`) **regardless of base or binary state**, because there is no authority to mirror. `DM-1.e`, `DM-1.g`, and `DM-1.h` are therefore unreachable in such a repository, and the "unable to verify" rows describe repositories that do configure commitlint.
3. `DM-1.e` — base resolution, then `DM-1.f` — merge-base determination. Both precede the tool probe: a repository with an unresolvable base and no usable binary reports the base error, not the missing tool.
4. `DM-1.g` — binary resolution. Reached only once a range exists.
5. `DM-1.h` — lint execution, then `DM-1.a` / `DM-1.b` / `DM-1.c` — the per-commit verdict. A tooling failure at this stage is an error, never a violation.

## 6. USER & SYSTEM FLOWS

```
Flow 1: Clean branch (the normal path)
  lane finishes review_fix → quality_gates starts
    → range lint resolves base + merge-base → N commits in range
    → every commit satisfies the configuration → PASS (exit 0)
    → verdict recorded as gate evidence → quality_gates completes → PR creation
    → CI commitlint still re-verifies the same range (authority unchanged)

Flow 2: One or two offending commits (surgical reword)
  quality_gates → range lint → FAIL (exit 1)
    → diagnostics: FAIL <short-sha> (<full-sha>) · rule=<id> line=<n> · <excerpt>
    → MODE: SURGICAL REWORD — reword the named commit(s), leave the rest intact
    → gate re-run → PASS → quality_gates completes

Flow 3: Many offending commits (condense)
  quality_gates → range lint → FAIL (exit 1), five offenders named
    → MODE: CONDENSE-TO-ONE — collapse the range into one conventional commit
    → gate re-run → PASS → quality_gates completes
    (no automation performs the rewrite; the agent acts, the gate only advises)

Flow 4: Cannot verify (never a silent pass)
  quality_gates → range lint → base unresolvable / binary missing / invalid config
    → ERROR (exit 2) with cause and remediation hint
    → agent fixes the environment → gate re-run
    → the phase is never completed on an unresolved ERROR

Flow 5: No commitlint configuration in the project
  quality_gates → range lint → SKIP (exit 0), explicitly reported
    → nothing to mirror; the phase proceeds with the skip recorded
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The branch-range commit-message gate as repository automation, with its base-resolution precedence, terminal-condition contract, exit codes, diagnostics, and remediation-mode aggregation.
- Its self-test suite (positive, negative, precondition — including binary-resolution precedence and the disclosure header — skip, and no-false-positive scenarios) under the repository's script-test convention.
- Its registration in the installer's delivery-script set and the installer/uninstaller suites that cover that set.
- The committer prompt's message contract (conventional subject with work item reference, body/footer ≤100 characters, no plain merge subject) and both remediation modes.
- The PM prompt's `quality_gates` phase: the gate as a required step, its remediation loop, and the never-waive rule for an unresolved "unable to verify".
- The resume-sync merge instruction in the autonomous delivery prompt and its prompt assertion test.
- `AGENTS.md` (gate statement and lifecycle placement) and the change-lifecycle guide's `quality_gates` phase.
- Current-truth feature pages, guides, and `AGENTS.md` that describe the gate, the contract, the changed prompt instruction, and the delivered-script inventory.

### 7.2 Out of Scope

- [OUT] Any CI workflow change; the `ts-commitlint` job remains the authority, unchanged.
- [OUT] Enforcing the `commit-msg` hook (it stays warn-only) or adding any commit-time blocking check.
- [OUT] History-rewrite automation of any kind: no reword, rebase, squash, force-push, or reset tooling.
- [OUT] Auto-fix or message-regeneration tooling for offending commits.
- [OUT] Adding the commit-message lint to `pnpm check`, and changing `/check` or `/check-fix` semantics.
- [OUT] A new `delivery-os` CLI command or any product-surface (CLI/MCP) change.
- [OUT] Changing the commitlint configuration, its rules, its version, or its default-ignore behaviour (including making plain merge subjects fail).
- [OUT] Fixing the pre-existing absence of a repository `scripts/quality-gates.sh` or `/check`'s fallback behaviour.
- [OUT] Linting PR titles, branch names, diffs, or any artifact other than commit messages.
- [OUT] Retrofitting existing merged history, or re-verifying past PRs.

### 7.3 Deferred / Maybe-Later

- A machine-readable (JSON) gate output for tooling consumption — unnecessary while the verdict is consumed by an agent reading text.
- Reusing the same gate inside CI so the local and CI verdicts share one implementation, if the authority's workflow is ever restructured.
- A blocking commit-time hook, if the warn-only posture is ever revisited.
- Rejecting plain merge subjects in the gate, which would require disabling the configuration's default ignores and changing CI parity (see OQ-1).

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — no network surface is added or changed; the gate performs no network access at all.

### 8.2 Events / Messages

N/A — no event or message contract is introduced. The gate's contract surfaces are its invocation, its exit codes (DM-1), its diagnostics (DM-2), and its aggregation rule (DM-3), specified below.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Gate verdict record | One verdict per run: outcome (`PASS` / `FAIL` / `SKIP` / `ERROR`), exit code (`0` / `1` / `2`), base ref used and how it was resolved, the commitlint binary used and its resolution origin (repository-local `node_modules/.bin` or `PATH`), merge-base SHA, `HEAD` SHA, commit count in range, offending-commit count. Exactly one outcome per run: the terminal-condition rows `DM-1.a`–`DM-1.i` in 5.1 enumerate every terminal case and, read with the evaluation order pinned there, are decision-complete. |
| DM-2 | Per-commit diagnostic | One block per offending commit: short SHA, full SHA, bounded subject excerpt, and per violated rule the rule id with the offending line number and a bounded line excerpt. Ordered oldest to newest; deterministic for an unchanged range and configuration. |
| DM-3 | Remediation-mode rule | Offending commits counted per commit: 1–2 offenders → `SURGICAL REWORD` (reword only the named commits); ≥3 offenders → `CONDENSE-TO-ONE` (collapse the branch range into one conventional commit). Advisory output only; no automation acts on it. |

### 8.4 External Integrations

- **git executable (local, read-only):** the gate queries refs, the merge-base, `HEAD`, and the commit range. It never fetches, never writes refs, and never touches the index or working tree.
- **commitlint CLI (root dev dependency):** invoked over the same configuration the CI authority uses; its rule ids and messages are reported verbatim. A repository without commitlint configuration has nothing to mirror (skip).
- **Project base-branch configuration:** the delivery base branch is read from the same project configuration the lifecycle already uses, with the established environment override and documented default; an explicit override on the gate takes precedence for one-off checks.
- **GitHub Actions:** unchanged and untouched; it remains the authority against which the gate's parity is asserted.

### 8.5 Backward Compatibility

- **Additive gate:** no existing command, gate, or lifecycle phase changes its meaning. `pnpm check`, `/check`, `/check-fix`, the `commit` primitive, and CI keep their current contracts and exit behaviour.
- **Prompt contract addition:** the committer/PM prompts gain stated constraints. A commit message that was already compliant needs no change; the only newly rejected artifacts are those the authority already rejects today.
- **Hook unchanged:** the `commit-msg` hook stays warn-only and always exits 0, so commit-time behaviour for every existing workflow is unchanged (DEC-2).
- **Adopters without commitlint:** the gate reports an explicit skip rather than a failure, so distribution cannot break a project that never linted commit messages.
- **Adopters with commitlint but no installed dependencies:** the gate reports an error with an install hint; this is intentional (a wrongly-green gate is worse than a loud environment error) and is called out as a residual operational risk (RSK-2).
- **Plain merge subjects:** because the conventional configuration ignores merge subjects by default, a plain merge commit still lints clean; the merge rule is therefore instruction-level and preventive (DEC-4, RSK-3) and no previously-passing history becomes failing.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Determinism: the same range, configuration, and tool version produce the same diagnostics content and the same exit code | 0 variance across repeated runs; stable ordering |
| NFR-2 | Fail-closed: a verification the gate could not perform is never reported as success | 0 silent passes across all precondition scenarios |
| NFR-3 | Zero false positives on valid conventional history, including conventional-subject merge commits and merged-upstream commits outside the range | 0 false failures |
| NFR-4 | Runtime: bounded gate duration with no network access | ≤ 10 s for ≤20 commits; ≤ 60 s for ≤100 commits; 0 network calls |
| NFR-5 | Read-only: the gate mutates nothing | 0 working-tree, index, ref, or stash changes across all runs |
| NFR-6 | Bounded output: diagnostics stay readable and never flood a log | ≤ 20 rule lines per commit; ≤ 200 diagnostic lines total; excerpt ≤ 160 characters |
| NFR-7 | Exit-code stability: exactly three codes with fixed meanings (`0` pass/skip, `1` violations, `2` unable to verify or usage error) | 0 undocumented codes; 0 meaning drift |
| NFR-8 | Scope confinement: no behaviour change to delivery semantics, CI, hooks, product surface, or configuration | 0 out-of-scope changes per review |
| NFR-9 | Conformance: the aggregate local gate, the prompt-conformance scan, the doc-conformance scan, and the doc-distribution guard stay green against the edited prompts, scripts, and docs | 0 new violations |
| NFR-10 | Diagnosability: every failing run names every offending commit by SHA with at least one rule id and line reference | 100% of failure scenarios |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- The gate's stdout is its observability surface: a header line naming the resolved base, merge-base, `HEAD`, commit count, and the commitlint binary used with its resolution origin; one block per offending commit; a summary verdict line; and — on failure — a remediation-mode line. The verdict line is deliberately quotable so it can be carried as evidence.
- The PM records the gate verdict (outcome, commit count, offending count, and the mode when failing) as a PM-notes evidence entry for the `quality_gates` phase, so the completion claim is inspectable later and the DoD check can see what was actually linted.
- No metrics, traces, spans, or network telemetry are introduced. Nothing is written outside the change's own artifacts; the gate creates no files and leaves no state behind.
- All report content — header, per-commit diagnostics, remediation mode, and the final verdict line — is written to the standard output stream. On a failing or error outcome the verdict line is additionally written to the standard error stream, so a caller that captures only one stream still sees the failing side's signal; every failing run exits non-zero regardless.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|------|------|--------|-------------|------------|---------------|
| RSK-1 | The gate diverges from the authority (different configuration source, different invocation, different tool version, different rule semantics) and blocks history CI accepts — or accepts history CI rejects | H | M | Verdict defined as parity with the existing single root configuration and its CLI (F-1, DEC-4); the single-config invariant already pins configuration authority; binary resolution prefers the repository-local CLI and discloses a foreign origin in the verdict header (F-3, DEC-10); positive fixtures include a conventional-subject merge commit and a plain merge subject to prove the ignored-subject parity | L — parity is pinned, disclosed, and fixture-proven |
| RSK-2 | Environment faults (missing dependencies, unfetched base, shallow clone) are misread as violations, stalling a lane with a confusing message | M | M | Distinct "unable to verify" outcome and exit code (DM-1.e–h) with remediation hints; prompts state that an unresolved error is never a pass; the gate never fetches so the hint names the fetch explicitly | M — an agent can still misread output; the distinct code is the guard |
| RSK-3 | Plain merge subjects remain possible, because the configuration ignores them by default, so the merge rule is instruction-level only | M | M | Contract states the rule (F-4); the resume-sync generator is fixed so automation stops producing it (F-5); residual enforcement is review-time; the stronger option is recorded and deliberately deferred (OQ-1) | M — non-zero by design; the recurring mechanical cause is removed |
| RSK-4 | A long-lived branch accumulates many commits and the gate becomes slow or noisy | L | M | Runtime budget and bounded output (NFR-4, NFR-6); the ≥3-offender mode already tells the agent to condense, which shortens future ranges | L |
| RSK-5 | Prompt edits break the conformance scans (raw git write detection, current-truth phrase rules) and turn a hardening change into a red gate | M | M | The contract is stated as constraints, not command recipes; the prompt-conformance scan and doc-conformance test run in the aggregate gate (NFR-9); AC-F8-1 requires the full battery green | L |
| RSK-6 | Documentation drift: the feature pages, lifecycle guide, and `AGENTS.md` describe gates or prompts that no longer match | L | H | Documentation impact register (Appendix C) pre-registers every reconciliation point for the system-spec update phase; the touch points are enumerated in F-8 | L — residual items are doc-syncer-owned and listed |
| RSK-7 | Scope creep: the change attracts CI edits, hook enforcement, or rewrite automation because they look adjacent | M | L | Hard out-of-scope pins (7.2), the confinement criterion (AC-NFR8-1), and recorded decisions (DEC-2, DEC-3, DEC-5) | L |
| RSK-8 | The gate is distributed to adopters who cannot satisfy its preconditions, producing loud errors on adoption | M | L | Explicit skip when no commitlint configuration exists (DM-1.d, DEC-6); error hints name the install step; installer suites cover the distributed set | L–M — adopters with commitlint but no install will see an error by design |

## 12. ASSUMPTIONS

- The delivery base branch is resolvable locally in a lane at quality-gates time (it is fetched when the branch is created or synced); when it is not, a loud error with a fetch hint is the correct outcome, not a pass.
- The repository's root commitlint configuration and its CLI version are the single source of rule truth; the gate adds no rule of its own.
- The conventional configuration ignores `Merge remote-tracking branch ...` subjects by default, verified empirically at specification time: a plain merge subject lints clean while a 100+-character body line is rejected. The merge rule is therefore preventive/instruction-level rather than gate-enforced (DEC-4).
- Lanes run the repository's dependency install before quality gates. That install places the workspace CLI at `node_modules/.bin/commitlint` and does not add it to `PATH`, so the gate resolves the repository-local binary first and falls back to `PATH` only when the local one is absent or not executable; the published invocation therefore works with no `PATH` modification (F-3).
- A `commitlint` found on `PATH` may belong to a global install or to another checkout; the gate names the resolved binary and its origin in the verdict header so a foreign-tool verdict is visible rather than silent, and that disclosure is treated as a parity risk to reconcile, not as a failure condition (F-3, RSK-1).
- The established base-branch resolution semantics (environment override, project configuration, documented default) are the right semantics for the gate, with an explicit per-invocation override on top.
- The commits in a change's range are its own: the merge-base boundary keeps merged-upstream history out of the verdict.
- The gate is referenced by lifecycle prompts, so distributing it with the delivery scripts is the only way adopters can follow those prompts.
- No new distributable documentation area is created, so no new distribution marker is needed; touched docs retain their markers.
- Editing prompts and scripts does not change delivery orchestration, lifecycle phase semantics, or result classification.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Root commitlint configuration and its single-authority invariant | The gate mirrors exactly this configuration; the invariant keeps it single. |
| Depends on | CI commitlint job | Parity reference; it stays the authority and runs against the same range shapes. |
| Depends on | `@commitlint/cli` and `@commitlint/config-conventional` (root dev dependencies) | Tool and rule source; version is pinned by the lockfile. |
| Depends on | PM lifecycle prompt (`quality_gates`) and committer prompt | Wiring and contract statement; prompt-conformance scans apply. |
| Depends on | Autonomous delivery prompt builder and its suite | The resume-sync instruction and its assertion change together. |
| Depends on | Installer delivery-script registry and its suites | Distribution and install/uninstall coverage. |
| Depends on | Current-truth feature pages, lifecycle guide, `AGENTS.md` | Documentation truth for the gate and the contract. |
| Blocks | Nothing | This is additive hardening; no other change waits on it. |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Should plain merge subjects (`Merge remote-tracking branch ...`) become a hard gate failure? | Today the conventional configuration ignores these subjects, and the gate mirrors the configuration for parity (DEC-4); making them fail would require either disabling default ignores in the shared configuration (changing CI verdicts and every future history) or adding a repository-specific rule to the gate (breaking parity, and contradicting "no false positives"). The change instead fixes the instruction that generates them (F-5) and states the rule (F-4). Decision needed: consult `@decision-advisor`; not blocking this change. | Open — non-blocking |
| OQ-2 | Should the parity principle — a local gate mirrors the CI authority and may never be stricter or looser (DEC-1, DEC-4) — be raised as a durable decision record? | The principle is precedent-setting and future gate work will cite it, yet it lives only in this change's decision log. This change deliberately does not author the record: routing happens at PR review through the change reviewer/owner to `@decision-advisor`, so the deferral is recorded rather than silent. | Open — non-blocking, deferred to the change reviewer/owner at PR review |

Both rows above are non-blocking. OQ-2 is a recorded deferral, not a delivery gate: no decision record is authored by this change. The planning session otherwise closed with no open questions in the PM notes, and the three PM decisions are honoured as DEC-2, DEC-3, and DEC-5 (the decision text is restated in the decision log with its operative consequence).

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | The gate's verdict is the repository configuration's verdict for the same range — no additional rules, no relaxed rules, no re-implementation | Parity is the property that makes a local gate trustworthy: it can neither block history CI accepts nor accept history CI rejects (G-7, RSK-1). The principle is routed to a durable decision record at PR review via OQ-2 | 2026-11-11 |
| DEC-2 | The `commit-msg` hook stays warn-only; commit-time blocking is not added | Ticket item 3 is explicitly optional; the hook documents its non-blocking posture; a blocking hook changes commit-time behaviour for every commit and collides with the commit primitive's validation-and-one-retry path; the ticket bounds the change to docs plus script/prompt with no delivery-semantics change (PM decision 1) | 2026-11-11 |
| DEC-3 | The local gate is repository automation with its own script-test suite, not a new `delivery-os` CLI command | A CLI subcommand would be a product-surface change beyond the ticket's "docs-only + script/prompt" boundary (PM decision 3, NG-5) | 2026-11-11 |
| DEC-4 | Because the configuration ignores plain merge subjects, plain merges are forbidden by the stated contract, not by the gate; parity is preserved rather than trading it for an extra rule | The gate must not be stricter than the authority (DEC-1); the recurring cause is removed at its source by fixing the instruction that generated those subjects (F-5); the stronger enforcement option is recorded as OQ-1 | 2026-11-11 |
| DEC-5 | The resume-sync merge instruction in the autonomous delivery prompt is in scope, together with its prompt assertion | Leaving a bare merge instruction in the generator keeps manufacturing the exact subject the contract forbids (PM decision 2, F-5) | 2026-11-11 |
| DEC-6 | The gate is distributed with the delivery scripts and distinguishes "no commitlint configuration" (explicit skip) from "cannot verify" (loud error) | Prompts reference it by name, so adopters must receive it; an explicit skip keeps distribution safe for projects that never linted commit messages, while a configured project with a broken environment must fail loudly (F-3, F-7) | 2026-11-11 |
| DEC-7 | The gate never fetches; base resolution uses a fixed precedence (explicit override → project delivery base → documented default, remote-tracking ref preferred) and an unresolvable base is an error | A local quality gate must be deterministic, offline, and read-only; implicit network access inside a gate makes its result depend on the environment and can stall a lane (NFR-4, NFR-5) | 2026-11-11 |
| DEC-8 | `pnpm check`, `/check`, and `/check-fix` are unchanged; the gate is wired into the PM `quality_gates` phase and stated in `AGENTS.md` as a supplementary pre-PR gate | `pnpm check` is base-agnostic by design and must run in any checkout; `/check`'s resolution contract is repository-configured and must not be repurposed into a history check (NG-5, F-6) | 2026-11-11 |
| DEC-9 | Offending-commit count decides the remediation mode: 1–2 → surgical reword; ≥3 → condense-to-one | Matches the ticket's stated distinction and the observed incidents; a per-commit count avoids over-condensing for a single multi-rule commit (G-3, DM-3) | 2026-11-11 |
| DEC-10 | The lint tool resolves repository-local first (`node_modules/.bin/commitlint` when present and executable), then `PATH`; the verdict header names the binary and its origin, and an out-of-repository origin is disclosed as a parity risk; DM-1.g keeps its meaning (no usable binary at all → `ERROR`, exit `2`) | The workspace CLI is not placed on `PATH` by the dependency install (the commit-time hook and CI both invoke it by explicit path/executor), so a `PATH`-only probe would make the published invocation resolve to DM-1.g on this very repository and stall the `quality_gates` phase under the never-waive rule; preferring the repository's own binary keeps the verdict attributable, and disclosing a foreign origin prevents a sibling checkout or global install from deciding parity silently (F-1, F-3, RSK-1) | 2026-11-11 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Branch-range commit-message gate (repository automation) | New — owns base resolution, range derivation, per-commit diagnostics, aggregation mode, exit contract (F-1, F-2, F-3). |
| Gate self-test suite | New — positive, negative, precondition (including binary-resolution precedence and disclosure), skip, and no-false-positive scenarios under the script-test convention. |
| Installer delivery-script registry | Updated — the gate joins the distributed delivery scripts; install/uninstall suites cover it (F-7). |
| PM lifecycle prompt — `quality_gates` phase | Updated — the range lint is a required step with a remediation loop and a never-waive rule for unresolved errors (F-6). |
| Committer prompt | Updated — message contract: conventional subject with work item reference, body/footer ≤100 characters, no plain merge subject, both remediation modes (F-4). |
| Autonomous delivery prompt builder | Updated — resume-sync emits a conventional-subject merge instruction (F-5). |
| Autonomous delivery prompt suite | Updated — the resume-sync assertion matches the new instruction shape. |
| `AGENTS.md` | Updated — gate statement and its lifecycle placement; script-registration note already exists and now covers the gate. |
| Change-lifecycle guide — `quality_gates` phase | Updated — action and exit criteria name the range lint. |
| Quality-gates/PR feature page | Updated at system-spec update — new capability plus the stated committer contract. |
| Autonomous-delivery feature page | Updated at system-spec update — prompt instruction shape, plus the three delivered-script enumerations (overview sentence, delivered-file table, and the "Install inventory" blockquote) so the gate appears in each and each agrees with the installer's declared set (completed to every entry, including the pre-existing dispatch-authority helper omission, or marked illustrative with `scripts/install.sh` authoritative; route recorded). |
| Autonomous batch delivery guide — installation section | Updated at system-spec update — the comment block listing the delivery scripts copied into `./scripts/` gains the gate (the list is illustrative and already non-exhaustive; keep it consistent with the installer set). |
| Monorepo scaffold toolchain page | Clarified at system-spec update — "CI commitlint is the authority" stays true; the local gate is named as its mirror. |
| Commitlint configuration and its authority invariant | Unchanged — the gate mirrors them; both must stay green. |
| CI workflow (`ts-commitlint` and all other jobs) | Unchanged — still the authority. |
| `commit-msg` hook | Unchanged — warn-only. |
| `pnpm check`, `/check`, `/check-fix`, commit primitive, CLI surface | Unchanged. |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** a test branch whose range contains a deliberately malformed commit (for example a body line over 100 characters), **when** the gate runs before PR creation, **then** it exits non-zero with a violation verdict, and the offending commit's short SHA and the violated rule id appear in its output. | F-1, F-2, NFR-2 |
| AC-F1-2 | **Given** a range of valid conventional commits — including a merge commit with a conventional subject, and with upstream history merged in from the delivery branch lying outside the merge-base range — **when** the gate runs, **then** it reports a pass, exits success, and produces no diagnostics; the suite demonstrates zero false positives across these shapes. | F-1, NFR-3, DEC-1 |
| AC-F2-1 | **Given** a range with offending commits, **when** diagnostics are produced, **then** each offending commit has one block carrying its short SHA, its full SHA available in the same block, at least one violated rule id with the offending line number and a bounded excerpt, and the blocks are ordered oldest to newest deterministically. | F-2, DM-2, NFR-1, NFR-10 |
| AC-F2-2 | **Given** ranges with one, two, and three-or-more offending commits, **when** the gate reports failure, **then** the summary names `SURGICAL REWORD` for one or two offenders and `CONDENSE-TO-ONE` for three or more, where offenders are counted per commit and not per violation; the mode line is advisory and no rewrite is performed. | F-2, DM-3, NFR-5 |
| AC-F3-1 | **Given** a branch whose `HEAD` equals the merge-base with the base, **when** the gate runs, **then** it reports a pass that explicitly states zero commits were in range and exits success. | F-3, DM-1.b |
| AC-F3-2 | **Given** a repository that configures commitlint and an unresolvable base override, an unresolvable configured base, or an undeterminable merge-base, **when** the gate runs, **then** it exits with the "unable to verify" code, states the cause and a remediation hint, and never reports a pass; in a repository with no commitlint configuration the earlier `SKIP` precedence governs instead (DM-1 evaluation order). | F-3, DM-1.e, DM-1.f, NFR-2 |
| AC-F3-3 | **Given** a repository that configures commitlint but has no usable commitlint binary, **when** the gate runs, **then** it exits with the "unable to verify" code naming the missing tool; **given** a repository whose dependency tree provides the local commitlint binary, **when** the gate runs, **then** it uses that repository-local binary in preference to any `PATH` binary, names the binary and its origin in the verdict header, and discloses a binary resolved from outside the repository as a parity risk rather than silently accepting it; **given** a repository with no commitlint configuration at all, **when** the gate runs, **then** it reports an explicit skip with the reason and exits success — in no case is a silent pass produced. | F-3, DM-1, DM-1.d, DM-1.g, NFR-1, NFR-2, DEC-1, DEC-6 |
| AC-F3-4 | **Given** any invocation, **when** the gate runs, **then** it performs no network access and leaves the working tree, index, refs, and stash unchanged, and every outcome maps to exactly one of the three documented exit codes. | F-3, NFR-4, NFR-5, NFR-7, DEC-7 |
| AC-F3-5 | **Given** a repository that configures commitlint but whose commitlint invocation cannot render a verdict (invalid configuration or an execution failure), **when** the gate runs, **then** it reports the `ERROR` outcome with exit `2`, names the cause, and prints a remediation hint — it neither reports `FAIL` with violation diagnostics nor reports `PASS`. | F-3, DM-1.h, NFR-2 |
| AC-F3-6 | **Given** an unknown argument or an invalid base syntax, **when** the gate is invoked, **then** it exits `2` with usage output naming the accepted invocation and the offending argument, and performs no range check. | F-3, DM-1.i, NFR-7 |
| AC-F4-1 | **Given** the committer and PM instructions, **when** they are read, **then** they state that the subject is a conventional header carrying the work item reference, that body and footer lines stay within 100 characters, that a sync must not leave a plain merge subject behind, and that failures are remediated by surgical reword (one or two offenders) or condense-to-one (many) — with ownership assigned explicitly: the committer owns the message it produces and never rewrites history, the PM owns the range verdict and selects the mode, the acting agent performs the history action outside the gate, and the gate only reports — all stated as constraints with no raw git write recipe. | F-4, F-6, G-4, NFR-9 |
| AC-F5-1 | **Given** the autonomous delivery prompt's resume-sync section, **when** it is generated and its suite runs, **then** the emitted instruction produces a sync merge with a conventional subject referencing the work item rather than a plain merge subject, the assertion test matches the new instruction, and no other prompt section changes meaning. | F-5, G-5, DEC-5 |
| AC-F6-1 | **Given** the PM `quality_gates` phase, **when** it is executed, **then** the range lint is a required step; a violation is remediated in the named mode and the gate re-run; an unresolved "unable to verify" outcome is never recorded as a pass and blocks phase completion; and the verdict is recorded as gate evidence in the change's PM notes. | F-6, G-1, NFR-2, DEC-8 |
| AC-F6-2 | **Given** `AGENTS.md` and the `/check` resolution contract, **when** the edited `AGENTS.md` is read, **then** the gate is stated as a supplementary lifecycle pre-PR gate, no new "run all quality gates" instruction is introduced, and `/check` and `/check-fix` behaviour is unchanged. | F-6, F-8, NFR-8, DEC-8 |
| AC-F7-1 | **Given** an adopting project installed from this repository, **when** the delivery scripts are installed and removed, **then** the gate is present and executable after install, removed on uninstall, and the installer/uninstaller suites pass with the gate registered. | F-7, DEC-6 |
| AC-F8-1 | **Given** the delivered change, **when** the touched docs and prompts are inspected and the aggregate local gate runs, **then** the quality-gates/PR feature page, the autonomous-delivery feature page, the change-lifecycle `quality_gates` phase, and `AGENTS.md` describe the gate, the contract, and the prompt instruction as delivered; touched docs keep their distribution markers; and no new conformance violation appears. | F-8, NFR-9 |
| AC-NFR4-1 | **Given** a reference run over a 20-commit range and a 100-commit range on a developer machine, **when** the gate completes, **then** the ≤20-commit run finishes within 10 seconds and the ≤100-commit run within 60 seconds, and the run performs zero network calls; the suite asserts both budgets. | NFR-4, F-1, F-3 |
| AC-NFR6-1 | **Given** a range whose offending commits break many rules and carry over-long lines, **when** diagnostics are produced, **then** no commit's block exceeds 20 rule lines, every excerpt is at most 160 characters, the total diagnostic output is at most 200 lines, and the summary still reports the offending-commit count and the distinct rules hit. | NFR-6, F-2, DM-2 |
| AC-NFR8-1 | **Given** the full change diff and a green aggregate gate, **when** the change is reviewed, **then** it contains no CI workflow change, no hook enforcement, no history-rewrite or auto-fix automation, no change to `pnpm check`/`/check`/`/check-fix` semantics, no CLI or MCP surface change, and no change to the commitlint configuration or its rules. | NFR-8, NG-1, NG-2, NG-3, NG-4, NG-5, NG-6 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Delivered through the standard lifecycle on the prepared `chore/GH-268/commitlint-pre-pr-gate` branch targeting the delivery branch; a single, self-contained change, reversible by one revert.
- The change self-applies: the gate's first real run is on this change's own branch range during its `quality_gates` phase, which is also the dogfood evidence that the wiring works — and the change's own commits must satisfy the configuration before the phase can complete.
- No feature flags, no migration window, and no staged rollout: the gate is additive, the hook is untouched, and CI is untouched.
- Communication is in-repo: the stated contract in the committer/PM prompts and the lifecycle guide are the announcement; the audience is internal and no published package surface changes.
- At system-spec update, the doc-syncer reconciles the registered points in Appendix C, including the two feature pages and the scaffold toolchain page's "authority" sentence, which stays true but gains the mirror clarification.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A — no persisted data, schema, or seed data is involved. The gate reads history and configuration and writes nothing; existing branch histories are never retrofitted.

## 20. PRIVACY / COMPLIANCE REVIEW

- No personal data, no data egress, and no new external destination. The gate reads local repository history and local configuration only, and performs no network access.
- Commit-message excerpts are reported in bounded form (line number plus a truncated line) rather than full message bodies, which limits incidental exposure of anything a message author typed. The gate performs no secret scanning — secret detection remains the commit primitive's obligation — so it neither adds nor weakens that control.
- No tracking, no telemetry, and no audit-ledger writes.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Read-only by construction:** the gate changes no refs, no index, and no working tree, so a quality gate cannot become a history-mutation vector; history changes remain explicit agent actions.
- **Untrusted input treated as data:** commit messages are echoed as bounded diagnostics only — never interpreted, executed, or used to construct a command, which keeps message content out of any execution path.
- **No network:** base resolution and linting are local; a gate that cannot reach the network cannot exfiltrate or fail on egress policy.
- **Fail-closed without false alarms:** "unable to verify" is distinct from "violation", so the security-relevant property (never a silent pass) holds without teaching operators to ignore gate errors.
- **Parity guard:** because the gate mirrors the single pinned configuration, a drifted or duplicated rule source is still caught by the existing single-authority invariant.
- **Scope confinement as a security property:** CI, hooks, and the commit primitive are untouched, so no existing control is weakened or bypassed by this change (AC-NFR8-1).
- **Residual:** plain merge subjects are not rejected by the gate (DEC-4); this is a history-hygiene rule, not a security control, and is recorded here so it is not mistaken for enforcement.

## 22. MAINTENANCE & OPERATIONS IMPACT

- The gate is coupled to the commitlint configuration and CLI version: a rule change (line length, type allowlist, default ignores) changes the gate's verdict automatically, by design. The gate's suite must be revisited only if the configuration's identity source changes.
- The installer's delivery-script set and the resume-sync prompt instruction are coupled to their suites; changing either without its assertions is a review-blocking gap.
- New standing obligation for lanes: `quality_gates` now includes a history check, so a lane must have the delivery base branch available locally at gate time. The error hint and the never-waive rule make the remedy explicit.
- The remediation modes are advisory text, not code; if the ticket's 1–2 / ≥3 distinction ever changes, only the threshold constant and the mode wording move, and the suite pins them.
- The gate adds no scheduled job, no daemon, and no state: operational surface is one script invocation per change.
- Future work registered, not owed here: the JSON output, CI/local shared implementation, blocking hook, and plain-merge rejection (7.3, OQ-1).

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Conventional Commit | A commit message whose header is `<type>(<optional scope>): <summary>`; the repository's accepted types come from the shared conventional configuration. |
| commitlint | The commit-message linter configured at the repository root; its verdict is the rule truth for both CI and the local gate. |
| Authority (CI commitlint) | The CI job whose failure blocks merge; unchanged by this change and the reference the local gate mirrors. |
| Branch range | The commits reachable from `HEAD` but not from the merge-base with the delivery base branch — the change's own commits. |
| Merge-base range | The range start computed as the common ancestor of the base commit and `HEAD`; prevents judging merged-upstream history. |
| Delivery base branch | The branch a change is delivered against (configured per project, overridable for one invocation). |
| Offending commit | A commit whose message violates at least one configured rule; counted once regardless of how many rules it breaks. |
| Surgical reword | Remediation for one or two offending commits: rewrite only the named commit messages and leave the rest of the history intact. |
| Condense-to-one | Remediation for many offending commits: collapse the branch range into a single conventional commit. |
| Silent pass | A success outcome produced without a real verdict — the failure mode this gate must never exhibit. |
| Warn-only hook | A commit-time convenience that reports a problem but always succeeds; the repository's `commit-msg` hook keeps this posture. |
| Parity | The property that the local gate and the CI authority reach the same verdict for the same range and configuration. |
| Delivery-script set | The repository-owned scripts installed into adopting projects, as declared by the installer's `ADOS_DELIVERY_SCRIPTS` array — the authoritative list any documentation enumeration is reconciled against. |

## 24. APPENDICES

### Appendix A — Ticket acceptance traceability

| Ticket acceptance (verbatim intent) | Spec coverage |
|---|---|
| A deliberately malformed commit in a test branch is rejected by the local gate before PR creation, with the offending SHA and rule in the output | AC-F1-1, AC-F2-1, F-1/F-2 |
| Valid conventional commits (including conventional-subject merge commits) pass with no false positives | AC-F1-2, NFR-3, DEC-1 |
| Instructions for the committer/PM describe the rule and the two remediation modes | AC-F4-1, AC-F2-2, F-4 |
| Docs-only + script/prompt change; no behavioural change to delivery semantics | AC-NFR8-1, AC-F6-2, AC-F8-1, NFR-8 |
| Diagnostics name the offending SHA(s) and violated rule(s) so remediation is surgical or explicitly condensed | AC-F2-1, AC-F2-2, DM-2, DM-3 |
| Gate fails loudly when it cannot verify (base, tool) | AC-F3-2, AC-F3-3, AC-F3-5, AC-F3-6, DM-1.e–i |

### Appendix B — Current-state evidence inventory

| Surface | Current behaviour | Consequence |
|---|---|---|
| Root commitlint config (single, invariant-pinned) | conventional rules; body/footer 100-character limits | Rule truth the gate mirrors |
| CI `ts-commitlint` | three ranges: PR base SHA, `origin/main-tools`, merge-base on push | The only enforcement today |
| `.husky/commit-msg` | warn-only, always exits 0 | No commit-time protection |
| `pnpm check` | working-tree gates only | Green battery says nothing about history |
| `/check` | resolves from `AGENTS.md`, defaults to a script this repository does not have | No repository-specific gate path today |
| Commit primitive | commitlint probe over the message it generates, one retry, deterministic template | Message-scoped only; no range coverage |
| Resume-sync prompt instruction | bare merge → plain merge subject | Manufactures the forbidden subject |
| Observed incidents | GH-230 / PR #264 (1 commit), GH-237 / PR #265 (2 commits), GH-240 / PR #267 (14 commits) | Three avoidable round-trips plus force-pushes |

### Appendix C — Documentation impact register (phase-7 reconciliation points)

| # | Document / location | Impact | Owner phase |
|---|---|---|---|
| 1 | Quality-gates/PR feature page | Add the range-lint capability and the stated committer contract (conventional subject, body/footer ≤100, no plain merge subject, both remediation modes) | system-spec update |
| 2 | Autonomous-delivery feature page | Reflect the resume-sync instruction shape and its assertion | system-spec update |
| 3 | Monorepo scaffold toolchain page — "CI commitlint is the authority" | Stays true; clarify that the local pre-PR gate is a mirror, not a replacement | system-spec update |
| 4 | Change-lifecycle guide — `quality_gates` phase | Name the range lint in actions and exit criteria | delivery (F-8) |
| 5 | `AGENTS.md` — delivery process and delivery-infrastructure notes | State the gate as a supplementary pre-PR gate; the gate joins the distributed script set | delivery (F-6, F-7) |
| 6 | Committer and PM prompts | Contract statement and phase wiring | delivery (F-4, F-6) |
| 7 | Installer delivery-script registry | Gate registered for distribution | delivery (F-7) |
| 8 | Distribution markers / doc-distribution guard | No new distributable doc area; touched docs keep their markers; guard stays green | delivery + system-spec update |
| 9 | Autonomous-delivery feature page — (a) overview sentence that lists the delivered scripts, (b) delivered-file ("Core Components") table, (c) **Install inventory** blockquote that registers delivery scripts in `ADOS_DELIVERY_SCRIPTS` (it names five today, while the array declares six — `scripts/lib/dispatch-authority.sh` is omitted) | All three become incomplete when the gate joins the delivery-script set, and (c) is already under-inclusive. Reconciliation must make each enumeration agree with the array: either complete it to every `ADOS_DELIVERY_SCRIPTS` entry (adding the gate and closing the pre-existing `scripts/lib/dispatch-authority.sh` omission), **or** mark it illustrative and name `scripts/install.sh` as the authoritative set; the route taken is recorded in the page | system-spec update |
| 10 | Autonomous batch delivery guide — installation section comment block listing the delivery scripts copied into `./scripts/` | The list is illustrative and already non-exhaustive; reconcile it with the installer set so the new gate is covered by the same install narrative | system-spec update |

### Appendix D — Normative anchors honored

| Anchor | How this change honors it |
|---|---|
| Single commitlint configuration authority (pinned by a repository invariant) | The gate consumes that configuration unchanged; it introduces no second rule source. |
| CI remains the authority (the hook's own recorded non-blocking posture) | No CI change; the gate mirrors the authority and never replaces it. |
| Fail-closed repository culture | "Unable to verify" is a distinct, loud outcome; a gate that cannot verify never passes. |
| Lifecycle phase ownership (PM owns `quality_gates`) | The gate is wired as a phase step with recorded evidence, not as a hidden pre-commit side effect. |
| Prompt conformance (no raw git writes taught in lifecycle prompts) | The contract states constraints, not command recipes; the conformance scan stays green. |
| Documentation truth | Current-truth docs are updated where the contract and wiring live; the rest is registered for the system-spec phase. |

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-11 | @spec-writer | Initial specification derived from GitHub issue #268 and the phase-1 clarify-scope findings, honouring the three recorded PM decisions. |
| 1.1 | 2026-11-11 | @spec-writer | Additive correction after the specification phase reopened for a test-plan traceability gap: appended `AC-F3-5`, `AC-F3-6`, `AC-NFR4-1`, and `AC-NFR6-1` covering DM-1.h, DM-1.i, NFR-4, and NFR-6; updated the Appendix A traceability row's DM range. No existing criterion renumbered. |
| 1.2 | 2026-11-11 | @spec-writer | DoR iter-1 correction (findings 3 and 4): pinned the lint-binary resolution precedence (repository-local `node_modules/.bin/commitlint`, then `PATH`) with verdict-header disclosure of the resolved binary and its origin as a parity risk (F-1, F-3, DM-1, §10, §12, RSK-1, DEC-10; `AC-F3-3` amended, no criterion added or renumbered); registered the autonomous-delivery page's three delivered-script enumerations and the batch-delivery guide's installation list (F-8, §7.1, §16, Appendix C rows 9–10). |
| 1.3 | 2026-11-11 | @spec-writer | DoR iter-1 correction (findings 9 and 10, non-blocking): stated the remediation-ownership split in F-4 and crossing in F-6 (committer owns the message, PM owns the verdict and mode selection, acting agent performs the history action, the gate only reports) and mirrored it in `AC-F4-1`; appended `OQ-2` recording the deferred routing of the parity principle (DEC-1/DEC-4) to `@decision-advisor` at PR review, with DEC-1 cross-referencing it. No criterion added or renumbered. |
| 1.4 | 2026-11-11 | @spec-writer | DoR iter-2 correction (findings 2 and 3): pinned the DM-1 evaluation order (usage → configuration `SKIP` → base → merge-base → binary → lint) immediately after the terminal-condition table, with the skip-wins-over-base/binary consequence and the e-before-g and e-before-h answers stated; qualified `AC-F3-2` accordingly (no renumbering) and pointed DM-1 at the order. Rewrote Appendix C row 9(c), F-8, and the §16 row so the delivered-set enumeration is reconciled against the installer array (all six entries, closing the pre-existing `scripts/lib/dispatch-authority.sh` omission, or explicitly illustrative with `scripts/install.sh` authoritative; route recorded), and defined the authoritative set in the glossary. No criterion added or renumbered. |

---

## AUTHORING GUIDELINES

- **Sources used:** GitHub issue #268 (problem, goal, proposed implementation, acceptance, notes); the planning session's clarify-scope findings (configuration authority, CI ranges, warn-only hook, `pnpm check` scope, missing repository quality-gates script, resume-sync prompt instruction and its assertion, bare lifecycle command invocation form); the recorded PM decisions in the change's PM notes; and repo inspection of the prompt tree, the installer registry, and the lifecycle guide.
- **Verified at specification time:** the conventional configuration rejects a 100+-character body line (`body-max-line-length`) and accepts a plain `Merge remote-tracking branch ...` subject; a conventional-subject merge message lints clean. That measurement is why DEC-4 treats the merge rule as instruction-level and why OQ-1 exists.
- **Approach:** pin contracts (identity, precedence, terminal conditions, exit codes, diagnostics, aggregation) and leave mechanics to delivery planning. Prompts are treated as product: the contract is written as constraints, and conformance consequences are stated rather than assumed.
- **Deliberate omissions:** no literal message formatting beyond what remediation requires, no implementation recipes, and no CI or hook changes — they are out of the ticket's stated boundary.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-268)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no code-level tasks, no step-by-step delivery instructions)
- [x] No content duplicated from linked docs
- [x] Front matter validates per front_matter_rules
