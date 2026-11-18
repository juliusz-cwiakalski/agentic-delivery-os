# Code Review — Iteration 2 (post phase-8 remediation)

- **Change**: `GH-338` — M3-S4 GitHub adapter completion (code host + backlog)
- **Branch**: `feat/GH-338/github-adapter-completion` → `main-tools` (HEAD `86ed3d24`; phase-8 commit `48a915a3`)
- **Reviewer mode**: local (`doc/changes/2026-11/2026-11-17--GH-338--github-adapter-completion/`)
- **Artifacts read**: `review/review-iter-1.md`; remediation commits `48a915a3` (phase 8), `f8096cbb`, `5e5da451` (doc reconciliation), `86ed3d24` (phase transition); plan `REMEDIATION PHASE 8` block (decisions D1–D5, obligations 8.1–8.10) and phase-8 item; `chg-GH-338-spec.md` v1.3; `chg-GH-338-test-plan.md` v1.3; `feature-adapter-reference-behavior.md` + its drift fixture/test; TDR-0031/TDR-0034 amendments; the `bd1d938c..86ed3d24` diff (30 files, +1 934 / −172)
- **Date**: 2026-11-18

## Status: **PASS_WITH_NOTES**

All three iteration-1 blockers/majors (**B-1**, **M-1**, **M-2**) and the actionable minors (**m-1/D4**, **m-2/D5**, **m-5**) are resolved and verified against the code and by running the suites. Two bookkeeping minors (**m-3**, **N12**) are **not closed but are now explicitly owned** by `@pm` in the plan and the phase-8 note; they are documentation-evidence residues, not implementation gaps, so they do not block shipping. The summary is therefore PASS with residual non-blocking notes (listed in §5), each assigned to the lifecycle phase that should carry it.

Everything iteration 1 found sound remains sound and was re-run as a control. The remediation changed **evidence quality**, not contract shape: no AC, operation, cap, error identity, pinned allowance cap, or configuration surface was relaxed. **No source file was modified and no git write was performed in this review.**

---

## 1. Iteration-1 finding verification

| Finding | Verdict | Evidence |
|---|---|---|
| **B-1** — CLI host was the REST host (`api.github.com` → `api.api.github.com`) | **Resolved** | See below. |
| **M-1** — child env relative/home-less → `.local/state/gh/device-id` in CWD | **Resolved** | See below. |
| **M-2** — check tier spawned a real `gh`; hermeticity claim false; host-dependent | **Resolved** | See below. |
| **m-1 / D4** — write-side 404 declared but unimplemented | **Resolved** | See below. |
| **m-2 / D5** — "no full-array replace" vs whole-array `PATCH` | **Resolved** | See below. |
| **m-3** — unattributed phase-2/phase-7 commits | **Still open — explicitly owned** | Phase-7 now attributed (`dde7b661` named in the phase-8 note). Phase-2 remediation hashes `6bbf3c73` + `528a2cb4` are still absent from `pm-notes` (`git grep` = 0). Declared out of phase-8 scope: *"m-3/n-4/n-6 stay @pm bookkeeping"* (`pm-notes` phase-8 note; plan `NOT IN PHASE 8`). Non-blocking; owner `@pm`. |
| **m-4 / N6** (TDR-0031 item 8) | **Resolved** | TDR-0031 decision item 8 now states the one additive optional `GithubClientOptions.workflowMap` and the status-block open question is closed (`TDR-0031:290`, `:321`). |
| **m-4 / N12** (DoR-iter-2 verdict, spec-v1.2 note, superseded DM-10 sentence) | **Still open — explicitly owned** | No DoR-iteration-2 note and no spec-v1.2 note were added; the historical *"composition data on the composed runtime"* sentence (`pm-notes:580`, inside the 2026-11-17 delivery-planning note) was not rewritten. Declared in plan obligation 8.9 (`N12 (owner @pm)`) and the phase-8 note (`no historical note was rewritten`). Non-blocking; owner `@pm` (pm-notes is command-owned, not coder-owned). |
| **m-5** — changeset authored in phase 2, declared in phase 7 | **Resolved (recorded, not moved)** | Plan 8.9 *accepts* the deviation (`.changeset/**` untouched, file not moved); the `SCOPE_DEVIATION` note is retained (`pm-notes:473`) and the phase-8 note records *"m-5 stays a recorded SCOPE_DEVIATION"*. |
| **n-1** — status parser scanned the whole stdout, last status line won | **Resolved** | `parseIncludedResponse` now stops at the first status block's pre-body region and skips a bodyless intermediate block (`cli-transport.ts:293-345`); `body-with-status-line` and `two-body-bearing-blocks` fixtures. See scrutiny point 1 for the one precision caveat. |
| n-2 (capability probe semantics) | **Still open — out of scope** | Declared `NOT IN PHASE 8` (*"a real capability probe is a design change"*), and the reference doc now names the three closed codes without claiming a working-capability probe. Acceptable residue. |
| n-3 (stale test-plan symbol) | **Partially resolved** | Corrected only inside the §1/§4/GAP-TP-3 sentences the phase rewrote (as declared). Non-blocking. |
| n-4 / n-6 | **Still open — `@pm`** | Commit subjects are still template-derived (phase-8 subject `docs(GH-338): update …`, disclosed); phase-7 vs plan-phase-7 not disambiguated. Bookkeeping only. |
| n-5 (non-numeric update identity) | **Confirmed, not reshaped** | Declared refusal; prose unchanged, as the plan states. |

