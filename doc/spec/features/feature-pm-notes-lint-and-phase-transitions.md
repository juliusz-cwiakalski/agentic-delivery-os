---
id: SPEC-PM-NOTES-LINT-AND-PHASE-TRANSITIONS
status: Current
created: 2026-10-31
last_updated: 2026-10-31
owners: ["engineering"]
service: delivery-os
summary: "The implemented M0-S10 surface: pm-notes schema and variant conformance through a read-only lint command with named targets, the phase command family as the only schema-validated write path for phase state with a nine-row idempotency matrix, delivery-registry transition records and a derived phase-state projection over the state layer, the pinned evidence vocabulary, the five lint error rows, and the variant-era corpus boundary with an explicit exclusion manifest."
links:
  related_changes: ["GH-177", "GH-179"]
  related_decisions: ["ADR-0003", "TDR-0005"]
---

# Feature: pm-notes lint and phase transitions

## Overview

This feature makes document conformance a write-time property and gives phase state exactly one write path. The `lint` command is read-only: it validates a named change's pm-notes document, the delivery registry, or both, and reports the first classified finding. The `phase` command family (`list`, `complete`, `reopen`) is the only schema-validated, idempotent path for changing phase state: it validates grammar before touching any target, lints the post-transition document, appends one delivery-registry transition on a landing, preserves opaque extras in the document, and replaces a derived phase-state projection. `phase list` derives state by folding the verified registry ledger; the stored projection is a replaceable convenience document, not a read dependency.

The delivery registry is the first consumer of the state layer. Ledger records are the durable truth; the per-change projection is a pure fold that is atomically replaced and rebuildable. All I/O, time, and state access arrive through injected seams at the CLI edge; the contracts, domain, and registry modules stay runtime-neutral.

Verify change is a read-only consumer of this surface: it reuses the lint rules and identities, the pinned variant required sets, and the verified registry history, but it never writes a document, appends a record, acquires a fence, or reads the derived projection as evidence. Its finalization verdict is variant-aware: a `full` change is complete only when the eleven canonical phases are completed, and a `lite` change only when the pinned six are completed, after per-phase registry-over-declaration precedence.

## Business Context

- **Problem:** Hand-edited phase declarations drift, malformed notes reach delivery, and phase state has no single representation or write path. Out-of-order completions and repeated transitions are indistinguishable from real state changes.
- **Affected users:** Agents and humans running the delivery workflow, and later verification stories that read the same registry.
- **Value:** Conformance fails loudly with one pinned identity, redundant transitions are explicit no-ops, and the ledger read later is verified, classified, and never silently torn.

## User Experience & Functionality

### pm-notes conformance

A pm-notes document requires `change_id`, `title`, `delivery_mode`, and `phases`. Optional typed keys (`milestone`, `story_code`, `variant`) and optional collections (`decisions`, `open_questions`, `blockers`, `notes`) are validated only when present. Every extra top-level key, phase key, or entry key is opaque: it is preserved and never inspected (no closed key set).

The `phases` map carries one entry per applicable phase. Applicable entries expose `started` and `completed` as timestamp strings or `null`; any other entry field is opaque. The canonical lifecycle vocabulary has eleven phases. The effective variant is `full` when `variant` is absent; an explicit `lite` declares the pinned six required phases — `clarify_scope`, `specification`, `delivery`, `quality_gates`, `dod_check`, `pr_creation` — while phase keys beyond the required set stay allowed and opaque. Unknown variant values are distinct from wrong-typed ones.

### `lint` command

The command takes one change ref and additive target flags:

| Invocation | Target | Outcome |
|---|---|---|
| `lint <ref>` (or `--pm-notes`) | pm-notes | Missing file → `lint.target.missing`; otherwise the first family finding. |
| `lint <ref> --registry` | delivery registry | Absent store → explicit verified-empty pass; torn/schema/key-set → classified `state.*`. |
| `lint <ref> --pm-notes --registry` | both | pm-notes first, then registry; the first failure is the verdict. |

Lint is read-only: it never writes a target, acquires no fence, and returns the same verdict across replays. Registry pass evidence reports the record count, the verification classes performed, and whether the derived projection document is present. `--json` always rides the result envelope.

### `phase` command and the idempotency matrix

`phase list <ref>` reports the phase state folded from the verified transition ledger. `phase complete <ref> <phase>` and `phase reopen <ref> <phase> <reason>` are the only write path. Grammar is validated first: a missing or empty reopen reason and a phase id outside the canonical vocabulary reject with `input.value.rejected` before target resolution, parsing, or state inspection. Reopening an absent phase is a no-op that creates no entry.

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

A landing writes only the target entry's `started`/`completed`; comments, extra entry keys, and free-form values survive value-faithfully. At most one advisory object accompanies a landing, and only a completion carries one: a phase outside the effective variant's required set carries `outside-required-set`, otherwise a completion with still-open earlier phases carries `earlier-open`. A reopen carries no advisory.

### Delivery registry and derived projection

Every landing appends exactly one ledger record of kind `phase.transition` under the per-change record key `phase.transitions:<REF>`. The record's payload carries the landing's change ref, phase id, operation (`complete` or `reopen`), timestamp, outcome, and reopen-only reason, together with the full verified history for that change; a verified read returns the last record for the key, so the whole history arrives without an unverified scan. No-op transitions append nothing, and the ledger is append-only.

