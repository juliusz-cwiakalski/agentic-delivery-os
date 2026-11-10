---
change:
  ref: GH-279
  type: fix
  status: Proposed
  slug: dispatch-credential-preflight
  title: "Preflight the truth-read credential before spawn; typed credential and divergence diagnostics"
  owners: [engineering]
  service: delivery-os dispatch engine
  labels: [change, dispatch, credentials, diagnostics, reliability]
  version_impact: minor
  audience: internal
  security_impact: medium
  risk_level: medium
  dependencies:
    internal:
      - dispatch engine (admission, attempt records, divergence records)
      - credential port and its environment-backed implementation
      - harness session port and production harness composition
      - state layer (verified reads, state fence, record validation)
      - status digest collector
      - doctor command definition (test parity only)
      - CLI production composition
    external:
      - GitHub REST API (read-only work-item and pull-request reads)
      - gh CLI (operator-authenticated keyring session; documentation-only bridge)
links:
  decisions: ["TDR-0005", "TDR-0015", "TDR-0019", "TDR-0020", "TDR-0012"]
  related_changes: ["GH-241", "GH-239", "GH-275"]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Refuse a dispatch before it starts a session when the truth-read credential is missing or the first truth read fails, name the exact resolved key without ever printing its value, keep the divergence-resolution path on local evidence so its failures stay typed, and record an honest resolvable divergence when a dispatch delivered work it could not verify — so the engine refuses delivery rather than allowing delivery-without-verdict on an unprovisioned install, and an operator learns the prerequisite in under two seconds.

## 1. SUMMARY

`delivery-os dispatch <ref>` currently claims the queue lease, spawns a full delivery session, and only afterwards discovers that the engine cannot read tracker, CI, or artifact truth. On a default install where only `gh` is authenticated (OS keyring), the production wiring's declared truth-read reference resolves to the literal environment key `GITHUB_TOKEN`, which is unset, so a dispatch can deliver work and then classify `state-unverified` at exit `2` — a delivered change whose verdict cannot be verified, with a `last_message` that names an error code but never the missing key. GH-241 is the concrete instance: its artifact and pull-request evidence show completed delivery, yet the engine could not derive a verdict.

This change adds a pre-session admission preflight as an optional `preflight` port, distinct from the delivered `ports.admission` seam: it resolves the declared truth-read credential and performs one minimal bounded work-item read before the queue lease is claimed. Either failure refuses immediately with an existing typed identity — classified by the preflight from the read's status rather than forwarded from the adapter's code — and a bounded, single-line remediation naming the exact resolved key and the reference, never the value. The chosen policy is to refuse delivery rather than allow delivery-without-verdict on an unprovisioned install. The change also stops the divergence-resolution path from collapsing every local store failure into `dispatch.state-unverified`, clamps the resolution note to its declared bound, records at most one open delivered-evidence divergence per work item, documents the supported provisioning path (including an explicit `gh`-keyring export bridge with least-privilege and rotation guidance that inherits nothing implicitly), and surfaces the same prerequisite in the `status` digest and doctor's existing check.

## 2. CONTEXT

### 2.1 Current State Snapshot

The typed dispatch engine is delivered and is the production one-shot path. It resolves a harness, claims the repository queue lease, spawns or resumes through the harness session port, watches progress, collects evidence, derives the delivery token from artifact, ledger, tracker, and CI truth, and appends one attempt record per classified run. Verification of that truth is the part that needs a credential.

The credential seam is centralized: the credential port resolves a declared reference to secret material at use time, and the environment-backed implementation derives the source key from the reference itself. Production declares one truth-read reference and wires it to a literal key. `gh` authentication is not an engine input at all.

| Component | Location (evidence) | Observed behaviour |
|---|---|---|
| Truth-read credential reference | `packages/cli/src/production.ts` (`githubInstance`) | The GitHub instance declares `referenceName: "github-read"` with a literal source key named `GITHUB_TOKEN`. No alternative key, prefix, or keyring source exists. |
| Credential resolution | `packages/adapters/src/credentials/index.ts` (`resolveCredentialSourceKey`) | A literal key is used verbatim; an environment-prefixed key is `brand.environmentPrefix + suffix`. An absent key and an empty value both fail as `config.credential.missing`; whitespace is a value. |
| Production credential port | `packages/cli/src/production.ts` (`createProcessCredentialPort`) | The process environment is the only credential source in production. With `GITHUB_TOKEN` unset, resolution fails and no request leaves the process. |
| Dispatch run order | `packages/core/src/app/dispatch.ts` (`runDispatch`) | Lease claim, spawn or resume, watch, collect, then truth read. There is no admission-time check, so a missing credential is discovered only after the session ends. |
| Truth-read derivation | `packages/core/src/domain/dispatch-result.ts` (`deriveDispatchResult`) | Any unreadable ledger, tracker, or artifact read yields token `state-unverified`, outcome `failed`, `lastMessage: truth read unreadable (<identity>)`, exit `2`. |
| Divergence recording | `packages/core/src/app/dispatch.ts` | A divergence is appended only when the comparison outcome is `mismatch`. An unverifiable-but-delivered attempt therefore opens none. |
| Divergence resolution | `packages/cli/src/commands/dispatch.ts` → `packages/cli/src/edge.ts` → `packages/core/src/app/dispatch-gate.ts` (`resolveDispatchDivergenceEvidence`) | Every store failure other than `state.keys.missing` is relabelled `dispatch.state-unverified` and carried under the dispatch kind, so the real state code and its domain-kind discriminant never reach the caller. The gate runtime is composed with store, fence, and principal only — no credential, no network. |
| Resolution note handling | `packages/core/src/app/dispatch-gate.ts` (`resolveAppend`) vs `packages/core/src/app/dispatch-ledger.ts` (`resolveDispatchDivergence`) | The ledger function clamps the note to `DISPATCH_MAX_NOTE_CHARS` (240) and the record validator rejects a longer note; the gate path builds the record with the raw note, so an over-long note becomes a write failure that is then collapsed to `dispatch.state-unverified`. |
| Status credential posture | `doc/spec/features/feature-status-digest.md`, `packages/core/src/domain/status.ts` | A missing credential makes the `tracker` and `ci` sections `unknown` with reason `credential-unavailable`. No section, count, or finding names the missing key. |
| Doctor credential posture | `doc/spec/features/feature-doctor.md`, `packages/core/src/domain/doctor.ts` | The `tracker.credential-unavailable` check substitutes `{envVar}` into its fix hint, but doctor is not part of the shipped prompt-required command set. |
| Attempt-record outcome | `packages/core/src/domain/dispatch-result.ts` (`deriveDispatchResult`) | A `state-unverified` attempt is persisted with derived outcome `failed` and token `state-unverified`, so the persisted record cannot evidence delivery. |
| Truth-read read families | `packages/core/src/domain/dispatch-result.ts` (`DISPATCH_READ_FAILURE_SOURCES`) | The closed unreadable-read set is `ledger`, `tracker`, `artifact`, and `state`; there is no `ci` read family. |
| Existing composition tests | `tests/structure/dispatch-composition.test.ts` | Two suites assert that a refusing credential port still spawns once and yields `result=state-unverified` with one attempt record — the exact behaviour this change replaces. |

Observed production evidence (2026-11-10):

```text
dispatch GH-241  ->  result=state-unverified, pr_url=, exit_code=2
                     last_message=truth read unreadable (config.credential.missing)
artifact truth   ->  chg-GH-241-pm-notes.yaml 11/11 phases complete; PR #278 open
resolved path    ->  dispatch dual-run resolve DIV-GH-275-... --note ... -> dispatch.state-unverified
summary path     ->  dispatch dual-run summary --repo ... -> exit 0, unresolved: 1
```

GH-241 is the evidenced harm: a change that was delivered — completed phases, commits, an open pull request — but whose verdict the engine could not verify, because the default install never provisioned the truth-read credential. The chosen policy is to refuse delivery rather than allow delivery-without-verdict on an unprovisioned install. The resolve failure is a separate defect in the same diagnostic area: the local state store is demonstrably readable (the summary reads it), yet resolve reports the truth-read token.

### 2.2 Pain Points / Gaps

- **PP-1 — Delivered work without a verdict.** The engine can complete delivery — branch, commits, pull request — and still classify `state-unverified`, so the change is delivered but its verdict is unverifiable (GH-241). On an unprovisioned install this is the default outcome, not an edge case. The secondary cost is the surprise: the operator learns the prerequisite only after a full session, not before queueing it.
- **PP-2 — Unnameable prerequisite.** No surface names the exact environment key the engine requires. The operator sees `config.credential.missing`, not `GITHUB_TOKEN is unset (reference github-read)`.
- **PP-3 — No supported provisioning path.** Nothing documents how an operator who authenticated with `gh` should make the typed engine work without weakening deny-by-default.
- **PP-4 — Diagnostic collapse on resolve.** Every local store failure during `dispatch dual-run resolve` is reported as `dispatch.state-unverified`, so a busy lock, a torn store, or a failed write is indistinguishable from an unreadable credential.
- **PP-5 — Silent unresolved evidence.** A dispatch that delivered work but could not verify it leaves no resolvable record, so nothing counts against "zero unresolved divergence" and nothing can be closed honestly.
- **PP-6 — Evidence bar unreachable while behaving correctly.** Because every default install yields `state-unverified`, the handover gate's truth condition can never be satisfied even though the engine is correct.
- **PP-7 — Pinned tests defend the defect.** Composition tests currently assert spawn-then-`state-unverified`, so the regression is protected rather than caught.

### 2.3 Users and Operators

| User | Need in this change |
|---|---|
| Delivery operator (human) | Learn the prerequisite before queueing work, know the exact key to set, and understand why a default `gh` install is not enough. |
| Coordinator / automation agent | Branch on a stable error identity, read a machine-usable refusal, and distinguish a precondition refusal (nothing started) from an attempt-stage outcome. |
| Maintainer of the dispatch engine | Keep attempt and divergence ledgers trustworthy, and keep every refusal and resolution failure typed instead of collapsed. |
| Security reviewer | Confirm that only key names are ever rendered and that no ambient or keyring inheritance was introduced. |

## 3. PROBLEM STATEMENT

Because the dispatch engine resolves the truth-read credential and performs its truth read only after the session has run, and because the refusal names an error code rather than the missing environment key, a default `gh`-authenticated install delivers work whose verdict the engine can never verify — GH-241 is the evidenced instance — and the chosen policy is to refuse delivery rather than allow delivery-without-verdict. The operator also pays a full session before learning the prerequisite and receives an unactionable `state-unverified`; meanwhile the divergence-resolution path reports the same token for unrelated local store failures, so the resulting evidence can be neither understood nor closed.

## 4. GOALS

- **G-1**: Refuse a dispatch before any session exists when the truth-read credential is unresolvable or the first bounded truth read fails, with zero dispatch-ledger side effects and under two seconds for the missing-credential case.
- **G-2**: Name the exact resolved environment key and the credential reference in every credential refusal, and never render the value.
- **G-3**: Keep divergence resolution on local evidence only, preserve the underlying typed state identity and remediation with the correct domain-kind discriminant, and clamp the resolution note before it is recorded.
- **G-4**: Record at most one open, locally resolvable delivered-evidence divergence per (repository, work-item reference) when a dispatch delivered evidenced work but could not verify it, count it as unresolved until it is resolved, and let a resume or another unverifiable delivered attempt reference the existing open divergence instead of appending a second.
- **G-5**: Document the supported provisioning path, including an explicit export bridge for a `gh`-authenticated environment that inherits nothing implicitly, with least-privilege and rotation guidance for the exported token.
- **G-6**: Surface the same prerequisite to the operator before work is queued, through the status digest and doctor parity.
- **G-7**: Leave the delivery-result vocabulary, the exit projection, the error-table identity count, the config surface, the credential reference model, and the bash fallback unchanged.
- **G-8**: Classify a failing admission read, in the preflight, by its outcome — authentication, outage, malformed payload, or an item the provider reports absent — without introducing a new error identity or forwarding the adapter's collapsed code.

### 4.1 Success Metrics / KPIs

