---
id: TDR-0013
decision_type: tdr
status: Proposed
created: 2026-11-07
decision_date: null
last_updated: 2026-11-07
summary: "Remove the GH-227 delivery-session refusal from `commit` and `phase complete` so lifecycle agents can use the primitive where they operate; keep the harness one-shot in its sanitized empty project context; retire `commit.session.context-refused` and shrink the `commit` error domain from six rows to five; supersede GH-227 DEC-6."
owners: ["Juliusz Ćwiąkalski"]
service: delivery-os commit primitive and lifecycle agent integration (M1-S20)
decision_scope: repo
review_date: null
business_impact: "Unblocks the M1-S20 adoption of the commit primitive by the agents that deliver the product: commits stay on the scanned, precisely staged, atomic primitive instead of falling back to raw-git staging and agent-authored messages."
classification:
  domains: [tooling, security]
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
  driver: "@pm (GH-242 change orchestration; OQ-2 and OQ-6 resolved to require this record before delivery)"
  decider: "Juliusz Ćwiąkalski — acceptance pending at GH-242 PR review; PM-fixed positions recorded here for delivery unblock (TDR-0005/TDR-0012 precedent)"
  contributors:
    - "@spec-writer (GH-242 DEC-3/DEC-4/DEC-5 and AC-F4-1..AC-F4-3 framing)"
    - "@decision-advisor (analysis and record)"
  reviewers: ["@reviewer", "@readiness-reviewer", "Human owner (PR review)"]
  performers: ["@coder (guard removal, row retirement, synced surfaces)", "@doc-syncer (feature-spec reconciliation)"]
  informed: []
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "Evidence that a commit landed from inside a delivery session without the deterministic safety scan, precise staging, or atomic record-plus-commit applying — i.e., the protections turned out not to be independent of the guard: reopen and restore an origin control (or an equivalent) before further adoption."
  - "An owner or security review reasserts GH-227's pinned guardrail #6 as a binding requirement: supersede this record deliberately rather than re-adding the refusal at a call site."
  - "A production composition begins supplying the declared session environment keys and a caller class appears that must never commit: evaluate a scoped origin control (ALT-1) at that point, not an unreachable CLI refusal."
  - "M1-S9 dispatch sessions or M1-S18 daemon adoption introduce an autonomous caller whose commit rights must be bounded: decide origin control in that story's decision, not by reviving this row."
  - "The `commit` error domain changes again (row added or removed): confirm the five-row domain and every synced surface move together."
