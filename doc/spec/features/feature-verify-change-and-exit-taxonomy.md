---
ados_distribution: internal
id: SPEC-VERIFY-CHANGE-AND-EXIT-TAXONOMY
status: Current
created: 2026-10-31
last_updated: 2026-10-31
owners: ["engineering"]
service: delivery-os
summary: "The read-only `verify change <ref>` surface: ledger-only verification against a change's declared full or LITE phase set, a declaration-plus-registry overlay with per-phase precedence, the eleven-token delivery result vocabulary and its total projection/derivation taxonomy, one total exit taxonomy with the documented state-unverified divergence, the additive verify.ledger.incomplete identity beside reused lint.* and state.* identities, a deterministic classification summary, and the non-zero guarantee for incomplete or unverifiable deliveries."
links:
  related_changes: ["GH-172", "GH-174", "GH-177", "GH-179"]
  related_decisions: ["ADR-0003", "TDR-0005"]
  contracts:
    - "packages/core/src/contracts/delivery-result.ts"
    - "packages/core/src/contracts/error-table.ts"
---

# Feature: Verify Change and Exit Taxonomy

## Overview

`verify change <ref>` answers one question without mutating anything: is the declared phase ledger for this change complete, and if not, which result does the delivery classify into? It reads the change's committed pm-notes declaration (which supplies the effective variant and declared phase state), reads the delivery registry's verified `phase.transition` history when one exists, merges the two evidence sources per phase, and classifies the outcome through the eleven-token delivery-result vocabulary.

The command is ledger-only and read-only. It performs no mutation, acquires no fence, calls no tracker, PR, CI, or network provider, and spawns no process. An incomplete or unverifiable ledger is a failure: only a fully completed declared variant produces a success envelope and exit `0`; every other outcome is a single error-only envelope with a non-zero exit.

The delivery-result vocabulary is `as const` data in `core ./contracts`. Each of the eleven tokens carries exactly one projection class and one derivation class, so the typed CLI and the bash-era delivery summary can be compared token-for-token. Seven tokens whose derivation needs tracker, PR, or dispatch/session evidence are declared and reserved; this surface reaches `finished`, `partial`, `failed`, and `state-unverified`.

The surface consumes the [pm-notes lint and phase-transition](feature-pm-notes-lint-and-phase-transitions.md) rules and registry, the [state layer](feature-state-layer.md) verified-read substrate, and the [result contract](feature-result-contract.md) envelope, error table, classification chain, and `{0, 1, 2}` exit projection. The `state-unverified` projection decision is recorded in [TDR-0005](../../decisions/TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md).

## Business Context

### Problem Statement

- **Problem:** A delivery that did not finish can still read as a success to anything that trusts a zero exit or the absence of an error. Without one typed verifier, the coordinator reads pm-notes and PR state by hand, malformed notes surface as crashes or unclassified fallbacks, and the eleven-token delivery vocabulary exists only inside the bash stack.
- **Affected users:** The coordinator and lifecycle agents (`@pm`, `@pr-manager`, `@doc-syncer`) finalizing a change; the repository owner reviewing a PR; dual-run evaluation comparing typed and bash-era results; later lifecycle-finalization and evidence stories that consume the verdict.
- **Business impact:** The exit-zero false-success class is removed at the verification layer. Finalization becomes one machine-consumable call, small LITE changes verify against their declared compressed set, and dual-run evidence is comparable because the vocabulary is identical.

### Goals & Success Metrics

- **Primary goal:** Verify a delivered change against its declared variant's phase ledger and classify the delivery result tuple in one read-only call.
- **KPIs:** Incomplete, malformed, missing-target, and unverifiable fixtures produce exit `0` zero times; incomplete verdicts name every missing required phase in required-set order; the token set and order equal the bash usage enum (11/11, 0 drift); every token has exactly one taxonomy row; verify performs zero writes, fences, network calls, and process spawns; replay over identical inputs is byte-identical.

## User Experience & Functionality

### Command surface

