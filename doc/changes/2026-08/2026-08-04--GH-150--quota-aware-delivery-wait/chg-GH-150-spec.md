---
change:
  ref: GH-150
  type: feat
  status: Proposed
  slug: quota-aware-delivery-wait
  title: "Make the Z.AI pre-iteration hook quota-aware so delivery waits for quota reset instead of restart-storming"
  owners: ["Juliusz Ćwiąkalski"]
  service: delivery-os
  labels: ["autonomous-delivery", "quota", "hooks", "zai", "extensibility"]
  version_impact: minor
  audience: mixed
  security_impact: low
  risk_level: medium
  dependencies:
    internal: ["scripts/hooks/pre-opencode-iteration-zai.sh", "scripts/.tests/test-hook-zai-example.sh", "doc/guides/zai-peak-hours-hook.md", "doc/templates/blueprints/zai-peak-hours-hook--install.sh", "GH-146 (pre-iteration hook contract)", "TDR-0002 (hook contract details)"]
    external: ["Z.AI Coding Plan quota API (api.z.ai)", "jq", "curl"]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Extend the existing Z.AI pre-iteration hook so autonomous delivery pauses not only during peak hours but also when the Z.AI token quota is exhausted — sleeping until the quota resets instead of being kill/restarted by the wrapper, which cannot fix quota exhaustion — and refactor the hook into a generic sleep-driver with a pluggable condition-function extension point that is trivially extensible to other providers.

## 1. SUMMARY

This change refactors the inactive Z.AI peak-hours example hook (`scripts/hooks/pre-opencode-iteration-zai.sh`) into a generic sleep-driver plus pluggable condition functions, and adds a new condition that detects Z.AI Coding Plan token-quota exhaustion via the provider's quota endpoint and sleeps until the soonest exhausted window resets. A re-evaluation loop composes multiple conditions correctly across elapsed time (e.g. a multi-hour quota sleep that lands inside the peak window). The quota feature is opt-in (`ZAI_API_KEY` set, plus `jq` and `curl` present) and fail-open (any error returns zero wait and one diagnostic line, leaving peak-hours behavior untouched). Users who do not opt in get **byte-identical** delivery behavior to today (same gate, same sleep target, same exit status, 0 `jq`, 0 network — the exact `[INFO]`/`[WARN]` log wording is UNPINNED per OQ-1): a pure-bash, zero-network, zero-`jq` peak gate. The condition-function contract is documented as the extension point so other providers can build their own hook by reusing the driver and authoring new condition functions.

## 2. CONTEXT

### 2.1 Current State Snapshot

- The autonomous-delivery loops (`scripts/deliver-ticket.sh`, `scripts/ceo-loop.sh`) invoke a single pre-iteration hook before every PM/CEO spawn via one resolved path (`PRE_ITERATION_HOOK`, default `~/.ados/hooks/pre-opencode-iteration`), run through `_setsid`, inheriting the parent environment. The hook contract is fixed by **GH-146 / TDR-0002** (Accepted, R2): the hook is a pure gate (sleep to defer, exit `0` to proceed; non-zero prevents the spawn), writes no environment output for a sleep-only policy, and may sleep for hours without a wrapper-imposed timeout.
- The redistributable-but-inactive Z.AI example (`scripts/hooks/pre-opencode-iteration-zai.sh`) pauses delivery during the Z.AI peak window. Peak hours are 06:00–10:00 UTC (14:00–18:00 UTC+8); with a configurable +2h lead buffer the effective pause window is 04:00–10:00 UTC. Activation is gated on the configured model value starting with `zai-coding-plan/` (read from `OC_ADOS_AGENT_PM_MODEL` / `OC_ADOS_AGENT_CEO_MODEL` keyed by `ADOS_HOOK_AGENT`).
- The example is already structured for deterministic testing via two injectable seams: `_now_utc_epoch()` (clock) and `_sleep()` (sleep). Its UTC wake-time formatter `format_utc_epoch` is a pure-Gregorian conversion that avoids GNU `date -d` / BSD `date -r` divergence; an existing portability test asserts `! grep -q 'date -.*-d'` over the hook source.
- GH-146's Non-Goal NG-2 ("Managing provider subscription credentials or querying quota APIs") deliberately left quota querying out of scope. GH-150 now brings quota querying **into** the example hook for the first time.
- `jq` is already a framework-wide runtime dependency (declared by `deliver-ticket.sh` and `ceo-loop.sh` dependency headers); `curl` is broadly available.

### 2.2 Pain Points / Gaps