| Metric | Target for this change |
|---|---|
| Missing-credential dispatch refusal latency (p100, reference environment) | < 2 000 ms |
| Sessions spawned or resumed on any preflight refusal | 0 |
| Leases claimed, branches created, writes to the dispatch/attempt/divergence/handover/authority ledgers, and divergences opened on a preflight refusal | 0 each |
| Credential refusals whose bounded summary and human diagnostic name the resolved key and reference | 100% |
| Credential values appearing in any envelope, summary, diagnostic, evidence reference, or record | 0 |
| Failing admission reads classified by the preflight from the failure's status (401/403, 5xx or other non-2xx, status-absent transport, malformed 2xx, 404) with identity, kind, and projection | 100% per the F-2 mapping |
| Resolve failures reported as `dispatch.state-unverified` while the local store is readable | 0 |
| Resolution notes over 240 characters that fail to append | 0 |
| Open delivered-evidence divergences per (repository, work-item ref) | ≤ 1 at any time |
| Unverifiable attempts without delivered evidence that open a divergence | 0 |
| Real credentialed dispatches reaching a verdict other than `state-unverified` (manual PR evidence) | 1 of 1 |
| New delivery-result tokens, error-table identities, or configuration keys | 0 |
| `dispatch` commands or flags added | 0 |

### 4.2 Non-Goals

- **NG-1**: Shipping `doctor` or changing the prompt-required command inventory, its help surface, or its conformance pins (D5).
- **NG-2**: Reading the `gh` keyring, the ambient parent environment, or any implicit token fallback on the engine's behalf (D4).
- **NG-3**: Adding token fallback keys (`GH_TOKEN`, a prefixed variant, or a key chain) or changing the declared-reference model.
- **NG-4**: Changing the delivery-result taxonomy, the projection classes, the exit table, or the meaning of `state-unverified` as a derived token.
- **NG-5**: Adding a new error-table identity; existing identities carry every new refusal.
- **NG-6**: Changing post-session truth derivation, attempt-stage failure mapping, restart economics, liveness, handover thresholds, or the four-condition gate predicate.
- **NG-7**: Resolving the pre-existing `DIV-GH-275-…` divergence (it is the evidence that motivated D2, not scope) or backfilling divergences for historical attempts.
- **NG-8**: Applying the preflight to daemon-driven lane launches.
- **NG-9**: Real network or real harness execution inside the test suite; provider facts stay injected.
- **NG-10**: Any change to the bash delivery scripts or their authority read.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|---|---|---|
| F-1 | Pre-session credential and truth-read preflight | Converts an expensive post-session surprise into a one-second precondition refusal with no side effects. |
| F-2 | Named-source refusal diagnostics with a preserved typed identity | An unnameable prerequisite is unactionable; the identity keeps automation branching stable. |
| F-3 | Type-preserving, local-only divergence resolution | A readable store must not be reported as an unreadable credential; the note must not turn into a write failure. |
| F-4 | Divergence recording for an unverifiable-but-delivered dispatch | Delivered work that could not be verified must leave a resolvable, counted obligation instead of silence. |
| F-5 | Supported credential provisioning path and explicit bridge | Operators need a sanctioned way to make an authenticated environment usable without weakening deny-by-default. |
| F-6 | Operator prerequisite surface in `status`, with doctor parity | The prerequisite must be visible before work is queued, not only at dispatch time. |

### 5.1 Capability Details

#### F-1 — Pre-session credential and truth-read preflight

1. The preflight enters the engine as an **optional `preflight` port**, explicitly distinct from the delivered `ports.admission` seam: `ports.admission` is a delivered pre-spawn decision whose refusal still appends an attempt record, while `preflight` is an admission precondition that refuses with zero attempt, divergence, handover, or authority records. Production composition always supplies the preflight port; a direct engine caller may omit it and keep its current behaviour, so the engine stays runtime-neutral and I/O-free.
2. The preflight runs after harness resolution and input validation and **before** the queue-lease claim (`claimLease`), before any spawn or resume, and before any attempt, divergence, handover, or authority record exists.
3. The preflight resolves the declared truth-read credential reference through the credential port.
4. When resolution fails, the preflight refuses without performing the bounded read, so zero requests leave the process.
5. When resolution succeeds, the preflight performs exactly one minimal bounded truth read for the work-item reference: one work-item (or equivalent single-entity) read with no pagination, no retries, and the existing per-request timeout. The preflight classifies that read's outcome itself, from the failure's optional provider status, and does not forward the adapter's identity: the delivered adapter collapses an outage, a rejected credential, and a malformed payload into one code (F-2.4). The outcome maps to an existing identity by outcome, never a blanket identity.
6. A refusal returns the ordinary top-level error envelope with the underlying typed identity, a bounded single-line summary, and the projection the taxonomy assigns to that identity. No session, branch, worktree, lease, attempt record, divergence record, handover record, or authority-view change is created. A pre-session refusal is not durably recorded in the invocation audit ledger either: that ledger is out of scope for this change, so repeated misconfiguration is not observable after the fact (accepted residual, RSK-12).
7. A successful preflight leaves no record of its own and does not alter the subsequent run: the post-session truth read is unchanged.
8. The preflight applies to a fresh dispatch and to a resume alike, because both would otherwise spend a session on unverifiable work.
9. The missing-credential path completes within the latency bound in NFR-1; the read path is bounded only by the delivered read timeout and adds no new configuration key.
10. When the declared instance exposes no resolvable repository target, the minimal read cannot be issued at all: the preflight refuses immediately with the existing `input.value.rejected` (`kind: "input"`, user, non-retryable, `not_landed`, user-validation projection, exit `1`), naming the unresolvable repository target, issuing zero requests and creating zero sessions or records. The refusal reuses the composition's existing identity for an unresolvable repository identity rather than introducing a new one, and it is part of the preflight's admission contract so that no admission-read branch is untraceable.

**Rationale.** The engine already knows what it needs; it merely asks too late. Moving the question to admission removes the delivered-but-unverifiable outcome without changing what a successful dispatch does.

#### F-2 — Named-source refusal diagnostics with a preserved typed identity

1. A credential refusal names, in a bounded single line, the exact resolved environment key, the credential reference that produced it, and one actionable remediation.
2. The key name is the fully derived key: a literal reference reports its declared name verbatim, and an environment-prefixed reference reports prefix plus suffix, never the bare suffix.
3. The refusal never renders, echoes, hashes, truncates-for-display, or otherwise exposes the credential value or any part of it.
4. An unresolvable credential carries `config.credential.missing` (user, non-retryable, `not_landed`, exit `1`) under the existing `config` kind. A failing minimal read is classified by the preflight itself, keyed by the failure's optional provider status, and never by the adapter's own code. The delivered GitHub work-item read explains why: it maps only 404 to `provider.not-found`; it returns `provider.payload.invalid` **with** `httpStatus` for every other non-2xx response; it returns `provider.payload.invalid` **without** a status for a thrown or timed-out request; and a malformed 2xx payload also yields `provider.payload.invalid` with no status as delivered, because the normalizers never receive the response status. Forwarding that code would report an outage, a rejected credential, and a malformed payload interchangeably. The required mapping, so no new identity is introduced and the exit table is untouched:
   - status 401 or 403 → `provider.auth.rejected` (user, non-retryable, `not_landed`, user-validation projection, exit `1`).
   - status in the 5xx range → `provider.outage` (transient, retryable, `not_landed`, platform-provider projection, exit `2`).
   - status 404 → `input.value.rejected` (user, non-retryable, `not_landed`, user-validation projection, exit `1`), with a bounded summary stating that the provider reported the work item as absent for this credential and naming the work-item reference. The summary must not assert that the reference itself is wrong, because an item the credential is not scoped to see answers 404 exactly like an absent one at this surface (RSK-17).
   - any other status-bearing non-2xx response (for example 429, 422, or 400) → `provider.outage` (transient, retryable, `not_landed`, platform-provider projection, exit `2`).
   - no status at all (a thrown or timed-out request, no response received) → `provider.outage` (transient, retryable, `not_landed`, platform-provider projection, exit `2`). This is the only status-absent outcome.
   - a malformed or unparsable 2xx payload → the existing adapter-local `provider.payload.invalid` at its delivered platform-provider projection. The chosen discriminator makes this outcome **status-present**: the bounded read stamps the received 2xx status onto the decode failure, so a malformed 2xx carries the status it received while only the transport throw is status-absent. As delivered, the adapter reports both without a status; the preflight must therefore keep the pair distinguishable through that stamp, through an equivalent additive optional discriminator on the failure, or through a probe that classifies the payload before normalization. Which mechanism is used is a delivery choice; the observable requirement is fixed — a malformed 2xx stays distinguishable from a status-absent transport throw and must not become `provider.outage`. AC-F2-6 and Appendix A state this same status-present/status-absent pairing.
5. Each mapped identity is emitted with its own domain-kind discriminant: `provider.auth.rejected`, `provider.outage`, and `provider.payload.invalid` carry `kind: "provider"`; `input.value.rejected` carries `kind: "input"`; and the credential refusal `config.credential.missing` carries the existing `kind: "config"`. `classifyDomainKind` matches kind and code exactly, so a correct code carried under any other kind classifies as `fallback.internal` and loses the identity; identity, kind, projection, and exit are therefore asserted together. `provider` and `config` are both already declared domain kinds, so this adds no error-table identity and no new `DOMAIN_KINDS` member; what changes is that the dispatch engine's result error-kind union is widened additively to admit the existing `provider` and `config` kinds.
6. The same bounded facts reach both the machine envelope and the human diagnostic; a machine consumer reads the error object, and the summary is prose beside the identity, never a replacement for it.
7. Where the taxonomy's remediation hint is generic, the refusal supplies a more specific bounded hint without changing identity, category, retryability, consequence, or projection.

**Rationale.** `config.credential.missing` is the correct identity but an insufficient message. Naming the key is the whole operator value of the change; printing the value would be the whole risk.

#### F-3 — Type-preserving, local-only divergence resolution

1. `dispatch dual-run resolve` works from local evidence only: it consults no credential port, performs no network call, and reads no truth source outside the local state store and the divergence ledger.
2. Any local store failure other than the distinguishable not-found case is surfaced as its own typed state code with the correct domain-kind discriminant: the failure carries `kind: "state"` with that code, so it classifies to that row's category, retryability, consequence, remediation, and projection — for example `state.lock.busy`, `state.store.torn`, `state.write.failed`, `state.storage.exhausted`, `state.schema.mismatch`, or `state.permission.denied`, drawn from the delivered closed state vocabulary. A `{ kind: "dispatch", code: "state.lock.busy" }` pair would classify to `fallback.internal` and lose the identity, so a state code is never carried under the dispatch kind. No local store failure is ever reported as `dispatch.state-unverified`.
3. A divergence identifier that does not exist in the ledger is a distinguishable not-found, not `state.keys.missing` (which is a genuine store key-set failure): the not-found branch maps to `input.value.rejected` with `kind: "input"` and appends nothing.
4. The resolution note is clamped to the declared 240-character bound **before** the record is built and validated, on every resolution path, so an over-long note can never become a write failure.
5. A successful resolution appends one resolved record, leaves the original open record byte-identical, reports the resolved state and the stored note, and is idempotent on replay (already resolved is a noop that reports the existing record).
6. The resolve path's success payload, bounds, principal, and timestamps are unchanged.
7. Failure text for a store fault names the store fault and its remediation; it never mentions a credential, because resolve resolves no credential.

**Rationale.** The observed `dispatch.state-unverified` from resolve was a mislabelled local failure, not a credential failure. Preserving the typed identity makes the remedy obvious and stops a diagnostic collapse from masquerading as a security prerequisite.

#### F-4 — Divergence recording for an unverifiable-but-delivered dispatch

