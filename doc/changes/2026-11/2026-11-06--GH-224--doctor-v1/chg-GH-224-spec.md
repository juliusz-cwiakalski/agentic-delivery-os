---
change:
  ref: GH-224
  type: feat
  status: Proposed
  slug: doctor-v1
  title: "M1-S3: doctor v1"
  owners: [engineering]
  service: delivery-os CLI doctor command
  labels: [change, planning]
  version_impact: minor
  audience: internal
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - result contract and error table
      - status digest collectors, repository binding, and bounded GitHub reads
      - provider engine configuration, park, and announcement vocabulary
      - state layer verified reads
      - configuration layer
      - adapter ports and credential port
      - branding seam
      - monorepo scaffold and toolchain
    external:
      - GitHub REST API
links:
  related_changes: ["GH-170", "GH-171", "GH-172", "GH-173", "GH-174", "GH-175", "GH-176", "GH-177", "GH-181", "GH-182", "GH-221"]
  related_decisions: ["ADR-0003", "TDR-0005"]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Deliver `ados doctor`, a read-only diagnostic that checks repo, tracker, provider, state, and CI wiring before delivery begins, names every failing check with an actionable fix hint, and exits with stable codes — 0 when all checks pass, 1 when at least one check fails, 2 when doctor itself cannot run — so wiring problems are found before they burn delivery quota.

## 1. SUMMARY

This change delivers M1-S3 `doctor v1`: one command that diagnoses the delivery environment's wiring and prescribes the fix, never repairs. The command runs exactly five checks in a fixed order — `repo`, `tracker`, `provider`, `state`, `ci` — and reports each with one verdict from a closed three-value vocabulary (`ok`, `fail`, `unreachable`), bounded evidence, and a deterministic detail line. Every non-ok verdict carries a non-empty fix hint, unconditionally: there is no flag that toggles hints, because the pinned ticket decision makes hints part of the contract, not a convenience.

The outcome model follows the delivered verify-change precedent exactly. When every check passes, doctor returns a success envelope (exit `0`) whose `data` carries the structured five-check report. When at least one check fails, doctor returns an error envelope (exit `1`) under one classified identity — a new `doctor` domain kind with exactly one row, `doctor.check.failed` — whose deterministic summary names every failing check with its verdict and fix hint in fixed area order. When doctor itself cannot run (containment, or a platform-category failure outside per-check execution), the existing classification chain projects exit `2`. No data-bearing failure envelope, no exit override, and no envelope-shape change is introduced: the v1 result contract is consumed, not evolved, beyond the one additive error row and its synchronized documentation.