- **Restart-storm on quota exhaustion (root cause of GH-150).** When the Z.AI Coding Plan token quota is exhausted, the PM/coder session makes no forward progress. The wrapper treats this as a generic liveness stall, kills the session, and restarts the same work — repeatedly, until a human forces a technical stop. A restart cannot replenish a provider quota; the only correct action is to **wait** until the quota resets, then resume.
- **No quota signal exists at the scheduling seam.** The peak hook gates only on wall-clock time; it has no notion of remaining quota, so it cannot prevent a spawn that is doomed to fail on a 100%-used plan.
- **No extensibility contract.** The hook is a single monolithic `main()`. Adding a second condition (quota) by ad-hoc branching would make a third (another provider, another policy) brittle. There is no documented pattern for "add a condition" or "build a provider-specific hook".
- **Undocumented provider endpoint, misdocumented by community tools.** Community tooling published inaccurate field names (`window_length` / `used` / `remaining` / `reset_time`, and the claim that the 5-hour window's reset time is frequently absent). A live POC against a real credential proved the real shape (`type` / `unit` / `number` / `percentage` / `nextResetTime`) and that both token windows reliably expose `nextResetTime`. Trusting the community docs would have produced a broken parser and an unnecessary polling fallback.

## 3. PROBLEM STATEMENT

Because the Z.AI peak-hours hook gates only on time-of-day and has no visibility into provider quota, an autonomous delivery that hits an exhausted Z.AI token quota cannot wait for the reset — the wrapper misclassifies the resulting no-progress stall as a recoverable liveness failure and restart-storms the same work until a human intervenes, even though no restart can fix an exhausted quota.

## 4. GOALS

- **G-1**: Add a quota-exhaustion condition to the Z.AI hook that pauses delivery when any token-quota window is at/over 100% and sleeps until the soonest reset, resuming automatically afterward.
- **G-2**: Refactor the hook into a generic sleep-driver + pluggable condition-function architecture, and document that contract as the extension point (other providers/conditions = new condition functions reusing the driver).
- **G-3**: Preserve **byte-identical** delivery behavior for users who do not opt into quota checking (no `ZAI_API_KEY`). Here **byte-identical** = same gate, same sleep target, same exit status, 0 `jq` processes, 0 network calls, no new runtime dependency. The exact `[INFO]`/`[WARN]` log wording is explicitly **UNPINNED (OQ-1)** and may be normalized by the refactor.
- **G-4**: Keep the hook deterministic-testable: zero live API calls and zero real sleeping in CI, via injectable seams.
- **G-5**: Make multi-condition waiting correct across elapsed time via a re-evaluation loop, so composed waits (e.g. a quota sleep that lands inside the peak window) are handled without spawning the agent into a paused window.
- **G-6**: Handle provider-secret material safely (never log the full key, and never log the raw response body — there is no debug/verbose toggle in v1; only a short reason category may appear in a `[WARN]`).

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Restarts caused by quota exhaustion (opt-in, quota exhausted) | 0 — the hook waits until reset, then resumes once |
| Behavior delta for non-opt-in users (no `ZAI_API_KEY`) | None — peak-only path is **byte-identical** (same gate, same sleep target, exit 0, 0 `jq` processes, 0 network calls; the exact `[INFO]`/`[WARN]` log wording is UNPINNED per OQ-1 and may be normalized by the refactor) |
| Live network calls / real sleeps in CI | 0 across the full test matrix (groups A–H) |
| Fail-open discipline | Exactly one `[WARN]` line per active-but-failed quota path; exit status never changed by quota failure; peak condition still applies |
| Secret leakage in stderr (production) | 0 occurrences of the full `ZAI_API_KEY`; 0 occurrences of the raw response body |
| Peak-path portability | `format_utc_epoch` correct without GNU `date -d`; `! grep -q 'date -.*-d'` assertion preserved for peak code |

### 4.2 Non-Goals

- **NG-1**: Wrapper-level quota handling — `deliver-ticket.sh`/`ceo-loop.sh` `--status waiting_for_quota` fields, foreground sleep inside the wrapper, and wrapper-level signal handling for quota waits. **Superseded** (not deferred) by the per-provider-hook extensibility pattern: generic wrapper-level quota handling is intentionally not pursued. GH-150 closes on merge of the hook slice.
- **NG-2**: A file-based cross-invocation quota cache in v1. Each hook invocation fetches once; the fetch stays behind a seam so a cache can be added later without changing callers. No `ADOS_ZAI_QUOTA_CACHE_SECONDS` toggle in v1.
- **NG-3**: Non-Z.AI providers. Others build their own hook file reusing the documented driver pattern and their own condition functions.
- **NG-4**: `TIME_LIMIT` exhaustion (the MCP search-prime / web-reader / zread call budget). It does not block model inference and is ignored by the quota condition.
- **NG-5**: Waiting for HTTP 429. The hook pre-empts at `percentage >= 100` and never relies on a 429 response.
- **NG-6**: Interrupting an already-running OpenCode session when quota exhausts mid-flight. The hook gates only new spawns/resumes (inherited from GH-146).
- **NG-7**: Any change to the GH-146 / TDR-0002 hook invocation contract, the `ADOS_HOOK_ENV_V1` return protocol, or wrapper retry/liveness/merge semantics.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Generic condition-function sleep-driver (the extension point) | One driver composes any number of independent wait conditions correctly; adding a condition = adding a function, not editing branching logic |
| F-2 | Peak-hours condition (behavior-preserving refactor) | Existing peak logic must move into the condition contract with zero behavioral change for non-opt-in users |
| F-3 | Z.AI quota-exhaustion condition (new, opt-in, fail-open) | The core new capability: detect 100%-used token windows and sleep until reset |
| F-4 | Injectable test seams (deterministic testing) | Zero live network and zero real sleep in CI; clock/sleep/HTTP all overridable |
| F-5 | Safe secret handling | Provider key and raw response must never reach logs |
| F-6 | Documentation & extension guide | The condition-function contract is the productized extension point; adopters must be able to add conditions or build provider hooks from the guide |

### 5.1 Capability Details

**F-1 — Generic condition-function sleep-driver.** The hook's entry point gates on the configured model (must start with `zai-coding-plan/`), then repeatedly: (a) evaluates every registered condition function, (b) takes the **maximum** of the non-negative seconds each returns, (c) if that maximum is `> 0` sleeps for it via the `_sleep()` seam (logging the UTC wake time and reason), and (d) re-evaluates all conditions after waking. The loop terminates when no condition returns `> 0`, then exits `0`. Conditions are evaluated fresh each iteration (quota is re-fetched each loop pass — see DM-5). A condition is any function matching the documented contract (DM-1). v1 registers exactly two conditions: peak-hours (F-2) and quota-exhaustion (F-3).

**F-2 — Peak-hours condition (behavior-preserving).** The existing effective-pause-window logic (`[peak_start - buffer, peak_end)`, default 04:00–10:00 UTC) is expressed as a condition that returns seconds-until-`peak_end` when inside the window and `0` otherwise. Its observable delivery behavior (gate, sleep target, exit status, and an `[INFO]` line naming the reason and the exact UTC wake time) is unchanged. The pure-Gregorian `format_utc_epoch` formatter is reused unchanged; the peak path remains pure-bash (no `jq`, no network).

**F-3 — Z.AI quota-exhaustion condition.** Opt-in and fail-open. When active (per DM-4 activation requirements), it fetches the quota endpoint via the `_zai_quota_fetch()` seam, parses the `data.limits[]` entries of `type == "TOKENS_LIMIT"`, and — if **any** has `percentage >= 100` — returns the seconds until the **soonest** `nextResetTime` among the exhausted entries, clamped to `>= 0`. `TIME_LIMIT` entries are ignored. `percentage == 100` and `> 100` both count as exhausted. The condition pre-empts at `percentage >= 100`; it never waits for a 429. On any failure (DM-3 failure catalog) it returns `0` and emits exactly one `[WARN]` line, leaving the peak condition to apply independently. When not opted in or explicitly disabled, it returns `0` silently (no warning — this is opt-out, not failure).

**F-4 — Injectable test seams.** The existing `_now_utc_epoch()` and `_sleep()` seams are preserved. A new `_zai_quota_fetch()` seam wraps the `curl` call and returns the HTTP status code together with the response body; tests override it with a canned code + body. All quota and peak tests are deterministic through these seams — no live network, no real sleeping. The seams do not change production behavior.

**F-5 — Safe secret handling.** The hook never writes the full `ZAI_API_KEY` to stderr or stdout; only a short prefix/suffix may appear in a diagnostic. **The raw response body is NEVER logged — there is no debug/verbose toggle in v1** (the body may contain account-identifying detail and is not needed for operator diagnostics once a `[WARN]` reason is emitted). A redacted reason category (e.g. "HTTP 401", "malformed JSON") is sufficient.

**F-6 — Documentation & extension guide.** The Z.AI peak-hours guide gains (a) a quota section (opt-in via `ZAI_API_KEY`, what it does, the fail-open guarantee, env knobs) and (b) an "Extensibility: adding conditions / other providers" section documenting the condition-function contract (DM-1) as the extension point, with a short how-to for adding a condition and for building a provider-specific hook. The install blueprint info messages are updated only if needed to remain accurate.

## 6. USER & SYSTEM FLOWS

```
Flow 1 — Opted-out user (no ZAI_API_KEY) [byte-identical to today]:
  wrapper resolves hook → model not zai-coding-plan/* → return 0 (no sleep)
  OR model is zai-coding-plan/* →
      quota condition: not opted in → returns 0 silently (no fetch, no jq)
      peak condition: outside window → 0  → driver returns 0 immediately
      peak condition: inside window → seconds-until-peak_end → sleep → wake → re-eval → 0 → return 0

Flow 2 — Quota exhausted, off-peak:
  model zai-coding-plan/* + key/deps present
    → quota condition fetches → some TOKENS_LIMIT percentage >= 100
    → returns seconds-until-soonest nextResetTime (clamped >= 0)
    → peak condition: 0 → driver sleeps max = quota_wait → wake → re-eval
    → quota now < 100 (post-reset) → 0; peak still 0 → return 0 → agent spawns

Flow 3 — Peak AND quota both active (cross-time composition):
  in-peak + quota exhausted
    → max(peak_wait, quota_wait); suppose quota_wait > peak_wait
    → sleep quota_wait → wake (now off-peak for the OLD window, but...) → re-eval
    → if now inside peak again (e.g. a short quota reset landed in peak) → peak condition > 0 → sleep to peak_end → re-eval → 0 → return 0
  (the loop guarantees the agent never spawns into a still-paused window)

Flow 4 — Fail-open (fetch error / auth / bad data):
  quota condition active but cannot produce a trustworthy result
    → returns 0 + exactly one [WARN] (reason category only; no full key, no raw body)
    → peak condition still applies independently → driver composes peak only → exit 0 (status unchanged)

Flow 5 — Re-eval termination safety:
  after sleeping to a reset time, the API may still report percentage >= 100 briefly
    → nextResetTime is now in the past → (reset_s - now) clamped to 0 → quota returns 0 → loop ends
  (no infinite loop; defensive cap ADOS_ZAI_MAX_SLEEP_LOOPS as belt-and-suspenders)
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- Refactor `scripts/hooks/pre-opencode-iteration-zai.sh` into a generic driver `main()` + two Z.AI condition functions: `howLongToSleepDueToPeakHours` (existing logic, refactored into the contract) and `howLongToSleepDueToQuotaExhaustion` (new), plus the re-evaluation loop.
- Quota condition: call the Z.AI quota endpoint, parse `TOKENS_LIMIT` entries, apply the exhaustion rule and sleep math (DM-2, DM-3, API-1); opt-in + fail-open.
- New injectable seam `_zai_quota_fetch()` (wraps `curl`; returns HTTP code + body), alongside the preserved `_now_utc_epoch()` / `_sleep()` seams.
- Re-evaluation loop in the driver with defensive cap `ADOS_ZAI_MAX_SLEEP_LOOPS` (default 24).
- New env knobs: `ZAI_API_KEY` (required to opt in), `ADOS_ZAI_QUOTA_DISABLED` (`1` = opt out), `ADOS_ZAI_MAX_SLEEP_LOOPS`.
- Secret-handling guarantees: never log the full key; never log the raw response body (no debug/verbose toggle in v1).
- Tests: extend `scripts/.tests/test-hook-zai-example.sh` with the full mocked matrix (groups A–H from `chg-GH-150-pm-notes.yaml`) via the seams; preserve the existing portability assertion for the peak path.
- Docs: update `doc/guides/zai-peak-hours-hook.md` (quota section + extensibility section documenting the condition-function contract); update `doc/templates/blueprints/zai-peak-hours-hook--install.sh` info messages only if needed.

### 7.2 Out of Scope

- [OUT] Wrapper-level quota handling in `deliver-ticket.sh` / `ceo-loop.sh` (`--status waiting_for_quota` fields, foreground sleep inside the wrapper, wrapper-level signal handling). Superseded by the per-provider-hook pattern; GH-150 closes on merge.
- [OUT] A file-based cross-invocation quota cache (and the `ADOS_ZAI_QUOTA_CACHE_SECONDS` toggle). Deferred behind the `_zai_quota_fetch()` seam.
- [OUT] Non-Z.AI providers (build their own hook via the documented pattern).
- [OUT] `TIME_LIMIT` (MCP search-prime/web-reader/zread) exhaustion — does not block model inference.
- [OUT] Waiting for HTTP 429; changing the GH-146/TDR-0002 hook invocation contract or the `ADOS_HOOK_ENV_V1` return protocol.
- [OUT] Interrupting an in-flight OpenCode session when quota exhausts mid-run.
- [OUT] Wrapper-side heartbeat/status marker to make multi-hour/multi-day quota sleeps distinguishable from a "dead" process to an outer watchdog (the wrapper already tolerates the equivalent peak sleep; see §7.3).

### 7.3 Deferred / Maybe-Later

- A wrapper-side heartbeat or status hint so very long quota sleeps (up to ~7 days for a weekly window) are visibly "intentional" to an outer watchdog. Out of scope here because the wrapper already tolerates multi-hour peak sleeps via the GH-146 contract; tracked for a future wrapper-side change if operators report confusion.
- A cross-invocation file cache behind `_zai_quota_fetch()` to reduce endpoint load further (not needed in v1; one fetch per iteration is well within endpoint tolerance).
- A second provider example hook reusing the driver pattern (the documented contract is the prerequisite).

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — this change exposes no HTTP endpoints. It consumes one external endpoint (see API-1 in §8.4).

### 8.2 Events / Messages

N/A — no new events/messages. The hook remains a pure gate under the GH-146 / TDR-0002 contract: sleep to defer, exit `0` to proceed, non-zero prevents the spawn. The quota feature writes no `ADOS_HOOK_ENV_V1` output (it is a sleep-only policy).

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Condition-function contract | A condition is a function named `howLongToSleepDueTo<Reason>()` that (a) echoes exactly one non-negative integer to stdout = seconds to sleep (`0`, empty, or error = no wait from this condition); (b) obtains time/HTTP strictly through the seams (`_now_utc_epoch`, `_zai_quota_fetch`); (c) may emit at most one diagnostic line to stderr. The driver discovers registered conditions and composes them by MAX + re-evaluation. |
| DM-2 | Z.AI quota data contract (ground truth) | See API-1 for the full request/response shape and field decode. The hook consumes only: envelope `code`/`success`; `data.limits[]`; per entry `type`, `percentage`, `nextResetTime`. `unit`/`number`/`level`/TIME_LIMIT-only fields are informational and not required for the logic. |
| DM-3 | Exhaustion rule + fail-open catalog | Exhaustion: pause iff ANY `TOKENS_LIMIT` entry has `percentage >= 100` (covers `==100` and `>100`); ignore `TIME_LIMIT`. Sleep target = soonest valid `nextResetTime` among exhausted entries, as seconds-until, clamped `>= 0`. **Fail-open + exactly one `[WARN]`:** network/curl failure, HTTP 401/403, non-200 envelope (`code != 200` or `success != true`), malformed JSON, `data.limits` absent/non-array, non-numeric `percentage`, or an exhausted entry with absent/malformed/unparseable `nextResetTime` and no other exhausted entry yields a valid reset. **Silent (no WARN) opt-out:** `ZAI_API_KEY` unset, `jq`/`curl` missing, or `ADOS_ZAI_QUOTA_DISABLED=1`. |
| DM-4 | Environment variables | Existing (unchanged): `ADOS_ZAI_PEAK_START_UTC` (21600), `ADOS_ZAI_PEAK_END_UTC` (36000), `ADOS_ZAI_BUFFER_SECONDS` (7200). New: `ZAI_API_KEY` (non-empty required to opt in; read-only, never logged in full), `ADOS_ZAI_QUOTA_DISABLED` (`1` = opt out even with key), `ADOS_ZAI_MAX_SLEEP_LOOPS` (default 24; defensive re-eval cap). Quota activation requires ALL of: model is `zai-coding-plan/*`, `ZAI_API_KEY` non-empty, `jq` present, `curl` present, `ADOS_ZAI_QUOTA_DISABLED != 1`. |
| DM-5 | Re-evaluation loop semantics | After the driver sleeps `max(conditions)`, it re-evaluates ALL conditions and loops until none returns `> 0`. Quota is re-fetched fresh each loop iteration (no cache in v1). Termination is guaranteed because every condition is monotonic w.r.t. time and the quota condition clamps `(reset_s - now)` to `>= 0` (a past reset yields `0`). `ADOS_ZAI_MAX_SLEEP_LOOPS` (default 24) caps the loop; on exceed it returns `0` and emits one `[WARN]`. |
| DM-6 | Seam contract | `_now_utc_epoch()` → current UTC epoch seconds (existing). `_sleep(seconds)` → sleep (existing). `_zai_quota_fetch()` → wraps `curl`; returns HTTP status code + response body (new). Tests override all three. Production behavior is unchanged by the seams. |

### 8.4 External Integrations

| ID | Endpoint / Integration | Contract |
|----|------------------------|----------|
| API-1 | Z.AI Coding Plan quota — `GET https://api.z.ai/api/monitor/usage/quota/limit` | Header `Authorization: Bearer $ZAI_API_KEY`, `Accept: application/json`. Same key used for model inference. Returns the ground-truth envelope below. **Field decode:** `code`/`msg`/`success` = envelope (`success==true` AND `code==200` = OK); `data.level` = plan tier (informational); `data.limits[]` = per-window entries; `type` = `TOKENS_LIMIT` (model-inference quota — consumed) \| `TIME_LIMIT` (MCP call budget — ignored); `unit` enum {0=unknown,1=days,3=hours,5=months,6=weeks} paired with `number` (informational; e.g. `unit=3,number=5` = 5-hour window, `unit=6,number=1` = weekly); `percentage` = integer percent used (0–100, may exceed 100 on overage) — the exhaustion signal; `nextResetTime` = epoch-**milliseconds** UTC, reliably present for both token windows — the sleep target. Sample (live Max-plan key, 2026-08-04): `{"code":200,"msg":"Operation successful","success":true,"data":{"level":"max","limits":[{"type":"TIME_LIMIT",...,"percentage":1,"nextResetTime":1788418872997,...},{"type":"TOKENS_LIMIT","unit":3,"number":5,"percentage":3,"nextResetTime":1785841303288},{"type":"TOKENS_LIMIT","unit":6,"number":1,"percentage":61,"nextResetTime":1786258872998}]}}`. The endpoint is undocumented-but-stable (used by Z.AI's own subscription UI); fail-open + the `_zai_quota_fetch()` seam make drift cheap to repair. |

### 8.5 Backward Compatibility

- **Fully backward compatible.** Users who do not set `ZAI_API_KEY` get **byte-identical** delivery behavior — same gate, same sleep target, same exit status, 0 `jq` processes, 0 network calls (the exact `[INFO]`/`[WARN]` log wording is explicitly UNPINNED per OQ-1 and may be normalized by the refactor): the quota condition returns `0` silently, performs no network call, and spawns no `jq`; the peak path is unchanged pure-bash.
- The GH-146 / TDR-0002 hook invocation contract, the `ADOS_HOOK_ENV_V1` return protocol, wrapper retry/liveness/merge semantics, and the existing peak env knobs are unchanged.
- All new env knobs are additive with documented defaults.
- The existing portability guarantee (`format_utc_epoch` without GNU `date -d`) is preserved for the peak path; `jq` is confined to the opt-in quota path and is already a framework-wide dependency, so no new runtime dependency is introduced for non-opt-in users.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Deterministic CI | 0 live network calls and 0 real sleeps across the full test matrix (groups A–H); all time/sleep/HTTP injected via seams |
| NFR-2 | Peak-path portability | `format_utc_epoch` correct without GNU `date -d`; the `! grep -q 'date -.*-d'` assertion over the hook source is preserved for the peak code path (100%) |
| NFR-3 | No new dependency for non-opt-in users | When `ZAI_API_KEY` is unset, the hook spawns 0 `jq` processes and makes 0 network calls; peak-only path is pure-bash |
| NFR-4 | Fail-open discipline | Each active-but-failed quota path emits exactly 1 `[WARN]` line (reason category only) and returns 0; hook exit status is never altered by a quota failure; the peak condition still applies independently |
| NFR-5 | Opt-out silence | When not opted in (no key / missing `jq` or `curl` / `ADOS_ZAI_QUOTA_DISABLED=1`), the quota condition emits 0 stderr lines and returns 0 |
| NFR-6 | Re-eval termination + cap | The loop always terminates (conditions monotonic; past-reset clamps to 0); `ADOS_ZAI_MAX_SLEEP_LOOPS` defaults to 24 and, when exceeded, returns 0 + exactly 1 `[WARN]` |
| NFR-7 | Secret redaction | stderr/stdout contain 0 occurrences of the full `ZAI_API_KEY` (prefix/suffix only) and 0 occurrences of the raw response body (never logged — there is no debug/verbose toggle in v1) |
| NFR-8 | Fetch cadence | Exactly 1 quota fetch per hook invocation per re-eval loop iteration; no cross-invocation cache in v1 (fetch behind `_zai_quota_fetch()` seam) |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- The driver logs, before each sleep, an `[INFO]` line naming the active condition/reason and the exact UTC wake time (consistent with the existing peak-hook log style).
- Each fail-open quota path emits exactly one `[WARN]` line with a reason category (e.g. `HTTP 401`, `malformed JSON`, `nextResetTime unparseable`); never the full key or raw body.
- On exceeding `ADOS_ZAI_MAX_SLEEP_LOOPS`, the driver emits one `[WARN]` and returns `0`.
- No new metrics/telemetry infrastructure; observability is via existing leveled stderr logging.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | The Z.AI quota endpoint is undocumented and could change shape | H | M | Fail-open + one `[WARN]` on any deviation; all HTTP behind the `_zai_quota_fetch()` seam for fast repair; data contract pinned by a live POC and encoded as ground truth (API-1) | Medium |
| RSK-2 | `nextResetTime` is absent/past/unparseable for a real account, causing a wrong or infinite sleep | H | L | Clamp `(reset_s - now)` to `>= 0`; absent/malformed → fail-open `0` + WARN (DM-3); re-eval termination guaranteed (NFR-6); defensive loop cap | Low |
| RSK-3 | Adding `jq` to a previously pure-bash hook breaks portability | M | L | `jq` confined to the opt-in quota path only; fail-open if `jq` missing; peak path stays pure-bash and the `! grep -q 'date -.*-d'` assertion is preserved (NFR-2, NFR-3) | Low |
| RSK-4 | Secret leakage — full `ZAI_API_KEY` or raw response body reaches logs | H | M | Never log the full key (prefix/suffix only); never log raw body (no debug/verbose toggle in v1); AC + tests assert redaction (F-5, NFR-7, AC-F5-1) | Low |
| RSK-5 | A long quota sleep (up to ~7 days for a weekly window) looks "dead" to an outer watchdog | M | M | Matches the existing multi-hour peak-sleep pattern the wrapper already tolerates under GH-146; wrapper-side heartbeat is out of scope (§7.3); documented in the guide | Medium |
| RSK-6 | Refactor changes peak behavior for existing users | H | L | Peak logic moves into the condition contract with behavior-preserving AC (AC-F2-1); peak path tested for **byte-identical** observable behavior (same gate/sleep-target/exit-status, 0 `jq`, 0 network; log wording UNPINNED per OQ-1); opt-out users hit no `jq`/network (NFR-3) | Low |
| RSK-7 | The re-evaluation loop fails to compose conditions across elapsed time (agent spawns into a still-paused window) | H | M | MAX + re-eval until none `> 0` is mandatory (F-1, DM-5); cross-time composition test (group D/H) proves the quota-into-peak case | Low |
| RSK-8 | Misdocumented endpoint fields (community tools) mislead the parser | M | L (already mitigated) | Ground truth captured from a live POC; community docs treated as hypothesis; field decode encoded as API-1/DM-2 | Low |

## 12. ASSUMPTIONS

- The Z.AI quota endpoint shape captured in API-1 is stable enough for production (used by Z.AI's own subscription UI); it is undocumented, so fail-open + the fetch seam are the repair strategy.
- `nextResetTime` is reliably present for both the 5-hour and weekly `TOKENS_LIMIT` windows (confirmed against a live Max-plan key; the earlier "5h rolling window lacks reset → must poll" concern was voided by ground truth).
- `percentage` is an integer percent-used that can reach/exceed 100; `>= 100` is the correct exhaustion threshold and pre-empts HTTP 429.
- `ZAI_API_KEY` propagates to the hook via normal environment inheritance (the hook is a `_setsid` child that inherits the parent env); `ADOS_HOOK_ENV_ALLOWLIST` governs only what the hook writes back, not what it reads.
- Invocations are minutes apart (one per PM/CEO iteration), so one fetch per invocation is well within endpoint tolerance.
- The exact `[INFO]`/`[WARN]` log wording after the driver refactor may be normalized; tests will pin whatever final wording @coder/@test-plan-writer settle on (the *behavioral* contract — reason + UTC wake time on sleep, one WARN per failure — is what is pinned by AC). See OQ-1.
- The existing peak env-knob defaults and the pure-Gregorian formatter remain authoritative for the peak path.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | GH-146 / TDR-0002 (Accepted, R2) hook contract | The invocation path, process-group/signal lifecycle, and pure-gate semantics this hook extends |
| Depends on | `jq`, `curl` | `jq` is already a framework-wide dependency; both required only on the opt-in quota path |
| Depends on | Existing hook seams (`_now_utc_epoch`, `_sleep`) and `format_utc_epoch` | Preserved unchanged; extended with `_zai_quota_fetch` |
| Depends on | `chg-GH-150-pm-notes.yaml` (decisions + required test matrix) and `quota-check-poc.sh` (validated POC) | Binding planning context; encoded as-is |
| Blocks | None directly | The documented condition-function contract unblocks future provider hooks |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | What exact `[INFO]`/`[WARN]` wording should the refactored driver emit? | The driver composes multiple conditions, so the single peak log line may be generalized. Behavioral contract (reason + UTC wake time on sleep; one WARN per failure) is pinned by AC; exact bytes are not. | Open — no decision needed before delivery; @test-plan-writer/@coder pin the final string in tests. |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | ONE hook file, TWO features (peak + quota), not two hooks | The framework invokes a single `PRE_ITERATION_HOOK` path; two files would force a user-authored chain wrapper or framework changes (out of scope) | 2026-08-04 |
| DEC-2 | Generic sleep-driver + pluggable condition-function contract (`howLongToSleepDueTo<Reason>()` echoes one non-negative int seconds; `0`/empty/error = no wait; uses seams; ≤1 stderr line) | Makes the hook trivially extensible; the contract is the productized extension point | 2026-08-04 |
| DEC-3 | Ground-truth Z.AI data contract = `{type, unit, number, percentage, nextResetTime}` (NOT the inaccurate community-doc `window_length/used/remaining/reset_time`) | Confirmed via CodexBar source + a live POC against a real key; community docs were wrong | 2026-08-04 |
| DEC-4 | Exhaustion rule: pause iff ANY `TOKENS_LIMIT` has `percentage >= 100`; ignore `TIME_LIMIT`; pre-empt (do not wait for 429); both `==100` and `>100` count | Covers exact and overage exhaustion; `TIME_LIMIT` does not block inference | 2026-08-04 |
| DEC-5 | `nextResetTime` is epoch-ms UTC, reliably present for both token windows; absent/malformed → fail-open `0` (no sleep on bad data); no poll fallback | Ground truth voided the earlier "rolling window lacks reset → must poll" concern | 2026-08-04 |
| DEC-6 | `jq` is an acceptable dependency for the QUOTA path only (already framework-wide); the PEAK path stays pure-bash and the `! grep -q 'date -.*-d'` portability assertion is preserved | No new dependency for non-opt-in users | 2026-08-04 |
| DEC-7 | Re-evaluation loop is mandatory (MAX + re-eval until none `> 0`); defensive cap `ADOS_ZAI_MAX_SLEEP_LOOPS` default 24 | Required for correct cross-time composition (e.g. quota sleep landing inside peak) | 2026-08-04 |
| DEC-8 | Quota = opt-in (`ZAI_API_KEY` + `jq` + `curl`) + fail-open; opt-out via `ADOS_ZAI_QUOTA_DISABLED=1`; silent for opt-out, one `[WARN]` for active failures | Preserves today's zero-dep offline behavior for peak-only users | 2026-08-04 |
| DEC-9 | NO file-based cross-invocation quota cache in v1; one fetch per invocation, behind the `_zai_quota_fetch()` seam | Supersedes the earlier cache proposal; minutes-apart invocations make caching unnecessary; the seam allows a future cache without changing callers | 2026-08-04 |
| DEC-10 | Security: never log the full `ZAI_API_KEY` (prefix/suffix only); never log raw response body (no debug/verbose toggle in v1) | Secret hygiene; `set-evn.sh` (real key) is never staged/committed | 2026-08-04 |
| DEC-11 | On merge, CLOSE GH-150 — the restart-storm root cause is solved; the wrapper-side AC (`--status waiting_for_quota`, foreground wrapper sleep, wrapper signal handling) are SUPERSEDED (not deferred) by the per-provider-hook pattern | A restart cannot fix quota exhaustion; the hook waits. Generic wrapper-level handling is intentionally not pursued | 2026-08-04 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `scripts/hooks/pre-opencode-iteration-zai.sh` | Updated — refactored into generic driver + condition functions; new quota condition; new `_zai_quota_fetch()` seam; re-evaluation loop; new env knobs |
| `scripts/.tests/test-hook-zai-example.sh` | Updated — extended with the full mocked matrix (groups A–H); preserves existing peak/portability assertions |
| `doc/guides/zai-peak-hours-hook.md` | Updated — quota section + extensibility/condition-function contract section |
| `doc/templates/blueprints/zai-peak-hours-hook--install.sh` | Updated (info messages only, if needed for accuracy) |

## 17. ACCEPTANCE CRITERIA

> Each criterion references at least one F-/API-/DM-/NFR- ID and uses Given/When/Then. Test-group tags trace to the required matrix in `chg-GH-150-pm-notes.yaml`.

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** the configured model does not start with `zai-coding-plan/`, **when** the hook runs, **then** it returns immediately with no sleep and evaluates no conditions. `[gate]` | F-1, DM-4 |
| AC-F1-2 | **Given** two or more conditions return positive values, **when** the driver runs, **then** it sleeps the MAX across conditions and, after waking, re-evaluates ALL conditions and loops until none returns `> 0`; if `ADOS_ZAI_MAX_SLEEP_LOOPS` (default 24) is exceeded it returns `0` and emits exactly one `[WARN]`. `[D, H]` | F-1, DM-5, NFR-6 |
| AC-F2-1 | **Given** the user has not opted into quota checking, **when** the current time is inside the effective pause window, **then** the hook sleeps until `peak_end` and returns `0`; outside the window it returns `0` immediately; and `format_utc_epoch` is correct without GNU `date -d` (the `! grep -q 'date -.*-d'` assertion is preserved for the peak path). `[A, G]` | F-2, NFR-2 |
| AC-F3-1 | **Given** `ZAI_API_KEY` is unset OR `jq` OR `curl` is missing, **when** the quota condition runs, **then** it returns `0` and emits no error (silent opt-out), while the peak condition still applies independently. `[B]` | F-3, DM-4, NFR-3, NFR-5 |
| AC-F3-2 | **Given** any `TOKENS_LIMIT` entry has `percentage >= 100`, **when** the quota condition runs, **then** it returns the seconds until the soonest valid `nextResetTime` among exhausted entries (clamped `>= 0`); `TIME_LIMIT` entries are ignored; and both `percentage == 100` and `> 100` count as exhausted. `[C]` | F-3, DM-2, DM-3, API-1 |
| AC-F3-3 | **Given** the quota fetch fails (network error, HTTP 401/403, non-200 envelope, malformed JSON, non-numeric `percentage`, or an exhausted entry with no valid `nextResetTime`), **when** the quota condition runs, **then** it returns `0`, emits exactly one `[WARN]` line, leaves the peak condition applicable, and does not change the hook exit status. `[B, F]` | F-3, DM-3, NFR-4 |
| AC-F3-4 | **Given** `ADOS_ZAI_QUOTA_DISABLED=1` and `ZAI_API_KEY` is set, **when** the quota condition runs, **then** it returns `0` and performs no fetch. `[E]` | F-3, DM-4, NFR-5 |
| AC-F4-1 | **Given** the seams override clock/sleep/HTTP, **when** the deterministic test suite (groups A–H) runs, **then** it passes with 0 live network calls and 0 real sleeps. `[all]` | F-4, NFR-1 |
| AC-F5-1 | **Given** any code path that handles `ZAI_API_KEY` or the response body, **when** the hook emits stderr/stdout, **then** it never contains the full `ZAI_API_KEY` (prefix/suffix only) and never contains the raw response body (there is no debug/verbose toggle in v1 — only a short reason category may appear in a `[WARN]`). `[F]` | F-5, NFR-7 |
| AC-F6-1 | **Given** the updated guide, **when** an adopter reads it, **then** they find the condition-function contract (name, stdout = non-negative seconds, `0`/error = no-wait, must use seams) documented as the extension point, plus a short how-to for adding a condition and for building a provider-specific hook. `[docs]` | F-6 |
| AC-NFR3-1 | **Given** a non-opt-in user (no `ZAI_API_KEY`), **when** the hook runs, **then** the peak path spawns 0 `jq` processes and makes 0 network calls (no new runtime dependency). `[portability]` | NFR-3, NFR-2 |
| AC-NFR8-1 | **Given** v1, **when** the hook is invoked, **then** quota is fetched at most once per re-eval loop iteration with no cross-invocation file cache (fetch behind the `_zai_quota_fetch()` seam for future caching). `[non-goal documented]` | DM-6, NFR-8 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Single PR merging the refactored hook + new tests + guide/blueprint updates onto `feat/GH-150/quota-aware-delivery-wait`.
- The hook remains redistributable-but-inactive (GH-146 install model); quota checking activates only for adopters who set `ZAI_API_KEY`. No coordinated migration; existing peak-only users are unaffected.
- On merge, **close GH-150**: the restart-storm root cause (quota exhaustion treated as a liveness stall) is solved — the hook waits because a restart cannot help. The PR/closure comment documents that the wrapper-side AC are superseded (not deferred) by the per-provider-hook extensibility pattern (DEC-11).
- Operators who want quota awareness export `ZAI_API_KEY` (and optionally tune `ADOS_ZAI_MAX_SLEEP_LOOPS` / `ADOS_ZAI_QUOTA_DISABLED`) before running the wrapper; the hook reads it via env inheritance.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A — no persistent state is introduced or migrated. The hook is stateless across invocations (no cache in v1).

## 20. PRIVACY / COMPLIANCE REVIEW

- The hook sends the operator's `ZAI_API_KEY` only to the provider's own quota endpoint (`api.z.ai`) over HTTPS, for the purpose of reading quota state. No account data leaves the provider boundary.
- The raw response body (which may contain account-identifying detail) is never logged (there is no debug/verbose toggle in v1) (F-5, NFR-7).

## 21. SECURITY REVIEW HIGHLIGHTS

- `ZAI_API_KEY` is read-only to the hook, transmitted only as a `Bearer` header to the provider endpoint, and never written to logs (prefix/suffix only in diagnostics).
- The quota path adds no new parent-environment mutation: it writes no `ADOS_HOOK_ENV_V1` output and remains a pure gate under the GH-146/TDR-0002 contract.
- The `_zai_quota_fetch()` seam isolates all outbound HTTP, bounding the surface that handles provider responses and enabling deterministic abuse/malformed-input tests.
- `doc/changes/2026-08/2026-08-04--GH-150--quota-aware-delivery-wait/set-evn.sh` contains the owner's real key and must never be staged or committed (DEC-10).

## 22. MAINTENANCE & OPERATIONS IMPACT

- If the Z.AI endpoint changes shape, repair is localized to `_zai_quota_fetch()` and its parser; fail-open keeps delivery running (peak-only) until fixed.
- New conditions/providers are added by authoring a condition function and registering it — no driver edits (documented contract).
- Operators tuning long-wait behavior use `ADOS_ZAI_MAX_SLEEP_LOOPS` and `ADOS_ZAI_QUOTA_DISABLED`; peak tuning knobs are unchanged.
- Very long quota sleeps (up to ~7 days) are tolerated by the wrapper exactly as multi-hour peak sleeps are today; a future wrapper-side heartbeat is tracked in §7.3 if operators report confusion.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Condition function | A `howLongToSleepDueTo<Reason>()` function conforming to DM-1; the unit of extensibility |
| Driver | The generic `main()` that gates on model, takes MAX across conditions, sleeps, and re-evaluates |
| Effective pause window | `[peak_start - buffer, peak_end)` — default 04:00–10:00 UTC |
| `TOKENS_LIMIT` | A quota window governing model-inference usage; the kind the quota condition consumes |
| `TIME_LIMIT` | A quota window governing MCP call budgets (search-prime/web-reader/zread); ignored by the quota condition |
| Fail-open | On any quota-path failure, return `0` wait + one `[WARN]`, leaving peak behavior intact |
| Opt-in / opt-out | Quota checking activates only with `ZAI_API_KEY` (+`jq`+`curl`); `ADOS_ZAI_QUOTA_DISABLED=1` opts out |
| Restart-storm | The wrapper repeatedly killing/restarting work it cannot fix (quota exhaustion misread as a liveness stall) |

## 24. APPENDICES

- **Appendix A — Binding planning context:** `chg-GH-150-pm-notes.yaml` (all decisions DEC-1..11, the resolved open questions, and the required test matrix groups A–H). This spec encodes those decisions as-is.
- **Appendix B — Validated POC:** `quota-check-poc.sh` (standalone bash; queries the endpoint, prints per-window breakdown + DECISION line). Source of the ground-truth data contract in API-1.
- **Appendix C — Required test matrix (groups A–H):** A = peak-hours regression; B = quota fail-open (no key / missing jq / curl / 401-403 / non-200 / malformed JSON / empty limits); C = exhaustion detection (pct<100 → none; 5h>=100 → its reset; weekly>=100 → its reset; both → soonest; TIME_LIMIT-only → ignored; ==100 boundary; >100 overage; nextResetTime in past → clamp 0); D = combined peak+quota (MAX composition); E = toggles (`ADOS_ZAI_QUOTA_DISABLED=1`); F = safety/hygiene (no full key; no raw body; fail-open keeps exit 0); G = portability (`format_utc_epoch` sans GNU date); H = re-evaluation loop (cross-time composition, condition-cleared, past-reset → 0 no infinite loop, cap exceeded → WARN, fresh fetch each iteration).

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-04 | @spec-writer | Initial specification from `chg-GH-150-pm-notes.yaml` + validated POC; encodes binding decisions DEC-1..11 as-is |
| 1.1 | 2026-08-04 | DoR iter-1 remediation (@readiness-reviewer findings F-4, F-9) | F-4: resolved every raw-body-redaction reference (F-5, NFR-7, AC-F5-1, G-6, DEC-10, RSK-4, §7.1, §21) — removed the ambiguous "production mode" qualifier; the raw response body is NEVER logged (there is no debug/verbose toggle in v1), only a short reason category may appear in a `[WARN]`. F-9: clarified "byte-identical" wherever it denotes non-opt-in behavior (§1 summary, G-3, §4.1 KPI, §8.5, RSK-6) = same gate, same sleep target, same exit status, 0 `jq`, 0 network; exact `[INFO]`/`[WARN]` log wording explicitly UNPINNED (OQ-1). |

---

## AUTHORING GUIDELINES

- **Sources:** `chg-GH-150-pm-notes.yaml` (all decisions + required test matrix), `quota-check-poc.sh` (ground-truth endpoint/fields), `scripts/hooks/pre-opencode-iteration-zai.sh` (existing hook + seams + formatter), `doc/guides/zai-peak-hours-hook.md` (guide to update), `scripts/.tests/test-hook-zai-example.sh` (existing tests + portability assertion), the wrapper invocation sites in `scripts/deliver-ticket.sh` and `scripts/ceo-loop.sh`, and GH-146 / TDR-0002 (the hook contract being extended).
- **Decisions encoded as-is:** the binding PM/owner decisions in pm-notes were recorded in the Decision Log verbatim (not re-litigated). Where a later decision superseded an earlier one (notably the cache proposal → "NO FILE CACHE IN v1"), the **final** position is encoded and the supersession is noted (DEC-9, NG-2, NFR-8).
- **Behavioral vs. byte pinning:** the spec pins behavioral contracts (gate, sleep target, exit status, one-WARN discipline, redaction) and deliberately leaves the exact log-line wording to @coder/@test-plan-writer (OQ-1), since the driver refactor may normalize the single-condition log string.
- **No implementation detail:** the spec describes contracts and behavior only — no code, no line-level edits, no step-by-step tasks. Existing component files are named at the component level per repo house style (GH-146/GH-148).

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-150)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, API-, DM-, NFR-, RSK-, DEC-, OQ-)
- [x] Acceptance criteria reference at least one F-/API-/DM-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no code, no step-by-step tasks)
- [x] No content duplicated from linked docs
- [x] Front matter validates per front_matter_rules
