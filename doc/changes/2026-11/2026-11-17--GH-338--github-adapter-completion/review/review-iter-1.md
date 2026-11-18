# Code Review — Iteration 1

- **Change**: `GH-338` — M3-S4 GitHub adapter completion (code host + backlog)
- **Branch**: `feat/GH-338/github-adapter-completion` → `main-tools` (merge-base `1250d789`, 25 commits)
- **Reviewer mode**: local (`doc/changes/2026-11/2026-11-17--GH-338--github-adapter-completion/`)
- **Artifacts read**: `chg-GH-338-spec.md` v1.2, `chg-GH-338-test-plan.md` v1.2, `chg-GH-338-plan.yaml`, `chg-GH-338-pm-notes.yaml`, `readiness-review/readiness-iter-{1,2,3}.md`, TDR-0032…0034, ADR-0005 pointer, the full `1250d789...HEAD` diff (105 files, +16 949 / −319)
- **Date**: 2026-11-18

## Status: **FAIL**

One blocker (`B-1`: the CLI-first transport cannot work against the real GitHub API — `--hostname api.github.com` resolves to `api.api.github.com`), two majors (`M-1`: the child environment is not fully isolated, so every composing CLI invocation writes `.local/state/gh/device-id` into the caller's working directory — reproduced, and the residue is in this repo; `M-2`: `pnpm check` now spawns a real `gh`, which falsifies the test plan's "no test requires a live `gh`" claim and makes the check tier host-dependent), four minors and six nits.

Everything else is strong: the whole 40-AC set has a real, non-vacuous oracle; the plan's seven phases are delivered and recorded; the delivered `done` closeout write is byte-identical; the evidence bounds, the workflow-map read/write symmetry, the conformance registry and the reference-behavior drift test are all genuinely non-vacuous. **No source file was modified and no git operation (write) was performed.**

---

## 1. Findings

### B-1 — BLOCKER: the preferred CLI transport is non-functional against GitHub (`--hostname api.github.com` → `api.api.github.com`)

**Location**: `packages/adapters/src/github/cli-transport.ts:280` (`const host = options.host ?? new URL(request.url).host;`), consumed at `argvFor` `cli-transport.ts:232` (`argv.push(... "--hostname", host, "--include")`); production never supplies `host` (`packages/cli/src/production.ts:1273-1282`), and the instance's `baseUrl` is `https://api.github.com` (`production.ts:378`).

**What is wrong**: `gh api --hostname` takes a *host identity* (`github.com`, or a GHES host), not the REST host. The transport passes the REST host, so `gh` builds `https://api.api.github.com/...`.

**Evidence (executed against the local `gh` 2.91.0, inside the declared window `2.0.0–2.99.99`)**:

```
$ env -i PATH=/usr/bin:/bin GH_CONFIG_DIR=… GH_PROMPT_DISABLED=1 NO_COLOR=1 \
    GH_NO_UPDATE_NOTIFIER=1 GH_TOKEN=… gh api /user --hostname api.github.com --include
error connecting to api.api.github.com
check your internet connection or https://githubstatus.com

$ … gh api /user --hostname github.com --include
HTTP/2.0 401 Unauthorized        # reaches api.github.com (invalid token ⇒ 401)
```

Query-string paths behave correctly (`/repos/cli/cli/issues?state=open&per_page=100&…` → 401, i.e. the path shape is right); only the host is wrong. Because the composition default is `prefer-cli` and the probe (`gh --version`) *succeeds*, every composing invocation selects the CLI transport and **every provider request then fails** (`cli-transport.ts:300-303` throws `GitHub CLI exited with status N` → `client.ts:327` classifies `provider.payload.invalid` without status). The API fallback is not reached, because there is no per-request failover (by design).

**Violated**: F-2 / AC-F2-1 ("the vendor CLI preferred … with 100 % coverage" — a transport that cannot carry a single request is not a transport), AC-F2-4 and AC-F2-5 in substance (a real replay is impossible: the transport cannot obtain any status), the ticket AC "full primitive coverage over `gh` CLI with API fallback", and the change's own reference-behavior statement that the CLI "acts as an authenticated API caller" (`feature-adapter-reference-behavior.md:110`).

**Why the gates are green**: every CLI case injects a `GithubChildRunner` that *ignores* argv and synthesises the status block, and the golden fixture pins the wrong argv as the oracle: `tests/fixtures/providers/github/cli-argv.json` (`"--hostname", "api.github.com"`) asserted by TC-CLI-002 (`tests/behaviour/providers/github-cli-transport.test.ts:104-124`). Test-plan GAP-TP-3 ("the preferred transport is proven against an injected runner, never a live binary") is precisely the escape hatch, and this is the class of defect it admits.

**Required remediation**

1. Derive the CLI hostname from the declared instance host, not from the REST URL: `api.github.com` → `github.com` (and a GHES instance host unchanged), passed explicitly by composition (add the hostname to the composition facts rather than re-deriving it from `request.url` inside `argvFor`).
2. Update `cli-argv.json` and TC-CLI-002 to the corrected argv; add a case asserting the argv host for both the cloud and the GHES-shaped instance, so the mapping is pinned by data.
3. Add an **offline stub-binary smoke test**: an executable `gh` shim placed on an injected `PATH` that records argv and stdin and emits a canned `--include` block. Drive the production `execFileRunner` (no injected runner) through one read and one write and assert host, method, path, body, and the parsed `{status, body}`. This proves the real process edge end-to-end with zero network and zero live GitHub, and it would have caught B-1.

