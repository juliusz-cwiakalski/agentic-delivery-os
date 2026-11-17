---
id: chg-GH-293-test-plan
status: Updated
version: 1.3
created: 2026-11-17
last_updated: 2026-11-18
owners: [engineering]
service: delivery-os
labels: [engine-first, handover-gate, repos, dispatch, dual-run, shell-fallback, merge, classification, documentation, m2]
version_impact: minor
summary: "Pin engine-first delivery operations as comparisons a test runs: clean accrual is the corroborated number, never a dispatch count (data.cleanDispatches === data.corroboration.satisfied, with data.consecutiveCleanDispatches the trailing run over counted attempts in append order — a non-clean counted attempt resets it to 0, and an empty window yields 0/0); the four handover conditions are one shape in one declared order (truth, coverage, floor, corroboration) read by three surfaces, present on every outcome that performs the gate evidence read, with the open set identical to unmetConditions in order and window-level unverifiability carried only by verdict plus the truncation object (verdict == unverifiable ⟺ truncation present, never a third status), while the idempotent revert noop on an already-dual-run repository is the single declared exemption — answered before the gate evidence read, exit 0, recorded false, noop true, operation dual-run, reversible false, and no conditions, no verdict, no truncation, so 0 of them are refused by an unreadable or torn attempts or divergences ledger but 100% of them are still refused dispatch.state-unverified at exit 2 with no data when the handover ledger is unreadable or torn, because the folded-handover read that establishes the noop still happens, whereas the recorded revert under that same attempts/divergences ledger refuses dispatch.state-unverified at exit 2 with no record and the prior flip intact; reversibility is the folded authority after the operation (true after a recorded flip and an idempotent flip noop, false after a revert, a clean refusal, and the revert noop) with the reversal record shape unchanged, replay idempotent, and per-repository isolation; the fleet read hosts the evaluation at read time, bound to each row's own normalized host/owner/name repository identity resolved read-only and non-persisting from that checkout's persisted binding or its normalized configured remote (no extra store open, no binding write, foreign-repository records excluded, an unresolvable identity failing repos.state-unavailable at exit 2 with no row), with the declared degraded-evidence behaviour (unreadable or torn ledger ⇒ repos.state-unavailable exit 2 and no row; truncated read ⇒ verdict unverifiable plus truncation; first-use ⇒ the empty-window evaluation with no store opened; two reads over unchanged state byte-identical) while projects list --flat stays byte-identical and carries neither new field; the shell stack does not move (no pointer in dual-run, exit 0 plus a bounded stderr pointer when authoritative, five summary keys in the pinned order, no new stdout line, fallback alive with the typed CLI absent) and no repository is flipped; provider windows and holds stay documented effect surfaces with no new read and no QueueLane.providerProfile (asserted absent), the over-claiming peak-pausing sentence corrected and the lanes-read blindness declared; and the production merge composition performs real tracker/CI/request-detail reads over injected transports, resolves branch and base reference from git facts, configuration from the three declared merge keys, and the owner principal as the provider-resolved repository owner (the owner component of the checkout's normalized host/owner/name identity, with no new configuration key), publishes MERGE_COMPOSITION_EMITTABLE_CODES as its exported emittable-code set (non-empty, duplicate-free, covering config/provider/state/merge so the conformance test cannot pass vacuously), classifies every emitted (kind, code) by its resolved error-table row (config.credential.missing emits config, never fallback.internal), adds no identity/row/kind/exit, keeps verify deploy a declared residual, and hands the two broader test specs to phase 7 for reconciliation rather than claiming them aligned during test planning; the v1.2 amendment states the one observable that moves — a missing credential is the declared config.credential.missing refusal at exit 1 (kind config, projection user-validation), never the contained fallback.internal at exit 2, which is the repaired defect's signature and which no case may assert — binds the fleet row's fold to the declared production evidence scope (counting pilot attempts, the same scope the summary and the handover decision use, with controlled/controlled-proof never a row's scope and no scope key or flag added), requires the bounded lifecycle-prose reconciliation of AGENTS.md and doc/guides/change-lifecycle.md (engine as the regular path, the shell entry points as the documented still-executable fallback, zero occurrences of the 'retained primary entry points' claim, no flip claim), and traces every spec §17.1 Definition-of-Done item to the cases that prove it; the v1.3 revision mirrors spec v1.3 by scoping the noop exemption to the attempts/divergences evidence read alone and pinning the handover-ledger cell (TC-ENGINE-017: the same noop over an unreadable or torn handover ledger is refused dispatch.state-unverified at its declared exit 2 with no data and no record appended, even though the attempts/divergences ledger is readable)."
links:
  change_spec: ./chg-GH-293-spec.md
  implementation_plan: ./chg-GH-293-plan.yaml
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M2-S16: Engine-first delivery operations

## 1. Scope and Objectives

This change projects facts that are already computed, so the risk is not a missing feature — it is a projection that **disagrees with its own source**, a degraded read that **fabricates a value**, or a composition fix that **hides a failure behind a different identity**. Each claim is therefore proven as a comparison between two surfaces over the same fixture, never as a prose restatement: accrual is checked against `corroboration.satisfied` (`TC-ENGINE-001`..`002`), the condition array against `unmetConditions` on six fixture families (`TC-ENGINE-004`), the fleet row against the summary for the same ledger (`TC-ENGINE-021`), and the three surfaces against each other in one matrix (`TC-ENGINE-095`).

**First, accrual is honest.** `cleanDispatches` is not merely present; it is *declared identical* to `corroboration.satisfied`, so the case asserts equality on every fixture family and additionally asserts that a dispatch-count interpretation would fail (`TC-ENGINE-001`). The streak is the **trailing** run, not the longest run: a clean-clean-non-clean-clean-ledger reads 1, a ledger ending on a non-clean counted attempt reads 0, and an empty window reads 0/0 (`TC-ENGINE-001`, `TC-ENGINE-003`). The restated `SC-M2-S16-02` is delivered as an accrual walk — `countedDeliveries` +1 per counted dispatch, `cleanDispatches` +1 per corroborated one, `coverage.present` gaining a token only on first appearance — and the case asserts the *absence* of a numeric coverage counter (`TC-ENGINE-002`).

**Second, one shape, one order, three readers, one declared exemption.** `conditions` is four `{condition, status}` entries in the declared `truth, coverage, floor, corroboration` order with **no** `detail`, present on every outcome that performs the gate evidence read — recorded flip, idempotent flip noop, clean refusal, recorded revert — and the open set equals `unmetConditions.map(c => c.condition)` in order; `unverifiable` stays a window-level verdict expressed by `verdict` plus `truncation` (`TC-ENGINE-003`, `TC-ENGINE-004`, `TC-ENGINE-014`). The single exemption is the idempotent revert noop on an already-`dual-run` repository (or one with no handover record): it is answered **before** the gate evidence read (the folded-handover read that establishes the noop still happens), so `TC-ENGINE-010` asserts the absence as a declared value (`conditions`, `verdict`, and `truncation` all absent; `recorded: false`, `noop: true`, `operation: "dual-run"`, `reversible: false`) *and* asserts presence on the four evidence-reading outcomes, and the same case answers the noop under a torn attempts or divergences ledger at exit `0`. `TC-ENGINE-017` proves the other half of the read order: over an unreadable or torn **handover** ledger — with the attempts and divergences ledgers readable — the same noop is refused `dispatch.state-unverified` at its declared exit `2` with no `data` and no record appended, so the exemption is never a route past a corrupt handover history. The invariant is asserted as a biconditional so neither half can drift: a data-returning surface with `verdict == "unverifiable"` and no `truncation` fails, and a `truncation` without that verdict fails. `TC-ENGINE-095` makes disagreement between summary, handover, and the fleet row a failing test rather than a review question.

**Third, degraded evidence stays truthful, the fleet read stays read-only, and each row is bound to its own repository.** An unreadable or torn attempts/divergences ledger fails the *whole* fleet read as `repos.state-unavailable` at exit `2` with no fabricated row, and the case proves the no-row half by asserting `data` is absent rather than empty (`TC-ENGINE-023`); the same case asserts the unresolvable-identity failure, because a row that cannot resolve its own `host/owner/name` identity must fail under the same delivered identity rather than fold some other repository's evidence. A truncated read is not a failure: the row reports `verdict: "unverifiable"` with the `truncation` object over the visible window (`TC-ENGINE-024`). A `first-use` row reports the empty-window evaluation and **no store is opened**, proven by a host-root snapshot that must be identical before and after (`TC-ENGINE-020`, AMB-ENG-1). Because the row key is a minted project key and not a repository identity, `TC-ENGINE-021` seeds two foreign-repository records into the same store and asserts they are excluded from the row's `countedDeliveries`, `conditions`, and `cleanDispatches`, while `TC-ENGINE-093` pins the byte identity of two reads and `TC-ENGINE-094` pins that resolution costs no extra store open or binding write. The row's fold uses the declared `production` evidence scope — the one scope that counts `pilot` attempts, the same scope the summary and the handover decision use — which is what makes the row/summary equality a contract rather than a coincidence (`TC-ENGINE-020`, `TC-ENGINE-021`, DEC-17, TDR-0031 D11); a `controlled-proof` seed must change neither side, and no scope key or flag exists to change it (`TC-ENGINE-022`, `TC-ENGINE-093`). The flat alias is the counter-witness: a torn attempts ledger that fails the fleet read must leave `projects list --flat` at exit `0` with its rows unchanged (`TC-ENGINE-023`), which is what proves the evaluation is hosted on the `repos` row *only*.

**Fourth, the shell does not move, the lifecycle prose stops contradicting it, and nothing is flipped.** The four entry points are exercised in both authority states and their `--help` stdout must be **byte-identical** between the states, with the deprecation pointer appearing only on stderr and only when authoritative (`TC-ENGINE-034`); the delivered pinned suites run unmodified (`TC-ENGINE-030`..`033`). The two lifecycle documents that still called the shell entry points "retained primary entry points" are reconciled by bounded edits, and the case asserts the corrected claim *and* the absence of the old one in both (`TC-ENGINE-065`). No-flip is proven structurally — the only writers of `dispatch.handover` records are the handover and revert use cases, and the summary and fleet reads append zero records (`TC-ENGINE-035`) — with the "zero records attributable to this change" outcome recorded as a review audit (AMB-ENG-3), because a permanent suite cannot assert a fact about an operator's untracked state root.

**Fifth, the merge composition is restored without widening the vocabulary, and the credential-read exit is the declared one.** Over a real temp git checkout and an injected recording transport, `merge <ref> --dry-run` produces the delivered dry-run report or a classified gate refusal and never `fallback.internal` (`TC-ENGINE-050`, `TC-ENGINE-051`); the defect itself — `config.credential.missing` hard-coded as `provider` and then contained — is pinned by a regression that asserts `kind: "config"` at **exit `1`**, the exit its declared projection class `user-validation` already maps to, with zero records and zero transport calls (`TC-ENGINE-052`). Exit `2` on that path is the signature of the repaired defect (`fallback.internal`, `platform-provider`), so the case asserts it *absent*: no case in this plan asserts exit `2` for a missing credential (§3.5, R-TP-11). The owner principal is now a named source, not a choice: `TC-ENGINE-050` asserts the effect that defines it (a waiver authored by the provider-resolved repository owner is authorized and records nothing on a dry run; the same waiver from any other principal refuses `merge.waiver-unauthorized` at exit `1`) and asserts that the typed `merge` configuration branch still has exactly its three declared keys, so a second authority for the principal cannot appear (DEC-13, TDR-0031 D8). `TC-ENGINE-054` makes totality a property of the composition's exported `MERGE_COMPOSITION_EMITTABLE_CODES` — non-empty, duplicate-free, spanning `config.*`, `provider.*`, `state.*`, and `merge.*`, every member resolving to a declared row whose `domainKind` equals the kind the composition emits — with an anti-vacuity guard and a live mismatch control so an empty or hand-picked enumeration cannot pass (DEC-14, TDR-0031 D9).

This document is a verification map, not an execution claim: no command was run against a new implementation at authoring time, and phase ownership is declared in `chg-GH-293-plan.yaml` (authored in phase 4, delivery_planning), not asserted here. Spec v1.3 declares the seams test planning could not previously assert — the handover exemption (DEC-12, TDR-0031 D2's five-outcome table), the owner-principal source (DEC-13, D8), the emittable-code constant (DEC-14, D9), the row's repository binding (DEC-15, D10), the row's `production` evidence scope (DEC-17, D11) — plus the phase-7 test-spec reconciliation (DEC-16), the declared credential-read exit projection (exit `1` toward `config.credential.missing`, exit `2` only as the repaired defect's signature), the bounded lifecycle-prose reconciliation (AC-F4-8, AC-F8-12), and (v1.3) the scoping of the noop exemption to the attempts/divergences evidence read with the handover-ledger refusal stated beside it (NFR-11, AC-F2-3, Appendix E.1); §3.6 traces every spec §17.1 Definition-of-Done item to the cases that prove it. Each case now targets a named declaration rather than a mechanism left to delivery. What remains delivery-bound is naming only: module paths, suite file names, the guide's filename, and the composition's wiring. A case that cannot resolve its seam fails naming the missing contract rather than skipping. All 14 acceptance criteria are covered; there are no TODO rows and no orphan cases. Seven properties are observed through a named substitute assertion (§3.5) because one half of the wording is a wall-clock/read-count bound, an "opened a store" absence with no counter seam, or an audit over untracked operator state; each substitution is recorded, not smoothed over.

### 1.1 In Scope