`verify` is a top-level command with exactly one subcommand, `change`, followed by exactly one change ref. There are no command-specific flags; `--json` is the existing global machine-output flag and gains no new behavior.

| Invocation | Outcome |
|---|---|
| `verify change GH-177` | Verify that change; human diagnostics on failure. |
| `verify change GH-177 --json` | Verify that change; exactly one machine envelope on stdout. |
| `verify` / `verify change` / `verify other GH-177` | Handler grammar rejection: `input.value.rejected`, exit `1`, no reads. |
| `verify change GH-177 extra` / unknown flag | Parser rejection before the handler: `fallback.invocation`, exit `1`, no reads. |

The handler owns no stream writes and no exit codes: it returns `data` or `error`, and the CLI edge renders the envelope and projects the exit. The command reads, in order, the pm-notes target, the pure lint rules, and the registry evidence; it never mutates a target. A ref that does not resolve to a pm-notes document, including one outside the `<PREFIX>-<digits>` shape, is `lint.target.missing`.

### Variant-aware required sets

Verification checks the declared variant's phase set, never a hardcoded eleven. The effective variant and required set come from the pinned pm-notes contracts data (`PM_NOTES_VARIANT_VALUES`, `PM_NOTES_DEFAULT_VARIANT`, `PM_NOTES_REQUIRED_PHASES_BY_VARIANT`); verify declares no separate phase table.

| Effective variant | Declaration in pm-notes | Required phases, in evaluation order |
|---|---|---|
| `full` | `variant` absent, or `variant: full` | `clarify_scope`, `specification`, `test_planning`, `delivery_planning`, `dor_check`, `delivery`, `system_spec_update`, `review_fix`, `quality_gates`, `dod_check`, `pr_creation` |
| `lite` | `variant: lite` | `clarify_scope`, `specification`, `delivery`, `quality_gates`, `dod_check`, `pr_creation` |
| unknown | any other string value | none; classified `lint.variant.unknown` |
| invalid type | non-string `variant` | none; classified `lint.notes.malformed` |

A required phase is missing when its effective completion is null after the evidence merge. Missing ids are emitted in the required set's order; the LITE order is the canonical relative order of its six phases. Phases outside the effective required set, including non-canonical extra phase keys, are ignored by verification: they are never reported missing and never validated for completion. A LITE change that leaves `test_planning`, `delivery_planning`, `dor_check`, `system_spec_update`, and `review_fix` null or absent is complete.

### Evidence sources and overlay precedence

Verification merges two evidence sources with an explicit per-phase rule:

1. **Declaration evidence:** the pm-notes `phases` map. A required phase is declared completed when its entry exists and `completed` is a non-null timestamp string; a missing entry is not declared completed.
2. **Registry evidence:** the verified `phase.transition` history for the change, folded with the existing pure `foldPhaseState` semantics. If the folded state has an entry for a phase, its latest operation decides completion: `complete` means completed, `reopen` means not completed. "Mentioned" means present in the folded state, not merely present in the raw history: a reopen with no prior completion leaves no fold entry, so the declaration stands for that phase.

| Declaration for a phase | Registry for that phase | Effective completion |
|---|---|---|
| `completed: <timestamp>` | no record | completed |
| `completed: null` | no record | open |
| key absent | no record | open, and named through `lint.phases.incomplete` |
| `completed: <timestamp>` | latest transition `reopen` | open; registry wins |
| `completed: null` or key absent | latest transition `complete` | completed; registry wins |

The rule is per phase because the two sources can legitimately differ phase-by-phase, notably during the append-then-document-write window of the phase write path. Registry evidence overrides the declaration for every phase it mentions; the declaration decides every phase the registry does not mention. Missing registry evidence is never negative evidence.

Registry reads are presence-tolerant but verification-strict:

- The whole store is verified first through the state layer (framing, sequence, checksum, schema). A store-level verification failure, or a corrupt per-change payload for the verified change, is a classified `state.*` failure: the evidence is untrustworthy, so no change is verified from it.
- An absent per-change record in an otherwise verified store is no evidence (`present: false`), not `state.keys.missing`.
- A store that does not exist at all is a verified-empty store, also no evidence.
- The derived `phase-state.<REF>.json` projection is not read as evidence. Verification folds the verified ledger directly, so a stale or missing projection cannot change the verdict.

### Delivery result enum and taxonomy

The eleven tokens are the bash-era delivery summary vocabulary, adopted verbatim in bash usage order as `DELIVERY_RESULT_TOKENS`. `DELIVERY_RESULT_TAXONOMY` declares exactly one row per token with one projection class (`success | user-validation | platform-provider`) and one derivation class (`verify | tracker-pr | dispatch-session`). The reachable subset in this surface is exactly `finished`, `partial`, `failed`, and `state-unverified`.

| Token | Meaning | Derivation in this surface | Identity source | Projection class | Exit |
|---|---|---|---|---|---|
| `merged` | Issue closed or a branch-scoped merged PR | Reserved: tracker/PR evidence | none | `success` | `0` |
| `blocked` | Blocked label present | Reserved: tracker evidence | none | `success` | `0` |
| `pr-open` | Open PR resolved for the branch/ref | Reserved: PR evidence | none | `success` | `0` |
| `pr-open-unverified` | Open PR but its URL could not be resolved | Reserved: PR evidence | none | `success` | `0` |
| `failed` | Classification or delivery failure | Document-conformance failure, user-category `state.*` failure, or handler grammar rejection | the pinned identity | `user-validation` | `1` |
| `finished` | Complete artifact ledger | All required phases of the declared variant completed after overlay | success envelope | `success` | `0` |
| `max-restarts` | Restart budget exhausted | Reserved: dispatch/session evidence | none | `user-validation` | `1` |
| `state-unverified` | Delivery state could not be verified | Platform-category registry/store failure | the specific `state.*` identity | `platform-provider` | `2` |
| `partial` | Incomplete artifact ledger | Required phase absent after overlay, or declared but not completed | `lint.phases.incomplete` or `verify.ledger.incomplete` | `user-validation` | `1` |
| `noop-lane-permission` | Headless permission auto-reject, no work landed | Reserved: dispatch/session and lane-log evidence | none | `user-validation` | `1` |
| `noop-lane-nothing-to-do` | Nothing was attempted in the lane | Reserved: tracker/dispatch evidence | none | `success` | `0` |

Pinned derivation mapping: `verify` derives `finished`, `partial`, `failed`, and `state-unverified`; `tracker-pr` derives `merged`, `blocked`, `pr-open`, and `pr-open-unverified`; `dispatch-session` derives `max-restarts`, `noop-lane-permission`, and `noop-lane-nothing-to-do`. Reserving a token never makes it reachable, so a tracker-derived success cannot leak into a ledger-only verdict.

`finished` means the declared variant's ledger is complete. It is a necessary, not sufficient, condition for merge: commit, CI, push-parity, and owner-gate evidence remain lifecycle-finalization responsibilities, so a complete ledger never substitutes for merge gates.

### Exit taxonomy

Exit digits exist only in the CLI projection module. The taxonomy declares a projection class per token; the projection module maps the class to `{0, 1, 2}`.

| Result token | Projection class | CLI exit | Bash exit | Divergence |
|---|---|---|---|---|
| `merged` | `success` | `0` | `0` | none |
| `blocked` | `success` | `0` | `0` | none |
| `pr-open` | `success` | `0` | `0` | none |
| `pr-open-unverified` | `success` | `0` | `0` | none |
| `finished` | `success` | `0` | `0` | none |
| `failed` | `user-validation` | `1` | `1` | none |
| `max-restarts` | `user-validation` | `1` | `1` | none |
| `state-unverified` | `platform-provider` | `2` | `1` | deliberate; see TDR-0005 |
| `partial` | `user-validation` | `1` | `1` | none |
| `noop-lane-permission` | `user-validation` | `1` | `1` | none |
| `noop-lane-nothing-to-do` | `success` | `0` | `0` | none |

