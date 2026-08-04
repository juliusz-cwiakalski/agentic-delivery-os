---
id: chg-GH-150-quota-aware-delivery-wait
status: Proposed
created: 2026-08-04T00:00:00Z
last_updated: 2026-08-04T00:00:00Z
owners: ["Juliusz Ćwiąkalski"]
service: delivery-os
labels: ["autonomous-delivery", "quota", "hooks", "zai", "extensibility"]
links:
  change_spec: ./chg-GH-150-spec.md
  test_plan: ./chg-GH-150-test-plan.md
  pm_notes: ./chg-GH-150-pm-notes.yaml
  hook_source: ../../../../scripts/hooks/pre-opencode-iteration-zai.sh
  test_source: ../../../../scripts/.tests/test-hook-zai-example.sh
  guide: ../../../guides/zai-peak-hours-hook.md
  blueprint: ../../../templates/blueprints/zai-peak-hours-hook--install.sh
  bash_rules: ../../../../.ai/rules/bash.md
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
  tdr: ../../../decisions/TDR-0002-pre-iteration-hook-contract-details.md
  poc: ./quota-check-poc.sh
summary: >
  Refactor the inactive Z.AI peak-hours example hook into a generic sleep-driver
  with a pluggable condition-function extension point, add a new opt-in/fail-open
  Z.AI token-quota condition that sleeps until quota reset (stopping the
  restart-storm), and add a re-evaluation loop that composes conditions correctly
  across elapsed time — all while preserving byte-identical peak-hours delivery
  for users who do not opt in, proven by a deterministic, hermetic test matrix
  (zero live network, zero real sleeps).
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-150: Quota-aware Z.AI pre-iteration hook with pluggable condition-driver

## Context and Goals

This plan implements `chg-GH-150-spec.md` and its test plan
(`chg-GH-150-test-plan.md`, TC-ZAI-001..071 + preserved TC-HOOK-015..018) under
**Accepted GH-146 / TDR-0002 (R2)**, the hook invocation contract this hook
extends. The hook remains a pure gate (sleep to defer, exit `0` to proceed); the
quota feature writes no `ADOS_HOOK_ENV_V1` output.

The plan turns the spec's contracts into a phased, checkable task list that
`@coder` executes. It does **not** contain the bash implementation — only tasks
+ verification.

**Root cause being solved (DEC-11):** an exhausted Z.AI token quota is misread by
the wrapper as a generic liveness stall, so it kill/restarts the same work
repeatedly until a human forces a stop — even though no restart can replenish a
quota. The correct action is to **wait** until the quota resets. GH-150 makes the
hook quota-aware so delivery waits; on merge, GH-150 closes and the wrapper-side
AC are **superseded** (not deferred) by the per-provider-hook extensibility
pattern.

### Resolved open questions (binding PM decisions — encoded as-is)

The spec/test-plan open questions are resolved and govern this plan:

- **OQ-1 (log wording)**: exact `[INFO]`/`[WARN]` bytes are NOT pinned — the
  refactored driver may normalize the single-condition log string. Tests pin the
  **behavioral** contract (reason category token + UTC wake time on sleep;
  exactly one `[WARN]` per active failure; redaction). @coder/@test-plan-writer
  settle the final string. Drives Phase 1/2/3.
- **Flag-3 (`_zai_quota_fetch` return encoding)**: the spec says only "returns
  HTTP status code + response body" (DM-6). The exact `(http_code, body)`
  encoding is **@coder's choice**; tests follow whatever the seam emits. Drives
  Phase 2/3.
- **OQ/Flag-1 (docs AC dependency)**: AC-F6-1 / TC-ZAI-071 (guide greps for the
  condition-function contract) can only pass **after** the guide is updated
  (Phase 4). @coder must not block the hook tests (Phase 3) on it. This is the
  one cross-phase dependency — flagged below and in Phase 3.3/4.2.

### Architecture to implement (from spec §5/§8 — do not deviate)

- **Generic driver `main()`** + **two condition functions** following the DM-1
  contract: `howLongToSleepDueToPeakHours` (behavior-preserving refactor) and
  `howLongToSleepDueToQuotaExhaustion` (new, opt-in, fail-open).
- **Driver**: gate on model `zai-coding-plan/*` (return 0 immediately otherwise —
  no conditions evaluated, AC-F1-1); loop { `max_sleep` = MAX over conditions; if
  0 return 0; log `[INFO]` reason + UTC wake via `format_utc_epoch`; `_sleep`
  `max_sleep`; re-eval } until `max_sleep==0`; defensive cap
  `ADOS_ZAI_MAX_SLEEP_LOOPS` (default 24) → return 0 + one `[WARN]` (DM-5/NFR-6).
- **Peak condition**: existing `[peak_start - buffer, peak_end)` logic moved into
  the condition; pure-bash (no `jq`, no network); `format_utc_epoch` reused;
  observable behavior (gate, sleep target, exit 0, `[INFO]` line) UNCHANGED.
- **Quota condition**: activate only when model zai AND `ZAI_API_KEY` non-empty
  AND `jq` present AND `curl` present AND `ADOS_ZAI_QUOTA_DISABLED != 1`. Fetch
  via NEW seam `_zai_quota_fetch()`; parse `data.limits[]` `type=="TOKENS_LIMIT"`;
  if any `percentage >= 100` → return seconds-until-soonest `nextResetTime`
  (epoch-ms→s) clamped `>= 0`; ignore `TIME_LIMIT`. Fail-open (DM-3 catalog) →
  return 0 + exactly one `[WARN]`. Silent opt-out (no WARN) when not opted in.
- **New env**: `ZAI_API_KEY`, `ADOS_ZAI_QUOTA_DISABLED`, `ADOS_ZAI_MAX_SLEEP_LOOPS`.
  Keep `ADOS_ZAI_PEAK_START_UTC`/`END_UTC`/`BUFFER_SECONDS`. **NO cache, NO
  `ADOS_ZAI_QUOTA_CACHE_SECONDS` in v1** (DEC-9 / NG-2).

### Open questions

- None remaining (the three above are resolved and only constrain wording /
  encoding / sequencing, not behavior).

## Scope

### In Scope

- **F-1** Generic condition-function sleep-driver (gate + MAX + re-eval loop +
  `ADOS_ZAI_MAX_SLEEP_LOOPS` cap) — the productized extension point.
