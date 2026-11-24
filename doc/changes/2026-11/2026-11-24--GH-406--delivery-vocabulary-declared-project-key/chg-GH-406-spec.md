---
change:
  ref: GH-406
  type: feat
  status: Proposed
  slug: delivery-vocabulary-declared-project-key
  title: "M4-S39: Delivery vocabulary: product, repository, main checkout, worktree, lane, clone identity; credentials bind to the product key (M4)"
  owners: ["Juliusz Ćwiąkalski"]
  service: "delivery vocabulary and product-scope contracts (ubiquitous language, declared product key grammar, clone identity)"
  milestone: "M4: Jaiship-native delivery"
  labels:
    - change
    - m4
    - vocabulary
    - docs
    - cli
    - config
  version_impact: minor
  audience: mixed
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - "delivered groups layer: the local groups.v1 schema with its delivered contract that group keys carry no public pattern; group/member enumeration behind `projects list`"
      - "delivered flat record set: `repos list` and the `projects list --flat` alias under the earlier payload (ODR-0004 C-2), pinned by header-contract behaviour suites"
      - "delivered clone identity: the per-clone marker in the git directory shared by the main checkout and every linked worktree, the per-clone state root, and the host index keyed by the same value"
      - "delivered board command with its `--project` flag taking a clone identity (ODR-0004 C-5), never group-scoped"
      - "governing records: ODR-0003 DC-4 (command naming v1 lock) and ODR-0004 C-2 to C-5 (flat record set) hold without amendment; ODR-0006 lands with this change as status Proposed"
      - "consumer changes that own the declared product key enforcement points: GH-396, GH-397, GH-399 (credential audiences, bindings, store scope, workspace base) and GH-401 (manifest write and import)"
      - "related changes: GH-404 (lanes in worktrees; pins main-checkout semantics), GH-407 (planning horizon), GH-408 (mechanical rename, strictly after this change)"
    external:
      - "git: linked-worktree and clone layout semantics (one git directory per clone, shared by every linked worktree)"
---

# CHANGE SPECIFICATION

> **PURPOSE**: Establish one delivery vocabulary — product, repository, main checkout, worktree, lane, work item, clone identity, product key — in the system spec and user-facing output, add the declared-product-key and clone-key contracts additively, and separate the two concepts everywhere new code names them, so credentials can bind to the product's own key and nothing is renamed or migrated. "Project" is retired from the model's own vocabulary; where the tracker's own word is meant, the documentation writes "Jira project" (owner amendment, comment 7138707234).

## 1. SUMMARY

This change delivers the owner's delivery vocabulary (M4-S39, as amended by owner comment 7138707234) as one authoritative table in the system spec and glossary, reverses two committed sentences that contradict it, and renames nothing. It adds, purely additively: a declared-product-key pattern with a predicate that refuses the reserved state segments, a named clone-identity pattern with the existing identifier kept as a same-value alias, and a served accessor for the clone identity on the resolved product scope. User-facing nouns are corrected (`projects list` keeps its locked command name and prints headers `PRODUCT` and `REPOSITORY`, `repos list` prints `CLONE`, help and reference text never present a clone identity as the product), a narrowed conformance test enforces the vocabulary, new code names the two concepts distinctly under a reason-bearing committed baseline, three fixtures prove the identity semantics, and decision record ODR-0006 (status `Proposed`) captures the vocabulary — including the retirement of "project" from the model's own vocabulary — and the mapping of locked names onto it.

## 2. CONTEXT

### 2.1 Current State Snapshot

- What the code's legacy `projectKey` names is the identity of a **clone**: it is minted once per clone into the git-directory marker, shared by the main checkout and every linked worktree of that clone, and keys the per-clone state root. On the reference host it is named after a worktree folder that no longer exists.
- The logical product is what the local configuration layer calls a **group** (`groupKey`), declared in the local projects configuration file under schema `delivery.projects.groups.v1`; the portable manifest arrives with GH-401 as `product.key`.
- At this change's base, `projects list` prints `GROUP` and `MEMBER`; `repos list` prints `KEY` for a clone. There is no term for a main checkout or a worktree anywhere in the delivery contracts.
- Two committed sentences in the ubiquitous-language overview state that "a repository is one checkout and the delivery unit" and that "the identifier `project key` keeps its repository meaning"; the owner's direction reverses both.
- The credential design drafted on 2026-11-23 bound audiences, bindings and the owned store's scope to the clone identity; the owner corrected the direction: a credential belongs to a *product*, and the clone identity differs per clone so it cannot name one.
- The naming-lock records (ODR-0003 DC-4, ODR-0004 C-2 to C-5) lock the existing command names, payload fields and the `repos` family; several structure and behaviour suites pin today's exports and wording.

### 2.2 Pain Points / Gaps

- Progress cannot be reasoned about or tracked at the right level: there is no vocabulary distinguishing the product, its repositories, the per-worker checkouts, the per-item worktrees and the running lanes.
- User-facing output mislabels: a clone identity is presented where a product is meant, and the member declaration is presented where a repository is meant.
- The credential consumer changes need a declared product key with a defined grammar to bind against; today no such contract exists.
- Conformance coverage for the vocabulary is unbounded; without a narrowed scope and named exceptions the check would either miss the surfaces that matter or flood on the identifiers that stay until the mechanical rename (GH-408).

## 3. PROBLEM STATEMENT