### B-1 — resolved

- `githubCliHostname` is the **exact, frozen** mapping (`cli-transport.ts:141-142`): `api.github.com → github.com`, every other host unchanged, **no generic `api.` strip** (pinned by the `ghes-api-prefixed` fixture row `api.ghes.example.com → api.ghes.example.com`).
- `GithubCliTransportOptions.hostname` is **required** (`:113-125`); the `request.url` host derivation is gone — `argvFor(request, hostname)` (`:281-291`) can only receive the construction value.
- Composition computes it **once** from the declared instance base URL (`production.ts:1274`, `githubInstance().baseUrl = "https://api.github.com"` at `:379`), so the end-to-end path is `api.github.com → github.com`.
- `cli-argv.json` gained a `hostMapping` block and a per-route `hostname`; TC-CLI-002 deep-equals the repinned argv and additionally asserts the cloud argv **contains `github.com` and not `api.github.com`** (`github-cli-transport.test.ts:147-190`). The mapping block is asserted row-by-row before comparison (non-vacuity).
- **Offline stub-`gh` shim through the real `execFileRunner`** — TC-CLI-014 (`:809-848`) writes and chmods a stub `gh` on an injected `PATH`, constructs the transport **without a runner**, and proves one read + one write: recorded argv (incl. `--hostname github.com`, never `api.github.com`), one spawn per request, credential absent from argv and present in the child env, stdin body, and the parsed `{status, body}`. This is the case that would have caught B-1; it passes.

### M-1 — resolved

- `isolatedBase` (`cli-transport.ts:224-230`) is **absolute in every case**: the injected `TMPDIR` only when `isAbsolute`, otherwise `os.tmpdir()`; a relative value is never constructed.
- `environmentFor` (`:262-278`) sets `GH_CONFIG_DIR`/`XDG_CONFIG_HOME` = `<base>/jaiship-gh-config`, `XDG_STATE_HOME` = `<base>/jaiship-gh-state`, `XDG_CACHE_HOME` = `<base>/jaiship-gh-cache`; `HOME` is never forwarded.
- TC-CLI-003's pinned key set is deep-equalled (never a subset) and now carries the four absolute roots (`github-cli-transport.test.ts:214-225`); TC-CLI-015 proves absoluteness with **and without** an injected `TMPDIR` (`:858-889`) and that an empty scratch CWD stays empty with the device id under `XDG_STATE_HOME` (`:891-915`).
- **Negative control** (`:917-935`): the same stub spawned with `GH_CONFIG_DIR` but **no** `XDG_STATE_HOME` does create `.local/state/gh/device-id` in the scratch CWD — so the cleanliness assertion cannot pass vacuously. This is a real control, not a claim.
- **Residue gone**: `.local/` is absent from the worktree and from `git status`; no `.gitignore` rule was added (deliberate: *"an ignore rule would hide a regression"*), which is defensible given the negative control above. I re-confirmed after running the suites: `git status --porcelain` shows no `.local/` entry.

