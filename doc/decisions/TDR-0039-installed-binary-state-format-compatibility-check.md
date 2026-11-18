---
id: TDR-0039
decision_type: tdr
status: Proposed
created: 2026-11-18
decision_date: null
last_updated: 2026-11-18
summary: "The installed-binary ↔ repository-state compatibility check compares one already-delivered identifier — the artifact's accepted state-store format version (`delivery.state.v1`) — against the ledger header that each Jaiship state root already writes, and against nothing else: no aggregate repository-state version, no per-record scan, no negotiation, no rewrite. It runs as a read-only pre-flight at install and rollback (advisory, never blocking, because the artifact that fixes a mismatch must be installable) and as the verdict behind `install status` (typed refusal, exit 1); the hard enforcement point stays the delivered `state.schema.mismatch` refusal at first store open."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os install surface (compatibility verdict) and state-store contract"
decision_scope: repo
review_date: null
business_impact: "M4-S1 names a compatibility check between the installed binary and the repository state version. Without a bounded, additive rule the product either invents a second state contract (the one thing the milestone forbids) or ships a check that can only ever say 'unknown'."
customer_impact: "An operator learns — before or immediately after an install — that the artifact in hand cannot read the delivery state on this machine, with the root, the recorded version, the accepted version, and the remedy named, instead of discovering it at the first command that opens the store."
classification:
  domains: [architecture, contracts, operations, tooling]
  archetype: policy
  environment: complicated
  rigor: R2
  reversibility: easy
  stakes: medium
  urgency: low
  uncertainty: medium
  blast_radius: team
  recurrence: one-off
governance:
  driver: "@decision-advisor (GH-346: the change specification is blocked on what the compatibility check compares)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-346 PR review; AI does not accept this R2 record"
  contributors:
    - "@decision-advisor (repository analysis and this record)"
    - "@pm (GH-346 clarify_scope: the M4-S1 scope line that names the check)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-346 PR review — this record constrains any future state-format change)"
  performers:
    - "@coder (GH-346 delivery: header read, verdict composition, install record field, `install status` wiring, tests)"
    - "@doc-syncer (state-layer page, CLI entrypoint page, local-install guide)"
  informed:
    - "M4-S2 namespace migration (moves state roots; must not re-version them)"
    - "Any later state-format change (this record makes the header the compatibility surface)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: false
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A state-format v2 is proposed: the identifier changes in one place and this check becomes a set-membership question, so decide then whether one artifact accepts multiple formats rather than widening this comparison silently."
  - "A per-domain format change makes the store header insufficient (for example a record kind that must be rejected before any header is read): decide a bounded additional pre-flight, rather than scanning record payloads from the install surface."
  - "Multi-host or shared-state setups appear: decide how the check enumerates roots it does not own, rather than widening the bound in §2."
  - "M4-S2 changes state-root locations: the enumeration in §2 moves with the migration and must be updated in the same change, or the verdict silently reports `unchecked` forever."
