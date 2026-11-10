---
ados_distribution: internal
id: SPEC-HARNESS-ADAPTERS
status: Current
created: 2026-11-06
last_updated: 2026-11-10
owners: ["engineering"]
service: delivery-os
summary: "The delivered harness adapter seam: the HarnessInstance and HarnessSession primitive ports with closed harness-kind, operation, lifecycle-capability, and liveness-kind vocabularies and explicit capability gaps; the opencode delivery adapter (line-acquired streaming spawn and resume/steer over the JSONL stream with completion-scoped collection, read-only session listing, sourced liveness, heartbeat-age and token-delta sourced-signal declarations); the additive streaming spawn starter beside the one-shot runner, with the child-stdin early-close guard at both host seams; the Claude Code headless adapter (spawn and collect) with deliver, resume/steer, session listing, liveness kinds, and both sourced-signal kinds declared as gaps; the additive sourced-signal carriage beside the exact-three liveness kinds; the deny-by-default execution-environment descriptor with build-from-declaration spawn environments and use-time credential resolution; the variable-only optional marker on a declared environment variable; the typed harness configuration branch; one shared harness-neutral classifier with the outcome-to-delivery-result token projection; read-only bounded telemetry extraction from both stores into one harness-neutral statistics shape at one record per session group, with a bounded Claude byte read and store-scoped orphan/invalid-identity disclosure; the non-gating, idempotent closeout capture into additive harness.telemetry state records with bounded output, harness-store session attribution for the closeout compaction checkpoint, and the code-level GH-233 review-deferral record; the typed dispatch engine is the first production consumer of the session port."
links:
  related_changes: ["GH-233", "GH-234", "GH-235", "GH-236", "GH-240", "GH-238", "GH-239", "GH-275", "GH-241", "GH-277"]
  related_decisions: ["ADR-0008", "TDR-0005", "TDR-0016", "TDR-0021"]
  contracts:
    - "packages/core/src/contracts/harness.ts"
    - "packages/core/src/contracts/economics.ts"
    - "packages/core/src/contracts/harness-telemetry.ts"
    - "packages/core/src/contracts/error-table.ts"
    - "packages/core/src/config/catalog.ts"
    - "packages/adapters/src/harness/index.ts"
    - "packages/adapters/src/harness/review-deferrals.ts"
    - "packages/adapters/src/host/index.ts"
---

# Feature: Harness Adapters

> **Role of this Document:** Source of truth for the harness adapter seam (M1-S11). It describes the delivered port surface, both adapters, the spawn environment, liveness, telemetry extraction, and closeout capture. Requirements live in the GH-233 change artifacts.

## 1. Overview

The harness is configuration, not code. `HarnessInstance` identifies a configured
harness (closed kind, observed version, capability declaration with explicit gap
records), and `HarnessSession` is the one lifecycle shape engines drive: spawn,
deliver, resume/steer, collect, classify, and harness-agnostic liveness. Two
adapters ship: opencode (the ported scripted behaviour, driving the full
lifecycle) and Claude Code (headless spawn and collect, with every other
operation returned as a declared capability gap before any invocation, so a
consumer reading the declaration never discovers a gap mid-delivery).
Classification lives in exactly one shared harness-neutral classifier over
adapter-normalized evidence, so the same scenario cannot classify differently
per harness.

The opencode adapter's spawn, resume, and deliver acquire the session handle from
the first identified line of the harness's JSONL stdout and keep draining the
stream until the process exits. A handle therefore exists before a long session
completes, `collect` returns completion-scoped evidence, and no fixed
whole-session process cap bounds the lifecycle. The Claude Code headless spawn
keeps its bounded one-shot invocation.

The spawn path carries an execution-environment descriptor whose environment is
a deny-by-default allowlist. The child environment is built from the declared
set alone; an undeclared parent variable is absent, credentials resolve through
the credential port at use time, and an unresolvable reference fails closed
naming the reference. A declared variable entry is required unless it carries the
variable-only optional marker: an absent required entry fails closed with
`harness.spawn.variable-missing` naming the variable in `field`, while an absent
optional entry is omitted and a present one is forwarded. A credential entry is
always required and never accepts the marker. Host execution is the only
production implementation. An optional validated data-record map from profile
resolution may supply values for declared variable names; a record value takes
precedence over the injected parent environment, and an undeclared record name
changes nothing.