### M-2 — resolved

- `tests/checks/install-launcher-installer.test.ts` injects `PATH` for every launcher run: `${shim}:${BUN_DIR}:/usr/bin:/bin` (`:191`), with a recording `gh` stub in the shim (`:72-78`). No launcher, composition, or policy source changed; no new configuration surface (NG-2/AC-F6-6 preserved).
- **Arm A** (`:593-614`): exactly one `gh --version` per composing invocation, no degradation line, self-description path adds none, a second composing run records a second probe. **Arm B** (`:616-645`): `PATH` built from `/usr/bin`+`/bin` minus `gh`, and the arm **asserts** `command -v gh` fails before running (not assumed); zero spawns, exactly one `provider.cli.unavailable` line, command still succeeds; the non-zero composing exit keeps the one line.
- Host here has `gh 2.91.0`, so arm B genuinely exercises the absent branch only because the injected `PATH` excludes `gh` — the assertion is load-bearing. I ran the suite green (11 pass). GAP-TP-3 and test-plan §1/§4 are restated truthfully (§1:53, §4).

### m-1 / D4 — resolved

- The write family is **uniform**: `send` maps any non-2xx, 404 included, to `providerPayloadFailure(..., status)` (`client.ts:320-328`); only the read path `get` promotes 404 to `providerNotFoundFailure` (`:286-292`). `providerNotFoundFailure` is used only by reads (`client.ts:290`, `deploy-trace.ts:151`, `log-excerpt.ts:130`, `thread-discussion.ts:214,232`).
- Normative prose converged: spec F-6 (`:123`), DM-9 (`:269`), NFR-4 (`:374`), reference table (`:58`, `:62-70`), and TDR-0031 C-6 all state the read/write split.
- New case: `pullUpdateNotFound` fixture (`issue-writes.json`) asserts **one** `PATCH`, no retry, `provider.payload.invalid` + `httpStatus: 404` (`github-collection.test.ts` TC-BACKLOG-002). **`provider.not-found` remains genuinely read-scoped.**

### m-2 / D5 — resolved

- The live normative wording no longer claims "no full-array replace" for GitHub; AC-F6-4 (`spec:529`), DM-6 (`:266`), F-6/Flow 6/§8.5, the reference mapping paragraph, TDR-0034 C-6/§3.2/metric, and test-plan TC-BACKLOG-005 now state preservation semantics and the **read-to-write TOCTOU limit**. The only surviving "full-array replace" text is Jira's correct mechanism and historical/review artefacts.
- **Code unchanged**, so the wire mechanism and the wording now agree. TC-BACKLOG-005 assertions are unchanged.

---

## 2. Verdicts on the four scrutiny points

### Point 1 — status-parsing oracle changed meaning (`two-conflicting-final-blocks` → `two-body-bearing-blocks`)

**Acceptable, with one precision caveat.** The rationale is contract-backed: the pre-existing, security-relevant rule is *fail closed on any status/body that cannot be reported faithfully* (RSK-2; reference `Status recovery` row `:131`). Two body-bearing blocks cannot be split without a length header, so refusing (`not JSON`) is the honest outcome; the alternative (reclassify under the later code) is exactly the n-1 defect. The test plan discloses the change (v1.3 revision row; TC-CLI-004 pass criterion).

Non-vacuity of the discriminating cases is real: `body-with-status-line` **fails a last-status-line parser** (it would return 503 with `{"note":"injected"}`) and `two-body-bearing-blocks` **fails a last-status-line parser** (it would return 200 with the second body). The prompt's claim that `two-status-blocks` also fails a last-status-line parser is **not accurate**: the old last-status parser returns the same `200/{number:601}` for that input, so it passes under both. `two-status-blocks` is the discriminator against a *naive first-block* parser (which would throw on the `Connection established` preamble) — it pins the "skip a bodyless intermediate block" rule. Coverage is therefore non-vacuous in both directions, just not via the specific case the prompt named. Recorded as a note in §5, not a defect.

### Point 2 — check-tier arm-B technique (symlink `/usr/bin`+`/bin` minus `gh`; `runLauncher` PATH moved)

