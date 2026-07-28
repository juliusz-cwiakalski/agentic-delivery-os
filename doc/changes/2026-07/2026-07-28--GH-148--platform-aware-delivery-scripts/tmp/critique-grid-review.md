---
id: CRITIQUE-GRID-GH-148
title: "CritiqueGrid Collective Assessment — GH-148 platform-aware delivery scripts (pre-PR)"
status: Final
created: 2026-07-28
reviewer: critique-grid-coordinator
work_item_ref: GH-148
branch: feat/GH-148/platform-aware-delivery-scripts
base: main
head_sha: 2a6bee9
---

# CritiqueGrid Collective Assessment — GH-148 (pre-PR)

> **Make delivery scripts platform-aware (GitHub + GitLab) and harden GH-146 hook
> infrastructure** — `scripts/deliver-ticket.sh` + `scripts/batch-deliver.sh`
> platform detection, tracker/MR dispatch seam, JSON normalization, GitLab Mode B
> merge, configurable knobs, and three GH-146 hardening follow-ups.

## Coordinator execution note (read first)

CritiqueGrid's process delegates **blind independent reviews** to specialist
sub-agents. **The runtime used for this assessment did not expose a Task/sub-agent
delegation capability**, so a freshly-spawned blind panel could not be executed.
To preserve integrity, this assessment does **not** fabricate phantom reviewers or
invent consensus. Instead it:

1. Selects the orthogonal reviewer panel this material requires (§1).
2. Adjudicates the **captured independent ADOS reviews already in the repo**
   (`readiness-review/readiness-iter-1.md`, `readiness-iter-2.md`) plus the
   recorded `@fixer` bug-fix history as the independent-review corroboration pool.
3. Performs **coordinator-side static verification** of every material claim
   against the current source at HEAD `2a6bee9` (Read/Grep + a static
   `shellcheck` lint — no test execution, no network, per CritiqueGrid
   constraints). Each finding cites a precise locator and an evidence label.
4. Surfaces residual risk and coverage gaps honestly.

Confidence is therefore capped at **MEDIUM** for the *negative* findings (the bugs
are verified statically against source and are high-confidence) and **LOW–MEDIUM**
for any *positive* "the GitLab path works" claim (no blind panel, no execution).
Per the no-confidence-inflation rule, the captured DoR track and `@fixer` history
are treated as **corroboration, not independent validation**.

---

## 1. Review Plan

**Material:** GH-148 — a platform-awareness layer over the two autonomous-delivery
bash scripts (`deliver-ticket.sh`, `batch-deliver.sh`): `detect_platform()`,
`_tracker`/`_mr` dispatch, a JSON normalization shim (`tracker_issue_view`,
`mr_list_for_branch`, `mr_list_closed_merged`, `mr_list_search`), platform-aware
`classify_result`/`pr_url_for`, a platform-neutral PM prompt, full GitLab Mode B
(list/CI-gate/merge), configurable `ADOS_BLOCKED_LABEL`/`ADOS_MERGE_STRATEGY`,
GitLab `detailed_merge_status` polling, a `find || true` liveness fix, and three
GH-146 hardening follow-ups. 15 files, +2993/−167.

**Type:** `code` (bash PR) + `docs` + a durable integration/dispatch contract.

**Stakes:** **HIGH** — touches two **unattended/autonomous production scripts that
are themselves the shipped product**; introduces a new merge-behavior surface
(configurable strategy) and a new CLI dispatch + GitLab merge-status integration;
the dispatch/normalization seam and the new env vars become a durable contract.
Mitigated by: defaults preserve GitHub for the detection/classify/prompt paths,
the change is reversible, and no new persistent state or result-domain values are
introduced.

**Reversibility:** **EASY** at the feature level (revert the commits); **COSTLY**
at the contract level once adopters pin `ADOS_MERGE_STRATEGY`/`ADOS_BLOCKED_LABEL`
and rely on GitLab Mode B.

### Selected Reviewers

