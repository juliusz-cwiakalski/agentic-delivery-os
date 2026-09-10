---
id: ADR-0003
decision_type: adr
status: Proposed
created: 2026-09-08
decision_date: null
last_updated: 2026-09-08
summary: "Allocate repo-local KG-<NNNN> identifiers to broad durable Knowledge Gaps while preserving narrower existing UNK-* identifiers and remaining compatible with GH-140."
owners:
  - "Juliusz Ćwiąkalski"
service: project-knowledge-management
decision_scope: product-line
review_date: null
business_impact: "Gives GH-41 a stable, portable Knowledge Gap namespace without blocking on or prematurely delivering the framework-wide prefix catalogue in GH-140."
customer_impact: "Adopting projects can cite durable knowledge-health defects consistently without renumbering their existing unknown records."
classification:
  domains: [architecture, documentation, knowledge-management]
  archetype: standard
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: medium
  urgency: high
  uncertainty: medium
  blast_radius: customers
  recurrence: recurring
governance:
  driver: "@decision-advisor"
  decider: "Juliusz Ćwiąkalski (final acceptance through GH-41 PR review)"
  contributors:
    - "GH-41 issue owner and repository evidence"
    - "GH-140 issue and owner-comment context captured in GH-41 PM notes"
    - "Project Knowledge Management delivery brief"
  reviewers:
    - "Juliusz Ćwiąkalski (GH-41 PR)"
  performers:
    - "GH-41 delivery team"
  informed:
    - "ADOS maintainers and adopting projects"
ai_assistance:
  used: true
  roles: [repository-analyst, evidence-organizer, option-generator, analyst, record-writer]
  external_data_shared: false
  citations_verified: false
  human_decider: null
  reviewers: []
revisit_triggers:
  - "GH-140 accepts a catalogue contract whose scope, body grammar, allocator metadata, or qualification serialization conflicts with this record."
  - "A repository approaches KG-9999 or four-digit allocation becomes operationally insufficient."
  - "Evidence shows broad Knowledge Gaps and narrow Unknowns need a formal cross-registry relationship beyond links and classification."
links:
  related_changes: ["GH-41", "GH-140", "GH-139"]
  supersedes: []
  superseded_by: []
  spec: []
  contracts: []
  diagrams: []
  decisions: []
  experiments: []
  metrics: []
  roadmap_items: []
---

# ADR-0003: Repo-Local Durable Knowledge Gap Identifiers

## Context

GH-41 introduces Project Knowledge Management as a cross-cutting ADOS capability. Its durable Knowledge Gap records need stable identifiers before the change specification can allocate or normatively exemplify them.

- **FACT:** The proposed Knowledge Gap concept is broader than “unknown.” It covers missing or incomplete knowledge, contradictions, drift and staleness risk, discoverability, ownership, vocabulary, source-authority, and accessibility defects. Source: the GH-41 delivery brief §§6, 8, and 11 and the refined scope summarized in `chg-GH-41-pm-notes.yaml`.
- **FACT:** Existing project-specific `UNK-*` identifiers denote narrower explicit unknowns and must remain valid. Source: the GH-41 delivery brief §8.3 and the user-authorized decision charter for this record.
- **FACT:** GH-140 owns framework-wide prefix standardization and is open and unimplemented. Its owner comment points to a project catalogue as design input; repository PM notes require catalog-before-create, scoped monotonic IDs, one allocator, and preservation of existing identifiers. Source: `doc/changes/2026-09/2026-09-08--GH-41--project-knowledge-management/chg-GH-41-pm-notes.yaml`.
- **FACT:** GH-139 separately concerns roadmap `MS-<NNNN>` identifiers. It demonstrates that semantically distinct durable entities receive scoped namespaces rather than being folded into a generic “unknown” space. Source: `.ai/local/pm-context.yaml` (local planning evidence).
- **FACT:** ADOS already uses scope-sensitive identifiers: decision IDs are sequential per type, change questions use `OQ-*`, and inception questions use phase-local `OPEN-Q<N>`. Source: `.ai/agent/decision-instructions.md`, `doc/templates/change-spec-template.md`, and `doc/guides/project-inception.md`.
- **ASSUMPTION:** GH-140 will preserve already-live IDs and can incorporate a catalogue entry allocated by this narrower decision rather than requiring GH-41 to wait.
- **TO-CONFIRM:** GH-140’s final machine-readable catalogue schema and serialized cross-repository qualification grammar are not yet accepted.