At closeout, both harness stores are read strictly read-only into one
harness-neutral statistics shape and appended to the state ledger as additive
`harness.telemetry` records. Capture is idempotent, fenced and verified, and
non-gating: failure is classified and disclosed with counts and warnings, and
never changes a closeout step, summary, or verdict.

Liveness carries two vocabularies. The delivered liveness-kind union stays
exactly `session-traffic`, `worktree-activity`, and `process`. Heartbeat age and
token delta are additive sourced-signal kinds declared per harness, carried in
the neutral liveness report beside the unchanged readings, and projected into
the watchdog signal shape when a source exists. An unsourced signal stays
absent; it is never coerced to zero.

**The harness adapter ships no dispatch engine** (DEC-1); the dispatch engine
is its first production consumer. One-shot `dispatch` and the daemon lane
executor spawn, resume, observe, collect, and classify through the same
`HarnessSessionPort` and the same shared classifier. The "same delivery through
either adapter" property is proven at the adapter/port boundary and exercised by
the dispatch composition; the adapters add no dispatch branch of their own.

## 2. Port surface

| Export | Role |
|--------|------|
| `HARNESS_KINDS` | Closed kinds: `opencode`, `claude-code`. |
| `HARNESS_OPERATIONS` | Closed operations: spawn, deliver, resume, steer, collect, session-list. |
| `HARNESS_LIFECYCLE_CAPABILITIES` | Headless spawn, resume/steer injection, session introspection, telemetry extraction. |
| `HARNESS_LIVENESS_KINDS` | Session traffic, worktree activity, process. |
| `HARNESS_GAP_REASONS` | Closed gap reasons; an unlisted capability is a declared gap, never implied parity. |
| `HarnessInstance` | Kind, observed version (explicit unknown plus warning), capability declaration. |
| `HarnessSessionPort` | Spawn, deliver, resume, collect, classify, liveness, session listing. |
| `HarnessSpawnRunner` | The one-shot child-process seam: resolves at process close and carries the bounded stdout, stderr, exit status, and timeout flag; used for read-only session listing and by the Claude Code adapter. |
| `HarnessSpawnStarter` | The streaming child-process seam: starts a child and returns its line stream, completion promise, handle-acquisition acknowledgement, and idempotent kill; used by the opencode adapter for spawn, resume, and deliver. |
| `HarnessSpawnStreamOptions`, `HarnessSpawnStream` | The starter's per-invocation options (working directory, environment, optional stdin, handle-acquisition bound, optional whole-session bound) and its stream handle. |
| `HarnessExecutionEnvironmentDescriptor` | Execution kind (`host` only), work directory, and the declared variable names (each variable entry may carry the additive optional marker) and credential references. |

`HarnessSessionPort` keeps its delivered shape — `spawn` returns a handle and
`collect` later returns evidence — and exposes no stream. `HarnessSpawnRunner`
and `HarnessSpawnRunnerResult` keep their one-shot completion-gated shape. The
streaming seam is adapter-internal and the session port does not carry it.

`HarnessCapabilityDeclaration` carries the additive `sourcedSignalSources` and
`sourcedSignalGaps` members; `HarnessLivenessFacts` and `HarnessLivenessReport`
carry an optional `sourcedSignals` array beside the delivered readings. The
sourced vocabulary is `ECONOMICS_SOURCED_SIGNAL_KINDS` — `heartbeat-age` and
`token-delta` — declared in the economics contract. `HARNESS_LIVENESS_KINDS`
stays exactly three and is never widened.

The one shared classifier is `packages/core/src/domain/harness-classify.ts`; it
imports the delivery-result taxonomy and contains no harness-kind comparison or
token literal. The deny-by-default builder is
`packages/core/src/domain/harness-spawn-env.ts`. The neutral liveness assembly
is `packages/core/src/domain/harness-liveness.ts`.

### Classification

The classifier consumes adapter-normalized `HarnessEvidence` only. It resolves a
closed `HarnessOutcome` and projects the outcome onto the existing delivery-result
taxonomy; it declares no token row of its own. The projection is declared once in
`HARNESS_CLASSIFICATION_TOKENS` in the contracts tier.