### M-1 — MAJOR: the child environment is not isolated; every composing invocation writes into the caller's working directory

**Location**: `packages/adapters/src/github/cli-transport.ts:193-223` (`resolveGithubCliConfigDirectory`, `environmentFor`).

**What is wrong**: the constructed child environment contains only `PATH`, `GH_CONFIG_DIR`, `GH_PROMPT_DISABLED`, `NO_COLOR`, `GH_NO_UPDATE_NOTIFIER`, `GH_TOKEN?`. `HOME` and all `XDG_*` variables are dropped, and `GH_CONFIG_DIR` falls back to the **relative** `.jaiship-gh-config` when the injected `TMPDIR` is absent. With no `HOME`, `gh` resolves its XDG state root relative to the process CWD.

**Evidence (reproduced)**:

```
$ mkdir /tmp/ghprobe && cd /tmp/ghprobe && env -i PATH=/usr/bin:/bin GH_CONFIG_DIR=…/cfg \
    GH_PROMPT_DISABLED=1 NO_COLOR=1 GH_NO_UPDATE_NOTIFIER=1 gh --version
gh version 2.91.0 …
$ find . -type f
./.local/state/gh/device-id
```

This is not hypothetical: the residue exists in this repository at `.local/state/gh/device-id` (mtime `2026-11-18T03:11:22`, i.e. during delivery), untracked and **not** covered by `.gitignore`, so `git status --porcelain` is dirty after any composing command run in a checkout. The launcher probes on **every composing invocation** (`bin-launcher.ts:74-88`), including commands that never touch GitHub.

**Violated**: spec §20 ("the vendor CLI's own stored configuration is isolated"), §21 / Table C Child execution & Credential rows ("adapter-constructed environment"), F-2's "nothing is persisted", and the change's own claim that the gate leaves the tree clean. AC-F2-3 is *literally* satisfied (it names only the config-directory and prompt-suppression variables), which is exactly why the golden environment in TC-CLI-003 (`github-cli-transport.test.ts:126-152`) pins the incomplete set as an oracle.

**Required remediation**

1. Set `XDG_CONFIG_HOME`, `XDG_STATE_HOME`, and `XDG_CACHE_HOME` to absolute directories derived from the isolated base; never point them at the operator's home.
2. Make the isolated base absolute in every case (fall back to `os.tmpdir()`, never to a CWD-relative path).
3. Extend the pinned environment in TC-CLI-003 and the `environment` block of `cli-argv.json`; add an assertion that no constructed value is relative.
4. Add the cleanliness assertion from B-1's stub-shim case: run a real `gh` invocation with the constructed env in a scratch CWD and assert the CWD is unchanged afterwards (offline; `gh --version` needs no network).
5. Delete the committed-tree residue and ignore `.local/` if the mechanism cannot be fixed in the same pass.

### M-2 — MAJOR: `pnpm check` now spawns a real `gh`, falsifying the recorded hermeticity claim

**Location**: `packages/cli/src/bin-launcher.ts:74-88` (probe on every composing invocation) → `tests/checks/install-launcher-installer.test.ts` (unchanged by this change; `status --json`, `queue add --json`, `invented` all compose).

**What is wrong**: with `gh` present (this host: 2.91.0, inside the window) the installed launcher in the passthrough test performs one live `gh --version` and, on success, selects the CLI transport. That is a live child process and an ambient-`PATH` dependency in the aggregate gate. NFR-2's own scope ("the mock tier") stays true as written, but the test plan's governing statements are now false: §1 "Nothing here requires a live `gh` binary, a live token, or network access" and §4 (line 188) "no test reads the ambient environment, network, or a real `gh`". The outcome is also host-dependent — on a host with an out-of-window `gh` the same test exercises a different composition branch. Nothing in the change records this.

**Required remediation (either arm, recorded)**

1. Make the probe injectable/disableable on the launcher path that suite uses (`BinLauncherOptions.githubTransportPolicy` / `githubCliRunner` already exist — pass an `api-only` policy or a recording runner from that test), or expose an env-level override the installed launcher forwards; **or**
2. Amend NFR-2 and test plan §1/§4 to declare the launcher-spawn suite's one live `gh` (and the `api-only` escape), and record the determinism note in `pm-notes`.

Also note the knock-on cost: every ADOS command now pays a `gh --version` spawn and, per M-1, a CWD write — including pure local commands.

### m-1 — MINOR: DM-9's content-write failure classification is not implemented and not tested

**Location**: `packages/adapters/src/github/client.ts:302-330` (`send` maps every non-2xx, including 404, to `provider.payload.invalid`) vs `chg-GH-338-spec.md:269` (DM-9: "404 → `provider.not-found`; any other non-2xx → `provider.payload.invalid` with the structured `httpStatus`…") and F-6 (line 123: "every failure is classified exactly as the other writes are (404 → not-found, …)").

**What is wrong**: the delivered writes (delivered `write-work-item`, `transition-work-item`, and the new `writeComment`/`writeDeliveryRequest`) all classify 404 as `provider.payload.invalid` + `httpStatus: 404`; only the reads use `providerNotFoundFailure`. No case asserts a content-write 404 either way (TC-BACKLOG-002 covers happy paths and missing-input refusals only), and the reference-behavior document's `write-delivery-request` row follows the code, not DM-9 — so the normative prose and the code disagree and the drift test cannot see it (it never compares classification prose for writes).

