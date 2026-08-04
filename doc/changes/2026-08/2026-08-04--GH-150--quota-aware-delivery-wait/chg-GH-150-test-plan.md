---
id: chg-GH-150-test-plan
status: Proposed
created: 2026-08-04T00:00:00Z
last_updated: 2026-08-04T00:00:00Z
owners: ["Juliusz Ćwiąkalski"]
service: delivery-os
labels: ["autonomous-delivery", "quota", "hooks", "zai", "extensibility"]
version_impact: minor
summary: "Make the Z.AI pre-iteration hook quota-aware so delivery waits for quota reset instead of restart-storming"
links:
  change_spec: ./chg-GH-150-spec.md
  implementation_plan: ./chg-GH-150-plan.md
  testing_strategy: ../../.ai/rules/testing-strategy.md
  bash_rules: ../../.ai/rules/bash.md
---

# Test Plan - Quota-aware Z.AI pre-iteration hook with pluggable condition-driver

## 1. Scope and Objectives

This test plan validates the refactor of `scripts/hooks/pre-opencode-iteration-zai.sh` into a generic sleep-driver plus two condition functions (`howLongToSleepDueToPeakHours` and `howLongToSleepDueToQuotaExhaustion`), the new opt-in/fail-open Z.AI token-quota condition, the re-evaluation loop that composes conditions correctly across elapsed time, and the secret-handling guarantees — all proven through deterministic, hermetic tests with **zero live network calls and zero real sleeps**.

The protected core behaviors are: (a) byte-identical peak-hours delivery for users who do not opt into quota checking; (b) correct exhaustion detection (`percentage >= 100` on any `TOKENS_LIMIT`) and sleep-until-soonest-reset math; (c) fail-open discipline (exactly one `[WARN]`, exit status never altered, peak still applies); (d) silent opt-out (no key / missing `jq`/`curl` / `ADOS_ZAI_QUOTA_DISABLED=1`); (e) correct MAX-composition + re-evaluation across elapsed time; and (f) full `ZAI_API_KEY` and raw response body never reach logs.

The motivating regression is the restart-storm: an exhausted quota misread as a liveness stall. The quota condition must pre-empt at `percentage >= 100` and sleep until reset, so the wrapper never kill/restarts work a restart cannot fix.

### 1.1 In Scope