1. "Delivered evidence" is a local, credential-free fact: the shared harness classifier's outcome is `completed`, evaluated at record time, and the phase ledger is readable and shows progress (`ledger.progressed`) or a complete ledger (`ledger.total > 0` and `completed === total`). The persisted attempt record's derived outcome must not be used: for `state-unverified` it is `failed`, so it cannot evidence delivery.
2. When a dispatch is delivered by that definition and a truth read is unreadable, the dispatch records the divergence and the attempt in one step, **divergence first**: it appends a new open divergence only when no open delivered-evidence divergence already exists for the same (repository, work-item reference); otherwise it reuses and references the existing one (item 6). The divergence append precedes the attempt append because the attempt record carries the `divergenceRef` (item 4), so the pair is never written with a forward reference.
3. The divergence carries `comparisonClass: "not-applicable"`, `engineToken: "state-unverified"`, `comparisonToken: null`, evidence references `attempt:<attemptId>` plus one bounded `truth:unreadable:<reason>` reference, the resolved repository identity, the work-item reference, the attempt id, and the recording timestamp. `<reason>` is the failing read family from the delivered closed dispatch read set — `ledger`, `tracker`, `artifact`, or `state`; there is no `ci` read family.
4. The attempt record carries that `divergenceRef`, so the attempt and the divergence are mutually traceable. If the divergence append lands and the attempt append then fails, the attempt is not fabricated and the command does not report success: it returns the underlying state identity, and the already-landed divergence remains in the ledger, still listed by the summary and still counted as unresolved, and it stays resolvable through the local resolve path (F-3). Its `attempt:<id>` evidence reference then names an attempt that never landed; that is an accepted, documented orphan (RSK-18), and a later attempt for the same (repository, work-item reference) may reference the orphan through the per-work-item dedupe (item 6) instead of opening a second divergence. The other append direction is bounded too: when the divergence append itself fails, exactly one attempt is appended with no `divergenceRef` and a bounded `divergence:append-failed` evidence reference, no divergence is fabricated, and the underlying state identity is returned rather than a silent success.
5. No divergence is opened when delivery evidence is not established: a classifier outcome other than `completed`, an unreadable ledger, or a ledger with no progress and an incomplete total all leave the attempt as exposure-only evidence.
6. At most one OPEN delivered-evidence divergence exists per (repository, work-item reference). A resume or another unverifiable-but-delivered attempt for the same work item reuses and references the existing open divergence instead of appending a second; the new attempt's `divergenceRef` points at it. This applies equally to the orphan left by a failed attempt append (item 4): a later attempt for the same pair may reference it and thereby complete the pair. A new divergence may open only after the previous one is resolved.
7. An open divergence from this path participates in the existing summary as an unresolved divergence; the summary lists its identifier and counts it until it is resolved. Resolving it through F-3 reduces the unresolved count by one.
8. The underlying failure identity remains visible on the attempt's bounded `last_message`, so a resolver can see why the attempt was unverifiable without consulting a credential.
9. This capability amends **four** TDR-0015 assertions, recorded as DEC-3 and carried by TDR-0020 as the durable home — not two, and not a supersession: the §1 `Truth(W)` clause that a not-applicable comparison "is never a divergence"; the §1 `Coverage(W)` clause that a `state-unverified` attempt "creates no divergence"; the §1 record-level degradation clause that unevaluable evidence "does not create a divergence"; and the §5 rule that a divergence record is appended iff the comparison outcome is `mismatch`. For the delivered-evidence case only, such an attempt records at most one open divergence per (repository, work-item reference) and it counts as unresolved until resolved. Each of the four affected assertions carries an additive note in TDR-0015 linking to TDR-0020; every other gate condition, evidence class, window rule, floor, corroboration rule, comparison family, and identity rule is unchanged.

**Rationale.** Silent unevaluable evidence is invisible in the one place that matters. A resolvable divergence converts an unexplainable gap into a bounded obligation an operator can close from local evidence.

#### F-5 — Supported credential provisioning path and explicit bridge

1. A new operator guide documents the exact key the production truth-read reference requires (`GITHUB_TOKEN`, reference `github-read`), that the reference is declared data, and that only an environment source is supported.
2. The guide documents the explicit bridge for a `gh`-authenticated environment: export the key from the authenticated `gh` session in the operator's own shell (command-substitution form, so the value is never printed), then re-run dispatch.
3. The guide states plainly that the engine never reads the keyring, never inherits ambient variables implicitly, and never falls back to another key; provisioning is an explicit operator act.
4. The guide includes shell-history hygiene guidance, least-privilege guidance for the exported token (a read-scoped credential where the provider supports one), rotation and revocation guidance for any token exported into an environment, and the diagnostic path to follow when the key is set but rejected. On a pre-session 404 refusal it tells the operator to verify the reference **and** to check the token's scope and repository access first, because a private resource the credential cannot see answers 404 exactly like an absent one.
5. The dispatch reference page documents the new refusal: its ordering after harness resolution and input validation and before `claimLease` and spawn, the named key and reference, the status-keyed identity and kind mapping and exits, the 404 scope caveat, and how an unverifiable-but-delivered divergence is resolved and deduplicated per work item.
6. Documentation changes no behaviour: no new command, flag, or configuration key is introduced, and the help inventory stays pinned.
7. The new guide declares its distribution marker and passes the documentation-distribution drift guard, as every changed document under the guides area must.
8. The guide records that the truth-read key is not currently registered for serialization redaction by the config-catalog path, and the change registers the resolved truth-read key for redaction at the runtime edge when it is present, consuming injected environment facts and adding no new ambient read.

**Rationale.** The prerequisite existed only in code. Documentation with an explicit export is the smallest supported path that keeps deny-by-default intact.

#### F-6 — Operator prerequisite surface in `status`, with doctor parity

1. When the truth-read credential is unresolvable, the status digest's credential-dependent sections report the prerequisite as failed evidence with the existing closed reason `credential-unavailable`; the sections are never `observed`, never clear, and never zero.
2. The evidence record of such a section carries one additive optional section-level field, `credentialPrerequisite: { referenceName, sourceKey }`, holding identifier-only names, so the operator sees which key is required without running dispatch. The field is present only when that credential-dependent source failed, and is absent on a readable section.
3. The prerequisite is a sibling of the bounded `sources[]` list, not an extra source entry: the delivered source-entry shape `{ source, outcome, failureCode?, failureClass? }` and its six-entry bound are unchanged, and no evidence entry is added. The additive optional field stays within the existing digest schema version; no section is added, removed, or reordered, no state value is added, no finding code is added, and no existing field changes meaning.
4. Status keeps its delivered command contract: exit `0` with a complete nine-section digest on every readable run, no repair, no credential resolution beyond the existing declared reference, and no new read.
5. Doctor keeps parity through its existing `tracker.credential-unavailable` check, whose fix hint already substitutes the environment variable name; a regression test pins that the hint names the resolved key, and that doctor remains outside the shipped prompt-required command set (D5).
6. No surface echoes the credential value; the prerequisite facts are names and states only.

**Rationale.** A refusal at dispatch time is still after the operator decided to queue work. The status digest is where that decision is made, and doctor's existing check already models the condition.

## 6. USER & SYSTEM FLOWS