- **F-2** Peak-hours condition as a behavior-preserving refactor (zero observable
  delta for non-opt-in users).
- **F-3** Z.AI quota-exhaustion condition: opt-in, fail-open, exhaustion rule
  (`percentage >= 100` on any `TOKENS_LIMIT`), sleep-until-soonest-reset, clamp.
- **F-4** Injectable test seams: preserve `_now_utc_epoch()` / `_sleep()`; add
  `_zai_quota_fetch()`.
- **F-5** Safe secret handling: never log full `ZAI_API_KEY`; never log raw body
  in production.
- **F-6** Documentation & extension guide: quota section + extensibility /
  condition-function contract section.
- New env knobs: `ZAI_API_KEY`, `ADOS_ZAI_QUOTA_DISABLED`, `ADOS_ZAI_MAX_SLEEP_LOOPS`.
- Tests: extend `scripts/.tests/test-hook-zai-example.sh` with TC-ZAI-001..071
  (groups A–H + meta/docs); preserve TC-HOOK-015..018.
- Docs: update `doc/guides/zai-peak-hours-hook.md` + (if needed)
  `doc/templates/blueprints/zai-peak-hours-hook--install.sh`.

### Out of Scope

- [OUT] Wrapper-level quota handling in `deliver-ticket.sh` / `ceo-loop.sh`
  (`--status waiting_for_quota`, foreground wrapper sleep, wrapper signal
  handling) — **superseded** by the per-provider-hook pattern (NG-1, DEC-11).
- [OUT] A file-based cross-invocation quota cache and `ADOS_ZAI_QUOTA_CACHE_SECONDS`
  (NG-2, DEC-9). Only a negative assertion (no cache file, one fetch/iteration).
- [OUT] Non-Z.AI providers (NG-3); `TIME_LIMIT` exhaustion semantics (NG-4);
  waiting for HTTP 429 (NG-5); interrupting an in-flight session (NG-6).
- [OUT] Any change to the GH-146 / TDR-0002 hook invocation contract or
  `ADOS_HOOK_ENV_V1` return protocol (NG-7).
- [OUT] A wrapper-side heartbeat/status marker for very long quota sleeps (§7.3).

### Constraints

- **C-1 Bash 4.0+ & `.ai/rules/bash.md`**: `set -Eeuo pipefail`, `set -o
  errtrace`, `shopt -s inherit_errexit`, `IFS=$'\n\t'` MUST be preserved (already
  in the hook). Quote all expansions; `[[ ... ]]`; `local`; testable main guard.
- **C-2 Backward compatibility / byte-identical non-opt-in path**: when
  `ZAI_API_KEY` is unset the quota condition returns `0` silently, performs no
  network call, and spawns no `jq`; peak path is unchanged pure-bash (G-3, NFR-3).
- **C-3 GH-146/TDR-0002 contract preserved**: pure gate (sleep / exit 0 / non-zero
  prevents spawn); quota feature writes no `ADOS_HOOK_ENV_V1` output; no wrapper
  retry/liveness/merge change (NG-7).
- **C-4 Determinism (NFR-1)**: 0 live network calls and 0 real sleeps across the
  full test matrix (groups A–H); all time/sleep/HTTP injected via the three seams.
- **C-5 Peak-path portability (NFR-2)**: `format_utc_epoch` stays a pure
  Gregorian conversion (no GNU `date -d`); the `! grep -q 'date -.*-d'` assertion
  is preserved for the **peak** path; `jq` is confined to the opt-in quota path
  (DEC-6).
- **C-6 Fail-open discipline (NFR-4)**: each active-but-failed quota path emits
  exactly one `[WARN]` (reason category only), returns 0, leaves the peak
  condition applicable, and never alters the hook exit status.
- **C-7 Secret hygiene (NFR-7)**: stderr/stdout contain 0 occurrences of the full
  `ZAI_API_KEY` (prefix/suffix only) and, in production, 0 occurrences of the raw
  body.
