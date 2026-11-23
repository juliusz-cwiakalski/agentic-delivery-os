---
change:
  ref: GH-386
  type: fix
  status: Proposed
  slug: push-pr-evidence-before-pr-open
  title: "M4-S23: The PR-creation evidence commit must be pushed before the lane closes (M4)"
  owners: ["Juliusz Ćwiąkalski"]
  service: "the typed dispatch engine's result derivation and classification (CLI composition over the core dispatch family and the adapters-layer git seams)"
  milestone: "M4: Jaiship-native delivery"
  labels:
    - change
    - defect
    - m4
    - dispatch
    - cli
  version_impact: minor
  audience: internal
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - "delivered dispatch derivation ladder: one total order, closed eleven-token vocabulary, and the pinned failure-token mapping (feature-dispatch-engine.md); derivation arm 8 (open pull request) gains the parity precondition declared here; no token, arm, projection, or derivation class is added"
      - "delivered bounded attempt-evidence-reference family and budget (16 per attempt, two reserved ahead of the slice) and the additive machine-envelope precedents (the bounded pre-session failure detail and the additive optional success fields), both unchanged in shape"
      - "delivered adapters-layer git child-runner seams: bounded fixed-argv git reads and local-only mutations (the commit primitive and the merge transaction's local act set, which is declared no-network, no-remotes); the push act declared here extends this same injected child-runner pattern and is the first remote-write operation"
      - "delivered verify gates push-parity computation: local checkout head compared for equality against the open delivery request's head SHA, both full-hex; this change reuses that parity definition at dispatch classification"
      - "delivered provider delivery-request read (the GitHub read credential resolved at the dispatch admission preflight) as the remote-head fact source"
    external:
      - "the checkout's configured git remote and its ambient credential chain, for one fast-forward push of the change branch per classification; no new credential resolution, storage, or transport is introduced"
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make `pr-open` a parity-backed claim by construction — the dispatch engine ensures the change branch's local head is pushed and equals the pull request's head before it classifies `pr-open`, records that parity as terminal attempt evidence, and turns an unresolvable push into a typed non-`pr-open` failure that retains the PR URL — so a delivered lane can never close with the lifecycle's evidence commit existing only locally.

## 1. SUMMARY

The dispatch engine currently derives `pr-open` from pull-request truth alone. The push of the branch's final evidence commit — the one recording the completed `pr_creation` phase and the PR URL — is a session-side convention of the delivery lifecycle, so a native delivery can be classified `pr-open` at exit 0 while that commit exists only locally. The delivered artifact and the merged artifact then differ by exactly the evidence the lifecycle promises, CI on the PR head is invalidated by the later manual push, and every affected delivery pays a second CI cycle; detection depends on an operator comparing heads. The defect was observed on two consecutive native deliveries and did not reproduce on a third: the current path permits both outcomes, which is why enforcement must be structural rather than behavioral.

This change closes the gap at the derivation: the engine-side ensure-push. When derivation arm 8 (open pull request, URL resolved) is reached, the engine reads the local branch head and the pull request's head SHA — the same parity computation the verify gates `push-parity` gate performs — pushes the change branch fast-forward when the local head is ahead, re-reads parity, and classifies `pr-open` only when the heads are equal. A rejected, failing, or still-unmet push is a typed non-`pr-open` result: a new row in the pinned failure-token mapping (token `failed`, outcome `failed`, exit 1, exactly one attempt record) that retains the PR URL and adds no token, no error identity, and no domain kind. The attempt's terminal evidence names the parity facts through bounded `push:<verdict>` evidence references and an additive optional machine-envelope block; text mode stays the four-key contract. The corroboration requirement map stays closed — parity is enforced at derivation, not added as a corroboration source. The engine-side push is a precedent-setting write-I/O extension for the dispatch engine; a decision record authored through `@decision-advisor` accompanies the change. AC satisfaction is two in-change fixtures (parity before `pr-open`; typed failure on rejected push) plus a declared post-merge live-verification contract for the ticket's two-consecutive-dispatch proof.

## 2. CONTEXT

### 2.1 Current State Snapshot