**Required remediation**: pick one truth and make it explicit. Either implement DM-9's 404 → `provider.not-found` for the content write (and add a case), or revise DM-9 and F-6 to the delivered write classification with a recorded rationale, and state it in the reference-behavior failure table. A content-write 404 is a real case (a deleted/renumbered PR).

### m-2 — MINOR: `label-swap` writes are a whole-array `PATCH`, against AC-F6-4's literal "no full-array replace"

**Location**: `packages/adapters/src/github/client.ts:569-573` (`send("PATCH", path, { labels: plan.write.labels })`), `workflow-map.ts:305-308`.

**What is wrong**: AC-F6-4, DM-6 and TDR-0035 §3.2 say a label swap removes only declared tokens, adds the row token, and "no full-array replace occurs". The implementation sends the entire recomputed array in one `PATCH /issues/{n}`, which is the full-array-replace wire mechanism. The *oracle* (TC-BACKLOG-005) reads the clause as preservation semantics ("every unrelated label unchanged", "never a single-token array") and the code satisfies that reading — but the literal clause is unmet, and a label added by someone else between the caller's read and the write is silently dropped (TOCTOU). Relatedly, TDR-0035 §3.2 says the write "reads the current label set"; the delivery realises this as caller-supplied input (`current: { deliveryState, labels? }`, `client.ts:118`), which is the right way to get zero-request refusals but is a difference the record should state.

**Required remediation**: either (a) restate AC-F6-4/DM-6/TDR-0035 §3.2 to the preservation semantics and record the current-read-as-input realisation in TDR-0035, or (b) issue per-label add/remove requests (`POST /issues/{n}/labels`, `DELETE /issues/{n}/labels/{name}`) and update TC-BACKLOG-005. Do not leave the normative wording and the wire behaviour disagreeing.

### m-3 — MINOR: plan-phase evidence gaps (unattributed commits)

**Location**: `chg-GH-338-pm-notes.yaml:302-308` (phase-2 note), `:59-93` (phase-7 note).

**What is wrong**: (a) the phase-2 note says its remediation commit is "recorded in the phase-3 note", but the phase-3 note contains no hash — the remediation is in fact `6bbf3c73` (269-file revert) plus `528a2cb4` (changeset + `prior-identity` pin), neither of which is named anywhere in `pm-notes`; only `787a2643` is. (b) The hash chain is deliberately one note lagged, so the **last** plan phase has no attribution at all: phase 7's substantive commit is `dde7b661` (+ `f71b941e` notes rewrite, `bd1d938c` phase-complete), and only phase 6's `a3a52ebb` is named in the phase-7 note. Every other phase (3–6) is correctly attributed.

**Required remediation**: append the missing hashes (phase-2 remediation `6bbf3c73` + `528a2cb4`; phase-7 `dde7b661` with `f71b941e`/`bd1d938c` as notes/closure) so each of the seven phases has a named commit plus its gate result.

### m-4 — MINOR: two DoR delivery notes only partially carried (N6, N12)

- **N6** (optional): `doc/decisions/TDR-0032-…md` item 8 still reads "keep their delivered shape … unchanged apart from documentation" while TDR-0035 §1 adds the optional `workflowMap`. The DoR verdict allowed this ("Phase 1 (optional)") and the coder recorded it as an accepted residue; it stays a live contradiction between two committed records.
- **N12** (`@pm` bookkeeping): `pm-notes` has no DoR iteration-2 verdict note and no spec-v1.2 revision note, and still carries the superseded DM-10 phrasing "composition data on the composed runtime" (`pm-notes:422`) that DoR R3 replaced. The iteration-3 note alone is present.

**Required remediation**: either align TDR-0032 item 8/step 2, or record the contradiction as an accepted residue in the decision index/notes; append the iteration-2 verdict and v1.2 notes and correct the superseded DM-10 sentence.

### m-5 — MINOR (recorded SCOPE_DEVIATION): the changeset was authored in a phase whose scope does not declare it

**Location**: `.changeset/gh-338-github-adapter-completion-minor.md` is declared in plan **phase 7** `scope.files`, but was authored in the phase-2 range (`528a2cb4`). Recorded in `pm-notes:311-317` as the GH-299 precedent ("phase 7 verifies it instead of authoring it"). Substantively forced (the release guard fails without a changeset for a minor version impact) and disclosed, so it is legitimate — but the per-phase scope declaration and the commit boundary disagree.

**Required remediation**: none beyond moving the declaration to the phase that owns the commit (or keeping the current note and accepting it as recorded). No further action if `@pm` records the acceptance explicitly.

### Nits