links:
  related_changes: ["GH-346"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/spec/features/feature-state-layer.md"
    - "doc/spec/features/feature-cli-entrypoint.md"
    - "doc/guides/local-install.md"
    - "doc/planning/oss-tooling/milestones/m4/install-model.md"
  contracts:
    - "packages/core/src/contracts/state.ts"
    - "packages/core/src/state/index.ts"
    - "packages/core/src/contracts/error-table.ts"
  diagrams: []
  decisions: ["TDR-0022", "TDR-0004", "TDR-0036", "TDR-0037"]
  experiments: []
  metrics: []
  roadmap_items: ["M4-S1", "M4-S2"]
---

# TDR-0039: Installed-Binary ↔ State-Format Compatibility Check — One Delivered Identifier, Read-Only, Never Blocking

## Context

- **FACT:** The state layer declares exactly one store-format identifier, `STATE_SCHEMA_VERSION = "delivery.state.v1"`, documented as "the single home of the v1 store-format identifier" (`packages/core/src/contracts/state.ts`, read 2026-11-18).
- **FACT:** The store writes that identifier into a header file at `${stateDirectory}/header.${workspace}.json` as `{ "schemaVersion": … }` when the store is first created, and it **already refuses on mismatch in two places**: the injected identity's version is checked before any I/O, and the header is re-read and compared on open, both answering `state.schema.mismatch`, which is registered as `platform-provider`, `retryable: false`, `consequence: not_landed`, with the remediation "use a compatible tool version or migrate the store explicitly, then retry" (`packages/core/src/state/index.ts`, `packages/core/src/contracts/error-table.ts`, read 2026-11-18).
- **FACT:** Every other version in the system is **per-domain**, not store-wide: `delivery.status.v1`, `delivery.queue.v1`, `delivery.registry.v1`, `delivery.plan.v1`, `delivery.blockers.v1`, `delivery.verify-gates.v1`, `delivery.result.v1`, `delivery.brief.v1`, `delivery.steer.v1`, `delivery.board.v1`, `delivery.supervision.v1`, `delivery.telemetry.storage.v1`, `delivery.session-admin.v1`, `delivery.watchdog.v1`, `delivery.doctor.v1`, `delivery.merge.gates.v1`, `delivery.queue-ready.v1`, `delivery.lanes.v1`, `delivery.state.v1`, and their siblings (grep over `packages/core/src/contracts/*.ts`, read 2026-11-18). Each is enforced at its own read or write boundary.
- **FACT:** There is **no** single "repository state version" anywhere in the contracts, and no aggregate or manifest-level version of the state roots.
- **FACT:** State roots are per project under a host root (`<host>/projects/<project key>`), and the host root itself is selected by an override or a brand default (TDR-0022; `doc/spec/features/feature-projects.md`, read 2026-11-18). A machine can therefore hold several independent stores with independent headers.
- **FACT:** M4-S1's scope line names "a compatibility check between installed binary and repository state version" (`doc/planning/oss-tooling/milestones/m4/backlog.md`, read 2026-11-18).
- **FACT:** M4 constraints forbid a second state contract; GH-346 restates it ("additive contracts; no second state contract").
- **FACT:** The artifact now carries an injected build identity and a machine-readable status surface is being added by the install family (TDR-0036 §1, TDR-0037 §4), so there is a natural, non-self-description place to report a verdict.

## Problem Framing (Clarified)

The requirement presumes something that does not exist: a single repository-state version. Three readings are possible, and only one is both honest and additive.

1. **Create the missing aggregate.** Introduce a repository-state version, write it into the state root, and compare. This is a *second state contract* — exactly what the milestone forbids — and it would need its own migration, its own failure identity, and its own truthfulness story (who updates it, and what happens when a per-domain version moves without it).
2. **Compare the per-domain versions present on disk.** Read records and compare each discriminant. This is unbounded: a store can hold hundreds of thousands of records, the install surface would decode payloads it has no business reading, and the answer ("some record somewhere is v2") does not identify an incompatibility the binary can act on.
3. **Compare the one thing both sides already declare.** The binary knows which store format it accepts (its own constant). Each state root declares which format wrote it (its header). Comparing those two is a real compatibility statement, requires no new contract, and is bounded to one small file per root.

The remaining design questions are behavioural, not representational:

- **Direction.** `delivery.state.v1` is an opaque identifier, not a semver. Equality is the only honest comparison; "newer is probably fine" is an inference the contract does not license. So the check has two outcomes — *accepted* and *not accepted* — and it does not guess.
- **Blocking or advisory.** A pre-flight at install that *blocks* would prevent installing the artifact that fixes the mismatch: an operator with a v2 store and a v2 artifact could never get there. So the install path is advisory, and the report path carries the verdict. The hard gate remains the store's own refusal, which is delivered, typed, and already correct.
- **Scope.** A check that reads payloads is a second read path into state. The check reads only headers, only under bounded roots.

## Constraints (Hard Requirements)

### C-1: No second state contract

- **Statement:** The check introduces no version constant, no aggregate version, no manifest file, and no write into any state root; the only identifiers it compares are already declared and already written.
- **Source:** GH-346 ("no second state contract"); M4 EC-1; TDR-0004 (state engine) as the contract owner.
- **Verification:** Review and test — `packages/core/src/contracts/state.ts` and every per-domain contract are unchanged; the check performs zero writes.
- **Negotiable:** no.

### C-2: Read-only, bounded, header-only

- **Statement:** The check reads only `header.*.json` files under a bounded enumeration of roots; it never decodes ledger records, never scans recursively beyond one project level, and never repairs, rewrites, or migrates anything.
- **Source:** C-1; the store's own integrity has a dedicated salvage path that the check must not duplicate.
- **Verification:** Test — a planted record with a foreign version inside an accepted store is not read (file access asserted); the enumeration bound is asserted.
- **Negotiable:** no.

### C-3: Never blocks an install

- **Statement:** A mismatch or an unreadable header never prevents `install` or `install rollback` from completing; it is reported as an advisory line and recorded in the status the operator can query.
- **Source:** The remedy for a mismatch is a different artifact; blocking the install would remove the only fix.
- **Verification:** Test — a mismatched store installs successfully with exactly one advisory line and no exit-code change.
- **Negotiable:** no.

### C-4: The verdict is observable and typed

- **Statement:** `install status` reports a compatibility verdict per root and, when any root is not accepted, exits `1` with a registered identity naming the root, the observed version, and the accepted version.
- **Source:** `packages/cli/src/projection.ts`; the report surface in TDR-0036 §1.
- **Verification:** Test — verdict fields and exit `1` for the incompatible case; exit `0` for accepted and unchecked cases, with the state visible in the payload.
- **Negotiable:** no.

### C-5: No new read on self-description or ordinary command paths

- **Statement:** `--version`, `--help`, and `--print-install-path` remain read-free; no delivered command gains a state read because of this check.
- **Source:** GH-320 NFR-2; `feature-cli-entrypoint.md` §Runtime neutrality.
- **Verification:** Test — the delivered isolation suite unchanged; a per-command read assertion for one ordinary command.
- **Negotiable:** no.

### C-6: Additive record fields only

- **Statement:** The only persistence added is one field in the install record (the accepted state format version at install time) and the status payload; no state record kind, no configuration key, no environment variable.
- **Source:** GH-346 constraints; TDR-0035 C-2 precedent.
- **Verification:** Review — config catalog unchanged; state record inventory unchanged; `install.status` schema carries the field.
- **Negotiable:** no.

### C-7: The delivered enforcement point is preserved

- **Statement:** `state.schema.mismatch` keeps its identity, its projection class, and its "use a compatible tool version or migrate the store explicitly" remedy; the new check does not shadow, pre-empt, or re-word it.
- **Source:** `packages/core/src/contracts/error-table.ts`; `packages/core/src/state/index.ts`.
- **Verification:** Test — the delivered state-schema suite unchanged.
- **Negotiable:** no.

## Decision Drivers

1. **Truthful compatibility statement.** The check must answer a question the binary can act on, not accumulate evidence.
2. **Additivity.** The milestone's single hardest constraint is that the state contract does not fork.
3. **Availability of the fix.** The check must never stand between an operator and a compatible artifact.
4. **Bounded cost.** A status read should be cheap and predictable on a machine with many projects.
5. **Diagnosability.** The verdict must name the root, the observed version, the accepted version, and the remedy.
6. **Reversibility.** Removing the check must not leave a persisted contract behind.

*(Overlap check: no-second-contract, header-only, non-blocking, and preserve-the-delivered-gate are gates C-1…C-3 and C-7; they appear here only as ranking values — "how much compatibility signal per unit of new contract". The gates decide eligibility; the drivers rank the survivors.)*

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-346: the specification is blocked on what is compared).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at the GH-346 PR review. AI does not accept this R2 record.
- **Contributors:** `@pm` (M4-S1 scope line); `@decision-advisor` (analysis and record); `@spec-writer` (carries the comparison, roots, outcomes, and exit projection into the change spec).
- **Required reviewers:** `@readiness-reviewer`, `@reviewer`; the owner for acceptance.
- **Performers:** `@coder` (header read, verdict, install record field, `install status`, tests); `@doc-syncer` (state-layer page, entrypoint page, local-install guide).
- **Informed:** M4-S2 (state-root moves), any future state-format change.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|---|---|---|---|---|
| One store-format identifier exists and is written into a per-store header. | FACT | `packages/core/src/contracts/state.ts`, `packages/core/src/state/index.ts`, read 2026-11-18 | The comparison would have no delivered anchor and ALT-1 would be forced. | High |
| The store already refuses on mismatch with a typed identity. | FACT | `packages/core/src/state/index.ts`, `error-table.ts` (`state.schema.mismatch`), read 2026-11-18 | The new check would have to carry enforcement, contradicting C-3. | High |
| Every other version is per-domain, enforced at its own boundary. | FACT | grep over `packages/core/src/contracts/*.ts`, read 2026-11-18 | An aggregate would already exist. | High |
| There is no aggregate repository-state version or state manifest. | FACT | Repository survey, read 2026-11-18 | ALT-1 would be a preservation rather than a new contract. | High |
| State roots are enumerated through a host root with `projects/<key>` children. | FACT | TDR-0022, `doc/spec/features/feature-projects.md`, `packages/core/src/state/*`, read 2026-11-18 | The enumeration in §3 would target the wrong layout. | High |
| A header is the only file the store writes with the format identifier. | FACT | `packages/core/src/state/index.ts` (`headerPath`, `writeFile` at creation), read 2026-11-18 | The check might need to read the ledger, which C-2 forbids. | High |
| M4 forbids a second state contract. | FACT | M4 README, GH-346 constraints, read 2026-11-18 | ALT-1 would be admissible and simpler. | High |
| Every per-domain version bump is additive and backward-compatible with an older reader. | ASSUMPTION (declared discipline, not provable by the check) | Additive-contract precedent (ADR-0004, TDR-0008) | A per-domain break would not be caught by the header check; the per-domain read boundary remains the only detector, which is why C-2 keeps the check header-only and the store refusal stays authoritative. | Medium |
| A machine holds few enough state roots that a one-level enumeration is cheap. | ASSUMPTION (bounded by §2) | TDR-0022 layout | A machine with thousands of projects would need a cap; §2 declares one. | Medium-High |

