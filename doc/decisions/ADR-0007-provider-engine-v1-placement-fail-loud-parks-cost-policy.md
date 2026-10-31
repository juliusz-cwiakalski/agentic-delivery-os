---
id: ADR-0007
decision_type: adr
status: Proposed
created: 2026-10-31
decision_date: null
last_updated: 2026-10-31
summary: "GH-182 provider engine v1: pure routing/park policy in the runtime-neutral core with quota HTTP transport as one injected adapters I/O subpath and parks persisted through the delivered state layer; fail-loud replaces fail-open for indeterminate provider availability; parks are a closed-vocabulary, absolutely-expiring state record; subscription-first ordering with paid fallback off by default and no peak-window substitution; provider configuration is a typed, fail-closed branch of the layered catalog with the shipped vendor descriptor as overridable defaults."
owners:
  - "Juliusz Ćwiąkalski"
service: delivery-os provider engine
decision_scope: repo
review_date: null
business_impact: "Converts silent provider stalls and fail-open quota verdicts (delivery-hours loss and unaccounted cost events) into bounded, diagnosable pauses with resume times, and protects subscription quota before paid capacity."
customer_impact: "Operators get a truthful answer to why work did not start and when it resumes; fresh installs fail closed until an operator declares a chain."
classification:
  domains: [architecture, security, pricing, operations, tooling]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: medium
  urgency: medium
  uncertainty: low
  blast_radius: team
  recurrence: one-off
governance:
  driver: "@decision-advisor (via GH-182 delivery)"
  decider: "Juliusz Ćwiąkalski (human acceptance pending at GH-182 PR review)"
  contributors:
    - "@spec-writer (GH-182 spec: DC-1..DC-5 candidates, DEC-1..DEC-13 chosen behavior)"
    - "@decision-advisor (analysis and record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Owner (human final acceptance)"
  performers:
    - "@coder"
    - "@doc-syncer"
  informed:
    - "ADOS contributors"
    - "Consumer stories: M0-S6/GH-175 (status), M0-S7/GH-176 (queue ready), M1-S3/GH-189 (doctor), M1-S11 (harness spawn), M2-S3/GH-186 (ceremony)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: false
  human_decider: null
  reviewers: []
revisit_triggers:
  - "The owner changes the paid-fallback default or requests an enabled default chain (spec OQ-2/OQ-3): that is an owner cost-policy decision and reopens DC-4/DC-5 here or in a successor record."
  - "The M0-S17 naming lock renames the provider-quota adapters subpath or the provider command family (spec OQ-1): mechanical rename, no semantic reopen."
  - "A later surface (status, queue, doctor, spend, ceremony) needs a park/announcement field outside the closed evidence allowlist, or a new park cause: guarded-set growth requires a spec update and, being cross-cutting, a decision-record amendment."
  - "The spawn integration (M1-S11) consumes resolve and the re-evaluation loop and finds the contract insufficient: revisit DC-1/DC-3 rather than patching around them in the consumer."
  - "Operations show fail-loud pauses are routinely wrong (endpoint drift misclassified as outage): revisit classification thresholds, not the fail-loud principle."
  - "A second vendor quota shape cannot be expressed by the generic snapshot contract: the per-provider client-seed path (ADR-0005 precedent) is the paved road; revisit DC-1 only if it fails."
