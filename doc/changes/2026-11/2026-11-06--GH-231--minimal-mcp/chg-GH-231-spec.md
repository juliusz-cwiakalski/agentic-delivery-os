---
change:
  ref: GH-231
  type: feat
  status: Proposed
  slug: minimal-mcp
  title: "M1-S7: Minimal MCP"
  owners: [engineering]
  service: delivery-os MCP surface
  labels: [change, planning]
  version_impact: minor
  audience: internal
  security_impact: medium
  risk_level: medium
  dependencies:
    internal:
      - result contract and error table (stable codes, envelope, classification)
      - status digest engine (delivery.status.v1)
      - verify-change engine and delivery-result taxonomy
      - verify-gates engine (delivery.verify-gates.v1)
      - branding seam (mcpToolPrefix projection)
      - configuration layer
      - state layer verified reads
      - adapter ports, credential port, and adapter registry
      - monorepo scaffold, boundary matrix, and toolchain
    external:
      - MCP-compatible host or client (stdio transport)
      - GitHub REST API and tracker reads (indirect, via the mirrored engines)
  links:
    related_changes: ["GH-170", "GH-171", "GH-172", "GH-175", "GH-177", "GH-178"]
    related_decisions: ["ADR-0003", "TDR-0005"]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Deliver the minimal MCP surface — a thin stdio server mirroring exactly the three proven read-only engines (status, verify-artifact, gate-report) so agent sessions consume the same core results and stable error codes as the CLI through their native tool interface, while process exit codes and envelope rendering stay CLI-side per ADR-0003.

## 1. SUMMARY

This change delivers M1-S7 "Minimal MCP": the `mcp` surface package stops being a types-only scaffold and becomes a thin, read-only MCP server started as one local serve process over stdio. It mirrors exactly three proven engines — the status digest engine, the verify-change engine, and the verify-gates engine — as three tools with the canonical primitive IDs `status`, `verify-artifact`, and `gate-report`. No batch capability, no mutating tool, and no engine change are included; the scope pin is the ticket's binding decision, which itself instantiates the ADR-0003 UQ-7 mirror mandate ("same scope as CLI where technically easy; drift case by case with a recorded reason").

Mirror parity is the contract, not an aspiration. On success, a tool result carries exactly the same `data` shape the CLI carries under machine output for the same injected inputs — the `delivery.status.v1` digest, the verify-change success data, or the `delivery.verify-gates.v1` report. On failure, the tool payload carries the same stable error identity the CLI produces for the same failure, with the full contracted error-table fields (`code`, `category`, `retryable`, `consequence`, `remediationHint`, plus the optional non-identifying `summary`) inside the tool payload. What never crosses the MCP boundary is the process-exit dimension: no tool payload carries an exit code or any envelope-only field, the `CommandResult` envelope and the `{0, 1, 2}` exit projection remain CLI-owned, and a failed tool call is expressed entirely inside the tool payload while the server keeps serving.

The server itself has a pinned, deliberately small lifecycle contract: it is one local stdio process (runtime-neutral, proven under Node by the portability smoke), it exposes exactly the three tools under branding-projected names, and it exits `0` on a clean stop, `1` on a configuration error, `2` on a transport fault. Tool inputs, tool descriptions, and all returned content are treated as untrusted per the ADR-0003 security baseline; all three tools are read-only, so no mutation-authorization surface exists. Any external dependency the delivery introduces (for example an MCP protocol implementation) must carry a license-registry verdict in the same change.

## 2. CONTEXT

### 2.1 Current State Snapshot

- The three proven engines are delivered on `main-tools` and stable: the status digest engine (M0-S6, GH-175) returns the bounded `delivery.status.v1` digest with six fixed sections, a closed five-value section state vocabulary, and declared caps; the verify-change engine (M0-S8, GH-177) evaluates a change's declared full/LITE phase ledger and classifies it into the eleven-token delivery-result vocabulary; the verify-gates engine (M0-S9, GH-178) evaluates the five M0 merge gates in fixed order with cited `pass`/`fail`/`unknown` verdicts. All three are read-only, runtime-neutral, and share the core `contracts` subpath vocabulary (envelope types, error table, stable codes).
- The CLI surface wires these engines behind the deterministic in-process command surface: the `CommandResult` envelope, the classification chain with two-entry fallback containment, and the `{0, 1, 2}` exit projection. Machine output exists only under `--json`. By design, the envelope and the exit projection are CLI-owned: the boundary matrix forbids the exit projection from being imported by any non-CLI surface, and forbids `cli`/`mcp` imports in both directions. The error-table-primary decision records that MCP and OpenCode return the stable code and the structured error in their protocol and never expose a process exit code.
- The `mcp` surface package exists as scaffold only: a declared surface entry and commands/output tier aliases carrying placeholder type markers, `private: true`, inside the lockstep changesets group. The boundary matrix already reserves the MCP protocol implementation to the `mcp` package and the argument-parsing framework to the `cli` package.
- The branding seam exposes the MCP tool-name projection: a tool name is the branding-derived prefix (`mcpToolPrefix`) plus a canonical primitive ID from the core contracts; the rename drill includes an MCP tool-list snapshot. No product or binary literal may appear outside the branding module (constraint C-3).
- The M1 planning pack pins the planned contract for this story: `<binary> mcp serve`; tools `status` / `verify-artifact` / `gate-report`; tool results carry the CLI `data` shapes; tool errors carry the CLI error-table fields inside the tool payload; server exit status `0` stopped cleanly / `1` configuration error / `2` transport fault.
- ADR-0003 facts constrain the shape end to end: UQ-7 (mirror the CLI scope where technically easy; drift case by case with a recorded reason); error-table-primary (stable codes travel; exit codes never do); C-3 (naming firewall); C-9 (runtime neutrality, with the mcp surface under Node in the portability smoke); C-10 (MCP inputs, descriptions, and returned content are untrusted; a prompt-injection fixture is required; mutating tools need authorization); C-2 (every dependency passes the fail-closed license registry); C-7 (install registration applies to user-installable artifacts).
- Today no MCP surface exists. An agent session can read delivery truth only by spawning the CLI process, parsing its streams, and interpreting its process exit code.

