---
ados_distribution: internal
id: SPEC-BRIEF
status: Current
created: 2026-11-06
last_updated: 2026-11-06
owners: ["engineering"]
service: delivery-os
summary: "The read-only brief command and its delivery.brief.v1 payload: one deterministic, decision-first, one-screen render projected from the same injected collector facts as the status digest; nine closed render surfaces (six digest sections plus three named placeholders); ready-to-merge and owner-gate-age anchors; the closed three-entry placeholder catalog; exit 0 on collector unavailability with no status.collector identity; digest vocabulary and bounds reused by reference; zero brief-specific reads; no LLM in the render path."
links:
  related_changes: ["GH-228"]
  contracts:
    - "packages/core/src/contracts/brief.ts"
---

# Feature: Brief

## Overview

The brief command is the owner's read-only, one-screen starting point for daily attention. It returns `delivery.brief.v1`: a schema version, an injected `generatedAt`, the repository binding, nine render surfaces, two ranked anchored-action groups, the closed placeholder catalog, and explicit truncation markers. The brief is decision-first: anchored actions render before context, and every unbuilt capability renders as a named placeholder rather than an empty list or a zero.

The brief is a projection over the same collector state as the status digest. The command composes the status runtime, collects facts once through `collectStatusFacts`, and the pure projection calls `aggregateStatus` over those facts. It performs no read of its own: the read set, the five-value state vocabulary, the counts, the truncation flags, the evidence reasons, and the declared bounds are consumed by reference from the status contracts.

Collector unavailability is digest data, not a command failure. Every successful run returns all nine surfaces in the payload, and a failed, absent, unattempted, or unresolved read appears as the corresponding digest section state with the digest's reason. Only a rejected invocation (`fallback.invocation`, exit `1`) and containment (`fallback.internal`, exit `2`) can fail the command. The command adds no error-table row, no domain kind, no configuration key, no adapter read, and no new package or runtime-API location.

The brief is the owner-facing render surface for the three v0 anchors. It is attention, not authority: ready-to-merge cites observed collector evidence and never issues a merge verdict, and merge readiness remains owned by the verify-gates battery and the merge transaction. The status digest remains the coordinator-facing evidence surface; M1-S10 joins the same anchors to the digest from the same collector state, and neither surface contradicts the other.

The surrounding contracts are described in [Status Digest](feature-status-digest.md), [Result Contract and Error Table](feature-result-contract.md), [Queue Ready](feature-queue-ready.md), [Verify Gates](feature-verify-gates.md), and [Monorepo Scaffold and Toolchain](feature-monorepo-scaffold-toolchain.md). Command naming follows [ODR-0003](../../decisions/ODR-0003-cli-command-naming-v1-lock.md), and package tiers follow [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md).

## Business Context

### Problem Statement

- **Problem:** The owner's daily attention has no deterministic one-screen starting point. Facts must be assembled by hand from status output, ready-set reads, and tracker probes, and chat-assembled summaries drift or fabricate state. Unbuilt capabilities are especially dangerous: an absent collector can read as "nothing to do".
- **Affected Users:** The owner/operator starting a delivery day; lifecycle agents that consume machine output; maintainers of the status collector set, whose failures must appear truthfully on the owner surface.
- **Business Impact:** One deterministic, evidence-citing screen replaces hand assembly and model-generated prose. Every brief rule is code, so the owner can trust that a quiet screen is a verified observation and that a gap is named in place.

### Goals

- Provide one read-only `brief` command with no positionals and no command-specific flags beyond the global machine-output switch.
- Return exactly nine surfaces in every successful payload: the six digest sections and the three named placeholders.
- Put anchored actions first: ready-to-merge, blocker questions, and owner-gate ages.
- Never turn a failed, absent, unattempted, or unresolved read into an observed, clear, green, available, or zero claim.
- Keep the command deterministic, bounded, brand-neutral, read-only, and free of LLM calls, network capability, and child processes.