**Acceptable; the other launcher cases still exercise what they claim; the no-`gh` arm is asserted; the `gh` dependence is removed, not relocated.** The two `networkLog === []` assertions (`:233`, `:459`) run after `runInstaller`/a self-description `--version`, so the added `gh` stub does not pollute them; composing launcher cases (`status`, `queue add`, `invented`) tolerate the one probe without asserting on it. Arm B asserts `command -v gh` fails (`:622-628`) — if a host `gh` leaked onto the path the test would fail, not silently pass; `ghCalls === []` (`:636`, `:643`) confirms zero spawns. The residual host dependence is on `bash`, `git`, and `bun` — inherent to running the CLI and pre-existing — not on `gh`; nothing about the `gh` branch was relocated. Suite green (11 pass, ~41 s).

### Point 3 — the "remove rather than implement" decisions (D4, D5) did not quietly weaken the contract

**Confirmed not weakened.** D4: NFR-4 (`spec:374`) now has an explicit read clause and an explicit write clause; the reference table's read rows keep `404 → provider.not-found` and its write rows say `any non-2xx (404 included) → provider.payload.invalid with httpStatus`; the delivered code matches exactly (`get` vs `send`). The contract was not deleted — the false statement was replaced with the true one and given an oracle. `provider.not-found` is verifiably read-scoped in code. D5: AC-F6-4 is **stronger and more precise** (one `PATCH`, computed target set, never single-token, never undeclared removal, explicit TOCTOU limit) and its assertions are unchanged; per-label add/remove is explicitly declared not-the-mechanism, not silently dropped.

### Point 4 — `githubCliHostname` is a new public export; the two pinned-surface allowances

**Moved for the export, disclosed, not a relaxation.** `githubCliHostname` is added as an exact name (no wildcard/prefix) to the `./github` `EXPECTED_SURFACE` (`provider-surface.test.ts:76`) and to **both** per-file executable allowances (`content-inventory.test.ts:2852` for `cli-transport.ts`, `:2883` for `index.ts` — the export is genuinely re-exported through `index.ts` and imported by `production.ts`). Both files were changed together and the move is disclosed in the phase-8 note (`EXPECTED_SURFACE … and both per-file executable allowances gain githubCliHostname`). `provider-surface` + `content-inventory` pass; `secret-read-boundary` stays 5 allowlisted entries. The only nit is that the export is not named in TDR-0031's decision text (it is named in the amendment's prose and in the reference/client-seeds docs) — a low documentation note, not an allowance relaxation.

---

## 3. AC compliance table

Evidence tiers: **S** = suite/assertion I ran or read this iteration; **C** = code inspection; **R** = requirement/plan artifact.

