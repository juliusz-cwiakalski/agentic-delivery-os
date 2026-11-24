---
id: ODR-0006
decision_type: odr
status: Proposed
created: 2026-11-24
decision_date: null
last_updated: 2026-11-24
summary: "One delivery vocabulary — product, repository, main checkout, worktree, lane, work item, clone identity, product key — established as the owner-directed language for the delivery surfaces under the owner's vocabulary amendment (comment 7138707234): 'project' is retired from the model's own vocabulary and 'Jira project' names the tracker's own word. The product key gains an additive contract (grammar `^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$` with the reserved state segments `unbound` and `projects` refused), the clone-identity pattern gains its vocabulary name beside the delivered alias, and the resolved project scope serves `cloneKey`; NOTHING is renamed — the `repos` family, `repoKey`, and `projectKey` keep their identifiers as named exceptions until the mechanical rename (GH-408), and this record states how ODR-0003 DC-4 and ODR-0004 C-2..C-5 read under the vocabulary without amendment."
owners:
  - "Juliusz Ćwiąkalski"
service: "the delivery vocabulary and the project-scope contracts (ubiquitous language, product key, clone identity)"
decision_scope: repo
review_date: null
business_impact: "Progress becomes reasonable and trackable at the product, repository, and lane levels: one owner-directed language replaces a vocabulary that conflated the delivery unit with a per-clone identity and had no names for main checkout, worktree, or lane, so the credential and worktree consumers (GH-396, GH-397, GH-399, GH-401, GH-404) can bind to the key that names the product rather than one that differs per clone."
customer_impact: "Operators and agents read one set of nouns everywhere: `projects list` prints PRODUCT and REPOSITORY, `repos list` prints CLONE, help and reference text never call a clone identity the product or a product key, and the `--flat` alias output stays byte-identical — no operator habit breaks, nothing migrates, and existing configuration including group keys outside the declared-key grammar keeps loading."
classification:
  domains: [process, contracts, cli, docs]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: high
  urgency: medium
  uncertainty: low
  blast_radius: team
  recurrence: recurring
governance:
  driver: "The owner's direction in supersession order — the GH-406 ticket body, then the owner's delivery brief (comment 7122871259, 2026-11-24), which supersedes owner comment 7117829140 where they differ and replaces the ticket body's acceptance-criteria list, then the owner's VOCABULARY AMENDMENT (comment 7138707234, 2026-11-24T17:06Z), which supersedes the brief where they differ and fixes the top-level noun as PRODUCT"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-406 pull-request review; AI does not accept this R2 record"
  contributors:
    - "@spec-writer and @plan-writer (GH-406 artifacts authored from the brief and the amendment)"
    - "@decision-advisor (record structure)"
  reviewers:
    - "@readiness-reviewer (DoR iter-2 READY; DoR iter-4 READY after the amendment)"
    - "@reviewer (GH-406 review)"
    - "Human owner (GH-406 PR review — the acceptance act for the vocabulary)"
  performers:
    - "@coder (GH-406 delivery: vocabulary documentation, additive contracts, noun corrections, conformance and naming enforcement, fixtures)"
    - "@doc-syncer (system-spec reconciliation of the residual contract-truth wording)"
  informed:
    - "Consumers of the declared key: GH-396, GH-397, GH-399 (credential audiences, bindings, store scope, workspace base) and GH-401 (manifest write and import)"
    - "GH-404 (lanes in worktrees) and GH-407 (planning horizon) — vocabulary consumers"
    - "GH-408 — the mechanical rename that follows this change under the record-plus-code rule"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: false
  human_decider: null
  reviewers: []
revisit_triggers:
  - "The owner rejects the vocabulary at the pull request: this record is closed `Rejected` and the delivered wording corrections that depend on it are reverted or re-based on the owner's corrected terms in a superseding change; the additive contracts (pattern, alias, accessor) are vocabulary-neutral and survive on their own engineering merit."
  - "The declared-key grammar proves wrong for a real product key before GH-401 lands (a legitimate key refused, a hostile key admitted): widen or narrow the grammar in a superseding record BEFORE the manifest write/import consumer creates enforcement, never after."
  - "A reserved state segment beyond `unbound` and `projects` is introduced: the predicate's reserved set is extended in the same change that introduces the segment, with a test naming the new refusal."
  - "GH-408's mechanical rename is planned: this record is the mapping's source of truth — the rename moves the delivered identifiers onto the vocabulary names under ODR-0003 DC-4's record-plus-code rule, and the four named exceptions retire only there."
  - "A consumer needs substring-level reserved-segment refusal or per-consumer grammars: that is a consumer-change decision recorded on its own; this record's exact-match refusal and single grammar stay until then."