## User Experience & Functionality

### Command surface

The command is exactly `brief`, composed beside the other top-level commands in the CLI edge. It accepts no positionals and declares no command-specific flags; `--json` is the existing global machine-output switch and adds no command behavior. An unexpected positional or unknown flag is rejected by the parser before any source read as `fallback.invocation` with exit `1`.

The command handler owns no stream writes and chooses no exit code. It collects the injected facts once, projects the payload, and returns it; the CLI edge renders the human text or the machine envelope. The optional pure `humanText` renderer hook on the command-definition contract is invoked by the CLI edge in human mode; status, brief, and the other human-rendering commands supply one.

### Nine render surfaces

The payload's `surfaces` array is a closed, ordered set of exactly nine ids:

| Order | Surface id | Source | Meaning |
|---:|---|---|---|
| 1 | `tracker` | Status section `tracker` | Tracker families and counts; the owner-gate age anchor derives from its owner-hand-back family |
| 2 | `changes-and-prs` | Status section `changes-and-prs` | Active change and open pull requests; the ready-to-merge anchor derives from its rendered pull requests |
| 3 | `ci` | Status section `ci` | Bounded check-run classification for the checkout HEAD |
| 4 | `lanes-or-queue` | Status section `lanes-or-queue` | Always `not-delivered`; the `lane-queue-engine` placeholder maps to this section |
| 5 | `providers` | Status section `providers` | Provider configuration and the verified park fold |
| 6 | `parked-work` | Status section `parked-work` | Parked delivery changes from the git-ignored local PM context |
| 7 | `typed-questions` | Placeholder catalog | The blocker-question surface until the typed blocker channel exists |
| 8 | `gate-sla-states` | Placeholder catalog | SLA classifications until owner-gate SLA mechanics exist; renders beside the age anchor |
| 9 | `lane-queue-engine` | Placeholder catalog | The queue/lane engine until it exists |

A digest surface copies its section's `state`, `counts`, and `truncated` flag unchanged and carries the section's first evidence reason when one exists. A placeholder surface carries `not-delivered`, zero counts, `truncated: false`, and a fixed title in the payload. The surface set is closed: the status digest's six sections each have exactly one corresponding brief surface, and each unbuilt capability in the placeholder catalog has exactly one placeholder surface. Anchored actions are action groups, not a tenth surface.

### Anchored actions

The payload's `anchors` array carries exactly two ranked groups in decision-first order:

| Order | Group | State | Items |
|---:|---|---|---|
| 1 | `ready-to-merge` | The `changes-and-prs` section state | Non-draft pull requests with `deliveryState` `approved` whose item-level review signal is observed, ranked by numeric-aware identity ascending |
| 2 | `owner-gate-ages` | The `tracker` section state, or `unavailable` when the owner-hand-back family signal is unavailable | Owner-hand-back items, ranked by oldest observed age first with unknown ages last, then identity ascending |

**Ready-to-merge** projects only observed collector evidence: `deliveryState` `approved`, `draft` `false`, and item-level `reviewState` `observed`, on a section that is `observed` or `degraded`. An item with an unknown review signal, a failed pull-request read, an unavailable binding, a draft or non-approved delivery state, or a cap-omitted position is never claimed. Each action cites that item's bounded evidence (`kind`, `deliveryState`, `draft`, `reviewState`) and carries the section state. The record has no verdict, authorization, or "safe to merge" field. When the section is `observed` with no qualifying pull request, the group is explicitly empty and states `none approved`, which is a verified empty, not a gap.