| AC | Verdict | Evidence |
|---|---|---|
| AC-F1-1 | Satisfied (control, unchanged) | `capabilities.ts` (9 supported, `declaredGaps: []`); set equality in `closeout-contract.test.ts`; conformance report passed (R/S) |
| AC-F1-2 | Satisfied (control) | `gitlab/capabilities.ts`, `jira/capabilities.ts` gap rows unchanged (C/S) |
| AC-F1-3 | Satisfied (control) | disjointness/closed reasons; broken-adapter control still fires (R/S) |
| **AC-F2-1** | **Satisfied (now with a real process edge)** | `GITHUB_TRANSPORT_MATRIX` keyed by `AdapterOperation`, TC-CLI-001 9/9 equality (S). **New:** TC-CLI-014 drives the production `execFile` runner end-to-end through a stub `gh` for a read and a write — the preferred transport demonstrably carries a real request (S). Previously "satisfied" only by the matrix. |
| AC-F2-2 | Satisfied (control) | Probe once (TC-CLI-011), three closed codes, one `GithubTransportSelection`, exactly one rendered line, no persisted copy, absent fact ⇒ native fetch + zero spawns (S/C) |
| **AC-F2-3** | **Satisfied (production-true)** | No credential in argv, isolated config dir + prompt suppression, no shell/pagination, one argv array, `SIGKILL` (TC-CLI-002/003, S). **New:** TC-CLI-003 pins the exact absolute isolated key set incl. `HOME` absent; TC-CLI-015 proves absoluteness with/without `TMPDIR` and no CWD residue; TC-CLI-014 proves credential-in-env/absent-in-argv through the real runner (S) |
| **AC-F2-4** | **Satisfied (production-true)** | Cross-transport parity table unchanged (TC-CLI-005, S); **new** TC-CLI-014 proves the real CLI transport returns the exact `{status, body}` for a read and a write, so cross-transport identity holds for a real invocation (S) |
| AC-F2-5 | Satisfied (control) | No per-request failover by construction; a failing CLI write is not re-issued (TC-CLI-012, S) |
| AC-F3-1 | Satisfied (control) | `ADAPTER_OPERATIONS[8] = "merge-delivery-request"`; types (R/S) |
| AC-F3-2 | Satisfied (control) | Verbatim `commit_title`/`commit_message`; presence-honest identity (R/S) |
| AC-F3-3 | Satisfied (control) | `expectedHeadSha` guard; non-2xx refusal, no write (S) |
| AC-F3-4 | Satisfied (control) | Already-merged re-read requires provider-asserted truth (S) |
| AC-F3-5 | Satisfied (control) | One `transport.send`, no retry; squash-only, no force/bypass/queue/rebase (S) |
| AC-F4-1 | Satisfied (control) | `started_at`/`completed_at` verbatim, absent stays absent (S) |
| AC-F4-2 | Satisfied (control) | 8192-byte cap, UTF-8 boundary, `byteLength` authority (S) |
| AC-F4-3 | Satisfied (control) | empty ⇒ empty, 404 ⇒ not-found, other ⇒ payload (C/S) |
| AC-F4-4 | Satisfied (control) | no rendering/persistence; artifact exclusion (S) |
| AC-F5-1 | Satisfied (control) | closed 5-key + 6-key shapes, 50/4096 caps (S) |
| AC-F5-2 | Satisfied (control) | `truncated` boundary rule (S) |
| AC-F5-3 | Satisfied (control) | 404/absent ⇒ not-found; other ⇒ payload; empty ⇒ observed empty (C/S) |
| AC-F5-4 | Satisfied (control) | `DeliveryThread` field set pinned both ways (S) |
| AC-F5-5 | Satisfied (control) | body-contradiction control; no write path imports the reader (S) |
| AC-F5-6 | Satisfied (control) | no rendering/persistence; artifact excludes discussion fields (S) |
| **AC-F6-1** | **Satisfied (classification now asserted)** | Two-variant DM-9 input; zero-request refusals; create-never-lands/update-never-creates; normalized return; no new operation/type (C/S). **New:** TC-BACKLOG-002 asserts the content-write 404 classification (one request, `provider.payload.invalid`, `httpStatus: 404`) — the delivered behaviour is now proven, not only described (S) |
| AC-F6-2 | Satisfied (control) | Four-outcome read resolution incl. terminal-first, exact-case, case-collision refusal, native fallback (S) |
| AC-F6-3 | Satisfied (control) | Seven-rule validator, once at construction, captured not thrown, zero requests per refusal (S) |
| **AC-F6-4** | **Satisfied (wording = mechanism)** | Declared-token sweep + unrelated-label preservation (`workflow-map.ts`), unavailable signal refuses, terminal-read refusal label-independent, `done` = one state-only PATCH with zero label requests, non-terminal `field-update` refuses (S). **New:** AC-F6-4/DM-6/TDR-0034 §3.2/reference/test-plan now state the delivered whole-set `PATCH` + TOCTOU limit, so the literal clause and the wire behaviour agree (R/C) |
| AC-F6-5 | Satisfied (control) | Undeclared alias refuses from the map alone, distinct detail (S) |
| AC-F6-6 | Satisfied (control) | no settings type/key/branch/file format; config-surface scan (S) |
| AC-F7-1 | Satisfied (control) | reference-behavior doc has per-op transport, failures, gap posture, absence, both evidence reads, probe/composition, mapping seed (R/C) |
| AC-F7-2 | Satisfied (**extended**) | drift suite parses via one locator, asserts extraction counts **and** now the host-mapping rows (`githubCliHostname`) and the child-environment variables; mutation controls fail by name (I ran it, S) |
| AC-F7-3 | Satisfied (control) | evidence/bodies + GitLab/Jira same-behaviour-or-absent (R/S) |
| AC-F7-4 | Satisfied (control) | refusal-code table, probe/composition claims (R/S) |
| AC-F7-5 | Satisfied (control) | token vocabulary, precedence, four rows, not operator-configurable (R/S) |
| AC-F8-1 | Satisfied (control) | registry 14 steps over 9 operations, every supported op executes, gaps by name (S) |
| AC-F8-2 | Satisfied (control) | capability-absent / no-declared-carrier / declared-gap (S) |
| AC-F8-3 | Satisfied (control) | `installChildProcessGuard` armed canary + per-suite zero counters; mock tier zero live child processes (S). Process-edge cases run in the behaviour tier by declaration, not by a disabled guard |
| AC-F8-4 | Satisfied (control) | landing/comment/create routes + projections; timings; excerpt/discussion/traps (S) |
| AC-F8-5 | Satisfied (control) | two whole-change replays byte-equal; tenants byte-identical (S) |
| AC-F8-6 | Satisfied (**moved exactly**) | `EXPECTED_SURFACE` + both per-file allowances gain `githubCliHostname` (exact name); `harness-imports` site set stays 13 (I ran it, S); `exports-parity` reported green (R) |
| **Controls the plan named** | | |
| NFR-2 | Satisfied (control, **stronger**) | mock tier 0 live network/child; check tier now has zero live `gh` (TC-BIN-057, S) |
| NFR-3 | Satisfied (control, **stronger**) | secret-read boundary 425 files / 5 allowlist unchanged (I ran it, S); credential absent from argv on the real runner (TC-CLI-014) |
| NFR-9 | Satisfied (control) | exactly one process per request, none for an unused runner (TC-CLI-013/014, S) |