## Mental Models & Techniques Used

- **First principles:** What can two independently built things compare without a shared schema? Only a value they both already declare. The binary declares its accepted format; the store declares its writer's format. Everything else would have to be invented.
- **Inversion:** How does this fail? A new version constant nobody updates; a check that scans a million records at `install status`; a pre-flight that blocks the upgrade which fixes the mismatch; a check that makes `--version` read state; a check that reports "compatible" by comparing nothing. C-1…C-7 and §4 exclude each.
- **Second-order thinking:** Making the header the compatibility surface means a future format change has exactly one place to bump and one place to report — the cheapest possible future for a contract this milestone is forbidden to duplicate.
- **Systems thinking:** Three actors care: the operator (needs a verdict), the install surface (needs a non-blocking advisory), and the store (needs to keep its own hard gate). The design separates them on purpose.
- **Least privilege:** read-only, header-only, one level deep, no payload decode.
- **Reversibility:** the verdict is computed, never stored, so removing the check leaves no trace except the install record field, which remains true as a statement about the artifact.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 no 2nd contract | C-2 header-only | C-3 non-blocking | C-4 typed verdict | C-5 no new reads | C-6 additive | C-7 gate preserved |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 no check | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| ALT-1 new aggregate repository-state version | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| ALT-2 scan per-domain record versions | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-3 compare install record vs running identity only | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ |
| ALT-4 compare accepted store format vs each root's header (chosen) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-5 refuse at install on mismatch | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |

Legend: ✅ passes · ❌ fails · ⚠️ passes only as a narrower promise (ALT-3 says nothing about state).

### Alternative 0 — No Check (Status Quo)

- **Eligibility:** Not eligible (fails C-4).
- **Summary:** Rely entirely on `state.schema.mismatch` at first store open.
- **Constraint compliance:** Passes everything except the requirement itself: nothing reports compatibility before a command fails, and M4-S1's scope line has no deliverable.
- **Driver fit:** Good on 2 and 6; fails 1 and 5.
- **Pros:** Zero surface.
- **Cons:** The operator discovers incompatibility at the worst moment (mid-delivery), with no root-level report.
- **Why rejected:** It declines the assigned scope while the delivered gate stays in place anyway.

### Alternative 1 — Introduce an Aggregate Repository-State Version

- **Eligibility:** Not eligible (fails C-1, C-6).
- **Summary:** Add a store-manifest version, write it into the host root, and compare it.
- **Constraint compliance:** A new constant, a new written artifact, a new migration question ("what bumps it?"), and a second contract that can disagree with the per-domain ones. Fails the milestone's explicit prohibition.
- **Driver fit:** Good on 1 and 5; worst on 2.
- **Pros:** A single number an operator can reason about.
- **Cons:** Two contracts, two truths, a new migration, and a version nobody can maintain correctly by hand.
- **Why rejected:** It is the one thing the milestone forbids.

