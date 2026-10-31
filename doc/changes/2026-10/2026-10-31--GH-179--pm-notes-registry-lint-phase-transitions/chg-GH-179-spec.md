---
id: GH-179
status: Proposed
created: 2026-10-31
last_updated: 2026-10-31
owners: [engineering]
service: delivery-os CLI and state tier
summary: >-
  Schema and format conformance for pm-notes and the delivery registry via
  `ados lint`; `ados phase` as the only schema-validated, idempotent write
  path for phase state; variant-declared required phase sets; classified
  failure identities shipped in-change.
links:
  related_changes: [GH-179]
  related_decisions: [ADR-0003]
---

# Feature: PM-Notes and Registry Lint, and Phase Transitions

## Overview

Phase state (pm-notes) and the delivery registry are the ledger every later
verification reads, yet today agents write them with no schema conformance
enforcement and no single write path: documents can be malformed,
inconsistent across delivery modes, or silently torn, and nothing classifies
the failure. GH-179 makes conformance a write-time property: a new `ados
lint` command validates named targets — a change ref's pm-notes and/or the
delivery registry — for parseability, required-key presence, types, and
variant/required-phase conformance, and the same checking runs inside the
write path before any mutation lands.

Phase state gains exactly one write path: the `ados phase` command family
(`phase list <ref>`, `phase complete <ref> <phase>`, `phase reopen <ref>
<phase> <reason>`, reason required). Transitions are schema-validated and
idempotent: repeating an already-applied transition is a no-op success with
evidence, never an error and never a duplicate mutation. The pm-notes schema
declares the change variant — full eleven-phase or a LITE compressed set
pinned by this spec — and lint validates the declared variant's required
phases while treating extra phase keys as opaque, never-inspected values,
so the real corpus is accepted even as malformed documents are rejected.

The delivery registry becomes the first consumer of the GH-174 state layer:
registry records are schema-versioned ledger records written through the
state port, so the ledger read by verify change (GH-177) inherits
atomicity, single-writer discipline, torn-state detection, and classified
failures. New failure identities join the result contract's error table as
additive rows shipped in-change (GH-174 precedent), keeping the
two-directional documented-table sync binding.

## Business Context

### Problem statement

Agents author pm-notes and registry state as free-form file edits with no
enforcement: a malformed document, a missing phase key, or a torn write is
discovered — if at all — when a downstream verification reads garbage, and
then it surfaces as an unclassified crash instead of a classified error.
Phase transitions have no single idempotent write path, so repeated or
concurrent bookkeeping can double-record or lose transitions. The ledger
that verify change will read (GH-177) can therefore be malformed,
inconsistent across variants, or silently torn.

### Affected users

Lifecycle agents (`@pm`, `@spec-writer`, `@coder`, `@doc-syncer`,
`@pr-manager`) that record and read phase transitions; the coordinator and
verify-change consumers that read the ledger as evidence; the repository
owner reviewing LITE-mode adoption at PR review.

### Business impact

- Verification integrity: the ledger read by verify change is safe — every
  record schema-checked, every failure classified, never a crash, never
  silent zeros.
- Delivery friction drops: agents get immediate write-time feedback
  ("rejected at write") instead of late, expensive downstream discoveries.
- Compressed deliveries become first-class: LITE is a declared,
  lint-enforced variant instead of an undocumented habit.

### Goals (ticket intent)

1. Schema and format conformance checks at write time for pm-notes and the
   delivery registry — surfaced as `ados lint`.
2. Error on parse failure (classified, never a crash); key-set assertions.
3. The pm-notes schema declares the change variant (full eleven-phase or
   LITE compressed set); lint validates the declared variant's required
   phases.
4. `ados phase` as the ONLY write path for phase state — schema-validated
   and idempotent transitions.
5. The ledger read by verify change is safe.

## Non-Goals

- **NG-1**: M0-S8 verify change itself (GH-177) — this change only makes its
  input ledger safe; lint (document conformance) is distinct from verify
  (evidence against reality) per the command-registry terminology.