**Summary**: 40/40 ACs have a real oracle. AC-F2-1, AC-F2-3, AC-F2-4 moved from "satisfied in letter / mock-only" to **production-true**; AC-F6-1 and AC-F6-4 moved from "described" to "asserted / wording equals mechanism". No AC is unowned, untested, or vacuous; nothing was weakened.

---

## 4. Plan-phase evidence table

| Plan phase | Delivered by | Attributed in `pm-notes`? | Gate/test result recorded? | Notes |
|---|---|---|---|---|
| 1 — ninth operation, posture, landing, registry, dispatch | `edc7114e` | ✔ (in phase-2 note) | ✔ typecheck/targeted/checks/`pnpm check` | Two mirror pins moved, disclosed |
| 2 — CLI transport, probe, async selection, child guard, parity | `787a2643` + `6bbf3c73` (revert) + `528a2cb4` (changeset+pin) | ✘ only `787a2643` named — **m-3 still open** (`6bbf3c73`/`528a2cb4` absent) | ✔ `pnpm check` green-modulo `TC-DAEMON-121` flake | Blanket-biome incident reverted |
| 3 — comment write, content write, seeded map | `ec24bf54` | ✔ (in phase-4 note) | ✔ `pnpm check` 10429 / 0 fail | Four pins moved, disclosed |
| 4 — timings + bounded excerpt | `8ab4512a` | ✔ (in phase-5 note) | ✔ 10453 / 0 fail | Redaction canary at runtime |
| 5 — bounded thread discussion | `94b31b47` | ✔ (in phase-6 note) | ✔ 10476 / 0 fail | One fixture placeholder fixed |
| 6 — reference behavior + drift test | `a3a52ebb` | ✔ (in phase-7 note) | ✔ 10488 / 0 fail | `forbidden-literals` registry forced |
| 7 — trap/determinism, non-decision proofs, changeset verify, aggregate | `dde7b661` + `f71b941e` + `bd1d938c` | ✔ `dde7b661` named in the phase-8 note; `f71b941e`/`bd1d938c` still unnamed (`n-6`/`m-3`) | ✔ `plan validate` valid; 10498 / 4 skips / 0 fail | Docs deferred to lifecycle phase 7 |
| **8 — remediation: host identity, absolute isolated env, offline stub-`gh` process edge, host-independent check tier, normative convergence** | **`48a915a3`** (+ `f8096cbb` notes, `5e5da451` doc reconciliation, `86ed3d24` phase transition) | ✔ self-hash carried by `f8096cbb` → `48a915a3`; phase-7 hash carried by the phase-8 note; **doc-reconciliation note is in the working tree (uncommitted at `86ed3d24`)** | ✔ G1–G10 recorded; **I re-ran the load-bearing suites: `github-cli-transport` 44/0, `install-launcher` 11/0, `reference-behavior`+`collection`+`trap`+`parity`+`provider-surface`+`content-inventory` 76/0, `harness-imports` 6/0, `workflow-map`+`closeout` 63/0, doc-conformance+decision-record 23/0, secret-read-boundary OK (5), doc-distribution no drift (95), forbidden-literals 0, `plan validate` valid** | 24 files, zero phase-8 scope drift (19 declared files + 5 change-folder files); `delivery` deliberately left open pending this review |

