---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://www.x.com/juliusz)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/structured-change-artifacts/11-glossary.md
---
# 11. Glossary

| Term | Meaning |
|---|---|
| **Facet** | One kind of fact about a change, owned by one role and written through one command family. The five core facets are specification, test plan, delivery plan, PM context, and handover. The milestone contract is deferred. |
| **Bundle** | A bounded, ordered projection of the facets for one role at one moment, with a `missing` list and a source revision. The only way an agent reads an artifact. |
| **Context contract** | The written rule for a role: the facts it must have, the facts it may fetch on demand, and the facts it never needs. |
| **Miss rate** | The share of bundles after which the agent fetched an additional section. The main evidence that a context contract is right. |
| **Handover** | A bounded, typed record of what the next phase needs: done, deviations, open risks, next inputs, evidence. |
| **Affected path** | A file a plan phase declares it will add, modify, or delete, with a producer or consumer role. The scheduler's input and the audit's baseline. |
| **Conflict class** | The result of comparing two changes' declared paths: disjoint, read-only overlap, write overlap, contract overlap, test overlap, order dependency, generated or lockfile. |
| **Tier** | S, M, or L. The artifact set, the review depth, and the gate cost scale with it. |
| **Plan phase** | A phase inside the delivery plan (`P1`, `P2`, ...). Distinct from a lifecycle phase (`clarify_scope`, `delivery`, ...). |
| **Lifecycle phase** | One of the eleven phases of the change lifecycle. The delivery lifecycle phase contains the plan phases. |
| **Gap** | A specific, referenced deficiency found by a gate or a reviewer: an acceptance criterion without a test, a phase without a verify command, a scope contradiction. |
| **Gap bundle** | A bundle that contains only the gap, the related criteria and decisions, and the tier rules. The alternative to rereading the whole artifact. |
| **Reopen** | A lifecycle phase going back to an earlier state because a gap was found. Recorded in the phase registry and the PM context. |
| **Tool commit** | A commit made by the CLI for an artifact write, with the `Jaiship-Tool` and `Change-Ref` trailers, pathspec-only, squashed at merge. |
| **Provenance** | The evidence that the tool wrote an artifact: the commit trailer and the `generatedBy` field. |
| **Untyped edit** | A hand edit of an artifact outside the CLI. Detected by lint and CI; not an accusation, a defect to correct. |
| **Generated field** | A field the tool computes and overwrites: coverage, the affected-path union, status, revision, `generatedBy`. |
| **Milestone contract** | Deferred. The shared goals, scope, architecture, dependency graph, test strategy, and definition of done for a milestone. The example is in `schemas/deferred/milestone.yaml`. |
| **Extension slot** | A declared free-text field in a facet, with an audience (`useIn`) or `archive: true`, and a word budget. At most three per facet. |
| **`contextFor`** | The per-phase, per-role map in the delivery plan that declares what a bundle includes and excludes. The tool's mandatory set cannot be excluded. |
| **Workflow template** | The parameterized state machine selected at intake: S, M, L, or a named workflow. It defines the states, gates, and artifacts; the PM can add a state with a reason, never remove a mandatory gate. |
| **Exception budget** | The rule that a deterministic path with more than three exception cases is a judgment task, not a rule. |
| **Repair path** | The recorded path for a broken artifact repaired by hand or by an agent: validate, commit, and stamp `Repaired-By`. |
| **Goal verification** | The independent check, at the end of a milestone, that each goal's measure is evidenced. |
| **Working memory** | The PM context: small, volatile, read at every phase boundary. |
| **Durable memory** | The decision records: append-only, referenced by ID, read on demand. |
| **Episodic memory** | The handovers: one bounded entry per plan phase. |
| **Evidence memory** | The retrospective log: append-only, written from gate and review evidence, read at retro only. |
| **Anchor** | The facet a bundle starts from: the plan phase for a coder, the diff and contract for a reviewer, the PM context for the PM. |
| **`missing` list** | The sections a bundle omitted, with the command to fetch each one. |
