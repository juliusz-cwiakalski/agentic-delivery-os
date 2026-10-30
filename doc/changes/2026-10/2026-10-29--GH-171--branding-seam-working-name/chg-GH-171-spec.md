---
change:
  ref: GH-171
  type: feat
  status: Proposed
  slug: branding-seam-working-name
  title: "M0-S2: Branding seam and working name"
  owners: ["Juliusz Ćwiąkalski"]
  service: delivery-os
  labels: ["oss-tooling", "branding", "m0", "adr-0003"]
  version_impact: minor
  audience: internal
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - "ADR-0003 — OSS Tooling Monorepo Structure (Accepted 2026-10-24, PR #163); binding here: C-3 naming firewall, DEC-4 (config path supplied by branding), DEC-8 (naming firewall placement)"
      - "M0-S1 monorepo scaffold and toolchain (GH-170; merged to main-tools via PR #191, commit 32784af) — boundary matrices, ambient-global guards, negative-fixture discipline, the existing brand-scan seed"
      - "Existing bash delivery stack + CI — coexistence, untouched and authoritative (C-5/C-8)"
      - "doc/spec tooling feature area (post-delivery reconciliation; first branding feature spec)"
    external:
      - "GitHub Actions CI (existing runners; SHA-pinned actions and job-scoped permissions unchanged; one additive binding job)"
---

# CHANGE SPECIFICATION

> **PURPOSE**: Deliver the single branding seam — one config-driven working name from which every name-derived value is derived, guarded by a CI-binding forbidden-literal scan over the full ADR-0003 DEC-8 scope — so the eventual public rename is one swap at the seam instead of an archaeology dig, while no public product name is selected, proposed, or revealed anywhere.

## 1. SUMMARY

This change delivers the M0-S2 branding seam per ADR-0003 C-3 and DEC-8: a pure branding resolver in the `core` `./branding` subpath that derives the full DEC-8 value set (product name, binary name, package scope, environment prefix, config directory name, state directory name, MCP tool prefix, telemetry namespace, docs base URL, repository URL, release asset prefix, install path) from one config-driven working name plus injected environment facts. The `BrandIdentity` type moves to `core` `./contracts` and completes from its current four-field stub to the full derived-value set. The working name is data supplied at a runtime-aware edge — never a committed literal — and a neutrally named environment override swaps it without a rebuild.

The seam is kept honest by enforcement: the forbidden-literal scan (today a seed list over `.gitignore` lines only) extends to the full DEC-8 scope — `packages/**`, root manifests, root workspace files, `.gitignore`, and new user-facing docs — with the DEC-8 allowlist, binding in CI. A legacy compatibility adapter in the `adapters` `./legacy` subpath reads the legacy environment prefix and legacy config directory, warns exactly once per process, receives current names as parameters, and never imports branding. The brand-neutral telemetry schema name `delivery.event.v1` is reserved, and the rename drill is documented as a procedure to be executed pre-release and on any branding change.

