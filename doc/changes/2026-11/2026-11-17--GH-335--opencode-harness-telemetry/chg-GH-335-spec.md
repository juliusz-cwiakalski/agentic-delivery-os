---
change:
  ref: GH-335
  type: feat
  status: Proposed
  slug: opencode-harness-telemetry
  title: "M3-S1: opencode v2.x harness and telemetry"
  owners: [engineering]
  service: delivery-os harness plane (harness port, opencode adapter, version gate, profile propagation, telemetry extraction)
  milestone: "M3: Harness and tracker integrations"
  labels: [m3, harness, opencode, telemetry, version-gate, conformance, decision-record]
  version_impact: minor
  audience: internal
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - harness adapter seam (GH-233 / M1-S11) — HarnessInstance, HarnessSessionPort, streaming JSONL spawn, deny-by-default spawn environment, profile record map, conformance registry
      - harness telemetry v2 (GH-291 / M2-S14) — delivery.harness.telemetry.v1 records, per-step ingest, closeout capture, spend read side
      - provider profiles and environment records (GH-234) — per-seat model derivation and the data-v1 record contract
      - dispatch engine (GH-239) — the first production consumer of the session port
      - result contract and error table (GH-172) — closed error table, envelope, exit projection, remediation hints
      - state layer (GH-174) — fenced verified appends and versioned record kinds
      - configuration layer and inspection (GH-173) — the typed harness branch
      - decision records (doc/decisions) — the in-change TDR obligation
    external:
      - opencode harness v2.2.5 (observed at intake) — version output `opencode v2.2.5`; `run --format json`, `--session`, `--agent`, `--model provider/model#variant`, `session list`; `--standalone` / `--server` / `service` / `serve` / `api` / `acp` mode surfaces; configuration-document inputs (`OPENCODE_CONFIG`, `OPENCODE_CONFIG_CONTENT`, `OPENCODE_CONFIG_DIR`) with `{env:NAME}` interpolation; a SQLite session store in the harness data directory with `session` and `session_v2` generations (Appendix C)
links:
  issue: https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/335
  related_changes: ["GH-233", "GH-234", "GH-239", "GH-275", "GH-291", "GH-342"]
  related_decisions: ["ADR-0008", "TDR-0016", "TDR-0021", "TDR-0031", "TDR-0032"]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make opencode v2.x a version-gated, mode-decided, profile-propagating delivery harness whose sessions land schema-versioned per-seat telemetry in the state layer — so a dispatch either runs with the resolved profile or refuses with a typed, actionable identity instead of guessing.

## 1. SUMMARY

