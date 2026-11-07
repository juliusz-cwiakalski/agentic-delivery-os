---
change:
  ref: GH-233
  type: feat
  status: Proposed
  slug: harness-adapters
  title: "M1-S11: Harness adapters and dispatch portability"
  owners: [engineering]
  service: delivery-os
  labels: [m1, harness, adapters, telemetry, dispatch-portability]
  version_impact: minor
  audience: internal
  security_impact: high
  risk_level: medium
  dependencies:
    internal:
      - "Adapter ports and credential resolution (M0-S12, GH-181, delivered) — the port pattern, capability/gap declaration model, the use-time credential port, and the binding secret-read boundary this change extends to the spawn path"
      - "Provider v1 (M0-S13, GH-182, delivered via GH-202) — quota-aware provider routing whose credentials already resolve through the credential port, never direct environment reads"
      - "State layer — the append-only, schema-versioned event ledger with single-writer fences, verified reads, and the additive record-kind pattern that receives closeout telemetry"
      - "Configuration layer — the typed catalog branch mechanism carrying the harness branch (harness choice, store locations, declared environment allowlist)"
      - "Closeout transaction — the telemetry capture point and its idempotent, terminal-outcome, non-gating disclosure discipline this change extends"
      - "Result contract and delivery-result taxonomy (TDR-0005) — the result tokens and the dispatch-session derivation class the shared harness-neutral classifier emits"
      - "Watchdog lane contracts — the declared signals shape and signals-absent classification (consumed later by M1-S15); unchanged by this change"
      - "Adapter conformance suite — the registry, capability-gated execution, and mock-tier proof pattern reused for identical-result-classification evidence"
      - "ADR-0008 harness adapter contract — the binding port boundary, session lifecycle, configuration-driven selection, and telemetry-through-the-contract decisions this change implements"
    external:
      - "opencode — harness CLI (spawn, resume, session listing) and its local session store (read-only extraction)"
      - "Claude Code — harness CLI headless spawn and its local session files (read-only parsing)"
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make the harness a configuration choice instead of code — one harness port surface with two delivery adapters (opencode, Claude Code), a deny-by-default execution environment on the spawn path that closes the credential-inheritance exposure class, harness-agnostic liveness signals, and session cost/behavior telemetry captured durably into the state-layer event log at closeout — so dispatch, session economics, spend, and profiles build on a harness-agnostic foundation.

## 1. SUMMARY

This change delivers the M1-S11 harness adapter seam: the HarnessInstance and HarnessSession primitive ports (with capability declarations and explicit gap records per the delivered adapter contract model), an opencode delivery adapter that ports today's scripted session spawn, resume, and liveness handling, and a Claude Code delivery adapter with headless spawn. The spawn path carries an execution-environment descriptor — host is the only implementation in this change — whose deny-by-default environment allowlist means a spawned session receives exactly the declared variables (model-routing names, work paths, and credential references resolved through the credential port at use time) and never the full parent environment. Harness telemetry extraction reads the opencode session store (read-only, query-only) and Claude Code local session files (read-only parsing) and, at the closeout capture point, lands the delivery's session statistics — tokens by class, calls, tool usage, per agent and model, attributed to work items via session-tree mapping — as additive, schema-versioned records in the state-layer event log, so retrospectives and spend read the log instead of re-querying volatile harness stores. Harness choice and harness store locations resolve from a typed configuration branch, keeping the containerized-executor and bind-mounted-store seams open. No dispatch engine ships here: the "same delivery through either adapter" acceptance criterion is satisfied and proven at the adapter/port boundary with identical result classification; the dispatch pilot (M1-S9) is the dispatch-side consumer.

## 2. CONTEXT

### 2.1 Current State Snapshot

- The typed contract set carries no harness ports today. The delivered port set's own boundary declares harness primitives outside the M0 adapter-interaction set, with M1-S11 named as the owning story — there is no HarnessInstance, HarnessSession, or HarnessTelemetry contract in the runtime-neutral tier.
- The adapter substrate is proven and reusable: typed provider-agnostic ports with capability declarations and explicit gap records (an unlisted capability is a machine-readable gap, never an implied parity claim); one credential-resolution port whose single environment-backed implementation sits inside a binding secret-read boundary (ambient environment access outside an enumerated allowlist fails structurally); and session-administration ports that reach the opencode session store only through the opencode CLI, read-only for stores, under a metadata-only guarantee and privacy sign-off gate.
- Provider v1 routes model access with quota awareness and named, fail-loud parks; its credentials already resolve through the credential port, never direct environment reads.
- Delivery execution itself is still bound to one harness through the bash-era scripted stack: it spawns and resumes opencode sessions mapped to work items under ephemeral local state, sources a harness-specific keys environment file, and unsets those variables on exit — the credential-by-environment posture the deny-by-default allowlist replaces. The stack is the authoritative executor until the M1-S9 dual-run handover.
- Session cost and behavior telemetry lives only in harness-local stores (the opencode session database; Claude Code local session files). Nothing captures it: the closeout transaction's declared non-goals explicitly hand harness session telemetry capture to this change — closeout reads no session store today. Session databases are prunable; statistics not captured at closeout are lost to retrospectives.
- The watchdog liveness contract is delivered contract-first: a declared signals shape, a corroboration-gated stall verdict, and the signals-absent classification for absent sources — with zero production signal sources wired until M1-S15 supplies them. Harness-agnostic liveness signal sourcing is exactly the missing piece this change provides at the adapter level.
- The delivery-result taxonomy already declares a dispatch-session derivation class beside its tracker-pr and verify classes — the classification vocabulary the harness-neutral classifier will emit into.
- The state layer's additive record-kind pattern is established (salvage, provider parks and announcements, closeout operations, commit telemetry, owner-gate decisions, audit reservation/invocation, merge-domain kinds): payload-schema-versioned records, store-scoped keys, single-writer fences, verified reads, no schema-version bump — the substrate for telemetry records.
- The governing harness adapter contract decision record — ADR-0008, register status: Proposed, ratified via M0-S17 delivery; status flip routed to @decision-advisor — binds this change's boundary: harnesses are a provider domain behind the same primitive port surface; a declared session lifecycle (spawn, deliver, resume/steer, collect, classify, harness-agnostic liveness); capability gaps declared, never implied; dispatch selects a harness by configuration; closeout telemetry is extracted through the contract, never by engine-side scraping; no harness-specific logic in engines. Its recorded open confirmation — that one session surface covers resume/steer and liveness for both runtimes — is exactly what this change delivers or declares as gaps.
- The M1 planning pack's proposed dispatch contract resolves `--harness <name>` with config-supplied execution environment and store locations, and its retro/spend contracts read per-ticket token accounting "from the event log (no harness re-query)" — the consumer contracts this change's seams exist to satisfy.

### 2.2 Pain Points / Gaps

- **The harness choice is code, not configuration**: selecting a harness means editing how execution works. Nothing in the typed stack can express "run this delivery on opencode" versus "run it on Claude Code" as data, so the Anthropic-subscription model family is unreachable from delivery.
- **Credential exposure by inheritance**: spawned harness sessions receive the full parent environment, credentials included. The credential port centralizes resolution for the delivery process, but the spawn boundary passes everything through — the exposure class the credential-sidecar concept names and the deny-by-default allowlist closes.
- **Session telemetry is volatile and lost**: cost and behavior traces live in harness-local stores that are pruned by admin tooling. Statistics not captured at closeout are gone; re-querying stores at retro time is slow, schema-dependent, and repeated.
- **No neutral port means every engine re-learns the runtime**: without HarnessSession, the dispatch pilot would embed opencode assumptions, and each later engine would embed its own — the engine-level runtime coupling ADR-0008 exists to prevent.
- **Liveness knowledge is harness-coupled**: what counts as a livable signal (session traffic, worktree activity, process) is buried in scripted handling rather than declared, so the watchdog's signal-source seam has nothing harness-neutral to consume.
- **Store locations are implicit**: harness store paths resolve from wherever the scripted stack happens to look, so a containerized executor with bind-mounted shared stores cannot slot in without redesign.

## 3. PROBLEM STATEMENT

Because delivery execution, liveness handling, and session statistics are bound to one harness through the scripted stack — the harness choice is code, spawned sessions inherit the full parent environment including credentials, harness store locations are implicit, and cost/behavior evidence lives only in volatile harness-local stores — dispatch cannot select or switch a harness by configuration, every spawned session carries an unnecessary credential-exposure surface, liveness has no harness-neutral signal source to consume, and retrospectives permanently lose session statistics that were never captured at closeout; so the dispatch pilot, session-lifecycle economics, spend read side, model profiles, and retro pipeline inherit a harness-coupled foundation instead of the harness-agnostic port the M1 plan assumes.

## 4. GOALS

