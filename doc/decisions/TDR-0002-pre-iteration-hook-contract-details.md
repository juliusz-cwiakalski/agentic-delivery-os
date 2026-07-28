---
id: TDR-0002
decision_type: tdr
status: Accepted
created: 2026-07-15
decision_date: 2026-07-16
last_updated: 2026-07-16
summary: "Resolve GH-146 hook details, including a strict data-only output-file protocol for atomic pre-spawn environment updates without sourcing hook code."
owners:
  - Juliusz Ćwiąkalski
service: delivery-os
decision_scope: repo
review_date: 2026-08-15
business_impact: "Enables quota-aware scheduling of autonomous OpenCode sessions (e.g. avoiding Z.AI peak multipliers) without embedding provider policy in the generic loop scripts."
customer_impact: "Opt-in adopters can place a local policy hook at ~/.ados/hooks/pre-opencode-iteration (or ADOS_PRE_ITERATION_HOOK) to gate every spawn/resume; off by default (missing hook = no-op)."
classification:
  domains: [architecture, operations, security, ai/ml]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: medium
  urgency: medium
  uncertainty: low
  blast_radius: team
  recurrence: recurring
governance:
  driver: decision-advisor
  decider: "Juliusz Ćwiąkalski (repo owner)"
  contributors:
    - pm
  reviewers:
    - "Repo owner"
  performers:
    - coder
  informed:
    - "External adopters (via the delivery-modes guide update, AC #11)"