links:
  related_changes: ["GH-406"]
  related_decisions: ["ODR-0003", "ODR-0004"]
---

# ODR-0006: Delivery Vocabulary — Declared Product Key

## Context

The delivery surfaces grew around two identifiers that do not name what they
denote: what the code calls a project key is the identity of a **clone** —
minted once per clone into the git-directory marker, shared by the main
checkout and every linked worktree of that clone, and keying the per-clone
state root. The delivery unit is what the local configuration layer calls a
**group** (`groupKey`). `projects list` used to print GROUP and MEMBER;
`repos list` used to print KEY for a clone; no term named a main checkout, a
worktree, or a lane anywhere in the delivery contracts; and two committed
sentences in the ubiquitous-language overview asserted that a repository is
one checkout and the delivery unit and that the identifier `project key` keeps
its repository meaning. The credential design drafted for M4 bound audiences,
bindings, and the owned store's scope to the clone identity; the owner
corrected the direction: a credential belongs to the *product*, and the clone
identity differs per clone so it cannot name one.

The owner's delivery brief (GH-406, comment 7122871259) directs one vocabulary,
reverses the two sentences, and orders that **nothing is renamed** in the
change that establishes it. The owner's vocabulary amendment (comment
7138707234) then fixes the vocabulary's nouns: the delivery unit is the
**product** — not the project — its member is the **repository**, and the
product's own key is the **product key**. The noun *project* is retired from
the model's own vocabulary: where the tracker's own word is meant, the
documentation writes "Jira project". Existing names containing "project"
(`repoKey`, `projectKey`, the `projects` command family, `--project-root`, the
`<host root>/projects/` container, the `--flat` alias) are named legacy
exceptions, not vocabulary, and stay until the mechanical rename (GH-408).

## Decision

### The delivery vocabulary

| Term | Meaning | Lifetime |
|---|---|---|
| Product | One or more repositories that together form a single deliverable, planned and delivered as one; declared in its manifest. | Durable |
| Repository | One git repository belonging to exactly one product; the long form "product repository" is used only for contrast in prose and never as a header. | Durable |
| Main checkout | The clone's primary working tree (the directory that holds `.git`); stays on the base branch, whatever that branch is called. | Durable per worker |
| Worktree | A linked git worktree of a main checkout, created for one work item; the word never includes the main checkout. | Temporary |
| Lane | One work item's delivery in one repository: the queue lane keyed `<ref>@<cloneKey>`, resumable across dispatch attempts through the `dispatch.lane` record; an attempt is never a lane. | Temporary |
| Work item | A ticket. | Durable in the tracker |
| Clone identity | The identity minted once per clone into the git-directory marker, shared by the main checkout and every linked worktree of that clone. | Per clone |
| Product key | The product's own key: `groupKey` in the local `groups.v1` layer, `product.key` in the portable manifest (GH-401); the contract names keep the *declared* qualifier while the legacy names exist. | Durable |

The clone identity is named *clone identity*, never *checkout identity*: git
calls every linked worktree a checkout, so *checkout identity* would read as
per-worktree — the opposite of the shared-marker fact (the vocabulary's DEC-3
rationale). The distinct *repository key* (`host/owner/name`) is a different
contention domain and keeps its meaning. Two prose rules hold across this
repository's documentation: where it says "the product" to mean the tool
itself, it says "the tool"; and public examples are neutral only (`acme`,
`example.com`).

### The mapping of the locked names onto the vocabulary

