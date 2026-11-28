---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/juliusz)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/structured-change-artifacts/11-glossary.md
---
# 11. Glossary

| Term | Meaning |
|---|---|
| **Stored artifacts** | What the tool writes for a change and keeps in git: the contract, the typed open items and the handovers. The milestone contract is deferred. |
| **Contract** | One typed file per change, written in one pass: goal, scope and non-goals; acceptance criteria; verified facts; decisions and open questions; the oracle; work (phases and steps); and risk flags. Its small form is the card of a light change (`15-classification-and-rounds.md`, section 5). |
| **Shape** | Light, flagged or phased. Light: no flag, one phase, few decisions. Flagged: one or more flags, each adding its add-on. Phased: three or more phases, or decisions that need a record. The surface, the decisions and the oracle decide it, never lines. |
| **Contract author** | The agent that writes the contract: a new agent, built from the plan-writer's prompt (paths, steps, verify commands) and the specification writer's contract sections. The contract is the registry that allocates its identifiers; the tool mints them on the author's write. |
| **Acceptance author** | The test-plan-writer with a different job: invoked only by the `security` and `data` flags, it writes the acceptance tests before the coder starts, and the coder may not edit them (decision 24). |
| **Pre-code reader** | The adversarial reader of a flagged or phased change, after the preflight: one pass over the side effects of the design, contract gaps and test adequacy, returning typed findings and never a document. In the light shape the coder is the first reader (decision 35). |
| **Obligation** | The link from a criterion to its proof (`PROOF-`): the claim, the observable, the predicate, the method, the boundary, the test reference or the command with its expected output, the expected baseline, and whether it is required for merge (`16-testing-in-a-change.md`, section 2). |
| **Leg** | One half of a run: the base leg on the merge-base tree with the change's test files added, and the candidate leg on the candidate. The base leg runs once per change, for the acceptance obligations. |
| **Surface map** | The path patterns per repository that assign risk flags. The tool reads it from the merge base, in the lane and again in CI; a change that touches it takes the policy flag and needs the owner's sign-off (decision 38). |
| **Cost record** | One aggregate record per change, written by the tool at closeout to the repository's measurement log. Token figures stay in the host-local telemetry and never enter the committed capsule (decision 36). |
| **Bundle** | A bounded, ordered projection of the stored artifacts for one role at one moment, with a `missing` list and a source revision. The only way an agent reads an artifact. |
| **Context contract** | The written rule for a role: the facts it must have, the facts it may fetch on demand, and the facts it never needs. |
| **Miss rate** | The share of bundles after which the agent fetched an additional section. The main evidence that a context contract is right. |
| **Handover** | A bounded, typed record of what the next phase needs: done, deviations, open risks, next inputs, evidence references (never evidence bodies). |
| **Affected path** | A file that a phase of the contract's Work section declares it will add, modify, or delete, with read or write access. The scheduler's input and the audit's baseline. |
| **Conflict class** | The result of comparing two changes' declared paths: disjoint, read-only overlap, write overlap, contract overlap, test overlap, order dependency, generated or lockfile. |
| **Phase and step** | The two levels of the Work section, with stable identifiers: a phase is `PH-02`, a step is `PH-02_S03`. Distinct from a lifecycle phase. |
| **Lifecycle phase** | One phase of the change lifecycle (`clarify_scope`, `delivery`, ...), called a state in `15-classification-and-rounds.md`, section 5, which lists the states, gates, agents and writers of each shape. |
| **Gap** | A specific, referenced deficiency found by a gate or a reviewer: an acceptance criterion without an obligation, a phase without a verify command, a scope contradiction. |
| **Gap bundle** | A bundle that contains only the gap, the related criteria and decisions, and the shape's rules. The alternative to rereading the whole contract. |
| **Reopen** | A lifecycle phase going back to an earlier one because a gap was found. Recorded as an event. |
| **Tool commit** | A commit made by the CLI for an artifact write, with the `Jaiship-Tool` and `Change-Ref` trailers, pathspec-only, squashed at merge. |
| **Provenance** | The evidence that the tool wrote an artifact: the commit trailer and the `generatedBy` field. It proves attribution by convention, not identity. |
| **Untyped edit** | A hand edit of an artifact outside the CLI. Detected by lint and CI; not an accusation, a defect to correct. |
| **Generated field** | A field the tool computes and overwrites, such as the revision and the provenance header. The tool also mints the identifiers on the author's write. |
| **Milestone contract** | Deferred. The shared goals, scope, architecture, dependency graph, test strategy, and definition of done for a milestone. The example is in `schemas/deferred/milestone.yaml`. |
| **Extension slot** | A declared free-text field in the contract, with an audience (`useIn`) or `archive: true`, and a word guide. At most three per contract. |
| **`contextFor`** | The per-phase, per-role map that declares what a bundle includes and excludes. The tool's mandatory set cannot be excluded. |
| **Workflow template** | The parameterized state machine selected at intake: light, flagged, phased, or a named workflow. It defines the states, gates, and artifacts; the PM can add a state with a reason, never remove a mandatory gate. |
| **Exception budget** | The rule that a deterministic path with more than three exception cases is a judgment task, not a rule. |
| **Repair path** | The recorded path for a broken artifact repaired by hand or by an agent: it starts from a failing lint, then validates, commits, and stamps `Repaired-By`. |
| **Goal verification** | The independent check, at the end of a milestone, that each goal's measure is evidenced. |
| **Working memory** | The PM brief: the current state and the typed open items, read at every step. |
| **Durable memory** | The decision records: append-only, referenced by ID, read on demand. |
| **Episodic memory** | The handovers: one bounded entry per phase. |
| **Evidence memory** | The events of a change, which the retrospective reads. There is no separate retrospective log. |
| **Anchor** | The section a bundle starts from: the phase for a coder, the diff and the contract for a reviewer, the state and the open items for the PM. |
| **`missing` list** | The sections a bundle omitted, with the command to fetch each one. |