The single numeric divergence is deliberate: in the typed CLI, `state-unverified` is reached through platform-category registry/store failures, whose identities project `platform-provider` and exit `2`. Reproducing bash's exit `1` would require an exit override outside the projection module, which the result contract forbids. Token parity, not numeric exit parity, is the dual-run comparison unit.

Broken invocations are outside the delivery-result taxonomy. The typed CLI resolves them through `fallback.invocation` (`user-validation`, exit `1`), and verify handler grammar failures use `input.value.rejected` (also exit `1`).

Envelope exclusivity is preserved: `finished` is the only token rendered as success `data`; every other reachable token is rendered as an error envelope whose identity's projection class yields the exit. The result token appears in the failure summary, not as an envelope field, so the v1 envelope shape is unchanged.

### Error identities

One additive row joins the error table under the `verify` domain kind. `verify` is a declared domain kind beside `provider`, `input`, `config`, `state`, and `lint`; the reserved `fallback` namespace is unchanged.

| Code | Domain kind | Category | Retryable | Consequence | Projection class | Token | Summary |
|---|---|---|---|---|---|---|---|
| `verify.ledger.incomplete` | `verify` | user | false | not_landed | user-validation | `partial` | The declared variant's required phases are not all completed. |

Reused identities, unchanged:

| Code | Token | Exit | Role in verify |
|---|---|---|---|
| `lint.notes.malformed` | `failed` | `1` | Unparseable, structural, or value-type failure. |
| `lint.keys.missing` | `failed` | `1` | Missing required key. |
| `lint.variant.unknown` | `failed` | `1` | Unknown variant value. |
| `lint.phases.incomplete` | `partial` | `1` | A required phase is still absent after the registry overlay. |
| `lint.target.missing` | `failed` | `1` | No pm-notes target for the ref. |
| `input.value.rejected` | `failed` | `1` | Handler grammar rejection. |
| `state.store.torn` | `state-unverified` | `2` | Store verification failed. |
| `state.schema.mismatch` | `state-unverified` | `2` | Store schema is unsupported. |
| `state.keys.missing` | `state-unverified` | `2` | Corrupt transition payload or another key-set assertion failure; an absent per-change record is no evidence, not this error. |
| `state.permission.denied` | `failed` | `1` | Read permission failure; user-fixable. |
| `state.level.unsupported` | `failed` | `1` | Declared level has no implementation; total classification path. |
| `fallback.internal` | no token | `2` | Only for genuinely unclassifiable failures; never for a documented class. |

`lint` owns document conformance, and a conformant document whose delivery is incomplete is not malformed; `state` owns storage integrity, and a healthy store is not a failure. The single `verify` row keeps the lint-versus-verify and state-versus-verdict distinctions honest and provides a namespace for later verify verdicts.

### Classification summary and success evidence

Failure summaries are deterministic and machine-consumable:

```text
result=<token>; variant=<full|lite|unknown>; missing=<comma-separated ids | ->[; detail=<one-line>]
```

- `variant` is `unknown` for parse, key, value-type, unknown-variant, missing-target, and grammar failures; it is the effective variant once the variant family passes.
- `missing` is `-` for every non-`partial` outcome. For `partial`, it lists the missing required phases in required-set order, comma-separated with no spaces.
- The optional trailing `; detail=<one-line>` carries the safe, deterministic detail and location of a `lint.*` malformed or keys finding, or the row summary of a `state.*` failure. It is absent for `partial`, unknown variant, missing target, and grammar failures, so those summaries are exactly three segments. Newlines are collapsed; no raw document bytes or parser output enter it.
- Summary text is prose, never identity; identity remains `error.code`. When a `partial` verdict reuses `lint.phases.incomplete`, verify supplies the deterministic summary in place of the lint default while keeping the lint code.

Success `data` carries the same tuple in structured form:

```text
{
  changeRef,
  target: "change",
  result: "finished",
  variant: "full" | "lite",
  requiredPhases: [ ... ],     // required-set order
  completedPhases: [ ... ],    // required-set order
  missingPhases: [],           // always empty on success
  evidence: {
    declaration: { completedCount, requiredCount },
    registry: { present, verifiedEmpty, recordCount, transitionCount,
                overlaidPhases: [ ... ] }
  }
}
```

`overlaidPhases` names the required phases whose completion the registry decided, which is the audit trail for the per-phase precedence rule. Success consumers never parse prose.

### Classification order

The decision order is total and deterministic:

1. Parser-level invocation failures resolve as `fallback.invocation` before the handler.
2. Handler grammar failures resolve as `input.value.rejected` before any read.
3. Target absence and document-conformance failures (parse, keys, value types, unknown variant) are terminal before any registry read.
4. A required-phase-presence finding is recorded and the registry read proceeds, because a landed transition may account for a stale document entry.
5. Registry read failures are decided next: platform-category failures classify `state-unverified`; user-category failures classify `failed`.
6. The overlay completes the per-phase merge. If required phases remain missing, absence selects `lint.phases.incomplete`; otherwise a declared-but-incomplete phase selects `verify.ledger.incomplete`. Both are `partial`.
7. An empty missing set produces the `finished` success envelope.

## Technical Architecture & Codebase Map

### High-level design

The change follows the established tier split:

1. **Data-only contracts:** the token vocabulary, the per-token taxonomy, and the additive error row live in `core ./contracts` as types and `as const` data.
2. **Pure domain rules:** variant resolution, declaration/registry merge, missing-phase ordering, and identity/token selection live in `core ./domain` as pure functions over parsed documents and transition records. No file access, clock, parser, or runtime API.
3. **State tier:** a presence-tolerant verified transition read composes the existing state port and reuses the existing fold; the derived projection is not read.
4. **CLI surface and edge:** the command definition follows the `lint`/`phase` registration precedent; the runtime-aware edge reads pm-notes and the registry and injects them. The CLI owns envelope rendering, classification, and exit projection.

### Components

| Path | Responsibility |
|---|---|
| `packages/core/src/contracts/delivery-result.ts` | The eleven tokens and the per-token taxonomy (projection class, derivation class) as data; the reachable subset is derived from the taxonomy; types. |
| `packages/core/src/contracts/error-table.ts` | `verify` in `DOMAIN_KINDS` and the `verify.ledger.incomplete` row. |
| `packages/core/src/contracts/pm-notes.ts` | Canonical phases, default variant, per-variant required sets, and lint identities consumed unchanged. |
| `packages/core/src/contracts/registry.ts` | Transition record and projection vocabulary consumed unchanged. |
| `packages/core/src/domain/pm-notes-lint.ts` | The fixed-order conformance rules reused unchanged. |
| `packages/core/src/domain/verify-change.ts` | Pure classification: effective variant, declaration/registry merge, ordered missing set, identity and token selection, summary tuple. |
| `packages/core/src/state/registry.ts` | Presence-tolerant verified transition read (`readChangeTransitionsTolerant`) plus reuse of `foldPhaseState`. |
| `packages/adapters/src/file/pm-notes-parser.ts` | Target location, bounded YAML 1.2 core parse, and safe parse failure, consumed unchanged. |
| `packages/cli/src/commands/verify.ts` | `verify change` definition, grammar, injected runtime types, and data/error shaping. |
| `packages/cli/src/commands/index.ts` | Exports the verify command definition and runtime types. |
| `packages/cli/src/edge.ts` | Composes the verify runtime (`createVerifyCommandRuntime`) into the command program beside `config`, `lint`, and `phase`. |
| `packages/cli/src/classify.ts`, `packages/cli/src/projection.ts` | Classification chain and the only `{0, 1, 2}` digits, consumed unchanged. |

### Boundaries and invariants

