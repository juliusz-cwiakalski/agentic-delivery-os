---
ados_distribution: internal
id: SPEC-BRANDING-SEAM
status: Current
created: 2026-10-29
last_updated: 2026-10-29
owners: ["engineering"]
service: delivery-os
summary: "The single branding seam: a pure, fail-closed resolver deriving the twelve brand values from one config-driven working name, the BrandIdentity contract in core ./contracts, reserved brand-neutral telemetry schema names, a CI-binding forbidden-literal scan anchored to a fixed corpus baseline, a one-warning legacy compatibility adapter, and the documented rename drill."
links:
  related_changes: ["GH-171"]
  related_decisions: ["ADR-0003"]
---

# Feature: Branding Seam and Working Name

## Overview

The branding seam is the single place where the product's working name enters the TypeScript delivery tooling and every name-derived value leaves. One pure resolver in `@delivery-os/core/branding` turns a config-driven working name into a frozen `BrandIdentity` with twelve values; the type is defined once in `@delivery-os/core/contracts`. Consumers receive brand values as parameters and never derive a name themselves.

The seam is kept honest by a CI-binding forbidden-literal scan over the complete ADR-0003 DEC-8 scope. A legacy compatibility adapter in `@delivery-os/adapters/legacy` maps pre-freeze environment and config-directory names to current names with exactly one warning per process. A documented rename drill proves that a branding change is one seam swap.

No public product name is selected, proposed, or revealed anywhere in the repository. The working name is data supplied at a runtime-aware edge; no working-name literal is committed. The neutral workspace scope `@delivery-os` and the telemetry namespace `delivery` are fixed neutral constants that survive any rename.

The authoritative design decision is [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md) (C-3 naming firewall, DEC-4, DEC-8 naming firewall placement).

## Business Context

### Problem Statement

- **Problem:** Without one enforced name source, every new surface, configuration path, state directory, MCP tool, and doc would invent its own name literal. The eventual public rename would become an unbounded repository dig, legacy local environments would break silently, and the owner-gated naming decision could leak into public artifacts before the freeze.
- **Affected Users:** Maintainers and AI agents implementing the tooling track; operators with existing local environments created before the seam; the owner, who controls the future naming decision.
- **Business Impact:** The seam makes the eventual rename a single data swap plus a drill. Without it, the rename cost grows with every delivered story, and the naming decision is exposed to accidental leakage.

### Goals & Success Metrics

- **Primary Goal:** Every name-derived value in new code and new user-facing docs traces to the one branding seam, and the seam fails closed on anything outside the DEC-8 allowlist.
- **KPIs:**
  - 12/12 DEC-8 values produced by the resolver from the single working-name input.
  - 0 name-derived values computed outside the resolver in new code.
  - 0 committed working-name or product literals outside the DEC-8 allowlist.
  - 5/5 DEC-8 scope classes scanned on every pull request.
  - 0 ambient environment reads inside the branding tier.
  - Exactly 1 warning per process when a legacy source is read; 0 when none is read.

## User Experience & Functionality

### Capabilities

