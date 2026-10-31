---
id: GH-177
status: Proposed
created: 2026-10-31
last_updated: 2026-10-31
owners: [engineering]
service: delivery-os CLI verification and state tier
summary: >-
  A read-only `ados verify change <ref>` command that verifies a change's phase
  ledger against its declared variant (full or LITE), classifies the delivery
  result tuple in the eleven-token bash-era vocabulary, and projects every
  classified outcome through one total exit taxonomy. Incomplete ledgers name
  the missing phases and can never produce a success envelope; malformed notes
  reuse the existing `lint.*` identities and never crash; registry failures
  reuse the existing `state.*` identities. One additive `verify` error identity
  carries the incomplete-ledger verdict.
links:
  related_changes: ["GH-172", "GH-174", "GH-179", "GH-177"]
  related_decisions: ["ADR-0003", "TDR-0005"]
---

# Feature: Verify change and exit taxonomy (M0-S8)

> **PURPOSE**: Kill the exit-zero false-success class at the verification
> layer: a coordinator must be able to ask one read-only command whether a
> delivery's declared phase ledger is complete, get a classified delivery
> result tuple in the same vocabulary the bash-era summary prints, and trust
> that an incomplete or unverifiable change never exits `0`.

## Overview

`ados verify change <ref>` verifies one delivered change against its phase
ledger and classifies the delivery result tuple. It is ledger-only and
read-only: it reads the change's committed pm-notes declaration (which supplies
the change variant and the declared phase state), reads the delivery registry's
verified `phase.transition` history when one exists, and classifies the result
from those two evidence sources alone. It performs no mutation, acquires no
fence, calls no tracker or PR provider, and spawns no process.

The classification vocabulary is the eleven-token bash-era delivery summary
(`merged | blocked | pr-open | pr-open-unverified | failed | finished |
max-restarts | state-unverified | partial | noop-lane-permission |
noop-lane-nothing-to-do`). That vocabulary becomes `as const` data in the
runtime-neutral contracts tier, with a declared per-token projection and
derivation class, so dual-run evidence (M1-S9) compares like with like. Tokens
that require non-ledger evidence — tracker, PR, or dispatch/session facts — are
declared and reserved; their collectors arrive with M0-S19 and M1-S9. M0-S8
reaches only `finished`, `partial`, `failed`, and `state-unverified`; the other
seven tokens remain unreachable until their evidence collectors land.

Verification is variant-aware. The required phase set comes from the
already-pinned `PM_NOTES_REQUIRED_PHASES_BY_VARIANT` data: `full` is the
canonical eleven phases, `lite` is the pinned six, and absence of `variant`
means `full`. A missing required phase is named, in the required set's order,
in a deterministic machine-readable summary. Incomplete is a failure: the
command emits exactly one failure envelope carrying `verify.ledger.incomplete`
(or the reused `lint.phases.incomplete` when a required phase is not declared at
all) and exits `1`. Only a fully completed declared variant produces a success
envelope with `result: "finished"` and exit `0`.

Malformed pm-notes are classified through the existing `lintPmNotes` rules and
the existing `lint.*` identities — parse, key-set, value-type, unknown variant,
and missing target — never as a crash and never as an unclassified fallback.
Registry read failures reuse the existing `state.*` identities. One additive
error-table row (`verify.ledger.incomplete`, under a new `verify` domain kind)
expresses the "valid document, incomplete delivery" verdict that neither `lint`
nor `state` owns.

## Business Context

### Problem statement

The coordinator currently verifies a delivery by reading pm-notes and PR state by
hand, and the bash-era delivery loop's most-documented defect family is
exit-zero false success: a delivery that did not finish can still read as a
success to anything that trusts a zero exit or a "no error printed" signal.
There is no typed verification surface: `lint` checks document conformance, not
evidence; `phase list` reports folded transition state, not a delivery verdict;
and the eleven-token delivery result vocabulary exists only inside
`scripts/deliver-ticket.sh`, unavailable to the typed CLI. Without one
read-only verifier that names missing phases, classifies malformed input, and
maps every classified result to a non-zero exit where appropriate, the
false-success class simply moves from the bash stack into the new tooling.

### Affected users

- **The coordinator** (PM-style session): the primary caller; uses the verdict
  to decide whether a delivery is finalizable, resumable, or needs intervention.
- **Lifecycle agents** (`@pm`, `@pr-manager`, `@doc-syncer`): need a
  machine-readable finalization answer at `dod_check` instead of prose notes.
- **The repository owner at PR review**: sees the variant and the missing-phase
  list in the evidence, so a LITE declaration cannot hide an incomplete
  delivery.
- **Dual-run evaluation (M1-S9)**: compares typed verify verdicts with the bash
  summary token-for-token.

### Business impact

- **Verification integrity**: an incomplete or unverifiable delivery cannot
  produce exit `0`; the exit-zero false-success class is removed at the
  verification layer.
- **Faster, cheaper finalization**: one command replaces manual notes/PR
  reading, the single most-repeated scriptable verification.
- **Comparable evidence**: dual-run evaluation is possible immediately because
  the result vocabulary is identical to the bash summary's.
- **Variant fairness**: small changes verify against their declared compressed
  set, so LITE deliveries are neither falsely failed nor silently exempted.
- **Unblocks**: M0-S9 (`verify gates`), M1-S7, and M1-S9 consume this verdict.

### Goals (ticket intent)

1. Verify a delivered change against the phase ledger and classify the
   delivery result tuple.
2. Mirror the bash-era summary's result enum so dual-run evidence compares like
   with like.
3. Check the declared variant's phase set (full or LITE), not a hardcoded
   eleven.
4. Classify malformed pm-notes with a code, never a crash.
5. Map the exit taxonomy to the classified results, preserving the non-zero
   guarantee for incomplete and unverifiable outcomes.

### Success metrics / KPIs

| Metric | Target |
|--------|--------|
| Exit-zero outcomes on incomplete, malformed, missing-target, or unverifiable fixtures | 0 |
| Incomplete-ledger verdicts naming every missing required phase, in required-set order | 100% |
| Documented pm-notes malformation classes classified with exactly one pinned `lint.*` identity | 100% |
| Tokens in the contracts enum vs. the bash usage enum (set and order) | 11/11, 0 drift |
| Tokens with exactly one taxonomy row and one projection class | 11/11 |
| Writes, fence acquisitions, network calls, and process spawns during verify | 0 / 0 / 0 / 0 |
| Replay determinism over identical bytes and injected registry facts | 100% identical verdict, summary, and exit |
| Real-corpus sample classified without crash or unclassified fallback | GH-179 finished; GH-170 partial; GH-171 malformed |

### Non-goals

- **NG-1**: Tracker, PR, CI, or session evidence collection. `merged`, `blocked`,
  `pr-open`, `pr-open-unverified`, `max-restarts`, and `noop-lane-*` derivations
  are reserved for M0-S19/M1-S9; M0-S8 is ledger-only and makes no network call.
- **NG-2**: Any mutation. Verify never writes pm-notes, never appends or repairs
  the registry, never rebuilds the projection, and never acquires a fence.
- **NG-3**: `verify gates` (M0-S9), CI-status evaluation, push parity, owner-gate
  scan, and squash preflight.
- **NG-4**: Dispatch, supervision, liveness, restart budgeting, and session
  classification.
- **NG-5**: Changing the `CommandResult` envelope shape, adding exit codes
  outside `{0, 1, 2}`, or adding any identity beyond one additive `verify` row.
- **NG-6**: pm-notes schema or variant-set changes; the pinned required sets are
  reused as data.
- **NG-7**: Agent prompt adoption; making lifecycle agents call `verify` is an
  operating-model change.
- **NG-8**: Cross-repository or remote/shared ledger reads; M0-S8 uses local
  state only.

