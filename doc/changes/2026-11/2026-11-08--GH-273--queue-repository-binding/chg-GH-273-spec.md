---
change:
  ref: GH-273
  type: fix
  status: Proposed
  slug: queue-repository-binding
  title: "Fix the production queue repository binding so key and root always travel together"
  owners: [engineering]
  service: delivery-os
  labels: [bug, queue, scheduling, cli-composition, m1-s9, regression]
  version_impact: patch
  audience: internal
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - "Scheduling engine and queue entry contract (GH-237)"
      - "Queue edge composition seam and queue read/add surfaces"
      - "Production composition edge (repository facts, target resolution, queue composition)"
      - "Repository facts adapter (checkout root, origin remote, HEAD)"
      - "Dispatch identity resolution and scheduler-key precedence"
      - "Dispatch command runtime and the pre-spawn queue observation gate"
      - "Queue and pilot test fixtures"
      - "System specs: scheduling engine, CLI entrypoint"
    external:
      - "Local git metadata read-only inspection (origin remote, HEAD, worktrees); no network, no process spawn"
---

# CHANGE SPECIFICATION

> **PURPOSE**: Restore the production `queue add` path by making the CLI composition emit the repository key and the declaring checkout's root as one atomic pair (or neither), so a queue entry becomes observable and `dispatch` can start the first engine-driven pilot.

## 1. SUMMARY

The production composition builds the scheduling engine's repository binding with the repository key only, while the queue domain requires the key and the recorded root to be present together. Consequently `queue add` is structurally refused for any checkout whose GitHub origin resolves, `queue list` stays empty, and `dispatch` refuses with `queue.entry.unobserved` before any lane starts.

This change makes the binding atomic at its single construction site: key and root are derived from one repository-facts resolution of the declaring checkout, and the binding is absent entirely when either side is unresolved. It also aligns the recorded key with the documented normalized contention-domain key so the pair is mutually consistent and consumable by the consumers that already assume that form, and closes the fixture gap that let a one-sided binding pass every existing test. The domain invariant in the queue application layer is deliberately left untouched and gains its first negative coverage.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **The production binding is one-sided.** The production composition constructs the queue composition with a repository binding that carries only the repository key (owner/name). No root is supplied, and the key is not in the normalized contention-domain form the rest of the queue world uses.
- **The domain refuses one-sided bindings — twice.** The queue application layer rejects an add request where exactly one of key/root is present with `input.value.rejected` and the summary `repository key and recorded root must be present together`. The same predicate guards entry-record validation on read, so a one-sided record fails the fold closed as a torn store rather than being silently dropped.
- **The queue edge forwards each field independently.** The edge composition type declares the binding as an optional pair and copies each field separately into the add request, so any one-sided value supplied by a composition reaches the domain untouched. The edge therefore neither causes nor prevents the defect; it is a faithful pass-through.
- **The resolved facts are already in scope.** The composition already has the resolved repository facts and the resolved owner/name target available when it builds the queue composition. The facts record carries the checkout root (resolved by ascending from a possibly-nested working directory, including linked worktrees), the origin remote, and HEAD.
- **The root is specified but has no live consumer in this composition.** The scheduling-engine spec already states that the entry carries the normalized repository key and the declaring checkout's absolute root together, and that the root is internal state used only for producer deploy-expectation discovery — never serialized into envelopes, findings, incidents, log lines, or telemetry. The production composition does not wire the deploy-expectation port, so today the root is recorded contract state that becomes live when that port is wired; the key form, by contrast, is consumed immediately (readiness evidence, lease identity, derived graph keys, and dispatch scheduler-key precedence).
- **The queue and dispatch fixtures already use the normalized key.** The queue behaviour/scheduling fixtures and the dispatch fixtures record `host/owner/name` keys, and the deploy-expectation resolver compares an entry key with the normalized remote of its recorded root by exact equality. The production composition emits the host-less `owner/name` form, and the pilot fixture's synthetic seeds use a host-less form of their own. Dispatch identity normalization accepts only the three-segment normalized form, so a host-less scheduler key silently falls through to the remote-derived identity and reports source `remote` instead of `scheduler`.
- **No test ever composed a one-sided binding.** The queue CLI fixture always supplies both fields, and the behaviour suite has an unbound override case but no key-only or root-only case. The pilot fixture supplies a key-only binding. As a result, every existing test passes while the shipped composition cannot add a queue entry.
- **The observable failure chain is exactly as reported.** With a resolvable GitHub origin, `queue add` is refused; `queue list` shows no entries; `queue claim`/`dispatch` classify `queue.entry.unobserved`, which blocks the first engine-driven pilot.

### 2.2 Pain Points / Gaps

- **The queue cannot be populated in production.** The only composition that runs in a real checkout is guaranteed to be refused, so the queue is empty by construction and every downstream scheduling surface (list, plan, claim, lanes, dispatch) is starved.
- **The defect is invisible to the test suite.** Coverage tests the domain invariant abstractly and the composition with an ideal pair, never the composition's actual binding shape; a one-line producer bug survives a full green suite.
- **The recorded identity would be incomplete even after adding a root.** A host-less key would satisfy the "both present" predicate while still failing the consumers that compare it with a normalized remote or need the three-segment form; fixing only the missing field would convert a hard refusal into a quiet identity mismatch.
- **The failure surfaces as an unrelated error.** The user sees `input.value.rejected` on `add` and `queue.entry.unobserved` on `dispatch`, neither of which names the actual cause: a producer that violates the record contract.
- **The fixture that models the composition is itself wrong.** The pilot fixture composes the same one-sided binding, so it cannot detect the defect and would reproduce it the moment the pilot exercises `queue add`.

## 3. PROBLEM STATEMENT

Because the production composition emits a queue repository binding with the key only, a key that is not the normalized contention-domain form, and no root, the queue application layer's key-and-root-together invariant refuses every `queue add` in a real checkout; as a result the queue can never hold an entry, `queue list` is empty, and `dispatch` refuses with `queue.entry.unobserved` before any lane can start, blocking the first engine-driven pilot and any scheduling behaviour that depends on a populated queue.

## 4. GOALS

- **G-1**: Make a one-sided repository binding unproducible from the CLI composition path, symmetrically: when the key is unresolved or the root is unresolved, the binding is absent in its entirety.
- **G-2**: Make the production composition record an entry whose repository key and recorded root are both present, mutually consistent, in the normalized contention-domain key form, and rooted at the declaring checkout.
- **G-3**: Restore the observable outcome chain: `queue add` succeeds, `queue list` observes the entry, and `dispatch` no longer refuses with `queue.entry.unobserved` before spawn on the pilot path.
- **G-4**: Close the coverage gap that allowed the defect: regression tests at the composition level and at the domain level that fail on the pre-fix code and cover the unresolved branches from both sides (no root-only and no key-only record).
- **G-5**: Leave the domain invariant and every output/grammar contract untouched; the fix is in the producer, not in the rule.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Queue repository bindings emitted by the CLI composition with exactly one field present | 0 across the full resolution matrix (present; target-unresolved; key-unresolved; root-unresolved) |
| `queue add` outcomes in a production composition with a resolvable GitHub origin | 100% success (`added`/`noop`, exit 0); 0 `input.value.rejected` for the invariant |
| Recorded entries whose root differs from the declaring checkout's resolved root | 0 |
| Recorded entries whose key differs from `normalizeRepositoryKey` of the recorded root's normalized remote | 0 |
| Occurrences of the recorded root in envelopes, findings, incidents, logs, telemetry, or the derived graph | 0 |
| New regression tests that fail against the pre-fix code | ≥ 1 per layer, each red under the revert or mutation of the artifact it exercises: composition add and root-unresolved branch → revert the production derivation; fixture shape → revert the pilot fixture binding to its pre-fix one-field form; key-unresolved symmetry and domain negatives → targeted mutation that must turn them red |
| Regression tests added that pass only because they assert the ideal pair already supplied by a fixture | 0 (each added composition test must exercise the real binding derivation) |
| Changes to queue grammar, flags, envelope shapes, exit projections, error table | 0 |