Per-check isolation is a first-class guarantee: each check executes inside its own containment boundary, so a check whose sources are unreadable, whose network read fails, or whose execution throws becomes a failing/unreachable verdict with a fix hint — never a crash, never an aborted run, never silent. The tracker and CI checks perform exactly one bounded single-page read each (the status-collector precedent); the repo, provider, and state checks are local and configuration-only. Because the delivered adapter read results fold every non-2xx response into one adapter-local payload failure whose only discriminant today is prose, this change adds one structured, secret-free `httpStatus` field to that failure type, supplied by the read slice, so the tracker and CI checks can classify a rejected credential (HTTP 401/403 — the engine's established auth-rejection semantic) from every other read failure without parsing remote prose. The provider check reads wiring evidence only — the resolved provider configuration, the declared chain, credential presence through the credential port, and active parks and persisted announcements from the verified state fold — and never fetches quota, never calls the provider engine, and never writes a park or announcement; its fix hints direct the operator to `provider quota` for live inspection, and a failed configuration resolution is consumed tolerantly as provider-check evidence (the delivered status precedent) instead of aborting the run. The closed-evidence discipline of the status digest applies to every check: an unobserved, failed, or unattempted read is never an ok verdict, so doctor cannot produce a false all-clear.

## 2. CONTEXT

### 2.1 Current State Snapshot

- The M0/M1 trust and command substrate is delivered on `main-tools`: the result contract with the machine-readable error table, classification chain, `{0, 1, 2}` exit projection, two-entry fallback containment, and the serialization redaction chokepoint (GH-172); the seven-layer configuration layer with the typed `provider` branch (GH-173); the append-only state layer with verified reads, torn-state classification, and the provider park fold (GH-174); the adapter ports and credential port (GH-181); and the branding seam (GH-171).
- The GitHub read slice's failure surface classifies exactly three ways: the classified credential identity (`config.credential.missing`) when the credential port fails, `provider.not-found` for HTTP 404, and `provider.payload.invalid` for every other non-2xx response and every transport error — the numeric status is available at the request boundary and dropped, so an authentication rejection (HTTP 401/403) is indistinguishable from a server or transport failure in the delivered data. The provider engine, by contrast, already classifies HTTP 401/403 as credential rejection and carries structured `httpStatus` in its quota evidence and announcement allowlist.
- `ados status` (GH-175, merged PR #209) established the read-only collector patterns doctor reuses: the `origin`-derived repository binding, bounded single-page GitHub list reads with declared limits and raw page-size reporting, the check-runs read for the current checkout HEAD, park and announcement evidence read from the verified state fold without engine execution, the closed-evidence state rules, and the optional pure human-text renderer hook on the command-definition contract.
- The provider engine (GH-182, merged PR #202) delivered the typed provider configuration, subscription-first chain vocabulary, named self-expiring parks persisted as state records and folded into a derived projection, structured announcements persisted alongside park state, and the `provider resolve` / `provider quota` / `provider parks list` surface. `resolve` persists parks and announcements; `quota` is read-only and evaluates live conditions. No chain is enabled by default, so a fresh installation has no declared provider chain.
- The watchdog lane-safety family (GH-221) refuses dirty or non-base checkouts at lane preflight under the `watchdog.checkout-dirty` and `watchdog.checkout-non-base` identities; the lane's base is lane-scoped. No global declared base source exists outside lane declarations.
- `verify change` (GH-177) established the outcome pattern doctor follows: an incomplete verdict is a single classified error envelope whose deterministic summary names every missing required phase in required-set order; envelope exclusivity keeps failure envelopes data-free; platform-category state failures project exit `2`.
- The command registry names `ados doctor` (M1 delivery, operate family) as "doctor-style checks for repo, tracker, provider, state, CI wiring, each with a fix hint (diagnoses and prescribes)". No doctor command, doctor contract, or doctor check logic exists. The planning pack pins the proposed contract (`doctor [--json]`, `checks[]` with area/verdict/detail/fixHint, exit 0/1/2, `doctor.check.<area>.unreachable` fail-with-hint-never-crash); the pack's man page still shows a stale `--fix-hints` flag that this change reconciles.
- The operator requirements input asks explicitly for "stable exit codes, `doctor` for wiring" and records that the operator currently carries a tool-trap cookbook in persistent memory; stable surfaces delete whole categories of that memory.

### 2.2 Pain Points / Gaps

- Wiring problems (a dirty checkout, a missing tracker credential, an expired provider token, a torn state store, an unreachable CI read) surface mid-delivery, after the session has spent tokens and quota, as confusing downstream failures far from their cause.
- There is no one command an operator can run before a delivery session to answer "is this environment wired for delivery?"; discovery is manual, per-source, and inconsistent between sessions.
- Failures discovered late are expensive: a provider credential that fails at spawn time burns delivery quota on retries; a torn store discovered at write time risks misreading a partially written ledger as empty.
- Exit-code folklore: without a doctor taxonomy, ad-hoc environment probes return ad-hoc codes that scripts and agents cannot branch on.
- Nothing today turns recorded provider evidence (active parks with credential causes, persisted announcements) into an actionable prescription without running the provider engine — and running the engine's quota evaluation costs quota, which is exactly what a pre-flight diagnostic must not do.

## 3. PROBLEM STATEMENT

Because the delivery environment has no single read-only diagnostic that checks repo, tracker, provider, state, and CI wiring before delivery begins, an operator or coordinator discovers broken wiring only mid-delivery — as a failed spawn that burns quota, a misleading downstream error, or a silent stall — and cannot distinguish a healthy environment from an unobserved one, because no surface today converts wiring evidence into named findings with fix hints and stable exit codes that machines can branch on.

## 4. GOALS

- **G-1**: One read-only `ados doctor` command, exactly named by the command registry, with no positionals and no command-specific flags beyond the global `--json`.
- **G-2**: Exactly five named checks in a fixed order — `repo`, `tracker`, `provider`, `state`, `ci` — each with one verdict from the closed vocabulary `ok | fail | unreachable`, bounded evidence, and a deterministic detail.
- **G-3**: Every failing check names a fix hint, unconditionally (pinned decision); fix hints are action-first, secret-free, and built from a closed condition catalog with safe identifier substitution only.
- **G-4**: Stable exit codes: all checks ok → exit `0` with the structured report as `data`; any failing check → exit `1` with one classified identity whose summary names every failing check with its fix hint; doctor itself unable to run → exit `2` per the existing projection. No exit overrides outside the projection module.
- **G-5**: Per-check isolation: a check whose sources are unreadable, whose read fails, or whose execution throws becomes a failing/unreachable verdict with a fix hint (`doctor.check.<area>.unreachable`); it never crashes, never aborts sibling checks, and never silences the run.
- **G-6**: Evidence truthfulness: the closed-evidence rules of the status digest apply per check — an unobserved, failed, or unattempted read is never an ok verdict and never a fabricated detail.
- **G-7**: The provider check reads wiring evidence only (declared chain resolution, credential presence through the credential port, active parks and persisted announcements from the verified state fold), never fetches quota, never calls the provider engine, and never writes; its hints direct the operator to `provider quota`.
- **G-8**: Bounded cost: at most two network reads per doctor run (one single bounded page each for tracker and CI, no pagination, no retries); repo, provider, and state checks are local; shared evidence (binding, config, store reads) is read once and reused across checks.
- **G-9**: Deterministic, bounded output: a short human check report rendered purely from the same data, and one standard machine envelope under `--json`.
- **G-10**: Read-only by construction: no repair, no mutation, no state write, no fence, no park write or clear, no child process — doctor diagnoses and prescribes.
- **G-11**: Contract and tier discipline: runtime-neutral contracts data, pure aggregation in the domain tier, no new runtime-API location, no new configuration key, no state-schema change, brand-neutral output, and error-table evolution under the binding sync discipline (one additive row with same-change coverage).

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Checks executed and reported per run, in fixed order | 5/5 on every completed run, including runs where some checks are unreachable |
| Non-ok verdicts carrying non-empty detail and fix hint | 100%; 0 non-ok verdicts missing either |
| Failing checks named with verdict and fix hint in the failure summary, in fixed area order | 100% |
| Crashes, aborted sibling checks, or unhandled escapes from inside per-check execution | 0 |
| Failed, absent, or unattempted reads reported as ok; non-ok verdicts with empty detail or hint | 0 / 0 |
| Quota fetches, provider-engine `resolve` calls, park or announcement writes during doctor | 0 / 0 / 0 |
| Network reads per run; pagination; retries | ≤ 2, one bounded page each / 0 / 0 |
| Exit-code mapping across the outcome matrix (all-ok → 0; any non-ok → 1; unable-to-run → per existing projection) | 100% |
| Exits outside `{0, 1, 2}`; exit overrides outside the projection module; failure envelopes carrying `data` | 0 / 0 / 0 |
| Writes, fence acquisitions, state mutations, child processes during doctor | 0 / 0 / 0 / 0 |
| Replay over identical injected inputs producing identical machine and human output | 100%; 0 drift |
| New error-table rows; two-way documented-table drift; existing rows modified | 1 / 0 / 0 |
| Secrets or remote-controlled prose in hints, details, evidence, or diagnostics; planted-secret canary escapes | 0 / 0 |
| Live network calls in the default test suite | 0 |

### 4.2 Non-Goals

- **NG-1**: Any repair or mutation: no `--fix` flag, no salvage execution, no park clear, no state write, no checkout restore, no credential provisioning. Doctor diagnoses and prescribes; repairs remain explicit, separate operations.
- **NG-2**: The merge and verify-deploy engines (M1-S4); doctor performs no merge-gate evaluation and no deploy verification.
- **NG-3**: The resident daemon and provider watching (M1-S21); doctor is a one-shot, on-demand diagnostic with no background process and no continuous monitoring.
- **NG-4**: The M3 memory `doctor` family; doctor v1 checks exactly the five wiring areas named by the ticket.
- **NG-5**: Live quota evaluation, provider-engine execution, chain decision making, or any provider mutation; the provider check never fetches quota and directs operators to `provider quota`.
- **NG-6**: CI build-health verdicts: a red build is not a wiring failure; CI pass/fail remains the concern of the status digest and verify gates. Doctor's CI check observes wiring only.
- **NG-7**: New configuration keys, a doctor configuration branch, state-schema changes, new packages or subpaths, or new runtime-API locations.
- **NG-8**: Duplicating or replacing the watchdog lane preflight, `verify change`, `verify gates`, or the status digest; doctor's findings are diagnostic data and reuse no watchdog refusal identity.
- **NG-9**: Cross-repository or fleet doctor, MCP/OpenCode surfaces, LLM-generated explanations, or agent prompt adoption.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | `ados doctor` command surface | The command registry names exactly this command; one pre-flight entry point. |
| F-2 | Five-area check set with a closed verdict vocabulary | The ticket's five wiring areas; the pack's binary proposal refined into ok/fail/unreachable. |
| F-3 | Repo wiring check | Local checkout and remote-binding wiring observed without network. |
| F-4 | Tracker wiring check | Binding, credential, and one bounded read prove tracker wiring. |
| F-5 | Provider wiring check | Config/chain/credential/park/announcement evidence without burning quota. |
| F-6 | State wiring check | Verified store reads with repair-guidance hints, never repair. |
| F-7 | CI wiring check | Commit, credential, and one bounded check-runs read prove CI wiring. |
| F-8 | Per-check isolation and containment | The pinned never-crash guarantee; containment inside checks never escapes. |
| F-9 | Outcome and exit modeling | The pinned stable exit codes via the verify-change precedent. |
| F-10 | Human and machine output | Deterministic check report and one valid envelope on every outcome. |
| F-11 | Error-table evolution with sync coverage | The one classified failure identity needs a table row, documented row, and same-change coverage. |
| F-12 | Read-only, deterministic, tier/brand-neutral execution | A pre-flight diagnostic must not mutate, leak, or drift. |

### 5.1 Capability Details

- **F-1 — Command surface.** `doctor` is a new top-level command composed where `status`, `lint`, `phase`, `provider`, and `verify` are composed. Its grammar is exactly the command name with no positionals and no command-specific flags; `--json` is the existing global machine-output switch and adds no doctor-specific behavior. An unexpected positional or unknown flag is rejected by the parser before any read (`fallback.invocation`, exit `1`). The handler owns no stream writes and no exit codes: it returns the report or a classified failure, and the CLI edge renders and projects. There is no `--fix-hints` flag: fix hints are unconditional (pinned decision), and the pack's man-page line showing `doctor [--fix-hints]` is reconciled in this change.
- **F-2 — Five checks, closed verdicts.** The areas and order are fixed: `repo`, `tracker`, `provider`, `state`, `ci`. Each check carries exactly one verdict: `ok` (every required source read for the check succeeded and every evaluated wiring condition holds), `fail` (a wiring defect was observed — locally observable defects such as a dirty checkout, an unresolvable remote binding, a missing credential, an undeclared or unresolvable chain, or a broken store — or a performed wiring read returned a definitive defect such as an authentication rejection), or `unreachable` (the check could not obtain its evidence: a required wiring read was not attempted because a dependency is unavailable, or the read attempt itself failed on transport, or the check's execution failed and was contained). Both non-ok verdicts are failing checks for exit purposes, and both always carry a non-empty detail and a non-empty fix hint. Each check declares a closed condition set; each condition maps to exactly one verdict and one fix-hint template.
- **F-3 — Repo check.** Sources: the checkout facts and the `origin` remote binding (the status digest's repository binding), both local. The check is `ok` when the checkout is a readable git work tree with a clean working tree and an `origin` remote that resolves to a GitHub repository binding. A dirty working tree is `fail` with a commit-or-discard hint (the same condition the watchdog preflight refuses, diagnosed here as wiring with a prescription, never refused and never reused as an error identity). A missing, unparseable, or non-GitHub `origin` is `fail` with a fix-the-remote hint. Unreadable checkout facts are `unreachable` with `doctor.check.repo.unreachable`. v1 reports the observed branch/HEAD facts as detail but evaluates no base-branch conformance, because the base is lane-scoped in the delivered watchdog contracts and no global declared base source exists (deferred; OQ-1); inventing a base configuration key is rejected for this change.
- **F-4 — Tracker check.** Sources: the shared repository binding, the tracker credential resolved through the credential port (presence only; the value never enters evidence), and one bounded single-page tracker list read through the delivered GitHub client (status-collector precedent: declared limit, no pagination, no retries). `ok` requires binding resolved, credential resolvable, and the read succeeded — a verified-empty page is a successful read and `ok`. A credential that does not resolve through the port is `fail` with a hint naming the declared environment variable only (the classified `config.credential.missing` identity). A wiring read that fails with the structured HTTP status 401 or 403 is a definitive credential rejection: `fail` with a replace-or-broaden-the-credential hint — the classification is derived from the structured status field only, never from remote prose. Any other non-2xx response, transport error, or timeout on the read is `unreachable` with `doctor.check.tracker.unreachable` and a check-the-credential-and-reachability hint. When the repository binding is unresolvable the tracker read is not attempted and the check is `unreachable` with a hint directing to the repo check's finding — an unattempted read is never ok.
- **F-5 — Provider check.** Sources, all local: the resolved provider configuration read (the tolerant read pattern delivered for the status/brief/queue-ready runtimes), the pure provider validator's structural resolution of the declared chain, credential presence for enabled entries through the credential port, and active parks plus persisted announcement records from the verified state fold. The check never calls `provider resolve` (which persists parks and announcements), never calls `provider quota`, never injects or uses the quota transport, and never evaluates a peak or quota condition. `ok` requires: a default chain declared, the chain structurally resolvable to declared entries, every enabled entry's credential reference resolvable, and the park/announcement fold readable. The delivered provider-configuration read exposes exactly two failure reasons, and both are provider-check `fail` conditions with hints — a broken configuration source is diagnosed, never a command abort: a configuration-resolution failure (`config-invalid`, carrying the classified `config.*` failure code from the resolver) → `fail` with a correct-the-named-source hint; a provider-branch validation failure (`provider-chain-unresolved`, carrying `failureCode: "config.value.invalid"`) → `fail` with a correct-the-provider-configuration hint. Beyond those: no declared default chain (a valid resolved state) → `fail` with a declare-a-chain hint (mirroring `provider.chain.empty` guidance); an unresolvable credential reference → `fail` with a supply-the-credential hint naming the declared source key only; an active park whose cause is `credential-missing` or `credential-rejected` on a declared entry → `fail` with a refresh-credential hint that then directs to `provider quota --provider <name>` (the recorded engine evidence, not a live probe, is the observed credential defect). Active capacity, environment, and loop-cap parks (`quota-exhausted`, `provider-outage`, `chain-exhausted`, `reevaluation-cap`) and peak-window parks are observed wiring-neutral conditions: they do not flip the verdict, but the check's detail MUST name each active park with its cause and expiry and carry the directive to inspect with `provider quota --provider <name>`, so doctor never presents a parked provider as if nothing were recorded. A park/announcement fold read failure is `unreachable` with `state-unreadable` evidence and a repair-the-store hint; it never becomes "no parks".
- **F-6 — State check.** Source: verified reads over the delivered state stores, shared with the provider check's fold (read once, reused). `ok` requires every delivered store to verify — a verified-empty store is a successful read and `ok`. A torn store is `fail` with the salvage-as-a-separate-step hint (doctor never salvages); a schema mismatch is `fail` with the compatible-version-or-migrate hint; a permission failure is `fail` with the fix-permissions hint; an undeclared record kind or payload schema is `fail` with the declare-or-compatible-version hint. Store facts unreadable beyond these classified conditions are `unreachable` with `doctor.check.state.unreachable`. All state verdicts are diagnostic data with prescriptions; doctor executes no repair.
- **F-7 — CI check.** Sources: the shared repository binding, the credential, the current checkout HEAD's commit resolution through the repository adapter, and one bounded single-page check-runs read for that commit (the status CI collector precedent). `ok` requires binding resolved, credential resolvable, commit resolved, and the read succeeded — a read that returns zero runs is an observed-empty success and `ok` (it proves the CI wiring reads work; the digest separately reports that no pipeline was reported). A credential that does not resolve through the port is `fail` with the environment-variable hint; a wiring read that fails with the structured HTTP status 401 or 403 is `fail` with the same credential-rejection hint as the tracker check (the one shared mechanism, F-4); an unresolved commit (for example a detached HEAD with no commit under observation) is `fail` with a run-from-a-branch hint; a transport failure or any other non-2xx response is `unreachable` with `doctor.check.ci.unreachable`; an unresolvable binding leaves the read unattempted and the check `unreachable` directing to the repo finding. Build health (failed runs) never flips the verdict: doctor checks CI wiring, not CI results (NG-6); run facts may appear as detail.
- **F-8 — Per-check isolation.** Each check executes inside its own containment boundary. Any thrown value, rejected promise, malformed intermediate result, or otherwise unclassifiable failure raised inside a check's execution is contained as that check's `unreachable` verdict with condition `doctor.check.<area>.unreachable`, a bounded detail, and a fix hint — it never crashes the command, never aborts sibling checks, and never resolves through `fallback.internal`. All five checks always execute and the run always completes with a full report. `fallback.internal` (and any platform-category classified identity) applies only outside per-check execution: composition of shared inputs, aggregation of the completed report, envelope assembly, and serialization. The aggregate report is assembled only after all five checks complete.
- **F-9 — Outcome and exit modeling.** The verify-change outcome pattern, applied unchanged: if every check is `ok`, the command returns a success envelope carrying the structured report as `data` and exits `0`. If at least one check is `fail` or `unreachable`, the command returns an error envelope carrying exactly the new `doctor.check.failed` identity (user category, `not_landed`, user-validation projection) and exits `1`; the envelope's deterministic summary names EVERY failing check with its verdict and fix hint, in fixed area order, on one line with newlines collapsed. Failure envelopes never carry `data` (envelope exclusivity); the full structured report is success-path data, and the summary is the failure-path vehicle for per-check prescriptions. Doctor itself unable to run — containment outside per-check execution, or a platform-category classified failure encountered outside per-check execution — projects exit `2` through the existing chain (`fallback.internal` and platform-category rows are platform-provider). No exit override is introduced anywhere.
- **F-10 — Human and machine output.** `--json` emits exactly one standard `CommandResult` envelope on every outcome: success carries `data` (the five-check report), failure carries the classified `error` object. Human mode renders a deterministic check report — one line per check in fixed order with verdict and bounded detail, followed by one indented fix-hint line per non-ok check — via the command-definition contract's optional pure human-text renderer (delivered with ten command consumers — board, brief, closeout, db, doctor, plan, queue, status, verify, watchdog; doctor joins as one of them, delivered alongside the board command that landed mid-delivery via GH-229, and the delivered CLI-edge seam test pins the ten-declarer set including doctor). On failure the human diagnostic additionally carries the deterministic failing-checks summary. The renderer performs zero extra reads, is bounded (at most 24 lines and 4096 bytes), and is derived only from the same data as the machine output. Neither mode uses an LLM.
- **F-11 — Error-table evolution.** A new `doctor` domain kind joins the closed `DOMAIN_KINDS` union with exactly one row: `doctor.check.failed` — category `user`, retryable `false`, consequence `not_landed`, projection class `user-validation` (exit `1`), remediation hint directing the caller to resolve each named failing check using its fix hint and re-run doctor, and a non-identifying default summary. Check-level causes remain check data (verdicts, details, evidence reasons) and never become error-table identities, mirroring the status digest's posture; the exit-`2` population reuses existing platform-category identities and containment, so no second row is added. The change extends the error-table sync check's corpora and fixtures for the new row, keeps the two-way documented-table binding green, and modifies no existing row. The result-contract feature documentation is reconciled with the new kind and row in the same change.
- **F-12 — Read-only, deterministic, tier/brand-neutral execution.** Doctor performs zero writes, zero fence acquisitions, zero state mutations, zero network writes, and zero child processes. The pure aggregation over completed check results has no I/O, clock, randomness, or ambient environment; the clock, credential port, and all reads are injected at the runtime-aware edge. Runtime I/O stays in the already-admitted adapter subpaths and the CLI edge; no new package, subpath, runtime-API location, or secret-read allowlist entry is introduced. No configuration key is added; doctor's bounds are contract constants. Human output uses the injected brand binary name; no product literal is committed.

## 6. USER & SYSTEM FLOWS

1. **Pre-session flow (all wired).** The operator runs `<binary> doctor` before starting a delivery session. The edge resolves brand and configuration, builds the shared read sources (repository binding, credential port, state port, GitHub client), and injects them into the check runtime. All five checks complete; each reports `ok` with factual detail. Human mode prints the five-line report; `--json` returns the success envelope with `data.checks` (five entries) and exit `0`.
2. **Failing-check flow.** The provider entry's credential reference does not resolve and the checkout is dirty. The repo check is `fail` (commit-or-discard hint) and the provider check is `fail` (supply-the-credential hint); tracker, state, and CI are `ok`. The command returns the `doctor.check.failed` error envelope, exit `1`; the summary names both failing checks with their hints in area order; the human diagnostic shows all five lines plus the two hint lines. The operator fixes both, re-runs doctor, and gets exit `0`.
3. **Per-check isolation flow.** The tracker read times out and the state store is torn. The tracker check is `unreachable` with `doctor.check.tracker.unreachable` and a restore-reachability hint; the state check is `fail` with the salvage-as-a-separate-step hint; the other three checks complete normally. The run is never crashed, never truncated: all five checks report, the failure summary names both non-ok checks with hints, exit `1`. No `fallback.internal` appears anywhere, because both failures were contained inside their checks.
4. **Provider evidence flow.** The provider chain is declared and credentials resolve, but the verified park fold shows `provider-c` parked with cause `quota-exhausted` until 14:00Z, and a `credential-rejected` park on another entry. The provider check reports the quota park as wiring-neutral detail with the directive `provider quota --provider provider-c`, is `fail` for the credential-caused park with a refresh hint, and the run exits `1` naming it. No quota endpoint was called and no engine ran.
5. **Doctor-unable-to-run flow.** A shared input cannot be composed outside per-check execution (for example an unclassifiable composition failure), or a platform-category classified identity is raised outside per-check execution. The existing classification chain projects exit `2` with the classified identity; no doctor report is assembled, and no check verdict is fabricated.
6. **Machine consumption flow.** A script runs `doctor --json` in CI or a wrapper. It branches on `exitCode` and `error.code`: `0` proceeds; `1` parses the deterministic summary (or renders the human report) to show the operator each failing check and hint; `2` treats the environment as un-diagnosable and reports the classified identity. On every outcome the stdout carries exactly one valid envelope.

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The `doctor` command definition, grammar, runtime composition, and human/machine rendering.
- The `delivery.doctor.v1` contract vocabulary: the five area ids and order, the three-value verdict set, the per-check condition catalog with verdict and fix-hint mappings, the evidence model, the closed reason set, bounds, and the deterministic failure-summary grammar.
- The five checks (repo, tracker, provider, state, ci) with their declared sources, network posture (two bounded reads maximum), and evidence rules, including the credential-rejection classification from the structured `httpStatus` (401/403) on the wiring reads.
- One additive read-result surface: an optional structured, secret-free `httpStatus` field on the shared adapter-local payload-failure type, supplied by the GitHub read slice on non-2xx responses, with a trap-catalog entry and fixture assertion in the same change (DEC-11).
- Per-check isolation: the containment boundary around each check, the `doctor.check.<area>.unreachable` condition, and the rule that containment identities apply only outside per-check execution.
- The outcome model: success data report, the classified failure identity with the deterministic failing-checks summary, and exit projection through the existing chain.
- The `doctor` domain kind, the single `doctor.check.failed` row, its documented-table row, and error-table sync coverage (corpora and fixtures) in the same change.
- Reuse of delivered sources: repository binding, bounded GitHub list and check-runs reads, credential port presence resolution, provider config and pure chain validation, verified park/announcement fold, verified state store reads.
- Tests at structure, behaviour, boundary, and golden levels, including the verdict derivation matrix, the negative-control evidence matrix, and the isolation suite; all fixture-driven with zero live network in the default suite.
- A minor changeset, the new current-truth feature spec for doctor, and reconciliation of the planning pack's man-page drift and the result-contract documentation.

### 7.2 Out of Scope

- [OUT] Any repair action: salvage execution, checkout restore, park clear, credential provisioning, store migration, or a `--fix` surface of any kind.
- [OUT] Provider-engine execution, chain decision making, live quota evaluation or fetch, park or announcement writes, or injection of the quota transport into doctor.
- [OUT] Merge, gate, or deploy evaluation (M1-S4 surfaces); CI build-health verdicts.
- [OUT] The daemon, provider watching, or any continuous/background monitoring (M1-S21).
- [OUT] The M3 memory `doctor` family and any sixth wiring area.
- [OUT] New configuration keys or a doctor configuration branch; new state-schema changes or record kinds; new packages, subpaths, or runtime-API locations; new secret-read allowlist entries.
- [OUT] Reuse of the watchdog refusal identities (`watchdog.checkout-dirty`, `watchdog.checkout-non-base`) as doctor error identities; doctor findings are check data.
- [OUT] Base-branch conformance evaluation (no global declared base source exists; deferred with OQ-1).
- [OUT] Cross-repository/fleet doctor, MCP/OpenCode surfaces, LLM-generated guidance, and agent prompt adoption.
- [OUT] Data-bearing failure envelopes, envelope-shape changes, or exit overrides — the v1 result contract is consumed, not evolved.

### 7.3 Deferred / Maybe-Later

- Base-branch wiring evaluation once a global declared base source exists (for example with the queue/daemon lane defaults); tracked as OQ-1.
- An opt-in live smoke for doctor (credentialed structural run against this repository), following the status precedent, if a named consumer needs live evidence beyond the fixture suite.
- Additional checks consuming later surfaces (state-admin validation depth from M1-S2, plan-schema presence, ceremony artifacts) as new conditions inside the existing areas, or new areas by explicit contract change.
- Structured per-failing-check data on the failure path if the result contract ever admits data-bearing failure envelopes; until then the summary grammar is the vehicle.
- Provider announcement recency windows (which persisted announcements are considered current wiring evidence) once a named consumer needs tighter staleness semantics.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

None. `ados doctor` is an in-process CLI command; it starts no listener and exposes no HTTP endpoint. It performs at most two outbound read-only GitHub REST requests through the delivered GitHub client (Section 8.4).

### 8.2 Events / Messages

None. The report and its evidence are invocation-scoped result data; doctor emits no event, message, announcement, or telemetry record and writes no state record. Provider announcements remain owned by the provider engine; doctor only reads persisted ones.

### 8.3 Data Model Impact

| ID | Element | Contract |
|----|---------|----------|
| DM-1 | `DoctorReport` | The success `data` payload: `schemaVersion: "delivery.doctor.v1"`, `generatedAt` (injected clock, ISO-8601 UTC), `repository` (the shared binding, observed or unavailable), exactly five `checks` (DM-2) in fixed order, and `summary` counts `{ total: 5, ok, fail, unreachable }`. Additive within v1; a breaking shape change bumps the schema version. |
| DM-2 | `DoctorCheck` | `area` (fixed five-value set), `verdict` (DM-3), `detail` (non-empty, bounded, factual; present on every check), `fixHint` (present if and only if `verdict` is non-ok; non-empty, bounded, action-first), and `evidence` (DM-4). |
| DM-3 | Verdict vocabulary | `ok` \| `fail` \| `unreachable`, closed. `fail` = a wiring defect was observed (locally observable defects, or a performed wiring read returned a definitive defect). `unreachable` = the check could not obtain its evidence (a required read was not attempted because a dependency is unavailable, the read attempt failed on transport, or the check's execution failed and was contained); the contained condition is named `doctor.check.<area>.unreachable`. Both non-ok verdicts are failing checks: they always carry detail and fixHint and they drive exit `1`. |
| DM-4 | Check evidence model | Up to four source entries `{ source, outcome }` where outcome is `read` \| `observed-empty` \| `failed` \| `not-configured`, up to four unique reasons from the closed reason set (DM-6) ordered by first occurrence, an optional `failureCode` that must be an existing `config.*` or `state.*` error-table code when a classified failure occurred, an optional adapter-local `failureClass` (such as `provider.payload.invalid`) that is never an error-table identity, and an optional structured numeric `httpStatus` carried on a failed wiring read when the delivered read result supplies it. The credential-rejection classification (reason `credential-rejected`) is derived only from the structured `httpStatus` (401 or 403) — never by parsing the failure's prose detail, which is never copied into evidence. No adapter-local class is promoted to an identity, no raw payload, no credential material, no remote-controlled prose. |
| DM-5 | Areas and sources | Fixed mapping: `repo` → `checkout`, `remote-binding`; `tracker` → `remote-binding`, `credential`, `tracker-read`; `provider` → `provider-config`, `provider-credential`, `provider-parks`, `provider-announcements`; `state` → `state-stores`; `ci` → `remote-binding`, `credential`, `commit`, `ci-read`. Source ids are closed; shared sources (binding, credential, store reads) are resolved once and reused across checks. |
| DM-6 | Closed reason set | `observed`, `observed-empty`, `checkout-dirty`, `checkout-unreadable`, `remote-unresolvable`, `credential-unavailable`, `credential-rejected`, `read-failed`, `not-attempted`, `config-invalid`, `provider-chain-not-declared`, `provider-chain-unresolved`, `park-active`, `park-credential-cause`, `announcement-recorded`, `store-torn`, `store-schema-mismatch`, `store-unreadable`, `store-unknown`, `commit-unresolved`, `state-unreadable`, `check-unreachable`. Spellings overlapping the delivered status vocabulary (`observed`, `observed-empty`, `read-failed`, `credential-unavailable`, `config-invalid`, `commit-unresolved`, `provider-chain-not-declared`, `provider-chain-unresolved`, `state-unreadable`) reuse the delivered closed set's exact values; the remaining entries are doctor-scoped. The renderer and aggregator never invent a reason. |
| DM-7 | Failure summary grammar | The `doctor.check.failed` error summary is one deterministic line in fixed area order: `doctor check failures (<n>/5) — <area> (<verdict>): <fixHint>[; <area> (<verdict>): <fixHint>]…`, newlines collapsed, no secrets, no remote-controlled prose; `<fixHint>` is the check condition's declared hint template with safe identifier substitution (provider name, environment-variable name, area). Non-failing checks never appear. The row's `remediationHint` stays generic ("resolve each named failing check using its fix hint, then re-run doctor"); identity remains `error.code`. |
| DM-8 | Bounds | Contract constants, doctor-scoped (status caps are not imported): one declared per-source read limit for each of the two network reads (single page, no pagination, no retries), detail and hint text bounded at 200 characters each, serialized `data` report ≤ 64 KiB (65 536 bytes), human report ≤ 24 lines and ≤ 4096 bytes, evidence ≤ 4 sources and ≤ 4 reasons per check. Counts and bounds are contract, not renderer detail. |

**Verdict derivation matrix.** The per-area conditions and their verdicts are pinned in Appendix A; Appendix B pins the evidence model application and failure-summary examples. Together they are the exhaustive, testable statement of which world states produce which verdicts.

### 8.4 External Integrations

**GitHub REST API (read-only).** Doctor binds the repository derived from `origin` (the status digest's binding) and uses the delivered GitHub client for exactly two reads:

| Read | Check | Bound |
|---|---|---|
| Open work items (bounded list) | tracker wiring | One page at doctor's declared read limit; pull-request objects filtered as delivered; no pagination |
| Check runs for the current checkout commit | CI wiring | One page at doctor's declared read limit; no pagination |

Credentials resolve only through the injected credential port; doctor code reads no ambient environment. Both wiring reads consume the delivered read-result failure union enriched by this change's one additive surface: the shared adapter-local payload-failure type gains an optional structured, secret-free `httpStatus` field that the GitHub read slice supplies on every non-2xx response, so a rejected credential (401/403) is classified as structured data rather than parsed from prose. The provider quota endpoint is never called; no GitHub write, comment, label, or transition request is made. Jira and GitLab read slices are delivered but not bound by this repository's doctor composition, mirroring status.

**Local integration surfaces.** The configuration resolver supplies the resolved snapshot (including the typed provider branch); the repository adapter supplies checkout facts, HEAD, and the `origin` binding; the state layer supplies verified store reads and the provider park/announcement fold; the credential port supplies presence resolution for the tracker/CI credential and declared provider credential references. None is mutated; shared sources are read once per run and reused across checks.

### 8.5 Backward Compatibility

- **Additive command:** `doctor` is new; no existing command's grammar, output, or exit behavior changes.
- **Additive contracts:** the runtime-neutral contracts gain the doctor vocabulary (types and `as const` data); no existing type is reshaped and no existing subpath is changed.
- **Additive error-table row:** `DOMAIN_KINDS` gains `doctor` with exactly one row; every existing row, kind, and the reserved `fallback` namespace are unchanged; the two-way documented-table sync stays green with same-change coverage for the new row.
- **Additive read-result field:** the shared adapter-local payload-failure type gains one optional structured `httpStatus` field; existing producers that do not set it are unaffected, every existing consumer's narrowing is unaffected (the field is additive to a failure variant that already exists), the closed adapter-operation set and capability declarations are unchanged, and `provider.payload.invalid` remains the only payload-failure identity — no new error-table row or adapter-local class is introduced.
- **Additive renderer consumer:** the optional human-text renderer hook is delivered with ten command consumers (board, brief, closeout, db, doctor, plan, queue, status, verify, watchdog); doctor joins as one of them, delivered alongside the board command that landed mid-delivery via GH-229, and the delivered ten-declarer CLI-edge seam test already pins doctor; existing command definitions are unaffected.
- **No config/state compatibility surface:** no new configuration key, no state-schema change, no store-format change, and no on-disk migration.
- **Planning-pack reconciliation:** the pack's man-page line showing `doctor [--fix-hints]` is corrected to the delivered grammar in this change; fix hints are unconditional and `--json` is the standard machine-output switch.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Check totality: exactly five checks in fixed order on every completed run; each with verdict from the closed set, non-empty bounded detail, evidence; fixHint on every non-ok verdict | 5/5 checks, 100% valid verdicts, 100% detail presence, 100% hint presence on non-ok; 0 missing or extra checks |
| NFR-2 | Never-crash guarantee: crashes, aborted sibling checks, or unhandled escapes from inside per-check execution; non-ok checks missing `doctor.check.<area>.unreachable` when contained | 0 / 0 |
| NFR-3 | Evidence truthfulness: failed, absent, or unattempted reads rendered as ok; fabricated details; non-ok verdicts with empty detail or hint; parked provider presented with no park evidence in detail | 0 across the exhaustive negative-control matrix (Appendix A/B) |
| NFR-4 | Exit stability: all-ok runs exiting 0; any-non-ok runs exiting 1 with `doctor.check.failed`; unable-to-run outcomes projecting per the existing chain; exits outside `{0, 1, 2}`; exit overrides outside the projection module; failure envelopes carrying `data` | 100% / 100% / 100% / 0 / 0 / 0 |
| NFR-5 | Provider quota safety: quota fetches, provider-engine `resolve` calls, park or announcement writes, quota-transport injections during doctor | 0 / 0 / 0 / 0 |
| NFR-6 | Read-only determinism: writes; fence acquisitions; state mutations; network writes; child processes; machine or human output drift on identical injected inputs | 0 / 0 / 0 / 0 / 0 / 0 |
| NFR-7 | Cost bounds: network reads per run; pagination or retries; config resolves; shared store reads duplicated across checks; pure aggregation over capped inputs on the reference environment | ≤ 2 single-page reads / 0 / ≤ 1 / 0 (shared sources read once) / ≤ 50 ms |
| NFR-8 | Output bounds and contract: `--json` runs emitting exactly one valid envelope; human report size; serialized `data` size | 100% valid; ≤ 24 lines and ≤ 4096 bytes; ≤ 64 KiB (65 536 bytes) |
| NFR-9 | Error-table binding: new rows; two-way documented-table drift; existing rows modified; sync-check corpora/fixtures covering the new row | exactly 1 / 0 / 0 / covered in the same change |
| NFR-10 | Boundaries, branding, and privacy: new runtime-API locations; new secret-read allowlist entries; product literals; secrets or remote-controlled prose in hints/details/evidence/diagnostics; planted-secret canary escapes | 0 / 0 / 0 / 0 / 0 |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

No product telemetry, metric exporter, trace span, or event sink is added. The observability surface is the report itself: the standard envelope's `runId` and `timing`, each check's verdict, detail, evidence, and fix hint, the deterministic failure summary naming every failing check, and the stable exit code. A consumer diagnosing a doctor run needs nothing beyond the envelope and the human report. Provider announcements and engine telemetry remain owned by the provider engine; doctor reads persisted records and adds no channel.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | A failed, absent, or unattempted read is reported as ok (false all-clear — the most expensive doctor defect) | H | M | Closed-evidence rules are normative per check; unattempted reads (unresolvable binding) are `unreachable`; verified-empty is the only zero-claim path; the negative-control matrix (Appendix A/B) is exhaustive and asserted in tests. | L |
| RSK-2 | Doctor burns quota through the provider check | H | L | The check reads config, parks, announcements, and credential presence only; the quota transport is never injected; AC asserts 0 quota calls, 0 resolve calls, 0 writes; hints direct to `provider quota`. | L |
| RSK-3 | Fix hints or details leak secrets or remote-controlled text | H | L | Hints come from a closed condition catalog with safe identifier substitution only (names, never values); details are bounded and sanitized; the serialization redaction chokepoint covers envelope, summary, and diagnostics; planted-secret canaries assert the negative. | L |
| RSK-4 | Per-check containment masks real defects as a vague "unreachable" | M | M | Every unreachable verdict carries condition `doctor.check.<area>.unreachable`, a bounded detail naming the failed source and reason, and an actionable hint; containment is scoped strictly inside the check boundary; isolation tests inject throws and malformed results per check. | L–M |
| RSK-5 | Exit-code confusion between check failures (1) and unable-to-run (2) | M | M | The taxonomy is pinned (F-9, Appendix A), documented in the feature spec and man page, asserted by golden cases, and reachable only through the existing projection; no override path exists. | L |
| RSK-6 | Doctor's findings drift from the refusals other surfaces enforce (watchdog preflight, verify gates) | M | M | Doctor is positioned as diagnostic-only; conditions mirror delivered guidance text (for example the salvage hint) without reusing refusal identities; docs state the complementarity explicitly; phase 7 reconciles the surfaces' docs. | L–M |
| RSK-7 | Network reads make doctor slow or flaky in constrained environments | M | M | At most two single-page reads with declared limits, no pagination, no retries, shared sources read once; default CI is fixture-only with zero live network; the human report renders even when both network checks are unreachable. | L–M |
| RSK-8 | Routine provider parks (peak windows) train operators to ignore exit 1 | M | M | Capacity/time parks are wiring-neutral: they appear in detail with cause/expiry and a prescription but never flip the verdict or the exit; only credential-caused parks (wiring defects) fail the check (DEC-6). | L |
| RSK-9 | New error rows or docs drift from the machine table | M | L | Evolution discipline: one row with structured fields, projection class, documented row, and sync-check corpora/fixture coverage landing in the same change; both-direction drift fails closed. | L |
| RSK-10 | Scope creep into repair actions or extra areas | M | M | Non-goals are explicit (NG-1, NG-4); the condition catalog is closed; adding a check is a contract change requiring this spec's amendment, not a runtime branch. | L–M |

## 12. ASSUMPTIONS

- The repository is a git checkout with an `origin` remote pointing at a GitHub repository; otherwise the repo check fails truthfully and dependent network checks are unreachable — doctor still returns a full five-check report.
- A tracker credential is resolvable through the injected credential port for live wiring reads; absence is a `fail` with a hint, never an anonymous fallback.
- The delivered configuration-read pattern (the status/brief/queue-ready runtime precedent) resolves configuration tolerantly inside the provider-configuration read: a resolver failure arrives as a read result carrying the classified `config.*` failure code, and a provider-branch validation failure arrives as `provider-chain-unresolved` with `failureCode: "config.value.invalid"`. Doctor consumes both as provider-check evidence, so a broken configuration source never aborts the run and all five checks still report.
- The provider configuration branch is the delivered typed branch; "no default chain declared" is a valid resolved state that the provider check reports as a wiring defect with a hint (the shipped defaults intentionally ship no chain).
- Persisted parks and announcements in the verified state fold are the recorded engine evidence doctor reads; doctor never makes a live provider call to detect credential expiry. The observable credential defects are: an unresolvable credential reference or port resolution failure, a wiring read rejected with HTTP 401/403 (classified from the structured `httpStatus`), and a recorded `credential-missing`/`credential-rejected` park; the pack example's "token expired" detail corresponds to recorded evidence or a rejected wiring read, never to a live probe.
- The delivered GitHub client's bounded list and check-runs reads and the repository adapter's checkout/HEAD/binding facts are reused unchanged; doctor adds no adapter read.
- The verified-empty store and the observed-empty network page are successful reads (wiring proven); they are the only zero-claim paths.
- Default CI has no live network or live credential; all doctor suites are fixture-driven and deterministic.
- Doctor composition follows the existing command program pattern; tests inject the runtime composition directly.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | GH-172 result contract and error table | The envelope, classification chain, `{0, 1, 2}` projection, containment entries, redaction chokepoint, and the sync discipline the new `doctor` kind and row join. |
| Depends on | GH-175 status digest (M0-S6, merged PR #209) | Repository binding from `origin`, bounded single-page GitHub list and check-runs reads, park-fold consumption pattern, closed-evidence rules, and the human-renderer hook doctor reuses. |
| Depends on | GH-182 provider engine (M0-S13, merged PR #202) | The typed provider branch, chain vocabulary, pure chain validation, park records, and persisted announcements doctor reads as wiring evidence. |
| Depends on | GH-174 state layer | Verified store reads, torn/schema/unknown classification, and the provider records fold; doctor never writes or repairs. |
| Depends on | GH-173 configuration layer | The resolved configuration snapshot consumed at composition; doctor adds no key. |
| Depends on | GH-181 adapter ports and credential port | Credential presence resolution and the injected read sources; no new allowlist entry. |
| Depends on | GH-171 branding seam | Injected brand binary name; forbidden-literal gates over the new surface. |
| Depends on | GH-170 monorepo scaffold and toolchain | Package tiers, boundary enforcement, aggregate check. |
| Informed by | GH-177 verify change (TDR-0005) | The outcome pattern: classified failure envelope, deterministic multi-finding summary, envelope exclusivity, exit projection. |
| Informed by | GH-176 queue ready | Read-only slice discipline and error-identity reuse without new rows. |
| Informed by | GH-221 watchdog lane contracts | The dirty/non-base checkout conditions; doctor diagnoses them as wiring findings, never refuses, and reuses no refusal identity. |
| Blocks | None binding | No backlog story declares a dependency on M1-S3; later operator workflows and onboarding guides may adopt doctor. |
| External | GitHub REST API | Read-only issues and check-runs reads through the delivered client; credentials through the credential port. |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Should doctor evaluate base-branch conformance once a global declared base source exists? | The base is lane-scoped in the delivered watchdog contracts; no global declaration exists, and this change declines to invent a configuration key (DEC-8). v1 reports observed branch/HEAD facts without a base verdict. | Non-blocking. Revisit when the queue/daemon lane defaults introduce a global base declaration; consult `@decision-advisor` if a global base key is proposed system-wide. |
| OQ-2 | Should doctor gain an opt-in live smoke (credentialed structural run against this repository) like the status digest's? | The ticket AC is fixture-provable; a live smoke adds scope without a named consumer today. | Non-blocking. Deferred (§7.3); propose when an operator workflow needs live evidence. |
| OQ-3 | Which persisted provider announcements count as current wiring evidence, and over what recency window? | v1 reads persisted announcements as recorded evidence without a staleness window; tightening semantics needs a named consumer. | Non-blocking. Deferred (§7.3). |

**Test-plan gaps folded into v1.1.** The test plan's findings GAP-4/OQ-T3 (auth-vs-transport on wiring reads), OQ-T10 (ci-row alignment), OQ-T11 (`reevaluation-cap` disposition), and OQ-T2 (provider-configuration unreadable condition) are resolved canonically in this revision and are no longer open: the read-result `httpStatus` enrichment (DEC-11), the shared credential-rejection mechanism across tracker and CI, the `reevaluation-cap` wiring-neutral disposition (DEC-6), and the removal of the ambiguous provider-configuration condition in favor of the delivered two-reason read (DEC-12). No scope, verdict vocabulary, exit taxonomy, error-table posture, or pinned behavior changes; the AC count is unchanged.

## 15. DECISION LOG

| ID | Decision | Rationale | Rejected alternatives |
|----|----------|-----------|-----------------------|
| DEC-1 | The surface is exactly `<binary> doctor [--json]`: no positionals, no command-specific flags, no `--fix-hints`. | Hints are unconditional per the pinned ticket decision; `--json` is the standard machine-output switch; matches the registry and the command-surface precedent. | `--fix-hints` (pack man-page drift — reconciled in this change); `--fix` (contradicts diagnose-and-prescribe); area filters. |
| DEC-2 | Five fixed areas in fixed order; the pack's binary ok/fail proposal is refined into the closed vocabulary `ok \| fail \| unreachable`, and both non-ok verdicts are failing checks that always carry detail + fix hint. | Unreachable must be distinguishable from an observed defect so hints stay truthful; a binary vocabulary cannot express "evidence could not be obtained"; the refinement is sanctioned by the planning-session outcome. | Binary ok/failing only; a numeric severity scale; per-area vocabularies. |
| DEC-3 | Outcome modeling follows the verify-change precedent: any non-ok → the single classified `doctor.check.failed` error envelope, exit `1`, deterministic summary naming every failing check with verdict + hint in area order; all-ok → success envelope with the report as `data`, exit `0`; no data-bearing failure envelope; envelope shape unchanged. | Pinned PM decision; the result contract forbids failure envelopes carrying data and exit overrides outside the projection; the summary grammar is the proven vehicle for multi-finding prescriptions. | A data-bearing failure envelope (pack sketch — ruled out); per-failure identities; a doctor-specific envelope shape; exit overrides. |
| DEC-4 | Per-check isolation: each check executes inside its own containment boundary; any failure inside becomes that check's `unreachable` verdict with `doctor.check.<area>.unreachable` + hint; `fallback.internal` and platform-category identities apply only outside per-check execution. | The pinned "never crashes" guarantee; containment inside checks must not swallow the whole run, and containment outside must not masquerade as check data. | Letting a thrown check abort the run; classifying check-internal failures through `fallback.internal`; suppressing failed checks. |
| DEC-5 | Network posture: tracker and CI checks perform exactly one bounded single-page read each (status-collector precedent); repo, provider, and state checks are local; shared sources are read once and reused. | Wiring needs proof of reachability and auth, not enumeration; two reads bound cost, flake surface, and rate-limit exposure; the reads already exist. | Live probes per provider entry; paginating reads; per-check independent binding/credential resolution. |
| DEC-6 | Provider check semantics: credential wiring defects fail (configuration-resolution or provider-branch validation failure, undeclared chain, unresolvable credential reference, active park with a credential cause); capacity, environment, and loop-cap parks (`peak-window`, `quota-exhausted`, `provider-outage`, `chain-exhausted`, `reevaluation-cap`) are wiring-neutral detail with cause, expiry, and a `provider quota` directive; the check never fetches quota or calls the engine. `reevaluation-cap` is wiring-neutral because it is the engine's self-expiring defensive loop-cap pause — a capacity/environment condition, not a configuration or credential defect — and flipping it to fail would break DEC-6's exit-stability driver the same way a routine peak window would. | Keeps exit semantics stable (routine engine pauses must not train operators to ignore exit 1), keeps doctor quota-free, and still surfaces every recorded park truthfully with a prescription. | Parks flipping the verdict to fail (breaks exit stability); a separate `degraded` verdict (exit semantics unclear under the pinned decision); live quota evaluation (burns quota). |
| DEC-7 | Error-table evolution: a new `doctor` domain kind with exactly one row, `doctor.check.failed` (user, not_landed, user-validation → exit 1); the exit-2 population reuses existing platform-category identities and containment; check-level causes remain check data and never become error rows. | One aggregate identity matches the one-verdict-per-run outcome model and the verify precedent; per-cause rows would duplicate data the check evidence already carries; the sync discipline keeps docs bound. | Multiple `doctor.*` rows per condition; reusing `input.value.rejected` for check failures; a doctor-specific projection class. |
| DEC-8 | The repo check evaluates work-tree presence, cleanliness, and the `origin` binding; it reports observed branch/HEAD facts but evaluates no base-branch conformance in v1. | The base is lane-scoped in the delivered watchdog contracts; no global declared base source exists, and inventing a configuration key violates this change's no-new-keys constraint (OQ-1 tracks the later story). | A hardcoded base branch (repo-specific policy in code); a new base configuration key; reusing watchdog refusal identities. |
| DEC-9 | Default test evidence is fixture-driven with zero live network; a credentialed live smoke is deferred until a named consumer needs it. | The ticket AC is fixture-provable; default-CI determinism and speed are protected; the status precedent shows the live-smoke pattern can be added later. | Live network in default CI; a live smoke in v1 without a consumer. |
| DEC-10 | Doctor declares its own contract constants (read limits, text bounds) rather than importing status's `STATUS_*` caps. | Command-scoped bounds keep each command's contract self-contained; sharing caps would couple two commands' evolution. | Importing `STATUS_*` constants; a shared caps module; configuration keys for bounds. |
| DEC-11 | Resolution of the test plan's GAP-4/OQ-T3, option (b): the shared adapter-local payload-failure type gains one optional structured `httpStatus` field supplied by the GitHub read slice on non-2xx responses, and the tracker and CI checks classify a credential rejection from `httpStatus` 401/403 (the provider engine's established auth-rejection semantic) while every other non-2xx response and transport error stays `unreachable`/`read-failed`. | The delivered read results fold 401/403 into the same payload failure as server and transport errors — only a prose detail carries the status — so option (a) is unavailable; the enrichment is type-additive (optional field, existing identity unchanged), precedented (quota evidence and the announcement allowlist already carry structured `httpStatus`), small, in-change, and keeps the canonical wiring defect (a rejected token) prescriptive; classifications derive from structured data, never remote prose. | (a) pinning a distinction that does not exist; (c) narrowing AC-F4-1 to unreachable-with-generic-hint (weakens the ticket's primary prescription); parsing the prose detail string; promoting a new auth failure identity to the error table. |
| DEC-12 | Resolution of OQ-T2: the ambiguous "provider configuration branch unreadable at check scope" condition is removed; the provider check consumes the delivered two-reason provider-configuration read — `config-invalid` (resolver failure, classified `config.*` failure code) and `provider-chain-unresolved` (provider-branch validation failure, `failureCode: "config.value.invalid"`) — both as `fail` conditions with hints, following the tolerant-read pattern delivered for status/brief/queue-ready. | The delivered read result exposes exactly those two failure reasons and no third "unreadable" state; the tolerant pattern keeps all five checks reporting on a broken configuration source (never-crash, totality), and a malformed configuration source is precisely a wiring defect doctor should diagnose with a hint. | Keeping the ambiguous condition; a command-level config failure that aborts the run and hides four healthy checks (contradicts the delivered tolerant-read precedent and the totality guarantee). |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Runtime-neutral contracts | Extended — the `delivery.doctor.v1` vocabulary: areas, verdicts, condition catalog, reason set, evidence model, bounds, report and check shapes, failure-summary grammar; `DOMAIN_KINDS` gains `doctor` with the single `doctor.check.failed` row. |
| Core domain tier | New — pure doctor aggregation: verdict derivation from injected check results, summary-count assembly, failure-summary rendering. Imports contracts only; no I/O. |
| Core config/provider/state tiers | Consumed — resolved configuration snapshot, pure chain validation, verified store reads and provider records fold; no changes. |
| Adapter subpaths (GitHub, repo, file, credentials) | Extended and consumed — the shared adapter-local payload-failure type gains one optional structured `httpStatus` field supplied by the GitHub read slice on non-2xx responses, with one added GitHub trap-catalog entry and fixture assertion; the bounded list and check-runs reads, checkout/HEAD/binding facts, and credential presence are consumed unchanged; no new reads. |
| CLI surface | Extended — the `doctor` command definition, runtime composition beside the existing commands, and the human-renderer hook's delivered ten-consumer set, which already includes doctor alongside the board command landed mid-delivery via GH-229; edge wiring unchanged in shape. |
| Result contract / error table | Extended — `doctor` kind + one row, documented row, corpora/fixtures, and feature-doc reconciliation; sync and exit-literal invariants stay green. |
| Command registry (planning pack) | Reconciled in-change — man-page grammar drift corrected; registry row wording already accurate. |
| New current-truth feature spec | New — the doctor feature spec authored in-change and registered in the required scans. |
| Tests and fixtures | New — structure, behaviour, boundary, and golden suites plus the doctor fixture corpus (verdict matrix, negative controls, isolation injections, summary grammar). |
| Changeset | New — one minor changeset for the affected workspace packages. |
| Bash stack, `.opencode/`, `.ados-claude/` | Untouched. |

## 17. ACCEPTANCE CRITERIA

Ticket AC coverage: "doctor output names each failing check with a fix hint" → AC-F9-1, AC-F2-1, with per-check guarantees in AC-F3-1 through AC-F7-1 and the never-crash guarantee in AC-F8-1. Pinned decision ("every failing check names a fix hint; doctor exits 1 with classified errors and never crashes") → AC-F9-1, AC-F9-3, AC-F8-1, AC-F8-2. v1.1 refinements: the credential-rejection classification (structured HTTP 401/403) is pinned in AC-F4-1 and AC-F7-1 (DEC-11); the provider-configuration failure reasons are pinned in AC-F5-2 (DEC-12); the `reevaluation-cap` wiring-neutral disposition is pinned in AC-F5-1 (DEC-6).

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** the composed command program, **when** `doctor` runs with no positionals and no command flags, **then** it executes all five checks and returns one outcome; **when** an extra positional or unknown flag is supplied, **then** the parser rejects with `fallback.invocation`, exit `1`, and no source read occurs; `--json` is the only global output switch and adds no doctor-specific behavior; no `--fix-hints` or other doctor flag exists. | F-1, DEC-1, NFR-4 |
| AC-F1-2 | **Given** any doctor invocation, **when** it runs, **then** it performs zero writes, zero fence acquisitions, zero state mutations, zero network writes, and zero child processes; replay over identical injected inputs yields identical machine and human output. | F-12, NFR-6 |
| AC-F2-1 | **Given** any completed doctor run, **when** the report is inspected, **then** `checks` contains exactly the five areas in the fixed order `repo`, `tracker`, `provider`, `state`, `ci`; each carries exactly one verdict from `ok`/`fail`/`unreachable`, a non-empty bounded detail, evidence (sources, outcomes, reasons), and — if and only if the verdict is non-ok — a non-empty bounded fix hint. | F-2, DM-2, DM-3, NFR-1 |
| AC-F2-2 | **Given** the verdict derivation matrix in Appendix A, **when** each fixture world state is aggregated, **then** every check's verdict matches the matrix; no condition maps to a verdict other than its declared one, and the evidence reasons match the closed set (DM-6) with no invented reason. | F-2, DM-3, DM-6, NFR-3 |
| AC-F2-3 | **Given** the negative-control matrix — a failed tracker read, an unattempted tracker read (unresolvable binding), a failed CI read, a missing credential, a torn store, an undeclared provider chain, an unreadable provider park fold, and a contained check-internal throw — **when** doctor runs, **then** no control yields an `ok` verdict for the affected check and no check reports a fabricated detail; an unobserved read is `unreachable` (or `fail` where the condition catalog declares a locally observable defect), never ok. | F-2, F-8, NFR-3 |
| AC-F3-1 | **Given** a clean checkout with a resolvable GitHub `origin`, **when** the repo check runs, **then** it is `ok` with factual branch/HEAD detail and no base-conformance claim; **given** a dirty working tree, **then** it is `fail` with a commit-or-discard hint and no `watchdog.*` identity is used; **given** a missing, unparseable, or non-GitHub `origin`, **then** it is `fail` with a fix-the-remote hint; **given** unreadable checkout facts, **then** it is `unreachable` with `doctor.check.repo.unreachable` and a hint. | F-3, DM-5, DEC-8 |
| AC-F4-1 | **Given** a resolvable binding and a resolvable tracker credential, **when** the tracker check runs, **then** it performs exactly one bounded single-page list read and is `ok` on success — including a verified-empty page; **given** a credential that does not resolve through the port, **then** it is `fail` with a hint naming the declared environment variable only; **given** a wiring read that fails with structured `httpStatus` 401 or 403, **then** it is `fail` with a replace-or-broaden-the-credential hint and reason `credential-rejected`, classified from the structured status only; **given** any other non-2xx response, transport error, or timeout on the read, **then** it is `unreachable` with `doctor.check.tracker.unreachable` and a check-the-credential-and-reachability hint; **given** an unresolvable binding, **then** the read is not attempted and the check is `unreachable` with a hint directing to the repo finding. | F-4, DM-4, DM-5, DEC-11, NFR-3, NFR-7 |
| AC-F5-1 | **Given** a declared, structurally valid chain with resolvable credentials and a readable park/announcement fold, **when** the provider check runs, **then** it is `ok`; **given** an active capacity, environment, or loop-cap park on an entry (`peak-window`, `quota-exhausted`, `provider-outage`, `chain-exhausted`, or `reevaluation-cap`), **then** the verdict stays `ok` but the detail names the park with its cause and expiry and carries the directive `provider quota --provider <name>`; **given** an active park with cause `credential-missing` or `credential-rejected`, **then** the check is `fail` with a refresh-the-credential hint naming the source key only. | F-5, DM-3, DEC-6 |
| AC-F5-2 | **Given** provider wiring defects, **when** the provider check runs, **then** a configuration-resolution failure is `fail` with a correct-the-named-source hint and the classified `config.*` failure code in evidence (reason `config-invalid`), a provider-branch validation failure is `fail` with a correct-the-provider-configuration hint and `failureCode: "config.value.invalid"` (reason `provider-chain-unresolved`), a missing default chain is `fail` with a declare-a-chain hint (reason `provider-chain-not-declared`), and an unresolvable credential reference is `fail` with a supply-the-credential hint; **given** an unreadable park/announcement fold, **then** the check is `unreachable` with reason `state-unreadable` and a repair-the-store hint and never reports "no parks". | F-5, DM-4, DM-6, DEC-12, NFR-3 |
| AC-F5-3 | **Given** any provider check run, **when** it executes, **then** it makes zero quota fetches, zero provider-engine `resolve` calls, zero park or announcement writes, zero peak/quota condition evaluations, and never injects or uses the quota transport. | F-5, NFR-5 |
| AC-F6-1 | **Given** delivered state stores that verify (including verified-empty), **when** the state check runs, **then** it is `ok`; **given** a torn store, **then** it is `fail` with the salvage-as-a-separate-step hint and doctor executes no salvage; **given** a schema mismatch, permission failure, or undeclared record kind, **then** it is `fail` with the corresponding delivered remediation guidance as the hint; **given** store facts unreadable beyond those classified conditions, **then** it is `unreachable` with `doctor.check.state.unreachable`. | F-6, NFR-3 |
| AC-F7-1 | **Given** a resolvable binding, credential, and commit, **when** the CI check runs, **then** it performs exactly one bounded single-page check-runs read and is `ok` on success — including a read returning zero runs (observed-empty); **given** a credential that does not resolve through the port, **then** it is `fail` with the environment-variable hint; **given** a wiring read that fails with structured `httpStatus` 401 or 403, **then** it is `fail` with the same credential-rejection hint and reason as the tracker check (the one shared mechanism, DEC-11); **given** an unresolved commit (for example a detached HEAD), **then** it is `fail` with a run-from-a-branch hint; **given** a transport failure, any other non-2xx response, or an unattempted read, **then** it is `unreachable` with the corresponding condition and hint; **given** a read that returns failed runs, **then** the verdict is unaffected (build health is not wiring). | F-7, DM-4, DM-5, DEC-11, NG-6, NFR-7 |
| AC-F8-1 | **Given** injected failures inside each check's execution in turn — a thrown value, a rejected promise, and a malformed intermediate result — **when** doctor runs, **then** the affected check is `unreachable` with `doctor.check.<area>.unreachable`, a bounded detail, and a fix hint; the other four checks complete with their own verdicts; the run returns the full five-check outcome; and the command never crashes, never aborts sibling checks, and never resolves a check-internal failure through `fallback.internal`. | F-8, NFR-2 |
| AC-F8-2 | **Given** the delivered code, **when** containment is inspected across outcomes, **then** `fallback.internal` (and platform-category identities) occur only outside per-check execution (composition, aggregation, envelope assembly, serialization); no documented failure class is contained as `fallback.internal`; 0 check-internal failures escape their boundary. | F-8, F-9, NFR-2 |
| AC-F9-1 | **Given** a doctor run in which at least one check is `fail` or `unreachable`, **when** the command completes, **then** it returns an error envelope carrying exactly the identity `doctor.check.failed`, exit `1`, and a deterministic one-line summary that names EVERY failing check with its verdict and fix hint in fixed area order (`doctor check failures (<n>/5) — <area> (<verdict>): <fixHint>; …`), with newlines collapsed and no secrets or remote-controlled prose; non-failing checks never appear in the summary. | F-9, DM-7, NFR-4 |
| AC-F9-2 | **Given** a doctor run in which every check is `ok`, **when** the command completes, **then** it returns a success envelope, exit `0`, whose `data` is the `delivery.doctor.v1` report (five checks, summary counts, binding); **given** any failing-check run, **then** the failure envelope carries no `data`; every envelope carries exactly the v1 key set (`schemaVersion`, `runId`, `exitCode`, `timing`, and exactly one of `data`/`error`). | F-9, DM-1, NFR-4 |
| AC-F9-3 | **Given** a doctor run that cannot complete — containment outside per-check execution, or a platform-category classified failure outside per-check execution — **when** the command completes, **then** the existing classification chain projects exit `2` with the classified identity, no doctor report is fabricated, and no exit override exists anywhere; across all outcomes every exit is in `{0, 1, 2}` and every projection derives from the table, never a call site. | F-9, NFR-4 |
| AC-F10-1 | **Given** `doctor --json`, **when** it runs, **then** stdout contains exactly one valid `CommandResult` envelope on every outcome and the serialized `data` report is at most 64 KiB; **given** human mode, **then** the deterministic check report (one line per check in fixed order plus one indented hint line per non-ok check, optionally a header) is at most 24 lines and 4096 bytes, is rendered purely from the same data with zero extra reads via the optional human-renderer hook, and the failure diagnostic additionally carries the deterministic failing-checks summary; neither mode uses an LLM. | F-10, DM-8, NFR-8 |
| AC-F11-1 | **Given** the error table and documented table, **when** the change lands, **then** `DOMAIN_KINDS` contains `doctor` with exactly one new row `doctor.check.failed` (user, retryable false, consequence not_landed, projection user-validation, generic remediation hint); no existing row or kind changes; the sync check's corpora and fixtures cover the new row in the same change; the two-way sync and existing classification tests remain green. | F-11, NFR-9 |
| AC-F12-1 | **Given** the delivered code, **when** the structure, boundary, ambient, forbidden-literal, privacy, and secret-read gates run, **then** doctor contracts/domain import only contracts, no new runtime-API location, package subpath, configuration key, state record kind, or secret-read allowlist entry exists, no product literal appears, runtime I/O stays in the admitted adapter subpaths and the CLI edge, and no planted secret survives into any hint, detail, evidence, summary, or diagnostic. | F-12, NFR-10 |
| AC-F12-2 | **Given** the full doctor suite, **when** it runs in default CI, **then** it is fixture-driven with zero live network calls, zero live credentials, and zero process spawns; network-posture fixtures assert at most two single-page reads per run with doctor's declared limits and no pagination or retries. | F-4, F-7, F-12, NFR-7, DEC-9 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Single PR targeting `main-tools`; branch `feat/GH-224/doctor-v1`; one conventional commit per plan phase; the PM never merges.
- Fully additive command, contracts, and one additive error row. No existing command, row, configuration key, state schema, or on-disk artifact changes; rollback is a single PR revert.
- The new current-truth feature spec lands in-change; the result-contract, status-digest, provider-engine, state-layer, and watchdog feature docs, the command registry, glossary, and index are reconciled in the same delivery phase or phase 7, including the planning pack's man-page grammar correction (`--fix-hints` removed).
- A minor changeset is recorded for the affected workspace packages (lockstep versioning).
- Adoption: operators and coordinators can call `<binary> doctor` immediately as a pre-session check; wrappers and scripts branch on the documented exit taxonomy. Agent prompt adoption and MCP surfaces are separate operating-model changes (NG-9).
- No migration, seeding, or store-format change is required.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

Not applicable. Doctor reads existing configuration, existing verified state, existing repository metadata, and the GitHub API. It creates no records, changes no schema version, writes no files, and requires no seed data. Parks, announcements, and ledgers remain owned by their existing writers.

## 20. PRIVACY / COMPLIANCE REVIEW

- Doctor is read-only and collects no telemetry. It performs no network writes and sends no repository data to a vendor beyond the two read-only GitHub API requests (bounded work-items page, bounded check-runs page).
- Credentials resolve only through the credential port for presence; resolved values never enter the report, evidence, hints, summary, diagnostics, or logs. Credential hints name the declared environment variable or source key, never the value.
- Evidence is bounded to sources, outcomes, reasons, and existing classified codes. It carries no raw provider payload, response body, credential material, or repository file content.
- Fix hints and details are built from the closed condition catalog with safe identifier substitution (area, provider name, environment-variable name); no remote-controlled prose is interpolated into any output.
- The serialization redaction chokepoint covers the envelope, the failure summary, and human diagnostics; planted-secret canaries assert the negative on every output surface.
- The human report prints areas, verdicts, and bounded factual details only; no artifact is published by the command.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Read-only by construction:** doctor calls no write or fence API, performs no repair, and never mutates provider, state, or repository artifacts. It cannot change the environment it diagnoses.
- **Credential centralization:** the only credential access is presence resolution through `CredentialPort`; doctor code reads no ambient environment and adds no secret-read allowlist entry.
- **No shell or spawn:** checkout, HEAD, and remote facts come from bounded git metadata reads through the repository adapter; doctor spawns no child process and executes no shell.
- **Bounded addressing:** only the `origin` remote is read; only a GitHub host binding is accepted; userinfo and credentials in a remote URL are discarded; non-GitHub hosts are a wiring defect, not an attempted connection.
- **Bounded network surface:** at most two single-page reads at declared limits, no pagination, no retries, no URL construction beyond the bound repository and the delivered read endpoints.
- **Closed output vocabulary:** verdicts, reasons, and hints come from declared contract data; no runtime string assembly from remote content can smuggle instructions or secrets into agent-consumed output.
- **Containment discipline:** check-internal failures are contained into verdicts with bounded details; containment identities never classify documented classes; `fallback.internal` remains outside the check boundary.
- **Brand neutrality:** no product or binary literal is committed; human output uses the injected brand binary name.
- **Denial-of-service:** pure aggregation is linear over the fixed five-check report; no recursion, no unbounded loops, no retry storms.

## 22. MAINTENANCE & OPERATIONS IMPACT

- Adding a wiring condition is a contract change: the condition catalog entry (verdict mapping, hint template), the derivation-matrix row, fixtures, and docs move together.
- Adding a sixth area (for example the M3 memory family) is a spec amendment with a new area id, sources, conditions, and matrix rows — not a runtime branch.
- The hint catalog is contract data: wording changes are doc-and-contract changes with fixture updates; hints must stay action-first and secret-free by the catalog's construction.
- The GitHub client's trap catalog remains the early-warning surface for the two reads doctor inherits; doctor adds no read and extends no catalog.
- The error table grows by exactly one row; the sync check, corpora, and fixtures extend in the same change, and future `doctor.*` rows follow the same evolution discipline.
- Docs to keep current: the doctor feature spec, the result-contract feature doc (new kind/row), the status/provider/state consumer notes (doctor as a read-only consumer), the command registry, the glossary, and the index.
- Operational surface stays small: one read-only command, at most two bounded outbound reads, one config resolve, shared local reads, no daemon, no background process, and no new configuration knob.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Wiring | The configuration, credential, binding, and reachability facts that let delivery commands work; distinct from delivery outcomes and build health. |
| Check | One of the five fixed doctor areas (`repo`, `tracker`, `provider`, `state`, `ci`) evaluated against declared conditions over injected sources. |
| Verdict | A check's outcome from the closed set `ok`, `fail`, `unreachable`; both non-ok values are failing checks. |
| `fail` | A wiring defect was observed: a locally observable defect, or a performed wiring read that returned a definitive defect. |
| `unreachable` | The check could not obtain its evidence: a required read was not attempted (dependency unavailable), the read attempt failed on transport, or the check's execution failed and was contained (`doctor.check.<area>.unreachable`). |
| Fix hint | The action-first, secret-free prescription attached to every non-ok verdict, built from the closed condition catalog with safe identifier substitution. |
| Per-check isolation | The containment boundary around each check's execution: internal failures become that check's `unreachable` verdict and never crash, abort, or escape the run. |
| Closed-evidence rule | An unobserved, failed, or unattempted read is never an ok verdict and never a fabricated detail; verified-empty and observed-empty are the only zero-claim paths. |
| Wiring-neutral park | An active provider park whose cause is capacity or environment (peak, quota, outage, chain-exhausted); reported in detail with cause, expiry, and a `provider quota` directive, but not a wiring defect. |
| Credential-caused park | An active provider park with cause `credential-missing` or `credential-rejected`; a recorded wiring defect that fails the provider check. |
| Doctor-unable-to-run | Failures outside per-check execution (composition, aggregation, envelope assembly, serialization) classified through the existing chain; platform-category outcomes project exit `2`. |
| Failure summary | The deterministic one-line summary on the `doctor.check.failed` envelope naming every failing check with its verdict and fix hint in fixed area order. |
| Doctor report | The `delivery.doctor.v1` success payload: five checks, evidence, summary counts, and the shared repository binding. |

## 24. APPENDICES

### Appendix A — Verdict derivation matrix

| Check | `ok` | `fail` | `unreachable` |
|---|---|---|---|
| `repo` | work tree readable, working tree clean, `origin` resolves to a GitHub binding | dirty working tree (`checkout-dirty`); missing/unparseable/non-GitHub `origin` (`remote-unresolvable`) | checkout facts unreadable or contained (`checkout-unreadable` / `check-unreachable`) |
| `tracker` | binding resolved, credential resolvable, one bounded read succeeded (incl. observed-empty) | credential unresolvable (`credential-unavailable`); wiring read failed with structured `httpStatus` 401/403 — credential rejection (`credential-rejected`) | binding unresolvable → read not attempted (`not-attempted`); any other non-2xx response or transport/server read failure (`read-failed`); contained execution (`check-unreachable`) |
| `provider` | provider-configuration read succeeded, default chain declared and structurally resolvable, enabled entries' credential references resolvable, park/announcement fold readable; active capacity, environment, and loop-cap parks (`peak-window`, `quota-exhausted`, `provider-outage`, `chain-exhausted`, `reevaluation-cap`) reported in detail without flipping the verdict | configuration-resolution failure (`config-invalid`, classified `config.*` failure code in evidence); provider-branch validation failure (`provider-chain-unresolved`, `config.value.invalid`); no default chain declared (`provider-chain-not-declared`); credential reference unresolvable (`credential-unavailable`); active park with cause `credential-missing`/`credential-rejected` (`park-credential-cause`) | park/announcement fold read failure (`state-unreadable` → repair-the-store hint); contained execution (`check-unreachable`) |
| `state` | every delivered store verifies (incl. verified-empty) | torn store (`store-torn`); schema mismatch (`store-schema-mismatch`); permission failure (`store-unreadable`, user-fixable); undeclared record kind/schema (`store-unknown`) | store facts unreadable beyond classified conditions or contained (`check-unreachable`) |
| `ci` | binding resolved, credential resolvable, commit resolved, one bounded check-runs read succeeded (incl. zero runs) | credential unresolvable (`credential-unavailable`); wiring read failed with structured `httpStatus` 401/403 — credential rejection, the tracker check's one shared mechanism (`credential-rejected`); commit unresolved (`commit-unresolved`) | binding unresolvable → read not attempted (`not-attempted`); any other non-2xx response or transport/server read failure (`read-failed`); contained execution (`check-unreachable`) |

Matrix scope notes: build health never appears in the `ci` row (NG-6); base-branch conformance appears nowhere (DEC-8); a configuration failure reaches only the provider check as tolerant read evidence — `config-invalid` with the classified `config.*` code, or `provider-chain-unresolved` with `config.value.invalid` — and never aborts the run (DEC-12); the `repo` row's defects are local-only and make no network read. Precedence within a check is the row's left-to-right order: an observed defect (`fail`) outranks a later dependency failure, and any non-ok verdict carries detail + hint.

### Appendix B — Evidence application and failure-summary examples

Evidence application: each check lists its declared sources (DM-5) with outcomes; `read` for a performed successful read, `observed-empty` for a successful verified-empty result, `failed` for a performed read that failed, `not-configured` for a source absent by configuration. Reasons come only from DM-6 and are ordered by first occurrence. `failureCode` is set only when a classified `config.*`/`state.*` failure occurred and is never an adapter-local class; `failureClass` may record the adapter-local payload-failure identity as data and `httpStatus` the structured status delivered by the read slice, from which the `credential-rejected` classification (401/403) is derived — the prose detail is never copied into evidence and never parsed for classification.

Failure-summary examples (deterministic grammar, DM-7):

```text
doctor check failures (1/5) — provider (fail): refresh the credential for provider-c, then run provider quota --provider provider-c
doctor check failures (2/5) — repo (fail): commit or discard the uncommitted changes, then re-run doctor; tracker (unreachable): restore tracker reachability, then re-run doctor
```

Success report shape (`--json` `data`, abridged):

```json
{
  "schemaVersion": "delivery.doctor.v1",
  "generatedAt": "2026-11-18T10:20:00Z",
  "repository": { "host": "github.com", "owner": "…", "name": "…" },
  "checks": [
    { "area": "repo", "verdict": "ok", "detail": "clean work tree on feat/GH-224/doctor-v1", "evidence": { "…": "…" } },
    { "area": "provider", "verdict": "fail", "detail": "credential reference for provider-c does not resolve", "fixHint": "supply the credential through its declared environment source, then re-run doctor", "evidence": { "…": "…" } }
  ],
  "summary": { "total": 5, "ok": 4, "fail": 1, "unreachable": 0 }
}
```

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-06 | spec-writer | Initial specification for GH-224 (M1-S3 doctor v1), authored from the planning-session context, the pinned ticket decision, and the delivered M0/M1 precedents. |
| 1.1 | 2026-11-06 | spec-writer | Reopen resolution for the test plan's GAP-4/OQ-T3, OQ-T10, OQ-T11, and OQ-T2, verified against delivered code truth: the tracker and CI checks classify credential rejection from a new additive structured `httpStatus` field on the adapter-local payload-failure type (option (b), DEC-11); the `ci` row and AC-F7-1 share the tracker's credential-rejection mechanism (OQ-T10); `reevaluation-cap` (verified spelling from the delivered park-cause set) is pinned wiring-neutral in DEC-6 (OQ-T11); the ambiguous "provider configuration branch unreadable at check scope" condition is removed in favor of the delivered two-reason tolerant provider-configuration read (DEC-12). Sections updated: §1, §2.1, §5.1 (F-4, F-5, F-7), §7.1, §8.4, §8.5, §12, §14, §15 (DEC-6, DEC-11, DEC-12), §16, §17 (coverage map, AC-F4-1, AC-F5-1, AC-F5-2, AC-F7-1), §24 (Appendices A, B). No scope, verdict vocabulary, exit taxonomy, error-table posture, or pinned behavior change; AC count unchanged at 21. |
| 1.2 | 2026-11-06 | spec-writer | Factual correction from DoR iteration-1 finding 2: the optional pure human-text renderer hook is delivered with eight command consumers (brief, closeout, db, plan, queue, status, verify, watchdog), not status alone, so doctor is its ninth consumer — not its second — and delivery extends the eight-declarer CLI-edge seam test to include doctor. Corrected in §5.1 (F-10), §8.5, and §16. No other content changed; AC count, decisions, and verdict vocabulary untouched. |
| 1.3 | 2026-11-06 | spec-writer | Factual update only: the delivered human-text renderer consumer set is ten (board, brief, closeout, db, doctor, plan, queue, status, verify, watchdog), not eight+ninth — GH-229's board command landed mid-delivery and was merged onto this branch (seam test verified at commit 8acc2ca1), so doctor joins as one of ten delivered consumers. Updated §5.1 (F-10), §8.5, and §16. No AC, decision, verdict, or bound changed; AC count unchanged at 21. |

---

## AUTHORING GUIDELINES

- Sources: GitHub ticket #224 (M1, labels change+planning) and its pinned decision; the planning-session clarify_scope outcome; the planning pack (`milestones/m1/commands/doctor.md` proposed contract, `backlog.md` §M1-S3, `cli-command-registry.md`, `milestones/m1/contracts.md` §doctor, `milestones/m1/interactions.md` Session F, `milestones/m1/man-page.md`); and the current-truth feature specs (result contract, verify change and exit taxonomy, status digest, queue ready, provider engine, state layer, config layer, watchdog lane contracts, adapter ports, monorepo scaffold).
- The pack's binary ok/fail proposal is refined into the closed ok/fail/unreachable vocabulary and the man-page `--fix-hints` drift is reconciled, both as sanctioned planning-session refinements; the proposed contract's exit codes, `checks[]` shape, and `doctor.check.<area>.unreachable` condition are preserved.
- The outcome model intentionally consumes the v1 result contract (verify-change pattern) instead of evolving it; the one additive error row follows the delivered kind-per-story precedent (db, closeout, plan, watchdog).
- The ticket's citation of `milestones/m1/README.md` refers to conventions that live at `milestones/README.md`; this spec references only existing paths.
- Tech-neutral wording throughout: no file-level implementation steps, no code-level instructions, and no git operations are specified here; the plan and test plan own those.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-224)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + authoring guidelines + validation checklist)
- [x] ID prefixes consistent and unique (F-, DM-, NFR-, RSK-, OQ-, DEC-, AC-)
- [x] Acceptance criteria reference at least one F-/DM-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths, no step-by-step tasks)
- [x] No content duplicated from linked docs
- [x] Front matter validates per front-matter rules
