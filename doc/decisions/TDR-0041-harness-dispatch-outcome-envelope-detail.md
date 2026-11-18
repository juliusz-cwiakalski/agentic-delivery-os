---
id: TDR-0041
decision_type: tdr
status: Proposed
created: 2026-11-17
decision_date: null
last_updated: 2026-11-17
summary: "Declare one additive `harness` member on the delivered failure-envelope `CommandResultDetail` slot (TDR-0027), carrying exactly four closed facts from the four new pre-session harness refusals — `kind` (HARNESS_KINDS), `observedVersion` (normalized bare semver or explicit null), `versionVerdict` (inside | outside | indeterminate), and `mode` (the closed mode vocabulary, omitted when mode resolution has not run) — so a version, unknown-version, mode, or profile refusal is machine-distinguishable without prose, while `delivery.result.v1` is unchanged, `CommandResultError` keeps its six fields, the scripted projection keeps `{error, runId}`, no attempt record is fabricated for a pre-session refusal, and the type pins, the runtime conformance validator, the key-set fixture, and the documented member set move two-sidedly in one commit."
owners:
  - "Juliusz Ćwiąkalski"
service: "delivery-os CLI machine envelope (result contract, CLI edge detail projection, dispatch pre-session refusals)"
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
  recurrence: recurring
governance:
  driver: "@decision-advisor (GH-335 readiness iteration 1, finding 6: the plan put the refusal disclosure on a closed two-member detail type whose own comment requires a declared addition with its own bound and test)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-335 PR review; AI does not accept this R2 record"
  contributors:
    - "@spec-writer (chg-GH-335-spec §5.1 F-1/F-2/F-3, §8.2 Derived disclosure row, §10 observability, AC-F1-1/AC-F1-3/AC-F2-1/AC-F2-3/AC-F3-4/AC-N1-1, DEC-2/DEC-3/DEC-7/DEC-9)"
    - "@plan-writer (chg-GH-335-plan Phase 7.1–7.5 and its declared code areas)"
    - "@readiness-reviewer (readiness iteration 1, finding 6)"
    - "@decision-advisor (repository analysis and this record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-335 PR review — this record changes the shared failure-envelope contract)"
  performers:
    - "@coder (GH-335 Phase 7: the declared member, the edge projection, the dispatch command's refusal facts, and every pin move in one commit)"
    - "@doc-syncer (GH-335 Phase 8: the result-contract and dispatch-engine pages)"
  informed:
    - "Every command family that renders a failure envelope (the slot is shared and populated only where a command declares it)"
    - "MCP tool-payload consumers (their `{ ok, error }` payload is not widened)"
    - "M3-S5 conformance and parity suite (the refusal identities it registers scenarios for)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A programmatic consumer needs the available mode (or the supported window) as data rather than prose: add a declared bounded member (`availableModes`-shaped, drawn from the same closed vocabulary) with its own bound and test — never widen an existing member and never let the redaction layer carry it."
  - "A fifth fact is proposed for this slot (for example the raw probe line, a seat name, a store path, or the profile identity): the raw probe line stays diagnostic-only, and any new fact is a declared addition with its own bound and test; the slot never becomes an open key-value map."
  - "A scripted-mode consumer must read these four facts: that is a change to the scripted projection contract (`{error, runId}`) with its own pins and goldens, decided separately — it is not reachable by widening this member."
  - "A harness-plane refusal is produced after a session attempt exists: the attempt-stage shapes (`DispatchEnvelopeData.harness`, `data.error.detail`) own that disclosure, so decide which surface wins instead of populating both."
  - "A second harness kind is added to `HARNESS_KINDS` or the mode/verdict vocabularies change: the slot's members are re-exported vocabulary, so the change is a vocabulary decision, not an envelope-shape decision."
  - "`TDR-0027` is superseded or the `detail` slot's placement is reopened: this member moves with the slot and is re-decided, never carried by assumption."
