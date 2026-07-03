# Test Plan — GH-124

> **Spec**: `chg-GH-124-spec.md`
> **Test framework**: ADOS bash testing (`bash <dir>/.tests/test-*.sh`)

## Traceability matrix

| AC | Test Case ID | Test File | Description |
|---|---|---|---|
| AC-1.1 | TC-CMB-01 | `tools/.tests/test-clean-merged-branches.sh` | Tool exists, PATH-able, has all flags |
| AC-1.2 | TC-CMB-02,03,04,06 | same | Deletes merged + content-identical; protects branches; restores original |
| AC-1.3 | TC-CMB-01-06 | same | All 6 test cases pass |
| AC-1.4 | — | visual check | License header present |
| AC-2.1 | TC-OS-14,15 | `scripts/.tests/test-opencode-session.sh` | find_session_by_title returns match / empty on no match |
| AC-2.2 | TC-OS-18 | same | Resolution order: mapping → title → create |
| AC-2.3 | TC-OS-16 | same | Mapping JSON has branch field |
| AC-2.4 | TC-OS-17 | same | Pending mapping before run |
| AC-2.5 | TC-OS-01-13 | same | No regression in existing 13 tests |
| AC-2.6 | all TC-OS | same | All 18 tests pass |
| AC-3.1 | TC-DT-01,02 | `scripts/.tests/test-deliver-ticket.sh` | Input parsing: bare ticket, colon syntax |
| AC-3.2 | TC-DT-03 | same | Branch mismatch warning |
| AC-3.3 | TC-DT-05 | same | Stale detection triggers kill |
| AC-3.4 | TC-DT-08 | same | Prompt references title-based resume |
| AC-3.5 | TC-DT-06 | same | Max-restarts exits with failure |
| AC-3.6 | TC-DT-07 | same | Exit classification: blocked label detected |
| AC-3.7 | all TC-DT | same | All 8 tests pass |
| AC-4.1 | TC-BD-01,02,03 | `scripts/.tests/test-batch-deliver.sh` | Ticket parsing: positional, colon, mixed |
| AC-4.2 | TC-BD-04,05,06 | same | Skip merged / blocked / closed |
| AC-4.3 | — | integration | Calls deliver-ticket.sh + clean-merged-branches |
| AC-4.4 | TC-BD-07,08 | same | Duration formatting + summary output |
| AC-4.5 | TC-BD-04 | same | Idempotent restart skips merged |
| AC-4.6 | all TC-BD | same | All 8 tests pass |
| AC-5.1 | TC-DT-08 | `scripts/.tests/test-deliver-ticket.sh` | Prompt has PR check / address comments / merge / blocked |
| AC-5.2 | TC-DT-08 | same | Prompt is identical on every call (state detection at top) |
| AC-5.3 | TC-DT-08 | same | Prompt has human-input-needed label workflow |
| AC-6.1 | all | all test files | All test scripts pass |
| AC-6.2 | — | regression | `test-doc-distribution.sh` still passes |

## Test strategy

- **Unit tests**: All tests use the ADOS bash testing framework (source script under test, mock external commands, assert return values and output).
- **Temp git repos**: clean-merged-branches tests create temp git repos in `$(mktemp -d)` to test branch deletion without affecting the real repo.
- **Mocking**: `opencode`, `gh`, and `git` commands are mocked where the real command would have side effects (creating sessions, merging PRs, modifying state).
- **No network**: Tests do not make network calls. All GitHub/opencode interactions are mocked.