- **Single resolver seam:** `resolveBrandIdentity(input: ResolverInput)` returns `Result<BrandIdentity, BrandingInputError>`. `ResolverInput` carries the config-driven `workingName` and an optional `override`. A present `override` wins over `workingName`; the resolver applies precedence internally.
- **Complete brand contract:** `BrandIdentity` is defined once in `core ./contracts` with the twelve DEC-8 values. The branding subpath imports `./contracts` for the type only and is the only construction site for the values.
- **Neutral override channel:** The designated override variable is `DELIVERY_OS_WORKING_NAME`, a product-free token. A runtime-aware edge reads it and maps it to `ResolverInput.override`. The branding subpath never mentions or reads the variable; the ambient-environment guard forbids `process.env` and `Bun.env` in the tier.
- **Fail-closed validation:** An invalid or unusable name returns a deterministic `BrandingInputError` that names the field (`workingName` or `override`) and the reason code, never the value. There is no silent default and no fallback from an invalid override.
- **Deterministic derivation:** The same input always yields the same output; no clock, randomness, environment, or runtime API is consulted. The returned identity is frozen.
- **Forbidden-literal scan:** A repository check scans the five DEC-8 scope classes for the three seed literals and fails on any occurrence outside the DEC-8 allowlist. The registry is the single authority for scope, seed set, allowlist, corpus baseline, and registered user-facing docs. The scan binds in CI as `ts-forbidden-literals`.
- **Legacy compatibility:** A factory and a process-scoped instance map pre-freeze environment facts and the pre-freeze config directory to current names supplied as parameters. Each instance/process emits exactly one warning when a legacy source is present and none when it is absent. The adapter never imports branding and introduces no new legacy-prefixed variables.
- **Brand-neutral telemetry names:** The event schema name `delivery.event.v1` and the metric schema name `delivery.metric.v1` are reserved. The producer name is branding metadata (`telemetryNamespace`), never part of a schema name. No emission path exists.
- **Rename drill:** A self-contained, name-free guide (`doc/guides/rename-drill.md`) records the RD-1..RD-11 battery and the execution obligation. It runs on a temporary copy before release and whenever branding changes.
- **Boundary conformance:** Branding imports `./contracts` only. `app`, `config`, and `state` may not import branding; adapters may not import `core ./branding`; `testkit` may not import branding. Any forbidden rule is proven by a registered failing fixture.

### Derivation rules

| `BrandIdentity` field | Rule | Notes |
|-----------------------|------|-------|
| `productName` | The effective supplied working name, validated and never defaulted. | The override name when an override is present. |
| `binaryName` | Lowercase; every run outside `[a-z0-9]` collapses to one `-`; leading and trailing `-` stripped. | The reference transformation for several other values. |
| `packageScope` | Fixed neutral constant `@delivery-os` until the naming freeze. | Neutral scope, not a product name. |
| `environmentPrefix` | Uppercase; every run outside `[A-Z0-9]` collapses to one `_`; edges stripped; one trailing `_` appended. | The environment layer uses this prefix. |
| `configDirectoryName` | The name when it already starts with `.`, otherwise `.` plus the name. | The committed config path is `<repo>/<configDirectoryName>/config.yaml`. |
| `stateDirectoryName` | The config directory name plus `-state`. | Consumed by the state layer. |
| `mcpToolPrefix` | The binary transformation plus `_`. | A tool name is this prefix plus a canonical primitive ID from `core ./contracts`. |
| `telemetryNamespace` | Fixed neutral constant `delivery`. | Producer metadata, never part of a schema name. |
| `docsBaseUrl` | `https://` plus the scope org plus `.github.io/` plus the binary transformation plus `/`. | The scope org is the package scope without `@`. |
| `repositoryUrl` | `https://github.com/` plus the scope org plus `/` plus the binary transformation. | Derived, not committed. |
| `releaseAssetPrefix` | The binary transformation plus `-`. | Consumed by release work after the freeze. |
| `installPath` | `~/` plus the config directory name plus `/bin/` plus the binary transformation. | Consumed by distribution registration when artifacts exist. |

The derivation rules are documented authoritatively in the resolver source. Rule changes are reviewed changes with drill implications.

### User and system flows

- **Derivation:** A runtime-aware edge assembles the working name from configuration or the build environment plus injected environment facts, calls the resolver, and passes the resulting `BrandIdentity` to consumers. No consumer derives a name itself.
- **Override swap:** An operator sets `DELIVERY_OS_WORKING_NAME` in the deployment environment. The edge injects it as an environment fact; the resolver derives the full value set from the override name. No rebuild and no repository change are required.
- **Legacy read:** A process reads a pre-freeze-prefixed environment variable or the pre-freeze config directory. The legacy adapter maps it to current names received as parameters and emits one warning for the process; with no legacy source present, it emits none.
- **Forbidden literal attempted:** A contributor writes a seed literal outside the allowlist. The scan exits non-zero naming the file and token, and CI blocks the merge. Allowlisted locations stay green.
- **Rename drill:** An operator copies the workspace to a temporary location, replaces the branding values and the legacy mapping in the copy, runs the full verification battery, and asserts config-glob and root-workspace-file rename survival.