links:
  related_changes: ["GH-182"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-10/2026-10-31--GH-182--provider-v1/chg-GH-182-spec.md"
    - "doc/planning/concepts/model-profiles.md"
    - "doc/planning/concepts/policy-as-code.md"
    - "doc/spec/features/feature-config-layer.md"
    - "doc/spec/features/feature-state-layer.md"
    - "doc/spec/features/feature-adapter-ports.md"
  contracts: []
  diagrams: []
  decisions: ["ADR-0003", "ADR-0005", "TDR-0004"]
  experiments: []
  metrics: []
  roadmap_items: []
---

# ADR-0007: Provider Engine v1 — Placement, Fail-Loud Semantics, Park Vocabulary, and Cost Policy

## Context

- **FACT:** The M0 trust substrate is delivered: the six-package workspace with mechanically enforced package and runtime-API boundaries (ADR-0003), the result contract with its machine-readable error table (including the existing `provider.quota.exceeded` row), the seven-layer typed configuration catalog with fail-closed validation, the append-only state layer with verified reads and atomically replaced derived documents (TDR-0004), and the credential port with a binding secret-read boundary invariant (GH-181, reflected in feature-adapter-ports.md).
- **FACT:** Legacy provider gating lives in a bash hook with a 49-check legacy battery. Its semantics are: UTC peak window, optional quota endpoint, MAX sleep across conditions, sleep-then-fresh-re-evaluation, and a defensive loop cap. Every quota-fetch failure is **fail-open**: one `[WARN]` reason category and "no wait", so the spawn proceeds as if quota were clear. The hook also reads its credential directly from the environment. There is no typed provider configuration, no chain resolution, no durable park state, and no provider command.
- **FACT:** The GH-182 specification records the chosen v1 behavior (its decision log DEC-1..DEC-13) and flags five precedent-setting decision candidates (spec §14.1, DC-1..DC-5) for this record: engine placement, fail-loud semantics, park vocabulary, subscription-first cost policy, and the provider configuration namespace. The spec owns the field-level contracts; this record owns the durable decisions and rationale.
- **FACT:** The planning concepts pre-assign this ground: model-profiles.md maps M0-S13 to "the provider engine ships first" with profile-selection heuristics explicitly later; policy-as-code.md lists "peak windows mean pause, never substitute peak-priced work" and "subscription quota before pay-per-token" as prose policies that gain their engine check at M0-S13.
- **FACT:** ADR-0005 establishes the reviewed path for admitting provider-client subpaths performing network I/O into the runtime-API confinement allowance as exact, reason-bearing entries; the quota transport subpath in this change follows that precedent.
- **Why now:** this is the first engine in the workspace that mixes pure decision policy with external I/O, so its placement sets the pattern every later engine (and the later spawn integration) will copy. The park and announcement vocabulary is consumed by at least five later stories (status, queue readiness, doctor, harness spawn, ceremony). Placement and vocabulary are cheap to choose now and expensive to change after consumers exist. The change is additive: the legacy hook stays untouched and remains the spawn path until the later cutover (spec NG-7, §18).

## Problem Framing (Clarified)

Provider availability semantics currently live where they cannot be reused or trusted: an untestable-by-default bash hook that treats every indeterminate verdict as clear, keeps no durable record of a pause, reads credentials directly from the environment, and encodes no declarative cost policy. The result is the silent-outage defect class: agents and operators cannot tell why work did not start, whether paying more would help, or when the provider resumes — and paid capacity can absorb work that a quota or peak policy should have paused.

The decision question is five-fold, and the five answers lock together:

1. **Placement (DC-1):** where does provider policy live, and where does its I/O live, given the runtime-neutral core / adapters I/O tiering and the delivered state and credential layers?
2. **Failure semantics (DC-2):** what happens when availability cannot be determined — proceed, or announce-and-park/fail?
3. **Durable vocabulary (DC-3):** what is a "park", what causes and fields may it carry, and how does it expire?
4. **Cost policy (DC-4):** when may paid capacity be used relative to subscription quota and peak windows?
5. **Configuration (DC-5):** how are providers, credentials, and chains declared, and what ships as defaults?

Desired outcomes: deterministic, hermetically testable routing policy; every pause named, caused, and resumable; secrets mechanically confined to the credential port; cost decisions explicit in validated configuration; and one vocabulary that later surfaces consume instead of re-deriving. Out of scope: model-profile selection heuristics, harness spawn, non-UTC timezones, background daemons, and any modification of the legacy hook (spec §4.2, §7.2).

## Constraints (Hard Requirements)

| ID | Pass/fail requirement | Source | Verification | Negotiable |
|---|---|---|---|---|
| C-1 | Provider policy evaluation is pure and runtime-neutral: no runtime imports, ambient clock, randomness, or environment reads inside policy; all I/O (quota transport, clock, sleep, credentials, state) enters through injected seams at a composition edge. | ADR-0003 DEC-2/C-9 (tier matrix, runtime neutrality) | dependency-cruiser rules, ambient-globals guard, hermetic test suite (spec NFR-2/NFR-3) | no |
| C-2 | Quota authorization resolves only through the delivered credential port; the secret-read allowlist gains zero entries; no secret, authorization header, or raw response body appears in any envelope, diagnostic, record, or evidence. | GH-181 delivered port; GH-182 G-6/ticket AC | secret-read boundary invariant (count unchanged), planted-canary scans (spec NFR-4, AC-F7-*) | no |
| C-3 | Durable pause state persists through the delivered state layer as additive record kinds inside the existing schema version (append-only ledger plus rebuildable derived document); no second store; the ticket's park-reports-cause-and-expiry criterion is met by a durable record, not an ephemeral computation. | TDR-0004/GH-174 delivered layer; GH-182 DEC-2; ticket AC (Appendix D) | state-layer round-trip tests; schema version unchanged; projection rebuild test | no |
| C-4 | Provider configuration is typed and schema-validated in the layered catalog and carries credential *references* only — never secret values; endpoints are HTTPS without userinfo. | M0-S4 config layer (fail-closed validation); policy-as-code.md ("secrets live in the environment only"); GH-182 F-1/DM-5 | config validation tests; forbidden-value checks | no |
| C-5 | No silent-clear path: every indeterminate availability verdict (transport, HTTP, envelope, parse, auth, credential) produces a structured announcement plus a park or a classified error — never a proceed-as-clear. | GH-182 ticket AC ("outage is announced, not silent"); spec G-5, AC-F4-6/AC-F6-4 | ported legacy-parity suite asserting every fail-open class now announces (spec NFR-9) | no |
| C-6 | Fail-closed cost and default posture: a fresh installation resolves no chain until an operator declares one; chain validation rejects cost-order violations instead of silently reordering; cost-bearing paid fallback is off by default. | Internal standard (M0-S4 fail-closed config validation); GH-182 OQ-3 (fail-closed safety decision); policy-as-code.md §B | chain validation tests (0 ordering violations accepted); defaults manifest asserts no enabled chain | no |

> **Table stakes:** all alternatives considered keep committed content OSS-safe and brand-neutral (vendor names appear only as declarative configuration data and public endpoint URLs), introduce no new third-party dependency (the transport uses the runtime's existing fetch), and deliver additively beside the untouched legacy hook. Acknowledged once, not repeated per alternative.

## Decision Drivers

1. **Determinism and hermetic testability of routing policy** — identical config, clock, and transport facts produce identical decisions and records; the whole policy is testable without network, credentials, or real sleeps (project priority: determinism).
2. **Diagnosability of pauses** — every pause answers "why" and "until when" with a machine-readable cause and an absolute resume time; silence is never a valid outcome.
3. **Cost protection** — subscription quota is consumed before paid capacity; peak-priced capacity is paused, not substituted.
4. **Mechanical boundary integrity** — runtime neutrality and the secret-read boundary stay green by construction, not by discipline.
5. **Vocabulary reuse across surfaces** — status, queue readiness, doctor, spend, and ceremony consume one park/announcement vocabulary instead of re-deriving provider state.
6. **Precedent clarity** — the placement pattern is explicit and copyable by every later engine that mixes pure policy with external I/O.
7. **Lean delivery** — reuse the delivered substrate (state layer, config layer, credential port, result contract) instead of inventing parallel mechanisms.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (during GH-182 delivery; the spec's §14.1 delegates the five candidates here).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at GH-182 PR review. AI does not accept this record; it stays `Proposed` until then.
- **Contributors:** `@spec-writer` (GH-182 spec: candidate framing and chosen behavior), `@decision-advisor` (analysis, this record).
- **Required reviewers:** `@readiness-reviewer` and `@reviewer` on the GH-182 change; the owner for final acceptance. R2 does not require a `@decision-critic` challenge; one may be requested via `/review-decision` if the owner wants it.
- **Performers:** `@coder` (engine, transport subpath, confinement entry, CLI surface, tests), `@doc-syncer` (feature/config/state/error-table spec reconciliation).
- **Informed:** ADOS contributors; the consumer stories listed in the front matter.
- **Timing:** recorded during GH-182 delivery, before merge; the spec's §18 DoD predicate requires the owner-policy items (below) to be resolved through these candidates before the configuration surface merges.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| The runtime-neutral core / adapters I/O tiering and its mechanical enforcement are delivered and green. | FACT | ADR-0003; feature-monorepo-scaffold-toolchain.md; GH-182 §2.1 | DC-1's placement would need a different substrate; the whole tier story would be unsound. | High |
| Provider client subpaths performing network I/O join the runtime-API confinement allowance as exact, reason-bearing reviewed entries (precedent: `github`/`gitlab`/`jira` via GH-188; `credentials` via GH-181). | FACT | ADR-0005 (Proposed, same lineage); feature-adapter-ports.md | The quota transport subpath admission would need its own allowance mechanism; the precedent would be unproven. | High |
| The state layer's append, verified read, and derived-document replace are delivered and sufficient for park/announcement records without a schema change. | FACT (delivered) / ASSUMPTION (sufficiency) | TDR-0004; feature-state-layer.md; GH-182 §12 | A schema-version bump and migration would be required; DC-3's append-only design would need rework. | High / Medium |
| The credential port's synchronous resolve covers quota authorization; the fetch receives material as data. | FACT (delivered) / ASSUMPTION (sufficiency) | GH-181; GH-182 §12 | Async credential resolution would force a port extension before the engine ships. | High / Medium |
| The legacy hook is fail-open on every quota-fetch failure and reads its credential directly from the environment. | FACT | GH-182 §2.1; legacy battery TC-ZAI-050..052 (fail-open exit 0) | DC-2 would be replacing a defect that does not exist; the parity divergence assertions would be vacuous. | High |
| The legacy battery executes 49 `TC-ZAI-*` checks with a documented parity mapping (Appendix A). | FACT | GH-182 §2.1, Appendix A | Parity coverage claims would overstate; boundary-math regressions could hide. | High |
| "Peak windows mean pause" and "subscription quota before pay-per-token" are the intended policies for M0-S13. | FACT | policy-as-code.md §B (prose policies gaining their engine) | DC-4 would be inventing policy rather than encoding it; the owner-policy confirmation would be mandatory before merge. | High |
| Model-profile selection and harness spawn are later stories; the engine returns a decision, not a session. | FACT | model-profiles.md story mapping; GH-182 NG-1/NG-2 | Scope creep into profile heuristics or spawn would change placement and CLI contracts. | High |
| The shipped vendor descriptor's quota response shape is stable enough to be the single shipped concrete case. | ASSUMPTION | GH-182 §12, DEC-13 | Endpoint drift yields malformed snapshots → outage parks and announcements (visible, not silent); the descriptor is overridable configuration, so no code change is forced. | Medium |
| The `provider-quota` adapters subpath name survives until the M0-S17 naming lock, which may rename it. | TO-CONFIRM | GH-182 OQ-1 | Mechanical rename only; behavior is name-independent. | High (that it may change) |
| The owner confirms the fail-closed defaults (paid fallback off; no enabled chain) at review. | TO-CONFIRM | GH-182 OQ-2/OQ-3; spec §18 DoD predicate | A different default is an owner cost-policy decision and reopens DC-4/DC-5 (revisit trigger recorded). | Medium |

## Mental Models & Techniques Used

- **Ports and adapters / purity boundary (first principles):** what must the engine *decide* versus what must it *observe*? Decision (validation, ordering, evaluation, projection) is pure data-in/data-out; observation (HTTP, clock, sleep, credentials, persistence) is injected. The seam is where testability is won or lost.
- **Inversion:** design from the worst day — endpoint down, credential missing, response malformed, clock at a boundary. Each case must produce a named, bounded outcome; any case that "falls through" to clear is the defect class this decision exists to eliminate.
- **Fail-closed defaults:** absence of configuration is a decision to do nothing expensive; a fresh install must not be able to spend money or proceed on indeterminate evidence by accident.
- **Closed-vocabulary state (policy as code):** a park is a checkable record with a cause from a guarded set, not free text; guarded-set growth is a deliberate, reviewed act.
- **Append-only truth with derived views:** the ledger is the record; the projection is a cache; expiry is a computation at read time, so no daemon, timer, or delete path exists.
- **Second-order thinking:** placement and vocabulary are cheap before five consumer stories exist and expensive after; front-loading them is the point of recording this now.
- **Opportunity cost / lean delivery:** a second store, a second announcement bus, or a vendor-specific engine would each add a mechanism the delivered substrate already provides.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

|          | C-1 pure/injected | C-2 credential port | C-3 state-layer parks | C-4 typed config, refs only | C-5 no silent clear | C-6 fail-closed cost |
|----------|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 keep the legacy hook as-is | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| ALT-1 pure core policy + injected adapters I/O subpath + state-layer parks (selected) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 engine colocated with its I/O (adapters provider-client subpath or CLI command owns policy + transport) | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-3 TypeScript engine, fail-open semantics retained (warn loudly, proceed) | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| ALT-4 paid fallback on by default, peak substitution allowed | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| ALT-5 ephemeral availability (announce only, no durable parks; recompute on demand) | ✅ | ✅ | ❌ | ✅ | ⚠️ | ✅ |

Legend: ✅ passes · ❌ fails · ⚠️ passes only via an accepted-risk exception (none taken; see ALT-5 note).

### Alternative 0 — Do Nothing / Keep the Legacy Hook

- **Eligibility:** Not eligible (fails C-1, C-2, C-3, C-4, C-5).
- **Summary:** Provider gating stays in the bash hook: fail-open warnings, direct environment credential reads, no durable pause state, no typed configuration, no reusable vocabulary.
- **Constraint compliance:** Policy is fused into an untestable script with ambient reads (C-1, C-2, C-4); pauses are not durable (C-3); indeterminate verdicts proceed as clear (C-5). It does not silently substitute paid capacity (C-6 pass is vacuous — there is no chain concept).
- **Driver fit:** Worst on every driver; nothing is reusable by the coordinator, status, queue, doctor, or ceremony surfaces.
- **Pros:** Zero delivery cost; operators know the current behavior.
- **Cons:** The silent-outage class survives; every later surface re-derives provider state; the 49-check battery stays bash-locked.
- **Why rejected:** It is the defect being fixed; the ticket's acceptance criteria are unmet.

### Alternative 1 — Pure Core Policy, Injected Adapters I/O Subpath, State-Layer Parks (selected)

- **Eligibility:** Eligible.
- **Summary:** Validation, chain resolution, peak/quota evaluation, MAX-over-conditions, park/announcement projection, and loop policy are pure functions in the runtime-neutral core; the quota HTTP transport is one injectable implementation in a new declared adapters I/O subpath (working name `provider-quota`, subject to the M0-S17 naming lock); clock, sleep, credential port, and state store are injected at the CLI composition edge; parks and announcements are additive record kinds in the delivered state ledger with a rebuildable projection.
- **Constraint compliance:** Passes all six (matrix above).
- **Driver fit:** Best overall — determinism and testability by construction (D1); boundaries stay mechanical (D4); precedent is explicit for later engines (D6); maximal substrate reuse (D7).
- **Pros:** Hermetic tests for all policy; confinement growth follows the ADR-0005 reviewed path; later surfaces read state, not the engine.
- **Cons:** One more injected seam to wire and one more allowlist entry to review; policy and transport live in different packages, so a change may span two.
- **Why chosen:** The only placement that satisfies C-1 while keeping the I/O at the declared edge — and it converts the legacy battery into a portable, provider-agnostic parity suite.

### Alternative 2 — Engine Colocated With Its I/O (Adapters Subpath or CLI Command)

- **Eligibility:** Not eligible (fails C-1).
- **Summary:** Policy and transport live together where the transport lives — a provider-client adapters subpath (like the tracker/VCS/CI seeds) or inside the CLI command.
- **Constraint compliance:** Could satisfy C-2..C-6, but policy evaluation becomes inseparable from runtime I/O: neutral consumers (MCP, later engines) cannot resolve a chain without importing adapter code, and no hermetic policy test exists without mocking the whole I/O stack.
- **Driver fit:** Undermines D1 and D4; the precedent would license every future engine to fuse policy with fetches.
- **Pros:** Fewer packages touched per change; wiring is local.
- **Cons:** Routing decisions untestable without I/O doubles; boundary enforcement degrades to discipline; inverts the ADR-0003 tier story.
- **Why rejected:** Fails the runtime-neutrality gate and the project's determinism priority; the modest wiring convenience does not pay for it.

### Alternative 3 — TypeScript Engine, Fail-Open Retained (Warn and Proceed)

- **Eligibility:** Not eligible (fails C-5).
- **Summary:** Port the hook faithfully to TypeScript — structured warnings, but an indeterminate quota verdict still returns "no wait" and proceeds.
- **Constraint compliance:** Satisfies placement and config constraints, but the proceed-as-clear path is exactly the silent-outage class the ticket forbids, however loud the warning is.
- **Driver fit:** Fails D2 (diagnosability: a warning followed by a paid spawn is still an unaccounted cost event); betrays the parity suite's purpose.
- **Pros:** Zero operator-facing behavior change; smallest divergence from the legacy battery.
- **Cons:** Preserves the defect class; announcements become decoration.
- **Why rejected:** The ticket's "outage is announced, not silent" criterion makes fail-open disqualifying. The intentional divergence is asserted by the ported parity suite instead of being papered over.

### Alternative 4 — Paid Fallback On by Default, Peak Substitution Allowed

- **Eligibility:** Not eligible (fails C-6).
- **Summary:** Ship `allowPaidFallback: true` as the default and permit a peak-window park to be served by later paid entries — maximizing throughput at the cost of spend control.
- **Constraint compliance:** Fails the fail-closed cost posture: a fresh install could spend money without an explicit opt-in, and peak substitution contradicts the recorded policy ("peak windows mean pause, never substitute").
- **Driver fit:** Inverts D3 (cost protection); the throughput gain is real but is an owner policy choice, not an engineering default.
- **Pros:** Fewer pauses during peak and outage windows; higher delivery continuity out of the box.
- **Cons:** Silent cost exposure on fresh installs; subscription quota protection becomes opt-in rather than default.
- **Why rejected:** Disqualifying under C-6. Explicitly enabling fallback per chain remains available to the operator — the decision removes only the *default-on* posture (see Unresolved Questions for the owner-policy item).

### Alternative 5 — Ephemeral Availability (Announce-Only, No Durable Parks)

- **Eligibility:** Not eligible (fails C-3; the C-5 pass would require an accepted-risk exception that is not taken).
- **Summary:** Keep announcements but drop durable parks; every consumer re-fetches quota and recomputes availability on demand.
- **Constraint compliance:** The ticket's park-reports-cause-and-expiry criterion demands a durable record; recomputation requires network access from consumers that must stay offline (status, `parks list`), so in practice outages would degrade back toward unclear verdicts (C-5 at risk).
- **Driver fit:** Fails D5 (vocabulary reuse) and D2 (resume times without a fetch); no consumer can show "paused until 10:00 UTC" without re-probing the failing endpoint.
- **Pros:** No state writes; no ledger growth; simpler engine.
- **Cons:** Resume times unknowable during outages; every surface re-derives (or guesses) provider state; the spawn gate has nothing to sleep until.
- **Why rejected:** A park whose meaning survives the process that created it is the entire point; ephemerality re-creates the silent stall in a new shape.

## Decision

- **Recommendation (analyst):** Alternative 1, with the semantics, vocabulary, cost policy, and configuration namespace specified below. The GH-182 specification already records this as its chosen behavior (DEC-1..DEC-13); this record is the durable, cross-story home for the five precedent-setting elements.
- **Authorized Decision:** pending — the owner accepts or adjusts at GH-182 PR review. Until then this record is `Proposed` and blocks nothing except the claim of authority.

### DC-1 — Engine placement

Pure provider policy (configuration validation, chain resolution, peak-window evaluation, quota snapshot normalization and evaluation, MAX-over-conditions, park and announcement projection, deterministic announcement identity, re-evaluation loop policy) lives in the **runtime-neutral core** and imports only core contracts. The quota HTTP transport is one injectable transport interface with a native-fetch production implementation in a **new declared adapters I/O subpath** (working name `provider-quota`; the name is subject to the M0-S17 naming lock — spec OQ-1) admitted to the runtime-API confinement allowance as an exact, reason-bearing entry per the ADR-0005 precedent. Clock, sleep, credential port, and state store are injected at the CLI composition edge. Parks and announcements persist **through the delivered state layer** as additive record kinds (`provider.park`, `provider.announcement`) inside the existing schema version, folded into the rebuildable `provider-parks.json` derived document — no second store.

### DC-2 — Fail-loud replaces fail-open

No transport, HTTP, envelope, parse, auth, or credential failure is ever treated as a clear verdict. Each produces a structured announcement with a closed code plus a park or a classified error. The re-evaluation loop cap parks (`reevaluation-cap`, bounded TTL expiry) instead of proceeding. An exhausted quota limit with no valid reset fails loud (`provider.quota.exceeded` with `provider.quota.reset_missing`) rather than fabricating an expiry. An outage on an entry skipped in favor of another is still announced and parked so status can show it. This is an intentional, documented behavior change from the legacy hook, confined to the new engine, and asserted by the ported legacy-parity suite (every legacy fail-open class now asserts an announcement or classified error).

### DC-3 — Park vocabulary

A park is a named, self-expiring provider or chain pause: name `provider:<name>` or `chain:<name>`; cause from a closed set (`peak-window`, `quota-exhausted`, `provider-outage`, `credential-missing`, `credential-rejected`, `chain-exhausted`, `reevaluation-cap`); active condition kinds; creation time; and an **absolute expiry strictly in the future at creation**. Expiry is derived at read time (`expiresAt <= now` ⇒ inactive) — no deletes, timers, daemons, or expiry writes. Records are append-only with deterministic identity dedupe per park generation (unchanged conditions append nothing); the latest record wins; the projection is rebuildable from verified ledger truth. Evidence fields are a closed allowlist (reference names and failure classes, never secret values, headers, or raw bodies). A park is never a blocked lane: parks describe provider availability and always carry a resume time; blocked lanes describe delivery readiness.

### DC-4 — Subscription-first cost policy

Chain validation requires every subscription entry to precede every pay-per-token entry and **rejects** violations (no silent reordering), rejects duplicates, unknown references, and empty chains. Paid fallback is a per-chain boolean, **off by default**. A peak-window park **never** permits substitution to paid capacity: peak windows pause work rather than move it to peak-priced capacity. Skipped entries are reported with exactly one reason from a closed eight-value set with deterministic precedence, so every routing decision is explainable and auditable.

### DC-5 — Provider configuration namespace

Provider descriptors (cost class, enabled flag, optional peak window, optional quota policy), credential *references* (port source-key mappings, never secret values), and chains (ordered entries plus paid-fallback policy) form a typed, schema-validated `provider` branch of the **layered configuration catalog**, overridable per layer with provenance visible through config debug. The built-in defaults ship one concrete vendor descriptor and its credential reference — the shipped public-endpoint subscription case, the canonical parity target — as **overridable fail-closed defaults**; **no chain is enabled by default**, so a fresh installation resolves nothing until an operator declares a chain (`provider.chain.empty`). The engine hardcodes no vendor values; names, endpoints, and credential source-key names are declarative data.

### Deferred owner-policy items

- **Paid-fallback default (spec OQ-2):** v1 ships fail-closed. Enabling paid fallback by default — and under what cost cap — is an owner cost-policy decision; this record's posture holds until the owner decides otherwise (revisit trigger recorded).
- **Shipped-descriptor / chain posture (spec OQ-3):** descriptor and credential reference ship; no enabled chain ships. An owner-requested enabled default chain reopens this element.
- **Subpath naming (spec OQ-1):** the `provider-quota` adapters subpath name is a working name subject to the M0-S17 naming lock; behavior is name-independent and the rename is mechanical.

- **Decider:** Owner (Juliusz Ćwiąkalski) — acceptance pending at GH-182 PR review.
- **Conditions for revisit:** see `revisit_triggers` in the front matter; most important are an owner change to the cost-policy defaults and guarded-vocabulary growth pressure from consumer stories.

### Constraint Compliance Attestation

The chosen alternative (ALT-1) satisfies all constraints C-1 through C-6: policy is pure with injected I/O (C-1); authorization goes only through the credential port with zero allowlist growth and closed evidence allowlists (C-2); parks are additive record kinds in the delivered ledger with a rebuildable projection (C-3); configuration is typed, layered, and reference-only (C-4); no path treats an indeterminate verdict as clear (C-5); and defaults fail closed with validation-enforced cost ordering (C-6). No accepted-risk exceptions are taken. Per the spec's §18 Definition-of-Done predicate, if the owner disputes the paid-fallback default or the shipped-descriptor/chain posture, that dispute is resolved through this record's candidates before the affected configuration surface merges.

## Trade-offs & Consequences

### Positive Outcomes

- The silent-outage defect class is structurally eliminated in the new engine: every indeterminate verdict is named, classified, and bounded.
- Routing policy is deterministic and hermetically testable; the 49-check legacy battery becomes a portable, provider-agnostic parity suite with an explicit fail-loud divergence mapping.
- Later surfaces (status, queue readiness, doctor, spend, ceremony) consume one durable vocabulary with resume times instead of re-probing endpoints or re-deriving state.
- Subscription quota is protected before paid capacity by validation, not by convention; cost decisions live in auditable configuration.
- The placement precedent (pure core policy + injected adapters I/O subpath + state-layer records) is explicit and reusable for every later engine mixing policy with I/O.
- Secret handling stays mechanically confined: one port, zero new allowlist entries, closed evidence allowlists, canary-verified.

### Negative Outcomes

- Operators who relied on fail-open proceeding will see pauses where spawns previously went through; each pause carries a cause and resume time, but the semantics must be learned (spec RSK-1 residual).
- The append-only ledger grows with park and announcement records (bounded by deterministic dedupe and per-generation identity; the projection is rebuildable).
- One more adapters subpath, one more confinement allowance entry, and two new state record kinds join the audited surface.
- Policy and transport live in different packages; a cross-cutting change can span core, adapters, and CLI in one delivery.
- The closed vocabularies (causes, skip reasons, announcement codes, evidence fields) make legitimate extensions deliberately heavier — a spec update and, where cross-cutting, a record amendment.

### Unresolved Questions

- [ ] Owner confirmation of the paid-fallback default and the shipped-descriptor/chain posture (spec OQ-2/OQ-3) — required before the configuration surface merges (owner: Juliusz Ćwiąkalski, at GH-182 PR review).
- [ ] The M0-S17 naming lock may rename the `provider-quota` subpath and the `provider` command family (spec OQ-1) (owner: M0-S17 story).
- [ ] Whether the shipped single-vendor quota shape remains sufficient, or a second vendor shape forces the per-provider client-seed path (owner: future provider stories; revisit trigger recorded).

## Implementation Plan

1. Deliver per the GH-182 spec and plan (contracts → pure policy → catalog fields and defaults → transport subpath with its confinement allowance and negative fixtures → CLI surface → error rows → ported parity battery); implementation mechanics, field contracts, and test homes are owned by the spec/plan, not this record.
2. Doc-sync phase: reconcile the provider-engine feature spec, the config-layer spec (provider keys), the state-layer spec (park vocabulary), the error-table documentation, and the command registry with this record's vocabulary.
3. Resolve the deferred owner-policy items (above) through PR review before merging the affected configuration surface, per the spec's §18 DoD predicate; record any posture change as an amendment or successor to this record.

## Verification Criteria

- Metric: legacy fail-open classes that remain silent — Target: 0 (every class asserts an announcement or classified error) — Window: GH-182 CI (parity suite).
- Metric: secret-read allowlist entry count and canary observability — Target: count unchanged, canary unobservable — Window: GH-182 CI.
- Metric: deterministic replay of decisions and record payloads across repeated runs — Target: 100% identical — Window: GH-182 CI.
- Metric: subscription-first ordering violations accepted by validation — Target: 0 — Window: GH-182 CI.
- Metric: park records with a closed cause and an absolute future expiry — Target: 100% — Window: GH-182 CI (structure tests).
- Metric: consumer adoption without vocabulary change (status M0-S6, doctor M1-S3, spawn M1-S11, ceremony M2-S3) — Target: no schema change required by consumers — Window: first retro after those stories land; `review_date` set at acceptance.

## Confidence Rating

**Medium–high.** Placement, vocabulary, and configuration follow delivered, mechanically enforced patterns (ADR-0003, ADR-0005, TDR-0004), and the cost policy encodes pre-existing concept policies; the evidence base is the repository itself. The medium component is operational: how operators experience fail-loud pause semantics at the spawn cutover, and owner confirmation of the two deferred policy defaults — both are bounded by revisit triggers, not by analysis.

## References

- [GH-182 change specification](../changes/2026-10/2026-10-31--GH-182--provider-v1/chg-GH-182-spec.md) — §5 (capabilities), §8 (interfaces and data model), §14.1 (DC-1..DC-5), §15 (DEC-1..DEC-13), §21 (security review), appendices.
- [ADR-0003](ADR-0003-oss-monorepo-structure.md) — runtime-neutral core / adapters I/O tiering; runtime-API confinement; strangler coexistence.
- [ADR-0005](ADR-0005-runtime-confinement-provider-client-subpaths.md) — reviewed-allowance precedent for provider client subpaths performing network I/O.
- [TDR-0004](TDR-0004-state-storage-engine.md) — delivered state layer: append-only ledger, verified reads, derived documents.
- [Model profiles concept](../planning/concepts/model-profiles.md) — story mapping: provider engine first, profile heuristics later.
- [Policy as code concept](../planning/concepts/policy-as-code.md) — "peak windows mean pause"; "subscription quota before pay-per-token".
- Feature specs: [config layer](../spec/features/feature-config-layer.md), [state layer](../spec/features/feature-state-layer.md), [adapter ports](../spec/features/feature-adapter-ports.md).