### 2.2 Pain Points / Gaps

- Agent sessions must shell out to the CLI to read core results: argument quoting, environment handling, stream capture, and exit-code interpretation are re-implemented per host, and every integration invents its own mapping of process outcomes to agent-visible results.
- Exit-code folklore risk: the moment a host treats the CLI's process exit code as a tool verdict, the error-table-primary decision erodes — agents branch on numbers instead of stable codes, and retry decisions ignore `retryable` and `consequence`.
- Scope-drift risk: without a pinned mirror surface, MCP and CLI capabilities can diverge silently; UQ-7 requires the mirror and demands a recorded reason for any drift, which is impossible to enforce when no surface exists.
- No injection-hardened read path: tracker, CI, and ledger evidence can contain hostile text aimed at agent consumers; nothing today serves that content under the MCP untrusted-content baseline with a required prompt-injection fixture.
- The reserved surface tier is empty-but-enforced: the boundary matrix protects a package that delivers nothing, and the M1 goal "agent sessions consume the same core results through their native tool interface" is unmet.

## 3. PROBLEM STATEMENT

Because the proven engines are reachable only through the standalone CLI's process boundary, an MCP host cannot offer the same core results as native tools, so agent sessions must spawn the CLI, parse its output streams, and interpret process exit codes — re-implementing failure handling per host and recreating exactly the exit-code folklore and behavioral drift that the result contract and the UQ-7 mirror mandate were built to prevent.

## 4. GOALS

- **G-1**: One thin local MCP serve entry over stdio, owned by the `mcp` surface package, with the pinned lifecycle exit vocabulary: `0` stopped cleanly, `1` configuration error, `2` transport fault.
- **G-2**: Exactly three read-only tools with canonical primitive IDs `status`, `verify-artifact`, and `gate-report`, mapping one-to-one onto the status, verify-change, and verify-gates engines; no batch tool and no other tool.
- **G-3**: Result parity: each tool success payload equals the CLI machine-output `data` shape for the same injected inputs (`delivery.status.v1` digest, verify-change success data, `delivery.verify-gates.v1` report), with declared bounds intact.
- **G-4**: Error parity: each tool failure payload carries the same stable error-table identity and the full contracted field set (`code`, `category`, `retryable`, `consequence`, `remediationHint`, optional `summary`) the CLI produces for the same failure.
- **G-5**: Exit-code isolation: no tool payload carries an exit code or any envelope-only key; the envelope and exit projection remain CLI-owned; a failed tool call never terminates the server.
- **G-6**: Runtime neutrality: the serve entry and all three tools run under Node in the portability smoke, with no runtime-specific or ambient-global reads in the surface.
- **G-7**: Naming firewall: served tool names are the branding-derived prefix plus the canonical primitive ID; no product or binary literal anywhere in the surface.
- **G-8**: Untrusted-by-default handling: tool inputs are validated against stable codes, tool descriptions and returned content grant no authority, and a prompt-injection fixture proves it.
- **G-9**: Read-only by construction: tool calls perform zero writes, fences, state mutations, or process spawns, exactly like the engines they mirror.
- **G-10**: Thin surface: no new error-table rows, no new domain kinds, no configuration-schema keys, no state-schema changes, no engine behavior changes.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Parity fixtures passing (shared fixtures across CLI and MCP for all three tools, success and failure) | 100%, 0 drift |
| Failure payloads carrying the full contracted error field set with the CLI-identical stable code | 100% of failure fixtures |
| Exit-code fields or envelope-only keys in tool payloads | 0 |
| Boundary violations (exit-projection import, `cli`↔`mcp` edge) per PR | 0 |
| Product or binary name literals in the mcp surface | 0 |
| Node portability smoke (start, handshake, list, call × 3) | passes every PR |
| Batch, mutating, or extra tools advertised | 0 |
| Server lifecycle exits outside `{0, 1, 2}` | 0 |

### 4.2 Non-Goals

- **NG-1**: Batch capability on the MCP surface (M3-S2 per the delivery plan).
- **NG-2**: Mutating tools or any mutation-authorization/confirmation surface (no mutating tool exists in this scope).
- **NG-3**: Daemon mode, control sockets, or any long-lived multi-session server integration.
- **NG-4**: `CommandResult` envelope rendering, `--json` machine output, or exit-code projection on the MCP surface — those stay in the CLI.
- **NG-5**: OpenCode-native tools (separate stories; a distinct surface).
- **NG-6**: The status M1-S10 expansion or any status digest evolution.
- **NG-7**: Publication, `.mcpb` packaging, signing, and release-train distribution of the MCP artifact (blocked until the naming freeze; see DEC-2).
- **NG-8**: New engines, engine behavior changes, or new adapter subpaths — the surface mirrors proven engines only.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Local MCP stdio serve entry with the pinned lifecycle exit vocabulary | The one process a host launches; lifecycle codes make start/stop/fault machine-diagnosable. |
| F-2 | `status` tool mirroring the status digest engine | Session bootstrap reads the same bounded digest the CLI returns, natively. |
| F-3 | `verify-artifact` tool mirroring the verify-change engine | Finalization checks read the same ledger verdict and delivery-result classification natively. |
| F-4 | `gate-report` tool mirroring the verify-gates engine | Merge-gate evidence reads the same five-gate cited report natively. |
| F-5 | Mirror-parity payload contract (CLI `data` shapes; error-table fields; stable codes; no exit codes) | The ticket's core acceptance semantics and the UQ-7 mirror mandate, made testable. |
| F-6 | Branding-projected tool naming (prefix + canonical primitive ID) | C-3 naming firewall: the brand stays a projection; the rename stays mechanical. |
| F-7 | Untrusted-input and untrusted-content handling on a read-only surface | C-10 baseline: hostile content never grants authority; prompt-injection fixture required. |

