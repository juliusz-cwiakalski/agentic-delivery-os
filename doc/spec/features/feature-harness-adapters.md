---
ados_distribution: internal
id: SPEC-HARNESS-ADAPTERS
status: Current
created: 2026-11-06
last_updated: 2026-11-08
owners: ["engineering"]
service: delivery-os
summary: "The delivered harness adapter seam: the HarnessInstance and HarnessSession primitive ports with closed harness-kind, operation, lifecycle-capability, and liveness-kind vocabularies and explicit capability gaps; the opencode delivery adapter (spawn, resume/steer, read-only session listing, sourced liveness, heartbeat-age and token-delta sourced-signal declarations); the Claude Code headless adapter (spawn and collect) with deliver, resume/steer, session listing, liveness kinds, and both sourced-signal kinds declared as gaps; the additive sourced-signal carriage beside the unchanged exact-three liveness kinds; the deny-by-default execution-environment descriptor with build-from-declaration spawn environments and use-time credential resolution; the typed harness configuration branch; one shared harness-neutral classifier with the outcome-to-delivery-result token projection; read-only bounded telemetry extraction from both stores into one harness-neutral statistics shape at one record per session group, with a bounded Claude byte read and store-scoped orphan/invalid-identity disclosure; the non-gating, idempotent closeout capture into additive harness.telemetry state records with bounded output, harness-store session attribution for the closeout compaction checkpoint, and the code-level GH-233 review-deferral record."
links:
  related_changes: ["GH-233", "GH-234", "GH-235", "GH-236", "GH-240", "GH-238"]
  related_decisions: ["ADR-0008", "TDR-0005"]
  contracts:
    - "packages/core/src/contracts/harness.ts"
    - "packages/core/src/contracts/economics.ts"
    - "packages/core/src/contracts/harness-telemetry.ts"
    - "packages/core/src/contracts/error-table.ts"
    - "packages/core/src/config/catalog.ts"
    - "packages/adapters/src/harness/index.ts"
    - "packages/adapters/src/harness/review-deferrals.ts"
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

The spawn path carries an execution-environment descriptor whose environment is
a deny-by-default allowlist. The child environment is built from the declared
set alone; an undeclared parent variable is absent, credentials resolve through
the credential port at use time, and an unresolvable reference fails closed
naming the reference. Host execution is the only production implementation. An
optional validated data-record map from profile resolution may supply values for
declared variable names; a record value takes precedence over the injected
parent environment, and an undeclared record name changes nothing.

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

**No dispatch engine ships here** (DEC-1). The "same delivery through either
adapter" property is proven at the adapter/port boundary; the dispatch pilot is
the consumer.

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
| `HarnessExecutionEnvironmentDescriptor` | Execution kind (`host` only), work directory, declared variable names and credential references. |

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
| `packages/adapters/src/host/index.ts` | The harness seam's one child-process spawn site, a pinned entry in the exact repository-wide `node:child_process` allowlist; receives the constructed environment as data and reads no ambient environment. |

## 3. Adapters

**opencode** (`packages/adapters/src/harness/opencode.ts`) spawns with
machine-readable output, delivers the prompt as data, maps the session id to the
work item as the tree root, resumes the existing session with the steering
payload verbatim (no new root), lists sessions read-only with an explicit cap,
sources session-traffic and process liveness, carries injected heartbeat-age and
token-delta sourced-signal facts, and normalizes premature end into the neutral
evidence shape. It declares `session-traffic` and `process` as liveness sources
and `heartbeat-age` and `token-delta` as sourced-signal sources; worktree
activity is a declared gap (`provider-unsupported`). Injected sourced facts are
filtered to the declared sources and never re-queried.

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
locations, default allowlist names) with `defaults` origins. Unknown kinds,
wrong-typed or empty store paths, and unknown branch keys classify with the
configuration path; an allowlist entry carrying a literal value is rejected by
`config.secret.forbidden`. The configured-kind registry validates that exactly
the two shipped kinds are registered and never silently defaults.

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
| F-9 (host-runner semantics) | re-deferred | The host runner is not on the closeout extraction path, and no production consumer exists until dispatch (M1-S9). Owner: M1-S9. |

The host-runner semantics stay as delivered: an external `SIGTERM` sets
`timedOut`, `stderr` truncation lacks the stdout marker, and the output bound is
measured in UTF-16 units. These are characterized as the deferred defect; no
dispatch surface, queue, spawn-failure row, or invented runner API is added.

## 7. Out of scope

No dispatch engine or dispatch command (M1-S9), no plugin generation (M3-S1), no
containerized executor implementation, no spend projection or retro pipeline
(M1-S19/M1-S8), no model-profile selection or pacing (specified in
[Provider Profiles and Watching](feature-provider-profiles.md)), and no new CLI
command surface. The spend read side is delivered separately and consumes the
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
  `tests/types/harness.type-test.ts`
- `tests/behaviour/harness-spawn-env.test.ts`,
  `harness-spawn-credential.test.ts`, `harness-opencode-session.test.ts`,
  `harness-claude-session.test.ts`, `harness-config.test.ts`,
  `economics-liveness-sourcing.test.ts`, `economics-liveness-prefill.test.ts`,
  `economics-liveness-corroboration.test.ts`
- `tests/conformance/harness-classification.test.ts`, `harness-liveness.test.ts`
- `tests/behaviour/harness-telemetry-{opencode,claude,shape,drift}.test.ts`,
  `harness-telemetry-claude-budget.test.ts`,
  `harness-telemetry-opencode-orphan-scope.test.ts`,
  `harness-closeout-{capture,idempotency,nongating}.test.ts`,
  `harness-output-bounds.test.ts`
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
- [ADR-0008](../../decisions/ADR-0008-harness-adapter-contract.md) — the binding
  harness adapter contract.

## GH-238 lane executor

The delivered lane-executor adapter composes `HarnessSessionPort` for spawn, observe, collect, and liveness plus an injected launch planner (the M1-S9 seam). A missing planner or declared capability gap reports unavailable, producing the declared `supervise-only` mode.