This record allocates only the namespace needed by GH-41. It does not standardize unrelated ADOS prefixes or deliver GH-140.

## Problem Framing (Clarified)

The decision is not merely which short label looks best. It is how to identify a new, broad, durable, repository-owned entity without:

1. semantically redefining narrower project Unknowns;
2. invalidating identifiers already cited by projects;
3. creating global coordination or tracker coupling for a Git-native capability;
4. inventing qualification syntax that GH-140 has not accepted; or
5. blocking GH-41 on the unrelated catalogue-wide normalization work in GH-140.

**Decision question:** What namespace, scope, allocator, and interim qualification contract should GH-41 use for broad durable Knowledge Gaps while GH-140 remains open?

In scope is the Knowledge Gap identifier contract. Out of scope are GH-140’s catalogue schema, normalization of `SPEC-`, `F-`, `NG-`, `RSK-`, `OQ-`, `DEC-`, `TC-`, `MS-`, or other prefixes, migration tooling, and GH-139’s milestone-management work.

## Constraints (Hard Requirements)

### C-1: Broad Knowledge Gaps must remain distinct from narrow Unknowns

- **Statement:** An eligible approach must not redefine broad Knowledge Gaps as the same entity as project-specific or narrow `UNK-*`, change-local `OQ-*`, or inception phase-local `OPEN-Q*` records.
- **Source:** AC (GH-41 decision charter and delivery brief §§4, 8, and 18)
- **Verification:** architect sign-off and schema/prompt review
- **Negotiable:** no

### C-2: Existing identifiers must remain stable

- **Statement:** Adoption must not renumber, rewrite, invalidate, or silently alias any existing `UNK-*` or other live identifier.
- **Source:** AC (GH-41 decision charter); internal standard (GH-140 preservation principle captured in PM notes)
- **Verification:** migration review and compatibility test fixtures
- **Negotiable:** no

### C-3: Allocation must be scoped, monotonic, and single-source

- **Statement:** The identifier space must declare one scope and one repository-owned allocation source; numbers must increase monotonically and must never be reused after a durable record is merged.
- **Source:** internal standard (GH-140 owner-comment principles captured in GH-41 PM notes)
- **Verification:** code review plus allocation/deduplication tests
- **Negotiable:** no

### C-4: GH-41 must compose with, not implement, GH-140

- **Statement:** The approach must permit later registration and qualification under GH-140 without requiring existing Knowledge Gap IDs to change, while leaving unrelated prefix normalization and catalogue mechanics out of GH-41.
- **Source:** AC (GH-41 PM decision dated 2026-09-08)
- **Verification:** scope audit against GH-41 and GH-140
- **Negotiable:** no

### C-5: No unearned identifier prefixes may be added

- **Statement:** GH-41 may allocate at most one new durable entity prefix and must not create prefixes for queries, signals, sources, drift findings, contradictions, reviews, or orientation sessions.
- **Source:** AC (GH-41 delivery brief §§4 and 8.4)
- **Verification:** repository prefix sweep and artifact-schema review
- **Negotiable:** no

### C-6: Cross-repository references must be unambiguous without freezing GH-140 syntax

- **Statement:** Until GH-140 accepts a serialization grammar, a reference outside the owning repository must carry both a stable repository locator and the repo-local ID, without treating the bare ID as globally unique or inventing a new durable prefix.
- **Source:** internal standard (explicit scope and progressive qualification principles captured for GH-140)
- **Verification:** documentation examples and cross-repository reference tests
- **Negotiable:** no