- **NG-2**: Agent-side adoption changes to `.opencode/` prompts — migrating
  lifecycle agents onto `ados phase` is an operating-model note, not code in
  this change.
- **NG-3**: Registry expansion to retro/ceremony artifacts (M1-S2) or memory
  lint (M2-S8) — the record-kind set here is minimal and additive.
- **NG-4**: A closed key set for pm-notes — free-form extra keys on phase
  entries (commits, verdict, url, evidence, extra phase keys) are legitimate
  and opaque to lint: free-form values of any type, never schema-validated.
- **NG-5**: Decision-record/frontmatter/deploy-checklist lint (M3-S4) and any
  lint policy beyond schema/format conformance.

## Acceptance Criteria

- **AC-L1 — Malformed notes are rejected at write.**
  Given an injected malformed pm-notes fixture (unparseable document,
  missing required key, or wrong-typed schema-declared value), when any
  mutating `ados phase` invocation targets that change, then it fails with
  the pinned lint error identity and non-zero exit (machine-readable under
  `--json`), and no mutation lands.
  *DoD predicate*: every malformed-notes fixture class → classified error +
  exit 1 + zero new ledger records.

- **AC-L2 — Transitions are idempotent.**
  Given a phase already completed, when `phase complete <ref> <phase>` runs
  again, then it succeeds (exit 0), appends no ledger record, and its
  evidence marks a no-op citing the existing completion; every redundant
  cell of the idempotency matrix (C-4) holds.
  *DoD predicate*: matrix suite asserts exit 0, zero additional ledger
  records, and no-op evidence for every redundant cell.

- **AC-L3 — A reopen without a reason is rejected.**
  Given `phase reopen <ref> <phase>` with a missing or empty reason, when it
  runs, then it is rejected with the classified `input.value.rejected`
  identity (the existing input-domain row) before any state inspection or
  mutation, with a non-zero exit.
  *DoD predicate*: reason-less reopen → classified rejection + exit ≠ 0 +
  ledger unchanged; the same invocation with a non-empty reason succeeds.

- **AC-L4 — A LITE declaration missing one of its required phases fails
  lint.**
  Given pm-notes declaring `variant: lite` whose `phases` map lacks any one
  pinned LITE phase, when lint runs (standalone or write-path), then it
  fails with the variant-conformance identity naming the missing phase.
  *DoD predicate*: for each pinned LITE phase, a fixture omitting exactly
  that phase → lint failure naming it; with the phase present it passes.

- **AC-L5 — The ledger read by verify change is safe.**
  Given the delivery registry implemented over the GH-174 state layer, when
  the phase ledger is read for a change, then only verified, schema-checked
  records are returned; torn stores, missing key sets, or schema mismatches
  fail with the classified state-layer identities, never empty defaults or
  crashes.
  *DoD predicate*: injected torn/mismatch fixtures on the registry read
  path → classified `state.*` identities, zero value-returns from
  unverified bytes.

- **AC-L6 — The schema accepts the real corpus.**
  Given every pm-notes document committed under the change-artifact
  convention from the variant era onward — change folders dated 2026-10 or
  later — minus the explicit exclusion manifest (the corpus boundary), when
  lint runs over each with the effective-variant default, then each passes
  (parseable, required keys present and typed, required phases of the
  effective variant present, free-form extras opaque — never
  schema-validated).
  *DoD predicate*: the variant-era corpus scan — zero failures over the
  boundary files minus the exclusion manifest; "reject malformed" and
  "accept real files" both demonstrated.

  Corpus boundary evidence (test-planning scan of 2026-10-31): every
  variant-era document passes (GH-170, GH-172, GH-173, GH-174, GH-181); 21
  of 35 total committed documents fail legacy-era rules (14 predate the
  dor_check phase; 20 predate delivery_mode) and are outside the corpus.
  The exclusion manifest explicitly names exactly one file —
  `doc/changes/2026-10/2026-10-29--GH-171--branding-seam-working-name/chg-GH-171-pm-notes.yaml`,
  a known-unparseable historical artifact (orphaned indentation; rejected
  by YAML 1.2 parsers) — excluded from the corpus fixture; its repair is
  owner follow-up work outside this change. Legacy-era documents (folders
  before 2026-10) are outside the corpus — authored before the schema
  existed — but the schema still applies to them whenever a write path
  targets them.