- `dispatch dual-run summary`: additive `cleanDispatches` (identity with `corroboration.satisfied`), `consecutiveCleanDispatches` (trailing run, `0` when none or empty), and `conditions[]` (four, declared order, `met | open`, no `detail`) appended after `floor`; the three additive text lines placed after `unmet_conditions=` and before the optional truncation line; `truncation` last (F-1; AC-F1-1, AC-F1-2; DM-1, DM-3; DEC-2, DEC-3).
- `dispatch handover`: `conditions[]` present on every outcome that performs the gate evidence read (recorded flip, idempotent flip noop, clean refusal, recorded revert), `reversible` from the folded authority after the operation, `verdict` populated on the recorded-revert outcome so the truncation invariant is expressible there, the idempotent revert noop declared gate-evidence-read-free and exempt from `conditions`/`verdict`/`truncation` (exit `0`, `reversible: false`; 0 refused by an unreadable or torn attempts or divergences ledger, while an unreadable or torn handover ledger still refuses `dispatch.state-unverified` at exit `2` with no data), `unmetConditions` refusal-only and unchanged, `truncation` iff `verdict == "unverifiable"`, records unchanged, replay idempotent, per-repository isolation (F-2; AC-F2-3, AC-F2-4; DM-2, DM-3; NFR-4, NFR-11; DEC-2, DEC-4, DEC-12; TDR-0031 D2/D4).
- `repos list`: read-time gate evaluation per `ready` row bound to that row's own normalized `host/owner/name` identity — resolved read-only and non-persisting from the checkout's persisted binding or its normalized configured remote, at no additional store open and with no binding write — foreign-repository records excluded, the fold taken at the declared `production` evidence scope (counting `pilot` attempts, the same scope `dispatch dual-run summary --repo` uses; `controlled`/`controlled-proof` never the row's scope; no scope key or flag), an unresolvable identity failing `repos.state-unavailable` at exit `2` with no row, the empty-window evaluation for `first-use` rows with no store opened, the declared degraded-evidence behaviour, row fields `reversible` then `handoverGate` after `handoverState`, `REPOS_ENTRY_FIELDS` extended in that order, unchanged text table, unchanged `projects.v1` / `projects list --flat` bytes (F-3; AC-F3-5, AC-F3-6; DM-4, DM-7; DEC-1, DEC-15, DEC-17; NFR-2, NFR-3, NFR-4, NFR-13; TDR-0031 D10, D11).
- Engine-first operation with the shell stack byte-stable and documented, and **no repository flipped**: `dual-run` no pointer, `authoritative` exit `0` plus the bounded stderr pointer naming `dispatch <ref>` and `dispatch handover <repo> --revert`, the five summary keys in the pinned order, no new stdout line, the fallback still deciding with the typed CLI absent, and the bounded lifecycle-prose reconciliation of `AGENTS.md` and `doc/guides/change-lifecycle.md` so neither still calls the shell entry points "retained primary entry points" (F-4; AC-F4-7, AC-F4-8; NFR-6, NFR-7, NFR-8; DEC-6, DEC-9, DEC-10).
- Windows and holds as documented effect surfaces only: the mapping stated explicitly, the over-claiming peak-pausing sentence corrected to the surfaces that do carry the nomination, the lanes-read profile blindness declared, and both `no new read` and `no QueueLane.providerProfile` asserted as absences (F-5; AC-F5-9; DEC-5; NG-3, NG-4).
- The production merge composition restored to real tracker/CI/request-detail reads and real configuration, branch, base-reference, and owner-principal resolution — the principal being the provider-resolved repository owner from the checkout's normalized identity, with no new configuration key and the three declared `merge` keys unchanged — with failure classification derived from the resolved error-table row, the exported `MERGE_COMPOSITION_EMITTABLE_CODES` conformance set, a regression through the production composition, and a conformance test over every emittable code; `verify deploy`'s stub asserted as a declared residual (F-6, F-7; AC-F6-10, AC-F7-11; DM-5, DM-6; DEC-7, DEC-8, DEC-13, DEC-14; NFR-5, NFR-12).
- Documentation and corpus deliverables as testable content: the redistribution-marked operator guide, the six reconciled feature pages, the phase-7 handoff of the two broader test specs (`test-spec-dispatch-engine.md`, `test-spec-merge-verify-deploy.md`) with no new test-spec entry, the bounded lifecycle-prose edits in `AGENTS.md` (root document, no `ados_distribution` marker) and `doc/guides/change-lifecycle.md` (existing `redistributable` marker kept) stating the engine as the regular path and the shell as the documented still-executable fallback with zero occurrences of the "retained primary entry points" claim, the planning-corpus updates including both restatements, the restatement traceability to story AC1/AC4, and the TDR-0031 landing with its index row (F-4, F-8; AC-F4-8, AC-F8-12, AC-F8-13; NFR-8; DEC-10, DEC-11, DEC-16).
- Cross-cutting: additive stability of every touched payload, no new command/verb/flag/error row/`DOMAIN_KINDS` member/exit class, hermeticity (zero live network, credential, model, or sleep), determinism of two fleet reads, bounded fleet evaluation, and fixture-level no-flip discipline (AC-NFR1-14; NFR-1..NFR-13; DEC-9).

### 1.2 Out of Scope & Known Gaps

- [OUT] Flipping this repository or any repository; inserting handover/reversal records as fixtures-of-convenience in the live state root; fabricating pilot evidence (NG-1, §7.2). The flip and revert cases run over a controlled composition in a temp state root (`TC-ENGINE-011`..`013`).
- [OUT] A new `dispatch gate` verb, a daemon tick, a scheduler, a cache, or sampling for gate evaluation: `TC-ENGINE-091` asserts the command/verb/help inventory is unchanged, and `TC-ENGINE-094` asserts the row re-evaluates on every read (no cached value survives a ledger append).
- [OUT] Any declared/current peak-window read or hold read; `TC-ENGINE-042` asserts the absence (no new verb, no `QueueLane.providerProfile`, lanes read unchanged).
- [OUT] A three-valued condition status, a numeric coverage counter, or a new condition vocabulary; `TC-ENGINE-003`/`004` assert the closed pair and the absence of `detail`/counter keys, and the closed-vocabulary drift is caught by the delivered error/taxonomy suites as controls.
- [OUT] Any shell contract growth: no sixth summary key, no new stdout line, no machine mode, no changed exit. `TC-ENGINE-034` is the parity case; any growth fails it.
- [OUT] Changes to `projects.v1` rows or the flat-alias bytes: `TC-ENGINE-022` pins the committed golden and the absence of both new fields on the alias.
- [OUT] M1-S9 gate semantics (TDR-0015), evidence-class counting, the incident-exclusive window, the floor rule, and the corroboration matrix: consumed unchanged as fixture truth; no case re-derives them (`TC-ENGINE-004` compares against the delivered `unmetConditions`).
- [OUT] Peak-pausing behaviour (GH-294): lanes parks, resume, zero-spend evidence, and taxonomy v2 are read only as *documented surfaces* in `TC-ENGINE-040`..`042`; no case drives a park or a resume.
- [OUT] The `verify deploy` production-composition fix (RSK-8, NG-8): `TC-ENGINE-055` asserts the delivered stub is still a *declared* residual and that the pages say so — it never asserts deploy confidence.
- [OUT] Migration, backfill, or seeding of attempt/divergence/handover/reversal records (§19): `TC-ENGINE-012` asserts the pre-existing records still parse and no extra record appears.
- [OUT] Rewriting agent/command prompts or consumer shell scripts beyond the documentation statements (§7.2): `TC-ENGINE-091` runs the prompt-conformance check as a control.
- [OUT] Any edit to `AGENTS.md` or `doc/guides/change-lifecycle.md` beyond the bounded delivery-process/lifecycle-state statements named in spec §5.1 F-4 and AC-F4-8: `TC-ENGINE-065` asserts only that bounded reconciliation (marker facts preserved, no other section rewritten), and no case asserts a prompt, workflow, or instruction rewrite in either document.
- [GAP-T1 — closed by DEC-12; re-scoped by spec v1.3] AC-F2-3's "any outcome" reached a path that performs no gate evidence read. The already-`dual-run` revert noop is now **declared** gate-evidence-read-free: answered before any gate read, exit `0`, `recorded: false`, `noop: true`, `operation: "dual-run"`, `reversible: false`, and carrying no `conditions`, no `verdict`, and no `truncation`. The exemption is scoped to the attempts/divergences evidence read only, so the plan asserts three things that cannot be traded for one another: the declared absence *and* the promise on the four evidence-reading outcomes *and* the handover-ledger refusal on the exempt outcome itself. `TC-ENGINE-010` asserts the absence set and the presence set and answers the noop under a torn attempts or divergences ledger; `TC-ENGINE-017` pins the mirror cell — the same noop over an unreadable or torn handover ledger is refused `dispatch.state-unverified` at its declared exit `2` with no `data` and no record appended, even though the attempts/divergences ledger is readable; `TC-ENGINE-011` pins `reversible: false` on it; `TC-ENGINE-012` pins that it appends no record; `TC-ENGINE-014` pins that the *recorded* revert under that same torn attempts ledger refuses `dispatch.state-unverified` at exit `2` with no record appended and the prior flip intact; `TC-ENGINE-016` pins key order on the non-exempt outcomes only.
- [GAP-T2 — closed by DEC-14] The emittable-code set of AC-F7-11 is declared: the production composition exports `MERGE_COMPOSITION_EMITTABLE_CODES`, exhaustive by construction over its refusal branches. `TC-ENGINE-054` ranges over that constant and asserts non-emptiness, duplicate-freedom, at least one `config.*`/`provider.*`/`state.*`/`merge.*` member, a declared row per member, and a kind match per member; it fails naming the missing constant if delivery does not publish it. A refusal branch added later without extending the constant is the declared conformance failure (R-TP-3, RSK-13).
- [GAP-T3 — closed by DEC-13] The owner-principal source is named: the provider-resolved repository owner — the owner component of the checkout's normalized `host/owner/name` identity, resolved through the delivered identity policy — supplied to the composition's declared owner-principal input, with no new configuration key, branch member, or identity source. `TC-ENGINE-050` asserts the effect (authorized for that principal, refused `merge.waiver-unauthorized` at exit `1` for any other) and asserts the `merge` configuration branch still has exactly its three declared keys, so a second authority cannot appear.
- [GAP-T4 — delivery-bound names] Module paths, suite file names, the helper names of the single producer, the guide's filename, and the composition's seam wiring are delivery-bound. Behaviours, identities, exits, closed vocabularies, key orders named in the spec, and AC traceability are not. A test that cannot resolve a seam fails naming the missing contract; it never skips (house rule, §4).
- [GAP-T5 — measured bounds print their context] The 5,005-record truncation fixture (`TC-ENGINE-024`) and the fleet-cost floor (`TC-ENGINE-094`) are bounded measurements: they print record counts, row counts, and elapsed milliseconds so a breach is diagnosable, and they never assert a wall-clock latency as a pass condition. `TC-ENGINE-024` asserts the truncation **contract** (declared bound, positive omission derived from the seeded over-bound records, `verdict: "unverifiable"`), never an incidental count the repository filter can move (TRUNC-ENG-1, R-TP-12).
- [GAP-T6 — closed by DEC-15] The fleet row's repository binding is declared: the row's evaluation is bound to that checkout's normalized `host/owner/name` identity, resolved read-only and non-persisting through the delivered identity policy (persisted create-once binding, otherwise the normalized configured remote), at no additional store open and with no binding write. `TC-ENGINE-021` seeds two foreign-repository records into the same store and asserts the scope rule, `TC-ENGINE-023` asserts the unresolvable-identity failure (`repos.state-unavailable`, exit `2`, no row), `TC-ENGINE-020` asserts the no-store-open snapshot half, and `TC-ENGINE-094` watches the cost.
- [GAP-T7 — the broader test specs are a phase-7 handoff] AC-F8-12 places the reconciliation of `doc/quality/test-specs/test-spec-dispatch-engine.md` and `test-spec-merge-verify-deploy.md` in the documentation phase (phase 7, `@doc-syncer`), not in test planning (DEC-16). No case asserts that content here: `TC-ENGINE-061` asserts the pages state the handoff and that `doc/quality/test-specs/` gained no new entry, and the reconciliation itself is recorded as a phase-7 attestation in §10.
- [GAP-T8 — closed by DEC-17] The row's counting scope is declared: the evaluation folds the `production` evidence scope (counting `pilot` attempts), the same scope `dispatch dual-run summary --repo` and the handover decision fold, so the row/summary equality AC-F3-5 requires is checkable. `TC-ENGINE-020` and `TC-ENGINE-021` seed `controlled-proof` records that must change neither surface's numbers, `TC-ENGINE-022` and `TC-ENGINE-093` assert the payload carries no scope key or flag, and no case introduces one.

## 2. References

| Reference | Role in this plan |
|---|---|
| [`chg-GH-293-spec.md`](./chg-GH-293-spec.md) **v1.3** | Binding source: F-1..F-8, **14 ACs** (AC-F1-1, AC-F1-2, AC-F2-3, AC-F2-4, AC-F3-5, AC-F3-6, AC-F4-7, AC-F4-8, AC-F5-9, AC-F6-10, AC-F7-11, AC-F8-12, AC-F8-13, AC-NFR1-14), NFR-1..NFR-13, DM-1..DM-7, DEC-1..**DEC-17**, §5.1 capability details, §6 flows 1–5, §7 scope, §8 contracts, §17.1 Definition of Done (DoD-1..DoD-10), Appendix A (exact additive shapes), Appendix B (scenario restatements), Appendix C (window/hold mapping), Appendix D (source anchors), **Appendix E** (the five-outcome handover table, the fleet failure table, the emittable-code declaration, and the credential-read exit projection). The v1.1 amendment declared the four seams this plan logged as gaps — the idempotent-revert-noop exemption (DEC-12), the owner-principal source (DEC-13), the emittable-code constant (DEC-14), the row repository binding (DEC-15) — and the phase-7 test-spec handoff (DEC-16). The **v1.2** amendment adds: the credential-read exit projection (exit `1`, `config.credential.missing`; exit `2` is the repaired defect's signature and may not be asserted), the bounded lifecycle-prose reconciliation in AC-F4-8/AC-F8-12 (`AGENTS.md`, `doc/guides/change-lifecycle.md`), the row's declared `production` evidence scope (DEC-17), and §17.1. The **v1.3** amendment is a clarification only: the exemption is scoped to the attempts/divergences evidence read, and the same passages (NFR-11, F-2, AC-F2-3, DEC-12, the glossary, §7.1, §16, Appendix A, Appendix E.1) state that an unreadable or torn **handover** ledger still refuses `dispatch.state-unverified` at exit `2` with no data on this path, because the folded-handover read that establishes the noop is still performed; `TC-ENGINE-017` is this plan's case for that cell. |
| [`readiness-review/readiness-iter-1.md`](./readiness-review/readiness-iter-1.md) | The Definition-of-Ready findings this plan revision closes: **F-2** (the missing-credential merge exit was asserted as `2`; corrected to the declared `1`) and **F-9** (the truncation fixture pinned an incidental `omittedRecords: 5`; corrected to the contract shape). |
| **Declared seams consumed as oracles** | `packages/core/src/domain/dispatch-identity.ts` (normalized `host/owner/name` and its resolution order: persisted binding, scheduler key, normalized remote); `packages/core/src/domain/merge-waiver.ts` (the owner principal declared as "the provider-resolved repository identity"); `packages/core/src/contracts/merge.ts` (`MergeTransactionConfig.ownerPrincipal` and the three `merge` configuration keys); `packages/core/src/contracts/error-table.ts` (`domainKind` per row and `DOMAIN_KINDS`); the composition's exported `MERGE_COMPOSITION_EMITTABLE_CODES`. |
| [`TDR-0031-engine-first-evaluation-surfaces.md`](../../../decisions/TDR-0031-engine-first-evaluation-surfaces.md) (status `Proposed`, uncommitted working-tree file) | Binding decision record, **D1–D11**: D1 read-time host on the `repos` row with the declared failure behaviour; D2 one `{condition, status}` shape in the declared order with `unverifiable` kept at verdict level **and the five-outcome table with its single evidence-read-free exemption**; D3 `cleanDispatches` identity plus the trailing-run streak and the SC-02 restatement; D4 `reversible` from the folded authority with the SC-03 restatement and the shell untouched; D5 no window/hold read and no `QueueLane.providerProfile`; D6 no flip; D7 merge read-failure classification with the declared credential-read exit projection; **D8** owner principal (the provider-resolved repository owner); **D9** the exported `MERGE_COMPOSITION_EMITTABLE_CODES` enumeration; **D10** the row's read-only non-persisting repository binding; **D11** the row's `production` evidence-class scope. C-1..C-8 are the constraint set the negative cases invert. |
| [`.ai/rules/testing-strategy.md`](../../../../.ai/rules/testing-strategy.md) | `bun:test` under `tests/**/*.test.ts`; fixtures never named `*.test.ts`; suites under `tests/{structure,behaviour,golden,checks,boundaries}`; permanent suites assert the current tree, never a diff against a moving base branch; goldens regenerate only by an explicit command; `pnpm check` is the aggregate gate; absences are proven by a failing check that names the offending field. |
| [`.ai/rules/typescript.md`](../../../../.ai/rules/typescript.md) | Strict typing; injected clock/randomness/environment; data-only contracts; pure domain; adapters own I/O; injected fakes over `mock.module`. |
| **Delivered suites consumed as the pinning contract** | `tests/behaviour/dispatch-additive-stability.test.ts` (summary key order **ends at `floor`**; handover order **ends at `unmetConditions`**); `tests/behaviour/repos-list-contract.test.ts` (row field set compared **sorted** against `REPOS_ENTRY_FIELDS`, determinism, `repos.state-unavailable` exit 2, text table `KEY  ROOT  STATE  DAEMON  HANDOVER`); `tests/behaviour/projects-flat-alias.test.ts` (flat golden `tests/golden/fixtures/projects-flat-alias.json`); `tests/golden/dispatch-summary.test.ts` + `tests/fixtures/dispatch/golden/summary.txt`; `tests/behaviour/merge-dry-run.test.ts` (`TC-MERGE-028`); `tests/behaviour/merge-verification-record.test.ts`; `tests/checks/merge-deploy-no-live-calls.test.ts`; `tests/structure/error-table.test.ts` (per-kind row counts: config 10, state 9, provider 13, merge 7, …); `tests/structure/dispatch-error-identity.test.ts`; `tests/structure/dispatch-composition.test.ts:223-273` (production composition with an injected refusing credential port); `tests/structure/content-inventory.test.ts` + `tests/structure/inventory.json`; `scripts/.tests/test-dispatch-bash-fallback.sh` (TC-BASH-001..009); `scripts/.tests/test-deliver-ticket.sh` (five-key order pinned at line 724, summary contract documented at line 666). |
| **Delivered harnesses reused** | `tests/fixtures/dispatch/golden/harness.ts` (`createCommandScenario`, `gate.max` for truncation); `tests/fixtures/dispatch/evidence-windows.ts` (`buildAttempts`, `eligibleSpecs`, `missingClassSpecs`, `uncorroboratedSpecs`, `dayAt`); `tests/fixtures/dispatch/ledger.ts` (`REPOSITORY`, `REPOSITORY_BETA`, `makeHandover`, `makeAuthorityView`, `corroborationFor`); `tests/fixtures/projects/production.ts` (`createProductionProjectsHarness`, injected transport + credential port, `snapshot`/`fileList`, `transportCalls`); `tests/fixtures/projects/state-scope.ts` (`APPROVED_BASE = <cwd>/tmp/tmpdir`, `guardStateFixtureRoot`); `tests/fixtures/projects/temp-repos.ts` (real `git init`/commit checkouts); `tests/fixtures/verify-gates/cases/network-guard.ts` (`createNoNetworkGuard`, `scanForLiveCalls`); `tests/fixtures/projects/host-root.ts` (`snapshotTree`, `snapshotDifferences`). |
| **Precedent to mirror (plan-level)** | `doc/changes/2026-11/2026-11-13--GH-294--provider-peak-pausing/chg-GH-294-test-plan.md` — the verification-map format, exact-set-equality discipline, substitute-assertion registration, evidence-recording convention, and the "assert the absence, name the offending field" style this plan extends to projections and to a composition restoration. |
| [`chg-GH-293-pm-notes.yaml`](./chg-GH-293-pm-notes.yaml) | Context only: clarify-scope state detection, the owner-authored scope comment of 2026-11-15 (merge primitive defect in scope), and delivery conventions. The specification is the source of truth. |
| **Ticket / story** | GitHub issue `juliusz-cwiakalski/agentic-delivery-os#293` (milestone M2; AC1–AC4 verbatim); `doc/planning/oss-tooling/milestones/m2/backlog.md` §M2-S16 (lines 355-370); `doc/planning/oss-tooling/milestones/m2/test-scenarios.md` (SC-M2-S16-01 at line 279, SC-M2-S16-02 at line 288, SC-M2-S16-03 at line 534). |
| **TMPDIR caveat** | `.ai/memory/lessons/lesson-2026-001-ci-baseline-parity-tmpdir.md` — the canonical aggregate gate is `TMPDIR="$PWD/tmp/tmpdir" pnpm check`. |

## 3. Coverage Overview

All **14 acceptance criteria** map to at least one named case, and no case is an orphan. The plan carries **46 cases in eight blocks**: accrual `001`–`006`, handover `010`–`017`, fleet `020`–`024`, shell and no-flip `030`–`035`, windows/holds documentation `040`–`042`, merge restoration and classification `050`–`055`, documentation deliverables `060`–`065`, cross-cutting invariants `090`–`095`. The mapping is intentionally uneven: criteria whose wording spans several independent observables get several cases (AC-F3-5 → three, AC-F4-7 → five, AC-F2-3 → five), which is cheaper than a case that would pass while one half of the sentence is false. Spec v1.3's declared seams are asserted **as declarations, in both directions**: the handover exemption cases prove the absence on the one exempt outcome, the presence on the four evidence-reading outcomes, and the handover-ledger refusal on the exempt outcome itself (NFR-11), the binding cases prove foreign records excluded **and** that resolution opens no extra store and writes no binding (NFR-13), the conformance case proves `MERGE_COMPOSITION_EMITTABLE_CODES` is exported, non-empty, duplicate-free, and non-vacuous (NFR-12), the scope cases prove both surfaces fold `production` and that a `controlled-proof` seed moves neither (DEC-17), and the credential case proves the declared exit `1` **and** the absence of exit `2` on that path (R-TP-11). §3.6 traces the spec's §17.1 Definition of Done to these cases.

**Restated scenarios are oracles, not prose.** `SC-M2-S16-02` is delivered by `TC-ENGINE-002` (accrual walk) and `TC-ENGINE-062`/`063` (corpus text); `SC-M2-S16-03` by `TC-ENGINE-011`/`012` (reversibility before/after `--revert`, per-repository isolation) and `TC-ENGINE-031`/`062`/`063` (shell exit 0 plus pointer, corpus text). The original assertions — per-dispatch coverage growth and a shell `data.reversible` — are asserted **absent** by `TC-ENGINE-062` so a future reader cannot re-introduce the unrepresentable claim.

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (condensed) | TC ID(s) | Status |
|---|---|---|---|
| AC-F1-1 | Summary carries `cleanDispatches` (= `corroboration.satisfied`), `consecutiveCleanDispatches` (trailing run, `0` when none/empty), and four `conditions` in the declared order with `met`/`open`; delivered keys/order unchanged; `truncation` last | TC-ENGINE-001, TC-ENGINE-002, TC-ENGINE-003, TC-ENGINE-005 | Covered |
| AC-F1-2 | The set and order of `open` conditions equals `unmetConditions[].condition` on every fixture family; `cleanDispatches === corroboration.satisfied` on every fixture; the three text lines sit after `unmet_conditions=` and before the optional truncation line | TC-ENGINE-004, TC-ENGINE-006, TC-ENGINE-095 | Covered |
| AC-F2-3 | Handover data carries four `conditions` in the declared order on every outcome that performs the gate evidence read (recorded flip, idempotent flip noop, clean refusal, recorded revert); the idempotent revert noop is the single declared exemption — answered before any gate evidence read, exit `0`, `recorded: false`, `noop: true`, `operation: "dual-run"`, `reversible: false`, with no `conditions`, no `verdict`, and no `truncation`, and it is **not** refused when the attempts or divergences ledger is unreadable or torn, while an unreadable or torn **handover** ledger still refuses `dispatch.state-unverified` at its declared exit `2` with no data on this path (the folded-handover read that establishes the noop still happens); `unmetConditions` refusal-only; `reversible` equals "latest folded authority is `authoritative`"; the recorded revert carries `verdict`, so `truncation` is present exactly when `verdict == "unverifiable"`; no condition status is `unverifiable`; delivered keys keep position | TC-ENGINE-010, TC-ENGINE-011, TC-ENGINE-014, TC-ENGINE-016, TC-ENGINE-017 | Covered |
| AC-F2-4 | `reversible` is `true` after a recorded flip and after an idempotent flip noop, `false` after a recorded revert, on a clean refusal, and on the idempotent revert noop; the revert noop returns data at exit `0` with no record appended and no gate evidence read, so it still answers with an unreadable or torn attempts ledger, while the recorded revert under that ledger refuses `dispatch.state-unverified` at exit `2` with no record appended and the prior flip intact; the reversal record shape is unchanged; replay appends no duplicate; an unrelated repository is unaffected | TC-ENGINE-011, TC-ENGINE-012, TC-ENGINE-013, TC-ENGINE-014 | Covered |
| AC-F3-5 | Every row carries the five delivered fields then `reversible` and `handoverGate`; the block carries `verdict`, four `conditions`, `countedDeliveries`, `cleanDispatches`, and `truncation` only when truncated; the row's evaluation is bound to its own checkout's normalized `host/owner/name` identity resolved read-only and non-persisting (persisted binding, else the normalized configured remote), so `handoverGate.cleanDispatches` equals the summary's and foreign-repository records are excluded, with no additional store opened and no binding written; the fold uses the declared `production` evidence scope (counting `pilot` attempts, never `controlled`/`controlled-proof`) with no scope key or flag added; the flat alias stays byte-identical and carries neither field | TC-ENGINE-020, TC-ENGINE-021, TC-ENGINE-022 | Covered |
| AC-F3-6 | Unreadable/torn ledger ⇒ `repos.state-unavailable` exit `2` with no row; **unresolvable row identity ⇒ the same identity, exit `2`, no row**; truncated read ⇒ `verdict: "unverifiable"` plus `truncation` over the visible window; `first-use` ⇒ the empty-window evaluation (`ineligible`, truth met, corroboration met vacuously, coverage/floor open, `countedDeliveries: 0`, `reversible: false`) with no store opened; two reads over unchanged state byte-identical | TC-ENGINE-020, TC-ENGINE-023, TC-ENGINE-024, TC-ENGINE-093 | Covered |
| AC-F4-7 | `dual-run` prints no pointer; `authoritative` exits `0` and prints the bounded stderr pointer naming `dispatch <ref>` and `dispatch handover <repo> --revert`; both remain executable; the delivery summary keeps exactly five keys in the pinned order with no new stdout key or line | TC-ENGINE-030, TC-ENGINE-031, TC-ENGINE-032, TC-ENGINE-033, TC-ENGINE-034 | Covered |
| AC-F4-8 | This repository and the fleet stay `dual-run` with no authoritative record attributable to the change; the flip stays an owner act; the guide documents the engine as the regular path with the shell as fallback; and the two lifecycle statements are reconciled by bounded edits — `AGENTS.md` and `doc/guides/change-lifecycle.md` both state the typed engine as the regular delivery path and the shell entry points as the documented, still-executable fallback whose authoritative-mode deprecation pointer is delivered, neither claims a repository flipped or the shell deprecated in `dual-run`, and the "retained primary entry points" claim appears in neither (`AGENTS.md` carries no `ados_distribution` marker; the guide keeps its existing one) | TC-ENGINE-035, TC-ENGINE-060, TC-ENGINE-063, TC-ENGINE-065 | Covered |
| AC-F5-9 | The hold and window effect-surface mapping is stated explicitly; the lanes-read nomination claim is removed and replaced by the surfaces that do carry the nomination; the lanes-read profile blindness is declared; no window read and no `QueueLane.providerProfile` are introduced | TC-ENGINE-040, TC-ENGINE-041, TC-ENGINE-042 | Covered |
| AC-F6-10 | The production composition performs real tracker/CI/request-detail reads and resolves configuration, branch, base reference, and the owner principal as the provider-resolved repository owner from the checkout's normalized identity, with no new configuration key, branch member, or identity source (the `merge` branch keeps its three keys); a waiver authored by that principal is authorized and records no waiver on a dry run, while the same waiver from any other principal refuses `merge.waiver-unauthorized` at exit `1`; dry run yields the delivered report at exit `0` or a classified refusal at exit `1`; never `fallback.internal` for a configuration-read failure, and a missing credential is the declared `config.credential.missing` refusal at exit `1` — never exit `2` | TC-ENGINE-050, TC-ENGINE-051, TC-ENGINE-052, TC-ENGINE-053, TC-ENGINE-055 | Covered |
| AC-F7-11 | Every emitted `(kind, code)` matches the code's declared `domainKind` (`config.credential.missing` ⇒ `config`); `MERGE_COMPOSITION_EMITTABLE_CODES` is exported, non-empty, duplicate-free, carries at least one `config.*`, `provider.*`, `state.*`, and `merge.*` code, has every member resolving to a declared row whose `domainKind` matches the emitted kind, and has no member absent from the table; a missing-credential dry run is classified by its declared identity at its declared projection — `config.credential.missing` at **exit `1`**, never `fallback.internal` at exit `2` (asserted absent); row count, `DOMAIN_KINDS`, and exit classes unchanged | TC-ENGINE-052, TC-ENGINE-053, TC-ENGINE-054, TC-ENGINE-091 | Covered |
| AC-F8-12 | The six feature pages state the declared contracts and residuals (including the handover exemption, the row binding, the row's `production` scope, the owner-principal source, and the emittable-code constant); the two broader test specs are handed to phase 7 (`@doc-syncer`) for reconciliation and no new test-spec entry is created; a new guide declares `ados_distribution: redistributable` and covers operation, gate/row reading, flip and reversal, and the shell fallback; the lifecycle-prose reconciliation is present in `AGENTS.md` and `doc/guides/change-lifecycle.md` (engine as the regular path, shell as the documented still-executable fallback, no flip claim, no deprecation-in-`dual-run` claim, zero "retained primary entry points" occurrences, markers as declared, no other paragraph rewritten); the planning corpus carries the backlog `Progress:` line, the status addendum, the README scenario row including SC-M2-S16-03, both restatements; TDR-0031 lands with its index row | TC-ENGINE-060, TC-ENGINE-061, TC-ENGINE-062, TC-ENGINE-064, TC-ENGINE-065 | Covered |
| AC-F8-13 | `SC-M2-S16-02` asserts counted growth, first-appearance coverage growth, and clean accrual; `SC-M2-S16-03` asserts shell exit `0` + pointer with reversibility read from the engine surfaces before (`true`) and after (`false`) `--revert` with per-repository isolation; each restatement is traced to story AC1/AC4 with no story AC weakened | TC-ENGINE-002, TC-ENGINE-062, TC-ENGINE-063 | Covered |
| AC-NFR1-14 | The delivered pinned suites stay valid and are extended by appending only; no new command, verb, flag, error row, `DOMAIN_KINDS` member, or exit class | TC-ENGINE-090, TC-ENGINE-091, TC-ENGINE-092, TC-ENGINE-093, TC-ENGINE-094, TC-ENGINE-095 | Covered |

**Capability coverage** (every F-# has at least one TC): F-1 → 001, 002, 003, 004, 005, 006; F-2 → 010, 011, 012, 013, 014, 015, 016, 017; F-3 → 020, 021, 022, 023, 024; F-4 → 030, 031, 032, 033, 034, 035, 060, 065; F-5 → 040, 041, 042; F-6 → 050, 051, 053, 055; F-7 → 052, 053, 054, 091; F-8 → 060, 061, 062, 063, 064, 065.

**Decision coverage**: DEC-1 → 020, 021, 022, 023, 024; DEC-2 → 003, 004, 010, 017, 095; DEC-3 → 001, 002, 004, 006; DEC-4 → 011, 012, 013, 015, 031, 034; DEC-5 → 040, 041, 042; DEC-6 → 035, 060, 065; DEC-7 → 052, 054; DEC-8 → 050, 051, 053; DEC-9 → 005, 016, 090, 091; DEC-10 → 061, 062, 063, 064, 065; DEC-11 (amended) → 061 (no new `doc/quality/test-specs/` entry asserted over that directory); DEC-12 → 010, 011, 012, 013, 014, 016, 017; DEC-13 → 050, 053; DEC-14 → 052, 053, 054, 091; DEC-15 → 020, 021, 023, 024, 093, 094; DEC-16 → 061, 062; **DEC-17 → 020, 021, 022, 093** (documented in `061`).

**TDR-0031 clause coverage** (the record's amended clauses, bound beside the cases that assert them): D2 (five-outcome table, one exemption scoped to the gate evidence read) → 010, 011, 012, 014, 016, 017; D4 (reversibility, D4 residual) → 011, 013, 014; **D8** (owner principal) → 050; **D9** (`MERGE_COMPOSITION_EMITTABLE_CODES`) → 052, 053, 054, 091; **D10** (row repository binding) → 020, 021, 023, 024, 093; **D11** (row `production` evidence scope) → 020, 021.

**Ticket-scenario coverage**: SC-M2-S16-01 (per-condition reporting) → 010, 020, 021, 095; SC-M2-S16-02 **restated** (accrual walk) → 001, 002, 062, 063; SC-M2-S16-03 **restated** (shell exit 0 + pointer, reversibility on the engine surfaces) → 011, 012, 031, 062, 063.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The specification declares no REST/HTTP endpoint (§8.1: N/A) and no event topic, kind, payload, or taxonomy version (§8.2: N/A). The interface surface is the four existing CLI reads/writes the change extends (`dispatch dual-run summary`, `dispatch handover`, `repos list`, `merge`) plus the five data-model elements.

| Element | TC ID(s) | Observable assertion |
|---|---|---|
| DM-1 Summary additive fields | 001, 002, 003, 005, 006 | `cleanDispatches`, `consecutiveCleanDispatches`, `conditions` appended after `floor`; the optional `truncation` object remains the last key; the three text lines appear in the declared position. |
| DM-2 Handover additive fields | 010, 011, 012, 014, 015, 016, 017 | `conditions` present on the four evidence-reading outcomes and absent on the idempotent revert noop (declared exemption, with no `verdict` and no `truncation` there); `reversible` boolean; `verdict` populated on the recorded revert; `unmetConditions` stays refusal-only with its delivered shape; `truncation` present iff `verdict == "unverifiable"`; the noop is not refused by an unreadable or torn attempts/divergences ledger and is refused `dispatch.state-unverified` at its declared exit `2` with no data when the handover ledger is unreadable or torn; text output unchanged. |
| DM-3 Shared condition-status shape | 003, 004, 010, 020, 021, 095 | Exactly four `{condition, status}` entries in the declared order, `status` in `met \| open`, exactly two keys per entry (no `detail`), one producer read by three surfaces, open set equals `unmetConditions`. |
| DM-4 Fleet row additive fields | 020, 021, 022, 023, 024, 093 | Row order `repoKey, root, stateLocation, daemonReachable, handoverState, reversible, handoverGate`; block order `verdict, conditions, countedDeliveries, cleanDispatches[, truncation]`; `REPOS_ENTRY_FIELDS` extended in that order; the block folds the declared `production` evidence scope (counting `pilot`, never `controlled`/`controlled-proof`) with no scope key or flag; the flat alias carries neither field. |
| DM-5 Emitted failure classification | 052, 053, 054 | For every emittable code the emitted `domainKind` equals the resolved row's `domainKind`; `config.credential.missing` emits `config` at its declared projection (`user-validation` → exit `1`); exit `2` (`fallback.internal`) is asserted absent on that path; no new row/kind/exit. |
| DM-6 Composition emittable-code set | 052, 053, 054, 091 | The composition exports `MERGE_COMPOSITION_EMITTABLE_CODES`; the set is non-empty, duplicate-free, spans `config.*`/`provider.*`/`state.*`/`merge.*`, every member resolves to a declared row with a matching kind, and no member is absent from the table. |
| DM-7 Row repository binding | 020, 021, 023, 093, 094 | The row folds only records of its own resolved `host/owner/name` identity; foreign-repository records are excluded; resolution is read-only, non-persisting, and opens no additional store; an unresolvable identity fails `repos.state-unavailable` at exit `2` with no row. |
| §8.1 `dispatch dual-run summary` surface | 001, 003, 004, 005, 006 | Data keys and order, text lines, exit unchanged by the addition. |
| §8.1 `dispatch handover` surface | 010, 011, 012, 013, 014, 015, 016, 017 | Data keys and order, exit projection unchanged, records unchanged, text unchanged, and the declared read order: the noop skips the gate evidence read but still folds the handover ledger, so a corrupt handover history refuses it at its declared exit `2`. |
| §8.1 `repos list` surface | 020, 021, 022, 023, 024, 093 | Row fields, block, failure behaviour, text table unchanged, flat alias byte-identical. |
| §8.1 `merge` surface | 050, 051, 052, 053, 054, 055, 091 | Production composition reads, owner-principal resolution from the declared identity, the exported emittable-code constant, dry-run report, classified refusals, the declared credential-read exit `1`, `verify deploy` residual; no payload or configuration-key change. |
| §8.1 Shell entry points | 030, 031, 032, 033, 034 | Five-key tail, exits, pointer behaviour, no new stdout. |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR ID | Requirement (threshold) | TC ID(s) | Status |
|---|---|---|---|
| NFR-1 | 0 delivered keys removed/renamed/reordered/re-typed; appended keys in the declared order; pinned order suites green | TC-ENGINE-005, TC-ENGINE-016, TC-ENGINE-020, TC-ENGINE-090 | Covered |
| NFR-2 | Per ready row ≤ 1 bounded attempts read (5,000) + ≤ 1 divergences read + a pure fold; 0 writes, 0 network, 0 model, no cache, no scheduler | TC-ENGINE-024, TC-ENGINE-094 (substitute AMB-ENG-2) | Covered |
| NFR-3 | Two `repos list --json` reads over unchanged state are byte-identical; the row carries no wall-clock or relative-time field | TC-ENGINE-093 | Covered |
| NFR-4 | `verdict == "unverifiable" ⟺ truncation present` on every data-returning surface (an outcome carrying no `verdict` carries no `truncation`); unreadable ledger ⇒ exit 2 with no data; 0 fabricated zeros/defaulted statuses/"unknown" rows | TC-ENGINE-004, TC-ENGINE-010, TC-ENGINE-014, TC-ENGINE-023, TC-ENGINE-024, TC-ENGINE-095 | Covered |
| NFR-5 | 0 emitted `(kind, code)` pairs contradicting the declared row; every `MERGE_COMPOSITION_EMITTABLE_CODES` member resolves to a declared row with a matching `domainKind` and none is absent; 0 new rows, `DOMAIN_KINDS` members, or exit classes; a missing-credential merge read classifies as `config.credential.missing` at exit `1` and **0 such invocations exit `2`** | TC-ENGINE-052, TC-ENGINE-053, TC-ENGINE-054, TC-ENGINE-091 | Covered |
| NFR-6 | Exactly five summary keys in the pinned order; 0 new stdout keys/lines; `dual-run` no-pointer and `authoritative` pointer-at-exit-0 unchanged; all four entry points executable | TC-ENGINE-030, TC-ENGINE-031, TC-ENGINE-032, TC-ENGINE-033, TC-ENGINE-034 | Covered |
| NFR-7 | 0 authoritative `dispatch.handover` records attributable to the change; every repository's authority unchanged | TC-ENGINE-013, TC-ENGINE-035 (audit half AMB-ENG-3) | Covered |
| NFR-8 | The new guide declares `ados_distribution: redistributable`; 0 reconciled pages retain the corrected over-claim; **0 occurrences of the "retained primary entry points" claim in `AGENTS.md` and `doc/guides/change-lifecycle.md`**, neither claims a repository flipped or the shell deprecated in `dual-run`; `AGENTS.md` carries no `ados_distribution` marker and the guide keeps its existing one; documentation and prompt conformance checks green | TC-ENGINE-040, TC-ENGINE-041, TC-ENGINE-060, TC-ENGINE-061, TC-ENGINE-062, TC-ENGINE-065 | Covered |
| NFR-9 | Real state store plus injected harness/tracker/CI/VCS/provider/clock ports; 0 live network calls, 0 live credential reads, 0 live model calls, 0 real sleeps | TC-ENGINE-050, TC-ENGINE-092 | Covered |
| NFR-10 | 100% agreement of the four condition statuses across summary, handover, and fleet row on every fixture; 0 open-set identity violations; 0 row/summary comparisons taken under differing evidence scopes (both fold the declared `production` scope) | TC-ENGINE-004, TC-ENGINE-021, TC-ENGINE-095 | Covered |
| NFR-11 | Declared handover exemption, scoped to the gate evidence read: exactly one handover outcome (the idempotent revert noop) omits `conditions`; **0** idempotent revert noops refused by the attempts or divergences ledger being unreadable or torn; **100%** of idempotent revert noops still refused `dispatch.state-unverified` at their declared exit `2` with no data when the **handover** ledger is unreadable or torn (the folded-handover read that establishes the noop is still performed); 0 evidence-reading outcomes omitting `conditions`; 0 outcomes carrying a condition status while no evidence was read | TC-ENGINE-010, TC-ENGINE-011, TC-ENGINE-012, TC-ENGINE-014, TC-ENGINE-016, TC-ENGINE-017 | Covered |
| NFR-12 | `MERGE_COMPOSITION_EMITTABLE_CODES` is exported by the composition, non-empty, duplicate-free, covers the emitted domains (≥1 `config.*`, `provider.*`, `state.*`, `merge.*`), has 0 members without a declared row, and 0 refusal branches outside the constant | TC-ENGINE-053, TC-ENGINE-054, TC-ENGINE-091 | Covered |
| NFR-13 | 100% of evaluable rows fold only their own resolved repository identity; 0 rows evaluated under an unresolved or foreign identity; 0 store opens and 0 binding writes attributable to identity resolution | TC-ENGINE-020, TC-ENGINE-021, TC-ENGINE-023, TC-ENGINE-093, TC-ENGINE-094 | Covered |

### 3.4 Coverage-Matrix Integrity

| Check | Value | Verdict |
|---|---|---|
| Acceptance criteria in the specification | 14 (AC-F1-1 … AC-NFR1-14) | — |
| Acceptance criteria with at least one case | 14 | Pass |
| Acceptance criteria uncovered / TODO | 0 | Pass |
| Cases in this plan | 46 (`TC-ENGINE-001`..`TC-ENGINE-095`, block-structured) | — |
| Cases naming at least one AC (no orphans) | 46 | Pass |
| Cases that are manual-only | 0 (one carries an audit footer: 035) | Pass |
| Cases with a substitute assertion recorded (§3.5) | 8 properties across 11 case references (020, 021, 022, 024, 035, 050, 054, 091, 093, 094, 095) | Declared |
| Capabilities covered | F-1..F-8 (8/8) | Pass |
| NFRs covered | NFR-1..NFR-13 (13/13) | Pass |
| Interfaces covered | DM-1..DM-7 (7/7); API/EVT N/A per §8.1/§8.2 | Pass |
| Decisions covered | DEC-1..**DEC-17** (17/17) | Pass |
| TDR-0031 clauses bound beside cases | D2, D4, **D8, D9, D10, D11** (D1/D3/D5/D6/D7 carried by the DEC rows) | Pass |
| Spec §17.1 DoD items traced to cases | DoD-1..DoD-10 (10/10; DoD-9/DoD-10 review-attested — §3.6) | Pass |
| AC → TC direction present | §3.1 | Pass |
| TC → AC direction present | §5.1 index and every §5.2 header | Pass |
| Cases appearing in the Automation Plan (§7) | 46 of 46 | Pass |

### 3.5 Declared gaps, boundaries, and substitute assertions

| ID | What is asserted, and how | Cases | AC / NFR |
|---|---|---|---|
| **AMB-ENG-1 — "without opening a store" has no open counter** | There is no store-open seam on the fleet read. **Substitute:** a full tree snapshot of the host root before and after a `repos list --json` over a host that has one `first-use` row and one `ready` row is identical, the `first-use` row's project state directory still does not exist, and the row nevertheless carries the empty-window evaluation. Opening a store that creates its directory (or a temp sibling) changes the snapshot, so the absence is falsifiable. | 020 | AC-F3-6, NFR-2 |
| **AMB-ENG-2 — per-row read cardinality is not countable through the production composition** | The composer exposes no per-project store factory, so "≤ 1 attempts read + ≤ 1 divergences read" is not counted directly. **Substitute:** (i) the row's block is the delivered fold's own output — `TC-ENGINE-021` proves it agrees with the summary over the same ledger, so no second derivation can hide in the row — (ii) the over-bound row reports `verdict: "unverifiable"` with a `truncation` object carrying the declared bound and a positive omission, proving the bound is applied per row, (iii) write/network/model/sleep counters are zero, (iv) a 25-row fleet read completes inside a printed floor so a per-row blow-up surfaces. Read-call cardinality itself is review-attested against the delivered `readDispatchGate` structure. | 024, 094 | NFR-2, AC-F3-6 |
| **AMB-ENG-3 — "no authoritative record attributable to the change" is an audit over untracked state** | A permanent suite cannot assert a fact about the operator's real state root (and must never read it). **Substitute:** the permanent half proves the *writers* — a source scan shows `appendDispatchHandover` is reachable only from the handover and revert use cases, and behavioural counts prove a summary read, a fleet read, and a replayed noop append zero handover records and leave the authority document byte-identical. The "this change flipped nothing" verdict itself is recorded in §10 from a review audit of the change's state roots. | 035 | AC-F4-8, NFR-7 |
| **AMB-ENG-4 — the emittable set is a declaration, so a branch that forgets to extend it escapes** | DEC-14/D9 makes the set a named export, exhaustive **by construction** at delivery, so the test ranges over a real oracle rather than a hand-picked list. **Substitute (residual direction):** `TC-ENGINE-054` asserts the constant is non-empty, duplicate-free, spans four families (so it cannot pass vacuously), and that every member resolves to a declared row whose `domainKind` equals the emitted kind, with a live mismatch control (`classifyThrown({kind:"provider", code:"config.credential.missing"})` must still be contained). That control asserts the **classifier's** containment of a contradictory pair — the defect's mechanism — and is never an assertion about what the composition emits; no case asserts exit `2` for a missing credential (R-TP-11). What the suite cannot prove from outside is that a *future* refusal branch was added to the constant; that gap is declared (RSK-13) and is caught only when such a branch is exercised. | 054 | AC-F7-11, NFR-5, NFR-12 |
| **AMB-ENG-5 — the owner principal is declared, but its resolution is observed through an effect** | DEC-13 names the source (the owner component of the checkout's normalized `host/owner/name` identity), so the case no longer guesses. **Substitute:** the case still asserts the *effect* rather than reading the resolved value — a waiver authored by the resolved principal authorizes on a dry run (and records no waiver), while the same waiver authored by a different principal refuses `merge.waiver-unauthorized` at exit `1` — and separately asserts the `merge` configuration branch has exactly its three declared keys, so a second authority cannot appear. Reading the principal directly would test the resolver in isolation rather than the composition's use of it. | 050, 091 | AC-F6-10 |
| **BYTE-ENG-1 — "byte-identical to the delivered `projects.v1`" is a golden, not a diff** | No raw pre-change artifact exists in a permanent suite. **Substitute:** the delivered committed golden `tests/golden/fixtures/projects-flat-alias.json` comparison runs unchanged, plus absence assertions that neither new field appears anywhere in the flat payload, plus a `repos` read over the same host that *does* carry both fields (so the absence is a projection difference, not an empty read). | 022 | AC-F3-5, NFR-1 |
| **TRUNC-ENG-1 — the fleet truncation fixture's omission count is incidental** | The bound is a production constant with no test seam on the fleet path, **and the bound is applied to the ledger read *before* the row's repository filter**, so the omitted count is a function of every record in the store — including any foreign record the scope-case seeds. Pinning `omittedRecords: 5` would therefore encode a coincidental arithmetic and break the moment a foreign record is added or removed (readiness F-9). **Substitute (assert the contract, not the incident):** one project ledger is seeded with 5,005 counted attempts through the delivered append path (identity-bound), plus one foreign-repository record; the case prints record count and elapsed milliseconds and asserts the **shape** — `handoverGate.verdict === "unverifiable"`; `handoverGate.truncation` present with `bound === 5000` (the delivered `DISPATCH_MAX_ATTEMPT_RECORDS` constant, imported rather than transcribed); `Number.isInteger(omittedRecords) && omittedRecords > 0`; `omittedRecords >= seededIdentityBoundRecords - bound` and `omittedRecords <= (seededIdentityBoundRecords + foreignRecords) - bound` (the declared envelope, so a fabricated or truncated-to-zero count fails); `countedDeliveries <= bound` **and** `countedDeliveries < seededIdentityBoundRecords`. Removing the foreign record must leave `bound`, `verdict`, and `countedDeliveries` unchanged and `omittedRecords > 0`, with a movement no larger than the number of records removed — never an equality against a literal. No sleep, no network, temp state root only; the fixture is built once per suite. | 024 | AC-F3-6, NFR-4 |
| **SCOPE-ENG-1 — a `controlled`-scope contract is not directly observable on the shipped read** | The production composition fixes the gate scope at `production`, so no external flag selects `controlled` on `repos list` or the summary. **Substitute:** the scope is asserted through its *effect* — seeding `controlled-proof` attempts (the `controlled` class) into the same store must move neither the row's `countedDeliveries`/`cleanDispatches`/`conditions` nor the summary's, while a `pilot` attempt must move both by exactly one (`TC-ENGINE-020`, `TC-ENGINE-021`, `TC-ENGINE-095`); and the payload carries no `scope`/`evidenceScope`/`evidenceClass` key or flag, so no consumer can select another scope (`TC-ENGINE-022`, `TC-ENGINE-093`). Reading the composition's scope literal directly would test the constant rather than the projection (DEC-17, TDR-0031 D11). | 020, 021, 022, 093, 095 | AC-F3-5, NFR-10 |

### 3.6 Definition-of-Done trace (spec §17.1)

Every item of the spec's change-specific DoD is proven by named cases, except the two process gates (DoD-9, DoD-10), which no test can assert about a tree or about an operator's untracked state root and are therefore **review-attested** in §10. A DoD item with no case would be a coverage hole; an attack on this table is a review question answered by the case ids, not by prose.

| DoD item | What it requires (condensed) | Cases that prove it | Non-automated evidence |
|---|---|---|---|
| **DoD-1** | Additive contracts verified: every appended key, its order, and every appended text line; no delivered key/exit/identity moved except the declared credential-read exit | `TC-ENGINE-001`, `002`, `003`, `005`, `006`, `010`, `016`, `020`, `022`, `090` | — |
| **DoD-2** | Handover `conditions` bounded to the declared outcomes: four evidence-reading outcomes carry them, the revert noop carries none and is not refused by an unreadable or torn attempts/divergences ledger, while an unreadable or torn handover ledger still refuses it `dispatch.state-unverified` at its declared exit `2` with no data | `TC-ENGINE-010`, `011`, `012`, `014`, `016`, `017` | — |
| **DoD-3** | Summary/handover/row coherence: one producer, one order, one verdict vocabulary, one `production` scope; open set equals `unmetConditions`; row/summary agree; foreign records excluded; no extra store open | `TC-ENGINE-003`, `004`, `020`, `021`, `023`, `024`, `093`, `095` | — |
| **DoD-4** | Merge composition real and honest: real reads, declared-source resolution incl. the owner principal; missing credential is exit-1 `config.credential.missing`, not `fallback.internal` at exit 2; the emittable constant is total | `TC-ENGINE-050`, `051`, `052`, `053`, `054`, `091` | — |
| **DoD-5** | Shell non-change controls green: five-key tail in order, unchanged exits and pointer behaviour, four entry points executable | `TC-ENGINE-030`, `031`, `032`, `033`, `034` | — |
| **DoD-6** | No repository flipped: no `dispatch.handover` authoritative record attributable to the change | `TC-ENGINE-013`, `035` | No-flip state-root audit (§10, AMB-ENG-3) |
| **DoD-7** | Documentation set landed: guide, six feature pages, bounded lifecycle-prose edits, phase-7 test-spec reconciliation, corpus restatements, TDR-0031 with its index row | `TC-ENGINE-040`, `041`, `042`, `055`, `060`, `061`, `062`, `063`, `064`, `065` | Phase-7 reconciliation attestation (§10) |
| **DoD-8** | Quality gates green hermetically: `TMPDIR=$PWD/tmp/tmpdir pnpm check`, the change-specific suites, the doc-distribution check, the shell suites | `TC-ENGINE-090`, `091`, `092` (+ the §7 gate command battery) | — |
| **DoD-9** | Commit-range gate: `./scripts/lint-commit-range.sh --base <base>` reports `PASS` (or a declared `SKIP`); an unresolved `ERROR` is never a pass | — (no TC) | **Review-attested** (§10): the gate verdict string, quoted verbatim |
| **DoD-10** | Plan phases closed with evidence: every declared plan phase complete and carrying its per-phase pm-notes `notes:` evidence | — (no TC) | **Review-attested** (§10): `phase list` output plus one `notes:` quote per phase |

**DoD-10 is a review-attested item by construction.** "Every declared plan phase is complete with per-phase evidence" is a fact about the change capsule's `pm-notes.yaml` and the `phase` state, not about the delivered tree, and a permanent suite must never read live lifecycle state. The plan therefore records it once in §10 as an attestation quoting `phase list <ref>` and one `notes:` entry per phase; a phase without evidence fails the attestation, not a test. DoD-9 is recorded the same way for the same reason: the commit-range gate's verdict is a property of the commit range at review time, and its `ERROR` outcome must never be recorded as a pass.


## 4. Test Types and Layers

- **Unit / structure (contract-level), `bun:test` under `tests/structure/`** — the shared condition-status shape and the declared order as data-only contracts, the additive field-set constants (`REPOS_ENTRY_FIELDS`), the classification conformance over the composition's exported `MERGE_COMPOSITION_EMITTABLE_CODES`, and the structural no-flip writer scan (`TC-ENGINE-003`, `TC-ENGINE-016`, `TC-ENGINE-020` contract half, `TC-ENGINE-035`, `TC-ENGINE-054`, `TC-ENGINE-090`). No I/O beyond reading the production sources; ambient-globals discipline applies.
- **Behaviour (integration over the delivered seams), `bun:test` under `tests/behaviour/`** — the majority: the summary and handover command paths over the real state store and the real ledger through `createCommandScenario`; the fleet read through `createProductionProjectsHarness` over real temp checkouts with per-project stores seeded through the delivered ledger APIs; the merge production composition through `createProductionComposer` over a real temp git checkout with injected transport and credential ports; the cross-surface coherence matrix.
- **Golden, `bun:test` under `tests/golden/`** — the summary text golden (`tests/fixtures/dispatch/golden/summary.txt`) regenerated deliberately once, with the diff showing only the three declared additive lines; the `repos` text table golden unchanged (no sixth column); the flat-alias golden unchanged (`TC-ENGINE-006`, `TC-ENGINE-020`, `TC-ENGINE-022`).
- **Shell, `bash scripts/.tests/`** — the delivered pinned suites run **unmodified** as the non-change control (`TC-ENGINE-030`..`033`), plus one new parity suite for stdout identity across authority states (`TC-ENGINE-034`). Bash changes follow `.ai/rules/bash.md`; the new suite `set -Eeuo pipefail`, temp roots only, no network.
- **Checks (guards and documentation), `bun:test` under `tests/checks/`** — hermeticity counters and live-call scans over the new suites (`TC-ENGINE-092`), the documentation reconciliation over resolved non-empty sections with absence assertions (`TC-ENGINE-040`, `041`, `060`..`065`), and the no-flip writer scan (`TC-ENGINE-035`). These fail in both directions: a page that still over-claims and a page that lost its mapping both fail.
- **Measured bounds, printed context** — the 5,005-record truncation fixture and the 25-row fleet floor print counts and elapsed milliseconds; no wall-clock latency is a pass condition (`TC-ENGINE-024`, `094`).
- **Not used:** `mock.module` substitution of the modules under test; live network, live credential reads, live model calls, real `sleep`; the live tree or `$HOME` as state; any write into the operator's real state root (`guardStateFixtureRoot` refuses it). Fakes are injected ports (recording GitHub transport, resolving/refusing credential port, recording harness spawn, injected git runner) — never a mock of the classifier, the gate fold, the ledger, or the merge transaction.
- **Boundaries:** no new cross-package edge is expected (the projection lives in the delivered packages); `check:boundaries` runs inside the aggregate gate. If delivery adds a module, the delivered structural lists must be extended by appending (`tests/structure/dispatch-imports.test.ts`, `dispatch-merge-boundary.test.ts`, `tests/structure/inventory.json`) — the fixture-coverage and inventory meta-checks fail otherwise (`TC-ENGINE-090`).

## 5. Test Scenarios

TC IDs use the `ENGINE` feature prefix and follow the capability blocks of the specification: `001`–`006` summary accrual and conditions; `010`–`017` handover conditions and reversibility; `020`–`024` fleet read-time evaluation; `030`–`035` shell non-change and no-flip; `040`–`042` windows and holds documentation; `050`–`055` merge restoration and classification; `060`–`065` documentation deliverables (including the bounded lifecycle-prose reconciliation); `090`–`095` cross-cutting invariants. A new sequence appends at the end of its block; an ID is never reused for a different scenario. Every ID appears exactly once in §5.1, once in §5.2, and once in the §7 table — 46 in each.

### 5.1 Scenario Index

| TC ID | Title | Type | Impact | Priority | AC / NFR |
|---|---|---|---|---|---|
| TC-ENGINE-001 | Clean accrual equals corroboration.satisfied and the streak is the trailing run | Happy Path | Critical | Critical | AC-F1-1, AC-F1-2; F-1; DM-1; DEC-3; SC-M2-S16-02 |
| TC-ENGINE-002 | Accrual walk: counted +1, clean +1, first-appearance coverage growth, streak reset | Happy Path | Critical | Critical | AC-F1-1, AC-F8-13; F-1; DEC-3; SC-M2-S16-02 |
| TC-ENGINE-003 | The four conditions are one shape in one declared order with no detail | Contract | Critical | Critical | AC-F1-1; F-1; DM-1, DM-3; DEC-2; SC-M2-S16-01 |
| TC-ENGINE-004 | The open set equals unmetConditions in order on every fixture family | Corner Case | Critical | Critical | AC-F1-2; F-1; DM-3; NFR-4, NFR-10; DEC-2 |
| TC-ENGINE-005 | Summary delivered key order preserved; appended keys; truncation stays last | Regression | Critical | Critical | AC-F1-1; F-1; DM-1; NFR-1; DEC-9 |
| TC-ENGINE-006 | Summary text gains three lines in position; truncation line stays last; golden extended deliberately | Happy Path | Critical | High | AC-F1-2; F-1; DM-1; NFR-1; DEC-3 |
| TC-ENGINE-010 | Handover conditions present on every evidence-reading outcome; the revert noop is a declared absence that is not refused by a torn attempts/divergences ledger | Contract | Critical | Critical | AC-F2-3; F-2; DM-2, DM-3; NFR-4, NFR-11; DEC-2, DEC-12; SC-M2-S16-01 |
| TC-ENGINE-011 | reversible truth table: flip true, flip noop true, refusal false, revert false, revert noop false; the recorded revert refuses under a torn attempts ledger | Happy Path | Critical | Critical | AC-F2-3, AC-F2-4; F-2; DM-2; NFR-4, NFR-11; DEC-4, DEC-12; SC-M2-S16-03 |
| TC-ENGINE-012 | Reversal record shape unchanged, replay appends no duplicate, history preserved, the noop appends nothing | Regression | Critical | Critical | AC-F2-4; F-2; DM-2; NFR-11; DEC-4, DEC-12; NG-9 |
| TC-ENGINE-013 | Per-repository isolation: flipping alpha leaves beta's gate data and authority untouched | Corner Case | Critical | Critical | AC-F2-4; F-2; NFR-7; DEC-4 |
| TC-ENGINE-014 | Truncation iff verdict unverifiable; no condition status is ever unverifiable; the recorded revert refuses under a torn attempts ledger while the noop answers | Negative | Critical | Critical | AC-F2-3, AC-F2-4; F-2; DM-2; NFR-4, NFR-11; DEC-2, DEC-12 |
| TC-ENGINE-015 | Handover text output is unchanged: the addition is data-only | Regression | Important | High | AC-F2-3; F-2; DM-2; NFR-1; DEC-9 |
| TC-ENGINE-016 | Handover delivered key order preserved on the non-exempt outcomes; conditions then reversible appended; truncation last | Regression | Critical | Critical | AC-F2-3; F-2; DM-2; NFR-1, NFR-11; DEC-9, DEC-12 |
| TC-ENGINE-017 | The revert noop over an unreadable or torn handover ledger is refused `dispatch.state-unverified` at its declared exit 2 with no data and no record | Negative | Critical | Critical | AC-F2-3; F-2; DM-2; NFR-4, NFR-11; DEC-2, DEC-12; TDR-0031 D2 |
| TC-ENGINE-020 | Fleet row carries exactly seven ordered fields, bound to its own repository identity at the declared production scope; the block is declared; the text table is unchanged | Contract | Critical | Critical | AC-F3-5, AC-F3-6; F-3; DM-3, DM-4, DM-7; NFR-1, NFR-10, NFR-13; DEC-1, DEC-15, DEC-17; TDR-0031 D10, D11; SC-M2-S16-01 |
| TC-ENGINE-021 | The row's gate block agrees with the summary for the same ledger, excludes foreign repositories, and ignores controlled-scope records | Happy Path | Critical | Critical | AC-F3-5; F-3; DM-7; NFR-10, NFR-13; DEC-1, DEC-15, DEC-17; TDR-0031 D10, D11 |
| TC-ENGINE-022 | projects list --flat stays byte-identical, carries neither new field, and exposes no evidence-scope key | Regression | Critical | Critical | AC-F3-5; F-3; DM-4; NFR-1; DEC-1, DEC-17; ODR-0004 |
| TC-ENGINE-023 | Unreadable, torn, or unresolvable-identity reads fail the fleet read at exit 2 with no fabricated row | Negative | Critical | Critical | AC-F3-6; F-3; DM-4, DM-7; NFR-4, NFR-13; DEC-1, DEC-15; TDR-0031 D10 |
| TC-ENGINE-024 | Truncated ledger reports unverifiable plus the declared truncation contract over the visible window at exit 0 | Corner Case | Critical | Critical | AC-F3-6; F-3; DM-4, DM-7; NFR-2, NFR-4, NFR-13; DEC-1, DEC-15; TDR-0031 D10; TRUNC-ENG-1 |
| TC-ENGINE-030 | dual-run entry points print no pointer and exit 0 (delivered suite unmodified) | Regression | Critical | Critical | AC-F4-7; F-4; NFR-6; DEC-9 |
| TC-ENGINE-031 | authoritative entry points exit 0 and print the bounded pointer naming dispatch and --revert | Happy Path | Critical | Critical | AC-F4-7; F-4; NFR-6; DEC-4; SC-M2-S16-03 |
| TC-ENGINE-032 | The delivery summary keeps exactly five keys in the pinned order | Regression | Critical | Critical | AC-F4-7; F-4; NFR-6; DEC-9 |
| TC-ENGINE-033 | The fallback still decides with the typed CLI absent | Regression | Important | High | AC-F4-7; F-4; NFR-6 |
| TC-ENGINE-034 | stdout is byte-identical across authority states; the pointer is stderr-only and single-line | Corner Case | Critical | High | AC-F4-7; F-4; NFR-6; DEC-4 |
| TC-ENGINE-035 | No-flip discipline: only handover/revert write records; reads append nothing | Negative | Critical | Critical | AC-F4-8; F-4; NFR-7; DEC-6; AMB-ENG-3 |
| TC-ENGINE-040 | The hold and window effect-surface mapping is stated explicitly | Contract | Critical | High | AC-F5-9; F-5; NFR-8; DEC-5 |
| TC-ENGINE-041 | The lanes-read over-claim is removed, replaced, and declared as a known limitation | Negative | Critical | Critical | AC-F5-9; F-5; NFR-8; DEC-5; RSK-9 |
| TC-ENGINE-042 | No new window/hold read and no QueueLane.providerProfile, asserted as absences | Negative | Critical | High | AC-F5-9; F-5; NG-3, NG-4; DEC-5 |
| TC-ENGINE-050 | Production dry run over a real checkout: real reads, declared owner principal, delivered report, no fallback.internal | Happy Path | Critical | Critical | AC-F6-10; F-6; DM-5; DEC-8, DEC-13; TDR-0031 D8; NFR-9; AMB-ENG-5 |
| TC-ENGINE-051 | A failing gate is a classified refusal at exit 1 through the production composition | Happy Path | Critical | Critical | AC-F6-10; F-6, F-7; DEC-7, DEC-8 |
| TC-ENGINE-052 | A missing credential is classified config at exit 1, never fallback.internal at exit 2 | Negative | Critical | Critical | AC-F6-10, AC-F7-11; F-6, F-7; DM-5, DM-6; NFR-5, NFR-12; DEC-7, DEC-14; TDR-0031 D9 |
| TC-ENGINE-053 | Provider and state read faults stay classified by their declared rows and exits on every merge path | Negative | Critical | High | AC-F6-10, AC-F7-11; F-6, F-7; DM-5, DM-6; NFR-5, NFR-12; DEC-13, DEC-14; TDR-0031 D9 |
| TC-ENGINE-054 | Classification conformance is total and non-vacuous over MERGE_COMPOSITION_EMITTABLE_CODES | Contract | Critical | Critical | AC-F7-11; F-7; DM-5, DM-6; NFR-5, NFR-12; DEC-14; TDR-0031 D9; AMB-ENG-4 |
| TC-ENGINE-055 | verify deploy remains a declared residual, not a claimed capability | Regression | Important | High | AC-F6-10; F-6, F-8; RSK-8; NG-8 |
| TC-ENGINE-060 | The operator guide declares a redistributable marker and covers the four declared topics | Contract | Critical | Critical | AC-F8-12, AC-F4-8; F-8; NFR-8; DEC-10 |
| TC-ENGINE-061 | The six feature pages state the declared contracts and residuals, and the two broader test specs are handed to phase 7 | Contract | Critical | High | AC-F8-12; F-8; NFR-8; DEC-10, DEC-11, DEC-16, DEC-17 |
| TC-ENGINE-062 | The planning corpus carries the progress line, addendum, scenario row, and both restatements | Contract | Critical | Critical | AC-F8-12, AC-F8-13; F-8; NFR-8; DEC-10 |
| TC-ENGINE-063 | Each restatement is traced to story AC1/AC4 with no story AC weakened | Contract | Critical | High | AC-F8-13, AC-F4-8; F-8; DEC-10 |
| TC-ENGINE-064 | TDR-0031 lands with its index row and a resolvable bidirectional reference | Contract | Important | High | AC-F8-12; F-8; DEC-10 |
| TC-ENGINE-065 | The lifecycle prose names the engine as the regular path and the shell as the documented fallback, with the "retained primary entry points" claim gone | Contract | Critical | High | AC-F4-8, AC-F8-12; F-4, F-8; NFR-8; DEC-6, DEC-10 |
| TC-ENGINE-090 | Every touched payload stays additively stable; pinned suites extended by appending only | Regression | Critical | Critical | AC-NFR1-14; NFR-1; DEC-9 |
| TC-ENGINE-091 | No new command, verb, flag, configuration key, error row, DOMAIN_KINDS member, or exit class | Regression | Critical | Critical | AC-NFR1-14, AC-F6-10, AC-F7-11; NFR-5, NFR-12; DEC-9, DEC-13, DEC-14; TDR-0031 D9 |
| TC-ENGINE-092 | Hermeticity: zero live network, credential, model, or sleep in the delivering suites | Negative | Critical | Critical | AC-NFR1-14; NFR-9 |
| TC-ENGINE-093 | Two fleet reads over unchanged state are byte-identical; no wall-clock field, no unresolved identity, and no evidence-scope selector in the row | Corner Case | Critical | High | AC-F3-6; F-3; DM-7; NFR-3, NFR-10, NFR-13; DEC-1, DEC-15, DEC-17; TDR-0031 D10, D11 |
| TC-ENGINE-094 | The fleet read re-evaluates on every read and stays bounded; no cache, no write | Corner Case | Important | High | AC-NFR1-14; F-3; NFR-2; DEC-1; AMB-ENG-2 |
| TC-ENGINE-095 | Cross-surface coherence matrix: one ledger, three surfaces, identical statuses | Corner Case | Critical | Critical | AC-F1-2, AC-F3-5; F-1, F-2, F-3; NFR-4, NFR-10; DEC-2 |

### 5.2 Scenario Details

#### TC-ENGINE-001 - Clean accrual equals corroboration.satisfied and the streak is the trailing run

**Objective**: Make "clean" a stated identity and a trailing-run metric, so neither a dispatch count nor a longest-run metric can pass.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F1-1, AC-F1-2, F-1, DM-1, DEC-3; SC-M2-S16-02 (restated)
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-clean-accrual.test.ts` (new); command path via `tests/fixtures/dispatch/golden/harness.ts`, pure fold via `packages/core/src/domain/dispatch-gate.ts`
**Harness entry**: `bun test tests/behaviour/dispatch-clean-accrual.test.ts`
**Tags**: @backend, @behaviour

**Preconditions**:
- One temp state root per cell; the real ledger and the real classifier; no injected domain fakes.
- Fixture order is append order: `buildAttempts(specs)` is seeded sequentially, so the last counted attempt in the ledger is the last spec.
- Fixtures: (a) `eligibleSpecs()` (all clean, 20 counted across 7 days); (b) 18 eligible specs + one `failed` token + one clean tail; (c) 18 eligible specs + one `failed` token as the tail; (d) `uncorroboratedSpecs()`; (e) an empty window (no seed).

**Steps**:
1. For fixture (a): run `dispatch dual-run summary --repo github.com/owner/repo --json`; assert `data.cleanDispatches === data.corroboration.satisfied` and that the number is strictly less than `data.countedDeliveries` (proving a dispatch count would fail).
2. For fixture (b): assert `data.consecutiveCleanDispatches === 1` — the streak is the trailing run, so the earlier clean prefix does not count.
3. For fixture (c): assert `data.consecutiveCleanDispatches === 0` while `data.cleanDispatches` is unchanged from (b) — the non-clean counted attempt breaks the streak but not the accrual.
4. For fixture (d): assert `data.cleanDispatches === data.corroboration.satisfied` and `data.consecutiveCleanDispatches === 0` (an uncorroborated success claim is counted, not clean).
5. For fixture (e): assert `data.countedDeliveries === 0`, `data.cleanDispatches === 0`, `data.consecutiveCleanDispatches === 0`, and `data.conditions` equals `[truth:met, coverage:open, floor:open, corroboration:met]`.
6. Unit slice: call the pure fold/evaluation directly over the same specs and assert the same three numbers, so the projection is proven over the producer and not only over the serializer.

**Expected Outcome**:
- `cleanDispatches` equals `corroboration.satisfied` in all five fixtures; `consecutiveCleanDispatches` is 1 / 0 / 0 / 0 for the trailing-run, broken-streak, uncorroborated, and empty fixtures respectively.
- No numeric coverage counter exists on the payload: assert `Object.hasOwn(data, "coverageCount")`, `"coverageDispatches"`, and `"coverageProgress"` are all `false`.

**Notes / Clarifications**:
- The trailing-run walk is delivery mechanism; the assertion is on the number for an explicitly ordered ledger, so a longest-run implementation fails fixture (b) and an all-time-success implementation fails fixture (c).

#### TC-ENGINE-002 - Accrual walk: counted +1, clean +1, first-appearance coverage growth, streak reset

**Objective**: Deliver the restated `SC-M2-S16-02` as an observable walk: each counted dispatch adds one counted delivery, each corroborated dispatch adds one clean dispatch, coverage grows only on first appearance, and a non-clean dispatch resets the streak without reducing accrual.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F1-1, AC-F8-13, F-1, DEC-3; SC-M2-S16-02 (restated)
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-clean-accrual.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/dispatch-clean-accrual.test.ts --filter accrual-walk`
**Tags**: @backend, @behaviour

**Preconditions**:
- Empty state root; a fixed token sequence chosen so the first three dispatches repeat one success token and the fourth introduces a new token.
- Summary reads between appends; each append goes through the delivered ledger API with a successful result.

**Steps**:
1. Read the summary baseline: `countedDeliveries = 0`, `cleanDispatches = 0`, `consecutiveCleanDispatches = 0`, `coverage.present = []`.
2. Append one corroborated success claim; read the summary and assert `countedDeliveries` +1, `cleanDispatches` +1, `consecutiveCleanDispatches = 1`, and `coverage.present.length = 1`.
3. Append a second corroborated success claim with the **same** token; assert `countedDeliveries` +1, `cleanDispatches` +1, `consecutiveCleanDispatches = 2`, and `coverage.present.length` **unchanged** (first appearance only).
4. Append a third corroborated success claim with a **new** token; assert `coverage.present.length` +1 and `cleanDispatches` +1.
5. Append one counted success claim with unsatisfied corroboration; assert `countedDeliveries` +1, `cleanDispatches` unchanged, `consecutiveCleanDispatches = 0`, and `corroboration.unsatisfied = 1`.
6. Append one corroborated success claim; assert `consecutiveCleanDispatches = 1` (the streak restarts from the new tail) while `cleanDispatches` continues to grow.

**Expected Outcome**:
- Every delta is exactly as declared; coverage never grows by more than one per dispatch and never exceeds eleven overall (`coverage.present.length <= 11` asserted at the end).
- No derived coverage counter was added: the walk reads `coverage.present.length`, never a payload field.

#### TC-ENGINE-003 - The four conditions are one shape in one declared order with no detail

**Objective**: Pin the shared shape as data: four entries, the declared order, the closed status pair, exactly two keys per entry.
**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F1-1, F-1, DM-1, DM-3, DEC-2; SC-M2-S16-01
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-conditions-projection.test.ts` (new); contracts in `packages/core/src/contracts/dispatch.ts`, order authority in `packages/core/src/domain/dispatch-gate.ts`
**Harness entry**: `bun test tests/behaviour/dispatch-conditions-projection.test.ts --filter shape`
**Tags**: @backend, @contract

**Preconditions**:
- Two fixtures: an eligible window (`eligibleSpecs()`) and an ineligible window (`missingClassSpecs("merged")`).
- The declared order is read from the delivered `DISPATCH_HANDOVER_CONDITIONS` declaration, not transcribed.

**Steps**:
1. Read both summaries; assert `data.conditions` is an array of length exactly `4`.
2. Assert `data.conditions.map(entry => entry.condition)` deep-equals `[...DISPATCH_HANDOVER_CONDITIONS]` (which must be `["truth","coverage","floor","corroboration"]`) — a single order authority, not a second prose order.
3. For every entry assert `Object.keys(entry)` equals exactly `["condition","status"]` in that order — no `detail`, no `unverifiable`-carrying extra field.
4. Assert every `status` is in `["met","open"]`; assert no entry has the string `"unverifiable"` anywhere in its values.
5. Assert the eligible fixture reads four `met` and the ineligible fixture reads `coverage: open` and `floor: open` with `truth: met` and `corroboration: met`.

**Expected Outcome**:
- One shape, one order, closed statuses, no detail; the contract declaration, not the test, is the order source.

#### TC-ENGINE-004 - The open set equals unmetConditions in order on every fixture family

**Objective**: Pin the invariant that makes the three readers safe: `open` conditions are exactly the unmet conditions, in the same order, on every window shape.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F1-2, F-1, DM-3, NFR-4, NFR-10, DEC-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-conditions-projection.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/dispatch-conditions-projection.test.ts --filter open-set`
**Tags**: @backend, @behaviour, @invariant

**Preconditions**:
- Six fixture families over the same command path: eligible; truth incident (a `falseSuccess` attempt); coverage missing (`missingClassSpecs`); floor missing (few gapped dates); corroboration unsatisfied (`uncorroboratedSpecs`); truncated (`gate: { max: 5 }` with an eleven-token ledger).
- The truncated family must return data (exit `0` for the summary), so the invariant is asserted on a data-returning unverifiable window too.

**Steps**:
1. For each fixture, read the summary and assert `data.conditions.filter(e => e.status === "open").map(e => e.condition)` deep-equals `data.unmetConditions.map(e => e.condition)`.
2. Assert the open set is strictly ordered relative to `DISPATCH_HANDOVER_CONDITIONS` (a subsequence), so a reordered pair fails.
3. For the truncated fixture, assert `data.verdict === "unverifiable"`, `data.truncation` is present, and the open set still equals `unmetConditions` (statuses are explicitly "over the visible window").
4. Assert `unmetConditions` entries keep the delivered `{condition, detail}` shape (detail still lives there, never in `conditions`).
5. Anti-vacuity: assert at least one fixture has a **non-empty** open set and at least one has an empty open set, so an implementation returning four `met` always fails.

**Expected Outcome**:
- Set equality and order equality on all six families; the invariant holds under truncation without a third status.

#### TC-ENGINE-005 - Summary delivered key order preserved; appended keys; truncation stays last

**Objective**: Extend the delivered additive-stability pin by appending only, so no delivered key moves.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F1-1, F-1, DM-1, NFR-1, DEC-9
**Test Type(s)**: Contract, Regression
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-additive-stability.test.ts` (delivered summary case at lines 52-85, extended)
**Harness entry**: `bun test tests/behaviour/dispatch-additive-stability.test.ts --filter summary`
**Tags**: @backend, @regression

**Preconditions**:
- The delivered summary case keeps its sixteen-key expectation unchanged as a prefix.
- Two variants: an untruncated window and a truncated one (`gate: { max: 5 }`).

**Steps**:
1. Assert `Object.keys(data)` deep-equals the delivered sixteen keys **exactly as delivered** (no ressorting) followed by `cleanDispatches`, `consecutiveCleanDispatches`, `conditions`.
2. For the truncated variant assert the same list plus `truncation` as the **last** element, and assert `data.truncation` has exactly `["bound","omittedRecords"]`.
3. Assert no delivered key was renamed or re-typed: `typeof data.countedDeliveries === "number"`, `Array.isArray(data.unmetConditions)`, `typeof data.floor === "object"`.
4. Assert the delivered `null`-free optional behaviour: in the untruncated variant `Object.hasOwn(data, "truncation") === false` (absent, not `undefined`-valued).

**Expected Outcome**:
- Appended-only; `truncation` last; the delivered prefix byte-for-byte in order.

#### TC-ENGINE-006 - Summary text gains three lines in position; truncation line stays last; golden extended deliberately

**Objective**: Pin the human projection: the three new lines exist in exactly one place, and the truncation line is still last.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-2, F-1, DM-1, NFR-1, DEC-3
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/dispatch-summary.test.ts` (delivered) + `tests/fixtures/dispatch/golden/summary.txt` (regenerated deliberately once)
**Harness entry**: `bun test tests/golden/dispatch-summary.test.ts`
**Tags**: @backend, @golden

**Preconditions**:
- The delivered golden fixture (eligible window with one divergence) is regenerated once for this change; the regeneration diff must show only the three additive lines.
- A second, in-memory assertion covers the truncated case where no golden exists.

**Steps**:
1. Assert the rendered text equals the committed golden byte-for-byte.
2. Assert the line sequence contains `unmet_conditions=...`, then `clean_dispatches=<n>`, then `consecutive_clean_dispatches=<n>`, then `conditions=truth:<status>,coverage:<status>,floor:<status>,corroboration:<status>` — in that order, with no intervening line.
3. Assert `conditions=` renders exactly four `name:status` pairs joined by `,` in the declared order (a regex with the full expected literal per fixture).
4. In the truncated cell, assert the truncation line is the final line and follows the three new lines.
5. Assert the delivered lines are unchanged in content and order (`floor_only=true`, `floor_rule=...`, `eligibility=`, `verdict=`, `unmet_conditions=`).

**Expected Outcome**:
- Three additive lines in the declared position; truncation last; the delivered text lines untouched.

#### TC-ENGINE-010 - Handover conditions present on every evidence-reading outcome; the revert noop is a declared absence that is not refused by a torn attempts/divergences ledger

**Objective**: Prove the narrowed promise in both directions — four conditions on every outcome that performs the gate evidence read, and the single declared exemption answered as data with the keys *absent* — while the noop keeps answering when the **attempts or divergences** ledger is torn or unreadable. The mirror cell (a corrupt **handover** ledger refusing the noop) belongs to `TC-ENGINE-017`, because the exemption is scoped to the gate evidence read and never to the folded-handover read that establishes the noop.
**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F2-3; F-2; DM-2, DM-3; NFR-4, NFR-11; DEC-2, DEC-12; SC-M2-S16-01
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-handover-conditions.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/dispatch-handover-conditions.test.ts`
**Tags**: @backend, @behaviour

**Preconditions**:
- Controlled composition over the real state store with a met gate (`eligibleSpecs`), a clean refusal (`missingClassSpecs`), a truncated gate (`gate: { max: 5 }`), and a repository with no evidence.
- Five outcomes produced in one suite: recorded flip, idempotent flip noop, clean refusal, recorded revert, and revert noop on an already-`dual-run` repository (plus a second noop cell on a repository with no handover record).
- A torn-ledger cell reusing the revert noop over an attempts ledger with a torn final record, and an unreadable divergences ledger (Appendix E.1's last row).

**Steps**:
1. For each of the four **evidence-reading** outcomes (recorded flip, idempotent flip noop, clean refusal, recorded revert), assert `data.conditions` is present with exactly four entries in `DISPATCH_HANDOVER_CONDITIONS` order, each `{condition, status}` only.
2. Assert `data.reversible` is a boolean on all five outcomes (values are pinned by `TC-ENGINE-011`).
3. Assert `data.unmetConditions` is present **iff** the outcome is a refusal, and keeps `{condition, detail}`.
4. Assert `data.verdict` is present on the four evidence-reading outcomes — including the recorded revert, which previously omitted it — and that `data.truncation` is present iff `verdict === "unverifiable"`; assert the truncated cell's `conditions` are four entries computed over the visible window.
5. Exemption cell (`--revert` on an already-`dual-run` repository, and again on a repository with no handover record): assert exit `0`, `data` returned, `recorded: false`, `noop: true`, `operation: "dual-run"`, `reversible: false`, and assert the **absence set** explicitly — `Object.hasOwn(data, "conditions") === false`, `Object.hasOwn(data, "verdict") === false`, `Object.hasOwn(data, "truncation") === false` — each failing with the offending key named (absent means no key: not `null`, not an empty array, not `Noop`).
6. Torn-ledger cell: with the torn attempts ledger, and separately with an unreadable divergences ledger, assert the revert noop still exits `0` with the same five declared values and no record appended — the exemption is not refused by the readability of the attempts or divergences ledger (the handover ledger is intact in this cell; the corrupt-handover cell is `TC-ENGINE-017`).
7. Assert no `status` value is `unverifiable` in any outcome, and assert exactly one of the five outcomes omits `conditions` (the exemption is bounded to one; a second omission fails naming the outcome).

**Expected Outcome**:
- Four conditions on the four evidence-reading outcomes; the exemption carried as three declared absences plus the four declared values; the noop answers at exit `0` under a torn or unreadable attempts/divergences ledger; `unmetConditions` refusal-only; no third status.

**Notes / Clarifications**:
- The recorded-revert refusal under that same torn attempts ledger (exit `2`, `dispatch.state-unverified`, no record, flip intact) is asserted from the truncation side in `TC-ENGINE-014`; this case proves the other half of the asymmetry on the noop.
- The exemption covers exactly one outcome by declaration (NFR-11); it is never a precedent for a second evidence-read-free outcome. It is scoped to the attempts/divergences evidence read: `TC-ENGINE-017` proves the noop is still refused at exit `2` when the handover ledger itself is unreadable or torn, which is why this case must never be read as "the noop needs no ledger at all".

#### TC-ENGINE-011 - reversible truth table: flip true, flip noop true, refusal false, revert false, revert noop false; the recorded revert refuses under a torn attempts ledger

**Objective**: Pin the single derivation of reversibility by walking the authority through its five states (including the declared noop) and comparing to the authority document's `reversalAvailable`.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F2-3, AC-F2-4; F-2; DM-2; NFR-4, NFR-11; DEC-4, DEC-12; SC-M2-S16-03 (restated)
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-handover-conditions.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/dispatch-handover-conditions.test.ts --filter reversible`
**Tags**: @backend, @behaviour

**Preconditions**:
- Repository alpha seeded with `eligibleSpecs()`; repository beta seeded with `missingClassSpecs("merged")` for the refusal cell.
- The authority document is read through the delivered `readDispatchAuthority` so the comparison is against the same derivation consumers read.
- A second alpha clone stands behind a torn attempts ledger for the recorded-revert refusal cell.

**Steps**:
1. Before any handover: assert `handover <alpha>` (which flips) returns `recorded: true`, `operation: "authoritative"`, `reversible: true`; assert the authority document for alpha now has `authority: "authoritative"` and `reversalAvailable: true`.
2. Replay `handover <alpha>`: assert `noop: true`, `recorded: false`, `reversible: true`; assert the document still says `reversalAvailable: true`.
3. `handover <beta>` (clean refusal): assert `recorded: false`, `noop: false`, `reversible: false`, `unmetConditions` non-empty; assert beta's authority document is still `dual-run` with `reversalAvailable: false`.
4. `handover <alpha> --revert`: assert `recorded: true`, `operation: "dual-run"`, `reversible: false`; assert the document is `dual-run` with `reversalAvailable: false`.
5. Replay the revert on the now-`dual-run` alpha: assert `noop: true`, `recorded: false`, `operation: "dual-run"`, `reversible: false`, and that the response carries no `conditions`, no `verdict`, and no `truncation` (the declared exemption); assert the document is unchanged (`dual-run`, `reversalAvailable: false`).
6. Torn-ledger pair: over the second alpha flipped and then read behind a torn attempts ledger, assert the *recorded* revert refuses `dispatch.state-unverified` at exit `2` with no `data`, no appended record, and the flip intact (`authority: "authoritative"`, `reversalAvailable: true`); assert the revert *noop* over that same torn attempts ledger still exits `0` with `reversible: false` (its corrupt-handover counterpart is `TC-ENGINE-017`).
7. For every data-returning step assert `data.reversible === (folded latest operation === "authoritative")` and, for the evidence-reading outcomes, `data.reversible === document.reversalAvailable` — one rule, two readers.

**Expected Outcome**:
- `true, true, false, false, false` in the declared order; the recorded revert refuses under a torn attempts ledger while the noop answers there; no second reversible rule; no evidence-reading surface disagrees with the document.

#### TC-ENGINE-012 - Reversal record shape unchanged, replay appends no duplicate, history preserved, the noop appends nothing

**Objective**: Prove the records did not grow and that replay is idempotent, so the new data keys never leaked into the durable shape.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F2-4; F-2; DM-2; NFR-11; DEC-4, DEC-12; NG-9
**Test Type(s)**: Integration, Regression
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-handover-conditions.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/dispatch-handover-conditions.test.ts --filter record-shape`
**Tags**: @backend, @regression

**Preconditions**:
- Fresh alpha seeded with `eligibleSpecs()`; the handover ledger is read with the delivered `readDispatchHandover`.

**Steps**:
1. Flip alpha, then revert it; assert the ledger holds exactly two records in append order with operations `authoritative`, `dual-run`.
2. For each record assert the key set equals the delivered `DispatchHandoverRecord` shape (schema, repository, operation, conditions, evidenceRefs, principal, recordedAt) — in particular **no** `reversible` and **no** top-level `status`/`met` key.
3. Assert `record.conditions` is still the delivered `handoverConditionsSnapshot` shape (verdict, windowStart, windowStartReason, countedDeliveries, coveragePresent, coverageMissing, incidents, unresolvedDivergences, floorMet, corroborationSatisfied) — the snapshot did not become the new `DispatchConditionStatus[]`.
4. Replay the revert; assert `noop: true`, `recorded: false`, `operation: "dual-run"`, the ledger still holds exactly two records (no third append), and the response carries no `conditions`, no `verdict`, and no `truncation` — the exemption leaves the durable shape and the readable payload untouched.
5. Assert both records still parse through the delivered reader (no schema bump) and that the reversal preserves history rather than deleting the flip.

**Expected Outcome**:
- Record shape unchanged; replay idempotent and carrying none of the additive keys; history preserved; the additive keys live only on the evidence-reading command data.

#### TC-ENGINE-013 - Per-repository isolation: flipping alpha leaves beta's gate data and authority untouched

**Objective**: Prove a flip and its reversal move exactly one repository, on both the decision surface and the durable authority.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F2-4, F-2, NFR-7, DEC-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-handover-conditions.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/dispatch-handover-conditions.test.ts --filter isolation`
**Tags**: @backend, @behaviour

**Preconditions**:
- One store holding alpha (`eligibleSpecs`) and beta (`missingClassSpecs("merged")`), both read through the same command path.
- Beta's summary, its handover data, its ledger record count, and its authority document bytes captured before the alpha flip.

**Steps**:
1. Capture beta's four observations.
2. Flip alpha; assert alpha is authoritative.
3. Re-read beta: assert the summary `conditions`, `cleanDispatches`, `verdict`, and `unmetConditions` are unchanged; assert `handover <beta>` still refuses with `reversible: false`; assert beta's ledger record count is unchanged; assert beta's authority document bytes are identical.
4. Revert alpha; re-read beta again and assert the same four observations are still identical.
5. Replay the revert on the now-`dual-run` alpha (the declared exemption): assert it exits `0` with no `conditions`, appends no record to alpha, and leaves beta's four observations and record count unchanged.
6. Assert the authority document for beta never carried alpha's repository key (no cross-write).

**Expected Outcome**:
- Beta is bit-for-bit unaffected by alpha's flip and revert; isolation holds on both the decision and the durable surfaces.

#### TC-ENGINE-014 - Truncation iff verdict unverifiable; no condition status is ever unverifiable; the recorded revert refuses under a torn attempts ledger while the noop answers

**Objective**: Keep unverifiability at window level, make both implications fail loudly, and pin the read-posture asymmetry the amendment declares: an unreadable attempts ledger refuses the *recorded* revert but never the *noop*.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F2-3, AC-F2-4; F-2; DM-2; NFR-4, NFR-11; DEC-2, DEC-12
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-handover-conditions.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/dispatch-handover-conditions.test.ts --filter truncation`
**Tags**: @backend, @behaviour, @invariant

**Preconditions**:
- Five handover cells: recorded flip (eligible), clean refusal (ineligible), recorded revert (after an eligible flip), a truncated read (`gate: { max: 5 }` over an eleven-token ledger), and a torn attempts ledger applied to two outcomes (a recorded revert on a flipped repository, and a revert noop on an already-`dual-run` repository).
- The delivered exit projection is unchanged (`verdict !== eligible && recorded !== true` ⇒ user-validation ⇒ exit `1`).

**Steps**:
1. Truncated cell: assert `data` is returned, `data.verdict === "unverifiable"`, `data.truncation` is present with `["bound","omittedRecords"]`, and `data.conditions` is four entries computed over the visible window.
2. Recorded-revert cell (untruncated): assert `data.verdict` is **present** and not `"unverifiable"` (the key is now populated on this outcome so the invariant is expressible there), `Object.hasOwn(data, "truncation") === false`, `data.conditions` is four entries, and `data.reversible === false`.
3. Non-truncated cells (flip, flip noop, refusal): assert `Object.hasOwn(data, "truncation") === false` — absent key, not a null value.
4. Assert both implications explicitly: `truncation present ⇒ verdict === "unverifiable"` and `verdict === "unverifiable" ⇒ truncation present`; assert the converse guard on the exemption cell, which carries no `verdict` and therefore must carry no `truncation`.
5. Exit codes and read posture: the truncated read exits `1` with data; flip and refusal keep their delivered exits; over the torn attempts ledger the **recorded revert** exits `2` with `dispatch.state-unverified`, **no** `data`, no record appended, and the authority document still `authoritative` with `reversalAvailable: true` (the prior flip stands — the declared TDR-0031 D4 residual); over that **same** torn attempts ledger the **revert noop** exits `0` with data and no `conditions`.
6. Assert no condition carries `"unverifiable"` and `data.eligibility` is the only eligibility signal beside `verdict` (assert `eligibility === false` under truncation).

**Expected Outcome**:
- The biconditional holds on every verdict-bearing surface; the verdict-less noop carries no truncation; unreadable attempts/divergences evidence never returns data on an evidence-reading outcome, while the declared noop still answers there; no third status.
- The mirror of this case — the noop refused when the **handover** ledger is corrupt — is `TC-ENGINE-017`; neither case may stand in for the other.

#### TC-ENGINE-015 - Handover text output is unchanged: the addition is data-only

**Objective**: Prove the change is data-only on the handover verb, so no consumer of the text form is surprised.
**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F2-3, F-2, DM-2, NFR-1, DEC-9
**Test Type(s)**: Regression
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-handover-conditions.test.ts` (new); renderer in `packages/cli/src/output/dispatch-text.ts`
**Harness entry**: `bun test tests/behaviour/dispatch-handover-conditions.test.ts --filter text`
**Tags**: @backend, @regression

**Preconditions**:
- Three text-mode invocations: a recorded flip, a clean refusal, and the idempotent revert noop on an already-`dual-run` repository, each rendered without `--json`.

**Steps**:
1. Assert the text output contains no `conditions=` and no `reversible=` line and no `clean_dispatches=` line — the spec adds text lines to the summary only.
2. Assert the rendered text equals the delivered renderer's form for the same operation/recorded/noop tuple (compare against `renderDispatchHandoverText` output built from the same data), so the addition is provably data-only.
3. Assert the noop cell's text equals the delivered renderer's output for `(operation: "dual-run", recorded: false, noop: true)` and names no condition — the exemption is invisible in text as well as absent in data.
4. Assert the exit code of each text invocation equals the exit code of its `--json` twin.

**Expected Outcome**:
- Handover text is byte-identical to the delivered renderer; only the JSON data grew.

#### TC-ENGINE-016 - Handover delivered key order preserved on the non-exempt outcomes; conditions then reversible appended; truncation last

**Objective**: Extend the delivered handover order pin without weakening it, and pin the exemption's key set so the absence cannot be implemented as a `null`-valued key.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F2-3; F-2; DM-2; NFR-1, NFR-11; DEC-9, DEC-12
**Test Type(s)**: Contract, Regression
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-additive-stability.test.ts` (delivered handover case at lines 136-157, extended)
**Harness entry**: `bun test tests/behaviour/dispatch-additive-stability.test.ts --filter handover`
**Tags**: @backend, @regression

**Preconditions**:
- The delivered expectation (`repository, operation, recorded, noop, verdict, unmetConditions`) stays as the prefix of the refusal cell.
- A truncated cell is added for the `truncation`-last position, and a noop cell for the exemption's key set.

**Steps**:
1. Refusal cell: assert `Object.keys(data)` deep-equals the delivered six keys followed by `conditions`, `reversible` — the delivered order preserved and extended by appending.
2. Flip cell: assert the same list **without** `unmetConditions` (still refusal-only) in the delivered relative position, i.e. `repository, operation, recorded, noop, verdict, conditions, reversible`.
3. Recorded-revert cell: assert the same key list as the flip cell (the recorded revert now carries `verdict`, so nothing moves) and that `reversible` follows `conditions`.
4. Truncated cell: assert `truncation` is the last key after `reversible`.
5. Noop cell: assert `Object.keys(data)` deep-equals exactly `["repository","operation","recorded","noop","reversible"]` — the three exempt keys are absent, not `null`-valued, and `reversible` is last.
6. Assert no delivered key moved: compare the prefix against the delivered literal array element by element, and assert `reversible` is the last required key in every non-truncated outcome.

**Expected Outcome**:
- Appended-only with `unmetConditions` still refusal-only; `truncation` last when present; the exemption's key set exactly five keys with no null placeholders.

#### TC-ENGINE-017 - The revert noop over an unreadable or torn handover ledger is refused `dispatch.state-unverified` at its declared exit 2 with no data and no record

**Objective**: Complete the read-order half of the declared exemption. The noop is answered without the gate evidence read but **after** the folded-handover read that establishes it, so a corrupt handover history refuses it — even while the attempts and divergences ledgers are perfectly readable. This is the mirror of `TC-ENGINE-014`: that case refuses the *recorded revert* when the attempts ledger is unreadable; this one refuses the *noop* when the handover ledger is. Together they make "the exemption skips exactly one read, and never the first one" a test result rather than a sentence in the spec.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F2-3; F-2; DM-2; NFR-4, NFR-11; DEC-2, DEC-12; TDR-0031 D2
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/dispatch-handover-conditions.test.ts` (new) — **plan phase 3** ("Handover conditions, the evidence-read-free revert noop, and per-repository reversibility"), so this case lands with `TC-ENGINE-010`..`016` and not in a later phase
**Harness entry**: `bun test tests/behaviour/dispatch-handover-conditions.test.ts --filter handover-ledger`
**Tags**: @backend, @behaviour, @invariant

**Preconditions**:
- Repository alpha seeded with `eligibleSpecs()` and read through the real ledger, then flipped to `authoritative` and reverted to `dual-run` through the delivered use cases, so a further `--revert` is the declared idempotent noop.
- Two corruption cells over that same store, each leaving the attempts and divergences ledgers **readable**: (i) the handover ledger carries a torn record — a handover entry whose kind or payload is malformed, which the delivered reader rejects as `state.store.torn` (the same corruption shape `TC-ENGINE-014` applies to the attempts ledger, written through the fixture layer rather than by hand-editing production JSON) — and (ii) the store's read fails outright for that invocation (the delivered `readRecords()`-failure port pattern of `tests/behaviour/action-store-boundary.test.ts:137-147`, which is what "unreadable" means at this seam).
- A readability witness for every corruption cell: `dispatch dual-run summary --repo <alpha> --json` over the same store still exits `0` with full evidence, which is what distinguishes this case from `TC-ENGINE-010` and proves the refusal is attributable to the handover ledger alone.
- An uncorrupted control over the same store, so a suite that fails everything cannot pass this case.

**Steps**:
1. Uncorrupted control: `dispatch handover <alpha> --revert --json` → exit `0`, `data` present, `recorded: false`, `noop: true`, `operation: "dual-run"`, `reversible: false`, and `Object.hasOwn(data, "conditions")`/`"verdict"`/`"truncation"` all `false` — the exemption exactly as `TC-ENGINE-010` pins it, so the corruption cells below are compared against a known-good noop.
2. Torn-handover cell: tear alpha's handover ledger (a malformed handover entry the delivered reader rejects as `state.store.torn`) and run the same invocation. Assert exit **`2`** and that `Object.hasOwn(data) === false` — no `data` key at all, not `{}`, not a partially formed noop payload, and no `recorded`/`noop`/`reversible` value to misread.
3. Assert the refusal's declared identity from the oracle rather than a literal: the envelope names `dispatch.state-unverified`, and the exit is derived as `projectExitCode(ERROR_TABLE["dispatch.state-unverified"].projectionClass)` = `2` (kind `dispatch`, category `platform`, projection `platform-provider`). A different code, an exit derived from a different row, or a bare message fails naming the identity.
4. Assert **no record was appended** and the durable state did not move: the handover ledger's bytes are identical before and after the refused invocation, the earlier `dual-run` revert record is intact, and the authority document is unchanged (`dual-run`, `reversalAvailable: false`).
5. Unreadable-handover cell: repeat steps 2–4 with the store read failing outright for that invocation. Assert the same exit `2`, the same `dispatch.state-unverified` identity, no `data`, and no record appended — 100% of noops refused on this path, which is the NFR-11 half the plan previously left unpinned.
6. Contrast cell (the diagnostic): with the attempts and divergences ledgers torn or unreadable and the **handover** ledger intact, the same invocation still exits `0` as a declared noop (`TC-ENGINE-010` step 6 re-asserted in one cell here); with the handover ledger corrupt and the evidence ledgers readable it exits `2` (step 2). The two cells differ only in which ledger is corrupt, so an implementation that drops the folded-handover read, hoists it below the noop branch, or fakes the noop from the authority document alone fails this step rather than passing it.

**Expected Outcome**:
- Clean control: exit `0`, the five declared values, the three declared absences.
- Torn or unreadable handover ledger: exit `2`, `dispatch.state-unverified`, no `data`, no record appended, durable state byte-identical — and the same invocation answers at exit `0` when only the attempts/divergences ledgers are corrupt.

**Notes / Clarifications**:
- This case is the test-plan counterpart of spec v1.3 (NFR-11, AC-F2-3, Appendix E.1): the exemption covers the gate's evidence read — attempts and divergences — and never the folded-handover read that decides whether the operation is a noop. The delivered `revertDispatchHandoverEvidence` already folds the handover ledger and returns `dispatch.state-unverified` before its noop branch; this case pins that order so it cannot be optimised away.
- The delivered `tests/behaviour/dispatch-handover.test.ts` (`TC-HAND-003`) exercises only the clean noop, so it stays unmodified and green; this cell is the missing one, added in the new suite.
- No case in this plan asserts exit `2` for a missing credential (§3.5, R-TP-11). The exit asserted here belongs to a state-read failure row whose declared projection is `platform-provider`, and it is *derived* from that row rather than transcribed.

#### TC-ENGINE-020 - Fleet row carries exactly seven ordered fields, bound to its own repository identity; the block is declared; the text table is unchanged

**Objective**: Pin the row contract **in order** (the delivered test compares sorted sets, which cannot catch a reorder), prove the evaluation is bound to the row's own resolved repository identity without opening an extra store, and prove the text table did not gain a column.
**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F3-5, AC-F3-6; F-3; DM-3, DM-4, DM-7; NFR-1, NFR-10, NFR-13; DEC-1, DEC-15, DEC-17; TDR-0031 D10, D11; SC-M2-S16-01
**Test Type(s)**: Contract, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/repos-list-contract.test.ts` (delivered shape case at lines 88-107, extended by appending; existing sorted-set assertion stays)
**Harness entry**: `bun test tests/behaviour/repos-list-contract.test.ts`
**Tags**: @backend, @contract

**Preconditions**:
- One host with two registered checkouts; one project whose state root is `ready` (seeded through the delivered ledger APIs) and one whose state root is absent (`first-use`).
- The `ready` checkout carries a resolvable identity: a persisted create-once binding recorded with its git common directory, or (in a second cell) only its configured remote; a foreign-repository record sits in the same store.
- The `repos` text table invocation and the `--json` invocation over the same host.

**Steps**:
1. Assert, **without sorting**, `Object.keys(entry)` deep-equals `["repoKey","root","stateLocation","daemonReachable","handoverState","reversible","handoverGate"]` for every row, and that `REPOS_ENTRY_FIELDS` equals the same array (the contract constant and the payload cannot drift).
2. Assert `Object.keys(entry.handoverGate)` deep-equals `["verdict","conditions","countedDeliveries","cleanDispatches"]` on an untruncated row and `[..., "truncation"]` on a truncated row.
3. Assert `handoverGate.verdict ∈ {"eligible","ineligible","unverifiable"}`, `handoverGate.conditions` is four entries in the declared order with `met|open`, and both numbers are numbers.
4. `first-use` row: assert the state directory is absent on disk, the row exists with `handoverGate.verdict === "ineligible"`, `countedDeliveries === 0`, `truth: met`, `corroboration: met`, `coverage: open`, `floor: open`, `reversible === false`, and that a host-root tree snapshot before/after the read is identical (AMB-ENG-1) — no store was opened and no directory appeared.
5. Binding: assert the `ready` row's `handoverGate.countedDeliveries`, `cleanDispatches`, and `conditions` are exactly those of the records whose `repository` equals the row's resolved `host/owner/name` identity, and that seeding/removing the foreign record in the same store changes none of them (the scope rule; the derivation is `TC-ENGINE-021`'s agreement half).
6. Non-persisting: assert the persisted identity binding file (when present) is byte-identical before and after the read, no new binding file appears, and no additional project store file is created — the row resolves read-only.
7. Evidence scope (DEC-17, TDR-0031 D11): seed one `controlled-proof` attempt (the `controlled` class) into the same store and re-read; assert the row's `countedDeliveries`, `cleanDispatches`, and `conditions` are unchanged (a `controlled` record is not folded), then seed one `pilot` attempt and assert `countedDeliveries` and `cleanDispatches` each advance by exactly one — the fold is the declared `production` scope, observed through its effect (SCOPE-ENG-1). Assert no `scope`, `evidenceScope`, or `evidenceClass` key exists on the row or the block.
8. Text table: assert the header is exactly `KEY  ROOT  STATE  DAEMON  HANDOVER`, each data row splits into exactly five cells, and two consecutive text runs are byte-identical.

**Expected Outcome**:
- Seven ordered fields; the block declared; the empty-window evaluation exact (including `reversible: false`); the evaluation bound to the row's own identity with the foreign record excluded and folded at the declared `production` scope (no controlled-scope record counted, no scope key); no binding write and no store-creation side effect; no sixth column.

#### TC-ENGINE-021 - The row's gate block agrees with the summary for the same ledger and excludes foreign repositories

**Objective**: Prove "one fact, one derivation" by comparing the fleet row and the summary over the same repository and ledger, and prove the row evaluated **its own** repository identity rather than the whole store.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F3-5; F-3; DM-7; NFR-10, NFR-13; DEC-1, DEC-15, DEC-17; TDR-0031 D10, D11
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/repos-handover-gate.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/repos-handover-gate.test.ts --filter agreement`
**Tags**: @backend, @behaviour

**Preconditions**:
- One registered project whose checkout identity resolves to `github.com/owner/<label>` — first cell through the persisted create-once binding, second cell through the normalized configured remote (`https://github.com/owner/<label>.git`) with the binding absent — with its state root seeded with a mixed ledger: corroborated successes, one uncorroborated success claim, one failure token, one `falseSuccess` incident, and one resolved divergence.
- Two foreign-repository records are seeded into the **same** store (a different `repository` field) so the scope rule is observable: the row must be a per-repository evaluation, not a whole-store count.
- The summary is invoked with the row's resolved repository string (`--repo github.com/owner/<label>`).

**Steps**:
1. Read `dispatch dual-run summary --repo <row repository> --json`; capture `verdict`, `conditions`, `countedDeliveries`, `cleanDispatches`.
2. Read `repos list --json`; select the row for that repo key and capture the same four facts from `handoverGate`.
3. Assert deep equality of `conditions` arrays (order included), equality of `verdict`, of `countedDeliveries`, and of `cleanDispatches`.
4. Assert the corroboration-honest identity survives the projection: the row's `cleanDispatches` equals the summary's `corroboration.satisfied` for the same ledger (the block carries no corroboration object, so this is the only way the identity is checkable from the fleet side).
5. Assert the scope rule: `handoverGate.countedDeliveries` equals the number of counted attempts for the row's own repository, so the two foreign records are excluded (a whole-store fold would report them); assert the same four facts still agree after appending a third foreign record, so the exclusion is a filter and not a fixed number.
6. Assert both identity-resolution cells (persisted binding, and binding-absent → normalized configured remote) produce the **same** row values for the same ledger — the declared resolution order, observed through the scope rule rather than by reading the resolver.
7. Assert `reversible` follows the folded authority: a row with no handover record reads `false`; after a flip seeded through the delivered ledger API it reads `true`.
8. Assert the shared evidence scope (DEC-17, TDR-0031 D11): append one `controlled-proof` attempt (the `controlled` class) to the same store and re-read both surfaces; assert the summary's and the row's `countedDeliveries`, `cleanDispatches`, `conditions`, and `verdict` are all unchanged, so the equality cannot come from one surface counting a scope the other ignores; then append one `pilot` attempt and assert both surfaces advance by exactly one and still agree. Assert neither surface exposes a `scope`/`evidenceScope` key.

**Expected Outcome**:
- Four-for-four agreement between the fleet row and the summary for the same repository; foreign records excluded under both resolution cells; `reversible` equals the fold; both surfaces fold the declared `production` scope and neither moves on a `controlled` record.

**Notes / Clarifications**:
- The binding source is declared (DEC-15, DM-7), so the fixture no longer guesses: it supplies the identity the delivered policy would resolve and asserts the *scope rule*, which fails any other binding (whole-store fold, repo key used as identity, or an extra store open — the last is caught by `TC-ENGINE-020`'s snapshot).

#### TC-ENGINE-022 - projects list --flat stays byte-identical and carries neither new field

**Objective**: Protect the retiring alias's byte promise and prove the new fields exist only on the `repos` row.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F3-5, F-3, DM-4, NFR-1, DEC-1, DEC-17, ODR-0004
**Test Type(s)**: Regression, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/projects-flat-alias.test.ts` (delivered golden comparison, extended with absence assertions); golden `tests/golden/fixtures/projects-flat-alias.json` unchanged
**Harness entry**: `bun test tests/behaviour/projects-flat-alias.test.ts`
**Tags**: @backend, @regression, @golden

**Preconditions**:
- The delivered alias fixture (two fixed keys, fixed roots, one revision) plus one `ready` row whose ledger carries a non-trivial gate result.

**Steps**:
1. Assert `projects list --flat --json` still equals the committed golden (BYTE-ENG-1) and exits `0`.
2. Deep-scan the flat payload for the keys `reversible` and `handoverGate` and assert both are absent at every depth.
3. Deep-scan for `cleanDispatches`, `consecutiveCleanDispatches`, and `conditions` and assert all three are absent from the flat payload.
4. Over the same host assert `repos list --json` **does** carry `reversible` and `handoverGate` on the matching row — the absence above is a projection difference, not an empty read.
5. Assert the flat payload's own declared field set is unchanged (`projects`, `hostIndexRevision`) and that `data.projects` was not renamed to `repos`.
6. Assert no evidence-scope selector leaks either way (DEC-17): the flat payload carries no `scope`, `evidenceScope`, or `evidenceClass` key at any depth, and over the same host the `repos` row carries none of them either while still folding the declared `production` scope — the declaration is not a payload field.

**Expected Outcome**:
- Golden bytes unchanged; neither new field leaks into the alias; no scope key or flag exists on either payload; the `repos` row proves the fields exist.

#### TC-ENGINE-023 - Unreadable, torn, or unresolvable-identity reads fail the fleet read at exit 2 with no fabricated row

**Objective**: Pin the declared failure behaviour, including the two halves that are easy to fake: **no row** must mean no data at all, and an unresolvable identity must fail rather than fold something else.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F3-6; F-3; DM-4, DM-7; NFR-4, NFR-13; DEC-1, DEC-15; TDR-0031 D10
**Test Type(s)**: Integration, Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/repos-handover-gate.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/repos-handover-gate.test.ts --filter unreadable`
**Tags**: @backend, @behaviour, @errors

**Preconditions**:
- Five fixtures over a host with two registered projects (one healthy, one degraded): (a) a torn attempt ledger (a truncated final line / a record failing the delivered framing-and-checksum verification), (b) an unreadable attempts ledger (mode `000`), (c) a malformed divergence ledger, (d) a `ready` checkout with **no** persisted binding and **no** configured VCS remote, and (e) a `ready` checkout whose persisted binding is malformed and whose remote is absent.
- A healthy control run over the same host before the degradation, to prove the failure is caused by the ledger or the identity and not the host.

**Steps**:
1. Control: `repos list --json` exits `0` and returns both rows.
2. For each degraded fixture: assert the exit is `2` and the error code is exactly `repos.state-unavailable` (the unresolvable-identity cells reuse the same delivered identity, never a new one).
3. Assert `envelope.data` is `undefined` (no fabricated row, no empty array presented as a result) and that no row for the degraded repository appears anywhere in stdout.
4. Assert the classified summary names the repository (evidence naming), not the healthy one; for the unresolvable cells, assert the summary names the checkout so an operator can act.
5. Assert the read wrote nothing: the host-root tree snapshot before/after is identical for every degraded fixture — in particular the unresolvable-identity cells create **no** binding file, so a read can never bind a repository.
6. Cross-witness: over the **same** degraded host, `projects list --flat --json` exits `0` and returns its rows unchanged — the production `projects` read does not pass through the `repos` projection, so the evaluation is hosted on the `repos` row only (D1's "and only the `repos` row").

**Expected Outcome**:
- `repos.state-unavailable` at exit `2` with no data for torn, unreadable, malformed, and unresolvable-identity cells; no binding written; flat alias unaffected.

#### TC-ENGINE-024 - Truncated ledger reports unverifiable plus the declared truncation contract over the visible window at exit 0

**Objective**: Prove a truncated read is not a failure, never pads the window, and reports the truncation **contract** rather than an incidental arithmetic: the bound is the delivered constant and the omission is positive and consistent with the seeded over-bound records — never a pinned literal that the repository filter can move (readiness F-9).
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F3-6; F-3; DM-4, DM-7; NFR-2, NFR-4, NFR-13; DEC-1, DEC-15; TDR-0031 D10; TRUNC-ENG-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/repos-handover-gate.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/repos-handover-gate.test.ts --filter truncated`
**Tags**: @backend, @behaviour, @perf

**Preconditions**:
- One registered project whose checkout identity resolves (persisted binding, else normalized configured remote), seeded with `seededIdentityBoundRecords = 5_005` counted attempts **for that identity** through the delivered append path (fixed past timestamps), so the bounded read keeps at most `bound = 5000`.
- Plus `foreignRecords = 1` record for a different repository in the **same** store. The read bounds the whole ledger **before** the row's repository filter, so the omission is a function of the store total, not of the row's counts: the case must never assume `5000`/`5`.
- `bound` is imported from the delivered `DISPATCH_MAX_ATTEMPT_RECORDS` constant rather than transcribed.
- A healthy second project as the control row; the fixture prints the seeded identity-bound count, the foreign count, the total, and elapsed milliseconds on construction.

**Steps**:
1. Run `repos list --json`; assert exit `0` and both rows present.
2. Assert `handoverGate.verdict === "unverifiable"` on the seeded row, and that `handoverGate.truncation` is **present**.
3. Assert the truncation **contract** explicitly (the assertion shape, no incidental literal):

   ```ts
   const t = row.handoverGate.truncation;
   expect(t).toBeDefined();
   expect(t.bound).toBe(DISPATCH_MAX_ATTEMPT_RECORDS);       // 5000, imported
   expect(Number.isInteger(t.omittedRecords)).toBe(true);
   expect(t.omittedRecords).toBeGreaterThan(0);               // a truncated read omits something
   expect(t.omittedRecords)
     .toBeGreaterThanOrEqual(seededIdentityBoundRecords - t.bound);   // ≥ 5 005 - 5000 = 5
   expect(t.omittedRecords)
     .toBeLessThanOrEqual(seededIdentityBoundRecords + foreignRecords - t.bound); // ≤ 6
   expect(row.handoverGate.countedDeliveries).toBeLessThanOrEqual(t.bound);
   expect(row.handoverGate.countedDeliveries).toBeLessThan(seededIdentityBoundRecords);
   ```

   No equality against `5` (or any other incidental value) appears: the envelope is the contract, and a fabricated, zero, or padded count fails it.
4. Assert `handoverGate.conditions` is four entries computed over the visible window (open set equals what the visible records imply — `truth` and `corroboration` met, coverage/floor per the seeded token mix).
5. Assert the truncation key is the **last** key of the block and the control row has no `truncation` key at all.
6. Assert the read wrote nothing (tree snapshot identical) and made zero transport calls (`harness.transportCalls` empty).
7. Assert the omission is derived from the read total, not from the row's filtered counts: remove the foreign record, re-read, and assert `bound` is unchanged, `verdict` is still `"unverifiable"`, `countedDeliveries` is unchanged, `omittedRecords` is still `> 0`, and `|omittedRecords_after − omittedRecords_before| <= foreignRecords` — never an equality that would re-encode the fixture's arithmetic.

**Expected Outcome**:
- Exit `0`; `verdict: "unverifiable"` with `truncation` carrying the **declared bound** and a **positive** omission inside the seeded envelope; visible-window conditions; no shadow count and no incidental literal; no fabrication, no write, no network.

**Notes / Clarifications**:
- The printed counts exist so a breach is diagnosable; they are never pass conditions, and the case must pass whether the foreign record is present or absent (TRUNC-ENG-1, R-TP-12).

#### TC-ENGINE-030 - dual-run entry points print no pointer and exit 0 (delivered suite unmodified)

**Objective**: Prove the non-change by running the delivered pin, not a copy of it.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F4-7, F-4, NFR-6, DEC-9
**Test Type(s)**: Regression, Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-dispatch-bash-fallback.sh` (delivered, unmodified) — `TC-BASH-001` and `TC-BASH-003`
**Harness entry**: `bash scripts/.tests/test-dispatch-bash-fallback.sh`
**Tags**: @shell, @regression

**Preconditions**:
- The repository working tree at the change's HEAD; no modification to the suite or to `scripts/lib/dispatch-authority.sh`.
- `git diff --name-only` (review, not a test) shows no diff to any of the five shell files; the plan records this as the non-change proof.

**Steps**:
1. Run the delivered suite; assert every registered case passes (`TC-BASH-001..009`), with a special eye on `TC-BASH-001` (dual-run: exit `0`, no pointer) and `TC-BASH-003` (absent or malformed view means dual-run).
2. Assert the suite file and `scripts/lib/dispatch-authority.sh` are byte-identical to the delivered versions (review-attested by the diff, and recorded in §10).
3. Cross-check that the four entry points are still executable (`test -x` on each).

**Expected Outcome**:
- Delivered behaviour unchanged; the suite is a control rather than a target.

#### TC-ENGINE-031 - authoritative entry points exit 0 and print the bounded pointer naming dispatch and --revert

**Objective**: Pin the pointer's content, destination, and boundedness while the verb stays usable.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F4-7, F-4, NFR-6, DEC-4; SC-M2-S16-03 (restated)
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-dispatch-bash-fallback.sh` (delivered, unmodified) — `TC-BASH-002`
**Harness entry**: `bash scripts/.tests/test-dispatch-bash-fallback.sh` (read the `TC-BASH-002` case result from the suite output; the suite takes no filter flag)
**Tags**: @shell, @behaviour

**Preconditions**:
- An `authoritative` authority document seeded in a temp per-repository state root for each of the four entry points.

**Steps**:
1. Assert each of the four entry points exits `0` when authoritative (the fallback never refuses because authority moved).
2. Assert stderr contains exactly one line matching `[deprecation]` and containing `engine-authoritative`, `dispatch <ref>`, and `dispatch handover <repo> --revert`.
3. Assert the pointer names both remediation paths (the forward command and the reversal) and that no stdout line contains `[deprecation]`.
4. Assert the pointer is bounded: one line, no payload, no evidence dump (length asserted against a printed ceiling).

**Expected Outcome**:
- Exit `0`, pointer on stderr only, both commands named, one line.

#### TC-ENGINE-032 - The delivery summary keeps exactly five keys in the pinned order

**Objective**: Hold the five-key tail by running the delivered key-order case rather than trusting a claim.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F4-7, F-4, NFR-6, DEC-9
**Test Type(s)**: Regression, Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-deliver-ticket.sh` (delivered, unmodified) — the summary key-order case pinned at line 724, the summary contract at line 666
**Harness entry**: `bash scripts/.tests/test-deliver-ticket.sh`
**Tags**: @shell, @regression

**Preconditions**:
- The delivered suite's mock loop (summary fixtures O-1..O-7) is used as delivered.

**Steps**:
1. Run the delivered suite; assert it passes in full, including the case asserting the key order string `result pr_url exit_code closeout_unverified last_message `.
2. Assert the suite's own assertion text is unmodified (review-attested diff) — no sixth key was added and no expected string was edited.
3. Assert the four summary-producing legs still print `closeout_unverified=yes|no` and that no additional `key=value` line is emitted after `last_message=`.

**Expected Outcome**:
- Five keys, pinned order, no sixth key, no extra line.

#### TC-ENGINE-033 - The fallback still decides with the typed CLI absent

**Objective**: Keep the CLI-independence promise: an absent or broken typed binary never changes the authority decision.
**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F4-7, F-4, NFR-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-dispatch-bash-fallback.sh` (delivered, unmodified) — `TC-BASH-004`, `TC-BASH-006`..`009`
**Harness entry**: `bash scripts/.tests/test-dispatch-bash-fallback.sh`
**Tags**: @shell, @regression

**Preconditions**:
- The delivered fake-binary seam (a marker file written if the typed CLI is ever invoked) and a `PATH` without it.

**Steps**:
1. Assert the authoritative cell still exits `0` and still prints the pointer with the typed CLI absent.
2. Assert the marker file was never created (the typed CLI is never invoked by the fallback).
3. Assert the override precedence cases (`TC-BASH-006`..`009`) still pass, including the project-root-vs-host-root rule.

**Expected Outcome**:
- Decision unchanged without the typed binary; the typed CLI is never invoked; precedence intact.

#### TC-ENGINE-034 - stdout is byte-identical across authority states; the pointer is stderr-only and single-line

**Objective**: Prove "no new stdout line" directly, which the delivered suites do not assert as a cross-state identity.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-7, F-4, NFR-6, DEC-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-engine-first-shell-parity.sh` (new); fixtures copied from the delivered suite's pattern (temp checkout, seeded authority document, `DISPATCH_REPOSITORY`)
**Harness entry**: `bash scripts/.tests/test-engine-first-shell-parity.sh`
**Tags**: @shell, @behaviour

**Preconditions**:
- One temp checkout whose `scripts/` is copied (so `ROOT_DIR` is the fixture), one seeded `dual-run` root and one seeded `authoritative` root, isolated `HOME`.
- The matrix is the four entry points × two authority states, run on the self-description path (`--help`), matching the delivered suite's cell shape.

**Steps**:
1. For each entry point run the cell in `dual-run` and in `authoritative`, capturing stdout and stderr separately; assert both exits are `0`.
2. Assert `stdout(authoritative)` is byte-identical to `stdout(dual-run)` (cmp).
3. Assert stdout contains no `[deprecation]` and no `engine-authoritative` in either state.
4. Assert stderr in `dual-run` contains no pointer and stderr in `authoritative` contains exactly one pointer line (line count after filtering).
5. Assert the script is executable and the suite itself writes only inside its temp root.

**Expected Outcome**:
- stdout parity across states; pointer stderr-only and single-line; both states exit `0`.

#### TC-ENGINE-035 - No-flip discipline: only handover/revert write records; reads append nothing

**Objective**: Turn "GH-293 flips nothing" into two falsifiable properties: the writer set is exactly the handover use case, and every read surface appends nothing.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F4-8, F-4, NFR-7, DEC-6; AMB-ENG-3
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/engine-first-no-flip.test.ts` (new)
**Harness entry**: `bun test tests/checks/engine-first-no-flip.test.ts`
**Tags**: @backend, @contract, @audit

**Preconditions**:
- The production source tree at the change's HEAD; a temp state root seeded with a mixed ledger and one handover record.
- The recorded writer function is `appendDispatchHandover` (the only function that appends `dispatch.handover` records).

**Steps**:
1. Source scan: over `packages/**/src/**/*.ts`, collect every call site of `appendDispatchHandover(`; assert the set equals the declared writers (the handover use case for flip and revert) and that no read path (`summary`, `repos`/`projects` read, `status`, `board`, `brief`) is in the set.
2. Behavioural: on the seeded store, run a summary read, a `repos list` read, and a handover replay (noop); assert the handover record count and the authority document bytes are unchanged after each.
3. Assert the fleet read never calls the flip helper: the same source scan asserts no import of the handover use case from the projects/repos read modules.
4. Audit footer: assert the case prints the records it observed (count before/after) so the review audit can quote it; the "no record attributable to this change in this repository" verdict is recorded in §10 by `@reviewer` from a state-root listing (AMB-ENG-3), never asserted here against a real root.

**Expected Outcome**:
- Writer set is exactly the handover/revert use case; reads append nothing; no cross-import; audit recorded out of band.

#### TC-ENGINE-040 - The hold and window effect-surface mapping is stated explicitly

**Objective**: Make "windows and holds are engine-visible data" a document assertion with resolved, non-empty spans on both rows of the mapping.
**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-9, F-5, NFR-8, DEC-5
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/engine-first-doc-reconciliation.test.ts` (new); page `doc/spec/features/feature-peak-pausing.md` (sections resolved by heading, whitespace-normalised)
**Harness entry**: `bun test tests/checks/engine-first-doc-reconciliation.test.ts --filter mapping`
**Tags**: @docs, @contract

**Preconditions**:
- The page's section headings resolve to non-empty spans (an empty or renamed heading is a failure, not a silent pass).
- Normalisation collapses whitespace so a line wrap cannot fail a token.

**Steps**:
1. Assert the mapping is present as a hold row and a window row (a table with both input conditions, or two labelled paragraphs).
2. Hold row tokens: `admission` refusal, `queue` blocking, `status.ownerHold`, board `ownerHold`.
3. Window row tokens: `status.laneParks`, `peak-window`, `until`, `preservation`, `peakEnforcement`, spend (`window-scoped` or equivalent declared phrase in the page's own vocabulary), and the `stop`/`parked` events.
4. Assert the page states that a declared window has **no read surface** (the absence is declared, not implied).
5. Assert the pages that consume the mapping cross-link it (`feature-dispatch-engine.md`, `feature-resident-daemon.md` name the same surfaces) so a reader reaches it from the composing feature.

**Expected Outcome**:
- Both rows present with every declared surface named; the no-read statement present; the span resolution guard active.

#### TC-ENGINE-041 - The lanes-read over-claim is removed, replaced, and declared as a known limitation

**Objective**: Correct the false contract instead of documenting around it, and prove the correction both ways (old claim gone, new statement present).
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F5-9, F-5, NFR-8, DEC-5, RSK-9
**Test Type(s)**: Contract, Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/engine-first-doc-reconciliation.test.ts` (new)
**Harness entry**: `bun test tests/checks/engine-first-doc-reconciliation.test.ts --filter over-claim`
**Tags**: @docs, @contract

**Preconditions**:
- The delivered sentence (the `feature-peak-pausing.md` §2 claim that the attempt-history read, the **lanes read**, and the records agree) is captured as the forbidden phrase, whitespace-normalised.
- The replacement surfaces are the spec's declared list.

**Steps**:
1. Assert the forbidden claim is absent: the page must not state that the lanes read agrees on / carries the nomination (fail naming the offending phrase and line).
2. Assert the replacement names the surfaces that do carry it: attempt history, daemon lane records, `status.laneParks`, board `PARKED`, and spend window evidence.
3. Assert a declared known limitation is stated for the lanes read (the profile blindness), with the words that make it discoverable (`known limitation` or equivalent declared phrase) and the consequence (a `lanes list` reader cannot attribute a running lane to a profile).
4. Assert the limitation is *not* framed as delivered capability: the page must not claim a lanes profile field exists.
5. Repeat the absence scan over the other reconciled pages (no page may re-introduce the lanes-nomination claim), and assert the scan actually inspected every page in its allowlist (non-empty file set).

**Expected Outcome**:
- Old claim gone and named when present; replacement present; limitation declared; scan allowlist non-vacuous.

#### TC-ENGINE-042 - No new window/hold read and no QueueLane.providerProfile, asserted as absences

**Objective**: Prove the change's negative scope mechanically: no new read verb and no new lane field.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F5-9, F-5, NG-3, NG-4, DEC-5
**Test Type(s)**: Contract, Regression
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/engine-first-doc-reconciliation.test.ts` (new, source half) + `tests/structure/dispatch-help-inventory.test.ts` and `tests/checks/help-guide-coverage.test.ts` (delivered, as controls) + `tests/golden/lanes-list.test.ts` (delivered golden, unchanged)
**Harness entry**: `bun test tests/checks/engine-first-doc-reconciliation.test.ts --filter absences`
**Tags**: @backend, @contract

**Preconditions**:
- The `QueueLane` contract source and the prompt-required command inventory as the two absence substrates.

**Steps**:
1. Assert `providerProfile` does not appear in `packages/core/src/contracts/queue.ts` and that the parsed `QueueLane` type's member set is unchanged (compare to a transcribed delivered member list).
2. Assert the prompt-required command set and the help inventory are unchanged (no `windows`, `holds`, `gate`, or equivalent verb added) by running the delivered coverage check as a control.
3. Assert the `lanes` golden payload is unchanged (delivered `tests/golden/lanes-list.test.ts` passes unmodified) and that `lanes --json` rows carry no `providerProfile`.
4. Assert no new read surface is documented as existing: the page names the absence rather than a command.

**Expected Outcome**:
- Both absences hold and are named when violated; the delivered controls pass unmodified.

#### TC-ENGINE-050 - Production dry run over a real checkout: real reads, declared owner principal, delivered report, no fallback.internal

**Objective**: Prove the merge transaction is reachable in the shipped composition with real reads over injected transports, and that the owner principal comes from the declared identity source rather than a new setting.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F6-10; F-6; DM-5; DEC-8, DEC-13; TDR-0031 D8; NFR-9; AMB-ENG-5
**Test Type(s)**: Integration, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (new); `createProductionComposer` over a real temp git checkout
**Harness entry**: `bun test tests/behaviour/merge-production-composition.test.ts`
**Tags**: @backend, @behaviour, @composition

**Preconditions**:
- A real temp checkout (`createRepository` + a feature commit on a branch, with `main-tools` as the base branch present locally), a distinct `HOME`, and the approved state base under `tmp/tmpdir`.
- The checkout's normalized identity resolves to `github.com/<owner>/<label>` through the delivered identity policy, so the declared owner principal is `<owner>`; the fixture never supplies a principal through a configuration key.
- Injected seams: a recording GitHub transport returning a work item, a check-run page for the head sha, and a request detail whose head sha is the branch head; a resolving credential port; the environment deliberately contains **no** `GITHUB_TOKEN`, so a real credential read would fail.
- The no-network guard installed for the duration (`createNoNetworkGuard`).

**Steps**:
1. Run `merge <ref> --dry-run --json` through the composed production program; assert exit `0` and `data.result === "verified"`.
2. Assert the delivered report shape: `data.headSha` equals the branch head; `data` has no `squashSha` and no `transactions`; stdout in text mode contains no `result=merged`.
3. Assert exactly one verification record was appended and zero transaction records and zero waiver records (`readMergeGateVerifications`/`readMergeTransactions`/`readMergeWaivers`).
4. Assert the real reads happened through the injected transport: the recorded call list contains the work-item read, the check-run read, and the request-detail read; assert the credential port was consulted at least once.
5. Assert `guard.calls` is empty (zero live network) and that no response payload body was logged (privacy posture unchanged).
6. Owner principal (DEC-13, AMB-ENG-5): run a dry run with `--waive owner-gate --waived-by <owner>` in a fixture where the owner label is present; assert `waiver=owner-gate:authorized` in text mode and zero waiver records. Then run the same waiver with any other principal (a different owner string, including the repository **name** and a bare ref) and assert `merge.waiver-unauthorized` at exit `1` with zero waiver records.
7. No new configuration key: assert the resolved `merge` configuration exposes exactly `gate-freshness`, `gates`, and `deploy-expectations` (no owner-principal, branch, or base-reference key), and assert the step-6 authorization result is unchanged when `gates` and `deploy-expectations` are overridden — the principal comes from the checkout's identity, not from configuration.

**Expected Outcome**:
- Delivered dry-run report at exit `0`; one verification record; zero landing mutations; real reads observed; zero live calls; the principal resolved from the checkout identity and observable through the waiver effect; the three declared configuration keys unchanged.

**Notes / Clarifications**:
- If the composition cannot resolve a request for a ref, that path is `TC-ENGINE-053`'s business; this case uses a fixture where it resolves.
- The principal is asserted through its effect (authorized vs `merge.waiver-unauthorized`) because reading the resolved value directly would test the identity resolver rather than the composition's use of it (AMB-ENG-5).
- **Exit projection (guard against re-encoding the defect):** this case asserts only the exits of its own cells — the delivered report at exit `0` and the `merge.waiver-unauthorized` refusal at exit `1`. The refusing-credential cell is `TC-ENGINE-052`'s, and it asserts `config.credential.missing` at exit `1` (`user-validation`), never `fallback.internal` at exit `2`. No cell here (and none anywhere in this plan) asserts exit `2` for a missing credential (R-TP-11). The injected resolving credential port is what keeps this case off that path.

#### TC-ENGINE-051 - A failing gate is a classified refusal at exit 1 through the production composition

**Objective**: Prove the failure path is a *classified gate refusal* naming the gate, not an internal fallback and not a silent pass.
**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F6-10, F-6, F-7, DEC-7, DEC-8
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/merge-production-composition.test.ts --filter gate-refusal`
**Tags**: @backend, @behaviour, @errors

**Preconditions**:
- Same composition as `TC-ENGINE-050`; the transport returns a required check-run in `failed` state (or a work item whose labels make the owner gate fail).
- The declared gate registry defaults (no `merge.gates` override) so the failing id is a declared gate.

**Steps**:
1. Run `merge <ref> --dry-run --json`; assert exit `1`.
2. Assert `envelope.error.code` matches the declared family `merge.gate.<gate-id>.failed` for the failing gate id, and that the row resolves (`kind: "merge"`, declared category/projection class) — never `fallback.internal`; assert the observed exit equals `projectExitCode(row.projectionClass)` (`1`).
3. Assert exactly one verification record was appended (the failure is recorded evidence), zero transaction records, zero waivers.
4. Assert the text form names the condition and carries a remediation hint (no bare exit).
5. Assert `guard.calls` is empty.

**Expected Outcome**:
- Exit `1`, declared gate identity, one record, zero landing, no live call, no `fallback.internal`.

#### TC-ENGINE-052 - A missing credential is classified config at exit 1, never fallback.internal at exit 2

**Objective**: Pin the exact defect this change repairs — the kind *and the exit* come from the resolved row, so the containment that hid the cause cannot happen. The declared refusal is `config.credential.missing` (`domainKind: config`, projection class `user-validation` → exit `1`); `fallback.internal` (`platform-provider` → exit `2`) is the repaired defect's signature and is asserted **absent** (readiness F-2, R-TP-11).
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F6-10, AC-F7-11; F-6, F-7; DM-5, DM-6; NFR-5, NFR-12; DEC-7, DEC-14; TDR-0031 D9
**Test Type(s)**: Integration, Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/merge-production-composition.test.ts --filter credential`
**Tags**: @backend, @errors, @regression

**Preconditions**:
- Production composition with a credential port that returns `{ ok: false, code: "config.credential.missing", domainKind: "config", … }` (the delivered refusal shape) and no `GITHUB_TOKEN` in the environment.
- An empty state root, so a record count of zero is meaningful.
- The delivered oracles: `ERROR_TABLE` (the row's `domainKind` **and** `projectionClass`) and the delivered projection map (`projectExitCode`), read — never transcribed.

**Steps**:
1. Run `merge <ref> --dry-run --json`; assert exit **`1`**.
2. Assert the exit is the row's declared projection, not a chosen literal: look up `config.credential.missing` in `ERROR_TABLE`, assert `projectionClass === "user-validation"`, assert `projectExitCode(row.projectionClass) === 1`, and assert the observed process exit equals that derived value.
3. Assert `envelope.error.kind === "config"` and `envelope.error.code === "config.credential.missing"`.
4. **Negative assertion (the defect's signature must be absent):** assert the process exit is **not** `2`; assert the code is **not** `fallback.internal`; and deep-scan the serialized envelope (and the classified summary, stdout, and stderr) for the string `fallback.internal` and assert **zero** occurrences. This is the assertion that fails if the composition re-hard-codes `provider` and the classifier contains the pair again.
5. Assert the same classified refusal at exit `1` on **every** invocation cell of this path — `--dry-run --json`, `--dry-run` (text), `--json` without `--dry-run`, and the bare `merge <ref>` — so a fix applied to one cell cannot pass; each cell asserts `kind: "config"`, `code: "config.credential.missing"`, exit `1`, and zero `fallback.internal` occurrences.
6. Assert the classified summary names the credential reference (evidence) so an operator can act, and that no body/secret text is logged.
7. Assert zero verification records, zero transactions, zero waivers and zero transport calls (the read was refused before any request left the process).
8. Assert the code is a member of the composition's exported `MERGE_COMPOSITION_EMITTABLE_CODES`, so the credential branch is inside the declaration the conformance case ranges over (a refusal branch outside the constant is the declared conformance failure).

**Expected Outcome**:
- `kind: "config"` at **exit `1`** — the exit its declared `user-validation` projection already maps to — with zero occurrences of `fallback.internal` and no exit `2` on any cell of the path; zero records; zero network; the error table and the projection map are the oracles.

**Notes / Clarifications**:
- **The assertion shape, stated once:** `code === "config.credential.missing"` ∧ `kind === ERROR_TABLE[code].domainKind` (`"config"`) ∧ `exit === projectExitCode(ERROR_TABLE[code].projectionClass)` (`1`) ∧ `exit !== 2` ∧ `serializedEnvelope`+`stdout`+`stderr` contain zero `fallback.internal`. The old expectation (exit `2` "for the `config` row's projection class") was the mis-projection this revision removes: `user-validation` maps to `1`, and only `platform-provider` — `fallback.internal` — maps to `2`.
- Do not "fix" this by special-casing an exit class: NG-7 and NFR-5 forbid a new exit class, and the projection map is unchanged. The change moves one observable `2 → 1` by restoring the declared row's projection.

#### TC-ENGINE-053 - Provider and state read faults stay classified by their declared rows on every merge path

**Objective**: Extend classification faithfulness beyond the credential case to the other read failures and to the non-dry-run path.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F6-10, AC-F7-11; F-6, F-7; DM-5, DM-6; NFR-5, NFR-12; DEC-13, DEC-14; TDR-0031 D9
**Test Type(s)**: Integration, Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/merge-production-composition.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/merge-production-composition.test.ts --filter read-faults`
**Tags**: @backend, @errors

**Preconditions**:
- A matrix over the composition: (a) transport returns a 5xx (`provider.outage`), (b) transport returns 401 (`provider.auth.rejected`), (c) the state store append fails (`state.*`), (d) a stale verification envelope (`merge.gates-stale`), (e) a ref whose request detail does not resolve, each on both the dry-run and the landing path where applicable.
- The error-table row for each code is read as the oracle, and `MERGE_COMPOSITION_EMITTABLE_CODES` is read as the membership oracle.

**Steps**:
1. For each fault, run the composed command (`--dry-run` and, where landing is meaningful, without it); assert the exit equals **`projectExitCode(ERROR_TABLE[code].projectionClass)`** — derived from the delivered map, never a literal. For any `config.*` code the expected exit is therefore `1` (`user-validation`); no cell in this matrix expects exit `2` for a config code (exit `2` belongs to `platform-provider`, i.e. `fallback.internal`).
2. Assert `envelope.error.kind` equals the row's `domainKind` and `envelope.error.code` equals the code.
3. Assert no envelope carries `fallback.internal` for any fault.
4. Assert the landing-path faults append no transaction record (no partial landing) and the dry-run faults append at most the delivered verification behaviour.
5. Assert `guard.calls` is empty for every cell.
6. Assert every emitted code in this matrix is a member of `MERGE_COMPOSITION_EMITTABLE_CODES`; for the non-resolving-ref cell, assert the composition emits a code the table already declares (a declared refusal expressed through an existing identity) rather than inventing one — a code outside the constant, or absent from the table, fails here naming both.

**Expected Outcome**:
- Every fault classified by its declared row at its declared exit on both paths; no containment; no partial landing.

#### TC-ENGINE-054 - Classification conformance is total and non-vacuous over MERGE_COMPOSITION_EMITTABLE_CODES

**Objective**: Make classification totality a property test over the composition's **exported declaration** — every refusal branch contributes its code, so the test's domain is the composition rather than a hand-picked list, and an empty or one-family enumeration cannot pass.
**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F7-11; F-7; DM-5, DM-6; NFR-5, NFR-12; DEC-7, DEC-14; TDR-0031 D9; AMB-ENG-4
**Test Type(s)**: Contract, Unit
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/merge-classification-conformance.test.ts` (new); declaration exported by the production merge composition; oracles `packages/core/src/contracts/error-table.ts`, `packages/cli/src/classify.ts`
**Harness entry**: `bun test tests/structure/merge-classification-conformance.test.ts`
**Tags**: @backend, @contract

**Preconditions**:
- `MERGE_COMPOSITION_EMITTABLE_CODES` imported from the production composition module (never from a test fixture or a transcribed list); the case fails naming the missing export if delivery does not publish it.
- The delivered `resolveAppErrorCode`/`classifyDomainKind`/`classifyThrown` and the delivered `ERROR_TABLE`.

**Steps**:
1. Structural: assert the constant is a non-empty collection of string codes with no duplicates, and that it carries at least one `config.*`, one `provider.*`, one `state.*`, and one `merge.*` member — the anti-vacuity guard (an empty, single-entry, or single-family list fails naming the missing family).
2. Totality: for every member assert `resolveAppErrorCode(code)` resolves to a declared row, so no member is absent from the table.
3. Kind agreement: for every member assert the kind the composition emits for that code — read from the composition's export for that code, not from a transcribed literal — equals the resolved row's declared `domainKind`.
4. Classifier agreement: for every member assert `classifyThrown({ kind: row.domainKind, code })` returns that row and `.code === code`, so no member is contained.
5. Negative control is live: `classifyThrown({ kind: "provider", code: "config.credential.missing" })` returns `fallback.internal` — the containment exists, and the *composition* is what must not produce the wrong pair (so a pass cannot be vacuous). This control asserts the **classifier's** behaviour on a deliberately contradictory pair; it is never an assertion that the composition refuses a missing credential at exit `2`. No case in this plan asserts exit `2` for a missing credential, and the composition's own cell is `TC-ENGINE-052` (exit `1`).
6. No vocabulary growth: compare the resolved rows against the delivered table snapshot and assert the per-kind row counts, `DOMAIN_KINDS` membership, and exit classes are unchanged.
7. Exhaustive by construction: source-scan the production composition and assert every refusal site that emits an error code references a member of the constant (directly or through a helper typed by it), so a branch added outside the declaration fails here; print the refusal-site count and the member count so a mismatch is diagnosable.

**Expected Outcome**:
- Non-empty, duplicate-free, four-family constant; every member a declared row with a matching kind; classifier agreement per member; live mismatch control; no new row/kind/exit; every refusal branch inside the declaration.

#### TC-ENGINE-055 - verify deploy remains a declared residual, not a claimed capability

**Objective**: Keep the scope boundary honest in both directions: the stub still exists, and the documentation says so.
**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F6-10, F-6, F-8, RSK-8, NG-8
**Test Type(s)**: Regression, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/golden/verify-deploy.test.ts` (delivered, unchanged) + `tests/checks/engine-first-doc-reconciliation.test.ts` (new) for the documentation half
**Harness entry**: `bun test tests/golden/verify-deploy.test.ts` and `bun test tests/checks/engine-first-doc-reconciliation.test.ts --filter residual`
**Tags**: @backend, @docs, @regression

**Preconditions**:
- The production composition's `verify deploy` path (target resolution stub) and the delivered deploy golden.
- The merge/verify page and the new guide as the documentation subjects.

**Steps**:
1. Assert the delivered `verify deploy` behaviour is unchanged (the golden passes unmodified) and that the production path still returns the delivered classified stub rather than a fabricated verification.
2. Assert the merge/verify page states the stub as a residual (the words `residual`/`not delivered` naming `verify deploy`'s target resolution) and does not claim deploy confidence.
3. Assert the operator guide repeats the residual (one sentence naming it) so an operator following the guide cannot believe deploy is engine-verified.
4. Assert the spec's RSK-8 framing is not contradicted: the page does not present the stub as scheduled-in-this-change work.

**Expected Outcome**:
- Stub unchanged; both documents declare it; no capability claim anywhere.

#### TC-ENGINE-060 - The operator guide declares a redistributable marker and covers the four declared topics

**Objective**: Deliver "documented" as a checkable artifact with the distribution contract enforced.
**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F8-12, AC-F4-8, F-8, NFR-8, DEC-10
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/engine-first-doc-reconciliation.test.ts` (new) + `bash scripts/.tests/test-doc-distribution.sh`
**Harness entry**: `bun test tests/checks/engine-first-doc-reconciliation.test.ts --filter guide` and `bash scripts/.tests/test-doc-distribution.sh`
**Tags**: @docs, @contract

**Preconditions**:
- The guide lives under `doc/guides/*.md`; its filename is delivery-bound, so the case selects it by its declared marker plus topic coverage rather than by a hardcoded name (it fails if zero or more than one candidate matches and names the candidates).

**Steps**:
1. Assert exactly one guide file carries the engine-first operating content and that its existing frontmatter contains `ados_distribution: redistributable` (in the existing block, not a new one).
2. Assert the guide covers the four declared topics with resolvable non-empty sections: daily engine-first operation (`dispatch <ref>`, lifecycle merge/closeout through the engine), reading the gate and the fleet row (`conditions`, `cleanDispatches`, `handoverGate`, `verdict`), performing and reversing a flip (`dispatch handover <repo>`, `--revert`, reversible before/after), and the shell fallback (five-key tail, pointer, `dual-run` behaviour).
3. Assert the guide states the engine is the regular path **and** the shell is the documented fallback, and that the flip is an owner act (the no-flip statement).
4. Assert the guide names the two residual limits an operator could otherwise assume fixed: `verify deploy` and the lanes-read profile blindness.
5. Run `bash scripts/.tests/test-doc-distribution.sh`; assert exit `0` (the marker-derived install set includes the guide).

**Expected Outcome**:
- Marker present and valid; four topics covered; the no-flip and residual statements present; the distribution guard green.

#### TC-ENGINE-061 - The six feature pages state the declared contracts and residuals, and the two broader test specs are handed to phase 7

**Objective**: Reconcile the contract reference so the corpus never states the new payloads or the restored composition without their contracts, and make the test-spec reconciliation a declared **phase-7 handoff** rather than a claim that test planning aligned it.
**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F8-12; F-8; NFR-8; DEC-10, DEC-11, DEC-16, DEC-17
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/engine-first-doc-reconciliation.test.ts` (new)
**Harness entry**: `bun test tests/checks/engine-first-doc-reconciliation.test.ts --filter pages`
**Tags**: @docs, @contract

**Preconditions**:
- Sections resolved by their delivered headings: `feature-dispatch-engine.md` §Handover gate (line 316) and §Dual-run evidence; `feature-projects.md` §`repos list` contract (line 160) and §The `projects list --flat` alias (line 199); `feature-merge-verify-deploy.md` §Classification and waivers (line 109) and §verify deploy (line 153); `feature-autonomous-delivery.md`; `feature-resident-daemon.md` §Declared residuals (line 473).

**Steps**:
1. `feature-dispatch-engine.md`: assert the summary's three additive fields and the handover's two are named with their declared order, the fleet evaluation host is named (read-time, `repos list`), the no-flip operating definition is stated, and the **declared handover exemption** is stated as exactly one outcome (the idempotent revert noop, evidence-read-free, no `conditions`).
2. `feature-projects.md`: assert the row is documented as seven fields in the declared order, that the block's members are named, that the flat alias is stated as unchanged and carrying neither field, that the row's evaluation is stated as bound to its own resolved repository identity with foreign records excluded (DM-7, DEC-15), and that the fold is stated as the declared `production` evidence scope with no scope key or flag (DM-4, DEC-17, TDR-0031 D11).
3. `feature-merge-verify-deploy.md`: assert the production composition (real reads, configuration/branch/base-reference resolution) is stated, the **owner principal** is named as the provider-resolved repository owner with no configuration key added (DEC-13), the **emittable-code constant** is named (DEC-14), classification is stated as derived from the resolved row, and `verify deploy` is a residual.
4. `feature-autonomous-delivery.md` and `feature-resident-daemon.md`: assert the residual/engine-first wording is consistent (no page claims a daemon-hosted periodic evaluation).
5. Absence: assert no reconciled page states a lane-read provider profile or a declared-window read.
6. Phase-7 handoff (DEC-16): assert no page or change artifact claims the two broader test specs were reconciled **during test planning**; assert the pages state that `doc/quality/test-specs/test-spec-dispatch-engine.md` and `test-spec-merge-verify-deploy.md` are reconciled in the documentation phase (phase 7, `@doc-syncer`); and assert `doc/quality/test-specs/` gained no new entry (DEC-11), printing the directory listing so the absence is falsifiable and the reconciliation itself is recorded as an attestation in §10.

**Expected Outcome**:
- Every named page states its contract and residual, including the four declared seams; the negative claims are absent; the test-spec reconciliation is a declared phase-7 handoff with no new entry and no test-planning-alignment claim.

#### TC-ENGINE-062 - The planning corpus carries the progress line, addendum, scenario row, and both restatements

**Objective**: Deliver the corpus reconciliation and both restatements as text a reader can verify, including the removal of the unrepresentable assertions.
**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F8-12, AC-F8-13, F-8, NFR-8, DEC-10
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/engine-first-doc-reconciliation.test.ts` (new)
**Harness entry**: `bun test tests/checks/engine-first-doc-reconciliation.test.ts --filter corpus`
**Tags**: @docs, @contract

**Preconditions**:
- The four corpus files: `doc/planning/oss-tooling/milestones/m2/backlog.md`, `doc/planning/oss-tooling/status.md`, `doc/planning/oss-tooling/milestones/m2/README.md`, `doc/planning/oss-tooling/milestones/m2/test-scenarios.md`.
- The delivered `tests/checks/planning-truth.test.ts` runs as a control so structure did not break.

**Steps**:
1. Backlog: assert the M2-S16 entry carries a `Progress:` line naming GH-293 and the delivered capability (evaluation surfaces, accrual, reversibility, merge restoration, no flip).
2. Status: assert the `status.md` M2 snapshot addendum exists (a dated section after the existing snapshot) and names M2-S16/GH-293.
3. README: assert the M2-S16 scenario row lists `SC-M2-S16-01`, `SC-M2-S16-02`, **and** `SC-M2-S16-03`.
4. `test-scenarios.md`: assert the restated SC-02 text carries `countedDeliveries`, first-appearance coverage growth (`at most one per dispatch` / `at most eleven`), and `cleanDispatches`; assert the restated SC-03 text carries shell exit `0` plus the pointer, `reversible` read from `dispatch handover` data or the `repos list` row, `true` before and `false` after `--revert`, and per-repository isolation.
5. Absence: assert the unrepresentable originals are gone — the per-dispatch coverage-growth assertion and the shell `data.reversible == true` assertion must not survive as asserted facts (fail naming the offending line).
6. Run `tests/checks/planning-truth.test.ts` as a control.

**Expected Outcome**:
- All four corpus updates present; both restatements exact; both unrepresentable assertions absent; planning truth still green.

#### TC-ENGINE-063 - Each restatement is traced to story AC1/AC4 with no story AC weakened

**Objective**: Make the restatements auditable: each one names the story AC it still satisfies and why it had to change.
**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F8-13, AC-F4-8, F-8, DEC-10
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/engine-first-doc-reconciliation.test.ts` (new)
**Harness entry**: `bun test tests/checks/engine-first-doc-reconciliation.test.ts --filter traceability`
**Tags**: @docs, @contract

**Preconditions**:
- Appendix B of the change spec and the restated scenario sections in `test-scenarios.md`.

**Steps**:
1. Assert the spec's Appendix B carries one row per restated scenario with: the delivered assertion, the forcing payload fact, the restated assertion, and the preserved story AC.
2. Assert SC-02's row traces to story **AC1** and states that corroborated outcome accrual is still required (moved to the honest counter).
3. Assert SC-03's row traces to story **AC3/AC4** and states that shell usability plus per-repository reversible flip are still required (moved to the engine surfaces).
4. Assert the explicit "no story AC is weakened" statement exists in both the spec and the corpus restatement.
5. Assert the forcing facts are named as payload facts, not preferences: coverage is an eleven-token **set**, and the shell summary is a pinned five-key **text tail with no machine mode**.

**Expected Outcome**:
- Traceability present in both places; forcing facts named as contract facts; no weakened-AC claim missing.

#### TC-ENGINE-064 - TDR-0031 lands with its index row and a resolvable bidirectional reference

**Objective**: Land the decision as an artifact, not as a proposal in a ticket.
**Scenario Type**: Contract
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-F8-12, F-8, DEC-10
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/engine-first-doc-reconciliation.test.ts` (new); subject `doc/decisions/TDR-0031-engine-first-evaluation-surfaces.md` and `doc/decisions/00-index.md`
**Harness entry**: `bun test tests/checks/engine-first-doc-reconciliation.test.ts --filter tdr`
**Tags**: @docs, @contract

**Preconditions**:
- The decision file is tracked by the change (it currently exists as an untracked working file; "landed" means committed with the change).

**Steps**:
1. Assert the file exists with `id: TDR-0031`, `decision_type: tdr`, `status: Proposed`, and the **eleven** decision clauses **D1–D11** present by their declared names (D1 host, D2 condition shape **and the five-outcome table with its single evidence-read-free exemption**, D3 accrual, D4 reversibility, D5 windows/holds, D6 no flip, D7 classification **with the declared credential-read exit projection**, D8 owner principal, D9 emittable-code enumeration, D10 row repository binding, D11 row evidence-class scope).
2. Assert the record's D2 outcome table has exactly **five** rows with exactly one evidence-read-free outcome, and that the exempt row's cells state `conditions` absent, `verdict` absent, `truncation` absent, `reversible: false`, exit `0` — the same cells the spec's Appendix E.1 carries.
3. Assert `doc/decisions/00-index.md` carries a row linking `[TDR-0031](TDR-0031-engine-first-evaluation-surfaces.md)` and that the link target resolves on disk.
4. Assert the index row's status matches the file's status (no divergent status pair).
5. Assert the change spec references TDR-0031 in its decision links so the change is reachable from the record.
6. Assert the record's `links.spec` names the pages this change reconciles (dispatch engine, projects, peak pausing) so the record's subject is discoverable.
7. Assert every clause the plan cites exists under that id: `D8` states the provider-resolved repository owner with no new configuration key; `D9` states the exported, exhaustive-by-construction constant; `D10` states the read-only non-persisting row binding; `D11` states the row's `production` scope with no scope key — a plan reference to a clause the record does not carry fails here naming the clause.

**Expected Outcome**:
- Record landed, indexed, resolvable, status-consistent, cross-referenced, with **D1–D11** and the five-outcome table (one exemption) present.

#### TC-ENGINE-065 - The lifecycle prose names the engine as the regular path and the shell as the documented fallback, with the "retained primary entry points" claim gone

**Objective**: Close the contradiction readiness F-3 exposed: `AGENTS.md` and `doc/guides/change-lifecycle.md` still called `deliver-ticket.sh` and `ceo-loop.sh` "retained primary entry points" while AC-F4-8 requires the engine to be the documented regular path and the shell the documented fallback. AC-F4-8/AC-F8-12 now require the bounded reconciliation, so the case asserts the corrected claim in both documents, the **absence** of the old one, no flip claim, and that nothing else was rewritten.
**Scenario Type**: Contract
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-8, AC-F8-12; F-4, F-8; NFR-8; DEC-6, DEC-10
**Test Type(s)**: Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/engine-first-doc-reconciliation.test.ts` (new); subjects `AGENTS.md` (repository root) and `doc/guides/change-lifecycle.md`
**Harness entry**: `bun test tests/checks/engine-first-doc-reconciliation.test.ts --filter lifecycle-prose`
**Tags**: @docs, @contract

**Preconditions**:
- Both documents exist and their target paragraphs resolve by their delivered anchors — `AGENTS.md`'s **delivery-process** paragraph and `change-lifecycle.md`'s **lifecycle-state** paragraph. An unresolvable or empty span is a failure naming the anchor, never a skip.
- Text is whitespace-normalised (a line wrap cannot fail a token); the forbidden phrase is captured verbatim as `retained primary entry points` (case-insensitive, whitespace-normalised).
- Scope discipline: the **positive** assertions run over the resolved paragraph spans; the **absence** assertions run over each **whole document**, so a leftover copy in another paragraph still fails.

**Steps**:
1. Positive, both documents: assert the resolved span states that the **typed engine is the regular delivery path** — naming `dispatch <ref>` and the lifecycle merge/closeout running through the engine primitives (the page's own wording may differ, but the claim and the named command must both be present).
2. Positive, both documents: assert the span states the **shell entry points are the documented, still-executable fallback**, with the delivered authoritative-mode deprecation pointer named (`dispatch <ref>`, `dispatch handover <repo> --revert`) and the fallback described as executable rather than removed.
3. Absence (the finding): assert **zero** occurrences of the `retained primary entry points` claim in either document — failing with file path and line numbers — and assert no sentence restates `deliver-ticket.sh` or `ceo-loop.sh` as *the primary* path (`retained primary`, `remains the primary`, `primary delivery path` scans).
4. No flip claim: assert neither document asserts that this or any repository is `authoritative`/flipped, or that the shell is deprecated/unsupported in `dual-run`; assert the flip is stated as an owner act executed by `dispatch handover <repo>` once the gate reads eligible.
5. Marker facts (so the edit cannot be skipped and cannot over-reach): assert `AGENTS.md` carries **no** `ados_distribution` key at all (it is a root document), and that `doc/guides/change-lifecycle.md` still carries `ados_distribution: redistributable` inside its **existing** frontmatter block (no new block, no second header).
6. Bounded edit: assert the other sections of both documents still carry their delivered headings and that no other paragraph of either document was rewritten — the case prints the changed-line ranges attributable to the two reconciled paragraphs, and the diff itself is review-attested in §10 (a rewrite outside those ranges fails the attestation).
7. Controls: run the delivered `tests/checks/doc-conformance.test.ts` (the current-truth phrase table) and the documentation suite as green, so the bounded edit introduces no history phrasing; assert the scanned file set is non-empty (non-vacuity).

**Expected Outcome**:
- Both documents state the engine-first claim and the shell-as-fallback claim, with zero "retained primary entry points" occurrences, no flip claim, no deprecation-in-`dual-run` claim, the marker facts preserved, and no other content rewritten; the conformance controls are green.

**Notes / Clarifications**:
- This is the AC-F4-8/AC-F8-12 documentation clause, not a rewrite of the lifecycle: the case asserts exactly the two statements the spec names (§5.1 F-4, §7.2) and treats any broader edit as a failure, because the spec's boundary is "bounded edits" and a broader change would be an undecided documentation rewrite.
- `AGENTS.md` is not a distributable document; the case asserts the marker is absent there and present (unchanged) in the guide, so the two facts cannot be swapped.

#### TC-ENGINE-090 - Every touched payload stays additively stable; pinned suites extended by appending only

**Objective**: Prove the compatibility rule by running the delivered pins together and by asserting the append-only direction of each change.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-NFR1-14, NFR-1, DEC-9
**Test Type(s)**: Regression, Contract
**Automation Level**: Automated
**Target Layer / Location**: delivered suites `tests/behaviour/dispatch-additive-stability.test.ts`, `tests/behaviour/repos-list-contract.test.ts`, `tests/behaviour/projects-flat-alias.test.ts`, `tests/golden/dispatch-summary.test.ts`, `tests/structure/content-inventory.test.ts`, `tests/structure/dispatch-imports.test.ts`, `tests/structure/dispatch-merge-boundary.test.ts`
**Harness entry**: `bun test tests/behaviour/dispatch-additive-stability.test.ts tests/behaviour/repos-list-contract.test.ts tests/behaviour/projects-flat-alias.test.ts tests/golden/dispatch-summary.test.ts tests/structure/content-inventory.test.ts tests/structure/dispatch-imports.test.ts tests/structure/dispatch-merge-boundary.test.ts`
**Tags**: @backend, @regression

**Preconditions**:
- The change's working tree; every suite above as delivered except the two additive extensions declared in this plan (summary/handover order, fleet row order).

**Steps**:
1. Run the battery; assert every suite passes and that the extensions are visibly additive (the new expectations are suffixes of the delivered literals — asserted in `TC-ENGINE-005`, `016`, `020`).
2. Assert the delivered assertions were not weakened: the delivered sorted-set assertion in `repos-list-contract.test.ts` and the delivered sixteen-key summary literal still exist in the file (source assertion, so a deletion fails).
3. Assert the source inventory equals the actual file set (new modules registered) and that the structural module lists (`dispatch-imports`, `dispatch-merge-boundary`) were extended rather than replaced.
4. Assert no golden other than the summary text changed: the flat-alias golden and the `lanes` golden are byte-identical to HEAD.

**Expected Outcome**:
- All pins green; extensions appended; no delivered assertion removed; inventory and structural lists truthful.

#### TC-ENGINE-091 - No new command, verb, flag, error row, DOMAIN_KINDS member, or exit class

**Objective**: Hold the closed vocabularies the change promises not to widen, including the merge configuration branch and the exported emittable-code set's membership in the delivered table.
**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-NFR1-14, AC-F6-10, AC-F7-11; NFR-5, NFR-12; DEC-9, DEC-13, DEC-14; TDR-0031 D9
**Test Type(s)**: Regression, Contract
**Automation Level**: Automated
**Target Layer / Location**: `tests/structure/error-table.test.ts`, `tests/structure/dispatch-error-identity.test.ts`, `tests/structure/dispatch-help-inventory.test.ts`, `tests/checks/help-guide-coverage.test.ts`, `tests/checks/prompt-conformance.test.ts`, `tests/behaviour/repos-list-contract.test.ts` (verb refusal case), `tests/golden/dispatch-errors.test.ts`
**Harness entry**: `bun test tests/structure/error-table.test.ts tests/structure/dispatch-error-identity.test.ts tests/structure/dispatch-help-inventory.test.ts tests/checks/help-guide-coverage.test.ts tests/checks/prompt-conformance.test.ts tests/checks/exit-code-literals.test.ts tests/behaviour/repos-list-contract.test.ts`
**Tags**: @backend, @contract

**Preconditions**:
- The delivered per-kind row counts from `error-table.test.ts` (config 10, state 9, provider 13, merge 7, input 1, lint 6, db 4, watchdog 4, doctor 1, blockers 4) as the baseline.

**Steps**:
1. Run the battery; assert every per-kind count is unchanged (a new row in any family fails), and that `DOMAIN_KINDS` membership is unchanged (compare to the delivered literal).
2. Assert exit classes are unchanged: `dispatch` and `repos` still project {0,1,2}; the delivered exit-literal check (`tests/checks/exit-code-literals.test.ts`) passes; and the projection map's declared pairs are unchanged (`success → 0`, `user-validation → 1`, `platform-provider → 2`, `attention → 1`), so `config.credential.missing` cannot be projected to exit `2` without a map change this case fails — the structural guard behind `TC-ENGINE-052`'s exit assertion.
3. Assert the command/verb inventory is unchanged: the prompt-required command set is identical, `repos <unknown>` still refuses `fallback.invocation` at exit `1`, and `dispatch` accepts no new verb or flag (the delivered undeclared-flag cases still refuse).
4. Assert the error-taxonomy/golden error surface is unchanged (`tests/golden/dispatch-errors.test.ts` passes unmodified).
5. Assert the configuration vocabulary is unchanged: the typed `merge` configuration branch still exposes exactly `gate-freshness`, `gates`, and `deploy-expectations`, and no key naming an owner principal, a branch, or a base reference exists anywhere in the configuration schema — a new key fails naming it (DEC-13).
6. Assert the composition's `MERGE_COMPOSITION_EMITTABLE_CODES` adds no vocabulary: every member is a pre-existing table code (it is a declaration, not a row source), so the table row counts and `DOMAIN_KINDS` asserted in steps 1–2 bound it as well (DEC-14).

**Expected Outcome**:
- No vocabulary growth in any dimension (commands, flags, error rows, kinds, exits, configuration keys); every delivered refusal still refuses; the emittable-code constant is a declaration over existing codes.

#### TC-ENGINE-092 - Hermeticity: zero live network, credential, model, or sleep in the delivering suites

**Objective**: Keep the suite honest: no network, no real credentials, no model call, no sleep — asserted by counters and a live positive control.
**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-NFR1-14, NFR-9
**Test Type(s)**: Contract, Negative
**Automation Level**: Automated
**Target Layer / Location**: `tests/checks/engine-first-hermetic.test.ts` (new), extending the delivered `tests/checks/merge-deploy-no-live-calls.test.ts` module list where new modules appear
**Harness entry**: `bun test tests/checks/engine-first-hermetic.test.ts`
**Tags**: @backend, @perf, @contract

**Preconditions**:
- The delivered `createNoNetworkGuard` and `scanForLiveCalls` helpers; the list of new suites and production modules introduced by the change (delivery-bound, asserted non-empty).
- A real-spawn counter seam around the harness spawn runner and a sleep counter (monkey-patched `setTimeout` count with the guard restored in `finally`).

**Steps**:
1. Source scan: every new production module and fixture in the change's surface list contains no `fetch(`, no `https.request`, no `child_process` call outside an injected seam, and no `Atomics.wait`/`sleep` construct; assert the scanned file list is non-empty.
2. Runtime: run the new behaviour suites' representative cells with the no-network guard installed; assert `guard.calls` is empty and that a deliberate call still throws (positive control, proving the guard is live).
3. Assert the harness spawn counter is zero for every fleet/summary/handover case and that the merge cells use the injected transport (recorded calls > 0, network calls = 0).
4. Assert every temp root is under `tmp/tmpdir` (or the OS temp root) and that no case resolved a path under `$HOME` or the live checkout (`guardStateFixtureRoot` traces).

**Expected Outcome**:
- Zero live calls of every kind; the guard is proven live; the file list is non-vacuous; temp-root discipline holds.

#### TC-ENGINE-093 - Two fleet reads over unchanged state are byte-identical; no wall-clock field in the row

**Objective**: Make the fleet read diffable: identical state produces identical bytes, and no timestamp leaks into the row.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F3-6; F-3; DM-7; NFR-3, NFR-10, NFR-13; DEC-1, DEC-15, DEC-17; TDR-0031 D10, D11
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/repos-handover-gate.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/repos-handover-gate.test.ts --filter determinism`
**Tags**: @backend, @behaviour

**Preconditions**:
- A host with three projects: one `ready` with a mixed ledger, one `ready` with a truncated read, one `first-use`.
- Two consecutive `repos list --json` runs in the same process (and one after a short, deliberate ledger-append to prove the read is fresh, not cached — `TC-ENGINE-094`).

**Steps**:
1. Run twice; assert `stdout` is byte-identical and both exit `0`.
2. Deep-scan the payload for wall-clock or relative-time keys (`recordedAt`, `now`, `asOf`, `windowEnd`, `lastSeen`, `ageSeconds`, `*Ago`) and assert none appear in any row or in `handoverGate`.
3. Assert the payload carries no field whose value changes between the two reads (compare key-by-key).
4. Assert the text table is also byte-identical across the two runs (delivered behaviour preserved).
5. Assert no row was evaluated under an unresolved identity: every `ready` row's `handoverGate` is present and equal (field by field) to a summary read for that row's resolved repository identity, and no row carries an empty or placeholder identity-derived zero (`TC-ENGINE-021` supplies the identity cells; this step pins that determinism does not come from skipping a row).
6. Assert the scope declaration is not a payload field and does not vary (DEC-17, TDR-0031 D11): deep-scan both reads for `scope`, `evidenceScope`, and `evidenceClass` and assert none appears on any row, on `handoverGate`, or in the summary; assert the row's numbers equal the summary's, which is only possible when both fold the one declared `production` scope (SCOPE-ENG-1).

**Expected Outcome**:
- Byte identity across reads; no time-derived field; text determinism preserved.

#### TC-ENGINE-094 - The fleet read re-evaluates on every read and stays bounded; no cache, no write

**Objective**: Prove freshness and bounded work — "periodic" means every read, and nothing is written.
**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-NFR1-14, F-3, DM-7, NFR-2, NFR-13, DEC-1, DEC-15; AMB-ENG-2
**Test Type(s)**: Integration, Performance
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/repos-handover-gate.test.ts` (new) + `tests/behaviour/projects-performance.test.ts` (delivered precedent for the floor)
**Harness entry**: `bun test tests/behaviour/repos-handover-gate.test.ts --filter re-evaluation`
**Tags**: @backend, @perf

**Preconditions**:
- One `ready` project seeded with a known ineligible ledger; a second phase appends a corroborated success after the first read.
- A 25-project fleet fixture (index seeded, checkouts materialized) for the floor measurement.

**Steps**:
1. Read once; capture `handoverGate.countedDeliveries` and `cleanDispatches`.
2. Append one corroborated attempt through the delivered ledger API; read again; assert both numbers advanced by exactly one (no cached value survived the append).
3. Assert no write happened on the read path: host-root tree snapshot before/after each of the two reads is identical (the delivered create-once marker and temp-sibling rules are the only permitted effects and are outside the snapshot's scope or idempotent between reads).
4. Fleet floor: run the 25-row read ten times, print the row count and the p95 milliseconds, and assert the read completes and that the per-row block is present on all 25 rows (AMB-ENG-2 substitute; no wall-clock latency is a pass condition).
5. Assert zero transport calls across all reads (the fleet read is local).
6. Assert identity resolution is free of persistence and of extra store opens: no identity-binding file is created or modified by either read (covered by the same snapshot), and the 25-row floor includes the resolution cost — a per-row store open via identity resolution would surface as a step change against the delivered `projects-performance` floor (AMB-ENG-2; NFR-13).

**Expected Outcome**:
- Fresh values after the append; nothing written; 25 rows evaluated; no network.

#### TC-ENGINE-095 - Cross-surface coherence matrix: one ledger, three surfaces, identical statuses

**Objective**: Make the change's headline metric (three surfaces agree) a failing test if any two disagree, on every fixture family.
**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: Critical
**Related IDs**: AC-F1-2, AC-F3-5, F-1, F-2, F-3, NFR-4, NFR-10, DEC-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tests/behaviour/engine-first-cross-surface.test.ts` (new)
**Harness entry**: `bun test tests/behaviour/engine-first-cross-surface.test.ts`
**Tags**: @backend, @behaviour, @invariant

**Preconditions**:
- Six fixture families, each seeded into one registered project's state root: eligible; truth incident (`falseSuccess`); coverage missing; floor missing; corroboration unsatisfied; truncated.
- The project's checkout identity resolves to the same `host/owner/name` string the fixture passes to `--repo` (via the persisted binding, or its normalized configured remote), so the summary, the handover decision, and the row address the same repository (DM-7, DEC-15).

**Steps**:
1. For each family: read the summary (`dispatch dual-run summary --repo <repo> --json`), the handover decision (`dispatch handover <repo> --json`), and the fleet row (`repos list --json`).
2. Assert the four `conditions` arrays are deep-equal across all three surfaces (order and statuses).
3. Assert `verdict` agrees across the three (`summary.verdict === handover.verdict === row.handoverGate.verdict`).
4. Assert `countedDeliveries` and `cleanDispatches` agree between the summary and the row.
5. Assert the open-set identity holds on all three surfaces and that `truncation` appears on exactly the truncated family on **every** surface that carries the key (summary `truncation`, handover `truncation`, row `handoverGate.truncation`).
6. Assert no family produces a condition status outside `met|open` and no surface invents a status the others lack.
7. Assert the matrix's handover cell is an evidence-reading outcome (a forward `dispatch handover <repo>`, never a `--revert` noop) and that every family's handover data carries `conditions` — the single declared exemption is excluded by fixture construction, so a surface silently relying on its absence fails here.

**Expected Outcome**:
- Six-for-six agreement across three surfaces; the metric in §4.1 of the spec is a test result rather than a claim.

**Postconditions**:
- No fixture appended a handover record (the reads are side-effect free); asserted by a ledger count per family.

## 6. Environments and Test Data

- **Environments.** One hermetic local environment: Bun test runner over temp state directories under `tmp/tmpdir` (`APPROVED_BASE = <cwd>/tmp/tmpdir`), plus `bash` suites under `scripts/.tests/` with `mktemp -d` roots. No staging, no external system, no daemon, no network. `guardStateFixtureRoot` refuses the live checkout, any ancestor, and the home-derived real state directory, so a fixture cannot write into an operator's state.
- **State stores.** Real `delivery.state.v1` JSONL stores per fixture (`createStateStore`), seeded only through the delivered ledger APIs (`appendDispatchAttempt`, `appendDispatchDivergence`, `appendDispatchHandover`, `writeDispatchAuthority`) so the assertions are about the projection rather than about fixture JSON. Pre-change records are seeded as delivered-shape records (`TC-ENGINE-012`).
- **Dispatch fixtures.** `tests/fixtures/dispatch/evidence-windows.ts` (`buildAttempts`, `eligibleSpecs`, `missingClassSpecs`, `uncorroboratedSpecs`, `dayAt`) and `tests/fixtures/dispatch/ledger.ts` (`REPOSITORY`, `REPOSITORY_BETA`, `makeDivergence`, `makeHandover`, `makeAuthorityView`, `corroborationFor`). Append order equals spec order, which is what makes the trailing-run assertion meaningful. Truncation fixtures use the delivered `gate.max` seam. Corruption cells name the ledger they corrupt and nothing else: the **attempts** ledger in `TC-ENGINE-014` (recorded-revert vs noop) and `TC-ENGINE-010` (noop only), and the **handover** ledger in `TC-ENGINE-017` (a torn record, and a failing store read), with the attempts and divergences ledgers left readable in the handover cells so the refusal is attributable to one ledger.
- **Repository-identity fixtures.** Every `ready` checkout in a fleet or merge fixture declares an identity through the delivered policy in three cells: (i) a persisted create-once binding recorded with the checkout's git common directory, (ii) no binding plus a normalized `origin` remote (`https://github.com/<owner>/<label>.git`), and (iii) neither — the unresolvable cell behind `TC-ENGINE-023`. Attempt, divergence, and handover records are seeded under that normalized `host/owner/name` string; foreign-record cells seed a second identity into the same store. No fixture creates or repairs a binding through a read path, and the merge fixture derives the owner principal (`<owner>`) from the same normalized identity.
- **Evidence-scope fixtures (DEC-17).** Attempt records are seeded with the evidence class the case needs: `pilot` for counted `production` evidence (what the fleet row, the summary, and the handover decision all fold) and `controlled-proof` for the `controlled` scope, which is seeded **only** to prove it is not folded by a row or a summary (`TC-ENGINE-020`, `TC-ENGINE-021`, `TC-ENGINE-095`). No fixture sets a scope through a key or flag, because none exists; the fixture chooses the record's class and the projection chooses the scope.
- **Host and checkout fixtures.** `tests/fixtures/projects/state-scope.ts` (host fixture, approved base), `tests/fixtures/projects/temp-repos.ts` (real `git init` + commits, sanitized git environment, `GIT_CEILING_DIRECTORIES`), `tests/fixtures/projects/host-index.ts` (seeded index), `tests/fixtures/projects/host-root.ts` (`snapshotTree`, `snapshotDifferences`).
- **Production composition.** `tests/fixtures/projects/production.ts` (`createProductionProjectsHarness`) composes the real `createProductionComposer` over a real checkout with an injected recording GitHub transport, a resolving or refusing credential port, a recording harness spawn, and a recording git runner; it exposes `transportCalls`, `spawns`, `gitCalls`, `snapshot`, and `fileList`. The environment never carries a real token, so a real credential read fails the run.
- **Merge fixtures.** `tests/fixtures/merge/harness.ts` remains the in-process seam harness for the delivered cases; the new production-composition cases build their own fixture from `createRepository` + `git(...)` (`main-tools` base branch, a feature branch with one commit) and inject the provider transport at the composer, so the reads are real code paths and the bytes are synthetic.
- **Clock.** Where a case needs a fixed instant it uses the delivered fixture clock (`FIXED_CLOCK` in the dispatch harness) or fixed past timestamps; the fleet read runs on the real clock by design, so its assertions are about values derived from past records and about determinism between two reads (no wall-clock field is asserted in the row). No real `sleep` anywhere.
- **Goldens.** `tests/fixtures/dispatch/golden/summary.txt` is regenerated deliberately once for the three additive lines; `tests/golden/fixtures/projects-flat-alias.json` and the `lanes` golden must not change. A regeneration diff that shows anything other than the declared deltas fails review.
- **Isolation and determinism.** Every suite constructs its own store, host root, and home; no cross-suite shared state; determinism is asserted by paired runs (`TC-ENGINE-093`). Shell suites copy `scripts/` into a temp checkout so `ROOT_DIR` is the fixture.
- **Aggregate gate.** `TMPDIR="$PWD/tmp/tmpdir" pnpm check` is the canonical local gate (TMPDIR lesson); the doc-distribution guard (`bash scripts/.tests/test-doc-distribution.sh`) and the shell suites are run alongside because they are not inside `pnpm check`.

## 7. Automation Plan and Implementation Mapping

Every case is automated. New `bun:test` suites live under the delivered test layers (`tests/behaviour`, `tests/structure`, `tests/checks`, `tests/golden`) and follow `*.test.ts`; fixtures stay in `tests/fixtures/**` and are never named `*.test.ts`. Rows marked **Existing – Update** extend a delivered suite by appending; rows marked **Existing – No Change** are the non-change controls and must pass untouched. Delivery owns exact module paths (GAP-T4); a case that cannot resolve its seam fails naming the missing contract rather than skipping. Every `--filter` token below is a required case-name substring: delivery names the case so the filter matches at least one test, because `bun test` exits `0` on a zero-match filter and a silent skip is exactly the failure mode this plan exists to prevent. Aggregate verification: `TMPDIR="$PWD/tmp/tmpdir" pnpm check`.

| TC ID | Suite / file | Command | Injection / fixture requirements | Status |
|---|---|---|---|---|
| TC-ENGINE-001 | `tests/behaviour/dispatch-clean-accrual.test.ts` | `bun test tests/behaviour/dispatch-clean-accrual.test.ts` | Five seeded ledgers (eligible, broken-streak, breaking-tail, uncorroborated, empty); `createCommandScenario`; pure-fold comparison | To Implement |
| TC-ENGINE-002 | `tests/behaviour/dispatch-clean-accrual.test.ts` | `bun test … --filter accrual-walk` | Sequential appends through the delivered ledger; summary reads between appends | To Implement |
| TC-ENGINE-003 | `tests/behaviour/dispatch-conditions-projection.test.ts` | `bun test tests/behaviour/dispatch-conditions-projection.test.ts --filter shape` | Eligible + ineligible ledgers; `DISPATCH_HANDOVER_CONDITIONS` imported as the order oracle | To Implement |
| TC-ENGINE-004 | `tests/behaviour/dispatch-conditions-projection.test.ts` | `bun test … --filter open-set` | Six fixture families incl. `falseSuccess` and `gate: { max: 5 }`; truncation fixture | To Implement |
| TC-ENGINE-005 | `tests/behaviour/dispatch-additive-stability.test.ts` | `bun test tests/behaviour/dispatch-additive-stability.test.ts --filter summary` | Delivered summary case extended; truncated variant added; delivered sixteen-key literal kept as prefix | Existing – Update |
| TC-ENGINE-006 | `tests/golden/dispatch-summary.test.ts` + `tests/fixtures/dispatch/golden/summary.txt` | `bun test tests/golden/dispatch-summary.test.ts` | Deliberate single golden regeneration; in-memory truncated cell for the last-line rule | Existing – Update |
| TC-ENGINE-010 | `tests/behaviour/dispatch-handover-conditions.test.ts` | `bun test tests/behaviour/dispatch-handover-conditions.test.ts` | Eligible / refusing / truncated ledgers + an empty repository; five outcomes incl. the revert noop; torn-attempt and unreadable-divergence noop cells (handover ledger readable) | To Implement |
| TC-ENGINE-011 | `tests/behaviour/dispatch-handover-conditions.test.ts` | `bun test … --filter reversible` | Alpha eligible + beta refusing; `readDispatchAuthority` as the second reader; torn-ledger recorded-revert vs noop pair | To Implement |
| TC-ENGINE-012 | `tests/behaviour/dispatch-handover-conditions.test.ts` | `bun test … --filter record-shape` | Flip + revert + replay; `readDispatchHandover` record key sets; noop appends nothing | To Implement |
| TC-ENGINE-013 | `tests/behaviour/dispatch-handover-conditions.test.ts` | `bun test … --filter isolation` | Two-repository store; beta byte snapshots around alpha's flip, revert, and revert noop | To Implement |
| TC-ENGINE-014 | `tests/behaviour/dispatch-handover-conditions.test.ts` | `bun test … --filter truncation` | Five cells incl. a truncated read, a recorded revert with `verdict`, and a torn attempts ledger applied to both the recorded revert and the noop; delivered exit projection; handover ledger readable in every cell (the corrupt-handover cell is `TC-ENGINE-017`) | To Implement |
| TC-ENGINE-015 | `tests/behaviour/dispatch-handover-conditions.test.ts` | `bun test … --filter text` | Text-mode flip, refusal, and noop; comparison against `renderDispatchHandoverText` | To Implement |
| TC-ENGINE-016 | `tests/behaviour/dispatch-additive-stability.test.ts` | `bun test tests/behaviour/dispatch-additive-stability.test.ts --filter handover` | Delivered handover case extended; recorded-revert, truncated, and noop key-set cells added | Existing – Update |
| TC-ENGINE-017 | `tests/behaviour/dispatch-handover-conditions.test.ts` | `bun test … --filter handover-ledger` | **Plan phase 3.** Alpha flipped then reverted to `dual-run`; uncorrupted control; torn handover record and failing store-read cells with the attempts/divergences ledgers readable (summary read as the readability witness); `ERROR_TABLE` + `projectExitCode` as the exit oracle; ledger bytes and authority document snapshotted around the refusal; attempts-corruption contrast cell | To Implement |
| TC-ENGINE-020 | `tests/behaviour/repos-list-contract.test.ts` | `bun test tests/behaviour/repos-list-contract.test.ts` | Two-project host (one `ready`, one `first-use`); binding cell and remote-only cell; one foreign record; one `controlled-proof` + one `pilot` scope cell; ordered key assertions; binding-file and tree snapshots; text table | Existing – Update |
| TC-ENGINE-021 | `tests/behaviour/repos-handover-gate.test.ts` | `bun test tests/behaviour/repos-handover-gate.test.ts --filter agreement` | Identity via persisted binding and via normalized remote; mixed ledger + foreign records in the same store; a `controlled-proof` append that must move neither surface, then a `pilot` append that moves both; summary + fleet reads; scope rule asserted | To Implement |
| TC-ENGINE-022 | `tests/behaviour/projects-flat-alias.test.ts` | `bun test tests/behaviour/projects-flat-alias.test.ts` | Delivered alias fixture + one gated `ready` row; deep absence scan incl. `scope`/`evidenceScope`/`evidenceClass`; committed golden unchanged | Existing – Update |
| TC-ENGINE-023 | `tests/behaviour/repos-handover-gate.test.ts` | `bun test … --filter unreadable` | Torn / unreadable / malformed ledgers, plus unresolvable and malformed-binding identity cells; healthy control; flat-alias cross-witness; tree snapshot (no binding written) | To Implement |
| TC-ENGINE-024 | `tests/behaviour/repos-handover-gate.test.ts` | `bun test … --filter truncated` | 5,005 identity-bound records + 1 foreign through the delivered append path; `DISPATCH_MAX_ATTEMPT_RECORDS` imported as the bound; contract envelope (`bound`, positive `omittedRecords`, `verdict`) asserted with no incidental literal; printed counts + elapsed | To Implement |
| TC-ENGINE-030 | `scripts/.tests/test-dispatch-bash-fallback.sh` | `bash scripts/.tests/test-dispatch-bash-fallback.sh` | Delivered suite unmodified; temp checkout copy; seeded authority documents | Existing – No Change |
| TC-ENGINE-031 | `scripts/.tests/test-dispatch-bash-fallback.sh` | `bash scripts/.tests/test-dispatch-bash-fallback.sh` | `TC-BASH-002` cell; authoritative document; stderr capture | Existing – No Change |
| TC-ENGINE-032 | `scripts/.tests/test-deliver-ticket.sh` | `bash scripts/.tests/test-deliver-ticket.sh` | Delivered mock loop; five-key order pin at line 724 | Existing – No Change |
| TC-ENGINE-033 | `scripts/.tests/test-dispatch-bash-fallback.sh` | `bash scripts/.tests/test-dispatch-bash-fallback.sh` | Fake typed CLI marker seam; `TC-BASH-004`, `006`..`009` | Existing – No Change |
| TC-ENGINE-034 | `scripts/.tests/test-engine-first-shell-parity.sh` | `bash scripts/.tests/test-engine-first-shell-parity.sh` | Four entry points × two authority states; separate stdout/stderr capture; `cmp` parity | To Implement |
| TC-ENGINE-035 | `tests/checks/engine-first-no-flip.test.ts` | `bun test tests/checks/engine-first-no-flip.test.ts` | Source scan of `appendDispatchHandover(` call sites; seeded store; record counts and authority bytes | To Implement |
| TC-ENGINE-040 | `tests/checks/engine-first-doc-reconciliation.test.ts` | `bun test … --filter mapping` | `feature-peak-pausing.md` sections resolved non-empty; whitespace-normalised tokens | To Implement |
| TC-ENGINE-041 | `tests/checks/engine-first-doc-reconciliation.test.ts` | `bun test … --filter over-claim` | Forbidden phrase literal; replacement surface list; allowlist non-vacuity | To Implement |
| TC-ENGINE-042 | `tests/checks/engine-first-doc-reconciliation.test.ts` (+ delivered help/lanes controls) | `bun test tests/checks/engine-first-doc-reconciliation.test.ts tests/structure/dispatch-help-inventory.test.ts tests/checks/help-guide-coverage.test.ts tests/golden/lanes-list.test.ts` | `queue.ts` source scan; transcribed `QueueLane` member list; delivered goldens unmodified | To Implement + Existing – No Change (controls) |
| TC-ENGINE-050 | `tests/behaviour/merge-production-composition.test.ts` | `bun test tests/behaviour/merge-production-composition.test.ts` | Real temp checkout (`createRepository` + commits, `main-tools` base) whose normalized identity yields the owner principal; injected recording transport + credential port; no-network guard; waiver-principal cells (owner authorized, two others refused); three-configuration-key assertion | To Implement |
| TC-ENGINE-051 | `tests/behaviour/merge-production-composition.test.ts` | `bun test … --filter gate-refusal` | Failing required check-run (or failing owner gate) on the same composition | To Implement |
| TC-ENGINE-052 | `tests/behaviour/merge-production-composition.test.ts` | `bun test … --filter credential` | Refusing credential port with `config.credential.missing`; empty state root; `ERROR_TABLE` (`domainKind` + `projectionClass`) and `projectExitCode` as oracles; exit `1` asserted and exit `2` / `fallback.internal` asserted absent across four invocation cells; membership in `MERGE_COMPOSITION_EMITTABLE_CODES` | To Implement |
| TC-ENGINE-053 | `tests/behaviour/merge-production-composition.test.ts` | `bun test … --filter read-faults` | Fault matrix (5xx, 401, state append failure, stale envelope, non-resolving ref) on dry-run and landing paths; constant-membership assertion | To Implement |
| TC-ENGINE-054 | `tests/structure/merge-classification-conformance.test.ts` | `bun test tests/structure/merge-classification-conformance.test.ts` | `MERGE_COMPOSITION_EMITTABLE_CODES` imported from the composition (never a fixture copy); `resolveAppErrorCode`/`classifyThrown`; mismatch control; refusal-site source scan; printed counts | To Implement |
| TC-ENGINE-055 | `tests/golden/verify-deploy.test.ts` + `tests/checks/engine-first-doc-reconciliation.test.ts` | `bun test tests/golden/verify-deploy.test.ts && bun test tests/checks/engine-first-doc-reconciliation.test.ts --filter residual` | Delivered deploy golden unchanged; residual wording asserted in the merge page and the guide | Existing – No Change + To Implement |
| TC-ENGINE-060 | `tests/checks/engine-first-doc-reconciliation.test.ts` + `scripts/.tests/test-doc-distribution.sh` | `bun test … --filter guide` and `bash scripts/.tests/test-doc-distribution.sh` | Guide selected by marker + topic coverage; four topic sections; distribution guard | To Implement |
| TC-ENGINE-061 | `tests/checks/engine-first-doc-reconciliation.test.ts` | `bun test … --filter pages` | Six pages, headings resolved as delivered; the four declared seams named; phase-7 handoff statement; `doc/quality/test-specs/` listing printed | To Implement |
| TC-ENGINE-062 | `tests/checks/engine-first-doc-reconciliation.test.ts` | `bun test … --filter corpus` | Backlog / status / README / test-scenarios; absence of both original assertions; `planning-truth` control | To Implement |
| TC-ENGINE-063 | `tests/checks/engine-first-doc-reconciliation.test.ts` | `bun test … --filter traceability` | Spec Appendix B + corpus restatements; forcing-fact tokens | To Implement |
| TC-ENGINE-064 | `tests/checks/engine-first-doc-reconciliation.test.ts` | `bun test … --filter tdr` | `TDR-0031` file + `00-index.md` row + link resolution + status agreement + **D1–D11** and the five-outcome table | To Implement |
| TC-ENGINE-065 | `tests/checks/engine-first-doc-reconciliation.test.ts` | `bun test … --filter lifecycle-prose` | `AGENTS.md` delivery-process span + `change-lifecycle.md` lifecycle-state span (both resolved non-empty); whole-document absence scan for `retained primary entry points`; no-flip and no-deprecation claims; marker facts (`AGENTS.md` none, guide `redistributable`); bounded-edit changed-line print; `doc-conformance` control | To Implement |
| TC-ENGINE-090 | delivered pins (see location) | `bun test tests/behaviour/dispatch-additive-stability.test.ts tests/behaviour/repos-list-contract.test.ts tests/behaviour/projects-flat-alias.test.ts tests/golden/dispatch-summary.test.ts tests/structure/content-inventory.test.ts tests/structure/dispatch-imports.test.ts tests/structure/dispatch-merge-boundary.test.ts` | All delivered assertions retained; inventory + structural lists extended by appending | Existing – Update (additions only) + Existing – No Change |
| TC-ENGINE-091 | delivered vocabularies (see location) | `bun test tests/structure/error-table.test.ts tests/structure/dispatch-error-identity.test.ts tests/structure/dispatch-help-inventory.test.ts tests/checks/help-guide-coverage.test.ts tests/checks/prompt-conformance.test.ts tests/checks/exit-code-literals.test.ts tests/behaviour/repos-list-contract.test.ts` | Per-kind row counts, `DOMAIN_KINDS`, help inventory, verb refusals, exit literals, the three `merge` configuration keys, and the constant's membership in the existing table | Existing – No Change |
| TC-ENGINE-092 | `tests/checks/engine-first-hermetic.test.ts` + delivered `merge-deploy-no-live-calls` module list | `bun test tests/checks/engine-first-hermetic.test.ts tests/checks/merge-deploy-no-live-calls.test.ts` | `createNoNetworkGuard` + `scanForLiveCalls`; spawn/sleep counters; non-empty file list | To Implement + Existing – Update |
| TC-ENGINE-093 | `tests/behaviour/repos-handover-gate.test.ts` | `bun test … --filter determinism` | Three-project host (mixed, truncated, first-use); paired reads; wall-clock key scan; scope-key absence scan; per-row equality against a summary read for the row's resolved identity | To Implement |
| TC-ENGINE-094 | `tests/behaviour/repos-handover-gate.test.ts` + `tests/behaviour/projects-performance.test.ts` (precedent) | `bun test tests/behaviour/repos-handover-gate.test.ts --filter re-evaluation` | Append-between-reads freshness; tree snapshots (no binding write, no extra store); 25-project fleet floor with printed p95 | To Implement |
| TC-ENGINE-095 | `tests/behaviour/engine-first-cross-surface.test.ts` | `bun test tests/behaviour/engine-first-cross-surface.test.ts` | Six fixture families × three reads; ledger count per family | To Implement |

**Phase 9 gate commands (recommended)**

```bash
# canonical aggregate gate (TMPDIR lesson)
TMPDIR="$PWD/tmp/tmpdir" pnpm check

# documentation distribution contract (not inside pnpm check)
bash scripts/.tests/test-doc-distribution.sh

# shell non-change controls
bash scripts/.tests/test-dispatch-bash-fallback.sh
bash scripts/.tests/test-deliver-ticket.sh
bash scripts/.tests/test-engine-first-shell-parity.sh

# narrow re-runs while iterating
bun test tests/behaviour/dispatch-clean-accrual.test.ts \
         tests/behaviour/dispatch-conditions-projection.test.ts \
         tests/behaviour/dispatch-handover-conditions.test.ts \
         tests/behaviour/repos-handover-gate.test.ts \
         tests/behaviour/engine-first-cross-surface.test.ts \
         tests/behaviour/merge-production-composition.test.ts \
         tests/structure/merge-classification-conformance.test.ts \
         tests/checks/engine-first-no-flip.test.ts \
         tests/checks/engine-first-hermetic.test.ts \
         tests/checks/engine-first-doc-reconciliation.test.ts

# whitespace / conflict-marker guard and the commit-range gate
git diff --check
./scripts/lint-commit-range.sh --base main-tools
```

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| Risk | Mitigation in this plan |
|---|---|
| **R-TP-1 — A projection disagrees with its source and every case passes because each reads its own derivation.** | Every claim is a comparison between two surfaces over one fixture: `cleanDispatches` vs `corroboration.satisfied` (`001`), open set vs `unmetConditions` (`004`), row vs summary (`021`), three surfaces vs each other (`095`), `reversible` vs the authority document (`011`). A second derivation fails at least one of them. |
| **R-TP-2 — A degraded read is "handled" by rendering an empty or zero value, or the noop exemption is misread as independence from ledger readability.** | `023` asserts `data` is absent (not `[]`) at exit 2 for four degradation shapes including the unresolvable identity; `024` asserts a truncated read produces a verdict plus truncation rather than a padded window; `004`/`014` assert no third status exists to absorb "unknown"; `010`/`014` assert the noop answers at exit `0` under a torn **attempts/divergences** ledger while the recorded revert refuses there. |
| **R-TP-13 — The exemption is widened into a route past a corrupt handover history**: the folded-handover read is dropped or hoisted below the noop branch, so an unreadable or torn handover ledger returns a noop at exit `0`. | `017` is the dedicated counter-witness: with the attempts and divergences ledgers readable and the handover ledger torn (and again unreadable), the noop is refused `dispatch.state-unverified` at its declared exit `2` with no `data` and no record appended; step 6 contrasts the two corruption cells so the case cannot pass by failing everything. `010` covers the opposite cell, so neither direction can be satisfied by deleting the other. |
| **R-TP-3 — The classification conformance test is vacuous (empty or hand-picked enumeration), or a refusal branch escapes the constant.** | `054` ranges over the composition's exported `MERGE_COMPOSITION_EMITTABLE_CODES`, requires it to be non-empty, duplicate-free, and four-family spanning, checks every member against the declared row's `domainKind`, keeps a live mismatch control, and source-scans the refusal sites so a branch outside the declaration fails. The residual limit — a future branch that emits a code without extending the constant — is declared in AMB-ENG-4 and RSK-13. |
| **R-TP-9 — The declared exemption is read as licence to omit `conditions` elsewhere, or is implemented as `null`-valued keys instead of absences.** | `010` asserts both directions (the four evidence-reading outcomes carry four entries; the noop carries the three exempt keys **absent**) and that exactly one outcome omits `conditions`; `016` pins the noop key list as exactly `["repository","operation","recorded","noop","reversible"]`, so a `null` placeholder fails at the key-order level; `095` excludes the exemption by fixture construction. |
| **R-TP-10 — The row's identity binding drifts: the row folds another repository, or the read writes a binding.** | `020` seeds a foreign record and asserts it changes none of the row's numbers, then asserts the binding file is byte-identical after the read; `021` asserts the same scope rule under both resolution cells (persisted binding, normalized remote) and after a third foreign append; `023` asserts an unresolvable identity fails at exit `2` with no binding created; `094` asserts no binding write and no extra store open on the read path. |
| **R-TP-4 — The shell "non-change" is asserted by running the changed code, so a change hides.** | The controls run the delivered suites and files unmodified (`030`..`033`), and `034` adds the cross-state stdout identity the delivered suite lacks. The plan records the file-level non-change diff as a review attestation (§10). |
| **R-TP-5 — The fleet read accidentally changes the flat alias.** | `022` pins the committed golden and scans for both new fields at every depth; `023` adds the divergence witness (flat alias stays exit 0 while `repos` fails on the same degraded host). Either a leaked field or a leaked read cost fails. |
| **R-TP-6 — The 5,005-record fixture makes the suite slow or flaky.** | `024` is the only large fixture, seeded once per suite through the delivered append path, with printed count and elapsed time; no timing assertion, no network, no sleep. If the cost is unacceptable, the fixture bound is declared by delivery and logged as OQ-TP-5 — not silently reduced. |
| **R-TP-7 — A new module bypasses the inventory/structural lists.** | `090` re-runs `content-inventory`, `dispatch-imports`, and `dispatch-merge-boundary`, all of which fail on an unregistered module; the case also asserts the lists were extended rather than replaced. |
| **R-TP-8 — The documentation checks pass on a deleted page or a renamed heading.** | Every documentation case resolves its target by heading and fails on a missing or empty span (the delivered `m2-queue-page-reconciliation` pattern), and each absence scan asserts its allowlist was non-empty. `TC-ENGINE-065` resolves the two lifecycle paragraphs by their delivered anchors and fails naming the anchor, so a deleted or renamed span cannot pass as "nothing to check". |
| **R-TP-11 — A case re-encodes the repaired defect by expecting exit `2` for a missing credential** (readiness F-2; spec RSK-15). | `TC-ENGINE-052` derives the exit from the resolved row's `projectionClass` (`user-validation` → `1`) and asserts exit `2` **absent** on four invocation cells; `TC-ENGINE-053` derives every matrix exit the same way; `TC-ENGINE-091` pins the projection map itself, so a `config` code cannot reach exit `2` without a map change that case fails; `TC-ENGINE-054`'s `classifyThrown` control is explicitly the classifier's containment of a contradictory pair, never the composition's exit. No case in the plan asserts exit `2` for `config.credential.missing` — a reviewer finding one is a plan defect, not a delivery defect. |
| **R-TP-12 — A truncation case pins an incidental count the repository filter can move** (readiness F-9). | `TC-ENGINE-024` asserts the contract — declared `bound`, positive `omittedRecords` inside the seeded envelope, `verdict: "unverifiable"`, `countedDeliveries < seededIdentityBoundRecords` — and asserts invariance under removal of the foreign record rather than equality against a literal; `TRUNC-ENG-1` records why the literal is not the contract (the bound applies before the scope filter). The same discipline is applied to the scope cases: `SCOPE-ENG-1` asserts a `controlled-proof` seed changes nothing, never a fixed count. |

### 8.2 Assumptions

- The delivered `evaluateHandoverGate`/`foldEvidenceWindow`/`toSummaryData` remain the single producer; this plan asserts the projection and never re-derives a condition (`TC-ENGINE-003` imports the delivered order declaration as its oracle).
- The delivered `readDispatchGate` bounded read (`DISPATCH_MAX_ATTEMPT_RECORDS = 5000`) is what the fleet row consumes, so the row's truncation is the delivered truncation, not a second bound.
- `repos list` already opens each `ready` project store read-only and the flat alias path does **not** pass through `reposListDataOf`; both are delivered facts (`packages/cli/src/production.ts`), so hosting the evaluation on the `repos` projection adds a read and nothing else.
- The production composer's injected seams (`githubTransport`, `credentials`, `gitChildRunner`, `repositoryFacts`, `harnessSpawnRunner`) are sufficient to exercise the merge composition hermetically; the new cases need no new production seam.
- Real temp git checkouts (`createRepository`, `git(...)` with a sanitized environment) are an accepted fixture cost; `tests/fixtures/projects/temp-repos.ts` is the delivered precedent.
- The delivered shell suites and `scripts/lib/dispatch-authority.sh` need no change; a diff to them is a plan violation, not a mechanism choice.
- The delivered identity policy (`packages/core/src/domain/dispatch-identity.ts`) resolves a rename-invariant `host/owner/name` identity from the checkout (persisted binding first, then the normalized configured remote), so the fleet row and the merge composition consume it with no new source (DEC-13, DEC-15).
- The production merge composition exports `MERGE_COMPOSITION_EMITTABLE_CODES` from its own module and the `merge` configuration branch keeps exactly its three declared keys; both are declarations, not delivery choices (DEC-13, DEC-14).
- Exact suite filenames, module paths, and the guide's filename are delivery-bound (GAP-T4); behaviours, identities, orders, exits, configuration-key sets, and AC traceability are not.
- The 5,005-record truncation fixture and the 25-row fleet floor are acceptable at this scale; both print their context and neither asserts latency.
- The fleet row's fold and `dispatch dual-run summary --repo` share one counting scope because the shipped production composition evaluates gate surfaces at `production` and the counting rule has one scope parameter, so declaring it adds no key or flag (DEC-17, TDR-0031 D11); `controlled` remains available to fixtures and is never a row's scope.
- The delivered projection map is authoritative and unchanged (`success → 0`, `user-validation → 1`, `platform-provider → 2`, `attention → 1`), so `config.credential.missing` projecting exit `1` is the declared behaviour and exit `2` on that path is the repaired defect's signature, not a contract (spec §8.5, Appendix E.4).
- The two lifecycle documents can be reconciled by bounded edits: their delivery-process/lifecycle-state paragraphs already make the engine/shell claim in one sentence, so replacing that sentence with the engine-first claim and the shell-as-fallback claim touches no other paragraph (AC-F4-8, AC-F8-12; `TC-ENGINE-065` fails a broader rewrite).

### 8.3 Open Questions

| ID | Question | Status / Owner | Blocking |
|---|---|---|---|
| OQ-TP-1 | Which module declares the production composition's emittable-code set that `TC-ENGINE-054` consumes, and does the declaration cover the branches that only exist after the restoration? | **Resolved (spec v1.1, DEC-14/DM-6):** the production composition exports `MERGE_COMPOSITION_EMITTABLE_CODES`, exhaustive by construction over its refusal branches; `TC-ENGINE-054` imports it from the composition (never a fixture copy) and fails naming the missing export. | No |
| OQ-TP-2 | Which declared source resolves the owner principal? | **Resolved (spec v1.1, DEC-13):** the provider-resolved repository owner — the owner component of the checkout's normalized `host/owner/name` identity — supplied to the composition's declared owner-principal input, with no new configuration key; `TC-ENGINE-050` asserts the waiver effect and the three-key configuration branch. | No |
| OQ-TP-3 | Does `dispatch handover <repo> --revert` on an already-`dual-run` repository read the gate, making a torn ledger refuse the noop at exit `2`? | **Resolved (spec v1.3, DEC-12, Appendix E.1):** it depends which ledger. The noop is answered before the **gate evidence read**, so an unreadable or torn **attempts or divergences** ledger cannot refuse it; it carries `recorded: false`, `noop: true`, `operation: "dual-run"`, `reversible: false`, and no `conditions`/`verdict`/`truncation`. The **folded-handover read that establishes the noop still happens**, so an unreadable or torn **handover** ledger still refuses `dispatch.state-unverified` at its declared exit `2` with no data — the exemption is not a route past a corrupt handover history. Only a recorded revert reads gate evidence and refuses there. `TC-ENGINE-010`/`011`/`012`/`014`/`016` assert the exemption and the gate-read half, `TC-ENGINE-017` the handover-ledger half. | No |
| OQ-TP-4 | What is `reversible` on a `first-use` row? | **Resolved (spec v1.1, AC-F3-6):** `false` — the empty-window evaluation states it field by field; `TC-ENGINE-020` asserts it alongside `countedDeliveries: 0` and the four statuses. | No |
| OQ-TP-5 | Is seeding 5,005 attempt records in one suite acceptable, or should the fleet read expose a declared test seam for the bound? | Open — `@coder` measures; `TC-ENGINE-024` prints elapsed and record count (TRUNC-ENG-1). | No |
| OQ-TP-6 | Which code does the composition emit when no request/PR resolves for a ref? | **Narrowed (spec v1.1, F-7, Appendix E.3):** it must be a code the error table already declares and a member of `MERGE_COMPOSITION_EMITTABLE_CODES` — the change invents no identity. Which declared code is delivery-bound; `TC-ENGINE-053` asserts the chosen code is declared and a constant member, and fails an undeclared pair. | No |
| OQ-TP-7 | Does the restated `SC-M2-S16-03` get its own cross-story entry restated in `test-scenarios.md` (line 534 section) in addition to the M2-S16 section? | Open — `@doc-syncer` reconciles; `TC-ENGINE-062` selects by scenario id, not by section, so either placement passes while a missing restatement fails. | No |
| OQ-TP-8 | How does a `repos list` row learn the repository identity its evaluation folds over? | **Resolved (spec v1.1, DEC-15/DM-7):** through the delivered identity policy for that row's own checkout (persisted create-once binding, otherwise the normalized configured remote), read-only and non-persisting, at no additional store open; foreign records are excluded and an unresolvable identity fails `repos.state-unavailable` at exit `2` with no row. `TC-ENGINE-020`, `021`, `023`, `024`, `093`, `094` assert it. | No |
| OQ-TP-9 | Which evidence scope does the fleet row fold, and can a consumer select another? | **Resolved (spec v1.2, carried unchanged into v1.3, DEC-17, TDR-0031 D11):** the row folds the `production` scope (counting `pilot` attempts), the same scope the summary and the handover decision use, so the row/summary equality is checkable; `controlled`/`controlled-proof` is never the row's scope, and **no scope key or flag exists**. `TC-ENGINE-020`, `021` assert the effect, `TC-ENGINE-022`, `093` assert no selector key (SCOPE-ENG-1). | No |
| OQ-TP-10 | Which exit does a missing-credential merge read project — the row's declared class or the contained fallback's? | **Resolved (spec v1.2, carried unchanged into v1.3, AC-F6-10/AC-F7-11, §8.5, Appendix E.4; readiness F-2):** the row's declared class — `config.credential.missing` (`user-validation`) at exit **`1`**. Exit `2` (`fallback.internal`, `platform-provider`) is the repaired defect's signature and is asserted absent. `TC-ENGINE-052` asserts exit `1` plus zero `fallback.internal` across four invocation cells; `TC-ENGINE-053`/`091` pin the projection derivation. | No |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-17 | @test-plan-writer | Initial test plan against spec v1.0: all 14 ACs (AC-F1-1 … AC-NFR1-14) bound to 44 cases in eight blocks (accrual 001–006, handover 010–016, fleet 020–024, shell/no-flip 030–035, windows/holds docs 040–042, merge/classification 050–055, documentation 060–064, cross-cutting 090–095); all F-1..F-8, NFR-1..NFR-10, DM-1..DM-5, and DEC-1..DEC-11 mapped; both forced scenario restatements encoded as oracles with their unrepresentable originals asserted absent; seven substitute assertions registered (§3.5); eight open questions logged from spec/decision gaps (§8.3); no TODO rows, no orphans. |
| 1.1 | 2026-11-17 | @test-plan-writer | Amendment against spec v1.1's declared seams, short form: 010/011/012/013/014/015/016 assert the idempotent-revert-noop exemption as a declared absence **and** presence on the four evidence-reading outcomes, with the recorded revert refusing `dispatch.state-unverified` at exit `2` under the same torn ledger (DEC-12, NFR-11); 050 asserts the owner principal as the provider-resolved repository owner plus the unchanged three-key `merge` configuration branch (DEC-13); 052/053/054/091 range over the exported `MERGE_COMPOSITION_EMITTABLE_CODES` with non-vacuity, row/kind agreement, and a refusal-site scan (DEC-14, NFR-12); 020/021/023/024/093/094 assert the row's read-only non-persisting binding to its own repository identity, foreign-record exclusion, and the unresolvable-identity failure (DEC-15, NFR-13); 061 asserts the phase-7 handoff of the two broader test specs with no test-planning-alignment claim (DEC-16). NFR-11..NFR-13, DM-6, DM-7, DEC-12..DEC-16 mapped; OQ-TP-1/2/3/4/8 closed and OQ-TP-6 narrowed; GAP-T1/T2/T3/T6 closed and GAP-T7 added. Still 44 cases, 14 ACs covered, no orphans, no case weakened. |
| 1.2 | 2026-11-18 | @test-plan-writer | Amendment against spec v1.2 and amended TDR-0031, closing readiness iteration 1's two test-planning findings and binding the new spec clauses. **F-2 (major):** `TC-ENGINE-052` no longer asserts exit `2`; it asserts the declared projection — `config.credential.missing`, `kind: "config"`, `projectionClass: "user-validation"`, exit **`1`** — derived from `ERROR_TABLE` + `projectExitCode`, and adds the negative assertion that no invocation cell yields `fallback.internal` at exit `2` (zero occurrences in envelope/stdout/stderr across four cells). Every merge case re-checked for the same mis-projection: `051` and `053` now derive their exits from the projection map, `054`'s `classifyThrown` control is labelled as the classifier's containment (never the composition's exit), `091` pins the projection map so a `config` code cannot reach exit `2`, `050` records that its credential cell belongs to `052`, and `055` is unchanged. New `R-TP-11`, `OQ-TP-10`. **F-9 (minor):** `TC-ENGINE-024` and `TRUNC-ENG-1` replace the pinned `{bound: 5000, omittedRecords: 5}` with the contract — imported bound, positive `omittedRecords` inside the seeded envelope, `verdict: "unverifiable"`, `countedDeliveries < seededIdentityBoundRecords`, invariance under foreign-record removal — with the assertion shape stated in the case. New `R-TP-12`. **Spec v1.2 alignment:** DEC-17 bound into §1.1, §3.1 (AC-F3-5 row + decision coverage), §3.2 (DM-4), §3.3 (NFR-10), §3.5 (`SCOPE-ENG-1`), §5.2 (`020`, `021`, `022`, `093`) and the §3.4 matrix (DEC-1..**17**, 17/17); TDR-0031 clause ids bound beside the cases (D8 → `050`; D9 → `052`, `053`, `054`, `091`; D10 → `020`, `021`, `023`, `024`, `093`; D11 → `020`, `021`) with a clause-coverage line; `TC-ENGINE-065` added for the AC-F4-8/AC-F8-12 bounded lifecycle-prose reconciliation (`AGENTS.md` + `doc/guides/change-lifecycle.md`: engine as the regular path, shell as the documented still-executable fallback, zero "retained primary entry points" occurrences, no flip claim, marker facts, no broader rewrite); `TC-ENGINE-064` extended to D1–D11 and the five-outcome table; new §3.6 traces the spec's §17.1 DoD-1..DoD-10 to cases, with DoD-9/DoD-10 declared review-attested and their attestation rows added to §10. Now **45 cases**, still 14/14 ACs covered, no orphans, no case weakened, and no case asserts exit `2` for a missing credential. |
| 1.3 | 2026-11-18 | @test-plan-writer | Clarification pass against **spec v1.3**, closing readiness iteration 3's one major test-planning finding (test_traceability, with a cross_artifact_consistency component). **The gap:** spec v1.3 put the handover-ledger refusal into the acceptance contract (AC-F2-3, NFR-11, Appendix E.1), so the plan's unqualified "0 revert noops refused by ledger readability" and its "still answers under an unreadable or torn ledger" phrasing stated the opposite threshold for the same behaviour, and no case in the 45 asserted the handover-ledger cell. **The fix, in four parts.** (1) **Every unqualified readability claim requalified** to the spec's two-sided form: 0 idempotent revert noops refused by the **attempts or divergences** ledger being unreadable or torn, and 100% of them still refused `dispatch.state-unverified` at their declared exit `2` with no data when the **handover** ledger is unreadable or torn, because the folded-handover read that establishes the noop is still performed — in the front-matter summary, §1 (paragraph 2), §1.1, GAP-T1, AC-F2-3 in §3.1, NFR-11 in §3.3, DM-2 and the `dispatch handover` surface row in §3.2, DoD-2 in §3.6, the titles/objectives/steps/outcomes of `TC-ENGINE-010`, `011`, `014`, R-TP-2, and OQ-TP-3; the bare "evidence read" became "gate evidence read" and the bare "ledger" became "attempts or divergences ledger" wherever a handover ledger could be meant. (2) **New `TC-ENGINE-017`** (handover block, appended after `016`, so no existing id moves) pins the missing cell: an idempotent revert noop with an unreadable or torn **handover** ledger is refused `dispatch.state-unverified` at its declared exit `2` (derived from `ERROR_TABLE` + `projectExitCode`, not transcribed) with no `data`, no record appended, durable state byte-identical — and the case adds the contrast cell (attempts/divergences corrupt, handover intact ⇒ exit `0`) plus an uncorrupted control, so it is the declared mirror of `TC-ENGINE-014` rather than a duplicate of `TC-ENGINE-010`. The delivered `dispatch-handover.test.ts` `TC-HAND-003`, which covers only the clean noop, stays unmodified. Its location field records the **plan phase 3** ownership so the plan writer can bind it in the same phase as `010`..`016`. (3) **New `R-TP-13`** declares the risk the case exists to catch — the folded-handover read dropped or hoisted below the noop branch, turning the exemption into a route past a corrupt handover history. (4) **Citations refreshed** — §2 now binds spec **v1.3** (with the v1.3 clarification recorded), and §3/§1 wording follows. Counts reconciled everywhere: **46 cases** in eight blocks (handover `010`–`017`), §3.4 matrix 46/46 named and 46/46 in §7, §5 preamble "46 in each", AC-F2-3 now **five** cases (`010`, `011`, `014`, `016`, `017`), NFR-11 six, DEC-2 and DEC-12 and TDR-0031 D2 gain `017`. No case weakened, no exit-2 assertion for a missing credential (R-TP-11 intact), all 14 ACs covered, no orphans. |

## 10. Test Execution Log

No case has been executed against an implementation at authoring time; this plan is a verification map. Results are recorded here as delivery proceeds, with the command, the exit status, and a one-line result summary per row (the testing-strategy evidence convention).

**Review attestations to record here at phases 7–10** (not test rows, because they are facts about the tree or about untracked operator state):

| Attestation | Who | Evidence to quote |
|---|---|---|
| Shell non-change: no diff to `scripts/lib/dispatch-authority.sh`, `scripts/deliver-ticket.sh`, `scripts/batch-deliver.sh`, `scripts/pm-liveness.sh`, `scripts/ceo-loop.sh`, `scripts/.tests/test-dispatch-bash-fallback.sh`, `scripts/.tests/test-deliver-ticket.sh` | `@reviewer` | `git diff --name-only <base>...HEAD -- scripts/` output |
| No-flip audit: zero `dispatch.handover` authoritative records attributable to the change in the operator state root | `@reviewer` | state-root listing / record count before and after the change (AMB-ENG-3) |
| Delivered pins extended by appending only: the sixteen-key summary literal, the six-key handover literal, and the sorted-set `REPOS_ENTRY_FIELDS` assertion still exist | `@reviewer` | the two suite diffs showing suffix additions |
| Golden regeneration was deliberate and shows only the three additive summary lines | `@reviewer` | the `tests/fixtures/dispatch/golden/summary.txt` diff |
| `doc/quality/test-specs/` gained no entry (DEC-11) and the two broader specs were reconciled in **phase 7** by `@doc-syncer` (DEC-16), not during test planning | `@doc-syncer`, `@reviewer` | the directory listing plus the two spec diffs landed in the documentation phase |
| The handover exemption stayed exactly one outcome: no evidence-reading outcome omits `conditions`, no second evidence-read-free outcome was added, and the exemption did not become a route past a corrupt handover history — an unreadable or torn handover ledger still refuses the noop `dispatch.state-unverified` at its declared exit `2` with no data (DEC-12, NFR-11) | `@reviewer` | the handover data key sets across the five outcomes, the `data.conditions` presence count, and `TC-ENGINE-017`'s two corruption cells |
| No new configuration key, identity source, or persisted binding was introduced for the owner principal or the row identity (DEC-13, DEC-15) | `@reviewer` | the `merge` configuration key set diff and the identity-binding diff (both empty) |
| The credential-read exit is the declared projection: the merge path refuses `config.credential.missing` at exit `1`, and no delivered test, fixture, or scenario asserts exit `2` for it (spec §8.5, Appendix E.4, RSK-15; R-TP-11) | `@reviewer` | `TC-ENGINE-052`'s run plus `grep -n 'fallback.internal' tests/**` showing no exit-2 expectation on the credential path, and the `config.credential.missing` row facts (`config` / `user` / `user-validation`) |
| The lifecycle-prose edit was **bounded**: only the `AGENTS.md` delivery-process paragraph and the `doc/guides/change-lifecycle.md` lifecycle-state paragraph changed, the "retained primary entry points" claim is gone from both, `AGENTS.md` gained no `ados_distribution` marker, and the guide kept its existing one (AC-F4-8, AC-F8-12; `TC-ENGINE-065`) | `@reviewer` | `git diff -- AGENTS.md doc/guides/change-lifecycle.md` (two paragraph hunks), plus the two zero-occurrence scans |
| **DoD-9 — commit-range gate:** `./scripts/lint-commit-range.sh --base <base>` reported `PASS` (or `SKIP` for its declared no-configuration reason); an unresolved `ERROR` was never recorded as a pass (spec §17.1 DoD-9) | `@reviewer` | the gate's verdict line quoted verbatim, with the base commit |
| **DoD-10 — plan phases closed with evidence:** every declared plan phase is complete and carries its per-phase pm-notes `notes:` evidence (spec §17.1 DoD-10). This is a review-attested item by construction — it is a fact about the change capsule, not about the delivered tree, and no suite may read live lifecycle state | `@pm`, `@reviewer` | `phase list <ref>` output (every phase `complete`) plus one quoted `notes:` entry per phase, and the plan's declared phase ids |

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| — | — | — | No executions yet. |
