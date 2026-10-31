---
id: SPEC-PM-NOTES-LINT-AND-PHASE-TRANSITIONS
status: Current
created: 2026-10-31
last_updated: 2026-10-31
owners: ["engineering"]
service: delivery-os
summary: "The implemented M0-S10 surface: pm-notes schema and variant conformance through a read-only lint command with named targets, the phase command family as the only schema-validated write path for phase state with a nine-row idempotency matrix, delivery-registry transition records and a derived phase-state projection over the state layer, the pinned evidence vocabulary, five additive lint error rows, and the variant-era corpus boundary with an explicit exclusion manifest."
links:
  related_changes: ["GH-179"]
  related_decisions: ["ADR-0003"]
---

# Feature: pm-notes lint and phase transitions

## Overview

This feature makes document conformance a write-time property and gives phase state exactly one write path. The `lint` command is read-only: it validates a named change's pm-notes document, the delivery registry, or both, and reports the first classified finding. The `phase` command family (`list`, `complete`, `reopen`) is the only schema-validated, idempotent path for changing phase state: it validates grammar before touching any target, lints the post-transition document, appends one delivery-registry transition on a landing, preserves opaque extras in the document, and replaces a derived phase-state projection.

The delivery registry is the first consumer of the state layer. Ledger records are the durable truth; the per-change projection is a pure fold that is atomically replaced and rebuildable. All I/O, time, and state access arrive through injected seams at the CLI edge; the contracts, domain, and registry modules stay runtime-neutral.

## Business Context

- **Problem:** Hand-edited phase declarations drift, malformed notes reach delivery, and every consumer used to decide phase state from a different representation. Out-of-order completions and repeated transitions were indistinguishable from real state changes.
- **Affected users:** Agents and humans running the delivery workflow, and later verification stories that read the same registry.
- **Value:** Conformance fails loudly with one pinned identity, redundant transitions are explicit no-ops, and the ledger read later is verified, classified, and never silently torn.

## User Experience & Functionality

### pm-notes conformance

A pm-notes document requires `change_id`, `title`, `delivery_mode`, and `phases`. Optional typed keys (`milestone`, `story_code`, `variant`) and optional collections (`decisions`, `open_questions`, `blockers`, `notes`) are validated only when present. Every extra top-level key, phase key, or entry key is opaque: it is preserved and never inspected (no closed key set).

The `phases` map carries one entry per applicable phase. Applicable entries expose `started` and `completed` as timestamp strings or `null`; any other entry field is opaque. The canonical lifecycle vocabulary has eleven phases. The effective variant is `full` when `variant` is absent; an explicit `lite` requires exactly the pinned six: `clarify_scope`, `specification`, `delivery`, `quality_gates`, `dod_check`, `pr_creation`. Unknown variant values are distinct from wrong-typed ones.

### `lint` command

The command takes one change ref and additive target flags:

| Invocation | Target | Outcome |
|---|---|---|
| `lint <ref>` (or `--pm-notes`) | pm-notes | Missing file → `lint.target.missing`; otherwise the first family finding. |
| `lint <ref> --registry` | delivery registry | Absent store → explicit verified-empty pass; torn/schema/key-set → classified `state.*`. |
| `lint <ref> --pm-notes --registry` | both | pm-notes first, then registry; the first failure is the verdict. |

Lint is read-only: it never writes a target, acquires no fence, and returns the same verdict across replays. `--json` always rides the result envelope.

### `phase` command and the idempotency matrix

`phase list <ref>` reads the derived state. `phase complete <ref> <phase>` and `phase reopen <ref> <phase> <reason>` are the only write path. Grammar is validated first: a missing or empty reopen reason and a phase id outside the canonical vocabulary reject with `input.value.rejected` before target resolution, parsing, or state inspection. Reopening an absent phase is a no-op that creates no entry.

