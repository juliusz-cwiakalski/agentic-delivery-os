# Review — GH-182 provider v1 (iteration 2, remediation re-review)

Status: **PASS**

Mode: local delta re-review of remediation commits `7588b26` (code/tests) and `a11def4` (docs), against review-iter-1 findings R1-R7 and spec v1.3 / test plan v1.2.

## Result

All seven findings are verifiably closed; no new contradictions with the spec or test plan; tests were strengthened, not weakened.

| Finding | Verdict | Evidence |
|---|---|---|
| R1 cleared-on-expiry | Closed | `parks.ts` gates the `cleared` append on `prior.expiresAtMs > nowMs`; `provider.resumed` emitted outside the gate; expired parks stay `expired` in `--all`; clock-past-expiry test asserts zero cleared records, one resumed per park, and no duplicate on re-observation. |
| R2 failed-entry abort | Closed | Failed entries skip with `quota-exhausted`, contribute no park, keep `provider.quota.reset_missing` visible, and do not abort the walk; only-failed/all-failed fail loud with `provider.quota.exceeded` and no fabricated expiry. TC-PROV-063 implemented, including engine-level `[failed, eligible]` and only-failed cases. |
| R3 composition claim | Closed | Feature spec states the injected-ports truth: host/binary composition injects the production ports; the CLI edge wires them in; no production module imports the factories yet. No stale duplicate remains. |
| R4 disabled quota validation | Closed | Both relational checks are skipped when `quota.enabled === false`; the misleading unknown-credential detail is impossible; fixture and test present. |
| R5 announcement evidence | Closed | Evidence is runtime-projected through the closed 11-field allowlist; canary keys (`rawBody`, `authorization`) are dropped and the 1024-byte bound still rejects. |
| R6 AC-F5-4 / parks list | Closed | Explicit park-vs-blocked-lane test; `parks list` reuses a populated store across invocations and asserts identical output, non-empty active parks, unchanged record count and projection. |
| R7 mixed reset | Closed | Future reset wins; clamp-to-clear only when every exhausted limit has a valid reset; mixed past/absent is indeterminate with `provider.quota.exceeded` + `provider.quota.reset_missing` and no expiry. TC-PROV-064 implemented with both fixtures and an absent+future control. |

## Residual risks (non-blocking)

- Tests were not executed in the bounded review pass; the quality-gate phase re-confirms the aggregate battery.
- Disabled-quota validation silently coerces malformed endpoint/credentialRef values to empty; consistent with inert-disabled semantics, optional tightening only.
- An expired park's latest ledger record remains `active` in stored state; expiry is derived at read, resume is announced once, and growth is bounded (RSK-3).
- Lifecycle handoff items (traceability re-verification, DoD, PR) remain open by design.

## Next step

PROCEED to quality gates, DoD check, and PR creation against `main-tools` (unmerged).