This change delivers milestone story M3-S1. It extends the delivered harness seam additively with four things the harness cannot state today: a supported-version window evaluated before any session exists, with typed refusals instead of an unexamined pass, and a single production probe point whose output grammar and normalization are pinned; one explicitly decided integration mode for opencode dispatch, recorded as a decision and drawn from the mode surfaces the installed harness actually exposes; per-spawn propagation of the resolved seat binding on a surface the harness honours — one seat per spawn, resolved from the agent the run names; and per-seat telemetry attribution — seat identity, resolved model, tokens, cost, and store-sourced durations — landing in the state layer under the existing schema identity, with the version the session record itself states stamped on every row and the delivery bound by the session identities the run holds and the binding it recorded. Telemetry absence, degraded capture, and extraction failure stay three distinct classifications inside the delivered envelopes; no command surface is added. The delivered conformance registry gains scenarios for the three refusal and propagation properties while its six-scenario classification floor stays as delivered. Both delivery dependencies (M1-S11, M2-S14) are delivered current truth, so this change extends a live seam rather than creating one.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **The harness seam is delivered.** `HarnessInstance` carries a closed kind, an injected `observedVersion` (`null` is the explicit unknown value and always rides the `version-probe-failed` warning), and a capability declaration with explicit gaps. `HarnessSessionPort` carries spawn, deliver, resume, collect, classify, liveness, and read-only session listing; `steer` is a closed operation in the vocabulary and a steering payload on `deliver`/`resume`, not a separate port member. The opencode adapter spawns the harness, decodes its JSONL stdout line by line, acquires the handle on the first identified session line — so the dispatch holds the session identity it ran — keeps draining to process close, and resumes by session identity. The shared classifier is harness-neutral; adapters classify nothing themselves.
- **The installed harness and its store are observed, not assumed.** The harness on `PATH` reports `opencode v2.2.5` on stdout, exit 0, empty stderr: a product name, a `v` prefix, and a newline-terminated bare semantic version. Its session store is the SQLite file in the harness's own data directory (`~/.local/share/opencode/opencode.db` on the observation host), not the harness state directory the delivered default names. Two session generations coexist: a legacy `session` table with `message`/`part` children, and a current `session_v2` table with `session_message`/`session_part` children. Every session created under v2.2.5 lands in the current generation (268 in the last day at observation; the legacy table's newest row predates it). A session row records the harness version that created it (`session.version`, a bare semver — `2.2.5`, `1.19.0`, and `1.19.3` coexist in one store), the agent, the model as a structured provider/model object, cost, the five token classes, and start/end timestamps. An assistant message records its agent, model, cost, tokens, and timestamps inside a JSON payload that also carries conversation content; agent and model switches are separate metadata events. The store has no work-item or ticket column anywhere, no separate harness-version column, and no populated tool-call table for the current generation.
- **The spawn environment is deny-by-default.** The child environment is built from the declared allowlist alone. A declared variable entry is required unless it carries the variable-only optional marker; a credential entry resolves through the credential port at use time. An optional validated data-record map from profile resolution may supply values for declared variable names: a record value takes precedence over the injected parent environment, and an undeclared record name changes nothing.
- **Per-seat model derivation exists as data, with no observed consumer.** Profile resolution derives a per-seat model environment record (`OC_<PREFIX>_AGENT_<SEAT>_MODEL`, or the seat's explicit `envName`), serialized and validated under the data-v1 record contract. The record map is derived and validated; nothing in the delivered dispatch path asserts that it reaches an opencode spawn, and no test proves the spawned session runs the resolved per-seat models. The installed harness exposes no such variable family at all: its environment surface accepts only its own `OPENCODE_*` variables, and per-agent models are selected through its configuration document (where a value may interpolate an environment variable) or per invocation. The derived name is therefore a convention with no consumer on this harness.
- **Version identity is observed but never evaluated.** The configured-kind registry resolves an instance from an injected version probe; a failed or empty probe yields `null` plus the warning. No component compares the observed version to a supported window, no component refuses on it, and the closed harness failure vocabulary carries nine identities — none for a version or a mode refusal. No production path invokes the registry resolution today, so the probe seam has no production owner and is exercised by tests only.
- **Telemetry v2 is delivered without seat attribution or durations.** `delivery.harness.telemetry.v1` rows carry work item, run, session, harness kind and version, agent, model, tree root, parent chain, the five token classes, calls, bounded tool counts, cost (null when missing, never zero), an injected capture timestamp, and closed-vocabulary warnings. Rows are captured at closeout and, per step, during the opencode stream into additive state records; bounded read-only queries only. A row has no seat identity, no resolved-versus-observed model comparison, and no duration. More seriously, the delivered extractor and the per-session totals read query a store shape that no observed store has: a work-item column and a harness-version column on the session table, token/agent/model columns on the message table, and a tool column on the part table. None of those columns exists, and current sessions live in a different table generation, so a capture against a real store fails as extraction failure and lands zero rows while the fixture-built tests stay green.
- **Integration mode is implicit.** The delivered adapter starts one harness process per spawn and reads the harness session store read-only for telemetry. That behavior is a mode in fact, but no mode is declared, configured, refused, or recorded as a decision, and `doc/decisions/` contains no integration-mode record.
- **Conformance is a six-scenario classification floor.** The registry registers exactly the two shipped harness kinds and fails a harness that misses a floor scenario. There is no version-window scenario, no mode scenario, and no profile-propagation scenario.
- **Planning truth.** Backlog M3-S1 and milestone pack EC-1 define goal, tasks, and AC; `m3/contracts.md` declares the extended harness port and three typed refusals; `m3/test-scenarios.md` pins TC-M3-HARNESS-001 and TC-M3-HARNESS-002. Open question Q-06 in GH-342 (opencode version window) is unanswered, so its stated default applies.

### 2.2 Pain Points / Gaps

- **G1 — No supported-window evaluation and no typed refusal.** `m3/contracts.md` declares `harness.version.unsupported`, but the closed failure vocabulary has no such identity and no code path compares an observed version to a window. An out-of-window or unknown harness today proceeds as if compatible.
- **G2 — Per-spawn profile propagation is unproven and mis-targeted.** The per-seat record derivation exists, but the dispatch path does not state how the resolved binding reaches the spawn, that a record value beats the ambient parent environment, what happens to undeclared record names, or what is refused when a required seat model cannot be expressed. The installed harness exposes no per-seat model variable family, so the delivered convention has no consumer on this harness.
- **G3 — Integration mode is undecided and unrecorded.** A per-invocation private server, the managed background service, and a client to a running server are all exposed by opencode v2.2.5; no spike, no decision record, no configuration expression, and no refusal for an unavailable mode exist.
- **G4 — Telemetry carries no seat, no resolved-model comparison, and no durations.** The ticket AC requires per-seat models and durations beside schema version, tokens, and cost; the delivered row shape expresses none of the first two and only the second conditionally.
- **G5 — Conformance cannot see the new properties.** The registry's scenarios cover classification outcomes only, so a regression in version gating, mode refusal, or profile propagation would pass the suite.
- **G6 — An adapter-contract change without its governing record.** The repository rule (TDR-0016, TDR-0021 precedent) is that a harness adapter-contract change is governed by a recorded decision; neither the mode decision nor the contract refinements have one.
- **G7 — The telemetry path reads a store shape that does not exist.** The delivered extractor and per-session totals read assume work-item, harness-version, per-message token/agent/model, and tool columns; the observed store has none of them and keeps current sessions in a different table generation. A capture therefore cannot land a row, and the failure is indistinguishable from a genuinely empty delivery unless the store contract and the absence taxonomy are stated.

## 3. PROBLEM STATEMENT

Because the harness port observes a version without evaluating it, propagates the resolved profile through a surface the installed harness does not consume, and captures telemetry through a store shape no observed store has, a dispatch cannot state that it ran the resolved per-seat models on a compatible harness — so an incompatible or unknown harness proceeds unannounced, a profile can be silently ignored, and the statistics the learning plane consumes cannot attribute cost and time to the seat that produced them. The current fixtures hide this because they encode the inferred shape rather than the observed one.

## 4. GOALS

- **G-1**: A supported-version window is evaluated for every dispatch before any session exists, and versions outside it refuse with the declared typed identity.
- **G-2**: An undeterminable version stays an explicit unknown and refuses distinctly — never a fabricated version, never a silently permissive pass.
- **G-3**: Exactly one integration mode is the delivered default for `delivery-os`/`jaiship` dispatch, expressed through configuration, decided by an in-change spike, recorded in a decision record, and refused with a typed identity when an unavailable mode is requested.
- **G-4**: The resolved profile's seat binding for the agent a spawn names reaches that spawn through a surface the harness actually honours — for opencode, the observed per-invocation agent/model selection — as exactly one seat per spawn (N seats are N spawns); it wins over the ambient parent environment for declared names, changes nothing for undeclared names, and refuses with a typed identity when a required seat model cannot be expressed on that surface or the named agent has no assigned seat.
- **G-5**: Resume and attach continue an existing session identity under the same propagation contract, without forking the tree root.
- **G-6**: Telemetry rows land in the state layer, sourced from the store's own session and message facts and attributed to the delivery by every session identity the run holds, with the recorded binding supplying the seat, the schema identity, the version the session record itself states, the resolved per-seat model, the five token classes, cost, and store-sourced durations — additively within the existing schema identity. A capture that lands zero rows for a session the dispatch ran and the store can read is a failure, not a pass.
- **G-7**: Conformance against the harness port gains the version-window, mode-refusal, and profile-propagation properties without altering the delivered six-scenario classification floor.
- **G-8**: The adapter-contract refinements and the integration-mode selection are recorded as decision records and reconciled into the harness feature spec.
- **G-9**: Telemetry absence, degraded capture, and extraction failure stay three distinct classifications inside the delivered capture and read envelopes, with no new command surface and no change to a delivery's exit code.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Version gate coverage (TC-M3-HARNESS-002) | 100% of dispatch attempts evaluate the supported window before a session-bearing child process starts (the single bounded version probe is the declared exception); zero sessions spawned on a refused version |
| Typed-refusal conformance | 100% of version, mode, and profile refusals carry a closed identity from the error table with a declared exit projection and a non-empty remediation hint; zero generic failures |
| Profile propagation (TC-M3-HARNESS-001) | Every spawn that binds a seat carries exactly one `--agent` and exactly one `--model` — the seat the resolved profile assigns to the agent the run names — on a surface the harness honours. A profile's N seats are exercised by N spawns, each its own session and its own row set; zero bound spawns unattributed, and every unbound (role-less) run is disclosed as `unresolved-seat`. A human-gated live observation on an invocation that names an agent confirms the spawned session reports that seat's resolved model |
| Telemetry completeness | 100% of rows for a session the dispatch ran carry the schema identity, the session's own harness version, and the seat identity and resolved model from the run's recorded binding, or an explicit null seat with the `unresolved-seat` warning where the run bound none or the group's observed agent differs from the binding's agent; durations come from store timestamps or are explicitly absent with a warning — never estimated; a zero-row capture for such a session is a failed criterion |
| Observed-shape extraction | 100% of capture and totals tests run against a store fixture derived from the recorded v2.2.5 contract; zero assertions depend on a work-item column, a separate harness-version column, or per-message token columns |
| Absence honesty | Absence, degraded capture, and extraction failure are three distinct classifications; none is projected as a zero-valued row or as a clean pass |
| v1/v2 compatibility | Zero removals or renames in `delivery.harness.telemetry.v1`; all pre-change rows remain readable unchanged |
| Unknown-version honesty | 100% of undeterminable-version dispatches refuse with the distinct unknown identity; zero fabricated version strings, zero silent passes |
| Determinism | Byte-identical output for identical injected harness facts, version probe result, and clock |
| Offline verification | 100% of new automated tests run offline against simulated harness I/O and fixture stores; zero live harness invocations, credentials, or network. One human-gated live observation is permitted outside CI and is never an oracle |

### 4.2 Non-Goals

- **NG-1**: Extending the Claude Code adapter — it stays registered as a generated-artifact/compatibility surface and is not a delivery harness in M3 (OQ-M3-01).
- **NG-2**: Running more than one integration mode concurrently, or falling back between modes at runtime.
- **NG-3**: A telemetry schema version bump, structural change, or field removal (OQ-M3-07: additive only).
- **NG-4**: Backfilling historical sessions with seat or duration facts.
- **NG-5**: Harness store writes of any kind, including harness-side configuration mutation to force model selection.
- **NG-6**: Provider profile resolution, model selection, pacing, nomination, or cost normalization — delivered elsewhere and consumed here as input.
- **NG-7**: Tracker work (M3-S2/S3/S4), the parity/trap-catalog suite (M3-S5), and multi-tracker composition (M3-S6).
- **NG-8**: Background-service supervision, daemonization, or health management of the harness itself.
- **NG-9**: A new CLI command surface; the change extends existing dispatch and configuration resolution paths.
- **NG-10**: Requiring the harness to honour a per-seat model variable family, or introducing one on the harness's behalf; propagation is expressed only on surfaces the harness honours.
- **NG-11**: Attributing store sessions to a delivery by a store column, a title heuristic, or a store-wide scan; and recovering any telemetry field by reading conversation content, message bodies, part payloads, or tool output.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Supported-version evaluation and typed refusal | EC-1 and the ticket AC require an unsupported harness to refuse; today it proceeds unexamined (G1) |
| F-2 | Explicit integration mode with a recorded decision | The ticket makes the spike and its record a deliverable; the mode must be observable, configurable, and refusable (G3) |
| F-3 | Per-spawn profile model propagation | The ticket AC is "runs with the resolved profile"; propagation must be a stated contract, not an accident of naming (G2) |
| F-4 | Resume and attach under the same profile contract | Spawn without resume leaves long deliveries unable to continue a session with its profile intact (G2) |
| F-5 | Per-seat telemetry rows from the observed store contract, with version and durations | The statistics plane needs seat-attributed model, tokens, cost, and time facts, and the delivered path reads columns that do not exist (G4, G7) |
| F-6 | Classified telemetry absence and degradation inside delivered envelopes | Absence must stay distinguishable from failure and from a zero-valued row, without inventing a command surface (G7, NG-9) |
| F-7 | Harness-port conformance extension | Without scenarios the new properties can regress silently (G5) |

### 5.1 Capability Details

- **F-1 Supported-version evaluation and typed refusal.** A supported window is declared as data: the current minor line at delivery time plus one previous minor — at intake, the `2.2.x` line plus `2.1.x`, derived from the observed `v2.2.5`. The window is evaluated once per dispatch at harness resolution, before any session-bearing child process exists, and the evaluation result is carried on the instance so every consumer reads one verdict. An observed version inside the window proceeds; an observed version outside it refuses with `harness.version.unsupported`, naming the observed version and the supported window; a version that cannot be determined refuses with `harness.version.unknown` (DEC-3), never with a fabricated version and never as a permissive pass. There is exactly one production probe point: the dispatch path's harness resolution. Today no production code invokes that resolution, so this change makes the dispatch path its owner and no other production path probes the harness. The accepted probe output is the harness's version line, normalized to a bare semantic version — the observed `opencode v2.2.5` normalizes to `2.2.5` — and the raw line is retained only as diagnostic, never as the stamped version. Empty output, a non-zero exit, a timeout, multiple lines, or any line outside the accepted grammar is an indeterminate version: never a substring match, never a partial version, and never a permissive pass. The probe is one bounded, shell-free invocation per dispatch; it completes within its bound and is reaped, and a probe that cannot answer within the bound is an indeterminate version, never a retry loop. No configurable window ships in this change and no configuration key widens or narrows it; should a configurable window be introduced later, an absent, malformed, or unsupported configured value degrades to this pinned default — never to an unbounded or silently wider window.
- **F-2 Explicit integration mode with a recorded decision.** The spike chooses among the mode surfaces the installed harness actually exposes: a per-invocation private server (the `--standalone` flag — the observed default on the observation host, where the harness on `PATH` is a wrapper that prepends it), the managed background service (`service start|restart|status|stop`), and a client to a running server (`--server`, `api`; the harness's `serve` starts that server). The spike records its outcome as a decision record, including the read-only direct-store access the telemetry path needs. Exactly one mode is the delivered default for `delivery-os`/`jaiship` dispatch; the others are declared and refuse with `harness.mode.unavailable`, naming the requested and the available mode. The mode is expressed as a declared value on the harness configuration branch (absent → the delivered default with a `defaults` origin) and is never inferred from ambient state. A dispatch never falls back from one mode to another: a fallback would make the decision unobservable and double the tested surface (DEC-2).
- **F-3 Per-spawn profile model propagation.** For every spawn, the resolved profile's seat binding is carried into the spawn as data and expressed on a surface the harness honours; one spawn binds exactly one seat. The contract is harness-neutral and surface-mapped: the binding record is the contract (DM-4), and each adapter maps it onto the surface its harness honours — for opencode the per-invocation agent/model selection (one `--agent` and one `--model` per invocation), for a harness that consumes declared variables the declared variable name (`envName`, or the derived name). The per-spawn binding is supplied as data on the spawn call, never through process-global state, and the environment build receives the per-spawn record map alongside the descriptor. A declared record value wins over the injected parent environment for a declared name; an undeclared record name changes nothing and never widens the deny-by-default allowlist.
  - **Cardinality.** One spawn ⇔ one seat. The binding carries exactly one seat and is not a seat map, so a caller cannot express several seats on one invocation even by mistake. A profile's N seats are exercised by N spawns — each its own session, its own held session identity, and its own row set. A resume continues the seat its spawn declared; it never adds one.
  - **Resolution input and outcomes.** The seat is resolved from the agent identity the spawn names — the value the harness receives as `--agent` and records as the session agent — never from ambient state. Resolution is a pure lookup over the resolved profile: `agentOverrides[agent]`, else the seat whose name equals the agent, else the profile's single declared seat. For a spawn that names an agent there are exactly two outcomes: a **binding** (the seat, the agent identity it was resolved for, and that seat's resolved model — the pacing-applied model where pacing applied, else the seat's declared model), or an **`unassigned` refusal** — a spawn naming an agent that a multi-seat profile assigns no seat refuses before any session exists with the delivered `provider.profile.invalid` identity (no new identity, no attempt record, no telemetry row), naming the agent, the profile, and the declared seats in the bounded error summary, with the remediation "declare `agentOverrides` for this agent, or run a single-seat profile" (`detail.harness` stays reserved for the four new pre-session harness identities, TDR-0031). A spawn that names no agent is the unasked state, not a resolution: it binds nothing (`no-agent`), no `--agent`/`--model` is sent, the harness default runs, and the run is recorded and disclosed as `unresolved-seat` with a null seat — never an inferred seat, and never a first-declared fallback presented as the run's seat.
  - **Carrier map (opencode).** The opencode harness exposes no per-seat model variable family, so the per-invocation selection is what carries the binding there. Agent identity → `--agent <agent>`, exactly once: the harness agent name, and never the seat name when the two differ. Resolved model → `--model <provider>/<model>[#<variant>]`, exactly once, with `#<variant>` appended only when the model declares one. Seat identity → no invocation carrier: it is recorded on the run (DM-4) and stamped on the row (DM-5); sending a seat name as `--agent` would send a value the harness may not know.
  - **Refusal.** A resolved model that cannot be expressed as `provider/model[#variant]` — an empty provider or model segment, a missing separator, whitespace or control characters that would corrupt the argument, or a value beyond the adapter's declared bound — refuses with `harness.profile.model-unrepresentable` naming the seat, before any session exists; never a silenced seat, never a guessed value. An agent or model the harness does not recognise is not a pre-session refusal (DEC-14): it is the harness's own classified spawn failure, and any disagreement between the recorded binding and the harness report is disclosed as a divergence rather than reconciled. The propagation contract is identical for spawn, deliver, and resume so a resumed session keeps the profile its spawn declared.
- **F-4 Resume and attach under the same profile contract.** A resume continues the caller's session identity and preserves the tree root; an attach resolves an existing session from the read-only, bounded session listing before resuming, and spawns nothing. A resume that identifies a different or absent session keeps the delivered `harness.session.unknown` semantics and kills its stream idempotently. Where a resumed session's original descriptor is available, its propagation contract is reused rather than re-derived.
- **F-5 Per-seat telemetry rows from the observed store contract, with version and durations.** Every landed row is bound to the delivery by every session identity the run holds — one per spawn/resume, the identities the adapter acquired when it spawned or resumed — together with the run's recorded binding for the seat claim, and never by a store column that names a work item; the store supplies the session tree below each held identity through its parent links. Rows stamp the schema identity; the harness version the session record itself states, normalized, with a null and a warning when the record states none; the seat and the resolved model from the run's recorded binding (DM-4); the harness-reported agent and observed model from the session row and per-message metadata, with the session row as the baseline and the switch events as the transitions; the five token classes and calls; the store-reported cost; and durations taken from the store's own start/end timestamp pairs. Divergence is disclosed on both axes with both values kept — never reconciled by overwriting: model divergence (resolved ≠ observed) and agent divergence (the binding's agent ≠ the observed agent, the signal that the harness did not run the named agent). The binding's seat attaches only to the group whose observed agent equals the binding's agent; any other group of that session carries a null seat with the `unresolved-seat` warning, and a run that bound no seat carries a null seat with the same warning — never a guessed or re-derived seat. A divergence between the dispatch-probed installed version and the session's stored version is disclosed the same way; neither is overwritten. A cost the store reports as zero is recorded as the reported zero (free models are observed to report zero cost with non-zero tokens); a store that exposes no cost source yields null with the delivered cost warning — a missing cost is never replaced by zero. A duration the store's timestamp pair cannot express is explicitly absent with a warning and is never derived from the capture timestamp or estimated. Tool-call counts are carried only where the store exposes a populated tool source; where it does not, they are absent with a warning and are never recovered by reading conversation content. A capture that lands zero rows for a session the dispatch ran and the store can read is a capture failure, never a clean pass and never a silent absence. Ingestion remains bounded and read-only, riding the delivered extraction and per-step ingest seams.
- **F-6 Classified telemetry absence and degradation inside delivered envelopes.** Telemetry absence is a classification, not an error and not a zero: a session the dispatch ran for which the store yields no rows is disclosed as absence with its reason, inside the delivered capture and read envelopes. A readable store that yields zero rows for such a session is a capture failure, not absence. An unreadable or unopenable store keeps the delivered `harness.telemetry.extraction-failed` identity and is never re-projected as absence. Optional-field drift continues to degrade with a warning and never hard-fails. On the read side, the delivered `spend.telemetry-absent` meaning is the work-item-scoped absence identity and is untouched. The change adds no command, verb, or exit projection for telemetry (NG-9), and closeout capture stays non-gating: a failed or absent capture writes no zero-valued record and changes no other closeout effect.
- **F-7 Harness-port conformance extension.** The registry's six-scenario classification floor for exactly the two registered kinds stays as delivered and keeps passing. New scenarios are registered per harness: version refusal inside and outside the window, unknown version, mode unavailable, and profile propagation (the resolved binding is carried on the honoured surface and the session's reported model is compared where the harness reports one). A registered harness missing a newly declared scenario fails the suite; a new refusal identity with no scenario fails the suite. The extension is data on the registry, not a forked conformance path.