| Outcome | Evidence condition | Delivery-result token | Derivation class |
|---------|--------------------|-----------------------|------------------|
| `refused` | Spawn refused before a session existed | `noop-lane-permission` | `dispatch-session` |
| `timed-out` | Bounded invocation timed out | `max-restarts` | `dispatch-session` |
| `failed` | Non-zero exit or a reported failure | `failed` | `verify` |
| `completed` | Completion marker present, no tool failure | `finished` | `verify` |
| `completed` | Completion marker present, tool failure reported | `partial` | `verify` |
| `premature-end` | No completion marker and no failure/refusal/timeout | `partial` | `verify` |

Evaluation order is structural: refusal and timeout are terminal before any exit
is read; a non-zero exit or reported failure is a failure; a completion marker
separates completion from premature end. Premature end never collapses into
completion or failure. The derivation class is read from the taxonomy row, so a
classifier change cannot fork the projection.

The projection draws on the shared delivery-result vocabulary; no
dispatch-session-class completion token exists. Three outcomes (`completed`,
`completed` with a reported tool failure, and `premature-end`) project the
verify-class tokens `finished` and `partial`; refusal and timeout reuse the
dispatch-session tokens `noop-lane-permission` and `max-restarts`. The token
alone is deliberately lossy: `premature-end` and `completed` with a reported
tool failure both project `partial`, so the `outcome` field is required to
disambiguate them and a `partial` token never identifies which occurred. From
the harness path, `noop-lane-permission` means the harness refused the spawn
before a session existed; it does not assert a lane-permission policy verdict.

### Implementation layout

| Path | Responsibility |
|------|----------------|
| `packages/core/src/domain/harness-classify.ts` | The one shared neutral classifier and outcome-to-token projection. |
| `packages/core/src/domain/harness-capability.ts` | Capability-declaration validation and machine-readable gap inspection. |
| `packages/core/src/domain/harness-canonical.ts` | Recursively key-sorted canonical serialization for evidence, liveness, and telemetry. |
| `packages/core/src/domain/harness-registry.ts` | Configured-kind registry and injected version probe; unknown kinds classify, never default. |
| `packages/core/src/domain/harness-spawn-env.ts` | Deny-by-default environment construction from the descriptor. |
| `packages/core/src/domain/harness-liveness.ts` | Neutral liveness assembly with explicit absent readings, plus the additive sourced-signal carriage and watchdog bridge. |
| `packages/core/src/domain/economics-budget.ts`, `economics-resume.ts`, `economics-view.ts`, `economics-evidence.ts` | The restart gate, resume classification, economics view, and refusal-evidence corpus consumed by the lifecycle surface. |
| `packages/core/src/contracts/economics.ts` | The additive sourced-signal vocabulary, economics record kinds, view fields, and refusal-evidence declarations. |
| `packages/core/src/domain/harness-telemetry.ts` | Bounded capture folding and deterministic human rendering. |
| `packages/core/src/state/harness-telemetry.ts` | The additive `harness.telemetry` ledger: fenced verified append and group-scoped idempotent history read. |
| `packages/adapters/src/harness/` | The opencode and Claude Code delivery adapters, read-only telemetry extractors, and the read-only SQLite store loader. |
| `packages/adapters/src/host/index.ts` | The harness seam's single child-process module and a pinned entry in the exact repository-wide `node:child_process` allowlist, exposing two seams: the one-shot `createHostSpawnRunner` (read-only listing and Claude Code) and the streaming `createHostSpawnStarter` (opencode spawn, resume, deliver). Both receive the constructed environment as data and read no ambient environment. |

## 3. Adapters