**Owner-gate ages** project the tracker section's owner-hand-back family. The digest attaches no age to owner-hand-back items, so the brief derives the age from the same injected facts under the digest's parse-and-floor rule: the provider-native `updatedAt` of the corresponding work item is parsed, a future timestamp is unknown rather than negative, and the age is `floor((nowMs - updatedAt) / 86_400_000)` days with the injected clock. An absent, unparseable, or future timestamp renders as unknown, never as `0`, `0d`, an empty value, or a fabricated age. No SLA token (`escalated`, `overdue`, `breached`, or any expiry) is ever rendered; the `gate-sla-states` placeholder appears instead. When the owner-hand-back family signal is unavailable, the group is `unavailable` with no ages, never an observed empty family. When the tracker section itself is `unknown`, `unavailable`, or `not-delivered`, the group carries that section state regardless of the family signal.

### Named placeholder catalog

The payload's `placeholders` array is the closed v0 catalog:

| Capability id | Owning story | Collector evidence state | Why it is a placeholder |
|---|---|---|---|
| `typed-questions` | M1-S16 | `not-delivered` | The typed blocker/question channel does not exist in v0; the blocker-question surface is a named placeholder |
| `gate-sla-states` | M1-S5 | `not-delivered` | Ages render; SLA classifications do not exist until owner-gate SLA mechanics land |
| `lane-queue-engine` | M1-S17 | `not-delivered` | No queue or lane engine exists; the digest's `lanes-or-queue` section is always `not-delivered` |

The catalog is exactly three entries, contains no spend entry, and grows only through a reviewed change that updates the contract, tests, and documentation together. Each placeholder renders as a named line with its owning story and state; none may render as observed, empty, zero, or as an action. The blocker-questions block is the `typed-questions` surface, and `gate-sla-states` renders immediately after the owner-gate age anchor.

### Machine envelope and human brief

`brief --json` writes exactly one standard `CommandResult` envelope. Its `data` is the full `delivery.brief.v1` payload:

| Member | Content |
|---|---|
| `schemaVersion` | `delivery.brief.v1` |
| `generatedAt` | The injected generation time, equal to the digest's `generatedAt` |
| `repository` | The status digest's repository binding, unchanged; an unavailable binding stays unavailable |
| `surfaces` | The nine ordered surfaces |
| `anchors` | The two ordered anchored-action groups |
| `placeholders` | The closed three-entry catalog |
| `truncation` | One marker per truncated surface or anchor group, with the omitted count |

Each anchor group carries `group`, `state`, `items`, `truncated`, and `omitted`. Each action carries `identity`, `state`, and `evidence`. The serialized `data` payload is at most `STATUS_MAX_MACHINE_BYTES` (65 536 bytes); the envelope total is recorded but not separately capped. The envelope's `schemaVersion` is the shipped `delivery.result.v1`, and a success envelope carries no `error` key.

Human mode renders the same payload deterministically:

```
<binary> brief  <owner>/<name>
ready-to-merge  <state>  none approved | <n> approved: <id>, <id> +N more
blocker-questions  typed-questions (M1-S16)  not-delivered
owner-gate-ages  <state>  none | <ref> <n>d, <ref> age unknown +N more
gate-sla-states  M1-S5  not-delivered
tracker  <state>  total <n> (<n> unknown) +N more
changes-and-prs  <state>  total <n> (<n> unknown)
ci  <state>  total <n> (<n> unknown)
lanes-or-queue  <state>  lane-queue-engine (M1-S17)
providers  <state>  total <n> (<n> unknown)
parked-work  <state>  total <n> (<n> unknown)
```

The header names the injected brand binary and the bound repository; when the binding is unavailable it reads `repository unavailable (<reason>)`. Every line names its state; when a digest evidence reason exists and is neither `observed` nor the state word itself, the line appends it as `(<reason>)`. Truncation appends ` +N more` when items were omitted, or ` +more` for a source-at-limit signal. The human text is at most `STATUS_MAX_HUMAN_LINES` (24) non-empty lines and `STATUS_MAX_HUMAN_BYTES` (4096) bytes; if the content exceeds the bound, lines are dropped from the end (context first) and the final line is `... <n> line(s) omitted to fit the one-screen bound`, so no drop is silent. Human mode contains no timestamps, no raw payloads, no item titles, no secrets, and no generated prose; it performs no extra reads.