### 5.1 Capability Details

- **F-1 — Serve entry.** One local process speaking the MCP protocol over stdio, started with the serve semantics of the design baseline's `<binary> mcp serve`, where `<binary>` is realized through the branding-derived entry name (never a hardcoded product literal; see DEC-1). The process supports the minimal protocol exchange a host needs: initialization, tool discovery, and tool invocation. Its exit status carries exactly three meanings — `0` after a clean stop, `1` when it cannot start due to a configuration error, `2` on a transport fault — and never re-projects any tool outcome (DEC-6).
- **F-2 — status tool.** No tool parameters (the CLI `status` command takes none). A call drives the status digest engine with the same injected sources and returns the `delivery.status.v1` digest as the tool result. Section-level failures remain digest data, exactly as in the CLI: a degraded or unavailable section is truthful digest content, not a tool error; only containment-class failures fail the tool.
- **F-3 — verify-artifact tool.** Exactly one parameter, the change ref. A call drives the verify-change engine and returns the same success data the CLI `verify change` carries, or the same classified failure: `lint.target.missing` for an unresolvable ref, `lint.notes.malformed` / `lint.variant.unknown` for a broken declaration, `lint.phases.incomplete` / `verify.ledger.incomplete` for an incomplete ledger, and the platform-class `state.*` identities for untrustworthy registry evidence — identical codes and fields to the CLI for the same fixture.
- **F-4 — gate-report tool.** Exactly one parameter, the change ref. A call drives the verify-gates engine and returns the `delivery.verify-gates.v1` report with all five gate verdicts, or the same classified failures as the CLI `verify gates`: `verify.gates.failed` for a definitive gate failure, `verify.gates.unavailable` for unreadable evidence, and the first unknown gate's classified identity where the CLI classifies it that way.
- **F-5 — Mirror-parity payload contract.** Tool success payloads carry the CLI `data` shape only — no `schemaVersion`/`exitCode`/`timing` envelope keys. Tool failure payloads carry the contracted error fields (`code`, `category`, `retryable`, `consequence`, `remediationHint`, optional `summary`) inside the tool payload, with the identity resolved through the same classification chain the CLI uses, so codes are stable and identical across surfaces. Argument-shape violations (missing or invalid change ref) map to the CLI's grammar-rejection analogue `input.value.rejected`, preserving mirror parity rather than inventing a protocol-only error. Protocol-framing failures below the tool layer are transport concerns governed by F-1's lifecycle, not tool outcomes.
- **F-6 — Branding-projected naming.** The served tool name is the branding module's tool prefix plus the canonical primitive ID; the primitive IDs are the stable identity, the served names are the projection. Tool descriptions are static, secret-free, and name-free of the product beyond what branding injects.
- **F-7 — Untrusted handling.** Tool inputs are validated once at the boundary against stable codes; hostile or malformed input never crashes the server and never escalates authority. Returned content — including tracker, CI, and ledger evidence that may carry injected instructions — is inert payload data: the server never acts on it, never elevates it into tool descriptions or authority decisions, and the required prompt-injection fixture demonstrates this end to end. All three tools are read-only, so no mutation-authorization surface exists or is needed.

## 6. USER & SYSTEM FLOWS