### Edge cases and error handling

| Input condition | Result |
|-----------------|--------|
| Non-string or absent working name | `not-a-string` error on `workingName` |
| Empty string | `empty` error |
| Whitespace-only string | `whitespace-only` error |
| Leading or trailing whitespace | `surrounding-whitespace` error |
| Contains `/` or `\` | `path-separator` error |
| Contains control characters | `control-character` error |
| Longer than 64 characters | `too-long` error |
| Sanitizes to an empty string | `unusable-name` error |
| Override present but invalid | The override's error is returned; no fallback to the configured name |

Errors are echo-free: they carry the field and code, never the supplied value. The resolver output is frozen, and the signature has no default parameter values.

## Technical Architecture & Codebase Map

### High-level design

The seam is a pure function between a runtime-aware edge and every name-consuming surface. The contract type lives in the runtime-neutral `core ./contracts` subpath; the branding subpath is a pure derivation module with no ambient reads and no runtime APIs. The scan is a read-only repository check over git-tracked and untracked-but-not-ignored content; the registry JSON is its authority. The legacy adapter is the only other place legacy literals may live and receives current names as parameters.

### Core components

| Path | Responsibility |
|------|----------------|
| `packages/core/src/contracts/index.ts` | `Result`, `BrandIdentity` (twelve fields), `TelemetryEventSchemaName` (`delivery.event.v1`), `TelemetryMetricSchemaName` (`delivery.metric.v1`) |
| `packages/core/src/branding/index.ts` | `ResolverInput`, `BrandingInputErrorCode`, `BrandingInputError`, `resolveBrandIdentity`, the authoritative derivation-rule documentation |
| `packages/adapters/src/legacy/index.ts` | `LegacyCurrentNames`, `LegacyResolveInput`, `LegacyResolveResult`, `createLegacyCompat`, `resolveProcessLegacy`, `resolveProcessLegacyFromEnvironment` |
| `scripts/checks/forbidden-literals.ts` | Registry validation and the five-class scan; read-only over the repository |
| `scripts/checks/forbidden-literals.registry.json` | Scope classes, seed literals, allowlist, fixed corpus baseline, registered user-facing docs |
| `scripts/checks/ignore-rules.ts` | Repository-hygiene check for the four ignore coverage classes and the brand-free config glob; its former token block is subsumed by the full-scope scan |
| `scripts/checks/ci-topology.ts` | Declares `ts-forbidden-literals` and verifies the baseline fetch and binding execution |
| `.github/workflows/ci.yml` | The additive `ts-forbidden-literals` job with `fetch-depth: 0` and an explicit baseline fetch |
| `doc/guides/rename-drill.md` | The RD-1..RD-11 drill procedure and execution obligation |
| `tests/behaviour/branding-resolver.test.ts` | Resolver completeness, determinism, fail-closed matrix, derivation conformance, override swap |
| `tests/behaviour/legacy-adapter.test.ts` | Legacy mapping and one-warning behaviour |
| `tests/structure/branding-*.test.ts` | Contract placement, no external construction, derivation rules, override confinement |
| `tests/structure/legacy-confinement.test.ts` | No branding import, no new legacy-prefixed variable, literal inventory |
| `tests/structure/rename-drill-doc.test.ts` | Drill completeness, name-freedom, registration |
| `tests/checks/forbidden-literals.test.ts` | Per-class mutations, matching corpora, allowlist exactness, docs-scope lifetime |
| `tests/fixtures/branding/**`, `tests/fixtures/legacy/**`, `tests/fixtures/forbidden-literals/**` | Synthetic names, derivation cases, edge fixture, literal inventory, scan corpora |

### Interface contracts

**Resolver input and result**

```ts
type ResolverInput = {
  readonly workingName: string;
  readonly override?: string;
};

type BrandingInputErrorCode =
  | "not-a-string"
  | "empty"
  | "whitespace-only"
  | "surrounding-whitespace"
  | "path-separator"
  | "control-character"
  | "too-long"
  | "unusable-name";

type BrandingInputError = {
  readonly field: "workingName" | "override";
  readonly code: BrandingInputErrorCode;
};

resolveBrandIdentity(input: ResolverInput): Result<BrandIdentity, BrandingInputError>;
```

**Brand contract**

`BrandIdentity` carries `productName`, `binaryName`, `packageScope`, `environmentPrefix`, `configDirectoryName`, `stateDirectoryName`, `mcpToolPrefix`, `telemetryNamespace`, `docsBaseUrl`, `repositoryUrl`, `releaseAssetPrefix`, and `installPath`. All fields are readonly.

**Legacy adapter**

```ts
type LegacyCurrentNames = {
  readonly environmentPrefix: string;
  readonly configDirectoryName: string;
};

type LegacyResolveInput = {
  readonly facts: Record<string, string>;
  readonly homeDirectory: string;
};

createLegacyCompat({
  current: LegacyCurrentNames;
  warn: (message: string) => void;
}): { resolveLegacy(input: LegacyResolveInput): LegacyResolveResult };
```

The process-scoped default sink is the console. `resolveProcessLegacyFromEnvironment` is the production I/O wrapper that reads the process environment and then maps. Diagnostic text names the legacy source kind and the current name only, never environment values.

### Consumption by later layers

- **M0-S4 (config layer)** consumes `ResolverInput` and `resolveBrandIdentity` without reshaping them: it supplies the configured working name and injected environment facts, then uses `configDirectoryName` for the committed `<repo>/<configDirectoryName>/config.yaml` path and `environmentPrefix` for environment-layer names.
- **M0-S5 (state layer)** consumes `stateDirectoryName`.
- **MCP surface and telemetry** consume `mcpToolPrefix` and `telemetryNamespace`. Tool names are the prefix plus a canonical primitive ID; telemetry schema names remain brand-neutral.

### Registry schema

| Field | Meaning |
|-------|---------|
| `corpusBaseline` | A fixed 40-character commit SHA anchoring the docs-membership rule. It is never a branch, tag, or moving ref; an unreachable baseline fails the scan closed. |
| `scopeClasses` | Exactly the five DEC-8 classes: the package tree, root manifests, root workspace files, ignore rules, and user-facing docs. |
| `seedLiterals` | Exactly the three legacy tokens already public in the repository (the lowercase product token, its uppercase environment-prefix form, and its home-directory config path). The set grows by one literal per frozen public name. |
| `allowlist` | The five DEC-8 entries: the branding subpath, the legacy adapter subpath, decision records, historical change artifacts, and required license/source header lines. |
| `registered` | The explicit list of user-facing docs that are scanned. A doc absent at `corpusBaseline` must be registered or the scan fails; a registered doc must be present in the tree and absent at the baseline. |

### Scan semantics

- **Matching:** Case-insensitive, delimited from lowercase ASCII letters on both sides; the longest matching seed literal is reported. A fully lowercase embedded identifier is deliberately not matched (accepted residual risk).
- **File set:** Git-tracked plus untracked-but-not-ignored files. Ignored private corpus content never enters the scan; a newly authored doc does. `node_modules`, `dist`, `coverage`, `.git`, and `tmp` are skipped.
- **Docs scope:** Only registered user-facing docs are content-scanned. Docs present at `corpusBaseline` are outside the content scan (the pre-existing corpus is not claimed by the seam). New docs under `doc/` outside the allowlisted `doc/changes/` and `doc/decisions/` prefixes must be registered in the same change.
- **Failure behaviour:** Non-zero exit naming the offending file and line and token, or the membership failure. The scan never writes to the tree.
- **CI binding:** `ts-forbidden-literals` runs the scan with full history and an explicit fetch of the recorded baseline. `ci-topology` and `ci-bindingness` reject an advisory job, a bypass construct, or a missing baseline fetch. The job joins the existing additive `ts-*` fast loop; the bash jobs remain byte-unchanged.

## Non-Functional Requirements

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Resolver purity: ambient environment reads, clock/randomness, or runtime-API imports inside branding | 0, enforced every pull request |
| NFR-2 | Derivation completeness and determinism | 12/12 values; same input yields the same output |
| NFR-3 | Forbidden-literal scan coverage | 5/5 scope classes every pull request |
| NFR-4 | Scan enforcement quality | At least one mutation test per class; binding CI job; topology and bindingness invariants green |
| NFR-5 | Legacy warning discipline | Exactly 1 per process when a legacy source is read; 0 otherwise; no environment values in the message |
| NFR-6 | New legacy-prefixed variables | 0 |
| NFR-7 | Boundary integrity | 0 violations; every forbidden rule has a registered failing fixture |
| NFR-8 | Regression safety | No regression in the bash stack, `ts-*` jobs, or the aggregate check |
| NFR-9 | Name secrecy | 0 name reveals or candidate names in any artifact |

## Quality Assurance Strategy

| Level | Scope | Mechanism |
|-------|-------|-----------|
| Unit/behaviour | Resolver completeness, determinism, validation, derivation conformance, override swap | `bun test tests/behaviour/branding-resolver.test.ts` |
| Unit/behaviour | Legacy mapping and one-warning discipline | `bun test tests/behaviour/legacy-adapter.test.ts` |
| Structure | Contract placement, no external construction, override confinement, literal inventory | `bun test tests/structure/branding-*.test.ts tests/structure/legacy-confinement.test.ts` |
| Document | Drill completeness, name-freedom, registration | `bun test tests/structure/rename-drill-doc.test.ts` |
| Invariants | Scan mechanics, per-class mutations, allowlist exactness, docs-scope lifetime | `bun test tests/checks/forbidden-literals.test.ts` and `bun run scripts/checks/forbidden-literals.ts` |
| CI topology | Scan job presence, baseline fetch, bindingness | `bun run scripts/checks/ci-topology.ts` and `bun run scripts/checks/ci-bindingness.ts` |
| Aggregate | The whole workspace | `pnpm check` |

Tests use synthetic names only (for example `.renamed-product`, `.alt-brand`, `.synthetic`, and `example-product`); no fixture name is a candidate product name. The scan's mutation evidence covers each of the five scope classes, and the docs-scope lifetime tests cover merge, successor commit, deletion, and an unreachable baseline.

## Dependencies & Risks

- **Authoritative decision:** [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md) (C-3, DEC-4, DEC-8).
- **Consumers:** The M0-S4 layered configuration consumes `ResolverInput` and derives config paths and environment layer names from branding without reshaping the contract. The M0-S5 state layer consumes `stateDirectoryName`. MCP tool names are a projection of `mcpToolPrefix` plus a canonical primitive ID. The M4-S1 freeze uses the override channel, the seed-growth rule, and the drill.
- **Corpus scope:** The single-seam guarantee covers `packages/**` and new user-facing docs. The pre-existing installed corpus migrates separately and is not claimed by this seam.
- **Registry coupling:** Every new user-facing doc under the scanned `doc/` scope must be registered in `forbidden-literals.registry.json` in the same change; otherwise the scan fails. Registered membership is permanent for docs added after the baseline.
- **Baseline availability:** The scan requires the recorded baseline commit to be reachable. CI checks out full history and fetches the baseline explicitly; a shallow clone fails closed.
- **Matching residual risk:** A fully lowercase embedded identifier is not matched by the delimiter rule; this is a recorded, accepted residual.
- **Drift risk:** The documented drill can drift from reality before its first execution. It references gates by contract name and is itself a scanned, name-free document; the first execution is mandatory at the first branding change or pre-release.

## Related Documentation

- **Decision record:** [ADR-0003 — OSS Tooling Monorepo Structure](../../decisions/ADR-0003-oss-monorepo-structure.md).
- **Scaffold substrate:** [Monorepo Scaffold and Toolchain](feature-monorepo-scaffold-toolchain.md).
- **Rename procedure:** [Rename Drill](../../guides/rename-drill.md).
- **Glossary:** [doc/overview/glossary.md](../../overview/glossary.md) — branding-seam terms.
- **Change record:** `doc/changes/2026-10/2026-10-29--GH-171--branding-seam-working-name/`.