> **Additive process-port capabilities (GH-241).** Coordinator supervision uses
> the delivered `DaemonProcessPort` as its only process port. The port carries
> `SIGKILL` in its `signal` set for the grace-escalation half and an optional
> `startTimeMs(pid)` identity capability, implemented by the shipped
> `createNodeProcessPort` from the Linux `/proc/<pid>/stat` start ticks plus
> `/proc/stat` `btime`; off Linux, or when either file is unreadable, it yields no
> reading and the kill path reports `identity-mismatch` rather than signalling an
> unverified pid. The delivered harness session port carries spawn, resume,
> deliver, collect, classify, liveness, and read-only session listing; the coordinator
> profile uses spawn, resume, liveness, and listing, and reads progress from the
> liveness report. Resume is a decision input, never a process capability.
> Capability ownership is four-way and distinct: an undeclared or unavailable
> harness **resume** selects `spawn-fresh` reason `session-interrupted` with no
> error identity; a harness that cannot or will not **spawn** returns the
> delivered `harness.capability.gap` / `harness.spawn.refused` at exit 1; a
> missing process-port **alive**, kill-with-grace, or **start-time identity**
> capability is `coordinator.process.capability-gap` at exit 2 with no destructive
> action (a declared probe that returns no answer is `unknown`, the lease-age
> fallback input, never a gap); an absent **progress** source is an `unknown`
> evidence class and never a failure or a kill. The adapter maps a positive
> `token-delta` or `session-traffic` reading to `newTurn`/`progressing`, a sourced
> zero to `zero`, and an absent reading to `unknown` (never zero). `isAlive(pid)`
> is the lease-liveness source, with lease age only the fallback when the declared
> capability returns no answer for the handle.

**opencode** (`packages/adapters/src/harness/opencode.ts`) spawns `run --format
json` and decodes stdout as JSONL: each line is parsed independently, a trailing
carriage return and blank or non-object lines are skipped, and the session
identifier is taken from the top-level `sessionID` first with `session.id`,
`sessionId`, and `id` as fallbacks; an empty-string identifier is not an
identifier. It acquires the handle on the first identified line and returns it
before the session completes, keeps draining the stream in the background, and
resolves `collect` only when the process closes. The handle maps the session id
to the work item as the tree root. Deliver and resume start the same stream with
the steering payload on stdin and the caller's session id (no new root), acquire
on the first line whose identifier equals the handle's `sessionId`, preserve the
delivered tree root and identity, and refuse a different or absent identifier as
`harness.session.unknown` after an idempotent kill; a later non-zero exit is
post-handle evidence. It lists sessions read-only with an explicit cap through
the one-shot runner, sources session-traffic and process liveness, carries
injected heartbeat-age and token-delta sourced-signal facts, and normalizes
premature end into the neutral evidence shape. It declares `session-traffic` and
`process` as liveness sources and `heartbeat-age` and `token-delta` as
sourced-signal sources; worktree activity is a declared gap
(`provider-unsupported`). Injected sourced facts are filtered to the declared
sources and never re-queried.

Evidence is completion-scoped and keeps the legacy single-document envelope
precedence. A decoded line that carries a `result` object, or an identifier-only
document without the top-level `sessionID`, is a legacy single-document
envelope; when one is present its `result` facts (`completion`/`completed`,
`refused`, `failure`/`status`, `toolFailure`) are authoritative and the host exit
status and timeout are merged on top. Otherwise completion requires exit status
`0`, no timeout, and a terminal `step_finish` event whose `part.reason` is
`stop`; an `error` event reports failure, and a `tool_use` part whose
`state.status` is `error` reports tool failure. A non-zero exit is carried by
`exitStatus` alone and never copied into the reported-failure fact, so a
provider-reported failure and a process exit stay separable.

**Claude Code** (`packages/adapters/src/harness/claude.ts`) spawns headlessly
with the prompt as data, collects and classifies through the shared classifier,
and supports spawn and collect only. Deliver, resume, steer, session listing,
resume/steer injection, session introspection, all three liveness kinds, and both
sourced-signal kinds are explicit gaps (`headless-mode-limitation` /
`provider-unsupported`). A declared gap is returned before any invocation and
carries no executable fallback instruction.

## 4. Configuration

The typed `harness` branch carries the selected kind, the execution kind, both
store locations, and the declared environment allowlist. An absent branch
resolves to the shipped defaults (opencode, host execution, default store
locations, the default allowlist below) with `defaults` origins. Unknown kinds,
wrong-typed or empty store paths, and unknown branch keys classify with the
configuration path; an allowlist entry carrying a literal value is rejected by
`config.secret.forbidden`, and an invalid `optional` marker or a credential entry
carrying the marker is `config.value.invalid`. The configured-kind registry
validates that exactly the two shipped kinds are registered and never silently
defaults.

The shipped `harness.environment` default declares `PATH` and `HOME` as required
entries, `TMPDIR` as an optional entry, and the composition-injected
`DELIVERY_WORK_PATH` as a required entry. It declares no model variable: model
selection is the harness's own configuration concern, and no ambient
provider-model environment variable is mapped, forwarded, or synthesized. An entry without the `optional` marker keeps
required semantics, so an absent required entry fails the spawn closed with
`harness.spawn.variable-missing` naming the variable in `field`; an absent
optional entry is omitted while a present one is forwarded. The marker is
variable-only and never applies to a credential entry.