## 6. USER & SYSTEM FLOWS

```
Flow 1: Dispatch resolution, version probe, and mode
  dispatch resolves harness settings (kind, mode, stores, allowlist)
  → the single production probe point runs one bounded, shell-free version
    probe and normalizes its output (opencode v2.2.5 → 2.2.5)
  → window evaluation:
      inside window   → instance carries the verdict, continue
      outside window  → refuse harness.version.unsupported (exit 1), no session
      indeterminate   → refuse harness.version.unknown (exit 1), no session
    (the probe is the only child a refusal allows; it completes and is reaped)
  → mode resolution: declared or delivered default; unavailable → harness.mode.unavailable

Flow 2: Spawn with the resolved profile
  the run names an agent identity (the value sent as --agent)
  → profile resolution yields the seat assigned to that agent → that seat's
    resolved model; the binding carries exactly one seat (its agent identity,
    its seat, its resolved model)
  → binding carried on the spawn call as data
  → expressed on the surface the harness honours: one --agent, one --model;
    environment built: record value wins, undeclared names change nothing
  → agent named, no seat assigned  → provider.profile.invalid (no spawn)
  → seat model inexpressible       → harness.profile.model-unrepresentable
                                     (no spawn)
  → no agent named                 → nothing bound; run recorded and
                                     disclosed as unresolved-seat, harness
                                     default runs
  → session spawns, handle acquired on the first identified line, stream drains
  → a further seat is a further spawn: its own session, its own rows

Flow 3: Resume / attach
  existing handle or bounded read-only session listing → resume the same identity
  → same descriptor and propagation contract, tree root preserved
  → unknown/different session → harness.session.unknown, idempotent kill

Flow 4: Telemetry landing
  the run holds every session identity it spawned or resumed
  → bounded read-only store read of each held session and its tree (current or
    legacy generation), projecting only non-content fields
  → rows with schema identity, the session's own version, the seat and resolved
    model from the run's recorded binding, the observed agent and model, tokens,
    cost, store-timestamp durations; a group whose observed agent differs from
    the binding's agent carries no seat and warns
  → divergence or missing field → closed-vocabulary warning, value kept or absent
  → seat the run never declared (role-less run) → null seat, unresolved-seat
  → fenced verified append to the state ledger (non-gating)
  → zero rows for a session the dispatch ran → capture failure, never a pass
  → no rows for a session the store does not hold → classified absence
  → unreadable store → extraction-failed; the spend read side says spend.telemetry-absent

Flow 5: Conformance
  registry → six delivered classification scenarios + new version/mode/profile scenarios
  → simulated harness I/O only → missing scenario or undeclared identity fails the suite
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The supported-version window as data, evaluated once per dispatch at a single production probe point, with the probe output grammar and normalization pinned, and `harness.version.unsupported` and `harness.version.unknown` refusals before any session exists.
- The integration-mode spike over the mode surfaces the installed harness exposes (per-invocation private server, managed background service, client to a running server, including read-only direct-store access for token/usage analytics) plus its recorded decision.
- Exactly one delivered default mode, its configuration expression, and `harness.mode.unavailable` for any other requested mode.
- Per-spawn propagation of the resolved seat binding on a surface the harness honours — one seat per spawn, resolved from the agent the run names, with a further seat being a further spawn — precedence over the ambient parent environment, undeclared-name neutrality, and the two pre-session profile refusals: `harness.profile.model-unrepresentable` for a seat model that cannot be expressed on that surface, and the delivered `provider.profile.invalid` for a named agent the profile assigns no seat.
- Resume and attach under the same propagation contract, with the delivered `harness.session.unknown` semantics preserved.
- Per-seat telemetry attribution sourced from the observed store contract: the seat and resolved model from the run's recorded binding beside the harness-reported agent and model, with divergence disclosed on both axes, store-sourced durations with explicit absence, and the session's own harness version on every row — additive within `delivery.harness.telemetry.v1`, attributed by every session identity the run holds.
- Reconciliation of the configured opencode store location with the harness's own declared data directory and its documented store override, with a classified outcome when the resolved path is absent.
- Classified telemetry absence, degraded capture, and extraction failure disclosed inside the delivered capture and read envelopes — with no new command surface — and the delivered non-gating closeout semantics preserved.
- Error-table rows for every new identity with a stable code, exit projection, and remediation hint; `HARNESS_FAILURE_CODES` extended additively.
- Conformance registry extension covering the version-window, mode, and profile scenarios, with the delivered six-scenario floor unchanged.
- Decision records for the adapters-contract refinements and the integration mode, linked from this change and the harness feature spec.
- Tests proving TC-M3-HARNESS-001, TC-M3-HARNESS-002, and every acceptance criterion that is provable offline, against simulated harness I/O and fixture stores derived from the observed store contract; the human-gated live observation is recorded separately and is never a CI oracle.

### 7.2 Out of Scope

- [OUT] Claude Code adapter extension or parity: it stays a registered generated-artifact surface, not a delivery harness (OQ-M3-01).
- [OUT] Concurrent multi-mode operation, runtime mode fallback, or mode auto-detection from ambient state.
- [OUT] Harness-side configuration mutation to force model selection (writes to the harness's own configuration or store).
- [OUT] A telemetry schema bump, structural re-shape, or field removal (OQ-M3-07).
- [OUT] Backfill of seat or duration facts onto pre-change sessions.
- [OUT] Provider profile resolution, model nomination, pacing, and cost normalization — consumed as input only.
- [OUT] Tracker adapters (M3-S2/S3/S4), the parity and trap-catalog suite (M3-S5), and multi-tracker routing (M3-S6).
- [OUT] Background-service supervision, daemonization, or health management of the harness process.
- [OUT] A new CLI command surface; existing dispatch and configuration paths are extended.
- [OUT] Introducing or requiring a per-seat model environment-variable family in the harness; propagation is expressed only on surfaces the harness honours (NG-10).
- [OUT] Attributing store sessions to a delivery by a store column, a title heuristic, or a store-wide scan (NG-11).
- [OUT] Recovering any telemetry field by reading conversation content, message bodies, part payloads, or tool output (NG-11, NFR-5).
- [OUT] Currency conversion, re-pricing, or cross-model cost normalization.

### 7.3 Deferred / Maybe-Later

- A configurable supported-version window once a second harness or a second delivery line exists.
- Any mode not selected as the default, if a later story needs it (would need its own decision and test surface).
- Background-service lifecycle management for a long-lived harness instance.
- Telemetry v3 if a future harness cannot express seat or duration facts as fields.
- Claude Code per-seat propagation if it ever becomes a delivery harness.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — no public HTTP surface is added or changed. If the chosen integration mode reaches the harness through a local service endpoint, that transport is internal to the adapter and is not a `jaiship` surface: no client-facing endpoint, no listening port opened by this tooling, and no network contract is introduced.

### 8.2 Events / Messages

| Direction | Element | Contract |
|-----------|---------|----------|
| Outbound | Version probe invocation | One bounded, shell-free invocation of the harness's version surface at the single production probe point; accepted output grammar is a product token followed by an optional `v` and a three-part semantic version, newline-terminated (observed: `opencode v2.2.5`); normalized to the bare semantic version (`2.2.5`); empty, non-zero, timed-out, multi-line, or non-matching output is indeterminate; the probe completes and is reaped; no session, no prompt, no declared-allowlist bypass |
| Internal | Per-spawn profile binding | Exactly one seat per spawn: the agent identity the run names, the seat the resolved profile assigns to that agent, and that seat's resolved model, supplied as data on the spawn call (not through process-global state); each adapter maps it onto the surface its harness honours — opencode: one `--agent` and one `--model` on the invocation; a variable-consuming harness: the declared variable name; the seat identity itself has no invocation carrier and is recorded on the run; record values win for declared names; undeclared names change nothing; a named agent no seat is assigned refuses before any session, and a spawn naming no agent binds nothing |
| Inbound | Harness JSONL stream | Unchanged read-only consumption over the delivered streaming seam; the change adds no frame-parsing contract beyond the delivered step/evidence decoding |
| Storage | Session-store read | Read-only, query-only, bounded indexed reads of every session identity the run holds and its tree, across the observed store generations; only non-content fields are projected (session metadata, per-message usage metadata, switch events); conversation content, message bodies, part payloads, and tool output are never selected or emitted |
| Storage | `harness.telemetry` rows | Additive fields (seat identity and resolved model from the run's recorded binding, harness-reported agent and observed model, store-sourced durations) under the unchanged `delivery.harness.telemetry.v1` identity; the schema identity and the session record's own normalized harness version are stamped per row |
| Derived | Refusal and capture disclosure | Every version, mode, and profile refusal names the identity, the observed/requested value, the supported or available alternative, and a remediation hint; the four new pre-session harness refusals carry the declared `detail.harness` member, while the unassigned-agent refusal (a delivered `provider.profile.invalid`) carries its agent/profile/seat facts in the bounded error summary and adds no envelope member; capture outcomes ride the delivered envelope and its declared slots — an additive envelope member requires a declared addition with its own bound and test, never a silent drop |

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Supported-version window | The declared minor lines a harness may run on; carried as data with the evaluation verdict; ships one pinned default |
| DM-2 | Version evaluation result | The verdict (inside, outside, indeterminate) with the observed version (or explicit unknown) and the warning that rides an unknown |
| DM-3 | Integration-mode declaration | The declared mode, its origin (default or configured), and the closed vocabulary of modes a dispatch may request |
| DM-4 | Profile propagation record | Per spawn, exactly one seat: the agent identity the binding was resolved for, the seat the resolved profile assigns that agent, and that seat's resolved model (pacing-applied where pacing applied), plus the declared model variable name where a harness consumes variables; carried on the spawn as per-spawn data, mapped to the surface the harness honours, and recorded on the run so capture cites the seat the run declared rather than re-deriving it |
| DM-5 | Seat telemetry attribution | Additive row fields: the seat and resolved model from the run's recorded binding (DM-4) beside the harness-reported agent and observed model, with divergence disclosed on both axes — model (resolved ≠ observed) and agent (binding agent ≠ observed agent) — and neither value overwritten; the binding facts attach only to the group whose observed agent equals the binding's agent, every other group carrying a null seat with `unresolved-seat`; never sourced from a work-item column |
| DM-6 | Duration fields | Additive per-row durations (start, end, elapsed) taken from the store's own start/end timestamp pairs; explicit absence with a closed warning when the pair is unavailable; never derived from capture time and never estimated |
| DM-7 | Conformance scenario set | The delivered six-scenario floor plus the version-window, unknown-version, mode-unavailable, and profile-propagation scenarios |
| DM-8 | Store-to-delivery binding | The attribution key is every session identity the run holds — one per spawn/resume, and exactly one for a delivered attempt — plus the run's recorded binding (DM-4) for the seat claim; the store supplies the tree below each held identity through parent links; no store column names the work item |
| DM-9 | Harness-version stamp source | The normalized version the session record itself states; the dispatch-probed installed version is a separate disclosure; a divergence is warned, never reconciled |
| DM-10 | Observed store contract | The table, column, and field inventory recorded in this change, from which every extraction fixture is derived |

**Observed opencode v2.2.5 store contract (current truth; see Appendix C).** The store is a SQLite file in the harness data directory. Two session generations coexist: `session` with `message`/`part` children (legacy), and `session_v2` with `session_message`/`session_part` children (current). Every session created under v2.2.5 lands in the current generation. Field sources for a telemetry row — the seat and resolved model are the exception: the store cannot state them, so they come from the run's recorded binding (DM-4):

| Telemetry field | Observed source |
|-----------------|-----------------|
| Session identity, tree root, parent chain | `session_v2.id` / `parent_id` (or the legacy equivalents) |
| Harness version stamped on the row | `session_v2.version` — a bare semver (`2.2.5`, `1.19.0`, `1.19.3` coexist in one store); null plus warning when absent |
| Seat identity | The run's recorded binding (DM-4) — the seat the profile assigned to the agent the run named. Never `session_v2.agent` or per-message `agent`: those name the harness agent, not the profile seat, and a group whose observed agent differs from the binding's agent carries a null seat with `unresolved-seat` |
| Resolved model | The run's recorded binding (DM-4) — the seat's model as the profile resolved it, kept beside the observed model with divergence warned |
| Harness-reported agent (agent role) | Per-message `agent`, with `session_v2.agent` as the baseline and `agent-switched` events as transitions; diverges from the binding's agent when the harness did not run the named agent |
| Observed model | Per-message `model` object (`id`, `providerID`, `variant`), with `session_v2.model` as the baseline and `model-switched` events as transitions; normalized to one canonical identifier |
| Tokens (five classes) | `session_v2.tokens_input` / `tokens_output` / `tokens_reasoning` / `tokens_cache_read` / `tokens_cache_write`; per-message `tokens` (`input`, `output`, `reasoning`, `cache`) for group detail |
| Cost | `session_v2.cost` (non-null, default `0`); a reported `0` is an observation, not an absence substitute |
| Calls | Count of the session's usage-bearing message rows |
| Durations | `session_v2.time_created` / `time_updated` and the per-message timestamp pair; elapsed is their difference |
| Tool counts | Absent with a warning where no populated tool source exists; `session_part` is unpopulated in the observed install and the legacy `part` table carries no tool column |
| Work-item attribution | Not present in the store; supplied by DM-8 from the state layer |

### 8.4 External Integrations

- **opencode harness v2.2.5 (observed at intake).** External truth consumed read-only:
  - *Version output*: `opencode v2.2.5` on stdout, exit 0, empty stderr; normalized to `2.2.5`.
  - *Mode surfaces*: `--standalone` (private server per invocation), `--server <url>` (client to a running server), `service start|restart|status|stop|get|set|unset`, `serve` (start the API/web server), `api` (request the running server), `acp` (agent client protocol server).
  - *Selection surfaces*: `run --agent`, `run --model provider/model#variant`, `run --format json`, `--session`, `session list --format json`.
  - *Configuration inputs*: a configuration document (project or global) and the environment inputs `OPENCODE_CONFIG`, `OPENCODE_CONFIG_CONTENT`, `OPENCODE_CONFIG_DIR`; a value inside the document may interpolate an environment variable. There is no per-seat model variable family.
  - *Store*: the SQLite file in the harness data directory (reported by the harness's own paths surface, and overridable through its documented store variable), with `session` and `session_v2` generations coexisting; it may be live-written while read.
  - *Read discipline*: open read-only, set the query-only pragma before the first read, issue only bounded indexed queries, and project only non-content fields. A version line outside the window is a declared refusal, not an attempted adaptation.
- **Decision records (`doc/decisions/`).** Governed by `.ai/agent/decision-instructions.md`: sequential per-type identifiers, `doc/decisions/<TYPE>-<zeroPad4>-<slug>.md`, `Proposed` status for anything not auto-acceptable.

### 8.5 Backward Compatibility

- The delivered harness port shapes stay valid: `HarnessInstance`, `HarnessSessionPort`, the one-shot runner, and the streaming starter keep their members and semantics; additions are optional members or new closed vocabularies.
- The delivered failure identities keep their meaning: `harness.spawn.refused`, `harness.spawn.invalid-output`, `harness.spawn.variable-missing`, `harness.session.unknown`, `harness.capability.gap`, `harness.listing.invalid-output`, and the three telemetry identities are neither renamed nor repurposed. The change adds four identities — `harness.version.unsupported`, `harness.version.unknown`, `harness.mode.unavailable`, and `harness.profile.model-unrepresentable` — and adds no telemetry-absence identity: absence remains a classification inside delivered envelopes. The unassigned-agent refusal reuses the delivered `provider.profile.invalid` identity and adds none.
- `delivery.harness.telemetry.v1` gains fields only; every pre-change row remains readable, and a consumer that ignores the new fields behaves exactly as before.
- The deny-by-default spawn environment is preserved: no ambient variable is forwarded, and a binding record supplies values only for already-declared names; on the per-invocation surface the binding is an argument value, not an environment variable.
- A harness that reports no version continues to resolve with the delivered `version-probe-failed` warning at the instance level; the refusal is the dispatch-level consequence, not a redefinition of the warning.
- The delivered six-scenario conformance floor and both registrations survive unchanged; new scenarios are additions to the same registry.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Refusal before side effects | A version, mode, or profile refusal occurs before any session-bearing child process exists: zero sessions started, zero orphan processes, zero telemetry rows written, zero store writes. The single bounded version probe is the declared exception; it completes and is reaped |
| NFR-2 | Version-probe bound | The probe resolves within 5 s in the reference environment, at most once per dispatch; a probe that cannot answer within the bound is an explicit indeterminate version, never a retried loop and never a fabricated version; the probe process is reaped before the verdict is published |
| NFR-3 | Bounded store reads | Read-only open, query-only pragma before the first read, bounded indexed queries only, no full-table message/part scans, and no content projection; caps unchanged (64 sessions, 16 agents, 16 models, 24 tools per agent where a populated tool source exists) with explicit truncation marks; per-message reads are scoped by session and message type |
| NFR-4 | Bounded output | Machine payload ≤ 65 536 UTF-8 bytes; human disclosure ≤ 4 096 bytes and ≤ 24 lines; truncation deterministic, tail-ordered, and marked; refusal identities and remediation hints are never truncated |
| NFR-5 | Telemetry privacy | Rows, warnings, and refusals carry identity references, counts, costs, and durations only — never prompt text, message bodies, transcripts, diffs, tool output, credential material, or harness configuration values. Store reads project only non-content fields; conversation content is never selected, parsed, or emitted |
| NFR-6 | Non-fabrication | No figure is invented: a cost source the store does not expose is null, a missing token class is null with a warning, a duration the store's timestamps cannot express is explicitly absent, a missing or unparseable version is the explicit unknown; a value the store reports — including a reported zero cost — is recorded as reported. Zero is never a substitute for absence, and absence is never a substitute for a reported zero |
| NFR-7 | Determinism | Byte-identical output for identical injected harness facts, probe result, resolved profile, and clock; zero model calls and zero network on any evaluation, refusal, or render path |
| NFR-8 | Spawn non-interference | Version evaluation, mode resolution, and profile propagation add no blocking work to the delivered stream drain, handle acquisition, or output-bound behavior |
| NFR-9 | Environment purity | No ambient environment read outside the injected seams; the per-spawn binding is passed as data, and adapters continue to read no ambient environment |
| NFR-10 | Offline verification | 100% of new automated tests run offline against simulated harness I/O and fixture stores derived from the observed store contract; zero live harness invocations, credentials, or network. One human-gated live observation is permitted outside CI and is never an oracle |
| NFR-11 | Store-generation tolerance | Extraction recognises the observed store generations and the field set each provides; an unrecognised generation or an absent mandatory field is a classified outcome (absence, degraded capture, or extraction failure), never a silent zero-row pass and never a fabricated row |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- Every version, mode, and profile refusal is a classified outcome on the result envelope with its identity, the observed or requested value, the supported or available alternative, and a remediation hint — never a bare exit status.
- Every dispatch discloses the evaluated version verdict (with the normalized observed version and the raw probe line as diagnostic) and the selected mode, so a later reader can tell which harness line and mode produced the delivery. On the success path the disclosure rides the attempt record and the dispatch envelope; on the pre-session refusal path no attempt record exists, so the same facts ride the failure envelope's declared `detail.harness` member — the envelope member is the disclosure channel there, never a fabricated record (TDR-0031).
- The version stamped on a captured row is the version the session record itself states; the dispatch-probed installed version is disclosed separately, and a divergence between them is warned — neither is overwritten.
- Telemetry capture stays non-gating: a capture degradation is classified with counts and closed-vocabulary warnings and never changes a delivery's outcome, phase, summary, or verdict.
- Absence, degraded capture, and extraction failure are three distinct classifications inside the delivered capture and read envelopes. None is projected as a zero-valued row; a zero-row capture for a session the dispatch ran is a failure; the work-item read side keeps the delivered `spend.telemetry-absent` absence identity. No command, verb, or exit projection is added for telemetry.
- Per-seat attribution discloses unresolved seats, model divergence, agent divergence, and version divergence with counts and reasons — never silently dropped and never reconciled by overwrite.
- Every invocation lands its delivered command-audit record; an audit-write failure is a diagnostic and never changes the outcome.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | The harness does not honour the propagated binding, or a resolved model identifier cannot be expressed on its per-invocation surface or is unknown to it, so the session runs a different model than the profile resolved | H | M | The pre-spawn representability check refuses with `harness.profile.model-unrepresentable` rather than passing silently; the recorded binding and the harness report are both kept with divergence warned on both the model and the agent axis, and an agent or model the harness does not recognise surfaces as the harness's own classified spawn failure or as that divergence — never as a silent substitution; a human-gated live observation confirms the session reports the resolved model before the change is called done (OQ-2, DEC-8, DEC-14) | M |
| RSK-2 | The pinned window (`2.2.x` + `2.1.x`) ages out with the next minor release and blocks delivery | M | H | The window is data with a declared revisit trigger on each harness minor release; a future configurable window degrades to the pinned default instead of widening silently | M |
| RSK-3 | The spike is inconclusive or overruns, leaving the mode undecided at delivery | M | M | The delivered pre-spike default is stated (OQ-1) so the requirements stay executable; the decision record is an explicit delivery deliverable with AC-F2-2 | M |
| RSK-4 | A harness line inside the window uses a store generation or field set the extractor does not recognise, so seat, token, cost, or duration facts are absent there | M | M | Generation detection and the mandatory-usage rule (OQ-3, NFR-11); degrade with closed-vocabulary warnings where the mandatory facts exist, classify only a session with no observable usage fact as a failed session, never fabricate | M |
| RSK-5 | New refusal identities fragment the error table or duplicate delivered meanings | M | L | Each identity is declared once with exit projection and remediation hint; delivered identities keep their meaning; a contract test pins the closed vocabulary | L |
| RSK-6 | Deny-by-default environment is weakened while adding profile propagation | H | L | A binding record supplies only already-declared names; the per-invocation binding is an argument, not an environment variable; structure and behaviour tests pin undeclared-name neutrality and absent-ambient-forwarding | L |
| RSK-7 | Seat attribution double-counts when per-step rows roll up to session totals | M | M | Seat attribution is an added dimension on the delivered grouping; totals keep the delivered reading basis and per-step ingest stays non-gating | M |
| RSK-8 | Version evaluation on the dispatch path adds latency or a process per attempt | L | M | One bounded probe per dispatch, shell-free, with a 5 s bound (NFR-2), reaped before the verdict, and no retry loop | L |
| RSK-9 | The store's session generation or usage field set drifts with a harness release, so extraction silently finds nothing | H | M | Generation and field-set detection with a classified outcome (NFR-11); every fixture derives from the recorded contract (DM-10); the contract is re-observed on each harness minor release | M |
| RSK-10 | The store is live-written by a running harness, so a read-only read is lock-contended or sees a partial snapshot | M | M | Read-only open with the query-only pragma, bounded indexed reads, and per-connection snapshot semantics; a lock or offset failure is `harness.telemetry.extraction-failed`, never a fabricated or zero-valued row | L |

## 12. ASSUMPTIONS

- The installed harness exposes its version through one bounded, shell-free invocation as `opencode v2.2.5`; the accepted grammar is pinned, so probe failure modes stay distinguishable from a version outside the window.
- The resolved profile's seat models are available at spawn time as validated data, so the binding for the agent a run names can be resolved without a new data source; profile resolution itself remains delivered behavior.
- The profile plane already declares the agent→seat relation (`agentOverrides` and the seat-named lookup), so seat resolution for a binding needs no new mapping authored anywhere.
- The store's session agent equals the `--agent` value the invocation carried; a divergence surfaces as an agent-divergence warning, and the run's recorded binding stays authoritative for the seat.
- Operator profiles declare their seat models in `provider/model[#variant]` form in practice; a value that does not is refused with `harness.profile.model-unrepresentable` rather than coerced.
- The observed store generation (`session_v2` with `session_message`) remains the generation the in-window harness writes, and its fields expose per-session version, agent, model, cost, tokens, and timestamps, plus per-message agent/model/cost/tokens/timestamps; where a store does not, the absence is explicit and classified.
- The observed per-invocation selection surfaces (`run --agent`, `run --model provider/model#variant`) remain available across the supported window; a harness that drops them is out of window or needs a new decision.
- The delivered telemetry row grouping (per session/agent/model) is the right coarse grain; seat identity is added as a dimension, not a re-shape.
- Exactly one mode can be the delivered default because a solo-operator delivery path needs one tested transport, not a matrix.
- Decision records follow `.ai/agent/decision-instructions.md`; the adapter-contract record stays `Proposed` until a human decides where rigor requires it.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Harness adapter seam (M1-S11, delivered) | Port shapes, streaming spawn, deny-by-default environment, profile record map, conformance registry |
| Depends on | Harness telemetry v2 (M2-S14, delivered) | Row families, per-step ingest, closeout capture, spend read side, storage-bounds discipline |
| Depends on | Provider profiles and environment records (GH-234, delivered) | Per-seat model derivation and the data-v1 record contract |
| Depends on | Dispatch engine (GH-239, delivered) | The consumer that must carry the version and mode verdict |
| Depends on | Result contract and error table, configuration layer, state layer (delivered) | Identity registration, exit projection, harness branch, fenced appends |
| Depends on | opencode v2.2.5 (external) | Pinned version output and grammar; mode surfaces; per-invocation agent/model selection; configuration-document inputs; read-only session store with `session`/`session_v2` generations (Appendix C) |
| Depends on | Harness store generation (`session_v2`/`session_message`, external) | The fields the telemetry row sources from, and the legacy generation it must tolerate |
| Blocks | M3-S5 adapter conformance and parity suite | The harness-port scenarios this change registers are the floor the suite extends to trackers |
| Blocks | M3-S2/S3/S4 tracker adapters (indirectly) | They assume a working harness plane for end-to-end delivery evidence |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Which integration mode is the delivered default: per-invocation private server, managed background service, or client to a running server? | The ticket makes the spike and its record deliverables; the requirement set is mode-parametrized, so the choice changes configuration and tests, not contracts. Observation settles which surfaces exist and that the current install runs standalone through an operator wrapper | Open — the spike chooses and a decision record records it. Stated default until then: per-invocation private server (`--standalone`), the observed current behaviour, with read-only direct store access for telemetry. Decision needed: consult `@decision-advisor` |
| OQ-2 | Does opencode v2.x honour the per-seat model variable family (`OC_<PREFIX>_AGENT_<SEAT>_MODEL` or an explicit seat `envName`)? | Propagation cannot be asserted without knowing where the harness reads seat models | **Closed (observed).** The installed harness exposes no `OC_<PREFIX>_AGENT_<SEAT>_MODEL` family and no per-seat model variable; it selects a model per invocation (`run --agent`, `run --model provider/model#variant`) and can interpolate `{env:NAME}` inside its own configuration document. Propagation is therefore surface-mapped (DEC-8); a declared variable name remains the binding only for a harness that consumes variables |
| OQ-3 | For an in-window harness whose store omits optional fields, does extraction degrade with warnings or classify the session as failed? | The window may include a line whose store shape was not observed; both answers preserve no-fabrication but differ in how much data survives | **Closed (pinned).** Mandatory set: the session identity the dispatch holds plus at least one observable usage fact (a token class or cost) for that session. With the mandatory set present, every absent optional field (agent/model, per-message grouping, tool counts, a timestamp pair) degrades with a closed-vocabulary warning and an explicit absence; with the mandatory set absent for a session the store holds, that session becomes one failed-session entry with a closed reason. A session the store does not hold is classified absence, not failure (DEC-9) |
| OQ-4 | Will the generic `dispatch` path declare an agent role (a value flag or a declared harness-agent default), so its spawns can bind a seat? | Today the generic dispatch passes no agent and its prompt is role-neutral, so its spawns bind nothing and are disclosed as unresolved seats — the honest state, but the propagation claim is then provable only on agent-naming invocations | Open; owned by `@pm` and `@spec-writer`. Not required by this change: until it is answered, a role-less dispatch is disclosed as `unresolved-seat` and is never counted as propagation proof. Decision needed: consult `@decision-advisor` |
| OQ-5 | Do operators' multi-seat profiles declare `agentOverrides` for every role the delivery launches? | Resolution refuses an agent a multi-seat profile does not assign, so an undeclared override turns that dispatch into `provider.profile.invalid` — deliberate, so the fix is configuration rather than silent attribution | Open; observed at the change's human-gated live observation and recorded in the change folder. Owner: `@spec-writer` |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | The supported window is the current minor line at delivery time plus one previous minor — `2.2.x` plus `2.1.x` at intake, from the observed `v2.2.5` — evaluated once per dispatch at a single production probe point, and unsupported versions refuse with a typed identity. No configurable window ships; a future configured value that cannot be honoured degrades to this default, never to an unbounded or wider window | GH-342 question Q-06 is unanswered, so its stated default applies; the milestone risk table names a version window with typed refusal as the mitigation for CLI flag drift; a pinned default keeps the refusal testable and prevents a configuration path from accidentally widening acceptance | 2026-11-17 |
| DEC-2 | Exactly one integration mode is the delivered default, and a dispatch never falls back between modes; any other requested mode refuses with `harness.mode.unavailable` | EC-1 requires the mode to be decided and documented; a silent fallback would make the decision unobservable, hide transport failures, and multiply the tested surface for a solo-operator delivery path | 2026-11-17 |
| DEC-3 | An undeterminable version refuses with a distinct closed identity `harness.version.unknown` rather than reusing `harness.version.unsupported`. Empty output, a non-zero exit, a timeout, multiple lines, and any output outside the accepted grammar all resolve to this identity; an unparseable string is never a match and never a partial version | Reporting an unknown version as unsupported asserts a fact the system does not have; the repository's no-fabrication rule applies to classification as much as to numbers, and a distinct identity lets an operator fix a broken installation instead of "upgrading" a harness that is already fine | 2026-11-17 |
| DEC-4 | Telemetry growth stays inside `delivery.harness.telemetry.v1`: fields are added, none removed or renamed, and a new major version is reserved for a structural change or a removal | OQ-M3-07 answers "backward compatible; add fields, never remove; new version only on a structural change"; the state ledger and the spend read side both branch on the identity constant, and an unnecessary bump would strand captured rows | 2026-11-17 |
| DEC-5 | Per-seat attribution carries the resolved model beside the harness-reported model and discloses divergence; the harness-reported value is never overwritten | The profile is the intent and the harness report is the observation; overwriting either destroys the only evidence that propagation worked or silently failed, which is the exact gap this story exists to close | 2026-11-17 |
| DEC-6 | A required seat model that cannot be expressed on the surface the harness honours refuses with a dedicated identity `harness.profile.model-unrepresentable` rather than proceeding with a partial profile (the "harness does not recognise it" half is narrowed out by DEC-14) | A partially propagated profile produces a delivery whose cost and quality facts belong to the wrong seat; refusing keeps the AC "runs with the resolved profile" honest, and a dedicated identity makes the seat and reason actionable | 2026-11-17 |
| DEC-7 | The adapter-contract refinements (window and two version identities, mode declaration and identity, propagation contract and identity, seat/duration telemetry fields, absence identity) are governed by a technical decision record authored in this change, and the integration-mode selection is recorded as its own decision record — both following the TDR-0016/TDR-0021 precedent | The repository rule is that a harness adapter-contract change is governed by a recorded decision; the ticket also makes the mode decision an explicit deliverable, and separating "which mode" from "how the contract changes" keeps each record challengeable on its own merits | 2026-11-17 |
| DEC-8 | The propagation contract is a harness-neutral per-seat binding record, mapped by each adapter onto a surface its harness honours; for opencode the surface is the observed per-invocation agent/model selection (`run --agent`, `run --model provider/model#variant`), and the declared variable name is the binding only for a harness that consumes variables | The installed harness exposes no per-seat model variable family (OQ-2, observed), so a contract pinned to the derived `OC_*` name would be nominally correct and inert — exactly the failure the ticket exists to prevent. A surface-mapped binding keeps the contract harness-neutral while making what is tested the surface that actually runs | 2026-11-17 |
| DEC-9 | Telemetry is sourced from the observed store contract: the attribution key is every session identity the run holds plus the run's recorded binding for the seat claim (DEC-13); the row's harness version is the session record's own normalized version; the harness-reported agent and observed model, cost, tokens, and durations come from session and per-message metadata — the seat and resolved model never do — and no work-item or harness-version column is assumed. The absence taxonomy is: session not in a readable store → absence; session present with no observable usage fact → failed session; readable store with rows but absent optional fields → degraded with warnings; unreadable store → extraction failure | The delivered extractor's assumed columns do not exist anywhere in the installed store, and the current session generation is a different table, so the old contract lands zero rows while green. Pinning the observed contract and a four-way taxonomy makes the zero-row outcome visible and keeps every field traceable to a source | 2026-11-17 |
| DEC-10 | Telemetry absence is disclosed inside the delivered capture and read envelopes (failed-session entries, warnings, counts, and the delivered `spend.telemetry-absent` read-side identity); no command, verb, exit projection, or `harness.telemetry.absent` identity is added | NG-9 forbids a new CLI surface and closeout capture is non-gating by contract. A per-session telemetry request with its own exits does not exist, so criteria asserting one would be unsatisfiable; the delivered envelopes already carry the distinctions a reader needs | 2026-11-17 |
| DEC-11 | The version probe is one bounded, shell-free invocation at a single production probe point (the dispatch path's harness resolution); its accepted output is a product token, an optional `v`, and a three-part semantic version, normalized to the bare semver (`opencode v2.2.5` → `2.2.5`); the raw line is diagnostic only; empty, non-zero, timed-out, multi-line, or non-matching output is indeterminate and refuses as `harness.version.unknown` | The observed output is not a bare semver, so an implementation that expected one would refuse every dispatch; pinning the grammar and the normalization makes the gate provable and keeps a naive substring match from widening acceptance | 2026-11-17 |
| DEC-12 | No surviving acceptance criterion changes its identifier. Three criteria are added — AC-F1-5 (probe grammar, normalization, and failing shapes), AC-F5-5 (store-to-delivery binding and the absence taxonomy), and AC-F5-6 (live rows from the installed harness) — taking the count from 23 to 26. AC-F1-4, AC-F5-1, AC-F6-1, AC-F6-2, and AC-N1-1 are rewritten in place under their existing identifiers: AC-F1-4 no longer describes an unreachable configuration trigger, AC-F5-1 now requires at least one row for a known readable session, AC-F6-1 and AC-F6-2 no longer assert a per-session telemetry request or its exits, and AC-N1-1 now permits the single bounded probe. `harness.telemetry.absent` is not added | The test plan and plan reference these identifiers heavily; adding ids instead of renumbering keeps every existing traceability row valid while making the three new properties citable. Recording the change here lets both downstream artifacts adopt it without guessing | 2026-11-17 |
| DEC-13 | Seat–spawn cardinality and seat resolution follow TDR-0032: one spawn binds exactly one seat, resolved from the agent identity the spawn names through the resolved profile (`agentOverrides[agent]`, else the seat named `agent`, else the profile's single declared seat); the adapter expresses it as exactly one `--agent` and one `--model` and sends the agent identity, never the seat name, as `--agent`; the seat identity has no invocation carrier and is recorded on the run; a profile's N seats are N spawns, N sessions, and N row sets; a named agent a multi-seat profile assigns no seat refuses pre-session with the delivered `provider.profile.invalid`, and a spawn naming no agent binds nothing and is disclosed as `unresolved-seat` | Readiness iteration 2 (finding C1) established that the artifacts never said which seat a spawn is bound to while the honoured surface is single-valued, so "per-seat models" was undecidable and unsatisfiable. The delivery already launches one named role per invocation and the profile already declares the agent→seat relation, so a single-seat-per-spawn rule makes the claim provable on the surface that runs without new orchestration or a new identity | 2026-11-18 |
| DEC-14 | AC-F3-4 is narrowed to the expressibility half: the "or that the harness does not recognise it" clause is dropped, because no in-process source for a recognised-agent or recognised-model catalogue exists and reading one (`opencode debug agents`) would be a second pre-session child that AC-N1-1 and NFR-1 forbid. An agent or model the harness does not know is the harness's own classified spawn failure, and an agent the harness did not honour surfaces as the agent-divergence warning; on the pre-session refusal path the version verdict and mode ride the failure envelope's `detail.harness` member, never a fabricated attempt record (TDR-0031) | A refusal condition with no production source is an AC that only tests can satisfy — the vacuity class this change exists to remove. Keeping the expressibility half preserves the actionable pre-session refusal while making the unknown case honest: it is observed, classified, and disclosed rather than asserted | 2026-11-18 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Harness contracts (kind, operations, failure vocabulary, instance) | Updated — additive window/mode/profile vocabularies and identities |
| Configured-kind registry and version probe seam | Updated — window evaluation carried as a verdict on the instance; the dispatch path becomes the single production probe point; output grammar and normalization pinned; no silent default |
| opencode adapter (spawn, deliver, resume, listing) | Updated — mode selection, per-invocation profile binding, refusal paths, attach |
| Spawn-environment builder and profile record propagation | Updated — the per-spawn record map is accepted as data alongside the descriptor; declared-name-only binding with unchanged deny-by-default posture |
| Dispatch run record (per-spawn binding) | Updated — the binding for the seat the run declared (agent identity, seat, resolved model) is recorded per spawn, additively on the delivered attempt record, so capture cites the seat instead of re-deriving the profile |
| Harness store location resolution | Updated — the configured opencode path is reconciled with the harness-declared data directory and its documented store override; an absent path is classified |
| Telemetry extraction (opencode extractor, per-step ingest) | Updated — observed-store extraction across generations, session-identity attribution, session-record version stamp, seat/resolved/observed model, store-sourced durations, absence taxonomy; no content projection |
| State-layer telemetry records and spend read side | Updated (read-compatible) — new fields consumed additively; no schema bump; `spend.telemetry-absent` untouched |
| Error table and result envelope | Updated — four additive identities with exit projection and remediation hints; the unassigned-agent refusal reuses the delivered `provider.profile.invalid`; no telemetry-absence identity |
| Configuration branch (harness) | Updated — the mode value and the store path; window remains pinned data, not a key |
| Conformance registry | Updated — new scenarios beside the unchanged six-scenario floor |
| Decision records (`doc/decisions/`) | New — the adapters-contract record and the integration-mode record |
| Harness feature spec and NFR rows (`doc/spec/`) | Updated in the documentation phase — current truth for the window, mode, propagation, and seat telemetry |
| Dispatch engine consumer | Updated — carries the version verdict and mode into its outcome |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** an installed harness version inside the supported window and a resolved profile, **when** a dispatch resolves the harness, **then** the dispatch proceeds and the observed version and window verdict are carried on the resolved instance | F-1, DM-1, DM-2 |
| AC-F1-2 | **Given** an opencode version outside the supported window, **when** a dispatch is attempted, **then** it refuses with `harness.version.unsupported` (exit 1, remediation naming the supported window) and no session is spawned | F-1, DM-1, DM-2, TC-M3-HARNESS-002 |
| AC-F1-3 | **Given** a harness version that cannot be determined or parsed, **when** a dispatch resolves the harness, **then** it refuses with `harness.version.unknown`, the observed version remains the explicit unknown, and no version is fabricated and no dispatch proceeds silently | F-1, DM-2, NFR-6 |
| AC-F1-4 | **Given** the pinned supported window, **when** harness settings are resolved on any configuration layer, **then** the window is the pinned value with no key that widens or narrows it, and only a dispatch whose version is inside the window proceeds | F-1, DM-1 |
| AC-F1-5 | **Given** the harness version output `opencode v2.2.5`, **when** the probe is evaluated, **then** the observed version is the normalized `2.2.5` and the raw line is diagnostic only; **and given** empty output, a non-zero exit, a timeout, multiple lines, or output outside the accepted grammar, **then** the version is indeterminate and the dispatch refuses `harness.version.unknown` — never a substring or partial match | F-1, DM-2, NFR-2, NFR-6 |
| AC-F2-1 | **Given** the delivered default integration mode, **when** a dispatch spawns a session, **then** exactly that mode is used and no other mode is attempted as a runtime fallback | F-2, DM-3 |
| AC-F2-2 | **Given** the integration-mode spike is complete, **when** the change is delivered, **then** a decision record states the chosen mode among the harness's exposed mode surfaces (per-invocation private server, managed background service, client to a running server), including the read-only direct-store rationale, and is linked from this change and the harness feature spec | F-2, G-8 |
| AC-F2-3 | **Given** a requested mode the installed harness or the delivery does not support, **when** a dispatch runs, **then** it refuses with `harness.mode.unavailable` before any spawn, naming the requested and the available mode | F-2, DM-3, NFR-1 |
| AC-F2-4 | **Given** the mode is expressed on the harness configuration branch, **when** it is omitted, **then** the delivered default applies with a declared `defaults` origin; **and when** it carries an unknown value, **then** it is refused rather than silently defaulted | F-2, DM-3 |
| AC-F3-1 | **Given** a resolved profile and an installed in-window opencode, **when** the harness port spawns an agent session, **then** the spawn carries exactly one resolved binding — the seat the profile assigns to the agent the run names — expressed as exactly one `--agent <agent>` and one `--model <provider>/<model>[#<variant>]` on the surface the harness honours, and a capture of that session keeps the seat and resolved model from the run's recorded binding beside the harness-reported agent and model so a match or a divergence is visible — never an unstated assumption; **and given** a spawn that names no agent, **then** no `--agent`/`--model` is sent and the run is recorded and disclosed as `unresolved-seat` — never an inferred seat (the live confirmation of "runs with the resolved profile" is a Definition-of-Done clause) | F-3, F-5, DM-4, DM-5, TC-M3-HARNESS-001 |
| AC-F3-2 | **Given** a declared model variable name with both a resolved record value and a conflicting ambient parent value, **when** the spawn environment is built, **then** the record value wins | F-3, DM-4, NFR-9 |
| AC-F3-3 | **Given** record names that are not declared in the environment allowlist, **when** the spawn environment is built, **then** they change nothing and no undeclared parent variable is forwarded | F-3, NFR-9 |
| AC-F3-4 | **Given** a required seat model that cannot be expressed on the surface the harness honours, **when** the spawn is prepared, **then** it refuses with `harness.profile.model-unrepresentable` naming the seat and no session is spawned; **and given** a spawn naming an agent the resolved multi-seat profile assigns no seat, **then** it refuses with the delivered `provider.profile.invalid` naming the agent, the profile, and the declared seats, with no session spawned and no attempt record; an agent or model the harness does not recognise is not a pre-session refusal — it is the harness's own classified spawn failure (DEC-14) | F-3, DM-4, NFR-1 |
| AC-F4-1 | **Given** an existing session for the work item, **when** a resume or attach dispatch runs, **then** it continues that session identity with the tree root preserved and the same propagation contract, and an unknown or different session keeps the delivered `harness.session.unknown` semantics | F-4, DM-4 |
| AC-F5-1 | **Given** a store of the observed v2.2.5 contract and a session identity the dispatch holds, **when** telemetry lands, **then** at least one row is produced for that session and every row stamps the schema identity and the session record's normalized harness version and carries the seat and resolved model from the run's recorded binding, the harness-reported agent and model, the five token classes, calls, cost, and durations-or-explicit-absence; a group whose observed agent differs from the binding's agent carries no seat and warns; a capture that lands zero rows for that session is a failure, not a pass | F-5, DM-5, DM-6, DM-9, DM-10 |
| AC-F5-2 | **Given** rows captured before this change under `delivery.harness.telemetry.v1`, **when** they are read after the change, **then** they remain readable and unchanged, and the new fields are additions with no removal or rename and no new major version | F-5, NFR-6, DEC-4 |
| AC-F5-3 | **Given** a row whose resolved seat model differs from the harness-reported model, or whose binding's agent differs from the observed agent, **when** the row lands, **then** both values on that axis are kept and the divergence is disclosed with a closed-vocabulary warning — never reconciled by overwriting | F-5, DM-5, DEC-5 |
| AC-F5-4 | **Given** a session whose store timestamps the row can read, **when** the row lands, **then** start, end, and elapsed come from those timestamps; **and given** a session whose timestamp pair is unavailable, **then** the duration is explicitly absent with a closed-vocabulary warning and is never derived from the capture timestamp or estimated | F-5, DM-6, NFR-6 |
| AC-F5-5 | **Given** a dispatch that spawned or resumed one or more sessions, **when** telemetry is captured, **then** attribution comes from every session identity the run holds (one per spawn/resume) together with the run's recorded binding for the seat claim, and the store tree below each held identity — no work-item or harness-version column is assumed, no store-wide scan — and a run with no recorded session identity yields a classified absence with no rows; a session the store holds but with no observable usage fact becomes a failed-session entry | F-5, F-6, DM-8, NFR-3, NFR-11 |
| AC-F5-6 | **Given** the installed in-window harness and a session the dispatch itself ran, **when** the human-gated live observation runs, **then** at least one telemetry row is captured for that session carrying its stored version, seat, and tokens, and the observation is recorded in the change folder and is never a CI oracle; a zero-row outcome fails this criterion | F-5, NFR-10, DM-10 |
| AC-F6-1 | **Given** a work item whose captured telemetry is absent, **when** the spend read side reports it, **then** it carries the delivered `spend.telemetry-absent` classification with no zero figures, and a closeout capture that is absent or fails writes no zero-valued record and changes no other closeout effect | F-6, NFR-6 |
| AC-F6-2 | **Given** a capture outcome on a readable store, **when** it is disclosed, **then** absence (session not held), degraded capture (optional fields absent), and extraction failure (store unreadable) are three distinct classifications carried inside the delivered capture envelope with their counts, reasons, and warnings; no command, verb, or exit projection is added and the delivery's exit code is unchanged | F-6, NFR-4, NFR-5, NFR-11 |
| AC-F7-1 | **Given** the delivered conformance registry, **when** the suite runs, **then** both registered harnesses still cover the unchanged six-scenario classification floor and pass | F-7, DM-7 |
| AC-F7-2 | **Given** the extended registry, **when** a registered harness misses a version-window, unknown-version, mode-unavailable, or profile-propagation scenario, **then** the suite fails and names the harness and the scenario | F-7, DM-7 |
| AC-F7-3 | **Given** the conformance suite, **when** it runs in CI, **then** it executes offline against simulated harness I/O and performs zero live harness invocations | F-7, NFR-10 |
| AC-N1-1 | **Given** any version, mode, or profile refusal, **when** the refusal is produced, **then** no session-bearing child process has been started, no orphan process survives, no telemetry row is written, and no other side effect of the attempted spawn remains; the single bounded version probe is the declared exception — at most one per dispatch, completed and reaped before the verdict | NFR-1, NFR-2, NFR-8 |

### 17.1 Traceability

AC-F1-2 is TC-M3-HARNESS-002 in Given/When/Then form, and AC-F3-1 plus AC-F5-1 carry TC-M3-HARNESS-001. TC-M3-HARNESS-001 is exercised one seat per spawn: an N-seat profile is N spawns, each its own session and its own row set (DEC-13), and its live half runs an invocation that names an agent — a role-less run is recorded as an unresolved-seat observation and is never accepted as propagation proof. The ticket AC decomposes as: a dispatch through the installed harness port runs with the resolved profile (AC-F2-1, AC-F3-1..AC-F3-4, AC-F4-1), telemetry rows land with the session's schema identity and per-seat models (AC-F5-1, AC-F5-3, AC-F5-4, AC-F5-5), unsupported versions refuse with a typed error (AC-F1-2, AC-F1-3, AC-F1-5, AC-N1-1), and the integration-mode decision is recorded (AC-F2-2). EC-1 additionally owes the recorded mode and the versioned telemetry outcome, covered by AC-F2-2, AC-F5-1, and AC-F5-6. The absence taxonomy is covered by AC-F6-1 and AC-F6-2 and is disclosed only inside delivered envelopes.

### 17.2 Definition of Done

Change-specific and traceable to the acceptance criteria. Phase 10 verifies every clause; a clause that is not met keeps the change not done.

- [ ] Every acceptance criterion in this section passes. Deferral is permitted only for the human-gated live observation — AC-F5-6 and the live half of AC-F3-1 — and only when (i) the deferral is accepted and recorded by the human owner or `@pm` in the change's evidence, not merely self-recorded, and (ii) every offline criterion that proves the same contract stays green. No other criterion may be deferred: AC-F1-1..AC-F1-5, AC-F2-1..AC-F2-4, AC-F3-2, AC-F3-3, AC-F3-4, AC-F4-1, AC-F5-1..AC-F5-5, AC-F6-1, AC-F6-2, AC-F7-1..AC-F7-3, and AC-N1-1 are non-deferrable. (AC-F1-1..AC-N1-1)
- [ ] The observed store contract (DM-10, Appendix C) is recorded in the change, and every extraction fixture derives from it. No test asserts a work-item column, a separate harness-version column, a per-message token column, or a tool column. (AC-F5-1, AC-F5-5, NFR-11)
- [ ] A capture against a fixture of the observed contract lands at least one row for a session identity the dispatch holds, with every required field; a zero-row capture for that session fails the run. (AC-F5-1)
- [ ] The human-gated live observation is recorded in the change folder: a dispatch runs through the installed in-window harness on an invocation that names an agent, so the run carries a resolved binding, the session reports that seat's resolved model, and at least one telemetry row is captured carrying the session's stored version, seat, and tokens. If the observation is deferred, the change records the deferral, its reason, the exact boundary, and the accepting human/PM decision, and its claim is narrowed to "the propagation contract is verified offline; live confirmation is deferred" — the change never claims "profile propagation proven". A role-less run is recorded as an unresolved-seat observation and is never accepted as propagation proof. (AC-F3-1, AC-F5-6, RSK-1)
- [ ] The probe contract is pinned and one real harness version output is recorded; `2.2.5` is the only accepted normalized representation, and the raw line is diagnostic only. (AC-F1-5, DEC-11)
- [ ] The version probe has exactly one production construction site — the dispatch path's harness resolution — asserted by an offline structure check over the production composition that fails when a second call site of the probe seam appears; the check is named in the test plan and runs inside the quality-gate battery, and its verdict is recorded in the change's evidence. (AC-F1-1, AC-F1-5)
- [ ] The four new identities exist once in the closed error table, each with a stable code, exit projection, and non-empty remediation hint; the unassigned-agent refusal reuses the delivered `provider.profile.invalid` and adds no code; no telemetry-absence identity is added and the nine delivered codes keep their meaning. (AC-F1-2, AC-F1-3, AC-F2-3, AC-F3-4)
- [ ] The six-scenario conformance floor is unchanged and green for both registered harnesses; the extension scenarios are registered on the same registry and a missing scenario fails the suite. (AC-F7-1, AC-F7-2, AC-F7-3)
- [ ] Absence, degraded capture, and extraction failure are three distinct classifications, each reachable; none produces a zero-valued row; the work-item read side still reports `spend.telemetry-absent`. (AC-F6-1, AC-F6-2)
- [ ] The integration-mode and adapter-contract decision records are authored, independently reviewed, linked from this change and the harness feature spec, and the record's chosen mode equals the delivered default constant. A record that is authored but unreviewed leaves this clause open. (AC-F2-2, DEC-7)
- [ ] `delivery.harness.telemetry.v1` is still the identity: no field removed or renamed, no new major version, and pre-change rows read unchanged. (AC-F5-2, DEC-4)
- [ ] No new CLI command, verb, or exit projection exists for telemetry, and no delivery's exit code changes because of a capture. (AC-F6-2, NG-9)
- [ ] The current-truth documentation is reconciled: harness adapters, telemetry, state layer, spend, configuration layer, result contract, dispatch engine, adapter ports, non-functional rows, decision index, and the milestone status markers. (G-8)

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Delivered through the repository's standard change lifecycle on this change's branch: plan phases declared in the change plan, each phase gated and committed at its boundary, quality gates green before the pull request, and the pull request targeting the tooling integration branch (`main-tools`).
- The change is self-contained and additive; no data migration is required. A developer already running an in-window opencode needs no manual change, but the configured store location must resolve to the harness's real data directory (or its documented store override) before a capture can land rows; an unresolved path is classified, never silently empty. An out-of-window installation now refuses with an actionable identity instead of proceeding unexamined.
- The integration-mode spike and its record land inside this change, before the mode-dependent behavior is delivered, so the record precedes the code it governs. The spike observes the harness read-only; it never writes the store or mutates harness configuration.
- Delivery stops and the propagation decision reopens, escalated to a human, if the live observation shows the harness does not report the resolved seat model on the honoured surface, or if a resolved seat model cannot be expressed on it. In that case the change does not claim "runs with the resolved profile", and the mode and contract records are revised before delivery resumes.
- Planning and system documentation reconciliation (harness feature spec, non-functional rows, decision index, milestone status markers) happens in the dedicated documentation phase.
- M3-S5 (conformance and parity suite) consumes the extended registry after this change lands; no external coordination is required.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

- No migration. `delivery.harness.telemetry.v1` gains fields; existing rows keep their exact shape and remain readable, and the state schema version is unchanged.
- Pre-change rows carry no seat attribution, resolved model, or durations, and are not backfilled: a read of such a row shows the explicit absence, never a fabricated seat or a derived duration. The harness store itself already holds timestamps and usage for historical sessions; that is not retrofitted into old state rows.
- Test seeding uses committed fixture stores derived from the observed store contract and simulated harness I/O; no live harness store, credentials, or network in automated tests (NFR-10). One human-gated live observation is permitted and is never an oracle.

## 20. PRIVACY / COMPLIANCE REVIEW

- Telemetry rows and refusal disclosures carry identity references (work item, run, session, seat, agent, model, harness kind and version), counts, cost, and durations only — never prompt text, message bodies, transcripts, diffs, tool output, credential material, or harness configuration values.
- Store reads project only non-content fields: session metadata, per-message usage metadata, and switch events. The conversation-bearing payload is never selected, parsed, or emitted, even though it shares a JSON document with the usage metadata.
- The resolved per-seat model values are provider model identifiers, not secrets; the profile record stays under the delivered data-v1 record contract and is never rendered into a payload.
- All telemetry stays local; the change adds no export, no background process, and no new retention regime.
- The delivered redaction chokepoint composes unchanged on every new disclosure path.

## 21. SECURITY REVIEW HIGHLIGHTS

- The version probe is one bounded, shell-free invocation at the single production probe point; it adds no new process primitive, no shell interpretation, and no prompt or conversation content, and it is reaped before the verdict. Its output is bounded and treated as diagnostic.
- The deny-by-default spawn environment is preserved: a record value supplies only an already-declared name, the per-invocation binding is an argument value rather than an environment variable, and no ambient variable is forwarded.
- Harness store access stays read-only with the query-only pragma before the first read; no store write, configuration mutation, or harness-side model injection is introduced. A live-written store is read under a read-only snapshot; a lock or offset failure is a classified outcome, never a partial or fabricated row.
- Every new failure identity joins the closed error table with a stable code, a declared exit projection, and a remediation hint; a refusal never leaks a credential, a prompt, or a raw store row.
- Brand neutrality is preserved: the harness kind is a closed vocabulary and no brand or binary name is introduced into a tooling contract by this change. Current truth, recorded so the claim is not overstated: the opencode binary name is a production constant in the CLI's harness composition and the opencode store path default is a key in the core configuration defaults (`stores.opencode.databasePath`) — neither lives inside the adapter. Both are pre-existing; this change reconciles the store path default with the harness's declared data directory and its documented store override, and does not move the binary name. The change adds no command surface and no new product-name coupling; the store location stays resolved from configuration and the harness's own declared data directory.

## 22. MAINTENANCE & OPERATIONS IMPACT

- The supported window is a maintained constant with a declared revisit trigger: every harness minor release requires re-pinning, and the pinned value is the only place acceptance widens. A stale window shows up as an explicit refusal, not as a silent compatibility claim (RSK-2).
- The propagation contract is a surface mapping, not a variable family: if the harness changes how it accepts a model selection, the adapter mapping — not the profile resolution — is what changes (RSK-1, DEC-8).
- The seat rule is operational as well as contractual: a delivery that needs several seats is several spawns, one per named role, not one spawn carrying a profile. Operators declaring a multi-seat profile must assign each role its seat through `agentOverrides` (or name a seat exactly as the role), and an unassigned named agent refuses rather than borrowing a seat (DEC-13, OQ-5).
- The observed store contract is maintained like the window: the generation and field set are re-observed on each harness minor release, and a drift is a classified outcome rather than a silent zero-row capture (RSK-9, NFR-11).
- Any future telemetry addition follows the same rule as this change: fields only, identity unchanged, absence explicit.
- New refusal identities are cheap to add but expensive to fork; the rule is one identity per condition, with the delivered meanings untouched (RSK-5).
- Operators should expect an out-of-window harness to block delivery deliberately; the remediation hint names the supported lines so the fix is an upgrade, not a workaround.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Supported window | The declared set of harness minor lines a dispatch accepts: the current minor line plus one previous minor |
| Version verdict | The result of comparing an observed harness version to the window: inside, outside, or indeterminate |
| Indeterminate version | A version that could not be probed or parsed; carried as the explicit unknown, never fabricated |
| Integration mode | How a dispatch reaches the harness: a per-invocation private server, the managed background service, or a client to a running server |
| Delivered default mode | The single mode `delivery-os`/`jaiship` dispatch uses when configuration declares nothing |
| Observed store contract | The recorded v2.2.5 table, column, and field inventory a telemetry row is sourced from (DM-10, Appendix C) |
| Store generation | One table family for sessions and messages; the observed store carries a legacy `session` generation and a current `session_v2` generation |
| Session identity attribution | Binding a store session to a delivery by the session identities the run holds — one per spawn/resume — never by a store column; the seat claim additionally cites the run's recorded binding |
| Version probe normalization | Reducing the harness version output to a bare semantic version (`opencode v2.2.5` → `2.2.5`), with the raw line kept as diagnostic only |
| Per-invocation selection | A model/agent choice passed to the harness on the invocation itself, the surface opencode honours; exactly one `--agent` and one `--model` per invocation |
| Absence / degradation / extraction failure | The three capture classifications: the session is not in a readable store; the session is present but optional fields are missing; the store cannot be read |
| Profile propagation | Carrying the resolved seat binding on the spawn as data and expressing it on the surface the harness honours, so the spawned session runs the resolved model for that seat |
| Agent identity | The harness agent name a run names and the harness receives as `--agent`; recorded by the store as the session agent and reported by spend as the role. It is not the profile seat name when the two differ |
| Binding | The per-spawn record of exactly one seat: the agent identity it was resolved for, the seat the profile assigns that agent, and that seat's resolved model. Expressed as one `--agent` and one `--model`, and recorded on the run so rows cite the seat instead of re-deriving it |
| Seat | One agent role in a resolved provider profile, owning a model selection and — where a harness consumes variables — a declared environment variable name. One seat is bound per spawn, resolved from the agent the run names |
| Unresolved seat | The disclosed state of a run that bound no seat (it named no agent) or of a session group whose observed agent differs from the binding's agent; carried as a null seat with the `unresolved-seat` warning, never as a guessed seat |
| Resolved model | The model the profile selected for a seat, taken from the run's recorded binding and carried beside the harness-reported model |
| Observed model | The model the harness reported for a session, kept beside the resolved model with divergence disclosed |
| Seat attribution | The row field naming which seat a telemetry row's cost, tokens, and durations belong to, taken from the run's recorded binding |
| Durations | Start, end, and elapsed time recorded per row where the store exposes them; otherwise explicitly absent |
| Typed refusal | A classified failure with a closed error identity, exit projection, and remediation hint, produced before any side effect |
| Six-scenario floor | The delivered classification conformance scenarios every registered harness must cover |

## 24. APPENDICES

### Appendix A — Source traceability

| Source | Content used |
|--------|--------------|
| Ticket GH-335 (milestone M3, story M3-S1) | Goal, tasks, AC, dependencies (M1-S11, M2-S14 — both delivered) |
| Backlog M3-S1 | Task list: integration-mode spike with recorded decision, spawn adapter with per-spawn model propagation and session resume/attach, telemetry extraction with per-seat model/tokens/cost/durations, version detection and window, conformance tests |
| Milestone pack `m3/README.md` EC-1 | Harness portability exit criterion; typed-refusal wording resolved to a refusal |
| Milestone pack `m3/contracts.md` | Extended harness port (spawn/resume/telemetry/capabilities) and the three declared typed refusals |
| Milestone pack `m3/architecture.md` | Boundary invariants: no core branch on harness kind, declared typed refusals, env-only credentials, versioned additive telemetry with mandatory per-seat model identity |
| Milestone pack `m3/test-scenarios.md` | TC-M3-HARNESS-001 and TC-M3-HARNESS-002 (Appendix B) |
| Milestone pack `m3/open-questions.md` | OQ-M3-01 (opencode the only delivery harness), OQ-M3-02 (integration-mode spike, direct DB access allowed), OQ-M3-07 (additive telemetry versioning) |
| System spec `feature-harness-adapters.md` | Delivered port surface, opencode adapter behavior, deny-by-default environment and profile record precedence, telemetry extraction and bounds, conformance registry |
| System spec `nonfunctional.md` (harness rows) | Read budget, byte bounds, determinism, conformance-registration invariants |
| Current contracts | Harness port vocabulary and instance shapes, telemetry records and bounds, configured-kind registry with the injected version probe, per-seat environment-record derivation, typed harness configuration resolution |
| Current adapters and composition | The opencode delivery adapter, the opencode telemetry extractor, the single child-process host seam, and the production harness composition (`harnessFor` / environment builder) |
| Conformance testkit | The harness conformance registry (six-scenario floor, two registrations, coverage meta-check) |
| PM clarify_scope findings (pm-notes) | Observed harness `v2.2.5`, v2 CLI surface and store location, gap inventory G1–G5 (this spec adds G6–G7), the GH-342 Q-06 default, and the resolution of the "degrade" versus "refuse" wording |
| Read-only harness observation (this revision) | The v2.2.5 version output, mode/selection/configuration surfaces, store path and table/column/field inventory, generation and row evidence, and the delivered extractor's assumed-versus-observed column comparison — Appendix C |

### Appendix B — Pinned blueprint scenarios

```
TC-M3-HARNESS-001 opencode v2.x dispatch with profile propagation
Given a resolved model profile and an installed opencode v2.x,
When the harness port spawns an agent session in standalone mode,
Then the session reports the resolved per-seat models and emits versioned
telemetry rows with tokens and cost.

TC-M3-HARNESS-002 unsupported harness version
Given an opencode version outside the supported window,
When a dispatch is attempted,
Then it refuses with `harness.version.unsupported` and no session is spawned.
```

### Appendix C — Observation evidence (opencode v2.2.5, read-only)

Observed on 2026-11-17 on the delivery host, read-only: no store write, no harness configuration mutation, no credential material read, no network call, and no session content read (only schema, row counts, metadata null/zero distributions, and JSON key names). Counts drift by a few rows because the store is live-written by a running harness; the shape and the ratios are the evidence, not the exact totals.

**C.1 Commands run and what they showed**

| Command | What it showed |
|---------|----------------|
| `opencode --version` | `opencode v2.2.5` — product name, `v` prefix, newline-terminated bare semver (16 bytes); exit 0; stderr empty. Not a bare semver. |
| `opencode --help`, `run --help`, `session --help`, `service --help`, `serve --help`, `api --help`, `acp --help`, `debug --help` | Mode surfaces: `--standalone` (private server per invocation), `--server <url>` (client to a running server), `service start/restart/status/stop/get/set/unset`, `serve` (API/web server), `api` (request the running server), `acp` (agent client protocol server), `session list`. Selection surfaces: `run --agent`, `run --model provider/model#variant`, `run --format json`, `--session`. |
| `opencode debug paths` (installed binary, not the `PATH` wrapper) | `data /home/juliusz/.local/share/opencode`; `state /home/juliusz/.local/state/opencode`; `db /home/juliusz/.local/share/opencode/opencode.db`. Run against the installed binary: through the 98-byte `PATH` wrapper this subcommand aborts with `Unrecognized flag: --standalone` (last row). |
| Existence checks on four candidate store paths | Only `~/.local/share/opencode/opencode.db` exists (11 614 158 480 bytes at observation, WAL mode). `~/.local/state/opencode/opencode.db`, `~/.config/opencode/opencode.db`, and the workspace-relative `.local/state/opencode/opencode.db` do not exist. |
| `sqlite3 "file:…?mode=ro" .tables` / `.schema` / `pragma_table_info` | 24 tables. Two session generations: `session` (+ `message`, `part`) and `session_v2` (+ `session_message`, `session_part`). `message` = `id, session_id, time_created, time_updated, data`; `session_message` = `id, session_id, type, seq, time_created, time_updated, data`; `part` = `id, message_id, session_id, time_created, time_updated, data`. A scan for any column named like work/harness/ticket/issue found only `project.worktree`, `session.workspace_id`, `session_v2.workspace_id`. |
| Row counts and newest timestamps | `session` 7 386 (newest row created 2026-11-01); `session_v2` 12 469 and growing (newest 2026-11-17 22:30); `session_message` 439 609; `session_part` 0; `part` 1 038 362 (legacy, newest 2026-11-02). Sessions created in the prior 24 h: 268 in `session_v2`, 0 in `session`. |
| `SELECT version, count(*) FROM session_v2 GROUP BY version` | `2.2.5` 5 084; `1.19.0` 4 380; `1.19.3` 3 006 — the per-session harness semver, bare (no `v`), with multiple harness lines in one store. |
| Null/zero distributions on `session_v2` | `agent` null 23; `model` null 484; `cost` zero 3 084 and positive 9 386; all token classes zero 166 and positive 12 304; 2 918 sessions report zero cost with non-zero tokens (free models). `cost` and the token columns are `NOT NULL DEFAULT 0`. |
| `SELECT type, count(*) FROM session_message GROUP BY type` | `assistant` 408 106; `user` 14 957; `system` 7 729; `idle` 6 245; `synthetic` 1 498; `agent-switched` 871; `compaction` 162; `model-switched` 37; `location-switched` 8. |
| `json_each` key probes on `session_message.data` (assistant) | Top-level keys `agent`, `model`, `content`, `snapshot`, `finish`, `cost`, `tokens`, `time`; `tokens` keys `input`, `output`, `reasoning`, `cache`; `model` is an object. Switch events: `agent-switched` = `{time, agent, previous}`; `model-switched` = `{time, model:{id,providerID}, previous:{id,providerID,variant}}`. |
| `strings` over the installed executable | `OPENCODE_CONFIG`, `OPENCODE_CONFIG_CONTENT`, `OPENCODE_CONFIG_DIR`, `OPENCODE_CONFIG_PROJECT_DISABLE`, `OPENCODE_DB`, `OPENCODE_MODELS_PATH`, `OPENCODE_MODELS_URL`, `OPENCODE_SESSION_ID`, and other `OPENCODE_*` names. No `OC_<PREFIX>_AGENT_<SEAT>_MODEL` family and no `_AGENT_*MODEL` environment name exists, so no per-seat model variable family exists. Literal scanning does find `OC_` (31×) and `_AGENT_` (43×) substrings, but only inside unrelated tokens — `BYOC_`, `ALLOC_`, `RELOC_`, `MALLOC_`, `PROC_`, `CLAUDE_AGENT_*`, `CCR_AGENT_*`, `USER_AGENT*` — so a substring hit is not evidence of a variable family |
| `opencode debug config`, `opencode debug agents` | Configuration sources are a document (project/global) plus the `OPENCODE_CONFIG*` inputs; a document value may interpolate an environment variable. Each agent resolves a `model {id, providerID}` through that configuration surface. |
| PATH wrapper inspection | The `opencode` on `PATH` is a 98-byte shell wrapper that execs the installed binary with `--standalone` prepended — the current dispatch already runs the per-invocation private-server mode. |

**C.2 Delivered extraction assumption versus observed reality**

| Delivered assumption | Observed reality | Consequence on a real store |
|----------------------|------------------|-----------------------------|
| `session.work_item_ref` | Column absent everywhere | The extractor's first query fails → `harness.telemetry.extraction-failed`, zero rows |
| `session.harness_version` | Column absent; `session.version` holds the bare semver | Version must be sourced from `version` and normalized |
| `message.agent`, `message.model`, `message.input_tokens`, `message.output_tokens`, `message.reasoning_tokens`, `message.cache_read_tokens`, `message.cache_write_tokens`, `message.cost` | None exist; `message` carries only `data` | The aggregate query fails → extraction failure |
| `part.tool` | `part` has no `tool` column; `session_part` is unpopulated | The tool-count query fails; tool counts are absent-with-warning on this store |
| New sessions live in `session` | New sessions live in `session_v2` | Even a corrected query on `session` sees nothing created after 2026-11-02 |
| Default store path `.local/state/opencode/opencode.db` | The real DB is in the data directory (`~/.local/share/opencode/opencode.db`); the state directory holds no DB | A capture opens nothing, or a stale unrelated file |
| Per-session totals read from `message` token columns | Columns absent → every token class reads null; `calls` reads the raw message count | The baseline is silently all-null rather than reported |

**C.3 What the observation settles**

- OQ-2 is closed: there is no per-seat model variable family; the honoured surface is per-invocation selection, with configuration-document interpolation as an alternative carrier (DEC-8).
- The store contract in DM-10 is pinned, and every extraction fixture must derive from it (DEC-9).
- The version stamp has a real source (`session_v2.version`) and a real normalization (`opencode v2.2.5` → `2.2.5`) (DEC-11).
- The per-session telemetry-request surface that AC-F6-1/AC-F6-2 previously assumed does not exist and is not added (DEC-10).

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-17 | spec-writer | Initial specification for M3-S1 |
| 1.1 | 2026-11-17 | spec-writer | Readiness iteration 1 remediation: the v2.2.5 store, probe output, mode/selection/configuration surfaces, and the absent per-seat variable family are recorded as observed current truth (Appendix C); F-5/F-6 and their criteria are rebuilt against reachable surfaces; the propagation contract is pinned to the honoured per-invocation surface (DEC-8); the probe grammar and normalization are pinned (DEC-11); OQ-2 and OQ-3 are closed; three criteria are added and five are reshaped under their existing identifiers (DEC-12); a change-specific Definition of Done is added (§17.2) |
| 1.2 | 2026-11-18 | spec-writer | Readiness iteration 2 remediation: seat–spawn cardinality and seat resolution pinned to TDR-0032 (DEC-13) — one seat per spawn, resolved from the agent the run names, one `--agent`/one `--model`, seat identity recorded on the run and never sent as argv; the §4.1 propagation and telemetry metrics, F-3, §6 Flow 2, §8.2, DM-4/DM-5/DM-8, the §8.3 field table, AC-F3-1, AC-F3-4, AC-F5-1, AC-F5-3 and AC-F5-5 restated to match, with the agent-divergence axis added and the seat sourced from the recorded binding rather than the store's agent; AC-F3-4's unrecognised-harness half narrowed out (DEC-14); §10's refusal disclosure routed to the `detail.harness` envelope member (TDR-0031); DoD clauses 1, 4 and 6 made testable and non-self-deferrable; §21 corrected to the real owners of the binary name and store default; Appendix C.1 `strings` and `debug paths` rows restated precisely; OQ-4 and OQ-5 added. No AC identifier changed; 26 criteria retained |

---

## AUTHORING GUIDELINES

- Derived solely from the ticket GH-335 body, the M3 milestone pack (README, architecture, contracts, test scenarios, backlog, open questions), the delivered harness feature spec and non-functional rows, and the PM clarify_scope findings recorded in the change's pm-notes.
- The delivered seam is treated as current truth: every requirement is phrased as an addition or an evaluation of behavior that already exists, and no delivered identity, port member, or scenario is redefined.
- Gaps G1–G5 are transcribed from the PM findings; every requirement maps to at least one of them or to an explicit ticket AC.
- Nothing is invented where the source material is silent: the integration-mode selection and the harness's seat-model consumption surface are recorded as open questions with stated defaults, and both are flagged for `@decision-advisor`.
- Refusals are specified by identity, exit projection, and remediation rather than by message text, so the plan and test plan can pin the contract without re-deciding it.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-335)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] `change.milestone` equals the pm-notes milestone verbatim ("M3: Harness and tracker integrations")
- [x] All sections present in order (1–25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM- ID and use Given/When/Then
- [x] Acceptance criteria identifiers are unique and stable across the revision: 23 original identifiers retained, 3 added (AC-F1-5, AC-F5-5, AC-F5-6), 26 total (DEC-12); the iteration-2 revision changes no identifier and keeps 26 criteria (criteria are reshaped in place, never renumbered)
- [x] NFRs include measurable values
- [x] Risks include Impact and Probability with mitigation and residual risk
- [x] Every requirement that depends on the harness cites an observed fact from Appendix C, and no requirement assumes a store column the observation did not find
- [x] A change-specific, testable Definition of Done traceable to the acceptance criteria is present (§17.2)
- [x] No implementation details (no file-level task steps, no code instructions)
- [x] No content duplicated from linked docs
