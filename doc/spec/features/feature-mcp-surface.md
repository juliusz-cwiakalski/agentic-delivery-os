---
ados_distribution: internal
id: SPEC-MCP-SURFACE
status: Current
created: 2026-11-06
last_updated: 2026-11-07
owners: ["engineering"]
service: delivery-os
summary: "The minimal read-only MCP surface: a thin Node-hosted stdio JSON-RPC 2.0 server in packages/mcp, exactly three branding-projected tools mirroring the status digest, verify-change, and verify-gates engines, CLI data-shape and error-table payload parity with no envelope or exit-code leakage, single-flight calls, the {0, 1, 2} server lifecycle exit vocabulary owned by the lifecycle module, runtime-neutral composition with the documented serve-root allowances, and untrusted-input plus inert-content handling."
links:
  related_changes: ["GH-231", "GH-236", "GH-288"]
  related_decisions: ["ADR-0003", "TDR-0005"]
  contracts:
    - "packages/mcp/src/commands/catalog.ts"
    - "packages/mcp/src/output/payload.ts"
    - "packages/mcp/src/output/protocol.ts"
    - "packages/mcp/src/lifecycle.ts"
---

# Feature: MCP Surface

## Overview

The MCP surface is the local, read-only tool interface to the delivery engines. It is one Node-hosted process that speaks a newline-delimited JSON-RPC 2.0 subset over stdio, advertises exactly three tools, and returns the same core result and classified error payloads the CLI returns for the same inputs. The surface is owned by `@delivery-os/mcp`.

The package root (`@delivery-os/mcp`) exports the pure surface: the closed tool catalog, the toolset seam, and the payload contract types. The process entry is the declared `./serve` subpath; importing it starts the protocol loop at module load. The package declares no `bin` and registers nothing with the installer.

Mirror parity is the payload contract. A successful tool result carries the engine data by reference from `@delivery-os/core/contracts`: the `delivery.status.v1` digest, the verify-change success data, or the `delivery.verify-gates.v1` report. A failed tool result carries the CLI `CommandResultError` field set — `code`, `category`, `retryable`, `consequence`, and `remediationHint`, with the optional non-identifying `summary` — resolved against the shared `ERROR_TABLE` data. No `CommandResult` envelope field crosses the boundary: no `runId`, `exitCode`, or `timing`, and no `delivery.result.v1` wrapper. Envelope rendering and the CLI `{0, 1, 2}` exit projection remain CLI-owned.

The transport implementation is in-package and declares zero external dependencies. Tool calls are serialized single-flight in arrival order. The catalog, toolset, payload adapter, and protocol handlers are runtime-neutral, and the lifecycle module owns only the process-exit member; the serve composition root is the one Node stdio edge and performs the one startup configuration-environment read. Tool inputs, tool descriptions, and returned content are untrusted data: validation failures carry stable error-table codes, and returned evidence grants no authority.

## Tool catalog

Exactly three read-only tools exist. Each served name is `BrandIdentity.mcpToolPrefix` plus the canonical tool ID; the canonical ID is the stable identity and the served name is the branding projection.

| Canonical tool ID | Parameters | CLI analogue | Mirrored engine | Success payload | Failure payload |
|---|---|---|---|---|---|
| `status` | none | `status --json` | Status digest engine | `delivery.status.v1` digest | containment identity only (`fallback.internal` analogue); section failures are digest data |
| `verify-artifact` | exactly one `ref` | `verify change <ref> --json` | Verify-change engine | verify-change success data (`changeRef`, `target`, `result`, variant, required/completed/missing phases, evidence) | `lint.target.missing`, `lint.notes.malformed`, `lint.variant.unknown`, `lint.phases.incomplete`, `verify.ledger.incomplete`, platform-class `state.*`, or `input.value.rejected` for a boundary rejection |
| `gate-report` | exactly one `ref` | `verify gates <ref> --json` | Verify-gates engine | `delivery.verify-gates.v1` report (five cited gate verdicts) | `verify.gates.failed`, `verify.gates.unavailable`, the classified first-unknown-gate identity, or `input.value.rejected` for a boundary rejection |

Tool descriptions are static, secret-free, and interpolate no product, binary, scope, or environment value beyond the branding prefix. The input schema declares a closed object: the two ref tools require one non-empty string `ref` and declare no additional properties; `status` accepts an empty object. The runtime validates the `ref` value once at the toolset boundary. There is no batch tool, mutating tool, resource surface, or prompt surface.

A `status` call drives the status digest engine with the injected readers and returns the digest. Section-level read failures remain digest content: a degraded, unavailable, or not-delivered section is truthful data inside a successful tool result, and only a containment-class failure fails the tool. A ref call validates the argument once at the toolset boundary; a missing, empty, or non-string `ref` returns the CLI grammar-rejection analogue `input.value.rejected` inside the tool payload. Other ref shapes — including whitespace-only, path-shaped, and newline-bearing values — reach the engine and produce the same classified outcome as the CLI for the same fixture. A runtime read that throws is contained at the toolset dispatch site as the CLI containment identity (`fallback.internal`); it never rejects the toolset promise and never terminates the server.