links:
  related_changes: ["GH-242", "GH-227"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-07--GH-242--agent-integration/chg-GH-242-spec.md"
    - "doc/changes/2026-11/2026-11-05--GH-227--commit-primitive/chg-GH-227-spec.md"
    - "doc/spec/features/feature-commit-primitive.md"
    - "doc/spec/features/feature-result-contract.md"
    - "doc/spec/features/feature-pm-notes-lint-and-phase-transitions.md"
  contracts:
    - "packages/core/src/contracts/commit.ts"
    - "packages/core/src/contracts/error-table.ts"
  diagrams: []
  decisions: ["TDR-0005"]
  experiments: []
  metrics: []
  roadmap_items: []
---

# TDR-0013: Agent-Session Commit Guard Reversal — Remove the Delivery-Session Refusal and Retire `commit.session.context-refused`

## Context

- **FACT:** GH-227 delivered the commit primitive (`commit`, atomic `phase complete`) and recorded DEC-6: "Never runs inside a delivery session" is enforced mechanically — the edge-injected delivery-session context facts are checked at invocation, and a detection refuses with `commit.session.context-refused` (exit 1); the harness one-shot's empty project context is deliberately not a delivery session (chg-GH-227-spec §15 DEC-6, §17 AC-F1-3).
- **FACT:** DEC-6's recorded rationale was to resolve the ticket's pinned guardrail #6 "with a mechanical detection rather than a documentation-only rule." The same spec states the guard's caller model plainly: "callers (agents, scripts, humans) invoke it from outside" (chg-GH-227-spec F-1). GH-227 NG-1 deferred agent adoption and prompt re-pointing to a separate change.
- **FACT:** The guard is delivered in two places and runs before any port is constructed: the `commit` command handler checks `runtime.sessionFacts()` before grammar and ref resolution, and `phase complete` checks the same facts in `transitionTarget` before reading pm-notes or the ledger. Both return the same `commit` identity (packages/cli/src/commands/commit.ts, packages/cli/src/commands/phase.ts).
- **FACT:** The guard is therefore not a content or tree control. It decides *who* may invoke the primitive, not *what* may be staged or committed.
- **FACT:** GH-242 (M1-S20) must adopt the primitive where lifecycle agents actually run: PM, coder, and coordinator delivery sessions (chg-GH-242-spec §2.1, §2.2, G-4, F-4, DEC-3, AC-F4-1). The spec names the guard as an adoption blocker: "the lifecycle agents run inside delivery sessions, so the primitive refuses exactly where it is needed" (§2.2).
- **FACT:** The production edge does not currently supply the session environment keys, so the refusal is practically inert in installed compositions and enforced only by injected facts in tests and compositions that opt in (chg-GH-242-spec §2.1; `sessionEnvironmentKeys` is a production-runtime option with no production supplier found in the repository on 2026-11-07).
- **FACT:** The protections GH-227 shipped are origin-independent: the deterministic safety scan runs on the candidate staging set before transport and before staging (fail-closed), the staging set is computed (untracked strays never staged, exclusions and scope drift disclosed), atomic completion lands the record and the commit together or neither, and re-runs converge on durable evidence (chg-GH-227-spec F-5/F-6/F-7; doc/spec/features/feature-commit-primitive.md).
- **FACT:** The harness one-shot already runs the single model call as a CLI-level headless invocation in a freshly created empty project directory containing only the prompt file, with a sanitized environment and removal after the attempt including on failure (packages/adapters/src/session/commit-one-shot.ts; chg-GH-227-spec F-4; chg-GH-242-spec F-4, AC-F4-2). That isolation is a property of the transport, not of the caller-origin guard.
- **FACT:** The `commit` domain is exactly six rows in the machine table and the documented table; `commit.session.context-refused` is one of them (packages/core/src/contracts/commit.ts `COMMIT_ERROR_CODES`, packages/core/src/contracts/error-table.ts, doc/spec/features/feature-result-contract.md). Once the refusal is removed, the row is unreachable.
- **FACT:** The row is referenced by name across the structure test, the commit-envelope golden, the session-guard behaviour test, the result-code corpus, two feature specs, and two command reference pages (repository grep, 2026-11-07). Retiring it is a four-surface synchronization, not a one-line deletion.
- **Trigger:** GH-242 cannot deliver G-4/F-4/AC-F4-1 while DEC-6 stands. GH-242 DEC-3 records the removal, the retained one-shot isolation, and the six-to-five-row retirement, and names this record as the required authority (chg-GH-242-spec DEC-3, OQ-2, OQ-6).

## Problem Framing (Clarified)

The question is not whether the commit primitive needs protections — it has them, and they are stronger than anything a caller could substitute. The question is whether **caller origin** is one of those protections or a proxied policy that belongs in the caller layer.

GH-227 wrote the refusal when agent adoption was explicitly out of scope: the primitive had no in-session consumer, and a pinned guardrail asked that "never inside a delivery session" be mechanical rather than documentary. That is a coherent scope decision for a primitive with no in-session consumer. GH-242 changes the premise: the in-session consumer is now the primary intended operator, so the same guard refuses the capability's core use and pushes adopters either back to the raw-git path GH-227 exists to retire or toward a permanent bypass flag.

Three separable concerns must not be conflated:

1. **Command-level origin refusal** — `commit` and `phase complete` refuse because session facts say a session is active. This is the thing under decision.
2. **Model-call context isolation** — the harness one-shot must not load the project or the delivery session into the model call. This is a real isolation requirement and it lives in the transport; it survives the refusal's removal unchanged.
3. **Error-table honesty** — an identity that no code path can produce weakens the table's authority as the classification source. Removing the behavior without removing the row would leave a documented lie and a dead fixture class.

Desired outcomes: lifecycle agents can commit and complete phases inside their sessions; the safety scan, staging precision, atomicity, and convergence are unchanged and remain the operative controls; the model call remains context-isolated; the error domain stays exact and fully synced; and the reversal is durable and explicitly labeled as superseding GH-227 DEC-6, so it is not re-litigated from the old text.

Out of scope: commit-message generation, staging scope rules for standalone commits, safety-scan rule content, atomicity and convergence semantics, prompt adoption mechanics and conformance tooling (GH-242 F-3/F-9), and the legacy bash pipeline's own git behavior.

## Constraints (Hard Requirements)

### C-1: Lifecycle commits and completions succeed inside an active delivery session

- **Statement:** With session facts reporting an active delivery session, every commit-capable invocation (`commit`, `commit --dry-run`, `commit --phase`, `phase complete`, `phase complete --no-commit`) must not return `commit.session.context-refused`; it proceeds under the primitive's normal grammar, safety, staging, and atomicity rules.
- **Source:** AC (chg-GH-242-spec AC-F4-1, F-4, DEC-3)
- **Verification:** test (in-session behaviour cases replacing the refusal suite)
- **Negotiable:** no

### C-2: The primitive's content and tree protections remain unchanged

- **Statement:** The deterministic fail-closed safety scan (secrets, forbidden paths, binary guard) runs before transport and staging; the staging set stays computed (untracked strays never staged, exclusions and scope drift disclosed); atomic record-plus-commit remains both-or-neither; re-run convergence remains total over the four durable-evidence states.
- **Source:** prior decision (GH-227 F-5/F-6/F-7) + AC/internal standard (chg-GH-242-spec NG-7)
- **Verification:** test (existing safety, staging, atomicity, convergence suites stay green)
- **Negotiable:** no

### C-3: The harness one-shot model call stays context-isolated

- **Statement:** The harness one-shot runs in a temporary empty project context whose only input is the prompt, with a sanitized environment carrying no delivery-session facts and no project configuration, and the temporary context is removed after the attempt including on failure.
- **Source:** AC (chg-GH-242-spec AC-F4-2) + prior decision (GH-227 F-4)
- **Verification:** test
- **Negotiable:** no

### C-4: The error table stays exact and fully synced

- **Statement:** Every declared `commit` identity is reachable and documented; no unreachable row remains. The machine table, documented table, fixtures/goldens, result-code corpora, and result-contract/prose surfaces change together, and the two-way sync check stays green. The `commit` domain is exactly five rows after retirement.
- **Source:** prior decision (result contract / TDR-0005 discipline) + AC (chg-GH-242-spec DM-3, AC-F4-3)
- **Verification:** test (error-table structure and sync checks) + code review
- **Negotiable:** no

### C-5: Exit projection and envelope shape are unchanged

- **Statement:** Exits remain derived only from declared projection classes and stay within `{0, 1, 2}`; the retirement adds no exit digit and no envelope shape change.
- **Source:** prior decision (result contract; TDR-0005 C-1/C-4 lineage)
- **Verification:** test (projection and envelope conformance)
- **Negotiable:** no

Table stakes inherited by every alternative: local-only commits (no push, no history rewrite beyond the primitive's own interrupted attempt), brand neutrality, and deterministic fixtures. No alternative is differentiated by them.

## Decision Drivers

Ranked; a single ordered list is authoritative.

1. **Adoption correctness — the primitive must work where its operators are.** Lifecycle agents run inside delivery sessions by definition; a refusal there makes the primitive unusable for the M1-S20 operating model and blocks G-4/F-4/AC-F4-1. This is the reason the decision exists and it dominates.
2. **Protection placement — the real controls are content- and tree-shaped, not origin-shaped.** The safety scan, precise staging, atomicity, and convergence are what stop a bad commit. Keeping an origin refusal as the headline guard obscures where safety actually lives and invites future callers to treat session location as the safety boundary.
3. **Avoid the worse path the guard creates.** A refused caller does not stop committing; it falls back to raw-git staging with agent-authored messages — the exact token-heavy, less-constrained behavior GH-227 was built to retire. A guard that produces the behavior it was meant to prevent is negative value.
4. **Error-table honesty and single source of truth.** A five-row exact domain is stronger than a six-row table with an unreachable identity. The table is the classification authority for callers; dead rows and dead fixtures erode that authority.
5. **Model-context isolation is preserved where it belongs.** The one legitimate "do not run inside a delivery session" concern applies to the harness model call, not to the command. Keeping transport isolation while removing the command guard separates the concerns cleanly.
6. **Smallest reversible surface.** Removal is a code-reviewed deletion plus a synchronized table change — no new flag, no new session-provenance datum, no new mode. Re-adding an origin control later remains possible if evidence demands it, though adoption makes it socially costly.
7. **Residual origin-control loss (the one factor favoring the guard).** A confused or careless in-session caller can now commit. The guard was weak defense in depth: it never stopped a caller with shell access or a direct git invocation, and it is inert in production today because no producer supplies the keys.

## Decision Rights (DACI)

- **Driver:** `@pm` — GH-242 orchestration; OQ-2 and OQ-6 resolved to require this record before delivery; `@decision-advisor` analyzed and authored it.
- **Decider / Approver:** Juliusz Ćwiąkalski — the one accountable human authority. **Acceptance is pending at the GH-242 PR review and is not claimed by this record.** The positions recorded here are PM-fixed under the delegated change-scoped authority for delivery unblocking; the record stays `Proposed` with `decision_date: null` until the owner accepts.
- **Contributors:** `@spec-writer` (GH-242 DEC-3/DEC-4/DEC-5 and AC-F4-1..AC-F4-3); `@decision-advisor` (analysis, record).
- **Required reviewers:** `@reviewer` and `@readiness-reviewer` during delivery; the human owner at PR review.
- **Performers:** `@coder` removes the guard, retires the row, and updates fixtures/goldens; `@doc-syncer` reconciles the feature specs and command pages in the same change.
- **Informed:** none beyond the GH-242 change artifacts and PR.
- **Timing and escalation:** recorded during GH-242 specification, before delivery tasks execute; implementation may proceed with acceptance pending (TDR-0003/TDR-0004/TDR-0005/TDR-0012 precedent). Unresolved disagreement escalates to the owner.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| GH-227 DEC-6 requires a mechanical refusal on every commit-capable invocation, recorded as `commit.session.context-refused`, exit 1. | FACT | chg-GH-227-spec §15 DEC-6, §17 AC-F1-3, F-1 | No supersession is needed; the reversal premise disappears. | High |
| GH-242 requires `commit` and `phase complete` to succeed inside an active delivery session (AC-F4-1) and keeps the one-shot sanitized (AC-F4-2). | FACT | chg-GH-242-spec §2.1, §2.2, G-4, F-4, DEC-3, AC-F4-1..AC-F4-3 | Adoption could fit outside sessions and the guard could stay. | High |
| The refusal is implemented in the `commit` handler and in `phase complete`'s `transitionTarget` before any port is constructed. | FACT | packages/cli/src/commands/commit.ts; packages/cli/src/commands/phase.ts | A deeper enforcement site would make removal incomplete. | High |
| The production composition does not supply session environment keys today. | FACT | chg-GH-242-spec §2.1; `sessionEnvironmentKeys` appears only as a `ProductionCommitRuntimeOptions` field in packages/cli/src/edge.ts (repository grep, 2026-11-07) | Removal would be a live behavioral change for installed compositions rather than a contract change. | High |
| The safety scan, staging precision, atomicity, and convergence do not depend on caller origin. | FACT | chg-GH-227-spec F-5/F-6/F-7; doc/spec/features/feature-commit-primitive.md | Removing the guard could weaken the operative protections. | High |
| The harness one-shot creates an empty temp project, passes only the prompt, sanitizes the environment, and removes the context after the attempt. | FACT | packages/adapters/src/session/commit-one-shot.ts; chg-GH-227-spec F-4; chg-GH-242-spec AC-F4-2 | Removal could expose project or session context to the model call. | High |
| The `commit` domain is exactly six rows and the refusal row is referenced by two feature specs, two command pages, a structure test, a golden, a behaviour suite, and a result-code corpus. | FACT | packages/core/src/contracts/commit.ts; packages/core/src/contracts/error-table.ts; repository grep, 2026-11-07 | The sync surface would be smaller or larger than planned; the sync check still enforces completeness. | High |
| No external consumer depends on the refusal. | ASSUMPTION | Pre-release surface (chg-GH-242-spec RSK-5); no references outside repository tests and docs found on 2026-11-07 | External scripts referencing the code fail loudly; the PR must call out the removal. | Medium-High |
| GH-242's prompt conformance and thin `@committer` keep the primitive the only lifecycle commit path after adoption. | ASSUMPTION | chg-GH-242-spec F-3/DEC-5, F-9/DEC-11 | Removal could invite ad-hoc commits from within sessions, weakening adoption's safety story. | Medium |
| The session-facts contract and adapter remain a declared adapter surface available to other consumers after the command wiring is removed. | FACT | packages/adapters/src/session/index.ts export; doc/spec/features/feature-adapter-ports.md; chg-GH-242-spec §12 | If there is no consumer, a dead adapter surface remains; that is a cleanup question, not a reason to retain the guard. | High |
| A future session producer may inject the declared keys in production. | TO-CONFIRM | No producer today; revisit trigger 3 | A scoped origin control (ALT-1) could become relevant; it is not justified now. | — |

## Mental Models & Techniques Used

- **Inversion ("how does an unsafe commit land?"):** by unflagged content (safety scan), by staging a stray or an out-of-scope path (computed staging set), by landing half an atomic act (atomicity), or by an interrupted re-run duplicating a record (convergence). Caller origin appears nowhere in that list — the guard was answering a different question.
- **First principles (separate "who" from "what"):** origin is a caller-layer policy, while content and tree safety are primitive-layer mechanics. Once adoption makes the caller layer the intended operator, the policy's cost exceeds its protective value.
- **Second-order thinking:** a kept guard does not reduce commits; it relocates them to raw git, where staging is agent-authored and the safety scan does not run. The guard's second-order effect is less safety, not more.
- **Systems thinking:** the harness one-shot is the only place where "no delivery session context" is a real isolation property; the command guard sits at the wrong layer. Keep the isolation in the transport; remove the origin refusal from the command.
- **Opportunity cost / least mechanism (KISS):** a scoped guard or an opt-out flag adds a permanent provenance datum or flag, its tests, its documentation, and a permanent explanation of why one caller kind may commit. Removal adds nothing.
- **Reversibility asymmetry:** the code change is easy to revert, but after adoption a re-added refusal would break the primary operator again; the decision is therefore made deliberately now, with the revisit triggers named.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| Alternative | C-1 | C-2 | C-3 | C-4 | C-5 | Eligibility |
|---|---|---|---|---|---|---|
| ALT-0: keep the guard and reject adoption | ❌ | ✅ | ✅ | ✅ | ✅ | Not eligible (fails C-1) |
| ALT-1: scope the guard to bash-managed sessions only | ✅ | ✅ | ✅ | ✅ | ✅ | Eligible |
| ALT-2: remove the guard from both commands (selected) | ✅ | ✅ | ✅ | ✅ | ✅ | Eligible |
| ALT-3: keep the guard with an opt-out flag | ❌ | ✅ | ✅ | ✅ | ✅ | Not eligible (fails C-1) |

C-2, C-3, and C-5 are table stakes for ALT-1 and ALT-2 because neither touches the primitive's mechanics, the transport, or the projection. ALT-3 could satisfy C-1 in a literal sense only if every call site passed the flag, which the AC does not contemplate; the default path would still refuse.

### Alternative 0 — Keep the Guard and Reject Agent Adoption (do nothing)

- **Eligibility:** Not eligible (fails C-1).
- **Summary:** Leave GH-227 DEC-6 in force. GH-242's F-4 is dropped or deferred, and lifecycle agents keep the raw-git / `@committer` path.
- **Constraint compliance:** Fails C-1 by definition; passes C-2..C-5.
- **Driver fit:** Worst on D1, D2, D3, D5, D6; best only on D7.
- **Pros:** Retains the origin signal for any future in-session caller.
- **Cons:** Blocks the capability's primary use; forces the raw-git path that GH-227 exists to retire (agent-authored staging, no safety scan, 8–12 round trips); keeps an error row whose production trigger does not exist today.
- **Why rejected:** Disqualifying constraint violation (C-1, `negotiable: no`); it preserves a control at the cost of the behavior the control was meant to make safe.

### Alternative 1 — Scope the Guard to Bash-Managed Sessions Only

- **Eligibility:** Eligible (passes C-1..C-5, conditional on a correct session-provenance discriminator).
- **Summary:** Keep the session-facts mechanism but refuse only when the session is marked as originating from the legacy bash pipeline (`deliver-ticket.sh`/`ceo-loop.sh`); typed/agent-host sessions proceed.
- **Constraint compliance:** C-1 passes only if lifecycle sessions are never mis-marked as bash-managed; C-2/C-3/C-5 unaffected; C-4 passes because the row remains reachable through the bash path.
- **Driver fit:** Partial on D7 (keeps an origin control where an automated dispatcher runs); poor on D1 (mis-set or missing provenance silently re-blocks adoption — the exact failure being fixed), D3 (a new provenance fact, key convention, tests, docs, and a permanent two-mode explanation), D4 (a second session class in the table's rationale), D6 (permanent surface).
- **Pros:** Preserves a refusal for the one caller class that is most automated.
- **Cons:** Adds a session-provenance contract that does not exist today; the bash pipeline does not invoke the typed `commit` at all (repository grep, 2026-11-07) and no production producer supplies the keys, so the discriminator would protect a caller that never uses the primitive; every future session host must set the datum correctly or adoption breaks again.
- **Why rejected:** It pays a new classification contract to protect a caller class that does not use the primitive, and its failure mode is the same adoption block it is meant to avoid.

### Alternative 2 — Remove the Guard from Both Commands (selected)

- **Eligibility:** Eligible (passes C-1..C-5).
- **Summary:** Delete the session-facts refusal from `commit` and `phase complete` in every mode; keep the harness one-shot's sanitized empty project context; retire the error row and synchronize every surface.
- **Constraint compliance:** C-1 by removing the refusal; C-2/C-3/C-5 by leaving the primitive's mechanics and transport untouched; C-4 by removing the row with its documented counterpart, fixtures, goldens, and prose in one change.
- **Driver fit:** Best on D1 (adoption works everywhere the operators run), D2 (safety stays where it actually lives), D3 (no raw-git fallback or bypass flag), D4 (exact five-row domain), D5 (transport isolation preserved), D6 (smallest surface).
- **Pros:** Unblocks M1-S20 without a new mode; keeps commits on the scanned, precisely staged, atomic primitive; leaves one behavior everywhere; deletes rather than adds code.
- **Cons:** Loses the origin signal (D7); a behavioral change and a table change must be called out and synchronized.
- **Why chosen:** See Decision.

### Alternative 3 — Keep the Guard with an Opt-Out Flag or Configuration Key

- **Eligibility:** Not eligible (fails C-1).
- **Summary:** Retain the default refusal and add `--allow-inside-session` (or a project configuration key) so in-session callers can bypass it.
- **Constraint compliance:** Fails C-1: AC-F4-1 requires the invocation to proceed without a refusal, not to proceed only when a caller remembers a flag. Passes C-2..C-5.
- **Driver fit:** Good on D1 only for callers that always pass the flag; poor on D3 (a permanent bypass surface), D4 (two behaviors and two documentation paths), D6 (new flag, new tests, prompt burden).
- **Pros:** Retains an origin check for callers that do not opt out.
- **Cons:** Every prompt and thin `@committer` path must carry the flag; a missed flag is a silent refusal in the middle of delivery; the bypass becomes the normal path, which is the guard with extra steps.
- **Why rejected:** Disqualifying constraint violation (C-1, `negotiable: no`); it preserves the refusal's cost while removing its protective value.

## Decision

- **Decision:** **ALT-2.**

1. **Remove the delivery-session refusal from `commit` and `phase complete`.** Every mode runs identically inside and outside a delivery session, including `--dry-run`, `--phase`, and `--no-commit`. The primitive's deterministic safety scan, precise staging, atomic record-plus-commit, and re-run convergence remain the protections and are unchanged.
2. **Keep the harness one-shot transport context-isolated.** The single model call continues to run in a temporary empty project context with a sanitized environment carrying no delivery-session facts and no project configuration, removed after the attempt including on failure.
3. **Retire `commit.session.context-refused`.** The `commit` error domain shrinks from six rows to five. The machine table, documented table, fixtures/goldens, result-code corpora, result-contract prose, feature specs, and command pages change together; the sync check stays green.
4. **Supersede GH-227 DEC-6.** This record is the durable authority for the reversal and the replacement rationale. GH-227 DEC-6 is a change-spec decision-log entry rather than a decision record, so `links.supersedes` stays empty by the record-ID convention; the supersession is stated here and in the GH-242 spec's DEC-3, which already names this record.

- **Rationale (tied to drivers):** C-1 is the decision's reason: the operators are in sessions, so a refusal at that boundary is an adoption block. Removing it restores the primitive to its only intended role and keeps lifecycle commits on the scanned, precisely staged, atomic path instead of forcing the raw-git fallback (D1, D3). The controls that actually prevent a bad commit are content- and tree-shaped and do not depend on caller origin (D2), and the one genuine context-isolation requirement remains in the transport where it belongs (D5). Retiring the row keeps the error table exact rather than documenting an identity no production path can produce (D4). The change adds no flag, mode, or provenance datum (D6). The only cost is the origin signal (D7), which was weak defense in depth, inert in production, and never a barrier to a caller with shell access.
- **Decider:** Juliusz Ćwiąkalski — acceptance pending at the GH-242 PR review; not claimed by this record. Positions are PM-fixed under the delegated change-scoped authority for delivery unblocking.
- **Conditions for revisit:** See `revisit_triggers` in the front matter; primary ones are evidence that the protections were not independent of the guard, an owner or security reassertion of GH-227 guardrail #6, and any future autonomous caller (M1-S9 dispatch, M1-S18 daemon) whose commit rights must be bounded.

### Constraint Compliance Attestation

The chosen alternative satisfies every constraint. C-1: no refusal branch remains in either command, so in-session invocations proceed under normal rules (AC-F4-1; verified by the replacement in-session behaviour cases). C-2: the safety scan, computed staging set, atomic act, and convergence are untouched and their existing suites remain the gate (GH-242 NG-7). C-3: the one-shot's temp-directory/sanitized-environment/removal behavior is untouched (AC-F4-2). C-4: the row is removed from the machine table, documented table, fixtures/goldens, corpora, and prose in one change; the domain is exactly five rows and the sync check stays green (DM-3, AC-F4-3). C-5: no exit or envelope change; exits remain derived from projection classes within `{0, 1, 2}`. No accepted-risk exceptions are taken against any constraint.

## Trade-offs & Consequences

### Positive Outcomes

- Lifecycle agents commit and complete phases where they operate; M1-S20's core adoption path is unblocked without a new mode or flag.
- Commits stay on the deterministic safety scan, precise staging, atomic record-plus-commit, and convergent re-runs instead of falling back to raw-git staging and agent-authored messages.
- The error table becomes exact: five `commit` rows, all reachable, all documented, all tested.
- The model-call isolation requirement stays explicit in the transport, where it can be tested as a transport property rather than inferred from command behavior.
- The change is a deletion plus a synchronized table edit — no new contract, flag, or classification.

### Negative Outcomes

- **Origin signal lost (RSK-2):** a confused or careless in-session caller can commit. Bounded by: the fail-closed safety scan, computed staging set (no untracked strays), atomicity, no push, no history rewrite, lifecycle prompt conformance and the thin `@committer` (GH-242 F-3/F-9), and review. The guard never stopped a caller with shell access or a direct git invocation.
- **Behavioral change for any consumer that relied on the refusal:** callers no longer get `commit.session.context-refused`. This is the point of the change and must be stated in the GH-242 PR description (RSK-5). The surface is pre-release.
- **Table change is cross-cutting:** a half-removal would leave the machine table, documented table, fixtures, or prose disagreeing. The sync check is the guard against that; the implementation must move all surfaces in one change.
- **Re-adding the guard later is costly:** after adoption, a reinstated refusal would break the primary operator again. This is accepted deliberately and bounded by the revisit triggers.
- **A dead session-facts seam may remain in the CLI composition** if nothing else consumes it; it stays a declared adapter surface (GH-242 §12), and removing a public contract is out of scope for this reversal.

### Unresolved Questions

- [ ] Confirm at delivery that no production composition supplies `sessionEnvironmentKeys` and that removing the command wiring leaves no dangling required dependency (owner: `@coder`).
- [ ] Decide the fate of the `sessionFacts` field on the commit/phase runtimes: remove the wiring; keep the `CommitSessionFacts` contract and adapter export as a declared adapter surface (owner: `@coder`, reviewed by `@reviewer`).
- [ ] Ensure the replacement tests assert the positive in-session path, not merely the absence of the code string, so AC-F4-1 has behavioural evidence (owner: `@coder`/`@test-plan-writer` as GH-242 delivery requires).
- [ ] Call out the behavioral change and row retirement in the GH-242 PR description (owner: `@pr-manager`/`@pm`).

## Implementation Plan

1. `@coder` removes the session-facts refusal from the `commit` command handler and from `phase complete`'s `transitionTarget`, and removes the now-unused `sessionFacts` wiring from the commit/phase command runtimes. The `CommitSessionFacts` contract and the adapter export stay (declared adapter surface; no public-contract removal in this change).
2. `@coder` removes `commit.session.context-refused` from `COMMIT_ERROR_CODES` and `ERROR_TABLE`, and replaces the refusal suites with in-session positive behaviour cases: `commit`, `commit --dry-run`, `commit --phase`, `phase complete`, and `phase complete --no-commit` all proceed inside an active session; the one-shot isolation test (AC-F4-2) remains.
3. `@doc-syncer` reconciles every synced surface in the same change: the documented result-contract row and the six-row references, the commit-primitive "Session guard" section and command/exit tables, the phase-transitions mention, the two command reference pages, and the result-code corpora/goldens. The two-way sync check is the completion gate.
4. `@pm`/`@pr-manager` state in the GH-242 PR description that `commit` and `phase complete` now run inside delivery sessions, that `commit.session.context-refused` is retired, and that the harness one-shot remains sanitized.

## Verification Criteria

- **AC-F4-1:** In-session `commit` and `phase complete` (all modes) return their normal success or normal classified failure — never `commit.session.context-refused`; nothing about the tree, head, or ledger changes because of caller origin.
- **AC-F4-2:** The harness one-shot still creates an empty temp project containing only the prompt, passes a sanitized environment, and removes the context on success and failure.
- **AC-F4-3:** This record exists, names the reversal, and supersedes GH-227 DEC-6; the GH-242 spec references it (already in DEC-3/OQ-2).
- **Error-table exactness:** `COMMIT_ERROR_CODES` has exactly five entries; machine and documented tables agree; the structure/sync tests and goldens are green; zero repository references to the retired code outside historical change artifacts.
- **Protection continuity:** the safety, staging, atomicity, and convergence suites are unchanged and green (GH-242 NG-7); no exit outside `{0, 1, 2}`; no envelope shape change.
- **PR disclosure:** the GH-242 PR description calls out the behavioral change and the row retirement.

## Confidence Rating

**High.** Every load-bearing fact is repository-local and read directly: the two guard sites, the session-facts adapter, the six-row error table, the one-shot isolation implementation, and both change specs' decisions and ACs. The protections' independence from caller origin is stated by GH-227 and enforced by existing suites. The residual uncertainties are bounded, not hidden: no external consumer is assumed (Medium-High) and the prompt conformance that keeps the primitive the only commit path is an assumption (Medium), both with named revisit triggers. AI-generated confidence is not evidence; the owner's acceptance at GH-242 PR review is the authoritative signal.

## References

- **Superseded decision:** GH-227 DEC-6 (change-spec decision log, `chg-GH-227-spec.md` §15) — replaced by this record; the historical change artifact is not rewritten.
- GH-227 change spec: `doc/changes/2026-11/2026-11-05--GH-227--commit-primitive/chg-GH-227-spec.md` — NG-1 (§4.2), F-1/F-4/F-5/F-6/F-7 (§5.1), DM-4 (§8.3), DEC-6 (§15), AC-F1-1/AC-F1-3 (§17).
- GH-242 change spec: `doc/changes/2026-11/2026-11-07--GH-242--agent-integration/chg-GH-242-spec.md` — §2.1/§2.2, G-4, F-4 (§5.1), DM-3 (§8.3), §8.5, RSK-2/RSK-5 (§11), §12, DEC-3/DEC-4/DEC-5 (§15), OQ-2/OQ-6 (§14), AC-F4-1..AC-F4-3 (§17).
- Commit primitive feature spec: `doc/spec/features/feature-commit-primitive.md` — "Session guard", command/exit tables, safety/staging/atomicity/convergence contracts.
- Result contract feature spec: `doc/spec/features/feature-result-contract.md` — `commit` domain rows and the sync-check binding.
- Phase transitions feature spec: `doc/spec/features/feature-pm-notes-lint-and-phase-transitions.md` — the `commit.session.context-refused` mention retired with the guard.
- Implementation: `packages/cli/src/commands/commit.ts`, `packages/cli/src/commands/phase.ts`, `packages/adapters/src/session/delivery-session-facts.ts`, `packages/adapters/src/session/commit-one-shot.ts`, `packages/core/src/contracts/commit.ts`, `packages/core/src/contracts/error-table.ts`.
- [TDR-0005](TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md) — result-enum/exit-taxonomy and error-table discipline this retirement follows.
- [TDR-0012](TDR-0012-blockers-credential-guard-pattern-deferral.md) — PM-fixed-positions/acceptance-pending governance precedent.