- **n-1** `parseIncludedResponse` (`cli-transport.ts:250-262`) scans for a status line across the **entire** stdout, body included, and takes the last match; a body line matching `HTTP/<ver> <code>` would override the real status. Restrict the search to the pre-body region (or stop at the first blank line after the first status block) and extend `cli-status-blocks.json` with a body containing such a line.
- **n-2** `provider.cli.capability-unsupported` is reachable only when the version line is unparsable — the probe cannot detect a genuinely missing capability (`cli-transport.ts:330-335`). Given B-1, a capability probe is what the design needs; otherwise document that "capability" means "version parse" and that a probe pass does not imply the transport works.
- **n-3** `chg-GH-338-test-plan.md:402` still names `resolveGithubTransportSelection`, which does not exist; the shipped names are `resolveCompositionTransportSelection` (launcher edge) and `resolveTransportSelection` (pure). This is the recorded DoR residue (N1/R10), so it is accepted — but the test plan is a committed artifact that now names a non-existent symbol.
- **n-4** All 25 commit subjects are `chore(GH-338): update <path>` / `feat(GH-338): update <path>` while the plan declares a meaningful `summary` per phase (e.g. `feat(GH-338): ninth operation, capability posture and conformance parity`). `lint-commit-range` passes (VERDICT: PASS, 25/25), but the history is opaque and does not match the plan's declared summaries.
- **n-5** `client.ts:623-625` refuses a content-write *update* whose identity is not numeric — a refusal detail not listed in DM-9's required-input set nor in the reference behavior. Either list it as a declared adapter-local refusal or drop it.
- **n-6** Plan phase-7 `scope.files` lists the four feature specs and two indexes, but those landed in the lifecycle-phase-7 commit `ab6a0d69`; plan-phase-7 completion evidence therefore covers only part of its declared file list (recorded in the phase-7 note). Harmless, but the two "phase 7"s should be distinguished in the note.

---

## 2. Verdicts on the six scrutiny points