Because the delivery vocabulary conflates the logical product with a per-clone identity and has no names for main checkout, worktree or lane, operators and agents cannot track progress at the product, repository and lane levels, credential design targets a key that differs per clone and therefore cannot name a product, and user-facing output presents a clone as the product — resulting in a language that misleads every consumer change of the M4 credentials and worktree arc.

## 4. GOALS

- **G-1**: One vocabulary table — the eight terms of the owner's brief §A as amended by comment 7138707234 (product, repository, main checkout, worktree, lane, work item, clone identity, product key) — in the ubiquitous-language overview and the glossary, with the two reversed sentences explicitly corrected, the retirement of "project" from the model's own vocabulary recorded, and the two feature specs linked to it.
- **G-2**: Additive contracts: the declared-product-key pattern and predicate (refusing the reserved state segments), the named clone-identity pattern with the existing identifier kept exported as a same-value alias, and a served `cloneKey` accessor on the resolved product scope.
- **G-3**: User-facing nouns corrected: list headers, help and reference text use the table's nouns; the `--flat` alias output stays byte-identical; the glossary's distinct "Repository key" concept stays; public examples in the touched documentation are neutral only (`acme`, `example.com`).
- **G-4**: Enforced vocabulary: a narrowed conformance test over the declared surfaces with named exceptions, and a new-code naming rule (`cloneKey`, `declaredProductKey`; the forbidden token stays the bare legacy `projectKey` in files that did not exist at this change's base) held by a reason-bearing committed baseline.
- **G-5**: Fixtures G-1 to G-3 proving worktree identity sharing, the same product key with distinct state roots across clones, and unchanged loading of existing configuration.
- **G-6**: Decision record ODR-0006 written in this change as `Proposed`, indexed, stating the vocabulary — with "project" retired from the model's own vocabulary —, the mapping of locked names, the product key grammar, and how ODR-0003 DC-4 and ODR-0004 C-2 to C-5 read under the new vocabulary without rename.
- **G-7**: Zero rename and zero migration: no command name, payload field or persisted field changes; existing configuration, including group keys outside the grammar, keeps loading.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Vocabulary terms defined in both overview documents | 8 of 8, definitions matching the amended brief verbatim in meaning |
| Reversed sentences in the ubiquitous-language overview | 2 of 2 corrected; feature specs link the table |
| Planted-violation detection | narrowed conformance test fails on a planted violation and passes on the clean tree |
| `--flat` alias byte delta | 0 bytes in both payload and text |
| Renamed identifiers | 0 command names, 0 payload fields, 0 persisted fields |
| Exported contracts unit-tested | `DECLARED_PRODUCT_KEY_PATTERN` (predicate `isDeclaredProductKey`), `CLONE_KEY_PATTERN`, `cloneKey` accessor; the legacy `PROJECT_KEY_PATTERN` resolves to the same value |
| Fixtures passing | 3 of 3 (G-1, G-2, G-3) |
| Decision record | ODR-0006 present as `Proposed` with `decision_date: null`, listed in the decision index, recording the retirement of "project" |

### 4.2 Non-Goals

- **NG-1**: No mechanical rename. The legacy `repos` family, `repoKey` and `projectKey` keep their identifiers and denote the clone identity; the rename to the clone vocabulary is GH-408 under the record-plus-code rule. The product-denoting names (`groupKey`, the `delivery.projects.groups.v1` schema, the `<configDirectoryName>/projects.yaml` file) are likewise named exceptions until GH-408.
- **NG-2**: No credential mechanism or credential fixtures. Binding, admitting and scoping by the declared product key are created by GH-396, GH-397 and GH-399; GH-396 also creates the credentials guide that links the vocabulary table.
- **NG-3**: No per-level progress tracking. Worktrees and lanes per repository belong to GH-404; planned, waiting and the product-level progress aggregate belong to GH-407.
- **NG-4**: No migration of existing configuration and no grammar enforcement in the local `groups.v1` layer, which keeps its delivered contract that group keys carry no public pattern.
- **NG-5**: No amendment of ODR-0003 DC-4 or ODR-0004 C-2 to C-5, and no edit to any earlier decision record; ODR-0006 states how they read under the new vocabulary.
- **NG-6**: No change to the two meanings of `--project` beyond help wording; the flag keeps its name and the board stays per-clone and never group-scoped (resolved by GH-408).
- **NG-7**: No change to the glossary's "Repository key" (`host/owner/name`) concept, which is a different contention domain and stays.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Vocabulary table in the system spec and glossary | one owner-directed language; corrects two reversed committed sentences; retires "project" from the model's own vocabulary |
| F-2 | Declared-product-key contract | the key credentials and manifests bind to; grammar plus reserved-segment refusal |
| F-3 | Clone-identity pattern name with same-value alias | names the clone identity's pattern without changing the existing exported identifier |
| F-4 | Served `cloneKey` accessor on the resolved product scope | new code reads the clone identity without spelling the bare legacy token |
| F-5 | User-facing noun corrections | headers, help and reference text use the table's nouns; alias output byte-identical |
| F-6 | Narrowed conformance test | bounded, exception-aware enforcement that the vocabulary is used correctly |
| F-7 | New-code naming rule with committed baseline | the two concepts stay distinct in everything new, review-visibly |
| F-8 | Fixtures G-1 to G-3 | prove worktree identity sharing, per-clone state roots, unchanged loading |
| F-9 | Decision record ODR-0006 | capture vocabulary, mapping and grammar for owner acceptance at the pull request |
| F-10 | Pin-surface wording-only updates | keep the pre-existing export, naming and header pins green without behavioural change |

### 5.1 Capability Details

- **F-1 — Vocabulary table.** The eight terms of the brief §A as amended by owner comment 7138707234 (product, repository, main checkout, worktree, lane, work item, clone identity, product key) are recorded with their meanings and lifetimes in the ubiquitous-language overview and the glossary. *Product* is the top-level noun: one or more repositories that together form a single deliverable, planned and delivered as one; a *repository* is one git repository belonging to exactly one product, with the long form *product repository* used only for contrast. The noun *repository* is reassigned to the product member; "a repository is one checkout and the delivery unit" and "the identifier `project key` keeps its repository meaning" are reversed. The term *product key* replaces "declared project key" as the vocabulary term; the contract names keep the *declared* qualifier (see F-2). "Project" is retired from the model's own vocabulary: where the tracker's own word is meant, the documentation writes "Jira project". The vocabulary notes also record two rules: where this repository's documentation says "the product" to mean the tool itself, it says "the tool" — applied to the pages this change already touches, with the ~45-line remainder sweep belonging to GH-408 — and public examples are neutral only (`acme`, `example.com`; no real company, nothing private). The term *clone identity* is used rather than *checkout identity* because git calls every linked worktree a checkout, which would read as per-worktree — the opposite of the fact that the marker is shared by the whole clone. The projects and project-groups feature specs link to the table and no longer state that a repository is one checkout.
- **F-2 — Declared-product-key contract.** `DECLARED_PRODUCT_KEY_PATTERN` is `^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$`: 2 to 64 characters, lowercase alphanumerics and hyphens, no leading or trailing hyphen, path-safe by construction; its predicate is `isDeclaredProductKey`. The predicate additionally refuses the two reserved state segments `unbound` and `projects` — the reserved segment `projects` keeps its name: it is a state-layout segment, not model vocabulary. The *declared* qualifier stays in the code names while the legacy `PROJECT_KEY_PATTERN` and `projectKey` exist (PRODUCT and PROJECT are two letters apart); GH-408 may drop it when the legacy names go. Enforcement lands only where a key is used as a declared key; the enforcement points themselves are owned by the consumer changes (credential audiences, bindings, store scope and workspace base in GH-396/GH-397/GH-399; manifest write and import in GH-401, where the manifest names the key `product.key`).
- **F-3 — Clone-identity pattern name.** `CLONE_KEY_PATTERN` is the name of the clone identity's pattern; the legacy `PROJECT_KEY_PATTERN` remains exported as its alias with the same value, unit-tested to still resolve identically (brief §C.1 stands). `CLONE_KEY_PATTERN` and the `cloneKey` accessor are unchanged by the amendment.
- **F-4 — Served accessor.** The resolved product scope serves `cloneKey`, the clone identity. The accessor is a served read, not a persisted name; the persisted names stay exactly as delivered — the marker field, the host-index field, and the `projects list --flat` alias payload.
- **F-5 — User-facing nouns.** `projects list` keeps its command name (ODR-0003 DC-4) and prints headers `PRODUCT` (the product key — the product's own key) and `REPOSITORY` (the member declaration's selector or locator); never `PROJECT REPOSITORY`, which is prose-only contrast, not a header. `repos list` prints header `CLONE`. Help and reference text never present a clone identity as the product or a product key. `board --project` keeps its flag name; its help says it takes a clone identity; the board is never group-scoped. Any "primary checkout" wording becomes "main checkout". The `projects list --flat` alias keeps its payload **and** its text byte-identical.
- **F-6 — Narrowed conformance test.** Scope: CLI help summaries, the text headers of `projects list` and `repos list`, the guides tree, the tools documentation tree, the overview tree, and every command reference page under `doc/planning/oss-tooling/milestones/*/commands/**` — all milestones' command reference pages, not a selected subset. Named exceptions, unchanged until GH-408: the `projects.*` error-code family, the `<host root>/projects/` container, `--project-root`, and the `--flat` alias. The test fails on a planted violation.
- **F-7 — New-code naming rule.** New code names the concepts `cloneKey` and `declaredProductKey`. A repository check holds that a source file that did not exist at this change's base may not contain the bare token `projectKey` — the legacy token the check guards. A committed baseline lists the files that may; each exception is added with a reason and is visible in review. There are no per-file counts on existing files.
- **F-8 — Fixtures.** G-1: a linked worktree resolves the same clone identity as its main checkout. G-2: two clones of one repository resolve the same product key and get different state roots. G-3: existing configuration keeps loading unchanged, including a group key outside the grammar.
- **F-9 — Decision record ODR-0006.** Written in this change; the id is reserved as the next free decision id. Content: the vocabulary with the amendment's nouns, including the retirement of "project" from the model's own vocabulary; the mapping of the locked names onto it (brief §B as amended); the product key with its grammar; and how ODR-0003 DC-4 and ODR-0004 C-2 to C-5 read under the new vocabulary without any rename. `status: Proposed`, `decision_date: null`; the owner accepts it at the pull request. Earlier records are not edited.
- **F-10 — Pin-surface updates.** The pre-existing pins touched by the wording are updated wording-only: the content-inventory structure suite (pins every export of the product contracts and state-scope modules), the naming-boundary structure suite (TC-GRPBOUND-002, TC-GRPSREAD-003 — old wording pinned while the intent stands), the three header-contract behaviour suites (repos list, projects list, flat alias), the milestone command reference pages for repos, projects and board, and the two feature specs. No behavioural change rides along.

## 6. USER & SYSTEM FLOWS

```
Flow 1: product enumeration
  Operator runs `projects list` (command name kept under ODR-0003 DC-4)
    → sees PRODUCT (the product's own key) and REPOSITORY
      (the member declaration's selector or locator)
    → no GROUP / MEMBER headers; `--flat` output unchanged to the byte

Flow 2: worktree identity (fixture G-1)
  Agent opens a linked worktree for one work item
    → identity resolution reads the clone's git-directory marker
    → the worktree resolves the same clone identity as its main checkout

Flow 3: two clones, one product (fixture G-2)
  Operator clones one repository twice on one worker
    → both clones resolve the same product key (from the
      group declaration / manifest)
    → each clone keeps its own state root

Flow 4: legacy configuration load (fixture G-3)
  Operator loads an existing projects configuration whose group key is
  outside the product key grammar
    → it loads unchanged; nothing migrates; the local layer enforces no pattern

Flow 5: board scoping
  Operator reads `board --project` help
    → help states the value is a clone identity
    → the board renders that clone only; never group-scoped
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The vocabulary table (8 terms) in the ubiquitous-language overview and the glossary; reversal of the two contradictory sentences; the retirement of "project" from the model's own vocabulary; the "the tool" prose rule and the neutral public-examples rule (`acme`, `example.com`) recorded in the vocabulary notes; links from the projects and project-groups feature specs.
- `DECLARED_PRODUCT_KEY_PATTERN` with its predicate `isDeclaredProductKey` (reserved segments `unbound`, `projects` refused), `CLONE_KEY_PATTERN` unchanged, legacy `PROJECT_KEY_PATTERN` kept as same-value alias — all exported and unit-tested.
- The served `cloneKey` accessor on the resolved product scope; persisted names unchanged.
- `projects list` headers `PRODUCT` / `REPOSITORY` (command name kept, ODR-0003 DC-4); `repos list` header `CLONE`; help and reference-text noun corrections; "primary checkout" → "main checkout"; byte-identical `--flat` alias.
- The narrowed conformance test (F-6 scope and exceptions), failing on a planted violation.
- The new-code naming rule with a committed, reason-bearing baseline and no per-file counts on existing files.
- Fixtures G-1, G-2, G-3.
- ODR-0006 (`Proposed`, `decision_date: null`) plus its decision-index row.
- Wording-only updates to the pin surfaces listed in F-10.

### 7.2 Out of Scope

- [OUT] Mechanical rename of the legacy `projectKey`/`repoKey` to `cloneKey`, the `repos` family, and the two meanings of `--project` (GH-408).
- [OUT] Credential layers, the owned store, named profiles and product binding: mechanisms and fixtures (GH-396, GH-397, GH-399).
- [OUT] `projects import` and the portable manifest, including the product key enforcement at manifest write/import (GH-401).
- [OUT] Lanes in worktrees, per-lane leases, and main-checkout pinning beyond the vocabulary definition (GH-404).
- [OUT] Planning horizon and the product-level progress aggregate (GH-407).
- [OUT] The credentials guide and its link to the vocabulary table (GH-396 creates it).
- [OUT] Migration of any existing configuration or schema; grammar enforcement in the local `groups.v1` layer.
- [OUT] Amendments to ODR-0003, ODR-0004 or any earlier decision record.
- [OUT] The ~45-line remainder of the "the tool" prose rule outside the pages this change already touches, and any rename of the product-denoting named exceptions (`groupKey`, `delivery.projects.groups.v1`, `projects.yaml`) (GH-408).

### 7.3 Deferred / Maybe-Later

- Renaming the `projects.*` error-code family, the `<host root>/projects/` container, `--project-root` and the `--flat` alias — held for GH-408's mechanical rename under the record-plus-code rule.
- The ~45-line remainder of the "the tool" prose rule outside the pages this change already touches — GH-408.
- Per-level progress surfaces (work items per repository, locks, the product-level aggregate) — GH-404 / GH-407.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

Not applicable — no HTTP surface in this change.

### 8.2 Events / Messages

Not applicable — no new events. The `dispatch.lane` record named in the lane definition already exists and is unchanged here.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Product key (contract name: declared product key) | The product's own key: `groupKey` in the local `groups.v1` layer, `product.key` in the portable manifest (GH-401). Grammar `^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$` (2–64 chars, lowercase, path-safe); predicate `isDeclaredProductKey` refuses reserved state segments `unbound` and `projects` (the segment `projects` keeps its name — a state-layout segment, not model vocabulary). Lives in a namespace disjoint from the clone identity (different fields, different parent directories) and is never compared against it. |
| DM-2 | Clone key pattern | `CLONE_KEY_PATTERN` names the clone identity's pattern (unchanged); the legacy `PROJECT_KEY_PATTERN` stays exported as the same-value alias. |
| DM-3 | Served `cloneKey` | Read-only accessor of the clone identity on the resolved product scope. Not persisted; the persisted names (marker field, host-index field, `--flat` alias payload) are unchanged. |

### 8.4 External Integrations

- git: the vocabulary and fixtures rely on git's clone and linked-worktree layout (one git directory per clone, shared by every linked worktree). No git behaviour is changed.

### 8.5 Backward Compatibility

- The `projects list --flat` alias payload **and** text are byte-identical to before (ODR-0004 C-2).
- Existing configuration keeps loading unchanged, including group keys outside the product key grammar; nothing migrates (regression-fixture protected, G-3).
- No command name, payload field or persisted field is renamed; the legacy `repos` family, `repoKey` and `projectKey` keep their identifiers (named exceptions until GH-408).
- The local `groups.v1` layer keeps its delivered contract that group keys carry no public pattern.
- `board --project` keeps its flag name and its never-group-scoped behaviour.
- Existing contract suites pass with wording-only updates (F-10).

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Product key grammar precision | Accepts exactly 2–64 characters of lowercase alphanumerics and hyphens with no leading/trailing hyphen; refuses `unbound` and `projects` (the segment `projects` keeps its name — a state-layout segment, not model vocabulary); every rule unit-tested |
| NFR-2 | Legacy alias fidelity | The legacy `PROJECT_KEY_PATTERN` resolves to the identical value as `CLONE_KEY_PATTERN` (0 difference), asserted by unit test |
| NFR-3 | Alias output fidelity | `--flat` payload and text byte-identical to the pre-change output: 0-byte delta |
| NFR-4 | Conformance detectability | The narrowed conformance test passes on the clean tree and fails (non-zero) on a planted violation |
| NFR-5 | Zero-rename invariant | 0 renamed command names, 0 payload fields, 0 persisted fields; all pre-existing contract suites pass with wording-only updates |
| NFR-6 | Baseline discipline | Every baseline entry in the new-code token check carries a reason; no per-file counts on existing files |
| NFR-7 | Fixture determinism | Fixtures G-1 to G-3 pass reproducibly on a single worker host |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

Not applicable — no new telemetry. Existing state-layer telemetry is unchanged; lane records referenced by the vocabulary are unchanged here.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Pre-existing pins break when wording changes (content-inventory, naming-boundary, header-contract suites, reference pages) | M | H | Pin surfaces named in the spec (F-10) so plan and review protect them; wording-only updates with no behavioural change | Low |
| RSK-2 | `--flat` alias drifts (payload or text) | H | L | Byte-identical requirement (NFR-3) pinned by the existing flat-alias behaviour suite | Low |
| RSK-3 | Conformance test over-matches or under-matches the vocabulary | M | M | Narrowed scope with named exceptions (F-6); planted-violation proof (NFR-4); exceptions frozen until GH-408 | Low |
| RSK-4 | New code reintroduces the bare legacy token | M | M | Repository check with committed reason-bearing baseline visible in review (F-7, NFR-6) | Low |
| RSK-5 | Older documents still misuse the vocabulary outside the conformance scope (clone mislabels, and "the product" meaning the tool) | L | M | Scope covers guides, tools docs, overview and milestone command reference pages; the "the tool" prose rule is applied to the pages this change touches and its ~45-line remainder is corrected at GH-408 | Medium |
| RSK-6 | ODR-0006 rejected at the pull request | M | L | Status `Proposed` with `decision_date: null`; earlier records untouched so rejection costs no rework elsewhere | Low |

## 12. ASSUMPTIONS

- The authoring-source order is ticket body < delivery brief (owner comment 7122871259, 2026-11-24) < vocabulary amendment (owner comment 7138707234, 2026-11-24); the brief supersedes owner comment 7117829140 where they differ and replaces the ticket body's acceptance-criteria list; the amendment supersedes the brief where they differ and, with the brief, supersedes the body. Nothing is renamed in this change.
- The consumer changes (GH-396, GH-397, GH-399, GH-401) create their own declared product key enforcement points; this change delivers the contract they enforce, not the enforcement itself.
- The local `groups.v1` "group keys carry no public pattern" contract stands unamended.
- ODR-0006 is the next free decision id and is reserved by the brief.
- git's marker-sharing across linked worktrees holds on supported hosts (verified by fixture G-1).

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Delivered groups layer | `groups.v1` schema, group/member enumeration, no-pattern contract for group keys |
| Depends on | Delivered flat record set | `repos list` and the `projects list --flat` alias (ODR-0004) |
| Depends on | Delivered clone identity | Git-directory marker, per-clone state roots, host index |
| Depends on | Delivered board command | `--project` flag taking a clone identity (ODR-0004 C-5) |
| Enables | GH-396, GH-397, GH-399 | Credential audiences, bindings, store scope and workspace base enforce the declared product key where a key is used as a declared key |
| Enables | GH-401 | Manifest write and import enforce the declared product key; `product.key` names the product key in the portable manifest |
| Related | GH-404 | Lanes in worktrees; pins main-checkout semantics; consumes the vocabulary |
| Related | GH-407 | Planning horizon; consumes the vocabulary |
| Blocks | GH-408 | The mechanical rename follows this change under the record-plus-code rule; named exceptions stay until then |
| Governs | ODR-0003 DC-4, ODR-0004 C-2..C-5 | Hold without amendment; ODR-0006 states their reading under the new vocabulary |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| — | None | The brief as amended resolved every point raised during clarification, including the superseded rename proposal | No open questions |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Author from the delivery brief (comment 7122871259) as amended by the owner's vocabulary amendment (comment 7138707234); source order body < brief < amendment; the brief supersedes comment 7117829140 where they differ and replaces the body's acceptance-criteria list; the amendment supersedes the brief where they differ | All three sources are owner-authored; the amendment is a directed correction applied end to end in this v1.1 re-authoring | 2026-11-24 |
| DEC-2 | Nothing is renamed in this change; the legacy `repos` family, `repoKey` and `projectKey` are named exceptions denoting the clone identity, and `groupKey`, the `delivery.projects.groups.v1` schema and the `<configDirectoryName>/projects.yaml` file are named exceptions denoting a product | ODR-0003 DC-4 and ODR-0004 C-2 to C-5 hold without amendment; the mechanical rename is GH-408 | 2026-11-24 |
| DEC-3 | The clone identity is named *clone identity*, not *checkout identity* | Git calls every linked worktree a checkout; "checkout identity" would read as per-worktree, the opposite of the shared-marker fact | 2026-11-24 |
| DEC-4 | The local `groups.v1` layer keeps "group keys carry no public pattern"; nothing migrates | Delivered contract stands; the declared product key grammar binds consumers only | 2026-11-24 |
| DEC-5 | ODR-0006 is written in this change as `Proposed` with `decision_date: null`; earlier records are not edited | The owner accepts the vocabulary at the pull request | 2026-11-24 |
| DEC-6 | The top-level noun is *product*, not project; the vocabulary term is *product key*; code names keep the *declared* qualifier (`DECLARED_PRODUCT_KEY_PATTERN`, `isDeclaredProductKey`, `declaredProductKey`) while the legacy `PROJECT_KEY_PATTERN`/`projectKey` exist, because PRODUCT and PROJECT are two letters apart; `CLONE_KEY_PATTERN`/`cloneKey` are unchanged; `projects list` keeps its locked command name and prints `PRODUCT`/`REPOSITORY`; the change title is the tracker's renamed title (owner renamed it 2026-11-24T17:06:57Z alongside amendment comment 7138707234); amendment §G covers only branch and change-folder slugs, which stay unchanged | Owner vocabulary amendment 7138707234, applied end to end per the reopened specification phase | 2026-11-24 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Ubiquitous-language overview document | Updated — vocabulary table; two sentences reversed; "project" retired from the model's vocabulary |
| Glossary document | Updated — vocabulary entries; "Repository key" concept stays |
| Feature specs: projects, project groups (document titles are legacy; they link the table and use its nouns) | Updated — link the table; stop saying a repository is one checkout |
| Product-scope and state-scope contracts (core) | New — declared product key pattern and predicate, clone-key pattern name, same-value legacy alias, served `cloneKey` accessor |
| CLI command output: `projects list`, `repos list` | Updated — headers `PRODUCT`, `REPOSITORY`, `CLONE` (wording only) |
| CLI help and reference text (help summaries; board help) | Updated — table nouns; `--project` help states clone identity |
| Conformance test suite | New/narrowed — F-6 scope with named exceptions |
| New-code naming rule + committed baseline | New — F-7 |
| Structure suites: content-inventory, naming-boundary (TC-GRPBOUND-002, TC-GRPSREAD-003) | Updated — wording-only pin refresh |
| Behaviour suites: repos-list, projects-list, flat-alias contracts | Updated — header pins wording-only; `--flat` stays byte-identical |
| Milestone command reference pages — every page under `doc/planning/oss-tooling/milestones/*/commands/**` (42 at this change's base: m1 28, m2 12, m4 2) | Updated — conformance sweep covers all pages; wording edits applied wherever vocabulary violations exist inside scope (known violation: the m4 install page's "primary checkout" wording becomes "main checkout"); the three m2 pages (repos, projects, board) additionally carry wording-only pin updates (F-10) |
| Fixtures G-1..G-3 | New |
| Decision record ODR-0006 + decision index row | New |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** the system spec and glossary, **when** a reader consults the ubiquitous-language overview or the glossary, **then** the eight-term vocabulary table is present with the amended brief's meanings and lifetimes, the two reversed sentences are corrected, "project" is recorded as retired from the model's own vocabulary, the "the tool" prose rule and the neutral public-examples rule (`acme`, `example.com`) are recorded, and both feature specs link to the table without stating that a repository is one checkout | F-1 |
| AC-F5-1 | **Given** the delivered CLI, **when** the operator runs `projects list` and `repos list` and reads their help, **then** the headers read `PRODUCT` / `REPOSITORY` and `CLONE`, help and reference text use the table's nouns, and the `--flat` alias output is byte-identical to the pre-change output | F-5, NFR-3 |
| AC-F6-1 | **Given** the narrowed conformance test, **when** it runs on the clean tree it passes, and **when** a violation is planted inside its declared scope it fails, honouring the named exceptions | F-6, NFR-4 |
| AC-F2-1 | **Given** the contracts layer, **when** the declared product key contract is exercised, **then** `DECLARED_PRODUCT_KEY_PATTERN` is exported with predicate `isDeclaredProductKey`, unit-tested against the grammar and the reserved-segment refusals (`unbound`, `projects`) | F-2, DM-1, NFR-1 |
| AC-F3-1 | **Given** the contracts layer, **when** the clone-identity pattern is exercised, **then** `CLONE_KEY_PATTERN` is exported and unit-tested and the legacy `PROJECT_KEY_PATTERN` still resolves to the same value | F-3, DM-2, NFR-2 |
| AC-F4-1 | **Given** a resolved product scope, **when** new code reads the clone identity, **then** the served `cloneKey` accessor returns it, and no persisted name (marker field, host-index field, `--flat` alias payload) has changed | F-4, DM-3 |
| AC-F7-1 | **Given** the new-code naming rule, **when** the repository check runs, **then** no file absent at this change's base contains the bare legacy token `projectKey`, every baseline exception carries a reason, and no per-file counts exist on existing files | F-7, NFR-6 |
| AC-F8-1 | **Given** a linked worktree, **when** its identity is resolved, **then** it equals the clone identity of its main checkout (fixture G-1) | F-8 |
| AC-F8-2 | **Given** two clones of one repository, **when** each resolves its keys, **then** both resolve the same product key and hold different state roots (fixture G-2) | F-8, DM-1 |
| AC-F8-3 | **Given** existing configuration including a group key outside the declared product key grammar, **when** it loads, **then** it loads unchanged with no migration (fixture G-3) | F-8, NFR-5 |
| AC-F9-1 | **Given** the decision register, **when** the change is delivered, **then** ODR-0006 exists with status `Proposed` and `decision_date: null`, records the vocabulary with the amendment's nouns including the retirement of "project" from the model's own vocabulary, the decision index lists it, and no earlier record was edited | F-9 |
| AC-F10-1 | **Given** the pinned suites and reference pages, **when** the change is delivered, **then** no command name, payload field or persisted field is renamed and every pre-existing contract suite passes with wording updates only | F-10, NFR-5 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Full lifecycle delivery on one branch; one pull request targeting `main-tools`; commits via the commit primitive per plan phase; gate evidence under the session-scoped temporary directory convention.
- The owner's vocabulary amendment (comment 7138707234) rides this same change and branch: lifecycle phases were reopened for the directed correction, and review plus the full quality gates re-run before the pull request is updated; the change folder, branch and slugs keep their names.
- Wording-only pin updates land in the same change so the tree stays green at each phase boundary; no behavioural change rides with them.
- ODR-0006 ships as `Proposed`; the owner accepts (or rejects) it at the pull request — acceptance is the change-management act, not a pre-merge step.
- Downstream consumers (GH-396, GH-397, GH-399, GH-401) reference the vocabulary and grammar delivered here; GH-408 performs the mechanical rename afterwards under the record-plus-code rule.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

None. Nothing migrates: existing configuration keeps loading unchanged, including group keys outside the product key grammar (regression-protected by fixture G-3). No persisted field is added, renamed or re-keyed.

## 20. PRIVACY / COMPLIANCE REVIEW

Not applicable. No personal data, credentials or secret material is introduced or handled by this change; the credential consumers keep their own delivered boundaries.

## 21. SECURITY REVIEW HIGHLIGHTS

- The declared product key predicate refuses the reserved state segments `unbound` and `projects` (the segment `projects` keeps its name — a state-layout segment, not model vocabulary), preventing declared keys from colliding with reserved state layout segments (path-safe grammar by construction).
- The declared product key and the clone identity live in disjoint namespaces (different fields, different parent directories) and are never compared — the basis for correct credential binding by the consumers (GH-396, GH-397, GH-399).
- No credential material, store, or resolution path changes in this change; the correction that credentials bind to the declared product key (not the clone identity) is realised by the consumers.

## 22. MAINTENANCE & OPERATIONS IMPACT

- The narrowed conformance test becomes standing enforcement: new user-facing text inside its scope must use the table's nouns, and the named exceptions are frozen until GH-408.
- The committed baseline of the new-code naming rule needs a reason for every new exception; it is review-visible by design.
- The pin suites (content-inventory, naming-boundary, header contracts) must be kept in sync with the contracts and headers on future additive changes.
- The vocabulary table is the reference for all future user-facing wording until GH-408's rename lands.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Product | One or more repositories that together form a single deliverable, planned and delivered as one. Durable. |
| Repository | One git repository that belongs to exactly one product. The long form "product repository" is used only for contrast. Durable. |
| Main checkout | The clone's primary working tree (the directory that holds `.git`); stays on the base branch, whatever that branch is called. Durable per worker. |
| Worktree | A linked git worktree of a main checkout, created for one work item; the word never includes the main checkout. Temporary. |
| Lane | One work item's delivery in one repository: the queue lane keyed `<ref>@<cloneKey>`, resumable across dispatch attempts through the `dispatch.lane` record; an attempt is never a lane. Temporary. |
| Work item | A ticket. Durable in the tracker. |
| Clone identity | The identity minted once per clone into the git-directory marker, shared by the main checkout and every linked worktree of that clone. Per clone. |
| Product key | The product's own key: `groupKey` in the local `groups.v1` layer, `product.key` in the portable manifest (GH-401). Contract names keep the *declared* qualifier (`DECLARED_PRODUCT_KEY_PATTERN`) while the legacy names exist. Durable. |
| Project (retired) | Not a term of the model's own vocabulary. Where the tracker's own word is meant, write "Jira project". Existing names containing "project" are named legacy exceptions (Appendix A), not vocabulary. |
| Repository key (existing, unchanged) | The normalized `host/owner/name` contention domain — a different concept that stays as delivered. |

## 24. APPENDICES

### Appendix A — Mapping of locked names onto the vocabulary (brief §B, as amended)

| Vocabulary term | Existing code and document names |
|-----------------|----------------------------------|
| Product | A group: `groupKey`; schemas `delivery.projects.groups.v1` (local) and `delivery.projects.manifest.v1` (portable, GH-401); the projects configuration file `<configDirectoryName>/projects.yaml`. These existing names are **named exceptions that denote a product**; renaming them is GH-408. |
| Repository | A `members[]` declaration (repository selector plus tracker kind); `root` and `repoKey` on a member are **clone locators**; a member without a locator is declared, not located; `member` names the declaration entry, never the repository |
| Clone identity | `repoKey` and `projectKey` (same value, legacy names): marker field, host-index key, public `repos.v1` field, plan/closeout member refs, queue lane and lease keys, verify-gate rows, `board --project`, group member locators, per-clone state root |
| Main checkout | The flat record set (`repos list`) is keyed by clone identity; its `root` is the last invoking checkout, not necessarily the main checkout (GH-404 pins it) |

### Appendix B — Conformance scope and named exceptions

- Conformance scope (the sweep surface, brief §E): CLI help summaries; the text headers of `projects list` and `repos list`; the guides tree; the tools documentation tree; the overview tree; and every command reference page under `doc/planning/oss-tooling/milestones/*/commands/**` — all milestones' command pages (42 at this change's base: 28 in m1, 12 in m2, 2 in m4).
- Pin surfaces, distinct from the conformance scope (brief §F): the three m2 command reference pages (repos, projects, board) are pin surfaces that additionally receive wording-only pin updates per F-10. They are a subset of the sweep scope, never its definition.
- Named exceptions (unchanged until GH-408): the `projects.*` error-code family; the `<host root>/projects/` container; `--project-root`; the `--flat` alias.

### Appendix C — Fixtures

- G-1: a linked worktree resolves the same clone identity as its main checkout.
- G-2: two clones of one repository resolve the same product key and get different state roots.
- G-3: existing configuration keeps loading unchanged, including a group key outside the grammar.

### Appendix D — Sources

- Ticket GH-406 body (owner direction, 2026-11-24); owner comment 7122871259 "Delivery brief (2026-11-24)"; owner comment 7138707234 "Vocabulary amendment, 2026-11-24". Authoritative source order: body < brief < amendment — the brief supersedes owner comment 7117829140 where they differ and replaces the body's acceptance-criteria list; the amendment supersedes the brief where they differ and, with the brief, supersedes the body. The amendment's full text is also recorded in the pm-notes of this change folder.
- PM clarify-scope cross-check of the system spec at base 22b15d31 (pm-notes of this change folder).

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-24 | spec-writer agent | Initial specification from ticket body + delivery brief 7122871259 |
| 1.1 | 2026-11-24 | spec-writer agent | Owner vocabulary amendment 7138707234 applied end to end: top-level noun *product*; *repository* (long form "product repository" contrast-only); *product key* replaces "declared project key" as the vocabulary term; "project" retired from the model's own vocabulary ("Jira project" for the tracker's word); code names `DECLARED_PRODUCT_KEY_PATTERN` / `isDeclaredProductKey` / `declaredProductKey` with the *declared* qualifier kept while legacy names exist; `CLONE_KEY_PATTERN` / `cloneKey` unchanged; headers `PRODUCT` / `REPOSITORY` / `CLONE`; ODR-0006 records the retirement; "the tool" prose rule and neutral public examples (`acme`, `example.com`) recorded in the vocabulary notes; source order body < brief < amendment; slugs, folder and branch unchanged; 12-AC decomposition intact |
| 1.2 | 2026-11-24 | spec-writer agent | Title provenance corrected: front matter `change.title` and DEC-6's title clause aligned with the tracker's renamed title — owner renamed the tracker title 2026-11-24T17:06:57Z, one second after posting amendment comment 7138707234, so the ticket's own record is the renamed title; amendment §G covers only branch and change-folder slugs, which stay unchanged; no v1.1 vocabulary content altered |

---

## AUTHORING GUIDELINES

- Authored from the ticket body, the delivery brief (owner comment 7122871259), and the owner's vocabulary amendment (owner comment 7138707234); source order: body < brief < amendment — the brief supersedes the body and comment 7117829140 where they differ, and the amendment supersedes the brief where they differ; the body's acceptance-criteria list is replaced by the brief's list as amended. The amendment is applied end to end in this v1.1.
- The earlier rename proposal in owner comment 7117829140 is superseded: nothing is renamed in this change; the mechanical rename is GH-408.
- No requirements were invented beyond body + brief + amendment; clarify-scope verification (pm-notes) confirmed the two reversed sentences, the no-pattern contract of the local layer, and the next free decision id (ODR-0006). The v1.1 amendment application introduced nothing beyond the owner's comment.
- Code identifiers named by the brief as amended (`DECLARED_PRODUCT_KEY_PATTERN`, `isDeclaredProductKey`, `CLONE_KEY_PATTERN`, the legacy `PROJECT_KEY_PATTERN`, `cloneKey`, `declaredProductKey`, the legacy `projectKey`, the legacy `repoKey`) are contract identifiers required verbatim by the acceptance criteria, not implementation directives; affected suites and pages are named at component level only.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-406)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] `change.milestone` equals the tracker milestone title verbatim ("M4: Jaiship-native delivery") and the pm-notes `milestone`
- [x] All sections present in order (1–25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, DM-, NFR-, RSK-, DEC-, AC-)
- [x] Acceptance criteria reference at least one F-/DM-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no code-level file paths, no step-by-step tasks)
- [x] No content duplicated verbatim from linked docs beyond the owner-directed vocabulary required verbatim
- [x] Front matter validates per front_matter_rules
