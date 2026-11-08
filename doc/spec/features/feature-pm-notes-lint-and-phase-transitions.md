---
id: SPEC-PM-NOTES-LINT-AND-PHASE-TRANSITIONS
status: Current
created: 2026-10-31
last_updated: 2026-11-08
owners: ["engineering"]
service: delivery-os
summary: "The implemented M0-S10 surface: pm-notes schema and variant conformance through a read-only lint command with named targets, the phase command family as the only schema-validated write path for phase state with a nine-row idempotency matrix, default-on atomic record-plus-commit on completion with per-call and per-project opt-outs, total four-state re-run convergence over durable commit intent, delivery-registry transition records and a derived phase-state projection over the state layer, the non-gating capsule `phase.transition` append with a bounded disclosure, the pinned evidence vocabulary, the five pm-notes lint error rows, and the variant-era corpus boundary with an explicit exclusion manifest."
links:
  related_changes: ["GH-177", "GH-178", "GH-179", "GH-222", "GH-226", "GH-227", "GH-240", "GH-242"]
  related_decisions: ["ADR-0003", "TDR-0005"]
---

# Feature: pm-notes lint and phase transitions

## Overview

This feature makes document conformance a write-time property and gives phase state exactly one write path. The `lint` command is read-only: it validates a named change's pm-notes document, the delivery registry, both, or the machine-readable delivery plan (`lint plan`, described in [Machine-Readable Delivery Plan Schema](feature-plan-schema.md)), and reports the first classified finding. The `phase` command family (`list`, `complete`, `reopen`) is the only schema-validated, idempotent path for changing phase state: it validates grammar before touching any target, lints the post-transition document, appends one delivery-registry transition on a landing, preserves opaque extras in the document, and replaces a derived phase-state projection. `phase list` derives state by folding the verified registry ledger; the stored projection is a replaceable convenience document, not a read dependency.

A completion also lands a conventional commit by default. `phase complete <ref> <phase>` performs the ledger transition and the commit as one act — both land or neither — with `--no-commit` as the per-call opt-out and the typed `commit.phaseCommit` project key as the per-project opt-out; a re-run converges over the durable (record, commit) delta. The commit machinery is specified in [Commit Primitive](feature-commit-primitive.md); this document specifies the transition side it extends.

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
| `lint <ref> --registry` | delivery registry | Absent store → explicit verified-empty pass; torn, schema-mismatch, unknown kind/schema, or key-set failure → classified `state.*`. |
| `lint <ref> --pm-notes --registry` | both | pm-notes first, then registry; the first failure is the verdict. |
| `lint plan <ref>` | machine-readable delivery plan | Cannot be combined with `--pm-notes` or `--registry`; reports per-document `valid`/`invalid`/`unreadable` verdicts with locations. |

The plan target reuses the shared `plan.*` identities for non-conformant documents and `lint.document.unreadable` for a document that cannot be decoded; the pm-notes and registry identities below are unchanged. The full plan contract is in [Machine-Readable Delivery Plan Schema](feature-plan-schema.md).

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

### Atomic completion (default on)

A completion adds the commit dimension to the matrix; the rows above keep their grammar, advisory, and reopen semantics. By default the completion lands the transition record and the conventional commit as one act: both land or neither. The completion's staging set is the mapped plan-phase scope union the change folder for the change ref, so a phase's artifacts and its transition land in the same commit; the pm-notes transition is written before the commit act and the pre-write bytes are restored if the act fails, so a failed attempt never leaves the document ahead of the ledger. A completion with no stageable pending work lands the transition alone and discloses the basis; matrix row 2 (already completed) appends no record and creates no commit. `--no-commit` records the transition alone per call, and the project key `commit.phaseCommit: false` disables the atomic commit for the project; the flag never overrides an explicit project disable.