### Alternative 2 — Scan Per-Domain Record Versions

- **Eligibility:** Not eligible (fails C-2).
- **Summary:** Read records, collect discriminants, compare each to the accepted set.
- **Constraint compliance:** Unbounded work, payload decoding from the install surface, and a second read path into state with its own failure modes (torn tails, quarantine, sequence gaps) that it is not qualified to interpret.
- **Driver fit:** Best on 1; fails 4 badly.
- **Pros:** The most precise answer in principle.
- **Cons:** Cost, coupling, and duplicated integrity logic.
- **Why rejected:** Precision it cannot afford and does not need.

### Alternative 3 — Compare Only the Install Record Against the Running Identity

- **Eligibility:** Eligible, but it is a different check.
- **Summary:** Report whether the running artifact matches what was installed.
- **Constraint compliance:** Passes C-1…C-3 and C-5…C-7, but its verdict is about installation drift, not state compatibility — so it does not satisfy C-4's requirement to name state incompatibility.
- **Driver fit:** Excellent on 2; silent on 1.
- **Pros:** Free once the install record exists.
- **Cons:** Answers a different question; shipping it as "the compatibility check" would be a mislabel.
- **Why rejected as the check, adopted as a component:** the install-vs-running comparison is part of `install status` (TDR-0037 §4) but is not this check.

### Alternative 4 — Compare the Accepted Store Format Against Each Root's Header (chosen)

- **Eligibility:** Eligible.
- **Summary:** Read the accepted identifier from the artifact's own constant; compare it with each enumerated root's header; report per root; advisory at install, verdict at status.
- **Constraint compliance:** C-1 (both identifiers delivered); C-2 (headers only, one level, capped); C-3 (advisory on the write paths); C-4 (typed verdict at exit `1`); C-5 (status command is not a self-description path); C-6 (one record field plus the payload); C-7 (the store gate untouched).
- **Driver fit:** Best on 1, 2, 3, 5, 6; good on 4 (capped enumeration).
- **Pros:** No new contract; reuses the only truthful on-disk statement; bounded and read-only.
- **Cons:** It can only be as granular as the store format itself, and it deliberately cannot detect a per-domain break (declared in the evidence table and in §5).

### Alternative 5 — Refuse at Install on Mismatch

- **Eligibility:** Not eligible (fails C-3).
- **Summary:** Block the replace when a root's header is not accepted.
- **Constraint compliance:** Blocks the artifact that would fix the mismatch, and forces an out-of-band recovery path the product does not have.
- **Driver fit:** Good on 1; worst on 3.
- **Pros:** Prevents installing a binary that cannot read the state.
- **Cons:** Creates an unrecoverable loop for the operator who has the correct artifact in hand.
- **Why rejected:** The check must never be the reason an operator cannot install the fix.

## Decision

- **Decision:** Adopt ALT-4. The compatibility check compares the artifact's accepted **state-store format identifier** with the **ledger header** of each enumerated state root — nothing more — and it is advisory on the write paths and a typed verdict on the report path.

### 1. What is compared

| Side | Value | Source |
|---|---|---|
| Artifact | the accepted store-format identifier | the artifact's own `STATE_SCHEMA_VERSION` (delivered constant, no new constant) |
| State root | the identifier that wrote the store | `${root}/header.<workspace>.json` → `schemaVersion` (delivered file, delivered field) |

- **Comparison is equality, not ordering.** The identifier is opaque; the check does not infer that a different version is newer, older, or compatible. Two outcomes: `accepted` or `not-accepted`.
- **Each root is judged independently.** A machine with one compatible project and one incompatible project reports both, not a single verdict.

### 2. What is enumerated

- The **effective host root** (the override when set, otherwise the brand default) contributes its own `header.*.json` files when present.
- Each **first-level `projects/<key>`** directory under the host root contributes its own `header.*.json` files.
- No other directory is visited: no recursion below a project directory, no manifest discovery, no walk of the repository.
- A **cap** bounds the enumeration; exceeding it marks the verdict `truncated` and reports how many roots were judged, so a pathological machine degrades visibly rather than slowly.
- An absent root is `unchecked`, never `accepted` — no store means nothing was compared, and the payload says so.

### 3. Where and when it runs