| Reviewer | Risk Dimension | Focus Scope |
|---|---|---|
| critique-grid-bash-dev | Bash correctness & shell safety | quoting/word-splitting under `IFS=$'\n\t'`; `set -euo pipefail`/`inherit_errexit` safety; trap behavior; the merge-flag construction; arg-passing to branch-scoped fns |
| critique-grid-security-officer | Subprocess/injection & parser integrity | the `_tracker`/`_mr` dispatch (new subprocess surface); the security-critical `ADOS_HOOK_ENV_V1` parser hardening (F-12/CG-SEC-003); credential/log leakage |
| critique-grid-qa-engineer | Test coverage adequacy & regression | TC-PLAT traceability vs implemented tests; mock-blindness; NFR-1 GitHub-regression evidence; whether mocks actually exercise the new code paths |
| critique-grid-sre | Reliability, failure modes, the autonomous loop | merge-status polling bounds/timeouts; green-gate failure semantics (park-not-merge); no-op-push side effects; degradation on CLI errors |
| critique-grid-api-integration-engineer | CLI/REST contract fidelity | `gh` vs `glab` flag & JSON-field divergence; `detailed_merge_status`/`merge_status` field names; pipeline-API endpoints; merge-command flag mapping |
| critique-grid-decision-critic | Decision & completion-claim integrity | spec↔plan↔code↔test truthfulness; checkbox vs reality; whether the "GH-146 follow-ups closed" claim holds; reversibility/rollback assumptions |

### Not Selected (with rationale)

| Reviewer | Why Not |
|---|---|
| critique-grid-devops-engineer | CI/CD pipeline/environment concerns overlap with SRE; no CI config or IaC is touched. The only CI-adjacent claim (test suite green) is covered under QA/SRE. |
| critique-grid-technical-writer | The doc changes (`delivery-modes.md`, `autonomous-batch-delivery.md`, feature-spec) are accurate and well-structured at the conceptual level; spot-checked, no material inaccuracies beyond what code-correctness findings imply. |
| critique-grid-legal-counsel / privacy-engineer | No new data, credentials, telemetry, or third-party licensing introduced (spec §20/§21). Tracker queries read metadata already accessible to the operator CLI. |
| critique-grid-product-manager / ceo / cfo | Not a product/strategy/financial decision; scope is an internal engineering hardening + platform port. |

### Coverage Gaps

- **No executed test run.** The plan (Phase 8.1/8.2) explicitly records that the
  suite was **skipped** due to hanging and that verification fell back to
  "ShellCheck + code review." `shellcheck` passes clean (verified, exit 0), but
  ShellCheck is a **static linter** — it cannot detect the logic/contract bugs
  below. `shfmt` is **not installed** in this environment, so the "shfmt clean"
  claim (task 8.5) is **UNVERIFIED**; the GitLab branch of `wait_for_pr_green`
  has visibly inconsistent indentation that shfmt would reformat (see CG-SRE-002).
- **No live GitLab execution.** glab flag/field behavior (e.g. whether `glab mr
  view` accepts `--json`, whether `glab api /projects/:id/...` auto-resolves
  `:id`) is reasoned from known API shapes, not executed — flagged UNVERIFIED
  where it affects a finding.
- **No blind second panel.** See coordinator note; confidence capped accordingly.

---

## 2. Collective Assessment

### Review Manifest
- **Artifact:** GH-148 platform-aware delivery scripts (pre-PR).
- **Objective:** Full CritiqueGrid assessment before PR creation.
- **Stakes:** HIGH · **Reversibility:** EASY (feature) / COSTLY (contract).
- **Evidence supplied:** spec, test-plan (51 TCs), plan (8 phases), 2 DoR iters,
  `@fixer` 6-bug history, GH-146 CritiqueGrid review, CEO retrospective,
  feature-spec, two guides, full diffs at HEAD `2a6bee9`.
- **Critical missing context:** an executed green test suite; any real `glab`
  smoke test; `shfmt` confirmation.

### Panel and Coverage
| Risk Dimension | Reviewer | Independent Question | Status |
|---|---|---|---|
| Bash correctness | critique-grid-bash-dev | Are quoting/word-splitting/`set -u`/traps safe, esp. around the merge-flag construction? | completed (static) |
| Security/parser | critique-grid-security-officer | Is the new dispatch surface safe, and is the F-12 parser hardening actually delivered? | completed (static) |
| QA/regression | critique-grid-qa-engineer | Do the implemented tests cover the new behavior and prove NFR-1? | completed (static) |
| SRE/reliability | critique-grid-sre | Are the poll bounds, green-gate, and no-op-push failure modes sound? | completed (static) |
| API/CLI contract | critique-grid-api-integration-engineer | Are the `gh`/`glab` flag + JSON-field mappings correct? | completed (static) |
| Decision/claims | critique-grid-decision-critic | Do completion checkboxes and "follow-ups closed" claims match reality? | completed (static) |

### Overall Verdict: BLOCK
**Confidence:** **MEDIUM** (negative findings are high-confidence static verifications;
positives about GitLab execution remain LOW).

