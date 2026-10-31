---
id: TOOLING-INCEPTION-TRIBAL-GRADUATION
status: Draft
created: 2026-10-31
last_updated: 2026-10-31
owners: [bootstrapper]
area: engineering
document_classification: working-analysis
links:
  related_changes: [GH-200]
summary: "Audit of all 13 mined items, separating existing homes, proposed graduation, and unsupported inference."
---

# Tribal knowledge: graduation audit

Gate 2 proposal, not a graduation-completed record. The
[mined record](tribal-knowledge.md) labels items graduation-ready for phase 2.
Gate 0 intake approval does not ratify new operating/architecture decisions
or authorize inferred conventions. This audit tests the mined claims before
the phase 2 graduation gate, without rewriting the intake snapshot.

## Item-by-item disposition

TK IDs below retain the mined row numbers. Source presence supports a fact
about the source's contract, not a claim that planned behavior is implemented.

| Stable ID | Category audit and evidence | Permanent home / disposition proposed for gate 2 |
|---|---|---|
| TK-01 | Reclassify `decision` to existing operating configuration. AGENTS branch model and `.ai/agent/pr-instructions.md` explicitly target `main-tools`; removal of a guard in a commit is history, not a new decision to author. | Already housed in AGENTS and PR configuration. Link from later architecture/governance overview if useful; no new ODR seed from a commit message. |
| TK-02 | Reclassify `decision` to story-scoped transition constraint. M0-S16 says docs/config only, no shell behavior changes; it does not ban every shell feature across the entire transition window. | Already housed in [M0-S16](../../planning/oss-tooling/backlog.md#m0-s16-interim-mitigations-docs-and-config-only) and [delivery modes](../../guides/delivery-modes.md#interim-mitigations-permission-denial-and-the-join-warning). Do not turn a completed story's constraint into a global rule or unrelated feature limitation. |
| TK-03 | `convention` is supported as owner direction for owner-facing artifacts. Observed style alone would not establish repository-wide policy. | Apply to these drafts. Propose a narrow project writing preference at phase 4, only after gate 2 approval; shared handbook/framework changes require separately routed delivery. |
| TK-04 | Split combined convention: branch shape is explicit in AGENTS and the unified change guide; Conventional Commit review is explicit in code-review instructions; squash is documented in delivery modes. Git subjects alone do not prove mandatory ticket-ref syntax for every commit. | Already housed in [branch naming](../../guides/unified-change-convention-tracker-agnostic-specification.md#branch-naming-convention-conventional-commit-aligned), review instructions, and delivery modes. No duplicate rule and no stronger requirement inferred from examples. |
| TK-05 | Mixed fact and inference. [Parallel-delivery concept](../../planning/concepts/parallel-delivery.md) designs isolated worktrees, default single-flight and explicit arbitration. It does not establish a shared-hotspot "union" resolution convention. Observed worktrees do not ratify that convention. | Keep concept canonical; unsupported union convention does not graduate. Owner approval and exact scope/evidence required before any rule proposal. This inception run's integration/worktree-read permission does not change delivery policy. |
| TK-06 | Reclassify `workaround` to documented current shell behavior: artifact-first classification and bounded exponential polling are not evidence of typed post-merge closeout implementation. The two meanings of closeout must remain distinct. | Already housed in [delivery modes](../../guides/delivery-modes.md#close-out-contract-artifact-first-classification), including polling configuration. Future typed-closeout limitations belong to its delivered spec when GH-183 lands, only if still real. |
| TK-07 | `domain-term`, but refine definition: a primitive is a stable composable semantic contract, not simply an operation. A command/engine composes primitives; a primitive can also be typed data. | Already housed in [primitive catalogue](../../planning/concepts/primitive-catalogue.md#what-a-primitive-is-and-is-not) and adapter-port spec. Propose a short glossary pointer and thin UL relationship at phase 4; do not copy catalogue rows or maturity inventory. |
| TK-08 | `domain-term` supported as runtime host; plugin support today and future typed dispatch-adapter parity are different states. | [Harness-adapter concept](../../planning/concepts/harness-adapters.md) owns design; M1-S11 owns delivery, M3-S1 surfaces. Propose glossary/UL pointer with planned-versus-current distinction, not a claim both typed delivery adapters ship now. |
| TK-09 | `domain-term` needs correction: a profile is a named agent-to-model mapping; lite/regular/powerful are profile classes, not individual profiles. ModelPolicy is planned; provider v1 does not select models. | [Model-profiles concept](../../planning/concepts/model-profiles.md) already owns the proposal. Proposed phase 4 pointer labels it planned; no new primitive definition or frozen class names. |
| TK-10 | `domain-term` supported as migration mode with explicit authority. No evidence here that two clean weeks have elapsed. | Already housed in roadmap principles, registry strangler mapping and [M1-S9](../../planning/oss-tooling/backlog.md#m1-s9-dispatch-dual-run-pilot). Proposed glossary explanation links those homes; UL only states the authority relationship. |
| TK-11 | `domain-term` is a scheduled policy invariant, not a claim all current worktrees obey remote-keyed leases. Distinguish repository remote identity from checkout path. | [M2-S1](../../planning/oss-tooling/backlog.md#m2-s1-queue-lanes-dispatch) and parallel-delivery concept own policy/seam. Proposed UL pointer keeps repo-exclusive default and dormant scoped leases distinct. |
| TK-12 | `domain-term` is a metric definition/hypothesis: ceremony time as a fraction of active agent time. Below 40 percent is an M2 trend target, not a measurement or current result. | Roadmap M2 and [M2-S3](../../planning/oss-tooling/backlog.md#m2-s3-ceremony-runner) own target; GH-186 owns baseline definition. Proposed glossary pointer; attention NSM still needs its own collection contract (XC-009). |
| TK-13 | `domain-term` supported as migration strategy, not a newly inferred architectural choice. The cited AGENTS branch-model line does not substantiate migration mechanics. | Already housed in north-star principles, roadmap principles, registry strangler mapping, M3-S7 and M4-S5. Proposed glossary explanation links these; no new ADR from historical commits. |

## Proposed permanent changes, not yet written

1. **Phase 4 glossary and thin UL:** add only missing reader-friendly entries
   or pointers for TK-07 through TK-13; distinguish profile from class. UL owns
   bounded-context relationships (primitive vs command/engine/surface, harness
   session, repo lease, authoritative vs shadow result), pointing to canonical
   concepts and specs. The primitive catalogue retains names, contracts and
   lifecycle. Do not recreate its inventory.
2. **Targeted glossary/state-spec reconciliation:** retain both merged engines'
   references and semantics, remove duplicate metadata keys, and reconcile the
   conflicting `Domain kind` / `Empty-but-enforced` glossary rows. These are
   observed content defects, not support for a general union policy. Owner
   selects correction route at OPEN-Q11; actual writes need that approval.
3. **Writing preference:** approve narrow owner-facing punctuation scope for
   phase 4 proposal (TK-03), or retain as run-specific direction. No shared
   rule/handbook write is authorized by this draft.
4. **No new historical decisions:** TK-01/02/04/06 are already housed or
   overgeneralized; TK-05's union rule is unsupported. M0-S17/GH-186 remains
   the ratification home for the separate foundational decision batch. Any
   phase 3 seed must show current options and evidence, not manufacture a
   decision from a commit subject.

## Graduation accounting and review

All 13 mined rows audited. Existing homes are identified above; none was
physically promoted by this drafting task. Missing navigation/terminology and
the writing preference remain proposals. Unsupported inference is explicitly
held, not silently graduated. The mined record's "no contradictions" snapshot
does not clear the integration defects observed during this review.

Bootstrapper prepares approved wording, reviewer verifies canonical-home and
duplicate-content checks, and Owner approves scope. Gate 2 must choose the
proposals and later writing phase/route. Deferred graduation is incomplete
until actual permanent writes and their verification are recorded; phase 6
must check that debt rather than infer completion from this mapping.

See [OPEN-Q10 and OPEN-Q11](../open-questions/phase-2-open-questions.md),
[coverage](phase-2-scope-and-coverage.md), and [risks](risks.md).