## Protocol exchange

The server implements the pinned subset in `packages/mcp/src/output/protocol.ts`. Frames are newline-delimited JSON-RPC 2.0 objects. Requests echo their `id`; notifications receive no response.

| Method | Behavior |
|---|---|
| `initialize` | Returns `protocolVersion` `2024-11-05`, empty `capabilities`, and `serverInfo` carrying the branding-derived binary name and the server version. |
| `notifications/initialized` | Accepted with no response. |
| `tools/list` | Returns the three tool descriptors in catalog order. |
| `tools/call` | Accepts `{ name, arguments }`, resolves the served name to its canonical ID, and returns the tool payload. |

A tool call that produces a failure is still a successful protocol exchange: the response carries the error object as its JSON text content with protocol-level `isError: true`. A call naming an unknown tool is a JSON-RPC `-32602` error, an unknown method is `-32601`, and an invalid request is `-32600`; serving continues after each protocol-level error. A frame that parses as JSON but is not a JSON-RPC 2.0 object — including a JSON-RPC batch array — is answered with `-32600 Invalid Request` and `id: null`, and serving continues; only unparseable bytes are a transport fault.

Tool calls are serialized in arrival order through one promise queue. The engines are read-only, so serialization preserves determinism and single-frame responses without a concurrency contract.

## Payload contract

The toolset returns a discriminated result. Success is `{ ok: true, data }`; failure is `{ ok: false, error }`. The stdio protocol renders the result as `content: [{ type: "text", text }]`, where `text` is the JSON serialization of `data` on success and of `error` on failure, and adds `isError: true` for a failure. The JSON text carries no envelope wrapper.

| Aspect | Contract |
|---|---|
| Success data | The engine data shape by reference from `@delivery-os/core/contracts`; the engine's own `schemaVersion` remains part of that data (`delivery.status.v1`, `delivery.verify-gates.v1`, and the verify-change success shape). |
| Failure fields | Exactly `code`, `category`, `retryable`, `consequence`, `remediationHint`, plus optional `summary`; the same field set the CLI error object carries. |
| Failure identity | Resolved against the shared `ERROR_TABLE` data, including the status collector family and the adapter-local `provider.payload.invalid` identity; an unclassifiable failure contains as `fallback.internal`. Config-shaped summaries come from the table, never from untrusted input. |
| Forbidden fields | No `runId`, `exitCode`, `timing`, no `delivery.result.v1` schema wrapper, and no `data`/`error` envelope object nested inside a payload. |

The parity fixtures assert the success payload equals the CLI machine-output `data` and the failure payload equals the CLI error object, for the same injected inputs. No protocol-invented field is admitted.

## Lifecycle and exits

The serve process has exactly three lifecycle outcomes, mapped in `packages/mcp/src/lifecycle.ts`, the one exit site outside the CLI projection:

| Outcome | Exit | Diagnostics channel |
|---|---|---|
| Clean stop (stdin reaches EOF) | `0` | none |
| Configuration error (for example an unresolvable working name, an absent home directory, unreadable configuration, an unusable state-directory override, or a checkout identity that cannot be read) | `1` | one configuration diagnostic on stderr |
| Transport fault (an unparseable JSON frame) | `2` | one transport diagnostic on stderr |

The transport channel (stdout) carries JSON-RPC frames only; diagnostics go to stderr and never into the protocol stream. A tool failure never selects an exit: it is answered in protocol and serving continues. The exit-literal invariant treats the lifecycle module as the one sanctioned transport-exit site and continues to forbid the CLI projection role outside the CLI.

## Serve composition

`packages/mcp/src/serve.ts` is the composition root. It reads the process environment once at startup, resolves the brand identity, acquires file configuration, builds the state store, and injects the tool runtimes before starting the protocol loop. The store opens at the state root the one state-scope policy resolves for the invoking checkout — the same project state root the CLI uses, `<host root>/projects/<project key>` ([Projects Host Overview](feature-projects.md)) — and the composition creates the checkout identity marker once, inside the git common directory, when it is absent. The neutral `DELIVERY_OS_WORKING_NAME` override supplies the working name when set; when it is absent the composition uses the neutral default working name `delivery-os`, so a permanent rename updates the branding configuration and this serve default together. The config selector is derived from the resolved brand's environment prefix. The package declares no `bin`; the `./serve` export resolves to the built entry and exposes the `serve` promise, which starts the protocol loop only when the module is the process entry, so a composition-parity suite can import the composition seam without starting a server.

