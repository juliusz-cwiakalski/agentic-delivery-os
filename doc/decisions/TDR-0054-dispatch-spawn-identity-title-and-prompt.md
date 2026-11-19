---
id: TDR-0054
decision_type: tdr
status: Proposed
created: 2026-11-18
decision_date: null
last_updated: 2026-11-19
summary: "A production dispatch supplies the lifecycle agent identity `pm` through the spawn contract's existing optional agent member, the delivered pure resolver produces the single-seat binding, and the adapter renders exactly one `--agent pm` with the binding's resolved `--model`; a fresh spawn carries exactly one deterministic `--title ticket-<REF>` derived from the canonical work-item reference and bounded to a single token, while a resume carries no title; the fresh prompt is the delivery-lifecycle prompt parameterized by ref and resolved base branch rather than a constant sentence, and a resume uses the operator's text when supplied and the lifecycle prompt otherwise — all as composition facts with no new CLI flag, no configuration key, and no operator override, while a role-less composition stays role-less, binds nothing, and records an unresolved seat."
owners:
  - "Juliusz Ćwiąkalski"
service: "delivery-os dispatch composition (spawn identity, deterministic title, lifecycle prompt)"
decision_scope: repo
review_date: null
customer_impact: "A dispatched session now runs as the `pm` lifecycle agent under a deterministic `ticket-<REF>` title, so an operator can find it and the engine can terminate exactly it, and the session receives the delivery lifecycle rather than a one-sentence instruction."
classification:
  domains: [architecture, contracts, security]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: easy
  stakes: medium
  urgency: high
  uncertainty: low
  blast_radius: team
  recurrence: one-off
governance:
  driver: "@decision-advisor (GH-347: the specification routes the spawn identity and prompt as DEC-8 and gap 8; this record fires TDR-0040's first revisit trigger and adds one additive spawn fact)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-347 PR review; AI does not accept this R2 record"
  contributors:
    - "@spec-writer (chg-GH-347-spec §5.1 F-7, §8.1 API-6/API-7, §8.3 DM-6, §17.7 AC-F7-1…AC-F7-4, DEC-8)"
    - "@decision-advisor (the delivered spawn contract, the production composition, the shell's argv, and this record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-347 PR review — this record changes what production sends to a harness and answers a delivered record's open question)"
  performers:
    - "@coder (GH-347: the agent identity supply, the title fact and its validation, the lifecycle prompt, the adapter rendering, the role-less control)"
    - "@doc-syncer (GH-347 documentation phase: harness-adapters, dispatch-engine, and the dispatch reference page)"
  informed:
    - "The terminate operation's exact-identity reap (it matches the deterministic title)"
    - "Seat telemetry and capture (dispatch attempts now carry a binding)"
    - "Operators (the agent and title are not flags and cannot be overridden)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "An operator asks to dispatch under a different agent or a different title: that is a CLI-grammar decision (a new value flag) and a composition-policy decision, and it is decided as a grammar change with the help inventory, not by widening the composition silently."
  - "The title's grammar or bound changes (a ref with a longer prefix, a nested namespace, a non-canonical form): the title is a single validated token derived from the canonical ref, and a grammar change is re-decided with the work-item reference grammar it mirrors."
  - "The lifecycle prompt's required content changes (the eleven phases, merge authority, the state table): the prompt is declared data with required sections, so a content change is a documented edit reviewed against the lifecycle, never an incidental string edit."
  - "A second agent identity is needed for one dispatch (for example a reviewer session): one spawn binds one seat and one identity (TDR-0040); a second identity is a second spawn."
  - "A role-less composition is proposed to stay the production default: the unresolved-seat disclosure is preserved for exactly that case, and making it production again would reopen TDR-0040's headline criterion."