The completion envelope extends the existing fields (`changeRef`, `phase`, `operation`, `outcome`, `timestamp`, `variant`, optional `advisory`, optional `reason`, and `evidence`) with `atomic`, an optional `commitSha`, optional `commitSkipped`, optional `reconciliation`, and, on a landed commit, a `commit` block carrying the message subject, staged files, exclusions, message source, transport, safety evidence, and telemetry evidence. `commitSkipped` uses one vocabulary for durable and envelope-only disclosures: `opt-out-flag`, `config-disabled`, and `skipped-no-pending-work` are exactly the durable record-only bases, while `no-op` (an already-converged completion) and `interrupted-atomic-no-pending-work` (an interrupted atomic completion re-run with no pending work left) are envelope-only and never written to a record. `reconciliation.completed` names what a re-run did: `commit`, `transition`, `intentional-no-op`, or `existing-completion`, with the stored basis for an intentional record-only convergence.

A re-run discriminates interrupted atomic intent from intentional record-only intent by durable evidence alone (see [Commit Primitive](feature-commit-primitive.md)): the persisted transition record with its stored `commitIntent`, `commitIntentBasis`, and — for atomic completions — the landed `commitSha`, corroborated by the persisted commit telemetry event. The stale derived projection is never consulted for idempotency.

The phase command runs inside a delivery session: `complete` with or without `--no-commit` proceeds under the normal transition rules, and `list` and `reopen` are unaffected.

### Delivery registry and derived projection

Every landing appends exactly one ledger record of kind `phase.transition` under the per-change record key `phase.transitions:<REF>`. The record's payload carries the landing's change ref, phase id, operation (`complete` or `reopen`), timestamp, outcome, and reopen-only reason, together with the full verified history for that change; a verified read returns the last record for the key, so the whole history arrives without an unverified scan. A completion additionally carries the landing's durable commit intent — `commitIntent` (`atomic` or `record-only`) and, for record-only landings, `commitIntentBasis` (`opt-out-flag`, `config-disabled`, or `skipped-no-pending-work`) — as fields of the same append, never a second write; an atomic completion also carries the landed `commitSha` in that same append, so convergence evidence survives a missing telemetry event. No-op transitions append nothing, and the ledger is append-only.

The registry declares one validated artifact boundary under its record-key prefix: `phase.transition` with its payload schema, the change-ref identity, the required fields, and the closed operation/outcome/intent/basis vocabularies. Reads validate every owned record before returning history, and landings validate before the append, so a nonconforming transition never reaches the ledger. A top-level payload missing a declared field classifies `state.store.unknown`; a malformed nested transition entry remains `state.keys.missing`; an undeclared record kind under the prefix is `state.store.unknown`; a `commitIntentBasis` without `commitIntent: record-only` is nonconforming, as is a `commitSha` without `commitIntent: atomic`. Every refusal is `not_landed` and leaves the ledger byte-identical.

The per-change phase state is a derived document named `phase-state.<REF>.json` with shape `{ schemaVersion, changeRef, phases }`, where each phase entry is `{ started, completed }`. It is a pure fold of verified transition records: a completion sets the first-completion start and the latest completion, a reopen clears `completed` while keeping the recorded start, and no timestamp or non-fold field is stored, so a rebuild is byte-stable. The ledger is truth; the projection is disposable and atomically replaced.

### Capsule phase append

When a capsule producer port is injected, a landed phase completion or reopen also appends one `phase.transition` capsule event beside the delivery-registry state record. The event carries the phase id, the operation (`complete` or `reopen`), `outcome: "landed"`, the commit intent (`atomic` or `record-only`), and the commit SHA when present. The event key is derived from the phase id, operation, and commit SHA; when no SHA exists the transition timestamp supplies the third identity part, so a re-run of the same logical landing is a no-op append. The append is non-gating: a failed or thrown append becomes a bounded `capsule` disclosure in the command data, and the phase outcome and its state record are unchanged. No-op transitions append nothing, and no command writes another change's capsule. The capsule contract is in [Change Capsule](feature-capsule.md).

### Evidence vocabulary