**Binding owner constraint (issue #171 comment, 2026-10-29, quoted):** this story delivers the branding SEAM only — a config-driven working name read through the branding module, with no hardcoded product token anywhere. No public product name may be selected, proposed, or revealed in any artifact; candidate names and the naming decision are private owner-gated work outside this repository. Public artifacts stay self-contained with generic rationale. Scope, tasks, and AC are exactly the issue body — nothing more. This refines the backlog task's "single name constant (working name ados)" wording: the constant is the seam, not a hardcoded literal; the tokens `ados`, `ADOS_`, and `~/.ados` appear in this change only in their legacy/scan-seed framing.

## 2. CONTEXT

### 2.1 Current State Snapshot

- The M0-S1 scaffold (GH-170) is merged to `main-tools` (PR #191, commit 32784af): six packages, tier matrices and cross-package rules enforced by dependency-cruiser with negative fixtures, the ambient-global AST guard, one aggregate `check`, and fifteen additive binding `ts-*` CI jobs beside the untouched bash stack.
- `packages/core/src/branding` is a type-only stub: it defines `BrandIdentity` **locally** with a narrower four-field shape (product name, binary name, environment prefix, config directory name) and a doc comment stating the pure-resolver intent. ADR-0003 DEC-8 requires the type in `core` `./contracts` and a twelve-value derived set — neither is in place yet.
- `packages/core/src/contracts` currently contains only the `Result` envelope type.
- `packages/adapters/src/legacy` is a placeholder subpath with no behavior.
- The GH-170 brand-scan seed lives in the repository-hygiene check and scans **only** `.gitignore` lines for the seed tokens `ados`, `ADOS_`, `~/.ados` (the legacy tokens already public in this repository). The full DEC-8 scan scope, allowlist, and CI binding are not yet implemented.
- The `ambient-env-branding` AST rule already classifies any `process.env`/`Bun.env` read inside the branding tier as a violation; the tier matrix already forbids `app`/`config`/`state` from importing branding, `adapters` from importing `core` `./branding`, and `testkit` from importing branding.
- AGENTS.md already states the no-hardcode rule ("read the binary and product names from configuration") — verified consistent with this change; no rewrite expected.
- The naming decision (public product name) is private owner-gated work outside this repository; no freeze occurs during M0-S2.

### 2.2 Pain Points / Gaps

- Name-derived values have no single source: the moment real surfaces, config, state, MCP tools, and docs land, each would invent its own name literal, and the eventual public rename becomes a repository-wide dig instead of a one-line swap.
- The `BrandIdentity` type is defined locally in the branding subpath with a narrower shape than DEC-8 requires, so even the stub contract is split from its authoritative definition in `core` `./contracts`.
- The forbidden-literal guard covers one file (`.gitignore`) out of the five DEC-8 scope classes; every other location can accumulate a forbidden literal unseen.
- Legacy environments (variables with the legacy prefix, the legacy config directory) have no compatibility path; when the name changes, existing local setups would break silently — or worse, tempt new code to hardcode legacy tokens outside the firewall.
- The rename drill exists only as ADR prose; without a documented, concrete procedure, the first branding change would be unrehearsed.

## 3. PROBLEM STATEMENT

Because the monorepo has no enforced name seam — the branding subpath is a narrower-than-authoritative type stub, the forbidden-literal guard scans only `.gitignore`, and no legacy compatibility path or documented rename procedure exists — every name-derived value that lands from M0-S4 onward (config paths, state directories, MCP tool prefixes, docs, release assets) would hardcode its own name literal, making the public rename an unbounded archaeology dig, silently breaking legacy local environments, and risking the owner-gated naming decision leaking into public artifacts before the freeze.

## 4. GOALS

- **G-1**: One pure resolver in the branding subpath derives the complete DEC-8 value set from one config-driven working name; every name-derived value in new code traces to it, and no working name exists as a committed literal anywhere.
- **G-2**: The environment override swaps the working name at the naming freeze without a rebuild, read only at a runtime-aware edge via injected environment facts — the branding subpath performs no ambient environment read.
- **G-3**: The forbidden-literal scan covers the full DEC-8 scope with the DEC-8 allowlist, fails CI on any literal outside the allowlist, and is mutation-proven and binding.
- **G-4**: Legacy environments keep working: the legacy adapter maps the legacy environment prefix and legacy config directory to current names (received as parameters), warns exactly once per process, passes the scan itself, and introduces no new legacy-prefixed variables.
- **G-5**: The telemetry schema name is brand-neutral from day one, and the rename drill is documented as an executable procedure for pre-release and any branding change.
- **G-6**: No public product name is selected, proposed, or revealed in any artifact of this change; all public artifacts are self-contained with generic rationale.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| DEC-8 name-derived values produced by the resolver from the single working-name input | 12/12 |
| Name-derived values computed outside the resolver (new code) | 0 |
| Committed working-name or product literals outside the DEC-8 allowlist | 0 |
| DEC-8 scan scope classes covered by the forbidden-literal scan, every PR | 5/5 (`packages/**`, root manifests, root workspace files, `.gitignore`, new user-facing docs) |
| Injected forbidden literals that escape the scan in CI (mutation evidence) | 0 |
| Ambient environment reads inside the branding tier | 0, every PR |
| Warning emissions per process when legacy sources are read | exactly 1 (0 when none are read) |
| New legacy-prefixed variables introduced | 0 |
| Boundary/tier violations introduced by this change | 0 per PR |
| Regressions in existing gates, bash jobs, or the aggregate check | 0 |

### 4.2 Non-Goals

- **NG-1**: The layered configuration layer and its wiring — M0-S4 consumes the resolver-input contract delivered here, without reshaping it.
- **NG-2**: Migration of the pre-existing installed corpus (agent and command content, guides, install paths); per ADR-0003 DEC-8 scope-of-claim it migrates separately and is not claimed as covered by the seam.
- **NG-3**: Any naming decision — selecting, proposing, or revealing a public product name, or any candidate name, in any artifact. Owner-gated, private, outside this repository.
- **NG-4**: Telemetry emission, MCP tool implementation, or CLI command implementation — this change reserves the neutral schema name and the derived MCP prefix only.
- **NG-5**: Result/error contract content (M0-S3) and state drivers (M0-S5).
- **NG-6**: Executing the rename drill or freezing a name — the drill is documented; it executes pre-release and whenever branding changes.
- **NG-7**: Cloud anything (C-4).
- **NG-8**: Replacing, weakening, or modifying existing bash jobs, gates, `.opencode/`, or `.ados-claude/` (C-5/C-6/C-8).

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Single branding resolver seam deriving the full DEC-8 value set from one config-driven working name | C-3/DEC-8: one seam, every name derived, rename is one edit plus a drill. |
| F-2 | `BrandIdentity` type in `core` `./contracts`, completing the current stub to the DEC-8 set | DEC-8: `core ./contracts` defines the type; branding imports `./contracts` for the type only. |
| F-3 | Environment override via injected environment facts at a runtime-aware edge | DEC-8: an operator can test/swap a name without a rebuild; branding never reads the environment ambiently. |
| F-4 | Forbidden-literal scan at full DEC-8 scope with the DEC-8 allowlist, binding in CI | C-3: the test keeps the seam honest; the seed set grows with the frozen name set. |
| F-5 | Legacy compatibility adapter: legacy prefix + legacy config directory read with a one-time warning | DEC-8: the legacy adapter is the only other place old literals may live; it receives current names as parameters. |
| F-6 | Brand-neutral telemetry schema naming (`delivery.event.v1`) with the producer name as branding metadata | DEC-8: event names brand-neutral from day one; the producer name is metadata, not schema. |
| F-7 | Documented rename drill (procedure; executed pre-release and on any branding change) | DEC-8: the drill must pass before release and whenever branding changes; M0-S2 documents it. |
| F-8 | Boundary conformance of the seam with negative-fixture discipline | Existing tier/ambient/runtime-API rules keep branding isolated; any new forbidden rule ships with its failing fixture. |

### 5.1 Capability Details

- **F-1**: The branding subpath exposes one pure resolver that takes a working name (config-driven data) plus injected environment facts and returns the full `BrandIdentity` value set: product name, binary name, package scope, environment prefix, config directory name, state directory name, MCP tool prefix, telemetry namespace, docs base URL, repository URL, release asset prefix, and install path. Derivation rules are deterministic and documented, so the same input always yields the same values. The resolver is total and fail-closed over its input contract (an absent or invalid working name is a resolver-input error, not a silent default). No working name is committed as a literal anywhere in the repository — including inside the branding subpath; the DEC-8 build-time define remains the designated compile-time default channel, with its value supplied by the build environment rather than a repository artifact. Tests derive from synthetic names (the GH-170 rename-simulation precedent). The ADR-0003 DEC-8 projection contracts hold from day one: MCP tool names are a projection of branding plus a canonical primitive identifier from `core` `./contracts` (a rename changes the projection, not the primitive), and the committed configuration path is `<repo>/.<product>/config.yaml` with the product directory name supplied by branding (M0-S4 consumes this).
- **F-2**: The `BrandIdentity` type is defined once in `core` `./contracts` (runtime-neutral, types-only, alongside the existing result envelope) and completes the current four-field stub to the full twelve-value DEC-8 set. The branding subpath imports `./contracts` for the type only — its sole permitted import under the tier matrix. Consumers receive typed brand values; they never re-derive them.
- **F-3**: The environment override is identified by a neutral, product-free variable name (DEC-2 below). It is read only at a runtime-aware edge — a surface, or a runtime-aware composition root that receives injected environment facts — and passed into the resolver as an input. The effective working name is the override when present, otherwise the configured supplied name; swapping it requires no rebuild. The branding subpath itself performs no ambient read: the existing `ambient-env-branding` and ambient-globals guards fail any `process.env`/`Bun.env` use in the tier, and runtime-API confinement already excludes branding. The resolver-input contract (working name + environment facts as parameters) is the seam M0-S4's layered configuration consumes without reshaping.
- **F-4**: The forbidden-literal scan covers all five DEC-8 scope classes — `packages/**`, root manifests, root workspace files, `.gitignore`, and new user-facing docs — for the seed literal set `ados`, `ADOS_`, `~/.ados` (the legacy tokens already public in this repository). The allowlist is exactly DEC-8's: the branding subpath, the legacy adapter subpath, decision records, historical change artifacts, and required license/source headers. A violation fails the run and names the offending file and token. The scan is binding in CI (no advisory job, no bypass construct — the ci-topology and ci-bindingness invariants must stay green), is mutation-tested per the repository testing strategy for repository invariant checks, and the seed list becomes the single growing registry: freezing a public name adds its literal to the scanned set in the same change. The existing `.gitignore`-local token scan is subsumed by the full-scope scan (mechanics at delivery planning; no gate may be weakened — C-8).
- **F-5**: The legacy adapter in the `adapters` `./legacy` subpath reads the pre-freeze environment prefix (`ADOS_*` variables) and the pre-freeze config directory (`~/.ados`), maps them to the current names, and warns once. It receives current names as parameters and never imports branding (the cross-package rule forbidding `adapters` → `core` `./legacy`→branding already holds and remains). Exactly one warning is emitted per process when any legacy source is read; no warning when none are. No new pre-freeze-prefixed variables are introduced anywhere. The adapter itself passes the forbidden-literal scan under its DEC-8 allowlist entry and contains no token beyond the legacy set, used only for legacy mapping.
- **F-6**: The event schema name `delivery.event.v1` is reserved as a brand-neutral declared contract artifact (the sibling metric name `delivery.metric.v1` follows the same DEC-8 rule). The schema name carries no producer identity; the producer name is branding metadata supplied by the resolver, never part of the schema name. No emission path is implemented.
- **F-7**: The rename drill is documented as a self-contained procedure (a new user-facing document, hence inside the scan scope and itself name-free): replace branding values and the legacy mapping in a temporary copy, then run typecheck, unit and integration tests, boundary tests, the forbidden-literal test, a binary build, a package publish dry-run, an MCP tool-list snapshot, and an OpenCode tool-list snapshot; assert the root `.gitignore` still matches the renamed project-local config path and that every root workspace file is name-free or derived from branding. The document states the execution obligation: it must pass before release and whenever branding changes. It is not executed in this change (no branding change and no release occurs in M0-S2).
- **F-8**: The delivered seam respects every existing boundary: branding imports `./contracts` only; `app`, `config`, and `state` may not import branding; adapters may not import `core` `./branding`; `testkit` may not import branding; no ambient globals or runtime APIs in branding. Every new forbidden boundary rule this change introduces ships with a failing negative fixture and fixture-coverage registration in the same change; a rule without a fixture is unenforced and fails the check.

## 6. USER & SYSTEM FLOWS

```
Flow 1 — Derivation (the seam)
  A runtime-aware edge assembles the working name (from configuration/build environment)
  plus injected environment facts
    → the pure resolver returns BrandIdentity (12 DEC-8 values)
    → consumers receive brand values as parameters; no consumer derives a name itself

Flow 2 — Override swap (freeze rehearsal / operator name test)
  An operator sets the neutral override variable in the deployment environment
    → the runtime-aware edge injects it as an environment fact
    → the resolver derives the full value set from the override name
    → no rebuild, no repository change, no committed literal

Flow 3 — Legacy environment read
  A process reads a legacy-prefixed environment variable or the legacy config directory
    → the legacy adapter maps it to the current names (received as parameters)
    → exactly one warning is emitted for the process
    → no legacy source present → no warning

Flow 4 — Forbidden literal attempted
  A contributor writes a seed-set literal outside the DEC-8 allowlist
    → the forbidden-literal scan fails CI, naming the file and token
    → merge blocked; no advisory bypass exists
    → allowlisted locations (branding subpath, legacy adapter, decision records,
      historical change artifacts, license/source headers) remain green

Flow 5 — Rename drill (documented procedure; executed pre-release / on branding change)
  An operator copies the workspace to a temporary location, replaces branding values
  and the legacy mapping
    → the full verification battery runs (typecheck, tests, boundaries,
      forbidden-literal test, binary build, publish dry-run, MCP + OpenCode snapshots)
    → the drill asserts the config-glob still matches and root workspace files are name-free
    → green proves the rename is one seam swap
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- Branding resolver in the `core` `./branding` subpath deriving the full twelve-value DEC-8 set from one config-driven working name plus injected environment facts (F-1), with documented deterministic derivation rules.
- `BrandIdentity` type moved to and completed in `core` `./contracts`; the branding subpath imports `./contracts` for the type only (F-2).
- Neutral-named environment override, injected at a runtime-aware edge, swapping the working name without a rebuild (F-3); the resolver-input contract recorded so M0-S4 consumes it without reshaping.
- Forbidden-literal scan extended to the full DEC-8 scope with the DEC-8 allowlist and seed set, failing CI on a literal outside the allowlist, mutation-proven, and binding in the CI fast loop (F-4).
- Legacy compatibility adapter for the legacy environment prefix and legacy config directory, with a one-time per-process warning, current names received as parameters, no branding import, and no new legacy-prefixed variables (F-5).
- Brand-neutral telemetry schema name `delivery.event.v1` reserved with producer-name-as-metadata rule (F-6).
- Rename drill documented as a self-contained, name-free procedure with its execution obligation (F-7).
- Boundary conformance for everything above, plus failing negative fixtures and fixture-coverage registration for any new forbidden rule (F-8).
- Post-delivery system-spec reconciliation inputs: this change constitutes the first branding feature area (no branding feature spec exists yet).

### 7.2 Out of Scope

- [OUT] Layered configuration, schema, precedence, per-key provenance (M0-S4 consumes the resolver-input contract).
- [OUT] Migration of the pre-existing installed corpus; extending the drill to it (separate tracked change per DEC-8 scope-of-claim).
- [OUT] Any public product name decision, candidate name, or name reveal in any artifact (owner-gated, private, outside this repository).
- [OUT] Telemetry emission, metrics implementation, MCP tool implementation, primitive ID contract content (M0-S3+).
- [OUT] Result/error contract content (M0-S3); state drivers and persistence (M0-S5).
- [OUT] Executing the rename drill; freezing a name; flipping package privacy; applying a branded scope (the freeze change, M4-S1).
- [OUT] Cloud names, designs, or code (C-4).
- [OUT] Changes to the bash stack, `.opencode/`, `.ados-claude/`, or any existing directory layout (C-5/C-6).
- [OUT] Weakening or relaxing any existing gate, scan, or boundary rule (C-8).

### 7.3 Deferred / Maybe-Later

- **Freeze mechanics** (M4-S1): add the frozen name's literal to the scan seed set in the same change; flip the five publishables public; apply the branded scope; remove the publish guard; execute the rename drill.
- **Corpus migration + drill extension**: when the pre-existing corpus migrates, the rename drill extends to it.
- **Resolver-input wiring**: the first real runtime-aware edge (config layer M0-S4, surfaces) consumes the resolver-input contract; until then the contract is exercised by tests with synthetic names.
- **Metric schema name operationalization**: `delivery.metric.v1` is reserved by the same DEC-8 rule; it gains an AC when metric emission lands.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — no HTTP surface in this change.

### 8.2 Events / Messages

| ID | Event/Schema | Contract |
|----|--------------|----------|
| EVT-1 | `delivery.event.v1` | Reserved brand-neutral event schema name, declared as a contract artifact in this change. The schema name contains no producer identity; the producer name is branding metadata from the resolver. No emission path is implemented. |
| EVT-2 | `delivery.metric.v1` | Reserved by the same ADR-0003 DEC-8 rule (brand-neutral; producer name is metadata). Informational in this change; operationalized with metric emission later. |

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | `BrandIdentity` (in `core` `./contracts`) | The twelve-value DEC-8 set as a runtime-neutral type: product name, binary name, package scope, environment prefix, config directory name, state directory name, MCP tool prefix, telemetry namespace, docs base URL, repository URL, release asset prefix, install path. Defined once; consumed as parameters. |
| DM-2 | Resolver input contract | Working name (config-driven data) plus injected environment facts (including the neutral override), consumed by the pure resolver. This is the seam contract M0-S4's layered configuration and later runtime-aware edges consume without reshaping. |
| DM-3 | Forbidden-literal registry | The scan's scope classes (five DEC-8 classes), allowlist (DEC-8 set), and seed literal set (legacy tokens; grows by one literal per frozen name, added in the freeze change). Single source for the scan; the `.gitignore`-local token list is subsumed. |

### 8.4 External Integrations

- GitHub Actions CI: one additive binding job for the forbidden-literal scan, joining the existing `ts-*` fast loop; SHA-pinned actions and job-scoped permissions unchanged. No new external services, vendors, or dependencies.

### 8.5 Backward Compatibility

Fully additive. The placeholder-only packages mean the `BrandIdentity` type move breaks no consumers. The bash stack, existing gates, and the aggregate check are untouched; the new scan joins them as an additional binding gate. Legacy environments (legacy-prefixed variables, legacy config directory) continue to work through the legacy adapter with a one-time warning — behavior they did not have before is added, nothing existing is removed. No published artifact exists; no external consumer is affected.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Resolver purity: ambient environment reads, ambient clock/randomness, or runtime-API imports inside the branding tier | 0, enforced every PR by `ambient-env-branding`, `ambient-globals-neutral-tiers`, and runtime-API confinement |
| NFR-2 | Derivation completeness and determinism: DEC-8 values produced by the resolver as a pure function of its input | 12/12; same input → same output; no name-derived value computed outside the resolver in new code |
| NFR-3 | Forbidden-literal scan coverage of the DEC-8 scope classes | 5/5 classes scanned on every PR; a violation fails the run naming file + token |
| NFR-4 | Scan enforcement quality: mutation evidence and CI bindingness | ≥1 mutation test proving the failure path; job binding (no advisory/bypass construct); ci-topology and ci-bindingness invariants green |
| NFR-5 | Legacy warning emission discipline | Exactly 1 warning per process when any legacy source is read; 0 when none; warning output must not include secret material |
| NFR-6 | Legacy-prefix hygiene: new pre-freeze-prefixed variables introduced | 0 |
| NFR-7 | Boundary integrity: violations across all tier/package/ambient matrices introduced by this change | 0 per PR; every new forbidden rule has ≥1 failing negative fixture registered |
| NFR-8 | Regression safety: existing gates (bash jobs, `ts-*` fast loop, aggregate check) | no regression; aggregate check green; bash jobs byte-untouched |
| NFR-9 | Self-contained public artifacts: name reveals or candidate names in any artifact of this change | 0; generic rationale only (owner constraint, G-6) |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

No product telemetry is emitted in this change; the deliverable is the brand-neutral schema naming contract (EVT-1/EVT-2) and the producer-name-as-metadata rule. Observability = CI: the forbidden-literal scan and every existing gate remain binding, and a failure names the violated rule, file, and token so an agent can place the fix without archaeology.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | "Config-driven" is misread as requiring the config layer before M0-S4, blocking delivery | M | L | The spec fixes the seam contract as the resolver-input (working name + injected environment facts at a runtime-aware edge); M0-S4 consumes it without reshaping (F-3, DM-2) | Low |
| RSK-2 | Substring matching on the seed token trips false positives (common words containing the token) or the allowlist grows unreviewed | M | L–M | Matching semantics and allowlist entries are part of the scan contract (DM-3), reviewed in the PR; failures name file + token for quick triage; keep the seed minimal until the freeze | Low–Medium |
| RSK-3 | The legacy adapter becomes an accidental second seam (new code derives names from legacy tokens there) | M | L | Legacy tokens confined to the legacy mapping purpose; adapter receives current names as parameters and never imports branding (cross-package rule); scan limits legacy literals to the DEC-8 allowlist; no new legacy-prefixed variables (NFR-6) | Low |
| RSK-4 | The owner naming constraint is violated by leakage (a candidate or public name appears in code, docs, or PR text) | H | L | G-6/NFR-9 as an explicit criterion; the scan covers new user-facing docs; authoring discipline in this and downstream artifacts; owner PR review is the human gate | Low |
| RSK-5 | The new scan job weakens CI topology or is accidentally advisory (bypass construct, wrong job wiring) | M | L | ci-topology and ci-bindingness invariants run in CI; mutation tests prove the failure path; no `continue-on-error`/error-swallowing anywhere (NFR-4) | Low |
| RSK-6 | The documented drill drifts from reality before its first execution (documented now, run at pre-release) | M | M | The drill references existing gates by their contract names, is itself a scanned user-facing doc, and its execution obligation is stated in the document; first execution is mandatory at the first branding change or pre-release, whichever comes first | Medium |

## 12. ASSUMPTIONS

- The M0-S1 substrate is merged and green (`main-tools` @ 32784af); the tier matrix, ambient guards, and negative-fixture discipline are active as described in the current-truth feature spec.
- No external consumers of the workspace packages exist, so moving `BrandIdentity` from the branding subpath to `core` `./contracts` breaks nothing.
- No naming freeze occurs during M0-S2; the naming decision remains private owner-gated work outside this repository, so the seed literal set does not grow in this change.
- The pre-existing installed corpus is outside the scan's claim per DEC-8 scope-of-claim and migrates separately.
- No new runtime or dev dependencies are required to deliver the seam; if delivery planning discovers one, the license-registry gate (fail-closed) applies in the same change.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | ADR-0003 (C-3, DEC-4, DEC-8) | Authoritative for the seam placement, derived-value set, scan scope/allowlist, legacy adapter rules, telemetry neutrality, drill, and scope-of-claim. |
| Depends on | M0-S1 scaffold (GH-170, merged @ 32784af) | Workspace, tier matrices, ambient guards, negative-fixture harness, CI fast loop, and the existing brand-scan seed. |
| Depends on | Repository testing strategy | Mutation-test and fixture rules for repository invariant checks and boundary rules. |
| Blocks | M0-S4 config layer (GH-173) | Consumes the resolver-input contract (DM-2): config paths and environment layer names come from branding. |
| Blocks | M0-S5 state layer (GH-174) | State directory names derive from branding. |
| Blocks | Telemetry-emitting stories | Consume the reserved brand-neutral schema name (EVT-1) and producer-name-as-metadata rule. |
| Blocks | M4-S1 naming freeze | Uses the override channel, the seed-growth rule, and the documented drill. |

## 14. OPEN QUESTIONS

None at spec time. The seam-scope ambiguity (backlog "single name constant" wording vs. no-hardcode) was resolved by the owner's binding comment of 2026-10-29 (Section 1, DEC-1). Remaining shape decisions (scan matching semantics, exact derivation rules, check file organization) are technical and reversible, owned by delivery planning within the contracts fixed here.

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | The working name is config-driven data, not a committed literal: the resolver input contract (DM-2) is the "single name constant" the backlog task names. No working-name literal is committed anywhere, including inside the branding subpath; the DEC-8 build-time define remains the compile-time default channel with its value supplied by the build environment. | Owner constraint (binding, issue #171 comment 2026-10-29): "no hardcoded product token anywhere"; refines the backlog's "single name constant (working name ados)" — the constant is the seam, not a hardcoded literal. Keeps the naming decision owner-private and makes the scan's zero-literal goal absolute. | 2026-10-29 |
| DEC-2 | The environment override variable is named `DELIVERY_OS_WORKING_NAME` — a neutral, product-free token. | PM planning delegates the naming to this spec and requires a neutral token. It derives from the ADR service name `delivery-os` (the same brand-free internal designation as the neutral workspace scope), contains no product token, survives any rename, and introduces no new pre-freeze-prefixed variable (it is not legacy-prefixed). | 2026-10-29 |
| DEC-3 | `BrandIdentity` moves to `core` `./contracts` and completes from the current four-field stub to the twelve-value DEC-8 set; branding imports `./contracts` for the type only. | ADR-0003 DEC-8 is explicit ("`core ./contracts` defines the `BrandIdentity` type"); the stub's narrower shape and local definition would fork the contract from its authoritative home. No consumers exist, so the move is free. | 2026-10-29 |
| DEC-4 | The forbidden-literal scan is delivered as a full-scope, CI-binding repository check owning the seed registry (DM-3); the `.gitignore`-local token list is subsumed without weakening any existing gate. | ADR-0003 C-3/DEC-8 define the scope, allowlist, and growth rule; the GH-170 seed is a subset doing one scope class. One registry avoids divergent token lists; C-8 forbids weakening the existing hygiene check. | 2026-10-29 |
| DEC-5 | Telemetry schema names are reserved brand-neutral now (`delivery.event.v1` in scope per the issue; `delivery.metric.v1` by the same DEC-8 rule); producer name is branding metadata, never part of the schema name. | ADR-0003 DEC-8 requires brand-neutral event names "from day one"; reserving the name before the first emitter exists prevents a brand-coupled schema name from ever shipping. | 2026-10-29 |
| DEC-6 | The rename drill is documented in this change and executed pre-release and on any branding change — not executed in M0-S2. | The issue task says "rename drill documented"; no branding change and no release occur in M0-S2, so there is nothing to drill yet. The execution obligation is recorded in the document itself (F-7) and tracked as RSK-6. | 2026-10-29 |
| DEC-7 | `change.type = feat` | Adds the branding seam capability (resolver, contract type, scan, legacy adapter, schema name, drill procedure) — new behavior, not a refactor of existing behavior. | 2026-10-29 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `core` `./branding` subpath | Updated — pure resolver deriving the full DEC-8 set; local type stub replaced by the `./contracts` import; still types-first, no ambient reads |
| `core` `./contracts` subpath | Updated — `BrandIdentity` type (full DEC-8 set) and the reserved brand-neutral schema-name artifact |
| `adapters` `./legacy` subpath | Updated — legacy environment-prefix and config-directory compatibility with a one-time warning; names received as parameters |
| Repository invariant checks (`scripts/checks/*`) | New/Updated — full-scope forbidden-literal scan owning the seed registry; existing hygiene check's token scan subsumed |
| CI workflow | Updated — one additive binding job for the scan; existing jobs untouched |
| Workspace tests (`tests/**`) | New/Updated — mutation tests for the scan, boundary/ambient fixtures, synthetic-name resolver tests |
| Root manifests, root workspace files, `.gitignore` | Verified name-free / rename-surviving; no change expected |
| `doc/` user-facing docs (rename-drill procedure) | New — self-contained, name-free, inside the scan scope |
| `doc/spec/**` | Reconciled post-delivery — first branding feature spec (none exists today) |
| AGENTS.md | Verified consistent (no-hardcode rule already stated); no rewrite expected |
| `scripts/*.sh`, `tools/`, `.opencode/`, `.ados-claude/` | Untouched |

## 17. ACCEPTANCE CRITERIA

Ticket AC coverage: ticket AC-1 (every name-derived value traces to the branding constant) → AC-F1-1, AC-F1-2, AC-F2-1, AC-F3-1, AC-F8-1; ticket AC-2 (the forbidden-literal test fails CI on a literal outside the allowlist) → AC-F4-1, AC-F4-2, AC-F4-3; ticket AC-3 (the legacy adapter itself passes the scan) → AC-F5-1; ticket AC-4 (legacy env/config still read with a warning) → AC-F5-2, AC-F5-3. Change-added criteria: AC-F6-1, AC-F7-1.

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** the pure branding resolver, **when** it is invoked with a synthetic working name and empty environment facts, **then** it returns a `BrandIdentity` containing all twelve DEC-8 values, and **when** it is invoked twice with the same input, **then** both results are identical (deterministic derivation). | F-1, NFR-2, DM-1 |
| AC-F1-2 | **Given** the workspace's new code, **when** inspected (scan + boundary output), **then** no name-derived value is computed outside the branding resolver, and no working-name literal is committed anywhere in the repository, including the branding subpath. | F-1, NFR-2, DEC-1 |
| AC-F2-1 | **Given** the `core` `./contracts` and `./branding` subpaths, **when** inspected, **then** `BrandIdentity` is defined once in `./contracts` with the full twelve-value set, and the branding subpath's only workspace import is `./contracts` (for the type), with the tier matrix green. | F-2, NFR-7, DM-1 |
| AC-F3-1 | **Given** a deployment where the neutral override variable (`DELIVERY_OS_WORKING_NAME`) is set to a synthetic name, **when** a runtime-aware edge injects the environment facts into the resolver, **then** the full resolved value set reflects the override name without any rebuild, and **when** the branding subpath source is scanned, **then** it contains zero ambient environment reads. | F-3, NFR-1, DM-2 |
| AC-F8-1 | **Given** the tier matrix and ambient rules, **when** the boundary suite runs, **then** `app`, `config`, and `state` cannot import branding, adapters cannot import `core` `./branding`, testkit cannot import branding, and any new forbidden boundary rule introduced by this change fails without its registered failing negative fixture. | F-8, NFR-7 |
| AC-F4-1 | **Given** a mutation that injects a seed-set literal into each of the five DEC-8 scope classes outside the allowlist, **when** the forbidden-literal scan runs, **then** it exits non-zero naming the offending file and token for every injection, and the mutation tests prove the failure path. | F-4, NFR-3, NFR-4, DM-3 |
| AC-F4-2 | **Given** the repository at the delivered state, **when** the scan runs, **then** all five DEC-8 scope classes are covered, the DEC-8 allowlist (branding subpath, legacy adapter subpath, decision records, historical change artifacts, license/source headers) is honored, and the run is green. | F-4, NFR-3, DM-3 |
| AC-F4-3 | **Given** a pull request targeting the delivery branch, **when** CI runs, **then** the forbidden-literal scan executes as a binding job (no advisory or bypass construct), the ci-topology and ci-bindingness invariants stay green, and all existing jobs run unchanged. | F-4, NFR-4, NFR-8 |
| AC-F5-1 | **Given** the full-scope scan, **when** it covers the legacy adapter subpath, **then** the adapter passes under its DEC-8 allowlist entry, and **when** its contents are inspected, **then** it contains no token beyond the legacy set, used only for legacy mapping. | F-5, NFR-3 |
| AC-F5-2 | **Given** a process that reads a legacy-prefixed environment variable and the legacy config directory, **when** the legacy adapter maps them to the current names it received as parameters, **then** the mapping succeeds and exactly one warning is emitted for the process; and **when** no legacy source is present, **then** no warning is emitted. | F-5, NFR-5 |
| AC-F5-3 | **Given** the change diff and the delivered code, **when** inspected, **then** the legacy adapter never imports branding (it receives current names as parameters), and no new pre-freeze-prefixed variable is introduced anywhere. | F-5, NFR-6, NFR-7 |
| AC-F6-1 | **Given** the declared telemetry contract artifact, **when** inspected, **then** the event schema name `delivery.event.v1` is reserved as brand-neutral, the producer name is documented as branding metadata that is not part of the schema name, and no emission path exists. | F-6, EVT-1 |
| AC-F7-1 | **Given** the rename-drill procedure document, **when** reviewed, **then** it is self-contained and name-free (it passes the forbidden-literal scan as a new user-facing doc), covers the DEC-8 drill battery (temporary-copy replacement, typecheck, unit and integration tests, boundary tests, forbidden-literal test, binary build, publish dry-run, MCP and OpenCode tool-list snapshots), asserts the config-glob rename survival and name-free root workspace files, and states the execution obligation: it must pass before release and whenever branding changes. | F-7, F-4 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Single PR targeting `main-tools`; branch `feat/GH-171/branding-seam-working-name`; one conventional commit per plan phase.
- Fully additive; the bash stack, existing gates, and user-facing behavior are unchanged; no data migration is involved. Reversal is a single PR revert.
- The owner naming constraint governs every artifact of this change (spec, test plan, plan, commits, PR description): self-contained, generic rationale, no candidate or public names (G-6, NFR-9). The naming decision itself stays private owner-gated work outside the repository.
- Post-delivery, `doc/spec/**` gains the first branding feature spec (authored during system-spec reconciliation); possible glossary additions; AGENTS.md verified consistent.
- The first mandatory drill execution is the earlier of the next branding change or the pre-release check.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A — no persisted data is created, moved, or migrated. The pre-existing installed corpus (legacy-named content in the bash stack and existing docs) is explicitly not migrated here (DEC-8 scope-of-claim; NG-2). Legacy local environments keep working through the legacy adapter (F-5).

## 20. PRIVACY / COMPLIANCE REVIEW

N/A — no user data, no telemetry emission, no network surfaces, no sinks. C-11 obligations attach to the state layer (M0-S5) and first persisted events. The legacy warning must not echo secret material from legacy environment variables (NFR-5). The scan reads repository content only.

## 21. SECURITY REVIEW HIGHLIGHTS

- No new dependencies, secrets, credentials, or runtime imports; the scan and resolver are repository-local.
- The new CI job joins the existing supply-chain posture: SHA-pinned actions, job-scoped permissions, binding execution (no bypass constructs), ci-topology/ci-bindingness invariants green.
- The branding tier stays runtime-API-confined and ambient-free, so the seam cannot become an environment-probing or exfiltration surface.
- The license-registry gate remains fail-closed should delivery planning introduce any dependency.

## 22. MAINTENANCE & OPERATIONS IMPACT

- The seed registry grows by exactly one literal per frozen public name, added in the freeze change itself; allowlist edits require PR review.
- Derivation rules are deterministic and documented; any rule change is a reviewed change with drill implications.
- The rename drill document becomes a living operational artifact: it must pass before release and whenever branding changes (RSK-6); keep it aligned with gate names as the toolchain evolves.
- The resolver-input contract is a stability promise to M0-S4 (config), M0-S5 (state), and the freeze: reshaping it later is a breaking-contract change requiring review.
- CI cost grows by one fast job; keep the scan fast and failure messages precise.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Branding seam | The single place (the pure branding resolver plus its input contract) through which the working name enters and all name-derived values leave. |
| Working name | The config-driven name input from which all twelve DEC-8 values are derived; data at a runtime-aware edge, never a committed literal. |
| Naming freeze | The future owner-gated change (M4-S1) that selects the public name, adds its literal to the scan seed, applies the branded scope, and executes the drill. |
| Naming firewall | ADR-0003 C-3: no new code or new user-facing doc hardcodes a product name outside the branding module and the legacy adapter. |
| Forbidden-literal scan | The CI-binding check that fails when a seed-set literal appears in a DEC-8 scope class outside the DEC-8 allowlist. |
| Seed literal set | The legacy tokens already public in this repository (`ados`, `ADOS_`, `~/.ados`); the scan's initial searched set, grown by one literal per frozen name. |
| Legacy compatibility adapter | The `adapters` `./legacy` subpath: maps legacy-prefixed environment variables and the legacy config directory to current names received as parameters, warning once per process; the only other place legacy literals may live. |
| One-time warning | Exactly one warning emission per process when any legacy source is read; none when none are. |
| Injected environment facts | Environment-derived inputs passed into the resolver as parameters by a runtime-aware edge; branding never reads the environment ambiently. |
| Runtime-aware edge | A surface, or a composition root that receives injected environment facts — the only place an environment override may be read. |
| Pure resolver | A derivation function with no ambient reads, no clock/randomness, and no runtime APIs; same input → same output. |
| Brand-neutral schema name | A telemetry schema name carrying no producer identity (`delivery.event.v1`); the producer name is branding metadata. |
| Rename drill | The documented procedure that replaces branding values in a temporary copy, runs the full verification battery, and proves the rename is one seam swap; executed pre-release and on any branding change. |
| Scope-of-claim | The DEC-8 rule that the single-seam guarantee covers `packages/**` and new user-facing docs only; the pre-existing corpus migrates separately. |
| Synthetic name | A test-fixture name invented for verification (e.g., rename simulations) that is not a candidate product name. |

## 24. APPENDICES

### Appendix A — DEC-8 derived-value set (resolver output contract)

| # | Value | Notes |
|---|-------|-------|
| 1 | Product name | The working name itself, as resolved. |
| 2 | Binary name | Deterministic derivation rule documented with the resolver. |
| 3 | Package scope | Applied at the freeze; neutral scope until then. |
| 4 | Environment prefix | Legacy correspondence: the pre-freeze legacy prefix (`ADOS_*`), read only by the legacy adapter. |
| 5 | Config directory name | Committed config path becomes `<repo>/.<product>/config.yaml` (DEC-4); legacy correspondence: `~/.ados`, read only by the legacy adapter. |
| 6 | State directory name | Consumed by M0-S5. |
| 7 | MCP tool prefix | Tool names are a projection of this prefix plus a canonical primitive ID; rename changes the projection, not the primitive. |
| 8 | Telemetry namespace | Producer identity for telemetry; never part of schema names (EVT-1/EVT-2). |
| 9 | Docs base URL | Derived; documented derivation rule. |
| 10 | Repository URL | Derived; documented derivation rule. |
| 11 | Release asset prefix | Consumed by release work post-freeze. |
| 12 | Install path | Consumed by distribution registration (C-7) when artifacts exist. |

### Appendix B — Forbidden-literal scan contract (per ADR-0003 C-3/DEC-8)

| Aspect | Contract |
|--------|----------|
| Scope classes | `packages/**`; root manifests; root workspace files; `.gitignore`; new user-facing docs |
| Seed literal set | `ados`, `ADOS_`, `~/.ados` (the legacy tokens already public in this repository); grows with the frozen name set — a freeze adds its literal in the same change |
| Allowlist | `packages/core/src/branding/**`; `packages/adapters/src/legacy/**`; decision records; historical change artifacts; required license/source headers |
| Failure behavior | Non-zero exit naming the offending file and token; binding CI job; mutation-proven failure path |
| Claim scope | `packages/**` + new user-facing docs only; the pre-existing corpus migrates separately |

### Appendix C — References

- ADR-0003 — OSS Tooling Monorepo Structure: C-3 (naming firewall with a tested rename seam), DEC-4 (committed config path supplied by branding), DEC-8 (naming firewall placement — the design contract for this change).
- Backlog, Epic M0, story M0-S2 (ticket GH-171) — goal, tasks, ACs.
- Current-truth baseline: `doc/spec/features/feature-monorepo-scaffold-toolchain.md` (boundaries, tier matrix, ambient rules, negative-fixture discipline, CI job list).
- Issue #171 owner comment (2026-10-29, binding delivery constraint) — transcribed in Section 1.
- PM planning notes (`chg-GH-171-pm-notes.yaml`) — decisions, current-truth baseline, AC decode, risks.
- Repository testing strategy (`.ai/rules/testing-strategy.md`) — mutation-test and fixture rules for repository invariant checks.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-29 | @spec-writer | Initial specification |

---

## AUTHORING GUIDELINES

- Sources: ADR-0003 (C-3 and DEC-8 read as the design contract), backlog story M0-S2, the issue #171 body plus the owner's binding comment of 2026-10-29 (fetched live and cross-checked against the pm-notes transcription — they match), the current-truth feature spec for the GH-170 scaffold, current code state (branding stub, contracts, legacy placeholder, hygiene-check seed, ambient guard), and `chg-GH-171-pm-notes.yaml`. Format and rigor follow the GH-170 sibling spec.
- No content was invented: the twelve-value set, scan scope, allowlist, legacy adapter rules, telemetry rule, and drill battery are quoted from ADR-0003 C-3/DEC-8; the owner constraint is quoted from the issue comment; all remaining decisions recorded here (DEC-1..DEC-7) were delegated to this spec by PM planning or follow directly from the binding constraint.
- Naming-constraint discipline: this spec contains no candidate or public product name. The tokens `ados`, `ADOS_`, and `~/.ados` appear only in their legacy/scan-seed framing (issue-body and ADR context). Examples use synthetic names.
- Scope discipline: scope, tasks, and ACs are exactly the issue body as refined by the owner comment — nothing more; everything else is NG/`[OUT]`/deferred with its owning story.
- No license headers: `doc/changes/` artifacts are temporary working files and never receive headers.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-171)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-1..F-8, EVT-1..EVT-2, DM-1..DM-3, NFR-1..NFR-9, RSK-1..RSK-6, DEC-1..DEC-7, AC-*)
- [x] Acceptance criteria reference at least one F-/EVT-/DM-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no code-level file paths, no step-by-step tasks)
- [x] No content duplicated from linked docs (ADR cited, not restated)
- [x] Front matter validates per front_matter_rules
- [x] All four ticket ACs covered and mapped (see Section 17 coverage note)
- [x] Owner naming constraint honored: no candidate/public product names; legacy tokens only in legacy/scan-seed framing; artifacts self-contained with generic rationale