**Basis:** The change ships **two confirmed CRITICAL defects in code paths the
change itself is supposed to deliver**, plus multiple HIGH defects that make the
core GitLab feature non-functional and **violate NFR-1 (zero GitHub regression)**
on the Mode B merge path. Two of the three advertised GH-146 hardening follow-ups
are not actually delivered (F-12 is missing entirely). The regression gate was
**never executed** (Phase 8.1/8.2 self-record the skip). Approving pre-PR would
ship a Mode B merge that fails on GitHub and a GitLab Mode B that cannot merge.

---

### Adjudicated Findings

#### **CRITICAL CG-BASH-001 — Mode B merge flags passed as a single argument (merge always fails)**
- **Disposition:** CONFIRMED
- **Claim:** In `approved_pr_flow`, the merge-strategy flags produced by
  `merge_flags_for()` (e.g. `"--squash --delete-branch"`) are forwarded to the
  merge command as one double-quoted expansion, so the forge CLI receives a
  single malformed argument and the merge fails (parks) on **both** platforms.
- **Evidence:** OBSERVED `scripts/batch-deliver.sh:708-720` —
  `merge_flags="$(merge_flags_for "${merge_strategy}")"` then
  `_mr pr merge "${pr_number}" "${merge_flags}" --subject "${title}" --body "${body}"`
  (line 720) and the GitLab twin at line 714. The script's top-level
  `IFS=$'\n\t'` (OBSERVED `scripts/batch-deliver.sh:23`) means even an *unquoted*
  `${merge_flags}` would not split on the space, so quoting is not the only defect
  — the construction cannot produce two args under this `IFS`. `merge_flags_for`
  emits a single space-joined string (OBSERVED `:494-513`). DERIVED: argv to
  `_gh` includes the literal token `--squash --delete-branch` (one arg), which is
  not a valid `gh`/`glab` flag.
- **Consequence:** Every Mode B approved-PR merge **fails silently** — the
  `2>/dev/null` swallows the CLI error and `|| { log_warn "Merge failed"; return
  1; }` parks the PR. This is a **GitHub regression introduced by F-9 itself**
  (pre-change the flags were separate literals: `_gh pr merge N --squash --subject
  … --body … --delete-branch`), directly violating **NFR-1 / AC-F3-1** and
  breaking the headline Mode B capability on GitLab (AC-F7-1). The merged
  commit `log_info "Merged PR #…"` at `:726` is unreachable in practice.
- **Confidence:** HIGH
- **Reviewers:** critique-grid-bash-dev, critique-grid-api-integration-engineer, critique-grid-sre
- **Challenge result:** UPHELD (static derivation from `IFS` + quoting rules is
  deterministic; the only escape would be if `merge_flags_for` returned an array,
  which it does not — it `printf`s a string).
- **Verification status:** VERIFIED — coordinator; ShellCheck exit 0 (it does not
  flag intentionally-quoted multi-word strings, so the lint cannot catch this).
- **Why tests miss it:** the existing `_gh` mocks match on `$1 $2` = `"pr merge"`
  and return `merged` regardless of subsequent args (OBSERVED `test-batch-deliver.sh`
  `test_approved_green_squash_merge` et al.), so the suite reports green while the
  real CLI would reject the flag. Classic mock-blindness.
- **Action:** Return merge flags as a **bash array** (e.g. `local -a flags; …;
  _mr pr merge "${pr_number}" "${flags[@]}" …`) or emit per-flag vars; add a test
  that asserts the recorder observes `--squash` and `--delete-branch` as
  **distinct argv elements** (not a substring of one).
- **Residual uncertainty:** none material — the failure is deterministic under
  the documented `IFS`.

#### **CRITICAL CG-QA-001 — F-12 V1 parser property/fuzz test was never implemented (CG-SEC-003 not closed)**
- **Disposition:** CONFIRMED
- **Claim:** The deterministic V1-parser property/fuzz test (F-12 / CG-SEC-003,
  TC-PLAT-046..049) — one of the three explicit GH-146 hardening deliverables —
  does not exist in the codebase, although plan task 7.1 and the DoR/exec log
  mark it complete.
- **Evidence:** OBSERVED `scripts/.tests/test-hook-regression.sh` — a repo-wide
  search for the property-test surface (`property|fuzz|SRANDOM|0x0D|0x00|NUL|dd
  if`) finds only a pre-existing `write_bytes` helper (line 19); **no** test
  generates randomized valid/invalid byte sequences and feeds them to
  `_hook_validate_and_apply`. OBSERVED `chg-GH-148-plan.md:411` marks task 7.1
  `[x]` and `:586-593` log Phase 7 COMPLETED. The only GH-146 hardening actually
  delivered is the `is_gone_or_zombie` macOS `kill -0` fallback (F-13) and the
  F-14 tuning doc text — both real.