The per-change phase state is a derived document named `phase-state.<REF>.json` with shape `{ schemaVersion, changeRef, phases }`, where each phase entry is `{ started, completed }`. It is a pure fold of verified transition records: a completion sets the first-completion start and the latest completion, a reopen clears `completed` while keeping the recorded start, and no timestamp or non-fold field is stored, so a rebuild is byte-stable. The ledger is truth; the projection is disposable and atomically replaced.

### Evidence vocabulary

Landings carry `{ outcome: "landed" }` plus the reason on a reopen. No-op completions carry `{ outcome: "no-op", basis: "already-completed", phase, completedAt }`; no-op reopens carry `{ outcome: "no-op", basis: "not-completed", phase, reason }`. Advisories use `{ class: "earlier-open", phases }` or `{ class: "outside-required-set", phase, variant }`. A verified-empty registry read carries `{ class: "verified-empty", target: "registry" }`.

### Error identities

Five rows sit under the `lint` domain kind in both the machine error table and the documented table: `lint.notes.malformed`, `lint.keys.missing`, `lint.variant.unknown`, `lint.phases.incomplete`, and `lint.target.missing`. All are user-category, non-retryable, `not_landed`, and project to exit 1. Storage failures reuse the existing `state.*` identities; platform state failures project to exit 2, user-category state failures to exit 1.

### Read-only verification consumer

Verify change consumes this surface without changing it. It reuses the fixed lint rule order and the five `lint.*` identities for document-conformance findings, and it reads the verified registry history through the state layer to apply per-phase registry-over-declaration precedence. The only additive identity is `verify.ledger.incomplete` under the `verify` domain kind: a conformant document whose declared variant still has declared-but-incomplete required phases is a delivery verdict, not a lint finding. A required phase absent from the declaration remains `lint.phases.incomplete` after the overlay.

Verification is variant-aware: it evaluates the effective variant's required set from the pinned per-variant data, naming missing phases in that set's order. It never writes pm-notes, never appends or repairs the ledger, never acquires a fence, and never substitutes the derived phase-state projection for the ledger. The full contract is in [verify change and exit taxonomy](feature-verify-change-and-exit-taxonomy.md).

### Corpus boundary

Corpus acceptance derives its member set at run time from change folders dated 2026-10 or later, minus an explicit exclusion manifest of repo-relative POSIX paths. The manifest names one known-unparseable historical artifact; a guard asserts it names exactly one path, that the path exists, and that the file is genuinely unparseable, so exclusions cannot grow silently. Legacy-era documents stay outside the corpus but remain bound by the schema at write time.

## Technical Architecture & Codebase Map

- `packages/core/src/contracts/pm-notes.ts` — document/entry/collection types, default and per-variant required phase sets, required keys, collection keys, and the five lint identities. Types and `as const` data only.
- `packages/core/src/contracts/registry.ts` — registry schema version, transition kind and payload types, and the derived projection name/shape. Types and data only.
- `packages/core/src/domain/pm-notes-lint.ts` — pure rules in fixed order: parse, keys, value types, variant, required phases. No I/O and no parser invocation.
- `packages/core/src/state/registry.ts` — fenced append, verified read, presence-tolerant read, pure fold, atomic projection replace, and projection rebuild over the state port. No runtime API.
- `packages/core/src/domain/verify-change.ts` — pure verify classification that reuses the lint rules and fold semantics without performing I/O.
- `packages/adapters/src/file/pm-notes-parser.ts` — target location under the change-artifact convention, YAML 1.2 core parse with bounded size/nodes/depth/aliases, and the document-edit staging used by the write path.
- `packages/cli/src/commands/lint.ts` — target selector, rule invocation, and envelope-shaped data/error results.
- `packages/cli/src/commands/phase.ts` — grammar-first command family, staged lint, ledger-fold idempotency, advisories, and document write.
- `packages/cli/src/edge.ts` — composition root: pm-notes parser, registry reader/writer, clock, and fence-token factories composed beside `config`.

### Invariants

- Tier: contracts are data-only; domain imports contracts only; the registry imports contracts and its own state modules; runtime APIs stay out of the contracts, domain, and registry modules. The new runtime access lives in the adapter file edge; the existing CLI and state-driver edges are unchanged.
- Exit projection: `success` → 0, user validation → 1, platform provider → 2. Handlers never choose exits or write streams; the CLI edge owns rendering and projection.
- Brands arrive through the injected identity; no product or binary name literal exists in the delivered modules.
- Lint is deterministic and read-only; the phase write path refuses to decide idempotency from unverified bytes.

## Related

- [State layer](feature-state-layer.md) — the ledger substrate, verified reads, fences, and derived-document replace the registry composes.
- [Result contract and error table](feature-result-contract.md) — the envelope, the five `lint` rows and the `verify` row, the classification chain, and the binding sync check.
- [Verify change and exit taxonomy](feature-verify-change-and-exit-taxonomy.md) — the read-only verification consumer, variant-aware finalization, and the delivery-result exit taxonomy.
- [Monorepo scaffold and toolchain](feature-monorepo-scaffold-toolchain.md) and [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md) — tier rules and runtime-API confinement.
- [Branding seam](feature-branding-seam.md) — the injected identity behind the CLI surface.
- [Change lifecycle guide](../../guides/change-lifecycle.md) — the canonical eleven phases behind the `full` variant.
- [Glossary](../../overview/glossary.md) — pm-notes, variant, ledger, and registry terms.
