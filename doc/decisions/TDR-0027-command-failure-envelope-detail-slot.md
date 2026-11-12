---
id: TDR-0027
decision_type: tdr
status: Proposed
created: 2026-11-12
decision_date: null
last_updated: 2026-11-12
summary: "Add one additive optional `detail` object to the failure envelope (`CommandResultFailure.detail?: { holder?: string }`, command-declared, present only where a command opts in), so `queue.single-flight` names the live lease's holder identity in a single machine-readable line bounded to 128 characters, while the shared six-field `CommandResultError` keeps its meaning, order, and table derivation, the exit stays the row's projection class (`user-validation` → 1), the success-shaped dispatch `data.error.detail` slot and MCP's `{ ok, error }` payload stay unchanged, and the two delivered shape pins move two-sidedly with the delivery."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os CLI machine envelope (result contract, CLI edge error projection, dispatch admission refusals)"
decision_scope: repo
review_date: null
classification:
  domains: [contracts, architecture, tooling]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: easy
  stakes: medium
  urgency: medium
  uncertainty: low
  blast_radius: team
  recurrence: one-off
governance:
  driver: "@decision-advisor (GH-292 DoR routed the envelope placement to a record; the record is authored before the dependent delivery phase)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-292 PR review; AI does not accept this R2 record"
  contributors:
    - "@pm (GH-292: the decision is made; this record captures the chosen resolution and does not re-open it)"
    - "@spec-writer (GH-292 specification: DM-7, AC-F4-1/AC-F4-2, NFR-6, AC-NFR-5)"
    - "@decision-advisor (repository analysis and this record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-292 PR review — this record changes the shared failure-envelope contract)"
  performers:
    - "@coder (GH-292 Phase 2: the envelope slot, the detail projection through the CLI edge, the single-flight holder value, and the two pin moves)"
    - "@doc-syncer (result-contract page records the optional member)"
  informed:
    - "Every command family that renders a failure envelope (the slot is shared; it is populated only where a command opts in)"
    - "MCP tool-payload consumers (their `{ ok, error }` payload is not widened)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A second command needs a detail member: add it as a declared member of the detail contract with its own bound and test, never as an open key-value map, and never by moving the slot into `CommandResultError`."
  - "A consumer needs the refusal detail on a path whose envelope is neither the CLI `CommandResult` nor MCP's `{ ok, error }` shape: decide that surface's contract explicitly rather than reusing this slot by assumption."
  - "The 128-character bound or the single-line rule proves insufficient for a real holder identity: reopen the bound as a contract change with AC-NFR-5 evidence; do not let the projection truncate silently."
  - "A command wants a failure detail that is not identifier-only (prose, provider payload, diff, or path content): that is a privacy-boundary change (NFR-8), not a detail member."