| Surface | Timing | Behaviour |
|---|---|---|
| `install` | pre-flight, before staging | one advisory line per incompatible root; never changes the exit code and never blocks |
| `install rollback` | before the swap | same advisory |
| `install status` | on demand | per-root verdict; `not-accepted` ⇒ typed refusal, exit `1` |
| `--version`, `--help`, `--print-install-path` | — | **not run**: these paths stay read-free |
| every other command | — | **not run**: no delivered command gains a state read |

### 4. Behaviour on mismatch

- **Install path — advisory, not a gate.** Rationale: the remedy for a mismatch *is* a different artifact, so the install surface must remain able to install it. The advisory names the root, the observed version, the accepted version, and the remedy.
- **Report path — verdict with a typed identity.** `install.state.incompatible`: category `user`, `retryable: false`, `consequence: not_landed`, `projectionClass: user-validation` → exit `1`. Detail carries root, observed, accepted, and the judged-root count.
- **The hard gate stays where it is.** `state.schema.mismatch` at first store open keeps its identity, its `platform-provider` projection (exit `2`), and its remedy. The new check never pre-empts it, never re-words it, and never fires in its place.

### 5. Where the result is recorded

- **Nowhere in state.** No header is written, no marker is dropped, no manifest is created (C-1).
- **One install-record field:** the accepted store-format identifier recorded at install time, so `install status` can state what the *installed* artifact claims even when the running artifact is different.
- **The verdict itself is computed and reported, never persisted** — it must remain true when the state changes underneath, and a cached verdict is the classic way to be wrong.

### 6. Explicit non-decisions

- **Per-domain versions are not compared.** Their enforcement stays at their own read and write boundaries. A per-domain break is invisible to this check by design (declared in the evidence table); widening that is a revisit trigger, not a silent extension.
- **No migration, no repair, no salvage.** The check reports; the store's salvage path and M4-S2's migration own the repair.
- **No negotiation and no downgrade path.** An artifact either accepts the format or does not.
- **No secret or credential is read.** The check touches headers only.

### Constraint Compliance Attestation

The chosen alternative (ALT-4) satisfies every constraint C-1 through C-7. No accepted-risk exceptions are taken. One limitation is declared rather than glossed: this check detects a **store-format** change and cannot detect a per-domain break, whose only detector remains that domain's own read boundary; widening that is a revisit trigger. The advisory/verdict asymmetry is a deliberate design consequence of C-3, not an inconsistency.

**Reversal.** Deleting the predicate's call sites leaves the delivered `state.schema.mismatch` gate as the sole enforcement point, exactly as today; the install-record field remains a true statement about the artifact and is read as `unchecked` when absent, so an older record never blocks newer tooling.

## Trade-offs & Consequences

### Positive Outcomes

- A real compatibility statement with zero new contract, in both directions of information (what the artifact accepts, what the state holds).
- The operator learns about incompatibility before the first delivery command fails, and the installer can still install the artifact that fixes it.
- The report is per root, so a machine with several projects is diagnosable instead of "something is wrong somewhere".
- A future state-format change acquires exactly one compatibility surface and one place to bump.
- The delivered `state.schema.mismatch` gate is untouched, so the hard enforcement story does not change.

### Negative Outcomes

- **The check cannot see a per-domain break.** Declared, documented, and bounded by the revisit trigger; the per-domain boundary remains the detector.
- **`not-accepted` on the report path and advisory on the write path is an asymmetry.** It is intentional (C-3) but will look inconsistent unless the guide states why: an action must be able to install the fix; a report must be able to say "no".
- **One more error identity and one more install-record field.** Small, but both are contract surfaces that must be documented or `error-table-sync` and the status schema checks fail.
- **A machine with many projects pays a bounded enumeration cost** on `install status`; the cap makes the degradation visible rather than fast.
- **`unchecked` is a permanent third state.** It is the honest answer for "no store yet", and the payload must never collapse it into `accepted`.

### Unresolved Questions

- [ ] The exact cap value for §2 and whether it should be a declared constant in the install surface or a status input. Owner: `@spec-writer`; the record fixes the requirement (bounded, reported when truncated), not the number.
- [ ] Whether `install status` should also name the *per-domain* versions it accepts, as information (not as a verdict). Owner: `@spec-writer`; adding it must not turn the report into the payload scan C-2 forbids.
- [ ] Whether the advisory at install time should be suppressible. Owner: `@spec-writer`; a suppressed advisory would weaken C-3's transparency, so the default must be "always printed once per root".