- **C-8 Security hard rule (DEC-10)**: `set-evn.sh` (owner's real key) is
  gitignored locally via `.git/info/exclude`; it MUST NEVER be staged or
  committed. Every commit delegation excludes it.
- **C-9 Per-phase commit via `@committer`**: each phase stages only that phase's
  files; PM does NOT commit delivery phases. AI agents never add license headers
  manually.

### Risks

- **RSK-1** (endpoint undocumented, shape drift): mitigated by fail-open + one
  `[WARN]` on any deviation; all HTTP behind `_zai_quota_fetch()`; data contract
  pinned by a live POC (API-1). Drives Phase 2 fail-open catalog.
- **RSK-2** (`nextResetTime` absent/past/unparseable → wrong/infinite sleep):
  mitigated by clamping `(reset_s - now)` to `>= 0`; absent/malformed → fail-open
  `0` + WARN; re-eval termination guaranteed; defensive cap. Drives Phase 2/3
  (TC-ZAI-037/062/063).
- **RSK-3** (`jq` breaks a pure-bash hook): mitigated — `jq` confined to the
  opt-in quota path; fail-open if missing; peak path stays pure-bash (TC-ZAI-056).
- **RSK-4** (secret leakage): mitigated — never log full key / raw body; TC-ZAI-050/051.
- **RSK-6** (refactor changes peak behavior): mitigated — peak logic moves into
  the contract with behavior-preserving AC (AC-F2-1); existing TC-HOOK-015..018
  stay green as the regression backbone.
- **RSK-7** (re-eval fails to compose across elapsed time): mitigated — MAX +
  re-eval until none `> 0` is mandatory; TC-ZAI-060 cross-time proof.

### Success Metrics

- Restarts caused by quota exhaustion (opt-in, exhausted): 0 — hook waits then
  resumes once.
- Behavior delta for non-opt-in users: none — peak-only path byte-identical.
- Live network calls / real sleeps in CI: 0 across groups A–H.
- Fail-open discipline: exactly one `[WARN]` per active-but-failed quota path;
  exit status never changed; peak still applies.
- Secret leakage in stderr/stdout (production): 0 full-key, 0 raw-body.
- Peak-path portability: `format_utc_epoch` correct without GNU `date -d`;
  `! grep -q 'date -.*-d'` preserved for the peak path.

## Phases

> **Commit cadence**: each phase ends with its own Conventional Commit created by
> `@coder` via `@committer` (e.g. `feat(GH-150): <phase>`). PM does NOT commit
> delivery phases. Stage only that phase's files; never stage `set-evn.sh` or
> `.ai/local/`.

### Phase 0: Preflight (read inputs + rules)

**Goal**: Load every authoritative input and the repo's bash/testing rules before
touching code, so implementation follows contracts rather than guessing.

**Dependencies**: None.

**Tasks**:

- [ ] **0.1** Read the authoritative inputs: `chg-GH-150-spec.md` (§5 F-1..F-6,
  §8 DM-1/3/4/5/6 + API-1, §9 NFRs, §16 affected components, §17 ACs, Decision
  Log DEC-1..11, NG-1..NG-7) and `chg-GH-150-test-plan.md` (TC-ZAI-001..071 +
  TC-HOOK-015..018, the §5 fixture catalog, the §3.2 seam-mocking mechanism, the
  §10.3 flags).
- [ ] **0.2** Read the existing hook `scripts/hooks/pre-opencode-iteration-zai.sh`
  (71 lines) and enumerate its current seams/helpers: `_now_utc_epoch()`,
  `_sleep()`, `format_utc_epoch`, `zai_configured_model`, `is_zai_peak_window`,
  `seconds_until_window_end`, `main`. Read the existing
  `scripts/.tests/test-hook-zai-example.sh` (24 lines): the sourcing pattern, the
  `check` harness, and the four TC-HOOK-015..018 assertions to preserve.
- [ ] **0.3** **MANDATORY**: read `.ai/rules/bash.md` in full before editing any
  bash file (strict mode, mockable seams §10.3, pure functions §10.2, testable
  main guard §10.4, embedded test framework §11, ShellCheck/shfmt §13). Note
  `.ai/rules/testing-strategy.md` for the documentation quality gates.
- [ ] **0.4** Read the validated POC `quota-check-poc.sh` (ground-truth endpoint
  /fields source for API-1) and `chg-GH-150-pm-notes.yaml` (DEC-1..11, required
  test matrix groups A–H). Read the guide + blueprint to update
  (`doc/guides/zai-peak-hours-hook.md`, `doc/templates/blueprints/zai-peak-hours-hook--install.sh`).
- [ ] **0.5** Confirm environment: on branch `feat/GH-150/quota-aware-delivery-wait`;
  change folder `doc/changes/2026-08/2026-08-04--GH-150--quota-aware-delivery-wait/`
  exists; `set-evn.sh` is locally gitignored (`.git/info/exclude`) and must never
  be staged (C-8).
- [ ] **0.6** Record the three resolved OQs (log wording unpinned — behavioral
  pinning only; `_zai_quota_fetch` encoding = @coder's choice; TC-ZAI-071 depends
  on the Phase 4 guide update) as constraints the implementation must honor.

**Acceptance Criteria**:

- Must: all inputs read; `.ai/rules/bash.md` read before any edit (C-1).
- Should: seam/helper inventory + fixture catalog understood end-to-end.

**Affected code areas**: none (read-only).

**System docs to update**: none.

**Tests**: none.

**Completion signal**: no commit (preflight only).

---

### Phase 1: Generic driver + condition contract + behavior-preserving peak refactor

**Goal**: Refactor `main()` into a generic sleep-driver that gates on the model,
takes MAX over registered condition functions, sleeps, and re-evaluates until no
condition returns `> 0` (with the defensive cap), and move the existing peak
logic into a `howLongToSleepDueToPeakHours` condition with **zero** observable
behavior change. The four existing TC-HOOK-015..018 assertions stay green.

**Dependencies**: Phase 0.

**Tasks**:

- [ ] **1.1** Preserve the strict-mode header unchanged: `set -Eeuo pipefail`,
  `set -o errtrace`, `shopt -s inherit_errexit`, `IFS=$'\n\t'`, and the testable
  main guard `if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then main "$@"; fi` (C-1).
- [ ] **1.2** Define the condition-function contract (DM-1) as a documented
  extension point: a condition is a function `howLongToSleepDueTo<Reason>()`
  that (a) echoes exactly one non-negative integer to stdout = seconds to sleep
  (`0`/empty/error = no wait from this condition); (b) obtains time/HTTP strictly
  through the seams (`_now_utc_epoch`, `_zai_quota_fetch`); (c) emits at most one
  diagnostic line to stderr. Add a condition registry the driver iterates (v1
  registers peak now; quota is added in Phase 2).
- [ ] **1.3** Introduce `ADOS_ZAI_MAX_SLEEP_LOOPS` (default `24`, DM-4) as a
  configurable env knob (read at runtime, not `readonly`-blocked).
- [ ] **1.4** Rewrite `main()` into the generic driver (F-1, DM-5): gate on
  `zai-coding-plan/*` via `zai_configured_model` — if the model does not match,
  return `0` immediately and evaluate **no** conditions (AC-F1-1); otherwise loop
  { `max_sleep` = MAX over registered conditions; if `max_sleep == 0` return `0`;
  log one `[INFO]` line naming the active reason + the exact UTC wake time via
  `format_utc_epoch`; `_sleep "${max_sleep}"`; re-evaluate all conditions } until
  `max_sleep == 0`. Enforce `ADOS_ZAI_MAX_SLEEP_LOOPS`: on exceed, return `0` and
  emit exactly one `[WARN]` (loop-cap category) (AC-F1-2, NFR-6).
- [ ] **1.5** Move the existing effective-pause-window logic
  (`[peak_start - buffer, peak_end)`, default 04:00–10:00 UTC) into
  `howLongToSleepDueToPeakHours()`. **Preserve** the helper functions
  `is_zai_peak_window`, `seconds_until_window_end`, `zai_configured_model`, and
  `format_utc_epoch` intact so the existing TC-HOOK-015..018 assertions (which
  call them directly) stay green. The peak condition returns
  seconds-until-`peak_end` when inside the window and `0` otherwise; it stays
  pure-bash (no `jq`, no network — C-5) and reuses `format_utc_epoch`. The peak
  `[INFO]` line keeps naming the peak reason + exact UTC wake time (behavioral
  pin; exact wording per OQ-1 is @coder's).
- [ ] **1.6** Register the peak condition in the driver (Phase 2 adds quota).
  Confirm the non-opt-in observable contract is unchanged: same gate, same sleep
  target, exit `0`, one `[INFO]` line on sleep (AC-F2-1, RSK-6).

**Acceptance Criteria**:

- Must: AC-F1-1 — non-`zai-coding-plan/*` model returns `0` with no sleep and no
  condition evaluated.
- Must: AC-F2-1 (peak portion) — inside the window the hook sleeps until
  `peak_end` and returns `0`; outside it returns `0` immediately; `format_utc_epoch`
  correct without GNU `date -d`.
- Must: AC-F1-2 (loop skeleton) — driver takes MAX, sleeps, re-evaluates, and
  honors `ADOS_ZAI_MAX_SLEEP_LOOPS`.
- Must: TC-HOOK-015..018 remain green (regression backbone).

**Affected code areas**:

- `scripts/hooks/pre-opencode-iteration-zai.sh` — refactored `main()` driver, new
  `howLongToSleepDueToPeakHours`, condition contract/registry, `ADOS_ZAI_MAX_SLEEP_LOOPS`
  (updated).

**System docs to update**: none (guide update is Phase 4).

**Tests**:

- `bash scripts/.tests/test-hook-zai-example.sh` — TC-HOOK-015..018 green
  (existing assertions unchanged); manual smoke: non-zai model returns 0 with no
  sleep, in-peak sleeps to peak_end.

**Completion signal**: `feat(GH-150): generic sleep-driver + condition contract + behavior-preserving peak refactor`

---

### Phase 2: Quota condition + `_zai_quota_fetch` seam

**Goal**: Add the opt-in/fail-open Z.AI quota-exhaustion condition and the
`_zai_quota_fetch()` HTTP seam, register it in the driver, and enforce secret
hygiene — completing the v1 condition set (peak + quota).

**Dependencies**: Phase 1 (driver + contract + registry).

**Tasks**:

- [ ] **2.1** Add the `_zai_quota_fetch()` seam (DM-6, F-4) wrapping `curl`
  against `GET https://api.z.ai/api/monitor/usage/quota/limit` with
  `Authorization: Bearer $ZAI_API_KEY` and `Accept: application/json`. **Pin the
  exact `(http_code, body)` return encoding** (Flag-3 = @coder's choice); document
  it so tests can follow. Include a "transport-failed" indicator for curl/network
  failure. Production behavior is unchanged by the seam.
- [ ] **2.2** Add the env knobs (DM-4): read `ZAI_API_KEY` (read-only, never
  logged in full) and `ADOS_ZAI_QUOTA_DISABLED` (`1` = opt out even with key).
  (`ADOS_ZAI_MAX_SLEEP_LOOPS` was added in Phase 1.) Do **not** introduce any
  cache or `ADOS_ZAI_QUOTA_CACHE_SECONDS` (DEC-9 / NG-2).
- [ ] **2.3** Implement the activation gate (DM-4): the quota condition is active
  only when the model is `zai-coding-plan/*` AND `ZAI_API_KEY` is non-empty AND
  `jq` is present AND `curl` is present AND `ADOS_ZAI_QUOTA_DISABLED != 1`.
  Otherwise return `0` **silently** (no WARN, no fetch — NFR-5); the peak
  condition still applies independently (AC-F3-1, AC-F3-4).
- [ ] **2.4** Implement `howLongToSleepDueToQuotaExhaustion()` (F-3, DM-2/DM-3,
  API-1): when active, fetch via `_zai_quota_fetch()`; require envelope
  `code==200` AND `success==true`; parse `data.limits[]`; **ignore** `TIME_LIMIT`
  (NG-4); if **any** `TOKENS_LIMIT` entry has `percentage >= 100` (covers `==100`
  and `>100`, DEC-4), return the seconds until the **soonest** valid
  `nextResetTime` among the exhausted entries (epoch-ms → seconds), clamped to
  `>= 0`. Pre-empt at `percentage >= 100`; never wait for a 429 (NG-5).
- [ ] **2.5** Implement the fail-open catalog (DM-3, NFR-4): on any of —
  network/curl failure, HTTP 401/403, non-200 envelope (`code != 200` or
  `success != true`), malformed JSON, `data.limits` absent/non-array,
  non-numeric `percentage`, or an exhausted entry with absent/malformed/unparseable
  `nextResetTime` and no other exhausted entry yielding a valid reset — return `0`
  and emit **exactly one** `[WARN]` line carrying a reason **category** only
  (e.g. `HTTP 401`, `malformed JSON`, `nextResetTime`). The peak condition still
  applies; the hook exit status is never altered (AC-F3-3).
- [ ] **2.6** Enforce secret hygiene (F-5, NFR-7, DEC-10, C-7): never write the
  full `ZAI_API_KEY` to stdout/stderr (at most a short prefix/suffix in a
  diagnostic); in production mode never log the raw response body. Ensure every
  diagnostic path redacts.
- [ ] **2.7** Register the quota condition in the driver. Confirm the two
  conditions now compose via MAX + re-eval across elapsed time (AC-F1-2); confirm
  the non-opt-in path still performs 0 `jq` and 0 network calls (AC-NFR3-1).

**Acceptance Criteria**:

- Must: AC-F3-1 — `ZAI_API_KEY` unset OR `jq` OR `curl` missing → `0`, silent,
  peak still applies.
- Must: AC-F3-2 — any `TOKENS_LIMIT` `percentage >= 100` → seconds-until-soonest
  `nextResetTime` (clamped `>= 0`); `TIME_LIMIT` ignored; `==100` and `>100` count.
- Must: AC-F3-3 — every fail-open case → `0` + exactly one `[WARN]`; peak applies;
  exit status unchanged.
- Must: AC-F3-4 — `ADOS_ZAI_QUOTA_DISABLED=1` + key → `0`, no fetch.
- Must: AC-F5-1 — stderr/stdout never contain the full key; never the raw body in
  production.
- Must: AC-NFR3-1 — non-opt-in path spawns 0 `jq`, 0 network.
- Must: AC-NFR8-1 — ≤1 fetch per re-eval loop iteration; no cross-invocation
  cache (fetch behind the seam).

**Affected code areas**:

- `scripts/hooks/pre-opencode-iteration-zai.sh` — new `_zai_quota_fetch()` seam,
  `howLongToSleepDueToQuotaExhaustion()`, activation gate, env knobs, fail-open
  catalog, redaction, quota registration (updated).

**System docs to update**: none (guide update is Phase 4).

**Tests**:

- Manual smoke against a POC-shaped fixture via a one-off seam override (not
  committed); confirm sleep math + redaction; no full key / raw body logged.

**Completion signal**: `feat(GH-150): opt-in fail-open Z.AI quota condition + _zai_quota_fetch seam`

---

### Phase 3: Deterministic test matrix (TC-ZAI-001..071)

**Goal**: Extend `scripts/.tests/test-hook-zai-example.sh` with the full mocked
matrix (groups A–H + meta/docs) per the test plan, via the sourcing + seam-override
pattern — preserving TC-HOOK-015..018 and asserting the behavioral contract (not
exact log bytes, per OQ-1).

**Dependencies**: Phase 2 (hook complete). **Cross-phase dependency (Flag-1)**:
TC-ZAI-071 (docs grep) can only pass after the Phase 4 guide update — author the
assertion now but do not block the hook tests on it.

**Tasks**:

- [ ] **3.1** Extend the test harness (§3.2/§3.3): reuse the existing
  `source "${SCRIPT_DIR}/hooks/pre-opencode-iteration-zai.sh"` line, the `check`
  harness, and the pass/fail counters. Add the seam-override utilities: a
  recording `_sleep` (writes to a per-test sleep log reset before each test); a
  `_now_utc_epoch` that is either fixed or a **stepping clock** advancing by the
  sum of prior `_sleep` args; a canned `_zai_quota_fetch` returning the chosen
  fixture; `command -v` stubs to simulate missing `jq`/`curl`; a `jq` call
  counter; a `_zai_quota_fetch` call counter. Scope env mutations per test
  (subshell or explicit unset) so nothing leaks (§4).
- [ ] **3.2** Encode the Fixture Catalog (§5) as JSON data: valid-shape
  (F-OFF, F-5H, F-WEEK, F-BOTH, F-TIME-ONLY, F-OVERAGE, F-PAST, F-5H-FAR,
  F-CROSS); fail-open/transport (F-NET-FAIL, F-401, F-403, F-ENV-500,
  F-ENV-SUCCESS-FALSE, F-MALFORMED, F-NO-LIMITS, F-LIMITS-NOT-ARRAY,
  F-PCT-NON-NUMERIC, F-RESET-ABSENT, F-RESET-MALFORMED, F-RESET-UNPARSEABLE);
  hygiene (F-SECRET fake key, F-CANARY body). Pin the `_zai_quota_fetch` return
  encoding to whatever Phase 2 emitted.
- [ ] **3.3** **Group A — peak regression** (AC-F2-1): TC-ZAI-001 (non-zai → no
  sleep, no condition seam invoked), TC-ZAI-002 (off-peak → 0), TC-ZAI-003
  (in-peak → `_sleep`=21600 + `[INFO]` wake `2026-01-01T10:00:00Z`), TC-ZAI-004
  (in buffer → `_sleep`=21000), TC-ZAI-005 (custom peak vars — re-source in a
  subshell per §3.4 because the peak vars are `readonly` at source time).
- [ ] **3.4** **Group B — quota fail-open** (AC-F3-3, NFR-4): TC-ZAI-010..018
  (one `[WARN]` each for F-NET-FAIL/F-401/F-403/F-ENV-500/F-ENV-SUCCESS-FALSE/
  F-MALFORMED/F-NO-LIMITS+F-LIMITS-NOT-ARRAY/F-PCT-NON-NUMERIC/F-RESET-*),
  TC-ZAI-019 (fail-open + in-peak → peak sleep still applies), TC-ZAI-020
  (exactly-one-`[WARN]` count cross-cut across all B fixtures).
- [ ] **3.5** **Group B′ — silent opt-out** (AC-F3-1, NFR-3/5): TC-ZAI-021
  (`ZAI_API_KEY` unset → 0 stderr, fetch counter 0, `jq` counter 0), TC-ZAI-022
  (`jq` missing), TC-ZAI-023 (`curl` missing), TC-ZAI-024
  (`ADOS_ZAI_QUOTA_DISABLED=1` + key), TC-ZAI-025 (opt-out + in-peak → peak only,
  zero quota stderr).
- [ ] **3.6** **Group C — exhaustion detection** (AC-F3-2): TC-ZAI-030 (all
  pct<100 → 0), TC-ZAI-031 (5h>=100 → 7200), TC-ZAI-032 (weekly>=100 → 86400),
  TC-ZAI-033 (both → soonest 7200), TC-ZAI-034 (TIME_LIMIT-only → ignored → 0),
  TC-ZAI-035 (==100 boundary), TC-ZAI-036 (>100 overage), TC-ZAI-037 (past
  nextResetTime → clamp 0).
- [ ] **3.7** **Group D — combined peak+quota MAX** (AC-F1-2): TC-ZAI-040
  (in-peak + F-5H-FAR → first `_sleep`=30000=max(21000,30000), stepping clock),
  TC-ZAI-041 (in-peak + quota OK → peak only 21000), TC-ZAI-042 (off-peak +
  F-5H → quota only 7200).
- [ ] **3.8** **Group E — toggles** (AC-F3-4, AC-NFR8-1): TC-ZAI-045
  (`ADOS_ZAI_QUOTA_DISABLED=1` + key → no fetch, 0), TC-ZAI-046 (no cache file
  written; no `ADOS_ZAI_QUOTA_CACHE_SECONDS`; exactly 1 fetch/iteration).
- [ ] **3.9** **Group F — safety/hygiene** (AC-F5-1, NFR-7): TC-ZAI-050 (full
  F-SECRET never in stdout/stderr across opted-in paths), TC-ZAI-051 (F-CANARY
  raw body never logged in production), TC-ZAI-052 (fail-open keeps exit 0
  off-peak).
- [ ] **3.10** **Group G — portability** (AC-F2-1, NFR-2, DEC-6): TC-ZAI-055
  (`format_utc_epoch` correct sans GNU `date -d` across peak + quota epochs,
  extending TC-HOOK-015), TC-ZAI-056 (`! grep -q 'date -.*-d'` scoped to the
  **peak** path; `jq` allowed in the quota path).
- [ ] **3.11** **Group H — re-evaluation loop** (AC-F1-2, DM-5, NFR-6/8):
  TC-ZAI-060 (cross-time: F-CROSS → sleep log `[12600, 21000]`), TC-ZAI-061
  (condition clears → one sleep `[7200]`), TC-ZAI-062 (past reset on re-eval →
  no infinite loop `[3600]`), TC-ZAI-063 (`ADOS_ZAI_MAX_SLEEP_LOOPS=1` + fixed
  in-peak clock → ≤1 sleep + one loop-cap `[WARN]`), TC-ZAI-064 (fresh fetch each
  iteration → fetch counter ≥2 across a 2-iteration loop).
- [ ] **3.12** **Meta** (AC-F4-1, NFR-1): TC-ZAI-070 — constructional guarantee
  that every `_sleep` is the recording mock and every `_zai_quota_fetch` is the
  canned mock (0 real sleeps, 0 live network) + a guard that mocks are installed
  before any `main` call.
- [ ] **3.13** **Docs assertion** (AC-F6-1, Flag-1): TC-ZAI-071 — grep
  `doc/guides/zai-peak-hours-hook.md` for the condition-function contract
  keywords. **Dependency**: this case can only pass after the Phase 4 guide
  update; author it now and expect it to fail until Phase 4 lands (or run it as
  part of Phase 4's verification). Do not block the hook matrix on it.

**Acceptance Criteria**:

- Must: AC-F4-1 / NFR-1 — the suite passes with 0 live network calls and 0 real
  sleeps (all time/sleep/HTTP injected via seams).
- Must: every group A–H case passes (behavioral assertions, not exact log bytes).
- Must: TC-HOOK-015..018 preserved unchanged.
- Should: TC-ZAI-071 passes once Phase 4 lands (Flag-1).

**Affected code areas**:

- `scripts/.tests/test-hook-zai-example.sh` — extended harness + fixtures +
  TC-ZAI-001..071 (updated).

**System docs to update**: none.

**Tests**:

- `bash scripts/.tests/test-hook-zai-example.sh` — all TC-ZAI + TC-HOOK green
  (TC-ZAI-071 pending Phase 4 per Flag-1).

**Completion signal**: `test(GH-150): deterministic quota/peak matrix TC-ZAI-001..071 via seams`

---

### Phase 4: Documentation (quota section + extensibility/condition-function contract)

**Goal**: Update the guide so adopters can opt into quota checking and extend
the hook / build provider-specific hooks from the documented condition-function
contract — satisfying AC-F6-1 and unblocking TC-ZAI-071.

**Dependencies**: Phase 2 (contract to document). Enables TC-ZAI-071 (Phase 3.13).

**Tasks**:

- [ ] **4.1** Update `doc/guides/zai-peak-hours-hook.md` with a **Quota-aware
  waiting** section: opt-in via `ZAI_API_KEY` (+ `jq`/`curl` present); what it
  does (detects `TOKENS_LIMIT` `percentage >= 100`, sleeps until soonest
  `nextResetTime`); the fail-open guarantee (one `[WARN]`, peak still applies);
  the env knobs `ZAI_API_KEY`, `ADOS_ZAI_QUOTA_DISABLED`, `ADOS_ZAI_MAX_SLEEP_LOOPS`;
  silent behavior for non-opt-in users. **Preserve** the existing
  `ados_distribution: redistributable` frontmatter marker (already present).
- [ ] **4.2** Add an **Extensibility — adding conditions / other providers**
  section documenting the condition-function contract (DM-1) as the extension
  point: name shape `howLongToSleepDueTo<Reason>()`; stdout = one non-negative
  integer seconds; `0`/empty/error = no-wait; must obtain time/HTTP strictly via
  the seams (`_now_utc_epoch`, `_zai_quota_fetch`); ≤1 stderr line. Include a
  short how-to for (a) adding a condition and (b) building a provider-specific
  hook reusing the driver pattern (AC-F6-1, TC-ZAI-071).
- [ ] **4.3** Update `doc/templates/blueprints/zai-peak-hours-hook--install.sh`
  info messages **only if needed** for accuracy (e.g. note the quota opt-in). Do
  not change install behavior. Preserve the `ados_distribution: redistributable`
  marker.
- [ ] **4.4** Run the documentation drift guard: `bash scripts/.tests/test-doc-distribution.sh`
  must pass (the guide is `redistributable`; markers + install set must agree).
- [ ] **4.5** **Phase-7 / `system_spec_update` flag for `@doc-syncer` (F-6):** add
  `doc/spec/features/feature-autonomous-delivery.md` to the system-spec review list.
  It currently describes the Z.AI hook as "wait for 10:00 UTC during peak window" and
  needs a **one-line addition** noting the opt-in quota condition
  (`ZAI_API_KEY` → sleep until quota reset, fail-open). This is a `@doc-syncer`
  delivery-lifecycle phase-7 review item (reconcile `doc/spec/**` with the merged
  implementation), NOT a Phase 4 authoring task — `@coder` does not edit it here; it
  is listed so `@doc-syncer` picks it up after delivery. Likely a one-line edit.

**Acceptance Criteria**:

- Must: AC-F6-1 — the guide documents the condition-function contract as the
  extension point + how-tos; TC-ZAI-071 passes.
- Must: `ados_distribution` markers valid; `test-doc-distribution.sh` green.

**Affected code areas**: none.

**System docs to update**:

- `doc/guides/zai-peak-hours-hook.md` (updated — quota + extensibility sections).
- `doc/templates/blueprints/zai-peak-hours-hook--install.sh` (updated — info
  messages only if needed).
- `doc/spec/features/feature-autonomous-delivery.md` — **phase-7 `@doc-syncer`
  review item (F-6)**: currently says the Z.AI hook "waits for 10:00 UTC during peak
  window"; needs a one-line addition noting the opt-in quota condition. Not authored
  in Phase 4; flagged here for `@doc-syncer` reconciliation after delivery.

**Tests**:

- `bash scripts/.tests/test-hook-zai-example.sh` — TC-ZAI-071 now passes.
- `bash scripts/.tests/test-doc-distribution.sh` — green.

**Completion signal**: `docs(GH-150): quota section + extensibility/condition-function contract in guide`

---

### Phase 5: Verify (quality gates per AGENTS.md / repo conventions)

**Goal**: Run all quality gates, confirm no unrelated scope was touched, verify
secret hygiene, and confirm no Claude plugin rebuild is needed.

**Dependencies**: All prior phases (1–4). This is the gating phase.

**Tasks**:

- [ ] **5.1** Run the hook suite: `bash scripts/.tests/test-hook-zai-example.sh`
  — every TC-ZAI-001..071 + TC-HOOK-015..018 green.
- [ ] **5.2** Run the aggregate: `bash scripts/test-all.sh` (includes
  `test-hook-regression.sh`, `test-ceo-loop.sh`, `test-deliver-ticket.sh`,
  `test-batch-deliver.sh` — the regression backbone that must stay green).
- [ ] **5.3** Run the doc-distribution gate: `bash scripts/.tests/test-doc-distribution.sh`.
- [ ] **5.4** Run ShellCheck + shfmt on touched scripts (`.ai/rules/bash.md` §13):
  `shellcheck scripts/hooks/pre-opencode-iteration-zai.sh scripts/.tests/test-hook-zai-example.sh`;
  `shfmt -i 2 -ci -bn -d` on the same. Fix or document exceptions inline.
- [ ] **5.5** Confirm **no agent/command files changed** → the Claude plugin
  build/sync (`scripts/build-claude-plugin.sh`) is NOT needed; `.ados-claude/` is
  untouched (AGENTS.md: never hand-edit `.ados-claude/`).
- [ ] **5.6** Confirm license headers: `scripts/hooks/` is **not** in the
  `add-header-location.sh` scope (default paths = `.opencode/agent`,
  `.opencode/command`, `doc/guides`, `doc/documentation-handbook.md`, `tools`);
  the existing hook intentionally has no header and none is required. The guide
  already carries its header. Confirm no spurious header was added to the hook or
  test file.
- [ ] **5.7** Security final check (C-8, DEC-10): confirm `set-evn.sh` is not
  staged (`git status`); grep the full diff for the fake/real key and raw body to
  assert absence; confirm only the intended files (hook, test, guide, blueprint)
  are touched.

**Acceptance Criteria**:

- Must: all suites + aggregate + doc-distribution gate green; ShellCheck/shfmt
  clean.
- Must: no agent files changed; `.ados-claude/` untouched; no spurious headers.
- Must: `set-evn.sh` never staged; no full key / raw body in the diff.

**Affected code areas**: only fixes surfaced by the gates (if any).

**System docs to update**: none beyond Phase 4.

**Tests**:

- `bash scripts/.tests/test-hook-zai-example.sh`
- `bash scripts/test-all.sh`
- `bash scripts/.tests/test-doc-distribution.sh`
- ShellCheck + shfmt on touched scripts.

**Completion signal**: `chore(GH-150): verify quality gates (tests, aggregate, doc-distribution, shellcheck)`

---

## Test Scenarios

Source of truth: `chg-GH-150-test-plan.md` (TC-ZAI-001..071 + TC-HOOK-015..018).
The table maps every case/group to its implementation phase(s) and ACs.

| TC ID / Group | Scenario (short) | Phase(s) | AC / NFR |
|---------------|------------------|----------|----------|
| TC-HOOK-015..018 | Existing peak/portability/model-selection assertions (preserved) | 1 (keep green), 3 (extend 015→055) | AC-F2-1, NFR-2 |
| TC-ZAI-001 | Non-zai model → no sleep, no condition evaluated | 1, 3 | AC-F1-1 |
| TC-ZAI-002..005 | zai off-peak / in-peak / in-buffer / custom window | 1, 3 | AC-F2-1 |
| Group B (TC-ZAI-010..020) | Quota fail-open → 0 + one WARN; peak still applies | 2, 3 | AC-F3-3, NFR-4 |
| Group B′ (TC-ZAI-021..025) | Silent opt-out (no key / no jq / no curl / disabled) | 2, 3 | AC-F3-1, AC-NFR3-1, NFR-3, NFR-5 |
| Group C (TC-ZAI-030..037) | Exhaustion detection (pct<100/5h/weekly/both/TIME-only/==100/>100/past) | 2, 3 | AC-F3-2 |
| Group D (TC-ZAI-040..042) | Combined peak+quota MAX composition | 1, 2, 3 | AC-F1-2, DM-5 |
| Group E (TC-ZAI-045..046) | Toggles: disabled=1 no fetch; no cache in v1 | 2, 3 | AC-F3-4, AC-NFR8-1, NFR-8 |
| Group F (TC-ZAI-050..052) | Safety: no full key; no raw body; fail-open exit 0 | 2, 3 | AC-F5-1, NFR-7, NFR-4 |
| Group G (TC-ZAI-055..056) | Portability: format_utc_epoch sans GNU date; peak-path grep | 1, 3 | AC-F2-1, NFR-2, DEC-6 |
| Group H (TC-ZAI-060..064) | Re-eval loop: cross-time / clear / past-reset / cap / fresh-fetch | 1, 2, 3 | AC-F1-2, DM-5, NFR-6, NFR-8 |
| TC-ZAI-070 | Whole suite via mocks → 0 real sleeps, 0 live network | 3 | AC-F4-1, NFR-1 |
| TC-ZAI-071 | Guide documents condition-function contract as extension point | 3 (assertion), 4 (guide) | AC-F6-1 |

### Regression suite (must remain green throughout)

- `bash scripts/.tests/test-hook-zai-example.sh` (this change's target)
- `bash scripts/.tests/test-hook-regression.sh`
- `bash scripts/.tests/test-ceo-loop.sh`
- `bash scripts/.tests/test-deliver-ticket.sh`
- `bash scripts/.tests/test-batch-deliver.sh`
- `bash scripts/test-all.sh` (aggregate)

## Acceptance Criteria Coverage (every AC in spec §17 covered by ≥1 task)

| AC ID | Criterion (short) | Owning phase(s) | Task(s) |
|-------|-------------------|-----------------|---------|
| AC-F1-1 | Non-`zai-coding-plan/*` → no sleep, no conditions evaluated | 1 | 1.4, 3.3 (TC-ZAI-001) |
| AC-F1-2 | MAX across conditions + re-eval loop; `ADOS_ZAI_MAX_SLEEP_LOOPS` cap | 1, 2, 3 | 1.3, 1.4, 2.7, 3.7, 3.11 |
| AC-F2-1 | Peak sleeps to peak_end; off-peak → 0; `format_utc_epoch` sans GNU date | 1, 3 | 1.5, 3.3, 3.10 |
| AC-F3-1 | No key / no jq / no curl → silent opt-out; peak still applies | 2, 3 | 2.3, 3.5 |
| AC-F3-2 | Any TOKENS_LIMIT pct>=100 → soonest nextResetTime (clamped); TIME ignored | 2, 3 | 2.4, 3.6 |
| AC-F3-3 | Fetch fails → 0 + one WARN; peak applies; exit unchanged | 2, 3 | 2.5, 3.4 |
| AC-F3-4 | `ADOS_ZAI_QUOTA_DISABLED=1` + key → 0, no fetch | 2, 3 | 2.3, 3.8 |
| AC-F4-1 | Seams override clock/sleep/HTTP → deterministic suite, 0 live/0 sleep | 1, 2, 3 | 1.1 (seams), 2.1, 3.1, 3.12 |
| AC-F5-1 | stderr/stdout never full key; never raw body in production | 2, 3 | 2.6, 3.9 |
| AC-F6-1 | Guide documents condition-function contract + how-to | 3, 4 | 3.13, 4.2 |
| AC-NFR3-1 | Non-opt-in → peak path spawns 0 jq, 0 network | 2, 3 | 2.7, 3.5 (TC-ZAI-021) |
| AC-NFR8-1 | v1: ≤1 fetch per re-eval iteration; no cross-invocation cache | 2, 3 | 2.2, 2.7, 3.8, 3.11 |

## Phase Dependency Summary

```
Phase 0 (preflight) ──► Phase 1 (driver + contract + peak refactor) ──► Phase 2 (quota condition + seam)
                                                                              │
                                                                              ▼
                                   Phase 3 (test matrix TC-ZAI-001..071) ◄─────┘
                                                                              │
                                          TC-ZAI-071 depends on ──────────────► Phase 4 (docs: guide + blueprint)
                                                                              │
                                                                              ▼
                                                              Phase 5 (verify: gates)  [gates on 1–4]
```

- **Sequential**: 0 → 1 → 2 → 3. Phase 1 must land before Phase 2 (driver before
  a second condition); Phase 2 must land before Phase 3 (hook complete before the
  matrix asserts against it).
- **Cross-phase dependency (Flag-1)**: TC-ZAI-071 (Phase 3.13) can only pass
  after the Phase 4 guide update. Sequence Phase 4 before re-running the full
  suite in Phase 5, or accept TC-ZAI-071 as the one pending case after Phase 3.
- **Gating**: Phase 5 runs last and gates on the full suite + aggregate +
  doc-distribution + ShellCheck/shfmt.

## Artifacts and Links

| Artifact | Location | Type |
|----------|----------|------|
| Change specification | `./chg-GH-150-spec.md` | Spec |
| Test plan | `./chg-GH-150-test-plan.md` | Test plan (TC-ZAI-001..071 + TC-HOOK-015..018) |
| PM notes (decisions + matrix) | `./chg-GH-150-pm-notes.yaml` | Binding planning context |
| Implementation plan | `./chg-GH-150-plan.md` (this file) | Plan |
| Validated POC | `./quota-check-poc.sh` | Ground-truth endpoint/fields (API-1) |
| Hook under change | `scripts/hooks/pre-opencode-iteration-zai.sh` | Code |
| Test target | `scripts/.tests/test-hook-zai-example.sh` | Test code |
| Guide (docs AC) | `doc/guides/zai-peak-hours-hook.md` | Guide |
| Install blueprint | `doc/templates/blueprints/zai-peak-hours-hook--install.sh` | Blueprint |
| Hook contract (origin) | `doc/decisions/TDR-0002-pre-iteration-hook-contract-details.md` | Accepted R2 decision |
| Bash coding rules | `.ai/rules/bash.md` | Rule (MUST read before editing bash) |
| Testing strategy | `.ai/rules/testing-strategy.md` | Rule |

## Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-04 | @plan-writer (fallback) | Initial plan (Proposed). 6 phases (0–5) covering F-1..F-6 + NFR-1..NFR-8. Authored from the GH-150 spec (§5 capabilities, §8 DM-1/3/4/5/6 + API-1, §9 NFRs, §17 ACs, Decision Log DEC-1..11, NG-1..NG-7), the GH-150 test plan (TC-ZAI-001..071 + TC-HOOK-015..018, §5 fixture catalog, §3.2 seam-mocking, §10.3 flags), `chg-GH-150-pm-notes.yaml` (groups A–H), direct reads of `scripts/hooks/pre-opencode-iteration-zai.sh` (71-line hook + seams) and `scripts/.tests/test-hook-zai-example.sh` (24-line test + sourcing pattern), the guide + blueprint to update, `.ai/rules/bash.md`, and the GH-146/GH-148 plans (house style). Implementation-free (tasks + verification only, no bash code). Every spec AC (AC-F1-1 .. AC-NFR8-1) and every test group (A–H + meta/docs) covered by ≥1 task. Cross-phase dependency flagged (TC-ZAI-071 ↔ Phase 4 guide). Per-phase Conventional Commit via `@committer`; PM does not commit delivery phases. |
| 1.1 | 2026-08-04 | DoR iter-1 remediation (@readiness-reviewer finding F-6) | Added `doc/spec/features/feature-autonomous-delivery.md` to Phase 4 "System docs to update" + new task 4.5, marked as a delivery-lifecycle phase-7 `@doc-syncer` review item (one-line addition noting the opt-in quota condition; the doc currently describes the Z.AI hook as "wait for 10:00 UTC during peak window"). Not a Phase 4 authoring task. |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| Phase 0 | — | — | — | — | — |
| Phase 1 | — | — | — | — | — |
| Phase 2 | — | — | — | — | — |
| Phase 3 | — | — | — | — | — |
| Phase 4 | — | — | — | — | — |
| Phase 5 | — | — | — | — | — |