links:
  related_changes: ["GH-347", "GH-335"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-18--GH-347--dispatch-core-parity/chg-GH-347-spec.md"
    - "doc/spec/features/feature-harness-adapters.md"
    - "doc/spec/features/feature-dispatch-engine.md"
    - "doc/spec/features/feature-delivery-lifecycle.md"
  contracts:
    - "packages/core/src/contracts/harness.ts"
    - "packages/core/src/contracts/queue-ready.ts"
    - "packages/core/src/domain/harness-profile-propagation.ts"
    - "packages/adapters/src/harness/opencode.ts"
    - "packages/cli/src/production.ts"
    - "packages/cli/src/commands/dispatch.ts"
    - "scripts/deliver-ticket.sh"
  diagrams: []
  decisions: ["ADR-0008", "TDR-0016", "TDR-0040", "TDR-0042", "TDR-0043", "TDR-0051"]
  experiments: []
  metrics: []
  roadmap_items: ["M4-S9"]
---

# TDR-0054: Dispatch Spawn Identity — Agent, Title, and Lifecycle Prompt

> **Traceability.** Spec §15 **DEC-8**; §5.1 F-7; §6 Flow 1; §8.1 API-6/API-7; §8.3 DM-6; §8.5 "Spawn identity is a deliberate behaviour change"; §17.7 AC-F7-1…AC-F7-4; §22 "No shell injection surface"; §25.1 Appendix A; §25.4 Appendix D; §15.1 maps DEC-8 to this record. Fires **TDR-0040** revisit trigger 1 and supplies the identity **TDR-0051**'s reap matches.

## Context

The typed dispatch builds a fixed command line and a fixed sentence. The shell builds a named session under a deterministic title with the delivery-lifecycle prompt. The spawn contract already has a place for the identity — production simply never fills it.

- **FACT:** `HarnessSpawnInput` is `{ workItemRef, prompt, descriptor }` plus the additive optional `agent` and `binding` members; `HarnessResumeInput` carries the handle, prompt, optional descriptor, and the same two optional members (`packages/core/src/contracts/harness.ts:287-304`). There is no title member. *(read 2026-11-18)*
- **FACT:** The production opencode invocation is `["--standalone", "run", "--format", "json"]` for a spawn and adds `--session` for a resume; no `--agent`, no `--title` (`packages/cli/src/production.ts:1352-1356`). *(read 2026-11-18)*
- **FACT:** The production dispatch prompt is the constant `Deliver change <ref> through the delivery lifecycle.` (`packages/cli/src/production.ts:3042`). *(read 2026-11-18)*
- **FACT:** The dispatch ports already accept a caller agent identity and a composition-resolved binding and pass them into spawn and resume (`packages/core/src/app/dispatch.ts:294-296,747,848-849`); the production composition supplies neither, so shipped dispatches reach the port in the `no-agent` state. *(read 2026-11-18)*
- **FACT:** The adapter's binding surface is injected (`identityViolation`, `expressibility`, `invocationArgs`, `environmentRecords`) and renders one `--agent`/`--model` pair from the binding (`packages/cli/src/production.ts:2315-2328`; TDR-0040 decision 3). *(read 2026-11-18)*
- **FACT:** TDR-0040 A-1/A-4 record that a role-less spawn binds nothing in every profile shape, that the agent identity and the binding ride two distinct optional members, and that "the shipped `dispatch` sets neither member (DEC-15)". Its first revisit trigger names exactly this change: a dispatch that declares an agent narrows the role-less disclosure. *(read 2026-11-18)*
- **FACT:** The shell launches `opencode run --agent pm --session <id>` for a resume and `opencode run --agent pm --title ticket-<REF>` for a fresh run, and its escaped-runtime reaper matches those same two argv strings — the title is an identity the kill path depends on (`scripts/deliver-ticket.sh:1258-1288`; spec §2.1). *(read 2026-11-18)*
- **FACT:** The work-item reference grammar is declared as `^[A-Za-z][A-Za-z0-9]*-[0-9]+$` and is shared by the queue read side (`packages/core/src/contracts/queue-ready.ts:188`, re-exported as `QUEUE_REF_PATTERN` at `queue.ts:338`). *(read 2026-11-18)*
- **FACT:** The agent identity already has a declared validation: an absent member is the `no-agent` state, and a present but empty or whitespace-only value is `config.value.invalid` (`packages/core/src/domain/harness-profile-propagation.ts:50-60`). *(read 2026-11-18)*
- **FACT:** The dispatch grammar's value flags are `--harness`, `--resume-prompt`, `--repo`, `--note`; there is no identity or title flag (`packages/cli/src/commands/dispatch.ts:262,379-382`). *(read 2026-11-18)*
- **Why now:** Gap 8 is the last parity input: without the identity, the session is not a `pm` delivery session, the terminate operation cannot name it, and the prompt is not the lifecycle the shell ran. The contract already anticipates the answer, so the decision is about the *supply* and about the one fact that has no seam yet — the title.

## Problem Framing (Clarified)

"The spawn should look like the shell's" is four decisions with one shared constraint:

1. **Identity supply.** Who supplies the agent, from where, and what happens when nobody does?
2. **Title.** The title has no seam at all. Is it worth a contract member, and if so what validates it and what does it mean?
3. **Prompt.** A constant sentence is not a lifecycle. Which prompt, parameterized by what, and how does it reach the child safely?
4. **Operator surface.** Should any of this be a flag? The grammar is a delivered contract with a help inventory, and a flag would make the identity an operator variable.

Root cause versus symptom: the symptom is a spawn with no `--agent`, no title, and a one-line prompt. The cause is that when the propagation contract was delivered (TDR-0040), the *delivery* had no need for the dispatch to declare an agent, so the composition stayed role-less by design and the gap was recorded as an open question. Gap 8 closes that question — and it also closes the terminate operation's identity requirement, because a reap keyed on `ticket-<REF>` presumes a title exists.

The title deserves separate reasoning because it is not cosmetic: it is the deterministic handle an operator uses to find the session and the engine uses to reap an escaped runtime (TDR-0051 DC-3). A title that could be set by the operator would move the reap's identity into user input.

Deliberately out of scope: no new CLI flag, no configuration key, no operator override (NG-11, AC-F7-4); no second agent identity per dispatch (one spawn binds one seat, TDR-0040); no change to the adapter's model rendering beyond the delivered binding mapping; no prompt-engineering of the lifecycle content beyond parameterization (Appendix D); no change to the hook (retired, NG-2).

## Constraints (Hard Requirements)

### C-1: No new operator surface — the identity and title are composition facts

- **Statement:** The dispatch grammar's value flags are unchanged, no configuration key is added, and an operator cannot set or override the agent identity or the title through any delivered surface.
- **Source:** AC (AC-F7-4; NG-11; §8.5 "Grammar unchanged"; NFR-11)
- **Verification:** test (flag inventory equality; no config key added; an attempt to express an identity or title through the grammar is refused as unknown input) + code review
- **Negotiable:** no

### C-2: The invocation stays a fixed argv, and the identity values are data

- **Statement:** Every spawn is a fixed argv started with no shell; the title and the ref are validated against the declared grammars before they become argv elements, the prompt is passed as data, and no path interpolates a reference into a shell fragment or a script path.
- **Source:** AC (API-7; AC-F7-2/AC-F7-3; NFR-5; §22 "No shell injection surface")
- **Verification:** test (argv equality with no shell; the process runner refuses a shell or script path; a non-canonical ref cannot produce a title) + code review
- **Negotiable:** no

### C-3: A fresh spawn carries exactly one deterministic title; a resume carries none

- **Statement:** A fresh spawn carries exactly one `ticket-<REF>` title derived from the canonical work-item reference, bounded to a short single token and validated against the work-item reference grammar; a resume never carries a title; the title is identical for the same ref across invocations.
- **Source:** AC (AC-F7-2; DM-6; §22) + parity reference (shell fresh-run title)
- **Verification:** test (one title on a fresh spawn, none on a resume, byte-identical across two invocations for one ref, a rejected non-canonical ref) + code review
- **Negotiable:** no

### C-4: A role-less composition stays role-less and binds nothing

- **Statement:** A composition that supplies no agent identity sends no `--agent`, no `--model`, and no title, records no binding, and is disclosed as an unresolved seat; no seat, identity, or title is inferred for it, whatever the profile's seat count.
- **Source:** AC (AC-F7-4; §8.5) + prior decision (TDR-0040 A-1, A-4)
- **Verification:** test (role-less spawn: argv has no identity members; the attempt records no binding and a null seat with the unresolved-seat reason) + code review
- **Negotiable:** no

### C-5: The prompt is the declared lifecycle, parameterized, and it is data

- **Statement:** A fresh spawn's prompt carries the delivery-lifecycle content — state detection, resume sync, actions by state, the eleven-phase lifecycle, and merge authority — parameterized by the ref and the resolved base branch; a resume uses the operator's resume text when supplied and the same lifecycle prompt otherwise; the prompt never becomes a shell fragment and carries no secret.
- **Source:** AC (AC-F7-3; §5.1 F-7; §22 "Secret hygiene")
- **Verification:** test (prompt contains the required sections and the ref/branch values; a resume with an operator prompt uses it verbatim as data; no credential or environment value appears) + code review
- **Negotiable:** no

### C-6: The contract change is additive and the delivered members keep their meaning

- **Statement:** The optional title member is added to the spawn input; the agent identity and binding members keep their delivered meaning and their two-member split; no delivered member is removed, renamed, or re-meant, and the resume input gains no title.
- **Source:** AC (DM-6; §8.5; NFR-3) + prior decision (TDR-0040 A-4)
- **Verification:** test (key-set additions only; existing port suites green unchanged; a resume input with no title remains valid) + code review
- **Negotiable:** no

**Table stakes.** Every alternative below keeps the delivered binding resolver, the delivered adapter identity rendering, the delivered `config.value.invalid` identity for an empty agent, and the delivered no-shell process contract; none of those eliminates an alternative.

## Decision Drivers

1. **Parity with the shell's session identity.** The shell's session is a named `pm` session under `ticket-<REF>`; that is what makes the delivery attributable and findable.
2. **Termination needs a deterministic name.** The exact-identity reap (TDR-0051) matches `ticket-<REF>`; without a title the reap has only the session identity, and the reap's near-miss safety argument weakens.
3. **The lifecycle is the work.** A constant sentence cannot carry state detection, the eleven phases, and merge authority; the prompt is the difference between "a session ran" and "a delivery ran".
4. **Nothing enters the grammar.** A flag would make the identity and title operator variables, which would move the reap's identity into user input and grow the help inventory.
5. **Honesty about role-less runs.** The delivered disclosure is right; this decision must narrow it without deleting it.
6. **Reuse the delivered seams.** The agent member, the binding resolver, and the adapter rendering already exist; only the supply and the title are new.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` — GH-347 routes the spawn identity and prompt here as spec DEC-8 (ticket gap 8); the record also resolves TDR-0040's first revisit trigger.
- **Decider / Approver:** Juliusz Ćwiąkalski at the GH-347 PR review. AI does not accept this R2 record.
- **Contributors:** `@spec-writer` (F-7, API-6/API-7, DM-6, AC-F7-x, DEC-8), `@decision-advisor` (spawn contract, composition, shell argv, this record).
- **Required reviewers:** `@readiness-reviewer`, `@reviewer`, and the human owner (the record changes what production sends).
- **Performers:** `@coder` (identity supply, title fact and validation, lifecycle prompt, adapter rendering, role-less control); `@doc-syncer` (harness-adapters, dispatch-engine, dispatch reference page).
- **Informed:** the terminate reap owner; seat telemetry and capture; operators.

**Type note.** TDR. ADR-0008 and TDR-0040 decided that the spawn contract is surface-mapped and single-seat, and that a seat claim requires a named agent; this record supplies that name and adds one bounded fact. It is R2 because it changes production invocation behaviour and adds a contract member; it is not R3 because it is additive, easily reversible (a compose change plus one optional member), and every fact is repo-local.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|---|---|---|---|---|
| The spawn and resume inputs already carry additive optional `agent` and `binding` members and no title. | FACT | `packages/core/src/contracts/harness.ts:287-304` (read 2026-11-18) | If a title member existed, C-6's addition would be unnecessary. | High |
| Production sends a fixed argv with no `--agent` and no `--title`. | FACT | `packages/cli/src/production.ts:1352-1356` (read 2026-11-18) | The gap would be wiring only, and the title decision would be moot. | High |
| The production dispatch prompt is a constant sentence. | FACT | `packages/cli/src/production.ts:3042` (read 2026-11-18) | The prompt part of the gap would not exist. | High |
| The dispatch ports accept an agent identity and a binding and pass them to spawn/resume; the production composition supplies neither. | FACT | `packages/core/src/app/dispatch.ts:294-296,747,848-849`; `packages/cli/src/production.ts` dispatch composition (read 2026-11-18) | The supply would need a new seam rather than a composition change. | High |
| The adapter renders exactly one `--agent`/`--model` pair from an injected binding surface. | FACT | `packages/cli/src/production.ts:2315-2328`; TDR-0040 decision 3 (read 2026-11-18) | The identity would need adapter work beyond the title. | High |
| TDR-0040 records that the shipped dispatch sets neither member and that a role-less spawn binds nothing in every profile shape; its first revisit trigger names a dispatch that declares an agent. | FACT | `doc/decisions/TDR-0040-harness-seat-spawn-cardinality-and-seat-resolution.md` A-1, A-4, revisit trigger 1 (read 2026-11-18) | This record would be a silent override of a delivered decision rather than the exercise of its declared trigger. | High |
| The shell launches `--agent pm` with `--session <id>` on resume or `--title ticket-<REF>` on a fresh run, and its reaper matches exactly those strings. | FACT | `scripts/deliver-ticket.sh:1258-1288`; spec §2.1 (read 2026-11-18) | The title's determinism and its role in the reap would be unproven. | High |
| The work-item reference grammar is `^[A-Za-z][A-Za-z0-9]*-[0-9]+$` and is already declared. | FACT | `packages/core/src/contracts/queue-ready.ts:188`; `queue.ts:338` (read 2026-11-18) | The title would need a new grammar, which C-2 would have to justify. | High |
| An empty or whitespace-only agent identity is `config.value.invalid`, and absence is the `no-agent` state. | FACT | `packages/core/src/domain/harness-profile-propagation.ts:50-60` (read 2026-11-18) | A new validation identity would be needed for the supply. | High |
| The dispatch grammar's value flags are `--harness`, `--resume-prompt`, `--repo`, `--note`. | FACT | `packages/cli/src/commands/dispatch.ts:262,379-382` (read 2026-11-18) | C-1's grammar-invariance assertion would need restating. | High |
| The resolved profile assigns the `pm` agent a seat in a production profile, so the binding resolves rather than refusing. | ASSUMPTION | TDR-0040 decision 2's resolution chain; profiles ship empty by default (`config/defaults.ts`) so a fresh install refuses nomination before reaching the spawn | If a production profile has no seat for `pm`, the dispatch refuses pre-session with `provider.profile.invalid` — an actionable configuration error, not a silent role-less run. | Medium-High |
| A harness accepts and honours `--title` without treating it as a session identity. | ASSUMPTION | The shell passes it on every fresh run; the supported-window contract (TDR-0043) governs the `run` surface | If the harness ignored the title, the reap's title half would match nothing and only the session-identity half would act — a weaker but safe outcome. | Medium-High |
| The base branch is resolvable at prompt-build time. | FACT | Delivered base-branch resolution is used by the shell (`scripts/deliver-ticket.sh:1714-1720` `detect_base_branch`) and by the composition's repository facts (read 2026-11-18) | The prompt would parameterize only the ref, and the lifecycle would have to describe branch detection instead of naming the branch. | High |

## Mental Models & Techniques Used

- **First principles:** What must a spawned session be for the delivery to be attributable? It must run *as* the lifecycle agent, under a name that identifies the work item, with instructions that contain the lifecycle. Three properties, three facts.
- **Inversion:** What makes a title dangerous? An operator-set title would move the kill path's identity into user input; a title derived from an unvalidated ref could carry whitespace or a shell metacharacter; a title on a resume would imply a second session for one work item. C-1, C-2, C-3 exclude exactly those.
- **Second-order thinking:** Supplying the agent turns a delivered open question into a closed one and *changes another plane's data*: dispatch attempts now carry a binding, so seat telemetry and capture gain a recorded seat for dispatch runs. That is a consequence to state, not a surprise to discover.
- **Systems thinking:** identity → argv → harness session → title-addressed reap → telemetry seat. A role-less supply breaks the chain at the first link and the reap loses half its reach; a constant prompt breaks it at the last semantic link, because the session cannot run a lifecycle it was never told about.
- **Opportunity cost:** A CLI flag would satisfy "operators may want to choose" at the cost of the reap's safety, the help inventory, and the grammar; a second identity per dispatch would cost the single-seat rule. Neither buys anything the delivery needs.
- **Paved road / KISS:** Fill the member that exists, resolve with the resolver that exists, render with the mapping that exists, and add one bounded fact the reap already names.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

Legend: ✅ passes · ❌ fails. Every constraint is `negotiable: no`, so no accepted-risk exception exists and no driver score rescues a failing option.

| | C-1 no operator surface | C-2 fixed argv, data | C-3 deterministic title, none on resume | C-4 role-less stays role-less | C-5 lifecycle prompt as data | C-6 additive, members keep meaning |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 keep the constant identity and prompt | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| ALT-1 add `--agent` and `--title` operator flags | ❌ | ✅ (only with two new validations) | ✅ | ✅ | ✅ | ✅ |
| ALT-2 supply the agent only, no title | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| ALT-3 derive the title from the prompt or the transcript | ✅ | ✅ | ❌ (not a stable identity) | ✅ | ✅ | ❌ (no seam, guessed fact) |
| ALT-4 supply agent and title but keep the constant prompt | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| ALT-5 selected: supplied agent, additive title, lifecycle prompt | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Alternative 0 — Keep the Constant Identity and the Constant Prompt

- **Eligibility:** Not eligible (fails C-3, C-5).
- **Summary:** Ship as delivered: no `--agent`, no title, one sentence of prompt.
- **Constraint compliance:** Passes C-1, C-2, C-4, C-6. Fails C-3 (no title exists) and C-5 (the prompt carries no lifecycle).
- **Driver fit:** Fails drivers 1, 2, 3; serves only driver 6.
- **Pros:** Zero change.
- **Cons:** The session is not a `pm` delivery session, the reap has no title to match, and gap 8 remains; TDR-0040's open question stays open.
- **Why rejected:** It is the gap.

### Alternative 1 — Add `--agent` and `--title` Operator Flags

- **Eligibility:** Not eligible (fails C-1).
- **Summary:** Let the operator choose the agent identity and the title on the command line.
- **Constraint compliance:** Passes C-3, C-4, C-5, C-6 in substance; C-2 only with explicit validation of two new user-supplied values. Fails C-1: the change's non-goals forbid a new operator flag, and the delivered grammar and help inventory are contracts.
- **Driver fit:** Serves a hypothetical operator preference; fails drivers 2 (the reap's identity becomes user input) and 4 (grammar stability).
- **Pros:** Flexible; no composition change for the identity.
- **Cons:** The title stops being a deterministic identity, so the reap's match becomes unpredictable; the help inventory grows; two more values need validation and documentation.
- **Why rejected:** It converts a safety identity into an operator variable.

### Alternative 2 — Supply the Agent Only, No Title

- **Eligibility:** Not eligible (fails C-3).
- **Summary:** Add `--agent pm` and the binding, keep the argv otherwise unchanged, and skip the title.
- **Constraint compliance:** Passes C-1, C-2, C-4, C-5, C-6. Fails C-3: no title fact exists, so the fresh-run identity the shell creates is missing and the reap has only the session identity.
- **Driver fit:** Serves drivers 1 (partially) and 3; fails driver 2.
- **Pros:** No contract member; the smallest supply change.
- **Cons:** A fresh session cannot be found or reaped by its deterministic name; a cheap identity fact stays unset for no benefit.
- **Why rejected:** The title is the cheap half of the identity and the reap's second half.

### Alternative 3 — Derive the Title From the Prompt or the Transcript

- **Eligibility:** Not eligible (fails C-3, C-6).
- **Summary:** Do not add a member; let the adapter or the collector derive a title from the prompt's first line or the session's first message.
- **Constraint compliance:** Passes C-1, C-2, C-4, C-5. Fails C-3: a derived title is not deterministic across prompt edits, and C-6 because the fact has no seam and would be guessed from data the contract never declared.
- **Driver fit:** Fails driver 2 (an unstable name) and driver 6 (a guess where a member suffices).
- **Pros:** No contract change.
- **Cons:** The reap would match a string nobody declared; a prompt change would silently break the identity.
- **Why rejected:** A deterministic identity cannot be inferred from free text.

### Alternative 4 — Supply the Agent and Title but Keep the Constant Prompt

- **Eligibility:** Not eligible (fails C-5).
- **Summary:** Close the argv gap and leave the prompt as the delivered sentence.
- **Constraint compliance:** Passes C-1, C-2, C-3, C-4, C-6. Fails C-5: the session is named correctly but is not told the lifecycle it must run.
- **Driver fit:** Serves drivers 1 and 2; fails driver 3, which is the substantive parity claim.
- **Pros:** Smaller diff than ALT-5.
- **Cons:** The dispatch would look right and behave like a generic agent session, which is the defect the gap describes.
- **Why rejected:** A named session that does not know the lifecycle is not parity.

### Alternative 5 — Selected: Supplied Agent, Additive Title, Lifecycle Prompt

- **Eligibility:** Eligible.
- **Summary:** Production supplies `pm` through the existing agent member; the delivered resolver produces the binding; the adapter renders one `--agent` and one `--model`; a fresh spawn carries one deterministic `ticket-<REF>` title from the validated canonical ref; a resume carries none; the fresh prompt is the lifecycle prompt parameterized by ref and base branch; a role-less composition stays role-less and unbound.
- **Constraint compliance:** Passes C-1…C-6 (matrix above).
- **Driver fit:** Best on every driver: the shell's identity (1), a reap-addressable name (2), the lifecycle as the prompt (3), no grammar growth (4), an honest role-less path (5), and reuse of the delivered resolver and rendering (6).
- **Pros:** Gap 8 closes with two small facts; the reap gains its second identity; the prompt becomes reviewable declared data; TDR-0040's open question is answered by exercising its own trigger; seat telemetry for dispatch attempts becomes populated.
- **Cons:** A new optional spawn member with its own validation and bound; production now depends on a production profile assigning `pm` a seat, so a missing seat becomes a pre-session refusal; the lifecycle prompt's content becomes a maintenance surface.
- **Why chosen:** It is the only alternative that satisfies every `negotiable: no` constraint, and it reuses rather than reinvents the identity path.

## Decision

- **Decision:** Adopt **ALT-5**.

  1. **DC-1 — The production composition declares the lifecycle agent.** A production dispatch supplies `pm` through the spawn contract's existing optional agent member; the delivered pure resolver produces the single-seat binding; the adapter renders exactly one `--agent pm` together with the binding's resolved `--model`. An empty or whitespace-only identity keeps the delivered `config.value.invalid` refusal; absence stays the `no-agent` state. (Spec F-7, API-6, DM-6.)
  2. **DC-2 — A fresh spawn carries one deterministic title; a resume carries none.** The title is `ticket-<REF>` derived from the canonical work-item reference, validated against the declared reference grammar, bounded to a short single token, and carried on an additive optional spawn-title member. It is byte-identical for the same ref across invocations and is never present on a resume. (Spec DM-6, AC-F7-2; the reap in TDR-0051 DC-3 matches it.)
  3. **DC-3 — The fresh prompt is the delivery lifecycle, parameterized and passed as data.** It carries state detection, resume synchronization, actions by state, the eleven-phase lifecycle, and merge authority, parameterized by the ref and the resolved base branch. A resume uses the operator's resume text when supplied and the same lifecycle prompt otherwise. The prompt is never a shell fragment and never carries a credential or environment value. (Spec F-7, AC-F7-3.)
  4. **DC-4 — These are composition facts, not operator surface.** No CLI flag, no configuration key, no override. The grammar and its help inventory are unchanged. (Spec NG-11, AC-F7-4.)
  5. **DC-5 — A role-less composition stays role-less and unbound.** It sends no identity members and no title, records no binding, and is disclosed as an unresolved seat; no seat, identity, or title is inferred, whatever the profile's seat count (TDR-0040 A-1). The production dispatch is not role-less.

  **Relationship to TDR-0040.** This decision **exercises** TDR-0040's first revisit trigger rather than amending it: one spawn still binds exactly one seat, the seat is still resolved from the supplied agent identity through the resolved profile, the binding still rides its own member, an unbound run is still disclosed, and no value is inferred. What changes is that the production supply TDR-0040 recorded as absent now exists, so its `unresolved-seat` disclosure narrows to role-less compositions and test fixtures, and dispatch attempts now carry a recorded binding for seat telemetry and capture. TDR-0040's decision text stands; its statement that the shipped dispatch sets neither member is now historical.

### Constraint Compliance Attestation

ALT-5 satisfies C-1 through C-6. C-1: no flag, no key, no override; the delivered value-flag set is unchanged. C-2: fixed argv with no shell; the title and ref are validated before interpolation and the prompt is data. C-3: one title on a fresh spawn, none on a resume, deterministic per ref. C-4: a role-less composition sends nothing and records no binding or seat. C-5: the prompt carries the declared lifecycle content, parameterized by ref and branch, as data. C-6: the title is an additive optional member and every delivered member keeps its meaning. No accepted-risk exception is claimed.

## Trade-offs & Consequences

### Positive Outcomes

- The dispatched session is the `pm` delivery session the lifecycle expects, so attribution, telemetry, and handover read a named delivery rather than a generic run.
- The title gives the terminate reap its second identity, which is what makes the exact-identity rule able to catch a runtime that escaped the direct child (TDR-0051 DC-3).
- The prompt becomes declared, parameterized data a reviewer can read, instead of a sentence whose adequacy nobody can inspect.
- TDR-0040's open question closes without changing any of its rules, and seat telemetry for dispatch attempts gains the binding it was designed to receive.
- No grammar growth: operators gain behaviour, not options.

### Negative Outcomes

- A new optional spawn member with its own validation and bound, which every future adapter must render or explicitly ignore.
- Production now depends on a production profile assigning `pm` a seat; a profile without it refuses pre-session with `provider.profile.invalid`. That is actionable, but it is a new way for a fresh installation to fail — though publication already refuses at nomination on an empty profile branch.
- The lifecycle prompt's content is a maintenance surface: if the eleven phases or merge authority change, the prompt must change with them, and nothing forces that synchronization except review.
- The title is derived from the ref, so a ref grammar change or a non-canonical ref changes or blocks the identity — a coupling that is intended but must be documented.

### Unresolved Questions

- [ ] Does the harness treat `--title` as idempotent across two fresh runs for the same ref (two concurrent sessions under one title)? (owner: `@spec-writer`; admission makes two concurrent dispatches on one ref impossible, so the question is latent)
- [ ] Is the lifecycle prompt's required content pinned as a reviewable section list rather than prose? (owner: `@spec-writer`; Appendix D makes the prose implementation-decided and the content not)
- [ ] Should the title appear as attempt evidence so a reader can correlate a record with a process? (owner: `@pm` at GH-354 intake; today the lane carries the session identity)

## Implementation Plan

1. **Contract.** Add the optional, bounded, grammar-validated spawn-title member to the spawn input; leave the resume input unchanged; keep the agent and binding members as delivered.
2. **Composition.** Supply `pm` as the caller agent identity, resolve the binding with the delivered resolver, and pass the resolved base branch into the prompt builder.
3. **Adapter.** Render exactly one `--title` from the supplied title on a fresh spawn and none on a resume, beside the delivered one `--agent`/one `--model` rendering; keep the argv fixed with no shell.
4. **Prompt.** Build the lifecycle prompt from declared data: the ref, the resolved base branch, state detection, resume sync, actions by state, the eleven phases, and merge authority.
5. **Role-less path.** Preserve the delivered no-agent behaviour and its unresolved-seat disclosure; assert it with a fixture composition.
6. **Conformance.** Add the spawn-identity case: one `--agent pm`, one `--model`, one `--title ticket-<REF>`, a non-constant prompt carrying the required sections, no title on a resume, and zero operator flags.
7. **Documentation.** Record the composition facts, the title rule, and the prompt source on the harness-adapters, dispatch-engine, and dispatch reference pages; state that no flag exists.

## Verification Criteria

- A production fresh spawn's argv contains exactly one `--agent pm`, exactly one `--model` equal to the binding's resolved model, and exactly one `--title ticket-<REF>`; the argv is started with no shell and no script path.
- A resume's argv contains the identity members and **no** title.
- Two invocations for one ref produce byte-identical titles; a non-canonical ref produces no title and a rejected-input refusal before any spawn.
- The fresh prompt contains the required lifecycle sections and the ref and resolved base branch; a resume with an operator prompt uses it verbatim; neither prompt contains a credential, an environment value, or a shell fragment.
- A role-less composition: no `--agent`, no `--model`, no title, no recorded binding, and a null seat with the unresolved-seat reason.
- The dispatch value-flag inventory and the configuration key set are unchanged; an unknown identity or title flag is refused as unknown input.
- The delivered port and adapter suites stay green; the spawn and resume inputs accept the new member as an addition only.

## Confidence Rating

**High.** Every load-bearing fact is repo-local and read directly: the spawn and resume input members, the constant production argv, the constant prompt, the dispatch ports already accepting an identity and a binding, the adapter's injected rendering surface, TDR-0040's role-less rules and its first revisit trigger, the shell's exact argv strings (confirmed independently by its reaper's match patterns), the declared work-item reference grammar, the delivered empty-agent validation, and the dispatch value-flag set. The residual uncertainty is external: whether the harness honours `--title` as a non-identity label, which the shell has relied on in production and which fails safe if it does not.

## References

- Change: `doc/changes/2026-11/2026-11-18--GH-347--dispatch-core-parity/chg-GH-347-spec.md` — §2.1 (spawn identity and prompt snapshot), §5.1 F-7, §6 Flow 1, §7.2 `[OUT]`, §8.1 API-6/API-7, §8.3 DM-6, §8.5, §17.7, §22, §25.1 Appendix A, §25.4 Appendix D.
- Prior decisions: ADR-0008 (harness adapter contract); TDR-0016 (streaming spawn seam); TDR-0040 (seat–spawn cardinality, seat resolution, A-1/A-4, revisit trigger 1); TDR-0042 (opencode integration mode); TDR-0043 (opencode adapter contract); [TDR-0051](TDR-0051-harness-terminate-operation.md) (the reap that matches the title).
- Specs: `doc/spec/features/feature-harness-adapters.md`; `feature-dispatch-engine.md`; `feature-delivery-lifecycle.md`; the dispatch and command reference pages.
- Contracts and code (read 2026-11-18): `packages/core/src/contracts/harness.ts`; `packages/core/src/contracts/queue-ready.ts`; `packages/core/src/domain/harness-profile-propagation.ts`; `packages/adapters/src/harness/opencode.ts`; `packages/cli/src/production.ts`; `packages/cli/src/commands/dispatch.ts`.
- Parity reference (read 2026-11-18): `scripts/deliver-ticket.sh` — the reaper's exact argv match (lines 1258-1288) and base-branch detection (lines 1714-1720).