## Decision Drivers

Ranked after constraint filtering:

1. **Semantic accuracy:** the identifier should name the full Knowledge Gap entity, not only one subtype.
2. **Compatibility and reversibility:** GH-140 should be able to absorb/refine the contract without migration of live IDs.
3. **Git-native determinism:** allocation should work offline from committed repository state with no mandatory tracker or service.
4. **Low cognitive load:** identifiers should be short, recognizable, and follow ADOS’s uppercase-prefix conventions.
5. **Lean scope:** unblock GH-41 while avoiding catalogue-wide work and extra entity types.

Overlap check: stability, scoped allocation, and non-conflation are pass/fail constraints; ease of understanding, implementation simplicity, and future flexibility remain ranking drivers only.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` coordinates analysis and authors this record.
- **Decider / Approver:** Juliusz Ćwiąkalski through review of the GH-41 PR.
- **Contributors:** refined GH-41 requirements; GH-140 and owner-comment context captured in GH-41 PM notes; GH-139 planning context; repository identifier conventions; delivery brief.
- **Required reviewers:** repository owner for compatibility with GH-140 intent.
- **Performers:** GH-41 spec, tooling, and documentation authors.
- **Informed:** ADOS maintainers and projects adopting Project Knowledge Management.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| Knowledge Gaps cover multiple deficiency classes beyond unknown information. | FACT | GH-41 delivery brief §§6 and 11 | Reusing `UNK-*` might become semantically valid. | High |
| Existing project `UNK-*` IDs must remain valid and unrenumbered. | FACT | GH-41 delivery brief §8.3; user charter | A unified migration could be considered, but it is expressly disallowed here. | High |
| GH-140 remains open and owns framework-wide prefix standardization. | FACT | GH-41 PM notes lines 21 and 29 | This scoped record might duplicate an accepted standard. | High for locally captured state |
| GH-140’s design inputs require catalog-before-create, one allocator, explicit scope, monotonic/non-reused IDs, and progressive qualification. | FACT | GH-41 PM notes line 29; delivery brief §8.1 | The compatibility contract would need rework. | Medium; canonical owner comment was not directly fetched in this session |
| GH-139 gives roadmap milestones a separate `MS-*` concern. | FACT | `.ai/local/pm-context.yaml` line 76 | Removes a supporting precedent but does not change Knowledge Gap semantics. | Medium |
| GH-140 can register `KG` prospectively while preserving this contract. | ASSUMPTION | Scope/preservation principles above | A compatibility mapping or superseding ADR would be required. | Medium |
| Exact machine-readable catalogue and qualification serialization. | TO-CONFIRM | GH-140, once accepted | Cross-repo references must remain structured pairs until resolved. | Unknown |

No external research was required: this is an internal design/standard decision, not an external selection.

## Mental Models & Techniques Used

- **First Principles:** scope and allocator determine uniqueness; a prefix alone does not.
- **Inversion:** avoid the failure modes of silent renumbering, two allocators, globally ambiguous bare IDs, and premature catalogue design.
- **Systems Thinking:** keep local allocation independent while making cross-repository identity composable.
- **Second-Order Thinking:** reusing `UNK-*` would make every future non-unknown gap semantically misleading and make later separation expensive.
- **KISS / paved road:** use an uppercase semantic prefix and zero-padded sequence, matching existing ADOS conventions.
- **Real options:** freeze only the local ID contract now and preserve GH-140’s option to choose catalogue metadata and qualification serialization later.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| Alternative | C-1 distinct concepts | C-2 preserve IDs | C-3 scoped allocator | C-4 composes with GH-140 | C-5 one prefix only | C-6 interim qualification |
|-------------|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 — Defer all allocation until GH-140 | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| ALT-1 — Repo-local `KG-<NNNN>` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 — Reuse `UNK-*` for every gap | ❌ | ❌ | ⚠️ | ❌ | ✅ | ⚠️ |
| ALT-3 — Globally allocated or tracker-derived Knowledge Gap IDs | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |

Legend: ✅ passes · ❌ fails · ⚠️ would require an exception, but all constraints are non-negotiable.

### Alternative 0 — Do Nothing / Wait for GH-140

- **Eligibility:** Not eligible (fails C-3, C-4, and C-6).
- **Summary:** Do not allocate durable Knowledge Gap IDs in GH-41 until the full framework catalogue ships.
- **Constraint compliance:** Preserves current identifiers and conceptual separation but leaves GH-41 without the scoped allocator it needs, turns GH-140 into a blocker contrary to the recorded scope decision, and supplies no interim cross-repo contract.
- **Driver fit:** Strong theoretical catalogue consistency, poor urgency and lean-scope fit.
- **Pros:** No chance of diverging from GH-140’s eventual syntax.
- **Cons:** Blocks specification and delivery of durable gaps on unrelated normalization work.
- **Why rejected:** It violates the explicit composition boundary: GH-140 governs but does not block GH-41.

### Alternative 1 — Repo-Local `KG-<NNNN>`

- **Eligibility:** Eligible.
- **Summary:** Allocate broad durable Knowledge Gaps as uppercase `KG-` plus a four-digit repo-local monotonic sequence; use the committed gap records as allocation truth and qualify external references with a repository locator.
- **Constraint compliance:** Passes C-1 through C-6.
- **Driver fit:** Best semantic, Git-native, cognitive-load, and compatibility fit.
- **Pros:** Describes the broad entity accurately; works offline; needs no global service; preserves every existing namespace; gives GH-140 a clean catalogue row to absorb.
- **Cons:** Bare IDs collide across repositories and four digits impose a future exhaustion boundary; both are explicit and managed.
- **Why chosen:** It is the only eligible alternative that unblocks GH-41 without expanding GH-41 into GH-140.

### Alternative 2 — Reuse `UNK-*` for Every Knowledge Gap

- **Eligibility:** Not eligible (fails C-1, C-2, and C-4).
- **Summary:** Treat every broad knowledge-health defect as an Unknown and allocate it in `UNK-*`.
- **Constraint compliance:** Conflates semantically distinct records and risks changing the meaning/allocator of existing project IDs. Qualification remains underspecified.
- **Driver fit:** Superficially fewer prefixes, but poor semantic accuracy and high migration risk.
- **Pros:** No new prefix.
- **Cons:** A contradiction, discoverability defect, or access problem is not necessarily unknown knowledge; existing `UNK-*` references become ambiguous.
- **Why rejected:** Prefix minimization is not worth destroying entity semantics or compatibility.

### Alternative 3 — Globally Allocated or Tracker-Derived Knowledge Gap IDs

- **Eligibility:** Not eligible (fails C-3 and C-4).
- **Summary:** Allocate globally unique IDs from a central ADOS catalogue/service or use tracker issue identifiers as Knowledge Gap IDs.
- **Constraint compliance:** Breaks the required repository-owned allocator and imports catalogue/service or tracker mechanics that GH-41 explicitly excludes.
- **Driver fit:** Strong global uniqueness, poor Git-native portability and lean scope.
- **Pros:** Bare references could be globally unambiguous.
- **Cons:** Requires coordination, connectivity, and potentially a tracker item for every gap; creates coupling and risks a second backlog.
- **Why rejected:** Global uniqueness is unnecessary when progressive qualification can disambiguate repo-local IDs.

## Decision

### Recommendation

Adopt **Alternative 1: repo-local `KG-<NNNN>`** for broad durable Knowledge Gaps.

The v1 contract is:

1. **Entity and prefix:** `KG` means **Knowledge Gap**, the broad durable knowledge-health defect defined by GH-41. Canonical display is uppercase `KG-0001` through `KG-9999`; matching is case-sensitive. The human-readable title/slug is mutable and is not identity.
2. **Scope:** the numeric sequence is **repo-local** to the repository that owns the gap and its remediation history. A bare `KG-0012` is unambiguous only in that repository’s context; it is not platform-global.
3. **Allocator/source of truth:** the owning repository’s committed Knowledge Gap records under `doc/knowledge/gaps/` are authoritative. The index is a derived view, not a second allocator. Before creating a candidate, scan IDs in all gap records, including `Open`, `Resolved`, and `Dismissed`; allocate `max + 1`, zero-padded to four digits. Never fill holes or reuse an ID.
4. **Concurrent allocation:** an ID on an unmerged branch is provisional. Re-scan against the latest target branch before merge. If concurrent branches chose the same number, the later branch allocates the next number before publication. Once merged—or externally published as durable—the ID is never renumbered or reassigned.
5. **Qualification while GH-140 is open:** represent a cross-repository identity semantically as the pair **`(stable repository locator, KG-<NNNN>)`**. Until GH-140 accepts punctuation/serialization, documents must provide a canonical repository URL or configured stable repository key adjacent to the local ID; they must not present bare `KG-*` as globally unique. GH-41 may show this structured pair but must not declare syntax such as `repo:KG-0012` authoritative.
6. **Unknown compatibility:** existing project-specific/narrow `UNK-*` records retain their identifiers, semantics, allocator, and lifecycle. They are neither migrated nor silently aliased to `KG-*`. A narrow uncertainty remains in its owning mechanism (`UNK-*`, change-local `OQ-*`, or phase-local `OPEN-Q*`). If an observation qualifies as a broad durable Knowledge Gap, create or link a `KG-*` record; cross-links may express relationship, but identity remains separate.
7. **No extra prefixes:** queries, signals, sources, drift findings, contradictions, review runs, and orientation sessions remain fields, types, evidence, or ephemeral outputs associated with a `KG-*`; GH-41 creates no identifier spaces for them.
8. **Composition with GH-140:** GH-140 should register `KG` with the entity, repo-local scope, allocator, stability, and compatibility semantics above. GH-140 remains free to standardize catalogue schema, repository-key registry, qualification serialization, validation, and general prefix rules. It must preserve already-minted `KG-*` and `UNK-*`; if its generic grammar differs, use prospective rules or an explicit compatibility mapping rather than renumbering.
9. **Exhaustion:** do not silently widen or wrap the sequence. Approaching `KG-9999` reopens this decision and coordinates the prospective body grammar with GH-140; all existing four-digit IDs remain valid.

### Authorized Decision

**Pending.** This R2 record remains `Proposed` until Juliusz Ćwiąkalski approves it through the GH-41 PR. The delegated AI judgment supplies the decision-ready recommendation but does not auto-Accept an R2 record.

- **Decider:** Juliusz Ćwiąkalski.
- **Conditions for revisit:** GH-140 conflict, approaching namespace exhaustion, or evidence that the relationship between Unknowns and Knowledge Gaps needs a shared formal registry.

### Constraint Compliance Attestation

The recommended alternative satisfies all constraints C-1 through C-6: it separates broad gaps from narrow unknowns (C-1), preserves every live ID (C-2), defines one repo-local monotonic allocator (C-3), limits this decision to a composable GH-41 slice (C-4), allocates only `KG` (C-5), and uses an unambiguous repository-locator-plus-local-ID pair without freezing GH-140’s serialization (C-6). No accepted-risk exception is required.

## Trade-offs & Consequences

### Positive Outcomes

- GH-41 can allocate and test durable Knowledge Gap IDs immediately.
- `KG` accurately covers all Knowledge Gap types without weakening `UNK-*` semantics.
- Allocation remains deterministic, Git-native, and independent of trackers or global services.
- The narrow contract minimizes conflict surface with GH-140 while giving it a concrete namespace to register.
- Existing IDs and links remain stable; adoption requires no bulk migration.

### Negative Outcomes

- Bare `KG-*` values are not globally unique; cross-repository callers must retain repository context.
- Branch concurrency needs a pre-merge re-scan and occasional provisional-ID change.
- Four digits create an explicit capacity limit that may eventually require a prospective extension.
- Until GH-140 lands, qualified references use a semantic pair rather than one standardized serialized token.

### Unresolved Questions

- [ ] What exact machine-readable catalogue schema and qualified-ID serialization will GH-140 accept? (owner: GH-140)
- [ ] Will GH-140 permit prospective variable-width bodies after 9999, allocate a wider fixed body, or define another exhaustion rule? (owner: GH-140; only needed before exhaustion)

Neither question blocks GH-41 because the local ID and structured qualification semantics are complete without choosing GH-140’s unrelated mechanics.

## Implementation Plan

1. The GH-41 specification references ADR-0003 and uses `KG-<NNNN>` only for broad durable Knowledge Gap records.
2. The Knowledge Gap template and guide encode the repo-local scope, allocator scan, no-reuse rule, concurrent-branch handling, and preservation of all statuses.
3. The implementation validates uppercase four-digit IDs and detects duplicate allocations within a repository.
4. Compatibility examples keep `UNK-*`, `OQ-*`, and `OPEN-Q*` unchanged and demonstrate linking rather than migration.
5. Cross-repository examples carry a stable repository locator adjacent to the local ID and label any punctuation as non-normative until GH-140.
6. GH-140 later incorporates the `KG` catalogue entry and chooses shared catalogue/qualification mechanics; this work is tracked there, not implemented in GH-41.

## Verification Criteria

- **Metric:** New broad durable gap examples using canonical `KG-[0-9]{4}` — **Target: 100%** — **Window:** GH-41 PR.
- **Metric:** Existing identifiers renumbered or redefined — **Target: 0** — **Window:** migration/compatibility test and PR review.
- **Metric:** Duplicate merged `KG-*` IDs within one repository — **Target: 0** — **Window:** GH-41 validation tests and ongoing CI where provided.
- **Metric:** New durable prefixes introduced by GH-41 beyond `KG` — **Target: 0** — **Window:** repository sweep at GH-41 PR.
- **Metric:** Cross-repository examples that use a bare `KG-*` without repository context — **Target: 0** — **Window:** documentation review.
- **Metric:** GH-140 unrelated prefix normalization delivered by GH-41 — **Target: 0** — **Window:** scope audit.

## Confidence Rating

**Medium-high.** The semantic distinction, repo-local allocator, preservation rule, and need to unblock GH-41 are directly supported by local repository evidence and the owner’s charter. Confidence is not High because the canonical GH-140 owner comment was represented through committed PM notes rather than fetched directly, and GH-140’s final catalogue schema and qualification serialization remain open. The decision deliberately isolates those unknowns behind a compatibility boundary.

## References

- [GH-41 — Project Knowledge Management](https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/41)
- [GH-140 — Framework-wide ID-prefix standardization](https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/140)
- [GH-139 — Roadmap milestone identifiers](https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/139)
- [GH-41 PM notes](../changes/2026-09/2026-09-08--GH-41--project-knowledge-management/chg-GH-41-pm-notes.yaml)
- `.ai/local/drafts/ados-project-knowledge-management-delivery-brief.md` (local design input; not durable repository authority)
- [.ai/agent/decision-instructions.md](../../.ai/agent/decision-instructions.md)
- [Decision-Making Guide](../guides/decision-making.md)
- [Project Inception Guide](../guides/project-inception.md) (phase-local `OPEN-Q<N>` convention)
- [Change Specification Template](../templates/change-spec-template.md) (change-local `OQ-*` convention)