```text
Flow 1 — Admission with a provisioned credential
  operator: dispatch GH-279
    -> resolve harness (flag wins over configuration)
    -> validate input
    -> PREFLIGHT: resolve declared truth-read credential (success)
                 one bounded work-item read (success)
    -> claim repository queue lease
    -> spawn or resume, watch, collect
    -> post-session truth read (unchanged)
    -> derive token, append attempt record, render text or envelope

Flow 2 — Admission with no credential (the defect being replaced)
  operator: dispatch GH-279
    -> PREFLIGHT (optional `preflight` port, before `claimLease`):
       credential reference `github-read` resolves to key GITHUB_TOKEN
       key is unset -> refuse, no request issued
    -> top-level error envelope: config.credential.missing, exit 1, summary names
       the key and the reference plus one remediation
    -> no lease, no session, no branch, no attempt, no divergence, no authority change
    -> total elapsed < 2 s

Flow 3 — Admission with a credential, unreadable first read
  operator: dispatch GH-279
    -> PREFLIGHT: credential resolves; one bounded work-item read fails:
       401/403                        -> provider.auth.rejected, exit 1
       5xx / other status-bearing     -> provider.outage, exit 2
       no status (throw / timeout)    -> provider.outage, exit 2
       malformed 2xx payload          -> provider.payload.invalid, platform-provider
       404 (provider reports the item absent; a private item the token cannot
            see answers the same way)  -> input.value.rejected, exit 1,
                                          summary names the ref, never calls it wrong
    -> refuse pre-session; no lease, no session, no attempt

Flow 4 — Delivered but unverifiable
  dispatch GH-279 (credential valid at admission, truth read fails after the session)
    -> shared classifier outcome completed at record time; phase ledger readable and
       progressed (the persisted attempt outcome `failed` is not used)
    -> truth read unreadable -> token state-unverified (unchanged)
    -> one attempt record + one OPEN delivered-evidence divergence, or a reference to
       the existing open divergence for this (repository, work-item ref) on a resume
       (not-applicable, state-unverified, comparison token null,
        evidence: attempt:<id>, truth:unreadable:<reason>)
    -> text output unchanged; summary now reports unresolved: 1
  operator: dispatch dual-run summary --repo <repo>       -> lists the divergence, exit 0
  operator: dispatch dual-run resolve <divergence-id> --note "..." -> local only, exit 0
    -> one resolved record appended; unresolved count decreases; the attempt and
       divergence stay auditable; a later unfixable attempt may open a new one

Flow 5 — A local store fault during resolution (not a credential fault)
  operator: dispatch dual-run resolve <divergence-id> --note "..."
    -> local verified read fails with state.lock.busy
    -> envelope: {kind: "state", code: "state.lock.busy"}, transient, retryable,
       platform-provider, exit 2, remediation: wait for the current writer to release
       the fence
    -> no credential consulted, no network call, no record appended
  operator: dispatch dual-run resolve <absent-id> --note "..."
    -> distinguishable not-found -> {kind: "input", code: "input.value.rejected"},
       exit 1, nothing appended (never state.keys.missing)

Flow 6 — The operator learns the prerequisite before queueing
  operator: status
    -> tracker and ci sections: unknown, evidence failed, reason credential-unavailable,
       evidence record carries credentialPrerequisite
       { referenceName: github-read, sourceKey: GITHUB_TOKEN }
    -> exit 0 with all nine sections
  operator: export GITHUB_TOKEN="$(gh auth token)"   (explicit, documented)
  operator: status                                    -> credential evidence satisfied
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- C1: Pre-session credential and truth-read preflight as an optional `preflight` port with typed refusal, zero dispatch-ledger side effects, and the missing-credential latency bound (F-1, F-2).
- C2: Typed, non-collapsing diagnostics on the resolution path, including the correct domain-kind discriminant, a distinguishable not-found signal, and note clamping (F-3).
- C3: Deduplicated divergence recording for an unverifiable-but-delivered dispatch, with summary counting and local resolution (F-4).
- C4: Supported provisioning documentation, including the explicit `gh`-keyring bridge with least-privilege and rotation guidance, and the dispatch reference-page update (F-5).
- C5: Operator prerequisite surface in `status`, doctor parity test, and doctor remaining unshipped (F-6).
- The test inversions, corpus additions, and conformance pins needed to make the above regression-proof.

### 7.2 Out of Scope

- [OUT] Shipping `doctor`, adding it to the prompt-required command set, or changing its help inventory.
- [OUT] Reading the OS keyring, the ambient environment, or any implicit token source on the engine's behalf.
- [OUT] Adding fallback key names or a key-resolution chain.
- [OUT] Changing the delivery-result taxonomy, projection classes, exit codes, or the error-table identity count.
- [OUT] Changing post-session truth derivation, attempt-stage failure mapping, restart economics, liveness, handover thresholds, or the four-condition gate predicate beyond the divergence-record amendment in F-4/DEC-3.
- [OUT] Applying the preflight to daemon-driven lane launches.
- [OUT] Resolving the pre-existing `DIV-GH-275-…` divergence, or backfilling divergences for historical attempts.
- [OUT] Real network, real `gh`, real keyring, or real harness execution in any test.
- [OUT] Any change to the bash delivery scripts, the authority view, or the fallback path.
- [OUT] New configuration keys, new commands, or new flags.
- [OUT] Durably recording a pre-session refusal in the invocation audit ledger; repeated misconfiguration is therefore not observable after the fact (accepted residual, RSK-12).

### 7.3 Deferred / Maybe-Later

- Daemon-lane admission preflight on the shared lane seam (the daemon entry is owned by the resident-daemon change).
- A standalone read-only preflight command (for example a `dispatch --check`-style probe) if operators ask for it separately from dispatch.
- A credential sidecar or keyring-backed credential-port implementation as a second port implementation.
- Backfilling divergence records for the historical unverifiable attempts that motivated this change.
- Durable invocation-audit recording of pre-session refusals, as a separate change.
- Doctor's inclusion in the shipped command inventory, as a separate decision.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

No endpoint is added, removed, or changed. The preflight issues at most one bounded read against the existing delivered GitHub work-item read for the reference, through the same declared instance, credential reference, injected transport, and per-request timeout as the post-session truth read. It sends no write, no pagination parameter, and no retry. The preflight classifies that read's outcome itself from the failure's optional status rather than forwarding the adapter's code (F-2.4): status 401/403 to `provider.auth.rejected`; status 5xx, any other status-bearing non-2xx, and a status-absent transport failure to `provider.outage`; a malformed 2xx payload (status-present: the received 2xx status is stamped onto the decode failure) to the adapter-local `provider.payload.invalid`; and status 404 to `input.value.rejected`. The three provider identities carry `kind: "provider"`, the 404 refusal carries `kind: "input"`, and the credential refusal carries `kind: "config"`. When the declared instance has no resolvable repository target, no request is issued at all and the refusal is `input.value.rejected` with `kind: "input"` (F-1.10).

### 8.2 Events / Messages

None. No event, message, queue notification, or telemetry record is added. The dispatch attempt record, divergence record, and handover record kinds keep their schemas and versions. A pre-session refusal appends no invocation-audit record in this change; that ledger is out of scope (accepted residual, RSK-12).

### 8.3 Data Model Impact

| ID | Element | Description |
|---|---|---|
| DM-1 | Preflight refusal facts | The bounded, identifier-only facts a refusal carries: resolved source key name, credential reference name, failing read family (for a read refusal), the work-item reference for a 404, the unresolvable repository target when the declared instance has none, the underlying typed identity, and that identity's domain-kind discriminant — `provider` for the three provider identities, `input` for the absent work item and the unresolvable repository target, `config` for the unresolvable credential — because a correct code under the wrong kind classifies as `fallback.internal`. Names and closed tokens only; never material. |
| DM-2 | Delivered-evidence divergence record | An open divergence appended from the unverifiable-but-delivered path: `comparisonClass: "not-applicable"`, `engineToken: "state-unverified"`, `comparisonToken: null`, evidence references `attempt:<attemptId>` and `truth:unreadable:<reason>`, plus the existing repository, ref, attempt id, state, and timestamp fields. Same record kind and schema version; no new field kind. |
| DM-3 | Attempt/divergence correlation | The attempt record carries the `divergenceRef` of the divergence it opened, or of the existing open delivered-evidence divergence it reused; the field already exists in the attempt record contract. |
| DM-4 | Status credential-prerequisite field | An additive optional section-level `credentialPrerequisite: { referenceName, sourceKey }` on the status evidence record of a credential-dependent section, carrying identifier-only names and present only when that section's credential-dependent source failed. It is a sibling of the bounded `sources[]` list, so the delivered source-entry shape and its six-entry bound are unchanged and no evidence entry is added. Within the existing digest schema version; no new section, state, or finding code. |
| DM-5 | Resolve failure diagnostic | The resolution path's failure carries `kind: "state"` with the underlying state code and that row's own projection and remediation; the distinguishable not-found branch carries `kind: "input"` with `input.value.rejected`. No new identity; no shape change in the success payload. |
| DM-6 | Delivered-evidence dedupe key | The (repository, work-item reference) pair bounds the open delivered-evidence divergence population to at most one; resumes and further unverifiable-but-delivered attempts for the same pair reference the open record instead of appending. |

### 8.4 External Integrations

| Integration | Change |
|---|---|
| GitHub REST API | One additional bounded read per dispatch admission, using the existing instance, credential reference, and transport. No new endpoint or scope. |
| `gh` CLI | Not invoked by the product at any point. It appears only in documentation as the operator's own authenticated source for an explicit export. |
| OS keyring | Never read by the product. Documented as the reason a default install is unprovisioned, and as the source the operator's explicit export may draw from. |

### 8.5 Backward Compatibility

- **Engine callers.** The preflight is an optional injected port. A caller that supplies none keeps the current run order and outcome; no direct engine consumer breaks.
- **Tokens and exits.** The eleven tokens, projection classes, derivation classes, and `{0, 1, 2}` exits are unchanged. `state-unverified` keeps its meaning as the derived token when truth could not be read after a session.
- **Refusal classification.** A dispatch that previously produced an attempt-stage `state-unverified` after a full session now produces a pre-session refusal in one of five forms: `config.credential.missing` at exit `1`; `provider.auth.rejected` at exit `1`; `provider.outage` at exit `2`; `provider.payload.invalid` at its platform-provider projection; or, for an item the provider reports absent, `input.value.rejected` at exit `1`. The three provider identities carry `kind: "provider"`; the 404 refusal and the input refusal carry `kind: "input"`. Consumers that treated every failed dispatch as exit `2` with one attempt record must treat these as precondition failures, because there is no attempt record to read.
- **Resolution classification.** A resolve failure that previously reported `dispatch.state-unverified` now carries `kind: "state"` with the real state identity and that row's exit; an absent divergence identifier carries `kind: "input"` with `input.value.rejected`. This is a deliberate behavioral correction; the message and remediation become more accurate, and the identity set does not grow.
- **Divergence population.** An unverifiable-but-delivered attempt opens at most one open divergence per (repository, work-item reference); a resume or another unverifiable delivered attempt references the existing open divergence. Summaries over the same ledger therefore report at most one unresolved divergence per such pair until it is resolved. Historical attempts are not backfilled.
- **Status envelope.** The digest gains one additive optional section-level `credentialPrerequisite: { referenceName, sourceKey }` on credential-dependent section evidence records, present only when that source failed; the `sources[]` entry shape and bound are unchanged, so existing consumers that ignore unknown optional fields are unaffected. Section states, counts, ordering, and exits are unchanged.
- **Doctor.** Unchanged in behavior and availability; only a regression test is added.
- **Bash fallback.** Unchanged. It reads the authority view and never invokes the typed engine.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|---|---|---|
| NFR-1 | Missing-credential refusal latency | p100 < 2 000 ms on the reference environment, measured from handler entry to envelope; zero network requests in that path |
| NFR-2 | Secret non-disclosure | 0 credential values, substrings of values, or value-derived digests in envelopes, human diagnostics, summaries, evidence references, attempt records, divergence records, or logs; a planted-secret canary run detects any escape |
| NFR-3 | Side-effect freedom on refusal | 0 sessions, 0 resumes, 0 branches, 0 worktrees, 0 lease records, 0 attempt records, 0 divergence records, 0 handover records, 0 writes to the dispatch/attempt/divergence/handover/authority ledgers, 0 authority-view changes. The invocation audit ledger is out of scope: a pre-session refusal is neither written nor used as evidence, so repeated misconfiguration is not observable after the fact (accepted residual, RSK-12) |
| NFR-4 | Determinism | Identical injected inputs (including clock and id factory) produce byte-identical refusal envelopes, resolve envelopes, and divergence records across runs |
| NFR-5 | Bounded diagnostics | Refusal summary ≤ 240 characters, single line, no newline; `last_message` ≤ 512 characters; resolution note clamped to 240 characters before validation; evidence references ≤ 16 per record |
| NFR-6 | Read budget | At most 1 credential resolution and 1 bounded work-item read per admission; 0 pagination, 0 retries, 0 concurrent reads added |
| NFR-7 | Resolve isolation | 0 credential resolutions, 0 network calls, 0 truth reads on `dispatch dual-run resolve`, proven by injected spy ports |
| NFR-8 | Vocabulary and table stability | 0 new delivery-result tokens, 0 new `DOMAIN_KINDS` members (the dispatch engine's local result error-kind union is widened additively to admit the existing `provider` and `config` kinds), 0 new error-table identities (machine and documented table stay in sync at their current count), 0 new configuration keys, 0 new commands or flags |
| NFR-9 | Boundary integrity | 0 new `process.env`/`Bun.env`/`Deno.env` reads outside the credential adapter; 0 new secret-read allowlist entries; 0 new hardcoded product, binary, or brand literals (human diagnostics use the injected brand name); the secret-read boundary check stays green |
| NFR-10 | Regression integrity | 100% of previously inverted composition assertions updated to assert zero spawns for a refusing credential port; 0 assertions left protecting the replaced behaviour; help and doc-conformance pins green |
| NFR-11 | Record integrity | Every appended record passes the delivered record validator on first attempt; a rejected shape is refused rather than written; no partial or torn record is produced by the resolve path |
| NFR-12 | Distribution-marker conformance | Every changed document under the guides area declares `ados_distribution` and the distribution drift guard passes |
| NFR-13 | Read-refusal classification and identity mapping | 100% of admission read failures are classified by the preflight from the failure's optional status and never by forwarding the adapter code: 401/403 → `provider.auth.rejected` (`kind: "provider"`, user-validation, exit 1); 5xx or any other status-bearing non-2xx → `provider.outage` (`kind: "provider"`, platform-provider, exit 2); no status (a transport throw or timeout with no response received — the only status-absent outcome) → `provider.outage` (`kind: "provider"`, platform-provider, exit 2); 404 → `input.value.rejected` (`kind: "input"`, user-validation, exit 1); malformed 2xx payload (status-present, carrying the status it received) → `provider.payload.invalid` (`kind: "provider"`, platform-provider) and provably classifiable apart from the status-absent transport throw; the unresolvable credential → `config.credential.missing` (`kind: "config"`); an instance with no resolvable repository target → `input.value.rejected` (`kind: "input"`, exit 1) with zero requests issued; 0 new error-table identities, 0 new `DOMAIN_KINDS` members, and 0 changes to the exit table |
| NFR-14 | Resolve failure typing | 100% of genuine store failures carry `kind: "state"` with their own code and projection (0 classify as `fallback.internal`); 0 store failures reported as `dispatch.state-unverified`; the not-found branch carries `kind: "input"` and appends nothing |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- No new metric, log sink, trace span, or event kind. The observability surfaces are the existing ones: the refusal envelope with its summary, the attempt record, the divergence record, the dispatch summary, the status digest, and doctor's report.
- The operational signal for this change is exact and local: `dispatch dual-run summary` unresolved count, and the presence of one `truth:unreadable:<reason>` reference per open delivered-evidence divergence.
- Refusal diagnostics are bounded and identifier-only; no credential value is observable through any path.
- The invocation audit ledger is out of scope for this change: a pre-session refusal is not durably recorded, so repeated misconfiguration is not observable after the fact (accepted residual, RSK-12). The audit-ledger contract itself is unchanged.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|---|---|---|---|---|---|
| RSK-1 | The preflight adds a network read to every dispatch and can refuse work that would have succeeded while tracker read was transiently unavailable | H | M | Keep the credential check ahead of the read so the common failure is offline; one bounded read with the delivered timeout; surface the read's own typed identity and remediation so the operator fixes reachability rather than credentials; no retry loop or retry storm in the preflight | M |
| RSK-2 | An existing install that relied on `gh` alone starts refusing after upgrade | H | H | Document the prerequisite and the export bridge in the same change; name the exact key in the refusal; reference page and guide updated; refusal text is actionable | L |
| RSK-3 | A diagnostic leaks a credential value (for example by echoing an environment value in a hint) | H | L | Render names only; route every surfaced field through the redaction chokepoint; planted-secret canary tests across machine, human, and record paths | L |
| RSK-4 | The documented export bridge lands a token in shell history | M | M | Prescribe the command-substitution form so the value is never printed, and include history-hygiene guidance; the product still never persists the value | M |
| RSK-5 | A not-applicable divergence per unverifiable-but-delivered attempt makes the gate unreachable or noisy | M | M | Open at most one per (repository, work-item reference), only when delivery is locally evidenced (DEC-9); make it resolvable from local evidence with no credential; state the TDR-0015 amendment explicitly (DEC-3) and document that the corrected admission preflight is what keeps this population small | L |
| RSK-6 | Correcting the resolve identity mapping breaks a script that keyed on `dispatch.state-unverified` for resolve failures | M | L | The taxonomy is unchanged and the new identity is more accurate; document the mapping change on the reference page and in the change record; no consumer inside the repository depends on the collapsed code | L |
| RSK-7 | The preflight port is optional, so production forgets to wire it and the defect silently survives | H | L | A production-composition test asserts the port is wired and that a refusing credential port yields zero spawns and a typed refusal; the optionality exists only for direct engine callers | L |
| RSK-8 | Pinned help/doc-conformance and composition assertions fail or are weakened to pass | M | H | Invert the composition assertions to zero-spawn in the same change; keep the reference page phrases the conformance check pins; review the diff for deleted assertions | L |
| RSK-9 | Status evidence additions drift from golden fixtures or inflate the digest | L | M | Identifier-only optional fields; bounded by the existing detail and machine bounds; corpus and golden cases updated deliberately and reviewed for no new section, state, or finding | L |
| RSK-10 | Doctor parity work is mistaken for shipping doctor | L | L | Explicit non-goal; prompt-required inventory and help pins untouched; the only doctor artifact is a regression test | L |
| RSK-11 | Preflight and post-session truth read share the transport, so a fixture that fails all requests cannot distinguish them | M | M | Fixtures must address the preflight read separately from the post-session read; the test plan declares both cases explicitly | L |
| RSK-12 | A pre-session refusal is not durably recorded because the invocation audit ledger is out of scope, so repeated misconfiguration is not observable after the fact | M | H | The refusal names the key, the reference, the read outcome, and one remediation; `status` and doctor surface the same prerequisite; the guide documents the provisioning path; the residual is accepted explicitly in NFR-3, §7.2, and §10 | M |
| RSK-13 | Non-interactive consumers keyed on `dispatch.state-unverified` with exit `2` now see a precondition refusal: `config.credential.missing` (exit 1), `provider.auth.rejected` (exit 1), `provider.outage` (exit 2), `provider.payload.invalid`, or `input.value.rejected` (exit 1), and there is no attempt record to read | M | M | Document the mapping on the reference page and in the change record; keep the identity set and exit table unchanged; callers must branch on the identity and treat exit `1` as nothing-started; a composition test pins each mapping | M |
| RSK-14 | The operator bridge `export GITHUB_TOKEN="$(gh auth token)"` places a broad-scope token in the process environment, readable by same-user processes and `/proc`; the truth-read key is not registered for serialization redaction by the config-catalog path today | H | M | The guide prescribes a least-privilege read-scoped token where the provider supports one, rotation and revocation, command substitution so the value is never printed, and shell-history hygiene; the change registers the resolved truth-read key for redaction at the runtime edge from injected environment facts (no new ambient read); the product still never persists or prints the value | M |
| RSK-15 | The delivered-evidence divergence population grows on resumes and repeated unverifiable attempts | M | M | One open divergence per (repository, work-item reference) (DEC-9); a resume or another delivered-but-unverifiable attempt references the existing open record; resolution reduces the unresolved count; the admission preflight keeps the population small in practice | L |
| RSK-16 | A delivered-evidence divergence is dischargeable by attestation: the 240-character resolution note is the only closure evidence | M | M | The note bound and the attempt/divergence audit trail are preserved; resolution is documented as an operator attestation, not independent verification; the summary keeps the identifier and both records readable; the gate's other conditions remain unchanged | M |
| RSK-17 | A 404 admission refusal is read as "the reference is wrong" when the real cause is a token that cannot see a private repository, so the operator edits a valid reference instead of checking scope | M | M | The refusal summary says the provider reported the item absent for this credential and never asserts the reference is wrong; the guide tells the operator to verify the reference and, on a 404, to confirm the token's scope and repository access; `provider.auth.rejected` and the status prerequisite cover the credential-quality cases, and the residual ambiguity stays stated in §22 | M |
| RSK-18 | The divergence append lands and the attempt append then fails, leaving an open divergence whose `attempt:<id>` evidence reference names an attempt that never landed; the per-work-item dedupe then blocks a second divergence for that pair until the orphan is closed | M | L | The orphan is an accepted, documented residual: no attempt is fabricated and the command returns the underlying state identity instead of reporting success; the orphan stays listed and counted as unresolved, stays resolvable through the local resolve path, and a later attempt for the same (repository, work-item reference) may reference it through the dedupe (F-4.4/F-4.6, DEC-12) | L |

## 12. ASSUMPTIONS

- A-1: The production truth-read reference remains `github-read` over the literal key `GITHUB_TOKEN`; this change documents that key rather than renaming the reference or the key.
- A-2: One bounded single-entity work-item read is a sufficient admission probe for both credential validity and basic reachability.
- A-3: On a `gh`-authenticated default install, `gh auth token` can supply the value for an explicit export; the product never runs it.
- A-4: The local phase ledger is readable without a credential, which is what makes delivered evidence a credential-free fact.
- A-5: The post-session truth read stays as delivered; the preflight is additive, not a replacement.
- A-6: Existing attempt records without a divergence stay valid and readable; no backfill is required for correctness.
- A-7: A not-applicable divergence opened for an unverifiable-but-delivered attempt is resolvable from local evidence alone, so the gate's truth condition remains recoverable rather than permanently blocked.
- A-8: Doctor's existing `tracker.credential-unavailable` check already substitutes the environment variable name into its hint, so parity is a test obligation, not a behavior change.
- A-9: Test fixtures can inject the credential port and the transport independently, so no test needs a real keyring, a real token, or a real network call.
- A-10: The delivered-evidence predicate is evaluated from the shared harness classifier's outcome at record time; the persisted attempt record's derived outcome for `state-unverified` is `failed` and is never used as delivery evidence.
- A-11: The delivered unreadable-read families are the closed set `ledger`, `tracker`, `artifact`, and `state`; there is no `ci` read family in that set.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|---|---|---|
| Depends on | Credential port and its environment-backed implementation | Source-key derivation, the missing-credential identity, and the no-diagnostic-channel posture are consumed unchanged. |
| Depends on | Dispatch engine admission order, the delivered `ports.admission` seam, and the attempt/divergence ledgers | The preflight inserts before `claimLease`; `ports.admission` remains a separate delivered pre-spawn decision that records an attempt on refusal. The divergence record shape and validator are reused. |
| Depends on | State layer verified reads and records | Resolve must surface each genuine state identity with `kind: "state"`, its own projection and remediation, and a distinguishable not-found; the record validator enforces the note bound. |
| Depends on | Harness session port and production harness composition | The preflight must run before both spawn and resume; the composition supplies the port. |
| Depends on | CLI runtime edge registered-secrets redaction | The resolved truth-read key is registered for redaction at the edge when present, from injected environment facts; no new ambient read. |
| Depends on | Status digest collector and its evidence contract | Additive optional section-level `credentialPrerequisite` within the existing schema version; the bounded `sources[]` entry shape and bound are unchanged. |
| Depends on | Doctor command definition (test only) | Parity test for the existing credential-unavailable hint. |
| Depends on | Result contract and error table | All identities are existing rows; no sync-table edit is expected, and the sync check must stay green. |
| Depends on | TDR-0019 admission preflight decision | The primary decision for the pre-session preflight: the port placement and optionality, the status-keyed mapping to existing identities, the domain-kind pairs, the stamped-`httpStatus` discriminator for a malformed 2xx, and the production wiring obligation. |
| Depends on | TDR-0020 amendment to TDR-0015 | DEC-3 amends four TDR-0015 assertions for the delivered-evidence case — §1 `Truth(W)` (the not-applicable-comparison clause), §1 `Coverage(W)` ("creates no divergence"), §1 record-level degradation ("does not create a divergence"), and §5 (appended iff the comparison outcome is `mismatch`) — as an additive note on each affected assertion, with TDR-0020 as the durable home. Both records are `Proposed`, so the amendment takes effect only if the owner accepts both at the GH-279 PR. |
| Depends on | Branch model and delivery process | Branch `fix/GH-279/dispatch-credential-preflight` from `main-tools`; single PR to `main-tools`. |
| Blocks | Handover gate reachability on any default install | Until the prerequisite is provisionable and named, class coverage and the truth condition cannot both hold in practice. |

## 14. OPEN QUESTIONS

None. Every decision needed for delivery is fixed in §15 (DEC-1 … DEC-11), and the one semantic consequence that changes delivered policy — the four-assertion divergence-record amendment to TDR-0015, carried by TDR-0020 — is stated explicitly as a dependency rather than left implicit.

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|---|---|---|---|
| DEC-1 | The credential and truth-read preflight is a pre-session refusal: it runs after harness resolution and input validation and before the lease claim, spawn, or resume; it appends no attempt record, opens no divergence, creates no session or branch, and returns the underlying typed identity with a bounded summary naming the resolved key and the reference. Today's post-spawn exit `2` is the defect being replaced. Carried by TDR-0019. | The engine must ask its question before it pays for the answer. | 2026-11-10 |
| DEC-2 | `dispatch dual-run resolve` works from local evidence only: no credential resolution, no network, no truth reads. The observed `dispatch.state-unverified` is a diagnostic-collapse defect fixed by preserving the underlying typed state identity and remediation; the note is clamped to its declared bound before append. | Adding credentials to resolve would hide a local write/read defect behind a security story. | 2026-11-10 |
| DEC-3 | An unverifiable-but-delivered dispatch records an open divergence so it is resolvable and counts as unresolved until resolved. Delivered evidence is the shared classifier's `completed` outcome at record time plus a readable phase ledger with progress or completion (never the persisted attempt outcome). The divergence is `not-applicable` with `state-unverified`, a null comparison token, and `attempt:<id>` plus `truth:unreadable:<reason>` evidence; the attempt carries the `divergenceRef`. At most one open delivered-evidence divergence exists per (repository, work-item reference) (DEC-9). This amends four TDR-0015 assertions for this case only — §1 `Truth(W)` (the not-applicable-comparison clause), §1 `Coverage(W)` ("creates no divergence"), §1 record-level degradation ("does not create a divergence"), and §5 (a divergence record is appended iff the comparison outcome is `mismatch`) — with TDR-0020 as the durable home of the amendment and an additive note on each affected assertion; every other clause stands unchanged. Append ordering (divergence first) and both append-failure directions are DEC-12. | Delivered work that cannot be verified must leave a closeable obligation, not silence. | 2026-11-10 |
| DEC-4 | The `gh`-keyring bridge is documentation plus an explicit operator export only. No implicit ambient or keyring inheritance is added; deny-by-default and the declared-reference model stay intact. | A supported provisioning path must not silently widen the secret-read surface. | 2026-11-10 |
| DEC-5 | Doctor stays out of the shipped prompt-required command set in this change; its inventory is pinned. The operator-facing prerequisite surface is the dispatch preflight, status section evidence naming the resolved key, and documentation; doctor keeps parity through a test. Shipping doctor is an explicit non-goal. | Scope discipline: the prerequisite must be visible, not another command shipped. | 2026-11-10 |
| DEC-6 | The preflight enters the engine as an optional injected port so direct engine callers keep working and core stays runtime-neutral and I/O-free; the production composition is required to supply it and a composition test proves the wiring. | Optionality protects the engine contract; the test protects the production path. | 2026-11-10 |
| DEC-7 | No new error-table identity is introduced: a credential refusal uses `config.credential.missing`, and the preflight classifies the minimal read itself rather than forwarding the adapter's identity. The delivered GitHub read reports only 404 as `provider.not-found`, every other non-2xx as `provider.payload.invalid` with `httpStatus`, and a transport throw or a malformed 2xx payload as `provider.payload.invalid` without a status as delivered, so the adapter code cannot carry the outcome. Required mapping by the failure's optional `httpStatus`: 401/403 → `provider.auth.rejected` (`kind: "provider"`, user-validation, exit `1`); 5xx → `provider.outage` (`kind: "provider"`, platform-provider, exit `2`); 404 → `input.value.rejected` (`kind: "input"`, user-validation, exit `1`) with the provider's report that the item is absent; any other status-bearing non-2xx and any status-absent transport failure → `provider.outage`; malformed 2xx payload → `provider.payload.invalid` (`kind: "provider"`, platform-provider), kept distinguishable from the status-absent transport throw because the bounded read stamps the received 2xx status onto the decode failure, making the malformed 2xx status-present. The engine's result error-kind union is widened additively to admit the existing `provider` and `config` kinds (the credential refusal is a config-kind row); no new `DOMAIN_KINDS` member and no error-table row is added. A resolve failure uses the state identity that actually failed (DEC-10). Carried by TDR-0019. | The existing identities describe each outcome accurately; a blanket `provider.payload.invalid` would misclassify an outage and a rejected credential as a payload fault, and every new identity is contract and documentation churn. | 2026-11-10 |
| DEC-8 | The status prerequisite is one additive optional section-level `credentialPrerequisite: { referenceName, sourceKey }` on the evidence record of a credential-dependent section, present only when that source failed — not an extra `sources[]` entry, not a new section, state, or finding code. The bounded source-entry shape and its six-entry bound are unchanged. | The digest's shape is a contract; naming a key needs one optional field at the section's evidence level, not a wider entry shape or a new surface. | 2026-11-10 |
| DEC-9 | The delivered-evidence divergence is deduplicated per (repository, work-item reference): at most one OPEN divergence exists per pair, and a resume or another unverifiable-but-delivered attempt for the same pair reuses and references the existing open divergence. A new divergence may open only after the previous one is resolved. | A resume must not inflate the unresolved population or create duplicate obligations for the same delivered work item. | 2026-11-10 |
| DEC-10 | A resolve failure carries the correct domain-kind discriminant: genuine store failures use `kind: "state"` with their own code (a `{kind: "dispatch", code: "state.lock.busy"}` pair would classify to `fallback.internal` and lose the identity). The unknown-divergence-id branch uses a distinguishable not-found signal, not `state.keys.missing`, and maps to `input.value.rejected` with `kind: "input"` while appending nothing. | Preserving the state code without its kind loses the identity; reusing `state.keys.missing` conflates an absent divergence with a genuine store key-set failure. | 2026-11-10 |
| DEC-11 | The new admission seam is an OPTIONAL `preflight` port, explicitly distinct from the delivered `ports.admission` seam: `ports.admission` records an attempt pair on refusal, while `preflight` runs after harness resolution and input validation, before `claimLease`, and before spawn/resume with zero records. Production always supplies the preflight port; direct engine callers may omit it. The invocation audit ledger is out of scope, so a pre-session refusal is not durably recorded. | Naming and positioning keep two different refusal semantics from being conflated, and the audit gap is accepted rather than silently implied. | 2026-11-10 |
| DEC-12 | The delivered-evidence divergence is appended **before** the attempt record, because the attempt carries the `divergenceRef`; the pair is never written with a forward reference. Both append-failure directions are therefore decided explicitly. Divergence-append failure: never fabricate or dangle a `divergenceRef` — exactly one attempt is appended with no `divergenceRef` and a bounded `divergence:append-failed` evidence reference, the underlying state identity is returned on `data.error` and `lastMessage`, and the derived token and exit are unchanged, so there is no silent success. Attempt-append failure: the already-landed divergence is an accepted, resolvable orphan — no attempt is fabricated, the command returns the underlying state identity instead of success, the open divergence stays listed and counted as unresolved, it stays resolvable through the local resolve path, and a later attempt for the same (repository, work-item reference) may reference it through the per-work-item dedupe. | Divergence-first is forced by the forward reference the attempt carries; deciding both directions keeps a failed append from manufacturing a fake attempt, a dangling reference, or a silent success. | 2026-11-10 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|---|---|
| Dispatch engine admission path | Updated — optional `preflight` port, status-keyed outcome classification with domain-kind discriminants, refusal envelope, deduplicated delivered-evidence divergence append |
| Credential port composition (production) | Updated — the preflight port is wired over the same declared reference and credential port |
| Dispatch divergence resolution path | Updated — `kind: "state"` identity preservation, distinguishable not-found, and note clamping |
| CLI runtime edge | Updated — the resolved truth-read key is registered for redaction when present, from injected environment facts |
| Dispatch CLI diagnostics and reference page | Updated — named-key refusal, status-keyed identity and kind mapping, exit behavior, resolution path documented |
| Status digest collector | Updated — additive optional section-level `credentialPrerequisite` field on credential-dependent section evidence records |
| Doctor command definition | Unchanged — regression parity test only |
| Operator documentation | New provisioning guide; dispatch reference page updated; feature specs reconciled after delivery |
| Dispatch composition, truth, divergence, gate, doctor, status test suites | Updated — inverted zero-spawn assertions, new refusal and resolve cases, divergence dedupe, prerequisite evidence |
| Delivery-result taxonomy, error table, config schema, bash fallback | Unchanged |

**AC-F5-4 ownership split.** AC-F5-4 spans two halves and is delivered by two phases without renumbering or changing the requirement: the parity half — the resolved truth-read key registered for serialization redaction at the runtime edge — belongs to the status phase (the same phase that delivers the status prerequisite evidence and the CLI edge registration), and the guide-content half — the guide recording the least-privilege expectation and the fact that the key is registered for redaction by this change rather than by the config-catalog path — belongs to the documentation phase. Both halves must pass before AC-F5-4 is considered met.

### 16.1 Documentation Impact

| Document | Impact |
|---|---|
| New operator guide under the guides area (credential provisioning for the typed engine) | New. Names the exact required key `GITHUB_TOKEN`, the `github-read` reference, the explicit `gh` export bridge, the no-implicit-inheritance rule, shell-history hygiene, least-privilege guidance, rotation/revocation guidance, and the redaction-registration fact. Declares its distribution marker; the guides area's header convention applies. |
| Dispatch reference page (`doc/planning/oss-tooling/milestones/m1/commands/dispatch.md`) | Updated. Documents the pre-session preflight ordering (before `claimLease`), the status-keyed identity and kind mapping and exits, the named key and reference, the 404 scope caveat, and the per-work-item divergence dedupe and resolution path. Its conformance-pinned phrases move with it. |
| Dispatch engine feature spec | Reconciled after delivery: optional `preflight` port, refusal table semantics, status-keyed identity/kind mapping, deduplicated delivered-evidence divergence, resolution discriminant typing, and the gate-semantics amendment note pointing at TDR-0020. |
| Adapter ports / credential-resolution feature spec | Reconciled after delivery: the credential refusal's name-only diagnostic surface, the bridge exposure guidance, and the explicit no-keyring posture. |
| Status digest feature spec | Reconciled after delivery: the additive optional section-level `credentialPrerequisite` and the unchanged section/state/finding vocabularies and `sources[]` entry shape. |
| Doctor feature spec | Reconciled after delivery: parity statement only; no behavior, inventory, or help change. |
| Result contract feature spec | Reconciled only if a documented row's wording needs the new refusal context; no identity, projection, or count change. |
| Change record for this change | Owned by the documentation phase (the phase that also publishes the guide, the reference page, and the feature-spec reconciliation). Records the observed live evidence (GH-241 dispatch output and the resolve failure), the manual MV-1 evidence for the one real credentialed dispatch with its artifact, tracker, and CI corroboration, and the four-assertion TDR-0015 amendment with TDR-0020 named as its durable home. |
| Release note / changeset | Owned by the documentation phase. A minor-bump changeset naming the new admission refusal class (and that a precondition refusal carries no attempt record), the exact truth-read key prerequisite with the explicit export bridge, doctor remaining unshipped, and the delivered-evidence divergence-recording behaviour. |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|---|---|---|
| AC-F1-1 | **Given** a dispatch whose declared truth-read credential is unresolvable and a harness session port that records every spawn and resume, **when** the dispatch runs, **then** it returns a top-level error envelope with `config.credential.missing`, exit `1`, and a bounded summary naming the resolved key and the reference, within 2 000 ms, and the harness port recorded zero spawns and zero resumes. | F-1, F-2, NFR-1, NFR-3 |
| AC-F1-2 | **Given** the refusal in AC-F1-1, **when** the durable ledgers and the checkout are inspected afterwards, **then** zero queue leases were claimed, zero attempt records, zero divergence records, zero handover records, and zero authority-view changes exist, and no branch, worktree, or session was created; the invocation audit ledger is out of scope and is not asserted. | F-1, NFR-3, DEC-11 |
| AC-F1-3 | **Given** a resolvable credential and a minimal work-item read whose failure carries HTTP status 401 or 403, **when** the dispatch runs, **then** it refuses pre-session with `provider.auth.rejected` (`kind: "provider"`, user, non-retryable, `not_landed`, user-validation projection, exit `1`), with zero spawns and zero attempt records; **given** the read instead fails with a 5xx status, **then** it refuses with `provider.outage` (`kind: "provider"`, transient, retryable, `not_landed`, platform-provider projection, exit `2`), with zero spawns and zero attempt records. | F-1, F-2, NFR-13, DEC-7 |
| AC-F1-4 | **Given** an unknown harness name or a malformed work-item reference, **when** dispatch runs, **then** the delivered input refusal is returned, the preflight port is never invoked, and no session is created. | F-1, NFR-3 |
| AC-F1-5 | **Given** a resolvable credential port, a successful minimal read, and injected truth reads that all succeed, **when** a dispatch runs, **then** the derived verdict is a token other than `state-unverified`, exactly one attempt record is appended, and the comparison is derived from the readable truth. | F-1, F-4 |
| AC-F1-6 | **Given** a resolvable credential and a minimal work-item read that reports the work item absent with HTTP 404, **when** the dispatch runs, **then** it refuses pre-session with `input.value.rejected` (`kind: "input"`, user, non-retryable, `not_landed`, user-validation projection, exit `1`) and a bounded summary naming the work-item reference and stating that the provider reported it absent, and zero spawns and zero attempt records exist; the summary does not assert that the reference itself is wrong. | F-1, F-2, NFR-13, DEC-7, RSK-17 |
| AC-F1-7 | **Given** a resolvable credential and a minimal work-item read whose 2xx payload is genuinely malformed or unparsable, **when** the dispatch runs, **then** it refuses pre-session with the adapter-local `provider.payload.invalid` (`kind: "provider"`, platform-provider projection) and zero spawns and zero attempt records exist, and that outcome stays distinguishable from a status-absent transport failure. | F-1, F-2, NFR-13, DEC-7 |
| AC-F1-8 | **Given** a resolvable credential and a declared instance with no resolvable repository target, **when** the dispatch runs, **then** the minimal work-item read is never issued and the dispatch refuses pre-session with `input.value.rejected` (`kind: "input"`, user, non-retryable, `not_landed`, user-validation projection, exit `1`) naming the unresolvable repository target, with zero provider requests, zero spawns, and zero attempt records. | F-1, F-2, DM-1, NFR-3, NFR-13, DEC-7 |
| AC-F2-1 | **Given** a literal reference `github-read` whose key `GITHUB_TOKEN` is unset, **when** the credential refusal is rendered in machine mode and in human mode, **then** both name `GITHUB_TOKEN` and `github-read` and give one actionable remediation, and neither contains any credential value. | F-2, NFR-2, NFR-5 |
| AC-F2-2 | **Given** an environment-prefixed credential reference, **when** it is refused, **then** the reported key is the full derived name (prefix plus suffix), never the bare suffix. | F-2, DM-1 |
| AC-F2-3 | **Given** a registered secret value present in the injected environment, **when** a refusal, a success, a resolve failure, and a divergence record are produced, **then** zero occurrences of that value appear in any envelope, human diagnostic, summary, evidence reference, attempt record, or divergence record. | F-2, NFR-2 |
| AC-F2-4 | **Given** the delivered GitHub read returning `provider.payload.invalid` with `httpStatus` 401 for a rejected credential, **when** the preflight classifies it, **then** the refusal is `provider.auth.rejected` with `kind: "provider"`, user-validation projection, and exit `1`, never the adapter's `provider.payload.invalid`; **given** the same read returns `httpStatus` 429 or another status-bearing non-2xx, **then** the refusal is `provider.outage` with `kind: "provider"`, platform-provider projection, and exit `2`; and **given** the read reports 404, **then** the refusal is `input.value.rejected` with `kind: "input"`, user-validation projection, and exit `1`. The preflight classifies by status and does not forward the adapter's identity. | F-1, F-2, DM-1, NFR-13, DEC-7 |
| AC-F2-5 | **Given** a refusal whose code is `provider.auth.rejected`, `provider.outage`, or `provider.payload.invalid`, **when** it is classified, **then** it carries `kind: "provider"` and does not classify as `fallback.internal`; **given** the `input.value.rejected` refusal, **then** it carries `kind: "input"`; **given** the `config.credential.missing` refusal, **then** it carries `kind: "config"` and classifies to its own row rather than `fallback.internal`; the engine's result error-kind union admits the existing `provider` and `config` kinds additively, the `DOMAIN_KINDS` membership and the error-table row count are unchanged, and no mapped code is emitted under a mismatched kind. | F-2, DM-1, NFR-8, NFR-13, DEC-7 |
| AC-F2-6 | **Given** a 2xx response whose payload a normalizer cannot parse, where the bounded read's chosen discriminator stamps the received 2xx status onto the decode failure, **when** the preflight classifies it, **then** the failure is status-present — it carries the received 2xx status — and refuses as `provider.payload.invalid` with `kind: "provider"` and platform-provider projection; **given** a transport throw or timeout with no response received, **then** the failure is status-absent and refuses as `provider.outage` with `kind: "provider"` and platform-provider projection. The test proves both halves of the pair: malformed-2xx (status present) → `provider.payload.invalid`, transport throw (no status) → `provider.outage`, so the malformed payload is never classified as `provider.outage` and the status-absent outcome is only the transport throw. | F-1, F-2, NFR-13, DEC-7 |
| AC-F3-1 | **Given** a composed resolve runtime with spy credential and transport ports and a local divergence ledger, **when** `dispatch dual-run resolve <id> --note <text>` succeeds, **then** the credential port and the transport were never invoked and the resolution came from local evidence only. | F-3, NFR-7 |
| AC-F3-2 | **Given** a local state read that fails with `state.lock.busy` during resolve, **when** resolve runs, **then** the failure carries `kind: "state"` with code `state.lock.busy` and its own category, retryability, consequence, remediation, and exit; it is not carried under the dispatch kind (which would classify as `fallback.internal`) and is never `dispatch.state-unverified`. | F-3, DM-5, NFR-14, DEC-10 |
| AC-F3-3 | **Given** a local store failure of `state.store.torn` or `state.write.failed` during resolve, **when** resolve runs, **then** the failure carries `kind: "state"` with that exact identity and its own projection, and no record is appended. | F-3, DM-5, NFR-14, DEC-10 |
| AC-F3-4 | **Given** a resolve note longer than 240 characters, **when** resolve runs, **then** the resolution lands, the stored note is at most 240 characters, and no `state.write.failed` is produced. | F-3, NFR-5, DM-5 |
| AC-F3-5 | **Given** a divergence identifier absent from the ledger, **when** resolve runs, **then** the distinguishable not-found maps to `input.value.rejected` with `kind: "input"` and nothing is appended; it is never reported as `state.keys.missing`. | F-3, DM-5, NFR-14, DEC-10 |
| AC-F4-1 | **Given** the shared classifier's outcome `completed` evaluated at record time (the persisted attempt outcome `failed` is not used), a readable phase ledger showing progress or completion, no open delivered-evidence divergence for the (repository, work-item reference) pair, and a truth read that fails with `config.credential.missing`, **when** the dispatch records the attempt, **then** one open divergence is appended with `comparisonClass: not-applicable`, `engineToken: state-unverified`, `comparisonToken: null`, evidence references `attempt:<id>` and a bounded `truth:unreadable:<reason>` where `<reason>` is one of `ledger`, `tracker`, `artifact`, or `state` (never `ci`), and the attempt record carries that `divergenceRef`. | F-4, DM-2, DM-3, DEC-9 |
| AC-F4-2 | **Given** that divergence, **when** `dispatch dual-run summary --repo <repo>` runs, **then** the summary exits `0`, lists the divergence identifier, and reports it in the unresolved count; **when** the divergence is then resolved, **then** the unresolved count decreases by exactly one and the attempt and both divergence records remain readable. | F-4, F-3 |
| AC-F4-3 | **Given** one of: a classifier outcome other than `completed`, an unreadable ledger, or a ledger with no progress and an incomplete total, **when** the truth read fails, **then** zero divergences are opened and the attempt remains exposure-only evidence; a persisted attempt outcome of `failed` alone never establishes delivered evidence. | F-4, A-10 |
| AC-F4-4 | **Given** an open delivered-evidence divergence for a (repository, work-item reference) pair, **when** a resume or another unverifiable-but-delivered attempt for the same pair is recorded, **then** no second divergence is appended, the new attempt references the existing open divergence, and the unresolved count does not increase. | F-4, DM-6, DEC-9, RSK-15 |
| AC-F4-5 | **Given** that an open delivered-evidence divergence is resolved for a (repository, work-item reference) pair, **when** a later unverifiable-but-delivered attempt for the same pair occurs, **then** a new divergence may open, because none is open; **while** a delivered-evidence divergence is still open, no new one opens for that pair. | F-4, DM-6, DEC-9 |
| AC-F5-1 | **Given** the new provisioning guide, **when** an operator on an unprovisioned `gh`-authenticated install follows it, **then** it names the exact literal key `GITHUB_TOKEN`, the `github-read` reference, the explicit export bridge from an authenticated `gh` session, states that no keyring, ambient, or fallback key is ever read automatically, and carries least-privilege and rotation/revocation guidance for the exported token. | F-5, DEC-4, RSK-14 |
| AC-F5-2 | **Given** the dispatch reference page, **when** a reader looks up a credential refusal or a divergence resolution, **then** it documents the pre-session refusal ordering before `claimLease`, the named key and reference, the status-keyed identity and kind mapping and exits, the 404 scope caveat, the per-work-item dedupe, and how an unverifiable-but-delivered divergence is resolved. | F-5, F-1, F-4 |
| AC-F5-3 | **Given** the new guide and any other changed document under the guides area, **when** the documentation-distribution drift guard runs, **then** each document declares `ados_distribution` and the guard passes. | F-5, NFR-12 |
| AC-F5-4 | **Given** the truth-read key present in the injected environment, **when** any free-text diagnostic is rendered, **then** the value is scrubbed by the serialization redaction chokepoint, and the guide records both the least-privilege expectation and the fact that the key is registered for redaction by this change rather than by the config-catalog path. | F-5, NFR-2, RSK-14 |
| AC-F6-1 | **Given** an unresolvable truth-read credential, **when** `status` runs, **then** each credential-dependent section is `unknown` with failed credential evidence and the closed reason `credential-unavailable`, its evidence record carries the additive optional section-level `credentialPrerequisite: { referenceName, sourceKey }` naming the resolved key and the reference, no `sources[]` entry is added and the delivered source-entry shape is unchanged, and the command exits `0` with all nine sections; **given** a readable credential, **then** no section carries `credentialPrerequisite`. | F-6, DM-4 |
| AC-F6-2 | **Given** the same condition, **when** the digest is assembled, **then** no section is `observed`, no count is fabricated as zero for the unread source, no finding is emitted from the failed read, and no section, state, or finding code was added to the digest contract. | F-6, DM-4 |
| AC-F6-3 | **Given** the doctor command definition, **when** its `tracker.credential-unavailable` case runs, **then** the fix hint names the resolved key, and the prompt-required command inventory and help pins remain unchanged. | F-6, DEC-5 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- **Delivery shape.** One change on branch `fix/GH-279/dispatch-credential-preflight` from `main-tools`, delivered as a single pull request to `main-tools`. No feature flag: the refusal is the feature, and a flag would preserve the defect.
- **Ordering.** Contract and decision material first (record-keeping plus the declared shapes), then the engine preflight and its composition, then the resolution diagnostics, then divergence recording, then the status surface and documentation, finishing with the test inversions and conformance updates in the same pull request. No phase of the change may leave the composition tests asserting the replaced behaviour.
- **Operational communication.** Every install that relied on `gh` alone must export `GITHUB_TOKEN` (or declare another supported reference) before upgrading. The refusal text, the guide, and the reference page carry that message; the change record and pull-request description repeat it. The reference page also publishes the status-keyed identity and kind mapping (401/403, 5xx or other non-2xx, status-absent transport, malformed 2xx, 404) so non-interactive consumers can update their branching.
- **Verification evidence.** Beyond the fixture suite, the pull request records one real credentialed dispatch that reaches a verdict other than `state-unverified`, plus one summary reading that shows the divergence population before and after a resolution, including a resume that references the existing open divergence instead of appending. That manual evidence — MV-1, owned by the documentation phase and recorded in the pull request, not a test case — must carry artifact, tracker, and CI corroboration for the same dispatch: the delivered artifact evidence, the tracker state for the work-item reference, and the CI run it points at, so the verdict is corroborated by all three truth sources rather than asserted from one terminal transcript. No real token is committed, printed, or attached.
- **Rollback.** Reverting the change restores the previous admission order and diagnostics. No migration is involved; divergence records written by this change use the existing record shape and remain readable, and they stay resolvable through the delivered resolve path after a revert.
- **Adoption note.** `state-unverified` remains a legitimate outcome for a post-session truth failure. The change removes the *guaranteed* version of it on an unprovisioned install; it does not remove the token. A delivered-but-unverifiable attempt now owes one open divergence obligation per work item, not one per resume.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

None.

- No record schema version changes, no store migration, no field backfill.
- Historical unverifiable attempts recorded before this change keep no divergence; backfilling them is out of scope and is not required for correctness.
- The pre-existing `DIV-GH-275-…` divergence stays open and out of scope. The corrected resolve diagnostics make it resolvable, which is the evidence that motivated this change, but resolving it is not part of the change.
- New divergence records reuse the existing record kind, payload schema, and validator; a record that would exceed the note bound is clamped rather than written invalid.
- The per-work-item open-divergence bound is computed over the existing ledger on read; no seeding, marker, or schema change is required.

## 20. PRIVACY / COMPLIANCE REVIEW

- No new personal data is collected, stored, or transmitted. The added facts are environment key names, a reference name, closed reason tokens, and system identifiers.
- Credential material remains reachable only through the credential port and is never surfaced; the diagnostics are name-only by contract.
- No new network destination, no telemetry exporter, and no third-party data sharing. The one added read targets the same provider and endpoint the truth read already uses.
- Documentation shows a shell idiom rather than a token, warns about shell history, and explains that the exported value is also visible to same-user processes and `/proc`; no example value is a real or realistic credential.
- Privacy-guard and no-cloud invariants are unchanged.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Secret-read boundary unchanged.** The preflight resolves through the existing credential port. No new ambient environment read exists outside the credential adapter, and the secret-read allowlist gains no entry.
- **Deny-by-default preserved.** The engine still reads exactly one declared key through one declared reference. No keyring, ambient, or fallback lookup is added; the `gh` bridge is an operator action performed in the operator's own shell.
- **Non-echo diagnostics.** Refusals render the resolved key name and reference name only. Every surfaced field passes the serialization redaction chokepoint, and a planted-secret canary test covers machine, human, and record paths.
- **Bridge exposure stated.** `export GITHUB_TOKEN="$(gh auth token)"` places a broad-scope token in the process environment, readable by same-user processes and `/proc`; the truth-read key is not part of the config-catalog redaction registration today, so this change registers the resolved key for redaction at the runtime edge and the guide prescribes a least-privilege token plus rotation/revocation.
- **No unauthenticated probing.** When the credential is unresolvable, the preflight issues no request at all, so the engine never probes the provider without a credential.
- **Refusal precedes side effects.** Because the preflight runs before lease claim and spawn, a refusal cannot leave a session, branch, lease, attempt, divergence, handover, or authority change behind — the security-relevant property is also the operability property.
- **Documentation risk is stated, not hidden.** The export bridge can expose a token through shell history, process listings, or `/proc` if used carelessly; the guide prescribes command substitution, never printing the value, history hygiene, least privilege, and rotation.
- **No privilege widening in resolve.** Resolution stays local and credential-free, so a local ledger write can never be escalated into a credential or network action.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **New operator-facing failure mode.** Dispatch can now refuse before doing anything. Runbooks must distinguish "nothing started" (precondition refusal, exit `1` for a missing credential, a rejected credential, or an item the provider reports absent; exit `2` for an outage or a malformed payload; no attempt record) from "attempt recorded, verdict derived" (attempt-stage outcome).
- **Diagnosis path.** Missing key → refusal names it → operator exports it → re-run. Rejected credential → `provider.auth.rejected` names the key → correct or rotate it. Outage → `provider.outage` → fix reachability and retry. Item reported absent → `input.value.rejected` names the reference → verify the reference **and** the token's scope and repository access, because a private item the credential cannot see answers 404 like an absent one. No resolvable repository target → `input.value.rejected` names the unresolvable target and no request is issued. Malformed payload → `provider.payload.invalid` → treat as a provider/adapter fault.
- **Evidence hygiene.** Each (repository, work-item reference) pair owes at most one open resolution; a resume references the existing open divergence instead of adding a second. The summary's unresolved count is the operational queue for that debt, and resolution is an operator attestation bounded by the 240-character note.
- **Orphan divergence after a failed attempt append.** The divergence is written before the attempt, so a failed attempt append leaves an open divergence whose `attempt:<id>` evidence reference names an attempt that never landed. That orphan is an accepted residual (RSK-18): it stays listed and counted as unresolved, stays resolvable through the local resolve path, and a later attempt for the same pair may reference it; no attempt is fabricated and the failure is reported with the underlying state identity rather than as success.
- **Audit gap.** A pre-session refusal is not durably recorded in the invocation audit ledger, so a repeated misconfiguration is invisible after the fact; the refusal and the status/doctor surfaces are the only operational evidence (accepted residual, RSK-12).
- **Cost.** One extra bounded read per admitted dispatch, and zero reads when the credential is missing.
- **Maintenance coupling.** The guide, the reference page, and the conformance-pinned phrases move together; a future key or reference change must update the guide, the refusal text, the status-keyed mapping, and the parity tests in one change.
- **Boundary to watch.** The preflight and the post-session truth read share the transport; test fixtures must keep them distinguishable so the two failure populations stay separately assertable.

## 23. GLOSSARY

| Term | Definition |
|---|---|
| Preflight | The optional `preflight` admission port that resolves the truth-read credential and performs one minimal bounded read before `claimLease`, spawn, or resume; distinct from the delivered `ports.admission` seam, which records an attempt pair on refusal. |
| Truth read | The post-session read of artifact, ledger, tracker, and CI facts used to derive a delivery verdict. |
| Read family | One of the closed unreadable-read sources `ledger`, `tracker`, `artifact`, and `state`; there is no `ci` read family. |
| Resolved source key | The exact environment variable name a declared credential reference maps to, after literal or prefix derivation. It is a name, never a value. |
| Provisioning bridge | The documented, explicit operator action that exports a value from an already-authenticated session into the declared key; it is never performed by the product. |
| Diagnostic collapse | Reporting a specific underlying failure under a broader token, so the real cause and its remedy become unreachable. |
| Domain-kind discriminant | The `kind` on a classified failure. A state code must carry `kind: "state"`, a provider read identity must carry `kind: "provider"`, and the absent-item refusal carries `kind: "input"`, because a correct code under the wrong kind classifies as `fallback.internal` and loses the identity. |
| Distinguishable not-found | A resolve signal for an absent divergence identifier that is separate from `state.keys.missing`, mapped to `input.value.rejected` with `kind: "input"`. |
| Unverifiable-but-delivered | A dispatch whose shared classifier outcome is `completed` and whose local phase ledger evidences progress or completion, but whose truth reads could not be read. |
| Delivered evidence | The credential-free local fact set that establishes delivery: classifier `completed` evaluated at record time, readable ledger, and progress or completion in that ledger; never the persisted attempt outcome. |
| Delivered-evidence divergence | The open, not-applicable divergence recorded for an unverifiable-but-delivered attempt, deduplicated per (repository, work-item reference). |
| Precondition refusal | A refusal that occurs before any session or attempt exists, so nothing was created and nothing needs cleanup. |
| Status credential prerequisite | The additive optional section-level `credentialPrerequisite: { referenceName, sourceKey }` on a credential-dependent status section's evidence record, present only when that source failed; it is a sibling of `sources[]`, never an added source entry. |
| Exposure-only evidence | An attempt that counts for class coverage but makes no success claim and requires no corroboration. |

## 24. APPENDICES

### Appendix A — Admission decision table

| Condition (evaluated in order) | Outcome | Identity | Exit | Session / attempt / divergence |
|---|---|---|---|---|
| Harness unknown or malformed input | Input refusal | `input.value.rejected` | 1 | none; preflight not invoked |
| Credential reference unresolvable | Pre-session refusal | `config.credential.missing` (`kind: config`) | 1 | none |
| Instance declares no resolvable repository target (the minimal read cannot be issued) | Pre-session refusal | `input.value.rejected` (`kind: input`; names the unresolvable target) | 1 | none; zero requests issued |
| Minimal read: status 401/403 | Pre-session refusal | `provider.auth.rejected` (`kind: provider`) | 1 | none |
| Minimal read: status 5xx or any other status-bearing non-2xx | Pre-session refusal | `provider.outage` (`kind: provider`) | 2 | none |
| Minimal read: no status at all (a transport throw or timeout with no response received — the only status-absent outcome) | Pre-session refusal | `provider.outage` (`kind: provider`) | 2 | none |
| Minimal read: malformed 2xx payload (status-present: the received 2xx status is stamped onto the decode failure) | Pre-session refusal | `provider.payload.invalid` (`kind: provider`) | 2 | none |
| Minimal read: status 404 (the provider reports the item absent; a private item the credential cannot see answers the same way) | Pre-session refusal | `input.value.rejected` (`kind: input`; summary names the ref and does not call it wrong) | 1 | none |
| Credential and read succeed, lease conflicts | Pre-session refusal | `queue.lease-conflict` | 1 | none |
| Credential and read succeed, session runs | Attempt-stage outcome | derived token, per the delivered taxonomy | per token | lease, one attempt, divergence only per F-4 |
| Session completed + delivered evidence + truth unreadable | Attempt-stage outcome | `state-unverified` | 2 | one attempt **and** one open divergence per work item (reused on resume) |
| Session completed + no delivered evidence + truth unreadable | Attempt-stage outcome | `state-unverified` | 2 | one attempt, no divergence |

Every read-refusal row is classified by the preflight itself from the failure's optional provider status, not forwarded from the adapter code: the delivered GitHub read surfaces only 404 as `provider.not-found` and every other non-2xx as `provider.payload.invalid` with `httpStatus`, while a transport throw arrives without a status. The chosen discriminator stamps the received 2xx status onto the decode failure, so a malformed 2xx payload is status-present and the pair AC-F2-6 / F-2.4 assert here is the same pairing: malformed 2xx (status present) → `provider.payload.invalid`, transport throw (no status) → `provider.outage`. The only status-absent outcome is therefore the transport throw. The identity column shows each mapped identity with its domain-kind discriminant.

### Appendix B — Unverifiable-but-delivered divergence (shape)

```text
divergenceId:    <generated>
repository:      <resolved host/owner/name>
ref:             <work-item reference>
attemptId:       <attempt id>
state:           open
comparisonClass: not-applicable
engineToken:     state-unverified
comparisonToken: null
evidenceRefs:    ["attempt:<attemptId>", "truth:unreadable:<read-family>"]
recordedAt:      <injected instant>
```

The attempt record for the same run carries `divergenceRef: <divergenceId>` and a bounded `last_message` naming the underlying identity, so an operator can see both what delivered and why verification failed. A resume or another unverifiable-but-delivered attempt for the same (repository, work-item reference) carries the same `divergenceRef` and appends no new divergence while that one is open.

The divergence is appended before the attempt because the attempt carries the forward reference. If the divergence append lands and the attempt append then fails, this record stays open in the ledger with an `attempt:<attemptId>` evidence reference to an attempt that never landed. That orphan is still listed and counted as unresolved, remains resolvable through the local resolve path, and a later attempt for the same pair may reference it through the per-work-item dedupe; no attempt is fabricated and the command returns the underlying state identity rather than reporting success (F-4.4, DEC-12, RSK-18).

### Appendix C — Refusal diagnostics (shape)

```text
exit_code=1
error.code=config.credential.missing
summary=credential key GITHUB_TOKEN is unset (reference github-read); export GITHUB_TOKEN="$(gh auth token)" or configure a credential reference
```

```text
exit_code=1
error.code=provider.auth.rejected
summary=the truth-read credential for reference github-read was rejected by the provider; correct GITHUB_TOKEN or rotate it and retry
```

```text
exit_code=1
error.code=input.value.rejected
summary=the provider reported work item GH-999 as absent for credential key GITHUB_TOKEN (reference github-read); verify the reference and the token's repository scope
```

```text
exit_code=2
error.code=provider.outage
summary=the provider could not be reached to read work item GH-999 for reference github-read; retry when the provider is available
```

Each summary is single-line, bounded, identifier-only, and carries no credential value.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-10 | `@spec-writer` | Initial specification for GH-279. |
| 1.1 | 2026-11-10 | `@spec-writer` | Reconciliation after the independent decision challenge (REWORK): read-outcome identity mapping (401/403 → `provider.auth.rejected`, transport/timeout/5xx → `provider.outage`, malformed → `provider.payload.invalid`, 404 → `input.value.rejected`); resolve failure discriminant typing (`kind: "state"`) and a distinguishable not-found; delivered-evidence predicate evaluated from the classifier outcome with the closed read set (no `ci`); per-work-item divergence dedupe; `preflight` seam naming and positioning versus `ports.admission`; invocation-audit scope and accepted residual; evidenced harm framing (GH-241 delivered but unverifiable); new risks for consumer breakage, bridge exposure, divergence growth, and attestation-only closure; DEC-7 updated and DEC-9/10/11 added; F-5 least-privilege/rotation guidance and redaction-registration note. |
| 1.2 | 2026-11-10 | `@spec-writer` | Second reconciliation after the independent decision challenge: the preflight classifies the minimal-read outcome itself from the failure's optional `httpStatus` rather than forwarding the adapter identity, with the delivered adapter facts stated and the malformed-2xx-versus-transport discriminator requirement recorded (F-1, F-2.4, DEC-7, NFR-13, Appendix A); domain-kind discriminants stated for every mapped identity with the engine's result error-kind union widened additively to admit `provider` (F-2.5, DM-1, NFR-8, AC-F2-4/5/6, AC-F1-3/6/7); the 404 refusal reworded as the provider reporting the item absent, with the private-resource scope caveat and risk RSK-17 (F-2.4, F-5, Appendix C, §22); status prerequisite named as the section-level `credentialPrerequisite: { referenceName, sourceKey }` field rather than an extension of the bounded `sources[]` entry (F-6, DM-4, AC-F6-1); the TDR-0015 amendment corrected from two to four assertions with TDR-0020 as the durable home (F-4.9, DEC-3, dependencies, front matter, authoring guidelines). |
| 1.3 | 2026-11-10 | `@spec-writer` | DoR iteration-1 reconciliation (NOT_READY → spec fixes). The malformed-2xx/transport-throw pairing is corrected to the chosen discriminator: a malformed 2xx is status-present (the received 2xx status is stamped onto the decode failure) and only the transport throw is status-absent, stated identically in F-2.4, AC-F2-6, NFR-13, §8.1, and Appendix A. Divergence-first append ordering and the accepted orphan divergence are stated with the attempt-append-failure behaviour, no fabricated attempt, no silent success, and continued resolvability/dedupe (F-4.2/4.4/4.6, DEC-3, DEC-12, RSK-18, Appendix B, §22). TDR-0019 added to front matter `links.decisions` and the dependency/decision-log references (DEC-1, DEC-7). The result error-kind union now admits the existing `config` kind as well as `provider`, because `classifyDomainKind` is kind-plus-code exact and `config.credential.missing` is a config-kind row (F-2.5, DM-1, NFR-8, AC-F2-5, Appendix A). A new AC-F1-8 and F-1.10 requirement trace the unresolvable-repository-target admission refusal (`input.value.rejected`, kind input, zero requests). AC-F5-4's guide-content half is assigned to the documentation phase and its parity half to the status phase without renumbering (§16). §16.1 names the documentation phase as owner of the change record and release note, and MV-1 now requires artifact, tracker, and CI corroboration (§18). |

---

## AUTHORING GUIDELINES

This specification was authored from the GH-279 ticket (authoritative requirements), the reported production symptom and artifact evidence, the verified repository architecture (credential port and source-key derivation, production wiring, dispatch admission and truth derivation, divergence resolution and record validation, status and doctor credential posture), and the planning-session decisions D1–D5 recorded in `chg-GH-279-pm-notes.yaml`. Version 1.1 reconciles the specification with the independent decision challenge: the admission read is mapped by outcome to existing identities, the resolve failure carries the correct domain-kind discriminant and a distinguishable not-found, delivered evidence is the classifier outcome at record time over the closed read set, and the delivered-evidence divergence is deduplicated per work item. The new fact recorded during planning — that `dispatch dual-run resolve` failed with `dispatch.state-unverified` while `dual-run summary` read the same store successfully — is folded in as the diagnostic-collapse defect (F-3, DEC-2) rather than as a credential problem.

Repository files are named only as evidence for the current-state snapshot; the requirements are stated behaviorally. Four TDR-0015 assertions are deliberately amended rather than quietly reinterpreted — §1 `Truth(W)` (the not-applicable-comparison clause), §1 `Coverage(W)` ("creates no divergence"), §1 record-level degradation ("does not create a divergence"), and §5 (a divergence record is appended iff the comparison outcome is `mismatch`) — all scoped to the delivered-evidence case (DEC-3) and carried by TDR-0020 with an additive note on each affected assertion, so the gate semantics keep a durable, owner-visible home without rewriting TDR-0015.

Version 1.2 is the second reconciliation after the independent decision challenge: the production preflight now classifies the minimal-read outcome itself from the failure's optional provider status rather than forwarding the adapter's identity (which collapses outage, rejection, and malformed payload); each mapped identity carries its domain-kind discriminant, with the engine's result error-kind union widened additively to admit `provider`; the 404 refusal is worded as the provider reporting the item absent and carries the scope caveat; the status prerequisite is named as the section-level `credentialPrerequisite` field; and the TDR-0015 amendment is stated as four assertions carried by TDR-0020 rather than two.

Version 1.3 is the Definition-of-Ready iteration-1 reconciliation. It removes the last contradiction about the read discriminator by stating the chosen mechanism rather than an undecided pair: a malformed 2xx is status-present because the bounded read stamps the received 2xx status onto the decode failure, and only the transport throw is status-absent, so the pairing is identical in F-2.4, AC-F2-6, NFR-13, §8.1, and Appendix A. It fixes the append order the plan implements — divergence first, because the attempt carries the forward reference — and decides both failure directions: a failed divergence append appends one attempt with no `divergenceRef` and a bounded `divergence:append-failed` reference, while a failed attempt append leaves an accepted orphan divergence that stays listed, counted, and locally resolvable and that a later attempt may reference through the per-work-item dedupe. It adds TDR-0019 as the primary admission decision in the links and dependency references, admits the existing `config` kind to the result error-kind union alongside `provider` (kind-plus-code classification is exact, and `config.credential.missing` is a config row), traces the unresolvable-repository-target refusal as AC-F1-8/F-1.10, splits AC-F5-4's delivery ownership between the documentation and status phases without renumbering, and makes §16.1 name the documentation phase for the change record and release note while MV-1 gains artifact, tracker, and CI corroboration.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (`GH-279`)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-)
- [x] Acceptance criteria reference at least one F-/DM-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (repository paths appear only as current-state evidence)
- [x] No content duplicated from linked docs
- [x] Front matter validates per the front-matter rules