- **Tier:** contracts carry data and types only; domain imports contracts only; the state tier imports contracts and its own state modules; runtime I/O stays in the adapter and CLI edges. No new runtime-API location and no new runtime dependency.
- **Single enum home:** the eleven tokens are declared once in contracts; no other production module declares a token list. Tests may hold an oracle, and the bash script remains the external reference.
- **Read-only:** no write call, fence acquisition, projection rebuild, target-file mutation, network access, or process spawn occurs on any verify path.
- **Evidence precedence:** registry overrides declaration per mentioned phase; absent registry evidence never becomes negative evidence or a state error.
- **Envelope exclusivity:** only `finished` yields `data`; every other reachable token yields `error`; no path carries both or neither.
- **Exit projection:** digits live only in the projection module; the taxonomy declares classes; every reachable token's exit is in `{0, 1, 2}`.
- **Determinism:** ordering comes from contract arrays, not map iteration; no clock, randomness, or environment read in the domain; identical inputs yield identical verdict, summary, and exit.
- **Brand neutrality:** no product or binary literal enters the new modules; the command needs no brand value beyond the injected context.

## Non-Functional Requirements

| ID | Requirement | Threshold |
|---|---|---|
| NFR-1 | Runtime neutrality and tier conformance | 0 contracts with behavior or I/O, 0 domain imports outside contracts, 0 new runtime-API locations; all boundary, ambient, and dependency-cruiser gates green |
| NFR-2 | Machine-output validity | 100% of verify fixture runs emit exactly one valid envelope; 0 exits outside `{0, 1, 2}`; user-category failures project `1`; platform-category failures project `2` |
| NFR-3 | Non-zero guarantee | 0 exit-`0` outcomes for incomplete, malformed, missing-target, or unverifiable inputs; 0 failure envelopes carrying `data`; 0 documented classes contained as `fallback.internal` |
| NFR-4 | Determinism and read-only behavior | 0 verdict or summary drift across replays; 0 bytes written; 0 fences acquired; 0 network calls; 0 child processes spawned |
| NFR-5 | Taxonomy binding | tokens equal the bash usage enum in set and order (11/11); each token has exactly one taxonomy row (11/11); 0 tokens without a valid projection class; 0 reachable-subset drift |
| NFR-6 | Error-table binding | the `verify.ledger.incomplete` row round-trips with its documented row; 0 two-way documented-table drift; 0 existing rows modified |
| NFR-7 | Real-corpus correctness | 0 crashes or unclassified fallbacks over the pinned committed-change fixtures; 0 incorrect tokens on those fixtures |

## Quality Assurance Strategy

| Level | Location | Scope |
|---|---|---|
| Behaviour: classification | `tests/behaviour/verify-change-classification.test.ts` | Full and LITE complete/incomplete sets, overlay precedence, ordering, and the success tuple. |
| Behaviour: rejections | `tests/behaviour/verify-change-rejections.test.ts` | Every malformed class, unknown variant, missing target, and grammar failure pinned to one identity. |
| Behaviour: evidence failure | `tests/behaviour/verify-change-state.test.ts` | Torn, schema-mismatch, corrupt-payload, and permission registry failures with token and exit. |
| Behaviour: envelope and determinism | `tests/behaviour/verify-envelope.test.ts` | Envelope exclusivity, exit matrix, replayed bytes, and zero writes, fences, or spawns. |
| Behaviour: real corpus | `tests/behaviour/verify-corpus.test.ts` | Committed change fixtures classify as finished, partial, or malformed without crashes. |
| Structure: enum and taxonomy | `tests/structure/delivery-result-contract.test.ts` | Bash usage-enum extraction, 11/11 totality, unique rows, valid classes, and derivation subset. |
| Structure: tier and imports | `tests/structure/verify-imports.test.ts` | Contracts data-only, pure domain, no new runtime location, no brand literals. |
| Checks: error table | `tests/checks/error-table-sync.test.ts` | New row, documented row, and fixture agreement with two-way drift detection. |
| Boundaries | `tests/boundaries/**` | Tier and runtime-edge rules applied to the new modules. |