| # | Point | Verdict |
|---|---|---|
| 1 | Child-process guard (`mock.module` substitution + explicit restore) — cross-suite contamination and non-vacuity | **Acceptable as delivered, empirically sound, fragile by construction.** `installChildProcessGuard` (`tests/behaviour/providers/support.ts:172-196`) re-registers the real module because `mock.restore()` never undoes a substitution — the reason recorded in `pm-notes:331-336` is correct and the fix is the right one. Non-vacuity is proven by a real firing canary (`tests/conformance/github-transport-parity.test.ts:243-253`: `execFile(...)` from the file's own top-level import throws, `guard.calls === ["execFile"]`), which exercises the same already-loaded-binding path the adapter's `execFile` import takes, plus a per-suite zero-spawn counter in `mock-conformance.test.ts:523-560`. Cross-suite contamination: I ran the full `tests/behaviour` suite (7041 pass) after `tests/conformance` (2242 pass) in the same order and the daemon/live suites spawned normally, and the whole battery is green here — no observed leakage. Residual fragility: the guard relies on process-scoped Bun module-mock semantics and on capturing `actual` while no substitution is active; a future nested/concurrent install would capture the mock as "real". Worth a one-line comment/assert (capture `actual` once at module scope, or assert the captured module has a callable `spawn`). |
| 2 | Launcher issues one `gh --version` probe per composing invocation; `tests/checks/install-launcher-installer.test.ts` then spawns one real `gh` — acceptable under the offline-determinism claim? | **The offline claim stays true as written for the mock tier (NFR-2: "0 live network calls and 0 live child processes in the mock tier"), but the broader claims are now false and the check tier became host-dependent.** Test plan §1 ("Nothing here requires a live `gh` binary, a live token, or network access") and §4 ("no test reads the ambient environment, network, or a real `gh`") no longer hold for `pnpm check`. On this host `gh` 2.91.0 is present, so that suite selects the CLI transport; on a host without `gh` it takes the degradation branch. Nothing records this. → **M-2**; must be declared and made deterministic (inject/disable the probe there, or amend the claims). |
| 3 | `TC-DAEMON-121` load sensitivity | **Pre-existing environment flake; may count as such (GH-299 precedent), and it is now re-proven.** The file is untouched by this change. In isolation: **1 pass**, `samples: 5`, cancellation 232.3–234.1 ms vs the 250 ms bound, stop 232.3–234.1 ms vs 1000 ms — passing but with only ~7 % headroom on the cancellation bound, which is why full-suite load tips it. In the full `tests/behaviour` run under load here (7045 tests, 784 s): **7041 pass / 4 pre-existing skips / 0 fail**, i.e. green. No action for this change; note that the fixture's bound is intrinsically tight and will flake again under CI load. |
| 4 | Delivered `done` transition byte-identical to pre-change behaviour | **Verified against the pre-change code, not only the new tests.** Pre-change (`git show 1250d789:packages/adapters/src/github/client.ts`, `transitionWorkItem` at 455-460): one `PATCH /issues/{n}` with body `{state:"closed"}`, no label access. Post-change (`client.ts:558-574` → `planGithubTransition`, `workflow-map.ts:269-277`): the seed's `done` row is validated to be the `field-update` row on native `closed`, the plan performs zero I/O, and the write is `send("PATCH", path, { state: "closed" })` — **byte-identical body, one request, zero label reads/writes**. The only new failure mode is a caller-injected invalid map (a declared, additive refusal). Oracles: `tests/behaviour/providers/github-closeout.test.ts:309-343` asserts `writes[0].body === '{"state":"closed"}'`, no `labels` request, and success on a labelless issue; TC-BACKLOG-006's paired half and the `DELIVERED_OUTCOME_DIGEST` trap control (`tests/structure/trap-catalog.test.ts:332-349`) complete the protection. **Confirmed.** |
| 5 | Four moved pins in phase 1, two in phase 2 (plus phase-3/5/6/7 pins) — forced or convenience? | **All forced or disclosed; none is a convenience move.** (a) `tests/conformance/live/live-entrypoint.test.ts` closed-set list and `tests/behaviour/closeout-capabilities.test.ts` GitHub/Jira posture pins — mechanical mirrors of the closed set; the closed-set change makes them false by construction. (b) `tests/behaviour/providers/github-landing.test.ts` TC-LAND-008 (phase 3) asserted the content write was a *gap with no member*; it is now supported — the assertion had to invert. (c) `tests/conformance/broken-adapter-control.test.ts` (phase 3) is the test-only wrapper that must forward the two new client members or its fail-closed control stops compiling. (d) `tests/checks/prior-identity-hermetic.test.ts` (phase 2) pinned "production.ts holds the one `fetch` site"; the change moves that seam into the adapter's exported `createGithubNativeTransport`, so `fetches === 0` + a `createGithubNativeTransport(` reference is the faithful form of the same rule. (e) `scripts/checks/forbidden-literals.registry.json` (phase 6) — the docs corpus fails closed on an unregistered user-facing doc; forced. (f) The changeset in phase-2 range is a deliberate, recorded deviation (m-5). Every move is disclosed in the phase notes; nothing widened a contract, cap, case identity or AC. |
| 6 | Were the 12 DoR delivery notes each honoured by their owning phase? | **10 fully, 2 partially (both recorded).** N1 ✓ (`resolveTransportSelection` + `resolveCompositionTransportSelection` shipped; no alias — residue: stale test-plan symbol, n-3) · N2 ✓ (firing canary in `github-transport-parity.test.ts`, counter in `mock-conformance.test.ts`) · N3 ✓ (`tests/types/provider-views.type-test.ts` untouched) · N4 ✓ (TC-CLI-010/011 carry the four self-description paths at zero spawns + the single-`createProductionComposer(` structural pin; the fifth path is permitted by the note) · N5 ✓ (config-surface scan in `tests/structure/config-contract.test.ts`, `reference-behavior.test.ts` left to phase 6) · N6 ✗ partial (TDR-0032 item 8 unchanged; optional per the verdict — m-4) · N7 ✓ (no read/label access on the `done` path; TC-FLOOR-001) · N8 ✓ (phase 7 extended assertions only; one declared trap amendment controlled by a digest) · N9 ✓ (probe strictly behind composition; entrypoint `await` inside the containment `try`, `entrypoint.ts:419-440`) · N10 ✓ (spawn count driven on an already-selected transport) · N11 ✓ (`labelless-open-issue` / `labelless-closed-issue` keys, signal-refusal fixture native `open`) · N12 ✗ partial (`@pm` bookkeeping; iteration-2/v1.2 notes and the superseded DM-10 sentence remain — m-4). |

---

## 3. AC compliance table

Evidence tiers: **S** = suite/assertion I ran or read; **C** = code inspection; **R** = requirement/plan artifact.

| AC | Verdict | Evidence |
|---|---|---|
| AC-F1-1 | Satisfied | `capabilities.ts:16-27` (9 supported, `declaredGaps: []`); `tests/structure/closeout-contract.test.ts` set equality; `tests/behaviour/provider-capabilities.test.ts`, `closeout-capabilities.test.ts:49-62` (S), conformance report `passed` (S) |
| AC-F1-2 | Satisfied | `gitlab/capabilities.ts:23` (`adapter-not-implemented`), `jira/capabilities.ts:24` (`provider-unsupported`), no other row moved (C/S) |
| AC-F1-3 | Satisfied | Disjointness + closed reasons via `provider-capabilities`/`conformance-coverage`; broken-adapter control still fires (`tests/conformance/broken-adapter-control.test.ts`) (S) |
| AC-F2-1 | Satisfied | `GITHUB_TRANSPORT_MATRIX` keyed by `AdapterOperation` (exhaustive by type), TC-CLI-001 asserts 9/9 equality with `ADAPTER_OPERATIONS` (C/S) |
| AC-F2-2 | **Satisfied in letter; undermined by B-1** | Probe once, three closed codes, one `GithubTransportSelection` value, exactly one rendered line, no persisted copy, no key on the composed program, absent fact ⇒ native `fetch` + zero spawns: `production.ts:843-874, 906-915`, `bin-launcher.ts:74-88`, TC-CLI-010/011 (S). But the probe passes while the transport cannot carry a request → the composition decision is wrong in outcome (B-1) |
| AC-F2-3 | **Satisfied in letter; two oracle defects** | No credential in argv (filtered), `GH_CONFIG_DIR` + `GH_PROMPT_DISABLED` present, no shell/pagination, one argv array, `SIGKILL`: TC-CLI-002/003 (S). But the golden argv pins the broken host (B-1) and the golden env pins the incomplete isolation (M-1) |
| AC-F2-4 | **Not satisfied in production** (mock parity only) | Route-table parity through both transports is green (`tests/conformance/github-transport-parity.test.ts`, 10 routes, S), but the real CLI transport cannot obtain any status, so cross-transport identity does not hold for a real invocation (B-1) |
| AC-F2-5 | Satisfied | No per-request failover by construction (`client.ts` single `transport.send` per path); transport failure → `payload.invalid` without status (`client.ts:296-299`); mid-run failure cases (S) |
| AC-F3-1 | Satisfied | `ADAPTER_OPERATIONS[8] = "merge-delivery-request"`; `MergeDeliveryRequestInput`/`Outcome` (`ports.ts:252-284`); type probe `tests/types/merge-delivery-request.type-test.ts` (`typecheck` green, S) |
| AC-F3-2 | Satisfied | `client.ts:645-648` transmits `commit_title`/`commit_message` verbatim; `merge_commit_sha`/`sha` present only when supplied (`:661-668, 689-696`); landing fixtures + trap entries `GITHUB-LANDING-CRAFTED-METADATA` / `-IDENTITY-ABSENT` (S) |
| AC-F3-3 | Satisfied | `sha: expectedHeadSha` guard; non-2xx → classified refusal with status, no write (`client.ts:648, 698-710`); `GITHUB-LANDING-GUARD-REFUSAL` (S) |
| AC-F3-4 | Satisfied | Already-merged path re-reads and requires `merged === true` (`client.ts:650-669, 699-706`); `GITHUB-LANDING-ALREADY-MERGED-READBACK` (S) |
| AC-F3-5 | Satisfied | Single `transport.send`, no retry loop; strategy type is `"squash"` only, no force/bypass/queue/rebase fields (`ports.ts:256-267`); type test proves non-representability (S) |
| AC-F4-1 | Satisfied | `normalize.ts:251-263` copies `started_at`/`completed_at` verbatim, absent stays absent; TC-CHECK-001/002 assert no `durationMs` (S) |
| AC-F4-2 | Satisfied | `GITHUB_LOG_EXCERPT_MAX_BYTES = 8192`; `boundLogExcerpt` trims on a UTF-8 boundary, `byteLength` = returned bytes, `truncated` authority; TC-CHECK-004…009 (exact/over/exactly-8192/multi-byte) (S) |
| AC-F4-3 | Satisfied | empty ⇒ observed empty, 404 ⇒ `provider.not-found`, other non-2xx/transport ⇒ `payload.invalid` (`log-excerpt.ts:127-143`) (C/S) |
| AC-F4-4 | Satisfied | No rendering/logging/persistence in the module; artifact exclusion asserted by `tests/conformance/artifact.test.ts:333-360` (`excerpt`, `bodyTruncated`, `startedAt` absent from the artifact) (S) |
| AC-F5-1 | Satisfied | Closed 5-key shape + 6-key comments; `comments(first: 100)` sliced to 50; 4096-byte body cap (`thread-discussion.ts:25-28, 68-69, 155`); TC-THREAD-001/002/003 (S) |
| AC-F5-2 | Satisfied | `truncated = bounded.length < total \|\| any bodyTruncated` (`:169`); TC-THREAD-002/003 prove exact boundary and the "fewer than total" arm (S) |
| AC-F5-3 | Satisfied | 404 / provider-absent node ⇒ not-found, other non-2xx / transport / malformed ⇒ `payload.invalid` with status, zero-count empty list observed empty (`:211-237`) (C/S) |
| AC-F5-4 | Satisfied | `DeliveryThread` field set pinned both directions (`tests/types/delivery-thread.type-test.ts`); closed set/capability/projection unchanged (`tests/structure/closeout-contract.test.ts`, artifact suite) (S) |
| AC-F5-5 | Satisfied | Body-contradiction control (`tests/behaviour/providers/github-closeout-thread-privacy.test.ts`); no write path imports the reader (source scan) (S) |
| AC-F5-6 | Satisfied | No rendering/persistence in the module; artifact suite asserts no discussion/body field (S) |
| AC-F6-1 | Satisfied (classification detail → m-1) | Two-variant DM-9 input (`client.ts:92-107, 595-639`); required-input refusals with zero requests; create never lands / update never creates; returns the normalized view; no new operation or core type (C/S + conformance projection) |
| AC-F6-2 | Satisfied | Four-outcome read resolution (`workflow-map.ts:184-226`) incl. terminal-first, exact-case precedence, case-collision refusal via `provider.payload.invalid` naming label + token, native fallback; never refuses on unknown/labelless/unavailable (`normalize.ts:329-357`); TC-BACKLOG-003/008/011 (S) |
| AC-F6-3 | Satisfied | Validator implements the seven rules (`workflow-map.ts:84-153`), runs **once** at construction on the resolved map (`client.ts:248-253`, pinned by a source scan asserting one call), captured not thrown, every operation refuses by name with zero requests; seed held to the same checks; injected map drives both directions; TC-BACKLOG-004/010 (S) |
| AC-F6-4 | **Satisfied per oracle; literal "no full-array replace" unmet** | Declared-token sweep + unrelated labels preserved (`workflow-map.ts:305-308`), unavailable signal refuses (`:298-303`), terminal-read refusal label-independent (`:292-297`), `field-update` `done` = one state-only PATCH with zero label requests, non-terminal `field-update` alias refuses (`:269-277`); TC-BACKLOG-004/005/006 + TC-FLOOR-001 (S). Whole-array `PATCH` → m-2 |
| AC-F6-5 | Satisfied | Undeclared alias refuses from the map alone, zero requests, distinct detail from the terminal-read refusal (`workflow-map.ts:261-267`); TC-BACKLOG-007 (S) |
| AC-F6-6 | Satisfied | No settings type/key/branch/file format: `githubConfigSurfaceFailures` scan over the whole subpath (+ mutated temp copy) in `tests/structure/config-contract.test.ts`, `config-default-positions.test.ts`; TC-FLOOR-007 (S) |
| AC-F7-1 | Satisfied | `doc/spec/features/feature-adapter-reference-behavior.md` has per-operation transport, failure identities, gap posture, absence table, both evidence reads, probe/composition, mapping seed (R/C) |
| AC-F7-2 | Satisfied | `tests/structure/reference-behavior.test.ts` parses the document through one locator, asserts extraction counts (9 ops, 3 postures, ≥6 absence signals, 3 codes, 4 seed rows) **before** comparing, and fails on one-row/one-digit mutations and deleted prose (S) |
| AC-F7-3 | Satisfied | §"Bodies and log excerpts are evidence…" + the GitLab/Jira same-behaviour-or-absent paragraph (doc:104-106); TC-REF-004 (R/S) |
| AC-F7-4 | Satisfied | Refusal-code table, "probe … never in the mock tier", "no per-request failover", one selection value with one line (doc:108-128); TC-REF-005 (R/S) |
| AC-F7-5 | Satisfied | Token vocabulary, precedence table, four rows + mechanisms, unmapped tokens/aliases, "not operator-configurable", agreeing with `GITHUB_WORKFLOW_MAP_SEED` (doc:130-149); TC-REF-006 (R/S) |
| AC-F8-1 | Satisfied | Registry = 14 steps over the 9-operation closed set (set equality asserted); landing step executes against the mock tenant; every supported operation executes; every declared gap (GitLab/Jira) encountered with its exact reason; broken control fires (S) |
| AC-F8-2 | Satisfied | `capability-absent` / `no-declared-carrier` for GitHub, `declared-gap` preserved for GitLab/Jira (`mock-conformance.test.ts:886-912`) (S) |
| AC-F8-3 | Satisfied (mock tier) | `installChildProcessGuard` beside `installThrowingFetchGuard`, armed canary + per-suite zero counters; both guards hold through the whole mock tier (S). See M-2 for the check-tier host dependence (outside the mock tier) |
| AC-F8-4 | Satisfied | Landing/comment/create routes + expected projections in `tenant.json`; timings in the check-runs projection; excerpt/discussion/trap entries with resolving `fixtureReference`s; TC-PARITY-003/004/005 roll-up over the seven behaviours (S) |
| AC-F8-5 | Satisfied | TC-PARITY-007 two whole-change replays byte-equal + committed tenants byte-identical across loads (S) |
| AC-F8-6 | Satisfied | `provider-surface.test.ts` export list updated exactly (+35 names) and the per-file inventory updated; `exports-parity` (5 publishables, `attw --pack`) green; `harness-imports` 12 → 13 with the new site (S) |

**Spec/plan compliance summary**: 40/40 ACs have a real oracle; **AC-F2-4 is not satisfiable in production** because of B-1 and AC-F2-3/AC-F2-2 are satisfied only in letter; AC-F6-4 is satisfied per the test-plan reading but not per its literal wording (m-2). No AC is unowned, untested, or vacuous.

---

## 4. Plan-phase evidence table

| Plan phase | Delivered by | Commit attributed in `pm-notes`? | Gate/test result recorded? | Notes |
|---|---|---|---|---|
| 1 — ninth operation, capability posture, landing member, registry, dispatch, mock route | `edc7114e` (35 files) | ✔ `edc7114e…` (in the phase-2 note, per the one-lag convention) | ✔ typecheck; targeted suites 2051; checks 1174; fixtures 11; `git diff --check`; **`pnpm check` 10306 pass / 0 fail** | Two pins moved (mirror lists), disclosed |
| 2 — CLI transport, probe, async composition selection, child guard, parity | `787a2643` (294 files) + `6bbf3c73` (269-file revert) + `528a2cb4` (changeset + pin) | ✘ only `787a2643` named; the remediation commits are unattributed (*m-3*) | ✔ `pnpm check` 10354 pass / 4 skips / **1 fail (TC-DAEMON-121, load-sensitive)** — completed green-modulo-environment-flake | Blanket-`biome --write` incident reverted in `6bbf3c73`; verified: net phase-1+2 = 25 files |
| 3 — comment write, content write, injected seeded map | `ec24bf54` (34 files) | ✔ `ec24bf54…` (in the phase-4 note) | ✔ G1–G10, **`pnpm check` 10429 pass / 0 fail** | Four pins moved (forced), disclosed; N5/N7/N11 carried |
| 4 — timings + bounded excerpt | `8ab4512a` (16 files) | ✔ `8ab4512a…` (in the phase-5 note) | ✔ G1–G10, **10453 pass / 0 fail** | Redaction canary constructed at runtime (in-scope fix) |
| 5 — bounded thread discussion | `94b31b47` (15 files) | ✔ `94b31b47…` (in the phase-6 note) | ✔ G1–G10, **10476 pass / 0 fail** | One in-scope fixture placeholder corrected |
| 6 — reference behavior + drift test | `a3a52ebb` (6 files) | ✔ `a3a52ebb…` (in the phase-7 note) | ✔ G1/G4/doc-distribution/typecheck/`git diff --check`, **10488 pass / 0 fail** | One pin moved (`forbidden-literals.registry.json`, forced) |
| 7 — trap/determinism completeness, non-decision proofs, changeset verify, aggregate gate | `dde7b661` (5 files) + `f71b941e` (notes) + `bd1d938c` (phase complete) | ✘ no self-hash possible under the one-lag convention (*m-3*) | ✔ G1–G10 incl. `plan validate` → `verdict=valid, tier=full, readyForDevelopment=true`; secret-read 5/5; error-table 149/149; doc-distribution no drift; **`pnpm check` 10498 pass / 4 pre-existing skips / 0 fail** | Docs deliberately deferred to lifecycle phase 7 and landed in `ab6a0d69` (n-6) |

**Independent re-verification in this review** (all green, no source touched): `jaiship plan validate GH-338` → `verdict=valid, tier=full, readyForDevelopment=true`; `bun test tests/structure tests/behaviour/providers tests/conformance tests/boundaries` → **2242 pass / 0 fail**; `bun test tests/behaviour` → **7041 pass / 4 pre-existing skips / 0 fail**; `bun test tests/checks` → **1175 pass / 0 fail**; `bun test tests/behaviour/daemon-foreground-stop-latency.test.ts` → pass (232–234 ms); `pnpm typecheck` → 0; `pnpm lint` → 0 (101 warnings, 38 infos, pre-existing class); `pnpm format:check` → 0; `depcruise packages` → no violations; `exports-parity` → 5/5; `prompt-conformance`, `help-guide-coverage`, `ambient-globals`, `workspace-entrypoints`, `memory-lint`, `forbidden-literals`, `privacy-literals` → OK; `secret-read-boundary` → 5 allowlisted, unchanged; `error-table-sync` → 149/149; `scripts/.tests/test-doc-distribution.sh` → no drift (95 docs); `scripts/lint-commit-range.sh --base 1250d789` → **PASS** (25 commits, 0 offending).

---

## 5. Remediation tasks (must enter the plan artifact before `@coder` remediates)

**Phase R1 — transport correctness (blocker; do first, one commit)**

1. `B-1`: derive the `gh` hostname from the declared instance host (`api.github.com` → `github.com`; GHES host unchanged) and supply it explicitly from composition; remove the `request.url`-host derivation from `argvFor`.
2. `B-1`: update `tests/fixtures/providers/github/cli-argv.json` + TC-CLI-002 to the corrected argv; add a cloud/GHES host-mapping case.
3. `B-1`: add an offline stub-`gh` shim smoke test (shim on an injected `PATH`, production `execFileRunner`, one read + one write) proving host/method/path/body/stdin and the parsed `{status, body}`, with zero network. Wire the stub into the trap catalog/coverage roll-up so it cannot silently disappear.
4. `n-1`: restrict the status-block search to the pre-body region and add a body-containing-status-line case.

**Phase R2 — process-edge hygiene**

5. `M-1`: set `XDG_CONFIG_HOME`/`XDG_STATE_HOME`/`XDG_CACHE_HOME` to absolute isolated paths; make the isolated base absolute (no CWD fallback); extend the pinned environment in TC-CLI-003 and `cli-argv.json`.
6. `M-1`: add the scratch-CWD cleanliness assertion to the stub-shim case; remove the `.local/state/gh/device-id` residue from the tree and decide on `.gitignore` coverage for `.local/`.
7. `M-2`: make the launcher probe deterministic/injectable for `tests/checks/install-launcher-installer.test.ts` (api-only policy, injected runner, or an explicit env override), **or** amend NFR-2 + test plan §1/§4 to declare the one live `gh` and record the determinism note in `pm-notes`.

**Phase R3 — spec/record convergence**

8. `m-1`: align DM-9/F-6 with the delivered content-write failure classification (implement `provider.not-found` for 404, or revise the normative prose) and add a case asserting the chosen classification.
9. `m-2`: align AC-F6-4/DM-6/TDR-0035 §3.2 with the preservation semantics of the whole-array write (or implement per-label add/remove) and record the current-read-as-input realisation in TDR-0035.
10. `m-3`: append the missing commit hashes (phase-2 `6bbf3c73` + `528a2cb4`; phase-7 `dde7b661`, `f71b941e`, `bd1d938c`).
11. `m-4`: align or explicitly record TDR-0032 item 8 (N6); append the DoR iteration-2 verdict and spec-v1.2 notes and correct the superseded DM-10 sentence (N12).
12. `m-5`: move the changeset declaration to the phase that authored it, or record the acceptance explicitly.
13. Nits (may ride the same commits): `n-2` (declare the capability-probe semantics), `n-3` (test-plan symbol), `n-4` (commit subjects — cannot be fixed retroactively; use plan summaries from here on), `n-5` (document the non-numeric update-identity refusal), `n-6` (distinguish plan phase 7 from lifecycle phase 7 in the note).

**Re-review expectation**: R1–R3 green on the mock tier, the new stub-shim case proving the real process edge, `pnpm check` green on a host **with and without** `gh`, `git status --porcelain` clean after a composing invocation, and the AC table above re-verified for AC-F2-3/AC-F2-4/AC-F6-4.

---

## 6. What is sound (so remediation does not re-litigate it)

- The evidence reads are honest about bounds and absence: fixed caps with no caller override, UTF-8 boundary trimming that never splits a character, `byteLength` = returned bytes, `truncated` as the sole authority, one read with no retry/pagination, and a shape that carries no write authority.
- The workflow map is one instance for both directions, validated once at construction on the resolved map with a **captured** (never thrown) failure, seven rejection rules, and every refusal at zero provider cost — including the terminal-read refusal the DoR gate added late.
- The landing is genuinely at-most-once: one `PUT`, read-back-gated already-merged success, a typed squash-only input with no representable force/bypass/queue/rebase/merge-commit, and no title/body in the landing payload.
- Conformance is non-vacuous: exact set equality, every supported step executed, gaps encountered by name for GitLab/Jira (not only GitHub), expected write projections, replay determinism, an armed child-process canary, and a broken-adapter control that still fires.
- The reference-behavior surface is authored as current truth in phase 6, parsed through one locator with extraction-count assertions and mutation controls, and indexed — it is not discovered at the documentation phase.
- Documentation reconciliation is complete and drift-guarded: capability table 9/0, nine-operation set, the two optional timestamps, confinement wording for the bounded child invocation, the carrier skip-kind change, the merge-path coexistence, and the drift guard (`test-doc-distribution.sh`) green.