### 4.2 Non-Goals

- **NG-1**: Relaxing, reshaping, or removing the key-and-root-together invariant in the queue application layer, including its read-side enforcement.
- **NG-2**: Changing queue CLI grammar, flags, argument handling, envelope shapes, exit projections, or human text.
- **NG-3**: Changing deploy-expectation resolution semantics (root discovery, key matching, collision handling) or wiring a deploy-expectation port into the production composition.
- **NG-4**: Changing dispatch semantics, dispatch identity rules, or the pre-spawn observation gate.
- **NG-5**: Cloud, additional providers, or non-GitHub remote support.
- **NG-6**: Introducing a new state record kind, schema version, error identity, or migration.
- **NG-7**: Redesigning repository-facts resolution, or adding a second checkout-resolution strategy.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Atomic repository binding at the composition boundary | A binding that cannot be one-sided removes the whole class of defect rather than the single failing branch. |
| F-2 | Checkout-root sourcing for the recorded root | The root is the declaring checkout's identity input; a nested working directory must not masquerade as the root. |
| F-3 | Normalized contention-domain key from the same resolution | The key is compared against normalized remotes and consumed by dispatch identity; the pair must be mutually consistent. |
| F-4 | Observable entry and unblocked dispatch | The user-visible outcome the ticket exists for: add succeeds, list observes, dispatch proceeds past the observation gate. |
| F-5 | Domain invariant preserved and honestly exercised | The rule is correct; the value of this change is that the rule stays and finally gets negative coverage. |
| F-6 | Regression coverage that fails pre-fix | Without a test that composes the real derivation, the defect returns the moment the composition changes. |

### 5.1 Capability Details

- **F-1 — Atomic binding.** The composition derives the queue repository binding in one place, with a total outcome of either "both fields" or "absent". The binding is present if and only if all three conditions hold: (a) the composition's existing GitHub target resolution from the origin succeeds — the `parseGitHubRemote`/`repositoryTargetOf` resolution already performed in the production composition; (b) `normalizeRepositoryKey(origin)` is defined; and (c) the resolved checkout root is defined. If any condition fails, the binding is absent entirely. The unresolved causes are therefore distinguishable: **target-unresolved** (a parseable non-GitHub remote such as `https://gitlab.com/owner/repo.git`, which the key normalizer would accept but the GitHub target gate refuses — the NG-5 boundary), **key-unresolved** (a genuinely non-normalizable remote value such as `not-a-url`, a two-segment relative path such as `./repo`, or no origin), and **root-unresolved** (target and key resolve, checkout root does not). A path is not a category of its own: `normalizeRepositoryKey` treats any value with at least three path segments as `host/owner/name`, so `../local/repo` normalizes to `../local/repo` and `/home/user/repo` to `home/user/repo`. A multi-segment local-path origin therefore produces no binding through the **target gate**, not through key normalization — it belongs to the target-unresolved cell of the matrix, and is in any case an origin form outside the supported GitHub-remote surface. The same reasoning makes the key guard redundant behind the target gate for parseable remotes: any remote the gate rejects is target-unresolved, so `key-unresolved` is never independently observable in a real composition and exists to specify the derivation's total outcome and to be exercised by the targeted asymmetry mutation. The two sides are symmetric: any unresolved cause yields no binding and neither yields a partial one. The derivation never inspects the fields independently at the call site, so a future edit cannot reintroduce an asymmetric guard. When the binding is absent, the add request carries no repository fields, the domain accepts it, and the entry is recorded without a repository identity — a valid, observable entry whose repository-dependent readiness is `unknown`, with evidence reason `addressing-unresolved` and blocking detail token `repository-binding-unresolved`. On a first add in a fresh ledger the entry carries neither field; because the domain inherits the previous pair for an existing ref, a later unbound add against an already-bound entry retains the previously recorded pair rather than clearing it. Absent is a declared degraded state, not a silent success and not an error. No new refusal, error code, or envelope field is introduced for any unresolved branch.
- **F-2 — Root sourcing.** The recorded root is the declaring checkout's resolved repository root, obtained from the same repository-facts resolution that produced the origin. It is absolute and working-directory independent: the same checkout yields the same root from the top level and from a nested subdirectory. For a linked worktree, the root is that worktree's checkout root. The raw working directory is never used, because a nested invocation would record a path that is not the checkout and that the deploy-expectation consumer would fail to match. The root must not be re-derived from a different source than the origin, so the pair can never describe two different checkouts.
- **F-3 — Normalized key and mutual consistency.** The recorded repository key is the normalized contention-domain key `host/owner/name` (fully lowercased, protocol/userinfo/`.git` removed), derived from the same origin resolution as the root. **`normalizeRepositoryKey` is the single authority** for the recorded `repository` value, and it is also the contract the deploy-expectation port's `normalizedRemote(root)` must apply. `normalizeRepositoryRemote` — the dispatch-identity normalizer — must **not** be used for the record: it lowercases the host only and preserves owner/name case, so `normalizeRepositoryRemote("https://github.com/Owner/Repo.git")` yields `github.com/Owner/Repo` while `normalizeRepositoryKey("https://github.com/Owner/Repo.git")` yields `github.com/owner/repo`. The key is not the bare `owner/name` target. Mutual consistency is required as: recorded key = `normalizeRepositoryKey(origin remote)` = `normalizeRepositoryKey` applied to the normalized remote of the recorded root, so the entry key and the root-derived remote compare by exact equality. The key is accepted as-is by the dispatch identity normalizer, so the scheduler-key precedence applies and resolves with source `scheduler` when no persisted identity marker governs. Remote forms that already normalize today (HTTPS with or without `.git`, SSH URL, scp-style, mixed case) all yield the same lowercase key; a remote that cannot be normalized yields no binding rather than a partial one. Classification is by shape, not by being a path: any value with at least three path segments normalizes — `../local/repo` → `../local/repo`, `/home/user/repo` → `home/user/repo` — while a shorter value such as `./repo` or `not-a-url` does not. Where a multi-segment local path does normalize, the GitHub target gate is what excludes it, so the exclusion is a target-gate outcome and not a key failure.
- **F-4 — Observable entry and unblocked dispatch.** In a production composition over a checkout with a resolvable GitHub origin, `queue add` succeeds and records an entry whose key and root are both present and consistent. `queue list` observes the entry; the machine-readable (JSON) projection carries the normalized key alone, the human rendering is unchanged (it never shows a repository key or the root), and no surface carries the root. `queue claim`/`queue plan` observe the entry, and `dispatch` proceeds past the pre-spawn observation gate: it no longer classifies `queue.entry.unobserved` for that ref. Any later dispatch outcome caused by unrelated preconditions (harness configuration, identity resolution, readiness) remains its own classified failure and is not claimed as fixed here.
- **F-5 — Invariant preserved.** The queue application layer continues to refuse an add request with exactly one of key/root present (`input.value.rejected`, summary naming the invariant), and continues to treat a one-sided entry record as a torn store on read. Both behaviours are unchanged; no code is added to the rule and no branch is softened. The change adds negative coverage for both shapes for the first time.
- **F-6 — Regression coverage.** Coverage is layered so the defect cannot survive at one layer while another stays green: a composition-level add test that exercises the real binding derivation and asserts both fields plus their consistency; composition-level tests for every unresolved cause (target-unresolved, key-unresolved, root-unresolved) asserting an absent binding and a successful unbound add; an invariant test asserting exactly one binding derivation site exists in the CLI composition; domain-level negative tests for key-only and root-only requests plus a one-sided record read; and a fixture-shape assertion that no fixture composes a one-sided binding. Every composition-level test that exercises the add or root path must fail against the pre-fix code — verified by reverting the producer change in place during review, not by inspection — while the key-unresolved guard and the domain-negative tests cover behaviour the pre-fix code already exhibits and are proven instead by a targeted mutation that must turn them red. The fixture-shape assertion is a separate layer: it parses fixture sources only, so a producer revert leaves it green and its evidence is instead the in-place revert of the pilot fixture binding to its pre-fix one-field form.