## Capabilities & Functionality

### C-1 — pm-notes schema (D2: the schema must accept the real corpus)

The canonical document shape is pinned from the de-facto corpus (the
GH-174 pm-notes): top-level `change_id` (string), `title` (string),
`milestone` (string), `story_code` (string), `delivery_mode` (string),
`variant` (optional enum, see C-2), `phases` (map of phase id → entry),
and the collections `decisions[]`, `open_questions[]`, `blockers[]`,
`notes[]`. The phase-entry rule — `started` and `completed` required, each
a timestamp string or `null` — applies ONLY to the canonical 11 phase ids
and, for a declared `lite` variant, to the variant's required set (a
subset of the canonical 11, see C-2). Keys outside that applicable set —
non-canonical phase ids in the `phases` map and any extra keys on a phase
entry — are opaque: free-form values of any type, never schema-validated,
never lint-inspected; this is what keeps the variant-era corpus (entries
carrying extra keys with sequence or plain-string values) passing under
AC-L6. Collection entries are objects with
`text` (string, required) and `type`/`date` (string, typed when present).
Lint asserts parseability, required-key presence, and value types of
schema-declared keys only — never a closed key set. Required top-level
keys: `change_id`, `title`, `delivery_mode`, `phases`; all other top-level
keys are optional and typed-when-present. The parser dialect is pinned:
YAML 1.2 core schema (the repository's yaml 2.x default) — unquoted date
scalars are strings, and `date` fields accept those strings as-is.

### C-2 — Variant declaration and the pinned LITE phase set (D1)

The variant is declared by the optional top-level `variant:` key with
values `full | lite`; when absent, the effective variant defaults to
`full` (backward-compatible with the pre-variant corpus, which uniformly
used the full lifecycle). LITE must be declared explicitly — omission
never yields LITE. Lint validates the effective variant's required phase
keys are present in the `phases` map (value may still have null
timestamps); phase-map keys beyond the effective required set —
non-canonical phase ids included — are always allowed and opaque:
free-form values of any type, never schema-validated (C-1).

**Pinned LITE required phase set** (reversible schema constant; owner may
amend at PR review):

> `clarify_scope`, `specification`, `delivery`, `quality_gates`,
> `dod_check`, `pr_creation`

Rationale: the set retains every phase guarding a small change's
correctness — scope entry, a written spec, delivered code, green gates, the
DoD close, the PR handoff — and drops the five phases whose cost dominates
small changes: the three heavyweight pre-delivery artifact gates
(`test_planning`, `delivery_planning`, `dor_check`), each mandating a
dedicated artifact plus an adversarial gate, and the two post-delivery
reconciliation phases (`system_spec_update`, `review_fix`). The full
variant remains the canonical 11 phases of the change-lifecycle guide.

### C-3 — Lint checks (`ados lint`)

`ados lint` validates named targets: a change ref's pm-notes, the delivery
registry, or both. Check families, each rejection class mapping to exactly
one pinned code (C-6): (1) syntax, structure, and value-type conformance
per C-1 — an unparseable document and wrong-typed values are
`lint.notes.malformed` classified failures, never a crash; (2)
required-key presence per C-1 — `lint.keys.missing`; (3)
variant/required-phase conformance per C-2 — `lint.variant.unknown` and
`lint.phases.incomplete`; (4) pm-notes target resolution —
`lint.target.missing`. Target semantics: a missing pm-notes target for a
named change ref fails with `lint.target.missing`; an absent
delivery-registry target is NOT a failure — lint over it yields an
explicit verified-empty PASS (the state layer's verified-empty semantics);
`lint.target.missing` is pm-notes-specific. The same checking is invoked
by the write path (`ados phase`) before any mutation lands; a lint failure
blocks the mutation. Lint is read-only — it never mutates its targets.
`--json` machine output rides the CommandResult envelope, always.

### C-4 — `ados phase` semantics and the idempotency matrix

`phase list <ref>` (read), `phase complete <ref> <phase>` (mutate),
`phase reopen <ref> <phase> <reason>` (mutate, reason required) are the
ONLY write path for phase state. Phase arguments validate against the
canonical 11-phase vocabulary; an unknown phase id is a classified
`input.value.rejected` rejection (extra phase keys in existing documents
remain opaque to lint but are not phase-command addressable — see OQ-1).
Completing a canonical phase absent from the document creates a valid
entry (`started`, `completed`) and lands the transition; reopening an
absent (never completed) phase is a no-op that creates no entry (rows 1,
5, 9). The reason is validated as part of the command grammar, before
state inspection. Idempotency matrix (phase P, change ref R):

| # | Prior state of P | Command | Outcome |
|---|------------------|---------|---------|
| 1 | open (never completed) | `complete R P` | Transition lands; ledger record appended; success. |
| 2 | completed | `complete R P` | No-op success (exit 0): no ledger record, evidence marks no-op citing the existing completion. |
| 3 | reopened after completion | `complete R P` | Re-completion lands as a new transition record; success. |
| 4 | completed | `reopen R P <reason>` | Transition lands; reopened with the recorded reason; success. |
| 5 | open (not completed), including absent from the document | `reopen R P <reason>` | No-op success: no ledger record, no entry created; evidence reports P was not completed; supplied reason echoed in evidence only. |
| 6 | any | `complete R P` while earlier phases of the effective variant are incomplete | Allowed; success with advisory evidence naming the earlier phases still open (out-of-order completion is legitimate after reopens and for non-linear flows). |
| 7 | any | `reopen R P` with missing/empty reason | Rejected with the classified `input.value.rejected` identity before state inspection (AC-L3). |
| 8 | any | phase id outside the canonical vocabulary | Rejected with the classified `input.value.rejected` identity; no state inspection, no mutation. |
| 9 | absent from the document (canonical P) | `complete R P` | A valid entry (`started`, `completed`) is created and the transition lands; success — advisory evidence when P is outside the declared variant's required set. |

### C-5 — Delivery registry records (D3: the state-layer store)

The delivery registry is the first consumer of the GH-174 state layer:
store identity, paths, and schema version arrive through the state port;
the registry contributes the record domain. Pinned minimal record kinds:

- `phase.transition` — appended for every landing (mutating) transition of
  C-4: change ref, phase id, operation (`complete | reopen`), reason
  (reopen only), timestamp, outcome. No-op transitions append nothing.
- The current per-change phase state is a derived projection over the
  ledger, atomically replaced and rebuildable from verified ledger truth
  (GH-174 derived-document semantics); it is not an independent record
  kind.

The ledger read by verify change is exactly this store's read path, so
AC-L5 inherits torn-state detection, key-set assertions, single-writer
fences, and atomic replace from the state layer; storage-tier failures
surface with the existing `state.*` identities.

### C-6 — Error identities (new error-table rows, shipped in-change)

New rows join the error table additively under a new `lint` domain kind
(added to the declared domain kinds; exact-code classification per the
multi-row-kind rule; wrong/missing codes contain via `fallback.internal`).
Following the GH-174 precedent, documented rows ship in this change so the
binding two-directional documented-table sync check is green from the
first delivery phase. Existing rows are untouched.

| Code | Kind | Category | Retryable | Consequence | Remediation hint | Projection class |
|------|------|----------|-----------|-------------|------------------|------------------|
| `lint.notes.malformed` | `lint` | user | false | not_landed | Correct the document so it conforms to the pm-notes schema (syntax, structure, and value types) and retry. | user-validation |
| `lint.keys.missing` | `lint` | user | false | not_landed | Add the named required key(s) with a conforming value and retry. | user-validation |
| `lint.variant.unknown` | `lint` | user | false | not_landed | Set `variant` to `full` or `lite` and retry. | user-validation |
| `lint.phases.incomplete` | `lint` | user | false | not_landed | Add the named missing required phase(s) of the declared variant or correct the declared variant. | user-validation |
| `lint.target.missing` | `lint` | user | false | not_landed | pm-notes target only: initialize pm-notes for the named change ref or correct the reference (an absent registry target is a verified-empty pass, C-3). | user-validation |

Every rejection class maps to exactly one pinned code: unparseable
document → `lint.notes.malformed`; wrong-typed top-level value →
`lint.notes.malformed`; non-timestamp typed value →
`lint.notes.malformed` (the code covers syntax, structure, and value-type
conformance); missing required key, top-level or on a canonical phase
entry → `lint.keys.missing`; unknown `variant` value →
`lint.variant.unknown`; missing required phase of the declared variant →
`lint.phases.incomplete`; missing pm-notes target → `lint.target.missing`.
No rejection class maps to more than one code; the row count stays at five
(NFR-5 unchanged at 5/5).

Failure identities deliberately NOT new rows: reason-less reopen and
unknown phase id ride the existing `input` domain row
`input.value.rejected` (AC-L3; C-4 rows 7–8); registry storage failures
ride the existing `state.*` rows (GH-174). Unclassified lint failures
contain through `fallback.internal`.

## Non-Functional Requirements

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Runtime neutrality and tier conformance: tier-rule violations (contracts carrying behavior; state tier importing anything but `./contracts`; runtime APIs anywhere but the existing state driver edge; CLI delegating rendering/exit decisions into core); runtime-conditional branches in the contracts or domain tiers; packed `core` surface consumption failures on either supported runtime (Node, Bun) | 0 / 0 / 0 / 0 / 0 — both runtimes consume the surface; all boundary and ambient gates green |
| NFR-2 | Machine-output validity: `ados lint` and `ados phase` invocations (success and failure) returning through the CommandResult envelope; `--json` outputs produced by the single serializer; exit codes outside the `{0, 1, 2}` projection; user-category failures projecting to any exit but 1 | 100% / 100% / 0 / 0 — envelope shape asserted for every fixture run |
| NFR-3 | Determinism and read-only lint: lint verdict drift (identity, category, or evidence class) across repeated runs over identical target bytes; ambient reads (environment, clock, randomness) outside declared edges; bytes written by a standalone lint run | 0 drift across fixture replays / 0 ambient reads / 0 bytes written — identical inputs yield identical verdicts and evidence classes |
| NFR-4 | Corpus compatibility: failures over the committed variant-era pm-notes corpus — change folders dated 2026-10 or later, minus the explicit exclusion manifest (the AC-L6 corpus boundary) — with the effective-variant default; legitimate-shape regressions introduced by later schema edits; corpus coverage gaps (the corpus fixture not re-asserted when the schema module changes) | 0 corpus failures over the boundary minus manifest (AC-L6, pinned as a permanent CI fixture) / 0 regressions / 100% re-assertion on schema-module change |
| NFR-5 | Error-table binding: the five lint codes round-tripping exactly with documented rows (kind, category, retryability, consequence, projection class, remediation hint); two-directional documented-table drift; wrong/missing/mismatched `lint` codes escaping `fallback.internal` containment; kind-only `lint` classification selecting a row | 5/5 round-trip / 0 drift both directions / 0 escapes / 0 ambiguous selections |

## Technical Architecture & Codebase Map

High-level design, respecting the scaffold tier rules (contracts = types and as-const data only; the state tier imports `./contracts` only; runtime APIs live only in the existing state driver edge; the CLI owns rendering and the exit projection):

1. **Data-only contracts**: the pm-notes schema vocabulary (document, phase-entry, and collection shapes; the `full | lite` variant enum; the per-variant required-phase sets and required key sets as as-const data) and the registry record vocabulary (`phase.transition` payload types; the registry schema-version constant) land in `core` `./contracts`. The `lint` domain kind and the five C-6 rows join the existing error-table data. No behavior, no I/O.
2. **Pure lint rules**: the schema/variant conformance rules of C-1–C-3 live in the core domain tier as pure rules over parsed document values — no file access, no parser invocation, no runtime APIs. A lint verdict carries the classified `lint.*` identity, the named location, and evidence; unparseable input arrives as a parse-failure input, not a thrown crash.
3. **Registry over the state port**: the delivery registry (C-5) composes the GH-174 store port — records appended with the registry's key-set declarations, the derived per-change projection replaced atomically and rebuildable from ledger truth. No new runtime-API location is introduced; the existing state driver edge remains the only one in core.
4. **CLI owns the edges and the surface**: pm-notes and registry target files are read and parsed at the CLI surface edge, which hands parsed values (or parse failures) to the pure tiers; the `lint` and `phase` command definitions follow the config-command registration precedent; rendering and the `{0, 1, 2}` exit projection ride the existing classification chain; the binary name arrives via the injected brand (zero product literals).
5. **Write-time checking composition**: `phase` composes the same pure lint rules over the parsed target before any mutation — a lint failure blocks the mutation with consequence `not_landed` (C-3, AC-L1); the grammar validations of C-4 (reason required, canonical phase vocabulary) run before state inspection.

| Path | Status | Role in this change |
|------|--------|---------------------|
| `packages/core/src/contracts/error-table.ts` | Extends | `lint` joins `DOMAIN_KINDS`; the five C-6 rows added as data. |
| `packages/core/src/contracts/index.ts` | Extends | Re-exports the new pm-notes and registry vocabulary. |
| `packages/core/src/contracts/pm-notes.ts` | New | Schema vocabulary: types plus as-const variant enum, per-variant required-phase sets, and required key sets (C-1, C-2). |
| `packages/core/src/contracts/registry.ts` | New | Registry record vocabulary: `phase.transition` payload types and the registry schema-version constant (C-5). |
| `packages/core/src/domain/pm-notes-lint.ts` | New | Pure conformance rules over parsed document values; returns classified lint findings; no I/O. |
| `packages/core/src/state/registry.ts` | New | Registry record module composing the injected store port: append, read with key-set assertions, atomically replaced derived projection. |
| `packages/core/src/state/` (`index.ts`, `ledger.ts`, `edge.ts`, `driver/strategy.ts`, `driver/runtime-edge.ts`) | Consumed, unchanged | The GH-174 substrate; the driver edge stays the only core runtime-API location. |
| `packages/cli/src/commands/lint.ts` | New | `ados lint` command definition (named targets; read-only; `--json` via envelope). |
| `packages/cli/src/commands/phase.ts` | New | `ados phase` family definition: `list`/`complete`/`reopen`; grammar validation before state inspection. |
| `packages/cli/src/commands/index.ts` | Extends | Exposes both new command definitions for edge composition. |
| `packages/cli/src/commands/config.ts` | Precedent, unchanged | The command-registration pattern both new commands follow. |
| `packages/cli/src/edge.ts` | Extends | Composes the two new command definitions into the CLI edge. |
| `packages/cli/src/classify.ts`, `packages/cli/src/projection.ts` | Extends | The new `lint` identities ride the existing classification → `{0, 1, 2}` exit chain; grammar rejections reuse the existing `input.value.rejected` row. |
| `packages/cli/src/output/` (`index.ts`, `serialize.ts`) | Consumed, unchanged | `--json` serialization through the single serializer. |

## QA Strategy

| Approach | What it covers | Notable fixtures / controls |
|----------|----------------|------------------------------|
| Behaviour suites (in-process; no spawned processes) | Command semantics through the command definitions: every idempotency-matrix cell of C-4 (rows 1–9), each asserting exit code, ledger-record count delta, and evidence class; reason-less reopen and unknown phase id each rejecting with `input.value.rejected` (AC-L3, row 8); write-path lint blocking a mutation (AC-L1) | No-op cells (rows 2, 5) assert zero appended records, no entry creation, and no-op evidence; row 3 asserts a new transition record lands; row 9 asserts entry creation for an absent canonical phase, with advisory evidence when outside the declared variant's required set |
| Golden fixtures — corpus acceptance | The real corpus under the AC-L6 corpus boundary: every pm-notes document committed under the change-artifact convention from the variant era onward (change folders dated 2026-10 or later), minus the explicit exclusion manifest, lints clean with the effective-variant default; legacy-era folders (before 2026-10) sit outside the fixture | Corpus fixture defined by the same boundary + exclusion manifest, so it drifts correctly as new variant-era changes land; pinned as a permanent CI fixture; schema-module changes re-assert it (NFR-4) |
| Golden fixtures — rejection classes | Malformed-notes classes, each mapping to exactly one pinned identity with exit 1 and zero ledger records (AC-L1): unparseable document → `lint.notes.malformed`; missing required top-level key → `lint.keys.missing`; wrong-typed top-level value → `lint.notes.malformed`; canonical phase entry missing `started`/`completed` → `lint.keys.missing`; non-timestamp typed value → `lint.notes.malformed`; missing pm-notes target for a change ref → `lint.target.missing`; unknown `variant` value → `lint.variant.unknown`; LITE-missing-phase: for each pinned LITE phase, a fixture omitting exactly that phase, failing `lint.phases.incomplete` naming it, and passing once restored (AC-L4) | Negative controls are non-vacuous: detection asserted, never silent passes; opaque-extra positive controls: extra phase keys carrying arbitrary value types (sequences, plain strings) pass (AC-L6) |
| Structure & boundary suites | Tier rules per the architecture table (contracts data-only; domain pure; state imports `./contracts` only; runtime APIs only in the existing driver edge); zero product literals; envelope and `--json` validity for every invocation (NFR-1, NFR-2) | Existing boundary/ambient gates extended to the new paths |
| Contract sync checks | Error-table round-trip of the five lint codes; two-directional documented-table drift; multi-row-kind ambiguity for `lint`; `fallback.internal` containment (NFR-5) | GH-174 sync-check machinery reused unchanged |

## Risks & Mitigations

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Schema-vs-corpus drift: the pinned schema grows away from how agents actually write notes, and a legitimate real-world shape starts failing at write | M | M | The schema is pinned from the de-facto corpus (C-1, D2); the corpus lint pass (AC-L6, NFR-4) is a permanent CI fixture so drift fails loudly; the open-key-set rule (NG-4) keeps legitimate extras accepted; the variant constant stays reversible for owner amendment. | L–M |
| RSK-2 | Ledger authority: phase state has two representations — the pm-notes `phases` map agents declare and the registry ledger the write path records — and a downstream consumer reads the wrong one | H | M | The registry ledger is the authoritative transition record (C-5); the derived projection is rebuildable from verified ledger truth (GH-174 semantics); every mutation is anchored in the ledger first through the single write path; cross-checking declaration against ledger is verify change's evidence job (GH-177), deliberately not invented here. | M |
| RSK-3 | Adoption by agents: lifecycle agents keep hand-editing phase state instead of invoking `ados phase` (prompt adoption is out of scope, NG-2), bypassing the write path | M | M | Non-conformant hand-edits fail loudly at the next write or lint (classified, never a crash); the operating-model note documents the migration; the ledger makes divergence visible as evidence at verify. | M until agent prompts adopt the command (follow-up work) |
| RSK-4 | Error-table sync: the five lint rows or the `lint` domain kind drift from the documented table, or kind-only classification silently selects a first row | M | L | Documented rows ship in-change (C-6, GH-174 precedent); the two-directional documented-table sync stays binding in CI; multi-row-kind ambiguity asserted for `lint` exactly as for `config` and `state`. | L |
| RSK-5 | LITE governance: `variant: lite` is declared to dodge the heavyweight gates on a change that warrants the full lifecycle | M | M | LITE must be declared explicitly — omission never yields LITE (C-2); the pinned set is a reversible schema constant; LITE-mode adoption is reviewed by the owner at PR review. | L–M |

## Open Questions

- **OQ-1 (resolved by scope boundary; non-blocking):** Opaque extra phase
  keys observed in the real corpus (for example `ci_remediation`) are not
  addressable through the `ados phase` command vocabulary, which validates
  against the canonical 11 phases — such documents pass lint (AC-L6) while
  the command rejects those phase ids with the classified
  `input.value.rejected` identity (C-4 row 8). Resolution: this is the
  intended scope boundary, not a defect — the phases map is a
  schema-validated declaration surface for canonical phase ids with opaque
  free-form extras, and the command vocabulary is the canonical phase set.
  No decision needed; revisit only if a future story promotes a recurring
  extra phase into the canonical vocabulary (a schema-constant amendment,
  reviewed by the owner).

## Related

- Ticket: [GH-179 — M0-S10: pm-notes and registry lint, and phase transitions](https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/179) (verbatim intent and ACs).
- Backlog: `doc/planning/oss-tooling/backlog.md` (M0-S10); `doc/planning/oss-tooling/backlog-ranking.md` (position 6 — delivered before verify change).
- Command registry: `doc/planning/oss-tooling/cli-command-registry.md` — `ados lint` and `ados phase` rows; lint-vs-verify terminology.
- State layer (GH-174): `doc/spec/features/feature-state-layer.md`; change artifacts under `doc/changes/2026-10/2026-10-30--GH-174--state-layer/` (including the pm-notes corpus this schema is pinned from).
- Result contract: `doc/spec/features/feature-result-contract.md` (envelope, error table, classification chain, binding documented-table sync).
- Scaffold and toolchain: `doc/spec/features/feature-monorepo-scaffold-toolchain.md`; [ADR-0003 — OSS Tooling Monorepo Structure](../../decisions/ADR-0003-oss-monorepo-structure.md) (tier rules, runtime-API confinement).
- Change lifecycle: `doc/guides/change-lifecycle.md` (the canonical 11 phases behind the `full` variant).

## Revision Log

- **v1.2 (2026-10-31)** — Reopened a second time from test planning;
  corpus boundary resolved ("option A refined"): AC-L6 and NFR-4 define
  the corpus as every pm-notes document committed under the change-artifact
  convention from the variant era onward (change folders dated 2026-10 or
  later) minus an explicit exclusion manifest — measured scan of
  2026-10-31: all variant-era documents pass, 21 of 35 total committed
  documents fail legacy-era rules and sit outside the corpus. The manifest
  names exactly one known-unparseable historical artifact (the GH-171
  pm-notes; orphaned indentation; repair is owner follow-up outside this
  change). Legacy-era documents remain schema-bound whenever a write path
  targets them. The QA corpus fixture derives from the same boundary +
  manifest so it drifts correctly as new variant-era changes land.
- **v1.1 (2026-10-31)** — Reopened after test-planning findings; amendments
  R1–R3e applied: `lint.notes.malformed` broadened to syntax, structure,
  and value-type conformance with every rejection class pinned to exactly
  one code (R1); extra phase keys opaque and never inspected, scoped to
  canonical/required phase entries (R2); `input.value.rejected` pinned for
  reason-less reopen and unknown phase id (R3a); absent registry target
  lints as an explicit verified-empty PASS, `lint.target.missing`
  pm-notes-specific (R3b); `phase complete` on an absent canonical phase
  creates a valid entry, reopen-on-absent stays a no-op (R3c); matrix row 1
  prior state narrowed to never-completed (R3d); YAML 1.2 core parser
  dialect pinned, date scalars are strings (R3e).