## Implementation Plan

1. **Header read.** A bounded, read-only enumeration of `header.*.json` under the effective host root and its first-level project directories; parse only `schemaVersion`; every other outcome maps to `unchecked`/`unreadable` with its own named reason.
2. **Predicate.** A runtime-neutral comparison producing per-root `accepted | not-accepted | unreadable | unchecked` plus the truncated flag.
3. **Wiring.** `install` and `install rollback` call the predicate once and print one advisory line per `not-accepted` root; `install status` includes the verdict in its payload and projects the exit code.
4. **Identity.** Register `install.state.incompatible`; document the row; assert the identity and exit in tests.
5. **Record field.** Persist the accepted identifier in the install record; assert it is written and reported.
6. **Tests.** Accepted, not-accepted, unreadable header, absent root, truncated enumeration, two roots disagreeing, install proceeds under mismatch with exactly one advisory and unchanged exit, status exits `1` under mismatch and `0` for accepted/unchecked, and no payload is decoded.
7. **Docs.** State-layer page (the header is the compatibility surface), entrypoint page (`install status` verdict), local-install guide (the asymmetry and the remedy), install-model correction.

## Verification Criteria

- Metric: comparison — the check reads the artifact's accepted identifier and each enumerated root's header, and nothing else. Target: exact (file-access assertion). Window: GH-346 CI.
- Metric: outcomes — `accepted`, `not-accepted`, `unreadable`, `unchecked`, and `truncated` are each produced by a fixture and reported with the root named. Target: 5/5. Window: GH-346 CI.
- Metric: non-blocking install — an incompatible store installs successfully with exactly one advisory per root and no exit-code change. Target: exact. Window: GH-346 CI.
- Metric: verdict — `install status` exits `1` with `install.state.incompatible` for a not-accepted root, and `0` with the state visible for accepted and unchecked. Target: 3/3. Window: GH-346 CI.
- Metric: no new reads — the delivered self-description isolation suite is unchanged and one ordinary command's read set is unchanged. Target: exact. Window: GH-346 CI.
- Metric: additivity — no new state constant, no new state record kind, no configuration key; the install record gains one field. Target: exact. Window: `pnpm check` on GH-346.

## Confidence Rating

**High** for the representation: the store-format identifier and its header are delivered, verified in source, and already enforced. **High** for the non-blocking rule: the remedy for a mismatch is a different artifact, so a blocking pre-flight would be self-defeating. **High** for the enumeration layout: the host-root/`projects` structure is documented and implemented. **Medium** for the sufficiency of a header-only check: it is sufficient for a store-format change and deliberately insufficient for a per-domain break — declared, bounded, and recorded as a revisit trigger rather than presented as complete coverage.

## References

- GH-346 ticket body and M4 scope line — `gh issue view 346 -R juliusz-cwiakalski/agentic-delivery-os`; `doc/planning/oss-tooling/milestones/m4/backlog.md` (M4-S1)
- Store-format identifier and header — `packages/core/src/contracts/state.ts`, `packages/core/src/state/index.ts` (`headerPath`, header write, `readHeader`, `state.schema.mismatch`)
- Delivered refusal identity and projection — `packages/core/src/contracts/error-table.ts` (`state.schema.mismatch`), `packages/cli/src/projection.ts`, `.ai/rules/typescript.md` §7
- Per-domain version survey — `packages/core/src/contracts/*.ts`
- State-root layout and host-root policy — [TDR-0022](TDR-0022-multi-repository-workstation-state-scope.md), `doc/spec/features/feature-projects.md`, `doc/spec/features/feature-state-layer.md`
- State engine contract — [TDR-0004](TDR-0004-state-storage-engine.md)
- Self-description isolation — `doc/spec/features/feature-cli-entrypoint.md` §Runtime neutrality; `doc/changes/2026-11/2026-11-15--GH-320--jaiship-binary/chg-GH-320-spec.md` §9 (NFR-2)
- [TDR-0036](TDR-0036-install-lifecycle-composed-command-family.md) — the surface that reports the verdict
- [TDR-0037](TDR-0037-self-contained-binary-build-identity.md) — the identity fields the status payload carries alongside the verdict