- **Consequence:** CG-SEC-003 — the residual risk that the single-track review
  of the security-critical `ADOS_HOOK_ENV_V1` parser could miss another
  UTF-8/false-match class defect (the original CG-SEC-001 survived 6 review
  iterations) — is **still open**. The change claims to close 3/3 follow-ups
  (spec §4.1, plan success metrics) but closes at most 2/3.
- **Confidence:** HIGH
- **Reviewers:** critique-grid-qa-engineer, critique-grid-security-officer, critique-grid-decision-critic
- **Challenge result:** UPHELD.
- **Verification status:** VERIFIED — coordinator (exhaustive grep of the target
  test file + diff-vs-main).
- **Action:** Implement TC-PLAT-046..049 (seeded `SRANDOM`, bounded iterations,
  `LC_ALL=C`, `dd`/`od` byte generators) before merge, OR formally de-scope F-12
  and correct every "3/3 closed" claim + the task 7.1 checkbox + the Phase-7
  execution log.
- **Residual uncertainty:** none (presence/absence is binary).

#### **HIGH CG-API-001 — `mr_list_closed_merged` omits the state filter; merged-PR detection is dead on both platforms**
- **Disposition:** CONFIRMED
- **Claim:** `mr_list_closed_merged()` queries the default-state (open) list and
  then selects `.merged_at != null`; since open PRs/MRs have null `merged_at`, it
  always returns `[]`, so the branch-scoped merged-PR check never fires.
- **Evidence:** OBSERVED `scripts/deliver-ticket.sh:344-370` (and the duplicated
  copy in `scripts/batch-deliver.sh:220`) — neither the GitLab branch
  (`_mr mr list --source-branch … --output json`) nor the GitHub branch
  (`_mr pr list --head … --json …`) passes `--state`. `gh pr list` defaults to
  `open`; `glab mr list` defaults to `opened`. DERIVED → `select(.merged_at !=
  null)` over an open-only set ⇒ `[]`. The pre-change code passed `--state closed`
  explicitly (`classify_result` old line, visible in the diff; `should_skip_ticket`
  old `_gh pr list --search … --state closed`), so this is a **regression**.
- **Consequence:** In `classify_result` (`deliver-ticket.sh:1181`) the
  merged-but-open-issue fallback no longer detects merges (only the upstream
  `issue_state == "closed"` branch catches the canonical case); in
  `should_skip_ticket` (`batch-deliver.sh:358`) merged tickets are no longer
  skipped. A merged PR whose issue wasn't auto-closed will now be misclassified
  (`failed`) / re-attempted.
- **Confidence:** HIGH (GitHub path is certain given `gh pr list` default;
  GitLab path is near-certain given `glab mr list` default).
- **Reviewers:** critique-grid-api-integration-engineer, critique-grid-bash-dev
- **Challenge result:** UPHELD.
- **Verification status:** VERIFIED — coordinator (source + known CLI defaults;
  no existing test exercises this path, which is why it survived).
- **Action:** Pass the platform-correct closed/merged state
  (`gh … --state closed`; `glab mr list --state merged`) inside
  `mr_list_closed_merged`; add a regression test (the mocked fixture must return a
  merged PR only when the state flag is present).
- **Residual uncertainty:** exact `glab` default-state behavior (high confidence
  it is `opened`).

#### **HIGH CG-BASH-002 — `should_skip_ticket` passes the issue number to a branch-scoped function**
- **Disposition:** CONFIRMED
- **Claim:** `should_skip_ticket` calls `mr_list_closed_merged` with
  `to_issue_number "${ticket_ref}"` (e.g. `148`), but that function's sole
  parameter is a **head branch** name (`local -r head_branch="$1"`), so the lookup
  searches for a branch literally named `148`.
- **Evidence:** OBSERVED `scripts/batch-deliver.sh:358` —
  `merged_json="$(mr_list_closed_merged "$(to_issue_number "${ticket_ref}")" …)"`;
  OBSERVED `:220`/`deliver-ticket.sh:344` signature is `(head_branch)`. The
  pre-change path used `--search "${ticket_ref}"` (title search), not a branch
  filter. Compounds CG-API-001.
- **Consequence:** The `merged` skip path in Mode B pre-flight is doubly
  unreachable (wrong arg + missing state filter).
- **Confidence:** HIGH
- **Reviewers:** critique-grid-bash-dev, critique-grid-api-integration-engineer
- **Challenge result:** UPHELD.
- **Verification status:** VERIFIED — coordinator.
- **Action:** Either pass the resolved branch (the caller has none today — Mode B
  resolves the branch later in `run_batch`) or restore a title-search merged
  detector that takes the ticket ref. Reconcile with the spec's intent
  (branch-scoped is the *deliver-ticket* policy; Mode B's pre-flight may need a
  ref-scoped helper).