## 5. Telemetry extraction

Both extractors emit neutral records carrying the five token classes (`input`,
`output`, `reasoning`, `cacheRead`, `cacheWrite`), call counts, bounded per-tool
counts, agent and model identity, tree root, parent chain, work-item ref, harness
kind and version, a cost that is null (never zero) when missing, the injected
captured-at timestamp, and warnings from a closed reason set. opencode emits one
record per (session, agent, model) group with that group's token and tool
attribution, so a session spanning several agent/model pairs keeps every group
instead of collapsing to one. A session whose agent/model groups exceed the
per-session group cap truncates with an explicit `truncated` warning at capture
level that names the omitted-group and cap counts; no group is dropped silently.
Claude Code emits one record per session.

opencode extraction opens the session store read-only, sets the query-only
pragma before the first read, and issues only bounded indexed queries with no
full message/part scans. Claude Code extraction parses local session files
read-only with per-file byte and line caps, and its file reader checks the
declared byte cap before reading: `readBounded` stats the file, opens it, reads
at most the capped number of encoded bytes, and reports `truncated` with the
omitted-byte count, so a full transcript is never loaded before the cap is
applied. A truncated file degrades with a `truncated` warning and never
hard-fails.

Optional-field drift degrades with a warning and never hard-fails. On the
opencode store, parentless sessions without a work-item port are counted as a
bounded store-level warning (`store:out-of-port-orphans=<n>`) and invalid
session identities as `store:invalid-identity=<n>`; they are never fabricated as
the capturing delivery's failed sessions. A session that is attributed to the
capturing delivery but cannot be parsed is a classified failed capture with no
fabricated record. Conversation content never enters the output.

## 6. Closeout capture

The closeout composition constructs the telemetry capability from the resolved
typed harness settings when they are supplied: the opencode extractor over the
configured database or the Claude Code reader over the configured session
directory. After the terminal steps, apply extracts, appends one
`harness.telemetry` record per captured session group plus a run-scoped capture
outcome, and discloses
captured/degraded/failed counts and warning reasons in the bounded output; the
captured count is the number of extracted session-group records. Appends are
fenced and verified; session-group capture is idempotent by (work item, run,
session, agent, model) and the capture outcome by (work item, run), so re-runs
append nothing already captured. A failed capture writes no zero-valued record
and changes no other closeout effect. The state schema version is unchanged and
no migration or derived projection exists. An injected
`CloseoutComposition.telemetry` runtime overrides the constructed capture for
tests.

Apply runs extraction after the terminal steps and before the applied payload;
plan performs no extraction and no append. The state-layer `harness.telemetry`
records remain in the event log and are the only source `spend` reads; the
capsule stream carries no statistics.

The same harness-neutral extractors attribute the delivery's sessions for the
closeout compaction checkpoint when harness settings are supplied. An opencode
work-item root or a Claude session tree yields the bounded session identities;
an empty store is `skipped-noop` (`no-sessions`); an unavailable store or a
store whose sessions cannot be attributed to the delivery is `skipped-gap`
(`session-attribution-unavailable`) plus a `session-attribution-gap` residue
item. Injected session facts override the derived attribution for tests.

### Review deferrals

The GH-233 review findings on the reachable capture path are recorded in
`HARNESS_REVIEW_DEFERRALS` (`packages/adapters/src/harness/review-deferrals.ts`)
with a status, reason, owning story, and revisit trigger:

| Finding | Status | Reason and owner |
|---|---|---|
| F-8 (Claude Code file-read budget) | resolved | The reader checks the declared byte cap before the read and reads at most that many encoded bytes. Owner: GH-240. |
| F-11 (store-scoped orphan/invalid disclosure) | resolved | Parentless sessions without a work-item port are a bounded store-level warning; only the capturing delivery's own unattributable or invalid sessions are failed sessions. Owner: GH-240. |
| F-9 (host-runner semantics) | resolved | Dispatch (GH-239) is the first production consumer of host-runner sessions and drives them through the declared harness session port; the closeout extraction path is unaffected and consumes no host runner. Owner: GH-239. |