- **G-1**: The same delivery scenario driven through either harness adapter produces identical result classification — classification is a shared harness-neutral evaluation, never per-adapter logic (ticket acceptance criterion 1, satisfied and proven at the adapter/port boundary; the dispatch engine is M1-S9's consumer).
- **G-2**: Liveness signals are harness-agnostic: the port declares a closed vocabulary of signal kinds (session traffic, worktree activity, process); each adapter declares which kinds it can source; a signal a harness cannot source is a declared absent value, never a guessed reading (ticket acceptance criterion 2).
- **G-3**: The harness choice is configuration: a typed configuration branch selects the harness; switching selection changes execution with no code change (ticket acceptance criterion 3).
- **G-4**: A spawned session's environment contains only allowlisted variables: the execution-environment descriptor's deny-by-default allowlist is the whole spawn environment; an undeclared parent variable is absent; provider credentials resolve through the credential port at use time, never by inheritance (ticket acceptance criterion 4).
- **G-5**: After closeout, the event log holds the delivery's session statistics — tokens by class, calls, tool usage, per agent and model — attributed to the work item, readable without re-querying harness stores (ticket acceptance criterion 5).
- **G-6**: The spawn path carries an execution-environment descriptor whose only implementation is host execution, and nothing outside the descriptor implementation hardcodes host execution — the containerized-executor seam stays open.
- **G-7**: Harness store locations resolve from configuration, so bind-mounted shared stores slot in later without redesign.
- **G-8**: Every harness declares its capabilities and gaps; degradation is visible, never silent — a harness that cannot do something says so in machine-readable form.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Result-classification divergences between the two adapters for the same delivery scenario | 0 (identical classification tokens at the port boundary) |
| Undeclared parent variables present in a constructed spawn environment | 0 (fail-closed, testably absent) |
| Provider credential values supplied to a spawn environment by any path other than use-time credential-port resolution | 0 |
| Harness-specific branches, imports, or literals outside adapters and declared configuration | 0 (structurally assertable) |
| Harness store mutations or locks caused by telemetry extraction | 0 (read-only, query-only) |
| Degraded telemetry fields rendered without an accompanying warning | 0 |
| Fabricated (non-null) cost figures for missing cost data | 0 (null plus warning, never estimated) |
| Post-closeout harness-store re-queries required to read captured statistics | 0 (the event log is the only source) |
| Duplicate telemetry records after a closeout re-run | 0 (idempotent capture) |

### 4.2 Non-Goals

- **NG-1**: The dispatch engine and dispatch loop — no dispatch command or engine ships here; the pilot (M1-S9) consumes the port and adapters delivered by this change.
- **NG-2**: The harness plugin surface (HarnessPluginSurface — per-harness package generation, sync verification) — M3-S1.
- **NG-3**: The pi.dev evaluation spike or any further harness support — a later evaluation against the primitive contract, never special-cased.
- **NG-4**: Progress-based liveness economics — heartbeat/token-delta signal ingestion, resume-without-repaying-prefill, restart budgets, stall/progress sourcing into the watchdog (M1-S15). This change provides the harness-agnostic signal surface; the watchdog's zero-signal-source wiring is unchanged.
- **NG-5**: A containerized executor implementation — the descriptor is the seam (host is the only implementation); container execution is a later implementation behind the same descriptor.
- **NG-6**: The SpendRecord typed projection and cross-harness spend/metrics aggregation surfaces (M2-S6, M3) — this change produces the events they will consume.
- **NG-7**: The retro pipeline itself (M1-S8) — it reads the events; nothing retro-side ships here.
- **NG-8**: Model profiles and provider watching (M1-S21) — the descriptor carries declared model-routing variable names; profile resolution and automatic switch-or-park stay with profiles.
- **NG-9**: The credential sidecar (the credential port's second implementation) — the port is consumed unchanged; no mediated mode exists.
- **NG-10**: Telemetry for sessions not spawned through the harness session port (bash-era or externally created sessions), backfill of historical sessions, and capture points beyond closeout (phase boundaries, session end) — deferred.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | HarnessInstance primitive port (identity, version, capability flags and gaps) | A configured harness must be addressable data with declared capabilities, so consumers reason about what a harness supports instead of guessing (G-8; ADR-0008 DC-1). |
| F-2 | HarnessSession primitive port (spawn, deliver, resume/steer, collect, classify, harness-agnostic liveness) | Engines must drive one lifecycle shape without runtime branches; premature end and results classify identically across harnesses (G-1, G-2; ADR-0008 DC-2). |
| F-3 | opencode delivery adapter | Today's scripted spawn, resume, and liveness handling becomes the port's first adapter — the strangler starting point (G-1). |
| F-4 | Claude Code delivery adapter (headless spawn) | The Anthropic model family becomes reachable; capability gaps for what headless mode lacks are declared, not implied (G-1, G-8). |
| F-5 | Execution-environment descriptor with deny-by-default environment allowlist (host implementation) | The spawn path must construct exactly the declared environment and resolve credentials at use time, closing the inheritance exposure class (G-4, G-6). |
| F-6 | Harness configuration branch (choice, store locations, declared allowlist) | The harness choice and store locations must be configuration data, keeping the containerized and bind-mounted-store seams open (G-3, G-7). |
| F-7 | Harness telemetry extraction (read-only, harness-neutral schema) | Cost and behavior evidence must be extracted once, read-only, into a harness-neutral shape so aggregation never branches per harness (G-5). |
| F-8 | Closeout telemetry capture into the state-layer event log | Closeout is where the numbers are final; capture there makes statistics durable, attributed, and re-query-free (G-5). |

### 5.1 Capability Details

- **F-1 — HarnessInstance primitive port.** A typed contract identifying a configured harness: a stable kind from a closed vocabulary (initially opencode and claude-code), the observed harness version, and a capability declaration mirroring the delivered adapter capability model — the operations the harness supports, its lifecycle capabilities (headless spawn, resume/steer injection, session introspection, telemetry extraction), its liveness methods, and explicit gap records for everything else. An unlisted capability is a machine-readable gap, never an implied parity claim, and degradation is visible: a consumer inspecting the declaration knows exactly what a harness cannot do before spawning (ADR-0008 C-2). A harness instance resolves from configuration (F-6), never from a runtime literal inside an engine.

- **F-2 — HarnessSession primitive port.** The lifecycle surface engines drive, in one shape for every harness: **spawn** a delivery session with the prompt and the execution-environment descriptor applied; **deliver** work to it; **resume/steer** an existing session where the harness declares that capability; **collect** the result; **classify** the outcome — including premature end — through the shared harness-neutral classification; and report **liveness** signals in the harness-agnostic shape. The spawn call carries the owning work item, and the session-tree root maps to it, giving telemetry its attribution anchor. Liveness declares a closed vocabulary of harness-agnostic signal kinds — session traffic, worktree activity, process — and each adapter declares which kinds it can source; a signal the harness cannot source is a declared absent value (unknown, never guessed or fabricated), preserving the established discipline that a missing signal is never invented. Classification is a shared harness-neutral evaluation over adapter-normalized evidence: adapters normalize harness-specific outcomes into the neutral evidence shape, and the classifier — one implementation, shared — emits the delivery-result taxonomy's shared tokens through the ratified dispatch-session token projection (TDR-0010) identically regardless of the executing harness (DEC-10). The port never exposes a harness-specific escape branch; raw harness access by agents remains under the established escape-hatch rules (audited, off by default), with the adapters as the only sanctioned path.

- **F-3 — opencode delivery adapter.** Ports today's scripted behavior behind the port: session spawn with machine-readable output, resume by session identity with steering delivery, session listing for discovery, and the liveness handling the harness affords (session traffic sourced from the store's read surface; process signals), classified premature end and all. The adapter declares telemetry extraction over the opencode session store using strictly read-only access — read-only mode plus a query-only pragma, bounded indexed queries, parent-recursion session-tree aggregation, and correlation of tree roots to work-item refs (F-7). Its capability declaration states all of this explicitly; observed harness versions are pinned per the drift discipline.

- **F-4 — Claude Code delivery adapter.** Headless spawn, result collection, and classification through the shared classifier. Resume/steer injection is an explicit declared gap in this adapter — the contract's resume surface exists, the adapter declares it does not support it, and the consumer-side resume fallback mode (prompt re-entry with visible prefill cost) remains a later consumer decision, not an adapter behavior (DEC-4). Liveness sourcing is limited to the signal kinds the adapter declares; whatever headless mode cannot provide is a declared absent value with the degradation visible. Telemetry extraction reads Claude Code's local session files (transcripts and usage records) read-only, with the same attribution model and drift discipline as the opencode extractor (F-7).

- **F-5 — Execution-environment descriptor with deny-by-default allowlist.** Declared spawn-path data describing the execution environment: the environment kind — host is the only implementation in this change — and the deny-by-default environment allowlist: the exact variables a spawned session receives, comprising model-routing variable names, work paths, and declared credential references. Spawn-environment construction is build-from-declaration: the child environment is exactly the declared set, so every undeclared parent variable is absent from the spawn env — a testable, fail-closed invariant. Declared credential references resolve through the credential port at use time (spawn being a use), and their values enter only the constructed environment — never configuration, never records, never output. An unresolvable declared credential reference is a classified spawn failure naming the reference (fail-closed), never a silent omission or an ambient fallback. Nothing outside the descriptor implementation hardcodes host execution; store and work-path locations arrive as declared data (F-6) — the seam a containerized executor later implements without redesign (DEC-8).

- **F-6 — Harness configuration branch.** A typed catalog branch carrying the selected harness, per-harness settings including harness store locations, and the declared environment allowlist. Harness selection and store locations never appear as literals outside declared configuration and adapter implementations, so a containerized executor and bind-mounted shared stores slot in later as configuration, not code. Declaring nothing keeps today's behavior: the default harness (opencode), host execution. Resolution, origins, inspection, and classified validation errors follow the delivered configuration-layer mechanics.

- **F-7 — Harness telemetry extraction.** A per-adapter, capability-flagged read-only extraction capability producing one harness-neutral statistics shape shared by all adapters so metrics and retrospectives aggregate without per-harness branches. Captured statistics — per session, per agent, per model: token classes (input, output, reasoning, cache read, cache write); call counts; tool usage as bounded pre-aggregated counts per tool per agent (DEC-7); and session metadata (tree root, parent chain, work-item correlation, harness kind and version, model). Cost figures degrade, never fabricate: missing cost data renders null with a warning instead of estimating silently. Drift discipline, proven in the bash era: observed harness versions are pinned; optional fields degrade with warnings and never hard-fail; extraction never depends on optional columns; queries are bounded and indexed — no full scans of message tables. Extraction is read-only toward harness stores, always: it never mutates or locks a live session, and engines never read harness stores themselves (ADR-0008 C-5).

- **F-8 — Closeout telemetry capture.** The closeout capture point extracts the delivery's session statistics through F-7 and appends them to the state-layer event log as additive, schema-versioned telemetry records attributed to the work item via session-tree mapping. Capture is idempotent: a closeout re-run never duplicates records. Capture is non-gating: a failed extraction is a classified, durably disclosed outcome — never silent, never a fabrication of zeros — and it does not abort the closeout transaction's other effects, mirroring the delivered non-gating telemetry precedent (DEC-6). After closeout, consumers (retro, spend, metrics) read the event log alone; nothing retro-critical depends on a harness store still existing. Events reference the run and work item so they join to delivery outcomes, gate results, and phases; the SpendRecord typed projection remains a later story's consumption of these events.

## 6. USER & SYSTEM FLOWS

```
Flow 1: harness-agnostic spawn (the port boundary)
  consumer resolves the configured harness (F-6) → HarnessInstance (kind, version, capabilities, gaps)
  consumer calls HarnessSession.spawn(work item, prompt, descriptor)
    → descriptor applied: spawn env built from the declared allowlist only
    → declared credential references resolved through the credential port at use time
    → session spawned; tree root mapped to the work item
  a declared gap the consumer needed (e.g. resume injection on Claude Code)
    → visible before spawn, from the capability declaration — never a silent skip
```

```
Flow 2: identical delivery through either adapter (the boundary proof)
  the same scripted delivery scenario runs through the port twice
    → opencode adapter normalizes its harness facts into the neutral evidence shape
    → Claude Code adapter normalizes its harness facts into the same neutral shape
    → the one shared classifier emits the identical result-classification token both times
  divergence is impossible by construction: adapters normalize, never classify
```

```
Flow 3: liveness, harness-agnostic
  consumer requests liveness mid-session
    → adapter maps its sourced kinds (session traffic, worktree activity, process) into the neutral shape
    → a kind the harness cannot source: declared absent — unknown, never guessed
  (the watchdog keeps its zero-source wiring; sourced progress economics arrive with M1-S15)
```

```
Flow 4: the deny-by-default spawn environment
  parent environment holds variables the descriptor never declared (credentials among them)
  spawn constructs the child environment: exactly the declared set
    → the undeclared parent variable is absent from the spawn env (testable invariant)
    → declared credential references resolved at use time through the credential port
  a declared credential reference that cannot resolve
    → classified spawn failure naming the reference — fail-closed, no ambient fallback
```

```
Flow 5: closeout capture and the durable record
  delivery reaches closeout → capture point executes (F-8)
    → extraction reads the session tree read-only (query-only pragma / local-file parsing)
    → tokens by class, calls, tool usage, per agent and model — harness-neutral payload
    → additive telemetry records appended, fenced and verified, attributed to the work item
  optional-field drift or missing cost data → value degrades with a warning, capture continues
  extraction fails outright → classified, durably disclosed, non-gating — other closeout effects proceed
  re-run → idempotent: no duplicate records
  afterwards: retro/spend/metrics read the event log alone — no harness store re-query
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The harness primitive ports in the runtime-neutral contract tier: HarnessInstance (identity, version, capability flags and gap records) and HarnessSession (spawn, deliver, resume/steer, collect, classify, harness-agnostic liveness), with the closed vocabularies for harness kinds, lifecycle capabilities, and liveness signal kinds.
- The opencode delivery adapter: porting today's bash-era session spawn, resume, and liveness handling behind the port, with declared telemetry extraction over the session store (read-only mode, query-only pragma, bounded indexed queries, session-tree aggregation).
- The Claude Code delivery adapter: headless spawn, collect, and classification, with resume/steer injection and any unavailable liveness kinds declared as explicit gaps.
- The execution-environment descriptor on the spawn path with its host implementation and deny-by-default environment allowlist: build-from-declaration spawn environments, use-time credential resolution through the credential port, fail-closed handling of unresolvable declared references.
- The typed harness configuration branch: harness selection, per-harness settings including store locations, and the declared environment allowlist.
- Harness telemetry extraction with the harness-neutral statistics schema, session-tree attribution, drift discipline (pinned versions, warning-degraded optional fields, null-when-absent cost), and bounded reads.
- The closeout telemetry capture point: additive, schema-versioned telemetry records in the state-layer event log, idempotent re-runs, non-gating classified failure disclosure.
- The identical-result-classification proof at the adapter/port boundary, following the delivered conformance-suite pattern (registry, capability gating, mock-tier execution).
- Structural neutrality invariants: no harness-specific branches, imports, or literals outside adapters and declared configuration; no ambient environment reads on the spawn path outside the credential boundary.

### 7.2 Out of Scope

- [OUT] The dispatch engine, dispatch loop, or any dispatch command — M1-S9 consumes the port and adapters; the boundary proof here is at the adapter/port surface.
- [OUT] HarnessPluginSurface — per-harness plugin generation and sync verification — M3-S1; the plugin side is untouched in this change.
- [OUT] pi.dev or any further harness — enters later through an evaluation spike against the primitive contract, never by special-casing.
- [OUT] Progress-based liveness economics: heartbeat/token-delta ingestion, prefill-aware resume economics, restart budgets, or sourcing watchdog stall/progress verdicts — M1-S15; the watchdog wiring remains zero-source.
- [OUT] A containerized executor implementation — the descriptor's host implementation is the only one; container execution is a later implementation behind the same seam.
- [OUT] SpendRecord typed projection, spend command surfaces, cross-harness aggregation, and the retro pipeline — M2-S6/M3/M1-S8 consume the events; nothing consumer-side ships here.
- [OUT] Model profiles, profile resolution, and provider watching — M1-S21; the descriptor carries declared model-routing variable names only.
- [OUT] The credential sidecar or any second credential-port implementation — the port is consumed unchanged.
- [OUT] Telemetry for sessions not spawned through the harness session port, historical backfill, and capture points beyond closeout — deferred (§7.3).
- [OUT] New CLI command surfaces — this change adds no command; capture rides the existing closeout point, and dispatch/spend commands belong to their owning stories.

### 7.3 Deferred / Maybe-Later

- Capture granularity beyond closeout (phase boundaries, session end) and the storage cost of each — revisit when consumers need finer granularity.
- Tool-usage detail beyond bounded pre-aggregated counts (full-fidelity event streams) if a consumer demonstrates the need within payload bounds.
- Claude Code resume/steer injection if the harness affords it headless — then a capability upgrade of the existing adapter, never a fork.
- Containerized execution-environment implementation and bind-mounted shared stores as first-class configuration, once a named consumer appears.
- Telemetry events for sessions spawned outside the port, if attribution can be established without heuristics.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — the surfaces are local ports and adapters over harness CLIs and local stores; no HTTP endpoint is introduced and no network edge changes.

### 8.2 Events / Messages

| ID | Event | Producer | Consumer | Content |
|----|-------|----------|----------|---------|
| EVT-1 | Harness session telemetry record | The closeout capture point, through the adapter extraction capability | Retro, spend, and metrics consumers (later stories); audit reads | Per-session statistics: token classes (input, output, reasoning, cache read, cache write), call counts, tool-usage counts per tool per agent, session metadata (tree root, parent chain, work-item ref, harness kind and version, model), degradation warnings, null-when-absent cost figures; append-only, fenced, verified post-append, idempotent per session |

Capture outcomes (captured / degraded / failed counts per delivery) are durably disclosed through the closeout operation-record discipline, not a second event kind.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Harness telemetry record (EVT-1 payload) | Additive record kind inside the existing state schema under the store-scoped key per work item; payload-schema-versioned; no schema-version bump or migration. The content vocabulary (token classes, counts, attribution fields, warning semantics, null-cost rule) is pinned; the payload-schema string, record-kind name, and key spelling are delivery-bound |
| DM-2 | Execution-environment descriptor | Declared spawn-path data: execution-environment kind (host), deny-by-default environment allowlist — declared variable names (model routing, work paths) and declared credential references resolved at use time; consumed by the spawn path to construct exactly the child environment |
| DM-3 | Harness configuration branch | Typed catalog branch: selected harness, per-harness settings including store locations, and the declared environment allowlist; absent branch resolves to shipped defaults (opencode, host execution) |
| DM-4 | Harness capability declaration | Closed vocabularies for harness kinds, operations, lifecycle capabilities, liveness signal kinds (session traffic, worktree activity, process), and gap records — mirroring the delivered adapter capability/gap model; absence is a declared gap, never implied parity |

The pinned vocabulary — harness kinds, capability and gap semantics, liveness signal kinds, token classes, attribution fields, the deny-by-default rule, and the null-cost rule — may not be rebound; payload-schema strings, record-kind names, configuration key names, and evidence renderings are delivery-bound spellings.

### 8.4 External Integrations

- **opencode harness:** spawn, resume, and session listing through its CLI; telemetry extraction through its local session store strictly read-only (read-only mode plus query-only pragma; bounded indexed queries). Version probing and capability declaration per F-1.
- **Claude Code harness:** headless spawn through its CLI; telemetry extraction through local session files (transcripts and usage records) read-only. Declared gaps for what headless mode does not afford.
- **Model access** happens inside the harnesses against their configured providers; this change introduces no new vendor, no new credential kind, and no new network edge. Provider credentials resolve through the existing credential port at use time; the declared allowlist carries variable names and credential references, never secret values.
- No new external API surface beyond the two harness integrations above.

### 8.5 Backward Compatibility

- No existing command surface changes and no new command ships; the delivery-result taxonomy, watchdog contract, and configuration resolution mechanics are consumed, not modified.
- The closeout transaction gains the telemetry capture point: non-gating, disclosed, idempotent; its existing operations, plans, and outcomes are unchanged.
- The state ledger gains additive record kinds inside the existing schema; no existing record kind, read, schema version, or boundary is modified.
- The configuration catalog gains the harness branch; existing branches and resolution semantics are unchanged; an operator declaring nothing keeps today's behavior (opencode, host execution).
- The bash-era scripted stack is untouched and remains the authoritative executor until the M1-S9 dual-run handover; this change delivers the port and adapters that handover will consume.
- The credential port, secret-read boundary, and session-administration ports are consumed unchanged; the secret-read boundary's ambient-access allowlist gains no new ambient secret reads — the spawn path constructs environments from declared, port-resolved values.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Determinism: identical injected facts (harness I/O, store reads, configuration, clock) produce byte-identical outputs, including degradation warnings and evidence | 100% byte-identical; zero run-to-run drift |
| NFR-2 | Extraction read budget: bounded, indexed queries only over harness stores; bounded session count per delivery with explicit truncation marks; no full scans of message tables | 0 full scans; bounded session cap enforced and marked; 0 retries; 0 pagination |
| NFR-3 | Read-only extraction: telemetry access never mutates or locks a harness store (read-only mode, query-only pragma, file reads only) | 0 store mutations; 0 locks taken |
| NFR-4 | Output bounds: machine `data` ≤ 65 536 UTF-8 bytes; human summaries ≤ 4 096 UTF-8 bytes / 24 lines; per-tool, per-agent, and session lists capped with explicit `+N` marks | All bounds enforced and marked; no unbounded dump path |
| NFR-5 | Deny-by-default spawn environment: the constructed environment is exactly the declared allowlist; an unresolvable declared credential reference is a classified failure naming the reference | 100% of undeclared parent variables absent; 0 ambient fallbacks; 100% of unresolvable references classified |
| NFR-6 | Degradation discipline: optional-field drift degrades with warnings and never hard-fails; missing cost data renders null with a warning | 100% of degraded fields carry warnings; 0 fabricated figures; 0 capture hard-failures from optional-field drift |
| NFR-7 | State-write discipline: every telemetry append is fenced and verified post-append; capture is idempotent (re-runs append nothing); a failed append is classified, never silent | 0 silent partial records; 0 duplicate records on re-run |
| NFR-8 | Neutrality: no harness-specific branches, imports, or literals outside adapters and declared configuration; classification is one shared harness-neutral implementation | 0 engine-level runtime branches (structurally assertable); 1 classifier |
| NFR-9 | Secret boundary: the spawn path performs no ambient environment reads outside the established credential boundary; credential material enters only the constructed environment | 0 ambient secret reads; 0 credential values in configuration, records, or output |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- The delivery of this change is itself observable through the standard envelope conventions on any surface it touches; every closeout capture discloses per-session capture outcomes (captured / degraded / failed counts) with truncation marks — never silent.
- The telemetry records (EVT-1) are the durable observability trail: what ran, on which harness and version, with which model, at what token and call cost, attributed to which work item — the evidence spend and retrospectives read without touching harness stores.
- Degradation warnings are first-class output: a capture that degraded any field names the fields and the warning reasons; an absent cost figure is visibly null, never a fabricated zero.
- Harness store reads are bounded and disclosed; extraction never depends on a store still existing after closeout.
- No telemetry exporter, network sink, background process, or alerting channel is added by this change.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|------------|------------|---------------|
| RSK-1 | Claude Code headless mode affords fewer liveness signals or no resume injection, degrading parity with the opencode adapter | M | H | Capability flags declare exactly what degrades — the gap is visible before spawn, never discovered mid-delivery; declared-absent signals read unknown, never guessed; resume fallback is a documented consumer-side mode for a later story (DEC-4) | M — accepted, visible degradation is the designed posture (ADR-0008) |
| RSK-2 | opencode session-store schema drift breaks or skews extraction | M | M | Bounded indexed queries only; optional fields degrade with warnings, never hard-fail; extraction never depends on optional columns; observed versions pinned; missing cost renders null with a warning | L — degradation is bounded and disclosed |
| RSK-3 | The declared allowlist omits a variable a harness needs, breaking spawns after the deny-by-default flip | M | M | The allowlist is operator-editable declared configuration with origin evidence; a missing declared variable fails classified at spawn naming the variable — never a silent partial environment; declaring nothing keeps the default harness working | L |
| RSK-4 | Identical-result-classification proof proves only the mocks, not the real harnesses | M | M | The proof runs at the port boundary over injected harness I/O in the mock tier (merge-gate deterministic); classification lives in one shared neutral implementation so divergence is structural, not behavioral; live harness evidence stays read-only and non-gating, following the conformance-suite tier pattern | M |
| RSK-5 | Closeout capture misses sessions (partial extraction, unreadable store) and statistics silently undercount | H | M | Capture outcomes (captured / degraded / failed counts) are durably disclosed; a failed capture is classified and never silent; idempotent re-runs let a later closeout retry converge; the event log records exactly what was captured — undercount is visible, not invisible | M |
| RSK-6 | A seam leaks — a harness name, store path, or host-execution assumption hardcodes outside adapters/configuration, blocking the containerized future | M | M | Neutrality is a structural, assertable invariant (NFR-8); store locations and execution environment resolve only from configuration (F-6); containerized-delivery's compatibility seams are named keep-open obligations in this spec | L |
| RSK-7 | A future spawn path reintroduces environment inheritance, reopening the credential exposure class | H | L | The deny-by-default construction is a testable fail-closed invariant (AC-F5-2) with the secret-read boundary extended to the spawn path (NFR-9); regression fails structurally, not by convention | L |
| RSK-8 | ADR-0008's recorded assumption fails — one session surface cannot express a lifecycle step for both runtimes without an engine branch | M | L | The revisit trigger is pre-registered: the finding reopens the port boundary rather than patching an engine; declared capability gaps carry the interim degradation visibly | M — decision-records route if triggered |

## 12. ASSUMPTIONS

- The delivered harness set is opencode (default) and Claude Code; each CLI affords headless spawn and machine-readable session handling on the versions the adapters pin, and version pinning follows the established drift discipline.
- The adapter/port-boundary proof runs over injected harness I/O in the deterministic mock tier as a merge gate; any live-harness evidence tier is read-only, scheduled, and non-gating, following the delivered conformance-suite tier model.
- The bash-era scripted stack remains the authoritative delivery executor until M1-S9's dual-run handover; this change delivers the port and adapters without flipping execution authority.
- Single-host, local-first posture: the host execution-environment implementation executes locally; container execution arrives later behind the same descriptor.
- The state schema's workspace and lane identifiers remain the identity keys a containerized executor will key off; this change alters neither.
- The M1 pack's proposed dispatch contract (`--harness <name>`, config-supplied execution environment) is refined at M1-S9 delivery; this spec pins only the port/config seam that contract will consume.
- Credential material for model access resolves through the existing credential port exactly as provider v1 resolves its credentials; the harnesses receive resolved values only inside the constructed spawn environment.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Adapter ports and credential resolution (M0-S12, GH-181) — DELIVERED ✓ | Port pattern, capability/gap model, the use-time credential port, and the binding secret-read boundary extended to the spawn path |
| Depends on | Provider v1 (M0-S13, GH-182, delivered via GH-202) — DELIVERED ✓ | Quota-aware routing and credential-port resolution precedent; the ticket's "(ticket pending)" note is stale — both dependencies delivered |
| Depends on | State layer | Append-only schema-versioned ledger, fences, verified reads, additive record-kind pattern — the substrate for EVT-1 |
| Depends on | Configuration layer | Typed catalog branch mechanism carrying the harness branch with origins and classified validation |
| Depends on | Closeout transaction | The capture point; the idempotent, terminal-outcome, non-gating disclosure discipline this change extends |
| Depends on | Result contract and delivery-result taxonomy (TDR-0005) | Result tokens and the dispatch-session derivation class the shared classifier emits |
| Depends on | ADR-0008 harness adapter contract | The binding port boundary, lifecycle, config-driven selection, and telemetry-through-the-contract decisions implemented here |
| Depends on | Adapter conformance suite | The registry, capability gating, and mock-tier proof pattern reused for identical-classification evidence |
| Feeds | M1-S9 dispatch engine (GH-239) | The dispatch loop spawns, watches, and classifies through the harness port — backlog-ranking: "The dispatch pilot needs the harness port" |
| Feeds | M1-S15 session lifecycle economics (GH-235) | Progress-based liveness signals and resume economics build on the adapter-level signal surface |
| Feeds | M1-S12 closeout expansion (GH-240) | The capture point and telemetry records extend the closeout story's capsule |
| Feeds | M1-S19 spend read side (GH-236) and M1-S8 retro | Both read the closeout-captured telemetry events with no harness re-query |
| Feeds | M1-S21 model profiles (GH-234) | Every harness spawn resolves a profile first — the spawn seam this change provides |
| Blocks | Nothing directly; the sequenced dispatch, economics, spend, and profile stories build on the port, adapters, and telemetry records |

## 14. OPEN QUESTIONS

None blocking. Two known unknowns are resolved by mechanism rather than by decision, and neither blocks delivery:

1. **Claude Code headless signal and resume inventory** — which liveness signal kinds headless mode affords, and whether resume injection exists, are delivery-time discoveries about the harness, not specification choices. The resolution mechanism is pinned: the capability declaration states exactly what the adapter supports, every unsupported item is an explicit gap record, and degradation is visible before spawn (DEC-4, F-1). If the discovery shows a required lifecycle step cannot be expressed without an engine-level runtime branch, ADR-0008's revisit trigger fires and the port boundary is reopened — not patched in an engine.
2. **Concrete allowlist key set** — which variable names the default allowlist declares (model routing, work paths) is declared configuration data with origin evidence, refined at delivery; the deny-by-default rule, the use-time credential resolution, and the fail-closed invariant are pinned and are not re-opened by key choices.

No decision needs external arbitration at this checkpoint; the decision log (DEC-1..DEC-10) pins every specification-time choice.

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | The "dispatch runs the same delivery through either harness adapter" acceptance criterion is satisfied and proven at the adapter/port boundary — the port plus both adapters conformance-tested for identical result classification; no dispatch engine or dispatch-side integration ships in this change | No dispatch engine exists in the typed stack yet (M1-S17/M1-S18 rank later; M1-S11's own backlog-ranking row at rank 33 reads "The dispatch pilot needs the harness port"; the dispatch pilot M1-S9 itself ranks 39). The recorded scope interpretation in the PM planning notes adopts the boundary proof; the pilot is the dispatch-side consumer | 2026-11-06 |
| DEC-2 | The execution-environment descriptor carries a deny-by-default env allowlist; spawn-environment construction is build-from-declaration (the child env is exactly the declared set); provider credentials resolve through the credential port at use time, never by inheritance; an unresolvable declared reference is a classified spawn failure | Ticket-pinned decision, recorded verbatim as binding; the build-from-declaration reading is what makes "an undeclared parent variable is absent from the spawn env" a testable, fail-closed invariant rather than a filtering convention | 2026-11-06 |
| DEC-3 | Telemetry lands in the state-layer event log at closeout as additive, schema-versioned records with a harness-neutral schema and session-tree attribution to work items; the SpendRecord typed projection and aggregation surfaces remain later consumers | Ticket-pinned decision (the store spend reads); harness-neutral events are what let retro/spend/metrics aggregate cross-harness without per-harness branches (harness-telemetry concept); closeout is where the numbers are final | 2026-11-06 |
| DEC-4 | The Claude Code adapter ships headless spawn, collect, and classification; resume/steer injection is an explicit declared capability gap, and the consumer-side resume fallback mode (prompt re-entry, visible prefill cost) is a later consumer decision (M1-S16), not adapter behavior | The ticket scopes the Claude Code adapter to "headless spawn"; resume is named only for the opencode port. The pack's blocker-resume contract explicitly anticipates a "resume-prompt-reentry fallback when the harness adapter lacks resume injection". Declaring the gap honors ADR-0008 C-2 and makes degradation visible | 2026-11-06 |
| DEC-5 | Extraction is read-only toward harness stores, always: opencode via the session store in read-only mode with a query-only pragma and bounded indexed queries; Claude Code via read-only local-file parsing; engines never read harness stores themselves | harness-telemetry concept guardrail and ADR-0008 C-5: extraction never mutates or locks a live session, and nothing retro-critical depends on a store still existing; engine-side scraping is the defect class the contract forbids | 2026-11-06 |
| DEC-6 | Closeout capture is idempotent and non-gating: a re-run appends no duplicate records; a failed extraction is a classified, durably disclosed outcome that never aborts closeout's other effects; field-level drift degrades with warnings, never hard-fails | Mirrors the delivered non-gating commit-telemetry precedent and the closeout transaction's terminal-outcome discipline; silently losing telemetry is the exact pain point (RSK-5), so failure must be visible — while failing a delivery over statistics would invert priorities | 2026-11-06 |
| DEC-7 | Tool usage lands as bounded pre-aggregated counts per tool per agent inside bounded payloads with truncation marks — not raw tool logs or full-fidelity event streams | State payloads are bounded contract data; full-fidelity tool streams would breach the bounds discipline. Pre-aggregated counts satisfy the AC ("tool usage") and stay aggregatable; finer fidelity is deferred (§7.3) | 2026-11-06 |
| DEC-8 | Harness choice, harness store locations, and the declared environment allowlist resolve from a typed configuration branch; no runtime names, store paths, or host-execution assumptions appear as literals outside adapters and declared configuration; host is the only execution-environment implementation | ADR-0008 DC-5 plus the containerized-delivery compatibility seams: bind mounts and a containerized executor must slot in as configuration, not redesign; declaring nothing keeps today's behavior (opencode, host) | 2026-11-06 |
| DEC-9 | The harness port declares the harness-agnostic liveness surface — closed signal kinds: session traffic, worktree activity, process — and each adapter declares which kinds it sources; an unsourced kind is a declared absent value (unknown, never guessed); the watchdog's zero-signal-source wiring is unchanged and progress-based signal economics arrive with M1-S15 | Ticket AC 2 ("liveness signals are harness-agnostic") is a property of the signal surface, not of the watchdog's stall economics; M1-S15 depends on this change for exactly the adapter-level signal sourcing, so the boundary prevents scope collision | 2026-11-06 |
| DEC-10 | Result classification is one shared harness-neutral evaluation over adapter-normalized evidence: adapters normalize harness-specific outcomes into a neutral evidence shape and never classify with their own logic | The mechanism that makes ticket AC 1 hold by construction rather than by testing luck: identical classification tokens for identical scenarios are a structural property of one classifier, and per-adapter classification is the defect class ADR-0008 C-1 forbids | 2026-11-06 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Core contracts (harness ports, capability vocabulary, descriptor shape, telemetry record schema) | New — HarnessInstance, HarnessSession, telemetry payload schema, closed vocabularies; types and data only |
| Core domain (harness-neutral classification, liveness signal mapping, telemetry normalization/fold evaluation) | New — pure evaluation over injected facts; no I/O, clock, randomness |
| Harness adapters (opencode delivery adapter; Claude Code delivery adapter; per-harness telemetry extractors) | New — the adapters' I/O tier implementations behind the ports, with declared capabilities and gaps |
| Configuration catalog | New — the typed harness branch (selection, per-harness settings incl. store locations, declared environment allowlist) |
| State layer record kinds | Extended — additive harness telemetry record kind(s); no existing kind modified, no schema-version bump |
| Closeout surface | Updated — gains the telemetry capture point (idempotent, non-gating); existing operations unchanged |
| Conformance/testkit | Extended — harness adapter registration and the identical-result-classification proof flows over injected harness I/O |
| Watchdog lane contracts | Unchanged — the signals shape and signals-absent classification are consumed later (M1-S15); zero-source wiring stays |
| Command registry / CLI surface | Unchanged — no command ships in this change |
| Credential resolution | Unchanged — the port and its boundary are consumed; the spawn path joins its consumers |
| Current-truth feature documentation | New — a harness-adapters feature spec authored in-change; neighbors reconciled at system_spec_update (§18) |

## 17. ACCEPTANCE CRITERIA

**Ticket AC (verbatim):** dispatch runs the same delivery through either harness adapter with identical result classification; liveness signals are harness-agnostic; the harness choice is configuration; a spawned session's environment contains only allowlisted variables (an undeclared parent variable is absent from the spawn env); after closeout the event log holds the delivery's session statistics (tokens by class, calls, tool usage, per agent and model) without re-querying harness stores.

Traceability: ticket AC 1 → AC-F2-1; AC 2 → AC-F2-2; AC 3 → AC-F5-1; AC 4 → AC-F5-2; AC 5 → AC-F8-1.

Capability-level TC mapping note: the test plan's session-listing case (TC-HARN-033) maps to F-3's session-listing capability at capability level, alongside AC-F3-1's spawn/resume/premature-end/liveness cases (TC-HARN-008..010) — no acceptance criterion is renumbered and no existing TC home moves.

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** either shipped harness adapter, **when** its capability declaration is inspected, **then** every supported operation, lifecycle capability, liveness method, and extraction capability is declared, every unsupported item is an explicit gap record, and no consumer can mistake an unlisted capability for support — degradation is visible before any spawn | F-1, DM-4 |
| AC-F2-1 | **Given** the same scripted delivery scenario, **when** it runs through the port against each registered adapter over injected harness I/O, **then** both adapters normalize the scenario into the neutral evidence shape and the one shared classifier emits the identical result-classification token — including the premature-end case — with per-adapter classification logic structurally absent | F-2, F-3, F-4, DEC-10, NFR-8 |
| AC-F2-2 | **Given** each adapter's declared liveness sources, **when** a liveness read is taken for a live session, **then** the sourced signals map into the harness-agnostic shape (session traffic, worktree activity, process) independent of the executing harness, and a signal kind the harness cannot source is a declared absent value — unknown, never a guessed or fabricated reading | F-2, DEC-9 |
| AC-F3-1 | **Given** the bash-era session behaviors being ported, **when** the opencode adapter spawns, resumes with steering, and handles liveness for a session, **then** spawn delivers the prompt and applies the descriptor, resume attaches to the existing session without a new tree root, and a session that ends before completion classifies as premature end through the shared classifier | F-3, F-2 |
| AC-F4-1 | **Given** a Claude Code harness instance, **when** a session spawns headlessly and runs to completion or premature end, **then** the adapter collects and classifies the outcome through the shared classifier, and the capability declaration surfaces resume injection as an explicit gap to any consumer that asks — never a silent skip at resume time | F-4, DEC-4, AC-F1-1 |
| AC-F5-1 | **Given** configuration selecting harness A and then configuration selecting harness B, **when** the same delivery is driven through the port, **then** the selected adapter executes with no code change, and no runtime name, store path, or host-execution assumption exists outside adapters and declared configuration | F-6, DEC-8, NFR-8 |
| AC-F5-2 | **Given** a parent environment containing a variable the descriptor never declared (a credential among them), **when** a session spawns, **then** the constructed spawn environment contains exactly the declared variables — the undeclared parent variable is absent — declared credential references resolved through the credential port at use time, and a declared reference that cannot resolve is a classified spawn failure naming the reference, never an ambient fallback or silent omission | F-5, DEC-2, NFR-5, NFR-9 |
| AC-F5-3 | **Given** the spawn path and its seams, **when** inspected structurally, **then** host is the only execution-environment implementation, nothing outside it hardcodes host execution, and harness store locations resolve from configuration — so a containerized executor and bind-mounted shared stores slot in later without redesign | F-5, F-6, DEC-8 |
| AC-F7-1 | **Given** a delivery's session tree in an opencode session store or Claude Code local session files, **when** extraction runs, **then** all access is read-only (read-only mode with query-only pragma; file reads), queries are bounded and indexed with no full scans, and no store mutation or lock occurs | F-7, DEC-5, NFR-2, NFR-3 |
| AC-F8-1 | **Given** a delivery whose closeout has completed with a successful capture, **when** the event log is read, **then** it holds the delivery's session statistics — tokens by class (input, output, reasoning, cache read, cache write), call counts, tool usage per tool per agent, per agent and per model — attributed to the work item via session-tree mapping, with no harness store queried to obtain them | F-8, EVT-1, DM-1, DEC-3 |
| AC-F8-2 | **Given** schema drift, an absent optional field, or missing cost data during extraction, **when** the capture runs, **then** affected values degrade to null or absent with explicit warnings, the capture continues and completes, and no figure is fabricated — missing cost is visibly null, never estimated | F-7, F-8, DEC-6, NFR-6 |
| AC-F8-3 | **Given** a closeout re-run after a completed capture, **when** the capture point executes again, **then** no duplicate telemetry records are appended (idempotent convergence); and **given** an extraction that fails outright, **then** the outcome is classified and durably disclosed, and the closeout transaction's other effects proceed unaffected | F-8, DEC-6, NFR-7 |

### 17.1 Definition of Done (change-specific)

This change is done when every condition below holds. Each condition binds the §4.1 success metrics and/or the §17 acceptance criteria to a concrete, testable outcome, names its verification method, and cites the delivering plan phase in `chg-GH-233-plan.yaml` (Phases 1–8) where the proof is produced. The change-specific DoD is the post-implementation acceptance gate (`dod_check`): `@reviewer` audits the implementation against it, then `@pm` confirms the full checklist before PR creation. This specification claims no passing evidence and no acceptance; the conditions define what must be proven. Two framing rules, both recorded PM decisions carried into this gate:

1. **Boundary reading of ticket AC 1.** Per DEC-1, the "same delivery through either harness adapter" acceptance criterion is satisfied and proven at the adapter/port boundary — identical result classification over the port with both adapters registered — not by shipping a dispatch engine. No DoD condition requires dispatch-side integration.
2. **Proxy-tested conditions cite their gap records.** Conditions whose proof runs over injected facts, fixtures, or design proxies are done when their pinned resolution mechanisms pass as recorded in the test plan's gap register (GAP-T1 live-harness evidence; GAP-T2 bash-era parity fixture-pinned; GAP-T3 lock-freedom proxies; GAP-T4 container-readiness design judgment; GAP-T5 Claude Code headless inventory mechanism; GAP-T6 allowlist key-set mechanism; GAP-T7 delivery-bound names) — never by a literal live-harness or script-executed reading the test plan does not attempt.

| # | Done condition | Binds | Verification (test / evidence) | Proven in plan |
|---|---|---|---|---|
| DoD-1 | Both shipped adapters expose a complete capability declaration: every supported operation, lifecycle capability, liveness method, and extraction capability declared; every unsupported item an explicit gap record; degradation visible before any spawn | F-1, F-4, DM-4, AC-F1-1 | TC-HARN-001, TC-HARN-002, TC-HARN-003 green | Phase 1 (vocabularies), Phases 3–4 (adapter declarations) |
| DoD-2 | The identical-result-classification proof holds at the adapter/port boundary (the DEC-1 reading, not a dispatch-engine reading): the same scripted delivery scenario through both registered adapters over injected harness I/O yields the identical result-classification token, including premature end; one shared classifier, adapters normalize only, per-adapter classification structurally absent; the proof is mock-tier per GAP-T1 and this DoD claims no live-harness coverage | F-2, F-3, F-4, DEC-1, DEC-10, NFR-8, AC-F2-1, §4.1 rows 1 and 4 | TC-HARN-004, TC-HARN-005, TC-HARN-010, TC-HARN-011, TC-HARN-030 green; neutrality scans and the mutation control (an adapter-local classify fails) green | Phase 1 (classifier), Phase 4 (proof and conformance registry) |
| DoD-3 | Liveness is harness-agnostic: sourced signal kinds map into the neutral shape independent of the executing harness; a kind a harness cannot source is a declared absent value, never guessed; the watchdog's zero-source wiring is unchanged | F-2, DEC-9, AC-F2-2 | TC-HARN-006, TC-HARN-007 green over injected live-shaped facts (GAP-T1/GAP-T5 mechanism) | Phase 1 (shape), Phase 4 (adapter sourcing) |
| DoD-4 | The opencode adapter ports the bash-era session behaviors: spawn with the prompt and descriptor applied and tree root mapped to the work item, resume/steer without a new tree root, premature end through the shared classifier, and the ported liveness handling; parity is fixture-pinned, not script-executed (GAP-T2); the session-listing capability is exercised by its own case (TC-HARN-033) over injected I/O | F-3, F-2, AC-F3-1 | TC-HARN-008, TC-HARN-009, TC-HARN-010, TC-HARN-033 green; the fixture-parity review obligation recorded in the pm-notes | Phase 3 (adapter), Phase 4 (classification proof) |
| DoD-5 | The Claude Code adapter delivers headless spawn, collect, and classification through the shared classifier; resume/steer injection is an explicit declared gap surfaced before spawn, never a silent skip; its declared-absent inventory follows the pinned discovery mechanism (GAP-T5), never a guessed one | F-4, DEC-4, AC-F4-1, AC-F1-1 | TC-HARN-002, TC-HARN-011 green | Phase 4 |
| DoD-6 | The harness choice is configuration: A-then-B selection drives the same delivery through the selected adapter with no code change; store locations resolve from configuration, including a bind-mount-style location; host is the only execution-environment implementation and nothing outside it hardcodes host execution; validation failures classify with origin; container readiness is asserted by the seam proxies with the "without redesign" judgment reviewed at design time (GAP-T4); the allowlist key set stays representative declared data, never a frozen list (GAP-T6) | F-5, F-6, DEC-8, AC-F5-1, AC-F5-3, NFR-8, §4.1 row 4 | TC-HARN-003, TC-HARN-015, TC-HARN-016, TC-HARN-017, TC-HARN-018, TC-HARN-028 green; the GAP-T4 design-review record in the pm-notes | Phase 2 (configuration and registry), Phase 3 (seam reconciliation), Phase 7 (neutrality battery) |
| DoD-7 | The deny-by-default spawn environment holds: the constructed environment is exactly the declared set, every undeclared parent variable testably absent, declared credential references resolved through the credential port at use time only, an unresolvable reference a classified spawn failure naming the reference, zero ambient reads and zero credential material in configuration, records, or output | F-5, DEC-2, NFR-5, NFR-9, AC-F5-2, §4.1 rows 2 and 3 | TC-HARN-012, TC-HARN-013, TC-HARN-014 green (builder-level in Phase 1; session-port completion in Phase 3) | Phase 1 (construction), Phase 3 (spawn-path reconciliation) |
| DoD-8 | Extraction is read-only, bounded, and indexed toward both stores: zero store mutations, zero locks by the observable proxies (read-only connection, query-only pragma, no write or lock statement, unchanged store file, immediate writer probe — GAP-T3), zero full scans of message tables, bounded session cap with explicit truncation marks | F-7, DEC-5, NFR-2, NFR-3, AC-F7-1, §4.1 row 5 | TC-HARN-019, TC-HARN-020 green with statement counts, query-plan observations, and store file hashes recorded | Phase 5 |
| DoD-9 | The harness-neutral statistics shape and degradation discipline hold: token classes, call counts, bounded pre-aggregated per-tool counts per agent (DEC-7), per agent and model, session-tree attribution to the work item; optional-field drift degrades with warnings and never hard-fails; missing cost renders visibly null, never fabricated; capture completes through drift | F-7, F-8, DEC-7, NFR-6, AC-F8-2, §4.1 rows 6 and 7 | TC-HARN-021, TC-HARN-022 green | Phase 5 |
| DoD-10 | Output bounds and determinism hold: machine data ≤ 65 536 UTF-8 bytes, human summaries ≤ 4 096 bytes / 24 lines, capped lists with explicit `+N` marks; identical injected facts produce byte-identical outputs, including degradation warnings and evidence | NFR-1, NFR-4 | TC-HARN-026, TC-HARN-030 green; measured byte sizes recorded in the test plan's execution log | Phase 6 (bounds), Phase 7 (determinism goldens) |
| DoD-11 | Closeout capture is durable, idempotent, and non-gating: the event log alone holds the delivery's session statistics with no harness store re-query; re-runs append no duplicates; a failed extraction is classified, durably disclosed, and aborts no other closeout effect; every append fenced and verified post-append | F-8, EVT-1, DM-1, DEC-3, DEC-6, NFR-7, AC-F8-1, AC-F8-3, §4.1 rows 8 and 9 | TC-HARN-023, TC-HARN-024, TC-HARN-025 green | Phase 6 |
| DoD-12 | Full coverage evidence recorded: all twelve §17 acceptance criteria green — AC-F1-1, AC-F2-1, AC-F2-2, AC-F3-1, AC-F4-1, AC-F5-1, AC-F5-2, AC-F5-3, AC-F7-1, AC-F8-1, AC-F8-2, AC-F8-3 — with no uncovered criterion and no orphan TC; all nine NFR thresholds met (NFR-1..NFR-9) with measured evidence recorded in the test plan's execution log; every §4.1 metric row verified at its zero-target; every named non-vacuity mutant fails by name | §17, §4.1, NFR-1..NFR-9 | Test plan coverage matrix all Covered; execution log populated; TC-HARN-029 green | Phases 1–7 (per-phase gates), Phase 8 (evidence log) |
| DoD-13 | Contract reconciliation holds: no schema-version bump and no modified record kind (additive records only), error-table and inventory reconciliation green, and the bash-era suites green with the scripted stack untouched | NFR-7, NFR-8, AC-F5-3 | TC-HARN-027, TC-HARN-031 green; the bash-era suite battery (opencode-session, pm-liveness, doc-distribution) green | Phase 6 (state additivity), Phase 7 (wiring and bash-era non-regression) |
| DoD-14 | Quality-gate battery green on a clean checkout at the delivered HEAD: the aggregate workspace check (`pnpm check` — lint, format, typecheck, tests, boundaries, exports parity) plus the license-audit and vulnerability-gate checks with zero new dependencies, and every per-phase named suite from the test plan green | Delivery process, NFR-1..NFR-9 | Aggregate check run log; TC-HARN-031 aggregate row; plan task 8.1 record | Phase 8 |
| DoD-15 | Current-truth documentation reconciled through the declared handoff: the harness-adapters feature spec authored in-change and the §18 neighbor list reconciled, including the result-contract and adapter-conformance feature specs | §18 | TC-HARN-032 manual check; doc-sync reconciliation record | Phase 8 (spec-reconciliation handoff) |
| DoD-16 | Exactly one lockstep changeset exists for the release, matching the declared minor version impact — one version bump across the workspace packages, no per-package drift | Delivery process | Changeset present and singular in the changeset directory (one per change, per the GH-225 naming precedent); recorded in the Phase 8 release evidence | Phase 8 |
| DoD-17 | PR posture: a pull request is created against the integration branch (`main-tools`) and left open for human review, with the required CI jobs green on the pushed HEAD; merge and owner acceptance remain external and are not claimed by this specification | Delivery process | PR record and CI run attached to the change | Phase 8 (tracker transition), lifecycle phase 11 |

A condition without passing evidence is not done; `dod_check` reopens the owning plan phase rather than waiving a row.

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Delivered as one additive change through the standard 11-phase lifecycle on its feature branch; no flag-gating — a single-user local tool adds the seams directly.
- Delivery order inside the change: harness ports, vocabularies, and the pure neutral classification/liveness evaluation first (fixture-testable), then the configuration branch, then the opencode adapter (the strangler port of today's behavior), then the Claude Code adapter, then telemetry extraction, then the closeout capture point, with the identical-classification proof landing alongside the adapters it proves.
- The deny-by-default spawn environment activates with the adapters; the default declared allowlist keeps the default harness working out of the box, and allowlist edits are operator configuration with origin evidence.
- The bash-era stack is not retired here; execution authority flips only at M1-S9's dual-run handover, so this change carries no operational cutover.
- The implementation plan (delivery planning) maps the test plan's cases onto delivery phases without reshaping any pinned behaviour, vocabulary, record, or invariant; a later plan or implementation that changes a pinned contract reopens the test plan.
- Reconciliation note for phase 7 (system_spec_update): author the new harness-adapters feature spec in-change, and update the neighbors — the adapter-ports feature spec (harness ports join the port family; ADR-0008 implementation pointer), the result-contract feature spec (the additive `harness.*` error-table rows, doc/table/inventory-synced in the same commit — Phase 1 scope), the adapter-conformance feature spec (the harness conformance registry), the state-layer feature spec (the additive telemetry record kind and its consumers), the config-layer feature spec (the harness branch), the closeout feature spec (the non-goal flips: closeout now captures harness telemetry), the watchdog feature spec note (signal sourcing arrives via adapters; economics stay M1-S15), the nonfunctional bounds documentation (extraction read budgets, payload bounds), the architecture overview and glossary indexes, and the primitive catalogue's harness row pointers.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

None. Telemetry records are new and append-only within the existing state schema — no schema-version bump, no migration, no backfill. Deliveries closed before this change have no captured telemetry and are not backfilled (deferred, §7.3); retro and spend consumers read events from their first captured delivery onward.

## 20. PRIVACY / COMPLIANCE REVIEW

- Telemetry records carry numeric statistics and identity references only — work-item refs, session identity, agent names, model names, harness kind and version, counts and token classes, warning reasons. No prompts, message bodies, transcripts, diffs, tool outputs, or free-form session content enter records, evidence, or output.
- The metadata-only discipline established for session administration (never payload content, privacy sign-off gated) extends to every field extraction surfaces: extraction reads statistics structures, never conversation content.
- Credential material never enters configuration, records, evidence, or output; the declared allowlist carries variable names and credential references, never values; resolved values exist only inside the constructed spawn environment and pass the single serialization redaction chokepoint like every output.
- Extraction is local-only over local stores; no telemetry exporter, network sink, or remote read is introduced.
- Records are local, append-only, and bounded in content — an audit and cost trail, not a data hold.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Primary — the spawn boundary:** the deny-by-default allowlist closes the credential-inheritance exposure class: a spawned session receives exactly the declared variables, an undeclared parent variable (credentials included) is testably absent, and credentials resolve through the credential port at use time (F-5, AC-F5-2). The invariant is fail-closed both ways: undeclared parent variables cannot leak in, and an unresolvable declared reference refuses the spawn classified rather than falling back to ambient values (NFR-5).
- **Secret-read boundary extended:** the spawn path performs no ambient environment reads outside the established credential boundary — centralization stays mechanical, not conventional (NFR-9).
- **Read-only extraction:** harness stores are accessed read-only (query-only pragma; file reads) with bounded indexed queries — extraction cannot mutate, lock, or damage a live session or its store (DEC-5, NFR-3).
- **Escape-hatch discipline:** the adapters are the only sanctioned harness access path; agents never script a harness CLI directly, and raw harness access remains audited and off by default per the established primitive-surface rules.
- **No new credential path or vendor:** model access rides the harnesses' own provider configuration; the delivery side gains no credential kind and no network edge.
- **Allowlist review obligation:** the declared allowlist is reviewed data — review confirms it declares names and references only, never secret values (F-6, §20).
- **State integrity:** telemetry records ride the state layer's fence, permission, checksum, and torn-state discipline; a failed append is classified and never consumable as captured statistics (NFR-7).
- **Neutrality as a security property:** no harness-specific logic outside adapters means no engine can acquire an implicit harness privilege or bypass the descriptor (NFR-8, AC-F5-3).
- **Brand neutrality:** no product, binary, or harness literal is committed outside adapters and declared configuration; surfaces render injected names.

## 22. MAINTENANCE & OPERATIONS IMPACT

- Adding a harness is a new adapter plus a capability declaration behind the unchanged ports — no engine change (and, in M3-S1, a plugin generator); pi.dev or any further runtime enters through its evaluation spike, never by special-casing.
- Harness version pinning is standing maintenance: a harness upgrade that drifts its store schema surfaces as declared degradation warnings, not failures; operators read the warnings as the upgrade signal.
- Store locations, harness selection, and the environment allowlist are configuration edits with origin evidence; moving a store (or bind-mounting a shared one) is configuration, not code.
- The declared-gap vocabulary and the closed liveness signal kinds grow only by reviewed contract change — the extension points are explicit, not plugin surfaces.
- Closeout operators see one new disclosed capture outcome (captured / degraded / failed counts); a degraded or failed capture is an expected, classified verdict with the counts inline — not a closeout failure.
- Retro, spend, and metrics consumers join the telemetry events by work-item ref and run identity; the event log is their only source, and harness-store re-querying is retired by construction for captured deliveries.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Harness | The agent runtime that executes a delivery session (opencode, Claude Code); a provider domain behind the same primitive port surface as trackers, VCS, and CI (ADR-0008). |
| HarnessInstance | The typed identity of a configured harness: kind from a closed vocabulary, observed version, capability flags, and explicit gap records. |
| HarnessSession | The lifecycle port engines drive: spawn, deliver, resume/steer (where declared), collect, classify premature end, and harness-agnostic liveness. |
| Harness telemetry | Read-only session statistics extracted from harness stores at the closeout capture point: tokens by class, calls, tool usage, per agent and model, session-tree attributed to work items; persisted as harness-neutral events. |
| Execution-environment descriptor | Declared spawn-path data: the execution environment kind (host only, for now) and the deny-by-default environment allowlist the spawn env is built from. |
| Deny-by-default allowlist | The rule that a spawned session's environment is exactly the declared variable set — model routing, work paths, credential references resolved at use time — and nothing inherited. |
| Build-from-declaration | Spawn-environment construction that assembles the child env from the declared set alone, making "undeclared parent variable absent" a testable invariant. |
| Harness store | A harness's local statistics home: the opencode session database; Claude Code's local session files. Transient sources; never the durable record. |
| Session tree | The parent-child structure of a delivery's sessions; the tree root maps to the owning work item and anchors telemetry attribution. |
| Premature end | A session that ends before its work completes; classified through the shared harness-neutral classifier, identically for every harness. |
| Capability gap | A machine-readable declaration that a harness does not support a capability; absence of a flag is a gap, never implied parity; degradation is visible. |
| Headless spawn | Starting a harness session without an interactive harness UI — the Claude Code adapter's delivery mode. |
| Liveness signal kinds | The closed harness-agnostic vocabulary — session traffic, worktree activity, process — each adapter declaring which kinds it can source; unsourced kinds read declared-absent (unknown, never guessed). |
| Harness-neutral schema | The one statistics shape shared by all adapters' extractions, so aggregation never branches per harness. |
| Capture point | The closeout step that extracts and appends telemetry; idempotent, non-gating, durably disclosed. |
| Degradation warning | The explicit, disclosed marker that a telemetry field degraded (drift, absent source, missing cost); missing cost renders null with a warning — figures degrade, never fabricate. |

## 24. APPENDICES

### Appendix A — Design-baseline anchors

- **Ticket GH-233** (M1-S11): goal, tasks, five verbatim acceptance criteria, two pinned decisions (deny-by-default allowlist with use-time credential resolution; closeout telemetry in the state-layer event log with session-tree attribution), dependencies M0-S12/M0-S13 (both delivered), unblocks M1-S9/S12/S15/S19/S21.
- **Concepts:** harness-adapters (delivery side vs plugin side; supported-at-start harnesses; guardrails: harness-agnostic delivery contract, no harness logic in engines, escape-hatch rules, visible degradation); harness-telemetry (read-only extraction per store, captured statistics list, closeout-first capture points, drift discipline, cost-degrades-never-fabricates, events as the durable record); containerized-delivery "Compatibility with the current build" (execution-environment descriptor with host-only implementation; store locations from configuration; container identity keys already in the state schema; one event stream regardless of execution environment); credential-sidecar "Compatibility" (one credential-resolution port; adapters never read secrets directly).
- **ADR-0008 (harness adapter contract):** harnesses as a provider domain; DC-1..DC-5 (instance + capability flags; session lifecycle incl. resume/steer and liveness in-contract; generated plugin surface — M3-S1; closeout telemetry through the contract; configuration-based dispatch); C-1..C-5 constraints; the pre-registered revisit trigger this spec's OQ prose carries forward.
- **Backlog M1-S11** (canonical scope) and **backlog-ranking** — M1-S11's own rank-33 row ("The dispatch pilot needs the harness port"); the dispatch pilot M1-S9 ranks 39 — the recorded basis for DEC-1's boundary interpretation.
- **M1 planning pack:** the proposed `dispatch` contract (`--harness <name>`; config-supplied execution environment; "harness choice is config" scenario), the blocker-resume contract's acknowledged `resume-prompt-reentry` fallback "when the harness adapter lacks resume injection", and the retro/spend contracts reading the event log with "no harness re-query" — the consumer shapes this change's seams satisfy.
- **Primitive catalogue:** HarnessInstance (context, M1), HarnessSession (capability, M1), HarnessTelemetry (event, M1), HarnessPluginSurface (contract, M3 — out of scope); the HarnessInstance → HarnessSession → DispatchRun primitive chain this change implements the first two links of.

### Appendix B — Current-truth reuse map

| Reused truth | Source surface | What this change takes from it |
|---|---|---|
| Capability/gap declaration model (unlisted = declared gap, never implied parity) | Adapter ports (M0-S12) | The HarnessInstance capability vocabulary and every adapter's declaration posture |
| One credential-resolution port with use-time resolution; binding secret-read boundary | Adapter ports (M0-S12) | The spawn path's credential references and the extended ambient-read boundary (NFR-9) |
| Provider v1's parks and credential-port-only posture | Provider engine (M0-S13) | The precedent that provider credentials resolve through the port, never ambient reads |
| Additive record-kind pattern: payload-schema versioning, store-scoped keys, fences, verified post-append reads, no schema bump; the non-gating commit-telemetry precedent | State layer | The telemetry record kind (EVT-1/DM-1) and capture non-gating (DEC-6) |
| Idempotent terminal-outcome operations and classified, disclosed failure | Closeout transaction | The capture point's idempotency and non-gating disclosure (F-8, AC-F8-3) |
| Declared signals shape, corroboration-gated verdicts, signals-absent (unknown, never guessed) | Watchdog lane contracts (M1-S1) | The liveness discipline the harness-agnostic signal surface preserves; wiring unchanged until M1-S15 |
| Result tokens and the dispatch-session derivation class | Result contract / TDR-0005 | The classification vocabulary the shared neutral classifier emits (F-2, AC-F2-1) |
| Conformance registry, capability-gated flows, mock-tier merge-gate proof, scheduled read-only live tier | Adapter conformance suite | The identical-result-classification proof pattern at the port boundary (DEC-1, RSK-4) |
| Visible degradation instead of failure on unreadable/unknown-version payloads | Embedded metadata envelope (M0-S12) | The extraction drift discipline's degradation posture (NFR-6) |
| The bash-era session script (spawn/resume/list mapped to tickets; keys-env sourcing) | Scripted delivery stack | The behavior being ported into the opencode adapter (F-3) — and the credential-by-environment posture the allowlist replaces |

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-06 | @spec-writer | Initial specification from the PM planning session (clarify_scope validated), ticket GH-233, ADR-0008, the harness concepts, and the delivered current-truth specs; port boundary, adapter scopes, deny-by-default spawn construction, liveness surface boundary vs M1-S15, closeout capture discipline, and telemetry record shape pinned as DEC-1..DEC-10; zero blocking open questions |
| 1.1 | 2026-11-06 | @spec-writer | Iteration 2 remediation from DoR iteration 1 (NOT_READY). F-1 (dod_defined, blocking): added the change-specific Definition of Done (§17.1) binding all 12 ACs, all 9 NFRs, the §4.1 metric rows, the DEC-1 boundary reading with GAP-T1..T7 gap-record citations for the proxy-tested conditions, the quality-gate battery, one lockstep changeset, and the PR posture — 17 done conditions with per-item verification methods and delivering plan phases. Finding 2 accommodation: §17 capability-level TC mapping note so the test plan's session-listing case (TC-HARN-033) maps to F-3 without renumbering any AC or moving an existing TC home. Finding 3: DEC-1 and Appendix A citations corrected — rank 33 is M1-S11's own backlog-ranking row, the dispatch pilot M1-S9 ranks 39. Finding 4: ADR-0008 wording aligned to the decision register (register status: Proposed, ratified via M0-S17 delivery; status flip routed to @decision-advisor). Finding 5: §18 reconciliation list gains the result-contract and adapter-conformance feature specs. No AC renumbering; all existing IDs (F-, AC-, EVT-, DM-, NFR-, RSK-, DEC-) unchanged. |

---

## AUTHORING GUIDELINES

- Sources: ticket GH-233 (goal, tasks, AC, pinned decisions, design baseline), the PM planning summary and pm-notes scope interpretation (validated at clarify_scope), ADR-0008 (the harness adapter contract decision), the harness-adapters / harness-telemetry / containerized-delivery / credential-sidecar concepts, the primitive catalogue's harness rows, the M1 planning pack (dispatch, blockers, retro, spend contracts), the backlog M1-S11 entry and backlog-ranking rank 33, and the delivered current-truth specs (adapter ports, state layer, config layer, closeout, watchdog, result contract, conformance suite) plus the scripted stack as the porting source.
- Ticket-pinned decisions are recorded as decisions (DEC-2, DEC-3) or capabilities (F-5, F-7, F-8), never re-derived or contradicted; the pm-notes scope interpretation is recorded as DEC-1 with its backlog-ranking basis.
- Tech-neutral by design: no module names, file paths, or implementation steps; component-level homes appear only in the affected-components table, and the plan writer derives placement from the delivered package tiers and boundary rules.
- The two known unknowns (Claude Code headless inventory; concrete allowlist keys) are recorded with their pinned resolution mechanisms in §14 rather than as blocking open questions, because both are delivery-time discoveries or declared configuration data, not specification decisions.
- Quantified NFRs reuse the delivered reference values (65 536 bytes machine data, 4 096 bytes / 24 lines human summaries, `+N` truncation marks, bounded no-scan read budgets) so the change matches the system's established bounds discipline.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-233)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1–25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, EVT-, DM-, NFR-, RSK-, DEC-)
- [x] Acceptance criteria reference at least one F-/EVT-/DM-/NFR-/DEC- ID and use Given/When/Then
- [x] Change-specific Definition of Done present (§17.1) — binds all 12 ACs, all 9 NFRs, §4.1 metric rows, the DEC-1 boundary reading with GAP-T1..T7 citations for proxy-tested conditions, the quality-gate battery, one lockstep changeset, and the PR posture
- [x] Ticket AC covered with an explicit traceability line (AC 1 → AC-F2-1; AC 2 → AC-F2-2; AC 3 → AC-F5-1; AC 4 → AC-F5-2; AC 5 → AC-F8-1)
- [x] NFRs include measurable values (absence counts, budget bounds, byte/line caps, zero-fabrication and zero-duplication targets)
- [x] Risks include Impact & Probability (H/M/L) with mitigation and residual risk
- [x] Out-of-scope items prefixed `[OUT]` and name the owning stories explicitly (M1-S9, M1-S15, M1-S16, M1-S21, M2-S6, M3-S1, M3)
- [x] No implementation details (no code file paths, no step-by-step tasks, no git instructions)
- [x] Unresolved decisions: none — all specification-time decisions pinned as DEC-1..DEC-10; the two delivery-time discoveries carry pinned resolution mechanisms (§14)
- [x] Pinned ticket decisions preserved verbatim in DEC-2/DEC-3; ADR-0008 constraints (C-1..C-5) mapped to F-1/F-2/F-6/F-7 and NFR-8
- [x] Front matter validates per front_matter_rules
