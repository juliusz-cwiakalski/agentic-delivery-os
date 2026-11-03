---
id: TOOLING-INCEPTION-PHASE-4-GLOSSARY
status: Draft
created: 2026-11-02
last_updated: 2026-11-02
owners: [bootstrapper]
document_classification: working-analysis
links:
  related_changes: [GH-200]
summary: "Exact authorized glossary delta applied; all thirteen tribal items have bounded dispositions."
---

# Phase 4 glossary and graduation

## Authority and actual glossary check

The [Phase 2 audit](tribal-knowledge-graduation.md) remains the corrected reading
of the [mined record](tribal-knowledge.md). OPEN-Q10/11 remain DEFERRED. This
record initially proposed no writes. OPEN-Q20 now authorizes the exact delta;
seven rows below are applied at the [glossary](../../overview/glossary.md).
The [UL](../../overview/ubiquitous-language.md) supplies approved thin navigation.

Inspected [glossary](../../overview/glossary.md) at HEAD `35565b9`: `Primitive
port`, `Provider engine`, `Composition root`, `State fence`, `State level`,
`Ceremony share` and measurement terms already exist. `Domain kind` appears
once. Two identical `Empty-but-enforced` rows remain, one under Terms and one
under Acronyms. No conflicting-definition or duplicate-frontmatter-key claim
is repeated. Ceremony share already names the recorded-duration proxy, so no
new definition or claim of measured active-agent effort is needed.

## Exact applied additions for missing TK-07..13 terms

These seven Terms-table rows are now applied, with links relative to their home. Related
links name canonical homes. No catalogue inventory is copied.

| Term / acronym | Definition | Category | Related UL term |
|---|---|---|---|
| Primitive | A stable composable semantic contract, including typed data, from which commands and engines build behavior. Names, contracts and lifecycle inventory belong to the primitive catalogue. | Domain | [Catalogue](../../planning/concepts/primitive-catalogue.md#what-a-primitive-is-and-is-not), [UL](../../overview/ubiquitous-language.md#disambiguation-at-boundaries) |
| Harness | The execution host for agent sessions. Existing prompt/plugin support is distinct from planned typed cross-harness dispatch parity. | Execution | [Harness adapters](../../planning/concepts/harness-adapters.md) |
| Model profile | A named agent-to-model mapping in the planned model-policy design; not a profile class and not current provider-v1 model selection. | Model policy | [Model profiles](../../planning/concepts/model-profiles.md) |
| Profile class | A group of model profiles organized by task difficulty; working class names are not individual profiles or a new naming freeze. | Model policy | [Model profiles](../../planning/concepts/model-profiles.md) |
| Dual-run | Migration mode comparing a replacement engine with the shell while the shell remains authoritative until explicit per-engine parity and cutover evidence. It does not establish an observed clean pilot window. | Migration | [Roadmap](../../planning/oss-tooling/roadmap.md), [UL](../../overview/ubiquitous-language.md#disambiguation-at-boundaries) |
| Single-flight | The scheduled default of one delivery per repository, keyed by repository remote identity rather than checkout path. Scoped parallel leases are a designed mode, not an implemented scheduler guarantee. | Scheduling | [Parallel delivery](../../planning/concepts/parallel-delivery.md) |
| Strangler | Engine-by-engine migration using wrappers to retain working commands, with old tools retired after parity and explicit authority transfer. | Migration | [Roadmap](../../planning/oss-tooling/roadmap.md), [UL](../../overview/ubiquitous-language.md#disambiguation-at-boundaries) |

TK-12 needs no new row: retain the existing `Ceremony share` wording and its
measurement-spec link unchanged. UL supplies the owner-attention distinction;
the roadmap's below-40-percent trend target is not an achieved measurement.

## Bounded deduplication verification

At the initial inspection above, two identical rows existed. Integration of
`main-tools` `5330809` already removed the Acronyms duplicate and updated the
retained Terms row with both closeout and verify-gates contributions. Verified:
exactly one `Empty-but-enforced` row remains. No second deletion or inventory
rewrite is appropriate. This remediation adds only the seven authorized reader
rows; no broader rewrite or shared-hotspot union convention follows.
OPEN-Q20 supplies the permission previously requested by OPEN-Q18.

## All thirteen items accounted for

| Item | Current disposition and Phase 4 effect |
|---|---|
| TK-01 | Already housed: branch model and PR configuration; no historical ODR. |
| TK-02 | Already housed: M0-S16 and delivery-modes guide; story constraint is not a project-wide shell ban. |
| TK-03 | Held as run-specific owner-facing punctuation direction. These drafts comply; no project-wide rule or shared handbook edit is proposed here. |
| TK-04 | Already housed: branch naming, Conventional Commit review and squash guidance; no stronger ticket-ref policy inferred. |
| TK-05 | Held: unsupported shared-hotspot union convention does not graduate. Parallel-delivery concept remains canonical. |
| TK-06 | Already housed: shell artifact-first closeout/backoff; typed closeout delivery remains subject to integrated evidence, not this draft. |
| TK-07 | Catalogue/adapter-port contract already housed; missing reader term proposed above; new UL draft adds relationship navigation only. |
| TK-08 | Harness concept/Proposed ADR-0008 already housed; missing reader pointer proposed, UL marks current/planned distinction. |
| TK-09 | Model-profiles concept already housed; two missing terms proposed, correcting profile versus class; UL does not implement ModelPolicy. |
| TK-10 | Roadmap/backlog already house migration authority; missing reader term proposed, UL adds authority relationship. |
| TK-11 | Parallel-delivery/backlog already house scheduled policy; missing reader term proposed, UL separates lease from local state fence. |
| TK-12 | Already housed in glossary, measurement spec and log; no addition. UL links proxy versus direct owner attention. |
| TK-13 | Roadmap/north star/registry already house migration strategy; missing reader pointer proposed, no new ADR. |

Accounting: 13/13 dispositions; seven applied rows covering six missing TK
topics, one already-housed TK topic requiring no row, one identical duplicate
already removed by integration. The table's original proposal descriptions are
historical rationale; the applied glossary and this verification close READY-B3.
Held TK-03/05 remain intentionally unpromoted; historical snapshots are untouched.