- Peak-hours regression under the new driver (group A), including the existing UTC-boundary / seconds-until-window-end / portable-formatter assertions preserved unchanged.
- Generic driver gate: non-`zai-coding-plan/*` model evaluates no conditions and returns immediately (AC-F1-1).
- MAX-composition across conditions and the re-evaluation loop, including the `ADOS_ZAI_MAX_SLEEP_LOOPS` cap (AC-F1-2).
- Quota fail-open catalog (group B): curl/network failure, HTTP 401/403, non-200 envelope (`code != 200`, `success != true`), malformed JSON, `data.limits` absent/non-array, non-numeric `percentage`, exhausted entry with absent/malformed/unparseable `nextResetTime` and no other valid exhausted entry — each yielding return `0` + exactly one `[WARN]`, with peak still applying.
- Silent opt-out (group B′): `ZAI_API_KEY` unset, `jq` missing, `curl` missing, `ADOS_ZAI_QUOTA_DISABLED=1` — return `0`, zero quota stderr, no fetch.
- Exhaustion detection (group C): `pct<100` → 0; no `TOKENS_LIMIT` entry (TIME_LIMIT-only or `[]`) → 0 (no WARN); 5h `pct>=100`; weekly `pct>=100`; both → soonest (min over EXHAUSTED entries; a non-exhausted entry's earlier reset is IGNORED); mixed valid/bad reset among exhausted → use the good one (no WARN); `TIME_LIMIT`-only ignored; `pct==100` boundary; `pct>100` overage; past `nextResetTime` clamped to 0.
- Combined peak+quota (group D): MAX composition when both active; peak-only; quota-only.
- Toggles (group E): `ADOS_ZAI_QUOTA_DISABLED=1` performs no fetch; no file cache in v1.
- Safety/hygiene (group F): full `ZAI_API_KEY` never logged (prefix/suffix only); raw response body never logged (no debug/verbose toggle in v1); fail-open keeps exit 0 off-peak.
- Portability (group G): `format_utc_epoch` correct without GNU `date -d`; the `! grep -q 'date -.*-d'` assertion preserved for the peak path (`jq` allowed in the quota path).
- Re-evaluation loop (group H): cross-time composition (quota sleep lands in peak), condition-cleared return, past-reset → 0 (no infinite loop), `ADOS_ZAI_MAX_SLEEP_LOOPS` cap, fresh fetch each iteration.
- NFR coverage NFR-1..NFR-8.
- Documentation contract (AC-F6-1): the guide documents the condition-function contract as the extension point.

### 1.2 Out of Scope & Known Gaps

- Wrapper-level quota handling in `deliver-ticket.sh` / `ceo-loop.sh` (superseded — NG-1).
- A file-based cross-invocation quota cache and the `ADOS_ZAI_QUOTA_CACHE_SECONDS` knob (NG-2). Only a negative assertion (no cache file written, one fetch per iteration) is in scope.
- Non-Z.AI providers (NG-3) and `TIME_LIMIT` exhaustion semantics (NG-4) — the latter is covered only by a "ignored" assertion.
- Waiting for HTTP 429 (NG-5); the quota condition pre-empts at `percentage >= 100`.
- Interrupting an in-flight OpenCode session when quota exhausts mid-run (NG-6).
- Any change to the GH-146 / TDR-0002 hook invocation contract or `ADOS_HOOK_ENV_V1` return protocol (NG-7).
- The exact `[INFO]`/`[WARN]` log wording (open OQ-1). Tests pin the **behavioral** contract (reason + UTC wake time on sleep; exactly one `[WARN]` category per failure; redaction) and must tolerate whatever final string @coder settles on. Tests must not hard-code a specific reason phrase beyond the reason category tokens enumerated in §5.

## 2. References

- **Change Specification (authoritative for ACs)**: `doc/changes/2026-08/2026-08-04--GH-150--quota-aware-delivery-wait/chg-GH-150-spec.md` — §17 acceptance criteria (AC-F1-1 .. AC-NFR8-1), condition-function contract (DM-1), exhaustion rule + fail-open catalog (DM-3), env vars (DM-4), re-eval loop (DM-5), seam contract (DM-6), NFRs (§9), Appendix C test matrix (groups A–H), data contract (API-1).
- **PM Notes (required test matrix)**: `doc/changes/2026-08/2026-08-04--GH-150--quota-aware-delivery-wait/chg-GH-150-pm-notes.yaml`.
- **Testing Strategy**: `.ai/rules/testing-strategy.md`.
- **Bash Rules**: `.ai/rules/bash.md` (§10 testability, §11 embedded test framework).
- **GH-146 Test Plan** (format reference + hook-contract origin): `doc/changes/2026-07/2026-07-15--GH-146--quota-aware-pre-iteration-hooks/chg-GH-146-test-plan.md`.
- **GH-148 Test Plan** (most recent house-style reference): `doc/changes/2026-07/2026-07-28--GH-148--platform-aware-delivery-scripts/chg-GH-148-test-plan.md`.
- **Target file to extend (existing)**: `scripts/.tests/test-hook-zai-example.sh` — already sources the hook and asserts peak/portability behavior; new cases are added here.
- **Hook under change**: `scripts/hooks/pre-opencode-iteration-zai.sh` — existing seams `_now_utc_epoch()` / `_sleep()` / `format_utc_epoch`; the new `_zai_quota_fetch()` seam is added here.
- **Guide (docs AC)**: `doc/guides/zai-peak-hours-hook.md`.

## 3. Test Strategy

### 3.1 Determinism contract (NFR-1, AC-F4-1)

Every test is hermetic: **0 live network calls** (no test reaches `api.z.ai`) and **0 real sleeps** (no test calls the real `sleep`). All time, sleep, and HTTP are injected via the three seams. The suite is CI-safe and scheduler-insensitive — no assertion depends on wall-clock pacing.

### 3.2 Seam-mocking mechanism (DM-6, F-4)

Tests reuse and extend the existing sourcing pattern in `scripts/.tests/test-hook-zai-example.sh`: the test file `source`s the hook (so all functions, including `main` and the condition functions, are in scope), then **redefines the seam functions** before invoking `main` or a condition function directly. Because the hook only auto-runs `main` when executed (not when sourced), tests call `main` explicitly with a controlled environment.

Three seams are overridden:

| Seam | Production behavior | Test override |
|------|---------------------|---------------|
| `_now_utc_epoch()` | `date -u +%s` | Returns a fixed epoch, or a *stepping clock* that advances by the sum of prior `_sleep` arguments so the re-evaluation loop observes elapsed time. |
| `_sleep(seconds)` | `sleep "$1"` | Records the seconds argument to a per-test **sleep log** (a reset-before-each-test variable or temp file) and returns immediately without sleeping. |
| `_zai_quota_fetch()` | wraps `curl`; returns HTTP status code + response body (DM-6) | Returns a canned `(http_code, body)` pair from the Fixture Catalog (§5). The exact stdout/exit encoding of the pair is @coder's choice; tests follow whatever the seam contract specifies. |

Additional overrides used by specific cases:

- **`jq` recorder/stub**: to prove the no-key path spawns 0 `jq` processes (AC-NFR3-1), tests wrap `jq` in a function that increments a call counter (and delegates to the real `jq` when needed). The counter is asserted to stay `0` on opt-out paths.
- **`command -v` stubs**: to simulate missing `jq` or `curl` (groups B′), tests override `command -v` (or the hook's dependency probe) to report the tool absent.
- **`_zai_quota_fetch` call counter**: a wrapper that increments per call, used to prove one-fetch-per-iteration (NFR-8) and fresh-fetch-each-iteration (group H).

### 3.3 Sourcing pattern (preserved + extended)

New tests use the **same** `source "${SCRIPT_DIR}/hooks/pre-opencode-iteration-zai.sh"` line already present, the same `check 'TC-… name' test_fn` harness, and the same pass/fail counters. The four existing assertions (`TC-HOOK-015` portable formatter, `TC-HOOK-016` UTC boundaries, `TC-HOOK-017` seconds-until-window-end, `TC-HOOK-018` model selection) remain **unchanged** as the group-A regression backbone.

### 3.4 Custom peak-env testability note (flag for @coder)

The existing hook declares `ADOS_ZAI_PEAK_START_UTC` / `ADOS_ZAI_PEAK_END_UTC` / `ADOS_ZAI_BUFFER_SECONDS` `readonly` at source time. TC-ZAI-005 (custom peak vars) therefore re-`source`s the hook inside a subshell with the custom env exported, so the readonly bindings take the custom values at source time. If @coder refactors these to be read lazily inside the peak condition, the test simplifies to a plain override — either is acceptable. No behavioral change is implied.

### 3.5 Behavioral pinning, not byte pinning (OQ-1)

Tests assert the **observable contract**: the recorded `_sleep` argument sequence, the `main` return status, the **count** of `[WARN]`/`[INFO]` lines, the presence of a reason **category token** (e.g. `HTTP 401`, `malformed JSON`, `nextResetTime`), and the UTC wake time computed by `format_utc_epoch`. Tests must not assert exact full log lines.

## 4. Test Environment

- **Environment**: local-dev / CI. Bash 4.0+. `jq` and `curl` are present in CI (they are framework-wide dependencies), but **the quota path is fully mocked** via `_zai_quota_fetch`, so neither is actually exercised against a network. Real `jq` may be used by tests only to sanity-check fixture validity during authoring; runtime assertions do not depend on it.
- **No live network**: no test contacts `api.z.ai` or any external host. The `_zai_quota_fetch` seam is the only network boundary and it is always overridden.
- **No real sleeps**: the `_sleep` seam is always overridden; the real `sleep` binary is never invoked by the suite.
- **Temp state / isolation**: each test runs in the same process (functions redefined per test) with sleep logs and counters reset before each test. Tests that mutate environment (`ZAI_API_KEY`, `ADOS_ZAI_QUOTA_DISABLED`, `ADOS_ZAI_MAX_SLEEP_LOOPS`, model env) scope the mutation to the test (subshell or explicit unset) so no test leaks into another. No real git remote, forge, or OpenCode session is touched.
- **Secret fixture**: tests use a distinctive **fake** key only (see F-SECRET in §5). The owner's real key in `set-evn.sh` is never referenced by any test.

## 5. Fixture Catalog (canned Z.AI JSON variants)

All fixtures are data (JSON literals), not code. Unless noted, the envelope is `{"code":200,"msg":"Operation successful","success":true,"data":{...}}` and the mock returns HTTP code `200` with the body. `nextResetTime` values are **epoch-milliseconds UTC** (API-1). Concrete numbers below assume a base "now" of `N0 = 1784940000` (UTC seconds-of-day `2400` = 00:40 UTC, off-peak) where quota math is needed; tests that need a different clock set `_now_utc_epoch` explicitly.

**Arithmetic anchor (F-1 remediation):** `N0 = 1784940000` → `1784940000 % 86400 = 2400` → seconds-of-day `2400` = 00:40 UTC, **off-peak** (`2400 ∉ [14400,36000)`). `N0 + 12600 = 1784952600` → seconds-of-day `15000` = inside peak `[14400,36000)`. `peak_wait = 36000 − 15000 = 21000` ⇒ TC-ZAI-060 cross-time sleep log = `[12600, 21000]` ✓. (Every synthetic `nextResetTime` below is anchored to this `N0`; only F-5H-FAR uses an independent `now = 1767240600`, and F-OFF keeps the live ground-truth numbers, which are not asserted.)

### 5.1 Valid-shape quota bodies

- **F-OFF** — not exhausted (all `TOKENS_LIMIT` `percentage < 100`):
  `data.level=max`; `limits` = TIME_LIMIT(pct 1) + TOKENS_LIMIT(unit 3/number 5, pct 3, nextResetTime 1785841303288) + TOKENS_LIMIT(unit 6/number 1, pct 61, nextResetTime 1786258872998). Expected quota wait: `0`.
- **F-5H** — 5h window exhausted, weekly ok: TOKENS_LIMIT(unit 3/number 5, **pct 100**, nextResetTime **1784947200000**) + TOKENS_LIMIT(unit 6/number 1, pct 61, …). With now `N0`, expected quota wait `7200`.
- **F-WEEK** — weekly exhausted, 5h ok: TOKENS_LIMIT(unit 3/number 5, pct 3, …) + TOKENS_LIMIT(unit 6/number 1, **pct 100**, nextResetTime **1785026400000**). Expected quota wait `86400`.
- **F-BOTH** — both exhausted: 5h pct 100 (nextResetTime 1784947200000) + weekly pct 100 (nextResetTime 1785026400000). Soonest = 5h; expected quota wait `7200`.
- **F-TIME-ONLY** — TIME_LIMIT exhausted, tokens ok: TIME_LIMIT(**pct 100**, …) + TOKENS_LIMIT(pct 3) + TOKENS_LIMIT(pct 61). Expected quota wait `0` (TIME_LIMIT ignored).
- **F-OVERAGE** — pct > 100: TOKENS_LIMIT(unit 3/number 5, **pct 105**, nextResetTime 1784947200000) + weekly pct 61. Expected quota wait `7200`.
- **F-PAST** — exhausted with nextResetTime in the past: TOKENS_LIMIT(unit 3/number 5, pct 100, nextResetTime **1784939900000**) (= `(N0 − 100) × 1000`). Expected quota wait `0` (clamped).
- **F-5H-FAR** — 5h exhausted with a far reset (for MAX-composition): TOKENS_LIMIT(unit 3/number 5, pct 100, nextResetTime **1767270600000**) used with now `1767240600` (in-peak); expected quota wait `30000`. (Independent of `N0`.)
- **F-CROSS** — 5h exhausted landing reset inside peak (for re-eval cross-time): TOKENS_LIMIT(unit 3/number 5, pct 100, nextResetTime **1784952600000**) used with now `N0`; expected quota wait `12600` (lands at seconds-of-day `15000`, inside the default peak window `[14400,36000)`).
- **F-NO-TOKENS** — no `TOKENS_LIMIT` entry: `data.limits` = a single `TIME_LIMIT` entry only (or `[]`). Valid shape, no token window to exhaust; expected quota wait `0` and **0** `[WARN]` (proceed, NOT fail-open). (F-8)
- **F-MIXED-RESET** — mixed valid/bad reset among exhausted entries: 5h `pct=100` with a BAD `nextResetTime` (`"soon"`) + weekly `pct=100` with a GOOD `nextResetTime` (`1785026400000`, wait `86400`). Expected quota wait `86400` (uses the good weekly reset, ignoring the bad 5h one); **0** `[WARN]` (NOT fail-open — a valid exhausted reset exists). (F-2)
- **F-NONEXH-EARLIER** — non-exhausted earlier reset ignored: EXHAUSTED 5h entry (`pct=100`, `nextResetTime 1784947200000`, wait `7200`) + NON-exhausted weekly entry (`pct=50`, `nextResetTime 1784942400000` = wait `2400`, EARLIER than the exhausted one). Expected quota wait `7200` (the exhausted entry's LATER reset is used; the non-exhausted entry's earlier reset is IGNORED — min is over EXHAUSTED entries only). (F-3)

### 5.2 Fail-open bodies / transports (group B)

- **F-NET-FAIL** — curl/network failure: the `_zai_quota_fetch` mock returns the "transport-failed" indicator (e.g. http code `000` / non-zero exit per the seam contract), with any (empty) body.
- **F-401** — HTTP 401 (body irrelevant, e.g. empty).
- **F-403** — HTTP 403.
- **F-ENV-500** — HTTP 200 transport but envelope `code=500`, `success=true`.
- **F-ENV-SUCCESS-FALSE** — envelope `code=200`, `success=false`.
- **F-MALFORMED** — HTTP 200, body is syntactically invalid JSON, e.g. `{"code":200,"success":true,"data":{"level":"max","limits":[ ` (truncated).
- **F-NO-LIMITS** — envelope ok, `data.limits` absent: `{"code":200,"success":true,"data":{"level":"max"}}`.
- **F-LIMITS-NOT-ARRAY** — `data.limits` is an object, not an array: `{"code":200,"success":true,"data":{"level":"max","limits":{}}}`.
- **F-PCT-NON-NUMERIC** — a TOKENS_LIMIT entry with `"percentage":"abc"` (string), reset present.
- **F-RESET-ABSENT** — exhausted entry (pct 100) with **no** `nextResetTime`, and no other exhausted entry.
- **F-RESET-MALFORMED** — exhausted entry (pct 100) with `"nextResetTime":"soon"`.
- **F-RESET-UNPARSEABLE** — exhausted entry (pct 100) with `"nextResetTime":null`.

### 5.3 Secret/hygiene fixtures (group F)

- **F-SECRET** — the fake API key used by every opted-in test: `zai-fake-secret-AAAAAAAA-BBBB-CCCC-DDDD-1234567890ab` (set as `ZAI_API_KEY`). It is long and distinctive so an exact-match absence assertion is meaningful; only a short prefix/suffix may ever appear in diagnostics.
- **F-CANARY** — a valid-shape body (e.g. F-5H) with a distinctive canary string embedded in an informational field (e.g. `data.level` = `"max-CANARY-ACCOUNT-ID-XYZ"`). Used to prove the raw body never reaches logs (there is no debug/verbose toggle in v1).

## 6. Test Cases

Test-case IDs use the `TC-ZAI-NNN` prefix for new cases. The four pre-existing peak/portability assertions are retained as `TC-HOOK-015..018` (group A regression backbone) and are referenced but not re-specified. `Type`: U = unit, I = integration, B = behavior. All assertions use the embedded framework from `.ai/rules/bash.md` §11.

### 6.1 Scenario Index

| TC ID | Title | Group | Type | Priority | AC / F / NFR |
|-------|-------|-------|------|----------|--------------|
| TC-ZAI-001 | Non-zai model → no sleep, no condition evaluated | A | U | High | AC-F1-1, F-1 |
| TC-ZAI-002 | zai off-peak → no sleep, return 0 | A | U | High | AC-F2-1 |
| TC-ZAI-003 | zai in-peak → `_sleep` = seconds-until-peak_end | A | U | High | AC-F2-1 |
| TC-ZAI-004 | zai in buffer → `_sleep` to peak_end | A | U | High | AC-F2-1 |
| TC-ZAI-005 | Custom `ADOS_ZAI_PEAK_*` / `BUFFER_SECONDS` window | A | U | Medium | AC-F2-1 |
| TC-ZAI-010 | curl/network failure → return 0, one WARN | B | U | High | AC-F3-3, NFR-4 |
| TC-ZAI-011 | HTTP 401 → return 0, one WARN | B | U | High | AC-F3-3, NFR-4 |
| TC-ZAI-012 | HTTP 403 → return 0, one WARN | B | U | High | AC-F3-3, NFR-4 |
| TC-ZAI-013 | Envelope `code != 200` → return 0, one WARN | B | U | High | AC-F3-3, NFR-4 |
| TC-ZAI-014 | Envelope `success != true` → return 0, one WARN | B | U | High | AC-F3-3, NFR-4 |
| TC-ZAI-015 | Malformed JSON → return 0, one WARN | B | U | High | AC-F3-3, NFR-4 |
| TC-ZAI-016 | `data.limits` absent / non-array → return 0, one WARN | B | U | High | AC-F3-3, NFR-4 |
| TC-ZAI-017 | Non-numeric `percentage` → return 0, one WARN | B | U | High | AC-F3-3, NFR-4 |
| TC-ZAI-018 | Exhausted entry, bad `nextResetTime`, no other valid → return 0, one WARN | B | U | High | AC-F3-3, NFR-4 |
| TC-ZAI-019 | Fail-open + peak active → peak still applies (sleep = peak_wait) | B | I | High | AC-F3-3, NFR-4 |
| TC-ZAI-020 | Each active failure emits exactly one `[WARN]` (count) | B | U | High | AC-F3-3, NFR-4 |
| TC-ZAI-021 | `ZAI_API_KEY` unset → silent, no fetch, 0 `jq` | B′ | U | High | AC-F3-1, AC-NFR3-1, NFR-3, NFR-5 |
| TC-ZAI-022 | `jq` missing → silent, no fetch | B′ | U | High | AC-F3-1, NFR-5 |
| TC-ZAI-023 | `curl` missing → silent, no fetch | B′ | U | High | AC-F3-1, NFR-5 |
| TC-ZAI-024 | `ADOS_ZAI_QUOTA_DISABLED=1` + key → silent, no fetch | B′/E | U | High | AC-F3-1, AC-F3-4, NFR-5 |
| TC-ZAI-025 | Opt-out + peak active → peak applies, zero quota stderr | B′ | I | High | AC-F3-1, NFR-5 |
| TC-ZAI-029 | No `TOKENS_LIMIT` entry (TIME_LIMIT-only or `[]`) → 0, no WARN | C | U | High | AC-F3-2 |
| TC-ZAI-030 | All `TOKENS_LIMIT` pct<100 → 0 | C | U | High | AC-F3-2 |
| TC-ZAI-031 | 5h pct>=100 (weekly<100) → sleep to 5h reset | C | U | High | AC-F3-2, DM-2 |
| TC-ZAI-032 | weekly pct>=100 (5h<100) → sleep to weekly reset | C | U | High | AC-F3-2, DM-2 |
| TC-ZAI-033 | Both >=100 → sleep to soonest (min) reset | C | U | High | AC-F3-2, DM-3 |
| TC-ZAI-034 | `TIME_LIMIT` exhausted only → no sleep (ignored) | C | U | High | AC-F3-2, NG-4 |
| TC-ZAI-035 | pct == 100 boundary → exhausted | C | U | High | AC-F3-2 |
| TC-ZAI-036 | pct > 100 (e.g. 105) → exhausted | C | U | High | AC-F3-2 |
| TC-ZAI-037 | `nextResetTime` in past → clamp wait to 0 | C | U | High | AC-F3-2, RSK-2 |
| TC-ZAI-038 | Mixed valid/bad reset among exhausted → uses good reset, 0 WARN | C | U | High | AC-F3-2 |
| TC-ZAI-039 | Non-exhausted earlier reset ignored → min over EXHAUSTED entries only | C | U | High | AC-F3-2 |
| TC-ZAI-040 | In-peak AND quota exhausted → `_sleep` = max(peak,quota) | D | I | High | AC-F1-2, DM-5 |
| TC-ZAI-041 | In-peak AND quota OK → peak only | D | I | High | AC-F1-2 |
| TC-ZAI-042 | Off-peak AND quota exhausted → quota only | D | I | High | AC-F1-2 |
| TC-ZAI-045 | `ADOS_ZAI_QUOTA_DISABLED=1` + key → no fetch, return 0 | E | U | High | AC-F3-4, NFR-8 |
| TC-ZAI-046 | No file cache: no cache file; grep-hook-source `ADOS_ZAI_QUOTA_CACHE_SECONDS` absent; 1 fetch/iteration (2-iteration loop) | E | U | Medium | AC-NFR8-1, NFR-8 |
| TC-ZAI-050 | Full `ZAI_API_KEY` never in stdout/stderr (prefix/suffix only) | F | I | High | AC-F5-1, NFR-7 |
| TC-ZAI-051 | Raw response body never logged (canary; no debug toggle in v1) | F | I | High | AC-F5-1, NFR-7 |
| TC-ZAI-052 | Fail-open keeps exit 0 when off-peak | F | B | High | AC-F3-3, NFR-4 |
| TC-ZAI-055 | `format_utc_epoch` correct without GNU `date -d` | G | U | High | AC-F2-1, NFR-2 |
| TC-ZAI-056 | Whole-file `! grep -q 'date -.*-d'` preserved; quota reuses `format_utc_epoch`; @coder MUST NOT use `date -d` (POC trap) | G | U | High | AC-F2-1, NFR-2, DEC-6 |
| TC-ZAI-060 | Cross-time: quota sleep lands in peak → re-eval sleeps to peak_end | H | I | High | AC-F1-2, DM-5, RSK-7 |
| TC-ZAI-061 | Sleep a condition, re-eval clears → driver returns | H | I | High | AC-F1-2, DM-5 |
| TC-ZAI-062 | Past `nextResetTime` after sleeping → quota 0 on re-eval (no infinite loop) | H | I | High | AC-F1-2, DM-5, NFR-6, RSK-2 |
| TC-ZAI-063 | `ADOS_ZAI_MAX_SLEEP_LOOPS` exceeded → return 0 + one WARN | H | I | High | AC-F1-2, DM-5, NFR-6 |
| TC-ZAI-064 | Fresh fetch each iteration (>=2 calls across a 2-iteration loop) | H | I | High | AC-F1-2, DM-5, NFR-8 |
| TC-ZAI-070 | Whole suite runs via mocks → 0 real sleeps, 0 live network | meta | B | High | AC-F4-1, NFR-1 |
| TC-ZAI-071 | Guide documents condition-function contract as extension point | docs | B | Medium | AC-F6-1 |
| TC-HOOK-015..018 | Existing peak/portability/model-selection assertions (preserved) | A/G | U | High | AC-F2-1, NFR-2 |

### 6.2 Scenario Details (Given / When / Then)

Common setup unless overridden: `ADOS_HOOK_AGENT=ceo`; `OC_ADOS_AGENT_CEO_MODEL=zai-coding-plan/glm-5.2`; `ZAI_API_KEY` = F-SECRET; `jq` and `curl` reported present; `_sleep` records to a sleep log reset before the test; peak window is the default `[14400, 36000)` seconds-of-day (`[04:00, 10:00) UTC`).

#### Group A — Peak regression

**TC-ZAI-001** — Non-zai model → no sleep, no condition evaluated
- **Given** `OC_ADOS_AGENT_CEO_MODEL=other/x` (not `zai-coding-plan/*`), recorders installed on `_now_utc_epoch`, `_sleep`, and `_zai_quota_fetch`, and `_now_utc_epoch` set to an in-peak epoch.
- **When** `main` runs.
- **Then** it returns `0`; the sleep log is empty; **no** condition seam was invoked (`_now_utc_epoch` and `_zai_quota_fetch` recorders show zero calls from condition evaluation); no `[INFO]`/`[WARN]` line is emitted. (AC-F1-1)

**TC-ZAI-002** — zai off-peak → no sleep, return 0
- **Given** model is `zai-coding-plan/*`, key unset (so quota is opt-out), `_now_utc_epoch` = `JAN_1_2026 + 2400` (seconds-of-day 2400, off-peak).
- **When** `main` runs.
- **Then** it returns `0`; the sleep log is empty; no `[INFO]` sleep line. (AC-F2-1)

**TC-ZAI-003** — zai in-peak → `_sleep` = seconds-until-peak_end
- **Given** model `zai-coding-plan/*`, key unset, `_now_utc_epoch` = `JAN_1_2026 + 14400` (seconds-of-day 14400, inside `[14400,36000)`).
- **When** `main` runs.
- **Then** it returns `0`; the sleep log contains exactly one entry `21600` (= 36000 − 14400); stderr contains one `[INFO]` line naming the peak reason and the UTC wake time `2026-01-01T10:00:00Z`. (Mirrors existing `TC-HOOK-017`.) (AC-F2-1)

**TC-ZAI-004** — zai in buffer → `_sleep` to peak_end
- **Given** key unset, `_now_utc_epoch` = `JAN_1_2026 + 15000` (seconds-of-day 15000, inside the effective buffer-window but before peak start 21600).
- **When** `main` runs.
- **Then** it returns `0`; the sleep log entry is `21000` (= 36000 − 15000). (AC-F2-1)

**TC-ZAI-005** — Custom peak window
- **Given** the hook is re-sourced in a subshell with `ADOS_ZAI_PEAK_START_UTC=32400` (09:00 UTC), `ADOS_ZAI_PEAK_END_UTC=43200` (12:00 UTC), `ADOS_ZAI_BUFFER_SECONDS=3600`; key unset; `_now_utc_epoch` = an epoch at seconds-of-day `33000` (inside the custom effective window `[28800, 43200)`).
- **When** `main` runs.
- **Then** it returns `0`; the sleep log entry is `10200` (= 43200 − 33000), proving the custom knobs drive the window. (AC-F2-1)

#### Group B — Quota fail-open (active failure → exactly one WARN, return 0, peak still applies)

For TC-ZAI-010..018 the clock is **off-peak** (`_now_utc_epoch` = N0, seconds-of-day 2400) so only the quota condition is active, isolating the fail-open behavior. Each case sets the named fixture as the `_zai_quota_fetch` return.

**TC-ZAI-010** — curl/network failure
- **Given** `_zai_quota_fetch` returns the F-NET-FAIL transport-failed indicator.
- **When** `main` runs.
- **Then** it returns `0`; the sleep log is empty (off-peak); stderr contains **exactly one** `[WARN]` line with a network/curl reason category; no other `[WARN]`. (AC-F3-3, NFR-4)

**TC-ZAI-011** — HTTP 401
- **Given** `_zai_quota_fetch` returns F-401.
- **When** `main` runs.
- **Then** returns `0`; sleep log empty; exactly one `[WARN]` carrying the `HTTP 401` category. (AC-F3-3, NFR-4)

**TC-ZAI-012** — HTTP 403
- **Given** F-403.
- **When** `main` runs.
- **Then** returns `0`; exactly one `[WARN]` with the `HTTP 403` category. (AC-F3-3, NFR-4)

**TC-ZAI-013** — Envelope `code != 200`
- **Given** F-ENV-500 (HTTP 200 transport, envelope `code=500`).
- **When** `main` runs.
- **Then** returns `0`; exactly one `[WARN]` naming a non-200-envelope category. (AC-F3-3, NFR-4)

**TC-ZAI-014** — Envelope `success != true`
- **Given** F-ENV-SUCCESS-FALSE (envelope `code=200, success=false`).
- **When** `main` runs.
- **Then** returns `0`; exactly one `[WARN]` naming a non-success-envelope category. (AC-F3-3, NFR-4)

**TC-ZAI-015** — Malformed JSON
- **Given** F-MALFORMED.
- **When** `main` runs.
- **Then** returns `0`; exactly one `[WARN]` with the `malformed JSON` category. (AC-F3-3, NFR-4)

**TC-ZAI-016** — `data.limits` absent / non-array
- **Given** two sub-trials: F-NO-LIMITS then F-LIMITS-NOT-ARRAY.
- **When** `main` runs for each.
- **Then** each returns `0` with exactly one `[WARN]` naming a limits-absent/non-array category. (AC-F3-3, NFR-4)

**TC-ZAI-017** — Non-numeric `percentage`
- **Given** F-PCT-NON-NUMERIC.
- **When** `main` runs.
- **Then** returns `0`; exactly one `[WARN]` with a non-numeric-percentage category. (AC-F3-3, NFR-4)

**TC-ZAI-018** — Exhausted entry with bad `nextResetTime`, no other valid exhausted entry
- **Given** three sub-trials: F-RESET-ABSENT, F-RESET-MALFORMED, F-RESET-UNPARSEABLE.
- **When** `main` runs for each.
- **Then** each returns `0` with exactly one `[WARN]` carrying a `nextResetTime`-unparseable/absent category. (AC-F3-3, NFR-4) Note: if another exhausted entry in the same body yields a valid reset, the condition uses it (covered implicitly by F-BOTH); this case asserts the "no valid reset anywhere" branch.

**TC-ZAI-019** — Fail-open with peak active → peak still applies
- **Given** `_now_utc_epoch` = `JAN_1_2026 + 15000` (in-peak, peak_wait `21000`) and `_zai_quota_fetch` returns F-NET-FAIL.
- **When** `main` runs.
- **Then** returns `0`; the sleep log contains `21000` (peak wait applied independently); stderr contains exactly one quota `[WARN]` plus the peak `[INFO]` line. (AC-F3-3, NFR-4)

**TC-ZAI-020** — Exactly-one-`[WARN]` count across active failures
- **Given** each active-failure fixture from TC-ZAI-010..018 in turn.
- **When** `main` runs off-peak.
- **Then** for every fixture, the `[WARN]` line count on stderr is exactly `1` (never 0, never >1). This is the cross-cutting NFR-4 assertion; it may be implemented as a shared assertion inside each B case rather than a separate harness call. (AC-F3-3, NFR-4)

#### Group B′ — Silent opt-out (NO warn, return 0, peak still applies)

**TC-ZAI-021** — `ZAI_API_KEY` unset → silent, no fetch, 0 `jq`
- **Given** `ZAI_API_KEY` unset; `jq` and `_zai_quota_fetch` wrapped in call-counters; `_now_utc_epoch` off-peak.
- **When** `main` runs.
- **Then** returns `0`; sleep log empty; stderr has **zero** quota-related lines (no `[WARN]`, no `[INFO]`); the `_zai_quota_fetch` counter is `0`; the `jq` counter is `0` (no `jq` spawned — AC-NFR3-1). (AC-F3-1, AC-NFR3-1, NFR-3, NFR-5)

**TC-ZAI-022** — `jq` missing → silent, no fetch
- **Given** key set; `command -v jq` stubbed to report absent; `_zai_quota_fetch` counter installed.
- **When** `main` runs.
- **Then** returns `0`; zero quota stderr; fetch counter `0`. (AC-F3-1, NFR-5)

**TC-ZAI-023** — `curl` missing → silent, no fetch
- **Given** key set; `jq` present; `command -v curl` stubbed absent; fetch counter installed.
- **When** `main` runs.
- **Then** returns `0`; zero quota stderr; fetch counter `0`. (AC-F3-1, NFR-5)

**TC-ZAI-024** — `ADOS_ZAI_QUOTA_DISABLED=1` + key → silent, no fetch
- **Given** key set, deps present, `ADOS_ZAI_QUOTA_DISABLED=1`; fetch counter installed.
- **When** `main` runs.
- **Then** returns `0`; zero quota stderr; fetch counter `0`. (AC-F3-1, AC-F3-4, NFR-5)

**TC-ZAI-025** — Opt-out with peak active → peak applies, zero quota stderr
- **Given** `_now_utc_epoch` in-peak (peak_wait `21000`) and `ZAI_API_KEY` unset.
- **When** `main` runs.
- **Then** returns `0`; sleep log `21000`; stderr contains the peak `[INFO]` line and **no** quota `[WARN]`/`[INFO]`. (AC-F3-1, NFR-5)

#### Group C — Exhaustion detection

Common: `_now_utc_epoch` = `N0` (off-peak); key set; `_zai_quota_fetch` returns the named fixture; the expected `_sleep` arg is the quota wait (peak contributes 0 off-peak). After the sleep, the re-eval fetch returns F-OFF so the loop terminates in one sleep (unless stated).

**TC-ZAI-029** — No `TOKENS_LIMIT` entry (TIME_LIMIT-only or `[]`) → 0, no WARN
- **Given** F-NO-TOKENS (`data.limits` = a single `TIME_LIMIT` entry only, or `[]`).
- **When** `main` runs.
- **Then** returns `0`; sleep log empty; **0** `[WARN]` lines (valid shape — no token window to exhaust ⇒ proceed, NOT fail-open). (AC-F3-2)

**TC-ZAI-030** — All `TOKENS_LIMIT` pct<100 → 0
- **Given** F-OFF.
- **When** `main` runs.
- **Then** returns `0`; sleep log empty. (AC-F3-2)

**TC-ZAI-031** — 5h pct>=100 (weekly<100) → sleep to 5h reset
- **Given** F-5H.
- **When** `main` runs.
- **Then** returns `0`; sleep log entry `7200` (= floor((1784947200000/1000) − 1784940000)). (AC-F3-2, DM-2)

**TC-ZAI-032** — weekly pct>=100 (5h<100) → sleep to weekly reset
- **Given** F-WEEK.
- **When** `main` runs.
- **Then** returns `0`; sleep log entry `86400`. (AC-F3-2, DM-2)

**TC-ZAI-033** — Both >=100 → sleep to soonest (min) reset
- **Given** F-BOTH.
- **When** `main` runs.
- **Then** returns `0`; sleep log entry `7200` (the sooner 5h reset, not `86400`). (AC-F3-2, DM-3)

**TC-ZAI-034** — `TIME_LIMIT` exhausted only → no sleep (ignored)
- **Given** F-TIME-ONLY.
- **When** `main` runs.
- **Then** returns `0`; sleep log empty (TIME_LIMIT does not trigger a wait). (AC-F3-2, NG-4)

**TC-ZAI-035** — pct == 100 boundary → exhausted
- **Given** F-5H (5h percentage exactly 100).
- **When** `main` runs.
- **Then** returns `0`; sleep log entry `7200` (the `==100` boundary counts as exhausted). (AC-F3-2)

**TC-ZAI-036** — pct > 100 (overage) → exhausted
- **Given** F-OVERAGE (5h percentage 105).
- **When** `main` runs.
- **Then** returns `0`; sleep log entry `7200` (`>100` counts as exhausted). (AC-F3-2)

**TC-ZAI-037** — `nextResetTime` in past → clamp wait to 0
- **Given** F-PAST (reset at N0 − 100s) and `_now_utc_epoch` = N0.
- **When** `main` runs.
- **Then** returns `0`; sleep log empty (wait clamped to `>= 0`). (AC-F3-2, RSK-2)

**TC-ZAI-038** — Mixed valid/bad reset among exhausted → uses good reset, 0 WARN
- **Given** F-MIXED-RESET (5h `pct=100` with a BAD `nextResetTime` (`"soon"`) + weekly `pct=100` with a GOOD `nextResetTime` (`1785026400000`, wait `86400`)).
- **When** `main` runs.
- **Then** returns `0`; sleep log = `86400` (uses the good weekly reset, ignoring the bad 5h one); **0** `[WARN]` lines (this is NOT fail-open — a valid exhausted reset exists). (AC-F3-2)

**TC-ZAI-039** — Non-exhausted earlier reset ignored → min over EXHAUSTED entries only
- **Given** F-NONEXH-EARLIER (an EXHAUSTED 5h entry (`pct=100`, `nextResetTime 1784947200000`, wait `7200`) + a NON-exhausted weekly entry (`pct=50`, `nextResetTime 1784942400000` = wait `2400`, EARLIER than the exhausted one)).
- **When** `main` runs.
- **Then** returns `0`; sleep log = `7200` (the exhausted entry's LATER reset is used; the non-exhausted entry's earlier reset is IGNORED — min is taken over EXHAUSTED entries only). (AC-F3-2)

#### Group D — Combined peak+quota (MAX)

**TC-ZAI-040** — In-peak AND quota exhausted → `_sleep` = max(peak, quota)
- **Given** `_now_utc_epoch` = `1767240600` (seconds-of-day 15000, in-peak; peak_wait `21000`); `_zai_quota_fetch` returns F-5H-FAR (quota_wait `30000`) on the first call and F-OFF on later calls; stepping clock advances `_now_utc_epoch` by each `_sleep` arg.
- **When** `main` runs.
- **Then** returns `0`; the first sleep log entry is `30000` (= max(21000, 30000)); after the clock advances, re-eval is off-peak with quota OK and the loop ends. (AC-F1-2, DM-5)

**TC-ZAI-041** — In-peak AND quota OK → peak only
- **Given** in-peak (peak_wait `21000`); `_zai_quota_fetch` returns F-OFF.
- **When** `main` runs.
- **Then** returns `0`; the sleep log entry is `21000` (peak only; quota contributes 0). (AC-F1-2)

**TC-ZAI-042** — Off-peak AND quota exhausted → quota only
- **Given** `_now_utc_epoch` = N0 (off-peak); `_zai_quota_fetch` returns F-5H (quota_wait `7200`) then F-OFF.
- **When** `main` runs.
- **Then** returns `0`; the sleep log entry is `7200` (quota only; peak contributes 0). (AC-F1-2)

#### Group E — Toggles

**TC-ZAI-045** — `ADOS_ZAI_QUOTA_DISABLED=1` + key → no fetch, return 0
- **Given** key set, deps present, `ADOS_ZAI_QUOTA_DISABLED=1`, fetch counter installed, off-peak.
- **When** `main` runs.
- **Then** returns `0`; fetch counter `0`; sleep log empty; no quota `[WARN]`/`[INFO]`. (AC-F3-4, NFR-8)

**TC-ZAI-046** — No file cache in v1 (2-iteration loop: one sleep, two fetches)
- **Given** key set; a clean temp state dir; a **2-iteration loop** run — off-peak start (`_now_utc_epoch` = `N0`), `_zai_quota_fetch` returns F-5H (quota_wait `7200`) on the first call and F-OFF on the second, so the driver sleeps once and re-evaluates to clear (one sleep, two fetches); the state dir is scanned afterward; the hook source `scripts/hooks/pre-opencode-iteration-zai.sh` is in hand.
- **When** `main` runs.
- **Then** it returns `0` and all three hold: (a) **no cache file** is written under the state dir (or anywhere the hook writes); (b) a **grep over the hook source** confirms the token `ADOS_ZAI_QUOTA_CACHE_SECONDS` does **not** appear anywhere (proving the hook does not read it — this is a source grep, not a runtime/env assertion); (c) the `_zai_quota_fetch` counter is exactly **1 per loop iteration** (i.e. `2` across the 2-iteration loop — fresh fetch each iteration, no cross-iteration cache). (AC-NFR8-1, NFR-8)

#### Group F — Safety / hygiene

**TC-ZAI-050** — Full `ZAI_API_KEY` never in stdout/stderr
- **Given** `ZAI_API_KEY` = F-SECRET; the full set of opted-in paths exercised (an exhaustion case, a fail-open case, an opt-out-with-key case); stdout and stderr captured.
- **When** each path runs.
- **Then** neither stream contains the full F-SECRET string; at most a short prefix/suffix appears in any diagnostic. (AC-F5-1, NFR-7)

**TC-ZAI-051** — Raw response body never logged
- **Given** `_zai_quota_fetch` returns F-CANARY (carrying `CANARY-ACCOUNT-ID-XYZ`); an exhaustion case and a fail-open case exercised; stderr/stdout captured.
- **When** the paths run.
- **Then** neither stream contains the canary string `CANARY-ACCOUNT-ID-XYZ` — the raw body is **never** logged (there is no debug/verbose toggle in v1); only a short reason category may appear in a `[WARN]`. (AC-F5-1, NFR-7)

**TC-ZAI-052** — Fail-open keeps exit 0 when off-peak
- **Given** each active-failure fixture from group B, off-peak.
- **When** `main` runs.
- **Then** the process exit status is `0` in every case (quota failure never alters the hook exit status). This is the cross-cutting NFR-4/AC-F3-3 exit-status assertion; it may be a shared assertion inside each B case. (AC-F3-3, NFR-4)

#### Group G — Portability

**TC-ZAI-055** — `format_utc_epoch` correct without GNU `date -d`
- **Given** the pure function `format_utc_epoch` (no `date` call).
- **When** called with `0`, `JAN_1_2026 + 36000`, `N0`, and `N0 + 7200`.
- **Then** it returns `1970-01-01T00:00:00Z`, `2026-01-01T10:00:00Z`, and the correct ISO-UTC strings for the N0 epochs, all **without** invoking `date -d`. (Extends existing `TC-HOOK-015` with the quota-test epochs.) (AC-F2-1, NFR-2)

**TC-ZAI-056** — Whole-file `! grep -q 'date -.*-d'` preserved; quota path reuses `format_utc_epoch`; `jq` allowed in quota path
- **Given** the hook source file `scripts/hooks/pre-opencode-iteration-zai.sh`.
- **When** grepped **whole-file** (no path scoping) for the pattern `date -.*-d`.
- **Then** the assertion `! grep -q 'date -.*-d'` over the whole hook source is **PRESERVED**. It holds because the quota path REUSES `format_utc_epoch` (pure Gregorian, no `date -d`) and uses `jq` — NOT because the grep is path-scoped (you cannot grep-scope a code path). **@coder MUST NOT use `date -d` (or `date -r`) anywhere in the hook** — the POC helper `iso_from_ms` in `quota-check-poc.sh` uses `date -u -d "@$sec"` and is a copy-paste trap; the production hook must use `format_utc_epoch` for ALL wake-time formatting. `jq` usage is permitted only in the opt-in quota path. (AC-F2-1, NFR-2, DEC-6)

#### Group H — Re-evaluation loop

These cases use a **stepping clock**: `_now_utc_epoch` advances by the sum of prior `_sleep` arguments, so the driver's re-evaluation observes elapsed time.

**TC-ZAI-060** — Cross-time: quota sleep lands in peak → re-eval sleeps to peak_end
- **Given** `_now_utc_epoch` starts at `N0` (seconds-of-day 2400, off-peak); `_zai_quota_fetch` returns F-CROSS (5h pct>=100, reset at `1784952600000`, quota_wait `12600`) on the first call and F-OFF thereafter; stepping clock enabled.
- **When** `main` runs.
- **Then** returns `0`; the sleep log is `[12600, 21000]` — iteration 1 sleeps the quota wait (lands at seconds-of-day 15000, inside peak), iteration 2 re-evaluates and sleeps the peak wait (`36000 − 15000 = 21000`); iteration 3 is off-peak with quota OK and the loop ends. Proves correct cross-time MAX composition. (AC-F1-2, DM-5, RSK-7)

**TC-ZAI-061** — Sleep a condition, re-eval clears → driver returns
- **Given** off-peak, `_now_utc_epoch` = N0; `_zai_quota_fetch` returns F-5H (quota_wait `7200`) on the first call and F-OFF on the second; stepping clock.
- **When** `main` runs.
- **Then** returns `0`; the sleep log is `[7200]` (one sleep); no second sleep occurs because the re-eval clears. (AC-F1-2, DM-5)

**TC-ZAI-062** — Past `nextResetTime` after sleeping → quota 0 on re-eval (no infinite loop)
- **Given** off-peak, `_now_utc_epoch` = N0; `_zai_quota_fetch` **always** returns a body with 5h pct>=100 and nextResetTime `1784943600000` (= N0 + 3600, i.e. quota_wait `3600` on the first call but **in the past once the clock advances past it**); stepping clock.
- **When** `main` runs.
- **Then** returns `0`; the sleep log is `[3600]` (iteration 1 sleeps 3600; iteration 2 sees the same reset now in the past → clamps to 0 → quota 0 → loop ends). Proves termination even if the mock keeps reporting exhaustion. (AC-F1-2, DM-5, NFR-6, RSK-2)

**TC-ZAI-063** — `ADOS_ZAI_MAX_SLEEP_LOOPS` exceeded → return 0 + one WARN
- **Given** `ADOS_ZAI_MAX_SLEEP_LOOPS=1`; `_now_utc_epoch` returns a **fixed** in-peak epoch (seconds-of-day 15000) so the peak condition stays positive every iteration (never clears with a fixed clock); stderr captured.
- **When** `main` runs.
- **Then** returns `0`; the number of sleep-log entries is **at most** `ADOS_ZAI_MAX_SLEEP_LOOPS` (= 1); stderr contains **exactly one** `[WARN]` naming the loop-cap category. (AC-F1-2, DM-5, NFR-6) The assertion tolerates the exact off-by-one of "exceeded" (≤ N sleeps when cap = N).

**TC-ZAI-064** — Fresh fetch each iteration
- **Given** the TC-ZAI-060 scenario (a ≥2-iteration loop); a `_zai_quota_fetch` call counter.
- **When** `main` runs.
- **Then** the fetch counter is **≥ 2** (quota is re-fetched fresh on every loop iteration — no cross-iteration cache). (AC-F1-2, DM-5, NFR-8)

#### Meta / docs

**TC-ZAI-070** — Whole suite runs via mocks → 0 real sleeps, 0 live network
- **Given** the full extended `scripts/.tests/test-hook-zai-example.sh`.
- **When** the suite executes.
- **Then** every case passes; by construction every `_sleep` is the recording mock and every `_zai_quota_fetch` is the canned mock, so the suite performs 0 real sleeps and 0 live network calls (AC-F4-1, NFR-1). This is enforced as a constructional guarantee plus a guard that the recording mocks are installed before any `main` call.

**TC-ZAI-071** — Guide documents the condition-function contract as extension point
- **Given** the updated `doc/guides/zai-peak-hours-hook.md`.
- **When** inspected/grepped.
- **Then** it documents the condition-function contract (name shape `howLongToSleepDueTo<Reason>()`, stdout = one non-negative integer seconds, `0`/empty/error = no-wait, must obtain time/HTTP strictly via the seams) as the extension point, plus a short how-to for adding a condition and for building a provider-specific hook. (AC-F6-1) **Dependency flag**: this assertion can only pass after the guide is updated (phase 7 `system_spec_update` / @doc-syncer); see §10.3.

## 7. Coverage Matrix

### 7.1 Acceptance Criteria → Test Cases (every AC in spec §17 covered by ≥1 case)

| AC ID | Criterion (short) | TC ID(s) | Group | Status |
|-------|-------------------|----------|-------|--------|
| AC-F1-1 | Non-`zai-coding-plan/*` model → no sleep, no conditions evaluated | TC-ZAI-001 | A | Covered |
| AC-F1-2 | MAX across conditions + re-eval loop; `ADOS_ZAI_MAX_SLEEP_LOOPS` cap → 0 + one WARN | TC-ZAI-040, TC-ZAI-041, TC-ZAI-042, TC-ZAI-060, TC-ZAI-061, TC-ZAI-062, TC-ZAI-063, TC-ZAI-064 | D, H | Covered |
| AC-F2-1 | Peak sleeps to peak_end; off-peak → 0; `format_utc_epoch` sans GNU `date -d`; `! grep -q 'date -.*-d'` preserved for peak path | TC-ZAI-002, TC-ZAI-003, TC-ZAI-004, TC-ZAI-005, TC-ZAI-055, TC-ZAI-056, TC-HOOK-015, TC-HOOK-016, TC-HOOK-017, TC-HOOK-018 | A, G | Covered |
| AC-F3-1 | `ZAI_API_KEY` unset OR `jq` OR `curl` missing → silent opt-out; peak still applies | TC-ZAI-021, TC-ZAI-022, TC-ZAI-023, TC-ZAI-025 | B′ | Covered |
| AC-F3-2 | Any `TOKENS_LIMIT` pct>=100 → soonest nextResetTime among EXHAUSTED entries (clamped ≥0); TIME_LIMIT ignored; ==100 and >100 exhausted; no TOKENS_LIMIT → 0; mixed valid/bad reset → use good; non-exhausted earlier reset ignored | TC-ZAI-029, TC-ZAI-030, TC-ZAI-031, TC-ZAI-032, TC-ZAI-033, TC-ZAI-034, TC-ZAI-035, TC-ZAI-036, TC-ZAI-037, TC-ZAI-038, TC-ZAI-039 | C | Covered |
| AC-F3-3 | Fetch fails (network/401/403/non-200/malformed/non-numeric pct/bad nextResetTime) → 0 + one WARN; peak applies; exit unchanged | TC-ZAI-010, TC-ZAI-011, TC-ZAI-012, TC-ZAI-013, TC-ZAI-014, TC-ZAI-015, TC-ZAI-016, TC-ZAI-017, TC-ZAI-018, TC-ZAI-019, TC-ZAI-020, TC-ZAI-052 | B, F | Covered |
| AC-F3-4 | `ADOS_ZAI_QUOTA_DISABLED=1` + key → 0, no fetch | TC-ZAI-024, TC-ZAI-045 | B′, E | Covered |
| AC-F4-1 | Seams override clock/sleep/HTTP → deterministic suite (A–H), 0 live network, 0 real sleeps | TC-ZAI-070 (and all cases by construction) | all | Covered |
| AC-F5-1 | stderr/stdout never full `ZAI_API_KEY`; raw body never logged (no debug toggle in v1) | TC-ZAI-050, TC-ZAI-051 | F | Covered |
| AC-F6-1 | Guide documents condition-function contract + how-to | TC-ZAI-071 | docs | Covered (post guide-update — see §10.3) |
| AC-NFR3-1 | Non-opt-in (no key) → peak path spawns 0 `jq`, 0 network | TC-ZAI-021 (0 `jq` + 0 fetch counters) | portability | Covered |
| AC-NFR8-1 | v1: ≤1 fetch per re-eval loop iteration; no cross-invocation file cache | TC-ZAI-046, TC-ZAI-064 | E, H | Covered |

### 7.2 Functional Capabilities → Test Cases

| F ID | Capability | TC ID(s) |
|------|------------|----------|
| F-1 | Generic condition-function sleep-driver (gate + MAX + re-eval) | TC-ZAI-001, TC-ZAI-040, TC-ZAI-041, TC-ZAI-042, TC-ZAI-060, TC-ZAI-061, TC-ZAI-062, TC-ZAI-063, TC-ZAI-064 |
| F-2 | Peak-hours condition (behavior-preserving) | TC-ZAI-002, TC-ZAI-003, TC-ZAI-004, TC-ZAI-005, TC-ZAI-055, TC-ZAI-056, TC-HOOK-015..018 |
| F-3 | Z.AI quota-exhaustion condition (opt-in, fail-open) | TC-ZAI-010..018, TC-ZAI-021..025, TC-ZAI-029..039, TC-ZAI-045 |
| F-4 | Injectable test seams | TC-ZAI-070 (and all cases) |
| F-5 | Safe secret handling | TC-ZAI-050, TC-ZAI-051 |
| F-6 | Documentation & extension guide | TC-ZAI-071 |

### 7.3 Non-Functional Requirements → Test Cases

| NFR ID | Requirement | TC ID(s) |
|--------|-------------|----------|
| NFR-1 | Deterministic CI: 0 live network, 0 real sleeps | TC-ZAI-070 (constructional across A–H) |
| NFR-2 | Peak-path portability: `format_utc_epoch` sans GNU `date -d`; `! grep -q 'date -.*-d'` preserved for peak path | TC-ZAI-055, TC-ZAI-056, TC-HOOK-015 |
| NFR-3 | No new dependency for non-opt-in users: 0 `jq`, 0 network when key unset | TC-ZAI-021 |
| NFR-4 | Fail-open discipline: exactly 1 `[WARN]`, return 0, exit unchanged, peak still applies | TC-ZAI-010..020, TC-ZAI-052 |
| NFR-5 | Opt-out silence: 0 stderr lines, return 0 | TC-ZAI-021, TC-ZAI-022, TC-ZAI-023, TC-ZAI-024, TC-ZAI-025 |
| NFR-6 | Re-eval termination + cap: always terminates; cap default 24 → 0 + one WARN | TC-ZAI-062, TC-ZAI-063 |
| NFR-7 | Secret redaction: 0 full-key, raw body never logged (no debug toggle in v1) | TC-ZAI-050, TC-ZAI-051 |
| NFR-8 | Fetch cadence: exactly 1 fetch per loop iteration; no cross-invocation cache | TC-ZAI-046, TC-ZAI-064 |

## 8. NFR Coverage (NFR-1 .. NFR-8) — summary

- **NFR-1 (deterministic CI):** Guaranteed by the sourcing + seam-override pattern. TC-ZAI-070 states the constructional guarantee; every group A–H case installs the recording `_sleep` and the canned `_zai_quota_fetch` before any `main` call, so 0 real sleeps and 0 live network calls occur. No wall-clock-dependent assertion exists.
- **NFR-2 (peak-path portability):** TC-ZAI-055 proves `format_utc_epoch` is a pure Gregorian conversion (no `date -d`) across peak and quota epochs; TC-ZAI-056 preserves the `! grep -q 'date -.*-d'` assertion scoped to the peak path, explicitly allowing `jq` in the quota path (DEC-6).
- **NFR-3 (no new dependency for non-opt-in):** TC-ZAI-021 wraps `jq` and `_zai_quota_fetch` in counters and asserts both stay `0` when `ZAI_API_KEY` is unset — the peak-only path is pure-bash.
- **NFR-4 (fail-open discipline):** Every group B case asserts return `0` and exactly one `[WARN]`; TC-ZAI-019 proves peak still applies during a quota failure; TC-ZAI-052 cross-cuts the exit-status-unchanged assertion.
- **NFR-5 (opt-out silence):** TC-ZAI-021..025 each assert zero quota stderr and return `0` across all four opt-out triggers.
- **NFR-6 (re-eval termination + cap):** TC-ZAI-062 proves termination when the mock keeps reporting exhaustion (past-reset clamp → 0); TC-ZAI-063 proves the `ADOS_ZAI_MAX_SLEEP_LOOPS` cap returns `0` + one `[WARN]`.
- **NFR-7 (secret redaction):** TC-ZAI-050 (full-key absence via F-SECRET) and TC-ZAI-051 (raw-body absence via F-CANARY — the raw body is never logged; there is no debug/verbose toggle in v1).
- **NFR-8 (fetch cadence):** TC-ZAI-046 (one fetch per iteration, no cache file, no `ADOS_ZAI_QUOTA_CACHE_SECONDS`) and TC-ZAI-064 (≥2 fetches across a ≥2-iteration loop).

## 9. Automation Plan and Implementation Mapping

| TC ID(s) | Test file | Execution | Mocking requirements | Status |
|----------|-----------|-----------|----------------------|--------|
| TC-ZAI-001..005 | `scripts/.tests/test-hook-zai-example.sh` | `bash scripts/.tests/test-hook-zai-example.sh` | `_now_utc_epoch` (fixed), `_sleep` (recorder); TC-ZAI-001 also recorders on `_zai_quota_fetch`/condition seams; TC-ZAI-005 re-sources in subshell with custom env | To Implement |
| TC-ZAI-010..020 | same | same | `_zai_quota_fetch` canned fail-open fixtures (F-NET-FAIL, F-401, F-403, F-ENV-500, F-ENV-SUCCESS-FALSE, F-MALFORMED, F-NO-LIMITS, F-LIMITS-NOT-ARRAY, F-PCT-NON-NUMERIC, F-RESET-*); stderr `[WARN]`-count assertions | To Implement |
| TC-ZAI-021..025 | same | same | `command -v` stubs (jq/curl absent); `jq` + `_zai_quota_fetch` call counters | To Implement |
| TC-ZAI-029..039 | same | same | `_zai_quota_fetch` canned valid-shape fixtures (F-OFF, F-5H, F-WEEK, F-BOTH, F-TIME-ONLY, F-OVERAGE, F-PAST, F-NO-TOKENS, F-MIXED-RESET, F-NONEXH-EARLIER); `_sleep` recorder | To Implement |
| TC-ZAI-040..042 | same | same | stepping-clock `_now_utc_epoch`; F-5H-FAR / F-OFF sequence | To Implement |
| TC-ZAI-045, TC-ZAI-046 | same | same | `ADOS_ZAI_QUOTA_DISABLED=1`; temp state dir scan for cache file; fetch counter | To Implement |
| TC-ZAI-050..052 | same | same | F-SECRET; F-CANARY; stdout/stdredaction capture; exit-status capture | To Implement |
| TC-ZAI-055, TC-ZAI-056 | same | same | pure-function calls; grep over hook source | To Implement (extend TC-HOOK-015) |
| TC-ZAI-060..064 | same | same | stepping clock; fetch counter; `ADOS_ZAI_MAX_SLEEP_LOOPS` override | To Implement |
| TC-ZAI-070 | same | same | constructional + guard that mocks are installed | To Implement |
| TC-ZAI-071 | doc assertion (test or hook-regression grep) | `bash scripts/.tests/test-hook-zai-example.sh` | grep `doc/guides/zai-peak-hours-hook.md` for contract keywords | To Implement (after guide update) |
| TC-HOOK-015..018 | same | same | (existing) | Existing – No Change |

### Regression suite (must remain green)

- `bash scripts/.tests/test-hook-zai-example.sh` (this change's target)
- `bash scripts/.tests/test-ceo-loop.sh`
- `bash scripts/.tests/test-deliver-ticket.sh`
- `bash scripts/.tests/test-hook-regression.sh`
- `bash scripts/test-all.sh` (aggregate)

## 10. Risks, Assumptions, and Open Questions

### 10.1 Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| The `_zai_quota_fetch` seam's `(http_code, body)` return encoding is not yet pinned by code, so tests could couple to a wrong shape | Medium | Medium | This plan treats the encoding as @coder's choice (DM-6) and expresses fixtures as `(code, body)` pairs; tests follow whatever the seam emits. Flagged in §3.2. |
| The re-eval loop's exact "cap exceeded" off-by-one is unspecified | Low | Medium | TC-ZAI-063 asserts `≤ N` sleeps when `ADOS_ZAI_MAX_SLEEP_LOOPS=N`, tolerating either convention. |
| `readonly` peak-env vars block per-test override | Low | Low | TC-ZAI-005 re-sources in a subshell; flagged in §3.4 for @coder (lazy read would simplify). |
| A group-F case leaks the canary/key because a diagnostic prints more than prefix/suffix | High | Low | F-SECRET and F-CANARY are distinctive; TC-ZAI-050/051 exact-match-absent assertions catch any leak (RSK-4). |
| A quota-only condition that never clears hangs the loop | High | Low | TC-ZAI-062 (past-reset clamp) + TC-ZAI-063 (cap) prove termination (RSK-2, RSK-7). |

### 10.2 Assumptions

- The ground-truth data contract (API-1 / DM-2) — `type`, `unit`, `number`, `percentage`, `nextResetTime` (epoch-ms) — is stable; the canned fixtures encode it exactly.
- `percentage` is an integer that can equal or exceed 100; `>= 100` is the exhaustion threshold and pre-empts HTTP 429 (DEC-4, NG-5).
- `nextResetTime` is reliably present for both `TOKENS_LIMIT` windows (DEC-5); the absent/malformed/unparseable cases are covered as fail-open, not as a polling fallback.
- The hook is invoked minutes apart (one fetch per iteration is within endpoint tolerance — DEC-9), so one-fetch-per-iteration is the correct cadence.
- The four existing peak/portability assertions (`TC-HOOK-015..018`) remain valid and unchanged after the refactor (RSK-6).

### 10.3 Open questions / flags for @plan-writer and @coder

| ID | Flag | Owner | Effect |
|----|------|-------|--------|
| OQ/Flag-1 | **AC-F6-1 (docs) is only assertable after the guide is updated.** TC-ZAI-071 greps `doc/guides/zai-peak-hours-hook.md` for the condition-function contract; it cannot pass until phase 7 (`system_spec_update` / @doc-syncer) ships the quota + extensibility sections. @plan-writer should sequence the guide update before/in-phase with the test; @coder should not block the hook tests on it. | @plan-writer, @coder | TC-ZAI-071 dependency; not a determinism problem |
| OQ/Flag-2 | **AC-NFR8-1 "no cross-invocation file cache" is a negative assertion** (prove absence). Covered by (a) no cache file written, (b) no `ADOS_ZAI_QUOTA_CACHE_SECONDS` knob, (c) one fetch per iteration (TC-ZAI-046/064). It is deterministic but inherently a "prove-negative"; @coder must ensure the hook writes no cache artifact anywhere outside the mocked seams. | @coder | TC-ZAI-046 scoping |
| OQ/Flag-3 | **`_zai_quota_fetch` return encoding** (how http_code and body are returned to the caller) is unspecified by the spec beyond "returns HTTP status code + response body" (DM-6). @coder pins it; tests follow. Flagged so @plan-writer does not over-constrain. | @coder | All B/C/D/E/F/H quota cases |
| OQ-1 (from spec) | Exact `[INFO]`/`[WARN]` wording is open. Tests pin the behavioral contract (reason + UTC wake time on sleep; one `[WARN]` per failure with a reason **category** token; redaction) and must not assert full log lines. | @coder, @test-plan-writer | All cases that assert stderr |

## 11. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-04 | @test-plan-writer (fallback) | Initial test plan (Proposed). Authored from the GH-150 spec (§17 ACs, DM-1/3/4/5/6, API-1, §9 NFRs, Appendix C matrix), `chg-GH-150-pm-notes.yaml` (groups A–H), the existing `scripts/.tests/test-hook-zai-example.sh` sourcing pattern, `scripts/hooks/pre-opencode-iteration-zai.sh` seams, and the GH-146/GH-148 test plans (house style). 45 new cases (TC-ZAI-001..071) + 4 preserved (TC-HOOK-015..018) cover every AC (AC-F1-1 .. AC-NFR8-1) and every NFR (NFR-1 .. NFR-8); AC→case→group traced in §7. Implementation-free (no bash); fixtures are JSON data only. |
| 1.1 | 2026-08-04 | DoR iter-1 remediation (@readiness-reviewer findings F-1..F-9) | F-1 (Blocker): base clock `N0` 1785000000→1784940000 (sod 2400 = 00:40 UTC, off-peak); shifted every N0-anchored `nextResetTime` by −60000000 ms (F-5H/F-WEEK/F-BOTH/F-OVERAGE/F-PAST/F-CROSS + the TC-ZAI-062 inline fixture) so asserted waits are unchanged; TC-ZAI-060 sleep log `[12600, 21000]` now achievable (added §5 arithmetic anchor). F-2/F-3/F-8: added F-MIXED-RESET/F-NONEXH-EARLIER/F-NO-TOKENS + TC-ZAI-038/039/029 (group C). F-5: restated TC-ZAI-056 (whole-file grep; @coder MUST NOT use `date -d` — POC `iso_from_ms` trap). F-7: restated TC-ZAI-046 (2-iteration loop + source grep for `ADOS_ZAI_QUOTA_CACHE_SECONDS`). F-4: dropped the "production mode" qualifier (raw body never logged; no debug/verbose toggle in v1) across TC-ZAI-051/F-CANARY + coverage matrices. |

## 12. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| (To be populated during execution) | | | |