Landings carry `{ outcome: "landed" }` plus the reason on a reopen; a record-only completion carries the basis (`{ outcome: "landed", basis }`), and a convergent landing carries the reconciliation marker (`{ outcome: "landed", reconciliation }`). No-op completions carry `{ outcome: "no-op", basis: "already-completed", phase, completedAt }` plus `commitSkipped: "no-op"`; a record-only re-run carries `{ outcome: "no-op", basis, reconciliation: "intentional-no-op" }`; an interrupted atomic re-run with no pending work left carries `commitSkipped: "interrupted-atomic-no-pending-work"` with `{ outcome: "no-op", basis: "interrupted-atomic-no-pending-work" }` evidence; no-op reopens carry `{ outcome: "no-op", basis: "not-completed", phase, reason }`. Advisories use `{ class: "earlier-open", phases }` or `{ class: "outside-required-set", phase, variant }`. A verified-empty registry read carries `{ class: "verified-empty", target: "registry" }`.

### Error identities

Five rows sit under the `lint` domain kind in both the machine error table and the documented table: `lint.notes.malformed`, `lint.keys.missing`, `lint.variant.unknown`, `lint.phases.incomplete`, and `lint.target.missing`. All are user-category, non-retryable, `not_landed`, and project to exit 1. Storage failures reuse the existing `state.*` identities; platform state failures project to exit 2, user-category state failures to exit 1.

A completion additionally surfaces the five `commit.*` identities of the atomic act — staging blocked, commitlint failure, secret suspicion, scan unavailable, and atomic abort — on the same command, within the same `{0, 1, 2}` projection. The completion carries no session refusal. Their categories, retryability, and exit projections are the ones documented in [Result Contract and Error Table](feature-result-contract.md).

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
- `packages/cli/src/commands/phase.ts` — grammar-first command family, staged lint, durable-evidence convergence, the pre-write document snapshot, the transition write before the commit act, restore on failure, the shared commit act on completion, advisories, and projection replace.
- `packages/cli/src/edge.ts` — composition root: pm-notes parser, registry reader/writer, clock, fence-token factories, and the optional atomic-completion extension composed beside `config`.

### Invariants

- Tier: contracts are data-only; domain imports contracts only; the registry imports contracts and its own state modules; runtime APIs stay out of the contracts, domain, and registry modules. The new runtime access lives in the adapter file edge; the existing CLI and state-driver edges are unchanged.
- Exit projection: `success` → 0, user validation → 1, platform provider → 2. Handlers never choose exits or write streams; the CLI edge owns rendering and projection.
- Brands arrive through the injected identity; no product or binary name literal exists in the delivered modules.
- Lint is deterministic and read-only; the phase write path refuses to decide idempotency from unverified bytes.
- The completion's durable commit intent lands in the same ledger append as the transition record; convergence decides from durable record and commit evidence, never from the derived projection and never from the invocation's mode.

## Related

- [Commit primitive](feature-commit-primitive.md) — the atomic record-plus-commit act, staging and safety, message generation, telemetry, and convergence classification the completion composes.
- [State layer](feature-state-layer.md) — the ledger substrate, verified reads, fences, and derived-document replace the registry composes.
- [Change capsule](feature-capsule.md) — the non-gating `phase.transition` append point and its bounded disclosure.
- [Result contract and error table](feature-result-contract.md) — the envelope, the five `lint` rows, the five `commit` rows, the `verify` row, the classification chain, and the binding sync check.
- [Verify change and exit taxonomy](feature-verify-change-and-exit-taxonomy.md) — the read-only verification consumer, variant-aware finalization, and the delivery-result exit taxonomy.
- [Monorepo scaffold and toolchain](feature-monorepo-scaffold-toolchain.md) and [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md) — tier rules and runtime-API confinement.
- [Branding seam](feature-branding-seam.md) — the injected identity behind the CLI surface.
- [Change lifecycle guide](../../guides/change-lifecycle.md) — the canonical eleven phases behind the `full` variant.
- [Glossary](../../overview/glossary.md) — pm-notes, variant, ledger, and registry terms.

## Read-only consumers

`verify change` and the lifecycle gate of [Verify Gates](feature-verify-gates.md) consume the same declaration, registry, and fold read-only; neither writes or rebuilds the projection. The shared read yields the structured `VerifyLedgerEvaluation`, which `verify change` wraps for its delivery-result tuple and the lifecycle gate consumes directly.