## Acceptance Criteria

Every AC is testable without further clarification. Traceability references the
capability (`C-#`) and non-functional requirement (`NFR-#`) it exercises.

- **AC-V1 — An incomplete full ledger names the missing phases.**
  Given a change whose pm-notes declares no `variant` (effective `full`), whose
  `phases` map conforms, and where at least one canonical phase has
  `completed: null`, with no registry transition for the change,
  when `ados verify change <ref>` runs,
  then it exits `1`, emits exactly one failure envelope with code
  `verify.ledger.incomplete` and summary
  `result=partial; variant=full; missing=<ids>`, where `<ids>` is the missing
  set in canonical order, and emits no `data`.
  *DoD predicate*: for every single-phase-not-completed fixture of the eleven,
  exit is `1`, the error-only envelope passes `assertEnvelopeContract`, and the
  missing string equals the expected canonical-order list.
  *Traceability*: C-2, C-4 (`partial`), C-6, NFR-3, NFR-5.

- **AC-V2 — An incomplete LITE ledger names only LITE phases.**
  Given pm-notes with `variant: lite`, all six LITE required phases present,
  and `quality_gates` incomplete,
  when verify runs,
  then it exits `1` with `verify.ledger.incomplete`,
  `result=partial; variant=lite; missing=quality_gates`, and never names
  `test_planning`, `delivery_planning`, `dor_check`, `system_spec_update`, or
  `review_fix`.
  *DoD predicate*: one fixture per LITE required phase omitted in completion
  names exactly that phase; the control with all six LITE phases complete and
  the five non-LITE phases `null` or absent classifies `finished` with exit `0`.
  *Traceability*: C-2, C-4 (`partial`/`finished`), NFR-3, NFR-5.

- **AC-V3 — Malformed notes are classified, never a crash.**
  Given each malformed pm-notes class — unparseable document, missing required
  top-level key, wrong-typed declared value, required phase entry missing
  `started`/`completed`, and non-timestamp typed value,
  when verify runs,
  then each exits `1` with exactly one pinned existing identity
  (`lint.notes.malformed` for syntax/structure/value-type classes,
  `lint.keys.missing` for absent required top-level, entry, or collection keys)
  and a failure envelope, with no stack trace on the error stream.
  A required *phase key* absent after the registry overlay is the `partial`
  class of AC-V12/C-7, not `lint.keys.missing`.
  *DoD predicate*: every class → one code + exit `1` + error-only envelope; no
  documented class resolves to `fallback.internal`; zero bytes written.
  *Traceability*: C-7, C-8, NFR-2, NFR-3.

- **AC-V4 — An unknown variant is classified.**
  Given pm-notes whose `variant` is a string outside `full | lite`,
  when verify runs,
  then it exits `1` with `lint.variant.unknown` and summary
  `result=failed; variant=unknown; missing=-`.
  *DoD predicate*: unknown-variant fixture → exact code, exit `1`, no registry
  read, no crash; a `variant: lite` control does not produce this code.
  *Traceability*: C-2, C-5 (`failed`), C-7, NFR-6.

- **AC-V5 — A missing target is classified.**
  Given a change ref with no pm-notes document under the change-artifact
  convention,
  when verify runs,
  then it exits `1` with `lint.target.missing` and summary
  `result=failed; variant=unknown; missing=-`, and performs no registry read.
  *DoD predicate*: absent-target fixture → exact code and exit; a present-target
  control never produces `lint.target.missing`.
  *Traceability*: C-1, C-5 (`failed`), C-7, NFR-6.