- **Residual uncertainty:** none on the defect; design choice for the fix.

#### **HIGH CG-API-002 — `gitlab_await_mergeable` uses wrong glab flags and wrong JSON field names (F-10 non-functional)**
- **Disposition:** CONFIRMED (field-name errors); PARTIALLY_CONFIRMED on the
  `--json` flag (flag behavior UNVERIFIED at runtime).
- **Claim:** The GitLab merge-status poller reads `.mergeStatus` (camelCase,
  non-existent in the GitLab API) via a `--json mergeStatus` flag that `glab` does
  not support the way `gh` does, and compares `merge_status` against the literal
  `"has_conflicts"` (a boolean *field*, not a `merge_status` *value*). The
  stale-conflict recovery branch is therefore dead code, and the poll likely never
  observes `mergeable`.
- **Evidence:** OBSERVED `scripts/batch-deliver.sh:525-526` —
  `merge_status="$(_mr mr view "${pr_number}" --json mergeStatus --output json … | _jq -r '.mergeStatus // empty' …)"`;
  GitLab's API field is `merge_status` (snake_case); values are
  `can_be_merged`/`cannot_be_merged_to_fork`/`unchecked`, **not** `has_conflicts`
  (OBSERVED `:534` condition `"${merge_status}" == "has_conflicts"`). DERIVED:
  `.mergeStatus` extraction yields empty ⇒ the stale-conflict `&&` at `:534` is
  always false. The `--json <field>` form is a `gh`-ism; glab uses `--output json`
  for full output.
- **Consequence:** F-10 (the GitLab `detailed_merge_status` polling +
  stale-conflict no-op-push recovery, the mitigation for observed 405s on MR !97)
  **does not work**: the mergeable-immediate path may still work *if* glab
  tolerates the bogus `--json` and returns `detailed_merge_status` (the
  `.detailed_merge_status` field name there is correct), but the stale-conflict
  recovery that the whole feature exists to provide is unreachable.
- **Confidence:** HIGH (field-name mismatch + value mismatch are certain from API
  shape); the `--json` flag's effect on glab is UNVERIFIED.
- **Reviewers:** critique-grid-api-integration-engineer, critique-grid-sre
- **Challenge result:** UPHELD on field/value errors; UNRESOLVED on `--json`
  (runtime-dependent).
- **Verification status:** PARTIALLY VERIFIED — coordinator (static field-shape
  reasoning); full verification requires a `glab` smoke test (not performed).
- **Action:** Drop `--json <field>`; use `_mr mr view … --output json` once and
  extract both `.merge_status` and `.detailed_merge_status` from the full object;
  fix the stale-conflict predicate to
  `detailed_status == conflict && merge_status == "can_be_merged" && (has_conflicts // false) == false`.
  Add TC-PLAT-039/040/041 (currently **not implemented**).
- **Residual uncertainty:** exact glab flag acceptance; whether the no-op push
  targets the MR's source branch (see CG-SRE-003).

#### **HIGH CG-QA-002 — Test coverage is ~16/51 of the planned cases; GitLab Mode B and the headline F-5 paths are untested**
- **Disposition:** CONFIRMED
- **Claim:** Of the 51 TC-PLAT cases the test plan commits to, only ~12 are
  implemented in `test-deliver-ticket.sh` and **zero** GitLab-specific cases exist
  in `test-batch-deliver.sh`; the F-5 (GitLab classify/URL), F-7/F-9/F-10 (GitLab
  Mode B), F-6 (prompt neutrality), F-8 (blocked label), F-11 (find), F-12
  (parser), and the NFR-1 regression-parameterization cases are absent.