## 6. USER & SYSTEM FLOWS

```
Flow 1: Production queue add with a resolvable GitHub origin (the fixed path)
  Operator/agent runs: delivery-os queue add GH-<n>
    → composition resolves repository facts once for the working directory
        facts.root        = declaring checkout root (absolute, worktree-aware)
        facts.originUrl   = origin remote
    → target             = owner/name parsed from the same origin
                           (parseGitHubRemote via repositoryTargetOf)
    → binding derivation:
        key   = normalizeRepositoryKey(facts.originUrl) → host/owner/name (lowercased)
        root  = facts.root
        target, key, and root all resolved?
              yes → binding = { repository: key, repositoryRoot: root }
              no  → binding absent (no partial pair; cause is target-unresolved,
                    key-unresolved, or root-unresolved)
    → queue edge forwards the pair into the add request
    → domain accepts: both present and consistent
    → envelope: result=added (or noop on replay), exit 0
    → queue list observes the entry; the JSON projection carries the normalized key,
      the human rendering is unchanged, and the root appears nowhere
    → queue claim / queue plan observe the entry
    → dispatch GH-<n> proceeds past the observation gate (no queue.entry.unobserved)

Flow 2: Key axis unresolved (target-unresolved or key-unresolved)
  note: a deeper local path (../local/repo, /home/user/repo) does define a key,
        so such an origin resolves no GitHub target and is target-unresolved,
        never key-unresolved
  queue add GH-<n>
    → facts.root may resolve, but either the GitHub target does not resolve
      (a parseable non-GitHub remote, e.g. https://gitlab.com/owner/repo.git)
      or normalizeRepositoryKey(origin) is undefined
      (not-a-url, a two-segment relative path such as ./repo, or no origin)
      → key undefined
    → binding absent entirely (root is NOT sent alone)
    → add succeeds, entry recorded with no repository fields
      (first add in a fresh ledger)
    → list observes the entry; readiness is unknown, with evidence reason
      addressing-unresolved and blocking detail repository-binding-unresolved
    → dispatch may later refuse on readiness or identity grounds,
      never on a one-sided record and never with a different error shape

Flow 3: Root unresolved (target and key resolve, no checkout)
  queue add GH-<n>
    → origin may be supplied (injected/host-provided) but facts.root is undefined
      → binding absent entirely (key is NOT sent alone)
    → add succeeds with no repository fields; same degraded readiness as Flow 2
      (unknown; evidence reason addressing-unresolved; blocking detail
      repository-binding-unresolved)

Flow 4: Pre-fix repro (must not be reproducible after the fix)
  queue add GH-<n>  → result=refused, input.value.rejected,
                      "repository key and recorded root must be present together"
  queue list        → entries=0
  dispatch GH-<n>   → queue.entry.unobserved

Flow 5: Negative contract (unchanged, now covered)
  a direct add request with key only or root only
    → input.value.rejected naming the invariant
  an entry record with exactly one field present on disk
    → the queue read fails closed as a torn store
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The production composition's queue repository binding: a single total derivation that produces either both fields or an absent binding.
- Sourcing the recorded root from the resolved declaring checkout root (absolute, nested-cwd-safe, worktree-aware) rather than the raw working directory.
- Emitting the normalized contention-domain repository key (`host/owner/name`) from the same origin resolution as the root, so key and root are mutually consistent.
- The production composition's repository-facts seam behaviour: an injected origin replaces only the remote; the root is always resolved from the working directory, so composition tests exercise the real root path instead of a synthetic substitute.
- Regression coverage: composition-level add and every unresolved-cause guard (target-unresolved, key-unresolved, root-unresolved), the single-derivation structural assertion, domain-level negative tests for both one-sided request shapes and the read-side torn-store case, and a fixture-shape assertion.
- Correcting the pilot fixture's key-only composition binding to the pair, using the same key its ledger seeds already use, so the fixture models the composition honestly.
- Reconciliation of the affected system specs (scheduling engine, CLI entrypoint) during the documentation phase; the scheduling-engine spec already states the intended contract, so this is expected to be a consistency pass.

### 7.2 Out of Scope

- [OUT] Relaxing, bypassing, or redesigning the key-and-root-together invariant in the queue application layer, or its read-side enforcement.
- [OUT] Queue CLI grammar, flags, arguments, envelope shapes, exit projections, or human renderings.
- [OUT] Deploy-expectation resolution semantics, root-discovery rules, collision handling, or wiring a deploy-expectation port into the production composition.
- [OUT] Dispatch semantics, dispatch identity rules, or the pre-spawn observation gate.
- [OUT] Making an unbound entry ready: an entry without a repository identity keeps the existing degraded readiness — `unknown`, with evidence reason `addressing-unresolved` and blocking detail `repository-binding-unresolved`.
- [OUT] New exports from the production composition module: `packages/cli/src/production.ts` keeps exactly its current export (`createProductionComposer`), because `tests/structure/content-inventory.test.ts` pins that export list; the binding derivation stays module-private.
- [OUT] Non-GitHub providers, monorepo multi-repository support, or a second checkout-resolution strategy.
- [OUT] New state record kinds, schema versions, error identities, telemetry events, flags, or configuration keys.
- [OUT] Migrating, rewriting, or reconciling previously recorded queue state (see §19).
- [OUT] Normalizing the pilot fixture's synthetic repository key domain or reconciling its goldens (deferred; see §7.3).
- [OUT] Changing how any other command obtains its repository identity (commit, merge, status, brief, closeout, verify).

### 7.3 Deferred / Maybe-Later

- Normalizing the pilot fixture's synthetic key domain (and any golden churn it implies). This is required before the pilot exercise calls `queue add`, because the composition would then record a normalized key while the fixture's seeds use the synthetic one, splitting one contention domain into two. The pilot does not call `queue add` today.
- Wiring the deploy-expectation port into the production composition, which is when the recorded root acquires its documented live consumer.
- A shared producer-side derivation used by every composition that records a repository identity, so the atomic-pair rule has one home beyond the queue composition.
- A composition-level property test over the full repository-facts matrix (no origin, non-GitHub remote, unnormalizable remote, missing git directory, nested directory, linked worktree) once a second producer exists.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

None. The interface surface is the CLI and the composition seam; no route, verb, or payload changes.

| Invocation | Observable contract change |
|---|---|
| `queue add <ref> [--priority <n>] [--dep <ref>]` | Unchanged grammar, flags, envelope shape, and exit projections. Outcome in a production composition with a resolvable GitHub origin changes from a guaranteed `input.value.rejected` refusal to `added`/`noop` with an entry recorded. |
| `queue list` | Unchanged shape; the previously impossible entry now appears. The normalized key is carried in the JSON projection, the human rendering is unchanged, and the root appears nowhere in output. |
| `queue plan`, `queue claim`, `queue release`, `lanes *` | Unchanged shape; these surfaces now observe entries produced by the composition. |
| `dispatch <ref>` | Unchanged grammar and shape; the pre-spawn observation gate stops refusing with `queue.entry.unobserved` for a ref added by the fixed composition. Other dispatch failures are out of scope. |
| Production composition seam | The queue repository binding is present only when the GitHub target resolves, `normalizeRepositoryKey(origin)` is defined, and the resolved checkout root is defined; otherwise it is absent entirely. Injected repository facts continue to supply the origin only; the checkout root is always resolved from the working directory. No new export is added to the production composition module. |

### 8.2 Events / Messages

None. No event, message, queue record family, or telemetry event is added, removed, or reshaped. The recorded root remains internal state and is never copied into any event, envelope, finding, incident, or log line.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Queue entry `repository` (existing field) | Producer obligation clarified: when an entry is recorded by the CLI composition, this field carries the normalized contention-domain key `host/owner/name` produced by `normalizeRepositoryKey`, derived from the same origin resolution as the root. Optional; absent together with `repositoryRoot`. Payload schema unchanged. |
| DM-2 | Queue entry `repositoryRoot` (existing field) | Present only together with `repository`. Value is the declaring checkout's absolute resolved root, used only for producer deploy-expectation discovery. Optional; payload schema unchanged. |
| DM-3 | Repository binding derivation outcome | The composition-level value is a pair `{repository, repositoryRoot}` when the GitHub target resolves, `normalizeRepositoryKey(origin)` is defined, and the resolved root is defined; otherwise absent. No third state exists. |

No schema version, record kind, key prefix, fold rule, or validation predicate changes. The existing predicates already express DM-1–DM-3 correctly; the change makes the producer conform.

### 8.4 External Integrations

| Integration | Change |
|---|---|
| Local git metadata (origin remote, HEAD, git directory/worktree layout) | Read-only inspection, unchanged mechanism and volume; the checkout root comes from the existing facts resolution. No new process spawn and no network access. |
| GitHub remote identity (`host/owner/name` normalization) | `normalizeRepositoryKey` is the single authority for the recorded key and for the deploy-expectation port's `normalizedRemote(root)`. The dispatch-identity `normalizeRepositoryRemote` is not used for the record: it lowercases the host only and preserves owner/name case (probe: `normalizeRepositoryRemote("https://github.com/Owner/Repo.git")` → `github.com/Owner/Repo`, while `normalizeRepositoryKey` → `github.com/owner/repo`). No new parsing rules and no provider expansion; a parseable non-GitHub remote yields no binding through the existing target gate. |
| GitHub API, tracker, CI | Untouched; not called by the add path. |

### 8.5 Backward Compatibility

- **Command surface**: no grammar, flag, envelope, exit-code, or human-text change; every unchanged surface stays byte-identical.
- **Record contract**: no schema change and no new field. Entries recorded by the composition now include both fields; entries recorded without a repository identity remain valid and readable.
- **Existing consumer semantics**: deploy-expectation root discovery, queue readiness, lease identity, and dispatch identity precedence are unchanged; they now consume correct input.
- **Existing state**: no entry recorded through the shipped composition can carry a single field, because the domain has always refused it. No compatibility window and no dual-read path is required.
- **Tests and fixtures**: fixture and assertion updates accompany the producer change; no public behaviour is deprecated.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Binding totality: for every binding-resolution cell (present; target-unresolved; key-unresolved; root-unresolved), the composition emits either both fields or no binding | 0 one-sided bindings across the full four-cell matrix; asserted per cell |
| NFR-2 | Root non-disclosure: the recorded root never appears in any envelope, finding, incident, log line, telemetry event, or derived-graph document | 0 occurrences across `queue add/list/plan/claim/release`, `lanes`, `status`, `brief`, and `dispatch` JSON and text output |
| NFR-3 | Interface stability: no command grammar, envelope shape, key order, exit projection, or error-identity change | 0 diffs outside the entry now being recorded; 0 new or removed error rows |
| NFR-4 | Coverage strength: each coverage layer is proven by reverting or mutating the artifact that layer actually exercises, not by one producer revert applied to every layer | Per layer, the artifact that must be reverted or mutated is named: composition add and root-unresolved cell → revert the production derivation; key-unresolved cell → asymmetry mutation in the production derivation; fixture shape → revert the pilot fixture binding to its pre-fix one-field form (reverting the production derivation cannot red the shape suite, which parses only `tests/fixtures/**`); domain negatives → predicate mutation, write-side then read-side. Each revert or mutation reds its named layer and is restored; 0 tests that only assert a fixture-supplied pair |
| NFR-5 | Purity and boundedness: the add path performs no process spawn and no network call, and resolves repository facts once per invocation | 0 spawns and 0 outbound calls observed at runtime; exactly 1 facts resolution per invocation asserted structurally (AC-F1-4), since an additional resolution is not observable from outside the composition |
| NFR-6 | Binding determinism: the same checkout (same key and root) yields the same binding under identical facts and arguments | Identical `repository` and `repositoryRoot` strings across independent resolutions and across replay; byte-identical replay of wall-clock-derived envelope fields is out of scope for this change |
| NFR-7 | Path correctness: the recorded root is absolute and identical from the checkout top level and from a nested subdirectory; a linked worktree records its own checkout root | Same root string across nested and top-level invocations (2 of 2); worktree root ≠ parent checkout root and is a valid checkout root |
| NFR-8 | Latency: the fix adds no measurable work to `queue add` beyond deriving a value from facts already read | 0 additional git reads or spawns; the add path stays within its existing suite time budget, with wall-clock duration recorded as informational |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- **No new telemetry.** No event, metric, span, or diagnostic stream is added. The queue entry record is the evidence surface: it carries the normalized key and the root, and the root stays internal.
- **Existing diagnostics preserved.** A one-sided add request still reports `input.value.rejected` with the invariant summary; a one-sided record still fails the read as a torn store. Neither message text changes.
- **Failure diagnosis improves indirectly.** `queue list` showing an entry and `dispatch` no longer returning `queue.entry.unobserved` are the observable proof of the fix; no new diagnostic is introduced to narrate the binding derivation.
- **No secret or path disclosure.** Because the root is an absolute local path, the non-disclosure requirement (NFR-2) is the observability guard: the derivation must not log the root even at verbose levels.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | The root is added but the key stays host-less, converting a hard refusal into a quiet identity mismatch at the deploy-expectation and dispatch-identity consumers | H | M | F-3 makes the normalized key part of the same derivation and names `normalizeRepositoryKey` as its single authority; AC-F3-1/AC-F3-2 assert key form and scheduler-source resolution; the queue fixtures and dispatch fixtures already use the normalized form as the reference | A consumer outside those covered identities could still assume a different form; search for additional compare sites during review |
| RSK-2 | The root is taken from the raw working directory, so a nested invocation records a non-checkout path | H | M | F-2 requires the resolved checkout root; AC-F2-1/AC-F2-2 assert nested and worktree cases | A future refactor that swaps the facts source could reintroduce cwd; the nested test is the guard |
| RSK-3 | The guard is implemented asymmetrically (for example only when the key is missing), leaving a root-only branch | M | L | F-1 requires one total derivation; NFR-1 requires all four matrix cells asserted | A new composition could construct a binding directly; the single-derivation structural assertion covers the CLI composition only |
| RSK-4 | False green: the composition test injects facts, so the root path never executes and the test passes while production stays broken | H | M | The injected origin replaces only the remote and the root is always resolved from the working directory; composition tests use a real checkout directory; NFR-4 requires an in-place revert check | A harness could still stub the resolution; review verifies the test names the real path |
| RSK-5 | Fixing the symptom by softening the domain invariant | H | L | NG-1 and F-5 forbid it; AC-F5-1/AC-F5-2 assert both negative shapes; reviewers compare the invariant predicates as unchanged | None material; the domain change would be visible as a diff |
| RSK-6 | The absolute root leaks into output, logs, or the derived graph | M | L | NFR-2's zero-occurrence assertion over every read surface; existing serialization contract already excludes the root | A new read surface could forget the rule; the assertion list is the guard |
| RSK-7 | Fixture correction churns unrelated pilot expectations | M | L | Scope limited to correcting the one-sided binding with the key its seeds already use; pilot key normalization explicitly deferred; golden churn is not accepted as a side effect | If the pilot later adds `queue add`, the deferred key normalization becomes mandatory before that test lands |
| RSK-8 | The fix is verified only by the new tests and not by the reported repro | M | L | The test plan includes the ticket's repro sequence (add → list → dispatch) through the production composition, and asserts the pre-fix failure is gone | A different remote form on the operator's machine could still fail normalization; that path degrades to an absent binding and is covered |

## 12. ASSUMPTIONS

- The normalized contention-domain repository key is `host/owner/name` (fully lowercased), as produced by `normalizeRepositoryKey` and as used by the queue and dispatch fixtures that record a repository identity; the pilot fixture's synthetic host-less key domain is a fixture-local exception, not a producer contract.
- The production composition already resolves a GitHub owner/name target from the origin (`parseGitHubRemote` via `repositoryTargetOf`), and the binding is gated on that resolution, which is why a parseable non-GitHub remote yields no binding (the NG-5 boundary).
- The resolved repository facts expose the checkout root, absolute when the working directory is absolute, and the production working directory is absolute.
- The composition resolves repository facts once per invocation and has the origin and target available when the queue composition is built.
- The production composition does not wire a deploy-expectation port today, so the root's only current role is contract-complete record state; this does not weaken the requirement, because the record contract is validated at the ledger boundary and becomes live when that port is wired.
- An entry without a repository identity is a valid state: it is observable and its repository-dependent readiness is `unknown`, reported with evidence reason `addressing-unresolved` and blocking detail `repository-binding-unresolved`, which blocks readiness under the existing rule. This is an accepted degraded outcome for unresolved checkouts, not a regression.
- No entry recorded through the shipped composition can carry a single field, because the domain has always refused such requests; therefore no repair of existing state is needed.
- The queue CLI fixture's default pair and the dispatch fixtures' seeds already satisfy the record contract and need no change beyond the shape assertion.
- Regression tests can create a real checkout directory with a minimal git directory/config in a temporary location, as the existing composition suites already do.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Scheduling engine and queue entry contract (GH-237) | Entry fields, key-and-root invariant, readiness conditions, leases, derived graph |
| Depends on | Queue edge composition seam | The optional pair type and the pass-through forwarding the fix relies on |
| Depends on | Production composition edge | The single construction site of the queue repository binding, and the facts/target it already resolves |
| Depends on | Repository facts adapter | Checkout root discovery, origin parsing, worktree handling |
| Depends on | Dispatch identity resolution | Normalized key acceptance and scheduler-key precedence (consumer of DM-1) |
| Depends on | Dispatch command runtime | Pre-spawn observation gate whose refusal the ticket reports |
| Depends on | Queue and pilot fixtures | The coverage gap and the second one-sided producer |
| Blocks | M1-S9 engine-driven pilot | The first pilot needs an observable queue entry to dispatch |
| Blocks (soft) | Any deploy-expectation verification through the production composition | The recorded root must be correct before that consumer is wired |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Is the host-less key a second defect in scope, or should the fix ship the missing root only? | Verification shows every other producer and consumer uses `host/owner/name`; adding a root without normalizing the key would satisfy the invariant but leave identity consumers comparing mismatched forms. **Recommendation:** in scope (DEC-3) — the pair must be mutually consistent, and "both present" alone is not the documented contract. The ticket's **Expected** section already requires "both the normalized repository key and its recorded root", so this is ticket-required and previously unimplemented, not a scope expansion. | Resolved — pm-notes decision D1 ratifies DEC-3 |
| OQ-2 | Should previously recorded entries with a synthetic (host-less) key be migrated or re-recorded? | The pilot fixture seeds host-less keys directly into the ledger. Those are fixture inputs, not composition output. No shipped composition ever recorded an entry at all, and a one-sided record was impossible, so there is no production state to repair. **Recommendation:** no migration; align the pilot's key domain if and when it exercises `queue add` (deferred in §7.3). | Resolved — pm-notes decision D2 ratifies DEC-8; no migration, pilot key alignment deferred |
| OQ-3 | Should the read-side one-sided-record behaviour be a torn store or a typed entry-rejection identity? | Today a one-sided record fails the queue read closed as a torn store. That is the correct fail-closed behaviour and is preserved unchanged. A dedicated identity would be friendlier but introduces an error-table row, which NG-6 forbids. **Recommendation:** keep the torn-store classification; the condition is a corrupted ledger, not a user input error. | Resolved in-spec: keep torn-store classification (DEC-6); revisit only if a real corrupt-ledger operator workflow emerges |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Fix the producer, not the domain invariant. | The invariant is correct and protects every reader; relaxing it would allow records that consumers cannot use. Producer conformance is the minimal, lowest-risk repair. | 2026-11-08 |
| DEC-2 | The recorded root is the resolved checkout root, never the raw working directory. | A nested invocation would record a path that is not a checkout; the deploy-expectation consumer matches roots against remotes, so a nested path would resolve `root-unresolved`. The resolved root is also worktree-correct. | 2026-11-08 |
| DEC-3 | The recorded key is the normalized `host/owner/name` contention key produced by `normalizeRepositoryKey`, derived from the same origin as the root, not the bare `owner/name` target and not the output of `normalizeRepositoryRemote`. | All other producers, all queue/dispatch fixtures, dispatch identity acceptance, and the deploy-expectation comparison use the normalized form. `normalizeRepositoryKey` is the single authority because it lowercases every segment; `normalizeRepositoryRemote` lowercases the host only and preserves owner/name case, so it cannot satisfy the lowercase key contract. The pair must be mutually consistent (key equals `normalizeRepositoryKey` of the root's normalized remote) or the record is complete but unusable. | 2026-11-08 |
| DEC-4 | The binding is produced by one total derivation with a two-field-or-absent outcome; no new refusal, error code, or envelope field is introduced for either unresolved branch. | Symmetry removes the defect class; adding a refusal would turn a degraded-but-valid state into a new failure mode and would require an error-table change that is out of scope. | 2026-11-08 |
| DEC-5 | An injected origin replaces only the remote; the root is always resolved from the working directory. `ProductionCompositionFacts.repositoryFacts` keeps its current exported type shape — `{ originUrl?: string }` — and only its semantics change (origin overlay; root always resolved from the working directory). No exported type change and no new export; this seam is internal/test-facing. | Otherwise composition tests would never execute the root path and would pass while production stayed broken (the exact false-green shape that hid this defect). Keeping the seam shape also avoids widening a public composition type for a test convenience. | 2026-11-08 |
| DEC-6 | Preserve the read-side classification of a one-sided record as a torn store; add no identity. | A one-sided record is ledger corruption, not user input; fail-closed is already the documented behaviour and a new row is out of scope. | 2026-11-08 |
| DEC-7 | Correct the pilot fixture's key-only composition binding to the pair, using the key its ledger seeds already use; the pilot's synthetic key domain stays as is. | The fixture models the production composition and must not compose a shape production can no longer produce. Its key domain is fixture-synthetic and only needs normalization if the pilot starts calling `queue add` (deferred in §7.3). | 2026-11-08 |
| DEC-8 | No state migration and no dual-read path. | No shipped composition could ever record an entry, and a one-sided record was always refused, so there is no affected production state. | 2026-11-08 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Production composition edge | Updated — one total repository-binding derivation gated on GitHub target resolution, `normalizeRepositoryKey`, and the resolved checkout root; injected origin no longer suppresses the checkout root. The module keeps exactly its current export (`createProductionComposer`); the derivation stays private. |
| Queue composition seam (edge) | Unchanged — optional pair type and pass-through forwarding preserved |
| Queue application layer (entry validation and add) | Unchanged — invariant and read-side enforcement preserved; behaviour exercised by new negative tests |
| Repository facts adapter | Unchanged — reused as the single source of checkout root and origin |
| Queue readiness | Unchanged — an unbound entry keeps the `unknown` condition with evidence reason `addressing-unresolved` and blocking detail `repository-binding-unresolved` |
| Dispatch identity resolution | Unchanged — now receives a normalized scheduler key from recorded entries |
| Queue CLI behaviour fixtures | Extended — an explicit unbound composition case and a shape assertion |
| Pilot fixture | Updated — the composition binding becomes a pair with the key its seeds use |
| Queue composition/behaviour tests | New/extended — composition add, every unresolved-cause guard, single-derivation structural assertion, domain negative suite |
| System spec: scheduling engine | Reconciled — already states the key-and-root-together and normalized-key contract; consistency pass expected |
| System spec: CLI entrypoint | Reconciled — describes the production composer's wiring; binding derivation note expected |

## 17. ACCEPTANCE CRITERIA

**Verification method.** Each acceptance criterion is verified by exactly one of three evidence classes: a permanent suite assertion, a revert-or-mutation-verified guard (the assertion must turn red under the in-place revert or targeted mutation named in the criterion), or a review-verified diff (the evidence is the diff inspection recorded in the change review). Paths whose behaviour the fix changes use the permanent suite plus the in-place revert of the artifact that carries the behaviour — the production derivation, or the pilot fixture binding for the shape suite; guards over behaviour the pre-fix code already exhibits use mutation verification; contract-stability claims use the review-verified diff plus the existing pinned tests.

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** a production composition over a checkout with a resolvable GitHub origin, **when** `queue add GH-<n>` runs, **then** the result is `added` (or `noop` on replay) at exit 0 and the recorded entry carries both `repository` and `repositoryRoot`. | F-1, F-4, DM-3, G-2 |
| AC-F1-2 | **Given** a first add in a fresh ledger where the key axis cannot be resolved while a checkout root exists — either the origin is a parseable non-GitHub remote such as `https://gitlab.com/owner/repo.git` (target-unresolved, so the GitHub target gate does not resolve) or the remote does not normalize at all such as `not-a-url` or a two-segment relative path such as `./repo` (key-unresolved; a deeper local path such as `/home/user/repo` normalizes to `home/user/repo` and is therefore target-unresolved, not a key-unresolved fixture) — **when** `queue add` runs, **then** no binding is emitted (no root-only record exists), the add succeeds, and the entry carries neither repository field. | F-1, DM-3, NFR-1, G-1 |
| AC-F1-3 | **Given** a first add in a fresh ledger where the GitHub target and `normalizeRepositoryKey(origin)` resolve while the checkout root cannot be resolved (root-unresolved), **when** `queue add` runs, **then** no binding is emitted (no key-only record exists), the add succeeds, and the entry carries neither repository field. | F-1, DM-3, NFR-1, G-1 |
| AC-F1-4 | **Given** the CLI composition source, **when** the structural assertion runs, **then** exactly one queue repository-binding derivation site exists, it produces the pair-or-absent outcome, and no other site constructs a queue composition with a binding literal. | F-1, F-6, NFR-4 |
| AC-F2-1 | **Given** a checkout whose working directory is a nested subdirectory, **when** `queue add` runs through the production composition, **then** the recorded root equals the checkout root and not the nested directory. | F-2, NFR-7, RSK-2 |
| AC-F2-2 | **Given** a linked worktree of a repository, **when** `queue add` runs from the worktree, **then** the recorded root equals that worktree's checkout root; **and given** the same checkout invoked from its top level and from a nested directory, **then** the recorded root is the same absolute path in both invocations. | F-2, NFR-7 |
| AC-F2-3 | **Given** any recorded entry produced under AC-F1-1, **when** the root is inspected, **then** it is an absolute path and the add invocation performs no process spawn and makes no network call; the "no additional repository-facts resolution" half is carried by the structural single-resolution assertion (AC-F1-4) in place of an unobservable runtime counter. | F-2, NFR-5, NFR-6 |
| AC-F3-1 | **Given** a resolvable origin expressed as HTTPS with and without `.git`, as an SSH URL, as scp-style, and in mixed case, **when** `queue add` runs for each form, **then** every recorded key is the same lowercase `host/owner/name` value produced by `normalizeRepositoryKey` (not `normalizeRepositoryRemote`, which preserves owner/name case) and every pair is mutually consistent (the key equals `normalizeRepositoryKey` of the recorded root's normalized remote). | F-3, DM-1, RSK-1 |
| AC-F3-2 | **Given** a recorded entry with no persisted dispatch identity marker, **when** dispatch identity resolution is exercised directly at the resolver level with that entry's scheduler key against a disagreeing remote-derived identity, **then** it resolves the identity from the scheduler key with source `scheduler`, taking precedence over the remote-derived identity. The `source` field is not projected on the dispatch surface, so the end-to-end `dispatch` assertion covers only proceeding past the observation gate (AC-F4-2). | F-3, DM-1, RSK-1 |
| AC-F4-1 | **Given** an entry added through the production composition, **when** `queue list` runs, **then** the entry is observed, the JSON projection carries its normalized repository key, the human rendering is unchanged (no repository key and no root), and the root appears nowhere in the JSON or text output; **and when** the `status` and `brief` renderings are produced over the same state, **then** the root appears nowhere in their output either (absence only; their exit codes are not asserted because those surfaces are credential-degraded in a hermetic harness). | F-4, NFR-2, NFR-3 |
| AC-F4-2 | **Given** an entry added through the production composition, **when** `queue claim` or `queue plan` observes the ref and `dispatch <ref>` runs, **then** the entry is observed and `dispatch` does not refuse with `queue.entry.unobserved`; any other classified outcome is unrelated and out of scope. | F-4, G-3 |
| AC-F5-1 | **Given** an add request carrying the key only, **when** it reaches the queue application layer, **then** it is refused with `input.value.rejected` and a summary naming the key-and-root invariant; **and given** a request carrying the root only, **then** the same refusal occurs. | F-5, RSK-5 |
| AC-F5-2 | **Given** an entry record stored with exactly one of the two fields, **when** the queue is read, **then** the read fails closed as a torn store and no entry is fabricated or silently dropped. | F-5, DEC-6 |
| AC-F5-3 | **Given** the change lands, **when** the error table and the invariant predicates are inspected, **then** no error row is added or retired, the queue domain keeps exactly its pre-change error identities, and the invariant keeps both branches unchanged (no condition softened or removed). Evidence is the existing pinned error-set test plus a diff-level inspection recorded in the change review (unchanged error table, unchanged invariant predicates); no new permanent test asserts a diff against a moving base. | F-5, NG-1, NG-6 |
| AC-F6-1 | **Given** the new composition-level regression tests, **when** the producer fix is reverted in place, **then** the composition add test and the root-unresolved guard test fail; **and when** the fix is restored, **then** they pass. The revert set of this criterion is the production derivation only; the fixture-shape and domain-negative layers carry their own evidence in AC-F6-3 and AC-F6-2. The key-unresolved guard already emits no binding before the fix, so it is a symmetry guard rather than a revert-detecting test: its detection is demonstrated by an in-place asymmetry mutation that bypasses only the `normalizeRepositoryKey` guard (forwarding the root when the key is undefined) while leaving the GitHub target gate intact. The mutated derivation emits a root-only binding, which the queue domain refuses with `input.value.rejected` and the summary naming the key-and-root-together invariant; the cell reds because it expected a successful unbound add with neither field and instead observes that refusal. The mutation must red exactly the key-unresolved cell and leave the target-unresolved and root-unresolved cells green, then be restored. | F-6, NFR-4 |
| AC-F6-2 | **Given** the new domain-level regression tests, **when** they run, **then** both one-sided request shapes and the one-sided record read are covered by explicit assertions. These tests cover behaviour the fix leaves unchanged, so they cannot fail on a producer revert; their adequacy is proven instead by predicate mutation (soften or delete the write-side mutual-presence branch, then the read-side branch, observe the corresponding negative test fail, restore). | F-6, F-5 |
| AC-F6-3 | **Given** every fixture that composes a queue repository binding, **when** the fixture-shape assertion runs, **then** each supplies both fields or none, and the pilot fixture's binding carries the same key as its ledger seeds; **and when** the pilot fixture binding is reverted to its pre-fix one-field form, **then** the shape suite reds on that fixture and a producer revert alone would leave it green. This is the layer's evidence: the suite parses only fixture sources, so its red must come from the fixture. | F-6, DEC-7, G-4, NFR-4 |
| AC-F6-4 | **Given** the ticket's repro sequence (add → list → dispatch) executed through the production composition, **when** it runs after the fix, **then** add succeeds, list observes the entry, and dispatch no longer returns `queue.entry.unobserved`; the pre-fix expectations are encoded in the test as an explicit failure triple — refusal on add, zero entries on list, `queue.entry.unobserved` on dispatch — rather than requiring the test to run against reverted code. | F-6, F-4, G-3 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- **Delivery unit**: one change, one PR, one reviewable unit. The producer change, the fixture correction, and the regression coverage land together; splitting them would leave a window in which the suite is green and production is broken.
- **Order within the change**: negative and shape coverage first (so the pre-fix failure is recorded), then the producer derivation, then the fixture correction, then documentation reconciliation.
- **No feature flag** is needed: the change makes an impossible path possible and cannot affect a working path.
- **Verification**: the ticket's repro is the manual gate; the regression suite is the mechanical gate; every new composition test that exercises the add or root path must be shown to fail against the reverted producer in the same review. The fixture-shape suite is shown instead by reverting the pilot fixture binding to its pre-fix one-field form, since a producer revert leaves that suite green. The key-unresolved symmetry guard — whose asymmetry mutation makes the derivation emit a root-only binding that the queue domain refuses with `input.value.rejected` and the invariant summary, reddening exactly that cell — and the domain-negative tests are shown by the targeted mutation named in their acceptance criterion.
- **Rollback**: reverting the producer derivation restores the previous (broken) behaviour, since the domain, schema, and outputs are unchanged. No state or data rollback is required.
- **Communication**: the fix restores a documented behaviour; operators who saw the refusal need no migration, but the release note should state that `queue add` now records a repository identity and that an unresolved checkout records an entry without one.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A — no migration.

- No entry recorded through the shipped composition can carry a single field, because the domain has refused such requests since delivery; therefore no record needs repair.
- Entries recorded without any repository identity remain valid and readable under the unchanged schema.
- Fixture-seeded entries with a synthetic key domain are test inputs, not production state; they are not migrated. Aligning the pilot's key domain is deferred until the pilot exercises `queue add` (§7.3).
- No seeding, backfill, rewrite, dual-read, or reconciliation command is introduced.

## 20. PRIVACY / COMPLIANCE REVIEW

- **Personal data**: none. The recorded root is an absolute local filesystem path, not personal data, but it is machine-identifying state.
- **Path disclosure**: the root is internal state and must not be serialized into envelopes, findings, incidents, logs, telemetry, or the derived graph (NFR-2). This preserves the existing privacy stance that local absolute paths do not leak into shared artifacts.
- **Remote identity**: the repository key is derived from the origin remote with credentials, userinfo, and protocol stripped, as today; no new surface exposes the remote.
- **Compliance**: no change to retention, audit, or consent obligations; the ledger payload shape is unchanged.

## 21. SECURITY REVIEW HIGHLIGHTS

- **No new trust boundary**: the composition derives one value from facts it already reads; no new input is accepted from a user or a remote.
- **Fail-closed preserved**: a one-sided request is still refused and a one-sided record still fails the read. The fix does not create a path that writes a partial record.
- **Injection safety**: the key and root are data values placed into a validated payload; no shell, path, or command interpolation is added, and the add path performs no spawn.
- **Path handling**: an absolute root from git metadata is not user-supplied, but it is still treated as internal data and never rendered; no path traversal decision is made from it by this change.
- **Error surface**: no new error identity means no new classification surface that could disclose internal state through a summary.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **Ongoing cost**: none. No new configuration key, flag, state record, or operational procedure.
- **Diagnosability**: an empty queue with a resolvable origin is no longer a silent dead end; the recorded pair is inspectable in the ledger by an operator debugging identity issues.
- **Consumer readiness**: the recorded root is inert until the deploy-expectation port is wired into the production composition; when it is, the path already carries correct data.
- **Test maintenance**: the new shape assertion keeps future compositions honest; the single-derivation assertion means a future producer must route through the same derivation or update the assertion deliberately.
- **Documentation**: two system-spec pages need a consistency pass; no guide, help page, or prompt change is expected because no user-facing grammar changes.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Repository key | The normalized contention-domain repository identity `host/owner/name`, fully lowercased, with protocol, credentials, userinfo, and `.git` removed; produced by `normalizeRepositoryKey`. |
| Dispatch remote normalization | `normalizeRepositoryRemote` lowercases only the host and preserves owner/name case; it is the dispatch-identity normalizer, not the contention-key authority, and must not produce the recorded `repository` value. |
| Recorded root | The declaring checkout's absolute repository root, stored in the queue entry as internal state for producer deploy-expectation discovery. |
| Declaring checkout | The checkout from which the queue mutation was issued; its facts supply both the key and the root. |
| One-sided binding | A repository binding carrying exactly one of the key and the root. Refused on write and treated as a torn record on read. |
| Unbound entry | An entry recorded without a repository key or root because the checkout could not be resolved; observable, with unknown repository-dependent readiness. |
| Binding derivation | The single composition step that produces the key-and-root pair or nothing. |
| Observation gate | The pre-spawn check that a queue entry exists for a ref; its failure classification is `queue.entry.unobserved`. |
| Torn store | The fail-closed state read classification for a record that violates its payload contract. |
| False green | A test that passes because it supplies an ideal input instead of exercising the code path under test. |

## 24. APPENDICES

### Appendix A — Binding resolution matrix

The binding is present if and only if all three conditions hold: (a) the composition's existing GitHub target resolution from the origin succeeds (`parseGitHubRemote` via `repositoryTargetOf`, already performed in the production composition); (b) `normalizeRepositoryKey(origin)` is defined; and (c) the resolved checkout root is defined. Any failure yields an absent binding — never a partial one. Cells are labelled by the cause of absence:

| Cell | Key / target resolution | Root resolution | Binding emitted | Entry fields | Readiness |
|---|---|---|---|---|---|
| Present | GitHub target resolves; `normalizeRepositoryKey(origin)` defined | Resolved (checkout found) | `{repository, repositoryRoot}` | Both, consistent | Repository-dependent conditions evaluable |
| Target-unresolved | GitHub target does not resolve (parseable non-GitHub remote, e.g. `https://gitlab.com/owner/repo.git`) | Resolved | Absent | Neither (first add in a fresh ledger) | `unknown`; evidence reason `addressing-unresolved`; blocking detail `repository-binding-unresolved` |
| Key-unresolved | `normalizeRepositoryKey(origin)` undefined (e.g. `not-a-url`, a two-segment relative path such as `./repo`, or no origin) | Resolved | Absent | Neither (first add in a fresh ledger) | `unknown`; evidence reason `addressing-unresolved`; blocking detail `repository-binding-unresolved` |
| Root-unresolved | GitHub target and `normalizeRepositoryKey(origin)` resolve | Unresolved (no checkout) | Absent | Neither (first add in a fresh ledger) | `unknown`; evidence reason `addressing-unresolved`; blocking detail `repository-binding-unresolved` |

A target-unresolved remote still normalizes — `normalizeRepositoryKey("https://gitlab.com/owner/repo.git")` is `gitlab.com/owner/repo` — but yields no binding because the GitHub target gate (the NG-5 boundary) does not resolve, not because the key is unavailable. A key-unresolved remote fails `normalizeRepositoryKey` itself.

Local-path origins fall on the same split, by shape rather than by being paths: `normalizeRepositoryKey` accepts any value with at least three path segments, so `../local/repo` → `../local/repo` and `/home/user/repo` → `home/user/repo`, while `./repo` → undefined and `not-a-url` → undefined. A multi-segment local path is therefore never a key-unresolved example: in the composition it falls in the target-unresolved cell, because the GitHub target gate refuses it first, and it is outside the supported GitHub-remote origin forms. Consequently `key-unresolved` is not independently observable from `target-unresolved` in a real composition; the cell states the derivation's total outcome and is exercised by the targeted asymmetry mutation.

**Evidence for the key-unresolved cell.** The cell is a symmetry guard, not a revert detector: the pre-fix composition already emits no binding there. Its evidence is the in-place asymmetry mutation in the production derivation. The mutated derivation emits a root-only binding, the queue edge forwards it field-wise, and the queue domain refuses it with `input.value.rejected` and the summary naming the key-and-root-together invariant; the cell's test reds at the add-outcome assertion because it expected a successful unbound add with neither field and instead observes that refusal. No system diagnostic announces a root-only binding — the refusal is the domain's ordinary invariant message.

### Appendix B — Defect locus evidence (symbol-level)

| Observation | Where it lives | Verified behaviour |
|---|---|---|
| One-sided binding construction | Production composition, queue composition construction | Supplies the bare `owner/name` target only; no root |
| Add-time invariant | Queue application layer, desired-entry resolution | Rejects when exactly one of key/root is present |
| Read-time invariant | Queue application layer, entry-record predicate | Rejects a record with exactly one field as a torn store |
| Field-wise forwarding | Queue edge composition, add mutation | Copies each field independently; no pair enforcement |
| Normalized key definition | Queue contention-key domain (`normalizeRepositoryKey`) and dispatch identity (`normalizeRepositoryRemote`) | `normalizeRepositoryKey` lowercases every segment to `host/owner/name`; `normalizeRepositoryRemote` lowercases the host only and preserves owner/name case, so it cannot produce the recorded key |
| Key-vs-root comparison | Deploy-expectation resolution | Compares the entry key with `normalizeRepositoryKey` of the recorded root's normalized remote by exact equality |
| Scheduler-key precedence | Dispatch identity resolution | A non-normalizable scheduler key falls through to the remote-derived identity |
| Coverage gap | Queue CLI fixture, pilot fixture | Always both fields / key only; no one-sided composition case |

### Appendix C — Repro evidence expected after the fix

| Step | Pre-fix | Post-fix |
|---|---|---|
| `queue add GH-<n>` | `result=refused`, `input.value.rejected`, invariant summary | `result=added`, exit 0, entry recorded with both fields |
| `queue list` | `entries=0` | Entry observed; the JSON projection carries the normalized key; the human rendering is unchanged; the root is absent from output |
| `dispatch GH-<n>` | `queue.entry.unobserved` | Observation gate passes; any remaining failure is unrelated |

### Appendix D — Sources consulted

- Ticket GH-273 (symptom, root cause, repro, fix direction).
- Scheduling-engine system spec (entry record contract, root non-disclosure, normalized key, readiness evidence, deploy-expectation matching).
- CLI entrypoint system spec (production composer wiring, repository facts).
- Delivered source behaviour of the production composition, queue edge, queue application layer, queue readiness, repository facts adapter, and dispatch identity resolution.
- Existing queue, dispatch, and pilot fixtures and their repository-key forms.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-08 | spec-writer | Initial specification from ticket GH-273 and the planning session |
| 1.1 | 2026-11-08 | spec-writer | AC wording aligned with verifiable evidence classes (AC-F2-3, AC-F3-2, AC-F4-1, AC-F5-3, AC-F6-1, AC-F6-2, AC-F6-4) and the matching NFR/§ repeats (NFR-4, NFR-5, NFR-6, §4.1, §5.1, §18); no scope, goal, capability, or decision change |
| 1.2 | 2026-11-08 | spec-writer | DoR iteration-1 rulings: B1 — `normalizeRepositoryKey` named as the single authority for the recorded key (F-3, §8.3, §8.4, flows, DEC-3, assumptions, glossary, appendices), with `normalizeRepositoryRemote`'s host-only lowercasing excluded; B2 — binding presence defined against the GitHub target gate (`parseGitHubRemote`/`repositoryTargetOf`) plus key and root resolution, matrix cells relabelled by cause (target-unresolved, key-unresolved, root-unresolved), AC-F1-2/AC-F1-3/AC-F6-1/NFR-1/NFR-4 aligned; advisories A4 (OQ-1/OQ-2 resolved), A5 (DEC-5 seam type shape), A8 (fresh-ledger qualifier), A10 (human rendering unchanged), A11 (pinned production export), A6 (readiness evidence reason vs blocking detail) folded in. No scope, goal, capability, or decision reversed; no AC added, removed, or renumbered |
| 1.3 | 2026-11-08 | spec-writer | DoR iteration-2 advisories: A13 — local paths corrected as key-unresolved examples (F-1, F-3, Flow 2, AC-F1-2, Appendix A): `normalizeRepositoryKey` treats any three-segment value as `host/owner/name`, so a multi-segment local path normalizes and is excluded by the target gate instead; the key guard is noted as redundant behind the target gate for parseable remotes. A14 — asymmetry-mutation red signal restated as the domain's `input.value.rejected` refusal (AC-F6-1, §18, Appendix A). B4 — NFR-4 now names, per layer, the artifact to revert or mutate (production derivation for composition add and root-unresolved, asymmetry mutation for key-unresolved, pilot fixture binding for fixture shape, predicate mutation for domain negatives), with AC-F6-3 carrying the fixture-revert evidence and AC-F6-1 scoped to the producer; §4.1 and F-6 aligned. No AC id, scope, goal, capability, or decision change |

---

## AUTHORING GUIDELINES

- **Inputs**: ticket GH-273, the planning-session summary, the scheduling-engine and CLI-entrypoint system specs, and direct verification of the delivered producer, edge, domain, readiness, and identity behaviour. Every claim in §2.1 was re-verified against the repository rather than accepted from the session summary; the host-less key is ticket-required (DEC-3/OQ-1) and the injected-facts false-green path extends the ticket's framing (DEC-5).
- **Deliberate limits**: the spec states outcomes and contracts, not implementation steps. It names no source-file path or implementation step except where a pinned boundary must be stated by module name (the production composition export set, A11); components are otherwise described by role and symbol. It forbids the tempting shortcut of relaxing the domain invariant and forbids any output change that would turn a small fix into an interface change.
- **Relationship to the ticket**: the ticket's acceptance list is the floor, not the ceiling. The three ticket acceptance bullets map to AC-F1-1/AC-F4-2, AC-F1-2/AC-F1-3/AC-F1-4, and AC-F6-1/AC-F6-2/AC-F6-3/AC-F6-4 respectively.
- **Downstream readiness**: acceptance criteria are Given/When/Then and each references at least one functional, data-model, or non-functional identifier, so the test plan and delivery plan can trace directly.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-273)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-, G-, NG-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no step-by-step tasks; module/test names appear only as pinned export and boundary constraints)
- [x] No content duplicated from linked docs
- [x] Front matter validates per front_matter_rules