### Bounds and determinism

All bounds are consumed by reference from the status contract: `STATUS_MAX_HUMAN_LINES` (24), `STATUS_MAX_HUMAN_BYTES` (4096), and `STATUS_MAX_MACHINE_BYTES` (65536). The brief declares no parallel numeric bound and no parallel vocabulary. Identical injected inputs produce byte-identical human and machine output: the clock, run id, brand, and output streams are injected, and every variable collector fact arrives through `StatusFacts`.

### Error identity reuse and collector unavailability

The brief adds no error-table row and no domain kind. Section and placeholder failures are payload data, not command failures. Collector unavailability renders at exit `0` with the affected surface naming its own evidence state (state word plus reason). This is distinct from the closed placeholder catalog, which stays at exactly three unbuilt capabilities. Only existing containment identities can fail the command: `fallback.invocation` projects to exit `1`, and `fallback.internal` projects to exit `2`. No `status.collector.<id>.unavailable` identity exists in the brief payload, the evidence, or the brief documentation; the closed family itself is the board's declared status-domain identity (see [Owner-Gate SLA](feature-owner-gate-sla.md)) and never appears in brief output.

## Technical Architecture & Codebase Map

### Core components and directory structure

| Path | Responsibility |
|---|---|
| `packages/core/src/contracts/brief.ts` | The `delivery.brief.v1` vocabulary: schema id, the closed nine-id surface order, the closed three-entry placeholder catalog and titles, the two anchor-group ids, surface and action types, and the payload type. Types and `as const` data only; the digest vocabulary and states are imported by reference. |
| `packages/core/src/domain/brief.ts` | The pure `projectBrief` and `renderBriefHuman` functions: digest projection, surface assembly, anchor derivation, placeholder projection, truncation assembly, deterministic grammar, and the line/byte bound. No I/O, clock, randomness, or ambient environment. |
| `packages/core/src/contracts/index.ts` | Re-exports the brief vocabulary through the shared contracts subpath. |
| `packages/core/src/domain/index.ts` | Re-exports `projectBrief` and `renderBriefHuman`. |
| `packages/cli/src/commands/brief.ts` | The `brief` command definition over the injected status runtime; no stream writes and no exit-code choice. |
| `packages/cli/src/commands/status.ts` | The shared `collectStatusFacts` composition the brief reuses; the brief performs no additional read. |
| `packages/cli/src/edge.ts` | The brief runtime composition: `createStatusCommandRuntime` over the `brief` status composition, including the credential-reference-only guard and the provider-config resolver. |
| `packages/cli/src/index.ts` | The optional pure `humanText` command-definition hook the CLI edge invokes in human mode. |
| `packages/cli/src/output/serialize.ts` | The single redacted output path; renders the pre-rendered human text. |

### Data flow

1. The CLI edge composes `createBriefCommandDefinition(createStatusCommandRuntime(options.brief, resolveProviderConfig))`. The credential-reference guard runs first; a refused instance withholds only the GitHub reads.
2. The handler calls `collectStatusFacts(runtime)` once: repository binding and HEAD, one bounded issues page, one bounded pull-request page, one bounded check-runs page when the SHA is resolved, the provider configuration resolve, the verified park fold, and the local PM-context read.
3. `projectBrief(facts)` calls `aggregateStatus(facts)` over the same object, then copies the six section states, counts, truncation, and first reason into surfaces and appends the three placeholder surfaces.
4. The projection derives the two anchor groups: ready-to-merge from the changes section's rendered pull requests, and owner-gate ages from the tracker owner-hand-back family plus the underlying injected work items' `updatedAt`.
5. The projection assembles truncation markers and returns the payload.
6. Machine mode wraps the payload in the standard envelope; human mode calls `renderBriefHuman` and writes through the single redaction path.

### API and interface contracts