| # | Prior state | Command | Outcome |
|---|---|---|---|
| 1 | open | complete | Lands one transition record. |
| 2 | completed | complete | No-op success citing the existing completion. |
| 3 | reopened | complete | Re-completion lands a new record. |
| 4 | completed | reopen reason | Lands with the exact reason recorded. |
| 5 | open or absent | reopen reason | No-op; no record and no entry; reason in evidence only. |
| 6 | any | complete with earlier phases open | Lands with an `earlier-open` advisory naming the still-open earlier phases of the effective variant. |
| 7 | any | reopen without a reason | Rejected `input.value.rejected` before state inspection. |
| 8 | any | phase outside the canonical vocabulary | Rejected `input.value.rejected`; no state inspection. |
| 9 | absent canonical phase | complete | A valid entry is created and the transition lands; `outside-required-set` advisory when the phase is outside the effective variant. |

A landing writes only the target entry's `started`/`completed`; comments, extra entry keys, and free-form values survive value-faithfully. At most one advisory object accompanies a landing.

### Delivery registry and derived projection

Every landing appends exactly one `phase.transition` record carrying the change ref, phase id, operation (`complete` or `reopen`), timestamp, outcome, and a reopen-only reason. No-op transitions append nothing, and the ledger is append-only.

The per-change phase state is a derived document named `phase-state.<REF>.json` with shape `{ schemaVersion, changeRef, phases }`, where each phase entry is `{ started, completed }`. It is a pure fold of verified transition records: no timestamp or non-fold field is stored, so a rebuild is byte-stable. The ledger is truth; the projection is disposable and atomically replaced.

### Evidence vocabulary

Landings carry `{ outcome: "landed" }`. No-op completions carry `{ outcome: "no-op", basis: "already-completed", completedAt }`; no-op reopens carry `{ outcome: "no-op", basis: "not-completed", phase }` plus the supplied reason. Advisories use `{ class: "earlier-open", phases }` or `{ class: "outside-required-set", phase, variant }`. A verified-empty registry read carries `{ class: "verified-empty", target: "registry" }`.

### Error identities

Five additive rows join the machine error table under the `lint` domain kind, and the documented table ships in the same change: `lint.notes.malformed`, `lint.keys.missing`, `lint.variant.unknown`, `lint.phases.incomplete`, and `lint.target.missing`. All are user-category, non-retryable, `not_landed`, and project to exit 1. Storage failures reuse the existing `state.*` identities; platform state failures project to exit 2, user-category state failures to exit 1.

### Corpus boundary

Corpus acceptance covers change folders dated 2026-10 or later, minus an explicit exclusion manifest of repo-relative paths. The manifest currently names one known-unparseable historical artifact; a guard asserts it names exactly one path, that the path exists, and that the file is genuinely unparseable, so exclusions cannot grow silently. Legacy-era documents stay outside the corpus but remain bound by the schema at write time.

## Technical Architecture & Codebase Map

- `packages/core/src/contracts/pm-notes.ts` — document/entry/collection types, canonical and LITE phase sets, required keys, and the five lint identities. Types and `as const` data only.
- `packages/core/src/contracts/registry.ts` — registry schema version, transition kind, payload type, and projection name/shape. Types and data only.
- `packages/core/src/domain/pm-notes-lint.ts` — pure rules in fixed order: parse, keys, value types, variant, required phases. No I/O and no parser invocation.
- `packages/core/src/state/registry.ts` — fenced append, verified read, pure fold, and atomic projection replace over the state port. No runtime API.
- `packages/adapters/src/file/pm-notes-parser.ts` — target location, YAML 1.2 core parse with bounded size/nodes/depth/aliases, and the document-edit staging used by the write path.
- `packages/cli/src/commands/lint.ts` — target selector, rule invocation, and envelope-shaped data/error results.
- `packages/cli/src/commands/phase.ts` — grammar-first command family, staged lint, ledger-fold idempotency, advisories, and document write.
- `packages/cli/src/edge.ts` — composition root: adapters parser, state store, clock, and fencing composed beside `config`.

### Invariants

- Tier: contracts are data-only; domain imports contracts only; the registry imports contracts and its own state modules; runtime APIs remain confined to the state driver edge.
- Exit projection: `success` → 0, user validation → 1, platform provider → 2. Handlers never choose exits or write streams; the CLI edge owns rendering and projection.
- Brands arrive through the injected identity; no product or binary name literal exists in the delivered modules.
- Lint is deterministic and read-only; the phase write path refuses to decide idempotency from unverified bytes.