**Plan-phase 8 scope check**: `48a915a3` touches exactly the 19 declared file paths plus the change folder (plan/pm-notes/spec/test-plan/review) — no drift. `production.ts` and `index.ts` are the only production files, both declared. `node:child_process` site count stays 13 (`harness-imports` green).

**Doc reconciliation (`5e5da451`)**: it moved `feature-provider-client-seeds`, `feature-adapter-ports`, `feature-cli-entrypoint`, `feature-result-contract`, `doc/overview/glossary`, `doc/guides/tracker-credential-provisioning`, and TDR-0031 C-6 — **none of which are in plan phase-8 `scope.files`**, and plan obligation 8.10 predicted *"no other `doc/spec/**` file moves"*. The movement is legitimate **lifecycle-phase-7 (`system_spec_update`) work** (the read/write 404 split and the host/env contracts genuinely live in those specs), and `system_spec_update.completed` is recorded at `86ed3d24`. The only gap is that at `86ed3d24` the pm-notes *record* of that reconciliation is not yet committed (it exists in the working tree). See §5.

---

## 5. Residual non-blocking notes (each with the owning lifecycle phase)

1. **m-3 — phase-2 remediation hashes still unnamed.** Append `6bbf3c73` (269-file revert) and `528a2cb4` (changeset + `prior-identity` pin) so phase 2 has its full evidence chain. **Owner/phase: `dod_check` (`@pm` bookkeeping).**
2. **N12 — DoR-iteration-2 verdict + spec-v1.2 note + superseded DM-10 sentence.** Not closed; explicitly owned. Either append the two historical notes and correct/annotate the 2026-11-17 *"composition data on the composed runtime"* sentence, or record in the DoD closeout why the historical note stands. **Owner/phase: `dod_check` (`@pm`).**
3. **Doc-reconciliation record not committed at `86ed3d24`.** The working tree contains an uncommitted `pm-notes` note describing the `5e5da451` doc reconciliation and the phase-9 range-lint result; confirm it lands (through the lifecycle primitive) before DoD so the review HEAD and the evidence HEAD agree. Also record that plan obligation 8.10 under-predicted the doc reach (the read/write 404 and host/env contracts live in four feature specs, so the lifecycle-phase-7 re-run *was* required). **Owner/phase: `commit`/`dod_check`.**
4. **Composition glue (`production.ts:1274`) is not directly exercised end-to-end.** TC-CLI-014 constructs the transport directly; no test drives `createProductionComposer` with a `gh` selection and a recording runner to assert the argv hostname the *composer* chose. The pieces are proven and the glue is one line, so this is optional strengthening — not a gap in the delivered AC evidence. **Owner/phase: a future change (or `review_fix` if desired).**
5. **Predictable shared temp base when `TMPDIR` is absent.** With no absolute `TMPDIR`, the isolated base is `os.tmpdir()` and the child roots are the fixed `/tmp/jaiship-gh-{config,state,cache}` — shared and predictable across invocations/users (collision/denial risk, not a secret leak; strictly better than the pre-change CWD-relative path). Worth a follow-up hardening decision (per-invocation suffix vs. the current "adapter creates nothing" rule). **Owner/phase: a future security-hardening change (note it in the DoD risk register).**
6. **Test-plan §TC-CLI-004 fixture list still names `401`/`503`** (`chg-GH-338-test-plan.md` TC-CLI-004) that are not cases in `cli-status-blocks.json` (they pre-date this change as a prose inaccuracy). One-line correction. **Owner/phase: `dod_check` doc hygiene.**
7. **`githubCliHostname` export is not named in TDR-0031's decision text** (only in the amendment prose and the spec/reference docs). Add it to decision item 1's construction surface so the record and the pinned surface agree exactly. **Owner/phase: `dod_check`/future decision pass.**
8. **Pre-existing GH-320 behaviour suites compose with the real binary on the ambient `PATH`** (`tests/behaviour/entrypoint-two-bins.test.ts:32-36,166`, `tests/behaviour/prior-identity-notice.test.ts:120,199`), so on a host with `gh` they spawn one real `gh --version`. They do not *require* it (they pass on the degradation branch), so "nothing in the battery requires a live `gh`" holds and the aggregate gate does not *depend* on `gh`; but the restated test-plan §4 "no test reads the ambient environment … or a real `gh`" is true for this change's suites, not for the whole pre-existing battery. Low; future test-hygiene cleanup. **Owner/phase: `quality_gates`/future change.**