links:
  related_changes: ["GH-335"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-17--GH-335--opencode-harness-telemetry/chg-GH-335-spec.md"
    - "doc/spec/features/feature-result-contract.md"
    - "doc/spec/features/feature-dispatch-engine.md"
    - "doc/spec/features/feature-harness-adapters.md"
    - "doc/quality/test-specs/test-spec-dispatch-engine.md"
  contracts:
    - "packages/core/src/contracts/result.ts"
    - "packages/core/src/contracts/harness.ts"
    - "packages/core/src/contracts/index.ts"
    - "packages/cli/src/index.ts"
    - "packages/cli/src/commands/dispatch.ts"
    - "packages/testkit/src/result-conformance.ts"
    - "tests/fixtures/result/envelope-key-set.json"
  diagrams: []
  decisions: ["TDR-0027", "TDR-0005", "TDR-0016", "TDR-0021"]
  experiments: []
  metrics: []
  roadmap_items: ["M3-S1"]
---

# TDR-0041: Harness Dispatch-Outcome Disclosure on the Failure-Envelope `detail` Slot

## Context

- **FACT:** The failure envelope is `CommandResultFailure`: exactly `schemaVersion`, `runId`, `exitCode`, `timing`, `error`, plus the additive optional `detail?: CommandResultDetail`; `detail` exists only on the failure branch of the union (`packages/core/src/contracts/result.ts:84-99`, read 2026-11-17).
- **FACT:** `CommandResultDetail` is a closed two-member contract today — `readonly holder?: string` and `readonly suiteBreadth?: readonly string[]` — and its own doc comment states the rule for this decision: "A future member is a declared addition with its own bound and test; this never becomes an open key-value map" (`packages/core/src/contracts/result.ts:52-65`, read 2026-11-17).
- **FACT:** The CLI edge's `explicitDetail` builds the envelope member by reading two named keys off the handler's returned `detail` record; every other key is dropped without a diagnostic (`packages/cli/src/index.ts:239-252`, read 2026-11-17).
- **FACT:** An undeclared member is already being dropped in the delivered tree: the dispatch command's `runtimeFailureOf` emits `detail: { eligibility: [...] }` for the provider-nomination refusal (`packages/cli/src/commands/dispatch.ts:48-91`), while `eligibility` is not a member of `CommandResultDetail` and is therefore never projected. The declaration and the projection are two halves of one mechanism, and a member the edge does not read is invisible (`read 2026-11-17`).
- **FACT:** The runtime conformance validator admits exactly `holder` in its failure-detail member list (`packages/testkit/src/result-conformance.ts:76,285-292`), while the committed key-set fixture declares both `holder` and `suiteBreadth` (`tests/fixtures/result/envelope-key-set.json:6`) — a delivered divergence between the validator and the documented member set that this delivery must not widen (`read 2026-11-17`).
- **FACT:** A delivered exact-key type pin closes the member set in the type system: `Equal<keyof CommandResultDetail, "holder" | "suiteBreadth">` (`tests/types/verify-gates-suite-map.type-test.ts:38`, read 2026-11-17).
- **FACT:** The scripted machine projection writes exactly one minified line — `{data}` on success, `{error, runId}` on failure — and never projects `detail` (`packages/cli/src/output/serialize.ts:51-63`; `doc/spec/features/feature-result-contract.md:104-112`, read 2026-11-17).
- **FACT:** A dispatch refusal before any session attempt uses the ordinary top-level error envelope and appends no attempt record; every post-claim failure is a data-bearing success envelope carrying `data.result`, `data.outcome`, and, where an identity exists, `data.error` typed `DispatchEnvelopeError` with its own `detail` (`{ kind: "harness" | "config"; code; field? }`) (`doc/spec/features/feature-result-contract.md:60`; `doc/spec/features/feature-dispatch-engine.md:55,186`; `packages/core/src/contracts/dispatch.ts:286-292`, read 2026-11-17).
- **FACT:** The delivered dispatch-engine page states the opposite of the target state for this change: "When that refusal is `queue.single-flight`, the top-level envelope also carries the additive optional `detail` object with the live `holder`; no other dispatch refusal populates it" (`doc/spec/features/feature-dispatch-engine.md:186`, read 2026-11-17).
- **FACT:** `HarnessInstance` carries `observedVersion: string | null`, where `null` is "the explicit unknown value" that always rides the closed `version-probe-failed` warning; kinds are the closed `HARNESS_KINDS = ["opencode", "claude-code"]` (`packages/core/src/contracts/harness.ts:22-24,102-118`, read 2026-11-17).
- **FACT:** This change declares the version-verdict vocabulary (`inside` / `outside` / `indeterminate`) and the closed requested-mode vocabulary with `DEFAULT_HARNESS_MODE` in `packages/core/src/contracts/harness.ts` (plan Phase 2.1), and the chosen default mode is the integration-mode record's decision (`chg-GH-335-spec.md` AC-F2-2, DEC-7).
- **FACT:** `.dependency-cruiser.cjs` declares no `no-circular` rule, and `harness.ts` already imports `Result` type-only from `./index.js` (`packages/core/src/contracts/harness.ts:11-25`; `.dependency-cruiser.cjs`, read 2026-11-17), so a type-only vocabulary import into `result.ts` introduces no new lint class.
- **Why now:** GH-335's delivery plan puts the refusal disclosure on `detail.harness` (Phase 7.4), and readiness iteration 1 finding 6 established that the slot's own rule requires the addition to be declared, bounded, projected, and tested — otherwise the disclosure is silently dropped and AC-F1-1/AC-F2-1's disclosure half cannot land.

## Problem Framing (Clarified)

The envelope already separates identity from evidence: `error` is a function of its error-table row, and `detail` is the command-declared evidence channel TDR-0027 added for exactly this reason. What GH-335 adds is four *new* refusal identities on the harness plane — `harness.version.unsupported`, `harness.version.unknown`, `harness.mode.unavailable`, `harness.profile.model-unrepresentable` — that are all produced **before a session exists**. Because no attempt record is appended on that path, the delivered state layer cannot carry their facts; and because `error` must stay row-derived, the identity alone cannot state *which version was observed*, *which verdict the window reached*, or *which mode was in play*.

So the question is not "should a refusal be machine-readable" — `error.code` already makes the four identities distinguishable, and this record does not claim otherwise. The question is where the **facts that explain the refusal** live when the only artifact the refusal produces is the envelope. Three placements are possible: inside the shared error object (widens every command's identity object and inverts the six-field pin), inside the delivered dispatch success payload's `data.error.detail` (that payload does not exist on the pre-session path), or as one declared member of the evidence channel that already exists.

Root cause versus symptom. The symptom is that the version and mode a refusal saw are only readable as prose in the remediation hint; the cause is that the evidence channel's member set is closed and no member names harness resolution facts. Fixing the symptom by parsing the hint would make human wording a machine contract, and a rewording would break it — the exact failure TDR-0027 rejected for the lease holder.

Deliberately out of scope, so the boundary is reviewable: no top-level `ok`/`command`/`warnings`; no change to the success envelope; no widening of `CommandResultError`; no new member on the delivered success-shaped `DispatchEnvelopeError.detail`; no change to the scripted projection; no new error-table row, exit projection, or command; no attempt record for a pre-session refusal; no change to the telemetry schema identity.

## Constraints (Hard Requirements)

### C-1: Each new pre-session harness refusal states its four facts machine-readably on the envelope

- **Statement:** For each of `harness.version.unsupported`, `harness.version.unknown`, `harness.mode.unavailable`, and `harness.profile.model-unrepresentable`, the command's failure envelope carries the harness kind, the observed version (or the explicit unknown), the version-window verdict, and — where mode resolution has run — the mode, as declared members, with no new command, verb, or flag and without requiring a consumer to parse prose.
- **Source:** AC (`chg-GH-335-spec.md` §8.2 "Derived — Refusal and capture disclosure", §10 first bullet, AC-F1-1 and AC-F2-1 disclosure half) + contractual (TC-HARNESS-040 as planned) + internal standard (§8.2: "an additive envelope member requires a declared addition with its own bound and test")
- **Verification:** test (per identity: the four member values on the rendered envelope, plus the absence of the member on every other failure)
- **Negotiable:** no

### C-2: The shared error object and the envelope's top-level shape are untouched

- **Statement:** `error` stays exactly `code`, `category`, `retryable`, `consequence`, `remediationHint`, and optional `summary`, all row-derived except the bounded prose; the envelope keeps exactly one of `data`/`error`; `detail` remains the only evidence channel; no top-level `ok`, `command`, or `warnings` appears; `detail` on a pre-session refusal is not moved into `error`.
- **Source:** prior decision (TDR-0027 C-2, C-4; TDR-0005) + delivered contract pin (`packages/core/src/contracts/result.ts:36-43,71-99`; `tests/types/dispatch-envelope-detail.type-test.ts:97-117`)
- **Verification:** test (six-field error key equality on every envelope; existing `@ts-expect-error` cells retained) + code review
- **Negotiable:** no

### C-3: The member is additive within `delivery.result.v1`

- **Statement:** The schema identifier is unchanged; the member is optional and present only where a command declares it; a failure envelope without it validates exactly as before; no pre-change envelope, fixture, or consumer becomes invalid; the scripted projection keeps its `{error, runId}` key set.
- **Source:** prior decision (TDR-0027 decision 6; TDR-0005 C-4) + AC (`chg-GH-335-spec.md` §8.5, DEC-4-adjacent additive discipline)
- **Verification:** test (schema identifier unchanged; a failure envelope without `detail` still passes the validator; a scripted refusal line is exactly `{error, runId}`) + code review
- **Negotiable:** no

### C-4: The member is closed, identifier-only, and bounded

- **Statement:** The slot declares exactly four members, drawn from closed vocabularies or a bounded version string; no prose, prompt text, message body, transcript, diff, tool output, credential material, session identity, store path, raw probe line, or harness configuration value enters it, and it never becomes an open key-value map.
- **Source:** AC (`chg-GH-335-spec.md` §20 privacy review, NFR-4, NFR-5) + prior decision (TDR-0027 C-5)
- **Verification:** test (member key-set equality; version bound and grammar; canary scan over the rendered refusal envelope) + code review
- **Negotiable:** no

### C-5: No fabrication — the unknown version and the unresolved mode are distinct absences

- **Statement:** An indeterminable version is the explicit `null` (the delivered `HarnessInstance.observedVersion` semantics) and never a fabricated, partial, or substring-matched version; the raw probe line never enters the slot. A mode that has not been resolved at the refusal point is an **omitted** member and never the delivered default, never `null`, and never a guess.
- **Source:** AC (`chg-GH-335-spec.md` NFR-6, AC-F1-3, AC-F1-5, DEC-3, DEC-11) + delivered instance semantics (`packages/core/src/contracts/harness.ts:107-118`)
- **Verification:** test (unknown-version refusal: `observedVersion === null` and no version-shaped string in the slot; version refusals: `mode` absent, never `null` and never the default constant) + code review
- **Negotiable:** no

### C-6: Every pin and the documented member set move two-sidedly in the delivering commit

- **Statement:** The commit that declares the member also updates, without relaxation: the closed-member exact-key type pin, the type probe, the structure pin, the runtime conformance validator's admitted member list (which today omits the delivered `suiteBreadth`), the key-set fixture, and the closed member sentence on `doc/spec/features/feature-result-contract.md`; the `CommandResultError` six-field assertions, the `holder`/`suiteBreadth` assertions, and every exact-key equality are retained, and no `@ts-expect-error` cell is deleted.
- **Source:** prior decision (TDR-0027 C-6, TDR-0026 C-1 discipline) + internal standard (two-sided pin moves; documented-table sync) + API (D12)
- **Verification:** test (`pnpm typecheck` and the structure/behaviour suites green; each pin asserts the new and the retained truth; the validator and the fixture agree in both directions) + code review
- **Negotiable:** no

**Table stakes.** No new package, workspace subpath, provider adapter, state schema version, error-table row, exit projection, or command surface; determinism and the redaction chokepoint are unchanged. Every alternative below satisfies these, so they eliminate nothing.

## Decision Drivers

1. **Refusal diagnosability without prose.** An operator or agent must read *which harness, which version, which verdict, which mode* — because those are the facts that distinguish "your install is too old" from "your install cannot be interrogated" from "that mode is not available" from "that seat cannot be expressed", and a remediation hint is rewordable prose.
2. **Honest absence.** The repository's no-fabrication rule applies to absence as much as to numbers: an unknowable version is the explicit `null`, and a mode that was never resolved is absent — never the delivered default dressed up as an observation.
3. **Additive compatibility and a minimal shared surface.** One declared member on an existing slot, present only where declared, ignorable by every existing consumer, with the schema identifier unchanged.
4. **Single source of vocabulary.** The kind, verdict, and mode value sets already live (or are being declared) in the harness contract; a second authored copy in the result contract would be the duplication this change's own plan names as an escalation trigger.
5. **Two-sided pin discipline.** A member the edge does not project, or a pin that is relaxed instead of moved, makes the new truth undetectable — and the delivered tree already shows one undeclared member being dropped silently.
6. **Low ceremony and reversibility.** Deleting the member restores the prior surface with no migration and no consumer breakage; the record is owed by governance, not by uncertainty.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` — GH-335's readiness finding 6 routes the closed-slot extension to a record before the dependent delivery phase.
- **Decider / Approver:** Juliusz Ćwiąkalski at the GH-335 PR review. AI does not accept this R2 record; it stays `Proposed` until a human decides.
- **Contributors:** `@spec-writer` (the disclosure requirement, refusal identities, and no-fabrication criteria), `@plan-writer` (the Phase 7 code areas and the TC-040 refusal assertions), `@readiness-reviewer` (the finding), `@decision-advisor` (repository analysis and this record).
- **Required reviewers:** `@readiness-reviewer`, `@reviewer`, and the human owner (the change touches the shared failure-envelope contract).
- **Performers:** `@coder` (the declared member, the edge projection, the dispatch command's refusal facts, and every pin move in one commit); `@doc-syncer` (the result-contract and dispatch-engine pages).
- **Informed:** every command family that renders a failure envelope; MCP payload consumers; the M3-S5 conformance suite.

**Type note.** This record is a TDR, following TDR-0027 for the same slot and TDR-0016/TDR-0021 for harness-contract governance. The ADR/TDR tie-breaker prefers ADR at `blast_radius >= team`; the architecture-level question ("is there an evidence channel beside identity?") was decided by TDR-0027 and is not reopened here — this record only adds one declared member inside that decided slot, so the narrower type is the paved road. The rigor is R2, not R1: the member is shared by every command's failure envelope, four delivered pins move with it, and it sets the precedent for later members; it is not R3, because the change is reversible by deletion, every load-bearing fact is repo-local and read directly, and no external data or irreversible commitment is involved.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|---|---|---|---|---|
| `detail` rides only the failure branch and declares exactly `holder` and `suiteBreadth`, with the "declared addition with its own bound and test" rule in its own comment. | FACT | `packages/core/src/contracts/result.ts:52-65,84-99` (read 2026-11-17) | A third placement would already exist and the alternatives would change. | High |
| The CLI edge projects only the keys it names and silently drops any other returned detail key. | FACT | `packages/cli/src/index.ts:239-252` (read 2026-11-17) | A pass-through edge would need no projection change and C-1 could hold without touching the edge. | High |
| The dispatch command already returns an undeclared `detail.eligibility`, which never reaches the envelope. | FACT | `packages/cli/src/commands/dispatch.ts:48-91`; `packages/core/src/contracts/result.ts:62-65` (read 2026-11-17) | If undeclared members were projected, declaring the member would be optional — it is not. | High |
| The runtime conformance validator admits only `holder`, while the key-set fixture declares `holder` and `suiteBreadth`. | FACT | `packages/testkit/src/result-conformance.ts:76`; `tests/fixtures/result/envelope-key-set.json:6` (read 2026-11-17) | If the validator already admitted every declared member, C-6's validator clause would be a no-op. | High |
| An exact-key type pin closes `CommandResultDetail` to `holder \| suiteBreadth`. | FACT | `tests/types/verify-gates-suite-map.type-test.ts:38` (read 2026-11-17) | The pin would not have to move; a one-sided add would typecheck clean and ship unguarded. | High |
| The scripted projection writes exactly `{error, runId}` and never `detail`. | FACT | `packages/cli/src/output/serialize.ts:51-63`; `doc/spec/features/feature-result-contract.md:104-112` (read 2026-11-17) | If scripted mode carried detail, the member would be visible to piped consumers and driver 1 would be satisfied more broadly. | High |
| Pre-session refusals use the ordinary top-level error envelope and append no attempt record. | FACT | `doc/spec/features/feature-result-contract.md:60`; `doc/spec/features/feature-dispatch-engine.md:55,186,365` (read 2026-11-17) | If a record existed, the facts could ride the record and the envelope member would be optional. | High |
| The dispatch-engine page currently asserts that no refusal other than `queue.single-flight` populates the envelope `detail`. | FACT | `doc/spec/features/feature-dispatch-engine.md:186` (read 2026-11-17) | If the page already described a harness refusal detail, the doc half of C-6 would be a no-op. | High |
| `HarnessInstance.observedVersion` is `string \| null` with `null` as the explicit unknown; kinds are the closed two-value vocabulary. | FACT | `packages/core/src/contracts/harness.ts:22-24,107-118` (read 2026-11-17) | The version member's type would need re-deciding rather than reusing delivered semantics. | High |
| The verdict and mode vocabularies are declared by this change in `contracts/harness.ts` (plan Phase 2.1) and the default mode value is the integration-mode record's decision. | FACT | `chg-GH-335-plan.yaml` Phase 2.1; `chg-GH-335-spec.md` AC-F2-2, DEC-2, DEC-7 (read 2026-11-17) | Pin mode literals here and two records could disagree; the shape would need a third source of truth. | High |
| The four facts are available as values at the refusal point (kind and version verdict from the resolved instance, mode from mode resolution). | ASSUMPTION | Plan Phases 2–3 carry the verdict and mode on the instance; the refusal is produced at resolution, after both are known | If a refusal is produced before a fact is known, that fact is omitted rather than guessed (the shape still holds; the mode member already uses omission this way). | High |
| No consumer outside this repository validates the failure envelope strictly. | ASSUMPTION | Same as TDR-0027's unresolved question; no external strict consumer is declared | A strict consumer could reject a new optional member; mitigated by disclosing the member where the envelope is documented and by keeping it optional. | Medium |
| Whether admitting the delivered `suiteBreadth` to the validator in this commit is GH-300's repair or GH-335's. | TO-CONFIRM | Owner preference; the divergence is observed, not owned by this record | Either way the validator must admit `harness`; leaving one delivered member unadmitted keeps the validator unable to validate a delivered envelope. | Medium |

## Mental Models & Techniques Used

- **First principles:** What does a pre-session refusal owe a caller? *What failed* (the row's identity — unchanged), *whether anything landed* (never — no session, no record, no row), *what to do* (the bounded hint — unchanged), and *what the harness looked like when it refused* (evidence the row cannot know: kind, version, verdict, mode). The fourth is exactly what the evidence channel exists for.
- **Inversion:** What makes this dangerous? Adding the member to the type and forgetting the edge projection, so the fact is returned and dropped — which the delivered tree already does for `detail.eligibility`; writing `null` or the delivered default where a mode was never resolved, so the envelope asserts an observation the run never made; adding the member in one commit and moving the pins in a later one, so the new truth is unguarded; or widening `detail` into an open map to avoid the next decision, which makes "bounded output" unprovable.
- **Second-order thinking:** The slot's member set is the shape later harness refusals will copy. Four closed members with one pinned absence rule cost one declaration, one projection branch, and one test today, and they keep every later "just add a field" request a declared decision rather than an accretion.
- **Systems thinking:** The chain is contract → edge projection → command value → pin → page. Each link has a failure mode: a type without a projection drops the member; a projection without a command value leaves it absent; a pin that is relaxed instead of moved hides the change; a page that still says "no other refusal populates it" contradicts the shipped behaviour. All five move in one commit or the change is one-sided.
- **Opportunity cost:** Parsing the remediation hint costs nothing today and makes human wording a machine contract forever. Widening `CommandResultError` buys one refusal's evidence by spending the six-field property every command relies on. Reusing the dispatch success `data.error.detail` costs one union change and cannot serve the path that has no `data`. The declared member costs one import and one projection branch.
- **KISS / paved road:** One optional member on the slot that already exists, three type-only vocabulary imports instead of duplicated literal unions, the same explicit-read projection the edge already performs for `holder`, and the same pin-move discipline the repository already uses.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

Legend: ✅ passes · ❌ fails. Every constraint is `negotiable: no`, so no accepted-risk exception exists and no driver score rescues a failing option.

| | C-1 four facts on the envelope | C-2 error and top-level shape untouched | C-3 additive within v1 | C-4 closed, bounded, identifier-only | C-5 no fabrication | C-6 pins and docs move two-sidedly |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 human digest and records only | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-1 widen `CommandResultError` | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ |
| ALT-2 reuse the dispatch success `data.error.detail` union | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| ALT-3 declared envelope-detail member (selected) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Alternative 0 — Do Nothing: Facts Only in the Human Digest and the Recorded Facts

- **Eligibility:** Not eligible (fails C-1).
- **Summary:** Keep the two-member detail contract; let the remediation hint name the observed version, the supported window, and the available mode, and let the success-side attempt record carry the facts where a record exists.
- **Constraint compliance:** Passes C-2 through C-6 (no contract surface moves, nothing is fabricated). Fails C-1: on the pre-session path there is no attempt record and no data payload, so the four facts have no machine home and a consumer must parse prose; `error.code` distinguishes the identities but states none of the facts.
- **Driver fit:** Best on driver 6 and driver 3; fails driver 1 (the reason the disclosure is required) and driver 5 (it leaves the silent-drop mechanism in place untouched).
- **Pros:** Zero contract change; no pin moves; no compatibility question.
- **Cons:** An operator reading machine output learns *that* the version was wrong but not *which* version was seen, whether the window reached a verdict, or which mode was requested; the disclosure degrades to prose that a reword silently breaks.
- **Why rejected:** It is the absence of the deliverable — the refusal identity ships, and the facts the requirement names do not.

### Alternative 1 — Widen `CommandResultError` with the Harness Facts

- **Eligibility:** Not eligible (fails C-2, C-6).
- **Summary:** Add `detail?: { harness: … }` (or four flat members) to the shared error object so `error` carries the facts on every failure.
- **Constraint compliance:** Passes C-1, C-3, C-4, C-5. Fails C-2: the six-field row-derived error stops being the shared identity object, and every command inherits an optional member only the dispatch plane populates; TDR-0027 explicitly rejected `error.detail`. Fails C-6: the type probe's `@ts-expect-error` cells and the runtime key equality assert the opposite truth, so the pin would be inverted rather than moved.
- **Driver fit:** Strong on driver 1, poor on drivers 3 and 5 (the widest possible surface for the narrowest need, at the cost of the property every consumer relies on).
- **Pros:** One place; the fact sits where a reader of the error looks first.
- **Cons:** Every command's failure envelope gains a member no row derives; the MCP error type either inherits the widening or diverges from the CLI shape; two delivered pins are inverted.
- **Why rejected:** It buys one plane's evidence by spending the shared identity object's defining property.

### Alternative 2 — Reuse the Dispatch Success `data.error.detail` Union

- **Eligibility:** Not eligible (fails C-1, C-6).
- **Summary:** Carry the facts in the delivered `DispatchEnvelopeError.detail` (`{ kind: "harness" | "config"; code; field? }`) — either by adding fields beside `kind`/`code` or by letting that union name the harness facts.
- **Constraint compliance:** Passes C-2, C-3, C-4, C-5. Fails C-1: that slot rides the success-shaped dispatch payload (`data.error`), and a pre-session refusal is an ordinary top-level error envelope with no `data` at all — the path that most needs the disclosure cannot populate it. Fails C-6: the delivered union's shape and its structure pin would be relaxed rather than moved, and the slot's meaning ("the underlying spawn failure") would be repurposed.
- **Driver fit:** Serves driver 3; fails driver 1 (the path cannot be populated), driver 2 (the slot's meaning would blur), and driver 5 (a delivered, spawn-specific slot carries resolution evidence).
- **Pros:** Reuses an existing additive slot with no new member on the shared detail contract.
- **Cons:** The four facts would exist only after a session attempt; the pre-session refusals — version, unknown version, mode, profile — would still be fact-blind; two different disclosures for one plane invite divergence.
- **Why rejected:** It puts resolution evidence in a payload the refusing path does not produce.

### Alternative 3 — Selected: One Declared `harness` Member on the Delivered `detail` Slot

- **Eligibility:** Eligible.
- **Summary:** `CommandResultDetail` gains `readonly harness?: CommandFailureHarnessDetail` — a closed object of exactly four members, projected by the edge only when the command's returned failure carries it, populated by the dispatch command on the four pre-session harness refusals.
- **Constraint compliance:** Passes C-1 … C-6 (matrix above). Table stakes are satisfied trivially.
- **Driver fit:** Best on drivers 1, 2, 3 and 5; driver 4 is satisfied by importing the vocabularies rather than restating them; driver 6 is satisfied because deletion restores the prior surface.
- **Pros:** The evidence channel TDR-0027 built is used for exactly the second kind of evidence it was designed for; `CommandResultError`, the success envelope, the dispatch success payload, and MCP's payload are untouched; the member is absent for every command that does not declare it, so the delivered "exactly five keys" statement stays true for them; the absence rules are pinned instead of implied.
- **Cons:** The closed detail contract grows by one member; four pins plus the validator and the fixture move; one type-only import edge is added from the result contract into the harness vocabulary module.
- **Why chosen:** It is the only alternative that satisfies every `negotiable: no` constraint while keeping the facts where the refusing path can actually produce them.

## Decision

- **Decision:** Adopt **ALT-3**. `CommandResultDetail` gains exactly one declared member, `harness`, carrying four closed facts from the four new pre-session harness refusals. This record is `Proposed`; the human decider accepts it at the GH-335 PR review.

  **Decision statement.** The failure-envelope `detail` object gains `harness?: { kind; observedVersion; versionVerdict; mode? }` — command-declared, present only on the four new pre-session harness refusals, additive within `delivery.result.v1`, identifiers only, bounded by closed vocabularies plus a bounded version string. `CommandResultError` keeps its six fields, the success envelope and the dispatch success payload are untouched, the scripted projection stays `{error, runId}`, and every pin and the documented member set move in the delivering commit.

  1. **Member set and vocabularies (closed).**

     | Member | Presence in the slot | Type | Rule |
     |---|---|---|---|
     | `kind` | always | `HarnessKind` — the delivered `HARNESS_KINDS` (`opencode` \| `claude-code`) | The harness kind resolved for the dispatch; re-exported, never restated. |
     | `observedVersion` | always | `string \| null` | The **normalized** bare semantic version (`opencode v2.2.5` → `2.2.5`) from the accepted probe grammar; at most 32 characters, `^[0-9]+\.[0-9]+\.[0-9]+$`. `null` **iff** `versionVerdict` is `indeterminate` — the delivered explicit-unknown value. The raw probe line is diagnostic only and never enters the slot. |
     | `versionVerdict` | always | `"inside" \| "outside" \| "indeterminate"` — the vocabulary this change declares | The window verdict the resolution reached. On mode and profile refusals it is `inside`: the gate passed, and that is itself the disclosure. |
     | `mode` | present only where mode resolution has run | a member of the closed mode vocabulary this change declares | For `harness.mode.unavailable`: the **requested** mode. For `harness.profile.model-unrepresentable`: the **resolved** mode. Omitted on the two version refusals — never `null`, never the delivered default, never a guess. |

  2. **Identity mapping (the slot's whole eligibility rule).** `harness.version.unsupported` → `outside` with a non-null version, no `mode`; `harness.version.unknown` → `indeterminate` with `null`, no `mode`; `harness.mode.unavailable` → `inside`, non-null version, `mode` = requested; `harness.profile.model-unrepresentable` → `inside`, non-null version, `mode` = resolved. Every other identity carries no `harness` member — including the reused `config.value.invalid` for a malformed mode value, and including `harness.session.unknown`, which is an attempt-stage failure and keeps its delivered data-bearing shape.
  3. **Absence is three distinct things.**
     - The **slot** is absent when the failure is not one of the four (omission = "this command declared no harness evidence").
     - `observedVersion: null` is a **known-unknown** — the system looked and could not determine a version (NFR-6; `HarnessInstance.observedVersion` semantics).
     - `mode` **omitted** is an **unasked question** — mode resolution had not run when the refusal was produced. Writing the delivered default there would assert a resolution the run never made.
  4. **The slot is refusal-only, and that is the point.** `detail` exists only on the failure branch, and pre-session refusals append no attempt record — so the envelope is the only machine channel for these facts. The success side keeps its delivered disclosure: `DispatchEnvelopeData.harness` on the envelope and the additive attempt facts (observed version, verdict, mode and origin) on the attempt record (plan Phase 7.1). One fact, one home, per path.
  5. **Projection stays in the edge, with the delivered semantics.** The CLI edge reads the record-shaped `harness` member off the command's returned failure and copies it member by member, validating each against its closed vocabulary or bound. An out-of-vocabulary or over-bound value is **not projected** (never coerced, never clipped, never defaulted) — the same discipline the edge already applies to `holder` — and the failure's identity, exit, and hint are unchanged by the member's presence or absence. The contract never becomes an open key-value map; a fifth member is a declared addition with its own bound and test.
  6. **Compatibility discipline.** `schemaVersion` stays `delivery.result.v1`; the member is optional; the success envelope, the dispatch success payload's `data.error.detail`, MCP's `{ok, error}` payload, and the scripted projection are unchanged. No error-table row, exit projection, command, or attempt record is added by this member.
  7. **Pins and the documented member set move two-sidedly, in the delivering commit.** The closed-member type pin, the type probe, the structure pin, the runtime conformance validator's admitted member list, and the key-set fixture are updated with the declaration; the six-field error assertions, the `holder`/`suiteBreadth` assertions, and every existing exact-key equality are retained, and no `@ts-expect-error` cell is removed.

### Constraint Compliance Attestation

ALT-3 satisfies C-1 through C-6. C-1: all four refusals carry the four facts as declared members on the ordinary failure envelope, with no new command and no prose parsing. C-2: `CommandResultError` and the top-level union are untouched, and no `detail` member moves into `error`. C-3: the member is optional, the schema identifier is unchanged, envelopes without it validate exactly as before, and the scripted projection keeps its key set. C-4: four closed members, no prose, no identities beyond the harness kind, no raw probe line, no session id or store path, no open map. C-5: an indeterminable version is the explicit `null`; an unresolved mode is omitted and never defaulted or fabricated. C-6: the type pin, the type probe, the structure pin, the validator, the fixture, and the documented member sentence all move in the same commit with every retained assertion intact. No accepted-risk exception is claimed.

## Trade-offs & Consequences

### Positive Outcomes

- An operator can read machine output and tell a version refusal from an unknown-version refusal from a mode refusal from a profile refusal, and see the observed version, the verdict, and the mode — no prose parsing, no new command, no record fabricated for a refusal that must append none.
- The evidence channel gains exactly one more declared member and stays closed: the "bounded output" property remains provable, and a later fact costs one declaration plus one test rather than a privacy audit of an open bag.
- Vocabulary duplication is avoided: the kind, verdict, and mode value sets keep their single home in the harness contract, so a later vocabulary change is one edit.
- The delivered `detail` contract becomes consistent in three places at once: the type, the runtime validator, and the documented member sentence.

### Negative Outcomes

- The shared `detail` contract grows for the dispatch plane's benefit. Mitigated by keeping the member optional and closed, and by declaring it dispatch-only: no other command's output changes.
- Five surfaces must move together (type, edge projection, command value, pins, page); a one-sided move leaves the new truth unguarded or the docs contradicting the shipped behaviour. Mitigated by C-6 and by making the file set explicit in this record.
- `mode`'s presence rule is conditional on flow order, which a reader must know. Mitigated by pinning the identity→member mapping in one table and by a test per identity that fails if the wrong refusal carries `mode`.
- A scripted consumer does not see the member at all. This is the delivered projection's contract, not a defect of this decision: `error.code` still distinguishes the refusals, and `--verbose` or the interactive envelope carries the facts. Widening the scripted line is a separate, larger contract decision (revisit trigger).

### Neutral Outcomes

- `error.remediationHint` keeps naming the supported window and the available mode in prose. The machine path never parses it; the two channels serve different consumers and neither is derived from the other.
- The success path's disclosure is unchanged and stays on the attempt record and `DispatchEnvelopeData.harness`; the envelope-root member is not a duplicate of it, because the refusing path produces no record.
- `detail.eligibility`'s delivered silent drop is *not* repaired here; this record cites it as evidence that the declaration and the projection are one mechanism. Its disposition belongs to the change that owns that member.

### Unresolved Questions

- [ ] Does any consumer outside this repository validate the failure envelope strictly? No such consumer is declared; the delivery discloses the optional member where the envelope is documented. (owner: `@pm` at the GH-335 PR review)
- [ ] Is admitting the delivered `suiteBreadth` to the runtime conformance validator this commit's repair or `GH-300`'s? The commit must admit `harness`; a validator that cannot validate a delivered envelope is a defect either way, and splitting the two repairs leaves the list half-true. (owner: `@pm` / `@plan-writer`)
- [ ] Does a machine consumer need the *available* mode (or the supported window) as data rather than prose? Not requested by any acceptance criterion in this change; adding it is a later declared member. (owner: `@spec-writer` on the first consumer that needs it)

## Implementation Plan

1. **Contract.** Declare `harness?: { kind; observedVersion; versionVerdict; mode? }` on `CommandResultDetail` in `packages/core/src/contracts/result.ts`, importing the three vocabularies **type-only** from `./harness.js` (no restated literal unions), beside the version bound constant; re-export the constant from `packages/core/src/contracts/index.ts`. The vocabularies themselves stay where this change declares them (`contracts/harness.ts`, plan Phase 2.1).
2. **Edge.** Extend `explicitDetail` in `packages/cli/src/index.ts` to read the member member-by-member against the closed vocabularies and the version bound, dropping a malformed value rather than coercing it, and leaving the slot absent when nothing valid remains.
3. **Behaviour.** Supply the four facts on the returned refusal detail from the dispatch command's runtime failure shape (`packages/cli/src/commands/dispatch.ts`), populated only on the four identities — read from the resolved instance and the mode resolution, never re-derived or defaulted.
4. **Pins, in the same commit.** Move the closed-member type pin (`tests/types/verify-gates-suite-map.type-test.ts`), the type probe (`tests/types/dispatch-envelope-detail.type-test.ts`), the structure pin (`tests/structure/dispatch-envelope-detail.test.ts`), the runtime validator's admitted members (`packages/testkit/src/result-conformance.ts`), the key-set fixture (`tests/fixtures/result/envelope-key-set.json`), and the validator coverage in `tests/structure/result-contract.test.ts` two-sidedly.
5. **Behaviour proof.** TC-HARNESS-040's refusal assertions land in `tests/behaviour/dispatch-harness-verdict-mode.test.ts` (already Phase 7 scope): per identity, the four member values; `null` iff indeterminate; no `mode` on version refusals; no slot on any other failure; a malformed member dropped; the scripted refusal line still exactly `{error, runId}`.
6. **Documentation, in the delivering commit.** `doc/spec/features/feature-result-contract.md` names the member, its four members, the version bound, and the identity→absence mapping in the closed member sentence; `doc/spec/features/feature-dispatch-engine.md` drops the "no other dispatch refusal populates it" claim and names the harness refusal disclosure. The remaining page reconciliations stay in the change's documentation phase.
7. **Staging.** This record's index row (`doc/decisions/00-index.md`) lands in the phase that stages this record, in that phase's one commit.

**Exact file set the GH-335 plan must declare in the owning phase** (contract, allowlist, structure tests, and the spec page in one commit):

| File | Change |
|---|---|
| `packages/core/src/contracts/result.ts` | The `harness` member on `CommandResultDetail` + the version bound constant + comment stating the four members and the absence rules. |
| `packages/core/src/contracts/index.ts` | Re-export the new constant (the vocabularies are re-exported by Phase 2). |
| `packages/cli/src/index.ts` | `explicitDetail` projects the member with closed-key, bounded reads and drops a malformed value. |
| `packages/cli/src/commands/dispatch.ts` | The runtime failure shape carries the four facts; `runtimeFailureOf` emits `detail.harness` on the four identities only. |
| `packages/testkit/src/result-conformance.ts` | Admit `harness` (and the delivered `suiteBreadth`) and validate the four members; no rule id is added or removed. |
| `tests/fixtures/result/envelope-key-set.json` | `failureDetailMembers` gains `harness`. |
| `tests/types/verify-gates-suite-map.type-test.ts` | The closed-member exact-key pin moves to include `harness`. |
| `tests/types/dispatch-envelope-detail.type-test.ts` | Positive assignment for the member; every existing cell retained. |
| `tests/structure/dispatch-envelope-detail.test.ts` | The member is declared with its four members; a refusal projects it; a malformed value is dropped; a non-harness failure carries none. |
| `tests/structure/result-contract.test.ts` | The validator accepts a `detail.harness` envelope and rejects an out-of-vocabulary member. |
| `tests/behaviour/dispatch-harness-verdict-mode.test.ts` | Already Phase 7 scope: per-identity refusal assertions and the scripted-line assertion. |
| `doc/spec/features/feature-result-contract.md` | The closed member sentence names `harness`, its members, bound, and absence rules. |
| `doc/spec/features/feature-dispatch-engine.md` | The "no other dispatch refusal populates it" claim is replaced by the harness refusal disclosure. |

## Verification Criteria

- Each of the four identities, driven end to end through the composed dispatch path: exit from its row's projection class; zero sessions, zero attempt records, zero telemetry rows; `error` keys exactly the six; `detail.harness` present with exactly the mapped member set; `kind` from the resolved configuration.
- `harness.version.unsupported`: `versionVerdict === "outside"`, `observedVersion` a normalized bare semver, no `mode` key (not `null`), and no raw probe line anywhere in the slot.
- `harness.version.unknown`: `versionVerdict === "indeterminate"`, `observedVersion === null`, no `mode` key, and no version-shaped string in the slot.
- `harness.mode.unavailable`: `versionVerdict === "inside"`, `mode` equal to the requested mode and not the delivered default unless that was requested.
- `harness.profile.model-unrepresentable`: `versionVerdict === "inside"`, `mode` equal to the resolved mode.
- Any other failure envelope — including `queue.single-flight`, `verify.narrowed-scope`, `config.value.invalid`, and `harness.session.unknown` — carries no `harness` member, and the delivered members still project where they did.
- A member value outside its vocabulary or bound is not projected; the envelope remains valid; the identity, exit, summary, and remediation hint are unchanged; the validator reports the violation and the fixture's member list and the validator's admitted list agree in both directions.
- `keyof CommandResultDetail` is exactly `holder | suiteBreadth | harness`; the six-field `CommandResultError` assertions and every `@ts-expect-error` cell are retained; `pnpm typecheck` is green.
- A scripted-mode refusal line is exactly `{error, runId}` and contains no `harness` token; an interactive or `--verbose` envelope carries the member.
- `doc/spec/features/feature-result-contract.md` names the member and its rules, and `doc/spec/features/feature-dispatch-engine.md` no longer asserts that only `queue.single-flight` populates the envelope `detail`.

## Confidence Rating

**High.** Every load-bearing fact is repo-local and read directly: the envelope and detail types, the edge's projection and its silent-drop behaviour, a live instance of that drop in the dispatch command, the runtime validator's member list against the committed fixture, the exact-key type pin, the scripted projection, the pre-session-refusal and no-attempt-record contract, and the page that currently contradicts the target state. The residual uncertainty is external (an undeclared strict envelope consumer) and one ownership question over a delivered validator divergence; both are bounded by explicit disclosure and by an owner-named unresolved question.

## References

- [GH-335 specification](../changes/2026-11/2026-11-17--GH-335--opencode-harness-telemetry/chg-GH-335-spec.md) — §5.1 F-1/F-2/F-3, §8.2 Derived disclosure row, §8.5 backward compatibility, §10 observability, §17 AC-F1-1/AC-F1-2/AC-F1-3/AC-F1-5/AC-F2-1/AC-F2-3/AC-F3-4/AC-N1-1, DEC-2/DEC-3/DEC-7/DEC-9/DEC-11.
- [GH-335 delivery plan](../changes/2026-11/2026-11-17--GH-335--opencode-harness-telemetry/chg-GH-335-plan.yaml) — Phase 2.1 (the vocabularies), Phase 7.1–7.5 (the disclosure and TC-HARNESS-040), Phase 8.4 (the dispatch-engine page).
- [GH-335 readiness iteration 1](../changes/2026-11/2026-11-17--GH-335--opencode-harness-telemetry/readiness-review/readiness-iter-1.md) — finding 6 (the closed `detail` slot and the missing code areas).
- [Result contract (Current spec)](../spec/features/feature-result-contract.md) — the envelope field contract, the closed member sentence, and the documented-table sync discipline.
- [Dispatch Engine (Current spec)](../spec/features/feature-dispatch-engine.md) — the seven pre-session refusals, the attempt-stage data-bearing shapes, and the sentence this decision replaces.
- [TDR-0027](TDR-0027-command-failure-envelope-detail-slot.md) — the envelope-root `detail` slot, its closed-member rule, and the two-sided pin discipline this record extends additively.
- [TDR-0005](TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md) — the result contract and exit taxonomy (C-1 exits derived, C-4 no envelope shape change without a recorded decision).
- [TDR-0016](TDR-0016-harness-streaming-spawn-seam.md), [TDR-0021](TDR-0021-additive-optional-harness-environment-marker.md) — the harness adapter-contract precedent: additive, closed, declared, and pinned in the delivering commit.
- `packages/core/src/contracts/result.ts`; `packages/core/src/contracts/harness.ts`; `packages/core/src/contracts/index.ts`; `packages/cli/src/index.ts` (`explicitDetail`, `buildEnvelope`); `packages/cli/src/commands/dispatch.ts` (`runtimeFailureOf`); `packages/cli/src/output/serialize.ts` — the machine contracts and the projection.
- `packages/testkit/src/result-conformance.ts`; `tests/fixtures/result/envelope-key-set.json`; `tests/types/verify-gates-suite-map.type-test.ts`; `tests/types/dispatch-envelope-detail.type-test.ts`; `tests/structure/dispatch-envelope-detail.test.ts`; `tests/structure/result-contract.test.ts` — the pins and the validator this delivery moves two-sidedly.