The host module (`packages/adapters/src/host/index.ts`) carries two seams over
the pinned `node:child_process` site. The one-shot `HarnessSpawnRunner` keeps its
delivered semantics — an external `SIGTERM` sets `timedOut`, `stderr` truncation
lacks the stdout marker, and the output bound is measured in UTF-16 units — and
serves read-only session listing and the Claude Code adapter. The streaming
`HarnessSpawnStarter` serves opencode spawn, resume, and deliver: it streams
stdout as lines while buffering the same 16 MiB stdout bound with the truncation
marker, resolves `completion` on close or error and never rejects, cancels its
handle-acquisition bound when the adapter acknowledges acquisition, applies no
whole-session bound unless the caller injects one, and exposes an idempotent
`kill` that sends `SIGTERM` and escalates to `SIGKILL` after a short grace. Both
seams carry the delivered child-stdin early-close guard: each attaches an `error`
handler to the child's stdin before writing the prompt, so a child that exits
without reading cannot surface an uncaught stream error. An `EPIPE` is a benign
early-exit signal and leaves the close-classified result to stand; any other
stdin error resolves the seam as a spawn failure with status 127, the seam's
existing spawn-error status. The guard adds no process primitive, timeout,
lifecycle, output-buffering, or invocation-grammar change. The opencode adapter
bounds handle acquisition at 60 s by default and takes an optional whole-session
bound; it has no default session bound, so a lifecycle is bounded by
progress-based liveness and the restart budget rather than a fixed process cap.
Evidence derivation keeps the legacy single-document envelope
precedence described in §3. The dispatch composition drives the session port; the
streaming starter is a declared contract beside the one-shot runner, not an
ad-hoc runner API, queue, or spawn-failure surface.

## 7. Out of scope

No plugin generation (M3-S1), no
containerized executor implementation, no spend projection or retro pipeline
(M1-S19/M1-S8), no model-profile selection or pacing (specified in
[Provider Profiles and Watching](feature-provider-profiles.md)), and adds no CLI
command surface of its own. The spend read side is delivered separately and consumes the
captured `harness.telemetry` records from the state ledger without re-querying a
harness store; this seam keeps its extraction, capture, and composer boundary
unchanged. The watchdog consumes the adapter-sourced liveness facts; the
session lifecycle economics surface — restart budget, resume economics,
amplification derivation, and the sourced stall identity — is documented in
[Session Lifecycle Economics](feature-session-lifecycle-economics.md).
Worktree-activity sourcing and Claude Code liveness remain declared gaps.

## 8. Verification

- `tests/structure/harness-contract.test.ts`, `harness-neutrality.test.ts`,
  `harness-imports.test.ts` (the exact `node:child_process` allowlist equality and
  the non-allowlisted-path boundary case `runtime-child-process-adapter-registry`),
  `harness-stream-contract.test.ts` (the additive streaming seam, the fixed
  session-port and one-shot-runner shapes, adapter confinement, and the pinned
  capture shape), `harness-environment-marker.test.ts` (the variable-only
  optional marker is additive and type-only), `tests/types/harness.type-test.ts`,
  `tests/types/harness-stream.type-test.ts`,
  `tests/types/harness-environment-marker.type-test.ts`
- `tests/behaviour/harness-spawn-env.test.ts`,
  `harness-spawn-credential.test.ts`, `harness-default-path.test.ts` (the
  shipped default declares `PATH`, `HOME`, `TMPDIR` optional, and
  `DELIVERY_WORK_PATH`, and a declared bare command resolves through `PATH`),
  `harness-opencode-session.test.ts`,
  `harness-opencode-stream.test.ts` (per-line decoding, identifier precedence,
  handle before completion, completion-scoped collection, and legacy-envelope
  evidence precedence), `harness-opencode-resume-stream.test.ts` (resume/deliver
  acquisition with preserved identity), `harness-host-stream.test.ts` (the
  child-stdin early-close guard on both seams — the close-classified result on an
  early-exit `EPIPE`, with no uncaught error, no orphan, and no leaked temp root),
  `harness-host-stdin-error.test.ts` (a coded non-`EPIPE` stdin error resolves
  both seams as a status-127 spawn failure), `harness-stream-hygiene.test.ts`
  (the 60 s handle bound, no default session
  bound, idempotent kill, and no surviving orphan), `harness-claude-session.test.ts`,
  `harness-config.test.ts`, `dispatch-harness-acquisition.test.ts` (the adapter
  driven through the dispatch composition),
  `economics-liveness-sourcing.test.ts`, `economics-liveness-prefill.test.ts`,
  `economics-liveness-corroboration.test.ts`