| Vocabulary term | Existing code and document names (unchanged by this record) |
|---|---|
| Product | A group: `groupKey`; the `delivery.projects.groups.v1` schema (local) and `delivery.projects.manifest.v1` (portable, GH-401); the `projects.yaml` configuration file — these are **named exceptions** denoting a product, and renaming them is GH-408 |
| Repository | A `members[]` declaration (repository selector plus tracker kind); `root` and `repoKey` on a member are **clone locators**; a member without a locator is declared, not located; `member` names the declaration entry, never the repository |
| Clone identity | `repoKey` and `projectKey` (same value): the marker field, the host-index key, the public `repos.v1` field, plan/closeout member refs, queue lane and lease keys, verify-gate rows, `board --project`, group member locators, per-clone state root |
| Main checkout | The flat record set (`repos list`) is keyed by clone identity; its `root` is the last invoking checkout, not necessarily the main checkout (GH-404 pins it) |

The product key and the clone identity live in disjoint namespaces —
different fields, different parent directories — and are never compared.

### The product key

The product key's grammar is `^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$`:
exactly 2 to 64 characters of lowercase alphanumerics and hyphens with no
leading or trailing hyphen, path-safe by construction. The pattern's predicate
(`isDeclaredProductKey`, beside the `DECLARED_PRODUCT_KEY_PATTERN` contract
export) additionally refuses the reserved state segments `unbound` and
`projects`, exact-match on the whole key — substring-containing keys
(`projects-x`, `my-unbound`) are accepted. The refusal exists so declared keys
can never collide with the reserved state layout segments; the reserved
segment `projects` keeps its name — a state-layout segment, not model
vocabulary. Enforcement lands only where a key is used as a declared key: the
consumer changes (GH-396, GH-397, GH-399, GH-401) create their own enforcement
points. The local `groups.v1` layer keeps its delivered contract that group
keys carry no public pattern: nothing migrates, and existing configuration
including out-of-grammar group keys keeps loading.

The clone identity's pattern gains its vocabulary name (`CLONE_KEY_PATTERN`)
beside the delivered export, which stays as the same-value alias until the
rename; the resolved project scope serves `cloneKey` as a read of the marker's
identity, and no persisted document carries the new name.

### How the governing records read under this vocabulary

- **ODR-0003 DC-4** (freeze rule after M0) reads unchanged: no locked command
  name, family name, or payload term is renamed here, so the freeze rule is
  not invoked; when GH-408 performs the mechanical rename, DC-4's
  record-plus-code rule governs it — a superseding decision record plus a code
  change, never a documentation-only edit. This record is not that supersession.
- **ODR-0004 C-1** reads unchanged: no rename ships here at all.
- **ODR-0004 C-2** (the delivered `projects.v1` payload stays reachable
  unchanged through the `projects list --flat` alias until the M3 boundary)
  reads unchanged and is honoured literally: the alias payload and its text
  stay byte-identical; only the group surface's own headers change.
- **ODR-0004 C-3** (one meaning per name: `repos` the flat record set,
  `projects` the group surface) reads unchanged; the vocabulary sharpens its
  nouns — the flat record set enumerates checkouts by clone identity, the
  group surface enumerates products — without moving either meaning.
- **ODR-0004 C-4** (the permanent repository vocabulary: the
  `project-identity.json` marker, the `<host root>/projects/<key>` container,
  the host index `projects[]`/`projectKey` fields, and the `--project-root`
  flag) reads unchanged: the delivered names stay. Under this record's mapping
  those names *denote the clone identity*; the four are named exceptions and
  retire only at GH-408.
- **ODR-0004 C-5** (`board --project` stays a repository key; the board is
  never group-scoped) reads unchanged: the flag keeps its name and its
  behaviour, its help states it takes a clone identity, and the board stays
  per-clone and never group-scoped (GH-408 resolves the flag's dual meaning).

No amendment to ODR-0003 or ODR-0004 is made or needed: their conditions hold
as written, and this record states their reading, not a change to them.

## Consequences

- One vocabulary governs all future user-facing wording: the nouns are
  product, repository, and product key, "project" is retired from the model's
  own vocabulary, and "Jira project" names the tracker's own word. A narrowed
  conformance test enforces this over the declared surfaces with the four
  named exceptions frozen until GH-408, and a new-code naming rule keeps the
  two concepts distinct in everything new under a reason-bearing committed
  baseline.
- Nothing is renamed, nothing migrates, and no command name, payload field, or
  persisted field changes; the mechanical rename is GH-408 under the
  record-plus-code rule.
- The owner accepts or rejects the vocabulary at the GH-406 pull request; this
  record ships `Proposed` with a null decision date, and no earlier record is
  edited, so rejection costs no rework elsewhere.