links:
  related_changes: ["GH-292"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-12--GH-292--queue-lifecycle/chg-GH-292-spec.md"
    - "doc/spec/features/feature-result-contract.md"
  contracts:
    - "packages/core/src/contracts/result.ts"
    - "packages/core/src/contracts/dispatch.ts"
    - "packages/core/src/contracts/error-table.ts"
    - "packages/cli/src/index.ts"
    - "packages/cli/src/projection.ts"
  diagrams: []
  decisions: ["TDR-0005", "TDR-0010", "TDR-0026"]
  experiments: []
  metrics: []
---

# TDR-0027: Command Failure Envelope `detail` Slot for the Per-Ref Single-Flight Refusal

## Context

- **FACT:** The failure envelope is `CommandResultFailure`: exactly `schemaVersion`, `runId`, `exitCode`, `timing`, and `error`, with `data` absent by construction; the success envelope is the same four mandatory members plus `data`. The union carries no top-level `ok`, `command`, or `warnings` (`packages/core/src/contracts/result.ts:49-72`). *(read 2026-11-12)*
- **FACT:** `CommandResultError` is exactly six members — `code`, `category`, `retryable`, `consequence`, `remediationHint`, and optional `summary` — and every member is table-derived or the command's bounded prose (`packages/core/src/contracts/result.ts:36-43`). *(read 2026-11-12)*
- **FACT:** The CLI edge rebuilds the error from the resolved error-table row plus an explicit `summary` and `remediationHint` it reads off the handler's returned failure value; every other handler field is dropped (`packages/cli/src/index.ts:162-172,182-198,293-303`). *(read 2026-11-12)*
- **FACT:** The exit code is `projectExitCode(outcome.entry.projectionClass)` on the failure branch; exit digits exist only in the projection module, where `user-validation` → `1` and `platform-provider` → `2` (`packages/cli/src/index.ts:305-327`; `packages/cli/src/projection.ts:9-24`). *(read 2026-11-12)*
- **FACT:** A lease conflict already returns a `detail` **string** at the app layer — `holder:<id>; lease:<id>; heartbeatAgeMs:<n>; earliestTakeoverAt:<iso>` — but the CLI edge does not read it, so the holder reaches the envelope today only as prose through `summary` (`packages/core/src/app/queue.ts:1239-1245`; `packages/cli/src/index.ts:182-198`). *(read 2026-11-12)*
- **FACT:** The only delivered additive detail slot is `DispatchEnvelopeError`, which is `CommandResultError & { detail?: { kind: "harness" | "config"; code: string; field?: string } }`, and it rides the **success-shaped** dispatch payload at `data.error` (`packages/core/src/contracts/dispatch.ts:284-290,303`). *(read 2026-11-12)*
- **FACT:** Two delivered shape pins assert that no failure envelope carries a detail. The type probe pins `keyof CommandResultError` to exactly six keys and carries `@ts-expect-error` cells asserting the shared error gains neither `detail` nor `field` (`tests/types/dispatch-envelope-detail.type-test.ts:65-85`). The structure pin re-asserts the six-field source shape and asserts, at runtime, that a non-dispatch failure envelope's `error` keys are exactly the six (`tests/structure/dispatch-envelope-detail.test.ts:24-31,82-90,103-116`). *(read 2026-11-12)*
- **FACT:** The runtime conformance validator pins a failure envelope's top-level keys to exactly `schemaVersion`, `runId`, `exitCode`, `timing`, `error`, and the delivered fixture records the same set (`packages/testkit/src/result-conformance.ts:59-60,121-130`; `tests/fixtures/result/envelope-key-set.json:4`). *(read 2026-11-12)*
- **FACT:** The MCP tool payload is its own shape — `McpToolError = CommandResultError` inside `{ ok: false, error }` — and a type probe binds it to the CLI error's six fields (`packages/mcp/src/output/payload.ts:29,35,38`; `tests/types/mcp-payload.type-test.ts:32,60-65`). *(read 2026-11-12)*
- **FACT:** The delivered `queue.lease-conflict` row is `user-validation`, `retryable: true`, `not_landed` → exit `1` (`packages/core/src/contracts/error-table.ts:1192-1200`); the `queue.single-flight` row this change declares joins the same kind with the same projection class and `retryable: true` (GH-292 AC-F7-3), so its exit is the class's, not a literal. *(read 2026-11-12)*
- **FACT:** GH-292 requires `queue.single-flight` with `detail.holder` naming the holder lane (AC-F4-1, AC-F4-2), the additive `detail` object at the envelope root for exactly that refusal (DM-7, §5.1 F-4), a detail bounded to 128 characters and one line (NFR-6), and no credential, session id, provider payload, prompt, diff, or repository content in any new output (NFR-8, AC-NFR-5). `error.detail` is the rejected placement: the shared error keeps its six fields. *(read 2026-11-12; path settled by the PM decision of 2026-11-12)*
- **Why now:** GH-292's admission guard cannot be delivered without deciding where a command-specific holder value lives in a shared, table-derived envelope. The refusal identity, the holder value, the zero-mutation purity, and the three-path parity are unblocked; the *shape* of the machine-readable holder naming is what this record fixes before the dependent delivery phase.

## Problem Framing (Clarified)

The envelope models two things that are not the same: **identity** (what failure this is, resolved from the error table) and **evidence** (which lane holds the ref, known only by the command that refused). `CommandResultError` is deliberately a pure function of its row plus one bounded prose summary, which is what lets a consumer classify a failure without trusting handler-supplied data. `queue.single-flight` needs evidence — a holder identity a caller can act on — and the delivered envelope has nowhere to carry it: the error object is closed, and the one existing detail slot belongs to a different shape (the dispatch success payload's `data.error.detail`, whose union is `harness | config` and cannot name a holder).

So the question is not "how does the refusal name the holder" — prose in `error.summary` already does that — but "where does a command-declared, bounded, machine-readable evidence value live, given that the error object must stay derivable and the success-shaped dispatch slot must stay untouched". Three placements are possible: inside the shared error (widens every command's identity object and forces the six-field pins to be rewritten as an open shape), inside the existing dispatch detail union (changes a delivered slot the spec excludes), or as one optional envelope-level member that only opted-in commands populate.

Root cause versus symptom. The symptom is that a holder is only available as prose; the cause is that the envelope has no evidence channel separate from identity. Fixing the symptom by parsing `summary` would make a human-readable field a machine contract and would break the moment the prose is reworded. Adding the value to `error` would make the shared identity object partly command-defined, so its "derived from the row" property would only hold per command family.

Out of scope, recorded so the boundary is deliberate: no top-level `ok`, `command`, or `warnings`; no change to the success envelope or to the success-shaped `data.error.detail` slot; no open key-value detail map; no second refusal identity for this path; no exit value outside `{0, 1, 2}`; no new decision about MCP's payload shape.

## Constraints (Hard Requirements)

### C-1: The refusal names the holder machine-readably wherever it is produced

- **Statement:** Whenever the `queue.single-flight` refusal is produced — on the dispatch family for any live lease whose recorded ref is the requested ref, and on `queue claim` when another holder holds the requested ref — it carries `detail.holder` equal to the live lease's holder identity, with the same bounded shape on every path, and starts no session and appends no lease, attempt, lane, or queue record. An own-holder same-ref claim is a renewal, not this refusal, and carries no detail.
- **Source:** AC (GH-292 AC-F4-1, AC-F4-2, AC-F4-3, AC-F4-6) + contractual (DM-7, §5.1 F-4) + TDR-0026 DC-2 (the path-specific precedence)
- **Verification:** test (per path: identity, `detail.holder`, zero sessions, zero appends, state unchanged before and after)
- **Negotiable:** no

### C-2: The shared error object stays table-derived and six-membered

- **Statement:** `error` carries exactly `code`, `category`, `retryable`, `consequence`, `remediationHint`, and optional `summary`; every member except `summary` derives from the resolved error-table row, and no command-declared payload is added to the error object.
- **Source:** prior decision (TDR-0005 result contract) + delivered contract pin (`packages/core/src/contracts/result.ts:36-43`)
- **Verification:** test (error key equality; source-shape assertion) + code review
- **Negotiable:** no

### C-3: Exit codes stay derived, never chosen

- **Statement:** The refusal's exit is the projection of the `queue.single-flight` row's `user-validation` class, i.e. `1`; no exit digit appears outside the projection module, and the presence, value, or absence of a detail never changes the exit.
- **Source:** prior decision (TDR-0005 C-1) + AC (GH-292 AC-F7-3, NFR-9)
- **Verification:** test (`exit-code-literals` invariant; refusal exit `1` with and without a detail) + code review
- **Negotiable:** no

### C-4: The delivered envelope surfaces stay untouched

- **Statement:** The success envelope, the four mandatory members, the exactly-one-of-`data`/`error` rule, the success-shaped dispatch `data.error.detail` slot with its `harness | config` union, and MCP's `{ ok, error }` payload keep their delivered shape. No top-level `ok` or `command` is added.
- **Source:** AC (GH-292 §8.1) + prior decision (TDR-0005 C-4) + delivered contracts (`packages/core/src/contracts/result.ts:49-72`; `packages/core/src/contracts/dispatch.ts:284-290`; `packages/mcp/src/output/payload.ts:29-38`)
- **Verification:** test (success and dispatch envelope assertions unchanged; MCP error-shape probe unchanged) + code review
- **Negotiable:** no

### C-5: The detail is bounded and identifier-only

- **Statement:** The refusal detail is a single line of at most 128 characters carrying identifiers only — no credential, token, session id, provider payload, prompt, diff, path content, or repository content.
- **Source:** AC (GH-292 NFR-6, AC-NFR-5) + spec NFR-8
- **Verification:** test (bound and line-count assertions on the rendered detail; a sanitisation scan over the new output path) + code review
- **Negotiable:** no

### C-6: Shape pins move two-sidedly with the delivery

- **Statement:** The type probe that pins the failure shape and the dispatch-envelope detail pin are updated to the new truth in the same commit as the behaviour: each retains its six-field `CommandResultError` assertions, gains the positive envelope-level `detail` assertion, and loses no `@ts-expect-error` cell and no exact-key equality.
- **Source:** prior decision (TDR-0026 C-1 discipline; GH-292 DEC-14) + internal standard (two-sided pin moves)
- **Verification:** test (`pnpm typecheck` green; both pins assert the new and the retained truth) + code review
- **Negotiable:** no

**Table stakes.** C-7 (no new package, workspace subpath, provider adapter, or state schema version) is satisfied by every alternative below and eliminates none of them; it is recorded once here.

## Decision Drivers

1. **Machine-readable refusal evidence.** A caller or agent must be able to read *which lane holds the ref* without parsing prose, because the prose is human-facing and rewordable.
2. **Layer separation.** Identity stays a function of the error table; evidence stays command-declared. A shared object that mixes the two loses the property that makes the failure envelope classifiable without trusting a handler.
3. **Additive compatibility.** The change must be ignorable by every existing consumer: an optional member, present only for commands that opt in, with the schema identifier unchanged.
4. **Bounded output and privacy.** The evidence channel must be closed and small by construction — an open map is an unbounded output surface and a privacy risk.
5. **Low ceremony and reversibility.** One optional member, one narrow detail contract, one projection read; deleting it later restores the prior surface with no data migration and no consumer breakage.

Drivers rank survivors; C-1…C-6 above are gates, not scoring factors.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` — GH-292's plan records the shape decision as a delivery obligation; this record captures the resolution.
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at the GH-292 PR review. AI does not accept this R2 record.
- **Contributors:** `@pm` (the resolution, which this record captures rather than re-opens), `@spec-writer` (DM-7 and the acceptance criteria the shape must satisfy), `@decision-advisor` (repository analysis and record).
- **Required reviewers:** `@readiness-reviewer` and `@reviewer` on GH-292; the owner for final acceptance.
- **Performers:** `@coder` — the envelope member, the CLI edge's detail projection, the `detail.holder` value at admission, and the pin moves in the same commit; `@doc-syncer` — the result-contract page.
- **Informed:** every command family that renders a failure envelope, and MCP tool-payload consumers.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|---|---|---|---|---|
| The failure envelope has exactly five members and no evidence channel; the success envelope has four mandatory members plus `data`. | FACT | `packages/core/src/contracts/result.ts:49-72` (read 2026-11-12) | An existing evidence member would decide the slot's home and shape. | High |
| `CommandResultError` is exactly six members and every member is row-derived or the command's prose summary. | FACT | `packages/core/src/contracts/result.ts:36-43`; `packages/cli/src/index.ts:293-303` (read 2026-11-12) | If the error were open, a detail could ride inside it without changing the model. | High |
| The CLI edge drops every handler field except `summary` and `remediationHint`, and the exit comes from the row's projection class. | FACT | `packages/cli/src/index.ts:162-198,293-327` (read 2026-11-12) | A pass-through edge would already carry a command detail and no edge change would be needed. | High |
| A lease conflict already produces a `detail` string at the app layer, which the edge does not read. | FACT | `packages/core/src/app/queue.ts:1239-1245` (read 2026-11-12) | A machine-readable holder would already be reachable and C-1 could be met without a contract change. | High |
| The only delivered detail slot is the dispatch success payload's `data.error.detail` with union `harness \| config`. | FACT | `packages/core/src/contracts/dispatch.ts:284-290,303` (read 2026-11-12) | Reusing it would be viable and the alternative would not be excluded by C-4. | High |
| Two delivered shape pins assert that no failure envelope carries a detail, in source text and at runtime. | FACT | `tests/types/dispatch-envelope-detail.type-test.ts:65-85`; `tests/structure/dispatch-envelope-detail.test.ts:24-31,82-116` (read 2026-11-12) | If unpinned, the change would be unguarded in both directions and C-6 would be weaker. | High |
| The runtime conformance validator pins failure top-level keys to exactly five. | FACT | `packages/testkit/src/result-conformance.ts:59-60,121-130`; `tests/fixtures/result/envelope-key-set.json:4` (read 2026-11-12) | A detail-bearing envelope would be judged invalid by the delivered validator. | High |
| MCP's payload is `{ ok, error }` with `McpToolError = CommandResultError` and is not the CLI envelope. | FACT | `packages/mcp/src/output/payload.ts:29-38`; `tests/types/mcp-payload.type-test.ts:32` (read 2026-11-12) | Widening MCP would be in scope and C-4 would move. | High |
| Consumers of the failure envelope outside this repository ignore unknown members rather than rejecting them. | ASSUMPTION | The additive-v1 discipline the result contract already uses; no external strict consumer is declared | A strict external consumer could reject a detail-bearing failure envelope; the delivery discloses the optional member and limits it to opted-in commands. | Medium |
| A holder identity always fits one line within 128 characters. | ASSUMPTION | Holder identities are declared lane names (`dispatch`, `local`, operator-supplied identifiers) | A longer identity would need truncation or a raised bound; the projection must fail loudly rather than truncate. | Medium-High |
| The GH-292 specification, test plan, and M2 queue page are reconciled to the envelope-root `detail.holder` path, with `error.detail` rejected and `CommandResultError` keeping its six delivered fields exactly. | FACT | PM decision 2026-11-12 (`doc/changes/2026-11/2026-11-12--GH-292--queue-lifecycle/chg-GH-292-pm-notes.yaml` `decisions`); GH-292 AC-F4-1/AC-F4-2, DM-7 | A surviving `error.detail` spelling would name a path the envelope does not have; the reconciliation is a delivery obligation of the spec and test-plan owners, and the pins keep the six-field error exact. | High |

## Mental Models & Techniques Used

- **First principles:** What does a refusal owe a caller? *What failed* (the row's identity, unchanged), *whether it mutated anything* (the consequence, unchanged), *what to do* (the remediation hint, unchanged), and *who holds the thing I want* (evidence the row cannot know). The first three are table facts; the fourth is command evidence. One optional envelope member is the minimum structure that carries the fourth without touching the first three.
- **Inversion:** What makes this change dangerous? Putting command evidence inside the identity object, so every consumer of `error` inherits an optional member that only one command populates; opening the detail to an arbitrary map, so the "bounded output" property becomes unprovable; encoding the holder in `summary` and calling it structure, so rewording prose breaks a machine contract; or touching the dispatch success slot, which a delivered pin and the spec both protect.
- **Second-order thinking:** The slot is one optional member today, but it fixes what every later refusal may expose. Restricting it to declared, bounded, identifier-only members keeps NFR-8 an invariant rather than a review habit. A future field then costs one declaration plus one test, not a privacy audit of an open bag.
- **Systems thinking:** The chain is contract → edge projection → command value → pin. A slot the edge does not thread leaves `detail` unpopulated; a value the command does not declare leaves the slot absent; a pin that is relaxed instead of moved makes the new truth undetectable. The three move together or the change is one-sided.
- **Kennedy/opportunity cost:** Reusing `summary` costs nothing today and costs a parseable-prose contract forever. Widening `error` costs the six-field pin and the row-derivation property on every command. Reusing the dispatch slot costs the delivered success-shaped union and the spec's explicit exclusion.
- **KISS / paved road:** One optional member on the type that already exists, one narrow detail contract, one projection read in the edge that already rebuilds the envelope, and the pins moved the way this repository already moves them.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

Legend: ✅ passes · ❌ fails. Every constraint is `negotiable: no`, so no accepted-risk exception exists and no driver score rescues a failing option.

| | C-1 holder machine-readable | C-2 error stays six + row-derived | C-3 exit derived | C-4 delivered surfaces untouched | C-5 bounded, identifier-only | C-6 pins moved two-sidedly |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 summary string only | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-1 widen `CommandResultError` | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ |
| ALT-2 extend the dispatch success detail union | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| ALT-3 additive optional envelope `detail` (selected) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Alternative 0 — Do Nothing / Carry the Holder Only in `error.summary`

- **Eligibility:** Not eligible (fails C-1).
- **Summary:** Keep the delivered five-member failure envelope and the six-field error, and name the holder only in the bounded prose `summary` (the delivered `holder:…; lease:…; …` precedent).
- **Constraint compliance:** Passes C-2 (the error is untouched), C-3 (exit unchanged), C-4 (no surface moves), C-5 (the summary is already bounded), and C-6 (no pin moves). Fails C-1: `detail.holder` does not exist, so AC-F4-1's shape half is unmet and a caller must parse prose.
- **Driver fit:** Serves driver 3 and driver 5 best; fails driver 1 (the entire reason the acceptance criterion is written as a field) and driver 2 (it makes prose the contract).
- **Pros:** Zero contract change; no pin moves; no compatibility question.
- **Cons:** A machine consumer must parse a human field; a future reword of the summary silently breaks it; the acceptance criterion stays unmet.
- **Why rejected:** It is the absence of the deliverable: the refusal identity ships, but the part the acceptance criterion names does not.

### Alternative 1 — Widen `CommandResultError` with an Optional `detail`

- **Eligibility:** Not eligible (fails C-2, C-6).
- **Summary:** Add `detail?: { holder?: string }` to the shared error object so `error.detail.holder` exists on every failure envelope.
- **Constraint compliance:** Passes C-1 (the holder is machine-readable), C-3, C-4, and C-5. Fails C-2: the error object would stop being exactly the six table-derived members, and every command's identity object would carry an optional command-declared member that only one command populates. Fails C-6: the type probe's `@ts-expect-error` cells and the runtime key equality assert the opposite truth, so the pin would have to be inverted rather than moved to a new two-sided truth.
- **Driver fit:** Strong on driver 1, weak on driver 2 (it collapses identity and evidence into one object), acceptable on driver 4, poor on driver 5 (the widest possible surface for the narrowest need).
- **Pros:** One member, one place; the value sits where a reader of the shared error would look first — which is precisely the placement this record rejects, for the reasons C-2 gives.
- **Cons:** Every command's failure envelope gains a member no row derives; the "error is a function of its row" property becomes conditional; two delivered pins must be inverted; the MCP error type would inherit the same widening or diverge from the CLI shape.
- **Why rejected:** It buys one refusal's evidence by spending the shared identity object's defining property.

### Alternative 2 — Extend the Delivered Dispatch Detail Union

- **Eligibility:** Not eligible (fails C-4, C-6).
- **Summary:** Add a third `kind` (for example `"lease"`) with a `holder` field to the existing `DispatchEnvelopeError.detail` union and use that slot for the single-flight refusal.
- **Constraint compliance:** Passes C-1, C-2 (the shared error is untouched), C-3, and C-5. Fails C-4: that slot rides the **success-shaped** dispatch `data.error` payload and its `harness | config` union is a delivered surface the change excludes. Fails C-6: the pin asserts the two-value union, so it would be relaxed rather than moved to a new truth.
- **Driver fit:** Serves driver 1 and driver 4; fails driver 2 (a success-payload slot carrying a pre-session refusal), driver 3 (a delivered union changes meaning), and driver 5 (the narrowest need spends the most specific delivered surface).
- **Pros:** Reuses an existing additive slot and its rendering; no new envelope member.
- **Cons:** The refusal is not a dispatch attempt outcome, so its evidence would have to travel through a payload that also asserts `result`, `prUrl`, and `lastMessage`; `queue claim` and the daemon claim path have no such payload; the delivered union and its pin both move.
- **Why rejected:** It puts a shared admission refusal's evidence inside one command's success payload, which the other two paths cannot populate.

### Alternative 3 — Selected: Additive Optional Envelope `detail` with a Closed Detail Contract

- **Eligibility:** Eligible.
- **Summary:** `CommandResultFailure` gains `readonly detail?: CommandResultDetail`, where `CommandResultDetail` declares `holder?: string` as its only v1 member and the 128-character, single-line bound; the slot is populated only when a command supplies a record-shaped detail, and `queue.single-flight` supplies the live lease's holder identity.
- **Constraint compliance:** Passes C-1 … C-6 (matrix above). C-7 is table stakes.
- **Driver fit:** Best on every driver: a machine-readable holder (1), evidence separated from identity (2), an optional member existing consumers can ignore (3), a closed bounded contract (4), and one member plus one projection read that a revert removes (5).
- **Pros:** `CommandResultError` and `toErrorObject` are untouched, so the six-field pin and the row-derivation property both survive; the success envelope, the dispatch `data.error.detail` union, and MCP's payload are untouched; the slot is absent for every command that does not opt in, so the delivered "exactly five keys" statement stays true for them; a future detail member is a declared addition with its own bound.
- **Cons:** The failure envelope stops being a fixed five-member shape in the abstract; two pins and the runtime conformance key set must move; the shared contract module is touched on behalf of one refusal.
- **Why chosen:** It is the only alternative that satisfies every `negotiable: no` constraint, and it does so by adding an evidence channel beside identity rather than inside it.

## Decision

- **Decision:** Adopt **ALT-3**. The PM has decided; this record captures the resolution and does not re-open it.

  **Decision statement.** The failure envelope gains an additive optional `detail` object — `CommandResultFailure.detail?: { holder?: string; ... }`, command-declared and present only where the command opts in — with `queue.single-flight` carrying `detail.holder` equal to the live lease's holder identity, single line, bounded to 128 characters, identifiers only. The shared six `CommandResultError` fields (`code`, `category`, `retryable`, `consequence`, `remediationHint`, `summary`) are unchanged in meaning, order, and derivation, and `error.detail` is not a placement this decision accepts. The exit code still comes from the row's projection class (`user-validation` → `1`). There is no top-level `ok` or `command`, and the success-shaped dispatch `data.error.detail` slot is unchanged.

  1. **The slot is on the envelope, not on the error.** `CommandResultFailure` declares `readonly detail?: CommandResultDetail` beside `error`; `CommandResultError` keeps its six members. A failure envelope therefore reads: four mandatory members, `error` (identity and remediation), and `detail` only when the refusing command declares one.
  2. **The detail is a closed, bounded contract.** `CommandResultDetail` declares `holder?: string` as its only v1 member, with the 128-character single-line bound declared as contract data and enforced where the detail is projected. A future member is a declared addition with its own bound and test; the contract never becomes an open key-value map, because an open map makes the bounded-output guarantee unprovable (C-5).
  3. **Projection stays in the edge.** The CLI edge reads a record-shaped detail from the command's returned failure — the same explicit-read pattern it already uses for `summary` and `remediationHint` — and copies it onto the failure envelope after the error object is built. `toErrorObject` is untouched, so the error remains a function of the row plus the bounded prose. A string-valued app-layer `detail` (the delivered lease-conflict evidence prose) is not record-shaped and therefore never reaches the envelope.
  4. **Exit derivation is untouched.** The refusal's exit remains `projectExitCode(outcome.entry.projectionClass)` for the `queue.single-flight` row, i.e. `1`. The detail is evidence, never a classification input.
  5. **The content is the holder identity and nothing else.** `detail.holder` is the live lease's holder identity — single line, at most 128 characters, identifiers only, with no credential, session id, provider payload, prompt, diff, path, or repository content. The same value and shape are used wherever the refusal is produced — the dispatch family's admission predicate and `queue claim` — because both read the same live lease's holder identity; an own-holder same-ref claim is a renewal and produces no detail.
  6. **Compatibility discipline.** `schemaVersion` stays `delivery.result.v1`; the member is optional; the success envelope, the dispatch success payload's `data.error.detail` union, and MCP's `{ ok, error }` payload are unchanged. The optional member is disclosed where consumers read the envelope, so a strictly-validating consumer can be updated rather than surprised.
  7. **Pins move two-sidedly, in the delivering commit.** The type probe that pins the failure shape and the dispatch-envelope detail pin both keep their six-field error assertions and gain the positive envelope-level assertion; no `@ts-expect-error` cell and no exact-key equality is deleted or relaxed (C-6).

### Constraint Compliance Attestation

ALT-3 satisfies C-1 through C-6. C-1: the holder is a declared field wherever the refusal is produced — the dispatch family's admission predicate and `queue claim` — with the same value and shape, and an own-holder same-ref renewal is not that refusal. C-2: `CommandResultError` and `toErrorObject` are untouched, so the error object is still exactly six row-derived members plus bounded prose. C-3: the exit is the row's projection class and no exit digit is added outside the projection module. C-4: the success envelope, the dispatch `data.error.detail` union, and MCP's payload keep their delivered shapes, and no top-level `ok`/`command` appears. C-5: the detail contract is closed and bounded to 128 single-line characters, identifiers only. C-6: both pins are extended to assert the new truth beside the retained six-field truth in the same commit. No accepted-risk exception is claimed.

## Trade-offs & Consequences

### Positive Outcomes

- The single-flight refusal names the holder machine-readably wherever it is produced — the dispatch family and `queue claim` — so a caller or agent can act on the refusal without parsing prose or reading state.
- Identity and evidence stay separable: a consumer that classifies failures uses `error` exactly as before, and a consumer that needs the holder opts in to one optional member.
- Every existing consumer of the failure envelope is unaffected unless a command opts in, so the delivered five-member statement remains true for those commands, and the schema identifier is unchanged.
- A future command may opt in without another contract decision: a declared bounded member with its own test is an additive change to one small contract, and reverting the slot costs nothing beyond the code.

### Negative Outcomes

- The failure envelope's member set becomes optional, so a consumer that validates strictly against the delivered key set must admit the optional member. Mitigated by limiting the member to opted-in commands, disclosing it where the envelope is documented, and moving the runtime conformance key set in the same delivery.
- One member is added to a contract shared by every command on behalf of one refusal. Mitigated by keeping the member optional and the detail closed: no other command's output changes.
- Two delivered pins and the runtime conformance key set must move, and a one-sided move would leave the new truth unguarded. Mitigated by C-6 and by moving them in the commit that delivers the behaviour.

### Neutral Outcomes

- `error.summary` still names the holder in prose (the delivered lease-conflict precedent). The machine path never parses it; the two channels serve different consumers and neither is derived from the other.
- The app layer's existing `detail` string on queue failures keeps its meaning as internal evidence and is not the envelope slot. The two must not be conflated by name: the envelope member is record-shaped, and the projection accepts only a record.
- The envelope path is settled as `detail.holder` at the envelope root, and the specification, test plan, and M2 queue page name that path: `error.detail` is the rejected placement, and `CommandResultError` keeps its six delivered fields exactly. The delivery carries no notation reconciliation.

### Unresolved Questions

- [ ] Whether any consumer outside this repository validates the failure envelope strictly. No such consumer is declared; the delivery discloses the optional member (owner: `@pm` at GH-292 PR review).
- [ ] Whether the 128-character bound needs truncation semantics for an over-long holder identity. The contract fails loudly rather than truncating a holder value; reopen only if a real identity approaches the bound (owner: `@spec-writer`).

## Implementation Plan

1. **Contract.** Declare the optional envelope member and the closed detail contract in the result contract; leave the error object and the projection helper unchanged.
2. **Edge.** Read a record-shaped detail from a command's returned failure and copy it onto the failure envelope; keep the exit derivation untouched.
3. **Behaviour.** Supply `detail.holder` from the live lease wherever the refusal is produced: the dispatch family's admission predicate and `queue claim`'s another-holder case, so both paths carry the same value and the own-holder renewal carries none.
4. **Pins, in the same commit.** Extend the type probe and the dispatch-envelope detail pin two-sidedly, and admit the optional member in the runtime conformance key set with its fixture.
5. **Staging.** This record is written without its index row: the `doc/decisions/00-index.md` row lands in the phase that stages this record, in that phase's one commit, so the index never links an absent record.
6. **Documentation.** The result-contract page records the optional member and its bound; the specification, test plan, and M2 queue page name `detail.holder` and reject `error.detail`, so the delivery has no notation to reconcile.

## Verification Criteria

- Wherever the refusal is produced — the dispatch family for any live same-ref lease, `queue claim` for another holder's same-ref lease — the command exits `1` with `error.code == "queue.single-flight"` and the same `detail.holder`; sessions started `0`, records appended `0`, and the state store is byte-identical before and after. An own-holder same-ref claim returns `renewed`, carries no `detail`, and starts no session.
- In every failure envelope, `error` keys are exactly the six; for a command that does not supply a detail, the envelope has no `detail` member.
- The single-flight refusal's exit is `1` and is produced by the projection module from the row's class; `exit-code-literals` stays green.
- The success envelope, the dispatch `data.error.detail` union, and MCP's `{ ok, error }` payload are unchanged, asserted by their delivered pins.
- The refusal detail is one line and at most 128 characters, and contains no credential, token, session id, provider payload, prompt, diff, path, or repository content.
- `pnpm typecheck` is green with both pins asserting the new truth beside the retained six-field truth; no `@ts-expect-error` cell and no exact-key equality was removed or relaxed.

## Confidence Rating

**High.** Every load-bearing fact is repo-local and read directly: the envelope and error types, the edge's error projection and exit derivation, the app-layer conflict evidence, the two shape pins, the runtime conformance key set, the MCP payload shape, and the error-table row that fixes the exit class. The residual uncertainty is external rather than internal — whether an undeclared consumer validates the envelope strictly — and it is bounded by an explicit revisit trigger and a disclosed optional member.

## References

- [GH-292 specification](../changes/2026-11/2026-11-12--GH-292--queue-lifecycle/chg-GH-292-spec.md) — DM-7, AC-F4-1/AC-F4-2, AC-F4-3, §5.1 F-4, §8.1, NFR-6, NFR-8, AC-NFR-5, AC-F7-3.
- [GH-292 change capsule](../changes/2026-11/2026-11-12--GH-292--queue-lifecycle/chg-GH-292-pm-notes.yaml) — the PM decision of 2026-11-12 that settles the envelope-root `detail.holder` placement and rejects `error.detail`.
- [GH-292 delivery plan](../changes/2026-11/2026-11-12--GH-292--queue-lifecycle/chg-GH-292-plan.yaml) — the phase that stages this record and its index row.
- [Result contract (Current spec)](../spec/features/feature-result-contract.md) — envelope, error table, exit projection, documented-table sync.
- [TDR-0005](TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md) — the result contract and exit taxonomy this record extends additively; C-1 (exits derived, never overridden) and C-4 (no envelope shape change without a recorded decision).
- [TDR-0010](TDR-0010-dispatch-session-classification-token-projection.md) — the addendum precedent for a ratified result-contract extension.
- [TDR-0026](TDR-0026-queue-lifecycle-removal-single-flight.md) — the queue-lifecycle record whose DC-2 names this refusal and its `detail.holder`.
- `packages/core/src/contracts/result.ts`; `packages/core/src/contracts/dispatch.ts`; `packages/core/src/contracts/error-table.ts` — the machine contracts.
- `packages/cli/src/index.ts` (`toErrorObject`, `buildEnvelope`); `packages/cli/src/projection.ts` — the edge projection and the only exit digits.
- `tests/types/dispatch-envelope-detail.type-test.ts`; `tests/structure/dispatch-envelope-detail.test.ts`; `packages/testkit/src/result-conformance.ts`; `tests/fixtures/result/envelope-key-set.json` — the pins this delivery moves two-sidedly.