- **`projectBrief(facts: StatusFacts): BriefPayload`** — the only projection surface. It consumes the same fully injected facts as `aggregateStatus` and performs no I/O.
- **`renderBriefHuman(brief: BriefPayload, brand: BrandIdentity): string`** — the only human-rendering surface. It reads no source and derives everything from the payload plus the injected brand binary name.
- **`createBriefCommandDefinition(runtime: BriefCommandRuntime): CommandDefinition`** — declares no flags, `positionals.max` of `0`, the pure `humanText` renderer, and a handler that returns `{ data: projectBrief(await collectStatusFacts(runtime)) }`.
- **`BriefCommandRuntime`** — an alias of the status runtime: the same injected reader member set, with no brief-only member.
- **`BRIEF_SCHEMA_VERSION`**, **`BRIEF_SURFACE_ORDER`**, **`BRIEF_PLACEHOLDER_CATALOG`**, **`BRIEF_ANCHOR_GROUPS`** — the closed contract data the projection and tests share.
- The brief contracts import only shared contracts; the domain imports shared contracts and its own modules. The GitHub, repository, and file I/O stay in the already-admitted adapter subpaths. No new package, subpath, or runtime-API location is introduced.

## Security and Boundaries

- **Read-only by construction:** the command calls no write or fence API, no tracker, pull-request, or CI write, no provider engine, and no quota endpoint.
- **Credential centralization:** the only credential access is the credential port resolving the declared GitHub credential reference. The brief code reads no ambient environment and adds no secret-read allowlist entry.
- **Composition guard:** only a GitHub `vcs` instance whose auth mechanism is `credential-reference` is admitted; an anonymous or otherwise configured instance is refused at composition before any GitHub read, while the local PM context remains readable. The per-section outcomes are the status digest's fixed guard outcomes.
- **No shell or spawn:** repository binding and HEAD facts come from bounded git metadata reads through the repository adapter. The brief spawns no child process and executes no shell.
- **No model or network capability in the render path:** the contract, domain, and command modules import no model SDK, HTTP client, or network module; the mechanical assertion is a structure/boundary scan, and review re-asserts it on every change to the render surface.
- **Bounded parsing:** the local PM context uses the same bounded YAML core parsing as the status digest; parse failures are classified as evidence, never raw parser output.
- **Bounded input and output:** source pages and digest item caps are inherited; the brief enforces the status human line and byte bounds in its renderer and relies on the digest's caps for the machine bound.
- **No leakage:** evidence carries codes, classes, counts, and safe locations only. The serialization redaction chokepoint covers the envelope and human text.
- **Brand neutrality:** no product or binary literal is committed. The human header uses the injected brand binary name.

## Non-Functional Requirements

| Concern | Current guarantee |
|---|---|
| Surface totality | Exactly nine surfaces in fixed order in every successful payload: six digest sections plus three placeholders; zero missing or extra surfaces. |
| Non-verdict guarantee | A failed, absent, unattempted, or unresolved read never renders as observed, clear, green, available, or zero; an unknown age is never `0`; no SLA state is fabricated; ready-to-merge is never a verdict. |
| Shared truth | Every digest-derived state, count, truncation flag, and reason equals the digest's value for the same injected facts; the only derived claims are owner-gate ages under the declared parse-and-floor rule and the closed catalog entries. |
| Bounds | Human output at most 24 lines and 4096 bytes; serialized `data` at most 65 536 bytes; every drop or limit-truncated case marked. |
| Read-only, determinism | Zero writes, fence acquisitions, state mutations, network writes, or child processes; identical injected inputs produce identical payload and human bytes. |
| Output contract | `--json` produces exactly one valid envelope with an exit in `{0,1,2}`; human mode produces one bounded screen; rendering performs zero extra reads. |
| Error-table stability | Zero new rows, domain kinds, or configuration keys; the sync check stays green. |
| Boundaries and branding | Zero new runtime-API locations or secret-read allowlist entries; zero product literals; structure, boundary, ambient, and literal gates stay green. |
| Performance and read cost | Pure projection over cap-sized inputs completes within 50 ms on the reference environment; at most three outbound read-only requests, one park fold, and one configuration resolve per invocation, identical to one status invocation; zero retries or loops. |
| No-LLM render path | Zero model calls in the render path, asserted by dependency-boundary checks and by review on every change to the render surface. |
| Privacy | Zero secrets or raw provider payloads in the payload, evidence, or human text; no ambient environment reads outside the allowlist. |