- **Evidence:** OBSERVED `test-deliver-ticket.sh:1991-2005` registers TC-PLAT-001,
  002, 003, 004, 009, 010, 011, 012, 013, 014, 015, 016 only; line 1995
  explicitly defers "TC-PLAT-005/006 … (complex mocking)". OBSERVED
  `test-batch-deliver.sh`: a search for `gitlab|glab|ADOS_MERGE_STRATEGY|
  merge_flags_for|gitlab_await|detailed_merge|GL-` returns **NONE** — the only
  GH-148 change there is adding `"state":"OPEN"` to existing GitHub fixtures (bug
  fix #6). The coverage matrix in `chg-GH-148-test-plan.md:464-515` marks all 51
  as "Covered".
- **Consequence:** The defects CG-BASH-001/002, CG-API-001/002 are **invisible to
  the suite** precisely because the code paths they live in are untested and the
  existing mocks are arg-lenient. The "100% GitLab result accuracy" and
  "0 GitHub regression" success metrics are **unsubstantiated by tests**.
- **Confidence:** HIGH
- **Reviewers:** critique-grid-qa-engineer, critique-grid-sre
- **Challenge result:** UPHELD.
- **Verification status:** VERIFIED — coordinator (grep of test files + runner).
- **Action:** Implement the missing TC-PLAT cases before merge — at minimum
  017..026, 027..041 (GitLab Mode B), 042, 046..049. Update the test-plan
  coverage-matrix status from "Covered" to honest states.
- **Residual uncertainty:** none on the gap.

#### **HIGH CG-SRE-001 — The NFR-1 regression gate was never executed**
- **Disposition:** CONFIRMED
- **Claim:** Phase 8.1/8.2 (the GitHub-regression gate) were skipped due to test
  hanging and re-classified as "verified via ShellCheck and code review," yet
  ShellCheck cannot detect the logic regressions present (CG-BASH-001, CG-API-001).
- **Evidence:** CLAIMED `chg-GH-148-plan.md:452-453` (8.1/8.2 marked `[x]` with
  the note "Test suite execution encountered hanging issues …; implementation
  verified via ShellCheck and code review" and "Skipped due to test hanging
  issues"). OBSERVED `shellcheck` exit 0 on both scripts (verified by
  coordinator) — confirming the lint is clean **and** confirming it inspects
  nothing about CLI flag/arg correctness.
- **Consequence:** The single most important gate for this change (zero GitHub
  regression) has **no passing-test evidence**. NFR-1/AC-F3-1 are asserted, not
  demonstrated; and CG-BASH-001 is a concrete GitHub regression the gate would
  have caught had the merge-path mock asserted argv shape.
- **Confidence:** HIGH
- **Reviewers:** critique-grid-sre, critique-grid-qa-engineer
- **Challenge result:** UPHELD.
- **Verification status:** VERIFIED — coordinator (the plan's own text + ShellCheck run).
- **Action:** Diagnose and fix the test hang (likely candidates: an unmocked real
  CLI in a non-`RUN_SLOW` path, or the new `detect_platform` glab-auth probe
  hitting a real `glab` during sourcing/main in an integration test); get the full
  suite + `scripts/test-all.sh` green before PR.
- **Residual uncertainty:** root cause of the hang (not investigated here).

#### **MEDIUM CG-DEC-001 — Completion claims (checkboxes, exec log, "3/3 follow-ups closed") contradict the code**
- **Disposition:** CONFIRMED
- **Claim:** Several completion signals in the plan/spec are marked done for work
  that was not done or was skipped.
- **Evidence:** OBSERVED `chg-GH-148-plan.md:411` task 7.1 `[x]` (F-12 — not
  implemented, CG-QA-001); `:452-453` tasks 8.1/8.2 `[x]` (suite skipped,
  CG-SRE-001); `:586-593` Phase 7 & 8 "COMPLETED"; spec §4.1 / §17 / plan success
  metrics assert "GH-146 follow-ups closed: 3/3" while F-12 is missing (so it is
  ≤2/3). The `@fixer` 6-bug history was applied but **not** re-verified by an
  executed suite.
- **Consequence:** A reviewer/PM trusting the checkboxes would ship believing the
  gate passed and all follow-ups closed. This is the exact "decision evidence
  quality" failure mode the decision-critic exists to catch.
- **Confidence:** HIGH
- **Reviewers:** critique-grid-decision-critic
- **Challenge result:** UPHELD.
- **Verification status:** VERIFIED — coordinator.
- **Action:** Mark the affected tasks honestly (7.1 → not done; 8.1/8.2 → blocked
  on hang) and re-state the follow-up count; do not present the change as
  DoD-complete until the gate is green and F-12 lands.
- **Residual uncertainty:** none.

#### **MEDIUM CG-API-003 — GitLab pipeline API relies on unverified `:id` auto-resolution; dead-code duplication in the no-CI check**
- **Disposition:** PARTIALLY_CONFIRMED
- **Claim:** (a) The GitLab pipeline queries (`/projects/:id/merge_requests/:iid/pipelines`)
  depend on glab auto-resolving `:id` to the current project — asserted but not
  executed. (b) The GitLab branch of `_pr_has_no_checks_configured`
  (`batch-deliver.sh:468-479`) is **dead code**: the GitLab path of
  `wait_for_pr_green` inlines its own pipeline check (`:573-621`) and never calls
  `_pr_has_no_checks_configured`, which is only invoked from the GitHub branch
  (`:640`).
- **Evidence:** OBSERVED `batch-deliver.sh:474` and `:579` — both issue
  `_glab api /projects/:id/merge_requests/"${pr_number}"/pipelines --output json`.
  OBSERVED `_pr_has_no_checks_configured` is called only at `:640` (inside the
  GitHub `else`), so its GitLab branch is unreachable.
- **Consequence:** If glab does not auto-resolve `:id` in this environment, the
  GitLab green-gate returns `3` (unknown → park) for every MR and **no GitLab MR
  ever merges** — compounding CG-BASH-001. The dead duplicate is a maintainability
  hazard (two pipeline-check implementations can drift).
- **Confidence:** MEDIUM (the `:id` behavior is the unverified part; the
  dead-code finding is HIGH/certain).
- **Reviewers:** critique-grid-api-integration-engineer, critique-grid-sre
- **Challenge result:** UNRESOLVED on `:id`; UPHELD on dead code.
- **Verification status:** NOT_PERFORMED for `:id` (requires glab); VERIFIED for
  dead code.
- **Action:** Smoke-test `glab api /projects/:id/merge_requests/<iid>/pipelines`
  against a real project; if `:id` is unsupported, resolve the project id
  explicitly. Remove the duplicate GitLab no-CI branch (or route
  `wait_for_pr_green` through it).
- **Residual uncertainty:** glab `:id` substitution support.

#### **LOW CG-BASH-003 — `_tracker` and `_mr` are byte-identical; the "noun swap" lives in the callers, not the seam**
- **Disposition:** CONFIRMED (observation, not a defect)
- **Claim:** The dispatch seam is two identical functions; platform subcommand
  selection (`gh pr` vs `glab mr`) is performed by each normalizer, not by `_mr`.
- **Evidence:** OBSERVED `deliver-ticket.sh:254-269` and `batch-deliver.sh:130-145`
  — `_tracker()` and `_mr()` have identical bodies. The pr/mr noun is chosen at
  the call site (e.g. `mr_list_for_branch` calls `_mr pr list` on GitHub vs
  `_mr mr list` on GitLab). Spec §5.1 F-3 says "the dispatch handles the noun
  swap," which overstates the seam's responsibility.
- **Consequence:** Minor abstraction drift; not a runtime bug. A future reader may
  expect `_mr` to normalize the noun and introduce a double-swap.
- **Confidence:** HIGH
- **Reviewers:** critique-grid-bash-dev
- **Action:** Either fold the noun mapping into `_mr`/`_tracker` (so callers pass
  a platform-neutral verb) or correct the spec wording. Optional.
- **Residual uncertainty:** none.

#### **LOW CG-QA-003 — `test_platform_detect_glab_fallback` is mislabeled; TC-PLAT-005/006 effectively untested**
- **Disposition:** CONFIRMED
- **Claim:** The test named for the glab-auth fallback actually asserts the
  github default (it does not mock `glab auth status`), making it a near-duplicate
  of `test_platform_detect_github_default`.
- **Evidence:** OBSERVED `test-deliver-ticket.sh` `test_platform_detect_glab_fallback`
  body — it stubs `_git` to an unrecognized remote and asserts `result == github`
  (no `command -v glab` / auth stub); the runner comment at `:1995` concedes
  "TC-PLAT-005/006 … deferred."
- **Consequence:** The glab-auth fallback branch of `detect_platform` (step 3) —
  the only path that can mis-select GitLab on a GitHub host — is untested.
- **Confidence:** HIGH
- **Reviewers:** critique-grid-qa-engineer
- **Action:** Either implement a real glab-auth stub or drop the misleading test
  name.
- **Residual uncertainty:** none.

#### **NIT CG-SRE-002 — Inconsistent indentation in `wait_for_pr_green`'s GitLab branch**
- **Disposition:** CONFIRMED
- **Evidence:** OBSERVED `batch-deliver.sh:575-621` — the `while`/`if` block is
  over-indented relative to its siblings (the `log_debug` at `:575` is at 4 spaces,
  the `while` at `:576` at 6, the inner `if` at `:581` at 6). `shfmt -i 2` would
  reformat. Task 8.5 claims shfmt clean, but shfmt is not installed here
  (UNVERIFIED).
- **Action:** Run `shfmt -i 2 -ci -bn -d` and apply.
- **Residual uncertainty:** whether shfmt was actually run by the author.

---

### Rejected or Weakened Findings

- **(none rejected)** All nominated findings survived static challenge; the only
  PARTIALLY_CONFIRMED items are CG-API-002 (the `--json` runtime question) and
  CG-API-003 (the `:id` question), both downgraded on the UNVERIFIED runtime
  portions while their static (field/value/dead-code) portions stand.

### Unresolved Questions and Missing Evidence

1. **Does `glab mr view` accept `--json <field>`?** Determines whether the
   `mergeable`-immediate path of F-10 works at all. Resolve with a one-line
   `glab` smoke test. (CG-API-002)
2. **Does `glab api /projects/:id/...` auto-resolve `:id`?** Determines whether
   the GitLab green-gate ever returns green. (CG-API-003)
3. **What causes the test-suite hang?** Blocking diagnosis for NFR-1. Candidates:
   an unmocked real CLI in a non-slow path, or `detect_platform` invoking a real
   `glab auth status` during a sourced integration test. (CG-SRE-001)
4. **Is the no-op push in `gitlab_await_mergeable` pushed to the MR's actual
   source branch?** `approved_pr_flow` runs after `rebase_before_merge(branch)`;
   confirm the working tree is on the MR source branch before
   `_git commit --allow-empty && _git push`, else the recompute targets the wrong
   ref. (noted under CG-API-002 residual)

### Coverage and Execution Gaps

- **No blind independent panel** (coordinator-only static adjudication;
  confidence capped). **No executed test suite** (self-skipped). **No `shfmt`
  run** (tool absent). **No live GitLab execution.** Two of three GH-146
  follow-ups actually delivered. The captured DoR track (2 iterations) is strong
  on artifact *consistency* but, by design, did not inspect runtime *correctness*
  of the new code — which is where every confirmed defect lives.

### Residual Risk
- **Accepted risks:** none new — the panel recommends **not** accepting any of the
  CRITICAL/HIGH findings pre-PR.
- **Unverified high-consequence risks:** glab `:id`/`--json` behavior
  (CG-API-002/003) could mean GitLab Mode B never merges even after the
  flag/field fixes; the no-op-push target correctness is unchecked.
- **Human decision required:** whether to (a) block and remediate in-place, or
  (b) split the PR — ship only the **verified-correct** subset (F-1 detection,
  F-3/F-4 dispatch+normalization *basics*, F-6 neutral prompt, F-11 find fix,
  F-13 macOS fallback, F-14 tuning docs) and defer the **non-functional/unsupported**
  GitLab Mode B (F-7/F-9/F-10), the broken merged-detection (CG-API-001/CG-BASH-002),
  and F-12 to a follow-up.

### Recommended Next Action

**BLOCK — do not create the PR yet.** Remediate, in priority order:

1. **CG-BASH-001** (merge flags as array) — restores Mode B merge on GitHub and
   unblocks GitLab; add an argv-shape assertion test. *(NFR-1 blocker.)*
2. **CG-API-001 + CG-BASH-002** (state filter + correct arg to
   `mr_list_closed_merged`) — restore merged-PR detection on both platforms.
3. **CG-API-002** (glab field/flag fixes in `gitlab_await_mergeable`) + smoke-test
   glab `:id`/`--json` (CG-API-003) — make F-10 actually function.
4. **CG-QA-002** — implement the missing TC-PLAT cases (esp. 017..041, 046..049)
   with mocks that assert argv shape and field mapping, not just substrings.
5. **CG-SRE-001** — fix the test hang and get `scripts/test-all.sh` green;
   re-run the regression gate for real.
6. **CG-QA-001** — either implement F-12 (TC-PLAT-046..049) or formally de-scope
   it and correct every "3/3 closed" / task-7.1 / Phase-7 claim (CG-DEC-001).

Re-run `/review GH-148` (or a fresh CritiqueGrid pass) once the suite is green
and the above are resolved; the LOW/NIT items (CG-BASH-003, CG-QA-003,
CG-SRE-002) can ride along opportunistically.

**Positive note (for balance):** the *detection* (F-1), *dispatch+normalization
structure* (F-3/F-4 basics), *neutral prompt* (F-6), `find` robustness (F-11),
macOS reaper fallback (F-13), hook-tuning docs (F-14), and the spec/test-plan/plan
quality are genuinely good; the `PLATFORM="${PLATFORM:-github}"` `set -u` guard,
the `ascii_downcase` state normalization, and the ShellCheck-clean result are all
correct. The defects are concentrated in the **GitLab Mode B execution layer and
the new merge-strategy plumbing** — exactly the parts that were never exercised by
an executed test suite.

---

*This review was produced by **CritiqueGrid** — evidence-driven AI reviews for
consequential decisions. Learn more or run your own review at
[github.com/juliusz-cwiakalski/critique-grid](https://github.com/juliusz-cwiakalski/critique-grid).*