Fixtures under `tests/fixtures/verify/` cover complete and incomplete full sets, complete and incomplete LITE sets, overlay precedence, malformed documents, missing targets, and grammar variants. Negative controls assert the absence of the incorrect outcome (no `data`, no exit `0`, no `fallback.internal`); positive controls assert each complete variant passes and ignored non-required phases never appear as missing. Two identical runs over the same bytes and injected registry facts must produce identical output.

## Operational & Support

### Configuration

The surface has no ambient configuration. The pm-notes directory, filesystem facts, and state store are injected at the runtime-aware edge. `--json` selects machine output; without it, a success prints its normal human payload and a failure writes only the human diagnostic.

### Observability and cost

The success envelope's structured tuple and the failure summary are the observability surface. Failure summaries carry counts, ids, classes, and safe locations only, never secret material, raw document bytes, or parser output. The command adds no daemon, background process, network call, or configuration knob. Its cost is linear in the required-set size (eleven maximum) and the transition-history length.

## Dependencies & Risks

- **Depends on** the result contract ([feature-result-contract.md](feature-result-contract.md)) for the envelope, error table, classification chain, exit projection, and documented-table sync.
- **Depends on** pm-notes lint and phase transitions ([feature-pm-notes-lint-and-phase-transitions.md](feature-pm-notes-lint-and-phase-transitions.md)) for the schema, pinned variant sets, lint rules and identities, registry records, fold semantics, and write-time ledger authority.
- **Depends on** the state layer ([feature-state-layer.md](feature-state-layer.md)) for verified reads, tear detection, evidence classes, and the append-only ledger substrate.
- **Depends on** [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md) for package tiers and runtime-API confinement.
- **Consumed by** lifecycle finalization, dual-run evidence, and later verify surfaces that interpret the result token.
- **Risk — stale declaration masks a reopen:** registry evidence overrides the declaration for every mentioned phase, so a hand edit cannot manufacture a false `finished`.
- **Risk — declaration-only changes read as incomplete:** absent registry evidence is no evidence, so a change that never used the write path still verifies from its declaration.
- **Risk — numeric dual-run comparison:** `state-unverified` exits `2` where bash exits `1`; the divergence is declared by TDR-0005, and dual-run consumers compare tokens, not digits.
- **Risk — taxonomy drift:** a structure test binds the token set and order to the bash usage enum and fails closed if the reference is missing or mutated.

## Glossary & References

| Term | Definition |
|---|---|
| Delivery result tuple | The classified verification outcome: result token, effective variant, ordered missing phases, and evidence. |
| Delivery result enum | The eleven bash-era tokens adopted as the single typed vocabulary for delivery outcomes. |
| Exit taxonomy | The total mapping from a result token to a projection class and the CLI's `{0, 1, 2}` exit. |
| Verify versus lint | Verify assesses delivery evidence against the declared ledger; lint validates document conformance. Lint output never substitutes for verify. |
| Change variant | The declared lifecycle shape: `full` (eleven canonical phases) or `lite` (pinned six); absence means `full`. |
| Overlay precedence | Per-phase rule: the registry decides a phase it mentions; the declaration decides the rest. |
| Presence-tolerant read | A verified registry read that treats an absent per-change record as no evidence rather than a key-set failure. |

See also:

- [Result contract and error table](feature-result-contract.md) — envelope, error table, classification chain, exit projection, documented-table sync.
- [PM-notes lint and phase transitions](feature-pm-notes-lint-and-phase-transitions.md) — schema, variants, lint identities, registry and fold.
- [State layer](feature-state-layer.md) — verified reads, fences, torn-state detection, and derived documents.
- [Monorepo scaffold and toolchain](feature-monorepo-scaffold-toolchain.md) — package tiers, boundary matrices, and the aggregate check.
- [Change lifecycle guide](../../guides/change-lifecycle.md) — canonical eleven phases and the variant rule.
- [TDR-0005 — Delivery Result Enum and CLI Exit Taxonomy](../../decisions/TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md) — token parity, projection binding, and the `state-unverified` divergence.
- [Glossary](../../overview/glossary.md) — repository-wide terms.