ai_assistance:
  used: true
  roles: [analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: "Juliusz Ćwiąkalski (repo owner)"
  reviewers: []
revisit_triggers:
  - "A second scheduling/example hook is added and the scripts/hooks/ inventory needs a second entry or sub-structuring (re-evaluate the ADOS_HOOK_EXAMPLES inventory)."
  - "Hook processes survive a normal wrapper exit or direct SIGTERM/SIGINT/SIGHUP despite process-group cleanup."
  - "The bounded hook-failure cap (ADOS_HOOK_MAX_FAILURES) proves too tight or too loose in practice (re-tune the default)."
  - "opencode changes its session/spawn model such that 'immediately before each actual spawn/resume' is no longer a single well-defined point."
  - "A user-defined environment update requires multiline/binary values that the line-oriented ADOS_HOOK_ENV_V1 format cannot represent."
  - "A legitimate hook use repeatedly needs variables outside the built-in model namespace and the explicit additive allowlist becomes difficult to govern."
links:
  related_changes: ["GH-146"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/spec/features/feature-autonomous-delivery.md"
  contracts: []
  diagrams: []
  decisions: ["ADR-0001"]
  experiments: []
  metrics: []
  roadmap_items: []
---

# TDR-0002: Pre-Iteration Hook Contract — Lifecycle, Failure Semantics, Distribution, and Testability

> **Revision note.** Critic/readiness corrections are incorporated: one hook-
> failure category, installed example with symmetric uninstall, bounded cleanup
> for normal exit/direct trappable signals, per-retry hook invocation, and a
> strict data-only output-file protocol for atomic environment updates.

## Context

GitHub issue **GH-146** adds an opt-in, user-owned pre-iteration hook to the two
autonomous-delivery loop scripts (`scripts/ceo-loop.sh`, `scripts/deliver-ticket.sh`).
Providers may apply time-dependent quota multipliers (e.g. Z.AI Coding Plan charges
GLM-5.2 / GLM-5-Turbo at higher rates during 14:00–18:00 UTC+8); long-running
autonomous delivery therefore needs a user-specific way to delay a new session
without embedding provider policy in the generic scripts.

The repo owner has already **approved the core contract** (ticket +
`chg-GH-146-pm-notes.yaml`): env override `${ADOS_PRE_ITERATION_HOOK:-$HOME/.ados/hooks/pre-opencode-iteration}`
with the `~/.ados` fallback; run before each *actual* spawn/resume including
watchdog retries; skip JOIN / status / log / stop / reset / `--is-delivering` /
`--last-message` probes and dry-runs; subprocess isolation; exit `0` continues,
non-zero prevents the spawn; **no** wrapper-imposed hook timeout (a scheduling
hook may sleep for hours); `ADOS_HOOK_AGENT=ceo|pm` and `ADOS_HOOK_SCRIPT=ceo-loop|deliver-ticket`
context; and a Z.AI example that blocks **04:30–10:00 UTC** when the relevant
owner-convention environment value starts with `zai-coding-plan/`. The example
does not verify what model OpenCode actually selects.

Six implementation details were left open and are resolved here, under the
rework's minimizing-expansion direction. They are decided together because they
form one contract surface that two scripts must implement consistently and that
adopters build hooks against.

## Problem Framing (Clarified)

Reframe the five open questions in objective terms, separating fact from
assumption:

1. **Where does the Z.AI example live, and how is it distributed?** It must be
   *available to `install.sh --local` adopters* (not stranded in an uninstalled
   doc path) yet *inactive until copied/configured* (placing it at the default
   hook path would auto-activate it).
2. **What is the boundary between "absent" and "loud failure"?** For a missing
   path, the wrapper only performs the required existence check and continues
   the normal spawn path. Open: a file that *exists* but is not
   executable, or exists + executable but fails to exec. Existence is the opt-in
   signal.
3. **What portable cleanup can the wrapper guarantee for a hook that may sleep
   for hours?** Cleanup is guaranteed on normal exit and direct, trappable
   SIGTERM/SIGINT/SIGHUP only. Wrapper-only SIGKILL, host failure, and descendants
   that leave the hook process group are explicitly excluded; no guardian or
   external supervisor is introduced.
4. **What does each script do on a hook failure, without adding hook-specific
   result values, changing existing result domains, or requiring consumer changes?**
5. **What testability seams cover UTC arithmetic and the no-real-sleep test
   requirement (AC #10) without weakening production?**
6. **How can a successful hook update authorized environment variables in the
   parent wrapper before the imminent OpenCode spawn, without sourcing or
   evaluating hook-controlled shell code?** The update must distinguish empty
   values from unsets, reject malformed or unauthorized output atomically, and
   persist for later iterations of the same wrapper process. Downstream meaning
   is entirely user-defined and outside this contract.

- **FACT:** `batch-deliver.sh` classifies a ticket purely on
  `deliver-ticket.sh`'s **exit code** (non-zero → `failed`, continue) — it does
  not parse the `result=` enum. So a hook failure returning exit 1 needs zero
  batch changes.
- **FACT:** `.opencode/agent/ceo.md` workflow step 1 already has a `failed`
  branch ("use `--log <ref>`, decide whether to retry or park"). So a hook
  failure surfacing as `result=failed` + exit 1 flows through the CEO's existing
  failure handling — no prompt change.
- **FACT:** the loop scripts already use tracked process groups and EXIT/signal
  traps. The hook mirrors that pattern only for normal exit and direct trappable
  signals, with the exclusions above.
- **ASSUMPTION:** the Z.AI windows/lead-time are stable enough that a static
  04:30–10:00 UTC rule is useful; the example is user-owned and editable, so this
  is a tunable default, not a hard commitment.
- **FACT:** a subprocess cannot directly mutate its parent's environment;
  parent-side import is required for changes to reach the imminent OpenCode
  child and later iterations of that wrapper.
- **FACT:** `.ai/rules/bash.md` says never to source untrusted files and to avoid
  `eval`. A sourced hook or sourced shell-syntax output would permit arbitrary
  parent-shell commands, traps, options, functions, and control-flow changes.

## Constraints (Hard Requirements)

Binary pass/fail gates inherited from the approved core contract and the ticket's
Acceptance Criteria, tightened by the rework direction. The six details are
resolved *within* them.

### C-1: Per-spawn execution; excluded paths never invoke the hook

- **Statement:** the hook runs inside every spawn/retry iteration, immediately
  before that iteration's `run_single_iteration`/actual new or resumed
  `opencode run`. It is never invoked on JOIN paths, status/log/stop/reset/last-message
  probes, `--is-delivering`, or dry-runs.
- **Source:** AC #1, #2, #3; ticket "Generic hook contract".
- **Verification:** test (hook-counter fixture asserted across spawn/resume/retry
  vs JOIN/probe/dry-run paths).
- **Negotiable:** no.

### C-2: Missing hook performs only the existence check, then continues

- **Statement:** when the resolved hook path does not exist, the wrapper performs
  the required path existence check, creates no hook subprocess or temporary
  output artifact, performs no intentional wait/sleep, emits no hook-related log
  output, and continues the normal spawn path.
- **Source:** AC #4, narrowed to deterministic observable behavior.
- **Verification:** test asserts exactly one required path-existence decision,
  no hook subprocess, no temporary output artifact, no intentional wait/sleep,
  no hook-related log output, and continuation to the normal spawn path.
  Verification is behavioral only.
- **Negotiable:** no.

### C-3: No wrapper-imposed hook execution timeout

- **Statement:** the wrapper never kills a hook for taking too long; a scheduling
  hook may legitimately sleep for hours. Cleanup during normal/direct trappable
  wrapper shutdown is distinct from an execution timeout (see C-4).
- **Source:** AC #7; ticket "does not impose a hook timeout".
- **Verification:** test + code review (no `timeout`-wrapping of the hook call).
- **Negotiable:** no.

### C-4: Cleanup on normal exit and direct trappable termination

- **Statement:** on normal wrapper exit or when the wrapper directly receives
  SIGTERM, SIGINT, or SIGHUP, it terminates the active hook process group.
  Wrapper-only SIGKILL, host/power failure, and descendants that leave the hook
  process group are explicitly excluded. No guardian, daemon, or external
  supervisor is introduced.
- **Source:** repo-owner decision (2026-07-16), narrowing the hook-specific
  interpretation of AC #7 / `feature-autonomous-delivery.md` NFR-4 / INV-DM-2.
- **Verification:** tests cover normal exit and direct SIGTERM/SIGINT/SIGHUP for
  processes remaining in the hook group; documentation records the exclusions
  and makes no cleanup assertion for them.
- **Negotiable:** no.

### C-5: Single non-zero category — hook failure prevents spawn, is an actionable error

- **Statement:** hook exit `0` permits the spawn. A **hook failure** — non-zero
  exit, not-executable, or exec-failure — is a **single category** that prevents
  that iteration from spawning OpenCode and emits a clear, actionable diagnostic.
  **No new result classifications are introduced.** Scheduling policy that wants
  to *defer* a spawn expresses that by **sleeping and later exiting 0**, never by
  a distinct non-zero classification. `classify_result` retains its existing
  `merged | blocked | pr-open | failed | unknown` domain; emitted summaries may
  additionally carry pre-existing control/outcome values such as `finished` and
  `max-restarts`, depending on path. This decision neither normalizes those
  domains nor changes consumers; it adds no hook-specific value.
- **Source:** AC #6; rework direction §1; `ceo.md`/`batch-deliver.sh` consumer
  contracts.
- **Verification:** test (exit-0 spawns; failure emits diagnostic and does not
  spawn); grep (no `vetoed`/`hook-error` enum added to `deliver-ticket.sh`).
- **Negotiable:** no.

### C-6: Z.AI example window, UTC arithmetic, configured-value check

- **Statement:** the example blocks new sessions during **04:30–10:00 UTC**
  (14:00–18:00 UTC+8 plus the 90-minute lead-in), sleeps until 10:00 UTC, uses UTC
  arithmetic (timezone/DST-invariant), logs the reason + UTC wake time, and
  applies scheduling only when the example's configured input
  (`OC_ADOS_AGENT_CEO_MODEL` / `OC_ADOS_AGENT_PM_MODEL` by `ADOS_HOOK_AGENT`)
  starts with `zai-coding-plan/`; other values return without sleeping. This is
  a user-setup convention, not verification of the model OpenCode actually uses.
- **Source:** AC #8, #9.
- **Verification:** pure-function unit tests on injected UTC epochs at the
  boundaries (04:29:59 / 04:30:00 / 09:59:59 / 10:00:00) and on the configured
  example input value.
- **Negotiable:** no.

### C-7: Tests cover the enumerated cases without real multi-hour sleeps

- **Statement:** automated tests cover hook absence, success, failure, context
  (`ADOS_HOOK_AGENT` / `ADOS_HOOK_SCRIPT`), retry invocation, excluded paths,
  configured example-value checks, UTC window boundaries, and computed sleep duration — without
  real multi-hour sleeps.
- **Source:** AC #10.
- **Verification:** the test suite itself (`scripts/.tests/test-*.sh`).
- **Negotiable:** no.

### C-8: Example registered for install AND uninstall; passes the gates

- **Statement:** the Z.AI example is an **installed** artifact available to
  `install.sh --local` adopters, placed under a clear `scripts/hooks/` path and
  **registered in the relevant install inventory** (a new `ADOS_HOOK_EXAMPLES`
  array), copied executable + content-synced to `./scripts/hooks/`. **Symmetrically,
  `uninstall.sh --local` MUST remove it** (the existing `remove_local_files`
  delivery-script path uses a hardcoded independent list, not the install arrays —
  GAP-U1: that list and the empty-dir cleanup loop currently omit the new file/dir,
  so they must be extended in this change) **and the empty `scripts/hooks/` dir is
  cleaned**. It passes the Bash gate (shellcheck/shfmt/tests), the install gate,
  and the uninstall gate. The documentation-distribution guard is doc-scoped
  (`doc/guides`, `doc/templates`, standalone docs) and does not scan `scripts/`,
  so no `ados_distribution` marker applies. (Satisfies AC #12.)
- **Source:** AC #12; rework direction §3; GAP-U1 (`scripts/uninstall.sh` +
  `scripts/.tests/test-uninstall.sh`).
- **Verification:** `scripts/.tests/test-doc-distribution.sh`;
  `scripts/.tests/test-uninstall.sh` (new assertion: the example file is removed
  and `scripts/hooks/` is cleaned by `remove_local_files`); install manifest
  review; a sandbox `install.sh --local` showing the example lands in
  `./scripts/hooks/`, then `uninstall.sh --local --force` showing it is removed.
- **Negotiable:** no.

### C-9: Preserve single-flight / JOIN / signal invariants

- **Statement:** hook execution preserves the existing single-flight, JOIN, and
  signal-propagation invariants; the hook fires only *after* the caller owns the
  right to spawn a session.
- **Source:** ticket "Risks & Dependencies"; INV-DM-2/3.
- **Verification:** test + code review (hook invocation point is after the
  JOIN/OWN decision, on the OWN/spawn path only).
- **Negotiable:** no.

### C-10: Safe, atomic parent-environment updates before spawn

- **Statement:** a successful hook may request set/unset operations that are
  fully validated as strict data before the parent mutates its environment. No
  hook or hook-produced file is sourced or evaluated. If hook execution fails,
  the output is missing/unsafe/malformed/oversized, a name is duplicated, or any
  requested name is unauthorized, the parent applies **none** of that
  invocation's operations, prevents the spawn, and handles it as the existing
  single hook-failure category. Valid operations are applied immediately before
  the imminent OpenCode spawn and inherited by later iterations of that same
  wrapper process. GH-146 guarantees only safe environment mutation and
  inheritance; it does not guarantee or enforce provider/model selection or any
  other downstream interpretation.
- **Source:** GH-146 owner scope decisions; `.ai/rules/bash.md` §§1, 6.
- **Verification:** parser unit tests + wrapper integration tests covering
  literal shell metacharacters, empty set vs unset, duplicate/unauthorized/
  malformed output, exact-limit acceptance and limit+1 rejection, CR/NUL and
  missing-final-LF rejection under `LC_ALL=C`, all-or-nothing behavior,
  delegated exact-name authority, imminent-child inheritance, and next-iteration
  persistence.
- **Negotiable:** no.

## Decision Drivers

**Business drivers:**

- **Quota/cost avoidance** — let users steer expensive sessions away from peak
  windows without provider-specific code in the generic loops.
- **Adopter trust** — an opt-in safety feature that silently no-ops when
  misconfigured destroys trust and wastes money.

**Technical drivers:**

- **Minimal contract expansion (primary, per rework)** — preserve the existing
  classifier and emitted-summary domains and *all* consumer behavior (CEO prompt,
  batch); add no hook-specific values. New surface is additive only.
- **Correctness of the restart budget** — hook failures must not masquerade as
  stuck-kills (a scheduling hook would otherwise exhaust `MAX_RESTARTS` and fail
  the ticket).
- **Bounded portable cleanup** — clean the hook process group on normal exit and
  direct SIGTERM/SIGINT/SIGHUP; make no promise for untrappable/out-of-group cases.
- **Contract consistency across the two loop scripts.**
- **Testability without weakening production** — pure functions for UTC
  arithmetic; mockable wrappers for `date`/`sleep`.
- **No parent-shell code injection** — environment updates must not require
  `source`, `eval`, command substitution of shell syntax, or hook control over
  wrapper traps/options/functions.
- **Transactional application** — one bad record must not leave a partially
  mutated parent environment.
- **Expressive-enough values** — preserve spaces, `=`, quotes, backslashes,
  dollar signs, and shell metacharacters literally; distinguish empty from unset.

**Operational drivers:**

- **Operability** — misconfiguration of an *intended* hook must fail loudly, not
  silently; ceo-loop must not busy-spin on a persistent failure.
- **Low cognitive load** — minimal new knobs; reuse existing patterns.
- **Determinism** — the 11-phase workflow and the AI-vs-script split are
  preserved; scheduling-wait stays script-side, judgement stays AI-side.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (ran the kernel, authored + revised the record).
- **Decider / Approver:** Juliusz Ćwiąkalski (repo owner), explicitly decided
  2026-07-16; the R2 record is `Accepted`.
- **Contributors:** `@pm` (clarify-scope context); `@decision-critic` (REWORK
  findings that drove this revision).
- **Required reviewers:** repo owner (verifies the six details against the
  approved core contract + the rework direction).
- **Performers:** `@coder` (implements the two scripts + install inventory + the
  example + tests per this record).
- **Informed:** external adopters (via the `delivery-modes.md` guide update,
  AC #11).

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| Bash does not kill foreground children when the parent exits (reparented to init) | FACT | POSIX `waitpid`/process-group semantics | A synchronous foreground hook would orphan on wrapper SIGTERM — C-4 violated | High |
| `sleep` is terminated by default by SIGTERM (interruptible) | FACT | coreutils / POSIX signals | A group SIGTERM promptly ends a sleeping hook without SIGKILL | High |
| `batch-deliver.sh` classifies on `deliver-ticket.sh` exit code, not the `result=` enum | FACT | `scripts/batch-deliver.sh` `run_batch` (exit_code != 0 → failed) | A hook failure returning exit 1 needs zero batch changes (C-5) | High |
| `ceo.md` workflow step 1 already has a `failed` branch (retry-or-park) | FACT | `.opencode/agent/ceo.md` | A hook failure surfacing as `result=failed`+exit 1 needs no CEO prompt change (C-5) | High |
| `MAX_RESTARTS` / `iteration` budgets consume on stuck-CEO/PM kills only; `classify_result` `"unknown"` already preserves the budget | FACT | `scripts/ceo-loop.sh`, `scripts/deliver-ticket.sh` `decide_after_iteration` | Hook failure must follow the same budget-preservation pattern (D-4) | High |
| `install.sh` installs explicit inventory arrays (`ADOS_DELIVERY_SCRIPTS`/`TOOLS`) to `./scripts/`+`./tools/`, content-synced + chmod +x; the doc-distribution guard scans only `doc/` | FACT | `scripts/install.sh` `install_local_files`; `scripts/.tests/test-doc-distribution.sh` `enumerate_dm2` | A new `ADOS_HOOK_EXAMPLES` array installs the example to `./scripts/hooks/`; no marker needed (C-8) | High |
| `uninstall.sh --local` removes delivery scripts/tools via a **hardcoded list** in `remove_local_files` (independent copy of install's arrays, not marker-driven — "so drift is observable"), plus a fixed empty-dir cleanup loop; both omit `scripts/hooks/pre-opencode-iteration-zai.sh` and `scripts/hooks/` | FACT | `scripts/uninstall.sh` `remove_local_files` (delivery `for` loop + empty-dir loop); `scripts/.tests/test-uninstall.sh` | The new example file AND `scripts/hooks/` dir would be **orphaned on uninstall** unless both loops are extended (C-8/D-1) — GAP-U1 | High |
| Individual decision records do not carry an `ados_distribution` marker | FACT | `doc/decisions/ADR-0001`, `TDR-0001`, `PDR-0002` | This record needs no marker | High |
| The Z.AI peak windows / 90-min lead are stable enough for a static UTC rule | ASSUMPTION | ticket | If they shift, users edit the example (user-owned) — low blast radius | Medium |
| A subprocess cannot modify its parent's environment | FACT | POSIX process environment semantics; Bash execution model | The parent must explicitly import validated data before spawning OpenCode | High |
| Sourcing hook-controlled content executes shell syntax in the parent | FACT | Bash `source` semantics; `.ai/rules/bash.md` §§1, 6 | Sourced-hook and sourced-env-file alternatives violate C-10 | High |
| OpenCode children inherit exported parent variables | FACT | process inheritance | GH-146 can guarantee inheritance, but not downstream interpretation | High |
| The owner's optional OpenCode setup uses `{env:OC_ADOS_AGENT_*_MODEL}` bindings | FACT | owner decision / setup | This motivates the built-in namespace but is neither a prerequisite nor a guaranteed selection mechanism | High |

## Mental Models & Techniques Used

- **Inversion** — worst outcome of silent-skip on a broken *intended* hook is
  quiet quota waste; worst outcome of loud-fail is a paused, recoverable
  delivery. Prefer loud.
- **First Principles** — "a file exists at the hook path" signals opt-in intent.
  Missing = not opted in; present = opted in (so breakage is loud).
- **Second-Order Thinking** — if a hook failure consumed a stuck-restart slot, a
  scheduling hook active across the peak window would exhaust `MAX_RESTARTS` and
  *fail the ticket* — the safety feature causing the failure.
- **Systems Thinking** — cleanup covers the tracked hook process group while
  explicitly stopping at untrappable and out-of-group boundaries.
- **KISS / minimal surface** — one failure category; no new result enums; reuse
  `setsid` + tracked-PID + SIGTERM→grace→SIGKILL.
- **Least privilege / capability design** — grant the hook a narrow data channel
  and example-oriented model-variable namespace, with explicit opt-in for additional names,
  rather than parent-shell execution authority.
- **Transactional thinking** — parse and validate the complete change set into
  staging state, then commit it to the environment in one apply phase.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

Legend: ✅ passes · ❌ fails.

|          | C-1 per-spawn | C-2 missing=continue | C-3 no timeout | C-4 trappable cleanup | C-5 single failure category | C-6 Z.AI window | C-7 no-real-sleep tests | C-8 install+uninstall | C-9 preserve invariants |
|----------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Alt 0 — Naïve / least-thought defaults | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Alt 1 — Recommended package | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Alt 2 — Two non-zero categories (`vetoed`/`hook-error` + veto budget) | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |

### Alternative 0 — Do-Nothing / Naïve defaults

- **Eligibility:** Not eligible (fails C-4, C-8, C-9 — all `Negotiable: no`).
- **Summary:** implement the approved core contract with the simplest default for
  each detail: hook invoked as a plain synchronous foreground command (no
  process-group kill trap); example dropped into the repo unregistered; a hook
  failure = unbounded tight-loop retry or a generic exit `1`; time-seam via a
  single global `ADOS_NOW_OVERRIDE` of `date`.
- **Constraint compliance:** C-4 fails (foreground hook is not explicitly cleaned
  on direct trappable wrapper termination). C-8 fails (an unregistered example is unreachable to
  `install.sh --local` adopters and not removed by `uninstall.sh --local` → AC #12
  gap). C-9 fails (the lifecycle invariant is not preserved).
- **Why rejected:** disqualifying safety (C-4) and distribution (C-8) failures.

### Alternative 1 — Recommended package (the six decisions)

- **Eligibility:** Eligible (passes every constraint).
- **Summary:** see **Decision** below — installed `scripts/hooks/` example in a
  new `ADOS_HOOK_EXAMPLES` inventory **with matching `uninstall.sh` removal +
  test coverage**; single hook-failure category; `setsid` + tracked-PID +
  group-kill trap with a short shutdown grace; ceo-loop bounded non-busy retry
  (no stuck budget); deliver-ticket runs the hook **inside each PM retry
  iteration immediately before that iteration's `run_single_iteration`** and
  uses the existing `failed` path on failure; pure UTC/test seams.
- **Constraint compliance:** all ✅.
- **Driver fit:** best on minimal-expansion (no new enums, no consumer changes),
  bounded lifecycle cleanup, correctness (budget purity), operability (loud-fail,
  bounded retry), install/uninstall symmetry, and testability (pure functions).
- **Why chosen:** satisfies all constraints; best driver fit; the smallest
  contract surface that closes the lifecycle-cleanup and distribution gaps.

### Alternative 2 — Two non-zero categories (`vetoed` / `hook-error` + dedicated veto budget)

- **Eligibility:** Not eligible (fails C-5 — introduces multiple non-zero
  categories, which the approved contract forecloses).
- **Summary:** (the withdrawn earlier draft) distinguish a transient "veto"
  (`result=vetoed`, exit 0) from a permanent "hook-error" (`result=hook-error`,
  exit 1), and add a dedicated `ADOS_HOOK_MAX_VETOES` budget consumed by vetoes.
- **Constraint compliance:** C-5 fails (two non-zero categories instead of one;
  scheduling deferral expressed via classification rather than sleep→exit 0). All
  other constraints pass.
- **Why rejected:** disqualifying on C-5, and on the minimal-expansion driver
  even setting C-5 aside — two new enums change CEO/batch consumer behavior and
  require prompt + guide edits beyond the approved contract, for no capability
  the sleep→exit-0 mechanism does not already provide.

### Focused evaluation: environment-return channel

The following sub-alternatives refine Alt 1 for C-10. They do not alter D-3 or
the owner's trappable-signal decision.

| Channel | C-10 no parent code execution | Literal values + unset | Atomic validation/apply | Lifecycle/log isolation | Result |
|---------|:---:|:---:|:---:|:---:|--------|
| Source hook in parent shell | ❌ | ✅ | ❌ | ❌ | Not eligible |
| Run hook, then source its output env file | ❌ | ✅ | ❌ | ✅ | Not eligible |
| Strict data-only output file, parsed without `source`/`eval` | ✅ | ✅ | ✅ | ✅ | **Eligible; chosen** |
| Parse hook stdout as a protocol | ✅ | ✅ | ✅ | ❌ | Eligible but rejected |

- **Source hook in parent shell:** simplest mutation mechanism, but it defeats
  subprocess/process-group isolation, lets hook code replace traps/options/
  functions or exit the wrapper, and cannot provide apply-nothing-on-failure.
- **Source an output env file:** keeps hook execution isolated but merely moves
  arbitrary code execution to a second file. Shell quoting is expressive, but
  syntax validation without executing it is effectively writing a shell parser;
  executing it violates C-10.
- **Strict data-only output file:** gives the hook a parent-created capability
  path; the parent validates the complete bounded file into staging arrays, then
  exports/unsets only authorized names. It cleanly separates logs from data and
  preserves the tracked hook PID/process group.
- **Stdout protocol:** can be safe, but stdout is useful for hook diagnostics and
  can contaminate `deliver-ticket.sh`'s machine-readable delivery summary.
  Capturing it also encourages command-substitution/subshell patterns that have
  hidden child PID state from parent traps. A dedicated file is simpler to test
  and operate.

## Decision

The six details are resolved as follows. Each is cross-referenced to the
constraints it must preserve.

### D-1: Example location & distribution → `scripts/hooks/pre-opencode-iteration-zai.sh`, installed via a new `ADOS_HOOK_EXAMPLES` inventory

- Ship the inactive Z.AI example at
  `scripts/hooks/pre-opencode-iteration-zai.sh` and register it in a **new
  `ADOS_HOOK_EXAMPLES`** array in `scripts/install.sh`, mirrored by a new
  "Hook examples" install block (copy content-synced + `chmod +x` to
  `./scripts/hooks/` in the target project — same pattern as the existing
  `ADOS_DELIVERY_SCRIPTS`/`ADOS_DELIVERY_TOOLS` blocks; `copy_updatable_file`
  already creates the nested `scripts/hooks/` dir).
- It is **available to `install.sh --local` adopters** (C-8) yet remains
  **inactive until copied/configured**: the loop scripts resolve only
  `${ADOS_PRE_ITERATION_HOOK:-$HOME/.ados/hooks/pre-opencode-iteration}`, never
  `scripts/hooks/`. The user activates it by copying/symlinking to
  `~/.ados/hooks/pre-opencode-iteration` or setting
  `ADOS_PRE_ITERATION_HOOK=$PWD/scripts/hooks/pre-opencode-iteration-zai.sh`
  (documented in the guide, AC #11). A bare `install.sh --local` does **not**
  activate it.
- It carries **no** `ados_distribution` marker: the doc-distribution guard scans
  only `doc/`; `scripts/` is out of scope. AC #12 is satisfied by registration in
  the install inventory + passing the Bash/install gates.
- **Matching uninstall (GAP-U1 correction):** `scripts/uninstall.sh` already
  exists and `remove_local_files` removes delivery scripts/tools via a
  **hardcoded independent list** (it deliberately does not read install's arrays,
  so drift is test-observable). That list and the empty-dir cleanup loop currently
  omit the new artifact, so this change **must extend both**: add
  `"scripts/hooks/pre-opencode-iteration-zai.sh"` to the delivery-script removal
  `for`-loop, and add `"scripts/hooks"` to the empty-directory cleanup loop. This
  mirrors the existing M-4 pattern (unconditional removal of unconditionally-
  installed files); the new `test-uninstall.sh` assertion is the drift guard. (The
  earlier draft's claim that "no uninstall mechanism exists" was wrong and is
  withdrawn.)
- *(License header handling is an implementation detail for `@coder`/the
  header-script config; AI must not add headers manually per AGENTS.md.)*
- **Satisfies:** C-8, C-9; adoptability driver.

### D-2: Executable / missing / unreadable behavior → existence is the opt-in boundary

- **Missing** (`! -e`): after the required existence check, create no hook
  subprocess/temp artifact, perform no intentional wait/sleep, emit no hook log,
  and continue the normal spawn path (C-2).
- **Present but not executable** (`-e && ! -x`): **hook failure** — prevent the
  spawn and emit a clear diagnostic naming the path ("hook exists but is not
  executable: …").
- **Present, executable, but fails to exec** (noexec mount, bad shebang,
  ENOEXEC, permission denied at exec time): **hook failure** — same diagnostic
  treatment.
- **Runs and exits `0`:** spawn proceeds.
- **Runs and exits non-zero:** **hook failure** (single category, C-5) — see D-4.
- **Rationale (Inversion):** once a user places a file at the hook path, they
  have opted in and *expect* it to run; a silent skip on a misconfigured intended
  hook would quietly void quota protection. Loud-fail is recoverable; silent-skip
  is costly.
- **Satisfies:** C-2, C-5; operability driver.

### D-3: Process/signal lifecycle → bounded process-group cleanup, no timeout

- Run the hook with the scripts' existing process-group launch pattern, capture
  `CURRENT_HOOK_PID=$!`, and `wait` for its exit code. Do not add a guardian,
  daemon, or external supervisor.
- Extend `_cleanup_child` (EXIT trap) and direct HUP/INT/TERM trap paths to kill
  the hook's **process group** (`kill -TERM -- -${pgid}`), then after a
  short grace **`ADOS_HOOK_SHUTDOWN_GRACE_SECONDS`** (default **2s**, overridable
  for tests) escalate to `kill -KILL -- -${pgid}`. Kill whichever of
  `CURRENT_HOOK_PID` / `CURRENT_CEO_PID` / `CURRENT_OPENCODE_PID` is set.
- **No execution timeout** is ever imposed on the hook (C-3): cleanup fires only
  on normal/trappable wrapper shutdown, never because the hook ran "too long." The
  short shutdown grace is part of wrapper teardown, not a hook deadline — `sleep`
  is SIGTERM-interruptible, so termination is prompt.
- The guarantee is deliberately bounded: normal exit and direct
  SIGTERM/SIGINT/SIGHUP only. Wrapper-only SIGKILL, host failure, and descendants
  that leave the hook process group are excluded. No guardian or external
  supervisor is added; product intent is simply to wait until peak hours end,
  then continue.
- **Satisfies:** C-3, C-4, C-9; bounded-cleanup + portability drivers.

### D-4: Hook-failure behavior → single category; budgets stay pure; split by component role

Hook failures (non-zero / not-executable / exec-fail) **never** consume
`restarts` / `iteration` / `MAX_RESTARTS` — those budgets are for stuck-CEO/PM
kills only (INV-DM-3/5). The Z.AI *scheduling wait* is performed by the hook
itself (it sleeps, then exits `0`); a hook **failure** is the hook saying "no" or
being broken, and is handled as follows with **no new result classifications**
(C-5):

- **`deliver-ticket.sh` (per-ticket, foreground):** run the hook **inside every
  PM retry-loop iteration**, on the OWN path, immediately before that
  iteration's `run_single_iteration` call. Invoke it before consuming/incrementing
  the stuck-session restart budget for that iteration.
  On hook failure: set `DELIVERY_RESULT="failed"`, `DELIVERY_EXIT_CODE="${EXIT_FAILURE}"`
  (1), surface the hook diagnostic in the summary/`last_message` and to stderr,
  and **return 1**. That iteration's PM **never spawns**, so **no stuck
  budget consumed**. This is the **existing `failed` path** — `batch-deliver.sh`
  sees exit 1 → marks the ticket `failed` and continues (no batch change); the
  CEO sees `result=failed` → its existing *retry-or-park* branch handles it (no
  prompt change).
- **`ceo-loop.sh` (always-on supervisor):** on hook failure, **prevent that CEO
  spawn**, log clearly, and follow a **bounded, non-busy retry** that does **not**
  touch the stuck-session `restarts` budget:
  - treat **`ADOS_HOOK_RETRY_SECONDS`** (default **60s**) as the **total interval
    between hook attempts**, not a per-poll sleep;
  - wait non-busily in chunks no longer than **1 second**, polling `STOP_FILE`
    before and after each chunk. A newly created stop file is observed within
    **≤1 second**, terminates the remaining wait, and prevents any next hook or
    OpenCode spawn. No additional polling setting is introduced;
  - count consecutive failures against **`ADOS_HOOK_MAX_FAILURES`** (default **5**)
    — a *separate* counter from `restarts`; **reset to 0 on any hook success or
    once a CEO session has run**;
  - on reaching the cap, log "hook failed N consecutive times; exiting" and exit
    with `EXIT_FAILURE` (1) + distinct log line (reuses the existing non-zero
    exit; no new exit-code contract). The operator then fixes the hook and
    restarts the loop.
- **Rationale (Second-Order):** had a hook failure consumed a stuck-restart slot,
  a scheduling hook active across the Z.AI window would exhaust `MAX_RESTARTS`
  and *fail the ticket*. The bounded cap prevents a permanently broken hook from
  spinning forever while keeping the stuck budget pure.
- **Satisfies:** C-5, C-9; minimal-expansion + correctness + AI-vs-script drivers.

### D-5: Testability seams → pure UTC functions + mockable wrappers (no production weakening)

Two seams; neither changes production behavior:

- **In the loop scripts:** the hook path (`ADOS_PRE_ITERATION_HOOK`) **is** the
  injection point — tests install a temp hook (exit 0 / non-zero / unexecutable)
  and assert call-counts and exit handling across spawn/resume/retry vs
  JOIN/probe/dry-run. The three new sleeps/knobs are env-overridable:
  `ADOS_HOOK_RETRY_SECONDS`, `ADOS_HOOK_MAX_FAILURES`, and
  `ADOS_HOOK_SHUTDOWN_GRACE_SECONDS`. Cleanup tests cover normal exit and direct
  SIGTERM/SIGINT/SIGHUP for processes remaining in the hook group; no test claims
  cleanup after wrapper-only SIGKILL, host failure, or process-group escape.
  "Bounded retry" tests treat `ADOS_HOOK_RETRY_SECONDS` as total elapsed wait,
  observe sleep chunks no longer than 1 second, create `STOP_FILE` during a
  multi-chunk wait, and assert observation within ≤1 second with no next hook or
  OpenCode spawn. Cap tests also assert `restarts` remains unchanged.
- **In the Z.AI example:** factor UTC arithmetic into **pure functions** taking
  `now_utc_epoch` as an argument (`zai_configured_model`, `is_zai_peak_window`,
  `seconds_until_window_end`), unit-tested directly with injected epochs at
  04:29:59 / 04:30:00 / 09:59:59 / 10:00:00 (+ configured-value cases). Wrap the
  impure `date -u` / `sleep` in `_now_utc_epoch()` / `_sleep()` mockable wrappers
  (`.ai/rules/bash.md` §10.2/§10.3). Production behavior is identical — only the
  wrappers differ between prod and test.
- **Satisfies:** C-7 (AC #10); testability driver.

### D-6: Environment return → strict `ADOS_HOOK_ENV_V1` data file, validated then applied

The **primary product use case remains a sleep-only scheduling hook**: it may
leave the output file empty, sleep until peak hours end, exit `0`, and continue.
The return channel is optional. When used, GH-146 guarantees only safe atomic
environment updates inherited by the imminent OpenCode process and later
iterations/children of the same wrapper. Variable meaning is user-defined.
ADOS does not guarantee or enforce provider/model selection.

#### Invocation context and file lifecycle

- Before each present-hook invocation, the parent creates a fresh private temp
  directory with `mktemp -d` (mode `0700`) and an empty regular output file
  (mode `0600`). It passes the absolute file path as
  **`ADOS_HOOK_ENV_OUTPUT`**, plus **`ADOS_HOOK_ENV_FORMAT=ADOS_HOOK_ENV_V1`**,
  alongside the existing `ADOS_HOOK_AGENT=ceo|pm` and
  `ADOS_HOOK_SCRIPT=ceo-loop|deliver-ticket` context. The hook inherits the
  wrapper's current exported environment, including changes committed by prior
  successful invocations in that wrapper.
- The path is a write-only capability by convention: the hook writes requested
  changes there; stdout/stderr are diagnostics, never protocol data. The wrapper
  keeps hook stdout out of `deliver-ticket.sh`'s delivery-summary stdout and
  never logs returned values.
- The parent waits for the tracked hook process group exactly as in D-3. Output
  is read only after exit `0`. The temp directory is removed after parse/apply or
  on every failure, EXIT, and supported signal path. Every retry receives a new
  file, so stale records cannot be replayed.

#### Exact file format

An untouched zero-byte file means **no environment changes**. A non-empty file
is LF-delimited and MUST be LF-terminated with this exact grammar:

```text
ADOS_HOOK_ENV_V1
set NAME=VALUE
unset NAME
```

- The first line is the literal header `ADOS_HOOK_ENV_V1`.
- A header-only file is valid and also requests no changes.
- Each subsequent line is exactly one record:
  - `set ` followed by `NAME`, the first `=`, then `VALUE`; `VALUE` may be empty.
  - `unset ` followed by `NAME`, with no `=` or trailing payload.
- `NAME` must match `[A-Z_][A-Z0-9_]*` and the authorization rule below. A name
  may occur only once in the file, regardless of operation; duplicates are
  invalid rather than order-dependent.
- `VALUE` is literal data after the first `=`. Spaces, additional `=`, quotes,
  backslashes, `$`, backticks, semicolons, glob characters, and `$()` have **no
  shell meaning** and are preserved. **CR (`0x0D`) and NUL (`0x00`) are invalid
  bytes anywhere in a non-empty protocol file**; LF is only the record delimiter.
  multiline/binary values are intentionally unsupported. The parser uses
  `read -r`/string operations and never `source`, `eval`, or shell expansion of
  the value.
- Blank lines, comments, unknown verbs, malformed records, a missing final LF,
  and extra header text are invalid.
- Bounds are measured as raw bytes under **`LC_ALL=C`** and are inclusive:
  - whole file: at most **65,536 raw bytes**, including the header and every LF;
  - operations: at most **256 operation records** (the header is not counted);
  - logical line: at most **8,192 raw bytes**, excluding its terminating LF.
  Every non-empty file, including header-only, MUST end in LF. The exact limit is
  accepted; limit + 1 is rejected. CR and NUL rejection occurs before Bash string
  parsing so neither can be silently normalized or discarded.

Examples (the apparent shell syntax inside values remains literal data):

```text
ADOS_HOOK_ENV_V1
set OC_ADOS_AGENT_CEO_MODEL=github-copilot/claude-opus-4.6
set OC_ADOS_AGENT_PM_MODEL=openai/gpt-5.3-codex
set OC_ADOS_AGENT_CODER_MODEL=value with spaces = and $(not-executed)
unset OC_ADOS_AGENT_EXTERNAL_RESEARCHER_MODEL
```

An explicit empty value is distinct from removal:

```text
ADOS_HOOK_ENV_V1
set OC_ADOS_AGENT_PM_MODEL=
unset OC_ADOS_AGENT_CEO_MODEL
```

#### Authorized names

- Built in: only names matching
  **`^OC_ADOS_AGENT_[A-Z0-9_]+_MODEL$`**. This includes
  `OC_ADOS_AGENT_CEO_MODEL`, `OC_ADOS_AGENT_PM_MODEL`, and analogous variables
  for other ADOS agents. This namespace is retained because it serves the Z.AI
  example and the owner's optional `{env:OC_ADOS_AGENT_*_MODEL}` OpenCode setup;
  that binding is not required by the hook contract. The namespace deliberately
  does **not** authorize
  all `OC_ADOS_*` variables, wrapper control variables, credentials,
  `OPENCODE_CONFIG_CONTENT`, shell internals, or the allowlist variable itself.
- Additive escape hatch: the operator may set
  **`ADOS_HOOK_ENV_ALLOWLIST`** before starting the wrapper to a comma-separated
  list of additional exact shell variable names. The wrapper validates this
  configuration once; empty items, duplicates, or invalid identifiers are a
  startup configuration error. This is explicit delegation, not a wildcard or
  hook-controlled expansion. An operator **may explicitly delegate an additional
  exact variable through this allowlist, including a credential variable, at
  their own risk**. GH-146 supplies, discovers, and queries no credentials; the
  operator/hook supplies any delegated value.

#### Validation, atomic apply, inheritance, and failures

1. After hook exit `0`, require the output path still to be a regular,
   non-symlink file owned by the wrapper user and not group/world writable;
   under `LC_ALL=C`, reject CR/NUL and enforce the exact inclusive raw-byte,
   operation-record, line, and final-LF bounds above.
2. Parse every record into staging set/unset collections. Validate format,
   uniqueness, names, authorization, and that no target is readonly in the
   wrapper for the **entire** file without changing the parent environment.
3. Only after all validation passes, apply every staged operation in the parent:
   exported assignment semantics for `set`, and `unset` for `unset`. Use
   name-safe Bash built-ins/indirection; never construct executable assignment
   text. Log only the operation and variable name plus aggregate count, never
   values.
4. Apply immediately before constructing/executing that iteration's OpenCode
   command. The imminent OpenCode process inherits the result. The mutated
   environment remains authoritative for later hook calls and OpenCode spawns in
   the **same wrapper process**. A `deliver-ticket.sh` child cannot mutate its
   already-running `ceo-loop.sh` parent. What OpenCode/configuration does with
   those variables is outside this contract. In particular, GH-146 requires no
   `{env:...}` binding, verifies no actually selected model/provider, and defines
   no wrapper `-m` behavior. Existing `CEO_LOOP_MODEL` behavior is out of scope
   and unchanged.
5. Hook non-zero, unsafe/missing output, or any validation error applies
   **nothing from that invocation**, prevents OpenCode spawn, and enters D-4's
   existing single hook-failure path/budget. Previously committed environment
   from earlier successful invocations remains in force. On ceo-loop retry a
   fresh output file is passed and the hook runs again; deliver-ticket returns
   the existing `failed`/exit-1 result. Snapshot each target's prior set/unset
   state before apply and defensively restore the snapshot if an unexpected
   built-in apply error occurs, then classify that invocation as a hook failure.

- **Security boundary:** this prevents arbitrary **parent-shell** execution via
  the return channel; it is not a sandbox for the executable hook, which already
  runs with the user's account, inherited environment, and process privileges.
- **Credential consequence:** the built-in namespace grants no credential
  authority. If an operator allowlists an exact credential variable, its literal
  value may be present in the private output file until cleanup, imported into
  the wrapper's exported environment, and inherited by the imminent and later
  same-wrapper children. Values are never logged, but this delegation expands
  exposure and is explicitly the operator's risk; ADOS does not obtain or supply
  the credential.
- **Satisfies:** C-1, C-5, C-9, C-10; safety, atomicity, inheritance,
  operability, and testability drivers.

- **Decider:** Juliusz Ćwiąkalski (repo owner); explicitly authorized on
  2026-07-16. Record status is `Accepted`.
- **Conditions for revisit:** see `revisit_triggers`.

### Constraint Compliance Attestation

The chosen alternative (**Alt 1**, refined by the strict data-only output-file
channel) satisfies **all** constraints C-1 … C-10:

- C-1 (per-spawn/retry, skip excluded paths): the hook fires only on the
  OWN/spawn path, after the JOIN/OWN decision, **inside every PM retry iteration
  immediately before that iteration's `run_single_iteration`** (D-4).
- C-2 (missing = existence check then normal spawn): D-2; no subprocess,
  temporary output artifact, intentional wait/sleep, hook log, or timing claim.
- C-3 (no execution timeout): D-3 explicitly imposes none.
- C-4 (trappable cleanup): D-3 cleans the hook process group on normal exit and
  direct SIGTERM/SIGINT/SIGHUP, with explicit SIGKILL/host-failure/group-escape
  exclusions and no guardian/supervisor.
- C-5 (single failure category): D-2 + D-4 — no `vetoed`/`hook-error` enums;
  scheduling deferral is sleep→exit-0; failure is one category surfacing as the
  existing `failed` path.
- C-6 (Z.AI window): D-5 pure functions implement 04:30–10:00 UTC + model prefix.
- C-7 (tests without real sleeps): D-5.
- C-8 (install + uninstall symmetry): D-1 — `ADOS_HOOK_EXAMPLES` installs the
  executable to `./scripts/hooks/`; `uninstall.sh --local` removes the file and
  cleans the empty `./scripts/hooks/` directory; install and uninstall tests
  cover both directions. The doc-distribution guard remains doc-scoped.
- C-9 (preserve invariants): D-3 applies bounded trappable-signal cleanup; D-4
  fires the hook only after the caller owns the spawn right.
- C-10 (safe atomic environment update): D-6 never sources/evaluates hook
  output, validates the entire exactly bounded change set before mutation,
  restricts built-in names to the non-credential model namespace while allowing
  explicit operator delegation of an additional exact name, and applies it
  before spawn with all-or-nothing failure behavior. The guarantee ends at
  same-wrapper environment inheritance; downstream interpretation is user-defined.

No accepted-risk exceptions are required (no `Negotiable: yes` constraint is
violated).

## Trade-offs & Consequences

### Positive Outcomes

- **No result-domain or consumer change** — `classify_result` remains
  `merged | blocked | pr-open | failed | unknown`; emitted summaries may also
  contain pre-existing path-specific values such as `finished` and
  `max-restarts`. No hook-specific value is added; CEO and batch behavior stays
  unchanged.
- A single, consistent hook contract across both loop scripts.
- The primary sleep-only use case remains simple: wait until peak hours end,
  exit `0`, then continue, with no returned environment data required.
- Hook-group cleanup is explicit and portable for normal exit and direct
  SIGTERM/SIGINT/SIGHUP, without a guardian or external supervisor.
- Restart budgets stay semantically pure (stuck-kills only); a scheduling hook
  cannot cause spurious ticket failures.
- Misconfigured intended hooks fail loudly (recoverable), not silently (costly);
  ceo-loop cannot busy-spin on a persistent failure (bounded cap).
- The example reaches `install.sh --local` adopters (no manual repo checkout)
  and is **cleanly removed by `uninstall.sh --local`** (file + empty dir) — no
  orphaned artifact on uninstall.
- Tests are fast and deterministic (pure functions + mocked wrappers).
- Hooks can safely update authorized environment variables inherited by the
  imminent OpenCode process and later same-wrapper iterations; users define what
  those variables mean.
- Empty values, unsets, and shell metacharacters have deterministic semantics;
  malformed or unauthorized batches cannot partially mutate the parent environment.

### Negative Outcomes

- Four new operator env knobs (`ADOS_HOOK_RETRY_SECONDS`,
  `ADOS_HOOK_MAX_FAILURES`, `ADOS_HOOK_SHUTDOWN_GRACE_SECONDS`,
  `ADOS_HOOK_ENV_ALLOWLIST`) and one new install inventory array
  (`ADOS_HOOK_EXAMPLES`) — small but non-zero surface growth, documented in
  `--help`/settings and the guide (AC #11). `ADOS_HOOK_ENV_OUTPUT` and
  `ADOS_HOOK_ENV_FORMAT` are per-invocation hook context, not operator knobs.
- A new `scripts/hooks/` directory (minor structural addition; the repo map in
  `AGENTS.md` should mention it when the example lands).
- A permanently broken hook in ceo-loop exits the loop after the cap — the
  operator must fix the hook and restart. By design (bounded), but it means
  ceo-loop is no longer a pure always-on supervisor in the presence of a broken
  hook.
- The short shutdown grace (2s) means a hook mid-sleep is SIGTERM'd on normal or
  direct trappable wrapper shutdown — by design (C-4); the hook does not persist its "wake time" across
  wrapper restarts. Accepted: the scheduler is the human/tmux session, not the
  hook.
- Wrapper-only SIGKILL, host failure, and descendants that leave the hook process
  group may survive; this is explicitly accepted. No guardian/supervisor is added.
- The line protocol intentionally cannot represent multiline or NUL-containing
  values. Current examples do not need them; future demand triggers a format-version
  revisit rather than ad hoc escaping.
- `ADOS_HOOK_ENV_ALLOWLIST` adds one operator-facing knob. This is preferable to
  broadly authorizing every `OC_ADOS_*` or credential variable. Explicitly
  allowlisting a credential variable expands its exposure to the wrapper and
  same-wrapper descendants; that risk belongs to the operator.

### Unresolved Questions

- [ ] Default tuning of `ADOS_HOOK_MAX_FAILURES` (5) and `ADOS_HOOK_RETRY_SECONDS`
  (60s) — reasonable starting points; confirm against real adopter usage.
  (Owner: repo owner; revisit per `revisit_triggers`.)
- [ ] Should the guide add a one-line "hooks" mention to `AGENTS.md`'s repo map
  pointing at `scripts/hooks/`? (Owner: `@doc-syncer` during AC #11.)

## Implementation Plan

High-level only (no code); `@coder` executes via the GH-146 plan:

1. **`scripts/install.sh` + `scripts/uninstall.sh` (install/uninstall symmetry,
   C-8):**
   - *install:* add the `ADOS_HOOK_EXAMPLES=("scripts/hooks/pre-opencode-iteration-zai.sh")`
     array and a "Hook examples" install block (mirror the delivery-scripts
     block: `copy_updatable_file` + `chmod +x`; `copy_updatable_file` creates
     `./scripts/hooks/`).
   - *uninstall (GAP-U1):* in `remove_local_files`, add
     `"scripts/hooks/pre-opencode-iteration-zai.sh"` to the hardcoded
     delivery-script removal `for`-loop, and add `"scripts/hooks"` to the
     empty-directory cleanup loop. (Uninstall deliberately keeps an independent
     copy of install's lists — extend the existing pattern, do not refactor
     uninstall to source install's arrays.)
2. **`scripts/ceo-loop.sh` + `scripts/deliver-ticket.sh`:** add the shared
   hook-resolution + invocation helper (existence → exec-bit → run → exit-code),
   the `CURRENT_HOOK_PID` tracker, bounded process-group cleanup on EXIT and
   direct HUP/INT/TERM, and
   the `ADOS_HOOK_RETRY_SECONDS` / `ADOS_HOOK_MAX_FAILURES` /
   `ADOS_HOOK_SHUTDOWN_GRACE_SECONDS` settings. Hook call site is on the
   OWN/spawn path only (after the JOIN/OWN decision), **inside every PM retry
   iteration immediately before that iteration's `run_single_iteration`** (C-1).
   `deliver-ticket.sh` fails on the existing `failed` path; `ceo-loop.sh` treats
   `ADOS_HOOK_RETRY_SECONDS` as the total wait, polls `STOP_FILE` before/after
   non-busy chunks ≤1 second, observes stop within ≤1 second, and performs no
   next hook/OpenCode spawn (D-4). Add D-6's
   parent-created `ADOS_HOOK_ENV_OUTPUT` capability, strict parser,
   authorization check, staging/apply step, and cleanup. Apply only after hook
   exit `0` and complete validation, immediately before OpenCode command
   construction/spawn. Keep parser/apply execution in the parent shell—not
   command substitution—so environment mutation and tracked hook PID state
   persist.
3. **Z.AI example** at `scripts/hooks/pre-opencode-iteration-zai.sh`: pure UTC
   functions + mockable wrappers per D-5; check the owner-convention
   `OC_ADOS_AGENT_*_MODEL` value selected by `ADOS_HOOK_AGENT`, without claiming
   it is the model OpenCode actually selected.
4. **Tests** under `scripts/.tests/` (+ the example's own `.tests/` if co-located):
   cover AC #10 cases via the seams in D-5; test cleanup for normal exit and
   direct SIGTERM/SIGINT/SIGHUP (without asserting excluded cases), plus the
   bounded-retry test. Add a grep test asserting **no** `vetoed`/`hook-error`
   enum was introduced (C-5). **In `test-uninstall.sh`, add a fixture + assertion
   that `remove_local_files` removes `scripts/hooks/pre-opencode-iteration-zai.sh`
   and cleans the empty `scripts/hooks/` dir (C-8 drift guard).** Add C-10/D-6
   parser and both-wrapper integration coverage: valid authorized set/unset,
   empty/literal metacharacter values, duplicate/unauthorized/malformed/
   oversized/unsafe output, exact-limit acceptance and limit+1 rejection for
   65,536-byte file / 256 records / 8,192-byte logical line, explicit CR/NUL and
   missing-final-LF rejection under `LC_ALL=C`, all-or-nothing mutation,
   imminent-child inheritance,
   same-wrapper next-iteration persistence, fresh-file retry, and zero
   `source`/`eval` over hook output.
5. **Docs (AC #11):** update `doc/spec/features/feature-autonomous-delivery.md`
   and `doc/guides/delivery-modes.md` with the hook contract, the opt-in install
   (copy to `~/.ados/hooks/…` or set `ADOS_PRE_ITERATION_HOOK`), model-profile
   integration as an **optional `{env:OC_ADOS_AGENT_*_MODEL}` example**, not a
   prerequisite or selection guarantee, and link the installed example.
   **Explicitly state** that
   hook failures surface as the existing `failed` result/exit-1 (no new enums),
   document `ADOS_HOOK_ENV_V1`, its example-oriented built-in model namespace and
   exact allowlist, provide user-defined environment set/unset examples, keep
   `CEO_LOOP_MODEL` and wrapper `-m` semantics out of scope, and reconcile
   NFR-4/INV-DM-2 wording to the hook-specific C-4 scope: normal
   exit + direct SIGTERM/SIGINT/SIGHUP only, with the stated exclusions.
6. **Rollout/guardrails:** the feature is inactive when the resolved hook path is
   absent (C-2). CI gates: Bash tests, `test-doc-distribution.sh`,
   and the script test aggregator must pass (AC #12).

## Verification Criteria

- **Metric:** absent-hook behavior — the required path existence check occurs;
  no hook subprocess or temporary output artifact is created; no intentional
  wait/sleep or hook-related log output occurs; the normal spawn path continues.
  **Target:** all behavioral assertions pass. **Window:** CI.
- **Metric:** bounded cleanup — after normal exit or direct SIGTERM/SIGINT/SIGHUP
  of a wrapper with a sleeping hook, no process remaining in the tracked hook
  group survives. **Target:** pass for all four covered paths; no assertion for
  wrapper-only SIGKILL, host failure, or group-escaping descendants. **Window:** CI.
- **Metric:** restart-budget purity — a hook that fails N (> `MAX_RESTARTS`)
  times consumes 0 stuck-restart slots; in `deliver-ticket` the ticket surfaces
  as the existing `failed` result/exit-1 without ever spawning the PM. **Target:**
  budget unchanged; no new enum. **Window:** GH-146 QA.
- **Metric:** bounded ceo-loop retry — `ADOS_HOOK_RETRY_SECONDS` is total elapsed
  wait; every non-busy polling chunk is ≤1 second; a `STOP_FILE` created during
  the wait is observed within ≤1 second and prevents any next hook/OpenCode spawn.
  With `ADOS_HOOK_MAX_FAILURES=2`, cap exit is non-zero and `restarts == 0`.
  **Target:** all assertions pass. **Window:** CI.
- **Metric:** UTC-boundary correctness — pure-function tests pass at 04:29:59 /
  04:30:00 / 09:59:59 / 10:00:00 UTC. **Target:** 100%. **Window:** CI.
- **Metric:** install reachability — a sandbox `install.sh --local` lands the
  example at `./scripts/hooks/pre-opencode-iteration-zai.sh` (executable), and it
  is **not** at the active hook path. **Target:** present + inactive.
  **Window:** CI (install gate).
- **Metric:** uninstall symmetry (GAP-U1) — after `install.sh --local` then
  `uninstall.sh --local --force`, neither
  `./scripts/hooks/pre-opencode-iteration-zai.sh` nor the empty `./scripts/hooks/`
  dir remains; the new `test-uninstall.sh` assertion passes. **Target:** file
  absent + dir absent. **Window:** CI (uninstall gate).
- **Metric:** environment-return safety — source/eval calls over hook output = 0;
  malformed, duplicate, unauthorized, oversized, unsafe-file, and hook-failure
  fixtures each apply 0 operations and spawn 0 OpenCode children. **Target:**
  100% parser/integration cases. **Window:** CI.
- **Metric:** environment-return functionality — valid authorized set/unset
  output is inherited unchanged by the imminent OpenCode stub and next iteration of the
  same wrapper; empty and literal-metacharacter values round-trip exactly.
  No assertion is made about provider/model selection or other downstream meaning.
  **Target:** 100% for both wrappers. **Window:** CI.
- **Metric:** result-domain preservation — classifier fixtures remain
  `merged | blocked | pr-open | failed | unknown`; emitted summaries retain
  existing path-specific values including `finished` and `max-restarts`; no
  hook-specific value appears and existing CEO/batch behavior is unchanged.
  **Target:** zero domain/consumer regressions. **Window:** CI.
- **Metric:** credential authority — without an allowlist, an exact credential
  variable is unauthorized; with that exact valid name in
  `ADOS_HOOK_ENV_ALLOWLIST`, the operator-delegated operation is accepted and its
  literal value is never logged. No ADOS path supplies, discovers, or queries a
  credential. **Target:** identical behavior in both wrappers. **Window:** CI.
- **Metric:** exact protocol bounds — under `LC_ALL=C`, both wrappers accept
  independent fixtures at exactly 65,536 raw file bytes, 256 operation records
  (header excluded), and an 8,192-byte logical line (terminating LF excluded),
  while rejecting each
  corresponding limit+1 case, missing final LF, any CR, and any NUL. **Target:**
  identical table-driven results in both wrapper suites. **Window:** CI.

## Confidence Rating

**Medium-High.** Grounded in the consumer contracts read directly from
`batch-deliver.sh` (exit-code-based classification) and `.opencode/agent/ceo.md`
(existing `failed` branch) — both confirm the no-new-enum, no-prompt-change
claim (C-5). The bounded-cleanup and install-inventory facts are read from source. The
only medium-confidence item is the Z.AI window stability (ASSUMPTION) — mitigated
by the example being user-owned/editable. AI-generated confidence is not
evidence; the rating reflects the cited sources.

## References

- GH-146 — *Add quota-aware pre-iteration hooks to autonomous delivery loops*
  (ticket + approved core contract).
- `doc/changes/2026-07/2026-07-15--GH-146--quota-aware-pre-iteration-hooks/chg-GH-146-pm-notes.yaml`
- `doc/spec/features/feature-autonomous-delivery.md` — NFR-4 (no orphans),
  INV-DM-2 (signal propagation), INV-DM-3/5 (stuck vs. healthy; restart budget).
- `doc/guides/delivery-modes.md` — the AI-vs-script split; the existing
  signal-propagation pattern to mirror.
- `.opencode/agent/ceo.md` — workflow step 1 `failed` branch (consumer contract;
  no prompt change needed).
- `scripts/batch-deliver.sh` — `run_batch` exit-code-based classification
  (consumer contract; no batch change needed).
- `scripts/ceo-loop.sh`, `scripts/deliver-ticket.sh` — `_cleanup_child`,
  kill-tree, `decide_after_iteration` budget-preservation precedent.
- `scripts/install.sh` — `ADOS_DELIVERY_SCRIPTS` / `ADOS_DELIVERY_TOOLS` install
  blocks (model for the new `ADOS_HOOK_EXAMPLES` block).
- `scripts/uninstall.sh` — `remove_local_files` hardcoded delivery-script removal
  + empty-dir cleanup loops (must be extended for the hook example — GAP-U1/C-8).
- `scripts/.tests/test-uninstall.sh` — local-uninstall coverage (add the
  hook-example removal + `scripts/hooks/` dir-cleanup assertion — C-8 drift guard).
- `scripts/.tests/test-doc-distribution.sh` — `enumerate_dm2` scan scope (doc-only;
  C-8).
- `.ai/rules/bash.md` §10 — dependency-injection + pure-function + mockable-wrapper
  testability patterns (D-5).
- `.ai/rules/bash.md` §§1, 6 — never source untrusted files; avoid `eval`; quote
  and validate data (D-6).
- `doc/guides/opencode-model-configuration.md` — optional downstream
  configuration context only; no binding from this guide is a GH-146 prerequisite.
- `ADR-0001` — decision-making framework (rigor, rights, AI authority).