## Quality Assurance Strategy

| Level | Scope | Evidence |
|---|---|---|
| Structure | Declaration-only contracts, closed nine-id surface set, closed three-entry catalog, bounds and vocabulary imported by reference, domain purity, command import discipline, no product literals, inventory registration | `tests/structure/brief-contract.test.ts`, `tests/structure/brief-imports.test.ts`, `tests/structure/content-inventory.test.ts`, `tests/structure/inventory.json` |
| Behaviour | Command surface and grammar rejection before any read, shared-truth agreement over one fact model, read-cost parity, anchor honesty, placeholder rendering, the exhaustive failed/absent-read matrix, corpus completeness | `tests/behaviour/brief-command.test.ts`, `tests/behaviour/brief-shared-truth.test.ts`, `tests/behaviour/brief-read-cost.test.ts`, `tests/behaviour/brief-anchors.test.ts`, `tests/behaviour/brief-placeholders.test.ts`, `tests/behaviour/brief-negative-controls.test.ts`, `tests/behaviour/brief-corpus.test.ts` |
| Output and golden | Decision-first order, human and machine bounds, explicit truncation markers, byte-exact goldens | `tests/behaviour/brief-output.test.ts`, `tests/golden/brief.test.ts` with `tests/fixtures/brief/golden/**` |
| Determinism and read-only | Replay equality, human-content discipline, zero writes and spawn, credential-reference guard, redaction canary | `tests/behaviour/brief-determinism.test.ts`, `tests/behaviour/brief-readonly.test.ts`, `tests/golden/redaction.test.ts` |
| Envelope and exits | One success envelope per outcome, collector unavailability at exit `0`, containment projection only, error-table stability | `tests/behaviour/brief-envelope.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/structure/error-table.test.ts` |
| Performance | Pure projection over cap-sized facts within the declared bound; page-size invariance | `tests/behaviour/brief-performance.test.ts` |
| Non-vacuity | Source-mutation non-vacuity controls: each mutation disables one named guard in the production brief domain module, a temp copy is loaded through a `file://` URL from `tmp/tmpdir` with the live source left byte-identical, the clean module resists every prohibited observable, and every mutant fires it naming the case, acceptance criterion, and intended suite; guards outside the domain are cross-referenced to live seeded controls and the reference itself is asserted | `tests/checks/brief-mutants.test.ts` with `tests/fixtures/brief/mutants/catalog.ts` |
| Documentation posture | Current-truth feature spec, reconciled man page, delivered registry row, status-digest cross-link | `doc/spec/features/feature-brief.md`, `doc/planning/oss-tooling/milestones/m1/commands/brief.md`, `doc/planning/oss-tooling/cli-command-registry.md` |
| Aggregate | The whole workspace | `pnpm check` |

The fixture model is shared, not parallel. `tests/fixtures/brief/harness.ts` exposes `briefRuntime` as the status runtime and `runBriefCli` over the in-process CLI composition; `tests/fixtures/brief/cases.ts` and `tests/fixtures/brief/corpus/cases.ts` declare one case per failure mode, anchor edge, cap boundary, and verified-empty world. A single `StatusFacts` object drives both the digest and the brief, so a brief-only fact fails the shared-truth suite. Every fixture is synthetic and committed: refs, entity ids, SHAs, timestamps, and small counts only; no live credential, network call, child process, or live-tree write. The cap-sized goldens `tests/fixtures/brief/golden/human.txt` and `envelope.json` pin the exact human screen and envelope bytes; the suites open them read-only and assert their `mtimeMs` is unchanged. Golden bytes are regenerated only by the explicit command `bun run tests/fixtures/brief/golden/regenerate.ts`, never by a test side effect.