- `tests/conformance/harness-classification.test.ts`, `harness-liveness.test.ts`
- `tests/behaviour/harness-telemetry-{opencode,claude,shape,drift}.test.ts`,
  `harness-telemetry-claude-budget.test.ts`,
  `harness-telemetry-opencode-orphan-scope.test.ts`,
  `harness-closeout-{capture,idempotency,nongating}.test.ts`,
  `harness-output-bounds.test.ts`
- `tests/fixtures/harness/stream/opencode-v2.2.5.jsonl`,
  `opencode-v2.2.5-tool-error.jsonl`, and
  `opencode-v2.2.5-stream-error.jsonl` — the pinned real-shape captures (clean
  `step_finish` stop, tool failure, and stream error) with their provenance
  README.
- `tests/structure/harness-review-deferrals.test.ts` — the F-8/F-11 resolution
  and F-9 re-deferral record with its owner and revisit trigger.
- `tests/checks/harness-{mutants,determinism,ci-parity}.test.ts`

## Related

- [Adapter Ports and Credential Resolution](feature-adapter-ports.md) — the
  capability/gap substrate and credential port consumed here.
- [Adapter Conformance Suite](feature-adapter-conformance.md) — the harness
  conformance registry.
- [State Layer](feature-state-layer.md) — the additive telemetry record kind.
- [Spend Read Side](feature-spend.md) — the read-only consumer of the captured
  telemetry records.
- [Configuration Layer and Inspection](feature-config-layer.md) — the harness
  branch.
- [Closeout Transaction](feature-closeout.md) — the capture point, the capture
  construction from resolved harness settings, and the compaction-checkpoint
  attribution consumer.
- [Result Contract and Error Table](feature-result-contract.md) — the `harness`
  error family and the delivery-result token projection consumed here.
- [Verify Change and Exit Taxonomy](feature-verify-change-and-exit-taxonomy.md) —
  the delivery-result vocabulary and derivation classes.
- [Watchdog and Lane Contracts](feature-watchdog-lane-contracts.md) — the
  watchdog composes the adapter-sourced liveness facts and projects them into
  the declared signal shape.
- [Session Lifecycle Economics](feature-session-lifecycle-economics.md) — the
  restart budget, resume economics, amplification derivation, and sourced stall
  identity built on this seam.
- [Dispatch Engine](feature-dispatch-engine.md) — the first production consumer
  of the session port.
- [ADR-0008](../../decisions/ADR-0008-harness-adapter-contract.md) — the binding
  harness adapter contract.
- [TDR-0016](../../decisions/TDR-0016-harness-streaming-spawn-seam.md) — the
  additive streaming spawn seam and the handle-acquisition decision.
- [TDR-0021](../../decisions/TDR-0021-additive-optional-harness-environment-marker.md)
  — the additive optional marker on a declared environment variable.

## GH-238 lane executor

The delivered lane-executor adapter composes `HarnessSessionPort` for spawn, observe, collect, and liveness plus an injected launch planner. The daemon composition supplies `createLaneLaunchPlanner`; a missing planner or declared capability gap reports unavailable, producing the declared `supervise-only` mode. The lane seam is factory-proven; the production daemon entry that supplies the lane composition is resident-daemon production scope (GH-238).

## GH-239 dispatch consumer

The dispatch engine is the first production consumer of host-runner sessions. It resolves a harness, spawns or resumes through this port, watches with the adapter-sourced liveness facts, and classifies through the one shared harness-neutral classifier. A healthy spawn or resume returns its handle as soon as the first identified stream line arrives, so the watch observes progress while the session is still running and collection resolves at process close. The daemon lane executor composes the same port and planner at the daemon-composition factory, so a daemon-driven attempt and a one-shot dispatch over the same evidence produce the same token, outcome, and attempt record. The F-9 finding records this production-consumer outcome in `HARNESS_REVIEW_DEFERRALS`. See [Dispatch Engine](feature-dispatch-engine.md).