---

## 6. What this review ran (independent evidence, no source touched)

From the repository root with `TMPDIR=$PWD/tmp/tmpdir`:

- `bun test tests/behaviour/providers/github-cli-transport.test.ts` → **44 pass / 0 fail** (incl. TC-CLI-002 host assertion, TC-CLI-014 real-runner read+write, TC-CLI-015 absolute env + no CWD residue + negative control)
- `bun test tests/checks/install-launcher-installer.test.ts` → **11 pass / 0 fail** (~41 s; both composition arms)
- `bun test tests/structure/reference-behavior.test.ts tests/behaviour/providers/github-collection.test.ts tests/behaviour/providers/github-trap.test.ts tests/conformance/github-transport-parity.test.ts tests/structure/provider-surface.test.ts tests/structure/content-inventory.test.ts` → **76 pass / 0 fail**
- `bun test tests/structure/harness-imports.test.ts` → **6 pass / 0 fail** (child-process site set unchanged)
- `bun test tests/behaviour/providers/github-workflow-map.test.ts tests/behaviour/providers/github-closeout.test.ts` → **63 pass / 0 fail**
- `bun test tests/checks/doc-conformance.test.ts tests/checks/decision-record.test.ts` → **23 pass / 0 fail**
- `bun run scripts/checks/secret-read-boundary.ts` → **OK** (425 production files, 5 allowlisted, unchanged)
- `bash scripts/.tests/test-doc-distribution.sh` → **no drift** (95 in-scope docs)
- `bun run scripts/checks/forbidden-literals.ts` → **OK** (5/5 scope classes, 0 violations)
- `bun packages/cli/bin/jaiship.ts plan validate GH-338` → **verdict=valid, tier=full, readyForDevelopment=true**
- `git status --porcelain` → no `.local/` entry; `.local/` absent from the worktree.

The recorded `pnpm check` at the remediation tree is reported green at **10507 pass / 4 pre-existing skips / 0 fail**; the load-bearing suites above reproduce green here. The pre-existing `TC-DAEMON-121` load-sensitivity remains an environment flake (GH-299 precedent), unchanged by this work.

### Environment observation (not a finding)

During this review the working tree showed one modified file — `chg-GH-338-pm-notes.yaml` — written at 08:21 (after HEAD `86ed3d24` at 08:13) by the concurrent lifecycle process: it appends the phase-9 range-lint result and the doc-reconciliation note discussed in §5.3. It is a lifecycle-state append, not a source change, and this review did not touch it. If the review is re-run later, expect a clean tree once that note is committed.

---

## 7. Bottom line

The phase-8 remediation did the hard thing correctly: it repaired the **production process edge** (host identity as required construction data, absolute isolated child environment) and then proved it through the **real `execFile` runner** against an offline stub — the exact class of evidence whose absence let B-1 survive a green seven-phase delivery. It converged the normative prose to the code instead of widening the code, and every movement of a pinned surface is exact and disclosed. **B-1, M-1 and M-2 are resolved; AC-F2-1/2-3/2-4 and AC-F6-1/F6-4 are now satisfied on real evidence.** The change can ship; the remaining items are `@pm` bookkeeping and optional hardening (notes 1–8 above), none of which blocks DoD.