- **AC-V6 — A complete ledger verifies.**
  Given effective-variant `full` pm-notes with all eleven canonical phases
  completed and no registry transition record for the change (either a verified
  empty store or a store holding only another change's records),
  when verify runs,
  then it exits `0` and emits exactly one success envelope whose `data` carries
  `result: "finished"`, `variant: "full"`, `requiredPhases` (eleven ids in
  canonical order), `completedPhases` (same order), `missingPhases: []`, and
  evidence; the envelope has no `error` key.
  *DoD predicate*: the success envelope key set is exact, passes
  `assertEnvelopeContract`, and the missing per-change registry key is treated
  as no evidence rather than `state.keys.missing`.
  *Traceability*: C-1, C-3, C-4 (`finished`), C-6, NFR-2, NFR-3.

- **AC-V7 — Registry failures are classified and never success.**
  Given a torn registry ledger, a schema-mismatched store, and a per-change
  record whose transition payload violates the declared transition key set,
  when verify runs,
  then each exits `2` with the specific platform identity
  (`state.store.torn`, `state.schema.mismatch`, or `state.keys.missing`) and
  summary `result=state-unverified; variant=<effective>; missing=-`, with no
  `data`.
  Given a registry read that fails with `state.permission.denied`,
  then verify exits `1` with that identity and
  `result=failed; variant=<effective>; missing=-`.
  *DoD predicate*: three platform fixtures exit `2`, the user-category fixture
  exits `1`, every envelope is error-only and valid, and no fence or write call
  is made.
  *Traceability*: C-3, C-4 (`state-unverified`), C-5, C-8, NFR-2, NFR-3.

- **AC-V8 — The result enum and taxonomy are total and bound.**
  Given the delivered contracts data,
  then `DELIVERY_RESULT_TOKENS` contains exactly the eleven bash-era tokens in
  the bash usage order; `DELIVERY_RESULT_TAXONOMY` has exactly one entry per
  token; every entry declares exactly one projection class from
  `success | user-validation | platform-provider` and one derivation class from
  `verify | tracker-pr | dispatch-session`; the derivation mapping is exactly
  `verify` → `finished`, `partial`, `failed`, `state-unverified`,
  `tracker-pr` → `merged`, `blocked`, `pr-open`, `pr-open-unverified`,
  `dispatch-session` → `max-restarts`, `noop-lane-permission`,
  `noop-lane-nothing-to-do`; and the M0-S8-reachable subset is
  exactly `finished`, `partial`, `failed`, `state-unverified`.
  *DoD predicate*: a structure test extracts the `result=<...>` list from the
  usage block of `scripts/deliver-ticket.sh` and asserts equality of set and
  order (the test fails closed if the reference is missing); taxonomy keys equal
  the token list; 0 duplicates, 0 gaps, 0 extra tokens; the documented table in
  this spec matches the data.
  *Traceability*: C-4, C-5, NFR-5.

- **AC-V9 — Incomplete and unverifiable outcomes are non-zero.**
  Given every fixture where verification cannot establish that all required
  phases of the declared variant are completed,
  when verify runs,
  then the exit code is non-zero (`1` for classification and user-category
  failures, `2` for platform-category registry failures) and the envelope
  contains `error` and no `data`; exit `0` occurs only for a fully verified
  `finished` outcome.
  *DoD predicate*: an exhaustive rejection matrix asserts `exit != 0` and
  error-only envelopes for every class; a complete-ledger fixture asserts `0`;
  the matrix is non-vacuous and covers all pinned identities.
  *Traceability*: C-4, C-5, C-6, NFR-2, NFR-3.

- **AC-V10 — Verify is read-only, network-free, spawn-free, and deterministic.**
  Given any verify invocation,
  then it writes zero bytes to the change tree or the state store, acquires no
  fence, performs no tracker/PR/CI/network access, and spawns no child process;
  and two runs over identical pm-notes bytes and identical injected registry
  facts produce an identical result tuple, summary, and exit code.
  *DoD predicate*: byte/hash snapshots before and after each fixture are equal;
  the injected runtime records zero write/fence/network/spawn calls; boundary
  and ambient suites stay green; replay equality holds for every
  classification class.
  *Traceability*: C-1, C-3, NFR-1, NFR-4.

- **AC-V11 — Real committed changes classify correctly.**
  Given the committed change artifacts dated 2026-10 or later,
  when verify runs,
  then `GH-179` (eleven completed, no per-change registry record) classifies
  `finished` with exit `0`; `GH-170` (two null completions, plus opaque
  non-canonical phase keys) classifies `partial` with exit `1` and names
  `test_planning` and `delivery_planning`; and `GH-171` (a known-unparseable
  historical pm-notes) classifies `lint.notes.malformed` with exit `1`.
  *DoD predicate*: all three are permanent fixtures; none crashes, none returns
  `fallback.internal`, and GH-179 proves the declaration fallback works when
  the change never used `ados phase`.
  *Traceability*: C-3, C-2, C-4 (`finished`/`partial`), C-7, NFR-7.

- **AC-V12 — Registry evidence overrides a stale declaration.**
  Given pm-notes declaring phase P completed while the verified registry's
  latest transition for P is `reopen`, verify classifies P open (`partial`).
  Given pm-notes lacking P or declaring P incomplete while the registry's latest
  transition for P is `complete`, verify classifies P completed (`finished`
  when all other required phases are completed). Given a verified store
  containing records only for a different change ref, verify treats the absent
  per-change record as no evidence, does not fail `state.keys.missing`, and
  classifies from the declaration.
  *DoD predicate*: three overlay fixtures plus a declaration-match control
  produce the expected token, identity, and exit; the absent-per-change-key
  fixture never emits `state.keys.missing`.
  *Traceability*: C-3, C-4, DEC-4, NFR-3.

- **AC-V13 — Missing phases are machine-consumable.**
  Given any `partial` classification,
  then `error.summary` consists of exactly the three segments
  `result=partial; variant=<full|lite>; missing=<id,id,...>` with ids in the
  required-set order and no spaces after commas; the missing set is the same set
  the verdict computed; and success `data` carries `missingPhases: []` and the
  ordered `completedPhases`.
  *DoD predicate*: exact-string assertions for a full and a LITE fixture, plus
  a fixture whose declaration key order is reversed — output order does not
  change.
  *Traceability*: C-6, C-2, NFR-4.

- **AC-V14 — Grammar failures are classified.**
  Given `verify` with no subcommand, `verify change` with no ref, or `verify
  unknown <ref>`,
  when it runs,
  then it exits `1` with `input.value.rejected` (handler grammar), performs no
  target read, and emits no success envelope.
  Given an extra positional beyond the valid shape or an unknown flag,
  then the CLI parser rejects before the handler with `fallback.invocation`,
  exit `1`, and no reads.
  *DoD predicate*: every handler-grammar fixture → `input.value.rejected`;
  every parser-level fixture → `fallback.invocation`; all exit `1` with
  error-only envelopes; a well-formed invocation is unaffected.
  *Traceability*: C-1, C-5, NFR-2, NFR-3.

## Capabilities & Functionality

### C-1 — Command surface: `ados verify change <ref>`

`verify` is a new top-level command composed through `createConfigProgram`,
following the `lint` and `phase` precedent. Its grammar is exactly one
subcommand, `change`, followed by exactly one change ref:

| Invocation | Result |
|---|---|
| `verify change GH-177` | Verify that change; human diagnostics on failure. |
| `verify change GH-177 --json` | Verify that change; exactly one machine envelope on stdout. |
| `verify` / `verify change` / `verify other GH-177` | Handler grammar → `input.value.rejected`, exit `1`, no reads. |
| `verify change GH-177 extra` / unknown flag | Parser rejects before the handler → `fallback.invocation`, exit `1`, no reads. |

There are no command-specific flags. `--json` is the existing global machine
output flag and gains no new behavior. The handler owns no stream writes and no
exit codes; it returns `data` or `error` and the CLI edge renders and projects.
The command reads, in order: the pm-notes target; the pure lint rules; the
registry evidence. It never mutates any target. A ref that does not resolve to a
pm-notes document — including one outside the `<PREFIX>-<digits>` shape — is
`lint.target.missing`; verify adds no separate ref-shape error.

### C-2 — Variant-aware required phase sets

The verifier checks the declared variant's phase set, never a hardcoded eleven.
The effective variant and required set come from the existing contracts data
(`PM_NOTES_VARIANT_VALUES`, `PM_NOTES_DEFAULT_VARIANT`,
`PM_NOTES_REQUIRED_PHASES_BY_VARIANT`); this change re-declares nothing.

| Effective variant | Declaration in pm-notes | Required phases, in evaluation order |
|---|---|---|
| `full` | `variant` absent, or `variant: full` | `clarify_scope`, `specification`, `test_planning`, `delivery_planning`, `dor_check`, `delivery`, `system_spec_update`, `review_fix`, `quality_gates`, `dod_check`, `pr_creation` |
| `lite` | `variant: lite` | `clarify_scope`, `specification`, `delivery`, `quality_gates`, `dod_check`, `pr_creation` |
| unknown | any other string value | none; classified `lint.variant.unknown` |
| invalid type | non-string `variant` | none; classified `lint.notes.malformed` |

Missing-phase output rules:

- A required phase is missing when its effective completion is null (see C-3).
- Missing ids are emitted in the required set's order shown above; the LITE
  order equals the canonical relative order of its six phases.
- Phases outside the effective required set — including non-canonical extra
  phase keys — are ignored by verification, never reported missing, and never
  validated for completion. (Lint already treats them as opaque.)
- A LITE change that leaves `test_planning`, `delivery_planning`, `dor_check`,
  `system_spec_update`, and `review_fix` null or absent is complete.

Example summaries:

- Full, three phases open:
  `result=partial; variant=full; missing=test_planning,delivery_planning,dor_check`
- LITE, one phase open:
  `result=partial; variant=lite; missing=quality_gates`

### C-3 — Phase evidence: declaration plus registry overlay (mandatory decision)

Verification reads two evidence sources and defines precedence explicitly:

1. **Declaration evidence** — the pm-notes `phases` map. Once the document is
   parseable, structurally valid, and its effective variant is known, a required
   phase is declared completed when its entry exists and `completed` is a
   non-null timestamp string. A missing entry is not declared completed.
2. **Registry evidence** — the verified `phase.transition` history for the
   change, folded with the existing pure `foldPhaseState` semantics. If the
   folded registry state has an entry for a phase, its latest operation
   determines that phase's completion: `complete` → completed, `reopen` → not
   completed. "Mentioned" therefore means present in the folded state, not
   merely present in the raw transition history: a reopen with no prior
   completion leaves no fold entry, so the declaration stands for that phase.

**Precedence rule**: for every phase the registry history mentions, the folded
registry state overrides the declaration; for every phase it does not mention,
the declaration stands. Missing registry evidence is never negative evidence.

Why this rule, and why it does not misclassify changes that never called
`ados phase`:

- A per-change transition record exists only if the M0-S10 write path landed a
  transition. Every pre-write-path change — including GH-179, whose pm-notes is
  complete but which has no registry records — has no such record. Reading the
  absent record as "no evidence" and falling back to the declaration is what
  lets the real corpus verify correctly. Reading a missing record as
  `state.keys.missing` would misclassify every one of those changes as an
  error.
- GH-179's rule that the registry ledger is write-time truth is preserved where
  it matters: once a transition exists for a phase, the registry decides that
  phase. A hand-edited or stale declaration can never manufacture a false
  `finished` for a phase the ledger reopened.
- The rule is per phase, not per change, because the two sources can legitimately
  differ phase-by-phase (notably the append-then-document-write window in the
  M0-S10 write path: the transition landed while the document write did not).
  A registry-first policy with a whole-change fallback would have to express
  this same per-phase rule anyway, while a record-required policy would fail
  every declaration-only change.

**Registry read semantics** are presence-tolerant but verification-strict:

- The whole store is verified first through the state layer (framing,
  sequence, checksum, schema). Any store-level verification failure, or a
  corrupt per-change payload for the verified change, is a classified `state.*`
  failure — the evidence is untrustworthy, so no change is verified from it.
- An absent per-change record in an otherwise verified store is *no evidence*
  (`present: false`), not `state.keys.missing`.
- A store that does not exist at all is a verified-empty store, also no
  evidence.
- The derived `phase-state.<REF>.json` projection is **not** read as evidence.
  It is a disposable projection; verification folds the verified ledger
  directly, so a stale or missing projection cannot change the verdict.

Worked examples:

| Declaration | Registry for the phase | Effective completion |
|---|---|---|
| `completed: 2026-10-31T…` | no record | completed |
| `completed: null` | no record | open |
| key absent | no record | open (and named via `lint.phases.incomplete`) |
| `completed: 2026-10-31T…` | latest transition `reopen` | open (registry wins) |
| `completed: null` or key absent | latest transition `complete` | completed (registry wins) |

### C-4 — Delivery result enum (binding vocabulary)

The enum is `as const` data in `core ./contracts` — one home, never re-declared
in the CLI or domain. Order is the bash usage order.

| Token | Bash-era meaning | M0-S8 derivation | Identity source | Projection | Exit |
|---|---|---|---|---|---|
| `merged` | Issue closed or a branch-scoped merged PR | **Reserved** — tracker/PR evidence (M0-S19/M1-S9) | none in M0-S8 | `success` | `0` |
| `blocked` | Blocked label present | **Reserved** — tracker evidence | none | `success` | `0` |
| `pr-open` | Open PR resolved for the branch/ref | **Reserved** — PR evidence | none | `success` | `0` |
| `pr-open-unverified` | Open PR but its URL could not be resolved | **Reserved** — PR evidence | none | `success` | `0` |
| `finished` | PM finished / complete artifact ledger | All required phases of the declared variant completed (declaration + registry overlay) | success envelope | `success` | `0` |
| `failed` | Classification failed / delivery failure | Document-conformance failure (`lint.notes.malformed`, `lint.keys.missing`, `lint.variant.unknown`, `lint.target.missing`, `input.value.rejected`) or a user-category `state.*` failure | the pinned identity | `user-validation` | `1` |
| `max-restarts` | Restart budget exhausted | **Reserved** — dispatch/session evidence (M1-S9) | none | `user-validation` | `1` |
| `state-unverified` | Delivery state could not be verified (bash: tracker poll failed) | Platform-category registry/store failure (`state.store.torn`, `state.schema.mismatch`, `state.keys.missing`) | the specific `state.*` identity | `platform-provider` | `2` (see DEC-5) |
| `partial` | Incomplete artifact ledger | Required phase(s) not completed after overlay: absent from the declaration → `lint.phases.incomplete`; declared but not completed → `verify.ledger.incomplete` | one of those identities | `user-validation` | `1` |
| `noop-lane-permission` | Headless permission auto-reject, no work landed | **Reserved** — dispatch/session + lane-log evidence | none | `user-validation` | `1` |
| `noop-lane-nothing-to-do` | Nothing was attempted in the lane | **Reserved** — tracker/dispatch evidence | none | `success` | `0` |

The taxonomy is total over all eleven tokens: each has exactly one projection
class and one derivation class (`verify`, `tracker-pr`, or
`dispatch-session`). The M0-S8-reachable subset is exactly
`finished`, `partial`, `failed`, `state-unverified`; the other seven are
declared and reserved. Reserving a token never makes it reachable, so no
tracker-derived success can leak into a ledger-only verdict.

Pinned derivation mapping: `verify` → `finished`, `partial`, `failed`,
`state-unverified`; `tracker-pr` → `merged`, `blocked`, `pr-open`,
`pr-open-unverified`; `dispatch-session` → `max-restarts`,
`noop-lane-permission`, `noop-lane-nothing-to-do`.

`finished` means the declared variant's ledger is complete — a necessary, not
sufficient, condition for merge. Unlike the bash artifact probe (which required
commits ahead of base and consulted only the `delivery` phase), M0-S8 checks the
declared variant's full required set; commit, CI, push-parity, and owner-gate
evidence remains M0-S9's job, so a complete ledger never substitutes for the
merge gates.

The `failed` token for user-category `state.*` rows is deliberate: a
permission or unsupported-level failure is user-fixable and projects to exit
`1`, so it cannot masquerade as a platform-unverified outcome.

### C-5 — Exit taxonomy and projection

Exit digits exist only in the CLI projection module. The taxonomy declares a
projection class per token; the projection module maps the class to `{0, 1, 2}`.

| Result token | Projection class | CLI exit | Bash exit | Divergence |
|---|---|---|---|---|
| `merged` | `success` | `0` | `0` | — |
| `blocked` | `success` | `0` | `0` | — |
| `pr-open` | `success` | `0` | `0` | — |
| `pr-open-unverified` | `success` | `0` | `0` | — |
| `finished` | `success` | `0` | `0` | — |
| `failed` | `user-validation` | `1` | `1` | — |
| `max-restarts` | `user-validation` | `1` | `1` | — |
| `state-unverified` | `platform-provider` | `2` | `1` | **Deliberate** — DEC-5 |
| `partial` | `user-validation` | `1` | `1` | — |
| `noop-lane-permission` | `user-validation` | `1` | `1` | — |
| `noop-lane-nothing-to-do` | `success` | `0` | `0` | — |

Broken invocations are outside the delivery-result taxonomy. Bash exits `2` for
a usage error; the typed CLI rides the binding result contract, where
`fallback.invocation` is `user-validation` and exits `1` (existing behavior,
unchanged by this change). Grammar failures inside `verify` use
`input.value.rejected` (also exit `1`).

Envelope exclusivity is preserved: `finished` is the only token rendered as
success `data`; every other reachable token is rendered as an error envelope
whose identity's projection class yields the exit. The result token appears in
the failure summary (C-6), not as an envelope field, so the v1 envelope shape is
unchanged.

### C-6 — Classification summary contract

Failure summaries are deterministic and machine-consumable:

```
result=<token>; variant=<full|lite|unknown>; missing=<comma-separated ids | ->[; detail=<one-line>]
```

- `variant` is `unknown` for parse/key/value-type/unknown-variant/missing-target
  and grammar failures; it is the effective variant once the variant family
  passes.
- `missing` is `-` for every non-`partial` outcome. For `partial` it lists the
  missing required phases in required-set order, comma-separated with no spaces.
- The optional trailing `; detail=<one-line>` carries the safe, deterministic
  detail of a `lint.*` malformed/keys finding (detail and location) or a
  `state.*` failure (the row summary). It is absent for `partial`, unknown
  variant, missing target, and grammar failures, so those summaries are exactly
  three segments. Newlines are collapsed; no raw document bytes or parser
  output ever enters it.
- Summary text is prose, never identity; identity remains `error.code`. When a
  `partial` verdict reuses `lint.phases.incomplete`, verify supplies the C-6
  summary in place of the lint default; the identity stays the lint code.

Success `data` carries the same tuple in structured form (`result`, `variant`,
`missingPhases`, plus `requiredPhases` and `completedPhases`), so success
consumers never parse prose:

```
{
  changeRef,                  // the verified change ref
  target: "change",
  result: "finished",
  variant: "full" | "lite",
  requiredPhases: [ ... ],    // required-set order
  completedPhases: [ ... ],   // required-set order
  missingPhases: [],          // always empty on success
  evidence: {
    declaration: { completedCount, requiredCount },
    registry: { present, verifiedEmpty, recordCount, transitionCount,
                overlaidPhases: [ ... ] }
  }
}
```

`overlaidPhases` names the required phases whose completion the registry
decided, which is the audit trail for the C-3 precedence rule.

### C-7 — Malformed notes never crash

The verifier reuses `lintPmNotes`; it never re-implements conformance. The
fixed rule order (parse → keys → value types → variant → required-phase
presence) is the verifier's decision order:

| Class | Detected by | Identity |
|---|---|---|
| Unparseable document | parser / parse family | `lint.notes.malformed` |
| Missing required top-level key | keys family | `lint.keys.missing` |
| Missing required phase entry field (`started`/`completed`) | keys family | `lint.keys.missing` |
| Missing collection `text` | keys family | `lint.keys.missing` |
| Wrong-typed declared value | value-type family | `lint.notes.malformed` |
| Unknown `variant` string | variant family | `lint.variant.unknown` |
| Required phase key absent | phase-presence family | `lint.phases.incomplete` (after registry overlay) |
| Missing pm-notes target | target resolution | `lint.target.missing` |

A required-phase-presence finding is the only lint finding that is not terminal
on its own: the verifier reads registry evidence before deciding, because a
landed transition may account for a phase whose document write is stale. If,
after the overlay, a required phase is still absent from the declaration, the
verdict is `lint.phases.incomplete` (absence precedence over completion); if
every remaining missing phase is declared but not completed, the verdict is
`verify.ledger.incomplete`. Both are `partial`, exit `1`.

Document-shape phase failures reuse `lint.phases.incomplete`; delivery
incompleteness in an otherwise conformant document is verify's verdict, not
lint's.

All other lint and target findings are terminal before any registry read: the
document is not trustworthy (or its required set is undecidable), so the
verifier classifies and stops.

**Classification precedence** when classes co-occur: document-conformance and
grammar failures (outcome `failed`) are decided before any registry read;
then a registry read failure (`state-unverified` or user-category `failed`) is
decided before the final missing-phase verdict, because the unread ledger could
complete the change; only then is `partial` decided. This ordering is total and
deterministic for every fixture.

### C-8 — Error identities

One additive row joins the error table under a new `verify` domain kind,
shipped with its documented row in the same change because the two-way sync is
binding. Existing rows are untouched.

| Code | Kind | Category | Retryable | Consequence | Projection class | Token | Summary |
|---|---|---|---|---|---|---|---|
| `verify.ledger.incomplete` | `verify` (new kind) | user | false | not_landed | user-validation | `partial` | The declared variant's required phases are not all completed. |

Remediation hint: "Complete the named required phases of the declared variant through the phase command, or correct the declaration, then re-run verify."

Reused identities, unchanged:

| Code | Token | Exit | Role in verify |
|---|---|---|---|
| `lint.notes.malformed` | `failed` | `1` | Unparseable / structure / value-type failure. |
| `lint.keys.missing` | `failed` | `1` | Missing required key. |
| `lint.variant.unknown` | `failed` | `1` | Unknown variant value. |
| `lint.phases.incomplete` | `partial` | `1` | Required phase still absent after registry overlay. |
| `lint.target.missing` | `failed` | `1` | No pm-notes target for the ref. |
| `input.value.rejected` | `failed` | `1` | Verify handler grammar rejection. |
| `state.store.torn` | `state-unverified` | `2` | Store verification failed. |
| `state.schema.mismatch` | `state-unverified` | `2` | Store schema unsupported. |
| `state.keys.missing` | `state-unverified` | `2` | Corrupt transition payload / key-set assertion. |
| `state.permission.denied` | `failed` | `1` | Read permission failure (user-fixable). |
| `state.level.unsupported` | `failed` | `1` | Declared level without an implementation (not reachable on the local read path today, but total). |
| `fallback.internal` | — (no token) | `2` | Only for genuinely unclassifiable failures; never for a documented class. |

Justification for the new kind: `lint` owns document conformance, and a
conformant document whose delivery is incomplete is not malformed; `state` owns
storage integrity, and a healthy store is not a failure. Reusing
`lint.phases.incomplete` for a declared-but-incomplete phase would conflate
conformance with evidence and erase the repository's pinned lint-vs-verify
distinction. One `verify` row, with the same structured fields as every other
row, keeps the classification chain honest and gives M0-S9/M1-S9 a namespace
for later verify verdicts.

Documented-table impacts to reconcile (binding sync check):

- `doc/spec/features/feature-result-contract.md`: add `verify` to the declared
  domain kinds and add the `verify.ledger.incomplete` row to the documented
  table in the same delivery phase as the code row (the sync check fails
  otherwise). Phase 7 reconciles the surrounding classification-chain prose.
- `doc/spec/features/feature-pm-notes-lint-and-phase-transitions.md` and
  `doc/spec/features/feature-state-layer.md`: name verify as a read-only
  consumer of lint rules, the ledger, and verified reads.
- `doc/overview/glossary.md` and `doc/guides/change-lifecycle.md`: new terms and
  the variant-aware finalization note.
- New current-truth doc: `doc/spec/features/feature-verify-change-and-exit-taxonomy.md`.

## Outcome & Classification Flows

```
verify change <ref>
  │
  ├─ 1. Parser: `verify` with ≤2 positionals and known flags? ── no ──▶ fallback.invocation · 1
  │      Handler grammar: exactly ["change", <ref>]? ─────────── no ──▶ input.value.rejected · failed · 1
  │
  ├─ 2. Locate/read/parse pm-notes ── missing ──▶ lint.target.missing · failed · 1
  │                                └─ parse fail ─▶ lint.notes.malformed · failed · 1
  │
  ├─ 3. Pure lint (parse→keys→types→variant→phases)
  │      ├─ malformed/keys/unknown-variant finding ─▶ that lint identity · failed · 1
  │      └─ phases.incomplete finding ──▶ remember absent set; continue
  │
  ├─ 4. Effective variant + required set (full | lite)
  │
  ├─ 5. Presence-tolerant verified registry read
  │      ├─ platform state failure ─▶ state.* · state-unverified · 2
  │      └─ user state failure ─────▶ state.* · failed · 1
  │
  ├─ 6. Completion merge (declaration, overridden per phase by registry)
  │      missing = required phases whose effective completion is null
  │
  └─ 7. Classify
         ├─ missing empty ─────────────▶ data: finished · 0
         ├─ absence remains ───────────▶ lint.phases.incomplete · partial · 1
         └─ declared-but-incomplete ───▶ verify.ledger.incomplete · partial · 1
```

Outcome classes:

- **Verified:** one success envelope, `result: finished`, exit `0`.
- **Incomplete:** one failure envelope, `partial`, exit `1`, missing phases
  named; no `data`.
- **Unclassified input:** one failure envelope, `failed`, exit `1`; no `data`.
- **Unverifiable evidence:** one failure envelope, `state-unverified`, exit `2`
  (platform rows); no `data`.
- **Broken invocation:** `fallback.invocation` (parser-level) or
  `input.value.rejected` (handler grammar), exit `1`; no reads.

Every path produces exactly one valid envelope; every non-verified path is
non-zero. That is the false-success guarantee.

## Technical Architecture & Codebase Map

### High-level design

The change follows the established tier split:

1. **Data-only contracts** — the token vocabulary, the per-token taxonomy, and
   the new error row live in `core ./contracts` as types and `as const` data.
   No behavior, no I/O.
2. **Pure domain rules** — variant resolution, declaration/registry completion
   merge, missing-phase ordering, and identity/token selection live in
   `core ./domain` as pure functions over parsed documents and transition
   records. No file access, no clock, no parser, no runtime API.
3. **State tier** — a presence-tolerant verified transition read composes the
   existing state port and reuses the existing fold; the derived projection is
   not read. No runtime API is introduced.
4. **CLI surface and edge** — the command definition follows the `lint`/`phase`
   registration precedent; the runtime-aware edge reads pm-notes and the
   registry and injects them. The CLI owns envelope rendering, classification,
   and exit projection; the command never writes a stream or chooses an exit.

| Path | Status | Role in this change |
|---|---|---|
| `packages/core/src/contracts/delivery-result.ts` | New | The eleven tokens and the per-token taxonomy (projection class, derivation class) as data; the M0-S8-reachable subset; types. |
| `packages/core/src/contracts/error-table.ts` | Extends | `verify` joins `DOMAIN_KINDS`; the `verify.ledger.incomplete` row is added. |
| `packages/core/src/contracts/index.ts` | Extends | Re-exports the new result vocabulary and types. |
| `packages/core/src/contracts/pm-notes.ts` | Consumed, unchanged | Canonical phases, default variant, per-variant required sets, lint identities. |
| `packages/core/src/contracts/registry.ts` | Consumed, unchanged | Transition record and projection vocabulary. |
| `packages/core/src/domain/pm-notes-lint.ts` | Consumed, unchanged | The fixed-order conformance rules reused by verify. |
| `packages/core/src/domain/verify-change.ts` | New | Pure classification: effective variant, declaration/registry merge, ordered missing set, identity and token selection, summary tuple. |
| `packages/core/src/domain/index.ts` | Extends | Exports the new pure classifier. |
| `packages/core/src/index.ts` | Extends | Re-exports the pure classifier beside `lintPmNotes` for the CLI surface. |
| `packages/core/src/state/registry.ts` | Extends | Presence-tolerant verified transition read (absent per-change record → no evidence) plus reuse of `foldPhaseState`. |
| `packages/core/src/state/index.ts`, `ledger.ts` | Consumed, unchanged | Verified-read substrate, tear detection, evidence classes. |
| `packages/adapters/src/file/pm-notes-parser.ts` | Consumed, unchanged | Target location, bounded YAML 1.2 core parse, safe parse failure. |
| `packages/cli/src/commands/verify.ts` | New | `verify change` definition, grammar, injected runtime types, data/error shaping. |
| `packages/cli/src/commands/index.ts` | Extends | Exports the new command definition and runtime types. |
| `packages/cli/src/edge.ts` | Extends | Composes the verify runtime into `createConfigProgram` beside `config`, `lint`, and `phase`. |
| `packages/cli/src/classify.ts`, `projection.ts` | Consumed, unchanged | Classification chain and the only `{0, 1, 2}` digits. |
| `packages/cli/src/index.ts` | Consumed, unchanged | Invocation parsing, envelope construction, top-level containment. |
| `packages/core/src/state/driver/`, `packages/cli/src/output/` | Consumed, unchanged | The only runtime edges and the single serializer/redaction path. |
| `scripts/checks/error-table-sync.ts` | Consumed, binding | Table/document/fixture agreement for the new row and kind. |
| `tests/behaviour/verify-*.test.ts` + `tests/behaviour/verify-support.ts` | New | In-process classification, rejection, overlay, envelope, and determinism suites. |
| `tests/structure/delivery-result-contract.test.ts`, `verify-imports.test.ts` | New | Enum/taxonomy totality and bash-reference binding; tier/import rules. |
| `tests/fixtures/verify/**` | New | Full/LITE/overlay/malformed/state fixtures and real-corpus references. |

### Invariants

- **Tier:** contracts carry data and types only; domain imports contracts only;
  the state tier imports contracts and its own state modules; runtime I/O stays
  in the adapter and CLI edges; no new runtime-API location and no new runtime
  dependency.
- **Single enum home:** the eleven tokens are declared once in contracts; no
  other production module declares a token list. Tests may hold an oracle and
  the bash reference remains the external contract.
- **Read-only:** no write call, no fence acquisition, no projection rebuild, no
  target file mutation, no network, no process spawn.
- **Evidence precedence:** registry overrides declaration per mentioned phase;
  absent registry evidence never becomes negative evidence or a state error.
- **Envelope exclusivity:** only `finished` yields `data`; every other reachable
  token yields `error`; no path carries both or neither.
- **Exit projection:** digits live only in the projection module; the taxonomy
  declares classes; every reachable token's exit is in `{0, 1, 2}`.
- **Determinism:** ordering comes from contract arrays, not from map iteration;
  no clock, randomness, or environment read in the domain; identical inputs
  yield identical output bytes.
- **Brand neutrality:** no product or binary literal enters the new modules; the
  command needs no brand value beyond the injected context.

## Non-Functional Requirements

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Runtime neutrality and tier conformance: contracts carrying behavior or I/O; domain importing anything but contracts; new runtime-API locations; runtime-conditional branches in contracts/domain | 0 / 0 / 0 / 0 — all boundary, ambient, and dependency-cruiser gates green |
| NFR-2 | Machine-output validity: verify invocations returning exactly one valid envelope under `--json`; exits outside `{0, 1, 2}`; user-category failures not projecting to `1`; platform-category not projecting to `2` | 100% of fixture runs valid / 0 / 0 / 0 |
| NFR-3 | Non-zero guarantee: exit-`0` outcomes for incomplete, malformed, missing-target, or unverifiable fixtures; failure envelopes carrying `data`; documented classes contained as `fallback.internal` | 0 / 0 / 0 — the false-success class is provably empty over the fixture matrix |
| NFR-4 | Determinism and read-only behavior: verdict/summary drift across replays; bytes written; fences acquired; network calls; child processes spawned | 0 drift / 0 bytes / 0 fences / 0 calls / 0 spawns |
| NFR-5 | Taxonomy binding: tokens equal to the bash usage enum (set and order); tokens with exactly one taxonomy row; tokens without a valid projection class; M0-S8-reachable subset drift | 11/11 / 11/11 / 0 / 0 |
| NFR-6 | Error-table binding: the new `verify` row round-tripping with its documented row; two-way documented-table drift; existing rows modified; ambiguous kind-only `verify` selection | 1/1 / 0 / 0 / 0 (verify always classifies by exact code) |
| NFR-7 | Real-corpus correctness: crashes or unclassified fallbacks over the pinned real committed-change fixtures (GH-179, GH-170, GH-171); incorrect tokens on those fixtures | 0 / 0 — pinned as permanent tests |

## Quality Assurance Strategy

### Test levels and locations

| Level | Location | Scope |
|---|---|---|
| Behaviour — classification | `tests/behaviour/verify-change-classification.test.ts` | AC-V1, V2, V6, V12: full/LITE complete and incomplete, overlay precedence, ordering, success tuple. |
| Behaviour — rejections | `tests/behaviour/verify-change-rejections.test.ts` | AC-V3, V4, V5, V14: every malformed class, unknown variant, missing target, grammar, each pinned to one identity. |
| Behaviour — evidence failure | `tests/behaviour/verify-change-state.test.ts` | AC-V7: torn/schema/key-set/permission registry failures, token and exit, no success envelope. |
| Behaviour — envelope and determinism | `tests/behaviour/verify-envelope.test.ts` | AC-V9, V10, V13: envelope exclusivity, exit matrix, replayed bytes, zero writes/fences/spawns. |
| Behaviour — real corpus | `tests/behaviour/verify-corpus.test.ts` | AC-V11: GH-179 finished, GH-170 partial, GH-171 malformed, against the committed files. |
| Structure — enum/taxonomy | `tests/structure/delivery-result-contract.test.ts` | AC-V8, NFR-5: bash usage enum extraction, 11/11 totality, unique rows, valid classes, derivation subset. |
| Structure — tier/imports | `tests/structure/verify-imports.test.ts` | NFR-1: contracts data-only, pure domain, no new runtime location, no brand literals. |
| Checks — error table | `tests/checks/error-table-sync.test.ts` (extended) | NFR-6: new row/doc/fixture agreement, two-way drift, containment. |
| Boundaries | existing `tests/boundaries/**` suite | Tier and runtime-edge rules extended to the new modules; no new rule needed. |

### Test data and scenarios

- **Synthetic fixtures** under `tests/fixtures/verify/`: complete full, incomplete
  full (one fixture per missing phase), complete LITE, incomplete LITE (one per
  required phase), LITE with the five non-LITE phases null, unknown variant,
  each malformed class, missing target, grammar variants.
- **Overlay fixtures**: declaration-completed plus registry reopen;
  declaration-incomplete plus registry complete; declaration-absent plus
  registry complete; declaration-match control; store with only another ref's
  records.
- **State fixtures**: torn tail, schema mismatch, corrupt transition payload,
  permission denial — built with the existing state harness, read-only.
- **Real-corpus fixtures**: the committed GH-179, GH-170, and GH-171 pm-notes,
  read in place; assertions are read-only.
- **Negative controls are non-vacuous**: every rejection fixture asserts the
  detection and the absence of the incorrect outcome (no `data`, no exit `0`,
  no `fallback.internal`). Positive controls assert each complete variant
  passes and each ignored non-required phase never appears in `missing`.
- **Determinism controls**: two identical runs over the same bytes and injected
  registry facts; a reversed declaration key order yields the same ordered
  output.

## Dependencies & Risks

- **Depends on GH-174 (M0-S5, state layer)** for verified reads, tear detection,
  evidence classes, and the append-only ledger substrate.
- **Depends on GH-179 (M0-S10)** for the pm-notes schema and pinned variant sets,
  the pure lint rules and `lint.*` identities, the `phase.transition` registry
  records, the fold semantics, and the write-time ledger authority.
- **Depends on GH-172 (result contract)** for the envelope, the error table, the
  classification chain, the `{0, 1, 2}` projection, and the binding
  documented-table sync.
- **Depends on ADR-0003** for package tiers and runtime-API confinement.
- **Consumed by M0-S9** (`verify gates` lifecycle-finalization gate), **M1-S9**
  (dual-run evidence), and **M1-S7**.

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Evidence-source confusion: a change that never called `ados phase` reads as incomplete because the registry is empty | H | M | The C-3 overlay makes declaration the fallback and absence no-evidence; AC-V12 and the GH-179 real-corpus fixture pin it; the presence-tolerant read removes the `state.keys.missing` trap. | L |
| RSK-2 | Stale declaration masks a reopen, producing a false `finished` | H | L | Registry evidence overrides the declaration for every mentioned phase (C-3, AC-V12); a reopen is never overwritten by a hand edit. | L |
| RSK-3 | Exit taxonomy diverges from bash and breaks dual-run numeric comparison | M | M | Only `state-unverified` diverges (1 → 2); the divergence is declared in C-5/DEC-5; dual-run compares tokens, which are identical; a structure test binds the enum to the bash usage line. | L–M |
| RSK-4 | A consumer treats a failure envelope's presence as success, or parses prose for the verdict | M | L | Every non-verified outcome is an error envelope with a non-zero exit; success carries structured fields; the summary grammar is pinned and tested; `verify` is the only source of the tuple. | L |
| RSK-5 | Enum drift between contracts and the bash summary as either side changes | M | M | AC-V8 structure test extracts the bash usage enum and fails closed; the documented table is part of the same change. | L |
| RSK-6 | Error-table drift for the new kind/row | M | L | The row and its documented row ship in the same delivery phase; two-way sync and containment checks are binding; `verify` always classifies by exact code. | L |
| RSK-7 | LITE under-declaration hides an unfinished heavyweight phase | M | M | Verify records the effective variant and missing set in evidence; LITE must be explicit (GH-179); the owner sees the variant at PR review; verify never infers LITE from omission. | L–M |
| RSK-8 | Verify becomes a de facto merge gate before `verify gates` lands | L | M | The command is read-only and scoped to ledger evidence; M0-S9 composes it as one cited gate; no CI wiring is added here. | L |

## Assumptions

- The pm-notes locator resolves one document per change ref under the
  change-artifact convention (the first in stable month/folder order if
  duplicates exist); a ref with zero targets is `lint.target.missing`.
- The v1 state level is local; a verified-empty store means no local transition
  history exists. Cross-machine or shared ledgers are out of scope (NG-8).
- `scripts/deliver-ticket.sh` remains present through the M1-S9 dual-run period
  as the normative reference for the eleven tokens; if it moves, the binding
  test fails closed and must be updated deliberately.
- The M0-S10 write path updates pm-notes and the registry together on a
  landing; the append-then-document-write window is the known divergence case
  the overlay resolves.
- The pinned LITE six-phase set is unchanged by this change.
- Tracker/PR adapters are unavailable until M0-S19, so reserved tokens are
  declared, not derived.

## Open Questions

None blocking. All evidence-precedence, identity, summary, and exit-taxonomy
questions are resolved as change-scoped decisions below. DEC-5 is
precedent-setting across the CLI (token parity, exit projection), so a decision
record is recommended; ratification is not required before delivery because
the decision is reversible and encoded as data plus one documented row.

## Decision Log

| ID | Decision | Rationale | Rejected alternatives |
|----|----------|-----------|-----------------------|
| DEC-1 | Verify is ledger-only, read-only, and network-free; tracker/PR evidence is M0-S19/M1-S9. | The ticket's scope and the PM boundary; keeps the false-success killer small and honest about what it can know. | Collecting tracker/PR evidence now (scope creep; no adapter yet); mutating/repairing notes (not verification). |
| DEC-2 | Surface is exactly `ados verify change <ref>`, composed through `createConfigProgram`, with no command flags. | Matches the command registry and the `lint`/`phase` precedent; `--json` is already global. | Top-level `verify-change`, flags for variant or target selection. |
| DEC-3 | The eleven bash summary tokens are `as const` data in `core ./contracts`, with a per-token taxonomy; no other production module declares them. | Dual-run comparison requires identical vocabulary; single source prevents drift. | Duplicating tokens in the CLI; parsing the bash script at runtime. |
| DEC-4 | Per-phase precedence: registry transition overrides the declaration for phases it mentions; declaration is the fallback for unmentioned phases; an absent per-change record is no evidence. | Preserves write-time truth without misclassifying declaration-only changes; explains GH-179's real corpus. | Registry-first with whole-change fallback (same per-phase rule, more failure modes); registry-required (breaks every pre-write-path change); declaration-only (lets a stale declaration mask a reopen). |
| DEC-5 | `state-unverified` projects to `platform-provider` → exit `2`; bash's exit `1` is not reproduced. Token parity is the dual-run comparison unit. | Exit codes are a projection of the identity table (binding); a platform read failure is not user input; reproducing bash numerically would require an exit override outside the projection module. The non-zero guarantee is preserved (`2 ≠ 0`). **Recommend a decision record** ratifying token-level parity CLI-wide. | Bash-parity exit `1` (breaks the projection invariant); a special-case exception in the verify handler (duplicates exit policy). |
| DEC-6 | Incomplete is a failure envelope with `verify.ledger.incomplete`; never success data with a non-zero exit. | A success envelope always projects to exit `0`; returning data with an error exit would require an envelope contract change and would let presence-based consumers read partial as success. | Data envelope plus exit override; silent success with warnings. |
| DEC-7 | Missing phases reach consumers through the pinned summary grammar on failure and structured fields on success; no envelope field is added. | Additive, v1-compatible, deterministic, and sufficient for agents; avoids a schema change and unbounded per-phase codes. | Adding `details`/`missingPhases` to the error object; one error code per phase. |
| DEC-8 | Reuse `lint.*` for document conformance, `state.*` for registry integrity, and add one `verify` kind/row for the valid-document-incomplete-delivery verdict. | Keeps the lint-vs-verify and state-vs-verdict distinctions; minimal additive surface. | Overloading `lint.phases.incomplete`; a `verify` row per outcome class. |
| DEC-9 | Required sets are read from `PM_NOTES_REQUIRED_PHASES_BY_VARIANT`; absence of `variant` means `full`; unknown variant is a lint finding. | GH-179 pinned the sets; re-declaration would drift. | A verify-local phase table; inferring LITE from omission. |
| DEC-10 | The derived `phase-state.<REF>.json` projection is not evidence; verification folds verified transition records. | The projection is disposable and could be stale or absent while the ledger is truth. | Reading the projection (masks ledger truth); requiring it (breaks every decl-only change). |
| DEC-11 | Bash usage exit `2` is not reproduced; broken invocations ride `fallback.invocation` → exit `1`, and verify grammar failures use `input.value.rejected`. | Existing binding result contract; consistency with `lint`/`phase`. | A verify-only usage exit `2` (new exit policy). |

## Rollout & Change Management

- **Additive delivery**: a new command, a new contracts module, one additive
  error row, and tests. No existing command behavior changes; no store format,
  pm-notes schema, or variant-set change.
- **Adoption**: the coordinator can call the command immediately; lifecycle
  agent prompt adoption is a separate operating-model change (NG-7).
- **Dual-run**: M1-S9 compares the typed token with the bash summary token; the
  only known numeric divergence is `state-unverified` (DEC-5), documented for
  the evaluator.
- **Documentation**: the new current-truth feature spec lands in-change; the
  error-table row and domain-kind prose are reconciled with the code in the same
  delivery phase; phase 7 reconciles the glossary, lifecycle guide, and consumer
  sections.
- **Rollback**: removing the command and the additive row restores the prior
  surface; no data was written, so no migration or cleanup is required.

## Data Migration / Seeding

Not applicable. Verify reads committed pm-notes and the existing local state
store; it creates no records, changes no schema version, and requires no seed
data.

## Privacy / Compliance Review

Not applicable beyond existing repository data handling. Verify reads local
repository text and local state, performs no network access, collects no
telemetry, and emits no secret material; existing parser bounds and the
serialization redaction path are unchanged.

## Security Review Highlights

- **Read-only by construction**: no write/fence API is called; the command
  cannot mutate an artifact.
- **Untrusted input**: pm-notes YAML is parsed by the existing bounded parser
  (size/node/depth/alias limits); parse failures are classified, never raw
  parser output.
- **No ambient or remote access**: no environment read, no clock, no
  randomness, no network, no process spawn in the verification path.
- **No credential surface**: no credential port use; summaries and evidence
  carry counts, ids, classes, and safe locations only, never secret material.
- **Path safety**: target location is the existing adapter locator; the verify
  command adds no path construction.
- **Denial-of-service**: classification is linear over the required set
  (eleven max) and the transition history length; no unbounded recursion.

## Maintenance & Operations Impact

- Adding a variant later requires only updating the pinned contracts data; verify
  inherits it with no code change.
- Adding a future evidence collector (M0-S19/M1-S9) requires a derivation
  update for the reserved tokens, not a token rename; the taxonomy test forces
  every token to keep exactly one row.
- The bash enum binding test is the early-warning signal for vocabulary drift;
  it fails closed if the reference disappears.
- The one new error row and `verify` kind are visible in the documented table and
  the glossary; the sync check keeps them honest.
- Operational surface stays small: one read-only command, no daemon, no
  background process, no new configuration knob.

## Glossary

| Term | Definition |
|---|---|
| Delivery result tuple | The classified verification outcome: result token, effective variant, ordered missing phases, and evidence. |
| Delivery result enum | The eleven bash-era tokens adopted as the single typed vocabulary for delivery outcomes. |
| Exit taxonomy | The total mapping from a result token to a projection class and the CLI's `{0, 1, 2}` exit. |
| Verify (vs. lint) | Verify assesses delivery evidence against the declared ledger; lint validates document conformance. Lint output never substitutes for verify. |
| Change variant | The declared lifecycle shape: `full` (eleven canonical phases) or `lite` (pinned six); absence means `full`. |
| Required phase set | The phases the effective variant must complete, in evaluation order. |
| Declaration evidence | The pm-notes `phases` map; a required phase is declared completed when `completed` is a non-null timestamp. |
| Registry evidence | The verified `phase.transition` history folded to per-phase completion. |
| Overlay precedence | Per-phase rule: registry decides a phase it mentions; declaration decides the rest. |
| Reserved token | A declared token whose derivation needs evidence outside M0-S8's ledger-only scope. |
| Presence-tolerant read | A verified registry read that treats an absent per-change record as no evidence rather than a key-set failure. |
| Verification summary | The deterministic failure summary `result=…; variant=…; missing=…`; prose, never identity. |

## References

- Ticket: [GH-177 — M0-S8: verify change and exit taxonomy](https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/177).
- Decision record: [TDR-0005 — Delivery result enum and CLI exit taxonomy](../../../decisions/TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md) (ratifies DEC-5/DEC-11 token parity and the `state-unverified` projection).
- Backlog: `doc/planning/oss-tooling/backlog.md` (M0-S8; M0-S9/M0-S10 context).
- Command registry: `doc/planning/oss-tooling/cli-command-registry.md` (`ados verify change`, lint-vs-verify terminology, exit status).
- User journeys: `doc/planning/oss-tooling/user-journeys.md` (journey step 5; phase 10 `dod_check`).
- Result contract: `doc/spec/features/feature-result-contract.md` (envelope, error table, `{0, 1, 2}`, documented-table sync).
- pm-notes lint and phase transitions: `doc/spec/features/feature-pm-notes-lint-and-phase-transitions.md` (schema, variant sets, lint identities, registry records, fold, write path).
- State layer: `doc/spec/features/feature-state-layer.md` (verified reads, tear detection, evidence).
- Scaffold and tiers: `doc/spec/features/feature-monorepo-scaffold-toolchain.md`; [ADR-0003](../../../decisions/ADR-0003-oss-monorepo-structure.md).
- Branding seam: `doc/spec/features/feature-branding-seam.md`.
- Change lifecycle: `doc/guides/change-lifecycle.md` (canonical eleven phases, variant rule).
- Bash-era reference: `scripts/deliver-ticket.sh` — usage enum, `print_delivery_summary`, `classify_result`, `classify_artifact`.
- Format exemplar: `doc/changes/2026-10/2026-10-31--GH-179--pm-notes-registry-lint-phase-transitions/chg-GH-179-spec.md`.

## Revision Log

- **v1.1 (2026-10-31)** — DoR iter-1 amendment. The `verify.ledger.incomplete`
  remediation hint is pinned to one brand-neutral exact string (the phase
  command, not a product literal) so the additive machine row and its documented
  row in `feature-result-contract.md` are shippable under the forbidden-literal
  scan and byte-for-byte error-table sync. C-3 now defines "mentioned" as
  present in the folded registry state (a phase the `foldPhaseState` result has
  an entry for), consistent with a reopen that has no prior completion leaving
  no entry. No AC, identity, token, exit, summary grammar, or codebase-map item
  changed.
- **v1.0 (2026-10-31)** — Initial specification. Pins: ledger-only read-only
  scope; `verify change <ref>` surface; eleven-token enum as contracts data with
  a total projection/derivation taxonomy; variant-aware required sets from the
  pinned GH-179 data; per-phase registry-over-declaration overlay with
  presence-tolerant reads; failure-envelope classification for incomplete
  ledgers with `verify.ledger.incomplete`; one additive `verify` error kind/row;
  deterministic summary grammar; `state-unverified` → exit `2` as a deliberate,
  documented deviation from bash (DEC-5, decision record recommended);
  AC-V1..AC-V14 traced to NFRs and test levels.