- The dispatch engine's derivation is one total order ending in the closed eleven-token vocabulary. Arm 8 derives `pr-open` from an open pull request (and `pr-open-unverified` when the URL cannot be resolved) with no precondition on branch parity: no push act exists anywhere in the engine, and no comparison between the local head and the pull request's head is made at classification time.
- The push of delivery commits is session-side convention. In the lifecycle's `pr_creation` slice, the PR-creation workflow's retained git writes are exactly the push and PR creation; the commit primitive never pushes. Nothing in the typed lane verifies that the push happened.
- Verify gates already defines the parity property this ticket asks for: the `push-parity` gate compares the checkout's local head SHA against the open delivery request's head SHA, requiring equal full-hex SHAs, computed from bounded local repository reads and the provider's delivery-request detail.
- The adapters layer owns bounded git child-process seams with fixed argv, injected runners, and timeouts: bounded reads (HEAD, branch refs) and local-only mutations (the commit primitive; the merge transaction's rebase-refresh, squash landing, and branch deletion, declared no-network and no-remotes). No remote-write operation exists in the typed stack. The parked repository work on centralizing git operations is not a dependency of this change.
- Dispatch explicitly has no merge port and no merge code path; a merge-ready PR stays `pr-open` for the coordinator's merge. The engine's process starts are fixed argv with no shell, enforced by the no-shell invariant over the declared dispatch-flow surfaces.
- Attempt records carry at most 16 bounded evidence references (two reserved ahead of the slice), a comparison record with an optional reason, and tri-state corroboration over the closed source map (`pm-notes`, `tracker`, `ci`); `pr-open` currently requires the tracker source only. The machine envelope's additive-optional precedents (the bounded pre-session failure detail; additive optional success fields present together or absent together) are established.

### 2.2 Pain Points / Gaps

- A native delivery can close `pr-open` with the branch's final evidence commit — the `pr_creation` completion and PR URL — existing only locally. The merged artifact then lacks the delivered change's own evidence.
- The later manual push invalidates CI on the PR head, so the delivery pays a second CI cycle for a commit that belonged in the pull request from the start.
- `pr-open` is truthful about the pull request but the lane closes as if complete; the divergence is detectable only by an operator comparing heads.
- Enforcement is behavioral (lifecycle convention), while the current code path demonstrably permits both pushed and unpushed outcomes; nothing pins the invariant.

## 3. PROBLEM STATEMENT

Because the dispatch engine classifies `pr-open` from pull-request truth alone — with no parity precondition, no push act of its own, and push left to session-side convention — a native delivery can end `pr-open` with the lifecycle's evidence commit unpushed, so the delivered artifact and the merged artifact differ by exactly the evidence the lifecycle promises, every affected delivery pays a second CI cycle, and the divergence surfaces only through manual head comparison.

## 4. GOALS

- **G-1**: `pr-open` is parity-backed by construction: the engine ensures the change branch is pushed and equals the pull request's head before the `pr-open` token derives.
- **G-2**: The attempt's terminal evidence names the pushed head and asserts local-head/remote-head equality, in the delivered evidence-reference and envelope styles.
- **G-3**: A push that fails or cannot establish parity is a typed non-`pr-open` result that retains the PR URL, adds no new token or error identity, and is honest about the cause.
- **G-4**: A dispatch classified `pr-open` with the local head ahead of the pull request's head is impossible by construction and pinned by fixture as a defect definition.
- **G-5**: No silent drift: the machine-envelope additions, the shell-fallback divergence, and the precedent-setting nature of engine-side write I/O are each explicitly declared and documented.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Natural dispatches ending `pr-open` with local head ahead of the PR head | 0 (from the twice-observed defect pattern; verified by the post-merge live verification) |
| `pr-open` classifications carrying parity evidence (evidence reference + envelope block) | 100% |
| Deliveries paying a second CI cycle for an unpushed evidence commit | 0 |
| In-change fixtures proving AC-1 (parity before `pr-open`) and AC-2 (typed failure on rejected push) | 2 of 2 gating the merge in-PR |
| New result tokens, error identities, domain kinds, or attempt-schema fields added | 0 |

### 4.2 Non-Goals

- **NG-1**: No merge capability: dispatch keeps no merge port and no merge code path; a push is not a merge, and the coordinator's merge decision is unchanged.
- **NG-2**: No vocabulary growth: no new result token, no new error-table row, no new domain kind, no new derivation arm. Interpretive clause (DoR iteration-1 finding 1): the closure forbids new result tokens, error identities, error-table rows, record kinds, derivation arms, and corroboration sources, while exactly one failure-class mapping row and one comparison-reason literal are added as declared in Appendix B — the failure-classification table is the declaredly growing structure, and kind = record/evidence kinds, never the failure-class union.
- **NG-3**: No change to session-side conventions: the delivery lifecycle's push behavior and the PR-creation workflow's retained git writes are unchanged; the engine's ensure-push is a reconciliation backstop, not a replacement instruction.
- **NG-4**: No change to the shell fallback's behavior: `deliver-ticket.sh` and the other bash entry points keep their current push behavior.
- **NG-5**: No force-capable remote mutation: the push act is fast-forward-only, targets only the change branch's configured upstream, and never the base branch or any other ref.
- **NG-6**: No dependency on the parked git-operations-centralization work; the push seam extends the delivered adapters-layer child-runner pattern as it stands.
- **NG-7**: No attempt-record schema change: the record gains no new field, kind, or corroboration source; parity evidence rides the existing bounded evidence-reference budget and the render-time envelope.
- **NG-8**: No changeset outside the standing lockstep invariant: five fixed-group packages, all minor.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Derivation-time parity precondition with an engine-side ensure-push act at the `pr-open` arm | Behaviour 1 of the ticket: the lifecycle pushes the final commit(s) before the attempt is classified `pr-open`; only structural enforcement survives the demonstrated non-determinism of session-side convention |
| F-2 | Terminal parity evidence: bounded `push:<verdict>` attempt evidence references plus an additive optional machine-envelope parity block | Behaviour 2: the attempt's terminal evidence names the pushed head and asserts local head == remote head |
| F-3 | Typed push-failure classification: one new row in the pinned failure-token mapping | Behaviour 3: a failed push is a typed non-`pr-open` result retaining the PR URL, inside the closed vocabulary |
| F-4 | Post-merge live verification of two consecutive natural dispatches | The ticket's AC-3, satisfied per the declared contract so the DoD gate can evaluate it without two unsolicited in-change deliveries |
| F-5 | Declared shell-fallback divergence | The typed lane gains parity enforcement; the documented bash fallback does not — declared, never silent |

### 5.1 Capability Details

**F-1 — Parity precondition and ensure-push.** Derivation arm 8 (an open pull request whose URL is resolved) gains a parity precondition: the classification evaluates the delivered parity computation — the checkout's local branch head compared for equality against the pull request's head SHA, both full-hex, exactly the comparison the verify gates `push-parity` gate performs. When the local head is ahead, the engine performs one bounded ensure-push: a fast-forward-only push of the change branch to its configured upstream remote, then re-reads parity. `pr-open` derives only when the heads are equal. Declared behaviors:

- **Parity already holds** (the session pushed, or nothing to push): no push act is performed; the classification proceeds with `push:clean` evidence.
- **Local head ahead**: one bounded push, one parity re-read, then `pr-open` with `push:pushed` evidence.
- **Push rejected, failed, timed out, or parity still unmet after the act**: the typed failure of F-3; `pr-open` never derives.
- **Parity read unreadable**: the delivered undecidable-truth semantics apply — `state-unverified` at exit 2 — not the push-failure row; only a readable inequality or a rejected act is the typed failure.
- **Remote head ahead of local** (a state a fast-forward push cannot resolve): the typed failure of F-3.
- **`pr-open-unverified`** (open pull request, URL unresolved): the precondition is inapplicable — there is no pull-request head fact to compare — and the token's delivered semantics are unchanged (DEC-5). The residual risk is declared in RSK-3.
- **Resume**: the precondition binds every classification that reaches arm 8, including the terminal classification of a resumed recorded `pr-open` lane; the act is idempotent on an already-parity branch.
- **Composition scoping**: the precondition binds classifications in compositions that supply the parity/ensure-push capability; a composition that supplies no parity facts (the daemon lane) is outside the precondition's bind — the daemon lane composes no ensure-push capability and keeps the delivered arm-8 classification, its delivered arm-8 semantics standing until it composes the port.
- **Session posture**: the act is post-session and pre-classification. It never spawns, resumes, or restarts a session, consumes no restart ordinal, and starts no second session. The stall ladder is unchanged: its artifact-derived verdicts are restart-decision facts, not classifications, and the precondition binds the derivation only.
- **Act contract**: fixed argv, literal non-shell child process, bounded child timeout of 60 000 ms (the delivered git-mutation-seam budget, injectable, no new configuration key), one attempt per classification with no retry ladder — the next dispatch or an operator resume resolves a failed act. Credentials are the checkout's ambient git credential chain; no credential is resolved, read, or stored by the engine beyond what the checkout already uses.

**F-2 — Terminal parity evidence.** The attempt's bounded evidence references record the parity outcome as `push:<verdict>` with the closed verdict set `clean`, `pushed`, `failed` — identifiers only, no provider payload, no credential, no diff. These references join the reserved-ahead-of-slice set (beside the two delivered reserved references) so a disclosure is never truncated away, within the delivered 16-reference budget. The machine envelope carries an additive optional `push` block, present together-or-absent-together exactly when the derivation evaluated the parity precondition (the `pr-open` success and the typed push failure), with bounded single-line members: `verdict`, `localHead`, `remoteHead`, `parity`, whole-block bounded at the delivered 256-character dispatch bound. Human text mode stays the delivered four-key contract; the parity facts do not enter text mode, and the verbose detail line's scope is unchanged.

**F-3 — Typed push failure.** One row is added to the pinned failure-token mapping, in the delivered table shape:

| Failure class | Attempt record | Result token | Outcome | Exit | Comparison record |
|---|---|---|---|---|---|
| Lifecycle push failure — the bounded ensure-push act at the `pr-open` arm is rejected, fails, times out, or parity remains unmet after it | exactly one | `failed` | `failed` | 1 | not applicable, token null, reason `push-parity-unmet` |

The row adds no error identity, no result token, no domain kind, and no error-table row. The comparison is not-applicable with a null token because the failure is dispatch-derived, not a truth disagreement; `push-parity-unmet` is a new declared literal of the comparison record's optional reason field. The failure follows the delivered failure-row semantics: it counts for class coverage as exposure, makes no success claim, creates no divergence, and blocks nothing. The PR URL is retained — `pr_url` stays populated in text mode and `prUrl` in the machine data — and the envelope is the delivered data-bearing shape for a recorded failure with no error identity (`data.result` and `data.outcome`, no top-level error).

**F-4 — Post-merge live verification (the AC-3 contract).** The ticket's third acceptance criterion — two consecutive real dispatches ending with local == remote at `pr-open` — is satisfied as **post-merge live verification**: the AC-1 and AC-2 fixtures gate the merge in-PR, and the first two consecutive natural dispatches after the change's merge must each end with the local head equal to the pull request's head at the `pr-open` classification, parity evidence present on both attempts. The CEO/owner lane records the observation as the live verification (the pm-notes `notes:` trail is its home). This contract is the declared satisfaction form for the DoD gate; a `pr-open` classification that still diverges is a typed failure under F-3, so the post-merge proof cannot pass silently. The owner override point for this contract is the open-PR human review (DEC-2).

**F-5 — Shell-fallback divergence, declared.** The parity precondition and the ensure-push act are typed-lane behavior. The bash fallback keeps its delivered behavior — its five-key summary tail, its exits, and its current push conventions — and gains no engine-side parity enforcement. The divergence between the typed lane and the documented fallback is declared in the feature specifications' fallback rows and the engine-first operations guide, so the lanes' difference is documented rather than silent; the fallback's status as the documented, still-executable fallback and its retirement as a separate owner act are unchanged.

## 6. USER & SYSTEM FLOWS

```
Flow 1: Clean parity (the common case; the session pushed during pr_creation)
  Session ends → collection resolves → derivation reaches arm 8 (open PR, URL resolved)
    → engine reads local head + PR head SHA → heads equal
    → no push act; attempt records push:clean; envelope push block (parity=true)
    → classified pr-open, exit 0

Flow 2: Local head ahead (the defect case, now reconciled)
  ... derivation reaches arm 8 → heads unequal, local ahead
    → one bounded fast-forward push of the change branch → parity re-read → heads equal
    → attempt records push:pushed; envelope push block names both heads (parity=true)
    → classified pr-open, exit 0 — the evidence commit is on the PR head before the lane closes

Flow 3: Push cannot establish parity
  ... arm 8 → local ahead → push rejected / failed / timed out / parity still unmet
    → typed failure: result=failed, outcome=failed, exit 1
    → exactly one attempt record with push:failed evidence and comparison reason push-parity-unmet
    → PR URL retained; never pr-open

Flow 4: Parity fact unreadable
  ... arm 8 → parity read unreadable → delivered undecidable-truth semantics
    → state-unverified, exit 2 (not the push-failure row)

Flow 5: Resume of a recorded pr-open lane
  Operator resumes → session re-enters, completed phases skipped → terminal classification
    → arm 8 parity precondition re-evaluated; ensure-push idempotent on an equal branch
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The parity precondition at derivation arm 8, binding every `pr-open` classification (fresh or resumed).
- The engine-side ensure-push act: one bounded fast-forward push of the change branch to its configured upstream, through the delivered adapters-layer child-runner pattern, composed into the dispatch flow as an injected capability.
- The parity computation reuse: local head vs pull-request head SHA, the verify gates `push-parity` definition.
- The new failure-token-mapping row and the `push-parity-unmet` comparison-reason literal.
- The `push:<verdict>` evidence references (verdicts `clean`, `pushed`, `failed`) and their reservation ahead of the evidence slice.
- The additive optional machine-envelope `push` block and its bound.
- The AC-1 and AC-2 fixtures, the divergent-`pr-open` defect pin, and the declared AC-3 post-merge live-verification contract.
- Documentation reconciliation: the dispatch-engine feature page (derivation arm, failure mapping, evidence references, envelope), the quality-gates feature page (`pr_creation` tail cross-reference), the verify-gates feature page (the shared parity definition), the autonomous-delivery feature page (fallback rows), the engine-first operations guide, and the dispatch-engine test-spec coverage map.
- The companion decision record for the precedent-setting engine write-I/O extension, authored through `@decision-advisor` within the change.
- The standing lockstep changeset: five fixed-group packages, all minor.

### 7.2 Out of Scope

- [OUT] Any merge capability, merge port, or merge code path in dispatch.
- [OUT] Any new result token, error identity, error-table row, domain kind, derivation arm, or attempt-record field.
- [OUT] Changes to session-side push conventions, the commit primitive's never-push rule, or the PR-creation workflow's retained git writes.
- [OUT] Changes to the bash fallback's behavior or its retirement.
- [OUT] Force pushes, pushes to the base branch, or pushes to any ref other than the change branch's configured upstream.
- [OUT] A retry ladder for the push act (one attempt per classification).
- [OUT] Parity enforcement for `pr-open-unverified` (no pull-request head fact exists to compare; DEC-5).
- [OUT] A fourth corroboration source or any change to the closed corroboration requirement map.
- [OUT] Any dependency on the parked git-operations-centralization work.
- [OUT] Cloud or hosted concerns of any kind.

### 7.3 Deferred / Maybe-Later

- Extending parity enforcement to the bash fallback, at or before its retirement.
- Richer push-rejection cause disclosure (for example, distinguishing authentication rejection from non-fast-forward) if operator evidence shows the single `push:failed` verdict is insufficient.
- Re-evaluating the `pr-open-unverified` residual once URL resolution improves.
- Closing the daemon-lane residual: the twice-observed defect pattern remains possible on the daemon lane until it composes the parity/ensure-push port (RSK-7).

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A. No HTTP surface changes. The parity evaluation performs its own bounded provider reads: the precondition evaluation performs one fresh bounded open-request list read (fail-closed, the same read class and resolution semantics as the derivation's pull-truth read), and, after a performed push, one fresh local+remote read pair for the parity re-read; an unreadable parity read resolves `state-unverified` (never a false `pr-open`).

### 8.2 Events / Messages

N/A. No new event or record kind. The attempt, lane, divergence, and handover record shapes are unchanged; parity evidence rides the existing evidence-reference budget, and the terminal lane record keeps its delivered fields.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | `push:<verdict>` attempt evidence references | Bounded identifiers in the delivered evidence-reference family, verdicts `clean`, `pushed`, `failed`; join the reserved-ahead-of-slice set; within the delivered 16-reference budget; identifiers only |
| DM-2 | Additive optional machine-envelope `push` block | Present together-or-absent-together exactly when the parity precondition evaluated; members `verdict`, `localHead`, `remoteHead`, `parity`; bounded single-line, whole block within the delivered 256-character dispatch bound |
| DM-3 | Failure-token-mapping row and comparison-reason literal | One new failure class (lifecycle push failure) mapped to `failed` / `failed` / exit 1 / exactly one attempt record / comparison not-applicable with the new declared reason literal `push-parity-unmet`; no identity, token, or kind added. Interpretive clause (DoR iteration-1 finding 1): kind = record/evidence kinds — the failure-classification table is the declaredly growing structure, and this row is exactly the one mapping row the closure's forbidden lists never counted |

### 8.4 External Integrations

- **Git remote (GitHub)**: one fast-forward push of the change branch per classification at most, over the checkout's configured upstream with its ambient credential chain. This is the change's only new external write; it uses the same credential trust boundary the session-side pushes already use. No new credential resolution, storage, or transport.
- **Provider delivery-request read (GitHub)**: unchanged as a read; the pull request's head SHA is the remote-head fact for the parity comparison, the same fact verify gates compares.

### 8.5 Backward Compatibility

- The machine-envelope `push` block is additive optional, present together or absent together, and absent on every outcome where the parity precondition did not evaluate; existing consumers are unaffected (delivered additive-field precedents).
- Text mode is byte-compatible: the four-key contract is unchanged.
- Attempt records gain no field; pre-change records without `push:` references read unchanged, and reads never fabricate parity facts for them.
- Behavior narrows strictly: classifications that previously derived `pr-open` while the local head was ahead now either reconcile (push lands, `pr-open`) or type-fail (`failed`, PR URL retained). That narrowing is the defect fix, and the failure is honest and typed rather than a false success.
- The eleven-token vocabulary, projections, derivation classes, exits, and the corroboration requirement map are unchanged.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Push act boundedness | At most one push per classification, no retry; fixed argv, literal non-shell child process; bounded child timeout 60 000 ms (injectable, no new configuration key); fast-forward-only; change branch's upstream only |
| NFR-2 | Added classification cost | At most one extra bounded parity read after a performed push; total added wall-clock bounded by the 60 000 ms push budget plus one bounded read; no new provider read class |
| NFR-3 | No-shell invariant preservation | Every new process start is fixed argv with literal non-shell spawn; the declared dispatch-flow surface list covers the new seam so the static scan rules apply to it |
| NFR-4 | Output-surface stability | Text mode byte-unchanged (four keys); machine additions bounded single-line, whole `push` block within 256 characters; no new configuration key on any path |
| NFR-5 | Evidence budget integrity | `push:` references count within the 16-reference budget and are reserved ahead of the slice, so a disclosure is never truncated away |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- The attempt record's `push:<verdict>` references are the durable telemetry: an operator reading the attempts digest sees the parity outcome per attempt without reading git state.
- The machine-envelope `push` block names both compared heads and the verdict at classification time.
- The typed push failure is visible as `result=failed` / exit 1 with the PR URL retained and `push:failed` evidence; no silent failure shape exists.
- No new metrics surface, log stream, or alert is introduced; the dual-run evidence gate continues to count the failure class as exposure per the delivered failure-row semantics.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Engine-side push is a precedent-setting write-I/O extension for the dispatch engine | M | M | Companion decision record through `@decision-advisor` accompanies the change; the act is fast-forward-only, bounded, single-attempt, and change-branch-scoped; no force-capable variant exists | L — the pattern is accepted and documented for future seams |
| RSK-2 | Push rejections (non-fast-forward, protected branch, credential rejection) leave deliveries failing at exit 1 | M | M | Typed failure retains the PR URL and names the cause class through `push:failed`; the next dispatch or an operator resume re-evaluates idempotently; no restart is consumed | L — operator-visible, honest, and resumable |
| RSK-3 | A `pr-open-unverified` lane can still end with the local head ahead (no PR head fact to compare) | L | L | Declared out of the precondition (DEC-5); the token's delivered unverified semantics already make no parity claim; recorded as deferred | L — unchanged from today for that token |
| RSK-4 | Provider head-read staleness immediately after a push misclassifies a good delivery | M | L | The parity read is the delivered bounded read shape; a readable inequality type-fails honestly and is resolved by the next dispatch; an unreadable parity read resolves `state-unverified`, never a false `pr-open` | L |
| RSK-5 | Typed lane and bash fallback drift further apart | L | M | The divergence is declared in the feature specifications' fallback rows and the operations guide (F-5); the fallback's documented status and retirement path are unchanged | L — documented, never silent |
| RSK-6 | Concurrent pushes to the same branch interleave | L | L | A rejected interleaved push is the typed failure; git's own fast-forward rejection is the arbiter; the next dispatch reconciles | L |
| RSK-7 | The daemon lane composes no parity/ensure-push capability, so the twice-observed unpushed-evidence defect pattern remains possible there until it composes the port | M | M | The exemption is declared, not silent: this spec (F-1 composition scoping, AC-F1-1, §7.3) and the feature page scope the precondition to compositions that supply the capability; the daemon lane's composition is the follow-up surface that closes the residual | M — declared, not closed: the pattern remains possible on the daemon lane until it composes the parity/ensure-push port |

## 12. ASSUMPTIONS

- A pull request open for the change branch implies the branch has a configured upstream remote; the ensure-push therefore never needs upstream discovery.
- The ambient git credential chain that already pushes from this checkout is available to the engine's child process, which runs in the same checkout and environment as the session it supervised.
- GitHub's delivery-request head reflects a landed branch push in time for the single bounded parity re-read; a stale read is handled as RSK-4, not retried.
- The verify gates parity definition (local head vs delivery-request head, full-hex equality) is the authoritative parity semantics for the delivery lane.
- The standing lockstep changeset invariant (five fixed-group packages, all minor) applies to this change.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Delivered dispatch derivation ladder, closed eleven-token vocabulary, and pinned failure-token mapping | Arm 8 gains the precondition; the mapping gains one row; nothing else in either structure changes |
| Depends on | Delivered adapters-layer git child-runner pattern (bounded reads; local-only commit and merge-transaction seams) | The push operation extends the same injected fixed-argv child-runner pattern; the parked centralization work is not a dependency |
| Depends on | Delivered verify gates `push-parity` computation | The parity definition (local head vs PR head, full-hex equality) is reused, not reinvented |
| Depends on | Delivered provider delivery-request read | Supplies the remote-head fact; resolved today at the dispatch admission preflight |
| Depends on | Delivered additive-envelope and bounded-evidence precedents | The `push` block and `push:` references follow the delivered shapes and bounds |
| Depends on | Companion decision record (via `@decision-advisor`) | Precedent-setting engine write I/O; authored within the change alongside the spec |
| Blocks | Clean end-to-end native delivery (per the ticket) | The unpushed-evidence defect is the standing obstacle |
| Blocks | M4 handover confidence | `pr-open` and `merged` claims rest on pushed, parity-verified heads |

## 14. OPEN QUESTIONS

None. The two judgment calls the ticket left open are declared here with their bases, not carried as questions:

- **Mechanism (engine-side vs session-side)**: declared engine-side from code truth (DEC-1); the typed stack has the child-runner seam pattern and the parity computation, and no remote-write operation exists today — the extension is feasible, bounded, and precedent-setting, hence the companion decision record. A session-side prompt-reliant push with dispatch-side verification was rejected as the enforcement mechanism because the demonstrated failure is exactly a conformance gap.
- **AC-3 logistics**: declared as the post-merge live-verification contract (DEC-2, F-4), decided PM-autonomous and disclosed on the ticket; the owner override point is the open-PR human review.

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | The parity precondition is enforced engine-side: the dispatch engine performs the ensure-push act before classification, via an injected adapters-layer child-runner capability | Code truth: the delivered child-runner seams, the composition's injection pattern, and the verify gates parity computation make a deterministic engine-side act feasible; the observed defect is a session-side conformance gap, so enforcement must not rely on prompt conformance. Precedent-setting write I/O: a decision record authored through `@decision-advisor` accompanies the change | 2026-11-23 |
| DEC-2 | AC-3 is satisfied as post-merge live verification: AC-1/AC-2 fixtures gate the merge in-PR; the first two consecutive natural dispatches after merge must end local == remote at `pr-open`, recorded by the CEO/owner lane | Two in-change live dispatches would commit the owner to two unsolicited deliveries; requirement 3 makes a divergent `pr-open` a typed failure, so the post-merge proof cannot pass silently. PM-autonomous decision disclosed on the ticket; owner override at the PR gate | 2026-11-23 |
| DEC-3 | Parity evidence rides the bounded evidence-reference family (`push:<verdict>`, reserved ahead of the slice) and the additive envelope block; the corroboration requirement map stays closed and `pr-open` still requires the tracker source only | A fourth corroboration source would be an attempt-schema change; derivation-time enforcement plus evidence references satisfy behaviours 1–4 without schema growth, matching the delivered evidence-reference style | 2026-11-23 |
| DEC-4 | The push failure maps through one new failure-token-mapping row (`failed` / `failed` / exit 1 / exactly one attempt record) with a not-applicable comparison carrying the new reason literal `push-parity-unmet`; no error identity | The vocabulary is closed; the delivered failure-row semantics (exposure, no success claim, no divergence, blocks nothing) already cover the class; a dispatch-derived failure takes a not-applicable comparison per the table's shape | 2026-11-23 |
| DEC-5 | `pr-open-unverified` is outside the parity precondition | No pull-request head fact exists to compare; the token's delivered semantics already express the unverified gap; extending the precondition would require a second, staleness-prone remote-head source | 2026-11-23 |
| DEC-6 | The shell fallback gains no parity enforcement; the divergence is declared in documentation (F-5) | The fallback is the documented, still-executable fallback whose retirement is a separate owner act; declaring the divergence avoids silent drift without widening this change's scope | 2026-11-23 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Dispatch derivation (arm 8) and the pinned failure-token mapping | Updated — parity precondition; one new failure-class row; comparison-reason literal |
| Adapters-layer git seam family | Updated — one new remote-write operation (fast-forward change-branch push) on the delivered child-runner pattern; the local-only declaration of the existing merge-transaction seam is unchanged |
| Dispatch production composition | Updated — supplies the push capability to the engine as injected data/seam, like the delivered spawn identity, delay, and terminate bindings |
| Machine envelope for `dispatch <ref>` | Updated — additive optional `push` block; text mode unchanged |
| Attempt evidence-reference reservation rule | Updated — `push:` references join the reserved-ahead set |
| Verify gates | Unchanged — its `push-parity` computation is reused as the parity definition; documented as the shared seam |
| Bash fallback entry points | Unchanged — divergence declared (F-5) |
| Feature and operations documentation | Updated — dispatch-engine page (primary), quality-gates page (`pr_creation` tail cross-reference), verify-gates page (shared parity seam), autonomous-delivery page (fallback rows), engine-first operations guide, dispatch-engine test-spec coverage map |
| Changesets | Updated — standing lockstep invariant: five fixed-group packages, all minor |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** a change whose session records the `pr_creation` phase and commits the PR URL, **when** the dispatch reaches terminal classification with an open pull request whose URL is resolved, **then**, for classifications in compositions that supply the parity facts, the branch's local head equals the pull request's head before the `pr-open` token derives — a local-ahead state is reconciled by one bounded fast-forward push and a parity re-read, and an already-equal state performs no push act — while compositions without the capability keep the delivered classification | F-1, NFR-1 |
| AC-F1-2 | **Given** the typed lane, **when** any dispatch would classify `pr-open` while the local head is ahead of the pull request's head, **then** that outcome is impossible by construction — the fixture pins the divergent `pr-open` classification as a defect: either the push reconciles parity first or the result is the typed failure, never a divergent `pr-open` | F-1, DM-1 |
| AC-F2-1 | **Given** a classification that evaluated the parity precondition, **when** the attempt record and machine envelope are rendered, **then** the attempt carries the `push:<verdict>` evidence reference reserved ahead of the evidence slice and the envelope carries the additive optional `push` block naming `verdict`, `localHead`, `remoteHead`, and `parity`, while text mode stays the four-key contract | F-2, DM-1, DM-2, NFR-4, NFR-5 |
| AC-F3-1 | **Given** parity unmet and a push that is rejected, fails, times out, or leaves parity unmet, **when** the dispatch classifies, **then** the result is `failed` with outcome `failed` at exit 1 — never `pr-open` — with exactly one attempt record, comparison not-applicable with reason `push-parity-unmet`, the PR URL retained in both output modes, and no new token, error identity, or domain kind | F-3, DM-3, NFR-1 |
| AC-F4-1 | **Given** the change is merged and the typed lane is the regular delivery path, **when** the first two consecutive natural dispatches after the merge reach terminal classification, **then** each `pr-open` classification ends with the local head equal to the pull request's head and parity evidence present on both attempts, and the CEO/owner lane records the observation as the live verification; this is the declared AC-3 satisfaction contract the DoD gate evaluates (owner override point: the open-PR review) | F-4 |
| AC-F5-1 | **Given** the shipped bash fallback, **when** the documentation reconciliation lands, **then** the fallback rows and the operations guide declare that parity enforcement is typed-lane behavior and the fallback keeps its delivered behavior — no silent drift | F-5 |

Ticket-AC traceability: ticket AC-1 (parity fixture) → AC-F1-1 + AC-F2-1; ticket AC-2 (rejected-push fixture) → AC-F3-1; ticket requirement 4 (defect pin) → AC-F1-2; ticket AC-3 (two consecutive real dispatches) → AC-F4-1 under the DEC-2 contract.

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Full 11-phase lifecycle on the change branch; commits through the commit primitive; gate evidence uses `TMPDIR=$PWD/tmp/tmpdir`; the PR targets `main-tools` and stops with the PR open.
- The companion decision record (engine write-I/O extension) is authored through `@decision-advisor` within the change and lands with it.
- In-merge gate: the AC-1 and AC-2 fixtures plus the defect pin (AC-F1-2) gate the merge; the test-spec coverage map is reconciled in the same change.
- Post-merge: the first two consecutive natural dispatches are the live verification (F-4), recorded by the CEO/owner lane; a divergence there surfaces as the typed failure, not silently.
- Changeset: standing lockstep invariant — five fixed-group packages, all minor.
- No repository flip, no handover record, and no authority change is part of this change (the no-flip operating definition stands).

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A. All record kinds are append-only and shape-stable; no migration, backfill, or seeding is required. Pre-change attempts without `push:` references read unchanged, and reads never fabricate parity facts for them.

## 20. PRIVACY / COMPLIANCE REVIEW

N/A. No personal data is introduced. The push transports commits already authored locally in the same checkout; evidence references and envelope fields are identifiers and SHAs only — no prompt, transcript, diff, credential, or provider payload enters any record or output.

## 21. SECURITY REVIEW HIGHLIGHTS

- The push act runs the git binary with fixed argv and a literal non-shell child process, inside the delivered bounded-timeout child-runner pattern; the no-shell invariant's surface list covers the new seam.
- The act is fast-forward-only with no force-capable variant, scoped to the change branch's configured upstream; it never targets the base branch or any other ref.
- Credentials are the checkout's ambient git credential chain — the same trust boundary session-side pushes already use; the engine resolves, reads, and stores no credential.
- Evidence and envelope additions are identifiers and full-hex SHAs only, bounded single-line; the redaction and bounding delivered at the serialization chokepoint are unchanged.
- `security_impact: low`: one new write path over an existing credential boundary, with declared bounds and a typed failure on rejection.

## 22. MAINTENANCE & OPERATIONS IMPACT

- The failure-token mapping gains one class that counts for coverage exposure; the dual-run coverage evaluation is unchanged in shape.
- Operators diagnose a push failure from the attempts digest (`push:failed`, comparison reason `push-parity-unmet`, retained PR URL) and resolve by fixing the remote state and re-dispatching or resuming; the act is idempotent.
- The test-spec coverage map for the dispatch engine gains the parity-precondition and push-failure classes, keeping the offline battery the contract's proof surface.
- The parity definition now has two consumers (verify gates and dispatch classification); the verify-gates feature page documents the shared seam so future changes keep them aligned.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Ensure-push | The engine's bounded act that pushes the change branch fast-forward to its upstream when the local head is ahead, before classification |
| Parity (branch/PR) | The local branch head SHA equals the pull request's head SHA, both full-hex — the same equality the verify gates `push-parity` gate requires |
| Parity precondition | The derivation-time condition that arm 8 may resolve `pr-open` only when parity holds |
| `push:<verdict>` | The bounded attempt evidence reference recording the parity outcome: `clean`, `pushed`, or `failed` |
| Failure-token mapping | The pinned table giving every dispatch failure class one result token, outcome, exit, attempt-record policy, and comparison treatment |
| `pr-open-unverified` | The delivered token for an open pull request whose URL cannot be resolved; outside the parity precondition |
| Derivation arm 8 | The total derivation's open-pull-request branch, which resolves `pr-open` or `pr-open-unverified` |
| Corroboration requirement map | The closed per-token map of required corroboration sources (`pm-notes`, `tracker`, `ci`); unchanged by this change |
| Dual-run | The repository authority where bash entry points are authoritative and the typed engine accrues evidence; the fallback divergence (F-5) is declared here |
| Live verification | The post-merge observation of two consecutive natural dispatches ending local == remote at `pr-open`, recorded by the CEO/owner lane |

## 24. APPENDICES

### Appendix A — Code-truth basis for the declared mechanism

- The production dispatch composition already injects a git child runner ("production spawns the git binary; tests inject facts"), and the adapters-layer git seams execute bounded fixed-argv git child processes (literal non-shell spawn, injected runner, declared timeouts: 60 000 ms for the merge-transaction mutations, 30 000 ms for the commit primitive).
- Verify gates computes parity as the checkout's local head SHA compared for equality against the open delivery request's head SHA, both full-hex — the fact pair this change reuses at dispatch classification.
- The existing git mutation seams are local-only by declaration (the merge transaction's seam states no network and no remotes); no remote-write operation exists anywhere in the typed stack today. The engine-side push is therefore genuinely new write I/O — feasible on the delivered pattern, and precedent-setting, hence the companion decision record.
- Session-side push today is convention: the PR-creation workflow's retained git writes are exactly the push and PR creation, and the commit primitive never pushes. The twice-observed divergence and the third run that did not reproduce it show the current path permits both outcomes; structural enforcement is the remedy.
- Dispatch has no merge port and no merge code path; a push is not a merge, so the act contradicts nothing — but it is declared and decided as its own extension (DEC-1), not smuggled through a merge concept.

### Appendix B — The pinned failure-token-mapping row (verbatim)

| Failure class | Attempt record | Result token | Outcome | Exit | Comparison record |
|---|---|---|---|---|---|
| Lifecycle push failure — the bounded ensure-push act at the `pr-open` arm is rejected, fails, times out, or parity remains unmet after it | exactly one | `failed` | `failed` | 1 | not applicable, token null, reason `push-parity-unmet` |

Row semantics inherited from the delivered table: counts for class coverage as exposure, makes no success claim, creates no divergence, blocks nothing, adds no error identity, no token, no domain kind, no error-table row.

### Appendix C — Ticket acceptance-criterion traceability

| Ticket AC / requirement | Spec coverage |
|-------------------------|---------------|
| AC-1 fixture: PR-creation flow records phase, commits URL, asserts remote head == local head before `pr-open` | AC-F1-1, AC-F2-1 (F-1, F-2) |
| AC-2 fixture: rejected push → typed non-`pr-open` result carrying the PR URL | AC-F3-1 (F-3) |
| Requirement 4: `pr-open` with local head ahead of the PR head is a defect by definition, pinned by fixture | AC-F1-2 (F-1) |
| AC-3: two consecutive real dispatches end local == remote at `pr-open` | AC-F4-1 (F-4) under the DEC-2 post-merge live-verification contract |

### Appendix D — Declared envelope parity block

```
data.push (additive optional; present exactly when the parity precondition evaluated):
  verdict:    clean | pushed | failed
  localHead:  <full-hex sha>
  remoteHead: <full-hex sha — the pull request's head>
  parity:     true | false
```

Bounded single-line members; whole block within the delivered 256-character dispatch bound; absent on every outcome where the precondition did not evaluate; text mode unchanged.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-23 | @spec-writer (GLM-5.3-Flash) | Initial specification |
| 1.1 | 2026-11-23 | @coder (GLM-5.3-Flash) | Review iteration-1 remediation: F-1 daemon-lane composition scoping (§5.1 declared behavior, §17 AC-F1-1, §7.3 residual, §11 RSK-7) + F-2 parity-read declaration (§8.1) |

---

## AUTHORING GUIDELINES

- Sources: ticket GH-386 (body and the two owner comments), the change's pm-notes (intake, spec cross-check, open spec questions, delivery conventions), the current-truth feature specifications for the dispatch engine, verify gates, quality gates and PR, and autonomous delivery, and direct code truth: the production dispatch composition's injected git child runner, the adapters-layer git seams (bounded reads; local-only commit and merge-transaction mutations), the verify-gates parity computation, and the quality-gates page's PR-creation push convention.
- Current-state writing throughout: the spec states the delivered behavior and the declared behavior; the twice-observed defect appears only as motivating context, without build-to-build history narration, and the AC-3 contract is stated as the current contract per the ticket decision, not as comment history.
- Mechanism declaration was delegated to this spec from code truth (pm-notes): engine-side is declared with its basis in Appendix A and DEC-1; the parked git-centralization work is explicitly not a dependency.
- All PM cross-check constraints honored: closed vocabulary (no new token), failure-row shape per the delivered table, corroboration map unchanged with evidence-reference style, additive optional envelope fields with the delivered bounding precedent, explicit shell-fallback divergence, decision-record accompaniment for the precedent-setting extension, doc-impact list recorded for phase 7 planning.
- No implementation tasks, file paths, or code-level instructions; components are named by delivered behavior. Verification mechanics (fixtures, doubles, injected seams) are stated at behavior altitude and belong to the test plan for detail.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-386)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-1..F-5, DM-1..DM-3, NFR-1..NFR-5, RSK-1..RSK-7, DEC-1..DEC-6, AC-F*-*, G-1..G-5, NG-1..NG-8)
- [x] Acceptance criteria reference at least one F-/DM-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths, no step-by-step tasks)
- [x] No content duplicated from linked docs
- [x] Front matter validates per front_matter_rules (`milestone` equals the pm-notes milestone verbatim)