## Operational & Support

### Configuration

The command consumes the resolved provider configuration branch exactly as status does and reads the repository binding from `origin`. It adds no configuration key, no brief-specific cap, no threshold, and no placeholder configuration. The closed surface set, the placeholder catalog, and the anchor-group ids are contract data in `core ./contracts`.

### Observability

The payload is the observability surface: the standard envelope's `runId` and `timing`, the nine per-surface states, the two anchor group states, the placeholder entries, and the explicit truncation markers. No telemetry exporter, event sink, or background process is added. Degraded collection is visible in-band on the rendered surfaces; nothing is reported green from an unobserved source.

### Cost and read cost

One invocation performs the same work as one status invocation: at most three outbound read-only GitHub requests, one logical verified park-fold read, and one configuration resolve. The projection is linear over capped input. There is no retry loop, pagination crawl, daemon, model call, or new runtime dependency.

### Maintenance

- Adding an anchor or a placeholder is a contract change to the closed sets plus projection, renderer, tests, and documentation.
- Replacing a placeholder with a real surface is a reviewed change in the owning story (M1-S5, M1-S16, M1-S17); the same-source, named-gap, and no-LLM invariants hold.
- Changing the human grammar requires regenerating the committed goldens with the explicit command and keeping the bounds.
- The no-LLM assertion and the read-cost parity assertion are re-run on every change to the render surface.
- The status digest remains the vocabulary home; the brief must not redeclare a state, reason, count, or numeric bound.

## Dependencies & Risks

- **Depends on** the status digest ([feature-status-digest.md](feature-status-digest.md)) for the collector facts, the six sections, the five-value states, the evidence reasons, the counts, the truncation model, and the declared bounds.
- **Depends on** the result contract ([feature-result-contract.md](feature-result-contract.md)) for the envelope, the `{0,1,2}` exit projection, existing failure identities, and the sole redaction path.
- **Depends on** queue ready ([feature-queue-ready.md](feature-queue-ready.md)) for the observed-approval merge-ready convention the ready-to-merge anchor must not contradict.
- **Depends on** verify gates ([feature-verify-gates.md](feature-verify-gates.md)) for gate-verdict ownership; the brief never issues a verdict.
- **Depends on** the monorepo scaffold ([feature-monorepo-scaffold-toolchain.md](feature-monorepo-scaffold-toolchain.md)) for tiers, boundaries, and runtime-API confinement.
- **Relates to** status-digest expansion (M1-S10), which joins the same anchors to the digest from the same collector state.
- **Risk — degraded evidence read as an all-clear:** mitigated by the nine-surface closed set, the digest state copy, and the exhaustive negative-control matrix.
- **Risk — ready-to-merge read as a merge authorization:** mitigated by the evidence-only action record, the absence of any verdict field, and current-truth wording that states attention-only.
- **Risk — an unknown age or signal fabricated:** mitigated by the parse-and-floor rule, the unknown state for absent or unparseable timestamps, and a mutant that defaults an unknown age to zero.
- **Risk — an unbuilt capability rendered as an empty surface:** mitigated by the closed three-entry catalog and the named-line rendering.
- **Risk — brief and status contracts drift:** mitigated by one source of truth (`StatusFacts`), vocabulary reuse by reference, shared-truth tests, and cross-linked current-truth specs.
- **Risk — output overflow on dense worlds:** mitigated by the status bounds, explicit dropped-line and omitted-count markers, and at/above-cap tests.
- **Risk — an LLM or network capability entering the render path:** mitigated by import and boundary scans with failing controls, plus review on every render-surface change.