```
Flow 1: Normal discovery and read
  MCP host launches the serve process (stdio)
    → host and server complete the protocol handshake
    → host lists tools: exactly three branding-projected names (status, verify-artifact, gate-report)
    → host calls `status` with no arguments
    → server drives the status engine with its composed sources
    → tool result payload = the delivery.status.v1 digest (CLI data shape, bounds intact)
    → host consumes the digest; server stays running

Flow 2: Classified tool failure
  Host calls `verify-artifact` with a ref whose pm-notes target does not resolve
    → server drives the verify-change engine → lint.target.missing
    → tool payload carries code/category/retryable/consequence/remediationHint inside the payload
    → no exit code, no envelope keys; the server continues serving
    → the host branches on the stable code, honors retryable/consequence, and follows the hint

Flow 3: Server lifecycle
  a) Host closes the session cleanly → server stops → exit 0
  b) Server starts with an invalid/unresolvable configuration → diagnostic on the diagnostics
     channel (never the transport channel) → exit 1
  c) Transport fault (broken/unreadable protocol channel) → exit 2
  Tool outcomes never produce any of these exits; they live inside tool payloads only.
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The `mcp` surface package filled from scaffold to a working thin server: serve entry, protocol handling over stdio, and the three tools.
- The three read-only tool mappings onto the proven engines (`status` → status engine; `verify-artifact` → verify-change engine; `gate-report` → verify-gates engine), with the same core result and error payloads as the CLI.
- The branding-projected tool-name projection through the existing branding module.
- Mirror-parity fixtures shared with the CLI surface (same inputs, byte-equal `data`, identical stable codes).
- The prompt-injection fixture and untrusted-content handling tests.
- The Node portability smoke covering the serve entry and all three tools.
- Reconciliation of the transport lifecycle exit vocabulary with the existing exit-literal invariant, which continues to forbid the CLI projection role outside the CLI (DEC-6).
- License-registry verdicts for any external dependency the delivery introduces (C-2), plus the standing vulnerability gate.
- Tests for all of the above.

### 7.2 Out of Scope

- [OUT] Batch capability (M3-S2).
- [OUT] Any mutating tool, write path, or mutation-authorization/confirmation surface.
- [OUT] Daemon mode, control-socket integration, or multi-session server management.
- [OUT] Envelope rendering (`--json`), the exit-code projection, or any `CommandResult` envelope field on the MCP surface — CLI-only concerns per ADR-0003 and the ticket pin.
- [OUT] OpenCode-native tools (separate surface, separate stories).
- [OUT] Status digest evolution (M1-S10) or any engine behavior change.
- [OUT] Publication, `.mcpb` manifest production, signing, checksums, and release-train distribution of the MCP artifact (NG-7; blocked until the naming freeze).
- [OUT] Changes to the CLI surface, the engines, the error table, the configuration schema, or the state schema.

### 7.3 Deferred / Maybe-Later

- Install registration of the MCP artifact in the installer, with checksum/signature mechanics — lands with the publication/distribution change once the naming freeze unblocks artifacts (per DEC-2 and the ADR rule that the MCP artifact is registered even as a Node entry point).
- Full server lifecycle gates from the ADR surface plan — health/readiness probes, concurrency limits, and runbook formalization beyond the pinned exit vocabulary — when usage justifies them.
- MCP resources/prompts protocol surfaces, if a later story needs them (this change ships tools only).
- Batch tool (M3-S2).

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — the surface is a local stdio server; it opens no network listener.

### 8.2 Events / Messages

The protocol surface is MCP over stdio: initialization, tool discovery, and tool invocation. The tool contract table is the binding interface:

| Canonical primitive ID | Parameters (untrusted, validated) | Mirrored engine | Success payload | Failure payload (stable codes, CLI-identical) |
|---|---|---|---|---|
| `status` | none | status digest engine | the `delivery.status.v1` digest (CLI `data` shape; six sections; declared bounds) | containment-class identity only (`fallback.internal` analogue), since section failures are digest data |
| `verify-artifact` | exactly one change ref | verify-change engine | the verify-change success data (variant, outcome, phase evidence) — CLI `data` shape | `lint.target.missing`, `lint.notes.malformed`, `lint.variant.unknown`, `lint.phases.incomplete`, `verify.ledger.incomplete`, platform-class `state.*` — identical to CLI `verify change` |
| `gate-report` | exactly one change ref | verify-gates engine | the `delivery.verify-gates.v1` report (five cited gate verdicts) — CLI `data` shape | `verify.gates.failed`, `verify.gates.unavailable`, or the first unknown gate's classified identity; `input.value.rejected` for a missing/invalid ref — identical to CLI `verify gates` |

Contract rules: served tool names are the branding prefix plus the primitive ID; failure payloads carry exactly the contracted error fields and never an exit code; protocol-framing failures below the tool layer are governed by the serve lifecycle (F-1), never rendered as tool results.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | status tool payload | Derived view of the existing `delivery.status.v1` digest; no new schema, no new bounds. |
| DM-2 | verify-artifact payload | Derived view of the existing verify-change success data / error identity set; no new schema. |
| DM-3 | gate-report payload | Derived view of the existing `delivery.verify-gates.v1` report; no new schema. |
| DM-4 | tool error payload shape | The contracted error-table field set (`code`, `category`, `retryable`, `consequence`, `remediationHint`, optional `summary`) carried inside the tool payload; no exit-code field; no new error-table rows or domain kinds. |

No new error-table rows, no new domain kinds, no configuration-schema keys, and no state-schema changes are introduced. The error table's documented-row binding is untouched.

### 8.4 External Integrations

- **MCP hosts/clients**: any MCP-compatible host connecting over local stdio. The host is untrusted context: it supplies tool calls and receives bounded payloads; it grants the server nothing.
- **Tracker and CI reads** (indirect): unchanged — performed by the mirrored engines through the existing adapters under the same bounded-read and classification rules as the CLI. The surface adds no new provider read, page, or retry behavior.

### 8.5 Backward Compatibility

Fully additive. The CLI surface, engines, contracts, error table, configuration, and state schemas are unchanged; the scaffold's placeholder type markers are replaced by the real surface within the same package and declared entry points, so no consumer of the scaffold exists to break. The exit-literal invariant's scan scope already covers the mcp surface; this change reconciles it with the new transport lifecycle vocabulary in the same change (DEC-6) without weakening the invariant's CLI-projection rule. No published artifact exists (all packages remain private until the naming freeze), so there is no external consumer to migrate.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Result parity: tool success payloads equal the CLI machine-output `data` for the same injected inputs, across the shared fixture set | 100% of shared fixtures; 0 drift |
| NFR-2 | Error parity: tool failure payloads carry the CLI-identical stable code and the full contracted field set | 100% of failure fixtures |
| NFR-3 | Exit-code isolation: zero exit-projection imports into the mcp surface and zero exit-code or envelope-only fields in any tool payload | 0 violations per PR (boundary + payload checks) |
| NFR-4 | Runtime neutrality: the serve entry and all three tools run under Node in the portability smoke; no runtime-specific imports or ambient-global reads in the surface | smoke passes every PR; 0 ambient-global reads |
| NFR-5 | Naming firewall: no product/binary literal in the surface; served names derive from branding + primitive ID; the rename drill's MCP tool-list snapshot reflects only the branding change | 0 literals; snapshot passes |
| NFR-6 | Lifecycle exit vocabulary: the serve process exits with exactly `0` (clean stop), `1` (configuration error), `2` (transport fault), and nothing else | 100% of lifecycle fixtures; 0 other codes |
| NFR-7 | Read-only guarantee: tool calls perform zero writes, fences, state mutations, or process spawns | 0 across all fixtures and smoke |
| NFR-8 | Determinism: identical injected inputs and protocol exchanges yield identical tool payloads | byte-identical on replay |
| NFR-9 | Dependency compliance: every external dependency added by this change carries a license-registry verdict in the same change; the fail-closed audit and the vulnerability gate pass | audit green; 0 high/critical findings |
| NFR-10 | Transport-channel integrity: no diagnostic or non-protocol byte is ever written to the stdio transport channel; diagnostics go to the diagnostics channel only | 0 protocol-corrupting writes in tests |
| NFR-11 | Payload bounds: tool payloads respect the engines' declared caps, so a tool payload never exceeds the CLI machine data for the same inputs | 0 exceedances |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- No metrics or traces are introduced; the minimal surface logs lifecycle lines only (start, clean stop, configuration error, transport fault) on the diagnostics channel, never the transport channel (NFR-10).
- The command audit ledger stays a CLI-surface composition concern: the mcp surface writes no audit records and mutates no state, consistent with its read-only guarantee.
- Diagnosability is carried by the contracts themselves: hosts correlate failures through stable codes, and the serve lifecycle exits distinguish misconfiguration (1) from transport fault (2) without log access.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | A candidate external MCP protocol dependency fails the fail-closed license registry (C-2) or the vulnerability gate, forcing rework | M | M | Decide the protocol approach at delivery planning with the registry verdict as the gate; a minimal in-package stdio protocol implementation is the fallback that avoids the dependency entirely | L — either path satisfies the same tool contract |
| RSK-2 | Hostile content in tracker/CI/ledger evidence injects instructions into agent consumers via tool payloads | H | M | C-10 baseline: inputs, descriptions, and returned content are untrusted; the server never acts on content; the required prompt-injection fixture proves inertness end to end | L–M — content still reaches the host, but grants no authority and follows no instruction from this surface |
| RSK-3 | Mirror drift as the CLI evolves: tools silently diverge from CLI data shapes or codes, eroding UQ-7 | M | M | Shared parity fixtures across both surfaces run in CI; any deliberate drift requires a recorded reason per UQ-7 | L — drift becomes a visible CI failure or a recorded decision |
| RSK-4 | Hosts misread the server lifecycle exits as tool verdicts, recreating exit-code folklore at the MCP boundary | M | M | AC pins that tool outcomes never affect the process exit; a failed tool call is followed by continued service in tests; payload contract carries no exit-code field | L |
| RSK-5 | Concurrent tool calls from multiple hosts/agents contend on shared state reads | L | L | All three engines are read-only over verified reads; the delivery decides serialize-vs-concurrent within the determinism constraint (OQ-2) and documents it | L |
| RSK-6 | The Node portability smoke exposes runtime-specific assumptions in the surface's composition path | M | L | Boundary rules already confine runtime APIs to allowed locations; the smoke runs from the first delivery iteration, so leaks surface immediately | L |
| RSK-7 | The exit-literal invariant reconciliation is done loosely, weakening the CLI-projection rule | M | L | DEC-6 pins the direction: the invariant learns the transport lifecycle vocabulary without granting the mcp surface the projection role; mutation-suite coverage extends to the change | L |

## 12. ASSUMPTIONS

- The three proven engines and their contracts remain unchanged by this change; any engine evolution is a separate story.
- The mcp package's declared workspace imports (the core entry, contracts, state, and branding subpaths, plus the adapter subpaths) are sufficient to compose the three engines through the shared composition root; no boundary-matrix change is required.
- The design baseline's `<binary> mcp serve` denotes the branding-derived server entry name of the mcp surface — not a new subcommand of the standalone CLI binary, which the boundary matrix forbids (cli↔mcp imports are prohibited in both directions).
- The canonical primitive IDs are exactly `status`, `verify-artifact`, and `gate-report`, matching the design baseline and the M1 architecture note ("status, verify, gate report").
- No new error-table rows, domain kinds, configuration keys, or state schemas are needed to serve the three tools.
- Publication remains blocked until the naming freeze; no user-installable artifact ships in this change, so C-7 install registration is not triggered (DEC-2).
- The minimal protocol exchange needed is initialize + tool discovery + tool invocation over stdio; resources/prompts surfaces are not required.
- Engine outputs already exclude secret material; the mcp layer adds no redaction obligation beyond parity with the CLI's machine data.
- The host supplies agent context; the server treats all of it — inputs, descriptions, returned content — as untrusted and grants no authority from content.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Status digest engine and its contract (GH-175) | Proven engine mirrored by the `status` tool. |
| Depends on | Verify-change engine and delivery-result taxonomy (GH-177) | Proven engine mirrored by the `verify-artifact` tool. |
| Depends on | Verify-gates engine (GH-178) | Proven engine mirrored by the `gate-report` tool. |
| Depends on | Result contract and error table (GH-172) | Stable codes and the error field set travel in tool payloads; envelope/exit stay CLI-side. |
| Depends on | Branding seam (GH-171) | `mcpToolPrefix` projection for tool names; C-3 compliance. |
| Depends on | Monorepo scaffold and boundary matrix (GH-170) | Package placement, protocol-implementation confinement, exit-projection non-import rule. |
| Depends on | Configuration and state layers, adapter ports/registry | Substrates the engines already consume; consumed unchanged. |
| Blocks | Later MCP growth (batch M3-S2, mutating tools, daemon integration) | This change establishes the surface pattern, naming projection, and parity-fixture discipline they extend. |
| Blocks | OpenCode-native tool stories (indirectly) | They consume the same core results; the mirror contract keeps the two surfaces honest. |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Protocol implementation: an external MCP protocol dependency or a minimal in-package stdio protocol implementation? | ADR-0003 confines the protocol implementation to the mcp package; C-2 requires a registry verdict for any external dependency in the same change; RSK-1 records the fallback. | Resolved at delivery planning within pinned constraints — no human gate required |
| OQ-2 | Concurrency policy: serve tool calls concurrently or serialize them? | All three engines are read-only over verified reads, so both are safe; determinism (NFR-8) and bounded reads must hold either way. | Resolved at delivery planning within pinned constraints — no human gate required |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Artifact/entry form: a Node-hosted stdio server entry owned by the mcp surface package, started with the design baseline's serve semantics (`<binary> mcp serve`, `<binary>` realized through branding-derived naming); not a CLI subcommand and not a second Bun-compiled binary | The boundary matrix forbids cli→mcp imports, so a CLI-hosted subcommand is not available without re-opening ADR-0003; ADR-0003 explicitly allows a Node-hosted process, the Node portability smoke proves it, and one entry avoids a second installable artifact and keeps the surface thin (UQ-7/thin-mandate) | 2026-11-06 |
| DEC-2 | No installer registration in this change (C-7 not triggered) | All packages remain `private: true` until the naming freeze and publication is blocked, so no user-installable artifact ships; registration lands with the publication/distribution change, which will register the MCP artifact even as a Node entry point per ADR-0003 | 2026-11-06 |
| DEC-3 | Mirror scope pinned to exactly three read-only tools (`status`, `verify-artifact`, `gate-report`); no batch | Ticket pin instantiating UQ-7; any future drift from CLI scope requires a recorded reason per UQ-7 | 2026-11-06 |
| DEC-4 | Tool payloads carry CLI `data` shapes and error-table fields only; the `CommandResult` envelope and the exit projection stay CLI-side; no exit code crosses the MCP boundary | Ticket acceptance criterion; error-table-primary decision; ADR-0003 rule that MCP returns the stable code and structured error in its protocol and never exposes a process exit code | 2026-11-06 |
| DEC-5 | Tool naming is the branding prefix plus the canonical primitive IDs `status` / `verify-artifact` / `gate-report` | C-3 naming firewall: the primitive ID is the stable identity, the served name is a projection; the rename drill's MCP tool-list snapshot stays mechanical | 2026-11-06 |
| DEC-6 | The serve lifecycle exit vocabulary (`0` clean stop, `1` configuration error, `2` transport fault) is an mcp-edge-owned transport contract, distinct from the CLI error-table projection; the exit-literal invariant is reconciled with it in the same change without granting the mcp surface the CLI projection role | The design baseline pins the three lifecycle codes; without an explicit ownership boundary the invariant would either block the lifecycle or be weakened in the wrong direction | 2026-11-06 |
| DEC-7 | Argument-shape violations (missing/invalid change ref) map to the CLI grammar-rejection analogue `input.value.rejected` inside the tool payload | Mirror parity: hosts get the same stable identity the CLI produces for the same caller fault, instead of a protocol-only error code | 2026-11-06 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `mcp` surface package | New — filled from types-only scaffold to the working server (entry, protocol, three tools). |
| Core `contracts` subpath | Unchanged — consumed read-only for stable codes and data shapes. |
| Core domain engines (status, verify-change, verify-gates) | Unchanged — mirrored as-is. |
| Adapters (ports, registry, provider reads) | Unchanged — consumed indirectly through the engines. |
| Branding module | Unchanged — `mcpToolPrefix` consumed for the tool-name projection. |
| `cli` surface package | Unchanged — envelope and exit projection remain here; no cross-imports. |
| Testkit and shared test surfaces | Updated — shared parity/golden fixtures extended to the MCP surface; prompt-injection and lifecycle fixtures added. |
| Exit-literal invariant | Updated — reconciled with the transport lifecycle vocabulary per DEC-6, projection rule intact. |
| Dependency license registry | Updated — verdicts for any external dependency introduced (C-2), in the same change. |
| Installer | Unchanged — explicitly not registered this change (DEC-2). |
| CI | Updated — Node portability smoke and parity fixtures wired into the existing gate battery. |
| Documentation | New — first MCP feature spec page created at system-spec update; surface-mapping note checked on the result-contract page; any new doc carries the distribution marker. |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F2-1 | **Given** the shared status fixtures (observed, degraded, unavailable, not-delivered variants), **when** the `status` tool is called with the same injected inputs the CLI fixtures use, **then** the tool success payload equals the CLI machine-output `data` byte-for-byte — same digest schema, sections, states, bounds — with no envelope keys and no exit-code field. | F-2, F-5, NFR-1, NFR-3 |
| AC-F3-1 | **Given** the shared verify-change fixtures (finished, partial, missing target, malformed declaration, untrustworthy registry), **when** the `verify-artifact` tool is called, **then** success payloads equal the CLI `verify change` data and failure payloads carry the identical stable code (`lint.target.missing`, `lint.notes.malformed`, `lint.variant.unknown`, `lint.phases.incomplete`, `verify.ledger.incomplete`, or the platform-class `state.*` identity) with the full contracted field set. | F-3, F-5, NFR-1, NFR-2 |
| AC-F4-1 | **Given** the shared verify-gates fixtures (all-pass, definitive fail, unavailable evidence, classified unknown), **when** the `gate-report` tool is called, **then** success payloads equal the `delivery.verify-gates.v1` report and failure payloads carry the identical stable code (`verify.gates.failed`, `verify.gates.unavailable`, or the first unknown gate's classified identity) with the full contracted field set. | F-4, F-5, NFR-1, NFR-2 |
| AC-F5-1 | **Given** every failure fixture across the three tools, **when** the tool payload is inspected, **then** it carries exactly the contracted error fields (`code`, `category`, `retryable`, `consequence`, `remediationHint`, and `summary` where the CLI carries one), the code is identical to the CLI's for the same failure, and no field is missing, extra, or protocol-invented. | F-5, NFR-2 |
| AC-F5-2 | **Given** a tool call with a missing or invalid change ref, **when** the server validates the argument at the boundary, **then** the tool payload carries `input.value.rejected` (the CLI grammar-rejection analogue), the server does not crash, and the failure is not reported as a transport fault. | F-5, F-7, NFR-2 |
| AC-F5-3 | **Given** any tool outcome, **when** the payload and the surface's imports are inspected, **then** no payload carries an exit code or an envelope-only key (`schemaVersion`, `exitCode`, `timing`), zero exit-projection imports exist in the surface, and a failed tool call is followed by continued serving — the process exit is unaffected by tool outcomes. | F-5, NFR-3 |
| AC-F1-1 | **Given** the three lifecycle scenarios, **when** the host closes the session cleanly, the server starts with an unresolvable configuration, or the transport channel faults, **then** the server process exits `0`, `1`, and `2` respectively, the configuration diagnostic is written only to the diagnostics channel, and no other exit value ever occurs. | F-1, NFR-6, NFR-10 |
| AC-F1-2 | **Given** a connected host, **when** it requests tool discovery, **then** exactly three tools are advertised — the branding-prefixed `status`, `verify-artifact`, and `gate-report` — and no batch, mutating, or additional tool exists anywhere in the surface. | F-1, F-5, DEC-3 |
| AC-F1-3 | **Given** the Node portability smoke, **when** the serve entry starts under Node, **then** the handshake completes, the three tools are listed, all three tools serve their fixtures, and the surface contains no runtime-specific import or ambient-global read. | F-1, F-6, NFR-4 |
| AC-F1-4 | **Given** the dependency set the delivery introduces, **when** the fail-closed license audit and the vulnerability gate run, **then** every external dependency carries a registry verdict added in the same change and both gates are green. | F-1, NFR-9 |
| AC-F6-1 | **Given** the branding seam, **when** tool names are projected and the rename drill runs, **then** every served tool name equals the branding prefix plus its canonical primitive ID, the surface contains zero product or binary literals, and the MCP tool-list snapshot changes only with the branding change. | F-6, NFR-5 |
| AC-F7-1 | **Given** hostile instruction content planted in tracker, CI, and ledger evidence fixtures, **when** any tool returns that content, **then** it appears only as inert payload data, the server takes no action on it, no authority is granted from it, and the required prompt-injection fixture passes. | F-7, NFR-10 |
| AC-F7-2 | **Given** any sequence of tool calls across the three tools, **when** the run completes, **then** zero writes, fences, state mutations, or process spawns occurred — the state store and all documents are byte-identical before and after. | F-7, NFR-7 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Delivered through the standard 11-phase lifecycle on a feature branch targeting `main-tools`; the change is additive and reversible by a single revert (no CLI, engine, or schema behavior changes ride along).
- Adoption is opt-in: an operator or agent host explicitly launches the serve process; no default wiring, daemon, or auto-start ships in this change.
- At system-spec update, the doc-syncer creates the first MCP feature spec page (none exists today) and checks whether the result-contract page needs a surface-mapping note recording that MCP tool results carry the CLI data shapes while envelope rendering stays CLI-side; every new doc under the documentation tree declares its distribution marker.
- The parity fixtures, prompt-injection fixture, and Node smoke become standing CI gates for the surface, so future MCP work inherits the mirror discipline automatically.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A — the surface is read-only; it introduces no state, no schema, and no seed data. Existing state stores, configuration, and documents are consumed unchanged.

## 20. PRIVACY / COMPLIANCE REVIEW

- Tool payloads are derived views of engine outputs the CLI already exposes to the same operator on the same machine; the surface adds no new data egress, no network listener, and no cloud interaction.
- The engines' bounded-evidence discipline carries over: payloads never contain raw provider payloads, credentials, or free-form remote content beyond the declared bounds; nothing new to redact is introduced.
- Local-first boundary respected: the server talks stdio to a local host and the engines' existing tracker/CI reads; no new external destination is added.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Untrusted inputs (C-10)**: tool arguments are validated once at the boundary against stable codes (`AC-F5-2`); malformed or hostile input never crashes the server and never escalates authority.
- **Untrusted descriptions and content (C-10)**: tool descriptions are static and secret-free; returned content — including evidence that may carry injected instructions — is inert data. The required prompt-injection fixture (`AC-F7-1`) proves no authority flows from content.
- **No mutation authorization surface needed**: all three tools are read-only (mirroring read-only engines), so the ADR mutation-authorization requirement has no object in this scope; the read-only guarantee is tested (`AC-F7-2`).
- **Transport exposure**: local stdio only; no network listener; the diagnostics channel is separate from the transport channel so diagnostics never leak into protocol traffic (`NFR-10`).
- **Exit-code isolation as a security property**: hosts that might otherwise infer state from process exits are forced onto stable codes with explicit `retryable`/`consequence` semantics, removing the guesswork channel (`AC-F5-3`).
- **Supply chain (C-2)**: any external dependency carries a registry verdict in the same change and passes the vulnerability gate (`AC-F1-4`); the protocol implementation stays confined to the mcp surface package.

## 22. MAINTENANCE & OPERATIONS IMPACT

- New standing obligation: mirror parity. CLI-visible data shapes and codes evolve; the shared fixtures make drift a CI failure, and any deliberate drift needs a recorded reason per UQ-7.
- The Node portability smoke becomes a permanent gate for the surface, protecting runtime neutrality as the surface grows.
- The MCP protocol implementation (dependency or in-package) rides the lockstep changesets group with the rest of the workspace; upgrades are ordinary lockfile changes under the same license/vulnerability gates.
- Operations remain minimal by design: one local process, three lifecycle exit meanings, diagnostics on a separate channel; the feature spec page documents start/stop/fault behavior for hosts.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| MCP | Model Context Protocol — the standard protocol an agent host uses to discover and call tools exposed by a server. |
| stdio transport | Serving the protocol over the process's standard streams; the transport channel must carry protocol bytes only. |
| Tool (MCP) | A host-invocable operation advertised by the server; here, a thin mirror of one proven engine. |
| Canonical primitive ID | The stable, brand-neutral tool identity from the core contracts; the served name is branding prefix + primitive ID. |
| Mirror parity | The UQ-7 discipline: the MCP tool returns the same core result and stable error codes as the CLI for the same inputs. |
| Envelope | The CLI-owned `CommandResult` rendering (`schemaVersion`, `runId`, `exitCode`, `timing`, `data`/`error`); never rendered on the MCP surface. |
| Error table | The machine-readable, single source of failure identity: stable code, category, retryability, consequence, remediation hint. |
| Exit projection | The CLI-only mapping of a failure's projection class to the `{0, 1, 2}` process exit code. |
| Proven engine | A delivered, tested core domain engine (status, verify-change, verify-gates) that the surface mirrors without modification. |
| Portability smoke | The CI check that runs a surface under a second runtime host (Node) to prove runtime neutrality (C-9). |
| Prompt injection | Hostile instructions embedded in content (inputs, descriptions, returned evidence) attempting to steer an agent; handled by treating all of it as untrusted data. |
| Naming firewall | Constraint C-3: no product/binary literal outside the branding module; names are projections, so rename stays mechanical. |
| Transport fault | A failure of the protocol channel itself (broken/unreadable stdio), distinct from any tool outcome; server exit `2`. |

## 24. APPENDICES

### Appendix A — Engine-to-tool mapping

| Design-baseline tool | Canonical primitive ID | Mirrored engine (delivered in) | CLI analogue | Success data shape | Dominant failure identities |
|---|---|---|---|---|---|
| status | `status` | status digest engine (M0-S6, GH-175) | `status --json` | `delivery.status.v1` digest | containment-class only (section failures are digest data) |
| verify-artifact | `verify-artifact` | verify-change engine (M0-S8, GH-177) | `verify change <ref> --json` | verify-change success data (variant, outcome, phase evidence) | `lint.target.missing`, `lint.notes.malformed`, `lint.variant.unknown`, `lint.phases.incomplete`, `verify.ledger.incomplete`, `state.*` (platform) |
| gate-report | `gate-report` | verify-gates engine (M0-S9, GH-178) | `verify gates <ref> --json` | `delivery.verify-gates.v1` report | `verify.gates.failed`, `verify.gates.unavailable`, classified first-unknown-gate identity, `input.value.rejected` (bad ref) |

### Appendix B — Binding ADR-0003 constraints honored by this change

| Constraint | How this change honors it |
|---|---|
| UQ-7 (mirror scope) | Exactly the three proven-engine tools; scope pin recorded (DEC-3); drift requires a recorded reason. |
| Error-table-primary | Stable codes and error fields travel in tool payloads; no process exit code crosses the boundary (DEC-4, AC-F5-3). |
| C-3 (naming firewall) | Tool names are branding prefix + primitive ID; zero product literals (F-6, AC-F6-1). |
| C-9 (runtime neutrality) | Node-hosted entry (DEC-1); Node portability smoke gates every PR (NFR-4, AC-F1-3). |
| C-10 (untrusted surface) | Inputs/descriptions/content untrusted; prompt-injection fixture; read-only scope needs no mutation authorization (F-7, AC-F7-1/2). |
| C-2 (license registry) | Every external dependency carries a same-change registry verdict; fail-closed audit and vulnerability gate green (AC-F1-4). |
| C-7 (install registration) | Explicitly not triggered — no user-installable artifact ships (DEC-2); registration lands with publication. |

### Appendix C — Design baseline reference

The planned contract pinned by the M1 planning pack (design baseline man page for the mcp command) is adopted with two reconciliations recorded in this spec: the concrete artifact/entry form is decided as the Node-hosted stdio serve entry (DEC-1, resolving the pm open question within ADR-0003's "both acceptable" fact), and the lifecycle exit vocabulary is owned by the mcp edge as a transport contract, distinct from the CLI exit projection (DEC-6).

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-06 | @spec-writer | Initial specification for GH-231 (M1-S7: Minimal MCP). |

---

## AUTHORING GUIDELINES

- Sources: GitHub issue #231 (M1-S7, milestone M1) and its pinned decisions; the pm planning summary verified against the system spec; the M1 design baseline man page for the mcp command; the system spec pages for the result contract, status digest, verify-change, verify-gates, monorepo scaffold, and branding seam; ADR-0003 (UQ-7, C-2/C-3/C-7/C-9/C-10, error-table-primary rule, boundary matrix); the GH-170 scaffold decision log (artifact form); the pm-notes for GH-231.
- The artifact/entry-form question from pm-notes was resolved inside this spec (DEC-1) as instructed — not deferred to a human gate; OQ-1/OQ-2 remain deliberately scoped as delivery-planning freedoms within pinned constraints.
- Scope discipline: everything outside the three read-only tools and their server is out of scope or deferred; no engine, CLI, schema, or installer behavior changes are included.
- All binding constraints were converted into testable acceptance criteria; assumptions made while deriving them are recorded in Section 12.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-231)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-)
- [x] Acceptance criteria reference at least one F-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths, no step-by-step tasks)
- [x] No content duplicated from linked docs (engine behavior referenced, not restated)
- [x] Front matter validates per front_matter_rules