The shipped composition wires read-only local evidence: repository facts and HEAD from `.git` metadata, the local PM context, verified state/ledger reads, pm-notes text, and the CI workflow job names. In the status runtime, the tracker, delivery-request, and pipeline reads are injected as `not-configured`, which the digest reports as the `not-configured` outcome with reason `source-unavailable`; provider configuration is injected as a failed read with reason `provider-chain-unresolved`, because the minimal composition resolves no credential-backed provider chain. In the gate-report runtime, the credential-backed open-pull-request, delivery-request-detail, check-run, and work-item reads are injected as `credential-unavailable` with failure class `config.credential.missing`. The parks read is composed from the same verified state store already built for verify-artifact and gate-report, through the core `readProviderParkViews` fold the CLI status edge uses: an empty store yields no parks, and a park-read failure carries `state-unreadable` with the store's own failure code. The status runtime also accepts the optional spend read; the shipped composition does not supply it, so the digest's spend section reports the verified-empty observation (`observed`, `captured: false`), and the surface exposes no separate spend tool. Results therefore report degraded or unavailable evidence truthfully instead of implying a live provider read. The shared parity fixtures inject the full engine runtimes to prove the mirror contract independently of this minimal composition.

## Runtime neutrality and boundaries

The catalog, toolset, payload adapter, and protocol handlers are runtime-neutral: they import no runtime API and read no ambient globals. The lifecycle module imports no runtime API and owns only the process-exit member for the pinned exit vocabulary. `packages/mcp/src/serve.ts` is the single Node stdio edge and the single startup configuration-environment read. Both runtime allowances are declared as exact, reason-bearing boundary entries: the dependency-cruiser runtime-API rule names the serve file, and the secret-read boundary allowlist carries the `configuration-environment-source` class for it.

The surface imports core (`.`, `./contracts`, `./state`, `./branding`, `./provider`) and declared adapter subpaths only. It never imports the CLI or OpenCode surfaces, never imports the CLI exit projection, and never imports the serialization or envelope modules. The package declares the `#commands/*` and `#output/*` import aliases, while the delivered modules resolve their internal edges with relative `.js` specifiers so the built `dist` tree runs under Node without alias resolution; the boundary rules cover both forms. The Node portability smoke starts the built `./serve` entry under Node 20 or newer with a network guard installed, completes the handshake, lists the three tools, and calls all three; when the entry also runs under Bun, the suite proves canonical payload identity across the two runtimes.

## Read-only and untrusted posture

The surface performs zero writes, fences, state mutations, audit writes, network writes, or process spawns after it is composed; the only write at composition is the create-once checkout identity marker when the checkout has none. The state store is used only for presence-tolerant verified reads, repository facts come from `.git` metadata, and the mirrored engines remain the only read path. A full three-tool sequence leaves the state store and the working tree byte-identical.

Tool inputs are validated once at the boundary and malformed input never crashes the server. Returned content — including tracker, CI, and ledger evidence that may carry injected instructions — is inert payload data: the server never acts on it, never elevates it into tool descriptions or authority decisions, and the prompt-injection fixture proves that the payload carries the hostile text without changing tool discovery, read behaviour, or control flow. All three tools are read-only, so no mutation-authorization surface exists.

The surface ships no batch capability, no mutating tool, no daemon or multi-session mode, no `.mcpb` packaging, no publication artifact, and no installer registration.

## Quality evidence

Default tests make no live provider calls. Contract and catalog tests pin the closed tool set, the branding projection, the payload boundary, and the committed tool-list snapshot (`tests/fixtures/mcp/tool-list.snapshot.json`, regenerated only by `tests/fixtures/mcp/regenerate.ts --write`). Parity suites run the CLI in process as the live oracle and compare success and failure payloads across all three tools. Dedicated suites cover input validation, error-field exactness, thrown-read containment, protocol-level recovery from valid-JSON non-frames, envelope leakage, lifecycle exits, the Node smoke, prompt-injection inertness, and the read-only guarantee. Structure and check suites enforce the import allowlist, boundary rules, CI wiring, and mutation controls.

The surface has no live provider tier; its CI evidence is the hermetic fixture set, the Node smoke, and the parity battery.

## Related

- [Status Digest](feature-status-digest.md)
- [Verify Change and Exit Taxonomy](feature-verify-change-and-exit-taxonomy.md)
- [Verify Gates](feature-verify-gates.md)
- [Result Contract and Error Table](feature-result-contract.md)
- [Branding Seam and Working Name](feature-branding-seam.md)
- [Monorepo Scaffold and Toolchain](feature-monorepo-scaffold-toolchain.md)
- [ADR-0003 — OSS Tooling Monorepo Structure](../../decisions/ADR-0003-oss-monorepo-structure.md)
- [TDR-0005 — Delivery Result Enum and CLI Exit Taxonomy](../../decisions/TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md)

**Change record:** `doc/changes/2026-11/2026-11-06--GH-231--minimal-mcp/`.