## Design Decisions and Resolution Record

The brief's current rules are fixed by these decisions; each row states the rule as it applies now.

| ID | Current rule |
|---|---|
| DEC-1 | The brief renders from the same collector state as the status digest with zero brief-specific reads. |
| DEC-2 | Collector unavailability is digest data at exit `0`: the affected surface names its own evidence state, distinct from the unbuilt-capability catalog; only `fallback.invocation` (`1`) and `fallback.internal` (`2`) can fail; the brief adds no error-table row and carries no `status.collector.<id>.unavailable` identity in its payload, evidence, or documentation (the family itself is the board's declared status-domain identity). |
| DEC-3 | The render path contains no LLM or model call. |
| DEC-4 | The brief is the v0 owner-facing render surface; M1-S10 joins the same anchors to the status digest from the same collector state, and the two specs stay non-contradictory. |
| DEC-5 | The v0 anchor set is exactly ready-to-merge, blocker questions (placeholder), and owner-gate ages; spend is not surfaced. |
| DEC-6 | The placeholder catalog is closed at exactly `typed-questions` (M1-S16), `gate-sla-states` (M1-S5), and `lane-queue-engine` (M1-S17), each `not-delivered` and each naming capability, owning story, and state. |
| DEC-7 | Ready-to-merge projects only observed-approval, non-draft, open pull-request evidence from the digest and is an attention anchor, never a gate verdict. |

**Human grammar (OQ-1).** The exact human line grammar and per-surface wording are pinned by the committed goldens `tests/fixtures/brief/golden/human.txt` and `envelope.json`. The cap-sized screen renders in 11 non-empty lines and 564 UTF-8 bytes, inside the 24-line and 4096-byte bounds, so the decision-first order and the bound do not conflict. Regeneration is the explicit command `bun run tests/fixtures/brief/golden/regenerate.ts`.

## Glossary & References

| Term | Definition |
|---|---|
| Brief | The one-screen, decision-first, deterministic projection of the collector state for the owner's daily attention; render-only, no LLM. |
| `delivery.brief.v1` | The brief payload schema version carried in the machine envelope's `data`. |
| Render surface | One of the closed nine brief surfaces: six digest sections plus three named placeholders, each carrying exactly one five-value state. |
| Anchored action | A decision-first entry in one of the two ranked action groups, citing bounded collector evidence and carrying an explicit state; attention, never a gate verdict. |
| Ready-to-merge | An attention projection over observed approved, non-draft, open pull requests from the changes section; never an authorization or verdict. |
| Owner-gate age | The age of an owner-hand-back item under the parse-and-floor rule over its provider-native `updatedAt`; unknown when the timestamp is absent, unparseable, or in the future. |
| Named placeholder | A closed-catalog entry naming an unbuilt capability, its owning story, and its `not-delivered` state; never silent and never a zero. |
| Same collector state | The identical injected `StatusFacts` the status digest consumes; the brief adds zero reads of its own. |
| Five-value section state | The digest's closed state set (`observed`, `degraded`, `unknown`, `unavailable`, `not-delivered`), reused by reference for every brief surface. |

See also: [Status Digest](feature-status-digest.md), [Result Contract and Error Table](feature-result-contract.md), [Queue Ready](feature-queue-ready.md), [Verify Gates](feature-verify-gates.md), [Configuration Layer and Inspection](feature-config-layer.md), [Provider Engine](feature-provider-engine.md), [Monorepo Scaffold and Toolchain](feature-monorepo-scaffold-toolchain.md), the [command registry](../../planning/oss-tooling/cli-command-registry.md), the [brief man-page pack](../../planning/oss-tooling/milestones/m1/commands/brief.md), the [repository glossary](../../overview/glossary.md), [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md), and [ODR-0003](../../decisions/ODR-0003-cli-command-naming-v1-lock.md).

**Change record:** `doc/changes/2026-11/2026-11-05--GH-228--brief-render-only/`.
